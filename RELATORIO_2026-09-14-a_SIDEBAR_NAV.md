# Build 2026-09-14-a — relatório

**Pedido:** sidebar não acompanhava a página ao abrir Linha Editorial
ou Status Semanal — ficava destacado o último item certo (ex.:
"Roteiros"), mesmo com a página já em "Linhas editoriais".

## O que a auditoria encontrou

Cada tela é responsável por avisar a sidebar que ela é a ativa agora
— uma chamada (`B7.Dashboard.marcarNav('#/rota')`) que já existe em
Roteiros, Clientes, Design, Kanban etc., sempre logo no início da
função que desenha a tela. As quatro telas de Linha Editorial e
Status Semanal nunca faziam essa chamada — por isso a sidebar
simplesmente continuava mostrando o que estava aceso antes de entrar
nelas.

## O que mudou

Adicionada a chamada que faltava, nas quatro telas:

- `js/conteudo.js` — lista de linhas editoriais (`#/linhas`)
- `js/linha.js` — uma linha editorial aberta (`#/linhas`)
- `js/semana.js` — lista de status semanal (`#/semanas`)
- `js/semana.js` — um status semanal aberto (`#/semanas`)

Mesmo padrão que o resto do sistema já usa — nada novo, só a peça que
faltava nessas quatro.

## Migração necessária

**Nenhuma.** Mudança só de interface.

## Arquivos no zip

`js/conteudo.js`, `js/linha.js`, `js/semana.js`, `js/auth.js`,
`sw.js`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-14-a`, cache do service worker →
`roteiros-b7-v59`.
