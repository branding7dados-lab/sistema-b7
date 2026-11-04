# Relatório — Ícone do aplicativo em versão clara

**Versão:** `2026-10-07-zzz97` · **Cache:** `roteiros-b7-v302`
**Pedido:** um ícone diferente, mais claro, para o app instalado.

## O que mudou
O ícone do aplicativo deixou o fundo escuro. Agora é o símbolo da Branding7 nas cores originais sobre fundo claro: branco no alto, lilás bem suave embaixo e um brilho rosado discreto no canto inferior direito.

O símbolo ficou dentro da área central do quadrado, para o Android poder arredondar as bordas sem cortar nada.

Trocados os dois arquivos do app instalado (192 e 512 pixels). **Não mexi:** no ícone pequeno da aba do navegador, no selo das notificações, nem na cor escura da tela de abertura.

## Arquivos alterados
`assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `manifest.json` (endereço dos ícones com marca de versão, para o aparelho perceber a troca), `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
Abri o arquivo de 512 pixels gerado e conferi a imagem.

## Não testado
- **Em nenhum aparelho.** Não vi o ícone na tela inicial de celular nem de computador.
- Quando o ícone muda num app já instalado: o Android costuma trocar sozinho em um ou dois dias depois de abrir o app; no iPhone e no computador normalmente só muda desinstalando e instalando de novo.
- As notificações usam o mesmo arquivo de 192 pixels, então também passam a mostrar a versão clara; não conferi como fica.
