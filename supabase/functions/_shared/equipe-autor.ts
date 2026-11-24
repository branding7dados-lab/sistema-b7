// =====================================================================
// 4.91.1 — QUEM ESCREVEU É DA EQUIPE? Uma regra só.
//
// Antes eram três regras diferentes: a gravação da mensagem e a avaliação
// "de quem é a vez" olhavam só o número; o vigia olhava número e nome.
// Quem respondia do celular pessoal com o número fora da lista do Otto
// (ou por um @lid sem número conhecido) virava "cliente" e o relógio
// de "cliente esperando" nunca zerava: o lembrete cobrava por dias.
//
// Regra: é da equipe se (1) o número (8 últimos dígitos) é de alguém da
// equipe do Otto, ou (2) o nome no WhatsApp é o nome de alguém da equipe
// ou de uma conta da casa no B7: nome e sobrenome batem (primeira e última
// palavra); nome de uma palavra só, só se for exatamente igual.
// Funções puras (testes/equipe-autor.test.mjs).
// =====================================================================

export const semAcento = (v: unknown) => String(v || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
export const fim8 = (v: unknown) => { const d = String(v || '').split('@')[0].split(':')[0].replace(/\D/g, ''); return d.length >= 10 ? d.slice(-8) : ''; };

/** os nomes da equipe, prontos para comparar (sem acento, sem repetição) */
export function nomesPreparados(nomes: unknown[]): string[] {
  return [...new Set(nomes.map(semAcento).filter(n => n.length >= 3))];
}

/** o nome no WhatsApp é de alguém da equipe? */
export function nomeEhDaEquipe(nomes: string[], autor: unknown): boolean {
  const a = semAcento(autor);
  if (!a || /^\d+$/.test(a.replace(/ /g, ''))) return false;
  const pa = a.split(' ');
  return nomes.some(n => {
    const pn = n.split(' ');
    if (pn.length === 1) return a === n;
    return pa[0] === pn[0] && pa.includes(pn[pn.length - 1]);
  });
}

/** é da equipe? (número OU nome; mensagem do próprio número do B7 sempre é) */
export function ehDaEquipe(eq: { nums: Set<string>; nomes: string[] }, m: { de_mim?: unknown; autor_nome?: unknown }, fone?: unknown): boolean {
  if (m.de_mim) return true;
  const f = fim8(fone);
  if (f && eq.nums.has(f)) return true;
  return nomeEhDaEquipe(eq.nomes, m.autor_nome);
}
