# Relatório 2026-10-02-n — Aviso de peça parada e mensagem pronta para o cliente

Banco (migration `design_parados`, **aplicada**) e front-end (`js/design.js`, `js/notificacoes.js`, `styles/design.css`). Sem tabela, coluna ou policy nova; RLS intocado.

## O que a auditoria mostrou

- **"Vence amanhã" e "atrasou" já existiam** para vídeo e design desde o pacote de notificações (rodam de hora em hora, das 8h às 19h), junto com o resumo diário das 8h. Eu tinha proposto isso como novidade; não era. Não refiz nada disso.
- O que ninguém avisava: peça **sem prazo estourado, mas parada esperando alguém**. Hoje há **39 peças em revisão interna**, enviadas entre 4 e 14 dias atrás.
- Nenhum cliente usa o Portal (nenhuma conta de cliente ativa); as 29 aprovações de arte registradas foram todas por fora (WhatsApp). Por isso o item 4 virou uma mensagem pronta para copiar, e não um lembrete automático ao cliente.

## Item 3 — aviso de peça parada

Um aviso **por dia útil, às 8h**, agregado, e só quando há algo:

| Aviso | Quando | Quem recebe |
|---|---|---|
| "Design parado na revisão" | peças em revisão interna há 3 dias ou mais | coordenação com "Aguardando revisão" ligado; administrador que ligou "Revisões pendentes da agência" |
| "Cliente sem resposta" | peças aguardando o cliente há 3 dias ou mais | coordenação com "Decisões dos clientes" ligado |

- Nunca um aviso por peça. O texto traz a quantidade e a mais antiga; o clique abre a Produção de Design já na aba certa.
- Usa o mesmo resolvedor de destinatários e as mesmas preferências que já existem. Nenhuma preferência nova.
- No sino, os dois tipos entram no filtro "Prazos".

**Primeiro envio real: segunda-feira, 05/10, às 8h.** Com os dados de hoje, vai para **Mateus Guimarães (coordenador) e Kevin França (administrador)**: "39 peças aguardando revisão há 3 dias ou mais · a mais antiga, há N dias". Repete a cada dia útil enquanto a fila continuar parada. "Cliente sem resposta" não sai agora: não há peça aguardando cliente.

## Item 4 — mensagem pronta para o cliente

Na peça de Design, no bloco "Decisão do cliente", quando a peça está **aprovada internamente** ou **aguardando o cliente**, aparece **"Copiar mensagem para o cliente"**.

- Junta todas as peças daquele cliente que estão esperando a decisão dele e monta o texto: pedido de aprovação quando há peça nova, lembrete quando tudo já tinha sido enviado.
- O sistema **só copia**. Quem envia é a pessoa, pelo WhatsApp dela. Nada é mandado ao cliente automaticamente.

## Banco

- `migration_design_parados.sql` (no repositório) = migration `design_parados` aplicada no projeto.
- Função nova `_design_alertas_parados()` (sem acesso para usuários; só o agendador chama).
- `notif_verificar_agendados()`: passa a chamá-la na rodada das 8h.
- `notif_categoria()`: os dois tipos novos entram nas categorias "revisão" e "aprovações do cliente".
- Nenhuma tabela, coluna, policy ou agendamento novo (usa o agendamento `notif-agendados` que já existe).

## Arquivos

- `migration_design_parados.sql`, `js/design.js`, `js/notificacoes.js`, `styles/design.css`.
- `js/auth.js` versão `2026-10-02-n`; `sw.js` cache `v141`.

## Testes realizados

- **Banco, com os dados reais, em ensaio desfeito no final** (a função foi criada, executada e tudo foi revertido na mesma transação; conferi depois que nada ficou):
  - 1ª execução: 2 avisos, para o coordenador e para o administrador com a preferência ligada.
  - 2ª execução no mesmo dia: nenhum aviso (não duplica).
  - Com uma peça colocada em "aguardando cliente" há 6 dias (só dentro do ensaio): 1 aviso "Cliente sem resposta" para o coordenador, com o nome do cliente.
  - O ensaio rodou com o limite de 2 dias; a versão aplicada usa 3 dias, como combinado. A diferença é só o número.
- **Tela, página local com dados simulados:** botão aparece em peça aprovada internamente (texto com as 2 peças do cliente) e aguardando cliente (texto de lembrete); não aparece em peça em criação; o texto vai para a área de transferência.

## O que NÃO foi testado

- O envio real das 8h (acontece na segunda-feira) e o push no celular.
- O clique no aviso abrindo a aba certa, logado.
- O botão de copiar na tela real, logado.

## Para desligar

- Cada pessoa desliga em Meu perfil → Notificações ("Aguardando revisão" / "Revisões pendentes da agência").
- Para tirar do ar de vez, basta remover a chamada em `notif_verificar_agendados()`.
