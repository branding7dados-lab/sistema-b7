-- =====================================================================
-- PORTAL DO CLIENTE — aprovações, comentários e foto de perfil
--
-- Aditiva. Não recria tabela, não apaga dado, não altera texto canônico.
--
-- Ideia central: o material continua onde sempre esteve (roteiros, cenas,
-- conteúdos, linhas editoriais). O que nasce aqui é a camada de
-- aprovação: o que foi ENVIADO, em qual VERSÃO, e o que o cliente
-- DECIDIU sobre aquilo. Autosave e envio são coisas diferentes — salvar
-- um roteiro não cria versão nenhuma.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENVIOS PARA APROVAÇÃO
--
-- Cada envio é uma versão estável. O snapshot guarda o material como ele
-- estava naquele instante: sem isso, editar depois mudaria em silêncio o
-- que o cliente aprovou.
-- ---------------------------------------------------------------------
create table if not exists public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,

  /* que material é este: 'roteiro' | 'linha' | 'conteudo' | 'semana' */
  tipo text not null,
  alvo_id uuid not null,              /* id do registro canônico */

  versao int not null default 1,
  snapshot jsonb not null default '{}'::jsonb,

  /* pendente | aprovado | ajustes | cancelado */
  situacao text not null default 'pendente',

  enviado_por uuid,
  enviado_em timestamptz default now(),
  decidido_por uuid,
  decidido_em timestamptz,

  observacao_envio text,              /* o que a equipe quis destacar */
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aprovacoes_tipo_valido') then
    alter table public.aprovacoes add constraint aprovacoes_tipo_valido
      check (tipo in ('roteiro', 'linha', 'conteudo', 'semana'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'aprovacoes_situacao_valida') then
    alter table public.aprovacoes add constraint aprovacoes_situacao_valida
      check (situacao in ('pendente', 'aprovado', 'ajustes', 'cancelado'));
  end if;
end $$;

create index if not exists aprovacoes_cliente
  on public.aprovacoes (client_id, situacao, enviado_em desc);
create index if not exists aprovacoes_alvo
  on public.aprovacoes (tipo, alvo_id, versao desc);

/* uma versão por material, para o mesmo número não ser reutilizado */
create unique index if not exists aprovacoes_versao_unica
  on public.aprovacoes (tipo, alvo_id, versao) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. DECISÕES POR PARTE (cena, slide, frame, criativo)
--
-- Guardamos a referência estável da parte, não a posição: cenas podem ser
-- reordenadas, e uma decisão tomada sobre a "cena 2" não pode migrar
-- sozinha para outra cena quando a ordem muda.
-- ---------------------------------------------------------------------
create table if not exists public.aprovacao_partes (
  id uuid primary key default gen_random_uuid(),
  aprovacao_id uuid not null references public.aprovacoes(id) on delete cascade,

  parte_tipo text not null,           -- 'cena' | 'slide' | 'frame' | 'criativo'
  parte_id uuid not null,             -- id estável do registro
  parte_rotulo text,                  -- "Cena 02" no momento da decisão

  /* pendente | aprovado | ajustes */
  situacao text not null default 'pendente',
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz default now()
);
create unique index if not exists aprovacao_partes_unica
  on public.aprovacao_partes (aprovacao_id, parte_id);
create index if not exists aprovacao_partes_aprovacao
  on public.aprovacao_partes (aprovacao_id);

-- ---------------------------------------------------------------------
-- 3. COMENTÁRIOS
--
-- Ficam presos ao material e à versão. Resolver não apaga: o histórico do
-- que foi pedido é o que explica por que o material mudou.
-- ---------------------------------------------------------------------
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  aprovacao_id uuid not null references public.aprovacoes(id) on delete cascade,
  parte_id uuid,                      -- null = comentário geral
  parte_rotulo text,

  autor_id uuid,
  autor_nome text,
  autor_papel text,
  texto text not null,

  resolvido boolean default false,
  resolvido_por uuid,
  resolvido_em timestamptz,

  created_at timestamptz default now()
);
create index if not exists comentarios_aprovacao
  on public.comentarios (aprovacao_id, created_at);

-- ---------------------------------------------------------------------
-- 4. FOTO DE PERFIL
--
-- Pertence à pessoa, não à empresa: não substitui a logo do cliente.
-- ---------------------------------------------------------------------
alter table public.perfis add column if not exists avatar_url text;
alter table public.perfis add column if not exists avatar_em timestamptz;

-- ---------------------------------------------------------------------
-- 5. VISIBILIDADE PARA O CLIENTE
--
-- Nada fica visível por ter sido criado: a equipe libera explicitamente.
-- ---------------------------------------------------------------------
alter table public.conteudos add column if not exists visivel_cliente boolean default false;
alter table public.linhas_editoriais add column if not exists visivel_cliente boolean default false;
alter table public.status_semanais add column if not exists publicado_em timestamptz;

-- ---------------------------------------------------------------------
-- 6. VISÃO DO QUE ESTÁ PENDENTE
--
-- Alimenta o "Precisa da sua atenção" com uma consulta só.
-- ---------------------------------------------------------------------
create or replace view public.aprovacoes_pendentes
with (security_invoker = true) as
select a.id, a.client_id, a.tipo, a.alvo_id, a.versao, a.situacao,
       a.enviado_em, a.observacao_envio,
       c.nome as cliente_nome,
       coalesce(
         a.snapshot->>'titulo',
         case a.tipo
           when 'roteiro' then (select r.titulo from public.roteiros r where r.id = a.alvo_id)
           when 'linha'   then (select l.nome  from public.linhas_editoriais l where l.id = a.alvo_id)
           when 'conteudo'then (select ct.titulo from public.conteudos ct where ct.id = a.alvo_id)
           else null
         end,
         'Sem título'
       ) as titulo,
       (select count(*) from public.comentarios cm
         where cm.aprovacao_id = a.id and cm.resolvido = false) as comentarios_abertos
from public.aprovacoes a
join public.clientes c on c.id = a.client_id
where a.deleted_at is null;

-- --------------------------------------------------------- updated_at
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'aprovacoes_updated') then
      create trigger aprovacoes_updated before update on public.aprovacoes
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.aprovacoes        enable row level security;
alter table public.aprovacao_partes  enable row level security;
alter table public.comentarios       enable row level security;

do $$
begin
  /* O cliente lê o que foi enviado para a empresa dele. A equipe lê tudo.
     posso_ver_cliente já corta serviço pausado ou cancelado. */
  drop policy if exists aprovacoes_leitura on public.aprovacoes;
  create policy aprovacoes_leitura on public.aprovacoes for select
    to authenticated using (public.posso_ver_cliente(client_id));

  /* Enviar, cancelar e editar é da equipe. */
  drop policy if exists aprovacoes_equipe on public.aprovacoes;
  create policy aprovacoes_equipe on public.aprovacoes for all
    to authenticated using (public.sou_equipe()) with check (public.sou_equipe());

  /* Decidir é do cliente — e só de quem tem permissão de aprovar. A
     equipe também decide, porque acompanha e corrige.
     Com a v2 (aprov_decidir), a decisão passa só pela função: as
     políticas de escrita direta do cliente não são recriadas. */
  drop policy if exists aprovacoes_decisao on public.aprovacoes;
  if to_regproc('public.aprov_decidir') is null then
  create policy aprovacoes_decisao on public.aprovacoes for update
    to authenticated using (
      public.posso_ver_cliente(client_id) and exists (
        select 1 from public.perfis p
         where p.id = auth.uid() and p.estado = 'ativa'
           and (p.papel in ('admin', 'coordenador') or p.pode_aprovar = true))
    );

  drop policy if exists partes_leitura on public.aprovacao_partes;
  create policy partes_leitura on public.aprovacao_partes for select
    to authenticated using (exists (
      select 1 from public.aprovacoes a
       where a.id = aprovacao_id and public.posso_ver_cliente(a.client_id)));

  drop policy if exists partes_escrita on public.aprovacao_partes;
  create policy partes_escrita on public.aprovacao_partes for all
    to authenticated using (exists (
      select 1 from public.aprovacoes a
       where a.id = aprovacao_id and public.posso_ver_cliente(a.client_id)));
  end if;

  drop policy if exists comentarios_leitura on public.comentarios;
  create policy comentarios_leitura on public.comentarios for select
    to authenticated using (exists (
      select 1 from public.aprovacoes a
       where a.id = aprovacao_id and public.posso_ver_cliente(a.client_id)));

  /* Comentar é de quem enxerga o material; apagar comentário de outra
     pessoa, não — por isso delete não entra aqui. */
  drop policy if exists comentarios_escrita on public.comentarios;
  create policy comentarios_escrita on public.comentarios for insert
    to authenticated with check (exists (
      select 1 from public.aprovacoes a
       where a.id = aprovacao_id and public.posso_ver_cliente(a.client_id)));

  drop policy if exists comentarios_resolver on public.comentarios;
  create policy comentarios_resolver on public.comentarios for update
    to authenticated using (public.sou_equipe());
end $$;

grant select, insert, update on public.aprovacoes to authenticated;
grant select, insert, update, delete on public.aprovacao_partes to authenticated;
grant select, insert, update on public.comentarios to authenticated;
grant select on public.aprovacoes_pendentes to authenticated;
