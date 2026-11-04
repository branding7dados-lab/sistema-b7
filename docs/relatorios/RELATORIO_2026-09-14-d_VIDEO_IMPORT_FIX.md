# Build 2026-09-14-d — B7 Vídeo: corrigindo a importação contra a planilha real

**O que motivou este build:** você mandou prints mostrando a
importação de CSV dando errado — 732 linhas, todas caindo como
"sem_nome_de_cliente, sem_titulo" — e disse que podia mandar a
planilha real para eu testar. Você mandou o arquivo
("PLANILHA DE GRAVAÇÕES - EDIÇÕES 2026.csv", 731 linhas de dados
reais, 38 clientes, janeiro a setembro de 2026) e usei ele — não um
arquivo sintético — para encontrar e corrigir a causa.

## O que estava quebrado

Duas coisas, na verdade, não uma só:

1. **A planilha tem uma linha de lixo antes do cabeçalho de
   verdade** (uma célula solta com "n"). O código antigo sempre
   tratava a primeira linha do arquivo como cabeçalho — então o
   cabeçalho real (e todas as 731 linhas de dados depois dele) caíam
   dentro dos "dados", com colunas sem sentido nenhum.

2. **Os nomes das colunas da sua planilha não são iguais aos que o
   sistema esperava.** O sistema exigia exatamente `cliente` e
   `titulo`; a sua planilha tem "Cliente" (bate), mas também
   "Briefing / Título", "Cód.", "Mês" e "Prazo de ENTREGA" — nenhum
   desses batia com o que o sistema procurava.

Essas duas coisas juntas explicam exatamente o que você viu: com o
cabeçalho errado, nenhuma coluna batia com nada, e toda linha virava
"sem nome, sem título".

## O que foi corrigido e como foi testado

**Leitura da planilha.** O sistema agora acha sozinho a linha de
cabeçalho (testando as primeiras linhas do arquivo) e reconhece
variações de nome de coluna por aproximação — "Briefing / Título"
vira título, "Cód." vira código, "Mês" vira competência, "Prazo de
ENTREGA" vira prazo, e assim por diante. Testei isso contra a
planilha real inteira: as 731 linhas foram lidas certas, as 11
colunas foram todas identificadas, e as datas/status convertidos
bateram, um por um, com uma conferência que fiz separadamente em
Python direto no arquivo.

**Resolver um cliente resolvia só uma linha por vez.** Isso não
apareceu nos seus prints, mas encontrei ao testar com o arquivo
real: alguns clientes se repetem dezenas ou mais de cem vezes na
planilha ("JOÃO E MARIA" aparece 109 vezes, por exemplo). Do jeito
que estava, resolver manualmente qual cliente do sistema corresponde
a um nome da planilha só valia para aquela linha — as outras 108
continuariam pedindo a mesma resolução, uma por uma. Corrigido: agora
resolver um nome de cliente aplica a mesma escolha (e guarda o
apelido) em todas as linhas do mesmo lote com aquele nome. Testei com
o arquivo real: resolver "ÓTICAS ALMEIDA" uma vez resolveu as 47
linhas daquele cliente de uma só vez. A tela de importação também foi
reorganizada para mostrar um grupo por nome de cliente, em vez de uma
linha por registro — sem isso, a tela tentaria desenhar uma tabela
com 700+ linhas.

**Linha sem título travava sem necessidade.** 81 linhas da sua
planilha real têm código mas não têm título preenchido ainda (dados
reais, não erro de planilha). O sistema já tinha, desde a Parte 1, um
título de reserva pronto para esse caso — mas uma verificação
separada, mais cedo no processo, bloqueava a linha antes de chegar
lá. Removido o bloqueio redundante; o título de reserva agora também
cita o código quando existe, para ficar identificável (ex.: "Sem
título (planilha) — código #3").

**Status da planilha era ignorado.** Toda linha importada nascia
"pendente", mesmo que a coluna STATUS da planilha já dissesse
"ENTREGUE" — na sua planilha real isso teria marcado 704 trabalhos já
entregues como pendentes outra vez. Corrigido para ler o status da
planilha (entregue, descartado, pendente, em edição, correção,
standby) e usar ele na demanda criada, preenchendo também a data de
entrega quando o status é "entregue".

**Teste final, de ponta a ponta, com o arquivo real inteiro:** criei
o lote de importação com as 731 linhas, resolvi os ~18 nomes de
cliente que realmente precisavam de resolução manual (graças à
correção da resolução em lote — sem ela seriam quase 730 resoluções),
e confirmei tudo de uma vez. O resultado bateu exatamente com a
planilha: 703 demandas "entregue" (com data de entrega preenchida),
18 "descartado", 6 "pendente", 3 "em edição", e as 80 linhas sem
título ficaram com o título de reserva citando o código. Sobrou sem
resolver só 1 linha — que é a única linha da planilha real que de
fato não tem nome de cliente nenhum, então isso é o comportamento
certo, não um bug.

## O que ainda precisa da sua atenção

Testei com clientes de teste com nomes parecidos aos da sua planilha
— não com os clientes de verdade do seu banco. Quando você importar a
planilha real de produção, alguns nomes provavelmente não vão bater
automaticamente com o cadastro (abreviação, acento, variação de
escrita) — isso é esperado e é exatamente para isso que existe a tela
de resolução manual com "lembrar este nome", que agora resolve todas
as linhas daquele nome de uma vez.

## Migração necessária

Rode `migration_video_import_fix.sql` no SQL Editor do Supabase,
depois de `migration_video.sql` e `migration_video_kanban.sql` (essas
duas, se ainda não tiverem sido aplicadas).

## Arquivos no zip

`migration_video_import_fix.sql` (novo), `js/video.js`, `js/auth.js`,
`sw.js`, `CORRECOES_2026-09-09.md`.

`VERSAO` → `2026-09-14-d`, cache do service worker →
`roteiros-b7-v62`.
