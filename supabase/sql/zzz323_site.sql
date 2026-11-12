-- 4.36.0 — SITE INSTITUCIONAL (branding7.com.br)
-- O conteúdo do site mora aqui e é editado no sistema (tela "Site"):
--   site_config  textos da página, WhatsApp, Instagram, regiões, números
--   site_itens   vídeos de portfólio, depoimentos, serviços e clientes
--   site_leads   quem preencheu o formulário (chega aviso para a administração)
-- O site lê só o que está publicado, sem login (chave pública).
create table if not exists public.site_config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id) on delete set null
);
insert into public.site_config (id, dados) values (1, jsonb_build_object(
  'whatsapp', '5577981223827',
  'whatsapp_nome', 'Gabriel Martins',
  'whatsapp_cargo', 'Gestor comercial',
  'whatsapp_msg', 'Olá, Gabriel! Vim pelo site da Branding7 e quero saber mais sobre os vídeos.',
  'instagram', '',
  'email', '',
  'titulo', 'O vídeo que faz você vender.',
  'subtitulo', 'Criativos em vídeo que viralizam, performam e trazem cliente. Do roteiro à edição, a Branding7 cuida de tudo.',
  'regioes', jsonb_build_array(),
  'numeros', jsonb_build_array()
)) on conflict (id) do nothing;

create table if not exists public.site_itens (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('video','depoimento','servico','cliente')),
  titulo text check (char_length(titulo) <= 140),
  texto text check (char_length(texto) <= 800),
  cliente_nome text check (char_length(cliente_nome) <= 120),
  cliente_arroba text check (char_length(cliente_arroba) <= 60),
  categoria text check (char_length(categoria) <= 60),
  video_url text check (char_length(video_url) <= 600),
  capa_url text check (char_length(capa_url) <= 600),
  link text check (char_length(link) <= 600),
  icone text check (char_length(icone) <= 40),
  destaque boolean not null default false,
  ordem int not null default 0,
  publicado boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.perfis(id) on delete set null
);
create index if not exists site_itens_tipo on public.site_itens (tipo, ordem) where publicado;

create table if not exists public.site_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  whatsapp text not null check (char_length(whatsapp) between 8 and 30),
  empresa text check (char_length(empresa) <= 120),
  cidade text check (char_length(cidade) <= 120),
  interesse text check (char_length(interesse) <= 120),
  mensagem text check (char_length(mensagem) <= 1000),
  origem jsonb not null default '{}'::jsonb,
  status text not null default 'novo' check (status in ('novo','em_contato','virou_cliente','descartado')),
  notas text check (char_length(notas) <= 1000),
  created_at timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists site_leads_data on public.site_leads (created_at desc);

alter table public.site_config enable row level security;
alter table public.site_itens enable row level security;
alter table public.site_leads enable row level security;

-- leitura pública: config e o que está publicado
create policy site_config_publico on public.site_config for select to anon, authenticated using (true);
create policy site_itens_publico on public.site_itens for select to anon, authenticated using (publicado or public.sou_admin());
-- escrita: administração
create policy site_config_admin on public.site_config for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy site_itens_admin_ins on public.site_itens for insert to authenticated with check (public.sou_admin());
create policy site_itens_admin_upd on public.site_itens for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy site_itens_admin_del on public.site_itens for delete to authenticated using (public.sou_admin());
-- contatos: só a administração vê e cuida
create policy site_leads_admin_le on public.site_leads for select to authenticated using (public.sou_admin());
create policy site_leads_admin_upd on public.site_leads for update to authenticated using (public.sou_admin()) with check (public.sou_admin());

-- o formulário do site manda por aqui (sem login); trava repetição
create or replace function public.site_lead_enviar(p_nome text, p_whatsapp text, p_empresa text default null, p_cidade text default null,
  p_interesse text default null, p_mensagem text default null, p_origem jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_tel text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'); v_id uuid; a record; msg text;
begin
  if char_length(trim(coalesce(p_nome, ''))) < 2 or char_length(v_tel) < 10 then raise exception 'Preencha o nome e um WhatsApp com DDD.'; end if;
  if exists (select 1 from public.site_leads where regexp_replace(whatsapp, '\D', '', 'g') = v_tel and created_at > now() - interval '10 minutes') then return true; end if;
  if (select count(*) from public.site_leads where created_at > now() - interval '1 minute') > 20 then raise exception 'Muitos envios agora. Tente em um minuto.'; end if;
  insert into public.site_leads (nome, whatsapp, empresa, cidade, interesse, mensagem, origem)
  values (left(trim(p_nome), 120), left(trim(p_whatsapp), 30), left(nullif(trim(p_empresa), ''), 120), left(nullif(trim(p_cidade), ''), 120),
          left(nullif(trim(p_interesse), ''), 120), left(nullif(trim(p_mensagem), ''), 1000), coalesce(p_origem, '{}'::jsonb) - 'ip')
  returning id into v_id;
  msg := left(trim(p_nome), 60) || coalesce(' · ' || nullif(trim(p_cidade), ''), '') || coalesce(' · ' || nullif(trim(p_interesse), ''), '');
  for a in select id from public.perfis where eh_admin and estado = 'ativa' loop
    perform public._acesso_notificar(a.id, 'site.lead', 'Novo contato pelo site', msg, '#/site?aba=contatos', v_id, jsonb_build_object('lead_id', v_id));
  end loop;
  return true;
end $$;
revoke execute on function public.site_lead_enviar(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.site_lead_enviar(text, text, text, text, text, text, jsonb) to anon, authenticated;

-- arquivos do site (vídeos e capas): público para ler, administração sobe
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 52428800, array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy site_arquivos_admin_ins on storage.objects for insert to authenticated with check (bucket_id = 'site' and public.sou_admin());
create policy site_arquivos_admin_upd on storage.objects for update to authenticated using (bucket_id = 'site' and public.sou_admin());
create policy site_arquivos_admin_del on storage.objects for delete to authenticated using (bucket_id = 'site' and public.sou_admin());
