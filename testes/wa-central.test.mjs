/* 4.84.0: Central de Conversas com vários números, no Chromium com banco simulado.
   Confere: a barra "Todos · Videomakers · Designers" aparece; escolher um número filtra a lista;
   em "Todos" cada conversa mostra a cor do número; responder sai PELO NÚMERO DA CONVERSA;
   com um número só, nada de barra. PRINT=1 salva prints em testes/prints-wa/. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const arq = normalize(join(RAIZ, p)); if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream' }); res.end(await readFile(arq));
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

const agora = Date.now(), iso = m => new Date(agora - m * 60000).toISOString();
const VID = { id: 'n-vid', nome: 'Videomakers', instancia: 'b7-piloto', cor: '#E8452C', equipes: ['videomaker'], padrao: true, ativo: true, ordem: 0 };
const DES = { id: 'n-des', nome: 'Designers', instancia: 'b7-designers', cor: '#5E47DE', equipes: ['designer'], padrao: false, ativo: true, ordem: 1 };
const conv = (numero_id, jid, nome, min, nao_lidas = 0) => ({ numero_id, jid, nome, tipo: /@g\.us$/.test(jid) ? 'grupo' : 'contato', ultima_em: iso(min), previa: 'Oi, tudo bem?', nao_lidas, arquivada: false, fixada: false });
let NUMS = [VID, DES];
const CONVS = [conv('n-vid', '120@g.us', 'Cliente Alfa · Vídeo', 5, 2), conv('n-des', '120@g.us', 'Cliente Alfa · Design', 8, 1), conv('n-des', '5562999990000@s.whatsapp.net', 'Bia Cliente', 30)];
const enviados = [];
const falhas = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas.push(m); };

const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function abrirCentral(viewport) {
  const ctx = await nav.newContext({ viewport, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
  await ctx.route(/supabase\.co\//, async rota => {
    const url = new URL(rota.request().url()), req = rota.request();
    if (url.pathname.startsWith('/functions/v1/wa-evolution')) {
      const corpo = JSON.parse(req.postData() || '{}'); enviados.push(corpo);
      return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo.acao === 'enviar_texto' ? { ok: true, id: 'x' + enviados.length } : { ok: true, lista: [] }) });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const f = url.pathname.split('/rpc/')[1];
      return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(f === 'pode_ver_wa' ? true : null) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const t = url.pathname.split('/rest/v1/')[1].split('?')[0];
      const dados = t === 'wa_numeros' ? NUMS : t === 'wa_conversas' ? CONVS.filter(c => NUMS.some(n => n.id === c.numero_id)) : [];
      const um = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + dados.length }, body: JSON.stringify(um ? (dados[0] || null) : dados) });
    }
    return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => falhas.push('erro de JavaScript: ' + e.message));
  await pg.goto(BASE + '/index.html'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const U = { id: 'u-teste', papel: 'admin', nome: 'Yury Teste', username: 'teste', estado: 'ativa', preferencias: {}, empresas: [] };
    Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', ehAdmin: () => true, ehAdminReal: () => true, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], naContaDeOutro: () => false, emSimulacao: () => false });
    document.querySelectorAll('.b7-abertura').forEach(e => e.remove());
    if (B7.montarShellInterno) B7.montarShellInterno();
    try { B7.pref.gravar('wa_num', 'todos'); } catch (e) {}
    location.hash = '#/whatsapp';
  });
  await pg.waitForSelector('.wz-it', { timeout: 8000 }).catch(() => null);
  await pg.waitForTimeout(500);
  return { ctx, pg };
}
const itens = pg => pg.$$eval('.wz-it', l => l.map(e => ({ nome: e.querySelector('b').textContent, num: e.dataset.num, pt: !!e.querySelector('.wz-num-pt') })));

{ const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 });
  const botoes = await pg.$$eval('.wz-nums [data-num]', l => l.map(b => b.dataset.num + ':' + b.textContent));
  ok(botoes.length === 3 && botoes[0].startsWith('todos:Todos') && botoes.some(b => b.startsWith('n-des:Designers')), 'barra com Todos, Videomakers e Designers (' + botoes.join(' | ') + ')');
  ok(botoes[0].includes('2'), 'Todos soma as conversas não lidas');
  let l = await itens(pg);
  ok(l.length === 3 && l.every(x => x.pt), 'em Todos: as 3 conversas, cada uma com a cor do número');
  if (process.env.PRINT) { await mkdir(new URL('prints-wa/', import.meta.url), { recursive: true }); await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/central-todos.png', import.meta.url)) }); }
  await pg.click('.wz-nums [data-num="n-des"]'); await pg.waitForTimeout(200);
  l = await itens(pg);
  ok(l.length === 2 && l.every(x => x.num === 'n-des' && !x.pt), 'Designers: só as 2 conversas do número, sem o ponto');
  await pg.click('.wz-nums [data-num="todos"]'); await pg.waitForTimeout(200);
  /* o mesmo grupo nos dois números: abrir o do Design e responder */
  await pg.click('.wz-it[data-num="n-des"][data-jid="120@g.us"]'); await pg.waitForTimeout(600);
  const via = await pg.$eval('.wz-cab', e => e.innerText).catch(() => '');
  ok(/via\s+Designers/.test(via), 'cabeçalho mostra "via Designers"');
  await pg.fill('#wz-texto', 'Segue a arte!'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
  const env = enviados.find(e => e.acao === 'enviar_texto');
  ok(env && env.numero === 'n-des' && env.jid === '120@g.us', 'resposta saiu pelo número da conversa (' + JSON.stringify(env && { numero: env.numero, jid: env.jid }) + ')');
  const lida = enviados.find(e => e.acao === 'lida');
  ok(lida && lida.numero === 'n-des', 'marcar como lida vai para o número certo');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/central-conversa.png', import.meta.url)) });
  await ctx.close(); }

{ NUMS = [VID];
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 });
  ok(!(await pg.$('.wz-nums')), 'um número só: sem barra');
  const l = await itens(pg);
  ok(l.length === 1 && !l[0].pt, 'um número só: lista como antes, sem pontos');
  await ctx.close(); }

await nav.close(); servidor.close();
if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('Central com vários números: ok');
