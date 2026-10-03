# Relatório — Painel: impacto e acabamento (pacote zx, 03/10)

Pedido: vídeo do celular + "quero o mais cinematográfico possível… perfeita, impecável. Me surpreenda".

## O que o vídeo mostrou (quadros extraídos com ffmpeg, 16,5 s, Android)
1. O feixe de luz horizontal do zv cortava "Kevin" e ficava parecendo **texto riscado**. Somava-se a isso a linha de horizonte do céu, que caía logo embaixo do título como um sublinhado.
2. Os blocos de baixo ("Precisa da sua atenção", "Minha semana") apareciam **antes** dos indicadores. A ordem do filme ficava embaralhada.
3. O contorno de luz dos blocos ficava branco e duro, parecendo seleção.

## Correções
- Feixe horizontal **removido**. No lugar: uma **onda de luz** passa pelas letras, uma a uma, depois que elas pousam. Um orbe suave atravessa por trás do título no mesmo ritmo. No tema claro, a onda é uma troca de cor para o rosa.
- Linha de horizonte removida do céu.
- **Ordem do filme:** topo → indicadores → blocos. Os blocos que já estão na tela esperam ~1,25 s (indicadores pousados).
- O gráfico e os números da produção agora só animam quando o bloco aparece. Antes, as barras cresciam fora da tela e, ao rolar, já estavam prontas.
- Contorno de luz mais fino (1px) e mais suave: rosa → violeta, sem branco, opacidade .8.

## Novidades (impacto)
- **Clarão de chegada:** quando a cortina da abertura sai, uma luz se abre atrás da saudação e assenta, no mesmo instante em que o logo pousa no topo.
- **Odômetro nos indicadores:**
  - Cada dígito é uma fita 0–9 que dá uma volta inteira e para no valor, um dígito depois do outro, com desfoque nas bordas durante o giro.
  - A fita aparece no 0 enquanto o cartão cai e gira quando ele pousa. No fim, volta a ser texto normal.
  - O leitor de tela lê o número em texto (`sr-only`).
- **Onda de choque** vermelha no cartão "Atrasadas" quando o número pousa; depois ele continua respirando.
- **Estouro** no valor da barra da semana atual quando ela chega: anel de luz e pulo.
- **Giroscópio (Android):** o céu (luzes, raios, partículas) acompanha a inclinação do celular, como um papel de parede com profundidade.
  - O ponto neutro é o jeito que você segura o aparelho e se ajusta sozinho.
  - No iPhone não liga, porque lá exige um pedido de permissão na tela.
  - Desligado com "reduzir movimento".

Só apresentação: nenhum dado, regra, permissão, link ou RLS alterado. Sem migration.

## Testes executados
Navegador do app, 390×844, dados de exemplo (videomaker), sessão simulada no console. Painel do navegador oculto, por isso usei `requestAnimationFrame` trocado por temporizador e quadros congelados.

| Teste | Resultado |
|---|---|
| Odômetro (amostras no tempo) | 0,3 s: fita no 0 · 1,1 s: girando nos 4 cartões · 3,2 s: texto final 9, 4, 13, 0 |
| Clarão inserido no céu; `--pn-n` do título | ok; 14 letras |
| Título sem risco/sublinhado | captura conferida depois de remover feixe e horizonte |
| Ordem: bloco de atenção | ainda não visível em 1,15 s (esperando); com `pn-visto` em ~1,25 s |
| Gráfico só cresce com o bloco visível | sem `pn-visto`: 0 gráficos crescidos; com `pn-visto`: cresceu; valores finais 3, 6, 5, 2, 8 e resumo 24, 8, 3,2 |
| Rolagem horizontal | 390 (sem vazamento) |

**Não testado:**
- giroscópio (sem sensor no navegador);
- celular físico;
- iPhone/Safari;
- "reduzir movimento";
- captura do odômetro no meio do giro (a captura de tela parou de responder com o app minimizado);
- dados reais;
- Painéis do Coordenador, Designer e composto.
