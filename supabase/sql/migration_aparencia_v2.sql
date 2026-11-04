-- =====================================================================
-- APARÊNCIA DO SISTEMA, 2ª VERSÃO (zzz144)
--
-- Mais opções além da cor: cor personalizada, menu lateral, estilo dos
-- botões e brilho de fundo. Uma função nova, aparencia_definir, valida e
-- grava a chave 'aparencia' de sistema_config (só administrador). A função
-- antiga, sistema_config_definir, continua aceitando o formato anterior
-- (telas ainda na versão antiga); nada nela foi alterado.
-- Só visual: nenhuma regra de negócio, acesso ou dado muda.
-- =====================================================================
create or replace function public.aparencia_definir(p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_lista jsonb := '[]'::jsonb;
  v_paleta text := coalesce(p_valor ->> 'paleta', 'b7');
  v_menu text := coalesce(p_valor ->> 'menu', 'padrao');
  v_botoes text := coalesce(p_valor ->> 'botoes', 'degrade');
  v_cor text := coalesce(p_valor ->> 'cor', '');
  c_paletas constant text[] := array['b7', 'oceano', 'floresta', 'porsol', 'grafite', 'rubi', 'ametista', 'dourado', 'indigo', 'custom'];
  c_cores constant text[] := array['rosa', 'vermelho', 'dourado', 'verde', 'azul'];
begin
  if not public.sou_admin() then
    raise exception 'Só administrador altera a aparência do sistema.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_valor) is distinct from 'object' or not (v_paleta = any (c_paletas)) then
    raise exception 'Valor inválido.';
  end if;
  if v_paleta = 'custom' and v_cor !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor inválida.'; end if;
  if v_paleta <> 'custom' then v_cor := ''; end if;
  if v_menu not in ('padrao', 'tingido', 'grafite') or v_botoes not in ('degrade', 'solido') then
    raise exception 'Valor inválido.';
  end if;
  if p_valor ? 'brilho' and jsonb_typeof(p_valor -> 'brilho') is distinct from 'boolean' then
    raise exception 'Valor inválido.';
  end if;
  if jsonb_typeof(coalesce(p_valor -> 'estacoes', '[]'::jsonb)) is distinct from 'array'
     or jsonb_array_length(coalesce(p_valor -> 'estacoes', '[]'::jsonb)) > 12 then
    raise exception 'Valor inválido.';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_valor -> 'estacoes', '[]'::jsonb)) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(v_item ->> 'de', '') !~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'
       or coalesce(v_item ->> 'ate', '') !~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$'
       or not (coalesce(v_item ->> 'cor', '') = any (c_cores))
       or coalesce(v_item ->> 'nome', '') !~ '^[^[:cntrl:]"\\]{1,40}$'
       or coalesce(v_item ->> 'frase', '') !~ '^[^[:cntrl:]"\\]{0,40}$' then
      raise exception 'Valor inválido.';
    end if;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('nome', v_item ->> 'nome', 'de', v_item ->> 'de',
      'ate', v_item ->> 'ate', 'cor', v_item ->> 'cor', 'frase', coalesce(v_item ->> 'frase', '')));
  end loop;
  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('aparencia', jsonb_build_object('paleta', v_paleta, 'cor', v_cor, 'menu', v_menu, 'botoes', v_botoes,
            'brilho', coalesce((p_valor ->> 'brilho')::boolean, false), 'estacoes', v_lista), now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
end
$$;
revoke all on function public.aparencia_definir(jsonb) from public, anon;
grant execute on function public.aparencia_definir(jsonb) to authenticated;
