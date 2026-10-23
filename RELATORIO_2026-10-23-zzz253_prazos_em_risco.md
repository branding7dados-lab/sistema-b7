# zzz253 — Prazos que avisam antes e escalam

## Já existia
`_design_alertas_prazo` / `_video_alertas_prazo`: vence amanhã → aviso à pessoa; atrasado → aviso;
2 dias de atraso → escala para a coordenação; 5 dias → crítico.

## Novo (`migration_prazos_em_risco.sql`, já aplicada)
- `prazos_em_risco()`: design que vence hoje/amanhã e não começou (aguardando produção, ou em criação sem
  nenhuma versão enviada), vídeo pendente que vence hoje/amanhã, e post de amanhã ainda em
  Ideia/Em criação/Em revisão. Diz se "ainda não começou" ou "ninguém pegou".
- `_prazos_risco_avisar()` às 9h (dentro de `notif_verificar_agendados`): um aviso por item para o
  responsável ("Vence amanhã e ainda não começou") e UM resumo por dia para a coordenação
  ("N entregas em risco"), respeitando as preferências `prazos` / `co_escalados` / `adm_atrasos`.
  Sem repetição no mesmo dia.
- `prazos_em_risco_lista()` (só equipe de gestão) alimenta o Painel da coordenação.

## Tela
- Painel da coordenação → "Precisa da sua atenção" ganhou "Vencem hoje ou amanhã e não começaram"
  (conta no KPI "Precisam de atenção").

## Testes
- Em transação desfeita, com 1 arte, 1 vídeo e 1 post simulados: designer recebeu 1 aviso, coordenação e
  administração 1 resumo cada; segunda rodada não repetiu.
