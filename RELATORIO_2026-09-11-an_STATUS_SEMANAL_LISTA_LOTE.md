# Build 2026-09-11-an — relatório

**Pedido:** "Outra coisa, melhorar a ui/ux do status, separar por mês e
dentro do mês ter as semanas. […] ter a opção de exportar o status
semanal de todos os clientes que fizemos daquela semana."

## 1) Lista do Status Semanal por mês e semana

Antes: uma fila plana de cards de cliente, sem nenhuma organização por
data (só ordenada da semana mais recente pra mais antiga).

Agora: acordeão de dois níveis.

- **Mês** (ex.: "Setembro de 2026") — o mês mais recente já vem
  aberto; contagem de quantos status existem naquele mês.
- **Semana**, dentro do mês (ex.: "14 a 20 de setembro · 2026") —
  contagem de clientes daquela semana, e é aqui que mora o botão
  "Exportar semana".

Cada card de cliente continua exatamente igual (mesmo clique pra
abrir, mesma "Prévia"). Fechar um mês ou uma semana é lembrado — abrir
a lista de novo mantém o que você tinha fechado.

A busca por cliente ou período (que já existia) continua funcionando
do mesmo jeito, mas desmonta o agrupamento enquanto houver texto
digitado: mostra os resultados numa lista só, sem esconder atrás de
acordeão fechado.

## 2) Exportar a semana inteira

Botão "Exportar semana" no cabeçalho de cada grupo de semana. Ao
clicar:

1. Gera o PNG do status de cada cliente daquela semana, um de cada
   vez (o navegador não lida bem com várias renderizações
   simultâneas).
2. Empacota todos num `.zip` só e baixa — não precisa mais abrir
   cliente por cliente pra exportar a semana toda.
3. Usa as mesmas preferências de exportação que já estavam salvas em
   cada status (mostrar dias vazios, observações, legenda, itens
   concluídos) — o PNG de cada cliente no lote sai igual ao que
   sairia exportando aquele cliente individualmente.
4. Se um cliente específico falhar na geração, o lote segue sem ele e
   avisa no final quantos saíram certo (em vez de travar tudo por
   causa de um só).

Não baixa PDF em lote por enquanto — só PNG, que é o formato mais
usado no dia a dia (WhatsApp). Se fizer falta, é uma extensão do mesmo
mecanismo.

## Detalhe técnico (só pra registro)

O sistema já tinha um "escritor de .zip" feito à mão (sem biblioteca
externa), usado só pelo Design pra baixar o conjunto de artes de uma
peça inteira. Essa peça de código virou compartilhada
(`B7.Export.montarZip`) — o Design passou a chamar a versão
compartilhada em vez de ter a sua própria cópia. Nenhum comportamento
do Design mudou; só parou de duplicar código.

## Migração necessária

**Nenhuma.** Esta build é só interface — nenhuma tabela, view ou
função no banco.

## Arquivos no zip

`js/semana.js`, `js/doc-semana.js`, `js/extras.js`, `js/design.js`,
`styles/semana.css`, `js/auth.js`, `sw.js`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-11-an`, cache do service worker →
`roteiros-b7-v57`.
