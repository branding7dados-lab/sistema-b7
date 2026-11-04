# Relatório — Chat: escolha de cliente refeita

**Versão:** `2026-10-07-zzz79` · **Cache:** `roteiros-b7-v284`
**Pedido:** a lista de clientes do chat estava "horrível" (era a lista nativa do navegador, azul e sem estilo).

## O que mudou
- O campo de cliente virou um **botão em pílula** embaixo do título: "Escolher cliente" ou, com cliente em foco, a marca e o nome dele em destaque.
- Tocar abre uma **lista própria do B7**, dentro do painel: título, **busca** (ignora acento), cada cliente com a logo ou as iniciais, e um ✓ no escolhido.
- "Sem cliente em foco" é a primeira opção, com a explicação do que significa.
- Enter na busca escolhe o primeiro resultado; Esc ou tocar fora fecha.
- Barras de rolagem do chat ficaram finas e discretas (antes eram as do sistema).

Nada muda no funcionamento da IA nem no servidor.

## Arquivos alterados
`js/ia-chat.js`, `styles/ia-chat.css`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
App local, arquivos novos, sessão simulada, 14 clientes de exemplo:
- botão mostra "Escolher cliente"; a lista abre dentro do painel com 15 opções;
- busca "agua" achou "Águas Mucugê"; busca sem resultado mostra o aviso;
- escolher um cliente fecha a lista, o botão passa a mostrar o nome em destaque e as sugestões de pergunta mudam;
- reabrir marca o cliente escolhido; "Sem cliente em foco" volta ao estado inicial;
- sem estouro horizontal.

## Não testado
Com os clientes e logos reais, aparência por captura de tela, tema escuro e celular físico.
