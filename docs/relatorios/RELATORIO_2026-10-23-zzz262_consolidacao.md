# zzz262 — Consolidação para o lançamento

## Banco (aplicado: consolida_1_anon, consolida_1b_internas, consolida_2_3_path_rls, consolida_4_indices)
Arquivo: `migration_consolida_banco.sql`.
- 54 funções SECURITY DEFINER executáveis por `anon` → só `authenticated`/`service_role`.
  Exceções de propósito: `promo1010_*` (site) e `widget_hoje`/`widget_token_revogar` (widget Android, chave própria).
  Gatilhos perderam EXECUTE também de `authenticated` (gatilho não depende disso para disparar).
- 37 funções internas que as migrations já fechavam para `authenticated` continuam fechadas (ex.: `_cliente_avisar_b7`).
- `alter default privileges ... revoke execute on functions from public, anon`: funções novas nascem sem anon.
- `search_path` fixo em 8 funções; 4 políticas (ia_conversas, ia_mensagens, chat_comunicados) com `(select auth.uid())`.
- 17 índices em chaves estrangeiras de tabelas consultadas (notificações, roteiros, conteúdos, status, IA…).
- Conferido como admin: `minha_sessao`, `pode_nivel`, `ia_conversas`, `sou_superadmin` respondem; anon não executa `pode_nivel`; widget segue público.

## Front
- `js/database.js`: `amigavel()` traduz erros técnicos (rede, JWT, permissão, timeout, chave duplicada, FK, formato) para frases simples; original em `e.tecnico`.
  `autosave.js` e `admin-extra.js` passaram a ler `e.tecnico` nas checagens de texto.
- `js/portal-equipe.js`: `boasVindas()` — modal de primeiro acesso (uma vez por pessoa/aparelho, nunca na prévia), conforme papel; com senha provisória oferece "Criar minha senha".

## IA
- `_shared/ia/servico.ts`: `comNovaTentativa` — até 2 novas tentativas (1,2 s e 3 s) em "indisponível", dentro de 15 s. Base: 10 de 11 falhas em 30 dias foram "indisponível" rápidas.
- `_shared/ia/ajuda_portal.ts`: tutorial `portal-equipe` (papéis, convite, senha nova, tirar) e textos de aprovação/senha atualizados.
