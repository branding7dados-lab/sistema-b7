# Relatório 2026-10-05-zzz47 — Datas que andam com o mês, e testes que pegam conta errada

Decisão do Kevin depois da revisão geral: fazer os itens 1 e 2 da lista de pendências.

## 1. Testes das contas de data (testes/datas.test.mjs)

O teste de fumaça abre todas as telas e falha se alguma quebrar — mas não olha
para o RESULTADO das contas. O bug de duplicar semana (zzz45) passava por ele
sem levantar a mão, porque a tela abria normalmente.

O arquivo novo roda sem navegador e cobre 28 casos: leitura de data sem
escorregar no fuso, somar dias na virada de mês/ano/bissexto, a semana de
segunda a domingo (inclusive cruzando mês e ano), o deslocamento ao duplicar
uma semana, o passo de mês ao duplicar uma linha editorial, e a regra de
"publicado só depois que o dia passa".

**Os testes chamam as funções reais, não uma cópia da fórmula.** Conferi
reintroduzindo cinco bugs, um a um, e confirmando que cada um é pego:

| Bug reintroduzido | Pego |
|---|---|
| deslocamento fixo de 7 dias (o bug de duplicar semana) | sim |
| "publicado" incluindo o dia de hoje (`<=` em vez de `<`) | sim |
| domingo tratado como início de semana | sim |
| mover meses sem encostar no último dia (31/10 + 1 → 01/12) | sim |
| somar dias ignorando a virada de mês | sim |

Entrou no `npm test`, então roda a cada envio.

## 2. "Copiar datas de postagem" leva as datas junto (js/linha.js)

Duplicar a linha de outubro para novembro com a opção marcada criava a linha de
novembro com TODOS os conteúdos datados em outubro. Agora as datas andam o
mesmo número de meses que a linha andou. Dia que não existe no mês de destino
(31 de outubro → novembro) encosta no último dia dele, em vez de escorregar
para o mês seguinte como faria `setMonth`.

A opção no modal passou a dizer "Datas de postagem (andam para o mês novo)".

## Arrumação que veio junto

As contas de data estavam espalhadas em cópias por tela — e foi numa dessas
cópias que nasceu o bug de duplicar semana. Agora moram todas em
`js/doc-semana.js` (`somarDias`, `segundaDe`, `moverMeses`, `difMeses`,
`difDias`, `jaPassou`, `ultimoDiaDoMes`), que é o módulo que os testes
alcançam. `js/semana.js` e `js/linha.js` passaram a chamar essas funções em
vez de manter as suas.

VERSAO zzz47 · cache v252.
