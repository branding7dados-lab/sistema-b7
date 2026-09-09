-- =====================================================================
-- CENTRAL DE PRODUÇÃO
--
-- Aditiva e idempotente. Não recria tabela, não apaga dado, não converte
-- registro antigo em "Gravada" só porque a data passou.
-- Rode no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SITUAÇÃO OPERACIONAL DA GRAVAÇÃO
--
-- A coluna `status` que já existe mistura preparação e execução
-- ('Rascunho', 'Pronto para gravar', 'Gravado'). Ela continua intacta e
-- em uso pelo editor. O que entra aqui é a situação operacional, que é
-- outra pergunta: a gravação aconteceu ou não?
--
--   Pendente  — existe, ainda sem data
--   Agendada  — tem data marcada
--   Gravada   — a equipe confirmou que aconteceu
--   Cancelada — não vai acontecer
-- ---------------------------------------------------------------------
alter table public.gravacoes add column if not exists situacao text;
alter table public.gravacoes add column if not exists gravada_em timestamptz;
alter table public.gravacoes add column if not exists local text;
alter table public.gravacoes add column if not exists hora_inicio time;
alter table public.gravacoes add column if not exists hora_fim time;

/* Preenche a situação a partir do que já existe, uma única vez.
   'Gravado' vira 'Gravada'. Todo o resto vira 'Agendada' se tiver data
   ou 'Pendente' se não tiver. Data passada NÃO vira Gravada: isso é uma
   confirmação da equipe, não uma dedução do sistema. */
update public.gravacoes
   set situacao = case
         when status = 'Gravado' then 'Gravada'
         when data_gravacao is not null then 'Agendada'
         else 'Pendente'
       end
 where situacao is null;

/* Reparo idempotente: gravações marcadas como 'Gravado' pelo editor antes
   da situação existir ficaram como Pendente/Agendada. Só corrige quando
   ninguém confirmou nada à mão (gravada_em ainda nulo), para não desfazer
   decisão da equipe. */
update public.gravacoes
   set situacao = 'Gravada'
 where status = 'Gravado'
   and situacao in ('Pendente', 'Agendada')
   and gravada_em is null;

alter table public.gravacoes alter column situacao set default 'Pendente';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gravacoes_situacao_valida') then
    alter table public.gravacoes add constraint gravacoes_situacao_valida
      check (situacao in ('Pendente', 'Agendada', 'Gravada', 'Cancelada'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. LINHA EDITORIAL FINALIZADA
-- O status já existe ('Em criação', 'Em revisão', 'Aprovada', 'Finalizada').
-- Só falta o carimbo de quando foi finalizada, para o dashboard não
-- precisar deduzir nada.
-- ---------------------------------------------------------------------
alter table public.linhas_editoriais add column if not exists finalizada_em timestamptz;

-- ------------------------------------------------------------- índices
create index if not exists gravacoes_situacao on public.gravacoes (situacao)
  where deleted_at is null;
create index if not exists gravacoes_data on public.gravacoes (data_gravacao)
  where deleted_at is null;
create index if not exists linhas_status on public.linhas_editoriais (status)
  where deleted_at is null;

-- --------------------------------------------------------- updated_at
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. LINKS DE REFERÊNCIA NA LINHA EDITORIAL
-- Um campo por conteúdo (a referência daquele criativo) e um da linha
-- (referências gerais do mês). Texto livre com um link por linha: o que a
-- equipe já faz hoje colando no WhatsApp.
-- ---------------------------------------------------------------------
alter table public.conteudos add column if not exists referencias text;
alter table public.linhas_editoriais add column if not exists referencias text;


-- ---------------------------------------------------------------------
-- 7. CORREÇÃO DA VIEW DE GRAVAÇÕES
--
-- Causa do erro "Não foi possível carregar a lista.": a view
-- gravacoes_resumo foi criada antes de a coluna `situacao` existir e
-- nunca foi recriada. As métricas da Central consultam a tabela direto e
-- funcionavam; a lista consulta a view e o PostgREST devolvia
-- 42703 column "situacao" does not exist.
--
-- A view é recriada com as colunas novas. Nenhum dado é tocado.
-- ---------------------------------------------------------------------
drop view if exists public.gravacoes_resumo;
create view public.gravacoes_resumo
with (security_invoker = true) as
select g.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo_url,
       (select count(*) from public.roteiros r
         where r.recording_session_id = g.id and r.deleted_at is null) as total_roteiros
from public.gravacoes g
join public.clientes c on c.id = g.client_id;

grant select on public.gravacoes_resumo to anon, authenticated;
