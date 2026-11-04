# Relatório — Chat com o assistente (IA)

**Versão:** `2026-10-07-zzz78` · **Cache:** `roteiros-b7-v283`
**Pedido:** "um sistema de chat com a IA, pra recomendar, perguntar, enfim..."
**Escolhas do Kevin:** contexto = cliente + operação · conversas guardadas no banco, por pessoa · botão flutuante · toda a equipe.

## Como funciona
- Um **botão redondo no canto inferior direito** abre a conversa. No PC é um painel acima do botão; no celular ocupa a tela inteira.
- No topo da conversa dá para **escolher um cliente em foco**. Com cliente, o assistente lê a estratégia e a linha editorial mais recente dele.
- Botões: conversas anteriores, nova conversa, fechar. Tela vazia traz sugestões de pergunta.
- Enter envia; Shift+Enter quebra linha.
- Se a IA falhar (limite, sem internet), aparece o aviso e a pergunta volta para o campo.

## O que o assistente sabe
A cada mensagem, o servidor lê **com o acesso da própria pessoa** (as regras do banco dela decidem o que entra):
- edição de vídeo e design **em aberto**: contagem por situação, atrasadas, o que vence em 7 dias, sem responsável;
- gravações de 7 dias atrás até 21 dias à frente;
- a lista de clientes;
- com cliente em foco: nicho, público, tom de voz, posicionamento, linha editorial mais recente, pilares e conteúdos.

É um **recorte**, não o banco inteiro. Entregues, histórico antigo, roteiros, aprovações e publicações não entram nesta versão.

**O assistente só lê.** Não cria, não altera e não apaga nada no B7.

## Mesma arquitetura de IA
Não foi criada uma segunda IA. O chat é mais uma tarefa (`chat`) da função `b7-ia`, com as mesmas proteções: sessão conferida no servidor, cliente do Portal barrado, limite por pessoa (8 por minuto, 80 por hora), chave só no servidor, nenhuma chamada em segundo plano, resposta sem nome de modelo ou provedor. Cada mensagem conta na mesma cota gratuita das outras funções de IA.

## Conversas guardadas (mudança em relação à regra anterior)
Até aqui a IA do B7 não guardava texto nenhum. **Por escolha do Kevin, o texto das conversas do chat passa a ficar no banco**:
- tabelas novas `ia_conversas` e `ia_mensagens`;
- **só o dono lê** a própria conversa (nem administrador lê a de outra pessoa pelo sistema);
- quem grava é só o servidor, depois de a resposta dar certo; pela tela ninguém insere nem altera mensagem;
- o dono pode apagar a conversa (as mensagens vão junto);
- não há limpeza automática por tempo.

O registro de uso (`ia_uso`) continua só com metadados, sem texto.

## Liga/desliga
Configurações → Admin → Inteligência artificial ganhou a chave **"Chat com o assistente"**. Desligado, o botão some e o servidor recusa o pedido.

## Banco de dados
`migration_ia_chat.sql` (aplicada). Só acréscimo: duas tabelas com RLS e a função `sistema_config_definir` passou a aceitar a chave `chat`. Nenhuma política existente mudou.

## Arquivos
Novos: `js/ia-chat.js`, `styles/ia-chat.css`, `supabase/functions/_shared/ia/chat.ts`, `migration_ia_chat.sql`.
Alterados: `supabase/functions/b7-ia/index.ts` (publicada), `js/ia.js`, `js/config.js`, `js/auth.js`, `js/dashboard.js`, `index.html`, `sw.js`.

## Testes executados
**Banco** (transação desfeita ao final):
- dono lê a conversa e as mensagens; não consegue inserir mensagem, criar conversa nem alterar título pela API;
- outro membro da equipe e o administrador não veem a conversa alheia nem conseguem apagar;
- anônimo barrado;
- dono apaga a conversa e as mensagens somem junto;
- configuração: `chat` desligado grava; pedido sem `chat` fica ligado.

**Tela** (app local, arquivos novos, sessão simulada, IA substituída por resposta de exemplo):
- botão aparece para a equipe; não aparece para cliente nem com o chat desligado; volta ao religar;
- painel abre, lista de clientes carrega, sugestões mudam com cliente em foco;
- enviar mostra "escrevendo", trava o campo e depois mostra a resposta com negrito e lista; HTML na resposta aparece como texto (não executa);
- a segunda mensagem vai com o identificador da conversa e o cliente;
- falha simulada: aviso na conversa e a pergunta volta para o campo;
- histórico abre; fechar remove o painel;
- 375 px: painel em tela cheia, campo com letra de 16 px, sem estouro horizontal.

**Servidor:** `b7-ia` publicada respondeu 401 a um pedido de chat sem sessão (está no ar e carregou a tarefa nova).

## NÃO testado (importante)
- **Uma conversa de verdade, de ponta a ponta.** Não tenho como chamar o servidor com uma sessão real, então não vi a IA responder, nem a leitura do recorte do B7, nem a gravação da conversa pelo servidor. É o primeiro teste a fazer.
- A qualidade das respostas e se ela respeita "não inventar" com os dados reais.
- Abrir e apagar conversa do histórico com dados reais.
- Aparência por captura de tela, tema escuro, celular físico.

## Limitações
- O assistente não enxerga tudo (ver "O que o assistente sabe"). Perguntas fora do recorte recebem "não encontrei nos dados".
- Sem resposta "ao vivo" letra a letra: a resposta chega inteira.
- Conversa longa: o servidor manda à IA só as 16 últimas mensagens.
- A cota gratuita é uma só para a equipe; o chat tende a gastar mais que as outras funções.
