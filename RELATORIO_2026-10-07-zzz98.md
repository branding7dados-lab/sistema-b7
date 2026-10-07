# Relatório — Ícones no estilo iOS (primeira etapa: navegação)

**Versão:** `2026-10-07-zzz98` · **Cache:** `roteiros-b7-v303`
**Pedido:** todos os ícones do sistema mais parecidos com os do iOS.

## Levantamento
O sistema tem **331 ícones desenhados à mão**, espalhados em cerca de 30 arquivos (não há uma biblioteca única). Trocar todos de uma vez, sem ver cada um em tela, quebraria coisa. Fiz por etapas, começando pelo que aparece em todas as telas.

Não usei os ícones oficiais da Apple (SF Symbols): a licença deles só permite uso em aplicativos para aparelhos Apple. Os ícones foram redesenhados no mesmo espírito.

## O que mudou nesta etapa
**Navegação — menu lateral, barra inferior do celular e a folha "Mais" (21 ícones):**
- redesenhados com formas mais simples e cantos bem redondos, traço um pouco mais cheio;
- **o destino ativo fica preenchido**, como na barra de abas do iOS; os outros continuam em contorno;
- "Mais" virou reticências dentro de um círculo; "Aprovações" virou círculo com visto; a casa do grupo Principal ganhou porta e cantos redondos.

**Sistema inteiro:** todos os ícones do tamanho padrão passaram a ter pontas e cantos de traço redondos (alguns tinham ponta reta).

## O que NÃO mudou
Os ícones de dentro das telas — botões, cartões, menus "⋯", Configurações, editor, vídeo, design, calendário, documentos — continuam com o desenho anterior. São cerca de 300 e ficam para as próximas etapas, tela por tela.

## Arquivos alterados
`js/nav.js`, `styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, conferidos em captura de tela:
- folha com os 21 ícones, cada um em contorno e preenchido, sobre o fundo do menu lateral;
- menu lateral real em 1280×800, com "Configurações" ativo (engrenagem preenchida);
- barra inferior real em tamanho de celular (375×812), com "Calendário" ativo.

## Não testado
- Tema escuro na barra inferior do celular.
- Menu lateral recolhido e a folha "Mais" aberta.
- Aparelho físico.
