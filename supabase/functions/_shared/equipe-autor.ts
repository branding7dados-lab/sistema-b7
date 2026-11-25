// =====================================================================
// 4.91.6 — QUEM ESCREVEU É DA EQUIPE? Uma regra só.
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

/** 4.91.7: desde quando o CLIENTE espera a gente (a IA disse que a próxima mensagem é da equipe).
 *  null quando a EQUIPE FALOU POR ÚLTIMO: ela já respondeu — o que falta é uma entrega (ex.: "falta enviar o PDF"),
 *  não uma resposta, e o Otto não cobra "sem resposta" (antes a espera virava o horário da própria resposta da
 *  equipe e o lembrete repetia a cada 3 h: "Mercato há 8 dias", "Infinite Fio há 18h").
 *  Se a equipe falou depois do começo da espera antiga, conta da fala seguinte do cliente. */
export function desdeClienteEspera(lista: { criada_em: string }[], daEquipe: boolean[], esperandoDesde: string | null): string | null {
  const n = lista.length;
  if (!n || daEquipe[n - 1]) return null;
  let k = -1; for (let i = n - 1; i >= 0; i--) if (daEquipe[i]) { k = i; break; }
  const primeiraDoCliente = lista[k + 1].criada_em;   /* a fala do cliente depois da última da equipe (ou a 1ª, se a equipe não aparece) */
  const respondeuDepois = !!esperandoDesde && lista.some((m, i) => daEquipe[i] && m.criada_em > esperandoDesde);
  return (respondeuDepois ? primeiraDoCliente : esperandoDesde) || primeiraDoCliente;
}
