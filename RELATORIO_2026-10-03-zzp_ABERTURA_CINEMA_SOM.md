# Relatório — abertura mais cinema e som do pouso (pacote zzp, 03/10)

Pedido: vídeo (Chrome Android, 10 s, "Ver abertura" no tema claro) + "melhora o máximo que puder essa abertura, mais cinematográfica ainda" + "quando a logo sobe para a top bar ela repete o efeito sonoro, fica enjoativo".

## O que o vídeo mostrou (som)
Pela trilha de áudio do vídeo: o **cintilar** tocava em 3,7 s (o brilho passando pelo logo) e tocava **de novo** quando o logo pousava no topo. Além disso, a saída somava dois whooshes em sentidos opostos ao mesmo tempo, o que embolava o som.

## Som (`js/abertura-som.js`)
- **Saída virou um gesto só** (`partida`, no lugar de `assenta` + whoosh + cintilar):
  - um sopro de ar subindo junto com a íris e o voo do logo;
  - a "cama" se resolve (veja abaixo) e se apaga em ~1,2 s;
  - no pouso, um **"toc" abafado e curto** (grave, sem brilho e sem eco), bem mais baixo que o cintilar.
- **O cintilar agora toca uma vez só**, no brilho do logo.
- **Nova "cama" sonora:** um acorde grave e quente (dó com 9ª) nasce na ignição e fica por baixo do logo até a saída. É o que dá cara de trilha de cinema em vez de efeitos soltos. Na versão relâmpago entra mais baixo (0,7). Se a espera passar de ~17 s, ela some sozinha.

## Visual
- **Vinheta de lente:** as bordas escurecem.
- **Grão de filme em movimento** (antes era parado).
- **Segundo flare**, fino e violeta, um instante depois do primeiro.
- **Rastro de luz no voo:** três ecos da lâmpada seguem o logo até o topo, cada vez mais apagados (mais fracos no tema claro).
- **Pouso:** em vez da onda (que repetia as ondas da ignição), um **halo curto** atrás do logo e a **mesma faixa de luz da abertura passando uma vez pelo desenho do logo** do topo.
- "Reduzir movimento": rastro, halo e reflexo não aparecem.
- Tarjas de cinema (letterbox) chegaram a entrar e foram retiradas a pedido ("não adiciona tarja").

Arquivos: `index.html` (vinheta, flare fino), `styles/global.css` (bloco "mais cinema (zzp)"; removido o CSS da onda do pouso), `js/app.js` (`voarLogo` com rastro, `brilhoDoPouso` com halo e reflexo), `js/abertura-som.js`, `sw.js` (cache v195), `js/auth.js` (versão `2026-10-03-zzp`).

Nada de dados, regras ou banco.

## Testes executados
Chromium headless, 390×844, servidor local. Como o banco não responde no ambiente de teste, montei um topo falso com o logo e disparei "Ver abertura" (`B7.reverAbertura`):
- **Quadros da sequência, nos dois temas:** ignição com os dois flares, logo montado, rastro atrás do logo voando e topo limpo depois do pouso.
- **Pouso congelado (15% e 45%):** halo atrás do logo e faixa branca atravessando o desenho do logo, nos temas escuro e claro.
- **Versão relâmpago** (recarregar com a sessão marcada): `ab-curta` ativa, sem erros.
- **Ensaio de áudio offline** (pico por fatia de 100 ms):
  - completa: ignição 0,88, cintilar ~0,16 (3,7–4,0 s), saída em 4,3 s, "toc" 0,076 em ~5,0 s e silêncio depois;
  - relâmpago: ignição 0,72, "toc" 0,086;
  - nada acima de 1, e um só cintilar em cada versão.
- Sem erros de página.

**Não testado:**
- ouvir de verdade (sem alto-falante no teste);
- celular físico;
- abertura real depois do login.
