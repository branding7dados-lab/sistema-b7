/* =====================================================================
   B7 VÍDEO — PARTE 1.1: PRODUÇÃO DE VÍDEO + MULTI-FUNÇÃO INTERNA
   Migração aditiva. Roda depois de migration_video.sql,
   migration_video_kanban.sql e migration_video_import_fix.sql. Não
   apaga nem recria nada que já existe — nenhuma Demanda de Edição
   importada é tocada, exceto o backfill explícito da seção 4 (e só
   quando a fonte original confirma o valor certo).

   O que esta migração muda:
     1) Multi-função interna ADITIVA: uma pessoa continua com UM papel
        principal (perfis.papel — não mexido aqui, e todo o resto do
        sistema continua decidindo permissão por ele, sem mudança),
        mas agora pode ganhar FUNÇÕES EXTRAS de produção (por enquanto:
        videomaker) sem precisar de uma segunda conta. Kevin continua
        Administrador (papel = 'admin') e ganha a função extra
        "videomaker": aparece como elegível para receber Demandas de
        Edição, sem perder nenhuma permissão de admin.
     2) Elegibilidade de videomaker deixa de ser "papel = 'videomaker'"
        e passa a ser "papel = 'videomaker' OU tem a função extra" —
        em toda função que hoje faz essa checagem.
     3) view videomakers_elegiveis, para o seletor de responsável.
     4) Backfill de competência (mês/ano) das Demandas de Edição
        importadas: usa o valor ORIGINAL preservado em
        demandas_edicao_import_linhas.dados_originais (nunca inventa
        nem deriva de outra data) para corrigir demandas que nasceram
        antes da correção do parser (build 2026-09-14-d) e por isso
        ficaram com a competência "de hoje" em vez da competência real
        da planilha.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. FUNÇÕES EXTRAS DE PRODUÇÃO (multi-função aditiva)
-- ---------------------------------------------------------------------
create table if not exists public.perfis_funcoes_extra (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  funcao text not null check (funcao in ('videomaker', 'designer')),
  criado_por uuid references public.perfis(id),
  created_at timestamptz not null default now(),
  unique (perfil_id, funcao)
);
create index if not exists perfis_funcoes_extra_perfil on public.perfis_funcoes_extra (perfil_id);

alter table public.perfis_funcoes_extra enable row level security;
revoke insert, update, delete on public.perfis_funcoes_extra from authenticated;
grant select on public.perfis_funcoes_extra to authenticated;

/* Escrita só pela função de borda (b7-auth, com a chave de serviço —
   fora do RLS). Leitura: a própria pessoa vê as próprias funções
   extras (necessário para a navegação decidir o que mostrar), e a
   equipe (admin/coordenador) vê de todo mundo (necessário para a tela
   de Usuários e acessos mostrar os badges corretos). */
drop policy if exists "perfis_funcoes_extra select" on public.perfis_funcoes_extra;
create policy "perfis_funcoes_extra select" on public.perfis_funcoes_extra
  for select to authenticated
  using (perfil_id = auth.uid() or public.sou_equipe());

/* Checa se UM usuário (por padrão, quem está logado) tem uma função
   extra específica — usado tanto pelo RLS quanto pelas funções de
   escrita de vídeo. security definer porque a política de select acima
   já cobre o caso de uso normal, mas isto evita depender da política
   em contextos internos (ex.: checar a função extra de OUTRO usuário
   ao validar uma atribuição). */
create or replace function public.tenho_funcao_extra(p_funcao text, p_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis_funcoes_extra
     where perfil_id = p_id and funcao = p_funcao
  )
$$;
revoke all on function public.tenho_funcao_extra(text, uuid) from public;
grant execute on function public.tenho_funcao_extra(text, uuid) to authenticated;

/* Elegibilidade de videomaker = papel principal OU função extra,
   sempre exigindo conta ativa. Esta é a ÚNICA definição de "é
   videomaker" a partir de agora — qualquer lugar que antes comparava
   `papel = 'videomaker'` diretamente para decidir elegibilidade passa
   a usar esta função. */
create or replace function public.eh_videomaker_elegivel(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfis p
     where p.id = p_id and p.estado = 'ativa'
       and (p.papel = 'videomaker' or public.tenho_funcao_extra('videomaker', p_id))
  )
$$;
revoke all on function public.eh_videomaker_elegivel(uuid) from public;
grant execute on function public.eh_videomaker_elegivel(uuid) to authenticated;

/* sou_videomaker() já existia (migration_video.sql) para as políticas
   de leitura de apoio (clientes/gravações) — passa a usar a mesma
   regra de elegibilidade por associação em vez de igualdade exata de
   papel, então Kevin (admin + função extra videomaker) também
   enxerga o briefing mínimo por trás das demandas atribuídas a ele. */
create or replace function public.sou_videomaker()
returns boolean language sql stable security definer set search_path = public as $$
  select public.eh_videomaker_elegivel(auth.uid())
$$;

-- ---------------------------------------------------------------------
-- 2. VIEW DE ELEGÍVEIS (substitui a consulta antiga "papel = videomaker")
-- ---------------------------------------------------------------------
create or replace view public.videomakers_elegiveis
with (security_invoker = true) as
select p.id, p.nome, p.avatar_url, p.estado, p.papel,
       (p.papel = 'videomaker') as papel_principal,
       coalesce(fe.funcoes, '{}'::text[]) as funcoes_extra
from public.perfis p
left join (
  select perfil_id, array_agg(funcao order by funcao) as funcoes
    from public.perfis_funcoes_extra group by perfil_id
) fe on fe.perfil_id = p.id
where p.estado = 'ativa'
  and (p.papel = 'videomaker' or public.tenho_funcao_extra('videomaker', p.id));
grant select on public.videomakers_elegiveis to authenticated;

-- ---------------------------------------------------------------------
-- 3. VALIDAÇÃO DE ATRIBUIÇÃO passa a usar elegibilidade por associação
--    (recria as versões mais recentes de video_criar_demanda e
--    video_atribuir — as de migration_video_kanban.sql — só trocando
--    a checagem `papel = 'videomaker'` por eh_videomaker_elegivel()).
-- ---------------------------------------------------------------------
create or replace function public.video_criar_demanda(
  p_client_id uuid, p_titulo text, p_codigo text default '',
  p_competencia_ano int default null, p_competencia_mes int default null,
  p_gravacao_id uuid default null, p_videomaker_id uuid default null,
  p_pacote text default '', p_prazo date default null, p_observacoes text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; ano int; mes int; ator public.perfis%rowtype; vm public.perfis%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe cria uma demanda de edição.' using errcode = '42501';
  end if;
  if p_client_id is null then raise exception 'Selecione o cliente.'; end if;
  if coalesce(btrim(p_titulo), '') = '' then raise exception 'Dê um título para a demanda.'; end if;
  if p_videomaker_id is not null and not public.eh_videomaker_elegivel(p_videomaker_id) then
    raise exception 'Esse usuário não é um videomaker ativo.';
  end if;

  select * into ator from public.perfis where id = auth.uid();
  if p_videomaker_id is not null then select * into vm from public.perfis where id = p_videomaker_id; end if;
  ano := coalesce(p_competencia_ano, extract(year from now())::int);
  mes := coalesce(p_competencia_mes, extract(month from now())::int);

  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por,
     editing_status)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(),
     case when p_videomaker_id is not null then 'em_edicao' else 'pendente' end)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values ('video.atribuida', 'video.atribuida:' || novo || ':' || now()::text, 'demanda_edicao', novo, p_client_id,
            auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', p_titulo));
    perform public.video_processar_evento((select id from public.eventos_dominio
      where chave = 'video.atribuida:' || novo || ':' || now()::text order by created_at desc limit 1));
  end if;

  return novo;
end;
$$;
revoke all on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text) from public;
grant execute on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text) to authenticated;

create or replace function public.video_atribuir(p_demanda_id uuid, p_videomaker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; vm public.perfis%rowtype; evid uuid;
  vira_em_edicao boolean; k uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe atribui um videomaker.' using errcode = '42501';
  end if;
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if p_videomaker_id is not null then
    if not public.eh_videomaker_elegivel(p_videomaker_id) then
      raise exception 'Esse usuário não é um videomaker ativo.';
    end if;
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  select * into ator from public.perfis where id = auth.uid();
  vira_em_edicao := p_videomaker_id is not null and d.editing_status = 'pendente';

  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now(),
         editing_status = case when vira_em_edicao then 'em_edicao' else editing_status end
   where id = p_demanda_id;

  if vira_em_edicao and d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'producao', d.client_id, 'demanda_edicao', d.id, 'video', p_videomaker_id, d.prazo, auth.uid(), 'video.atribuida')
    returning id into k;
    update public.demandas_edicao set kanban_id = k where id = p_demanda_id;
  elsif d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_videomaker_id, updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'atribuida', auth.uid(), ator.nome, ator.papel,
          case when p_videomaker_id is null then 'Atribuição removida' else null end);

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.atribuida', 'video.atribuida:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_atribuir(uuid, uuid) from public;
grant execute on function public.video_atribuir(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. minha_sessao GANHA funcoes_extra (coluna nova, sempre no fim)
--    A view já foi recriada mais de uma vez nesta base (migration_fix,
--    migration_presenca, migration_portal_v2), cada vez com colunas
--    novas — "create or replace view" não aceita nem tirar nem trocar
--    a ordem de coluna já existente, então aqui também é drop+create,
--    preservando TODAS as colunas que a versão mais recente
--    (migration_portal_v2.sql) já expõe, só acrescentando
--    funcoes_extra no fim. Se preferencias/last_login_at/last_seen_at
--    ainda não existirem (instalação sem migration_presenca.sql/
--    migration_portal_v2.sql aplicadas), cai numa versão mais simples,
--    equivalente à de migration_auth.sql + funcoes_extra.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'perfis' and column_name = 'last_seen_at')
     and exists (select 1 from pg_proc where proname = 'minhas_empresas') then
    execute 'drop view if exists public.minha_sessao';
    execute $v$
      create view public.minha_sessao
      with (security_invoker = true) as
      select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
             coalesce(p.preferencias, '{}'::jsonb) as preferencias,
             p.last_login_at, p.last_seen_at,
             public.minhas_empresas() as empresas,
             coalesce((select array_agg(fe.funcao order by fe.funcao)
                         from public.perfis_funcoes_extra fe where fe.perfil_id = p.id), '{}'::text[]) as funcoes_extra
      from public.perfis p
      where p.id = auth.uid()
    $v$;
  else
    execute 'drop view if exists public.minha_sessao';
    execute $v$
      create view public.minha_sessao
      with (security_invoker = true) as
      select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
             (select coalesce(json_agg(json_build_object(
                       'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
                       'servico', coalesce(c.servico, 'ativo'),
                       'mensagem', c.servico_mensagem)), '[]'::json)
                from public.perfil_clientes pc
                join public.clientes c on c.id = pc.client_id
               where pc.perfil_id = p.id) as empresas,
             coalesce((select array_agg(fe.funcao order by fe.funcao)
                         from public.perfis_funcoes_extra fe where fe.perfil_id = p.id), '{}'::text[]) as funcoes_extra
      from public.perfis p
      where p.id = auth.uid()
    $v$;
  end if;
end $$;
grant select on public.minha_sessao to authenticated;

-- ---------------------------------------------------------------------
-- 5. BACKFILL DE COMPETÊNCIA (mês/ano) DAS DEMANDAS IMPORTADAS
--    Só corrige quando a linha de importação original (preservada,
--    nunca apagada) já tinha ano/mês legítimos e o valor atual da
--    demanda diverge dele — nunca deriva de outra data, nunca
--    "adivinha". video_backfill_competencia() aplica a correção e
--    devolve o que mudou; video_demandas_competencia_nao_confiavel()
--    lista, sem alterar nada, as demandas importadas cuja fonte
--    original não tinha mês/ano (não há como corrigir com segurança).
-- ---------------------------------------------------------------------
create or replace function public.video_backfill_competencia()
returns table(demanda_id uuid, titulo text, competencia_antiga text, competencia_nova text)
language plpgsql security definer set search_path = public as $$
begin
  /* auth.uid() nulo = chamado do SQL Editor (sessão de DBA, sem JWT),
     não do app — quem tem acesso ao SQL Editor já tem acesso total ao
     banco, então só exige sou_equipe() quando existe usuário logado
     de verdade (chamada vinda do app). */
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

-- ---------------------------------------------------------------------
-- 6. PRIORIDADE VIRA CAMPO DE VERDADE
--    Desde a importação real (build 2026-09-14-d) a prioridade da
--    planilha já é preservada, mas só como texto dentro de
--    "observações" (não existia coluna própria — decisão documentada
--    na Parte 1). A Produção de Vídeo precisa filtrar e mostrar
--    prioridade de verdade, então ela vira coluna, com o mesmo
--    vocabulário que o Design já usa (normal/alta/urgente — consistência
--    entre os dois módulos de produção).
-- ---------------------------------------------------------------------
alter table public.demandas_edicao add column if not exists prioridade text not null default 'normal';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demandas_edicao_prioridade_valida') then
    alter table public.demandas_edicao add constraint demandas_edicao_prioridade_valida
      check (prioridade in ('normal', 'alta', 'urgente'));
  end if;
end $$;

/* view atualizada: prioridade sempre no fim (mesma regra de kanban_id
   — coluna nova por ALTER TABLE fica no fim da ordem física). */
create or replace view public.demandas_edicao_resumo
with (security_invoker = true) as
select
  de.id, de.client_id, de.gravacao_id, de.videomaker_id,
  de.competencia_ano, de.competencia_mes, de.codigo, de.titulo, de.pacote, de.prazo,
  de.link_material, de.editing_status, de.observacoes, de.origem, de.import_lote_id,
  de.criado_por, de.created_at, de.updated_at, de.entregue_em, de.deleted_at,
  cl.nome as cliente_nome,
  coalesce(cl.servico, 'ativo') as cliente_servico,
  pf.nome as videomaker_nome,
  g.situacao as gravacao_situacao,
  g.nome as gravacao_nome,
  de.kanban_id,
  de.prioridade
from public.demandas_edicao de
left join public.clientes cl on cl.id = de.client_id
left join public.perfis pf on pf.id = de.videomaker_id
left join public.gravacoes g on g.id = de.gravacao_id
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;

drop function if exists public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text);
create or replace function public.video_criar_demanda(
  p_client_id uuid, p_titulo text, p_codigo text default '',
  p_competencia_ano int default null, p_competencia_mes int default null,
  p_gravacao_id uuid default null, p_videomaker_id uuid default null,
  p_pacote text default '', p_prazo date default null, p_observacoes text default '',
  p_prioridade text default 'normal'
) returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; ano int; mes int; ator public.perfis%rowtype; vm public.perfis%rowtype; prio text;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe cria uma demanda de edição.' using errcode = '42501';
  end if;
  if p_client_id is null then raise exception 'Selecione o cliente.'; end if;
  if coalesce(btrim(p_titulo), '') = '' then raise exception 'Dê um título para a demanda.'; end if;
  if p_videomaker_id is not null and not public.eh_videomaker_elegivel(p_videomaker_id) then
    raise exception 'Esse usuário não é um videomaker ativo.';
  end if;
  prio := case when p_prioridade in ('normal', 'alta', 'urgente') then p_prioridade else 'normal' end;

  select * into ator from public.perfis where id = auth.uid();
  if p_videomaker_id is not null then select * into vm from public.perfis where id = p_videomaker_id; end if;
  ano := coalesce(p_competencia_ano, extract(year from now())::int);
  mes := coalesce(p_competencia_mes, extract(month from now())::int);

  insert into public.demandas_edicao
    (client_id, gravacao_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo,
     pacote, prazo, observacoes, origem, criado_por,
     editing_status, prioridade)
  values
    (p_client_id, p_gravacao_id, p_videomaker_id, ano, mes, coalesce(p_codigo, ''), p_titulo,
     coalesce(p_pacote, ''), p_prazo, coalesce(p_observacoes, ''), 'manual', auth.uid(),
     case when p_videomaker_id is not null then 'em_edicao' else 'pendente' end, prio)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, null);

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values ('video.atribuida', 'video.atribuida:' || novo || ':' || now()::text, 'demanda_edicao', novo, p_client_id,
            auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', p_titulo));
    perform public.video_processar_evento((select id from public.eventos_dominio
      where chave = 'video.atribuida:' || novo || ':' || now()::text order by created_at desc limit 1));
  end if;

  return novo;
end;
$$;
revoke all on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text, text) from public;
grant execute on function public.video_criar_demanda(uuid, text, text, int, int, uuid, uuid, text, date, text, text) to authenticated;

drop function if exists public.video_editar_demanda(uuid, text, text, text, date, boolean, text, uuid, boolean);
create or replace function public.video_editar_demanda(
  p_demanda_id uuid, p_titulo text default null, p_codigo text default null,
  p_pacote text default null, p_prazo date default null, p_tem_prazo boolean default false,
  p_observacoes text default null, p_gravacao_id uuid default null, p_tem_gravacao boolean default false,
  p_prioridade text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe edita os dados da demanda.' using errcode = '42501';
  end if;
  if p_tem_gravacao and p_gravacao_id is not null and not exists (select 1 from public.gravacoes where id = p_gravacao_id) then
    raise exception 'Gravação inválida.';
  end if;
  if p_prioridade is not null and p_prioridade not in ('normal', 'alta', 'urgente') then
    raise exception 'Prioridade inválida.';
  end if;
  update public.demandas_edicao set
    titulo = coalesce(p_titulo, titulo),
    codigo = coalesce(p_codigo, codigo),
    pacote = coalesce(p_pacote, pacote),
    prazo = case when p_tem_prazo then p_prazo else prazo end,
    observacoes = coalesce(p_observacoes, observacoes),
    gravacao_id = case when p_tem_gravacao then p_gravacao_id else gravacao_id end,
    prioridade = coalesce(p_prioridade, prioridade),
    updated_at = now()
  where id = p_demanda_id and deleted_at is null;
end;
$$;
revoke all on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text, uuid, boolean, text) from public;
grant execute on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text, uuid, boolean, text) to authenticated;

/* Backfill de prioridade — mesma ética do backfill de competência:
   só usa o valor ORIGINAL preservado, nunca inventa. Duas fontes,
   nessa ordem: dados_originais->>'prioridade' (importações a partir
   deste build, que já guardam o campo separado) e, quando esse campo
   não existir (todas as importações ANTERIORES a este build —
   "Prioridade" só entrava dentro do texto composto de observações,
   nunca como campo próprio, limitação documentada na Parte 1), o
   texto "Prioridade (planilha): X" já preservado dentro de
   demandas_edicao.observacoes. Sem termo reconhecido em nenhuma das
   duas fontes, fica "normal" (já é o padrão da coluna — não há o que
   reportar como "sem fonte confiável" aqui, porque "normal" é uma
   prioridade legítima, não um vazio). */
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

-- ---------------------------------------------------------------------
-- 7. video_import_confirmar_linha PASSA A LER PRIORIDADE TAMBÉM
--    (dados_originais->>'prioridade' só existe em importações feitas a
--    partir deste build — js/video.js passou a preservar o campo
--    separado; para o que já foi importado antes, video_backfill_
--    prioridade() recupera lendo o texto de observações).
-- ---------------------------------------------------------------------
create or replace function public.video_import_confirmar_linha(p_linha_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; lote public.demandas_edicao_import_lotes%rowtype;
  novo uuid; ano int; mes int; prazo date; ator public.perfis%rowtype;
  status_planilha text; status_final text; titulo_final text; codigo_final text; entregue timestamptz;
  prioridade_planilha text; prioridade_final text;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe confirma importações.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if l.confirmada then return l.demanda_id; end if;
  if not l.resolvida or l.cliente_id is null then
    raise exception 'Esta linha ainda tem pendências — resolva o cliente antes de confirmar.';
  end if;
  select * into lote from public.demandas_edicao_import_lotes where id = l.lote_id;
  select * into ator from public.perfis where id = auth.uid();

  ano := coalesce(nullif(l.dados_originais->>'ano', '')::int, extract(year from now())::int);
  mes := coalesce(nullif(l.dados_originais->>'mes', '')::int, extract(month from now())::int);
  begin
    prazo := nullif(l.dados_originais->>'prazo', '')::date;
  exception when others then prazo := null; end;

  codigo_final := coalesce(l.dados_originais->>'codigo', '');
  titulo_final := nullif(btrim(l.dados_originais->>'titulo'), '');
  if titulo_final is null then
    titulo_final := case when coalesce(btrim(codigo_final), '') <> ''
      then 'Sem título (planilha) — código ' || btrim(codigo_final)
      else 'Sem título (planilha)' end;
  end if;

  status_planilha := nullif(btrim(l.dados_originais->>'status'), '');
  status_final := case
    when status_planilha in ('pendente','em_edicao','correcao','standby','entregue','descartado')
      then status_planilha
    else 'pendente'
  end;
  entregue := case when status_final = 'entregue' then now() else null end;

  prioridade_planilha := nullif(btrim(l.dados_originais->>'prioridade'), '');
  prioridade_final := case
    when prioridade_planilha ~* 'urgente' then 'urgente'
    when prioridade_planilha ~* 'alta' then 'alta'
    else 'normal'
  end;

  insert into public.demandas_edicao
    (client_id, competencia_ano, competencia_mes, codigo, titulo, pacote, prazo, observacoes,
     origem, import_lote_id, criado_por, editing_status, entregue_em, prioridade)
  values
    (l.cliente_id, ano, mes, codigo_final,
     titulo_final,
     coalesce(l.dados_originais->>'pacote', ''), prazo, coalesce(l.dados_originais->>'observacoes', ''),
     'importacao', l.lote_id, auth.uid(), status_final, entregue, prioridade_final)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', status_final, auth.uid(), ator.nome, ator.papel, 'Importada da planilha "' || coalesce(lote.nome_arquivo, '') || '"');

  update public.demandas_edicao_import_linhas set confirmada = true, demanda_id = novo where id = p_linha_id;

  return novo;
end;
$$;
revoke all on function public.video_import_confirmar_linha(uuid) from public;
grant execute on function public.video_import_confirmar_linha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- FIM — migration_video_producao.sql
-- ---------------------------------------------------------------------
