-- =========================================================================
-- B7 VÍDEO — CÓDIGO SEQUENCIAL POR GRAVAÇÃO PARA "GERAR DEMANDAS DE
-- EDIÇÃO A PARTIR DE UMA GRAVAÇÃO" (Objetivo 2, 23/09/2026)
-- =========================================================================
-- Contexto da auditoria: o fluxo de gerar 1 demanda de edição por
-- roteiro marcado de uma gravação JÁ EXISTIA por inteiro antes desta
-- migration — botão "Gerar de gravação" (js/video.js, modalGerarDemandas),
-- função public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date)
-- (migration_video_gestao.sql) e a trava de duplicidade por roteiro
-- (unique index demandas_edicao_roteiro_unico, mesma migration). Esse
-- fluxo já cobre corretamente: seletor de gravação, checklist de
-- roteiros com os que já têm demanda vindo desabilitados/marcados,
-- "1 roteiro selecionado = 1 demanda" como comportamento padrão, título
-- da demanda vindo do título do roteiro (nunca da gravação), e status
-- inicial igual ao de sempre (via video_criar_demanda, sem mudança
-- nenhuma aqui). NADA disso é recriado nesta migration.
--
-- O que faltava e esta migration resolve: as demandas geradas por esse
-- fluxo sempre nasciam com codigo = '' (video_gerar_demandas_de_gravacao
-- nunca passava um p_codigo). Não existia nenhuma numeração "#1, #2,
-- #3..." por gravação. Esta migration é ADITIVA: uma tabela nova
-- (contador por gravação) + uma função nova (próximo código, atômica) +
-- video_gerar_demandas_de_gravacao recriada com a MESMA assinatura
-- (uuid, uuid[], uuid, date) — só o corpo muda, nenhuma chamada
-- existente no frontend quebra. video_criar_demanda (usada também pela
-- criação manual, "+ Nova demanda") não é alterada: continua aceitando
-- p_codigo livre, texto, opcional, exatamente como hoje — demandas
-- criadas manualmente sem gravação continuam sem nenhum código
-- automático, como sempre foi.
--
-- Demandas antigas/importadas (origem = 'importacao' ou manuais sem
-- gravação) NUNCA passam por esta numeração nova e seus códigos
-- existentes NUNCA são tocados — a tabela de contador só é escrita pela
-- função nova, chamada só a partir de video_gerar_demandas_de_gravacao.
-- =========================================================================

-- -------------------------------------------------------------------
-- 1) CONTADOR POR GRAVAÇÃO
-- -------------------------------------------------------------------
-- Uma linha por gravação, com o último número já alocado. Fonte de
-- verdade única e persistida — o próximo código NUNCA vem de contagem
-- de linhas, índice de array ou ordem visual no navegador.
create table if not exists public.gravacoes_demandas_seq (
  gravacao_id  uuid primary key references public.gravacoes(id) on delete cascade,
  ultimo_numero integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.gravacoes_demandas_seq enable row level security;

-- Só leitura para a equipe interna (depuração/relatório futuro); toda
-- escrita acontece só dentro da função security definer abaixo — não
-- há necessidade (nem policy) de insert/update direto por um usuário
-- comum via PostgREST.
drop policy if exists "gravacoes_demandas_seq select" on public.gravacoes_demandas_seq;
create policy "gravacoes_demandas_seq select" on public.gravacoes_demandas_seq
  for select using (public.sou_equipe_interna());

-- -------------------------------------------------------------------
-- 2) PRÓXIMO CÓDIGO — ATÔMICO, SEGURO CONTRA CONCORRÊNCIA
-- -------------------------------------------------------------------
-- INSERT ... ON CONFLICT DO UPDATE é atômico por linha no Postgres: a
-- primeira transação a chegar cria a linha do contador (ou pega o lock
-- de linha dela, se já existir) e qualquer transação concorrente para a
-- MESMA gravação fica bloqueada até a primeira confirmar — nunca duas
-- transações enxergam o mesmo "último número" ao mesmo tempo. Isso vale
-- tanto para duplo clique/reenvio do mesmo usuário quanto para dois
-- usuários internos diferentes gerando demandas para a mesma gravação
-- ao mesmo tempo. Gravações diferentes têm linhas diferentes na tabela
-- e nunca disputam o mesmo lock — cada uma começa (e continua) sua
-- própria sequência independente em #1.
-- Formato de saída: EXATAMENTE '#' + inteiro (ex.: '#17'). Nunca
-- reaproveita número: mesmo que a demanda criada com aquele número seja
-- descartada/excluída depois, o contador nunca volta para trás.
create or replace function public._video_proximo_codigo_gravacao(p_gravacao_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_numero int;
begin
  insert into public.gravacoes_demandas_seq (gravacao_id, ultimo_numero, updated_at)
  values (p_gravacao_id, 1, now())
  on conflict (gravacao_id) do update
    set ultimo_numero = public.gravacoes_demandas_seq.ultimo_numero + 1,
        updated_at = now()
  returning ultimo_numero into v_numero;

  return '#' || v_numero::text;
end;
$$;
revoke all on function public._video_proximo_codigo_gravacao(uuid) from public;
-- Chamada só de dentro de video_gerar_demandas_de_gravacao (também
-- security definer) — não precisa ser executável direto por
-- 'authenticated', mas conceder não adiciona risco real (a função só
-- consome um número da sequência de uma gravação existente, não expõe
-- nem altera nenhum outro dado) e evita depender de uma cadeia de
-- privilégios frágil caso algo mude no futuro.
grant execute on function public._video_proximo_codigo_gravacao(uuid) to authenticated;

-- -------------------------------------------------------------------
-- 3) video_gerar_demandas_de_gravacao — RECRIADA (MESMA ASSINATURA)
-- -------------------------------------------------------------------
-- Comportamento preservado por inteiro: 1 demanda por roteiro marcado,
-- roteiro que já tem demanda ativa não gera outra (devolve a
-- existente, ja_existia = true), título vem do roteiro. O que muda:
--   a) toda demanda NOVA criada por esta função ganha o próximo código
--      "#N" da gravação (em vez de codigo = '');
--   b) o retorno passa a incluir também o código (novo ou já
--      existente), para a tela mostrar os códigos finais só depois da
--      criação ter sido confirmada no banco — nunca antes;
--   c) cada roteiro é processado em seu próprio sub-bloco com exceção
--      capturada: se duas requisições concorrentes disputarem o MESMO
--      roteiro (janela entre o "já existe?" e o insert), o índice único
--      demandas_edicao_roteiro_unico recusa a segunda tentativa com
--      unique_violation — em vez de abortar o lote inteiro com um erro
--      cru, essa tentativa é tratada como "já existia" e o código da
--      demanda que realmente ganhou a corrida é devolvido. Isso é
--      exatamente o comportamento pedido para duplo clique/retry/duas
--      pessoas gerando ao mesmo tempo: nenhuma linha duplicada, nenhum
--      código duplicado, e o lote inteiro não falha por causa de UM
--      roteiro em disputa.
-- Assinatura idêntica à original (uuid, uuid[], uuid, date) — só o
-- retorno (nova coluna "codigo") e o corpo mudam. Como o tipo de
-- retorno muda, precisa de DROP antes do CREATE (o Postgres recusa
-- "create or replace" quando o RETURNS TABLE muda de colunas).
drop function if exists public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date);

create function public.video_gerar_demandas_de_gravacao(
  p_gravacao_id uuid, p_roteiro_ids uuid[], p_videomaker_id uuid default null, p_prazo date default null
) returns table (roteiro_id uuid, demanda_id uuid, codigo text, ja_existia boolean)
language plpgsql security definer set search_path = public as $$
declare
  g public.gravacoes%rowtype; r public.roteiros%rowtype; rid uuid;
  existente public.demandas_edicao%rowtype; nova uuid; codigo_novo text;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe gera demandas de edição.' using errcode = '42501';
  end if;
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then raise exception 'Gravação não encontrada.'; end if;

  foreach rid in array coalesce(p_roteiro_ids, '{}') loop
    select * into r from public.roteiros where id = rid and recording_session_id = p_gravacao_id and deleted_at is null;
    if not found then continue; end if;

    select de.* into existente from public.demandas_edicao de
      where de.roteiro_id = rid and de.deleted_at is null and de.editing_status <> 'descartado'
      limit 1;

    if existente.id is not null then
      roteiro_id := rid; demanda_id := existente.id; codigo := nullif(existente.codigo, ''); ja_existia := true;
      return next;
      continue;
    end if;

    -- Sub-bloco próprio: um unique_violation aqui (roteiro que acabou
    -- de ganhar uma demanda em outra requisição concorrente, entre o
    -- select acima e este insert) não derruba o lote inteiro — só este
    -- roteiro cai para o caminho "já existia".
    begin
      codigo_novo := public._video_proximo_codigo_gravacao(p_gravacao_id);
      nova := public.video_criar_demanda(
        g.client_id, coalesce(nullif(btrim(r.titulo), ''), g.nome), codigo_novo,
        extract(year from coalesce(p_prazo, g.data_gravacao, now()))::int,
        extract(month from coalesce(p_prazo, g.data_gravacao, now()))::int,
        p_gravacao_id, p_videomaker_id, '', p_prazo, coalesce(r.objetivo, ''),
        p_roteiro_id => rid
      );
      roteiro_id := rid; demanda_id := nova; codigo := codigo_novo; ja_existia := false;
      return next;
    exception when unique_violation then
      select de.* into existente from public.demandas_edicao de
        where de.roteiro_id = rid and de.deleted_at is null and de.editing_status <> 'descartado'
        limit 1;
      roteiro_id := rid;
      demanda_id := existente.id;
      codigo := nullif(existente.codigo, '');
      ja_existia := true;
      return next;
    end;
  end loop;
end;
$$;
revoke all on function public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date) from public;
grant execute on function public.video_gerar_demandas_de_gravacao(uuid, uuid[], uuid, date) to authenticated;
