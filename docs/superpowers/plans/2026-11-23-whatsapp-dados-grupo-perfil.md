# Dados do grupo e perfil do contato: plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na Central, clicar no topo da conversa abre Dados do grupo ou Perfil do contato. O administrador do B7 mexe no grupo (membros, admins, nome, descrição, foto, link, regras).

**Architecture:** A tabela `wa_grupo_membros` e as colunas de grupo em `wa_conversas` guardam o que já se sabe. A Edge Function `wa-evolution` ganha ações de leitura (`grupo_dados`, `contato_perfil`), que atualizam o guardado, e ações de admin, que vão direto ao Evolution. O webhook e a atualização de contatos (6 h) mantêm os membros em dia. Um módulo novo, `B7.WaInfo`, desenha o painel.

**Tech Stack:** JS sem build (`js/`), Postgres/RLS (`supabase/sql/`), Deno Edge Functions, Evolution API v2. Testes em Node 22 e Postgres 16 local.

**Spec:** `docs/superpowers/specs/2026-11-23-whatsapp-dados-grupo-perfil-design.md`

## Global Constraints
- Versão **4.85.0**: `js/auth.js` `VERSAO`, `sw.js` `CACHE`, registro em `js/novidades.js`.
- Migração `supabase/sql/zzz385_wa_grupo_membros.sql`. Precisa poder rodar 2×. Ela é aplicada sozinha no merge.
- As ações que mexem no grupo ficam em `ACOES_ADMIN` (só administrador do B7) e saem sempre pelo número da conversa (`I(n)`).
- Remover, revogar link e mudar regra pedem `B7.UI.confirmar`.
- Classes da Central com prefixo `wz-`; o painel novo usa `wz-info-*`.

## Review Focus
1. **Participante como `@lid` com `phoneNumber` ao lado, ou só `@lid`.** O telefone vem quando existe; `b7_admin` fica `null` quando não dá para saber, e os botões continuam ligados. Teste `membrosDe` e `b7AdminDe` na Task 2.
2. **O WhatsApp recusa um participante no `add`** (privacidade). O resultado vem por pessoa e a tela mostra quem não entrou. Teste `resultadoMembros` na Task 2.
3. **Grupos em comum para quem não vê o número.** A função só devolve grupos de números que quem chama vê. Teste SQL na Task 1.
4. **Evento `GROUP_PARTICIPANTS_UPDATE` em outro formato** (participantes como texto ou objeto; `action` em maiúscula). Formato desconhecido é ignorado. Teste `eventoParticipantes` na Task 2.
5. **A pessoa abre os dados e fecha antes da resposta do servidor.** Nada é desenhado por cima de outra conversa. Teste de navegador na Task 4: abrir, trocar de conversa e conferir que o painel não reaparece.

---

### Task 1: Banco: membros guardados e grupos em comum
**Files:** Create `supabase/sql/zzz385_wa_grupo_membros.sql`; Modify `testes/sql/wa-numeros.sh` (aplica também `zzz385` 2×) e `testes/sql/wa-numeros.test.sql` (asserções novas no fim).
**Produces:**
- `wa_grupo_membros(numero_id uuid not null references wa_numeros(id), grupo_jid text not null, membro_jid text not null, telefone text, admin text check (admin in ('admin','superadmin')), atualizado_em timestamptz default now(), primary key (numero_id, grupo_jid, membro_jid))`, com índices `(numero_id, telefone)` e `(membro_jid)`. RLS de leitura por `wa_pode_ver_numero(numero_id)`; escrita só pelo servidor.
- `wa_conversas` ganha `descricao text, criado_wa timestamptz, dono_jid text, so_admins_enviam boolean, so_admins_editam boolean, membros_qtd int, membros_em timestamptz`.
- `wa_grupos_em_comum(p_jid text, p_telefone text default null) returns table(numero_id uuid, grupo_jid text, nome text, foto_url text)`, security definer. Casa `membro_jid = p_jid` ou `telefone` igual (todos os dígitos de `p_telefone`, do número de `p_jid @s.whatsapp.net`, ou de `wa_contatos.numero` de `p_jid`). Filtra por `wa_pode_ver_numero(m.numero_id)` e ordena por nome.
- [ ] Teste:
  - designer chama `wa_grupos_em_comum` para uma pessoa que está num grupo do número dos vídeos e num do Design → só o do Design;
  - admin → os dois;
  - casar só pelo telefone de `wa_contatos` (membro guardado como `@lid` com telefone) funciona.
- [ ] Rodar → FAIL; escrever → `bash testes/sql/wa-numeros.sh` OK (2×); commit.

### Task 2: Servidor: peças puras do grupo (`_shared/wa-grupo.ts`)
**Files:** Create `supabase/functions/_shared/wa-grupo.ts`; Test `testes/wa-grupo.test.mjs` (strip-types, entra no `npm test`).
**Produces:**
- `type Membro = { jid: string; telefone: string | null; admin: 'admin' | 'superadmin' | null }`.
- `membrosDe(info: any): Membro[]`: lê `info.participants` (ou array direto). `jid = p.id || p.jid`; telefone de `p.phoneNumber`/`p.jid`/`p.id` quando `@s.whatsapp.net`, só dígitos; `admin` de `p.admin`; ignora entradas sem jid.
- `telefoneDe(x: string): string | null`.
- `b7AdminDe(membros: Membro[], telefoneDoNumero: string | null): boolean | null`: compara todos os dígitos. `null` se não há telefone do número ou se nenhum membro tem telefone igual e algum membro não tem telefone; `false` se todos têm telefone e nenhum é o número.
- `dadosGrupo(info: any)`: `{ nome, descricao, criado_wa: ISO|null, dono_jid, so_admins_enviam: bool|null, so_admins_editam: bool|null, membros_qtd }`, com `creation` em segundos e `announce`/`restrict`.
- `eventoParticipantes(d: any): { grupo: string; acao: 'add'|'remove'|'promote'|'demote'; membros: Membro[] } | null`. Aceita `d.id`/`d.groupJid` e `d.action` (qualquer caixa); participantes como string ou objeto; o resto vira null.
- `participanteParaEnvio(x: string): string | null`: telefone com 10–15 dígitos, ou um jid `@s.whatsapp.net`/`@lid`. O resto vira null.
- `resultadoMembros(resp: any, pedidos: string[]): { ok: string[]; falhou: { quem: string; motivo: string }[] }`: lê `resp.updateParticipants` ou um array `[{ status, jid }]`; `status` diferente de `'200'` é falha; o motivo é traduzido (403 "não deixou adicionar pela privacidade dele", 409 "já está no grupo", 404 "não tem WhatsApp", outro "o WhatsApp recusou").
- [ ] Testes para cada função com os casos do Review Focus 1, 2 e 4. Ver FAIL → implementar → ver PASS → commit.

### Task 3: Servidor: ações e manutenção
**Files:** Modify `supabase/functions/wa-evolution/index.ts`, `supabase/functions/wa-entrada/index.ts`, `supabase/functions/_shared/wa.ts` (exportar `numerosDaEquipe`), `supabase/functions/_shared/wa-numeros.ts` (`ACOES_ADMIN` += `grupo_membros, grupo_editar, grupo_foto, grupo_convite, grupo_regra`).
**Consumes:** Task 2. **Produces (contrato com a tela):**
- `grupo_dados {jid, numero}` → `{ grupo: {nome, descricao, criado_wa, dono_jid, so_admins_enviam, so_admins_editam, membros_qtd, foto_url}, membros: [{jid, telefone, admin, nome, foto, equipe, b7}], b7_admin, numero_estado }`. Grava `wa_conversas` (campos novos e `membros_em`; `nome` só se `!nome_fixo`) e substitui `wa_grupo_membros` desse grupo e número (delete + insert).
- `contato_perfil {jid, numero}` → `{ perfil: {nome, recado, foto, comercial, descricao, email, site, telefone}, grupos: [...] }`. Usa `/chat/fetchProfile/{inst}` com `{number}` e `wa_grupos_em_comum` com o service role e filtro explícito pelos números que o perfil do chamador vê, porque o `auth.uid()` do service role não serve.
- `grupo_membros {jid, numero, acao, participantes[]}` → `resultadoMembros`. Depois, reaproveita `grupo_dados` para regravar.
- `grupo_editar {jid, numero, nome?, descricao?}` → `{ok}`. Nome de 1 a 100 caracteres; descrição até 2048.
- `grupo_foto {jid, numero, path}` → `{ok}`. O `path` começa com `envio/`; usa link assinado.
- `grupo_convite {jid, numero, revogar?}` → `{ link }`.
- `grupo_regra {jid, numero, so_admins_enviam?, so_admins_editam?}` → `{ok}`.
- Toda ação de grupo recusa jid que não termina em `@g.us`.
- Na ação `contatos`: depois do que já faz, `fetchAllGroups?getParticipants=true` com 120 s, e regrava os membros de cada grupo do número.
- `EVENTOS` += `'GROUP_PARTICIPANTS_UPDATE'`. Em `wa-entrada`, `group-participants.update` / `group.participants.update` → `eventoParticipantes` → upsert ou delete em `wa_grupo_membros` e ajuste de `membros_qtd`.
- [ ] Implementar; `tscheck` de sintaxe e `tsc --noResolve` sem nome indefinido; `npm test` ✓; commit.

### Task 4: Tela: painel `B7.WaInfo`
**Files:** Create `js/wa-info.js` (incluir em `index.html` depois de `central-wa.js` e no `sw.js`), CSS em `styles/central-wa.css`; Modify `js/central-wa.js` (o topo abre o painel; o nome do autor no grupo abre o perfil; o "Renomear" fica só no menu ⋯; exportar um `contexto()` com `{ conv, abrirConversa, chamar, clientes, souAdmin }`); Test `testes/wa-central.test.mjs` (casos novos).
**Consumes:** Task 3.
- `B7.WaInfo.abrirGrupo(c)`, `B7.WaInfo.abrirContato(jid, numeroId)`, `B7.WaInfo.fechar()`.
- Desenha primeiro com `wa_conversas` e `wa_grupo_membros` (lidos com RLS) e depois com a resposta do servidor. Cada abertura tem um token: resposta velha não pinta.
- Sem os botões de admin para quem não é admin; com `b7_admin === false`, os botões ficam desligados e aparece "O número X não é admin deste grupo".
- [ ] Testes de navegador:
  - clicar no topo do grupo abre "Dados do grupo" com os membros simulados e os selos;
  - admin clica em "Remover" no ⋯ de um membro, confirma, e sai `grupo_membros` com `acao: 'remove'` e o número da conversa;
  - designer abre e não vê "+ Adicionar" nem o ⋯ de mexer;
  - clicar num membro abre o perfil com "Grupos em comum";
  - abrir e trocar de conversa antes da resposta não pinta o painel na outra conversa;
  - print em 2×, conferido visualmente.
- [ ] `npm test` ✓; commit.

### Task 5: Versão, novidades e relatório
- [ ] `VERSAO = '4.85.0'`, `CACHE = 'b7-v4.85.0'`, entrada 4.85.0 em `js/novidades.js`, `docs/relatorios/RELATORIO_2026-11-23-v4.85.0_dados_grupo.md` com prints. O relatório lembra: abrir Configurações → Números uma vez para religar o webhook com o evento novo.
- [ ] `npm test` e os dois `testes/sql/*.sh` ✓; commit, push, revisão independente, correções, merge depois dos testes verdes.
