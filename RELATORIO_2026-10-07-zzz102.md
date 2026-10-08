# Relatório — Barra inferior do celular redesenhada, com animação nova

**Versão:** `2026-10-07-zzz102` · **Cache:** `roteiros-b7-v307`
**Pedido:** melhorar o desenho da barra inferior e a animação dela.

## O que mudou
**Desenho**
- A barra virou uma **cápsula de vidro** flutuante (pontas totalmente redondas), um pouco mais afastada das bordas, com fio claro na borda e sombra mais suave.
- O destino ativo agora é marcado por uma **cápsula neutra que cobre o item inteiro** — ícone e nome — em vez da pílula rosa pequena só atrás do ícone.
- Ícone e nome do ativo ficam na **cor da marca**; os outros, em cinza. O ícone ativo continua preenchido.
- Ícones um pouco maiores; o ícone ativo não sobe nem cresce mais em relação aos vizinhos.

**Animação**
- A cápsula **desliza de um item para o outro com mola**: passa um pouco do ponto e assenta, esticando de leve no caminho.
- O ícone escolhido dá um **estalo curto** (encolhe e volta), sem o pulo com giro de antes.
- Saiu o **rastro colorido** que acompanhava a luz.
- Ao tocar, o item inteiro encolhe de leve e volta.
- Quem pede menos movimento no aparelho não vê nenhuma dessas animações.

Nenhum destino mudou de lugar; é só aparência e movimento. Em telas largas a barra não passa de 480 px e fica centralizada.

## Arquivos alterados
`styles/nav.css`, `js/nav.js` (a posição da cápsula passou a seguir o item inteiro), `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em tamanho de celular (375×812), tema claro:
- medidas: a barra é uma cápsula de 347×66 px a 14 px das laterais; a cápsula do ativo coincide exatamente com o item (mesma posição e tamanho), antes e depois de trocar de Calendário para Vídeo;
- uma captura da tela de Vídeo com a barra nova, conferida visualmente.

## Não testado
- **A animação em si.** O navegador de teste não roda animações; conferi só o estado final. O movimento (mola, estalo do ícone) precisa ser visto no celular.
- Tema escuro.
- Aparelho físico, incluindo a distância para a faixa de gestos do Android e do iPhone.
