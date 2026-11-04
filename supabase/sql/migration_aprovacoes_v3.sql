-- =====================================================================
-- APROVAÇÕES v3 — "Excluir aprovação" (anulação auditada pelo Admin)
--
-- Rode DEPOIS de migration_push.sql e ANTES de migration_rls.sql.
-- Aditiva e idempotente. Depende de migration_aprovacoes_v2.sql.
--
-- O dono quer remover uma aprovação errada do cliente. Nada é apagado:
-- a anulação é um evento de negócio auditado (quem, quando, motivo),
-- e a aprovação volta ao estado de revisão correto.
--
-- DECISÃO DE MODELAGEM — por que NÃO existe situacao = 'anulado':
--   A anulação não é um estado final do material: ela devolve a versão
--   ao estado em que o cliente ainda pode decidir (pendente/parcial). Um
--   estado terminal 'anulado' exigiria que aprov_decidir e todas as
--   listas tratassem mais um caso, e o portal precisaria de um segundo
--   caminho para "decidir de novo". Em vez disso:
--     • aprovacoes.anulada_em / anulada_por / anulacao_motivo guardam a
--       auditoria; situacao_anterior guarda o que foi anulado;
--     • situacao é RECALCULADA: parcial se há cena decidida válida,
--       pendente se não há; substituido se já existe versão mais nova
--       (aí não aceita decisão — abre-se a versão atual);
--     • decidido_por / decidido_em / motivo ficam como estavam (prova da
--       decisão original). "Decisão vigente" = decidido_em > anulada_em.
--   O check de situacao permanece o da v2.
--
-- Escopos:
--   'total' — anula a decisão do todo (aprovado | ajustes | recusado).
--             Decisões por cena válidas são preservadas.
--   'parte' — anula só a decisão daquela cena e recalcula o todo.
--
-- Kanban: se a demanda ligada saiu de lugar por causa dessa decisão
-- (origem_evento = aprovacao.aprovada e coluna = pronto; ou
-- aprovacao.ajustes/recusada e coluna = ajustes), não está travada nem
-- concluída, volta para aguardando_cliente com histórico. Se já foi
-- concluída, está travada ou foi movida manualmente depois, NÃO move:
-- grava kanban_demandas.aviso para a equipe revisar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUNAS DE AUDITORIA
-- ---------------------------------------------------------------------
alter table public.aprovacoes add column if not exists anulada_em timestamptz;
alter table public.aprovacoes add column if not exists anulada_por uuid references public.perfis(id) on delete set null;
alter table public.aprovacoes add column if not exists anulada_por_nome text;
alter table public.aprovacoes add column if not exists anulacao_motivo text;
alter table public.aprovacoes add column if not exists anulacao_visivel_cliente boolean not null default false;
alter table public.aprovacoes add column if not exists situacao_anterior text;

alter table public.aprovacao_partes add column if not exists anulada_em timestamptz;
alter table public.aprovacao_partes add column if not exists anulada_por uuid references public.perfis(id) on delete set null;
alter table public.aprovacao_partes add column if not exists anulada_por_nome text;
alter table public.aprovacao_partes add column if not exists anulacao_motivo text;
alter table public.aprovacao_partes add column if not exists anulacao_visivel_cliente boolean not null default false;
alter table public.aprovacao_partes add column if not exists situacao_anterior text;

alter table public.kanban_demandas add column if not exists aviso text;

create index if not exists aprovacoes_anuladas on public.aprovacoes (alvo_id, anulada_em desc) where anulada_em is not null;

-- ---------------------------------------------------------------------
-- 2. PROCESSAMENTO DE EVENTOS — versão completa da v2 + anulação
--    (create or replace: substitui a função inteira)
-- ---------------------------------------------------------------------
/* "do roteiro" / "da linha editorial" — contração de "de" + rótulo */
create or replace function public.aprov_rotulo_tipo_de(t text)
returns text language sql immutable as $$
  select case when r like 'o %' then 'do ' || substr(r, 3)
              when r like 'a %' then 'da ' || substr(r, 3)
              else 'de ' || r end
    from (select public.aprov_rotulo_tipo(t) as r) x
$$;
grant execute on function public.aprov_rotulo_tipo_de(text) to authenticated, anon;

create or replace function public.aprov_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev  public.eventos_dominio%rowtype;
  a   public.aprovacoes%rowtype;
  emp text; titulo text; quem text; msg text; tit text; link_eq text; link_cl text;
  msg_cl text; tit_cl text;
  d   record;
  destino text; tipo_dem text; n int := 0;
  anterior text; esperado text; motivo_an text;
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

  for d in select * from public.kanban_demandas
            where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id
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

-- ---------------------------------------------------------------------
-- 3. ANULAR (só Admin)
-- ---------------------------------------------------------------------
create or replace function public.aprov_anular(p_aprovacao_id uuid, p_escopo text, p_parte_id uuid default null,
                                               p_motivo text default null, p_visivel_cliente boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ator public.perfis; a public.aprovacoes; pt public.aprovacao_partes;
  anterior text; nova text; ha_mais_nova boolean; decididas int; ev_id uuid; agora timestamptz := now();
begin
  perform set_config('b7.via_funcao', '1', true);
  ator := public.aprov_ator();
  if ator.id is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if ator.papel <> 'admin' then
    raise exception 'Só o Administrador pode excluir uma aprovação.' using errcode = '42501';
  end if;
  if coalesce(p_escopo, '') not in ('total', 'parte') then
    raise exception 'Escopo inválido: % (use total ou parte).', p_escopo;
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da exclusão.' using errcode = 'P0005';
  end if;

  select * into a from public.aprovacoes where id = p_aprovacao_id and deleted_at is null for update;
  if not found then raise exception 'Aprovação não encontrada.' using errcode = 'P0002'; end if;

  ha_mais_nova := exists (select 1 from public.aprovacoes x where x.tipo = a.tipo and x.alvo_id = a.alvo_id
                           and x.deleted_at is null and x.versao > a.versao);

  if p_escopo = 'total' then
    if a.situacao not in ('aprovado', 'ajustes', 'recusado') then
      if a.anulada_em is not null and (a.decidido_em is null or a.decidido_em <= a.anulada_em) then
        raise exception 'Esta decisão já foi anulada em % por %.', to_char(a.anulada_em, 'DD/MM/YYYY HH24:MI'),
          coalesce(a.anulada_por_nome, 'Administrador') using errcode = 'P0003';
      end if;
      raise exception 'Esta versão não tem decisão do cliente para anular (situação: %).', a.situacao using errcode = 'P0003';
    end if;
    anterior := a.situacao;
    select count(*) into decididas from public.aprovacao_partes
     where aprovacao_id = a.id and situacao <> 'pendente';
    nova := case when ha_mais_nova then 'substituido'
                 when decididas > 0 then 'parcial' else 'pendente' end;

    update public.aprovacoes
       set situacao = nova, situacao_anterior = anterior,
           anulada_em = agora, anulada_por = ator.id, anulada_por_nome = ator.nome,
           anulacao_motivo = trim(p_motivo), anulacao_visivel_cliente = coalesce(p_visivel_cliente, false),
           updated_at = agora
     where id = a.id returning * into a;

    ev_id := public.aprov_emitir('aprovacao.anulada',
      'anulada:' || a.id || ':' || to_char(agora, 'YYYYMMDDHH24MISSUS'), a, ator,
      jsonb_build_object('motivo', trim(p_motivo), 'visivel_cliente', coalesce(p_visivel_cliente, false),
                         'situacao_anterior', anterior, 'situacao_nova', nova, 'versao', a.versao,
                         'decidido_por_nome', a.decidido_por_nome, 'decidido_em', a.decidido_em));

    return jsonb_build_object('resultado', 'anulada', 'escopo', 'total', 'situacao', a.situacao,
                              'situacao_anterior', anterior, 'anulada_em', a.anulada_em, 'evento_id', ev_id);
  end if;

  /* escopo = parte */
  if p_parte_id is null then raise exception 'Informe a cena a anular.' using errcode = 'P0002'; end if;
  select * into pt from public.aprovacao_partes where aprovacao_id = a.id and parte_id = p_parte_id for update;
  if not found then raise exception 'Esta cena não tem decisão registrada.' using errcode = 'P0002'; end if;
  if pt.situacao = 'pendente' then
    if pt.anulada_em is not null then
      raise exception 'A decisão desta cena já foi anulada em % por %.', to_char(pt.anulada_em, 'DD/MM/YYYY HH24:MI'),
        coalesce(pt.anulada_por_nome, 'Administrador') using errcode = 'P0003';
    end if;
    raise exception 'Esta cena não tem decisão para anular.' using errcode = 'P0003';
  end if;
  anterior := pt.situacao;

  update public.aprovacao_partes
     set situacao = 'pendente', situacao_anterior = anterior,
         anulada_em = agora, anulada_por = ator.id, anulada_por_nome = ator.nome,
         anulacao_motivo = trim(p_motivo), anulacao_visivel_cliente = coalesce(p_visivel_cliente, false),
         updated_at = agora
   where id = pt.id returning * into pt;

  /* recalcula o todo só enquanto o cliente ainda não decidiu o todo */
  if a.situacao in ('pendente', 'parcial') then
    select count(*) into decididas from public.aprovacao_partes
     where aprovacao_id = a.id and situacao <> 'pendente';
    nova := case when decididas > 0 then 'parcial' else 'pendente' end;
    if nova <> a.situacao then
      update public.aprovacoes set situacao = nova, updated_at = agora where id = a.id returning * into a;
    end if;
  end if;

  ev_id := public.aprov_emitir('parte.anulada',
    'anulada:' || a.id || ':' || p_parte_id || ':' || to_char(agora, 'YYYYMMDDHH24MISSUS'), a, ator,
    jsonb_build_object('motivo', trim(p_motivo), 'visivel_cliente', coalesce(p_visivel_cliente, false),
                       'situacao_anterior', anterior, 'parte_id', p_parte_id, 'rotulo', pt.parte_rotulo,
                       'versao', a.versao, 'decidido_por_nome', pt.decidido_por_nome, 'decidido_em', pt.decidido_em));

  return jsonb_build_object('resultado', 'anulada', 'escopo', 'parte', 'parte_id', p_parte_id,
                            'situacao', a.situacao, 'situacao_anterior', anterior,
                            'anulada_em', pt.anulada_em, 'evento_id', ev_id);
end $$;

-- ---------------------------------------------------------------------
-- 3b. DECISÃO DO TODO — cópia da v2 com UMA mudança: a chave do evento
--     inclui anulada_em. Sem isso, o cliente que decide de novo depois
--     de uma anulação colidiria com a chave 'decisao:<ap>:aprovado' da
--     decisão anulada e a nova decisão não geraria evento (nem
--     notificação, nem Kanban). A anulação NÃO bloqueia nova decisão:
--     a versão volta a pendente/parcial e o cliente decide de novo.
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
                              'decisao:' || a.id || ':' || p_situacao ||
                                case when a.anulada_em is not null then ':' || to_char(a.anulada_em, 'YYYYMMDDHH24MISSUS') else '' end,
                              a, ator,
                              jsonb_build_object('motivo', a.motivo, 'versao', a.versao));

  return jsonb_build_object('resultado', 'registrado', 'situacao', a.situacao,
                            'decidido_em', a.decidido_em, 'decidido_por_nome', a.decidido_por_nome, 'versao', a.versao);
end $$;
grant execute on function public.aprov_decidir(uuid, text, text, int) to authenticated;

revoke all on function public.aprov_anular(uuid, text, uuid, text, boolean) from public;
grant execute on function public.aprov_anular(uuid, text, uuid, text, boolean) to authenticated;
revoke all on function public.aprov_processar_evento(uuid) from public;

-- ---------------------------------------------------------------------
-- 4. PAINEL — ganha as colunas de anulação
-- ---------------------------------------------------------------------
drop view if exists public.aprovacoes_pendentes;
drop view if exists public.aprovacoes_painel;
create view public.aprovacoes_painel
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
       case a.tipo when 'conteudo' then (select ct.linha_id from public.conteudos ct where ct.id = a.alvo_id) end as linha_id
  from public.aprovacoes a
  join public.clientes c on c.id = a.client_id
 where a.deleted_at is null;

create view public.aprovacoes_pendentes with (security_invoker = true) as
select id, client_id, tipo, alvo_id, versao, situacao, enviado_em, observacao_envio,
       cliente_nome, titulo, comentarios_abertos
  from public.aprovacoes_painel;

grant select on public.aprovacoes_painel to authenticated;
grant select on public.aprovacoes_pendentes to authenticated;
select public.b7_grant_anon_se_aberto('aprovacoes_painel');
select public.b7_grant_anon_se_aberto('aprovacoes_pendentes');

/* kanban_resumo usa d.*: recria para enxergar kanban_demandas.aviso */
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

select 'migration_aprovacoes_v3 aplicada' as resultado;
