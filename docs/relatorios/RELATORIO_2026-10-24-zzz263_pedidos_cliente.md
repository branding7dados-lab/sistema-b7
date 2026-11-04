# zzz263 — Pedidos do cliente e lembrete de aprovação

## Banco (aplicado: cliente_pedidos_1_tabela, cliente_pedidos_2_funcoes, cliente_pedidos_3_sync, aprov_lembrete_cliente)
Arquivo: `migration_cliente_pedidos.sql`.
- `cliente_pedidos` (RLS: leitura para equipe interna ou quem vê a empresa; escrita só por função).
- `cliente_pedido_criar(...)`: qualquer papel do cliente, empresa com serviço ativo, validações e limite de 10/dia por empresa.
  Cria um cartão no Kanban (`tipo_vinculo='avulsa'`, `vinculo_id`=pedido, `origem_evento='cliente.pedido'`, coluna A fazer) e avisa a coordenação (`notif_entregar`, pref `co_aprovacoes`, link `#/kanban/<id>`).
- `cliente_pedidos_listar(p_client)` para o portal.
- Gatilho `zz_cliente_pedido_sync` (after update no Kanban): A fazer → recebido; produção/revisão/… → em_producao; pronto/concluída → concluido; arquivada/excluída sem concluir → cancelado. Avisa quem pediu em "em produção" e "pronto".
- `_aprov_lembrar_clientes()`: dia útil 10h (dentro de `notif_verificar_agendados`), aprovação pendente/parcial há ≥2 dias → aviso ao dono/gestor; no máximo 1 a cada 3 dias por empresa.
- Testado numa transação desfeita (rollback): criar, listar, mover no Kanban (em_producao → concluido) e os 3 avisos.

## Front
- `js/portal-pedidos.js` (novo): tela `#/pedidos` (em andamento / anteriores) e a janela "Fazer um pedido". Na prévia é só leitura.
- Menu do portal, rotas (`portal.js`, `app.js`, `permissoes.js`), `index.html`, `sw.js`, boas-vindas com o item Pedidos.
- Kanban: etiqueta "Pedido do cliente".
- IA: tutorial `portal-pedidos` no Suporte do portal.
