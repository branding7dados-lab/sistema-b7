-- =====================================================================
-- zzz234: CINCO ABERTURAS E CINCO CARREGAMENTOS NOVOS
-- (já aplicada no banco; substitui as funções de migration_abertura_padrao.sql)
-- sistema_config chave 'abertura' passa a ser:
--   {"padrao": "streaming", "pessoas": {"<perfil_id>": "hiper"}, "carregamento": "relampago"}
-- Estilos de abertura: streaming · hiper · bigbang · classica · tinta · glitch · aurora · neon · mosaico.
-- Carregamentos: relampago · pulso · orbita · barra · brilho · pontos.
-- sistema_avisos() devolve também {"carregamento": "<estilo>"}.
-- =====================================================================

-- 1) gravar (só administrador)
create or replace function public.abertura_definir(p_valor jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  c_estilos constant text[] := array['streaming', 'hiper', 'bigbang', 'classica', 'tinta', 'glitch', 'aurora', 'neon', 'mosaico'];
  c_cargas constant text[] := array['relampago', 'pulso', 'orbita', 'barra', 'brilho', 'pontos'];
  v_pessoas jsonb := '{}'::jsonb;
  v_id text; v_est jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador escolhe a abertura do sistema.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object' or not (coalesce(p_valor ->> 'padrao', '') = any (c_estilos)) then
    raise exception 'Valor inválido.';
  end if;
  if p_valor ? 'carregamento' and not (coalesce(p_valor ->> 'carregamento', '') = any (c_cargas)) then
    raise exception 'Valor inválido.';
  end if;
  if jsonb_typeof(coalesce(p_valor -> 'pessoas', '{}'::jsonb)) is distinct from 'object' then raise exception 'Valor inválido.'; end if;
  for v_id, v_est in select * from jsonb_each(coalesce(p_valor -> 'pessoas', '{}'::jsonb)) loop
    if v_id !~ '^[0-9a-f-]{36}$' or jsonb_typeof(v_est) is distinct from 'string' or not ((v_est #>> '{}') = any (c_estilos)) then
      raise exception 'Valor inválido.';
    end if;
    if exists (select 1 from public.perfis where id = v_id::uuid) then
      v_pessoas := v_pessoas || jsonb_build_object(v_id, v_est #>> '{}');
    end if;
  end loop;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('abertura', jsonb_build_object('padrao', p_valor ->> 'padrao', 'pessoas', v_pessoas,
          'carregamento', coalesce(p_valor ->> 'carregamento', 'relampago')), now(), auth.uid())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end $function$;
revoke all on function public.abertura_definir(jsonb) from public, anon;
grant execute on function public.abertura_definir(jsonb) to authenticated;

-- 2) ler (administrador), com os padrões preenchidos
create or replace function public.abertura_config()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public.sou_admin()
    then jsonb_build_object('padrao', 'streaming', 'pessoas', '{}'::jsonb, 'carregamento', 'relampago')
         || coalesce((select valor from public.sistema_config where chave = 'abertura'), '{}'::jsonb) end;
$function$;
revoke all on function public.abertura_config() from public, anon;
grant execute on function public.abertura_config() to authenticated;

-- 3) cada pessoa recebe a abertura dela e o carregamento junto com os avisos
create or replace function public.sistema_avisos()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('agora', now(), 'sessao', public.sessao_valida(),
    'aparencia', case when public.sou_equipe_interna()
                      then coalesce((select valor from public.sistema_config where chave = 'aparencia'), '{}'::jsonb) end,
    'abertura', (select coalesce(c.valor -> 'pessoas' ->> auth.uid()::text, c.valor ->> 'padrao')
                   from public.sistema_config c where c.chave = 'abertura'),
    'carregamento', (select c.valor ->> 'carregamento' from public.sistema_config c where c.chave = 'abertura'),
    'manutencao', (
    select c.valor - 'por'
      from public.sistema_config c
     where c.chave = 'manutencao'
       and coalesce((c.valor ->> 'ativo')::boolean, false)
       and (c.valor ->> 'fim' is null or (c.valor ->> 'fim')::timestamptz > now())
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))
       and (public.sou_admin() or (c.valor ->> 'inicio')::timestamptz <= now() + interval '10 minutes')));
$function$;
