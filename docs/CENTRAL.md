# Central de Produção

## O que mudou e por quê

**A tela inicial deixou de ser um dashboard genérico.** "Continue de onde
parou" e o hero saíram: retomar trabalho é função dos módulos de edição, não
da visão geral da agência. No lugar entraram três categorias — Gravações,
Linhas Editoriais, Roteiros — com números que têm definição e clique.

**O indicador "Banco conectado" saiu da barra lateral.** Durante a produção
normal a equipe não precisa ver infraestrutura. Ele foi para
Configurações → Banco de dados, onde a verificação é real (consulta o
Supabase e mostra o tempo de resposta). O que continua aparecendo em contexto
é o que afeta o trabalho: falha de autosave e perda de conexão.

**A logo ficou sozinha.** O texto "ROTEIROS B7" ao lado da marca saiu: o
sistema é a Branding7.

## Situação das gravações

A coluna `status` que já existia misturava preparação e execução. Ela continua
intacta e em uso pelo editor. O que entrou foi a **situação operacional**,
que responde outra pergunta:

| Situação | Significado |
|---|---|
| Pendente | existe, ainda sem data |
| Agendada | tem data marcada |
| Gravada | a equipe confirmou que aconteceu |
| Cancelada | não vai acontecer |

A migration converte os registros existentes uma única vez: `Gravado` vira
`Gravada`, com data vira `Agendada`, sem data vira `Pendente`. **Data passada
não vira Gravada.** Uma gravação de 2020 marcada como rascunho continua
pendente — confirmar é decisão da equipe, não dedução do sistema.

## Definição de cada número

Todos ignoram registros arquivados e na lixeira. O clique abre a lista
montada com a mesma regra da contagem, então total e lista nunca discordam.

**Gravações**
- Total: gravações válidas. Canceladas ficam de fora.
- Gravadas: situação `Gravada`, confirmada pela equipe.
- Faltam gravar: `Pendente` + `Agendada`, contadas de verdade — não é o total
  menos as gravadas.
- Na faixa de andamento: agendadas, sem agendamento e canceladas, cada uma
  clicável.

**Linhas editoriais** — filtram por mês/ano de referência, não por data de
criação, porque é essa a semântica do planejamento.
- Em elaboração: tudo que não está `Finalizada`.
- Finalizadas: status `Finalizada`.

**Roteiros** — filtram por data de criação.
- Em andamento: `Em criação`, `Em revisão`, `Aprovado internamente`.
- Prontos para gravar: `Pronto para gravar`.

Os filtros de período e cliente valem para as três categorias e para as
listas que abrem. O escopo aplicado fica visível no topo.

## Limitações conhecidas

- A agenda de gravações integrada ao Google foi removida: essa função passa
  a viver no sistema da N7.


## Correções desta rodada

**Menus suspensos.** O dropdown era posicionado com `absolute` dentro do card.
Sempre que um ancestral tinha `overflow:hidden` — capa da linha editorial,
card de gravação — ele era cortado ou aparecia no canto errado. Agora é
posicionado em coordenadas de tela, calculadas ao abrir: decide sozinho se
abre para baixo ou para cima, nunca sai da janela e rola dentro de si quando é
maior que a tela. Fecha ao rolar, redimensionar ou apertar Esc.

**Central B7 na barra lateral.** Era a única tela que não se identificava.
Agora marca o item ativo, como as demais.

**Gravações e roteiros gravados.** Marcar "Gravado" no editor gravava só o
campo antigo `status`; a situação operacional continuava Pendente, então a
Central seguia contando a gravação em "faltam gravar". Agora os dois andam
juntos, incluindo o caminho de volta: desmarcar devolve para Agendada ou
Pendente conforme exista data. Definir ou apagar a data também atualiza a
situação, exceto quando a gravação já foi confirmada.

A migration traz um reparo idempotente para o que já estava marcado antes
desta correção — e só age quando ninguém confirmou nada à mão.

Roteiros com status `Gravado` entravam no total e não apareciam em categoria
nenhuma. Agora "Gravados" é a terceira métrica, e "prontos para gravar" passou
para a faixa de andamento, junto do que ainda pede ação.

**Logo do cliente.** O quadrado ganhou respiro interno: a logo entra inteira,
sem encostar na borda nem ser cortada pelo canto arredondado.

**Modais.** Conteúdo longo passava do limite e ficava inalcançável. Agora o
modal rola por dentro, com as ações fixas no rodapé, e no celular ele sobe da
base ocupando a largura toda.

**Carregamento.** O símbolo B7 ganhou halo, anel de progresso e barra
indeterminada — sem prometer porcentagem que o sistema não sabe. Respeita
`prefers-reduced-motion`.

**Links de referência.** Dois campos novos: um por criativo e um do mês
inteiro, na aba Estratégia. Um link por linha. Aparecem no documento A4 e na
apresentação 16:9, e ficam fora quando vazios, como todo campo opcional.


## Módulos removidos nesta rodada

**Agenda do Google** e **Trends Radar** (Tendências, Tendências salvas e
Concorrentes) saíram por completo do sistema: telas, rotas, itens da barra
lateral, camada de dados, busca global, paleta de comandos, Edge Functions e
seções de configuração.

**Nenhum dado foi apagado.** As tabelas dos dois módulos continuam no
Supabase exatamente como estavam. Se você quiser removê-las de vez, é um
`drop table` manual — não faço isso sem pedido explícito, porque é
irreversível.

O que mudou no backup: ele deixou de exportar essas tabelas, já que os
módulos não existem mais. Backups antigos continuam importáveis.
