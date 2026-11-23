/* 4.84.0: B7.WaNumeros (js/wa-numeros.js) — barra de números da Central e número de cada pessoa. Sem navegador. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const codigo = await readFile(fileURLToPath(new URL('../js/wa-numeros.js', import.meta.url)), 'utf8');
globalThis.window = globalThis;
const guardado = {};
globalThis.B7 = {
  UI: { esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
  pref: { ler: (k, d) => (k in guardado ? guardado[k] : d), gravar: (k, v) => { guardado[k] = v; } }
};
(0, eval)(codigo);
const W = B7.WaNumeros;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const vid = { id: 'v', nome: 'Videomakers', cor: '#E8452C', equipes: ['videomaker'], padrao: true, ativo: true };
const des = { id: 'd', nome: 'Designers', cor: '#5E47DE', equipes: ['designer'], padrao: false, ativo: true };
const coo = { id: 'c', nome: 'Coordenação', cor: '#1B8F6A', equipes: ['coordenador'], padrao: false, ativo: true };

ok(W.barraHtml([vid], 'todos', {}) === '', 'um número só: sem barra');
ok(W.barraHtml([], 'todos', {}) === '', 'nenhum número: sem barra');
const b = W.barraHtml([vid, des], 'd', { v: 3, d: 0 });
ok(b.includes('class="wz-nums"') && b.includes('data-num="todos"') && b.includes('data-num="v"') && b.includes('data-num="d"'), 'barra com Todos e os dois números');
ok(/data-num="d"[^>]*class="[^"]*\bon\b/.test(b) || /class="[^"]*\bon\b[^"]*"[^>]*data-num="d"/.test(b), 'o escolhido fica marcado');
ok(/data-num="todos"[\s\S]*?<b>3<\/b>/.test(b) && /data-num="v"[\s\S]*?<b>3<\/b>/.test(b) && !/data-num="d"[^]*?<b>0<\/b>/.test(b), 'contagens (zero não aparece)');
ok(W.barraHtml([{ ...des, nome: '<script>' }, vid], 'todos', {}).includes('&lt;script&gt;'), 'nome escapado');

ok(W.daPessoa({ papel: 'designer' }, [vid, des]) === des, 'designer → número dos designers');
ok(W.daPessoa({ papel: 'admin' }, [vid, des]) === vid, 'admin → padrão');
ok(W.daPessoa({ papel: 'coordenador', funcoes_extra: ['videomaker'] }, [vid, des, coo]) === coo, 'o papel vale antes da função extra');
ok(W.daPessoa({ papel: 'coordenador', funcoes_extra: ['designer'] }, [vid, des]) === des, 'sem número do papel, vale a função extra');
ok(W.daPessoa({ papel: 'videomaker' }, []) === null, 'sem números → null');

ok(W.ponto(des).includes('wz-num-pt') && W.ponto(des).includes('#5E47DE') && W.ponto(des).includes('Designers'), 'ponto com cor e nome');
ok(W.escolhido() === 'todos', 'escolha começa em Todos');
W.escolher('d'); ok(W.escolhido() === 'd' && guardado.wa_num === 'd', 'escolha guardada');

console.log('✓ wa-numeros (tela): ' + n + ' verificações');
