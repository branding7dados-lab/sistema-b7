# zzz248: passar o trabalho de quem sai

Kevin perguntou pelo "sistema de transferir as coisas para uma pessoa depois que outra sair". Ele não existia: só havia desativar a conta (o trabalho ficava no nome da pessoa) e a sugestão de redistribuição (só equilibra carga, e só o que não começou). Pedido: "faz do jeito que vc achar melhor!"

## Como ficou
- **Onde:**
  - Configurações → Equipe → Equipe e carga → **Passar o trabalho de alguém**;
  - no ⋯ do cartão da pessoa em Pessoas e acessos, em **Passar o trabalho…**;
  - **automaticamente ao Desativar conta**: se a pessoa ainda tem trabalho em aberto, a janela de repasse abre antes, com "Desativar a conta no fim" marcado.
- **A janela:**
  - Um bloco por tipo de trabalho em aberto, cada um com quantos itens tem e um seletor "para quem vai":
    - Design (peças não finalizadas);
    - Edição de vídeo (pendente, em edição ou com o cliente);
    - Gravações marcadas (de hoje em diante, não gravadas nem canceladas);
    - Produção (cards abertos que não são de design ou vídeo, porque esses acompanham a peça ou a demanda).
  - O seletor sugere quem está com menos trabalho e não está de férias.
  - "Não passar" deixa aquele tipo com a pessoa.
  - Em "Ver os itens e escolher" dá para desmarcar itens.
  - O botão diz o que vai acontecer: "Passar 4 itens e desativar" ou "Só desativar".
- **O que acontece:**
  - O responsável de cada item muda, e o card ligado da Produção acompanha.
  - O histórico de cada item registra o repasse.
  - Quem recebe ganha **um** aviso com o total ("Você recebeu o trabalho de Fulano · 16 itens"), em vez de um por item. A exceção são as gravações: cada gravação passada também gera o aviso de sempre ("Gravação atribuída a você").
  - Fica um registro na auditoria.
  - Se marcado, a conta é desativada no fim.
- **Nada é apagado.**

## Banco
- `saida_resumo(p_perfil)` e `saida_transferir(p_de, p_destinos, p_excluir)`, só para admin.
- Testadas no banco de verdade dentro de transação com ROLLBACK, sem mudar dado nenhum:
  - Allissan → Yury: 34 peças;
  - Kaique → Kevin: 4 vídeos;
  - Kevin → Kaique: 15 vídeos e 1 gravação, com um aviso único de "16 itens".
- Registro em `migration_equipe_repasse.sql`.

## Outros
Tutorial "Passar o trabalho de quem sai" na ajuda da administração (cópia da IA regenerada). VERSAO `2026-10-22-zzz248`, CACHE `roteiros-b7-v450`, novidade `v-zzz248`.
