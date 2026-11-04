# Relatório — Painel de TV: visuais, recado, saudação, mural, clima, tamanho e a tela "só a logo"

**Versão:** `2026-10-09-zzz138` · **Cache:** `roteiros-b7-v343`
**Pedido:** da lista de melhorias da TV, "8, 9, 10, 22 (4 visuais), 23, 24 e quero uma que tenha só a logo da B7, ou que tenha como eu personalizar, 15".

Tudo se ajusta em **Configurações → Admin → Painel de TV → Configurar**. No fim da janela há links "Para ver como fica".

## Só a logo (o pedido novo)
Um terceiro modo, além do painel e da animação: **a marca parada na tela**, com respiração leve e um reflexo que passa só por cima do desenho da logo.
- **Personalizável:** dá para **enviar a sua própria imagem** no lugar da logo da B7 (PNG com fundo transparente fica melhor), escrever uma **frase** embaixo e ligar ou desligar o **relógio**.
- Segue o visual escolhido (no claro, usa a logo colorida; nos escuros, a branca).
- Não consulta dado nenhum da agência.
- Abre também por **Configurações → Geral → Painel de TV → "Abrir só a logo"**, só naquele aparelho.

## 22 · Quatro visuais
- **Cinema** — o atual: escuro, com luzes magenta e violeta e brilho.
- **Aurora** — escuro, em verde-água e violeta.
- **Claro** — fundo claro com cartões brancos, para sala iluminada (onde tela escura reflete).
- **Minimalista** — preto e branco, linhas finas, sem luzes, grão nem brilho.

Vale para o painel, a agenda, o mural, a saudação e a tela da logo.

## 10 · Fundo que muda
Três opções: **fixo**; **com o horário** (tons quentes de manhã, o tom da casa à tarde, avermelhado no fim do dia, frio à noite); ou **com a situação** (avermelhado com cliente em atraso, âmbar com cliente pedindo atenção, verde com tudo em dia). No minimalista não tem efeito, porque ele não tem luzes — a janela avisa.

## 24 · Tamanho
Menor (85%), Normal, Maior (115%) e Bem maior (130%). Aumentar deixa tudo maior e cabe menos por tela: a lista de clientes passa para uma coluna e roda em mais páginas, e as gravações que não couberem saem do fim do bloco.

## 8 · Recado na TV
Você escreve uma frase (até 200 caracteres) e escolhe: **em destaque no alto**, numa faixa grande, ou **faixa correndo embaixo**. Em branco, não aparece.

## 9 · Saudação por horário
Ligada, a TV mostra por 14 segundos, por cima do painel:
- às **8h**, "**Bom dia, equipe**", com a data relevante do dia, gravações de hoje, publicações para hoje e clientes com atraso;
- às **18h**, o "**Resumo do dia**": publicações no ar, gravações do dia, andamento do mês e clientes com atraso.

Uma vez por dia em cada TV. Só aparece se a TV estiver ligada naquela hora (janela de 10 minutos).

**O que o resumo não tem:** "entregas do dia" (vídeos e peças entregues hoje). O painel não lê esse dado hoje; usei o que ele já tem. Posso incluir depois.

## 23 · Mural de hoje
Uma tela a mais no rodízio: as **logos dos clientes com publicação ou gravação hoje**, em quadros grandes, com "gravação às 14h" e "1 de 2 publicações". Só entra no rodízio em dia que tem alguém.

Interpretei "entrega hoje" como publicação marcada para hoje ou gravação hoje. Com "Nome dos clientes" desligado, aparecem só as logos.

## 15 · Clima
A temperatura e o tempo da cidade, ao lado da data ("36° céu limpo · Goiânia"). Você busca a cidade pelo nome na janela e escolhe.

**Serviço externo:** vem do **Open-Meteo**, aberto e sem chave. Para isso liberei dois endereços dele na regra de segurança do navegador (a lista de sites com que o B7 pode falar). **Só as coordenadas da cidade saem daqui** — nenhum dado seu, da equipe ou de cliente. Se o serviço cair, o clima simplesmente não aparece.

## Banco de dados
A função que grava a configuração da TV passou a aceitar as chaves novas, com validação (visual, fundo e modo só nos valores previstos; tamanho entre 70 e 150; imagem só do espaço de logos do próprio sistema; cidade com coordenadas válidas). Só administrador grava. Nenhuma tabela ou regra de acesso mudou.

A imagem personalizada vai para o **espaço público de logos** que já existe (o das logos de cliente), numa pasta própria. É público como as logos: quem tiver o endereço abre a imagem.

## Arquivos alterados
`js/tv.js`, `styles/tv.css`, `js/dashboard.js` (entrada "Abrir só a logo"), `index.html` (liberação do Open-Meteo), `migration_admin_tv_sessoes_ia.sql` (nota), `sw.js`, `js/auth.js` (versão).

## Testes executados
**Banco, com a sua conta e a de um coordenador, simulado e desfeito:** gravou todas as chaves novas; recusou imagem de fora do sistema, visual desconhecido, tamanho 300 e cidade com coordenada impossível; limpou imagem e cidade; o coordenador foi barrado.

**Tela, na aba local sem login, com dados de mentira (20 clientes), em 1920×1080:**
- **visuais:** Cinema, Aurora, Claro e Minimalista conferidos em captura;
- **recado:** em destaque (captura) e em faixa correndo (captura); um texto com `<b>` saiu como texto;
- **fundo:** "com a situação" ficou avermelhado com clientes em atraso; "com o horário" aplicou o tom da tarde;
- **tamanho:** 115% passou a lista para uma coluna em 3 páginas, sem nome cortado; 85% coube tudo; com o recado ocupando espaço, as gravações que não cabiam saíram;
- **mural:** 8 clientes, com gravação e publicações (captura); o rodízio painel ↔ mural rodou sozinho;
- **saudação:** "Bom dia, equipe" (captura) e "Resumo do dia" com os números certos dos dados de teste;
- **só a logo:** com a logo padrão, frase e relógio (captura), e com imagem trocada, sem frase nem relógio, no visual claro (captura);
- **clima:** chamada **real** ao Open-Meteo: "36° céu limpo · Goiânia";
- **janela:** as seções aparecem e somem conforme o modo; ligar o clima sem cidade é barrado; a busca **real** achou "Goiânia, Goiás, Brasil"; o envio de imagem chamou o envio com o arquivo; salvar mandou tudo certo.
- Erros achados e corrigidos: bloco de gravações cortando com o recado ligado; nomes de clientes espremidos no tamanho maior; a temperatura herdando o tamanho do relógio; um retângulo aparecendo em volta da logo.

## Não testado
- **Numa TV de verdade** — continua sendo o teste que falta para tudo isto.
- **Enviar uma imagem de verdade** (o envio foi simulado; usa a mesma função das logos de cliente).
- A saudação disparando sozinha às 8h e às 18h (testei pelo link de prévia).
- O visual novo em 1366×768 e no celular (a janela de configuração eu vi em 1366×768).
- Com a sua conta e os dados reais.
- Horas seguidas ligado.

## Rastros do teste
Nenhum registro criado ou alterado no banco. Duas consultas ao Open-Meteo (clima e busca de cidade). Nenhuma chamada de IA.
