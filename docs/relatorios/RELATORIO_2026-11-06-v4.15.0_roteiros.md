# v4.15.0 — Sistema de roteiros (análise + correções)

Análise (06/11): 129 roteiros; 30 "Em criação" com gravação já passada; 0 aprovações de roteiro pelo sistema (o cliente aprova no WhatsApp — fora do escopo, pedido do Kevin); todo roteiro preso a uma gravação; pilar/funil vazios; 2 roteiros escondidos em gravação na lixeira.

Banco (aplicado via SQL):
- `migration_proteger_roteiros.sql`: gatilho impede apagar de vez gravação com roteiros vivos; conteúdos ficam quando a linha editorial é apagada (FK set null).
- `migration_banco_de_roteiros.sql`: `roteiros.client_id` (preenchido), `recording_session_id` aceita nulo, gatilho mantém o cliente ao entrar numa gravação; os 2 roteiros da "Ogreja" foram para o banco da Branding7; 8 roteiros "Em criação" de gravações já "Gravado" viraram "Gravado".
- Gatilho `item_gravado_roteiro`: marcar o item como gravado na gravação muda o roteiro para "Gravado".

Telas:
- Editor abre `#/gravacao/banco-<cliente>/roteiros` (banco do cliente): sem menu de status/dados/portal/excluir da gravação; novo roteiro nasce sem gravação.
- "Mover para outra gravação…" no menu do roteiro (gravações abertas do cliente ou o banco).
- Aviso ao abrir gravação passada com roteiros pendentes, com "Marcar como gravados".
- Links de roteiro (listas, busca, Central) caem no banco quando o roteiro não tem gravação.
- Pilar/funil não aparecem em nenhuma tela de roteiro: nada a remover.
- 20 roteiros "Em criação" em gravações ainda Rascunho ficaram como estão (decisão de quem gravou; o aviso pergunta).
