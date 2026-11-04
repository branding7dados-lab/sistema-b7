# Relatório 2026-09-30-h: Gravações 2.0 (Fase 5)

Pacote: `atualizacao-2026-09-30-h.zip`. Inclui também o que veio no g (Admin+Designer e o ajuste da prévia).

- Banco: já aplicado no Supabase, com as migrations `gravacoes_2`, 2 correções e `gravacoes_2_endurecer`.
- Front-end: só preparado, não publicado.

## Gravações 2.0

A gravação agora é uma entidade própria. Ela nasce sem roteiro nenhum, tem página de detalhe em `#/gravacao/<id>` e o foco é a execução: o que vai ser gravado, quando, quem grava e em que ponto está.

- **Rotas:** o editor de roteiros continua acessível por `#/gravacao/<id>/roteiros`, `?roteiro=` e `?imprimir=`.
- **Página de detalhe:**
  - cabeçalho com o cliente e o status;
  - três fatos: Mês de referência, Data e Responsável;
  - ações principais: Marcar/Remarcar, Concluir, Abrir roteiros e um menu ⋯;
  - checklist "O que vamos gravar", Observações (autosave), Detalhes e Histórico.
- **Editor de roteiros:** deixou de mudar a data e a situação da gravação. O modal de dados mostra a data só para leitura, com link para a gravação. "Marcar como Gravado" passou a chamar `gravacao_concluir`.

## Mês de referência

- **Colunas:** `gravacoes.competencia_ano` e `competencia_mes`, no mesmo padrão de `demandas_edicao`.
- **Obrigatório em toda gravação nova.** O trigger `gravacoes_regras_antes` recusa INSERT sem o mês e recusa apagar o mês depois.
- **Independente da data física.** Por exemplo, gravar em 28/09 para o mês de Outubro continua como Outubro depois de remarcar.
- **Nova gravação:** o mês é obrigatório. A data sugere o mês, mas só enquanto a pessoa não tiver escolhido o mês à mão.
- **Onde o mês também foi adicionado:** modal do Calendário (`calendario_marcar_gravacao` com os novos parâmetros), `calendario_criar_gravacao_de_evento`, duplicar gravação e o modal Editar.
- **Gravações antigas:**
  - o backfill preencheu o mês em 9 das 20, só quando havia um mês único e confiável vindo da linha editorial ou da demanda;
  - as outras 11 ficam no grupo "Sem mês de referência (gravações antigas)", com um aviso no detalhe;
  - nada foi apagado ou inventado.

## Itens da gravação

- **Tabela nova `gravacao_itens`**, com tipos `roteiro`, `referencia` (trend/link), `avulso` e `conteudo` (Linha Editorial).
- **Regras:**
  - remoção suave via `removido_em`;
  - índices únicos parciais impedem o mesmo roteiro ou conteúdo duas vezes;
  - a ordem pode ser alterada (subir/descer).
- **RPCs:** `gravacao_item_adicionar`, `_editar`, `_remover`, `_mover` e `_marcar`. A view de leitura é `gravacao_itens_resumo`.
- **Links:** só aceitam http(s), validados na tela e no banco. Um link sem protocolo vira https. Links de referência abrem com `target=_blank rel=noopener`.
- **Adicionar item** abre uma folha com 5 opções: Roteiro novo, Roteiro existente, Trend/referência, Avulso e Conteúdo da Linha Editorial.
- **Seletores:** mostram só itens do cliente da gravação, com o mês de referência primeiro e depois "Outros meses". Itens que já estão na gravação aparecem desabilitados.
- **Backfill:** 67 itens criados a partir dos roteiros existentes.

## Roteiros

- **Ligação:** o link canônico continua sendo `roteiros.recording_session_id`, que é a gravação "casa" do roteiro.
- **Roteiro novo:** o trigger `roteiros_itens_gravacao` cria o item automaticamente.
- **Roteiro de outra gravação:** pode entrar como item, marcado "escrito em outra gravação", sem duplicar o roteiro.
- **Sincronização de status:**
  - marcar o item como gravado deixa o roteiro "Gravado";
  - desmarcar volta o roteiro para "Pronto para gravar";
  - mudar o status no editor atualiza o item da gravação casa;
  - tudo fica registrado no histórico e não entra em loop (guarda `b7.item_sync`).

## Checklist

- **Marcar:** cada item tem um checkbox de 44px (48px em telas de toque), com atualização otimista e rollback se der erro.
- **Progresso:** "x de y gravados".
- **Quando todos foram gravados:** aparece a faixa "Todos os itens foram gravados" com o atalho para concluir.
- **Concluir com itens pendentes:** pede confirmação. Os itens não gravados continuam visíveis e aparece uma faixa de conclusão parcial.
- **Quem pode marcar:** a equipe (admin/coordenador) e o videomaker responsável.
- **Somente leitura:** os outros usuários veem o checklist sem poder alterar.

## Status da gravação

| Status | Cor | Quando |
|---|---|---|
| Marcada | azul | tem data atual |
| Remarcada | amarelo | a data mudou pelo menos uma vez |
| Concluída | verde | `gravacao_concluir` |
| Cancelada | vermelho | `gravacao_cancelar` |
| Sem data | cinza | ainda sem data |

- **Fonte do status:** vem da ocorrência atual (`gravacoes_ocorrencias`). O trigger `gravacoes_ocorrencias_sincronizar` mantém `gravacoes.data_gravacao`, `hora_*`, `situacao` e `concluida_*` coerentes, usando o fuso de São Paulo.
- **Novo valor:** `Remarcada` entrou no check de `situacao` e nas listas da Central e do Painel.

## Remarcação

- **RPC:** `gravacao_agendar(id, data, início, fim, motivo)`. A ocorrência anterior vira `remarcada` e a nova passa a ser a atual.
- **O que fica registrado:** a data antiga não some. Ela aparece em "Datas desta gravação" e na linha do tempo ("De 10/10 13:00 para 28/09 17:00 — motivo").
- **Bloqueios e validações:**
  - não é possível remarcar uma gravação já concluída;
  - o fim não pode ser antes do início;
  - se o novo início passar do fim anterior, o fim é limpo sozinho.
- **Horário:** a hora local é respeitada; 22:00 continua no mesmo dia.
- **Google Agenda:** o evento acompanha a remarcação e o cancelamento (best-effort).
- **Cancelar e reativar:** depois de cancelar, dá pra marcar de novo; a gravação volta como Remarcada e mantém o histórico.

## Calendário

- **Bug corrigido:** `isoData` usava o dia em UTC. Agora usa o dia local; antes, horários à noite podiam cair no dia seguinte.
- **Ocorrências antigas:** continuam no calendário como Remarcada ou Cancelada.
- **Modal da ocorrência:** mostra o mês de referência, "Remarcada para", "Data anterior" e o botão "Abrir gravação".
- **Datas sem hora:** gravações sem horário aparecem como dia inteiro (`sem_horario`).
- **Views atualizadas:** `calendario_ocorrencias_resumo` e `agenda_compromissos`.

## Linha Editorial

- Um conteúdo da Linha Editorial pode entrar como item da gravação (tipo `conteudo`), mostrando formato, data de postagem e linha.
- O item só faz referência ao conteúdo; nada muda na Linha Editorial.
- Conforme a especificação, esta fase não mexe com datas comemorativas nem com o Núcleo7.

## Painel

- **Dados:** o Painel do videomaker lê `gravacoes_resumo`, que agora traz `videomaker_id`, `total_itens`, `itens_gravados`, `concluida_em` e o mês de referência.
- **O que o videomaker vê:** só as gravações atribuídas a ele e as que ainda não têm responsável.
- **Contagens:** `painel_producao_contagens` passou a contar Remarcada.
- **Lista de Gravações:**
  - filtros por cliente, mês de referência (incluindo "sem mês"), responsável e status;
  - agrupada por mês de referência, com as antigas por último;
  - cada cartão mostra mês, data e "x/y gravados".

## Mobile

- **Layout:** pensado primeiro para o celular. O checklist vem logo abaixo das ações e a coluna lateral desce para baixo.
- **Toque:** alvos de pelo menos 44px, ampliados em telas de toque.
- **Larguras verificadas sem rolagem horizontal:** 1440, 1024, 390, 360 (modo escuro) e 844×390 (paisagem).
- **Modo escuro:** usa os tokens existentes; sem cores fixas novas.

## Permissões

| Ação | Admin/Coord | Videomaker responsável | Outros internos |
|---|---|---|---|
| Ver gravação / itens / histórico | ✓ | ✓ | ✓ (leitura) |
| Marcar item gravado | ✓ | ✓ | — |
| Adicionar/editar/remover/mover item | ✓ | — | — |
| Marcar/remarcar/concluir/cancelar | ✓ | — | — |
| Editar mês/responsável/local | ✓ | — | — |

- A tela esconde as ações sem permissão.
- O banco valida tudo de novo nas RPCs, com `SECURITY DEFINER` e checagem de papel. Nos testes, o designer foi recusado.

## Banco / migrations

Arquivo: `migration_gravacoes_2.sql` (aplicado).

- **Colunas novas em `gravacoes`:** `competencia_ano`, `competencia_mes`, `videomaker_id` (FK perfis), `concluida_em` e `concluida_por`.
- **Em `gravacoes_ocorrencias`:** coluna nova `sem_horario`.
- **Tabelas novas:** `gravacao_itens` e `gravacao_historico`.
- **Triggers:** `gravacoes_regras_antes`, `gravacoes_historico_depois`, `gravacoes_ocorrencias_sincronizar` e `roteiros_itens_gravacao`.
- **RPCs:**
  - novas: `gravacao_item_*`, `gravacao_agendar`, `gravacao_concluir` e `gravacao_cancelar`;
  - redefinidas: `calendario_ocorrencia_remarcar`, `calendario_marcar_gravacao` e `calendario_criar_gravacao_de_evento`.
- **Views:** `gravacoes_resumo`, `calendario_ocorrencias_resumo` e `agenda_compromissos` ganharam colunas novas; a view `gravacao_itens_resumo` é nova.
- **Notificações:** o responsável é avisado quando é atribuído e quando a gravação é remarcada, via `eventos_dominio` + `notificacoes`.
- **Endurecimento:** `search_path` fixo nas funções novas e EXECUTE revogado das funções de trigger para anon/authenticated.

## Segurança / RLS

- **Tabelas novas:** `gravacao_itens` e `gravacao_historico` têm RLS ligado, SELECT só para `sou_equipe_interna()` e nenhuma escrita direta (tudo passa pelas RPCs).
- **RPCs novas:** só o papel `authenticated` executa; `anon` não. O advisor do Supabase não aponta nenhum problema novo além do "SECURITY DEFINER executável por authenticated", que é intencional porque as funções checam o papel por dentro.
- **Links:** só http(s), validados no banco.
- **⚠️ Achado antigo, ainda aberto:** as tabelas `gravacoes`, `roteiros`, `cenas`, `conteudos`, `linhas_editoriais` e `clientes` continuam com RLS aberto (`true` para anon e authenticated). O "corte do RLS" (CORTE_RLS.md) nunca foi aplicado. Não corrigi nesta fase porque o risco de quebrar o portal e o login do cliente é alto. Precisa de uma rodada própria.

## Performance

- **Itens:** vêm de uma consulta à view `gravacao_itens_resumo`, com índice por gravação.
- **Detalhe:** histórico e ocorrências carregam em paralelo e sem bloquear, com skeletons e controle de geração para descartar respostas atrasadas.
- **Lista de Gravações:** a lista já vem com `total_itens` e `itens_gravados` da view, sem consulta extra por cartão; os filtros rodam na própria tela.
- **Índices novos:** mês de referência, videomaker e os índices únicos parciais dos itens.
- **Service worker:** cache em `roteiros-b7-v106`.

## Arquivos alterados

**Novos:**

- `js/gravacao.js`
- `styles/gravacao.css`
- `migration_gravacoes_2.sql`

**Alterados:**

- `index.html`
- `sw.js`
- `js/app.js`
- `js/editor.js`
- `js/dashboard.js`
- `js/calendario.js`
- `js/central.js`
- `js/painel.js`
- `js/database.js`

Também vêm no pacote as mudanças do g:

- `js/usuarios.js`
- `js/design.js`
- `js/video.js`
- `supabase/functions/b7-auth/index.ts`
- `migration_funcao_extra_designer.sql`

## Tests

Todos estes foram executados.

**Banco:** cenários rodados em transação com rollback.

- Mês e data:
  - INSERT sem mês é recusado;
  - apagar o mês é recusado;
  - agendar em 28/09 mantém o mês 10;
  - duas remarcações ficam no histórico como remarcada → remarcada → marcada (atual);
  - 22:00 fica no mesmo dia.
- Itens:
  - URL inválida é recusada;
  - roteiro duplicado é recusado;
  - 4 de 6 itens gravados sincronizam os roteiros, e desmarcar volta o roteiro para "Pronto para gravar";
  - mudança de status no editor sincroniza o item;
  - remoção suave funciona.
- Status:
  - concluir mantém os itens parciais;
  - remarcar depois de concluir é recusado;
  - cancelar e reativar dá Remarcada, com o histórico cancelada → marcada.
- Permissões e avisos:
  - o designer é recusado;
  - o videomaker responsável consegue marcar item;
  - a notificação é criada.
- Calendário: as funções sincronizam data, hora e situação.
- Depois do endurecimento, como authenticated: criar com mês, agendar às 22:00 e o roteiro gerar o item automático continuam funcionando.

**Interface:** harness no Playwright com dados simulados.

- Telas: renderização em 5 larguras (1440, 1024, 390, 360 escuro, 844×390) sem rolagem horizontal, mais os estados vazio, legado, erro dos itens e "todos gravados".
- Papéis: designer em modo leitura; videomaker responsável marca, mas não edita.
- Lista: filtros de mês "sem" e de status Concluída.
- Nova gravação: sem mês não cria; a data sugere o mês; o mês escolhido à mão não é sobrescrito; cria e agenda com os valores certos.
- Adicionar itens:
  - trend: `javascript:` é recusado e link sem protocolo vira https;
  - seletor: mostra o mês de referência primeiro e desabilita o que já está na gravação;
  - roteiro existente e conteúdo editorial são adicionados.
- Checklist e remarcação: marcar item chama a RPC; remarcar exige data e envia data local + hora + motivo.
- Regressão:
  - `node --check` em todos os JS;
  - navegação para 10 combinações de papéis;
  - Painel único e múltiplo;
  - Painel Design e smoke do index.

**Não testado:** login real no app publicado (não uso senhas) e a chamada real ao Google Agenda.

## Pendências

1. **RLS aberto** nas tabelas principais (veja Segurança). Recomendo priorizar.
2. **Google Agenda:** marcar a primeira data pelo detalhe da gravação ainda não cria o evento. Só a remarcação e o cancelamento sincronizam; marcar pelo Calendário continua criando normalmente.
3. **11 de 20 gravações antigas sem mês de referência.** Dá pra definir em Editar; elas aparecem agrupadas no fim da lista.
4. **Não existem hoje usuários só videomaker:** a função está como função extra. O filtro "minhas ou sem responsável" do Painel só tem efeito quando houver responsáveis atribuídos.
5. **Inconsistência "Nori":** a situação está como Gravada, mas a ocorrência está cancelada. É um dado antigo que precisa ser revisado à mão.
6. **Validação com login real** depois de publicar: equipe, videomaker e cliente no portal.
7. **A busca global não foi alterada:** ainda não procura por itens da gravação.
