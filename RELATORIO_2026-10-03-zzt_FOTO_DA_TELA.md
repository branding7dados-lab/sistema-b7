# Relatório — "foto da tela": voltar sem esqueleto (pacote zzt, 03/10)

Pedido: vídeo (Gravações → gravação → voltar) + "Ainda tá ficando assim…".

## O que o vídeo mostrou
A animação nova do cartão (zzs) estava no ar. O que sobrou de "cara de carregamento" era outra coisa: **toda tela busca os dados de novo ao abrir** e, enquanto isso, mostra o esqueleto cinza. Ao voltar para a lista, apareciam ~0,4 s de esqueleto, depois a lista surgia do topo e não onde você estava.

Achado extra no código: o comentário do `js/movimento.js` dizia que o ouvinte de `hashchange` rodava antes do roteador. **Não roda.** O roteador troca a tela num microtask logo depois do ouvinte dele, que foi registrado antes.

## O que mudou (`js/movimento.js`, bloco "FOTO DA TELA")
- **Ao sair de uma tela**, o app guarda uma foto dela: o HTML já desenhado e a posição da rolagem. Telas inteiras em esqueleto não entram, e são guardadas no máximo 24 telas, válidas por 15 min.
  - A foto é tirada no toque (clique em fase de captura) e no "voltar" do aparelho (`popstate`), sempre **antes** da navegação. A chave é a rota que a tela mostrava.
- **Ao voltar para uma tela já vista**, a foto aparece **na hora**, no lugar exato e na mesma rolagem.
  - A tela de verdade monta por baixo com os dados novos. Quando ela fica pronta (sem esqueleto), a foto sai num esmaecer de 140 ms, a rolagem é mantida e a tela nova não refaz a animação de entrada.
  - A foto não recebe toque e some em no máximo 2,5 s, aconteça o que acontecer.
- **Voltar do detalhe para a lista** (com foto): a lista já está lá, a câmera recua (de leve maior e desfocada para o normal) e o cartão de onde se veio pousa no lugar.
- **Abrir um detalhe já visitado:** o cartão cresce e revela a foto do detalhe logo em seguida, sem esperar o carregamento.
- Isso vale para **todas as telas do painel**, não só para as listas com cartão. Trocar de aba na barra de baixo e voltar também abre na hora.

Estilo: `.b7-foto` em `styles/global.css` (fixa, abaixo do topo e da barra, sem animações internas).

Nada de dados, regras ou banco.

## Testes
Chromium headless, 390×844, lista de 12 gravações simulada, rolada até 300 px; o roteador do teste mostra 600 ms de esqueleto antes da lista:
- **Primeira versão:** a foto não aparecia. Era o problema de ordem do roteador descrito acima, corrigido tirando a foto no toque e no `popstate`.
- **Segunda versão:** a foto da lista saía errada, com o conteúdo do detalhe. No `popstate` o endereço já mudou, então a chave passou a ser a rota que a tela mostrava.
- **Final:**
  - em 80 ms, a lista já aparece na mesma rolagem e o cartão "Gravação 6" está pousando;
  - em 250 e 450 ms, a lista continua estável enquanto a tela de verdade ainda está em esqueleto por baixo;
  - em 800 ms, a tela de verdade assume na rolagem 230;
  - sem erros.

**Não testado:** celular físico, dados reais e telas com gráfico em canvas (na foto, um canvas sai em branco até a tela real assumir).
