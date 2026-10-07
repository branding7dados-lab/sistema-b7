# Relatório — Assistente fecha ao clicar fora e ao trocar de tela

**Versão:** `2026-10-07-zzz92` · **Cache:** `roteiros-b7-v297`
**Pedido:** o painel do assistente de IA deve fechar quando se clica fora dele e quando se troca de tela.

## O que mudou
- **Clicar fora fecha.** Qualquer clique fora do painel fecha o assistente. Não contam como "fora": o próprio painel, o botão flutuante e o aviso de nova versão.
- **Trocar de tela fecha.** Ao ir para outra tela do sistema, o painel fecha sozinho.
- **O que estava sendo escrito não se perde.** Ao fechar, o texto digitado fica guardado e volta no campo quando o assistente é reaberto. A conversa também continua onde estava.

Se uma pergunta já tinha sido enviada, a resposta chega do mesmo jeito e aparece ao reabrir.

## Arquivos alterados
`js/ia-chat.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, com sessão simulada e eventos disparados por código:
- abrir o painel pelo botão;
- clique dentro do painel mantém aberto;
- clique fora fecha;
- reabrir traz de volta o texto que estava no campo;
- clique no botão flutuante não fecha antes da hora (ele mesmo alterna);
- trocar de tela fecha.

## Não testado
- Com conta real e mouse de verdade, nem em celular.
- Texto guardado só vale enquanto a página não é recarregada.
