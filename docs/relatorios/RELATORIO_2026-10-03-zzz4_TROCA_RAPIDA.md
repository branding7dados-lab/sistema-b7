# Relatório — troca rápida entre Painel e Vídeo (pacote zzz4, 03/10)

Pedido: vídeo (abrir o app → Painel → Vídeo → Painel → Vídeo…, 28 s) + "Conserta esses bugs aí".

## O que o vídeo mostrou
1. **Uma tela por cima da outra.** O Vídeo ainda estava carregando quando você voltou ao Painel. Quando terminou, ele se desenhou por cima: aparecia "Produção de Vídeo" com o topo e a barra de baixo dizendo "Painel".
2. **"Carregando as demandas…" toda vez que se abria o Vídeo.** Uma das buscas dessa tela (os pacotes) não passava pela memória de dados, e a tela esperava por ela.
3. **O Painel repetia o filme inteiro a cada volta:** desfoque, letras subindo, cartões caindo e números girando. Repetido a cada toque na barra, parecia a tela carregando.

## O que mudou
- **`js/app.js`:** cada navegação ganha um número de geração (`B7.Rota.marca()`). Tela que ainda buscava dados quando a pessoa já saiu dela desiste e não se desenha mais.
  - Aplicado em Vídeo (lista e demanda), Gravações, Roteiros, Clientes e Central.
  - Gravação, Cliente e Painel já tinham essa proteção.
- **`js/memoria.js`:** pacotes de vídeo, status da conexão com o Google e lista de agendas entram na memória. O Vídeo abre na hora a partir da 2ª vez.
- **`js/painel.js`, `styles/painel.css`:** o filme de entrada do Painel roda uma vez por sessão. Nas outras visitas o Painel chega pronto, e o céu de fundo continua.
- **`testes/fumaca.mjs`:** teste novo de troca rápida, com o banco do Vídeo lento (1,5 s): abre Vídeo e vai para Clientes em 0,2 s.
  - No código antigo ele **falha** ("Produção de Vídeo" por cima de Clientes). Com a correção, passa.

## Testes
`npm test` (sintaxe, memória e fumaça em 19 telas + troca rápida): tudo passou. Não foi testado no celular físico.
