# Relatório — app Android (APK) com atualização automática (pacote zzy, 03/10)

Pedido: "Queria fazer um APK do nosso sistema com autoatualização".

## Como funciona
- O APK é uma **Trusted Web Activity**: abre o sistema publicado (`https://branding7dados-lab.github.io/sistema-b7/`) dentro do Chrome, em tela cheia, com ícone na tela inicial.
- **O conteúdo se atualiza sozinho.** É o próprio site: cada publicação no `main` chega ao app como chega ao navegador. As notificações push continuam funcionando, porque quem roda o site é o Chrome.
- **A casca (o APK) quase nunca muda.** Quando mudar:
  1. sobe-se `versionCode`/`versionName` em `android/app/build.gradle` **e** em `apk.json`;
  2. o GitHub Actions gera o APK assinado e publica em Releases;
  3. o app mostra "Nova versão do app Android" com o botão **Atualizar**, que baixa o APK novo e instala por cima (mesma assinatura, nada se perde).
- **Link fixo do APK mais novo:** https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk
- Em Configurações:
  - dentro do app: "Procurar atualização do app", com a versão instalada;
  - num Android, fora do app: "Baixar o app".

## Arquivos
- `android/`: projeto Gradle (AGP 8.5.2, `androidbrowserhelper` 2.5.0, pacote `br.com.branding7.sistemab7`, minSdk 21, retrato). Ícones gerados de `assets/icons/icon-512.png` e cores do azul-noite da abertura.
- `.github/workflows/apk.yml`:
  - roda a cada push no `main` que mexa em `android/` ou `apk.json`, ou à mão;
  - confere se as duas versões batem, monta a chave a partir dos segredos, gera, verifica a assinatura e publica a tag `apk-v<versionCode>` como "latest".
- `apk.json`: versão atual da casca, lida pelo app.
- `js/app-android.js` + item em Configurações (`js/dashboard.js`); `sw.js` com o arquivo novo (v205); versão `2026-10-03-zzy`.

## Chave de assinatura: fora do repositório
O repositório é público. Com a chave e a senha, qualquer pessoa poderia gerar um APK que o Android aceitaria como "atualização" do app. Por isso:
- a chave **não** fica no repositório (`*.jks` está no `.gitignore`);
- o Actions a recebe de dois segredos do repositório: `ANDROID_KEYSTORE_BASE64` (o arquivo em base64) e `ANDROID_KEYSTORE_SENHA`;
- sem os segredos, o workflow para com um erro que explica o que falta;
- a chave foi gerada nesta sessão e entregue ao Kevin, junto com a senha, fora do repositório. **Ela deve ser guardada e nunca trocada:** com outra chave, o Android não instala a atualização por cima.

Impressão SHA-256 do certificado (pública, usada no assetlinks): `DF:A8:B6:45:B8:1F:3E:95:78:38:15:B8:21:83:31:67:F6:6C:96:7C:CA:DC:D4:2F:69:7D:6E:AA:72:A6:B1:0C`

## Pendente: esconder a barra de endereço
Para o Android confiar no site e abrir **sem** a barrinha de endereço no topo, ele precisa achar `https://branding7dados-lab.github.io/.well-known/assetlinks.json`. Isso exige o repositório **`branding7dados-lab.github.io`** (o domínio raiz do GitHub Pages). A integração daqui não pode criar repositórios (403).

Quando esse repositório existir, entram nele:
- `.well-known/assetlinks.json` com o pacote `br.com.branding7.sistemab7` e o SHA-256 acima;
- um `.nojekyll`.

Sem isso, o app funciona, só com a barrinha de endereço.

## Testes
- Navegador simulando Android:
  - o site aberto com `?app=android&apk=1` grava a marca e limpa o endereço;
  - "Procurar atualização", com `apk.json` igual, responde "O app já está na versão mais nova";
  - com `apk.json` simulado em versão 2, aparece "Nova versão do app Android (1.1.0)" com o botão Atualizar.
- O APK é gerado no GitHub Actions, porque o SDK do Android não baixa neste ambiente (dl.google.com bloqueado).

**Não testado:** a compilação (espera os segredos) e a instalação no celular.
