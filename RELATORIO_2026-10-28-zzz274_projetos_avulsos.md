# zzz274 — Projetos avulsos

**Versão:** `2026-10-28-zzz274` · cache `roteiros-b7-v476`

## O que é
Cliente que compra um trabalho pontual (um vídeo, uma edição) e não tem mês contratado. Três tipos de projeto:

| Tipo | A B7 faz | O cliente faz |
|---|---|---|
| Vídeo completo | roteiro, gravação, edição | aprova o roteiro |
| Cliente grava | roteiro, edição | aprova o roteiro, grava e manda pelo Drive |
| Só edição | edição | manda o material pelo Drive |

Cliente avulso **não usa o portal**. O valor cobrado **não** é guardado (decisão do Kevin).

## Como funciona
- **Contrato do cliente** (Novo cliente / Editar cliente): Mensal ou Avulso. A etiqueta "avulso" aparece na lista de clientes e no cabeçalho do cliente. A lista de clientes ganha os filtros Mensais/Avulsos.
- **Novo projeto avulso**: no botão Criar, no cabeçalho do cliente (no avulso é o botão principal), na seção Projetos do cliente e em `#/projetos`. Ao criar, o banco já monta:
  - completo: uma gravação (na agenda, se tiver data), N roteiros e N demandas de edição travadas;
  - cliente grava: uma gravação "pelo cliente" (sem data, só para guardar os roteiros), N roteiros e N demandas travadas;
  - só edição: N demandas travadas.
- **Projeto** (`#/projetos/<id>`): linha do tempo + cartão "agora" com o próximo passo:
  - Roteiro → "Escrever roteiro", "Enviar no WhatsApp" (o roteiro em texto, com as cenas numeradas), "PDF" e "Cliente aprovou o roteiro";
  - Gravação → "Abrir a gravação" e "Gravação feita — liberar edição" (concluir a gravação na tela dela também libera);
  - Material → campo do link do Drive, "Pedir no WhatsApp" e "Material recebido" (exige o link);
  - Edição/Aprovação → acompanha as demandas sozinho; fecha como entregue quando todas forem entregues; "Marcar tudo como entregue";
  - menu ⋯: trocar o link do Drive, cancelar; entregue/cancelado: reabrir ou "Novo projeto para este cliente".
- **Lembrete**: projeto esperando material há 3+ dias avisa a coordenação ("Cobrar o material do cliente"), de 3 em 3 dias, às 10h.
- **Edição de vídeo**: as demandas do projeto têm a etiqueta "Avulso" (e "aguardando gravação/material" enquanto travadas), com link para o projeto.
- **Gestão → Avulsos**: projetos em andamento, esperando material, entregues no mês.
- **Panorama e Saúde dos clientes**: cliente avulso não entra (não tem mês para atrasar).
- **Menu**: "Projetos avulsos" aparece na barra lateral quando existe algum projeto.
- **Permissão**: ação nova "Criar e acompanhar projetos avulsos" (`projeto.gerir`, padrão: coordenador; admin sempre). Ver a lista é de quem tem o módulo Clientes.

## Banco (migrations projetos_avulsos_1, _2, _3_resumo)
- `clientes.contrato` ('mensal'|'avulso'), coluna nova em `clientes_resumo`.
- Tabela `projetos_avulsos` (RLS: leitura da equipe interna; escrita só pelas funções).
- `gravacoes.projeto_id`, `gravacoes.pelo_cliente`, `demandas_edicao.projeto_id`.
- Funções: `projeto_avulso_criar`, `projeto_avulso_avancar`, `projetos_avulsos_listar`, `_projeto_liberar_edicao`, `_projetos_lembrar_material`.
- Gatilhos: `zz_projeto_sync_demanda` (etapa acompanha as demandas) e `zz_projeto_sync_gravacao` (gravação concluída libera a edição).
- `notif_verificar_agendados` chama o lembrete às 10h; `panorama_mes` e `gestao_painel` filtram `contrato = 'mensal'`.
- `demandas_edicao_resumo` ganhou `projeto_id`, `projeto_nome`, `projeto_tipo`, `projeto_etapa`.
- Sem DROP: a origem da demanda continua 'manual' (o vínculo é o `projeto_id`).

## Testado
- No banco, numa transação desfeita no fim: os 3 tipos criados; completo → roteiro aprovado → gravação concluída libera 2 demandas; cliente grava → recusa "material recebido" sem link, aceita com link; só edição → aguardando aprovação → entregue acompanham sozinhos; lista e avisos gerados.
- Teste de fumaça com `#/projetos` e `#/cliente/c1/projetos`; prints de lista, projeto, cliente, criar, editar cliente, Edição de vídeo, Gestão e celular.

## Arquivos
`js/projetos.js` (novo), `js/dashboard.js`, `js/video.js`, `js/whatsapp.js`, `js/gestao.js`, `js/topo.js`, `js/nav.js`, `js/app.js`, `js/permissoes.js`, `js/novidades.js`, `js/auth.js`, `sw.js`, `index.html`, `styles/dashboard.css`, `testes/fumaca.mjs`, `migration_projetos_avulsos.sql`.
