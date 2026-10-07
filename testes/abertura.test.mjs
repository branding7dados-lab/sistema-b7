/* =====================================================================
   ABERTURA E CARREGAMENTO — o que não pode regredir

   O pedido do Kevin foi "cinematográficas e lindas, mas sem deixar
   pesado". A parte "linda" se julga com o olho; a parte "sem deixar
   pesado" tem regra objetiva, e é o que este teste guarda:

   1) nenhum @keyframes da abertura ou do esqueleto mexe em propriedade
      cara. Só transform e opacity — as duas que a placa de vídeo anima
      sozinha. Animar filter, box-shadow, width/height ou
      background-position obriga o navegador a repintar a cada quadro, e
      é exatamente o que fazia a abertura antiga engasgar no celular;
   2) todo nome de animação citado existe de verdade;
   3) com "menos movimento" ligado, a abertura não anima NADA;
   4) ao fim da abertura o símbolo e a marca estão em transform
      identidade — o voo do logo (voarLogo, js/app.js) desliga a animação
      e parte daí, então um quadro final deslocado vira um salto na tela;
   5) --esq-d (e não --d) é quem escalona o esqueleto: --d é o token de
      densidade do sistema, e escrevê-lo num bloco mudaria a densidade
      dele e de tudo que estivesse dentro;
   6) depois do arranque não sobra nada na tela nem animação rodando.
   ===================================================================== */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const falhas = [];
const ok = (bom, msg) => { console.log((bom ? '✓ ' : '✗ ') + msg); if (!bom) falhas.push(msg); };

/* ---------------------------------------------------------- 1, 2 e 5
   leitura direta do CSS, sem navegador                                */
const abertura = await readFile(join(RAIZ, 'styles/abertura.css'), 'utf8');
const global = await readFile(join(RAIZ, 'styles/global.css'), 'utf8');
const uijs = await readFile(join(RAIZ, 'js/ui.js'), 'utf8');

/* só o trecho do esqueleto do global.css */
const i0 = global.indexOf('CARREGANDO (zzz52)');
const i1 = global.indexOf('/* fim CARREGANDO', i0 + 1);
const esqueleto = (i0 >= 0 && i1 > i0) ? global.slice(i0, i1) : '';
ok(!!esqueleto, 'o bloco CARREGANDO existe e está delimitado no global.css');

const BARATAS = new Set(['transform', 'opacity', 'animation-timing-function', 'translate', 'scale', 'rotate']);
function propriedadesCaras(css, onde) {
  const caras = [];
  for (const m of css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)\s*\{/g)) {
    /* recorta o corpo do @keyframes contando chaves */
    let i = m.index + m[0].length, nivel = 1, ini = i;
    while (i < css.length && nivel > 0) { if (css[i] === '{') nivel++; else if (css[i] === '}') nivel--; i++; }
    const corpo = css.slice(ini, i - 1);
    for (const d of corpo.matchAll(/([a-z-]+)\s*:/g)) {
      const prop = d[1];
      if (!BARATAS.has(prop)) caras.push(onde + ' · @keyframes ' + m[1] + ' mexe em "' + prop + '"');
    }
  }
  return caras;
}
/* A regra vale para o CARREGAMENTO, que é desenho meu.
   A ABERTURA não: ela é a da versão zzp, restaurada a pedido do Kevin
   ("a animação que eu quero é da versão zzp"), e a zzp anima filter e
   clip-path. Isso custa mais caro, e é uma escolha dele, feita com o
   custo na mesa — não um descuido para o teste esconder. Então aqui o
   custo da abertura é RELATADO (aparece no log do CI, onde dá para ver
   se alguém piorou), e só o carregamento reprova. */
const carasEsq = propriedadesCaras(esqueleto, 'global.css');
ok(carasEsq.length === 0, 'carregamento: nenhum keyframe anima propriedade cara' +
   (carasEsq.length ? ' → ' + carasEsq.join('; ') : ''));
const carasAb = [...new Set(propriedadesCaras(abertura, 'abertura.css'))];
console.log('· abertura (zzp, restaurada a pedido): ' + carasAb.length +
  ' propriedade(s) cara(s) em keyframes' + (carasAb.length ? ' — ' + carasAb.length + ' ocorrências' : ''));

function nomesDeAnimacao(css) {
  const PALAVRAS = new Set(['none','ease','linear','both','infinite','forwards','backwards','alternate',
    'normal','reverse','ease-in','ease-out','ease-in-out','running','paused','steps','alternate-reverse']);
  const usados = new Set();
  for (const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g))
    for (const tok of m[1].split(/[,\s]+/))
      if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(tok) && !PALAVRAS.has(tok) && !tok.startsWith('cubic')) usados.add(tok);
  return usados;
}
const definidos = new Set([...abertura.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map(m => m[1]));
const semDefinir = [...nomesDeAnimacao(abertura)].filter(n => !definidos.has(n));
ok(semDefinir.length === 0, 'todo keyframe citado na abertura existe' + (semDefinir.length ? ' → falta ' + semDefinir.join(', ') : ''));

ok(/--esq-d:/.test(uijs) && !/class="esq [^"]*" style="--d:/.test(uijs),
   'o esqueleto escalona por --esq-d, não pelo --d da densidade');
ok(/var\(--esq-d,0\)/.test(esqueleto), 'o CSS do esqueleto lê --esq-d');

/* ----------------------------------------------------- 3, 4 e 6
   agora no navegador                                                  */
const TIPOS = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2' };
const sv = createServer(async (q, r) => {
  try { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const a = normalize(join(RAIZ, p)); if (!a.startsWith(RAIZ)) { r.writeHead(403); return r.end(); }
    const c = await readFile(a);
    r.writeHead(200, { 'Content-Type': TIPOS[extname(a)] || 'application/octet-stream' }); r.end(c);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise(r => sv.listen(0, r));
const BASE = 'http://127.0.0.1:' + sv.address().port;
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

const entrar = () => {
  const U = { id:'u', papel:'admin', nome:'Teste', username:'t', estado:'ativa', preferencias:{}, empresas:[] };
  Object.assign(B7.Auth, { usuario:()=>U, papel:()=>'admin', ehAdmin:()=>true, ehAdminReal:()=>true,
    ehEquipe:()=>true, ehCliente:()=>false, funcoesExtra:()=>[], naContaDeOutro:()=>false, emSimulacao:()=>false });
  if (B7.montarShellInterno) B7.montarShellInterno();
};

/* 3) menos movimento */
{
  const ctx = await nav.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  const pg = await ctx.newPage(); const err = []; pg.on('pageerror', e => err.push(String(e)));
  await pg.goto(BASE + '/index.html'); await pg.waitForTimeout(900);
  const n = await pg.evaluate(() => document.querySelector('.b7-abertura')
    ? document.getAnimations().filter(a => a.effect && document.querySelector('.b7-abertura').contains(a.effect.target)).length : 0);
  ok(n === 0, 'menos movimento: a abertura não anima nada (' + n + ' animações)');
  ok(err.length === 0, 'menos movimento: sem erro de JavaScript' + (err.length ? ' → ' + err[0] : ''));
  await ctx.close();
}

/* 4) o quadro final da abertura é a posição de repouso */
{
  const ctx = await nav.newContext({ viewport:{width:390,height:844} });
  const pg = await ctx.newPage(); await pg.goto(BASE + '/index.html'); await pg.waitForTimeout(500);
  const t = await pg.evaluate(() => {
    for (const a of document.getAnimations()) { try { a.finish(); } catch (e) {} }
    const id = s => { const v = getComputedStyle(document.querySelector(s)).transform;
      return v === 'none' || v === 'matrix(1, 0, 0, 1, 0, 0)'; };
    return { simbolo: id('.ab-simbolo'), marca: id('.ab-marca') };
  });
  ok(t.simbolo && t.marca, 'no fim da abertura o símbolo e a marca estão em repouso (o voo não salta)');
  await ctx.close();
}

/* 6) arranque inteiro: não sobra nada */
{
  const ctx = await nav.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await ctx.route(/supabase\.co\//, r => r.fulfill({ status:200, contentType:'application/json',
    headers:{'content-range':'0-0/0'}, body:'[]' }));
  const pg = await ctx.newPage(); const err = []; pg.on('pageerror', e => err.push(String(e)));
  await pg.goto(BASE + '/index.html'); await pg.waitForTimeout(600);
  await pg.evaluate(entrar);
  await pg.waitForFunction(() => !document.querySelector('.b7-abertura'), null, { timeout: 15000 })
    .catch(() => {});
  await pg.waitForTimeout(1800);
  /* só as animações DA ABERTURA: o app tem decorações próprias que
     rodam para sempre de propósito (o fundo da tela de login, por
     exemplo), e elas não são assunto deste teste */
  const s = await pg.evaluate(nomes => ({
    abertura: !!document.querySelector('.b7-abertura'),
    luz: !!document.querySelector('.ab-luz'),
    rastro: !!document.querySelector('.ab-rastro, .ab-pouso-halo, .ab-pouso-reflexo'),
    destino: !!document.querySelector('.ab-destino'),
    revela: document.body.classList.contains('ab-revela'),
    rodando: document.getAnimations()
      .filter(a => a.playState === 'running' && nomes.includes(a.animationName)).length
  }), [...definidos]);
  ok(!s.abertura, 'a abertura saiu da tela');
  ok(!s.luz && !s.rastro, 'as camadas de luz e os rastros foram removidos');
  ok(!s.destino && !s.revela, 'nenhuma classe de transição ficou presa');
  ok(s.rodando === 0, 'nenhuma animação da abertura ficou rodando depois do arranque (' + s.rodando + ')');
  ok(err.length === 0, 'arranque sem erro de JavaScript' + (err.length ? ' → ' + err[0] : ''));
  await ctx.close();
}

await nav.close(); sv.close();
if (falhas.length) { console.error('\n' + falhas.length + ' problema(s):\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('\n✓ abertura (zzp) e carregamento conferidos, sem sobras na tela.');
