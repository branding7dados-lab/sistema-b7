# Sistema B7 — tudo que foi feito até agora

De 09/09/2026 a 14/09/2026. Mais de 60 builds — este relatório agrupa
por assunto em vez de listar build por build; o histórico completo,
com todos os detalhes técnicos, está em `CORRECOES_2026-09-09.md`
(um build por seção, na ordem em que aconteceram).

## 09/09 — Ponto de partida: corrigir o que estava quebrado

Antes de qualquer coisa nova, uma auditoria completa do sistema
(`BUGS_E_PENDENCIAS.md`) encontrou 29 problemas reais, 6 deles
funcionalidade que simplesmente não funcionava:

- "Enviar para aprovação" não fazia nada (bug de código).
- Decisão do cliente por cena sempre falhava.
- Central de Produção filtrada por cliente zerava os roteiros.
- Links de referência da linha editorial somiam ao recarregar.
- Coordenador não conseguia abrir nenhuma gravação.
- Limpar um campo de data ou número travava o autosave pra sempre.

Mais uma leva de brechas de segurança (cliente conseguia reescrever
material já aprovado via API, storage de logo aberto pra qualquer um
com a chave pública, XSS no Kanban, comentário podia ser assinado com
autor forjado) e o Portal do Cliente, que existia mas não tinha
nenhuma forma de liberar material pra ele ver. Tudo isso foi corrigido
numa rodada só (build `-b`), testada contra um Postgres real com a
cadeia completa de migrations, revisão independente por um segundo
agente, e o corte do RLS simulado de ponta a ponta.

Nos dias seguintes (`-c`, `-f`): foto de perfil por upload (em vez de
link), e o bug do `config.js` ficando preso em cache do navegador
depois de uma troca de projeto Supabase.

## 09/09–09/10 — Aprovações v2, Linha Editorial completa, tempo real

- **Aprovações v2**: fluxo transacional, com eventos de domínio,
  notificações e o Kanban reagindo sozinho quando uma aprovação muda
  (ver `APROVACOES.md`). Mais tarde ganhou "Excluir aprovação" como
  anulação auditada (nunca um apagar de verdade).
- **Linha editorial, pilares, calendário, apresentação**: a Linha
  Editorial virou o módulo completo que é hoje — conteúdos com
  slides/frames, pilares de conteúdo, calendário Postagem × Gravação,
  apresentação 16:9.
- **Notificações, push, aprovações em tempo real, presença**: sino de
  notificação, push no navegador/celular, indicador de quem está
  online.
- **Responsividade e skeletons**: telas de carregamento decentes em
  vez de spinner de tela cheia; celular funcionando de verdade.

## 09/10 — Nasce o B7 Design

O maior módulo novo do sistema. Começou como "Central de Design"
(build `-d`): peça → versão → arquivo, ligada ao Kanban existente (não
duplica quadro), com papel próprio "Designer" em Usuários e acessos.
Nos dias seguintes ganhou refino operacional grande (build `-h`):
conclusão formal de uma peça, versionamento de verdade, e a Central do
Designer virando a tela inicial de quem tem esse papel.

## 09/11 — Seis rodadas de refino de UX do Design

Depois de duas especificações grandes do Yury (uma de auditoria, outra
de 56 seções pedindo redesenho), o trabalho virou um plano de seis
rodadas (`PLANO_UX_DESIGN_RESTANTE.md`):

1. **Central de Design** redesenhada.
2. **Navegador de peças + página de demanda.**
3. **Design Piece Workspace** (Card e Capa de Reel): tela quase cheia
   pra trabalhar numa peça.
4. **Navegador de Carrossel e Stories**: slide/frame em destaque um de
   cada vez, em vez de lista empilhada.
5. **Miniatura otimizada** (thumbnail gerada no navegador, sem custo
   de servidor) + **Linha Editorial do Designer como componente
   próprio** (parar de mandar o designer pra fora do Design).
6. **Notificações, polimento e auditoria final** de performance e
   mobile.

No meio dessas rodadas, uma leva de bugs pontuais reportados com print
de tela: rótulo errado na barra lateral pro Designer, Designer caindo
numa tela de Coordenador ao ver o contexto da linha, gráfico de
Pilares de conteúdo com barra "bugada" (corrigido de vez trocando para
uma única barra com marca de meta), avatar gigante vazando do cartão
na aba Equipe, arrastar sequestrando a seleção de texto no roteiro e
no Carrossel, "Nome do pilar" virando "Tipo de pilar" com lista
fechada.

Depois das seis rodadas veio uma segunda leva de refino operacional:
**File Review 2.0** (`-ah`/`-ai`): prévia, arte por slide, revisão por
parte, download em `.zip`. **Decisão do cliente registrada pela
equipe** (`-aj`): quando o cliente aprova por WhatsApp ou ligação em
vez de pelo Portal. Depois, revisão do carrossel inteiro de uma vez
pelo Admin/Coordenador e uma fila "Produção de Design" mostrando o que
a equipe inteira precisa fazer.

## 09/11 — Status Semanal 2.0

Redesenho grande, à parte do trabalho de Design, a partir de uma
especificação de 42 seções: o relatório passou a caber SEMPRE numa
página só (nunca gera página 2), com densidade que se adapta à
quantidade de demandas da semana. Rodada seguida de vários ajustes
pedidos com prints reais: corrigir um travamento urgente logo depois
do lançamento, texto pequeno demais quando cabiam poucas demandas,
mostrar o FORMATO de cada demanda (Reel/Card/Carrossel/Story) em vez
de só o ícone, separar "produção do roteiro" de "edição" no
vocabulário de situação, um painel de "situações a revisar" pra
limpar itens genéricos antigos, e por fim situações diferentes pro que
a equipe vê e pro que o cliente vê.

## 09/11 (final) — Status Semanal ↔ Linha Editorial, e ajustes finos

- **Situação puxada automaticamente da Linha Editorial**: o card do
  Status Semanal nasce e continua seguindo o status real do conteúdo
  (Ideia → Em criação → Em revisão → Aprovado → Programado →
  Publicado) até alguém escolher a situação à mão naquele card
  específico. Postagem programada com data já passada vira
  "Publicado" sozinha.
- **Upload de Design em nome do designer**: Admin/Coordenador já
  podiam subir arquivo mesmo com a peça "Em criação" (o designer sem
  tempo) — só não aparecia isso na interface; corrigido a
  visibilidade.
- **Lista do Status Semanal por mês e semana** + **exportar a semana
  inteira** (todos os clientes daquela semana) num `.zip` só.
- **Prévia de um arquivo recém-enviado** no Design, ainda na fila,
  antes de mandar pra revisão — não existia nenhuma forma de conferir
  o que tinha sido enviado.
- Cores do status do Criativo, "copiar legenda", detalhe de leitura da
  Postagem na Linha Editorial.

## 09/14 — Sidebar não acompanhava a página

Bug reportado com print: abrir Linha Editorial ou Status Semanal não
atualizava qual item ficava destacado na barra lateral (continuava
mostrando o item anterior, tipo "Roteiros"). Corrigido nas quatro
telas que faltavam avisar a sidebar.

## Números aproximados

- **60+ builds** desde 09/09.
- **7 rodadas de migration SQL novas** desde a base original (Design,
  Design refino, thumbnail, deep link de notificação, arquivos 2.0,
  decisão do cliente, sincronização Status ↔ Linha).
- Maior frente de trabalho: **B7 Design**, do zero até um fluxo
  completo de produção visual com revisão por slide e decisão do
  cliente.
- Segunda maior frente: **Status Semanal**, de relatório simples a
  documento de uma página só, sincronizado automaticamente com a
  Linha Editorial.
