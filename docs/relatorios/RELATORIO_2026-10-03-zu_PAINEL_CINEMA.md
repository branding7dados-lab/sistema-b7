# Relatório — pacote zu · Painel cinematográfico

Data: 03/10/2026 · Versão `zu`

## O que mudou (Painel de todos os papéis que usam o mesmo desenho `.pn`)

**Cabeçalho**
- **luz ambiente**: duas manchas de luz magenta/violeta derivam devagar atrás da saudação;
- a data entra subindo;
- **"Boa noite, Kevin" sai do desfoque** e um brilho rosa passa pelas letras;
- papel, resumo do dia e o botão "Minha fila" entram em sequência.

**Indicadores**
- os 4 cartões entram **em cascata**;
- **os números contam de 0 até o valor**, inclusive "1,4" com vírgula;
- o cartão de **atrasadas "respira"** com um brilho vermelho.

**Blocos abaixo**
- cada bloco se **revela ao entrar na tela** enquanto você rola;
- **Precisa da sua atenção**: as linhas deslizam e o ícone de alerta emite um anel;
- **Minha semana**: os dias surgem em sequência e o dia de hoje brilha;
- **Minha produção**: as **barras crescem de baixo** em cascata, os valores aparecem depois, a barra da semana atual tem uma luz que sobe por dentro e o selo "acima da média" ganha um brilho que passa de tempos em tempos;
- **Próximos compromissos**: entram um a um.

**Toque**: cartões, linhas, dias e compromissos afundam ao tocar.

## Como funciona
Cada parte do Painel carrega no seu tempo. Por isso, um observador em `js/painel.js` ("cinema") aplica as animações quando cada parte chega:
- contagem dos números;
- revelação ao rolar (IntersectionObserver);
- crescimento das barras.

O resto é CSS (`styles/painel.css`), só com transform e opacidade.

Sem IntersectionObserver ou com "reduzir movimento", nada fica escondido e nada anima.

## Regras
Nenhum dado, número, link ou regra mudou: a animação só apresenta o que já estava lá.

## Testes
Navegador do app em 390 px, tema escuro, papel videomaker com dados de exemplo:
- cabeçalho com luz;
- KPIs em cascata;
- contagem chegando nos valores certos (15, 8, 1,4);
- barras crescidas;
- blocos revelados ao rolar;
- sem rolagem lateral.

Não testado em aparelho.