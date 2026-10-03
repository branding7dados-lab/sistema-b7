# Relatório — Publicações do Dia, nova tela e animação (pacote zzl, 03/10)

Pedido: print da tela Publicações do Dia no celular + "Melhora essa tela aí e adiciona animação".

## O que mudou
| Parte | Antes → depois |
|---|---|
| Topo | No celular, o parágrafo explicativo sai e entra uma frase com o dia ("3 publicações hoje · 12 pendentes"). "Ver no calendário" vira um botão de ícone (no computador continua escrito). |
| Cartão da semana | Mês, botão "Hoje" e "Ir para" (ícone que abre o calendário do aparelho) ficam num cartão junto com os dias. No celular os 7 dias cabem sem rolar de lado; antes ficavam cortados. O dia escolhido é uma pílula com o degradê da marca. Hoje tem contorno, dias passados ficam mais apagados e o número de publicações aparece na cor da marca. |
| Trocar de dia | **Sem esqueleto** quando o dia já veio na última consulta (a semana em volta): aparece na hora e a busca atualiza por baixo. A faixa **desliza** o tanto de dias que andou, para o dia escolhido voltar ao meio. O conteúdo do dia entra **do lado certo**, em cascata. **Arrastar de lado** (na faixa ou na lista) troca o dia. |
| Contagem dos dias | Dias fora do que já foi buscado ficam em branco, em vez de "—", que dava a entender zero. |
| Cartão da publicação (celular) | O nome do cliente não se repete (já está no título do grupo). Ações com ícone e rótulo curto: "Detalhes · Criativos · Linha". "Copiar legenda", quando existe, ganha a linha inteira em destaque. |
| Próximas publicações | Cartões com o dia, a data, o **número grande** e uma barra que mostra qual dia tem mais (cresce ao aparecer). |
| Pendentes de dias anteriores | Mostra os 5 primeiros e um botão **"Ver todos os N"** que abre deslizando. O atraso aparece como "ontem" ou "há 3 dias" (a data completa fica no title). |
| Dia sem publicação | Ícone com movimento, mesmo texto e atalho de antes. |
| Entrada da tela | Dias em cascata, cabeçalho do dia, chips de status e cartões em sequência; depois as seções de apoio. Os pendentes entram em cascata quando chegam. |

Também mudou:
- **Correção encontrada no teste:** o avatar de cliente sem logo ficava esticado (40×104). Ele usa a classe `.vazio`, que é também a do estado vazio do sistema. Corrigido nesta tela (30×30).
- **Arrastar de lado:** passou para `B7.Movimento.deslizar` (js/movimento.js), que agora é usado também pelo Calendário (zzk). Comportamento igual.

"Reduzir movimento": as animações são desligadas.

Nada mudou em consulta, status, regra, banco ou permissão. A tela continua só lendo.

## Testes executados
Navegador do app, 375×812, tema claro (e 1280px no fim), sessão e dados simulados: 3 publicações hoje, outras na semana e 12 pendentes. Painel do navegador oculto: usei quadros congelados e toques sintéticos.

| Teste | Resultado |
|---|---|
| Abrir a tela | Topo "3 publicações hoje · 12 pendentes", mês "Outubro de 2026", 7 dias com contagem. Captura. |
| Tocar em DOM 4 | Sem esqueleto; título "Domingo, 4 de outubro" na hora; bloco com `pb-anim-prox`; faixa desliza 45px; número com `pulou`. |
| Busca por baixo terminando | O bloco do dia continua sendo o **mesmo elemento** (a animação não é cortada). |
| Escolher 20/10 em "Ir para" | Esqueleto (fora da semana buscada); faixa entra com deslize curto; depois o estado "nenhuma publicação". |
| Arrastar a lista para a direita | De 02/10 para 01/10. |
| Pendentes | 5 visíveis; "Ver todos os 12" → "Mostrar menos" e a gaveta abre; atrasos "ontem" e "há 2 dias". Captura. |
| Próximas | "Amanhã 4/10 · 2", "Segunda 5/10 · 3" (barra cheia), "Terça 6/10 · 1". |
| Cartões com 4 ações | Achado: "Deta…" e "Criat…" cortados. Corrigido com "Copiar legenda" na linha inteira. Captura depois. |
| 1280px | Rótulos curtos escondidos, setas da faixa e "Ir para" visíveis. |

**Não testado:**
- celular físico (gesto real, seletor de data do aparelho);
- dados reais (com logos);
- tema escuro no celular;
- animações rodando em tempo real.