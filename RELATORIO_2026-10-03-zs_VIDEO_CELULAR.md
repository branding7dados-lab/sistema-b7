# Relatório — pacote zs · Produção de Vídeo no celular

Data: 03/10/2026 · Versão `zs`

## O que mudou (só celular, até 700 px; no computador a tabela segue igual)

- **Lista:** cada demanda virou um **cartão compacto**, no lugar das 7 linhas de "rótulo: valor".
  - em cima: logo e nome do cliente, código e status;
  - no meio: título forte, em até 2 linhas;
  - embaixo:
    - prazo com contexto ("hoje", "amanhã", "em 3 dias", "2 dias em atraso");
    - prioridade (só se não for normal);
    - responsável.
  - Uma faixa de cor à esquerda indica o status, e as atrasadas ganham borda e fundo avermelhados.
- **Agrupada por prazo:** Atrasadas, Até hoje, Próximos 7 dias, Mais adiante e Sem prazo, com contagem. O cabeçalho de cada grupo é de vidro e gruda no topo ao rolar.
- **Filtros:** busca sempre à vista. Os 5 seletores ficam atrás de um botão **"Filtros"**, que mostra quantos estão ativos e abre com animação em 2 colunas. Lista/Kanban fica na mesma linha.
- **Cabeçalho:**
  - subtítulo escondido;
  - Gestão, Pacotes, Importar e Descartados viraram uma **faixa rolável de chips**;
  - "Nova demanda" maior;
  - aviso de meses anteriores mais compacto.
- **Resumo:** os chips rolam de lado e **os números contam de 0 até o valor**.

## Animação
- cartões entram em cascata (32 ms entre um e outro);
- chips e aviso entram com leve subida;
- toque afunda o cartão e a seta anda;
- o ícone do prazo atrasado pulsa;
- filtros abrem e fecham suavemente.

Com "reduzir movimento", tudo isso fica parado.

## Regras
Nada de status, prazo, permissão ou banco mudou. As mesmas regras de "atrasada" e "vence hoje" da tela, mesmos dados e mesmo clique: o cartão abre a demanda.

## Testes
Navegador do app com dados de exemplo:
- 390 px no tema escuro: 7 cartões em 5 grupos, filtros abrindo, sem rolagem lateral;
- 1280 px: a tabela original aparece e a lista nova some.

Não testado em aparelho nem em produção com dados reais (só leitura depois de publicar).