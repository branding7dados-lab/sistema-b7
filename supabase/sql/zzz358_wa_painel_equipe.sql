-- 4.67.0: painel da Central de Conversas para conversas da EQUIPE.
-- wa_painel_equipe(p_jid) devolve:
--   grupo da equipe      → {tipo:'grupo', membros:[...], producao:{...}, gravacoes:[...]}
--   privado de alguém da equipe → {tipo:'pessoa', pessoa:{...}, videos:[...], designs:n, gravacoes:[...]}
--   qualquer outra conversa → null
-- wa_assistente só o admin lê; aqui vai só o necessário (sem os números), para quem pode ver o WhatsApp.
create or replace function public.wa_painel_equipe(p_jid text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  cfg public.wa_assistente%rowtype;
  fim text := right(regexp_replace(split_part(coalesce(p_jid, ''), '@', 1), '\D', '', 'g'), 8);
  membro jsonb; pf public.perfis%rowtype; membros jsonb := '[]'::jsonb; e jsonb;
begin
  if not public.pode_ver_wa() then return null; end if;
  select * into cfg from public.wa_assistente limit 1;
  if not found then return null; end if;

  -- cada pessoa da equipe do Otto → o perfil do B7 (pelo nome)
  for e in select * from jsonb_array_elements(coalesce(cfg.equipe, '[]'::jsonb)) loop
    pf := null;
    select * into pf from public.perfis x
     where x.estado = 'ativa' and x.papel <> 'cliente'
       and (lower(x.nome) = lower(e->>'nome') or lower(split_part(x.nome, ' ', 1)) = lower(split_part(e->>'nome', ' ', 1)))
     order by (lower(x.nome) = lower(e->>'nome')) desc limit 1;
    membros := membros || jsonb_build_object(
      'nome', e->>'nome',
      'assuntos', e->>'assuntos',
      'perfil_id', pf.id,
      'avatar_url', pf.avatar_url,
      'funcao', coalesce(nullif(pf.funcao_personalizada, ''), pf.funcao),
      'presenca', pf.status_presenca,
      'visto', pf.last_seen_at,
      'quem', case when pf.id is not null then cfg.quem_e_quem->>(pf.id::text) end,
      'fim', right(regexp_replace(coalesce(e->>'numero', ''), '\D', '', 'g'), 8));
  end loop;

  if p_jid = cfg.grupo_equipe then
    return jsonb_build_object('tipo', 'grupo',
      'membros', (select coalesce(jsonb_agg(m - 'fim'), '[]'::jsonb) from jsonb_array_elements(membros) m),
      'producao', jsonb_build_object(
        'design', (select count(*) from public.design_resumo d where d.status <> 'finalizado'),
        'videos', (select count(*) from public.demandas_edicao v where v.deleted_at is null and v.editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao')),
        'atrasados', (select count(*) from public.demandas_edicao v where v.deleted_at is null and v.editing_status in ('pendente', 'em_edicao') and v.prazo < (now() at time zone 'America/Sao_Paulo')::date),
        'gravacoes_semana', (select count(*) from public.gravacoes g where g.deleted_at is null and g.archived_at is null and coalesce(g.situacao, '') <> 'Cancelada'
                              and g.data_gravacao between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date + 6)),
      'gravacoes', (select coalesce(jsonb_agg(x order by x->>'data'), '[]'::jsonb) from (
          select jsonb_build_object('nome', g.nome, 'data', g.data_gravacao, 'hora', g.hora_inicio, 'cliente', c.nome) x
            from public.gravacoes g left join public.clientes c on c.id = g.client_id
           where g.deleted_at is null and g.archived_at is null and coalesce(g.situacao, '') <> 'Cancelada'
             and g.data_gravacao >= (now() at time zone 'America/Sao_Paulo')::date
           order by g.data_gravacao, g.hora_inicio nulls last limit 3) s));
  end if;

  if length(fim) = 8 and position('@g.us' in p_jid) = 0 then
    select m into membro from jsonb_array_elements(membros) m where m->>'fim' = fim limit 1;
    if membro is null then return null; end if;
    return jsonb_build_object('tipo', 'pessoa', 'pessoa', membro - 'fim',
      'videos_total', (select count(*) from public.demandas_edicao v where v.deleted_at is null and v.videomaker_id = (membro->>'perfil_id')::uuid and v.editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao')),
      'designs', (select count(*) from public.design_resumo d where d.designer_id = (membro->>'perfil_id')::uuid and d.status <> 'finalizado'),
      'videos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select jsonb_build_object('titulo', v.titulo, 'codigo', v.codigo, 'cliente', c.nome, 'prazo', v.prazo, 'status', v.editing_status) x
            from public.demandas_edicao v left join public.clientes c on c.id = v.client_id
           where v.deleted_at is null and v.videomaker_id = (membro->>'perfil_id')::uuid and v.editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao')
           order by v.prazo nulls last, v.created_at limit 4) s),
      'gravacoes', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select jsonb_build_object('nome', g.nome, 'data', g.data_gravacao, 'hora', g.hora_inicio, 'cliente', c.nome) x
            from public.gravacoes g left join public.clientes c on c.id = g.client_id
           where g.deleted_at is null and g.archived_at is null and coalesce(g.situacao, '') <> 'Cancelada'
             and g.data_gravacao >= (now() at time zone 'America/Sao_Paulo')::date
             and (g.videomaker_id = (membro->>'perfil_id')::uuid or (membro->>'perfil_id')::uuid = any(coalesce(g.videomakers_extra, '{}')))
           order by g.data_gravacao, g.hora_inicio nulls last limit 3) s));
  end if;
  return null;
end $$;
revoke all on function public.wa_painel_equipe(text) from public, anon;
grant execute on function public.wa_painel_equipe(text) to authenticated;
