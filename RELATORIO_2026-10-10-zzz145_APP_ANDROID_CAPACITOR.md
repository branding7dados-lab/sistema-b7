# Relatório — app Android com Capacitor (zzz145, 10/10)

Pedido: ter o Sistema B7 como o Canva — site, app de celular e app de
computador. Primeira parte: **app Android com Capacitor**, para o S25 FE do Kevin.

## Como funciona
- `app-android/` é um projeto Capacitor 8 (pacote `br.com.branding7.sistemab7`,
  Android 7 ou mais novo). O app abre o site publicado em tela cheia.
- **O conteúdo se atualiza sozinho:** é o próprio site. O APK só muda quando a
  casca muda.
- Ícone e abertura com o símbolo da B7 sobre o azul-noite; sem flash branco ao abrir.
- O que o WebView não faz sozinho passa por uma ponte nativa (`B7Nativo`), só
  liberada para o endereço do sistema:
  - baixar arquivo (backup, arte, PDF, anexo da conversa) → **Downloads** e abre;
  - imprimir → impressão do Android (impressora ou "Salvar em PDF");
  - link de fora (WhatsApp, Instagram, Drive) → abre no app certo;
  - voltar do aparelho → volta uma tela; na primeira, minimiza.
- Sem internet: tela "Sem conexão" com "Tentar de novo".
- Configurações → Este aparelho: "App Android · versão 1.0.0"; tocar confere se há casca nova.
- Casca nova publicada (`app-android/versao.json` maior que a instalada):
  aviso "Nova versão do app Android" com o botão **Baixar** (uma vez por dia).

## Gerar e publicar
- `.github/workflows/apk.yml` (**App Android**): roda quando `app-android/`
  muda no `main`, ou à mão. Confere se `build.gradle` e `versao.json` têm a
  mesma versão, assina, verifica a assinatura e publica em Releases (`apk-v<código>`).
- Link fixo: https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk
- A assinatura usa os segredos `ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_SENHA`
  (os mesmos nomes do app antigo). Sem eles, o workflow para e explica o que falta.

## Limites (ditos no app)
- **Push com o B7 fechado não chega pelo app:** o WebView não tem push da web.
  Em Configurações, o item de avisos explica e manda ativar pelo Chrome.
  Próxima etapa: Firebase + `b7-push` enviando também para o app.
- Conectar o Google Agenda abre o Chrome.

## Testes
- APK de depuração e APK de release assinado (chave de teste) gerados neste ambiente; `apksigner verify` ok.
- Navegador simulando a ponte: baixar arquivo, imprimir, abrir link de fora,
  versão instalada, aviso de casca nova (1.1.0 > 1.0.0) e nenhum aviso com versão igual.
  Fora do app nada muda.
- `testes/`: sintaxe, memória, foto, abertura e fumaça de todas as telas: ok.
- **Não testado:** instalação no celular de verdade e o workflow no GitHub (depende dos segredos).

Versão `2026-10-10-zzz145`, cache `v350`.
