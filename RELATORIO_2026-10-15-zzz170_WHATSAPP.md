# zzz170 — WhatsApp dentro do sistema

- **Programa de Windows** (`app-desktop/whatsapp.js`, `preload-whatsapp.js`):
  - O WhatsApp Web oficial roda numa camada (WebContentsView) encaixada no espaço da tela `#/whatsapp`.
  - Tem sessão própria (`persist:whatsapp`) e continua ligado fora da tela.
  - O número de não lidas vem do título e vai para o menu. Clicar num aviso traz o programa para a tela do WhatsApp.
  - A camada se esconde quando algo do sistema fica por cima. A conferência usa `elementFromPoint` em 5 pontos.
- **Assinatura:**
  - Ao apertar Enter ou o botão de enviar, entra `*Nome:*` + quebra de linha no começo da mensagem, inserido como "colar" para o editor do WhatsApp aceitar.
  - Não repete o nome, não mexe em mensagem vazia nem na busca. O nome e o liga/desliga ficam na tela do WhatsApp.
- **Enviar no WhatsApp** (vídeo e gravação marcada):
  - O programa espera o WhatsApp conectar, procura o grupo pelo nome (`clientes.whatsapp_grupo`) e abre o anexo.
  - O vídeo entra como **documento**, posto via `DOM.setFileInputFiles` (protocolo de depuração). Depois o programa escreve a legenda.
  - **Não envia sozinho.** Se algo falhar, a mensagem fica copiada e aparece o motivo.
- **Navegador:** a mensagem é copiada e o WhatsApp Web abre numa aba.
- **Android:** o seletor de arquivo e o compartilhar mandam o vídeo como `application/octet-stream` (para ir como documento), com a mensagem de legenda. É preciso testar no aparelho.
- **Banco** (`migration_whatsapp.sql`, aplicada, só acrescenta):
  - coluna `clientes.whatsapp_grupo` e a view `clientes_resumo` com ela;
  - tabela `whatsapp_envios`, com leitura só pela equipe interna;
  - RPC `whatsapp_registrar_envio`, que também grava no histórico da demanda de vídeo (evento `whatsapp`).
- **Testado aqui:** o Electron abre o WhatsApp Web encaixado no retângulo certo (tela do QR Code). **Não testado** com uma conta do WhatsApp conectada: a abertura do grupo, o anexo e a assinatura dependem do site do WhatsApp e ainda precisam de teste real.

## zzz171 — correção: a tela do WhatsApp não abria
- `B7.Rota.titulo` recebe uma lista, e `B7.WhatsApp.abrir()` passava um texto. O `.join` quebrava antes de desenhar a tela, então o clique no menu "não fazia nada".
- A conferência "tem algo por cima?" passou a ignorar elementos pequenos (o botão flutuante do assistente, os avisos). Antes, o botão no canto escondia o WhatsApp para sempre.
- Testado no Electron com a tela real do sistema: a área é medida e a camada do WhatsApp é posta nela.
