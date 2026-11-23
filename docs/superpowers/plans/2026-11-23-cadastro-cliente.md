# Cadastro do cliente e pacotes (4.88.0): plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cadastro de cliente em etapas (Cliente · Marca · Pacote · Equipe · Observações), ficha "Cadastro" em
blocos na página do cliente, pacote ajustável por cliente e aba Pacotes na Gestão.

**Architecture:** uma migração (`zzz389`) cria as colunas e tabelas internas e três RPCs `security definer`
(ler o cadastro, salvar o cadastro, pacote efetivo). O front ganha um módulo novo, `js/cadastro-cliente.js`
(`B7.Cadastro`), usado pela janela "Novo cliente" e pela aba "Cadastro". `js/dashboard.js` só chama o módulo.

**Tech Stack:** JS puro (`B7.*`), Supabase Postgres + RLS, testes em Node + Playwright (`testes/`) e Postgres 16
local (`testes/sql/*.sh`).

**Spec:** `docs/superpowers/specs/2026-11-23-cadastro-cliente-design.md`

## Global Constraints
- Só o **nome** é obrigatório. Todas as outras etapas podem ficar vazias.
- Quem edita cliente: `pode_nivel('clientes', 2)` ou `sou_admin()`. Quem edita pacote: `pode_nivel('linhas', 2)`.
- Dados internos (CNPJ, responsável, combinado, equipe, marca) **nunca** legíveis pelo papel `cliente`.
- O grupo do WhatsApp sai do cadastro; `clientes_interno.whatsapp_grupo` não é apagado.
- Migração `zzz389_cadastro_cliente.sql` roda 2× sem erro.
- Cores `#RRGGBB`, no máximo 8. Link da marca começa com `https://`. CNPJ 14 dígitos. WhatsApp 10–13 dígitos.
- Trocar `pacote_id` limpa `pacote_ajuste`. Meses antes de `pacote_desde` não entram no Contratado × entregue.
- Versão `4.88.0` em `js/auth.js` e `sw.js` (`b7-v4.88.0`), com entrada em `js/novidades.js`.

## Review Focus
1. **Cliente do portal lendo dado interno:** `cliente_cadastro` chamado por papel `cliente` → recusa (42501).
   Teste SQL na Task 1.
2. **Pacote arquivado ou apagado em uso:** `cliente_pacote_efetivo` devolve os itens (arquivado) ou vazio
   (apagado, `pacote_id` nulo), sem erro. Teste SQL na Task 1.
3. **Ajuste inválido:** quantidades 0 em tudo, tipo desconhecido ou soma > 120 → `cliente_cadastro_salvar`
   recusa com mensagem em português, sem gravar nada do resto. Teste SQL na Task 1.
4. **Criar cliente e fechar no meio:** o cliente nasce na etapa 1; fechar a janela depois não perde o cliente e
   a ficha mostra "Completar". Teste de navegador na Task 3.
5. **Texto com HTML nos campos** (nome do responsável `<img onerror>`, nome de cor): aparece como texto na ficha.
   Teste de navegador na Task 4.

---

### Task 1: Banco (`zzz389`)

**Files:**
- Create: `supabase/sql/zzz389_cadastro_cliente.sql`
- Create: `testes/sql/cadastro.sh`, `testes/sql/cadastro.test.sql`, `testes/sql/esbocos-cadastro.sql` (no molde de
  `testes/sql/gestao.sh`)

**Interfaces — Produces:**
- Colunas: `clientes.pacote_ajuste jsonb`, `clientes.pacote_desde date`;
  `clientes_interno.cnpj, cidade, resp_nome, resp_cargo, resp_whatsapp, resp_email, combinado text`,
  `clientes_interno.inicio_servico date`.
- `cliente_marca (client_id pk, cores jsonb default '[]', fonte_titulo, fonte_texto, link, estilo text, updated_at)`
  e `cliente_responsaveis (client_id, funcao check in ('coordenador','designer','videomaker'), perfil_id, pk (client_id, funcao))`.
  RLS: select para `sou_equipe_interna() or sou_designer() or sou_videomaker()`; sem insert/update/delete direto.
- `cliente_pacote_efetivo(p_cliente uuid) returns jsonb` → `{pacote_id, nome, arquivado, ajustado, desde, itens}`
  (itens = `pacote_ajuste` se houver, senão os do pacote; `itens: []` sem pacote). Só equipe interna.
- `cliente_cadastro(p_cliente uuid) returns jsonb` → `{cliente:{nome, contrato, modo, logo_url, logo_path},
  interno:{…colunas acima, observacoes}, perfil:{nicho, site, instagram}, marca:{…}, pacote:<efetivo>,
  equipe:{coordenador, designer, videomaker}}` (cada um `{id, nome}` ou null). Só equipe interna.
- `cliente_cadastro_salvar(p_cliente uuid, p_dados jsonb) returns jsonb` → grava **só as chaves presentes** entre
  `interno`, `perfil`, `marca`, `pacote` (`{pacote_id, ajuste|null, desde}`), `equipe`; devolve `cliente_cadastro`.
  Exige `pode_nivel('clientes', 2) or sou_admin()`. Valida conforme Global Constraints; pessoa da equipe precisa
  ser interna ativa com a função (principal ou `tenho_funcao_extra`).
- Trigger em `clientes`: `pacote_id` mudou e `pacote_ajuste` não veio junto → `pacote_ajuste := null`.
- `_contratado(p_ini)` passa a usar o ajuste (somando as quantidades por tipo) e a pular cliente com
  `pacote_desde > fim do mês`; `gestao_contratado` devolve esses em `comeca` (`[{id, nome, desde}]`).
- `linha_aplicar_pacote`: quando `p_pacote` = pacote do cliente e há ajuste, usa os itens do ajuste.

- [ ] **Step 1:** escrever `cadastro.test.sql` com os casos: salvar e ler cada bloco; salvar só `marca` não mexe
  em `interno`; cor `#12` recusada; 9 cores recusadas; link `http://x` recusado; CNPJ com 13 dígitos recusado;
  ajuste com soma 0 recusado; efetivo sem ajuste = itens do pacote; com ajuste = ajuste; trocar `pacote_id`
  limpa o ajuste; pacote arquivado ainda devolve itens; `_contratado` com ajuste `[Card 10]` contra padrão
  `[Card 12]` dá contratado 10; `pacote_desde` no mês seguinte tira do `_contratado` e põe em `comeca`;
  papel `cliente` em `cliente_cadastro` e em `select from cliente_marca` → recusa/0 linhas; designer sem nível
  em `cliente_cadastro_salvar` → 42501; responsável que não é designer na função designer → recusa.
- [ ] **Step 2:** rodar `bash testes/sql/cadastro.sh` — esperado: falha (funções não existem).
- [ ] **Step 3:** escrever a migração.
- [ ] **Step 4:** rodar `bash testes/sql/cadastro.sh` e `bash testes/sql/gestao.sh` — esperado: `OK … (aplicada 2×)`.
- [ ] **Step 5:** commit.

### Task 2: Aba Pacotes na Gestão

**Files:** Modify `js/gestao.js` (lista de abas, ~34 e ~71), `js/pacotes.js`; Test `testes/gestao-extra.test.mjs`.

**Interfaces — Consumes:** `B7.Pacotes.montar(alvo)` (já existe). **Produces:** aba `pacotes` na Gestão, visível
para quem tem `podeNivel('linhas', 'ver')`; em cada pacote, "N clientes" (contagem por `clientes.pacote_id`).

- [ ] **Step 1:** teste de navegador: abrir `#/gestao`, tocar em "Pacotes", ver a lista e o botão "Novo pacote".
- [ ] **Step 2:** rodar — falha. **Step 3:** implementar. **Step 4:** rodar — passa. **Step 5:** commit.

### Task 3: `B7.Cadastro` e a janela "Novo cliente"

**Files:**
- Create: `js/cadastro-cliente.js`, `styles/cadastro.css` (ligar em `index.html` e na lista do `sw.js`)
- Modify: `js/database.js` (`cadastroCliente(id)`, `salvarCadastro(id, dados)`, `equipeInterna()` se não houver),
  `js/dashboard.js` (`modalNovoCliente` passa a chamar `B7.Cadastro.novo(aoCriar)`)
- Test: `testes/cadastro.test.mjs` (entra no `package.json`)

**Interfaces — Produces:**
- `B7.Cadastro.novo(aoCriar)` — janela com a faixa de etapas `1. Cliente · 2. Marca · 3. Pacote · 4. Equipe ·
  5. Observações`, botões "Voltar", "Continuar", "Pular" e "Concluir". "Continuar" na etapa 1 cria o cliente
  (`B7.DB.criarCliente`) e sobe a logo; as outras etapas salvam com `salvarCadastro` ao avançar.
- `B7.Cadastro.campos(bloco, dados)` → HTML dos campos de um bloco; `B7.Cadastro.ler(bloco, raiz)` → objeto pronto
  para `salvarCadastro` ou `{erro, campo}`. Blocos: `'cliente' | 'marca' | 'pacote' | 'equipe' | 'obs'`.
- `B7.Cadastro.validar` exportado para teste: `cnpj`, `whatsapp`, `email`, `cor`, `link`.

- [ ] **Step 1:** testes: `validar.cnpj('12.345.678/0001-90') === true`, 13 dígitos `false`; `validar.cor('#1a2B3c')`
  `true`, `'#12'` `false`; navegador: criar só com nome → cliente criado e janela na etapa 2; "Pular" até o fim
  → fecha sem erro; fechar na etapa 3 → `criarCliente` chamado 1 vez; etapa Pacote: escolher pacote mostra o
  resumo, "Ajustar só para este cliente" mostra uma linha por item com a quantidade do padrão; etapa Marca:
  adicionar 2 cores e remover 1 → `salvarCadastro` recebe 1 cor.
- [ ] **Step 2:** rodar — falha. **Step 3:** implementar. **Step 4:** rodar — passa. **Step 5:** commit.

### Task 4: Aba "Cadastro" na página do cliente

**Files:** Modify `js/dashboard.js` (seções do cliente ~1117–1400, `data-editar-cli` → abre a aba; a janela
"Editar cliente" ~3262 sai, o bloco de gravação fixa é reaproveitado), `js/cadastro-cliente.js`
(`B7.Cadastro.ficha(alvo, clienteId)`); Test `testes/cadastro.test.mjs`.

**Interfaces — Consumes:** `B7.Cadastro.campos/ler`, `cadastroCliente`, `salvarCadastro`.
**Produces:** `B7.Cadastro.ficha(alvo, clienteId, { podeEditar, gravacaoFixa })` — 5 blocos + "Gravação fixa"
(só quando `gravacaoFixa` vem, como hoje: administração e coordenação). Campo vazio = "—" + "Completar".
Cores como quadradinhos (`button` com `aria-label` = código; toque copia). Pacote ajustado mostra
"ajustado para este cliente" e "Voltar ao padrão". Trocar de pacote com ajuste pede confirmação
("O ajuste deste cliente vai ser descartado.").

- [ ] **Step 1:** testes de navegador: a aba mostra os valores; editar o bloco Cliente e salvar chama
  `salvarCadastro` só com `interno`/`perfil`; cancelar não chama; nome `<img src=x onerror=…>` aparece como
  texto; sem `podeEditar` não há botão "Editar"; "Voltar ao padrão" envia `ajuste: null`; `data-editar-cli`
  leva para a aba.
- [ ] **Step 2:** rodar — falha. **Step 3:** implementar. **Step 4:** rodar — passa. **Step 5:** commit.

### Task 5: Versão, ajuda e entrega

**Files:** `js/auth.js`, `sw.js`, `js/novidades.js`, `js/ajuda-dados.js` (tela Clientes: cadastro e pacotes).

- [ ] **Step 1:** versão `4.88.0` + novidades + ajuda.
- [ ] **Step 2:** `CHROMIUM=/opt/pw-browsers/chromium npm test` em `testes/` e os três `testes/sql/*.sh` — tudo passa.
- [ ] **Step 3:** conferir a tela no Chromium com capturas (janela de criar e ficha), celular e computador.
- [ ] **Step 4:** push, PR, revisão independente, corrigir o que for real, merge com os testes do GitHub verdes;
  conferir no log do `sql.yml` que a `zzz389` foi aplicada.
