# v3.1.1: sistema mais leve (troca de aba e vidro líquido)

Kevin: "o sistema tá muito pesado, principalmente no computador; quando troco de aba trava; no celular, depois do Liquid Glass, ficou bem pesado".

## Como medi
Abri o sistema num Chromium de teste com o processador **4× mais lento** (simulando um computador fraco), dados de exemplo (60 vídeos, 20 clientes) e 120 ms de rede. Troquei de aba como a pessoa faz, clicando no menu, e medi três coisas: as tarefas longas, os quadros travados e um perfil de CPU para ver quem gastava tempo.

## O que pesava
1. **Vidro líquido (`js/vidro.js`)** era o maior culpado, e **também no computador**, onde a barra de baixo nem aparece. Ele observava toda mudança de classe no `<html>`, e elas acontecem a toda hora: troca de tela, tempo real, animações. A cada uma, media a barra com `getBoundingClientRect`, o que obriga a página inteira a se recalcular. Foram **844 ms** de recálculo forçado em 7 trocas de aba.
2. **Cor da barra de status (`app.js` pintarBarraDoSistema)**: rodava a cada classe ou filho que mudava no body e lia o CSS calculado. Foram **332 ms**.
3. **Trilha do menu lateral (`moverTrilha`)**: media o item ativo logo depois de trocar a classe. Foram **319 ms**.
4. **Luz da barra de baixo (`nav.js moverLuz`)**: media a barra até no computador.
5. **Cascata dos cartões**: `void offsetWidth` para reiniciar a animação no Vídeo e no Design, o que forçava outro recálculo.
6. **A animação de troca de tela (View Transitions)**: congelava a tela antiga por **até 0,45 s** esperando a nova ficar pronta. Era o "trava ao trocar de aba". Além disso, ela desfocava a foto da tela inteira (`filter: blur`) a cada quadro.

## O que mudou
- `js/vidro.js`:
  - o tamanho da barra vem de um `ResizeObserver`, e não há mais medida a cada mudança de classe; só reage quando o modo leve liga ou desliga;
  - não desenha nada se a barra está escondida;
  - o filtro tem **uma passada** de deslocamento em vez de três (uma por cor, para uma franja que quase não se via). Isso deixa o filtro uns 3× mais barato por quadro no celular.
- `js/app.js`:
  - a cor da barra de status junta tudo num quadro só e só repinta se o tema, uma janela, o chat ou o teleprompter mudou;
  - a trilha do menu mede no próximo quadro;
  - a espera do morph caiu de 0,45 s para **0,12 s**.
- `js/nav.js`: a luz da barra de baixo não mede no computador, e a rolagem do menu lateral mede junto com o quadro.
- `js/video.js` e `js/design.js`: a cascata não força mais o recálculo.
- `styles/global.css`: a animação de troca de tela fica sem o desfoque. O movimento é o mesmo (recua e esmaece / sobe e aparece), feito só com opacidade e transform.

## Resultado (mesmo teste, processador 4× mais lento)
| | Antes | Depois |
|---|---|---|
| Recálculos forçados de página em 7 trocas | ~1,8 s | ~0,3 s |
| Tela congelada na troca de aba (Vídeo) | 569 ms | 338 ms |
| Tela congelada na troca de aba (Design) | 658 ms | 335 ms |
| Tela congelada na troca de aba (Calendário) | 477 ms | 321 ms |

Num computador normal, divida por cerca de 4.

## Testes
`npm test` passou inteiro (inclui a fumaça e o "tempo real sem piscar").
