/* zzz302: Gestão → Equipe — a situação de cada pessoa (atrasado, pede
   atenção, em dia, sem fila) e a soma de vídeo + design. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.error('✗ ' + m); } };

const ctx = { window: {}, console };
ctx.window.B7 = { UI: { esc: s => String(s) } };
ctx.B7 = ctx.window.B7;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/colaboradores.js', import.meta.url), 'utf8'), ctx);
const resumo = ctx.B7.Colaboradores._resumo;

const V = (o) => Object.assign({ entregues: 0, no_prazo: 0, na_mao: 0, atrasados: 0, com_cliente: 0, ajustes: 0 }, o);
const pend = (motivo) => ({ motivo, tipo: 'video' });

let r = resumo({ video: V({ entregues: 10, no_prazo: 7, na_mao: 3, atrasados: 1 }), design: V({ entregues: 4 }), gravacoes: {}, pendencias: [pend('atrasado'), pend('ok')] });
ok(r.situacao === 'atrasado', 'com item atrasado a situação é "atrasado"');
ok(r.entregues === 14, 'entregas somam vídeo e design');
ok(r.pontual === 70, 'pontualidade só dos vídeos (7 de 10)');

r = resumo({ video: V({ na_mao: 2 }), design: V({}), gravacoes: {}, pendencias: [pend('parado'), pend('ok')] });
ok(r.situacao === 'atencao', 'parado sem atraso pede atenção');

r = resumo({ video: V({ na_mao: 2 }), design: V({}), gravacoes: {}, pendencias: [pend('ok'), pend('sem_prazo')] });
ok(r.situacao === 'emdia', 'sem prazo não conta como atenção');

r = resumo({ video: V({}), design: V({}), gravacoes: { feitas: 0, itens: 0, proximas: [] }, pendencias: [] });
ok(r.situacao === 'livre' && !r.movimento, 'sem nada: sem fila e sem movimento');
ok(r.pontual === null, 'sem vídeo entregue não inventa pontualidade');

r = resumo({ video: V({}), design: V({}), gravacoes: { feitas: 0, itens: 10, proximas: [] }, pendencias: [] });
ok(!!r.movimento, 'itens gravados contam como movimento');

console.log((falhas ? '✗ ' : '✓ ') + 'colaboradores: ' + (total - falhas) + '/' + total);
if (falhas) process.exit(1);
