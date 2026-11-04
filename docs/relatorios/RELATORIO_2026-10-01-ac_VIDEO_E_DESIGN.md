# Relatório 2026-10-01-ac — Videomaker na Produção de Vídeo, Kanban sem exigir versão e correção do envio de Design

> **Situação (01/10/2026).** Três mudanças, todas publicadas: banco (duas migrations aplicadas) e front no GitHub, versão `2026-10-01-ac`. Tudo foi testado com dados e sessões **simulados**; nenhum teste foi feito com um usuário videomaker real, porque hoje não existe nenhum ativo.

## Resumo

1. **Videomaker vê e opera todas as demandas de vídeo**, não só as dele. Continua sem as ferramentas de gestão.
2. **Kanban de vídeo:** mover um cartão para "Aguardando aprovação" só atualiza a situação. Não exige mais versão registrada no B7.
3. **Design:** corrigido o erro que derrubava o envio de uma peça para aprovação do cliente. O envio preso desde 11/09 foi encerrado.

## 1. Videomaker na Produção de Vídeo

**Regra decidida por você:** quem é videomaker (papel ou função extra) vê todas as demandas e pode mexer em todas, porque um cobre o outro.

**Na prática, hoje:** você e o Kaique são admins e já tinham esse acesso. A mudança vale para quem for só videomaker. Não há nenhum usuário ativo assim no momento (2 admins, 1 coordenador, 2 designers).

**O que o videomaker passa a poder, em qualquer demanda**

- ver a lista e o Kanban da Produção de Vídeo, com todas as demandas;
- abrir a demanda e ver versões, comentários, histórico e roteiros vinculados;
- mudar a situação (inclusive arrastando no Kanban);
- registrar versão, definir o link dos materiais, marcar as etapas de conclusão e comentar.

**O que continua só para admin e coordenador**

- criar, editar, excluir e atribuir demanda; vincular roteiros;
- importar planilha, pacotes, data de standby, descartados;
- registrar a decisão do cliente, fechar e reabrir o mês, gestão e relatórios.

**Tela**

- A rota "Edição de vídeo" abre a mesma **Produção de Vídeo** para todos. Para o videomaker, os botões Gestão, Pacotes, Importar, Descartados e Nova demanda não aparecem.
- O filtro **Minha fila** aparece para quem é videomaker. O atalho "Minha fila de edição" do Painel já abre a tela com ele ligado.
- **A tela "Central de Vídeo" deixou de existir.** Era a fila pessoal do videomaker e só fazia sentido enquanto ele via apenas as próprias demandas. O "o que precisa de mim agora" continua no Painel, e a fila pessoal é o filtro Minha fila.

**Banco** (`migration_video_videomaker_opera_todas.sql`, aplicada)

- 5 regras de leitura (demandas, versões, comentários, histórico, roteiros vinculados): de "equipe ou o videomaker atribuído" para "equipe ou qualquer videomaker".
- 5 funções (mudar situação, registrar versão, link, conclusão, comentar): a mesma troca, em uma linha de cada.
- `perfis_leitura`: a equipe interna passa a enxergar o perfil de quem tem papel videomaker. Sem isso, um videomaker veria a demanda de outro sem o nome do responsável.
- Nenhuma regra de escrita direta foi aberta: tudo continua passando pelas funções.

**Efeito colateral a saber:** no Calendário, um videomaker passa a ver os prazos de todas as demandas de vídeo, não só das dele. É consequência direta da regra.

## 2. Kanban: "Aguardando aprovação" sem exigir versão

- **Antes:** ao arrastar um cartão sem versão registrada, aparecia "Sem versão registrada" e o sistema abria a demanda.
- **Agora:** o cartão vai para "Aguardando aprovação" e a situação é atualizada. O vídeo pode estar só no Drive.
- **Com versão registrada:** continua como era, com a confirmação "Enviar V01 para a aprovação do cliente?", que marca aquela versão como enviada.
- Só front (`js/video.js`). O banco já aceitava essa mudança de situação.

**Não mudou:** arrastar para "Entregue" ainda exige uma versão aprovada pelo cliente. Sem versão registrada, a entrega é feita dentro da demanda. Se quiser o mesmo tratamento para "Entregue", é uma decisão sua.

## 3. Design: envio para aprovação do cliente

**O que acontecia.** Ao processar um envio de Design ao cliente, a função `aprov_processar_evento` procurava o cartão do Kanban pelo tipo de vínculo errado, não achava, e tentava criar um cartão de um tipo que o banco não aceita. O envio inteiro falhava, inclusive o aviso ao cliente.

**Origem.** A correção já estava escrita no repositório (`migration_design_decisao_cliente.sql`), mas a função em produção estava sem ela. Não consegui determinar quando ela se perdeu; no pacote de notificações (`v`) eu reescrevi essa função a partir da que estava no banco, já sem a correção.

**O que mudou** (`migration_aprovacao_design_kanban.sql`, aplicada): duas linhas da função.

- o cartão da peça de Design é procurado pelo vínculo certo;
- para Design, a função não cria cartão novo: a peça já tem o dela.

A regra do banco que lista os vínculos aceitos **não foi alterada**. Roteiro, linha editorial e os demais tipos se comportam igual.

**Efeito novo, esperado:** como o cartão agora é encontrado, "ajustes" e "recusa" do cliente movem o cartão da peça para a coluna Ajustes, e a aprovação o leva a Pronto quando ele estava aguardando o cliente.

**Envio preso desde 11/09:** encerrado sem reprocessar, com o motivo registrado. A peça foi aprovada e finalizada no mesmo dia; reprocessar mandaria ao cliente um aviso com três semanas de atraso. A fila ficou sem eventos presos.

## Arquivos

**Criados**

- `migration_video_videomaker_opera_todas.sql`
- `migration_aprovacao_design_kanban.sql`

**Alterados**

- `js/video.js`: uma tela só, ferramentas de gestão só para equipe, operar liberado ao videomaker, Kanban sem exigir versão; removida a Central de Vídeo.
- `styles/video.css`: removidos os estilos da Central de Vídeo.
- `js/permissoes.js`: comentário.
- `js/auth.js` (versão `2026-10-01-ac`), `sw.js` (cache `v126`).

## Testes executados

Todos simulados. Os de banco rodaram em produção dentro de uma transação desfeita no fim (nada foi gravado); depois de aplicar, conferi que não sobrou resíduo.

**Banco — videomaker** (dois designers reais transformados em videomaker só dentro da transação)

- videomaker vê 443 de 443 demandas, na tabela e no resumo;
- vê o nome do outro videomaker como responsável e a lista de videomakers;
- em demanda atribuída a outra pessoa: mudou a situação, gravou o link, marcou conclusão, registrou versão, comentou e moveu para "Aguardando aprovação" sem envio de versão;
- vê a versão e o histórico dessa demanda;
- gestão recusada (9 de 9): criar, editar, excluir, atribuir, pacote, fechar mês, data de standby, decisão do cliente e escrita direta na tabela;
- não vê pacotes nem perfis de clientes;
- designer sem função de vídeo: vê 0 demandas e não muda situação;
- cliente do Portal e visitante: 0 demandas; cliente não vê perfis de videomaker;
- admin: vê as 443 e opera como antes.

**Banco — Design**

- peça com cartão, envio ao cliente: processado sem erro, cartão em "Aguardando cliente", ligado à aprovação, nenhum cartão novo;
- a mesma peça com ajustes do cliente: cartão em "Ajustes", nenhum cartão novo;
- peça sem cartão: processado sem erro, nenhum cartão criado;
- roteiro sem cartão: continua criando o cartão, como antes.

**Tela** (`js/video.js` e `js/ui.js` reais numa página local, banco simulado)

- videomaker puro: título "Produção de Vídeo", nenhuma ferramenta de gestão, 3 de 3 demandas ativas na lista com os responsáveis, filtro Minha fila reduzindo a 1, 3 cartões arrastáveis;
- arrastar para "Aguardando aprovação" **sem** versão: chama só a mudança de situação, sem diálogo;
- arrastar **com** versão: confirmação e envio da versão;
- arrastar para "Em edição": mudança simples;
- admin e coordenador: as 5 ferramentas presentes e o mesmo comportamento no Kanban;
- designer sem função de vídeo: nenhum cartão arrastável;
- o app real carrega com os arquivos novos.

**Não testado**

- um videomaker real logado (não existe um);
- a tela de detalhe da demanda como videomaker, clicando de verdade: conferi a regra no código e as funções no banco, não o clique;
- um envio real de Design ao cliente depois da correção;
- celular.

## Observação de segurança (não alterada)

A função `aprov_processar_evento` pode ser chamada por visitante sem login. Ela só processa um evento pendente cujo identificador a pessoa já conheça, então o risco é baixo, mas o repositório indica que a intenção era restringir. Não mexi porque é permissão e não foi pedido.

## Pendências

- Quando entrar o primeiro videomaker "puro", vale um teste com ele logado.
- "Entregue" no Kanban sem versão registrada: decidir se segue a mesma lógica de "Aguardando aprovação".
- Trocar a chave do Gemini que ficou no histórico do chat.
