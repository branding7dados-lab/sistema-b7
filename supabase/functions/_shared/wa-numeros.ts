// =====================================================================
// VÁRIOS NÚMEROS DE WHATSAPP (4.84.0) — peças puras (sem banco, sem rede)
//   • de qual instância do Evolution veio um evento do webhook;
//   • quem pode ver cada número (espelha wa_pode_ver_numero do banco);
//   • nome da instância de um número novo;
//   • resolvedor com cache curto (id / instância / padrão).
// =====================================================================

export type Numero = {
  id: string; nome: string; instancia: string; cor: string; equipes: string[];
  padrao: boolean; ativo: boolean; numero: string | null; estado: string | null;
};
export type PerfilWa = { eh_admin?: boolean; papel?: string; estado?: string; funcoes_adicionais?: string[] | null };

export const EQUIPES = ['videomaker', 'designer', 'coordenador'];

/** o Evolution manda "instance": "<nome>" (v2) ou { instanceName } em alguns eventos */
export function instanciaDoEvento(corpo: any): string {
  const i = corpo?.instance;
  if (typeof i === 'string') return i;
  if (i && typeof i.instanceName === 'string') return i.instanceName;
  return '';
}

export function podeVerNumero(p: PerfilWa, n: Numero): boolean {
  if (!p || p.estado === 'inativa' || (p.estado && p.estado !== 'ativa')) return false;
  if (p.eh_admin) return true;
  if (!n.ativo || p.papel === 'cliente') return false;
  const minhas = [p.papel || '', ...(p.funcoes_adicionais || [])];
  return n.equipes.some(e => minhas.includes(e));
}

export function instanciaNova(nome: string, existentes: string[]): string {
  const slug = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '') || 'numero';
  const base = 'b7-' + slug;
  if (!existentes.includes(base)) return base;
  for (let k = 2; ; k++) if (!existentes.includes(base + '-' + k)) return base + '-' + k;
}

export function criarResolvedor(buscar: () => Promise<Numero[]>, ttlMs = 30000) {
  let cache: Numero[] | null = null, em = 0;
  const todos = async (): Promise<Numero[]> => {
    if (!cache || Date.now() - em > ttlMs) { cache = (await buscar()) || []; em = Date.now(); }
    return cache;
  };
  const padrao = async () => (await todos()).find(n => n.padrao) || null;
  return {
    todos, padrao,
    async porId(id?: string | null) { return id ? (await todos()).find(n => n.id === id) || null : padrao(); },
    async porInstancia(i: string) { return i ? (await todos()).find(n => n.instancia === i) || null : null; },
    limpar() { cache = null; }
  };
}
