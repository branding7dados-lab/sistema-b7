/* 4.73.0 — configurações de JEITO e de CONTROLE do Otto (funções puras, testáveis):
   tamanho das respostas, emojis/figurinhas, apelidos, zoação espontânea,
   ferramentas ligadas/desligadas, quem pode dar ordens, confirmar antes de agir,
   fim de semana em silêncio. */

const semAcento = (v: string) => String(v || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const dig = (s: unknown) => String(s || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const fim8 = (s: unknown) => dig(s).slice(-8);

export type Controle = {
  nome?: string; equipe?: { nome?: string; numero?: string }[]; grupo_equipe?: string | null;
  tamanho?: string; emojis?: string; apelidos_otto?: string; zoacao_espontanea?: number; modo_restrito?: boolean;
  ferramentas_off?: string[]; ordens_quem?: string[]; confirmar_acoes?: boolean; fds_silencio?: boolean;
};

/* ------------------------------------------------------------ ferramentas */
/** grupos da tela → ferramentas do agente */
export const GRUPOS_FERRAMENTAS: Record<string, string[]> = {
  demandas: ['demandas'], mensagem_em_grupo: ['mensagem_em_grupo'], privado: ['privado'], audio: ['audio'],
  print: ['print', 'encaminhar_ultima'], imagem: ['imagem'], pdf: ['pdf'], figurinha: ['figurinha'],
  editar_apagar: ['editar_mensagem', 'apagar_mensagem'], lembrar: ['lembrar', 'esquecer'], resumos: ['pendencias', 'resumo_dia', 'bom_dia'],
};
const grupoDa = (f: string) => Object.keys(GRUPOS_FERRAMENTAS).find(g => GRUPOS_FERRAMENTAS[g].includes(f)) || '';
export function ferramentaLigada(cfg: Controle, f: string): boolean {
  const g = grupoDa(f);
  return !g || !(cfg.ferramentas_off || []).includes(g);
}
/** tira do prompt as linhas das ferramentas desligadas (ele nem sabe que existem) */
export function filtrarFerramentas(texto: string, cfg: Controle): string {
  const off = (cfg.ferramentas_off || []).flatMap(g => GRUPOS_FERRAMENTAS[g] || []);
  if (!off.length) return texto;
  return texto.split('\n').filter(l => !off.some(f => l.includes('{"ferramenta":"' + f + '"'))).join('\n');
}

/* ------------------------------------------------------------ quem pode dar ordens */
const MUDA_DEMANDA = /\b(cri|edit|exclu|apag|delet|remov|marc|mud|coloc|pass|atualiz|ger[ae]|adicion|troc|mov|aprov|entreg|reabr|arquiv|cancel|agend|reagend|adi|prorrog)\w*/;
/** a ação MEXE no sistema (não é só consulta)? */
export function mudaSistema(a: any): boolean {
  const f = String(a?.ferramenta || '');
  if (f === 'demandas') return MUDA_DEMANDA.test(semAcento(String(a?.pedido || '')));
  return ['lembrar', 'esquecer', 'apagar_mensagem', 'editar_mensagem'].includes(f);
}
/** ordens_quem vazio = toda a equipe pode; o celular do B7 (você) sempre pode */
export function podeMandar(cfg: Controle, fone: string, ehVoce: boolean): boolean {
  const l = (cfg.ordens_quem || []).filter(Boolean);
  if (!l.length || ehVoce) return true;
  return !!fone && l.some(n => fim8(n) === fim8(fone));
}
export function quemPodeMandar(cfg: Controle): string {
  const nomes = (cfg.ordens_quem || []).map(n => (cfg.equipe || []).find(p => fim8(p.numero) === fim8(n))?.nome).filter(Boolean).map(n => String(n).split(/\s+/)[0]);
  return nomes.length ? nomes.join(', ').replace(/, ([^,]+)$/, ' e $1') : 'algumas pessoas da equipe';
}

/* ------------------------------------------------------------ confirmar antes de agir */
const EXCLUI = /\b(exclu|apag|delet|remov|cancel)\w*/;
const VARIOS = /\b(todos|todas|tudo|menos|exceto|varios|varias|os \d+|as \d+|\d+ (videos|demandas|artes))\b/;
const STATUS = /\b(entregue|entregues|aprovad\w*|correcao|em edicao|finalizad\w*|concluid\w*|standby|pendente|a fazer)\b/;
/** ação grande o bastante para perguntar "confirma?" (null = não precisa). destinoExterno: vai para conversa que não é aqui, nem a equipe, nem privado */
export function precisaConfirmar(a: any): string | null {
  const f = String(a?.ferramenta || '');
  if (f === 'demandas') {
    const p = semAcento(String(a?.pedido || '').split('\n(Contexto')[0]);
    if (EXCLUI.test(p)) return 'excluir demanda — “' + String(a.pedido).split('\n')[0].slice(0, 140) + '”';
    if (VARIOS.test(p) && (STATUS.test(p) || MUDA_DEMANDA.test(p))) return 'mexer em várias demandas de uma vez — “' + String(a.pedido).split('\n')[0].slice(0, 140) + '”';
    return null;
  }
  if (f === 'apagar_mensagem') return 'apagar uma mensagem minha para todos';
  if (['mensagem_em_grupo', 'audio', 'figurinha', 'print'].includes(f)) {
    const d = semAcento(String(a?.grupo || a?.destino || 'aqui'));
    if (/^(aqui|equipe)$|equipe|interno|^privado:/.test(d)) return null;
    const oq = f === 'mensagem_em_grupo' ? 'mandar mensagem' : f === 'audio' ? 'mandar áudio' : f === 'figurinha' ? 'mandar figurinha' : 'mandar print';
    return oq + ' no grupo “' + String(a.grupo || a.destino) + '”' + (a.mensagem ? ': “' + String(a.mensagem).slice(0, 160) + '”' : '');
  }
  return null;
}
export const SIM = /^\s*(\*[^*]+:\*\s*)?(@?\w+[,:!]?\s+)?(sim|s|pode( sim| ser| fazer| mandar| marcar| apagar| excluir| ir| seguir)?|confirmo|confirma|confirmado|manda ver|faz|faca|bora|ok|okay|isso|positivo|claro|fechado|fechou|vai|segue)\b[^?]{0,30}$/u;
export const NAO = /^\s*(\*[^*]+:\*\s*)?(@?\w+[,:!]?\s+)?(nao|n|negativo|cancela|cancelar|deixa|deixa quieto|esquece|para|pera|espera|nem)\b/;
export function respostaConfirmacao(texto: string): 'sim' | 'nao' | null {
  const t = semAcento(texto).trim();
  if (t.length > 50) return null;
  if (NAO.test(t)) return 'nao';
  if (SIM.test(t)) return 'sim';
  return null;
}

/* ------------------------------------------------------------ jeito */
export function regraTamanho(cfg: Controle): string {
  switch (cfg.tamanho) {
    case 'curta': return 'TAMANHO (configurado pela equipe): respostas CURTAS — 1 ou 2 frases, sem enrolar. Só passe disso se pedirem algo para produzir (legenda, roteiro, lista).';
    case 'media': return 'TAMANHO (configurado pela equipe): respostas MÉDIAS — 2 a 4 frases. Algo para produzir: completo.';
    case 'detalhada': return 'TAMANHO (configurado pela equipe): respostas mais COMPLETAS e explicadas, com contexto (sem enrolação nem repetição).';
    default: return '';
  }
}
export function regraEmojis(cfg: Controle): string {
  switch (cfg.emojis) {
    case 'nada': return 'EMOJIS (configurado pela equipe): NÃO use emoji no texto. Não mande figurinha nem reação, a não ser que peçam.';
    case 'bastante': return 'EMOJIS (configurado pela equipe): use emojis com frequência, de forma natural (2 a 4 por mensagem), e figurinha/reação quando cair bem.';
    default: return 'EMOJIS: no máximo 1 por mensagem, só quando cair bem.';
  }
}
export function tirarEmojis(t: string): string {
  return String(t || '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?])/g, '$1').trim();
}
/** nomes que chamam o Otto: o nome + os apelidos da tela (sem acento, só letras/números, 3+ letras) */
export function nomesDoOtto(cfg: Controle): string[] {
  const n = semAcento(String(cfg.nome || 'Otto').split(/\s+/)[0]).replace(/[^a-z0-9]/g, '');
  const ap = String(cfg.apelidos_otto || '').split(',').map(x => semAcento(x).trim().replace(/[^a-z0-9 ]/g, '')).filter(x => x.length >= 3);
  return [...new Set([n, ...ap])].filter(x => x.length >= 3);
}
export function chamou(cfg: Controle, texto: string): boolean {
  const t = semAcento(texto);
  return nomesDoOtto(cfg).some(n => new RegExp('(^|[^a-z0-9])@?' + n.replace(/\s+/g, '\\s+') + '([^a-z0-9]|$)').test(t));
}

/* ------------------------------------------------------------ zoação espontânea */
const SERIO = /\b(cliente|reclam|problema|erro|urgente|atras|cobr|pagament|dinheiro|boleto|doen|hospital|morr|falec|luto|velorio|demiss|demit|briga|chatead|triste|ansios|desculpa|perdao|reuniao|contrato)\w*/;
export function podeZoarAgora(o: { cfg: Controle; texto: string; daEquipe: boolean; sorteio: number; minDesdeZoeira: number; minDesdeOtto: number; fds: boolean }): boolean {
  const pct = Math.min(30, Number(o.cfg.zoacao_espontanea) || 0);
  if (!(pct > 0) || o.cfg.modo_restrito || !o.daEquipe || o.fds) return false;
  const t = String(o.texto || '').trim();
  if (t.length < 15 || t.length > 300 || SERIO.test(semAcento(t))) return false;
  if (o.minDesdeZoeira < 120 || o.minDesdeOtto < 10) return false;   // no máx. 1 a cada 2 h; e não emenda em conversa dele
  return o.sorteio < pct / 100;
}

/* ------------------------------------------------------------ fim de semana */
export function ehFimDeSemana(agora = new Date()): boolean {
  const br = new Date(agora.getTime() - 3 * 3600000).getUTCDay();
  return br === 0 || br === 6;
}
export const fdsQuieto = (cfg: Controle, agora = new Date()) => !!cfg.fds_silencio && ehFimDeSemana(agora);
