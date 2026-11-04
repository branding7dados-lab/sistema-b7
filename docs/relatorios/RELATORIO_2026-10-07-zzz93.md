# Relatório — Menu do botão direito com as ações do item

**Versão:** `2026-10-07-zzz93` · **Cache:** `roteiros-b7-v298`
**Pedido:** ao clicar com o botão direito em alguma coisa, aparecer algo relacionado àquela coisa, e não o menu do navegador.

## Como funciona
Clicar com o botão direito num item (uma pessoa, um cliente, um cartão, uma linha de lista, um link do menu lateral) abre um menu com o nome do item no topo e as ações **dele**:

- **Abrir** — o mesmo que o clique normal faz;
- os botões que o item mostra na tela;
- tudo o que está guardado no "⋯" do item (na tela de Usuários, por exemplo: editar acesso, trocar foto, excluir conta);
- **Abrir em nova aba** e **Copiar link**, quando o item é um link;
- **Copiar nome**.

Clicando numa área vazia, o menu é o da tela: Voltar, Recarregar esta tela, Copiar link desta tela e Perguntar ao assistente.

### Decisão de construção
Não escrevi uma lista de ações por tela. O menu é montado na hora a partir do que o próprio item já oferece, e cada opção aciona o botão original. Consequências:
- vale para todas as telas de uma vez, inclusive as que vierem depois;
- as permissões e regras são as da tela: o menu não mostra nada que a pessoa já não pudesse fazer ali;
- nenhuma regra de negócio, banco ou permissão foi tocada.

O lado fraco: os nomes das opções são os que os botões já têm. Onde um botão tem nome ruim, ou onde um item só se mexe arrastando (mudar de coluna num quadro), o menu não inventa a ação.

## Quando o menu do navegador continua aparecendo
- segurando **Shift** ao clicar com o botão direito (para Inspecionar etc.) — o próprio menu lembra disso no rodapé;
- em campos de texto e com texto selecionado (copiar, colar, corretor);
- no celular e no toque;
- com o teleprompter aberto e na tela de entrada.

## Arquivos alterados
`js/menu-contexto.js` (novo), `index.html`, `styles/global.css`, `sw.js`, `js/auth.js` (versão).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, com uma lista de pessoas montada para o teste (mesma estrutura da tela de Usuários) e cliques disparados por código:
- botão direito na linha abre o menu com o nome da pessoa, "Abrir", as três ações do "⋯" e "Copiar nome";
- escolher "Trocar foto" aciona a ação da pessoa certa e fecha o menu; "Abrir" aciona o clique da linha;
- em campo de texto e com Shift, o menu do navegador não é bloqueado;
- em área vazia abre o menu da tela;
- clicar fora fecha.

## Incidente durante o teste
A primeira rodada do teste foi executada, por engano, na aba do sistema publicado que estava aberta no navegador interno, e não na aba local. O script só montou uma lista falsa na tela e trocou duas funções em memória; **nenhum dado foi lido, gravado ou enviado**. Removi a lista falsa e recarreguei aquela aba (estava no Painel, sem janela aberta) para desfazer as trocas. Os testes seguintes foram presos à aba local.

## Não testado
- **Nenhuma tela real do sistema**, com conta real e mouse de verdade. O teste usou uma lista montada para isso. É esperado que alguma tela mostre um menu pobre ou pegue o item errado; preciso dos exemplos para ajustar.
- A posição do menu rente às bordas da tela (corrigi um caso depois do teste e não repeti).
- Aparência (o navegador de teste não mostra o resultado visual).
