# Relatório 2026-10-02-i — Tela "Usuários e acessos"

Só front-end (`js/usuarios.js`, `styles/auth.css`). Sem migration. Os dados, as ações (editar, foto, senha, desativar, excluir) e os formulários são os mesmos; mudou a apresentação da lista.

## Resumo da atualização

- A lista virou uma **tabela alinhada**, separada em **Equipe** e **Clientes**.
- **Busca** por nome ou usuário e um **resumo** das contas (total, online agora, desativadas).
- A **função extra** (Videomaker, Designer…) saiu de dentro do selo do perfil e virou uma etiqueta ao lado.
- **Clicar na linha** abre "Editar acesso"; o menu ⋯ continua com as demais ações.

## O que estava ruim

- Cada linha era uma grade independente, com colunas do tamanho do próprio conteúdo. O selo de perfil e o traço "—" caíam em posições diferentes em cada linha, e sobrava um vazio grande no meio.
- A coluna de empresas mostrava só um "—" para a equipe, que não tem empresas.
- Papel e função extra dividiam o mesmo selo ("ADMINISTRADOR · VIDEOMAKER"), como se fossem dois papéis.
- Equipe e clientes misturados; sem busca, sem contagem.
- O papel Videomaker não tinha cor definida.

## O que mudou

- **Barra:** busca à esquerda; à direita, "N contas", "N online agora" e, se houver, "N desativadas".
- **Blocos:** *Equipe* (quem produz) e *Clientes* (quem acompanha pelo Portal), cada um com título, contagem e uma frase curta. O bloco de clientes só aparece quando há conta de cliente.
- **Colunas com cabeçalho:** Pessoa · Perfil · (Empresas, só nos clientes) · Acesso. Todas as linhas de um bloco usam a mesma grade.
- **Pessoa:** foto, nome e usuário. Ponto verde no canto da foto quando está online. Etiqueta "você" na sua conta, que vem primeiro.
- **Perfil:** o selo do papel e, ao lado, as funções extras como etiquetas ("+ Videomaker"). Em cliente, "Pode aprovar" quando for o caso.
- **Acesso:** "Online agora", "hoje às 09:03", "há 3 dias", "Nunca acessou"; conta desativada mostra o selo "Desativada" e fica esmaecida.
- **Ordem em cada bloco:** a sua conta, depois as ativas, depois por nome.
- **Celular:** a tabela vira uma pilha (pessoa e menu em cima; perfil e acesso embaixo).

## Mudança de comportamento

- Clicar em qualquer ponto da linha (fora do menu ⋯) abre "Editar acesso". Antes só o menu abria algo. Enter com a linha em foco faz o mesmo.

## Arquivos

- `js/usuarios.js`: `abrir` (barra, blocos, `pintar`) e `linhaUsuario`.
- `styles/auth.css`: bloco da lista de usuários reescrito.
- `js/auth.js` versão `2026-10-02-i`; `sw.js` cache `v136`.

## Testes realizados

Página de teste local com 7 contas inventadas (5 de equipe, 2 clientes; uma desativada, uma que nunca acessou), no navegador embutido. Página apagada depois.

- Blocos Equipe (5) e Clientes (2); resumo "7 contas · 1 online agora · 1 desativada".
- Alinhamento medido: o selo de perfil e a coluna de acesso começam no mesmo ponto em todas as linhas do bloco.
- Sua conta primeiro, com "você" e ponto verde; funções extras como etiquetas separadas.
- Clique na linha abre "Editar acesso"; clique no ⋯ abre só o menu; "Redefinir senha" pelo menu abre o modal certo.
- Busca filtra, mostra "Nada encontrado" e volta ao limpar.
- Capturas conferidas em 1000 px e 390 px, sem rolagem lateral. Sem erro no console.

## O que NÃO foi testado

- Dentro do B7 logado, com as contas e fotos reais.
- Salvar de fato uma edição, trocar foto, redefinir senha, desativar ou excluir (os formulários não foram alterados; só conferi que abrem).
- Modo escuro.
- Lista com muitos clientes.
