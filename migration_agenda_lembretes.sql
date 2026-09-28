-- =========================================================================
-- LEMBRETES DA AGENDA — avisa antes do compromisso acontecer
--
-- Regra combinada com o Yury (2026-09-28):
--   • Gravação e Apresentação  → 24h antes (mesma hora) E 1h antes
--   • Reunião / tutoria / onboarding / qualquer outro → 1h antes
--   • Recebe: toda a equipe interna (admin, coordenador, designer, videomaker)
--
-- DUAS FONTES, sem duplicar:
--   1. calendario_eventos  — o que veio do Google (é onde a agência vive hoje;
--      hoje NENHUM evento está vinculado a gravação no sistema, então não dava
--      pra depender só do vínculo);
--   2. gravacoes_ocorrencias — gravações marcadas DENTRO do sistema que ainda
--      não foram empurradas pro Google (evento_id null). Com evento_id, a
--      ocorrência é ignorada aqui porque o evento já entra pela fonte 1.
--
-- COMO DISPARA: pg_cron a cada 5 minutos. Não é "lazy" como os alertas de
-- prazo do vídeo (que só rodam quando alguém abre a tela) — um lembrete de
-- 1h antes precisa sair no horário mesmo com o sistema fechado. Cada
-- notificação inserida aciona o Database Webhook → Edge Function b7-push →
-- aviso no celular.
--
-- DEDUPE: eventos_dominio.chave é UNIQUE e carrega o horário do compromisso.
-- Remarcou? O horário muda, a chave muda, o lembrete sai de novo — de
-- propósito. Cancelou no Google? status_provider vira 'cancelled' e some daqui.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. QUE TIPO DE COMPROMISSO É ESTE?
--    Inferido do título, porque o Google não tem campo de tipo. A ordem
--    das regras importa: "Tutoria de Gravação de Conteúdos" é REUNIÃO,
--    não gravação — por isso o teste de reunião vem antes do teste de
--    "contém gravação", e só o PREFIXO "Grav." ganha de tudo.
--    Acentos aparecem nas duas formas (gravaç|gravac) porque não dá pra
--    contar com unaccent instalado.
-- ---------------------------------------------------------------------
create or replace function public.agenda_tipo_compromisso(p_titulo text)
returns text language sql immutable as $$
  select case
    when coalesce(p_titulo, '') ~* '^\s*grav'                                   then 'gravacao'
    when coalesce(p_titulo, '') ~* '^\s*apr[\.\s]|apresenta|linha editorial'    then 'apresentacao'
    when coalesce(p_titulo, '') ~* 'tutoria|reuni|onboarding|alinhament|mentoria|briefing|kick.?off|\mcall\M|\mmeet\M|treinament' then 'reuniao'
    when coalesce(p_titulo, '') ~* 'grava|filmagem|captac|captaç|\mgravar\M'    then 'gravacao'
    else 'outro'
  end;
$$;

-- ---------------------------------------------------------------------
-- 1b. QUAIS AGENDAS GERAM LEMBRETE
--     Nem toda agenda ativa é da operação: a conta tem "Família" e
--     "Holidays in Brazil" ligadas pra aparecerem no calendário. Sem este
--     interruptor, um compromisso pessoal viraria push pra equipe inteira.
--     Agendas com cara de feriado/família/aniversário já nascem desligadas.
-- ---------------------------------------------------------------------
alter table public.calendario_agendas
  add column if not exists lembretes boolean not null default true;

update public.calendario_agendas
   set lembretes = false
 where nome ilike '%feriado%' or nome ilike '%holiday%'
    or nome ilike '%família%' or nome ilike '%familia%'
    or nome ilike '%aniversár%' or nome ilike '%birthday%';

create or replace function public.calendario_agenda_alternar_lembretes(p_agenda_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador mudam os lembretes das agendas.' using errcode = '42501';
  end if;
  update public.calendario_agendas set lembretes = coalesce(p_ativo, false) where id = p_agenda_id;
end;
$$;
revoke all on function public.calendario_agenda_alternar_lembretes(uuid, boolean) from public;
grant execute on function public.calendario_agenda_alternar_lembretes(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 2. VIEW UNIFICADA — tudo que está marcado, das duas fontes
-- ---------------------------------------------------------------------
drop view if exists public.agenda_compromissos;
create view public.agenda_compromissos
with (security_invoker = true) as
select
  'evento'::text            as origem,
  ev.id                     as id,
  ev.titulo                 as titulo,
  ev.inicio                 as inicio,
  ev.fim                    as fim,
  ev.dia_inteiro            as dia_inteiro,
  ev.local                  as local,
  public.agenda_tipo_compromisso(ev.titulo) as tipo,
  vi.gravacao_id            as gravacao_id,
  cl.nome                   as cliente_nome,
  g.client_id               as client_id,
  ag.nome                   as agenda_nome
from public.calendario_eventos ev
join public.calendario_agendas ag on ag.id = ev.agenda_id and ag.ativo and ag.lembretes
left join public.calendario_vinculos vi on vi.evento_id = ev.id
left join public.gravacoes g on g.id = vi.gravacao_id
left join public.clientes cl on cl.id = g.client_id
where ev.status_provider <> 'cancelled'
  and upper(btrim(coalesce(ev.titulo, ''))) <> 'CANCELLED'

union all

select
  'ocorrencia'::text, o.id, coalesce(g.nome, 'Gravação'), o.inicio, o.fim, false,
  g.local, 'gravacao'::text, o.gravacao_id, cl.nome, g.client_id, null::text
from public.gravacoes_ocorrencias o
join public.gravacoes g on g.id = o.gravacao_id and g.deleted_at is null
left join public.clientes cl on cl.id = g.client_id
where o.atual and o.status = 'marcada' and o.evento_id is null;

grant select on public.agenda_compromissos to authenticated;

-- ---------------------------------------------------------------------
-- 3. O DISPARADOR
--    Janela de 1 hora de largura em cada regra: o gatilho real é o
--    instante exato (24h ou 1h antes), a largura só absorve atraso do
--    cron. A chave única garante um aviso por compromisso por etapa.
--    Compromisso de dia inteiro não recebe o de 1h (não tem hora).
-- ---------------------------------------------------------------------
create or replace function public.agenda_verificar_lembretes()
returns integer language plpgsql security definer set search_path = public as $$
declare
  c record;
  evid uuid;
  criados integer := 0;
  etapa text;
  quando text;
  tipo_notif text;
  titulo_notif text;
  link_notif text;
begin
  for c in
    select * from public.agenda_compromissos
    where inicio > now() and inicio <= now() + interval '25 hours'
  loop
    -- ---- etapa de 24h: só gravação e apresentação ----
    if c.tipo in ('gravacao', 'apresentacao')
       and c.inicio between now() + interval '23 hours' and now() + interval '24 hours' then
      etapa := '24h';
    -- ---- etapa de 1h: todo tipo, menos dia inteiro ----
    elsif not c.dia_inteiro and c.inicio between now() and now() + interval '1 hour' then
      etapa := '1h';
    else
      continue;
    end if;

    tipo_notif := 'agenda.' || c.tipo || '_' || etapa;

    if etapa = '24h' then
      quando := case when c.dia_inteiro then 'amanhã, o dia todo'
                     else 'amanhã às ' || to_char(c.inicio at time zone 'America/Sao_Paulo', 'HH24:MI') end;
    else
      quando := 'em 1 hora, às ' || to_char(c.inicio at time zone 'America/Sao_Paulo', 'HH24:MI');
    end if;

    titulo_notif := coalesce(nullif(btrim(c.titulo), ''), 'Compromisso') || ' — ' || quando;

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
      continue;  -- já avisado
    end;

    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select evid, p.id, c.client_id, tipo_notif, titulo_notif,
           nullif(btrim(concat_ws(' · ',
             nullif(btrim(coalesce(c.cliente_nome, '')), ''),
             case when coalesce(btrim(c.local), '') <> '' then 'Local: ' || btrim(c.local) end)), ''),
           link_notif
      from public.perfis p
     where p.estado = 'ativa'
       and p.papel in ('admin', 'coordenador', 'designer', 'videomaker')
    on conflict (evento_id, destinatario_id) do nothing;

    update public.eventos_dominio set processado_em = now() where id = evid;
    criados := criados + 1;
  end loop;

  return criados;
end;
$$;
revoke all on function public.agenda_verificar_lembretes() from public;
grant execute on function public.agenda_verificar_lembretes() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. AGENDAMENTO — a cada 5 minutos
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'agenda-lembretes';
select cron.schedule('agenda-lembretes', '*/5 * * * *', $cron$select public.agenda_verificar_lembretes()$cron$);
