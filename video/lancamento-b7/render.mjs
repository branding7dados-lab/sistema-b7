/* Renderiza o vídeo quadro a quadro com o Chromium (Playwright) e codifica com ffmpeg.

   node render.mjs                     → saida/b7-lancamento-9x16.mp4 (+ versão sem som)
   node render.mjs --frames 1.5,10,33  → só PNGs desses instantes em saida/quadros/
   node render.mjs --workers 4         → paralelismo (padrão: núcleos da máquina)
   node render.mjs --mixar             → só refaz o áudio (trilha + narração) sobre o vídeo sem som
*/
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir, rm, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const SAIDA = path.join(AQUI, 'saida');
const FPS = 30, DURACAO = 64;
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const p = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(RAIZ)) throw new Error('fora');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_ = `http://127.0.0.1:${server.address().port}/video/lancamento-b7/index.html`;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
async function abrir() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('erro na página:', e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.READY || window.BOOT_ERROR, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.BOOT_ERROR);
  if (err) throw new Error(err);
  return page;
}
async function quadro(page, t, arquivo) {
  await page.evaluate(t => window.renderAt(t), t);
  await page.screenshot({ path: arquivo, type: 'png', animations: 'disabled', caret: 'initial' });
}

const ff = (a) => new Promise((ok, no) => { const p = spawn('ffmpeg', a, { stdio: 'inherit' }); p.on('exit', c => c ? no(new Error('ffmpeg ' + c)) : ok()); });
const existe = async f => { try { await readFile(f); return true; } catch { return false; } };
/* junta imagem + trilha/efeitos + narração. A trilha abaixa sozinha (sidechain)
   enquanto a voz fala; o resultado sai em -14 LUFS, padrão das redes. */
async function mixar() {
  const mudo = path.join(SAIDA, 'b7-lancamento-9x16-sem-som.mp4');
  const trilha = path.join(SAIDA, 'trilha-sfx.wav'), voz = path.join(SAIDA, 'narracao.wav');
  if (!await existe(trilha)) { console.log('(sem trilha: rode node audio.mjs antes)'); return; }
  const comVoz = await existe(voz);
  const filtro = comVoz
    ? '[2:a]highpass=f=80,equalizer=f=3200:t=q:w=1.2:g=3,acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=2,' +
      'aecho=0.8:0.6:28|52:0.07|0.04,aformat=channel_layouts=stereo,asplit=2[v][vsc];' +
      '[1:a][vsc]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=450[duck];[duck]volume=0.8[m];' +
      '[m][v]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]'
    : '[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]';
  await ff(['-y', '-v', 'error', '-i', mudo, '-i', trilha, ...(comVoz ? ['-i', voz] : []), '-filter_complex', filtro,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart',
    path.join(SAIDA, 'b7-lancamento-9x16.mp4')]);
  console.log(comVoz ? 'mixado com narração' : 'mixado sem narração');
}

const so = arg('--frames');
if (args.includes('--mixar')) {
  await mixar();
} else if (so) {
  const dir = path.join(SAIDA, 'quadros'); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const page = await abrir();
  for (const s of so.split(',')) { const t = parseFloat(s); await quadro(page, t, path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`)); }
  console.log('ok', dir);
} else {
  const total = Math.round(FPS * DURACAO);
  const dir = path.join(SAIDA, 'tmp'); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const workers = +arg('--workers', os.cpus().length);
  let prox = 0, feitos = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => {
    const page = await abrir();
    while (prox < total) {
      const f = prox++;
      await quadro(page, f / FPS, path.join(dir, `f${String(f).padStart(5, '0')}.png`));
      if (++feitos % 60 === 0) process.stdout.write(`\r${feitos}/${total} quadros · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  console.log(`\n${(await readdir(dir)).length} quadros prontos`);
  const mudo = path.join(SAIDA, 'b7-lancamento-9x16-sem-som.mp4');
  await ff(['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', mudo]);
  await mixar();
  await rm(dir, { recursive: true, force: true });
  console.log('pronto em', SAIDA);
}
await browser.close();
server.close();
