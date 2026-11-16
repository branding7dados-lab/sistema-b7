-- zzz338 — "Passar o trabalho": a lista de quem pode receber design/vídeo
-- passa a incluir quem tem a função como cargo adicional
-- (perfis.funcoes_adicionais), e não só a função principal.
-- Ex.: Mateus (coordenador + designer) aparece para receber peças de design.
-- Usa tenho_funcao_extra(), a mesma regra que saida_transferir/design_atribuir
-- já usam para validar quem recebe.
create or replace function public._carga_funcao(p_area text)
returns table(id uuid, nome text, abertas integer)
language sql stable security definer set search_path to 'public'
as $function$
  select p.id, coalesce(nullif(btrim(p.nome), ''), p.username)::text,
    case p_area
      when 'design' then (select count(*)::int from public.design_deliverables g where g.designer_id = p.id and g.deleted_at is null and g.status <> 'finalizado')
      else (select count(*)::int from public.demandas_edicao d where d.videomaker_id = p.id and d.deleted_at is null and d.editing_status in ('pendente', 'em_edicao', 'aguardando_aprovacao')) end
    from public.perfis p
   where p.estado = 'ativa' and p.papel <> 'cliente'
     and (p.funcao = case p_area when 'design' then 'designer' else 'videomaker' end
          or p.papel = case p_area when 'design' then 'designer' else 'videomaker' end
          or public.tenho_funcao_extra(case p_area when 'design' then 'designer' else 'videomaker' end, p.id));
$function$;
