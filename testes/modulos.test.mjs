/* 4.92.0: Módulos da agência — desligar um módulo para todo mundo (Configurações → Sistema da equipe).
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
const print = async (pg, nome) => { if (!process.env.PRINT) return; await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/' + nome + '.png', import.meta.url)) }); };

/* banco simulado: só o que esta tela usa */
let DESLIGADOS = { whatsapp: { em: '2026-11-26T12:00:00Z', por: 'u', por_nome: 'Bruna', motivo: 'Pausado até dezembro' } };
const pedidos = [];
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
await ctx.route(/supabase\.co\//, async rota => {
  const req = rota.request(), url = new URL(req.url()), json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  const obj = /vnd\.pgrst\.object/.test(req.headers().accept || '');
  const rpc = url.pathname.split('/rpc/')[1];
  if (rpc) { const corpo = JSON.parse(req.postData() || '{}'); pedidos.push([rpc, corpo]);
    if (rpc === 'modulo_desligar') {
      const novo = Object.fromEntries(Object.entries(DESLIGADOS).filter(([k]) => k !== corpo.p_modulo));
      if (corpo.p_desligado) novo[corpo.p_modulo] = { em: new Date().toISOString(), por: 'u', por_nome: 'Bruna', motivo: corpo.p_motivo || null };
      DESLIGADOS = novo;
      return json(DESLIGADOS); }
    return json(null); }
  if (url.pathname === '/rest/v1/sistema_config') {
    if (url.searchParams.get('chave') === 'eq.modulos_desligados') return json(obj ? { valor: DESLIGADOS } : [{ valor: DESLIGADOS }]);
    return json(obj ? null : []); }
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: obj ? '{}' : '[]' });
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
const entrar = (papel, extra = {}) => pg.evaluate(([papel, extra]) => {
  const U = { id: 'u', papel, nome: 'Bruna', username: 'bruna', estado: 'ativa', preferencias: {}, empresas: [], ...extra };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => papel, funcao: () => extra.funcao || null, ehAdmin: () => papel === 'admin', ehAdminReal: () => papel === 'admin',
    ehFinanceiro: () => !!extra.financeiro, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => extra.modulos || null });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e));
}, [papel, extra]);
const texto = s => pg.$eval(s, e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');

await entrar('admin');
await pg.evaluate(() => B7.Perm.sincronizarDesligados());
await pg.evaluate(() => { if (B7.montarShellInterno) B7.montarShellInterno(); });
await pg.waitForTimeout(400);

/* ---------------------------------------------------- desligado: some para todos, admin inclusive */
ok(await pg.evaluate(() => B7.Perm.desligado('whatsapp') && !B7.Perm.podeRota('whatsapp') && !B7.Perm.temModulo('whatsapp')), 'WhatsApp desligado: nem o administrador abre a rota');
ok(await pg.evaluate(() => B7.Perm.podeRota('video') && B7.Perm.podeRota('config')), 'os outros módulos e as Configurações continuam abertos');
ok(await pg.evaluate(() => !B7.WhatsApp.podeEnviar()), 'os botões "Enviar no WhatsApp" das telas somem');
ok(!(await pg.$('[data-ir="#/whatsapp"]')), 'o WhatsApp não aparece no menu');

/* quem abre o endereço direto vê o aviso, com o motivo e quem desligou */
await pg.evaluate(() => { location.hash = '#/whatsapp'; }); await pg.waitForTimeout(700);
const aviso = await texto('#painel-dashboard');
ok(/WhatsApp está desligado na agência/.test(aviso) && /Pausado até dezembro/.test(aviso) && /Desligado por Bruna em 26\/11/.test(aviso), 'endereço direto: aviso com motivo, quem e quando (' + aviso.slice(0, 160) + ')');
ok(!!(await pg.$('[data-religar]')), 'o administrador tem "Religar" no próprio aviso');
await print(pg, 'modulo-desligado');

/* ---------------------------------------------------- Configurações → Módulos da agência */
await pg.evaluate(() => { location.hash = '#/config?s=sis-equipe'; }); await pg.waitForSelector('[data-modulos]', { timeout: 8000 }).catch(() => null);
ok(!!(await pg.$('[data-modulos]')), 'Configurações → Sistema da equipe tem "Módulos da agência"');
ok((await pg.$$('[data-modulos] [data-modulo]')).length === await pg.evaluate(() => B7.Perm.MODULOS.length), 'lista todos os módulos');
ok(/Desligado/.test(await texto('[data-modulo="whatsapp"]')) && /Pausado até dezembro/.test(await texto('[data-modulo="whatsapp"]')) &&
  !(await pg.$eval('[data-modulo="whatsapp"] .cfg-sw', e => e.classList.contains('on')).catch(() => true)), 'WhatsApp aparece desligado, com quem e o motivo');
await print(pg, 'modulos-config');

/* desligar: pede confirmação com motivo opcional e avisa o efeito */
await pg.click('[data-modulo="site"]'); await pg.waitForSelector('.mod-janela', { timeout: 4000 }).catch(() => null);
ok(/para toda a equipe, você inclusive/.test(await texto('.mod-janela')) && /Nada é apagado/.test(await texto('.mod-janela')), 'desligar pede confirmação e explica o efeito');
await print(pg, 'modulo-desligar');
await pg.fill('#mod-motivo', 'Site novo em obra');
await pg.click('.mod-janela [data-ok]'); await pg.waitForTimeout(600);
let ult = pedidos.filter(p => p[0] === 'modulo_desligar').pop();
ok(ult && ult[1].p_modulo === 'site' && ult[1].p_desligado === true && ult[1].p_motivo === 'Site novo em obra', 'grava no banco o módulo, o desligar e o motivo');
ok(!(await pg.$('.mod-janela')) && /Desligado/.test(await texto('[data-modulo="site"]')) && await pg.evaluate(() => !B7.Perm.podeRota('site')), 'a linha passa a desligado e a rota fecha na hora');

/* religar: direto, sem pergunta */
await pg.click('[data-modulo="whatsapp"]'); await pg.waitForTimeout(600);
ult = pedidos.filter(p => p[0] === 'modulo_desligar').pop();
ok(ult && ult[1].p_modulo === 'whatsapp' && ult[1].p_desligado === false && !(await pg.$('.mod-janela')), 'religar vai direto, sem confirmação');
ok(await pg.evaluate(() => B7.Perm.podeRota('whatsapp')), 'religado: a rota volta a abrir');

/* ---------------------------------------------------- equipe: o desligado vence o acesso que a pessoa tinha */
await entrar('coordenador', { funcao: 'coordenador', modulos: ['video', 'operacoes', 'site'] });
ok(await pg.evaluate(() => B7.Perm.temModulo('video') && !B7.Perm.temModulo('site') && !B7.Perm.podeRota('site')), 'coordenador com o módulo liberado também perde o desligado');
await pg.evaluate(() => { location.hash = '#/site'; }); await pg.waitForTimeout(700);
ok(/Site da agência está desligado/.test(await texto('#painel-dashboard')) && !(await pg.$('[data-religar]')), 'a equipe vê o aviso, sem o botão de religar');

/* Financeiro não liga nem desliga módulos */
await entrar('admin', { financeiro: true });
await pg.evaluate(() => { location.hash = '#/config?s=sis-equipe'; }); await pg.waitForTimeout(1000);
ok(!(await pg.$('[data-modulos]')), 'o administrador Financeiro não vê "Módulos da agência"');

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Módulos da agência: ok');
