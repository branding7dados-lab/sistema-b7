-- zzz330 (4.42.0) — a cada 15 min o pg_cron chama a função n7-sync
-- (mesmo cabeçalho do job oportunidades-sync, sem o segredo dele)
select cron.schedule('n7-sync', '*/15 * * * *',
  regexp_replace(
    replace((select command from cron.job where jobname='oportunidades-sync'), '/functions/v1/oportunidades-sync', '/functions/v1/n7-sync'),
    ',\s*''x-b7-cron-secret'',\s*''[^'']*''', '', 'g'));
