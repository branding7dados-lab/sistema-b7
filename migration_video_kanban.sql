/* =====================================================================
   B7 VÍDEO — FECHAMENTO DA PARTE 1: sincronização opcional com o Kanban
   geral. Migração aditiva, roda depois de migration_video.sql.

   Mesmo padrão de design_deliverables.kanban_id (migration_design.sql):
   a Demanda de Edição NÃO duplica o Kanban geral — ela só ganha uma
   "sombra" (kanban_id) lá, criada de forma preguiçosa quando o
   trabalho de verdade começa (situação vira "em_edicao"), não no
   momento em que a demanda nasce. Enquanto ninguém começou a editar,
   não existe card nenhum no Kanban — decisão consciente para não
   poluir o quadro geral com toda demanda pendente de planilha.

   Depois de criado, o card só acompanha: correção → coluna "ajustes",
   entregue → coluna "pronto", descartado → arquivado. "Standby" e
   "pendente" não têm coluna correspondente no Kanban geral (que não
   tem conceito de standby) — o card simplesmente não se move nesses
   casos, mesma lógica de "menos é mais" que o Design já usa (nem toda
   situação interna vira uma coluna nova no quadro geral).
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. COLUNA DE VÍNCULO COM O KANBAN
-- ---------------------------------------------------------------------
alter table public.demandas_edicao add column if not exists kanban_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demandas_edicao_kanban_fk') then
    alter table public.demandas_edicao
      add constraint demandas_edicao_kanban_fk
      foreign key (kanban_id) references public.kanban_demandas(id) on delete set null;
  end if;
end $$;
create index if not exists demandas_edicao_kanban on public.demandas_edicao (kanban_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. "demanda_edicao" vira um tipo de vínculo válido no Kanban geral
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'kanban_vinculo_valido') then
    alter table public.kanban_demandas drop constraint kanban_vinculo_valido;
  end if;
  alter table public.kanban_demandas add constraint kanban_vinculo_valido
    check (tipo_vinculo is null or
           tipo_vinculo in ('roteiro', 'conteudo', 'gravacao', 'linha', 'avulsa', 'design_deliverable', 'demanda_edicao'));
end $$;

-- ---------------------------------------------------------------------
-- 3. view atualizada expõe kanban_id (útil para a UI abrir o card, se
--    algum dia precisar — nesta Parte 1 a UI não abre o Kanban a
--    partir daqui, só existe o vínculo no banco).
-- ---------------------------------------------------------------------
/* colunas explícitas (não `de.*`): `kanban_id` foi adicionada à tabela
   por ALTER TABLE, então fica no fim da ordem física — se a view
   usasse `de.*` ela entraria ANTES de cliente_nome/etc. no SELECT,
   o que o Postgres recusa em "create or replace view" (só aceita
   coluna nova no fim da lista). Explicitando, kanban_id vai para o
   fim de propósito. */
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
  de.kanban_id
from public.demandas_edicao de
left join public.clientes cl on cl.id = de.client_id
left join public.perfis pf on pf.id = de.videomaker_id
left join public.gravacoes g on g.id = de.gravacao_id
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 4. ATRIBUIÇÃO passa a espelhar o responsável no card, se já existir
-- ---------------------------------------------------------------------
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
    select * into vm from public.perfis where id = p_videomaker_id and papel = 'videomaker' and estado = 'ativa';
    if not found then raise exception 'Esse usuário não é um videomaker ativo.'; end if;
  end if;
  select * into ator from public.perfis where id = auth.uid();
  vira_em_edicao := p_videomaker_id is not null and d.editing_status = 'pendente';

  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now(),
         editing_status = case when vira_em_edicao then 'em_edicao' else editing_status end
   where id = p_demanda_id;

  /* mesma sombra preguiçosa de video_mudar_status: atribuir alguém a
     uma demanda pendente também conta como "o trabalho começou". */
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
-- 5. MUDANÇA DE SITUAÇÃO passa a criar/atualizar a sombra no Kanban
-- ---------------------------------------------------------------------
create or replace function public.video_mudar_status(p_demanda_id uuid, p_status text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; evid uuid; de_status text; k uuid;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para mudar esta demanda.' using errcode = '42501';
  end if;
  if p_status not in ('pendente', 'em_edicao', 'correcao', 'standby', 'entregue', 'descartado') then
    raise exception 'Situação inválida.';
  end if;
  select * into ator from public.perfis where id = auth.uid();
  de_status := d.editing_status;

  update public.demandas_edicao
     set editing_status = p_status, updated_at = now(),
         entregue_em = case when p_status = 'entregue' then now() else entregue_em end
   where id = p_demanda_id;

  /* sombra no Kanban geral: nasce só quando o trabalho de verdade
     começa (evita poluir o quadro com toda demanda ainda pendente de
     planilha); depois disso só acompanha as transições que têm coluna
     correspondente. */
  if p_status = 'em_edicao' and d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'producao', d.client_id, 'demanda_edicao', d.id, 'video', d.videomaker_id, d.prazo, auth.uid(), 'video.em_edicao')
    returning id into k;
    update public.demandas_edicao set kanban_id = k where id = p_demanda_id;
  elsif d.kanban_id is not null then
    if p_status = 'em_edicao' then
      update public.kanban_demandas set coluna = 'producao', origem_evento = 'video.em_edicao', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'correcao' then
      update public.kanban_demandas set coluna = 'ajustes', origem_evento = 'video.correcao_solicitada', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'entregue' then
      update public.kanban_demandas set coluna = 'pronto', origem_evento = 'video.entregue', updated_at = now() where id = d.kanban_id;
    elsif p_status = 'descartado' then
      update public.kanban_demandas set arquivada_em = now(), updated_at = now() where id = d.kanban_id;
    end if;
    -- 'pendente' e 'standby' não têm coluna correspondente: o card não se move.
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'status', de_status, p_status, auth.uid(), ator.nome, ator.papel, p_mensagem);

  if p_status = 'entregue' then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.entregue', 'video.entregue:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  elsif p_status = 'correcao' and public.sou_equipe() and d.videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.correcao_solicitada', 'video.correcao_solicitada:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('titulo', d.titulo, 'mensagem', p_mensagem))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_mudar_status(uuid, text, text) from public;
grant execute on function public.video_mudar_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. GRAVAÇÃO já podia ser vinculada por baixo (gravacao_id existe
--    desde migration_video.sql) — video_criar_demanda e
--    video_editar_demanda ganham o parâmetro de verdade agora que a
--    interface (Central do Videomaker) oferece o seletor.
-- ---------------------------------------------------------------------
create or replace function public.video_editar_demanda(
  p_demanda_id uuid, p_titulo text default null, p_codigo text default null,
  p_pacote text default null, p_prazo date default null, p_tem_prazo boolean default false,
  p_observacoes text default null, p_gravacao_id uuid default null, p_tem_gravacao boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe edita os dados da demanda.' using errcode = '42501';
  end if;
  if p_tem_gravacao and p_gravacao_id is not null and not exists (select 1 from public.gravacoes where id = p_gravacao_id) then
    raise exception 'Gravação inválida.';
  end if;
  update public.demandas_edicao set
    titulo = coalesce(p_titulo, titulo),
    codigo = coalesce(p_codigo, codigo),
    pacote = coalesce(p_pacote, pacote),
    prazo = case when p_tem_prazo then p_prazo else prazo end,
    observacoes = coalesce(p_observacoes, observacoes),
    gravacao_id = case when p_tem_gravacao then p_gravacao_id else gravacao_id end,
    updated_at = now()
  where id = p_demanda_id and deleted_at is null;
end;
$$;
revoke all on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text, uuid, boolean) from public;
grant execute on function public.video_editar_demanda(uuid, text, text, text, date, boolean, text, uuid, boolean) to authenticated;

-- a assinatura antiga (sem gravação) deixa de existir — nenhuma outra
-- função ou lugar do sistema a chamava, só js/database.js, que este
-- mesmo build já atualiza para a nova assinatura.
drop function if exists public.video_editar_demanda(uuid, text, text, text, date, boolean, text);

-- ---------------------------------------------------------------------
-- FIM — migration_video_kanban.sql
-- ---------------------------------------------------------------------
