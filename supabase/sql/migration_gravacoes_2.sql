-- =========================================================================
-- GRAVAÇÕES 2.0 (fase 5)
--
-- A gravação passa a ser uma SESSÃO DE PRODUÇÃO independente: tem mês de
-- referência próprio, uma lista de itens (roteiros, trends/referências,
-- conteúdo avulso, conteúdos da Linha Editorial) com execução item a
-- item, responsável (videomaker) e histórico de verdade.
--
-- O que JÁ existia e é reaproveitado (não duplicado):
--   • gravacoes_ocorrencias (migration_calendario_status.sql) — é o
--     modelo canônico de datas e status (marcada/remarcada/concluída/
--     cancelada). Remarcar já cria uma ocorrência nova e congela a antiga.
--     Aqui ela passa a ser a ÚNICA fonte da data/situação da gravação:
--     um gatilho copia a ocorrência atual para gravacoes.situacao,
--     data_gravacao e horários (com o fuso de São Paulo — antes a data
--     era cortada em UTC e uma gravação às 22h caía no dia seguinte).
--   • roteiros.recording_session_id continua sendo a "casa" do roteiro
--     (onde ele é escrito). O item da gravação só APONTA para o roteiro.
--   • demandas_edicao usa competencia_ano/competencia_mes — o mês de
--     referência da gravação segue a MESMA convenção.
--
-- Tudo aditivo. Nenhuma gravação, roteiro, cena ou ocorrência é apagada.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. GRAVAÇÕES: mês de referência, responsável, conclusão, "Remarcada"
-- -------------------------------------------------------------------------
alter table public.gravacoes
  add column if not exists competencia_ano smallint,
  add column if not exists competencia_mes smallint,
  add column if not exists videomaker_id uuid references public.perfis(id) on delete set null,
  add column if not exists concluida_em timestamptz,
  add column if not exists concluida_por uuid references public.perfis(id) on delete set null;

alter table public.gravacoes drop constraint if exists gravacoes_competencia_valida;
alter table public.gravacoes add constraint gravacoes_competencia_valida check (
  (competencia_ano is null and competencia_mes is null) or
  (competencia_ano between 2000 and 2100 and competencia_mes between 1 and 12));

alter table public.gravacoes drop constraint if exists gravacoes_situacao_valida;
alter table public.gravacoes add constraint gravacoes_situacao_valida
  check (situacao = any (array['Pendente', 'Agendada', 'Remarcada', 'Gravada', 'Cancelada']));

create index if not exists gravacoes_competencia on public.gravacoes (competencia_ano, competencia_mes) where deleted_at is null;
create index if not exists gravacoes_videomaker on public.gravacoes (videomaker_id) where videomaker_id is not null;

alter table public.gravacoes_ocorrencias add column if not exists sem_horario boolean not null default false;

-- -------------------------------------------------------------------------
-- 2. HISTÓRICO DA GRAVAÇÃO — só ações persistidas de verdade
-- -------------------------------------------------------------------------
create table if not exists public.gravacao_historico (
  id uuid primary key default gen_random_uuid(),
  gravacao_id uuid not null references public.gravacoes(id) on delete cascade,
  tipo text not null,
  dados jsonb not null default '{}'::jsonb,
  ator_id uuid references public.perfis(id) on delete set null,
  ator_nome text,
  criado_em timestamptz not null default now()
);
create index if not exists gravacao_historico_gravacao on public.gravacao_historico (gravacao_id, criado_em);
alter table public.gravacao_historico enable row level security;
revoke all on public.gravacao_historico from anon;
grant select on public.gravacao_historico to authenticated;
revoke insert, update, delete on public.gravacao_historico from authenticated;
drop policy if exists "gravacao_historico select" on public.gravacao_historico;
create policy "gravacao_historico select" on public.gravacao_historico
  for select to authenticated using (public.sou_equipe_interna());

create or replace function public._grav_hist(p_gravacao uuid, p_tipo text, p_dados jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('b7.sem_historico', true), '') = 'on' then return; end if;
  insert into public.gravacao_historico (gravacao_id, tipo, dados, ator_id, ator_nome)
  values (p_gravacao, p_tipo, coalesce(p_dados, '{}'::jsonb), auth.uid(),
          (select nome from public.perfis where id = auth.uid()));
end;
$$;
revoke all on function public._grav_hist(uuid, text, jsonb) from public, anon, authenticated;

-- notificação simples para o responsável (mesma tabela e mesmo formato
-- do resto do sistema: um evento de domínio + a notificação)
create or replace function public._grav_notificar(p_gravacao uuid, p_dest uuid, p_tipo text, p_titulo text, p_msg text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; ev uuid;
begin
  if p_dest is null or p_dest = auth.uid() then return; end if;
  if coalesce(current_setting('b7.sem_historico', true), '') = 'on' then return; end if;
  select * into g from public.gravacoes where id = p_gravacao;
  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, payload, processado_em)
  values (p_tipo, p_tipo || ':' || p_gravacao || ':' || p_dest || ':' || clock_timestamp()::text, 'gravacao', p_gravacao,
          g.client_id, auth.uid(), (select nome from public.perfis where id = auth.uid()), '{}'::jsonb, now())
  returning id into ev;
  insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
  values (ev, p_dest, g.client_id, p_tipo, p_titulo, p_msg, '#/gravacao/' || p_gravacao)
  on conflict do nothing;
end;
$$;
revoke all on function public._grav_notificar(uuid, uuid, text, text, text) from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 3. REGRAS NA TABELA gravacoes
--    • gravação NOVA sem mês de referência não entra (antigas ficam como
--      estão — legado)
--    • mês já definido não pode ser apagado
--    • histórico de criação, mudança de mês e de responsável
-- -------------------------------------------------------------------------
create or replace function public.gravacoes_regras_antes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.competencia_ano is null or new.competencia_mes is null then
      raise exception 'Informe o mês de referência da gravação.' using errcode = '23514';
    end if;
  elsif old.competencia_ano is not null and (new.competencia_ano is null or new.competencia_mes is null) then
    raise exception 'O mês de referência não pode ficar vazio.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists gravacoes_regras_antes on public.gravacoes;
create trigger gravacoes_regras_antes before insert or update of competencia_ano, competencia_mes on public.gravacoes
  for each row execute function public.gravacoes_regras_antes();

create or replace function public.gravacoes_historico_depois()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._grav_hist(new.id, 'criada', jsonb_build_object('nome', new.nome,
      'competencia', case when new.competencia_ano is null then null else new.competencia_ano || '-' || lpad(new.competencia_mes::text, 2, '0') end));
    if new.videomaker_id is not null then
      perform public._grav_notificar(new.id, new.videomaker_id, 'gravacao.atribuida',
        'Você é o responsável pela gravação "' || new.nome || '"');
    end if;
    return new;
  end if;
  if (new.competencia_ano, new.competencia_mes) is distinct from (old.competencia_ano, old.competencia_mes) then
    perform public._grav_hist(new.id, 'mes_definido', jsonb_build_object(
      'de', case when old.competencia_ano is null then null else old.competencia_ano || '-' || lpad(old.competencia_mes::text, 2, '0') end,
      'para', new.competencia_ano || '-' || lpad(new.competencia_mes::text, 2, '0')));
  end if;
  if new.videomaker_id is distinct from old.videomaker_id then
    perform public._grav_hist(new.id, 'responsavel_definido', jsonb_build_object(
      'de', (select nome from public.perfis where id = old.videomaker_id),
      'para', (select nome from public.perfis where id = new.videomaker_id)));
    perform public._grav_notificar(new.id, new.videomaker_id, 'gravacao.atribuida',
      'Você é o responsável pela gravação "' || new.nome || '"');
  end if;
  return new;
end;
$$;
drop trigger if exists gravacoes_historico_depois on public.gravacoes;
create trigger gravacoes_historico_depois after insert or update of competencia_ano, competencia_mes, videomaker_id on public.gravacoes
  for each row execute function public.gravacoes_historico_depois();

-- -------------------------------------------------------------------------
-- 4. OCORRÊNCIA ATUAL → GRAVAÇÃO (fonte única de data e situação)
-- -------------------------------------------------------------------------
create or replace function public.gravacoes_ocorrencias_sincronizar()
returns trigger language plpgsql security definer set search_path = public as $$
declare oc public.gravacoes_ocorrencias%rowtype; houve_remarcacao boolean; anterior public.gravacoes_ocorrencias%rowtype;
        ini_local timestamp; fim_local timestamp;
begin
  select * into oc from public.gravacoes_ocorrencias where gravacao_id = new.gravacao_id and atual limit 1;
  if found then
    houve_remarcacao := oc.ocorrencia_anterior_id is not null or exists (
      select 1 from public.gravacoes_ocorrencias where gravacao_id = new.gravacao_id and status = 'remarcada');
    ini_local := oc.inicio at time zone 'America/Sao_Paulo';
    fim_local := oc.fim at time zone 'America/Sao_Paulo';
    update public.gravacoes g set
      data_gravacao = ini_local::date,
      hora_inicio = case when oc.sem_horario then null else ini_local::time end,
      hora_fim = case when oc.sem_horario or oc.fim is null or oc.fim = oc.inicio then null else fim_local::time end,
      situacao = case oc.status
                   when 'concluida' then 'Gravada'
                   when 'cancelada' then 'Cancelada'
                   else case when houve_remarcacao then 'Remarcada' else 'Agendada' end end,
      concluida_em = case when oc.status = 'concluida' then coalesce(g.concluida_em, g.gravada_em, now()) else g.concluida_em end,
      concluida_por = case when oc.status = 'concluida' then coalesce(g.concluida_por, auth.uid()) else g.concluida_por end
    where g.id = new.gravacao_id;
  end if;

  -- histórico (só mudança real: inserção, ou troca de status)
  if tg_op = 'INSERT' then
    if new.ocorrencia_anterior_id is not null then
      select * into anterior from public.gravacoes_ocorrencias where id = new.ocorrencia_anterior_id;
      perform public._grav_hist(new.gravacao_id, 'remarcada', jsonb_build_object(
        'de', anterior.inicio, 'de_sem_horario', anterior.sem_horario,
        'para', new.inicio, 'para_sem_horario', new.sem_horario,
        'anterior_status', anterior.status));
      perform public._grav_notificar(new.gravacao_id, (select videomaker_id from public.gravacoes where id = new.gravacao_id),
        'gravacao.remarcada', 'Gravação remarcada para ' || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM') ||
        coalesce(' — ' || (select nome from public.gravacoes where id = new.gravacao_id), ''));
    else
      perform public._grav_hist(new.gravacao_id, 'data_definida', jsonb_build_object('para', new.inicio, 'para_sem_horario', new.sem_horario));
    end if;
  elsif new.status is distinct from old.status and new.atual then
    if new.status = 'concluida' then
      perform public._grav_hist(new.gravacao_id, 'concluida', jsonb_build_object(
        'itens', (select count(*) from public.gravacao_itens i where i.gravacao_id = new.gravacao_id and i.removido_em is null),
        'gravados', (select count(*) from public.gravacao_itens i where i.gravacao_id = new.gravacao_id and i.removido_em is null and i.gravado)));
    elsif new.status = 'cancelada' then
      perform public._grav_hist(new.gravacao_id, 'cancelada', jsonb_build_object('motivo', new.motivo_cancelamento, 'data', new.inicio));
      perform public._grav_notificar(new.gravacao_id, (select videomaker_id from public.gravacoes where id = new.gravacao_id),
        'gravacao.cancelada', 'Gravação cancelada' || coalesce(' — ' || (select nome from public.gravacoes where id = new.gravacao_id), ''),
        new.motivo_cancelamento);
    end if;
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- 5. ITENS DA GRAVAÇÃO
-- -------------------------------------------------------------------------
create table if not exists public.gravacao_itens (
  id uuid primary key default gen_random_uuid(),
  gravacao_id uuid not null references public.gravacoes(id) on delete cascade,
  tipo text not null check (tipo in ('roteiro', 'referencia', 'avulso', 'conteudo')),
  roteiro_id uuid references public.roteiros(id) on delete cascade,
  conteudo_id uuid references public.conteudos(id) on delete cascade,
  titulo text,
  url text,
  observacao text,
  position integer not null default 0,
  gravado boolean not null default false,
  gravado_em timestamptz,
  gravado_por uuid references public.perfis(id) on delete set null,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references public.perfis(id) on delete set null,
  constraint gravacao_itens_forma check (
    (tipo = 'roteiro' and roteiro_id is not null) or
    (tipo = 'conteudo' and conteudo_id is not null) or
    (tipo = 'referencia' and url is not null and coalesce(btrim(titulo), '') <> '') or
    (tipo = 'avulso' and coalesce(btrim(titulo), '') <> ''))
);
create index if not exists gravacao_itens_gravacao on public.gravacao_itens (gravacao_id, position) where removido_em is null;
create index if not exists gravacao_itens_roteiro on public.gravacao_itens (roteiro_id) where roteiro_id is not null;
create index if not exists gravacao_itens_conteudo on public.gravacao_itens (conteudo_id) where conteudo_id is not null;
-- o mesmo roteiro/conteúdo não entra duas vezes na MESMA gravação (ativo)
create unique index if not exists gravacao_itens_roteiro_unico on public.gravacao_itens (gravacao_id, roteiro_id)
  where removido_em is null and roteiro_id is not null;
create unique index if not exists gravacao_itens_conteudo_unico on public.gravacao_itens (gravacao_id, conteudo_id)
  where removido_em is null and conteudo_id is not null;

alter table public.gravacao_itens enable row level security;
revoke all on public.gravacao_itens from anon;
grant select on public.gravacao_itens to authenticated;
revoke insert, update, delete on public.gravacao_itens from authenticated;
drop policy if exists "gravacao_itens select" on public.gravacao_itens;
create policy "gravacao_itens select" on public.gravacao_itens
  for select to authenticated using (public.sou_equipe_interna());

-- leitura: item + o que ele aponta (sem copiar nada)
drop view if exists public.gravacao_itens_resumo;
create view public.gravacao_itens_resumo with (security_invoker = true) as
select i.id, i.gravacao_id, i.tipo, i.roteiro_id, i.conteudo_id, i.titulo, i.url, i.observacao, i.position,
       i.gravado, i.gravado_em, i.gravado_por, gp.nome as gravado_por_nome, i.criado_em, i.criado_por,
       r.titulo as roteiro_titulo, r.status as roteiro_status, r.recording_session_id as roteiro_gravacao_id,
       (r.deleted_at is not null) as roteiro_removido,
       ct.titulo as conteudo_titulo, ct.tipo as conteudo_tipo, ct.data_postagem as conteudo_data_postagem,
       ct.linha_id as conteudo_linha_id, ct.status as conteudo_status
from public.gravacao_itens i
left join public.roteiros r on r.id = i.roteiro_id
left join public.conteudos ct on ct.id = i.conteudo_id
left join public.perfis gp on gp.id = i.gravado_por
where i.removido_em is null;
grant select on public.gravacao_itens_resumo to authenticated;

-- quem opera itens: equipe (admin/coordenador) em tudo; o videomaker
-- responsável pela gravação só marca o que foi gravado
create or replace function public._grav_pode_editar() returns boolean
language sql stable security definer set search_path = public as $$ select public.sou_equipe() $$;

create or replace function public.gravacao_item_adicionar(
  p_gravacao_id uuid, p_tipo text, p_roteiro_id uuid default null, p_conteudo_id uuid default null,
  p_titulo text default null, p_url text default null, p_observacao text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; novo uuid; cli uuid; pos int; tit text;
begin
  if not public._grav_pode_editar() then raise exception 'Sem permissão para editar os itens desta gravação.' using errcode = '42501'; end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  if p_tipo not in ('roteiro', 'referencia', 'avulso', 'conteudo') then raise exception 'Tipo de item inválido.'; end if;

  if p_tipo = 'roteiro' then
    select gr.client_id, r.titulo into cli, tit from public.roteiros r join public.gravacoes gr on gr.id = r.recording_session_id
     where r.id = p_roteiro_id and r.deleted_at is null;
    if not found then raise exception 'Roteiro não encontrado.'; end if;
    if cli is distinct from g.client_id then raise exception 'Esse roteiro é de outro cliente.'; end if;
    if exists (select 1 from public.gravacao_itens where gravacao_id = g.id and roteiro_id = p_roteiro_id and removido_em is null) then
      raise exception 'Esse roteiro já está nesta gravação.';
    end if;
  elsif p_tipo = 'conteudo' then
    select client_id, titulo into cli, tit from public.conteudos where id = p_conteudo_id and deleted_at is null;
    if not found then raise exception 'Conteúdo não encontrado.'; end if;
    if cli is distinct from g.client_id then raise exception 'Esse conteúdo é de outro cliente.'; end if;
    if exists (select 1 from public.gravacao_itens where gravacao_id = g.id and conteudo_id = p_conteudo_id and removido_em is null) then
      raise exception 'Esse conteúdo já está nesta gravação.';
    end if;
  elsif p_tipo = 'referencia' then
    if coalesce(btrim(p_url), '') !~* '^https?://[^\s]+$' then raise exception 'Informe um link começando com http:// ou https://'; end if;
    if coalesce(btrim(p_titulo), '') = '' then raise exception 'Dê um nome para a referência.'; end if;
    tit := btrim(p_titulo);
  else
    if coalesce(btrim(p_titulo), '') = '' then raise exception 'Dê um nome para o conteúdo avulso.'; end if;
    tit := btrim(p_titulo);
  end if;

  select coalesce(max(position), 0) + 1 into pos from public.gravacao_itens where gravacao_id = g.id and removido_em is null;
  insert into public.gravacao_itens (gravacao_id, tipo, roteiro_id, conteudo_id, titulo, url, observacao, position, criado_por)
  values (g.id, p_tipo,
          case when p_tipo = 'roteiro' then p_roteiro_id end,
          case when p_tipo = 'conteudo' then p_conteudo_id end,
          case when p_tipo in ('referencia', 'avulso') then tit end,
          case when p_tipo = 'referencia' then btrim(p_url) end,
          nullif(btrim(coalesce(p_observacao, '')), ''), pos, auth.uid())
  returning id into novo;
  perform public._grav_hist(g.id, 'item_adicionado', jsonb_build_object('item_id', novo, 'tipo', p_tipo, 'titulo', tit));
  return novo;
end;
$$;

create or replace function public.gravacao_item_editar(p_item_id uuid, p_titulo text, p_url text default null, p_observacao text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.gravacao_itens%rowtype;
begin
  if not public._grav_pode_editar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into i from public.gravacao_itens where id = p_item_id and removido_em is null;
  if not found then raise exception 'Item não encontrado.'; end if;
  if i.tipo in ('referencia', 'avulso') and coalesce(btrim(p_titulo), '') = '' then raise exception 'Dê um nome para o item.'; end if;
  if i.tipo = 'referencia' and coalesce(btrim(p_url), '') !~* '^https?://[^\s]+$' then raise exception 'Informe um link começando com http:// ou https://'; end if;
  update public.gravacao_itens set
    titulo = case when tipo in ('referencia', 'avulso') then btrim(p_titulo) else titulo end,
    url = case when tipo = 'referencia' then btrim(p_url) else url end,
    observacao = nullif(btrim(coalesce(p_observacao, '')), '')
  where id = p_item_id;
end;
$$;

-- tirar da gravação NÃO apaga o roteiro nem o conteúdo: só o vínculo
-- (e o item fica guardado, marcado como removido, para o histórico)
create or replace function public.gravacao_item_remover(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.gravacao_itens%rowtype; tit text;
begin
  if not public._grav_pode_editar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into i from public.gravacao_itens where id = p_item_id and removido_em is null;
  if not found then raise exception 'Item não encontrado.'; end if;
  update public.gravacao_itens set removido_em = now(), removido_por = auth.uid() where id = p_item_id;
  tit := coalesce(i.titulo, (select titulo from public.roteiros where id = i.roteiro_id), (select titulo from public.conteudos where id = i.conteudo_id));
  perform public._grav_hist(i.gravacao_id, 'item_removido', jsonb_build_object('item_id', i.id, 'tipo', i.tipo, 'titulo', tit, 'estava_gravado', i.gravado));
end;
$$;

create or replace function public.gravacao_item_mover(p_item_id uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare i public.gravacao_itens%rowtype; vizinho public.gravacao_itens%rowtype;
begin
  if not public._grav_pode_editar() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into i from public.gravacao_itens where id = p_item_id and removido_em is null;
  if not found then raise exception 'Item não encontrado.'; end if;
  if p_delta < 0 then
    select * into vizinho from public.gravacao_itens where gravacao_id = i.gravacao_id and removido_em is null
      and (position, criado_em) < (i.position, i.criado_em) order by position desc, criado_em desc limit 1;
  else
    select * into vizinho from public.gravacao_itens where gravacao_id = i.gravacao_id and removido_em is null
      and (position, criado_em) > (i.position, i.criado_em) order by position, criado_em limit 1;
  end if;
  if not found then return; end if;
  if vizinho.position = i.position then
    update public.gravacao_itens set position = position + case when p_delta < 0 then 1 else -1 end where id = vizinho.id;
  else
    update public.gravacao_itens set position = vizinho.position where id = i.id;
    update public.gravacao_itens set position = i.position where id = vizinho.id;
  end if;
end;
$$;

-- REGRA CENTRAL de "gravado": o item guarda quem e quando; se for um
-- roteiro, o status canônico do roteiro acompanha ("Gravado" / volta
-- para "Pronto para gravar" se nenhuma outra gravação o tiver gravado)
create or replace function public.gravacao_item_marcar(p_item_id uuid, p_gravado boolean)
returns void language plpgsql security definer set search_path = public as $$
declare i public.gravacao_itens%rowtype; g public.gravacoes%rowtype; tit text;
begin
  select * into i from public.gravacao_itens where id = p_item_id and removido_em is null;
  if not found then raise exception 'Item não encontrado.'; end if;
  select * into g from public.gravacoes where id = i.gravacao_id;
  if not (public.sou_equipe() or coalesce(g.videomaker_id = auth.uid(), false)) then
    raise exception 'Só a equipe ou o videomaker responsável marcam o que foi gravado.' using errcode = '42501';
  end if;
  if i.gravado = p_gravado then return; end if;
  update public.gravacao_itens set gravado = p_gravado,
    gravado_em = case when p_gravado then now() end, gravado_por = case when p_gravado then auth.uid() end
  where id = p_item_id;
  if i.tipo = 'roteiro' then
    perform set_config('b7.item_sync', 'on', true);
    if p_gravado then
      update public.roteiros set status = 'Gravado' where id = i.roteiro_id and status is distinct from 'Gravado';
    elsif not exists (select 1 from public.gravacao_itens where roteiro_id = i.roteiro_id and gravado and removido_em is null) then
      update public.roteiros set status = 'Pronto para gravar' where id = i.roteiro_id and status = 'Gravado';
    end if;
    perform set_config('b7.item_sync', '', true);
  end if;
  tit := coalesce(i.titulo, (select titulo from public.roteiros where id = i.roteiro_id), (select titulo from public.conteudos where id = i.conteudo_id));
  perform public._grav_hist(i.gravacao_id, case when p_gravado then 'item_gravado' else 'item_desmarcado' end,
    jsonb_build_object('item_id', i.id, 'tipo', i.tipo, 'titulo', tit));
end;
$$;

-- roteiro novo escrito numa gravação já entra como item dela; e mudar o
-- status do roteiro para/de "Gravado" (pelo editor) reflete no item da
-- gravação-casa — a MESMA regra, nos dois sentidos, sem laço
create or replace function public.roteiros_itens_gravacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.recording_session_id is not null and not exists (
      select 1 from public.gravacao_itens where gravacao_id = new.recording_session_id and roteiro_id = new.id and removido_em is null) then
      insert into public.gravacao_itens (gravacao_id, tipo, roteiro_id, position, gravado, gravado_em, criado_por)
      values (new.recording_session_id, 'roteiro', new.id,
              coalesce((select max(position) from public.gravacao_itens where gravacao_id = new.recording_session_id and removido_em is null), 0) + 1,
              new.status = 'Gravado', case when new.status = 'Gravado' then now() end, auth.uid());
    end if;
    return new;
  end if;
  if coalesce(current_setting('b7.item_sync', true), '') = 'on' then return new; end if;
  if new.status = 'Gravado' and old.status is distinct from 'Gravado' then
    update public.gravacao_itens set gravado = true, gravado_em = now(), gravado_por = auth.uid()
     where roteiro_id = new.id and gravacao_id = new.recording_session_id and removido_em is null and not gravado;
    if found then perform public._grav_hist(new.recording_session_id, 'item_gravado',
      jsonb_build_object('tipo', 'roteiro', 'titulo', new.titulo, 'via', 'status do roteiro')); end if;
  elsif old.status = 'Gravado' and new.status is distinct from 'Gravado' then
    update public.gravacao_itens set gravado = false, gravado_em = null, gravado_por = null
     where roteiro_id = new.id and gravacao_id = new.recording_session_id and removido_em is null and gravado;
    if found then perform public._grav_hist(new.recording_session_id, 'item_desmarcado',
      jsonb_build_object('tipo', 'roteiro', 'titulo', new.titulo, 'via', 'status do roteiro')); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists roteiros_itens_gravacao on public.roteiros;
create trigger roteiros_itens_gravacao after insert or update of status on public.roteiros
  for each row execute function public.roteiros_itens_gravacao();

-- -------------------------------------------------------------------------
-- 6. DATA / STATUS PELA GRAVAÇÃO (a tela da gravação usa estas; o
--    calendário continua com as calendario_ocorrencia_*, que agora também
--    alimentam o histórico e a situação pelo gatilho)
-- -------------------------------------------------------------------------
-- definir data (1ª vez) ou remarcar. Nunca apaga a data anterior.
create or replace function public.gravacao_agendar(
  p_gravacao_id uuid, p_data date, p_hora_inicio time default null, p_hora_fim time default null, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; o public.gravacoes_ocorrencias%rowtype; ini timestamptz; fim timestamptz; nova uuid; sem boolean;
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenador marcam ou remarcam gravações.' using errcode = '42501'; end if;
  if p_data is null then raise exception 'Escolha a data da gravação.'; end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  sem := p_hora_inicio is null;
  ini := (p_data + coalesce(p_hora_inicio, time '12:00')) at time zone 'America/Sao_Paulo';
  fim := case when p_hora_fim is null or sem then ini else (p_data + p_hora_fim) at time zone 'America/Sao_Paulo' end;
  if fim < ini then raise exception 'O horário de fim não pode ser antes do início.'; end if;

  select * into o from public.gravacoes_ocorrencias where gravacao_id = g.id and atual;
  if not found then
    insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, criado_por, sem_horario)
    values (g.id, 'marcada', ini, fim, true, auth.uid(), sem) returning id into nova;
    return jsonb_build_object('ocorrencia_id', nova, 'evento_id', null, 'remarcacao', false);
  end if;
  if o.status = 'concluida' then raise exception 'Esta gravação já foi concluída — não dá pra remarcar.'; end if;
  if o.inicio = ini and o.fim is not distinct from fim and o.sem_horario = sem and o.status = 'marcada' then
    return jsonb_build_object('ocorrencia_id', o.id, 'evento_id', o.evento_id, 'remarcacao', false, 'sem_mudanca', true);
  end if;
  update public.gravacoes_ocorrencias
     set status = case when status = 'cancelada' then 'cancelada' else 'remarcada' end, atual = false, atualizado_em = now()
   where id = o.id;
  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual, ocorrencia_anterior_id, criado_por, sem_horario)
  values (g.id, o.evento_id, 'marcada', ini, fim, true, o.id, auth.uid(), sem) returning id into nova;
  if coalesce(btrim(p_motivo), '') <> '' then
    update public.gravacao_historico set dados = dados || jsonb_build_object('motivo', btrim(p_motivo))
     where id = (select id from public.gravacao_historico where gravacao_id = g.id and tipo = 'remarcada' order by criado_em desc limit 1);
  end if;
  return jsonb_build_object('ocorrencia_id', nova, 'evento_id', o.evento_id, 'remarcacao', true);
end;
$$;

create or replace function public.gravacao_concluir(p_gravacao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; o public.gravacoes_ocorrencias%rowtype; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenador concluem uma gravação.' using errcode = '42501'; end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  select * into o from public.gravacoes_ocorrencias where gravacao_id = g.id and atual;
  if not found then
    insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, criado_por, sem_horario)
    values (g.id, 'marcada', (coalesce(g.data_gravacao, hoje) + time '12:00') at time zone 'America/Sao_Paulo',
            (coalesce(g.data_gravacao, hoje) + time '12:00') at time zone 'America/Sao_Paulo', true, auth.uid(), true)
    returning * into o;
  end if;
  if o.status = 'concluida' then return jsonb_build_object('ok', true); end if;
  if o.status = 'cancelada' then raise exception 'Esta gravação está cancelada — remarque antes de concluir.'; end if;
  update public.gravacoes_ocorrencias set status = 'concluida', atualizado_em = now() where id = o.id;
  update public.gravacoes set status = 'Gravado', gravada_em = coalesce(gravada_em, now()) where id = g.id and status is distinct from 'Gravado';
  return jsonb_build_object('ok', true, 'evento_id', o.evento_id);
end;
$$;

create or replace function public.gravacao_cancelar(p_gravacao_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.gravacoes%rowtype; o public.gravacoes_ocorrencias%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenador cancelam uma gravação.' using errcode = '42501'; end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;
  select * into o from public.gravacoes_ocorrencias where gravacao_id = g.id and atual;
  if not found then
    -- sem data marcada: não inventa uma data no calendário
    update public.gravacoes set situacao = 'Cancelada' where id = g.id;
    perform public._grav_hist(g.id, 'cancelada', jsonb_build_object('motivo', nullif(btrim(coalesce(p_motivo, '')), '')));
    return jsonb_build_object('ok', true, 'evento_id', null);
  end if;
  if o.status = 'concluida' then raise exception 'Esta gravação já foi concluída — não dá pra cancelar.'; end if;
  if o.status = 'cancelada' then return jsonb_build_object('ok', true, 'evento_id', o.evento_id); end if;
  update public.gravacoes_ocorrencias set status = 'cancelada', motivo_cancelamento = nullif(btrim(coalesce(p_motivo, '')), ''), atualizado_em = now()
   where id = o.id;
  return jsonb_build_object('ok', true, 'evento_id', o.evento_id, 'ocorrencia_id', o.id);
end;
$$;

-- Remarcar pelo CALENDÁRIO: mesma regra (a data antiga fica; uma
-- ocorrência cancelada continua "cancelada" no histórico ao ser
-- reativada) — e a data da gravação agora vem do gatilho, no fuso certo
create or replace function public.calendario_ocorrencia_remarcar(
  p_ocorrencia_id uuid, p_novo_inicio timestamptz, p_novo_fim timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.gravacoes_ocorrencias%rowtype; nova_id uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador remarcam uma gravação.' using errcode = '42501';
  end if;
  if p_novo_inicio is null then raise exception 'Escolha a nova data/horário da gravação.'; end if;
  select * into o from public.gravacoes_ocorrencias where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  if not o.atual then raise exception 'Só a ocorrência atual da gravação pode ser remarcada.'; end if;
  if o.status = 'concluida' then raise exception 'Esta gravação já foi concluída — não dá pra remarcar.'; end if;
  update public.gravacoes_ocorrencias
    set status = case when status = 'cancelada' then 'cancelada' else 'remarcada' end, atual = false, atualizado_em = now()
    where id = p_ocorrencia_id;
  insert into public.gravacoes_ocorrencias
    (gravacao_id, evento_id, status, inicio, fim, atual, ocorrencia_anterior_id, criado_por)
  values (o.gravacao_id, o.evento_id, 'marcada', p_novo_inicio, p_novo_fim, true, o.id, auth.uid())
  returning id into nova_id;
  return jsonb_build_object('nova_ocorrencia_id', nova_id, 'evento_id', o.evento_id);
end;
$$;

-- Marcar pelo calendário: agora também recebe o mês de referência (se
-- não vier, usa o mês da data — é só a sugestão; dá pra trocar depois)
drop function if exists public.calendario_marcar_gravacao(uuid, text, timestamptz, timestamptz, text, text);
create or replace function public.calendario_marcar_gravacao(
  p_client_id uuid, p_nome text, p_inicio timestamptz, p_fim timestamptz default null,
  p_local text default '', p_observacoes text default '',
  p_competencia_ano integer default null, p_competencia_mes integer default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare nova_gravacao uuid; nova_ocorrencia uuid; dia date;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador marcam uma gravação pelo calendário.' using errcode = '42501';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Selecione o cliente.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'Dê um nome para a gravação.'; end if;
  if p_inicio is null then raise exception 'Escolha a data e o horário da gravação.'; end if;
  dia := (p_inicio at time zone 'America/Sao_Paulo')::date;
  insert into public.gravacoes (client_id, nome, data_gravacao, local, observacoes, competencia_ano, competencia_mes)
  values (p_client_id, p_nome, dia, coalesce(p_local, ''), coalesce(p_observacoes, ''),
          coalesce(p_competencia_ano, extract(year from dia)::int), coalesce(p_competencia_mes, extract(month from dia)::int))
  returning id into nova_gravacao;
  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual, criado_por)
  values (nova_gravacao, null, 'marcada', p_inicio, coalesce(p_fim, p_inicio), true, auth.uid())
  returning id into nova_ocorrencia;
  return jsonb_build_object('gravacao_id', nova_gravacao, 'ocorrencia_id', nova_ocorrencia);
end;
$$;

-- Criar a partir de um evento do Google: mês de referência = mês da data
-- (sugestão, editável na gravação)
create or replace function public.calendario_criar_gravacao_de_evento(
  p_event_id uuid, p_client_id uuid, p_nome text, p_data_gravacao date,
  p_local text default '', p_observacoes text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare ev public.calendario_eventos%rowtype; nova uuid; dia date;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador criam gravação a partir de um evento.' using errcode = '42501';
  end if;
  select * into ev from public.calendario_eventos where id = p_event_id;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if exists (select 1 from public.calendario_vinculos where evento_id = p_event_id) then
    raise exception 'Este evento já está vinculado a uma gravação.';
  end if;
  if p_client_id is null or not exists (select 1 from public.clientes where id = p_client_id) then
    raise exception 'Selecione o cliente.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'Dê um nome para a gravação.'; end if;
  dia := coalesce(p_data_gravacao, (ev.inicio at time zone 'America/Sao_Paulo')::date);
  insert into public.gravacoes (client_id, nome, data_gravacao, local, observacoes, competencia_ano, competencia_mes)
  values (p_client_id, p_nome, dia, coalesce(p_local, ''), coalesce(p_observacoes, ''),
          extract(year from dia)::int, extract(month from dia)::int)
  returning id into nova;
  insert into public.calendario_vinculos (evento_id, gravacao_id, vinculado_por) values (p_event_id, nova, auth.uid());
  insert into public.gravacoes_ocorrencias (gravacao_id, evento_id, status, inicio, fim, atual)
  values (nova, p_event_id, 'marcada', ev.inicio, ev.fim, true);
  return nova;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'gravacao_item_adicionar(uuid, text, uuid, uuid, text, text, text)',
    'gravacao_item_editar(uuid, text, text, text)',
    'gravacao_item_remover(uuid)', 'gravacao_item_mover(uuid, integer)', 'gravacao_item_marcar(uuid, boolean)',
    'gravacao_agendar(uuid, date, time, time, text)', 'gravacao_concluir(uuid)', 'gravacao_cancelar(uuid, text)',
    'calendario_ocorrencia_remarcar(uuid, timestamptz, timestamptz)',
    'calendario_marcar_gravacao(uuid, text, timestamptz, timestamptz, text, text, integer, integer)',
    'calendario_criar_gravacao_de_evento(uuid, uuid, text, date, text, text)']
  loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
revoke all on function public._grav_pode_editar() from public, anon;
grant execute on function public._grav_pode_editar() to authenticated;

-- -------------------------------------------------------------------------
-- 7. LEGADO (sem inventar nada)
-- -------------------------------------------------------------------------
select set_config('b7.sem_historico', 'on', true);

-- 7a. itens: cada roteiro que já vive numa gravação vira item dela
insert into public.gravacao_itens (gravacao_id, tipo, roteiro_id, position, gravado, gravado_em, criado_em)
select r.recording_session_id, 'roteiro', r.id, coalesce(r.position, 0), r.status = 'Gravado',
       case when r.status = 'Gravado' then r.updated_at end, r.created_at
from public.roteiros r
where r.recording_session_id is not null and r.deleted_at is null
  and not exists (select 1 from public.gravacao_itens i where i.roteiro_id = r.id and i.gravacao_id = r.recording_session_id);

-- 7b. mês de referência: só quando uma relação confiável diz qual é
--     (todos os conteúdos ligados aos roteiros são de UMA linha/mês, ou
--     todas as demandas de edição da gravação são de UMA competência).
--     Sem isso, fica vazio (legado) — a tela pede para definir.
with por_linha as (
  select r.recording_session_id gid, min(l.ano) ano, min(l.mes) mes, count(distinct (l.ano, l.mes)) n
  from public.roteiros r join public.conteudos ct on ct.id = r.content_id
  join public.linhas_editoriais l on l.id = ct.linha_id
  where r.deleted_at is null group by 1
), por_demanda as (
  select d.gravacao_id gid, min(d.competencia_ano) ano, min(d.competencia_mes) mes, count(distinct (d.competencia_ano, d.competencia_mes)) n
  from public.demandas_edicao d where d.deleted_at is null and d.gravacao_id is not null and d.competencia_ano is not null group by 1
)
update public.gravacoes g set competencia_ano = x.ano, competencia_mes = x.mes
from (
  select g2.id,
         coalesce(case when pl.n = 1 then pl.ano end, case when pd.n = 1 then pd.ano end) ano,
         coalesce(case when pl.n = 1 then pl.mes end, case when pd.n = 1 then pd.mes end) mes
  from public.gravacoes g2 left join por_linha pl on pl.gid = g2.id left join por_demanda pd on pd.gid = g2.id
) x
where x.id = g.id and g.competencia_ano is null and x.ano is not null and x.mes is not null;

-- 7c. ocorrência para gravação que já tem data mas nunca apareceu no
--     calendário de status (criada por "+ Nova gravação"). Sem horário
--     conhecido: fica "sem horário" (meio-dia no fuso local só para a
--     data nunca escorregar de dia).
insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, sem_horario)
select g.id,
       case g.situacao when 'Gravada' then 'concluida' when 'Cancelada' then 'cancelada' else 'marcada' end,
       (g.data_gravacao + coalesce(g.hora_inicio, time '12:00')) at time zone 'America/Sao_Paulo',
       (g.data_gravacao + coalesce(g.hora_fim, g.hora_inicio, time '12:00')) at time zone 'America/Sao_Paulo',
       true, g.hora_inicio is null
from public.gravacoes g
where g.deleted_at is null and g.data_gravacao is not null
  and not exists (select 1 from public.gravacoes_ocorrencias o where o.gravacao_id = g.id);

-- o gatilho de sincronização só liga DEPOIS do legado (nada do que já
-- estava gravado é recalculado na migração)
drop trigger if exists gravacoes_ocorrencias_sincronizar on public.gravacoes_ocorrencias;
create trigger gravacoes_ocorrencias_sincronizar after insert or update on public.gravacoes_ocorrencias
  for each row execute function public.gravacoes_ocorrencias_sincronizar();

select set_config('b7.sem_historico', '', true);

-- -------------------------------------------------------------------------
-- 8. VIEWS (colunas novas sempre NO FIM — create or replace)
-- -------------------------------------------------------------------------
create or replace view public.gravacoes_resumo with (security_invoker = true) as
select g.id, g.client_id, g.nome, g.data_gravacao, g.local, g.responsavel, g.videomaker, g.observacoes, g.status,
       g.created_at, g.updated_at, g.is_pinned, g.archived_at, g.deleted_at, g.cover_style, g.situacao, g.gravada_em,
       g.hora_inicio, g.hora_fim, c.nome as cliente_nome, c.logo_url as cliente_logo_url,
       (select count(*) from public.roteiros r where r.recording_session_id = g.id and r.deleted_at is null) as total_roteiros,
       g.competencia_ano, g.competencia_mes, g.videomaker_id,
       (select p.nome from public.perfis p where p.id = g.videomaker_id) as videomaker_nome,
       (select count(*) from public.gravacao_itens i left join public.roteiros r on r.id = i.roteiro_id
         where i.gravacao_id = g.id and i.removido_em is null and (r.id is null or r.deleted_at is null)) as total_itens,
       (select count(*) from public.gravacao_itens i left join public.roteiros r on r.id = i.roteiro_id
         where i.gravacao_id = g.id and i.removido_em is null and i.gravado and (r.id is null or r.deleted_at is null)) as itens_gravados,
       g.concluida_em
from public.gravacoes g join public.clientes c on c.id = g.client_id;

create or replace view public.calendario_ocorrencias_resumo with (security_invoker = true) as
select o.id, o.gravacao_id, o.evento_id, o.status, o.inicio, o.fim, o.atual, o.ocorrencia_anterior_id,
       o.motivo_cancelamento, o.erro_sincronizacao, o.criado_em, o.atualizado_em,
       g.nome as gravacao_nome, g.status as gravacao_status, g.local as gravacao_local,
       g.client_id as gravacao_client_id, cl.nome as gravacao_cliente_nome, cl.logo_url as gravacao_cliente_logo_url,
       ev.titulo as evento_titulo, ev.external_event_id, ev.status_provider as evento_status_provider,
       ev.agenda_id, ag.nome as agenda_nome, ag.cor as agenda_cor,
       o.sem_horario, g.competencia_ano as gravacao_competencia_ano, g.competencia_mes as gravacao_competencia_mes,
       g.situacao as gravacao_situacao, g.videomaker_id as gravacao_videomaker_id
from public.gravacoes_ocorrencias o
join public.gravacoes g on g.id = o.gravacao_id
left join public.clientes cl on cl.id = g.client_id
left join public.calendario_eventos ev on ev.id = o.evento_id
left join public.calendario_agendas ag on ag.id = ev.agenda_id;

create or replace view public.agenda_compromissos with (security_invoker = true) as
select 'evento'::text as origem, ev.id, ev.titulo, ev.inicio, ev.fim, ev.dia_inteiro, ev.local,
       public.agenda_tipo_compromisso(ev.titulo) as tipo, vi.gravacao_id, cl.nome as cliente_nome, g.client_id,
       ag.nome as agenda_nome, g.videomaker_id
from public.calendario_eventos ev
join public.calendario_agendas ag on ag.id = ev.agenda_id and ag.ativo and ag.lembretes
left join public.calendario_vinculos vi on vi.evento_id = ev.id
left join public.gravacoes g on g.id = vi.gravacao_id
left join public.clientes cl on cl.id = g.client_id
where ev.status_provider <> 'cancelled' and upper(btrim(coalesce(ev.titulo, ''))) <> 'CANCELLED'
union all
select 'ocorrencia'::text, o.id, coalesce(g.nome, 'Gravação'), o.inicio, o.fim, o.sem_horario, g.local,
       'gravacao'::text, o.gravacao_id, cl.nome, g.client_id, null::text, g.videomaker_id
from public.gravacoes_ocorrencias o
join public.gravacoes g on g.id = o.gravacao_id and g.deleted_at is null
left join public.clientes cl on cl.id = g.client_id
where o.atual and o.status = 'marcada' and o.evento_id is null;

-- -------------------------------------------------------------------------
-- 9. Central de Produção: "Remarcada" continua sendo gravação que falta
--    fazer (troca cirúrgica, o resto da função fica igual)
-- -------------------------------------------------------------------------
do $$
declare def text;
begin
  def := pg_get_functiondef('public.painel_producao_contagens(date, date, uuid)'::regprocedure);
  if position('Remarcada' in def) = 0 then
    def := replace(def, $a$situacao in ('Pendente', 'Agendada')$a$, $a$situacao in ('Pendente', 'Agendada', 'Remarcada')$a$);
    def := replace(def, $a$filter (where situacao = 'Agendada')$a$, $a$filter (where situacao in ('Agendada', 'Remarcada'))$a$);
    execute def;
  end if;
end $$;

-- ============================================================
-- Endurecimento (aplicado como gravacoes_2_endurecer)
-- ============================================================
alter function public.gravacoes_regras_antes() set search_path = public;
revoke execute on function public.gravacoes_regras_antes() from public, anon, authenticated;
revoke execute on function public.gravacoes_historico_depois() from public, anon, authenticated;
revoke execute on function public.gravacoes_ocorrencias_sincronizar() from public, anon, authenticated;
revoke execute on function public.roteiros_itens_gravacao() from public, anon, authenticated;

-- ============================================================
-- Backfill pelo nome (aplicado como gravacoes_2_competencia_pelo_nome)
-- ============================================================
select set_config('b7.sem_historico', 'on', true);
update public.gravacoes g set competencia_ano = 2026, competencia_mes = m.mes
from (values ('janeiro',1),('fevereiro',2),('março',3),('marco',3),('abril',4),('maio',5),('junho',6),('julho',7),
             ('agosto',8),('setembro',9),('outubro',10),('novembro',11),('dezembro',12)) m(nome, mes)
where g.deleted_at is null and g.competencia_ano is null
  and extract(year from g.created_at) = 2026
  and lower(g.nome) ~ ('(^|[^a-zç])' || m.nome || '([^a-zç]|$)');
