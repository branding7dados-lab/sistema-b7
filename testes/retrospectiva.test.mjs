/* zzz280: a retrospectiva monta as histórias certas a partir dos números
   (e pula as que não têm o que contar). Confere js/retrospectiva.js. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ctx = { window: {}, B7: { UI: { esc } }, console };
ctx.window.B7 = ctx.B7;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/retrospectiva.js', import.meta.url), 'utf8'), ctx);
const H = ctx.B7.Retro._historias;

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.error('✗ ' + m); } };

const cheio = { ano: 2026, mes: 10, parcial: false, entregas: 185, entregas_mes_anterior: 150,
  totais: { videos: 73, artes: 112, posts: 123, clientes: 15, gravacoes: 14, roteiros: 38, legendas: 22, aprovadas: 81, resposta_horas: 5.4 },
  pico: { dia: '2026-10-14', entregas: 89 }, semana: [24, 26, 90, 6, 39, 0, 0],
  voce: { nome: 'Kevin', artes: 1, videos: 27, no_prazo: 12, com_prazo: 24, gravacoes: 5, legendas: 0 },
  cliente_do_mes: { nome: 'Ensino <Plus>', logo: null, videos: 8, artes: 1, posts: 33, total: 42 },
  podio: [{ nome: 'Allissan Brand', entregas: 108 }, { nome: 'Kaique Viana', entregas: 44 }, { nome: 'Kevin França', entregas: 28 }] };
const L = H(cheio), temas = L.map(h => h.tema);
ok(temas.join() === 'capa,roxo,rosa,azul,laranja,verde,ouro,noite,voce,fim', 'mês cheio: as 10 histórias, na ordem');
ok(L[0].html.includes('Outubro') && L[0].html.includes('2026'), 'capa com o mês e o ano');
ok(L[1].html.includes('data-conta="185"') && L[1].html.includes('↑ 23% a mais que setembro'), 'entregas e comparação com o mês anterior');
ok(L[4].html.includes('14 de outubro') && L[4].html.includes('uma quarta-feira') && L[4].html.includes('Quarta é o dia da B7'), 'dia mais corrido');
ok(L[5].html.includes('5 horas'), 'tempo de resposta dos clientes');
ok(L[6].html.includes('Ensino &lt;Plus&gt;') && !L[6].html.includes('<Plus>'), 'nome do cliente escapado');
ok(L[7].html.indexOf('Kaique') < L[7].html.indexOf('Allissan') && L[7].html.indexOf('Allissan') < L[7].html.indexOf('Kevin'), 'pódio: 2º, 1º, 3º');
ok(L[8].html.includes('E você, Kevin?') && L[8].html.includes('--p:50'), 'o mês de quem vê, com % no prazo');
ok(L[9].html.includes('Obrigado por outubro') && L[9].html.includes('Ver setembro'), 'final do mês fechado');

const pouco = { ano: 2026, mes: 1, parcial: true, entregas: 3, entregas_mes_anterior: 10,
  totais: { videos: 3, artes: 0, posts: 0, clientes: 0, gravacoes: 0, roteiros: 0, legendas: 0, aprovadas: 0, resposta_horas: null },
  pico: { dia: '2026-01-03', entregas: 3 }, semana: [0, 0, 0, 0, 0, 3, 0], voce: { nome: 'Ana' }, cliente_do_mes: null, podio: null };
const P = H(pouco), tp = P.map(h => h.tema);
ok(tp.join() === 'capa,roxo,laranja,fim', 'mês fraco: só o que tem número (sem posts, bastidores, aprovações, cliente, pódio, você)');
ok(!P[1].html.includes('a mais que'), 'não mostra comparação quando caiu');
ok(P[2].html.includes('um sábado'), 'sábado sem "-feira"');
ok(P[3].html.includes('E ainda tem mais janeiro') && P[3].html.includes('Ver dezembro'), 'mês em andamento e o mês anterior de janeiro é dezembro');

console.log((falhas ? '✗ ' : '✓ ') + 'retrospectiva: ' + (total - falhas) + '/' + total);
process.exit(falhas ? 1 : 0);
