/* Rede de segurança do .github/workflows/desktop.yml: se por algum motivo
   o electron-builder não escrever o latest.yml (o arquivo que o programa
   instalado lê para saber se há versão nova), ele é escrito aqui a partir
   do instalador que acabou de sair. Mesmo formato do electron-builder. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* fileURLToPath e não .pathname: no Windows o pathname vem "/D:/..." e o
   join devolvia "D:\D:\..." (foi o que quebrou a primeira montagem) */
const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, 'dist');
const arquivos = await readdir(DIST);
if (arquivos.includes('latest.yml')) {
  console.log('latest.yml já veio do electron-builder');
  process.exit(0);
}
const exe = arquivos.find(a => /^sistema-b7-setup-.*\.exe$/.test(a));
if (!exe) { console.error('não achei o instalador em dist/'); process.exit(1); }
const versao = JSON.parse(await readFile(join(AQUI, 'package.json'), 'utf8')).version;
const bin = await readFile(join(DIST, exe));
const sha512 = createHash('sha512').update(bin).digest('base64');
const { size } = await stat(join(DIST, exe));
await writeFile(join(DIST, 'latest.yml'),
  'version: ' + versao + '\n' +
  'files:\n' +
  '  - url: ' + exe + '\n' +
  '    sha512: ' + sha512 + '\n' +
  '    size: ' + size + '\n' +
  'path: ' + exe + '\n' +
  'sha512: ' + sha512 + '\n' +
  'releaseDate: ' + new Date().toISOString() + '\n');
console.log('latest.yml escrito à mão para ' + exe);
