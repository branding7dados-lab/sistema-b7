-- 4.88.2 — DURAÇÃO DO CONTRATO NO CADASTRO DO CLIENTE
-- O contrato passa a ser: avulso, ou 1, 3, 6, 12 meses (ou mais). Por dentro `clientes.contrato` continua
-- 'mensal' / 'avulso' (é o que o Panorama, a Gestão e o portal usam); a duração fica em
-- clientes_interno.contrato_meses, que o cliente do portal não lê.
-- As duas funções do cadastro (zzz389) ganham o campo NA DEFINIÇÃO QUE ESTÁ NO AR. Pode rodar mais de uma vez.

alter table public.clientes_interno add column if not exists contrato_meses int;
do $$ begin
  alter table public.clientes_interno add constraint clientes_interno_contrato_meses check (contrato_meses is null or contrato_meses in (1, 3, 6, 12));
exception when duplicate_object then null; end $$;

do $$
declare d text; n text;
begin
  -- ler
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'cliente_cadastro' and pg_get_function_identity_arguments(p.oid) = 'p_cliente uuid';
  if d is null then raise exception 'zzz390: cliente_cadastro não existe (rode a zzz389 antes).'; end if;
  if position('contrato_meses' in d) = 0 then
    n := replace(d, $a$'inicio_servico', i.inicio_servico, 'observacoes'$a$, $b$'inicio_servico', i.inicio_servico, 'contrato_meses', i.contrato_meses, 'observacoes'$b$);
    n := replace(n, $a$'combinado', '', 'inicio_servico', null, 'observacoes', '')$a$, $b$'combinado', '', 'inicio_servico', null, 'contrato_meses', null, 'observacoes', '')$b$);
    if n = d or position($c$'contrato_meses', null$c$ in n) = 0 then raise exception 'zzz390: não achei os pontos de troca em cliente_cadastro.'; end if;
    execute n;
  end if;

  -- salvar
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'cliente_cadastro_salvar' and pg_get_function_identity_arguments(p.oid) = 'p_cliente uuid, p_dados jsonb';
  if d is null then raise exception 'zzz390: cliente_cadastro_salvar não existe (rode a zzz389 antes).'; end if;
  if position('contrato_meses' in d) = 0 then
    n := replace(d, $a$    insert into public.clientes_interno (client_id) values (c.id) on conflict (client_id) do nothing;$a$,
      $b$    if d ? 'contrato_meses' and nullif(d->>'contrato_meses', '') is not null and (d->>'contrato_meses') not in ('1', '3', '6', '12') then
      raise exception 'A duração do contrato precisa ser 1, 3, 6 ou 12 meses.';
    end if;
    insert into public.clientes_interno (client_id) values (c.id) on conflict (client_id) do nothing;$b$);
    n := replace(n, $a$      inicio_servico = case when d ? 'inicio_servico'$a$,
      $b$      contrato_meses = case when d ? 'contrato_meses' then nullif(d->>'contrato_meses', '')::int else i.contrato_meses end,
      inicio_servico = case when d ? 'inicio_servico'$b$);
    if position('contrato_meses = case' in n) = 0 or position('precisa ser 1, 3, 6 ou 12' in n) = 0 then
      raise exception 'zzz390: não achei os pontos de troca em cliente_cadastro_salvar.';
    end if;
    execute n;
  end if;
end $$;

-- contrato avulso não tem duração: se o cliente virar avulso, a duração guardada sai
create or replace function public._clientes_contrato_avulso()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.contrato = 'avulso' and new.contrato is distinct from old.contrato then
    update public.clientes_interno set contrato_meses = null where client_id = new.id and contrato_meses is not null;
  end if;
  return new;
end $$;
revoke all on function public._clientes_contrato_avulso() from public, anon, authenticated;
drop trigger if exists clientes_contrato_avulso on public.clientes;
create trigger clientes_contrato_avulso after update of contrato on public.clientes for each row execute function public._clientes_contrato_avulso();
