# zzz293 — Legendas: a IA não troca mais palavra nem apaga legenda

**Pedido:** "está mudando algumas palavras, tipo a pessoa fala nesse, ele coloca neste" · "está excluindo legenda quando ela não é consertada".

## Causa
A trava anti-reescrita (`parecido` em `js/legendas.js`) aceitava a resposta da IA se ela fosse 55% parecida com a original — e, em legenda com menos de 4 palavras, aceitava **qualquer coisa**, até texto vazio ou pela metade (a IA às vezes "empurra" palavras para a legenda vizinha). Por isso "nesse" virava "neste" e legendas curtas sumiam.

## O que mudou
- **Conferência palavra por palavra** (`js/legendas.js`): toda palavra falada tem que continuar na legenda. Só passa:
  - grafia/acento (ex.: calvice → calvície, pos operatorio → pós-operatório), juntar/separar (contra cheque → contracheque);
  - número falado → 100% / R$ (como antes);
  - nome de marca/termo da lista ou nome de cliente (ex.: Infinity Film → Infinite Fio).
- Fica **barrado** (volta a original): nesse/neste, esse/este, isso/isto, desse/deste…; pra/para, tá/está, tô/estou, cê/você; mas/mais; singular ↔ plural; masculino ↔ feminino; palavra acrescentada ou tirada; legenda vazia ou encurtada.
- Quando a IA é barrada, aparece a sugestão dela com o botão **"Usar a sugestão"** (se for o caso, a pessoa aceita na mão).
- **Instruções da IA** (`supabase/functions/_shared/ia/extra.ts`): regras explícitas de não trocar demonstrativos, número/gênero, nem mover palavras entre legendas; legenda sem correção volta igual.
- Testes: 12 conferências novas em `testes/legendas.test.mjs`.

## Versão
- `VERSAO` 2026-10-29-zzz293 · cache `roteiros-b7-v495`. A função b7-ia é publicada pelo workflow ao entrar no main.
