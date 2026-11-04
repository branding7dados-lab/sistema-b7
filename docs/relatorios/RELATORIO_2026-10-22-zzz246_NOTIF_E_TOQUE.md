# zzz246: caixa sumida nas Notificações e "toque para escolher" no celular

Kevin mandou um print da seção Notificações no programa do computador: uma caixa quase branca, sem título, e um aviso vermelho embaixo de "Push neste aparelho". Junto, pediu: "no android/ios, n tem como arrastar a foto de perfil, tem que selecionar, isso vale pra tudo."

## 1. Caixa quase branca com o título sumido
- **Causa (`js/admin-extra.js`):** com uma cor do sistema escolhida, os neutros do tema são recalculados no tom da cor. A tabela do escuro não tinha `--neutro-bg`, então o escuro herdava o `--neutro-bg` claro do tema: caixa quase branca com título branco por cima. Isso valia para qualquer caixa "neutra" do sistema, não só para as Notificações.
- **Correção:** `--neutro-bg` entrou na tabela do escuro, como transparência (.13), igual ao `global.css`.

## 2. Push no programa do computador
- **Antes:** no programa do computador (e em navegadores sem push) a linha "Push neste aparelho" aparecia desligada, travada e com o motivo em vermelho. Parecia defeito e repetia o que o resumo no alto já diz.
- **Agora:** sem push disponível, a linha não aparece. O resumo ("Avisos com o programa aberto…") explica como os avisos chegam.

## 3. "Arraste" no celular
- **Novo:** `B7.UI.toque()` diz se o aparelho é de toque (`hover: none` e `pointer: coarse`, como Android e iPhone).
- Nesses aparelhos, os textos de envio de arquivo passaram a dizer "toque para escolher":
  - foto de perfil (`js/foto.js`), também usada na foto que o admin troca;
  - logo do cliente;
  - print do suporte;
  - conversa vazia (aponta para o clipe);
  - importação da planilha de vídeo.
- No computador nada mudou.

## Versão
VERSAO `2026-10-22-zzz246`, CACHE `roteiros-b7-v448`, novidade `v-zzz246`.
