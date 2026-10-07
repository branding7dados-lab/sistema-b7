# Relatório — Avisos por WhatsApp retirados

**Versão:** `2026-10-07-zzz84` · **Cache:** `roteiros-b7-v289`
**Pedido:** "ent retira esse troço de wpp".

## O que foi retirado
Tudo o que a zzz83 tinha colocado:
- o campo **WhatsApp** em Usuários e acessos → Editar acesso e a etiqueta "WhatsApp" na lista;
- a linha **Avisos por WhatsApp** em Configurações → Admin → Integrações;
- o envio no servidor: `b7-push` e `b7-auth` voltaram ao código de antes e foram publicadas de novo;
- os arquivos `supabase/functions/_shared/whatsapp.ts` e `WHATSAPP.md`.

Os avisos seguem como eram: sino e push.

## O que ficou no banco (de propósito)
Não apaguei nada do banco, pela regra de não remover estrutura sem pedido expresso:
- a tabela `perfil_contatos` (vazia — nenhum número chegou a ser cadastrado);
- as colunas `whatsapp_status` e `whatsapp_em` em `notificacoes` (vazias em todos os avisos).

Nada no sistema usa essas estruturas agora, e a tabela continua sem acesso pelo navegador. O arquivo `migration_whatsapp.sql` ficou no repositório como registro do que existe no banco. Se quiser, removo as duas coisas num passo separado.

## Segredos
Nenhum segredo de WhatsApp foi criado por mim. Se você chegou a criar algum no Supabase (`ZAPI_*` ou `EVOLUTION_*`), pode apagar: o servidor não lê mais.

## Arquivos
Removidos: `supabase/functions/_shared/whatsapp.ts`, `WHATSAPP.md`.
Revertidos: `supabase/functions/b7-push/index.ts`, `supabase/functions/b7-auth/index.ts`, `js/database.js`, `js/usuarios.js`, `js/dashboard.js`, `styles/auth.css`, `styles/dashboard.css`.
Versão: `js/auth.js`, `sw.js`.

## Testes executados
- Busca no código: nenhuma referência restante ao envio, ao campo ou à linha de Configurações.
- Servidor: as duas funções publicadas respondem (401 sem sessão/segredo); o pedido de "situação do WhatsApp" não é mais reconhecido.
- Banco (só leitura): 0 números cadastrados e 0 avisos marcados.

## Não testado
As telas com conta real, e um aviso real para confirmar que o push continua chegando (o código do `b7-push` voltou a ser o de antes da zzz83).
