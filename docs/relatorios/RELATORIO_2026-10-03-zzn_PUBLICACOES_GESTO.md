# Relatório — Publicações do Dia: troca de dia por engano e animação (pacote zzn, 03/10)

Pedido: vídeo (Chrome Android, 9 s) + "Conserta esse bug e refina a animação".

## O bug
Na tela rolada para baixo, ao arrastar de lado a lista "Próximas publicações" (que rola na horizontal), o mesmo gesto era lido como "trocar de dia". O dia pulava entre Sábado e Domingo a cada arraste. Como o título do dia estava fora da tela, parecia que o conteúdo trocava sozinho.

Causa: o "arrastar de lado" (zzl) estava ligado ao corpo inteiro da tela, que inclui o carrossel e os pendentes.

## Correção (`js/movimento.js`, `B7.Movimento.deslizar`)
- O gesto **não começa** se o toque nasce dentro de algo que rola de lado (carrossel, abas, chips) ou de um campo de texto.
- Nova opção `area`: em Publicações o gesto só vale no **bloco do dia**; no Calendário, só na lista do dia.
- O gesto horizontal agora precisa ser mais claro (14px e 1,6× mais de lado que de cima a baixo).
- Trocou o dia arrastando com a tela rolada para baixo? A tela sobe com suavidade até o título do dia novo.

## Animação refinada
- **Enquanto arrasta:** o bloco segue o dedo com resistência (anda menos quanto mais longe vai) e esmaece um pouco.
- **Ao soltar:** o bloco atual **sai para o lado do gesto** (140 ms) e o dia novo entra do outro lado, com um toque leve de vibração. Antes, ele voltava ao centro e trocava de repente.
- **"Peteleco"** (arraste rápido de 36px) também troca. Arraste curto e lento volta ao lugar com mola.
- **Entrada dos cartões sem desfoque:** no vídeo, os cartões apareciam borrados no meio da animação. Agora o deslocamento é curto (8px na vertical, 28px de lado) e a cascata é mais rápida (32ms por item, até 6).
- O Calendário recebeu o mesmo ajuste nas linhas do dia.

Nada de dados, regras ou banco.

## Testes executados
Navegador do app, 375×812, sessão e dados simulados, toques sintéticos, painel do navegador oculto.

| Teste | Resultado |
|---|---|
| Arrastar o carrossel "Próximas" (rolável) | dia **não** muda |
| Arrastar um pendente | dia **não** muda |
| Arrastar o bloco do dia 100px | segue o dedo (−41,8px, opacidade 0,84); sai animado (−41,8px → −70px, opacidade 0); vai para 04/10 e o bloco novo entra com `pb-anim-prox` |
| Arraste curto e lento (40px) | não troca, volta ao lugar |
| Peteleco rápido (45px) | troca o dia |
| Arrastar com a tela rolada (título do dia a −329px) | troca o dia e chama a rolagem até o título (testado com rolagem instantânea: o título fica a 8px do topo) |
| Achado | o CSP do pacote zzm bloqueou o `eval` do roteiro de teste, o que confirma que a proteção está ativa |

**Não testado:**
- gesto real no celular;
- rolagem suave em movimento (o painel oculto congela a animação).