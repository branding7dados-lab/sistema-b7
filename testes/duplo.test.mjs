/* v3.3.0: quem atende cada pedido (duplo.ts). Rodar com:
   node --experimental-strip-types testes/duplo.test.mjs */
import { criarDuplo } from '../supabase/functions/_shared/ia/duplo.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const prov = (nome, modelo, resposta) => {
  const p = { nome, modelo, chamadas: 0,
    gerar: async () => { p.chamadas++; return resposta(); },
    gerarFluxo: async (_q, t) => { p.chamadas++; const r = resposta(); if (r.ok) t(r.texto); return r; } };
  return p;
};
const okR = t => () => ({ ok: true, texto: t, modelo: 'm', tokensEntrada: 1, tokensSaida: 1 });
const limite = () => ({ ok: false, erro: 'limite', status: 429 });
const pedido = chars => ({ mensagens: [{ role: 'user', content: 'x'.repeat(chars) }], maxTokens: 1200, temperatura: 0.5, prazoMs: 1000 });

{ const r = prov('groq', 'gpt-oss', okR('rapido')), g = prov('groq', 'scout', okR('grande')), s = prov('gemini', 'flash', okR('gemini'));
  const d = criarDuplo(r, s, 6000, { provedor: g, limite: 24000 });
  const a = await d.gerar(pedido(3000));          // ~2k tokens
  ok(a.texto === 'rapido' && r.chamadas === 1, 'pedido pequeno → Groq rápido');
  const b = await d.gerarFluxo(pedido(30000), () => {});   // ~9,8k tokens
  ok(b.texto === 'grande' && g.chamadas === 1 && s.chamadas === 0, 'chat grande → Groq grande (sem Gemini)');
  const c = await d.gerar(pedido(120000));        // ~35k tokens
  ok(c.texto === 'gemini' && g.chamadas === 1, 'enorme → direto ao Gemini'); }

{ const r = prov('groq', 'gpt-oss', okR('rapido')), g = prov('groq', 'scout', limite), s = prov('gemini', 'flash', okR('gemini'));
  const d = criarDuplo(r, s, 6000, { provedor: g, limite: 24000 });
  const b = await d.gerarFluxo(pedido(30000), () => {});
  ok(b.texto === 'gemini' && b.trocas === 1, 'Groq grande no limite do minuto → Gemini'); }

{ const r = prov('groq', 'gpt-oss', okR('rapido')), s = prov('gemini', 'flash', okR('gemini'));
  const d = criarDuplo(r, s, 6000, null);
  const b = await d.gerar(pedido(30000));
  ok(b.texto === 'gemini', 'sem modelo grande: como antes (Gemini)'); }

{ const r = prov('groq', 'gpt-oss', okR('rapido')), g = prov('groq', 'scout', okR('grande')), s = prov('gemini', 'flash', okR('gemini'));
  const d = criarDuplo(r, s, 6000, { provedor: g, limite: 24000 });
  const b = await d.gerar({ ...pedido(3000), fino: true });
  ok(b.texto === 'gemini', 'legenda/marca (fino) continua no Gemini'); }

process.exit(falhas ? 1 : 0);
