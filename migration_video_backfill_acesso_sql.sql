-- =========================================================================
-- CORREÇÃO — backfill de competência/prioridade não rodava no SQL Editor
-- =========================================================================
-- Achado ao investigar por que a competência das 367 demandas
-- importadas continuava toda em setembro/2026 mesmo depois de "rodar o
-- backfill": video_backfill_competencia() e video_backfill_prioridade()
-- checavam public.sou_equipe(), que depende de auth.uid() — e o SQL
-- Editor do Supabase roda como o papel do banco (postgres/owner), sem
-- JWT de usuário nenhum. auth.uid() volta NULL, sou_equipe() volta
-- falso, e a função recusa rodar com "Só a equipe roda o backfill...".
-- Ou seja: a instrução que te dei no build 2026-09-14-e (rodar essas
-- duas funções direto no SQL Editor) nunca teria funcionado — o erro
-- ficava por trás disso, não era falta de dado nenhuma.
--
-- Esta rodada tem os dois problemas juntos: a coluna "Mês" das 367
-- demandas realmente nunca foi salva em dados_originais (corrigido por
-- outro script, de recuperação, entregue junto com este); e a função
-- de backfill em si não rodava de jeito nenhum a partir do SQL Editor
-- (corrigido aqui).
--
-- A correção: só exige sou_equipe() quando existe uma sessão de
-- usuário de verdade (auth.uid() não nulo — ou seja, quando chamado
-- pelo aplicativo, via PostgREST, com o login de alguém). Chamado sem
-- JWT nenhum (SQL Editor, sessão de DBA) passa direto — quem tem
-- acesso ao SQL Editor já tem acesso irrestrito ao banco de qualquer
-- forma, então essa checagem nunca protegia nada nesse caso; ela só
-- existe pra impedir um usuário comum de chamar a função pelo app sem
-- ser da equipe, e isso continua protegido.
-- =========================================================================

create or replace function public.video_backfill_competencia()
returns table(demanda_id uuid, titulo text, competencia_antiga text, competencia_nova text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.sou_equipe() then
    raise exception 'Só a equipe roda o backfill de competência.' using errcode = '42501';
  end if;

  return query
  with fonte as (
    select l.demanda_id as did,
           nullif(l.dados_originais->>'ano', '')::int as ano_fonte,
           nullif(l.dados_originais->>'mes', '')::int as mes_fonte
      from public.demandas_edicao_import_linhas l
     where l.demanda_id is not null
  ),
  divergentes as (
    select d.id, d.titulo,
           d.competencia_ano, d.competencia_mes,
           f.ano_fonte, f.mes_fonte
      from public.demandas_edicao d
      join fonte f on f.did = d.id
     where d.origem = 'importacao'
       and f.ano_fonte is not null and f.mes_fonte between 1 and 12
       and (d.competencia_ano is distinct from f.ano_fonte or d.competencia_mes is distinct from f.mes_fonte)
  ),
  aplicado as (
    update public.demandas_edicao d
       set competencia_ano = dv.ano_fonte, competencia_mes = dv.mes_fonte, updated_at = now()
      from divergentes dv
     where d.id = dv.id
    returning d.id, d.titulo, dv.competencia_ano as ano_antigo, dv.competencia_mes as mes_antigo,
              dv.ano_fonte as ano_novo, dv.mes_fonte as mes_novo
  )
  select a.id, a.titulo,
         coalesce(a.mes_antigo::text || '/' || a.ano_antigo::text, '—'),
         a.mes_novo::text || '/' || a.ano_novo::text
    from aplicado a;
end;
$$;
revoke all on function public.video_backfill_competencia() from public;
grant execute on function public.video_backfill_competencia() to authenticated;

create or replace function public.video_demandas_competencia_nao_confiavel()
returns table(demanda_id uuid, titulo text, cliente_nome text, competencia_atual text)
language sql stable security definer set search_path = public as $$
  select d.id, d.titulo, cl.nome, d.competencia_mes::text || '/' || d.competencia_ano::text
    from public.demandas_edicao d
    left join public.clientes cl on cl.id = d.client_id
    left join public.demandas_edicao_import_linhas l on l.demanda_id = d.id
   where d.origem = 'importacao' and d.deleted_at is null
     and (l.id is null or nullif(l.dados_originais->>'ano', '') is null
          or nullif(l.dados_originais->>'mes', '') is null)
     and (auth.uid() is null or public.sou_equipe())
   order by d.competencia_ano desc nulls last, d.competencia_mes desc nulls last;
$$;
revoke all on function public.video_demandas_competencia_nao_confiavel() from public;
grant execute on function public.video_demandas_competencia_nao_confiavel() to authenticated;

create or replace function public.video_backfill_prioridade()
returns table(demanda_id uuid, titulo text, prioridade_origem text, prioridade_nova text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.sou_equipe() then
    raise exception 'Só a equipe roda o backfill de prioridade.' using errcode = '42501';
  end if;

  return query
  with fonte as (
    select l.demanda_id as did,
           nullif(btrim(coalesce(l.dados_originais->>'prioridade', '')), '') as prio_fonte
      from public.demandas_edicao_import_linhas l
     where l.demanda_id is not null
  ),
  fonte_completa as (
    select d.id as did,
           coalesce(f.prio_fonte,
                    btrim((regexp_match(d.observacoes, 'Prioridade \(planilha\):\s*([^·]+)'))[1]))
             as prio_fonte
      from public.demandas_edicao d
      left join fonte f on f.did = d.id
     where d.origem = 'importacao'
  ),
  mapeado as (
    select fc.did, fc.prio_fonte,
           case
             when fc.prio_fonte ~* 'urgente' then 'urgente'
             when fc.prio_fonte ~* 'alta' then 'alta'
             else 'normal'
           end as prio_normalizada
      from fonte_completa fc
     where fc.prio_fonte is not null
  ),
  divergentes as (
    select d.id, d.titulo, m.prio_fonte, m.prio_normalizada
      from public.demandas_edicao d
      join mapeado m on m.did = d.id
     where d.prioridade is distinct from m.prio_normalizada
  ),
  aplicado as (
    update public.demandas_edicao d
       set prioridade = dv.prio_normalizada, updated_at = now()
      from divergentes dv
     where d.id = dv.id
    returning d.id, d.titulo, dv.prio_fonte, dv.prio_normalizada
  )
  select a.id, a.titulo, a.prio_fonte, a.prio_normalizada from aplicado a;
end;
$$;
revoke all on function public.video_backfill_prioridade() from public;
grant execute on function public.video_backfill_prioridade() to authenticated;
