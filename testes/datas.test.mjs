/* =====================================================================
   CONTAS DE DATA, SEMANA E DUPLICAÇÃO — sem navegador.

   Por que este arquivo existe: o teste de fumaça abre todas as telas e
   falha se alguma quebrar, mas ele não olha para o RESULTADO das contas.
   O bug de "duplicar semana" (04/10) — que deslocava as demandas sempre
   sete dias, jogando-as para fora da semana escolhida — passava por ele
   sem levantar a mão, porque a tela abria normalmente.

   Aqui é o contrário: nenhuma tela, só número. Cada caso abaixo é um
   erro que já aconteceu ou que aconteceria em silêncio.

   Rodar:  cd testes && npm test
   ===================================================================== */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------
   js/doc-semana.js é um módulo de navegador (IIFE pendurado em B7).
   Carregamos o arquivo e avaliamos só até onde interessa: as funções
   puras de data não tocam em DOM nenhum. Os poucos globais que o
   arquivo encosta no caminho ficam aqui como casca vazia.
   ------------------------------------------------------------------ */
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {} }),
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  querySelector: () => null, body: { appendChild() {}, removeChild() {} }
};
/* doc-semana.js guarda B7.UI.esc na carga; aqui ele nunca é usado pelas
   contas de data, mas precisa existir para o arquivo terminar de carregar */
globalThis.B7 = { UI: { esc: t => String(t == null ? '' : t) } };
const codigo = await readFile(fileURLToPath(new URL('../js/doc-semana.js', import.meta.url)), 'utf8');
(0, eval)(codigo);

const D = B7.DocSemana;
assert.ok(D && D.somarDias, 'js/doc-semana.js precisa expor as contas de data');

let casos = 0;
const caso = (nome, fn) => { fn(); casos++; };

/* ==================================================================
   1. LER UMA DATA — o erro de fuso que some com o dia
   ================================================================== */

caso('a data não escorrega um dia para trás no fuso do Brasil', () => {
  /* new Date('2026-10-05') é meia-noite UTC = 21h do dia 4 em Brasília.
     Quem fizesse .getDate() nisso leria 4. partes() não passa por lá. */
  const p = D.partes('2026-10-05');
  assert.deepEqual(p, { ano: 2026, mes: 10, dia: 5 });
});

caso('o dia da semana bate com o calendário', () => {
  assert.equal(D.diaDaSemana('2026-10-05'), 1, '05/10/2026 é segunda');
  assert.equal(D.diaDaSemana('2026-10-11'), 0, '11/10/2026 é domingo');
});

/* ==================================================================
   2. SOMAR DIAS — viradas de mês, de ano e ano bissexto
   ================================================================== */

caso('somar dias atravessa a virada do mês', () => {
  assert.equal(D.somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(D.somarDias('2026-11-01', -1), '2026-10-31');
});

caso('somar dias atravessa a virada do ano', () => {
  assert.equal(D.somarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(D.somarDias('2027-01-01', -1), '2026-12-31');
});

caso('fevereiro de ano bissexto tem 29 dias', () => {
  assert.equal(D.somarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(D.somarDias('2028-02-29', 1), '2028-03-01');
  assert.equal(D.somarDias('2026-02-28', 1), '2026-03-01', '2026 não é bissexto');
});

caso('somar zero dias devolve o mesmo dia', () => {
  assert.equal(D.somarDias('2026-10-05', 0), '2026-10-05');
});

/* ==================================================================
   3. A SEMANA — segunda a domingo, inclusive virando o mês
   ================================================================== */

caso('a semana começa na segunda', () => {
  assert.equal(D.segundaDe('2026-10-07'), '2026-10-05', 'quarta recua para segunda');
  assert.equal(D.segundaDe('2026-10-05'), '2026-10-05', 'segunda fica onde está');
});

caso('domingo pertence à semana que começou na segunda anterior', () => {
  /* este é o clássico: tratar domingo como início de semana joga o
     status do domingo para a semana seguinte, e o relatório do cliente
     sai com um dia a menos. */
  assert.equal(D.segundaDe('2026-10-11'), '2026-10-05');
});

caso('a semana que cruza o mês não se parte', () => {
  assert.equal(D.segundaDe('2026-09-02'), '2026-08-31');
  assert.equal(D.somarDias('2026-08-31', 6), '2026-09-06');
});

caso('a semana que cruza o ano não se parte', () => {
  assert.equal(D.segundaDe('2027-01-01'), '2026-12-28');
  assert.equal(D.somarDias('2026-12-28', 6), '2027-01-03');
});

caso('o período tem sempre sete dias, em ordem', () => {
  const dias = D.diasDoPeriodo('2026-08-31', '2026-09-06');
  assert.equal(dias.length, 7);
  assert.equal(dias[0], '2026-08-31');
  assert.equal(dias[6], '2026-09-06');
  assert.deepEqual(dias, [...dias].sort(), 'em ordem crescente');
});

caso('o texto do período diz o mês dos dois lados quando a semana cruza', () => {
  assert.equal(D.periodoTexto('2026-10-05', '2026-10-11'), '05 a 11 de outubro · 2026');
  assert.equal(D.periodoTexto('2026-08-31', '2026-09-06'), '31 de agosto a 06 de setembro · 2026');
  assert.match(D.periodoTexto('2026-12-28', '2027-01-03'), /2026.*2027/, 'virada de ano mostra os dois anos');
});

/* ==================================================================
   4. DUPLICAR UMA SEMANA — o bug de 04/10
   ================================================================== */

/* A regra: o deslocamento é a distância real entre a semana de origem e
   a escolhida, não um número fixo. Era isso que estava errado em
   js/semana.js (modalDuplicar usava `const desloca = 7`).
   O teste chama a MESMA função que a tela chama — uma cópia da fórmula
   aqui dentro continuaria passando se alguém voltasse o 7 fixo. */
const deslocamento = D.difDias;

caso('duplicar para a semana seguinte anda sete dias', () => {
  assert.equal(deslocamento('2026-10-05', '2026-10-12'), 7);
});

caso('duplicar para três semanas à frente anda vinte e um dias', () => {
  /* o bug: andava 7, e as demandas caíam em 12/10 — fora da semana
     nova (26/10 a 01/11), indo parar no balde "sem data" do editor. */
  const passo = deslocamento('2026-10-05', '2026-10-26');
  assert.equal(passo, 21);
  assert.equal(D.somarDias('2026-10-07', passo), '2026-10-28', 'a demanda de quarta cai na quarta da semana nova');
});

caso('duplicar para trás anda para trás', () => {
  assert.equal(deslocamento('2026-10-26', '2026-10-05'), -21);
});

caso('toda demanda duplicada cai dentro da semana nova', () => {
  const origem = '2026-10-05', destino = '2026-11-16';
  const passo = deslocamento(origem, destino);
  const fim = D.somarDias(destino, 6);
  for (const d of D.diasDoPeriodo(origem, D.somarDias(origem, 6))) {
    const nova = D.somarDias(d, passo);
    assert.ok(nova >= destino && nova <= fim,
      'demanda de ' + d + ' virou ' + nova + ', fora de ' + destino + '–' + fim);
  }
});

/* ==================================================================
   5. DUPLICAR UMA LINHA EDITORIAL — as datas andam com o mês
   ================================================================== */

caso('andar um mês mantém o dia', () => {
  assert.equal(D.moverMeses('2026-10-07', 1), '2026-11-07');
  assert.equal(D.moverMeses('2026-10-07', -1), '2026-09-07');
});

caso('andar meses atravessa a virada do ano', () => {
  assert.equal(D.moverMeses('2026-12-15', 1), '2027-01-15');
  assert.equal(D.moverMeses('2027-01-15', -1), '2026-12-15');
  assert.equal(D.moverMeses('2026-10-07', 14), '2027-12-07');
});

caso('dia que não existe no mês de destino encosta no último dia dele', () => {
  /* 31 de outubro + 1 mês: novembro tem 30. Com setMonth isso viraria
     01/12 — a data escorregaria para o mês seguinte, fora da linha. */
  assert.equal(D.moverMeses('2026-10-31', 1), '2026-11-30');
  assert.equal(D.moverMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(D.moverMeses('2028-01-31', 1), '2028-02-29', 'bissexto tem o 29');
});

caso('a distância em meses ignora o dia', () => {
  assert.equal(D.difMeses('2026-10-01', '2026-11-30'), 1);
  assert.equal(D.difMeses('2026-10-31', '2026-11-01'), 1);
  assert.equal(D.difMeses('2026-12-01', '2027-01-01'), 1, 'virada de ano');
  assert.equal(D.difMeses('2026-10-05', '2026-10-28'), 0, 'mesmo mês, distância zero');
});

caso('duplicar a linha de outubro para novembro leva as datas junto', () => {
  /* o bug: as datas eram copiadas literais, e a linha de novembro
     nascia com todos os conteúdos datados em outubro. */
  const passo = (2026 * 12 + 11) - (2026 * 12 + 10);
  const outubro = ['2026-10-02', '2026-10-15', '2026-10-31'];
  const novembro = outubro.map(d => D.moverMeses(d, passo));
  assert.deepEqual(novembro, ['2026-11-02', '2026-11-15', '2026-11-30']);
  for (const d of novembro) assert.equal(D.partes(d).mes, 11, d + ' deveria estar em novembro');
});

caso('duplicar a linha de dezembro para janeiro vira o ano', () => {
  /* o bug irmão: o modal sugeria janeiro, mas mantinha o ano de origem,
     criando "janeiro 2026" — onze meses no passado. */
  const passo = (2027 * 12 + 1) - (2026 * 12 + 12);
  assert.equal(passo, 1);
  assert.equal(D.moverMeses('2026-12-20', passo), '2027-01-20');
});

caso('o último dia de cada mês está certo', () => {
  assert.equal(D.ultimoDiaDoMes(2026, 1), 31);
  assert.equal(D.ultimoDiaDoMes(2026, 2), 28);
  assert.equal(D.ultimoDiaDoMes(2028, 2), 29);
  assert.equal(D.ultimoDiaDoMes(2026, 4), 30);
  assert.equal(D.ultimoDiaDoMes(2026, 12), 31);
  assert.equal(D.ultimoDiaDoMes(2100, 2), 28, '2100 não é bissexto');
  assert.equal(D.ultimoDiaDoMes(2000, 2), 29, '2000 é bissexto');
});

/* ==================================================================
   6. PUBLICAR SÓ DEPOIS QUE O DIA PASSA
   ================================================================== */

/* A regra de js/linha.js (verificarPostagensAutomaticas) e de
   js/semana.js: "Programado" com data ANTES de hoje vira "Publicado".
   Com "<=", abrir a linha às 8h já publicava o conteúdo das 18h.
   De novo: a função real, não uma cópia. */
const jaPublicou = D.jaPassou;

caso('o conteúdo de hoje ainda não está publicado', () => {
  assert.equal(jaPublicou('2026-10-05', '2026-10-05'), false);
});

caso('o conteúdo de ontem está publicado', () => {
  assert.equal(jaPublicou('2026-10-04', '2026-10-05'), true);
});

caso('o conteúdo de amanhã não está publicado', () => {
  assert.equal(jaPublicou('2026-10-06', '2026-10-05'), false);
});

caso('sem data, nada é dado como publicado', () => {
  assert.equal(jaPublicou(null, '2026-10-05'), false);
  assert.equal(jaPublicou('', '2026-10-05'), false);
});

caso('a comparação de texto funciona na virada do mês e do ano', () => {
  /* datas ISO comparam certo como texto — é disso que o sistema depende */
  assert.equal(jaPublicou('2026-09-30', '2026-10-01'), true);
  assert.equal(jaPublicou('2026-12-31', '2027-01-01'), true);
  assert.equal(jaPublicou('2027-01-01', '2026-12-31'), false);
});

/* ================================================================== */
console.log('✓ ' + casos + ' contas de data conferidas (sem navegador).');
