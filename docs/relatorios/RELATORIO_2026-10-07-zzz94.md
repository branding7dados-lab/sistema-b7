# Relatório — Menu do botão direito mais bonito e sem itens repetidos

**Versão:** `2026-10-07-zzz94` · **Cache:** `roteiros-b7-v299`
**Pedido:** "deixa esse menu de contexto mais bonito", com quatro prints mostrando também defeitos de conteúdo.

## Defeitos dos prints e o que mudou
1. **Sino: "5 / 5 / Copiar nome".** O menu usava o contador como nome. Agora texto sem letras não vale como nome: usa-se o nome do controle ("Notificações").
2. **"Kevin Françavocê".** O selo "VOCÊ" entrava no título. Agora o título é só o nome.
3. **Botões soltos ("Criar", assistente): título e ação iguais, mais "Copiar nome".** Para um botão solto, o menu passou a ser: a ação do botão em destaque e, abaixo, as opções da tela (Voltar, Recarregar, Copiar link, Perguntar ao assistente). Sem "Copiar nome" e sem repetir.

## Aparência
- cabeçalho com a foto do item (quando ele tem) e o nome;
- um ícone por ação, escolhido pelo nome dela (editar, foto, senha, excluir, copiar, voltar…);
- ações perigosas (desativar, excluir) em vermelho;
- cantos mais redondos, sombra mais funda, entrada com um leve crescimento a partir do ponto do clique;
- rodapé com a tecla Shift desenhada como tecla.

## Arquivos alterados
`js/menu-contexto.js`, `styles/global.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, com uma tela montada para o teste (lista de pessoas, sino com contador, botão "Criar", botão sem nome), cliques disparados por código, sempre presa à aba local:
- linha da pessoa: título "Kevin França" sem o selo, foto no cabeçalho, sete ícones, ações do "⋯" completas;
- sino: ação "Notificações" e opções da tela;
- "Criar": ação "Criar" (que aciona o botão) e opções da tela;
- botão sem nome nenhum: cai no menu da tela;
- uma captura de tela do menu aberto, conferida visualmente.

## Não testado
- As telas reais com conta real. A captura foi feita antes do último ajuste (linhas um pouco mais baixas e ícone de lápis em "Editar acesso"); esse ajuste final não foi revisto em tela.
- Tema escuro.
