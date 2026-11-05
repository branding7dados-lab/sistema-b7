-- 4.15.0 (PENDENTE): banco de roteiros — roteiro pode existir só com o cliente, sem gravação
alter table public.roteiros add column if not exists client_id uuid references public.clientes(id) on delete cascade;
update public.roteiros r set client_id = g.client_id from public.gravacoes g where g.id = r.recording_session_id and r.client_id is null;
alter table public.roteiros alter column recording_session_id drop not null;
create index if not exists roteiros_client_banco_idx on public.roteiros(client_id) where recording_session_id is null and deleted_at is null;
create or replace function public._roteiro_cliente() returns trigger language plpgsql set search_path = public as $$
begin
  if new.recording_session_id is not null then
    select client_id into new.client_id from public.gravacoes where id = new.recording_session_id;
  end if;
  return new;
end $$;
drop trigger if exists roteiro_cliente on public.roteiros;
create trigger roteiro_cliente before insert or update of recording_session_id on public.roteiros for each row execute function public._roteiro_cliente();
-- os 2 roteiros presos na gravação "Ogreja" (lixeira) vão para o banco da Branding7
update public.roteiros set recording_session_id = null where deleted_at is null and recording_session_id in (select id from public.gravacoes where deleted_at is not null);
-- roteiros "Em criação" cuja gravação já está como Gravado
update public.roteiros r set status = 'Gravado', updated_at = now() from public.gravacoes g where g.id = r.recording_session_id and r.deleted_at is null and r.status = 'Em criação' and g.status = 'Gravado';
