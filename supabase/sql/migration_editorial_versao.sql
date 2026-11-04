/* =====================================================================
   LINHA EDITORIAL — CONCLUSÃO FORMAL E VERSIONAMENTO
   Migração aditiva. Não mexe no campo `linhas_editoriais.status`
   (rótulo manual e descritivo — "Em criação/Em revisão/Aprovada/
   Finalizada" — que continua existindo e funcionando exatamente como
   antes). Isto aqui é outra coisa: um PORTÃO FORMAL de liberação para o
   Design, sem o qual o Design não tinha como saber com segurança "isto
   aqui já é definitivo, pode produzir" — hoje qualquer conteúdo em
   qualquer estado podia ser mandado para Design a qualquer momento via
   "Enviar para Design" manual, mesmo em rascunho.

   "Concluir Linha Editorial" (Admin/Coordenador):
     1. grava um snapshot da linha nesse instante (linha_versoes);
     2. gera as peças de Design que ainda não existem (reaproveita
        design_gerar_da_linha — idempotente, sem duplicar);
     3. reconcilia peças já existentes: se o briefing mudou desde a
        última conclusão, marca "briefing_desatualizado";
     4. opcionalmente atribui tudo elegível a um Designer;
     5. manda UMA notificação agrupada (nunca uma por peça).

   Reabrir/editar a linha depois de concluída continua livre — a equipe
   sempre pôde editar. O que muda é que a PRÓXIMA conclusão é que vira
   oficial (V02, V03…): V01 nunca é apagada, fica em linha_versoes.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. COLUNAS DE CONTROLE NA LINHA
-- ---------------------------------------------------------------------
alter table public.linhas_editoriais add column if not exists concluida_em timestamptz;
alter table public.linhas_editoriais add column if not exists concluida_por uuid references public.perfis(id) on delete set null;
alter table public.linhas_editoriais add column if not exists versao_design int not null default 0;

-- ---------------------------------------------------------------------
-- 2. HISTÓRICO DE VERSÕES CONCLUÍDAS — snapshot, nunca apagado
-- ---------------------------------------------------------------------
create table if not exists public.linha_versoes (
  id                    uuid primary key default gen_random_uuid(),
  linha_id              uuid not null references public.linhas_editoriais(id) on delete cascade,
  versao                int not null,
  concluida_em          timestamptz not null default now(),
  concluida_por         uuid references public.perfis(id) on delete set null,
  responsavel_design_id uuid references public.perfis(id) on delete set null,
  snapshot              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
create unique index if not exists linha_versoes_numero_unico on public.linha_versoes (linha_id, versao);
create index if not exists linha_versoes_linha on public.linha_versoes (linha_id, versao desc);

alter table public.linha_versoes enable row level security;
revoke insert, update, delete on public.linha_versoes from authenticated;
grant select on public.linha_versoes to authenticated;

drop policy if exists "linha_versoes select" on public.linha_versoes;
create policy "linha_versoes select" on public.linha_versoes
  for select to authenticated
  using (exists (select 1 from public.linhas_editoriais l
                  where l.id = linha_id
                    and (public.sou_equipe() or public.sou_designer() or
                         (public.posso_ver_cliente(l.client_id) and coalesce(l.visivel_cliente, false)))));

-- ---------------------------------------------------------------------
-- 3. PEÇA DE DESIGN: sinaliza quando o briefing mudou sob os pés dela
-- ---------------------------------------------------------------------
alter table public.design_deliverables add column if not exists briefing_desatualizado boolean not null default false;
alter table public.design_deliverables add column if not exists linha_versao_confirmada int;

-- ---------------------------------------------------------------------
-- 4. SNAPSHOT — o que conta como "o briefing" de cada conteúdo, hoje
-- ---------------------------------------------------------------------
create or replace function public.linha_montar_snapshot(p_linha_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'conteudo_id', c.id, 'tipo', c.tipo, 'titulo', c.titulo,
    'headline', c.headline, 'sub_headline', c.sub_headline, 'objetivo', c.objetivo,
    'cta', c.cta, 'legenda', c.legenda, 'direcao', c.direcao,
    'observacao_design', c.observacao_design, 'precisa_capa', c.precisa_capa,
    'slides', (select coalesce(jsonb_agg(jsonb_build_object('titulo', s.titulo, 'texto', s.texto) order by s.position), '[]'::jsonb)
                 from public.slides s where s.content_id = c.id),
    'frames', (select coalesce(jsonb_agg(jsonb_build_object('texto', f.texto, 'direcao_visual', f.direcao_visual) order by f.position), '[]'::jsonb)
                 from public.frames f where f.content_id = c.id)
  ) order by c.created_at), '[]'::jsonb)
  from public.conteudos c where c.linha_id = p_linha_id and c.deleted_at is null;
$$;
revoke all on function public.linha_montar_snapshot(uuid) from public;
grant execute on function public.linha_montar_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. CONCLUIR LINHA EDITORIAL
-- ---------------------------------------------------------------------
create or replace function public.linha_concluir(p_linha_id uuid, p_responsavel_design_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l public.linhas_editoriais%rowtype;
  ator public.perfis%rowtype;
  alvo public.perfis%rowtype;
  nova_versao int;
  snap jsonb; anterior jsonb;
  resultado_geracao jsonb;
  r record; item_anterior jsonb;
  n_atualizadas int := 0; n_atribuidas int := 0; n_total int := 0;
  vid uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe conclui uma Linha Editorial.' using errcode = '42501';
  end if;

  select * into l from public.linhas_editoriais where id = p_linha_id for update;
  if not found then raise exception 'Linha Editorial não encontrada.' using errcode = 'P0002'; end if;

  if p_responsavel_design_id is not null then
    select * into alvo from public.perfis where id = p_responsavel_design_id and estado = 'ativa';
    if not found or alvo.papel not in ('designer', 'admin', 'coordenador') then
      raise exception 'Responsável pelo Design inválido.';
    end if;
  end if;

  select * into ator from public.perfis where id = auth.uid();
  nova_versao := l.versao_design + 1;
  snap := public.linha_montar_snapshot(p_linha_id);
  select v.snapshot into anterior from public.linha_versoes v where v.linha_id = p_linha_id order by v.versao desc limit 1;

  insert into public.linha_versoes (linha_id, versao, concluida_por, responsavel_design_id, snapshot)
  values (p_linha_id, nova_versao, auth.uid(), p_responsavel_design_id, snap)
  returning id into vid;

  update public.linhas_editoriais
     set concluida_em = now(), concluida_por = auth.uid(), versao_design = nova_versao
   where id = p_linha_id;

  -- gera as peças que ainda não existem (idempotente — reaproveita a que já existe)
  resultado_geracao := public.design_gerar_da_linha(p_linha_id);

  -- reconcilia as peças já existentes contra o snapshot anterior
  for r in
    select d.id, d.conteudo_id, d.designer_id, d.status
      from public.design_deliverables d
     where d.linha_id = p_linha_id and d.deleted_at is null and d.conteudo_id is not null
  loop
    n_total := n_total + 1;
    if anterior is null then
      -- V01: nada "mudou" ainda, é a primeira liberação
      update public.design_deliverables set briefing_desatualizado = false, linha_versao_confirmada = nova_versao where id = r.id;
    else
      select elem into item_anterior from jsonb_array_elements(anterior) elem
        where elem->>'conteudo_id' = r.conteudo_id::text limit 1;
      declare item_atual jsonb;
      begin
        select elem into item_atual from jsonb_array_elements(snap) elem
          where elem->>'conteudo_id' = r.conteudo_id::text limit 1;
        if item_anterior is null or item_atual is null or item_anterior <> item_atual then
          update public.design_deliverables set briefing_desatualizado = true, linha_versao_confirmada = nova_versao where id = r.id;
          n_atualizadas := n_atualizadas + 1;
        else
          update public.design_deliverables set briefing_desatualizado = false, linha_versao_confirmada = nova_versao where id = r.id;
        end if;
      end;
    end if;
  end loop;

  -- atribuição opcional em bloco (equipe escolhendo o responsável, não autoatribuição)
  if p_responsavel_design_id is not null then
    for r in
      select id, kanban_id from public.design_deliverables
       where linha_id = p_linha_id and deleted_at is null
         and designer_id is null and status <> 'finalizado'
    loop
      update public.design_deliverables
         set designer_id = p_responsavel_design_id, updated_at = now(),
             status = case when status = 'aguardando_producao' then 'em_criacao' else status end
       where id = r.id;
      if r.kanban_id is not null then
        update public.kanban_demandas set responsavel_id = p_responsavel_design_id, updated_at = now() where id = r.kanban_id;
      end if;
      n_atribuidas := n_atribuidas + 1;
    end loop;
  end if;

  -- notificação agrupada — uma só, nunca uma por peça
  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('linha.concluida', 'linha.concluida:' || p_linha_id || ':' || nova_versao, 'linha_editorial', p_linha_id, nova_versao, l.client_id,
          auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('linha_nome', coalesce(nullif(l.nome, ''), null), 'mes', l.mes, 'ano', l.ano,
                              'versao', nova_versao, 'total_pecas', n_total,
                              'pecas_criadas', coalesce((resultado_geracao->>'criadas')::int, 0),
                              'pecas_atualizadas', n_atualizadas,
                              'responsavel_design_id', p_responsavel_design_id,
                              'responsavel_design_nome', alvo.nome));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'linha.concluida:' || p_linha_id || ':' || nova_versao));

  return jsonb_build_object('versao', nova_versao, 'total_pecas', n_total,
                             'pecas_criadas', coalesce((resultado_geracao->>'criadas')::int, 0),
                             'pecas_atualizadas', n_atualizadas, 'pecas_atribuidas', n_atribuidas);
end;
$$;
revoke all on function public.linha_concluir(uuid, uuid) from public;
grant execute on function public.linha_concluir(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. design_processar_evento — ramo novo para 'linha_editorial'
--    (entra ANTES do ramo existente, que continua tratando só peças de
--    Design; nada do que já funciona muda de comportamento)
-- ---------------------------------------------------------------------
create or replace function public.design_processar_evento(p_evento_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.design_deliverables%rowtype;
  tit text; msg text; link text; via text; canal text;
  linha_nome text; total int; criadas int; atualizadas int; resp uuid;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;

  if ev.alvo_tipo = 'linha_editorial' and ev.tipo = 'linha.concluida' then
    linha_nome := coalesce(ev.payload->>'linha_nome', 'Linha Editorial');
    total := coalesce((ev.payload->>'total_pecas')::int, 0);
    criadas := coalesce((ev.payload->>'pecas_criadas')::int, 0);
    atualizadas := coalesce((ev.payload->>'pecas_atualizadas')::int, 0);
    resp := nullif(ev.payload->>'responsavel_design_id', '')::uuid;
    link := '#/design?linha=' || ev.alvo_id;

    if resp is not null then
      tit := 'Nova demanda de Design atribuída a você';
      msg := linha_nome || ' foi concluída — ' || total || ' peça' || (case when total = 1 then '' else 's' end) ||
             ' de Design já está' || (case when total = 1 then '' else 'ão' end) || ' com você.';
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      values (ev.id, resp, ev.client_id, ev.tipo, tit, msg, link)
      on conflict (evento_id, destinatario_id) do nothing;
    elsif total > 0 then
      tit := 'Nova demanda de Design disponível';
      msg := linha_nome || ' possui ' || total || ' peça' || (case when total = 1 then '' else 's' end) || ' de Design disponíve' ||
             (case when total = 1 then 'l' else 'is' end) || '.';
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      select ev.id, p.id, ev.client_id, ev.tipo, tit, msg, link
        from public.perfis p where p.estado = 'ativa' and p.papel = 'designer'
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

    -- quem já tinha peça atribuída e teve o briefing mudado sob os pés
    if atualizadas > 0 then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      select ev.id, dd.designer_id, ev.client_id, 'linha.briefing_atualizado', 'Briefing atualizado',
             linha_nome || ' foi concluída novamente — ' || atualizadas || ' peça' || (case when atualizadas = 1 then '' else 's' end) ||
             ' sua' || (case when atualizadas = 1 then '' else 's' end) || ' teve' || (case when atualizadas = 1 then '' else 'ram' end) || ' o briefing atualizado.',
             link
        from public.design_deliverables dd
       where dd.linha_id = ev.alvo_id and dd.deleted_at is null and dd.briefing_desatualizado = true and dd.designer_id is not null
       group by dd.designer_id
      on conflict (evento_id, destinatario_id) do nothing;
    end if;

    update public.eventos_dominio set processado_em = now() where id = ev.id;
    return;
  end if;

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
-- 7. NOTIFICAÇÕES DE LOGIN — som em lote, uma vez, mesmo se a pessoa
--    estava offline quando a demanda chegou. `perfil_preferencias_gravar`
--    só aceitava som/navegador/push (booleanos); agora também aceita
--    `ultimo_som_em` (texto ISO — o "até aqui eu já avisei" da pessoa).
-- ---------------------------------------------------------------------
create or replace function public.perfil_preferencias_gravar(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare limpo jsonb := '{}'::jsonb; k text; v jsonb; atual jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Preferências inválidas.';
  end if;
  for k, v in select * from jsonb_each(p) loop
    if k in ('som', 'navegador', 'push') and jsonb_typeof(v) = 'boolean' then
      limpo := limpo || jsonb_build_object(k, v);
    elsif k = 'ultimo_som_em' and jsonb_typeof(v) = 'string' then
      -- só aceita se for mesmo um timestamp válido — nunca grava lixo
      perform (v#>>'{}')::timestamptz;
      limpo := limpo || jsonb_build_object(k, v);
    end if;
  end loop;
  update public.perfis
     set preferencias = coalesce(preferencias, '{}'::jsonb) || limpo
   where id = auth.uid()
   returning preferencias into atual;
  if atual is null then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  return atual;
end;
$$;
revoke all on function public.perfil_preferencias_gravar(jsonb) from public;
grant execute on function public.perfil_preferencias_gravar(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 8. LEITURA MAIS BARATA PARA A NOTIFICAÇÃO DE LOGIN — a mais recente
--    não lida, sem trazer as outras 19 junto
-- ---------------------------------------------------------------------
-- (nenhuma view nova necessária — o frontend consulta notificacoes
--  direto, filtrando lida_em is null, ordenando por created_at desc,
--  limit 1; a política de select já existente cobre isso.)

-- ---------------------------------------------------------------------
-- 9. design_resumo — expõe as duas colunas novas (view não herda coluna
--    nova da tabela base sozinha; recria com o SQL original de
--    migration_design.sql §18 + briefing_desatualizado/linha_versao_confirmada)
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
    order by v.numero desc, a.posicao asc limit 1) as ultima_previa,
  d.briefing_desatualizado, d.linha_versao_confirmada
from public.design_deliverables d
left join public.clientes cl on cl.id = d.client_id
left join public.linhas_editoriais le on le.id = d.linha_id
left join public.conteudos co on co.id = d.conteudo_id
left join public.perfis pf on pf.id = d.designer_id
where d.deleted_at is null;

grant select on public.design_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 10. linhas_resumo — usa `l.*`, mas uma view do Postgres fixa a lista de
--     colunas no momento da criação: colunas novas na tabela base (aqui,
--     concluida_em/concluida_por/versao_design) só entram recriando a
--     view. Mesmo SQL de migration_pilares.sql §3, sem nenhuma mudança —
--     só reaplicado depois do `alter table` acima para pegar as colunas novas.
-- ---------------------------------------------------------------------
drop view if exists public.linhas_resumo;
create view public.linhas_resumo
with (security_invoker = on) as
select
  l.*,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null) as total_conteudos,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null
       and ct.status in ('Em criação','Em revisão','Aprovado','Programado','Publicado')) as total_estruturados,
  (select count(*) from public.pilares p where p.linha_id = l.id) as total_pilares,
  (select coalesce(sum(p.percentual), 0) from public.pilares p where p.linha_id = l.id) as percentual_pilares
from public.linhas_editoriais l
join public.clientes c on c.id = l.client_id;
grant select on public.linhas_resumo to authenticated;
do $$
begin
  if exists (select 1 from pg_proc where proname = 'b7_grant_anon_se_aberto') then
    perform public.b7_grant_anon_se_aberto('linhas_resumo');
  end if;
end $$;
