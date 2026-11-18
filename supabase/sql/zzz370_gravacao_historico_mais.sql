-- 4.79.0 (QA): o histórico da gravação não registrava edição de item, mudança de ordem nem troca de local.
create or replace function public._grav_hist_item_editado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.titulo is distinct from old.titulo or new.url is distinct from old.url or new.observacao is distinct from old.observacao then
    perform public._grav_hist(new.gravacao_id, 'item_editado', jsonb_build_object('tipo', new.tipo, 'titulo', left(coalesce(new.titulo, ''), 120)));
  elsif new.position is distinct from old.position then
    /* um registro por reordenação (vários itens mudam juntos): só se não houve outro no último minuto */
    if not exists (select 1 from public.gravacao_historico where gravacao_id = new.gravacao_id and tipo = 'itens_reordenados' and criado_em > now() - interval '1 minute') then
      perform public._grav_hist(new.gravacao_id, 'itens_reordenados', '{}'::jsonb);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists gravacao_itens_historico on public.gravacao_itens;
create trigger gravacao_itens_historico after update of titulo, url, observacao, position on public.gravacao_itens
  for each row execute function public._grav_hist_item_editado();

create or replace function public._grav_hist_local()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.local is distinct from old.local then
    perform public._grav_hist(new.id, 'local_alterado', jsonb_build_object('de', left(coalesce(old.local, ''), 120), 'para', left(coalesce(new.local, ''), 120)));
  end if;
  return new;
end $$;
drop trigger if exists gravacoes_historico_local on public.gravacoes;
create trigger gravacoes_historico_local after update of local on public.gravacoes
  for each row execute function public._grav_hist_local();
