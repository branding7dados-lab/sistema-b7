# Relatório — o app abrindo na hora (pacote zzz5, 03/10)

Pedido: vídeo (abrir o app instalado, 16 s) + "Tá tudo assim… todo travado, demora pra abrir…".

## O que o vídeo mostrou
**11 segundos só com o ícone na tela** antes de qualquer coisa do sistema aparecer.

Causa: o service worker usava "rede primeiro". A cada abertura, os ~90 arquivos da casca (html, css, js, fontes) iam um por um perguntar ao servidor se tinham mudado, e a tela só aparecia depois disso. No 4G, cada pergunta leva centenas de milissegundos.

## O que mudou
- **`sw.js`, cache primeiro:** a casca guardada no aparelho abre na hora, sem perguntar nada ao servidor.
  - `config.js` continua indo à rede, mas com teto de 2,5 s. Se a rede demorar, vale a cópia guardada.
  - Pedidos "sem cache", como a conferência de versão nova, sempre vão ao servidor.
- **Versão nova não fica presa** (`sw.js` "b7-renovar" + `js/app.js`):
  - quando o app descobre uma versão publicada (ele já conferia isso lendo o `js/auth.js` do servidor), pede ao service worker para baixar a casca inteira de novo, em segundo plano;
  - a próxima abertura já é a versão nova;
  - tocar em "Atualizar" espera esse download (no máximo 12 s) e depois recarrega.

## Testes
Chromium, servidor local com **400 ms de atraso por arquivo**, simulando 4G ruim.

| Abrir o app pela 2ª vez | Pedidos ao servidor | Até carregar |
|---|---|---|
| Antes (rede primeiro) | 88 | **25,6 s** |
| Agora (cache primeiro) | 2 | **1,35 s** |

Versão nova publicada sem mexer no `sw.js`:
- a abertura seguinte ainda é a guardada;
- o app percebe em segundo plano e baixa a nova;
- a abertura depois disso já é a nova (versão e marcador do HTML conferidos).

`npm test`: tudo passou.

**Não testado:** celular físico.

**Atenção:** a 1ª abertura depois desta publicação ainda é lenta. É o service worker antigo que entrega o novo. Da 2ª em diante, abre na hora.
