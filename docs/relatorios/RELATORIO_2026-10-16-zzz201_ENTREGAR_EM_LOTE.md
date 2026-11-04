# Relatório — Entregar várias demandas de vídeo de uma vez

**Versão:** `2026-10-16-zzz201` · **Cache:** `roteiros-b7-v404`
**Pedido:** "ter uma opção de selecionar todos, ou selecionar os que eu quero, clicar com o botão direito e colocar como entregue."

## O que mudou (Edição de vídeo, Kanban e Lista)
- **Escolher:** Ctrl/Cmd + clique (ou Shift + clique) marca/desmarca uma demanda; com alguma marcada, o clique simples só alterna. Espaço também alterna no teclado. O cartão marcado fica com contorno rosa.
- **Selecionar todas:** link ao lado do total ("N demandas") e botão na barra de seleção; seleciona as demandas visíveis (respeita mês e filtros; não pega entregues/descartadas).
- **Botão direito:** abre menu com "Marcar N como entregues", Abrir demanda (quando é uma só), Selecionar todas e Limpar seleção. Se o cartão clicado não estava marcado, ele vira a seleção. Shift + direito mantém o menu do navegador.
- **Barra flutuante** embaixo com a contagem e os mesmos atalhos (também funciona no celular, pelo clique).
- Entrega em lote pede confirmação, atualiza a tela na hora e chama `video_mudar_status('entregue')` para cada demanda (mesma função do botão "Marcar como entregue" da demanda, com mensagem "Marcada como entregue (seleção em lote)" no histórico). Se alguma falhar, ela volta ao status anterior e aparece aviso com quantas falharam.
- Só quem opera vídeo (equipe/videomaker elegível) vê isso.

## Banco de dados
Nenhuma mudança.

## Arquivos alterados
`js/video.js`, `styles/video.css`, `js/novidades.js`, `js/auth.js`, `sw.js`.

## Testes
Sintaxe do JS verificada (`node --check`). Não foi possível abrir a tela logada aqui; a lógica foi conferida por leitura. Vale testar no Kanban: Ctrl+clique em 2 cartões, botão direito, Marcar como entregue.
