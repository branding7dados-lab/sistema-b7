-- =====================================================================
-- 4.92.0 — DESLIGAR UM MÓDULO PARA A AGÊNCIA INTEIRA
--
-- Configurações → Sistema da equipe → Módulos da agência. Um módulo
-- desligado some do menu, das buscas, do "Criar", dos atalhos e dos botões
-- de todas as telas, para TODO MUNDO (administradores inclusive). Quem
-- abrir o endereço direto vê um aviso no lugar da tela. Os dados ficam
-- intactos: religar devolve tudo como estava.
--
-- Guarda em sistema_config, chave 'modulos_desligados':
--   { "<módulo>": { "em": "<quando>", "por": "<perfil>", "por_nome": "<nome>", "motivo": "<texto ou null>" } }
--
-- Só administrador pleno grava (o Financeiro não). A equipe interna já lê
-- sistema_config (política sistema_config_le). Aditivo: nenhuma política
-- de acesso é criada ou alterada, e sistema_config_definir não é tocada.
-- =====================================================================

create or replace function public.modulo_desligar(p_modulo text, p_desligado boolean, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_nome text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  /* os mesmos ids de B7.Perm.MODULOS (js/permissoes.js) */
  c_modulos constant text[] := array[
    'clientes', 'linhas', 'roteiros', 'gravacoes', 'video', 'legendas', 'design', 'publicacoes', 'aprovacoes',
    'semanas', 'kanban', 'calendario', 'oportunidades', 'whatsapp', 'lixeira', 'equipe', 'operacoes', 'site'];
begin
  if not public.sou_admin_pleno() then
    raise exception 'Só administrador liga ou desliga módulos.' using errcode = '42501';
  end if;
  if p_modulo is null or not (p_modulo = any (c_modulos)) then
    raise exception 'Módulo desconhecido.';
  end if;
  if p_desligado is null then
    raise exception 'Diga se é para ligar ou desligar.';
  end if;
  if char_length(coalesce(v_motivo, '')) > 140 then
    raise exception 'O motivo pode ter até 140 letras.';
  end if;

  select valor into v from public.sistema_config where chave = 'modulos_desligados' for update;
  v := coalesce(v, '{}'::jsonb);

  if p_desligado then
    select nome into v_nome from public.perfis where id = auth.uid();
    v := v || jsonb_build_object(p_modulo, jsonb_build_object(
      'em', now(), 'por', auth.uid(), 'por_nome', v_nome, 'motivo', v_motivo));
  else
    v := v - p_modulo;
  end if;

  insert into public.sistema_config (chave, valor, atualizado_em, atualizado_por)
  values ('modulos_desligados', v, now(), auth.uid())
  on conflict (chave) do update
    set valor = excluded.valor, atualizado_em = now(), atualizado_por = auth.uid();
  return v;
end
$$;

revoke all on function public.modulo_desligar(text, boolean, text) from public, anon;
grant execute on function public.modulo_desligar(text, boolean, text) to authenticated;
