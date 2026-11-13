-- =====================================================================
-- zzz334 (4.45.1) — PageSpeed do site
-- 1) Foto de perfil dos vídeos (site_itens.avatar_url) apontava para logos
--    antigos que já não existem (erro 400 no console). Atualiza para o
--    logo atual do cliente e, daqui pra frente, um gatilho acompanha a
--    troca de logo no cadastro.
-- 2) Logos e capas com cache de 1 ano (os nomes dos arquivos já mudam a
--    cada envio, então não fica imagem velha presa).
-- Só atualiza; nada é apagado.
-- =====================================================================
update public.site_itens s set avatar_url = c.logo_url
  from public.clientes c
 where c.deleted_at is null and c.logo_url is not null
   and lower(trim(s.cliente_nome)) = lower(trim(c.nome))
   and s.avatar_url is distinct from c.logo_url;

create or replace function public._site_avatar_segue_logo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.logo_url is distinct from old.logo_url or new.nome is distinct from old.nome then
    update public.site_itens set avatar_url = new.logo_url
     where lower(trim(cliente_nome)) = lower(trim(new.nome));
  end if;
  return new;
end $$;
revoke all on function public._site_avatar_segue_logo() from public, anon, authenticated;
create or replace trigger clientes_site_avatar after update of logo_url, nome on public.clientes
  for each row execute function public._site_avatar_segue_logo();

update storage.objects
   set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{cacheControl}', '"max-age=31536000"')
 where bucket_id in ('client-logos', 'site')
   and coalesce(metadata->>'cacheControl', '') <> 'max-age=31536000';

select (select count(*) from public.site_itens where avatar_url is not null) com_avatar,
       (select count(*) from storage.objects where bucket_id in ('client-logos','site') and metadata->>'cacheControl' = 'max-age=31536000') com_cache_longo;
