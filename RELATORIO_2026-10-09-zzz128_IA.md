# Relatório — IA: chat mais rápido, exemplos do que já saiu, imagem no assistente e roteiro a partir do conteúdo

**Versão:** `2026-10-09-zzz128` · **Cache:** `roteiros-b7-v333`
**Pedido:** da lista de novidades da IA, "1, 3, 5, 8".

## 1 · Chat mais rápido
**Medição antes:** de uma resposta de 12 s, de 6 a 7 s eram o servidor trabalhando **antes** de a pergunta chegar ao modelo.

O que foi feito:
- **Leituras juntas:** o servidor lia os dados do sistema em quatro levas, uma esperando a outra. Agora saem todas de uma vez. O que é lido e o texto montado são os mesmos.
- **Função perto do banco:** a função de IA rodava longe do banco, e cada leitura atravessava o continente. Agora ela roda na mesma região dele.
- **Uma ida a menos por pedido:** o navegador guarda por um dia a "consulta prévia" que fazia antes de cada chamada.

**Medição depois:** a parte do servidor caiu para cerca de 3 s (de 6–7 s).

**O que não mudou:** o tempo do modelo em si. Hoje ele variou de 2 a 9 s para a mesma pergunta, e isso continua sendo a maior parte da espera. Só troca de modelo resolve.

**Diferente do que eu tinha proposto:** falei em "ler só o que a pergunta precisa". Não fiz assim: adivinhar pelo texto da pergunta o que ler faria o assistente responder pior nas perguntas de continuação ("e no mês passado?"). Ler tudo de uma vez deu o ganho sem esse risco.

## 3 · A IA aprende com o que já saiu
Toda tarefa de IA que escreve para um cliente passa a receber exemplos reais dele, como referência de tom:
- até **3 legendas** de conteúdos já publicados ou programados;
- até **2 roteiros já gravados** (só as falas).

Vale para roteiro, análise, linha editorial, ideias das Oportunidades e o assistente com cliente em foco (no assistente, só as legendas; os roteiros recentes ele já via). A instrução é usar como referência de tom, sem copiar frases nem repetir temas.

**"Aprovado" aqui é "gravado ou publicado".** Hoje não existe aprovação de roteiro registrada no sistema (as aprovações que existem são de design e de linha), então usei o que chegou ao fim do caminho.

**Alcance hoje:** de 24 clientes, 11 têm legenda publicada, 10 têm roteiro gravado e 10 não têm nenhum exemplo ainda (para esses nada muda).

## 5 · Imagem no assistente
O campo de mensagem ganhou o botão de **anexar imagem**. Também dá para **colar um print com Ctrl+V**.
- A imagem aparece numa faixa acima do campo, com "Remover", e depois dentro da sua mensagem.
- Pode mandar só a imagem (a pergunta vira "O que você vê nesta imagem?") ou imagem com texto.
- A imagem é reduzida no navegador antes de ir (lado maior até 1280 px).
- **Não é guardada:** no histórico da conversa fica só "[imagem anexada]".
- O que estiver escrito dentro da imagem é tratado como conteúdo, não como ordem para a IA.

## 8 · Roteiro a partir do conteúdo da linha
No conteúdo da linha editorial, o bloco do roteiro ganhou **Criar roteiro com IA**, ao lado de "Vincular roteiro existente":
1. abre uma janela para escolher a **gravação em aberto** do cliente (já vem marcada a do mês da linha, se houver);
2. **Criar roteiro e abrir** cria um roteiro novo nessa gravação, com o título e o objetivo do conteúdo, já ligado a ele;
3. o editor abre direto na janela de **rascunho da IA**, que já existia: você manda gerar e escolhe as cenas que entram.

Nenhuma fala é gravada sozinha: aqui nasce só o roteiro vazio e o vínculo. Cliente sem gravação em aberto: aparece o aviso para criar a gravação primeiro.

## Também entrou
**Reserva do fluxo:** quando a resposta em fluxo cai logo no começo, sem nada escrito na tela, a mesma pergunta vai pelo caminho comum. É a única repetição que o sistema faz, e só nesse caso. Motivo: vi essa queda três vezes nos testes.

## Banco de dados
Nada mudou no banco nesta versão.

## Arquivos alterados
`supabase/functions/b7-ia/index.ts`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/ia/` (`chat.ts`, `memoria.ts`, `gemini.ts`, `servico.ts`, `provedor.ts`, `omniroute.ts`) — função publicada; `js/ia.js`, `js/ia-chat.js`, `js/linha.js`, `js/editor.js`, `js/app.js`, `styles/ia-chat.css`, `styles/conteudo.css`, `sw.js`, `js/auth.js` (versão).

## Testes executados
Função publicada, dados reais, app local.

**Velocidade (1):** mesma pergunta curta, antes e depois, descontando o tempo do modelo registrado pelo servidor.

| | Total | Modelo | Servidor |
|---|---|---|---|
| Antes, sem cliente | 12,3 s | 6,2 s | 6,1 s |
| Antes, com cliente | 12,1 s | 4,7 s | 7,4 s |
| Só leituras juntas | 6,8 s | 2,7 s | 4,1 s |
| Com a função perto do banco | 9,8 s | 6,7 s | 3,1 s |
| Com a função perto do banco | 9,4 s | 6,0 s | 3,4 s |

São poucas medições e o tempo do modelo oscila muito; o número do servidor é o que importa aqui.

**Exemplos (3):** conferi no banco quantos clientes têm exemplo. Gerei ideias para a Mais Sorrisos com os exemplos entrando: vieram 3 ideias. Não tenho como provar, só por esse teste, que o tom melhorou por causa dos exemplos.

**Imagem (5):** colei no campo um print de teste (um cartaz com "ARENA DECK · NOITE DO POP ROCK · Sábado, 17 de outubro · 21h · Entrada: R$ 25 até 22h") e pedi evento, data e preço. A resposta trouxe os três certos, em 6,4 s. A miniatura apareceu na faixa e depois na mensagem; conferido em captura.

**Roteiro (8):**
- pela tela: no conteúdo "POV: Como fazer seu pastel…" (Sabor da Feira) apareceram os dois botões; a janela abriu com a gravação "Gravações de Outubro · 06/10/2026" marcada. **Cancelei sem criar.**
- criação simulada no banco com a sua conta e desfeita: o roteiro nasce "Em criação" e o conteúdo fica ligado a ele. Nada ficou gravado.
- abrir o editor com o endereço novo num roteiro que já tem fala: abriu normalmente, sem erro, e não abriu a janela da IA (certo: ela só abre em roteiro vazio).

## Instabilidade do modelo durante os testes
O provedor da IA estava instável nesta manhã: duas respostas voltaram "indisponível" em menos de 2 s e uma estourou o prazo de 30 s. Repetidas, funcionaram. Parte disso pode ser eu ter feito muitas chamadas seguidas na camada gratuita.

## Não testado
- **A janela de rascunho abrindo sozinha depois de "Criar roteiro e abrir"** — não existe hoje um roteiro vazio para testar sem criar um de verdade. É o ponto mais frágil desta versão.
- Tocar em "Criar roteiro e abrir" de verdade.
- O botão de anexar pelo seletor de arquivo (testei colando) e imagem pelo celular (câmera/galeria).
- A reserva do fluxo (escrita, não aconteceu de novo para eu ver funcionando).
- Os exemplos nas tarefas de roteiro, análise e linha (o caminho é o mesmo das ideias).
- Contas de coordenador, videomaker e designer; tema escuro.

## Rastros do teste
Cerca de 10 conversas de medição no histórico do assistente do Kevin ("Medição: responda só ok") e uma com o print de teste. Umas 15 chamadas de IA na cota gratuita. Nenhum registro criado.
