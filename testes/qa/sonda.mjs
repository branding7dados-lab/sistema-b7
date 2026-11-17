import { navegador, abrirPagina, entrar, linksDaTela, olharTela, CARGOS } from './comum.mjs';
const nav = await navegador();
const SAIDA = process.env.QA_SAIDA || '/tmp';
for (const cargo of (process.argv[2] ? [process.argv[2]] : CARGOS)) {
  const { ctx, pg, problemas } = await abrirPagina(nav);
  try { await entrar(pg, cargo); } catch (e) { console.log(cargo, 'NÃO ENTROU:', e.message); await pg.screenshot({ path: SAIDA + '/entrar-' + cargo + '.png' }); await ctx.close(); continue; }
  await pg.screenshot({ path: SAIDA + '/casa-' + cargo + '.png' });
  console.log('==', cargo, 'hash', await pg.evaluate(() => location.hash), '| links:', (await linksDaTela(pg)).join(' '));
  console.log('   tela:', JSON.stringify(await olharTela(pg)), '| problemas:', problemas.length, problemas.slice(0, 4).map(p => p.tipo + ': ' + p.texto.slice(0, 120)).join(' || '));
  await ctx.close();
}
await nav.close();
