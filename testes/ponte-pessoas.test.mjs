/* 4.90.0: Pessoas e acessos — campo E-mail na conta e "Ligar com o Núcleo 7". Chromium com o servidor simulado. */
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

const USUARIOS = [
  { id: 'a1', username: 'yury', nome: 'Yury', papel: 'admin', eh_admin: true, estado: 'ativa' },
  { id: 'd1', username: 'dani', nome: 'Dani Souza', papel: 'designer', funcao: 'designer', estado: 'ativa' },
  { id: 'v1', username: 'vic', nome: 'Vic', papel: 'videomaker', funcao: 'videomaker', estado: 'ativa' },
  { id: 'c1', username: 'dona', nome: 'Dona Cliente', papel: 'cliente', estado: 'ativa' }];
let EMAILS = { a1: 'yury@branding7.com.br' };
const EQUIPE_N7 = [{ nome: 'Yury', email: 'yury@branding7.com.br', ativo: true }, { nome: 'Dâni  Souza', email: 'dani@branding7.com.br', ativo: true },
  { nome: 'Vic', email: 'vic1@x.com', ativo: true }, { nome: 'Vic', email: 'vic2@x.com', ativo: true }];
const pedidos = [];
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.route(/supabase\.co\//, async rota => {
  const req = rota.request(), url = new URL(req.url()), json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  const fn = url.pathname.split('/functions/v1/')[1];
  if (fn) { const c = JSON.parse(req.postData() || '{}'); pedidos.push([fn, c]);
    if (fn === 'b7-auth' && c.acao === 'listar_usuarios') return json({ usuarios: USUARIOS, vinculos: [], funcoes_extra: [], modulos: [], presets: [], excecoes: [], personalizadas: [], secundarias: [] });
    if (fn === 'n7-clientes' && c.acao === 'equipe') return json({ equipe: EQUIPE_N7 });
    return json({ ok: true }); }
  const rpc = url.pathname.split('/rpc/')[1];
  if (rpc) { const c = JSON.parse(req.postData() || '{}'); pedidos.push([rpc, c]);
    if (rpc === 'perfis_emails') return json(EMAILS);
    if (rpc === 'perfil_email_definir') { if (c.p_email) EMAILS[c.p_perfil] = c.p_email; else delete EMAILS[c.p_perfil]; return json(c.p_email || null); }
    return json(null); }
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: /vnd\.pgrst\.object/.test(req.headers().accept || '') ? '{}' : '[]' });
  return json({}, 401);
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
await pg.evaluate(() => {
  const U = { id: 'a1', papel: 'admin', nome: 'Yury', username: 'yury', estado: 'ativa', preferencias: {}, empresas: [] };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehFinanceiro: () => false, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => null, superadmin: () => 'supremo' });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e)); if (B7.montarShellInterno) B7.montarShellInterno();
  location.hash = '#/config?s=pessoas';
});
await pg.waitForSelector('#ligar-n7', { timeout: 8000 }).catch(() => null);
ok(!!(await pg.$('#ligar-n7')), 'Pessoas e acessos tem "Ligar com o Núcleo 7"');
await pg.$eval('#ligar-n7', b => b.click()); await pg.waitForSelector('.ln7-l', { timeout: 5000 }).catch(() => null);
const linhas = await pg.$$eval('.ln7-l', l => l.map(e => ({ t: e.innerText.replace(/\s+/g, ' '), v: e.querySelector('input').value })));
ok(linhas.length === 3 && !linhas.some(x => /Dona Cliente/.test(x.t)), 'lista só a equipe ativa (sem cliente do portal)');
const dani = linhas.find(x => /Dani Souza/.test(x.t)), vic = linhas.find(x => /Vic/.test(x.t)), yury = linhas.find(x => /Yury/.test(x.t));
ok(dani && dani.v === 'dani@branding7.com.br' && /sugerido pelo nome/.test(dani.t), 'acha pelo nome mesmo com acento e espaço diferentes (' + (dani && dani.t) + ')');
ok(vic && vic.v === '' && /mais de um/.test(vic.t), 'dois com o mesmo nome no Núcleo 7: não escolhe sozinho');
ok(yury && yury.v === 'yury@branding7.com.br' && /ligado/.test(yury.t), 'quem já tem e-mail aparece como ligado');
await pg.$eval('[data-ln7-ok]', b => b.click()); await pg.waitForTimeout(600);
const def = pedidos.filter(p => p[0] === 'perfil_email_definir').map(p => p[1]);
ok(def.length === 1 && def[0].p_perfil === 'd1' && def[0].p_email === 'dani@branding7.com.br', 'salva só o que mudou (' + JSON.stringify(def) + ')');
ok(!(await pg.$('.ln7-janela')), 'a janela fecha depois de salvar');

/* editar a conta: campo E-mail */
await pg.evaluate(() => { const c = document.querySelector('.lu4-card[data-id="v1"]'); c && c.click(); });
await pg.waitForSelector('#ed-email', { timeout: 5000 }).catch(() => null);
ok(!!(await pg.$('#ed-email')) && (await pg.$eval('#ed-email', e => e.value)) === '', 'editar a conta da equipe tem o campo E-mail');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.evaluate(() => { const c = document.querySelector('.lu4-card[data-id="d1"]'); c && c.click(); });
await pg.waitForSelector('#ed-email', { timeout: 5000 }).catch(() => null);
ok((await pg.$eval('#ed-email', e => e.value).catch(() => '')) === 'dani@branding7.com.br', 'o e-mail salvo aparece na conta');
await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Ponte (Pessoas e acessos): ok');
