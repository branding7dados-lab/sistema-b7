# Relatório zzz62 — Editar nome e código da demanda de edição (07/10/2026)

**Versão:** `2026-10-07-zzz62` · **Cache:** `roteiros-b7-v267`

## O que foi pedido
"Eu quero poder alterar o nome e código da demanda de edição, mesmo depois de criada."

## Auditoria antes de mexer
- O banco já tinha a ação `video_editar_demanda`, que aceita título e código. Só a tela não oferecia esses dois campos depois da criação.
- Quem pode: só a equipe (Administrador e Coordenador) — regra que já estava na função. Não foi alterada.
- O código não tem regra de unicidade no banco: dois códigos iguais são aceitos, como já acontecia na criação.
- O título não pode ficar vazio (regra do banco).

## O que mudou
Somente `js/video.js`. Sem migração, sem mudança de regra, permissão ou RLS.

- Na tela da demanda, junto de "Descartar" e "Excluir", há o botão **Editar nome e código** (aparece para quem já via esses dois botões: a equipe).
- Abre uma janela com Nome e Código já preenchidos. Enter salva. O código pode ficar em branco; o nome não.
- Demanda importada "Sem título (planilha)": o campo Nome abre vazio para receber o nome de verdade.
- Depois de salvar, a tela da demanda é recarregada e a lista/Kanban passam a mostrar o novo nome e código.

## Testes realmente executados
- No banco, dentro de uma transação desfeita ao final (nada foi gravado): como administrador, a função trocou título e código de uma demanda; como designer, foi barrada com "Só a equipe edita os dados da demanda."
- O app local carregou o `video.js` novo (confirmado que era o arquivo novo) sem erro de script.

## Não testado
- O botão e a janela com conta logada — o teste local não tem sessão.
- Observação: a mudança de nome/código não gera linha no Histórico da demanda (a função do banco nunca registrou isso). Registrar exigiria mexer no banco; não foi feito.
