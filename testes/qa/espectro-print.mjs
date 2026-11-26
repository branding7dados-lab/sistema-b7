/* Print de uma tela na identidade Espectro, com o servidor simulado (uso dos redesenhos tela a tela).
   node testes/qa/espectro-print.mjs
     ROTA='#/clientes'  TEMA=light|dark  CEL=1 (390×844)  W=1440 H=900  OUT=/caminho/print.png  CHEIA=1 (página inteira)
     MOCK=/caminho/mock.mjs  → export default (url, req) => corpo JSON | undefined   (dados de exemplo da tela;
        url é um URL; devolva undefined para cair no padrão: listas vazias)
     DEPOIS=/caminho/depois.mjs → export default async (pg) => {…}   (cliques antes do print)
   Entra como administrador "Kevin Souza". Precisa de testes/node_modules (ln -sfn /opt/node22/lib/node_modules testes/node_modules). */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.otf': 'font/otf' };
const srv = createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { res.writeHead(403); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(await readFile(a)); } catch (e) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
const E = process.env, tema = E.TEMA === 'dark' ? 'dark' : 'light';
const mock = E.MOCK ? (await import(pathToFileURL(E.MOCK).href)).default : null;
const depois = E.DEPOIS ? (await import(pathToFileURL(E.DEPOIS).href)).default : null;
const nav = await chromium.launch(E.CHROMIUM ? { executablePath: E.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: E.CEL ? { width: 390, height: 844 } : { width: +(E.W || 1440), height: +(E.H || 900) }, colorScheme: tema, locale: 'pt-BR', timezoneId: 'America/Bahia' });
await ctx.addInitScript(t => { try { localStorage.setItem('b7_tema', t); } catch (e) {} }, tema);
await ctx.route(/supabase\.co\//, async rota => {
  const req = rota.request(), url = new URL(req.url()), obj = /vnd\.pgrst\.object/.test(req.headers().accept || '');
  const json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(b) });
  if (mock) { let r; try { r = await mock(url, req); } catch (e) { console.log('mock falhou: ' + e.message); } if (r !== undefined) return json(r); }
  if (url.pathname.includes('/functions/v1/')) return json({}, 404);
  if (url.pathname.includes('/rpc/')) return json(null);
  if (url.pathname.startsWith('/rest/v1/')) return json(obj ? {} : []);
  return json({}, 401);
});
const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('✗ erro de JavaScript: ' + e.message));
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
await pg.evaluate(() => {
  const U = { id: 'u', papel: 'admin', nome: 'Kevin Souza', username: 'kevin', estado: 'ativa', preferencias: {}, empresas: [], financeiro: false };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehFinanceiro: () => false, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => null, naContaDeOutro: () => false });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e)); if (B7.montarShellInterno) B7.montarShellInterno();
  try { B7.Notif.montar(); B7.Ajuda.montar(); B7.Conversas.montar(); } catch (e) {}
});
await pg.evaluate(r => { location.hash = r; }, E.ROTA || '#/');
await pg.waitForTimeout(+(E.ESPERA || 1800));
if (depois) { await depois(pg); await pg.waitForTimeout(700); }
await pg.screenshot({ path: E.OUT || 'print.png', fullPage: !!E.CHEIA });
console.log('print: ' + (E.OUT || 'print.png'));
await nav.close(); srv.close();
