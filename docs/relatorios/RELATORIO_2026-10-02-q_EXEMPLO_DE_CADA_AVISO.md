# Relatório 2026-10-02-q — Testar todas as notificações

Banco (migration `notificacao_teste_todos`, **aplicada**) e front-end (`js/perfil.js`, `js/database.js`, `styles/auth.css`). Sem tabela, coluna ou policy nova.

## O que entrou

Em **Meu perfil → Notificações → Neste aparelho**, abaixo do "Enviar teste" que já existia, há agora **"Ver um exemplo de cada aviso"**: escolhe o grupo e clica em "Enviar exemplos".

| Grupo | Avisos |
|---|---|
| Design | 17 |
| Vídeo | 9 |
| Gravações e agenda | 8 |
| Decisões do cliente | 6 |
| Revisão e resumo | 3 |
| **Todos** | **43** |

## Como funciona

- **Só você recebe.** A função entrega apenas para quem clicou.
- **Nada é alterado.** Não cria, move nem muda demanda, peça, gravação ou cartão do Kanban.
- Cada exemplo sai com o **tipo real** do aviso, então chega com a aparência, o som, o filtro do sino e o link de verdade. Os textos seguem o formato que o sistema usa em cada aviso, aplicados a itens reais recentes (uma peça, uma demanda de vídeo, uma gravação), para o clique abrir algo que existe.
- Todo título começa com **"Teste · "**.
- Os exemplos entram no sino como não lidos. "Marcar todas como lidas" limpa.
- Disponível para a equipe; conta de cliente não vê.

## O que este teste mostra e o que não mostra

- **Mostra:** como cada aviso chega neste aparelho (push, imagem da arte, botões, som) e para onde o clique leva.
- **Não mostra:** quem recebe cada aviso na operação real. Aqui todos chegam para você, mesmo os que no dia a dia iriam só para o designer ou para o videomaker. As suas preferências de notificação também não filtram os exemplos.

## Banco

- `migration_notificacao_teste_todos.sql` = migration `notificacao_teste_todos` aplicada.
- Função `notificar_teste_todos(p_grupo)`: exige sessão de alguém da equipe; entrega só para quem chama; o evento gravado é do tipo teste, o mesmo do "Enviar teste" que já existia.

## Arquivos

- `migration_notificacao_teste_todos.sql`, `js/database.js`, `js/perfil.js`, `styles/auth.css`.
- `js/auth.js` versão `2026-10-02-q`; `sw.js` cache `v144`.

## Testes realizados

- **Banco, na sua conta, em ensaio desfeito no final:** "Todos" criou 43 avisos e "Vídeo" criou 9, todos para você; a contagem de avisos das outras pessoas não mudou (731 antes e depois); o Kanban não mudou (98 cartões antes e depois). Li os 43 textos e links gerados. Nada ficou gravado.
- Sintaxe dos arquivos alterados.

## O que NÃO foi testado

- O clique no botão, logado. Não cliquei porque dispararia 43 notificações de verdade nos seus aparelhos.
- A chegada do push no celular e a imagem da arte nos avisos de Design.
- O bloco novo na tela do perfil (só a sintaxe foi conferida).

## Observações

- Três textos são aproximados, porque o original depende de dados da decisão: "Cliente solicitou ajustes" e "Cliente recusou a peça" (Design) e os lembretes de agenda.
- "Todos" manda 43 pushes de uma vez. No celular, o sistema pode agrupar ou atrasar alguns. Para olhar com calma, envie um grupo por vez.
