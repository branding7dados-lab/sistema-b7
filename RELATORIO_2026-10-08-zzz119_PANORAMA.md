# Relatório — Panorama: o raio-X do mês por cliente (substitui a Central B7)

**Versão:** `2026-10-08-zzz119` · **Cache:** `roteiros-b7-v324`
**Pedido:** reformular a Central B7, que quase ninguém usava. Nome escolhido: **Panorama**. Conteúdo: o raio-X por cliente. "Uma tela foda e animações foda... impecável", e fora do grupo Principal ("principal é só o meu Painel").

## O que era e o que virou
**Antes:** a Central B7 era uma tela de contadores (quantas gravações, linhas e roteiros existem). Não respondia nada que as outras telas já não respondessem.

**Agora:** o Panorama responde uma pergunta só — *como está cada cliente este mês e quem está travado?*

## A tela
- **Uma linha por cliente, uma coluna por etapa do mês:** Linha editorial · Roteiros · Gravação · Vídeos · Design · Aprovação · Publicações.
- **Cada célula** mostra feito/total, uma barra de progresso e uma palavra de contexto ("3 prontos", "dia 14/10", "4 atrasados"), numa de cinco cores:
  - cinza — não começou;
  - roxo — em andamento;
  - âmbar — pede atenção (gravação sem data, aprovação aguardando o cliente);
  - vermelho — atrasado (o prazo ou a data já passou);
  - verde — concluído.
- **Cada cliente** recebe um estado geral e um percentual. A faixa colorida na borda esquerda e o texto abaixo do nome dizem qual.
- **Topo:** um anel com o andamento médio do mês e cinco contadores — com atraso, pedem atenção, em andamento, em dia, sem movimento. **Clicar num contador filtra a lista.**
- **Navegação por mês** (setas e "Este mês"), **busca por cliente** e ordem "Quem precisa primeiro" (atrasados no topo) ou A–Z.
- **Clicar num cliente** abre a página dele.
- **No celular** cada cliente vira um cartão, e as etapas que não começaram não ocupam espaço.

## Animações
- o anel se desenha e os números sobem contando;
- os contadores do topo sobem em sequência;
- as linhas dos clientes entram em cascata e as barras de progresso crescem logo depois;
- ao passar o mouse, a linha levanta com um brilho na cor do estado e a seta desliza;
- trocar de mês faz a lista entrar pelo lado para onde você foi, e o nome do mês "vira";
- o ponto de quem está atrasado pulsa; o fundo do topo tem duas luzes que se movem devagar.

Tudo com posição, escala e transparência. No modo leve e com "reduzir movimento" a tela nasce pronta, sem animação.

## Regras de cada coluna
| Coluna | De onde vem | "Atrasado" quando |
|---|---|---|
| Linha | a linha editorial do cliente naquele mês | — (mostra aprovada ou conteúdos estruturados) |
| Roteiros | roteiros das gravações daquele mês de referência | — |
| Gravação | gravações pelo mês de referência; canceladas não contam | a data marcada já passou e não foi gravada |
| Vídeos | demandas pela competência; descartadas não contam | prazo vencido e não entregue |
| Design | peças da linha do mês (ou sem linha, com prazo no mês) | prazo vencido e não finalizada |
| Aprovação | o que está aguardando o cliente **agora** | — (sempre "pede atenção") |
| Publicações | conteúdos com data de postagem no mês | a data passou e não está publicado |

## Menu
- O item passou a se chamar **Panorama** e saiu do grupo Principal: agora abre o grupo **Operação**. No Principal fica só o Painel.
- Duas exceções, para ninguém ficar sem "casa": o **designer** (para ele esse endereço é a Central de Design, que não mudou) e quem **não tem Painel** (aí o Panorama continua no Principal).
- Atalhos que diziam "Central B7" (voltar ao início em Lixeira, Arquivados, Aprovações, Status semanal, Linhas) agora dizem "Início". Em Configurações → Tela inicial, a opção se chama "Panorama".
- O endereço da tela continua o mesmo, então permissões e a tela inicial que cada um escolheu seguem valendo.

## Banco de dados
**`migration_panorama.sql` (aplicada):** uma função nova, `panorama_mes`, só de leitura, que devolve tudo numa ida ao banco.
- Roda com as permissões de **quem chama**: não abre nada novo. Cada pessoa só recebe o que as regras de acesso já a deixam ler em cada módulo.
- **Nenhuma regra de acesso foi criada ou alterada.** Nenhuma tabela mudou.
- Para desfazer: `drop function public.panorama_mes(int, int);`

A antiga Central (`js/central.js`) ficou no projeto, sem uso, como reserva.

## Arquivos alterados
`js/panorama.js` (novo), `styles/panorama.css` (novo), `migration_panorama.sql` (novo), `js/database.js`, `js/app.js`, `js/nav.js`, `js/dashboard.js`, `js/aprovacoes.js`, `js/conteudo.js`, `js/semana.js`, `index.html`, `sw.js`, `js/auth.js` (versão).

## Testes executados
**Banco** (sessão simulada, sem gravar nada):
- como administrador: 23 clientes; em outubro, 9 com linha, 7 com gravação, 6 com vídeo, 7 com design, 10 com publicações, 1 aprovação pendente;
- como designer: os mesmos 23 clientes, mas **nenhum dado de vídeo** — as regras de acesso valem dentro da função.

**Tela** (app local, dados reais, estilos sem cache):
- computador (1440×1000) e celular (412×892), conferidos em captura;
- os contadores batem com a lista: 6 com atraso, 2 pedem atenção, 3 em andamento, 2 em dia, 10 sem movimento = 23;
- trocar para setembro e voltar com "Este mês"; filtrar por "com atraso" (6 clientes); buscar "mais" (acha Mais Sorrisos); limpar (23);
- menu: Principal só com Painel; Panorama no início de Operação;
- navegar Panorama → Painel → Panorama → Clientes funciona.

**Dois defeitos meus achados e corrigidos antes de publicar:**
- os nomes de estilo do Panorama **colidiam com os do Painel** (as duas telas usavam o mesmo prefixo) e iam bagunçar as duas. Renomeei todos os do Panorama e conferi que não sobrou nenhum;
- linha editorial aprovada aparecia como "0/22"; agora mostra "22 · aprovada".

## Não testado
- **As animações em movimento** — vi o estado final, não o movimento.
- Tema escuro.
- Conta de coordenador e conta sem Painel (a regra do menu para elas foi escrita, não exercitada).
- Clientes com serviço pausado ou encerrado: hoje todos estão ativos, então não vi como aparecem (entram na lista normalmente).
- Mês futuro sem nada lançado.

## Pontos para você decidir depois
- **Clicar numa célula** hoje não faz nada próprio (o clique é da linha inteira e abre o cliente). Dá para cada célula abrir a tela daquela etapa já filtrada.
- **10 clientes "sem movimento"** em outubro: se parte deles não deveria aparecer (cliente só de design, por exemplo), dá para esconder quem não tem nada no mês.
