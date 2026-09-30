-- =====================================================================
-- Função extra "designer" (Painel unificado, 30/09)
--
-- O banco já aceita a função (check de perfis_funcoes_extra), e
-- design_atribuir / linha_concluir já aceitam Administrador e
-- Coordenador como responsável de Design. Falta só uma coisa: o aviso
-- "Nova demanda de Design disponível" (linha concluída sem responsável)
-- ia apenas para quem é Designer pelo PAPEL. Agora vai também para quem
-- tem a função extra "designer".
--
-- Troca cirúrgica de UMA condição dentro de design_processar_evento, sem
-- reescrever a função inteira (o restante continua byte a byte igual).
-- Idempotente: se a condição já foi trocada, não faz nada.
-- =====================================================================
do $$
declare
  def text;
  antigo constant text := 'from public.perfis p where p.estado = ''ativa'' and p.papel = ''designer''';
  novo   constant text := 'from public.perfis p where p.estado = ''ativa'' and (p.papel = ''designer'' or public.tenho_funcao_extra(''designer'', p.id))';
begin
  def := pg_get_functiondef('public.design_processar_evento(uuid)'::regprocedure);
  if position(novo in def) > 0 then
    raise notice 'design_processar_evento já considera a função extra designer';
    return;
  end if;
  if position(antigo in def) = 0 then
    raise exception 'Trecho esperado não encontrado em design_processar_evento — nada foi alterado.';
  end if;
  execute replace(def, antigo, novo);
end $$;
