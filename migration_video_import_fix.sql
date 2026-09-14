-- =========================================================================
-- migration_video_import_fix.sql
-- Corrige a importação de planilha do B7 Vídeo contra o arquivo real do
-- cliente (731 linhas, 38 clientes, cabeçalho em português com sinônimos,
-- linha de lixo antes do cabeçalho de verdade — tratado no frontend em
-- js/video.js). Três problemas reais encontrados ao testar com a planilha
-- real, corrigidos aqui:
--
--  1) video_import_criar_lote bloqueava linhas sem título (problema
--     "sem_titulo"), mas video_import_confirmar_linha já tem um fallback
--     de título que resolve isso sozinho — o bloqueio era desnecessário e
--     forçava resolução manual de 81 linhas que já tinham resolução
--     automática. Removido.
--
--  2) video_import_resolver_linha resolvia UMA linha por vez, sem aplicar
--     a mesma resolução (e o apelido aprendido) às outras linhas do MESMO
--     lote com o mesmo nome de cliente na planilha. Numa planilha real,
--     um cliente pode aparecer 100+ vezes — exigiria resolver a mesma
--     coisa 100+ vezes. Agora resolve todas as linhas irmãs de uma vez.
--
--  3) video_import_confirmar_linha ignorava o status vindo da planilha
--     (frontend já manda dados_originais->>'status') e sempre criava a
--     demanda como "pendente" — o que marcaria 704 linhas já "ENTREGUE"
--     na planilha real como pendentes. Agora valida e usa o status da
--     planilha, com fallback para "pendente", e marca entregue_em quando
--     o status resultante é "entregue". O título de fallback também passa
--     a citar o código quando existir, para ficar identificável.
--
-- Aplicar depois de migration_video.sql e migration_video_kanban.sql.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) video_import_criar_lote — não bloquear mais por falta de título
-- ---------------------------------------------------------------------
create or replace function public.video_import_criar_lote(p_nome_arquivo text, p_linhas jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  lote uuid; linha jsonb; nome_planilha text; cid uuid; probs text[];
  total int := 0; ok int := 0; erro int := 0; i int := 0;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe importa planilhas.' using errcode = '42501';
  end if;

  insert into public.demandas_edicao_import_lotes (nome_arquivo, formato, status, criado_por)
  values (p_nome_arquivo, 'csv', 'processando', auth.uid())
  returning id into lote;

  for linha in select * from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    total := total + 1;
    probs := '{}';
    nome_planilha := btrim(coalesce(linha->>'cliente', ''));
    cid := null;

    if nome_planilha = '' then
      probs := array_append(probs, 'sem_nome_de_cliente');
    else
      select c.id into cid from public.clientes c where lower(btrim(c.nome)) = lower(nome_planilha) limit 1;
      if cid is null then
        select a.cliente_id into cid from public.clientes_import_aliases a where lower(btrim(a.alias)) = lower(nome_planilha) limit 1;
      end if;
      if cid is null then probs := array_append(probs, 'cliente_nao_encontrado'); end if;
    end if;
    -- "sem_titulo" não bloqueia mais: video_import_confirmar_linha já
    -- preenche um título de fallback identificável (com o código, quando
    -- existir) para linhas que vieram sem título na planilha.

    insert into public.demandas_edicao_import_linhas
      (lote_id, linha_numero, dados_originais, cliente_nome_planilha, cliente_id, problemas, resolvida)
    values
      (lote, i, linha, nome_planilha, cid, probs, array_length(probs, 1) is null);

    if array_length(probs, 1) is null then ok := ok + 1; else erro := erro + 1; end if;
  end loop;

  update public.demandas_edicao_import_lotes
     set total_linhas = total, linhas_ok = ok, linhas_erro = erro,
         status = case when erro = 0 then 'concluido' else 'com_erros' end
   where id = lote;

  return lote;
end;
$$;
revoke all on function public.video_import_criar_lote(text, jsonb) from public;
grant execute on function public.video_import_criar_lote(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2) video_import_resolver_linha — resolve também as linhas irmãs do
--    mesmo lote com o mesmo nome de cliente na planilha
--    (o tipo de retorno muda de void para int, então o Postgres exige
--    dropar a função antiga antes de recriar)
-- ---------------------------------------------------------------------
drop function if exists public.video_import_resolver_linha(uuid, uuid, boolean);
create or replace function public.video_import_resolver_linha(p_linha_id uuid, p_cliente_id uuid, p_lembrar_apelido boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; n int := 0;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe resolve linhas de importação.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente inválido.';
  end if;

  -- Resolve a própria linha e todas as outras linhas não resolvidas do
  -- MESMO lote com o mesmo nome de cliente na planilha (mesmo texto,
  -- ignorando maiúsculas/minúsculas e espaços nas pontas) — evita ter que
  -- resolver o mesmo cliente dezenas ou centenas de vezes numa planilha
  -- real com muitas linhas repetidas.
  with alvo as (
    select id from public.demandas_edicao_import_linhas
     where lote_id = l.lote_id
       and confirmada = false
       and lower(btrim(cliente_nome_planilha)) = lower(btrim(l.cliente_nome_planilha))
  )
  update public.demandas_edicao_import_linhas d
     set cliente_id = p_cliente_id,
         problemas = array_remove(d.problemas, 'cliente_nao_encontrado'),
         resolvida = (array_remove(d.problemas, 'cliente_nao_encontrado') = '{}')
    from alvo
   where d.id = alvo.id;
  get diagnostics n = row_count;

  if p_lembrar_apelido and coalesce(btrim(l.cliente_nome_planilha), '') <> '' then
    insert into public.clientes_import_aliases (alias, cliente_id, criado_por)
    values (btrim(l.cliente_nome_planilha), p_cliente_id, auth.uid())
    on conflict (lower(btrim(alias))) do update set cliente_id = excluded.cliente_id;
  end if;

  return n;
end;
$$;
revoke all on function public.video_import_resolver_linha(uuid, uuid, boolean) from public;
grant execute on function public.video_import_resolver_linha(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3) video_import_confirmar_linha — honra o status vindo da planilha e
--    melhora o título de fallback (cita o código, se houver)
-- ---------------------------------------------------------------------
create or replace function public.video_import_confirmar_linha(p_linha_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; lote public.demandas_edicao_import_lotes%rowtype;
  novo uuid; ano int; mes int; prazo date; ator public.perfis%rowtype;
  status_planilha text; status_final text; titulo_final text; codigo_final text; entregue timestamptz;
begin
  if not public.sou_equipe() then
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

  -- O status já vem interpretado do frontend (js/video.js) em
  -- dados_originais->>'status', usando os mesmos valores de editing_status.
  -- Valida contra o enum antes de usar, com "pendente" como fallback seguro.
  status_planilha := nullif(btrim(l.dados_originais->>'status'), '');
  status_final := case
    when status_planilha in ('pendente','em_edicao','correcao','standby','entregue','descartado')
      then status_planilha
    else 'pendente'
  end;
  entregue := case when status_final = 'entregue' then now() else null end;

  insert into public.demandas_edicao
    (client_id, competencia_ano, competencia_mes, codigo, titulo, pacote, prazo, observacoes,
     origem, import_lote_id, criado_por, editing_status, entregue_em)
  values
    (l.cliente_id, ano, mes, codigo_final,
     titulo_final,
     coalesce(l.dados_originais->>'pacote', ''), prazo, coalesce(l.dados_originais->>'observacoes', ''),
     'importacao', l.lote_id, auth.uid(), status_final, entregue)
  returning id into novo;

  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', status_final, auth.uid(), ator.nome, ator.papel, 'Importada da planilha "' || coalesce(lote.nome_arquivo, '') || '"');

  update public.demandas_edicao_import_linhas set confirmada = true, demanda_id = novo where id = p_linha_id;

  return novo;
end;
$$;
revoke all on function public.video_import_confirmar_linha(uuid) from public;
grant execute on function public.video_import_confirmar_linha(uuid) to authenticated;

-- video_import_confirmar_lote não muda — continua chamando
-- video_import_confirmar_linha para cada linha resolvida e não confirmada.

-- ---------------------------------------------------------------------
-- FIM — migration_video_import_fix.sql
-- ---------------------------------------------------------------------
