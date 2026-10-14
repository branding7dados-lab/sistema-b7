# zzz169 — Assistente, Conversas, Aparência, tempo real e atualização do programa de Windows

- **Programa de Windows:** o selo no topo mostra "Atualização · N%" enquanto baixa e "Atualizar agora" quando está pronta (instala com um clique), e aparece também um aviso do Windows. O programa confere a cada 30 min e quando a janela volta ao foco. Os programas antigos são atendidos pela consulta do site à release `app-desktop` (js/atualizacao-pc.js; app-desktop/main.js e preload.js).
- **Tempo real:** espera de ~0,3 s (antes eram 0,9 s, mais 2,5 s depois de qualquer rolagem ou toque). Reconecta sozinho quando o canal cai e atualiza a tela ao voltar de uma aba escondida (>1 min) ou quando a internet volta.
- **Assistente (js/ia-chat.js):** seletor de cliente com busca e recentes, histórico com busca e separado por dia, Copiar, Tentar de novo, botão de ir ao fim e layout largo com histórico ao lado.
- **Conversas (js/conversas.js):** duas colunas a partir de 1100px, busca, filtro de não lidas, responder, reações, editar, emojis e arrastar arquivos. Banco: `migration_conversas_v2.sql`, aplicada e só aditiva.
- **Aparência (js/admin-extra.js):** 5 paletas novas, garantia de contraste AA, opções de fundos e cantos, tema claro/escuro/automático e prévia. Banco: `migration_aparencia_v3.sql`, aplicada.
