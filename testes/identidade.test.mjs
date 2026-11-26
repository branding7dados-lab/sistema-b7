/* 4.93.0: identidade nova (Espectro) atrás de uma chave — Configurações → Aparência → "Usar a identidade nova".
   Chromium com o servidor simulado. PRINT=1 salva prints em testes/prints-wa/. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.otf': 'font/otf' };
const srv = createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { res.writeHead(403); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(await readFile(a)); } catch (e) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
let falhas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const print = async (pg, nome) => { if (!process.env.PRINT) return; await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/' + nome + '.png', import.meta.url)) }); };
const URL0 = 'http://127.0.0.1:' + srv.address().port + '/index.html';

const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
await ctx.route(/supabase\.co\//, rota => {
  const url = new URL(rota.request().url()), obj = /vnd\.pgrst\.object/.test(rota.request().headers().accept || '');
  if (url.pathname.includes('/rpc/')) return rota.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: obj ? '{}' : '[]' });
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
const entrar = (papel) => pg.evaluate(papel => {
  const U = { id: 'u', papel, nome: 'Bruna', username: 'bruna', estado: 'ativa', preferencias: {}, empresas: [] };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => papel, funcao: () => null, ehAdmin: () => papel === 'admin', ehAdminReal: () => papel === 'admin',
    ehFinanceiro: () => false, ehEquipe: () => papel !== 'cliente', ehCliente: () => papel === 'cliente', funcoesExtra: () => [], modulos: () => null });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e));
  if (papel !== 'cliente' && B7.montarShellInterno) B7.montarShellInterno();
}, papel);
const estado = () => pg.evaluate(() => {
  const l = document.querySelector('.lateral'), s = document.querySelector('.marca-lateral img.simbolo');
  return { attr: document.documentElement.getAttribute('data-identidade'), fonte: getComputedStyle(document.body).fontFamily,
    largura: l ? Math.round(l.getBoundingClientRect().width) : 0, simbolo: s ? s.getAttribute('src') : '',
    pref: localStorage.getItem('b7_pref_identidade') };
});

/* ---------------------------------------------------- desligada: nada muda */
await pg.goto(URL0); await pg.waitForTimeout(1200);
await entrar('admin'); await pg.waitForTimeout(500);
let e = await estado();
ok(!e.attr && /^Inter/.test(e.fonte) && e.largura > 200 && /symbol-white\.png$/.test(e.simbolo), 'desligada (padrão): visual atual, Inter, barra lateral larga e logo antigo (' + JSON.stringify(e) + ')');

/* ---------------------------------------------------- ligar em Configurações → Aparência */
await pg.evaluate(() => { location.hash = '#/config?s=aparencia'; }); await pg.waitForTimeout(1200);
const linha = await pg.$('.cfg-alterna:has([data-chave="identidade"])');
ok(!!linha, 'Configurações → Aparência tem "Usar a identidade nova"');
if (linha) await linha.click();
await pg.waitForTimeout(700);
e = await estado();
ok(e.attr === 'espectro' && e.pref === '"espectro"', 'ligar marca o <html> e guarda no aparelho');
ok(/^Grimblade/.test(e.fonte), 'a fonte vira a Grimblade (' + e.fonte + ')');
ok(e.largura === 84, 'a barra lateral vira o menu flutuante de 84 px (' + e.largura + ')');
ok(/espectro\/simbolo\.svg$/.test(e.simbolo), 'no claro, o menu é branco: símbolo novo colorido (' + e.simbolo + ')');
const pri = await pg.evaluate(() => { const b = document.querySelector('.tp-criar'); return b ? getComputedStyle(b).backgroundImage : ''; });
ok(/linear-gradient/.test(pri) && /224, 47, 117|255, 90, 87/.test(pri), 'o Criar usa o Espectro curto (' + pri.slice(0, 80) + ')');
await print(pg, 'identidade-claro');

await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); await pg.waitForTimeout(300);
e = await estado();
ok(/simbolo-mono-branco\.svg$/.test(e.simbolo), 'no escuro, o símbolo branco (logo branco sobre fundo escuro)');
await print(pg, 'identidade-escuro');
await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });

/* ---------------------------------------------------- reabrir: já entra ligada, antes da primeira pintura */
await pg.goto(URL0 + '?x=1');
const cedo = await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'));
ok(cedo === 'espectro', 'ao reabrir, o <html> já nasce com a identidade nova (sem piscar o visual antigo)');
await pg.waitForTimeout(1200); await entrar('admin'); await pg.waitForTimeout(400);

/* ---------------------------------------------------- desligar devolve tudo */
await pg.evaluate(() => { location.hash = '#/config?s=aparencia'; }); await pg.waitForTimeout(1200);
await pg.click('.cfg-alterna:has([data-chave="identidade"])'); await pg.waitForTimeout(600);
e = await estado();
ok(!e.attr && e.pref === 'null' && /^Inter/.test(e.fonte) && e.largura > 200 && /symbol-white\.png$/.test(e.simbolo), 'desligar volta o visual, a fonte, a barra e o logo de antes');

/* ---------------------------------------------------- cliente (Portal): nunca vê */
await pg.evaluate(() => localStorage.setItem('b7_pref_identidade', JSON.stringify('espectro')));
await pg.goto(URL0 + '?x=2'); await pg.waitForTimeout(1000);
await entrar('cliente');
await pg.evaluate(() => B7.Identidade.conferirPapel());
ok(!(await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'))), 'cliente no aparelho com a chave ligada: o Portal fica no visual atual');

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Identidade nova: ok');
