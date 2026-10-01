# Relatório 2026-10-01-v — Notificações inteligentes

Pacote com front-end, service worker, Edge Function `b7-push` e uma migration (`migration_notificacoes_inteligentes.sql`).

> **Situação da publicação (01/10/2026).** Publicado, nesta ordem: 1) `b7-push` versão 4 (`2026-10-01-v`), respondendo; 2) migration `notificacoes_inteligentes` aplicada no Supabase (14 funções novas, 2 gatilhos, cron `notif-agendados` ativo); 3) front no GitHub. Nenhuma notificação foi disparada pela aplicação da migration.

## Visão geral

Antes, boa parte dos avisos ia para **todo admin e todo coordenador**, e os lembretes da agenda iam para **a equipe inteira**. Agora a notificação é um evento relevante para uma pessoa:

- quem foi atribuído ou é o responsável recebe;
- quem tem a função que depende daquilo recebe;
- o admin só recebe o que é do trabalho dele e o que escolheu acompanhar.

O sistema continua sendo o mesmo: mesma tabela `notificacoes`, mesmo sino, mesmo webhook, mesma `push_subscricoes`. Não existe segundo sistema, tabela nova nem módulo novo na barra lateral.

O que a pessoa vê de diferente:

- título que diz o que aconteceu ("Correção solicitada no vídeo") e corpo com cliente, item e contexto;
- logo do cliente como ícone do aviso; ícone do B7 quando não há cliente;
- botões no aviso que só navegam ("Abrir gravação", "Ver roteiros");
- em **Meu perfil → Notificações**: o estado do aparelho, um botão de teste e as preferências por função.

## Arquitetura de notificações

```
evento de negócio (eventos_dominio, chave única)
  → processador do domínio (vídeo, design, aprovações, gravações, agenda, roteiros)
    → notif_entregar()        ← único ponto que resolve destinatários
      → notificacoes          (uma linha por evento e pessoa)
        → sino (Realtime + consulta a cada 60 s)
        → webhook → b7-push → service worker   (push é só um canal)
```

- **`notif_destinatarios()`** decide quem recebe, por três rotas: direto (atribuído/responsável), função (papel **ou** função extra) e admin (opção de acompanhamento). Devolve uma linha por pessoa.
- **`notif_entregar()`** grava a notificação para cada pessoa resolvida. Quem fez a ação nunca é avisado dela.
- **Idempotência:** a chave única de `eventos_dominio` e o índice `(evento_id, destinatario_id)` já existiam e continuam valendo. Cron repetido, reconexão do Realtime ou nova tentativa de rede não criam aviso duplicado.
- **Agendados:** um job novo, `notif-agendados` (de hora em hora, 08h–19h de Brasília), confere prazos de vídeo e de Design e solta o resumo diário. O job `agenda-lembretes` (a cada 5 min) é o mesmo de antes. Não há dois agendadores para a mesma coisa.

## Videomaker

| Aviso | Quem recebe |
|---|---|
| Gravação atribuída a você | o videomaker definido |
| Gravação amanhã às HH:MM / Gravação hoje às HH:MM | o responsável; sem responsável definido, quem tem a função de videomaker |
| Gravação remarcada (com a data nova e a anterior) | o responsável |
| Gravação cancelada | o responsável |
| Demanda de vídeo atribuída a você | o videomaker atribuído |
| Correção solicitada no vídeo | o videomaker da demanda |
| Cliente aprovou o vídeo | o videomaker da demanda |
| Prazo amanhã — Vídeo | o videomaker da demanda |
| Demanda atrasada há N dias | o videomaker da demanda |
| Roteiro pronto para gravação | o videomaker responsável pela gravação do roteiro |

## Designer

| Aviso | Quem recebe |
|---|---|
| Design atribuído a você / Demanda de Design atribuída a você | o designer definido |
| Nova demanda de Design disponível (linha concluída sem designer) | quem tem a função de designer |
| Briefing atualizado | designers com peça naquela linha |
| Ajuste solicitado no Design ("Slide 04 precisa de alteração") | o designer da peça |
| Design aprovado na revisão interna | o designer da peça |
| Cliente aprovou a peça / solicitou ajustes / recusou | o designer da peça |
| Peça finalizada | o designer da peça |
| Prazo amanhã — Design / Demanda atrasada | o designer da peça |

Os avisos de prazo de Design só contam peça que depende do designer (aguardando produção, em criação ou em ajuste). Hoje nenhuma peça tem prazo preenchido, então eles ficam quietos até alguém definir prazos.

## Coordenador

| Aviso | Preferência |
|---|---|
| Roteiro aguardando revisão | Aguardando revisão |
| Linha Editorial aguardando revisão | Aguardando revisão |
| Design aguardando revisão | Aguardando revisão |
| Vídeo enviado para aprovação | Aguardando revisão |
| Cliente aprovou / solicitou ajustes / recusou (roteiro, linha, peça) | Decisões dos clientes |
| Decisão do cliente anulada | Decisões dos clientes |
| Vídeo entregue · Designer assumiu a peça | Andamento da produção |
| Demanda atrasada há 2 dias ou mais | Atrasos escalados |

Quem coordena por **função extra** (por exemplo, designer + coordenador) passa a receber esses avisos. Antes só contava o papel principal.

## Administrador

Ser admin não faz ninguém receber tudo. O admin recebe:

- o que é do próprio trabalho (por exemplo, admin + videomaker recebe tudo da tabela do Videomaker);
- a decisão do cliente sobre um material que **ele mesmo** enviou para aprovação;
- o que ligar em "Acompanhar a operação":
  - **Atrasos críticos** (5 dias ou mais) — ligado por padrão;
  - **Revisões pendentes da agência** — desligado por padrão;
  - **Todas as movimentações da agência** — desligado por padrão.

**Atenção a esta mudança:** hoje os dois admins recebem "versão de Design enviada para revisão" e "vídeo enviado para aprovação". Com a migration, isso passa a ir só para quem coordena, a menos que o admin ligue "Revisões pendentes da agência". Se quem revisa no dia a dia é um admin, essa opção precisa ser ligada.

## Multi-função

O resolvedor devolve **uma linha por pessoa**, não importa por quantas rotas ela entre. Testado: uma pessoa que é responsável pela demanda e também coordena recebe um aviso só do atraso escalado.

Um caso de "mesmo fato, dois eventos" foi tratado: a decisão do cliente sobre uma peça de Design gera `design.cliente_*` (para o designer) e `aprovacao.*` (para a coordenação). O designer da peça fica de fora do segundo, mesmo que também coordene.

## Visual das notificações

- **Logo do cliente:** vira o ícone do aviso (o bucket `client-logos` já é público). No sino, logo ou iniciais.
- **Sem cliente** (resumo, compromisso sem gravação, teste): ícone do B7. No sino, símbolo B7.
- **Badge do Android:** sempre o símbolo B7 monocromático (`badge-96.png`), que já existia. Logo de cliente ali viraria um quadrado branco.
- **Imagem:** só quando existe prévia **real** da peça de Design (avisos de revisão, ajuste, aprovação). O bucket `design-files` continua privado: a `b7-push` assina a URL por 48 h e só para quem já foi resolvido como destinatário.
- **Modelos:** dois formatos de texto, e não um por tipo:
  - cliente + ação: título + `Cliente · "Item" · contexto`;
  - cliente + data: título com o horário + `Cliente · gravação · N itens · Referente a Outubro de 2026`.
- **Sem suporte a imagem ou botões:** o aviso sai com título, corpo, ícone e o clique que abre o registro.

**Não foi feito:** os cartões ilustrados das referências (data grande sobre fundo escuro, selo "ATRASADA"). O Android desenha a moldura do aviso; para ter aquela arte seria preciso gerar uma imagem no servidor a cada notificação. Não existe hoje um jeito estável de fazer isso na função, e o pedido dizia para não atrasar o pacote por causa disso.

## Preferências

Ficam em **Meu perfil → Notificações** (o botão "Preferências" do sino abre direto ali). A página Configurações só existe para admin, então não era o lugar certo para algo que todo mundo usa.

- **Neste aparelho:** estado real (aparelho, permissão do navegador, push, som, último teste), os três canais (push, som, aviso do navegador) e o teste.
- **O que te avisa:** um grupo por função, em sanfona. Cada pessoa só vê os grupos da função que tem.

| Grupo | Quem vê | Opções | Padrão |
|---|---|---|---|
| Meu trabalho | toda a equipe | atribuições, prazos, atrasos, correções, aprovações | ligado |
| Gravações | videomaker | lembretes, remarcadas/canceladas, roteiros prontos | ligado |
| Design | designer | novas demandas disponíveis | ligado |
| Coordenação | coordenador | aguardando revisão, decisões dos clientes, andamento, atrasos escalados | ligado |
| Agenda e resumo | toda a equipe | compromissos da agenda · resumo diário | ligado · desligado |
| Acompanhar a operação | admin | atrasos críticos · revisões da agência, todas as movimentações | ligado · desligado |

- **Desligar um aviso do próprio trabalho** tira push, som e aviso do navegador. O registro continua no sino (a notificação nasce com `dados.silenciosa`).
- **Opções do admin e resumo diário** são diferentes: desligadas, a notificação nem é criada.
- **Armazenamento:** `perfis.preferencias.notif`, pela mesma função `perfil_preferencias_gravar()`. Não há tabela nova. Quem já tinha `som`, `navegador` e `push` gravados continua igual.
- Cliente do Portal vê só os canais do aparelho.

## Prazos e lembretes

- **Prazo amanhã:** para o responsável (vídeo e Design).
- **Atrasou:** para o responsável, no dia seguinte ao prazo.
- **2 dias de atraso:** de novo para o responsável e, agora, para a coordenação.
- **5 dias de atraso:** para o admin que mantém "Atrasos críticos" ligado.
- **Gravação:** na véspera (24 h antes) e 1 h antes, com itens planejados e o mês de referência separado da data.
- **Resumo diário:** opcional, às 08h, só quando há algo. Conta prazos do dia e gravações de amanhã da pessoa; para quem coordena ou administra, também publicações do dia e vídeos em atraso.
- **Horário:** os prazos passam a ser conferidos pelo banco, de hora em hora, das 08h às 19h. Antes só eram conferidos quando alguém abria a tela de Vídeo. Ninguém recebe push de prazo de madrugada.
- **Fuso:** "hoje" e "amanhã" passaram a ser calculados no horário de Brasília. Antes usavam a data do servidor (UTC), que vira o dia às 21h.
- **Reuniões e apresentações da agenda:** continuam indo para a equipe, porque a agenda não tem responsável por evento. Cada pessoa pode desligar em "Compromissos da agenda".

As quatro demandas de vídeo que já estão atrasadas há 5 dias ou mais foram marcadas como "já contabilizadas" na migration: não disparam "atraso crítico" na primeira rodada.

## Notificação de teste

- **Botão:** "Enviar notificação de teste", em Meu perfil → Notificações.
- **Fluxo:** o B7 chama a `b7-push` com o endpoint deste aparelho e o JWT da sessão. A função manda um push de verdade (mesmo envio dos avisos reais) só para aquele aparelho.
- **Não grava notificação:** o teste não aparece no sino, não conta como não lida, não vira pendência e não escala. A função antiga `notificar_teste()` continua no banco, mas a tela não a usa mais.
- **Estados de erro:** permissão não concedida, bloqueada pelo navegador, push não ligado neste aparelho, inscrição expirada, sessão expirada, serviço fora do ar e falha de envio. Cada um com a sua frase.
- **Sem sucesso falso:** "Enviado" significa que o serviço de push aceitou a mensagem. O navegador não confirma que o aparelho exibiu, então a tela nunca diz "Entregue".

## Deep links

| Aviso | Abre |
|---|---|
| Gravação (atribuída, lembrete, remarcada, cancelada) | `#/gravacao/<id>`; botão "Ver roteiros" → `#/gravacao/<id>/roteiros` |
| Vídeo | `#/video/<id>` |
| Design (peça) | `#/design/<id>` |
| Design (demanda da linha) | `#/design/linha/<id>` |
| Roteiro | `#/gravacao/<gravação>?roteiro=<id>` |
| Linha Editorial | `#/linha/<id>` |
| Aprovação (equipe) | `#/aprovacoes/<id>` |
| Compromisso sem gravação | `#/calendario` |
| Resumo diário | `#/painel` (admin sem função operacional: `#/`) |

## Service Worker / Push

- `sw.js` (cache v120): entende o formato novo do aviso e continua entendendo o antigo.
- Botões só navegam. Nenhuma ação de negócio (aprovar, concluir, cancelar) acontece pela tela de bloqueio.
- Clique no corpo ou num botão: foca a aba do B7 já aberta e troca a rota; só abre aba nova se não houver nenhuma. Quem abre pelo aviso já sai das não lidas.
- Link que não começa com `#/` é ignorado (vai para a página inicial).
- `b7-push` grava o resultado em `notificacoes.push_status` / `push_em` / `push_info` (`enviado`, `silenciada`, `push_desligado`, `sem_inscricao`, `falha`). As colunas já existiam e estavam vazias.
- Inscrição morta (404/410) continua sendo apagada.

## Segurança e privacidade

- **Tela de bloqueio:** o texto que o cliente ou a equipe escreveu (pedido de correção, motivo de recusa, motivo de cancelamento) saiu do aviso. O push diz "O cliente solicitou uma alteração" ou "Slide 04 precisa de alteração"; o texto completo fica em `dados.detalhe` e dentro do B7.
- **RLS:** nenhuma policy foi alterada. `notificacoes` continua legível só pelo próprio destinatário.
- **Funções internas** (`notif_entregar`, `notif_destinatarios`, varreduras e resumo) não podem ser chamadas pelo app: `authenticated` e `anon` não têm permissão de execução.
- **Teste de push:** confere o JWT e só envia para um endpoint que pertence à própria pessoa.
- **Logs:** a função registra só o resultado do envio, nunca o texto do aviso nem chaves.

## Banco / migrations

Uma migration: `migration_notificacoes_inteligentes.sql`. Não cria tabela nem coluna e não altera policy.

- **Novas:** `notif_pref_ativa`, `notif_destinatarios`, `notif_entregar`, `notif_hoje`, `notif_dia`, `notif_dia_hora`, `notif_mes`, `notif_ha_dias`, `_video_alertas_prazo`, `_design_alertas_prazo`, `_notif_resumo_diario`, `notif_verificar_agendados`, `roteiros_notificar_status`, `linhas_notificar_status`.
- **Reescritas (destinatários e textos):** `video_processar_evento`, `design_processar_evento`, `aprov_processar_evento`, `design_sync_decisao_cliente`, `_grav_notificar`, `agenda_verificar_lembretes`, `video_verificar_alertas_prazo`, `perfil_preferencias_gravar`.
- **Gatilhos novos:** `roteiros_notificar_status` (em `roteiros`) e `linhas_notificar_status` (em `linhas_editoriais`), só na troca de status. Um erro neles nunca impede salvar.
- **Cron novo:** `notif-agendados` (`5 11-22 * * *` UTC).
- **O que não mudou nas funções reescritas:** as mudanças de estado (peça, versão, Kanban) e os textos enviados ao cliente no Portal. Em `aprov_processar_evento`, os blocos de Kanban e de textos do cliente foram comparados com o original e são idênticos.

## Arquivos alterados

- `migration_notificacoes_inteligentes.sql` (novo)
- `supabase/functions/b7-push/index.ts`
- `sw.js`
- `js/notificacoes.js` — filtros do sino, catálogo de preferências, aviso silencioso
- `js/perfil.js` — bloco Notificações
- `js/push.js` — estado do aparelho e teste
- `js/database.js` — filtro por tipo, teste de push, histórico da peça de Design
- `js/design.js` — linha do tempo e destaque do ajuste (ver abaixo)
- `styles/auth.css`, `styles/aprovacoes.css`
- `js/auth.js` (versão 2026-10-01-v), `PUSH.md`

**Por que o Design entrou:** a linha do tempo da peça e o destaque "Ajuste solicitado" eram montados a partir das notificações de quem estava olhando. Com os avisos indo só para quem eles envolvem, um gestor ficaria com a linha do tempo quase vazia. Agora admin e coordenação leem os eventos da peça (a policy já permitia); o designer continua lendo as próprias notificações, e o texto do pedido vem de `dados.detalhe`.

## Testes executados

**Banco** — a migration inteira foi executada no banco real dentro de uma transação desfeita no final (nada foi gravado, nenhum push saiu), com cinco perfis reais ajustados para o cenário: admin + videomaker, admin puro, coordenador, designer e designer + coordenador.

- Atribuição direta: só o atribuído; admin puro não recebe.
- Revisão: coordenador e designer + coordenador; admin só com "Revisões pendentes" ligado.
- Preferência desligada: a notificação nasce silenciosa.
- Multifunção: responsável que também coordena recebe um aviso só.
- "Todas as movimentações": o admin recebe com título em terceira pessoa ("atribuída a Fulano").
- Vídeo: atribuída, escalada, correção (texto do cliente não vaza), atraso crítico.
- Design: ajuste com slides ("Slide 02, 04 precisam de alteração"), texto guardado em `dados.detalhe`, prévia apontada; versão enviada vai para a coordenação; peça criada sem responsável não avisa ninguém.
- Gravação: lembrete de véspera sem responsável (cai na função videomaker) e de 1 h com responsável; segunda rodada do cron cria zero; atribuída, remarcada e cancelada (motivo não vaza); atribuição a quem fez a ação não avisa.
- Roteiro: "Em revisão" duas vezes no mesmo dia gera um aviso por pessoa; "Pronto para gravar" avisa o responsável; editar o título não avisa.
- Linha Editorial: "Em revisão" avisa a coordenação uma vez; aprovar não avisa.
- Aprovação: decisão sobre peça de Design vai para quem enviou e para a coordenação; o designer fica de fora desse evento e recebe o da peça; o status da peça muda como antes.
- Preferências: só chaves conhecidas são gravadas; gravar uma não apaga as outras.
- Resumo diário: um por pessoa por dia; segunda rodada cria zero.
- Primeira varredura de prazos sobre a base real: zero notificações novas.
- Datas: `2026-10-08 12:00Z` → "08 OUT · 09:00"; virada de dia em UTC cai no dia certo em Brasília.
- Permissões: funções internas bloqueadas para `authenticated`.

**Telas** — página de teste local com os arquivos reais (`ui.js`, `foto.js`, `notificacoes.js`, `push.js`, `perfil.js`, `sw.js`) e banco simulado, no navegador embutido (Chromium).

- Sino: lista, logo / iniciais / símbolo B7, logo quebrada vira iniciais, cinco filtros, estado vazio por categoria, erro de carga, clicar marca como lida e fecha.
- Som: toca uma vez; não repete para o mesmo id; não toca para aviso silencioso nem com som desligado.
- Preferências por perfil: admin puro, admin + videomaker, videomaker, designer, coordenador, coordenador + designer e cliente — cada um vê só os grupos da sua função.
- Interruptores: gravam só a chave alterada; a contagem do grupo atualiza; falha ao salvar devolve o interruptor.
- Teste de push: permissão bloqueada, não solicitada, sem inscrição, sucesso, falha do servidor, inscrição expirada, função fora do ar e exceção — cada um com a mensagem certa e sem chamar o servidor quando não deve.
- Service worker (código real com `self` simulado): aviso completo, clique no corpo, clique no botão, aba já aberta (foca, não abre outra), aparelho sem botões, com imagem, aparelho que recusa imagem/botões (sai o aviso simples), formato antigo, link externo ignorado, payload de teste.
- Design: destaque do ajuste e linha do tempo com aviso novo, aviso antigo e eventos (gestão).
- Celular 375 px em tema escuro e desktop 1280 px: sem rolagem lateral, nada vazando da tela.
- Sintaxe de todos os JS alterados conferida no navegador.

## Limitações

- **Push de ponta a ponta não foi testado:** no navegador de teste a permissão de notificação está bloqueada. Depois de publicada, a função só foi conferida respondendo ao teste sem sessão (401, como esperado). O envio real, o ícone, a imagem e os botões no Android precisam ser conferidos num aparelho depois de publicar.
- **Nenhum teste em Android físico ou emulado.** O celular foi simulado por largura de tela.
- **iPhone:** o Safari não mostra botões nem imagem no aviso. Sai título, corpo e ícone.
- **Imagem do aviso:** usa a miniatura quadrada da peça; o Android corta para o formato largo dele.
- **Vídeo:** não há miniatura canônica da demanda, então aviso de vídeo não tem imagem.
- **Avisos já enviados** ficam com o texto antigo no sino. Só os novos seguem o formato novo.
- **Réguas fixas:** 2 dias para escalar e 5 para crítico. Não há tela para mudar.

## Pendências

- **Conferir no celular:** ligar o push, usar "Enviar notificação de teste" e ver ícone, botões e abertura do B7 num Android de verdade.
- **Decidir quem revisa:** se algum admin revisa Design e vídeo no dia a dia, ligar "Revisões pendentes da agência" para ele.
- **Publicações:** "Publicação programada para hoje" e "precisa de atenção" não viraram aviso individual. Não existe um campo que diga qual é a pendência, e um aviso por publicação daria vários por dia. As publicações do dia entram no resumo diário.
- **Gravação com pendência de preparação** (para a coordenação): não implementado, pelo mesmo motivo — falta um dado canônico que diga o que está pendente.
- **Problema antigo encontrado, não corrigido:** quando o material enviado ao cliente é uma peça de Design, os eventos `aprovacao.enviada`, `aprovacao.ajustes` e `aprovacao.recusada` falham ao tentar criar um card no Kanban (o tipo `design_versao` não é aceito pela restrição `kanban_vinculo_valido`). Há um evento parado com esse erro desde 11/09. O designer recebe a decisão do mesmo jeito (pelo aviso da peça), mas a coordenação não recebe "cliente solicitou ajustes" nesses casos. Corrigir mexe na automação do Kanban, então ficou para você decidir.
- **Cartões ilustrados** das referências: dependem de gerar imagem no servidor.
