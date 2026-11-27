/* 5.0.0: identidade nova (Espectro) como padrão de todos; a equipe pode voltar ao visual antigo em Configurações → Aparência.
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
  if (url.pathname === '/rest/v1/clientes_resumo') { const c = { id: 'c1', nome: 'Alfa', contrato: 'mensal', modo: 'linha', servico: 'ativo', logo_url: null }; return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj ? c : [c]) }); }
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

/* ---------------------------------------------------- 5.0.0: a identidade nova é o padrão */
await pg.goto(URL0);
ok((await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'))) === 'espectro', 'aparelho sem escolha: o <html> já nasce com a identidade nova');
await pg.waitForTimeout(1200);
await entrar('admin'); await pg.waitForTimeout(500);
let e = await estado();
ok(e.attr === 'espectro' && /^Grimblade/.test(e.fonte) && e.pref === null, 'padrão para todos: identidade nova sem ninguém ligar nada (' + JSON.stringify(e) + ')');

/* ---------------------------------------------------- 5.23.0: o Espectro é o oficial — não há mais como voltar ao visual antigo */
await pg.evaluate(() => { location.hash = '#/config?s=aparencia'; }); await pg.waitForTimeout(1200);
ok(!(await pg.$('.cfg-alterna:has([data-chave="identidade"])')), 'Configurações → Aparência não tem mais "Usar a identidade nova"');
e = await estado();
ok(/^Grimblade/.test(e.fonte), 'a fonte vira a Grimblade (' + e.fonte + ')');
ok(e.largura === 84, 'a barra lateral vira o menu flutuante de 84 px (' + e.largura + ')');
ok(/espectro\/simbolo\.svg$/.test(e.simbolo), 'no claro, o menu é branco: símbolo novo colorido (' + e.simbolo + ')');
const pri = await pg.evaluate(() => { const b = document.querySelector('.tp-criar'); return b ? getComputedStyle(b).backgroundImage : ''; });
ok(/linear-gradient/.test(pri) && /224, 47, 117|255, 90, 87/.test(pri), 'o Criar usa o Espectro curto (' + pri.slice(0, 80) + ')');
await print(pg, 'identidade-claro');

/* o menu flutuante abre com os nomes e fecha de novo (escolha guardada no aparelho) */
const bt = await pg.$('.esp-alterna-menu');
ok(!!bt, 'o pé do menu tem o botão de abrir');
if (bt) { await bt.click(); await pg.waitForTimeout(450); }
let ab = await pg.evaluate(() => ({ w: Math.round(document.querySelector('.lateral').getBoundingClientRect().width),
  nome: getComputedStyle(document.querySelector('.nav a span')).display, pref: localStorage.getItem('b7_pref_esp_menu_aberto') }));
ok(ab.w === 248 && ab.nome !== 'none' && ab.pref === 'true', 'aberto: 248 px com o nome de cada tela (' + JSON.stringify(ab) + ')');
await print(pg, 'identidade-menu-aberto');
if (bt) { await pg.click('.esp-alterna-menu'); await pg.waitForTimeout(900); }
ab = await pg.evaluate(() => Math.round(document.querySelector('.lateral').getBoundingClientRect().width));
ok(Math.abs(ab - 84) <= 1, 'fechar volta ao menu de ícones (' + ab + ')');

await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); await pg.waitForTimeout(300);
e = await estado();
ok(/simbolo-mono-branco\.svg$/.test(e.simbolo), 'no escuro, o símbolo branco (logo branco sobre fundo escuro)');
await print(pg, 'identidade-escuro');
await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });

/* ---------------------------------------------------- login no Espectro */
await pg.evaluate(() => { document.querySelectorAll('.tela-login').forEach(e => e.remove()); B7.Auth.telaLogin(); });
await pg.waitForTimeout(700);
const lg = await pg.evaluate(() => { const c = document.querySelector('.login-caixa'), e = document.querySelector('.login-entrar');
  return { raio: getComputedStyle(c).borderTopLeftRadius, h1: document.querySelector('.login-caixa h1').textContent, marca: document.querySelector('.login-marca').getAttribute('src'),
    entrar: getComputedStyle(e).backgroundImage, logo: !!document.querySelector('.esp-login-logo'), assinatura: (document.querySelector('.esp-login-assinatura') || {}).textContent || '' }; });
ok(lg.raio === '40px' && lg.h1 === 'Entrar no B7' && /espectro\/simbolo-mono-branco/.test(lg.marca) && /linear-gradient/.test(lg.entrar) && lg.logo && /transforma negócios em marcas/.test(lg.assinatura),
  'login: cartão de vidro, "Entrar no B7", símbolo aceso, Entrar no Espectro, logo no canto e a assinatura');
await print(pg, 'identidade-login');
await pg.evaluate(() => { document.querySelectorAll('.tela-login').forEach(e => e.remove()); document.body.classList.remove('sem-sessao'); });

/* ---------------------------------------------------- Portal (pela Prévia do Portal, com a chave ligada) */
await pg.evaluate(() => { location.hash = '#/previa/c1'; }); await pg.waitForTimeout(1500);
const pt = await pg.evaluate(() => { const l = document.querySelector('.lateral'), a = document.querySelector('.nav > a.on'), cab = document.querySelector('.portal-home .ph-cab');
  return { shell: document.body.dataset.shell, altura: l ? Math.round(l.getBoundingClientRect().height) : 0, ativa: a ? (getComputedStyle(a, '::after').content !== 'none' ? getComputedStyle(a, '::after').backgroundColor : getComputedStyle(a).backgroundColor) : ''   /* 5.22.1: a ativa é a pílula dentro do trilho (::after) */, faixa: cab ? getComputedStyle(cab).backgroundColor : '',
    botaoMenu: !!document.querySelector('.esp-alterna-menu') && getComputedStyle(document.querySelector('.esp-alterna-menu')).display }; });
ok(pt.shell === 'portal' && pt.altura === 88 && pt.ativa === 'rgb(0, 21, 97)', 'Portal: a barra lateral vira o topo de 88 px com a aba ativa em Azul Matriz (' + JSON.stringify(pt) + ')');
ok(pt.faixa === 'rgb(0, 21, 97)', 'Portal: a saudação vira a faixa em Azul Matriz');
ok(pt.botaoMenu === 'none' || pt.botaoMenu === false, 'Portal: o botão de abrir o menu da equipe não aparece');
await print(pg, 'identidade-portal');
await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForTimeout(400);

/* ---------------------------------------------------- reabrir: já entra ligada, antes da primeira pintura */
await pg.goto(URL0 + '?x=1');
const cedo = await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'));
ok(cedo === 'espectro', 'ao reabrir, o <html> já nasce com a identidade nova (sem piscar o visual antigo)');
await pg.waitForTimeout(1200); await entrar('admin'); await pg.waitForTimeout(400);

/* ---------------------------------------------------- cliente (Portal): sempre a identidade nova */
/* aparelho que tinha escolhido o visual antigo (antes da 5.23.0): abre na identidade nova e a escolha é apagada */
await pg.evaluate(() => localStorage.setItem('b7_pref_identidade', JSON.stringify('classico')));
await pg.goto(URL0 + '?x=2');
ok((await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'))) === 'espectro' &&
   (await pg.evaluate(() => localStorage.getItem('b7_pref_identidade'))) === null, 'aparelho que tinha escolhido o visual antigo abre na identidade nova e a escolha some');
await pg.waitForTimeout(1000);
await entrar('cliente');
await pg.evaluate(() => B7.Identidade.conferirPapel());
ok((await pg.evaluate(() => document.documentElement.getAttribute('data-identidade'))) === 'espectro', 'cliente nesse mesmo aparelho: o Portal usa a identidade nova');

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Identidade nova: ok');
