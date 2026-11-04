-- =====================================================================
-- PRODUÇÃO DE VÍDEO — CONCLUSÃO SEM VERSÃO OBRIGATÓRIA
-- Na prática a entrega da B7 é: mandar o vídeo no grupo "Concluídos" e
-- subir no Drive. Registrar versão + link continua existindo (é o que
-- alimenta a aprovação do cliente), mas deixa de ser o ÚNICO caminho:
-- a demanda ganha um checklist de conclusão com duas marcas, cada uma
-- com carimbo de tempo e evento no histórico.
--   • enviado_grupo_em  — vídeo enviado no grupo de concluídos
--   • upado_drive_em    — vídeo upado no Drive
-- Nada aqui muda status sozinho: com as duas marcas, a tela oferece
-- "Marcar como entregue" (video_mudar_status 'entregue', que já existe
-- e nunca exigiu versão).
-- =====================================================================

alter table public.demandas_edicao
  add column if not exists enviado_grupo_em timestamptz,
  add column if not exists upado_drive_em   timestamptz;

create or replace function public.video_marcar_conclusao(p_demanda_id uuid, p_etapa text, p_marcado boolean)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; rot text;
begin
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para mudar esta demanda.' using errcode = '42501';
  end if;
  if p_etapa not in ('grupo', 'drive') then raise exception 'Etapa inválida.'; end if;
  select * into ator from public.perfis where id = auth.uid();

  if p_etapa = 'grupo' then
    update public.demandas_edicao
       set enviado_grupo_em = case when p_marcado then coalesce(enviado_grupo_em, now()) else null end,
           updated_at = now()
     where id = p_demanda_id;
    rot := 'Enviado no grupo de concluídos';
  else
    update public.demandas_edicao
       set upado_drive_em = case when p_marcado then coalesce(upado_drive_em, now()) else null end,
           updated_at = now()
     where id = p_demanda_id;
    rot := 'Upado no Drive';
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'conclusao', auth.uid(), ator.nome, ator.papel,
          rot || (case when p_marcado then '' else ' — desmarcado' end));
end;
$$;
revoke all on function public.video_marcar_conclusao(uuid, text, boolean) from public;
grant execute on function public.video_marcar_conclusao(uuid, text, boolean) to authenticated;

-- View: mesma definição de migration_video_multiplos_roteiros.sql + as duas colunas
-- no fim (create or replace só aceita coluna nova acrescentada ao final).
create or replace view public.demandas_edicao_resumo as
select
  de.id, de.client_id, de.gravacao_id, de.videomaker_id, de.competencia_ano, de.competencia_mes,
  de.codigo, de.titulo, de.pacote, de.prazo, de.link_material, de.editing_status, de.observacoes,
  de.origem, de.import_lote_id, de.criado_por, de.created_at, de.updated_at, de.entregue_em, de.deleted_at,
  cl.nome as cliente_nome, coalesce(cl.servico, 'ativo'::text) as cliente_servico,
  pf.nome as videomaker_nome, g.situacao as gravacao_situacao, g.nome as gravacao_nome,
  de.kanban_id, de.prioridade, de.roteiro_id, de.standby_revisar_em, cl.logo_url as cliente_logo_url,
  coalesce(rot.roteiros_vinculados, '[]'::jsonb) as roteiros_vinculados,
  de.enviado_grupo_em, de.upado_drive_em
from demandas_edicao de
left join clientes cl on cl.id = de.client_id
left join perfis pf on pf.id = de.videomaker_id
left join gravacoes g on g.id = de.gravacao_id
left join lateral (
  select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo) order by r.position, r.created_at) as roteiros_vinculados
  from public.demandas_edicao_roteiros der
  join public.roteiros r on r.id = der.roteiro_id and r.deleted_at is null
  where der.demanda_id = de.id
) rot on true
where de.deleted_at is null;
grant select on public.demandas_edicao_resumo to authenticated;
