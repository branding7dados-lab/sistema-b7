-- zzz269: PERMISSÕES POR AÇÃO
-- Além do nível por módulo (Ver/Editar/Total), cada AÇÃO importante tem um
-- liga/desliga: "criar gravação", "criar demanda de design", "mover no
-- quadro"… O administrador define por função (funcao_acoes) e por pessoa
-- (perfil_acoes). Sem nada definido vale o PADRÃO, que reproduz exatamente
-- a regra de antes — ninguém ganha nem perde nada com esta migração.
--
-- Ordem: administrador = sempre sim → pessoa → função (qualquer cargo da
-- pessoa que diga sim) → padrão (cargo na lista E nível no módulo, ou uma
-- liberação explícita do módulo na conta da pessoa).
-- Aplicada como: acoes_1_catalogo, acoes_2_portoes, acoes_2b_initplan, acoes_3_leitura, acoes_5_videomaker_grava
-- (videomaker com Gravações em Editar/Total cria e edita gravações, como já fazia pelo Calendário).

-- ============================================================ 1) catálogo
create table if not exists public.acoes (
  id text primary key,
  modulo text not null references public.modulos(id),
  rotulo text not null,
  descricao text,
  ordem int not null default 0,
  padrao_funcoes text[] not null default '{}',   -- cargos que têm por padrão
  nivel_min int not null default 2               -- nível no módulo exigido pelo padrão
);
alter table public.acoes enable row level security;
grant select on public.acoes to authenticated;
create policy acoes_ler on public.acoes for select to authenticated using (true);

create table if not exists public.funcao_acoes (
  funcao text not null,
  acao text not null references public.acoes(id) on delete cascade,
  permitido boolean not null,
  alterado_por uuid references public.perfis(id) on delete set null,
  alterado_em timestamptz not null default now(),
  primary key (funcao, acao)
);
create index if not exists funcao_acoes_acao_idx on public.funcao_acoes (acao);
create index if not exists funcao_acoes_alterado_por_idx on public.funcao_acoes (alterado_por);
alter table public.funcao_acoes enable row level security;
grant select on public.funcao_acoes to authenticated;
create policy funcao_acoes_ler on public.funcao_acoes for select to authenticated using ((select public.sou_equipe_interna()));

create table if not exists public.perfil_acoes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  acao text not null references public.acoes(id) on delete cascade,
  efeito text not null check (efeito in ('permitir', 'negar')),
  alterado_por uuid references public.perfis(id) on delete set null,
  alterado_em timestamptz not null default now(),
  primary key (perfil_id, acao)
);
create index if not exists perfil_acoes_acao_idx on public.perfil_acoes (acao);
create index if not exists perfil_acoes_alterado_por_idx on public.perfil_acoes (alterado_por);
alter table public.perfil_acoes enable row level security;
grant select on public.perfil_acoes to authenticated;
create policy perfil_acoes_ler on public.perfil_acoes for select to authenticated
  using (perfil_id = (select auth.uid()) or (select public.sou_admin()));

insert into public.acoes (id, modulo, rotulo, descricao, ordem, padrao_funcoes, nivel_min) values
  ('gravacao.criar',    'gravacoes', 'Criar gravação',                 'Cadastrar uma gravação nova (também a partir da agenda).', 10, '{coordenador,videomaker}', 2),
  ('gravacao.agendar',  'gravacoes', 'Marcar e remarcar a data',       'Escolher ou mudar o dia e o horário de uma gravação.', 11, '{coordenador,videomaker}', 2),
  ('gravacao.editar',   'gravacoes', 'Editar a gravação',              'Mudar nome, local, observações e o roteiro do dia.', 12, '{coordenador,videomaker}', 2),
  ('gravacao.concluir', 'gravacoes', 'Concluir gravação',              'Marcar que a gravação aconteceu.', 13, '{coordenador,videomaker}', 2),
  ('gravacao.cancelar', 'gravacoes', 'Cancelar ou excluir gravação',   null, 14, '{coordenador}', 3),
  ('gravacao.portal',   'gravacoes', 'Mostrar gravação no portal',     'Liberar a gravação para o cliente ver no portal.', 15, '{coordenador}', 2),
  ('roteiro.editar',    'roteiros',  'Criar e editar roteiros',        'Escrever roteiros e cenas.', 20, '{coordenador}', 2),
  ('linha.editar',      'linhas',    'Criar e editar linhas',          'Montar a linha editorial e os conteúdos dela.', 30, '{coordenador}', 2),
  ('linha.concluir',    'linhas',    'Concluir linha',                 'Fechar a linha e mandar as peças para o design.', 31, '{coordenador}', 2),
  ('design.criar',      'design',    'Criar demanda de design',        'Abrir uma peça nova (avulsa, da linha ou de um conteúdo).', 40, '{coordenador}', 2),
  ('design.ver_todas',  'design',    'Ver as peças de todos',          'Sem isso, cada designer vê só as peças dele e as sem dono.', 41, '{coordenador}', 1),
  ('design.mover',      'design',    'Mover peças no quadro',          'Arrastar peças entre as colunas do quadro de design.', 42, '{coordenador}', 2),
  ('design.prazo',      'design',    'Mudar prazo e prioridade',       null, 43, '{coordenador}', 2),
  ('design.revisar',    'design',    'Revisar e pedir ajuste',         'Aprovar internamente ou devolver a peça para ajuste.', 44, '{coordenador}', 2),
  ('design.enviar',     'design',    'Enviar peça para o cliente',     'Mandar a peça para a aprovação do cliente.', 45, '{coordenador}', 2),
  ('design.finalizar',  'design',    'Finalizar peça',                 null, 46, '{coordenador}', 2),
  ('video.criar',       'video',     'Criar demanda de vídeo',         'Abrir demandas de edição (também a partir da gravação).', 50, '{coordenador,videomaker}', 2),
  ('video.editar',      'video',     'Editar demanda de vídeo',        null, 51, '{coordenador,videomaker}', 2),
  ('video.atribuir',    'video',     'Distribuir vídeos',              'Escolher quem edita cada vídeo.', 52, '{coordenador,videomaker}', 2),
  ('video.status',      'video',     'Mudar a situação do vídeo',      null, 53, '{coordenador,videomaker}', 2),
  ('video.excluir',     'video',     'Excluir demanda de vídeo',       null, 54, '{coordenador,videomaker}', 3),
  ('kanban.criar',      'kanban',    'Criar e editar cartões',         'Cartões, comentários e histórico do quadro de produção.', 60, '{coordenador}', 2),
  ('kanban.mover',      'kanban',    'Mover cartões no quadro',        null, 61, '{coordenador}', 2),
  ('aprovacao.enviar',  'aprovacoes','Enviar para o cliente aprovar',  'Mandar qualquer material para a aprovação do cliente.', 70, '{coordenador}', 2),
  ('cliente.criar',     'clientes',  'Cadastrar cliente',              null, 80, '{coordenador}', 2),
  ('cliente.editar',    'clientes',  'Editar dados do cliente',        'Ficha, inteligência e informações do cliente.', 81, '{coordenador}', 2)
on conflict (id) do update set modulo = excluded.modulo, rotulo = excluded.rotulo, descricao = excluded.descricao,
  ordem = excluded.ordem, padrao_funcoes = excluded.padrao_funcoes, nivel_min = excluded.nivel_min;

-- cargos de uma pessoa (o que as regras antigas olhavam: papel + cargos extras)
create or replace function public._cargos_de(p_id uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct f) filter (where f is not null), '{}')
    from (select p.papel f from public.perfis p where p.id = p_id
          union all select unnest(coalesce(p.funcoes_adicionais, '{}')) from public.perfis p where p.id = p_id
          union all select fe.funcao from public.perfis_funcoes_extra fe where fe.perfil_id = p_id) x
$$;
revoke execute on function public._cargos_de(uuid) from public, anon, authenticated;

-- valor e origem de uma ação para uma pessoa: { v: bool, o: 'admin'|'pessoa'|'funcao'|'padrao' }
create or replace function public._acao_de(p_acao text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.perfis; a public.acoes; ef text; r boolean; cargos text[]; fns text[];
begin
  select * into p from public.perfis where id = p_id;
  select * into a from public.acoes where id = p_acao;
  if p.id is null or a.id is null or p.estado <> 'ativa' or p.papel = 'cliente' then return jsonb_build_object('v', false, 'o', 'padrao'); end if;
  if p.papel = 'admin' or coalesce(p.eh_admin, false) then return jsonb_build_object('v', true, 'o', 'admin'); end if;
  select efeito into ef from public.perfil_acoes where perfil_id = p_id and acao = p_acao;
  if ef is not null then return jsonb_build_object('v', ef = 'permitir', 'o', 'pessoa'); end if;
  cargos := public._cargos_de(p_id);
  fns := cargos || array_remove(array[coalesce(p.funcao_personalizada, p.funcao)], null);
  select bool_or(permitido) into r from public.funcao_acoes where acao = p_acao and funcao = any(fns);
  if r is not null then return jsonb_build_object('v', r, 'o', 'funcao'); end if;
  r := (a.padrao_funcoes && cargos and public.nivel_modulo(a.modulo, p_id) >= a.nivel_min)
       or exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p_id and pm.modulo = a.modulo and pm.efeito = 'permitir'
                    and public._nivel_num(coalesce(pm.nivel, 'total')) >= a.nivel_min)
       or exists (select 1 from public.funcao_modulos fm where p.funcao_personalizada is not null and fm.funcao = p.funcao_personalizada
                    and fm.modulo = a.modulo and public._nivel_num(fm.nivel) >= a.nivel_min);
  return jsonb_build_object('v', coalesce(r, false), 'o', 'padrao');
end $$;
revoke execute on function public._acao_de(text, uuid) from public, anon, authenticated;

-- o portão usado pelo banco inteiro
create or replace function public.pode_acao(p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then false else (public._acao_de(p_acao, auth.uid()) ->> 'v')::boolean end
$$;
revoke execute on function public.pode_acao(text) from public, anon;
grant execute on function public.pode_acao(text) to authenticated;

-- as minhas (vai na sessão: a tela mostra só o que a pessoa pode fazer)
create or replace function public.minhas_acoes()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then '{}'::jsonb
    else coalesce((select jsonb_object_agg(a.id, (public._acao_de(a.id, auth.uid()) ->> 'v')::boolean) from public.acoes a), '{}'::jsonb) end
$$;
revoke execute on function public.minhas_acoes() from public, anon;
grant execute on function public.minhas_acoes() to authenticated;

-- tela do administrador: catálogo, o que cada função e cada pessoa tem, e de onde vem
create or replace function public.acoes_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'Só o administrador vê as permissões de todos.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'catalogo', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'modulo', a.modulo, 'rotulo', a.rotulo, 'descricao', a.descricao,
                   'padrao_funcoes', a.padrao_funcoes, 'nivel_min', a.nivel_min) order by a.ordem), '[]') from public.acoes a),
    'funcoes', (select coalesce(jsonb_agg(jsonb_build_object('funcao', f.funcao, 'acao', f.acao, 'permitido', f.permitido)), '[]') from public.funcao_acoes f),
    'pessoas', (select coalesce(jsonb_agg(jsonb_build_object('perfil_id', x.perfil_id, 'acao', x.acao, 'efeito', x.efeito)), '[]') from public.perfil_acoes x),
    'efetivo', (select coalesce(jsonb_object_agg(p.id, (select jsonb_object_agg(a.id, public._acao_de(a.id, p.id)) from public.acoes a)), '{}')
                  from public.perfis p where p.papel <> 'cliente' and p.estado = 'ativa'));
end $$;
revoke execute on function public.acoes_painel() from public, anon;
grant execute on function public.acoes_painel() to authenticated;

-- mudar: função (p_permitido null = volta ao padrão)
create or replace function public.funcao_acao_definir(p_funcao text, p_acao text, p_permitido boolean)
returns void language plpgsql security definer set search_path = public as $$
declare antes boolean;
begin
  if not public.sou_admin() then raise exception 'Só o administrador muda as permissões.' using errcode = '42501'; end if;
  if not exists (select 1 from public.acoes where id = p_acao) then raise exception 'Ação desconhecida.'; end if;
  if p_funcao not in ('coordenador', 'designer', 'videomaker') and not exists (select 1 from public.funcoes_personalizadas where id = p_funcao) then
    raise exception 'Função desconhecida.';
  end if;
  select permitido into antes from public.funcao_acoes where funcao = p_funcao and acao = p_acao;
  if p_permitido is null then
    perform public._funcao_acao_limpar(p_funcao, p_acao);
  else
    insert into public.funcao_acoes (funcao, acao, permitido, alterado_por) values (p_funcao, p_acao, p_permitido, auth.uid())
    on conflict (funcao, acao) do update set permitido = excluded.permitido, alterado_por = excluded.alterado_por, alterado_em = now();
  end if;
  insert into public.auditoria(autor_id, autor_username, acao, alvo_tipo, alvo_id, alvo_descricao, detalhe)
    select auth.uid(), (select username from public.perfis where id = auth.uid()), 'acao_funcao_definida', 'funcao', null, p_funcao,
           jsonb_build_object('acao', p_acao, 'antes', antes, 'depois', p_permitido);
end $$;

create or replace function public._funcao_acao_limpar(p_funcao text, p_acao text)
returns void language sql security definer set search_path = public as $$
  delete from public.funcao_acoes where funcao = p_funcao and acao = p_acao
$$;
revoke execute on function public._funcao_acao_limpar(text, text) from public, anon, authenticated;
revoke execute on function public.funcao_acao_definir(text, text, boolean) from public, anon;
grant execute on function public.funcao_acao_definir(text, text, boolean) to authenticated;

-- mudar: pessoa (p_efeito null = segue a função)
create or replace function public._perfil_acao_limpar(p_perfil uuid, p_acao text)
returns void language sql security definer set search_path = public as $$
  delete from public.perfil_acoes where perfil_id = p_perfil and acao = p_acao
$$;
revoke execute on function public._perfil_acao_limpar(uuid, text) from public, anon, authenticated;

create or replace function public.perfil_acao_definir(p_perfil uuid, p_acao text, p_efeito text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare alvo public.perfis; antes text;
begin
  if not public.sou_admin() then raise exception 'Só o administrador muda as permissões.' using errcode = '42501'; end if;
  select * into alvo from public.perfis where id = p_perfil;
  if alvo.id is null or alvo.papel = 'cliente' then raise exception 'Pessoa não encontrada na equipe.'; end if;
  if not exists (select 1 from public.acoes where id = p_acao) then raise exception 'Ação desconhecida.'; end if;
  if p_efeito is not null and p_efeito not in ('permitir', 'negar') then raise exception 'Escolha permitir ou negar.'; end if;
  select efeito into antes from public.perfil_acoes where perfil_id = p_perfil and acao = p_acao;
  if p_efeito is null then perform public._perfil_acao_limpar(p_perfil, p_acao);
  else
    insert into public.perfil_acoes (perfil_id, acao, efeito, alterado_por) values (p_perfil, p_acao, p_efeito, auth.uid())
    on conflict (perfil_id, acao) do update set efeito = excluded.efeito, alterado_por = excluded.alterado_por, alterado_em = now();
  end if;
  insert into public.auditoria(autor_id, autor_username, acao, alvo_tipo, alvo_id, alvo_descricao, detalhe)
    select auth.uid(), (select username from public.perfis where id = auth.uid()), 'acao_pessoa_definida', 'perfil', p_perfil, alvo.nome,
           jsonb_build_object('acao', p_acao, 'antes', antes, 'depois', p_efeito);
  return public._acao_de(p_acao, p_perfil);
end $$;
revoke execute on function public.perfil_acao_definir(uuid, text, text) from public, anon;
grant execute on function public.perfil_acao_definir(uuid, text, text) to authenticated;

-- a sessão leva as ações (coluna nova no fim da view)
create or replace view public.minha_sessao as
 SELECT id, username, nome, papel, estado, pode_aprovar, avatar_url,
    COALESCE(preferencias, '{}'::jsonb) AS preferencias, last_login_at, last_seen_at,
    minhas_empresas() AS empresas,
    COALESCE(( SELECT array_agg(DISTINCT x.f ORDER BY x.f) FROM ( SELECT fe.funcao AS f FROM perfis_funcoes_extra fe WHERE fe.perfil_id = p.id
                UNION SELECT unnest(p.funcoes_adicionais)) x
          WHERE x.f IS DISTINCT FROM p.papel AND p.papel <> 'cliente'::text), '{}'::text[]) AS funcoes_extra,
    eh_admin, funcao, modulos_efetivos(id) AS modulos, modulos_niveis(id) AS niveis, superadmin, senha_provisoria,
    minhas_acoes() AS acoes
   FROM perfis p
  WHERE id = auth.uid();

-- ============================================================ 2) portões
-- Cada RPC troca a regra fixa ("só admin/coordenador") pela ação. Como o
-- padrão da ação é a regra antiga, nada muda até o administrador mexer.
do $$
declare t record; d text; pos int;
begin
  for t in select * from (values
    ('calendario_criar_gravacao_de_evento', 'if not public.sou_equipe() then', 'gravacao.criar'),
    ('calendario_gravacao_excluir',          'if not public.sou_equipe() then', 'gravacao.cancelar'),
    ('gravacao_cancelar',                    'if not public.sou_equipe() then', 'gravacao.cancelar'),
    ('gravacao_liberar_portal',              'if not public.sou_equipe() then', 'gravacao.portal'),
    ('linha_concluir',                       'if not public.sou_equipe() then', 'linha.concluir'),
    ('design_criar_manual',                  'if not public.sou_equipe() then', 'design.criar'),
    ('design_gerar_da_linha',                'if not public.sou_equipe() then', 'design.criar'),
    ('design_gerar_do_conteudo',             'if not public.sou_equipe() then', 'design.criar'),
    ('design_mover_status',                  'if not public.sou_equipe() then', 'design.mover'),
    ('design_definir_prazo_prioridade',      'if not public.sou_equipe() then', 'design.prazo'),
    ('design_aprovar_interno',               'if not public.sou_equipe() then', 'design.revisar'),
    ('design_solicitar_ajuste',              'if not public.sou_equipe() then', 'design.revisar'),
    ('design_parte_revisar',                 'if not public.sou_equipe() then', 'design.revisar'),
    ('design_revisao_fechar',                'if not public.sou_equipe() then', 'design.revisar'),
    ('design_enviar_cliente',                'if not public.sou_equipe() then', 'design.enviar'),
    ('design_finalizar',                     'if not public.sou_equipe() then', 'design.finalizar'),
    ('kanban_mover',                         'if not public.sou_equipe() then', 'kanban.mover'),
    ('aprov_enviar',                         'or not public.sou_equipe() then', 'aprovacao.enviar'),
    ('calendario_marcar_gravacao',           'if not (public.sou_equipe() or public.sou_videomaker()) then', 'gravacao.agendar'),
    ('gravacao_agendar',                     'if not (public.sou_equipe() or public.sou_videomaker()) then', 'gravacao.agendar'),
    ('gravacao_concluir',                    'if not (public.sou_equipe() or public.sou_videomaker()) then', 'gravacao.concluir'),
    ('video_criar_demanda',                  'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.criar'),
    ('video_gerar_demanda_agrupada',         'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.criar'),
    ('video_gerar_demandas_de_gravacao',     'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.criar'),
    ('video_editar_demanda',                 'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.editar'),
    ('video_excluir_demanda',                'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.excluir'),
    ('video_atribuir',                       'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.atribuir'),
    ('video_mudar_status',                   'if not (public.sou_equipe() or public.sou_videomaker()) then', 'video.status')
  ) v(fn, velho, acao) loop
    for d in select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = t.fn loop
      pos := position(t.velho in d);
      if pos = 0 then raise exception 'portão não encontrado em %', t.fn; end if;
      d := overlay(d placing (case when left(t.velho, 2) = 'or' then 'or' else 'if' end) || ' not public.pode_acao(''' || t.acao || ''') then'
                   from pos for length(t.velho));
      execute d;
    end loop;
  end loop;
end $$;

-- tabelas escritas direto pela tela
alter policy gravacoes_equipe_escrita on public.gravacoes with check (public.pode_acao('gravacao.criar'));
alter policy gravacoes_equipe_update on public.gravacoes using (public.pode_acao('gravacao.editar')) with check (public.pode_acao('gravacao.editar'));
alter policy roteiros_equipe_escrita on public.roteiros with check (public.pode_acao('roteiro.editar'));
alter policy roteiros_equipe_update on public.roteiros using (public.pode_acao('roteiro.editar')) with check (public.pode_acao('roteiro.editar'));
alter policy cenas_equipe_escrita on public.cenas with check (public.pode_acao('roteiro.editar'));
alter policy cenas_equipe_update on public.cenas using (public.pode_acao('roteiro.editar')) with check (public.pode_acao('roteiro.editar'));
alter policy linhas_editoriais_equipe_escrita on public.linhas_editoriais with check (public.pode_acao('linha.editar'));
alter policy linhas_editoriais_equipe_update on public.linhas_editoriais using (public.pode_acao('linha.editar')) with check (public.pode_acao('linha.editar'));
alter policy conteudos_equipe_escrita on public.conteudos with check (public.pode_acao('linha.editar'));
alter policy conteudos_equipe_update on public.conteudos using (public.pode_acao('linha.editar')) with check (public.pode_acao('linha.editar'));
alter policy clientes_equipe_escrita on public.clientes with check (public.pode_acao('cliente.criar'));
alter policy clientes_equipe_update on public.clientes using (public.pode_acao('cliente.editar')) with check (public.pode_acao('cliente.editar'));

-- ============================================================ 3) leitura
-- O "aprovei e continua sem acesso": o quadro de Produção só abria para
-- admin/coordenador, mesmo com o módulo liberado. Agora: quem tem o módulo
-- vê; escrever e apagar pedem a ação.
alter policy kanban_equipe on public.kanban_demandas
  using ((select public.sou_equipe()) or (select public.sou_equipe_interna() and public.tem_acesso_modulo('kanban')))
  with check ((select public.pode_acao('kanban.criar')));
alter policy kanban_com_equipe on public.kanban_comentarios
  using ((select public.sou_equipe()) or (select public.sou_equipe_interna() and public.tem_acesso_modulo('kanban')))
  with check ((select public.pode_acao('kanban.criar')));
alter policy kanban_hist_equipe on public.kanban_historico
  using ((select public.sou_equipe()) or (select public.sou_equipe_interna() and public.tem_acesso_modulo('kanban')))
  with check ((select public.pode_acao('kanban.criar')));
create policy kanban_apagar on public.kanban_demandas as restrictive for delete to authenticated using ((select public.pode_acao('kanban.criar')));
create policy kanban_com_apagar on public.kanban_comentarios as restrictive for delete to authenticated using ((select public.pode_acao('kanban.criar')));
create policy kanban_hist_apagar on public.kanban_historico as restrictive for delete to authenticated using ((select public.pode_acao('kanban.criar')));

-- vídeo: quem ganhou o módulo (ex.: designer cobrindo edição) também vê as demandas
do $$
declare t record; q text;
begin
  for t in select tablename, policyname, qual from pg_policies where schemaname = 'public'
            and policyname in ('demandas_edicao select', 'demandas_edicao_eventos select', 'demandas_edicao_roteiros select',
                               'video_versoes select', 'video_comentarios select') loop
    q := replace(t.qual, '(sou_equipe() OR sou_videomaker())', '(sou_equipe() OR sou_videomaker() OR (nivel_modulo(''video''::text) > 0))');
    if q = t.qual then raise exception 'regra de leitura inesperada em %', t.tablename; end if;
    execute format('alter policy %I on public.%I using (%s)', t.policyname, t.tablename, q);
  end loop;
  -- design: "ver as peças de todos" vira uma ação (padrão: coordenação)
  for t in select tablename, policyname, qual from pg_policies where schemaname = 'public'
            and policyname in ('design_deliv select', 'design_versao select', 'design_arquivo select') loop
    q := replace(t.qual, '(sou_equipe() OR', '(sou_equipe() OR ( SELECT pode_acao(''design.ver_todas''::text)) OR');
    if q = t.qual then raise exception 'regra de leitura inesperada em %', t.tablename; end if;
    execute format('alter policy %I on public.%I using (%s)', t.policyname, t.tablename, q);
  end loop;
end $$;

-- o aviso de acesso liberado não precisa mais pedir para recarregar (a tela se atualiza sozinha)
do $$
declare d text;
begin
  select pg_get_functiondef('public.acesso_decidir(uuid, boolean, text, text)'::regprocedure) into d;
  d := replace(d, ' || ''. Se não aparecer, recarregue a página.''', ' || ''.''');
  execute d;
end $$;

-- ============================================================ 4) tempo real
-- conversa do chamado e mudanças de acesso chegam na hora
alter publication supabase_realtime add table public.suporte_mensagens, public.suporte_chamados,
  public.perfil_modulos, public.perfil_acoes, public.funcao_modulos, public.funcao_acoes;
