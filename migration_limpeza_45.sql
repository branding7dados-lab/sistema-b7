-- =====================================================================
-- LIMPEZA 4.5 (revisão geral do sistema)
-- 1) Índice para cada chave estrangeira sem índice (71, apontadas pelo
--    verificador do Supabase): apagar/atualizar perfis e clientes deixa
--    de varrer tabelas inteiras.
-- 2) Políticas do "Ao vivo" (realtime.messages): auth.uid() passa a ser
--    calculado uma vez por consulta, não uma vez por linha.
-- 3) gravacao_videomakers: search_path fixo (aviso de segurança).
-- 4) Funções de gatilho não podem ser chamadas por visitante sem login.
-- Nada é apagado.
-- =====================================================================
do $$
declare r record; nome text;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname, c.conrelid, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colunas
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey)
  loop
    nome := left(r.conname, 55) || '_idx';
    execute format('create index if not exists %I on %s (%s)', nome, r.tabela, r.colunas);
  end loop;
end $$;

alter policy "b7 aovivo: ler" on realtime.messages using (
  ((realtime.topic() = 'b7-aovivo'::text) and (select public.sou_equipe_interna()))
  or ((realtime.topic() = ('b7-aovivo:'::text || ((select auth.uid()))::text)) and (select public.sou_equipe_interna()))
  or ((realtime.topic() ~~ 'b7-aovivo:%'::text) and (select public.sou_superadmin())));
alter policy "b7 aovivo: enviar" on realtime.messages with check (
  ((realtime.topic() = 'b7-aovivo'::text) and (select public.sou_equipe_interna()))
  or ((realtime.topic() = ('b7-aovivo:'::text || ((select auth.uid()))::text)) and (select public.sou_equipe_interna()))
  or ((realtime.topic() ~~ 'b7-aovivo:%'::text) and (select public.sou_superadmin())));

alter function public.gravacao_videomakers(public.gravacoes) set search_path = public, pg_temp;

revoke execute on function public._grav_extra_avisar() from anon, public;
revoke execute on function public._projeto_sync_demanda() from anon, public;
revoke execute on function public._projeto_sync_gravacao() from anon, public;
