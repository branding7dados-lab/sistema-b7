# zzz255 — Pacotes de produção

- Banco (`migration_pacotes_producao.sql`, já aplicada):
  - tabela `pacotes_producao` (nome, descrição, itens `[{tipo, qtd, producao}]`, dias da semana, arquivado_em),
    RLS: equipe interna lê; quem tem Linhas em Editar cria/altera; Total exclui. Validação dos itens no banco.
  - `clientes.pacote_id`: o último pacote usado com o cliente.
  - `linha_aplicar_pacote(linha, pacote)`: cria os conteúdos em Ideia, tipos intercalados
    (Card, Carrossel, Reel, Card…), data espalhada pelos dias escolhidos do mês, títulos "Reel 1", "Card 2"…
    e lembra o pacote no cliente.
  - Pacote de exemplo criado: "Pacote mensal" (6 cards + 6 carrosséis + 4 reels, seg–sex).
- Tela: `js/pacotes.js` — Configurações → Pacotes de produção (lista, editor, arquivar) e o bloco
  "Pacote" na janela Nova linha editorial.
- Teste no banco (transação desfeita): linha de novembro com o pacote mensal → 16 conteúdos, de 02/11 a 27/11,
  só em dias úteis.
- As peças de Design e as demandas de vídeo continuam nascendo dos conteúdos quando a linha é concluída.
