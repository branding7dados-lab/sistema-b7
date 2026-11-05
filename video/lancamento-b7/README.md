# Vídeo de lançamento B7 — 9:16

Motion design de 64 s com narração, **1080×1920 nativo** (Reels, TikTok e Shorts), feito em código:
cada quadro é uma função do tempo, desenhada em HTML/canvas e capturada pelo Chromium.

| Arquivo | O que é |
|---|---|
| `saida/b7-lancamento-9x16.mp4` | versão final: narração + trilha + efeitos sonoros |
| `saida/b7-lancamento-9x16-sem-som.mp4` | mesma imagem, sem áudio (para usar música ou locução próprias) |
| `index.html` · `style.css` | palco 1080×1920, paleta e tipografia (Poppins) |
| `engine.js` | motor: easing, câmera, partículas, lockup oficial, `renderAt(t)` |
| `scenes.js` | as 14 cenas do roteiro |
| `audio.mjs` | trilha sintetizada e sincronizada com os eventos do vídeo |
| `narracao.py` | narração: roteiro com os tempos de cada fala + voz sintetizada |
| `roteiro-narracao.json` | início e fim de cada fala (gerado), útil para gravar com locutor |
| `render.mjs` | captura os quadros (Playwright) e codifica com ffmpeg |

## Marca

Nenhuma logo foi redesenhada. O vídeo usa apenas `assets/brand/originais/` e
`assets/brand/logo-color.png`:

- **Símbolo** (`symbol-color.png`): aparece intacto; as partículas que o formam
  são amostradas dos pixels do próprio arquivo oficial.
- **Lockup** (cenas 03 e 14): é a variação do brand board, com o símbolo colorido e
  "Branding7" em branco. É montada com os dois arquivos oficiais: o símbolo colorido
  ocupa exatamente a caixa do símbolo dentro de `logo-white.png`, e a palavra aparece
  sem alteração. Logo nenhuma recebe glow, sombra ou distorção. As luzes ficam atrás dela.
- **Portal do cliente** (fundo claro): `logo-color.png`, como em `BRAND.md`.

## Roteiro

| Tempo | Cena |
|---|---|
| 0–4 s | O caos: janelas, planilhas, conversas e notificações acelerando |
| 4–8 s | O problema: quatro cards, afastamento e congelamento |
| 8–12 s | Surge o B7: um ponto de luz explode e as partículas formam o símbolo |
| 12–16 s | Central de operação: métricas, próximos conteúdos, status |
| 16–20 s | Planejamento: calendário semanal com cards encaixando |
| 20–26 s | Produção: o card vira roteiro → teleprompter → gravação → organização |
| 26–32 s | Vídeo: um card percorre Ideia → Produção → Edição → Revisão → Publicado |
| 32–38 s | Design: prancheta, seleção, paleta, carrossel |
| 38–44 s | Aprovação: comentário do cliente, versão 1.1, "Aprovar" e confirmação verde |
| 44–50 s | Inteligência: Assistente B7 gerando ideias, roteiro, análise, linha, adaptação |
| 50–54 s | Portal do cliente |
| 54–57 s | Tudo conectado: seis módulos ligados ao símbolo |
| 57–59 s | Transformação: antes/depois, "Menos caos. Mais operação. Mais controle." |
| 59–64 s | Encerramento: lockup + "O sistema operacional da sua operação de conteúdo." |

O final ganhou 4 s além dos 60 s do briefing, para a última fala terminar com a
marca ainda na tela.

## Narração

A voz é sintetizada pelo [Piper](https://github.com/OHF-Voice/piper1-gpl), voz pt-BR
**faber**, de licença CC0 (pode ser usada comercialmente). As falas e os tempos ficam
em `FALAS`, dentro de `narracao.py`. "B7" está escrito "Bê Sete" para a voz pronunciar
certo. Na mixagem, a trilha abaixa sozinha enquanto a voz fala, e o resultado sai
em −14 LUFS, o volume padrão das redes.

Para trocar por um locutor de verdade, grave cada frase de `roteiro-narracao.json`
começando no tempo indicado, salve como `saida/narracao.wav` (48 kHz) e rode
`node render.mjs --mixar`. Não precisa renderizar a imagem de novo.

## Renderizar de novo

Requer Node 18+, Playwright com Chromium, ffmpeg e Python 3 com `piper-tts`.

```sh
cd video/lancamento-b7
pip install piper-tts                  # uma vez
node audio.mjs                         # gera saida/trilha-sfx.wav
python3 narracao.py                    # gera saida/narracao.wav (baixa a voz na 1ª vez)
node render.mjs                        # gera os dois MP4 (≈30 min com 4 núcleos)
node render.mjs --mixar                # só refaz o áudio sobre o vídeo já renderizado
node render.mjs --frames 10.5,42.9     # só alguns quadros, em saida/quadros/
```

Para pré-visualizar um instante no navegador, sirva a raiz do repositório e abra
`/video/lancamento-b7/index.html?t=42.9`.
