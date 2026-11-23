/* 4.88.0: cadastro do cliente — janela "Novo cliente" em etapas e a ficha em blocos (aba Cadastro).
   Chromium com banco simulado. PRINT=1 salva prints em testes/prints-wa/. */
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

const PACOTES = [{ id: 'p1', nome: 'Pro', descricao: '', itens: [{ tipo: 'Card', qtd: 12 }, { tipo: 'Reel', qtd: 4, producao: 'gravacao' }], dias_semana: [1, 3, 5] },
  { id: 'p2', nome: 'Básico', descricao: '', itens: [{ tipo: 'Card', qtd: 8 }], dias_semana: [1, 3, 5] }];
const PESSOAS = { coordenador: [{ id: 'e1', nome: 'Cora' }], designer: [{ id: 'd1', nome: 'Dani' }], videomaker: [{ id: 'v1', nome: 'Vic' }] };
const vazio = () => ({ cliente: { id: 'c1', nome: 'Alfa', contrato: 'mensal', modo: 'linha', logo_url: null, logo_path: null },
  interno: { contrato_meses: null, cnpj: '', cidade: '', resp_nome: '', resp_cargo: '', resp_whatsapp: '', resp_email: '', combinado: '', inicio_servico: null, observacoes: '' },
  perfil: { nicho: '', site: '', instagram: '' }, marca: { cores: [], fonte_titulo: '', fonte_texto: '', link: '', estilo: '' },
  pacote: { pacote_id: null, nome: null, arquivado: false, ajustado: false, desde: null, itens: [], padrao: [] },
  equipe: { coordenador: null, designer: null, videomaker: null }, pode_editar: true });
let CAD = vazio(); const pedidos = []; let criados = 0;
/* o "banco": aplica o que a tela mandou, do jeito que a zzz389 faz */
function salvar(d) {
  for (const k of ['interno', 'perfil', 'marca']) if (d[k]) Object.assign(CAD[k], d[k]);
  if (d.pacote) { const p = d.pacote, id = 'pacote_id' in p ? p.pacote_id : CAD.pacote.pacote_id, pk = PACOTES.find(x => x.id === id);
    const aj = 'ajuste' in p ? p.ajuste : (id === CAD.pacote.pacote_id && CAD.pacote.ajustado ? CAD.pacote.itens : null);
    CAD.pacote = { pacote_id: id || null, nome: pk ? pk.nome : null, arquivado: false, ajustado: !!(pk && aj), desde: p.desde || CAD.pacote.desde, itens: pk ? (aj || pk.itens) : [], padrao: pk ? pk.itens : [] }; }
  if (d.equipe) for (const f of Object.keys(d.equipe)) CAD.equipe[f] = d.equipe[f] ? (PESSOAS[f] || []).find(x => x.id === d.equipe[f]) || null : null;
  return CAD;
}
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function abrir(larg = 1360, alt = 900) {
  const ctx = await nav.newContext({ viewport: { width: larg, height: alt }, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
  await ctx.route(/supabase\.co\//, async rota => {
    const req = rota.request(), url = new URL(req.url()), f = url.pathname.split('/rpc/')[1], json = b => rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (f) { const corpo = JSON.parse(req.postData() || '{}'); pedidos.push([f, corpo]);
      return json(f === 'cliente_cadastro' ? CAD : f === 'cliente_cadastro_salvar' ? salvar(corpo.p_dados) : f === 'cliente_cadastro_pessoas' ? PESSOAS : null); }
    if (url.pathname === '/rest/v1/pacotes_producao') return json(PACOTES);
    if (url.pathname === '/rest/v1/clientes' && req.method() === 'POST') { criados++; const b = JSON.parse(req.postData()); const c = Array.isArray(b) ? b[0] : b; CAD = vazio(); CAD.cliente.nome = c.nome; pedidos.push(['criar', c]); return json([{ id: 'c1', nome: c.nome, contrato: 'mensal', modo: 'linha' }]); }
    if (url.pathname === '/rest/v1/clientes' && req.method() === 'PATCH') { const b = JSON.parse(req.postData()); Object.assign(CAD.cliente, b); pedidos.push(['patch', b]); return json([Object.assign({ id: 'c1' }, CAD.cliente)]); }
    const um = /vnd\.pgrst\.object/.test(req.headers().accept || '');
    if (url.pathname === '/rest/v1/clientes_resumo') { const c = { id: 'c1', nome: CAD.cliente.nome, contrato: 'mensal', modo: 'linha', servico: 'ativo', logo_url: null }; return json(um ? c : [c]); }
    if (url.pathname === '/rest/v1/clientes' && um) return json({ servico: 'ativo' });
    if (url.pathname.startsWith('/rest/v1/')) return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
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
  await pg.waitForTimeout(500);
  return { ctx, pg };
}
const salvos = () => pedidos.filter(p => p[0] === 'cliente_cadastro_salvar').map(p => p[1].p_dados);
const texto = (pg, s) => pg.$eval(s, e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');

/* ------------------------------------------------------------ validações */
{ const { ctx, pg } = await abrir();
  const v = await pg.evaluate(() => { const V = B7.Cadastro.validar; return [V.cnpj('12.345.678/0001-90'), V.cnpj('1234567800019'), V.cnpj(''), V.cor('#1a2B3c'), V.cor('#12'), V.cor('red'),
    V.link('https://drive.google.com/x'), V.link('http://x.com'), V.link('javascript:alert(1)'), V.whatsapp('(77) 99999-0000'), V.whatsapp('12345'), V.email('a@b.com'), V.email('semarroba')]; });
  ok(JSON.stringify(v) === JSON.stringify([true, false, true, true, false, false, true, false, false, true, false, true, false]), 'validações: CNPJ, cor, link, WhatsApp e e-mail (' + v.join(',') + ')');

  /* ---------------------------------------------------------- Novo cliente */
  let criouCb = null;
  await pg.exposeFunction('aoCriarTeste', c => { criouCb = c; });
  await pg.evaluate(() => { B7.Dashboard.modalNovoCliente(c => window.aoCriarTeste(c)); });
  await pg.waitForSelector('.cd-janela #cd-nome');
  ok((await pg.$$eval('.cd-passos li b', l => l.map(e => e.innerText.trim()).join('|'))) === 'Cliente|Marca|Serviços contratados|Equipe|Observações' && (await pg.$$('.cd-passos button:disabled')).length === 4, 'janela abre com as 5 etapas; antes de criar o cliente só a primeira está liberada');
  ok(!(await pg.$('#ec-wa, [id*="grupo"]')) && !/grupo do whatsapp/i.test(await texto(pg, '.cd-janela')), 'o grupo do WhatsApp não está no cadastro');
  await pg.click('[data-cd-ok]'); await pg.waitForTimeout(200);
  ok(criados === 0 && await pg.$eval('#cd-nome', e => e.classList.contains('erro')), 'sem nome não cria');
  await pg.fill('#cd-nome', 'Alfa'); await pg.fill('#cd-cnpj', '123'); await pg.click('[data-cd-ok]'); await pg.waitForTimeout(200);
  ok(criados === 0, 'CNPJ incompleto segura na etapa 1');
  const rodape = await pg.evaluate(() => { const m = document.querySelector('.cd-janela').getBoundingClientRect(), p = document.querySelector('.cd-palco').getBoundingClientRect(), b = document.querySelector('[data-cd-ok]').getBoundingClientRect(); return b.bottom <= m.bottom - 8 && b.right <= m.right - 8 && b.left >= p.left; });
  ok(rodape, 'o rodapé com os botões fica inteiro dentro da janela');
  await pg.waitForTimeout(4200);   /* os avisos somem antes da captura */
  await pg.fill('#cd-cnpj', ''); await print(pg, 'cadastro-novo-1');
  await pg.click('[data-cd-ok]'); await pg.waitForSelector('[data-cd-cor-mais]', { timeout: 4000 }).catch(() => null);
  ok(criados === 1 && /Marca/.test(await texto(pg, '.cd-passos li.on')), 'só com o nome: cliente criado e a janela vai para a Marca');
  /* marca: 2 cores, tira 1 */
  await pg.click('[data-cd-cor-mais]'); await pg.click('[data-cd-cor-mais]');
  await pg.$$eval('.cd-cor-hex', l => { l[0].value = '#1a2b3c'; l[1].value = '#FFFFFF'; });
  await pg.$$eval('.cd-cor-nome', l => { l[0].value = 'principal'; });
  await pg.$$eval('.cd-cor-x', l => l[1].click());
  await print(pg, 'cadastro-novo-2-marca');
  await pg.click('[data-cd-ok]'); await pg.waitForSelector('#cd-pacote', { timeout: 4000 }).catch(() => null);
  const m1 = salvos().pop();
  ok(m1 && m1.marca && m1.marca.cores.length === 1 && m1.marca.cores[0].hex === '#1A2B3C' && m1.marca.cores[0].nome === 'principal' && !m1.interno, 'marca: 2 cores, 1 removida → salva 1 cor, e só a marca');
  /* pacote: escolher mostra o resumo; ajustar abre as quantidades do padrão */
  ok(await pg.$eval('[data-cd-pc-resto]', e => e.hidden), 'sem pacote escolhido, não pede data nem ajuste');
  await pg.selectOption('#cd-pacote', 'p1'); await pg.waitForTimeout(150);
  ok(/12 cards \+ 4 reels/.test(await texto(pg, '[data-cd-pc-resumo]')), 'escolher o pacote mostra o que vem nele');
  await pg.check('#cd-ajustar'); await pg.waitForTimeout(150);
  ok(await pg.$eval('[data-cd-qtds] [data-pc-tipo="Card"]', e => e.value) === '12' && await pg.$eval('[data-cd-qtds] [data-pc-tipo="Reel"]', e => e.value) === '4', '"Ajustar só para este cliente" começa com as quantidades do padrão');
  await pg.fill('[data-cd-qtds] [data-pc-tipo="Card"]', '10'); await print(pg, 'cadastro-novo-3-pacote');
  await pg.click('[data-cd-ok]'); await pg.waitForSelector('#cd-eq-designer', { timeout: 4000 }).catch(() => null);
  const p1 = salvos().pop().pacote;
  ok(p1 && p1.pacote_id === 'p1' && p1.ajuste.find(i => i.tipo === 'Card').qtd === 10 && /^\d{4}-\d{2}-01$/.test(p1.desde), 'pacote salvo com o ajuste e "vale desde" no dia 1º (' + JSON.stringify(p1) + ')');
  /* o trilho leva direto a outra etapa, salvando a atual antes */
  await pg.selectOption('#cd-eq-designer', 'd1'); const nT = salvos().length;
  await pg.click('[data-cd-ir="1"]'); await pg.waitForSelector('[data-cd-cor-mais]', { timeout: 4000 }).catch(() => null);
  ok(salvos().length === nT + 1 && salvos().pop().equipe.designer === 'd1' && /Marca/.test(await texto(pg, '.cd-passos li.on')) && /etapa 2 de 5/i.test(await texto(pg, '.cd-etapa')), 'clicar numa etapa do trilho salva a atual e vai para ela');
  ok((await pg.$$('.cd-cor')).length === 1, 'voltando à Marca, a cor salva está lá');
  /* fechar no meio não perde nem duplica o cliente */
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  ok(criados === 1 && criouCb && criouCb.id === 'c1' && criouCb.nome === 'Alfa', 'fechar na etapa 4: o cliente continua criado (1 vez) e a tela é avisada');
  /* pular até o fim */
  CAD = vazio(); criados = 0;
  await pg.evaluate(() => { B7.Dashboard.modalNovoCliente(() => {}); });
  await pg.waitForSelector('.cd-janela #cd-nome'); await pg.fill('#cd-nome', 'Beta'); await pg.click('[data-cd-ok]'); await pg.waitForSelector('[data-cd-cor-mais]');
  const antes = salvos().length;
  for (let i = 0; i < 4; i++) { await pg.click('[data-cd-pular]'); await pg.waitForTimeout(150); }
  await pg.waitForTimeout(600);
  ok(!(await pg.$('.cd-janela')) && salvos().length === antes && criados === 1, '"Pular" até o fim fecha sem gravar nada além do cliente');
  await ctx.close(); }

/* ------------------------------------------------------------ Ficha (aba Cadastro) */
{ CAD = vazio();
  Object.assign(CAD.interno, { cnpj: '12345678000190', cidade: 'Vitória da Conquista - BA', resp_nome: '<img src=x onerror="window.XSS=1">', resp_whatsapp: '77999990000' });
  Object.assign(CAD.perfil, { instagram: 'alfa', site: 'https://alfa.com.br' });
  CAD.marca.cores = [{ hex: '#1A2B3C', nome: '<b>principal</b>' }];
  CAD.pacote = { pacote_id: 'p1', nome: 'Pro', arquivado: false, ajustado: true, desde: '2026-11-01', itens: [{ tipo: 'Card', qtd: 10 }, { tipo: 'Reel', qtd: 4, producao: 'gravacao' }], padrao: PACOTES[0].itens };
  CAD.equipe.designer = { id: 'd1', nome: 'Dani' };
  const { ctx, pg } = await abrir();
  const montar = op => pg.evaluate(o => { let el = document.getElementById('t-ficha'); if (el) el.remove(); el = document.createElement('div'); el.id = 't-ficha'; document.getElementById('painel-dashboard').innerHTML = ''; document.getElementById('painel-dashboard').appendChild(el);
    return B7.Cadastro.ficha(el, 'c1', o); }, op || {});
  await montar(); await pg.waitForSelector('.cd-ficha');
  const t = await texto(pg, '.cd-ficha');
  ok(/12\.345\.678\/0001-90/.test(t) && /\(77\) 99999-0000/.test(t) && /@alfa/.test(t) && /Dani/.test(t), 'a ficha mostra os valores, com CNPJ e telefone formatados');
  ok(/<img src=x/.test(t) && !(await pg.evaluate(() => window.XSS)) && !(await pg.$('.cd-ficha img[src="x"]')) && !(await pg.$('.cd-amostra small b')), 'texto com HTML aparece como texto (responsável e nome da cor)');
  ok(/ajustado para este cliente/.test(t) && /10 Cards/.test(t) && /4 Reels/.test(t) && /14 no mês/.test(t) && /12 cards \+ 4 reels/.test(t) && /01\/11\/2026/.test(t), 'pacote: ajustado, com a entrega dele, o padrão e desde quando');
  ok((await pg.$$('[data-cd-bloco]')).length === 5 && /Completar/.test(await texto(pg, '[data-cd-bloco="obs"]')) && /Editar/.test(await texto(pg, '[data-cd-bloco="marca"]')) && !/—/.test(t) && /Falta: duração do contrato, área de atuação/.test(t), '5 blocos; bloco vazio convida a "Completar"; sem lista de traços, e o que falta vem numa linha só');
  ok(/4 de 5 partes/.test(await texto(pg, '.cd-resumo')) && /Falta observações/.test(await texto(pg, '.cd-resumo')) && (await pg.$$('.cd-prog li.ok')).length === 4, 'resumo no topo diz quantas partes estão preenchidas e o que falta (' + (await texto(pg, '.cd-resumo')).slice(0, 90) + ')');
  ok(/wa\.me\/5577999990000/.test(await pg.$eval('.cd-contato a', a => a.href).catch(() => '')), 'o WhatsApp do responsável abre a conversa');
  await print(pg, 'cadastro-ficha');
  /* editar o bloco Cliente: cancelar não grava; salvar manda só interno e perfil */
  const n0 = salvos().length;
  await pg.click('[data-cd-editar="cliente"]'); await pg.waitForSelector('#cd-cidade');
  await pg.fill('#cd-cidade', 'NÃO'); await pg.click('[data-cd-cancelar]'); await pg.waitForTimeout(150);
  ok(salvos().length === n0 && /Vitória da Conquista/.test(await texto(pg, '[data-cd-bloco="cliente"]')), 'cancelar não grava');
  await pg.click('[data-cd-editar="cliente"]'); await pg.waitForSelector('#cd-cidade');
  await pg.fill('#cd-cidade', 'Salvador - BA'); await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(500);
  const s1 = salvos().pop();
  ok(salvos().length === n0 + 1 && s1.interno.cidade === 'Salvador - BA' && s1.perfil && !s1.marca && !s1.pacote && !s1.equipe && !pedidos.some(p => p[0] === 'patch'), 'salvar o bloco Cliente manda só os dados dele, sem regravar o nome');
  ok(/Salvador - BA/.test(await texto(pg, '[data-cd-bloco="cliente"]')), 'a ficha mostra o valor novo');
  /* 4.88.2: contrato = avulso ou a duração; modos só linha editorial e roteiros; observações sem "tom de voz" */
  ok(/Contrato sem duração definida/.test(await texto(pg, '[data-cd-bloco="cliente"]')) && /duração do contrato/.test(await texto(pg, '[data-cd-bloco="cliente"] .cd-falta')), 'cliente antigo aparece como "contrato sem duração definida", e isso entra no que falta');
  await pg.click('[data-cd-editar="cliente"]'); await pg.waitForSelector('input[name="cd-contrato"]');
  const opc = await pg.$$eval('.cd-opcao b', l => l.map(e => e.innerText.trim()).join('|'));
  const modos = await pg.$$eval('[data-campo-modo] .cli-modo b', l => l.map(e => e.innerText.trim()).join('|'));
  ok(opc === 'Avulso|1 mês|3 meses|6 meses|12 meses ou mais' && !/mensal/i.test(opc), 'contrato: avulso, 1, 3, 6, 12 meses ou mais (sem "mensal")');
  ok(modos === 'Linha editorial|Roteiros e trends', 'como trabalhamos: só linha editorial e roteiros e trends (' + modos + ')');
  await pg.check('input[name="cd-contrato"][value="6"]', { force: true }); await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(500);
  ok(salvos().pop().interno.contrato_meses === 6 && !pedidos.some(p => p[0] === 'patch') && /Contrato de 6 meses/.test(await texto(pg, '[data-cd-bloco="cliente"]')), 'escolher 6 meses grava a duração e a ficha mostra "Contrato de 6 meses"');
  await pg.click('[data-cd-editar="cliente"]'); await pg.waitForSelector('input[name="cd-contrato"]');
  await pg.check('input[name="cd-contrato"][value="avulso"]', { force: true }); await pg.waitForTimeout(100);
  ok(await pg.$eval('[data-campo-modo]', e => e.hidden), 'contrato avulso esconde os modos de trabalho');
  await pg.click('[data-cd-cancelar]'); await pg.waitForTimeout(150);
  await pg.click('[data-cd-editar="obs"]'); await pg.waitForSelector('#cd-obs');
  ok(!/tom de voz/i.test(await pg.$eval('#cd-obs', e => e.placeholder)), 'observações: o campo não pede mais tom de voz');
  await pg.click('[data-cd-cancelar]'); await pg.waitForTimeout(150);
  /* cor inválida segura */
  await pg.click('[data-cd-editar="marca"]'); await pg.waitForSelector('.cd-cor-hex');
  await pg.fill('.cd-cor-hex', '#12'); const n1 = salvos().length; await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(200);
  ok(salvos().length === n1 && await pg.$eval('.cd-cor-hex', e => e.classList.contains('erro')), 'cor inválida não é salva');
  await pg.click('[data-cd-cancelar]');
  /* trocar o pacote com ajuste pede confirmação */
  await pg.click('[data-cd-editar="pacote"]'); await pg.waitForSelector('#cd-pacote');
  ok(await pg.$eval('#cd-ajustar', e => e.checked) && await pg.$eval('[data-cd-qtds] [data-pc-tipo="Card"]', e => e.value) === '10', 'editar o pacote abre com o ajuste do cliente');
  await pg.selectOption('#cd-pacote', 'p2'); const n2 = salvos().length; await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(300);
  ok(/ajuste deste cliente vai ser descartado/.test(await texto(pg, '.fundo-modal.alerta, .fundo-modal:last-of-type')) && salvos().length === n2, 'trocar de pacote com ajuste: avisa antes de gravar');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  ok(salvos().length === n2, 'desistir da troca não grava');
  await pg.click('[data-cd-cancelar]'); await pg.waitForTimeout(150);
  /* voltar ao padrão */
  await pg.click('[data-cd-padrao]'); await pg.waitForTimeout(300);
  await pg.$$eval('.fundo-modal .acoes .b.pri, .fundo-modal .acoes .b.perigo', l => l[l.length - 1].click()); await pg.waitForTimeout(500);
  const s2 = salvos().pop();
  ok(s2.pacote && s2.pacote.ajuste === null && !('pacote_id' in s2.pacote) && !/ajustado para este cliente/.test(await texto(pg, '[data-cd-bloco="pacote"]')), '"Voltar ao padrão" manda ajuste vazio e a etiqueta some');
  /* equipe */
  await pg.click('[data-cd-editar="equipe"]'); await pg.waitForSelector('#cd-eq-videomaker');
  await pg.selectOption('#cd-eq-videomaker', 'v1'); await pg.selectOption('#cd-eq-designer', ''); await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(500);
  const s3 = salvos().pop();
  ok(s3.equipe.videomaker === 'v1' && s3.equipe.designer === null && /Vic/.test(await texto(pg, '[data-cd-bloco="equipe"]')), 'equipe: define o vídeo e tira o design');
  /* cliente antigo, com pacote e sem "vale desde": editar o pacote não inventa uma data (ele sumiria dos meses passados) */
  CAD.pacote.desde = null; await montar(); await pg.waitForSelector('.cd-ficha');
  await pg.click('[data-cd-editar="pacote"]'); await pg.waitForSelector('#cd-desde');
  ok(await pg.$eval('#cd-desde', e => e.value) === '', 'pacote sem data: o campo "vale desde" abre vazio');
  await pg.click('[data-cd-salvar]'); await pg.waitForTimeout(500);
  ok(salvos().pop().pacote.desde === null, 'e salvar sem mexer mantém "desde sempre"');
  /* quem só vê não edita */
  CAD.pode_editar = false; await montar(); await pg.waitForSelector('.cd-ficha');
  ok(!(await pg.$('[data-cd-editar]')) && !(await pg.$('[data-cd-padrao]')), 'sem permissão de editar: nenhum botão "Editar"');
  CAD.pode_editar = true;
  /* gravação fixa como 6º bloco, só quando a tela manda */
  await pg.evaluate(() => { let el = document.getElementById('t-ficha'); return B7.Cadastro.ficha(el, 'c1', { gravacaoFixa: { atual: null, html: () => '<input id="t-fixa">', ligar: () => () => ({ mudou: false }), resumo: () => 'Sem dia fixo', salvar: async () => null } }); });
  await pg.waitForSelector('[data-cd-bloco="fixa"]');
  ok(/Sem dia fixo/.test(await texto(pg, '[data-cd-bloco="fixa"]')) && (await pg.$$('[data-cd-bloco]')).length === 6, 'gravação fixa entra como 6º bloco');
  await ctx.close(); }

/* ------------------------------------------------------------ na página do cliente de verdade */
{ CAD = vazio(); const { ctx, pg } = await abrir();
  await pg.evaluate(() => { location.hash = '#/cliente/c1/cadastro'; });
  await pg.waitForSelector('#cli-cadastro .cd-ficha', { timeout: 8000 }).catch(() => null);
  ok((await pg.$$('#cli-cadastro [data-cd-bloco]')).length === 6, 'a aba Cadastro abre na página do cliente, com os 5 blocos e a gravação fixa');
  await print(pg, 'cadastro-pagina');
  await pg.evaluate(() => { location.hash = '#/cliente/c1'; }); await pg.waitForTimeout(1200);
  await pg.evaluate(() => B7.Dashboard.modalEditarCliente('c1')); await pg.waitForSelector('#cli-cadastro .cd-ficha', { timeout: 8000 }).catch(() => null);
  ok(/\/cadastro$/.test(await pg.evaluate(() => location.hash)) && !(await pg.$('#ec-nome')), '"Editar cliente" leva para a aba Cadastro (a janela antiga saiu)');
  await ctx.close(); }

/* ------------------------------------------------------------ celular */
{ CAD = vazio(); const { ctx, pg } = await abrir(390, 800);
  await pg.evaluate(() => { B7.Dashboard.modalNovoCliente(() => {}); });
  await pg.waitForSelector('.cd-janela #cd-nome');
  const larg = await pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth, [...document.querySelectorAll('.cd-acoes .b')].filter(b => !b.hidden).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })]);
  ok(larg[0] <= larg[1] + 1 && larg[2], 'no celular a janela cabe na tela, sem rolar para o lado');
  await pg.waitForTimeout(800);   /* a janela sobe animada */
  const rod = await pg.evaluate(() => { const m = document.querySelector('.cd-janela').getBoundingClientRect(), b = document.querySelector('[data-cd-ok]').getBoundingClientRect(); return b.bottom <= m.bottom + 1 && b.bottom <= window.innerHeight + 1 && b.left >= m.left; });
  ok(rod, 'no celular o botão de continuar fica inteiro dentro da janela');
  await print(pg, 'cadastro-novo-celular');
  await ctx.close(); }

await nav.close(); srv.close();
if (falhas) process.exit(1);
console.log('Cadastro do cliente: ok');
