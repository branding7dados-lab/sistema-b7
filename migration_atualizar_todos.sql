-- =====================================================================
-- ATUALIZAR TODOS (zzz80)
-- O administrador pede que todo mundo passe para a versão publicada.
-- O pedido é uma linha em sistema_config (chave "atualizacao") com a
-- versão exigida; cada tela aberta confere e recarrega sozinha.
--
-- Aditivo: uma política de leitura a mais (só para essa chave, para
-- qualquer conta logada — o Portal do cliente também atualiza) e a
-- função de configuração aceita a chave nova. Só administrador grava.
-- =====================================================================

drop policy if exists sistema_config_le_atualizacao on public.sistema_config;
create policy sistema_config_le_atualizacao on public.sistema_config
  for select to authenticated using (chave = 'atualizacao');

create or replace function public.sistema_config_definir(p_chave text, p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_admin() then
    raise exception 'Só administrador altera as configurações do sistema.' using errcode = '42501';
  end if;

  if p_chave = 'atualizacao' then
    if jsonb_typeof(p_valor) is distinct from 'object'
       or jsonb_typeof(p_valor -> 'versao') is distinct from 'string'
       or (p_valor ->> 'versao') !~ '^[0-9a-z.-]{6,40}$' then
      raise exception 'Valor inválido.';
    end if;
    insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
    values (p_chave, jsonb_build_object('versao', p_valor ->> 'versao', 'em', now()), now(), auth.uid())
    on conflict (chave) do update
      set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
    return;
  end if;

  if p_chave is distinct from 'ia' then
    raise exception 'Configuração desconhecida.';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object'
     or jsonb_typeof(p_valor -> 'roteiros') is distinct from 'boolean'
     or jsonb_typeof(p_valor -> 'linhas') is distinct from 'boolean'
     or (p_valor ? 'chat' and jsonb_typeof(p_valor -> 'chat') is distinct from 'boolean') then
    raise exception 'Valor inválido.';
  end if;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values (p_chave, jsonb_build_object('roteiros', p_valor -> 'roteiros', 'linhas', p_valor -> 'linhas',
                                      'chat', coalesce(p_valor -> 'chat', 'true'::jsonb)), now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end
$$;

revoke all on function public.sistema_config_definir(text, jsonb) from public, anon;
grant execute on function public.sistema_config_definir(text, jsonb) to authenticated;
