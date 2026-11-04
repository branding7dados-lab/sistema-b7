# zzz250 — Observações internas fora do portal, assistente atualizado

## O que mudou
- **Observações internas (item 9):** novas views `conteudos_portal` (sem `observacao_design`) e
  `status_itens_portal` (observação só quando o status tem `mostrar_observacoes`). O cliente perdeu a
  leitura direta de `conteudos` e `status_itens`; `portal_status` e `aprov_titulo` usam as views.
  `js/database.js` (`conteudosVisiveis`, `itensDoStatus`) lê pelas views. Equipe continua vendo tudo.
  Arquivo: `migration_portal_sem_observacoes.sql` (já aplicada).
- **Assistente (item 3):** o deploy das funções `b7-ia` e `b7-auth` falhava por limite do registro de
  imagens (ghcr.io "toomanyrequests"). Reexecutado com sucesso; o workflow `funcoes.yml` agora tenta
  `--use-api` primeiro e repete até 3 vezes.
- **App Android (item 4):** conferido — o APK é refeito a cada atualização da main (já estava em dia).

## Testes
- Como equipe: `conteudos_portal` e `status_itens_portal` retornam os mesmos registros de antes.
- Não há contas de cliente ativas para testar o lado do cliente; o filtro é o mesmo das políticas antigas.
