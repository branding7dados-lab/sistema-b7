# Relatório — morph entre telas (pacote zzz7, 03/10)

Pedido: vídeo (navegando por Roteiros, Clientes, Publicações, Aprovações e Produção) + "quando as páginas já carregam… não tem nenhuma animação, é só a troca de página cruzona. Pensei em um Morph Transition… deve travar demais, né?".

## Não trava: View Transitions
O morph usa a **View Transitions API** do Chrome. O navegador fotografa a tela que sai e a que entra e anima as duas fotos na placa de vídeo, sem redesenhar a página a cada quadro. É o mesmo princípio de mexer só com posição e opacidade, que o celular faz de graça.

## O que acontece na troca de módulo
Vale para as abas da barra, a folha "Mais" e a lateral (`js/app.js`, `trocarComMorph`):
- **O título morfa:** "Gravações" vira "Clientes" deslizando e mudando de tamanho até o lugar do novo título.
- **O conteúdo desliza no sentido da aba:** aba à direita, ele entra pela direita; à esquerda, pela esquerda. Fora da barra (a "Mais"), ele só aproxima e assenta.
- **Topo e barra de baixo ficam parados.** A luz da barra continua deslizando como antes.
- **A entrada própria da tela não repete** depois do morph.

Abrir e voltar de um cartão (gravação, cliente, demanda) continua com o voo e a foto de `js/movimento.js`, que já faziam esse papel.

Sem morph quando: o navegador não suporta, as animações estão desligadas, há uma janela aberta ou a aba está escondida. Nesses casos a troca é a normal.

## As telas principais já chegam prontas na 1ª visita
`js/memoria.js` (`aquecer`): 3,5 s depois do login, em segundo plano e uma de cada vez, o app busca os dados de Clientes, Gravações, Roteiros, Vídeo e Central. No vídeo, a primeira ida a cada aba ainda mostrava esqueleto. Agora também abre pronta.

## Testes
Chromium 390×844, banco simulado, Gravações → Clientes pela barra:
- **60 ms:** começa o morph;
- **160 ms:** Gravações saindo para a direita, Clientes entrando e o título no meio do caminho;
- **300 ms:** quase assentado;
- **ao final:** sem resto da transição e sem erros.

`npm test`: tudo passou.

**Não testado:** celular físico.
