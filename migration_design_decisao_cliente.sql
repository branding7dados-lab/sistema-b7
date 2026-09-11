/* =====================================================================
   B7 DESIGN — DECISÃO DO CLIENTE REGISTRADA PELA EQUIPE B7
   (WhatsApp / ligação / reunião / presencial / outro)

   Migração ADITIVA. Reaproveita o motor de aprovação que já existe
   (`aprovacoes` + `aprovacao_partes` + `aprov_emitir` +
   `aprov_processar_evento` + `aprov_anular`). NÃO cria um segundo motor,
   não recria Design, Kanban, notificações nem Portal.

   Ideia central: uma decisão do cliente é SEMPRE uma linha em
   `aprovacoes` (tipo 'design_versao'). O que muda é a procedência:
     - Portal: o próprio cliente decide (aprov_decidir, ator = cliente)
       → origem_decisao = 'portal' (null nas linhas antigas = portal).
     - Externa: Admin/Coordenador registra o que o cliente decidiu fora
       (WhatsApp…) → origem_decisao = 'externa', canal_decisao,
       registrado_por(_nome). decidido_por = quem REGISTROU (pessoa da
       B7) — nunca o usuário do cliente, nunca sessão falsa.
   Resultado operacional igual (estado da peça, versão, Kanban,
   notificação ao designer); histórico diferente e verdadeiro.

   O que entra:
     1. Colunas de procedência em `aprovacoes`; feedback do cliente por
        slide em `design_arquivos` (separado do ajuste interno).
     2. `design_registrar_decisao_cliente(...)`: UMA ação de negócio —
        garante a versão em `aprovacoes` (cria se a peça ainda estava só
        "aprovada internamente", marcando "enviado ao cliente via X" sem
        notificar o Portal), grava a decisão com procedência, feedback
        por slide, comentário, e emite o evento pelo motor de sempre
        (aprov_emitir → notificações da equipe + Kanban).
     3. Trigger em `aprovacoes` (tipo design_versao): propaga a decisão
        — venha do Portal, da B7 ou de uma anulação — para
        design_versoes/design_deliverables e avisa o designer UMA vez.
        É isto que faz Portal e registro externo convergirem.
     4. `aprov_processar_evento` recriada (cópia fiel da v3) com duas
        correções cirúrgicas: (a) texto honesto quando a decisão foi
        registrada pela B7 ("Cliente aprovou … — via WhatsApp, registrado
        por Yury", nunca "Yury, da <empresa do cliente>, aprovou");
        (b) o card do Kanban da peça de Design é achado pelo vínculo
        certo ('design_deliverable') — antes a decisão do cliente nunca
        achava o card e ainda criava um segundo.
     5. `design_aprovar_interno` ganha a trava contra aprovar por cima
        de ajuste do cliente ainda não atendido; a view
        `aprovacoes_painel` ganha as colunas de procedência (no fim).

   Roda depois de migration_design_arquivos_v2.sql e migration_aprovacoes_v3.sql.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. PROCEDÊNCIA DA DECISÃO + FEEDBACK DO CLIENTE POR SLIDE
-- ---------------------------------------------------------------------
alter table public.aprovacoes add column if not exists origem_decisao text;         -- 'portal' | 'externa' (null = portal, linhas antigas)
alter table public.aprovacoes add column if not exists canal_decisao text;          -- whatsapp | ligacao | reuniao | presencial | outro
alter table public.aprovacoes add column if not exists registrado_por uuid references public.perfis(id) on delete set null;
alter table public.aprovacoes add column if not exists registrado_por_nome text;
alter table public.aprovacoes add column if not exists observacao_decisao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aprovacoes_origem_valida') then
    alter table public.aprovacoes add constraint aprovacoes_origem_valida
      check (origem_decisao is null or origem_decisao in ('portal', 'externa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aprovacoes_canal_valido') then
    alter table public.aprovacoes add constraint aprovacoes_canal_valido
      check (canal_decisao is null or canal_decisao in ('whatsapp', 'ligacao', 'reuniao', 'presencial', 'outro'));
  end if;
end $$;

/* ajuste pedido PELO CLIENTE num slide/frame — separado de
   revisao/revisao_mensagem (ajuste interno da B7) de propósito: o
   designer precisa saber de quem veio */
alter table public.design_arquivos add column if not exists cliente_ajuste text;
alter table public.design_arquivos add column if not exists cliente_ajuste_em timestamptz;
alter table public.design_arquivos add column if not exists cliente_ajuste_canal text;

create or replace function public.design_canal_rotulo(p text)
returns text language sql immutable as $$
  select case p when 'whatsapp' then 'WhatsApp' when 'ligacao' then 'ligação' when 'reuniao' then 'reunião'
                when 'presencial' then 'presencial' when 'outro' then 'outro canal' when 'portal' then 'Portal do Cliente' end
$$;
grant execute on function public.design_canal_rotulo(text) to authenticated, anon;

/* rótulo do tipo nas notificações do motor de aprovação */
create or replace function public.aprov_rotulo_tipo(t text)
returns text language sql immutable as $$
  select case t when 'roteiro' then 'o roteiro' when 'linha' then 'a linha editorial'
                when 'conteudo' then 'o conteúdo' when 'semana' then 'o status semanal'
                when 'design_versao' then 'a peça de Design'
                else 'o material' end
$$;

-- ---------------------------------------------------------------------
-- 2. PROCESSAMENTO DE EVENTOS — cópia fiel da v3 com as duas correções
--    descritas no cabeçalho (texto honesto + card do Kanban da peça)
-- ---------------------------------------------------------------------
create or replace function public.aprov_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev  public.eventos_dominio%rowtype;
  a   public.aprovacoes%rowtype;
  emp text; titulo text; quem text; msg text; tit text; link_eq text; link_cl text;
  msg_cl text; tit_cl text;
  d   record;
  destino text; tipo_dem text; n int := 0;
  anterior text; esperado text; motivo_an text; canal_ext text;
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
  /* decisão registrada pela B7 em nome do cliente (WhatsApp, ligação…):
     o texto diz a verdade — o cliente decidiu, a B7 registrou. Nunca
     "Yury, da <empresa do cliente>, aprovou". */
  if ev.tipo in ('aprovacao.aprovada', 'aprovacao.ajustes', 'aprovacao.recusada') and ev.payload->>'origem' = 'externa' then
    canal_ext := coalesce(public.design_canal_rotulo(ev.payload->>'canal'), 'canal externo');
    tit := 'Cliente' || coalesce(' (' || emp || ')', '') ||
           case ev.tipo when 'aprovacao.aprovada' then ' aprovou ' when 'aprovacao.ajustes' then ' solicitou ajustes em ' else ' recusou ' end ||
           public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo || ' — via ' || canal_ext || ', registrado por ' || quem;
    msg := case ev.tipo when 'aprovacao.aprovada' then 'Versão ' || a.versao || ' aprovada.' || coalesce(' ' || nullif(a.observacao_decisao, ''), '')
                        when 'aprovacao.ajustes' then coalesce(nullif(a.motivo, ''), 'Confira as observações e prepare uma nova versão.')
                        else 'Motivo: ' || coalesce(nullif(a.motivo, ''), '(não informado)') end;
  elsif ev.tipo = 'aprovacao.aprovada' then
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
  elsif ev.tipo in ('aprovacao.anulada', 'parte.anulada') then
    /* equipe vê o motivo; o cliente recebe texto neutro, sem motivo,
       salvo se o Admin marcou "mostrar motivo ao cliente" */
    anterior  := coalesce(ev.payload->>'situacao_anterior', '');
    motivo_an := nullif(ev.payload->>'motivo', '');
    if ev.tipo = 'aprovacao.anulada' then
      tit := quem || ' anulou a ' || case anterior when 'aprovado' then 'aprovação'
                                                    when 'ajustes' then 'solicitação de ajustes'
                                                    when 'recusado' then 'recusa' else 'decisão' end ||
             ' ' || public.aprov_rotulo_tipo_de(a.tipo) || ' ' || titulo || ' (v' || a.versao || ')';
    else
      tit := quem || ' anulou a decisão da ' || coalesce(ev.payload->>'rotulo', 'cena') || ' de ' || titulo || ' (v' || a.versao || ')';
    end if;
    msg := 'Motivo: ' || coalesce(motivo_an, '(não informado)') ||
           case when a.situacao in ('pendente', 'parcial') then ' · O material voltou a aguardar o cliente.' else '' end;
    tit_cl := 'A aprovação anterior foi anulada pela Branding7.';
    msg_cl := public.aprov_rotulo_tipo(a.tipo) || ' ' || titulo || ' (v' || a.versao || ')' ||
              case when a.situacao in ('pendente', 'parcial') then ' voltou para sua revisão.' else '.' end ||
              case when coalesce((ev.payload->>'visivel_cliente')::boolean, false) and motivo_an is not null
                   then ' Motivo: ' || motivo_an else '' end;
    msg_cl := upper(left(msg_cl, 1)) || substr(msg_cl, 2);
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
  elsif ev.tipo in ('aprovacao.anulada', 'parte.anulada') then
    /* cliente (texto neutro) + equipe (com motivo), exceto quem anulou */
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, a.client_id, ev.tipo, tit_cl, msg_cl, link_cl
      from public.perfis p join public.perfil_clientes pc on pc.perfil_id = p.id
     where pc.client_id = a.client_id and p.estado = 'ativa' and p.papel = 'cliente'
    on conflict (evento_id, destinatario_id) do nothing;
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, a.client_id, ev.tipo, tit, msg, link_eq
      from public.perfis p
     where p.estado = 'ativa' and p.papel in ('admin', 'coordenador')
       and p.id is distinct from ev.ator_id
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
    when 'aprovacao.anulada'  then 'aguardando_cliente'
    else null end;

  /* anulação do todo: só desfaz o movimento que ESSA decisão causou */
  esperado := case when ev.tipo = 'aprovacao.anulada' then
    case anterior when 'aprovado' then 'pronto' when 'ajustes' then 'ajustes' when 'recusado' then 'ajustes' end
    else null end;

  /* peça de Design: o card do Kanban é da peça (tipo_vinculo
     'design_deliverable'), não da aprovação — sem isto a decisão do
     cliente nunca achava o card e ainda criava um segundo (n = 0) */
  for d in select * from public.kanban_demandas
            where vinculo_id = a.alvo_id
              and tipo_vinculo = case when a.tipo = 'design_versao' then 'design_deliverable' else a.tipo end
              and deleted_at is null and arquivada_em is null
  loop
    n := n + 1;
    update public.kanban_demandas
       set aprovacao_id = a.id, aprovacao_situacao = a.situacao, updated_at = now()
     where id = d.id;

    if ev.tipo = 'aprovacao.anulada' then
      if a.situacao not in ('pendente', 'parcial') then continue; end if;   -- versão antiga: nada a desfazer
      if d.coluna = 'concluida' or d.concluida_em is not null then
        update public.kanban_demandas
           set aviso = 'A aprovação foi anulada, mas este material já possui etapas posteriores concluídas. Revise o status da produção.'
         where id = d.id;
      elsif d.automacao_travada then
        update public.kanban_demandas
           set aviso = 'A aprovação foi anulada, mas a automação desta demanda está travada. Revise o status da produção.'
         where id = d.id;
      elsif d.coluna = esperado and d.origem_evento in ('aprovacao.aprovada', 'aprovacao.ajustes', 'aprovacao.recusada') then
        update public.kanban_demandas
           set coluna = destino, origem_evento = ev.tipo, aviso = null
         where id = d.id;
        insert into public.kanban_historico (demanda_id, autor_id, autor_nome, de, para, campo)
        values (d.id, ev.ator_id, 'Aprovação anulada por ' || coalesce(ev.ator_nome, 'Administrador'), d.coluna, destino, 'coluna');
      elsif d.coluna <> destino then
        /* a equipe já moveu a demanda depois da decisão: não desfaz trabalho */
        update public.kanban_demandas
           set aviso = 'A aprovação foi anulada, mas este material já possui etapas posteriores. Revise o status da produção.'
         where id = d.id;
      end if;
      continue;
    end if;

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
  if n = 0 and a.tipo <> 'design_versao' and ev.tipo in ('aprovacao.enviada', 'aprovacao.ajustes', 'aprovacao.recusada') then
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

-- ---------------------------------------------------------------------
-- 3. PROPAGAR A DECISÃO DO CLIENTE PARA A PEÇA DE DESIGN
--    Trigger em aprovacoes (tipo design_versao) — vale pro Portal
--    (aprov_decidir), pro registro externo e pra anulação (aprov_anular).
--    Um caminho só: é o que garante que os dois tipos de decisão dão o
--    mesmo resultado operacional.
-- ---------------------------------------------------------------------
create or replace function public.design_sync_decisao_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid; d public.design_deliverables%rowtype; tit text; msg text; ev_id uuid; v_chave text;
        canal text; lista text; ator_nome text;
begin
  if new.tipo <> 'design_versao' or new.situacao is not distinct from old.situacao then return new; end if;
  v_id := nullif(new.snapshot->>'design_versao_id', '')::uuid;
  select * into d from public.design_deliverables where id = new.alvo_id;
  if not found then return new; end if;
  /* só a versão atual da aprovação manda na peça; uma versão antiga
     (substituida/anulada depois de nova) não mexe em nada */
  if exists (select 1 from public.aprovacoes x where x.tipo = 'design_versao' and x.alvo_id = new.alvo_id
              and x.deleted_at is null and x.versao > new.versao) then return new; end if;

  canal := case when new.origem_decisao = 'externa' then public.design_canal_rotulo(new.canal_decisao) else 'Portal do Cliente' end;
  ator_nome := coalesce(new.registrado_por_nome, new.decidido_por_nome, 'a equipe');

  if new.situacao = 'aprovado' then
    if v_id is not null then update public.design_versoes set estado = 'aprovada_cliente', updated_at = now() where id = v_id; end if;
    update public.design_deliverables set status = 'aprovado_cliente', updated_at = now() where id = d.id;
    tit := 'Cliente aprovou a peça';
    msg := d.titulo || ' foi aprovad' || case when d.tipo in ('capa_reel') then 'a' else 'o' end || ' pelo cliente via ' || canal ||
           case when new.origem_decisao = 'externa' then ' (registrado por ' || ator_nome || ')' else '' end || '.';
  elsif new.situacao in ('ajustes', 'recusado') then
    if v_id is not null then update public.design_versoes set estado = 'ajuste_cliente', updated_at = now() where id = v_id; end if;
    update public.design_deliverables set status = 'ajustes_cliente', updated_at = now() where id = d.id;
    select string_agg(coalesce(p.parte_rotulo, ''), ', ' order by p.parte_rotulo) into lista
      from public.aprovacao_partes p where p.aprovacao_id = new.id and p.situacao = 'ajustes';
    tit := case when new.situacao = 'recusado' then 'Cliente recusou a peça' else 'Cliente solicitou ajustes' end;
    msg := d.titulo || ' — via ' || canal ||
           case when new.origem_decisao = 'externa' then ', registrado por ' || ator_nome else '' end || '.' ||
           /* o motivo (montado pelo registro externo) já traz "N slides
              precisam… Slide 03: …"; só sem motivo a lista entra à parte */
           case when coalesce(new.motivo, '') <> '' then E'\n' || new.motivo
                when lista is not null then E'\n' || lista || ' precisa' || case when lista like '%,%' then 'm' else '' end || ' de alterações.'
                else '' end;
  elsif new.situacao in ('pendente', 'parcial') and new.anulada_em is not null and old.situacao in ('aprovado', 'ajustes', 'recusado') then
    /* anulação (aprov_anular): a peça volta a aguardar o cliente; o
       feedback por slide desta decisão deixa de valer (o histórico da
       aprovação continua guardado em aprovacoes/aprovacao_partes) */
    if v_id is not null then update public.design_versoes set estado = 'enviada_cliente', updated_at = now() where id = v_id; end if;
    update public.design_deliverables set status = 'aguardando_cliente', updated_at = now() where id = d.id;
    update public.design_arquivos a set cliente_ajuste = null, cliente_ajuste_em = null, cliente_ajuste_canal = null
     where a.id in (select e.id from public.design_arquivos_efetivos(d.id) e) and a.cliente_ajuste is not null;
    tit := 'Decisão do cliente anulada';
    msg := d.titulo || ' voltou a aguardar o cliente. ' || coalesce('Motivo: ' || nullif(new.anulacao_motivo, ''), '');
  else
    return new;
  end if;

  /* UMA notificação pro designer responsável (link da peça — aparece na
     linha do tempo do workspace). Chave idempotente: mesma decisão não
     avisa duas vezes. */
  if d.designer_id is not null then
    v_chave := 'design.cliente:' || new.id || ':' || new.situacao || ':' || coalesce(to_char(new.anulada_em, 'YYYYMMDDHH24MISSUS'), '');
    insert into public.eventos_dominio (tipo, chave, aprovacao_id, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload, processado_em)
    values ('design.cliente_' || new.situacao, v_chave, new.id, 'design_deliverable', d.id, new.versao, d.client_id,
            coalesce(new.registrado_por, new.decidido_por), ator_nome, null,
            jsonb_build_object('origem', coalesce(new.origem_decisao, 'portal'), 'canal', new.canal_decisao), now())
    on conflict (chave) do nothing returning id into ev_id;
    if ev_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev_id, d.designer_id, d.client_id, 'design.cliente_' || new.situacao, tit, msg, '#/design/' || d.id)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists design_sync_decisao_cliente on public.aprovacoes;
create trigger design_sync_decisao_cliente after update of situacao on public.aprovacoes
  for each row execute function public.design_sync_decisao_cliente();

-- ---------------------------------------------------------------------
-- 4. REGISTRAR DECISÃO DO CLIENTE (Admin/Coordenador) — uma ação só
-- ---------------------------------------------------------------------
create or replace function public.design_registrar_decisao_cliente(
  p_deliverable_id uuid, p_decisao text, p_canal text default 'whatsapp',
  p_observacao text default null, p_partes jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare ator public.perfis; d public.design_deliverables%rowtype; v public.design_versoes%rowtype;
        a public.aprovacoes%rowtype; arquivos jsonb; efetivos jsonb; prox int; agora timestamptz := now();
        pt jsonb; parte record; rot text; nome_p text; linhas text; v_motivo text; qtd int := 0; pend text;
begin
  perform set_config('b7.via_funcao', '1', true);
  ator := public.aprov_ator();
  if ator.id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  /* só Administrador e Coordenador de Mídias registram decisão do
     cliente — designer e cliente do Portal não (checado no banco, não
     só no botão) */
  if ator.papel not in ('admin', 'coordenador') then
    raise exception 'Só Administrador ou Coordenador registram a decisão do cliente.' using errcode = '42501';
  end if;
  if p_decisao not in ('enviado', 'aprovado', 'ajustes', 'recusado') then raise exception 'Decisão inválida.'; end if;
  if coalesce(p_canal, '') not in ('whatsapp', 'ligacao', 'reuniao', 'presencial', 'outro') then raise exception 'Canal inválido.'; end if;

  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;
  if d.client_id is null then raise exception 'Esta peça não está vinculada a um cliente.'; end if;
  select * into v from public.design_versoes where deliverable_id = d.id order by numero desc limit 1;
  if not found or v.estado not in ('aprovada_interna', 'enviada_cliente', 'ajuste_cliente', 'aprovada_cliente') then
    raise exception 'A peça precisa estar aprovada internamente antes de registrar a decisão do cliente.';
  end if;
  nome_p := case when d.tipo = 'stories' then 'Story' else 'Slide' end;

  /* a linha em aprovacoes desta versão de Design — cria se a peça ainda
     estava só "aprovada internamente" (foi ao cliente por fora, sem
     Portal): "enviado ao cliente via X", sem notificar Portal nenhum */
  select * into a from public.aprovacoes
   where tipo = 'design_versao' and alvo_id = d.id and deleted_at is null
     and snapshot->>'design_versao_id' = v.id::text
   order by versao desc limit 1 for update;
  if not found then
    select coalesce(jsonb_agg(jsonb_build_object('nome', nome_original, 'caminho', caminho, 'papel', papel) order by posicao), '[]'::jsonb)
      into arquivos from public.design_arquivos where versao_id = v.id and papel in ('preview', 'final');
    /* composição EXATA que o cliente viu: arquivo efetivo por parte, com a
       versão de cada um — é a isto que a aprovação fica presa (§14) */
    select coalesce(jsonb_agg(jsonb_build_object('arquivo_id', e.id, 'parte_id', e.parte_id, 'posicao', e.parte_posicao,
                                                 'versao', vv.numero, 'caminho', e.caminho) order by e.parte_posicao), '[]'::jsonb)
      into efetivos from public.design_arquivos_efetivos(d.id) e join public.design_versoes vv on vv.id = e.versao_id;
    update public.aprovacoes set situacao = 'substituido', updated_at = agora
     where tipo = 'design_versao' and alvo_id = d.id and deleted_at is null and situacao in ('pendente', 'parcial');
    select coalesce(max(versao), 0) + 1 into prox from public.aprovacoes where tipo = 'design_versao' and alvo_id = d.id;
    insert into public.aprovacoes (client_id, tipo, alvo_id, versao, snapshot, situacao, enviado_por, enviado_por_nome, observacao_envio, origem_decisao)
    values (d.client_id, 'design_versao', d.id, prox,
            jsonb_build_object('titulo', d.titulo, 'design_versao_id', v.id, 'numero', v.numero, 'arquivos', arquivos, 'arquivos_efetivos', efetivos),
            'pendente', ator.id, ator.nome, 'Enviado ao cliente via ' || public.design_canal_rotulo(p_canal), 'externa')
    returning * into a;
    if v.estado = 'aprovada_interna' then
      update public.design_versoes set estado = 'enviada_cliente', updated_at = agora where id = v.id;
      update public.design_deliverables set status = 'aguardando_cliente', updated_at = agora where id = d.id;
      if d.kanban_id is not null then
        update public.kanban_demandas set coluna = 'aguardando_cliente', origem_evento = 'design.enviado_cliente', aprovacao_id = a.id, aprovacao_situacao = a.situacao, updated_at = agora where id = d.kanban_id;
      end if;
    end if;
  end if;

  if p_decisao = 'enviado' then
    return jsonb_build_object('resultado', 'enviado', 'aprovacao_id', a.id, 'situacao', a.situacao);
  end if;

  /* idempotência: mesma decisão de novo (duplo clique / retry) não grava,
     não emite, não notifica */
  if a.situacao = p_decisao then
    return jsonb_build_object('resultado', 'inalterado', 'aprovacao_id', a.id, 'situacao', a.situacao);
  end if;
  if a.situacao not in ('pendente', 'parcial') then
    raise exception 'Esta versão já tem decisão do cliente (%). Para trocar, o Administrador precisa anular a decisão anterior.', a.situacao using errcode = 'P0003';
  end if;

  if p_decisao = 'recusado' and coalesce(btrim(p_observacao), '') = '' then
    raise exception 'Recusar exige o motivo do cliente.' using errcode = 'P0005';
  end if;
  if p_decisao = 'ajustes' and coalesce(btrim(p_observacao), '') = '' and jsonb_array_length(coalesce(p_partes, '[]'::jsonb)) = 0 then
    raise exception 'Descreva o que o cliente pediu (ou marque os slides com ajuste).' using errcode = 'P0005';
  end if;
  if p_decisao = 'aprovado' then
    if jsonb_array_length(coalesce(p_partes, '[]'::jsonb)) > 0 then
      raise exception 'Aprovar o todo contradiz os ajustes marcados por slide: desmarque ou registre como ajustes.' using errcode = 'P0004';
    end if;
    select string_agg(lpad((e.parte_posicao + 1)::text, 2, '0'), ', ' order by e.parte_posicao) into pend
      from public.design_arquivos_efetivos(d.id) e where e.cliente_ajuste is not null;
    if pend is not null then
      raise exception 'Não dá pra aprovar: o cliente ainda tem ajuste pendente no(s) slide(s) %.', pend using errcode = 'P0004';
    end if;
  end if;

  /* feedback por slide/frame — na aprovacao_partes (motor de aprovação) e
     no arquivo efetivo da parte (é o que o designer vê no slot) */
  linhas := null;
  for pt in select * from jsonb_array_elements(coalesce(p_partes, '[]'::jsonb)) loop
    select * into parte from public.design_partes_canonicas(d.id) pc where pc.parte_id = (pt->>'parte_id')::uuid;
    if not found then raise exception 'Slide não pertence a esta peça.'; end if;
    if coalesce(btrim(pt->>'mensagem'), '') = '' then raise exception 'Descreva o ajuste do %s %s.', lower(nome_p), lpad((parte.posicao + 1)::text, 2, '0'); end if;
    rot := nome_p || ' ' || lpad((parte.posicao + 1)::text, 2, '0');
    insert into public.aprovacao_partes (aprovacao_id, parte_tipo, parte_id, parte_rotulo, situacao, decidido_por, decidido_por_nome, decidido_em)
    values (a.id, parte.parte_tipo, parte.parte_id, rot, 'ajustes', ator.id, ator.nome, agora)
    on conflict (aprovacao_id, parte_id) do update
      set situacao = 'ajustes', parte_rotulo = excluded.parte_rotulo, decidido_por = excluded.decidido_por,
          decidido_por_nome = excluded.decidido_por_nome, decidido_em = excluded.decidido_em;
    update public.design_arquivos x
       set cliente_ajuste = btrim(pt->>'mensagem'), cliente_ajuste_em = agora, cliente_ajuste_canal = p_canal
     where x.id = (select e.id from public.design_arquivos_efetivos(d.id) e where e.parte_id = parte.parte_id);
    linhas := coalesce(linhas || E'\n', '') || rot || ': ' || btrim(pt->>'mensagem');
    qtd := qtd + 1;
  end loop;

  v_motivo := nullif(btrim(coalesce(p_observacao, '')), '');
  if qtd > 0 then
    v_motivo := qtd || ' ' || lower(nome_p) || case when qtd = 1 then ' precisa' else 's precisam' end || ' de alterações.' ||
              coalesce(E'\n' || v_motivo, '') || E'\n' || linhas;
  end if;

  update public.aprovacoes
     set situacao = p_decisao, motivo = v_motivo,
         decidido_por = ator.id, decidido_por_nome = ator.nome, decidido_em = agora,
         origem_decisao = 'externa', canal_decisao = p_canal,
         registrado_por = ator.id, registrado_por_nome = ator.nome,
         observacao_decisao = nullif(btrim(coalesce(p_observacao, '')), ''),
         updated_at = agora
   where id = a.id returning * into a;

  if a.observacao_decisao is not null then
    insert into public.comentarios (aprovacao_id, autor_id, autor_nome, autor_papel, texto)
    values (a.id, ator.id, ator.nome, ator.papel,
            'Decisão do cliente registrada via ' || public.design_canal_rotulo(p_canal) || ': ' || a.observacao_decisao);
  end if;

  /* evento pelo motor de sempre → notificações da equipe + Kanban da
     peça. O trigger acima já cuidou da peça e do designer. */
  perform public.aprov_emitir('aprovacao.' || case p_decisao when 'aprovado' then 'aprovada' when 'ajustes' then 'ajustes' else 'recusada' end,
                              'decisao:' || a.id || ':' || p_decisao || ':externa' ||
                                case when a.anulada_em is not null then ':' || to_char(a.anulada_em, 'YYYYMMDDHH24MISSUS') else '' end,
                              a, ator, jsonb_build_object('origem', 'externa', 'canal', p_canal, 'motivo', a.motivo, 'versao', a.versao,
                                                          'registrado_por_nome', ator.nome));

  return jsonb_build_object('resultado', 'registrado', 'aprovacao_id', a.id, 'situacao', a.situacao, 'versao', a.versao,
                            'canal', p_canal, 'registrado_por_nome', ator.nome, 'decidido_em', a.decidido_em);
end $$;
revoke all on function public.design_registrar_decisao_cliente(uuid, text, text, text, jsonb) from public;
grant execute on function public.design_registrar_decisao_cliente(uuid, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. APROVAÇÃO INTERNA — não passa por cima de ajuste do cliente pendente
--    (cópia de migration_design_arquivos_v2 §6 + uma trava)
-- ---------------------------------------------------------------------
create or replace function public.design_aprovar_interno(p_versao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype; pendentes text;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe aprova internamente.' using errcode = '42501'; end if;

  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'enviada' then raise exception 'Esta versão não está aguardando revisão interna.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  select * into ator from public.perfis where id = auth.uid();

  select string_agg(lpad((coalesce(e.parte_posicao, 0) + 1)::text, 2, '0'), ', ' order by e.parte_posicao) into pendentes
    from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.revisao = 'ajuste';
  if pendentes is not null then
    raise exception 'Não dá pra aprovar: ainda há ajuste pendente no(s) slide(s) %.', pendentes;
  end if;
  select string_agg(lpad((coalesce(e.parte_posicao, 0) + 1)::text, 2, '0'), ', ' order by e.parte_posicao) into pendentes
    from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.cliente_ajuste is not null;
  if pendentes is not null then
    raise exception 'Não dá pra aprovar: o cliente pediu ajuste no(s) slide(s) % e a arte ainda é a mesma.', pendentes;
  end if;

  update public.design_arquivos a set revisao = 'aprovado', revisado_por = auth.uid(), revisado_em = now()
   where a.id in (select e.id from public.design_arquivos_efetivos(d.id) e where e.revisao is null);

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

/* o registro de arquivo por parte limpa o ajuste do cliente daquele slide
   só quando a NOVA arte substitui a antiga (efetivo muda) — nada a
   fazer aqui: o efetivo passa a ser o arquivo novo, sem cliente_ajuste. */

-- ---------------------------------------------------------------------
-- 6. PAINEL DE APROVAÇÕES — colunas de procedência (no fim, sem drop)
-- ---------------------------------------------------------------------
create or replace view public.aprovacoes_painel
with (security_invoker = true) as
select a.id, a.client_id, a.tipo, a.alvo_id, a.versao, a.situacao, a.motivo,
       a.enviado_por, a.enviado_por_nome, a.enviado_em, a.observacao_envio,
       a.decidido_por, a.decidido_por_nome, a.decidido_em, a.substituida_por,
       a.created_at, a.updated_at,
       a.anulada_em, a.anulada_por, a.anulada_por_nome, a.anulacao_motivo, a.anulacao_visivel_cliente, a.situacao_anterior,
       /* a decisão gravada em decidido_* ainda vale? */
       (a.anulada_em is not null and (a.decidido_em is null or a.decidido_em <= a.anulada_em)) as decisao_anulada,
       c.nome as cliente_nome, c.logo_url as cliente_logo_url,
       public.aprov_titulo(a) as titulo,
       coalesce(jsonb_array_length(a.snapshot->'cenas'), 0) as total_partes,
       (select count(*) from public.aprovacao_partes p where p.aprovacao_id = a.id and p.situacao = 'aprovada') as partes_aprovadas,
       (select count(*) from public.aprovacao_partes p where p.aprovacao_id = a.id and p.situacao = 'ajustes') as partes_ajustes,
       (select count(*) from public.aprovacao_partes p where p.aprovacao_id = a.id and p.anulada_em is not null) as partes_anuladas,
       (select count(*) from public.comentarios cm where cm.aprovacao_id = a.id and cm.resolvido = false) as comentarios_abertos,
       (select count(*) from public.comentarios cm where cm.aprovacao_id = a.id) as comentarios_total,
       (select max(cm.created_at) from public.comentarios cm where cm.aprovacao_id = a.id and cm.autor_papel = 'cliente') as ultima_resposta_cliente,
       (select d.id from public.kanban_demandas d where d.tipo_vinculo = a.tipo and d.vinculo_id = a.alvo_id
          and d.deleted_at is null and d.arquivada_em is null order by d.updated_at desc limit 1) as demanda_id,
       (select d.coluna from public.kanban_demandas d where d.tipo_vinculo = a.tipo and d.vinculo_id = a.alvo_id
          and d.deleted_at is null and d.arquivada_em is null order by d.updated_at desc limit 1) as demanda_coluna,
       (select d.aviso from public.kanban_demandas d where d.tipo_vinculo = a.tipo and d.vinculo_id = a.alvo_id
          and d.deleted_at is null and d.arquivada_em is null order by d.updated_at desc limit 1) as demanda_aviso,
       (a.versao = (select max(x.versao) from public.aprovacoes x
                     where x.tipo = a.tipo and x.alvo_id = a.alvo_id and x.deleted_at is null)) as versao_atual,
       case a.tipo when 'roteiro' then (select r.recording_session_id from public.roteiros r where r.id = a.alvo_id) end as gravacao_id,
       case a.tipo when 'conteudo' then (select ct.linha_id from public.conteudos ct where ct.id = a.alvo_id) end as linha_id,
       /* procedência da decisão (decisão do cliente registrada pela B7) —
          colunas novas SÓ NO FIM: create or replace view exige */
       a.origem_decisao, a.canal_decisao, a.registrado_por, a.registrado_por_nome, a.observacao_decisao
  from public.aprovacoes a
  join public.clientes c on c.id = a.client_id
 where a.deleted_at is null;
