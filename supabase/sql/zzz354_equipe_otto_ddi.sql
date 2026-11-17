-- 4.59.7: números da equipe do Otto salvos sem o 55 (ex.: 71982136074).
-- O WhatsApp lia "+7 1982136074" e a marcação não funcionava. Põe o DDI.
update public.wa_assistente set equipe = (
  select coalesce(jsonb_agg(case
    when length(regexp_replace(coalesce(e->>'numero', ''), '\D', '', 'g')) in (10, 11)
      then jsonb_set(e, '{numero}', to_jsonb('55' || regexp_replace(e->>'numero', '\D', '', 'g')))
    else e end), '[]'::jsonb)
  from jsonb_array_elements(equipe) e)
where id = 1;
