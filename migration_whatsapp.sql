-- =====================================================================
-- AVISOS POR WHATSAPP (zzz83)
--
-- Aditivo:
--  • perfil_contatos: o WhatsApp de cada pessoa da equipe. Tabela à
--    parte (e não coluna em perfis) porque telefone é dado pessoal:
--    aqui NÃO existe política para o navegador — só o servidor lê e
--    grava (função b7-auth, depois de conferir que quem chamou é
--    administrador; função b7-push, para entregar o aviso).
--  • notificacoes ganha duas colunas de registro do envio.
-- Nenhuma política existente muda.
-- =====================================================================

create table if not exists public.perfil_contatos (
  perfil_id      uuid primary key references public.perfis(id) on delete cascade,
  whatsapp       text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis(id) on delete set null
);

alter table public.perfil_contatos enable row level security;
revoke all on table public.perfil_contatos from anon, authenticated, public;
-- sem políticas: só a chave de serviço (funções do servidor) alcança.

alter table public.notificacoes add column if not exists whatsapp_status text;
alter table public.notificacoes add column if not exists whatsapp_em timestamptz;
