# zzz194 — IA nas conversas do WhatsApp

- **Painel lateral (grupo de cliente aberto):** botões "O que rolou aqui?" (resumo em tópicos: pedidos do cliente, pendências, resolvido) e "Sugerir resposta" (mensagem curta, sem inventar prazo/valor). Resultado com "Colocar no WhatsApp" (escreve na conversa, a pessoa envia), "Copiar" e "De novo".
- **Servidor:** nova tarefa `whatsapp` na Edge Function `b7-ia` (`_shared/ia/whatsapp.ts`). Recebe as últimas 60 mensagens da conversa aberta (lidas pelo programa) e lê as pendências do cliente (vídeo, design, gravações) com a sessão da pessoa. Segue o liga/desliga de "chat" e a memória do cliente. Nada é guardado além do `ia_uso`.
- Publicada sozinha pelo workflow `funcoes` ao entrar na main.
- Só funciona no programa de Windows (é onde a conversa é lida).
