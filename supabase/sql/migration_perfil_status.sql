-- zzz270: perfil na barra lateral — status da pessoa e "meu dia".
-- Aplicada como: perfil_status_1.

-- status que a equipe vê (bolinha no avatar) e recado curto
alter table public.perfis add column if not exists status_presenca text not null default 'disponivel';
alter table public.perfis add column if not exists status_recado text;
alter table public.perfis add column if not exists status_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_status_presenca_ok') then
    alter table public.perfis add constraint perfis_status_presenca_ok
      check (status_presenca in ('disponivel', 'gravacao', 'reuniao', 'ausente', 'nao_perturbe'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfis_status_recado_tam') then
    alter table public.perfis add constraint perfis_status_recado_tam check (status_recado is null or char_length(status_recado) <= 80);
  end if;
end $$;

create or replace function public.meu_status_definir(p_status text, p_recado text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r text := nullif(btrim(coalesce(p_recado, '')), '');
begin
  if auth.uid() is null then raise exception 'Entre de novo para continuar.'; end if;
  if p_status not in ('disponivel', 'gravacao', 'reuniao', 'ausente', 'nao_perturbe') then raise exception 'Status inválido.'; end if;
  if r is not null and char_length(r) > 80 then raise exception 'O recado pode ter até 80 letras.'; end if;
  update public.perfis set status_presenca = p_status, status_recado = r, status_em = now() where id = auth.uid();
  return jsonb_build_object('status', p_status, 'recado', r);
end $$;
revoke execute on function public.meu_status_definir(text, text) from public, anon;
grant execute on function public.meu_status_definir(text, text) to authenticated;

-- "Não perturbe" segura os avisos como o horário de silêncio (sino sim; push e som não;
-- ao sair do não perturbe chega o resumo, pelo mesmo caminho do silêncio)
do $$
declare d text;
begin
  select pg_get_functiondef('public.em_silencio(uuid, timestamptz)'::regprocedure) into d;
  if position('nao_perturbe' in d) = 0 then
    d := replace(d, 'begin
  if not public._silencio_valido(s)', 'begin
  if exists (select 1 from public.perfis where id = p_id and status_presenca = ''nao_perturbe'') then return true; end if;
  if not public._silencio_valido(s)');
    if position('nao_perturbe' in d) = 0 then raise exception 'em_silencio: trecho não encontrado'; end if;
    execute d;
  end if;
end $$;

-- o meu dia: o que é meu, para hoje, atrasado, e as gravações de hoje
create or replace function public.meu_dia()
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select public.notif_hoje() d),
  meus as (
    select prazo from public.demandas_edicao
     where videomaker_id = auth.uid() and deleted_at is null and editing_status in ('pendente', 'em_edicao', 'correcao')
    union all
    select prazo from public.design_deliverables
     where designer_id = auth.uid() and deleted_at is null and status in ('aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente')
  )
  select case when auth.uid() is null or not public.sou_equipe_interna() then '{}'::jsonb else jsonb_build_object(
    'abertas', (select count(*) from meus),
    'hoje', (select count(*) from meus, hoje where prazo = hoje.d),
    'atrasadas', (select count(*) from meus, hoje where prazo < hoje.d),
    'gravacoes', (select count(*) from public.gravacoes g, hoje where g.deleted_at is null and g.data_gravacao = hoje.d
                    and coalesce(g.status, '') <> 'Cancelada' and (g.videomaker_id = auth.uid() or public.sou_equipe()))
  ) end
$$;
revoke execute on function public.meu_dia() from public, anon;
grant execute on function public.meu_dia() to authenticated;
