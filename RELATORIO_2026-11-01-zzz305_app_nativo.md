# zzz305 — App B7 nativo: primeira prévia (React Native + Expo)

Pedido do Kevin: um aplicativo de verdade, e não o site dentro de uma casca.

## Feito
- Projeto novo em `app-nativo/` (Expo SDK 58, React Native 0.88, Expo Router), com TypeScript estrito.
- Login nativo (`b7-auth` login + 2 etapas), sessão guardada no aparelho (expo-sqlite/localStorage) e renovada com o app aberto.
- Barra de abas nativa: Painel, Vídeo, Design, Gravações e Mais.
- Painel com os números do dia, a fila da pessoa e as próximas gravações. Vídeo e Design com filas por etapa. Gravações com agenda. Mais com conta e atalhos.
- O que ainda não é nativo abre no sistema completo, numa aba do navegador por cima do app.
- Ícone e abertura com o símbolo da B7 no degradê da marca.
- Workflow `app-nativo.yml`: compila, assina com a mesma chave e publica a prévia `app-nativo-v<n>` (prerelease, não é a "latest", para não confundir a atualização do app atual).

## Conferido
- `tsc --noEmit` sem erros; `expo-doctor` 20/20; `expo export --platform android` monta o pacote (3,5 MB).

## Próximos passos (Fase 1)
- Detalhe nativo de vídeo e peça (mudar etapa, comentar).
- Chat nativo com notificações.
- Gravação com checklist.
