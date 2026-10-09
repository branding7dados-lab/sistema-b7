# Relatório — Admin: TV configurável, manutenção agendada, sessões ativas e uso da IA

**Versão:** `2026-10-09-zzz136` · **Cache:** `roteiros-b7-v341`
**Pedido:** da lista de ideias de admin, "72, 73, 82, 78". (A correção do assistente, pedida na mesma mensagem, saiu antes, na zzz135.)

Tudo fica em **Configurações → Admin**.

## 72 · Painel de TV configurável
**Painel de TV → Configurar o Painel de TV.** Sete chaves:
- **Lista de clientes** — desligada, some a lista com os nomes e as etapas ganham a tela;
- **Nome do cliente nas gravações** — desligado, a gravação aparece só pelo título;
- **Etapas da agência**, **Próximas gravações**, **Publicações de hoje**, **"Hoje é dia de…"**;
- **Alternar com a agenda da semana** — uma segunda tela com os próximos 7 dias (um quadro por dia: gravações com horário e quantas publicações), trocando sozinha a cada 20 s, 30 s, 45 s, 1 min ou 2 min.

Vale para todo aparelho que abrir o Painel de TV. Uma TV que já está com ele aberto recebe a mudança em até 5 minutos.

**Sobre esconder nomes:** com "Lista de clientes" e "Nome do cliente nas gravações" desligados, **nenhum nome de cliente aparece** na TV. Era a ressalva que eu tinha deixado quando entreguei o painel.

## 73 · Manutenção agendada
Na janela do Modo manutenção, "Começa" ganhou **Agendar…**, que abre um campo de dia e horário (até 30 dias à frente).
- A linha passa a mostrar **Agendado** e "agendado para seg 12/10 às 22:00 · dura 60 min".
- **A equipe não vê nada até 10 minutos antes.** Aí aparece a contagem de sempre e, na hora, a trava.
- Você vê um lembrete no rodapé **só nas últimas 24 horas** antes do início; antes disso fica só na linha das Configurações.
- "Cancelar o agendamento" na mesma janela.

O horário é o do seu aparelho, convertido para a hora do servidor.

## 82 · Sessões ativas
**Sessões → Sessões ativas.** Lista, por pessoa, cada aparelho ou navegador onde a conta está aberta: "Chrome · Windows", "Safari · iPhone", há quanto tempo está em uso e desde quando. A sua sessão de agora vem marcada.
- **Encerrar** uma sessão, ou **Encerrar todas** de uma pessoa.

**O que você precisa saber antes de confiar nisso:**
- **Não é instantâneo.** O aparelho cai em **até 1 hora**: é o tempo que o acesso em uso leva para vencer, e depois disso ele não consegue renovar. Para um celular perdido, isso serve; para tirar alguém "agora", não.
- **Não muda a senha.** Quem souber a senha entra de novo. Para impedir a volta, redefina a senha em Usuários e acessos (a própria janela avisa).
- Não dá para encerrar a sua própria sessão por ali (use "Sair da conta").
- O endereço de rede (IP) existe no registro, mas **não é mostrado**.

**Mexe no controle de sessões do próprio Supabase** (apaga a sessão escolhida). Não toca em contas nem em senhas. Era o item que eu tinha dito que explicaria antes; como você pediu direto, fiz no desenho mais conservador e deixo as limitações acima explícitas. Derrubar na hora exigiria o B7 conferir a sessão a cada ação — posso fazer se quiser.

## 78 · Uso da IA
**Uso da IA → Uso da IA.** Período de 7, 30 ou 90 dias:
- chamadas de hoje e do período, percentual de erro e tempo médio do modelo;
- gráfico por dia (a parte vermelha são os erros);
- por pessoa e por tarefa (conversa, linha editorial, roteiros, voz, ideias…), com erros e tempo;
- motivo dos erros (provedor fora do ar, limite, etc.).

**Só números.** O texto dos pedidos e das respostas nunca foi guardado, então não aparece.

**O que não dá para mostrar:** "quanto falta da cota do dia". O provedor (camada gratuita) não informa o teto ao sistema. Quando ele estoura, aparece ali como erro de limite ou de provedor fora do ar.

## Banco de dados
`migration_admin_tv_sessoes_ia.sql` (aplicada). **Só funções**; nenhuma tabela, coluna ou regra de acesso (RLS) criada ou alterada:
- manutenção: aceita dia e horário marcados;
- a consulta que cada tela faz passou a entregar manutenção agendada à equipe só a partir de 10 minutos antes (assim uma tela ainda na versão antiga não mostra contagem de dias);
- configuração do Painel de TV;
- resumo do uso da IA;
- listar sessões, encerrar uma, encerrar todas de uma pessoa.

Todas conferem que quem chama é administrador.

## Arquivos
Novo: `js/admin-extra.js`, `migration_admin_tv_sessoes_ia.sql`.
Alterados: `js/tv.js`, `styles/tv.css`, `js/sistema.js`, `styles/sistema.css`, `js/dashboard.js`, `index.html`, `sw.js`, `js/auth.js` (versão).

## Testes executados
**Banco, com a sua conta e a de um coordenador, simulado e desfeito (nada ficou gravado):**
- manutenção agendada para daqui a 3 dias por 60 min: datas certas; 40 dias à frente é recusado; o jeito antigo de chamar continua funcionando;
- configuração da TV: grava só as chaves conhecidas; valor inválido é recusado;
- uso da IA com os dados reais: 84 chamadas em 7 dias, 7 erros, 3,5 s de média, 22 hoje, 3 pessoas, 5 tarefas;
- sessões: 13 listadas; encerrar uma deixou 12; encerrar a própria é recusado; "todas de uma pessoa" encerrou 3. **Tudo desfeito** — conferi depois: continuam as 13 sessões, ninguém foi derrubado;
- o coordenador foi barrado nas cinco funções.

**Telas, na aba local sem login, com conta e banco de mentira:**
- as quatro linhas aparecem na aba Admin;
- **uso da IA:** indicadores, 7 e 30 barras sem estourar a largura, tabelas por pessoa e por tarefa, motivos de erro; conferido em captura;
- **sessões:** agrupadas por pessoa, aparelho reconhecido (Chrome · Windows, Safari · iPhone, Chrome · Android, Edge · Windows), "esta sessão" sem botão; encerrar uma e encerrar todas pedem confirmação e atualizam a lista; conferido em captura;
- **manutenção:** "Agendar…" mostra o campo e muda o botão; agendar para 3 dias manda o horário certo; linha vira "Agendado"; sem faixa a mais de 24 h; com 3 horas de antecedência a faixa do administrador aparece; como equipe, nada aparece; cancelar volta a "Desligado";
- **TV:** janela com as sete chaves; salvar grava; com a agenda ligada a tela trocou sozinha para os 7 dias (conferido em captura, sem nomes de clientes); com a lista de clientes desligada, as etapas e a agenda ocupam a tela sem estourar (conferido em captura).

## Não testado
- **Nada disso com a sua conta de verdade na tela.**
- **Encerrar uma sessão de verdade** e ver o aparelho cair (e em quanto tempo).
- Manutenção agendada chegando na hora, com a tela de outra pessoa.
- Painel de TV numa TV real com a troca de tela ligada por horas.
- Celular e tema escuro.

## Rastros do teste
Nenhum registro criado ou alterado no banco. Nenhuma chamada de IA.
