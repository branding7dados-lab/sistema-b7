# Relatório zzz288 — Equipe ao vivo + "Visualizar como"

Pedido do Kevin: no acompanhar comum ele via a própria tela (os próprios dados), não a do colega. Em vez de espelhar a tela, a Equipe ao vivo agora entra no "Visualizar como" da pessoa, caindo na tela em que ela está.

## O que muda
- No painel "Equipe ao vivo", cada pessoa online tem dois botões:
  - **Ver como** (novo): entra em "Visualizar como" aquela pessoa (mesmos papel, módulos e níveis dela) e **cai na tela em que ela está agora**. Nada é salvo; é o mesmo "Visualizar como" que já existe, só que direto e na tela certa. (Substitui o antigo "Ir para a tela".)
  - **Acompanhar** (continua): vê a tela da pessoa ao vivo (rota, rolagem, cursor) com o selo "Tela compartilhada" na tela dela.
- `js/previa-usuario.js`:
  - `abrir(usuario, hashDestino)` agora aceita a tela de destino (em vez de sempre ir ao início).
  - novo `verComoId(id, hashDestino)`: carrega os dados da pessoa (papel/módulos/níveis, os mesmos de "Usuários") e entra em "Visualizar como" nela, na tela certa. Exportado.
- `js/aovivo.js`: o botão "Ver como" chama `B7.PreviaUsuario.verComoId`.

## Observação
- "Ver como" mostra o Sistema com a conta/permissões da pessoa, mas é um render novo (não os pixels dela): o que ela digitou/selecionou naquele instante não aparece. Para ver os pixels exatos seria o espelho de tela, que ficou de fora.

## Testes
- `npm test` passou. Conferido no navegador: o painel mostra "Ver como" e "Acompanhar"; "Ver como" chama verComoId com o id e a tela da pessoa.
