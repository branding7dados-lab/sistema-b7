# Relatório 2026-10-04-zzz45 — Revisão geral do sistema

Revisão completa pedida pelo Kevin: auditoria de código, segurança e interface,
mais o PDF e o README novos. 21 achados; 11 corrigidos aqui.

## Corrigidos

**Alto**
- `js/semana.js` — "Duplicar para outra semana" deslocava as demandas sempre 7 dias,
  não importa a semana escolhida. Duplicar para três semanas à frente jogava todas
  as demandas para fora do intervalo novo. Agora o deslocamento é a distância real.

**Médio**
- `js/database.js` + `js/gravacao.js` — `roteirosDoCliente` estava definida DUAS vezes
  no mesmo objeto. A segunda vencia, então quem chamava sem limite (o seletor de
  "Roteiro existente") recebia 5 roteiros em vez de 200, com a gravação em outro
  formato: agrupamento por mês sempre vazio e subtítulo em branco. Removida a
  duplicata; a sobrevivente passou a trazer competência e status.
- `js/video.js` — `versoesAtual`/`comentariosPorVersao` eram gravados ANTES do guard
  de rota. Abrir a demanda A e trocar para a B antes de carregar deixava a tela de B
  com as versões de A, e "enviar para aprovação"/"registrar entrega" agiam no id errado.
- `js/design.js` — "Assumir demanda (N)" recarregava `dados`, mas a página da linha
  desenha a partir de `itensLinha`. A tela não mudava nada depois da ação.
- `js/design.js` — `redesenharTela()` na página da linha: as ações da gaveta atualizam
  o objeto de `dados`, mas a tela lê `itensLinha`. Progresso, percentual e contadores
  ficavam parados. Agora as duas listas são costuradas antes de desenhar.
- `js/design.js` — "← Voltar ao Design" não mexia no hash; recarregar voltava para a linha.
- `sw.js` — `js/previa-usuario.js` estava fora da CASCA. Sem rede, "Visualizar como…"
  sumia em silêncio.
- `js/linha.js` — duplicar a linha de dezembro sugeria janeiro, mas do MESMO ano.
- `js/portal.js` — `new Date().toISOString()` para "hoje": depois das 21h no Brasil a
  gravação de hoje sumia do portal. Passou a usar `B7.UI.hojeISO()`.

**Baixo**
- `js/ui.js` — `esc()` passou a escapar também a aspa simples.
- `js/perfil.js` — listener de `resize` acumulava a cada abertura do perfil.

## Segurança — correção escrita, NÃO aplicada

`migration_rls_corte_2.sql` (30/09) trocou a escrita de 18 tabelas de `sou_equipe()`
[admin, coordenador] para `sou_equipe_interna()` [+ designer, videomaker], com `for all`.
Designer e videomaker ganharam insert/update/delete em clientes, linhas_editoriais,
conteudos, roteiros, gravacoes e status_semanais de QUALQUER cliente — contrariando
migration_rls.sql:124, migration_design.sql:849 e o comentário de js/permissoes.js:44.

`migration_rls_corte_3.sql` devolve o desenho original (leitura para a equipe interna,
escrita só para a coordenação, atividades como exceção). **Não foi rodada no banco** —
muda o acesso da equipe e precisa da decisão do Kevin.

## Em aberto (decisão de produto)
- `js/linha.js` + `js/semana.js` — `data_postagem <= hoje` promove a "Publicado" o
  conteúdo de hoje logo pela manhã; o resto do sistema usa `<` (estritamente antes).
- `js/linha.js` — "Copiar datas de postagem" copia as datas literais do mês de origem.
- `js/movimento.js` — `fotografar()` serializa o painel inteiro em TODO clique.
- `supabase/functions/oportunidades-sync` — rodada normal aceita chamada sem token.

## Entregas
- `Revisao_Sistema_B7_2026-10-04.pdf` — 11 páginas, com os prints das 17 telas.
- `README.md` reescrito. O antigo dizia "o sistema roda sem login", o que deixou de
  ser verdade há muito tempo e era perigoso.
- `docs/prints/` — prints usados no README.

VERSAO zzz45 · cache v250.
