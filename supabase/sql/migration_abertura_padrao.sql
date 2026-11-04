-- =====================================================================
-- zzz231: ABERTURA PADRÃO DO SISTEMA
-- O administrador escolhe a abertura de todo mundo e, se quiser, a de uma
-- pessoa só. Fica em sistema_config chave 'abertura':
--   {"padrao": "streaming", "pessoas": {"<perfil_id>": "hiper", ...}}
-- Estilos: streaming · hiper · bigbang · classica.
-- A pessoa que escolheu um estilo em Configurações → Aparência fica com o
-- dela; quem deixou "Padrão do sistema" recebe este.
-- sistema_avisos() passa a devolver {"abertura": "<estilo desta pessoa>"}.
-- =====================================================================

-- 1) gravar (só administrador; não é configuração crítica)
create or replace function public.abertura_definir(p_valor jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  c_estilos constant text[] := array['streaming', 'hiper', 'bigbang', 'classica'];
  v_pessoas jsonb := '{}'::jsonb;
  v_id text; v_est jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador escolhe a abertura do sistema.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object' or not (coalesce(p_valor ->> 'padrao', '') = any (c_estilos)) then
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
  values ('abertura', jsonb_build_object('padrao', p_valor ->> 'padrao', 'pessoas', v_pessoas), now(), auth.uid())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end $$;
revoke all on function public.abertura_definir(jsonb) from public, anon;
grant execute on function public.abertura_definir(jsonb) to authenticated;

-- 2) ler (administrador: a configuração inteira, para a tela)
create or replace function public.abertura_config()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when public.sou_admin()
    then coalesce((select valor from public.sistema_config where chave = 'abertura'), jsonb_build_object('padrao', 'streaming', 'pessoas', '{}'::jsonb)) end;
$$;
revoke all on function public.abertura_config() from public, anon;
grant execute on function public.abertura_config() to authenticated;

-- 3) cada pessoa recebe a sua junto com os avisos do sistema
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
    'manutencao', (
    select c.valor - 'por'
      from public.sistema_config c
     where c.chave = 'manutencao'
       and coalesce((c.valor ->> 'ativo')::boolean, false)
       and (c.valor ->> 'fim' is null or (c.valor ->> 'fim')::timestamptz > now())
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))
       and (public.sou_admin() or (c.valor ->> 'inicio')::timestamptz <= now() + interval '10 minutes')));
$function$;
