# Relatório zzz56 — Painel em tela larga (07/10/2026)

**Versão:** `2026-10-07-zzz56` · **Cache:** `roteiros-b7-v261`

## O que foi pedido
Kevin mandou a captura do Painel no PC: em monitor grande, a "Minha produção" ocupava a largura toda (seis barras finas perdidas em ~1.500 px) e sobrava vazio embaixo de "Precisa da sua atenção".

## O que mudou
Somente `styles/painel.css` (bloco novo no fim do arquivo). Nenhum JavaScript, dado, regra, link ou permissão foi alterado. Sem migração.

- **A partir de 1600 px de largura** o Painel passa a ter três colunas:
  1. Precisa da sua atenção;
  2. Minha semana em cima, Próximos compromissos embaixo;
  3. Minha produção de pé: os três números em uma linha e as barras ocupando a altura que sobra.
  Os três blocos fecham na mesma linha de base.
- Vale para os quatro Painéis (Videomaker, Coordenador, Designer e o composto). No do Coordenador, o "Fluxo" ocupa a terceira coluna; no composto, o seletor do gráfico desce para a segunda linha do cabeçalho.
- **Entre 1101 e 1599 px** a disposição continua a mesma; só a barra do gráfico pode ficar um pouco mais larga (até 64 px).
- **Celular e tablet**: nada muda.

## Testes realmente executados
Em um modelo estático local (mesmo HTML e mesmos estilos do Painel do Videomaker, dados de exemplo), no navegador embutido:
- 1840 px: três colunas, blocos com a mesma altura (358 px), barras com 58 px, sem rolagem horizontal; conferido por medidas e por captura.
- 1600 px com conteúdo de 1.508 px e com conteúdo estreitado para 1.250 px: dias da semana com 50 px, nada cortado, exceto o selo "acima da média", que estourava 9 px — corrigido (agora pode quebrar em duas linhas); a correção não foi medida de novo.

## Não testado
- O Painel real com conta logada (Videomaker, Coordenador, Designer e composto) — os três últimos não foram abertos nem em modelo.
- Tema escuro, animação de entrada dos blocos nessa disposição e monitor físico.

## Observação sobre a publicação
A cópia local desta sessão estava parada na zzo; o repositório já estava na zzz55 (publicada por outra sessão). O envio como "zzp" foi recusado pelo GitHub e nada foi sobrescrito: a cópia local foi alinhada à zzz55 e a mudança reaplicada por cima como zzz56. Os testes acima foram feitos sobre o CSS da zzo; entre a zzo e a zzz55 o `painel.css` só ganhou cinco linhas (regra `pn-calmo`), que não tocam na grade. Não houve novo teste sobre a zzz55.
