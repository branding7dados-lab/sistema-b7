// =====================================================================
// CORS do B7 — só o endereço do app (e o próprio computador, para
// testar) recebe permissão de ler a resposta no navegador.
//
// Não é autenticação: toda função continua conferindo a sessão (JWT) e o
// papel no banco. Isto só impede que outro site, aberto no navegador de
// alguém da equipe, use as funções do B7 em nome dele lendo a resposta.
//
// Domínio novo (ex.: app próprio): secret B7_ORIGENS com a lista
// separada por vírgula, sem barra no final:
//   supabase secrets set B7_ORIGENS=https://app.branding7.com.br,https://branding7dados-lab.github.io
// =====================================================================

const PADRAO = ['https://branding7dados-lab.github.io'];
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function permitidas(): string[] {
  const env = (Deno.env.get('B7_ORIGENS') || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  return env.length ? env : PADRAO;
}

/** Cabeçalhos de CORS para esta requisição. Origem desconhecida recebe
 *  o endereço do app (o navegador então recusa a leitura da resposta). */
export function cors(req: Request, extras = ''): Record<string, string> {
  const origem = req.headers.get('origin') || '';
  const lista = permitidas();
  const ok = lista.includes(origem) || LOCAL.test(origem);
  return {
    'Access-Control-Allow-Origin': ok ? origem : lista[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region' + (extras ? ', ' + extras : ''),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    /* zzz128: o navegador guarda a resposta da consulta prévia por um dia,
       em vez de repetir uma ida ao servidor antes de cada pedido */
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/** Embrulha o handler: responde o preflight e põe o CORS certo em toda
 *  resposta (sobrescreve o que o handler tiver posto). */
export function comCors(fn: (req: Request) => Promise<Response> | Response, extras = '') {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req, extras) });
    const r = await fn(req);
    const h = cors(req, extras);
    try { for (const [k, v] of Object.entries(h)) r.headers.set(k, v); }
    catch (_e) { return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), ...h } }); }
    return r;
  };
}

/** Comparação em tempo constante (segredos de webhook/bootstrap). */
export function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
