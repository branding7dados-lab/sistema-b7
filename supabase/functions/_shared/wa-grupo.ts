// =====================================================================
// DADOS DO GRUPO (4.85.0) — peças puras (sem banco, sem rede)
//   • membros vindos do Evolution (findGroupInfos / fetchAllGroups / participants);
//   • se o número da B7 é admin do grupo;
//   • aviso do webhook "alguém entrou/saiu/virou admin";
//   • resultado de adicionar/remover, por pessoa e com o motivo em português.
// =====================================================================

export type Membro = { jid: string; telefone: string | null; admin: 'admin' | 'superadmin' | null };

/** telefone (só dígitos) de um jid @s.whatsapp.net; @lid e o resto: null */
export function telefoneDe(x: string): string | null {
  const m = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(String(x || ''));
  return m ? m[1] : null;
}
const adminDe = (a: unknown): Membro['admin'] => a === 'superadmin' ? 'superadmin' : a === 'admin' ? 'admin' : null;
function membro(p: any): Membro | null {
  if (typeof p === 'string') return p ? { jid: p, telefone: telefoneDe(p), admin: null } : null;
  const jid = String(p?.id || p?.jid || '');
  if (!jid) return null;
  const tel = telefoneDe(jid) || telefoneDe(String(p?.phoneNumber || '')) || telefoneDe(String(p?.jid || ''));
  return { jid, telefone: tel, admin: adminDe(p?.admin) };
}

export function membrosDe(info: any): Membro[] {
  const lista = Array.isArray(info) ? info : Array.isArray(info?.participants) ? info.participants : [];
  return lista.map(membro).filter(Boolean) as Membro[];
}

/** o número da B7 (telefone) é admin do grupo? null quando não dá para saber (sem telefone, ou membros só com @lid) */
export function b7AdminDe(membros: Membro[], telefoneDoNumero: string | null): boolean | null {
  const t = String(telefoneDoNumero || '').replace(/\D/g, '');
  if (!t) return null;
  const eu = membros.find(m => m.telefone === t);
  if (eu) return !!eu.admin;
  return membros.some(m => !m.telefone) ? null : false;
}

export function dadosGrupo(info: any) {
  const bool = (v: unknown) => typeof v === 'boolean' ? v : null;
  const c = Number(info?.creation || 0);
  return {
    nome: info?.subject ? String(info.subject) : null,
    descricao: info?.desc != null ? String(info.desc) : null,
    criado_wa: c ? new Date(c * 1000).toISOString() : null,
    dono_jid: info?.owner ? String(info.owner) : null,
    so_admins_enviam: bool(info?.announce),
    so_admins_editam: bool(info?.restrict),
    membros_qtd: Number(info?.size) || (Array.isArray(info?.participants) ? info.participants.length : null)
  };
}

const ACOES = ['add', 'remove', 'promote', 'demote'];
export function eventoParticipantes(d: any): { grupo: string; acao: 'add' | 'remove' | 'promote' | 'demote'; membros: Membro[] } | null {
  const grupo = String(d?.id || d?.groupJid || '');
  const acao = String(d?.action || '').toLowerCase();
  if (!/@g\.us$/.test(grupo) || !ACOES.includes(acao)) return null;
  const membros = (Array.isArray(d?.participants) ? d.participants : []).map(membro).filter(Boolean) as Membro[];
  if (!membros.length) return null;
  return { grupo, acao: acao as any, membros };
}

/** o que se manda ao Evolution para adicionar/remover: telefone (10–15 dígitos) ou um jid */
export function participanteParaEnvio(x: string): string | null {
  const s = String(x || '').trim();
  if (/^[\d]+(@s\.whatsapp\.net|@lid)$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}

const MOTIVO: Record<string, string> = {
  '403': 'o WhatsApp não deixou adicionar pela privacidade dele (mande o link de convite)',
  '409': 'já está no grupo',
  '404': 'não tem WhatsApp',
  '408': 'saiu do grupo há pouco e não pode ser adicionado agora'
};
export function resultadoMembros(resp: any, pedidos: string[]): { ok: string[]; falhou: { quem: string; motivo: string }[] } {
  const lista = Array.isArray(resp) ? resp : Array.isArray(resp?.updateParticipants) ? resp.updateParticipants : null;
  if (!lista) return { ok: [...pedidos], falhou: [] };
  const ok: string[] = [], falhou: { quem: string; motivo: string }[] = [];
  for (const x of lista) {
    const quem = String(x?.jid || x?.id || '');
    const st = String(x?.status ?? '200');
    if (st === '200') ok.push(quem); else falhou.push({ quem, motivo: MOTIVO[st] || 'o WhatsApp recusou (' + st + ')' });
  }
  return { ok, falhou };
}
