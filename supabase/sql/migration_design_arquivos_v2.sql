/* =====================================================================
   B7 DESIGN — ARQUIVOS 2.0: arte por slide/frame, revisão por parte,
   arquivo efetivo atual, aprovação coerente.

   Migração ADITIVA sobre migration_design.sql + migration_design_refino.sql
   + migration_design_thumb.sql. Não apaga versão, arquivo, peça, Kanban
   nem histórico. Só acrescenta colunas e funções, e recria (mesmo nome)
   as funções que precisavam entender a nova estrutura.

   O que muda de fato:
     1. design_arquivos ganha o vínculo com a parte canônica da peça
        (slide do Carrossel / frame do Story): parte_tipo + parte_id
        (id ESTÁVEL da tabela slides/frames — nunca índice de array) +
        parte_posicao (posição canônica no momento do upload, só pra
        ordenar arquivo antigo se o slide sumir da linha). Peça de arte
        única (Card, Capa de Reel, Story de 1 frame) continua com
        parte_id nulo — um slot só, sem "Slide 01" artificial.
     2. design_arquivos ganha largura/altura (medidas no navegador na
        hora do upload — a prévia grande usa a proporção real) e a
        decisão de revisão POR ARQUIVO (revisao / revisao_mensagem /
        revisado_por / revisado_em): "Aprovar slide" e "Solicitar ajuste
        neste slide" gravam aqui. Comentário solto NÃO é ajuste: só a
        decisão formal muda `revisao`.
     3. design_arquivos_efetivos(peça): o "arquivo efetivo atual" de
        cada parte — o preview mais recente de uma versão JÁ ENVIADA
        (rascunho nunca conta; upload que falhou nunca chega a ser
        registrado). É o que o ZIP do Carrossel usa: Slide 01 pode
        continuar na V01 enquanto o Slide 03 já está na V02.
     4. design_versao_enviar: quando a peça tem partes canônicas E o
        designer está usando o upload estruturado, exige que TODA parte
        tenha arquivo — desta versão ou herdado de uma versão anterior
        (o designer só reenvia o que mudou). A mensagem diz quais slides
        faltam. Via externa continua sem exigir arquivo nenhum.
     5. design_parte_revisar: decisão por arquivo (idempotente).
        design_revisao_fechar: fecha a revisão da versão inteira a partir
        das decisões por parte — tudo aprovado → aprovação interna;
        algum ajuste → UMA solicitação de ajuste agrupada (uma
        notificação só, com a lista de slides). design_aprovar_interno
        ganha a trava: não aprova se alguma parte efetiva está com
        ajuste pendente.

   Arquivos antigos (sem parte_id) continuam onde estão e continuam
   acessíveis — a interface mostra como "arquivos anteriores (sem slide
   vinculado)". Nada é remapeado às cegas por ordem de upload.
   ===================================================================== */

-- ---------------------------------------------------------------------
-- 1. COLUNAS NOVAS EM design_arquivos
-- ---------------------------------------------------------------------
alter table public.design_arquivos add column if not exists parte_tipo text;          -- 'slide' | 'frame' | null
alter table public.design_arquivos add column if not exists parte_id uuid;            -- slides.id / frames.id (estável)
alter table public.design_arquivos add column if not exists parte_posicao int;        -- posição canônica no upload
alter table public.design_arquivos add column if not exists largura int;
alter table public.design_arquivos add column if not exists altura int;
alter table public.design_arquivos add column if not exists revisao text;             -- null | 'aprovado' | 'ajuste'
alter table public.design_arquivos add column if not exists revisao_mensagem text;
alter table public.design_arquivos add column if not exists revisado_por uuid references public.perfis(id) on delete set null;
alter table public.design_arquivos add column if not exists revisado_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'design_arquivo_parte_tipo_valido') then
    alter table public.design_arquivos add constraint design_arquivo_parte_tipo_valido
      check (parte_tipo is null or parte_tipo in ('slide', 'frame'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'design_arquivo_revisao_valida') then
    alter table public.design_arquivos add constraint design_arquivo_revisao_valida
      check (revisao is null or revisao in ('aprovado', 'ajuste'));
  end if;
end $$;

create index if not exists design_arquivo_parte on public.design_arquivos (parte_id) where parte_id is not null;

-- ---------------------------------------------------------------------
-- 2. REGISTRAR ARQUIVO — agora com parte + dimensões
--    (assinatura muda: a de 7 parâmetros de migration_design_thumb.sql
--    sai, senão a chamada fica ambígua)
-- ---------------------------------------------------------------------
drop function if exists public.design_arquivo_registrar(uuid, text, text, text, text, bigint, text);

create or replace function public.design_arquivo_registrar(
  p_versao_id uuid, p_papel text, p_nome text, p_caminho text, p_mime text, p_tamanho bigint,
  p_caminho_thumb text default null,
  p_parte_tipo text default null, p_parte_id uuid default null, p_parte_posicao int default null,
  p_largura int default null, p_altura int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; novo uuid; pos int;
begin
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para enviar arquivos nesta peça.' using errcode = '42501';
  end if;
  if v.estado not in ('rascunho') then
    raise exception 'Esta versão já foi enviada; crie uma nova versão para novos arquivos.';
  end if;
  if p_papel not in ('preview', 'producao', 'anexo', 'final') then
    raise exception 'Papel de arquivo inválido.';
  end if;
  if p_parte_tipo is not null and p_parte_tipo not in ('slide', 'frame') then
    raise exception 'Tipo de parte inválido.';
  end if;
  /* a parte precisa existir de verdade no conteúdo canônico desta peça —
     nunca aceita um id de slide de outro conteúdo */
  if p_parte_id is not null then
    if p_parte_tipo = 'slide' and not exists (select 1 from public.slides s where s.id = p_parte_id and s.content_id = d.conteudo_id) then
      raise exception 'Slide não pertence a esta peça.';
    end if;
    if p_parte_tipo = 'frame' and not exists (select 1 from public.frames f where f.id = p_parte_id and f.content_id = d.conteudo_id) then
      raise exception 'Story não pertence a esta peça.';
    end if;
  end if;

  select coalesce(max(posicao), -1) + 1 into pos from public.design_arquivos where versao_id = v.id and papel = p_papel;

  insert into public.design_arquivos (versao_id, papel, posicao, nome_original, caminho, mime, tamanho_bytes, enviado_por,
                                      caminho_thumb, parte_tipo, parte_id, parte_posicao, largura, altura)
  values (v.id, p_papel, pos, p_nome, p_caminho, p_mime, p_tamanho, auth.uid(),
          p_caminho_thumb, p_parte_tipo, p_parte_id, p_parte_posicao, p_largura, p_altura)
  returning id into novo;
  return novo;
end;
$$;
revoke all on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint, text, text, uuid, int, int, int) from public;
grant execute on function public.design_arquivo_registrar(uuid, text, text, text, text, bigint, text, text, uuid, int, int, int) to authenticated;

/* substituir arquivo ainda em rascunho (o designer trocou a arte do
   Slide 03 antes de enviar): remove só o registro do rascunho — o
   objeto no Storage fica (a política de delete do Storage é só da
   equipe), o novo upload entra com caminho próprio. Nunca apaga arquivo
   de versão já enviada. */
create or replace function public.design_arquivo_remover_rascunho(p_arquivo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.design_arquivos%rowtype; v public.design_versoes%rowtype; d public.design_deliverables%rowtype;
begin
  select * into a from public.design_arquivos where id = p_arquivo_id for update;
  if not found then return; end if;
  select * into v from public.design_versoes where id = a.versao_id;
  select * into d from public.design_deliverables where id = v.deliverable_id;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if v.estado <> 'rascunho' then
    raise exception 'Arquivo de versão já enviada não pode ser removido.';
  end if;
  delete from public.design_arquivos where id = a.id;
end;
$$;
revoke all on function public.design_arquivo_remover_rascunho(uuid) from public;
grant execute on function public.design_arquivo_remover_rascunho(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ARQUIVO EFETIVO ATUAL POR PARTE
--    security INVOKER de propósito: a RLS de design_arquivos continua
--    valendo — quem não enxerga a peça não enxerga arquivo nenhum.
-- ---------------------------------------------------------------------
create or replace function public.design_arquivos_efetivos(p_deliverable_id uuid)
returns setof public.design_arquivos language sql stable security invoker set search_path = public as $$
  select distinct on (coalesce(a.parte_id::text, '_')) a.*
    from public.design_arquivos a
    join public.design_versoes v on v.id = a.versao_id
   where v.deliverable_id = p_deliverable_id
     and a.papel = 'preview'
     and v.estado <> 'rascunho'
   order by coalesce(a.parte_id::text, '_'), v.numero desc, a.posicao desc, a.created_at desc
$$;
grant execute on function public.design_arquivos_efetivos(uuid) to authenticated;

/* partes canônicas de uma peça, na ORDEM da Linha Editorial (position),
   com id estável — a fonte da ordem do navegador e do ZIP */
create or replace function public.design_partes_canonicas(p_deliverable_id uuid)
returns table (parte_tipo text, parte_id uuid, posicao int, rotulo text)
language sql stable security invoker set search_path = public as $$
  /* posicao = índice 0..n-1 na ordem canônica (row_number, não o valor
     bruto de `position`) — bate com o que a interface rotula e com o
     parte_posicao que o upload grava */
  select 'slide', s.id, (row_number() over (order by s.position, s.created_at) - 1)::int, s.titulo
    from public.design_deliverables d join public.slides s on s.content_id = d.conteudo_id
   where d.id = p_deliverable_id and d.tipo = 'carrossel'
  union all
  select 'frame', f.id, (row_number() over (order by f.position, f.created_at) - 1)::int, f.texto
    from public.design_deliverables d join public.frames f on f.content_id = d.conteudo_id
   where d.id = p_deliverable_id and d.tipo = 'stories'
  order by 3
$$;
grant execute on function public.design_partes_canonicas(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ENVIAR PARA REVISÃO — valida a completude quando o upload é
--    estruturado por parte (arquivo herdado de versão anterior conta)
-- ---------------------------------------------------------------------
create or replace function public.design_versao_enviar(
  p_versao_id uuid, p_observacao text default '',
  p_via text default 'upload', p_canal text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
        qtd_arquivos int; qtd_partes int; k uuid; via_final text; faltam text; nome_parte text;
begin
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  if not (public.sou_equipe() or d.designer_id = auth.uid()) then
    raise exception 'Sem permissão para enviar esta peça para revisão.' using errcode = '42501';
  end if;
  if v.estado <> 'rascunho' then
    raise exception 'Esta versão já foi enviada.';
  end if;

  via_final := case when p_via = 'externa' then 'externa' else 'upload' end;

  select count(*) into qtd_arquivos from public.design_arquivos where versao_id = v.id;
  select count(*) into qtd_partes from public.design_arquivos where versao_id = v.id and parte_id is not null;

  if via_final = 'upload' then
    /* upload estruturado por parte: nesta versão OU herdado de versão já
       enviada (o designer não reenvia slide que não mudou) */
    if qtd_partes > 0 then
      nome_parte := case when d.tipo = 'stories' then 'Stories' else 'Slides' end;
      select string_agg(lpad((pc.posicao + 1)::text, 2, '0'), ' e ' order by pc.posicao) into faltam
        from public.design_partes_canonicas(d.id) pc
       where not exists (select 1 from public.design_arquivos a
                           where a.versao_id = v.id and a.parte_id = pc.parte_id and a.papel = 'preview')
         and not exists (select 1 from public.design_arquivos a join public.design_versoes vv on vv.id = a.versao_id
                           where vv.deliverable_id = d.id and vv.estado <> 'rascunho'
                             and a.parte_id = pc.parte_id and a.papel = 'preview');
      if faltam is not null then
        raise exception 'Faltam arquivos nos %: %.', nome_parte, replace(faltam, ' e ', ', ');
      end if;
    /* versão sem arquivo próprio: aceita se a peça já tem arquivo
       efetivo (reenvio só com observação não faz sentido, mas também
       não deve travar quem reenvia depois de um ajuste por fora) */
    elsif qtd_arquivos = 0 and not exists (select 1 from public.design_arquivos_efetivos(d.id)) then
      raise exception 'Envie ao menos um arquivo, ou registre que a arte foi revisada por fora (ex.: WhatsApp).';
    end if;
  end if;

  select * into ator from public.perfis where id = auth.uid();

  update public.design_versoes
     set estado = 'enviada', observacao = coalesce(p_observacao, ''), enviada_em = now(), updated_at = now(),
         via = via_final, canal_externo = case when via_final = 'externa' then nullif(btrim(coalesce(p_canal, '')), '') else null end
   where id = v.id;

  update public.design_deliverables
     set status = 'revisao_interna', versao_atual = v.numero, updated_at = now()
   where id = d.id;

  if d.kanban_id is null then
    insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo, responsavel_id, prazo, criado_por, origem_evento)
    values (d.titulo, 'revisao', d.client_id, 'design_deliverable', d.id, 'design', d.designer_id, d.prazo, auth.uid(), 'design.versao_enviada')
    returning id into k;
    update public.design_deliverables set kanban_id = k where id = d.id;
  else
    update public.kanban_demandas set coluna = 'revisao', origem_evento = 'design.versao_enviada', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.versao_enviada', 'design.versao_enviada:' || v.id, 'design_deliverable', d.id, v.numero, d.client_id,
          auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'titulo', d.titulo,
                             'via', via_final, 'canal_externo', case when via_final = 'externa' then nullif(btrim(coalesce(p_canal, '')), '') else null end,
                             'partes_enviadas', (select coalesce(jsonb_agg(lpad((a.parte_posicao + 1)::text, 2, '0') order by a.parte_posicao), '[]'::jsonb)
                                                   from public.design_arquivos a where a.versao_id = v.id and a.parte_id is not null and a.papel = 'preview')));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.versao_enviada:' || v.id));
end;
$$;
revoke all on function public.design_versao_enviar(uuid, text, text, text) from public;
grant execute on function public.design_versao_enviar(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. DECISÃO POR PARTE (arquivo) — idempotente; só sobre o arquivo
--    efetivo de uma peça em revisão interna
-- ---------------------------------------------------------------------
create or replace function public.design_parte_revisar(p_arquivo_id uuid, p_decisao text, p_mensagem text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.design_arquivos%rowtype; v public.design_versoes%rowtype; d public.design_deliverables%rowtype;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe revisa internamente.' using errcode = '42501'; end if;
  if p_decisao not in ('aprovado', 'ajuste', 'pendente') then raise exception 'Decisão inválida.'; end if;
  if p_decisao = 'ajuste' and coalesce(btrim(p_mensagem), '') = '' then raise exception 'Descreva o ajuste deste slide.'; end if;

  select * into a from public.design_arquivos where id = p_arquivo_id for update;
  if not found then raise exception 'Arquivo não encontrado.' using errcode = 'P0002'; end if;
  select * into v from public.design_versoes where id = a.versao_id;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  if d.status <> 'revisao_interna' then raise exception 'Esta peça não está em revisão interna.'; end if;
  if d.designer_id = auth.uid() then raise exception 'Quem produziu a peça não pode revisá-la.' using errcode = '42501'; end if;
  if not exists (select 1 from public.design_arquivos_efetivos(d.id) e where e.id = a.id) then
    raise exception 'Este arquivo não é a versão atual desta parte.';
  end if;

  update public.design_arquivos
     set revisao = case when p_decisao = 'pendente' then null else p_decisao end,
         revisao_mensagem = case when p_decisao = 'ajuste' then btrim(p_mensagem) else null end,
         revisado_por = case when p_decisao = 'pendente' then null else auth.uid() end,
         revisado_em  = case when p_decisao = 'pendente' then null else now() end
   where id = a.id;
end;
$$;
revoke all on function public.design_parte_revisar(uuid, text, text) from public;
grant execute on function public.design_parte_revisar(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. APROVAÇÃO INTERNA — trava contra estado contraditório
-- ---------------------------------------------------------------------
create or replace function public.design_aprovar_interno(p_versao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype; pendentes text;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe aprova internamente.' using errcode = '42501'; end if;

  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'enviada' then raise exception 'Esta versão não está aguardando revisão interna.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  select * into ator from public.perfis where id = auth.uid();

  select string_agg(lpad((coalesce(e.parte_posicao, 0) + 1)::text, 2, '0'), ', ' order by e.parte_posicao) into pendentes
    from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.revisao = 'ajuste';
  if pendentes is not null then
    raise exception 'Não dá pra aprovar: ainda há ajuste pendente no(s) slide(s) %.', pendentes;
  end if;

  /* aprovar a peça aprova de tabela toda parte efetiva ainda sem decisão */
  update public.design_arquivos a set revisao = 'aprovado', revisado_por = auth.uid(), revisado_em = now()
   where a.id in (select e.id from public.design_arquivos_efetivos(d.id) e where e.revisao is null);

  update public.design_versoes
     set estado = 'aprovada_interna', aprovada_em = now(), aprovada_por = auth.uid(), updated_at = now()
   where id = v.id;
  update public.design_deliverables set status = 'aprovado_interno', updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'pronto', origem_evento = 'design.aprovado_interno', updated_at = now() where id = d.kanban_id;
  end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.aprovado_interno', 'design.aprovado_interno:' || v.id, 'design_deliverable', d.id, v.numero,
          d.client_id, auth.uid(), ator.nome, ator.papel, jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'titulo', d.titulo));
  perform public.design_processar_evento((select id from public.eventos_dominio where chave = 'design.aprovado_interno:' || v.id));
end;
$$;
revoke all on function public.design_aprovar_interno(uuid) from public;
grant execute on function public.design_aprovar_interno(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. FECHAR A REVISÃO DA VERSÃO A PARTIR DAS DECISÕES POR PARTE
--    algum ajuste  → UMA solicitação de ajuste agrupada (1 notificação)
--    tudo aprovado → aprovação interna
--    parte sem decisão → erro dizendo quais
-- ---------------------------------------------------------------------
create or replace function public.design_revisao_fechar(p_versao_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v public.design_versoes%rowtype; d public.design_deliverables%rowtype; ator public.perfis%rowtype;
        qtd_ajuste int; qtd_pendente int; lista text; detalhe text; msg text; nome_parte text; v_chave text; total int;
begin
  if not public.sou_equipe() then raise exception 'Só a equipe revisa internamente.' using errcode = '42501'; end if;
  select * into v from public.design_versoes where id = p_versao_id for update;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  if v.estado <> 'enviada' then raise exception 'Esta versão não está em revisão interna.'; end if;
  select * into d from public.design_deliverables where id = v.deliverable_id for update;
  if d.designer_id = auth.uid() then raise exception 'Quem produziu a peça não pode revisá-la.' using errcode = '42501'; end if;

  select count(*) filter (where e.revisao = 'ajuste'), count(*) filter (where e.revisao is null), count(*)
    into qtd_ajuste, qtd_pendente, total
    from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null;

  nome_parte := case when d.tipo = 'stories' then 'story' else 'slide' end;

  if qtd_ajuste = 0 then
    if qtd_pendente > 0 then
      select string_agg(lpad((e.parte_posicao + 1)::text, 2, '0'), ', ' order by e.parte_posicao) into lista
        from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.revisao is null;
      raise exception 'Ainda sem decisão: % %.', nome_parte, lista;
    end if;
    perform public.design_aprovar_interno(v.id);
    return 'aprovado';
  end if;

  select string_agg(lpad((e.parte_posicao + 1)::text, 2, '0'), ' e ' order by e.parte_posicao),
         string_agg(initcap(nome_parte) || ' ' || lpad((e.parte_posicao + 1)::text, 2, '0') || ': ' || coalesce(e.revisao_mensagem, ''), E'\n' order by e.parte_posicao)
    into lista, detalhe
    from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.revisao = 'ajuste';
  if qtd_ajuste > 2 then lista := replace(lista, ' e ', ', '); end if;
  msg := qtd_ajuste || ' ' || nome_parte || (case when qtd_ajuste = 1 then ' precisa' else 's precisam' end) ||
         ' de alterações: ' || lista || '.' || E'\n' || detalhe;

  select * into ator from public.perfis where id = auth.uid();
  update public.design_versoes set estado = 'ajuste_solicitado', updated_at = now() where id = v.id;
  update public.design_deliverables set status = 'ajustes', updated_at = now() where id = d.id;
  if d.kanban_id is not null then
    update public.kanban_demandas set coluna = 'ajustes', origem_evento = 'design.ajuste_solicitado', updated_at = now() where id = d.kanban_id;
  end if;

  v_chave := 'design.ajuste_solicitado:' || v.id || ':' || now()::text;
  insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, versao, client_id, ator_id, ator_nome, ator_papel, payload)
  values ('design.ajuste_solicitado', v_chave, 'design_deliverable', d.id, v.numero,
          d.client_id, auth.uid(), ator.nome, ator.papel,
          jsonb_build_object('versao_id', v.id, 'numero', v.numero, 'mensagem', msg, 'titulo', d.titulo, 'agrupado', true,
                             'partes', (select coalesce(jsonb_agg(jsonb_build_object('posicao', e.parte_posicao + 1, 'mensagem', e.revisao_mensagem) order by e.parte_posicao), '[]'::jsonb)
                                          from public.design_arquivos_efetivos(d.id) e where e.parte_id is not null and e.revisao = 'ajuste')));
  perform public.design_processar_evento((select ed.id from public.eventos_dominio ed where ed.chave = v_chave order by created_at desc limit 1));
  return 'ajustes';
end;
$$;
revoke all on function public.design_revisao_fechar(uuid) from public;
grant execute on function public.design_revisao_fechar(uuid) to authenticated;
