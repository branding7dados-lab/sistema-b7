/* zzz308: o Gemini aceita o pedido e não manda nada → larga em
   GEMINI_PRIMEIRO_MS e pede de novo, uma vez. Roda com:
   node --experimental-strip-types testes/gemini-fluxo.test.mjs */
import { criarGemini } from '../supabase/functions/_shared/ia/gemini.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const sse = txt => new Response(new ReadableStream({ start(c) {
  c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] }, finishReason: 'STOP' }] }) + '\n\n'));
  c.close();
} }), { status: 200 });
/* fica pendurado até o sinal de abortar */
const pendura = sig => new Promise((_, rej) => sig.addEventListener('abort', () => { const e = new Error('abort'); e.name = 'AbortError'; rej(e); }));
const env = n => ({ GEMINI_API_KEY: 'x', GEMINI_PRIMEIRO_MS: '150' })[n];
const pedido = { mensagens: [{ role: 'user', content: 'oi' }], maxTokens: 100, temperatura: 0.2, prazoMs: 10000 };

{ let n = 0;
  const g = criarGemini(env, (u, o) => (++n === 1 ? pendura(o.signal) : Promise.resolve(sse('olá'))));
  const t0 = Date.now(); let saiu = '';
  const r = await g.gerarFluxo(pedido, t => { saiu += t; });
  ok(r.ok && r.texto === 'olá' && saiu === 'olá', 'travou na 1ª, respondeu na 2ª');
  ok(n === 2 && Date.now() - t0 < 1500, 'trocou rápido (' + (Date.now() - t0) + ' ms, ' + n + ' pedidos)'); }

{ let n = 0;
  const g = criarGemini(env, (u, o) => { n++; return pendura(o.signal); });
  const r = await g.gerarFluxo(pedido, () => {});
  ok(!r.ok && r.erro === 'tempo' && n === 2, 'travou nas duas: "tempo", só 2 pedidos'); }

{ let n = 0;
  const g = criarGemini(env, () => { n++; return Promise.resolve(sse('direto')); });
  const r = await g.gerarFluxo(pedido, () => {});
  ok(r.ok && n === 1, 'normal: um pedido só'); }

/* 4.4.4: o modelo rápido vai na frente; sobrecarregado → o padrão */
const json = (st, o) => Promise.resolve(new Response(JSON.stringify(o), { status: st }));
const resp = t => ({ candidates: [{ content: { parts: [{ text: t }] }, finishReason: 'STOP' }] });
{ const urls = [];
  const g = criarGemini(env, u => { urls.push(u); return json(200, resp('rápido')); });
  const r = await g.gerar(pedido);
  ok(r.ok && urls.length === 1 && /gemini-3\.5-flash:/.test(urls[0]), 'gerar: vai primeiro no modelo rápido'); }
{ const urls = [];
  const g = criarGemini(env, u => { urls.push(u); return urls.length === 1 ? json(503, { error: { message: 'high demand' } }) : json(200, resp('reserva')); });
  const r = await g.gerar(pedido);
  ok(r.ok && r.texto === 'reserva' && urls.length === 2 && /flash-lite/.test(urls[1]), 'gerar: rápido sobrecarregado → modelo padrão'); }
{ const urls = [];
  const g = criarGemini(env, u => { urls.push(u); return json(400, { error: { message: 'bad request' } }); });
  const r = await g.gerar(pedido);
  ok(!r.ok && urls.length === 1, 'gerar: pedido inválido não troca de modelo'); }
{ const urls = [];
  const g = criarGemini(env, (u, o) => { urls.push(u); return urls.length === 1 ? json(429, { error: { message: 'rate' } }) : Promise.resolve(sse('fluxo')); });
  const r = await g.gerarFluxo(pedido, () => {});
  ok(r.ok && /flash-lite/.test(urls[1]), 'fluxo: limite no rápido → modelo padrão'); }
{ const urls = [];
  const env2 = n => ({ GEMINI_API_KEY: 'x', GEMINI_MODELO_RAPIDO: 'nenhum' })[n];
  const g = criarGemini(env2, u => { urls.push(u); return json(200, resp('só um')); });
  await g.gerar(pedido);
  ok(/flash-lite/.test(urls[0]), 'GEMINI_MODELO_RAPIDO=nenhum: só o padrão'); }

process.exit(falhas ? 1 : 0);
