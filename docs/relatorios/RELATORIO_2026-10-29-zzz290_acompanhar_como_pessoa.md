# Relatório zzz290 — Acompanhar ao vivo agora entra como a pessoa

Kevin: ao escolher "Acompanhar ao vivo", ele continuava vendo a PRÓPRIA conta (só a rota mudava). O certo é ver a conta da pessoa (como no "Visualizar como") e, por cima, seguir ao vivo.

## O que muda (js/aovivo.js, js/previa-usuario.js)
- **"Acompanhar ao vivo"** agora:
  1. entra em **"Visualizar como"** a pessoa (identidade, dados e permissões dela), já **na tela em que ela está**;
  2. por cima, segue **ao vivo**: a rota, a rolagem e o **cursor** dela (com o nome). O seu cursor não vai para ela, e a tela dela mostra "Tela compartilhada".
- O indicador no topo é o próprio banner **"Visualizando como …"**; o **"Voltar ao Admin"** encerra o ao vivo e sai do Visualizar como de uma vez (acabou a barra separada e o espaço no topo).
- Se o super **navega por conta própria** para fora da tela seguida, o ao vivo encerra mas ele **continua como a pessoa** (pode explorar como ela). A navegação causada pela própria pessoa seguida é reconhecida pela rota-alvo (não encerra por engano).

## Testes
- `npm test` passou. Conferido no navegador: acompanhar entra em Visualizar como na tela da pessoa, com cursor ao vivo; a pessoa mudar de tela leva o super junto; o super navegar sozinho encerra só o ao vivo; "Voltar ao Admin" encerra tudo.
