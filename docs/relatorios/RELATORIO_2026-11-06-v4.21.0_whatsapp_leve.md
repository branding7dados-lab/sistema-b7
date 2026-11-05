# v4.21.0 — WhatsApp mais leve (app de PC)

Causa do travamento:
- `preload-whatsapp.js` tinha um MutationObserver no documento inteiro (`subtree` + `characterData`). O WhatsApp Web muda o DOM o tempo todo, então a leitura da lista e da conversa (60 mensagens, com `innerText`, que força recalcular o layout) disparava sem parar.
- No sistema, cada leitura recalculava o "casar grupo × cliente" de todos os grupos e redesenhava o painel do cliente.

Correção:
- Sem MutationObserver: uma olhada a cada 3 s (15 s com a janela escondida) com uma assinatura barata (tamanho do texto da lista, título, nº de mensagens e a última); só lê e manda quando mudou. Leitura forçada a cada 60 s (o "há quanto tempo").
- `textContent` no lugar de `innerText` nas mensagens.
- `casar()` com memória (zera quando a lista de clientes muda).
- Painel do cliente só redesenha quando muda a linha da conversa aberta (ou quando troca de conversa).
- Precisa do app de PC novo (gerado pelo workflow do app Windows).
