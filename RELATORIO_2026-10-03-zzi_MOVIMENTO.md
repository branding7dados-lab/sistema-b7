# Relatório — card que vira tela, comemoração e puxar com a lâmpada (pacote zzi, 03/10)

Pedido: "Faz o 1, 2 e 3" (das ideias de animação: 1 card que vira tela, 2 comemorações, 3 puxar para atualizar com a lâmpada).

Arquivo novo: `js/movimento.js`, carregado depois de `js/app.js` e incluído na casca do service worker. Estilos no fim de `styles/global.css` ("MOVIMENTO").

## 1. Card que vira tela
- Ao tocar num item de lista, o próprio cartão **cresce até ocupar a área da tela** (cantos arredondando de 14 para 22px, conteúdo do cartão se apagando no caminho) enquanto o detalhe carrega por baixo. Quando o detalhe tem conteúdo de verdade (não só esqueleto), a "tela" dissolve revelando-o.
- **Ao voltar** para a lista, uma tela encolhe de volta **até o cartão de onde veio**; o cartão recebe um anel de luz ao "pousar". Se ele estiver fora da tela, a lista rola até ele.
- **Itens cobertos:**
  - Gravações (lista e cartões);
  - Visão geral do cliente (última gravação e os cartões de linha editorial e status semanal);
  - demandas de vídeo no celular;
  - linhas do Status semanal;
  - listas de Vídeo e Design do cliente;
  - Painel (atenção e compromissos);
  - cartões de cliente.
- Tocar em botão, menu ⋯, olho de prévia ou outro controle **dentro** do cartão não dispara o voo.
- O topo e a barra de baixo ficam por cima do voo.
- **Garantia:** o fantasma some em 2,6 s no máximo, mesmo com a aba em segundo plano.
- **Defeito achado no teste e corrigido:** o roteador troca a tela antes de o voo começar, e o cartão original já não existia. A cópia do cartão passou a ser feita no momento do toque, com as classes da tela de origem, para ficar idêntica.

## 2. Comemoração
- **Confete:** chuva curta (~2 s, canvas) em rosa, violeta, branco e verde.
- **Selo carimbado:** ✓ que se desenha + texto ("Vídeo entregue!", "Gravação concluída!", "Peça finalizada!", "Aprovado!").
- **Vibração** curta (Android).
- **Quando:** as funções do banco que concluem algo foram embrulhadas, e a festa só sai se a ação **deu certo** (promessa resolvida). Se o banco responder "já estava assim" (`inalterado`), não comemora.

| Função | Comemora quando |
|---|---|
| `gravacaoConcluir` | sempre |
| `registrarEntregaVideo` | sempre |
| `mudarStatusVideo` | o novo status é "entregue" |
| `finalizarDesign` | sempre |
| `decidirAprovacao` | a decisão é "aprovado" (cliente no Portal ou equipe registrando) |

## 3. Puxar para atualizar com a lâmpada (celular)
- No topo da tela, puxar para baixo faz aparecer um disco de vidro com a **lâmpada do B7 enchendo de luz de baixo para cima** conforme o dedo desce. O disco gira até o lugar e o conteúdo desce junto, com resistência.
- Soltando com a lâmpada cheia, ela **estoura**: onda de luz, clarão e vibração. A tela **recarrega os dados** (refaz a rota, sem recarregar a página) e a lâmpada gira enquanto isso.
  - Se houver aviso de versão nova na tela, aí sim recarrega a página.
- Puxão curto volta sem recarregar. Com a página rolada, não aparece. Dentro de campo de texto ou com modal, folha ou abertura na tela, não age.
- O "puxar" nativo do navegador foi desligado (`overscroll-behavior`), para não haver dois. **Efeito colateral:** em telas fora do painel principal (editor de roteiro, login) não há mais o puxar nativo.

"Reduzir movimento": sem voo e sem festa; o puxar funciona sem os efeitos.

Nada de dados, regras ou banco.

## Testes executados
Navegador do app, 390×844, sessão e dados simulados. O painel do navegador estava oculto, por isso `requestAnimationFrame` foi trocado por temporizador e os quadros foram congelados para as capturas.

| Teste | Resultado |
|---|---|
| Card → tela (Status semanal, "Sabor da Feira") | fantasma nasce no retângulo do cartão (topo 506px, 76px de altura), com a cópia do conteúdo e a animação de crescer; detalhe abriu ("Sabor da Feira"); fantasma removido |
| Captura no meio do voo | cartão quase em tela cheia, conteúdo se apagando. Problema achado: na cópia o olho caía para a linha de baixo, corrigido com as classes da tela de origem |
| Voltar | fantasma de volta criado; cartão de destino encontrado na lista |
| Funções embrulhadas | as 5 confirmadas (`__festa`) |
| Festa (captura) | selo ✓ rosa + "Vídeo entregue!" + confete. Problema achado: o texto quebrava em duas linhas, corrigido com `nowrap` |
| Puxar (toques simulados) | indicador aparece, lâmpada 100% cheia, conteúdo desce; ao soltar, "estoura", recarrega os dados (a lista foi buscada de novo) e recolhe |
| Puxão curto | não recarrega |
| Página rolada (300px) | lâmpada não aparece |

**Não testado:**
- as animações em movimento real (o painel oculto congela animações; conferido por estado e quadros);
- as ações reais de concluir, entregar, finalizar e aprovar disparando a festa (as funções embrulhadas foram confirmadas, a chamada com banco real não);
- vibração;
- celular físico;
- iPhone (o puxar deve funcionar; o voo e a festa, sim).
