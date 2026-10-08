# Relatório — Barra lateral em vidro, flutuante, com versão recolhida só de ícones

**Versão:** `2026-10-08-zzz116` · **Cache:** `roteiros-b7-v321`
**Pedido (especificação do Kevin):** barra inspirada no iOS/iPadOS, premium e limpa. Expandida: flutuante, vidro escuro translúcido com desfoque, cantos arredondados, bordas sutis e reflexos em roxo e magenta; títulos das categorias discretos e bem espaçados; item ativo numa cápsula arredondada com brilho suave. Recolhida: barra estreita só com ícones, no mesmo vidro, com o ícone ativo numa cápsula compacta. Transição suave: textos somem em fade, ícones permanecem alinhados e a cápsula se adapta.

## Como ficou
**Expandida**
- A barra é um **cartão solto**: 12 px afastada das bordas, cantos de 26 px.
- **Vidro escuro translúcido** com desfoque do que está atrás, borda fina clara e um fio de luz no topo.
- **Reflexos:** roxo no alto à esquerda, magenta embaixo à direita, e uma faixa de luz bem fraca atravessando na diagonal.
- **Títulos das categorias** pequenos, em cinza claro, com as letras bem espaçadas.
- **Item ativo** numa cápsula com o degradê magenta → violeta em vidro, borda clara e um brilho suave em volta.

**Recolhida**
- Barra de 70 px no mesmo vidro, mostrando **o ícone de cada destino** (antes ela mostrava um botão por grupo, que abria um painel ao lado).
- O ativo fica numa **cápsula compacta**, com o ícone centralizado.
- Os títulos das categorias viram um **fio curto** separando os grupos.
- O nome de cada destino aparece numa dica ao passar o mouse.

**Transição**
- A largura da barra anima com uma curva suave (0,46 s).
- **Os ícones não se movem**: cada item é a mesma peça nos dois estados, com o ícone sempre na mesma distância da borda.
- Os nomes **somem em fade** (e voltam com um pequeno atraso ao expandir).
- A cápsula do ativo é o próprio item: **encolhe e cresce junto** com a barra.

No modo leve o vidro vira uma superfície sólida escura (sem desfoque). O celular não muda. No tablet a barra é sempre a fina.

## Arquivos alterados
`styles/nav.css`, `js/nav.js` (dicas com o nome no modo recolhido), `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em 1440×1000, tema claro, conta de administrador, **com o arquivo de estilos novo carregado sem cache**:
- **capturas dos dois estados**, conferidas visualmente: expandida flutuante em vidro com a cápsula em "Clientes"; recolhida só com ícones e cápsula compacta;
- **alinhamento:** o ícone do item ativo fica na mesma posição horizontal nos dois estados (37,5 px) e exatamente no centro da cápsula recolhida (desvio 0);
- medidas: expandida 256 px, recolhida 70 px, cápsula recolhida 48×36 px; os 18 destinos aparecem como ícones no modo recolhido;
- o campo "Visualizar como…" não aparece mais duplicado (na primeira captura sobrava um ícone solto; corrigi).

## Não testado
- **A transição em movimento.** O navegador de teste não roda animações: medi o começo e o fim, não o meio. É a parte que mais depende do seu olho.
- **Altura:** em 1000 px a lista expandida de administrador passa 8 px do espaço (o fim se dissolve em vez de cortar). Em telas mais baixas rola mais.
- Tema escuro, modo leve, tablet e a dica com o nome ao passar o mouse.
- O desfoque do vidro sobre telas com muita coisa atrás (a barra fica ao lado do conteúdo, então o que aparece através dela é sobretudo o fundo da página).
