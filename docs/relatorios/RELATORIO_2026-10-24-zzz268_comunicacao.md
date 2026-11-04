# zzz268 — E-mail semanal, recados e aviso no WhatsApp

## Banco (`migration_resumo_recados.sql`; aplicada: resumo_semanal_1, resumo_semanal_2, recados_1)
- `perfis.email_resumo` (formato conferido) + `meu_email_resumo()` / `meu_email_resumo_definir(p_email)`.
- `resumo_semanal_dados()` (só service_role): por pessoa/empresa — aprovados 7 dias, pendentes, publicações 7 dias, gravações 14 dias, pedidos prontos. Testado numa transação desfeita.
- `b7_recados` (RLS: equipe vê tudo; cliente vê os ativos dele ou gerais) + `recado_salvar` / `recado_arquivar` (só admin).
- Cron `resumo-semanal` (`37 11 * * 1` = segunda 8h37 de Brasília) criado copiando o cabeçalho do `oportunidades-sync` (o segredo não foi digitado nem mostrado).

## b7-auth (VERSAO 2026-10-24-resumo-semanal)
- Ação `resumo_semanal` antes do login: exige `x-b7-cron-secret` = `B7_CRON_SECRET` (comparação `iguais`), monta e envia via Brevo; semana vazia não envia.
- `email_modelo.ts`: `emailResumoSemanal` (cabeçalho com gradiente, 3 números, listas, botão "Revisar agora"/"Abrir o portal", modo escuro). `dois_fatores.ts`: `enviarEmail` genérico.
- `deno check`: só o erro de tipo que já existia (`Deno.serve`), nenhum novo.

## Telas
- `js/portal-comunicacao.js`: recados no Início (dispensar por aparelho) e cartão "Resumo semanal por e-mail" no Meu perfil.
- Gestão → aba Recados (publicar / tirar do ar).
- Aprovações: "Avisar no WhatsApp" (modelo `aprovacao` com `{link}` para `#/revisar/<id>`).
- #29 (atalhos do app Android) já existia: Meu dia, gravação de hoje, teleprompter e nova ideia.
