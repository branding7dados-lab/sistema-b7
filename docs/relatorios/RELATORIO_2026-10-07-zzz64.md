# Relatório zzz64 — Videomaker: criar e editar demandas, Gravações, Roteiros e Teleprompter (07/10/2026)

**Versão:** `2026-10-07-zzz64` · **Cache:** `roteiros-b7-v269`

## O que foi pedido (vídeo de 07/10, 10:56, visualizando como Kaique Viana)
1. O videomaker não consegue criar uma demanda de vídeo nem editar uma demanda.
2. O videomaker precisa ter acesso à área de Gravações.
3. Precisa ter acesso ao Teleprompter e aos Roteiros, sem editar.
4. Precisa conseguir exportar os roteiros.

## Auditoria (antes de mexer)
- **Criar/editar demanda:** seis funções do banco só aceitavam a equipe (admin/coordenador). A tela escondia os campos e, no topo, o "Nova demanda de vídeo" aparecia mas não fazia nada, porque o botão que ele aciona não existia para o videomaker.
- **Gravações, roteiros e cenas:** o banco já deixava o videomaker LER (regra `sou_equipe_interna()`), e só a equipe escrever. O que faltava era a rota e o item de menu.
- **Editor de roteiro:** não tinha modo de leitura. Quem não é equipe via os campos como editáveis e o salvamento falhava no banco.

## O que mudou

### Banco — `migration_video_videomaker_cria_edita.sql` (aplicada)
A trava de entrada de seis funções passou de "só equipe" para "equipe ou videomaker". O corpo das funções não mudou.

| Função | Para quê |
|---|---|
| `video_criar_demanda` | criar demanda manual |
| `video_gerar_demandas_de_gravacao` | criar a partir dos roteiros de uma gravação |
| `video_gerar_demanda_agrupada` | vários roteiros numa demanda só |
| `video_editar_demanda` | nome, código, pacote, prazo, prioridade, observações, gravação |
| `video_definir_roteiros` | roteiros vinculados à demanda |
| `video_definir_standby` | data de revisão do standby |

Continua só da equipe: trocar o responsável, excluir, descartar, registrar decisão do cliente, registrar entrega, pacotes, fechamento de mês, importação e gestão.

**Nenhuma política de RLS foi alterada.** Nenhuma tabela, coluna ou dado foi tocado.

### Telas
- `js/permissoes.js`: o videomaker passa a abrir **Gravações** e **Roteiros**; os dois itens aparecem no menu dele.
- `js/video.js`: o videomaker vê o botão **Nova demanda** e, na tela da demanda, edita nome e código, prazo, prioridade, pacote, gravação vinculada, roteiros vinculados e observações. Responsável, Descartar e Excluir continuam só para a equipe.
- `js/editor.js` + `styles/global.css`: **modo leitura** do roteiro para quem não é equipe (videomaker e designer). Campos travados, sem arrastar, sem criar/duplicar/excluir roteiro ou cena, sem IA, sem enviar para aprovação, e nada é salvo. Continuam: **Teleprompter**, Apresentar roteiros, Visualização rápida, **Baixar roteiro** e **Imprimir**.
- Listas de Gravações e Roteiros: para quem não é equipe somem Nova gravação, Duplicar, Fixar, Arquivar, Excluir e Definir mês. Fica "Imprimir roteiros".
- `js/topo.js`: "Nova gravação" no menu Criar só aparece para a equipe.

### Efeito colateral a saber
O modo leitura do editor vale também para o **Designer**, que já abria roteiros e via campos editáveis que o banco recusava. Para ele some a aparência de edição; o que ele podia fazer de fato não muda.

A lista de sugestões de **pacote** não aparece para o videomaker (o banco só mostra os pacotes à equipe); o campo continua aceitando texto livre.

## Testes realmente executados
**Banco** (dentro de uma transação desfeita ao final; nada ficou gravado):
- como videomaker (Kaique): criar demanda, editar, definir roteiros e definir standby funcionaram; excluir e atribuir foram barrados;
- como designer: criar e editar foram barrados.

**Tela** (app local, arquivos novos carregados, sessão de videomaker simulada e banco substituído por dados de exemplo):
- rotas: Gravações, Roteiros, Gravação e Vídeo liberadas; Clientes, Linhas e Kanban negadas;
- editor em leitura: 7 campos, 0 editáveis, 0 itens arrastáveis; "Nova cena", "Novo roteiro", menu da cena e "Excluir roteiro" escondidos; sem IA; Baixar e Teleprompter presentes;
- chamar "novo roteiro" e "excluir roteiro" por código não gravou nada;
- menu Criar do videomaker: só "Nova demanda de vídeo";
- nenhum erro de script.

## Não testado
- O fluxo com a conta real do videomaker: criar uma demanda pela janela, editar na tela da demanda, abrir Gravações/Roteiros, Teleprompter e exportar um roteiro.
- As listas de Gravações e Roteiros renderizadas para o videomaker (só as regras de CSS foram escritas; não vi a tela).
- Celular.
