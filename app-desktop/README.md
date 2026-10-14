# Sistema B7 para Windows

O B7 numa janela própria do computador, sem a barra do navegador — e que se
atualiza sozinho.

## Como instalar (quem vai usar)

1. Baixe o **sistema-b7-instalador.exe**:
   <https://github.com/branding7dados-lab/sistema-b7/releases/download/app-desktop/sistema-b7-instalador.exe>
2. Abra o arquivo. O Windows pode mostrar um aviso azul ("O Windows protegeu
   o computador"), porque o programa não é assinado com certificado pago:
   clique em **Mais informações → Executar assim mesmo**.
3. Ele instala só para o seu usuário (não pede senha de administrador) e abre
   sozinho. Fica no Menu Iniciar e na Área de trabalho.

Depois disso não precisa baixar mais nada: **o programa avisa quando sai uma
versão nova e instala sozinho** (pergunta antes; se você disser "depois", ele
instala ao fechar).

## O que vai dentro

Diferente do app de Android, as telas **não** ficam dentro do instalador: o
programa abre o endereço do sistema
(<https://branding7dados-lab.github.io/sistema-b7/>). Vantagens:

- toda atualização do sistema chega na hora, sem instalador novo;
- o próprio sistema já guarda tudo no computador, então ele abre sem internet
  depois da primeira vez;
- o instalador quase nunca muda (só quando a janela em si muda).

O programa faz por fora do site: lembra o tamanho e o lugar da janela, abre
link de fora no navegador, libera câmera e microfone (teleprompter) só para o
site do B7, e cuida da própria atualização.

## Como sai uma versão nova (quem mexe no código)

`.github/workflows/desktop.yml` roda sozinho a cada publicação no `main` que
mexa em `app-desktop/`, monta o instalador num Windows do GitHub e manda para
a **mesma release de sempre**, a `app-desktop`. O endereço do `latest.yml` não
muda, então o programa instalado sabe sozinho quando há versão nova.

A versão do programa é `1.0.<número da execução do workflow>` — só cresce.
A release `app-desktop` nunca é marcada como "latest" do repositório: essa é a
do APK do Android (`app-v<n>`), que o app de Android procura.

Para rodar aqui, sem instalar:

```bash
cd app-desktop
npm install
npm start
```

Para gerar o instalador na mão (só funciona no Windows):

```bash
npm run dist     # sai em app-desktop/dist/
```

## Assinatura (opcional, custa)

O aviso azul do Windows some se o `.exe` for assinado com um certificado de
código (EV ou OV, uns US$ 200–400 por ano). Se um dia houver certificado, os
segredos vão em `Settings → Secrets → Actions` como `WIN_CSC_LINK` (o .pfx em
base64) e `WIN_CSC_KEY_PASSWORD`, e o electron-builder assina sozinho.
