# Relatório — Trava de módulos no banco (opção B)

**Versão do app:** continua `2026-10-07-zzz89` (só banco; nenhuma tela mudou).
**Decisão do Kevin:** opção **B** — travar no banco apenas os domínios que não aparecem em outras telas, depois de conferir um por um.

## Resultado da conferência
Dos quatro candidatos, **dois** eram realmente isolados e foram travados. Os outros dois são lidos por outras telas e ficaram de fora.

| Domínio | Quem lê hoje | Decisão |
|---|---|---|
| **Produção (quadro)** | só a tela do quadro | **Travado** pelo módulo "kanban" |
| **Status semanal** | a tela de Status semanal, o documento da semana, a página do cliente (lista de status) e o Portal do cliente | **Travado** pelo módulo "semanas" |
| Aprovações | também o editor de roteiros e a Linha editorial (mostram se o cliente aprovou) | **Não travado**: quem lê roteiro ou linha sem o módulo passaria a ver "não aprovado", o que engana |
| Oportunidades | também a Linha editorial e a camada do Calendário | **Não travado**: quem tem Linhas ou Calendário precisa ler, então a trava não fecharia nada |

## O que mudou
Seis tabelas ganharam uma regra a mais: `kanban_demandas`, `kanban_comentarios`, `kanban_historico`, `status_semanais`, `status_itens`, `status_versoes`.

- Pessoa da equipe **sem o módulo** não lê nem grava essas tabelas, nem pela tela nem por fora do sistema.
- **Cliente do Portal** não é afetado: continua lendo o status liberado para ele.
- **Administrador** tem todos os módulos; nada muda.
- As regras antigas não foram alteradas: as novas são restritivas e somam-se a elas.

## Efeito nas pessoas de hoje
Conferi a contagem de cada uma antes e depois:

- Kevin, Kaique (administradores) e Mateus (coordenador): **nada mudou** — 117 demandas no quadro, 45 status, 30 aprovações.
- Alissan e Pedro (designers): deixaram de ler o Status semanal (45 → 0). Eles não têm esse módulo e nenhuma tela deles usava; pela API antes conseguiam.
- O quadro de Produção não mudou para ninguém.

Na página de um cliente, quem não tem o módulo Status semanal passa a ver a lista de status vazia.

## Achado: o quadro de Produção da Alissan aparece vazio
A Alissan tem o módulo "Produção (quadro)" liberado como exceção, mas **já via o quadro vazio antes desta mudança**: a regra antiga do quadro só deixa administrador e coordenador lerem. O módulo abre a tela, mas o banco não entrega os cartões.

Não mexi: liberar o quadro para designer é mudança de regra de negócio. Duas saídas, à escolha do Kevin:
- deixar o quadro só para administrador e coordenador e tirar o módulo dela; ou
- abrir a leitura do quadro a quem tem o módulo.

## Banco de dados
`migration_trava_modulos_kanban_semanas.sql` (aplicada). Seis políticas restritivas novas (`mod_kanban`, `mod_semanas`). Para desfazer, basta removê-las.

## Testes executados
Banco, com a sessão simulada das cinco pessoas reais:
- contagem antes e depois em dez tabelas e visões (transação desfeita): só mudou o Status semanal dos dois designers;
- depois de aplicar: administradores e coordenador com as mesmas contagens;
- coordenador com os dois módulos negados (simulação desfeita): quadro 0, status 0, aprovações intactas (30), e gravar no quadro é barrado.

## Não testado
- As telas com conta real. Em especial: a página de um cliente aberta por um designer (deve mostrar a lista de status vazia, sem erro).
- O Portal do cliente com conta real de cliente (não há conta de cliente ativa; a regra foi escrita para não afetar).

## O que continua sem trava no banco
Clientes, Linhas, Roteiros, Gravações, Vídeo, Design, Publicações, Aprovações, Calendário e Oportunidades. Para esses, tirar o módulo continua escondendo a tela, mas o dado segue legível por quem é da equipe. Fechar isso é a opção A (trava forte), que exige ajustar o Calendário e a página do cliente junto.
