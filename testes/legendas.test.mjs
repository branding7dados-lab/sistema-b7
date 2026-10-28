/* zzz278: a legenda corrigida tem que voltar com os MESMOS números e tempos.
   Confere o leitor/montador de .srt de js/legendas.js e a trava anti-reescrita. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ctx = { window: {}, B7: { UI: { esc } }, console };
ctx.window.B7 = ctx.B7;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/legendas.js', import.meta.url), 'utf8'), ctx);
const L = ctx.B7.Legendas;

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.error('✗ ' + m); } };

const srt = '﻿1\r\n00:00:01,000 --> 00:00:02,500\r\neu quero falar\r\n\r\n2\r\n00:00:02,500 --> 00:00:04,000\r\ncom você hoje\r\nsegunda linha\r\n\r\n\r\n3\r\n00:00:04,000 --> 00:00:05,000\r\n\r\n';
const cues = L._ler(srt);
ok(cues && cues.length === 3, 'lê 3 legendas (com BOM, \\r\\n e linhas em branco extras)');
ok(cues[0].num === '1' && cues[0].tempo === '00:00:01,000 --> 00:00:02,500', 'guarda número e tempo exatos');
ok(cues[1].texto === 'com você hoje\nsegunda linha', 'legenda com duas linhas fica inteira');
ok(cues[2].texto === '', 'legenda vazia é mantida');
const corr = cues.map(c => Object.assign({}, c, { saida: c.texto ? c.texto[0].toUpperCase() + c.texto.slice(1) : '' }));
const out = L._montar(corr, 'saida');
const de = L._ler(out);
ok(de.length === 3 && de.every((c, i) => c.num === cues[i].num && c.tempo === cues[i].tempo), 'montar e ler de novo: mesmos números e tempos');
ok(out.startsWith('1\n00:00:01,000 --> 00:00:02,500\nEu quero falar\n\n2\n'), 'formato .srt certo');
ok(L._ler('isso não é legenda') === null, 'texto sem "-->" é recusado');

ok(L._parecido('as entradas elas continuam avançando', 'As entradas, elas continuam avançando.'), 'pontuação e maiúscula não contam como reescrita');
ok(L._parecido('calvice é um problema de muita gente', 'Calvície é um problema de muita gente.'), 'acento não conta como reescrita');
ok(L._parecido('cem por cento natural tá e custa quarenta e nove e noventa', '100% natural, tá? E custa R$ 49,90.'), 'número falado → 100% e R$ não conta como reescrita');
ok(!L._parecido('você sabia que isso acontece com muita gente', 'Descubra agora o segredo que ninguém te contou.'), 'reescrita é barrada');
const d = L._diff('calvice e queda', 'Calvície e queda.');
ok(/<mark>Calvície<\/mark>/.test(d.depois) && /<del>calvice<\/del>/.test(d.antes), 'diferença marca a palavra trocada');

console.log((falhas ? '✗ ' : '✓ ') + (total - falhas) + ' de ' + total + ' conferências de legenda');
if (falhas) process.exit(1);
