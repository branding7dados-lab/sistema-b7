/* Regras da memória de dados (js/memoria.js), sem navegador */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const codigo = await readFile(fileURLToPath(new URL('../js/memoria.js', import.meta.url)), 'utf8');

globalThis.window = globalThis;
globalThis.location = { hash: '#/clientes' };
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, activeElement: null, hidden: false };
globalThis.requestAnimationFrame = f => f(); globalThis.scrollTo = () => {}; globalThis.scrollY = 0;
let n = 0, valor = [1, 2], redesenhos = 0;
globalThis.B7 = {
  Auth: { usuario: () => ({ id: 'u1', papel: 'admin' }) },
  Rota: { ir() { redesenhos++; } },
  DB: {
    async listarClientes() { n++; await new Promise(r => setTimeout(r, 40)); return structuredClone(valor); },
    async criarCliente() { valor = [...valor, 3]; return {}; },
    async roteiro() { n++; return 'texto'; }
  }
};
(0, eval)(codigo);
const t = async f => { const s = Date.now(); const r = await f(); return [r, Date.now() - s]; };

let [r, ms] = await t(() => B7.DB.listarClientes());
assert.deepEqual(r, [1, 2]); assert.equal(n, 1);
[r, ms] = await t(() => B7.DB.listarClientes());
assert.equal(n, 1, 'leitura recente não volta ao banco'); assert.ok(ms < 10);
await B7.DB.criarCliente();
[r, ms] = await t(() => B7.DB.listarClientes());
assert.deepEqual(r, [1, 2, 3], 'depois de uma escrita, espera o banco'); assert.ok(ms >= 35);
r.push(99);
assert.deepEqual(await B7.DB.listarClientes(), [1, 2, 3], 'quem mexe no resultado não estraga a memória');
B7.Memoria._mapa.forEach(e => { e.t -= 60000; });
valor = [7];
[r, ms] = await t(() => B7.DB.listarClientes());
assert.deepEqual(r, [1, 2, 3], 'resposta antiga sai na hora'); assert.ok(ms < 10);
await new Promise(r => setTimeout(r, 300));
assert.equal(redesenhos, 1, 'resposta nova redesenha a tela');
assert.deepEqual(await B7.DB.listarClientes(), [7]);
/* zzz8: passada a janela de uma escrita, o que ficou guardado volta a abrir na hora */
await B7.DB.criarCliente();
const agoraReal = Date.now; Date.now = () => agoraReal() + 10000;
B7.Memoria._mapa.forEach(e => { e.t -= 60000; });
[r, ms] = await t(() => B7.DB.listarClientes());
assert.ok(ms < 10, 'depois da janela de escrita, abre na hora');
Date.now = agoraReal;
await new Promise(r => setTimeout(r, 100));
n = 0; await B7.DB.roteiro(); await B7.DB.roteiro();
assert.equal(n, 2, 'roteiro (editor) nunca vem da memória');
B7.Auth.usuario = () => null; n = 0; await B7.DB.listarClientes();
assert.equal(n, 1, 'sem login, sem memória');
console.log('✓ memória de dados');
process.exit(0);
