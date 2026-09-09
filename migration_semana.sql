-- =====================================================================
-- B7 STATUS SEMANAL — migration
--
-- Aditiva e idempotente. Não altera, não recria e não apaga nada do que
-- já existe. Pode ser rodada em qualquer ordem: os vínculos com conteúdos,
-- roteiros, gravações e linhas editoriais só ganham chave estrangeira
-- quando essas tabelas existirem (rode de novo depois, se for o caso).
--
-- Rode no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- RELATÓRIOS
-- Um por semana de sete dias. week_start e week_end são datas puras
-- (date, não timestamp): uma postagem do dia 07 não pode virar dia 06 por
-- causa de fuso horário.
-- ---------------------------------------------------------------------
create table if not exists public.status_semanais (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  linha_id uuid,                              -- FK condicional mais abaixo

  semana_inicio date not null,
  semana_fim date not null,

  titulo text,
  observacao_geral text,

  /* rascunho | pronto | enviado — marcação manual, nunca automática */
  situacao text default 'Rascunho',
  enviado_em timestamptz,

  /* preferências de apresentação do documento */
  mostrar_dias_vazios boolean default true,
  mostrar_legenda text default 'auto',        -- auto | sim | nao
  mostrar_observacoes boolean default true,
  preferencias jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- DEMANDAS
-- Etapa e situação são campos separados de propósito: etapa é o que será
-- feito, situação é o andamento. Misturar os dois num campo só foi o que
-- deixou relatórios antigos confusos.
--
-- source_snapshot guarda o que foi importado da origem no momento da
-- criação. É o que permite detectar mudanças depois sem sobrescrever o
-- que a equipe ajustou à mão.
-- ---------------------------------------------------------------------
create table if not exists public.status_itens (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.status_semanais(id) on delete cascade,

  data date,                                  -- pode ser nula: demanda sem dia definido
  position int default 0,

  titulo text,
  etapa text default 'Produção',              -- Produção | Postagem | Gravação | Aprovação | Ajustes | Entrega | Reunião | Outro
  situacao text default 'Previsto',           -- Previsto | Em andamento | Aguardando cliente | Programado | Concluído | Publicado | Atenção | Cancelado
  observacao text,
  canal text,
  formato text,                               -- Reel | Card | Carrossel | Story, quando vier de um conteúdo

  /* vínculos com a origem — todos opcionais, nenhum obrigatório.
     on delete set null: apagar um conteúdo não apaga o histórico. */
  content_id uuid,
  script_id uuid,
  recording_id uuid,

  origem text default 'manual',               -- manual | linha_editorial | gravacao
  source_snapshot jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- VERSÕES EXPORTADAS
-- Snapshot explícito no momento da exportação ou do envio. Não é
-- versionamento de autosave: é o registro do que foi mandado ao cliente.
-- ---------------------------------------------------------------------
create table if not exists public.status_versoes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.status_semanais(id) on delete cascade,
  versao int not null,
  formato text,                               -- png | pdf
  conteudo jsonb not null,                    -- o relatório inteiro no momento
  created_at timestamptz default now()
);

create unique index if not exists status_versoes_unica
  on public.status_versoes (report_id, versao);

-- ---------------------------------- vínculos condicionais com a origem
do $$
declare alvo record;
begin
  for alvo in
    select * from (values
      ('status_semanais', 'linha_id',     'linhas_editoriais'),
      ('status_itens',    'content_id',   'conteudos'),
      ('status_itens',    'script_id',    'roteiros'),
      ('status_itens',    'recording_id', 'gravacoes')
    ) as t(tabela, coluna, destino)
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = alvo.destino)
       and not exists (select 1 from pg_constraint
                       where conname = alvo.tabela || '_' || alvo.coluna || '_fk')
    then
      execute format(
        'alter table public.%I add constraint %I
           foreign key (%I) references public.%I(id) on delete set null',
        alvo.tabela, alvo.tabela || '_' || alvo.coluna || '_fk', alvo.coluna, alvo.destino);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------- índices
create index if not exists status_semanais_cliente
  on public.status_semanais (client_id, semana_inicio desc) where deleted_at is null;
create index if not exists status_semanais_periodo
  on public.status_semanais (semana_inicio, semana_fim);
create index if not exists status_semanais_linha
  on public.status_semanais (linha_id);
create index if not exists status_itens_relatorio
  on public.status_itens (report_id, data, position) where deleted_at is null;
create index if not exists status_itens_conteudo
  on public.status_itens (content_id);
create index if not exists status_versoes_relatorio
  on public.status_versoes (report_id, versao desc);

/* Um cliente não deve ganhar duas semanas iguais por clique duplo. O
   índice é parcial: relatórios na lixeira não bloqueiam a recriação. */
create unique index if not exists status_semanais_unica
  on public.status_semanais (client_id, semana_inicio)
  where deleted_at is null;

-- --------------------------------------------------------- updated_at
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (select 1 from pg_trigger where tgname = 'status_semanais_updated') then
      create trigger status_semanais_updated before update on public.status_semanais
        for each row execute function public.set_updated_at();
    end if;
    if not exists (select 1 from pg_trigger where tgname = 'status_itens_updated') then
      create trigger status_itens_updated before update on public.status_itens
        for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;

-- --------------------------------------------------------------- view
create or replace view public.status_resumo
with (security_invoker = true) as
select r.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo_url,
       (select count(*) from public.status_itens i
         where i.report_id = r.id and i.deleted_at is null) as total_itens,
       (select count(*) from public.status_itens i
         where i.report_id = r.id and i.deleted_at is null
           and i.situacao in ('Aguardando cliente', 'Atenção')) as total_atencao,
       (select max(versao) from public.status_versoes v where v.report_id = r.id) as ultima_versao
from public.status_semanais r
join public.clientes c on c.id = r.client_id;

-- ---------------------------------------------------------------- RLS
alter table public.status_semanais enable row level security;
alter table public.status_itens    enable row level security;
alter table public.status_versoes  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['status_semanais', 'status_itens', 'status_versoes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_tudo', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)',
                   t || '_tudo', t);
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;

grant select on public.status_resumo to anon, authenticated;
