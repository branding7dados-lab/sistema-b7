# zzz193 — Revisão dos bugs do dia (zzz184–192)

Revisado o diff completo de hoje (WhatsApp, artes, aprovação externa, linha, toast, atualização do programa).

**Corrigido**
- **Cliente falando COM alguém da equipe sumia do "esperando resposta"** (zzz184): a regra "prévia que começa com nome da equipe" pegava também "Pedro, consegue ver?" — mensagem do CLIENTE para o Pedro — e escondia o grupo. Agora só conta como equipe quando o nome é assinatura (nome seguido de quebra de linha, que vira 2+ espaços na prévia: "Talita  Bom dia…").
- **Programa de Windows:** `loadURL` da tela "Atualizando" podia gerar rejeição não tratada (ex.: página com aviso de sair) — agora com `.catch`.

**Conferido sem problema**
- Aba da linha mantida ao salvar; "Cliente respondeu" só para admin/coordenador; toast no modo leve claro/escuro/erro; artes (dedupe por nome, ordem, marcadas, extras do computador); fallback do arrastar para o clipe; `design_resumo` traz `cliente_nome`.

**Limites conhecidos (não alterado)**
- Desmarcar todas as artes sem escolher outras manda só a mensagem, sem perguntar.
- O "esperando resposta" mostra a mudança de "acompanhar/não acompanhar" na hora; se o banco recusar, avisa com erro.

Testes locais (`testes/npm test`): todas as telas abriram sem erro.
