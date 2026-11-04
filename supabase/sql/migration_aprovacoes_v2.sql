-- =====================================================================
-- APROVAÇÕES v2 — decisões transacionais, eventos, notificações e Kanban
--
-- Rode DEPOIS de migration_fix.sql. Aditiva e idempotente. Funciona
-- antes e depois do corte do RLS.
--
-- O que muda e por quê:
--
--  • A decisão do cliente deixa de ser um UPDATE feito pelo navegador e
--    passa a ser uma FUNÇÃO no banco (aprov_decidir, aprov_decidir_parte,
--    aprov_enviar). A função tranca a aprovação, confere quem está
--    decidindo, recusa versão encerrada, ignora comando repetido e, na
--    MESMA transação, grava o evento, as notificações e a projeção no
--    Kanban. Se qualquer parte falhar, nada fica pela metade.
--
--  • Idempotência: repetir a mesma decisão (clique duplo, retry de rede,
--    aba antiga) devolve o resultado existente sem novo evento, nova
--    notificação ou novo movimento no quadro.
--
--  • Estados da aprovação: pendente · parcial (alguma cena decidida) ·
--    aprovado · ajustes · recusado · substituido (nova versão enviada) ·
--    cancelado. "Recusado" é decisão explícita com motivo obrigatório;
--    "ajustes" é pedido de correção. Nenhum deles mexe no status de
--    produção do roteiro, na situação da gravação nem no serviço do
--    cliente.
--
--  • eventos_dominio: registro durável de cada evento de negócio, com
--    chave de idempotência e resultado do processamento (reprocessável).
--
--  • notificacoes: uma por (evento, destinatário) — a unicidade impede
--    duplicata por retry. Lidas/não lidas por pessoa.
--
--  • kanban_demandas: ganha vínculo com a aprovação e trava manual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ESTADOS
-- ---------------------------------------------------------------------
alter table public.aprovacoes drop constraint if exists aprovacoes_situacao_valida;
alter table public.aprovacoes add constraint aprovacoes_situacao_valida
  check (situacao in ('pendente', 'parcial', 'aprovado', 'ajustes', 'recusado',
                      'substituido', 'cancelado'));

alter table public.aprovacoes add column if not exists motivo text;
alter table public.aprovacoes add column if not exists decidido_por_nome text;
alter table public.aprovacoes add column if not exists enviado_por_nome text;
alter table public.aprovacoes add column if not exists substituida_por uuid references public.aprovacoes(id);

update public.aprovacao_partes set situacao = 'aprovada' where situacao = 'aprovado';
alter table public.aprovacao_partes drop constraint if exists aprovacao_partes_situacao_valida;
alter table public.aprovacao_partes add constraint aprovacao_partes_situacao_valida
  check (situacao in ('pendente', 'aprovada', 'ajustes'));
alter table public.aprovacao_partes add column if not exists decidido_por_nome text;
alter table public.aprovacao_partes add column if not exists updated_at timestamptz default now();

alter table public.kanban_demandas add column if not exists aprovacao_id uuid references public.aprovacoes(id) on delete set null;
alter table public.kanban_demandas add column if not exists aprovacao_situacao text;
alter table public.kanban_demandas add column if not exists automacao_travada boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. EVENTOS DE DOMÍNIO (outbox durável)
-- ---------------------------------------------------------------------
create table if not exists public.eventos_dominio (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                 -- aprovacao.enviada | aprovacao.aprovada | aprovacao.ajustes |
                                      -- aprovacao.recusada | parte.aprovada | parte.ajustes
  chave text not null unique,         -- idempotência: o mesmo fato nunca entra duas vezes
  aprovacao_id uuid references public.aprovacoes(id) on delete set null,
  client_id uuid references public.clientes(id) on delete set null,
  alvo_tipo text,
  alvo_id uuid,
  versao int,
  ator_id uuid,
  ator_nome text,
  ator_papel text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processado_em timestamptz,
  erro text,
  tentativas int not null default 0
);
create index if not exists eventos_dominio_aprovacao on public.eventos_dominio (aprovacao_id, created_at desc);
create index if not exists eventos_dominio_pendentes on public.eventos_dominio (created_at) where processado_em is null;

-- ---------------------------------------------------------------------
-- 3. NOTIFICAÇÕES
-- ---------------------------------------------------------------------
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_dominio(id) on delete cascade,
  destinatario_id uuid not null references public.perfis(id) on delete cascade,
  client_id uuid references public.clientes(id) on delete set null,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link text,
  lida_em timestamptz,
  created_at timestamptz not null default now(),
  unique (evento_id, destinatario_id)
);
create index if not exists notificacoes_destinatario
  on public.notificacoes (destinatario_id, created_at desc);
create index if not exists notificacoes_nao_lidas
  on public.notificacoes (destinatario_id) where lida_em is null;

-- ---------------------------------------------------------------------
-- 4. QUEM ESTÁ AGINDO
-- ---------------------------------------------------------------------
/* O trigger de proteção (migration_fix) barra UPDATE de cliente fora das
   colunas de decisão. As funções abaixo são o único caminho legítimo do
   cliente e marcam a transação; o trigger deixa passar só nesse caso. */
create or replace function public.aprovacoes_protege_material()
returns trigger language plpgsql security definer set search_path = public as $t$
begin
  if auth.uid() is null or public.sou_equipe() then return new; end if;
  if current_setting('b7.via_funcao', true) = '1' then return new; end if;
  raise exception 'Decisões do cliente passam pela função aprov_decidir; edição direta não é permitida.';
end $t$;

create or replace function public.aprov_ator()
returns public.perfis language sql stable security definer set search_path = public as $$
  select p.* from public.perfis p where p.id = auth.uid() and p.estado = 'ativa'
$$;

/* Cliente aprovador da empresa (serviço ativo) ou equipe. */
create or replace function public.aprov_pode_decidir(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.sou_equipe() then true
    else exists (
      select 1 from public.perfis p
        join public.perfil_clientes pc on pc.perfil_id = p.id
        join public.clientes c on c.id = pc.client_id
       where p.id = auth.uid() and p.estado = 'ativa' and p.papel = 'cliente'
         and p.pode_aprovar = true and pc.client_id = p_client_id
         and coalesce(c.servico, 'ativo') = 'ativo')
  end
$$;

-- ---------------------------------------------------------------------
-- 5. PROCESSAMENTO DE UM EVENTO → notificações + Kanban
--    Chamado dentro da mesma transação da decisão. Se falhar, a decisão
--    fica gravada e o evento fica com `erro` para reprocessar.
-- ---------------------------------------------------------------------
create or replace function public.aprov_titulo(a public.aprovacoes)
returns text language sql stable as $$
  select coalesce(nullif(a.snapshot->>'titulo', ''), nullif(a.snapshot->>'nome', ''),
    case a.tipo
      when 'roteiro'  then (select r.titulo from public.roteiros r where r.id = a.alvo_id)
      when 'linha'    then (select l.nome from public.linhas_editoriais l where l.id = a.alvo_id)
      when 'conteudo' then (select ct.titulo from public.conteudos ct where ct.id = a.alvo_id)
    end, 'Sem título')
$$;

create or replace function public.aprov_rotulo_tipo(t text)
returns text language sql immutable as $$
  select case t when 'roteiro' then 'o roteiro' when 'linha' then 'a linha editorial'
                when 'conteudo' then 'o conteúdo' when 'semana' then 'o status semanal'
                else 'o material' end
$$;

create or replace function public.aprov_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev  public.eventos_dominio%rowtype;
  a   public.aprovacoes%rowtype;
  emp text; titulo text; quem text; msg text; tit text; link_eq text; link_cl text;
  d   record;
  destino text; tipo_dem text; n int := 0;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;
  select * into a from public.aprovacoes where id = ev.aprovacao_id;
  if not found then
    update public.eventos_dominio set processado_em = now(), erro = 'aprovação não encontrada' where id = ev.id;
    return;
  end if;

  select nome into emp from public.clientes where id = a.client_id;
  titulo := public.aprov_titulo(a);
  quem := coalesce(ev.ator_nome, 'O cliente');
  link_eq := '#/aprovacoes/' || a.id;
  link_cl := '#/revisar/' || a.id;

  -- ---------------------------------------------------------- textos
  if ev.tipo = 'aprovacao.aprovada' then
    tit := quem || coalesce(', da ' || emp, '') || ', aprovou ' || public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo;
    msg := 'Versão ' || a.versao || ' aprovada.';
  elsif ev.tipo = 'aprovacao.ajustes' then
    tit := quem || coalesce(', da ' || emp, '') || ', solicitou ajustes em ' || public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo;
    msg := coalesce(nullif(a.motivo, ''), 'Confira as observações e prepare uma nova versão.');
  elsif ev.tipo = 'aprovacao.recusada' then
    tit := public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo || ' foi recusad' ||
           case when a.tipo = 'linha' then 'a' else 'o' end || coalesce(' por ' || emp, '');
    tit := upper(left(tit, 1)) || substr(tit, 2);
    msg := 'Motivo: ' || coalesce(nullif(a.motivo, ''), '(não informado)');
  elsif ev.tipo = 'parte.aprovada' then
    tit := quem || ' aprovou a ' || coalesce(ev.payload->>'rotulo', 'cena') || ' de ' || titulo;
    msg := null;
  elsif ev.tipo = 'parte.ajustes' then
    tit := quem || ' solicitou ajustes na ' || coalesce(ev.payload->>'rotulo', 'cena') || ' de ' || titulo;
    msg := nullif(ev.payload->>'comentario', '');
  elsif ev.tipo = 'aprovacao.enviada' then
    tit := 'A Branding7 enviou ' || public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo ||
           ' para sua aprovação' || case when a.versao > 1 then ' (nova versão, v' || a.versao || ')' else '' end;
    msg := nullif(a.observacao_envio, '');
  else
    tit := ev.tipo; msg := null;
  end if;

  -- --------------------------------------------------- destinatários
  if ev.tipo = 'aprovacao.enviada' then
    /* cliente: todas as pessoas ativas vinculadas à empresa */
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, a.client_id, ev.tipo, tit, msg, link_cl
      from public.perfis p join public.perfil_clientes pc on pc.perfil_id = p.id
     where pc.client_id = a.client_id and p.estado = 'ativa' and p.papel = 'cliente'
    on conflict (evento_id, destinatario_id) do nothing;
  else
    /* equipe: admins sempre; coordenadores sempre (a agência é pequena e a
       escopagem por responsável entra quando existir atribuição formal) */
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, a.client_id, ev.tipo, tit, msg, link_eq
      from public.perfis p
     where p.estado = 'ativa' and p.papel in ('admin', 'coordenador')
       and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;
  end if;

  -- ---------------------------------------------------------- Kanban
  destino := case ev.tipo
    when 'aprovacao.enviada'  then 'aguardando_cliente'
    when 'aprovacao.ajustes'  then 'ajustes'
    when 'aprovacao.recusada' then 'ajustes'
    when 'aprovacao.aprovada' then 'pronto'
    else null end;

  for d in select * from public.kanban_demandas
            where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id
              and deleted_at is null and arquivada_em is null
  loop
    n := n + 1;
    update public.kanban_demandas
       set aprovacao_id = a.id, aprovacao_situacao = a.situacao, updated_at = now()
     where id = d.id;
    if destino is null or d.automacao_travada or d.coluna = 'concluida' then continue; end if;
    /* aprovação nunca conclui: só avança quem estava esperando o cliente */
    if ev.tipo = 'aprovacao.aprovada' and d.coluna not in ('aguardando_cliente', 'revisao', 'ajustes') then continue; end if;
    if d.coluna <> destino then
      update public.kanban_demandas
         set coluna = destino, origem_evento = ev.tipo,
             prioridade = case when ev.tipo = 'aprovacao.recusada' then 'alta' else prioridade end,
             descricao = case when ev.tipo in ('aprovacao.ajustes', 'aprovacao.recusada') and coalesce(a.motivo, '') <> ''
                              then left('[' || case when ev.tipo = 'aprovacao.recusada' then 'RECUSADO' else 'AJUSTES' end ||
                                   ' v' || a.versao || '] ' || a.motivo || E'\n\n' || coalesce(descricao, ''), 4000)
                              else descricao end
       where id = d.id;
      insert into public.kanban_historico (demanda_id, autor_id, autor_nome, de, para, campo)
      values (d.id, ev.ator_id, coalesce(ev.ator_nome, 'Automação') || ' (aprovação)', d.coluna, destino, 'coluna');
    end if;
  end loop;

  /* sem demanda ligada: só cria quando há trabalho para a equipe */
  if n = 0 and ev.tipo in ('aprovacao.enviada', 'aprovacao.ajustes', 'aprovacao.recusada') then
    tipo_dem := case when ev.tipo = 'aprovacao.enviada' then 'producao' else 'ajuste' end;
    insert into public.kanban_demandas (titulo, descricao, coluna, client_id, tipo_vinculo, vinculo_id,
                                        tipo, prioridade, origem_evento, aprovacao_id, aprovacao_situacao, criado_por)
    values (titulo,
            case when coalesce(a.motivo, '') <> '' then '[' || upper(replace(ev.tipo, 'aprovacao.', '')) || ' v' || a.versao || '] ' || a.motivo else null end,
            destino, a.client_id, a.tipo, a.alvo_id, tipo_dem,
            case when ev.tipo = 'aprovacao.recusada' then 'alta' else 'normal' end,
            ev.tipo, a.id, a.situacao, a.enviado_por);
  end if;

  update public.eventos_dominio set processado_em = now(), erro = null, tentativas = tentativas + 1 where id = ev.id;
exception when others then
  update public.eventos_dominio set erro = SQLERRM, tentativas = tentativas + 1 where id = p_evento_id;
end $$;

/* Registra o evento e tenta processar na hora. A falha do processamento
   não derruba a decisão: fica registrada para reprocessar. */
create or replace function public.aprov_emitir(p_tipo text, p_chave text, a public.aprovacoes,
                                               p_ator public.perfis, p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare ev_id uuid;
begin
  insert into public.eventos_dominio (tipo, chave, aprovacao_id, client_id, alvo_tipo, alvo_id, versao,
                                      ator_id, ator_nome, ator_papel, payload)
  values (p_tipo, p_chave, a.id, a.client_id, a.tipo, a.alvo_id, a.versao,
          p_ator.id, p_ator.nome, p_ator.papel, coalesce(p_payload, '{}'::jsonb))
  on conflict (chave) do nothing
  returning id into ev_id;
  if ev_id is null then return null; end if;   -- já existia: nada a fazer
  perform public.aprov_processar_evento(ev_id);
  return ev_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. ENVIAR PARA APROVAÇÃO (equipe)
-- ---------------------------------------------------------------------
create or replace function public.aprov_enviar(p_client_id uuid, p_tipo text, p_alvo_id uuid,
                                               p_snapshot jsonb, p_observacao text default null)
returns public.aprovacoes language plpgsql security definer set search_path = public as $$
declare ator public.perfis; a public.aprovacoes; prox int;
begin
  ator := public.aprov_ator();
  if ator.id is null or not public.sou_equipe() then
    raise exception 'Só a equipe envia material para aprovação.' using errcode = '42501';
  end if;
  if p_tipo not in ('roteiro', 'linha', 'conteudo', 'semana') then
    raise exception 'Tipo de material inválido: %', p_tipo;
  end if;

  /* versões anteriores ainda abertas ficam substituídas — a decisão do
     cliente vale só para a versão que ele está vendo */
  perform 1 from public.aprovacoes where tipo = p_tipo and alvo_id = p_alvo_id and deleted_at is null for update;
  select coalesce(max(versao), 0) + 1 into prox from public.aprovacoes
   where tipo = p_tipo and alvo_id = p_alvo_id and deleted_at is null;

  insert into public.aprovacoes (client_id, tipo, alvo_id, versao, snapshot, situacao,
                                 enviado_por, enviado_por_nome, enviado_em, observacao_envio)
  values (p_client_id, p_tipo, p_alvo_id, prox, coalesce(p_snapshot, '{}'::jsonb), 'pendente',
          ator.id, ator.nome, now(), nullif(p_observacao, ''))
  returning * into a;

  update public.aprovacoes
     set situacao = 'substituido', substituida_por = a.id, updated_at = now()
   where tipo = p_tipo and alvo_id = p_alvo_id and deleted_at is null
     and id <> a.id and situacao in ('pendente', 'parcial');

  perform public.aprov_emitir('aprovacao.enviada', 'enviada:' || a.id, a, ator,
                              jsonb_build_object('versao', a.versao));
  return a;
end $$;

-- ---------------------------------------------------------------------
-- 7. DECISÃO POR PARTE (cena, slide, frame)
-- ---------------------------------------------------------------------
create or replace function public.aprov_decidir_parte(p_aprovacao_id uuid, p_parte_id uuid,
                                                      p_rotulo text, p_situacao text,
                                                      p_comentario text default null,
                                                      p_parte_tipo text default 'cena')
returns jsonb language plpgsql security definer set search_path = public as $$
declare ator public.perfis; a public.aprovacoes; atual public.aprovacao_partes; pendentes int;
begin
  perform set_config('b7.via_funcao', '1', true);
  ator := public.aprov_ator();
  if ator.id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if p_situacao not in ('aprovada', 'ajustes') then raise exception 'Decisão inválida: %', p_situacao; end if;

  select * into a from public.aprovacoes where id = p_aprovacao_id and deleted_at is null for update;
  if not found then raise exception 'Material não encontrado.' using errcode = 'P0002'; end if;
  if not public.aprov_pode_decidir(a.client_id) then
    raise exception 'Sua conta não tem permissão para decidir este material.' using errcode = '42501';
  end if;
  if a.situacao = 'substituido' then
    raise exception 'Esta versão foi substituída por uma mais nova. Abra a versão atual.' using errcode = 'P0003';
  end if;
  if a.situacao not in ('pendente', 'parcial') then
    raise exception 'Esta versão já foi encerrada (%): não aceita novas decisões por cena.', a.situacao using errcode = 'P0003';
  end if;
  /* a cena precisa existir no retrato enviado — decisão nunca cai em cena que o cliente não viu */
  if not exists (select 1 from jsonb_array_elements(coalesce(a.snapshot->'cenas', '[]'::jsonb)) c
                  where c->>'id' = p_parte_id::text) then
    raise exception 'Esta cena não faz parte da versão enviada.' using errcode = 'P0002';
  end if;

  select * into atual from public.aprovacao_partes
   where aprovacao_id = a.id and parte_id = p_parte_id for update;

  if found and atual.situacao = p_situacao then
    /* comando repetido: devolve o que já existe, sem efeito colateral */
    return jsonb_build_object('resultado', 'inalterado', 'situacao', atual.situacao,
                              'decidido_em', atual.decidido_em, 'decidido_por_nome', atual.decidido_por_nome);
  end if;

  insert into public.aprovacao_partes (aprovacao_id, parte_id, parte_tipo, parte_rotulo, situacao,
                                       decidido_por, decidido_por_nome, decidido_em, updated_at)
  values (a.id, p_parte_id, coalesce(p_parte_tipo, 'cena'), p_rotulo, p_situacao, ator.id, ator.nome, now(), now())
  on conflict (aprovacao_id, parte_id) do update
    set situacao = excluded.situacao, parte_rotulo = coalesce(excluded.parte_rotulo, public.aprovacao_partes.parte_rotulo),
        decidido_por = excluded.decidido_por, decidido_por_nome = excluded.decidido_por_nome,
        decidido_em = now(), updated_at = now()
  returning * into atual;

  if coalesce(p_comentario, '') <> '' then
    insert into public.comentarios (aprovacao_id, parte_id, parte_rotulo, autor_id, autor_nome, autor_papel, texto)
    values (a.id, p_parte_id, p_rotulo, ator.id, ator.nome, ator.papel, p_comentario);
  end if;

  if a.situacao = 'pendente' then
    update public.aprovacoes set situacao = 'parcial', updated_at = now() where id = a.id;
    a.situacao := 'parcial';
  end if;

  perform public.aprov_emitir(case when p_situacao = 'aprovada' then 'parte.aprovada' else 'parte.ajustes' end,
    'parte:' || a.id || ':' || p_parte_id || ':' || p_situacao || ':' || to_char(atual.decidido_em, 'YYYYMMDDHH24MISSUS'),
    a, ator, jsonb_build_object('rotulo', p_rotulo, 'comentario', p_comentario, 'parte_id', p_parte_id));

  select count(*) into pendentes from jsonb_array_elements(coalesce(a.snapshot->'cenas', '[]'::jsonb)) c
   where not exists (select 1 from public.aprovacao_partes pp where pp.aprovacao_id = a.id
                      and pp.parte_id::text = c->>'id' and pp.situacao <> 'pendente');

  return jsonb_build_object('resultado', 'registrado', 'situacao', atual.situacao,
                            'decidido_em', atual.decidido_em, 'decidido_por_nome', atual.decidido_por_nome,
                            'cenas_pendentes', pendentes, 'aprovacao_situacao', a.situacao);
end $$;

-- ---------------------------------------------------------------------
-- 8. DECISÃO DO MATERIAL INTEIRO
-- ---------------------------------------------------------------------
create or replace function public.aprov_decidir(p_aprovacao_id uuid, p_situacao text,
                                                p_motivo text default null, p_versao int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ator public.perfis; a public.aprovacoes; com_ajustes text[]; cenas_ajustes int;
begin
  perform set_config('b7.via_funcao', '1', true);
  ator := public.aprov_ator();
  if ator.id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if p_situacao not in ('aprovado', 'ajustes', 'recusado') then raise exception 'Decisão inválida: %', p_situacao; end if;

  select * into a from public.aprovacoes where id = p_aprovacao_id and deleted_at is null for update;
  if not found then raise exception 'Material não encontrado.' using errcode = 'P0002'; end if;
  if not public.aprov_pode_decidir(a.client_id) then
    raise exception 'Sua conta não tem permissão para decidir este material.' using errcode = '42501';
  end if;
  if p_versao is not null and p_versao <> a.versao then
    raise exception 'Você está vendo a versão %, mas a atual é a %. Recarregue para decidir sobre a versão certa.', p_versao, a.versao using errcode = 'P0003';
  end if;
  if a.situacao = p_situacao then
    return jsonb_build_object('resultado', 'inalterado', 'situacao', a.situacao,
                              'decidido_em', a.decidido_em, 'decidido_por_nome', a.decidido_por_nome);
  end if;
  if a.situacao = 'substituido' then
    raise exception 'Esta versão foi substituída por uma mais nova. Abra a versão atual.' using errcode = 'P0003';
  end if;
  if a.situacao not in ('pendente', 'parcial') then
    raise exception 'Esta versão já foi decidida (%). Uma nova decisão exige uma nova versão enviada pela equipe.', a.situacao using errcode = 'P0003';
  end if;

  select count(*), array_agg(coalesce(parte_rotulo, 'cena') order by parte_rotulo)
    into cenas_ajustes, com_ajustes
    from public.aprovacao_partes where aprovacao_id = a.id and situacao = 'ajustes';

  if p_situacao = 'aprovado' and cenas_ajustes > 0 then
    raise exception 'Há % cena(s) com ajustes pedidos (%). Aprovar o roteiro inteiro contradiz esses pedidos: retire o pedido de ajuste da cena ou aguarde a nova versão.',
      cenas_ajustes, array_to_string(com_ajustes, ', ') using errcode = 'P0004';
  end if;
  if p_situacao = 'recusado' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Recusar exige um motivo.' using errcode = 'P0005';
  end if;
  if p_situacao = 'ajustes' and coalesce(trim(p_motivo), '') = '' and cenas_ajustes = 0
     and not exists (select 1 from public.comentarios where aprovacao_id = a.id and autor_id = ator.id) then
    raise exception 'Descreva o que precisa ser ajustado.' using errcode = 'P0005';
  end if;

  update public.aprovacoes
     set situacao = p_situacao, motivo = nullif(trim(p_motivo), ''),
         decidido_por = ator.id, decidido_por_nome = ator.nome, decidido_em = now(), updated_at = now()
   where id = a.id returning * into a;

  if coalesce(trim(p_motivo), '') <> '' then
    insert into public.comentarios (aprovacao_id, autor_id, autor_nome, autor_papel, texto)
    values (a.id, ator.id, ator.nome, ator.papel,
            case p_situacao when 'recusado' then 'Motivo da recusa: ' else '' end || trim(p_motivo));
  end if;

  perform public.aprov_emitir('aprovacao.' || case p_situacao when 'aprovado' then 'aprovada'
                                                              when 'ajustes' then 'ajustes' else 'recusada' end,
                              'decisao:' || a.id || ':' || p_situacao, a, ator,
                              jsonb_build_object('motivo', a.motivo, 'versao', a.versao));

  return jsonb_build_object('resultado', 'registrado', 'situacao', a.situacao,
                            'decidido_em', a.decidido_em, 'decidido_por_nome', a.decidido_por_nome, 'versao', a.versao);
end $$;

/* Reprocessar um evento que falhou (equipe). */
create or replace function public.aprov_reprocessar(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Restrito à equipe.' using errcode = '42501'; end if;
  update public.eventos_dominio set processado_em = null where id = p_evento_id and erro is not null;
  perform public.aprov_processar_evento(p_evento_id);
end $$;

-- ---------------------------------------------------------------------
-- 9. NOTIFICAÇÕES — leitura e marcação (só as próprias)
-- ---------------------------------------------------------------------
create or replace function public.notif_marcar_lida(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notificacoes set lida_em = now()
   where id = p_id and destinatario_id = auth.uid() and lida_em is null
$$;
create or replace function public.notif_marcar_todas()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notificacoes set lida_em = now() where destinatario_id = auth.uid() and lida_em is null;
  get diagnostics n = row_count; return n;
end $$;

-- ---------------------------------------------------------------------
-- 10. VISÃO DE TRABALHO — painel de aprovações
-- ---------------------------------------------------------------------
drop view if exists public.aprovacoes_pendentes;
drop view if exists public.aprovacoes_painel;
create view public.aprovacoes_painel
with (security_invoker = true) as
select a.id, a.client_id, a.tipo, a.alvo_id, a.versao, a.situacao, a.motivo,
       a.enviado_por, a.enviado_por_nome, a.enviado_em, a.observacao_envio,
       a.decidido_por, a.decidido_por_nome, a.decidido_em, a.substituida_por,
       a.created_at, a.updated_at,
       c.nome as cliente_nome, c.logo_url as cliente_logo_url,
       public.aprov_titulo(a) as titulo,
       coalesce(jsonb_array_length(a.snapshot->'cenas'), 0) as total_partes,
       (select count(*) from public.aprovacao_partes p where p.aprovacao_id = a.id and p.situacao = 'aprovada') as partes_aprovadas,
       (select count(*) from public.aprovacao_partes p where p.aprovacao_id = a.id and p.situacao = 'ajustes') as partes_ajustes,
       (select count(*) from public.comentarios cm where cm.aprovacao_id = a.id and cm.resolvido = false) as comentarios_abertos,
       (select count(*) from public.comentarios cm where cm.aprovacao_id = a.id) as comentarios_total,
       (select max(cm.created_at) from public.comentarios cm where cm.aprovacao_id = a.id and cm.autor_papel = 'cliente') as ultima_resposta_cliente,
       (select d.id from public.kanban_demandas d where d.tipo_vinculo = a.tipo and d.vinculo_id = a.alvo_id
          and d.deleted_at is null and d.arquivada_em is null order by d.updated_at desc limit 1) as demanda_id,
       (select d.coluna from public.kanban_demandas d where d.tipo_vinculo = a.tipo and d.vinculo_id = a.alvo_id
          and d.deleted_at is null and d.arquivada_em is null order by d.updated_at desc limit 1) as demanda_coluna,
       (a.versao = (select max(x.versao) from public.aprovacoes x
                     where x.tipo = a.tipo and x.alvo_id = a.alvo_id and x.deleted_at is null)) as versao_atual,
       case a.tipo when 'roteiro' then (select r.recording_session_id from public.roteiros r where r.id = a.alvo_id) end as gravacao_id,
       case a.tipo when 'conteudo' then (select ct.linha_id from public.conteudos ct where ct.id = a.alvo_id) end as linha_id
  from public.aprovacoes a
  join public.clientes c on c.id = a.client_id
 where a.deleted_at is null;

/* kanban_resumo foi criada com d.* antes das colunas novas: recria */
drop view if exists public.kanban_resumo;
create view public.kanban_resumo
with (security_invoker = true) as
select d.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo,
       p.nome as responsavel_nome,
       (select count(*) from public.kanban_comentarios k
         where k.demanda_id = d.id and k.resolvido_em is null) as comentarios_abertos
from public.kanban_demandas d
left join public.clientes c on c.id = d.client_id
left join public.perfis p on p.id = d.responsavel_id;
grant select on public.kanban_resumo to authenticated;

/* a view antiga do portal continua existindo; passa a apontar para o painel */
drop view if exists public.aprovacoes_pendentes;
create view public.aprovacoes_pendentes with (security_invoker = true) as
select id, client_id, tipo, alvo_id, versao, situacao, enviado_em, observacao_envio,
       cliente_nome, titulo, comentarios_abertos
  from public.aprovacoes_painel;

-- ---------------------------------------------------------------------
-- 11. PERMISSÕES E RLS
-- ---------------------------------------------------------------------
alter table public.eventos_dominio enable row level security;
alter table public.notificacoes enable row level security;

do $$
begin
  drop policy if exists eventos_equipe on public.eventos_dominio;
  create policy eventos_equipe on public.eventos_dominio for select to authenticated using (public.sou_equipe());

  drop policy if exists notificacoes_proprias on public.notificacoes;
  create policy notificacoes_proprias on public.notificacoes for select to authenticated
    using (destinatario_id = auth.uid());

  /* A decisão do cliente agora passa só pelas funções: sem UPDATE direto. */
  drop policy if exists aprovacoes_decisao on public.aprovacoes;
  drop policy if exists partes_escrita on public.aprovacao_partes;
  drop policy if exists partes_equipe on public.aprovacao_partes;
  create policy partes_equipe on public.aprovacao_partes for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());
end $$;

grant select on public.eventos_dominio to authenticated;
grant select on public.notificacoes to authenticated;
grant select on public.aprovacoes_painel to authenticated;
grant select on public.aprovacoes_pendentes to authenticated;
select public.b7_grant_anon_se_aberto('aprovacoes_painel');
select public.b7_grant_anon_se_aberto('aprovacoes_pendentes');

revoke all on function public.aprov_processar_evento(uuid) from public;
revoke all on function public.aprov_emitir(text, text, public.aprovacoes, public.perfis, jsonb) from public;
grant execute on function public.aprov_ator() to authenticated;
grant execute on function public.aprov_pode_decidir(uuid) to authenticated;
grant execute on function public.aprov_titulo(public.aprovacoes) to authenticated, anon;
grant execute on function public.aprov_rotulo_tipo(text) to authenticated, anon;
grant execute on function public.aprov_enviar(uuid, text, uuid, jsonb, text) to authenticated;
grant execute on function public.aprov_decidir_parte(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.aprov_decidir(uuid, text, text, int) to authenticated;
grant execute on function public.aprov_reprocessar(uuid) to authenticated;
grant execute on function public.notif_marcar_lida(uuid) to authenticated;
grant execute on function public.notif_marcar_todas() to authenticated;

/* Antes do corte do RLS o sistema roda sem sessão: as funções exigem
   sessão, então enviar/decidir passa a exigir login mesmo antes do
   corte. É intencional — decisão sem autor não é decisão. */

-- ---------------------------------------------------------------------
-- 12. RECONCILIAÇÃO DO LEGADO (dry-run primeiro)
--    Versões antigas ainda 'pendente' de um material que já tem versão
--    mais nova viram 'substituido'. Nada é apagado.
-- ---------------------------------------------------------------------
-- select tipo, alvo_id, versao, situacao from public.aprovacoes a
--  where situacao = 'pendente' and exists (select 1 from public.aprovacoes b
--    where b.tipo = a.tipo and b.alvo_id = a.alvo_id and b.versao > a.versao and b.deleted_at is null);
update public.aprovacoes a set situacao = 'substituido', updated_at = now()
 where a.situacao = 'pendente' and a.deleted_at is null
   and exists (select 1 from public.aprovacoes b where b.tipo = a.tipo and b.alvo_id = a.alvo_id
                 and b.versao > a.versao and b.deleted_at is null);

/* aprovação pendente que já tem cena decidida = parcial */
update public.aprovacoes a set situacao = 'parcial', updated_at = now()
 where a.situacao = 'pendente' and a.deleted_at is null
   and exists (select 1 from public.aprovacao_partes p where p.aprovacao_id = a.id and p.situacao <> 'pendente');

select 'migration_aprovacoes_v2 aplicada' as resultado;
