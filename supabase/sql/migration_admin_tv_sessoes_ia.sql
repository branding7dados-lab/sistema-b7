-- =====================================================================
-- ADMIN: manutenção agendada, Painel de TV configurável, uso da IA e
-- sessões ativas (zzz136)
--
-- Só funções. Nenhuma tabela, coluna ou regra de acesso (RLS) criada ou
-- alterada. Tudo aqui é só para administrador (cada função confere).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Manutenção: além de "daqui a N minutos", um dia e horário marcados
--    (até 30 dias à frente). A função ganha um parâmetro no fim; quem
--    chama do jeito antigo continua funcionando.
-- ---------------------------------------------------------------------
drop function if exists public.manutencao_definir(boolean, text, integer, integer, boolean);

create or replace function public.manutencao_definir(
  p_ativo boolean, p_mensagem text default null, p_inicio_min integer default 0,
  p_duracao_min integer default null, p_portal boolean default false, p_inicio_em timestamptz default null)
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
    if p_inicio_em is not null then
      if p_inicio_em < now() - interval '1 minute' or p_inicio_em > now() + interval '30 days' then
        raise exception 'Escolha um horário entre agora e os próximos 30 dias.';
      end if;
      v_inicio := greatest(p_inicio_em, now());
    end if;
    v_valor := jsonb_build_object(
      'ativo', true,
      'mensagem', left(btrim(coalesce(p_mensagem, '')), 300),
      'inicio', v_inicio,
      'fim', case when p_duracao_min is null then null else v_inicio + make_interval(mins => p_duracao_min) end,
      'portal', coalesce(p_portal, false),
      'agendada', p_inicio_em is not null,
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
revoke all on function public.manutencao_definir(boolean, text, integer, integer, boolean, timestamptz) from public, anon;
grant execute on function public.manutencao_definir(boolean, text, integer, integer, boolean, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Painel de TV: o que aparece e se alterna com a agenda da semana.
--    Fica em sistema_config (chave "tv"); a equipe já lê essa tabela.
-- ---------------------------------------------------------------------
create or replace function public.tv_config_definir(p_valor jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb := '{}'::jsonb;
  k text;
  c_chaves constant text[] := array['clientes', 'nomes', 'etapas', 'gravacoes', 'publicacoes', 'hoje', 'agenda'];
begin
  if not public.sou_admin() then
    raise exception 'Só administrador configura o Painel de TV.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object' then raise exception 'Valor inválido.'; end if;
  foreach k in array c_chaves loop
    if p_valor ? k then
      if jsonb_typeof(p_valor -> k) is distinct from 'boolean' then raise exception 'Valor inválido.'; end if;
      v := v || jsonb_build_object(k, p_valor -> k);
    end if;
  end loop;
  if p_valor ? 'intervalo' then
    if jsonb_typeof(p_valor -> 'intervalo') is distinct from 'number'
       or (p_valor ->> 'intervalo')::numeric not between 15 and 600 then
      raise exception 'Valor inválido.';
    end if;
    v := v || jsonb_build_object('intervalo', round((p_valor ->> 'intervalo')::numeric));
  end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('tv', v, now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
  return v;
end
$$;
revoke all on function public.tv_config_definir(jsonb) from public, anon;
grant execute on function public.tv_config_definir(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Uso da IA: números do registro de uso (ia_uso), que já guarda só
--    metadados — nunca o texto de pedido ou de resposta.
-- ---------------------------------------------------------------------
create or replace function public.ia_uso_resumo(p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 7), 1), 90);
  v_desde timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo') - make_interval(days => v_dias - 1)) at time zone 'America/Sao_Paulo';
  v_hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if not public.sou_admin() then
    raise exception 'Só administrador vê o uso da IA.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'dias', v_dias,
    'total', (select count(*) from public.ia_uso where created_at >= v_desde),
    'erros', (select count(*) from public.ia_uso where created_at >= v_desde and status = 'erro'),
    'tempo_medio_ms', (select coalesce(round(avg(duracao_ms)), 0) from public.ia_uso where created_at >= v_desde and status = 'ok' and duracao_ms is not null),
    'tokens_entrada', (select coalesce(sum(tokens_entrada), 0) from public.ia_uso where created_at >= v_desde),
    'tokens_saida', (select coalesce(sum(tokens_saida), 0) from public.ia_uso where created_at >= v_desde),
    'reserva', (select count(*) from public.ia_uso where created_at >= v_desde and houve_fallback),
    'hoje', jsonb_build_object(
      'total', (select count(*) from public.ia_uso where created_at >= v_hoje),
      'erros', (select count(*) from public.ia_uso where created_at >= v_hoje and status = 'erro')),
    'por_dia', (select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) from (
        select d::date as dia,
               (select count(*) from public.ia_uso u where (u.created_at at time zone 'America/Sao_Paulo')::date = d::date) as total,
               (select count(*) from public.ia_uso u where (u.created_at at time zone 'America/Sao_Paulo')::date = d::date and u.status = 'erro') as erros
          from generate_series((v_desde at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d) x),
    'por_pessoa', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(p.nome, 'Conta removida') as nome, count(*) as total,
               count(*) filter (where u.status = 'erro') as erros, max(u.created_at) as ultima
          from public.ia_uso u left join public.perfis p on p.id = u.perfil_id
         where u.created_at >= v_desde group by p.nome) x),
    'por_recurso', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select u.recurso, count(*) as total, count(*) filter (where u.status = 'erro') as erros,
               coalesce(round(avg(u.duracao_ms) filter (where u.status = 'ok')), 0) as tempo_medio_ms
          from public.ia_uso u where u.created_at >= v_desde group by u.recurso) x),
    'erros_tipo', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(nullif(u.erro_categoria, ''), 'sem categoria') as categoria, count(*) as total
          from public.ia_uso u where u.created_at >= v_desde and u.status = 'erro' group by 1) x));
end
$$;
revoke all on function public.ia_uso_resumo(integer) from public, anon;
grant execute on function public.ia_uso_resumo(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4) Sessões ativas: em quais aparelhos cada conta está aberta, e
--    encerrar uma. Lê e apaga em auth.sessions (o controle de sessões do
--    próprio Supabase); não toca em auth.users nem em senha. O endereço
--    de rede (IP) NÃO é devolvido.
-- ---------------------------------------------------------------------
create or replace function public.sessoes_listar()
returns table (sessao uuid, perfil_id uuid, nome text, papel text, criada_em timestamptz,
               ativa_em timestamptz, aparelho text, atual boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sou_admin() then
    raise exception 'Só administrador vê as sessões.' using errcode = '42501';
  end if;
  return query
    select s.id, s.user_id, coalesce(p.nome, p.username, 'Conta sem perfil')::text, coalesce(p.papel, '')::text, s.created_at,
           coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at), left(coalesce(s.user_agent, ''), 300),
           s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
      from auth.sessions s left join public.perfis p on p.id = s.user_id
     where s.not_after is null or s.not_after > now()
     order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc;
end
$$;
revoke all on function public.sessoes_listar() from public, anon;
grant execute on function public.sessoes_listar() to authenticated;

create or replace function public.sessao_encerrar(p_sessao uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador encerra sessões.' using errcode = '42501';
  end if;
  if p_sessao::text = coalesce(auth.jwt() ->> 'session_id', '') then
    raise exception 'Esta é a sua sessão de agora. Para sair, use “Sair da conta”.';
  end if;
  delete from auth.sessions where id = p_sessao;
  get diagnostics n = row_count;
  return n > 0;
end
$$;
revoke all on function public.sessao_encerrar(uuid) from public, anon;
grant execute on function public.sessao_encerrar(uuid) to authenticated;

-- todas as sessões de uma pessoa (menos a de quem está chamando)
create or replace function public.sessoes_encerrar_pessoa(p_perfil uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador encerra sessões.' using errcode = '42501';
  end if;
  delete from auth.sessions
   where user_id = p_perfil and id::text <> coalesce(auth.jwt() ->> 'session_id', '');
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.sessoes_encerrar_pessoa(uuid) from public, anon;
grant execute on function public.sessoes_encerrar_pessoa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) A consulta que cada tela faz: manutenção agendada para mais tarde
--    só chega ao administrador; a equipe recebe a partir de 10 minutos
--    antes de começar (assim uma tela ainda na versão anterior não mostra
--    uma contagem de dias).
-- ---------------------------------------------------------------------
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
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))
       and (public.sou_admin() or (c.valor ->> 'inicio')::timestamptz <= now() + interval '10 minutes')));
$$;
revoke all on function public.sistema_avisos() from public, anon;
grant execute on function public.sistema_avisos() to authenticated;

-- ---------------------------------------------------------------------
-- 6) (zzz137) Painel de TV: a configuração aceita também o MODO
--    ("painel" ou "animacao" — só a animação da B7) e a vinheta.
--    A função tv_config_definir acima foi atualizada no banco com as
--    chaves 'vinheta' (booleano) e 'modo' (painel | animacao).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 7) (zzz138) Painel de TV: a configuração passou a aceitar também
--    visual (cinema | aurora | claro | minimal), fundo (fixo | dia |
--    atraso), zoom (70 a 150), recado e recado_modo (destaque | faixa),
--    saudacao, mural, clima e cidade {nome, lat, lon}, modo "logo",
--    logo_frase, logo_relogio e logo_img (só endereço do espaço público
--    de logos do próprio sistema). tv_config_definir foi atualizada no
--    banco com essas validações.
-- ---------------------------------------------------------------------
