# Relatório zzz61 — Arrasto do Kanban fluido (07/10/2026)

**Versão:** `2026-10-07-zzz61` · **Cache:** `roteiros-b7-v266`

## O que foi pedido (vídeo de 07/10, 10:23)
"A animação de quando eu arrasto tá feiona, não tá fluida."

## O que o vídeo mostra
1. A cópia do cartão fica muito atrás do cursor e anda aos trancos.
2. No começo do arrasto a cópia demora a aparecer.
3. Duas colunas ficam acesas ao mesmo tempo.

## Causas
1. A cópia só mudava de lugar quando o navegador entregava um evento "dragover", que chega espaçado e irregular.
2. A cópia é um clone do cartão e herdava a animação de entrada dele (nascia transparente, com atraso).
3. A coluna só apagava no "dragleave", que o navegador nem sempre entrega com a informação necessária.

## Correção
- `js/movimento.js` (`arrastoFisico`, usado pelo Kanban do Vídeo e pelo Kanban geral): o "dragover" agora só anota onde o cursor está; um laço por quadro aproxima a cópia do alvo com amortecimento, independente da taxa de quadros. A inclinação vem da velocidade real da cópia (até 9°) e ela endireita quando a mão para. A cópia nasce visível, sem a animação de entrada herdada. Ao soltar, termina no ponto do cursor, endireita e some em 170 ms.
- `js/video.js`: só uma coluna acesa por vez, e as classes só são mexidas quando a coluna muda.

Só apresentação: mover, regras e gravação não mudaram. Sem migração.

## Testes realmente executados
- Quadros do vídeo extraídos e analisados (6 por segundo).
- No app local, com o arquivo novo carregado: simulei um arrasto de (100,100) para (600,400) avançando os quadros à mão. A cópia nasceu visível, passou por 383 → 538 → 595 px e parou em 600,400; a inclinação subiu a 5,7° e voltou a 0°.

## Não testado
- Arrasto real com o mouse e conta logada (o navegador de teste fica com os quadros congelados, por isso avancei à mão). A sensação de fluidez só dá para julgar no PC.
- O Kanban geral, que usa a mesma função.
