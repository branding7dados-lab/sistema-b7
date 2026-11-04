-- =====================================================================
-- PORTAL DO CLIENTE v2 — janelas de leitura do portal
--
-- Aditiva e idempotente. Rode DEPOIS de migration_push.sql e ANTES de
-- migration_rls.sql (ver migration_tudo.sql). Repetir não causa dano.
--
-- O que nasce aqui:
--   1. gravacoes.visivel_cliente — a equipe libera uma gravação para o
--      portal de propósito; existir no banco não torna nada visível.
--   2. Três views que o portal (e a prévia "Visualizar como cliente")
--      leem. Elas encodam as MESMAS regras de visibilidade que o RLS
--      aplica ao cliente, para a prévia do admin e a tela do cliente
--      partirem do mesmo SQL:
--        portal_producao   conteúdos liberados + status amigável
--        portal_gravacoes  gravações liberadas + roteiros por título
--        portal_status     relatórios semanais publicados
--
-- O que NÃO nasce aqui: nenhuma leitura de kanban_*, comentários
-- internos, responsáveis ou notas de produção para o cliente. Nenhuma
-- função de aprovação é tocada (ver migration_aprovacoes_v2.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LIBERAÇÃO DE GRAVAÇÕES PARA O PORTAL
-- ---------------------------------------------------------------------
alter table public.gravacoes add column if not exists visivel_cliente boolean default false;
alter table public.gravacoes add column if not exists visivel_cliente_em timestamptz;
create index if not exists gravacoes_visivel_cliente_idx
  on public.gravacoes (client_id) where visivel_cliente = true;

-- ---------------------------------------------------------------------
-- 2. STATUS AMIGÁVEL
--
-- O cliente vê seis palavras, não o estado técnico. A regra mora em uma
-- função só, para a home, a lista de produção e a prévia do admin
-- concordarem sempre.
--
--   status do conteúdo      aprovação atual        → o cliente lê
--   ----------------------  ---------------------  -----------------
--   qualquer                pendente | parcial     Aguardando você
--   qualquer                ajustes | recusado     Em revisão
--   Publicado               —                      Publicado
--   Programado              —                      Programado
--   Aprovado                — ou aprovado          Aprovado
--   Em revisão              —                      Em revisão
--   Ideia | Em criação      —                      Em produção
-- ---------------------------------------------------------------------
create or replace function public.portal_status_amigavel(p_status text, p_aprovacao text)
returns text
language sql immutable
as $$
  select case
    when p_aprovacao in ('pendente', 'parcial') then 'aguardando_voce'
    when p_aprovacao in ('ajustes', 'recusado') then 'em_revisao'
    when p_status = 'Publicado'  then 'publicado'
    when p_status = 'Programado' then 'programado'
    when p_status = 'Aprovado' or p_aprovacao = 'aprovado' then 'aprovado'
    when p_status = 'Em revisão' then 'em_revisao'
    else 'em_producao'
  end
$$;
revoke all on function public.portal_status_amigavel(text, text) from public;
grant execute on function public.portal_status_amigavel(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. PRODUÇÃO DO CLIENTE
--
-- security_invoker: cada linha passa pelo RLS de conteudos (cliente só
-- lê visivel_cliente = true da própria empresa com serviço ativo) e de
-- aprovacoes (posso_ver_cliente). O filtro visivel_cliente fica repetido
-- aqui de propósito: é o que faz a prévia do admin — que é equipe e
-- passaria pelo RLS sem corte — enxergar o mesmo conjunto que o cliente.
--
-- Sem responsável, sem nota interna, sem coluna do Kanban.
-- ---------------------------------------------------------------------
drop view if exists public.portal_producao;
create view public.portal_producao
with (security_invoker = true) as
select c.id, c.client_id, c.linha_id, c.tipo, c.titulo, c.data_postagem, c.canal,
       c.objetivo, c.updated_at,
       ap.id        as aprovacao_id,
       ap.versao    as aprovacao_versao,
       ap.situacao  as aprovacao_situacao,
       ap.tipo      as aprovacao_tipo,
       ap.decidido_em,
       public.portal_status_amigavel(c.status, ap.situacao) as status_cliente,
       coalesce(to_char(c.data_postagem, 'YYYY-MM'), to_char(c.updated_at, 'YYYY-MM')) as periodo
  from public.conteudos c
  left join lateral (
    select a.id, a.versao, a.situacao, a.tipo, a.decidido_em
      from public.aprovacoes a
     where a.deleted_at is null
       and a.situacao not in ('substituido', 'cancelado')
       and ((a.tipo = 'conteudo' and a.alvo_id = c.id)
         or (a.tipo = 'roteiro' and c.script_id is not null and a.alvo_id = c.script_id))
     order by a.enviado_em desc
     limit 1
  ) ap on true
 where c.deleted_at is null
   and coalesce(c.visivel_cliente, false) = true;

grant select on public.portal_producao to authenticated;

-- ---------------------------------------------------------------------
-- 4. GRAVAÇÕES DO CLIENTE
--
-- gravacoes e roteiros são operação interna: o RLS (migration_rls.sql)
-- fecha as duas tabelas para o cliente, e é assim que devem ficar. Esta
-- view é a única janela, e por isso roda com os direitos do dono
-- (security definer, o padrão de view) com o filtro explícito dentro:
--
--   - só gravação liberada (visivel_cliente = true), não excluída
--   - só da empresa que posso_ver_cliente() autoriza — para o cliente,
--     isso já corta vínculo inexistente e serviço pausado/cancelado
--   - só o que o cliente pode saber: nome, data (se houver), situação
--     amigável e os TÍTULOS dos roteiros com a situação de aprovação
--
-- Fora da view: local, horários, responsável, videomaker, observações.
-- security_barrier impede que um filtro do chamador seja empurrado para
-- dentro e enxergue linhas antes do corte.
-- ---------------------------------------------------------------------
drop view if exists public.portal_gravacoes;
create view public.portal_gravacoes
with (security_barrier = true) as
select g.id, g.client_id, g.nome,
       g.data_gravacao,
       g.situacao,
       case
         when g.situacao = 'Gravada'   then 'gravada'
         when g.situacao = 'Cancelada' then 'cancelada'
         when g.data_gravacao is not null then 'programada'
         else 'em_preparacao'
       end as status_cliente,
       g.visivel_cliente_em,
       g.updated_at,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', r.id,
                  'titulo', coalesce(nullif(r.titulo, ''), 'Sem título'),
                  'aprovacao_id', ap.id,
                  'aprovacao_situacao', ap.situacao,
                  'aprovacao_versao', ap.versao)
                order by r.position)
           from public.roteiros r
           left join lateral (
             select a.id, a.situacao, a.versao
               from public.aprovacoes a
              where a.tipo = 'roteiro' and a.alvo_id = r.id and a.deleted_at is null
                and a.situacao not in ('substituido', 'cancelado')
              order by a.versao desc limit 1
           ) ap on true
          where r.recording_session_id = g.id and r.deleted_at is null
       ), '[]'::jsonb) as roteiros
  from public.gravacoes g
 where g.deleted_at is null
   and coalesce(g.visivel_cliente, false) = true
   and public.posso_ver_cliente(g.client_id);

revoke all on public.portal_gravacoes from public, anon;
grant select on public.portal_gravacoes to authenticated;

-- ---------------------------------------------------------------------
-- 5. STATUS SEMANAL PUBLICADO
--
-- security_invoker: status_semanais já tem política para o cliente
-- (publicado_em is not null). O filtro repetido aqui existe pela mesma
-- razão da produção: a prévia do admin precisa ver só o publicado.
-- ---------------------------------------------------------------------
drop view if exists public.portal_status;
create view public.portal_status
with (security_invoker = true) as
select s.id, s.client_id, s.linha_id, s.semana_inicio, s.semana_fim, s.titulo,
       s.publicado_em, s.updated_at,
       (select count(*) from public.status_itens i
         where i.report_id = s.id and i.deleted_at is null) as total_itens
  from public.status_semanais s
 where s.deleted_at is null
   and s.publicado_em is not null;

grant select on public.portal_status to authenticated;

-- ---------------------------------------------------------------------
-- 6. LIBERAR / RECOLHER UMA GRAVAÇÃO (equipe)
-- Passa por função para registrar quando foi liberada; a política de
-- escrita de gravacoes (só equipe) continua valendo por baixo.
-- ---------------------------------------------------------------------
create or replace function public.gravacao_liberar_portal(p_id uuid, p_visivel boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.sou_equipe() then
    raise exception 'Só a equipe libera gravações para o portal.';
  end if;
  update public.gravacoes
     set visivel_cliente = coalesce(p_visivel, false),
         visivel_cliente_em = case when coalesce(p_visivel, false) then now() else null end
   where id = p_id and deleted_at is null;
end $$;
revoke all on function public.gravacao_liberar_portal(uuid, boolean) from public;
grant execute on function public.gravacao_liberar_portal(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 7. SERVIÇO PAUSADO PRECISA APARECER NA SESSÃO
--
-- minha_sessao (migration_presenca.sql) é security_invoker e monta
-- `empresas` com um join em clientes. Com o corte do RLS, a política de
-- clientes é posso_ver_cliente(), que devolve FALSE para serviço pausado
-- ou cancelado — e a empresa some da sessão. Resultado: o portal não
-- tinha como saber que devia mostrar "Serviço pausado" e mostrava uma
-- home vazia.
--
-- Aqui a lista de empresas passa por uma função definer que devolve só
-- o que a tela de bloqueio precisa (id, nome, logo, situação do serviço
-- e a mensagem que a equipe escreveu para o cliente). Nada mais de
-- clientes vaza por aqui: nota interna do serviço fica de fora. A view
-- é recriada com as MESMAS colunas de migration_presenca.sql.
-- ---------------------------------------------------------------------
create or replace function public.minhas_empresas()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
           'servico', coalesce(c.servico, 'ativo'),
           'mensagem', c.servico_mensagem)
         order by c.nome), '[]'::json)
    from public.perfil_clientes pc
    join public.clientes c on c.id = pc.client_id
   where pc.perfil_id = auth.uid()
$$;
revoke all on function public.minhas_empresas() from public;
grant execute on function public.minhas_empresas() to authenticated;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'perfis' and column_name = 'last_seen_at') then
    execute 'drop view if exists public.minha_sessao';
    execute $v$
      create view public.minha_sessao
      with (security_invoker = true) as
      select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
             coalesce(p.preferencias, '{}'::jsonb) as preferencias,
             p.last_login_at, p.last_seen_at,
             public.minhas_empresas() as empresas
      from public.perfis p
      where p.id = auth.uid()
    $v$;
    execute 'grant select on public.minha_sessao to authenticated';
  else
    raise notice 'perfis.last_seen_at não existe: rode migration_presenca.sql antes; minha_sessao não foi recriada.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. A CHAVE ANON NÃO ABRE NENHUMA DESTAS JANELAS
-- ---------------------------------------------------------------------
revoke all on public.portal_producao, public.portal_gravacoes, public.portal_status from anon;
