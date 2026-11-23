/* 4.85.2: Operações — "Não se aplica" no Calendário editorial e na Publicação: o cliente que não tem a etapa
   não aparece em "Com pendência" e conta como mês concluído. Chromium com banco simulado. */
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
const feito = { status: 'Feito' };
const LINHAS = [
  { id: 'c1', nome: 'Sem calendário', auto: { calendario: { status: 'Pendente' }, artes: { status: 'Entregue' }, gravacao: { status: 'Realizada' }, edicao: { status: 'Entregue' }, publicacao: { status: 'Pendente' } },
    marcas: { calendario: { status: 'Não se aplica', por: 'Yury' }, publicacao: { status: 'Não se aplica', por: 'Yury' } } },
  { id: 'c2', nome: 'Com pendência', auto: { calendario: { status: 'Pendente' }, artes: { status: 'Entregue' }, gravacao: { status: 'Realizada' }, edicao: { status: 'Entregue' }, publicacao: feito }, marcas: {} }
];
let falhas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1360, height: 860 } });
await ctx.route(/supabase\.co\//, async rota => {
  const url = new URL(rota.request().url());
  if (url.pathname.endsWith('/rpc/operacoes_mes')) return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LINHAS) });
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
await pg.evaluate(() => {
  const U = { id: 'u', papel: 'admin', nome: 'Yury', username: 'y', estado: 'ativa', preferencias: {}, empresas: [] };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], naContaDeOutro: () => false, emSimulacao: () => false });
  document.querySelectorAll('.b7-abertura').forEach(e => e.remove()); if (B7.montarShellInterno) B7.montarShellInterno();
  location.hash = '#/operacoes';
});
await pg.waitForSelector('.op-cel', { timeout: 8000 }).catch(() => null); await pg.waitForTimeout(300);
await pg.click('[data-f="abertos"]'); await pg.waitForTimeout(300);
const nomes = await pg.$$eval('#op-corpo tbody tr', l => l.map(t => t.innerText));
ok(nomes.length === 1 && /Com pendência/.test(nomes[0]), '"Com pendência" não mostra quem não tem a etapa (' + nomes.length + ')');
const resumo = await pg.$eval('#op-resumo', e => e.innerText).catch(() => '');
ok(/1\s*\/\s*2/.test(resumo), 'quem só tem "Não se aplica" conta como mês concluído');
await pg.click('[data-f="todos"]'); await pg.waitForTimeout(300);
for (const k of ['calendario', 'publicacao']) {
  await pg.click('#op-corpo tbody tr:nth-child(2) [data-c="' + k + '"]'); await pg.waitForTimeout(300);
  const ops = await pg.$$eval('.op-ops [data-s]', l => l.map(b => b.dataset.s));
  ok(ops.includes('Não se aplica'), k + ': opção "Não se aplica" (' + ops.join(', ') + ')');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
}
await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Operações: ok');
