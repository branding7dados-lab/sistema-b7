# Relatório — O que faltava + IA que age com confirmação

**Versão:** `2026-10-07-zzz89` · **Cache:** `roteiros-b7-v294`
**Pedido:** "faz tudo que falta e IA que age com confirmação".

| Item | Situação |
|---|---|
| Registro de quem mudou nome/código da demanda de vídeo | Feito |
| Teleprompter por função | Feito |
| IA lendo mais (meses antigos, texto de roteiros) | Feito em parte |
| IA que age com confirmação | Feito (uma ação: criar demanda de vídeo) |
| **Trava de módulos no banco** | **NÃO feito — parei e explico abaixo** |

## 1. Histórico de nome e código — feito
Trocar o nome ou o código de uma demanda de vídeo agora aparece no histórico dela: quem alterou e de quê para quê. Só registra quando muda de verdade; mudar só o prazo não gera esse registro.
Banco: `migration_video_editar_registra.sql` (aplicada). Permissões iguais às de antes.

## 2. Teleprompter por função — feito
Abrir o teleprompter (pelo editor de roteiros ou pela gravação) agora é só para **Videomaker, Coordenador e Administrador**. Para os outros, o botão some; se alguém chegar por outro caminho, aparece o aviso e não abre. É regra de tela: o teleprompter só lê o roteiro, e quem já lê roteiro continua lendo.

## 3. IA lendo mais — feito em parte
- **Vídeos entregues nos últimos 6 meses de referência** (antes eram 2), só a contagem por mês.
- **Com cliente em foco:** o texto das cenas dos 3 roteiros mais recentes dele, resumido, para a IA comentar e sugerir no mesmo tom.
- **Não entrou:** comentários e legendas completas. Aumentariam bastante o tamanho de cada pergunta e o gasto da cota gratuita.

## 4. IA que age com confirmação — feito, com uma ação
**O que dá para pedir:** criar uma **demanda de edição de vídeo** ("cria uma demanda para a Mais Sorrisos, depoimento de paciente, prazo sexta").

**Como funciona:**
1. A IA não grava nada. Ela responde com uma proposta.
2. O servidor confere a proposta: o cliente tem de existir e ser visível para a pessoa, precisa de título, e a data tem de ser válida. Proposta torta é descartada.
3. Aparece um **cartão na conversa** com cliente, título e prazo, e os botões "Cancelar" e "Criar demanda".
4. Só ao tocar em "Criar demanda" o B7 chama **a mesma função do banco** que a tela "Nova demanda" usa, com a sessão e as permissões da pessoa. A demanda nasce como Pendente, no mês de referência atual, sem responsável.

**Quem pode:** só quem já pode criar demanda de vídeo (administrador, coordenador, videomaker). Para os outros, a IA nem recebe a instrução de propor — e, se propusesse, o banco recusaria.

**Limites:** uma ação só nesta versão. A IA não define responsável, pacote nem gravação. O cartão vale enquanto a conversa está aberta (não fica guardado no histórico).

## 5. Trava de módulos no banco — NÃO feito
Ao auditar para implementar, encontrei um conflito que precisa de decisão do Kevin antes de eu mexer em regra do banco (RLS):

- **Módulo é tela, não dado.** As telas do B7 leem dados umas das outras: o Calendário mostra gravações, vídeo, design e oportunidades; o Design lê a Linha editorial; os Painéis e o chat leem de vários lugares.
- **Páginas abertas a toda a equipe.** O detalhe de um cliente e o de uma gravação abrem para qualquer pessoa da equipe, com ou sem o módulo (ficou assim na zzz68, para não tirar o que o Designer já via).
- **Consequência:** se o banco negar "gravações" a quem não tem o módulo Gravações, o Calendário e a página do cliente dessa pessoa quebram ou somem com itens. Se eu liberar por "qualquer módulo que use o dado", quem tem Calendário continua lendo quase tudo, e a trava vira enfeite.

Fazer isso às cegas, com cinco pessoas usando o sistema e sem eu conseguir testar cada tela com conta real, tem risco alto de quebrar o trabalho de alguém. Por isso parei.

**A decisão que preciso:**
- **(A) Trava forte.** Sem o módulo, a pessoa não lê aquele dado em lugar nenhum: o Calendário e a página do cliente passam a esconder o que ela não pode ver. Exige ajustar essas telas junto; é um pacote grande, feito domínio por domínio.
- **(B) Trava só onde é claro.** Travar no banco apenas os domínios que não aparecem em outras telas (candidatos: Status semanal, Produção/quadro, Aprovações, Oportunidades), depois de eu conferir um por um. Menor e mais seguro, mas parcial.
- **(C) Deixar como está.** Módulo continua sendo controle de tela. Para uma equipe interna pequena e de confiança, é uma escolha razoável.

Minha recomendação é a **(B)**.

## Arquivos
Novo: `migration_video_editar_registra.sql`.
Alterados: `supabase/functions/_shared/ia/chat.ts` e `supabase/functions/b7-ia/index.ts` (publicada), `js/ia.js`, `js/ia-chat.js`, `styles/ia-chat.css`, `js/video.js`, `js/teleprompter.js`, `js/editor.js`, `js/gravacao.js`, `js/auth.js`, `sw.js`.

## Testes executados
**Banco** (transação desfeita ao final): criar demanda só com cliente, título e prazo funciona (nasce Pendente, mês atual); trocar nome e código gera um registro com o autor e o "de → para"; repetir sem mudar e mudar só o prazo não geram registro; designer não consegue criar demanda.

**Tela** (app local, IA e banco simulados): o cartão aparece com os dados; nada é criado antes do clique; erro do banco aparece no cartão e dá para tentar de novo; depois de criar, os botões somem; "Cancelar" não cria nada; texto com HTML aparece como texto. Teleprompter: administrador, coordenador e videomaker abrem; designer não.

**Servidor:** `b7-ia` publicada e respondendo.

## Não testado
- **A IA propondo de verdade.** Não vi o modelo gerar a proposta no formato combinado; se ele errar o formato, a resposta vem sem cartão. É o primeiro teste a fazer: pedir no chat uma demanda para um cliente real e conferir o cartão antes de confirmar.
- A leitura do texto dos roteiros com cliente em foco, com dados reais.
- O histórico e o teleprompter com conta real.
