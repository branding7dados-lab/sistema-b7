/* QA 1 — VARREDURA: entra com cada cargo e abre TODAS as telas que o menu dele mostra (e as abas/links de dentro
   delas, até 2 níveis), no computador e no celular. Em cada tela anota: erro de JavaScript, erro no console,
   pedido ao servidor que falhou, tela em branco, "undefined/NaN" na tela, mensagem de erro, rolagem para o lado,
   imagem quebrada e tempo para abrir. Também confere se cada cargo NÃO abre o que não é dele.
   Uso: QA_SENHA_ARQ=… node qa/varredura.mjs [cargo…]   → relatório em $QA_SAIDA/varredura.json (+ prints dos problemas) */
import { writeFileSync, mkdirSync } from 'node:fs';
import { navegador, abrirPagina, entrar, ir, olharTela, linksDaTela, CARGOS } from './comum.mjs';

const SAIDA = process.env.QA_SAIDA || '/tmp/qa';
mkdirSync(SAIDA + '/prints', { recursive: true });
const CLIENTE_QA = 'fdd4aff8-b62a-446f-9f3a-f2ff1057082d';
const MAX = Number(process.env.QA_MAX || 60);

/* rotas que só alguns cargos podem abrir: o cargo errado tem que ver "sem acesso", nunca a tela */
const SO_GESTAO = ['#/usuarios', '#/gestao', '#/lixeira', '#/site', '#/super'];   /* #/config é "Sua conta": todo mundo abre */
const SO_EQUIPE = ['#/clientes', '#/kanban', '#/video', '#/gravacoes', '#/whatsapp', '#/painel'];

const normal = (r) => {
  if (!r || !r.startsWith('#/')) return null;
  if (/sair|logout/.test(r)) return null;
  const m = r.match(/^#\/cliente\/([0-9a-f-]{36})/);
  if (m && m[1] !== CLIENTE_QA) return null;           /* clientes de verdade: só o de teste (e um real abaixo) */
  return r;
};

const resultado = { quando: new Date().toISOString(), base: process.env.QA_URL || 'https://sistema.branding7.com.br', cargos: {} };
const nav = await navegador();
for (const cargo of (process.argv.slice(2).length ? process.argv.slice(2) : CARGOS)) {
  for (const celular of [false, true]) {
    const chave = cargo + (celular ? '-celular' : '');
    const { ctx, pg, problemas, setRota } = await abrirPagina(nav, { celular });
    const telas = [];
    try { await entrar(pg, cargo); }
    catch (e) { resultado.cargos[chave] = { erro: 'não entrou: ' + e.message }; await pg.screenshot({ path: SAIDA + '/prints/' + chave + '-login.png' }); await ctx.close(); continue; }
    const fila = [...new Set(['#/', ...(await linksDaTela(pg)).map(normal).filter(Boolean)])];
    if (cargo !== 'cliente') fila.push('#/cliente/' + CLIENTE_QA);
    const vistos = new Set();
    /* telas do mesmo tipo (#/linha/<id>, #/gravacao/<id>…): 2 de cada bastam */
    const porTipo = new Map();
    const tipoDe = (r) => r.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, ':id').replace(/\?.*$/, '');
    const cabe = (r) => { const t = tipoDe(r); if (!/:id/.test(t)) return true; const n = porTipo.get(t) || 0; if (n >= 2) return false; porTipo.set(t, n + 1); return true; };
    while (fila.length && vistos.size < (celular ? Math.min(25, MAX) : MAX)) {
      const rota = fila.shift();
      if (vistos.has(rota) || !cabe(rota)) continue;
      vistos.add(rota);
      setRota(rota);
      const antes = problemas.length, t0 = Date.now();
      await ir(pg, rota);
      const ms = Date.now() - t0;
      if (ms > 6000) problemas.push({ rota, tipo: 'lento', texto: 'levou ' + (ms / 1000).toFixed(1) + ' s para abrir' });
      const tela = await olharTela(pg).catch(e => ['não deu para ler a tela: ' + e.message]);
      const novos = problemas.slice(antes);
      const hashFinal = await pg.evaluate(() => location.hash);
      const item = { rota, foiPara: hashFinal !== rota ? hashFinal : undefined, ms, tela, problemas: novos };
      if (tela.length || novos.length) await pg.screenshot({ path: SAIDA + '/prints/' + chave + '-' + rota.replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.png' }).catch(() => {});
      telas.push(item);
      /* abas e links de dentro (só no computador; 2º nível) */
      if (!celular && rota.split('/').length <= 3) for (const l of (await linksDaTela(pg)).map(normal).filter(Boolean)) if (!vistos.has(l) && !fila.includes(l)) fila.push(l);
    }
    /* o que este cargo não pode abrir */
    const barrado = [];
    if (!celular) {
      const proibidas = cargo === 'admin' ? [] : cargo === 'cliente' ? [...SO_GESTAO, ...SO_EQUIPE] : SO_GESTAO;
      for (const r of proibidas) {
        if (vistos.has(r)) continue;
        setRota('(proibida) ' + r);
        await ir(pg, r, 1800);
        const info = await pg.evaluate(() => ({ hash: location.hash, texto: (document.querySelector('#painel-dashboard, main') || document.body).innerText.slice(0, 300) }));
        const negou = info.hash !== r || /sem acesso|não tem acesso|acesso restrito|sem permissão|não autorizado|pedir acesso/i.test(info.texto);
        barrado.push({ rota: r, negou, foiPara: info.hash, trecho: negou ? undefined : info.texto.slice(0, 160) });
      }
    }
    resultado.cargos[chave] = { telas, barrado, problemasFora: problemas.filter(p => !telas.some(t => t.problemas.includes(p))) };
    console.log(chave, '→', telas.length, 'telas,', telas.filter(t => t.tela.length || t.problemas.length).length, 'com problema', barrado.filter(b => !b.negou).length ? '| ⚠ abriu proibida: ' + barrado.filter(b => !b.negou).map(b => b.rota).join(' ') : '');
    await ctx.close();
  }
}
await nav.close();
writeFileSync(SAIDA + '/varredura.json', JSON.stringify(resultado, null, 1));
console.log('relatório:', SAIDA + '/varredura.json');
