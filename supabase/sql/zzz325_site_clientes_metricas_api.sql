-- =====================================================================
-- zzz325 (4.37.0) — site: clientes do sistema na faixa "Marcas que
-- confiam", métricas próprias do site (visitas e funil) e chaves de API
-- para a IA comercial do Gabriel ler os números.
-- =====================================================================

-- 1) clientes que aparecem no site (liga/desliga em Site → Clientes)
alter table public.clientes add column if not exists no_site boolean not null default false;
alter table public.clientes add column if not exists site_ordem int not null default 0;

create or replace function public.site_clientes()
returns table (nome text, logo_url text)
language sql stable security definer set search_path = public as $$
  select c.nome, c.logo_url from public.clientes c
  where c.no_site and c.deleted_at is null and not coalesce(c.teste, false)
  order by c.site_ordem, c.nome;
$$;
revoke all on function public.site_clientes() from public;
grant execute on function public.site_clientes() to anon, authenticated;

-- 2) eventos do site (sem dado pessoal: sessão aleatória do navegador)
create table if not exists public.site_eventos (
  id bigint generated always as identity primary key,
  sessao text not null check (char_length(sessao) between 8 and 40),
  tipo text not null check (tipo in ('visita','engajou','video','whatsapp','formulario','lead','instagram')),
  pagina text check (char_length(pagina) <= 200),
  origem jsonb not null default '{}'::jsonb,
  dispositivo text check (dispositivo in ('celular','computador','tablet')),
  created_at timestamptz not null default now()
);
create index if not exists site_eventos_data on public.site_eventos (created_at desc);
create index if not exists site_eventos_sessao on public.site_eventos (sessao, tipo);
alter table public.site_eventos enable row level security;
create policy site_eventos_admin_le on public.site_eventos for select to authenticated using (public.sou_admin());

create or replace function public.site_evento(p_sessao text, p_tipo text, p_origem jsonb default '{}'::jsonb,
  p_pagina text default null, p_dispositivo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_sessao is null or char_length(p_sessao) not between 8 and 40 then return; end if;
  if p_tipo not in ('visita','engajou','video','whatsapp','formulario','lead','instagram') then return; end if;
  -- um de cada tipo por sessão a cada 30 min (recarregar não infla o número)
  if exists (select 1 from public.site_eventos where sessao = p_sessao and tipo = p_tipo and created_at > now() - interval '30 minutes') then return; end if;
  if (select count(*) from public.site_eventos where created_at > now() - interval '1 minute') > 600 then return; end if;
  insert into public.site_eventos (sessao, tipo, pagina, origem, dispositivo)
  values (p_sessao, p_tipo, left(p_pagina, 200),
          coalesce((select jsonb_object_agg(k, left(v, 120)) from jsonb_each_text(coalesce(p_origem, '{}'::jsonb)) as e(k, v)
                    where k in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','referrer')), '{}'::jsonb),
          case when p_dispositivo in ('celular','computador','tablet') then p_dispositivo end);
end $$;
revoke all on function public.site_evento(text, text, jsonb, text, text) from public;
grant execute on function public.site_evento(text, text, jsonb, text, text) to anon, authenticated;

-- 3) números do site (painel e API)
create or replace function public._site_metricas(p_dias int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with periodo as (select now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365))) as desde),
  ev as (select * from public.site_eventos, periodo where created_at >= periodo.desde),
  ses as (select sessao, bool_or(tipo='visita') v, bool_or(tipo in ('engajou','video')) e,
                 bool_or(tipo in ('whatsapp','formulario','instagram')) c, bool_or(tipo='lead') l,
                 (array_agg(origem order by created_at))[1] o, (array_agg(dispositivo order by created_at))[1] d
          from ev group by sessao),
  fonte as (select coalesce(nullif(o->>'utm_source',''),
                     case when o ? 'fbclid' then 'meta' when o ? 'gclid' then 'google-ads'
                          when o->>'referrer' ilike '%instagram%' then 'instagram'
                          when o->>'referrer' ilike '%google%' then 'google'
                          when o->>'referrer' ilike '%facebook%' then 'facebook'
                          when o ? 'referrer' then 'outros sites' else 'direto' end) f, * from ses)
  select jsonb_build_object(
    'periodo_dias', greatest(1, least(coalesce(p_dias, 30), 365)),
    'gerado_em', now(),
    'funil', jsonb_build_object(
      'visitantes', (select count(*) from ses),
      'engajaram', (select count(*) from ses where e),
      'clicaram_contato', (select count(*) from ses where c),
      'viraram_lead', (select count(*) from ses where l)),
    'cliques', jsonb_build_object(
      'whatsapp', (select count(*) from ev where tipo='whatsapp'),
      'formulario', (select count(*) from ev where tipo='formulario'),
      'instagram', (select count(*) from ev where tipo='instagram'),
      'videos', (select count(*) from ev where tipo='video')),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'visitantes', n, 'leads', l) order by dia)
       from (select (created_at at time zone 'America/Sao_Paulo')::date dia, count(distinct sessao) n,
                    count(distinct sessao) filter (where tipo='lead') l from ev group by 1) x), '[]'::jsonb),
    'origens', coalesce((select jsonb_agg(jsonb_build_object('origem', f, 'visitantes', n, 'leads', l) order by n desc)
       from (select f, count(*) n, count(*) filter (where l) l from fonte group by f) x), '[]'::jsonb),
    'campanhas', coalesce((select jsonb_agg(jsonb_build_object('campanha', c, 'visitantes', n, 'leads', l) order by n desc)
       from (select o->>'utm_campaign' c, count(*) n, count(*) filter (where l) l from ses where coalesce(o->>'utm_campaign','') <> '' group by 1) x), '[]'::jsonb),
    'dispositivos', coalesce((select jsonb_object_agg(coalesce(d, 'desconhecido'), n)
       from (select d, count(*) n from ses group by d) x), '{}'::jsonb),
    'leads', jsonb_build_object(
      'total', (select count(*) from public.site_leads, periodo where created_at >= periodo.desde),
      'por_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.site_leads, periodo
         where created_at >= periodo.desde group by status) x), '{}'::jsonb))
  );
$$;
revoke all on function public._site_metricas(int) from public, anon, authenticated;
grant execute on function public._site_metricas(int) to service_role;

create or replace function public.site_metricas(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'Só administrador.'; end if;
  return public._site_metricas(p_dias);
end $$;
revoke all on function public.site_metricas(int) from public, anon;
grant execute on function public.site_metricas(int) to authenticated;

-- 4) chaves da API (só o resumo SHA-256 fica guardado; a chave aparece uma vez)
create table if not exists public.site_api_chaves (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 80),
  prefixo text not null,
  resumo text not null unique,
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz,
  usos int not null default 0,
  revogada_em timestamptz
);
alter table public.site_api_chaves enable row level security;
create policy site_api_chaves_admin_le on public.site_api_chaves for select to authenticated using (public.sou_admin());

create or replace function public.site_api_chave_criar(p_nome text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_chave text;
begin
  if not public.sou_admin() then raise exception 'Só administrador.'; end if;
  v_chave := 'b7site_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.site_api_chaves (nome, prefixo, resumo)
  values (left(trim(coalesce(p_nome, 'Integração')), 80), left(v_chave, 14), encode(extensions.digest(v_chave, 'sha256'), 'hex'));
  return v_chave;
end $$;
revoke all on function public.site_api_chave_criar(text) from public, anon;
grant execute on function public.site_api_chave_criar(text) to authenticated;

create or replace function public.site_api_chave_revogar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'Só administrador.'; end if;
  update public.site_api_chaves set revogada_em = now() where id = p_id and revogada_em is null;
end $$;
revoke all on function public.site_api_chave_revogar(uuid) from public, anon;
grant execute on function public.site_api_chave_revogar(uuid) to authenticated;

-- usada só pela função site-api (service_role): confere e conta o uso
create or replace function public._site_api_conferir(p_resumo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.site_api_chaves set ultimo_uso = now(), usos = usos + 1
  where resumo = p_resumo and revogada_em is null returning id into v_id;
  return v_id is not null;
end $$;
revoke all on function public._site_api_conferir(text) from public, anon, authenticated;
grant execute on function public._site_api_conferir(text) to service_role;
