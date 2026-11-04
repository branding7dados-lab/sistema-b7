# zzz251 — Testes automáticos de permissões

## Banco
- `conferir_permissoes()` (só admin): devolve uma linha por problema. Confere:
  tabelas sem RLS; regras de escrita abertas (`true`, fora os formulários públicos da landing);
  regras de escrita das tabelas de conteúdo que não passam por `pode_nivel`; e cada pessoa ativa ×
  módulo (cliente com módulo da equipe, admin sem Total, banco deixando mais do que o nível dado).
- `_conferir_permissoes_diario()` + cron `conferir-permissoes` (8h45 Brasília): se houver problema,
  um aviso por dia para cada administrador. Hoje: 0 problemas.
- Arquivo: `migration_conferir_permissoes.sql` (já aplicada).

## Tela
- Configurações → Funções e permissões: seção "Conferência de segurança" (só admin), roda ao abrir e
  no botão "Conferir agora".
- `TABELA_MODULO` ganhou WhatsApp e Agenda da equipe (mensagem clara quando o banco recusa).

## CI
- `testes/permissoes.test.mjs` (156 conferências): rotas e níveis de admin, cliente, designer,
  videomaker, coordenação, exceções por pessoa e sessão antiga; e garante que toda tabela travada pela
  migration de níveis tem mensagem de permissão. O teste achou a falta das mensagens de WhatsApp/Agenda.

## Observado
- Designers têm "Total" em Linhas editoriais pelo padrão, mas o banco só deixa ver o conteúdo (o nível
  vale para o trabalho deles — já explicado na matriz). Não é falha de segurança.
