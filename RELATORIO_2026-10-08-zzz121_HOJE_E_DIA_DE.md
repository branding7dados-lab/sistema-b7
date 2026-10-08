# Relatório — "Hoje é dia de…": aviso diário de oportunidades e destaque no Painel

**Versão:** `2026-10-08-zzz121` · **Cache:** `roteiros-b7-v326`
**Pedido:** o sistema avisar (push e notificação) o que tem de oportunidade no dia, e mostrar isso no Painel — "hoje é dia de…".

## O aviso
- **Quando:** todo dia às 8h05, na mesma rodada do resumo diário. **Só sai quando há alguma data começando naquele dia.** Inclui fim de semana.
- **Como chega:** uma notificação no sino e um push, pelo caminho de sempre. Título "Hoje é dia de…"; o texto lista as datas ("Dia das Crianças e Nossa Senhora Aparecida." ou "A, B e mais 2 oportunidades."). Tocar abre a tela de Oportunidades.
- **Quem recebe:** quem tem o módulo Oportunidades — hoje, os dois administradores e o coordenador. Designer e videomaker sem o módulo não recebem.
- **Como desligar:** Notificações → grupo "Oportunidades" → "Hoje é dia de…". Desligado, o aviso continua no sino, mas não manda push nem toca som. Vem ligado.
- **Nunca duplica:** um aviso por dia.

## O que entra no aviso
- Oportunidade ativa e já revisada.
- Que **começa** hoje: data fixa, regra ("2º domingo de maio", último dia do mês) ou data vinda das fontes. Campanha de mês inteiro (Outubro Rosa) só entra no dia 1º.
- Nacional ou internacional. Estadual ou municipal só quando algum cliente está naquele estado ou cidade.
- Ordem: interesse geral, depois nacionais, depois internacionais.

**Diferença para o Painel:** o aviso não ordena por relevância para os clientes (essa conta existe só na tela); o Painel ordena. A lista de datas é a mesma; a ordem pode mudar.

## No Painel
Um cartão no cabeçalho, ao lado do relógio, em **todos os Painéis** (vídeo, coordenação, design e o composto), para quem tem o módulo Oportunidades:
- **Tem data hoje:** "Hoje é dia de — Dia Mundial da Visão · combina com 3 clientes". Com mais de uma, mostra a mais relevante e "e mais N datas".
- **Não tem:** "Próxima data — Dia das Crianças · segunda, 12/10".
- Clicar abre Oportunidades. No celular ocupa a largura inteira.

## Banco de dados
`migration_oportunidades_hoje.sql` (aplicada):
- duas funções novas, internas (não chamáveis pelo app): a lista do dia e o aviso;
- a rodada das 8h ganhou uma linha;
- a lista de preferências aceitas ganhou "oportunidades".

Nenhuma tabela, coluna ou regra de acesso nova. Nenhum agendamento novo.

## Um aviso real saiu durante o teste
Ao conferir a função, **ela disparou de verdade**: Kevin, Kaique e Mateus receberam às 15h25 de hoje "Hoje é dia de… Dia Mundial da Visão." Eu tinha visto numa consulta anterior que hoje não havia data e rodei sem proteção; essa consulta não cobria datas por regra (hoje é a 2ª quinta de outubro). O conteúdo é verdadeiro — é o aviso de hoje, só que fora de hora. Não apaguei as três notificações. Amanhã o aviso sai normalmente às 8h05.

## Arquivos alterados
`migration_oportunidades_hoje.sql` (novo), `js/painel.js`, `styles/painel.css`, `js/notificacoes.js`, `sw.js`, `js/auth.js` (versão).

## Testes executados
**Banco:**
- lista do dia conferida em 10 datas, incluindo regras: 2ª quinta de outubro (Dia Mundial da Visão), 2º domingo de maio (Dia das Mães), último dia de fevereiro (Doenças Raras), dia 1º (Outubro Rosa entra), feriado estadual de MS em 11/10 (fica de fora: nenhum cliente lá);
- destinatários: Kevin, Kaique e Mateus;
- o disparo real acima: três notificações criadas, com título, texto e link corretos.

**Tela** (app local, **com os seus dados reais** — a sessão voltou):
- o cartão mostrou "Hoje é dia de · Dia Mundial da Visão · combina com 3 clientes";
- o Painel novo (zzz120) com dados reais: 6 indicadores, 7 blocos sem erro, 6 entregas, 5 clientes no bloco da agência, e em 1920×1080 continua cabendo sem rolar com o cartão novo.

## Não testado
- **O push chegando no aparelho** — a notificação foi criada no banco; se o push tocou no seu celular, só você sabe.
- A rodada automática das 8h05 (a primeira é amanhã).
- O cartão nos casos "mais de uma data" e "próxima data" (hoje só há uma data); o cartão nos Painéis de coordenação, design e composto; no celular.
- O interruptor novo nas preferências (escrito, não cliquei).
- Tema escuro.

## Para você decidir
- **Nomes em inglês:** várias datas internacionais vêm das fontes em inglês ("World Post Day"). Amanhã o aviso será "World Migratory Bird Day [UNEP] e World Post Day." Dá para o aviso considerar só as datas relevantes para algum cliente ou de interesse geral, o que reduz bastante esse ruído — mas aí haverá dias sem aviso.
- **Quem recebe:** hoje é quem tem o módulo. Se quiser a equipe inteira, é uma linha.
