# Relatório — Resumo diário ligado por padrão (agora de verdade)

**Versão:** `2026-10-07-zzz88` · **Cache:** `roteiros-b7-v293`
**Contexto:** a zzz86 anunciou esta mudança sem que o banco tivesse sido alterado; a zzz87 desfez a parte da tela. O Kevin autorizou o acesso ao Supabase e a mudança foi aplicada agora.

## O que mudou
O aviso **"Resumo diário"** das 8h passa a valer para toda a equipe que nunca mexeu nessa opção.

- **O que traz:** as demandas e peças da pessoa que vencem hoje e as gravações de amanhã. Para administrador e coordenador, também as publicações previstas para hoje e os vídeos em atraso na operação.
- **Só sai quando há algo.** Dia sem nada, sem aviso.
- **Só equipe.** Cliente do Portal não recebe.
- **Quem já tinha escolhido continua como escolheu.**
- **Para desligar:** Perfil → Avisos → Resumo diário.

## Banco de dados
`migration_resumo_diario_padrao.sql` — **aplicada**. A função `notif_pref_ativa` deixou de tratar `resumo_diario` como desligado quando a pessoa não escolheu. Nada mais mudou.

## Arquivos alterados
`js/notificacoes.js` (a tela de Avisos mostra a chave ligada para quem não escolheu), `migration_resumo_diario_padrao.sql` (marcada como aplicada), `js/auth.js`, `sw.js`.

## Testes executados
Banco, depois de aplicar (só leitura):
- sem escolha → ligado; quem desligou → continua desligado;
- os outros padrões não mudaram ("acompanhar tudo" continua desligado, "atribuições" continua ligado);
- 5 de 5 pessoas da equipe ativa estão aptas a receber.

## Não testado
O envio em si: roda às 8h. O primeiro com o padrão novo é amanhã de manhã — e só chega para quem tiver algo no dia.

## Sobre os relatórios anteriores
`RELATORIO_2026-10-07-zzz86.md` dizia "aplicada" antes de estar; `RELATORIO_2026-10-07-zzz87.md` registra a correção. Este é o que vale.
