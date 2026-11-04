# v3.0.0: versões com número de três partes

Pedido do Kevin: mudar o sistema de versões. Ele escolheu números do tipo 3.2.1, que aparecem em Configurações, no cartão de novidades e no app Android e no programa do Windows.

## O que mudou
- `js/auth.js`: `VERSAO = '3.0.0'`. Antes era `'2026-11-04-zzz308'`. O aviso de atualização compara só se o número mudou, então funciona igual.
- `sw.js`: `CACHE = 'b7-v3.0.0'`, sempre igual à VERSAO. Antes era um contador à parte (`roteiros-b7-v507`).
- `js/novidades.js`: registro da 3.0.0 explicando o número novo.
- `.github/workflows/desktop.yml`: o programa do Windows passa a ser `<grande>.<novidade>.<execução>` (ex.: 3.0.57). Antes era `1.0.<execução>`. Continua sempre crescendo, como a atualização automática exige, e agora começa com o número do sistema.
- App Android: já usava a VERSAO como nome da versão, então passa a mostrar 3.0.0 sozinho.
- `VERSOES.md` (novo): a regra de cada número e onde ele fica. O `README.md` foi atualizado (selo e seção "Publicar uma versão").

## Por que 3
O B7 já teve duas fases: a Roteiros B7 (setembro) e as versões `zzz` (outubro–novembro, até a zzz308). O redesenho das telas que vem por aí será a **4.0.0**.
