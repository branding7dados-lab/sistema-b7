# zzz277 — Demandas de edição com IA

**Versão:** `2026-10-28-zzz277` · cache `roteiros-b7-v479`

Pedido do Kevin: a IA lê os roteiros das gravações e cria as demandas de edição (quando foi gravado, título, prazo). Ele escolheu a **opção 1**: a IA propõe e a pessoa revisa antes de criar.

## Como funciona
- Na **tela da gravação**, o botão **"✨ Demandas de edição com IA"**. Ao concluir uma gravação, o aviso também oferece **"✨ Gerar demandas com IA"**.
- A IA lê a gravação (nome, data, observações) e cada roteiro (título, objetivo, observação de gravação, formato, tema e até 25 cenas com função, fala e direção). Para cada roteiro devolve:
  - **título** curto;
  - **resumo para quem edita**: formato e duração, ideia central, cenas principais, textos na tela, chamada final e cuidados.
- A janela de revisão mostra uma demanda por roteiro, em que dá para:
  - marcar ou desmarcar cada uma;
  - editar o título, o resumo e o **prazo** (sugestão: data da gravação + 3 dias úteis);
  - escolher **quem edita** (vem o videomaker da gravação).
- Roteiro que já tem demanda aparece como "já tem demanda #N" e não entra.
- Ao confirmar, as demandas nascem na Edição de vídeo com código, gravação e roteiro vinculados; o resumo fica nas observações.
- Só aparece para quem cria demandas de vídeo (`video.criar`) e com a IA ligada.

## Técnico
- `supabase/functions/_shared/ia/extra.ts`: nova operação `demandas` (tarefa `extra`, `ref_id` = gravação). Lê com o RLS de quem pediu, limita o contexto a 14 mil caracteres e devolve JSON validado (o `roteiro_id` precisa ser um UUID).
- `b7-ia/index.ts`: registra o uso com `entidade = gravacao`. Passou no `deno check`. A função é publicada pelo `funcoes.yml` no merge.
- Banco (`demandas_ia_1`): `video_criar_demandas_ia(p_gravacao_id, p_itens, p_videomaker_id, p_prazo)`, com a mesma regra de `video_gerar_demandas_de_gravacao` (sem duplicar por roteiro), mais título, resumo e prazo por item. Testado numa transação desfeita: cria a demanda; na segunda vez devolve `ja_existia`.
- Front: `B7.IAFerramentas.demandasDaGravacao` (`js/ia-ferramentas.js`), botão e aviso em `js/gravacao.js`, `B7.DB.demandasDaGravacaoVideo` e `criarDemandasIAVideo` (`js/database.js`), estilos em `styles/ia-chat.css`.

## Correção (demandas_ia_2)
As duas primeiras demandas criadas pela IA (Infinite Fio · Semana 3) ficaram em **novembro**, porque o mês da demanda vinha do prazo (02/11), e por isso não apareciam na Edição de vídeo, que estava em outubro. Agora o mês é o **da gravação**. As duas foram corrigidas para outubro.
