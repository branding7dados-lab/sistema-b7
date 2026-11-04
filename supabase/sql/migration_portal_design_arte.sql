-- =====================================================================
-- zzz236: O CLIENTE VÊ A ARTE QUE ESTÁ APROVANDO
-- Antes, o Portal pedia a aprovação de uma "Peça de Design" sem mostrar a
-- arte: o bucket design-files só deixava a equipe (e o designer da peça)
-- ler os arquivos. Agora quem pode ver a empresa (posso_ver_cliente) lê
-- exatamente os arquivos que estão no snapshot de uma aprovação de design
-- dela, e nada além disso.
-- =====================================================================
create or replace function public.design_arquivo_de_aprovacao_visivel(p_caminho text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.aprovacoes a
     where a.tipo = 'design_versao'
       and a.situacao <> 'cancelado'
       and public.posso_ver_cliente(a.client_id)
       and (a.snapshot -> 'arquivos_efetivos' @> jsonb_build_array(jsonb_build_object('caminho', p_caminho))
         or a.snapshot -> 'arquivos' @> jsonb_build_array(jsonb_build_object('caminho', p_caminho)))
  )
$function$;
revoke all on function public.design_arquivo_de_aprovacao_visivel(text) from public, anon;
grant execute on function public.design_arquivo_de_aprovacao_visivel(text) to authenticated;

drop policy if exists "design-files cliente aprovacao" on storage.objects;
create policy "design-files cliente aprovacao" on storage.objects for select to authenticated
  using (bucket_id = 'design-files' and public.design_arquivo_de_aprovacao_visivel(name));
