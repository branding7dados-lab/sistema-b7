-- zzz265: pesquisa de satisfação mensal do portal (0 a 10 + comentário).
-- Aplicada como: satisfacao_1, satisfacao_2.

create table if not exists public.cliente_satisfacao (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clientes(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  mes date not null,
  nota smallint not null check (nota between 0 and 10),
  comentario text check (comentario is null or char_length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  unique (client_id, perfil_id, mes)
);
create index if not exists cliente_satisfacao_mes_idx on public.cliente_satisfacao (mes desc, client_id);
create index if not exists cliente_satisfacao_perfil_idx on public.cliente_satisfacao (perfil_id);
alter table public.cliente_satisfacao enable row level security;
grant select on public.cliente_satisfacao to authenticated;
-- leitura: só a equipe interna (o cliente não vê a nota dos colegas)
create policy cliente_satisfacao_le on public.cliente_satisfacao for select to authenticated
  using ((select public.sou_equipe_interna()));

-- o portal pergunta a partir do dia 20, se a pessoa ainda não respondeu no mês
create or replace function public.satisfacao_pendente(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and public.meu_papel_cliente(p_client) is not null
     and extract(day from public.notif_hoje()) >= 20
     and not exists (select 1 from public.cliente_satisfacao s
                      where s.client_id = p_client and s.perfil_id = auth.uid()
                        and s.mes = date_trunc('month', public.notif_hoje())::date)
$$;
revoke execute on function public.satisfacao_pendente(uuid) from public, anon;
grant execute on function public.satisfacao_pendente(uuid) to authenticated;

create or replace function public.satisfacao_responder(p_client uuid, p_nota integer, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare eu uuid := auth.uid(); emp text; nome text; evid uuid; mes date := date_trunc('month', public.notif_hoje())::date;
  com text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if eu is null then raise exception 'Entre de novo para continuar.'; end if;
  if public.meu_papel_cliente(p_client) is null then raise exception 'Você não acompanha esta empresa.'; end if;
  if p_nota is null or p_nota < 0 or p_nota > 10 then raise exception 'Escolha uma nota de 0 a 10.'; end if;
  if char_length(coalesce(com, '')) > 1000 then raise exception 'O comentário pode ter até 1000 caracteres.'; end if;
  insert into public.cliente_satisfacao (client_id, perfil_id, mes, nota, comentario)
  values (p_client, eu, mes, p_nota, com)
  on conflict (client_id, perfil_id, mes) do update set nota = excluded.nota, comentario = excluded.comentario, created_at = now();

  select c.nome into emp from public.clientes c where c.id = p_client;
  select p.nome into nome from public.perfis p where p.id = eu;
  insert into public.eventos_dominio (tipo, chave, client_id, alvo_tipo, ator_id, ator_nome, ator_papel, payload, processado_em)
  values ('cliente.satisfacao', 'cliente.satisfacao:' || p_client || ':' || eu || ':' || mes || ':' || p_nota, p_client, 'sistema', eu, nome, 'cliente',
          jsonb_build_object('nota', p_nota), now())
  on conflict (chave) do nothing returning id into evid;
  if evid is not null then
    perform public.notif_entregar(evid, 'cliente.satisfacao',
      case when p_nota <= 6 then 'Atenção: nota ' || p_nota || ' de ' || coalesce(emp, 'um cliente')
           when p_nota >= 9 then 'Nota ' || p_nota || ' de ' || coalesce(emp, 'um cliente') || ' 🎉'
           else 'Nota ' || p_nota || ' de ' || coalesce(emp, 'um cliente') end,
      coalesce(nome, 'O cliente') || ' avaliou o mês' || coalesce(': "' || public.notif_corta(com, 120) || '"', '.'),
      '#/cliente/' || p_client, p_client, null, null, array['coordenador'], 'co_aprovacoes', null, eu);
  end if;
end $$;
revoke execute on function public.satisfacao_responder(uuid, integer, text) from public, anon;
grant execute on function public.satisfacao_responder(uuid, integer, text) to authenticated;
