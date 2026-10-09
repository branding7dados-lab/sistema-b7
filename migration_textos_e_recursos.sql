-- =====================================================================
-- TEXTOS PADRÃO E LIGA/DESLIGA DE RECURSOS (zzz129)
--
-- Duas chaves novas em sistema_config, gravadas só pelo administrador
-- pela mesma função de sempre (sistema_config_definir):
--   "textos"   — os textos que o administrador reescreveu (mensagens
--                prontas para o cliente e frases do Portal). Só o que foi
--                mudado fica guardado; o resto segue o padrão da tela.
--   "recursos" — para quem cada recurso novo aparece: todos, só uma
--                pessoa, administradores + funções escolhidas, ou ninguém.
--
-- Aditivo. Nenhuma política de acesso criada ou alterada: a equipe já lê
-- sistema_config; o cliente do Portal recebe só os textos do Portal por
-- uma função própria (textos_padrao), sem ganhar leitura da tabela.
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
  c_textos constant text[] := array[
    'design_aprovacao_uma', 'design_lembrete_uma', 'design_aprovacao_varias', 'design_lembrete_varias',
    'semana_mensagem', 'acesso_entrega',
    'portal_boas_vindas', 'portal_pausado', 'portal_encerrado', 'portal_contato'];
  c_funcoes constant text[] := array['coordenador', 'videomaker', 'designer'];
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

  -- textos: só chaves conhecidas, só texto, até 800 caracteres cada.
  -- Texto vazio = volta ao padrão (a chave não é guardada).
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

  -- recursos: { "<id>": { "modo": todos|eu|funcoes|desligado, "funcoes": [...] } }
  -- "eu" guarda quem pediu (o servidor escreve a pessoa, não a tela).
  -- "todos" não é guardado: é o padrão.
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

-- Os textos que valem para quem chama. A equipe recebe todos; o cliente
-- do Portal recebe só os do Portal (as mensagens internas não saem).
create or replace function public.textos_padrao()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when public.sou_equipe_interna() then c.valor
                else (select coalesce(jsonb_object_agg(t.key, t.value), '{}'::jsonb)
                        from jsonb_each(c.valor) t where t.key like 'portal\_%') end
      from public.sistema_config c where c.chave = 'textos'), '{}'::jsonb);
$$;

revoke all on function public.textos_padrao() from public, anon;
grant execute on function public.textos_padrao() to authenticated;
