# Relatório — zzz210 · Ajuda e Suporte repaginados

## Ajuda (#/ajuda)
- Tela inicial nova: "Como podemos ajudar?", busca grande com sugestões, progresso de leitura, "Você estava em", "Por onde começar", "Para você" (por função) e "Por assunto" com progresso por grupo.
- Busca mais esperta: ignora palavras soltas ("como", "de"…) e acha variações ("gravação" → "gravações", "remarcar" → "remarcada"), com trechos destacados.
- Tutorial: índice lateral com filtro, trilha, chips (tempo de leitura, passos, lido), "Ir para a tela", "Marcar como lido", passos marcáveis (todos marcados = lido), dicas/cuidados, "Este tutorial ajudou?" (Não → abre dúvida já preenchida no Suporte), anterior/próximo.
- Progresso guardado por pessoa neste aparelho (`b7_pref_ajuda_<id>`).

## Suporte (#/suporte)
- Topo com atalhos por tipo; números clicáveis (em aberto, com novidade, urgentes para a equipe, resolvidos em 30 dias); busca; filtros com contagem.
- Lista com ícone do tipo e bolinha de novidade; detalhe com linha do tempo do andamento, "Isso resolveu?" (reabrir), andamento da equipe (Salvar só quando muda), conversa em bolhas, mudanças de situação aparecendo na conversa, respostas prontas para a equipe, Ctrl+Enter envia.
- Atualiza sozinho a cada 40 s sem perder o rascunho.
- Ao abrir um chamado de dúvida/problema, sugere até 3 tutoriais conforme o resumo.

## Banco (já aplicado; registrado em migration_suporte.sql)
- `suporte_mensagens.sistema` (boolean).
- `suporte_status` grava a mensagem "Situação: …" quando muda.
- Nova `suporte_reabrir(p_id, p_motivo)`: autor ou equipe; só de resolvido/não será feito → em análise; avisa admin e coordenação.

Versão 2026-10-16-zzz210 · cache roteiros-b7-v413.
