/* =====================================================================
   TESTE DE FUMAÇA — abre o sistema de verdade num Chromium e passa por
   todas as telas principais, com o banco simulado (nada sai daqui: toda
   chamada ao Supabase é respondida pelo próprio teste).

   Falha se: algum .js tiver erro de sintaxe, alguma tela lançar erro de
   JavaScript, ou alguma tela abrir vazia.
   Rodar:  cd testes && npm install && npm test
   (o GitHub roda sozinho a cada envio — .github/workflows/testes.yml)
   ===================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

/* servidor estático, igual ao GitHub Pages */
const servidor = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = normalize(join(RAIZ, p));
    if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    const corpo = await readFile(arq);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream' });
    res.end(corpo);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => servidor.listen(0, r));
const BASE = 'http://127.0.0.1:' + servidor.address().port;

/* dados mínimos que fazem as telas terem o que desenhar */
const agora = new Date().toISOString();
const CLIENTE = { id: 'c1', nome: 'Cliente Teste', is_pinned: false, created_at: agora, updated_at: agora,
  total_gravacoes: 1, total_roteiros: 1, deleted_at: null, archived_at: null };
const GRAVACAO = { id: 'g1', nome: 'Gravação Teste', client_id: 'c1', cliente_nome: 'Cliente Teste', status: 'Rascunho',
  situacao: 'Agendada', data_gravacao: agora.slice(0, 10), created_at: agora, updated_at: agora, total_roteiros: 0,
  is_pinned: false, deleted_at: null, archived_at: null };
function respostaRest(url) {
  const tabela = (url.pathname.split('/rest/v1/')[1] || '').split('?')[0];
  if (tabela.startsWith('clientes')) return [CLIENTE];
  if (tabela.startsWith('gravacoes_resumo')) return [GRAVACAO];
  return [];
}

const ROTAS = ['#/', '#/clientes', '#/cliente/c1', '#/gravacoes', '#/gravacao/g1', '#/roteiros', '#/linhas',
  '#/publicacoes', '#/calendario', '#/kanban', '#/aprovacoes', '#/oportunidades', '#/video', '#/design',
  '#/semanas', '#/painel', '#/lixeira', '#/arquivados', '#/config'];

const falhas = [];
const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.route(/supabase\.co\//, async rota => {
  const url = new URL(rota.request().url());
  if (url.pathname.startsWith('/rest/v1/')) {
    const um = (rota.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    const dados = respostaRest(url);
    return rota.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'content-range': '0-0/' + dados.length }, body: JSON.stringify(um ? (dados[0] || null) : dados) });
  }
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
let telaAtual = '(abertura)';
pg.on('pageerror', e => falhas.push(telaAtual + ' → erro de JavaScript: ' + e.message));
await pg.goto(BASE + '/index.html');
await pg.waitForTimeout(1500);

/* entra como administrador (sessão simulada, sem rede) */
await pg.evaluate(() => {
  const U = { id: 'u-teste', papel: 'admin', nome: 'Teste', username: 'teste', estado: 'ativa', preferencias: {}, empresas: [] };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', ehAdmin: () => true, ehAdminReal: () => true,
    ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], naContaDeOutro: () => false, emSimulacao: () => false });
  document.querySelectorAll('.b7-abertura').forEach(e => e.remove());
  if (B7.montarShellInterno) B7.montarShellInterno();
});

for (const rota of ROTAS) {
  telaAtual = rota;
  await pg.evaluate(r => { location.hash = r === '#/' ? '#/x' : '#/'; }, rota);
  await pg.waitForTimeout(150);
  await pg.evaluate(r => { location.hash = r; }, rota);
  await pg.waitForTimeout(900);
  const { texto, resumo } = await pg.evaluate(() => {
    const t = document.querySelector('.tela.ativa');
    const s = t ? t.innerText.replace(/\s+/g, ' ').trim() : '';
    return { texto: s.length, resumo: s.slice(0, 90) };
  });
  /* tela de erro também tem texto: a frase de falha conta como problema */
  const erro = /não foi possível|algo deu errado|erro ao carregar/i.test(resumo);
  if (texto < 20) falhas.push(rota + ' → a tela abriu vazia');
  if (erro) falhas.push(rota + ' → a tela mostrou erro: ' + resumo);
  console.log((texto < 20 || erro ? '✗ ' : '✓ ') + rota.padEnd(16) + resumo);
}

await navegador.close();
servidor.close();
if (falhas.length) {
  console.error('\n' + falhas.length + ' problema(s):\n- ' + [...new Set(falhas)].join('\n- '));
  process.exit(1);
}
console.log('\nTodas as telas abriram sem erro.');
