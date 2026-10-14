-- =====================================================================
-- WHATSAPP NO SISTEMA (zzz170)
--
-- • clientes.whatsapp_grupo: nome do grupo do cliente no WhatsApp, como
--   aparece lá (o programa de Windows procura o grupo por esse nome).
-- • whatsapp_envios: o que foi mandado ao cliente pelo botão "Enviar ao
--   cliente" (quem, quando, o quê). Só a equipe interna lê e grava.
-- • whatsapp_registrar_envio(): grava o envio e, se for uma versão de
--   vídeo, também põe no histórico da demanda.
-- Só acrescenta; nada é apagado.
-- =====================================================================
alter table public.clientes add column if not exists whatsapp_grupo text not null default '';

create or replace view public.clientes_resumo with (security_invoker = on) as
 SELECT id, nome, observacoes, logo_url, logo_path, is_pinned, deleted_at, created_at, updated_at,
    ( SELECT count(*) AS count FROM gravacoes g
       WHERE g.client_id = c.id AND g.deleted_at IS NULL AND g.archived_at IS NULL) AS total_gravacoes,
    ( SELECT count(*) AS count FROM roteiros r JOIN gravacoes g2 ON g2.id = r.recording_session_id
       WHERE g2.client_id = c.id AND r.deleted_at IS NULL AND g2.deleted_at IS NULL) AS total_roteiros,
    GREATEST(updated_at, COALESCE(( SELECT max(g3.updated_at) AS max FROM gravacoes g3
       WHERE g3.client_id = c.id), updated_at)) AS ultima_atividade,
    teste, modo, whatsapp_grupo
   FROM clientes c;

create table if not exists public.whatsapp_envios (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references public.clientes(id) on delete set null,
  tipo        text not null check (tipo in ('video', 'gravacao', 'outro')),
  ref_id      uuid,
  grupo       text not null default '',
  arquivo     text not null default '',
  texto       text not null default '',
  por         uuid references public.perfis(id) default auth.uid(),
  por_nome    text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists whatsapp_envios_ref on public.whatsapp_envios (ref_id, created_at desc);
alter table public.whatsapp_envios enable row level security;
create policy whatsapp_envios_ler on public.whatsapp_envios for select to authenticated using (public.sou_equipe_interna());

create or replace function public.whatsapp_registrar_envio(p_tipo text, p_ref_id uuid, p_cliente_id uuid,
  p_grupo text, p_arquivo text, p_texto text, p_demanda_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_nome text;
begin
  if not public.sou_equipe_interna() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_tipo not in ('video', 'gravacao', 'outro') then raise exception 'Tipo inválido.'; end if;
  select coalesce(nullif(nome, ''), username, '') into v_nome from perfis where id = auth.uid();
  insert into whatsapp_envios (cliente_id, tipo, ref_id, grupo, arquivo, texto, por, por_nome)
  values (p_cliente_id, p_tipo, p_ref_id, left(coalesce(p_grupo, ''), 200), left(coalesce(p_arquivo, ''), 300),
          left(coalesce(p_texto, ''), 4000), auth.uid(), coalesce(v_nome, ''))
  returning id into v_id;
  if p_demanda_id is not null then
    insert into demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, mensagem)
    values (p_demanda_id, 'whatsapp', auth.uid(), coalesce(v_nome, ''),
            'Enviado ao cliente pelo WhatsApp' || case when coalesce(p_grupo, '') <> '' then ' (grupo ' || p_grupo || ')' else '' end ||
            case when coalesce(p_arquivo, '') <> '' then ' — ' || p_arquivo else '' end);
  end if;
  return v_id;
end $$;
revoke all on function public.whatsapp_registrar_envio(text, uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.whatsapp_registrar_envio(text, uuid, uuid, text, text, text, uuid) to authenticated;
