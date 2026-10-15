# zzz184 — WhatsApp: equipe, grupos sem espera e painel novo

- **Talita (comercial) contava como cliente:** a prévia do WhatsApp vem com marcas invisíveis de direção (U+202A…) e sem "Nome:". Agora essas marcas são removidas e uma prévia que começa com o nome de alguém da equipe conta como equipe.
- **Grupo sem "esperando resposta":** coluna `whatsapp_grupos.sem_espera` + RPC `whatsapp_grupo_espera` (`migration_whatsapp_sem_espera.sql`, já aplicada). Os grupos do Mercato Sadia (designers cuidam) já foram marcados. Na tela: × em cada item da lista e caixa "Avisar quando este grupo esperar resposta" no cartão do cliente.
- **Visual do painel lateral:** cartão do cliente em destaque, itens de espera com avatar e tempo em pílula, seções e estados vazios mais legíveis.
