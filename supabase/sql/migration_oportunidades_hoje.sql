-- =====================================================================
-- OPORTUNIDADES DO DIA (Kevin, 08/10/2026) — "hoje é dia de…"
-- Um aviso por dia, às 8h, com as oportunidades que COMEÇAM naquele dia.
-- Só sai quando há alguma. Usa o caminho de sempre, sem segundo sistema:
--   notif_verificar_agendados (cron notif-agendados, rodada das 8h)
--     → evento de domínio (chave única por dia: nunca duplica)
--       → notif_entregar → notificacoes → webhook → b7-push
--
-- Quem recebe: quem tem o módulo Oportunidades (administradores e as
-- funções/pessoas com o módulo liberado; "negar" individual respeitado).
-- Preferência nova "oportunidades" (ligada por padrão): desligada, o
-- aviso continua no sino mas não interrompe (sem push nem som).
--
-- O que entra no aviso:
--   • oportunidade ativa e com revisão "ok";
--   • que começa hoje (data fixa, regra do tipo "2º domingo de maio",
--     último dia do mês, ou data vinda das fontes). "Mês inteiro" só
--     entra no dia 1º;
--   • nacional ou internacional; estadual/municipal só quando algum
--     cliente está naquele estado/cidade.
--   Ordem: interesse geral, depois nacionais, depois internacionais.
--
-- Nenhuma tabela, coluna ou policy nova. Para desfazer: recriar
-- notif_verificar_agendados sem a linha do _oportunidades_aviso_do_dia e
-- dar drop nas duas funções novas.
-- =====================================================================

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
   where h.abrangencia::text not in ('municipal', 'estadual')
      or (h.abrangencia::text = 'municipal' and exists (
            select 1 from public.cliente_municipios cm where cm.municipio_ibge = h.municipio_ibge))
      or (h.abrangencia::text = 'estadual' and exists (
            select 1 from public.cliente_municipios cm join public.municipios mu on mu.ibge = cm.municipio_ibge
             where mu.uf = h.uf))
$$;
revoke all on function public.oportunidades_do_dia(date) from public, anon, authenticated;

create or replace function public._oportunidades_aviso_do_dia()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hoje date := public.notif_hoje();
  nomes text[]; n integer; msg text; evid uuid; quem uuid[];
begin
  select array_agg(public.notif_corta(d.nome, 48) order by d.ordem, d.nome), count(*)
    into nomes, n
    from public.oportunidades_do_dia(hoje) d;
  if coalesce(n, 0) = 0 then return 0; end if;

  msg := case
    when n = 1 then nomes[1]
    when n = 2 then nomes[1] || ' e ' || nomes[2]
    when n = 3 then nomes[1] || ', ' || nomes[2] || ' e ' || nomes[3]
    else nomes[1] || ', ' || nomes[2] || ' e mais ' || (n - 2) || ' oportunidades'
  end || '.';

  /* quem tem o módulo Oportunidades (a mesma conta de modulos_efetivos) */
  select array_agg(p.id) into quem
    from public.perfis p
   where p.estado = 'ativa' and p.papel <> 'cliente'
     and (p.eh_admin or (
           (exists (select 1 from public.funcao_modulos fm where fm.funcao = p.funcao and fm.modulo = 'oportunidades')
            or exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p.id and pm.modulo = 'oportunidades' and pm.efeito = 'permitir'))
           and not exists (select 1 from public.perfil_modulos pm where pm.perfil_id = p.id and pm.modulo = 'oportunidades' and pm.efeito = 'negar')));
  if quem is null then return 0; end if;

  insert into public.eventos_dominio (tipo, chave, alvo_tipo, payload, processado_em)
  values ('oportunidade.hoje', 'oportunidade.hoje:' || hoje::text, 'sistema',
          jsonb_build_object('oportunidades', n, 'dia', hoje), now())
  on conflict (chave) do nothing
  returning id into evid;
  if evid is null then return 0; end if;

  return public.notif_entregar(evid, 'oportunidade.hoje', 'Hoje é dia de…', msg,
    '#/oportunidades', null, quem, 'oportunidades');
end;
$function$;
revoke all on function public._oportunidades_aviso_do_dia() from public, anon, authenticated;

-- rodada das 8h: entra junto do resumo diário e dos lembretes
create or replace function public.notif_verificar_agendados()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare h integer := extract(hour from now() at time zone 'America/Sao_Paulo')::int;
begin
  if h < 8 or h > 19 then return; end if;
  perform public._video_alertas_prazo(null);
  perform public._design_alertas_prazo();
  if h = 8 then
    perform public._notif_resumo_diario();
    perform public._design_alertas_parados();
    perform public._producao_alertas_lembretes();
    perform public._oportunidades_aviso_do_dia();
  end if;
end;
$function$;

-- preferência nova: "oportunidades" entra na lista aceita (o resto igual)
create or replace function public.perfil_preferencias_gravar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  limpo jsonb := '{}'::jsonb; notif jsonb := '{}'::jsonb; k text; v jsonb; atual jsonb;
  permitidas constant text[] := array[
    'atribuicoes', 'prazos', 'atrasos', 'correcoes', 'aprovacoes',
    'grav_lembretes', 'grav_mudancas', 'roteiros_prontos',
    'design_disponivel',
    'co_revisoes', 'co_aprovacoes', 'co_producao', 'co_escalados',
    'agenda', 'resumo_diario', 'oportunidades',
    'adm_revisoes', 'adm_atrasos', 'adm_tudo'];
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária.';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Preferências inválidas.';
  end if;
  for k, v in select * from jsonb_each(p) loop
    if k in ('som', 'navegador', 'push') and jsonb_typeof(v) = 'boolean' then
      limpo := limpo || jsonb_build_object(k, v);
    elsif k = 'ultimo_som_em' and jsonb_typeof(v) = 'string' then
      perform (v#>>'{}')::timestamptz;
      limpo := limpo || jsonb_build_object(k, v);
    elsif k = 'notif' and jsonb_typeof(v) = 'object' then
      select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into notif
        from jsonb_each(v) e
       where e.key = any(permitidas) and jsonb_typeof(e.value) = 'boolean';
    end if;
  end loop;
  update public.perfis
     set preferencias = coalesce(preferencias, '{}'::jsonb) || limpo ||
           case when notif <> '{}'::jsonb
                then jsonb_build_object('notif', coalesce(preferencias -> 'notif', '{}'::jsonb) || notif)
                else '{}'::jsonb end
   where id = auth.uid()
   returning preferencias into atual;
  if atual is null then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  return atual;
end;
$function$;
