# Relatório — Confirmações redesenhadas e fim da sombra no rodapé das janelas

**Versão:** `2026-10-08-zzz105` · **Cache:** `roteiros-b7-v310`
**Pedido:** tirar a sombra acima dos botões e refazer esse tipo de tela (o print era "Apagar esta conversa?", como exemplo).

## De onde vinha a sombra
O rodapé com os botões de **toda janela** do sistema tinha uma sombra fixa para cima. Ela existe para separar os botões do conteúdo quando a janela é comprida e rola por baixo deles — mas aparecia sempre, inclusive numa janela de duas linhas, onde não há nada rolando.

## O que mudou
### 1. Confirmações no formato de alerta do iOS
Vale para todas as perguntas de confirmar/cancelar do sistema (apagar, excluir, descartar, sair e afins), porque todas usam a mesma peça:
- caixa **estreita e centralizada**, com cantos bem redondos;
- título e texto **centralizados**;
- **dois botões do mesmo tamanho, lado a lado**: Cancelar em cinza, a ação à direita;
- ação perigosa em **vermelho cheio**; ação comum no degradê da marca;
- **no celular também fica no centro** (antes subia de baixo como folha, ocupando a largura toda).

O comportamento não mudou: Esc, tocar fora ou Cancelar continuam valendo como "não".

### 2. Rodapé das outras janelas, sem sombra
Nas janelas de formulário, a sombra saiu. No lugar, quando há conteúdo rolando por baixo dos botões, ele se dissolve num degradê curto da cor da janela. Em janela curta, nada aparece.

## Arquivos alterados
`js/ui.js`, `styles/global.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- abri a confirmação do exemplo ("Apagar esta conversa?") e conferi uma captura: caixa centralizada, sem sombra, dois botões na mesma linha, "Apagar" em vermelho;
- o rodapé não tem mais sombra (valor lido: nenhuma).

## Não testado
- No celular (tamanho e posição da caixa em tela estreita).
- Confirmações com texto longo ou com nome de botão comprido (o botão quebra em duas linhas; não vi como fica).
- Tema escuro.
- As janelas de formulário compridas, onde o degradê novo substitui a sombra: não abri nenhuma para ver o efeito com conteúdo rolando.
- A janela de pergunta com campo de texto (motivo, observação) continua no formato antigo, só sem a sombra.
