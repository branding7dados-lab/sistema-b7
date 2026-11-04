# Relatório 2026-09-30-i: pendências da Fase 5

Pacote: `atualizacao-2026-09-30-i.zip`. Contém tudo do h e do g.

## Resolvido

### 1. Google Agenda na primeira data
Antes, marcar a data pelo detalhe da gravação, ou criar uma gravação já com data pela lista, não criava o evento no Google. Só a remarcação e o cancelamento sincronizavam.

Agora uma função única, `B7.Gravacao.googleAposAgendar`, trata os dois casos:
- **A gravação já tem evento:** o evento é movido para a nova data.
- **Ainda não tem evento, o Google está conectado e há horário:** o evento é criado com o título "Grav. <cliente>" (mesmo padrão do Calendário).
- **Sem horário de fim:** o evento fica com 1h de duração. Antes, a atualização gerava um evento de duração zero.
- **Sem horário de início:** o evento não é criado, porque o Google só aceita evento com hora. Aparece um aviso pedindo o início.
- **Falha no Google:** a data fica salva no B7 e aparece um aviso.

### 2. Mês de referência das gravações antigas
Das 11 gravações sem mês, 6 tinham o mês no próprio nome ("Gravações de Outubro", "Conteúdos Setembro"). Essas foram preenchidas pela migration `gravacoes_2_competencia_pelo_nome`: ano 2026, só gravações criadas em 2026, sem gerar histórico.

As outras 5 não têm sinal confiável e continuam no grupo "Sem mês de referência": "Gravação do dia 16/09", "Nori", "Grav. Natu Restaurante", "TRÁFEGO - PACK DE VÍDEOS E 30 VÍDEOS" e "SEU ROTEIRO FLOPA?". Dá para definir em Editar.

### 3. Busca global
- **Itens de gravação:** a busca agora encontra trends/referências e itens avulsos pelo título, com o grupo "Itens de gravação" mostrando o tipo, a gravação e o cliente. Roteiros e conteúdos já apareciam nos grupos próprios.
- **Resultados de gravação:** também mostram o mês de referência e o status.
- **Onde vale:** na paleta (Ctrl+K) e na busca do topo. Quem não pode abrir gravações não vê esses resultados.

### 4. Corte do RLS: APLICADO (migration `rls_corte_2`, autorizado pelo Yury)
Antes, 18 tabelas aceitavam leitura, escrita e exclusão de qualquer pessoa com a chave pública do site, mesmo sem login. A view `demandas_edicao_resumo` também ignorava o RLS.

- Tabelas: atividades, cenas, cliente_inteligencia, clientes, conteudos, frames, gravacoes, ideias, linhas_editoriais, onboardings, pilares, produtos, provas, roteiros, slides, status_itens, status_semanais, status_versoes.

**Agora:**
- **Sem login:** nenhum acesso (leitura e escrita negadas).
- **Equipe logada** (admin, coordenador, designer, videomaker): o mesmo acesso de antes.
- **Cliente logado:** só leitura, só da própria empresa (com serviço ativo) e só o material liberado (`visivel_cliente` / `publicado_em`).
- **`demandas_edicao_resumo`:** passou a respeitar o RLS de `demandas_edicao`.
- **Reverter, se preciso:** `migration_rls_corte_2_reverter.sql` no SQL Editor.

**Verificado no banco real,** com um cliente de teste criado e desfeito na mesma transação:

| Papel | Resultado |
|---|---|
| Sem login | clientes, gravações, roteiros e demandas negados; update negado |
| Admin | 20/20 gravações, 23/23 clientes, 441 demandas, escrita ok |
| Coordenador | 20 gravações, escrita ok |
| Designer | 20 gravações, 23 clientes, escrita ok |
| Cliente | 1 cliente (o dele), 0 gravações/roteiros/cenas/ideias/demandas, 3 conteúdos liberados, 0 de outras empresas, Portal com 3 itens; update e insert negados |

**Advisor de segurança:** sobraram só itens intencionais. `portal_gravacoes` é uma view definer que filtra por cliente e não é acessível sem login; as tabelas de token do calendário ficam trancadas e só a service role acessa.

### 5. "Nori" (Natu Restaurante)
O Yury confirmou que não foi gravada. O estado atual no banco já está coerente: situação Cancelada, roteiro "Pronto para gravar", nada marcado como gravado e data de 16/09 (a ocorrência cancelada). Nenhuma correção foi necessária.

## Arquivos alterados
- `js/gravacao.js`: googleAposAgendar, exportado.
- `js/dashboard.js`: criação com data sincroniza com o Google; busca do topo com itens e mês.
- `js/database.js`: `buscar` inclui os itens de gravação.
- `js/ui.js`: paleta com o grupo "Itens de gravação" e mês/status nas gravações.
- `sw.js`: cache em `roteiros-b7-v107`.
- Novos: `migration_rls_corte_2.sql` (aplicado) e `migration_rls_corte_2_reverter.sql` (emergência).

## Tests
Todos estes foram executados.

- **Google:** harness Playwright no fuso de São Paulo.
  - 22:00 cria o evento 01:00Z–02:00Z com título e local;
  - com evento existente, só atualiza;
  - com o Google desconectado, não faz nada;
  - sem horário, avisa e não cria;
  - sem erros de JS.
- **Regressão das telas de gravação:** 13 cenários visuais, todos os fluxos de interação (nova gravação, filtros, adicionar item, marcar, remarcar) e smoke do index.
- **Banco:** o backfill preencheu 6 gravações; ficaram 5 sem mês de 20.
- **`node --check`** em todos os JS.

**Não testado:** a busca contra o banco real (o sandbox não acessa a API REST); o código foi revisado e passou no `node --check`. Também não testei login real nem a chamada real ao Google.

## Pendências
1. Definir o mês das 5 gravações antigas restantes.
2. Depois de publicar, validar com login real (equipe e, quando existir, um cliente no Portal). Se alguma tela da equipe ficar vazia, rode o reverter e me avise.
