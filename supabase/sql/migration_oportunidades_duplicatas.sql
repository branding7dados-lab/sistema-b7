-- Fase 7 — refino da detecção de possíveis duplicatas (menos ruído)
-- Antes: mesma data + categoria em comum → "revisar" (marcava datas
-- distintas do mesmo calendário oficial, ex.: dois dias de saúde em 08/05).
-- Agora: mesma data E (palavra significativa em comum no nome OU palavra-
-- -chave em português do adaptador) E vinda de OUTRA fonte. Itens distintos
-- de uma mesma lista oficial nunca são tratados como duplicata.

create or replace function public.op_palavras(p text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array(select distinct w from unnest(string_to_array(public.op_normalizar(p), ' ')) w
    where length(w) > 4 and w not in ('mundial','nacional','internacional','contra','combate','semana','sobre','prevencao',
      'conscientizacao','world','international','awareness','saude','health','pessoa','pessoas','people','doenca','doencas',
      'disease','luta','nacoes','unidas','united','nations','global','action','acao','dia')), '{}')
$$;

create or replace function public.op_candidato_duplicata(p_nome text, p_mes int, p_dia int, p_fonte text, p_palavras_pt jsonb, p_excluir uuid default null)
returns uuid language sql stable set search_path = public as $$
  select o.id from public.oportunidades o
   where o.ativo and o.id is distinct from p_excluir
     and (   (o.tipo_data = 'fixa' and o.mes = p_mes and o.dia = p_dia)
          or exists (select 1 from public.oportunidade_datas d where d.oportunidade_id = o.id
                      and extract(month from d.data) = p_mes and extract(day from d.data) = p_dia))
     and not exists (select 1 from public.oportunidade_provas pv where pv.oportunidade_id = o.id and pv.fonte_id = p_fonte)
     and (   public.op_palavras(o.nome) && public.op_palavras(p_nome)
          or exists (select 1 from jsonb_array_elements_text(coalesce(p_palavras_pt, '[]')) p
                      where o.chave like '%' || public.op_normalizar(p) || '%'))
   order by o.criado_em limit 1
$$;
revoke all on function public.op_candidato_duplicata(text,int,int,text,jsonb,uuid) from public, anon;

-- aplicar_lote: troca só o passo 4 (dúvida) pela regra nova
do $mig$
declare d text; velho text; novo text;
begin
  d := pg_get_functiondef('public.oportunidades_aplicar_lote(text,jsonb,text,text)'::regprocedure);
  velho := $v$        if (it->>'tipo_data') = 'fixa' then
          select o.id into v_dup from public.oportunidades o
           where o.tipo_data = 'fixa' and o.mes = (it->>'mes')::int and o.dia = (it->>'dia')::int and o.ativo
             and o.categorias && coalesce(array(select jsonb_array_elements_text(it->'categorias')), '{}')
           order by o.criado_em limit 1;
        end if;$v$;
  novo := $n$        if (it->>'tipo_data') = 'fixa' then
          v_dup := public.op_candidato_duplicata(v_nome, (it->>'mes')::int, (it->>'dia')::int, p_fonte, it->'palavras_pt');
        elsif (it->>'tipo_data') = 'datas' then
          v_dup := public.op_candidato_duplicata(v_nome, extract(month from (it->'datas'->0->>'data')::date)::int,
                     extract(day from (it->'datas'->0->>'data')::date)::int, p_fonte, it->'palavras_pt');
        end if;$n$;
  if position(velho in d) = 0 then raise exception 'trecho do passo 4 não encontrado'; end if;
  execute replace(d, velho, novo);
end $mig$;

-- reavalia a fila de revisão existente com a regra nova
update public.oportunidades o set revisao = 'ok', possivel_duplicata_de = null, atualizado_em = now()
 where o.revisao = 'revisar' and o.tipo_data = 'fixa'
   and public.op_candidato_duplicata(o.nome, o.mes, o.dia,
         (select pv.fonte_id from public.oportunidade_provas pv where pv.oportunidade_id = o.id order by pv.visto_em limit 1), null, o.id) is null;
update public.oportunidades o set possivel_duplicata_de = x.dup
  from (select o2.id, public.op_candidato_duplicata(o2.nome, o2.mes, o2.dia,
         (select pv.fonte_id from public.oportunidade_provas pv where pv.oportunidade_id = o2.id order by pv.visto_em limit 1), null, o2.id) dup
        from public.oportunidades o2 where o2.revisao = 'revisar' and o2.tipo_data = 'fixa') x
 where x.id = o.id and x.dup is not null;

-- (2) radical de 6 letras: pega cognatos PT/EN (tuberculose/tuberculosis)
create or replace function public.op_palavras(p text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array(select distinct left(w, 6) from unnest(string_to_array(public.op_normalizar(p), ' ')) w
    where length(w) > 4 and w not in ('mundial','nacional','internacional','contra','combate','semana','sobre','prevencao',
      'conscientizacao','world','international','awareness','saude','health','pessoa','pessoas','people','doenca','doencas',
      'disease','luta','nacoes','unidas','united','nations','global','action','acao','dia')), '{}')
$$;
-- (a fila foi reavaliada uma vez com a regra nova; em pares simétricos só o registro mais novo fica em "revisar")
