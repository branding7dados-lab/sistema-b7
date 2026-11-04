# IA no Sistema B7 — como funciona e como ligar

A IA no B7 não é um módulo: é uma capacidade que aparece dentro das telas, onde ajuda. Hoje existem dois usos: o **assistente de escrita nos roteiros** e o **assistente da linha editorial** (estratégia, pilares e conteúdos). Não há item de menu, página de chat nem painel de IA.

## Caminho de um pedido

```
tela (js/ia-roteiro.js ou js/ia-linha.js)
  → B7.IA.pedir('roteiro' | 'linha', …)       js/ia.js
    → Edge Function b7-ia                      sessão, permissão, limite de uso, registro
      → tarefa    _shared/ia/roteiro.ts        valida o pedido, carrega o contexto com o RLS da pessoa, monta as instruções
                  _shared/ia/linha.ts          idem, para a linha editorial
        → serviço   _shared/ia/servico.ts      escolhe o provedor, prazo, tradução dos erros
          → provedor  _shared/ia/provedor.ts   o contrato (o que um provedor recebe e devolve)
            → _shared/ia/gemini.ts    → API do Gemini            (provedor em uso)
            → _shared/ia/omniroute.ts → OmniRoute → vários modelos (pronto, desligado)
```

- O navegador nunca fala com provedor de IA e nunca manda prompt. Ele pede uma **tarefa conhecida**.
- A tela não sabe qual provedor ou modelo respondeu. A resposta que ela recebe é do B7: `{ ok: true, texto, id }` (um campo), `{ ok: true, itens, id }` (uma lista) ou `{ ok: false, categoria }`.
- Sem chave configurada, a função responde "indisponível" e o resto do B7 funciona igual.

## Provedor atual: Gemini, direto

Nesta fase o B7 chama a **API do Gemini (Google AI Studio)** diretamente, na **camada gratuita**. É o provedor de agora, não a arquitetura: `gemini.ts` é o único arquivo que conhece o Google. O OmniRoute já tem adaptador e entra por configuração (seção própria, mais abaixo).

Conferido na documentação oficial (ai.google.dev) em 01/10/2026:

- `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, com a chave no cabeçalho `x-goog-api-key`;
- o texto volta em `candidates[].content.parts[].text`; o motivo de término em `finishReason`; bloqueio do pedido em `promptFeedback.blockReason`; os tokens em `usageMetadata`;
- erros: `401`/`403` chave, `404` modelo, `429` limite por minuto **ou** cota diária, `500`/`503`/`504` serviço;
- os limites da camada gratuita são por projeto do Google (pedidos por minuto, tokens por minuto e pedidos por dia; a cota diária zera à meia-noite do horário do Pacífico). Os números de cada modelo só aparecem dentro do AI Studio e podem mudar.

**Modelo:** `gemini-3.5-flash-lite`. Na página de preços aparece como gratuito na camada gratuita, e na de modelos como o mais rápido e econômico da linha 3.5 — o que este recurso pede: reescrever trechos curtos em português, com pouca espera. Para trocar sem mexer em código, existe o segredo opcional `GEMINI_MODEL`.

## Política de custo

1. **Uma chave, um modelo, uma chamada por pedido.** Não há modelo de reserva, outro provedor, nem nova tentativa automática.
2. Quando o Google responde que o limite ou a cota acabou, a pessoa vê um aviso e decide quando tentar de novo. Repetir sozinho só gastaria mais cota.
3. **Cobrança só existe se alguém ativar o faturamento do projeto no Google.** O B7 não liga faturamento e não tem como ligar. Com faturamento desligado, cota esgotada apenas recusa o pedido.
4. O limite por pessoa (abaixo) protege a cota, que é uma só para a equipe toda.

## O que a pessoa vê quando falha

| O que aconteceu | Registro (`ia_uso.erro_categoria`) | Frase na tela |
|---|---|---|
| limite por minuto do Google (`429`) | `limite` | Muitos pedidos em sequência. Espere um minuto e tente de novo. |
| cota do dia esgotada (`429` de cota, `402`) | `cota` | Limite temporário do assistente atingido. Tente novamente mais tarde. |
| não respondeu em 30 s (`408`, `504`) | `tempo` | A sugestão demorou demais para chegar. Tente novamente. |
| o Google se recusou a gerar (filtro de conteúdo) | `recusado` | O assistente não conseguiu trabalhar este trecho. Reformule o pedido ou escreva o texto de outro jeito. |
| chave ausente, inválida ou sem permissão | `nao_configurado` / `credencial` | Assistente de IA temporariamente indisponível. Tente novamente em alguns minutos. |
| modelo inexistente (`404`) | `modelo` | idem |
| pedido que o Google não aceitou (`400`) | `pedido_invalido` | idem |
| resposta vazia, cortada ou fora do formato | `resposta_invalida` | idem |
| serviço fora do ar, erro interno, rede | `indisponivel` | idem |

O erro cru do Google nunca chega à tela. O limite do próprio B7 (8 por minuto, 80 por hora, 2 ao mesmo tempo, por pessoa) responde `limite` ou `ocupado` antes de qualquer chamada externa.

Teto de saída por ação: 768 tokens para gancho e CTA, 1.024 para encurtar, 2.048 para as demais.

## Como ligar

**1. Criar a chave** em <https://aistudio.google.com/apikey> (conta Google, sem cartão e sem ativar faturamento).

**2. Guardar a chave como segredo do Supabase**, com o nome exato `GEMINI_API_KEY`:

- painel do Supabase → projeto do B7 → **Edge Functions** → **Secrets** → *Add new secret*; ou
- pelo terminal:

```bash
supabase secrets set GEMINI_API_KEY=<a chave> --project-ref rartcafydsaocdzshqcx
```

A chave não entra no repositório, no `js/config.js`, no navegador nem em relatório. Segredo de Edge Function só é lido pelo servidor.

**3. Ligar a entrada na tela**, em `js/config.js`:

```js
IA: { roteiros: true }
```

Com `false`, o editor nem mostra o assistente.

Deploy da função, quando o código mudar:

```bash
supabase functions deploy b7-ia --no-verify-jwt
```

`--no-verify-jwt` porque a função confere a sessão ela mesma (`auth.getUser`) e responde com um corpo que a tela sabe ler.

## Segurança e privacidade

- **Chave:** só no segredo `GEMINI_API_KEY`, lida pela função. Vai ao Google no cabeçalho da chamada, nunca na URL nem em registro.
- **Sessão:** conferida no servidor. Sem sessão válida, `401`.
- **Quem pode:** equipe. Cliente do Portal recebe `403`.
- **Permissão sobre a cena:** o contexto é carregado com a sessão da própria pessoa, então quem decide é o RLS que já existe em `cenas` e `roteiros`. Nenhuma policy foi criada ou afrouxada.
- **Contexto enviado ao modelo:** título e objetivo do roteiro, tipo da cena, as outras cenas resumidas e o trecho. Não vai nome do cliente, nota interna, outros roteiros nem dados de pessoas.
- **Instrução livre:** entra como pedido sobre aquele trecho, com limite de 300 caracteres. O texto do roteiro vai delimitado e o modelo é instruído a não obedecer ordens que apareçam dentro dele.
- **Saída do modelo:** tratada como texto, nunca como HTML.
- **Camada gratuita do Google:** segundo a página de preços, o conteúdo enviado na camada gratuita **pode ser usado pelo Google para melhorar os produtos dele**; na camada paga, não. Vale saber antes de usar o assistente em roteiros com informação sensível de cliente.

## Linha editorial

Ligada por `IA: { linhas: true }` em `js/config.js`. A tela é `js/ia-linha.js`; a tarefa no servidor é `_shared/ia/linha.ts`.

| Operação | Onde aparece | O que devolve |
|---|---|---|
| `campo` | ícone no rótulo de um campo de texto (estratégia, objetivo do pilar, textos do conteúdo) | texto para aquele campo |
| `sugerir_pilares` | "Sugerir pilares", na seção de pilares | lista de tipos de pilar que a linha ainda não tem |
| `sugerir_conteudos` | "Sugerir conteúdos" (aba Criativos) e "Sugerir ideias para este pilar" | 3, 5 ou 8 ideias de conteúdo |
| `revisar_estrategia` | "Revisar estratégia" (aba Estratégia) | observações |
| `revisar_linha` | "Revisar linha editorial" (Visão geral, com 3 conteúdos ou mais) | observações estruturadas sobre o conjunto do mês |

- **Nada é gravado pela IA.** Um campo só muda em "Aplicar", pelo evento de digitação do próprio campo (autosave de sempre). Pilar e conteúdo sugeridos só são criados para os itens que a pessoa marcar, pela mesma criação de um pilar ou conteúdo feito à mão; depois disso são registros comuns, sem marca de IA.
- **Contexto por operação.** Um campo da estratégia leva os outros campos da estratégia. Um campo de pilar leva objetivo e posicionamento. Um campo de conteúdo leva objetivo, tom de voz e os outros textos daquele conteúdo. Ideias de conteúdo levam estratégia, pilares e os títulos já planejados **daquela linha** (para não repetir). Nunca vai: outro mês, outro cliente, roteiros, gravações, vídeo, design, aprovações, links de referência, observações internas.
- **Sem base, sem chamada.** Se a linha não tem estratégia suficiente, a função responde `contexto` ("Preencha um pouco mais da estratégia…") e não chama o modelo.
- **Listas validadas no servidor.** O modelo responde em JSON; tipo de pilar e formato fora das listas do B7 são descartados, ideias repetidas dentro da própria resposta são removidas, e as parecidas com um conteúdo que já existe chegam marcadas.
- **Sem percentual.** Pilar sugerido entra com 0%: o peso é decisão da equipe.
- **Quem pode.** Equipe que edita a linha. Designer (só leitura na linha) não vê as entradas, e o servidor recusa.
- **Registro.** `ia_uso.recurso = 'linha'`; `acao` é a operação (`sugerir_conteudos`, `campo.conteudo.legenda.criar`…).
- **Revisão do conjunto (`revisar_linha`, desde 2026-10-02-v).** Uma chamada só, com todos os conteúdos **daquela linha** numerados (título, formato, pilar, ideia, objetivo e CTA) e as contagens por formato e por pilar já feitas pelo sistema. Devolve observações estruturadas: tipo (`semelhantes`, `abordagem`, `cta`, `formatos`, `pilares`, `alinhamento`, `variacao`, `oportunidade`), importância, título, texto, sugestão e os conteúdos citados. Lista vazia é resposta válida ("nada relevante").

### Montar linha com IA (pacote 2026-10-02-z)

- Operação nova `sugerir_estrategia`: propõe objetivo, posicionamento, tom de voz, PUV e percepção. Devolve `itens: [{ campo, rotulo, texto }]`; a tela grava só os campos marcados (`B7.Linha` → `aplicarEstrategia`).
- "Montar linha com IA" (`B7.IALinha` → `abrirMontagem`) encadeia `sugerir_estrategia` → `sugerir_pilares` → `sugerir_conteudos` (8), uma chamada por etapa, com direcionamento opcional. Cada etapa pode ser pulada.
- As três sugestões recebem o cadastro do cliente (`cliente_inteligencia` e `produtos`, sem preço). `sugerir_estrategia` recebe também a linha anterior DO MESMO cliente — exceção consciente à regra "nunca vai outra linha".
- As ações de IA de cada aba ficam num bloco único (`B7.IALinha.bloco`).

## Análise: revisar roteiro e comparar com o planejamento

Ligada pelo mesmo `IA: { roteiros: true }`. A tela é `js/ia-analise.js`; a tarefa no servidor é `_shared/ia/analise.ts` (`tarefa: 'analise'`).

| Operação | Onde aparece | O que devolve |
|---|---|---|
| `revisar_roteiro` | "Revisar roteiro", no topo do roteiro | até 6 observações (gancho, coerência, repetição, naturalidade, clareza, ritmo, CTA, alinhamento, conferir informação), cada uma com a cena |
| `comparar_planejamento` | "Comparar com planejamento", só em roteiro ligado a um conteúdo da Linha Editorial | de 2 a 6 pontos (ideia, objetivo, ângulo, pontos-chave, formato, CTA, tom), cada um "alinhado", "atenção" ou "mudança de abordagem" |
| `rascunho_roteiro` | "Criar rascunho", só em roteiro ainda sem fala (pacote 2026-10-02-w) | de 3 a 6 cenas propostas (Gancho, Narrativa, CTA) com orientação e fala; aceita `instrucao` opcional de até 300 caracteres. A tela só cria as cenas que a pessoa marcar (`B7.Editor` → `cenasDoRascunho`) |

Da observação para o ajuste: o cartão da revisão com sugestão e cena tem "Ajustar com IA", que abre o assistente da cena (`B7.IARoteiro.abrirCom`) com a sugestão como instrução. Não gera nem aplica sozinho.

- **Análise nunca altera nada.** Não existe "aplicar". Não cria tarefa, não muda status, não bloqueia gravação.
- **Sem nota.** Observação com nota, "x/10" ou percentual de qualidade ou alinhamento é descartada no servidor.
- **Vínculo real.** A comparação usa `roteiros.content_id` (e `conteudos.script_id` de volta). Nada é adivinhado por título. O vínculo só vale se o conteúdo for do mesmo cliente da gravação do roteiro e não apontar para outro roteiro. Sem vínculo, o botão não aparece e o servidor responde `sem_vinculo`.
- **Contexto por operação.** Revisar: título, objetivo e cenas (tipo, orientação e fala) + três campos do conteúdo planejado, se houver. Comparar: o conteúdo planejado, o pilar dele, tom de voz e objetivo do período da linha + o roteiro. Nunca vai: nome do cliente (a não ser que esteja escrito na fala), nota interna, outros roteiros, outros meses, aprovações, pessoas.
- **Resposta estruturada.** As três análises mandam ao provedor o formato esperado (`responseSchema`), e o servidor valida de novo: tipo fora da lista, cena que não existe e texto vazio são descartados.
- **Sem base, sem chamada.** Roteiro com pouca fala responde `pouco`; conteúdo planejado vazio responde `contexto`.
- **Resultado velho.** A tela guarda o resultado em memória com a "impressão" do roteiro no momento do pedido; reabrir não gasta outra chamada, e se o roteiro mudou aparece "O conteúdo mudou desde esta revisão".
- **Registro.** `ia_uso.recurso = 'analise'`; `acao` é a operação; `entidade_tipo = 'roteiro'`.

## Resumo: texto para o cliente (Status Semanal e Resumo do Mês)

Pacote 2026-10-02-x. Ligada pelo mesmo `IA: { linhas: true }`. A tela é `js/ia-texto.js` (`B7.IATexto`, um painel genérico: gerar, pedir ajuste, aplicar, desfazer); a tarefa no servidor é `_shared/ia/resumo.ts` (`tarefa: 'resumo'`).

| Operação | Onde | Contexto lido no servidor |
|---|---|---|
| `status_semana` | "Escrever com IA" na observação geral do Status Semanal (`js/semana.js`) | demandas do status (dia, tipo, título, situação, observação), sem as canceladas; objetivo do mês, pilar e "do que trata" das demandas ligadas à linha editorial; marcação do que depende do cliente |
| `resumo_mes` | "Escrever com IA" na leitura do mês (`js/resumo-mes.js`) | números do mês contados pelo servidor (as mesmas leituras de `B7.DB.resumoMensal`), objetivo do mês, pilares por presença, até 12 conteúdos publicados com pilar e ideia, programados e total em produção |

Pacote 2026-10-02-y: o contexto ficou mais rico (era só contagem e título, e o texto saía raso) e as instruções proíbem enchimento, jargão interno, efeito inventado e cópia das anotações internas. O Resumo do Mês virou documento 4:5 no padrão do Status Semanal (`.pag45`).

- Aceitam `instrucao` opcional (até 300 caracteres).
- `resumo_mes`: o limpador descarta a resposta se aparecer um número que não está entre os contados (ou um `%`). O detalhe por formato não vai para o modelo: nas provas ele trocava esses números.
- A leitura do mês não é gravada no banco; fica em memória por cliente e mês.
- Designer e cliente do Portal: recusados. `ia_uso.recurso = 'resumo'`.

## Registro de uso

Tabela `ia_uso` (ver `migration_ia_uso.sql`): quem pediu, qual ação, em qual cena, se deu certo, provedor, modelo, motivo do erro, duração, tokens e tamanhos em caracteres. **Não guarda** o texto do roteiro, a instrução nem a sugestão. Só o servidor lê; não há tela para isso. O `id` da linha é o que a função devolve como `id` do pedido.

As colunas `houve_fallback` e `custo` só são preenchidas quando o provedor é um roteador (OmniRoute); com o Gemini direto ficam vazias. `tentativas` não é usada.

```sql
select acao, status, erro_categoria, count(*), round(avg(duracao_ms)) as ms
from ia_uso where created_at > now() - interval '7 days'
group by 1, 2, 3 order by 4 desc;
```

## OmniRoute (pronto no B7, desligado até existir um roteador)

O [OmniRoute](https://github.com/diegosouzapw/OmniRoute) é um roteador de código aberto que **a B7 precisa hospedar**: ele recebe o pedido e distribui entre os provedores conectados no painel dele, trocando sozinho quando um falha. O B7 já sabe falar com ele (`_shared/ia/omniroute.ts`); o que liga é a configuração.

**Como o B7 escolhe o provedor** (`provedorAtual()`, em `servico.ts`), a cada pedido:

- com os três segredos abaixo configurados → OmniRoute;
- faltando qualquer um → Gemini direto, como hoje.

| Segredo | O que é |
|---|---|
| `OMNIROUTE_URL` | endereço público do roteador, em **HTTPS** (com ou sem `/v1` no fim). `http://` é ignorado. |
| `OMNIROUTE_API_KEY` | chave de API criada no painel do OmniRoute |
| `OMNIROUTE_MODEL` | o que o B7 pede: o nome de um combo criado no painel, ou o id de um modelo |

Para voltar ao Gemini direto, apague o segredo `OMNIROUTE_URL`. Não precisa de deploy: segredo novo vale no pedido seguinte.

Conferido na documentação do projeto (README e `docs/openapi.yaml`) em 02/10/2026: `POST {base}/v1/chat/completions` com `Authorization: Bearer <chave>`, no formato da OpenAI; `401` para chave inválida, `502` quando todos os provedores falham; cabeçalhos `X-OmniRoute-Model`, `-Provider`, `-Fallback-Attempts`, `-Tokens-In`, `-Tokens-Out` e `-Response-Cost`. Porta padrão `20128`.

Com o OmniRoute ligado:

- **Uma chamada por pedido, como antes.** Quem troca de modelo é o roteador, dentro do combo. Se o roteador inteiro estiver fora do ar, o B7 **não** cai para o Gemini direto: a pessoa vê "temporariamente indisponível".
- **Custo zero depende do painel do roteador.** O B7 só pede `OMNIROUTE_MODEL`; se o combo tiver um provedor pago, ele pode ser usado. O custo que o roteador informar fica em `ia_uso.custo`.
- **Registro.** `ia_uso.provedor` vira `omniroute:<quem atendeu>`, `modelo` é o que de fato respondeu e `houve_fallback` marca troca interna.
- **Privacidade.** O texto passa pelo roteador e vai para o provedor que ele escolher. Cada provedor gratuito tem a própria política de uso dos dados.
- **Listas em JSON.** O B7 não manda `response_format` ao roteador (nem todo provedor gratuito aceita); as instruções pedem JSON e a validação no servidor é a mesma.

Telas, tarefas, permissões, limites e frases de erro não mudam.

## Nova tarefa de IA no futuro

1. Um arquivo em `supabase/functions/_shared/ia/` com a validação do pedido, o carregamento do contexto e as instruções.
2. Um caso a mais em `b7-ia/index.ts`.
3. Na tela, `B7.IA.pedir('<tarefa>', dados)`, e uma chave em `B7_CONFIG.IA`.

O serviço, o provedor, a sessão, o limite e o registro são os mesmos.

## Sugestão que volta igual ao texto (2026-10-02-zh)

- O prompt do roteiro e dos campos da linha dizia "se a instrução pedir algo que não seja reescrever, devolva o texto original". Pedidos da revisão ("confira se…", "verifique…") caíam nessa regra e a IA ecoava o texto. Agora: observação de revisão = pedido de reescrita (resolver o ponto sem inventar dado); devolver igual é resposta errada; pedido sem relação com o texto → o modelo responde `SEM_RELACAO` e a tela mostra a categoria `fora`.
- Servidor (`b7-ia/index.ts`): em reescrita de texto existente, se a sugestão for praticamente igual ao original (`quaseIgual`, Dice de palavras ≥ 0,9), faz UMA segunda chamada avisando o modelo. Se repetir de novo, responde categoria `igual` — nunca mostra uma "sugestão" idêntica. É a única exceção à regra "um pedido = uma chamada"; cota e limite continuam sem repetição.
