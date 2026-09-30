-- Fase 7 — núcleo da sincronização (estado FINAL no banco, exportado com
-- pg_get_functiondef). Aplicado em partes pelas migrations
-- oportunidades_sync_nucleo, oportunidades_sync_robustez e
-- oportunidades_duplicatas_refino (o passo 4 usa op_candidato_duplicata,
-- de migration_oportunidades_duplicatas.sql — rode aquele antes deste).
-- Rodar de novo é seguro (create or replace).

CREATE OR REPLACE FUNCTION public.op_item_valido(it jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce((it->>'duracao')::int, 1) between 1 and 31
     and ((it->>'tipo_data') <> 'fixa' or ((it->>'mes')::int between 1 and 12 and (it->>'dia')::int between 1 and 31))
$function$
;

CREATE OR REPLACE FUNCTION public.oportunidades_aplicar_lote(p_fonte text, p_itens jsonb, p_erro text DEFAULT NULL::text, p_disparo text DEFAULT 'cron'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  f public.oportunidade_fontes%rowtype;
  v_exec bigint; n int; it jsonb; v_op uuid; v_chave text; v_nome text; v_ref text; v_dup uuid;
  c_criados int := 0; c_atual int := 0; c_vinc int := 0; c_rev int := 0; d jsonb; v_pal text;
  v_refs text[] := '{}';
begin
  select * into f from public.oportunidade_fontes where id = p_fonte for update;
  if not found then raise exception 'Fonte desconhecida: %', p_fonte; end if;
  insert into public.oportunidade_sync_execucoes (fonte_id, status, disparo) values (p_fonte, 'executando', p_disparo) returning id into v_exec;

  if p_erro is not null then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'falha', erro = left(p_erro, 500) where id = p_fonte;
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'falha', erro = left(p_erro, 500) where id = v_exec;
    return jsonb_build_object('status', 'falha', 'erro', p_erro);
  end if;

  n := coalesce(jsonb_array_length(p_itens), 0);
  if n = 0 or (coalesce(f.itens_referencia, 0) >= 10 and n < f.itens_referencia * 0.5) then
    update public.oportunidade_fontes set ultima_tentativa = now(), status = 'suspeita', itens_ultimo = n,
      erro = format('Lote suspeito: %s itens (normal: %s). Nada foi alterado.', n, coalesce(f.itens_referencia::text, '?')) where id = p_fonte;
    update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'suspeita', buscados = n,
      erro = 'lote vazio ou muito menor que o normal — dados locais preservados' where id = v_exec;
    return jsonb_build_object('status', 'suspeita', 'itens', n, 'referencia', f.itens_referencia);
  end if;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_ref := it->>'referencia'; v_nome := btrim(it->>'nome');
    if v_ref is null or coalesce(v_nome, '') = '' or not public.op_item_valido(it) then continue; end if;
    /* data precisa ser válida: sem data, o item não entra */
    if (it->>'tipo_data') = 'fixa' and ((it->>'mes') is null or (it->>'dia') is null) then continue; end if;
    if (it->>'tipo_data') = 'regra' and coalesce(it->>'regra', '') = '' then continue; end if;
    if (it->>'tipo_data') = 'datas' and coalesce(jsonb_array_length(it->'datas'), 0) = 0 then continue; end if;
    v_refs := v_refs || v_ref;
    v_chave := public.op_normalizar(v_nome);
    v_op := null; v_dup := null;

    /* 1) já visto nesta fonte (idempotência) */
    select oportunidade_id into v_op from public.oportunidade_provas where fonte_id = p_fonte and referencia = v_ref;
    if v_op is not null then
      c_atual := c_atual + 1;
    else
      /* 2) mesmo nome/alias canônico */
      select id into v_op from public.oportunidades o
       where o.chave = v_chave or v_chave = any (select public.op_normalizar(a) from unnest(o.aliases) a)
          or o.chave = any (select public.op_normalizar(a) from unnest(coalesce(array(select jsonb_array_elements_text(it->'aliases')), '{}')) a)
       limit 1;
      /* 3) mesma data fixa + palavra-chave em português informada pelo adaptador */
      if v_op is null and (it->>'tipo_data') = 'fixa' and jsonb_array_length(coalesce(it->'palavras_pt', '[]')) > 0 then
        select o.id into v_op from public.oportunidades o
         where o.tipo_data = 'fixa' and o.mes = (it->>'mes')::int and o.dia = (it->>'dia')::int and o.ativo
           and exists (select 1 from jsonb_array_elements_text(it->'palavras_pt') p where o.chave like '%' || public.op_normalizar(p) || '%')
         order by o.criado_em limit 1;
      end if;
      if v_op is not null then
        c_vinc := c_vinc + 1;
      else
        /* 4) dúvida: mesma data + categoria em comum → cria para revisão */
        if (it->>'tipo_data') = 'fixa' then
          v_dup := public.op_candidato_duplicata(v_nome, (it->>'mes')::int, (it->>'dia')::int, p_fonte, it->'palavras_pt');
        elsif (it->>'tipo_data') = 'datas' then
          v_dup := public.op_candidato_duplicata(v_nome, extract(month from (it->'datas'->0->>'data')::date)::int,
                     extract(day from (it->'datas'->0->>'data')::date)::int, p_fonte, it->'palavras_pt');
        end if;
        /* chave única: se colidir, desambigua pela fonte (não funde) */
        if exists (select 1 from public.oportunidades where chave = v_chave) then v_chave := v_chave || ' ' || p_fonte; end if;
        insert into public.oportunidades (chave, nome, aliases, descricao, tipo_data, mes, dia, regra, duracao_dias, natureza, abrangencia,
          categorias, tags, geral, confiabilidade, revisao, possivel_duplicata_de, verificado_em, sincronizado_em)
        values (v_chave, v_nome, coalesce(array(select jsonb_array_elements_text(it->'aliases')), '{}'), it->>'descricao',
          it->>'tipo_data', (it->>'mes')::int, (it->>'dia')::int, it->>'regra', coalesce((it->>'duracao')::int, 1),
          coalesce(it->>'natureza', 'comemorativa'), coalesce(it->>'abrangencia', 'nacional'),
          coalesce(array(select jsonb_array_elements_text(it->'categorias')), '{}'),
          coalesce(array(select distinct public.op_normalizar(x) from jsonb_array_elements_text(coalesce(it->'tags', '[]')) x), '{}'),
          coalesce((it->>'geral')::boolean, false),
          /* fonte secundária nunca cria "Oficial" */
          case when f.autoridade = 'secundaria' and (it->>'confiabilidade') = 'oficial' then 'pendente' else coalesce(it->>'confiabilidade', 'pendente') end,
          case when v_dup is not null then 'revisar' else 'ok' end, v_dup, now(), now())
        returning id into v_op;
        c_criados := c_criados + 1;
        if v_dup is not null then c_rev := c_rev + 1; end if;
      end if;
    end if;

    /* prova (proveniência) — idempotente */
    insert into public.oportunidade_provas (oportunidade_id, fonte_id, referencia, titulo_na_fonte, url, detalhe, visto_em, ativo)
      values (v_op, p_fonte, v_ref, coalesce(it->>'titulo_na_fonte', v_nome), it->>'url', it->>'detalhe', now(), true)
    on conflict (fonte_id, referencia) do update set titulo_na_fonte = excluded.titulo_na_fonte,
      url = coalesce(excluded.url, public.oportunidade_provas.url), detalhe = coalesce(excluded.detalhe, public.oportunidade_provas.detalhe),
      visto_em = now(), ativo = true;

    /* fonte oficial eleva a confiabilidade (nunca rebaixa); marca sincronização */
    update public.oportunidades set
      confiabilidade = case when f.autoridade = 'oficial' and (it->>'confiabilidade') = 'oficial' then 'oficial'
                            when confiabilidade = 'pendente' and (it->>'confiabilidade') = 'verificada' and f.autoridade <> 'secundaria' then 'verificada'
                            else confiabilidade end,
      categorias = (select array(select distinct x from unnest(categorias || coalesce(array(select jsonb_array_elements_text(it->'categorias')), '{}')) x)),
      sincronizado_em = now(), verificado_em = case when f.autoridade = 'oficial' then now() else verificado_em end, atualizado_em = now()
     where id = v_op;

    /* datas por ano (feriados móveis, datas de um ano só) */
    for d in select * from jsonb_array_elements(coalesce(it->'datas', '[]')) loop
      insert into public.oportunidade_datas (oportunidade_id, data, data_fim, fonte_id)
        values (v_op, (d->>'data')::date, nullif(d->>'data_fim', '')::date, p_fonte)
      on conflict (oportunidade_id, data) do update set data_fim = excluded.data_fim;
    end loop;
  end loop;

  /* o que a fonte deixou de trazer: prova inativa (revisão), nada apagado */
  update public.oportunidade_provas set ativo = false where fonte_id = p_fonte and ativo and referencia <> all (v_refs);

  update public.oportunidade_fontes set ultima_tentativa = now(), ultimo_sucesso = now(), status = 'ok', erro = null,
    itens_ultimo = n, itens_referencia = case when itens_referencia is null then n else round(itens_referencia * 0.5 + n * 0.5) end,
    criados_ultimo = c_criados, atualizados_ultimo = c_atual + c_vinc
   where id = p_fonte;
  update public.oportunidade_sync_execucoes set terminado_em = now(), status = 'ok', buscados = n, criados = c_criados,
    atualizados = c_atual, vinculados = c_vinc, para_revisao = c_rev where id = v_exec;
  return jsonb_build_object('status', 'ok', 'itens', n, 'criados', c_criados, 'atualizados', c_atual, 'vinculados', c_vinc, 'revisar', c_rev);
end $function$
;

CREATE OR REPLACE FUNCTION public.oportunidades_posso_sincronizar()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.sou_admin() $function$
;

revoke all on function public.oportunidades_aplicar_lote(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.oportunidades_aplicar_lote(text, jsonb, text, text) to service_role;
revoke all on function public.oportunidades_posso_sincronizar() from public, anon;
grant execute on function public.oportunidades_posso_sincronizar() to authenticated;
