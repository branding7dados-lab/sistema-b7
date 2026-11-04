-- =====================================================================
-- v3.5.0 — gravação com mais de um videomaker (opcional)
--
-- gravacoes.videomakers_extra: quem grava JUNTO com o responsável
-- (videomaker_id). Vazio na maioria das gravações. Os videomakers a mais
-- veem a gravação no dia deles e recebem os mesmos avisos: atribuída,
-- lembretes, remarcada, cancelada e roteiro pronto.
--
-- As funções existentes são ajustadas trocando só o trecho do filtro
-- (regexp_replace); se o trecho não for achado, a migração para.
-- =====================================================================

alter table public.gravacoes
  add column if not exists videomakers_extra uuid[] not null default '{}';

alter table public.gravacoes
  drop constraint if exists gravacoes_extra_sem_responsavel,
  add constraint gravacoes_extra_sem_responsavel
    check (videomaker_id is null or not (videomaker_id = any(videomakers_extra)));

/* todos os videomakers da gravação (responsável primeiro) */
create or replace function public.gravacao_videomakers(g public.gravacoes)
returns uuid[] language sql immutable as $$
  select array_remove(array[g.videomaker_id], null) || coalesce(g.videomakers_extra, '{}')
$$;

/* avisa o responsável e os videomakers a mais */
create or replace function public._grav_notificar_equipe(p_gravacao uuid, p_tipo text, p_titulo text, p_msg text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v uuid;
begin
  for v in select unnest(public.gravacao_videomakers(g)) from public.gravacoes g where g.id = p_gravacao loop
    perform public._grav_notificar(p_gravacao, v, p_tipo, p_titulo, p_msg);
  end loop;
end;
$$;
revoke all on function public._grav_notificar_equipe(uuid, text, text, text) from public, anon, authenticated;

-- ---- views: expõem os videomakers a mais (colunas novas no fim) ----
create or replace view public.gravacoes_resumo with (security_invoker = true) as
 SELECT g.id, g.client_id, g.nome, g.data_gravacao, g.local, g.responsavel, g.videomaker, g.observacoes, g.status,
    g.created_at, g.updated_at, g.is_pinned, g.archived_at, g.deleted_at, g.cover_style, g.situacao, g.gravada_em,
    g.hora_inicio, g.hora_fim, c.nome AS cliente_nome, c.logo_url AS cliente_logo_url,
    ( SELECT count(*) AS count FROM roteiros r
          WHERE ((r.recording_session_id = g.id) AND (r.deleted_at IS NULL))) AS total_roteiros,
    g.competencia_ano, g.competencia_mes, g.videomaker_id,
    ( SELECT p.nome FROM perfis p WHERE (p.id = g.videomaker_id)) AS videomaker_nome,
    ( SELECT count(*) AS count FROM (gravacao_itens i LEFT JOIN roteiros r ON ((r.id = i.roteiro_id)))
          WHERE ((i.gravacao_id = g.id) AND (i.removido_em IS NULL) AND ((r.id IS NULL) OR (r.deleted_at IS NULL)))) AS total_itens,
    ( SELECT count(*) AS count FROM (gravacao_itens i LEFT JOIN roteiros r ON ((r.id = i.roteiro_id)))
          WHERE ((i.gravacao_id = g.id) AND (i.removido_em IS NULL) AND i.gravado AND ((r.id IS NULL) OR (r.deleted_at IS NULL)))) AS itens_gravados,
    g.concluida_em,
    g.videomakers_extra,
    ( SELECT coalesce(array_agg(p.nome ORDER BY array_position(g.videomakers_extra, p.id)), '{}')
           FROM perfis p WHERE p.id = ANY (g.videomakers_extra)) AS videomakers_extra_nomes
   FROM (gravacoes g JOIN clientes c ON ((c.id = g.client_id)));

create or replace view public.agenda_compromissos with (security_invoker = true) as
 SELECT 'evento'::text AS origem, ev.id, ev.titulo, ev.inicio, ev.fim, ev.dia_inteiro, ev.local,
    agenda_tipo_compromisso(ev.titulo) AS tipo, vi.gravacao_id, cl.nome AS cliente_nome, g.client_id,
    ag.nome AS agenda_nome, g.videomaker_id, coalesce(g.videomakers_extra, '{}'::uuid[]) AS videomakers_extra
   FROM ((((calendario_eventos ev
     JOIN calendario_agendas ag ON (((ag.id = ev.agenda_id) AND ag.ativo AND ag.lembretes)))
     LEFT JOIN calendario_vinculos vi ON ((vi.evento_id = ev.id)))
     LEFT JOIN gravacoes g ON ((g.id = vi.gravacao_id)))
     LEFT JOIN clientes cl ON ((cl.id = g.client_id)))
  WHERE ((ev.status_provider <> 'cancelled'::text) AND (upper(btrim(COALESCE(ev.titulo, ''::text))) <> 'CANCELLED'::text))
UNION ALL
 SELECT 'ocorrencia'::text AS origem, o.id, COALESCE(g.nome, 'Gravação'::text) AS titulo, o.inicio, o.fim,
    o.sem_horario AS dia_inteiro, g.local, 'gravacao'::text AS tipo, o.gravacao_id, cl.nome AS cliente_nome,
    g.client_id, NULL::text AS agenda_nome, g.videomaker_id, g.videomakers_extra
   FROM ((gravacoes_ocorrencias o
     JOIN gravacoes g ON (((g.id = o.gravacao_id) AND (g.deleted_at IS NULL))))
     LEFT JOIN clientes cl ON ((cl.id = g.client_id)))
  WHERE (o.atual AND (o.status = 'marcada'::text) AND (o.evento_id IS NULL));

-- ---- funções: troca só o trecho que filtra pelo videomaker ----
do $mig$
declare
  trocas text[][] := array[
    ['_notif_resumo_diario', '([^a-z_])g\.videomaker_id = p\.id', '\1(g.videomaker_id = p.id or p.id = any(g.videomakers_extra))'],
    ['widget_hoje',          '([^a-z_])g\.videomaker_id = p\.id', '\1(g.videomaker_id = p.id or p.id = any(g.videomakers_extra))'],
    ['meu_dia',              'g\.videomaker_id = auth\.uid\(\)', '(g.videomaker_id = auth.uid() or auth.uid() = any(g.videomakers_extra))'],
    ['agenda_verificar_lembretes', 'array\[c\.videomaker_id\]', 'array[c.videomaker_id] || c.videomakers_extra'],
    ['roteiros_notificar_status',  'array\[g\.videomaker_id\]', 'public.gravacao_videomakers(g)'],
    ['_producao_alertas_lembretes', 'select g\.id, g\.nome, g\.client_id, g\.videomaker_id,', 'select g.id, g.nome, g.client_id, g.videomaker_id, g.videomakers_extra,'],
    ['_producao_alertas_lembretes', 'else array\[r\.videomaker_id\] end', 'else array[r.videomaker_id] || r.videomakers_extra end'],
    ['gravacoes_ocorrencias_sincronizar',
       'public\._grav_notificar\(new\.gravacao_id, \(select videomaker_id from public\.gravacoes where id = new\.gravacao_id\),',
       'public._grav_notificar_equipe(new.gravacao_id,']
  ];
  fn text; i int; def text; novo text;
begin
  for fn in select distinct trocas[k][1] from generate_series(1, array_length(trocas, 1)) k loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = fn;
    if def is null then raise exception 'função % não achada', fn; end if;
    /* já ajustada antes (a migração pode rodar de novo) */
    if position('videomakers_extra' in def) > 0 or position('_grav_notificar_equipe' in def) > 0
       or position('gravacao_videomakers' in def) > 0 then continue; end if;
    novo := def;
    for i in 1 .. array_length(trocas, 1) loop
      if trocas[i][1] <> fn then continue; end if;
      if regexp_replace(novo, trocas[i][2], trocas[i][3], 'g') = novo then
        raise exception 'trecho não achado em %: %', fn, trocas[i][2];
      end if;
      novo := regexp_replace(novo, trocas[i][2], trocas[i][3], 'g');
    end loop;
    execute novo;
  end loop;
end
$mig$;

-- ---- histórico/aviso: quem entra como videomaker a mais é avisado ----
create or replace function public._grav_extra_avisar()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v uuid; antes uuid[] := '{}';
begin
  if tg_op = 'UPDATE' then antes := coalesce(old.videomakers_extra, '{}'); end if;
  for v in select unnest(new.videomakers_extra) except select unnest(antes) loop
    perform public._grav_notificar(new.id, v, 'gravacao.atribuida',
      'Você vai gravar junto em "' || new.nome || '"');
  end loop;
  if tg_op = 'UPDATE' and new.videomakers_extra is distinct from old.videomakers_extra then
    perform public._grav_hist(new.id, 'equipe_definida', jsonb_build_object(
      'videomakers', (select coalesce(array_agg(p.nome), '{}') from public.perfis p where p.id = any(new.videomakers_extra))));
  end if;
  return new;
end;
$$;

drop trigger if exists gravacoes_extra_avisar on public.gravacoes;
create trigger gravacoes_extra_avisar after insert or update of videomakers_extra on public.gravacoes
  for each row execute function public._grav_extra_avisar();
