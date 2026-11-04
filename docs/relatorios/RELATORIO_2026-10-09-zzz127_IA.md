# Relatório — IA: assistente enxerga mais, propõe mais, guarda os cartões, fala, e as ideias viram conteúdo

**Versão:** `2026-10-09-zzz127` · **Cache:** `roteiros-b7-v332`
**Pedido:** da lista de melhorias da IA, "2, 3, 4, 5, 6".

## 2 · O assistente enxerga mais
A cada mensagem ele passa a receber também:
- **Panorama do mês:** como está cada etapa de cada cliente (linha, roteiros, gravações, vídeos, design, aprovações, publicações) e o que está atrasado. Com um cliente em foco, só a linha dele.
- **Datas relevantes** de hoje e dos próximos 7 dias (as mesmas do aviso "Hoje é dia de…").
- **Comentários em aberto nas aprovações** (os 12 mais recentes), com cliente, item e quem escreveu.

Panorama e comentários são lidos com o acesso de quem pergunta. As datas vêm por uma função do servidor (toda a equipe já enxerga essas datas).

## 3 · Mais ações com confirmação
Além da demanda de vídeo, o assistente agora propõe:
- **Demanda de design** (card, capa de reel, carrossel, stories ou outro), com prazo;
- **Gravação**, com data e hora se você disser;
- **Conteúdo na linha editorial** do cliente, como Ideia (formato, título e ideia).

Cada proposta vira um cartão; nada é criado sem você tocar no botão. Quem cria é a mesma função que a tela daquele módulo usa, com as suas permissões.

- **Quem recebe o quê:** demanda de vídeo — administrador, coordenação e videomaker (como antes). Design, gravação e conteúdo — só administrador e coordenação.
- **Conteúdo precisa de linha:** entra na linha do mês pedido (ou na mais recente). Se o cliente não tem linha, o assistente avisa em vez de propor.
- **Telas antigas protegidas:** quem ainda estiver com a versão anterior aberta só recebe proposta de vídeo (a tela antiga trataria qualquer cartão como demanda de vídeo).

## 4 · "Usar na linha" nas ideias das Oportunidades
Cada ideia gerada na folha da oportunidade ganhou o botão **Usar na linha** (administrador e coordenação):
- abre uma janela para escolher a linha editorial do cliente (já vem marcada a do mês da data, se existir);
- **Adicionar como Ideia** cria o conteúdo na linha com título, gancho (no campo "ideia") e legenda;
- o formato vira o tipo da linha: Reels → Reel, Post → Card, Stories → Story, Carrossel → Carrossel;
- o conteúdo fica ligado à oportunidade;
- **a data da oportunidade vira a data de postagem** quando cai no mês da linha escolhida;
- depois de criado, o botão vira "Na linha editorial · abrir".

Cliente sem linha: aparece o aviso para criar a linha primeiro.

## 5 · Os cartões sobrevivem
As propostas ficam guardadas junto da resposta. Ao reabrir a conversa pelo histórico, os cartões voltam, cada um no estado em que ficou (pendente, criado ou cancelado). Conversas antigas, de antes desta versão, continuam só com o texto.

## 6 · Ouvir a resposta
Cada resposta do assistente ganhou o botão **Ouvir**. A leitura é feita pela voz do próprio navegador (não passa pela IA do B7, não gasta cota). Tocar de novo para. Enviar uma mensagem ou fechar o assistente também para. A qualidade da voz depende do aparelho.

## Banco de dados
`migration_ia_acoes_e_contexto.sql` (aplicada):
- uma coluna nova (`acoes`) nas mensagens do assistente;
- uma função para marcar a proposta como criada/cancelada (só em conversa de quem chama);
- uma função do servidor que lista as datas dos próximos dias.

Nenhuma regra de acesso criada ou alterada.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts`, `supabase/functions/b7-ia/index.ts` (função publicada); `js/ia-chat.js`, `js/ia.js`, `js/oportunidades.js`, `styles/ia-chat.css`, `styles/oportunidades.css`, `migration_ia_acoes_e_contexto.sql` (novo), `sw.js`, `js/auth.js` (versão).

## Testes executados
Função publicada, dados reais, app local.

**Contexto (2):** uma pergunta sobre o panorama, as datas e os comentários. O assistente citou os clientes com atraso, listou as datas de 10 a 13/10 e achou os 3 comentários em aberto (Sabor da Feira). Errou um detalhe: chamou 13/10 de segunda-feira (é terça).

**Ações (3):** um pedido com três coisas (carrossel para a Arena Deck, gravação para a Mais Sorrisos dia 20/10 às 14h, ideia de Reel para a Óticas Almeida). Vieram os cartões de design e de gravação, e o aviso de que a Óticas Almeida não tem linha editorial para receber o conteúdo.

**Criação (3 e 4), simulada no banco e desfeita:** com a sua conta, as mesmas chamadas dos cartões — criar peça de design, criar gravação e agendar (ficou "Agendada" em 20/10), criar conteúdo numa linha e ligar à oportunidade — funcionaram. Tudo desfeito em seguida; **nada ficou gravado**.

**Cartões no histórico (5):** reabri a conversa de teste: os dois cartões voltaram. Cancelei o segundo, saí e reabri: continuou cancelado e o primeiro continuou pendente.

**Ouvir (6):** o botão aparece, liga ("Parar de ouvir") e desliga. O navegador de teste não tem som: não ouvi a voz.

**Usar na linha (4):** gerei ideias para "Dia Nacional de Segurança e de Saúde nas Escolas" × Ensino Plus; o botão abriu a janela com a linha "Outubro 2026" já marcada e a prévia da ideia. **Cancelei sem criar.**

## Não testado
- **Tocar em "Criar" de verdade** em qualquer cartão e em "Adicionar como Ideia" (criaria registros reais). O caminho foi conferido só pela simulação desfeita no banco.
- O cartão de **conteúdo** na tela (o teste não gerou um, por falta de linha do cliente escolhido).
- A sincronização da gravação com o Google Agenda ao criar pelo cartão.
- A voz do "Ouvir" tocando; celular; tema escuro.
- Contas de coordenador, videomaker e designer.
- Se a resposta ficou mais lenta com o contexto maior (as medições desta rodada ficaram em 8 a 9 s, parecido com antes).

## Rastros do teste
Quatro conversas de teste no histórico do assistente do Kevin (uma com dois cartões, um deles cancelado). Cerca de 5 chamadas de IA na cota gratuita. Nenhum registro criado.
