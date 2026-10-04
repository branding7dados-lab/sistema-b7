# Vídeo de lançamento B7 — 9:16

Motion design de ~62 s, **1080×1920 nativo** (Reels, TikTok e Shorts), feito em código:
cada quadro é uma função do tempo, desenhada em HTML/canvas e capturada pelo Chromium.

| Arquivo | O que é |
|---|---|
| `saida/b7-lancamento-9x16.mp4` | versão final com trilha e efeitos sonoros |
| `saida/b7-lancamento-9x16-sem-som.mp4` | mesma imagem, sem áudio (para usar uma música própria) |
| `index.html` · `style.css` | palco 1080×1920, paleta e tipografia (Poppins) |
| `engine.js` | motor: easing, câmera, partículas, lockup oficial, `renderAt(t)` |
| `scenes.js` | as 14 cenas do roteiro |
| `audio.mjs` | trilha sintetizada e sincronizada com os eventos do vídeo |
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
| 59–62 s | Encerramento: lockup + "O sistema operacional da sua operação de conteúdo." |

O final ganhou 2 s além dos 60 s do briefing, para a marca ficar na tela por
tempo suficiente.

## Renderizar de novo

Requer Node 18+, Playwright com Chromium e ffmpeg.

```sh
cd video/lancamento-b7
node audio.mjs                         # gera saida/trilha-sfx.wav
node render.mjs                        # gera os dois MP4 (≈10 min com 4 núcleos)
node render.mjs --frames 10.5,42.9     # só alguns quadros, em saida/quadros/
```

Para pré-visualizar um instante no navegador, sirva a raiz do repositório e abra
`/video/lancamento-b7/index.html?t=42.9`.
