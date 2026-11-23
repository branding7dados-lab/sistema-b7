# Usuário Financeiro (4.86.0): plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Spec: `docs/superpowers/specs/2026-11-23-financeiro-e-gestao-design.md` (Entrega 1).

**Goal:** criar o administrador "Financeiro", que tem tudo do administrador menos WhatsApp e Pessoas e acessos.
O banco, o servidor e a tela concordam nessa regra.

## Global Constraints
- `perfis.financeiro boolean not null default false`. A pessoa continua com `papel = 'admin'`.
- Ajudantes no banco:
  - `sou_financeiro()`;
  - `sou_admin_pleno() = sou_admin() and not sou_financeiro()`.
- Migração `zzz387_financeiro.sql`, aplicada sozinha no merge. Precisa poder rodar 2×. Troca
  `sou_admin()` por `sou_admin_pleno()` **nas definições que estão no ar** (`pg_get_functiondef` /
  `pg_policies`), só nos objetos de Pessoas e de WhatsApp.
- Versão 4.86.0 com entrada em `js/novidades.js`.

## Review Focus
1. **Financeiro não pode se dar acesso.** Nenhum caminho deixa o financeiro tirar a própria marca ou virar
   admin pleno: `b7-auth` `alterar_conta`, a política de escrita em `perfis` e as RPCs de cargos. Teste SQL e
   leitura do `b7-auth`.
2. **O que é de todos não pode quebrar.** `acesso_pedir` e `acesso_pedido_cancelar`, que qualquer pessoa usa,
   ficam fora da troca. A leitura de `perfis`, que todo mundo precisa para nomes e fotos, não muda.
3. **WhatsApp fechado em toda camada:** RLS (`wa_pode_ver_numero`, políticas `wa_*`), push de espera
   (`wa_quem_ve_whatsapp`), `wa-evolution` e os botões "Enviar no WhatsApp" das outras telas.
4. **Rodar a migração de novo não estraga nada:** a segunda vez não muda nada (`sou_admin_pleno` não vira
   `sou_admin_pleno_pleno`).

## Tasks
1. **Banco:** `zzz387` e teste em `testes/sql/financeiro.sh`. O teste usa esboços de funções e políticas de
   pessoas e de WhatsApp e confere:
   - admin pleno passa e financeiro é recusado;
   - `acesso_pedir` continua aberto;
   - rodar 2× não muda nada.
2. **Servidor:**
   - `b7-auth`: lê `financeiro` em `quemChamou`; recusa ao financeiro as ações de pessoas (`criar_usuario`,
     `alterar_conta`, `excluir_conta`, `redefinir_senha`, `entrar_como`, `salvar_preset`, `seg_*`,
     `remover_admin`, `recuperar_admin`); grava `financeiro` em `criar_usuario` e `alterar_conta` (só admin pleno).
   - `wa-evolution`: `ehAdmin` é falso para o financeiro.
3. **Tela:**
   - `B7.Auth.ehFinanceiro()` (RPC `sou_financeiro`);
   - `B7.Perm` tira `whatsapp` e `usuarios` do financeiro;
   - a tela inicial é a Gestão;
   - `B7.WhatsApp.podeEnviar()` dá falso;
   - em Pessoas e acessos, a opção "Financeiro" aparece no administrador.
   - Teste: `testes/permissoes.test.mjs` com o caso financeiro, mais um teste de navegador do menu.
4. **Versão e relatório:** testes completos, PR, revisão independente e merge.
