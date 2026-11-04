# Relatório 2026-10-02-c — Apresentação: detalhe do conteúdo

Só front-end (`js/slides.js`, `styles/print.css`). Sem migration. PDF e PNG não mudam.

## Resumo da atualização

- O detalhe que abre ao clicar num criativo ou numa postagem, na apresentação da Linha Editorial, deixou de ser o modal genérico do sistema e virou um painel próprio da apresentação, com animação de abertura e de fechamento.
- Dá para passar de um conteúdo para o outro sem fechar o painel.
- Em tela cheia, o Esc passa a fechar só o detalhe (no Chrome e no Edge).

## O que mudou

### Visual

- **Dois lados.** À esquerda, um painel escuro com a identidade da B7: formato (Reel, Card…), posição na lista ("01 / 08"), título, data, canal, pilar e a chamada para ação em destaque. À direita, o texto: objetivo, ideia geral e legenda.
- **Hierarquia.** O primeiro bloco aparece maior e em negrito; os rótulos têm o risquinho em gradiente dos slides.
- **Legenda como post.** Fica num cartão próprio, respeita as quebras de linha (antes virava um parágrafo só) e destaca as hashtags.
- **Conteúdo sem texto** mostra um aviso curto em vez de um painel vazio.
- **Linha de origem marcada** na tabela enquanto o detalhe está aberto.

### Animação

- **Abrir:** o fundo escurece e desfoca; o cartão cresce a partir da linha clicada até o centro; depois entram, em cascata, os itens do painel escuro e os blocos de texto.
- **Trocar de conteúdo:** o miolo desliza para o lado para onde se está indo.
- **Fechar:** o cartão encolhe de volta em direção à linha.
- Quem tem "reduzir movimento" ligado no sistema recebe tudo sem animação.

### Navegação

- Setas ao lado do cartão, setas do teclado e arrastar no celular passam para o conteúdo anterior ou o próximo, na ordem da tabela de onde se veio (Criativos: ordem dos posts; Postagens: por data).
- Fechar: botão ×, clique fora do cartão ou Esc.
- Com o detalhe aberto, as setas não trocam de slide.

### Esc em tela cheia

- Antes, em tela cheia, o Esc era do navegador: saía da tela cheia e, desde o pacote `b`, isso encerra a apresentação — mesmo com um detalhe aberto.
- Agora, onde o navegador permite (Chrome e Edge), a tecla é reservada para a apresentação: um toque fecha o detalhe; sem detalhe aberto, encerra a apresentação. Segurar Esc continua saindo da tela cheia.
- No Firefox e no Safari esse recurso não existe: lá o Esc em tela cheia continua encerrando a apresentação direto.

## Arquivos

- `js/slides.js`: novo `abrirDetalheConteudo` (painel próprio), tecla roteada para o detalhe, reserva do Esc em tela cheia, `data-lista="post"` nas linhas de Postagens.
- `styles/print.css`: estilos e animações `.pv-det*`.
- `js/auth.js` versão `2026-10-02-c`; `sw.js` cache `v130`.

## Testes realizados

Página de teste local com uma linha inventada (8 conteúdos), navegador embutido, 1280×720. Página apagada depois.

- Clique numa linha de Criativos: painel abre dentro da apresentação, com título, "01 / 08", os três blocos, legenda em 4 parágrafos, 3 hashtags destacadas e a chamada.
- Captura de tela do painel aberto: layout em dois lados conforme descrito, sem corte nem sobreposição.
- Seta para a direita troca de conteúdo sem trocar de slide; conteúdo sem texto mostra o aviso; seta para a esquerda volta e desabilita "anterior" no primeiro.
- Esc fecha o detalhe e a apresentação continua; a marca da linha some.
- Slide de Postagens: o primeiro detalhe é o de data mais antiga (ordem da tabela).
- Clique no fundo fecha.
- Sem erro no console.

## O que NÃO foi testado

- As animações rodando ao vivo (a janela de teste estava oculta e não desenha movimento): conferi o estado final e a lógica, não a fluidez.
- Tela cheia de verdade e a reserva do Esc (o navegador de teste não entra em tela cheia).
- Celular: o layout de tela estreita (painel subindo de baixo, um lado sobre o outro) foi escrito mas não conferido em tela.
- Dentro do B7 logado, com uma linha real.
