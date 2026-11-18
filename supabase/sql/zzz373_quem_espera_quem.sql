-- 4.80.0: DE QUEM É A VEZ em cada conversa.
--   esperando_desde           = o CLIENTE está esperando a gente (última palavra foi do cliente)
--   aguardando_cliente_desde  = a GENTE está esperando o cliente (última palavra foi da equipe: número do B7
--                               ou celular de alguém da equipe, inclusive os "outros números" da tela do Otto)
alter table public.wa_conversas add column if not exists aguardando_cliente_desde timestamptz;

-- outros números (celular pessoal) de quem aparece nos contatos com o mesmo nome e outro número
update public.wa_assistente a set equipe = (
  select jsonb_agg(case
    when e->>'nome' = 'Matheus Guimarães' then e || jsonb_build_object('outros_numeros', '557781398624')
    when e->>'nome' = 'Pedro Prado'       then e || jsonb_build_object('outros_numeros', '557799709584')
    when e->>'nome' = 'Talita Rocha'      then e || jsonb_build_object('outros_numeros', '5583952787507')
    else e end order by ord)
  from jsonb_array_elements(a.equipe) with ordinality as x(e, ord))
where a.id = 1;

-- recalcula as duas marcas pela última conversa de cada uma
with eq as (
  select distinct right(regexp_replace(n, '\D', '', 'g'), 8) n
  from public.wa_assistente a, jsonb_array_elements(a.equipe) e,
       lateral unnest(array[e->>'numero'] || string_to_array(coalesce(e->>'outros_numeros', ''), ',')) n
  where a.id = 1 and length(regexp_replace(n, '\D', '', 'g')) >= 10),
msgs as (
  select m.jid, m.criada_em,
         (m.de_mim or right(regexp_replace(coalesce(ct.numero, split_part(m.autor_jid, '@', 1)), '\D', '', 'g'), 8) in (select n from eq)) as da_equipe,
         row_number() over (partition by m.jid order by m.criada_em desc) rn
  from public.wa_mensagens m left join public.wa_contatos ct on ct.jid = m.autor_jid
  where not m.nota and m.criada_em > now() - interval '30 days'),
ult as (select jid, da_equipe from msgs where rn = 1),
-- começo da vez: primeira mensagem do mesmo lado depois da última do outro lado
inicio as (
  select u.jid, u.da_equipe,
         (select min(x.criada_em) from msgs x where x.jid = u.jid and x.da_equipe = u.da_equipe
            and x.criada_em > coalesce((select max(y.criada_em) from msgs y where y.jid = u.jid and y.da_equipe <> u.da_equipe), '-infinity'::timestamptz)) desde
  from ult u)
update public.wa_conversas c set
  esperando_desde = case when i.da_equipe then null else i.desde end,
  aguardando_cliente_desde = case when i.da_equipe then i.desde else null end
from inicio i where i.jid = c.jid;
