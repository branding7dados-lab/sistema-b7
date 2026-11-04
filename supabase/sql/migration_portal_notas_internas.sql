-- =====================================================================
-- zzz237: ANOTAÇÕES INTERNAS FORA DO ALCANCE DO CLIENTE
-- Pedido do Kevin ("Pode fazer sim"): o cliente lia pela API, na linha da
-- própria empresa, campos que são só da equipe. O RLS do Postgres libera
-- a LINHA inteira, não escolhe coluna, então esses campos saem da linha:
--   clientes.observacoes, servico_nota_interna, whatsapp_grupo
--     → public.clientes_interno (só a equipe lê)
--   aprovacoes/aprovacao_partes.anulacao_motivo quando NÃO marcado como
--     visível ao cliente → public.aprovacao_notas_internas (só a equipe)
-- As colunas antigas ficam (nunca DROP), mas sempre vazias:
--   • um gatilho em clientes leva o que for gravado nelas para a tabela
--     interna (vale também para versões antigas do app em cache);
--   • aprov_anular grava o motivo interno direto na tabela interna.
-- As telas da equipe continuam lendo igual: clientes_resumo e
-- aprovacoes_painel juntam a tabela interna (para o cliente, o RLS dela
-- não devolve nada e o campo vem vazio).
-- =====================================================================

-- 1) clientes ---------------------------------------------------------
create table if not exists public.clientes_interno (
  client_id uuid primary key references public.clientes(id) on delete cascade deferrable initially deferred,
  observacoes text,
  servico_nota_interna text,
  whatsapp_grupo text,
  updated_at timestamptz not null default now()
);
alter table public.clientes_interno enable row level security;
revoke all on public.clientes_interno from anon, authenticated;
grant select on public.clientes_interno to authenticated;
create policy clientes_interno_leitura on public.clientes_interno for select to authenticated
  using (public.sou_equipe_interna() or public.sou_designer() or public.sou_videomaker());

-- as colunas antigas passam a aceitar nulo (ficam sempre vazias)
alter table public.clientes alter column observacoes drop not null,
  alter column whatsapp_grupo drop not null, alter column servico_nota_interna drop not null;

create or replace function public._clientes_separar_interno()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
/* zzz237: observacoes, servico_nota_interna e whatsapp_grupo não ficam na
   linha de clientes (que o cliente lê): vão para clientes_interno. Só o
   campo que foi de fato gravado nesta operação é levado (em UPDATE, o que
   mudou em relação ao valor antigo, que fica sempre nulo). */
declare
  t_obs boolean := new.observacoes is not null and (tg_op = 'INSERT' or new.observacoes is distinct from old.observacoes);
  t_nota boolean := new.servico_nota_interna is not null and (tg_op = 'INSERT' or new.servico_nota_interna is distinct from old.servico_nota_interna);
  t_wa boolean := new.whatsapp_grupo is not null and (tg_op = 'INSERT' or new.whatsapp_grupo is distinct from old.whatsapp_grupo);
begin
  if t_obs or t_nota or t_wa then
    insert into public.clientes_interno as ci (client_id, observacoes, servico_nota_interna, whatsapp_grupo)
    values (new.id, case when t_obs then new.observacoes end, case when t_nota then new.servico_nota_interna end,
            case when t_wa then new.whatsapp_grupo end)
    on conflict (client_id) do update set
      observacoes = case when t_obs then excluded.observacoes else ci.observacoes end,
      servico_nota_interna = case when t_nota then excluded.servico_nota_interna else ci.servico_nota_interna end,
      whatsapp_grupo = case when t_wa then excluded.whatsapp_grupo else ci.whatsapp_grupo end,
      updated_at = now();
  end if;
  new.observacoes := null; new.servico_nota_interna := null; new.whatsapp_grupo := null;
  return new;
end $function$;
revoke all on function public._clientes_separar_interno() from public, anon, authenticated;
create trigger aa_clientes_separar_interno before insert or update on public.clientes
  for each row execute function public._clientes_separar_interno();

-- dados que já existiam (cópia, depois a linha base é esvaziada)
insert into public.clientes_interno (client_id, observacoes, servico_nota_interna, whatsapp_grupo)
select id, observacoes, servico_nota_interna, whatsapp_grupo from public.clientes
 where observacoes is not null or servico_nota_interna is not null or whatsapp_grupo is not null
on conflict (client_id) do update set observacoes = excluded.observacoes,
  servico_nota_interna = excluded.servico_nota_interna, whatsapp_grupo = excluded.whatsapp_grupo;
begin;
set local session_replication_role = replica;   -- só para esvaziar sem disparar auditoria/travas
update public.clientes set observacoes = null, servico_nota_interna = null, whatsapp_grupo = null
 where observacoes is not null or servico_nota_interna is not null or whatsapp_grupo is not null;
commit;

create or replace view public.clientes_resumo with (security_invoker = on) as
 select c.id, c.nome, coalesce(ci.observacoes, c.observacoes) as observacoes, c.logo_url, c.logo_path, c.is_pinned, c.deleted_at, c.created_at, c.updated_at,
    (select count(*) from public.gravacoes g where g.client_id = c.id and g.deleted_at is null and g.archived_at is null) as total_gravacoes,
    (select count(*) from public.roteiros r join public.gravacoes g2 on g2.id = r.recording_session_id
      where g2.client_id = c.id and r.deleted_at is null and g2.deleted_at is null) as total_roteiros,
    greatest(c.updated_at, coalesce((select max(g3.updated_at) from public.gravacoes g3 where g3.client_id = c.id), c.updated_at)) as ultima_atividade,
    c.teste, c.modo, coalesce(ci.whatsapp_grupo, c.whatsapp_grupo) as whatsapp_grupo
   from public.clientes c
   left join public.clientes_interno ci on ci.client_id = c.id;

-- 2) motivo interno da anulação ---------------------------------------
create table if not exists public.aprovacao_notas_internas (
  id uuid primary key default gen_random_uuid(),
  aprovacao_id uuid not null references public.aprovacoes(id) on delete cascade,
  parte_id uuid,
  anulacao_motivo text,
  created_at timestamptz not null default now()
);
alter table public.aprovacao_notas_internas enable row level security;
revoke all on public.aprovacao_notas_internas from anon, authenticated;
grant select on public.aprovacao_notas_internas to authenticated;
create unique index if not exists aprovacao_notas_internas_alvo
  on public.aprovacao_notas_internas (aprovacao_id, coalesce(parte_id, '00000000-0000-0000-0000-000000000000'::uuid));
create policy aprovacao_notas_internas_leitura on public.aprovacao_notas_internas for select to authenticated
  using (public.sou_equipe());

create or replace function public._aprov_nota_interna(p_aprovacao_id uuid, p_parte_id uuid, p_motivo text, p_visivel boolean)
 returns void language sql security definer set search_path to 'public'
as $function$
  insert into public.aprovacao_notas_internas (aprovacao_id, parte_id, anulacao_motivo)
  values (p_aprovacao_id, p_parte_id, case when coalesce(p_visivel, false) then null else nullif(trim(p_motivo), '') end)
  on conflict (aprovacao_id, coalesce(parte_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set anulacao_motivo = excluded.anulacao_motivo, created_at = now();
$function$;
revoke all on function public._aprov_nota_interna(uuid, uuid, text, boolean) from public, anon, authenticated;

insert into public.aprovacao_notas_internas (aprovacao_id, parte_id, anulacao_motivo)
select id, null, anulacao_motivo from public.aprovacoes
 where anulacao_motivo is not null and not coalesce(anulacao_visivel_cliente, false) on conflict do nothing;
insert into public.aprovacao_notas_internas (aprovacao_id, parte_id, anulacao_motivo)
select aprovacao_id, parte_id, anulacao_motivo from public.aprovacao_partes
 where anulacao_motivo is not null and not coalesce(anulacao_visivel_cliente, false) on conflict do nothing;
begin;
set local session_replication_role = replica;
update public.aprovacoes set anulacao_motivo = null where anulacao_motivo is not null and not coalesce(anulacao_visivel_cliente, false);
update public.aprovacao_partes set anulacao_motivo = null where anulacao_motivo is not null and not coalesce(anulacao_visivel_cliente, false);
commit;

-- aprovacoes_painel, aprov_anular e design_sync_decisao_cliente: a mesma
-- lógica de antes, trocando só onde mora o motivo interno. A troca é feita
-- por texto exato sobre a definição atual e falha se não achar o trecho.
do $$
declare d text; n text;
begin
  d := pg_get_viewdef('public.aprovacoes_painel'::regclass);
  n := replace(d, 'a.anulacao_motivo,',
    'COALESCE(a.anulacao_motivo, ( SELECT ni.anulacao_motivo FROM aprovacao_notas_internas ni WHERE ni.aprovacao_id = a.id AND ni.parte_id IS NULL)) AS anulacao_motivo,');
  if n = d then raise exception 'aprovacoes_painel: trecho não encontrado'; end if;
  execute 'create or replace view public.aprovacoes_painel with (security_invoker = true) as ' || rtrim(n, '; ');

  d := pg_get_functiondef('public.aprov_anular(uuid,text,uuid,text,boolean)'::regprocedure);
  if (length(d) - length(replace(d, 'anulacao_motivo = trim(p_motivo), anulacao_visivel_cliente', ''))) / length('anulacao_motivo = trim(p_motivo), anulacao_visivel_cliente') <> 2
     or position('anterior := a.situacao;' in d) = 0 or position('anterior := pt.situacao;' in d) = 0 then
    raise exception 'aprov_anular: trecho não encontrado';
  end if;
  n := replace(d, 'anulacao_motivo = trim(p_motivo), anulacao_visivel_cliente',
                  'anulacao_motivo = case when coalesce(p_visivel_cliente, false) then trim(p_motivo) end, anulacao_visivel_cliente');
  n := replace(n, 'anterior := a.situacao;', 'anterior := a.situacao; perform public._aprov_nota_interna(a.id, null, p_motivo, p_visivel_cliente);');
  n := replace(n, 'anterior := pt.situacao;', 'anterior := pt.situacao; perform public._aprov_nota_interna(a.id, p_parte_id, p_motivo, p_visivel_cliente);');
  execute n;

  d := pg_get_functiondef('public.design_sync_decisao_cliente()'::regprocedure);
  n := replace(d, 'nullif(new.anulacao_motivo, '''')',
    'nullif(coalesce(new.anulacao_motivo, (select ni.anulacao_motivo from public.aprovacao_notas_internas ni where ni.aprovacao_id = new.id and ni.parte_id is null)), '''')');
  if n = d then raise exception 'design_sync_decisao_cliente: trecho não encontrado'; end if;
  execute n;
end $$;
