-- zzz263: Pedidos do cliente + lembrete de aprovações paradas.
-- Aplicada em partes: cliente_pedidos_1_tabela, cliente_pedidos_2_funcoes,
-- cliente_pedidos_3_sync, aprov_lembrete_cliente.

-- =============================================================== 1) tabela
create table if not exists public.cliente_pedidos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  perfil_id uuid references public.perfis(id) on delete set null,
  tipo text not null default 'outro' check (tipo in ('arte','video','post','texto','outro')),
  titulo text not null check (char_length(titulo) between 3 and 120),
  descricao text check (descricao is null or char_length(descricao) <= 2000),
  para_quando date,
  situacao text not null default 'recebido' check (situacao in ('recebido','em_producao','concluido','cancelado')),
  kanban_id uuid references public.kanban_demandas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cliente_pedidos_client_idx on public.cliente_pedidos (client_id, created_at desc);
create index if not exists cliente_pedidos_kanban_idx on public.cliente_pedidos (kanban_id);
create index if not exists cliente_pedidos_perfil_idx on public.cliente_pedidos (perfil_id);
alter table public.cliente_pedidos enable row level security;
grant select on public.cliente_pedidos to authenticated;
-- leitura: quem vê a empresa (cliente vinculado) e a equipe interna. Escrita só pelas funções.
create policy cliente_pedidos_le on public.cliente_pedidos for select to authenticated
  using ((select public.sou_equipe_interna()) or public.posso_ver_cliente(client_id));

-- ======================================================= 2) criar pedido
create or replace function public.cliente_pedido_criar(p_client uuid, p_tipo text, p_titulo text,
  p_descricao text default null, p_para_quando date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid(); meu_nome text; emp text; pid uuid; kid uuid; evid uuid;
  tit text := btrim(coalesce(p_titulo, '')); descr text := nullif(btrim(coalesce(p_descricao, '')), '');
  rot text;
begin
  if eu is null then raise exception 'Entre de novo para continuar.'; end if;
  if public.meu_papel_cliente(p_client) is null then
    raise exception 'Você não acompanha esta empresa.';
  end if;
  select nome into emp from public.clientes where id = p_client and coalesce(servico, 'ativo') = 'ativo';
  if emp is null then raise exception 'O acompanhamento desta empresa está pausado. Fale com a Branding7.'; end if;
  if p_tipo not in ('arte','video','post','texto','outro') then raise exception 'Escolha o tipo do pedido.'; end if;
  if char_length(tit) < 3 then raise exception 'Escreva em poucas palavras o que você precisa.'; end if;
  if char_length(tit) > 120 then raise exception 'O título pode ter até 120 caracteres.'; end if;
  if char_length(coalesce(descr, '')) > 2000 then raise exception 'Os detalhes podem ter até 2000 caracteres.'; end if;
  if p_para_quando is not null and p_para_quando < public.notif_hoje() then
    raise exception 'A data precisa ser de hoje em diante.';
  end if;
  if (select count(*) from public.cliente_pedidos where client_id = p_client and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Muitos pedidos hoje. Fale com a Branding7 pelo Suporte se for urgente.';
  end if;

  select nome into meu_nome from public.perfis where id = eu;
  rot := case p_tipo when 'arte' then 'Arte' when 'video' then 'Vídeo' when 'post' then 'Post'
                     when 'texto' then 'Texto' else 'Pedido' end;

  insert into public.cliente_pedidos (client_id, perfil_id, tipo, titulo, descricao, para_quando)
  values (p_client, eu, p_tipo, tit, descr, p_para_quando) returning id into pid;

  insert into public.kanban_demandas (titulo, descricao, coluna, posicao, client_id, tipo_vinculo, vinculo_id,
                                      tipo, prazo, prioridade, origem_evento)
  values ('Pedido do cliente: ' || tit,
          coalesce(descr || E'\n\n', '') || 'Pedido por ' || coalesce(meu_nome, 'cliente') || ' no portal (' || rot || ').',
          'a_fazer', 0, p_client, 'avulsa', pid,
          case p_tipo when 'arte' then 'design' when 'post' then 'design' when 'video' then 'video' else 'producao' end,
          p_para_quando, 'normal', 'cliente.pedido')
  returning id into kid;
  update public.cliente_pedidos set kanban_id = kid where id = pid;

  insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, alvo_id, ator_id, ator_nome, ator_papel, payload, processado_em)
  values ('cliente.pedido', 'cliente.pedido:' || pid, p_client, 'cliente_pedido', pid, eu, meu_nome, 'cliente',
          jsonb_build_object('tipo', p_tipo, 'kanban_id', kid), now())
  returning id into evid;
  perform public.notif_entregar(evid, 'cliente.pedido', 'Novo pedido do cliente',
    coalesce(meu_nome, 'O cliente') || ', da ' || emp || ', pediu: "' || public.notif_corta(tit, 80) || '"' ||
      coalesce(' · para ' || to_char(p_para_quando, 'DD/MM'), '') || '.',
    '#/kanban/' || kid, p_client, null, null, array['coordenador'], 'co_aprovacoes', null, eu);
  return pid;
end $$;
revoke execute on function public.cliente_pedido_criar(uuid, text, text, text, date) from public, anon;
grant execute on function public.cliente_pedido_criar(uuid, text, text, text, date) to authenticated;

-- lista do portal: os pedidos da empresa (todos os papéis veem)
create or replace function public.cliente_pedidos_listar(p_client uuid)
returns table (id uuid, tipo text, titulo text, descricao text, para_quando date, situacao text,
               autor text, created_at timestamptz, updated_at timestamptz, sou_eu boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.tipo, p.titulo, p.descricao, p.para_quando, p.situacao,
         pf.nome, p.created_at, p.updated_at, p.perfil_id = auth.uid()
    from public.cliente_pedidos p left join public.perfis pf on pf.id = p.perfil_id
   where p.client_id = p_client
     and ((select public.sou_equipe_interna()) or public.meu_papel_cliente(p_client) is not null)
   order by (p.situacao in ('recebido','em_producao')) desc, p.created_at desc
   limit 60
$$;
revoke execute on function public.cliente_pedidos_listar(uuid) from public, anon;
grant execute on function public.cliente_pedidos_listar(uuid) to authenticated;

-- =========================== 3) o Kanban da equipe atualiza o pedido do cliente
create or replace function public._cliente_pedido_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare nova text; ped public.cliente_pedidos%rowtype; evid uuid;
begin
  if new.origem_evento is distinct from 'cliente.pedido' or new.vinculo_id is null then return new; end if;
  nova := case
    when new.deleted_at is not null or new.arquivada_em is not null then
      case when new.concluida_em is not null or new.coluna = 'concluida' then 'concluido' else 'cancelado' end
    when new.coluna in ('pronto','concluida') or new.concluida_em is not null then 'concluido'
    when new.coluna = 'a_fazer' then 'recebido'
    else 'em_producao' end;
  select * into ped from public.cliente_pedidos where id = new.vinculo_id;
  if not found or ped.situacao = nova then return new; end if;
  update public.cliente_pedidos set situacao = nova, updated_at = now() where id = ped.id;

  -- o cliente fica sabendo quando começa e quando fica pronto
  if nova in ('em_producao','concluido') and ped.perfil_id is not null then
    insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, alvo_id, payload, processado_em)
    values ('cliente.pedido_' || nova, 'cliente.pedido_' || nova || ':' || ped.id, ped.client_id, 'cliente_pedido', ped.id,
            '{}'::jsonb, now())
    on conflict (chave) do nothing returning id into evid;
    if evid is not null then
      insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
      select evid, p.id, ped.client_id, 'cliente.pedido_' || nova,
             case nova when 'concluido' then 'Seu pedido ficou pronto' else 'Seu pedido entrou em produção' end,
             '"' || public.notif_corta(ped.titulo, 90) || '"' ||
               case nova when 'concluido' then ' · confira em Aprovações ou fale com a Branding7.' else ' · a equipe já está trabalhando nele.' end,
             '#/pedidos'
        from public.perfis p where p.id = ped.perfil_id and p.estado = 'ativa'
      on conflict (evento_id, destinatario_id) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public._cliente_pedido_sync() from public, anon, authenticated;
create or replace trigger zz_cliente_pedido_sync
  after update of coluna, concluida_em, arquivada_em, deleted_at on public.kanban_demandas
  for each row execute function public._cliente_pedido_sync();

-- ============================ 4) lembrete ao cliente de aprovações paradas
-- Dia útil, 10h: quem decide (dono/gestor) recebe "N materiais esperando
-- você" quando há material pendente há 2 dias ou mais. No máximo um
-- lembrete a cada 3 dias por empresa.
create or replace function public._aprov_lembrar_clientes()
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := public.notif_hoje(); r record; evid uuid; total integer := 0; n integer;
begin
  if extract(isodow from hoje) > 5 then return 0; end if;
  for r in
    select a.client_id, count(*) qtd,
           max(hoje - (a.enviado_em at time zone 'America/Sao_Paulo')::date) dias
      from public.aprovacoes a join public.clientes c on c.id = a.client_id
     where a.deleted_at is null and a.situacao in ('pendente','parcial')
       and coalesce(c.servico, 'ativo') = 'ativo'
       and (a.enviado_em at time zone 'America/Sao_Paulo')::date <= hoje - 2
     group by a.client_id
  loop
    if exists (select 1 from public.eventos_dominio e where e.tipo = 'aprovacao.lembrete'
                and e.client_id = r.client_id and e.created_at > now() - interval '3 days') then
      continue;
    end if;
    evid := null;
    insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, payload, processado_em)
    values ('aprovacao.lembrete', 'aprovacao.lembrete:' || r.client_id || ':' || hoje, r.client_id, 'sistema',
            jsonb_build_object('pendentes', r.qtd, 'dias', r.dias), now())
    on conflict (chave) do nothing returning id into evid;
    if evid is null then continue; end if;
    insert into public.notificacoes (evento_id, destinatario_id, client_id, tipo, titulo, mensagem, link)
    select evid, p.id, r.client_id, 'aprovacao.lembrete',
           case when r.qtd = 1 then 'Um material esperando sua aprovação' else r.qtd || ' materiais esperando sua aprovação' end,
           'O mais antigo foi enviado ' || public.notif_ha_dias(r.dias) || '. Leva poucos minutos e a produção segue.',
           '#/aprovacoes'
      from public.perfis p join public.perfil_clientes pc on pc.perfil_id = p.id
     where pc.client_id = r.client_id and pc.papel in ('dono','gestor')
       and p.estado = 'ativa' and p.papel = 'cliente'
    on conflict (evento_id, destinatario_id) do nothing;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  return total;
end $$;
revoke execute on function public._aprov_lembrar_clientes() from public, anon, authenticated;

-- entra no relógio que já roda de hora em hora (notif-agendados)
create or replace function public.notif_verificar_agendados()
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare h integer := extract(hour from now() at time zone 'America/Sao_Paulo')::int;
begin
  if h < 8 or h > 19 then return; end if;
  perform public._video_alertas_prazo(null);
  perform public._design_alertas_prazo();
  if h = 8 then
    perform public._notif_resumo_diario();
    perform public._design_alertas_parados();
    perform public._producao_alertas_lembretes();
    perform public._oportunidades_aviso_do_dia();
  end if;
  if h = 9 then perform public._prazos_risco_avisar(); end if;
  if h = 10 then perform public._aprov_lembrar_clientes(); end if;
end $function$;
