# Relatório zzz66 — Videomaker: excluir/descartar/atribuir demanda e marcar/remarcar gravação (07/10/2026)

**Versão:** `2026-10-07-zzz66` · **Cache:** `roteiros-b7-v271`

## O que foi pedido
"Videomaker também pode editar a demanda e excluir. Assim como remarcar gravação, marcar uma gravação... enfim."

## Como interpretei
O pedido termina em "enfim", então liberei o que foi nomeado e o que faz parte direta disso; o resto ficou como estava e está listado no fim para decisão.

- **Editar a demanda:** já valia desde a zzz64. Faltavam o campo **Responsável** e os botões **Descartar** e **Excluir** — entraram agora.
- **Marcar / remarcar gravação:** o botão de data da gravação ("Marcar data" / "Remarcar"), incluindo o evento no Google Agenda.

## O que mudou

### Banco — `migration_videomaker_exclui_atribui_agenda.sql` (aplicada)
Só a trava de entrada de três funções, de "só equipe" para "equipe ou videomaker":

| Função | Para quê |
|---|---|
| `video_excluir_demanda` | excluir a demanda de edição |
| `video_atribuir` | trocar o responsável da demanda |
| `gravacao_agendar` | marcar e remarcar a data da gravação |

"Descartar" já era aceito pelo banco para o videomaker (é uma mudança de situação); só a tela escondia o botão.

Nenhuma política de RLS, tabela, coluna ou dado foi alterado.

### Servidor — função `google-agenda` (publicada)
As ações de **criar** e **atualizar** o evento no Google passam a aceitar também quem tem o papel de videomaker. Assim, ao marcar ou remarcar, o evento no Google acompanha. Conectar/desconectar a agenda, cancelar, editar e excluir evento continuam só de admin/coordenador.

Limite conhecido: aqui vale o **papel** videomaker. Quem é videomaker só por função extra (ex.: um designer com a função extra) consegue remarcar no B7, mas o Google responde que não pode — a tela avisa "Remarcado no B7, mas não deu pra atualizar no Google".

### Telas
- `js/video.js`: na tela da demanda, o videomaker vê **Descartar**, **Excluir** e o seletor de **Responsável**. "Registrar decisão do cliente" e "Registrar entrega" continuam só da equipe.
- `js/gravacao.js`: o videomaker vê **Marcar data / Remarcar** (botão e o cartão da data, que vira clicável).

## O que continua só da equipe (não mexi)
- Criar uma gravação nova, duplicar, arquivar e excluir gravação.
- Editar detalhes da gravação (nome, mês de referência, responsável, local).
- Cancelar gravação.
- Adicionar, editar, mover e remover itens da gravação.
- Editar roteiros.
- Pacotes, fechamento de mês, importação, gestão, decisão do cliente e entrega.

Criar gravação exigiria mexer em política de RLS da tabela de gravações (hoje a criação é uma escrita direta, permitida só à equipe) — por isso parei aí.

## Testes realmente executados
**Banco** (transação desfeita ao final; nada ficou gravado):
- como videomaker (Kaique): atribuir, remarcar (a data mudou para a esperada) e excluir funcionaram; cancelar gravação foi barrado;
- como designer: remarcar e atribuir foram barrados.

**Tela** (app local, arquivos novos carregados, sessão de videomaker simulada, dados de exemplo):
- gravação: 1 botão de remarcar, cartão da data clicável, 1 "Concluir", nenhum "Editar detalhes", nenhum "Adicionar item"; clicar em remarcar abriu a janela de data;
- nenhum erro de script.

## Não testado
- A função `google-agenda` depois de publicada (não chamei com conta de videomaker; o evento real no Google não foi tocado).
- Excluir, descartar e trocar responsável na tela da demanda com a conta do videomaker (só o banco foi testado).
- Marcar/remarcar de verdade com a conta do videomaker.
