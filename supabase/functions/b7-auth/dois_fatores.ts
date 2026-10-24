// =====================================================================
// VERIFICAÇÃO EM 2 ETAPAS (zzz218)
//
// Quem ligou precisa, depois da senha, de um código de 6 números:
//   · por e-mail (o e-mail é cadastrado e confirmado pela pessoa; o envio
//     sai pela Brevo DA BRANDING7 — secret B7_BREVO_API_KEY (própria do B7;
//     a BREVO_API_KEY do projeto é de outra pessoa e NÃO é usada), remetente
//     B7_EMAIL_REMETENTE
//     ou o primeiro remetente ativo da conta Brevo);
//   · do app autenticador (TOTP, RFC 6238: Google Authenticator, Authy…).
//
// A sessão só sai daqui depois do código: o login guarda o refresh token
// num desafio (tabela sem acesso pelo navegador) e só o troca por uma
// sessão nova quando o código confere. "Confiar neste aparelho" devolve
// um token (só o hash fica no banco) que pula o código por 30 dias.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emailCodigo } from './email_modelo.ts';

type SB = any;
/* Cliente novo, sem sessão: depois de um signIn/refresh, o cliente passa a
   falar com o banco COMO a pessoa (e as tabelas daqui não têm política).
   Por isso troca de sessão sempre acontece num cliente descartável. */
const descartavel = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } });

const DEZ_MIN = 10 * 60 * 1000;
/* zzz221: link do e-mail que confirma com um clique (o código continua valendo) */
const SITE = 'https://branding7dados-lab.github.io/sistema-b7/';
const linkDe = (id: string, t: string) => SITE + 'confirmar.html#' + id + '.' + t;
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;
export const ACOES_SEG = ['seg_status', 'seg_email_enviar', 'seg_email_confirmar', 'seg_app_iniciar',
  'seg_app_confirmar', 'seg_desligar', 'seg_aparelhos_esquecer'];
export const ACOES_SEG_ADMIN = ['seg_politica', 'seg_resetar'];

/* ---------------------------------------------------------- utilidades */
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function hash(...partes: string[]) {
  const pimenta = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').slice(-24);
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(partes.join(':') + ':' + pimenta)));
}
function codigo6() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}
const soDigitos = (v: unknown) => String(v || '').replace(/\D/g, '').slice(0, 6);
export function mascarar(email: string | null) {
  if (!email) return '';
  const [u, d] = email.split('@');
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(6, u.length - 2))) + '@' + d;
}
const emailValido = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(e);
function tokenAleatorio() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------------------------------------------------------------- TOTP */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(bytes: Uint8Array) {
  let bits = 0, valor = 0, out = '';
  for (const b of bytes) { valor = (valor << 8) | b; bits += 8; while (bits >= 5) { out += B32[(valor >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}
function b32dec(s: string) {
  const limpo = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0, valor = 0; const out: number[] = [];
  for (const c of limpo) { const i = B32.indexOf(c); if (i < 0) continue; valor = (valor << 5) | i; bits += 5; if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
async function hotp(segredo: Uint8Array, contador: number) {
  const chave = await crypto.subtle.importKey('raw', segredo, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = new ArrayBuffer(8); const v = new DataView(buf);
  v.setUint32(0, Math.floor(contador / 4294967296)); v.setUint32(4, contador >>> 0);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', chave, buf));
  const o = s[s.length - 1] & 15;
  const n = (((s[o] & 127) << 24) | (s[o + 1] << 16) | (s[o + 2] << 8) | s[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}
/* aceita o código de 30 s antes e depois (relógio do celular adiantado/atrasado) */
export async function totpConfere(segredoB32: string, codigo: string) {
  if (!segredoB32 || codigo.length !== 6) return false;
  const seg = b32dec(segredoB32), t = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) if (await hotp(seg, t + d) === codigo) return true;
  return false;
}

/* --------------------------------------------------------------- e-mail */
let remetenteCache: { email: string; name: string } | null = null;
async function remetente(chave: string) {
  const fixo = (Deno.env.get('B7_EMAIL_REMETENTE') || '').trim();
  if (fixo) return { email: fixo, name: 'Sistema B7' };
  if (remetenteCache) return remetenteCache;
  const r = await fetch('https://api.brevo.com/v3/senders', { headers: { 'api-key': chave, accept: 'application/json' } });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  const s = (d.senders || []).find((x: any) => x.active);
  remetenteCache = s ? { email: s.email, name: 'Sistema B7' } : null;
  return remetenteCache;
}
/** 'ok' | 'sem_chave' | 'sem_remetente' — vai no ping, sem revelar nada */
export async function estadoEmail(): Promise<string> {
  const chave = Deno.env.get('B7_BREVO_API_KEY');
  if (!chave) return 'sem_chave';
  try { return (await remetente(chave)) ? 'ok' : 'sem_remetente'; } catch (_e) { return 'sem_remetente'; }
}
/** zzz268: envio genérico (resumo semanal). Devolve true/false, sem lançar. */
export async function enviarEmail(para: string, assunto: string, html: string, texto: string): Promise<boolean> {
  const chave = Deno.env.get('B7_BREVO_API_KEY');
  if (!chave) return false;
  const de = await remetente(chave);
  if (!de) return false;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': chave, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: de.email, name: 'Branding7' }, to: [{ email: para }], subject: assunto, htmlContent: html, textContent: texto })
  });
  if (!r.ok) console.error('brevo resumo falhou', r.status, (await r.text().catch(() => '')).slice(0, 200));
  return r.ok;
}
async function nomeDe(sb: SB, perfilId: string): Promise<string | null> {
  try { const { data } = await sb.from('perfis').select('nome').eq('id', perfilId).maybeSingle(); return (data && data.nome) || null; } catch (_e) { return null; }
}
async function enviarCodigo(para: string, codigo: string, motivo: 'login' | 'cadastro', ctx: { nome?: string | null; aparelho?: string | null; link?: string | null; acao?: string | null } = {}) {
  const chave = Deno.env.get('B7_BREVO_API_KEY');
  if (!chave) throw new Error('O envio de e-mail não está configurado. Fale com o administrador.');
  const de = await remetente(chave);
  if (!de) throw new Error('O envio de e-mail não está configurado (sem remetente). Fale com o administrador.');
  /* zzz220: o e-mail com a cara do B7 (email_modelo.ts) */
  const m = emailCodigo({ codigo, motivo, nome: ctx.nome, aparelho: ctx.aparelho, link: ctx.link, acao: ctx.acao });
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', headers: { 'api-key': chave, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: de, to: [{ email: para }], subject: m.assunto, htmlContent: m.html, textContent: m.texto })
  });
  if (!r.ok) {
    console.error('brevo envio falhou', r.status, (await r.text().catch(() => '')).slice(0, 300));
    throw new Error('Não foi possível enviar o e-mail agora. Tente de novo em instantes.');
  }
}

/* -------------------------------------------------------------- política */
export async function politica(sb: SB): Promise<string> {
  const { data } = await sb.from('sistema_config').select('valor').eq('chave', 'seguranca').maybeSingle();
  const v = data && data.valor && data.valor.exigir_2fa;
  return ['gestao', 'todos'].includes(v) ? v : 'ninguem';
}
async function exigidoPara(sb: SB, perfilId: string) {
  const p = await politica(sb);
  const { data } = await sb.from('perfis').select('papel, eh_admin').eq('id', perfilId).maybeSingle();
  if (!data || data.papel === 'cliente') return false;
  /* zzz225: administrador (e super admin) sempre com verificação em 2 etapas */
  if (data.eh_admin || data.papel === 'admin') return true;
  if (p === 'ninguem') return false;
  return p === 'todos' || data.papel === 'admin' || data.papel === 'coordenador' || !!data.eh_admin;
}
async function config2fa(sb: SB, perfilId: string) {
  const { data } = await sb.from('seguranca_2fa').select('*').eq('perfil_id', perfilId).maybeSingle();
  return data;
}

/* ------------------------------------------------------- etapa do login */
/** Depois da senha certa. Devolve null (pode entrar) ou o corpo da
 *  resposta que pede o código. `extra` vai junto quando entra direto. */
export async function depoisDaSenha(sb: SB, perfilId: string, sessao: any, aparelho: unknown):
  Promise<{ pedir: Record<string, unknown> | null; extra: Record<string, unknown> }> {
  const cfg = await config2fa(sb, perfilId);
  if (!cfg || !cfg.metodo) {
    return { pedir: null, extra: (await exigidoPara(sb, perfilId)) ? { configurar_2fa: true } : {} };
  }
  /* aparelho de confiança: pula o código */
  if (typeof aparelho === 'string' && aparelho.length >= 30) {
    const h = await hash('aparelho', perfilId, aparelho);
    const { data } = await sb.from('seguranca_aparelhos').select('id').eq('perfil_id', perfilId).eq('token_hash', h)
      .eq('revogado', false).gt('expira_em', new Date().toISOString()).maybeSingle();
    if (data) return { pedir: null, extra: {} };
  }
  let codigoHash: string | null = null, codigo = '', linkT = '', linkHash: string | null = null;
  if (cfg.metodo === 'email') {
    if (!cfg.email) return { pedir: null, extra: {} };
    codigo = codigo6(); codigoHash = await hash('login', perfilId, codigo);
    linkT = tokenAleatorio(); linkHash = await hash('link', perfilId, linkT);
  }
  const { data: d, error } = await sb.from('seguranca_codigos').insert({
    perfil_id: perfilId, finalidade: 'login', metodo: cfg.metodo, codigo_hash: codigoHash, link_hash: linkHash,
    refresh_token: sessao.refresh_token, expira_em: new Date(Date.now() + DEZ_MIN).toISOString()
  }).select('id').single();
  if (error || !d) throw new Error('Não foi possível iniciar a verificação. Tente de novo.');
  if (cfg.metodo === 'email') await enviarCodigo(cfg.email, codigo, 'login', { nome: await nomeDe(sb, perfilId), link: linkDe(d.id, linkT) });
  /* `erro` só é lido por telas antigas (app de Android sem atualizar): explica o que fazer */
  return { pedir: { precisa_2fa: true, metodo: cfg.metodo, desafio: d.id, email: mascarar(cfg.email),
    erro: 'Sua conta usa verificação em 2 etapas. Atualize o app (ou abra o B7 pelo navegador) para digitar o código.' }, extra: {} };
}

async function desafioValido(sb: SB, id: unknown) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from('seguranca_codigos').select('*').eq('id', id).eq('finalidade', 'login').maybeSingle();
  if (!data || data.usado || new Date(data.expira_em).getTime() < Date.now()) return null;
  return data;
}

/** login_2fa e login_2fa_reenviar — sem sessão: o desafio é a prova da senha */
export async function acaoLogin(sb: SB, acao: string, corpo: any) {
  const d = await desafioValido(sb, corpo.desafio);
  if (!d) return { status: 400, corpo: { erro: 'O código expirou. Entre de novo com usuário e senha.', codigo: 'expirou' } };

  if (acao === 'login_2fa_status') {
    if (!d.aprovado_em) return { status: 200, corpo: { pendente: true } };
    return await concluirLogin(sb, d, corpo);
  }

  if (acao === 'login_2fa_reenviar') {
    if (d.metodo !== 'email') return { status: 400, corpo: { erro: 'Use o código do seu app autenticador.' } };
    if (d.envios >= 4) return { status: 429, corpo: { erro: 'Muitos envios. Espere alguns minutos e entre de novo.' } };
    const cfg = await config2fa(sb, d.perfil_id);
    if (!cfg || !cfg.email) return { status: 400, corpo: { erro: 'E-mail não cadastrado.' } };
    const codigo = codigo6(), linkT = tokenAleatorio();
    await sb.from('seguranca_codigos').update({ codigo_hash: await hash('login', d.perfil_id, codigo), link_hash: await hash('link', d.perfil_id, linkT),
      envios: d.envios + 1, tentativas: 0, expira_em: new Date(Date.now() + DEZ_MIN).toISOString() }).eq('id', d.id);
    await enviarCodigo(cfg.email, codigo, 'login', { nome: await nomeDe(sb, d.perfil_id), link: linkDe(d.id, linkT) });
    return { status: 200, corpo: { ok: true } };
  }

  /* login_2fa */
  if (d.tentativas >= 5) {
    await sb.from('seguranca_codigos').update({ usado: true }).eq('id', d.id);
    return { status: 429, corpo: { erro: 'Muitas tentativas. Entre de novo com usuário e senha.', codigo: 'expirou' } };
  }
  const codigo = soDigitos(corpo.codigo);
  let certo = false;
  if (d.metodo === 'email') certo = codigo.length === 6 && (await hash('login', d.perfil_id, codigo)) === d.codigo_hash;
  else { const cfg = await config2fa(sb, d.perfil_id); certo = !!cfg && await totpConfere(cfg.totp_segredo, codigo); }
  if (!certo) {
    await sb.from('seguranca_codigos').update({ tentativas: d.tentativas + 1 }).eq('id', d.id);
    return { status: 401, corpo: { erro: 'Código incorreto. Confira e tente de novo.' } };
  }
  return await concluirLogin(sb, d, corpo);
}

/* entra de vez: troca o refresh guardado por uma sessão nova (código certo ou link aberto) */
async function concluirLogin(sb: SB, d: any, corpo: any) {
  await sb.from('seguranca_codigos').update({ usado: true, refresh_token: null }).eq('id', d.id);
  const { data: s, error } = await descartavel().auth.refreshSession({ refresh_token: d.refresh_token });
  if (error || !s || !s.session) return { status: 400, corpo: { erro: 'A verificação demorou demais. Entre de novo com usuário e senha.', codigo: 'expirou' } };
  const resp: Record<string, unknown> = { access_token: s.session.access_token, refresh_token: s.session.refresh_token, expires_at: s.session.expires_at };
  if (corpo.lembrar) {
    const t = tokenAleatorio();
    await sb.from('seguranca_aparelhos').insert({ perfil_id: d.perfil_id, token_hash: await hash('aparelho', d.perfil_id, t),
      descricao: String(corpo.aparelho_nome || '').slice(0, 80) || null, expira_em: new Date(Date.now() + TRINTA_DIAS).toISOString() });
    resp.aparelho = t;
  }
  return { status: 200, corpo: resp };
}

/* -------------------------------------------- link do e-mail (zzz221) */
/** email_link — sem sessão: o segredo do link é a prova (igual ao código).
 *  Cadastro: confirma o e-mail e liga a verificação. Login: marca como
 *  aprovado; quem conclui a entrada é a tela que estava esperando. */
export async function acaoLink(sb: SB, corpo: any) {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,128})$/i.exec(String(corpo.c || ''));
  if (!m) return { status: 400, corpo: { erro: 'Link inválido.', codigo: 'invalido' } };
  const { data: d } = await sb.from('seguranca_codigos').select('*').eq('id', m[1]).maybeSingle();
  if (!d || !d.link_hash) return { status: 400, corpo: { erro: 'Link inválido.', codigo: 'invalido' } };
  if (d.usado) return { status: 400, corpo: { erro: 'Este link já foi usado.', codigo: 'usado' } };
  if (new Date(d.expira_em).getTime() < Date.now()) return { status: 400, corpo: { erro: 'Este link expirou. Peça um novo código.', codigo: 'expirou' } };
  if ((await hash('link', d.perfil_id, m[2])) !== d.link_hash) return { status: 400, corpo: { erro: 'Link inválido.', codigo: 'invalido' } };
  if (d.finalidade === 'cadastro_email') {
    await sb.from('seguranca_codigos').update({ usado: true }).eq('id', d.id);
    await sb.from('seguranca_2fa').upsert({ perfil_id: d.perfil_id, metodo: 'email', email: d.email, totp_pendente: null,
      ligado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }, { onConflict: 'perfil_id' });
    return { status: 200, corpo: { ok: true, tipo: 'cadastro', email: mascarar(d.email) } };
  }
  if (d.finalidade === 'login') {
    if (!d.aprovado_em) await sb.from('seguranca_codigos').update({ aprovado_em: new Date().toISOString() }).eq('id', d.id);
    return { status: 200, corpo: { ok: true, tipo: 'login' } };
  }
  return { status: 400, corpo: { erro: 'Link inválido.', codigo: 'invalido' } };
}

/* --------------------------------------------- ações da própria conta */
export async function acaoPropria(sb: SB, eu: any, acao: string, corpo: any, confereSenha: (senha: string) => Promise<boolean>) {
  const cfg = await config2fa(sb, eu.id);
  const salvar = (patch: Record<string, unknown>) =>
    sb.from('seguranca_2fa').upsert({ perfil_id: eu.id, ...patch, atualizado_em: new Date().toISOString() }, { onConflict: 'perfil_id' });

  if (acao === 'seg_status') {
    const { count } = await sb.from('seguranca_aparelhos').select('id', { count: 'exact', head: true })
      .eq('perfil_id', eu.id).eq('revogado', false).gt('expira_em', new Date().toISOString());
    return { status: 200, corpo: { metodo: (cfg && cfg.metodo) || null, email: (cfg && cfg.email) || null, ligado_em: (cfg && cfg.ligado_em) || null,
      aparelhos: count || 0, politica: await politica(sb), exigido: await exigidoPara(sb, eu.id), email_envio: await estadoEmail() } };
  }

  if (acao === 'seg_email_enviar') {
    const email = String(corpo.email || '').trim().toLowerCase();
    if (!emailValido(email)) return { status: 400, corpo: { erro: 'E-mail inválido.' } };
    const umaHora = new Date(Date.now() - 3600000).toISOString();
    const { count } = await sb.from('seguranca_codigos').select('id', { count: 'exact', head: true })
      .eq('perfil_id', eu.id).eq('finalidade', 'cadastro_email').gt('created_at', umaHora);
    if ((count || 0) >= 5) return { status: 429, corpo: { erro: 'Muitos envios. Espere um pouco e tente de novo.' } };
    const codigo = codigo6(), linkT = tokenAleatorio();
    const { data: nova } = await sb.from('seguranca_codigos').insert({ perfil_id: eu.id, finalidade: 'cadastro_email', metodo: 'email', email,
      codigo_hash: await hash('cadastro', eu.id, codigo), link_hash: await hash('link', eu.id, linkT),
      expira_em: new Date(Date.now() + DEZ_MIN).toISOString() }).select('id').single();
    await enviarCodigo(email, codigo, 'cadastro', { nome: await nomeDe(sb, eu.id), link: nova ? linkDe(nova.id, linkT) : null });
    return { status: 200, corpo: { ok: true, email: mascarar(email) } };
  }

  if (acao === 'seg_email_confirmar') {
    const codigo = soDigitos(corpo.codigo);
    const { data: d } = await sb.from('seguranca_codigos').select('*').eq('perfil_id', eu.id).eq('finalidade', 'cadastro_email')
      .eq('usado', false).gt('expira_em', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!d) return { status: 400, corpo: { erro: 'O código expirou. Peça outro.' } };
    if (d.tentativas >= 5) return { status: 429, corpo: { erro: 'Muitas tentativas. Peça outro código.' } };
    if (codigo.length !== 6 || (await hash('cadastro', eu.id, codigo)) !== d.codigo_hash) {
      await sb.from('seguranca_codigos').update({ tentativas: d.tentativas + 1 }).eq('id', d.id);
      return { status: 401, corpo: { erro: 'Código incorreto.' } };
    }
    await sb.from('seguranca_codigos').update({ usado: true }).eq('id', d.id);
    await salvar({ metodo: 'email', email: d.email, totp_pendente: null, ligado_em: new Date().toISOString() });
    return { status: 200, corpo: { ok: true, metodo: 'email', email: d.email } };
  }

  if (acao === 'seg_app_iniciar') {
    const segredo = b32enc(crypto.getRandomValues(new Uint8Array(20)));
    await salvar({ totp_pendente: segredo });
    const rotulo = encodeURIComponent('Sistema B7:' + (eu.username || 'conta'));
    return { status: 200, corpo: { segredo, uri: 'otpauth://totp/' + rotulo + '?secret=' + segredo + '&issuer=' + encodeURIComponent('Sistema B7') + '&digits=6&period=30' } };
  }

  if (acao === 'seg_app_confirmar') {
    const codigo = soDigitos(corpo.codigo);
    if (!cfg || !cfg.totp_pendente) return { status: 400, corpo: { erro: 'Comece de novo: toque em "Usar app autenticador".' } };
    if (!(await totpConfere(cfg.totp_pendente, codigo))) return { status: 401, corpo: { erro: 'Código incorreto. Confira se o horário do celular está certo.' } };
    await salvar({ metodo: 'app', totp_segredo: cfg.totp_pendente, totp_pendente: null, ligado_em: new Date().toISOString() });
    return { status: 200, corpo: { ok: true, metodo: 'app' } };
  }

  if (acao === 'seg_desligar') {
    if (!(await confereSenha(String(corpo.senha || '')))) return { status: 403, corpo: { erro: 'Senha incorreta.' } };
    if (await exigidoPara(sb, eu.id)) return { status: 403, corpo: { erro: 'A administração exige a verificação em 2 etapas para a sua conta. Você pode trocar o jeito (e-mail ou app), mas não desligar.' } };
    await salvar({ metodo: null, totp_segredo: null, totp_pendente: null, ligado_em: null });
    await sb.from('seguranca_aparelhos').update({ revogado: true }).eq('perfil_id', eu.id);
    return { status: 200, corpo: { ok: true } };
  }

  if (acao === 'seg_aparelhos_esquecer') {
    await sb.from('seguranca_aparelhos').update({ revogado: true }).eq('perfil_id', eu.id);
    return { status: 200, corpo: { ok: true } };
  }
  return { status: 400, corpo: { erro: 'Ação desconhecida.' } };
}

/* ------------------------------------- passar o admin supremo (zzz225) */
/** O supremo escolhe outro administrador; o código vai para o e-mail da
 *  verificação em 2 etapas do supremo e vale 10 minutos. */
export async function transferirIniciar(sb: SB, eu: { id: string; nome?: string }, paraId: string) {
  const cfg = await config2fa(sb, eu.id);
  if (!cfg || !cfg.email) return { status: 400, corpo: { erro: 'Cadastre um e-mail na verificação em 2 etapas (Meu perfil → Segurança) para confirmar esta ação.' } };
  const { data: alvo } = await sb.from('perfis').select('id, nome, eh_admin, estado').eq('id', paraId).maybeSingle();
  if (!alvo || alvo.estado !== 'ativa' || !alvo.eh_admin || alvo.id === eu.id) return { status: 400, corpo: { erro: 'Escolha outro administrador ativo.' } };
  const codigo = codigo6();
  await sb.from('seguranca_codigos').update({ usado: true }).eq('perfil_id', eu.id).eq('finalidade', 'transferir_supremo').eq('usado', false);
  await sb.from('seguranca_codigos').insert({ perfil_id: eu.id, finalidade: 'transferir_supremo', metodo: 'email', email: cfg.email, alvo: alvo.id,
    codigo_hash: await hash('supremo', eu.id, codigo), expira_em: new Date(Date.now() + DEZ_MIN).toISOString() });
  await enviarCodigo(cfg.email, codigo, 'cadastro', { nome: await nomeDe(sb, eu.id), acao: 'passar o cargo de admin supremo para ' + alvo.nome });
  return { status: 200, corpo: { ok: true, email: mascarar(cfg.email), para: alvo.nome } };
}
export async function transferirConfirmar(sb: SB, eu: { id: string }, codigoBruto: unknown) {
  const codigo = soDigitos(codigoBruto);
  const { data: d } = await sb.from('seguranca_codigos').select('*').eq('perfil_id', eu.id).eq('finalidade', 'transferir_supremo')
    .eq('usado', false).gt('expira_em', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!d) return { status: 400, corpo: { erro: 'O código expirou. Comece de novo.' } };
  if (d.tentativas >= 5) return { status: 429, corpo: { erro: 'Muitas tentativas. Comece de novo.' } };
  if (codigo.length !== 6 || (await hash('supremo', eu.id, codigo)) !== d.codigo_hash) {
    await sb.from('seguranca_codigos').update({ tentativas: d.tentativas + 1 }).eq('id', d.id);
    return { status: 401, corpo: { erro: 'Código incorreto.' } };
  }
  await sb.from('seguranca_codigos').update({ usado: true }).eq('id', d.id);
  /* primeiro o atual deixa de ser supremo (só pode existir um) */
  const r1 = await sb.from('perfis').update({ superadmin: 'super' }).eq('id', eu.id);
  if (r1.error) return { status: 500, corpo: { erro: 'Não foi possível passar o cargo: ' + r1.error.message } };
  const r2 = await sb.from('perfis').update({ superadmin: 'supremo' }).eq('id', d.alvo);
  if (r2.error) { await sb.from('perfis').update({ superadmin: 'supremo' }).eq('id', eu.id); return { status: 500, corpo: { erro: 'Não foi possível passar o cargo: ' + r2.error.message } }; }
  return { status: 200, corpo: { ok: true, para: d.alvo } };
}

/* ------------------------------------------------ ações do administrador */
export async function acaoAdmin(sb: SB, acao: string, corpo: any) {
  if (acao === 'seg_politica') {
    const v = String(corpo.exigir_2fa || '');
    if (!['ninguem', 'gestao', 'todos'].includes(v)) return { status: 400, corpo: { erro: 'Opção inválida.' } };
    await sb.from('sistema_config').upsert({ chave: 'seguranca', valor: { exigir_2fa: v }, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    return { status: 200, corpo: { ok: true, exigir_2fa: v } };
  }
  if (acao === 'seg_resetar') {
    const id = String(corpo.perfil_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { status: 400, corpo: { erro: 'Pessoa inválida.' } };
    await sb.from('seguranca_2fa').upsert({ perfil_id: id, metodo: null, totp_segredo: null, totp_pendente: null, ligado_em: null, atualizado_em: new Date().toISOString() }, { onConflict: 'perfil_id' });
    await sb.from('seguranca_aparelhos').update({ revogado: true }).eq('perfil_id', id);
    return { status: 200, corpo: { ok: true } };
  }
  return { status: 400, corpo: { erro: 'Ação desconhecida.' } };
}
