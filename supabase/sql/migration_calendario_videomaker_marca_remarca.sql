-- =====================================================================
-- VIDEOMAKER MARCA, REMARCA E CONCLUI GRAVAÇÃO PELO CALENDÁRIO (zzz67, 07/10/2026)
--
-- Na zzz66 o videomaker ganhou marcar/remarcar na TELA da gravação
-- (gravacao_agendar). Faltou o Calendário, que usa outras funções — por
-- isso "não funcionou": lá o botão "Marcar gravação" e as ações da
-- ocorrência continuavam só da equipe.
--
-- Três funções passam a aceitar equipe OU videomaker:
--   calendario_marcar_gravacao      cria a gravação já com data (botão "Marcar gravação")
--   calendario_ocorrencia_remarcar  remarcar
--   calendario_ocorrencia_concluir  marcar como concluída
--
-- Só a trava de entrada muda. Continua só da equipe: cancelar, excluir
-- e editar a gravação pelo calendário, vincular/desvincular evento,
-- criar gravação a partir de evento do Google e toda a configuração
-- das agendas. Nenhuma política de RLS, tabela ou dado é alterado
-- (a criação acontece dentro da função, que já existia).
--
-- Idempotente; para com erro se a trava esperada não aparecer uma vez.
-- =====================================================================
do $$
declare
  f text;
  def text;
  n int;
  antiga text := 'if not public.sou_equipe() then';
  nova text := 'if not (public.sou_equipe() or public.sou_videomaker()) then';
begin
  foreach f in array array[
    'calendario_marcar_gravacao', 'calendario_ocorrencia_remarcar', 'calendario_ocorrencia_concluir'
  ] loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = f;
    if def is null then raise exception 'Função % não encontrada.', f; end if;
    if position(nova in def) > 0 then continue; end if;   -- já migrada
    n := (length(def) - length(replace(def, antiga, ''))) / length(antiga);
    if n <> 1 then raise exception 'Função %: esperava 1 trava, achei %.', f, n; end if;
    execute replace(def, antiga, nova);
  end loop;
end $$;
