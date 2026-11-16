// =====================================================================
// PDFs gerados no servidor (4.57.0) — para o Otto mandar no WhatsApp
// ("Otto, me manda o PDF dos roteiros da Sabor da Feira de novembro").
// O B7 gera os PDFs da tela no navegador (html2canvas + jsPDF); aqui não
// há navegador, então a folha é desenhada direto com o jsPDF, no visual
// da B7 (faixa no topo, etiquetas por tipo de cena).
// =====================================================================
import { jsPDF } from 'npm:jspdf@2.5.1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const ROXO: [number, number, number] = [58, 30, 134], MAGENTA: [number, number, number] = [194, 28, 131], TINTA: [number, number, number] = [32, 26, 48], CINZA: [number, number, number] = [110, 104, 128];
const COR_CENA: Record<string, [number, number, number]> = { 'Gancho': [194, 28, 131], 'Narrativa': [58, 30, 134], 'Narração': [124, 58, 237], 'CTA': [22, 163, 74] };
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/* a fonte padrão do PDF não tem emoji nem alguns símbolos: tira o que não imprime */
const limpo = (t: unknown) => String(t ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/ /g, ' ').trim();
const dataBR = (iso: unknown) => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; };

class Folha {
  d = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  y = 0; M = 16; W = 210 - 32; pag = 1; rodape = '';
  constructor(public titulo: string, public sub: string) { this.topo(true); }
  topo(primeira: boolean) {
    const d = this.d;
    d.setFillColor(...ROXO); d.rect(0, 0, 210, primeira ? 34 : 12, 'F');
    d.setFillColor(...MAGENTA); d.rect(0, primeira ? 34 : 12, 210, 1.2, 'F');
    d.setTextColor(255, 255, 255);
    if (primeira) {
      d.setFont('helvetica', 'bold'); d.setFontSize(8); d.text('BRANDING7', this.M, 10);
      d.setFontSize(18); d.text(limpo(this.titulo).slice(0, 70), this.M, 21);
      d.setFont('helvetica', 'normal'); d.setFontSize(10); d.text(limpo(this.sub).slice(0, 110), this.M, 28);
      this.y = 44;
    } else {
      d.setFont('helvetica', 'bold'); d.setFontSize(8); d.text('BRANDING7  ·  ' + limpo(this.titulo).slice(0, 80), this.M, 7.8);
      this.y = 22;
    }
    d.setTextColor(...TINTA);
  }
  cabe(h: number) { if (this.y + h > 297 - 16) { this.pe(); this.d.addPage(); this.pag++; this.topo(false); } }
  pe() { const d = this.d; d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(...CINZA); d.text('Página ' + this.pag, 210 - this.M, 290, { align: 'right' }); if (this.rodape) d.text(limpo(this.rodape), this.M, 290); d.setTextColor(...TINTA); }
  texto(t: unknown, o: { tam?: number; negrito?: boolean; italico?: boolean; cor?: [number, number, number]; recuo?: number; espaco?: number } = {}) {
    const s = limpo(t); if (!s) return;
    const d = this.d, tam = o.tam || 10.5, recuo = o.recuo || 0;
    d.setFont('helvetica', o.negrito ? 'bold' : o.italico ? 'italic' : 'normal'); d.setFontSize(tam); d.setTextColor(...(o.cor || TINTA));
    const lh = tam * 0.43;
    for (const par of s.split(/\n+/)) {
      const linhas = d.splitTextToSize(par, this.W - recuo) as string[];
      for (const l of linhas) { this.cabe(lh); d.text(l, this.M + recuo, this.y + lh * 0.8); this.y += lh; }
      this.y += 1;
    }
    this.y += o.espaco ?? 1.5; d.setTextColor(...TINTA);
  }
  rotulo(t: string, cor: [number, number, number], x?: number) {
    const d = this.d; d.setFont('helvetica', 'bold'); d.setFontSize(7.5);
    const w = d.getTextWidth(t.toUpperCase()) + 5;
    d.setFillColor(...cor); d.roundedRect(x ?? this.M, this.y, w, 5, 1.6, 1.6, 'F');
    d.setTextColor(255, 255, 255); d.text(t.toUpperCase(), (x ?? this.M) + 2.5, this.y + 3.5); d.setTextColor(...TINTA);
    return w;
  }
  campo(rot: string, valor: unknown) {
    const v = limpo(valor); if (!v) return;
    this.cabe(10); this.texto(rot.toUpperCase(), { tam: 7.5, negrito: true, cor: CINZA, espaco: 0 }); this.texto(v, { tam: 10.5 });
  }
  linha() { this.cabe(4); this.d.setDrawColor(225, 220, 236); this.d.line(this.M, this.y, 210 - this.M, this.y); this.y += 4; }
  pronto(): Uint8Array { this.pe(); return new Uint8Array(this.d.output('arraybuffer')); }
}

/** Roteiros de uma gravação (todos, na ordem), com as cenas. */
export async function pdfRoteiros(sb: SupabaseClient, gravacaoId: string): Promise<{ nome: string; bytes: Uint8Array; titulo: string } | null> {
  const { data: g } = await sb.from('gravacoes').select('id, nome, data_gravacao, hora_inicio, local, client_id').eq('id', gravacaoId).maybeSingle();
  if (!g) return null;
  const { data: cli } = await sb.from('clientes').select('nome').eq('id', g.client_id).maybeSingle();
  const { data: rts } = await sb.from('roteiros').select('id, titulo, objetivo, observacao_gravacao, formato, position').eq('recording_session_id', g.id).is('deleted_at', null).is('archived_at', null).order('position');
  const ids = (rts || []).map(r => r.id);
  const { data: cenas } = ids.length ? await sb.from('cenas').select('script_id, position, tipo, direcao, texto, sugestao_cenas').in('script_id', ids).order('position') : { data: [] as any[] };
  const f = new Folha('Roteiros · ' + (cli?.nome || ''), g.nome + (g.data_gravacao ? '  ·  gravação ' + dataBR(g.data_gravacao) + (g.hora_inicio ? ' às ' + String(g.hora_inicio).slice(0, 5) : '') : '') + (g.local ? '  ·  ' + g.local : ''));
  f.rodape = (cli?.nome || '') + ' · ' + g.nome;
  if (!(rts || []).length) f.texto('Esta gravação ainda não tem roteiros.', { italico: true, cor: CINZA });
  (rts || []).forEach((r, i) => {
    if (i > 0) { f.y += 2; f.linha(); }
    f.cabe(26);
    f.rotulo('Roteiro ' + String(i + 1).padStart(2, '0'), MAGENTA); f.y += 7.5;
    f.texto(r.titulo || 'Sem título', { tam: 15, negrito: true, espaco: 1 });
    if (r.objetivo) f.texto(r.objetivo, { tam: 9.5, italico: true, cor: CINZA });
    if (r.observacao_gravacao) f.texto('Na gravação: ' + r.observacao_gravacao, { tam: 9.5, cor: CINZA });
    (cenas || []).filter(c => c.script_id === r.id).forEach((c, k) => {
      f.cabe(18);
      const w = f.rotulo((k + 1) + '  ' + (c.tipo || 'Cena'), COR_CENA[c.tipo] || ROXO);
      if (c.direcao) { f.d.setFont('helvetica', 'italic'); f.d.setFontSize(8.5); f.d.setTextColor(...CINZA); f.d.text(limpo(c.direcao).slice(0, 95), f.M + w + 3, f.y + 3.6); f.d.setTextColor(...TINTA); }
      f.y += 7;
      f.texto(c.texto || '', { tam: 11, recuo: 2 });
      if (c.sugestao_cenas) f.texto('Imagens: ' + c.sugestao_cenas, { tam: 9, italico: true, cor: CINZA, recuo: 2 });
    });
  });
  const base = ((cli?.nome || 'cliente') + ' ' + g.nome).normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  return { nome: 'roteiros-' + base + '.pdf', bytes: f.pronto(), titulo: 'Roteiros · ' + (cli?.nome || '') + ' · ' + g.nome };
}

/** Linha editorial (estratégia + conteúdos do mês). */
export async function pdfLinha(sb: SupabaseClient, linhaId: string): Promise<{ nome: string; bytes: Uint8Array; titulo: string } | null> {
  const { data: l } = await sb.from('linhas_editoriais').select('*').eq('id', linhaId).maybeSingle();
  if (!l) return null;
  const { data: cli } = await sb.from('clientes').select('nome').eq('id', l.client_id).maybeSingle();
  const { data: cs } = await sb.from('conteudos').select('titulo, tipo, tema, canal, data_postagem, objetivo, ideia_geral, headline, sub_headline, cta, legenda, position').eq('linha_id', l.id).is('deleted_at', null).is('archived_at', null).order('position');
  const periodo = l.mes && l.ano ? MES[Number(l.mes) - 1] + ' de ' + l.ano : [dataBR(l.periodo_inicio), dataBR(l.periodo_fim)].filter(Boolean).join(' a ');
  const f = new Folha('Linha editorial · ' + (cli?.nome || ''), (l.nome || '') + (periodo ? '  ·  ' + periodo : '') + ((cs || []).length ? '  ·  ' + (cs || []).length + ' conteúdos' : ''));
  f.rodape = (cli?.nome || '') + ' · linha editorial ' + (periodo || '');
  f.campo('Objetivo', [l.objetivo, l.objetivo_detalhe].filter(Boolean).join(' — '));
  f.campo('Posicionamento', l.posicionamento);
  f.campo('Tom de voz', l.tom_voz);
  f.campo('Proposta única de valor', l.puv);
  f.campo('Como queremos ser percebidos', l.percepcao);
  if ((cs || []).length) { f.y += 2; f.linha(); f.texto('CONTEÚDOS', { tam: 9, negrito: true, cor: MAGENTA }); }
  (cs || []).forEach((c, i) => {
    f.cabe(22);
    const tags = [c.tipo, c.canal, c.data_postagem ? dataBR(c.data_postagem) : ''].filter(Boolean).join('  ·  ');
    const w = f.rotulo(String(i + 1).padStart(2, '0'), ROXO);
    if (tags) { f.d.setFont('helvetica', 'normal'); f.d.setFontSize(8.5); f.d.setTextColor(...CINZA); f.d.text(limpo(tags).slice(0, 95), f.M + w + 3, f.y + 3.6); f.d.setTextColor(...TINTA); }
    f.y += 7;
    f.texto(c.titulo || c.tema || 'Conteúdo', { tam: 12, negrito: true, espaco: 0.5 });
    if (c.objetivo) f.texto(c.objetivo, { tam: 9.5, italico: true, cor: CINZA });
    if (c.ideia_geral) f.texto(c.ideia_geral, { tam: 10 });
    if (c.headline) f.texto('Headline: ' + c.headline + (c.sub_headline ? ' — ' + c.sub_headline : ''), { tam: 10 });
    if (c.cta) f.texto('CTA: ' + c.cta, { tam: 10 });
    if (c.legenda) f.texto('Legenda: ' + c.legenda, { tam: 9.5, cor: CINZA });
    f.y += 2;
  });
  const base = ((cli?.nome || 'cliente') + ' ' + (periodo || l.nome || '')).normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
  return { nome: 'linha-editorial-' + base + '.pdf', bytes: f.pronto(), titulo: 'Linha editorial · ' + (cli?.nome || '') + (periodo ? ' · ' + periodo : '') };
}

export const MESES = MES;
