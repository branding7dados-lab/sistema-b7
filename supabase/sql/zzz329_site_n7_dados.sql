-- =====================================================================
-- zzz329 (4.42.0) — dados do site para o sistema N7 (Núcleo7).
-- A função n7-sync (Edge Function) chama _site_n7_dados e grava no banco
-- do N7, só em tabelas com final "_b7" (docs/integracao-n7/).
-- Só service_role executa.
-- =====================================================================

/* de onde veio a visita (o mesmo critério da aba Site → Métricas) */
create or replace function public._site_fonte(o jsonb)
returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(o->>'utm_source',''),
    case when o ? 'fbclid' then 'meta' when o ? 'gclid' then 'google-ads'
         when o->>'referrer' ilike '%instagram%' then 'instagram'
         when o->>'referrer' ilike '%google%' then 'google'
         when o->>'referrer' ilike '%facebook%' then 'facebook'
         when o ? 'referrer' then 'outros sites' else 'direto' end);
$$;

create or replace function public._site_n7_dados(p_desde timestamptz default null, p_ev_depois bigint default 0, p_lim int default 5000)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  desde as (select coalesce(p_desde, '2000-01-01'::timestamptz) d,
                   (coalesce(p_desde, '2000-01-01'::timestamptz) at time zone 'America/Sao_Paulo')::date dia0),
  ev as (select e.*, (e.created_at at time zone 'America/Sao_Paulo')::date dia from public.site_eventos e, desde
         where (e.created_at at time zone 'America/Sao_Paulo')::date >= desde.dia0),
  /* uma linha por sessão e dia, com a primeira origem e o primeiro aparelho */
  ses as (select dia, sessao, bool_or(tipo in ('engajou','video')) e, bool_or(tipo in ('whatsapp','formulario','instagram')) c,
                 bool_or(tipo = 'lead') l, (array_agg(origem order by created_at))[1] o, (array_agg(dispositivo order by created_at))[1] d
          from ev group by dia, sessao)
  select jsonb_build_object(
    'metricas_dia', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', s.dia, 'visitantes', s.v, 'engajaram', s.e, 'clicaram_contato', s.c, 'leads', s.l,
        'cliques_whatsapp', coalesce(x.w, 0), 'formularios_abertos', coalesce(x.f, 0), 'cliques_instagram', coalesce(x.i, 0), 'videos_assistidos', coalesce(x.vd, 0),
        'celular', s.cel, 'computador', s.pc, 'tablet', s.tab))
      from (select dia, count(*) v, count(*) filter (where e) e, count(*) filter (where c) c, count(*) filter (where l) l,
                   count(*) filter (where d = 'celular') cel, count(*) filter (where d = 'computador') pc, count(*) filter (where d = 'tablet') tab
            from ses group by dia) s
      left join (select dia, count(*) filter (where tipo='whatsapp') w, count(*) filter (where tipo='formulario') f,
                        count(*) filter (where tipo='instagram') i, count(*) filter (where tipo='video') vd from ev group by dia) x using (dia)), '[]'::jsonb),
    'origens_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'fonte', f, 'visitantes', n, 'leads', l))
      from (select dia, public._site_fonte(o) f, count(*) n, count(*) filter (where l) l from ses group by 1, 2) z), '[]'::jsonb),
    'campanhas_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'campanha', cp, 'fonte', f, 'visitantes', n, 'leads', l))
      from (select dia, o->>'utm_campaign' cp, min(public._site_fonte(o)) f, count(*) n, count(*) filter (where l) l
            from ses where coalesce(o->>'utm_campaign','') <> '' group by 1, 2) z), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'criado_em', created_at, 'sessao', sessao, 'tipo', tipo, 'pagina', pagina,
        'dispositivo', dispositivo, 'origem', origem, 'fonte', public._site_fonte(origem), 'campanha', nullif(origem->>'utm_campaign','')) order by id)
      from (select * from public.site_eventos where id > coalesce(p_ev_depois, 0) order by id limit greatest(1, least(coalesce(p_lim, 5000), 20000))) e), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'criado_em', l.created_at, 'nome', l.nome, 'whatsapp', l.whatsapp, 'empresa', l.empresa,
        'cidade', l.cidade, 'interesse', l.interesse, 'mensagem', l.mensagem, 'origem', l.origem, 'fonte', public._site_fonte(l.origem),
        'campanha', nullif(l.origem->>'utm_campaign',''), 'status', l.status, 'notas', l.notas, 'atualizado_em', l.atualizado_em))
      from public.site_leads l, desde where greatest(l.created_at, coalesce(l.atualizado_em, l.created_at)) >= desde.d), '[]'::jsonb),
    'resumo', jsonb_build_array(
      jsonb_build_object('periodo_dias', 7, 'dados', public._site_metricas(7)),
      jsonb_build_object('periodo_dias', 30, 'dados', public._site_metricas(30)),
      jsonb_build_object('periodo_dias', 90, 'dados', public._site_metricas(90)))
  );
$$;
revoke all on function public._site_n7_dados(timestamptz, bigint, int) from public, anon, authenticated;
grant execute on function public._site_n7_dados(timestamptz, bigint, int) to service_role;
