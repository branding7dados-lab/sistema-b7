-- v3.1.0 — Prioridade das demandas de edição (quadro de prioridade)
--
-- A coordenação e os videomakers (v3.1.3) decidem a ordem dos vídeos: três
-- faixas (Urgente, Alta, Normal) e, dentro de cada uma, a ordem de cima para
-- baixo. O primeiro da fila é o próximo a editar.
--
--   prioridade_ordem  posição dentro da faixa (menor = mais em cima).
--                     Número com casas: arrastar entre dois cartões grava
--                     o meio dos dois, sem renumerar a fila inteira.
--   video_priorizar   única forma de mudar faixa/ordem; exige a ação
--                     'video.priorizar' (padrão: coordenação e videomakers; admin sempre).
--                     Troca de faixa vai para o histórico e avisa o
--                     videomaker quando o vídeo dele sobe para Alta/Urgente.

alter table public.demandas_edicao add column if not exists prioridade_ordem double precision;

-- ordem inicial: quem tem prazo antes fica em cima; sem prazo, o mais antigo
with o as (
  select id, row_number() over (partition by prioridade
           order by prazo nulls last, created_at) * 1000.0 n
    from public.demandas_edicao
   where deleted_at is null and prioridade_ordem is null
)
update public.demandas_edicao d set prioridade_ordem = o.n from o where o.id = d.id;

create index if not exists demandas_edicao_prioridade_idx
  on public.demandas_edicao (prioridade, prioridade_ordem) where deleted_at is null;

-- a visão de leitura passa a trazer a ordem (coluna nova no fim)
create or replace view public.demandas_edicao_resumo with (security_invoker = true) as
 SELECT de.id,
    de.client_id,
    de.gravacao_id,
    de.videomaker_id,
    de.competencia_ano,
    de.competencia_mes,
    de.codigo,
    de.titulo,
    de.pacote,
    de.prazo,
    de.link_material,
    de.editing_status,
    de.observacoes,
    de.origem,
    de.import_lote_id,
    de.criado_por,
    de.created_at,
    de.updated_at,
    de.entregue_em,
    de.deleted_at,
    cl.nome AS cliente_nome,
    COALESCE(cl.servico, 'ativo'::text) AS cliente_servico,
    pf.nome AS videomaker_nome,
    g.situacao AS gravacao_situacao,
    g.nome AS gravacao_nome,
    de.kanban_id,
    de.prioridade,
    de.roteiro_id,
    de.standby_revisar_em,
    cl.logo_url AS cliente_logo_url,
    COALESCE(rot.roteiros_vinculados, '[]'::jsonb) AS roteiros_vinculados,
    de.enviado_grupo_em,
    de.upado_drive_em,
    de.conteudo_id,
    de.formato_video,
    de.referencia_link,
    de.projeto_id,
    pa.nome AS projeto_nome,
    pa.tipo AS projeto_tipo,
    pa.etapa AS projeto_etapa,
    de.prioridade_ordem
   FROM demandas_edicao de
     LEFT JOIN clientes cl ON cl.id = de.client_id
     LEFT JOIN perfis pf ON pf.id = de.videomaker_id
     LEFT JOIN gravacoes g ON g.id = de.gravacao_id
     LEFT JOIN projetos_avulsos pa ON pa.id = de.projeto_id
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo) ORDER BY r."position", r.created_at) AS roteiros_vinculados
           FROM demandas_edicao_roteiros der
             JOIN roteiros r ON r.id = der.roteiro_id AND r.deleted_at IS NULL
          WHERE der.demanda_id = de.id) rot ON true
  WHERE de.deleted_at IS NULL;

-- a ação nova, nas Configurações → Funções e permissões
insert into public.acoes (id, modulo, rotulo, descricao, ordem, padrao_funcoes, nivel_min) values
  ('video.priorizar', 'video', 'Definir a prioridade dos vídeos',
   'Arrastar os vídeos no quadro de prioridade: o que é urgente e a ordem da fila de edição.', 55, '{coordenador,videomaker}', 2)
on conflict (id) do nothing;
-- v3.1.3: o videomaker também muda a prioridade (Kevin)
update public.acoes set padrao_funcoes = '{coordenador,videomaker}' where id = 'video.priorizar';

create or replace function public.video_priorizar(p_demanda_id uuid, p_prioridade text, p_ordem double precision)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  d public.demandas_edicao%rowtype; quem record; evid uuid;
  rot constant jsonb := '{"normal":"Normal","alta":"Alta","urgente":"Urgente"}';
begin
  perform public.exigir_nivel('video', 2);
  if not public.pode_acao('video.priorizar') then
    raise exception 'Você não tem permissão para mudar a prioridade dos vídeos.' using errcode = '42501';
  end if;
  if p_prioridade not in ('normal', 'alta', 'urgente') then
    raise exception 'Prioridade inválida.';
  end if;

  select * into d from public.demandas_edicao where id = p_demanda_id and deleted_at is null for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;

  update public.demandas_edicao
     set prioridade = p_prioridade, prioridade_ordem = p_ordem, updated_at = now()
   where id = p_demanda_id;

  if d.prioridade is distinct from p_prioridade then
    select nome, papel into quem from public.perfis where id = auth.uid();
    insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
    values (p_demanda_id, 'edicao', auth.uid(), quem.nome, quem.papel,
            'Prioridade: ' || (rot ->> d.prioridade) || ' → ' || (rot ->> p_prioridade));

    -- o videomaker fica sabendo quando o vídeo dele sobe de prioridade
    if p_prioridade in ('alta', 'urgente') and d.videomaker_id is not null and d.videomaker_id <> auth.uid()
       and d.editing_status in ('pendente', 'em_edicao', 'correcao') then
      insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, alvo_id, payload, processado_em)
      values ('video.prioridade', 'video.prioridade:' || d.id || ':' || p_prioridade || ':' || extract(epoch from now())::bigint,
              d.client_id, 'demanda_edicao', d.id, jsonb_build_object('prioridade', p_prioridade), now())
      on conflict (chave) do nothing returning id into evid;
      if evid is not null then
        insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
        select evid, p.id, d.client_id, 'video.prioridade',
               case p_prioridade when 'urgente' then 'Vídeo urgente na sua fila' else 'Vídeo com prioridade alta' end,
               '"' || public.notif_corta(coalesce(nullif(d.titulo, ''), d.codigo, 'Vídeo'), 90) || '"' ||
                 case p_prioridade when 'urgente' then ' passou na frente: edite este primeiro.' else ' subiu na sua fila.' end,
               '#/video/' || d.id
          from public.perfis p where p.id = d.videomaker_id and p.estado = 'ativa'
        on conflict (evento_id, destinatario_id) do nothing;
      end if;
    end if;
  end if;
end $$;
revoke all on function public.video_priorizar(uuid, text, double precision) from public, anon;
grant execute on function public.video_priorizar(uuid, text, double precision) to authenticated;
