# Relatório — Menu do botão direito só onde faz sentido, com nomes limpos

**Versão:** `2026-10-07-zzz96` · **Cache:** `roteiros-b7-v301`
**Relato:** "em maioria o texto fica bugado assim… não precisa ter menu de contexto em tudo", com dois prints:
- em Configurações, o menu pegou o bloco "Este aparelho" inteiro e mostrou "Buscar atualizaçãoconfere se saiu…";
- no menu lateral, pegou o grupo "Mais ferramentas" inteiro, com título "Mais ferramentasArquivadosLixeiraUsuári…".

## Causas
1. **Item errado.** O menu aceitava como "item" qualquer bloco repetido que tivesse botões dentro — inclusive um grupo inteiro de configurações ou de links.
2. **Nomes grudados.** O nome da ação era o texto do botão inteiro, juntando título e explicação sem espaço.

## O que mudou
**O menu agora só abre em três casos:**
- um **link** (item do menu lateral, atalho);
- uma **linha ou cartão de lista que abre com o clique** (pessoa, cliente, demanda);
- uma linha ou cartão de lista que tem o seu próprio **"⋯"**.

Em todo o resto vale o menu do navegador: blocos de configuração, botões soltos ("Criar", sino, assistente), títulos e área vazia. O menu "da tela" (Voltar, Recarregar…) foi retirado.

**Nomes:** o nome de cada ação é só o trecho em destaque do botão; a explicação que vem embaixo fica de fora. Títulos compridos são cortados com reticências numa palavra só.

## Arquivos alterados
`js/menu-contexto.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, com uma tela montada para o teste, cliques disparados por código, presa à aba local:
- linha de pessoa: menu com "Kevin França", Abrir, Editar acesso (sem a explicação grudada), Excluir conta, Copiar nome;
- link do menu lateral: título "Arquivados" (só ele, não o grupo), Abrir, Abrir em nova aba, Copiar nome, Copiar link;
- bloco de configuração (no botão e no título do bloco), botão "Criar" e área vazia: menu do navegador.

## Não testado
- As telas reais com conta real. A regra ficou mais restrita, então o risco agora é o contrário: algum cartão que deveria ter menu e não tem. Se aparecer, preciso do print.
