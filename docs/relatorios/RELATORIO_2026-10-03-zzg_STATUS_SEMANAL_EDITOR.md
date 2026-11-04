# Relatório — editor do Status semanal: UI/UX e animação (pacote zzg, 03/10)

Pedido: print do editor de um status (ClimaPro, 28/09–04/10) no celular + "Melhora aí".

## Problemas da tela
- Trilha longa ("Central B7 / ClimaPro / Status semanal / 28 de setembro…"). O **período aparecia duas vezes** e o título era o genérico "Status semanal".
- "+ Adicionar demanda" em gradiente largo e "Exportar" sem ícone.
- Opções do relatório como "pílulas" rosa com caixinha de marcar, misturadas a um seletor solto.
- **Cada dia vazio ocupava duas faixas**: "Sem atividades programadas" + botão tracejado "+ Adicionar demanda neste dia", sete vezes na semana.

## O que mudou (`js/semana.js` → `render`, `blocoInfo`, `blocoDia`; `styles/semana.css`)
- **Cabeçalho:**
  - "‹ Status semanal" para voltar (a trilha longa saiu);
  - logo do cliente, kicker "Status semanal", **título = cliente**, período uma vez só · situação do relatório em destaque;
  - "+ Demanda" (pílula) e "Exportar" com ícone de download; ⋯ igual.
- **"Como aparece para o cliente":**
  - as três opções viraram **chaves liga/desliga** numa lista agrupada (o mesmo `<input>` checkbox com o mesmo evento, só o desenho mudou);
  - "Mostrar atividades" (Toda a semana / A partir de hoje) é a última linha da lista.
  - Observação geral e "Escrever com IA" continuam no topo do cartão.
- **A semana como linha do tempo:**
  - cada dia é **uma linha**: ponto na linha vertical, dia, data, contagem e um **"+" redondo** para adicionar naquele dia (mesmo `data-add-dia`);
  - dia vazio mostra só "Livre";
  - dia com demanda tem ponto rosa;
  - **hoje** tem selo "HOJE" e ponto pulsando;
  - dias que já passaram ficam esmaecidos;
  - as demandas aparecem logo abaixo do dia, como antes.
- **Movimento:**
  - cartões de cima entram subindo;
  - os dias entram em cascata;
  - as demandas deslizam da direita;
  - o "+" gira ao tocar;
  - a chave tem mola.
- No celular, o título da demanda usa até duas linhas e as setas de ordem ficaram menores.
- "Reduzir movimento": sem animação.

Nada de dados, regras ou banco. Os ajustes salvam como antes.

## Testes executados
Navegador do app, 390×844, tema escuro, status simulado (ClimaPro, 3 demandas em seg, qua e sáb; hoje = sáb 03/10):

| Teste | Resultado |
|---|---|
| Dias | seg(1) · ter Livre · qua(1) · qui Livre · sex Livre · **sáb HOJE (1)** · dom Livre; dias passados marcados |
| Cabeçalho | título "ClimaPro"; "28 de setembro a 04 de outubro · 2026 · Rascunho" |
| Chaves | checkbox virou chave (`appearance:none`, 46px); estado ligado/desligado correto |
| Capturas | topo (cabeçalho, ações, opções) e linha do tempo (pontos, Livre, HOJE, "+") |
| Rolagem horizontal | 390 |
| Erros no console | nenhum |

**Não testado:**
- salvar as opções e adicionar demanda de verdade (banco simulado);
- computador;
- tema claro;
- celular físico;
- dados reais.
