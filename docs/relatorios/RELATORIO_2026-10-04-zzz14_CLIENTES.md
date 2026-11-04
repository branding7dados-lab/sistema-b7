# Pacote zzz14: tela de Clientes redesenhada

Versão `2026-10-04-zzz14`, cache `roteiros-b7-v219`.

## Como ficou
- **Cabeçalho padrão:** título grande "Clientes" e a linha "N clientes · X fixados".
  - Era um `h2` e virou `h1`, então o nome do topo do celular some enquanto o título está à vista (zzz13), sem repetir.
  - "Novo cliente" vira um "+" quadrado no celular.
- **Barra:**
  - busca em pílula, com foco rosa;
  - filtros com contagem (Todos, Com gravações, Sem gravações) no estilo de Usuários;
  - ordem **Recentes / A–Z**. O antigo filtro "Mais recentes" não fazia nada diferente de "Todos" e foi substituído por ela.
- **Fixados em grupo próprio,** acima de "Todos os clientes". Com busca digitada, a lista vira um grupo só.
- **Cartão:**
  - logo de 54 px sobre fundo branco, que cresce e inclina no hover;
  - nome em até 2 linhas;
  - contadores com ícone (gravações, roteiros) e a última atividade;
  - o alfinete aparece no hover e fica rosa quando o cliente está fixado; o fixado também tem fundo rosado;
  - o menu ⋯ tem as mesmas ações de antes.
- **Animação:** entrada em cascata, o cartão sobe no hover e afunda no toque.
- **Celular:** uma lista agrupada num painel só, com divisórias, como em Usuários.
- Enter abre o cartão em foco, para quem usa teclado.

O cartão do Painel/Central (`cardCliente`) não mudou. A tela nova usa `cartaoCliente2`, com o CSS em "CLIENTES 2 (zzz14)" no fim de `styles/dashboard.css`.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
