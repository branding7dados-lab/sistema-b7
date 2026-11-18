-- 4.81.0: Configurações do WhatsApp (tela #/whatsapp/config)
-- Uma linha só (id = 1) com o que é da equipe toda: respostas rápidas, arquivar paradas, fotos automáticas.
create table if not exists public.wa_config (
  id int primary key default 1 check (id = 1),
  respostas jsonb not null default '[]'::jsonb,      -- [{atalho, titulo, texto}]
  auto_arquivar_dias int not null default 0,         -- 0 = nunca
  fotos_auto boolean not null default true,          -- foto abre sozinha ao entrar na conversa
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
insert into public.wa_config (id, respostas) values (1, '[
  {"atalho":"ok","titulo":"Recebido","texto":"Recebido, {cliente}! Já estamos vendo aqui e te damos retorno ainda hoje 👍"},
  {"atalho":"aprova","titulo":"Pedir aprovação","texto":"Oi, {cliente}! Conseguiu dar uma olhada no material? Se estiver tudo certo, é só responder \"aprovado\" por aqui 😉"},
  {"atalho":"material","titulo":"Pedir material","texto":"Oi, {cliente}! Para seguirmos, precisamos do material. Pode mandar por aqui ou pelo Drive?"}
]'::jsonb) on conflict (id) do nothing;
alter table public.wa_config enable row level security;
drop policy if exists wa_config_ler on public.wa_config;
create policy wa_config_ler on public.wa_config for select to authenticated using (public.pode_ver_wa());
drop policy if exists wa_config_mudar on public.wa_config;
create policy wa_config_mudar on public.wa_config for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, update on public.wa_config to authenticated;

-- arquivada pelo B7 (conversa parada): volta para a lista quando chega mensagem nova
alter table public.wa_conversas add column if not exists arquivada_auto boolean not null default false;
