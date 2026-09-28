# Vídeo: conclusão sem versão obrigatória · detalhe redesenhado · prévia navegável · sino no celular
**Data:** 2026-09-28 · **Pacote:** `atualizacao-2026-09-28-c.zip`
**Arquivos:** `js/video.js`, `js/database.js`, `js/previa-usuario.js`, `js/notificacoes.js`, `styles/video.css`, `styles/aprovacoes.css`
**Migration:** `migration_video_conclusao.sql` — **JÁ APLICADA** na produção (`rartcafydsaocdzshqcx`), aditiva: duas colunas, uma função, view recriada com as colunas no fim.

## 1. Conclusão da demanda = grupo + Drive (versão passa a ser opcional)
O processo real da B7 é mandar o vídeo no grupo de concluídos e subir no Drive. Registrar versão com link continuava sendo o único caminho no sistema. Agora a demanda tem um bloco **Conclusão** com dois cartões marcáveis — *Enviado no grupo de concluídos* e *Upado no Drive* — cada um com carimbo de hora ao marcar, barra de progresso "1 de 2", campo opcional de link do Drive (o antigo "Material editado" foi absorvido aqui) e, quando os dois estão feitos, o convite "Tudo feito. Marcar como entregue" (usa `video_mudar_status('entregue')`, que nunca exigiu versão). Cada marcação/desmarcação vira evento no histórico (`tipo = 'conclusao'`).
- Banco: `demandas_edicao.enviado_grupo_em`, `demandas_edicao.upado_drive_em` (timestamptz), função `video_marcar_conclusao(p_demanda_id, p_etapa 'grupo'|'drive', p_marcado)` (equipe ou o videomaker responsável), `demandas_edicao_resumo` expõe as duas colunas.
- A tela só desenha o bloco se a view devolver as colunas — sem a migration cai no bloco antigo "Material editado".
- O estado vazio de Versões agora diz que é opcional e aponta para a Conclusão.

## 2. Detalhe da demanda — menos cru
- **Hero** com faixa gradiente roxa, logo do cliente maior, cliente · código · competência acima do título, ações destrutivas à direita.
- **Etapas** (stepper) logo abaixo: Pendente → Em edição → Aprovação → Entregue; feitas em verde, atual em magenta; *Correção* e *Standby* aparecem como desvio âmbar na etapa 2; descartada esmaece tudo.
- Ordem dos blocos pelo fluxo do videomaker: Roteiro → Versões → Conclusão → Observações → Histórico.
- **Histórico** virou linha do tempo com pontos coloridos por tipo de evento.
- A faixa de resumo não repete a situação (o stepper mostra) — só prazo, responsável, gravação e prioridade quando não é normal.

## 3. "Visualizar como…" — agora dá pra navegar
Antes a prévia desabilitava **todo** botão, campo e seletor da área (e reaplicava via MutationObserver): abas, filtros, cartões do kanban, tudo morto — daí "não consigo clicar nos botões, entrar nas demandas". Trocado por **bloqueio de escrita na camada de dados**: com a prévia ativa, `B7.DB.rpc`, `B7.DB.chamarAuth`, `sb.from().insert/update/delete/upsert`, `sb.rpc`, `sb.storage.from().upload/remove/…` e `B7.Save.campo/acao` recebem substitutos que recusam com o aviso "Modo visualização — nenhuma alteração é salva" (toast, no máximo 1 a cada 2,5 s). Leitura segue normal; ao sair, os originais voltam. Testado automaticamente: rpc/update/upload recusados com `code = 'B7_PREVIA'`, select passa, botões ativos, restauração ao sair. A prévia de **cliente** (`#/previa/<id>`) já era navegável e continua igual.

## 4. Sino no Android/iOS
O painel era posicionado a partir do botão do sino (`right` = distância do sino até a borda) com 380px de largura; como o sino fica no meio da barra, a caixa estourava pela esquerda e cortava o começo de cada notificação. Até 600px o painel vira folha de largura total (`left/right: 10px`), e o JS deixa de calcular `right` nesse caso.

## Verificação
Harness com dados fictícios em 1366px e 390px: hero + stepper, bloco Conclusão, timeline, sino no celular, bloqueio de escrita da prévia. Sintaxe validada em todos os JS alterados.
