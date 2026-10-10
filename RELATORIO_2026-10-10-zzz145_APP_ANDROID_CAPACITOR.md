# Relatório — app Android com Capacitor (zzz145, 10/10)

Pedido: ter o Sistema B7 como o Canva (site, app de celular e app de
computador). Primeira parte: **app Android com Capacitor**, para o S25 FE do Kevin.
O Kevin pediu "um aplicativo mesmo": **as telas vão dentro do APK** e a
internet serve só para o login e os dados.

## Como funciona
- `app-android/` é um projeto Capacitor 8 (pacote `br.com.branding7.sistemab7`,
  Android 7 ou mais novo). `copiar-site.mjs` põe `index.html`, `js/`, `styles/`,
  `assets/` e `manifest.json` dentro do app. Login e dados continuam pelo
  Supabase; as funções do Supabase já aceitam o endereço do app (`https://localhost`).
- No app não há service worker nem a atualização do site: **versão nova = APK novo.**
- Ícone e abertura com o símbolo da B7 sobre o azul-noite.
- A ponte nativa (`B7Nativo`), só para as telas do próprio app, cuida de:
  - baixar arquivo (backup, arte, PDF, anexo da conversa) → **Downloads** e abre;
  - imprimir → impressão do Android (impressora ou "Salvar em PDF");
  - link de fora (WhatsApp, Instagram, Drive) → abre no app certo;
  - voltar do aparelho → volta uma tela; na primeira, minimiza;
  - conferir o último APK no GitHub e instalar por cima.
- O app confere ao abrir e ao voltar para ele (no máximo a cada 30 min). Com
  APK novo, aparece **"Nova versão do app B7 · Instalar"**. Configurações →
  "Buscar atualização" faz a mesma conferência na hora.
- "Atualizar todos" (administrador) usado de dentro do app lê a versão do
  site publicado, não a do APK.

## Gerar e publicar
- `.github/workflows/apk.yml` (**App Android**): a cada push no `main` que mexa
  nas telas ou em `app-android/`, ou à mão. Versão = `VERSAO` de `js/auth.js`;
  número = 100 + número da execução. Copia as telas, assina, confere a
  assinatura e publica em Releases (`app-v<número>`), guardando os 5 mais novos.
- Link fixo: https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk
- Assinatura pelos segredos `ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_SENHA`.
  Sem eles, o workflow para e explica o que falta.

## Limites (ditos no app)
- **Push com o B7 fechado não chega pelo app:** o WebView não tem push da web.
  O item de avisos explica e manda ativar pelo Chrome.
  Próxima etapa: Firebase + `b7-push` enviando também para o app.
- Conectar o Google Agenda abre o Chrome.

## Testes
- APK montado neste ambiente com as telas dentro (68 arquivos JS, 7 MB),
  versão e número vindos do ambiente, permissão de instalar presente. Release
  assinado com a chave nova; `apksigner verify` ok.
- Navegador simulando a ponte:
  - baixar arquivo, imprimir e abrir link de fora;
  - "Buscar atualização" responde "atual" com o mesmo número e "nova" com número maior;
  - o aviso "Instalar" pede a instalação;
  - "Atualizar todos" lê a versão do site;
  - nenhum service worker registrado.
  Fora do app nada muda.
- `testes/`: sintaxe, memória, foto, abertura e fumaça de todas as telas: ok.
- **Não testado:** instalação no celular de verdade e o workflow no GitHub.

Versão `2026-10-10-zzz145`, cache `v350`.
