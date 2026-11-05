-- 4.13.1 (PENDENTE de aplicar): não deixa apagar de vez uma gravação que ainda
-- tem roteiros fora da lixeira (antes a cascata levava os roteiros junto),
-- e conteúdos sobrevivem quando a linha editorial é apagada.
create or replace function public._gravacao_protege_roteiros() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.roteiros where recording_session_id = old.id and deleted_at is null;
  if n > 0 then
    raise exception 'Esta gravação tem % roteiro(s). Mova os roteiros para outra gravação ou mande-os para a lixeira antes de apagar a gravação.', n
      using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists gravacao_protege_roteiros on public.gravacoes;
create trigger gravacao_protege_roteiros before delete on public.gravacoes
  for each row execute function public._gravacao_protege_roteiros();
alter table public.conteudos drop constraint conteudos_linha_id_fkey;
alter table public.conteudos add constraint conteudos_linha_id_fkey foreign key (linha_id) references public.linhas_editoriais(id) on delete set null;
