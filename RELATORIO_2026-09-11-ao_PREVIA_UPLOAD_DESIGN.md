# Build 2026-09-11-ao — relatório

**Pedido:** "quando eu clico em prévia para revisão, não aparece nada
pra mim" — com print de um arquivo já com status "Enviado" na gaveta
de Design, ao lado do seletor de papel mostrando "Prévia para
revisão".

## O que a auditoria encontrou

"Prévia para revisão" no print não é um botão nem um link — é o rótulo
do PAPEL do arquivo (o que ele representa dentro da versão), escolhido
num seletor ao lado do nome do arquivo. Esse seletor nunca teve
comportamento de clique — é normal ele "não fazer nada" ao clicar
nele mesmo.

O problema real, por trás do clique: depois que um arquivo termina de
subir nessa fila (peças de arte única — Card, Story, Capa de Reel),
não existia nenhuma forma de olhar o que foi enviado antes de mandar
pra revisão interna. Só nome do arquivo, tamanho e a palavra
"Enviado" — pra conferir se subiu certo, só baixando de novo (ou
mandando às cegas pra revisão).

Peças multiparte (Carrossel, Slides) já não tinham esse problema: cada
slide, ao subir um arquivo, recarrega a peça na hora e mostra a arte
normalmente na tela.

## O que mudou

Arquivo de imagem que termina de subir nessa fila ganha um botão
**"Ver"** ao lado de "Enviado". Clicar abre a mesma tela cheia (com
zoom, fechar pelo Esc ou clicando fora) que o sistema já usa pra olhar
arte já enviada — só que direto do arquivo recém-subido, sem precisar
esperar a peça inteira recarregar do banco primeiro.

Arquivo que não é imagem (PDF, PSD, AI…) continua sem botão "Ver" —
igual ao resto do sistema, que nesses casos só oferece baixar (não dá
pra abrir esse tipo de arquivo direto no navegador).

## Migração necessária

**Nenhuma.** Mudança de interface + um pequeno ajuste no que a função
de upload devolve internamente (id, caminho e tipo do arquivo, em vez
de só o id) — nada no banco.

## Arquivos no zip

`js/database.js`, `js/design.js`, `js/auth.js`, `sw.js`,
`CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-11-ao`, cache do service worker →
`roteiros-b7-v58`.
