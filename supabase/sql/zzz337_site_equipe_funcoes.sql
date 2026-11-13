-- =====================================================================
-- zzz337 (4.46.3) — cargo da equipe no site segue as funções do sistema
-- Com cargo_perfil ligado, o cargo mostrado no site é a função principal
-- (ou a função personalizada) + as funções adicionais da pessoa,
-- separadas por " · ", e acompanha quando elas mudam no sistema.
-- =====================================================================
alter table public.site_itens add column if not exists cargo_perfil boolean not null default false;

create or replace function public._site_cargo_de(p_perfil uuid)
returns text language sql stable security definer set search_path = public as $$
  with p as (select * from public.perfis where id = p_perfil),
  f as (
    select 0 o, coalesce((select rotulo from public.funcoes_personalizadas fp where fp.id = p.funcao_personalizada), p.funcao) k from p
    union all
    select 1 + n, x from p, unnest(coalesce(p.funcoes_adicionais, '{}')) with ordinality as a(x, n)
  ),
  r as (
    select o, case lower(k) when 'coordenador' then 'Coordenador' when 'designer' then 'Designer' when 'videomaker' then 'Videomaker'
                            when 'admin' then 'Administrador' else k end rot
      from f where nullif(trim(k), '') is not null
  )
  select nullif(string_agg(rot, ' · ' order by o), '') from (select distinct on (rot) o, rot from r order by rot, o) d;
$$;
revoke all on function public._site_cargo_de(uuid) from public, anon, authenticated;

create or replace function public._site_itens_cargo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'equipe' and new.cargo_perfil and new.perfil_id is not null then
    new.texto := left(coalesce(public._site_cargo_de(new.perfil_id), new.texto), 800);
  end if;
  return new;
end $$;
revoke all on function public._site_itens_cargo() from public, anon, authenticated;
create or replace trigger site_itens_cargo before insert or update on public.site_itens
  for each row execute function public._site_itens_cargo();

create or replace function public._site_equipe_segue_funcao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.site_itens set updated_at = now()   -- o gatilho acima recalcula o cargo
   where tipo = 'equipe' and perfil_id = new.id and cargo_perfil;
  return null;
end $$;
revoke all on function public._site_equipe_segue_funcao() from public, anon, authenticated;
create or replace trigger perfis_site_cargo after update of funcao, funcoes_adicionais, funcao_personalizada on public.perfis
  for each row execute function public._site_equipe_segue_funcao();
