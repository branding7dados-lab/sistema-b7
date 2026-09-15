-- =========================================================================
-- B7 CALENDÁRIO — Excluir gravação de verdade (B7 + Google)
-- (Rodada y)
--
-- Diferente de "Cancelar" (só muda o status pra Cancelada, mantendo o
-- histórico — tanto a gravação quanto o evento no Google continuam
-- existindo). "Excluir" apaga mesmo: a gravação, todas as suas
-- ocorrências (histórico incluído), os roteiros e cenas dela (se houver
-- algum), e o evento correspondente no Google. Ação irreversível — o
-- frontend pede confirmação clara antes de chamar isto.
--
-- Depende de: sou_equipe(), public.gravacoes, public.gravacoes_ocorrencias,
-- public.calendario_eventos (migration_calendario.sql e
-- migration_calendario_status.sql já rodadas antes desta).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1) Apaga a gravação e tudo que depende dela no B7 (o banco já cuida da
--    cascata: gravacoes_ocorrencias, roteiros e cenas têm
--    "on delete cascade" apontando pra gravacoes). Devolve o evento_id
--    (se houver) pra quem chamou pedir a exclusão no Google em seguida —
--    a exclusão no Google é sempre feita depois, pela Edge Function,
--    nunca aqui: esta função nunca fala com a internet.
-- ---------------------------------------------------------------------
create or replace function public.calendario_gravacao_excluir(p_ocorrencia_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  oc public.gravacoes_ocorrencias%rowtype;
  v_gravacao_id uuid;
  v_evento_id uuid;
  v_qtd_roteiros integer;
begin
  if not public.sou_equipe() then
    raise exception 'Só admin/coordenador excluem uma gravação.' using errcode = '42501';
  end if;

  select * into oc from public.gravacoes_ocorrencias where id = p_ocorrencia_id;
  if not found then raise exception 'Ocorrência não encontrada.'; end if;
  v_gravacao_id := oc.gravacao_id;

  -- evento_id de QUALQUER ocorrência dessa gravação que ainda aponte pra
  -- um evento do Google (normalmente só a atual tem; remarcar reaproveita
  -- o mesmo evento, então uma única exclusão no Google já basta)
  select evento_id into v_evento_id
    from public.gravacoes_ocorrencias
    where gravacao_id = v_gravacao_id and evento_id is not null
    limit 1;

  select count(*) into v_qtd_roteiros from public.roteiros where recording_session_id = v_gravacao_id;

  delete from public.gravacoes where id = v_gravacao_id;

  return jsonb_build_object(
    'gravacao_id', v_gravacao_id,
    'evento_id', v_evento_id,
    'roteiros_excluidos', v_qtd_roteiros
  );
end;
$$;
revoke all on function public.calendario_gravacao_excluir(uuid) from public;
grant execute on function public.calendario_gravacao_excluir(uuid) to authenticated;
