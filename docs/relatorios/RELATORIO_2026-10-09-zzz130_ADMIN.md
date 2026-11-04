# Relatório — Admin: modo manutenção e novidades

**Versão:** `2026-10-09-zzz130` · **Cache:** `roteiros-b7-v335`
**Pedido:** da lista de funções de admin, "66, 70".

## 66 · Modo manutenção
**Configurações → Sistema → Modo manutenção.**

Você escolhe:
- a **mensagem** que a equipe vai ler (até 300 caracteres);
- **quando começa**: em 2 minutos (padrão), em 5 minutos ou agora;
- **quanto dura**: 15 min, 30 min, 1 hora ou "até eu desligar";
- se **trava também o Portal do cliente** (desmarcado por padrão).

O que a equipe vê:
1. antes de começar, uma faixa no topo com contagem: "O sistema entra em manutenção em 1 min 40 s. Salve o que estiver fazendo.";
2. na hora, a tela inteira é coberta com "Sistema em manutenção", a sua mensagem e a previsão de volta. Nada por baixo pode ser clicado nem digitado;
3. quando acaba (pelo horário ou porque você desligou), a tela se libera sozinha.

O que você vê: nunca é travado. Fica uma faixa lembrando que está ligado, com o botão **Gerenciar**, que abre a janela para **Desligar agora**.

Detalhes:
- **Administradores continuam usando normalmente** (hoje é só você).
- Com duração marcada, **desliga sozinho** no fim: não tem como esquecer ligado.
- Quem está com o **teleprompter aberto** não é cortado: a trava entra quando ele fechar.
- A mudança chega a cada tela aberta em **até 1 minuto**. Por isso o padrão é começar em 2 minutos: dá tempo de todo mundo ver a contagem. Tela travada confere a cada 20 segundos, para liberar logo.
- A hora usada é a do servidor, não a do relógio de cada computador.

**O que isso é e o que não é.** É uma **trava de tela**. Não mudei nenhuma regra de acesso do banco: alguém com conhecimento técnico ainda conseguiria falar com o banco por fora da tela durante a manutenção. Serve para avisar e segurar a equipe enquanto você mexe em algo, não como proteção de segurança. Trava de verdade no banco exigiria mexer nas regras de acesso (RLS) — não fiz; se precisar disso, eu desenho antes.

**"Agora" pode fazer alguém perder um formulário pela metade.** A janela avisa isso. O que tem salvamento automático continua salvo.

## 70 · Novidades
**Para você — Configurações → Admin → Novidades → Publicar novidade.**
- título e "o que mudou" (uma linha por item, até 12);
- a versão do sistema entra sozinha;
- abaixo, as já publicadas, com **Remover** em cada uma;
- guarda as 30 mais recentes.

**Para a equipe:**
- ao abrir o B7, quem ainda não leu vê um **cartão no canto** ("Novidade no B7 · título · Ver");
- **Ver** abre a lista completa, da mais recente para a mais antiga, com as não lidas destacadas;
- o × dispensa sem abrir;
- depois, relê quando quiser em **Configurações → Geral → Novidades do B7**.

Detalhes:
- o Portal do cliente não recebe novidades;
- "já li" é guardado **por aparelho**: quem usa computador e celular vê o cartão uma vez em cada;
- o texto é tratado como texto puro (não vira código na tela).

**O que ficou de fora:** eu tinha sugerido "escrito por você ou gerado dos relatórios". Fiz só o escrito por você. Gerar o resumo com a IA a partir dos relatórios fica para depois, se você quiser.

**Nenhuma novidade foi publicada por mim.** A lista começa vazia; a equipe só vê o cartão quando você publicar a primeira.

## Banco de dados
`migration_manutencao_e_novidades.sql` (aplicada): três funções novas.
- ligar/desligar a manutenção — só administrador;
- publicar a lista de novidades — só administrador;
- a consulta que cada tela faz para saber se há manutenção: a equipe recebe sempre; o cliente do Portal só recebe a que foi marcada para valer no Portal.

**Nenhuma regra de acesso (RLS), tabela ou coluna criada ou alterada.**

Custo novo: cada tela aberta faz uma consulta leve por minuto (só com a aba visível).

## Arquivos
Novos: `js/sistema.js`, `styles/sistema.css`, `migration_manutencao_e_novidades.sql`.
Alterados: `js/dashboard.js`, `js/auth.js`, `index.html`, `sw.js`.

## Testes executados
**Limitação desta rodada (a mesma da anterior):** a aba local de teste estava **sem login**. As telas foram testadas com uma conta de mentira e com as chamadas ao banco substituídas por um simulador. O banco de verdade foi testado à parte.

**Banco (com contas reais, simulado e desfeito):**
- administrador liga a manutenção: começo e fim calculados certo (2 min + 30 min), mensagem aparada;
- coordenador **enxerga** a manutenção e **não** consegue desligar nem publicar novidade;
- cliente do Portal não recebe a manutenção comum e recebe a marcada para o Portal;
- manutenção com o fim no passado volta como "nenhuma";
- novidade: itens vazios descartados, identificador inválido recusado.

**Manutenção na tela (simulado):**
- como equipe: faixa com contagem → na hora, tela coberta e o sistema por baixo sem resposta a clique → liberou sozinha no fim. Conferido em captura;
- como administrador: sem trava, com a faixa e o botão Gerenciar; ligar (2 min / 15 min) e "Desligar agora" mandaram os valores certos e a linha em Configurações acompanhou (Desligado → Marcado → Desligado).
- Erro achado e corrigido: ao desligar pela faixa, a linha de Configurações continuava dizendo "Ligado".

**Novidades na tela (simulado):**
- publicar sem título é barrado; publicar com título e itens funciona; o cartão aparece; "Ver" abre a lista e marca como lida; o cartão não volta depois; remover funciona;
- um item com código (`<img …>`) apareceu como texto, sem executar.
- Erros achados e corrigidos: a versão aparecia como "vzzz129"; a linha "Publicar novidade" não atualizava a contagem depois de publicar.

## Não testado
- **Ligar a manutenção de verdade** e ver a tela de outra pessoa travar e liberar. Recomendo o primeiro uso fora do horário de trabalho, com "Em 2 minutos / 15 minutos".
- Publicar uma novidade de verdade e outra pessoa ver o cartão.
- A trava no Portal, com conta de cliente.
- O teleprompter segurando a trava; celular; tema escuro.
- A espera real de "até 1 minuto" entre você ligar e a tela dos outros reagir.
- Contas de coordenador, videomaker e designer na tela.

## Rastros do teste
Nenhum registro criado ou alterado no banco. Nenhuma chamada de IA.
