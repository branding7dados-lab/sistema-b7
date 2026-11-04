# Relatório — Modo manutenção: no Admin, com o estado certo

**Versão:** `2026-10-09-zzz132` · **Cache:** `roteiros-b7-v337`
**Pedido:** "melhora esse sistema de manutenção, ele tem que aparecer no admin, não no sistema. E mesmo ele estando ligado, aparece que ele está desligado."

## O erro do "Desligado" com ele ligado
**Causa:** a linha das Configurações era escrita uma vez só, na hora em que a tela abria. Se a tela abrisse antes de a consulta ao banco voltar (é o que acontece ao recarregar a página), ela escrevia "Desligado" e nunca mais conferia. A faixa do topo, que se atualiza sozinha, mostrava o estado certo — por isso as duas discordavam.

**Correção:** a linha agora é mantida pelo mesmo relógio da faixa. Abriu a tela, ela confere o banco e se corrige; mudou o estado, ela muda junto.

Reproduzi o erro no teste (consulta lenta + manutenção já ligada: a linha abriu "Desligado") e confirmei que, com a correção, ela vira "Ligado" assim que a resposta chega.

## O que mudou
- **Lugar:** saiu de Configurações → Sistema e foi para **Configurações → Admin**, logo abaixo de "Pessoas".
- **Linha com o estado de verdade:** Desligado, Marcado ou Ligado, e a descrição diz até quando ("ligado agora: a equipe está travada · termina sozinho às 10:47").
- **Lembrete no rodapé:** a faixa "Modo manutenção ligado" cobria a busca no topo; agora fica embaixo, no centro. A contagem que a equipe vê antes de travar também foi para lá.
- **Ver como a equipe vê:** botão novo na janela, mostra a tela de manutenção com a sua mensagem e a previsão de volta, sem ligar nada.
- **+ 15 minutos:** com a manutenção ligada e com hora para acabar, dá para somar 15 minutos sem desligar e ligar de novo.

## Banco de dados
Nada mudou no banco nesta versão.

## Arquivos alterados
`js/sistema.js`, `js/dashboard.js`, `styles/sistema.css`, `js/novidades.js` (registro desta versão, só para administrador), `sw.js`, `js/auth.js` (versão).

## Testes executados
Aba local **sem login**, com conta de administrador de mentira e banco simulado.
- a linha está na aba Admin e não está mais na aba Sistema;
- manutenção já ligada + consulta lenta: a linha abre "Desligado" e passa a "Ligado" quando a resposta chega (era o erro);
- ligar, desligar pela janela e desligar pela faixa: a linha acompanha nos três casos;
- a faixa aparece embaixo (conferido em captura);
- prévia: mostra a mensagem digitada, não trava o sistema e não manda nada ao banco;
- + 15 minutos: o fim andou exatamente 15 minutos, com a mesma mensagem.

## Não testado
- Com a sua conta de verdade.
- A tela de outra pessoa travando e liberando.
- Celular e tema escuro.

## Rastros do teste
Nenhum registro criado ou alterado no banco por mim.
