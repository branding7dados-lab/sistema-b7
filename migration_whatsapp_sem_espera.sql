-- =====================================================================
-- WHATSAPP: GRUPO SEM "ESPERANDO RESPOSTA" (zzz184)
-- Grupo que outra área cuida (ex.: Mercato Sadia, com os designers) não
-- entra na lista de esperando resposta do atendimento. Só acrescenta.
-- =====================================================================
alter table public.whatsapp_grupos add column if not exists sem_espera boolean not null default false;
create or replace function public.whatsapp_grupo_espera(p_nome text, p_sem boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe_interna() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  insert into whatsapp_grupos (nome, sem_espera) values (left(btrim(p_nome), 160), coalesce(p_sem, false))
  on conflict (nome) do update set sem_espera = excluded.sem_espera;
end $$;
revoke all on function public.whatsapp_grupo_espera(text, boolean) from public, anon;
grant execute on function public.whatsapp_grupo_espera(text, boolean) to authenticated;
update public.whatsapp_grupos set sem_espera = true where nome ilike '%mercato%';
