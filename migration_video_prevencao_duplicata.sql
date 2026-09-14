-- =========================================================================
-- B7 VÍDEO — TRAVA CONTRA REIMPORTAÇÃO DUPLICADA
-- =========================================================================
-- Você reimportou a mesma planilha (as mesmas 731 linhas) e o sistema
-- criou 367 demandas novas, duplicando as 367 que já existiam — não
-- havia nenhuma checagem contra isso. video_import_criar_lote agora
-- sinaliza como "possível duplicata" qualquer linha cujo cliente
-- (resolvido) + código + título já bate com uma demanda ativa existente
-- vinda de importação — a linha fica pendente de revisão (mesmo
-- mecanismo já usado pra "cliente não encontrado"), em vez de virar
-- uma demanda nova silenciosamente. Selecionar o cliente de novo na
-- tela de importação (mesmo que seja o mesmo cliente) confirma que é
-- intencional e libera a linha.
-- =========================================================================

create or replace function public.video_import_criar_lote(p_nome_arquivo text, p_linhas jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  lote uuid; linha jsonb; nome_planilha text; cid uuid; probs text[];
  total int := 0; ok int := 0; erro int := 0; i int := 0;
  codigo_linha text; titulo_linha text;
begin
  if auth.uid() is not null and not public.sou_equipe() then
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

    -- Possível duplicata: já existe uma demanda ATIVA, vinda de
    -- importação, do MESMO cliente com o mesmo código e o mesmo título
    -- (ou, quando código e título vieram vazios os dois, mesmo cliente +
    -- código igual com o título de reserva "Sem título (planilha)..." já
    -- usado por outra linha — sinal mais fraco, mas melhor que nada).
    if cid is not null then
      codigo_linha := btrim(coalesce(linha->>'codigo', ''));
      titulo_linha := btrim(coalesce(linha->>'titulo', ''));
      if exists (
        select 1 from public.demandas_edicao d
         where d.deleted_at is null and d.origem = 'importacao' and d.client_id = cid
           and coalesce(btrim(d.codigo), '') = codigo_linha
           and (
             (titulo_linha <> '' and lower(btrim(d.titulo)) = lower(titulo_linha))
             or (titulo_linha = '' and codigo_linha <> '' and d.titulo like 'Sem título (planilha)%')
           )
      ) then
        probs := array_append(probs, 'possivel_duplicata');
      end if;
    end if;

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

-- video_import_resolver_linha passa a limpar também 'possivel_duplicata'
-- (selecionar o cliente de novo, mesmo que seja o mesmo, é o jeito de
-- confirmar "sim, quero mesmo criar esta linha de novo").
create or replace function public.video_import_resolver_linha(p_linha_id uuid, p_cliente_id uuid, p_lembrar_apelido boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare l public.demandas_edicao_import_linhas%rowtype; n int := 0;
begin
  if auth.uid() is not null and not public.sou_equipe() then
    raise exception 'Só a equipe resolve linhas de importação.' using errcode = '42501';
  end if;
  select * into l from public.demandas_edicao_import_linhas where id = p_linha_id;
  if not found then raise exception 'Linha não encontrada.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente inválido.';
  end if;

  with alvo as (
    select id from public.demandas_edicao_import_linhas
     where lote_id = l.lote_id
       and confirmada = false
       and lower(btrim(cliente_nome_planilha)) = lower(btrim(l.cliente_nome_planilha))
  )
  update public.demandas_edicao_import_linhas d
     set cliente_id = p_cliente_id,
         problemas = array_remove(array_remove(d.problemas, 'cliente_nao_encontrado'), 'possivel_duplicata'),
         resolvida = (array_remove(array_remove(d.problemas, 'cliente_nao_encontrado'), 'possivel_duplicata') = '{}')
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
