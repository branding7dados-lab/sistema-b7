-- =====================================================================
-- APARÊNCIA DO SISTEMA (zzz140): cor do sistema e datas especiais da
-- abertura. Só visual: não muda regra de negócio, acesso nem dado.
--
--   · sistema_config_definir aceita a chave 'aparencia':
--       { "paleta": "b7|oceano|floresta|porsol|grafite",
--         "estacoes": [ { "nome", "de": "DD/MM", "ate": "DD/MM",
--                         "cor": "rosa|vermelho|dourado|verde|azul", "frase" } ] }
--     (até 12 datas; só administrador grava).
--   · sistema_avisos() devolve 'aparencia' à equipe interna (o Portal do
--     cliente não recebe), na mesma consulta que cada tela já faz.
-- A função e a regra de acesso da tabela seguem como estavam; só entra
-- o ramo novo.
-- =====================================================================
create or replace function public.sistema_config_definir(p_chave text, p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text;
  v_item jsonb;
  v_limpo jsonb := '{}'::jsonb;
  v_lista jsonb := '[]'::jsonb;
  c_textos constant text[] := array[
    'design_aprovacao_uma', 'design_lembrete_uma', 'design_aprovacao_varias', 'design_lembrete_varias',
    'semana_mensagem', 'acesso_entrega',
    'portal_boas_vindas', 'portal_pausado', 'portal_encerrado', 'portal_contato'];
  c_funcoes constant text[] := array['coordenador', 'videomaker', 'designer'];
  c_paletas constant text[] := array['b7', 'oceano', 'floresta', 'porsol', 'grafite'];
  c_cores constant text[] := array['rosa', 'vermelho', 'dourado', 'verde', 'azul'];
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

  if p_chave = 'textos' then
    if jsonb_typeof(p_valor) is distinct from 'object' then raise exception 'Valor inválido.'; end if;
    for v_chave, v_item in select * from jsonb_each(p_valor) loop
      if not (v_chave = any (c_textos)) or jsonb_typeof(v_item) is distinct from 'string'
         or char_length(v_item #>> '{}') > 800 then
        raise exception 'Valor inválido.';
      end if;
      if btrim(v_item #>> '{}') <> '' then
        v_limpo := v_limpo || jsonb_build_object(v_chave, v_item #>> '{}');
      end if;
    end loop;
    insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
    values (p_chave, v_limpo, now(), auth.uid())
    on conflict (chave) do update
      set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
    return;
  end if;

  if p_chave = 'recursos' then
    if jsonb_typeof(p_valor) is distinct from 'object' then raise exception 'Valor inválido.'; end if;
    for v_chave, v_item in select * from jsonb_each(p_valor) loop
      if v_chave !~ '^[a-z][a-z0-9_]{1,30}$' or jsonb_typeof(v_item) is distinct from 'object'
         or coalesce(v_item ->> 'modo', '') not in ('todos', 'eu', 'funcoes', 'desligado') then
        raise exception 'Valor inválido.';
      end if;
      if v_item ->> 'modo' = 'eu' then
        v_limpo := v_limpo || jsonb_build_object(v_chave, jsonb_build_object('modo', 'eu',
          'pessoa', coalesce(nullif(v_item ->> 'pessoa', '')::uuid, auth.uid())));
      elsif v_item ->> 'modo' = 'funcoes' then
        if jsonb_typeof(coalesce(v_item -> 'funcoes', '[]'::jsonb)) is distinct from 'array' then raise exception 'Valor inválido.'; end if;
        v_limpo := v_limpo || jsonb_build_object(v_chave, jsonb_build_object('modo', 'funcoes', 'funcoes',
          (select coalesce(jsonb_agg(f), '[]'::jsonb) from jsonb_array_elements_text(coalesce(v_item -> 'funcoes', '[]'::jsonb)) f
            where f = any (c_funcoes))));
      elsif v_item ->> 'modo' = 'desligado' then
        v_limpo := v_limpo || jsonb_build_object(v_chave, jsonb_build_object('modo', 'desligado'));
      end if;
    end loop;
    insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
    values (p_chave, v_limpo, now(), auth.uid())
    on conflict (chave) do update
      set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
    return;
  end if;

  if p_chave = 'aparencia' then
    if jsonb_typeof(p_valor) is distinct from 'object'
       or not (coalesce(p_valor ->> 'paleta', 'b7') = any (c_paletas)) then
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
    values (p_chave, jsonb_build_object('paleta', coalesce(p_valor ->> 'paleta', 'b7'), 'estacoes', v_lista), now(), auth.uid())
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

create or replace function public.sistema_avisos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('agora', now(), 'sessao', public.sessao_valida(),
    'aparencia', case when public.sou_equipe_interna()
                      then coalesce((select valor from public.sistema_config where chave = 'aparencia'), '{}'::jsonb) end,
    'manutencao', (
    select c.valor - 'por'
      from public.sistema_config c
     where c.chave = 'manutencao'
       and coalesce((c.valor ->> 'ativo')::boolean, false)
       and (c.valor ->> 'fim' is null or (c.valor ->> 'fim')::timestamptz > now())
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))
       and (public.sou_admin() or (c.valor ->> 'inicio')::timestamptz <= now() + interval '10 minutes')));
$$;
revoke all on function public.sistema_avisos() from public, anon;
grant execute on function public.sistema_avisos() to authenticated;
