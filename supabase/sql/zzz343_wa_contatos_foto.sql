-- 4.53.1: foto dos contatos e nome do autor na prévia dos grupos.
-- wa_nomes_aplicar() completa (substitui a da zzz341): aplicada no banco por migration.
alter table public.wa_contatos add column if not exists foto_url text;
-- (corpo da função: ver migration zzz343_wa_contatos_foto no Supabase — igual à zzz341 +
--  previa_autor numérica → nome do contato e foto_url do contato → conversa individual)
