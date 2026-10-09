-- =====================================================================
-- IA — propostas que sobrevivem ao histórico + datas no contexto do chat
-- (Kevin, 09/10/2026 — zzz127)
--
-- 1. ia_mensagens.acoes (coluna nova): as propostas que o assistente fez
--    naquela resposta (criar demanda, peça, gravação, conteúdo) e o que
--    a pessoa fez com cada uma. Antes os cartões sumiam ao reabrir a
--    conversa. Quem grava as propostas é o servidor (b7-ia), junto da
--    resposta; a regra de leitura da tabela não muda.
--
-- 2. ia_acao_estado(): a pessoa marca uma proposta DELA como criada ou
--    cancelada. Função em vez de regra de escrita nova: a tabela continua
--    sem policy de UPDATE; a função só mexe no campo "estado" de uma
--    proposta, e só em conversa de quem chama.
--
-- 3. oportunidades_proximas(): as datas relevantes dos próximos dias
--    (a mesma regra do aviso das 8h), para o assistente saber "o que
--    tem de data esta semana". Só o servidor chama.
--
-- Nenhuma policy criada ou alterada.
-- Para desfazer: drop das duas funções e
--   alter table public.ia_mensagens drop column acoes;
-- =====================================================================
alter table public.ia_mensagens add column if not exists acoes jsonb;
comment on column public.ia_mensagens.acoes is
  'Propostas de ação desta resposta do assistente (lista) e o estado de cada uma: "" | feito | cancelado.';

create or replace function public.ia_acao_estado(p_mensagem uuid, p_indice integer, p_estado text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Sessão necessária.'; end if;
  if p_estado not in ('feito', 'cancelado') then raise exception 'Estado inválido.'; end if;
  if p_indice is null or p_indice < 0 or p_indice > 20 then raise exception 'Proposta inválida.'; end if;
  update public.ia_mensagens m
     set acoes = jsonb_set(m.acoes, array[p_indice::text, 'estado'], to_jsonb(p_estado), true)
   where m.id = p_mensagem
     and jsonb_typeof(m.acoes) = 'array' and jsonb_array_length(m.acoes) > p_indice
     and exists (select 1 from public.ia_conversas c where c.id = m.conversa_id and c.perfil_id = auth.uid());
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;
revoke all on function public.ia_acao_estado(uuid, integer, text) from public, anon;
grant execute on function public.ia_acao_estado(uuid, integer, text) to authenticated;

create or replace function public.oportunidades_proximas(p_dias integer default 7)
returns table (dia date, nome text, ordem integer)
language sql
stable
security definer
set search_path = public
as $$
  select d::date, x.nome, x.ordem
    from generate_series(public.notif_hoje(), public.notif_hoje() + least(greatest(coalesce(p_dias, 7), 0), 31), interval '1 day') d
   cross join lateral public.oportunidades_do_dia(d::date) x
$$;
revoke all on function public.oportunidades_proximas(integer) from public, anon, authenticated;
