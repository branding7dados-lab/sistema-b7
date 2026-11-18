/* QA em produção — o que todos os testes usam: entrar com um usuário de teste, fechar os avisos de boas-vindas
   e anotar tudo o que der errado na página (erro de JavaScript, erro no console, pedido ao servidor que falhou).

   Usuários de teste (um por cargo), criados direto no banco e marcados "QA Teste":
     qa.admin · qa.coord · qa.designer · qa.video · qa.cliente  (cliente: dono do cliente "zz QA Teste")
   A senha NUNCA fica no repositório: vem da variável de ambiente QA_SENHA (ou do arquivo apontado por QA_SENHA_ARQ). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

export const BASE = process.env.QA_URL || 'https://sistema.branding7.com.br';
export const CARGOS = ['admin', 'coord', 'designer', 'video', 'cliente'];
export const NOME_CARGO = { admin: 'Administrador', coord: 'Coordenador', designer: 'Designer', video: 'Videomaker', cliente: 'Cliente (Portal)' };

export function senha() {
  const s = process.env.QA_SENHA || (process.env.QA_SENHA_ARQ ? readFileSync(process.env.QA_SENHA_ARQ, 'utf8').trim() : '');
  if (!s) throw new Error('Falta QA_SENHA (ou QA_SENHA_ARQ) com a senha dos usuários de teste.');
  return s;
}

/** código de 6 números do app autenticador (o qa.admin tem verificação em 2 etapas, como todo admin).
 *  O segredo vem de QA_TOTP (ou do arquivo QA_TOTP_ARQ) — nunca do repositório. */
export function codigo2fa() {
  const seg = (process.env.QA_TOTP || (process.env.QA_TOTP_ARQ ? readFileSync(process.env.QA_TOTP_ARQ, 'utf8') : '')).trim().toUpperCase();
  if (!seg) return '';
  const alf = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const ch of seg.replace(/=+$/, '')) bits += alf.indexOf(ch).toString(2).padStart(5, '0');
  const chave = Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2)));
  const t = Buffer.alloc(8); t.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', chave).update(t).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
}

/** barulho conhecido que não é bug do B7 */
const IGNORAR = [/favicon/i, /google-analytics|googletagmanager|gtag/i, /ResizeObserver loop/i, /chrome-extension:/i, /Failed to load resource: net::ERR_ABORTED/i];
const ignora = (t) => IGNORAR.some(r => r.test(t));

export async function navegador(opts = {}) {
  return chromium.launch(opts.executablePath ? { executablePath: opts.executablePath } : {});
}

/** contexto + página com o "gravador" de problemas ligado */
export async function abrirPagina(nav, { celular = false } = {}) {
  const ctx = await nav.newContext(celular
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Bahia' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Bahia' });
  const pg = await ctx.newPage();
  const problemas = [];
  let rotaAtual = '(entrada)';
  const anota = (tipo, texto, extra = {}) => { if (!ignora(texto)) problemas.push({ rota: rotaAtual, tipo, texto: String(texto).slice(0, 500), ...extra }); };
  pg.on('pageerror', e => anota('erro JS', e.message + (e.stack ? ' | ' + String(e.stack).split('\n').slice(1, 3).join(' ') : '')));
  pg.on('console', m => { if (m.type() === 'error') anota('console', m.text()); });
  pg.on('response', r => {
    const s = r.status(), u = r.url();
    if (s >= 400 && !/\/auth\/v1\/user|presenca|push\/|favicon/.test(u)) anota('servidor ' + s, r.request().method() + ' ' + u.replace(/\?.*$/, '').slice(0, 200) + (r.request().method() === 'POST' ? '' : ''));
  });
  pg.on('requestfailed', r => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) anota('rede', r.method() + ' ' + r.url().slice(0, 200) + ' — ' + f); });
  return { ctx, pg, problemas, setRota: (r) => { rotaAtual = r; } };
}

/** fecha o que aparece por cima depois de entrar (novidades, tour, convite do app, pedir 2 etapas…) */
export async function fecharAvisos(pg) {
  for (let i = 0; i < 4; i++) {
    const fechou = await pg.evaluate(() => {
      const visivel = (el) => !!el && el.offsetParent !== null;
      const alvos = [...document.querySelectorAll('.modal-fundo, .b7-modal, [role="dialog"], .tour, .nov-cartao, .convite-app, .b7-abertura')].filter(visivel);
      for (const m of alvos) {
        const bt = [...m.querySelectorAll('button, a')].find(b => /^(fechar|agora não|depois|pular|entendi|ok|continuar|×|✕)$/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()))
          || m.querySelector('[aria-label="Fechar"], .fechar, .modal-x, [data-fechar]');
        if (bt) { bt.click(); return true; }
      }
      document.querySelectorAll('.b7-abertura').forEach(e => e.remove());
      return false;
    }).catch(() => false);
    if (!fechou) break;
    await pg.waitForTimeout(400);
  }
  await pg.keyboard.press('Escape').catch(() => {});
}

/** entra pela tela de login, como uma pessoa */
export async function entrar(pg, cargo) {
  await pg.goto(BASE + '/#/', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#lg-user', { timeout: 30000 });
  await pg.fill('#lg-user', 'qa.' + cargo);
  await pg.fill('#lg-senha', senha());
  await pg.click('.login-entrar');
  /* segundo passo (verificação em 2 etapas) */
  const cod = await pg.waitForSelector('#lg-cod', { timeout: 6000 }).catch(() => null);
  if (cod) {
    const c = codigo2fa();
    if (!c) throw new Error('Esta conta pede código de 2 etapas e falta QA_TOTP/QA_TOTP_ARQ.');
    await pg.fill('#lg-cod', c);
  }
  await pg.waitForFunction(() => !document.querySelector('#lg-user') && window.B7 && B7.Auth && B7.Auth.usuario && B7.Auth.usuario(), null, { timeout: 45000 });
  await pg.waitForTimeout(2500);
  await fecharAvisos(pg);
}

/** abre uma rota e espera a tela assentar: some o "esqueleto" de carregando e aparece conteúdo (até 15 s) */
export async function ir(pg, rota, espera = 600) {
  await pg.evaluate(r => { location.hash = r; }, rota);
  await pg.waitForTimeout(espera);
  await pg.waitForFunction(() => {
    const p = document.querySelector('#painel-dashboard, main') || document.body;
    /* só o que está VISÍVEL e é de fato "carregando" (a seta .kb-seta.esq do Kanban não é) */
    const carregando = [...p.querySelectorAll('[class*="skel"], [class*="esquel"], .esq.esq-linha, .esq.esq-titulo, .carregando, [aria-busy="true"]')].some(e => e.offsetParent !== null);
    return !carregando && (p.innerText || '').trim().length > 10;
  }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(500);
  await fecharAvisos(pg);
}

/** problemas visíveis na tela (não aparecem no console) */
export async function olharTela(pg) {
  return pg.evaluate(() => {
    const out = [];
    const painel = document.querySelector('#painel-dashboard, main, .painel');
    const texto = (painel || document.body).innerText || '';
    if (painel && texto.trim().length < 3) out.push('tela em branco');
    const ruins = texto.match(/\b(undefined|NaN|\[object Object\]|null null)\b/g);
    if (ruins) out.push('texto quebrado na tela: ' + [...new Set(ruins)].join(', '));
    const erroVisivel = [...document.querySelectorAll('.toast, .b7-toast, .erro, .aviso-erro, .login-erro, [role="alert"]')]
      .filter(e => e.offsetParent !== null && /(erro|falhou|não foi possível|nao foi possivel|sem permissão|permission denied|violates|exception)/i.test(e.textContent || ''))
      .map(e => (e.textContent || '').trim().slice(0, 160));
    if (erroVisivel.length) out.push('mensagem de erro na tela: ' + [...new Set(erroVisivel)].join(' | '));
    if (/permission denied|violates row-level|JWT expired|PGRST\d+|42501|42P01|42703/i.test(texto)) out.push('erro técnico aparecendo para o usuário: ' + (texto.match(/.{0,60}(permission denied|violates row-level|JWT expired|PGRST\d+|42501|42P01|42703).{0,60}/i) || [''])[0]);
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 4) out.push('rolagem para o lado (página mais larga que a tela: ' + doc.scrollWidth + 'px em ' + window.innerWidth + 'px)');
    const imgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.offsetParent !== null && i.src && !/^data:/.test(i.src));
    if (imgs.length) out.push(imgs.length + ' imagem(ns) quebrada(s): ' + imgs.slice(0, 3).map(i => i.src.replace(/^.*\//, '').slice(0, 60)).join(', '));
    return out;
  });
}

/** links internos visíveis (menu, botões de navegação) */
export async function linksDaTela(pg) {
  return pg.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#/"], [data-ir^="#/"], [data-rota^="#/"]')]
    .filter(e => e.offsetParent !== null || e.closest('nav'))
    .map(e => e.getAttribute('href') || e.getAttribute('data-ir') || e.getAttribute('data-rota')))]);
}
