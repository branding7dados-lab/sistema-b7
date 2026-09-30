-- Fase 7 — sincronização semanal das fontes de Oportunidades
-- Segunda-feira 03:17 (Brasília) = 06:17 UTC. A função só busca as fontes
-- "vencidas" e tem trava de 30 min, então repetição não martela os sites.
-- Autorização: chave PÚBLICA anon do projeto (a mesma do front-end). Ela
-- não dá poder de administrador: sem JWT de admin a função não aceita
-- "forcar" nem "diagnostico".
select cron.unschedule('oportunidades-sync') where exists (select 1 from cron.job where jobname = 'oportunidades-sync');
select cron.schedule('oportunidades-sync', '17 6 * * 1', $$
  select net.http_post(
    url := 'https://rartcafydsaocdzshqcx.supabase.co/functions/v1/oportunidades-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhcnRjYWZ5ZHNhb2NkenNocWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTM5ODgsImV4cCI6MjEwNDUyOTk4OH0.kM0xlo6YjKWY1i7jqrYwwG1RkkVHMFte12K9_AHuT-I'),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$);
