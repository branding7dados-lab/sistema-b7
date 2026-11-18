-- 4.79.0: ajustar células de Operações é só da gestão (admin e coordenação). Designer e videomaker só olham.
create or replace function public.operacoes_marcar(p_cliente uuid, p_ano int, p_mes int, p_coluna text, p_status text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then raise exception 'Só a coordenação ajusta Operações.'; end if;
  if p_coluna = 'mes' and not public.sou_admin() then raise exception 'Só o administrador confere o mês.'; end if;
  insert into public.operacoes_marcas (cliente_id, ano, mes, coluna, status, nota)
  values (p_cliente, p_ano, p_mes, p_coluna, left(nullif(trim(p_status), ''), 40), left(nullif(trim(p_nota), ''), 300))
  on conflict (cliente_id, ano, mes, coluna) do update
    set status = excluded.status, nota = excluded.nota, atualizado_por = auth.uid(), atualizado_em = now();
end $$;
revoke all on function public.operacoes_marcar(uuid, int, int, text, text, text) from public, anon;
grant execute on function public.operacoes_marcar(uuid, int, int, text, text, text) to authenticated;
