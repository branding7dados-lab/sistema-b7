# Relatório zzz224 — Cargo Super admin (e o Admin supremo)

Pedido do Kevin: criar o cargo **super admin**, acima do administrador; Kevin e Yury Nóbrega como super admin, Kevin como **admin supremo**; chamado aberto por administrador vai para os super admins; plano do que o super admin pode ter.

## O que foi feito
- `perfis.superadmin`: vazio (administrador comum), `super` ou `supremo` (só pode existir um supremo).
- **Kevin França → admin supremo. Yury Nóbrega → super admin.**
- Funções `sou_superadmin()` e `sou_supremo()`; a sessão (`minha_sessao`) leva o cargo para a tela.
- **Travas no banco** (gatilho `_perfis_trava_super`): só super admin muda quem é super admin; só o supremo mexe no supremo; super admin precisa ser administrador; não dá para tirar o "administrador" de quem é super admin sem tirar o cargo antes.
- **Travas na b7-auth** (publicada): administrador comum não troca senha, acesso, foto, não desativa, não exclui e não "entra como" um super admin; ninguém além do próprio Kevin mexe na conta do supremo.
- **Chamados de administrador** (que não é super) avisam só os super admins, com "(administrador)" no aviso. Chamados da equipe e dos clientes continuam indo para administração e coordenação.
- Usuários e acessos: etiqueta **Super admin** (roxa) e **Admin supremo** (dourada) no cartão.

## Testes feitos
- Banco (bloco desfeito): administrador comum tentando se promover → recusado; Yury tentando virar supremo ou tirar o Kevin → recusado; `sou_superadmin()` do Yury → verdadeiro.
- `b7-auth` publicada e respondendo; sintaxe de `js/usuarios.js` conferida.

## Não testado
- As travas da b7-auth com uma conta de administrador comum de verdade; a etiqueta na tela com dados reais; o aviso de chamado de administrador chegando aos super admins.
