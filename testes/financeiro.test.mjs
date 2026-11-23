/* 4.86.0: usuário Financeiro (administrador sem WhatsApp e sem Pessoas e acessos) — menu e rotas no Chromium. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { res.writeHead(403); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(await readFile(a)); } catch (e) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
let falhas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function como(financeiro) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 860 } });
  await ctx.route(/supabase\.co\//, async rota => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith('/rpc/pode_ver_wa')) return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(!financeiro) });
    if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
  await pg.evaluate(f => {
    const U = { id: 'u', papel: 'admin', nome: 'Fin', username: 'fin', estado: 'ativa', preferencias: {}, empresas: [], financeiro: f };
    Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehFinanceiro: () => f, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => null, niveis: () => null, acoes: () => null, naContaDeOutro: () => false, emSimulacao: () => false });
    document.querySelectorAll('.b7-abertura').forEach(e => e.remove()); if (B7.montarShellInterno) B7.montarShellInterno();
  }, financeiro);
  await pg.waitForTimeout(600);
  return { ctx, pg };
}
const visivel = (pg, s) => pg.$$eval(s, l => l.filter(e => e.offsetParent !== null).length);
{ const { ctx, pg } = await como(true);
  ok(await visivel(pg, '[data-nav="whatsapp"]') === 0, 'financeiro: sem WhatsApp no menu');
  ok(await visivel(pg, '[data-nav="gestao"]') > 0 && await visivel(pg, '[data-nav="clientes"]') > 0, 'financeiro: Gestão e Clientes no menu');
  ok(await pg.evaluate(() => B7.Perm.inicio()) === '#/gestao', 'financeiro começa na Gestão');
  await pg.evaluate(() => { location.hash = '#/whatsapp'; }); await pg.waitForTimeout(700);
  ok(!(await pg.$('.wz-lista')), 'financeiro: #/whatsapp não abre a Central');
  ok(await pg.evaluate(() => !B7.WhatsApp.podeEnviar()), 'financeiro: sem "Enviar no WhatsApp" nas outras telas');
  ok(await pg.evaluate(() => !B7.Perm.podeConfig('usuarios')), 'financeiro: sem Pessoas e acessos nas Configurações');
  await ctx.close(); }
{ const { ctx, pg } = await como(false);
  ok(await visivel(pg, '[data-nav="whatsapp"]') > 0, 'admin pleno: WhatsApp no menu');
  await ctx.close(); }
await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Financeiro: ok');
