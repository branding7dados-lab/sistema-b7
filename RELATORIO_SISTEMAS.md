# Sistema B7 — módulos do sistema (visão simplificada)

Atualizado em 14/09/2026. Substitui o `ESTADO_DO_SISTEMA.md` de 09/09
(estava desatualizado — não existia B7 Design nem boa parte do que o
Status Semanal tem hoje).

Frontend puro HTML/CSS/JS (sem build), publicado no GitHub Pages.
Banco Supabase/Postgres. Namespace único `B7.*`, rotas por hash
(`#/…`). Sem botão "Salvar" em lugar nenhum — tudo salva sozinho.

## 1. Roteiros de gravação (núcleo original)

Clientes → gravações → roteiros → cenas (Gancho / Narrativa / Narração
com sugestão de cena / CTA). Editor com trilho lateral, painel de
edição e folha A4 fiel ao que sai impresso. Exporta PDF (A4) e PNG
(300 dpi) pelo Download Center; tem prévia rápida, modo apresentação,
lixeira, arquivados, fixados, histórico de atividade e busca (Ctrl+K).

## 2. Central de Conteúdo / Linha Editorial

O planejamento mensal de cada cliente: Inteligência do cliente (ICP,
voz, posicionamento, produtos, provas), Onboarding, Linha editorial
propriamente dita (conteúdos Reel/Card/Carrossel/Story, com slides e
frames), Banco de ideias, Pilares de conteúdo (5 tipos fixos:
Entretenimento, Educativo, Inspirador, Conversão, Institucional) e
calendário editorial (Postagem × Gravação, tratados como coisas
diferentes). Exporta documento A4 e apresentação 16:9. Cada conteúdo
pode se vincular a um roteiro (`script_id`).

## 3. Status Semanal

O relatório de 7 dias que vai para o cliente: um card por dia,
sempre numa página só (o renderizador nunca gera página 2), com
densidade que se adapta à quantidade de demandas. Puxa da Linha
Editorial automaticamente — situação de cada card nasce do status
real do conteúdo (Ideia → Em criação → Em revisão → Aprovado →
Programado → Publicado) e continua seguindo sozinha até alguém
escolher a situação à mão num card específico. Postagem programada
com data já passada vira "Publicado" sozinha. Lista global agrupada
por mês e semana; exporta PNG/PDF por cliente ou o lote de uma semana
inteira (todos os clientes) num `.zip` só. Versões numeradas (V01,
V02…) a cada exportação.

## 4. B7 Design (Central de Design)

Módulo de produção visual interna — cartões, carrosséis, stories,
capas de reel. Uma peça (`design_deliverables`) nasce vinculada a um
conteúdo da Linha Editorial, passa por versões (`design_versoes`:
rascunho → revisão interna → ajustes → aprovado interno → aguardando
cliente → aprovado/ajustes do cliente → finalizado), e cada versão
tem seus arquivos (prévia, produção, anexo, arte final) — inclusive
arte por slide/frame em peças multiparte, com decisão de revisão por
arquivo. Tem fila própria por designer ("Central do Designer": o que
precisa dele agora, o que ele já começou), navegador de peças em
cartões (hierarquia cliente-primeiro), workspace de peça em tela
cheia com navegação entre slides/stories, download individual ou em
lote (`.zip`), decisão do cliente registrada pela equipe quando ele
aprova por fora (WhatsApp, ligação), e uma visão "Produção de Design"
para Admin/Coordenador acompanhar a fila da equipe inteira. Admin e
Coordenador também podem subir arquivo no lugar do designer quando
ele não tem tempo.

## 5. Aprovações / Portal do cliente

Onde o cliente decide. Aprovação sempre versionada, com um retrato
congelado do que está sendo decidido (roteiro, linha, conteúdo ou
status semanal) — o texto nunca muda depois que a decisão foi
registrada. Cliente aprova ou pede ajuste (por peça inteira ou por
parte/cena), comenta, tem sua própria foto de perfil. Decisão também
pode ser registrada pela equipe quando o cliente decidiu por fora do
sistema. Toda aprovação recusada é auditável — "excluir uma
aprovação" é sempre uma anulação registrada, nunca some do
histórico.

## 6. Kanban de produção

Quadro único (não duplica nada) com as colunas A fazer → Em produção
→ Revisão interna → Aguardando cliente → Ajustes → Pronto →
Concluída. Cada card só aponta pro material real (roteiro, conteúdo,
peça de Design) — nunca copia informação. Reage sozinho a decisões de
aprovação e mudanças de situação.

## 7. Central de Produção (tela inicial)

O painel do dia a dia: gravações, linhas editoriais e roteiros em
andamento, com a situação operacional de cada gravação (Pendente,
Agendada, Gravada, Cancelada). Muda de cara conforme o papel de quem
está logado (a Central do Designer, por exemplo, só mostra Design).

## 8. Autenticação, usuários e permissões

Login por usuário (sem e-mail), quatro papéis — Admin, Coordenador,
Cliente, Designer — cada um com sua própria navegação e rotas
permitidas. Vínculo perfil ↔ empresas (um cliente só vê as empresas
dele), estado do serviço por empresa (ativo/pausado/cancelado),
auditoria de ações privilegiadas, foto de perfil por upload.

## 9. Notificações, presença e push

Notificações em tempo real (quem fez o quê, o que precisa de atenção
agora), indicador de presença (quem está online, heartbeat) e push no
navegador/celular para os eventos importantes (aprovação pendente,
linha concluída etc.).

## 10. Ferramentas gerais

Importar/exportar (backup completo em JSON, restaurável), lixeira e
arquivados (nada some de verdade sem passar por ali), atalhos de
teclado, tema claro/escuro, funciona como app instalável (PWA) com
cache offline da "casca" do sistema.

## O que ainda não existe

- **B7 AI**: só a estrutura de dados (campos "Script DNA") está
  preparada; a funcionalidade em si não foi construída.
- Recorrência automática de demandas no Status Semanal (modelo
  reaproveitável semana a semana).
- Compartilhamento nativo de um Status Semanal por link (hoje é
  sempre arquivo baixado).
