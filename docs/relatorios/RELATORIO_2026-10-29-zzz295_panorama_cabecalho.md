# zzz295 — Panorama: cabeçalho não encavala mais com as linhas

**Pedido:** print do Panorama com "Cliente" por cima de "AutoEscola Sudoeste" e "Linha / Roteiros / Gravação…" riscados pelas barras de progresso.

## Causa
O cabeçalho das etapas (`.pan-cab`) fica grudado no topo quando a página rola (`position:sticky`), mas não tinha fundo: as linhas dos clientes passavam por baixo dele e o texto dos dois se misturava.

## O que mudou (`styles/panorama.css`)
- `.pan-cab` ganhou o fundo da página (`var(--fundo)`, certo nos temas claro e escuro), um respiro em cima e uma sombra suave embaixo — as linhas agora somem por baixo do cabeçalho.

## Versão
- `VERSAO` 2026-10-29-zzz295 · cache `roteiros-b7-v497`.
