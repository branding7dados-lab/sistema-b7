// =====================================================================
// PONTE NÚCLEO 7 → B7 (4.90.0) — o bilhete de entrada.
//
// O Núcleo 7 (função b7-bilhete) assina; o B7 (b7-auth, acao 'ponte') confere.
// Formato: base64url(JSON) + '.' + base64url(HMAC-SHA256(JSON, segredo)).
// Conteúdo: { v: 1, e: e-mail, n: nome, x: vale até (segundos), j: número único }.
// O segredo (B7_PONTE_SEGREDO) é o mesmo nos dois servidores e nunca vai ao
// navegador. O bilhete vale 60 s e uma vez só (o uso único é conferido no banco).
// Este arquivo é igual nos dois repositórios: se mudar aqui, mude lá.
// =====================================================================

export type Bilhete = { v: 1; e: string; n: string; x: number; j: string };
export const VALIDADE_S = 60;

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64url(t: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(t)) return null;
  try { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); }
  catch (_e) { return null; }
}
async function hmac(segredo: string, dados: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(dados)));
}
/** comparação em tempo constante */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return d === 0;
}
export const normEmail = (e: string) => String(e || '').trim().toLowerCase();
const segredoBom = (s: string) => typeof s === 'string' && s.length >= 32;

/** Núcleo 7: monta o bilhete. `agora` em segundos (para testar). */
export async function assinar(dados: { email: string; nome: string }, segredo: string, agora = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!segredoBom(segredo)) throw new Error('segredo da ponte ausente ou curto');
  const b: Bilhete = { v: 1, e: normEmail(dados.email), n: String(dados.nome || '').slice(0, 120), x: agora + VALIDADE_S, j: crypto.randomUUID() };
  const corpo = b64url(enc.encode(JSON.stringify(b)));
  return corpo + '.' + b64url(await hmac(segredo, corpo));
}

export type Conferido = { ok: true; bilhete: Bilhete } | { ok: false; motivo: 'formato' | 'assinatura' | 'vencido' | 'segredo' };

/** B7: confere assinatura, formato e validade. O uso único é conferido à parte, no banco. */
export async function conferir(token: string, segredo: string, agora = Math.floor(Date.now() / 1000)): Promise<Conferido> {
  if (!segredoBom(segredo)) return { ok: false, motivo: 'segredo' };
  if (typeof token !== 'string' || token.length > 2000) return { ok: false, motivo: 'formato' };
  const partes = token.split('.');
  if (partes.length !== 2) return { ok: false, motivo: 'formato' };
  const [corpo, sig] = partes, sigB = deB64url(sig);
  if (!corpo || !sigB) return { ok: false, motivo: 'formato' };
  if (!iguais(await hmac(segredo, corpo), sigB)) return { ok: false, motivo: 'assinatura' };
  const bruto = deB64url(corpo);
  let b: Bilhete;
  try { b = JSON.parse(new TextDecoder().decode(bruto!)); } catch (_e) { return { ok: false, motivo: 'formato' }; }
  if (!b || b.v !== 1 || typeof b.e !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.e) || typeof b.x !== 'number' || typeof b.j !== 'string' || !/^[0-9a-f-]{36}$/.test(b.j)) {
    return { ok: false, motivo: 'formato' };
  }
  if (agora > b.x) return { ok: false, motivo: 'vencido' };
  if (b.x - agora > VALIDADE_S + 5) return { ok: false, motivo: 'formato' };   // ninguém assina bilhete longo
  return { ok: true, bilhete: { ...b, e: normEmail(b.e) } };
}

/** o motivo em português, para a tela de login */
export const MOTIVO: Record<string, string> = {
  formato: 'Esse link de entrada não é válido. Volte para a Central do Núcleo 7 e clique em Sistema B7 de novo.',
  assinatura: 'Esse link de entrada não é válido. Volte para a Central do Núcleo 7 e clique em Sistema B7 de novo.',
  vencido: 'O link de entrada venceu (ele vale 1 minuto). Volte para a Central do Núcleo 7 e clique em Sistema B7 de novo.',
  usado: 'Esse link de entrada já foi usado. Volte para a Central do Núcleo 7 e clique em Sistema B7 de novo.',
  segredo: 'A entrada pelo Núcleo 7 ainda não está configurada no B7. Entre com o seu usuário e senha.',
  sem_conta: 'Não achei uma conta do B7 com o seu e-mail. Peça ao administrador para colocar o seu e-mail em Pessoas e acessos.',
  inativa: 'A sua conta do B7 não está ativa. Fale com o administrador.',
  cliente: 'Conta de cliente entra pela tela do B7, com usuário e senha.',
};
