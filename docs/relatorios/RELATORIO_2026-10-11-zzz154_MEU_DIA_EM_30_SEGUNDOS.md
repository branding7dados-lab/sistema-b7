# Relatório — "Meu dia em 30 segundos" (zzz154, 11/10)

Pedido do Kevin: ideia nº 4 — de manhã, um carrossel no estilo Stories com o
que entra no ar hoje, as gravações e os atrasos. Arrasta pro lado e pronto.

## Como fica
Tela cheia escura, com as barrinhas no topo (igual aos Stories). Cada tela
passa sozinha em uns 6 segundos.

1. **Capa** — "Bom dia, Kevin!", a data e 4 números: publicações, gravações,
   prazos e atrasados (o de atrasados fica vermelho quando tem algum).
2. **No ar hoje** — as publicações com data de hoje, com o logo do cliente e
   um ✓ nas que já foram publicadas.
3. **Gravações** — as de hoje e as de amanhã, com horário, cliente, local e
   videomaker.
4. **Vence hoje** — vídeos e peças de design com prazo hoje.
5. **Atrasados** — o que passou do prazo, com quantos dias de atraso.
6. **Fim** — botões para o Painel e o Calendário, "Ver de novo" e a opção de
   abrir sozinho ou não.

Só entram as telas que têm alguma coisa. Cada tela tem um botão embaixo que
leva direto para a tela certa (ex.: "Ver gravações").

## Como mexer
- Toque do lado direito: próxima. Lado esquerdo: volta.
- Arrastar para o lado também troca de tela.
- Segurar o dedo: pausa.
- Arrastar para baixo, o X ou o "voltar" do Android: fecha.

## Quando aparece
- **Sozinho, uma vez por dia**, na primeira vez que a pessoa abre o sistema no
  celular (app ou navegador), se tiver algo para mostrar. No computador não
  abre sozinho.
- A qualquer hora pelo **menu "Mais" → "Meu dia em 30 segundos"** (no topo).
- Dá para desligar o "abrir sozinho" na última tela.
- Não abre para cliente nem durante o "Visualizar como…".

## O que cada um vê
A mesma regra do widget e do Resumo do dia:
- gestão (admin/coordenador): a operação inteira;
- videomaker/designer: as suas demandas e as suas gravações;
- o cliente de teste fica de fora.

Os dados vêm direto do banco com a sessão da pessoa (o RLS de sempre decide o
que ela pode ver). Nada novo no banco.

## Arquivos
- `js/hoje.js` (novo) e `styles/hoje.css` (novo).
- `js/nav.js`: botão no topo do "Mais".
- `index.html` e `sw.js`: os dois arquivos novos (cache `roteiros-b7-v359`).
- `js/auth.js`: versão `2026-10-11-zzz154`.
