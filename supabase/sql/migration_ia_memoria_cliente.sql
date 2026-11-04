-- =====================================================================
-- MEMÓRIA DA IA POR CLIENTE (Kevin, 08/10/2026 — zzz123)
-- Um campo de texto livre na ficha de Inteligência do cliente: o que a
-- IA deve saber sempre que trabalhar para ele (o que já funcionou, o que
-- o cliente não aceita, combinados). Vai em TODAS as tarefas de IA.
--
-- Só uma coluna nova numa tabela que já existe. As regras de acesso de
-- cliente_inteligencia valem para ela como para as outras colunas
-- (equipe interna lê, equipe edita): nenhuma policy criada ou alterada.
-- Para desfazer: alter table public.cliente_inteligencia drop column ia_notas;
-- =====================================================================
alter table public.cliente_inteligencia add column if not exists ia_notas text;
comment on column public.cliente_inteligencia.ia_notas is
  'Memória da IA: o que a equipe quer que a IA saiba sempre sobre este cliente. Entra em todas as tarefas de IA.';
