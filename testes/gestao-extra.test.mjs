/* 4.87.0: Gestão — Contratado × entregue, Clientes em risco, Prazos e retrabalho. Chromium com banco simulado.
   PRINT=1 salva prints em testes/prints-wa/. */
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
const pedidos = []; let DEMORA = 0;
const CONTR = { fechado: true, ritmo: 1, clientes: [
  { id: 'c1', nome: 'Alfa', pacote: 'Mensal', contratado: 12, planejados: 12, publicados: 10, faltam: 2, abaixo: true, atras_ritmo: false, itens: [{ tipo: 'Reel', contratado: 4, planejados: 4, publicados: 2 }, { tipo: 'Card', contratado: 8, planejados: 8, publicados: 8 }] },
  { id: 'c3', nome: 'Gama', pacote: 'Mensal', contratado: 12, planejados: 12, publicados: 12, faltam: 0, abaixo: false, atras_ritmo: false, itens: [{ tipo: 'Reel', contratado: 4, planejados: 4, publicados: 4 }] }],
  sem_pacote: [{ id: 'c2', nome: 'Beta' }] };
const RISCOS = { clientes: [{ id: 'c1', nome: 'Alfa', pontos: 76, antes: 95, motivos: ['saúde caiu 19 pontos em 4 semanas', 'ficou abaixo do contratado no mês passado (10 de 12)'],
  semanas: [{ semana: '2026-10-26', pontos: 95 }, { semana: '2026-11-02', pontos: 90 }, { semana: '2026-11-16', pontos: 76 }] }] };
const MS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
const PRAZOS = { meses: MS, pessoas: [{ id: 'd1', nome: 'Dani', funcao: 'designer', atrasados_hoje: 1, meses: MS.map((m, i) => ({ mes: m, entregas: i + 1, no_prazo_pct: i === 5 ? 50 : 80, dias: 5.0, versoes: 2.0 })) }],
  clientes: [{ id: 'c1', nome: 'Alfa', atrasados_hoje: 1, meses: MS.map(m => ({ mes: m, entregas: 2, no_prazo_pct: 50, dias: 4.0, ajustes_pct: 25 })) }] };
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
await ctx.route(/supabase\.co\//, async rota => {
  const url = new URL(rota.request().url()), f = url.pathname.split('/rpc/')[1];
  if (f) { const corpo = JSON.parse(rota.request().postData() || '{}'); pedidos.push([f, corpo]);
    if (DEMORA && f === 'gestao_riscos') await new Promise(r => setTimeout(r, DEMORA));
    const r = f === 'gestao_painel' ? { kpis: {}, clientes: [], serie: [], pedidos: [] } : f === 'gestao_contratado' ? CONTR : f === 'gestao_riscos' ? RISCOS : f === 'gestao_prazos' ? PRAZOS : null;
    return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) }); }
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
await pg.evaluate(() => {
  const U = { id: 'u', papel: 'admin', nome: 'Fin', username: 'fin', estado: 'ativa', preferencias: {}, empresas: [], financeiro: true };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehFinanceiro: () => true, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => null, niveis: () => null, acoes: () => null, naContaDeOutro: () => false, emSimulacao: () => false });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e)); if (B7.montarShellInterno) B7.montarShellInterno();
  location.hash = '#/gestao?aba=contratado';
});
await pg.waitForSelector('.ge-lin', { timeout: 8000 }).catch(() => null);
const linhas = await pg.$$eval('.ge-lin', l => l.map(e => e.innerText.replace(/\s+/g, ' ')));
ok(linhas.length === 2 && /Alfa/.test(linhas[0]) && /faltaram 2/.test(linhas[0]) && /Reel 2\/4/.test(linhas[0]), 'Contratado × entregue: Alfa abaixo, com o tipo que faltou');
ok(!!(await pg.$('.ge-chip')), 'clientes sem pacote aparecem com atalho');
if (process.env.PRINT) { await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/gestao-contratado.png', import.meta.url)) }); }
await pg.check('[data-so-abaixo]'); await pg.waitForTimeout(400);
ok((await pg.$$('.ge-lin')).length === 1, '"Só quem está abaixo" deixa só a Alfa');
const antes = pedidos.filter(p => p[0] === 'gestao_contratado').length;
await pg.click('[data-mes="-1"]'); await pg.waitForTimeout(400);
const ult = pedidos.filter(p => p[0] === 'gestao_contratado').pop();
ok(pedidos.filter(p => p[0] === 'gestao_contratado').length === antes + 1 && ult[1].p_mes >= 1, 'trocar o mês pede de novo (' + JSON.stringify(ult[1]) + ')');
await pg.click('[data-aba="riscos"]'); await pg.waitForSelector('.ge-motivos', { timeout: 5000 }).catch(() => null);
const r = await pg.$eval('.ge-lista', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
ok(/caiu 19 pontos/.test(r) && /abaixo do contratado/.test(r) && !!(await pg.$('svg.ge-spark.caiu')), 'Clientes em risco: motivos e gráfico da saúde caindo');
if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/gestao-riscos.png', import.meta.url)) });
await pg.click('[data-aba="prazos"]'); await pg.waitForSelector('.ge-tab tbody tr', { timeout: 5000 }).catch(() => null);
const t = await pg.$eval('.ge-tab tbody tr', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
ok(/Dani/.test(t) && /50%/.test(t) && /\b5(,0)? d/.test(t) && !!(await pg.$('.ge-tend.ruim')), 'Prazos: Dani com 50% no prazo, 5 dias e a seta de piora');
if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/gestao-prazos.png', import.meta.url)) });
await pg.click('[data-visao="clientes"]'); await pg.waitForTimeout(400);
ok(/Alfa/.test(await pg.$eval('.ge-tab tbody tr', e => e.innerText)) && /Ajustes/i.test(await pg.$eval('.ge-tab thead', e => e.innerText)), 'Prazos por cliente, com ajustes');
/* resposta atrasada de uma aba não pinta por cima da outra */
DEMORA = 1200;
await pg.click('[data-aba="riscos"]'); await pg.waitForTimeout(150);
await pg.click('[data-aba="contratado"]'); await pg.waitForTimeout(1600);
ok(!(await pg.$('.ge-motivos')) && !!(await pg.$('.ge-barra')), 'trocar de aba rápido: a resposta velha não aparece');
DEMORA = 0;
await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Gestão (abas novas): ok');
