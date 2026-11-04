# Relatório — notificações no app e teleprompter com câmera (zzz148, 10/10)

## 1. Notificações no app Android (Firebase)
- O app avisa mesmo fechado, igual ao Chrome. Quem recebe e o texto continuam
  decididos no banco: o Firebase é só mais um caminho de entrega.
- **Ligar:** Meu perfil → Notificações → "Push neste aparelho". O Android pede
  a permissão e o app entra em `push_subscricoes` como `fcm:<token>`.
- **A cada login**, o token é renovado e gravado sem perguntar nada.
- **Tocar no aviso** abre a tela dele e tira das não lidas.
- O aviso tem o ícone branco do B7, a cor rosa e o canal **"Avisos do B7"**, que
  aparece no topo da tela, com som.
- **`b7-push`:**
  - inscrições `fcm:` vão pela API v1 do Firebase, com a conta de serviço em
    `FCM_SERVICE_ACCOUNT`;
  - token que o Firebase não conhece mais é apagado (igual ao 410 do Web Push);
  - o teste de push em Meu perfil também funciona no app.
- **APK:** o `google-services.json` vem do segredo `GOOGLE_SERVICES_JSON`.
  Sem ele, o APK sai sem notificações e o app explica o motivo.

## 2. Teleprompter com câmera
- Ligar: **Gravar com a câmera** na tela inicial. Em pé, pelo aviso de girar:
  **Gravar em pé com a câmera**, para vídeo vertical (Reels, TikTok).
- A câmera da frente fica atrás do texto, espelhada como um espelho. O vídeo
  gravado sai normal.
- A faixa de leitura sobe para perto da lente, para o olhar não fugir. Em pé, a
  letra diminui e o texto usa a largura toda.
- Cada leitura vira um vídeo: uma cena, ou o roteiro inteiro no contínuo. A
  gravação começa no fim da contagem.
- **REC** com o tempo e o botão **Parar** ficam sempre visíveis.
- **No app:** o vídeo vai para a galeria (Filmes → Sistema B7), em partes de
  1 segundo. Vídeo longo não pesa na memória.
- **No navegador:** baixa o arquivo ao terminar (MP4 quando o aparelho grava
  MP4; senão WebM).
- O espelho do texto (para o vidro do teleprompter) fica desligado enquanto
  grava com a câmera.

## Testes
- Chromium com câmera simulada:
  - liga a câmera pelo aviso de girar;
  - "Iniciar e gravar" grava e mostra o REC;
  - "Parar" salva:
    - navegador: baixou `B7 Roteiro Teste cena 1 ….mp4`;
    - app simulado: `videoInicio`, partes binárias (273 KB) e `videoFim`.
- Visual conferido em retrato (prints).
- APK montado com e sem `google-services.json`. `b7-push` passou no `deno check`.
- `testes/` ok.
- **Não testado:**
  - o envio real pelo Firebase (depende dos segredos do Kevin);
  - a câmera e a galeria num celular de verdade.

Versão `2026-10-10-zzz148`, cache `v353`.
