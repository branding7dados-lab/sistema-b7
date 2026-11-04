# Relatório 2026-10-02-r — Aviso de teste só no aparelho, fora do sino

Banco (migration `notificacao_teste_fora_do_sino`, **aplicada**) e front-end (`js/database.js`, `js/notificacoes.js`, `js/perfil.js`).

## O que mudou

Os exemplos de "Ver um exemplo de cada aviso" agora **só chegam como push no aparelho**:

- Não aparecem na lista do sino.
- Nascem já lidos: não entram no contador do sino.
- Com o B7 aberto, não tocam o som do sistema nem abrem o aviso do navegador (o push do aparelho chega do mesmo jeito).
- Não aparecem no histórico da peça de Design usada como exemplo.
- Os 43 exemplos que você já tinha enviado saíram do sino e do contador. Continuam no banco, marcados como lidos; nada foi apagado.

Avisos de verdade não mudaram.

## Banco

- `notificar_teste_todos` grava o exemplo com a leitura já preenchida.
- Os exemplos anteriores foram marcados como lidos.

## Arquivos

- `migration_notificacao_teste_todos.sql` (atualizado), `js/database.js`, `js/notificacoes.js`, `js/perfil.js`.
- `js/auth.js` versão `2026-10-02-r`; `sw.js` cache `v145`.

## Testes realizados

- **Com dados reais, na sessão aberta no navegador daqui, só leitura:** a consulta nova do sino devolveu 30 avisos, nenhum de teste (existem 43 de teste no banco); o contador de não lidos ficou em 36, só avisos de verdade; a consulta do histórico da peça respondeu sem erro.

## O que NÃO foi testado

- Um novo envio de exemplos depois da mudança (não cliquei: dispararia pushes nos seus aparelhos).
- A chegada do push no celular.
