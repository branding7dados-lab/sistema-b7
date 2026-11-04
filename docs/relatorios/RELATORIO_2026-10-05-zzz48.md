# Relatório 2026-10-05-zzz48 — Os achados leves da revisão

Sete irritações pequenas que a revisão geral (zzz45) registrou e ninguém tinha
mexido. Nenhuma era grave; todas aparecem no uso diário.

## Corrigidos

**Zoom do roteiro voltava ao padrão a cada recarga** — `js/editor.js`
`B7.pref.gravar('zoom', …)` acontecia, mas nenhum `ler` existia: a escolha era
guardada e nunca usada. Agora `abrir()` lê a preferência. De quebra, `fechadas`
(as cenas recolhidas) também passou a zerar: o estado de uma gravação atravessava
para a próxima aberta na mesma sessão, e cenas apareciam recolhidas sem motivo.

**Duplicar demanda bagunçava a ordem do dia** — `js/semana.js`
A cópia nascia com `position = original + 1`, a mesma do item que vinha depois.
Com duas demandas na mesma posição, a ordem passava a depender do desempate do
banco. Agora o dia inteiro é renumerado, como já acontecia no "mover".

**Buscar "und" em Roteiros trazia os roteiros incompletos** — `js/dashboard.js`
`r.titulo + ' ' + g.cliente_nome + …` com campo vazio colocava a palavra
`undefined` dentro do texto buscado. Trocado por `filter(Boolean).join(' ')`.

**Aba "Equipe" do Design mantinha o bloco de cima na tela** — `js/design.js`
`desenharArea()` saía cedo no ramo da aba Equipe, antes de chamar
`desenharResumoEquipe()` — que é justamente quem sabe apagar os chips de
"precisa de você". Eles ficavam por cima da grade de designers.

**Atalho "Nova demanda" abria modal sozinho** — `js/topo.js`
`naTelaClicar` procurava o botão a cada 120 ms por 8 segundos, sem olhar onde a
pessoa estava. Quem escolhia a ação, navegava para outro lugar e voltava dentro
desse intervalo via o modal abrir sem ter pedido. Agora a busca para assim que a
rota deixa de ser a pedida.

**Fila de limpeza da rota enchia de repetidos** — `js/app.js`, `js/kanban.js`
`aoSair` aceitava a mesma função várias vezes (a prévia dos Clientes registrava
a cada tecla digitada na busca). Agora ignora repetição. No Kanban, cada
redesenho criava mais um `ResizeObserver`; agora o anterior é desligado antes.

**Ouvinte do popup do Google ficava preso** — `js/calendario.js`
O ouvinte de `message` só se removia quando a mensagem chegava. Fechar as
Configurações do Calendário sem conectar deixava ele pendurado na janela. A
remoção passou para o `aoFechar` do modal.

## Verificado e NÃO corrigido

**"Dica da barra lateral recolhida nunca ligada"** — não se confirma.
A revisão apontou `ligarDicas` como código morto que deixaria os itens sem
rótulo. Conferindo o CSS: quando a barra recolhe,
`body.recolhida .nav[data-shell="interno"] .nav-acordeao{display:none}` esconde o
acordeão inteiro e quem aparece é o trilho, cujos botões já ganham dica em
`montarLateral`. Não há estado em que um link fique visível sem rótulo. A função
continua lá, agora com um comentário explicando por que está parada.

VERSAO zzz48 · cache v253.
