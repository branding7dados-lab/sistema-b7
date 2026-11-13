-- =====================================================================
-- zzz335 (4.46.0) — site: agendamento de reunião, alerta de contato
-- parado e conteúdo da página Sobre (equipe e bastidores).
-- Só acrescenta; nada é apagado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CONTEÚDO DA PÁGINA SOBRE: tipos novos em site_itens
--    equipe:   titulo = nome, texto = cargo, capa_url = foto
--    bastidor: titulo = legenda, capa_url = foto
-- ---------------------------------------------------------------------
alter table public.site_itens drop constraint if exists site_itens_tipo_check;
alter table public.site_itens add constraint site_itens_tipo_check
  check (tipo in ('video','depoimento','servico','cliente','equipe','bastidor'));

-- ---------------------------------------------------------------------
-- 2) ALERTA DE CONTATO PARADO: contato "novo" há mais de 1 hora sem
--    ninguém mexer → aviso no sino (uma vez por contato) para quem
--    administra e para quem tem o módulo Site.
-- ---------------------------------------------------------------------
alter table public.site_leads add column if not exists alertado_em timestamptz;

create or replace function public._site_leads_parados()
returns int language plpgsql security definer set search_path = public as $$
declare l record; d record; n int := 0; msg text;
begin
  for l in select * from public.site_leads
            where status = 'novo' and alertado_em is null
              and created_at < now() - interval '1 hour'
              and created_at > now() - interval '7 days'
            order by created_at
            limit 30
  loop
    msg := left(l.nome, 60) || ' está esperando resposta há ' ||
           case when now() - l.created_at < interval '2 hours' then 'mais de 1 hora'
                else extract(hour from now() - l.created_at)::int || ' horas' end ||
           coalesce(' · ' || nullif(l.interesse, ''), '');
    for d in select distinct p.id from public.perfis p
              where p.estado = 'ativa' and (p.eh_admin
                 or exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p.id and pm.modulo = 'site' and pm.efeito = 'permitir'))
    loop
      perform public._acesso_notificar(d.id, 'site.lead_parado', 'Contato do site sem resposta', msg,
        '#/site?aba=contatos', l.id, jsonb_build_object('lead_id', l.id));
    end loop;
    update public.site_leads set alertado_em = now() where id = l.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public._site_leads_parados() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'site-leads-parados') then
    perform cron.unschedule('site-leads-parados');
  end if;
  perform cron.schedule('site-leads-parados', '*/15 * * * *', 'select public._site_leads_parados()');
end $$;

-- ---------------------------------------------------------------------
-- 3) AGENDAMENTO DE REUNIÃO PELO SITE
--    Disponibilidade em site_config.dados.agenda:
--      { ativo, dias:[1..5] (1=seg … 7=dom), inicio:"09:00", fim:"18:00",
--        duracao:30, antecedencia_h:2, ate_dias:14 }
--    Os horários livres descontam as reuniões já marcadas e os eventos
--    da agenda do Google conectada ao sistema (calendario_eventos) — o
--    site só recebe os horários, nunca o que há na agenda.
-- ---------------------------------------------------------------------
create table if not exists public.site_agendamentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.site_leads(id) on delete set null,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'marcado' check (status in ('marcado','feito','cancelado')),
  created_at timestamptz not null default now(),
  atualizado_em timestamptz
);
create unique index if not exists site_agendamentos_horario on public.site_agendamentos (inicio) where status = 'marcado';
alter table public.site_agendamentos enable row level security;
drop policy if exists site_agendamentos_le on public.site_agendamentos;
create policy site_agendamentos_le on public.site_agendamentos for select to authenticated using (public.pode_nivel('site', 1));
drop policy if exists site_agendamentos_upd on public.site_agendamentos;
create policy site_agendamentos_upd on public.site_agendamentos for update to authenticated
  using (public.pode_nivel('site', 2)) with check (public.pode_nivel('site', 2));

create or replace function public._site_agenda_cfg()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select dados->'agenda' from public.site_config where id = 1), '{}'::jsonb);
$$;

create or replace function public.site_horarios(p_dias int default 14)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c jsonb := public._site_agenda_cfg();
  dur int := greatest(15, least(coalesce((c->>'duracao')::int, 30), 180));
  ant int := greatest(0, coalesce((c->>'antecedencia_h')::int, 2));
  ate int := greatest(1, least(coalesce((c->>'ate_dias')::int, 14), coalesce(p_dias, 14), 45));
  hi time := coalesce((c->>'inicio')::time, '09:00');
  hf time := coalesce((c->>'fim')::time, '18:00');
  dias int[] := coalesce((select array_agg(x::int) from jsonb_array_elements_text(c->'dias') x), array[1,2,3,4,5]);
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb := '[]'::jsonb; d date; t time; v_ini timestamptz; v_fim timestamptz;
begin
  if coalesce((c->>'ativo')::boolean, false) is not true then return jsonb_build_object('ativo', false, 'duracao', dur, 'horarios', '[]'::jsonb); end if;
  for k in 0..ate loop
    d := hoje + k;
    continue when not (extract(isodow from d)::int = any(dias));
    t := hi;
    while t + make_interval(mins => dur) <= hf loop
      v_ini := (d + t) at time zone 'America/Sao_Paulo';
      v_fim := v_ini + make_interval(mins => dur);
      if v_ini > now() + make_interval(hours => ant)
         and not exists (select 1 from public.site_agendamentos a where a.status = 'marcado' and a.inicio < v_fim and a.fim > v_ini)
         and not exists (select 1 from public.calendario_eventos e
                          where coalesce(e.status_provider, '') <> 'cancelled'
                            and ((e.dia_inteiro and (e.inicio at time zone 'America/Sao_Paulo')::date = d)
                              or (not e.dia_inteiro and e.inicio < v_fim and coalesce(e.fim, e.inicio + interval '1 hour') > v_ini))) then
        r := r || to_jsonb(v_ini);
      end if;
      t := t + make_interval(mins => dur);
    end loop;
  end loop;
  return jsonb_build_object('ativo', true, 'duracao', dur, 'horarios', r);
end $$;
revoke all on function public.site_horarios(int) from public;
grant execute on function public.site_horarios(int) to anon, authenticated;

create or replace function public.site_agendar(p_nome text, p_whatsapp text, p_inicio timestamptz,
  p_empresa text default null, p_cidade text default null, p_interesse text default null,
  p_mensagem text default null, p_origem jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h jsonb := public.site_horarios(45);
  livres jsonb := h -> 'horarios';
  dur int := coalesce((h ->> 'duracao')::int, 30);
  v_tel text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_lead uuid; quando text; a record;
begin
  if char_length(trim(coalesce(p_nome, ''))) < 2 or char_length(v_tel) < 10 then raise exception 'Preencha o nome e um WhatsApp com DDD.'; end if;
  if livres is null or not (livres @> jsonb_build_array(to_jsonb(p_inicio))) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end if;
  if (select count(*) from public.site_agendamentos where created_at > now() - interval '1 minute') > 10 then
    raise exception 'Muitos pedidos agora. Tente em um minuto.';
  end if;
  quando := to_char(p_inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  insert into public.site_leads (nome, whatsapp, empresa, cidade, interesse, mensagem, origem, notas)
  values (left(trim(p_nome), 120), left(trim(p_whatsapp), 30), left(nullif(trim(p_empresa), ''), 120), left(nullif(trim(p_cidade), ''), 120),
          left(nullif(trim(p_interesse), ''), 120), left(nullif(trim(p_mensagem), ''), 1000), coalesce(p_origem, '{}'::jsonb) - 'ip',
          'Reunião marcada pelo site: ' || quando)
  returning id into v_lead;
  begin
    insert into public.site_agendamentos (lead_id, inicio, fim) values (v_lead, p_inicio, p_inicio + make_interval(mins => dur));
  exception when unique_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end;
  for a in select id from public.perfis where eh_admin and estado = 'ativa' loop
    perform public._acesso_notificar(a.id, 'site.reuniao', 'Reunião marcada pelo site',
      left(trim(p_nome), 60) || ' · ' || quando || coalesce(' · ' || nullif(trim(p_interesse), ''), ''),
      '#/site?aba=contatos', v_lead, jsonb_build_object('lead_id', v_lead));
  end loop;
  return jsonb_build_object('ok', true, 'quando', quando);
end $$;
revoke all on function public.site_agendar(text, text, timestamptz, text, text, text, text, jsonb) from public;
grant execute on function public.site_agendar(text, text, timestamptz, text, text, text, text, jsonb) to anon, authenticated;
