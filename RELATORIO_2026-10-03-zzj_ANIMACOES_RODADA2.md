# Relatório — animações, 2ª rodada: 13, 12, 11, 10, 8 e 7 (pacote zzj, 03/10)

Pedido: escolha "13, 12, 11, 10, 8, 7" da lista numerada de animações.

## O que foi feito
| # | O quê | Onde |
|---|---|---|
| 13 | **Modo foco do teleprompter.** Ao abrir, as "luzes da sala" se apagam das bordas para o centro (~1 s); então o texto surge do desfoque, o topo desce e os controles sobem. Sem `transform` no palco (o espelho usa `transform`); topo e controles usam a propriedade `translate`. | `styles/teleprompter.css` |
| 12 | **Carregamento com brilho da marca.** No lugar do cinza piscando, uma onda de luz rosa e violeta atravessa cada bloco, começando um pouco depois bloco a bloco (desce em diagonal). Só `transform` num pseudo-elemento, para não repintar. | `styles/global.css` |
| 11 | **Tela vazia com vida.** A lâmpada de marca d'água acende e apaga devagar (brilho rosa, sobe e gira de leve), soltando duas faíscas. O ícone do estado vazio flutua. Vale para todos os estados vazios do sistema. | `styles/global.css` |
| 10 | **Kanban com física** (quadro de Produção e quadro de Vídeo, no computador). No lugar da "foto" padrão do navegador, uma cópia do cartão segue o cursor, **inclina conforme a velocidade de lado** (até 14°) e volta a ficar reta quando a mão para. O marcador de posição abre espaço; ao soltar, o cartão **assenta com mola** no lugar novo. O arrastar, o mover e as regras de cada coluna são os mesmos de antes. | `js/movimento.js` (`arrastoFisico`, `assentar`), `js/kanban.js`, `js/video.js` |
| 8 | **"+" que vira menu.** O "+" do topo gira até virar "×" (com anel de luz) enquanto as opções estão abertas, e elas entram **em leque**: uma depois da outra, com o ícone "estourando" no lugar. Celular (folha) e computador (menu). | `js/topo.js`, `styles/global.css` |
| 7 | **Barra de baixo com rastro de luz.** Ao trocar de aba, a pílula de luz **estica no sentido da viagem** e deixa um rastro; o ícone escolhido dá um **pulinho**. | `js/nav.js` (`moverLuz`), `styles/global.css` |

"Reduzir movimento": tudo desligado.

Nada de dados, regras ou banco.

## Testes executados
Navegador do app, 390×844, tema escuro, sessão simulada. O painel do navegador estava oculto, por isso usei quadros congelados e eventos sintéticos.

| # | Teste | Resultado |
|---|---|---|
| 7 | Gravações → Clientes | luz de 231px para 159px, `viaja` + `data-dir=-1`, ícone com `pula` |
| 8 | Tocar no "+" (celular) | botão `girou`; 7 itens com `--i` 0…6; captura do leque no meio (itens em cascata, "+" virado em "×" com anel) |
| 11 | Estado vazio montado | captura com a lâmpada no pico do brilho |
| 12 | Esqueleto de cartões | captura com a onda rosa atravessando os blocos |
| 13 | Teleprompter (montado com a mesma estrutura) | as 5 animações presentes (`teleLuzes`, `teleTexto`, `teleSurgeProg`, `teleDesce`, `teleSobe`). Achado: as luzes fechavam rápido demais entre 0,33 e 0,47 s; curva suavizada e alongada para 1 s. Não houve captura (a captura de tela não respondeu) |
| 10 | Arrasto sintético (`DragEvent` + `DataTransfer`) | cópia criada; arrastando rápido para a direita: inclinação **11,7°**; parado: **0,2°** (volta a ficar reto); ao soltar a cópia some; o cartão recebe `b7-assenta` |

**Não testado:**
- o arrasto de verdade com mouse num quadro real;
- o teleprompter real aberto numa gravação;
- animações em movimento real;
- tema claro;
- celular físico.

O Kanban continua sem arrastar por toque no celular: o arrastar do navegador não funciona em tela de toque. Já era assim antes.
