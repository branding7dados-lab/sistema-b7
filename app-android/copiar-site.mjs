/* Copia as telas do sistema para www/, que vai dentro do APK.
   Só o que o index.html usa: nada de relatórios, SQL, testes ou funções do
   Supabase. sw.js fica de fora: dentro do app as telas já estão no aparelho. */
import { cp, rm, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const WWW = fileURLToPath(new URL('./www/', import.meta.url));

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });
for (const item of ['index.html', 'manifest.json', 'js', 'styles', 'assets']) {
  await cp(RAIZ + item, WWW + item, { recursive: true });
}
const auth = await readFile(RAIZ + 'js/auth.js', 'utf8');
const versao = (/VERSAO\s*=\s*'([^']+)'/.exec(auth) || [])[1] || 'dev';
console.log('✓ telas copiadas para www/ (versão ' + versao + ')');
