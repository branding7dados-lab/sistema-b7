-- zzz252: horário de silêncio e resumo dos avisos.
-- perfis.preferencias.silencio = { ativo, de 'HH:MM', ate 'HH:MM', fds }  (da pessoa)
-- sistema_config 'expediente_equipe' = o mesmo formato (padrão da equipe para
-- quem não escolheu o seu; cliente não herda).
-- Dentro do silêncio a notificação nasce normalmente (fica no sino), mas sem
-- push nem som (dados.silenciosa) e marcada como adiada. Quando o silêncio
-- acaba, chega UM aviso com o resumo do que ficou guardado.
-- dados.urgente = true fura o silêncio.

create or replace function public._silencio_valido(s jsonb) returns boolean
language sql immutable as $$
  select s is not null and jsonb_typeof(s) = 'object'
     and jsonb_typeof(s->'ativo') = 'boolean'
     and coalesce(s->>'de', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and coalesce(s->>'ate', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     and (s->'fds' is null or jsonb_typeof(s->'fds') = 'boolean')
$$;

create or replace function public.silencio_de(p_id uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case
    when p.preferencias ? 'silencio' then p.preferencias->'silencio'
    when p.papel = 'cliente' then null
    else (select valor from public.sistema_config where chave = 'expediente_equipe')
  end from public.perfis p where p.id = p_id
$$;

create or replace function public.em_silencio(p_id uuid, p_em timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
declare s jsonb := public.silencio_de(p_id); l timestamp := p_em at time zone 'America/Sao_Paulo'; h time; de time; ate time;
begin
  if not public._silencio_valido(s) or not (s->>'ativo')::boolean then return false; end if;
  if coalesce((s->>'fds')::boolean, false) and extract(isodow from l) in (6, 7) then return true; end if;
  h := l::time; de := (s->>'de')::time; ate := (s->>'ate')::time;
  if de = ate then return false; end if;
  return case when de < ate then h >= de and h < ate else h >= de or h < ate end;
end $$;
revoke all on function public.silencio_de(uuid), public.em_silencio(uuid, timestamptz) from public, anon, authenticated;

create or replace function public._notif_silencio() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.tipo = 'resumo.silencio' or coalesce(new.dados->>'urgente', '') = 'true' then return new; end if;
  if public.em_silencio(new.destinatario_id) then
    new.dados := coalesce(new.dados, '{}'::jsonb) || '{"silenciosa": true, "adiada": true}'::jsonb;
  end if;
  return new;
end $$;
create or replace trigger notif_silencio before insert on public.notificacoes for each row execute function public._notif_silencio();

-- Quando o silêncio da pessoa acaba: um aviso só com o que ficou guardado e
-- ainda não foi lido. O que ela já leu no sino não entra.
create or replace function public._resumo_silencio() returns integer
language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; tot int; tit text; ev uuid;
begin
  for r in select distinct destinatario_id as id from public.notificacoes
            where (dados->>'adiada') = 'true' and dados->>'resumida' is null and created_at > now() - interval '4 days' loop
    if public.em_silencio(r.id) then continue; end if;
    select count(*), string_agg(titulo, ' · ' order by created_at desc) filter (where rn <= 3)
      into tot, tit
      from (select titulo, created_at, row_number() over (order by created_at desc) rn from public.notificacoes
             where destinatario_id = r.id and (dados->>'adiada') = 'true' and dados->>'resumida' is null
               and lida_em is null and created_at > now() - interval '4 days') x;
    update public.notificacoes set dados = dados || '{"resumida": true}'::jsonb
     where destinatario_id = r.id and (dados->>'adiada') = 'true' and dados->>'resumida' is null;
    if tot > 0 then
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, payload, processado_em)
      values ('resumo.silencio', 'resumo.silencio:' || r.id || ':' || clock_timestamp()::text, 'perfil', r.id, '{}'::jsonb, now())
      returning id into ev;
      insert into public.notificacoes(evento_id, destinatario_id, tipo, titulo, mensagem, link, dados)
      values (ev, r.id, 'resumo.silencio',
              case when tot = 1 then '1 aviso enquanto você estava em silêncio' else tot || ' avisos enquanto você estava em silêncio' end,
              left(tit || case when tot > 3 then ' e mais ' || (tot - 3) else '' end, 300), '#/', jsonb_build_object('total', tot));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public._resumo_silencio() from public, anon, authenticated;
select cron.schedule('resumo-silencio', '*/15 * * * *', 'select public._resumo_silencio()');

-- A pessoa grava o próprio silêncio (ou {"silencio": null} para voltar ao da equipe)
create or replace function public.silencio_gravar(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare atual jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão necessária.'; end if;
  if p is not null and jsonb_typeof(p) <> 'null' and not public._silencio_valido(p) then raise exception 'Horário inválido.'; end if;
  update public.perfis set preferencias = case when p is null or jsonb_typeof(p) = 'null'
      then coalesce(preferencias, '{}'::jsonb) - 'silencio'
      else coalesce(preferencias, '{}'::jsonb) || jsonb_build_object('silencio', jsonb_build_object('ativo', p->'ativo', 'de', p->'de', 'ate', p->'ate', 'fds', coalesce(p->'fds', 'false'::jsonb))) end
   where id = auth.uid() returning preferencias into atual;
  return atual;
end $$;

-- Administração: o expediente padrão da equipe
create or replace function public.expediente_equipe_gravar(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.sou_admin() then raise exception 'Só administrador muda o expediente da equipe.' using errcode = '42501'; end if;
  if not public._silencio_valido(p) then raise exception 'Horário inválido.'; end if;
  insert into public.sistema_config(chave, valor, atualizado_em, atualizado_por)
  values ('expediente_equipe', jsonb_build_object('ativo', p->'ativo', 'de', p->'de', 'ate', p->'ate', 'fds', coalesce(p->'fds', 'false'::jsonb)), now(), auth.uid())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
  return (select valor from public.sistema_config where chave = 'expediente_equipe');
end $$;

create or replace function public.expediente_equipe() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when public.sou_equipe_interna() then (select valor from public.sistema_config where chave = 'expediente_equipe') end
$$;
grant execute on function public.silencio_gravar(jsonb), public.expediente_equipe_gravar(jsonb), public.expediente_equipe() to authenticated;
