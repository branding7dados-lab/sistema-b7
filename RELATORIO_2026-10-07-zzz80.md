# Relatório — "Atualizar todos agora"

**Versão:** `2026-10-07-zzz80` · **Cache:** `roteiros-b7-v285`
**Pedido:** um botão que, ao clicar, atualiza a página de todos os usuários.

## Como funciona
1. Em **Configurações → Sistema**, o administrador toca em **"Atualizar todos agora"** e confirma.
2. O B7 lê qual versão está publicada e grava no banco "a versão exigida é esta".
3. Cada tela aberta já confere a cada 30 segundos se saiu versão nova. Ao achar, pergunta ao banco se ela foi exigida. Se foi, o cartão do canto vira **"Atualização para toda a equipe"** com contagem de **10 segundos** e a página recarrega sozinha, salvando antes o que estiver pendente.
4. Quem está com o B7 fechado ou sem internet pega a versão nova ao abrir, como sempre.

Chega a cada pessoa em até cerca de 1 minuto (30 s da conferência + 10 s da contagem). Aba em segundo plano atualiza quando a pessoa voltar para ela.

## Cuidados
- **Teleprompter aberto:** a contagem espera. Recomeça quando a pessoa fecha o teleprompter.
- **"Atualizar agora"** no cartão adianta a recarga. Não existe "Depois" nesse caso.
- **Formulário pela metade** (ex.: "Nova demanda" aberta) pode perder o que foi digitado; o que tem salvamento automático é salvo antes. A confirmação do botão avisa isso.
- Vale também para o Portal do cliente.

## O que não muda
Sem o pedido do administrador, tudo continua como antes: o cartão aparece e só atualiza quem clicar. O pedido vale para a versão publicada naquele momento; uma versão publicada depois volta a ser opcional até um novo clique.

## Banco de dados
`migration_atualizar_todos.sql` (aplicada). Só acréscimo:
- a função `sistema_config_definir` aceita a chave `atualizacao` (só administrador; a versão é validada);
- uma política de leitura a mais em `sistema_config`, **só para essa chave**, para qualquer conta logada (o cliente do Portal precisa ler para atualizar). As outras configurações continuam só para a equipe.

## Arquivos alterados
`js/app.js`, `js/dashboard.js`, `styles/global.css`, `migration_atualizar_todos.sql` (novo), `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
**Banco** (transação desfeita ao final):
- designer não consegue enviar o pedido; administrador consegue; versão com caracteres inválidos é barrada; campo estranho é descartado;
- membro da equipe lê o pedido; conta fora da equipe enxerga **só** a chave de atualização; anônimo não lê nada;
- a configuração da IA continuou gravando normalmente.

**Tela** (app local, versão antiga simulada, resposta do banco simulada):
- sem pedido: cartão normal, com "Depois" e "Atualizar";
- com pedido e teleprompter aberto: "Vai atualizar assim que você fechar o teleprompter", sem contagem e sem "Depois";
- ao fechar o teleprompter: contagem andando ("atualiza sozinho em 7 s", botão "Atualizar agora (7)").

## Não testado
- A recarga ao fim da contagem (recarregaria a página de teste) e o clique no botão de Configurações com conta real.
- Duas pessoas reais ao mesmo tempo, celular físico, Portal do cliente.

## Observações
- **A primeira vez não é automática:** quem está numa versão anterior a esta ainda não tem o código da contagem. Cada pessoa precisa entrar na zzz80 uma vez (clicando em Atualizar ou reabrindo o B7); da próxima publicação em diante o botão funciona para todos.
- Durante a auditoria vi que a conta do Kaique está como **Administrador** no banco (além de Videomaker). Não alterei; fica o registro caso não tenha sido intencional.
