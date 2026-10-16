-- =====================================================================
-- REFERÊNCIA DA LINHA → GRAVAÇÃO: "só edição" ou "edição e gravação" (zzz205)
-- Todo link de referência da linha editorial (o de cada conteúdo e os
-- da linha inteira) aparece na gravação do cliente, e a pessoa escolhe
-- para que ele serve. A escolha vale para AQUELE link: se o link mudar,
-- volta a "decidir". Só acrescenta: tabela nova + 2 funções.
-- =====================================================================
create table if not exists public.linha_ref_uso (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null,   -- sem chave estrangeira de propósito: não trava a linha/conteúdo e sobra de exclusão é inofensiva (as funções só leem o que ainda existe)
  conteudo_id uuid,
  link text not null,
  uso text not null check (uso in ('edicao', 'gravacao')),
  decidido_por uuid,
  decidido_em timestamptz not null default now()
);
create unique index if not exists linha_ref_uso_chave
  on public.linha_ref_uso (linha_id, coalesce(conteudo_id, '00000000-0000-0000-0000-000000000000'::uuid), link);
alter table public.linha_ref_uso enable row level security;
drop policy if exists linha_ref_uso_ler on public.linha_ref_uso;
create policy linha_ref_uso_ler on public.linha_ref_uso for select
  using (coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer', 'videomaker'), false));
revoke all on public.linha_ref_uso from anon;
grant select on public.linha_ref_uso to authenticated;

-- decidir (ou trocar) o uso de um link
create or replace function public.ref_uso_decidir(p_linha_id uuid, p_conteudo_id uuid, p_link text, p_uso text)
returns void language plpgsql security definer set search_path = public as $$
declare v_link text := btrim(coalesce(p_link, '')); v_ok boolean := false;
begin
  if not coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer', 'videomaker'), false) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_uso not in ('edicao', 'gravacao') then raise exception 'Escolha "só edição" ou "edição e gravação".'; end if;
  if p_conteudo_id is not null then
    select true into v_ok from public.conteudos
     where id = p_conteudo_id and linha_id = p_linha_id and deleted_at is null and btrim(coalesce(referencia_link, '')) = v_link;
  else
    select true into v_ok from public.linhas_editoriais l
     where l.id = p_linha_id and l.deleted_at is null
       and v_link in (select btrim(x) from regexp_split_to_table(coalesce(l.referencias, ''), E'\n') x);
  end if;
  if not coalesce(v_ok, false) then raise exception 'Esse link não está mais na linha editorial.'; end if;
  insert into public.linha_ref_uso (linha_id, conteudo_id, link, uso, decidido_por)
  values (p_linha_id, p_conteudo_id, v_link, p_uso, auth.uid())
  on conflict (linha_id, coalesce(conteudo_id, '00000000-0000-0000-0000-000000000000'::uuid), link)
  do update set uso = excluded.uso, decidido_por = excluded.decidido_por, decidido_em = now();
end $$;
revoke all on function public.ref_uso_decidir(uuid, uuid, text, text) from public;
revoke all on function public.ref_uso_decidir(uuid, uuid, text, text) from anon;
grant execute on function public.ref_uso_decidir(uuid, uuid, text, text) to authenticated;

-- referências da linha do mês desta gravação (mês de produção; sem ele, o mês da data; sem data, a linha mais recente)
create or replace function public.gravacao_referencias_linha(p_gravacao_id uuid)
returns table (linha_id uuid, conteudo_id uuid, conteudo_titulo text, conteudo_tipo text, origem text, link text, uso text, automatico boolean)
language plpgsql stable security invoker set search_path = public as $$
declare g public.gravacoes%rowtype; v_ano int; v_mes int;
begin
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then return; end if;
  v_ano := g.competencia_ano; v_mes := g.competencia_mes;
  if v_ano is null and g.data_gravacao is not null then
    v_ano := extract(year from g.data_gravacao); v_mes := extract(month from g.data_gravacao);
  end if;
  if v_ano is null then
    select l.ano, l.mes into v_ano, v_mes from public.linhas_editoriais l
     where l.client_id = g.client_id and l.deleted_at is null order by l.ano desc, l.mes desc limit 1;
  end if;
  return query
  with ls as (
    select l.id, l.referencias from public.linhas_editoriais l
     where l.client_id = g.client_id and l.deleted_at is null and l.ano = v_ano and l.mes = v_mes
  ),
  doc as (
    select ls.id as lid, c.id as cid, c.titulo as ctit, c.tipo as ctipo, 'conteudo'::text as org,
           btrim(c.referencia_link) as lk, (c.producao_video = 'edicao') as so_edicao
      from ls join public.conteudos c on c.linha_id = ls.id and c.deleted_at is null and btrim(coalesce(c.referencia_link, '')) <> ''
    union all
    select ls.id, null, null, null, 'linha', btrim(x), false
      from ls, regexp_split_to_table(coalesce(ls.referencias, ''), E'\n') x
     where btrim(x) ~* '^https?://[^\s]+$'
  )
  select d.lid, d.cid, d.ctit, d.ctipo, d.org, d.lk,
         coalesce(u.uso, case when d.so_edicao then 'edicao' end),
         (u.uso is null and d.so_edicao)
    from doc d
    left join public.linha_ref_uso u on u.linha_id = d.lid and u.link = d.lk
         and coalesce(u.conteudo_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(d.cid, '00000000-0000-0000-0000-000000000000'::uuid)
   order by d.org desc, d.ctit nulls first, d.lk;
end $$;
revoke all on function public.gravacao_referencias_linha(uuid) from public;
revoke all on function public.gravacao_referencias_linha(uuid) from anon;
grant execute on function public.gravacao_referencias_linha(uuid) to authenticated;
