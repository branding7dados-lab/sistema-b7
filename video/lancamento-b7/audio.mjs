/* Trilha e efeitos sintetizados, sincronizados com os eventos do vídeo.
   node audio.mjs → saida/trilha-sfx.wav (48 kHz, estéreo, 62 s) */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SR = 48000, DUR = 62, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const add = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); };

/* graves de impacto: seno com queda de afinação */
function hit(t, { f0 = 140, f1 = 42, dur = 1.6, vol = .9 } = {}) {
  const s = Math.round(t * SR); let ph = 0;
  for (let i = 0; i < dur * SR; i++) {
    const x = i / SR, f = f1 + (f0 - f1) * Math.exp(-x * 9);
    ph += 2 * Math.PI * f / SR;
    const env = Math.min(1, x * 400) * Math.exp(-x * (3 / dur) * 1.6);
    add(s + i, Math.sin(ph) * env * vol);
  }
}
/* sopro: ruído com passa-baixa variável (sobe e desce) */
function whoosh(t, { dur = .6, vol = .35, up = true, pan = 0 } = {}) {
  const s = Math.round((t - dur * .6) * SR); let lp = 0, lp2 = 0;
  for (let i = 0; i < dur * SR; i++) {
    const p = i / (dur * SR), env = Math.sin(Math.PI * Math.pow(p, up ? .8 : 1.2)) ** 2;
    const cut = 300 + 5000 * env;
    const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
    lp += a * ((rnd() * 2 - 1) - lp); lp2 += a * (lp - lp2);
    add(s + i, lp2 * env * vol * 2.2, pan * (p * 2 - 1));
  }
}
/* sino/ping curto */
function ping(t, { f = 1400, dur = .35, vol = .12, pan = 0 } = {}) {
  const s = Math.round(t * SR);
  for (let i = 0; i < dur * SR; i++) {
    const x = i / SR, env = Math.min(1, x * 800) * Math.exp(-x * 14 / dur * .5);
    add(s + i, (Math.sin(2 * Math.PI * f * x) + .35 * Math.sin(2 * Math.PI * f * 2.01 * x)) * env * vol, pan);
  }
}
/* clique de interface */
function click(t, { vol = .22, f = 2400 } = {}) {
  const s = Math.round(t * SR);
  for (let i = 0; i < .05 * SR; i++) { const x = i / SR; add(s + i, (Math.sin(2 * Math.PI * f * x) * .6 + (rnd() * 2 - 1) * .4) * Math.exp(-x * 140) * vol); }
}
/* bumbo e chimbal da base rítmica */
function kick(t, vol = .55) { hit(t, { f0: 150, f1: 48, dur: .38, vol }); }
function hat(t, vol = .05) {
  const s = Math.round(t * SR); let hp = 0, prev = 0;
  for (let i = 0; i < .06 * SR; i++) { const n = rnd() * 2 - 1; hp = .9 * (hp + n - prev); prev = n; add(s + i, hp * Math.exp(-i / SR * 70) * vol, .3); }
}
/* camada de acordes suaves (pad) */
function pad(t0, t1, freqs, vol = .05) {
  const s0 = Math.round(t0 * SR), s1 = Math.round(t1 * SR);
  for (let i = s0; i < s1 && i < N; i++) {
    const x = (i - s0) / SR, len = (s1 - s0) / SR;
    const env = Math.min(1, x / .8) * Math.min(1, (len - x) / .8);
    let v = 0;
    freqs.forEach((f, k) => { for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * f * h * x * (1 + k * .0007) + k) / (h * h); });
    add(i, v * env * vol * (1 + .15 * Math.sin(x * 2.1)), Math.sin(x * .7) * .3);
  }
}
/* subida de tensão (riser) */
function riser(t0, t1, vol = .2) {
  const s0 = Math.round(t0 * SR), s1 = Math.round(t1 * SR); let lp = 0, ph = 0;
  for (let i = s0; i < s1; i++) {
    const p = (i - s0) / (s1 - s0), cut = 200 + 6000 * p * p, a = 1 - Math.exp(-2 * Math.PI * cut / SR);
    lp += a * ((rnd() * 2 - 1) - lp); ph += 2 * Math.PI * (80 + 500 * p * p) / SR;
    add(i, (lp * 1.6 + Math.sin(ph) * .4) * p * p * vol);
  }
}
/* brilho de partículas */
function shimmer(t0, t1, vol = .04) {
  for (let t = t0; t < t1; t += .018) ping(t + rnd() * .02, { f: 2200 + rnd() * 3200, dur: .25, vol: vol * (.4 + rnd()), pan: rnd() * 1.6 - .8 });
}
const nota = m => 440 * Math.pow(2, (m - 69) / 12);

/* ------------------------------------------------ 01–02 caos e problema */
riser(0, 4.0, .22);
pad(0, 4.1, [nota(38), nota(45), nota(46)], .03);               // cluster tenso
[.73, .95, 1.2, 1.4, 1.6, 1.8, 1.95, 2.1, 2.25, 2.4, 2.52, 2.64, 2.76, 2.86, 2.96, 3.06, 3.15, 3.24, 3.33, 3.42, 3.5, 3.58, 3.66, 3.74, 3.82]
  .forEach((t, i) => ping(t, { f: [1320, 1760, 1480, 1980, 1175][i % 5], vol: .07 + i * .003, pan: (i % 3 - 1) * .6 }));
whoosh(4.15, { dur: .8, vol: .45 }); hit(4.15, { vol: .5, dur: 1 });
[4.3, 4.47, 4.64, 4.81].forEach(t => click(t, { vol: .18, f: 1600 }));
ping(5.95, { f: 880, vol: .1 }); ping(6.05, { f: 830, vol: .08 });
whoosh(6.5, { dur: .7, vol: .2 });
pad(4.1, 7.0, [nota(40), nota(47), nota(51)], .025);
// 7.0–8.2: silêncio (o quadro congela)

/* ------------------------------------------------ 03 revelação */
ping(8.3, { f: 2637, dur: .9, vol: .07 }); ping(8.6, { f: 3136, dur: .9, vol: .05 });
riser(8.3, 8.92, .18);
hit(8.92, { f0: 90, f1: 38, dur: 1.2, vol: .5 }); whoosh(9.0, { dur: .9, vol: .3 });
shimmer(8.95, 10.2, .035);
riser(9.4, 10.22, .2);
hit(10.22, { f0: 160, f1: 36, dur: 2.6, vol: 1 });                // logo
pad(10.2, 12.3, [nota(45), nota(52), nota(57), nota(61), nota(64)], .045);
whoosh(11.0, { dur: .6, vol: .15 }); whoosh(11.75, { dur: 1, vol: .15, pan: .7 });
riser(11.6, 12.2, .2); whoosh(12.3, { dur: .7, vol: .45 });

/* ------------------------------------------------ 04–12 base rítmica (100 bpm) */
const BEAT = .6;
const prog = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [36, 48, 55, 60, 64], [43, 50, 55, 59, 62]];
for (let k = 0, t = 12.3; t < 56.7; k++, t += BEAT * 8) pad(t, Math.min(t + BEAT * 8 + .3, 56.9), prog[k % 4].map(nota), .035);
for (let t = 12.3; t < 56.6; t += BEAT) { kick(t, t < 16 ? .35 : .5); if (t > 16) hat(t + BEAT / 2, t > 26 ? .06 : .035); }
// eventos de interface
[12.7, 12.8, 12.9, 13.0].forEach(t => click(t, { vol: .12 }));
ping(15.3, { f: 1568, vol: .08 });
whoosh(16.1, { dur: .6, vol: .35 });
for (let i = 0; i < 7; i++) { whoosh(17.05 + i * .24 + .45, { dur: .3, vol: .1, pan: .5 }); click(17.6 + i * .24, { vol: .2, f: 1900 }); }
whoosh(20.3, { dur: .7, vol: .3 });
for (let i = 0; i < 4; i++) { ping(21.45 + i * .5, { f: nota(76 + [0, 4, 7, 12][i]), vol: .07 }); }
whoosh(23.3, { dur: .7, vol: .3 }); click(24.2, { vol: .35, f: 1200 }); ping(24.25, { f: 988, vol: .07 });
ping(25.5, { f: 1319, vol: .08 }); ping(25.6, { f: 1760, vol: .07 });
whoosh(26.2, { dur: .6, vol: .35 });
[27.3, 28.35, 29.4, 30.45].forEach((m, i) => { whoosh(m + .35, { dur: .5, vol: .16 }); click(m + .55, { vol: .28, f: 1500 + i * 200 }); });
ping(31.05, { f: nota(81), vol: .08 }); ping(31.15, { f: nota(85), vol: .07 }); ping(31.25, { f: nota(88), vol: .07 }); shimmer(31.0, 31.6, .03);
whoosh(32.2, { dur: .8, vol: .35 });
click(33.5, { vol: .2 }); ping(34.1, { f: 1760, vol: .06 }); whoosh(35.6, { dur: .4, vol: .12, pan: -.8 }); whoosh(36.3, { dur: .4, vol: .12, pan: -.8 });
whoosh(38.0, { dur: .7, vol: .3 });
click(39.0, { vol: .18 }); click(39.6, { vol: .18 });
ping(40.55, { f: 1047, vol: .09 }); ping(41.45, { f: 1319, vol: .09 });
click(42.35, { vol: .4, f: 1300 });
[72, 76, 79, 84].forEach((m, i) => ping(42.55 + i * .07, { f: nota(m), dur: .7, vol: .09 }));   // aprovado
whoosh(44.1, { dur: .8, vol: .35 }); riser(44.4, 45.6, .08);
for (let i = 0; i < 26; i++) click(44.85 + i * .027, { vol: .05, f: 3000 });
click(45.6, { vol: .25 });
for (let k = 0; k < 5; k++) { shimmer(45.85 + k * .62, 46.2 + k * .62, .02); ping(46.2 + k * .62, { f: nota(79 + [0, 2, 4, 7, 9][k]), vol: .06 }); }
whoosh(50.1, { dur: .8, vol: .35 });
ping(52.8, { f: nota(84), vol: .08 }); ping(52.88, { f: nota(88), vol: .07 });
whoosh(54.0, { dur: .9, vol: .35 });
for (let i = 0; i < 6; i++) whoosh(54.4 + i * .1, { dur: .4, vol: .07, pan: i % 2 ? .8 : -.8 });
riser(54.6, 55.55, .2);
hit(55.55, { f0: 150, f1: 38, dur: 2, vol: .9 }); shimmer(55.5, 56.4, .03);

/* ------------------------------------------------ 13–14 transformação e final */
whoosh(56.9, { dur: .6, vol: .4 });
for (let i = 0; i < 12; i++) ping(56.9 + i * .07, { f: [1320, 1760, 1480][i % 3], vol: .04, pan: (i % 2) - .5 });
hit(57.15, { f0: 120, f1: 50, dur: .5, vol: .45 }); hit(57.7, { f0: 130, f1: 48, dur: .5, vol: .55 }); hit(58.25, { f0: 140, f1: 44, dur: .9, vol: .7 });
whoosh(58.1, { dur: .9, vol: .3 });
pad(57.1, 59.3, [nota(45), nota(52), nota(57), nota(60)], .04);
riser(58.6, 59.1, .15); whoosh(59.15, { dur: .8, vol: .3 });
shimmer(59.15, 60.1, .035); riser(59.3, 60.1, .18);
hit(60.1, { f0: 170, f1: 34, dur: 3, vol: 1 });
pad(60.1, 62, [nota(45), nota(52), nota(57), nota(61), nota(64), nota(69)], .05);
whoosh(61.35, { dur: 1, vol: .14, pan: .8 });

/* ------------------------------------------------ mix: normaliza, satura de leve, fade final */
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = .9 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * .6));
  const sl = Math.tanh(L[i] * g * 1.2) * fade, sr = Math.tanh(R[i] * g * 1.2) * fade;
  buf.writeInt16LE(Math.round(sl * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(sr * 32000), 46 + i * 4);
}
const SAIDA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'saida');
await mkdir(SAIDA, { recursive: true });
await writeFile(path.join(SAIDA, 'trilha-sfx.wav'), buf);
console.log('ok saida/trilha-sfx.wav');
