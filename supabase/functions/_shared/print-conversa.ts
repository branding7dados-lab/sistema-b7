// =====================================================================
// "Print" de uma conversa do WhatsApp (4.59.9)
// O Otto monta uma imagem no jeito do WhatsApp (tema escuro) com as
// últimas mensagens de um grupo/conversa e manda no grupo da equipe:
// "Otto, manda o print da conversa da Sabor da Feira".
// Desenho em SVG → PNG com resvg (wasm), fontes Inter já embutidas.
// 4.66.1: emojis da Apple — cada emoji vira um caractere de marcação (uso privado),
// ocupa o espaço certo na quebra de linha e é desenhado como imagem (assets/emoji/png).
// =====================================================================
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';
import { INTER_400, INTER_600 } from './fontes-b7.ts';
import opentype from 'npm:opentype.js@1.3.4';

let pronto: Promise<void> | null = null;
const bin = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
let fontes: Uint8Array[] | null = null;
async function iniciar() {
  pronto ||= initWasm(fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm')).catch(e => { pronto = null; throw e; });
  await pronto;
  fontes ||= [bin(INTER_400), bin(INTER_600)];
  fonteR ||= opentype.parse(fontes[0].slice().buffer);
  fonteN ||= opentype.parse(fontes[1].slice().buffer);
}

export type MsgPrint = {
  de_mim: boolean; autor_nome?: string | null; enviada_por_nome?: string | null; tipo: string; texto?: string | null;
  criada_em: string; foto?: string | null; duracao?: number | null; midia_nome?: string | null; miniatura?: string | null; citada_previa?: string | null; citada_autor?: string | null; do_assistente?: boolean;
};

const L = 720, PAD = 14, BMAX = 520, FS = 15, LH = 20;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* emojis: cada um vira um caractere de uso privado (U+F0000+n) ligado à imagem da Apple */
const EMOJI_BASE = (Deno.env.get('B7_EMOJI_BASE') || 'https://sistema.branding7.com.br/assets/emoji/png/');
const PUA0 = 0xF0000;
let emojiChaves: string[] = [];                      /* índice → "1f44d-1f3fd" */
const emojiImg = new Map<string, string | null>();  /* chave → data URI (cache entre prints) */
const ehPUA = (c: string) => { const k = c.codePointAt(0) || 0; return k >= PUA0 && k < PUA0 + 0xFFFD; };
const segm = new Intl.Segmenter('pt', { granularity: 'grapheme' });
const EH_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
function marcarEmojis(s: string): string {
  let out = '';
  for (const { segment } of segm.segment(String(s || ''))) {
    if (!EH_EMOJI.test(segment)) { out += segment; continue; }
    const chave = [...segment].map(c => (c.codePointAt(0) || 0)).filter(k => k !== 0xFE0F).map(k => k.toString(16)).join('-');
    let i = emojiChaves.indexOf(chave); if (i < 0) { i = emojiChaves.length; emojiChaves.push(chave); }
    out += String.fromCodePoint(PUA0 + i);
  }
  return out;
}
async function carregarEmojis(): Promise<void> {
  await Promise.all(emojiChaves.filter(k => !emojiImg.has(k)).map(async k => {
    for (const tent of [k, k.split('-')[0]]) {
      try {
        const r = await fetch(EMOJI_BASE + tent + '.png', { signal: AbortSignal.timeout(6000) });
        if (!r.ok) continue;
        const u = new Uint8Array(await r.arrayBuffer()); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode(...u.subarray(i, i + 0x8000));
        emojiImg.set(k, 'data:image/png;base64,' + btoa(b)); return;
      } catch (_e) { /* tenta o próximo */ }
    }
    emojiImg.set(k, null);
  }));
}
/* tira o que a fonte não tem (senão vira quadradinho); mantém os emojis marcados */
const semEmoji = (s: string) => {
  let t = marcarEmojis(String(s || '')).replace(/[\u{FE0E}\u{FE0F}\u{200D}]/gu, '');
  if (fonteR) t = [...t].filter(c => c === '\n' || c === ' ' || c === '\t' || ehPUA(c) || fonteR.charToGlyphIndex(c) > 0).join('');
  return t.replace(/[ \t]{2,}/g, ' ');
};
/* uma linha: texto em <text> e cada emoji como <image>, lado a lado */
function linhaSVG(l: string, x: number, y: number, fs: number, attrs: string, peso = 400): string {
  let out = '', cx = x, buf = '';
  const solta = () => { if (buf) { out += `<text x="${cx.toFixed(1)}" y="${y}" font-size="${fs}"${peso >= 600 ? ' font-weight="600"' : ''} ${attrs} xml:space="preserve">${esc(buf)}</text>`; cx += largura(buf, fs, peso); buf = ''; } };
  for (const c of [...l]) {
    if (!ehPUA(c)) { buf += c; continue; }
    solta();
    const src = emojiImg.get(emojiChaves[(c.codePointAt(0) || 0) - PUA0]);
    const t = fs * 1.2;
    if (src) out += `<image href="${src}" x="${(cx + fs * 0.05).toFixed(1)}" y="${(y - fs * 0.98).toFixed(1)}" width="${t.toFixed(1)}" height="${t.toFixed(1)}"/>`;
    cx += t + fs * 0.1;
  }
  solta();
  return out;
}
const CORES = ['#53bdeb', '#f15c6d', '#06cf9c', '#ffbc38', '#a5b337', '#e26ab6', '#00a884', '#fc9775', '#9de1fe', '#c4a7f4'];
const corDe = (n: string) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };

/* largura do texto medida com a própria fonte (opentype.js) */
let fonteR: any = null, fonteN: any = null;
function largura(t: string, fs = FS, peso = 400): number {
  const f = peso >= 600 ? fonteN : fonteR;
  let n = 0; const resto = [...t].filter(c => { if (ehPUA(c)) { n++; return false; } return true; }).join('');
  return n * fs * 1.3 + (f ? f.getAdvanceWidth(resto, fs, { kerning: true }) : resto.length * fs * 0.56);
}
function quebrar(t: string, max: number, fs = FS): string[] {
  const out: string[] = [];
  for (const par of String(t || '').split('\n')) {
    let linha = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const tenta = linha ? linha + ' ' + p : p;
      if (largura(tenta, fs) <= max) { linha = tenta; continue; }
      if (linha) out.push(linha);
      /* palavra maior que a linha: corta */
      let resto = p;
      while (largura(resto, fs) > max) { let k = resto.length; while (k > 1 && largura(resto.slice(0, k), fs) > max) k--; out.push(resto.slice(0, k)); resto = resto.slice(k); }
      linha = resto;
    }
    out.push(linha);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out.length ? out : [''];
}
const hm = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600_000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const dia = (iso: string) => { const d = new Date(new Date(iso).getTime() - 3 * 3600_000); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear(); };
const mmss = (s?: number | null) => s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '';
function iniciais(n: string) { return semEmoji(n).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?'; }

function corpoDe(m: MsgPrint): { rotulo: string; texto: string } {
  /* sem emoji e sem a marcação do WhatsApp (*negrito*, _itálico_, ~riscado~) */
  const t = semEmoji(String(m.texto || '')).replace(/(^|\s)[*_~]+(\S[^\n]*?\S|\S)[*_~]+(?=\s|$|[.,!?:])/g, '$1$2').replace(/^\s+/, '').trim();
  switch (m.tipo) {
    case 'imagem': return { rotulo: 'Foto', texto: t };
    case 'video': return { rotulo: 'Vídeo', texto: t };
    case 'audio': return { rotulo: 'Áudio ' + mmss(m.duracao), texto: t ? 'Transcrição: ' + t : '' };
    case 'documento': return { rotulo: 'Documento: ' + semEmoji(m.midia_nome || 'arquivo'), texto: t };
    case 'figurinha': return { rotulo: 'Figurinha', texto: '' };
    case 'contato': return { rotulo: 'Contato', texto: t };
    case 'localizacao': return { rotulo: 'Localização', texto: t.split('|')[0] };
    case 'enquete': return { rotulo: 'Enquete', texto: t };
    default: return { rotulo: '', texto: t };
  }
}

/** monta o PNG do "print" (largura 720 px, desenhado em 2x) */
export async function printDaConversa(titulo: string, subtitulo: string, msgs: MsgPrint[], grupo: boolean, fotoTitulo?: string | null): Promise<Uint8Array> {
  await iniciar();
  emojiChaves = [];
  /* marca os emojis antes de medir; depois baixa as imagens de uma vez */
  const prontas = msgs.map(m => ({ m, ...corpoDe(m) }));
  for (const p of prontas) { semEmoji(p.m.autor_nome || ''); semEmoji(p.m.enviada_por_nome || ''); semEmoji(p.m.citada_previa || ''); }
  semEmoji(titulo);
  await carregarEmojis();
  const partes: string[] = [];
  let y = 64 + 12;
  let diaAnt = '', antKey = '', antEm = 0;
  for (const { m, rotulo, texto } of prontas) {
    const d = dia(m.criada_em);
    const novoDia = d !== diaAnt;
    if (novoDia) {
      diaAnt = d;
      const w = largura(d, 12, 600) + 24;
      partes.push(`<rect x="${(L - w) / 2}" y="${y}" width="${w}" height="24" rx="8" fill="#182229"/><text x="${L / 2}" y="${y + 16}" font-size="12" font-weight="600" fill="#8696a0" text-anchor="middle">${esc(d)}</text>`);
      y += 36;
    }
    const mim = !!m.de_mim;
    const autor = mim ? (m.do_assistente ? 'Otto' : semEmoji(m.enviada_por_nome || 'Branding7').trim()) : semEmoji(m.autor_nome || 'Cliente').trim();
    /* mensagem sem nada para mostrar (reação, aviso do sistema, enquete apagada...): fica de fora */
    if (!rotulo && !texto.trim() && !((m.tipo === 'imagem' || m.tipo === 'video') && m.miniatura)) continue;
    const linhas = texto ? quebrar(texto.slice(0, 700), BMAX - 20) : [];
    /* mensagens seguidas da mesma pessoa (até 5 min): sem repetir nome e bolinha */
    const chave = (mim ? 'eu:' : 'ele:') + autor, em = new Date(m.criada_em).getTime();
    const seguida = chave === antKey && em - antEm < 5 * 60_000 && !novoDia;
    antKey = chave; antEm = em;
    const temNome = grupo && !mim && !seguida;
    const cit = m.citada_previa ? quebrar(semEmoji(m.citada_previa).slice(0, 120), BMAX - 40, 13).slice(0, 2) : [];
    const thumb = (m.tipo === 'imagem' || m.tipo === 'video') && m.miniatura ? m.miniatura : '';
    const hora = hm(m.criada_em);
    /* largura da bolha */
    let w = Math.max(...linhas.map(l => largura(l)), rotulo ? largura(rotulo, 14, 600) + 22 : 0, temNome ? largura(autor, 13, 600) : 0, cit.length ? Math.max(...cit.map(l => largura(l, 13))) + 20 : 0, 0);
    if (thumb) w = Math.max(w, 260);
    /* espaço para a hora no fim da última linha */
    const ult = linhas.length ? largura(linhas[linhas.length - 1]) : 0;
    w = Math.min(BMAX, Math.max(w + 22, ult + 22 + (mim ? 70 : 48), 120));
    const h = 8 + (temNome ? 18 : 0) + (cit.length ? cit.length * 17 + 22 : 0) + (thumb ? 174 : 0) + (rotulo ? 22 : 0) + linhas.length * LH + 18;
    const x = mim ? L - PAD - w : PAD + (grupo ? 34 : 0);
    const fundo = mim ? '#005c4b' : '#202c33';
    if (seguida) y -= 3;
    if (grupo && !mim && !seguida) {
      partes.push(`<circle cx="${PAD + 14}" cy="${y + 15}" r="14" fill="${corDe(autor)}" opacity="0.9"/><text x="${PAD + 14}" y="${y + 19.5}" font-size="11" font-weight="600" fill="#0b141a" text-anchor="middle">${esc(iniciais(autor))}</text>`);
      if (m.foto) partes.push(`<clipPath id="a${partes.length}"><circle cx="${PAD + 14}" cy="${y + 15}" r="14"/></clipPath><image href="${m.foto}" x="${PAD}" y="${y + 1}" width="28" height="28" preserveAspectRatio="xMidYMid slice" clip-path="url(#a${partes.length})"/>`);
    }
    partes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fundo}"/>`);
    let cy = y + 8;
    if (temNome) { partes.push(linhaSVG(autor, x + 10, cy + 13, 13, `fill="${corDe(autor)}"`, 600)); cy += 18; }
    if (cit.length) {
      const ch = cit.length * 17 + 16;
      partes.push(`<rect x="${x + 8}" y="${cy}" width="${w - 16}" height="${ch}" rx="6" fill="${mim ? '#025144' : '#1a2329'}"/><rect x="${x + 8}" y="${cy}" width="4" height="${ch}" rx="2" fill="#06cf9c"/>`);
      cit.forEach((l, i) => partes.push(linhaSVG(l, x + 20, cy + 20 + i * 17, 13, 'fill="#aebac1"')));
      cy += ch + 6;
    }
    if (thumb) {
      partes.push(`<clipPath id="c${partes.length}"><rect x="${x + 6}" y="${cy}" width="${w - 12}" height="168" rx="7"/></clipPath><image href="data:image/jpeg;base64,${thumb}" x="${x + 6}" y="${cy}" width="${w - 12}" height="168" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${partes.length})"/>`);
      cy += 174;
    }
    if (rotulo) {
      partes.push(`<circle cx="${x + 18}" cy="${cy + 10}" r="6" fill="none" stroke="#8696a0" stroke-width="1.6"/><text x="${x + 30}" y="${cy + 15}" font-size="14" font-weight="600" fill="#d1d7db">${esc(rotulo)}</text>`);
      cy += 22;
    }
    linhas.forEach((l, i) => partes.push(linhaSVG(l, x + 10, cy + 15 + i * LH, FS, 'fill="#e9edef"')));
    /* hora + ✓✓ (desenhados) */
    const hx = x + w - 10 - (mim ? 20 : 0);
    partes.push(`<text x="${hx}" y="${y + h - 7}" font-size="11" fill="${mim ? '#a6cbc4' : '#8696a0'}" text-anchor="end">${hora}</text>`);
    if (mim) {
      const cx = x + w - 26, cyy = y + h - 12;
      partes.push(`<path d="M${cx} ${cyy} l3 3 l6 -7 M${cx + 5} ${cyy + 3} l1 0 l6 -7" stroke="#53bdeb" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    y += h + 6;
  }
  const H = y + 10;
  const tituloLimpo = semEmoji(titulo).trim() || 'Conversa';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}" font-family="Inter">
<rect width="${L}" height="${H}" fill="#0b141a"/>
<rect width="${L}" height="64" fill="#202c33"/>
<circle cx="38" cy="32" r="20" fill="${corDe(tituloLimpo)}"/><text x="38" y="37" font-size="14" font-weight="600" fill="#0b141a" text-anchor="middle">${esc(iniciais(tituloLimpo))}</text>
${fotoTitulo ? `<clipPath id="ft"><circle cx="38" cy="32" r="20"/></clipPath><rect x="18" y="12" width="40" height="40" fill="#ffffff" clip-path="url(#ft)"/><image href="${fotoTitulo}" x="18" y="12" width="40" height="40" preserveAspectRatio="xMidYMid meet" clip-path="url(#ft)"/>` : ''}
${linhaSVG([...tituloLimpo].slice(0, 60).join(''), 70, 28, 16, 'fill="#e9edef"', 600)}
<text x="70" y="48" font-size="12" fill="#8696a0">${esc(semEmoji(subtitulo).slice(0, 90))}</text>
${partes.join('\n')}
</svg>`;
  const r = new Resvg(svg, { font: { fontBuffers: fontes!, defaultFontFamily: 'Inter', loadSystemFonts: false }, fitTo: { mode: 'width', value: L * 2 } });
  return r.render().asPng();
}
