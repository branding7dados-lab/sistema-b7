# Relatório 29/09 (d) — Arquitetura de navegação global

## Arquitetura de navegação
Existe um modelo só (`js/nav.js`, `B7.Nav`). Cada destino é declarado uma vez, com rota, rótulo, rótulo curto, ícone, as rotas internas que o mantêm aceso e a regra de acesso. Um único resolvedor transforma a sessão em quatro grupos e na barra inferior:

- **Principal**
- **Meu trabalho**
- **Operação** (chamado "Produção" quando a pessoa não tem função operacional)
- **Mais ferramentas**
- **Barra inferior:** até 4 destinos + "Mais"

Duas regras guiam o resolvedor:

- **Permissão decide o que existe.** A regra é `B7.Perm.podeRota`, a mesma guarda do roteador, que já soma papel e função extra.
- **Função operacional decide a ordem.** Vem de `B7.Perm.funcoesOperacionais()`, que devolve coordenador → videomaker → designer.

**Administrador não é função operacional.** Um admin puro não tem "Meu trabalho" nem Painel.

A navegação é a mesma no desktop e no celular; muda só a apresentação.

## Sidebar desktop
- **Grupos:** PRINCIPAL (Painel, Central) · MEU TRABALHO (só quem tem função operacional) · OPERAÇÃO · MAIS FERRAMENTAS.
- **Mais ferramentas:**
  - fica recolhido, a menos que a tela atual seja uma delas;
  - a escolha fica guardada neste navegador (`b7-nav-mais`);
  - fechado, os links saem da ordem do Tab;
  - corrigi o rótulo do grupo, que saía maior que os outros.
- **Item ativo:** fundo neutro + a trilha de luz do B7 à esquerda (sem bloco saturado).
- **Ícones:** os mesmos SVG de antes. Gravações ganhou uma claquete, porque tinha o mesmo ícone de Edição de vídeo.
- **Barra recolhida:**
  - o nome de cada item aparece numa dica flutuante (`B7.UI.dica`, posição fixa, não alarga a rolagem da barra), com `aria-label` em cada item;
  - saiu o `title` nativo, que duplicava a dica.
- **Rodapé:** ficou só com a versão e o botão Recolher. "Visualizar como…" foi para o menu da conta (e para o "Mais" no celular), agora como diálogo que no celular vira folha; a função continua a mesma.

## Navegação mobile
- **Faixas de largura:**
  - **≤760 px:** topo de vidro + barra inferior + folha "Mais". A barra lateral some no celular (não vira gaveta).
  - **761–1080 px (tablet e celular deitado):** barra lateral fixa só com ícones, com dicas. A preferência de recolher do desktop não é alterada.
  - **>1080 px:** desktop.
- **Topo no celular:** marca B7 (vai para a casa da pessoa) · nome da tela · busca · sino · avatar · "+".
- **Barra inferior:** a casa (Painel, ou a Central quando não há Painel) + até 3 destinos por frequência + "Mais".
  - Rótulos curtos só aqui: Publicações, Vídeo, Agenda, Linhas, Status. É compressão de rótulo, não renomeação; o nome completo vai no `aria-label`.
  - Rota interna acende o destino pai (por exemplo, detalhe de demanda de vídeo → Vídeo).
  - Rota que não está na barra acende o "Mais".
- **"Mais":** folha com alça, seções (Principal, Meu trabalho, Operação/Produção, Gestão, Ferramentas) e grade de atalhos de 84 px. Seções vazias não aparecem. O item da tela atual vem marcado.
- **Criar:** fica no topo ("+"), em folha. Não ocupa vaga da barra inferior.

## Glass UI
- **Implementação:** `backdrop-filter: saturate(170%) blur(18px)`, com prefixo `-webkit-`, dentro de `@supports`.
- **Fallback:** sem suporte a desfoque, a superfície fica quase opaca (97 %).
- **Base:** o token `--card` misturado a transparente (72–74 % no claro, 80 % no escuro, para o título nunca disputar com o conteúdo que passa por baixo). Borda suave, sombra discreta.
- **Rolagem:** o conteúdo rola por baixo do topo e da barra; a área de rolagem ganhou o respiro necessário.
- **Modo escuro:** usa os mesmos tokens escuros do B7 (não é uma camada branca transparente).

## Administrador puro
- **Casa:** Central B7, sem Painel falso.
- **Desktop:** PRINCIPAL (Central B7) · PRODUÇÃO (todos os módulos) · MAIS FERRAMENTAS (Arquivados, Lixeira, Usuários e acessos, Configurações, Atalhos).
- **Celular:** Central · Produção · Clientes · Gravações · Mais. No "Mais" ficam Gestão (Usuários, Configurações) e Ferramentas (Arquivados, Lixeira, Visualizar como…).

## Administrador + função operacional
- **Admin + Videomaker:**
  - casa no Painel;
  - Meu trabalho: Edição de vídeo, Gravações, Roteiros, Calendário;
  - celular: Painel · Vídeo · Gravações · Agenda · Mais;
  - Central e ferramentas de admin continuam acessíveis.
- **Admin + Coordenador:**
  - Painel do Coordenador;
  - Meu trabalho: Linhas, Publicações, Roteiros, Gravações, Aprovações;
  - celular: Painel · Publicações · Linhas · Aprovações · Mais.
- **Admin + Designer:**
  - Meu trabalho: Design, Linhas;
  - celular: Central · Design · Linhas · Agenda · Mais;
  - **não existe Painel do Designer no código:** a casa continua sendo a Central B7;
  - o banco aceita a função extra "designer", mas a tela Usuários e o `b7-auth` ainda não oferecem essa opção (ver pendências).

## Usuários operacionais
- **Videomaker:** Painel; Meu trabalho: Vídeo, Calendário; celular: Painel · Vídeo · Agenda · Mais. Não tem acesso a Gravações e Roteiros (as rotas dele não incluem), então eles não aparecem.
- **Coordenador:**
  - Painel; mesmas prioridades do Admin + Coordenador;
  - a Central continua, porque o modelo atual permite;
  - não recebe nada exclusivo de admin (Usuários, Configurações e Lixeira não aparecem para ele).
- **Designer:**
  - casa na Central de Design (é a casa dele hoje);
  - Meu trabalho: Design, Linhas; Operação: Calendário;
  - celular: Central · Design · Linhas · Agenda · Mais.

## Multi-role
- **Sem troca de perfil.**
- **Ordem entre funções:** coordenação → vídeo → design, a mesma ordem das visões do Painel. É determinística e fica documentada aqui.
- **Revezamento:** com mais de uma função, as prioridades se alternam — o 1º item de cada função entra antes do 2º de qualquer uma, então nenhuma função engole a outra.
- **Sem duplicatas:** cada destino é um registro, e o resolvedor descarta repetições entre grupos.
- **Exemplo testado:** Designer + Videomaker → Painel · Vídeo · Design · Linhas · Mais, com o resto no "Mais".

## Permissões
- **Onde está a regra:** todo destino passa por `pode()`, que chama `B7.Perm.podeRota`. No teste, nenhum item apareceu sem permissão em 9 contas.
- **Esconder não é segurança:** a guarda de rota (`app.js`) e o banco continuam valendo.
- **Nada guardado:** a navegação é recalculada a partir da sessão, e nenhuma navegação derivada de permissão fica armazenada.
- **Sem sessão:** cai no template antigo, que é refeito quando a sessão chega.

## Topbar
- **Continua o topo global do relatório (c):** busca (paleta Ctrl K), sino, conta (menu ou folha), Criar resolvido por permissão e salvamento contextual.
- **No celular:** o topo ganhou vidro e a marca, e a busca vira ícone.
- **Casa da logo:** as duas logos (barra lateral e topo) apontam para a casa real da pessoa.

## Responsividade
- **Desktop:** barra em grupos.
- **Tablet e celular deitado:** trilho fixo de ícones.
- **Android e iPhone:**
  - topo e barra de vidro;
  - `viewport-fit=cover` e `env(safe-area-inset-*)` no topo, na barra e nas folhas;
  - folhas com `88dvh`.
- **Teclado:** com o teclado virtual aberto (detectado pelo `visualViewport`), a barra inferior sai de cena.
- **Onde a barra inferior não aparece:** no editor de roteiros, que tem zoom próprio embaixo, e no Portal do Cliente, que mantém a gaveta dele.

## Design System
Reaproveitei:

- tokens `--card`, `--suave`, `--borda(-forte)`, `--ink-*`, `--acento(-suave)`, `--grad-curto`, `--sidebar`, `--t-micro`;
- a trilha de luz;
- `B7.UI.modal`, que faz o papel de folha no celular;
- `B7.UI.dica`;
- os ícones SVG atuais;
- as fontes Archivo e Inter;
- o modo escuro;
- `prefers-reduced-motion`.

## Arquivos alterados
- **Novos:** `js/nav.js`, `styles/nav.css`.
- **Alterados:**
  - `js/app.js`: monta a navegação pelo modelo, trilho no tablet, dicas;
  - `js/permissoes.js`: `funcoesOperacionais`, logos, grupo recolhível;
  - `js/topo.js`: casa da logo, contexto, "Visualizar como…" na conta, folhas;
  - `js/previa-usuario.js`: seletor em diálogo;
  - `js/portal.js`: marca o shell do Portal;
  - `index.html`: viewport, rodapé, marca no topo, includes;
  - `styles/topo.css`: faixa de 760 px;
  - `sw.js`: cache v102.

## Banco
Nenhuma migration.

## Tests (executados)
- **Resolvedor em 9 contas:** admin puro; admin + videomaker, + coordenador, + designer; videomaker; coordenador; designer; designer + videomaker; coordenador + videomaker. Conferi casa, funções, barra inferior, Meu trabalho, ausência de duplicatas e ausência de itens sem permissão.
- **Item ativo em rotas internas:** linha → Linhas, publicações/dia → Publicações, clientes → Mais, painel → Painel, arquivados → Mais.
- **Último botão da página acima da barra:** 656 px contra 741 px.
- **Camadas:** o modal cobre a barra inferior.
- **Teclado virtual simulado:** a barra some e volta.
- **Visual:** desktop 1440; tablet 820 e 1024; celular deitado 844×390 (com a dica da barra recolhida); celular 390 e 360; claro e escuro; folha "Mais" de admin e de coordenador.
- **Regressão:** `index.html` real sem sessão (sem erro de JS); Criar em 9 contas; salvamento; busca e teclado; Painel.

## Pendências
- **Validar em aparelho real:** Android e iPhone, com login real, conferindo desfoque, áreas seguras e teclado.
- **Painel do Designer:** não existe; a casa do designer continua sendo a Central de Design.
- **Admin + Designer não é atribuível hoje:** o banco aceita a função extra, mas a tela Usuários e o `b7-auth` ainda não. Ligar isso é uma mudança pequena, mas mexe no login e precisa republicar a função.
- **Coordenador + Videomaker:** a barra inferior intercala as duas funções (Publicações, Vídeo, Linhas). Se preferirem outra prioridade, basta mudar a ordem em `B7.Perm.funcoesOperacionais`.
