-- =====================================================================
-- TRENDS COM ETIQUETAS E CLIENTE (zzz207)
-- etiquetas: palavras-chave da trend (nicho, assunto, formato) — servem
--            para sugerir trends que combinam com a linha de um cliente.
-- client_id: trend pensada só para um cliente (opcional; sem ele serve
--            para vários).
-- Só acrescenta duas colunas; as trends existentes ficam como estão.
-- =====================================================================
alter table public.trends add column if not exists etiquetas text[] not null default '{}';
alter table public.trends add column if not exists client_id uuid;
