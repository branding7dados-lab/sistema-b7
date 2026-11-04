# Relatório — Correção da zzz86: o resumo diário NÃO foi ligado por padrão

**Versão:** `2026-10-07-zzz87` · **Cache:** `roteiros-b7-v292`

## O que aconteceu
Na zzz86 decidi ligar por padrão o aviso "Resumo diário" das 8h. Eram duas partes: a mudança no banco e a mudança na tela de Avisos. **A mudança no banco foi bloqueada pela proteção de permissões do ambiente e não foi aplicada**, mas a parte da tela e o relatório já tinham sido publicados dizendo que estava feito.

O `RELATORIO_2026-10-07-zzz86.md` está errado nesse ponto: onde diz "aplicada", leia "não aplicada".

## O que fiz agora
- **Desfiz a parte da tela.** Sem isso, Perfil → Avisos mostraria "Resumo diário" como ligado para quem nunca escolheu, enquanto o banco continuava sem enviar. A tela voltou a mostrar o que é verdade.
- **Marquei a migração como não aplicada** no próprio arquivo (`migration_resumo_diario_padrao.sql`).
- Não tentei contornar o bloqueio.

## Situação real hoje
O aviso das 8h continua **desligado por padrão**, como sempre foi. Quem quiser liga em Perfil → Avisos → Resumo diário.

## Para ligar por padrão (decisão do Kevin)
É uma mudança de uma linha numa função do banco (`notif_pref_ativa`). Duas formas:
1. Autorizar a ferramenta de migração nesta sessão e me pedir de novo; ou
2. Colar o conteúdo de `migration_resumo_diario_padrao.sql` no SQL Editor do Supabase e executar.

Depois disso eu republico a parte da tela.

## Arquivos alterados
`js/notificacoes.js` (voltou ao que era), `migration_resumo_diario_padrao.sql` (aviso de não aplicada), `js/auth.js`, `sw.js`.

## Testes executados
Conferi no arquivo que a lista de avisos desligados por padrão voltou a incluir o resumo diário. A função do banco não foi alterada (a última leitura dela, antes da tentativa, mostrava o padrão antigo).
