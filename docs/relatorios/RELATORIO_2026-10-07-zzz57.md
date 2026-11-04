# Relatório zzz57 — Atmosfera do Painel no PC (07/10/2026)

**Versão:** `2026-10-07-zzz57` · **Cache:** `roteiros-b7-v262`

## O que foi pedido
Depois das três colunas (zzz56), Kevin apontou o fundo: no monitor o céu da saudação terminava num corte reto nas laterais e, abaixo dos blocos, a página era fundo liso.

## O que mudou
Somente `styles/painel.css` (bloco novo no fim), válido a partir de 1101 px de largura. Nenhum JavaScript, dado, regra ou link. Sem migração.

- O céu da saudação se desfaz para os lados (máscara horizontal), sem corte reto.
- O Painel passa a ocupar a altura inteira da janela.
- Uma luz baixa sobe do rodapé — a cor da marca à esquerda, violeta à direita — e deriva devagar (16 s, vai e volta). Fica atrás de tudo e não recebe clique.
- Tema claro: a mesma luz, mais fraca. Modo leve e "reduzir movimento": a luz fica parada.
- Celular e tablet: nada muda.

## Testes realmente executados
Modelo estático local (casca do Painel, tema escuro, 1840×900) no navegador embutido:
- o Painel ficou com a altura da área de rolagem (844 px) sem criar rolagem vertical nem horizontal;
- a luz do rodapé existe (560 px de altura, animação ativa) e aparece na captura;
- a máscara lateral do céu foi aplicada (duas camadas, composição "intersect").

## Não testado
- O Painel real com conta logada, tema claro, modo leve e monitor físico.
- A animação em movimento (o navegador de teste fica com os quadros congelados): só o primeiro quadro foi visto.
