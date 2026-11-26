/* 4.90.0: entrar pelo Núcleo 7 — #/ponte?b=<bilhete> no Chromium, com o servidor simulado.
   Cobre: entra e limpa o endereço; bilhete recusado volta ao login com o motivo; 2 etapas pede o código;
   aparelhos de confiança vão junto; o login aceita e-mail. PRINT=1 salva prints em testes/prints-wa/. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { res.writeHead(403); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(await readFile(a)); } catch (e) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
let falhas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const print = async (pg, nome) => { if (!process.env.PRINT) return; await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/' + nome + '.png', import.meta.url)) }); };

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + b64({ sub: 'u-kevin', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.assinatura';
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function abrir(hash, resposta, prep) {
  const pedidos = [];
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
  if (prep) await ctx.addInitScript(prep);
  let logado = false;
  await ctx.route(/supabase\.co\//, async rota => {
    const req = rota.request(), url = new URL(req.url()), json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.endsWith('/functions/v1/b7-auth')) {
      const corpo = JSON.parse(req.postData() || '{}'); pedidos.push(corpo);
      if (corpo.acao === 'ping') return json({ ok: true, versao: 'teste' });
      if (corpo.acao === 'ponte') { const [s, b] = resposta(corpo); if (b.access_token) logado = true; return json(b, s); }
      if (corpo.acao === 'login') return json({ erro: 'Usuário ou senha incorretos.' }, 401);
      return json({});
    }
    if (url.pathname.startsWith('/auth/v1/user')) return logado ? json({ id: 'u-kevin', aud: 'authenticated', role: 'authenticated', email: 'u-kevin@b7.local' }) : json({ msg: 'no' }, 401);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname === '/rest/v1/minha_sessao') return json(logado ? [{ id: 'u-kevin', username: 'kevin', nome: 'Kevin', papel: 'admin', estado: 'ativa', empresas: [] }] : []);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    return json({}, 404);
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html' + hash);
  return { ctx, pg, pedidos };
}
const espera = (pg, s, t = 9000) => pg.waitForSelector(s, { timeout: t }).catch(() => null);

/* 1) bilhete bom: entra, e o bilhete sai do endereço */
{ const { ctx, pg, pedidos } = await abrir('#/ponte?b=BILHETE-BOM.assinatura', () => [200, { access_token: JWT, refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) + 3600, username: 'kevin' }],
    () => { try { localStorage.setItem('b7_aparelho_kevin', 'x'.repeat(40)); } catch (e) {} });
  await pg.waitForFunction(() => window.B7 && B7.Auth && B7.Auth.usuario && B7.Auth.usuario(), null, { timeout: 12000 }).catch(() => null);
  const p = pedidos.find(x => x.acao === 'ponte');
  ok(p && p.bilhete === 'BILHETE-BOM.assinatura', 'manda o bilhete para a b7-auth');
  ok(p && p.aparelhos && p.aparelhos.kevin === 'x'.repeat(40), 'manda junto os aparelhos de confiança deste navegador, por usuário');
  ok(!/BILHETE/.test(await pg.evaluate(() => location.href)), 'o bilhete some do endereço');
  ok((await pg.evaluate(() => B7.Auth.usuario() && B7.Auth.usuario().username)) === 'kevin' && !(await pg.$('.tela-login')), 'entra direto, sem a tela de login');
  await ctx.close(); }

/* 2) bilhete vencido: tela de login com o motivo */
{ const { ctx, pg } = await abrir('#/ponte?b=VELHO.x', () => [401, { erro: 'O link de entrada venceu (ele vale 1 minuto). Volte para a Central do Núcleo 7 e clique em Sistema B7 de novo.', motivo: 'vencido' }]);
  await espera(pg, '.tela-login .login-aviso');
  ok(/venceu/.test(await pg.$eval('.tela-login .login-aviso', e => e.innerText).catch(() => '')), 'bilhete vencido: volta ao login dizendo o que fazer');
  ok(!/VELHO/.test(await pg.evaluate(() => location.href)), 'mesmo recusado, o bilhete sai do endereço');
  ok(/usuário ou e-mail/i.test(await pg.$eval('label[for="lg-user"]', e => e.textContent).catch(() => '')), 'o login aceita usuário ou e-mail');
  await print(pg, 'ponte-vencido');
  await ctx.close(); }

/* 3) conta com 2 etapas: já abre no código */
{ const { ctx, pg } = await abrir('#/ponte?b=DOIS.x', () => [200, { precisa_2fa: true, metodo: 'app', desafio: 'd1', username: 'kevin' }]);
  await espera(pg, '#lg-cod');
  ok(!!(await pg.$('#lg-cod')) && /Confirme que é você/.test(await pg.$eval('.tela-login', e => e.innerText).catch(() => '')), 'conta com verificação em 2 etapas: pede o código');
  ok(!(await pg.evaluate(() => B7.Auth.usuario && B7.Auth.usuario())), 'e não entra antes do código');
  await print(pg, 'ponte-2etapas');
  await ctx.close(); }

/* 4) sem bilhete: login normal, sem chamar a ponte */
{ const { ctx, pg, pedidos } = await abrir('#/', () => [500, {}]);
  await espera(pg, '.tela-login');
  ok(!!(await pg.$('.tela-login')) && !pedidos.some(x => x.acao === 'ponte'), 'sem bilhete: tela de login comum, sem chamar a ponte');
  await ctx.close(); }

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Ponte (tela): ok');
