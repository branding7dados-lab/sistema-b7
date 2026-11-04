# Relatório — Novidades: só o que interessa à equipe

**Versão:** `2026-10-09-zzz133` · **Cache:** `roteiros-b7-v338`
**Pedido:** "esses avisos de admin no novidades, não precisa aparecer, só se for algo relacionado à equipe."

## O que mudou
Saíram da lista de novidades os três registros que eram só de administrador:
- Modo manutenção (zzz130);
- Painel de TV, textos padrão e recursos (zzz129);
- Modo manutenção no lugar certo (zzz132).

Ficaram os sete que falam do trabalho da equipe: novidades automáticas, assistente (imagem, propostas, voz), ideias nas Oportunidades, "Hoje é dia de…" e o Painel do videomaker.

**Daqui para a frente:** o que for só de administrador não entra mais nas novidades. Você fica sabendo pelo relatório e pela minha mensagem, como sempre.

Esses três registros só apareciam para administrador; a equipe nunca viu.

## Banco de dados
Nada mudou no banco.

## Arquivos alterados
`js/novidades.js`, `sw.js`, `js/auth.js` (versão).

## Testes executados
Conferi no arquivo que restaram os sete registros esperados e que ele continua válido (os testes automáticos de sintaxe rodam na publicação).

## Não testado
A janela de novidades na tela depois da mudança.
