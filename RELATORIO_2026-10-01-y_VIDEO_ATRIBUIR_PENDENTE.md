# Relatório 2026-10-01-y — Vídeo: atribuir não coloca em edição

Só banco. Nenhuma tela mudou.

> **Situação (01/10/2026).** Migration `video_atribuir_sem_iniciar` aplicada no Supabase.

## O que mudou

Antes, atribuir uma demanda de vídeo a alguém já a colocava em **Em edição**, na criação ou depois. A pessoa nem tinha visto a demanda e ela já aparecia como em andamento.

Agora:

- a demanda atribuída fica em **Pendente**;
- o videomaker recebe o aviso "Demanda de vídeo atribuída a você", com o prazo;
- é ele quem muda para **Em edição** quando começar (pelo seletor de situação da demanda ou arrastando no Kanban de vídeo).

## O que acompanha a mudança

- **Kanban geral:** o card da demanda continua nascendo quando a edição começa de verdade. Atribuir não cria card. Essa parte já existia em `video_mudar_status` e não foi alterada.
- **Histórico da demanda:** deixa de registrar um "mudou para Em edição" que ninguém fez. Fica "criada" e "responsável atribuído".
- **Trocar ou remover o responsável** de uma demanda que já está em edição não mexe na situação dela.
- **Painel do videomaker:** já tratava "Pendente" como trabalho nas mãos da pessoa ("para iniciar"), então a demanda atribuída continua aparecendo para ela.

## O que não mudou

- Demandas já existentes: nenhuma foi alterada. No momento da migration não havia nenhuma em "Em edição".
- A importação de planilha, que traz a situação da própria planilha.
- Permissões: só admin e coordenação atribuem; o videomaker só muda a situação das demandas dele.

## Banco / migrations

`migration_video_atribuir_sem_iniciar.sql`: reescreve `video_atribuir` e `video_criar_demanda`. Sem tabela, coluna ou policy nova.

## Arquivos alterados

- `migration_video_atribuir_sem_iniciar.sql` (novo)

## Testes executados

No banco real, dentro de uma transação desfeita no final, com um coordenador atribuindo e um videomaker recebendo:

- criar a demanda já com videomaker: fica Pendente, sem card no Kanban, histórico só com "criada", aviso entregue ao videomaker com o prazo;
- criar sem videomaker e atribuir depois: continua Pendente, responsável gravado, um aviso;
- o videomaker muda para Em edição: situação muda, o card do Kanban nasce em "Produção" com ele como responsável;
- remover o responsável de uma demanda em edição: a situação continua Em edição e o card fica sem responsável.

Depois de aplicar, conferi que as duas funções estão na versão nova e continuam podendo ser chamadas pelo app.

Não testado: o fluxo pela tela com login real.

## Pendências

- **Acesso do videomaker à Produção de Vídeo** (lista e Kanban, sem as ferramentas de administração): ficou em aberto a seu pedido, até você decidir como quer.
