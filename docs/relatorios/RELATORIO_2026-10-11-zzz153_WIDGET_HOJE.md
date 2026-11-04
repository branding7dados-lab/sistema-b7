# Relatório — widget "Hoje no B7" (zzz153, 11/10)

Pedido do Kevin: widget na tela inicial do Android com o dia da pessoa.

## Como fica
- Cartão azul-noite com o símbolo do B7: **"Hoje, Kevin"** e a data.
- Três números:
  - videomaker/designer: **gravações hoje · prazos hoje · atrasadas** (as dela);
  - gestão (admin/coordenador): **gravações hoje · publicações hoje · vídeos
    atrasados** na operação.
- **Próxima gravação** (até amanhã), com cliente e horário.
- "atualizado às 14:32 · toque para abrir". O toque abre o Painel.
- O cliente de teste fica de fora (igual ao Resumo do dia).

## Como se atualiza
- Sozinho a cada 30 min, com o app fechado (WorkManager, só com internet), e ao
  abrir o app.
- Não usa a sessão do app: renovar a sessão por fora derrubaria o login. Usa uma
  **chave só do widget**, que só lê estes números:
  - `widget_token_novo` cria a chave ao entrar na conta;
  - `widget_hoje(chave)` devolve os números;
  - `widget_token_revogar` apaga a chave ao sair da conta.
- No banco fica só o hash da chave. Cada pessoa tem no máximo 3 chaves (3
  aparelhos).

## Arquivos
- `migration_widget_hoje.sql` (banco).
- `WidgetHoje.java` com o desenho e a busca.
- `res/layout/widget_hoje.xml` e `res/xml/widget_hoje_info.xml`.
- `js/app-nativo.js`: entrega e apaga a chave.

## Testes
- APK montado. `testes/` ok.
- **Pendente:** aplicar `migration_widget_hoje.sql` no Supabase, que precisa da
  confirmação do Kevin.
- **Não testado** no celular.

Versão `2026-10-11-zzz153`, cache `v358`.
