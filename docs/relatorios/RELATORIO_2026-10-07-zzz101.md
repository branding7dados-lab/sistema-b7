# Relatório — Estilo iOS: arrastar a folha para fechar e interruptores unificados

**Versão:** `2026-10-07-zzz101` · **Cache:** `roteiros-b7-v306`
**Pedido:** "ent faça" — o grupo 1 da lista (blocos agrupados, seletores, interruptores) e depois arrastar a folha para fechar.

## O que o levantamento mostrou
Antes de mexer, conferi o código das telas do grupo 1. Parte do que eu tinha proposto **já existia**:
- **Configurações** já é em blocos brancos, com fio entre as linhas começando depois do ícone, e as abas (Geral / Aparência / Admin / Sistema, Mês / Semana / Dia) já são seletor com pílula deslizante.
- **Usuários** já é uma lista em bloco branco com fio entre as linhas.
- Não há caixas de marcar onde deveria haver interruptor: os liga/desliga já são interruptores. As caixas que existem são de seleção múltipla (escolher itens, categorias), que no iOS também são marcas.

Então não reescrevi essas telas. Fiz o que faltava de verdade.

## O que mudou
### 1. Interruptores: um só padrão
Havia **seis** desenhos de interruptor, cada um com a sua cor de ligado (magenta liso, dois degradês rosa/roxo diferentes…): Perfil, Calendário, Configurações, Usuários, Status semanal e a conta. Agora todos ligam no **verde do iOS** (um tom um pouco mais claro no tema escuro). O do teleprompter ficou como estava, porque a tela dele tem cores próprias.

### 2. Arrastar a folha para baixo fecha (celular)
Vale para **todas as folhas** do celular (Sua conta, Mais, Criar, menus de gravação e afins):
- puxar pela alcinha ou pelo cabeçalho arrasta a folha junto com o dedo;
- soltou depois de passar de um quarto da altura, ou deu um puxão rápido: fecha;
- soltou antes: volta para o lugar;
- com o conteúdo rolado para baixo, o gesto primeiro rola de volta ao topo; só então puxa a folha;
- dentro de campos de texto o gesto não começa.

Fechar pelo X, tocando fora ou pelo botão voltar continua igual.

## O que ficou de fora
- Perfil e a folha "Mais": não mexi no desenho. Não consegui vê-las em captura nesta rodada (o navegador de teste voltou a não desenhar a tela), e não quis redesenhar às cegas.
- Topo em vidro, barra de navegação do Android, molas, confirmações em folha de ações, busca, avisos e os ícones de dentro das telas seguem na fila.

## Arquivos alterados
`js/ui.js`, `styles/global.css`, `styles/auth.css`, `styles/calendario.css`, `styles/dashboard.css`, `styles/gravacao.css`, `styles/semana.css`, `styles/topo.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em tamanho de celular (375×812), com toques simulados por código na folha "Sua conta":
- arrasto curto e lento pelo cabeçalho (60 px): a folha acompanha o dedo e volta ao lugar, continua aberta;
- arrasto longo (320 px): fecha, sem sobra na tela, e reabre normal depois;
- arrastar o conteúdo para cima: a folha não se mexe;
- a cor do interruptor ligado é lida como o verde novo.

## Não testado
- **Dedo de verdade em aparelho.** Toque simulado não reproduz inércia nem a rolagem nativa; é o ponto com mais chance de precisar de ajuste (sensibilidade, briga com a rolagem de folhas compridas).
- As outras folhas além de "Sua conta".
- A aparência dos seis interruptores em tela (troquei só a cor de ligado; não vi nenhum).
- Tema escuro.
