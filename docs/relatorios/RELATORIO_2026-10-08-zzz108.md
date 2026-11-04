# Relatório — Folha "Mais" refeita como lista (terceira versão)

**Versão:** `2026-10-08-zzz108` · **Cache:** `roteiros-b7-v313`
**Relato:** "Ficou horrível, melhora isso aí e melhora a animação" — sobre os blocos em duas colunas da zzz103.

## O que estava ruim na versão anterior
Os blocos em duas colunas ficavam desiguais: seções com um destino só deixavam metade da linha vazia, nomes compridos quebravam em duas linhas e o conjunto ficava pesado, sem ritmo.

## O que mudou
A folha virou uma **lista**, que é como a aba "Mais" funciona no próprio iOS:
- cada seção é um **bloco branco de cantos redondos**; os títulos das seções saíram da vista (continuam existindo para leitor de tela);
- cada destino é uma **linha inteira**: ícone colorido, nome e seta à direita, com um fio fino entre as linhas começando depois do ícone;
- nomes em uma linha só, todos alinhados;
- a tela em que você está aparece com o **nome na cor da marca e um visto** no lugar da seta (antes era um contorno em volta do bloco);
- as cores por destino e os ícones cheios foram mantidos.

**Animação nova**
- os blocos **sobem um depois do outro**, com mola;
- dentro deles, as linhas **chegam deslizando da direita**, em sequência;
- o ícone de cada linha **estala** no fim (cresce de pequeno até o tamanho);
- ao tocar, a linha escurece, como no iOS.

Nenhum destino mudou de seção nem de ordem.

## Arquivos alterados
`styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em tamanho de celular (375×812), tema claro, conta de administrador:
- uma captura da lista aberta, conferida visualmente (blocos, fios, setas, visto em "Arquivados");
- essa captura mostrou um defeito — os blocos encolhiam e cortavam linhas ("Status semanal" sumia). Corrigi e conferi por medida: os cinco blocos têm a altura das suas linhas (1, 1, 8, 2 e 3) e as 15 linhas estão presentes.

## Não testado
- **Captura depois da correção:** não saiu; a correção foi conferida só por medida.
- **A animação:** o navegador de teste não roda animações. Precisa ser vista no celular.
- Num celular de 812 px de altura a lista rola 57 px (com os 15 destinos de administrador). Em aparelho mais alto, como o do print, deve caber inteira — não conferi.
- Tema escuro e contas com menos destinos.
