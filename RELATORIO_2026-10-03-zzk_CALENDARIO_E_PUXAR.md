# Relatório — Calendário no celular e "puxar para atualizar" (pacote zzk, 03/10)

Pedido: print do Calendário no celular + "Melhora essa tela e adiciona animação. E melhora essa animação e esse troço de atualizar".

No print, o disco da lâmpada (puxar para atualizar) estava **parado em cima da tela**, cobrindo o cartão do mês.

## Calendário (celular)
| O quê | Como ficou |
|---|---|
| Topo | Título com a semana numa frase ("10 nesta semana · 4 hoje"); botão "Marcar" mais curto (no computador continua "Marcar gravação"). |
| Faixa da semana | O dia escolhido é uma **pílula de luz** (degradê da marca) que **viaja** até o dia tocado, esticando no caminho. O número dá um pulinho. Hoje ganha um contorno; dias que já passaram ficam mais apagados; os pontinhos de evento "estouram" ao aparecer. |
| Arrastar de lado | Na **lista**, arrastar troca o **dia** (a lista segue o dedo). Na **faixa**, arrastar troca a **semana** (os dias entram deslizando do lado certo). As setas e o "Hoje" usam o mesmo movimento. |
| Tipos | Só o tipo escolhido mostra o nome; os outros mostram ícone e número. Antes, "Publicações 36" ficava cortado; agora os cinco cabem. |
| Filtros | Cliente, Responsável e "Mostrar canceladas" ficam numa **gaveta** atrás do botão "Filtros", que abre deslizando. O botão mostra quantos filtros estão ligados; "Oportunidades" continua ao lado. |
| Lista do dia | Cada item é um cartão com a **hora em destaque** ("09:30 / até 11:00"). Item sem hora mostra o ícone do tipo, não "Publicação" escrito. Tem uma faixa com a **cor do cliente**. A troca de dia entra em cascata, do lado certo. |
| Dia sem nada | Cartão "Dia livre" (ou "Nada aconteceu neste dia", se já passou) com o ícone animado. Tem um atalho **"Próximo: qui 1"** e, para gestores em dia futuro, "Marcar gravação". |

No computador (Mês, Semana e Dia) nada mudou, além da hora em negrito nas linhas da vista Dia.

## Puxar para atualizar
- **Por que ficou preso:** se um segundo dedo encostava no meio do puxão, o gesto perdia o fim e o disco ficava na tela. Também podia prender se a tela demorasse a responder.
- **Travas novas:**
  - segundo dedo cancela o puxão;
  - trocar de tela ou mandar o app para o segundo plano recolhe o disco;
  - se a tela demorar mais de 6 s, o disco sai assim mesmo;
  - o fim sempre limpa tudo.
- **Animação nova:**
  - um **anel de progresso** enche em volta da lâmpada enquanto a lâmpada enche de luz;
  - uma legenda acompanha: "Puxe para atualizar" → "Solte para atualizar" (com um toque de vibração) → "Atualizando…" (o anel vira um cometa girando e a lâmpada respira) → "Atualizado" (o anel fecha e dá um clarão);
  - depois o disco sobe e some.
- **O conteúdo desce de verdade junto com o dedo.** Antes, a animação de entrada da página prendia o conteúdo no lugar.

"Reduzir movimento": as animações são desligadas, as funções continuam.

Nenhuma mudança em dados, regras, banco ou permissões.

## Testes executados
Navegador do app, tema escuro, sessão e eventos simulados (10 eventos em 4 clientes). O painel do navegador estava oculto, por isso usei quadros congelados e toques sintéticos.

| Teste | Resultado |
|---|---|
| Celular 375×812: tela montada | Captura: topo, faixa com a pílula no sábado, tipos sem corte (largura 337 de 337), lista com hora e cor do cliente. |
| Tocar em QUA 30 | A pílula anima de 272px para 136px, esticando no meio. A lista entra com `cb-anim-ant`. Aparece o "Nada aconteceu neste dia" com "Próximo: qui 1". |
| Botão Filtros | A gaveta abre (86px); captura com os selects. Achado: "Responsável: todos" ficava cortado; corrigido com um campo por linha. |
| Arrastar a lista para a esquerda | A lista segue o dedo (−40px) e vai para 01/10 (`cb-anim-prox`). |
| Arrastar a faixa para a esquerda | Vai para a semana de 04 a 10/10; a faixa entra com `cb-faixa-prox`. |
| Pílula fora do lugar | Achado: ela ficava 8px deslocada quando a barra de rolagem aparecia. Agora é reposicionada a cada pintura e quando o tamanho muda. Depois da correção: 272 de 272. |
| Puxar até a metade | Anel em 52%, "Puxe para atualizar", conteúdo descido 37px. |
| Puxar até encher | Classe `cheia`, "Solte para atualizar", anel completo, conteúdo descido 81px. Captura. |
| Segundo dedo no meio | Cancela: o disco some e a tela não atualiza. |
| Puxão completo e soltar | `estoura` → "Atualizando…" → `pronto` "Atualizado" → disco limpo depois de cerca de 1,3 s. |
| Computador 1280px, vista Dia | Linhas com a hora "09:30–11:00" e "Publicação" / "Prazo" como antes. |

**Não testado:**
- celular físico (gesto real, vibração, rolagem);
- tema claro;
- dados reais;
- animações rodando em tempo real (só quadros congelados).