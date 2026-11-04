-- zzz255: pacotes de produção — "Pacote mensal: 12 posts + 4 vídeos" vira, de uma vez,
-- os conteúdos da linha editorial (com tipo e data espalhada pelo mês). As peças de
-- Design e as demandas de vídeo continuam nascendo do jeito de sempre, a partir dos
-- conteúdos, quando a linha é concluída.
create table if not exists public.pacotes_producao (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  descricao text not null default '',
  itens jsonb not null default '[]'::jsonb,          -- [{ "tipo": "Reel", "qtd": 4, "producao": "gravacao" }]
  dias_semana int[] not null default '{1,2,3,4,5}',  -- 1 = segunda … 7 = domingo
  arquivado_em timestamptz,
  criado_por uuid references public.perfis(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pacotes_itens_lista check (jsonb_typeof(itens) = 'array'),
  constraint pacotes_dias check (dias_semana <@ '{1,2,3,4,5,6,7}'::int[] and cardinality(dias_semana) > 0)
);
alter table public.pacotes_producao enable row level security;
create policy pacotes_ler on public.pacotes_producao for select to authenticated using (public.sou_equipe_interna());
create policy pacotes_criar on public.pacotes_producao for insert to authenticated with check (public.pode_nivel('linhas', 2));
create policy pacotes_alterar on public.pacotes_producao for update to authenticated using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
create policy pacotes_excluir on public.pacotes_producao for delete to authenticated using (public.pode_nivel('linhas', 3));
grant select, insert, update, delete on public.pacotes_producao to authenticated;

-- o pacote que o cliente contratou (já vem escolhido na nova linha)
alter table public.clientes add column if not exists pacote_id uuid references public.pacotes_producao(id) on delete set null;

create or replace function public._pacote_valido(itens jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) between 1 and 12
     and not exists (select 1 from jsonb_array_elements(itens) e
                      where coalesce(e->>'tipo', '') not in ('Reel', 'Card', 'Carrossel', 'Story')
                         or coalesce(e->>'qtd', '') !~ '^[0-9]{1,2}$' or (e->>'qtd')::int > 60
                         or coalesce(e->>'producao', 'gravacao') not in ('gravacao', 'edicao'))
     and (select sum((e->>'qtd')::int) from jsonb_array_elements(itens) e) between 1 and 120
$$;
alter table public.pacotes_producao add constraint pacotes_itens_validos check (public._pacote_valido(itens)) not valid;

-- Aplica o pacote numa linha: cria os conteúdos que faltam, em Ideia, com data
-- espalhada pelos dias permitidos do mês e os tipos intercalados.
create or replace function public.linha_aplicar_pacote(p_linha uuid, p_pacote uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare l public.linhas_editoriais; pk public.pacotes_producao; dias date[]; fila jsonb := '[]'::jsonb;
        restam jsonb; n int; i int := 0; pos int; total int; cont jsonb := '{}'::jsonb; e jsonb; rot text;
begin
  if not public.pode_nivel('linhas', 2) then raise exception 'Seu acesso a Linhas editoriais não deixa criar conteúdos.' using errcode = '42501'; end if;
  select * into l from public.linhas_editoriais where id = p_linha and deleted_at is null;
  if l.id is null then raise exception 'Linha editorial não encontrada.'; end if;
  select * into pk from public.pacotes_producao where id = p_pacote and arquivado_em is null;
  if pk.id is null then raise exception 'Pacote não encontrado.'; end if;
  if not public._pacote_valido(pk.itens) then raise exception 'O pacote está com itens inválidos.'; end if;

  select array_agg(d::date order by d) into dias
    from generate_series(make_date(l.ano, l.mes, 1), (make_date(l.ano, l.mes, 1) + interval '1 month' - interval '1 day'), interval '1 day') d
   where extract(isodow from d)::int = any(pk.dias_semana);
  if dias is null then raise exception 'Nenhum dia do mês cai nos dias escolhidos no pacote.'; end if;

  -- intercala os tipos: Reel, Card, Reel, Carrossel… em vez de todos os Reels juntos
  restam := (select jsonb_agg(jsonb_build_object('tipo', x->>'tipo', 'producao', coalesce(x->>'producao', 'gravacao'), 'n', (x->>'qtd')::int))
               from jsonb_array_elements(pk.itens) x where (x->>'qtd')::int > 0);
  loop
    n := 0;
    for i in 0 .. jsonb_array_length(restam) - 1 loop
      if (restam->i->>'n')::int > 0 then
        fila := fila || jsonb_build_array(restam->i);
        restam := jsonb_set(restam, array[i::text, 'n'], to_jsonb((restam->i->>'n')::int - 1));
        n := n + 1;
      end if;
    end loop;
    exit when n = 0;
  end loop;

  total := jsonb_array_length(fila);
  select coalesce(max(position), 0) into pos from public.conteudos where linha_id = l.id and deleted_at is null;
  for i in 0 .. total - 1 loop
    e := fila->i;
    cont := jsonb_set(cont, array[e->>'tipo'], to_jsonb(coalesce((cont->>(e->>'tipo'))::int, 0) + 1));
    rot := case e->>'tipo' when 'Reel' then 'Reel' when 'Card' then 'Card' when 'Carrossel' then 'Carrossel' else 'Story' end;
    insert into public.conteudos (client_id, linha_id, tipo, position, titulo, status, data_postagem, producao_video)
    values (l.client_id, l.id, e->>'tipo', pos + i + 1, rot || ' ' || (cont->>(e->>'tipo')), 'Ideia',
            dias[1 + floor(i::numeric * array_length(dias, 1) / total)::int], e->>'producao');
  end loop;
  -- lembra o pacote do cliente: na próxima linha ele já vem escolhido
  update public.clientes set pacote_id = pk.id where id = l.client_id and pacote_id is distinct from pk.id;
  return total;
end $$;
revoke all on function public.linha_aplicar_pacote(uuid, uuid) from public, anon;
grant execute on function public.linha_aplicar_pacote(uuid, uuid) to authenticated;

-- um pacote de exemplo para começar (a administração edita ou arquiva)
insert into public.pacotes_producao (nome, descricao, itens, criado_por)
select 'Pacote mensal', '12 posts + 4 vídeos',
       '[{"tipo":"Card","qtd":6},{"tipo":"Carrossel","qtd":6},{"tipo":"Reel","qtd":4,"producao":"gravacao"}]'::jsonb, null
 where not exists (select 1 from public.pacotes_producao);
