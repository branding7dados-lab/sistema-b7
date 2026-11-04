-- =====================================================================
-- migration_design_compartilhar.sql
-- Duas mudanças, para o Designer ver e atribuir peças de colegas:
--
-- 1. RLS de public.perfis SÓ deixava cada um ler o próprio perfil (ou a
--    equipe ler todos). Isso é uma lacuna pré-existente, não causada
--    por esta rodada: design_resumo já faz join com perfis para expor
--    designer_nome/designer_avatar de QUALQUER responsável, mas como a
--    view é security_invoker=true, esse join respeita a RLS de quem
--    está chamando — então hoje, em produção, um Designer olhando uma
--    peça de OUTRO designer provavelmente já recebe designer_nome nulo
--    (mascarado sem querer como "Sem responsável"). Esta migration
--    amplia a política para qualquer funcionário interno (admin/
--    coordenador/designer) poder ler o perfil de outro funcionário
--    interno — nunca o de um cliente, que continua só visível para a
--    equipe ou para o próprio cliente.
-- 2. Permite que um Designer que já produz alguma peça de uma Linha
--    Editorial atribua uma OUTRA peça, ainda sem responsável, DA MESMA
--    LINHA, a um colega (Designer/Admin/Coordenador ativo) — sem
--    precisar da coordenação pra isso. Recria design_atribuir só
--    acrescentando essa terceira condição de permissão; nada mais muda
--    (auto-atribuição do próprio designer e atribuição livre da equipe
--    continuam idênticas).
--
-- Rode uma vez no SQL Editor do Supabase. Idempotente.
-- =====================================================================

do $$
begin
  drop policy if exists perfis_leitura on public.perfis;
  create policy perfis_leitura on public.perfis for select
    to authenticated using (
      id = auth.uid()
      or public.sou_equipe()
      or (public.sou_equipe_interna() and papel in ('admin', 'coordenador', 'designer'))
    );
end $$;

create or replace function public.design_atribuir(p_deliverable_id uuid, p_designer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.design_deliverables%rowtype; ator public.perfis%rowtype; alvo public.perfis%rowtype;
begin
  select * into d from public.design_deliverables where id = p_deliverable_id and deleted_at is null for update;
  if not found then raise exception 'Peça de Design não encontrada.' using errcode = 'P0002'; end if;

  if p_designer_id is not null then
    select * into alvo from public.perfis where id = p_designer_id and estado = 'ativa';
    if not found or alvo.papel not in ('designer', 'admin', 'coordenador') then
      raise exception 'Responsável inválido.';
    end if;
  end if;

  if not (
    public.sou_equipe()
    or (public.sou_designer() and d.designer_id is null and p_designer_id = auth.uid())
    or (
      -- "compartilhar": já produzo outra peça desta mesma linha e estou
      -- atribuindo uma peça ainda sem dono a um colega válido
      public.sou_designer() and d.designer_id is null and p_designer_id is not null
      and d.linha_id is not null
      and exists (
        select 1 from public.design_deliverables dd
         where dd.linha_id = d.linha_id and dd.designer_id = auth.uid()
           and dd.deleted_at is null and dd.id <> d.id
      )
    )
  ) then
    raise exception 'Sem permissão para atribuir esta peça.' using errcode = '42501';
  end if;

  select * into ator from public.perfis where id = auth.uid();

  update public.design_deliverables
     set designer_id = p_designer_id, updated_at = now(),
         status = case when status = 'aguardando_producao' and p_designer_id is not null then 'em_criacao' else status end
   where id = d.id;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.atribuida', 'design.atribuida:' || d.id || ':' || now()::text,
          'design_deliverable', d.id, d.client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('designer_id', p_designer_id, 'designer_nome', alvo.nome, 'anterior', d.designer_id));
  perform public.design_processar_evento((select id from public.eventos_dominio
    where chave = 'design.atribuida:' || d.id || ':' || now()::text order by created_at desc limit 1));

  if d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_designer_id, updated_at = now() where id = d.kanban_id;
  end if;
end;
$$;
revoke all on function public.design_atribuir(uuid, uuid) from public;
grant execute on function public.design_atribuir(uuid, uuid) to authenticated;
