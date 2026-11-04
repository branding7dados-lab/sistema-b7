# zzz252 — Horário de silêncio e resumo dos avisos

## Banco (`migration_horario_silencio.sql`, já aplicada)
- `perfis.preferencias.silencio` (da pessoa) e `sistema_config.expediente_equipe` (padrão da equipe;
  cliente não herda). `em_silencio(pessoa, momento)` em horário de Brasília, com janela que pode virar
  a meia-noite e opção de fim de semana inteiro.
- Trigger `notif_silencio` (antes de inserir em `notificacoes`): dentro do silêncio marca
  `dados.silenciosa` + `dados.adiada` — fica no sino, sem push (a b7-push já respeita `silenciosa`) e sem som.
  `dados.urgente = true` fura o silêncio.
- Cron `resumo-silencio` (a cada 15 min): quando o silêncio da pessoa acaba, um aviso
  "N avisos enquanto você estava em silêncio" com os 3 últimos títulos; só conta o que ainda não foi lido.
- RPCs: `silencio_gravar` (a pessoa; null volta a seguir a equipe), `expediente_equipe_gravar` (só admin),
  `expediente_equipe`.
- Testado em transação desfeita: 2 avisos guardados, urgente passou, resumo único ao acabar, nenhum resumo
  repetido; janela 20h–8h e sábado conferidos.

## Tela
- `js/silencio.js`: Notificações ganhou "Horário de silêncio" (Seguir a equipe / Meu horário / Sempre avisar);
  Configurações → Equipe (admin) ganhou "Expediente da equipe".

Nenhum expediente da equipe vem ligado: a administração liga quando quiser.
