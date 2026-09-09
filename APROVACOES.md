# Aprovações, eventos, notificações e Kanban

Arquitetura do fluxo de aprovação do cliente (a partir de
`migration_aprovacoes_v2.sql`). Toda evolução futura de aprovação —
roteiro, linha editorial, conteúdo, status semanal, novos formatos —
usa esta infraestrutura. Não criar um segundo fluxo.

## Princípio

**O navegador nunca decide nada sozinho.** Enviar, aprovar, pedir
ajustes e recusar são funções do banco (`security definer`), chamadas
via `supabase.rpc`. Cada função, na mesma transação:

1. tranca a aprovação (`for update`);
2. confere quem está agindo (`aprov_pode_decidir`);
3. recusa versão encerrada ou substituída;
4. devolve `{resultado: 'inalterado'}` se o comando repete o estado atual
   (idempotência: clique duplo, retry, aba antiga);
5. grava a decisão;
6. registra o evento em `eventos_dominio` (chave única);
7. processa o evento: cria as notificações e projeta no Kanban.

Se o passo 7 falhar, a decisão fica gravada e o evento fica com `erro`;
a equipe reprocessa pela tela de Aprovações (`aprov_reprocessar`).

O autosave do editor **nunca** cria versão nem notificação. Só "Enviar
para aprovação" congela um snapshot e cria a versão.

## Estados

### Aprovação (`aprovacoes.situacao`)

| Estado | Significado |
|---|---|
| `pendente` | enviado, cliente ainda não decidiu nada |
| `parcial` | alguma cena/parte já foi decidida, sem veredito do todo |
| `aprovado` | cliente aprovou a versão inteira |
| `ajustes` | cliente pediu correção; equipe deve reenviar nova versão |
| `recusado` | cliente recusou a proposta (motivo obrigatório); exige repensar |
| `substituido` | uma versão mais nova foi enviada; esta não aceita decisão |
| `cancelado` | retirado pela equipe |

Transições permitidas: `pendente|parcial → aprovado|ajustes|recusado`
(pelo cliente aprovador ou equipe); `pendente|parcial → substituido`
(automático ao enviar nova versão). `aprovado|ajustes|recusado` são
terminais para a versão — mudar de ideia exige nova versão.

### Parte (`aprovacao_partes.situacao`): `pendente | aprovada | ajustes`

Uma linha por (aprovação, parte). `parte_id` é o id estável da cena —
reordenar não move a decisão. A cena precisa existir no snapshot da
versão. Repetir a mesma decisão não gera evento.

### Regras

- Aprovar o todo com cena em `ajustes` → erro `P0004` explicando quais.
- Aprovar o todo com cenas sem decisão → permitido; a decisão do todo
  cobre o snapshot inteiro. Não cria decisões por cena artificiais.
- Recusar exige motivo. Pedir ajustes exige motivo salvo se já houver
  ajuste por cena ou comentário do cliente na versão.
- Nova versão **não** herda decisões da anterior (o conteúdo pode ter
  mudado; o cliente revisa de novo).
- O que **não** muda com aprovação: `roteiros.status` (estágio de
  produção), `gravacoes.situacao`, `clientes.servico`.

### Estados que continuam separados

- Produção do roteiro: `roteiros.status` (Em criação … Gravado).
- Operação da gravação: `gravacoes.situacao` (Pendente, Agendada,
  Gravada, Cancelada) — confirmada pela equipe, nunca deduzida.
- Serviço do cliente: `clientes.servico` (ativo, pausado, cancelado).
- Publicação: `conteudos.status` / `visivel_cliente`.

## Funções (contrato)

```
aprov_enviar(p_client_id, p_tipo, p_alvo_id, p_snapshot, p_observacao) → aprovacoes
aprov_decidir_parte(p_aprovacao_id, p_parte_id, p_rotulo, p_situacao, p_comentario, p_parte_tipo) → jsonb
aprov_decidir(p_aprovacao_id, p_situacao, p_motivo, p_versao) → jsonb
aprov_reprocessar(p_evento_id)                     -- equipe
notif_marcar_lida(p_id) · notif_marcar_todas()     -- só as próprias
```

Erros com códigos: `42501` permissão · `P0002` não encontrado ·
`P0003` versão encerrada/substituída/desatualizada · `P0004` cenas com
ajustes bloqueiam aprovação total · `P0005` motivo obrigatório.

`p_versao` em `aprov_decidir` é a versão que a pessoa vê; divergência
= aba antiga → erro P0003 com orientação.

## Eventos (`eventos_dominio`)

| tipo | chave | ator |
|---|---|---|
| `aprovacao.enviada` | `enviada:<aprovacao_id>` | equipe |
| `parte.aprovada` / `parte.ajustes` | `parte:<ap>:<parte>:<situacao>:<ts>` | cliente |
| `aprovacao.aprovada` / `.ajustes` / `.recusada` | `decisao:<ap>:<situacao>` | cliente |

`payload` guarda rótulo, comentário, motivo, versão. `processado_em`,
`erro`, `tentativas` registram o processamento.

## Notificações (`notificacoes`)

Uma por (evento, destinatário) — `unique`. Destinatários:

- `aprovacao.enviada` → todas as contas `cliente` ativas vinculadas à
  empresa (`perfil_clientes`).
- eventos do cliente → todos os `admin` e `coordenador` ativos, exceto o
  próprio ator.

Texto em português com nome, empresa e título vindos do banco. `link`
é `#/aprovacoes/<id>` (equipe) ou `#/revisar/<id>` (cliente); a tela de
destino reconfere a permissão via RLS.

Frontend (`js/notificacoes.js`): consulta ao abrir, a cada 60 s, ao
voltar o foco, ao reconectar; Realtime (canal filtrado por
`destinatario_id`) só antecipa a consulta. Não há e-mail, WhatsApp nem
push.

## Kanban (projeção)

Demanda ligada = `kanban_demandas` com `tipo_vinculo = aprovacoes.tipo`
e `vinculo_id = alvo_id` (ativa, não arquivada).

| evento | coluna destino | observações |
|---|---|---|
| `aprovacao.enviada` | `aguardando_cliente` | cria demanda se não houver |
| `aprovacao.ajustes` | `ajustes` | cria se não houver; motivo entra na descrição |
| `aprovacao.recusada` | `ajustes` | prioridade `alta`; `[RECUSADO vN]` na descrição |
| `aprovacao.aprovada` | `pronto` | só se estava em `aguardando_cliente`, `revisao` ou `ajustes` |
| `parte.*` | — | só atualiza `aprovacao_situacao` no card |

Nunca move para `concluida`. Não mexe em demanda com
`automacao_travada = true` (checkbox "Travar automação" no card) nem já
concluída. Todo movimento automático vai para `kanban_historico` com
autor "<nome> (aprovação)". Repetir o evento não cria segundo card
(idempotência na chave do evento + busca pela demanda existente).

## Autorização

- `aprovacoes`: cliente lê as da própria empresa (serviço ativo);
  **nenhum** UPDATE direto de cliente (política `aprovacoes_decisao`
  removida). Equipe: tudo.
- `aprovacao_partes`: cliente lê; escrita só via função.
- `comentarios`: cliente insere (trigger assina com a sessão).
- `eventos_dominio`: equipe lê.
- `notificacoes`: cada um lê as suas; marcação via função.
- `kanban_*`: equipe.
- Trigger `aprovacoes_protege_material`: bloqueia UPDATE de cliente
  fora das funções (`b7.via_funcao`).
- Cliente `pode_aprovar = false` (viewer): lê e comenta; a função recusa
  decisão (`42501`) e a UI não mostra os botões.
- Antes do corte do RLS o sistema abre sem sessão, mas as funções
  exigem sessão: decisão sem autor não existe.

## Tempo real e notificações (build 2026-09-09-j)

- A tela de Aprovações da equipe assina `aprovacoes` e `aprovacao_partes`
  (postgres_changes) enquanto está aberta: lista e contagens redesenham a
  partir dos mesmos filtros, sem recarregar; o detalhe assina só o seu id
  (mais `comentarios`) e não redesenha enquanto há resposta sendo escrita.
  O portal assina `aprovacoes` filtrando por `client_id` da empresa. Os
  canais são fechados ao sair da rota (`B7.Rota.aoSair`).
- A aba "Todos" substitui "Histórico": versões substituídas e canceladas
  aparecem só ali.
- Toda linha de `notificacoes` pode virar push (Database Webhook →
  `b7-push`); ver PUSH.md. Som e aviso do navegador seguem
  `perfis.preferencias`.
- `migration_push.sql` adiciona `notificacoes`, `aprovacoes`,
  `aprovacao_partes` e `comentarios` à publicação `supabase_realtime`.

## Telas

- Equipe: `#/aprovacoes` (caixa: contagens, filtros, lista) e
  `#/aprovacoes/<id>` (cenas com decisão, comentários, versões, linha do
  tempo, reprocessar). Bloco de status no editor de roteiro e na linha
  editorial (`B7.Aprovacoes.blocoStatus`). Resumo na Central B7.
- Cliente: `#/aprovacoes` (Aguardando você · Ajustes solicitados ·
  Recusados · Aprovados · Histórico) e `#/revisar/<id>` (cena a cena,
  "Aprovar roteiro completo", "Solicitar ajustes", "Recusar", versões).
  Faixa na Linha editorial quando há aprovação do planejamento.
- Sino no topo para todos os papéis.

## Linha editorial

`aprov_enviar(tipo='linha')` congela nome, período, objetivo, canais,
estratégia e a lista de conteúdos (título, formato, data, roteiro só
pelo título). Aprovar a linha aprova o **planejamento**; roteiros,
artes e publicações têm aprovações próprias. Contagens de "linhas
aprovadas" contam aprovações de linha, não conteúdos.

## Gravações

Não há aprovação de gravação nesta fase: a gravação é fato operacional
da equipe. Nenhum evento de aprovação altera `gravacoes.situacao`,
`data_gravacao` ou `gravada_em`. Se um dia houver confirmação de data
pelo cliente, modelar como `aprovacoes.tipo = 'gravacao'` com snapshot
da proposta — a infraestrutura já aceita novos tipos (ajustar o `check`
em `aprov_enviar`).

## Legado

Ao rodar a v2: aprovações `pendente` com versão mais nova viram
`substituido`; `pendente` com cena decidida vira `parcial`. Nada é
apagado. Aprovações anteriores não têm `eventos_dominio` (a linha do
tempo mostra o aviso).
