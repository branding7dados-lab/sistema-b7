# Relatório zzz289 — Equipe ao vivo vira parte do "Visualizar como"

Pedido do Kevin: a Equipe ao vivo não devia ser um botão/painel separado (dava bug e o "espação" no topo); devia ficar dentro do "Visualizar como". E o acompanhar comum mostrava a própria tela, não a do colega.

## O que muda
- **Saiu o botão "Equipe ao vivo"** da barra (nav). Não existe mais painel separado.
- **No "Visualizar como…"**, quem está no Sistema agora aparece **primeiro**, com bolinha verde e **"em <tela>"** (ex.: "em Trends"). Só super admin / admin supremo veem esse status ao vivo (`B7.AoVivo.estaOnline`).
- Ao escolher a pessoa, o diálogo passa a ter (quando ela está online):
  - **Acompanhar ao vivo**: vê a tela dela ao vivo (rota, rolagem, cursor), com o selo "Tela compartilhada" na tela dela.
  - **Só visualizar, na tela dela**: entra em Visualizar como e **cai na tela em que ela está** (antes caía no início).
  - **Entrar na conta**: como já era.
- `js/previa-usuario.js`: lista e diálogo com o status online; `abrir(u, hashDestino)` usado para cair na tela certa. `js/aovivo.js`: novo `estaOnline(id)` (e `online`), engine de presença/acompanhar mantida. `js/nav.js`: "aovivo" fora de FERRAMENTAS.

## Conserto do "espação lá em cima"
- A barra de "Acompanhando" empurrava o `body`, mas o Sistema rola dentro de `#app`/`#painel-dashboard`. Agora empurra o `#app` (mesmo esquema do banner "Visualizando como"), sem espaço morto. `styles/aovivo.css`.

## Testes
- `npm test` passou. Conferido no navegador: sem botão "Equipe ao vivo"; no "Visualizar como" o online vem primeiro com "em <tela>"; o diálogo mostra as três opções.
