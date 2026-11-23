# WhatsApp com vários números: plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O B7 conecta vários números de WhatsApp (Videomakers, Designers, Coordenação…). O admin alterna entre eles ou vê todos; cada equipe vê só o seu número.

**Architecture:** O cadastro `wa_numeros` e a coluna `numero_id` (default = número padrão) entram em `wa_conversas` e `wa_mensagens`, com chaves compostas. O servidor resolve a instância do Evolution por número em cada pedido; o webhook reconhece o número pelo campo `instance`. O Otto fica preso ao número padrão por meio de um acesso embrulhado (`waPadrao`). Na Central, a conversa passa a ser identificada por (número, jid).

**Tech Stack:** HTML/CSS/JS sem build (`B7.*` em `js/`), Supabase Postgres + RLS, Edge Functions Deno/TS, Evolution API. Testes em Node 22 (`testes/`, sem framework) e um Postgres 16 local para a migração.

**Spec:** `docs/superpowers/specs/2026-11-23-whatsapp-varios-numeros-design.md`

## Global Constraints
- Versão **4.84.0**: `js/auth.js` `VERSAO`, `sw.js` `CACHE = 'b7-v4.84.0'`, registro em `js/novidades.js`.
- Migração: `supabase/sql/zzz383_wa_varios_numeros.sql`. Precisa ser idempotente (pode rodar 2×) e compatível com as funções antigas, porque roda antes do deploy.
- Instância semente: `b7-piloto`, nome "Videomakers", `equipes = {videomaker}`, `padrao = true`.
- Equipes válidas: `videomaker`, `designer`, `coordenador`.
- Otto e relógio só no número padrão. Nenhum arquivo do Otto chama `from('wa_conversas')` ou `from('wa_mensagens')` direto.
- Textos da tela em português simples, no tom das telas atuais. Classes CSS da Central com prefixo `wz-`.
- Nenhum segredo novo: a mesma `EVOLUTION_URL`/`EVOLUTION_API_KEY` servem todas as instâncias.

## Review Focus
1. **Mesmo grupo em dois números.** A mensagem chega duas vezes com o mesmo `id` e precisa virar duas linhas (uma por número), sem conflito. Teste na Task 1 (SQL) e na Task 3 (`gravar` com `numero_id`).
2. **Status ✓✓, apagar e editar de um número não podem mexer na cópia do outro.** Toda atualização por `id` filtra `numero_id`. Teste na Task 1 (PK composta) e revisão na Task 3.
3. **Designer abrindo `#/whatsapp?jid=…&num=<número dos vídeos>`.** Não pode ver nada (RLS) e não pode enviar: a Edge Function responde 403. Teste em SQL na Task 1 e com `podeVerNumero` na Task 2.
4. **Pessoa com um número só.** Não aparece barra de números e a Central fica igual a hoje. Teste `barraHtml` com 1 número = `''` na Task 6.
5. **Evento do Evolution com `instance` desconhecida ou vazia.** É ignorado e nunca cai no número padrão por engano. Teste `instanciaDoEvento` na Task 2 e no caminho da Task 4.

---

### Task 1: Banco: números, chaves compostas e acesso por número

**Files:**
- Create: `supabase/sql/zzz383_wa_varios_numeros.sql`
- Create: `testes/sql/wa-numeros.sh` (roda local, fora do `npm test`): sobe um Postgres 16 temporário, cria esboços mínimos (`auth.uid()`, `perfis`, `clientes`, `sou_admin()`, `tenho_funcao_extra()`, `eh_videomaker_elegivel()`, `wa_assistente`, `eventos_dominio`, `notificacoes`, `wa_contatos`), aplica `zzz340`, `zzz373`–`zzz375` e `zzz380` (colunas usadas), aplica `zzz383` **duas vezes** e roda `testes/sql/wa-numeros.test.sql`
- Create: `testes/sql/wa-numeros.test.sql` (asserções com `do $$ … assert …$$`)

**Interfaces:**
- Produces (SQL):
  - tabela `wa_numeros(id uuid pk default gen_random_uuid(), nome text not null, instancia text unique not null, cor text not null default '#1B8F6A', equipes text[] not null default '{}', padrao boolean not null default false, numero text, estado text, ativo boolean not null default true, ordem int not null default 0, criado_em timestamptz default now())`; índice único parcial `where padrao`.
  - `wa_numero_padrao() returns uuid` (stable, security definer).
  - `wa_conversas.numero_id uuid not null default wa_numero_padrao() references wa_numeros(id)`, com PK `(numero_id, jid)`.
  - `wa_mensagens.numero_id uuid not null default wa_numero_padrao()`, com PK `(numero_id, id)` e FK `(numero_id, jid) → wa_conversas(numero_id, jid) on delete cascade`; índice `(numero_id, jid, criada_em desc)`.
  - `wa_pode_ver_numero(p_numero uuid) returns boolean`: admin (`sou_admin()`), ou perfil `ativa` com `papel = any(equipes)` ou `tenho_funcao_extra(e, auth.uid())` para algum `e` de `equipes`. Número inativo = falso (o admin ainda vê).
  - `pode_ver_wa()` redefinida como `exists (select 1 from wa_numeros n where n.ativo and wa_pode_ver_numero(n.id))`.
  - RLS: `wa_conversas`/`wa_mensagens` select `using (wa_pode_ver_numero(numero_id))`; `wa_numeros` select `using (sou_admin() or (ativo and wa_pode_ver_numero(id)))`; escrita em `wa_numeros` só pelo servidor (revoke insert/update/delete de authenticated).
  - `wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null, p_numero uuid default null)`: corpo do `zzz375`, com `where numero_id = coalesce(p_numero, wa_numero_padrao()) and jid = p_jid` em toda escrita em `wa_conversas`/`wa_mensagens`; confere `wa_pode_ver_numero`. Faz `drop function if exists wa_conversa_marcar(text,text,text)` antes.
  - `wa_nota_interna(p_jid text, p_texto text, p_numero uuid default null)`: mesmo padrão, e a nota é gravada com `numero_id`.
  - `wa_unir_lids()`: o par lid→número e o merge passam a ser por `numero_id` (junta só dentro do mesmo número).
  - `wa_quem_ve_whatsapp(p_numero uuid default null)`: quem vê aquele número (null = padrão).
  - `wa_avisar_espera(…, p_numero uuid default null)`: chave do evento `'wa.esperando:' || numero || ':' || jid || ':' || ts`, e o payload leva `numero_id`.
- PK, FKs e políticas antigas são descobertas e trocadas dinamicamente (`do $$ … pg_constraint …$$`), porque o banco ao vivo pode ter nomes diferentes dos arquivos.

- [ ] **Step 1: Write the failing test** `testes/sql/wa-numeros.test.sql`. Com 2 números (padrão Vídeo `{videomaker}`, Design `{designer}`) e 3 perfis (admin, videomaker, designer), as asserções são:
  - `select count(*) from wa_numeros where padrao` = 1 e a instância é `'b7-piloto'`.
  - Linhas antigas de `wa_conversas` (inseridas antes do `zzz383`) ficam com `numero_id = wa_numero_padrao()`.
  - Inserir o mesmo grupo `'1@g.us'` nos dois números funciona, e a mesma mensagem `id='M1'` nos dois números funciona (2 linhas).
  - Como designer (`set local request.jwt.claims` / esboço `auth.uid()`): `select count(*) from wa_conversas` vê só o número Design; `wa_pode_ver_numero(<vídeo>)` = false; `wa_conversa_marcar('1@g.us','lida',null,<vídeo>)` levanta `42501`.
  - Como admin, vê as duas.
  - `wa_conversa_marcar('1@g.us','lida',null,<design>)` zera `nao_lidas` só na linha do Design.
- [ ] **Step 2: Run** `bash testes/sql/wa-numeros.sh`. Expected: FAIL (`zzz383` não existe).
- [ ] **Step 3: Write** `zzz383_wa_varios_numeros.sql` com as interfaces acima. Cabeçalho em português explicando o porquê (o mesmo grupo em dois números).
- [ ] **Step 4: Run** `bash testes/sql/wa-numeros.sh`. Expected: `OK` nas asserções, rodando o `zzz383` duas vezes.
- [ ] **Step 5: Commit** `4.84.0: banco com vários números de WhatsApp (zzz383)`

### Task 2: Servidor: peças puras dos números

**Files:**
- Create: `supabase/functions/_shared/wa-numeros.ts`
- Test: `testes/wa-numeros-servidor.test.mjs` (rodar com `--experimental-strip-types`; entra no `npm test`)

**Interfaces:**
- Produces:
  - `type Numero = { id: string; nome: string; instancia: string; cor: string; equipes: string[]; padrao: boolean; ativo: boolean; numero: string | null; estado: string | null }`
  - `instanciaDoEvento(corpo: any): string`: `corpo.instance` (string) ou `corpo.instance.instanceName`; `''` se faltar.
  - `podeVerNumero(p: { eh_admin?: boolean; papel?: string; estado?: string; funcoes_adicionais?: string[] }, n: Numero): boolean`: espelha `wa_pode_ver_numero`.
  - `instanciaNova(nome: string, existentes: string[]): string`: `'b7-' + slug(nome)` (minúsculas, sem acento, `[a-z0-9-]`, até 24 caracteres), com `-2`, `-3`… se repetir.
  - `criarResolvedor(buscar: () => Promise<Numero[]>, ttlMs = 30000)` → `{ porId(id?: string|null): Promise<Numero|null> /* vazio = padrão */, porInstancia(i: string): Promise<Numero|null>, padrao(): Promise<Numero|null>, todos(): Promise<Numero[]>, limpar(): void }`.
- [ ] **Step 1: Write failing tests**:
  - `instanciaDoEvento({instance:'b7-design'})==='b7-design'`, `({instance:{instanceName:'x'}})==='x'`, `({})===''`.
  - `podeVerNumero`: admin vê tudo; `{papel:'designer',estado:'ativa'}` vê `equipes:['designer']` e não vê `['videomaker']`; `{papel:'admin', funcoes_adicionais:['videomaker']}` com `eh_admin` false vê `['videomaker']`; `estado:'inativa'` não vê nada.
  - `instanciaNova('Coordenação',[])==='b7-coordenacao'`; `instanciaNova('Design',['b7-design'])==='b7-design-2'`.
  - Resolvedor: `porId(null)` devolve o padrão; `porInstancia('nada')` devolve null; `buscar` é chamado uma vez dentro do ttl.
- [ ] **Step 2: Run** `node --experimental-strip-types --no-warnings testes/wa-numeros-servidor.test.mjs`. Expected: FAIL (módulo ausente).
- [ ] **Step 3: Implement** em `_shared/wa-numeros.ts`.
- [ ] **Step 4: Run** de novo. Expected: todas ✓. Acrescentar ao script `test` de `testes/package.json`.
- [ ] **Step 5: Commit** `4.84.0: servidor reconhece os números (peças puras)`

### Task 3: Servidor: `wa.ts` grava por número e o Otto fica no padrão

**Files:**
- Modify: `supabase/functions/_shared/wa.ts`: `evo` inalterado. Novos `numeros = criarResolvedor(() => admin().from('wa_numeros').select('*'))`, `instanciaDe(n: Numero) = encodeURIComponent(n.instancia)` e `waPadrao(sb)`. `gravar(sb, m, extra?, op?, num?: Numero)` e `garantirConversa(sb, jid, …, num?: Numero)` gravam `numero_id: num?.id` (ausente = default do banco) e filtram `numero_id` em toda leitura e atualização por `jid`/`id`.
- Modify: `supabase/functions/_shared/assistente.ts`, `otto-controle.ts`, `otto-conversa.ts`, `otto-demandas.ts`, `otto-extras.ts`, `otto-social.ts`, `print-conversa.ts`: troca **todo** `sb.from('wa_conversas'|'wa_mensagens')` por `waPadrao(sb).conversas()` / `.mensagens()`.
- Test: `testes/wa-otto-padrao.test.mjs` (entra no `npm test`)

**Interfaces:**
- Consumes: Task 2 (`Numero`, `criarResolvedor`).
- Produces: `waPadrao(sb: SupabaseClient): { conversas(): Tab; mensagens(): Tab }`, em que `Tab = { select(...a), update(v), delete(), insert(v), upsert(v, o?) }`. `select`, `update` e `delete` encadeiam `.eq('numero_id', idPadrao)`; `insert` e `upsert` põem `numero_id: idPadrao` em cada linha, e `upsert` usa `onConflict` `'numero_id,jid'` (conversas) ou `'numero_id,id'` (mensagens) quando o chamador mandava `'jid'`/`'id'`. O id do padrão vem de `numeros.padrao()` e é guardado. Como as chamadas do Otto são `await`, a função é assíncrona por baixo: o wrapper devolve um *thenable* que aplica os filtros e respeita `.eq/.in/.order/.limit/.maybeSingle/.single/.select` encadeados.
- [ ] **Step 1: Write failing test** `wa-otto-padrao.test.mjs`:
  - (a) lê os 7 arquivos do Otto e confirma que nenhum contém `from('wa_conversas')`/`from('wa_mensagens')`;
  - (b) com um `sb` falso que registra as chamadas, `await waPadrao(sb).mensagens().select('id').eq('jid','x').limit(1)` registra `eq('numero_id', P)`;
  - (c) `insert({jid:'x'})` registra `numero_id: P`;
  - (d) `upsert([{id:'1'}],{onConflict:'id'})` registra `onConflict:'numero_id,id'`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `waPadrao` em `wa.ts` e faça a troca nos arquivos do Otto (mecânica, um arquivo por vez; `deno check` se disponível, senão `node --experimental-strip-types` importando o módulo para pegar erro de sintaxe). Em `gravar`/`garantirConversa`, o `upsert(..., {onConflict:'jid'})` vira `'numero_id,jid'` e as atualizações de status/apagar ganham `.eq('numero_id', …)`.
- [ ] **Step 4: Run** `cd testes && npm test`. Expected: tudo ✓.
- [ ] **Step 5: Commit** `4.84.0: mensagens gravadas por número; Otto preso ao número dos Videomakers`

### Task 4: `wa-entrada`: cada evento no seu número

**Files:**
- Modify: `supabase/functions/wa-entrada/index.ts`

**Interfaces:**
- Consumes: `instanciaDoEvento`, `numeros.porInstancia`, `numeros.padrao`, `gravar(..., num)`, `garantirConversa(..., num)`.
- [ ] **Step 1:** No caminho do webhook: `const num = await numeros.porInstancia(instanciaDoEvento(corpo))`. Se for null ou `!num.ativo`, responde `ok({ ok: true, ignorado: 'instância desconhecida' })` antes de gravar.
- [ ] **Step 2:** Passar `num` para `gravar`/`garantirConversa`. `messages.update`/`messages.delete` filtram `.eq('numero_id', num.id)`.
- [ ] **Step 3:** `aoReceber` (Otto) e a limpeza de `reiniciar_pedido` só rodam quando `num.padrao`. O relógio (`x-b7-relogio`) usa a instância do padrão (`(await numeros.padrao()).instancia`) no lugar de `INST()`.
- [ ] **Step 4:** Rodar `cd testes && npm test` (a sintaxe cobre o `.ts` via strip-types, se o `sintaxe.mjs` já cobrir; senão `node --experimental-strip-types --check`). Expected: ✓.
- [ ] **Step 5: Commit** `4.84.0: webhook reconhece de qual número veio cada mensagem`

### Task 5: `wa-evolution`: ações por número e cadastro de números

**Files:**
- Modify: `supabase/functions/wa-evolution/index.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces (contrato com o front, `B7.DB.waEvolution(acao, extra)`):
  - Toda ação aceita `numero` (uuid; vazio = padrão). Resolve `const n = await numeros.porId(c.numero)`, que dá 404 `{erro:'Número não encontrado.'}`. Permissão: as ações de admin continuam `ehAdmin(p)`; as demais usam `podeVerNumero(p, n)` (403 `{erro:'Sem permissão para este número.'}`). `I()` vira `instanciaDe(n)` em todas as ações; `estado`/`conectar`/`desconectar`/`importar`/`contatos`/`participantes`/`midia`/`enviar_*`/`reagir`/`apagar`/`editar`/`lida` ficam por número. Leituras e escritas em `wa_conversas`/`wa_mensagens` filtram `numero_id = n.id`.
  - `conectar`: ao criar a instância, liga o webhook nela (mesma URL e token de hoje) e grava `estado`/`numero` em `wa_numeros`.
  - Novas (só admin):
    - `numeros` → `{ lista: Numero[] }` com `estado` atualizado do Evolution, em paralelo, com timeout de 8 s cada;
    - `numero_salvar` `{ id?, nome, cor, equipes }` → `{ numero: Numero }`. Ao criar, `instancia = instanciaNova(nome, existentes)`; valida `equipes ⊂ {videomaker,designer,coordenador}` e `nome` com 2–40 caracteres;
    - `numero_desativar` `{ id }` → desconecta (logout) e marca `ativo=false`. Recusa o padrão: `{erro:'O número padrão não pode ser desativado.'}`.
  - `GET` de diagnóstico: continua usando o padrão.
- [ ] **Step 1:** Trocar `const I = …` global por `n` resolvido no início do `POST` e passado às funções auxiliares (`estado(n)`, `conectar(n,…)`, `importar(n,…)`, `baixarMidia(n,id)`, `msgDe(n,id)`…). Não pode sobrar nenhum `I()`: `grep -n "I()" supabase/functions/wa-evolution/index.ts` deve vir vazio.
- [ ] **Step 2:** Implementar as 3 ações novas.
- [ ] **Step 3:** Rodar `cd testes && npm test`. Expected: ✓.
- [ ] **Step 4: Commit** `4.84.0: servidor do WhatsApp atende vários números`

### Task 6: Front: `B7.WaNumeros` (módulo comum)

**Files:**
- Create: `js/wa-numeros.js`. Incluir em `index.html` antes de `js/central-wa.js` e na lista do `sw.js`.
- Create: `styles` em `styles/central-wa.css` (`.wz-nums`, `.wz-num`, `.wz-num-pt`).
- Test: `testes/wa-numeros-tela.test.mjs` (no `npm test`, eval como `permissoes.test.mjs`)

**Interfaces:**
- Produces `B7.WaNumeros`:
  - `carregar(forcar?: boolean): Promise<Numero[]>`: `sb.from('wa_numeros').select('*').eq('ativo', true).order('ordem')`, guardado por 60 s.
  - `lista(): Numero[]`, `porId(id): Numero|null`, `padrao(): Numero|null`.
  - `daPessoa(usuario, numeros): Numero|null`: o primeiro número cujas `equipes` contêm o papel ou uma função extra da pessoa; senão o padrão.
  - `escolhido(): 'todos'|string` e `escolher(v)`, lembrados em `B7.pref` (`wa_num`).
  - `barraHtml(numeros, sel, contagens: Record<string, number>): string`: `''` se `numeros.length < 2`. Senão é `<div class="wz-nums">` com o botão "Todos" (soma) e um botão por número (`data-num`, bolinha `--c: cor`, contagem `<b>` quando > 0).
  - `ponto(n): string`: `<i class="wz-num-pt" style="--c:…" title="nome"></i>`.
- [ ] **Step 1: Write failing tests:**
  - `barraHtml([um],…)===''`;
  - com 2 números, contém `data-num="todos"` e os dois ids, e `class="on"` no `sel`;
  - `daPessoa({papel:'designer'},[vid(padrão),des])===des`;
  - `daPessoa({papel:'admin'},[vid,des])===vid`;
  - `daPessoa({papel:'coordenador', funcoes_adicionais:['videomaker']}, [vid, des, coord])===coord` (vale o papel antes da função extra).
- [ ] **Step 2: Run** `node testes/wa-numeros-tela.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: ✓; e `npm test` ✓ (sintaxe).
- [ ] **Step 5: Commit** `4.84.0: peça comum dos números na tela`

### Task 7: Central de Conversas por número

**Files:**
- Modify: `js/central-wa.js`, `styles/central-wa.css`

**Interfaces:**
- Consumes: `B7.WaNumeros`; contrato da Task 5 (`numero` em toda ação); RPCs da Task 1 (`p_numero`).
- Regras:
  - Identidade da conversa = `chave(c) = c.numero_id + '|' + c.jid`. `S.porJid` vira `S.porChave`. `S.aberta` (jid) ganha `S.abertaNum`. Todo `S.porJid.get(x)` passa por `conv(jid, num = S.abertaNum)`.
  - `chamar(acao, extra)` injeta `numero: extra.numero ?? S.abertaNum ?? (S.num !== 'todos' ? S.num : null)`. As RPCs mandam `p_numero: S.abertaNum`.
  - `S.num` = `B7.WaNumeros.escolhido()`, validado contra a lista visível; se a pessoa só vê um, fica fixo nele.
  - `filtrar(c)` considera `S.num`. Os contadores dos filtros e do menu contam só o que está visível.
  - A barra (`barraHtml`) entra entre o topo e a busca. Clicar troca `S.num`, repinta e guarda a escolha.
  - Em "Todos", cada item da lista mostra o `ponto(n)` ao lado da hora, e o cabeçalho da conversa aberta mostra "via <nome do número>".
  - Item da lista leva `data-num`; `abrirConversa(jid, num)`; o hash `#/whatsapp?jid=…&num=…` (sem `num` = padrão).
  - Tempo real: casa `p.new.numero_id` + `jid` com a conversa aberta (`m.jid === S.aberta && m.numero_id === S.abertaNum`).
  - Carregar mensagens e `irParaMensagem` filtram `.eq('numero_id', S.abertaNum)`.
  - Lista vazia: "Conectar o número" abre Configurações → Números. A mensagem de sem acesso vira "Você ainda não tem um número de WhatsApp da sua equipe".
- [ ] **Step 1:** Implementar as regras.
- [ ] **Step 2:** Rodar `cd testes && npm test`. A fumaça abre `#/whatsapp`; se o banco simulado de `fumaca.mjs` não conhecer `wa_numeros`, acrescentar 2 números simulados lá.
- [ ] **Step 3:** Conferir com Playwright na fumaça (ou no `testes/qa/sonda.mjs`), com 2 números simulados:
  - a barra aparece;
  - clicar "Design" deixa só as conversas do Design;
  - em "Todos" aparecem os pontos;
  - abrir uma conversa e enviar manda `numero` = o da conversa (interceptar o pedido à `wa-evolution`).
  - Print em 2× para o relatório.
- [ ] **Step 4: Commit** `4.84.0: Central alterna entre os números`

### Task 8: Configurações → Números e janela de conexão por número

**Files:**
- Modify: `js/config-wa.js` (nova seção `numeros`, ícone `conexao`, primeira da camada "Da equipe"; a seção antiga de conexão passa a abrir esta), `js/wa-central.js` (`abrir(numeroId?)` leva `numero` em `estado`/`conectar`/`desconectar`; o título mostra o nome do número), `styles/config-wa.css`

**Interfaces:**
- Consumes: ações `numeros`, `numero_salvar`, `numero_desativar`, `estado/conectar/desconectar` com `numero` (Task 5); `B7.WaNumeros.carregar(true)` depois de cada mudança.
- Tela: uma linha por número com bolinha de cor, nome, telefone, estado ("Conectado", "Desconectado", "Conferindo…"), equipes em chips e os botões Conectar/Desconectar, Editar e Desativar (este não aparece no padrão, que mostra o selo "Padrão · Otto"). Botão "+ Adicionar número" abre um formulário (nome, cor entre as 6 de `PAL`, equipes em caixas) e, ao salvar, abre a janela de conexão do número novo. Desativar pede confirmação: "As conversas ficam guardadas, mas o número sai da Central."
- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Rodar `cd testes && npm test`. Expected: ✓.
- [ ] **Step 3:** Conferir com Playwright, com o `waEvolution` simulado: adicionar "Designers", ver a linha nova e abrir a janela de conexão com o nome certo.
- [ ] **Step 4: Commit** `4.84.0: cadastro de números nas Configurações do WhatsApp`

### Task 9: "Enviar no WhatsApp" escolhe o número

**Files:**
- Modify: `js/whatsapp.js`

**Interfaces:**
- Consumes: `B7.WaNumeros.carregar/daPessoa/lista`, `numero` nas ações `enviar_*`, `p_numero` em `wa_conversa_marcar`.
- Regras:
  - `podeEnviar()` passa a valer para quem vê algum número: `B7.WaNumeros.lista().length > 0` após carregar, com fallback para a regra antiga se o módulo falhar.
  - Com 2 ou mais números, a janela ganha uma linha "Enviar pelo número" com os números visíveis, começando em `daPessoa`.
  - A lista de conversas filtra `numero_id`; se o número trocar, a conversa sugerida (ligada ao cliente) é procurada de novo nesse número. Todo envio leva `numero`.
- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** Rodar `cd testes && npm test`. Expected: ✓.
- [ ] **Step 3: Commit** `4.84.0: Enviar no WhatsApp pelo número da equipe`

### Task 10: Versão, novidades e fechamento

**Files:**
- Modify: `js/auth.js` (`VERSAO = '4.84.0'`), `sw.js` (`CACHE = 'b7-v4.84.0'`), `js/novidades.js` (registro 4.84.0: "Vários números de WhatsApp no B7. Admin alterna entre eles; cada equipe vê o seu."), `docs/relatorios/RELATORIO_2026-11-23-v4.84.0_varios_numeros.md` (o que mudou e a **ordem de publicação**: 1) Actions → sql → `supabase/sql/zzz383_wa_varios_numeros.sql`; 2) merge na main; 3) adicionar números. Inclui o aviso para conferir se o segredo `EVOLUTION_INSTANCE` é `b7-piloto` e, se não for, rodar `update wa_numeros set instancia='<valor>' where padrao`.)
- [ ] **Step 1:** Atualizar os arquivos.
- [ ] **Step 2:** Rodar `cd testes && npm test` e `bash testes/sql/wa-numeros.sh`. Expected: tudo ✓.
- [ ] **Step 3: Commit** `4.84.0: vários números de WhatsApp`, depois push no branch `claude/gallant-tesla-ltuptf` e PR.
