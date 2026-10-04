# Relatório 2026-10-04-zzz46 — Publicar só depois que o dia passa

Decisão do Kevin na revisão geral (zzz45).

`verificarPostagensAutomaticas` (js/linha.js) e `sincronizarComLinhaEditorial`
(js/semana.js) promoviam a "Publicado" todo conteúdo "Programado" com
`data_postagem <= hoje`. Abrir a Linha Editorial às 8h já marcava como publicado
o conteúdo que só sai às 18h — e a mudança ia para o banco, propagando pelo
gatilho para o Status Semanal.

Agora é `< hoje`: o conteúdo de hoje só vira "Publicado" depois que o dia passa.
É também a regra que o resto do sistema já usava — `B7.DB.publicacoesPendentes`
filtra com `.lt('data_postagem', antesDe)`.

## Pendente de decisão (não mexido)
- Migração `migration_rls_corte_3.sql`: o Kevin aprovou o conteúdo (designer e
  videomaker só leem), mas a execução no banco foi cancelada na hora de aplicar.
  O banco segue com as políticas `*_equipe` do corte 2. Precisa rodar.

VERSAO zzz46 · cache v251.
