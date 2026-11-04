-- =====================================================================
-- KANBAN DE PRODUÇÃO
--
-- Aditiva e idempotente. Uma demanda pode apontar para um registro que
-- já existe (roteiro, conteúdo, gravação, linha editorial) ou não apontar
-- para nada — reunião, entrega, organização de arquivos.
--
-- O texto canônico NUNCA é copiado para cá: a demanda guarda o vínculo e
-- abre o editor de origem. Duplicar o roteiro no card criaria duas
-- verdades sobre o mesmo material.
--
-- Status operacional da demanda ≠ status de aprovação do material. O
-- cliente aprovar um roteiro não conclui a produção, que ainda tem
-- gravação, edição e publicação pela frente.
-- =====================================================================

create table if not exists public.kanban_demandas (
  id uuid primary key default gen_random_uuid(),

  titulo text not null,
  descricao text,

  /* onde a demanda vive no fluxo */
  coluna text not null default 'a_fazer',
  posicao double precision not null default 1000,

  /* de quem é: opcional, porque existe demanda interna sem cliente */
  client_id uuid references public.clientes(id) on delete set null,

  /* vínculo com o material — no máximo um, e sempre opcional */
  tipo_vinculo text,          -- roteiro | conteudo | gravacao | linha | avulsa
  vinculo_id uuid,

  /* organização */
  tipo text default 'producao',   -- producao | gravacao | reuniao | entrega | ajuste | outro
  responsavel_id uuid references public.perfis(id) on delete set null,
  prazo date,
  prioridade text default 'normal',   -- baixa | normal | alta

  /* o que o fluxo de aprovação escreveu aqui por último */
  origem_evento text,

  referencias text,
  arquivada_em timestamptz,
  concluida_em timestamptz,

  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kanban_coluna_valida') then
    alter table public.kanban_demandas add constraint kanban_coluna_valida
      check (coluna in ('a_fazer', 'producao', 'revisao', 'aguardando_cliente',
                        'ajustes', 'pronto', 'concluida'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kanban_vinculo_valido') then
    alter table public.kanban_demandas add constraint kanban_vinculo_valido
      check (tipo_vinculo is null or
             tipo_vinculo in ('roteiro', 'conteudo', 'gravacao', 'linha', 'avulsa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kanban_prioridade_valida') then
    alter table public.kanban_demandas add constraint kanban_prioridade_valida
      check (prioridade in ('baixa', 'normal', 'alta'));
  end if;
end $$;

create index if not exists kanban_coluna on public.kanban_demandas (coluna, posicao)
  where deleted_at is null and arquivada_em is null;
create index if not exists kanban_cliente on public.kanban_demandas (client_id)
  where deleted_at is null;
create index if not exists kanban_vinculo on public.kanban_demandas (tipo_vinculo, vinculo_id)
  where deleted_at is null;
create index if not exists kanban_responsavel on public.kanban_demandas (responsavel_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------
-- COMENTÁRIOS INTERNOS DA DEMANDA
-- Conversa da equipe. O cliente não alcança isto em hipótese nenhuma —
-- é aqui que se escreve o que não vai para fora.
-- ---------------------------------------------------------------------
create table if not exists public.kanban_comentarios (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.kanban_demandas(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  autor_nome text,
  texto text not null,
  resolvido_em timestamptz,
  created_at timestamptz default now()
);
create index if not exists kanban_com_demanda
  on public.kanban_comentarios (demanda_id, created_at);

-- ---------------------------------------------------------------------
-- HISTÓRICO DE MOVIMENTAÇÃO
-- Quem moveu o quê e quando. Sem isso, "por que isso está parado aqui?"
-- não tem resposta.
-- ---------------------------------------------------------------------
create table if not exists public.kanban_historico (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.kanban_demandas(id) on delete cascade,
  autor_id uuid references public.perfis(id) on delete set null,
  autor_nome text,
  de text, para text,
  campo text default 'coluna',
  created_at timestamptz default now()
);
create index if not exists kanban_hist_demanda
  on public.kanban_historico (demanda_id, created_at desc);

-- ------------------------------------------------------------ trigger
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'kanban_demandas_updated') then
      create trigger kanban_demandas_updated before update on public.kanban_demandas
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------- view
/* A lista precisa do nome do cliente e do responsável sem uma volta
   extra ao banco por card. */
drop view if exists public.kanban_resumo;
create view public.kanban_resumo
with (security_invoker = true) as
select d.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo,
       p.nome as responsavel_nome,
       (select count(*) from public.kanban_comentarios k
         where k.demanda_id = d.id and k.resolvido_em is null) as comentarios_abertos
from public.kanban_demandas d
left join public.clientes c on c.id = d.client_id
left join public.perfis p on p.id = d.responsavel_id;

-- ----------------------------------------------------------------- RLS
alter table public.kanban_demandas    enable row level security;
alter table public.kanban_comentarios enable row level security;
alter table public.kanban_historico   enable row level security;

do $$
begin
  /* O Kanban é da equipe. Não há política de leitura para cliente:
     a ausência é intencional e é o que impede o acesso por URL direta
     ou por chamada à API. */
  drop policy if exists kanban_equipe on public.kanban_demandas;
  create policy kanban_equipe on public.kanban_demandas for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());

  drop policy if exists kanban_com_equipe on public.kanban_comentarios;
  create policy kanban_com_equipe on public.kanban_comentarios for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());

  drop policy if exists kanban_hist_equipe on public.kanban_historico;
  create policy kanban_hist_equipe on public.kanban_historico for all to authenticated
    using (public.sou_equipe()) with check (public.sou_equipe());
exception when undefined_function then
  /* migration_auth.sql ainda não rodou: as políticas entram depois */
  raise notice 'Funções de autorização ausentes — rode migration_auth.sql e repita esta migration.';
end $$;

grant select, insert, update, delete on public.kanban_demandas to authenticated;
grant select, insert, update, delete on public.kanban_comentarios to authenticated;
grant select, insert on public.kanban_historico to authenticated;
grant select on public.kanban_resumo to authenticated;
