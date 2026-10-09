# Relatório — Assistente: várias demandas de uma vez, com código, responsável e gravação

**Versão:** `2026-10-09-zzz135` · **Cache:** `roteiros-b7-v340`
**Pedido:** "quando eu peço pra criar várias demandas, ele cria só uma; a IA tem que entender meu comando e fazer." O exemplo: *"Crie 7 demandas para C6 Farma, foram 7 memes, coloca código do 8 ao 14. O responsável foi Kaique, e foi feita do dia da gravação de outubro."*

## Por que saiu só uma
Três coisas, juntas:
1. **O assistente tinha de escrever uma linha por demanda.** O modelo (pequeno) escreveu só a primeira das sete. Não há como eu ver a resposta crua daquela conversa, mas o resultado é o padrão dele: começa a lista e para.
2. **Havia um teto de 5 propostas por resposta.** Mesmo que ele escrevesse as sete, só cinco virariam cartão.
3. **O cartão de vídeo só conhecia cliente, título e prazo.** Código, responsável e gravação não tinham onde entrar, então eram ignorados.

## O que mudou
- **Série numerada em uma linha só.** Para "N demandas, do 8 ao 14", o assistente agora escreve uma única instrução com o intervalo, e **o servidor** abre um cartão para cada número. Não depende mais de o modelo repetir a linha sete vezes.
- **Teto subiu de 5 para 20** propostas por resposta.
- **Demanda de vídeo aceita:**
  - **código** (na série, o número de cada uma: 08, 09 … 14);
  - **responsável**: o nome que você disser é procurado na equipe (nome inteiro ou primeiro nome), e precisa bater com uma pessoa só;
  - **gravação**: "gravação de outubro" vira a gravação daquele cliente naquele mês, e a demanda nasce ligada a ela e com o mês certo.
- **"Criar todas (7)"**: com duas ou mais propostas, aparece um botão que cria todas em sequência. Continua valendo criar ou cancelar uma por uma.
- A regra para o modelo ficou explícita: nunca propor menos registros do que a pessoa pediu.

**Quando algo não bate, ele avisa em vez de inventar:**
- responsável não encontrado (ou dois com o mesmo nome): as demandas ficam sem responsável e a resposta diz isso;
- cliente sem gravação naquele mês: ficam sem gravação ligada, e a resposta diz isso;
- mais de uma gravação no mês: usa a mais recente e diz qual foi.

**Nada é criado sozinho.** Continua valendo: ele só propõe, e você confirma (agora com um toque para todas).

## Efeito colateral para você saber
Demanda criada **com responsável** dispara o aviso de "demanda atribuída" para a pessoa, como já acontece na tela de Edição de vídeo. Sete demandas para o Kaique = sete avisos para ele.

## Banco de dados
Nada mudou no banco. A criação usa a mesma função da tela de Edição de vídeo.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts` (função publicada), `js/ia-chat.js`, `styles/ia-chat.css`, `js/novidades.js`, `sw.js`, `js/auth.js` (versão).

## Testes executados
- **A abertura da série** (o mesmo código do servidor, rodado à parte): "Meme {n}, de 8 a 14" virou sete registros, "Meme 08 #08" … "Meme 14 #14", mantendo responsável e mês; sem {n} no título, o número vai no fim; série maior que 20 para em 20.
- **Conferi no banco** que "Kaique" bate com uma pessoa só da equipe (Kaique Viana) e que a C6 Farma tem uma gravação em outubro ("Gravações de Outubro").
- **Tela, com conta e IA de mentira:** os 7 cartões apareceram com Cliente, Título, Código, Responsável, Gravação e Prazo; "Criar todas (7)" chamou a criação 7 vezes com os dados certos; uma falha simulada ficou com o erro no próprio cartão e as outras 6 foram criadas ("6 de 7 criados").
- Função publicada e respondendo (sem sessão devolve 401, como antes).

## Não testado
- **O pedido de verdade, com a sua conta.** Eu não consigo chamar a IA sem sessão. Falta confirmar que o modelo escreve a linha de série como instruído. Se ele ainda devolver uma só, me mande o print: o próximo passo seria o servidor entender a quantidade direto do seu texto, sem depender do modelo.
- Criar as demandas de verdade (a criação é a mesma função da tela, mas não toquei em dado real).
- Séries de design, gravação e conteúdo (a abertura vale para todos os tipos; testei com vídeo).
