# Relatório — "Hoje é dia de…" só com datas relevantes ou de interesse geral

**Versão:** `2026-10-08-zzz122` · **Cache:** `roteiros-b7-v327`
**Pedido:** "limita o aviso só às datas relevantes e de interesse geral".

## O que mudou
O aviso das 8h05 e o cartão do Painel passaram a considerar só a data que a tela de Oportunidades classifica como **Muito relevante**, **Relacionada** ou **Geral**. O resto ("World Post Day", "World Migratory Bird Day") deixa de aparecer.

- **Geral:** data marcada como de interesse geral, ou feriado/ponto facultativo nacional.
- **Relevante para algum cliente:** a mesma conta da tela — segmento do cliente, tags, tema, cidade/estado do cliente, e o que a equipe marcou como relevante. Cliente que marcou "ignorar" não conta.

**Dia sem nenhuma data assim: não sai aviso.** Amanhã (09/10) é um desses dias.

## Quanto sobra
Nos próximos 76 dias: 42 dias com aviso, 34 sem. Como vários clientes são de saúde (medicina e farmácia contam para todo o tema Saúde), a maioria das datas que sobram é de saúde. Alguns nomes em inglês continuam, quando a data é relevante para um cliente ("World Food Day [FAO]", "World Diabetes Day").

## Banco de dados
`migration_oportunidades_hoje_relevantes.sql` (aplicada): a regra de relevância da tela foi reescrita no banco (duas funções internas novas) e a lista do dia passou a usá-la. Nenhuma tabela, coluna ou regra de acesso nova. Só leitura.

## Arquivos alterados
`migration_oportunidades_hoje_relevantes.sql` (novo), `js/painel.js` (cartão com o mesmo filtro), `sw.js`, `js/auth.js` (versão).

## Testes executados
- **Banco × tela:** comparei a lista do banco com a da tela de Oportunidades para os próximos 400 dias, com os dados reais — **262 datas, listas idênticas** (mesma impressão digital nas duas).
- Lista do dia conferida para 76 dias: 09/10 vazio; 12/10 com Dia das Crianças e Nossa Senhora Aparecida; aniversários de Jequié e Vitória da Conquista entram (cidades de clientes); o de Mato Grosso do Sul não.
- Cartão do Painel com dados reais: continua "Hoje é dia de · Dia Mundial da Visão · combina com 3 clientes"; nenhum bloco com erro.
- Desta vez **nenhum aviso foi disparado** no teste: só consultei a lista.

## Não testado
- A rodada automática das 8h05 (a próxima com aviso é sábado, 10/10).
- O push no aparelho.
- O cartão no caso "próxima data" e nos outros Painéis.

## Ponto de atenção
A regra agora existe em dois lugares: na tela (JavaScript) e no banco. Hoje dão o mesmo resultado; se a regra de relevância da tela mudar, a do banco precisa mudar junto.
