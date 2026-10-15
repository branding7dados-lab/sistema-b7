# zzz198 — Abertura do WhatsApp

- A tela abre com a **foto da última vez** (guardada só neste computador, `localStorage`, renovada no máximo a cada 30 s e ao sair da tela). Quando o WhatsApp de verdade aparece por cima, é idêntico — sem bloco preto, sem "Carregando…".
- Sem foto guardada (primeira vez): esqueleto com a cara do WhatsApp (busca, lista com avatares e brilho), seguindo o tema claro/escuro.
- Entrada em camadas: brilho verde suave no fundo, barra desce, área surge com leve desfoque → nítido, painel do cliente desliza da direita (0,42 s). O WhatsApp real só é posto depois da animação (430 ms), para não "pular" por cima.
- Respeita "reduzir movimento" do sistema.
