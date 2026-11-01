const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const somaDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export function prazoTexto(iso?: string | null) {
  if (!iso) return 'sem prazo';
  const h = hojeISO(), dias = Math.round((new Date(iso + 'T12:00:00').getTime() - new Date(h + 'T12:00:00').getTime()) / 864e5);
  if (dias < -1) return 'atrasado ' + -dias + ' dias';
  if (dias === -1) return 'venceu ontem';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias < 7) return DIAS[new Date(iso + 'T12:00:00').getDay()];
  return iso.slice(8, 10) + ' ' + MESES[+iso.slice(5, 7) - 1];
}
export function diaCurto(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return DIAS[d.getDay()].slice(0, 3) + ', ' + iso.slice(8, 10) + ' ' + MESES[+iso.slice(5, 7) - 1];
}
export function saudacao() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
export function dataExtenso() { const d = new Date(); return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][d.getMonth()]; }
