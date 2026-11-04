# zzz235: correções da revisão geral (módulos internos)

Pedido do Kevin: "vamos fazer uma revisão geral no sistema, consertar bugs".
Uma varredura dos módulos internos encontrou os problemas abaixo. Antes de corrigir, conferi cada um no código.

| # | Problema | Correção |
|---|---|---|
| 1 | Com internet lenta, a tela anterior desenhava por cima da nova (Kanban, Design, Central do designer, Design por linha, peça de Design, Linha, Aprovações, Usuários, Gravação, Cliente) | Cada tela checa `B7.Rota.marca()` depois de cada espera antes de desenhar |
| 2 | Linha: abrir a linha A e logo a B misturava o cabeçalho de uma com os conteúdos da outra | Os dados chegam em variáveis locais e só entram em `L` todos juntos, se a tela ainda for a mesma |
| 3 | Criativo aberto por "Publicações do Dia" reabria sozinho depois de fechado | O `?conteudo=` sai do endereço depois de abrir |
| 4 | Painel da peça de Design podia mostrar o histórico e o briefing de outra peça, ou dar erro se fechado no meio | `carregarExtra` grava só no painel para o qual começou |
| 5 | Aprovações: trocar de aba depressa mostrava a lista de outra aba | Número de pedido: só a última resposta desenha |
| 6 | Prazos de Design de hoje apareciam como atrasados depois das 21h | `B7.UI.hojeISO()` (data do Brasil). Mesmo ajuste em Trends e WhatsApp |
| 7 | Vídeo: link digitado e não salvo sumia com a atualização em tempo real | O tempo real espera enquanto houver campo alterado e não salvo na demanda de vídeo. Também espera com a tela cheia ou a peça de Design abertas |
| 8 | Conversas: trocar de conversa depressa marcava como lida a que não foi vista | Só marca se a conversa ainda for a aberta |
| 9 | Suporte: se o anexo falhava, tentar de novo abria um segundo chamado | O chamado criado é guardado e a nova tentativa só anexa |
| 10 | Sino: avisos criados juntos sumiam na troca de página, e a lista voltava ao começo a cada minuto | A paginação usa `lte` e tira os repetidos. A lista só recarrega se o número mudar, e do mesmo tamanho |
| 11 | A tela cheia do Design continuava aberta depois de voltar no navegador | Registrada em `B7.Rota.aoSair` |

Verificação: não encontrei nenhum caso de XSS (todos os campos passam por `esc`). `npm test` passou.
