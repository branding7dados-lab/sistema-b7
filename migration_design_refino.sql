/* =====================================================================
   B7 DESIGN — REFINO OPERACIONAL
   Migração aditiva sobre migration_design.sql. Não recria nem apaga nada
   que já existe; só estende.

   O que entra aqui:
     1. Upload deixa de ser obrigatório: design_versoes ganha `via`
        ('upload' | 'externa') e `canal_externo` (ex.: "WhatsApp"), e
        design_versao_enviar só exige arquivo quando via='upload'.
        Todo o resto do ciclo (ajuste, aprovação interna, finalização,
        Kanban, notificações, histórico) já funciona igual para as duas
        vias — não dependia de arquivo, dependia do estado da versão.
     2. "Assumir demanda" em lote por Linha Editorial: uma função só,
        idempotente, que reivindica apenas peças elegíveis (sem
        responsável, não finalizadas) daquela linha para quem chamou.

   Rode depois de migration_design.sql (que por sua vez roda depois de
   migration_rls.sql — ver migration_tudo.sql).
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. VIA DA VERSÃO — upload (arquivo no sistema) ou externa (revisada
--    fora, ex. WhatsApp). Nunca finge que um arquivo existe quando não
--    existe: a interface e as notificações mostram a via real.
-- ---------------------------------------------------------------------
alter table public.design_versoes add column if not exists via text not null default 'upload';
alter table public.design_versoes add column if not exists canal_externo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_versao_via_valida') then
    alter table public.design_versoes add constraint design_versao_via_valida
      check (via in ('upload', 'externa'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. design_versao_enviar — upload some ser obrigatório
--    Substitui a versão anterior (migration_design.sql §13): mesma
--    assinatura de nome, dois parâmetros novos com default, então nada
--    que já chama esta função com 2 argumentos quebra.
-- ---------------------------------------------------------------------
-- a versão antiga (2 parâmetros) de migration_design.sql precisa sair:
-- com os dois no catálogo, uma chamada com 2 argumentos fica ambígua
-- (Postgres não escolhe entre "a função de 2 parâmetros" e "a de 4 com
-- os 2 últimos por default") e toda chamada existente passa a falhar.
drop function if exists public.design_versao_enviar(uuid, text);

create or replace function public.design_versao_enviar(
  p_versao_id uuid, p_observacao text default '',
  p_via text default 'upload', p_canal text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
        qtd_arquivos int; k uuid; via_final text;
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

  via_final := case when p_via = 'externa' then 'externa' else 'upload' end;

  select count(*) into qtd_arquivos from public.design_arquivos where versao_id = v.id;
  if via_final = 'upload' and qtd_arquivos = 0 then
    raise exception 'Envie ao menos um arquivo, ou registre que a arte foi revisada por fora (ex.: WhatsApp).';
  end if;

  select * into ator from public.perfis where id = auth.uid();

  update public.design_versoes
     set estado = 'enviada', observacao = coalesce(p_observacao, ''), enviada_em = now(), updated_at = now(),
         via = via_final, canal_externo = case when via_final = 'externa' then nullif(btrim(coalesce(p_canal, '')), '') else null end
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
          auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'titulo', d.titulo,
                              'via', via_final, 'canal_externo', case when via_final = 'externa' then nullif(btrim(coalesce(p_canal, '')), '') else null end));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.versao_enviada:' || v.id));
end;
$$;
revoke all on function public.design_versao_enviar(uuid, text, text, text) from public;
grant execute on function public.design_versao_enviar(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. design_versao_rascunho — precisa poder abrir um rascunho mesmo sem
--    nenhum arquivo ainda (a via externa nunca passa pelo upload).
--    A função já fazia isso (não depende de arquivo); mantém-se igual,
--    só documentando aqui que o refino conta com esse comportamento.
-- ---------------------------------------------------------------------
-- (sem alteração — design_versao_rascunho de migration_design.sql já serve)

-- ---------------------------------------------------------------------
-- 4. NOTIFICAÇÕES — mensagem honesta sobre a via (upload x externa)
-- ---------------------------------------------------------------------
create or replace function public.design_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.design_deliverables%rowtype;
  tit text; msg text; link text; via text; canal text;
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
    via := coalesce(ev.payload->>'via', 'upload');
    canal := ev.payload->>'canal_externo';
    tit := coalesce(ev.ator_nome, 'O designer') || ' enviou a V' || lpad(ev.versao::text, 2, '0') || ' de "' || d.titulo || '" para revisão' ||
           case when via = 'externa' then ' (revisada por fora' || case when coalesce(canal, '') <> '' then ' — ' || canal else '' end || ')' else '' end;
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

  elsif ev.tipo = 'design.demanda_assumida' then
    tit := coalesce(ev.ator_nome, 'Um designer') || ' assumiu "' || d.titulo || '"';
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select ev.id, p.id, d.client_id, ev.tipo, tit, null, link
      from public.perfis p where p.estado = 'ativa' and p.papel in ('admin', 'coordenador') and p.id is distinct from ev.ator_id
    on conflict (evento_id, destinatario_id) do nothing;
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;
revoke all on function public.design_processar_evento(uuid) from public;
grant execute on function public.design_processar_evento(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. "ASSUMIR DEMANDA" EM LOTE, POR LINHA EDITORIAL
--    Só reivindica peças elegíveis: desta linha, sem responsável, não
--    finalizadas. Idempotente — rodar de novo sem peças novas não
--    reivindica nada (n_assumidas=0), nunca conta o que já é seu.
--    Convive com atribuição manual/individual: não assume nada que já
--    tenha responsável, mesmo que seja outro designer.
-- ---------------------------------------------------------------------
create or replace function public.design_assumir_demanda_linha(p_linha_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  n_assumidas int := 0;
  ator public.perfis%rowtype;
begin
  if not public.sou_designer() then
    raise exception 'Só um Designer pode assumir demandas.' using errcode = '42501';
  end if;
  select * into ator from public.perfis where id = auth.uid();

  for r in
    select id from public.design_deliverables
     where linha_id = p_linha_id and deleted_at is null
       and designer_id is null and status <> 'finalizado'
     for update skip locked
  loop
    update public.design_deliverables
       set designer_id = auth.uid(), updated_at = now(),
           status = case when status = 'aguardando_producao' then 'em_criacao' else status end
     where id = r.id;

    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    select 'design.demanda_assumida', 'design.demanda_assumida:' || r.id || ':' || now()::text,
           'design_deliverable', r.id, d.client_id, auth.uid(), ator.nome, ator.papel,
           jsonb_build_object('designer_id', auth.uid(), 'designer_nome', ator.nome)
      from public.design_deliverables d where d.id = r.id;
    perform public.design_processar_evento((select id from public.eventos_dominio
      where chave = 'design.demanda_assumida:' || r.id || ':' || now()::text order by created_at desc limit 1));

    update public.kanban_demandas k set responsavel_id = auth.uid(), updated_at = now()
      from public.design_deliverables d where d.kanban_id = k.id and d.id = r.id;

    n_assumidas := n_assumidas + 1;
  end loop;

  return jsonb_build_object('assumidas', n_assumidas);
end;
$$;
revoke all on function public.design_assumir_demanda_linha(uuid) from public;
grant execute on function public.design_assumir_demanda_linha(uuid) to authenticated;
