# zzz275 — Apagar várias demandas de uma vez

**Versão:** `2026-10-28-zzz275` · cache `roteiros-b7-v477`

## O que mudou
- **Edição de vídeo:** a barra de seleção (Ctrl/Shift + clique ou "Selecionar todas") ganhou **Apagar**; o menu do botão direito também.
- **Design:** a faixa das peças marcadas (Ctrl/Shift + clique) ganhou **Apagar**.
- **Produção (quadro):** agora dá para marcar várias demandas (Ctrl/Shift + clique; com alguma marcada, o clique simples alterna; Esc limpa). A faixa de baixo tem **Apagar** e **Limpar**.
- Apagar **manda para a Lixeira** (`deleted_at`); nada sai do banco. O aviso tem **Desfazer**, e a **Lixeira** passou a listar as demandas apagadas nos últimos 90 dias, com **Restaurar**. Não há "excluir em definitivo" para demandas.

## Permissão
- `video.excluir` (já existia: coordenador e videomaker, nível Total).
- Novas: `design.excluir` e `kanban.excluir` (padrão: coordenador, nível Total). O administrador sempre pode.
- O botão só aparece para quem pode. O banco confere de novo.

## Banco (migration apagar_em_lote_1)
- `demandas_para_lixeira(p_tipo, p_ids)`, `demandas_restaurar(p_tipo, p_ids)` e `demandas_lixeira()`, com `p_tipo` = `video`, `design` ou `kanban`.
- Testado numa transação desfeita no fim: apagar um item de cada tipo, conferir que aparece na Lixeira e restaurar.

## Arquivos
`js/lote.js` (novo), `js/video.js`, `js/design.js`, `js/kanban.js`, `js/arrastar.js`, `js/dashboard.js` (Lixeira), `styles/global.css`, `styles/video.css`, `index.html`, `sw.js`, `js/novidades.js`, `js/auth.js`, `migration_apagar_em_lote.sql`.
