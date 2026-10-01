# IA no Sistema B7 — como funciona e como ligar

A IA no B7 não é um módulo: é uma capacidade que aparece dentro das telas, onde ajuda. Hoje existe um uso — o **assistente de escrita nos roteiros**. Não há item de menu, página de chat nem painel de IA.

## Caminho de um pedido

```
tela (js/ia-roteiro.js)
  → B7.IA.pedir('roteiro', …)                 js/ia.js
    → Edge Function b7-ia                      sessão, permissão, limite de uso, registro
      → tarefa  _shared/ia/roteiro.ts          valida o pedido, carrega o contexto com o RLS da pessoa, monta as instruções
        → serviço  _shared/ia/servico.ts       roteador, lista de modelos, troca de modelo, prazo
          → OmniRoute → provedor gratuito
```

- O navegador nunca fala com o roteador nem com provedor de IA, e nunca manda prompt. Ele pede uma **tarefa conhecida**.
- A tela não sabe qual modelo respondeu. Trocar de modelo ou de provedor é mexer em segredos, não em código.
- Sem roteador configurado, a função responde "indisponível" e o resto do B7 funciona igual.

## O roteador: OmniRoute

O projeto é o [OmniRoute](https://github.com/diegosouzapw/OmniRoute): um gateway de IA de código aberto, **que você mesmo hospeda**. Ele expõe uma API compatível com a da OpenAI e roteia entre provedores, com troca automática quando um falha.

Conferido na documentação dele (01/10/2026):

- endpoint `POST {base}/v1/chat/completions`, com `Authorization: Bearer <chave criada no painel>`;
- o campo `model` aceita o nome de um **combo** (uma cadeia de modelos que ele percorre) ou o id de um modelo;
- `401` = chave ausente ou inválida; `502` = todos os provedores falharam;
- a troca interna acontece em falhas transitórias (tempo esgotado, rede, limite de uso, erro 5xx), em até três tentativas;
- a resposta traz cabeçalhos `X-OmniRoute-Model`, `-Provider`, `-Fallback-Attempts`, `-Tokens-In`, `-Tokens-Out` e `-Response-Cost`;
- não existe versão hospedada pelo projeto: é preciso um servidor (cerca de 2 GB de RAM livres), com HTTPS, e `REQUIRE_API_KEY` ligado **antes** de expor na internet.

O que a documentação **não** promete: custo zero garantido. Ela avisa que cotas, políticas e condições de cada provedor gratuito continuam valendo e podem mudar, e marca alguns provedores gratuitos como "evitar" pelos termos de uso.

## Política de custo zero

1. O B7 só pede o que estiver em `B7_IA_MODELOS`. Não há modelo de reserva fora da lista nem troca para modelo pago.
2. Quando a lista acaba, a pessoa vê "Assistente de IA temporariamente indisponível".
3. Quem torna a lista gratuita é a configuração do roteador: **conectar nele só provedores gratuitos**. Com um provedor pago conectado, um combo pode acabar usando-o.
4. Segunda tranca: se o roteador informar custo maior que zero, o valor fica gravado em `ia_uso.custo`.

## Troca de modelo no B7

Na ordem de `B7_IA_MODELOS`, uma tentativa por item, com prazo total de 50 s (25 s por tentativa):

| O que aconteceu | O que o B7 faz |
|---|---|
| sem resposta, tempo esgotado, `408`, `425`, `429`, `5xx` | tenta o próximo |
| modelo que o roteador não conhece (`400`, `404`, `422`) | tenta o próximo |
| resposta vazia ou fora do formato | tenta o próximo |
| `401` / `403` do roteador (chave errada) | para: nenhum outro modelo resolveria |
| sessão, permissão ou pedido inválido da pessoa | nem chega ao roteador |

Se a lista tiver um único combo, quem faz as trocas é o próprio OmniRoute, dentro do combo. Com mais de um item, o B7 passa para o seguinte quando o anterior falha.

## Como ligar

**1. Ter um OmniRoute no ar**, com endereço público em HTTPS, `REQUIRE_API_KEY` ligado, só provedores gratuitos conectados e um combo com eles.

**2. Segredos da função** (nomes; os valores nunca entram no repositório nem no navegador):

```bash
supabase secrets set B7_IA_BASE_URL=https://<endereço-do-roteador>/v1 B7_IA_API_KEY=<chave do painel> B7_IA_MODELOS=<combo-ou-modelos,separados,por,vírgula>
```

**3. Ligar a entrada na tela**, em `js/config.js`:

```js
IA: { roteiros: true }
```

Com `false`, o editor nem mostra o assistente.

Deploy da função, quando o código mudar:

```bash
supabase functions deploy b7-ia --no-verify-jwt
```

`--no-verify-jwt` porque a função confere a sessão ela mesma (`auth.getUser`), e responde com um corpo que a tela sabe ler.

## Segurança

- **Sessão:** conferida no servidor. Sem sessão válida, `401`.
- **Quem pode:** equipe. Cliente do Portal recebe `403`.
- **Permissão sobre a cena:** o contexto é carregado com a sessão da própria pessoa, então quem decide é o RLS que já existe em `cenas` e `roteiros`. Nenhuma policy foi criada ou afrouxada.
- **Contexto enviado ao modelo:** título e objetivo do roteiro, tipo da cena, as outras cenas resumidas e o trecho. Não vai nome do cliente, nota interna, outros roteiros nem dados de pessoas.
- **Instrução livre:** entra como pedido sobre aquele trecho, com limite de 300 caracteres. O texto do roteiro vai delimitado e o modelo é instruído a não obedecer ordens que apareçam dentro dele.
- **Saída do modelo:** tratada como texto, nunca como HTML.
- **Limite por pessoa:** 8 pedidos por minuto, 80 por hora e 2 ao mesmo tempo.

## Registro de uso

Tabela `ia_uso` (ver `migration_ia_uso.sql`): quem pediu, qual ação, em qual cena, se deu certo, qual modelo e provedor atenderam, as tentativas que falharam, se houve troca, duração, tokens e custo. **Não guarda** o texto do roteiro, a instrução nem a sugestão. Só o servidor lê; não há tela para isso.

Para ver o que os modelos gratuitos estão entregando, no SQL Editor:

```sql
select modelo, status, erro_categoria, houve_fallback, count(*), round(avg(duracao_ms)) as ms
from ia_uso where created_at > now() - interval '7 days'
group by 1, 2, 3, 4 order by 5 desc;
```

## Nova tarefa de IA no futuro

1. Um arquivo em `supabase/functions/_shared/ia/` com a validação do pedido, o carregamento do contexto e as instruções.
2. Um caso a mais em `b7-ia/index.ts`.
3. Na tela, `B7.IA.pedir('<tarefa>', dados)`, e uma chave em `B7_CONFIG.IA`.

O serviço (`servico.ts`), a sessão, o limite e o registro são os mesmos.
