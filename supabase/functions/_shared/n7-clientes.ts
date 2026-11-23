// =====================================================================
// PUXAR O CADASTRO DOS CLIENTES DO NÚCLEO 7 (4.89.0) — peças puras
// (sem banco, sem rede), usadas pela função n7-clientes e pelos testes.
//
//   • que colunas pedir ao Núcleo 7 (lista fixa);
//   • de cada linha de lá, só os campos que o cadastro do B7 usa —
//     nada de valor, pagamento, senha ou acesso sai daqui;
//   • achar o cliente do Núcleo 7 que é o mesmo do B7;
//   • o que trazer para cada campo, com as mesmas regras do B7.
// Desenho: docs/superpowers/specs/2026-11-23-nucleo7-ligacao-design.md
// =====================================================================

/** As colunas de `clients` que o B7 pede. `branding` e `dados_contratuais` vêm
 *  inteiros do Núcleo 7, mas só alguns campos deles são lidos (ver `limpar`). */
export const COLUNAS_N7 = 'id,name,status,cnpj,area_atuacao,segmento,audience_location,instagram,website,logo_url,' +
  'contract_months,contract_start_date,observations,holder_name,dados_contratuais,branding';

/** O cliente do Núcleo 7 do jeito que o B7 enxerga. Tudo texto (ou nulo). */
export type ClienteN7 = {
  id: string; nome: string; situacao: string;
  cnpj: string; nicho: string; cidade: string; instagram: string; site: string; logo: string;
  meses: number | null; inicio: string; combinado: string;
  resp_nome: string; resp_cargo: string; resp_whatsapp: string; resp_email: string;
};

const txt = (v: unknown, max = 300): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim().slice(0, max);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const soNum = (s: string) => s.replace(/\D/g, '');

/** Uma linha crua do Núcleo 7 → só o que o cadastro do B7 usa.
 *  Monta campo a campo: o objeto de lá nunca é repassado (ele guarda acessos e senhas). */
export function limpar(l: Record<string, unknown>): ClienteN7 {
  const b = obj(l.branding), end = obj(b.address), rb = obj(b.responsavel), dc = obj(l.dados_contratuais);
  const cidadeB = [txt(end.city, 120), txt(end.state, 40)].filter(Boolean).join(' - ');
  const meses = Number(l.contract_months);
  return {
    id: txt(l.id, 80), nome: txt(l.name, 200), situacao: txt(l.status, 40).toLowerCase(),
    cnpj: txt(l.cnpj, 40),
    nicho: txt(l.area_atuacao, 160) || txt(l.segmento, 160),
    cidade: (cidadeB || txt(l.audience_location, 160)).slice(0, 160),   // o B7 aceita até 160
    instagram: txt(l.instagram, 120), site: txt(l.website, 300), logo: txt(l.logo_url, 600),
    meses: Number.isFinite(meses) && meses > 0 ? Math.round(meses) : null,
    inicio: txt(l.contract_start_date, 40), combinado: txt(l.observations, 4000),
    resp_nome: txt(rb.name, 160) || txt(l.holder_name, 160),
    resp_cargo: txt(rb.role, 160) || txt(dc.responsavel_cargo, 160),
    resp_whatsapp: txt(rb.whatsapp, 40) || txt(dc.responsavel_whatsapp, 40),
    resp_email: txt(rb.email, 160) || txt(dc.responsavel_email, 160),
  };
}

/** Nome comparável: minúsculas, sem acento, sem pontuação, espaços juntos. */
export function normalizar(nome: string): string {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const PARADO = new Set(['cancelado', 'inativo']);

export type Casamento =
  | { tipo: 'ligado'; cliente: ClienteN7 }          // pelo vínculo guardado
  | { tipo: 'achado'; cliente: ClienteN7 }          // um só com o mesmo nome
  | { tipo: 'escolher'; candidatos: ClienteN7[] }   // mais de um
  | { tipo: 'nenhum' };

/** Acha o cliente do Núcleo 7 que é o mesmo do B7.
 *  1º o vínculo guardado; 2º o nome. Cancelado/inativo só conta quando é o único com o nome. */
export function casar(b7: { nome: string; n7_id?: string | null }, lista: ClienteN7[]): Casamento {
  if (b7.n7_id) {
    const c = lista.find(x => x.id === b7.n7_id);
    if (c) return { tipo: 'ligado', cliente: c };
  }
  const alvo = normalizar(b7.nome);
  if (!alvo) return { tipo: 'nenhum' };
  const mesmos = lista.filter(x => normalizar(x.nome) === alvo);
  if (!mesmos.length) return { tipo: 'nenhum' };
  const vivos = mesmos.filter(x => !PARADO.has(x.situacao));
  const conta = vivos.length ? vivos : mesmos;
  return conta.length === 1 ? { tipo: 'achado', cliente: conta[0] } : { tipo: 'escolher', candidatos: conta };
}

/** Busca por parte do nome (para escolher à mão). */
export function buscar(termo: string, lista: ClienteN7[], limite = 20): ClienteN7[] {
  const t = normalizar(termo);
  if (t.length < 2) return [];
  return lista.filter(x => normalizar(x.nome).includes(t)).slice(0, limite);
}

/** Meses do Núcleo 7 → a duração do B7 (1, 3, 6 ou 12). */
export function duracaoDe(meses: number | null): 1 | 3 | 6 | 12 | null {
  if (!meses || meses < 1) return null;
  return meses <= 1 ? 1 : meses <= 3 ? 3 : meses <= 6 ? 6 : 12;
}

/** O cadastro do B7, do jeito que `cliente_cadastro` devolve (só o que importa aqui). */
export type CadastroB7 = {
  cliente: { contrato?: string; logo_url?: string | null };
  interno: Record<string, unknown>;
  perfil: Record<string, unknown>;
};

/** Um campo que pode ser trazido. `bloco`/`chave` dizem onde ele entra em `cliente_cadastro_salvar`. */
export type Campo = { campo: string; rotulo: string; bloco: 'interno' | 'perfil' | 'logo'; chave: string; b7: string; n7: string; vazio: boolean };

const ROTULOS: [string, string, 'interno' | 'perfil' | 'logo', string][] = [
  ['cnpj', 'CNPJ', 'interno', 'cnpj'],
  ['nicho', 'Área de atuação', 'perfil', 'nicho'],
  ['cidade', 'Cidade / estado', 'interno', 'cidade'],
  ['instagram', 'Instagram', 'perfil', 'instagram'],
  ['site', 'Site', 'perfil', 'site'],
  ['logo', 'Logo', 'logo', 'logo_n7'],
  ['inicio', 'Início do serviço', 'interno', 'inicio_servico'],
  ['meses', 'Duração do contrato', 'interno', 'contrato_meses'],
  ['resp_nome', 'Responsável', 'interno', 'resp_nome'],
  ['resp_cargo', 'Cargo do responsável', 'interno', 'resp_cargo'],
  ['resp_whatsapp', 'WhatsApp do responsável', 'interno', 'resp_whatsapp'],
  ['resp_email', 'E-mail do responsável', 'interno', 'resp_email'],
  ['combinado', 'O que foi combinado', 'interno', 'combinado'],
];

/** O valor do Núcleo 7 já no formato do B7, ou '' quando não serve. */
function valorN7(campo: string, c: ClienteN7, avulso: boolean): string {
  switch (campo) {
    case 'cnpj': { const n = soNum(c.cnpj); return n.length === 14 ? n : ''; }
    case 'instagram': return c.instagram.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').slice(0, 60);
    case 'logo': return /^https:\/\/\S+$/i.test(c.logo) ? c.logo : '';
    /* o B7 guarda o site sempre com https:// na frente (cliente_cadastro_salvar faz isso) */
    case 'site': { const s = c.site.trim(); return !s ? '' : /^https?:\/\//i.test(s) ? s : 'https://' + s; }
    case 'inicio': return /^\d{4}-\d{2}-\d{2}/.test(c.inicio) ? c.inicio.slice(0, 10) : '';
    case 'meses': { if (avulso) return ''; const d = duracaoDe(c.meses); return d ? String(d) : ''; }
    case 'resp_whatsapp': { const n = soNum(c.resp_whatsapp); return n.length >= 10 && n.length <= 13 ? n : ''; }
    case 'resp_email': { const e = c.resp_email.toLowerCase(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : ''; }
    default: return String((c as Record<string, unknown>)[campo] ?? '').trim();
  }
}

/** O valor do mesmo campo no B7, para comparar. */
function valorB7(campo: string, chave: string, bloco: string, b: CadastroB7): string {
  if (bloco === 'logo') return String(b.cliente.logo_url || '');
  const v = (bloco === 'perfil' ? b.perfil : b.interno)[chave];
  if (v == null) return '';
  if (campo === 'inicio') return String(v).slice(0, 10);
  return String(v).trim();
}
const semEsquema = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
const igual = (campo: string, a: string, b: string) =>
  campo === 'cnpj' || campo === 'resp_whatsapp' ? soNum(a) === soNum(b)
    : campo === 'site' ? semEsquema(a) === semEsquema(b)
    : normalizar(a) === normalizar(b) && (campo !== 'combinado' || a.trim() === b.trim());

/** O que dá para trazer do Núcleo 7: só campos preenchidos lá e diferentes do B7.
 *  `vazio` = o B7 está sem nada (esses entram marcados e são os únicos do "todos de uma vez"). */
export function proposta(b: CadastroB7, c: ClienteN7): Campo[] {
  const avulso = b.cliente.contrato === 'avulso';
  const out: Campo[] = [];
  for (const [campo, rotulo, bloco, chave] of ROTULOS) {
    const n7 = valorN7(campo, c, avulso);
    if (!n7) continue;
    const b7 = valorB7(campo, chave, bloco, b);
    if (b7 && igual(campo, b7, n7)) continue;
    if (bloco === 'logo' && b7) continue;            // a logo só entra quando o B7 está sem
    out.push({ campo, rotulo, bloco, chave, b7, n7, vazio: !b7 });
  }
  return out;
}

/** Os campos escolhidos → o corpo de `cliente_cadastro_salvar`. */
export function corpoSalvar(campos: Campo[], n7Id: string): Record<string, unknown> {
  const interno: Record<string, unknown> = { n7_cliente_id: n7Id }, perfil: Record<string, unknown> = {};
  let logo = '';
  for (const c of campos) {
    if (c.bloco === 'logo') logo = c.n7;
    else if (c.bloco === 'perfil') perfil[c.chave] = c.n7;
    else interno[c.chave] = c.chave === 'contrato_meses' ? Number(c.n7) : c.n7;
  }
  const d: Record<string, unknown> = { interno };
  if (Object.keys(perfil).length) d.perfil = perfil;
  if (logo) d.logo_n7 = logo;
  return d;
}

/** O que a tela pode ver de um cliente do Núcleo 7 (para escolher entre candidatos). */
export const resumo = (c: ClienteN7) => ({ id: c.id, nome: c.nome, situacao: c.situacao, cnpj: soNum(c.cnpj), cidade: c.cidade });
