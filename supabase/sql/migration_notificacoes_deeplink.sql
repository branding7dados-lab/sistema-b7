/* =====================================================================
   RODADA 6 — DEEP-LINK QUEBRADO NA NOTIFICAÇÃO DE LINHA CONCLUÍDA
   Migração aditiva (recria só uma função, sem mudar tabela nenhuma).

   Achado auditando os links que as notificações geram (`link :=` em
   `design_processar_evento`, function criada em
   migration_editorial_versao.sql §6): quando uma Linha Editorial é
   concluída e libera peças de Design, a notificação ("Nova demanda de
   Design atribuída a você" / "Nova demanda de Design disponível")
   linkava para `#/design?linha=<id>` — uma rota que NUNCA existiu.
   `js/app.js` só lê `?aba=` na rota `#/design` (ver `partes[0] ===
   'design'`); o parâmetro `linha` era ignorado por completo. Resultado:
   clicar na notificação abria a fila geral de Design, sem nenhum
   recorte pra a linha que gerou o aviso — a pessoa tinha que procurar
   de novo manualmente.

   A rota certa já existe desde a Rodada 2 (`#/design/linha/:id`, hoje
   com as 4 abas Peças de Design/Contexto/Pilares/Referências da
   Rodada 5b) — só a notificação nunca tinha sido atualizada pra
   apontar pra ela. As outras notificações de Design (peça criada,
   versão enviada, ajuste, aprovada, finalizada, assumida — todas
   usando `link := '#/design/' || d.id`) já estavam corretas, não
   precisam de mudança.

   Reproduz a função inteira (é a única forma de "editar uma linha" de
   uma function Postgres) — o resto do corpo é idêntico ao de
   migration_editorial_versao.sql §6, só a linha do link muda.
   ===================================================================== */

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
    -- CORREÇÃO (Rodada 6): rota real da página de demanda, não a
    -- inexistente "#/design?linha=".
    link := '#/design/linha/' || ev.alvo_id;

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

/* Notificações JÁ ENVIADAS com o link antigo e quebrado continuam com
   ele guardado (histórico não é reescrito por esta migração — mexer em
   linhas existentes de notificacoes é opcional e fora do escopo desta
   correção). Só as notificações criadas a partir de agora saem com o
   link certo. Se quiser corrigir o link das notificações antigas que
   ainda estão sem leitura, rode à parte:

     update public.notificacoes
        set link = '#/design/linha/' || substring(link from 'linha=(.*)$')
      where link like '#/design?linha=%';
*/
