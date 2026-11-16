// =====================================================================
// LINHA EDITORIAL DO B7 desenhada no servidor (4.58.3) — para o Otto.
// É a MESMA linha do "Baixar PDF" (js/print-linha.js documentoNovoHTML:
// paginaResumo + paginasPosts; styles/print.css .folha.l2 / .l2-*),
// refeita peça por peça: página 1 com o herói em degradê, formatos,
// cartões da estratégia, pilares e o calendário do mês; depois os posts
// em duas colunas de cartões (data, formato, #, pilar, título, arte do
// Card, sequência do Carrossel/Story, notas e legenda), em ordem de data.
// Se o design da tela mudar (print.css/print-linha.js), este muda junto.
// =====================================================================
import type { jsPDF } from 'npm:jspdf@2.5.1';
import { novoDoc, Pincel, limpo, desenharLogo, PX, INK, INK2, GREY, LINE, MAG, type RGB, type Logo } from './ficha.ts';
import * as F from './fontes-b7.ts';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const TIPOS = ['Reel', 'Card', 'Carrossel', 'Story'];
const PLURAL: Record<string, string> = { Reel: 'Reels', Card: 'Cards', Carrossel: 'Carrosséis', Story: 'Stories' };
const TC: Record<string, RGB> = { Reel: [194, 28, 131], Card: [58, 30, 134], Carrossel: [0, 21, 89], Story: [124, 30, 133] };
const TF: Record<string, RGB> = { Reel: [251, 227, 241], Card: [236, 230, 248], Carrossel: [227, 232, 246], Story: [243, 228, 245] };
const PIL: RGB[] = [[0, 21, 89], [58, 30, 134], [124, 30, 133], [194, 28, 131]];
const GRAD_B7: [number, RGB][] = [[0, [0, 21, 89]], [0.34, [58, 30, 134]], [0.66, [124, 30, 133]], [1, [194, 28, 131]]];
const GRAD_HEROI: [number, RGB][] = [[0, [11, 5, 18]], [0.4, [27, 17, 64]], [0.7, [58, 30, 134]], [1, [154, 42, 168]]];
const GRAD_ARTE: [number, RGB][] = [[0, [27, 17, 64]], [0.6, [58, 30, 134]], [1, [154, 42, 168]]];
const GRAD_DESTAQUE: [number, RGB][] = [[0, [247, 241, 252]], [1, [252, 239, 247]]];
const vazio = (t: unknown) => !String(t ?? '').trim();
const pars = (t: unknown) => limpo(t).split('\n').map(s => s.trim()).filter(Boolean);
const dataDe = (d: unknown) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

export type CtxLinha = {
  linha: any; conteudos: any[]; pilares: any[]; slides: Record<string, any[]>; frames: Record<string, any[]>; roteiros: Record<string, any>; clienteLogo?: Logo | null;
};

const X = 13, W = 210 - 26, TOPO = 13, FUNDO = 297 - 11;

/* ícones dos formatos (▶ ▣ ❯ ⬍ do sistema), desenhados */
function iconeFormato(d: jsPDF, tipo: string, cx: number, cy: number, t: number) {
  d.setFillColor(255, 255, 255); d.setDrawColor(255, 255, 255); d.setLineWidth(t * 0.12); d.setLineCap('round'); d.setLineJoin('round');
  if (tipo === 'Reel') d.triangle(cx - t * 0.32, cy - t * 0.42, cx - t * 0.32, cy + t * 0.42, cx + t * 0.42, cy, 'F');
  else if (tipo === 'Card') { d.rect(cx - t * 0.42, cy - t * 0.42, t * 0.84, t * 0.84, 'S'); d.rect(cx - t * 0.2, cy - t * 0.2, t * 0.4, t * 0.4, 'F'); }
  else if (tipo === 'Carrossel') d.lines([[t * 0.4, t * 0.42], [-t * 0.4, t * 0.42]], cx - t * 0.18, cy - t * 0.42, [1, 1], 'S', false);
  else { d.line(cx, cy - t * 0.5, cx, cy + t * 0.5); d.lines([[t * 0.28, -t * 0.28], [t * 0.28, t * 0.28]], cx - t * 0.28, cy - t * 0.22, [1, 1], 'S', false); d.lines([[t * 0.28, t * 0.28], [t * 0.28, -t * 0.28]], cx - t * 0.28, cy + t * 0.22, [1, 1], 'S', false); }
}

function cabecalho(p: Pincel, rotulo: string) {
  const d = p.d; p.fs = 1;
  p.grad(0, 0, 210, 2.2, 0, GRAD_B7);
  d.addImage(F.SIMBOLO_PNG, 'PNG', X, TOPO, 8 * 439 / 520, 8);
  p.fonte('Inter', '700', 8.5, GREY, 0.2); d.text(rotulo.toUpperCase(), X + W, TOPO + 4.6, { align: 'right' });
  return TOPO + 8 + 5;
}
function rodape(p: Pincel, l: any, num: number) {
  const d = p.d; p.fs = 1;
  p.fonte('Inter', '600', 8.5, GREY, 0.12);
  d.text((limpo(l.cliente_nome || '') + ' · Linha editorial · ' + (MESES[(l.mes || 1) - 1] || '') + ' ' + l.ano).toUpperCase(), X, FUNDO - 0.8);
  p.fonte('Sora', '800', 11, MAG); d.text(String(num).padStart(2, '0'), X + W, FUNDO - 0.6, { align: 'right' });
  return FUNDO - 3 - 4;   /* topo do rodapé (padding-top 4 mm) */
}
const periodo = (l: any) => (l.periodo_inicio && l.periodo_fim)
  ? String(l.periodo_inicio).slice(8, 10) + '/' + String(l.periodo_inicio).slice(5, 7) + ' a ' + String(l.periodo_fim).slice(8, 10) + '/' + String(l.periodo_fim).slice(5, 7) : '';
const ordenar = (lista: any[]) => lista.slice().sort((a, b) => String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')) || (a.position || 0) - (b.position || 0));

/* ------------------------------------------------------------------ página 1 */
function paginaResumo(d: jsPDF, ctx: CtxLinha) {
  const p = new Pincel(d, 1), l = ctx.linha, fs = 1;
  let y = cabecalho(p, 'Linha editorial');
  const fimUtil = rodape(p, l, 1);
  /* herói */
  const canais = String(l.canais || '').split(',').map((x: string) => x.trim()).filter(Boolean);
  const sub = periodo(l) || canais.join(' · ');
  const padY = 14 * PX, padX = 16 * PX;
  p.fonte('Inter', '400', 9, [255, 255, 255]); const totalTx = 'conteúdo' + (ctx.conteudos.length === 1 ? '' : 's') + (l.meta_conteudos ? ' de ' + l.meta_conteudos : '');
  const wTot = Math.max(p.largura(totalTx), 12) + 28 * PX, hTot = (10 * 2 + 32 + 3 + 9 * 1.2) * PX;
  const hTx = (9.5 * 1.2 + 3 + 25 * 1.08 + (sub ? 4 + 10.5 * 1.3 : 0)) * PX;
  const hHer = padY * 2 + Math.max(hTx, hTot);
  const hHer2 = ctx.clienteLogo ? Math.max(hHer, padY * 2 + 17) : hHer;
  p.grad(X, y, W, hHer2, 22 * PX, GRAD_HEROI);
  /* .l2-logo: 17 mm, fundo branco, cantos 16px, à esquerda do texto */
  let xTx = X + padX;
  if (ctx.clienteLogo) { desenharLogo(d, ctx.clienteLogo, X + padX, y + (hHer2 - 17) / 2, 17, 17, 16 * PX); xTx += 17 + 14 * PX; }
  let yt = y + (hHer2 - hTx) / 2;
  p.fonte('Inter', '700', 9.5, [242, 155, 208], 0.16); d.text(limpo(l.cliente_nome || '').toUpperCase(), xTx, yt + 9.5 * PX); yt += (9.5 * 1.2 + 3) * PX;
  p.fonte('Sora', '800', 25, [255, 255, 255], -0.03); d.text('Linha editorial · ' + (MESES[(l.mes || 1) - 1] || '') + ' ' + l.ano, xTx, yt + 25 * 0.85 * PX); yt += 25 * 1.08 * PX;
  if (sub) { p.fonte('Inter', '400', 10.5, [200, 196, 214]); d.text(limpo(sub), xTx, yt + (4 + 10.5) * PX); }
  const xT = X + W - padX - wTot, yT = y + (hHer2 - hTot) / 2;
  d.saveGraphicsState(); (d as any).setGState(new (d as any).GState({ opacity: 0.1 })); d.setFillColor(255, 255, 255); d.roundedRect(xT, yT, wTot, hTot, 16 * PX, 16 * PX, 'F'); d.restoreGraphicsState();
  d.saveGraphicsState(); (d as any).setGState(new (d as any).GState({ opacity: 0.16 })); d.setDrawColor(255, 255, 255); d.setLineWidth(PX); d.roundedRect(xT, yT, wTot, hTot, 16 * PX, 16 * PX, 'S'); d.restoreGraphicsState();
  p.fonte('Sora', '800', 32, [255, 255, 255]); d.text(String(ctx.conteudos.length), xT + wTot / 2, yT + (10 + 32 * 0.8) * PX, { align: 'center' });
  p.fonte('Inter', '400', 9, [205, 200, 220]); d.text(totalTx, xT + wTot / 2, yT + (10 + 32 + 3 + 9) * PX, { align: 'center' });
  y += hHer2;
  /* formatos */
  const formatos = TIPOS.map(t => [t, ctx.conteudos.filter(c => c.tipo === t).length] as [string, number]).filter(x => x[1]);
  if (formatos.length) {
    y += 8 * PX; const gap = 7 * PX, wF = (W - gap * (formatos.length - 1)) / formatos.length, hF = (9 * 2 + 24) * PX;
    formatos.forEach(([t, n], i) => {
      const xf = X + i * (wF + gap); p.caixa(xf, y, wF, hF, 16 * PX, [247, 244, 252]);
      const ic = 24 * PX; d.setFillColor(...TC[t]); d.roundedRect(xf + 12 * PX, y + 9 * PX, ic, ic, 8 * PX, 8 * PX, 'F');
      iconeFormato(d, t, xf + 12 * PX + ic / 2, y + 9 * PX + ic / 2, ic * 0.42);
      p.fonte('Sora', '800', 19, INK); const xn = xf + 12 * PX + ic + 8 * PX; d.text(String(n), xn, y + hF / 2 + 19 * 0.34 * PX);
      const wn = p.largura(String(n)); p.fonte('Inter', '600', 10, INK2); d.text(n === 1 ? t : PLURAL[t], xn + wn + 8 * PX, y + hF / 2 + 10 * 0.36 * PX);
    });
    y += hF;
  }
  /* estratégia */
  const estr: [string, string][] = ([['Objetivo do mês', l.objetivo], ['O que a estratégia pretende gerar', l.objetivo_detalhe], ['Posicionamento', l.posicionamento],
    ['Tom de voz', l.tom_voz], ['Proposta única de valor', l.puv], ['Percepção desejada', l.percepcao], ['Observações', l.observacoes]] as [string, string][]).filter(x => !vazio(x[1]));
  if (estr.length) {
    y += 8 * PX; const gap = 7 * PX, padC = 10 * PX, padCX = 13 * PX;
    const medir = (txt: string, w: number, destaque: boolean) => {
      if (destaque) p.fonte('Sora', '700', 14, INK); else p.fonte('Inter', '400', 11.5, INK2);
      const ls = pars(txt).flatMap(q => p.quebra(q, w - padCX * 2)); const lh = (destaque ? 14 : 11.5) * 1.5 * PX;
      return { ls, h: padC * 2 + (8.5 * 1.2 + 3) * PX + ls.length * lh, lh };
    };
    const desenhar = (rot: string, m: { ls: string[]; lh: number }, x: number, yy: number, w: number, h: number, destaque: boolean) => {
      if (destaque) p.grad(x, yy, w, h, 16 * PX, GRAD_DESTAQUE); else p.caixa(x, yy, w, h, 16 * PX, null, LINE, PX);
      p.fonte('Inter', '700', 8.5, MAG, 0.14); d.text(rot.toUpperCase(), x + padCX, yy + padC + 8.5 * 0.85 * PX);
      if (destaque) p.fonte('Sora', '700', 14, INK); else p.fonte('Inter', '400', 11.5, INK2);
      m.ls.forEach((t, k) => d.text(t, x + padCX, yy + padC + (8.5 * 1.2 + 3) * PX + m.lh * (k + 0.75)));
    };
    const m0 = medir(estr[0][1], W, true); desenhar(estr[0][0], m0, X, y, W, m0.h, true); y += m0.h;
    const resto = estr.slice(1), wC = (W - gap) / 2;
    for (let i = 0; i < resto.length; i += 2) {
      y += gap; const a = medir(resto[i][1], wC, false), b = resto[i + 1] ? medir(resto[i + 1][1], wC, false) : null;
      const h = Math.max(a.h, b ? b.h : 0);
      desenhar(resto[i][0], a, X, y, wC, h, false); if (b) desenhar(resto[i + 1][0], b, X + wC + gap, y, wC, h, false);
      y += h;
    }
  }
  /* pilares */
  const pilares = (ctx.pilares || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  if (pilares.length) {
    y += 8 * PX; let xp = X; const hP = (4 * 2 + 9.5 * 1.3) * PX;
    pilares.forEach((pl, i) => {
      const t = limpo(pl.nome || 'Pilar') + (+pl.percentual ? ' · ' + (+pl.percentual) + '%' : '');
      p.fonte('Inter', '600', 9.5, INK2); const w = p.largura(t) + (10 + 8 + 6 + 10) * PX;
      if (xp + w > X + W) { xp = X; y += hP + 6 * PX; }
      p.caixa(xp, y, w, hP, hP / 2, [247, 244, 252]);
      d.setFillColor(...PIL[i % 4]); d.circle(xp + 10 * PX + 4 * PX, y + hP / 2, 4 * PX, 'F');
      p.fonte('Inter', '600', 9.5, INK2); d.text(t, xp + (10 + 8 + 6) * PX, y + hP / 2 + 9.5 * 0.35 * PX);
      xp += w + 6 * PX;
    });
    y += hP;
  }
  /* calendário (ocupa o resto da folha) */
  y += 11 * PX;
  p.fonte('Sora', '800', 15, INK, -0.015); d.text('Calendário de postagens', X, y + 15 * 0.8 * PX);
  const usados = TIPOS.filter(t => ctx.conteudos.some(c => c.tipo === t));
  let xl = X + W;
  [...usados].reverse().forEach(t => {
    p.fonte('Inter', '600', 9, GREY); const w = p.largura(PLURAL[t]); xl -= w; d.text(PLURAL[t], xl, y + 15 * 0.75 * PX);
    xl -= 3 * PX + 8 * PX; d.setFillColor(...TC[t]); d.roundedRect(xl, y + 15 * 0.75 * PX - 7.5 * PX, 8 * PX, 8 * PX, 3 * PX, 3 * PX, 'F'); xl -= 10 * PX;
  });
  y += (15 * 1.2 + 8) * PX;
  const ano = +l.ano, mes = +l.mes - 1, dias = new Date(ano, mes + 1, 0).getDate(), desloc = (new Date(ano, mes, 1).getDay() + 6) % 7;
  const porDia: Record<number, any[]> = {};
  ctx.conteudos.forEach(c => { const dd = dataDe(c.data_postagem); if (dd && dd.getFullYear() === ano && dd.getMonth() === mes) (porDia[dd.getDate()] = porDia[dd.getDate()] || []).push(c); });
  const semData = ctx.conteudos.filter(c => { const dd = dataDe(c.data_postagem); return !dd || dd.getFullYear() !== ano || dd.getMonth() !== mes; });
  const gap = 4 * PX, wD = (W - gap * 6) / 7, hDow = (8.5 * 1.2 + 4) * PX;
  DOW.forEach((dw, i) => { p.fonte('Inter', '700', 8.5, GREY, 0.14); d.text(dw.toUpperCase(), X + i * (wD + gap) + wD / 2, y + 8.5 * PX + 2 * PX, { align: 'center' }); });
  y += hDow + gap;
  const linhas = Math.ceil((desloc + dias) / 7);
  const hSem = semData.length ? (6 + 9.5 * 1.4) * PX : 0;
  const hD = Math.max(15, (fimUtil - y - hSem - gap * (linhas - 1)) / linhas);
  for (let k = 0; k < linhas * 7; k++) {
    const dia = k - desloc + 1; if (dia < 1 || dia > dias) continue;
    const xd = X + (k % 7) * (wD + gap), yd = y + Math.floor(k / 7) * (hD + gap);
    const lista = ordenar(porDia[dia] || []);
    if (lista.length) p.caixa(xd, yd, wD, hD, 10 * PX, [255, 255, 255], [231, 224, 242], PX); else p.caixa(xd, yd, wD, hD, 10 * PX, [250, 248, 253]);
    p.fonte('Sora', '800', 10, lista.length ? INK : GREY); d.text(String(dia), xd + 5 * PX, yd + 4 * PX + 10 * 0.8 * PX);
    let ye = yd + (4 + 10 * 1.2 + 3) * PX;
    lista.slice(0, 3).forEach(c => {
      p.fonte('Inter', '600', 9, INK); const ls = p.quebra(limpo(c.titulo || c.tipo), wD - (8 + 9) * PX - 1).slice(0, 3);
      const he = (4 + ls.length * 9 * 1.3) * PX; if (ye + he > yd + hD - 2 * PX) return;
      p.caixa(xd + 5 * PX, ye, wD - 10 * PX, he, 6 * PX, TF[c.tipo] || [239, 234, 247]);
      d.setFillColor(...(TC[c.tipo] || INK)); d.roundedRect(xd + 9 * PX, ye + 2 * PX + 9 * 0.3 * PX, 6 * PX, 6 * PX, 2 * PX, 2 * PX, 'F');
      p.fonte('Inter', '600', 9, INK); ls.forEach((t, j) => d.text(t, xd + (9 + 9) * PX, ye + 2 * PX + 9 * 1.3 * PX * (j + 0.78)));
      ye += he + 3 * PX;
    });
    if (lista.length > 3) { p.fonte('Inter', '700', 8, MAG); d.text('+' + (lista.length - 3), xd + 5 * PX, Math.min(ye + 8 * PX, yd + hD - 3 * PX)); }
  }
  if (semData.length) {
    const ys = y + linhas * (hD + gap) - gap + 6 * PX + 9.5 * PX;
    p.fonte('Inter', '700', 9.5, INK2); d.text('Sem data neste mês:', X, ys); const w0 = p.largura('Sem data neste mês: ');
    p.fonte('Inter', '400', 9.5, INK2); d.text(p.quebra(semData.map(c => limpo(c.titulo || c.tipo)).join(' · '), W - w0)[0] || '', X + w0, ys);
  }
}

/* ------------------------------------------------------------------ cartões dos posts */
type Cartao = { h: number; desenhar: (x: number, y: number) => void };
function cartao(p: Pincel, c: any, n: number, ctx: CtxLinha, w: number): Cartao {
  const d = p.d, tc = TC[c.tipo] || INK, tf = TF[c.tipo] || [239, 234, 247] as RGB;
  const padY = 11 * PX, padX = 12 * PX, gapL = 7 * PX, wi = w - padX * 2;
  const blocos: { h: number; draw: (x: number, y: number) => void }[] = [];
  /* cabeçalho: data + tags + título */
  const dd = dataDe(c.data_postagem), wData = 12, xTit = wData + 10 * PX, wTit = wi - xTit;
  p.fonte('Sora', '800', 13.5, INK, -0.01); const titLs = p.quebra(limpo(c.titulo || 'Sem título'), wTit);
  const pil = (ctx.pilares || []).find(x => x.id === c.pilar_id)?.nome;
  const hTags = (8 * 1.2 + 4) * PX, hCab = Math.max((5 * 2 + 17 + 2 + 7.5 * 1.2) * PX, hTags + 3 * PX + titLs.length * 13.5 * 1.25 * PX);
  blocos.push({ h: hCab, draw: (x, y) => {
    const hD = (5 * 2 + 17 + 2 + 7.5 * 1.2) * PX;
    p.caixa(x, y, wData, hD, 12 * PX, tf);
    p.fonte('Sora', '800', 17, tc); d.text(dd ? String(dd.getDate()) : '—', x + wData / 2, y + (5 + 17 * 0.82) * PX, { align: 'center' });
    p.fonte('Inter', '700', 7.5, tc, 0.12); d.text(dd ? MES_CURTO[dd.getMonth()] : 'SEM DATA', x + wData / 2, y + (5 + 17 + 2 + 7.5 * 0.9) * PX, { align: 'center' });
    let xt = x + xTit;
    const tag = (txt: string, fundo: RGB | null, cor: RGB, borda?: RGB, icone?: string) => {
      p.fonte('Inter', '700', 8, cor, 0.08); const wt = p.largura(txt) + 14 * PX + (icone ? 9 * PX : 0);
      p.caixa(xt, y, wt, hTags, hTags / 2, fundo, borda, PX);
      if (icone) { iconeFormatoMini(d, icone, xt + 7 * PX + 3 * PX, y + hTags / 2, 5.5 * PX, cor); }
      p.fonte('Inter', '700', 8, cor, 0.08); d.text(txt, xt + 7 * PX + (icone ? 9 * PX : 0), y + hTags / 2 + 8 * 0.35 * PX); xt += wt + 4 * PX;
    };
    tag(String(c.tipo || '').toUpperCase(), tc, [255, 255, 255], undefined, c.tipo);
    tag('#' + String(n).padStart(2, '0'), [241, 236, 248], INK2);
    if (pil) tag(limpo(pil).toUpperCase(), [255, 255, 255], INK2, LINE);
    p.fonte('Sora', '800', 13.5, INK, -0.01); titLs.forEach((t, k) => d.text(t, x + xTit, y + hTags + 3 * PX + 13.5 * 1.25 * PX * (k + 0.8)));
  } });
  /* corpo por formato */
  const nota = (rot: string, v: unknown) => {
    if (vazio(v)) return;
    const wr = 17; p.fonte('Inter', '400', 9.8, INK2); const ls = pars(v).flatMap(q => p.quebra(q, wi - wr - 7 * PX));
    p.fonte('Inter', '700', 7.8, tc, 0.1); const rls = p.quebra(rot.toUpperCase(), wr);
    const lh = 9.8 * 1.45 * PX, h = Math.max(ls.length * lh, rls.length * 7.8 * 1.3 * PX + 2 * PX);
    blocos.push({ h, draw: (x, y) => {
      p.fonte('Inter', '700', 7.8, tc, 0.1); rls.forEach((t, k) => d.text(t, x, y + 2 * PX + 7.8 * 1.3 * PX * (k + 0.8)));
      p.fonte('Inter', '400', 9.8, INK2); ls.forEach((t, k) => d.text(t, x + wr + 7 * PX, y + lh * (k + 0.76)));
    } });
  };
  const seq = (itens: { i: string; b?: string; t?: string }[]) => {
    itens.forEach(it => {
      const wI = 14 * PX + 7 * PX, wt = wi - 16 * PX - wI;
      p.fonte('Inter', '700', 10, INK); const bl = it.b ? p.quebra(limpo(it.b), wt) : [];
      p.fonte('Inter', '400', 9.6, INK2); const tl = it.t ? p.quebra(limpo(it.t), wt) : [];
      const h = (5 * 2) * PX + bl.length * 10 * 1.4 * PX + tl.length * 9.6 * 1.45 * PX;
      blocos.push({ h, draw: (x, y) => {
        p.caixa(x, y, wi, h, 10 * PX, [247, 244, 252]);
        p.fonte('Sora', '800', 9, tc); d.text(it.i, x + 8 * PX, y + 5 * PX + 9 * 0.9 * PX);
        let yy = y + 5 * PX; const xt = x + 8 * PX + wI;
        p.fonte('Inter', '700', 10, INK); bl.forEach(t => { d.text(t, xt, yy + 10 * 1.4 * PX * 0.78); yy += 10 * 1.4 * PX; });
        p.fonte('Inter', '400', 9.6, INK2); tl.forEach(t => { d.text(t, xt, yy + 9.6 * 1.45 * PX * 0.76); yy += 9.6 * 1.45 * PX; });
      } });
    });
  };
  if (c.tipo === 'Card' && (c.headline || c.sub_headline || c.cta)) {
    const repete = String(c.headline || '').trim().toLowerCase() === String(c.titulo || '').trim().toLowerCase();
    const pad = 11 * PX, padA = 12 * PX, wa = wi - padA * 2;
    p.fonte('Sora', '800', 13, [255, 255, 255]); const hl = (!vazio(c.headline) && !repete) ? p.quebra(limpo(c.headline), wa) : [];
    p.fonte('Inter', '400', 10, [255, 255, 255]); const sl = vazio(c.sub_headline) ? [] : p.quebra(limpo(c.sub_headline), wa);
    const hCta = vazio(c.cta) ? 0 : (7 + 4 * 2 + 9 * 1.2) * PX;
    const h = pad * 2 + hl.length * 13 * 1.25 * PX + (sl.length ? 4 * PX + sl.length * 10 * 1.45 * PX : 0) + hCta;
    blocos.push({ h, draw: (x, y) => {
      p.grad(x, y, wi, h, 14 * PX, GRAD_ARTE);
      let yy = y + pad;
      p.fonte('Sora', '800', 13, [255, 255, 255]); hl.forEach(t => { d.text(t, x + padA, yy + 13 * 1.25 * PX * 0.8); yy += 13 * 1.25 * PX; });
      if (sl.length) { yy += 4 * PX; p.fonte('Inter', '400', 10, [225, 220, 236]); sl.forEach(t => { d.text(t, x + padA, yy + 10 * 1.45 * PX * 0.76); yy += 10 * 1.45 * PX; }); }
      if (!vazio(c.cta)) {
        yy += 7 * PX; p.fonte('Inter', '700', 9, INK); const wc = p.largura(limpo(c.cta)) + 20 * PX, hc = (4 * 2 + 9 * 1.2) * PX;
        p.caixa(x + padA, yy, wc, hc, hc / 2, [255, 255, 255]); d.text(limpo(c.cta), x + padA + 10 * PX, yy + hc / 2 + 9 * 0.35 * PX);
      }
    } });
  }
  if (c.tipo === 'Carrossel') {
    const sl = ctx.slides[c.id] || [];
    if (sl.length) seq(sl.map((s, k) => ({ i: String(k + 1).padStart(2, '0'), b: s.titulo, t: String(s.texto || '').replace(/^\s*[-•]\s*/gm, '').replace(/\s*\n+\s*/g, ' · ') })));
    else nota('Capa', c.headline);
  }
  if (c.tipo === 'Story') { const fr = ctx.frames[c.id] || []; if (fr.length) seq(fr.map((f, k) => ({ i: 'S' + (k + 1), b: f.titulo, t: [f.texto, f.direcao_visual].filter(Boolean).join(' ') }))); }
  if (c.tipo === 'Reel') {
    nota('Headline', c.headline);
    const rt = c.script_id ? ctx.roteiros[c.script_id] : null;
    if (rt && !vazio(rt.titulo) && rt.titulo.trim().toLowerCase() !== String(c.titulo || '').trim().toLowerCase()) nota('Roteiro', rt.titulo);
    if (!vazio(c.referencia_link)) nota('Referência', c.referencia_link);
  }
  nota('Ideia', c.ideia_geral); nota('Objetivo', c.objetivo); nota('Direção visual', c.direcao); nota('Para o design', c.observacao_design);
  if (c.tipo !== 'Card' && c.tipo !== 'Carrossel') nota('CTA', c.cta);
  if (!vazio(c.legenda)) {
    p.fonte('Inter', '400', 9.3, INK2); const ls = pars(c.legenda).flatMap(q => p.quebra(q, wi));
    const h = (6 + 7.8 * 1.3 + 2) * PX + ls.length * 9.3 * 1.45 * PX;
    blocos.push({ h, draw: (x, y) => {
      d.setDrawColor(...LINE); d.setLineWidth(PX); d.setLineDashPattern([1, 0.8], 0); d.line(x, y, x + wi, y); d.setLineDashPattern([], 0);
      p.fonte('Inter', '700', 7.8, GREY, 0.1); d.text('LEGENDA', x, y + (6 + 7.8) * PX);
      p.fonte('Inter', '400', 9.3, INK2); ls.forEach((t, k) => d.text(t, x, y + (6 + 7.8 * 1.3 + 2) * PX + 9.3 * 1.45 * PX * (k + 0.76)));
    } });
  }
  const h = padY * 2 + 3 * PX + blocos.reduce((s, b) => s + b.h, 0) + gapL * Math.max(0, blocos.length - 1);
  return { h, desenhar: (x, y) => {
    /* cartão com a borda de cima na cor do formato */
    p.caixa(x, y, w, h, 18 * PX, [255, 255, 255], LINE, PX);
    d.saveGraphicsState(); d.rect(x - 1, y - 1, w + 2, 18 * PX + 1, null as any); (d as any).clip(); (d as any).discardPath();
    d.setFillColor(...tc); d.roundedRect(x, y, w, h, 18 * PX, 18 * PX, 'F');
    d.setFillColor(255, 255, 255); d.roundedRect(x + PX, y + 3 * PX, w - 2 * PX, h, 17 * PX, 17 * PX, 'F');
    d.restoreGraphicsState();
    let yy = y + 3 * PX + padY;
    blocos.forEach((b, k) => { b.draw(x + padX, yy); yy += b.h + (k < blocos.length - 1 ? gapL : 0); });
  } };
}
function iconeFormatoMini(d: jsPDF, tipo: string, cx: number, cy: number, t: number, cor: RGB) {
  d.setFillColor(...cor); d.setDrawColor(...cor); d.setLineWidth(t * 0.22); d.setLineCap('round'); d.setLineJoin('round');
  if (tipo === 'Reel') d.triangle(cx - t * 0.32, cy - t * 0.42, cx - t * 0.32, cy + t * 0.42, cx + t * 0.42, cy, 'F');
  else if (tipo === 'Card') { d.rect(cx - t * 0.42, cy - t * 0.42, t * 0.84, t * 0.84, 'S'); d.rect(cx - t * 0.18, cy - t * 0.18, t * 0.36, t * 0.36, 'F'); }
  else if (tipo === 'Carrossel') d.lines([[t * 0.4, t * 0.42], [-t * 0.4, t * 0.42]], cx - t * 0.18, cy - t * 0.42, [1, 1], 'S', false);
  else { d.line(cx, cy - t * 0.5, cx, cy + t * 0.5); d.lines([[t * 0.25, -t * 0.25], [t * 0.25, t * 0.25]], cx - t * 0.25, cy - t * 0.25, [1, 1], 'S', false); d.lines([[t * 0.25, t * 0.25], [t * 0.25, -t * 0.25]], cx - t * 0.25, cy + t * 0.25, [1, 1], 'S', false); }
}

function paginasPosts(d: jsPDF, ctx: CtxLinha, primeiraNum: number) {
  const lista = ordenar(ctx.conteudos);
  if (!lista.length) return;
  const gapC = 9 * PX, wCol = (W - gapC) / 2;
  const medir = new Pincel(novoDoc(), 1);
  const cards = lista.map((c, i) => ({ c, n: i + 1, h: cartao(medir, c, i + 1, ctx, wCol).h }));
  let i = 0, num = primeiraNum;
  while (i < cards.length) {
    d.addPage();
    const p = new Pincel(d, 1);
    let y = cabecalho(p, 'Conteúdos do mês');
    const fim = rodape(p, ctx.linha, num);
    if (num === primeiraNum) {
      p.fonte('Sora', '800', 15, INK, -0.015); d.text('Conteúdos do mês', X, y + 15 * 0.8 * PX);
      p.fonte('Inter', '400', 9.5, GREY); d.text(cards.length + ' post' + (cards.length === 1 ? '' : 's') + ', em ordem de data', X + W, y + 15 * 0.8 * PX, { align: 'right' });
      y += (15 * 1.2 + 8) * PX;
    }
    for (let k = 0; k < 2 && i < cards.length; k++) {
      let yc = y; const xc = X + k * (wCol + gapC);
      let pus = 0;
      while (i < cards.length && (yc + cards[i].h <= fim || pus === 0)) {
        cartao(p, cards[i].c, cards[i].n, ctx, wCol).desenhar(xc, yc);
        yc += cards[i].h + gapC; i++; pus++;
      }
    }
    num++;
  }
}

/** PDF da linha editorial — igual ao "Baixar PDF" (A4) da tela. */
export function fichaLinha(ctx: CtxLinha): Uint8Array {
  const d = novoDoc();
  paginaResumo(d, ctx);
  paginasPosts(d, ctx, 2);
  return new Uint8Array(d.output('arraybuffer'));
}
