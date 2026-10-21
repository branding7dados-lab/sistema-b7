-- =====================================================================
-- zzz218: VERIFICAÇÃO EM 2 ETAPAS
--
-- Quem liga, depois da senha precisa de um código de 6 números: por
-- e-mail (cadastrado e confirmado pela própria pessoa) ou do app
-- autenticador (Google Authenticator, Authy, Microsoft Authenticator).
--
-- Tudo passa pela função b7-auth (chave de serviço). Estas tabelas não
-- têm política nenhuma: ninguém lê nem grava direto pelo navegador.
-- Os códigos são guardados só como hash; o segredo do app autenticador
-- fica aqui (precisa dele para conferir o código).
-- =====================================================================

create table if not exists public.seguranca_2fa (
  perfil_id uuid primary key,
  metodo text check (metodo in ('email', 'app')),
  email text,
  totp_segredo text,
  totp_pendente text,
  ligado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.seguranca_2fa enable row level security;

create table if not exists public.seguranca_codigos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  finalidade text not null check (finalidade in ('login', 'cadastro_email')),
  metodo text,
  codigo_hash text,
  email text,
  refresh_token text,
  tentativas int not null default 0,
  envios int not null default 1,
  usado boolean not null default false,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists seguranca_codigos_perfil on public.seguranca_codigos (perfil_id, created_at desc);
alter table public.seguranca_codigos enable row level security;

create table if not exists public.seguranca_aparelhos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null,
  token_hash text not null,
  descricao text,
  expira_em timestamptz not null,
  revogado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists seguranca_aparelhos_perfil on public.seguranca_aparelhos (perfil_id);
alter table public.seguranca_aparelhos enable row level security;

-- política da equipe (Meu perfil → Segurança, só administrador muda):
-- sistema_config chave 'seguranca' → {"exigir_2fa": "ninguem" | "gestao" | "todos"}

-- perguntas frequentes do Suporte sobre o assunto (aplicado)
insert into public.suporte_faq (pergunta, resposta, termos, tutorial_id, ordem)
select v.* from (values
 ('Como ligo a verificação em 2 etapas?', 'Clique na sua foto no topo → "Meu perfil" → aba "Segurança" → "Verificação em 2 etapas". Escolha "Código por e-mail" (cadastra e confirma o seu e-mail) ou "App autenticador" (lê o QR Code com o Google Authenticator, Authy ou Microsoft Authenticator). Depois disso, ao entrar com usuário e senha, o sistema pede também um código de 6 números. Marque "Confiar neste aparelho por 30 dias" para não precisar do código toda vez.', 'verificação duas etapas 2 etapas 2fa dois fatores código segurança autenticador proteger conta', 'meu-perfil', 15),
 ('Perdi o celular ou não recebo o código. Como entro?', 'Se o código é por e-mail, toque em "Reenviar código" e confira a caixa de spam. Se perdeu o celular do app autenticador, peça ao administrador: em Usuários e acessos → ⋯ → "Desligar verificação em 2 etapas". Você entra só com a senha e liga de novo em Meu perfil → Segurança.', 'perdi celular código não chega não recebo verificação 2 etapas autenticador trocar celular', 'meu-perfil', 25),
 ('Como entro com a minha conta Google?', 'Primeiro vincule: Meu perfil → aba "Segurança" → "Entrar com Google" → "Vincular conta Google". Depois, na tela de entrada, use "Entrar com Google". Funciona no navegador (não dentro do programa de Windows nem do app de Android). Se o cartão não aparecer, o Google ainda não foi ligado pela administração.', 'google gmail entrar com google vincular conta login', 'meu-perfil', 26)
) as v(pergunta, resposta, termos, tutorial_id, ordem)
where not exists (select 1 from public.suporte_faq f where f.pergunta = v.pergunta);
