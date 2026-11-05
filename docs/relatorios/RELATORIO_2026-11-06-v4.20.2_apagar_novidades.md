# v4.20.2 — Apagar novidades sem publicar o site

- RPC `novidades_ocultar(p_ids)` (só admin) grava `sistema_config.novidades_ocultas`; a lista é lida junto com as novidades manuais e esconde para todos as novidades de versão apagadas.
- No Novidades, o administrador vê 🗑 em cada item: novidade de versão vai para a lista de ocultas; aviso manual sai da lista do banco (`novidades_definir`). Confirmação antes.
- Publicar novidade sem atualizar o site já existia: Configurações → Publicar novidade.
