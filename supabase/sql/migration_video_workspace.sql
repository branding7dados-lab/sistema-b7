-- =========================================================================
-- B7 VÍDEO — WORKSPACE DE VÍDEO (PARTE 2)
-- =========================================================================
-- Estende o sistema de Vídeo já existente (Parte 1) — NÃO recria nada:
-- Demandas de Edição, importação de planilha, Kanban mensal, Produção
-- de Vídeo, Central de Vídeo e o fluxo "Aguardando aprovação" continuam
-- exatamente como estão. Isso aqui é aditivo.
--
-- O que entra:
--   1) Versões de vídeo (V01, V02, V03...) por demanda, com numeração
--      seguindo o padrão transacional já usado em outras partes do
--      sistema (lock na linha "pai" antes de calcular o próximo número
--      — evita duas V02 por causa de duplo clique/retry).
--   2) "Enviar para aprovação" — vincula a versão atual ao ciclo de
--      aprovação e reusa o video_mudar_status já existente (não duplica
--      notificação nem mexe no Kanban por fora).
--   3) "Registrar decisão do cliente" — só equipe (admin/coordenador,
--      igual sou_equipe() já usa em todo o sistema); guarda quem
--      registrou e por qual canal, nunca finge que foi o cliente que
--      clicou. A decisão fica amarrada à versão exata.
--   4) "Registrar entrega" — só libera se a versão atual foi realmente
--      aprovada pelo cliente; não deixa entregar uma versão errada.
--
-- Arquivo NÃO cobre (ver relatório): player de vídeo embutido (os
-- materiais do B7 são link externo — Drive/WeTransfer —, não upload
-- pra dentro do sistema; não existe infraestrutura de hospedagem pra
-- embutir player), timecode, vínculo formal Gravação→múltiplas
-- Demandas, Portal do cliente.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. TABELA DE VERSÕES
-- ---------------------------------------------------------------------
create table if not exists public.video_versoes (
  id                      uuid primary key default gen_random_uuid(),
  demanda_id              uuid not null references public.demandas_edicao(id) on delete cascade,
  numero                  int not null,
  arquivo_url             text not null default '',   -- link externo (Drive/WeTransfer/...), mesmo padrão de link_material
  arquivo_nome            text not null default '',
  observacao              text not null default '',   -- nota de quem enviou a versão (opcional)
  criado_por              uuid references public.perfis(id),
  created_at              timestamptz not null default now(),
  enviada_aprovacao_em    timestamptz,
  decisao_cliente         text check (decisao_cliente in ('aprovado', 'correcao', 'recusado')),
  decisao_em              timestamptz,
  decisao_canal           text check (decisao_canal in ('whatsapp', 'ligacao', 'reuniao', 'presencial', 'portal', 'outro')),
  decisao_registrado_por  uuid references public.perfis(id),
  decisao_observacao      text not null default '',
  entregue_em             timestamptz,
  unique (demanda_id, numero)
);
create index if not exists video_versoes_demanda on public.video_versoes (demanda_id, numero desc);

alter table public.video_versoes enable row level security;
revoke insert, update, delete on public.video_versoes from authenticated;
grant select on public.video_versoes to authenticated;

drop policy if exists "video_versoes select" on public.video_versoes;
create policy "video_versoes select" on public.video_versoes
  for select to authenticated
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or d.videomaker_id = auth.uid())
                    and public.sou_equipe_interna()));

/* view de leitura — só pra trazer o nome de quem criou/registrou a
   decisão junto (a UI mostra "registrado por Fulano"), sem duplicar
   essa lógica no frontend. RLS de video_versoes já filtra a base. */
create or replace view public.video_versoes_resumo
with (security_invoker = true) as
select vv.*, pc.nome as criado_por_nome, pd.nome as decisao_registrado_por_nome
  from public.video_versoes vv
  left join public.perfis pc on pc.id = vv.criado_por
  left join public.perfis pd on pd.id = vv.decisao_registrado_por;
grant select on public.video_versoes_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 2. CRIAR VERSÃO — numeração segura (lock na demanda antes de calcular
--    o próximo número; duplo clique/retry não gera V02 duplicada)
-- ---------------------------------------------------------------------
create or replace function public.video_criar_versao(
  p_demanda_id uuid, p_arquivo_url text default '', p_arquivo_nome text default '', p_observacao text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; prox int; nova uuid;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para registrar versão nesta demanda.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_arquivo_url), '') = '' then
    raise exception 'Informe o link do vídeo.';
  end if;

  select coalesce(max(numero), 0) + 1 into prox from public.video_versoes where demanda_id = p_demanda_id;
  select * into ator from public.perfis where id = auth.uid();

  insert into public.video_versoes (demanda_id, numero, arquivo_url, arquivo_nome, observacao, criado_por)
  values (p_demanda_id, prox, btrim(p_arquivo_url), coalesce(p_arquivo_nome, ''), coalesce(p_observacao, ''), auth.uid())
  returning id into nova;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'versao', auth.uid(), ator.nome, ator.papel, 'V' || lpad(prox::text, 2, '0') || ' registrada');

  return nova;
end;
$$;
revoke all on function public.video_criar_versao(uuid, text, text, text) from public;
grant execute on function public.video_criar_versao(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ENVIAR PARA APROVAÇÃO — vincula a versão atual ao ciclo e reusa
--    video_mudar_status (Parte 1) pra não duplicar notificação/Kanban.
-- ---------------------------------------------------------------------
create or replace function public.video_enviar_para_aprovacao(p_demanda_id uuid, p_versao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.video_versoes%rowtype; maior int;
begin
  select * into v from public.video_versoes where id = p_versao_id and demanda_id = p_demanda_id;
  if not found then raise exception 'Versão não encontrada.'; end if;

  select max(numero) into maior from public.video_versoes where demanda_id = p_demanda_id;
  if v.numero <> maior then
    raise exception 'Só a versão mais recente pode ser enviada para aprovação.';
  end if;

  update public.video_versoes set enviada_aprovacao_em = now() where id = p_versao_id and enviada_aprovacao_em is null;

  perform public.video_mudar_status(p_demanda_id, 'aguardando_aprovacao', null);
end;
$$;
revoke all on function public.video_enviar_para_aprovacao(uuid, uuid) from public;
grant execute on function public.video_enviar_para_aprovacao(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. REGISTRAR DECISÃO DO CLIENTE — só equipe (admin/coordenador; quem
--    também é videomaker continua contando, porque sou_equipe() olha
--    o cargo, não exclusividade). Nunca finge sessão de cliente: o
--    ator gravado é sempre quem está logado registrando.
-- ---------------------------------------------------------------------
create or replace function public.video_registrar_decisao_cliente(
  p_versao_id uuid, p_decisao text, p_canal text default 'outro', p_observacao text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare v public.video_versoes%rowtype; d public.demandas_edicao%rowtype; ator public.perfis%rowtype; maior int; evid uuid; tit text;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador registra a decisão do cliente.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovado', 'correcao', 'recusado') then
    raise exception 'Decisão inválida.';
  end if;
  if p_canal is null or p_canal not in ('whatsapp', 'ligacao', 'reuniao', 'presencial', 'portal', 'outro') then
    raise exception 'Canal inválido.';
  end if;
  if p_decisao is distinct from 'aprovado' and coalesce(btrim(p_observacao), '') = '' then
    raise exception 'Descreva o que o cliente pediu.';
  end if;

  select * into v from public.video_versoes where id = p_versao_id;
  if not found then raise exception 'Versão não encontrada.'; end if;
  select max(numero) into maior from public.video_versoes where demanda_id = v.demanda_id;
  if v.numero <> maior then
    raise exception 'Essa não é mais a versão atual — a decisão só pode ser registrada na versão vigente.';
  end if;

  select * into d from public.demandas_edicao where id = v.demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  select * into ator from public.perfis where id = auth.uid();

  update public.video_versoes
     set decisao_cliente = p_decisao, decisao_em = now(), decisao_canal = p_canal,
         decisao_registrado_por = auth.uid(), decisao_observacao = coalesce(p_observacao, '')
   where id = p_versao_id;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (v.demanda_id, 'decisao_cliente', auth.uid(), ator.nome, ator.papel,
    case p_decisao
      when 'aprovado' then 'Cliente aprovou a V' || lpad(v.numero::text, 2, '0')
      when 'recusado' then 'Cliente recusou a V' || lpad(v.numero::text, 2, '0')
      else 'Cliente pediu correção na V' || lpad(v.numero::text, 2, '0')
    end || ' — via ' || p_canal || coalesce(nullif(' — ' || btrim(p_observacao), ' — '), ''));

  if p_decisao = 'aprovado' then
    /* não entrega sozinho — só fica pronta pra "Registrar entrega".
       avisa o videomaker que já pode preparar a entrega. */
    if d.videomaker_id is not null then
      insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
      values (gen_random_uuid(), 'video.aprovado_cliente', 'video.aprovado_cliente:' || p_versao_id || ':' || now()::text,
              'demanda_edicao', v.demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
              jsonb_build_object('titulo', d.titulo, 'versao', v.numero))
      returning id into evid;
      perform public.video_processar_evento(evid);
    end if;
  else
    -- correção ou recusa: volta pro editor, reusando o fluxo já existente
    -- (mesma notificação/Kanban/evento de "correcao" da Parte 1).
    perform public.video_mudar_status(v.demanda_id, 'correcao',
      'Cliente (via ' || p_canal || '): ' || btrim(p_observacao));
  end if;
end;
$$;
revoke all on function public.video_registrar_decisao_cliente(uuid, text, text, text) from public;
grant execute on function public.video_registrar_decisao_cliente(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. REGISTRAR ENTREGA — só libera se a versão atual foi aprovada pelo
--    cliente. Reusa video_mudar_status('entregue') da Parte 1.
-- ---------------------------------------------------------------------
create or replace function public.video_registrar_entrega(p_demanda_id uuid, p_versao_id uuid, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.video_versoes%rowtype; maior int;
begin
  select * into v from public.video_versoes where id = p_versao_id and demanda_id = p_demanda_id;
  if not found then raise exception 'Versão não encontrada.'; end if;
  select max(numero) into maior from public.video_versoes where demanda_id = p_demanda_id;
  if v.numero <> maior then
    raise exception 'Só a versão atual pode ser entregue.';
  end if;
  if v.decisao_cliente is distinct from 'aprovado' then
    raise exception 'Essa versão ainda não foi aprovada pelo cliente.';
  end if;

  update public.video_versoes set entregue_em = now() where id = p_versao_id;
  perform public.video_mudar_status(p_demanda_id, 'entregue', p_mensagem);
end;
$$;
revoke all on function public.video_registrar_entrega(uuid, uuid, text) from public;
grant execute on function public.video_registrar_entrega(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. NOTIFICAÇÃO — cliente aprovou (avisa o videomaker responsável;
--    dedupe pelo mesmo mecanismo já existente: evento_id+destinatario).
-- ---------------------------------------------------------------------
create or replace function public.video_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.demandas_edicao%rowtype;
  tit text; msg text; link text;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;
  if ev.alvo_tipo <> 'demanda_edicao' then
    update public.eventos_dominio set processado_em = now() where id = ev.id;
    return;
  end if;

  select * into d from public.demandas_edicao where id = ev.alvo_id;
  if not found then
    update public.eventos_dominio set processado_em = now(), erro = 'demanda de edição não encontrada' where id = ev.id;
    return;
  end if;

  link := '#/video/' || d.id;

  if ev.tipo = 'video.atribuida' and ev.payload->>'videomaker_id' is not null then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' atribuiu "' || coalesce(ev.payload->>'titulo', d.titulo) || '" a ' ||
           coalesce(ev.payload->>'videomaker_nome', 'um videomaker');
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    values (ev.id, (ev.payload->>'videomaker_id')::uuid, d.client_id, ev.tipo, tit, null, link)
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.aguardando_aprovacao' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' enviou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" para aprovação';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.aprovado_cliente' then
    tit := 'Cliente aprovou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" (V' || lpad(coalesce(ev.payload->>'versao', '?'), 2, '0') || ')';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, null, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

  elsif ev.tipo = 'video.entregue' then
    tit := coalesce(ev.ator_nome, 'O videomaker') || ' marcou "' || coalesce(ev.payload->>'titulo', d.titulo) || '" como entregue';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;

  elsif ev.tipo = 'video.correcao_solicitada' then
    tit := coalesce(ev.ator_nome, 'A equipe') || ' pediu correção em "' || coalesce(ev.payload->>'titulo', d.titulo) || '"';
    msg := ev.payload->>'mensagem';
    if d.videomaker_id is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, d.videomaker_id, d.client_id, ev.tipo, tit, msg, link)
      on conflict (evento_id, destinatario_id) do nothing;
    end if;
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.video_processar_evento(uuid) from public;
grant execute on function public.video_processar_evento(uuid) to authenticated;
