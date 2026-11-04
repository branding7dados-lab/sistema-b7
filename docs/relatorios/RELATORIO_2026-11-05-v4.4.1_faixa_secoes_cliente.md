# v4.4.1: barra de seções do cliente sem a faixa escura

O Kevin viu uma "bordona preta" atrás da barra Visão geral / Editorial / … na página do cliente, cortando a luz do fundo.

## Causa
A barra é `sticky` (gruda no topo ao rolar). Para cobrir o conteúdo que passa por baixo, `styles/dashboard.css` (`.cli-secoes`) pintava:
- um fundo `var(--fundo)` liso;
- um `box-shadow` de 100vmax, recortado por `clip-path`, que estendia esse fundo pela largura toda da tela.

Com o fundo de luz da 4.0, isso virou uma faixa escura reta. O problema era real, não do print.

## Correção (`styles/v4.css`, 4.4.1)
- A faixa saiu: sem fundo, sem sombra e sem recorte.
- Só a cápsula tem fundo: vidro fosco (blur 18 px), com borda fina.
- No modo Leve, a cápsula usa fundo sólido, sem desfoque.

`npm test` passou.
