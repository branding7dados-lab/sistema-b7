# Relatório zzz215 — Níveis de acesso dentro de cada módulo (item 166)

Pedido do Kevin: níveis **Sem acesso / Ver / Editar / Total**, **tudo de uma vez** (tela + banco), **todos os módulos**.

## O que cada nível faz
| Nível | Na tela | No banco |
|---|---|---|
| Sem acesso | o módulo some do menu (igual antes) | igual antes (a leitura no banco não mudou) |
| Ver | abre a tela com o aviso "Seu acesso a esta tela é só para ver."; somem criar/editar/aprovar/excluir; "Criar" do topo não oferece o módulo | gravações e funções do módulo recusam com mensagem clara |
| Editar | somem aprovar/excluir/arquivar | criar e alterar passam; aprovar, excluir e mandar para a lixeira recusam |
| Total | tudo | tudo (comportamento de antes) |

Administrador é sempre Total. **Todo mundo começou em Total** onde já tinha o módulo: ninguém perdeu nada ao publicar.

## Banco (migrações `niveis_de_acesso_por_modulo` e `niveis_trava_so_tela`)
- `funcao_modulos.nivel` (padrão `total`) e `perfil_modulos.nivel` (exceção por pessoa).
- `nivel_modulo()`, `modulos_niveis()` e `exigir_nivel()`; `minha_sessao` passou a trazer `niveis`.
- Gatilho `zz_trava_nivel` em 13 tabelas que a tela grava direto (clientes, cliente_inteligencia, linhas_editoriais, conteudos, pilares, produtos, provas, roteiros, cenas, gravacoes, kanban_demandas, status_semanais, status_itens). Só age em gravação direta da tela; dentro das funções do servidor quem checa é a própria função.
- `exigir_nivel` inserido no começo de 80 funções do servidor (vídeo, design, gravações, calendário, aprovações, linhas, quadro, oportunidades, clientes). Aprovar/decidir/excluir/fechar mês pedem Total; o resto pede Editar.
- A trava só age em quem **tem** o módulo com nível menor. Quem não tem o módulo continua como antes (limite conhecido: a leitura por módulo no banco segue pendente, como já estava).
- RLS existente não foi alterado nem enfraquecido.

## Edge Function
- `b7-auth` (publicada): aceita `ver/editar/total` nas exceções e `{ modulo: nivel }` no padrão da função; a lista antiga continua aceita.

## Tela
- Usuários e acessos: cada módulo tem o seletor Sem acesso / Ver / Editar / Total (na pessoa e em "Funções e acessos"); diferença do padrão aparece como "personalizado · padrão X".
- Cartões da lista: bolinha azul = Ver, amarela = Editar; a dica mostra o nível.
- Visualizar como…: leva os níveis da pessoa.

## Testes feitos
- Banco (em bloco desfeito no fim, nada gravado): Ver recusa alterar; Editar recusa excluir e lixeira; Editar passa em alterar; sem módulo passa como antes; atualização direta de cliente com Ver recusada pelo gatilho.
- Tela local com dados de mentira: seletor, personalização voltando ao padrão some, "Salvar" manda `{video:'ver', design:'editar', clientes:'ver'}`, padrão da função manda `{design:'total', ...}`; rota com Ver liga o aviso, rota com Editar liga o modo sem excluir.
- Sintaxe dos 6 arquivos JS conferida.

## Não testado
- Com contas reais restringidas (nenhum nível foi mudado em produção).
- Cada botão de cada tela: os botões escondidos são os de atributos comuns (`data-excluir`, `data-editar`, `data-criar`…); algum botão diferente pode continuar aparecendo — o banco recusa mesmo assim, com a mensagem.
- Celular.
