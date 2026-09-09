-- =====================================================================
-- MIGRATION FIX — correções de banco da revisão de 09/09/2026
--
-- Rode DEPOIS de todas as migrations listadas em migration_tudo.sql
-- (vnext → vcontent → semana → central → auth → portal → kanban) e
-- ANTES do corte do RLS. É aditiva e idempotente: pode rodar de novo.
--
-- O que ela conserta, e por quê:
--
--  1. Views congeladas. linhas_resumo, status_resumo e minha_sessao foram
--     criadas ANTES de colunas que migrations posteriores adicionaram
--     (referencias, finalizada_em, visivel_cliente, publicado_em,
--     avatar_url). "select l.*" é expandido na criação da view, então a
--     view não enxerga o que veio depois — a interface salvava e a tela
--     reabria vazia. Recria as três, e também gravacoes_resumo, que
--     regride se supabase_setup.sql ou migration_vnext.sql forem
--     re-rodados.
--
--  2. Triggers de updated_at que nunca existiram: as migrations de
--     semana, auth, portal e kanban procuravam uma função chamada
--     set_updated_at, mas a função do projeto se chama tocar_updated_at.
--
--  3. aprovacao_partes.parte_tipo era obrigatório sem default e o
--     sistema não enviava — toda decisão por cena falhava.
--
--  4. Cliente aprovador podia reescrever o snapshot da versão aprovada
--     (a política de decisão liberava UPDATE em qualquer coluna).
--
--  5. Comentário aceitava autor forjado: autor_id e autor_papel vinham
--     do navegador. Agora são preenchidos no banco a partir da sessão.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. APOIO — o grant a anon só volta se o corte do RLS ainda não rodou.
--    Depois do corte, re-rodar este arquivo não pode reabrir nada.
-- ---------------------------------------------------------------------
create or replace function public.b7_grant_anon_se_aberto(v text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                    and tablename = 'clientes' and policyname = 'clientes_escrita') then
    execute format('grant select on public.%I to anon', v);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. VIEWS
-- ---------------------------------------------------------------------
drop view if exists public.linhas_resumo;
create view public.linhas_resumo
with (security_invoker = on) as
select
  l.*,
  c.nome as cliente_nome,
  c.logo_url as cliente_logo_url,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null) as total_conteudos,
  (select count(*) from public.conteudos ct
     where ct.linha_id = l.id and ct.deleted_at is null
       and ct.status in ('Em criação','Em revisão','Aprovado','Programado','Publicado')) as total_estruturados,
  (select count(*) from public.pilares p where p.linha_id = l.id) as total_pilares
from public.linhas_editoriais l
join public.clientes c on c.id = l.client_id;
grant select on public.linhas_resumo to authenticated;
select public.b7_grant_anon_se_aberto('linhas_resumo');

drop view if exists public.status_resumo;
create view public.status_resumo
with (security_invoker = true) as
select r.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo_url,
       (select count(*) from public.status_itens i
         where i.report_id = r.id and i.deleted_at is null) as total_itens,
       (select count(*) from public.status_itens i
         where i.report_id = r.id and i.deleted_at is null
           and i.situacao in ('Aguardando cliente', 'Atenção')) as total_atencao,
       (select max(versao) from public.status_versoes v where v.report_id = r.id) as ultima_versao
from public.status_semanais r
join public.clientes c on c.id = r.client_id;
grant select on public.status_resumo to authenticated;
select public.b7_grant_anon_se_aberto('status_resumo');

drop view if exists public.gravacoes_resumo;
create view public.gravacoes_resumo
with (security_invoker = true) as
select g.*,
       c.nome as cliente_nome,
       c.logo_url as cliente_logo_url,
       (select count(*) from public.roteiros r
         where r.recording_session_id = g.id and r.deleted_at is null) as total_roteiros
from public.gravacoes g
join public.clientes c on c.id = g.client_id;
grant select on public.gravacoes_resumo to authenticated;
select public.b7_grant_anon_se_aberto('gravacoes_resumo');

/* minha_sessao só existe depois de migration_auth.sql; avatar_url vem de
   migration_portal.sql. Se uma das duas não rodou, este bloco avisa em
   vez de quebrar. */
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'perfis' and column_name = 'avatar_url') then
    raise notice 'perfis.avatar_url não existe: rode migration_auth.sql e migration_portal.sql antes.';
  else
    execute 'drop view if exists public.minha_sessao';
    execute $v$
      create view public.minha_sessao
      with (security_invoker = true) as
      select p.id, p.username, p.nome, p.papel, p.estado, p.pode_aprovar, p.avatar_url,
             (select coalesce(json_agg(json_build_object(
                       'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
                       'servico', coalesce(c.servico, 'ativo'),
                       'mensagem', c.servico_mensagem)), '[]'::json)
                from public.perfil_clientes pc
                join public.clientes c on c.id = pc.client_id
               where pc.perfil_id = p.id) as empresas
      from public.perfis p
      where p.id = auth.uid()
    $v$;
    execute 'grant select on public.minha_sessao to authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. TRIGGERS DE updated_at
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['status_semanais','status_itens','perfis',
                           'aprovacoes','aprovacao_partes','comentarios',
                           'kanban_demandas','kanban_comentarios']
  loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('drop trigger if exists %I on public.%I', t || '_updated', t);
      execute format('create trigger %I before update on public.%I
                        for each row execute function public.tocar_updated_at()',
                     t || '_updated', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. aprovacao_partes.parte_tipo com default
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'aprovacao_partes' and column_name = 'parte_tipo') then
    alter table public.aprovacao_partes alter column parte_tipo set default 'cena';
    update public.aprovacao_partes set parte_tipo = 'cena' where parte_tipo is null or parte_tipo = '';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. CLIENTE DECIDE, NÃO REESCREVE
--    A política de decisão libera UPDATE na linha inteira. Este trigger
--    garante que, quando quem grava não é da equipe, só as colunas de
--    decisão mudam. O texto aprovado continua sendo o texto enviado.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'aprovacoes') then
    raise notice 'aprovacoes não existe: rode migration_portal.sql antes.';
    return;
  end if;

  create or replace function public.aprovacoes_protege_material()
  returns trigger language plpgsql security definer set search_path = public as $t$
  begin
    /* sem sessão = antes do corte do RLS, uso interno pela chave anon;
       depois do corte a chave anon não alcança a tabela */
    if auth.uid() is null or public.sou_equipe() then return new; end if;
    if new.client_id      is distinct from old.client_id
       or new.tipo        is distinct from old.tipo
       or new.alvo_id     is distinct from old.alvo_id
       or new.versao      is distinct from old.versao
       or new.snapshot    is distinct from old.snapshot
       or new.enviado_por is distinct from old.enviado_por
       or new.enviado_em  is distinct from old.enviado_em
       or new.observacao_envio is distinct from old.observacao_envio
       or new.deleted_at  is distinct from old.deleted_at
       or new.created_at  is distinct from old.created_at then
      raise exception 'Cliente só pode registrar a decisão; o material enviado não é editável.';
    end if;
    if new.situacao not in ('aprovado', 'ajustes') then
      raise exception 'Decisão inválida para cliente: %', new.situacao;
    end if;
    return new;
  end $t$;

  drop trigger if exists aprovacoes_protege on public.aprovacoes;
  create trigger aprovacoes_protege before update on public.aprovacoes
    for each row execute function public.aprovacoes_protege_material();
end $$;

-- ---------------------------------------------------------------------
-- 5. AUTOR DO COMENTÁRIO VEM DA SESSÃO
--    Sem sessão (antes do corte do RLS, com a chave anon) mantém o que o
--    sistema mandou; com sessão, o banco é a fonte.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'comentarios') then
    return;
  end if;

  create or replace function public.comentarios_assina()
  returns trigger language plpgsql security definer set search_path = public as $t$
  declare p record;
  begin
    if auth.uid() is null then return new; end if;
    /* equipe pode informar o autor (restauração de backup); cliente
       é sempre assinado pela própria sessão */
    if new.autor_id is not null and public.sou_equipe() then return new; end if;
    select id, nome, papel into p from public.perfis where id = auth.uid();
    if found then
      new.autor_id    := p.id;
      new.autor_nome  := coalesce(nullif(p.nome, ''), new.autor_nome);
      new.autor_papel := p.papel;
    end if;
    return new;
  end $t$;

  drop trigger if exists comentarios_assina on public.comentarios;
  create trigger comentarios_assina before insert on public.comentarios
    for each row execute function public.comentarios_assina();
end $$;

select 'migration_fix aplicada' as resultado;
