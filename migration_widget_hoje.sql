-- =====================================================================
-- WIDGET "HOJE NO B7" (zzz153) — app Android
--
-- O widget da tela inicial atualiza sozinho, com o app fechado. Para isso
-- ele NÃO usa a sessão do app (renovar a sessão por fora derrubaria o
-- login). Ele tem uma chave própria, só de leitura e só destes números:
--
--   1. widget_tokens: uma chave por aparelho. No banco fica só o hash
--      (sha256); a chave mesmo fica só no celular.
--   2. widget_token_novo(): a pessoa logada (app) pede uma chave. Ficam só
--      as 3 mais novas dela (um celular e alguns reinstalados).
--   3. widget_token_revogar(chave): ao sair da conta.
--   4. widget_hoje(chave): o que o widget mostra. Pode ser chamada sem
--      sessão (anon), mas sem uma chave válida devolve null.
--
-- Os números seguem o "Resumo do dia" (_notif_resumo_diario):
--   • prazos de hoje e atrasados: as demandas de vídeo e design DA PESSOA;
--   • gravações: as de hoje da pessoa (videomaker), ou todas (gestão);
--   • gestão (admin/coordenador): publicações previstas para hoje e
--     vídeos em atraso na operação.
-- O cliente de teste fica de fora.
-- =====================================================================

create table if not exists public.widget_tokens (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  hash text not null unique,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);
create index if not exists widget_tokens_perfil on public.widget_tokens (perfil_id);
alter table public.widget_tokens enable row level security;
revoke all on public.widget_tokens from anon, authenticated;

-- ---------------------------------------------------------------------
create or replace function public.widget_token_novo()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  eu uuid := auth.uid();
  chave text;
begin
  if eu is null then raise exception 'sem sessão'; end if;
  if not exists (select 1 from public.perfis where id = eu and estado = 'ativa' and papel <> 'cliente') then
    raise exception 'conta sem acesso ao widget';
  end if;
  delete from public.widget_tokens where perfil_id = eu and id not in (
    select id from public.widget_tokens where perfil_id = eu order by criado_em desc limit 2);
  chave := encode(gen_random_bytes(32), 'hex');
  insert into public.widget_tokens (perfil_id, hash) values (eu, encode(digest(chave, 'sha256'), 'hex'));
  return chave;
end;
$$;

create or replace function public.widget_token_revogar(p_chave text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.widget_tokens where hash = encode(digest(coalesce(p_chave, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------
create or replace function public.widget_hoje(p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t record; p record; hoje date := public.notif_hoje();
  gestao boolean; funcoes text[];
  n_prazos integer; n_atras integer; n_grav integer; n_pub integer := null; n_atras_op integer := null;
  prox record; tem_prox boolean := false;
begin
  if coalesce(length(p_chave), 0) < 32 then return null; end if;
  select * into t from public.widget_tokens where hash = encode(digest(p_chave, 'sha256'), 'hex');
  if not found then return null; end if;
  select pf.id, pf.nome, pf.papel, pf.estado,
         array(select f.funcao from public.perfis_funcoes_extra f where f.perfil_id = pf.id) || pf.papel as funcoes
    into p from public.perfis pf where pf.id = t.perfil_id;
  if not found or p.estado <> 'ativa' then return null; end if;
  update public.widget_tokens set usado_em = now() where id = t.id;
  funcoes := p.funcoes;
  gestao := funcoes && array['admin', 'coordenador'];

  select (select count(*) from public.demandas_edicao d
            left join public.clientes c on c.id = d.client_id
           where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
             and d.prazo = hoje and d.videomaker_id = p.id and not coalesce(c.teste, false))
       + (select count(*) from public.design_deliverables dd
            left join public.clientes c on c.id = dd.client_id
           where dd.deleted_at is null and dd.status not in ('finalizado', 'aprovado_cliente')
             and dd.prazo = hoje and dd.designer_id = p.id and not coalesce(c.teste, false))
    into n_prazos;

  select (select count(*) from public.demandas_edicao d
            left join public.clientes c on c.id = d.client_id
           where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
             and d.prazo < hoje and d.videomaker_id = p.id and not coalesce(c.teste, false))
       + (select count(*) from public.design_deliverables dd
            left join public.clientes c on c.id = dd.client_id
           where dd.deleted_at is null and dd.status not in ('finalizado', 'aprovado_cliente')
             and dd.prazo < hoje and dd.designer_id = p.id and not coalesce(c.teste, false))
    into n_atras;

  select count(*) into n_grav
    from public.gravacoes_ocorrencias o
    join public.gravacoes g on g.id = o.gravacao_id and g.deleted_at is null
    left join public.clientes c on c.id = g.client_id
   where o.atual and o.status = 'marcada'
     and (o.inicio at time zone 'America/Sao_Paulo')::date = hoje
     and not coalesce(c.teste, false)
     and (gestao or g.videomaker_id = p.id or (g.videomaker_id is null and 'videomaker' = any(funcoes)));

  /* próxima gravação (de agora em diante, até amanhã) */
  select g.nome, c.nome as cliente, o.inicio, o.sem_horario
    into prox
    from public.gravacoes_ocorrencias o
    join public.gravacoes g on g.id = o.gravacao_id and g.deleted_at is null
    left join public.clientes c on c.id = g.client_id
   where o.atual and o.status = 'marcada'
     and o.inicio >= now() - interval '1 hour'
     and (o.inicio at time zone 'America/Sao_Paulo')::date <= hoje + 1
     and not coalesce(c.teste, false)
     and (gestao or g.videomaker_id = p.id or (g.videomaker_id is null and 'videomaker' = any(funcoes)))
   order by o.inicio
   limit 1;
  tem_prox := found;

  if gestao then
    select count(*) into n_pub from public.conteudos ct
      left join public.clientes c on c.id = ct.client_id
     where ct.deleted_at is null and ct.archived_at is null
       and ct.data_postagem = hoje and coalesce(ct.status, '') <> 'Publicado'
       and not coalesce(c.teste, false);
    select count(*) into n_atras_op from public.demandas_edicao d
      left join public.clientes c on c.id = d.client_id
     where d.deleted_at is null and d.editing_status not in ('entregue', 'descartado')
       and d.prazo < hoje and not coalesce(c.teste, false);
  end if;

  return jsonb_build_object(
    'nome', split_part(coalesce(p.nome, ''), ' ', 1),
    'gestao', gestao,
    'hoje', hoje,
    'prazos_hoje', n_prazos,
    'atrasados', n_atras,
    'gravacoes_hoje', n_grav,
    'publicacoes_hoje', n_pub,
    'atrasados_operacao', n_atras_op,
    'proxima', case when not tem_prox then null else jsonb_build_object(
      'nome', prox.nome, 'cliente', prox.cliente,
      'quando', case when prox.sem_horario then to_char(prox.inicio at time zone 'America/Sao_Paulo', 'DD/MM')
                     else to_char(prox.inicio at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') end,
      'hoje', (prox.inicio at time zone 'America/Sao_Paulo')::date = hoje) end
  );
end;
$$;

revoke all on function public.widget_token_novo() from public, anon;
grant execute on function public.widget_token_novo() to authenticated;
revoke all on function public.widget_token_revogar(text) from public;
grant execute on function public.widget_token_revogar(text) to anon, authenticated;
revoke all on function public.widget_hoje(text) from public;
grant execute on function public.widget_hoje(text) to anon, authenticated;
