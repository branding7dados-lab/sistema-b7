-- =====================================================================
-- B7 IA — registro de uso (pacote 2026-10-01-z)
--
-- Uma tabela só, pequena, para duas coisas:
--   1. saber o que aconteceu com cada pedido de IA (deu certo? qual
--      modelo atendeu? houve troca de modelo? quanto demorou?);
--   2. limitar pedidos por pessoa (a função b7-ia conta as linhas
--      recentes antes de gerar).
--
-- Guarda METADADOS. Não guarda o texto do roteiro, a instrução nem a
-- sugestão: nada de conteúdo de cliente duplicado aqui.
--
-- Acesso: só o servidor (service role). RLS ligado e nenhuma policy —
-- ninguém lê nem escreve pelo app, nem admin. Não existe tela para isto.
--
-- Rodar no SQL Editor do Supabase. Pode rodar de novo sem efeito colateral.
-- =====================================================================

create table if not exists public.ia_uso (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  perfil_id        uuid not null references public.perfis(id) on delete cascade,
  recurso          text not null,                 -- 'roteiro'
  acao             text not null,                 -- 'melhorar', 'encurtar', ...
  entidade_tipo    text,                          -- 'cena'
  entidade_id      uuid,
  status           text not null default 'andamento'
                   check (status in ('andamento', 'ok', 'erro')),
  erro_categoria   text,                          -- 'indisponivel', 'tempo', 'credencial', ...
  modelo           text,                          -- o que de fato atendeu
  provedor         text,
  tentativas       jsonb not null default '[]'::jsonb,   -- [{modelo, erro, status, ms}] das que falharam
  houve_fallback   boolean not null default false,
  duracao_ms       integer,
  tokens_entrada   integer,
  tokens_saida     integer,
  custo            numeric,                       -- informado pelo roteador; nesta fase deve ser 0 ou nulo
  tamanho_entrada  integer,                       -- caracteres, não o texto
  tamanho_saida    integer
);

comment on table public.ia_uso is 'Registro técnico dos pedidos de IA (metadados, sem conteúdo). Só o servidor acessa.';

create index if not exists ia_uso_perfil_recente on public.ia_uso (perfil_id, created_at desc);
create index if not exists ia_uso_recente on public.ia_uso (created_at desc);

alter table public.ia_uso enable row level security;
revoke all on public.ia_uso from anon, authenticated;
