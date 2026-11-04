# Relatório — Cliente de teste permanente

**Versão:** `2026-10-09-zzz143` · **Cache:** `roteiros-b7-v348`
**Pedido:** item 98 (um cliente fictício, fora dos números e do Panorama, para testar a criação de registros).

## O que existe agora
Um cliente chamado **Cliente Teste B7**, criado no banco e marcado como teste. Aparece na lista de clientes e nos seletores como qualquer cliente, com a etiqueta **TESTE**, e **não tem o botão Excluir cliente** (para não ser apagado sem querer). Serve para criar demanda de vídeo, peça de design, gravação, conteúdo, linha editorial etc. sem encostar em dado de cliente de verdade.

## O que fica FORA dos números
- **Panorama** (e, por consequência, os números do **Painel de TV** que vêm dele): o cliente de teste não aparece.
- **Resumo do Dashboard** (total de clientes, gravações e roteiros): o cliente de teste e tudo que é dele não entram.

Testado: criei uma gravação para ele (e desfiz) e o resumo do Dashboard ficou exatamente igual; o Panorama continua com os 24 clientes de sempre, sem o de teste.

## O que NÃO fica fora (limites reais)
Eu preferi não mexer em mais cálculos sem você pedir, e isso deixa alguns lugares de fora:
- **Contadores calculados na própria tela** (Painel inicial, Kanban, listas): contam os registros do cliente de teste como qualquer outro, enquanto eles existirem.
- **Avisos automáticos de parados e lembretes** (rotinas de hora em hora): se houver uma peça ou demanda do cliente de teste com prazo vencido, ela pode gerar aviso como qualquer cliente.
- **Avisos ao atribuir uma demanda:** quem recebe é avisado normalmente.
- **Agenda e publicações no Painel de TV:** se o cliente de teste tiver gravação ou publicação marcada, ela pode aparecer.
- **Todos da equipe veem** o cliente de teste (a regra de acesso a clientes não foi alterada, de propósito).

**Por isso, o jeito certo de usar:** atribuir os testes a você mesmo, usar prazos que não vençam, e **apagar os registros de teste quando terminar**. Se você quiser, o próximo passo é tirar o cliente de teste também dos avisos e dos contadores da tela; é uma mudança maior, e eu faria com o seu aval.

## Banco de dados
`migration_cliente_teste.sql` (aplicada):
- coluna nova `clientes.teste` (padrão falso: nenhum cliente existente mudou);
- `clientes_resumo` ganhou a coluna `teste` no fim (mantendo a regra de acesso do próprio usuário);
- `panorama_mes` e `dashboard_resumo_contagens` passam a ignorar o cliente de teste: **é uma mudança em dois cálculos**, que você pediu ("fora dos números e do Panorama");
- um registro novo em `clientes`, o de teste.

Nenhuma regra de acesso (RLS) foi alterada e nada foi apagado.

## Arquivos alterados
`js/dashboard.js` (etiqueta TESTE nos dois cartões de cliente e sem o botão Excluir), `styles/sistema.css`, `sw.js`, `js/auth.js`.

## Novidades
Nenhuma entrada: é recurso de teste do administrador.

## Testes executados
**Banco, simulação desfeita, com a sua conta:** a coluna e o cliente de teste existem (1); a view continua com a opção de acesso do usuário; Panorama com 24 clientes e nenhum de teste; resumo do Dashboard igual antes e depois de criar uma gravação do cliente de teste.
**Tela, aba local sem login, com dados de mentira:** o cartão do cliente de teste mostrou a etiqueta TESTE e não tem Excluir; o cartão de cliente normal ficou como era.

## Não testado
- A tela de um cliente de teste real em uso (criar demanda, peça etc. por ele): é o primeiro uso de verdade.
- Quanto os avisos automáticos incomodam com ele (ver limites acima).
- Celular.

## Rastros do teste
Um registro novo permanente: o cliente de teste (é a ideia). A gravação de teste usada na conferência foi desfeita.
