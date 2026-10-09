# Relatório — Conversas: o chat interno da equipe

**Versão:** `2026-10-09-zzz134` · **Cache:** `roteiros-b7-v339`
**Pedido:** chat interno estilo WhatsApp, com online, visto por último, áudio e notificação. "Tem que aparecer o gravando áudio também. Pode fazer."

## O que entrou
Um botão de conversa no topo, **ao lado do sino**, abre um painel lateral (no celular, ocupa a tela). Não sai da tela em que a pessoa está.

**Lista**
- toda a equipe aparece, com quem já há conversa primeiro, pela mais recente;
- bolinha verde em quem está **online**;
- prévia da última mensagem, hora, e contador de **não lidas**;
- na prévia aparece **"digitando…"** ou **"gravando áudio…"** quando a pessoa está fazendo isso para você.

**Conversa**
- balões com hora e separador por dia (Hoje, Ontem, data);
- embaixo do nome: **online**, **digitando…**, **gravando áudio…** ou **visto por último hoje às 14:32**;
- tiques nas suas mensagens: um = enviada, dois = entregue, dois azuis = lida;
- **texto** (Enter envia, Shift+Enter quebra linha; endereço vira link);
- **áudio**: toca no microfone, grava até 3 minutos, envia ou descarta; quem recebe ouve num player no balão;
- **imagem e arquivo** até 10 MB, pelo clipe ou **colando um print com Ctrl+V**, com legenda opcional; foto grande é reduzida antes de subir;
- **apagar a própria mensagem**: fica "Mensagem apagada" para os dois, e o arquivo é removido;
- mensagens antigas carregam ao rolar para cima.

**Aviso**
- mensagem nova com a conversa fora da tela: som, o botão balança, o contador sobe e aparece um aviso curto com "Abrir";
- **push** no celular e no computador, pelo mesmo caminho das outras notificações (com o nome de quem mandou e a prévia);
- mensagens seguidas da mesma conversa não empilham avisos: viram um só;
- com o B7 aberto e na frente naquele aparelho, o aviso do sistema não sai (a própria tela mostra);
- os avisos de conversa **não entram na lista do sino** nem no contador dele: têm o próprio botão.

## Decisões que tomei (as da tabela que te mandei, na recomendação)
- **Privacidade:** cada pessoa só lê as conversas de que participa. **Você, como administrador, não lê a conversa dos outros** — nem pelo sistema, nem pelos avisos.
- **Só equipe.** O cliente do Portal não entra.
- **Apagar:** só a própria mensagem.
- **Visto por último e "lido" valem para todos**, sem opção de esconder.
- **Entrada no topo**, ao lado do sino.
- A conversa entrou também no **liga/desliga de recursos** (Configurações → Admin → Recursos → "Conversas da equipe"): dá para deixar só para você enquanto testa. Está em "Todos".

## O que NÃO entrou nesta versão
Eu tinha dividido em etapas; esta entrega cobre as duas primeiras. Ficou para depois:
- **Grupos** (o banco já está preparado; falta a tela);
- **responder a uma mensagem** e **reações**;
- **mandar um item do sistema** como cartão (demanda, peça, roteiro);
- **busca** nas mensagens;
- **horário de silêncio** por pessoa (hoje vale a regra geral de push de cada um);
- **limpeza automática de áudios e arquivos com mais de 90 dias** — hoje nada é apagado sozinho. Com 1 GB de espaço e áudio a 32 kbps (cerca de 240 KB por minuto), há bastante folga, mas é para fazer antes de encher;
- chamada de voz ou vídeo.

## Um problema que encontrei e evitei
O caminho padrão de notificações do B7 copia os avisos para administradores que ligaram "receber tudo". Se o chat usasse esse caminho, **você receberia a prévia das mensagens privadas dos outros**. Por isso o aviso de conversa é gravado direto, só para quem participa. Testei: com três mensagens enviadas, existiu 1 aviso para o destinatário e 0 para qualquer outra pessoa.

## Banco de dados
`migration_conversas.sql` (aplicada). Tudo **novo**; nada do que existia foi alterado:
- 3 tabelas (conversas, participantes, mensagens);
- 1 espaço privado de arquivos ("chat-arquivos", limite de 10 MB por arquivo);
- **regras de acesso novas**, só dessas tabelas e desse espaço: lê quem participa; ninguém escreve direto;
- 7 funções (abrir conversa, enviar, marcar lida, marcar entregue, apagar, listar, conferir arquivo);
- as duas tabelas de mensagens entraram no tempo real.

Mudança no que existia, fora do banco: o "último acesso" de cada pessoa passou a ser gravado a cada 2 minutos (era 5), para o "visto por último" ficar mais fiel.

## Limites e ressalvas
- **Online, digitando e gravando** usam um canal de tempo real compartilhado pela equipe. Ele não carrega o texto de ninguém, só "fulano está online / digitando para beltrano". Não é um canal fechado por regra de acesso: alguém técnico, com uma conta da equipe, conseguiria ver quem está digitando para quem. O conteúdo das mensagens não passa por ali.
- **Online = com o B7 na frente.** Aba em segundo plano conta como fora.
- **Visto por último** tem precisão de até 2 minutos quando a pessoa fecha o navegador de vez.
- **Push no iPhone** só com o B7 instalado na tela de início.
- **Áudio gravado no iPhone** (formato m4a) e no computador (webm): não testei a reprodução cruzada entre os dois.
- "Entregue" significa que o B7 da outra pessoa recebeu a mensagem com o sistema aberto; push chegando com o app fechado não conta como entregue.

## Arquivos
Novos: `js/conversas.js`, `styles/conversas.css`, `migration_conversas.sql`.
Alterados: `js/app.js` (botão e link do aviso), `js/permissoes.js`, `js/database.js` e `js/notificacoes.js` (sino ignora aviso de conversa), `js/presenca.js`, `js/recursos.js`, `js/novidades.js`, `sw.js` (push de conversa), `index.html`, `js/auth.js` (versão).

## Testes executados
**Banco, com contas reais da equipe, simulado e desfeito (nada ficou gravado):**
- abrir conversa duas vezes devolve a mesma; texto é aparado; áudio guarda a duração;
- recusado: mensagem vazia, arquivo com caminho de outra conversa, conversa consigo mesmo;
- o destinatário vê 3 não lidas, marca como lida e vai a 0; os avisos dele ficam lidos junto;
- não consegue apagar mensagem alheia; o autor apaga a própria;
- **uma terceira pessoa da equipe não lê nada**: 0 mensagens, 0 conversas, 0 participantes, não abre o arquivo, não envia para a conversa e não insere direto na tabela;
- sessão sem perfil de equipe não lê nem abre conversa.

**Tela, na aba local sem login, com conta e banco de mentira (4 pessoas, 2 conversas):**
- botão no topo com contador; lista ordenada, com online e prévia; "gravando áudio…" na lista;
- conversa: dias, balões, link clicável, texto com `<b>` saindo como texto, imagem, arquivo, mensagem apagada, tiques nos três estados;
- enviar texto: aparece na hora com relógio e vira "enviada"; ao "ler" do outro lado, todos os tiques ficam azuis;
- status: online → digitando… → gravando áudio… → visto por último às HH:MM ao sair;
- mensagem chegando com a conversa aberta: entra, marca como lida e limpa o "gravando";
- mensagem chegando com o painel fechado: contador sobe e o botão balança;
- colar imagem: faixa de anexo com legenda, sobe o arquivo na pasta da conversa e envia como imagem;
- falha de envio: o balão some e o texto volta para o campo;
- **áudio com microfone simulado**: barra "gravando…", sinal de "gravando" enviado ao outro lado, envio de 3 s em webm, player no balão; descartar não envia nada;
- apagar: pede confirmação, remove o arquivo e mostra "Mensagem apagada";
- Esc volta e fecha; no celular (375 px) o painel ocupa a largura sem estourar.
- Erros achados e corrigidos: iniciais do avatar minúsculas; "gravando áudio…" continuava depois de a mensagem chegar.

**Testes automáticos** (sintaxe e fumaça) rodam na publicação.

## Não testado
- **Duas pessoas de verdade conversando.** É o teste que falta e o mais importante: tempo real entre dois navegadores, online, digitando e gravando ao vivo.
- **Envio e leitura de arquivo no espaço real** (subir, abrir pelo link temporário, apagar).
- **Push de conversa** chegando no celular e no computador, e o clique nele abrindo a conversa.
- **Microfone de verdade** e ouvir o áudio (o ambiente de teste não tem som).
- O aviso curto com "Abrir" (o ambiente de teste roda com a aba escondida).
- Celular de verdade (teclado, câmera, tela pequena) e tema escuro.
- Conversa com muitas mensagens (rolagem para as antigas).
- Contas de coordenador, videomaker e designer na tela.

## Correção a dois relatórios anteriores
Nos relatórios da zzz129 (textos padrão) e da zzz130 (manutenção) escrevi que testei com "cliente do Portal". **Não existe nenhuma conta de cliente no banco hoje**, então aqueles testes rodaram como "sessão sem perfil de equipe". O caminho do código é o mesmo (quem não é equipe recebe só o que é do Portal), mas não foi uma conta de cliente de verdade. Fica registrado.

## Rastros do teste
Nenhum registro criado no banco: nenhuma conversa, mensagem, aviso ou arquivo. Nenhuma chamada de IA.
