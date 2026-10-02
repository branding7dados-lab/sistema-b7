# Relatório 2026-10-02-z — IA na Linha Editorial: visual novo e "Montar linha com IA"

Edge Function `b7-ia` (**publicada**) e front-end. **Nenhuma migration.** Mesmo provedor, mesma chave.

## O que você pediu

1. Os botões de IA da Linha Editorial estavam pequenos, feios e estranhos.
2. A IA deveria sugerir a linha editorial inteira: ao criar uma do zero, dizer o que fazer com aquele cliente.

## Auditoria

- Abri a tela como você vê (tema escuro). Ao lado de cada campo havia uma pílula minúscula escrita "IA", e os botões de ação ("Revisar linha editorial", "Sugerir pilares", "Sugerir conteúdos") estavam soltos em pontos diferentes da tela.
- A IA já sugeria pilares e conteúdos, mas **só depois** de alguém escrever a estratégia. Numa linha em branco ela respondia "preencha a estratégia" — ou seja, não ajudava justamente no começo.
- O cadastro do cliente (Inteligência e produtos) quase não era usado: a IA só recebia nicho, descrição e público principal.

## 1. Visual novo da IA

- **Um desenho só para tudo que é IA** (linha editorial, roteiro, status semanal, resumo do mês): botão com contorno em degradê da marca, estrela em magenta e texto legível. A ação principal de cada bloco vem preenchida com o degradê, como os botões principais do sistema.
- **Bloco "IA da linha editorial" no topo de cada aba**, com as ações daquela aba juntas:
  - Visão geral: Montar linha com IA (linha em branco), Revisar linha editorial, Sugerir conteúdos.
  - Estratégia: Sugerir estratégia, Revisar estratégia.
  - Criativos: Sugerir conteúdos, Revisar linha editorial.
- **Botão de cada campo:** saiu a pílula "IA"; agora diz o que faz — "Escrever com IA" (campo vazio) ou "Melhorar com IA" (campo com texto) — com 34 px de altura (40 px no celular).

## 2. Montar linha com IA (novo)

Um assistente em três etapas, aberto pelo bloco da Visão geral de uma linha em branco:

1. **Estratégia** — a IA propõe objetivo do período, posicionamento, tom de voz, proposta única de valor e percepção desejada.
2. **Pilares** — propõe os tipos de pilar que fazem sentido, com objetivo e funil.
3. **Conteúdos** — propõe 8 ideias com formato, pilar, ideia e CTA.

Como funciona:

- Antes de começar, dá para escrever **o que este mês precisa** (opcional): "mês de lançamento do plano anual", "evitar promoção". Vale para as três etapas.
- Em cada etapa você vê a proposta, marca o que quer e só isso é gravado. Dá para **gerar outra**, **pular a etapa** ou parar no meio.
- Campo da estratégia que já tem texto vem **desmarcado**, com aviso: substituir é escolha sua.
- Os pilares entram **sem percentual**: o peso de cada um continua sendo decisão da equipe.
- "Sugerir estratégia", na aba Estratégia, é a primeira etapa sozinha.

De onde a IA tira a proposta (lido no servidor, com a sua sessão):

- **Inteligência do cliente:** nicho, descrição, público, dores, desejos e objeções do público, tom de voz, o que a marca evita dizer, posicionamento, proposta de valor e percepção.
- **Produtos e serviços** do cliente (nome, descrição, benefícios, diferenciais). **Preço não vai.**
- **Linha editorial anterior do mesmo cliente** (estratégia e pilares), para dar continuidade.
- O que você escreveu em "o que este mês precisa".

Sem nenhuma dessas informações, a IA não é chamada e a tela pede para preencher a Inteligência ou escrever o direcionamento.

As sugestões de pilares e de conteúdos que já existiam também passaram a receber o cadastro do cliente, então saem menos genéricas.

## Regras mantidas

- Nada é gerado sozinho; nada é gravado sem você marcar e confirmar.
- Só dados do mesmo cliente. Nenhuma policy de RLS criada ou alterada.
- Designer não vê os botões e o servidor recusa.
- A IA não cria percentuais, datas de postagem nem status.

## Mudança de regra que vale registrar

O arquivo da IA da linha dizia que "outra linha / outro mês" nunca ia para o modelo. Para a proposta de estratégia isso mudou: a linha **anterior do mesmo cliente** entra como referência de continuidade. Nenhum dado de outro cliente entra.

## Arquivos

- Servidor: `supabase/functions/_shared/ia/linha.ts` (operação `sugerir_estrategia`, cadastro do cliente nas sugestões).
- Telas: `js/ia-linha.js` (assistente, bloco por aba, botão dos campos), `js/linha.js` (bloco nas abas, gravação da estratégia), `styles/editor.css`, `styles/linha.css`.
- `IA.md`, `sw.js`, `js/auth.js` (versão `2026-10-02-z`).

## Testes executados

**Automatizados:** nenhum.

**Servidor publicado, IA de verdade, dados reais, sessão aberta no navegador daqui** (só leitura, nada aplicado):

- `sugerir_estrategia` numa linha real de outubro: cinco campos específicos do cliente em 9 s (falou do delivery, do programa de fidelidade e dos bastidores da fábrica, que estão no cadastro).
- A mesma linha com o direcionamento "mês focado em campanha de fim de ano": a proposta incorporou o pedido, em 5 s.

**Página local com a tela de verdade da Linha Editorial e respostas simuladas:**

- Linha em branco: bloco com "Montar linha com IA"; assistente completo — direcionamento, estratégia (desmarquei um campo: gravou só 4), pilares (3 criados, sem percentual), conteúdos (8 criados); aviso final "Linha montada: estratégia aplicada, 3 pilares, 8 conteúdos"; a tela atualizou a contagem.
- Linha já preenchida: "Sugerir estratégia" trouxe os campos já escritos desmarcados e com aviso; aplicou só os 3 vazios e não tocou nos outros.
- Sem base: mensagem pedindo a Inteligência ou o direcionamento, sem travar.
- Visual conferido em captura de tela (tema escuro): bloco, botões dos campos e janela do assistente.

**Não testado:**

- O assistente inteiro no site publicado gravando numa linha real (não criei linha de teste na produção).
- Uma linha realmente em branco com a IA de verdade: todas as linhas atuais já têm estratégia, então a prova real foi feita numa linha preenchida.
- Tema claro e celular.

## Limitações

- A qualidade da proposta depende do cadastro: cliente sem Inteligência preenchida recebe proposta genérica ou o aviso de falta de base.
- São três chamadas de IA para montar a linha inteira (uma por etapa), de 5 a 15 s cada.
- 8 conteúdos por rodada. Para chegar à meta do mês, use "Sugerir conteúdos" de novo: a IA evita repetir o que já está na linha.
- Os pilares entram com 0%. A soma fica "faltam 100%" até a equipe distribuir os pesos.
- Modelo pequeno e gratuito: é ponto de partida, não estratégia pronta.
