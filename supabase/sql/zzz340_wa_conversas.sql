-- zzz340 — Central de Conversas B7 (WhatsApp pelo Evolution API)
-- Conversas e mensagens guardadas no B7. Quem escreve é só o servidor
-- (Edge Functions wa-entrada / wa-evolution, com a service role); quem lê
-- é quem pode ver o WhatsApp: administrador e videomakers (decisão do Kevin,
-- 16/11/2026). Mídia num bucket privado (wa-midia).

create or replace function public.pode_ver_wa()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.sou_admin(), false) or coalesce(public.eh_videomaker_elegivel(auth.uid()), false) $$;
grant execute on function public.pode_ver_wa() to authenticated;

create table if not exists public.wa_conversas (
  jid text primary key,                         -- 5562...@s.whatsapp.net ou ...@g.us
  tipo text not null default 'contato' check (tipo in ('contato', 'grupo')),
  nome text,
  foto_url text,
  cliente_id uuid references public.clientes(id) on delete set null,
  ultima_em timestamptz,
  previa text,
  previa_autor text,
  previa_de_mim boolean not null default false,
  nao_lidas integer not null default 0,
  esperando_desde timestamptz,                  -- cliente mandou e ninguém respondeu ainda
  arquivada boolean not null default false,
  fixada boolean not null default false,
  responsavel_id uuid references public.perfis(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index if not exists wa_conversas_ultima_idx on public.wa_conversas (ultima_em desc nulls last);
create index if not exists wa_conversas_cliente_idx on public.wa_conversas (cliente_id);

create table if not exists public.wa_mensagens (
  id text primary key,                          -- key.id do WhatsApp
  jid text not null references public.wa_conversas(jid) on delete cascade,
  de_mim boolean not null default false,
  autor_jid text,
  autor_nome text,
  tipo text not null default 'texto',           -- texto, imagem, video, audio, documento, figurinha, localizacao, contato, enquete, outro
  texto text,
  midia_path text,                              -- caminho no bucket wa-midia (baixada sob demanda)
  midia_mime text,
  midia_nome text,
  midia_tamanho bigint,
  duracao integer,
  miniatura text,                               -- jpeg pequeno em base64 (prévia de foto/vídeo)
  citada_id text,
  citada_previa text,
  citada_autor text,
  status text,                                  -- PENDING, SERVER_ACK, DELIVERY_ACK, READ, PLAYED
  enviada_por uuid references public.perfis(id) on delete set null,
  enviada_por_nome text,
  reacoes jsonb not null default '{}'::jsonb,   -- { "👍": ["jid", ...] }
  apagada boolean not null default false,
  editada boolean not null default false,
  nota boolean not null default false,          -- nota interna (só a equipe vê; não vai ao WhatsApp)
  criada_em timestamptz not null default now()
);
create index if not exists wa_mensagens_conversa_idx on public.wa_mensagens (jid, criada_em desc);

alter table public.wa_conversas enable row level security;
alter table public.wa_mensagens enable row level security;
drop policy if exists wa_conversas_ler on public.wa_conversas;
create policy wa_conversas_ler on public.wa_conversas for select to authenticated using (public.pode_ver_wa());
drop policy if exists wa_mensagens_ler on public.wa_mensagens;
create policy wa_mensagens_ler on public.wa_mensagens for select to authenticated using (public.pode_ver_wa());
revoke insert, update, delete on public.wa_conversas, public.wa_mensagens from anon, authenticated;
grant select on public.wa_conversas, public.wa_mensagens to authenticated;

-- ações locais (sem falar com o WhatsApp): marcar como lida, arquivar, fixar, cliente, responsável, nota interna
create or replace function public.wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.pode_ver_wa() then raise exception 'Sem acesso às conversas.' using errcode = '42501'; end if;
  if p_campo = 'lida' then update public.wa_conversas set nao_lidas = 0 where jid = p_jid;
  elsif p_campo = 'arquivada' then update public.wa_conversas set arquivada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'fixada' then update public.wa_conversas set fixada = coalesce(p_valor, 'true')::boolean where jid = p_jid;
  elsif p_campo = 'cliente' then update public.wa_conversas set cliente_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'responsavel' then update public.wa_conversas set responsavel_id = nullif(p_valor, '')::uuid where jid = p_jid;
  elsif p_campo = 'sem_espera' then update public.wa_conversas set esperando_desde = null where jid = p_jid;
  else raise exception 'Campo inválido.';
  end if;
end $$;
grant execute on function public.wa_conversa_marcar(text, text, text) to authenticated;

create or replace function public.wa_nota_interna(p_jid text, p_texto text)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_id text := 'nota_' || replace(gen_random_uuid()::text, '-', ''); v_nome text;
begin
  if not public.pode_ver_wa() then raise exception 'Sem acesso às conversas.' using errcode = '42501'; end if;
  if coalesce(btrim(p_texto), '') = '' then raise exception 'Escreva a nota.'; end if;
  select coalesce(nullif(btrim(nome), ''), username) into v_nome from public.perfis where id = auth.uid();
  insert into public.wa_mensagens (id, jid, de_mim, tipo, texto, nota, enviada_por, enviada_por_nome, criada_em)
  values (v_id, p_jid, true, 'texto', left(p_texto, 4000), true, auth.uid(), v_nome, now());
  return v_id;
end $$;
grant execute on function public.wa_nota_interna(text, text) to authenticated;

-- tempo real
do $$ begin
  begin alter publication supabase_realtime add table public.wa_conversas; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wa_mensagens; exception when others then null; end;
end $$;

-- mídia: bucket privado; quem pode ver o WhatsApp lê e sobe (para enviar)
insert into storage.buckets (id, name, public, file_size_limit)
values ('wa-midia', 'wa-midia', false, 104857600)
on conflict (id) do nothing;
drop policy if exists wa_midia_ler on storage.objects;
create policy wa_midia_ler on storage.objects for select to authenticated using (bucket_id = 'wa-midia' and public.pode_ver_wa());
drop policy if exists wa_midia_subir on storage.objects;
create policy wa_midia_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'wa-midia' and public.pode_ver_wa() and (storage.foldername(name))[1] = 'envio');
