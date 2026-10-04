# Relatório 2026-10-04-zzz43 — Desempenho (travamentos)

Vídeo do Kevin: "tá travando bastante". Causas encontradas e removidas:
- Desfoque (filter: blur) animado em camadas grandes: o sistema inteiro entrando em foco (abRevelaFoco) por cima do Painel, que também desfocava título, cada letra, cada cartão (pnTitulo/pnLetra/pnCartao/pnSobe/pnDesliza) e o vídeo (vdEstreia/vdFoco). Agora só transform/opacidade.
- mix-blend-mode em camadas de tela cheia (flare, vazamento de luz, clarão, rastro do logo, grão do Painel e do vídeo, feixe do vídeo): agora normal.
- Cone de luz de 150vmax girando atrás da espera (textura gigante em tela 3x): removido.
- Grão de filme do Painel parado; céu do Painel com contain:paint e camadas animadas com will-change.

Medição (Chromium, CPU 4x mais lenta, saída da abertura): quadros acima de 34 ms caíram de 11–20 para 2–5.

VERSAO zzz43 · cache v248.
