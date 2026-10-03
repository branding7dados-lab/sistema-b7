/* Todo .js do sistema precisa ao menos compilar: um erro de sintaxe num
   arquivo derruba o app inteiro no celular de todo mundo. */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const arquivos = ['sw.js', ...(await readdir(RAIZ + 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
let ruins = 0;
for (const f of arquivos) {
  try { new vm.Script(await readFile(RAIZ + f, 'utf8'), { filename: f }); }
  catch (e) { ruins++; console.error('✗ ' + f + ': ' + e.message); }
}
/* o service worker precisa listar arquivos que existem */
const sw = await readFile(RAIZ + 'sw.js', 'utf8');
for (const [, p] of sw.matchAll(/'\.\/([^']+\.(?:js|css|html|png|woff2|json))'/g)) {
  try { await readFile(RAIZ + p); } catch (e) { ruins++; console.error('✗ sw.js lista um arquivo que não existe: ' + p); }
}
if (ruins) process.exit(1);
console.log('✓ sintaxe de ' + arquivos.length + ' arquivos e lista do service worker');
