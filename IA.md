# IA no Sistema B7 — como funciona e como ligar

A IA no B7 não é um módulo: é uma capacidade que aparece dentro das telas, onde ajuda. Hoje existe um uso — o **assistente de escrita nos roteiros**. Não há item de menu, página de chat nem painel de IA.

## Caminho de um pedido

```
tela (js/ia-roteiro.js)
  → B7.IA.pedir('roteiro', …)                 js/ia.js
    → Edge Function b7-ia                      sessão, permissão, limite de uso, registro
      → tarefa    _shared/ia/roteiro.ts        valida o pedido, carrega o contexto com o RLS da pessoa, monta as instruções
        → serviço   _shared/ia/servico.ts      escolhe o provedor, prazo, tradução dos erros
          → provedor  _shared/ia/provedor.ts   o contrato (o que um provedor recebe e devolve)
            → _shared/ia/gemini.ts → API do Gemini
```

- O navegador nunca fala com provedor de IA e nunca manda prompt. Ele pede uma **tarefa conhecida**.
- A tela não sabe qual provedor ou modelo respondeu. A resposta que ela recebe é do B7: `{ ok: true, texto, id }` ou `{ ok: false, categoria }`.
- Sem chave configurada, a função responde "indisponível" e o resto do B7 funciona igual.

## Provedor atual: Gemini, direto

Nesta fase o B7 chama a **API do Gemini (Google AI Studio)** diretamente, na **camada gratuita**. É o provedor de agora, não a arquitetura: `gemini.ts` é o único arquivo que conhece o Google.

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

## Registro de uso

Tabela `ia_uso` (ver `migration_ia_uso.sql`): quem pediu, qual ação, em qual cena, se deu certo, provedor, modelo, motivo do erro, duração, tokens e tamanhos em caracteres. **Não guarda** o texto do roteiro, a instrução nem a sugestão. Só o servidor lê; não há tela para isso. O `id` da linha é o que a função devolve como `id` do pedido.

As colunas `tentativas`, `houve_fallback` e `custo` ficam vazias nesta fase (não há troca de modelo); voltam a ter uso com um roteador.

```sql
select acao, status, erro_categoria, count(*), round(avg(duracao_ms)) as ms
from ia_uso where created_at > now() - interval '7 days'
group by 1, 2, 3 order by 4 desc;
```

## Trocar de provedor depois (OmniRoute)

1. Escrever `supabase/functions/_shared/ia/omniroute.ts` devolvendo um `Provedor` (contrato em `provedor.ts`): recebe mensagens, teto de tokens, temperatura e prazo; devolve o texto ou um dos erros do contrato.
2. Em `servico.ts`, trocar a linha de `provedorAtual()`.
3. Configurar os segredos do novo provedor e fazer o deploy da `b7-ia`.

Telas, tarefas, permissões, limites, registro e frases de erro não mudam.

## Nova tarefa de IA no futuro

1. Um arquivo em `supabase/functions/_shared/ia/` com a validação do pedido, o carregamento do contexto e as instruções.
2. Um caso a mais em `b7-ia/index.ts`.
3. Na tela, `B7.IA.pedir('<tarefa>', dados)`, e uma chave em `B7_CONFIG.IA`.

O serviço, o provedor, a sessão, o limite e o registro são os mesmos.
