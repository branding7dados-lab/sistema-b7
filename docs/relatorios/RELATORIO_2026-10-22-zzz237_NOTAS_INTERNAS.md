# zzz237: anotações internas fora do alcance do cliente

Kevin aprovou ("Pode fazer sim") o pacote que ficou pendente na revisão do Portal (zzz236).

## O problema
O RLS do banco libera a **linha inteira** para quem pode ver a empresa; ele não escolhe colunas. Por isso uma conta de cliente conseguia ler pela API, na linha da própria empresa, campos que só a equipe deve ver:
- `clientes.observacoes` (observações internas do cliente)
- `clientes.servico_nota_interna` (nota interna de pausa ou cancelamento)
- `clientes.whatsapp_grupo` (nome do grupo de WhatsApp da equipe)
- `aprovacoes.anulacao_motivo` e `aprovacao_partes.anulacao_motivo` quando a anulação **não** foi marcada como visível ao cliente

## A solução
Esses dados saíram das linhas que o cliente lê:

| Dado | Agora mora em | Quem lê |
|---|---|---|
| observações, nota interna, grupo do WhatsApp | `clientes_interno` | equipe interna, designers, videomakers (os mesmos de antes) |
| motivo de anulação não visível | `aprovacao_notas_internas` | equipe |

- **As colunas antigas ficam (nada foi apagado), mas sempre vazias.** O gatilho `aa_clientes_separar_interno` leva para `clientes_interno` só o campo que foi gravado de fato. Isso vale também para quem ainda usa uma versão antiga do app em cache.
- `aprov_anular` grava o motivo interno direto na tabela interna. O motivo marcado como visível continua na aprovação, como antes.
- As telas da equipe continuam iguais: `clientes_resumo` e `aprovacoes_painel` juntam as tabelas internas, e para o cliente esses campos vêm vazios. A notificação do designer ao anular ainda traz o motivo. O histórico de decisões no Design também, porque `aprovacoesDesign` completa o motivo a partir da tabela interna.

## Conferido no banco
- 25 clientes copiados. A linha base ficou vazia, e as contagens vistas pela equipe continuam iguais (1 com observação, 2 com grupo de WhatsApp).
- Gatilho testado em transações desfeitas no final:
  - gravar o grupo leva para a tabela interna;
  - criar um cliente com observação leva para a tabela interna;
  - fixar o cliente não apaga nada.
- `aprov_anular` testado também em transações desfeitas:
  - anulação interna: a aprovação fica sem o motivo, o painel da equipe mostra e a tabela interna guarda;
  - anulação visível: o motivo fica na aprovação, como antes;
  - a notificação vai só para a equipe.

## Observação
Comandos de remoção (DROP) travam a conexão com o banco usada aqui. Por isso o arquivo da migração não tem nenhum. Sobrou uma tabela vazia de teste, `_teste_ddl`, fechada a todos (RLS ligado e sem permissão de acesso). Ela pode ser apagada pelo painel do Supabase.
