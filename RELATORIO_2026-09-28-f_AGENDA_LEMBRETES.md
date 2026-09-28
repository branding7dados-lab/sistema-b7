# Lembretes automáticos da agenda
**Data:** 2026-09-28 · **Pacote:** `atualizacao-2026-09-28-f.zip`
**Arquivos:** `migration_agenda_lembretes.sql`, `js/calendario.js`, `js/database.js`, `js/notificacoes.js`, `sw.js`, `styles/calendario.css`
**Migrations:** **JÁ APLICADAS** na produção (`rartcafydsaocdzshqcx`) — `agenda_lembretes`, `agenda_lembretes_por_agenda`, `agenda_lembretes_cron`.

## A regra
| Tipo de compromisso | Avisos |
|---|---|
| Gravação | 24h antes (mesma hora) **e** 1h antes |
| Apresentação (linha editorial) | 24h antes **e** 1h antes |
| Reunião, tutoria, onboarding, mentoria, briefing | 1h antes |
| Qualquer outro compromisso com hora | 1h antes |
| Compromisso de dia inteiro | só o de véspera, e só se for gravação/apresentação |

Recebe: toda a equipe interna (admin, coordenador, designer, videomaker) com conta ativa. O aviso chega como notificação no sino e, para quem ligou o push, no celular mesmo com o sistema fechado.

## Como o tipo é descoberto
O Google Agenda não tem campo de tipo, então `agenda_tipo_compromisso(titulo)` infere pelo título. A ordem das regras importa: só o **prefixo** "Grav." ganha de tudo; depois vem apresentação; depois reunião; e só então "contém gravação". É isso que faz *"Tutoria de Gravação de Conteúdos | Dr. Fabrício"* ser classificada como **reunião**, não gravação. Testado contra os 34 títulos distintos que existem hoje na conta — 100% corretos, incluindo `"amanhã gravar 3 videos"` → gravação e `"Apr. Linha Editoral IAC"` (com o erro de digitação) → apresentação.

## Duas fontes, sem duplicar
A view `agenda_compromissos` une o cache do Google (`calendario_eventos`) com as gravações marcadas dentro do sistema que ainda não foram empurradas pro Google (`gravacoes_ocorrencias` com `evento_id is null`). Isso importa porque hoje **nenhum** evento da conta está vinculado a uma gravação do sistema — depender só do vínculo não avisaria ninguém.

## O interruptor por agenda
A conta tem 4 agendas ativas, incluindo **"Família"** e **"Holidays in Brazil"**. Sem cuidado, um compromisso pessoal viraria push para a equipe toda. Por isso `calendario_agendas` ganhou a coluna `lembretes`, e a migration já desligou sozinha as agendas com cara de feriado/família/aniversário. Em *Calendário → Configurações → Agendas* cada agenda ativa agora tem a caixa **"Avisar a equipe"**. Estado atual: ligado em "Agenda de Gravação" e "branding7dados@gmail.com", desligado em "Família" e "Holidays in Brazil".

## Como dispara
`pg_cron` a cada 5 minutos chama `agenda_verificar_lembretes()`. Diferente dos alertas de prazo do vídeo (que só rodam quando alguém abre a tela), um lembrete de 1h antes precisa sair no horário mesmo com o sistema fechado. Cada notificação inserida aciona o Database Webhook → Edge Function `b7-push` → aviso no celular.

O gatilho é o instante exato (24h ou 1h antes); a janela de 1 hora em cada regra existe só para absorver atraso do cron. `eventos_dominio.chave` carrega o horário do compromisso, então: avisa uma vez só; se **remarcar**, o horário muda, a chave muda e o lembrete sai de novo (de propósito); se **cancelar** no Google, o evento sai da view e o aviso de 1h não acontece.

## Verificação
Teste em transação com rollback (nada persistiu): gravação a 23h30 gerou `agenda.gravacao_24h` — *"Grav. Teste Lembrete — amanhã às 17:23"*, com "Local: Estúdio B7", para 6 destinatários; tutoria a 40min gerou `agenda.reuniao_1h`; feriado de dia inteiro a 30min não gerou nada. Cron confirmado ativo e executando (`succeeded`, ~30ms por rodada).

Próximo disparo real: **30/09 às 14:30** (véspera de "Grav. Mais Sorriso", 01/10 14:30).
