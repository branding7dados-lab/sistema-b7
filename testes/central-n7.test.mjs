/* 4.91.0: "Central" dos sistemas dentro do B7 — aparece só para quem tem mais de um sistema da casa.
   Chromium com o servidor simulado. PRINT=1 salva prints em testes/prints-wa/. */
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
const CENTRAL = 'https://adm.nucleosete.com.br/central';
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function como(sistemas, cliente, falhar) {
  const pedidos = [];
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
  await ctx.route(/supabase\.co\//, async rota => {
    const req = rota.request(), url = new URL(req.url()), json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.endsWith('/functions/v1/n7-clientes')) { const c = JSON.parse(req.postData() || '{}'); pedidos.push(c);
      return falhar ? json({ erro: 'fora do ar' }, 502) : json({ sistemas, central: CENTRAL }); }
    if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    return json({}, 401);
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
  await pg.evaluate(c => {
    try { sessionStorage.clear(); } catch (e) {}
    const U = { id: 'u1', papel: c ? 'cliente' : 'designer', nome: 'Dani', username: 'dani', estado: 'ativa', preferencias: {}, empresas: [] };
    Object.assign(B7.Auth, { usuario: () => U, papel: () => U.papel, funcao: () => null, ehAdmin: () => false, ehAdminReal: () => false, ehFinanceiro: () => false, ehEquipe: () => !c, ehCliente: () => c, funcoesExtra: () => [], modulos: () => null });
    document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e)); if (B7.montarShellInterno) B7.montarShellInterno();
  }, !!cliente);
  await pg.waitForTimeout(900);
  return { ctx, pg, pedidos };
}

{ const { ctx, pg, pedidos } = await como(['gestao', 'b7']);
  ok(pedidos.some(p => p.acao === 'meus_sistemas'), 'pergunta ao servidor quais sistemas a pessoa tem');
  const href = await pg.$eval('#bt-central-n7', a => a.getAttribute('href')).catch(() => null);
  ok(href === CENTRAL, 'dois sistemas: "Central" aparece no pé da barra, apontando para a Central do Núcleo 7');
  ok(!(await pg.$eval('#bt-central-n7', a => a.target).catch(() => '')), 'abre na mesma aba');
  await pg.evaluate(() => { B7.Topo.pintarConta(); const b = document.querySelector('.tp-conta'); b && b.click(); }); await pg.waitForSelector('[data-conta="perfil"]', { timeout: 4000 }).catch(() => null);
  ok(!!(await pg.$('[data-conta="central"]')) && /Central dos sistemas/.test(await pg.$eval('[data-conta="central"]', e => e.innerText).catch(() => '')), 'menu da conta: item "Central dos sistemas"');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  if (process.env.PRINT) { await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/central-n7.png', import.meta.url)) }); }
  /* guarda na sessão: trocar de tela não pergunta de novo */
  const antes = pedidos.length;
  await pg.evaluate(() => B7.CentralN7.carregar()); await pg.waitForTimeout(200);
  ok(pedidos.length === antes, 'a resposta fica guardada (não pergunta a cada tela)');
  await pg.evaluate(() => B7.CentralN7.sair()); await pg.waitForTimeout(100);
  ok(!(await pg.$('#bt-central-n7')), 'ao sair, a "Central" some');
  await ctx.close(); }

{ const { ctx, pg } = await como(['b7']);
  ok(!(await pg.$('#bt-central-n7')) && !(await pg.evaluate(() => B7.CentralN7.temCentral())), 'só o B7: não mostra a Central');
  await pg.evaluate(() => { B7.Topo.pintarConta(); const b = document.querySelector('.tp-conta'); b && b.click(); }); await pg.waitForSelector('[data-conta="perfil"]', { timeout: 4000 }).catch(() => null);
  ok(!!(await pg.$('[data-conta="perfil"]')) && !(await pg.$('[data-conta="central"]')), 'só o B7: o menu da conta também não tem a Central');
  await ctx.close(); }

{ const { ctx, pg } = await como([], false, true);
  ok(!(await pg.$('#bt-central-n7')), 'servidor fora do ar: não mostra nada e o B7 segue igual');
  await ctx.close(); }

{ const { ctx, pg, pedidos } = await como(['gestao', 'b7'], true);
  ok(!pedidos.length && !(await pg.$('#bt-central-n7')), 'cliente do portal: nem pergunta');
  await ctx.close(); }

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Central dentro do B7: ok');
