/* Copia as telas do sistema para www/, que vai dentro do APK.
   Só o que o index.html usa: nada de relatórios, SQL, testes ou funções do
   Supabase. sw.js fica de fora: dentro do app as telas já estão no aparelho. */
import { cp, rm, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const WWW = fileURLToPath(new URL('./www/', import.meta.url));

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });
for (const item of ['index.html', 'manifest.json', 'js', 'styles', 'assets']) {
  await cp(RAIZ + item, WWW + item, { recursive: true });
}
/* dentro do app a marca vai em alta resolução (3×, mesma proporção do site):
   nítida em tela de celular de alta densidade. No site fica a leve. */
await cp(fileURLToPath(new URL('./hd/brand/', import.meta.url)), WWW + 'assets/brand/', { recursive: true });
/* zzz259: dentro do APK o código vai compactado (sem comentários nem
   espaços): o celular lê bem menos texto ao abrir, e a abertura começa
   antes. Cada arquivo continua separado e com os mesmos nomes globais
   (só minificação, sem juntar arquivos). O site continua com o original. */
const { transform } = await import('esbuild');
let antes = 0, depois = 0;
for (const pasta of ['js', 'styles']) {
  for (const nome of await readdir(WWW + pasta, { recursive: true })) {
    const tipo = nome.endsWith('.js') ? 'js' : nome.endsWith('.css') ? 'css' : null;
    if (!tipo) continue;
    const arq = WWW + pasta + '/' + nome;
    const orig = await readFile(arq, 'utf8');
    const r = await transform(orig, { loader: tipo, minify: true, target: tipo === 'js' ? 'es2020' : 'chrome90', legalComments: 'none', charset: 'utf8' });
    await writeFile(arq, r.code);
    antes += Buffer.byteLength(orig); depois += Buffer.byteLength(r.code);
  }
}
console.log('✓ código compactado: ' + (antes / 1048576).toFixed(1) + ' MB → ' + (depois / 1048576).toFixed(1) + ' MB');
const auth = await readFile(RAIZ + 'js/auth.js', 'utf8');
const versao = (/VERSAO\s*=\s*'([^']+)'/.exec(auth) || [])[1] || 'dev';
console.log('✓ telas copiadas para www/ (versão ' + versao + ')');
