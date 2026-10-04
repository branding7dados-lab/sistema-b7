# Relatório — morph cinematográfico e Usuários nova (pacote zzz8, 04/10)

Pedido: vídeo (Painel → Vídeo, Calendário → Roteiros pela Mais, Publicações → Aprovações) + "Esse Morph Transition tá feião… deixa mais cinematográfico… E a parte dos usuários, melhora a tela também".

## Por que o morph estava feio
1. **Morfava para o esqueleto.** As telas ainda abriam carregando, então a animação virava blocos cinza e só depois o conteúdo aparecia. A causa estava na memória de dados: qualquer aviso do Realtime (uma notificação nova, por exemplo) ou qualquer autosave obrigava **todas** as telas a esperar o banco, para sempre.
2. **O título deslizando** de uma tela para a outra ficava esquisito.
3. **A folha "Mais" fechando** se misturava com a troca de tela.

## O que mudou
- **Memória (`js/memoria.js`):** depois de uma escrita, só as leituras dos 4 segundos seguintes esperam o banco (2,5 s para o Realtime). É a tela redesenhando depois da ação. Passado esse tempo, o que está guardado volta a abrir na hora e é conferido por trás.
  - Corrigido também um erro que deixava essa janela sem efeito.
  - Teste novo em `testes/memoria.test.mjs`.
- **Morph cinema** (`js/app.js trocarComMorph`, `styles/global.css` MORPH), em cerca de 0,6 s:
  - a tela que sai **recua**, apaga e desfoca de leve;
  - a nova **se abre numa íris a partir do ponto tocado**, com um clarão que assenta;
  - um **anel de luz rosa** corre do dedo até as bordas;
  - topo e barra de baixo ficam parados;
  - a folha "Mais" sai junto com a tela antiga;
  - o morph espera a tela nova ficar pronta por até 0,45 s antes de fotografar.
  - No modo leve, ficam só a íris e o recuo, sem desfoque nem clarão.
- **Usuários e acessos** (`js/usuarios.js`, `styles/auth.css`):
  - cabeçalho em destaque, com luz e o botão "Novo usuário" em pílula;
  - quatro números que também filtram: contas, online agora (com pulso), equipe e clientes;
  - "Desativadas" como filtro;
  - **cada pessoa num cartão**, com:
    - avatar com moldura da cor do papel e ponto verde quando está online;
    - selo do papel e das funções extras;
    - empresas, para os clientes;
    - último acesso e "Editar acesso →";
  - cartões em cascata, com toque que afunda. As ações de antes continuam todas no ⋯.

## Testes
- **Morph:** Chromium 390×844, Gravações → Clientes. Íris e anel aparecem e a página nova chega opaca (o primeiro teste mostrou a antiga vazando por trás, e isso foi corrigido). Sem erros.
- **Usuários:** tema escuro e claro, com 6 contas simuladas (admin + videomaker, coordenador, designer, videomaker, cliente com empresa e uma conta desativada). Sem erros.
- **`npm test`:** tudo passou.

**Não testado:** celular físico.
