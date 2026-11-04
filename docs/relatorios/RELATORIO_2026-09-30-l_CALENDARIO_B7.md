# Relatório 2026-09-30-l — Fase 6: Calendário B7 Unificado

Pacote: `atualizacao-2026-09-30-l.zip` (inclui k, j, i, h e g). Só front-end; banco intocado.

## Calendário B7
Um único calendário em `#/calendario` ("Calendário" na navegação), que responde: o que acontece na operação, quando, para qual cliente, com quem — e onde abrir o registro real.

Arquitetura em duas camadas:
- **`js/eventos.js` (B7.Eventos)** — camada de eventos: um adaptador por domínio lê o registro canônico da janela visível e o normaliza num formato único de evento. Utilitários de data pura centralizados (sem UTC). Carga paralela, cache por janela, erro isolado por domínio. **Nada é persistido.**
- **`js/calendario.js` (B7.Calendario)** — só desenho e interação: Mês, Semana, Dia (desktop/tablet) e agenda (tela estreita), filtros, prévia e folhas. Os modais da integração Google e das ações de ocorrência (marcar, remarcar, cancelar, concluir, vincular) foram reaproveitados.

Pronto para `Oportunidades` (fase 7): basta registrar um adaptador novo em `B7.Eventos.ADAPTADORES` e um item em `DOMINIOS`/`TIPOS` — o desenho, filtros e agenda já tratam qualquer domínio.

## Calendários anteriores
| Implementação | Destino |
|---|---|
| `js/calendario.js` "Calendário de Gravações" (só funcionava com o Google conectado) | **Substituído** pelo Calendário B7; modais do Google e das ocorrências **reaproveitados** |
| Calendário mensal da aba Postagens da Linha Editorial (`linha.js`: `calendario()`, `celulasDoMes`, `eventosPorDia`…) | **Removido**; o botão virou "Ver no Calendário" → Calendário B7 filtrado em Publicações, no cliente e no mês da linha. A lista continua. A consulta de gravações que só alimentava esse calendário saiu |
| Publicações do Dia (`#/publicacoes`) | **Mantida** (é lista operacional do dia, não um motor de calendário) + atalho "Ver no calendário" que acompanha o dia escolhido |
| Gravações (lista e detalhe) | Atalhos "Calendário" (lista) e "Ver no calendário" (menu da gravação → semana da gravação) |
| Painel "Minha semana" / "Próximos" | Continuam como resumo; ganharam "Ver no calendário" (semana) |

## Fontes de eventos
- **Gravações** — `gravacoes_ocorrencias` via `calendario_ocorrencias_resumo` (data física de cada ocorrência, atual e históricas). Google: eventos **sem vínculo** de `calendario_eventos_resumo`, só para admin/coordenador com a conta conectada (a integração já existia; vinculados não duplicam).
- **Publicações** — `conteudos.data_postagem` (Linha Editorial), nova leitura enxuta `publicacoesCalendario`.
- **Vídeo** — `demandas_edicao.prazo` via `demandas_edicao_resumo` (`prazosVideoPeriodo`).
- **Design** — `prazo` das peças via `design_resumo` (`prazosDesignPeriodo`).
- **Aprovações** — não entram (ver abaixo).

## Modelo unificado
Cada linha canônica vira `{ id estável ('<domínio>:<id>'), domínio, fonteId, título, cliente, dia (AAAA-MM-DD local), hora/horaFim ou dia inteiro, responsável (id canônico + nome), status + rótulo + tom, cancelado, concluído, histórico, href canônico }`. **Derivado em memória, nunca gravado.** Dedup por identidade estável; evento do Google já vinculado a uma gravação não aparece de novo.

## Gravações
- **Data física**: o evento fica no dia em que a ocorrência acontece (no fuso local; 22:00 não pula de dia).
- **Mês de referência**: independente — só aparece na prévia/agenda como "Referente a Outubro de 2026". Gravação de 28/09 referente a Outubro fica em 28/09.
- **Remarcação**: cada data antiga continua no calendário como "Remarcada" (borda tracejada, "data antiga"), a atual como Marcada — sem duas gravações ativas; várias remarcações (10 → 15 → 20) aparecem todas, em ordem.
- **Status**: Marcada azul, Remarcada âmbar, Concluída verde, Cancelada vermelha — sempre com texto. Canceladas ficam ocultas por padrão ("Mostrar canceladas" as exibe; nada é apagado).
- Prévia: tipo, cliente, quando, referência, status, responsável, local; "Abrir gravação" e, para gestores, "Remarcar, concluir…" (modal existente, com histórico e Google).

## Publicações
Um evento por conteúdo com `data_postagem`, dia inteiro (sem hora inventada), com formato/canal e status da Linha. Abre `#/linha/<linha>/criativos?conteudo=<id>` (ou o dia em Publicações quando não há linha). Nenhuma cópia criada.

## Vídeo
`prazo` (data) da demanda de edição — compromisso real, não criação/atualização. Rótulo "Prazo", status da demanda (Entregue = concluído; Descartado = cancelado, oculto por padrão). Abre `#/video/<id>`.

## Design
`prazo` da peça. Status do fluxo de Design (Finalizado = concluído). Abre `#/design/<id>`. Hoje nenhuma peça tem prazo preenchido no banco — o domínio já está ligado e aparece assim que houver.

## Aprovações
**Não incluídas.** O fluxo de aprovações não tem prazo nem data agendada canônica (só `enviado_em`/`decidido_em`). Inventar um prazo a partir do envio seria falso; o filtro "Aprovações" não aparece.

## Filtros
Tipo (Todos · Gravações · Publicações · Vídeo · Design — só os que a pessoa pode ver, com contagem do período), Cliente (clientes autorizados pelo banco), Responsável (por id canônico; só aparece quando há responsáveis no período), "Mostrar canceladas", "Limpar". Combinam por E. Estado na URL: `#/calendario?v=mes|semana|dia&d=AAAA-MM-DD&tipo=…&cliente=…&resp=…&canc=1` (deep links dos módulos usam isso).

## Desktop
- **Mês**: grade estrutural de 7 colunas (DOM…SÁB), semanas completas com dias vizinhos, colunas de largura fixa (títulos truncados), até 3 itens por dia e "+N eventos" abrindo a agenda do dia; clicar no número abre a vista Dia; "Hoje" destacado.
- **Semana**: 7 colunas; no topo prazos/publicações (dia inteiro), embaixo compromissos com horário em ordem.
- **Dia**: agenda agrupada (Gravações, Publicações, Prazos de vídeo, Prazos de design, Agenda Google) — só grupos com itens.
- Navegação ‹ Hoje ›, rótulo do período ("Outubro de 2026", "04 OUT — 10 OUT", "30 de setembro de 2026"), Mês | Semana | Dia. Sem arrastar-e-soltar (remarcar continua sendo ação explícita com histórico).

## Mobile
Abaixo de 760 px de largura (por largura, não por aparelho): agenda. Mês/ano no topo como botão que abre um **seletor de mês** (folha com a grade e pontos de eventos), ‹ Hoje › por semana, **faixa de 7 dias** com pontos por domínio e o dia escolhido destacado, e a agenda agrupada do dia. Eventos abrem em folha. Alvos ≥ 44 px, sem rolagem lateral, respiro para a área segura inferior. Tablet/paisagem acima de 760 px usam a grade.

## Painel
"Minha semana" (todos os painéis) e "Próximos" ganharam "Ver no calendário" (semana). As fontes são as mesmas (ocorrências, conteúdos, prazos) e ambos usam data pura local. O Painel ainda tem as próprias consultas/adaptadores; a troca para `B7.Eventos` fica como próximo passo (ver Pendências) — o Painel continua resumo, sem Mês/Semana/Dia.

## Permissões
Escopo por permissão de rota (`B7.Perm.podeRota`) + RLS do banco como autoridade:
Gravações — quem acessa o calendário (equipe interna); Publicações — quem acessa Publicações ou Linha; Vídeo — quem acessa Vídeo (inclui função extra); Design — quem acessa Design; Google sem vínculo — admin/coordenador. Cliente não acessa. Ações de gestão (marcar, configurações, remarcar) só admin/coordenador. Multifunção funciona sem troca de perfil.

## Performance
- Consultas **escopadas pela janela visível** (mês = semanas visíveis; semana; dia; agenda = semana), só as colunas usadas, com limite.
- Domínios carregados **em paralelo** (sem cascata).
- **Cache** por domínio + janela (45 s para janelas atuais/futuras, 10 min para passadas); voltar a um mês já visto não consulta de novo.
- Troca de período mantém a casca e os eventos anteriores (indicador "Atualizando…"), sem tela em branco.
- Sincronização com o Google em segundo plano (no máximo a cada 5 min por janela), sem segurar a tela.
- Dedup por identidade estável.
- Realtime não foi adicionado nesta fase (opcional pela spec).

## Banco / migrations
Nenhuma migration de banco foi necessária para o Calendário B7 Unificado.

## Arquivos alterados
- Novo: `js/eventos.js`.
- `js/calendario.js` (reescrito: vistas, filtros, prévia, agenda; modais reaproveitados; "Marcar gravação" no padrão novo de modal).
- `js/database.js` (`publicacoesCalendario`, `prazosVideoPeriodo`, `prazosDesignPeriodo`).
- `js/app.js` (passa os parâmetros da URL ao calendário).
- `js/linha.js` (remove o calendário próprio → link), `js/publicacoes.js`, `js/dashboard.js`, `js/gravacao.js`, `js/nav.js` ("Calendário"), `js/painel.js`, `js/painel-coord.js`, `js/painel-design.js`, `js/painel-multi.js` (links).
- `styles/calendario.css` (bloco `.cb-*`), `styles/conteudo.css`, `styles/dashboard.css`, `styles/painel.css`.
- `index.html`, `sw.js` (cache `roteiros-b7-v110`).

## Tests
Executados em harness Playwright com dados simulados (48 checagens, todas OK), mais revisão visual:
- Gravação na data física (28/09) com "Referente a Outubro de 2026"; não aparece em outubro só pela referência; abre `#/gravacao/<id>`.
- Remarcações 10 → 15 → 20/10: 3 datas, 1 ativa, antigas rotuladas "Remarcada"; 22:00 fica em 20/10.
- Cancelada oculta por padrão e visível com o filtro; filtro vai para a URL.
- Publicação uma vez, sem hora, abre o conteúdo; prazo de vídeo sem hora abre a demanda; design abre a peça.
- Overflow: coluna não alarga; "+5 eventos" abre os 7.
- Filtros combinados (Gravações + Mais Sorrisos); Responsável por id; deep link `tipo=publicacoes`.
- Grade de mês com início em todos os 7 dias da semana (24 meses): sempre 7 colunas e semanas completas.
- Data pura em 4 fusos (São Paulo, UTC, Honolulu, Tóquio): 08/10 e 10/10 no dia certo.
- Celular 390 px: agenda, faixa, troca de dia, folha do evento, seletor de mês, sem rolagem lateral, alvos ≥ 44 px.
- Papéis: Admin, Admin+Videomaker, Coordenador+Designer, Videomaker+Designer, Designer, Videomaker, Cliente (sem acesso); Designer sem ações de gestão.
- Falha parcial (Vídeo/Design): aviso localizado, resto visível.
- Troca de mês mantém a casca; consultas escopadas; cache ao voltar; Google conectado: evento sem vínculo + sincronização em segundo plano.
- Telas: 1440 (claro/escuro), 1024, 844×390, 390, 360 escuro.
- Regressões: navegação por papéis, Painel multifunção, smoke do index, `node --check` em todos os JS.
- Banco (somente leitura): as consultas por janela retornam os volumes esperados em outubro (113 publicações, 3 prazos de vídeo, 1 ocorrência, 4 eventos Google sem vínculo).

Não testado: login real no app publicado, sincronização real com o Google.

## Pendências
1. Painel: trocar as consultas próprias de "Minha semana"/"Próximos" pelos adaptadores de `B7.Eventos` (hoje: mesmas fontes e regra de data, mas código separado).
2. Realtime (opcional): atualizar o calendário quando uma gravação é remarcada ou uma data de postagem muda.
3. Design: nenhuma peça tem prazo preenchido — o domínio aparece quando houver.
4. Aprovações: só entram se passarem a ter prazo canônico.
5. Validar com login real (admin, coordenador, designer, videomaker) depois de publicar.
6. Fase 7 (Oportunidades/datas comemorativas) fora do escopo.
