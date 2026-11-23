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
let DEMORA = 0;
const MSGS = [{ numero_id: 'n-des', id: 'q1', jid: '120@g.us', de_mim: false, autor_jid: '221633885266163@lid', autor_nome: '221633885266163', tipo: 'texto', texto: 'Foto do kit', criada_em: iso(20) },
  { numero_id: 'n-des', id: 'm1', jid: '120@g.us', de_mim: true, tipo: 'texto', texto: '@221633885266163 achei que já havia enviado aqui', citada_id: 'q1', criada_em: iso(9), status: 'SERVER_ACK' }];
const CONTATOS = [{ jid: '221633885266163@lid', nome: 'Luana Felix Perdão' }];
const falhas = []; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas.push(m); };

const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function abrirCentral(viewport, rota = '#/whatsapp', papel = 'admin') {
  const ctx = await nav.newContext({ viewport, deviceScaleFactor: process.env.PRINT ? 2 : 1 });
  await ctx.route(/supabase\.co\//, async rota => {
    const url = new URL(rota.request().url()), req = rota.request();
    if (url.pathname.startsWith('/functions/v1/wa-evolution')) {
      const corpo = JSON.parse(req.postData() || '{}'); enviados.push(corpo);
      let r = { ok: true, lista: [] };
      if (corpo.acao === 'enviar_texto') r = { ok: true, id: 'x' + enviados.length };
      if (corpo.acao === 'numeros') r = { lista: NUMS.map(n => ({ ...n, estado: n.id === 'n-vid' ? 'open' : 'sem_conexao' })) };
      if (corpo.acao === 'estado') r = { configurado: true, existe: true, estado: corpo.numero === 'n-vid' || !corpo.numero ? 'open' : 'sem_conexao' };
      if (corpo.acao === 'conectar') r = { qr: 'data:image/png;base64,iVBORw0KGgo=', codigo: null };
      if (corpo.acao === 'grupo_dados') { await new Promise(r => setTimeout(r, DEMORA)); r = { grupo: { nome: 'Cliente Alfa (WhatsApp)', descricao: 'Grupo oficial do cliente', criado_wa: '2025-03-12T12:00:00Z', so_admins_enviam: false, so_admins_editam: true, membros_qtd: 3 },
        membros: [{ jid: '556211110000@s.whatsapp.net', telefone: '556211110000', admin: 'superadmin', nome: 'Ana Souza', b7: false, equipe: false },
          { jid: '777@lid', telefone: '556222220000', admin: null, nome: 'Pedro Equipe', b7: false, equipe: true },
          { jid: '556233330000@s.whatsapp.net', telefone: '556233330000', admin: 'admin', nome: null, b7: true, equipe: false }], b7_admin: true }; }
      if (corpo.acao === 'contato_perfil') r = { perfil: { nome: 'Ana Souza', recado: 'Disponível', telefone: '556211110000', comercial: true, descricao: 'Padaria', email: 'ana@exemplo.com' }, grupos: [{ numero_id: 'n-des', grupo_jid: '120@g.us', nome: 'Cliente Alfa · Design' }] };
      if (corpo.acao === 'grupo_membros') r = corpo.operacao ? { feito: corpo.participantes, falhou: [] } : { erro: 'Ação inválida.' };
      if (corpo.acao === 'numero_salvar') { const n = { id: 'n-coo', instancia: 'b7-coordenacao', padrao: false, ativo: true, ordem: 2, ...corpo }; delete n.acao; NUMS = NUMS.concat(n); r = { numero: n }; }
      return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const f = url.pathname.split('/rpc/')[1];
      return rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(f === 'pode_ver_wa' ? true : null) });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const t = url.pathname.split('/rest/v1/')[1].split('?')[0];
      const dados = t === 'wa_numeros' ? NUMS : t === 'wa_config' ? [{ id: 1, respostas: [], auto_arquivar_dias: 0, fotos_auto: true }] : t === 'wa_mensagens' ? MSGS.filter(m => !url.search.includes('jid=eq.') || url.search.includes('jid=eq.' + encodeURIComponent(m.jid)) || url.search.includes('jid=eq.' + m.jid)) : t === 'wa_contatos' ? CONTATOS : t === 'wa_conversas' ? CONVS.filter(c => NUMS.some(n => n.id === c.numero_id)) : [];
      const um = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      return rota.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/' + dados.length }, body: JSON.stringify(um ? (dados[0] || null) : dados) });
    }
    return rota.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => falhas.push('erro de JavaScript: ' + e.message));
  await pg.goto(BASE + '/index.html'); await pg.waitForTimeout(1200);
  await pg.evaluate(([r, papel]) => {
    const adm = papel === 'admin';
    const U = { id: 'u-teste', papel, nome: 'Yury Teste', username: 'teste', estado: 'ativa', preferencias: {}, empresas: [] };
    Object.assign(B7.Auth, { usuario: () => U, papel: () => papel, funcao: () => (adm ? null : papel), modulos: () => null, niveis: () => null, ehAdmin: () => adm, ehAdminReal: () => adm, ehEquipe: () => adm, ehCliente: () => false, funcoesExtra: () => [], naContaDeOutro: () => false, emSimulacao: () => false });
    document.querySelectorAll('.b7-abertura').forEach(e => e.remove());
    if (B7.montarShellInterno) B7.montarShellInterno();
    try { B7.pref.gravar('wa_num', 'todos'); } catch (e) {}
    location.hash = r;
  }, [rota, papel]);
  await pg.waitForSelector(rota === '#/whatsapp' ? '.wz-it' : papel === 'admin' ? '.cwa-num-l' : '.asw-nav', { timeout: 8000 }).catch(() => null);
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

{ NUMS = [VID, DES];
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 }, '#/whatsapp/config?aba=conexao');
  const linhas = await pg.$$eval('.cwa-num-l', l => l.map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(linhas.length === 2 && /Videomakers/.test(linhas[0]) && /Conectado/.test(linhas[0]) && /Designers/.test(linhas[1]) && /Desconectado/.test(linhas[1]), 'Configurações → Números lista os dois com o estado');
  ok(!(await pg.$('[data-num-l="n-vid"] [data-acao="n-desativar"]')) && !!(await pg.$('[data-num-l="n-des"] [data-acao="n-desativar"]')), 'o padrão não tem "Desativar"');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/config-numeros.png', import.meta.url)) });
  await pg.click('[data-acao="n-novo"]'); await pg.waitForSelector('#cwa-nf-nome');
  await pg.fill('#cwa-nf-nome', 'Coordenação'); await pg.click('.cwa-nf-eqs input[value="coordenador"]');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/config-novo.png', import.meta.url)) });
  await pg.click('#cwa-nf-ok'); await pg.waitForTimeout(1200);
  const sal = enviados.find(e => e.acao === 'numero_salvar');
  ok(sal && sal.nome === 'Coordenação' && JSON.stringify(sal.equipes) === '["coordenador"]' && /^#[0-9A-F]{6}$/i.test(sal.cor), 'salvar manda nome, cor e equipes');
  const tit = await pg.$eval('.wac h3', e => e.textContent).catch(() => '');
  ok(tit === 'WhatsApp · Coordenação', 'abre a conexão do número novo (' + tit + ')');
  ok(enviados.some(e => e.acao === 'estado' && e.numero === 'n-coo'), 'a conexão confere o estado DO número novo');
  await ctx.close(); }

{ NUMS = [VID, DES]; enviados.length = 0;
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 });
  await pg.evaluate(() => B7.WhatsApp.enviar({ tipo: 'aprovacao', clienteNome: 'Alfa', titulo: 'Post', link: 'https://x' }));
  await pg.waitForSelector('#wae-n', { timeout: 5000 }).catch(() => null);
  const ops = await pg.$$eval('#wae-c option', l => l.map(o => o.value).filter(Boolean)).catch(() => []);
  ok(!!(await pg.$('#wae-n')) && (await pg.$eval('#wae-n', e => e.value)) === 'n-vid' && ops.length === 1, 'Enviar no WhatsApp: admin começa no padrão, só com as conversas dele');
  await pg.selectOption('#wae-n', 'n-des');
  const ops2 = await pg.$$eval('#wae-c option', l => l.map(o => o.value).filter(Boolean));
  ok(ops2.length === 2, 'trocar para Designers mostra as conversas do Designers');
  await pg.selectOption('#wae-c', '120@g.us'); await pg.click('#wae-ok'); await pg.waitForTimeout(800);
  const e = enviados.find(x => x.acao === 'enviar_texto');
  ok(e && e.numero === 'n-des', 'o envio sai pelo número escolhido');
  await ctx.close(); }

{ /* 4.85.0: menção e citação como no WhatsApp; dados do grupo e perfil */
  NUMS = [VID, DES]; enviados.length = 0;
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 });
  await pg.click('.wz-it[data-num="n-des"][data-jid="120@g.us"]'); await pg.waitForTimeout(900);
  const mc = await pg.$eval('.wz-mc', e => ({ t: e.textContent, p: e.dataset.perfil })).catch(() => null);
  ok(mc && mc.t === '@Luana Felix Perdão' && mc.p === '221633885266163@lid', 'menção vira "@Nome" destacado (' + JSON.stringify(mc) + ')');
  const qa = await pg.$eval('.wz-q b', e => e.textContent).catch(() => '');
  ok(qa === 'Luana Felix Perdão', 'citação mostra o nome, não o código (' + qa + ')');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/mencao.png', import.meta.url)) });
  await pg.click('.wz-cab-nome'); await pg.waitForSelector('.wz-info-m', { timeout: 5000 }).catch(() => null);
  const info = await pg.$eval('.wz-info', e => e.innerText).catch(() => '');
  ok(/Dados do grupo/.test(info) && /Grupo oficial do cliente/.test(info) && /3 membros/.test(info), 'topo do grupo abre os dados');
  ok(/Equipe B7/.test(info) && /Número da B7/.test(info) && /Admin/.test(info), 'membros com os selos');
  ok(!!(await pg.$('.wz-info [data-info="add"]')) && !!(await pg.$('.wz-info [data-regra="so_admins_enviam"]:not([disabled])')), 'admin vê + Adicionar e as regras ligadas');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/dados-grupo.png', import.meta.url)) });
  await pg.click('.wz-info-m[data-m="556211110000@s.whatsapp.net"] [data-info="menu"]');
  await pg.click('.wz-info-menu [data-info="remove"]'); await pg.waitForSelector('.fundo-modal', { timeout: 3000 });
  await pg.click('.fundo-modal .acoes .b:last-child'); await pg.waitForTimeout(600);
  const rm = enviados.find(e => e.acao === 'grupo_membros');
  ok(rm && rm.operacao === 'remove' && rm.numero === 'n-des' && rm.jid === '120@g.us' && JSON.stringify(rm.participantes) === '["556211110000"]', 'remover confirma e manda grupo_membros (remove) pelo número da conversa');
  await pg.click('.wz-info-m[data-m="556211110000@s.whatsapp.net"] [data-info="perfil"]'); await pg.waitForTimeout(500);
  const pf = await pg.$eval('.wz-info', e => e.innerText).catch(() => '');
  ok(/Perfil do contato/.test(pf) && /Disponível/.test(pf) && /Padaria/.test(pf) && /Cliente Alfa · Design/.test(pf), 'perfil com recado, empresa e grupos em comum');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/perfil.png', import.meta.url)) });
  await pg.click('.wz-info [data-info="fechar"]');
  /* resposta atrasada não pinta o painel em outra conversa */
  DEMORA = 1200;
  await pg.click('.wz-cab-nome'); await pg.waitForTimeout(150);
  await pg.click('.wz-it[data-jid="5562999990000@s.whatsapp.net"]'); await pg.waitForTimeout(1600);
  ok(!(await pg.$('.wz-info')), 'trocar de conversa fecha o painel e a resposta velha não reaparece');
  DEMORA = 0;
  await ctx.close(); }

{ /* designer vê os dados do grupo, sem os botões de mexer */
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 }, '#/whatsapp', 'designer');
  await pg.click('.wz-it[data-num="n-des"][data-jid="120@g.us"]'); await pg.waitForTimeout(700);
  await pg.click('.wz-cab-nome'); await pg.waitForSelector('.wz-info-m', { timeout: 5000 }).catch(() => null);
  ok(!!(await pg.$('.wz-info-m')) && !(await pg.$('.wz-info [data-info="add"]')) && !(await pg.$('.wz-info [data-regra]')), 'designer vê os membros sem + Adicionar nem regras');
  await pg.click('.wz-info-m [data-info="menu"]');
  ok(!(await pg.$('.wz-info-menu [data-info="remove"]')), 'designer: menu do membro sem Remover');
  await ctx.close(); }

{ /* quem não é administrador: só as configurações pessoais; as da equipe (Números, Otto, grupos…) não aparecem */
  const { ctx, pg } = await abrirCentral({ width: 1360, height: 860 }, '#/whatsapp/config?aba=conexao', 'designer');
  if (process.env.PRINT) await pg.screenshot({ path: fileURLToPath(new URL('prints-wa/config-designer.png', import.meta.url)) });
  const abas = await pg.$$eval('.asw-nav [data-aba]', l => l.map(b => b.dataset.aba));
  ok(abas.length && abas.every(a => ['meu', 'modelos', 'respostas'].includes(a)), 'designer: só Meu jeito, Modelos e Respostas (' + abas.join(', ') + ')');
  ok(!(await pg.$('.cwa-num-l')) && !(await pg.$('[data-acao="n-novo"]')), 'designer: pedir ?aba=conexao não mostra os números');
  ok(!enviados.some(e => e.acao === 'numeros'), 'designer: a tela nem pede a lista de números ao servidor');
  await ctx.close(); }

await nav.close(); servidor.close();
if (falhas.length) { console.error('\n' + falhas.length + ' falha(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('Central com vários números: ok');
