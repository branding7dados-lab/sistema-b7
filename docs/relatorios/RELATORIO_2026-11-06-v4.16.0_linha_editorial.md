# v4.16.0 — Linha editorial (análise + correções)

Análise (06/11): 33 linhas (10–12/mês, ~14 conteúdos cada); 441 conteúdos. 18–19 Reels nos próximos 14 dias sem roteiro e sem gravação; 13 conteúdos com data passada fora de Publicado (11 ainda "Ideia"); "Publicado" marcado em lote (38 num dia); nenhuma linha de dezembro.

Feito:
1. Avisos no topo da linha (`alertasHTML` em js/linha.js): Reels ≤14 dias sem `script_id` com "Criar roteiro"; conteúdos com data passada (exceto Publicado/Programado) com "Marcar como publicados" (confirmação).
2. "Criar roteiro com IA" do conteúdo oferece o Banco de roteiros (e é o padrão quando não há gravação do mês).
3. `conteudos_publicar_vencidos()` + pg_cron `b7_publicar_vencidos` (03:15 UTC = 00:15 BRT): Programado com data anterior a hoje → Publicado. A regra já existia ao abrir a linha; agora roda mesmo sem ninguém abrir.
4. Central → "Planejamento": Reels sem roteiro por cliente (14 dias) e, do dia 20 em diante, "Linhas de <mês>: X de Y clientes" (Y = clientes com linha no mês atual ou anterior).
