# B7 Status Semanal

Recorte operacional de sete dias montado a partir da linha editorial e
completado com demandas manuais. O que sai daqui é um card 4:5 pronto para
mandar ao cliente.

## Configuração necessária

Um passo só: rodar `migration_semana.sql` no SQL Editor do Supabase. Ele é
aditivo, idempotente e funciona em qualquer ordem — se `conteudos`,
`roteiros` ou `gravacoes` ainda não existirem, as chaves estrangeiras
correspondentes são criadas depois, rodando a migration de novo.

Sem secrets, sem Edge Function, sem configuração extra.

## Modelo de dados

| Tabela | Para quê |
|---|---|
| `status_semanais` | um relatório por semana: cliente, período, observação geral, estado e preferências de apresentação |
| `status_itens` | as demandas: data, título, etapa, situação, observação, vínculos e `source_snapshot` |
| `status_versoes` | retrato do relatório no momento de cada exportação |

View `status_resumo` traz cliente, contagem de demandas e quantas aguardam
retorno. Índice único parcial em `(client_id, semana_inicio)` impede a mesma
semana duas vezes por clique duplo.

Datas são `date` puro. Uma postagem do dia 07 não vira dia 06 por fuso.

## Etapa e situação

São campos separados, e é o que evita o relatório virar sopa.

- **Etapa** é o que será feito: Produção, Postagem, Gravação, Aprovação,
  Ajustes, Entrega, Reunião, Outro.
- **Situação** é o andamento: Previsto, Em andamento, Aguardando cliente,
  Programado, Concluído, Publicado, Confirmado, Em revisão, Atenção,
  Cancelado.

A interface sugere as situações que combinam com a etapa escolhida, sem
travar as outras. O mesmo conteúdo pode gerar duas demandas — Produção na
terça e Postagem na quarta — e isso é correto, não duplicação.

## Importação da semana

Ao criar com uma linha editorial vinculada, entram só os conteúdos com
`data_postagem` dentro dos sete dias. Nada de trazer o mês inteiro, nada de
inventar data para conteúdo que não tem.

Cada demanda importada guarda um `source_snapshot` com o que veio da origem.
É isso que permite comparar depois sem sobrescrever o que a equipe ajustou: se
o título mudar na linha editorial, o relatório já enviado continua como estava.
Apagar o conteúdo original não apaga a demanda — o vínculo vira nulo e o
histórico continua legível.

A situação inicial é sempre `Previsto`. O sistema não sabe o que já foi feito
e não finge que sabe.

## Documento 4:5

1080 × 1350 px na tela, 216 × 270 mm no PDF — proporção 0.8 exata nos dois.

Cabeçalho escuro com gradiente B7, identificação do cliente, sete faixas de
dia, legenda com as situações realmente usadas e assinatura no rodapé. A área
de conteúdo é sempre clara, mesmo com o sistema em dark mode.

O estado da linha editorial só aparece quando diz algo ao cliente (Aprovada,
Finalizada). "Em criação" é etapa interna da B7 e fica fora do card.

## Paginação

Legibilidade primeiro: a fonte nunca encolhe para forçar uma página.

- O conteúdo é empilhado medindo de verdade no DOM.
- Um dia que não cabe sozinho é dividido em partes, com aviso de continuação.
- Depois, as páginas são equilibradas: se a última ficou vazia demais, blocos
  voltam da anterior enquanto isso melhorar a distribuição.
- Páginas de continuação usam cabeçalho compacto.

## Exportação

- **PNG** 1080 × 1350, ou 2160 × 2700 em alta resolução. Uma página vira um
  arquivo; várias viram um ZIP, porque o navegador bloqueia rajada de
  downloads e o cliente não quer cinco arquivos soltos.
- **PDF** com páginas 216 × 270 mm, arquivo único multipágina.

Os dois passam pelo mesmo caminho de download do Download Center
(`B7.Export.baixarBlob`). Nada usa `window.print`.

O progresso mostrado é real: renderização por página, depois montagem do
arquivo. A última mensagem é "Download iniciado" — o que o navegador faz com o
arquivo depois disso está fora do alcance do sistema.

Cada exportação grava uma versão (`V01`, `V02`…) com o retrato do relatório.

## Preview

O preview do editor usa exatamente o mesmo renderizador da exportação. O que
se vê é o que sai no arquivo. Ele acompanha a digitação com folga e pode ser
recolhido; a preferência fica em `localStorage`, os dados no Supabase.

## Duplicar semana

Copia demandas, observações (opcional) e preferências, deslocando as datas em
sete dias. **Situações nunca são copiadas** — tudo volta para `Previsto`,
porque "Publicado" da semana passada não é verdade na semana nova. Não cria
postagem nenhuma na linha editorial.

## Limitações conhecidas

- Não há coleta automática de nada: o relatório é o que a equipe registra.
- "Enviado" é marcação manual. O sistema não afirma que o cliente recebeu ou
  viu o documento.
- O compartilhamento nativo do navegador não foi implementado; as ações são
  baixar o arquivo e copiar a mensagem de acompanhamento.
- Demandas recorrentes salvas como modelo não foram implementadas.
