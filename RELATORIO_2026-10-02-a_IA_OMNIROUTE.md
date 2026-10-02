# Relatório 2026-10-02-a — OmniRoute como provedor de IA (pronto, desligado)

> **Situação (02/10/2026).** O B7 já sabe falar com o OmniRoute e passa a usá-lo sozinho quando três segredos forem configurados. **Nada mudou em uso:** a IA continua respondendo pelo Gemini direto, porque ainda não existe um OmniRoute rodando para a B7. Nenhum OmniRoute real foi chamado.

## Resumo da atualização

- **Novo provedor:** `supabase/functions/_shared/ia/omniroute.ts`, atrás do mesmo contrato do Gemini.
- **Escolha por configuração:** com `OMNIROUTE_URL`, `OMNIROUTE_API_KEY` e `OMNIROUTE_MODEL` configurados, a função `b7-ia` usa o OmniRoute; faltando qualquer um, usa o Gemini direto. Trocar e voltar não exige código nem deploy.
- **Registro:** com roteador, `ia_uso` passa a guardar quem atendeu por trás dele, se houve troca interna e o custo informado.
- **Sem mudança** em telas, tarefas (roteiros e linha editorial), permissões, RLS, limites por pessoa, frases de erro ou banco. Sem migration. A versão do front continua `2026-10-01-ae`.

## Contexto

Em 01/10 a instalação do OmniRoute neste computador foi recusada e a decisão foi usar o Gemini direto, deixando o OmniRoute para depois. O adaptador do pacote `z` (que falava esse protocolo) tinha sido substituído pelo do Gemini. Este pacote devolve o OmniRoute como segundo provedor, sem tirar o Gemini.

## O que foi conferido na documentação do OmniRoute

README e `docs/openapi.yaml` do repositório `diegosouzapw/OmniRoute`, em 02/10/2026:

- API no formato da OpenAI: `POST /v1/chat/completions`, `Authorization: Bearer <chave>`; porta padrão `20128`;
- `model` aceita nome de combo, `provedor/modelo` ou os combos automáticos (`auto`, `auto/fast`…);
- `401` chave ausente ou inválida; `502` todos os provedores falharam; `503` nenhum provedor saudável;
- cabeçalhos `X-OmniRoute-Model`, `-Provider`, `-Fallback-Attempts`, `-Tokens-In`, `-Tokens-Out`, `-Response-Cost`;
- instalação: `npm install -g omniroute`, Docker, aplicativo de desktop; **não há versão hospedada pelo projeto**.

## Decisões de implementação

- **Só HTTPS.** Um `OMNIROUTE_URL` em `http://` é ignorado (o B7 segue no Gemini): a chave e o texto do cliente passam por essa ligação.
- **Uma chamada por pedido.** A troca entre modelos é do roteador, dentro do combo. O B7 não repete e **não cai para o Gemini direto** se o roteador estiver fora do ar; a pessoa vê "temporariamente indisponível". Mantive a regra de "sem reserva" que já valia.
- **Sem `response_format`.** Nem todo provedor gratuito aceita, e um que recuse derrubaria o pedido. As instruções da tarefa já pedem JSON e a validação no servidor é a mesma da linha editorial.
- **Resposta cortada ou vazia** (inclusive só "pensamento" do modelo) é tratada como inválida, igual ao Gemini.

## Arquivos

- `supabase/functions/_shared/ia/omniroute.ts` (novo)
- `supabase/functions/_shared/ia/servico.ts` — `provedorAtual()` escolhe pelo segredo; resultado leva `servidoPor`, `trocas`, `custo`
- `supabase/functions/_shared/ia/provedor.ts` — três campos opcionais na resposta do provedor
- `supabase/functions/b7-ia/index.ts` — grava esses três dados em `ia_uso` quando existem
- `IA.md` — seção "OmniRoute"

Função `b7-ia` publicada no Supabase.

## Testes realizados

**Automatizados, com o roteador simulado** (função temporária no Supabase, respostas falsas no lugar do OmniRoute; apagada depois):

- Escolha do provedor: os três segredos → OmniRoute; sem URL, sem chave, sem modelo ou com URL em `http://` → Gemini; sem nada → não configurado; **com os segredos de produção de hoje → Gemini**.
- Pedido enviado: endereço `…/v1/chat/completions` (com e sem `/v1` no segredo), cabeçalho `Bearer`, corpo com `model`, `messages`, `stream: false`, `temperature`, `max_tokens`.
- Resposta com cabeçalhos do roteador: texto limpo, modelo e provedor reais, trocas, tokens e custo lidos. Sem cabeçalhos: dados lidos do corpo. Conteúdo em partes: juntado.
- Erros → frase da tela: `401`/`403` indisponível; `404` e `400` de modelo indisponível; `402` e `429` de cota → cota; `429` por minuto → limite; `502`, `503`, `500` com HTML → indisponível; `504` e prazo estourado → tempo; filtro de conteúdo → recusado; resposta vazia, só "pensamento", cortada, fora do formato → indisponível; falha de rede → indisponível.

**Real:**

- Uma chamada ao Gemini pelo caminho novo (`provedorAtual` → `gerar`): respondeu em 0,9 s pelo `gemini-3.5-flash-lite`.
- `b7-ia` publicada responde `401` sem sessão.

## O que NÃO foi testado

- **Nenhum OmniRoute real.** Não existe um; o comportamento dele foi simulado a partir da documentação.
- Pedido com login pelas telas depois deste deploy (roteiros e linha editorial). O caminho do Gemini foi exercitado no servidor, não pela tela.
- Gravação de `provedor`, `houve_fallback` e `custo` em `ia_uso` com dados de um roteador de verdade.
- Qualidade do texto em português dos modelos gratuitos atrás do roteador, e se eles devolvem as listas da linha editorial em JSON válido.

## Pendências

1. **Decidir onde o OmniRoute roda** (é a única coisa que falta para ligar):
   - servidor (VPS) com Docker, cerca de US$ 5 por mês, no ar o tempo todo;
   - este computador com um túnel: custo zero, mas a IA só funciona com o PC ligado e o endereço do túnel gratuito muda a cada reinício. Como o B7 não cai para o Gemini, **com o PC desligado a IA fica fora do ar** para a equipe.
2. No painel do OmniRoute (feito por você): senha do painel, exigir chave de API, conectar **só provedores gratuitos**, criar um combo e uma chave para o B7.
3. Gravar os três segredos no Supabase (você, sem colar chave no chat). Depois disso eu testo com modelo real e confiro o registro.
4. Pendência anterior que continua: testar logado a IA da linha editorial e um roteiro.

## Observações

- Hoje o Gemini direto atende bem e sem custo. O ganho do OmniRoute é ter mais de um provedor gratuito quando a cota de um acaba; o custo é manter um serviço no ar.
- Com o roteador, o texto do cliente passa a ir para o provedor que ele escolher. Vale conferir a política de cada provedor gratuito antes de conectá-lo.
