# v3.1.0: quadro de prioridade da Edição de vídeo

Pedido do Kevin: um kanban de prioridade para as demandas de edição, em que o coordenador decide quais vídeos vêm primeiro.

## Como ficou
- **Edição de vídeo → aba Prioridade**, ao lado de Lista e Kanban.
  - Três faixas: **Urgente** ("edite primeiro"), **Alta** ("logo depois") e **Normal** ("na ordem da fila").
  - Entram só os vídeos em aberto: pendente, em edição e correção.
  - Vale a fila inteira, de todos os meses, porque a prioridade não depende do mês escolhido. Os outros filtros (cliente, responsável, Minha fila, busca) continuam valendo.
  - Cada cartão mostra a **posição na fila** (1º, 2º…), o cliente, a situação, quem edita e o prazo.
- **Quem arrasta:** quem tem a nova ação **"Definir a prioridade dos vídeos"** (`video.priorizar`). O padrão é a coordenação, e o administrador sempre pode.
  - No computador, com o mouse. No celular, segurando o cartão por 0,3 s.
  - Dá para mudar de faixa e mudar a ordem dentro da faixa. Uma vaga tracejada mostra onde o cartão vai cair.
- **Os outros** veem a mesma ordem, só para ler.
- **Kanban:** cada coluna agora segue a mesma ordem (urgentes em cima), então o videomaker vê a fila certa nas duas vistas.
- **Avisos:** quando um vídeo sobe para Alta ou Urgente, quem edita recebe uma notificação. A troca de faixa fica no histórico da demanda ("Prioridade: Normal → Urgente").

## Banco (`migration_video_prioridade.sql`, já aplicada)
- `demandas_edicao.prioridade_ordem` (número com casas). Soltar entre dois cartões grava o meio dos dois, sem renumerar a fila.
- A ordem inicial veio do prazo dentro de cada faixa.
- `demandas_edicao_resumo` ganhou a coluna nova.
- Nova ação `video.priorizar` no catálogo (Configurações → Funções e permissões).
- `video_priorizar(id, prioridade, ordem)`: confere o nível do módulo e a ação, grava, registra o histórico e avisa o videomaker.
- Testado no banco com reversão: o admin muda a prioridade (o histórico e o aviso saíram certos) e o videomaker é recusado ("Só a coordenação define a prioridade dos vídeos.").

## Testes
- Teste no navegador com dados de exemplo: arrastar o 5º da fila para o topo de Urgente chama `video_priorizar(d5, 'urgente', 0)`, a fila renumera e o clique não abre o vídeo por engano.
- `npm test` passou inteiro.
