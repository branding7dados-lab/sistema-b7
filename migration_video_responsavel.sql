-- =========================================================================
-- B7 VÍDEO — RESPONSÁVEL DA PLANILHA VIRA ATRIBUIÇÃO DE VERDADE
-- =========================================================================
-- Mesmo padrão de bug já encontrado e corrigido para prioridade: a
-- coluna "Responsável" da planilha (quem edita cada vídeo) sempre foi
-- capturada, mas só virava texto dentro de observações
-- ("Responsável (planilha): KAIQUE") — nunca foi usada pra atribuir a
-- demanda de verdade a um videomaker (campo videomaker_id). Isso vale
-- tanto para as 367 demandas já importadas quanto — até esta correção
-- — para qualquer importação nova.
--
-- Nomes reais encontrados na planilha (731 linhas): KAIQUE (348),
-- LUIS (181), KEVIN (130), MATHEUS (38), KAIQUE E KEVIN (8, os dois
-- juntos), EMANUEL (4). Você confirmou que hoje só Kevin e Kaique são
-- videomakers oficiais no sistema; Matheus é freelancer, cadastrado
-- manualmente quando você precisa dele. Luis e Emanuel não foram
-- confirmados como usuários atuais.
--
-- Por isso o casamento de nome NUNCA inventa usuário: ele só atribui
-- quando o primeiro nome do texto da planilha bate exatamente com o
-- primeiro nome de um perfil que já existe no sistema e é elegível
-- como videomaker (papel videomaker OU função extra videomaker). Sem
-- usuário cadastrado com aquele nome — casos de Luis, Matheus e
-- Emanuel até que você os cadastre —, a demanda fica sem responsável,
-- listada por video_demandas_responsavel_nao_confiavel() pra revisão
-- manual. Nunca chuta e nunca cria usuário sozinho.
--
-- Caso "KAIQUE E KEVIN" (responsável duplo — 8 linhas): o texto real
-- cita Kaique primeiro, mas por decisão sua (Kevin, explicitamente)
-- essas 8 linhas vão pro Kevin — uma exceção nomeada, não uma regra
-- genérica de "primeiro nome do texto" (que aqui daria Kaique).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Achar o videomaker certo a partir do texto livre da planilha.
--    "KAIQUE" -> Kaique. "LUIS" -> sem usuário cadastrado com esse
--    nome hoje -> sem correspondência (revisão manual). Casa pelo
--    PRIMEIRO NOME do perfil (perfis.nome pode ter sobrenome; a
--    planilha só tem o primeiro nome) — comparação exata, sem
--    acento/maiúscula, nunca aproximada.
--    Exceção nomeada: texto que cita "kaique" e "kevin" juntos (nessa
--    ordem ou na outra) atribui ao Kevin — decisão sua, não uma regra
--    de "quem vem primeiro" (o texto real cita Kaique primeiro).
-- ---------------------------------------------------------------------
create or replace function public.video_achar_videomaker_por_responsavel(p_responsavel text)
returns uuid
language sql stable security definer set search_path = public as $$
  with entrada as (
    select lower(btrim(coalesce(p_responsavel, ''))) as texto
  ),
  duplo_kaique_kevin as (
    select p.id
      from public.perfis p, entrada e
     where e.texto like '%kaique%' and e.texto like '%kevin%'
       and p.estado = 'ativa'
       and public.eh_videomaker_elegivel(p.id)
       and lower(btrim(split_part(btrim(p.nome), ' ', 1))) = 'kevin'
     limit 1
  ),
  simples as (
    select p.id
      from public.perfis p, entrada e
     where e.texto <> ''
       and not (e.texto like '%kaique%' and e.texto like '%kevin%')
       and p.estado = 'ativa'
       and public.eh_videomaker_elegivel(p.id)
       and lower(btrim(split_part(btrim(p.nome), ' ', 1))) = e.texto
     limit 1
  )
  select coalesce((select id from duplo_kaique_kevin), (select id from simples));
$$;
revoke all on function public.video_achar_videomaker_por_responsavel(text) from public;
grant execute on function public.video_achar_videomaker_por_responsavel(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Importações NOVAS: video_import_confirmar_linha passa a tentar
--    casar dados_originais->>'responsavel' (agora salvo pelo parser do
--    frontend) com um videomaker existente, e preenche videomaker_id
--    na criação — sem sobrescrever nada que já existia, porque a
--    demanda ainda não existe nesse ponto (é a criação).
-- ---------------------------------------------------------------------
create or replace function public.video_import_confirmar_linha(p_linha_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; lote public.demandas_edicao_import_lotes%rowtype;
  novo uuid; ano int; mes int; prazo date; ator public.perfis%rowtype;
  status_planilha text; status_final text; titulo_final text; codigo_final text; entregue timestamptz;
  prioridade_planilha text; prioridade_final text; responsavel_planilha text; videomaker_achado uuid;
begin
  if auth.uid() is not null and not public.sou_equipe() then
    raise exception 'Só a equipe confirma importações.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if l.confirmada then return l.demanda_id; end if;
  if not l.resolvida or l.cliente_id is null then
    raise exception 'Esta linha ainda tem pendências — resolva o cliente antes de confirmar.';
  end if;
  select * into lote from public.demandas_edicao_import_lotes where id = l.lote_id;
  select * into ator from public.perfis where id = auth.uid();

  ano := coalesce(nullif(l.dados_originais->>'ano', '')::int, extract(year from now())::int);
  mes := coalesce(nullif(l.dados_originais->>'mes', '')::int, extract(month from now())::int);
  begin
    prazo := nullif(l.dados_originais->>'prazo', '')::date;
  exception when others then prazo := null; end;

  codigo_final := coalesce(l.dados_originais->>'codigo', '');
  titulo_final := nullif(btrim(l.dados_originais->>'titulo'), '');
  if titulo_final is null then
    titulo_final := case when coalesce(btrim(codigo_final), '') <> ''
      then 'Sem título (planilha) — código ' || btrim(codigo_final)
      else 'Sem título (planilha)' end;
  end if;

  status_planilha := nullif(btrim(l.dados_originais->>'status'), '');
  status_final := case
    when status_planilha in ('pendente','em_edicao','correcao','standby','entregue','descartado')
      then status_planilha
    else 'pendente'
  end;
  entregue := case when status_final = 'entregue' then now() else null end;

  prioridade_planilha := nullif(btrim(l.dados_originais->>'prioridade'), '');
  prioridade_final := case
    when prioridade_planilha ~* 'urgente' then 'urgente'
    when prioridade_planilha ~* 'alta' then 'alta'
    else 'normal'
  end;

  responsavel_planilha := nullif(btrim(l.dados_originais->>'responsavel'), '');
  videomaker_achado := case when responsavel_planilha is not null
    then public.video_achar_videomaker_por_responsavel(responsavel_planilha) else null end;

  insert into public.demandas_edicao
    (client_id, videomaker_id, competencia_ano, competencia_mes, codigo, titulo, pacote, prazo, observacoes,
     origem, import_lote_id, criado_por, editing_status, entregue_em, prioridade)
  values
    (l.cliente_id, videomaker_achado, ano, mes, codigo_final,
     titulo_final,
     coalesce(l.dados_originais->>'pacote', ''), prazo, coalesce(l.dados_originais->>'observacoes', ''),
     'importacao', l.lote_id, auth.uid(), status_final, entregue, prioridade_final)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', status_final, auth.uid(), ator.nome, ator.papel, 'Importada da planilha "' || coalesce(lote.nome_arquivo, '') || '"');

  update public.demandas_edicao_import_linhas set confirmada = true, demanda_id = novo where id = p_linha_id;

  return novo;
end;
$$;
revoke all on function public.video_import_confirmar_linha(uuid) from public;
grant execute on function public.video_import_confirmar_linha(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Backfill das demandas JÁ IMPORTADAS (as 367 atuais e qualquer
--    outra que já exista sem responsável). Só preenche onde
--    videomaker_id está NULO hoje — nunca sobrescreve uma atribuição
--    que já foi feita manualmente por alguém depois da importação.
--    Fonte, nessa ordem: dados_originais->>'responsavel' (importações
--    a partir deste build) e, quando não existir, o texto
--    "Responsável (planilha): X" já preservado dentro de observações
--    (todas as importações anteriores a este build).
-- ---------------------------------------------------------------------
create or replace function public.video_backfill_responsavel()
returns table(demanda_id uuid, titulo text, responsavel_planilha text, videomaker_id uuid, videomaker_nome text)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.sou_equipe() then
    raise exception 'Só a equipe roda o backfill de responsável.' using errcode = '42501';
  end if;

  return query
  with fonte as (
    select l.demanda_id as did,
           nullif(btrim(coalesce(l.dados_originais->>'responsavel', '')), '') as resp_fonte
      from public.demandas_edicao_import_linhas l
     where l.demanda_id is not null
  ),
  fonte_completa as (
    select d.id as did,
           coalesce(f.resp_fonte,
                    btrim((regexp_match(d.observacoes, 'Responsável \(planilha\):\s*([^·]+)'))[1]))
             as resp_fonte
      from public.demandas_edicao d
      left join fonte f on f.did = d.id
     where d.origem = 'importacao' and d.videomaker_id is null and d.deleted_at is null
  ),
  casado as (
    select fc.did, fc.resp_fonte, public.video_achar_videomaker_por_responsavel(fc.resp_fonte) as vm_id
      from fonte_completa fc
     where fc.resp_fonte is not null
  ),
  aplicavel as (
    select c.did, c.resp_fonte, c.vm_id
      from casado c
     where c.vm_id is not null
  ),
  aplicado as (
    /* só atribui quem é o responsável — o status de cada demanda já
       veio certo da própria coluna STATUS da planilha (corrigido no
       build 2026-09-14-d); atribuir responsável não é o mesmo que
       "começou a editar agora", então editing_status não muda aqui. */
    update public.demandas_edicao d
       set videomaker_id = a.vm_id, updated_at = now()
      from aplicavel a
     where d.id = a.did
    returning d.id, d.titulo, a.resp_fonte, a.vm_id
  )
  select a.id, a.titulo, a.resp_fonte, a.vm_id, p.nome
    from aplicado a
    left join public.perfis p on p.id = a.vm_id;
end;
$$;
revoke all on function public.video_backfill_responsavel() from public;
grant execute on function public.video_backfill_responsavel() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Relatório do que NÃO foi possível atribuir — nome na planilha,
--    mas sem usuário elegível cadastrado com esse primeiro nome (ex.:
--    Luis, Matheus, Emanuel, até que você os cadastre como
--    videomaker). Não altera nada; só lista, pra você decidir: cadastra
--    o usuário e roda o backfill de novo, ou atribui manualmente pela
--    tela.
-- ---------------------------------------------------------------------
create or replace function public.video_demandas_responsavel_nao_confiavel()
returns table(demanda_id uuid, titulo text, cliente_nome text, responsavel_planilha text)
language sql stable security definer set search_path = public as $$
  with fonte as (
    select l.demanda_id as did,
           nullif(btrim(coalesce(l.dados_originais->>'responsavel', '')), '') as resp_fonte
      from public.demandas_edicao_import_linhas l
     where l.demanda_id is not null
  ),
  fonte_completa as (
    select d.id as did,
           coalesce(f.resp_fonte,
                    btrim((regexp_match(d.observacoes, 'Responsável \(planilha\):\s*([^·]+)'))[1]))
             as resp_fonte
      from public.demandas_edicao d
      left join fonte f on f.did = d.id
     where d.origem = 'importacao' and d.videomaker_id is null and d.deleted_at is null
  )
  select d.id, d.titulo, cl.nome, fc.resp_fonte
    from fonte_completa fc
    join public.demandas_edicao d on d.id = fc.did
    left join public.clientes cl on cl.id = d.client_id
   where fc.resp_fonte is not null
     and public.video_achar_videomaker_por_responsavel(fc.resp_fonte) is null
     and (auth.uid() is null or public.sou_equipe())
   order by cl.nome, d.titulo;
$$;
revoke all on function public.video_demandas_responsavel_nao_confiavel() from public;
grant execute on function public.video_demandas_responsavel_nao_confiavel() to authenticated;
