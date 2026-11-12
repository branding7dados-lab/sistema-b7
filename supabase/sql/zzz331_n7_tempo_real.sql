-- =====================================================================
-- zzz331 (4.42.1) — N7 mais rápido
--   métricas: a cada 1 minuto (antes 15)
--   contatos do formulário: na hora (gatilho ao inserir/atualizar)
-- O gatilho reaproveita o comando do job "n7-sync" (net.http_post, que é
-- assíncrono: não atrasa quem mandou o formulário). Assim nenhuma chave
-- fica escrita aqui.
-- =====================================================================
select cron.alter_job((select jobid from cron.job where jobname = 'n7-sync'), schedule := '* * * * *');

create or replace function public._n7_avisar()
returns trigger language plpgsql security definer set search_path = public, cron as $$
declare c text;
begin
  select command into c from cron.job where jobname = 'n7-sync';
  if c is not null then
    begin execute c; exception when others then null; end;   -- nunca impede o formulário
  end if;
  return null;
end $$;
revoke all on function public._n7_avisar() from public, anon, authenticated;

create or replace trigger site_leads_n7 after insert or update on public.site_leads
  for each row execute function public._n7_avisar();
