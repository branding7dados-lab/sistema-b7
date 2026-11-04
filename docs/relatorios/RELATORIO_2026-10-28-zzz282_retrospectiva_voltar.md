# Relatório zzz282 — Retrospectiva no app do celular

O Kevin perguntou se a Retrospectiva também vai para o app de celular. Vai: o app Android leva as telas do sistema dentro dele e cada publicação no `main` gera um APK novo, que o app oferece sozinho ("Nova versão do app B7 · Instalar").

Ajuste para o celular: o botão **voltar** do Android chamava `web.goBack()` e trocava a tela por trás da Retrospectiva, que continuava aberta. Agora a Retrospectiva entra com uma entrada no histórico (como o "Meu dia", `js/hoje.js`): o voltar fecha a Retrospectiva e a tela de baixo continua a mesma. Ao fechar pelo ✕, a entrada é retirada. O "Ver setembro" só reabre depois que o histórico volta ao lugar.

Conferido no navegador (390×844): voltar fecha e a rota segue `#/clientes`; o ✕ também.
Testes: `npm test` passou.
