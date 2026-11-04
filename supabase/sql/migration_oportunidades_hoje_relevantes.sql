-- =====================================================================
-- "HOJE É DIA DE…" — só datas relevantes ou de interesse geral
-- (Kevin, 08/10/2026). Complementa migration_oportunidades_hoje.sql.
--
-- Antes o aviso das 8h listava toda data nacional/internacional do dia,
-- inclusive as que não servem a nenhum cliente ("World Post Day").
-- Agora só entra a data que a tela de Oportunidades classifica como
-- "Muito relevante", "Relacionada" ou "Geral". É a MESMA regra de
-- js/oportunidades.js (relevancia / periodo), reescrita no banco:
--
--   geral        data marcada como de interesse geral, ou feriado/ponto
--                facultativo, desde que não seja estadual/municipal
--   por cliente  (cliente que marcou "ignorar"/"não relevante" não conta)
--     • a equipe marcou a data como relevante para o cliente;
--     • data municipal na cidade do cliente / estadual no estado dele;
--     • a categoria da data é o segmento do cliente;
--     • uma tag da data é uma palavra do segmento do cliente (mais de 3
--       letras, sem as palavras do tema-pai);
--     • a data é do tema-pai e o segmento é amplo (medicina, farmácia)
--       ou a data é a "data ampla" do tema ("Dia Mundial da Saúde");
--     • a categoria da data é um subtema do segmento do cliente.
--
-- Dia sem nenhuma data assim: não sai aviso.
-- Nenhuma tabela, coluna ou policy nova. Só leitura.
-- Para desfazer: reaplicar migration_oportunidades_hoje.sql.
-- =====================================================================

-- mesmo "norm" do JavaScript: sem acento, minúsculo, só letras e números
create or replace function public._op_norm(t text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(t, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'))
$$;
revoke all on function public._op_norm(text) from public, anon, authenticated;

create or replace function public.oportunidade_tem_interesse(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.oportunidades o
     where o.id = p_id
       and (
         (o.abrangencia not in ('municipal', 'estadual')
            and (o.geral or o.natureza in ('feriado', 'facultativo')))
         or exists (
           select 1
             from public.clientes c
            where c.deleted_at is null
              and not exists (
                select 1 from public.oportunidade_cliente_ajustes a
                 where a.oportunidade_id = o.id and a.client_id = c.id
                   and a.decisao in ('ignorar', 'nao_relevante'))
              and (
                exists (
                  select 1 from public.oportunidade_cliente_ajustes a
                   where a.oportunidade_id = o.id and a.client_id = c.id and a.decisao = 'relevante')
                or (o.abrangencia = 'municipal' and exists (
                  select 1 from public.cliente_municipios cm
                   where cm.client_id = c.id and cm.municipio_ibge = o.municipio_ibge))
                or (o.abrangencia = 'estadual' and exists (
                  select 1 from public.cliente_municipios cm
                    join public.municipios mu on mu.ibge = cm.municipio_ibge
                   where cm.client_id = c.id and mu.uf = o.uf))
                or (o.abrangencia not in ('municipal', 'estadual') and exists (
                  select 1
                    from public.cliente_segmentos s
                    join public.temas t on t.id = s.tema_id
                    left join public.temas tp on tp.id = t.pai
                   where s.client_id = c.id
                     and (
                       s.tema_id = any(coalesce(o.categorias, '{}'::text[]))
                       or exists (
                         select 1
                           from unnest(array[s.tema_id] || string_to_array(public._op_norm(t.nome), ' ')) w
                          where length(w) > 3
                            and (t.pai is null or (w <> t.pai
                                 and w <> all(string_to_array(public._op_norm(tp.nome), ' '))))
                            and w = any(coalesce(o.tags, '{}'::text[])))
                       or (t.pai is not null and t.pai = any(coalesce(o.categorias, '{}'::text[]))
                           and (s.tema_id in ('medicina', 'farmacia')
                                or (select count(*) = 1 and bool_and(w = public._op_norm(tp.nome))
                                      from unnest(string_to_array(public._op_norm(o.nome), ' ')) w
                                     where w <> '' and w <> all(array['dia', 'mundial', 'nacional', 'internacional',
                                       'da', 'de', 'do', 'das', 'dos', 'e', 'semana', 'mes']))))
                       or exists (
                         select 1 from public.temas sub
                          where sub.pai = s.tema_id and sub.id = any(coalesce(o.categorias, '{}'::text[])))
                     )))
              ))
       ))
$$;
revoke all on function public.oportunidade_tem_interesse(uuid) from public, anon, authenticated;

-- a lista do dia passa a exigir interesse (o resto é igual)
create or replace function public.oportunidades_do_dia(p_dia date)
returns table (id uuid, nome text, natureza text, abrangencia text, geral boolean, ordem integer)
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select o.*, string_to_array(coalesce(o.regra, ''), ':') as r,
           extract(year from p_dia)::int as a, extract(month from p_dia)::int as m
      from public.oportunidades o
     where o.ativo and coalesce(o.revisao, 'ok') = 'ok'
  ), hoje as (
    select o.* from o
     where (o.tipo_data = 'fixa' and o.mes = o.m and o.dia = extract(day from p_dia)::int)
        or (o.tipo_data = 'datas' and exists (
              select 1 from public.oportunidade_datas d where d.oportunidade_id = o.id and d.data = p_dia))
        or (o.tipo_data = 'regra' and array_length(o.r, 1) >= 2 and o.r[2] ~ '^\d+$' and o.r[2]::int = o.m and (
              (o.r[1] = 'mes_inteiro' and extract(day from p_dia)::int = 1)
           or (o.r[1] = 'ultimo_dia' and p_dia = (make_date(o.a, o.m, 1) + interval '1 month - 1 day')::date)
           or (o.r[1] = 'nth' and array_length(o.r, 1) = 4 and o.r[3] ~ '^\d+$' and o.r[4] ~ '^-?\d+$' and p_dia =
                 case when o.r[4]::int > 0 then
                   make_date(o.a, o.m, 1)
                     + ((o.r[3]::int - extract(dow from make_date(o.a, o.m, 1))::int + 7) % 7)
                     + (o.r[4]::int - 1) * 7
                 else
                   (make_date(o.a, o.m, 1) + interval '1 month - 1 day')::date
                     - ((extract(dow from (make_date(o.a, o.m, 1) + interval '1 month - 1 day'))::int - o.r[3]::int + 7) % 7)
                     + (o.r[4]::int + 1) * 7
                 end)))
  )
  select h.id, h.nome, h.natureza::text, h.abrangencia::text, h.geral,
         (case when h.geral then 0 when h.natureza::text = 'feriado' then 1
               when h.abrangencia::text in ('municipal', 'estadual') then 2
               when h.abrangencia::text = 'nacional' then 3 else 4 end)::int
    from hoje h
   where public.oportunidade_tem_interesse(h.id)
$$;
revoke all on function public.oportunidades_do_dia(date) from public, anon, authenticated;
