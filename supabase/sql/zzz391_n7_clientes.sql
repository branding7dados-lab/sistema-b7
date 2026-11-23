-- 4.89.0 — PUXAR O CADASTRO DOS CLIENTES DO NÚCLEO 7
--   • clientes_interno.n7_cliente_id: com qual cliente do Núcleo 7 este está ligado (um para um);
--   • cliente_cadastro_pode_puxar(): quem pode puxar um por vez (quem edita o cliente) e todos (administrador);
--   • cliente_cadastro / cliente_cadastro_salvar ganham o vínculo e a logo do Núcleo 7 (só entra se o cliente
--     estiver sem logo), na DEFINIÇÃO QUE ESTÁ NO AR.
-- O B7 só LÊ o Núcleo 7 (função n7-clientes); nada aqui escreve lá. Pode rodar mais de uma vez.

alter table public.clientes_interno add column if not exists n7_cliente_id text;
create unique index if not exists clientes_interno_n7_unico on public.clientes_interno (n7_cliente_id) where n7_cliente_id is not null;

create or replace function public.cliente_cadastro_pode_puxar()
returns jsonb language sql stable security definer set search_path to 'public'
as $$ select jsonb_build_object('um', coalesce(public._cadastro_pode_editar(), false), 'todos', coalesce(public.sou_admin(), false)) $$;
revoke all on function public.cliente_cadastro_pode_puxar() from public, anon;
grant execute on function public.cliente_cadastro_pode_puxar() to authenticated;

do $$
declare d text; n text;
begin
  -- ler: devolve o vínculo
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'cliente_cadastro' and pg_get_function_identity_arguments(p.oid) = 'p_cliente uuid';
  if d is null then raise exception 'zzz391: cliente_cadastro não existe (rode a zzz389 e a zzz390 antes).'; end if;
  if position('n7_cliente_id' in d) = 0 then
    n := replace(d, $a$'contrato_meses', i.contrato_meses, 'observacoes'$a$, $b$'contrato_meses', i.contrato_meses, 'n7_cliente_id', i.n7_cliente_id, 'observacoes'$b$);
    n := replace(n, $a$'contrato_meses', null, 'observacoes', '')$a$, $b$'contrato_meses', null, 'n7_cliente_id', null, 'observacoes', '')$b$);
    if position($c$'n7_cliente_id', i.n7_cliente_id$c$ in n) = 0 or position($c$'n7_cliente_id', null$c$ in n) = 0 then
      raise exception 'zzz391: não achei os pontos de troca em cliente_cadastro.';
    end if;
    execute n;
  end if;

  -- salvar: o vínculo (um cliente do Núcleo 7 para um do B7) e a logo do Núcleo 7
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'cliente_cadastro_salvar' and pg_get_function_identity_arguments(p.oid) = 'p_cliente uuid, p_dados jsonb';
  if d is null then raise exception 'zzz391: cliente_cadastro_salvar não existe (rode a zzz389 e a zzz390 antes).'; end if;
  if position('n7_cliente_id' in d) = 0 then
    n := replace(d, $a$    insert into public.clientes_interno (client_id) values (c.id) on conflict (client_id) do nothing;$a$,
      $b$    if d ? 'n7_cliente_id' and nullif(trim(d->>'n7_cliente_id'), '') is not null then
      if length(d->>'n7_cliente_id') > 80 then raise exception 'Identificador do Núcleo 7 inválido.'; end if;
      select cl.nome into t from public.clientes_interno ix join public.clientes cl on cl.id = ix.client_id
       where ix.n7_cliente_id = trim(d->>'n7_cliente_id') and ix.client_id <> c.id limit 1;
      if t is not null then raise exception 'Esse cliente do Núcleo 7 já está ligado a "%" no B7.', t; end if;
    end if;
    insert into public.clientes_interno (client_id) values (c.id) on conflict (client_id) do nothing;$b$);
    n := replace(n, $a$      contrato_meses = case when d ? 'contrato_meses'$a$,
      $b$      n7_cliente_id = case when d ? 'n7_cliente_id' then nullif(trim(d->>'n7_cliente_id'), '') else i.n7_cliente_id end,
      contrato_meses = case when d ? 'contrato_meses'$b$);
    n := replace(n, $a$  -- 2) área de atuação, site e Instagram (ficam com a inteligência do cliente)$a$,
      $b$  -- 1b) logo vinda do Núcleo 7: só entra quando o cliente está sem logo
  if coalesce(trim(p_dados->>'logo_n7'), '') <> '' then
    if trim(p_dados->>'logo_n7') !~* '^https://[^\s]+$' or length(p_dados->>'logo_n7') > 600 then raise exception 'A logo do Núcleo 7 tem um endereço inválido.'; end if;
    update public.clientes set logo_url = trim(p_dados->>'logo_n7') where id = c.id and coalesce(logo_url, '') = '';
  end if;

  -- 2) área de atuação, site e Instagram (ficam com a inteligência do cliente)$b$);
    if position('n7_cliente_id = case' in n) = 0 or position('já está ligado a' in n) = 0 or position('logo vinda do Núcleo 7' in n) = 0 then
      raise exception 'zzz391: não achei os pontos de troca em cliente_cadastro_salvar.';
    end if;
    execute n;
  end if;
end $$;
