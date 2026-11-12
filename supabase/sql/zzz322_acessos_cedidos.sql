-- 4.34.0 — ACESSOS CEDIDOS
-- Kevin: "quando eu ceder um acesso (pedido pela telinha ou pelo suporte),
-- já aparece como cedido na minha tela; quando eu quiser tirar, é só tirar."
--   • o pedido aprovado guarda como o acesso estava ANTES (para tirar e voltar
--     exatamente ao que era), de onde veio (pedido, suporte, manual) e um prazo
--     opcional (o acesso vence sozinho);
--   • acesso_ceder: o administrador cede direto (de um chamado de suporte ou
--     sem pedido nenhum) — fica registrado igual a um pedido aprovado;
--   • acesso_revogar: tira o acesso cedido e devolve o que era antes;
--   • acesso_expirar_vencidos: roda de hora em hora e tira o que venceu.
alter table public.acesso_pedidos
  add column if not exists origem text not null default 'pedido',
  add column if not exists chamado_id uuid references public.suporte_chamados(id) on delete set null,
  add column if not exists expira_em timestamptz,
  add column if not exists antes_efeito text,
  add column if not exists antes_nivel text,
  add column if not exists revogado_em timestamptz,
  add column if not exists revogado_por uuid references public.perfis(id) on delete set null,
  add column if not exists revogado_motivo text check (revogado_motivo is null or length(revogado_motivo) <= 300);
alter table public.acesso_pedidos drop constraint if exists acesso_pedidos_estado_check;
alter table public.acesso_pedidos add constraint acesso_pedidos_estado_check
  check (estado = any (array['pendente','aprovado','recusado','cancelado','revogado','expirado']));
alter table public.acesso_pedidos drop constraint if exists acesso_pedidos_origem_check;
alter table public.acesso_pedidos add constraint acesso_pedidos_origem_check check (origem = any (array['pedido','suporte','manual']));
create index if not exists acesso_pedidos_cedidos on public.acesso_pedidos (expira_em) where estado = 'aprovado';

-- aprovar guarda o "antes" (o resto igual ao que era)
create or replace function public.acesso_decidir(p_id uuid, p_aprovar boolean, p_nivel text default null, p_resposta text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare pd public.acesso_pedidos; v_nivel text; antes jsonb; depois jsonb; rot text; alvo public.perfis; pm public.perfil_modulos;
begin
  if not public.sou_admin() then raise exception 'Só administrador decide pedidos de acesso.' using errcode = '42501'; end if;
  select * into pd from public.acesso_pedidos where id = p_id for update;
  if pd.id is null then raise exception 'Pedido não encontrado.'; end if;
  if pd.estado <> 'pendente' then raise exception 'Esse pedido já foi respondido.'; end if;
  select * into alvo from public.perfis where id = pd.perfil_id;
  select rotulo into rot from public.modulos where id = pd.modulo;
  v_nivel := coalesce(nullif(p_nivel, ''), pd.nivel);
  if v_nivel not in ('ver','editar','total') then raise exception 'Nível inválido.'; end if;
  antes := public.modulos_niveis(pd.perfil_id);
  select * into pm from public.perfil_modulos where perfil_id = pd.perfil_id and modulo = pd.modulo;
  if p_aprovar then
    insert into public.perfil_modulos(perfil_id, modulo, efeito, nivel, alterado_por, alterado_em)
      values (pd.perfil_id, pd.modulo, 'permitir', v_nivel, auth.uid(), now())
    on conflict (perfil_id, modulo) do update set efeito = 'permitir', nivel = excluded.nivel, alterado_por = excluded.alterado_por, alterado_em = now();
  end if;
  depois := public.modulos_niveis(pd.perfil_id);
  update public.acesso_pedidos set estado = case when p_aprovar then 'aprovado' else 'recusado' end,
    nivel_dado = case when p_aprovar then v_nivel end, resposta = nullif(trim(coalesce(p_resposta, '')), ''),
    antes_efeito = case when p_aprovar then coalesce(pm.efeito, 'padrao') end, antes_nivel = case when p_aprovar then pm.nivel end,
    decidido_por = auth.uid(), decidido_em = now() where id = p_id;
  insert into public.auditoria(autor_id, autor_username, acao, alvo_tipo, alvo_id, alvo_descricao, detalhe)
    select auth.uid(), (select username from public.perfis where id = auth.uid()),
      case when p_aprovar then 'acesso_pedido_aprovado' else 'acesso_pedido_recusado' end, 'perfil', pd.perfil_id, alvo.nome,
      jsonb_build_object('modulo', pd.modulo, 'pedido', pd.nivel, 'dado', case when p_aprovar then v_nivel end, 'motivo', pd.motivo,
                         'resposta', nullif(trim(coalesce(p_resposta, '')), ''),
                         'acesso', jsonb_build_object('antes', jsonb_build_object('niveis', antes), 'depois', jsonb_build_object('niveis', depois)));
  perform public._acesso_notificar(pd.perfil_id, 'acesso.respondido',
      case when p_aprovar then 'Acesso liberado' else 'Pedido de acesso recusado' end,
      case when p_aprovar then 'Agora você tem ' || case v_nivel when 'ver' then 'Ver' when 'editar' then 'Editar' else 'Total' end || ' em ' || rot || '.'
           else 'O pedido de ' || rot || ' não foi aprovado' || coalesce(': ' || nullif(trim(coalesce(p_resposta, '')), ''), '.') end,
      '#/', pd.id, jsonb_build_object('pedido_id', pd.id, 'modulo', pd.modulo));
end $function$;

-- prazo de um acesso cedido (null = sem prazo)
create or replace function public.acesso_prazo(p_id uuid, p_dias int)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.sou_admin() then raise exception 'Só administrador.' using errcode = '42501'; end if;
  update public.acesso_pedidos set expira_em = case when p_dias is null or p_dias <= 0 then null else now() + make_interval(days => p_dias) end
   where id = p_id and estado = 'aprovado';
end $$;

-- ceder direto (de um chamado ou sem pedido)
create or replace function public.acesso_ceder(p_perfil uuid, p_modulo text, p_nivel text, p_dias int default null, p_chamado uuid default null, p_motivo text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare alvo public.perfis; v_id uuid; rot text;
begin
  if not public.sou_admin() then raise exception 'Só administrador cede acesso.' using errcode = '42501'; end if;
  select * into alvo from public.perfis where id = p_perfil;
  if alvo.id is null or alvo.papel = 'cliente' then raise exception 'Escolha alguém da equipe.'; end if;
  if alvo.eh_admin then raise exception 'Administrador já tem acesso total.'; end if;
  select rotulo into rot from public.modulos where id = p_modulo;
  if rot is null then raise exception 'Módulo inválido.'; end if;
  if p_nivel not in ('ver','editar','total') then raise exception 'Nível inválido.'; end if;
  -- se já havia um pedido pendente dessa pessoa para esse módulo, ele é o que vira cedido
  select id into v_id from public.acesso_pedidos where perfil_id = p_perfil and modulo = p_modulo and estado = 'pendente';
  if v_id is null then
    insert into public.acesso_pedidos(perfil_id, modulo, nivel, motivo, origem, chamado_id)
      values (p_perfil, p_modulo, p_nivel, nullif(trim(coalesce(p_motivo, '')), ''),
              case when p_chamado is null then 'manual' else 'suporte' end, p_chamado)
      returning id into v_id;
  else
    update public.acesso_pedidos set chamado_id = coalesce(p_chamado, chamado_id),
      origem = case when p_chamado is not null then 'suporte' else origem end where id = v_id;
  end if;
  -- o que já estava cedido do mesmo módulo deixa de valer como "cedido" (o novo substitui)
  update public.acesso_pedidos set estado = 'revogado', revogado_em = now(), revogado_por = auth.uid(), revogado_motivo = 'substituído por um novo acesso'
   where perfil_id = p_perfil and modulo = p_modulo and estado = 'aprovado' and id <> v_id;
  perform public.acesso_decidir(v_id, true, p_nivel, null);
  if p_dias is not null and p_dias > 0 then
    update public.acesso_pedidos set expira_em = now() + make_interval(days => p_dias) where id = v_id;
  end if;
  return v_id;
end $$;

-- tirar: volta ao que era antes de ceder
create or replace function public._acesso_desfazer(p_id uuid, p_estado text, p_motivo text, p_quem uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pd public.acesso_pedidos; rot text; antes jsonb; depois jsonb; alvo public.perfis;
begin
  select * into pd from public.acesso_pedidos where id = p_id for update;
  if pd.id is null or pd.estado <> 'aprovado' then return; end if;
  select * into alvo from public.perfis where id = pd.perfil_id;
  select rotulo into rot from public.modulos where id = pd.modulo;
  antes := public.modulos_niveis(pd.perfil_id);
  if coalesce(pd.antes_efeito, 'padrao') = 'padrao' then
    delete from public.perfil_modulos where perfil_id = pd.perfil_id and modulo = pd.modulo;
  else
    update public.perfil_modulos set efeito = pd.antes_efeito, nivel = pd.antes_nivel, alterado_por = p_quem, alterado_em = now()
     where perfil_id = pd.perfil_id and modulo = pd.modulo;
  end if;
  depois := public.modulos_niveis(pd.perfil_id);
  update public.acesso_pedidos set estado = p_estado, revogado_em = now(), revogado_por = p_quem,
    revogado_motivo = nullif(trim(coalesce(p_motivo, '')), '') where id = p_id;
  insert into public.auditoria(autor_id, autor_username, acao, alvo_tipo, alvo_id, alvo_descricao, detalhe)
    select p_quem, (select username from public.perfis where id = p_quem),
      case when p_estado = 'expirado' then 'acesso_cedido_expirou' else 'acesso_cedido_retirado' end, 'perfil', pd.perfil_id, alvo.nome,
      jsonb_build_object('modulo', pd.modulo, 'dado', pd.nivel_dado, 'motivo', p_motivo,
        'acesso', jsonb_build_object('antes', jsonb_build_object('niveis', antes), 'depois', jsonb_build_object('niveis', depois)));
  perform public._acesso_notificar(pd.perfil_id, 'acesso.respondido',
    case when p_estado = 'expirado' then 'Acesso temporário encerrado' else 'Acesso retirado' end,
    'O acesso ' || case pd.nivel_dado when 'ver' then 'Ver' when 'editar' then 'Editar' else 'Total' end || ' em ' || rot ||
      case when p_estado = 'expirado' then ' chegou ao fim do prazo.' else ' foi retirado' || coalesce(': ' || nullif(trim(coalesce(p_motivo, '')), ''), '.') end,
    '#/', pd.id, jsonb_build_object('pedido_id', pd.id, 'modulo', pd.modulo));
end $$;
revoke execute on function public._acesso_desfazer(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public._acesso_desfazer(uuid, text, text, uuid) to service_role;

create or replace function public.acesso_revogar(p_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.sou_admin() then raise exception 'Só administrador tira acesso.' using errcode = '42501'; end if;
  if not exists (select 1 from public.acesso_pedidos where id = p_id and estado = 'aprovado') then raise exception 'Esse acesso já não está cedido.'; end if;
  perform public._acesso_desfazer(p_id, 'revogado', p_motivo, auth.uid());
end $$;

create or replace function public.acesso_expirar_vencidos()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0;
begin
  for r in select id from public.acesso_pedidos where estado = 'aprovado' and expira_em is not null and expira_em <= now() loop
    perform public._acesso_desfazer(r.id, 'expirado', null, null); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.acesso_expirar_vencidos() from public, anon, authenticated;

-- a lista traz os cedidos que ainda valem (sem limite de 60 dias) e os campos novos
create or replace function public.acesso_pedidos_listar()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select coalesce(jsonb_agg(x order by x.ordem, x.created_at desc), '[]') from (
    select ap.id, ap.perfil_id, p.nome, p.username, p.avatar_url, ap.modulo, m.rotulo as modulo_rotulo, ap.nivel, ap.motivo, ap.estado,
           ap.nivel_dado, ap.resposta, ap.created_at, ap.decidido_em, d.nome as decidido_por_nome,
           ap.origem, ap.chamado_id, sc.numero as chamado_numero, ap.expira_em, ap.antes_nivel, ap.antes_efeito,
           ap.revogado_em, r.nome as revogado_por_nome, ap.revogado_motivo,
           case public.nivel_modulo(ap.modulo, ap.perfil_id) when 1 then 'ver' when 2 then 'editar' when 3 then 'total' else 'sem' end as nivel_atual,
           case when ap.estado = 'pendente' then 0 when ap.estado = 'aprovado' then 1 else 2 end as ordem
      from public.acesso_pedidos ap
      join public.perfis p on p.id = ap.perfil_id
      join public.modulos m on m.id = ap.modulo
      left join public.perfis d on d.id = ap.decidido_por
      left join public.perfis r on r.id = ap.revogado_por
      left join public.suporte_chamados sc on sc.id = ap.chamado_id
     where (public.sou_admin() or ap.perfil_id = auth.uid())
       and (ap.estado in ('pendente', 'aprovado') or coalesce(ap.revogado_em, ap.decidido_em, ap.created_at) > now() - interval '60 days')
     limit 300) x $function$;

select cron.schedule('acessos-vencidos', '7 * * * *', 'select public.acesso_expirar_vencidos()');
