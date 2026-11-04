# Relatório 2026-10-02-k — Produção de Design: quadro mais enxuto, finalizadas fora do caminho

Só front-end (`js/design.js`, `styles/design.css`). Sem migration, sem mudança de regra: nenhum status, permissão, função do banco ou RLS foi tocado. É a visão da equipe (administrador e coordenação); a tela do designer não mudou.

## Resumo da atualização

- **Finalizadas não aparecem mais no quadro nem na lista.** Só na aba **Finalizadas** (ou escolhendo "Finalizado" no filtro de status). Ao lado do total fica um atalho: "107 peças · 26 finalizadas" — clicar leva à aba.
- **Abas com número:** Revisão interna, Ajustes, Aprovadas e Finalizadas mostram quantas peças têm.
- **Aguardando produção** virou uma lista de clientes recolhida: logo, nome inteiro (até duas linhas), quantas peças e o botão "Atribuir". Um clique abre as peças do cliente, em linhas enxutas.
- **Cartões mais baixos:** responsável, versão, "ajuste pendente" e prazo ficam numa linha só.
- **Colunas com a cor da etapa** no cabeçalho; coluna vazia fica estreita em vez de ocupar a largura de uma cheia.
- **Barra de filtros mais curta:** busca, Cliente, Designer e Prazo ficam à vista; Tipo, Status, Linha editorial e Prioridade ficam em "Mais filtros", com um contador quando algum está ligado.
- **Uma etapa só na tela** (aba "Revisão interna", aba "Finalizadas", atalhos do "Precisa de você") vira grade de cartões, em vez de uma coluna estreita com dezenas de peças.

## O que não mudou

- Os números do "Precisa de você", a aba Equipe e o Painel continuam contando como antes.
- A tela do designer (linhas editoriais e peças dele) continua mostrando as finalizadas, porque lá elas são o progresso da linha ("4 de 15 finalizadas").
- Busca e filtros valem igual; quando a busca encontra peças finalizadas, o atalho ao lado do total diz quantas.

## Arquivos

- `js/design.js`, `styles/design.css`.
- `js/auth.js` versão `2026-10-02-k`; `sw.js` cache `v138`.

## Testes realizados

Todos em página local com **dados simulados** (136 peças, 26 finalizadas, 7 clientes), apagada depois. Nenhum com a sua sessão ou com os dados reais.

- Quadro em 1700 px: sem coluna "Finalizado"; total "110 peças · 26 finalizadas"; abas com os números certos; coluna vazia estreita.
- Atalho "26 finalizadas" abre a aba Finalizadas (26 cartões em grade); a Lista, em "Todas", não traz finalizada; em "Finalizadas", traz as 26.
- Filtro de status "Finalizado" mostra as finalizadas; "Limpar filtros" volta ao normal.
- "Mais filtros" abre e fecha; contador aparece com filtro ligado.
- Grupo de cliente em "Aguardando produção" abre, lista as peças e não repete "Sem responsável" em cada uma.
- Busca, aba Revisão interna (grade com 39), aba Ajustes (duas colunas), aba Equipe, atalho "sem responsável".
- Celular (375 px): seletor de etapas sem "Finalizado", sem rolagem lateral da página.
- Visão do designer: barra e peças como antes.
- Sem erro no console em nenhum dos passos.

## O que NÃO foi testado

- Com dados reais e logado (logos dos clientes, miniaturas reais, tempo real).
- Atribuir em massa pelo botão do grupo (o código do botão não mudou, mas não cliquei até o fim).
- Abrir a peça a partir da grade nova (usa o mesmo clique do cartão).
- Modo escuro; celular de verdade.

## Observação

- Os grupos de "Aguardando produção" agora começam **fechados**. Se preferir abertos, é uma linha.
