# v4.12.2 — Jogos sob demanda

- Medição da abertura (Chromium, CPU 4× mais lenta, sem rede): ~1,0 s até pronto, ~0,3 s executando JS. Carregar todas as telas sob demanda renderia pouco e mexeria em dezenas de checagens `B7.X &&` espalhadas — não vale o risco.
- Feito o seguro: os 5 arquivos de jogo (~165 KB) saíram do index.html e chegam via `B7.vendor(...)` quando a tela de manutenção abre (`comJogo`). Uma tentativa só; se falhar, mostra os jogos que vieram. Continuam no cache do service worker.
- Depois: abertura medida em 0,93–1,06 s (antes 0,98–1,17 s), dentro do ruído.
