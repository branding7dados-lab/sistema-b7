-- zzz268: resumo semanal por e-mail (cliente) e mural de recados da B7.
-- Aplicada como: resumo_semanal_1, resumo_semanal_2, recados_1.
-- O agendamento (cron "resumo-semanal") é criado copiando o cabeçalho do
-- cron "oportunidades-sync" — o segredo não aparece em lugar nenhum.

-- ============================================== 1) e-mail do resumo semanal
alter table public.perfis add column if not exists email_resumo text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_email_resumo_formato') then
    alter table public.perfis add constraint perfis_email_resumo_formato
      check (email_resumo is null or (char_length(email_resumo) <= 160 and email_resumo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
  end if;
end $$;

create or replace function public.meu_email_resumo()
returns text language sql stable security definer set search_path = public as $$
  select email_resumo from public.perfis where id = auth.uid()
$$;
revoke execute on function public.meu_email_resumo() from public, anon;
grant execute on function public.meu_email_resumo() to authenticated;

create or replace function public.meu_email_resumo_definir(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare e text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if auth.uid() is null then raise exception 'Entre de novo para continuar.'; end if;
  if e is not null and (char_length(e) > 160 or e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Esse e-mail não parece certo. Confira e tente de novo.';
  end if;
  update public.perfis set email_resumo = e where id = auth.uid();
end $$;
revoke execute on function public.meu_email_resumo_definir(text) from public, anon;
grant execute on function public.meu_email_resumo_definir(text) to authenticated;

-- o que vai em cada e-mail (só o servidor chama: service_role)
create or replace function public.resumo_semanal_dados()
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select public.notif_hoje() d),
  dest as (
    select p.id perfil_id, p.nome, p.email_resumo email, c.id client_id, c.nome empresa, pc.papel
      from public.perfis p
      join public.perfil_clientes pc on pc.perfil_id = p.id
      join public.clientes c on c.id = pc.client_id
     where p.papel = 'cliente' and p.estado = 'ativa' and p.email_resumo is not null
       and c.deleted_at is null and coalesce(c.servico, 'ativo') = 'ativo'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'email', d.email, 'nome', d.nome, 'empresa', d.empresa, 'papel', d.papel,
    'aprovados', (select coalesce(jsonb_agg(x.t order by x.q desc), '[]'::jsonb) from (
        select public.aprov_titulo(a) t, a.decidido_em q from public.aprovacoes a where a.client_id = d.client_id and a.deleted_at is null
           and a.situacao = 'aprovado' and a.decidido_em > now() - interval '7 days' order by a.decidido_em desc limit 6) x),
    'pendentes', (select coalesce(jsonb_agg(x.t order by x.q), '[]'::jsonb) from (
        select public.aprov_titulo(a) t, a.enviado_em q from public.aprovacoes a where a.client_id = d.client_id and a.deleted_at is null
           and a.situacao in ('pendente','parcial') order by a.enviado_em limit 6) x),
    'proximas', (select coalesce(jsonb_agg(jsonb_build_object('titulo', x.titulo, 'data', x.data_postagem) order by x.data_postagem), '[]'::jsonb) from (
        select pp.titulo, pp.data_postagem from public.portal_producao pp
         where pp.client_id = d.client_id and pp.data_postagem between (select d from hoje) and (select d from hoje) + 7
         order by pp.data_postagem limit 8) x),
    'gravacoes', (select coalesce(jsonb_agg(jsonb_build_object('nome', g.nome, 'data', g.data_gravacao) order by g.data_gravacao), '[]'::jsonb) from (
        select pg.nome, pg.data_gravacao from public.portal_gravacoes pg
         where pg.client_id = d.client_id and pg.data_gravacao between (select d from hoje) and (select d from hoje) + 14
         order by pg.data_gravacao limit 4) g),
    'pedidos_prontos', (select coalesce(jsonb_agg(cp.titulo), '[]'::jsonb) from public.cliente_pedidos cp
         where cp.client_id = d.client_id and cp.situacao = 'concluido' and cp.updated_at > now() - interval '7 days')
  )), '[]'::jsonb)
  from dest d
$$;
revoke execute on function public.resumo_semanal_dados() from public, anon, authenticated;
grant execute on function public.resumo_semanal_dados() to service_role;

-- ======================================================= 2) mural de recados
create table if not exists public.b7_recados (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clientes(id) on delete cascade,   -- null = todos os clientes
  tipo text not null default 'info' check (tipo in ('info','feriado','novidade','atencao')),
  titulo text not null check (char_length(titulo) between 3 and 100),
  texto text check (texto is null or char_length(texto) <= 600),
  ate date,                                                         -- some depois desse dia
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  arquivado_em timestamptz
);
create index if not exists b7_recados_client_idx on public.b7_recados (client_id);
create index if not exists b7_recados_criado_por_idx on public.b7_recados (criado_por);
alter table public.b7_recados enable row level security;
grant select on public.b7_recados to authenticated;
create policy b7_recados_le on public.b7_recados for select to authenticated
  using ((select public.sou_equipe_interna()) or (arquivado_em is null and (client_id is null or public.posso_ver_cliente(client_id))));

create or replace function public.recado_salvar(p_client uuid, p_tipo text, p_titulo text, p_texto text, p_ate date)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid;
begin
  if not public.sou_admin() then raise exception 'Só o administrador publica recados.'; end if;
  if p_tipo not in ('info','feriado','novidade','atencao') then raise exception 'Tipo inválido.'; end if;
  if char_length(btrim(coalesce(p_titulo, ''))) < 3 then raise exception 'Escreva o título do recado.'; end if;
  insert into public.b7_recados (client_id, tipo, titulo, texto, ate, criado_por)
  values (p_client, p_tipo, btrim(p_titulo), nullif(btrim(coalesce(p_texto, '')), ''), p_ate, auth.uid()) returning id into novo;
  return novo;
end $$;
revoke execute on function public.recado_salvar(uuid, text, text, text, date) from public, anon;
grant execute on function public.recado_salvar(uuid, text, text, text, date) to authenticated;

create or replace function public.recado_arquivar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin() then raise exception 'Só o administrador mexe nos recados.'; end if;
  update public.b7_recados set arquivado_em = now() where id = p_id;
end $$;
revoke execute on function public.recado_arquivar(uuid) from public, anon;
grant execute on function public.recado_arquivar(uuid) to authenticated;
