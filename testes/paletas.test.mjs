/* 5.17.0: as 3 paletas do Espectro (quadro Config-aparencia). As paletas antigas e o CSS de cor guardado pelo
   visual antigo não pintam o Espectro; Matriz e Laser trocam o destaque; Padrão B7 fica com as cores de sempre. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.otf': 'font/otf' };
const srv = createServer(async (req, res) => { try { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { res.writeHead(403); return res.end(); } res.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); res.end(await readFile(a)); } catch (e) { res.writeHead(404); res.end(); } });
await new Promise(r => srv.listen(0, r));
let falhas = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function ver(pessoal, sistema) {
  const ctx = await nav.newContext();
  await ctx.addInitScript(([p, s]) => { if (p) localStorage.setItem('b7_ap_pessoal', JSON.stringify(p)); if (s) localStorage.setItem('b7_sis_aparencia', JSON.stringify(s)); }, [pessoal, sistema]);
  await ctx.route(/supabase\.co\//, r => r.abort());
  const pg = await ctx.newPage(); await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(700);
  const r = await pg.evaluate(() => ({ pal: document.documentElement.getAttribute('data-paleta'), velho: !!document.getElementById('b7-aparencia'),
    estacao: document.documentElement.getAttribute('data-estacao'), acento: getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(),
    pri: (() => { const b = document.createElement('button'); b.className = 'b pri'; document.body.appendChild(b); const c = getComputedStyle(b).backgroundColor; b.remove(); return c; })() }));
  await ctx.close(); return r;
}
const VELHO = 'html[data-ap]{--acento:#139A63}';
{ const r = await ver({ paleta: 'floresta', css: VELHO }, { paleta: 'oceano', css: VELHO, estacoes: [{ de: '01/01', ate: '31/12', cor: 'verde' }] });
  ok(!r.pal && !r.velho && !r.estacao && r.pri === 'rgb(115, 40, 165)', 'paleta antiga + data especial: o Espectro fica no Padrão B7, sem CSS antigo e sem tingir (' + JSON.stringify(r) + ')'); }
{ const r = await ver({ paleta: 'matriz' }, null);
  ok(r.pal === 'matriz' && r.pri === 'rgb(42, 75, 192)', 'Matriz escolhida por você: destaque azul já no primeiro quadro (' + JSON.stringify(r) + ')'); }
{ const r = await ver(null, { paleta: 'laser' });
  ok(r.pal === 'laser' && r.pri === 'rgb(224, 47, 117)', 'Laser como padrão da equipe (' + JSON.stringify(r) + ')'); }
{ const r = await ver({ paleta: 'b7' }, { paleta: 'laser' });
  ok(!r.pal && r.pri === 'rgb(115, 40, 165)', 'a sua escolha (Padrão B7) vale sobre a da equipe (' + JSON.stringify(r) + ')'); }
await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Paletas do Espectro: ok');
