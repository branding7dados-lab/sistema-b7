# v4.4.5: ícones novos no menu

O Kevin achou o ícone do WhatsApp estranho e pediu ícones mais bonitos. As duas propostas desenhadas à mão (A "fofinho em duas cores" e B "ladrilhos coloridos") foram recusadas. A escolhida foi a **C**: a coleção **Phosphor**, com o logo oficial do WhatsApp.

## O que mudou (`js/nav.js`, `styles/v4.css`)
- Todos os ícones da navegação vieram da **Phosphor** (licença MIT, versão 2.1.1): `IC` (27 destinos), `IC_GRUPO` (os 4 grupos do trilho recolhido) e `IC_EXTRA.ajuda`.
- Cada ícone tem duas versões no HTML: `phi-r` (traço fino, o normal) e `phi-f` (cheio). O CSS mostra a cheia só no destino ativo: `a.on`, `.on .ni-ic` e `button.on`.
- **WhatsApp:** usa o logo oficial, tirado do Simple Icons (CC0).
- Mapeamento: Painel → gauge, Gestão → chart-bar, Panorama → squares-four, Clientes → users-three, Publicações → paper-plane-tilt, Aprovações → check-circle, Produção → kanban, Design → image, Edição de vídeo → video-camera, Gravações → film-slate, Calendário → calendar-blank, Oportunidades → sparkle, Trends → trend-up, Roteiros → file-text, Linhas → list-bullets, Status semanal → calendar-check, Legendas → closed-captioning, Projetos → package, Arquivados → archive, Lixeira → trash, Usuários → user-plus, Configurações → gear-six, Atalhos → keyboard, Ao vivo → broadcast, Mais → dots-three-circle, Visualizar como → eye, Ajuda → question. Grupos: house, briefcase, stack, sliders-horizontal.
- Os SVGs ficam embutidos no `nav.js` (cerca de 28 KB), sem carregar nada de fora.

## Conferência
- Prints da barra lateral no computador e da barra de baixo no celular.
- `npm test` passou.
