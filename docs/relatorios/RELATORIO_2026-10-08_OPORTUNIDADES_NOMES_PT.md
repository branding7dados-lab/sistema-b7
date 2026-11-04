# Relatório — Oportunidades com nome em português

**Versão do app:** sem mudança (`2026-10-08-zzz122`) — só dados no banco.
**Pedido:** "traduz os nomes em inglês das oportunidades pra português".

## O que foi feito
**222 oportunidades** ativas que estavam com o nome em inglês (datas da ONU e agências) passaram a ter nome em português. Exemplos:
- World Post Day → Dia Mundial dos Correios
- World Food Day [FAO] → Dia Mundial da Alimentação
- World Diabetes Day → Dia Mundial do Diabetes
- International Day of the Girl Child → Dia Internacional da Menina
- World Space Week, 4-10 October → Semana Mundial do Espaço (4 a 10 de outubro)

As siglas entre colchetes ([FAO], [UNESCO], [UNEP]…) saíram do nome.

## O que não mudou
- Datas, categorias, tags, vínculos com linhas e clientes: nada foi tocado.
- O nome original em inglês ficou guardado em cada oportunidade como nome alternativo — a busca continua achando por ele, e dá para desfazer qualquer uma.
- A sincronização semanal das fontes **não desfaz a tradução**: ela reconhece cada data pela referência da fonte e nunca regrava o nome. (Conferido lendo a função de sincronização; a próxima rodada real é segunda-feira.)
- As 5 oportunidades em inglês que estão desativadas/ignoradas não foram traduzidas.

## Banco de dados
`migration_oportunidades_nomes_pt.sql` (aplicada): uma atualização de dados (nome + nome alternativo). Nenhuma estrutura, função ou regra de acesso mudou.

## Testes executados
- 222 linhas alteradas; nenhuma oportunidade ativa ficou com nome em inglês (sobra só "Black Friday", que é o nome usado no Brasil).
- Tela de Oportunidades no app local, com os dados reais: lista em português, nenhuma em inglês em 400 dias.
- A lista do aviso das 8h continua idêntica à da tela depois da tradução (262 datas em 400 dias, mesma impressão digital nas duas) — a tradução não mudou quais datas são relevantes.

## Não testado
- A sincronização de segunda-feira rodando de verdade depois da tradução.

## Para você decidir
A tradução deixou à mostra **duplicatas que já existiam** (antes uma estava em inglês e a outra em português, no mesmo dia):
- **Dia Internacional da Mulher** — duas, em 08/03;
- **Dia Mundial do Meio Ambiente** — duas, em 05/06.

Não uni: unir junta vínculos e históricos, é decisão sua. Parecidas, mas não iguais, no mesmo dia: "Dia Internacional da Mãe Terra" × "Dia da Terra" (22/04) e "Dia Mundial do Livro e do Direito Autoral" × "Dia do Livro" (23/04).

Outras observações:
- "World Children's Day" (20/11) virou **Dia Universal da Criança**, porque já existe um "Dia Mundial da Criança" em 01/06.
- Existe uma oportunidade internacional ativa chamada **"43 C/57"** — parece código de resolução, não nome de data. Não mexi.
- As traduções são minhas, seguindo os nomes usados pela ONU em português quando existem. Vale um olhar nas datas que vocês forem usar de fato.
