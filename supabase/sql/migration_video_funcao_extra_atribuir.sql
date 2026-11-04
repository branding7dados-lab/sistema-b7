-- =====================================================================
-- CORREÇÃO: video_atribuir e video_carga_equipe ignoravam a FUNÇÃO EXTRA
-- "videomaker"
--
-- Contexto: a Central de Vídeo permite marcar alguém como videomaker de
-- duas formas — o papel principal (perfis.papel = 'videomaker') ou uma
-- função extra (perfis_funcoes_extra), pensada exatamente para gente
-- como admin/coordenador que também edita vídeo sem que esse seja o
-- papel principal dela no sistema. A view videomakers_elegiveis e a
-- função video_criar_demanda já consideravam as duas formas
-- corretamente (via eh_videomaker_elegivel).
--
-- video_atribuir e video_carga_equipe ficaram para trás: continuavam
-- checando só "papel = 'videomaker'", direto, sem passar pelo helper.
-- Resultado prático: alguém aparecia na lista de videomakers elegíveis
-- do dropdown (populada pela view certa), mas ao tentar atribuir a
-- demanda a essa pessoa, o sistema recusava com "Esse usuário não é um
-- videomaker ativo." — exatamente o caso do Kevin França (papel admin,
-- função extra videomaker).
-- =====================================================================

create or replace function public.video_atribuir(p_demanda_id uuid, p_videomaker_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; ator public.perfis%rowtype; vm public.perfis%rowtype; evid uuid;
  vira_em_edicao boolean; k uuid;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe atribui um videomaker.' using errcode = '42501';
  end if;
  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if p_videomaker_id is not null then
    if not public.eh_videomaker_elegivel(p_videomaker_id) then
      raise exception 'Esse usuário não é um videomaker ativo.';
    end if;
    select * into vm from public.perfis where id = p_videomaker_id;
  end if;
  select * into ator from public.perfis where id = auth.uid();
  vira_em_edicao := p_videomaker_id is not null and d.editing_status = 'pendente';

  update public.demandas_edicao
     set videomaker_id = p_videomaker_id, updated_at = now(),
         editing_status = case when vira_em_edicao then 'em_edicao' else editing_status end
   where id = p_demanda_id;

  if vira_em_edicao and d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'producao', d.client_id, 'demanda_edicao', d.id, 'video', p_videomaker_id, d.prazo, auth.uid(), 'video.atribuida')
    returning id into k;
    update public.demandas_edicao set kanban_id = k where id = p_demanda_id;
  elsif d.kanban_id is not null then
    update public.kanban_demandas set responsavel_id = p_videomaker_id, updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
  values (p_demanda_id, 'atribuida', auth.uid(), ator.nome, ator.papel,
          case when p_videomaker_id is null then 'Atribuição removida' else null end);

  if vira_em_edicao then
    insert into public.demandas_edicao_eventos (demanda_id, tipo, de_status, para_status, ator_id, ator_nome, ator_papel, mensagem)
    values (p_demanda_id, 'status', 'pendente', 'em_edicao', auth.uid(), ator.nome, ator.papel, null);
  end if;

  if p_videomaker_id is not null then
    insert into public.eventos_dominio (id, tipo, chave, alvo_tipo, alvo_id, client_id, ator_id, ator_nome, ator_papel, payload)
    values (gen_random_uuid(), 'video.atribuida', 'video.atribuida:' || p_demanda_id || ':' || now()::text,
            'demanda_edicao', p_demanda_id, d.client_id, auth.uid(), ator.nome, ator.papel,
            jsonb_build_object('videomaker_id', p_videomaker_id, 'videomaker_nome', vm.nome, 'titulo', d.titulo))
    returning id into evid;
    perform public.video_processar_evento(evid);
  end if;
end;
$$;
revoke all on function public.video_atribuir(uuid, uuid) from public;
grant execute on function public.video_atribuir(uuid, uuid) to authenticated;

create or replace function public.video_carga_equipe()
returns table(videomaker_id uuid, videomaker_nome text, para_iniciar integer, em_edicao integer,
  correcao integer, aguardando_aprovacao integer, standby integer, atrasadas integer,
  vence_hoje integer, total_ativo integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome,
    count(*) filter (where d.editing_status = 'pendente')::int,
    count(*) filter (where d.editing_status = 'em_edicao')::int,
    count(*) filter (where d.editing_status = 'correcao')::int,
    count(*) filter (where d.editing_status = 'aguardando_aprovacao')::int,
    count(*) filter (where d.editing_status = 'standby')::int,
    count(*) filter (where d.editing_status not in ('entregue', 'descartado') and d.prazo is not null and d.prazo < current_date)::int,
    count(*) filter (where d.editing_status not in ('entregue', 'descartado') and d.prazo = current_date)::int,
    count(*)::int
  from public.perfis p
  join public.demandas_edicao d on d.videomaker_id = p.id
  where p.estado = 'ativa' and (p.papel = 'videomaker' or public.tenho_funcao_extra('videomaker', p.id))
    and d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
  group by p.id, p.nome
  order by p.nome;
$$;
revoke all on function public.video_carga_equipe() from public;
grant execute on function public.video_carga_equipe() to authenticated;
