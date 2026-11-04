-- Fase 7 — sincronização semanal das fontes de Oportunidades
-- Segunda-feira 03:17 (Brasília) = 06:17 UTC. A função só busca as fontes
-- "vencidas" e tem trava de 30 min, então repetição não martela os sites.
--
-- AUTORIZAÇÃO (zzz51). Antes bastava a chave PÚBLICA anon — a mesma que
-- está em js/config.js, à vista de qualquer um que abra o site. Quem
-- soubesse o endereço disparava a sincronização de todas as fontes à
-- vontade. Agora a rodada automática precisa do cabeçalho
-- x-b7-cron-secret, conferido contra o segredo B7_CRON_SECRET da função.
--
-- COMO RODAR (duas coisas, nesta ordem):
--   1) Guardar o segredo na função (Supabase → Edge Functions → Secrets,
--      ou pela CLI):
--        supabase secrets set B7_CRON_SECRET=<segredo longo e aleatório>
--   2) Trocar <SEGREDO_DO_CRON> abaixo pelo MESMO valor e rodar este
--      arquivo no SQL Editor.
--
-- O segredo NÃO entra neste arquivo: o repositório é público. Ele vive
-- nos secrets da função e aqui dentro do banco (cron.job), que ninguém
-- de fora lê.
select cron.unschedule('oportunidades-sync') where exists (select 1 from cron.job where jobname = 'oportunidades-sync');
select cron.schedule('oportunidades-sync', '17 6 * * 1', $$
  select net.http_post(
    url := 'https://rartcafydsaocdzshqcx.supabase.co/functions/v1/oportunidades-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcnRjYWZ5ZHNhb2NkenNocWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTM5ODgsImV4cCI6MjEwNDUyOTk4OH0.kM0xlo6YjKWY1i7jqrYwwG1RkkVHMFte12K9_AHuT-I',
      'x-b7-cron-secret', '<SEGREDO_DO_CRON>'),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$);
