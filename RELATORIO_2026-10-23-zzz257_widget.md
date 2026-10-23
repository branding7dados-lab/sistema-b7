# zzz257 — Widget "Hoje no B7" redesenhado

Pedido do Kevin (print da tela inicial): "dá uma melhorada nesse widget, tá muito sem graça".

- `res/layout/widget_hoje.xml` refeito: cabeçalho com o símbolo da B7 em cor (vetor `widget_simbolo`),
  saudação pelo horário ("Boa noite, Kevin") e a data por extenso; botão ↻ (atualiza na hora).
- Três blocos com ícone em círculo e cor por assunto (gravações azul, publicações/prazos violeta,
  atrasos magenta). O de atrasos fica **vermelho** com atraso e **verde** ("nada atrasado") sem.
  Cada bloco abre a sua tela (Gravações, Publicações/Painel, Vídeo/Painel).
- Linha de destaque: próxima gravação (hora, nome, cliente) → senão o alerta de atraso → senão "Tudo em dia".
- Atalhos: Painel, Gravações, Ideia e Prompter (os mesmos links dos atalhos do ícone).
  Em widget baixo (menos de ~170dp) os atalhos somem sozinhos.
- Fundo: azul-noite com brilho magenta e azul e um fio de luz na borda (`widget_fundo`).
- Na lista de widgets do Android 12+ aparece a prévia real (`previewLayout`); tamanho sugerido 4×3.
- Dados: os mesmos da função `widget_hoje` (nada mudou no banco).
