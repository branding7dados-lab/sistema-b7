/* 4.89.0: puxar do Núcleo 7 — janela "um por vez" (aba Cadastro) e "todos de uma vez" (Clientes).
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

const CAMPOS = [
  { campo: 'cnpj', rotulo: 'CNPJ', bloco: 'interno', chave: 'cnpj', b7: '', n7: '12345678000190', vazio: true },
  { campo: 'cidade', rotulo: 'Cidade / estado', bloco: 'interno', chave: 'cidade', b7: 'Salvador - BA', n7: 'Vitória da Conquista - BA', vazio: false },
  { campo: 'instagram', rotulo: 'Instagram', bloco: 'perfil', chave: 'instagram', b7: '', n7: 'alfa', vazio: true },
  { campo: 'meses', rotulo: 'Duração do contrato', bloco: 'interno', chave: 'contrato_meses', b7: '', n7: '6', vazio: true },
  { campo: 'logo', rotulo: 'Logo', bloco: 'logo', chave: 'logo_n7', b7: '', n7: 'https://n7/logo.png', vazio: true },
  { campo: 'combinado', rotulo: 'O que foi combinado', bloco: 'interno', chave: 'combinado', b7: '', n7: '<img src=x onerror="window.XSS=1">', vazio: true }
];
const N7 = { id: 'n1', nome: 'Alfa', situacao: 'ativo', cnpj: '12345678000190', cidade: 'Vitória da Conquista - BA' };
let MODO = 'achado', FALHA_SALVAR = null;
const pedidos = [];
const resposta = (f, corpo) => {
  if (f === 'n7-clientes') {
    if (MODO === 'sem_canal') return [503, { erro: 'A ligação com o Núcleo 7 não está configurada no servidor do B7 (faltam os segredos N7_URL e N7_SERVICE_KEY).', sem_canal: true }];
    if (corpo.acao === 'buscar') {
      if (corpo.n7_id === 'n3') return [200, { tipo: 'ligado', n7: { id: 'n3', nome: 'Alfa Matriz', situacao: 'pausa', cnpj: '', cidade: 'Ilhéus - BA' }, campos: CAMPOS.slice(0, 2), ligado: null }];
      if (MODO === 'escolher') return [200, { tipo: 'escolher', candidatos: [{ id: 'n2', nome: 'Alfa', situacao: 'ativo', cnpj: '11111111000111', cidade: 'Salvador - BA' }, { id: 'n3', nome: 'Alfa', situacao: 'pausa', cnpj: '', cidade: 'Ilhéus - BA' }] }];
      if (MODO === 'nenhum') return [200, { tipo: 'nenhum' }];
      if (MODO === 'completo') return [200, { tipo: 'achado', n7: N7, campos: [], ligado: null }];
      return [200, { tipo: 'achado', n7: N7, campos: CAMPOS, ligado: null }];
    }
    if (corpo.acao === 'procurar') return [200, { clientes: /alf/i.test(corpo.termo) ? [{ id: 'n3', nome: 'Alfa Matriz', situacao: 'pausa', cnpj: '', cidade: 'Ilhéus - BA' }] : [] }];
    if (corpo.acao === 'todos') return [200, {
      achados: [{ id: 'c1', nome: 'Alfa', n7: N7, campos: ['CNPJ', 'Instagram'], dados: { interno: { n7_cliente_id: 'n1', cnpj: '12345678000190' }, perfil: { instagram: 'alfa' } } },
        { id: 'c2', nome: 'Beta', n7: { id: 'n9', nome: 'Beta' }, campos: ['Site'], dados: { interno: { n7_cliente_id: 'n9' }, perfil: { site: 'https://beta.com' } } },
        { id: 'c5', nome: 'Épsilon', n7: { id: 'n8', nome: 'Épsilon' }, campos: [], dados: { interno: { n7_cliente_id: 'n8' } } }],
      escolher: [{ id: 'c3', nome: 'Gama', candidatos: 2 }], nenhum: [{ id: 'c4', nome: 'Delta' }], completos: 4, total: 9 }];
  }
  return [404, {}];
};
const CAD = () => ({ cliente: { id: 'c1', nome: 'Alfa', contrato: 'mensal', modo: 'linha', logo_url: null, logo_path: null },
  interno: { contrato_meses: null, cnpj: '', cidade: 'Salvador - BA', resp_nome: '', resp_cargo: '', resp_whatsapp: '', resp_email: '', combinado: '', inicio_servico: null, observacoes: '', n7_cliente_id: null },
  perfil: { nicho: '', site: '', instagram: '' }, marca: { cores: [], fonte_titulo: '', fonte_texto: '', link: '', estilo: '' },
  pacote: { pacote_id: null, nome: null, arquivado: false, ajustado: false, desde: null, itens: [], padrao: [] },
  equipe: { coordenador: null, designer: null, videomaker: null }, pode_editar: true });

let ESTADO = CAD();
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
await ctx.route(/supabase\.co\//, async rota => {
  const req = rota.request(), url = new URL(req.url()), json = (b, s = 200) => rota.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  const fn = url.pathname.split('/functions/v1/')[1];
  if (fn) { const corpo = JSON.parse(req.postData() || '{}'); pedidos.push([fn, corpo]); const [s, b] = resposta(fn, corpo); return json(b, s); }
  const rpc = url.pathname.split('/rpc/')[1];
  if (rpc) { const corpo = JSON.parse(req.postData() || '{}'); pedidos.push([rpc, corpo]);
    if (rpc === 'cliente_cadastro_salvar') {
      if (FALHA_SALVAR && FALHA_SALVAR(corpo)) return json({ message: 'O CNPJ precisa ter 14 números.', code: 'P0001' }, 400);
      const c = ESTADO; if (corpo.p_dados.logo_n7 && !c.cliente.logo_url) c.cliente.logo_url = corpo.p_dados.logo_n7; Object.assign(c.interno, corpo.p_dados.interno || {}); Object.assign(c.perfil, corpo.p_dados.perfil || {}); return json(c); }
    if (rpc === 'cliente_cadastro') return json(ESTADO);
    return json(rpc === 'cliente_cadastro_pessoas' ? {} : null); }
  if (url.pathname === '/rest/v1/clientes_resumo') { const c = { id: 'c1', nome: 'Alfa', contrato: 'mensal', modo: 'linha', servico: 'ativo', logo_url: null }; return json(/vnd\.pgrst\.object/.test(req.headers().accept || '') ? c : [c]); }
  if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: /vnd\.pgrst\.object/.test(req.headers().accept || '') ? '{}' : '[]' });
  return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
});
const pg = await ctx.newPage();
pg.on('pageerror', e => { console.log('✗ erro de JavaScript: ' + e.message); falhas++; });
await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html'); await pg.waitForTimeout(1200);
await pg.evaluate(() => {
  const U = { id: 'u', papel: 'admin', nome: 'Bruna', username: 'bruna', estado: 'ativa', preferencias: {}, empresas: [], financeiro: true };
  Object.assign(B7.Auth, { usuario: () => U, papel: () => 'admin', funcao: () => null, ehAdmin: () => true, ehAdminReal: () => true, ehFinanceiro: () => true, ehEquipe: () => true, ehCliente: () => false, funcoesExtra: () => [], modulos: () => null });
  document.querySelectorAll('.b7-abertura').forEach(e => e.parentNode && e.parentNode.removeChild(e)); if (B7.montarShellInterno) B7.montarShellInterno();
});
const texto = s => pg.$eval(s, e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
const salvos = () => pedidos.filter(p => p[0] === 'cliente_cadastro_salvar').map(p => p[1].p_dados);
const fecharJanelas = async () => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); };

/* ---------------------------------------------------- um por vez, a partir da aba Cadastro */
await pg.evaluate(() => { location.hash = '#/cliente/c1/cadastro'; });
await pg.waitForSelector('[data-cd-n7]', { timeout: 8000 }).catch(() => null);
ok(!!(await pg.$('[data-cd-n7]')), 'a aba Cadastro tem "Puxar do Núcleo 7"');
await pg.click('[data-cd-n7]'); await pg.waitForSelector('.np-tab', { timeout: 5000 }).catch(() => null);
const marcados = await pg.$$eval('[data-np-i]', l => l.map(x => x.checked));
ok(marcados.join() === 'true,false,true,true,true,true', 'campos vazios no B7 vêm marcados; o diferente (cidade) vem desmarcado (' + marcados + ')');
const t1 = await texto('.np-tab');
ok(/12\.345\.678\/0001-90/.test(t1) && /Salvador - BA/.test(t1) && /Vitória da Conquista - BA/.test(t1) && /6 meses/.test(t1) && /@alfa/.test(t1), 'mostra os dois valores lado a lado, já formatados');
ok(/<img src=x/.test(t1) && !(await pg.evaluate(() => window.XSS)) && !!(await pg.$('.np-tab img.np-logo')), 'texto do Núcleo 7 com HTML aparece como texto; a logo aparece como imagem');
ok(/No Núcleo 7: Alfa/.test(await texto('.np-lig')) && /Trazer 5 campos/.test(await texto('[data-np-ok]')), 'mostra a qual cliente está ligado e quantos campos vai trazer');
await print(pg, 'n7-um');
await pg.click('[data-np-i="2"]');   // desmarca o Instagram
await pg.click('[data-np-ok]'); await pg.waitForTimeout(600);
let s1 = salvos().pop();
ok(s1 && s1.interno.n7_cliente_id === 'n1' && s1.interno.cnpj === '12345678000190' && s1.interno.contrato_meses === 6 && !('cidade' in s1.interno) && !s1.perfil && s1.logo_n7 === 'https://n7/logo.png',
  'salva só o marcado, com o vínculo, a duração como número e a logo (' + JSON.stringify(s1) + ')');
ok(!(await pg.$('.np-janela')) && /12\.345\.678\/0001-90/.test(await texto('.cd-ficha')), 'a janela fecha e a ficha mostra o que veio');

/* erro do banco: diz o motivo e não fecha */
FALHA_SALVAR = () => true;
await pg.click('[data-cd-n7]'); await pg.waitForSelector('[data-np-ok]:not([hidden])', { timeout: 5000 }).catch(() => null);
await pg.click('[data-np-ok]'); await pg.waitForTimeout(600);
ok(!!(await pg.$('.np-janela')) && /CNPJ precisa ter 14/.test(await texto('.toasts, .toast, body')), 'se o banco recusa, a janela fica aberta e diz o motivo');
FALHA_SALVAR = null; await fecharJanelas();

/* mais de um com o mesmo nome: escolher */
MODO = 'escolher';
await pg.click('[data-cd-n7]'); await pg.waitForSelector('[data-np-n7]', { timeout: 5000 }).catch(() => null);
ok((await pg.$$('.np-cand')).length === 2 && /em pausa/.test(await texto('.np-cands')) && /Ilhéus/.test(await texto('.np-cands')), 'mais de um: lista para escolher, com situação, CNPJ e cidade');
await print(pg, 'n7-escolher');
await pg.click('[data-np-n7="n3"]'); await pg.waitForSelector('.np-tab', { timeout: 5000 }).catch(() => null);
ok(pedidos.filter(p => p[0] === 'n7-clientes').pop()[1].n7_id === 'n3' && /Alfa Matriz/.test(await texto('.np-lig')), 'escolher um carrega os campos dele');
await fecharJanelas();

/* nenhum: procurar pelo nome */
MODO = 'nenhum';
await pg.click('[data-cd-n7]'); await pg.waitForSelector('[data-np-termo]', { timeout: 5000 }).catch(() => null);
ok(/Não achei este cliente/.test(await texto('.np-corpo')), 'nenhum: avisa e oferece a busca');
await pg.fill('[data-np-termo]', 'alf'); await pg.waitForSelector('[data-np-res] [data-np-n7]', { timeout: 4000 }).catch(() => null);
ok(/Alfa Matriz/.test(await texto('[data-np-res]')), 'a busca acha pelo nome do Núcleo 7');
await fecharJanelas();

/* nada para trazer */
MODO = 'completo';
await pg.click('[data-cd-n7]'); await pg.waitForSelector('.np-lig', { timeout: 5000 }).catch(() => null);
ok(/já tem tudo/.test(await texto('.np-corpo')) && /Guardar a ligação/.test(await texto('[data-np-ok]')), 'tudo igual: diz que já tem tudo e oferece só guardar a ligação');
await fecharJanelas();

/* sem os segredos no servidor */
MODO = 'sem_canal';
await pg.click('[data-cd-n7]'); await pg.waitForSelector('.np-corpo .cb-aviso', { timeout: 5000 }).catch(() => null);
ok(/não está configurada/.test(await texto('.np-corpo')) && await pg.$eval('[data-np-ok]', b => b.hidden), 'sem a ligação configurada: explica e não oferece botão');
await fecharJanelas(); MODO = 'achado';

/* ---------------------------------------------------- todos de uma vez, a partir de Clientes */
await pg.evaluate(() => { location.hash = '#/clientes'; });
await pg.waitForSelector('[data-n7-todos]', { timeout: 8000 }).catch(() => null);
ok(!!(await pg.$('[data-n7-todos]')), 'a tela Clientes tem "Puxar cadastros do Núcleo 7" para o administrador');
await pg.click('[data-n7-todos]'); await pg.waitForSelector('.np-kpis', { timeout: 5000 }).catch(() => null);
const t2 = await texto('.np-corpo');
ok(/2 com campos a preencher/.test(t2) && /3 campos no total/.test(t2) && /2 precisam de você/.test(t2) && /5 já completos/.test(t2), 'resumo: com campos, total de campos, os que precisam de você e os completos (' + t2.slice(0, 120) + ')');
ok(/Alfa CNPJ, Instagram/.test(t2) && /Gama/.test(t2) && /Delta/.test(t2), 'lista os achados com os campos e os que precisam de escolha ou não foram achados');
ok(/Preencher os campos vazios de 2 clientes/.test(await texto('[data-np-ok]')), 'o botão diz quantos clientes vão ser preenchidos');
await print(pg, 'n7-todos');
FALHA_SALVAR = c => c.p_cliente === 'c2';
const antes = salvos().length;
await pg.click('[data-np-ok]'); await pg.waitForSelector('.np-fim', { timeout: 6000 }).catch(() => null);
ok(salvos().length === antes + 3, 'grava cliente a cliente (inclusive o que só ganha a ligação)');
ok(/2 clientes preenchidos, 2 campos/.test(await texto('.np-fim')) && /Beta/.test(await texto('.np-falhas')), 'o relatório conta o que deu certo e lista o que falhou, sem parar nos outros');
FALHA_SALVAR = null;
await pg.$eval('.np-janela [data-np-ir], .np-janela', () => {});
await fecharJanelas();

/* quem não é administrador não vê o botão de todos */
await pg.evaluate(() => { B7.Auth.ehAdmin = () => false; location.hash = '#/painel'; });
await pg.waitForTimeout(500);
await pg.evaluate(() => { location.hash = '#/clientes'; }); await pg.waitForTimeout(1200);
ok(!(await pg.$('[data-n7-todos]')), 'não-administrador não vê "Puxar cadastros do Núcleo 7"');

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Puxar do Núcleo 7: ok');
