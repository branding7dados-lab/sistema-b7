-- 4.32.0 — funções internas (nome começando com "_") não podem mais ser
-- chamadas diretamente pelo app (/rest/v1/rpc/_...). Elas só servem a outras
-- funções do banco (SECURITY DEFINER, rodam como dono), a gatilhos (o
-- gatilho não confere EXECUTE) e às funções do servidor (service_role).
-- Antes, qualquer pessoa logada podia, por exemplo, chamar _acesso_notificar
-- e mandar aviso falso para qualquer usuário.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
  end loop;
end $$;
