-- =====================================================================
-- GRAVAÇÃO FIXA DO CLIENTE + PREPARAÇÃO DA GRAVAÇÃO (zzz206)
-- 1. O cliente pode ter um dia fixo de gravar (toda terça / todo dia 10).
--    O sistema cria sozinho a gravação com alguns dias de antecedência
--    (uma vez por data; nada é apagado nem alterado se já existir).
-- 2. Cada gravação ganha uma "preparação": data marcada, linha do mês,
--    roteiros dos Reels a gravar, referências decididas, lista montada.
-- Só acrescenta: tabela nova + funções novas + uma rotina diária.
-- =====================================================================
create table if not exists public.cliente_gravacao_fixa (
  client_id uuid primary key,
  ativa boolean not null default true,
  freq text not null check (freq in ('semanal', 'mensal')),
  dia_semana smallint check (dia_semana between 0 and 6),   -- 0 = domingo
  dia_mes smallint check (dia_mes between 1 and 31),
  hora_inicio time,
  hora_fim time,
  antecedencia_dias smallint not null default 7 check (antecedencia_dias between 1 and 30),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  check ((freq = 'semanal' and dia_semana is not null) or (freq = 'mensal' and dia_mes is not null))
);
alter table public.cliente_gravacao_fixa enable row level security;
drop policy if exists cliente_gravacao_fixa_ler on public.cliente_gravacao_fixa;
create policy cliente_gravacao_fixa_ler on public.cliente_gravacao_fixa for select
  using (coalesce(public.meu_papel() in ('admin', 'coordenador', 'designer', 'videomaker'), false));
revoke all on public.cliente_gravacao_fixa from anon;
grant select on public.cliente_gravacao_fixa to authenticated;

create or replace function public.cliente_gravacao_fixa_salvar(
  p_client uuid, p_ativa boolean, p_freq text, p_dia_semana int, p_dia_mes int,
  p_inicio time, p_fim time, p_antecedencia int
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenador definem a gravação fixa.' using errcode = '42501'; end if;
  if not exists (select 1 from public.clientes where id = p_client and deleted_at is null) then raise exception 'Cliente não encontrado.'; end if;
  if p_freq not in ('semanal', 'mensal') then raise exception 'Escolha semanal ou mensal.'; end if;
  if p_freq = 'semanal' and (p_dia_semana is null or p_dia_semana not between 0 and 6) then raise exception 'Escolha o dia da semana.'; end if;
  if p_freq = 'mensal' and (p_dia_mes is null or p_dia_mes not between 1 and 31) then raise exception 'Escolha o dia do mês.'; end if;
  if p_fim is not null and p_inicio is not null and p_fim < p_inicio then raise exception 'O fim não pode ser antes do início.'; end if;
  insert into public.cliente_gravacao_fixa (client_id, ativa, freq, dia_semana, dia_mes, hora_inicio, hora_fim, antecedencia_dias, atualizado_por)
  values (p_client, coalesce(p_ativa, true), p_freq, case when p_freq = 'semanal' then p_dia_semana end, case when p_freq = 'mensal' then p_dia_mes end,
          p_inicio, case when p_inicio is null then null else p_fim end, greatest(1, least(30, coalesce(p_antecedencia, 7))), auth.uid())
  on conflict (client_id) do update set ativa = excluded.ativa, freq = excluded.freq, dia_semana = excluded.dia_semana, dia_mes = excluded.dia_mes,
    hora_inicio = excluded.hora_inicio, hora_fim = excluded.hora_fim, antecedencia_dias = excluded.antecedencia_dias,
    atualizado_em = now(), atualizado_por = auth.uid();
end $$;

-- próxima data (a partir de p_de, inclusive) da gravação fixa
create or replace function public._gravacao_fixa_proxima(f public.cliente_gravacao_fixa, p_de date)
returns date language plpgsql immutable as $$
declare d date; ult int;
begin
  if f.freq = 'semanal' then
    return p_de + ((f.dia_semana - extract(dow from p_de)::int + 7) % 7);
  end if;
  ult := extract(day from (date_trunc('month', p_de) + interval '1 month - 1 day'))::int;
  d := make_date(extract(year from p_de)::int, extract(month from p_de)::int, least(f.dia_mes, ult));
  if d >= p_de then return d; end if;
  p_de := (date_trunc('month', p_de) + interval '1 month')::date;
  ult := extract(day from (date_trunc('month', p_de) + interval '1 month - 1 day'))::int;
  return make_date(extract(year from p_de)::int, extract(month from p_de)::int, least(f.dia_mes, ult));
end $$;

-- cria as gravações que faltam dentro da antecedência (idempotente: uma por cliente e data)
create or replace function public._gravacoes_fixas_gerar() returns integer
language plpgsql security definer set search_path = public as $$
declare f public.cliente_gravacao_fixa; hoje date := (now() at time zone 'America/Sao_Paulo')::date; d date; novo uuid; ini timestamptz; fim timestamptz; n integer := 0; guarda int;
begin
  for f in select x.* from public.cliente_gravacao_fixa x join public.clientes c on c.id = x.client_id and c.deleted_at is null where x.ativa loop
    d := public._gravacao_fixa_proxima(f, hoje); guarda := 0;
    while d <= hoje + f.antecedencia_dias and guarda < 6 loop
      guarda := guarda + 1;
      if not exists (select 1 from public.gravacoes g where g.client_id = f.client_id and g.deleted_at is null and g.data_gravacao = d) then
        insert into public.gravacoes (client_id, nome, competencia_ano, competencia_mes, observacoes)
        values (f.client_id, 'Gravação ' || to_char(d, 'DD/MM'), extract(year from d)::int, extract(month from d)::int,
                'Criada automaticamente pela gravação fixa do cliente.') returning id into novo;
        ini := (d + coalesce(f.hora_inicio, time '12:00')) at time zone 'America/Sao_Paulo';
        fim := case when f.hora_inicio is null or f.hora_fim is null then ini else (d + f.hora_fim) at time zone 'America/Sao_Paulo' end;
        insert into public.gravacoes_ocorrencias (gravacao_id, status, inicio, fim, atual, sem_horario)
        values (novo, 'marcada', ini, fim, true, f.hora_inicio is null);
        n := n + 1;
      end if;
      d := public._gravacao_fixa_proxima(f, d + 1);
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public._gravacoes_fixas_gerar() from public;
revoke all on function public._gravacoes_fixas_gerar() from anon;
revoke all on function public._gravacoes_fixas_gerar() from authenticated;

-- botão "gerar agora" (equipe)
create or replace function public.gravacoes_fixas_gerar_agora() returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return public._gravacoes_fixas_gerar();
end $$;

-- preparação de UMA gravação (com os direitos de quem chama)
create or replace function public.gravacao_preparacao(p_gravacao_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare g public.gravacoes%rowtype; v_ano int; v_mes int; l_id uuid; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_conteudos int := 0; v_reels int := 0; v_com int := 0; v_refs int := 0; v_pend int := 0; v_itens int := 0; v_trends int := 0;
  its jsonb := '[]'::jsonb; feitos int := 0; total int := 0; dias int;
begin
  select * into g from public.gravacoes where id = p_gravacao_id and deleted_at is null;
  if not found then return null; end if;
  v_ano := g.competencia_ano; v_mes := g.competencia_mes;
  if v_ano is null and g.data_gravacao is not null then v_ano := extract(year from g.data_gravacao); v_mes := extract(month from g.data_gravacao); end if;
  select l.id into l_id from public.linhas_editoriais l where l.client_id = g.client_id and l.deleted_at is null and l.ano = v_ano and l.mes = v_mes limit 1;
  if l_id is not null then
    select count(*) into v_conteudos from public.conteudos c where c.linha_id = l_id and c.deleted_at is null;
    select count(*) into v_reels from public.conteudos c where c.linha_id = l_id and c.deleted_at is null and c.tipo = 'Reel' and coalesce(c.producao_video, 'gravacao') <> 'edicao';
    select count(*) into v_com from public.conteudos c where c.linha_id = l_id and c.deleted_at is null and c.tipo = 'Reel' and coalesce(c.producao_video, 'gravacao') <> 'edicao'
      and (exists (select 1 from public.roteiros r where r.content_id = c.id and r.deleted_at is null)
        or exists (select 1 from public.gravacao_itens i where i.gravacao_id = g.id and i.conteudo_id = c.id and i.removido_em is null));
  end if;
  select count(*), count(*) filter (where r.uso is null) into v_refs, v_pend from public.gravacao_referencias_linha(g.id) r;
  select count(*) into v_itens from public.gravacao_itens i where i.gravacao_id = g.id and i.removido_em is null;
  select count(*) into v_trends from public.gravacao_itens i where i.gravacao_id = g.id and i.removido_em is null and i.tipo = 'referencia';
  dias := case when g.data_gravacao is null then null else g.data_gravacao - hoje end;

  its := jsonb_build_array(
    jsonb_build_object('chave', 'data', 'ok', g.data_gravacao is not null, 'texto', 'Data da gravação marcada',
      'detalhe', case when g.data_gravacao is null then 'Marque a data' end),
    jsonb_build_object('chave', 'linha', 'ok', l_id is not null and v_conteudos > 0, 'texto', 'Linha editorial do mês com conteúdos',
      'detalhe', case when l_id is null then 'Sem linha editorial desse mês' when v_conteudos = 0 then 'A linha ainda não tem conteúdos' end),
    jsonb_build_object('chave', 'roteiros', 'ok', v_reels = 0 or v_com >= v_reels, 'texto', 'Roteiros dos Reels que vamos gravar',
      'detalhe', case when v_reels > 0 and v_com < v_reels then (v_reels - v_com) || ' de ' || v_reels || ' Reels sem roteiro' end),
    jsonb_build_object('chave', 'refs', 'ok', v_pend = 0, 'texto', 'Referências decididas (só edição ou gravação)',
      'detalhe', case when v_pend > 0 then v_pend || ' para decidir' end),
    jsonb_build_object('chave', 'lista', 'ok', v_itens > 0, 'texto', 'Lista do que vamos gravar montada',
      'detalhe', case when v_itens = 0 then 'Nenhum item na lista' end)
  );
  select count(*) filter (where (x->>'ok')::boolean), count(*) into feitos, total from jsonb_array_elements(its) x;
  return jsonb_build_object('gravacao_id', g.id, 'dias', dias, 'feitos', feitos, 'total', total, 'itens', its,
    'trends', v_trends, 'refs', v_refs, 'refs_pendentes', v_pend, 'situacao', g.situacao);
end $$;

-- preparação das gravações que ainda vão acontecer (para a lista)
create or replace function public.gravacoes_preparacao_resumo() returns setof jsonb
language plpgsql stable security invoker set search_path = public as $$
declare g record; r jsonb; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for g in select id from public.gravacoes
            where deleted_at is null and archived_at is null and data_gravacao >= hoje
              and coalesce(situacao, 'Pendente') in ('Agendada', 'Remarcada', 'Pendente')
            order by data_gravacao limit 60 loop
    r := public.gravacao_preparacao(g.id);
    if r is not null then return next r; end if;
  end loop;
end $$;

-- rotina diária (06:05 em Brasília): cria as gravações fixas que entram na antecedência
-- select cron.schedule('gravacoes-fixas-gerar', '5 9 * * *', 'select public._gravacoes_fixas_gerar()');
