-- =====================================================================
-- KANBAN v2 — uma demanda por material, ajustes agregados, mover seguro
--
-- Rode DEPOIS de migration_push.sql e ANTES de migration_rls.sql.
-- Aditiva e idempotente: repetir não causa dano. Nada é apagado.
--
-- O que muda e por quê:
--
--  • Vínculo ativo único. Um roteiro (ou linha, conteúdo, gravação) tem
--    NO MÁXIMO uma demanda ativa no quadro. É o que garante que cinco
--    pedidos de ajuste do mesmo ciclo caem na MESMA demanda, em vez de
--    virar cinco cards soltos. Antes de criar o índice há uma fase
--    diagnóstica: se já existirem duplicatas em produção, a migration
--    lista todas e NÃO cria o índice — a equipe decide qual arquivar.
--
--  • kanban_resumo passa a trazer o que o card precisa sem uma volta ao
--    banco por card: contagem de ajustes pendentes da aprovação ativa
--    (cenas em 'ajustes' + comentários do cliente ainda abertos na
--    versão ativa), título e versão da aprovação, nome e logo do
--    cliente, nome do responsável. O texto do roteiro continua morando
--    no roteiro.
--
--  • kanban_mover(id, coluna, posicao): mover é a operação mais
--    frequente do quadro. Coluna, posição, concluida_em e histórico
--    entram numa transação só, com a permissão conferida no banco
--    (equipe), e a linha volta para a tela confirmar.
--
--  • Ajuste por cena move a demanda. aprov_processar_evento (v2) só
--    muda de coluna com a decisão do material inteiro; um pedido de
--    ajuste em uma cena deixava o card em "Aguardando cliente". Um
--    trigger em eventos_dominio — o mesmo evento durável — leva a
--    demanda para "Ajustes" (e devolve para "Aguardando cliente" quando
--    o cliente retira o pedido e não sobra nada pendente). Se o card já
--    estava em Ajustes quando o cliente recusou o todo, o mesmo trigger
--    anota o motivo e sobe a prioridade. Nenhuma função da v2 é alterada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DIAGNÓSTICO + VÍNCULO ATIVO ÚNICO
-- ---------------------------------------------------------------------
do $$
declare dup record; n int := 0;
begin
  for dup in
    select tipo_vinculo, vinculo_id, count(*) as qtd, array_agg(id order by created_at) as ids
      from public.kanban_demandas
     where tipo_vinculo is not null and tipo_vinculo <> 'avulsa' and vinculo_id is not null
       and arquivada_em is null and deleted_at is null and concluida_em is null
     group by tipo_vinculo, vinculo_id having count(*) > 1
  loop
    n := n + 1;
    raise warning 'Kanban: % demandas ativas para % % — ids %', dup.qtd, dup.tipo_vinculo, dup.vinculo_id, dup.ids;
  end loop;

  if n > 0 then
    raise warning 'Kanban: % material(is) com mais de uma demanda ativa. O índice único NÃO foi criado. Arquive ou conclua as duplicatas (nada foi apagado) e rode esta migration de novo. Sugestão para conferir: select id, titulo, coluna, created_at from public.kanban_demandas where tipo_vinculo = ''<tipo>'' and vinculo_id = ''<id>'' and arquivada_em is null and deleted_at is null and concluida_em is null;', n;
  elsif not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'kanban_vinculo_ativo_unico') then
    create unique index kanban_vinculo_ativo_unico
      on public.kanban_demandas (tipo_vinculo, vinculo_id)
      where tipo_vinculo is not null and tipo_vinculo <> 'avulsa' and vinculo_id is not null
        and arquivada_em is null and deleted_at is null and concluida_em is null;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. VIEW kanban_resumo — o que o card mostra, numa consulta só
-- ---------------------------------------------------------------------
drop view if exists public.kanban_resumo;
create view public.kanban_resumo
with (security_invoker = true) as
select d.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo,
       p.nome as responsavel_nome,
       p.avatar_url as responsavel_avatar,
       (select count(*) from public.kanban_comentarios k
         where k.demanda_id = d.id and k.resolvido_em is null) as comentarios_abertos,
       a.versao as aprovacao_versao,
       a.tipo as aprovacao_tipo,
       case when a.id is not null then public.aprov_titulo(a) end as aprovacao_titulo,
       a.decidido_em as aprovacao_decidida_em,
       /* cenas da versão ativa em que o cliente pediu ajuste */
       coalesce((select count(*) from public.aprovacao_partes pp
                  where pp.aprovacao_id = a.id and pp.situacao = 'ajustes'), 0) as partes_ajustes,
       /* comentários do cliente ainda abertos na versão ativa, fora os que
          pertencem a uma cena já decidida (em ajustes conta pela cena;
          aprovada não é mais pendência) */
       coalesce((select count(*) from public.comentarios cm
                  where cm.aprovacao_id = a.id and cm.autor_papel = 'cliente'
                    and coalesce(cm.resolvido, false) = false
                    and not exists (select 1 from public.aprovacao_partes pp
                                     where pp.aprovacao_id = a.id and pp.situacao <> 'pendente'
                                       and pp.parte_id = cm.parte_id)), 0) as comentarios_cliente,
       coalesce((select count(*) from public.aprovacao_partes pp
                  where pp.aprovacao_id = a.id and pp.situacao = 'ajustes'), 0)
       + coalesce((select count(*) from public.comentarios cm
                  where cm.aprovacao_id = a.id and cm.autor_papel = 'cliente'
                    and coalesce(cm.resolvido, false) = false
                    and not exists (select 1 from public.aprovacao_partes pp
                                     where pp.aprovacao_id = a.id and pp.situacao <> 'pendente'
                                       and pp.parte_id = cm.parte_id)), 0) as ajustes_pendentes,
       (select max(cm.created_at) from public.comentarios cm
         where cm.aprovacao_id = a.id and cm.autor_papel = 'cliente') as ultimo_feedback_em
from public.kanban_demandas d
left join public.clientes c on c.id = d.client_id
left join public.perfis p on p.id = d.responsavel_id
left join public.aprovacoes a on a.id = d.aprovacao_id and a.deleted_at is null;
grant select on public.kanban_resumo to authenticated;

-- ---------------------------------------------------------------------
-- 3. kanban_mover — coluna + posição + histórico numa transação
-- ---------------------------------------------------------------------
create or replace function public.kanban_mover(p_id uuid, p_coluna text, p_posicao double precision default null)
returns public.kanban_demandas language plpgsql security definer set search_path = public as $$
declare d public.kanban_demandas; ator public.perfis; pos double precision;
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe move demandas do quadro.' using errcode = '42501';
  end if;
  if p_coluna not in ('a_fazer', 'producao', 'revisao', 'aguardando_cliente', 'ajustes', 'pronto', 'concluida') then
    raise exception 'Coluna inválida: %', p_coluna;
  end if;

  select * into d from public.kanban_demandas where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Demanda não encontrada.' using errcode = 'P0002'; end if;

  select * into ator from public.perfis where id = auth.uid();

  /* sem posição informada: entra no fim da coluna de destino */
  pos := p_posicao;
  if pos is null then
    select coalesce(max(posicao), 0) + 1000 into pos from public.kanban_demandas
     where coluna = p_coluna and deleted_at is null and arquivada_em is null and id <> p_id;
  end if;

  if d.coluna <> p_coluna then
    insert into public.kanban_historico (demanda_id, autor_id, autor_nome, de, para, campo)
    values (d.id, ator.id, ator.nome, d.coluna, p_coluna, 'coluna');
  end if;

  update public.kanban_demandas
     set coluna = p_coluna, posicao = pos,
         concluida_em = case when p_coluna = 'concluida' then coalesce(concluida_em, now()) else null end,
         updated_at = now()
   where id = p_id
   returning * into d;
  return d;
end $$;
revoke all on function public.kanban_mover(uuid, text, double precision) from public;
grant execute on function public.kanban_mover(uuid, text, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- 4. AJUSTE POR CENA → coluna "Ajustes" (trigger no evento durável)
-- ---------------------------------------------------------------------
create or replace function public.kanban_reagir_evento()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes; d record; restam int; n int := 0; titulo text;
begin
  if new.tipo not in ('parte.ajustes', 'parte.aprovada', 'aprovacao.ajustes', 'aprovacao.recusada') then return new; end if;
  select * into a from public.aprovacoes where id = new.aprovacao_id;
  if not found then return new; end if;

  if new.tipo in ('aprovacao.ajustes', 'aprovacao.recusada') then
    /* a demanda já estava em Ajustes por causa de uma cena: a decisão do
       todo não muda de coluna, então aprov_processar_evento não anota o
       motivo nem sobe a prioridade da recusa. Fazemos isso aqui, só
       nesse caso — quando a coluna muda, é a v2 que cuida. */
    for d in select * from public.kanban_demandas
              where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id and coluna = 'ajustes'
                and deleted_at is null and arquivada_em is null and not automacao_travada
    loop
      update public.kanban_demandas
         set origem_evento = new.tipo,
             prioridade = case when new.tipo = 'aprovacao.recusada' then 'alta' else prioridade end,
             descricao = case when coalesce(a.motivo, '') <> ''
                              then left('[' || case when new.tipo = 'aprovacao.recusada' then 'RECUSADO' else 'AJUSTES' end ||
                                   ' v' || a.versao || '] ' || a.motivo || E'\n\n' || coalesce(descricao, ''), 4000)
                              else descricao end,
             updated_at = now()
       where id = d.id;
    end loop;
    return new;
  end if;

  if new.tipo = 'parte.ajustes' then
    for d in select * from public.kanban_demandas
              where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id
                and deleted_at is null and arquivada_em is null
    loop
      n := n + 1;
      if d.automacao_travada or d.coluna in ('concluida', 'ajustes') then continue; end if;
      update public.kanban_demandas
         set coluna = 'ajustes', origem_evento = new.tipo, aprovacao_id = a.id,
             aprovacao_situacao = a.situacao, updated_at = now()
       where id = d.id;
      insert into public.kanban_historico (demanda_id, autor_id, autor_nome, de, para, campo)
      values (d.id, new.ator_id, coalesce(new.ator_nome, 'Cliente') || ' (aprovação)', d.coluna, 'ajustes', 'coluna');
    end loop;

    /* nenhuma demanda ligada (arquivada, concluída antes da hora): cria uma */
    if n = 0 then
      titulo := public.aprov_titulo(a);
      insert into public.kanban_demandas (titulo, coluna, client_id, tipo_vinculo, vinculo_id, tipo,
                                          origem_evento, aprovacao_id, aprovacao_situacao, criado_por)
      values (titulo, 'ajustes', a.client_id, a.tipo, a.alvo_id, 'ajuste', new.tipo, a.id, a.situacao, a.enviado_por);
    end if;

  else
    /* o cliente retirou o pedido de uma cena: se não sobrou nada pendente e
       foi a automação que trouxe o card para Ajustes, ele volta a esperar */
    select count(*) into restam from public.aprovacao_partes
     where aprovacao_id = a.id and situacao = 'ajustes';
    if restam > 0 or a.situacao not in ('pendente', 'parcial') then return new; end if;
    for d in select * from public.kanban_demandas
              where tipo_vinculo = a.tipo and vinculo_id = a.alvo_id and aprovacao_id = a.id
                and coluna = 'ajustes' and origem_evento = 'parte.ajustes'
                and deleted_at is null and arquivada_em is null and not automacao_travada
    loop
      update public.kanban_demandas
         set coluna = 'aguardando_cliente', origem_evento = new.tipo, updated_at = now()
       where id = d.id;
      insert into public.kanban_historico (demanda_id, autor_id, autor_nome, de, para, campo)
      values (d.id, new.ator_id, coalesce(new.ator_nome, 'Cliente') || ' (aprovação)', 'ajustes', 'aguardando_cliente', 'coluna');
    end loop;
  end if;
  return new;
exception when others then
  /* a decisão do cliente nunca cai por causa do quadro: fica registrado
     no evento para reprocessar */
  raise warning 'kanban_reagir_evento: %', SQLERRM;
  return new;
end $$;
revoke all on function public.kanban_reagir_evento() from public;

drop trigger if exists kanban_evento_parte on public.eventos_dominio;
create trigger kanban_evento_parte after insert on public.eventos_dominio
  for each row execute function public.kanban_reagir_evento();

-- ---------------------------------------------------------------------
-- 5. REALTIME — o quadro acompanha o banco sem recarregar
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe aqui: nada a fazer (normal fora do Supabase).';
    return;
  end if;
  foreach t in array array['kanban_demandas', 'kanban_comentarios']
  loop
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select 'migration_kanban_v2 aplicada' as resultado;
