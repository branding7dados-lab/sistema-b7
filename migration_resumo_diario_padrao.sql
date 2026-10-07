-- =====================================================================
-- Aplicada em 07/10/2026 (zzz88), depois de o Kevin autorizar.
-- RESUMO DIÁRIO LIGADO POR PADRÃO (zzz86) — decisão delegada pelo Kevin
-- em 07/10/2026 ("pode decidir por mim").
-- O aviso das 8h (prazos do dia, gravações de amanhã e, para a gestão,
-- publicações e atrasos) passa a valer para quem NUNCA escolheu. Quem já
-- ligou ou desligou em Perfil → Avisos continua como escolheu.
-- Só muda o padrão em notif_pref_ativa; nada mais.
-- =====================================================================
create or replace function public.notif_pref_ativa(p_prefs jsonb, p_chave text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_chave is null then false
    when jsonb_typeof(p_prefs -> 'notif' -> p_chave) = 'boolean' then (p_prefs -> 'notif' ->> p_chave)::boolean
    else p_chave not in ('adm_revisoes', 'adm_tudo')
  end
$function$;
