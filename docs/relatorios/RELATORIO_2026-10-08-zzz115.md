# Relatório — Barra lateral redesenhada (computador)

**Versão:** `2026-10-08-zzz115` · **Cache:** `roteiros-b7-v320`
**Relato:** "não tô gostando muito dessa sidebar" (print com só "Principal" aberto e o resto da barra vazio).

## O que incomodava no desenho antigo
Só um grupo abria por vez. A barra ficava com quatro títulos soltos, dois itens à vista e um vazio enorme embaixo; para ir a outro lugar era preciso abrir o grupo antes.

## O que mudou
**Comportamento**
- **Todos os grupos ficam abertos ao mesmo tempo.** Os destinos estão sempre à vista, a um clique.
- O título de cada grupo ainda **recolhe só aquele grupo** (a seta aparece ao passar o mouse). A escolha fica guardada no aparelho.
- Se você navegar para uma tela de um grupo que tinha recolhido, ele abre sozinho — a tela atual nunca fica escondida.

**Desenho**
- **Títulos dos grupos** pequenos e discretos, como rótulos de seção.
- **Item ativo** numa pílula de vidro com o degradê da marca (magenta → violeta), com brilho leve. Saiu a barrinha de 3 px na lateral.
- Itens um pouco mais redondos, com ícones maiores.
- **Fundo com profundidade:** um brilho violeta no alto e magenta embaixo, em vez do azul-noite chapado.
- Logo um pouco maior.
- A barra de rolagem da lateral não aparece mais.

A barra recolhida (só ícones) e o celular não mudaram. Nenhum destino mudou de grupo.

## Arquivos alterados
`js/nav.js`, `styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em 1280×900, conta de administrador:
- os quatro grupos abertos, com 2, 4, 8 e 4 destinos;
- clicar no título "Operação" recolhe o grupo e a escolha é guardada;
- ir para Clientes com "Operação" recolhido: o grupo reabre e "Clientes" fica marcado;
- uma captura da tela de Clientes com a barra nova, conferida visualmente.

## Não testado
- **Altura da tela:** com os 18 destinos de administrador, a barra precisa de cerca de 985 px de altura para caber inteira. Em 900 px ela rola 85 px (medido). No seu monitor, pelo print, deve caber — não conferi. Se rolar, dá para recolher "Mais ferramentas", ou eu aperto mais as linhas.
- A captura foi feita antes do último ajuste de alturas (linhas de 40 para 36 px); o ajuste foi conferido só por medida.
- Tema claro, barra recolhida e contas com menos destinos.
- O botão "Visualizar como…" continuou com a caixa em volta na captura; a intenção era deixá-lo como uma linha simples e isso não pegou. Fica para o próximo ajuste.
