-- zzz328 (4.41.0) — resultados de cada vídeo do site (preenchidos no painel)
alter table public.site_itens add column if not exists visualizacoes text check (char_length(visualizacoes) <= 20);
alter table public.site_itens add column if not exists curtidas text check (char_length(curtidas) <= 20);
alter table public.site_itens add column if not exists comentarios text check (char_length(comentarios) <= 20);
alter table public.site_itens add column if not exists resultado text check (char_length(resultado) <= 140);
