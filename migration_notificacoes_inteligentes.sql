-- =====================================================================
-- NOTIFICAÇÕES INTELIGENTES — pacote 2026-10-01-v
--
-- O que muda: QUEM recebe cada aviso e COMO ele é escrito. O caminho
-- continua o mesmo de sempre, sem segundo sistema:
--
--   evento de negócio (eventos_dominio, chave única)
--     → processador do domínio (video_/design_/aprov_processar_evento…)
--       → notif_entregar()  ← ponto único que resolve destinatários
--         → notificacoes (uma por evento e pessoa)
--           → webhook → Edge Function b7-push → service worker
--
-- Regra de produto: notificação é um evento relevante para UMA pessoa.
-- Ser admin não faz ninguém receber tudo. Quem recebe:
--   1. quem foi atribuído / é o responsável             (rota "direto")
--   2. quem tem a função operacional que depende disso  (rota "função")
--   3. admin que escolheu acompanhar                    (rota "admin")
-- Uma pessoa que entra por mais de uma rota recebe UMA notificação.
--
-- Preferências (perfis.preferencias.notif, sem tabela nova): decidem o
-- que interrompe (push, som, aviso do navegador). O sino continua
-- registrando o que é do trabalho da pessoa — a linha nasce com
-- dados.silenciosa = true e nenhum canal dispara. As opções de
-- acompanhamento do admin (adm_*) são diferentes: desligadas, a
-- notificação nem é criada.
--
-- Nenhuma tabela nova, nenhuma coluna nova, nenhuma policy alterada.
-- Rodar no SQL Editor do Supabase. Pode rodar de novo sem efeito colateral.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PREFERÊNCIAS
-- ---------------------------------------------------------------------
-- Ligado por padrão, exceto o que é acompanhamento amplo: revisões da
-- agência para o admin, "todas as movimentações" e o resumo diário.
create or replace function public.notif_pref_ativa(p_prefs jsonb, p_chave text)
returns boolean
language sql
immutable
as $$
  select case
    when p_chave is null then false
    when jsonb_typeof(p_prefs -> 'notif' -> p_chave) = 'boolean' then (p_prefs -> 'notif' ->> p_chave)::boolean
    else p_chave not in ('adm_revisoes', 'adm_tudo', 'resumo_diario')
  end
$$;

-- Mesma função de sempre (som / navegador / push / ultimo_som_em), agora
-- aceitando também o objeto "notif" com as chaves conhecidas. Faz merge:
-- gravar uma chave não apaga as outras.
create or replace function public.perfil_preferencias_gravar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limpo jsonb := '{}'::jsonb; notif jsonb := '{}'::jsonb; k text; v jsonb; atual jsonb;
  permitidas constant text[] := array[
    'atribuicoes', 'prazos', 'atrasos', 'correcoes', 'aprovacoes',
    'grav_lembretes', 'grav_mudancas', 'roteiros_prontos',
    'design_disponivel',
    'co_revisoes', 'co_aprovacoes', 'co_producao', 'co_escalados',
    'agenda', 'resumo_diario',
    'adm_revisoes', 'adm_atrasos', 'adm_tudo'];
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
    elsif k = 'notif' and jsonb_typeof(v) = 'object' then
      select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into notif
        from jsonb_each(v) e
       where e.key = any(permitidas) and jsonb_typeof(e.value) = 'boolean';
    end if;
  end loop;
  update public.perfis
     set preferencias = coalesce(preferencias, '{}'::jsonb) || limpo ||
           case when notif <> '{}'::jsonb
                then jsonb_build_object('notif', coalesce(preferencias -> 'notif', '{}'::jsonb) || notif)
                else '{}'::jsonb end
   where id = auth.uid()
   returning preferencias into atual;
  if atual is null then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  return atual;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. RESOLVEDOR DE DESTINATÁRIOS — o único lugar que decide quem recebe
-- ---------------------------------------------------------------------
-- p_diretos / p_pref_direto   atribuídos e responsáveis, e a preferência
--                             que silencia esse aviso para eles
-- p_funcoes / p_pref_funcao   funções operacionais que dependem do evento
--                             (papel OU função extra: multifunção conta)
-- p_pref_admin                opção de acompanhamento do admin que também
--                             habilita o aviso; "adm_tudo" sempre habilita
-- p_ator                      quem fez a ação nunca é avisado dela
-- p_excluir                   quem já recebe o mesmo fato por outro evento
-- Devolve uma linha por pessoa (multifunção nunca duplica), com a rota
-- mais forte e se o aviso deve ficar em silêncio.
create or replace function public.notif_destinatarios(
  p_diretos uuid[], p_pref_direto text,
  p_funcoes text[] default null, p_pref_funcao text default null,
  p_pref_admin text default null, p_ator uuid default null,
  p_excluir uuid[] default null)
returns table (perfil_id uuid, silenciosa boolean, rota text)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id, p.papel, p.preferencias,
           (p.id = any(coalesce(p_diretos, '{}'::uuid[]))) as direto,
           (p_funcoes is not null and (p.papel = any(p_funcoes) or exists (
              select 1 from public.perfis_funcoes_extra f
               where f.perfil_id = p.id and f.funcao = any(p_funcoes)))) as por_funcao
      from public.perfis p
     where p.estado = 'ativa' and p.papel <> 'cliente'
       and p.id is distinct from p_ator
       and not (p.id = any(coalesce(p_excluir, '{}'::uuid[])))
  ), rotas as (
    select b.*,
           (b.papel = 'admin' and (public.notif_pref_ativa(b.preferencias, 'adm_tudo')
                                or public.notif_pref_ativa(b.preferencias, p_pref_admin))) as por_admin
      from base b
  )
  select r.id,
         not ((r.direto and public.notif_pref_ativa(r.preferencias, p_pref_direto))
           or (r.por_funcao and public.notif_pref_ativa(r.preferencias, p_pref_funcao))
           or r.por_admin),
         case when r.direto then 'direto' when r.por_funcao then 'funcao' else 'admin' end
    from rotas r
   where r.direto or r.por_funcao or r.por_admin
$$;
revoke all on function public.notif_destinatarios(uuid[], text, text[], text, text, uuid, uuid[]) from public, anon, authenticated;

-- Grava a notificação para todo mundo que o resolvedor devolveu.
-- p_titulo_geral: título para quem NÃO é o atribuído (quem acompanha lê
-- "atribuída a Fulano", não "atribuída a você").
create or replace function public.notif_entregar(
  p_evento uuid, p_tipo text, p_titulo text, p_mensagem text, p_link text, p_client_id uuid,
  p_diretos uuid[], p_pref_direto text,
  p_funcoes text[] default null, p_pref_funcao text default null,
  p_pref_admin text default null, p_ator uuid default null,
  p_dados jsonb default '{}'::jsonb, p_excluir uuid[] default null,
  p_titulo_geral text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link, dados)
  select p_evento, d.perfil_id, p_client_id, p_tipo,
         case when d.rota = 'direto' then p_titulo else coalesce(p_titulo_geral, p_titulo) end,
         nullif(btrim(coalesce(p_mensagem, '')), ''), p_link,
         coalesce(p_dados, '{}'::jsonb) ||
           case when d.silenciosa then '{"silenciosa": true}'::jsonb else '{}'::jsonb end
    from public.notif_destinatarios(p_diretos, p_pref_direto, p_funcoes, p_pref_funcao, p_pref_admin, p_ator, p_excluir) d
  on conflict (evento_id, destinatario_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.notif_entregar(uuid, text, text, text, text, uuid, uuid[], text, text[], text, text, uuid, jsonb, uuid[], text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. DATAS — sempre no fuso da agência (o banco roda em UTC)
-- ---------------------------------------------------------------------
create or replace function public.notif_hoje()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- "08 OUT"
create or replace function public.notif_dia(p date)
returns text language sql stable as $$
  select to_char(p, 'DD') || ' ' ||
         (array['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'])[extract(month from p)::int]
$$;

-- "08 OUT · 09:00" (ou só o dia, quando não há horário)
create or replace function public.notif_dia_hora(p timestamptz, p_sem_horario boolean default false)
returns text language sql stable as $$
  select public.notif_dia((p at time zone 'America/Sao_Paulo')::date) ||
         case when coalesce(p_sem_horario, false) then ''
              else ' · ' || to_char(p at time zone 'America/Sao_Paulo', 'HH24:MI') end
$$;

-- "Outubro de 2026"
create or replace function public.notif_mes(p_mes integer, p_ano integer)
returns text language sql immutable as $$
  select (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
                'Setembro','Outubro','Novembro','Dezembro'])[p_mes] || ' de ' || p_ano
$$;

-- "há 1 dia" / "há 3 dias"
create or replace function public.notif_ha_dias(p integer)
returns text language sql immutable as $$
  select 'há ' || greatest(coalesce(p, 1), 1) || case when greatest(coalesce(p, 1), 1) = 1 then ' dia' else ' dias' end
$$;

-- ---------------------------------------------------------------------
-- 4. VÍDEO
-- ---------------------------------------------------------------------
create or replace function public.video_processar_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.demandas_edicao%rowtype;
  item text; link text; dias integer; resp text;
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
  item := '"' || coalesce(nullif(ev.payload->>'titulo', ''), d.titulo, 'Demanda de vídeo') || '"';
  dias := public.notif_hoje() - d.prazo;
  select nome into resp from public.perfis where id = d.videomaker_id;

  if ev.tipo = 'video.atribuida' and ev.payload->>'videomaker_id' is not null then
    perform public.notif_entregar(ev.id, ev.tipo, 'Demanda de vídeo atribuída a você',
      item || coalesce(' · Prazo: ' || public.notif_dia(d.prazo), ''), link, d.client_id,
      array[(ev.payload->>'videomaker_id')::uuid], 'atribuicoes',
      p_ator => ev.ator_id,
      p_titulo_geral => 'Demanda de vídeo atribuída a ' || coalesce(ev.payload->>'videomaker_nome', 'um videomaker'));

  elsif ev.tipo = 'video.aguardando_aprovacao' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Vídeo enviado para aprovação',
      item || coalesce(' · Enviado por ' || ev.ator_nome, '') || '.', link, d.client_id,
      null, null, array['coordenador'], 'co_revisoes', 'adm_revisoes', ev.ator_id);

  elsif ev.tipo = 'video.aprovado_cliente' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Cliente aprovou o vídeo',
      item || ' · V' || lpad(coalesce(ev.payload->>'versao', '?'), 2, '0') || ' aprovada. Já pode registrar a entrega.',
      link, d.client_id, array[d.videomaker_id], 'aprovacoes', p_ator => ev.ator_id);

  elsif ev.tipo = 'video.entregue' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Vídeo entregue',
      item || coalesce(' · Entregue por ' || ev.ator_nome, '') || '.', link, d.client_id,
      null, null, array['coordenador'], 'co_producao', null, ev.ator_id);

  elsif ev.tipo = 'video.correcao_solicitada' then
    -- o texto da correção fica na demanda: a tela de bloqueio só diz que existe
    perform public.notif_entregar(ev.id, ev.tipo, 'Correção solicitada no vídeo',
      item || case when coalesce(ev.payload->>'mensagem', '') like 'Cliente (via %'
                   then ' · O cliente solicitou uma alteração.'
                   else ' · A equipe solicitou uma alteração.' end,
      link, d.client_id, array[d.videomaker_id], 'correcoes', p_ator => ev.ator_id);

  elsif ev.tipo = 'video.prazo_amanha' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Prazo amanhã — Vídeo',
      item || ' · Entrega amanhã, ' || public.notif_dia(d.prazo) || '.', link, d.client_id,
      array[d.videomaker_id], 'prazos');

  elsif ev.tipo = 'video.atrasado' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Demanda atrasada ' || public.notif_ha_dias(dias),
      item || ' · O prazo venceu em ' || public.notif_dia(d.prazo) || '.', link, d.client_id,
      array[d.videomaker_id], 'atrasos');

  elsif ev.tipo = 'video.atrasado_escalado' then
    -- continua atrasada: o responsável de novo, e agora a coordenação
    perform public.notif_entregar(ev.id, ev.tipo, 'Demanda atrasada ' || public.notif_ha_dias(dias),
      concat_ws(' · ', item, 'Responsável: ' || resp, 'Prazo: ' || public.notif_dia(d.prazo)), link, d.client_id,
      array[d.videomaker_id], 'atrasos', array['coordenador'], 'co_escalados');

  elsif ev.tipo = 'video.atrasado_critico' then
    -- atraso longo: só para o admin que acompanha atrasos críticos
    perform public.notif_entregar(ev.id, ev.tipo, 'Atraso crítico — vídeo ' || public.notif_ha_dias(dias),
      concat_ws(' · ', item, 'Responsável: ' || resp, 'Prazo: ' || public.notif_dia(d.prazo)), link, d.client_id,
      null, null, null, null, 'adm_atrasos');
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;

-- Varredura de prazos de vídeo. As chaves são as mesmas de antes
-- (video.prazo_amanha:<id>:<prazo>, video.atrasado:<id>,
-- video.atrasado_escalado:<id>): nada que já foi avisado avisa de novo.
-- p_videomaker limita a varredura às demandas de uma pessoa.
create or replace function public._video_alertas_prazo(p_videomaker uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; evid uuid; hoje date := public.notif_hoje();
begin
  for r in
    select d.* from public.demandas_edicao d
     where d.deleted_at is null
       and d.editing_status not in ('entregue', 'descartado')
       and d.prazo is not null
       and (p_videomaker is null or d.videomaker_id = p_videomaker)
  loop
    if r.prazo = hoje + 1 and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.prazo_amanha', 'video.prazo_amanha:' || r.id || ':' || r.prazo::text,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo < hoje and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado', 'video.atrasado:' || r.id,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= hoje - 2 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado_escalado', 'video.atrasado_escalado:' || r.id,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= hoje - 5 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado_critico', 'video.atrasado_critico:' || r.id,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;
  end loop;
end;
$$;
revoke all on function public._video_alertas_prazo(uuid) from public, anon, authenticated;

-- A chamada que a tela de Vídeo já faz ao abrir continua existindo, com
-- o mesmo alcance de antes (equipe: tudo; videomaker: as dele).
create or replace function public.video_verificar_alertas_prazo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_equipe_interna() then return; end if;
  perform public._video_alertas_prazo(case when public.sou_equipe() then null else auth.uid() end);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. DESIGN
-- ---------------------------------------------------------------------
create or replace function public.design_processar_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.eventos_dominio%rowtype;
  d  public.design_deliverables%rowtype;
  link text; item text; num text; formato text; partes text; resp_nome text;
  linha_nome text; total int; atualizadas int; resp uuid; dias integer;
  img jsonb; dados jsonb := '{}'::jsonb;
begin
  select * into ev from public.eventos_dominio where id = p_evento_id for update;
  if not found or ev.processado_em is not null then return; end if;

  if ev.alvo_tipo = 'linha_editorial' and ev.tipo = 'linha.concluida' then
    linha_nome := coalesce(nullif(ev.payload->>'linha_nome', ''), 'Linha Editorial');
    total := coalesce((ev.payload->>'total_pecas')::int, 0);
    atualizadas := coalesce((ev.payload->>'pecas_atualizadas')::int, 0);
    resp := nullif(ev.payload->>'responsavel_design_id', '')::uuid;
    link := '#/design/linha/' || ev.alvo_id;

    if resp is not null then
      perform public.notif_entregar(ev.id, ev.tipo, 'Demanda de Design atribuída a você',
        linha_nome || ' · ' || total || case when total = 1 then ' peça já está com você.' else ' peças já estão com você.' end,
        link, ev.client_id, array[resp], 'atribuicoes', p_ator => ev.ator_id,
        p_titulo_geral => 'Demanda de Design atribuída a ' || coalesce(ev.payload->>'responsavel_design_nome', 'um designer'));
    elsif total > 0 then
      perform public.notif_entregar(ev.id, ev.tipo, 'Nova demanda de Design disponível',
        linha_nome || ' · ' || total || case when total = 1 then ' peça disponível.' else ' peças disponíveis.' end,
        link, ev.client_id, null, null, array['designer'], 'design_disponivel', null, ev.ator_id);
    end if;

    -- quem já tinha peça atribuída e teve o briefing mudado sob os pés
    if atualizadas > 0 then
      perform public.notif_entregar(ev.id, 'linha.briefing_atualizado', 'Briefing atualizado',
        linha_nome || ' · A linha foi concluída de novo e o briefing das suas peças mudou.',
        link, ev.client_id,
        (select array_agg(distinct dd.designer_id) from public.design_deliverables dd
          where dd.linha_id = ev.alvo_id and dd.deleted_at is null
            and dd.briefing_desatualizado = true and dd.designer_id is not null),
        'atribuicoes', p_ator => ev.ator_id);
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
  item := '"' || coalesce(nullif(ev.payload->>'titulo', ''), d.titulo, 'Peça de Design') || '"';
  num := 'V' || lpad(coalesce(ev.payload->>'numero', ev.versao::text, d.versao_atual::text, '1'), 2, '0');
  formato := case d.tipo when 'carrossel' then 'Carrossel' when 'stories' then 'Stories' when 'card' then 'Card'
                         else initcap(replace(coalesce(d.tipo, 'design'), '_', ' ')) end;
  dias := public.notif_hoje() - d.prazo;
  select nome into resp_nome from public.perfis where id = d.designer_id;

  -- prévia REAL da peça (miniatura da versão do evento). O bucket é
  -- privado: aqui vai só o caminho, e a b7-push assina a URL na hora.
  select jsonb_build_object('imagem', jsonb_build_object('bucket', 'design-files', 'caminho', coalesce(a.caminho_thumb, a.caminho)))
    into img
    from public.design_arquivos a
    join public.design_versoes v on v.id = a.versao_id
   where v.deliverable_id = d.id
     and v.numero = coalesce(nullif(ev.payload->>'numero', '')::int, ev.versao, d.versao_atual)
     and a.papel = 'preview'
     and (a.caminho_thumb is not null or a.mime like 'image/%')
   order by a.parte_posicao nulls first, a.posicao
   limit 1;
  img := coalesce(img, '{}'::jsonb);

  if ev.tipo = 'design.criada' then
    if d.designer_id is not null then
      -- criada já com responsável: para ele, é uma atribuição
      perform public.notif_entregar(ev.id, ev.tipo, 'Design atribuído a você',
        item || ' · ' || formato || coalesce(' · Prazo: ' || public.notif_dia(d.prazo), ''), link, d.client_id,
        array[d.designer_id], 'atribuicoes', p_ator => ev.ator_id,
        p_titulo_geral => 'Nova peça de Design criada');
    else
      -- sem responsável: só quem acompanha todas as movimentações
      perform public.notif_entregar(ev.id, ev.tipo, 'Nova peça de Design criada',
        item || ' · ' || formato, link, d.client_id, null, null, p_ator => ev.ator_id);
    end if;

  elsif ev.tipo = 'design.atribuida' and ev.payload->>'designer_id' is not null then
    perform public.notif_entregar(ev.id, ev.tipo, 'Design atribuído a você',
      item || ' · ' || formato || coalesce(' · Prazo: ' || public.notif_dia(d.prazo), ''), link, d.client_id,
      array[(ev.payload->>'designer_id')::uuid], 'atribuicoes', p_ator => ev.ator_id,
      p_titulo_geral => 'Design atribuído a ' || coalesce(ev.payload->>'designer_nome', 'um designer'));

  elsif ev.tipo = 'design.versao_enviada' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Design aguardando revisão',
      item || ' · ' || num || coalesce(' enviada por ' || ev.ator_nome, ' enviada') ||
        case when coalesce(ev.payload->>'via', 'upload') = 'externa' then ' (revisada por fora).' else '.' end,
      link, d.client_id, null, null, array['coordenador'], 'co_revisoes', 'adm_revisoes', ev.ator_id, img);

  elsif ev.tipo = 'design.ajuste_solicitado' then
    select string_agg(lpad(p->>'posicao', 2, '0'), ', ' order by (p->>'posicao')::int) into partes
      from jsonb_array_elements(case when jsonb_typeof(ev.payload->'partes') = 'array' then ev.payload->'partes' else '[]'::jsonb end) p;
    -- o texto do pedido fica em dados.detalhe (a peça mostra); o aviso só aponta onde
    dados := img || case when coalesce(ev.payload->>'mensagem', '') <> ''
                         then jsonb_build_object('detalhe', ev.payload->>'mensagem') else '{}'::jsonb end;
    perform public.notif_entregar(ev.id, ev.tipo, 'Ajuste solicitado no Design',
      item || ' · ' || case when partes is not null
        then case when d.tipo = 'stories' then 'Story ' else 'Slide ' end || partes ||
             case when partes like '%,%' then ' precisam de alteração.' else ' precisa de alteração.' end
        else num || ' precisa de alteração.' end,
      link, d.client_id, array[d.designer_id], 'correcoes', p_ator => ev.ator_id, p_dados => dados);

  elsif ev.tipo = 'design.aprovado_interno' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Design aprovado na revisão interna',
      item || ' · ' || num || ' aprovada.', link, d.client_id,
      array[d.designer_id], 'aprovacoes', p_ator => ev.ator_id, p_dados => img);

  elsif ev.tipo = 'design.finalizado' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Peça finalizada',
      item || ' · ' || formato, link, d.client_id,
      array[d.designer_id], 'aprovacoes', p_ator => ev.ator_id);

  elsif ev.tipo = 'design.demanda_assumida' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Designer assumiu a peça',
      coalesce(ev.ator_nome, 'Um designer') || ' assumiu ' || item || '.', link, d.client_id,
      null, null, array['coordenador'], 'co_producao', null, ev.ator_id);

  elsif ev.tipo = 'design.prazo_amanha' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Prazo amanhã — Design',
      item || ' · ' || formato || ' · Entrega amanhã, ' || public.notif_dia(d.prazo) || '.', link, d.client_id,
      array[d.designer_id], 'prazos');

  elsif ev.tipo = 'design.atrasado' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Demanda atrasada ' || public.notif_ha_dias(dias),
      item || ' · ' || formato || ' · O prazo venceu em ' || public.notif_dia(d.prazo) || '.', link, d.client_id,
      array[d.designer_id], 'atrasos');

  elsif ev.tipo = 'design.atrasado_escalado' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Demanda atrasada ' || public.notif_ha_dias(dias),
      concat_ws(' · ', item, 'Responsável: ' || resp_nome, 'Prazo: ' || public.notif_dia(d.prazo)), link, d.client_id,
      array[d.designer_id], 'atrasos', array['coordenador'], 'co_escalados');

  elsif ev.tipo = 'design.atrasado_critico' then
    perform public.notif_entregar(ev.id, ev.tipo, 'Atraso crítico — Design ' || public.notif_ha_dias(dias),
      concat_ws(' · ', item, 'Responsável: ' || resp_nome, 'Prazo: ' || public.notif_dia(d.prazo)), link, d.client_id,
      null, null, null, null, 'adm_atrasos');
  end if;

  update public.eventos_dominio set processado_em = now() where id = ev.id;
end;
$$;

-- Prazos de Design: mesma régua do Vídeo. Só conta peça que depende do
-- designer (aguardando produção, em criação ou em ajuste) — em revisão
-- interna ou com o cliente, a bola não está com ele.
create or replace function public._design_alertas_prazo()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; evid uuid; hoje date := public.notif_hoje();
begin
  for r in
    select d.* from public.design_deliverables d
     where d.deleted_at is null and d.prazo is not null
       and d.status in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente')
  loop
    if r.prazo = hoje + 1 and r.designer_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('design.prazo_amanha', 'design.prazo_amanha:' || r.id || ':' || r.prazo::text,
                'design_deliverable', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.design_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo < hoje and r.designer_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('design.atrasado', 'design.atrasado:' || r.id || ':' || r.prazo::text,
                'design_deliverable', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.design_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= hoje - 2 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('design.atrasado_escalado', 'design.atrasado_escalado:' || r.id || ':' || r.prazo::text,
                'design_deliverable', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.design_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= hoje - 5 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('design.atrasado_critico', 'design.atrasado_critico:' || r.id || ':' || r.prazo::text,
                'design_deliverable', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.design_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;
  end loop;
end;
$$;
revoke all on function public._design_alertas_prazo() from public, anon, authenticated;

-- Decisão do cliente sobre uma peça de Design. As mudanças de estado da
-- peça e da versão são as mesmas de antes; muda só o aviso ao designer:
-- passa pelo resolvedor e deixa de levar o texto do cliente para a tela
-- de bloqueio (o texto completo vai em dados.detalhe, que a peça mostra).
create or replace function public.design_sync_decisao_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; d public.design_deliverables%rowtype; tit text; msg text; ev_id uuid; v_chave text;
        canal text; lista text; ator_nome text; detalhe text; img jsonb; item text;
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
  item := '"' || d.titulo || '"';

  if new.situacao = 'aprovado' then
    if v_id is not null then update public.design_versoes set estado = 'aprovada_cliente', updated_at = now() where id = v_id; end if;
    update public.design_deliverables set status = 'aprovado_cliente', updated_at = now() where id = d.id;
    tit := 'Cliente aprovou a peça';
    msg := item || ' · Aprovada via ' || canal || '. Nenhum ajuste foi solicitado.';
    detalhe := d.titulo || ' foi aprovad' || case when d.tipo in ('capa_reel') then 'a' else 'o' end || ' pelo cliente via ' || canal ||
               case when new.origem_decisao = 'externa' then ' (registrado por ' || ator_nome || ')' else '' end || '.';
  elsif new.situacao in ('ajustes', 'recusado') then
    if v_id is not null then update public.design_versoes set estado = 'ajuste_cliente', updated_at = now() where id = v_id; end if;
    update public.design_deliverables set status = 'ajustes_cliente', updated_at = now() where id = d.id;
    select string_agg(coalesce(p.parte_rotulo, ''), ', ' order by p.parte_rotulo) into lista
      from public.aprovacao_partes p where p.aprovacao_id = new.id and p.situacao = 'ajustes';
    tit := case when new.situacao = 'recusado' then 'Cliente recusou a peça' else 'Cliente solicitou ajustes' end;
    msg := item || ' · ' || case when nullif(lista, '') is not null
                                 then lista || ' precisa' || case when lista like '%,%' then 'm' else '' end || ' de alteração.'
                                 else 'A peça voltou para correção.' end;
    detalhe := d.titulo || ' — via ' || canal ||
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
    msg := item || ' · A peça voltou a aguardar o cliente.';
    detalhe := d.titulo || ' voltou a aguardar o cliente. ' || coalesce('Motivo: ' || nullif(new.anulacao_motivo, ''), '');
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
      select jsonb_build_object('imagem', jsonb_build_object('bucket', 'design-files', 'caminho', coalesce(a.caminho_thumb, a.caminho)))
        into img
        from public.design_arquivos a
       where a.versao_id = v_id and a.papel = 'preview' and (a.caminho_thumb is not null or a.mime like 'image/%')
       order by a.parte_posicao nulls first, a.posicao limit 1;
      perform public.notif_entregar(ev_id, 'design.cliente_' || new.situacao, tit, msg, '#/design/' || d.id, d.client_id,
        array[d.designer_id], case when new.situacao = 'aprovado' then 'aprovacoes' else 'correcoes' end,
        p_ator => coalesce(new.registrado_por, new.decidido_por),
        p_dados => coalesce(img, '{}'::jsonb) || jsonb_build_object('detalhe', detalhe));
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. APROVAÇÕES (decisões do cliente)
-- ---------------------------------------------------------------------
-- Textos do cliente (Portal) e a automação do Kanban são os mesmos de
-- antes, linha por linha. Muda só o aviso para a EQUIPE: em vez de todo
-- admin e todo coordenador, recebe quem enviou o material para aprovação
-- e quem coordena. O designer da peça fica de fora aqui porque já
-- recebe a mesma decisão por design.cliente_* (um fato, um aviso).
create or replace function public.aprov_processar_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev  public.eventos_dominio%rowtype;
  a   public.aprovacoes%rowtype;
  emp text; titulo text; quem text; msg text; tit text; link_eq text; link_cl text;
  msg_cl text; tit_cl text;
  d   record;
  destino text; tipo_dem text; n int := 0;
  anterior text; esperado text; motivo_an text;
  tit_eq text; msg_eq text; rot text; dados_eq jsonb := '{}'::jsonb; fora uuid[];
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

  -- ----------------------------------------- textos do aviso da equipe
  /* título = o que aconteceu; mensagem = em qual material. O texto que
     o cliente escreveu (motivo, comentário) não vai para a tela de
     bloqueio: fica em dados.detalhe e na própria aprovação. */
  rot := public.aprov_rotulo_tipo(a.tipo);
  if ev.tipo = 'aprovacao.aprovada' then
    tit_eq := 'Cliente aprovou ' || rot;
    msg_eq := '"' || titulo || '" · Versão ' || a.versao || ' aprovada por ' || quem || '.';
  elsif ev.tipo = 'aprovacao.ajustes' then
    tit_eq := 'Cliente solicitou ajustes';
    msg_eq := '"' || titulo || '" · ' || upper(left(rot, 1)) || substr(rot, 2) || ' voltou para correção.';
    dados_eq := jsonb_build_object('detalhe', msg);
  elsif ev.tipo = 'aprovacao.recusada' then
    tit_eq := 'Cliente recusou ' || rot;
    msg_eq := '"' || titulo || '" · Confira o motivo no B7.';
    dados_eq := jsonb_build_object('detalhe', msg);
  elsif ev.tipo = 'parte.aprovada' then
    tit_eq := 'Cliente aprovou uma parte';
    msg_eq := '"' || titulo || '" · ' || coalesce(ev.payload->>'rotulo', 'cena') || ' aprovada por ' || quem || '.';
  elsif ev.tipo = 'parte.ajustes' then
    tit_eq := 'Cliente solicitou ajustes';
    msg_eq := '"' || titulo || '" · ' || coalesce(ev.payload->>'rotulo', 'cena') || ' precisa de alteração.';
    if msg is not null then dados_eq := jsonb_build_object('detalhe', msg); end if;
  elsif ev.tipo in ('aprovacao.anulada', 'parte.anulada') then
    tit_eq := 'Decisão do cliente anulada';
    msg_eq := tit || '.';
    dados_eq := jsonb_build_object('detalhe', msg);
  else
    tit_eq := tit; msg_eq := msg;
  end if;
  if a.tipo = 'design_versao' then
    select array_agg(dd.designer_id) into fora from public.design_deliverables dd
     where dd.id = a.alvo_id and dd.designer_id is not null;
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
    perform public.notif_entregar(ev.id, ev.tipo, tit_eq, msg_eq, link_eq, a.client_id,
      array[a.enviado_por], 'aprovacoes', array['coordenador'], 'co_aprovacoes', null, ev.ator_id, dados_eq, fora);
  else
    /* equipe: quem enviou o material para aprovação e quem coordena */
    perform public.notif_entregar(ev.id, ev.tipo, tit_eq, msg_eq, link_eq, a.client_id,
      array[a.enviado_por], 'aprovacoes', array['coordenador'], 'co_aprovacoes', null, ev.ator_id, dados_eq, fora);
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
-- 7. GRAVAÇÕES — atribuída, remarcada, cancelada
-- ---------------------------------------------------------------------
-- Os gatilhos de gravação chamam esta função como sempre chamaram; ela
-- passa a escrever o aviso no formato novo (título = o que aconteceu,
-- mensagem = qual gravação e quando) e a usar o resolvedor.
create or replace function public._grav_notificar(p_gravacao uuid, p_dest uuid, p_tipo text, p_titulo text, p_msg text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.gravacoes%rowtype; oc public.gravacoes_ocorrencias%rowtype; ant public.gravacoes_ocorrencias%rowtype;
  ev uuid; tit text := p_titulo; msg text := p_msg; geral text; pref text := 'atribuicoes';
  g_nome text; quando text; itens integer;
begin
  if p_dest is null or p_dest = auth.uid() then return; end if;
  if coalesce(current_setting('b7.sem_historico', true), '') = 'on' then return; end if;
  select * into g from public.gravacoes where id = p_gravacao;
  select * into oc from public.gravacoes_ocorrencias where gravacao_id = p_gravacao and atual limit 1;
  g_nome := coalesce(nullif(btrim(g.nome), ''), 'Gravação');
  if oc.id is not null then quando := public.notif_dia_hora(oc.inicio, oc.sem_horario); end if;

  if p_tipo = 'gravacao.atribuida' then
    select count(*) into itens from public.gravacao_itens i where i.gravacao_id = p_gravacao and i.removido_em is null;
    tit := 'Gravação atribuída a você';
    geral := 'Gravação atribuída a ' || coalesce((select p.nome from public.perfis p where p.id = p_dest), 'um videomaker');
    msg := concat_ws(' · ', g_nome, quando,
      case when itens > 0 then itens || case when itens = 1 then ' item planejado' else ' itens planejados' end end);
  elsif p_tipo = 'gravacao.remarcada' then
    pref := 'grav_mudancas';
    select * into ant from public.gravacoes_ocorrencias where id = oc.ocorrencia_anterior_id;
    tit := 'Gravação remarcada';
    msg := concat_ws(' · ', g_nome, 'Nova data: ' || quando,
      case when ant.id is not null then 'Antes: ' || public.notif_dia_hora(ant.inicio, ant.sem_horario) end);
  elsif p_tipo = 'gravacao.cancelada' then
    pref := 'grav_mudancas';
    tit := 'Gravação cancelada';
    -- o motivo do cancelamento fica no histórico da gravação
    msg := concat_ws(' · ', g_nome, 'A gravação de ' || quando || ' foi cancelada.');
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, payload, processado_em)
  values (p_tipo, p_tipo || ':' || p_gravacao || ':' || p_dest || ':' || clock_timestamp()::text, 'gravacao', p_gravacao,
          g.client_id, auth.uid(), (select pa.nome from public.perfis pa where pa.id = auth.uid()), '{}'::jsonb, now())
  returning id into ev;
  perform public.notif_entregar(ev, p_tipo, tit, msg, '#/gravacao/' || p_gravacao, g.client_id,
    array[p_dest], pref, p_ator => auth.uid(), p_titulo_geral => geral);
end;
$$;
revoke all on function public._grav_notificar(uuid, uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. LEMBRETES DA AGENDA (cron agenda-lembretes, a cada 5 min — o mesmo)
-- ---------------------------------------------------------------------
-- Antes: todo compromisso avisava a equipe inteira. Agora:
--   gravação  → o videomaker responsável; sem responsável definido, quem
--               tem a função de videomaker (alguém precisa saber)
--   reunião / apresentação / outro → a equipe, como antes (a agenda não
--               tem responsável por evento), respeitando a preferência
--               "Compromissos da agenda" de cada um
-- As chaves dos eventos não mudaram: nenhum lembrete já enviado repete.
create or replace function public.agenda_verificar_lembretes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  evid uuid;
  criados integer := 0;
  etapa text; hora text; rotulo text;
  tipo_notif text; titulo_notif text; msg_notif text; link_notif text;
  itens integer; comp_mes integer; comp_ano integer;
begin
  for c in
    select * from public.agenda_compromissos
    where inicio > now() and inicio <= now() + interval '25 hours'
  loop
    if c.tipo in ('gravacao', 'apresentacao')
       and c.inicio between now() + interval '23 hours' and now() + interval '24 hours' then
      etapa := '24h';
    elsif not c.dia_inteiro and c.inicio between now() and now() + interval '1 hour' then
      etapa := '1h';
    else
      continue;
    end if;

    tipo_notif := 'agenda.' || c.tipo || '_' || etapa;
    hora := case when c.dia_inteiro then '' else ' às ' || to_char(c.inicio at time zone 'America/Sao_Paulo', 'HH24:MI') end;
    link_notif := case when c.gravacao_id is not null
                       then '#/gravacao/' || c.gravacao_id
                       else '#/calendario' end;

    begin
      insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
      values (
        tipo_notif,
        'agenda.lembrete:' || c.origem || ':' || c.id || ':' || etapa || ':' || extract(epoch from c.inicio)::bigint,
        'agenda_compromisso', c.id, c.client_id,
        jsonb_build_object('titulo', c.titulo, 'inicio', c.inicio, 'tipo', c.tipo, 'local', c.local)
      )
      returning id into evid;
    exception when unique_violation then
      continue;
    end;

    if c.tipo = 'gravacao' then
      itens := 0; comp_mes := null; comp_ano := null;
      if c.gravacao_id is not null then
        select count(*) into itens from public.gravacao_itens i
         where i.gravacao_id = c.gravacao_id and i.removido_em is null;
        select g.competencia_mes, g.competencia_ano into comp_mes, comp_ano
          from public.gravacoes g where g.id = c.gravacao_id;
      end if;
      titulo_notif := 'Gravação ' || case when etapa = '24h' then 'amanhã' else 'hoje' end || hora;
      -- mês de referência ≠ data da gravação: os dois aparecem, cada um no seu lugar
      msg_notif := concat_ws(' · ',
        nullif(btrim(coalesce(c.titulo, '')), ''),
        case when itens > 0 then itens || case when itens = 1 then ' item planejado' else ' itens planejados' end end,
        case when comp_mes is not null and comp_ano is not null then 'Referente a ' || public.notif_mes(comp_mes, comp_ano) end,
        case when coalesce(btrim(c.local), '') <> '' then 'Local: ' || btrim(c.local) end);
      if c.videomaker_id is not null then
        perform public.notif_entregar(evid, tipo_notif, titulo_notif, msg_notif, link_notif, c.client_id,
          array[c.videomaker_id], 'grav_lembretes');
      else
        perform public.notif_entregar(evid, tipo_notif, titulo_notif, msg_notif, link_notif, c.client_id,
          null, null, array['videomaker'], 'grav_lembretes');
      end if;
    else
      rotulo := case c.tipo when 'apresentacao' then 'Apresentação' when 'reuniao' then 'Reunião' else 'Compromisso' end;
      titulo_notif := rotulo || case when etapa = '24h' then ' amanhã' || hora
                                     else ' em 1 hora, às ' || to_char(c.inicio at time zone 'America/Sao_Paulo', 'HH24:MI') end;
      msg_notif := concat_ws(' · ',
        nullif(btrim(coalesce(c.titulo, '')), ''),
        case when coalesce(btrim(c.local), '') <> '' then 'Local: ' || btrim(c.local) end);
      perform public.notif_entregar(evid, tipo_notif, titulo_notif, msg_notif, link_notif, c.client_id,
        null, null, array['admin', 'coordenador', 'designer', 'videomaker'], 'agenda');
    end if;

    update public.eventos_dominio set processado_em = now() where id = evid;
    criados := criados + 1;
  end loop;

  return criados;
end;
$$;
revoke all on function public.agenda_verificar_lembretes() from public;
grant execute on function public.agenda_verificar_lembretes() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. ROTEIROS E LINHA EDITORIAL — entrada em revisão e "pronto para gravar"
-- ---------------------------------------------------------------------
-- Só duas transições avisam, e no máximo uma vez por dia cada (a chave
-- leva a data): digitar, salvar ou trocar título nunca notifica.
-- Um erro aqui jamais impede o roteiro de ser salvo.
create or replace function public.roteiros_notificar_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare g public.gravacoes%rowtype; ev uuid; link text; item text; tipo_ev text;
begin
  if new.status is not distinct from old.status or new.deleted_at is not null then return new; end if;
  if new.status = 'Em revisão' then tipo_ev := 'roteiro.revisao';
  elsif new.status = 'Pronto para gravar' and old.status is distinct from 'Gravado' then tipo_ev := 'roteiro.pronto';
  else return new; end if;

  begin
    select * into g from public.gravacoes where id = new.recording_session_id;
    if tipo_ev = 'roteiro.pronto' and g.videomaker_id is null then return new; end if;

    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, payload, processado_em)
    values (tipo_ev, 'roteiro.status:' || new.id || ':' || new.status || ':' || public.notif_hoje()::text,
            'roteiro', new.id, g.client_id, auth.uid(), (select nome from public.perfis where id = auth.uid()),
            jsonb_build_object('titulo', new.titulo), now())
    on conflict (chave) do nothing
    returning id into ev;
    if ev is null then return new; end if;

    link := case when new.recording_session_id is not null
                 then '#/gravacao/' || new.recording_session_id || '?roteiro=' || new.id else '#/roteiros' end;
    item := '"' || coalesce(nullif(btrim(new.titulo), ''), 'Roteiro sem título') || '"';

    if tipo_ev = 'roteiro.revisao' then
      perform public.notif_entregar(ev, tipo_ev, 'Roteiro aguardando revisão',
        item || ' · Pronto para revisão interna.', link, g.client_id,
        null, null, array['coordenador'], 'co_revisoes', 'adm_revisoes', auth.uid());
    else
      perform public.notif_entregar(ev, tipo_ev, 'Roteiro pronto para gravação',
        concat_ws(' · ', item, nullif(btrim(g.nome), '')), link, g.client_id,
        array[g.videomaker_id], 'roteiros_prontos', p_ator => auth.uid());
    end if;
  exception when others then
    raise warning 'roteiros_notificar_status: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists roteiros_notificar_status on public.roteiros;
create trigger roteiros_notificar_status
  after update of status on public.roteiros
  for each row execute function public.roteiros_notificar_status();

-- Linha editorial: só a entrada em "Em revisão" avisa quem coordena.
-- Mesmas garantias do roteiro: uma vez por dia, nunca bloqueia o salvar.
create or replace function public.linhas_notificar_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ev uuid;
begin
  if new.status is not distinct from old.status or new.status <> 'Em revisão' or new.deleted_at is not null then
    return new;
  end if;
  begin
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, payload, processado_em)
    values ('linha.revisao', 'linha.status:' || new.id || ':' || new.status || ':' || public.notif_hoje()::text,
            'linha_editorial', new.id, new.client_id, auth.uid(), (select pa.nome from public.perfis pa where pa.id = auth.uid()),
            jsonb_build_object('linha_nome', new.nome), now())
    on conflict (chave) do nothing
    returning id into ev;
    if ev is null then return new; end if;
    perform public.notif_entregar(ev, 'linha.revisao', 'Linha Editorial aguardando revisão',
      concat_ws(' · ', nullif(btrim(coalesce(new.nome, '')), ''),
        case when new.mes between 1 and 12 and new.ano is not null then public.notif_mes(new.mes, new.ano) end,
        'Pronta para revisão.'),
      '#/linha/' || new.id, new.client_id,
      null, null, array['coordenador'], 'co_revisoes', 'adm_revisoes', auth.uid());
  exception when others then
    raise warning 'linhas_notificar_status: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists linhas_notificar_status on public.linhas_editoriais;
create trigger linhas_notificar_status
  after update of status on public.linhas_editoriais
  for each row execute function public.linhas_notificar_status();

-- ---------------------------------------------------------------------
-- 10. RESUMO DIÁRIO (opcional, desligado por padrão para todos)
-- ---------------------------------------------------------------------
-- Um aviso por pessoa por dia, só para quem ligou e só se houver algo.
-- Identidade B7 (sem cliente). Conta o que é da pessoa; quem coordena ou
-- administra recebe também os números da operação.
create or replace function public._notif_resumo_diario()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p record; hoje date := public.notif_hoje(); evid uuid; criados integer := 0;
  n_prazos integer; n_grav integer; n_pub integer; n_atras integer; gestao boolean; operacional boolean;
  partes text[];
begin
  for p in
    select pf.id, pf.papel,
           array(select f.funcao from public.perfis_funcoes_extra f where f.perfil_id = pf.id) || pf.papel as funcoes
      from public.perfis pf
     where pf.estado = 'ativa' and pf.papel <> 'cliente'
       and public.notif_pref_ativa(pf.preferencias, 'resumo_diario')
  loop
    partes := '{}';
    gestao := p.funcoes && array['admin', 'coordenador'];
    operacional := p.funcoes && array['videomaker', 'designer', 'coordenador'];

    select (select count(*) from public.demandas_edicao d
             where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
               and d.prazo = hoje and d.videomaker_id = p.id)
         + (select count(*) from public.design_deliverables dd
             where dd.deleted_at is null and dd.status not in ('finalizado', 'aprovado_cliente')
               and dd.prazo = hoje and dd.designer_id = p.id)
      into n_prazos;
    select count(*) into n_grav
      from public.gravacoes_ocorrencias o
      join public.gravacoes g on g.id = o.gravacao_id and g.deleted_at is null
     where o.atual and o.status = 'marcada'
       and (o.inicio at time zone 'America/Sao_Paulo')::date = hoje + 1
       and (g.videomaker_id = p.id or (g.videomaker_id is null and 'videomaker' = any(p.funcoes)));

    if n_prazos > 0 then
      partes := partes || (n_prazos || case when n_prazos = 1 then ' demanda com prazo hoje' else ' demandas com prazo hoje' end);
    end if;
    if n_grav > 0 then
      partes := partes || (n_grav || case when n_grav = 1 then ' gravação amanhã' else ' gravações amanhã' end);
    end if;

    if gestao then
      select count(*) into n_pub from public.conteudos c
       where c.deleted_at is null and c.archived_at is null
         and c.data_postagem = hoje and coalesce(c.status, '') <> 'Publicado';
      select count(*) into n_atras from public.demandas_edicao d
       where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado') and d.prazo < hoje;
      if n_pub > 0 then
        partes := partes || (n_pub || case when n_pub = 1 then ' publicação prevista para hoje' else ' publicações previstas para hoje' end);
      end if;
      if n_atras > 0 then
        partes := partes || (n_atras || case when n_atras = 1 then ' vídeo em atraso na operação' else ' vídeos em atraso na operação' end);
      end if;
    end if;

    if coalesce(array_length(partes, 1), 0) = 0 then continue; end if;

    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, payload, processado_em)
    values ('resumo.diario', 'resumo.diario:' || p.id || ':' || hoje::text, 'perfil', p.id,
            jsonb_build_object('partes', to_jsonb(partes)), now())
    on conflict (chave) do nothing
    returning id into evid;
    if evid is null then continue; end if;

    insert into public.notificacoes (evento_id, destinatario_id, tipo, titulo, mensagem, link)
    values (evid, p.id, 'resumo.diario', 'Resumo do dia — B7', array_to_string(partes, ' · ') || '.',
            case when operacional then '#/painel' else '#/' end)
    on conflict (evento_id, destinatario_id) do nothing;
    criados := criados + 1;
  end loop;
  return criados;
end;
$$;
revoke all on function public._notif_resumo_diario() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. AGENDAMENTO — um job só para prazos e resumo
-- ---------------------------------------------------------------------
-- Antes, prazo de vídeo só era verificado quando alguém abria a tela de
-- Vídeo. Agora o banco confere sozinho, de hora em hora, em horário
-- comercial (08h–19h de Brasília): ninguém recebe push de prazo de
-- madrugada. O resumo sai na rodada das 08h.
create or replace function public.notif_verificar_agendados()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare h integer := extract(hour from now() at time zone 'America/Sao_Paulo')::int;
begin
  if h < 8 or h > 19 then return; end if;
  perform public._video_alertas_prazo(null);
  perform public._design_alertas_prazo();
  if h = 8 then perform public._notif_resumo_diario(); end if;
end;
$$;
revoke all on function public.notif_verificar_agendados() from public, anon, authenticated;

-- Demandas que JÁ estão atrasadas há 5 dias ou mais no momento desta
-- migration: o estágio "crítico" é marcado como já contabilizado, sem
-- notificar. Só atrasos que cruzarem a régua daqui pra frente avisam.
insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload, processado_em)
select 'video.atrasado_critico', 'video.atrasado_critico:' || d.id, 'demanda_edicao', d.id, d.client_id,
       jsonb_build_object('titulo', d.titulo, 'semeado', true), now()
  from public.demandas_edicao d
 where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
   and d.prazo is not null and d.prazo <= public.notif_hoje() - 5
on conflict (chave) do nothing;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'notif-agendados';
-- 11h–22h UTC = 08h–19h de Brasília
select cron.schedule('notif-agendados', '5 11-22 * * *', $cron$select public.notif_verificar_agendados()$cron$);
