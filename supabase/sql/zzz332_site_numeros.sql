-- zzz332 (4.42.2) — números do site (só totais, nenhum dado de cliente):
-- vídeos editados entregues, posts publicados/programados, artes finalizadas
-- e marcas ativas. O site mostra quando Site → Página → Números está vazio.
create or replace function public.site_numeros()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'videos', (select count(*) from public.demandas_edicao where deleted_at is null and editing_status = 'entregue'),
    'posts', (select count(*) from public.conteudos where deleted_at is null and status in ('Publicado','Programado')),
    'artes', (select count(*) from public.design_deliverables where deleted_at is null and status in ('finalizado','aprovado_cliente')),
    'marcas', (select count(*) from public.clientes where deleted_at is null and not coalesce(teste, false)));
$$;
revoke all on function public.site_numeros() from public;
grant execute on function public.site_numeros() to anon, authenticated;
