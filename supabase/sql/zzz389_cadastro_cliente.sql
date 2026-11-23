-- 4.88.0 — CADASTRO DO CLIENTE E PACOTE POR CLIENTE
--   • dados internos do cadastro (CNPJ, cidade, responsável do cliente, combinado, início do serviço);
--   • marca do cliente (cores, fontes, link, estilo) — referência para a equipe, opcional;
--   • equipe responsável na B7 (coordenação, design, vídeo) — informação, não distribui trabalho;
--   • pacote do cliente: o padrão (clientes.pacote_id) + ajuste só dele (pacote_ajuste) + desde quando vale.
-- Nada disso é legível pelo cliente do portal: fica em tabelas internas e sai por funções que conferem a equipe.
-- Pode rodar mais de uma vez.

alter table public.clientes add column if not exists pacote_ajuste jsonb;
alter table public.clientes add column if not exists pacote_desde date;

alter table public.clientes_interno add column if not exists cnpj text;
alter table public.clientes_interno add column if not exists cidade text;
alter table public.clientes_interno add column if not exists resp_nome text;
alter table public.clientes_interno add column if not exists resp_cargo text;
alter table public.clientes_interno add column if not exists resp_whatsapp text;
alter table public.clientes_interno add column if not exists resp_email text;
alter table public.clientes_interno add column if not exists combinado text;
alter table public.clientes_interno add column if not exists inicio_servico date;

create table if not exists public.cliente_marca (
  client_id uuid primary key references public.clientes(id) on delete cascade,
  cores jsonb not null default '[]'::jsonb,      -- [{ "hex": "#1A2B3C", "nome": "principal" }]
  fonte_titulo text not null default '',
  fonte_texto text not null default '',
  link text not null default '',
  estilo text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.cliente_responsaveis (
  client_id uuid not null references public.clientes(id) on delete cascade,
  funcao text not null check (funcao in ('coordenador', 'designer', 'videomaker')),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  primary key (client_id, funcao)
);
create index if not exists cliente_responsaveis_perfil on public.cliente_responsaveis (perfil_id);

alter table public.cliente_marca enable row level security;
alter table public.cliente_responsaveis enable row level security;
revoke all on public.cliente_marca, public.cliente_responsaveis from anon, authenticated;
grant select on public.cliente_marca, public.cliente_responsaveis to authenticated;
drop policy if exists cliente_marca_leitura on public.cliente_marca;
create policy cliente_marca_leitura on public.cliente_marca for select to authenticated
  using (public.sou_equipe_interna() or public.sou_designer() or public.sou_videomaker());
drop policy if exists cliente_responsaveis_leitura on public.cliente_responsaveis;
create policy cliente_responsaveis_leitura on public.cliente_responsaveis for select to authenticated
  using (public.sou_equipe_interna() or public.sou_designer() or public.sou_videomaker());

-- quem é da casa (lê o cadastro) e quem edita cliente
create or replace function public._cadastro_pode_ler()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.sou_equipe_interna() or public.sou_designer() or public.sou_videomaker(), false) $$;
create or replace function public._cadastro_pode_editar()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.pode_nivel_acao('cliente.editar'), false) $$;   -- a mesma regra da política de UPDATE em clientes
revoke all on function public._cadastro_pode_ler() from public, anon, authenticated;
revoke all on function public._cadastro_pode_editar() from public, anon, authenticated;

-- trocar o pacote descarta o ajuste (o ajuste é do pacote antigo), a não ser que venha um ajuste novo junto
create or replace function public._clientes_pacote_ajuste()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.pacote_id is distinct from old.pacote_id and new.pacote_ajuste is not distinct from old.pacote_ajuste then
    new.pacote_ajuste := null;
  end if;
  if new.pacote_id is null then new.pacote_ajuste := null; end if;
  -- o ajuste entra na conta do Contratado × entregue: lixo aqui derrubaria a Gestão de todo mundo
  if new.pacote_ajuste is not null and new.pacote_ajuste is distinct from old.pacote_ajuste and not public._pacote_valido(new.pacote_ajuste) then
    raise exception 'O ajuste do pacote está inválido: use de 1 a 120 conteúdos no mês.';
  end if;
  return new;
end $$;
drop trigger if exists clientes_pacote_ajuste on public.clientes;
create trigger clientes_pacote_ajuste before update on public.clientes for each row execute function public._clientes_pacote_ajuste();

-- itens que valem para o cliente: o ajuste dele, se houver; senão os do pacote padrão
create or replace function public._pacote_itens_cliente(p_cliente uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(case when c.pacote_id is not null and jsonb_typeof(c.pacote_ajuste) = 'array' and jsonb_array_length(c.pacote_ajuste) > 0
                       then c.pacote_ajuste else p.itens end, '[]'::jsonb)
    from public.clientes c left join public.pacotes_producao p on p.id = c.pacote_id where c.id = p_cliente
$$;
revoke all on function public._pacote_itens_cliente(uuid) from public, anon, authenticated;

create or replace function public._pacote_efetivo(p_cliente uuid)
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object('pacote_id', c.pacote_id, 'nome', p.nome, 'arquivado', p.arquivado_em is not null,
           'ajustado', coalesce(c.pacote_id is not null and jsonb_typeof(c.pacote_ajuste) = 'array' and jsonb_array_length(c.pacote_ajuste) > 0, false),
           'desde', c.pacote_desde, 'itens', public._pacote_itens_cliente(c.id), 'padrao', coalesce(p.itens, '[]'::jsonb))
    from public.clientes c left join public.pacotes_producao p on p.id = c.pacote_id where c.id = p_cliente
$$;
revoke all on function public._pacote_efetivo(uuid) from public, anon, authenticated;

create or replace function public.cliente_pacote_efetivo(p_cliente uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._cadastro_pode_ler() then raise exception 'Só a equipe vê o pacote do cliente.' using errcode = '42501'; end if;
  return public._pacote_efetivo(p_cliente);
end $$;
revoke all on function public.cliente_pacote_efetivo(uuid) from public, anon;
grant execute on function public.cliente_pacote_efetivo(uuid) to authenticated;

-- ------------------------------------------------------------ ler o cadastro inteiro
create or replace function public.cliente_cadastro(p_cliente uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare c public.clientes; r jsonb;
begin
  if not public._cadastro_pode_ler() then raise exception 'Só a equipe vê o cadastro do cliente.' using errcode = '42501'; end if;
  select * into c from public.clientes where id = p_cliente and deleted_at is null;
  if c.id is null then raise exception 'Cliente não encontrado.'; end if;
  r := jsonb_build_object(
    'cliente', jsonb_build_object('id', c.id, 'nome', c.nome, 'contrato', coalesce(c.contrato, 'mensal'), 'modo', coalesce(c.modo, 'linha'),
                 'logo_url', c.logo_url, 'logo_path', c.logo_path),
    'interno', coalesce((select jsonb_build_object('cnpj', coalesce(i.cnpj, ''), 'cidade', coalesce(i.cidade, ''), 'resp_nome', coalesce(i.resp_nome, ''),
                 'resp_cargo', coalesce(i.resp_cargo, ''), 'resp_whatsapp', coalesce(i.resp_whatsapp, ''), 'resp_email', coalesce(i.resp_email, ''),
                 'combinado', coalesce(i.combinado, ''), 'inicio_servico', i.inicio_servico, 'observacoes', coalesce(i.observacoes, ''))
                 from public.clientes_interno i where i.client_id = c.id),
               jsonb_build_object('cnpj', '', 'cidade', '', 'resp_nome', '', 'resp_cargo', '', 'resp_whatsapp', '', 'resp_email', '',
                 'combinado', '', 'inicio_servico', null, 'observacoes', '')),
    'perfil', coalesce((select jsonb_build_object('nicho', coalesce(n.nicho, ''), 'site', coalesce(n.site, ''), 'instagram', coalesce(n.instagram, ''))
                 from public.cliente_inteligencia n where n.client_id = c.id limit 1),
               jsonb_build_object('nicho', '', 'site', '', 'instagram', '')),
    'marca', coalesce((select jsonb_build_object('cores', m.cores, 'fonte_titulo', m.fonte_titulo, 'fonte_texto', m.fonte_texto, 'link', m.link, 'estilo', m.estilo)
                 from public.cliente_marca m where m.client_id = c.id),
               jsonb_build_object('cores', '[]'::jsonb, 'fonte_titulo', '', 'fonte_texto', '', 'link', '', 'estilo', '')),
    'pacote', public._pacote_efetivo(c.id),
    'equipe', (select jsonb_object_agg(f.funcao, (select jsonb_build_object('id', p.id, 'nome', p.nome, 'avatar_url', p.avatar_url)
                   from public.cliente_responsaveis cr join public.perfis p on p.id = cr.perfil_id
                  where cr.client_id = c.id and cr.funcao = f.funcao))
                 from (values ('coordenador'), ('designer'), ('videomaker')) f(funcao)),
    'pode_editar', public._cadastro_pode_editar());
  return r;
end $$;
revoke all on function public.cliente_cadastro(uuid) from public, anon;
grant execute on function public.cliente_cadastro(uuid) to authenticated;

-- quem pode ser responsável por cada função (para a lista da tela)
create or replace function public._cadastro_serve(p_perfil uuid, p_funcao text)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.perfis p where p.id = p_perfil and p.estado = 'ativa' and p.papel <> 'cliente'
     and (p.papel = p_funcao or p.funcao = p_funcao or coalesce(public.tenho_funcao_extra(p_funcao, p.id), false)
          or (p_funcao = 'coordenador' and p.papel = 'admin')))
$$;
revoke all on function public._cadastro_serve(uuid, text) from public, anon, authenticated;

create or replace function public.cliente_cadastro_pessoas()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._cadastro_pode_ler() then raise exception 'Só a equipe vê a lista.' using errcode = '42501'; end if;
  return (select jsonb_object_agg(f.funcao, (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome), '[]'::jsonb)
             from public.perfis p where public._cadastro_serve(p.id, f.funcao)))
            from (values ('coordenador'), ('designer'), ('videomaker')) f(funcao));
end $$;
revoke all on function public.cliente_cadastro_pessoas() from public, anon;
grant execute on function public.cliente_cadastro_pessoas() to authenticated;

-- ------------------------------------------------------------ salvar (só as partes que vieram)
create or replace function public.cliente_cadastro_salvar(p_cliente uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare c public.clientes; d jsonb; e jsonb; t text; v text; f text; pid uuid; n int; novo_pacote uuid; aj jsonb; pk public.pacotes_producao;
begin
  if not public._cadastro_pode_editar() then raise exception 'Seu acesso não deixa editar o cadastro do cliente.' using errcode = '42501'; end if;
  select * into c from public.clientes where id = p_cliente and deleted_at is null;
  if c.id is null then raise exception 'Cliente não encontrado.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados inválidos.'; end if;

  -- 1) dados internos
  d := p_dados->'interno';
  if d is not null then
    if d ? 'cnpj' then
      v := regexp_replace(coalesce(d->>'cnpj', ''), '\D', '', 'g');
      if v <> '' and length(v) <> 14 then raise exception 'O CNPJ precisa ter 14 números.'; end if;
      d := jsonb_set(d, '{cnpj}', to_jsonb(v));
    end if;
    if d ? 'resp_whatsapp' then
      v := regexp_replace(coalesce(d->>'resp_whatsapp', ''), '\D', '', 'g');
      if v <> '' and length(v) not between 10 and 13 then raise exception 'O WhatsApp precisa ter de 10 a 13 números, com DDD.'; end if;
      d := jsonb_set(d, '{resp_whatsapp}', to_jsonb(v));
    end if;
    if d ? 'resp_email' then
      v := lower(trim(coalesce(d->>'resp_email', '')));
      if v <> '' and v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'O e-mail não parece certo.'; end if;
      d := jsonb_set(d, '{resp_email}', to_jsonb(v));
    end if;
    for t in select * from unnest(array['cidade', 'resp_nome', 'resp_cargo', 'combinado', 'observacoes']) loop
      if d ? t and length(coalesce(d->>t, '')) > (case when t in ('combinado', 'observacoes') then 4000 else 160 end) then
        raise exception 'O texto de "%" ficou grande demais.', t;
      end if;
    end loop;
    insert into public.clientes_interno (client_id) values (c.id) on conflict (client_id) do nothing;
    update public.clientes_interno i set
      cnpj = case when d ? 'cnpj' then nullif(d->>'cnpj', '') else i.cnpj end,
      cidade = case when d ? 'cidade' then nullif(trim(d->>'cidade'), '') else i.cidade end,
      resp_nome = case when d ? 'resp_nome' then nullif(trim(d->>'resp_nome'), '') else i.resp_nome end,
      resp_cargo = case when d ? 'resp_cargo' then nullif(trim(d->>'resp_cargo'), '') else i.resp_cargo end,
      resp_whatsapp = case when d ? 'resp_whatsapp' then nullif(d->>'resp_whatsapp', '') else i.resp_whatsapp end,
      resp_email = case when d ? 'resp_email' then nullif(d->>'resp_email', '') else i.resp_email end,
      combinado = case when d ? 'combinado' then nullif(trim(d->>'combinado'), '') else i.combinado end,
      observacoes = case when d ? 'observacoes' then nullif(trim(d->>'observacoes'), '') else i.observacoes end,
      inicio_servico = case when d ? 'inicio_servico' then nullif(d->>'inicio_servico', '')::date else i.inicio_servico end,
      updated_at = now()
     where i.client_id = c.id;
  end if;

  -- 2) área de atuação, site e Instagram (ficam com a inteligência do cliente)
  d := p_dados->'perfil';
  if d is not null then
    if d ? 'site' and coalesce(trim(d->>'site'), '') <> '' and trim(d->>'site') !~* '^https?://' then
      d := jsonb_set(d, '{site}', to_jsonb('https://' || trim(d->>'site')));
    end if;
    if not exists (select 1 from public.cliente_inteligencia n where n.client_id = c.id) then
      insert into public.cliente_inteligencia (client_id) values (c.id);
    end if;
    update public.cliente_inteligencia n set
      nicho = case when d ? 'nicho' then left(trim(coalesce(d->>'nicho', '')), 160) else n.nicho end,
      site = case when d ? 'site' then left(trim(coalesce(d->>'site', '')), 300) else n.site end,
      instagram = case when d ? 'instagram' then left(regexp_replace(trim(coalesce(d->>'instagram', '')), '^@+', ''), 60) else n.instagram end
     where n.client_id = c.id;
  end if;

  -- 3) marca
  d := p_dados->'marca';
  if d is not null then
    if d ? 'cores' then
      if jsonb_typeof(d->'cores') <> 'array' then raise exception 'As cores vieram num formato inválido.'; end if;
      if jsonb_array_length(d->'cores') > 8 then raise exception 'São no máximo 8 cores.'; end if;
      for e in select * from jsonb_array_elements(d->'cores') loop
        if coalesce(e->>'hex', '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida: use o formato #RRGGBB.'; end if;
        if length(coalesce(e->>'nome', '')) > 40 then raise exception 'O nome da cor ficou grande demais.'; end if;
      end loop;
      d := jsonb_set(d, '{cores}', (select coalesce(jsonb_agg(jsonb_build_object('hex', upper(x->>'hex'), 'nome', trim(coalesce(x->>'nome', '')))), '[]'::jsonb)
                                      from jsonb_array_elements(d->'cores') x));
    end if;
    if d ? 'link' and coalesce(trim(d->>'link'), '') <> '' and trim(d->>'link') !~* '^https://[^\s]+$' then
      raise exception 'O link do material da marca precisa começar com https://';
    end if;
    insert into public.cliente_marca (client_id) values (c.id) on conflict (client_id) do nothing;
    update public.cliente_marca m set
      cores = case when d ? 'cores' then d->'cores' else m.cores end,
      fonte_titulo = case when d ? 'fonte_titulo' then left(trim(coalesce(d->>'fonte_titulo', '')), 80) else m.fonte_titulo end,
      fonte_texto = case when d ? 'fonte_texto' then left(trim(coalesce(d->>'fonte_texto', '')), 80) else m.fonte_texto end,
      link = case when d ? 'link' then left(trim(coalesce(d->>'link', '')), 500) else m.link end,
      estilo = case when d ? 'estilo' then left(trim(coalesce(d->>'estilo', '')), 2000) else m.estilo end,
      updated_at = now()
     where m.client_id = c.id;
  end if;

  -- 4) pacote: { pacote_id, ajuste (lista de itens ou null), desde }
  d := p_dados->'pacote';
  if d is not null then
    novo_pacote := case when d ? 'pacote_id' then nullif(d->>'pacote_id', '')::uuid else c.pacote_id end;
    aj := case when d ? 'ajuste' then nullif(d->'ajuste', 'null'::jsonb) else (case when novo_pacote is not distinct from c.pacote_id then c.pacote_ajuste end) end;
    if novo_pacote is not null then
      select * into pk from public.pacotes_producao where id = novo_pacote;
      if pk.id is null then raise exception 'Pacote não encontrado.'; end if;
      if pk.arquivado_em is not null and novo_pacote is distinct from c.pacote_id then raise exception 'Esse pacote está arquivado.'; end if;
    else
      aj := null;
    end if;
    if aj is not null then
      if not public._pacote_valido(aj) then raise exception 'O ajuste do pacote está inválido: use de 1 a 120 conteúdos no mês.'; end if;
      if aj = pk.itens then aj := null; end if;   -- igual ao padrão não é ajuste
    end if;
    update public.clientes set pacote_id = novo_pacote, pacote_ajuste = aj,
           pacote_desde = case when d ? 'desde' then nullif(d->>'desde', '')::date else pacote_desde end
     where id = c.id;
    -- o gatilho limpa o ajuste quando o pacote muda sem ajuste novo; aqui o ajuste novo, se veio, é regravado
    if aj is not null then update public.clientes set pacote_ajuste = aj where id = c.id and pacote_ajuste is distinct from aj; end if;
  end if;

  -- 5) equipe responsável: { coordenador: uuid|null, designer: …, videomaker: … }
  d := p_dados->'equipe';
  if d is not null then
    for f in select * from unnest(array['coordenador', 'designer', 'videomaker']) loop
      if d ? f then
        pid := nullif(d->>f, '')::uuid;
        if pid is null then
          delete from public.cliente_responsaveis where client_id = c.id and funcao = f;
        else
          if not public._cadastro_serve(pid, f) then raise exception 'Essa pessoa não pode ser responsável por essa função.'; end if;
          insert into public.cliente_responsaveis (client_id, funcao, perfil_id) values (c.id, f, pid)
          on conflict (client_id, funcao) do update set perfil_id = excluded.perfil_id;
        end if;
      end if;
    end loop;
  end if;

  return public.cliente_cadastro(c.id);
end $$;
revoke all on function public.cliente_cadastro_salvar(uuid, jsonb) from public, anon;
grant execute on function public.cliente_cadastro_salvar(uuid, jsonb) to authenticated;

-- quantos clientes estão em cada pacote (aba Pacotes da Gestão)
create or replace function public.pacotes_uso()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public._cadastro_pode_ler() then raise exception 'Só a equipe vê os pacotes.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_object_agg(x.pacote_id, x.n), '{}'::jsonb) from (
            select c.pacote_id, count(*) n from public.clientes c
             where c.deleted_at is null and c.pacote_id is not null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)
             group by 1) x);
end $$;
revoke all on function public.pacotes_uso() from public, anon;
grant execute on function public.pacotes_uso() to authenticated;

-- ------------------------------------------------------------ Contratado × entregue com o pacote do cliente
-- usa o ajuste (somando por tipo) e deixa de fora quem só começa o pacote depois do mês pedido
create or replace function public._contratado(p_ini date)
returns table (client_id uuid, nome text, logo_url text, pacote text, itens jsonb, contratado int, planejados int, publicados int)
language sql stable security definer set search_path to 'public' as $$
  with cli as (
    select c.id, c.nome, c.logo_url, p.nome pacote, public._pacote_itens_cliente(c.id) itens
      from public.clientes c join public.pacotes_producao p on p.id = c.pacote_id
     where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)
       and (c.pacote_desde is null or c.pacote_desde < (p_ini + interval '1 month')::date)),
  it as (select cli.id, e->>'tipo' tipo, sum(coalesce((e->>'qtd')::int, 0))::int qtd from cli, jsonb_array_elements(cli.itens) e group by 1, 2),
  ct as (
    select c.client_id, c.tipo, count(*) planejados,
           count(*) filter (where c.status = 'Publicado' and c.data_postagem <= public.notif_hoje()) publicados
      from public.conteudos c
     where c.deleted_at is null and c.archived_at is null and c.data_postagem >= p_ini and c.data_postagem < (p_ini + interval '1 month')::date
     group by 1, 2),
  por as (
    select it.id, jsonb_agg(jsonb_build_object('tipo', it.tipo, 'contratado', it.qtd, 'planejados', coalesce(ct.planejados, 0),
             'publicados', coalesce(ct.publicados, 0)) order by it.tipo) itens,
           sum(it.qtd)::int contratado, sum(coalesce(ct.planejados, 0))::int planejados, sum(least(coalesce(ct.publicados, 0), it.qtd))::int publicados
      from it left join ct on ct.client_id = it.id and ct.tipo = it.tipo group by it.id)
  select cli.id, cli.nome, cli.logo_url, cli.pacote, por.itens, por.contratado, por.planejados, por.publicados
    from cli join por on por.id = cli.id
$$;
revoke all on function public._contratado(date) from public, anon, authenticated;

create or replace function public.gestao_contratado(p_ano int, p_mes int)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare ini date; fim date; hoje date := public.notif_hoje(); fechado boolean; ritmo numeric;
begin
  if not public.sou_admin() then raise exception 'Só a administração abre a Gestão.' using errcode = '42501'; end if;
  if p_mes not between 1 and 12 or p_ano not between 2020 and 2100 then raise exception 'Mês inválido.'; end if;
  ini := make_date(p_ano, p_mes, 1); fim := (ini + interval '1 month')::date;
  fechado := fim <= hoje;
  ritmo := case when fechado then 1 when hoje < ini then 0 else round(((hoje - ini + 1)::numeric / (fim - ini)), 3) end;
  return jsonb_build_object('ano', p_ano, 'mes', p_mes, 'fechado', fechado, 'ritmo', ritmo,
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object('id', x.client_id, 'nome', x.nome, 'logo', x.logo_url, 'pacote', x.pacote,
        'itens', x.itens, 'contratado', x.contratado, 'planejados', x.planejados, 'publicados', x.publicados,
        'ajustado', coalesce((select jsonb_typeof(c.pacote_ajuste) = 'array' and jsonb_array_length(c.pacote_ajuste) > 0 from public.clientes c where c.id = x.client_id), false),
        'faltam', greatest(0, x.contratado - x.publicados),
        'abaixo', fechado and x.publicados < x.contratado,
        'atras_ritmo', not fechado and x.publicados < floor(x.contratado * ritmo))
        order by (x.publicados::numeric / nullif(x.contratado, 0)), x.nome), '[]'::jsonb) from public._contratado(ini) x),
    'comeca', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'logo', c.logo_url, 'desde', c.pacote_desde) order by c.pacote_desde, c.nome), '[]'::jsonb)
        from public.clientes c where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false)
         and c.pacote_id is not null and c.pacote_desde >= fim),
    'sem_pacote', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'logo', c.logo_url) order by c.nome), '[]'::jsonb)
        from public.clientes c where c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo' and not coalesce(c.teste, false) and c.pacote_id is null));
end $$;
revoke all on function public.gestao_contratado(int, int) from public, anon;
grant execute on function public.gestao_contratado(int, int) to authenticated;

-- ------------------------------------------------------------ Nova linha editorial com o pacote do cliente
-- Na definição QUE ESTÁ NO AR: os itens passam a vir do ajuste quando a linha usa o pacote do próprio cliente.
-- (Se a linha usar outro pacote, o gatilho acima limpa o ajuste junto com a troca.)
do $$
declare d text; n text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'linha_aplicar_pacote' and pg_get_function_identity_arguments(p.oid) = 'p_linha uuid, p_pacote uuid';
  if d is null then raise exception 'zzz389: linha_aplicar_pacote não existe.'; end if;
  if position('zzz389' in d) > 0 then return; end if;
  n := replace(d, 'if not public._pacote_valido(pk.itens) then',
    '/* zzz389: pacote do próprio cliente com ajuste → vale o ajuste */' || E'\n' ||
    '  if exists (select 1 from public.clientes cx where cx.id = l.client_id and cx.pacote_id = pk.id and jsonb_typeof(cx.pacote_ajuste) = ''array'' and jsonb_array_length(cx.pacote_ajuste) > 0) then' || E'\n' ||
    '    select cx.pacote_ajuste into pk.itens from public.clientes cx where cx.id = l.client_id;' || E'\n' ||
    '  end if;' || E'\n' ||
    '  if not public._pacote_valido(pk.itens) then');
  if n = d then raise exception 'zzz389: não achei o ponto de troca em linha_aplicar_pacote.'; end if;
  execute n;
end $$;
