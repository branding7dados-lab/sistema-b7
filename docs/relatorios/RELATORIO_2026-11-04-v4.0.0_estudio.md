# v4.0.0: B7 4.0, linguagem visual "Estúdio"

Item 9 da lista de melhorias. Das três direções desenhadas (A Estúdio, B Editorial, C Cartões vivos), o Kevin escolheu **A, nos dois temas**.

## Como foi feito
Um arquivo novo, `styles/v4.css`, carregado por último no `index.html`, troca a base do sistema inteiro sem mexer em cada tela:
- **Títulos** na fonte Sora (`assets/fonts/sora-var.woff2`, 25 KB, servida pelo próprio site). Todas as referências a Archivo nos CSS passaram para `'B7 Titulo'`. O PDF da semana (`js/doc-semana.js`) continua com Archivo.
- **Fundo com a luz da marca:** magenta no alto à direita e violeta embaixo à esquerda, presos à janela (o painel rola por cima). No escuro, as superfícies ficaram em ameixa profunda.
  - O painel que rola ficou transparente para a luz aparecer.
  - Na troca de tela (view transition), o painel recebe o mesmo fundo preso à janela, para a foto continuar opaca sem emendas.
  - No modo Leve, o fundo volta a ser liso.
- **Cartões:** cantos de 20 px, borda de luz no alto e sombra macia. No escuro, há um leve degradê translúcido sobre o cartão.
- **Botões:** pílula. O principal usa o degradê violeta→magenta com brilho.
- **Menu:** o item ativo tem o degradê da marca.
- **Abas, campos e janelas:** mais arredondados.

As cores escolhidas em Aparência continuam valendo por cima disso, porque as variáveis ficam no `<html>`.

## Arquivos
- `styles/v4.css` (novo), `assets/fonts/sora-var.woff2` (novo), `index.html`.
- `sw.js`: os dois arquivos novos entraram na lista da casca; cache `b7-v4.0.0`.
- `styles/*.css`: Archivo trocada por `'B7 Titulo'`.

## Conferência
- Prints do antes e depois em `#/video` e `#/clientes`, nos temas escuro e claro e no celular.
- `npm test` passou.

## Próximo
Aplicar a linguagem tela a tela (cabeçalhos com sobretítulo, Prioridade com faixas como no desenho A).
