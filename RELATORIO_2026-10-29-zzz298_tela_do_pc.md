# zzz298 — Acompanhar ao vivo: ver a tela inteira do computador

**Pedido:** "quero pôr a opção de ver a tela do PC… a tela inteira dos computadores, como todos eles são da empresa… pode manter as duas opções, ver só o sistema, e ver a tela do computador."

## Como ficou
- No "Acompanhar ao vivo", quando a pessoa está no **programa do Windows**, a barra ganha o botão **🖥 Tela do PC**: mostra a tela inteira do computador dela (todos os programas), atualizando ~1 vez por segundo. **↩ Voltar ao B7** volta ao espelho do sistema (as duas opções continuam).
- Funciona com o B7 minimizado (a pessoa pode estar em outro programa).
- Enquanto a tela do PC está sendo vista, o programa mostra uma pílula **"Tela compartilhada"** fixa no canto inferior direito da tela, por cima de tudo (não recebe clique, não aparece na barra de tarefas). Some quando o super volta ao B7 ou para de acompanhar (ou se o super sumir, em até 26 s).
- Só a tela principal (monitor 1). Não dá para esconder senha digitada fora do B7 — os Termos pedem para não usar o computador da empresa para assuntos pessoais.

## Como funciona
- **Programa do Windows** (`app-desktop/main.js`, `preload.js`): `B7Desktop.tela.quadro()` tira a foto da tela (desktopCapturer, JPEG, 1280 px) e `B7Desktop.tela.aviso()` liga/desliga a pílula. Precisa da versão nova do programa (atualiza sozinho).
- **B7** (`js/aovivo.js`): a presença diz se a pessoa está no programa (`pc`); o super pede `av-pc-pedir` pelo canal privado da pessoa; ela manda as fotos em pedaços (`av-pc`). Mesmo canal privado: só a pessoa e os super admins.
- **Termos** (seção 2): item novo sobre a tela inteira nos computadores da empresa.

## Teste
- Duas abas (pessoa no "programa" simulado + super): botão aparece só para quem está no programa, a tela do PC aparece, a pílula liga e desliga, e "Voltar ao B7" volta ao espelho.

## Versão
- `VERSAO` 2026-10-29-zzz298 · cache `roteiros-b7-v500`. O programa do Windows sai pelo workflow desktop.
