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

/** Acesso a wa_conversas / wa_mensagens PRESO a um número (o padrão, para o Otto).
    select/update/delete ganham .eq('numero_id', id) logo depois; insert/upsert levam numero_id em cada linha
    e o onConflict passa a incluir numero_id. Funciona com await e com .then(ok, erro), como o supabase-js.
    Sem número (banco ainda sem a zzz383): passa direto, sem filtro. */
export function waPadraoCom(sb: any, idPadrao: () => Promise<string | null>) {
  const tab = (t: string) => {
    const montar = (primeiro: string, args: any[]) => {
      const cadeia: [string, any[]][] = [];
      const rodar = async () => {
        const id = await idPadrao();
        let q = sb.from(t);
        if (primeiro === 'insert' || primeiro === 'upsert') {
          const com = (r: any) => id ? { ...r, numero_id: id } : r;
          const linhas = Array.isArray(args[0]) ? args[0].map(com) : com(args[0]);
          let o = args[1];
          if (primeiro === 'upsert' && id && o?.onConflict && !/numero_id/.test(o.onConflict)) o = { ...o, onConflict: 'numero_id,' + o.onConflict };
          q = o === undefined ? q[primeiro](linhas) : q[primeiro](linhas, o);
        } else {
          q = q[primeiro](...args);
          if (id) q = q.eq('numero_id', id);
        }
        for (const [k, a] of cadeia) q = q[k](...a);
        return await q;
      };
      const p: any = new Proxy({}, { get(_, k: string) {
        if (k === 'then') return (ok?: any, erro?: any) => rodar().then(ok, erro);
        if (k === 'catch') return (erro?: any) => rodar().catch(erro);
        if (k === 'finally') return (f?: any) => rodar().finally(f);
        return (...a: any[]) => { cadeia.push([k, a]); return p; };
      } });
      return p;
    };
    return {
      select: (...a: any[]) => montar('select', a), update: (...a: any[]) => montar('update', a),
      delete: (...a: any[]) => montar('delete', a), insert: (...a: any[]) => montar('insert', a),
      upsert: (...a: any[]) => montar('upsert', a)
    };
  };
  return { conversas: () => tab('wa_conversas'), mensagens: () => tab('wa_mensagens') };
}

/* ------------------------------------------------ revisão final (4.84.0) */
/** a tabela wa_numeros ainda não existe (banco sem a zzz383) — só isso conta como "banco antigo";
    qualquer outro erro (tempo esgotado, 5xx) é passageiro e não pode mandar tudo para o número padrão */
export function semTabela(erro: any): boolean {
  return !!erro && ['42P01', 'PGRST205'].includes(String(erro.code || ''));
}

/** de qual número é um evento do webhook. Número criado há pouco: relê o cadastro antes de ignorar.
    Instância igual ao segredo EVOLUTION_INSTANCE e fora do cadastro = é o número padrão com o nome
    errado no banco — usa o padrão e pede para corrigir (corrigir = nome certo). */
export async function numeroDoEvento(r: ReturnType<typeof criarResolvedor>, inst: string, instEnv: string): Promise<{ numero: Numero | null; corrigir?: string }> {
  if (!inst) return { numero: null };
  let n = await r.porInstancia(inst);
  if (!n) { r.limpar(); n = await r.porInstancia(inst); }
  if (n) return { numero: n };
  if (inst === instEnv) { const p = await r.padrao(); if (p) return { numero: p, corrigir: inst }; }
  return { numero: null };
}

/** quem pode cada ação da wa-evolution. As do Otto (responder dúvida, sugerir resposta, voz) leem/enviam pelo
    número padrão, então exigem ver o padrão — não basta ver o número que veio no pedido. */
export const ACOES_ADMIN = ['estado', 'conectar', 'desconectar', 'importar', 'contatos', 'assistente_testar', 'assistente_pendencias', 'numeros', 'numero_salvar', 'numero_desativar',
  /* 4.85.0: mexer no grupo do WhatsApp — só o administrador do B7 */
  'grupo_membros', 'grupo_editar', 'grupo_foto', 'grupo_convite', 'grupo_regra', 'grupos_sync'];
export const ACOES_OTTO = ['responder_duvida', 'sugerir_resposta', 'voz_amostra'];
export function podeAcao(acao: string, p: PerfilWa, n: Numero | null, padrao: Numero | null): boolean {
  if (ACOES_ADMIN.includes(acao)) return !!p?.eh_admin && (!p.estado || p.estado === 'ativa');
  if (n && !n.ativo) return false;
  if (ACOES_OTTO.includes(acao)) return !!padrao && podeVerNumero(p, padrao);
  return !!n && podeVerNumero(p, n);
}
