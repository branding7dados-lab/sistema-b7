-- zzz327 (4.40.0) — foto de perfil do cliente nos vídeos do site (o logo do
-- cadastro do cliente vira o "avatar" no celular 3D e nos cartões)
alter table public.site_itens add column if not exists avatar_url text check (char_length(avatar_url) <= 600);
update public.site_itens s set avatar_url = c.logo_url
  from public.clientes c
  where s.avatar_url is null and s.cliente_nome is not null and c.deleted_at is null and c.logo_url is not null
    and lower(regexp_replace(c.nome, '\s', '', 'g')) = lower(regexp_replace(s.cliente_nome, '\s', '', 'g'));
