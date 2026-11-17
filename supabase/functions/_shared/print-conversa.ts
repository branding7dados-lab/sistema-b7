// =====================================================================
// "Print" de uma conversa do WhatsApp (4.59.9)
// O Otto monta uma imagem no jeito do WhatsApp (tema escuro) com as
// últimas mensagens de um grupo/conversa e manda no grupo da equipe:
// "Otto, manda o print da conversa da Sabor da Feira".
// Desenho em SVG → PNG com resvg (wasm), fontes Inter já embutidas.
// Emojis não entram (a fonte não tem): são tirados do texto.
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
/* tira emoji (e tom de pele, seletores, junções) e qualquer letra que a fonte não tenha — senão vira um quadradinho */
const semEmoji = (s: string) => {
  let t = String(s || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu, (c) => /[0-9#*]/.test(c) ? c : '');
  if (fonteR) t = [...t].filter(c => c === '\n' || c === ' ' || c === '\t' || fonteR.charToGlyphIndex(c) > 0).join('');
  return t.replace(/[ \t]{2,}/g, ' ');
};
const CORES = ['#53bdeb', '#f15c6d', '#06cf9c', '#ffbc38', '#a5b337', '#e26ab6', '#00a884', '#fc9775', '#9de1fe', '#c4a7f4'];
const corDe = (n: string) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };

/* largura do texto medida com a própria fonte (opentype.js) */
let fonteR: any = null, fonteN: any = null;
function largura(t: string, fs = FS, peso = 400): number {
  const f = peso >= 600 ? fonteN : fonteR;
  return f ? f.getAdvanceWidth(t, fs, { kerning: true }) : t.length * fs * 0.56;
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
  const partes: string[] = [];
  let y = 64 + 12;
  let diaAnt = '', antKey = '', antEm = 0;
  for (const m of msgs) {
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
    const { rotulo, texto } = corpoDe(m);
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
    if (temNome) { partes.push(`<text x="${x + 10}" y="${cy + 13}" font-size="13" font-weight="600" fill="${corDe(autor)}">${esc(autor)}</text>`); cy += 18; }
    if (cit.length) {
      const ch = cit.length * 17 + 16;
      partes.push(`<rect x="${x + 8}" y="${cy}" width="${w - 16}" height="${ch}" rx="6" fill="${mim ? '#025144' : '#1a2329'}"/><rect x="${x + 8}" y="${cy}" width="4" height="${ch}" rx="2" fill="#06cf9c"/>`);
      cit.forEach((l, i) => partes.push(`<text x="${x + 20}" y="${cy + 20 + i * 17}" font-size="13" fill="#aebac1">${esc(l)}</text>`));
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
    linhas.forEach((l, i) => partes.push(`<text x="${x + 10}" y="${cy + 15 + i * LH}" font-size="${FS}" fill="#e9edef">${esc(l)}</text>`));
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
<text x="70" y="28" font-size="16" font-weight="600" fill="#e9edef">${esc(tituloLimpo.slice(0, 60))}</text>
<text x="70" y="48" font-size="12" fill="#8696a0">${esc(semEmoji(subtitulo).slice(0, 90))}</text>
${partes.join('\n')}
</svg>`;
  const r = new Resvg(svg, { font: { fontBuffers: fontes!, defaultFontFamily: 'Inter', loadSystemFonts: false }, fitTo: { mode: 'width', value: L * 2 } });
  return r.render().asPng();
}
