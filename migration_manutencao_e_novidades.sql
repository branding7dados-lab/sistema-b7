-- =====================================================================
-- MODO MANUTENÇÃO E NOVIDADES (zzz130)
--
-- Duas chaves novas em sistema_config, cada uma com a sua função de
-- gravar (só administrador):
--   "manutencao" — o aviso de que o sistema está (ou vai entrar) em
--                  manutenção: mensagem, quando começa, quando termina e
--                  se vale também para o Portal do cliente.
--   "novidades"  — a lista do que mudou, escrita pelo administrador, que
--                  a equipe lê dentro do B7.
--
-- O modo manutenção é um aviso que TRAVA A TELA de quem não é
-- administrador. Não muda nenhuma regra de acesso do banco.
--
-- Aditivo. Nenhuma política (RLS), tabela ou coluna criada ou alterada.
-- =====================================================================

create or replace function public.manutencao_definir(
  p_ativo boolean, p_mensagem text default null, p_inicio_min integer default 0,
  p_duracao_min integer default null, p_portal boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := now() + make_interval(mins => greatest(0, least(coalesce(p_inicio_min, 0), 60)));
  v_valor jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador liga ou desliga o modo manutenção.' using errcode = '42501';
  end if;
  if coalesce(p_ativo, false) then
    if p_duracao_min is not null and (p_duracao_min < 1 or p_duracao_min > 1440) then
      raise exception 'Duração inválida.';
    end if;
    v_valor := jsonb_build_object(
      'ativo', true,
      'mensagem', left(btrim(coalesce(p_mensagem, '')), 300),
      'inicio', v_inicio,
      'fim', case when p_duracao_min is null then null else v_inicio + make_interval(mins => p_duracao_min) end,
      'portal', coalesce(p_portal, false),
      'por', auth.uid());
  else
    v_valor := jsonb_build_object('ativo', false, 'por', auth.uid());
  end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('manutencao', v_valor, now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
  return v_valor;
end
$$;

revoke all on function public.manutencao_definir(boolean, text, integer, integer, boolean) from public, anon;
grant execute on function public.manutencao_definir(boolean, text, integer, integer, boolean) to authenticated;

-- O que cada tela aberta confere de tempos em tempos: a hora do servidor
-- e a manutenção em vigor. Manutenção já encerrada volta como nula. O
-- cliente do Portal só recebe a que foi marcada para valer no Portal.
create or replace function public.sistema_avisos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('agora', now(), 'manutencao', (
    select c.valor - 'por'
      from public.sistema_config c
     where c.chave = 'manutencao'
       and coalesce((c.valor ->> 'ativo')::boolean, false)
       and (c.valor ->> 'fim' is null or (c.valor ->> 'fim')::timestamptz > now())
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))));
$$;

revoke all on function public.sistema_avisos() from public, anon;
grant execute on function public.sistema_avisos() to authenticated;

-- Novidades: uma lista de até 30 registros, cada um com título e até 12
-- itens de texto. Quem e quando publicou é escrito aqui, não pela tela.
create or replace function public.novidades_definir(p_lista jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_limpa jsonb := '[]'::jsonb;
  v_itens jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador publica novidades.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lista) is distinct from 'array' or jsonb_array_length(p_lista) > 30 then
    raise exception 'Valor inválido.';
  end if;
  for v_item in select * from jsonb_array_elements(p_lista) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(v_item ->> 'id', '') !~ '^[a-z0-9-]{6,40}$'
       or btrim(coalesce(v_item ->> 'titulo', '')) = '' or char_length(v_item ->> 'titulo') > 120
       or char_length(coalesce(v_item ->> 'versao', '')) > 40
       or jsonb_typeof(coalesce(v_item -> 'itens', '[]'::jsonb)) is distinct from 'array'
       or jsonb_array_length(coalesce(v_item -> 'itens', '[]'::jsonb)) > 12 then
      raise exception 'Valor inválido.';
    end if;
    select coalesce(jsonb_agg(left(btrim(t), 240)), '[]'::jsonb) into v_itens
      from jsonb_array_elements_text(coalesce(v_item -> 'itens', '[]'::jsonb)) t where btrim(t) <> '';
    v_limpa := v_limpa || jsonb_build_array(jsonb_build_object(
      'id', v_item ->> 'id',
      'titulo', btrim(v_item ->> 'titulo'),
      'versao', coalesce(v_item ->> 'versao', ''),
      'itens', v_itens,
      -- registro que já existia mantém a data; registro novo ganha a de agora
      'em', coalesce((select a ->> 'em' from public.sistema_config c, jsonb_array_elements(c.valor) a
                       where c.chave = 'novidades' and a ->> 'id' = v_item ->> 'id' limit 1), to_jsonb(now()) #>> '{}')));
  end loop;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('novidades', v_limpa, now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
  return v_limpa;
end
$$;

revoke all on function public.novidades_definir(jsonb) from public, anon;
grant execute on function public.novidades_definir(jsonb) to authenticated;
