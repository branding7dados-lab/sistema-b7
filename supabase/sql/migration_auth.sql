-- =====================================================================
-- AUTENTICAÇÃO, PERFIS E ISOLAMENTO — FASE 1
--
-- Aditiva. Não recria tabela, não apaga dado, não tranca ninguém do lado
-- de fora: as políticas antigas continuam valendo até a migration de
-- corte (migration_auth_rls.sql), que só deve rodar depois de existir um
-- Admin funcionando.
--
-- Por que username e não e-mail: o Supabase Auth identifica por e-mail ou
-- telefone. Como o cliente não terá e-mail cadastrado, cada usuário ganha
-- uma identidade técnica interna no formato <uuid>@b7.local, gerada pelo
-- backend, nunca exibida e nunca usada para enviar mensagem. O username
-- público vive aqui, em perfis.username.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERFIS
-- Espelho público da identidade. A senha vive só no auth.users do
-- Supabase, com o hash dele — nada de tabela caseira de senha.
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key,                       -- = auth.users.id
  username text not null,
  nome text not null,
  papel text not null default 'cliente',     -- admin | coordenador | cliente

  /* estado técnico da conta, separado do estado comercial da empresa */
  estado text not null default 'ativa',      -- ativa | desativada | removida

  /* dentro do perfil cliente: quem pode aprovar oficialmente */
  pode_aprovar boolean default false,

  ultimo_acesso timestamptz,
  criado_por uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

/* username é único ignorando maiúsculas: "Yury" e "yury" são o mesmo
   login, e permitir os dois convidaria a confusão de identidade */
create unique index if not exists perfis_username_unico
  on public.perfis (lower(username));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_papel_valido') then
    alter table public.perfis add constraint perfis_papel_valido
      check (papel in ('admin', 'coordenador', 'cliente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfis_estado_valido') then
    alter table public.perfis add constraint perfis_estado_valido
      check (estado in ('ativa', 'desativada', 'removida'));
  end if;
  /* username sem espaço nem arroba: não é e-mail e não deve parecer um */
  if not exists (select 1 from pg_constraint where conname = 'perfis_username_formato') then
    alter table public.perfis add constraint perfis_username_formato
      check (username ~ '^[a-zA-Z0-9._-]{3,32}$');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. VÍNCULO USUÁRIO ↔ EMPRESA
-- Muitos-para-muitos de propósito: uma empresa pode ter vários usuários
-- e uma pessoa pode acompanhar mais de uma empresa.
-- ---------------------------------------------------------------------
create table if not exists public.perfil_clientes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  client_id uuid not null references public.clientes(id) on delete cascade,
  created_at timestamptz default now()
);
create unique index if not exists perfil_clientes_unico
  on public.perfil_clientes (perfil_id, client_id);
create index if not exists perfil_clientes_cliente
  on public.perfil_clientes (client_id);

-- ---------------------------------------------------------------------
-- 3. ESTADO COMERCIAL DO SERVIÇO
-- Fica na empresa, não no usuário: pausar o serviço não apaga ninguém.
-- ---------------------------------------------------------------------
alter table public.clientes add column if not exists servico text default 'ativo';
alter table public.clientes add column if not exists servico_desde timestamptz;
alter table public.clientes add column if not exists servico_nota_interna text;
alter table public.clientes add column if not exists servico_mensagem text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_servico_valido') then
    alter table public.clientes add constraint clientes_servico_valido
      check (servico in ('ativo', 'pausado', 'cancelado'));
  end if;
end $$;

/* histórico auditável de pausa, cancelamento e reativação */
create table if not exists public.servico_historico (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  de text, para text,
  nota_interna text,
  mensagem_publica text,
  autor_id uuid,
  created_at timestamptz default now()
);
create index if not exists servico_historico_cliente
  on public.servico_historico (client_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. AUDITORIA DE AÇÕES SENSÍVEIS
-- Nunca registra senha, hash ou token.
-- ---------------------------------------------------------------------
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid,
  autor_username text,
  acao text not null,                       -- criar_usuario | redefinir_senha | ...
  alvo_tipo text,
  alvo_id uuid,
  alvo_descricao text,
  detalhe jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists auditoria_data on public.auditoria (created_at desc);

-- ---------------------------------------------------------------------
-- 5. FUNÇÕES DE AUTORIZAÇÃO
--
-- São SECURITY DEFINER porque precisam ler public.perfis mesmo quando a
-- política que as chama está restringindo o acesso a essa tabela. O
-- search_path é fixado para não haver sequestro de resolução de nome.
-- ---------------------------------------------------------------------
create or replace function public.meu_papel()
returns text
language sql stable security definer set search_path = public
as $$
  select p.papel from public.perfis p
   where p.id = auth.uid() and p.estado = 'ativa'
$$;

create or replace function public.sou_equipe()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.meu_papel() in ('admin', 'coordenador'), false)
$$;

create or replace function public.sou_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.meu_papel() = 'admin', false)
$$;

/* Um cliente só enxerga empresa à qual está vinculado E cujo serviço não
   esteja bloqueado. A equipe enxerga todas. Serviço pausado ou cancelado
   corta o acesso no banco, não só na tela. */
create or replace function public.posso_ver_cliente(alvo uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when public.sou_equipe() then true
    else exists (
      select 1
        from public.perfil_clientes pc
        join public.clientes c on c.id = pc.client_id
       where pc.perfil_id = auth.uid()
         and pc.client_id = alvo
         and coalesce(c.servico, 'ativo') = 'ativo'
    )
  end
$$;

revoke all on function public.meu_papel() from public;
revoke all on function public.sou_equipe() from public;
revoke all on function public.sou_admin() from public;
revoke all on function public.posso_ver_cliente(uuid) from public;
grant execute on function public.meu_papel() to authenticated;
grant execute on function public.sou_equipe() to authenticated;
grant execute on function public.sou_admin() to authenticated;
grant execute on function public.posso_ver_cliente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RESOLUÇÃO DE USERNAME (usada só pelo backend)
--
-- Traduz username em identidade técnica. NÃO recebe grant para anon nem
-- authenticated: se o frontend pudesse chamá-la, qualquer visitante
-- descobriria quais usernames existem. Quem chama é a Edge Function de
-- login, com service role.
-- ---------------------------------------------------------------------
create or replace function public.resolver_login(p_username text)
returns table (perfil_id uuid, estado text, papel text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.estado, p.papel
    from public.perfis p
   where lower(p.username) = lower(p_username)
$$;
revoke all on function public.resolver_login(text) from public, anon, authenticated;

-- --------------------------------------------------------- updated_at
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'perfis_updated') then
      create trigger perfis_updated before update on public.perfis
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.perfis            enable row level security;
alter table public.perfil_clientes   enable row level security;
alter table public.servico_historico enable row level security;
alter table public.auditoria         enable row level security;

do $$
begin
  /* Cada um lê o próprio perfil; a equipe lê todos. Ninguém escreve pelo
     cliente: criar usuário e trocar papel são operações server-side. */
  drop policy if exists perfis_leitura on public.perfis;
  create policy perfis_leitura on public.perfis for select
    to authenticated using (id = auth.uid() or public.sou_equipe());

  drop policy if exists perfil_clientes_leitura on public.perfil_clientes;
  create policy perfil_clientes_leitura on public.perfil_clientes for select
    to authenticated using (perfil_id = auth.uid() or public.sou_equipe());

  drop policy if exists servico_historico_leitura on public.servico_historico;
  create policy servico_historico_leitura on public.servico_historico for select
    to authenticated using (public.sou_equipe());

  /* auditoria: só o Admin lê, ninguém edita pelo cliente */
  drop policy if exists auditoria_leitura on public.auditoria;
  create policy auditoria_leitura on public.auditoria for select
    to authenticated using (public.sou_admin());
end $$;

grant select on public.perfis, public.perfil_clientes to authenticated;
grant select on public.servico_historico, public.auditoria to authenticated;
/* nenhum grant de insert/update/delete: essas operações passam pelo
   backend com service role e são auditadas lá */

-- ---------------------------------------------------------------- view
/* O que o frontend precisa saber sobre a própria sessão, sem expor a
   identidade técnica nem dados de outros usuários. */
alter table public.perfis add column if not exists avatar_url text;
drop view if exists public.minha_sessao;
create view public.minha_sessao
with (security_invoker = true) as
select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
       (select coalesce(json_agg(json_build_object(
                 'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
                 'servico', coalesce(c.servico, 'ativo'),
                 'mensagem', c.servico_mensagem)), '[]'::json)
          from public.perfil_clientes pc
          join public.clientes c on c.id = pc.client_id
         where pc.perfil_id = p.id) as empresas
from public.perfis p
where p.id = auth.uid();

grant select on public.minha_sessao to authenticated;
