/* =====================================================================
   FOTO DA TELA — quantas vezes o painel é serializado (js/movimento.js)

   A "foto da tela" guarda `painel.innerHTML` para que voltar a uma tela
   já vista não pisque esqueleto. Até a zzz50 isso estava pendurado num
   clique em fase de captura no documento inteiro: TODO toque fora de um
   campo de texto serializava o painel inteiro, para usar uma vez só,
   quando enfim houvesse navegação. Era o engasgo do celular.

   Este teste mede a coisa exata que foi corrigida: instrumenta o getter
   de `innerHTML` do painel e conta.

   a) toque que não navega  → 0 serializações
   b) uma navegação         → exatamente 1
   c) voltar                → a foto aparece na tela (a função continua
                              fazendo o que existe para fazer)
   ===================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = normalize(join(RAIZ, p));
    if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    const corpo = await readFile(arq);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream' });
    res.end(corpo);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

const agora = new Date().toISOString();
const CLIENTE = { id: 'c1', nome: 'Cliente Teste', is_pinned: false, created_at: agora, updated_at: agora,
  total_gravacoes: 1, total_roteiros: 1, deleted_at: null, archived_at: null };
const GRAVACAO = { id: 'g1', nome: 'Gravação Teste', client_id: 'c1', cliente_nome: 'Cliente Teste', status: 'Rascunho',
  situacao: 'Agendada', data_gravacao: agora.slice(0, 10), created_at: agora, updated_at: agora, total_roteiros: 0,
  is_pinned: false, deleted_at: null, archived_at: null };

const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.route(/supabase\.co\//, async rota => {
  const url = new URL(rota.request().url());
  if (url.pathname.startsWith('/rest/v1/')) {
    const tabela = (url.pathname.split('/rest/v1/')[1] || '').split('?')[0];
    const dados = tabela.startsWith('clientes') ? [CLIENTE] : tabela.startsWith('gravacoes_resumo') ? [GRAVACAO] : [];
    const um = (rota.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    return rota.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/' + dados.length }, body: JSON.stringify(um ? (dados[0] || null) : dados) });
  }
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
const erros = [];
pg.on('pageerror', e => erros.push(e.message));
await pg.goto(BASE + '/index.html');
await pg.waitForTimeout(1500);
await pg.evaluate(() => {
  const U = { id: 'u-teste', papel: 'admin', nome: 'Teste', username: 'teste', estado: 'ativa', preferencias: {}, empresas: [] };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', ehAdmin: () => true, ehAdminReal: () => true,
    ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], naContaDeOutro: () => false, emSimulacao: () => false });
  document.querySelectorAll('.b7-abertura').forEach(e => e.remove());
  if (B7.montarShellInterno) B7.montarShellInterno();
});

/* uma tela de lista, carregada e parada */
await pg.evaluate(() => { location.hash = '#/clientes'; });
await pg.waitForTimeout(1200);

/* conta toda leitura de painel.innerHTML (é o que guardarFoto faz) */
await pg.evaluate(() => {
  const p = document.getElementById('painel-dashboard');
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  window.__conta = 0;
  Object.defineProperty(p, 'innerHTML', {
    configurable: true,
    get() { window.__conta++; return desc.get.call(this); },
    set(v) { return desc.set.call(this, v); }
  });
});

const falhas = [];

/* ---- a) 20 toques que não navegam ---- */
await pg.evaluate(() => {
  const p = document.getElementById('painel-dashboard');
  for (let i = 0; i < 20; i++) p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await pg.waitForTimeout(120);
const aposCliques = await pg.evaluate(() => window.__conta);
console.log((aposCliques === 0 ? '✓' : '✗') + ' 20 toques sem navegação → ' + aposCliques + ' serializações (esperado 0)');
if (aposCliques !== 0) falhas.push('toque que não navega serializou o painel ' + aposCliques + '×');

/* ---- b) uma navegação ---- */
await pg.evaluate(() => { window.__conta = 0; location.hash = '#/gravacoes'; });
await pg.waitForTimeout(1200);
const aposNav = await pg.evaluate(() => window.__conta);
console.log((aposNav === 1 ? '✓' : '✗') + ' uma navegação → ' + aposNav + ' serializações (esperado 1)');
if (aposNav !== 1) falhas.push('uma navegação serializou o painel ' + aposNav + '× (esperado 1)');

/* ---- c) voltar mostra a foto ----
   A rota importa: troca de MÓDULO (#/clientes → #/gravacoes, raízes
   diferentes) vai pelo morph de View Transitions, e aí js/movimento.js
   pula a foto de propósito (html.b7-vt). O caminho da foto é o de dentro
   do mesmo módulo — lista → detalhe → voltar, que é o uso real. */
await pg.evaluate(() => { location.hash = '#/clientes'; });
await pg.waitForTimeout(1200);
await pg.evaluate(() => { location.hash = '#/cliente/c1'; });
await pg.waitForTimeout(1200);
const semMorph = await pg.evaluate(() => !document.documentElement.classList.contains('b7-vt'));
console.log((semMorph ? '✓' : '✗') + ' lista → detalhe não passou pelo morph (é o caminho da foto)');
if (!semMorph) falhas.push('#/clientes → #/cliente/c1 virou troca de módulo: o teste deixou de exercitar a foto');

const viuFoto = await pg.evaluate(async () => {
  let viu = false;
  const obs = new MutationObserver(() => { if (document.querySelector('.b7-foto')) viu = true; });
  obs.observe(document.body, { childList: true });
  history.back();
  await new Promise(r => setTimeout(r, 900));
  obs.disconnect();
  return viu || !!document.querySelector('.b7-foto');
});
console.log((viuFoto ? '✓' : '✗') + ' voltar → a foto da tela apareceu');
if (!viuFoto) falhas.push('voltar não mostrou a foto da tela (a função parou de funcionar)');

await navegador.close();
servidor.close();
if (erros.length) falhas.push('erro de JavaScript: ' + erros.join(' | '));
if (falhas.length) { console.error('\n' + falhas.length + ' problema(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('\n✓ foto da tela: uma serialização por navegação, nenhuma por toque.');
