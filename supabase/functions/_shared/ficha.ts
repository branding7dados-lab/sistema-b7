// =====================================================================
// FICHA DE ROTEIRO DO B7 desenhada no servidor (4.58.0) — para o Otto.
// Kevin: "tem que ser o design do roteiro que a gente usa hoje", sem
// navegador, sem servidor extra, sem depender de B7 aberto.
// Esta é a MESMA ficha de js/print.js (folhaHTML) + styles/print.css
// (.folha.rt …), refeita peça por peça com as medidas do CSS: faixa,
// marca, cliente, selo do roteiro, linha do tempo, gancho em degradê,
// narração com microfone, imagens tracejadas, CTA com seta, "Cenas
// gravadas", rodapé e o mesmo ajuste automático de escala (--fs).
// Fontes: Sora ('B7 Titulo') e Inter, as mesmas do sistema.
// Se a ficha da tela mudar (print.css), esta precisa mudar junto.
// =====================================================================
import { jsPDF } from 'npm:jspdf@2.5.1';
import * as F from './fontes-b7.ts';

type RGB = [number, number, number];
const INK: RGB = [21, 18, 43], INK2: RGB = [59, 53, 87], GREY: RGB = [139, 133, 160], LINE: RGB = [229, 224, 238];
const MAG: RGB = [194, 28, 131], VIOL: RGB = [58, 30, 134];
const GRAD: [number, RGB][] = [[0, [0, 21, 89]], [0.34, [58, 30, 134]], [0.66, [124, 30, 133]], [1, [194, 28, 131]]];
const PX = 0.264583;                     /* 1px CSS em mm */
const PT = (px: number) => px * 0.75;    /* px CSS → pt (tamanho de fonte) */
const ROTULO: Record<string, string> = { 'Gancho': 'Gancho', 'Narrativa': 'Narrativa', 'Narração': 'Narração', 'CTA': 'Chamada (CTA)' };

const corDoGrad = (t: number): RGB => {
  for (let i = 1; i < GRAD.length; i++) if (t <= GRAD[i][0]) {
    const [t0, a] = GRAD[i - 1], [t1, b] = GRAD[i], k = (t - t0) / (t1 - t0);
    return [0, 1, 2].map(j => Math.round(a[j] + (b[j] - a[j]) * k)) as RGB;
  }
  return GRAD[GRAD.length - 1][1];
};
const limpo = (t: unknown) => String(t ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/ /g, ' ');

export type Cena = { tipo?: string; funcao?: string; direcao?: string; texto?: string; sugestao_cenas?: string };
export type Roteiro = { id?: string; titulo?: string; objetivo?: string; observacao_gravacao?: string; escala?: number; escala_automatica?: boolean };
export type Ctx = { cliente?: string; gravacao?: string; dataGravacao?: string; semCliente?: boolean; roteiros: Roteiro[]; cenasPorRoteiro: Record<string, Cena[]> };

function novoDoc() {
  const d = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const fontes: [string, string, string][] = [['Sora', '700', F.SORA_700], ['Sora', '800', F.SORA_800], ['Inter', '400', F.INTER_400], ['Inter', '500', F.INTER_500], ['Inter', '600', F.INTER_600], ['Inter', '700', F.INTER_700]];
  for (const [fam, w, b64] of fontes) { const arq = fam + '-' + w + '.ttf'; d.addFileToVFS(arq, b64); d.addFont(arq, fam, w); }
  return d;
}

class Pincel {
  constructor(public d: jsPDF, public fs = 1) {}
  fonte(fam: 'Sora' | 'Inter', w: string, px: number, cor: RGB, espacoEm = 0) {
    this.d.setFont(fam, fam === 'Inter' && Number(w) > 700 ? '700' : w); this.d.setFontSize(PT(px * this.fs)); this.d.setTextColor(...cor);
    this.d.setCharSpace(espacoEm * px * this.fs * PX);
  }
  /* degradê da B7 (118°) — faixas finas, da esquerda para a direita */
  grad(x: number, y: number, w: number, h: number, r = 0) {
    const d = this.d, passos = Math.max(24, Math.round(w * 2));
    if (r > 0) { d.saveGraphicsState(); (d as any).roundedRect(x, y, w, h, r, r, null); (d as any).clip(); (d as any).discardPath(); }
    for (let i = 0; i < passos; i++) {
      const t = i / (passos - 1); d.setFillColor(...corDoGrad(t));
      d.rect(x + (w * i) / passos, y, w / passos + 0.05, h, 'F');
    }
    if (r > 0) d.restoreGraphicsState();
  }
  caixa(x: number, y: number, w: number, h: number, r: number, fundo: RGB | null, borda?: RGB, esp = 0.26, tracejada = false) {
    const d = this.d;
    if (fundo) d.setFillColor(...fundo);
    if (borda) { d.setDrawColor(...borda); d.setLineWidth(esp); if (tracejada) d.setLineDashPattern([1.2, 0.9], 0); }
    d.roundedRect(x, y, w, h, r, r, fundo && borda ? 'FD' : fundo ? 'F' : 'S');
    if (tracejada) d.setLineDashPattern([], 0);
  }
  largura(t: string) { return this.d.getTextWidth(t) + this.d.getCharSpace() * Math.max(0, t.length - 1); }
  quebra(t: string, w: number): string[] { return this.d.splitTextToSize(t, w) as string[]; }
}

/* parágrafos como no folhaHTML: uma quebra de linha = um parágrafo; "Nome: fala" = diálogo */
function paragrafos(t: unknown) {
  const ls = limpo(t).split('\n').map(s => s.trim()).filter(Boolean);
  return ls.map(p => { const m = p.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .]{0,22}):\s+(.+)$/); return m ? { quem: m[1], txt: m[2] } : { quem: '', txt: p }; });
}

/** Desenha (ou só mede, com desenhar=false) uma folha. Devolve a altura usada pelo bloco das cenas. */
function folha(d: jsPDF, ctx: Ctx, r: Roteiro, cenas: Cena[], indice: number, total: number, fs: number, desenhar: boolean): { estourou: boolean } {
  const p = new Pincel(d, fs);
  const X = 17, W = 210 - 34, TOPO = 15, FUNDO = 297 - 13;
  /* ---------- peças fixas (não dependem da escala, como no CSS) ---------- */
  const alturaPe = 8.5 * 1.2 * PX;                                   /* .rt-pe */
  const alturaTakes = (10 + 10) * PX + 17 * PX;                      /* .rt-takes: padding + uma linha de chips */
  const yPe = FUNDO - alturaPe;
  const yTakes = yPe - 10 * PX - alturaTakes;

  if (desenhar) {
    p.grad(0, 0, 210, 2.2);
    /* marca */
    d.addImage(F.SIMBOLO_PNG, 'PNG', X, TOPO, 10 * 439 / 520, 10);
    p.fs = 1;
    p.fonte('Sora', '800', 13, INK, -0.01); d.text('Branding7', X + 8.45 + 10 * PX, TOPO + 4.3);
    p.fonte('Inter', '600', 8.5, GREY, 0.16); d.text('ROTEIRO DE GRAVAÇÃO', X + 8.45 + 10 * PX, TOPO + 7.6);
    /* cliente (pílula à direita) */
    if (!ctx.semCliente) {
      p.fonte('Sora', '800', 12, INK); const n = limpo(ctx.cliente || 'Cliente').slice(0, 40); const wn = p.largura(n);
      p.fonte('Inter', '400', 9.5, GREY); const sub = limpo([ctx.gravacao || 'Gravação', ctx.dataGravacao].filter(Boolean).join(' · ')).slice(0, 60); const ws = p.largura(sub);
      const wTx = Math.max(wn, ws), wP = Math.min(W * 0.6, wTx + (14 + 10) * PX), hP = 10 * PX + 9.5;
      const xP = X + W - wP, yP = TOPO + 5 - hP / 2;
      p.caixa(xP, yP, wP, hP, hP / 2, null, LINE, 0.26);
      p.fonte('Sora', '800', 12, ctx.cliente ? INK : [201, 194, 218]); d.text(n, xP + 10 * PX, yP + 4.6);
      p.fonte('Inter', '400', 9.5, GREY); d.text(sub, xP + 10 * PX, yP + 8.2);
    }
    p.fs = fs;
  }

  /* ---------- topo (selo + título) ---------- */
  let y = TOPO + 10 + 9 * fs;
  const padY = 16 * PX * fs, padX = 18 * PX * fs, selo = 25 * fs, gap = 18 * PX * fs;
  const xTx = X + padX + selo + gap, wTx = W - padX * 2 - selo - gap;
  p.fonte('Sora', '800', 27, INK, -0.025);
  const titulo = limpo(r.titulo || 'Título do roteiro');
  const linhasT = p.quebra(titulo, wTx);
  const lhT = 27 * 1.12 * PX * fs;
  const n = cenas.length;
  const kicker = (n + ' cena' + (n === 1 ? '' : 's') + (ctx.semCliente || !ctx.gravacao ? '' : '  ·  ' + limpo(ctx.gravacao))).toUpperCase();
  const blocosObs: [string, string, RGB][] = [];
  if (r.objetivo && r.objetivo.trim()) blocosObs.push(['OBJETIVO', limpo(r.objetivo), VIOL]);
  if (r.observacao_gravacao && r.observacao_gravacao.trim()) blocosObs.push(['NA GRAVAÇÃO', limpo(r.observacao_gravacao), GREY]);
  /* altura do texto do topo */
  let hTx = 9.5 * 1.2 * PX * fs + 6 * PX * fs + linhasT.length * lhT;
  const obsLinhas = blocosObs.map(([rot, txt]) => {
    p.fonte('Inter', '800', 8, VIOL, 0.16); const wr = p.largura(rot) + 18 * PX * fs;
    p.fonte('Inter', '400', 11, INK2); const ls = p.quebra(txt, wTx - wr - 10 * PX * fs);
    hTx += 8 * PX * fs + ls.length * 11 * 1.5 * PX * fs; return { wr, ls };
  });
  const hTopo = Math.max(selo, hTx) + padY * 2;
  if (desenhar) {
    p.caixa(X, y, W, hTopo, 20 * PX, [247, 244, 252]);
    const yS = y + (hTopo - selo) / 2;
    p.grad(X + padX, yS, selo, selo, 18 * PX);
    p.fonte('Inter', '700', 7, [230, 220, 240], 0.24); d.text('ROTEIRO', X + padX + selo / 2, yS + selo * 0.3, { align: 'center' });
    p.fonte('Sora', '800', 38, [255, 255, 255], -0.04); d.text(String(indice + 1).padStart(2, '0'), X + padX + selo / 2, yS + selo * 0.66, { align: 'center' });
    p.fonte('Inter', '600', 8.5, [230, 220, 240]); d.text('de ' + String(total).padStart(2, '0'), X + padX + selo / 2, yS + selo * 0.84, { align: 'center' });
    let yt = y + (hTopo - hTx) / 2;
    p.fonte('Inter', '700', 9.5, MAG, 0.14); d.text(kicker.slice(0, 80), xTx, yt + 9.5 * PX * fs); yt += 9.5 * 1.2 * PX * fs + 6 * PX * fs;
    p.fonte('Sora', '800', 27, r.titulo ? INK : [201, 194, 218], -0.025);
    linhasT.forEach(l => { d.text(l, xTx, yt + lhT * 0.8); yt += lhT; });
    blocosObs.forEach(([rot, , cor], i) => {
      yt += 8 * PX * fs; const { wr, ls } = obsLinhas[i];
      p.caixa(xTx, yt + 0.6 * fs, wr, (8 + 6) * PX * fs + 1, 3, [255, 255, 255]);
      p.fonte('Inter', '800', 8, cor, 0.16); d.text(rot, xTx + 9 * PX * fs, yt + 3.3 * fs);
      p.fonte('Inter', '400', 11, INK2); ls.forEach((l, k) => d.text(l, xTx + wr + 10 * PX * fs, yt + 3.5 * fs + k * 11 * 1.5 * PX * fs));
      yt += ls.length * 11 * 1.5 * PX * fs;
    });
  }
  y += hTopo;

  /* ---------- cenas: mede cada uma ---------- */
  const xB = X, bola = 24 * PX * fs, xC = X + bola + 14 * PX * fs, wC = W - (xC - X);
  type Med = { h: number; desenhar: (y0: number) => void };
  const medidas: Med[] = cenas.map((c, i) => {
    const tipo = ROTULO[c.tipo || ''] ? c.tipo! : 'Narrativa';
    const etiqueta = (c.funcao && c.funcao.trim()) ? limpo(c.funcao.trim()) : ROTULO[tipo];
    const pars = paragrafos(c.texto);
    const hMeta = (3 + 7) * PX * fs + (8 + 6) * PX * fs + 0.6;
    let hCorpo = 0; let corpo: (y0: number) => void = () => {};
    if (tipo === 'Gancho') {
      const pad = 18 * PX * fs, padX2 = 22 * PX * fs, w = wC - padX2 * 2, lh = 19 * 1.4 * PX * fs;
      p.fonte('Sora', '700', 19, INK, -0.01);
      const ls = pars.map(q => p.quebra((q.quem ? q.quem.toUpperCase() + '  ' : '') + q.txt, w));
      hCorpo = pad * 2 + ls.reduce((s, l) => s + l.length * lh, 0) + Math.max(0, ls.length - 1) * 6 * PX * fs;
      corpo = y0 => {
        p.grad(xC, y0, wC, hCorpo, 16 * PX);
        d.saveGraphicsState(); (d as any).setGState(new (d as any).GState({ opacity: 0.16 }));
        p.fonte('Sora', '800', 96, [255, 255, 255]); d.text('“', xC + wC - 14 * PX * fs - p.largura('“'), y0 - 14 * PX * fs + 96 * 0.78 * PX * fs);
        d.restoreGraphicsState();
        let yy = y0 + pad; p.fonte('Sora', '700', 19, [255, 255, 255], -0.01);
        ls.forEach((l, k) => { l.forEach(t => { d.text(t, xC + padX2, yy + lh * 0.78); yy += lh; }); if (k < ls.length - 1) yy += 6 * PX * fs; });
      };
    } else if (tipo === 'CTA') {
      const pad = 15 * PX * fs, padX2 = 18 * PX * fs, ic = 30 * PX * fs, w = wC - padX2 * 2 - ic - 14 * PX * fs, lh = 15.5 * 1.5 * PX * fs;
      p.fonte('Sora', '700', 15.5, INK);
      const ls = pars.map(q => p.quebra((q.quem ? q.quem.toUpperCase() + '  ' : '') + q.txt, w));
      const hTxt = ls.reduce((s, l) => s + l.length * lh, 0);
      hCorpo = pad * 2 + Math.max(hTxt, ic);
      corpo = y0 => {
        p.caixa(xC, y0, wC, hCorpo, 16 * PX, [252, 239, 247], [242, 194, 223], 1.5 * PX);
        let yy = y0 + (hCorpo - hTxt) / 2; p.fonte('Sora', '700', 15.5, INK);
        ls.forEach(l => l.forEach(t => { d.text(t, xC + padX2, yy + lh * 0.75); yy += lh; }));
        const cx = xC + wC - padX2 - ic / 2, cy = y0 + hCorpo / 2;
        d.saveGraphicsState(); d.circle(cx, cy, ic / 2, null as any); (d as any).clip(); (d as any).discardPath(); p.grad(cx - ic / 2, cy - ic / 2, ic, ic); d.restoreGraphicsState();
        d.setDrawColor(255, 255, 255); d.setLineWidth(2.4 * PX * fs * 0.6); d.setLineCap('round'); d.setLineJoin('round');
        const s = ic * 0.6 / 24, ox = cx - ic * 0.3, oy = cy - ic * 0.3;
        d.line(ox + 5 * s, oy + 12 * s, ox + 19 * s, oy + 12 * s); d.lines([[6 * s, 6 * s], [-6 * s, 6 * s]], ox + 13 * s, oy + 6 * s, [1, 1], 'S', false);
      };
    } else if (tipo === 'Narração') {
      const pad = 13 * PX * fs, padX2 = 16 * PX * fs, mic = 22 * PX * fs, w = wC - padX2 * 2 - mic - 12 * PX * fs, lh = 13.4 * 1.7 * PX * fs;
      p.fonte('Inter', '400', 13.4, INK2);
      const ls = pars.map(q => p.quebra((q.quem ? q.quem.toUpperCase() + '  ' : '') + q.txt, w - 1.5));
      const hTxt = ls.reduce((s, l) => s + l.length * lh, 0) + Math.max(0, ls.length - 1) * 6 * PX * fs;
      const hCaixa = pad * 2 + Math.max(hTxt, mic);
      let hSug = 0, sugLs: string[] = [];
      if (c.sugestao_cenas && c.sugestao_cenas.trim()) {
        p.fonte('Inter', '800', 8.5, VIOL, 0.14); const wr = p.largura('IMAGENS:');
        p.fonte('Inter', '400', 11, INK2); sugLs = p.quebra(paragrafos(c.sugestao_cenas).map(q => q.txt).join(' · '), wC - 24 * PX * fs - 15 * PX * fs - wr - 16 * PX * fs);
        hSug = 7 * PX * fs + 16 * PX * fs + sugLs.length * 11 * 1.5 * PX * fs;
      }
      hCorpo = hCaixa + hSug;
      corpo = y0 => {
        p.caixa(xC, y0, wC, hCaixa, 14 * PX, [245, 241, 251]);
        const mx = xC + padX2 + mic / 2, my = y0 + pad + mic / 2;
        d.setFillColor(255, 255, 255); d.circle(mx, my, mic / 2, 'F');
        icone(d, 'mic', mx, my, mic * 0.6, VIOL);
        let yy = y0 + pad; p.fonte('Inter', '400', 13.4, INK2);
        ls.forEach((l, k) => { l.forEach(t => { italico(d, t, xC + padX2 + mic + 12 * PX * fs, yy + lh * 0.72); yy += lh; }); if (k < ls.length - 1) yy += 6 * PX * fs; });
        if (hSug) {
          const ys = y0 + hCaixa + 7 * PX * fs, hs = hSug - 7 * PX * fs;
          p.caixa(xC, ys, wC, hs, 12 * PX, null, [207, 195, 230], 1.2 * PX, true);
          icone(d, 'cam', xC + 12 * PX * fs + 7.5 * PX * fs, ys + 8 * PX * fs + 7.5 * PX * fs + 0.2, 15 * PX * fs, VIOL);
          p.fonte('Inter', '800', 8.5, VIOL, 0.14); const xr = xC + 12 * PX * fs + 15 * PX * fs + 8 * PX * fs; d.text('IMAGENS:', xr, ys + 8 * PX * fs + 3 * fs);
          const wr = p.largura('IMAGENS:'); p.fonte('Inter', '400', 11, INK2);
          sugLs.forEach((t, k) => d.text(t, xr + wr + 8 * PX * fs, ys + 8 * PX * fs + 3.1 * fs + k * 11 * 1.5 * PX * fs));
        }
      };
    } else {
      const lh = 13.6 * 1.75 * PX * fs;
      p.fonte('Inter', '400', 13.6, INK2);
      const ls = pars.map(q => {
        if (!q.quem) return { quem: '', wq: 0, linhas: p.quebra(q.txt, wC) };
        p.fonte('Sora', '800', 13.6 * 0.78, [154, 42, 168], 0.06); const wq = p.largura(q.quem.toUpperCase()) + 2 * PX + 1.2;
        p.fonte('Inter', '400', 13.6, INK2); const primeira = p.quebra(q.txt, wC - wq);
        return { quem: q.quem.toUpperCase(), wq, linhas: primeira.length > 1 ? [primeira[0], ...p.quebra(primeira.slice(1).join(' '), wC)] : primeira };
      });
      hCorpo = ls.reduce((s, l) => s + l.linhas.length * lh, 0) + Math.max(0, ls.length - 1) * 8 * PX * fs;
      corpo = y0 => {
        let yy = y0;
        ls.forEach((l, k) => {
          l.linhas.forEach((t, j) => {
            if (j === 0 && l.quem) { p.fonte('Sora', '800', 13.6 * 0.78, MAG, 0.06); d.text(l.quem, xC, yy + lh * 0.66); }
            p.fonte('Inter', '400', 13.6, INK2); d.text(t, xC + (j === 0 ? l.wq : 0), yy + lh * 0.66); yy += lh;
          });
          if (k < ls.length - 1) yy += 8 * PX * fs;
        });
      };
    }
    const h = hMeta + hCorpo;
    return {
      h, desenhar: (y0: number) => {
        /* bolinha */
        const cx = xB + bola / 2, cy = y0 + bola / 2;
        const cor = tipo === 'Gancho' ? { f: MAG, b: MAG, t: [255, 255, 255] as RGB } : tipo === 'CTA' ? { f: INK, b: INK, t: [255, 255, 255] as RGB }
          : tipo === 'Narração' ? { f: [255, 255, 255] as RGB, b: [185, 169, 214] as RGB, t: VIOL } : { f: [255, 255, 255] as RGB, b: [226, 218, 240] as RGB, t: INK };
        d.setFillColor(...cor.f); d.setDrawColor(...cor.b); d.setLineWidth(2 * PX * fs); d.circle(cx, cy, bola / 2 - PX * fs, 'FD');
        p.fonte('Sora', '800', 11, cor.t); d.text(String(i + 1), cx, cy + 1.25 * fs, { align: 'center' });
        /* etiqueta + direção */
        const ym = y0 + 3 * PX * fs;
        p.fonte('Inter', '800', 8, INK, 0.14); const et = etiqueta.toUpperCase(); const we = p.largura(et) + 20 * PX * fs, he = (8 + 6) * PX * fs + 0.6;
        const ce = tipo === 'Gancho' ? { f: [251, 227, 241] as RGB, t: MAG } : tipo === 'CTA' ? { f: INK, t: [255, 255, 255] as RGB } : tipo === 'Narração' ? { f: [236, 230, 248] as RGB, t: VIOL } : { f: [239, 234, 247] as RGB, t: INK };
        p.caixa(xC, ym, we, he, he / 2, ce.f);
        p.fonte('Inter', '800', 8, ce.t, 0.14); d.text(et, xC + 10 * PX * fs, ym + he * 0.68);
        if (c.direcao && c.direcao.trim()) { p.fonte('Inter', '600', 9.5, GREY); d.text(limpo(c.direcao).slice(0, 110), xC + we + 8 * PX * fs, ym + he * 0.7); }
        corpo(y0 + hMeta);
      }
    };
  });

  /* espaços flexíveis (.esp): topo + entre cenas (flex 1, 6–24 mm) e fim (flex .45, mín. 3 mm) */
  const yCorpoIni = y, yCorpoFim = yTakes - 7 * fs;
  const somaCenas = medidas.reduce((s, m) => s + m.h, 0);
  const nEsp = 1 + Math.max(0, medidas.length - 1);
  const minimo = nEsp * 6 * fs + 3 * fs;
  const sobra = yCorpoFim - yCorpoIni - somaCenas;
  const estourou = sobra < minimo - 0.5;
  if (desenhar) {
    /* como no CSS: .folha-corpo = esp(flex 1) + .rt-cenas(flex 1, com .esp entre as cenas) + esp.fim(flex .45);
       cada .esp entre 6 e 24 mm (× escala) */
    const internos = Math.max(0, medidas.length - 1);
    const extra = Math.max(0, sobra - ((1 + internos) * 6 * fs + 3 * fs));
    const parte = extra / 2.45;
    const espTopo = Math.min(24 * fs, 6 * fs + parte);
    const espEntre = internos ? Math.min(24 * fs, 6 * fs + parte / internos) : 0;
    let yy = yCorpoIni + espTopo;
    const centros: number[] = [];
    medidas.forEach((m, k) => { centros.push(yy + bola / 2); m.desenhar(yy); yy += m.h + (k < medidas.length - 1 ? espEntre : 0); });
    /* linha do tempo (atrás das bolinhas) */
    if (centros.length > 1) {
      d.saveGraphicsState(); (d as any).setGState(new (d as any).GState({ opacity: 0.22 }));
      const x = xB + 11 * PX * fs + PX, y1 = centros[0], y2 = centros[centros.length - 1], passos = 40;
      d.restoreGraphicsState();
      /* a linha vem clara e contínua: a cor já misturada com o branco (22%) em vez de transparência por faixa */
      for (let s = 0; s < passos; s++) { const t = s / passos; const c0: RGB = t < 0.5 ? mistura(MAG, [124, 30, 133], t * 2) : mistura([124, 30, 133], VIOL, (t - 0.5) * 2);
        const c = mistura([255, 255, 255], c0, 0.22);
        d.setFillColor(...c); d.rect(x - PX, y1 + (y2 - y1) * t, 2 * PX, (y2 - y1) / passos + 0.3, 'F'); }
      /* as bolinhas por cima da linha */
      medidas.forEach((m, k) => {
        const tipo = ROTULO[cenas[k].tipo || ''] ? cenas[k].tipo : 'Narrativa';
        const cor = tipo === 'Gancho' ? { f: MAG, b: MAG, t: [255, 255, 255] as RGB } : tipo === 'CTA' ? { f: INK, b: INK, t: [255, 255, 255] as RGB }
          : tipo === 'Narração' ? { f: [255, 255, 255] as RGB, b: [185, 169, 214] as RGB, t: VIOL } : { f: [255, 255, 255] as RGB, b: [226, 218, 240] as RGB, t: INK };
        const cx = xB + bola / 2, cy = centros[k];
        d.setFillColor(...cor.f); d.setDrawColor(...cor.b); d.setLineWidth(2 * PX * fs); d.circle(cx, cy, bola / 2 - PX * fs, 'FD');
        p.fonte('Sora', '800', 11, cor.t); d.text(String(k + 1), cx, cy + 1.25 * fs, { align: 'center' });
      });
    }
    /* cenas gravadas */
    p.fs = 1;
    p.caixa(X, yTakes, W, alturaTakes, 14 * PX, [247, 244, 252]);
    let xk = X + 14 * PX; const yk = yTakes + alturaTakes / 2;
    p.fonte('Inter', '800', 8.5, VIOL, 0.14); d.text('CENAS GRAVADAS', xk, yk + 1.05); xk += p.largura('CENAS GRAVADAS') + (4 + 8) * PX;
    const chip = (rot: string, cor: RGB, borda: RGB, x: number) => {
      p.fonte('Sora', '700', 10, cor); const w = p.largura(rot) + (4 + 11 + 5 + 8) * PX, h = 17 * PX;
      p.caixa(x, yk - h / 2, w, h, h / 2, [255, 255, 255]);
      p.caixa(x + 4 * PX, yk - 5.5 * PX, 11 * PX, 11 * PX, 4 * PX, null, borda, 1.5 * PX);
      d.text(rot, x + (4 + 11 + 5) * PX, yk + 1.25); return w;
    };
    for (let k = 1; k <= n; k++) xk += chip(String(k), INK2, [207, 195, 230], xk) + 8 * PX;
    p.fonte('Sora', '700', 10, MAG); const wOk = p.largura('Aprovado') + 28 * PX;
    chip('Aprovado', MAG, [242, 194, 223], X + W - 14 * PX - wOk);
    /* rodapé */
    p.fonte('Inter', '600', 8.5, GREY, 0.12); d.text('BRANDING7  ·  ROTEIROS DE GRAVAÇÃO', X, yPe + 2.2);
    p.fonte('Sora', '800', 11, MAG); d.text(String(indice + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), X + W, yPe + 2.4, { align: 'right' });
    d.setCharSpace(0);
  }
  return { estourou };
}

const mistura = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * Math.max(0, Math.min(1, t)))) as RGB;

/* texto inclinado (a fonte do PDF não tem itálico): mesma inclinação do itálico sintético do navegador */
function italico(d: jsPDF, t: string, x: number, y: number) {
  const k = (d as any).internal.scaleFactor, yPt = (297 - y) * k, c = 0.2;
  (d as any).internal.write('q 1 0 ' + c + ' 1 ' + (-c * yPt).toFixed(3) + ' 0 cm');
  d.text(t, x, y);
  (d as any).internal.write('Q');
}

/* ícones da ficha (mesmos caminhos do SVG do print.js, desenhados com linhas) */
function icone(d: jsPDF, qual: 'mic' | 'cam', cx: number, cy: number, tam: number, cor: RGB) {
  const s = tam / 24, ox = cx - tam / 2, oy = cy - tam / 2;
  d.setDrawColor(...cor); d.setLineWidth(2 * s * 0.9); d.setLineCap('round'); d.setLineJoin('round');
  if (qual === 'mic') {
    d.roundedRect(ox + 9 * s, oy + 3 * s, 6 * s, 11 * s, 3 * s, 3 * s, 'S');
    d.lines([[0, 0], [1.2 * s, 3.6 * s, 4.2 * s, 6.4 * s, 7 * s, 6.4 * s], [2.8 * s, 0, 5.8 * s, -2.8 * s, 7 * s, -6.4 * s]], ox + 5 * s, oy + 11 * s, [1, 1], 'S', false);
    d.line(ox + 12 * s, oy + 18 * s, ox + 12 * s, oy + 21 * s);
  } else {
    d.rect(ox + 4 * s, oy + 7 * s, 11 * s, 10 * s, 'S');
    d.lines([[5 * s, -3 * s], [0, 10 * s], [-5 * s, -3 * s]], ox + 15 * s, oy + 10 * s, [1, 1], 'S', false);
  }
}

/** PDF dos roteiros de uma gravação — uma folha por roteiro, como o "Baixar" da tela. */
export function fichaRoteiros(ctx: Ctx): Uint8Array {
  const d = novoDoc();
  const total = ctx.roteiros.length;
  ctx.roteiros.forEach((r, i) => {
    if (i > 0) d.addPage();
    const cenas = ctx.cenasPorRoteiro[r.id || ''] || [];
    /* mesmo ajuste automático do Folha.ajustar: reduz de 0,01 em 0,01 até caber (mín. 0,58) */
    let fs = r.escala_automatica === false && r.escala ? Number(r.escala) : 1;
    if (r.escala_automatica !== false) {
      const teste = novoDoc();
      while (fs > 0.58 && folha(teste, ctx, r, cenas, i, total, fs, false).estourou) fs = +(fs - 0.01).toFixed(2);
    }
    folha(d, ctx, r, cenas, i, total, fs, true);
  });
  return new Uint8Array(d.output('arraybuffer'));
}
