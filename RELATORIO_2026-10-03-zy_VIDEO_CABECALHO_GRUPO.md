# Relatório — Edição de vídeo no celular: cabeçalho do grupo solto (pacote zy, 03/10)

## O bug (print do Kevin)
1. Ao rolar a lista, o rótulo do grupo ("PRÓXIMOS 7 DIAS 9") grudava **no meio da tela**, uns 58px abaixo do topo, por cima do título do cartão ("Trend 2" cortado), deixando uma faixa vazia entre ele e a barra do topo.
2. O código aparecia com cerquilha dobrada: "##6", "##1".

## Causa
1. Medido no navegador (390px): o `top` do `position:sticky` conta a partir do recuo do `#painel-dashboard`, que já tem a altura do topo de vidro. Com `top: 58px`, o cabeçalho parava em 114px em vez de 56px. É do pacote zs.
2. O código da demanda já vem com "#" no dado, e o cartão do celular acrescentava outro.

## Correção
- `styles/video.css`:
  - Cabeçalho do grupo com `top: 0`, colado logo abaixo do topo.
  - Ocupa a largura toda da tela (`margin: 0 -14px`), com fundo quase opaco e borda inferior esfumada.
  - O cartão passa por baixo sem disputar a leitura.
- `js/video.js`: o cartão remove os "#" do começo do código antes de pôr o seu. A tabela do computador não foi mexida.

Nenhum dado, status, regra ou permissão alterado.

## Testes executados
Navegador do app, 390×844, lista simulada com dois grupos de 8 cartões dentro do `#painel-dashboard` real, rolada para o meio do segundo grupo:

| Teste | Antes | Depois |
|---|---|---|
| Posição do cabeçalho grudado | 114px (topo termina em 56px) | 56px |
| Largura | — | 0 → 380px (= largura útil), `scrollWidth` igual a `clientWidth` (sem vazamento) |

**Não testado:**
- "##" com dados reais (correção revisada no código);
- celular físico;
- PWA instalado.
