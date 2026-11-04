# Relatório — App para Windows (.exe) que se atualiza sozinho (zzz157, 13/10)

Pedido do Kevin: um arquivo .exe que se atualiza sozinho.

## Como funciona para quem usa
1. Baixa o **sistema-b7-instalador.exe** (link fixo, sempre o mais novo):
   <https://github.com/branding7dados-lab/sistema-b7/releases/download/app-desktop/sistema-b7-instalador.exe>
   Também dá para chegar lá por **Configurações → Sistema → App para Windows**
   (só aparece em computador) e pelo botão no topo do README.
2. Abre o arquivo. O Windows mostra um aviso azul ("O Windows protegeu o
   computador") porque o programa não tem certificado pago de assinatura:
   **Mais informações → Executar assim mesmo**. Isso só acontece na primeira
   instalação.
3. Instala só para o usuário (não pede senha de administrador), abre sozinho e
   fica no Menu Iniciar e na Área de trabalho.

Depois disso **nunca mais precisa baixar nada**: o programa confere sozinho
(12 segundos depois de abrir e de 2 em 2 horas), baixa a versão nova em
segundo plano e pergunta: *"Instalar agora"* ou *"Depois, ao fechar"*. Nada
fecha no meio do trabalho.

## O que o programa é
Uma janela com o sistema de verdade dentro — o mesmo endereço do navegador.
As telas **não** vão dentro do instalador (diferente do app de Android). Com
isso:
- toda atualização do sistema chega na hora, sem instalador novo;
- o sistema continua abrindo sem internet (ele já se guarda no computador);
- o instalador quase nunca muda, só quando a janela em si muda.

O programa cuida do que o navegador não faz: lembra o tamanho e o lugar da
janela, abre link de fora no navegador do computador, libera câmera e
microfone (teleprompter) só para o site do B7, avisa onde o arquivo baixado
foi parar, e mantém os atalhos de sempre (Ctrl+C/V, Ctrl+R, zoom, F12).

## Como sai uma versão nova (por dentro)
`.github/workflows/desktop.yml` roda num Windows do GitHub a cada publicação
no `main` que mexa em `app-desktop/`, monta o instalador e manda para a
**mesma release de sempre**, a `app-desktop`. Como o endereço do `latest.yml`
não muda, o programa instalado sabe sozinho quando tem versão nova
(electron-updater, provedor "generic").

Cuidados tomados:
- a release `app-desktop` **nunca** é marcada como "latest" do repositório —
  essa continua sendo a do APK (`app-v<n>`), que o app de Android procura;
- a limpeza de releases antigas do APK só apaga `app-v<n>`, então a do Windows
  fica;
- se o electron-builder não escrever o `latest.yml`, o `latest-yml.mjs` escreve
  a partir do instalador que acabou de sair (e o workflow confere que o nome
  bate antes de publicar).

## Arquivos
- `app-desktop/` (novo): `main.js`, `preload.js`, `offline.html`,
  `package.json`, `package-lock.json`, `recursos/icone.ico`, `latest-yml.mjs`,
  `README.md`.
- `.github/workflows/desktop.yml` (novo).
- `js/dashboard.js`: linha "App para Windows" nas Configurações.
- `README.md`: botão de baixar.
- `js/auth.js` (`2026-10-13-zzz157`), `sw.js` (`roteiros-b7-v362`).

## O que ainda não foi testado
O instalador só pode ser montado e aberto num Windows de verdade — aqui não
tem Windows. O GitHub monta e assina o pacote no pull request; abrir, instalar
e ver a atualização automática acontecendo é o teste que falta, no seu
computador.
