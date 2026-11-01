# zzz306 — App B7 nativo, etapa 2: detalhe do vídeo, detalhe do design e chat

## Detalhe do vídeo (`app-nativo/src/app/video/[id].tsx`)
- Cabeçalho com cliente, título, etapa, prazo e formato.
- **Botão principal da etapa:**
  - A fazer → Começar a edição;
  - Em edição/Correção → Mandar uma versão, ou Enviar a versão N ao cliente;
  - Com o cliente → Cliente aprovou: entregar;
  - Standby → Voltar para a fila.
- **Mudar etapa** em folha nativa. "Cliente pediu ajuste" pede o texto e grava em correção.
- **Nova versão:** cola o link do vídeo (`video_criar_versao`).
- Versões com o estado (rascunho, com o cliente, ajuste, aprovada, entregue) e os **comentários** com minuto. "1:23 texto" vira timecode (`video_criar_comentario`).
- Histórico (`demandas_edicao_eventos`). A tela atualiza ao vivo (Realtime).

## Detalhe do design (`app-nativo/src/app/design/[id].tsx`)
- A arte da última versão em tela cheia (links assinados do bucket privado `design-files`). Dá para deslizar entre as partes, e tocar amplia (zoom de pinça no iPhone).
- **Ações pelo estado da versão:** aprovar internamente, pedir ajuste (com texto), enviar ao cliente e finalizar. Enviar arte nova continua no sistema completo, porque é upload.
- Designer, linha, aviso de briefing desatualizado, ajustes pedidos por parte e versões. Atualiza ao vivo.

## Chat (`app-nativo/src/app/conversas/`)
- **Lista** (`chat_lista`): foto, prévia, hora, não lidas, e "Nova" para abrir uma conversa com alguém da equipe (`chat_abrir_direta`).
- **Conversa:**
  - bolhas (as suas na cor da B7), agrupadas por autor;
  - a mensagem aparece na hora e é confirmada pelo servidor (`chat_enviar`);
  - chegada ao vivo, e abrir marca como lida;
  - fotos aparecem; áudio e arquivo abrem no sistema.
- Painel com botão 💬 e o número de não lidas. Mais → Conversas.

## Ainda no sistema completo
- Upload de arte e de vídeo.
- Ouvir áudio do chat.
- Notificações do app nativo: precisam registrar o app novo no Firebase (pacote `br.com.branding7.b7app`).

## Conferido
- `tsc --noEmit` sem erros; `expo-doctor` 20/20; `expo export` monta o pacote.
