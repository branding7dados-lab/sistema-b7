# zzz247: equipe nas Configurações (e coisas novas para a equipe)

Pedido do Kevin: "quero nas configurações tudo que eu posso setar, mudar, editar, excluir… tudo isso que envolva a equipe, quero novas opções para a equipe tb. me surpreenda!"

## Administração reorganizada (Configurações)
1. **Pessoas e acessos** (primeiro do bloco): contas, senhas, funções, módulos e histórico.
2. **Equipe**: tudo o que se ajusta da equipe.
   - **Recado e comunicado:** *Recado fixo para a equipe* (novo) e *Enviar comunicado*.
   - **Segurança da equipe** (novo grupo):
     - a regra da verificação em 2 etapas ("cada pessoa decide", "exigir de admin e coordenação" ou "exigir de todos") muda direto num seletor. Antes ficava escondida no cartão de 2 etapas do perfil de quem é admin;
     - Sessões ativas;
     - *Exportar lista da equipe* (novo).
   - **Arquivo** (lixeira e arquivados), **Ver como a equipe vê** e **Equipe e carga** (resumo da semana e redistribuição).
3. **Ausências e aniversários** (nova).
4. **Sistema da equipe** e **Saúde e manutenção**, como antes.

## Novidades para a equipe
- **Recado fixo:**
  - O admin escreve até 280 caracteres e escolhe até quando fica no ar (no máximo 60 dias) e o estilo: cores da B7, atenção ou comemoração.
  - Toda a equipe vê um cartão no alto da tela ao abrir o B7; clientes não veem.
  - Cada pessoa fecha o dela (guardado por recado). Um recado novo aparece de novo para todos.
  - "Tirar do ar" some para todos.
  - O banco guarda em `sistema_config` ('recado'), pela RPC `equipe_recado_definir`, que só admin chama.
- **Ausências** (`equipe_ausencias`):
  - Férias, folga, atestado, viagem ou outro, com datas e observação.
  - Quem está fora aparece em "Quem está fora" (agora e próximas) e num selo no cartão da pessoa em Pessoas e acessos ("Férias até 30/10").
  - A sugestão de redistribuição avisa se o destino sugerido está fora.
  - "Tirar" não apaga: marca `cancelado_em`.
- **Aniversários** (`equipe_aniversarios`):
  - Só dia e mês; a lista mostra quanto falta para cada um.
  - No dia, quem abre o B7 vê "Hoje é aniversário de Fulano!" com **Mandar parabéns**, que abre a conversa com a pessoa (novo `B7.Conversas.conversarCom`).
  - O aniversariante vê um cartão só dele, com confete nas cores da B7.
  - Aparece uma vez por dia em cada aparelho.
- **Exportar lista da equipe:** planilha CSV (abre no Excel) com nome, usuário, papel, função, se é admin, situação, último acesso, aniversário e ausência atual.

## Banco (`migration_equipe_agenda.sql`, já aplicada)
- Tabelas `equipe_ausencias` e `equipe_aniversarios`, com RLS: a equipe interna (`sou_equipe_interna`) lê e só admin (`sou_admin`) grava. Não há DELETE.
- Função `equipe_recado_definir(texto, até, estilo)`.

## Outros
- `js/equipe.js` (novo `B7.Equipe`), que entra no `index.html` e no `sw.js`.
- Ajuda da administração: tutorial novo "Ausências, aniversários e recado para a equipe", com a cópia da IA regenerada.
- VERSAO `2026-10-22-zzz247`, CACHE `roteiros-b7-v449`, novidade `v-zzz247`.
