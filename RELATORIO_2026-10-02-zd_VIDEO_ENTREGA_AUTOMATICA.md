# Relatório 2026-10-02-zd — Vídeo: grupo + Drive marcados = entregue

Só front-end (`js/video.js`). **Nenhuma migration.** Mudança de regra de negócio pedida por você.

## O que você pediu

Na demanda de vídeo, ao marcar "Enviado no grupo de concluídos" e "Upado no Drive", a demanda deve virar **entregue** automaticamente — esteja ela aguardando aprovação, já aprovada ou sem aprovação nenhuma.

## Auditoria

- A regra anterior estava escrita na migration da conclusão: "Nada aqui muda status sozinho". Com as duas marcas, a tela só **oferecia** o botão "Marcar como entregue", com confirmação.
- A ação de entregar (`video_mudar_status`) já aceita "entregue" vindo de qualquer situação, registra o histórico, move o cartão do Kanban para "Pronto" e dispara o aviso de vídeo entregue.
- No banco, todas as 10 demandas que já têm as duas marcas estão entregues: não existe demanda antiga para corrigir.

## O que mudou

- Ao marcar o **segundo** item da Conclusão, a tela chama a mesma ação do botão e a demanda vira entregue, sem perguntar. Aviso na tela: "Tudo feito: demanda marcada como entregue."
- No histórico da demanda a mudança entra com a mensagem "Entregue automaticamente: enviado no grupo de concluídos e upado no Drive."
- Enquanto falta um item, a Conclusão mostra: "Com os dois marcados, a demanda vira entregue automaticamente."

## Regras que valem

- Vale para qualquer situação, **menos descartada**: demanda descartada continua descartada.
- **Desmarcar depois não reabre.** A demanda continua entregue; para reabrir, mude a situação no seletor.
- Permissão, histórico, Kanban e avisos são os mesmos do botão que já existia (a ação é a mesma).
- Se a mudança de situação falhar (rede, por exemplo), a marca fica salva e o botão "Marcar como entregue" continua na tela para tentar de novo.

## Atenção

- Se a demanda estava "Aguardando aprovação" com um pedido de aprovação aberto para o cliente, esse pedido **não é fechado** por esta mudança (o botão manual também nunca fechou). A demanda fica entregue e o pedido continua na lista de aprovações até alguém decidir. Se quiser que a entrega também encerre o pedido, isso mexe no fluxo de aprovação e eu faço em separado.
- A regra mora na tela, não no banco. Hoje só essa tela marca os dois itens; se um dia outra tela marcar, precisa chamar a mesma lógica.

## Testes executados

**Automatizados:** nenhum.

**Página local com o `video.js` real e banco simulado:**

- Em edição, marcar grupo: só marca; situação não muda; aviso "vira entregue automaticamente" na tela.
- Marcar Drive em seguida: marca e muda para entregue, com a mensagem de histórico certa e o aviso na tela.
- Desmarcar Drive depois de entregue: continua entregue. Marcar de novo: só marca, sem nova mudança de situação.
- Aguardando aprovação com grupo já marcado, marcar Drive: vira entregue.
- Descartada com grupo já marcado, marcar Drive: marca e continua descartada.
- Falha simulada na mudança de situação: marca fica, situação não muda, botão "Marcar como entregue" aparece, mensagem de erro exibida.
- Nenhum erro no console.

**Não testado:**

- No site publicado com o banco real: testar exigiria entregar uma demanda de verdade (com aviso disparado para a equipe). A ação chamada é a mesma do botão já em uso.
- Sessão de videomaker sem ser admin, e celular.
