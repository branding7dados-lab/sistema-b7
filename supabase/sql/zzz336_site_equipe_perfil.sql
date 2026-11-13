-- =====================================================================
-- zzz336 (4.46.2) — equipe do site usa a foto de perfil do sistema
-- A pessoa da equipe (site_itens tipo 'equipe') pode ser ligada ao perfil
-- dela no sistema: a foto do site passa a ser a foto de perfil e acompanha
-- quando a pessoa troca a foto. Enviar uma foto própria no painel desliga
-- isso (foto_perfil = false). Só acrescenta; nada é apagado.
-- =====================================================================
alter table public.site_itens add column if not exists perfil_id uuid references public.perfis(id) on delete set null;
alter table public.site_itens add column if not exists foto_perfil boolean not null default false;

create or replace function public._site_equipe_segue_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    update public.site_itens set capa_url = new.avatar_url, updated_at = now()
     where tipo = 'equipe' and perfil_id = new.id and foto_perfil;
  end if;
  return null;
end $$;
revoke all on function public._site_equipe_segue_perfil() from public, anon, authenticated;
create or replace trigger perfis_site_equipe after update of avatar_url on public.perfis
  for each row execute function public._site_equipe_segue_perfil();

-- liga quem já está na equipe ao perfil com o mesmo primeiro nome (só se houver um único)
with par as (
  select e.id item, (array_agg(p.id))[1] perfil, count(*) n
    from public.site_itens e
    join public.perfis p on p.estado = 'ativa'
     and lower(translate(split_part(p.nome, ' ', 1), 'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeiooouc' || 'AAAAEEIOOOUC'))
       = lower(translate(split_part(e.titulo, ' ', 1), 'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeiooouc' || 'AAAAEEIOOOUC'))
   where e.tipo = 'equipe' and e.perfil_id is null and e.capa_url is null
   group by e.id
)
update public.site_itens s set perfil_id = par.perfil, foto_perfil = true,
       capa_url = (select avatar_url from public.perfis where id = par.perfil), updated_at = now()
  from par where s.id = par.item and par.n = 1;

select titulo, perfil_id is not null ligado, capa_url is not null com_foto from public.site_itens where tipo = 'equipe' order by ordem;
