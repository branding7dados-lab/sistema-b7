/* =====================================================================
   B7 DESIGN — CENTRAL DE DESIGN
   Migração aditiva. Não recria nem apaga nada que já existe.

   Arquitetura (ver ESTADO_DO_SISTEMA.md / CORRECOES para o resumo):

     conteúdo canônico (conteudos)
       -> design_deliverables   (1 peça de produção visual por conteúdo+tipo)
            -> design_versoes    (V01, V02, V03… histórico real)
                 -> design_arquivos (prévia / produção / anexo / final)
            -> kanban_demandas   (mesmo quadro geral — tipo_vinculo='design_deliverable')
            -> eventos_dominio + notificacoes (mesma infra do Kanban/Aprovações)

   Aprovação do CLIENTE (futura, opcional) reaproveita a tabela
   `aprovacoes` já existente (tipo='design_versao'), não cria um segundo
   motor de aprovação.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. PAPEL "DESIGNER"
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'perfis_papel_valido') then
    alter table public.perfis drop constraint perfis_papel_valido;
  end if;
  alter table public.perfis add constraint perfis_papel_valido
    check (papel in ('admin', 'coordenador', 'designer', 'cliente'));
end $$;

/* sou_equipe() (admin/coordenador) continua controlando administração e
   decisões formais. sou_designer() e sou_equipe_interna() (qualquer
   funcionário: admin+coordenador+designer) são as novas checagens que o
   Design precisa — nenhuma política existente muda de sentido. */
create or replace function public.sou_designer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() = 'designer', false)
$$;
revoke all on function public.sou_designer() from public;
grant execute on function public.sou_designer() to authenticated;

create or replace function public.sou_equipe_interna()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer'), false)
$$;
revoke all on function public.sou_equipe_interna() from public;
grant execute on function public.sou_equipe_interna() to authenticated;

-- ---------------------------------------------------------------------
-- 2. PEQUENA EXTENSÃO NO CONTEÚDO CANÔNICO — "Necessita capa?"
--    Só se aplica a Reel. Opcional: null = não decidido/não se aplica.
-- ---------------------------------------------------------------------
alter table public.conteudos add column if not exists precisa_capa boolean;

-- ---------------------------------------------------------------------
-- 3. DESIGN DELIVERABLES — a peça de produção visual
-- ---------------------------------------------------------------------
create table if not exists public.design_deliverables (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clientes(id) on delete cascade,
  linha_id      uuid references public.linhas_editoriais(id) on delete set null,
  conteudo_id   uuid references public.conteudos(id) on delete set null,

  tipo          text not null default 'card',       -- card | capa_reel | carrossel | stories | outro
  titulo        text not null default '',

  designer_id   uuid references public.perfis(id) on delete set null,
  status        text not null default 'aguardando_producao',
  prazo         date,
  prioridade    text not null default 'normal',      -- normal | alta | urgente

  descricao     text not null default '',            -- briefing extra p/ demanda manual
  kanban_id     uuid references public.kanban_demandas(id) on delete set null,

  origem        text not null default 'linha',        -- linha | manual
  versao_atual  int not null default 0,

  criado_por    uuid references public.perfis(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finalizado_em timestamptz,
  deleted_at    timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_deliv_tipo_valido') then
    alter table public.design_deliverables add constraint design_deliv_tipo_valido
      check (tipo in ('card', 'capa_reel', 'carrossel', 'stories', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'design_deliv_status_valido') then
    alter table public.design_deliverables add constraint design_deliv_status_valido
      check (status in ('aguardando_producao', 'em_criacao', 'revisao_interna', 'ajustes',
                         'aprovado_interno', 'aguardando_cliente', 'ajustes_cliente',
                         'aprovado_cliente', 'finalizado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'design_deliv_prioridade_valida') then
    alter table public.design_deliverables add constraint design_deliv_prioridade_valida
      check (prioridade in ('normal', 'alta', 'urgente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'design_deliv_origem_valida') then
    alter table public.design_deliverables add constraint design_deliv_origem_valida
      check (origem in ('linha', 'manual'));
  end if;
end $$;

/* idempotência do "Enviar para Design": mesmo conteúdo + mesmo tipo não
   gera uma segunda peça. Demandas manuais (conteudo_id nulo) ficam fora
   dessa regra — cada uma é intencional. */
create unique index if not exists design_deliv_origem_unica
  on public.design_deliverables (conteudo_id, tipo)
  where deleted_at is null and conteudo_id is not null;

create index if not exists design_deliv_cliente   on public.design_deliverables (client_id) where deleted_at is null;
create index if not exists design_deliv_linha     on public.design_deliverables (linha_id) where deleted_at is null;
create index if not exists design_deliv_designer  on public.design_deliverables (designer_id, status) where deleted_at is null;
create index if not exists design_deliv_status    on public.design_deliverables (status) where deleted_at is null;
create index if not exists design_deliv_prazo     on public.design_deliverables (prazo) where deleted_at is null and prazo is not null;
create index if not exists design_deliv_kanban    on public.design_deliverables (kanban_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 4. DESIGN VERSÕES — V01, V02, V03…
-- ---------------------------------------------------------------------
create table if not exists public.design_versoes (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.design_deliverables(id) on delete cascade,
  numero         int not null,
  designer_id    uuid references public.perfis(id) on delete set null,

  estado         text not null default 'rascunho',   -- rascunho | enviada | ajuste_solicitado |
                                                       -- aprovada_interna | enviada_cliente |
                                                       -- ajuste_cliente | aprovada_cliente
  observacao     text not null default '',            -- observação do designer ao enviar

  enviada_em         timestamptz,
  aprovada_em         timestamptz,
  aprovada_por         uuid references public.perfis(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_versao_estado_valido') then
    alter table public.design_versoes add constraint design_versao_estado_valido
      check (estado in ('rascunho', 'enviada', 'ajuste_solicitado', 'aprovada_interna',
                         'enviada_cliente', 'ajuste_cliente', 'aprovada_cliente'));
  end if;
end $$;

create unique index if not exists design_versao_numero_unico
  on public.design_versoes (deliverable_id, numero);
create index if not exists design_versao_deliverable on public.design_versoes (deliverable_id, numero desc);

-- ---------------------------------------------------------------------
-- 5. DESIGN ARQUIVOS — prévia / produção / anexo / final
-- ---------------------------------------------------------------------
create table if not exists public.design_arquivos (
  id           uuid primary key default gen_random_uuid(),
  versao_id    uuid not null references public.design_versoes(id) on delete cascade,
  papel        text not null default 'preview',   -- preview | producao | anexo | final
  posicao      int not null default 0,

  nome_original text not null,
  caminho       text not null,      -- storage object path (bucket design-files)
  mime          text,
  tamanho_bytes bigint,

  enviado_por  uuid references public.perfis(id) on delete set null,
  created_at   timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_arquivo_papel_valido') then
    alter table public.design_arquivos add constraint design_arquivo_papel_valido
      check (papel in ('preview', 'producao', 'anexo', 'final'));
  end if;
end $$;

create index if not exists design_arquivo_versao on public.design_arquivos (versao_id, papel, posicao);
create unique index if not exists design_arquivo_caminho_unico on public.design_arquivos (caminho);

-- ---------------------------------------------------------------------
-- 6. VÍNCULOS DO KANBAN E DA APROVAÇÃO
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'kanban_vinculo_valido') then
    alter table public.kanban_demandas drop constraint kanban_vinculo_valido;
  end if;
  alter table public.kanban_demandas add constraint kanban_vinculo_valido
    check (tipo_vinculo is null or
           tipo_vinculo in ('roteiro', 'conteudo', 'gravacao', 'linha', 'avulsa', 'design_deliverable'));
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'aprovacoes_tipo_valido') then
    alter table public.aprovacoes drop constraint aprovacoes_tipo_valido;
  end if;
  alter table public.aprovacoes add constraint aprovacoes_tipo_valido
    check (tipo in ('roteiro', 'linha', 'conteudo', 'semana', 'design_versao'));
end $$;

-- ---------------------------------------------------------------------
-- 7. STORAGE — bucket privado para arquivos de Design
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
  values ('design-files', 'design-files', false, null)
  on conflict (id) do nothing;

/* Quem pode enxergar/gravar em um caminho? O caminho começa sempre com
   o id da peça: "<deliverable_id>/<versao_id>/<arquivo>". A função abaixo
   é a mesma usada pelas políticas da tabela e do Storage — um único
   lugar decide "isto é meu / da minha equipe". */
create or replace function public.design_pode_acessar(p_deliverable_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.design_deliverables d
     where d.id = p_deliverable_id
       and d.deleted_at is null
       and (
         public.sou_equipe()
         or d.designer_id = auth.uid()
       )
  )
$$;
revoke all on function public.design_pode_acessar(uuid) from public;
grant execute on function public.design_pode_acessar(uuid) to authenticated;

drop policy if exists "design-files select" on storage.objects;
create policy "design-files select" on storage.objects
  for select to authenticated
  using (bucket_id = 'design-files' and public.design_pode_acessar((storage.foldername(name))[1]::uuid));

drop policy if exists "design-files insert" on storage.objects;
create policy "design-files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'design-files' and public.design_pode_acessar((storage.foldername(name))[1]::uuid));

drop policy if exists "design-files delete" on storage.objects;
create policy "design-files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'design-files' and public.sou_equipe());

-- ---------------------------------------------------------------------
-- 8. RLS DAS TABELAS — leitura filtrada por política; toda escrita passa
--    pelas funções security definer abaixo (mesmo padrão de Aprovações).
-- ---------------------------------------------------------------------
alter table public.design_deliverables enable row level security;
alter table public.design_versoes      enable row level security;
alter table public.design_arquivos     enable row level security;

revoke insert, update, delete on public.design_deliverables from authenticated;
revoke insert, update, delete on public.design_versoes      from authenticated;
revoke insert, update, delete on public.design_arquivos     from authenticated;
grant select on public.design_deliverables to authenticated;
grant select on public.design_versoes      to authenticated;
grant select on public.design_arquivos     to authenticated;

drop policy if exists "design_deliv select" on public.design_deliverables;
create policy "design_deliv select" on public.design_deliverables
  for select to authenticated
  using (deleted_at is null and (public.sou_equipe() or designer_id = auth.uid() or designer_id is null) and public.sou_equipe_interna());

drop policy if exists "design_versao select" on public.design_versoes;
create policy "design_versao select" on public.design_versoes
  for select to authenticated
  using (exists (select 1 from public.design_deliverables d
                  where d.id = deliverable_id and d.deleted_at is null
                    and (public.sou_equipe() or d.designer_id = auth.uid() or d.designer_id is null)
                    and public.sou_equipe_interna()));

drop policy if exists "design_arquivo select" on public.design_arquivos;
create policy "design_arquivo select" on public.design_arquivos
  for select to authenticated
  using (exists (select 1 from public.design_versoes v join public.design_deliverables d on d.id = v.deliverable_id
                  where v.id = versao_id and d.deleted_at is null
                    and (public.sou_equipe() or d.designer_id = auth.uid() or d.designer_id is null)
                    and public.sou_equipe_interna()));

-- ---------------------------------------------------------------------
-- 9. GERAÇÃO A PARTIR DA LINHA EDITORIAL — "Enviar para Design"
--    Idempotente: reaproveita a peça já existente (índice único acima).
-- ---------------------------------------------------------------------
create or replace function public.design_tipo_para_conteudo(p_tipo_conteudo text, p_precisa_capa boolean)
returns text language sql immutable as $$
  select case p_tipo_conteudo
    when 'Card'      then 'card'
    when 'Carrossel' then 'carrossel'
    when 'Story'     then 'stories'
    when 'Reel'      then case when coalesce(p_precisa_capa, false) then 'capa_reel' else null end
    else null
  end
$$;

create or replace function public.design_gerar_do_conteudo(p_conteudo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.conteudos%rowtype;
  l public.linhas_editoriais%rowtype;
  tipo_design text;
  existente uuid;
  criado boolean := false;
  ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe envia conteúdo para Design.' using errcode = '42501';
  end if;

  select * into c from public.conteudos where id = p_conteudo_id and deleted_at is null;
  if not found then raise exception 'Conteúdo não encontrado.' using errcode = 'P0002'; end if;

  tipo_design := public.design_tipo_para_conteudo(c.tipo, c.precisa_capa);
  if tipo_design is null then
    return jsonb_build_object('criada', false, 'motivo', 'sem_requisito_visual');
  end if;

  select id into existente from public.design_deliverables
   where conteudo_id = c.id and tipo = tipo_design and deleted_at is null;

  if existente is not null then
    return jsonb_build_object('criada', false, 'deliverable_id', existente, 'motivo', 'ja_existia');
  end if;

  select * into l from public.linhas_editoriais where id = c.linha_id;
  select * into ator from public.perfis where id = auth.uid();

  insert into public.design_deliverables
    (client_id, linha_id, conteudo_id, tipo, titulo, origem, criado_por)
  values
    (c.client_id, c.linha_id, c.id, tipo_design,
     coalesce(nullif(c.titulo, ''), nullif(c.headline, ''), 'Peça de Design'),
     'linha', auth.uid())
  returning id into existente;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.criada', 'design.criada:' || existente,
          'design_deliverable', existente, c.client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('titulo', c.titulo, 'tipo', tipo_design));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.criada:' || existente));

  return jsonb_build_object('criada', true, 'deliverable_id', existente);
end;
$$;
revoke all on function public.design_gerar_do_conteudo(uuid) from public;
grant execute on function public.design_gerar_do_conteudo(uuid) to authenticated;

create or replace function public.design_gerar_da_linha(p_linha_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  n_criadas int := 0;
  n_existentes int := 0;
  n_sem_requisito int := 0;
  resultado jsonb;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe envia a linha para Design.' using errcode = '42501';
  end if;

  for r in select id from public.conteudos where linha_id = p_linha_id and deleted_at is null
  loop
    resultado := public.design_gerar_do_conteudo(r.id);
    if (resultado->>'criada')::boolean then
      n_criadas := n_criadas + 1;
    elsif resultado->>'motivo' = 'ja_existia' then
      n_existentes := n_existentes + 1;
    else
      n_sem_requisito := n_sem_requisito + 1;
    end if;
  end loop;

  return jsonb_build_object('criadas', n_criadas, 'existentes', n_existentes, 'sem_requisito', n_sem_requisito);
end;
$$;
revoke all on function public.design_gerar_da_linha(uuid) from public;
grant execute on function public.design_gerar_da_linha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. DEMANDA MANUAL DE DESIGN
-- ---------------------------------------------------------------------
create or replace function public.design_criar_manual(
  p_titulo text, p_client_id uuid default null, p_tipo text default 'outro',
  p_descricao text default '', p_designer_id uuid default null,
  p_prazo date default null, p_prioridade text default 'normal'
) returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid; ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe cria demandas de Design.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'Toda demanda de Design precisa de um título.';
  end if;
  select * into ator from public.perfis where id = auth.uid();

  insert into public.design_deliverables
    (client_id, tipo, titulo, descricao, designer_id, prazo, prioridade, origem, criado_por, status)
  values
    (p_client_id, coalesce(p_tipo, 'outro'), p_titulo, coalesce(p_descricao, ''), p_designer_id,
     p_prazo, coalesce(p_prioridade, 'normal'), 'manual', auth.uid(),
     case when p_designer_id is not null then 'em_criacao' else 'aguardando_producao' end)
  returning id into novo;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.criada', 'design.criada:' || novo, 'design_deliverable', novo, p_client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('titulo', p_titulo, 'manual', true));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.criada:' || novo));

  return novo;
end;
$$;
revoke all on function public.design_criar_manual(text, uuid, text, text, uuid, date, text) from public;
grant execute on function public.design_criar_manual(text, uuid, text, text, uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. ATRIBUIÇÃO
-- ---------------------------------------------------------------------
create or replace function public.design_atribuir(p_deliverable_id uuid, p_designer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.design_deliverables%rowtype; ator public.perfis%rowtype; alvo public.perfis%rowtype;
begin
  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;

  if p_designer_id is not null then
    select * into alvo from public.perfis where id = p_designer_id and estado = 'ativa';
    if not found or alvo.papel not in ('designer', 'admin', 'coordenador') then
      raise exception 'Responsável inválido.';
    end if;
  end if;

  if not (public.sou_equipe() or (public.sou_designer() and d.designer_id is null and p_designer_id = auth.uid())) then
    raise exception 'Sem permissão para atribuir esta peça.' using errcode = '42501';
  end if;

  select * into ator from public.perfis where id = auth.uid();

  update public.design_deliverables
     set designer_id = p_designer_id, updated_at = now(),
         status = case when status = 'aguardando_producao' and p_designer_id is not null then 'em_criacao' else status end
   where id = d.id;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.atribuida', 'design.atribuida:' || d.id || ':' || now()::text,
          'design_deliverable', d.id, d.client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('designer_id', p_designer_id, 'designer_nome', alvo.nome, 'anterior', d.designer_id));
  perform public.design_processar_evento((select id from public.eventos_dominio
    where chave = 'design.atribuida:' || d.id || ':' || now()::text order by created_at desc limit 1));

  if d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_designer_id, updated_at = now() where id = d.kanban_id;
  end if;
end;
$$;
revoke all on function public.design_atribuir(uuid, uuid) from public;
grant execute on function public.design_atribuir(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 12. PRAZO E PRIORIDADE
-- ---------------------------------------------------------------------
create or replace function public.design_definir_prazo_prioridade(p_deliverable_id uuid, p_prazo date, p_prioridade text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.design_deliverables%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;
  if p_prioridade not in ('normal', 'alta', 'urgente') then raise exception 'Prioridade inválida.'; end if;

  update public.design_deliverables
     set prazo = p_prazo, prioridade = p_prioridade, updated_at = now()
   where id = d.id;
end;
$$;
revoke all on function public.design_definir_prazo_prioridade(uuid, date, text) from public;
grant execute on function public.design_definir_prazo_prioridade(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 13. VERSÃO — criar rascunho, registrar arquivo, enviar para revisão
-- ---------------------------------------------------------------------
create or replace function public.design_versao_rascunho(p_deliverable_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.design_deliverables%rowtype; v_id uuid; prox int;
begin
  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para editar esta peça.' using errcode = '42501';
  end if;

  select id into v_id from public.design_versoes
   where deliverable_id = d.id and estado = 'rascunho'
   order by numero desc limit 1;
  if v_id is not null then return v_id; end if;

  select coalesce(max(numero), 0) + 1 into prox from public.design_versoes where deliverable_id = d.id;
  insert into public.design_versoes (deliverable_id, numero, designer_id, estado)
  values (d.id, prox, coalesce(d.designer_id, auth.uid()), 'rascunho')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.design_versao_rascunho(uuid) from public;
grant execute on function public.design_versao_rascunho(uuid) to authenticated;

create or replace function public.design_arquivo_registrar(
  p_versao_id uuid, p_papel text, p_nome text, p_caminho text, p_mime text, p_tamanho bigint
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; novo uuid; pos int;
begin
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para enviar arquivos nesta peça.' using errcode = '42501';
  end if;
  if v.estado not in ('rascunho') then
    raise exception 'Esta versão já foi enviada; crie uma nova versão para novos arquivos.';
  end if;
  if p_papel not in ('preview', 'producao', 'anexo', 'final') then
    raise exception 'Papel de arquivo inválido.';
  end if;

  select coalesce(max(posicao), -1) + 1 into pos from public.design_arquivos where versao_id = v.id and papel = p_papel;

  insert into public.design_arquivos (versao_id, papel, posicao, nome_original, caminho, mime, tamanho_bytes, enviado_por)
  values (v.id, p_papel, pos, p_nome, p_caminho, p_mime, p_tamanho, auth.uid())
  returning id into novo;

  return novo;
end;
$$;
revoke all on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint) from public;
grant execute on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint) to authenticated;

create or replace function public.design_versao_enviar(p_versao_id uuid, p_observacao text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
        qtd_arquivos int; k uuid;
begin
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para enviar esta peça para revisão.' using errcode = '42501';
  end if;
  if v.estado <> 'rascunho' then
    raise exception 'Esta versão já foi enviada.';
  end if;

  select count(*) into qtd_arquivos from public.design_arquivos where versao_id = v.id;
  if qtd_arquivos = 0 then
    raise exception 'Envie ao menos um arquivo antes de mandar para revisão interna.';
  end if;

  select * into ator from public.perfis where id = auth.uid();

  update public.design_versoes
     set estado = 'enviada', observacao = coalesce(p_observacao, ''), enviada_em = now(), updated_at = now()
   where id = v.id;

  update public.design_deliverables
     set status = 'revisao_interna', versao_atual = v.numero, updated_at = now()
   where id = d.id;

  -- garante a linha correspondente no Kanban geral (não cria um segundo quadro)
  if d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'revisao', d.client_id, 'design_deliverable', d.id, 'design', d.designer_id, d.prazo, auth.uid(), 'design.versao_enviada')
    returning id into k;
    update public.design_deliverables set kanban_id = k where id = d.id;
  else
    update public.kanban_demandas set coluna = 'revisao', origem_evento = 'design.versao_enviada', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.versao_enviada', 'design.versao_enviada:' || v.id, 'design_deliverable', d.id, v.numero, d.client_id,
          auth.uid(), ator.nome, ator.papel, jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'titulo', d.titulo));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.versao_enviada:' || v.id));
end;
$$;
revoke all on function public.design_versao_enviar(uuid, text) from public;
grant execute on function public.design_versao_enviar(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 14. REVISÃO INTERNA — aprovar ou pedir ajuste
-- ---------------------------------------------------------------------
create or replace function public.design_solicitar_ajuste(p_versao_id uuid, p_mensagem text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe pode solicitar ajuste interno.' using errcode = '42501'; end if;
  if coalesce(btrim(p_mensagem), '') = '' then raise exception 'Descreva o ajuste solicitado.'; end if;

  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'enviada' then raise exception 'Esta versão não está em revisão interna.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  select * into ator from public.perfis where id = auth.uid();

  update public.design_versoes set estado = 'ajuste_solicitado', updated_at = now() where id = v.id;
  update public.design_deliverables set status = 'ajustes', updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'ajustes', origem_evento = 'design.ajuste_solicitado', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.ajuste_solicitado', 'design.ajuste_solicitado:' || v.id || ':' || now()::text, 'design_deliverable', d.id, v.numero,
          d.client_id, auth.uid(), ator.nome, ator.papel, jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'mensagem', p_mensagem, 'titulo', d.titulo));
  perform public.design_processar_evento((select id from public.eventos_dominio
    where chave = 'design.ajuste_solicitado:' || v.id || ':' || now()::text order by created_at desc limit 1));
end;
$$;
revoke all on function public.design_solicitar_ajuste(uuid, text) from public;
grant execute on function public.design_solicitar_ajuste(uuid, text) to authenticated;

create or replace function public.design_aprovar_interno(p_versao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe aprova internamente.' using errcode = '42501'; end if;

  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'enviada' then raise exception 'Esta versão não está aguardando revisão interna.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  select * into ator from public.perfis where id = auth.uid();

  update public.design_versoes
     set estado = 'aprovada_interna', aprovada_em = now(), aprovada_por = auth.uid(), updated_at = now()
   where id = v.id;
  update public.design_deliverables set status = 'aprovado_interno', updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'pronto', origem_evento = 'design.aprovado_interno', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.aprovado_interno', 'design.aprovado_interno:' || v.id, 'design_deliverable', d.id, v.numero,
          d.client_id, auth.uid(), ator.nome, ator.papel, jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'titulo', d.titulo));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.aprovado_interno:' || v.id));
end;
$$;
revoke all on function public.design_aprovar_interno(uuid) from public;
grant execute on function public.design_aprovar_interno(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 15. FINALIZAÇÃO
-- ---------------------------------------------------------------------
create or replace function public.design_finalizar(p_deliverable_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.design_deliverables%rowtype; ator public.perfis%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe finaliza a peça.' using errcode = '42501'; end if;
  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;
  if d.status not in ('aprovado_interno', 'aprovado_cliente') then
    raise exception 'Só é possível finalizar depois da aprovação.';
  end if;
  select * into ator from public.perfis where id = auth.uid();

  update public.design_deliverables set status = 'finalizado', finalizado_em = now(), updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'concluida', concluida_em = now(), updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.finalizado', 'design.finalizado:' || d.id, 'design_deliverable', d.id, d.client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('titulo', d.titulo));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.finalizado:' || d.id));
end;
$$;
revoke all on function public.design_finalizar(uuid) from public;
grant execute on function public.design_finalizar(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 16. FUTURO — enviar a versão internamente aprovada para o cliente
--     (reaproveita `aprovacoes`; não força nada: ação intencional).
-- ---------------------------------------------------------------------
create or replace function public.design_enviar_cliente(p_versao_id uuid, p_observacao text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
        arquivos jsonb; prox_versao int; nova uuid;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe envia para aprovação do cliente.' using errcode = '42501'; end if;
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'aprovada_interna' then raise exception 'Só uma versão aprovada internamente pode ir ao cliente.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  if d.client_id is null then raise exception 'Esta peça não está vinculada a um cliente.'; end if;
  select * into ator from public.perfis where id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object('nome', nome_original, 'caminho', caminho, 'papel', papel) order by posicao), '[]'::jsonb)
    into arquivos from public.design_arquivos where versao_id = v.id and papel in ('preview', 'final');

  select coalesce(max(versao), 0) + 1 into prox_versao from public.aprovacoes where tipo = 'design_versao' and alvo_id = d.id;

  insert into public.aprovacoes (client_id, tipo, alvo_id, versao, snapshot, situacao, enviado_por, observacao_envio)
  values (d.client_id, 'design_versao', d.id, prox_versao,
          jsonb_build_object('titulo', d.titulo, 'design_versao_id', v.id, 'numero', v.numero, 'arquivos', arquivos),
          'pendente', auth.uid(), coalesce(p_observacao, ''))
  returning id into nova;

  update public.design_versoes set estado = 'enviada_cliente', updated_at = now() where id = v.id;
  update public.design_deliverables set status = 'aguardando_cliente', updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'aguardando_cliente', origem_evento = 'design.enviado_cliente', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, aprovacao_id, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('aprovacao.enviada', 'aprovacao.enviada:' || nova, nova, 'design_versao', d.id, prox_versao, d.client_id, auth.uid(), ator.nome, ator.papel, '{}'::jsonb);
  perform public.aprov_processar_evento((select id from public.eventos_dominio where chave = 'aprovacao.enviada:' || nova));

  return nova;
end;
$$;
revoke all on function public.design_enviar_cliente(uuid, text) from public;
grant execute on function public.design_enviar_cliente(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 17. NOTIFICAÇÕES — mesmo padrão de aprov_processar_evento, mas para
--     eventos internos de Design (não passam pela tabela `aprovacoes`).
-- ---------------------------------------------------------------------
create or replace function public.design_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.design_deliverables%rowtype;
  tit text; msg text; link text;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;
  if ev.alvo_tipo <> 'design_deliverable' then
    update public.eventos_dominio set processado_em = now() where id = ev.id;
    return;
  end if;

  select * into d from public.design_deliverables where id = ev.alvo_id;
  if not found then
    update public.eventos_dominio set processado_em = now(), erro = 'peça de Design não encontrada' where id = ev.id;
    return;
  end if;

  link := '#/design/' || d.id;

  if ev.tipo = 'design.criada' then
    tit := 'Nova peça de Design: ' || coalesce(ev.payload->>'titulo', d.titulo);
    msg := null;
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, msg, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'design.atribuida' and ev.payload->>'designer_id' is not null then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' atribuiu "' || d.titulo || '" a ' || coalesce(ev.payload->>'designer_nome', 'um designer');
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    values (ev.id, (ev.payload->>'designer_id')::uuid, d.client_id, ev.tipo, tit, null, link)
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'design.versao_enviada' then
    tit := coalesce(ev.ator_nome, 'O designer') || ' enviou a V' || lpad(ev.versao::text, 2, '0') || ' de "' || d.titulo || '" para revisão';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'design.ajuste_solicitado' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' solicitou ajuste em "' || d.titulo || '" (V' || lpad((ev.payload->>'numero'), 2, '0') || ')';
    msg := ev.payload->>'mensagem';
    if d.designer_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.designer_id, d.client_id, ev.tipo, tit, msg, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'design.aprovado_interno' then
    tit := '"' || d.titulo || '" foi aprovada internamente (V' || lpad((ev.payload->>'numero'), 2, '0') || ')';
    if d.designer_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.designer_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'design.finalizado' then
    tit := '"' || d.titulo || '" foi finalizada';
    if d.designer_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.designer_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.design_processar_evento(uuid) from public;
grant execute on function public.design_processar_evento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 18. VIEWS — leitura pronta para a fila, a equipe e a Linha Editorial
--     security_invoker = true: a RLS das tabelas de base continua valendo.
-- ---------------------------------------------------------------------
create or replace view public.design_resumo
with (security_invoker = true) as
select
  d.id, d.client_id, cl.nome as cliente_nome, d.linha_id, le.nome as linha_nome,
  d.conteudo_id, co.titulo as conteudo_titulo, co.tipo as conteudo_tipo, co.pilar_id,
  d.tipo, d.titulo, d.designer_id, pf.nome as designer_nome, pf.avatar_url as designer_avatar,
  d.status, d.prazo, d.prioridade, d.origem, d.versao_atual, d.kanban_id,
  d.created_at, d.updated_at, d.finalizado_em,
  (select v.numero from public.design_versoes v where v.deliverable_id = d.id order by v.numero desc limit 1) as ultima_versao,
  (select v.estado from public.design_versoes v where v.deliverable_id = d.id order by v.numero desc limit 1) as ultima_versao_estado,
  (select a.caminho from public.design_arquivos a
     join public.design_versoes v on v.id = a.versao_id
    where v.deliverable_id = d.id and a.papel = 'preview'
    order by v.numero desc, a.posicao asc limit 1) as ultima_previa
from public.design_deliverables d
left join public.clientes cl on cl.id = d.client_id
left join public.linhas_editoriais le on le.id = d.linha_id
left join public.conteudos co on co.id = d.conteudo_id
left join public.perfis pf on pf.id = d.designer_id
where d.deleted_at is null;

create or replace view public.design_producao_linha
with (security_invoker = true) as
select linha_id,
  count(*) as total,
  count(*) filter (where status = 'aguardando_producao') as aguardando,
  count(*) filter (where status = 'em_criacao') as em_criacao,
  count(*) filter (where status = 'revisao_interna') as em_revisao,
  count(*) filter (where status = 'ajustes') as em_ajustes,
  count(*) filter (where status in ('aprovado_interno', 'aprovado_cliente')) as aprovadas,
  count(*) filter (where status = 'finalizado') as finalizadas
from public.design_deliverables
where deleted_at is null and linha_id is not null
group by linha_id;

grant select on public.design_resumo to authenticated;
grant select on public.design_producao_linha to authenticated;

-- ---------------------------------------------------------------------
-- 19. LEITURA DA LINHA EDITORIAL PARA O DESIGNER (o briefing)
--     migration_rls.sql protege conteudos/linhas_editoriais/slides/
--     frames/roteiros/cenas/pilares/clientes com políticas "for all"
--     restritas a sou_equipe() — Designer não estava nesse grupo e por
--     isso não enxergava nada da Linha Editorial. Aqui entra só uma
--     política adicional DE LEITURA (nunca escrita: as políticas
--     "for all" existentes continuam controlando insert/update/delete).
--     Sem isso o Designer não consegue ver o próprio briefing.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes', 'linhas_editoriais', 'conteudos', 'slides', 'frames',
                           'roteiros', 'cenas', 'pilares']
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format($f$
        drop policy if exists %I on public.%I
      $f$, t || '_design_leitura', t);
      execute format($f$
        create policy %I on public.%I for select to authenticated
          using (public.sou_designer())
      $f$, t || '_design_leitura', t);
    end if;
  end loop;
end $$;
