/* Monta a cópia publicada do site em _site/ (GitHub Actions → Pages).
   • Só vai o que o site usa: nada de docs/, supabase/, testes/, app-*.
   • JS e CSS saem compactados (esbuild); o repositório continua legível.
   • js/vendor/ já vem compactado e é copiado como está. */
import { cp, mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { transform } from 'esbuild';

const RAIZ = new URL('../../', import.meta.url).pathname, SAIDA = join(RAIZ, '_site');
const ITENS = ['index.html', 'confirmar.html', 'google-retorno.html', 'privacidade.html', 'termos.html', 'legal.css', 'manifest.json', 'sw.js', '.nojekyll', 'assets', 'js', 'styles'];

await rm(SAIDA, { recursive: true, force: true }); await mkdir(SAIDA);
for (const i of ITENS) await cp(join(RAIZ, i), join(SAIDA, i), { recursive: true });

let antes = 0, depois = 0;
async function andar(dir) {
  for (const n of await readdir(dir)) {
    const p = join(dir, n), s = await stat(p);
    if (s.isDirectory()) { if (n !== 'vendor') await andar(p); continue; }
    const ext = extname(n); if (ext !== '.js' && ext !== '.css') continue;
    /* js/auth.js fica como está: o app, o site aberto e o Android leem dele
       a linha VERSAO = '…' para saber se há versão nova (compactar apagava) */
    if (p.endsWith('/js/auth.js')) continue;
    const fonte = await readFile(p, 'utf8');
    const r = await transform(fonte, { loader: ext.slice(1), minify: true, legalComments: 'none', target: 'es2022', charset: 'utf8' });
    await writeFile(p, r.code); antes += fonte.length; depois += r.code.length;
  }
}
await andar(join(SAIDA, 'js')); await andar(join(SAIDA, 'styles'));
const sw = join(SAIDA, 'sw.js'), swf = await readFile(sw, 'utf8');
const swr = await transform(swf, { loader: 'js', minify: true, legalComments: 'none', target: 'es2022', charset: 'utf8' }); await writeFile(sw, swr.code);
console.log('JS/CSS: ' + (antes / 1048576).toFixed(2) + ' MB → ' + (depois / 1048576).toFixed(2) + ' MB');
