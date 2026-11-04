-- =====================================================================
-- CONVERSAS — o chat interno da equipe (zzz134)
--
-- Conversa direta entre duas pessoas da equipe: texto, áudio, imagem e
-- arquivo, com "enviado / entregue / lido" e aviso (sino + push) para
-- quem recebe. O modelo já aceita grupos (tipo = 'grupo'); esta versão
-- só cria conversas diretas.
--
-- Privacidade: cada pessoa só lê as conversas de que participa — nem o
-- administrador lê a conversa dos outros. O cliente do Portal não entra.
--
-- Tudo aqui é NOVO: três tabelas, um espaço privado de arquivos e as
-- regras de acesso DELAS. Nenhuma tabela, regra ou função existente é
-- alterada. Ninguém escreve direto nas tabelas: toda escrita passa pelas
-- funções abaixo, que conferem quem está chamando.
-- =====================================================================

create table if not exists public.chat_conversas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'direta' check (tipo in ('direta', 'grupo')),
  nome text,
  -- conversa direta: "menor:maior" dos dois perfis — uma só por par
  par text unique,
  criada_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  ultima_em timestamptz
);

create table if not exists public.chat_participantes (
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  entrou_em timestamptz not null default now(),
  lida_ate timestamptz not null default '1970-01-01T00:00:00Z',
  entregue_ate timestamptz not null default '1970-01-01T00:00:00Z',
  primary key (conversa_id, perfil_id)
);
create index if not exists chat_participantes_perfil on public.chat_participantes (perfil_id);

create table if not exists public.chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  tipo text not null default 'texto' check (tipo in ('texto', 'audio', 'imagem', 'arquivo')),
  texto text,
  arquivo_path text,
  arquivo_nome text,
  arquivo_mime text,
  arquivo_tamanho integer,
  duracao_s integer,
  created_at timestamptz not null default now(),
  apagada_em timestamptz
);
create index if not exists chat_mensagens_conversa on public.chat_mensagens (conversa_id, created_at desc);

-- Participo desta conversa? (security definer: a regra das tabelas
-- consulta chat_participantes sem cair em si mesma)
create or replace function public.chat_participo(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.chat_participantes
                  where conversa_id = p_conversa and perfil_id = auth.uid());
$$;
revoke all on function public.chat_participo(uuid) from public, anon;
grant execute on function public.chat_participo(uuid) to authenticated;

alter table public.chat_conversas enable row level security;
alter table public.chat_participantes enable row level security;
alter table public.chat_mensagens enable row level security;

revoke all on table public.chat_conversas, public.chat_participantes, public.chat_mensagens from anon, public;
revoke all on table public.chat_conversas, public.chat_participantes, public.chat_mensagens from authenticated;
grant select on table public.chat_conversas, public.chat_participantes, public.chat_mensagens to authenticated;

drop policy if exists chat_conversas_le on public.chat_conversas;
create policy chat_conversas_le on public.chat_conversas
  for select to authenticated using (public.chat_participo(id));
drop policy if exists chat_participantes_le on public.chat_participantes;
create policy chat_participantes_le on public.chat_participantes
  for select to authenticated using (public.chat_participo(conversa_id));
drop policy if exists chat_mensagens_le on public.chat_mensagens;
create policy chat_mensagens_le on public.chat_mensagens
  for select to authenticated using (public.chat_participo(conversa_id));

-- ---------------------------------------------------------------------
-- Abrir (ou achar) a conversa direta com outra pessoa da equipe
-- ---------------------------------------------------------------------
create or replace function public.chat_abrir_direta(p_outro uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  v_par text;
  v_id uuid;
begin
  if eu is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  if p_outro is null or p_outro = eu then raise exception 'Escolha outra pessoa.'; end if;
  if (select count(*) from public.perfis
       where id in (eu, p_outro) and estado = 'ativa' and papel <> 'cliente') <> 2 then
    raise exception 'A conversa é só entre pessoas da equipe.' using errcode = '42501';
  end if;
  v_par := least(eu::text, p_outro::text) || ':' || greatest(eu::text, p_outro::text);
  insert into public.chat_conversas (tipo, par, criada_por) values ('direta', v_par, eu)
  on conflict (par) do nothing;
  select id into v_id from public.chat_conversas where par = v_par;
  insert into public.chat_participantes (conversa_id, perfil_id) values (v_id, eu), (v_id, p_outro)
  on conflict do nothing;
  return v_id;
end
$$;
revoke all on function public.chat_abrir_direta(uuid) from public, anon;
grant execute on function public.chat_abrir_direta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Enviar uma mensagem. O aviso vai SÓ para os outros participantes: não
-- usa o caminho geral de avisos, que copiaria para administradores com
-- "receber tudo" ligado — conversa privada não sai da conversa.
-- ---------------------------------------------------------------------
create or replace function public.chat_enviar(
  p_conversa uuid, p_tipo text, p_texto text default null, p_arquivo jsonb default null)
returns public.chat_mensagens
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_msg public.chat_mensagens;
  v_nome text;
  v_previa text;
  v_dest record;
  v_ev uuid;
begin
  if eu is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  if not public.chat_participo(p_conversa) then
    raise exception 'Você não participa desta conversa.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.perfis where id = eu and estado = 'ativa' and papel <> 'cliente') then
    raise exception 'A conversa é só entre pessoas da equipe.' using errcode = '42501';
  end if;
  if coalesce(p_tipo, '') not in ('texto', 'audio', 'imagem', 'arquivo') then raise exception 'Tipo inválido.'; end if;
  if char_length(coalesce(v_texto, '')) > 4000 then raise exception 'Mensagem longa demais.'; end if;
  if p_tipo = 'texto' and v_texto is null then raise exception 'Mensagem vazia.'; end if;
  if p_tipo <> 'texto' then
    if jsonb_typeof(p_arquivo) is distinct from 'object'
       or coalesce(p_arquivo ->> 'path', '') not like p_conversa::text || '/%'
       or char_length(p_arquivo ->> 'path') > 200
       or coalesce((p_arquivo ->> 'tamanho')::integer, 0) not between 1 and 10485760 then
      raise exception 'Arquivo inválido.';
    end if;
  end if;
  -- freio simples contra disparo em série
  if (select count(*) from public.chat_mensagens
       where autor_id = eu and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'Muitas mensagens em sequência. Espere um instante.';
  end if;

  insert into public.chat_mensagens (conversa_id, autor_id, tipo, texto, arquivo_path, arquivo_nome, arquivo_mime, arquivo_tamanho, duracao_s)
  values (p_conversa, eu, p_tipo, v_texto,
          case when p_tipo <> 'texto' then p_arquivo ->> 'path' end,
          case when p_tipo <> 'texto' then left(coalesce(p_arquivo ->> 'nome', ''), 200) end,
          case when p_tipo <> 'texto' then left(coalesce(p_arquivo ->> 'mime', ''), 100) end,
          case when p_tipo <> 'texto' then (p_arquivo ->> 'tamanho')::integer end,
          case when p_tipo = 'audio' then least(greatest(coalesce((p_arquivo ->> 'duracao')::integer, 0), 0), 600) end)
  returning * into v_msg;

  update public.chat_conversas set ultima_em = v_msg.created_at where id = p_conversa;
  update public.chat_participantes set lida_ate = v_msg.created_at, entregue_ate = v_msg.created_at
   where conversa_id = p_conversa and perfil_id = eu;

  select coalesce(nullif(btrim(nome), ''), username, 'Equipe') into v_nome from public.perfis where id = eu;
  v_previa := case p_tipo
    when 'audio' then 'Mensagem de voz'
    when 'imagem' then 'Imagem' || coalesce(': ' || left(v_texto, 100), '')
    when 'arquivo' then 'Arquivo: ' || left(coalesce(p_arquivo ->> 'nome', 'sem nome'), 80)
    else left(v_texto, 140) end;

  for v_dest in
    select p.id from public.chat_participantes cp join public.perfis p on p.id = cp.perfil_id
     where cp.conversa_id = p_conversa and cp.perfil_id <> eu and p.estado = 'ativa' and p.papel <> 'cliente'
  loop
    -- várias mensagens seguidas viram um aviso só a cada 20 s (o contador da conversa mostra todas)
    if exists (select 1 from public.notificacoes n
                where n.destinatario_id = v_dest.id and n.tipo = 'chat.mensagem' and n.lida_em is null
                  and n.dados ->> 'conversa' = p_conversa::text and n.created_at > now() - interval '20 seconds') then
      continue;
    end if;
    -- o registro do evento não guarda o texto da mensagem
    insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, ator_id, ator_nome, payload, processado_em)
    values ('chat.mensagem', 'chat:' || v_msg.id::text || ':' || v_dest.id::text, 'chat', p_conversa, eu, v_nome,
            jsonb_build_object('conversa', p_conversa), now())
    returning id into v_ev;
    insert into public.notificacoes (evento_id, destinatario_id, tipo, titulo, mensagem, link, dados)
    values (v_ev, v_dest.id, 'chat.mensagem', v_nome, v_previa, '#/conversa/' || p_conversa::text,
            jsonb_build_object('conversa', p_conversa, 'chat', true));
  end loop;

  return v_msg;
end
$$;
revoke all on function public.chat_enviar(uuid, text, text, jsonb) from public, anon;
grant execute on function public.chat_enviar(uuid, text, text, jsonb) to authenticated;

-- Li esta conversa (também marca como lidos os avisos dela)
create or replace function public.chat_marcar_lida(p_conversa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sessão necessária.' using errcode = '42501'; end if;
  update public.chat_participantes set lida_ate = now(), entregue_ate = now()
   where conversa_id = p_conversa and perfil_id = auth.uid();
  update public.notificacoes set lida_em = now()
   where destinatario_id = auth.uid() and tipo = 'chat.mensagem' and lida_em is null
     and dados ->> 'conversa' = p_conversa::text;
end
$$;
revoke all on function public.chat_marcar_lida(uuid) from public, anon;
grant execute on function public.chat_marcar_lida(uuid) to authenticated;

-- As mensagens chegaram a este aparelho (o segundo tique)
create or replace function public.chat_marcar_entregue()
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_participantes cp set entregue_ate = now()
    from public.chat_conversas c
   where c.id = cp.conversa_id and cp.perfil_id = auth.uid()
     and c.ultima_em is not null and c.ultima_em > cp.entregue_ate;
$$;
revoke all on function public.chat_marcar_entregue() from public, anon;
grant execute on function public.chat_marcar_entregue() to authenticated;

-- Apagar a PRÓPRIA mensagem: o texto some e fica "mensagem apagada".
-- Devolve o caminho do arquivo, para a tela remover do espaço de arquivos.
create or replace function public.chat_apagar(p_mensagem uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_path text;
begin
  select arquivo_path into v_path from public.chat_mensagens
   where id = p_mensagem and autor_id = auth.uid() and apagada_em is null;
  if not found then raise exception 'Só dá para apagar a própria mensagem.' using errcode = '42501'; end if;
  update public.chat_mensagens
     set apagada_em = now(), texto = null, arquivo_path = null, arquivo_nome = null, arquivo_mime = null,
         arquivo_tamanho = null, duracao_s = null
   where id = p_mensagem;
  return v_path;
end
$$;
revoke all on function public.chat_apagar(uuid) from public, anon;
grant execute on function public.chat_apagar(uuid) to authenticated;

-- A lista de conversas de quem chama: com quem é, a última mensagem,
-- quantas não li e até onde a outra pessoa recebeu e leu.
create or replace function public.chat_lista()
returns table (conversa_id uuid, outro_id uuid, ultima_em timestamptz, ultima jsonb,
               nao_lidas integer, outro_lida_ate timestamptz, outro_entregue_ate timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, o.perfil_id, c.ultima_em,
         (select to_jsonb(x) from (
            select m.id, m.tipo, case when m.apagada_em is null then left(m.texto, 140) end as texto,
                   m.autor_id, m.created_at, (m.apagada_em is not null) as apagada, m.arquivo_nome
              from public.chat_mensagens m where m.conversa_id = c.id
             order by m.created_at desc limit 1) x),
         (select count(*)::integer from public.chat_mensagens m
           where m.conversa_id = c.id and m.autor_id is distinct from eu.perfil_id
             and m.created_at > eu.lida_ate and m.apagada_em is null),
         o.lida_ate, o.entregue_ate
    from public.chat_participantes eu
    join public.chat_conversas c on c.id = eu.conversa_id and c.tipo = 'direta'
    join public.chat_participantes o on o.conversa_id = c.id and o.perfil_id <> eu.perfil_id
   where eu.perfil_id = auth.uid();
$$;
revoke all on function public.chat_lista() from public, anon;
grant execute on function public.chat_lista() to authenticated;

-- ---------------------------------------------------------------------
-- Arquivos (áudio, imagem, anexo): espaço privado, uma pasta por conversa
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-arquivos', 'chat-arquivos', false, 10485760)
on conflict (id) do nothing;

create or replace function public.chat_pode_arquivo(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.chat_participo(((storage.foldername(p_nome))[1])::uuid);
exception when others then
  return false;
end
$$;
revoke all on function public.chat_pode_arquivo(text) from public, anon;
grant execute on function public.chat_pode_arquivo(text) to authenticated;

drop policy if exists "chat-arquivos select" on storage.objects;
create policy "chat-arquivos select" on storage.objects
  for select to authenticated using (bucket_id = 'chat-arquivos' and public.chat_pode_arquivo(name));
drop policy if exists "chat-arquivos insert" on storage.objects;
create policy "chat-arquivos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'chat-arquivos' and public.chat_pode_arquivo(name));
drop policy if exists "chat-arquivos delete" on storage.objects;
create policy "chat-arquivos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'chat-arquivos' and owner_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Tempo real: mensagem nova e tiques chegam na hora (respeitando as
-- regras de leitura acima)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_mensagens') then
    alter publication supabase_realtime add table public.chat_mensagens;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_participantes') then
    alter publication supabase_realtime add table public.chat_participantes;
  end if;
end $$;
