// =====================================================================
// oportunidades-sync — sincroniza as FONTES de Oportunidades (fase 7)
//
// Roda no backend (Supabase Edge Function), nunca no navegador. O
// Calendário B7 só lê o banco local já normalizado.
//
// Adaptadores (um por fonte, sem crawler genérico):
//   ms_calendario  Ministério da Saúde — Calendário da Saúde (HTML oficial)
//   oms            OMS — campanhas oficiais (HTML oficial): proveniência
//   onu            ONU — lista de dias e semanas internacionais (HTML oficial)
//   brasilapi      BrasilAPI — feriados nacionais (API JSON pública)
// Câmara/Planalto/conselhos: cadastro assistido/verificação (não há API).
//
// Cada adaptador SÓ busca e interpreta. Quem grava é a função do banco
// public.oportunidades_aplicar_lote (idempotente; falha ou lote suspeito
// não altera nada; nunca apaga).
//
// Disparo:
//   • pg_cron semanal (chave pública anon): só as fontes "vencidas" e no
//     máximo uma rodada a cada 30 min — não martela os sites oficiais.
//   • "Sincronizar agora" (admin, com JWT): pode forçar (mín. 5 min).
//
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY vêm da plataforma.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERSAO = '2026-09-30-op2';
const UA = 'Branding7-B7/1.0 (calendario editorial interno)';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Item = Record<string, unknown>;

// ------------------------------------------------------------ utilidades
const MESES_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_PT_ROT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DOW: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

function norm(t: string): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const ENT: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', ordf: 'ª', ordm: 'º', deg: '°', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' };
function decode(t: string): string {
  return t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const texto = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function buscar(url: string, ms = 20000): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + url);
    return await r.text();
  } finally { clearTimeout(t); }
}

// categorias (temas) por palavra-chave — determinístico e documentado
const CAT_PT: [RegExp, string][] = [
  [/\b(bucal|oral|dent|odontolog|boca)/, 'odontologia'],
  [/\b(visao|ocular|olho|olhos|glaucoma|oftalm|retinoblastoma|cegueira|catarata)/, 'otica'],
  [/\b(obesidade|alimenta|nutri|celiac|colesterol)/, 'nutricao'],
  [/\b(medicament|farmac)/, 'farmacia'],
  [/\b(transito|acidente de transito|motorista)/, 'transito'],
  [/\b(atividade fisica|sedentarismo|esporte)/, 'esporte'],
  [/\b(escola|escolar|estudante|professor|educacao)/, 'educacao'],
  [/\b(agua|meio ambiente|ambiental)/, 'meio_ambiente']
];
const CAT_EN: [RegExp, string[]][] = [
  [/\b(health|disease|aids|hiv|malaria|tuberculosis|\btb\b|hepatitis|blood|tobacco|diabetes|cancer|autism|mental|hearing|polio|immuni[sz]ation|patient|hygiene|hypertension|kidney|heart|stroke|epilepsy|lupus|obesity|alzheimer|parkinson|osteoporosis|psoriasis|suicide|thalass|sickle|prematurity|breastfeeding|drowning|leprosy|zoonos|antimicrobial|chagas|tropical diseases|down syndrome|cerebral palsy|rare disease|snakebite|neglected|pneumonia|glaucoma|midwi|nurs|pharmac|veterinar|pandemic|epidemic|disabilit|braille|sign language|deaf)/, ['saude']],
  [/\b(oral health|dental)/, ['odontologia']],
  [/\b(sight|vision|eye)/, ['otica']],
  [/\b(nutrition|obesity|food|pulses|breakfast|tea day|coffee|cocoa|olive|rice|potato|bread|fish|hunger|milk)/, ['gastronomia']],
  [/\b(nutrition|obesity)/, ['nutricao']],
  [/\b(education|literacy|teachers?|students?|universit|school)/, ['educacao']],
  [/\b(environment|climate|water|forest|ocean|wetland|biodiversity|earth|wildlife|bees|soil|desertification|ozone|clean energy|recycling|habitat|mountain|tree|sea|nature|air|zero waste|glacier|migratory|sustainable)/, ['meio_ambiente']],
  [/\b(culture|language|jazz|art|heritage|poetry|book|radio|cinema|music|dance|television|museum|mother language|translation|diversity)/, ['cultura']],
  [/\b(science|technology|internet|telecommunication|information society|digital|ict|statistics|space|cyber|artificial intelligence)/, ['tecnologia']],
  [/\b(sport|olympic|chess|football|cycling|yoga|bicycle|physical activity)/, ['esporte']],
  [/\b(road|traffic)/, ['transito']],
  [/\b(family|families|mother|father|parents|children|child|grandparents|older persons|youth|women|girls)/, ['familia']],
  [/\b(justice|law|human rights|legal|rule of law|corruption|democracy)/, ['direito']],
  [/\b(cooperatives|entrepreneurship|msme|small business|tourism|trade|consumer)/, ['comercio']],
  [/\b(rural|agricultur|farmer|pastoral|family farming|seeds|plant health)/, ['agro']]
];
const EN_PT: [RegExp, string][] = [
  [/\bhealth\b/, 'saude'], [/\bwater\b/, 'agua'], [/tuberculosis|\btb\b/, 'tuberculose'], [/malaria/, 'malaria'], [/\baids\b/, 'aids'],
  [/hepatitis/, 'hepatite'], [/blood/, 'sangue'], [/tobacco/, 'tabaco'], [/diabetes/, 'diabetes'], [/cancer/, 'cancer'],
  [/autism/, 'autismo'], [/down syndrome/, 'down'], [/mental/, 'mental'], [/hearing/, 'audicao'], [/sight|vision/, 'visao'],
  [/oral health/, 'bucal'], [/food/, 'alimentacao'], [/teachers?/, 'professor'], [/disabilit/, 'deficiencia'], [/chagas/, 'chagas'],
  [/polio/, 'polio'], [/patient safety/, 'seguranca do paciente'], [/immuni[sz]ation/, 'imuniza'], [/hypertension/, 'hipertensao'],
  [/kidney/, 'renal'], [/heart/, 'coracao'], [/epilepsy/, 'epilepsia'], [/lupus/, 'lupus'], [/obesity/, 'obesidade'],
  [/alzheimer/, 'alzheimer'], [/parkinson/, 'parkinson'], [/osteoporosis/, 'osteoporose'], [/psoriasis/, 'psoriase'],
  [/suicide/, 'suicidio'], [/thalass/, 'talassemia'], [/sickle/, 'falciforme'], [/prematurity/, 'prematur'],
  [/breastfeeding/, 'amamenta'], [/neglected tropical/, 'tropicais negligenciadas'], [/leprosy/, 'hanseniase'],
  [/antimicrobial/, 'antimicrobiana'], [/cervical cancer/, 'colo do utero'], [/braille/, 'braille'], [/sign language/, 'sinais'],
  [/rare disease/, 'raras'], [/snakebite/, 'ofidic'], [/multiple sclerosis/, 'esclerose multipla'], [/zoonos/, 'zoonose']
];
function categoriasPt(nome: string): string[] {
  const n = norm(nome), s = new Set<string>(['saude']);
  CAT_PT.forEach(([re, c]) => { if (re.test(n)) s.add(c); });
  return [...s];
}
function categoriasEn(nome: string): string[] {
  const n = nome.toLowerCase(), s = new Set<string>();
  CAT_EN.forEach(([re, cs]) => { if (re.test(n)) cs.forEach(c => s.add(c)); });
  return [...s];
}
function palavrasPt(nomeEn: string): string[] {
  const n = nomeEn.toLowerCase(); const out: string[] = [];
  EN_PT.forEach(([re, p]) => { if (re.test(n)) out.push(p); });
  return [...new Set(out)];
}
function tagsDe(nome: string): string[] {
  return norm(nome).split(' ').filter(w => w.length > 4 && !['mundial', 'nacional', 'internacional', 'contra', 'combate', 'semana', 'sobre', 'prevencao', 'conscientizacao', 'world', 'international', 'awareness'].includes(w)).slice(0, 6);
}
const diasDoMes = (m: number) => new Date(2025, m, 0).getDate();   // ano não bissexto (duração)

// ------------------------------------------------ Ministério da Saúde
async function adaptadorMS(url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const html = await buscar(url);
  const core = html.split('id="content-core"')[1] || '';
  if (!core) throw new Error('Estrutura da página mudou (content-core não encontrado).');
  const partes = core.split(/<a class="toggle[^"]*"[^>]*>\s*(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*<\/a>/i);
  const itens: Item[] = [], ignorados: string[] = [];
  for (let i = 1; i < partes.length; i += 2) {
    const mes = MESES_PT.indexOf(norm(partes[i])) + 1;
    const corpo = (partes[i + 1] || '').split(/<\/div>\s*<\/li>/)[0];
    const blocos = corpo.replace(/<br\s*\/?>|<\/li>|<\/p>|<li[^>]*>|<p[^>]*>|<div[^>]*>|<\/div>/gi, '\u0001').split('\u0001');
    for (const b of blocos) {
      const t = texto(b).replace(/^\*\s*/, '');
      if (!t || t.length < 6) continue;
      const leis = [...b.matchAll(/<a[^>]+href="([^"]+(?:planalto|camara|legin)[^"]*)"[^>]*>([^<]*)<\/a>/gi)];
      const detalhe = leis.length ? texto(leis[0][2]).replace(/[()]/g, '') : null;
      const urlLei = leis.length ? leis[0][1] : null;
      const m = t.match(/^(.+?)\s*[-–]\s+(.+)$/) || t.match(/^(\d{1,2}\/\d{1,2})\s*[-–]\s*(.+)$/);
      if (!m) { ignorados.push(t.slice(0, 80)); continue; }
      const quando = norm(m[1]);
      let nome = m[2].replace(/\s*\((?:[^()]*)\)\s*$/g, '').replace(/\s*\((?:[^()]*)\)\s*$/g, '').replace(/[.;:\s]+$/, '').trim();
      nome = nome.replace(/\s*\(Data instituída[^)]*\)?/i, '').trim();
      if (nome.length < 4) { ignorados.push(t.slice(0, 80)); continue; }
      let base: Item | null = null;
      let r: RegExpMatchArray | null;
      if ((r = m[1].match(/^(\d{1,2})\/(\d{1,2})$/))) base = { tipo_data: 'fixa', dia: +r[1], mes: +r[2] };
      else if ((r = m[1].match(/^(\d{1,2})\s*a\s*(\d{1,2})\/(\d{1,2})$/))) base = { tipo_data: 'fixa', dia: +r[1], mes: +r[3], duracao: +r[2] - +r[1] + 1 };
      else if ((r = m[1].match(/^(\d{1,2})\/(\d{1,2})\s*a\s*(\d{1,2})\/(\d{1,2})$/))) {
        const ini = new Date(2025, +r[2] - 1, +r[1]), fim = new Date(2025, +r[4] - 1, +r[3]);
        base = { tipo_data: 'fixa', dia: +r[1], mes: +r[2], duracao: Math.round((+fim - +ini) / 864e5) + 1 };
      } else if ((r = m[1].match(/^(\d{1,2})\s*(?:a|-)\s*(\d{1,2})$/)) && mes) base = { tipo_data: 'fixa', dia: +r[1], mes, duracao: +r[2] - +r[1] + 1 };
      else if ((r = quando.match(/^(\d)\s*[ao]?\s*(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?: feira)?(?: do mes)?$/)) && mes) base = { tipo_data: 'regra', regra: 'nth:' + mes + ':' + DOW[r[2]] + ':' + r[1] };
      else if (/^ultimo dia( do mes)?$/.test(quando) && mes) base = { tipo_data: 'regra', regra: 'ultimo_dia:' + mes };
      else if ((r = quando.match(/^(ultimo|ultima|penultimo|penultima)\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo)/)) && mes) base = { tipo_data: 'regra', regra: 'nth:' + mes + ':' + DOW[r[2]] + ':' + (r[1].startsWith('pen') ? -2 : -1) };
      else if ((r = quando.match(/^(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+([a-z]+)$/))) {
        const mm = MESES_PT.indexOf(r[1]) + 1;
        base = { tipo_data: 'regra', regra: 'mes_inteiro:' + mm, natureza: 'campanha', duracao: diasDoMes(mm) };
        nome = MESES_PT_ROT[mm - 1] + ' ' + r[2].replace(/^./, c => c.toUpperCase()) + ' — ' + nome;
      }
      if (!base) { ignorados.push(t.slice(0, 80)); continue; }
      const dur = +(base.duracao ?? 1);
      if (!(dur >= 1 && dur <= 31)) { ignorados.push(t.slice(0, 80) + ' [duração inválida]'); continue; }
      itens.push({
        ...base, referencia: 'ms:' + (mes || 0) + ':' + norm(nome), nome, titulo_na_fonte: nome,
        natureza: base.natureza || (/^semana/i.test(nome) ? 'campanha' : 'comemorativa'),
        abrangencia: /internacional|mundial|americas/i.test(nome) ? 'internacional' : 'nacional',
        categorias: categoriasPt(nome), tags: tagsDe(nome), confiabilidade: 'oficial',
        url: urlLei || url, detalhe: detalhe || 'Calendário da Saúde — Ministério da Saúde'
      });
    }
  }
  return { itens, ignorados };
}

// ------------------------------------------------------------------ OMS
/* nomes oficiais em português das campanhas da OMS (para ligar às datas
   do Ministério da Saúde sem duplicar) */
const OMS_PT: Record<string, [string, string[]]> = {
  'world neglected tropical diseases day': ['Dia Mundial das Doenças Tropicais Negligenciadas', ['tropicais negligenciadas']],
  'world tb day': ['Dia Mundial da Tuberculose', ['tuberculose']],
  'world health day': ['Dia Mundial da Saúde', ['saude']],
  'world chagas disease day': ['Dia Mundial da Doença de Chagas', ['chagas']],
  'world malaria day': ['Dia Mundial da Malária', ['malaria']],
  'world no tobacco day': ['Dia Mundial sem Tabaco', ['tabaco']],
  'world blood donor day': ['Dia Mundial do Doador de Sangue', ['sangue']],
  'world drowning prevention day': ['Dia Mundial de Prevenção do Afogamento', ['afogamento']],
  'world hepatitis day': ['Dia Mundial de Luta contra as Hepatites Virais', ['hepatite']],
  'world patient safety day': ['Dia Mundial da Segurança do Paciente', ['seguranca do paciente']],
  'world prematurity day': ['Dia Mundial da Prematuridade', ['prematur']],
  'world cervical cancer elimination day': ['Dia de Ação pela Eliminação do Câncer do Colo do Útero', ['colo do utero']],
  'world aids day': ['Dia Mundial de Luta contra a Aids', ['aids']],
  'world immunization week': ['Semana Mundial de Imunização', ['imuniza']],
  'world amr awareness week': ['Semana Mundial de Conscientização sobre a Resistência Antimicrobiana', ['antimicrobian']]
};
async function adaptadorOMS(url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const html = await buscar(url);
  const itens: Item[] = [], ignorados: string[] = [];
  const re = /class="item--title">\s*([^<]+?)\s*<\/div>[\s\S]{0,600}?class="item--abstract">\s*([^<]+?)\s*<\/div>/g;
  for (const m of html.matchAll(re)) {
    const en = decode(m[1]).trim(), quando = decode(m[2]).trim();
    const d = quando.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s+([A-Za-z]+)$/);
    const mi = d ? MESES_EN.indexOf(d[3].slice(0, 3).toLowerCase()) : -1;
    if (!d || mi < 0) { ignorados.push(en + ' — ' + quando); continue; }
    const pt = OMS_PT[norm(en)];
    const nome = pt ? pt[0] : en;
    itens.push({
      referencia: 'oms:' + norm(en), nome, titulo_na_fonte: en, aliases: [en], tipo_data: 'fixa', mes: mi + 1, dia: +d[1],
      duracao: d[2] ? +d[2] - +d[1] + 1 : 1, natureza: d[2] ? 'campanha' : 'comemorativa', abrangencia: 'internacional',
      categorias: ['saude'], tags: tagsDe(nome), confiabilidade: 'oficial', palavras_pt: pt ? pt[1] : palavrasPt(en),
      url: 'https://www.who.int/campaigns', detalhe: 'Campanha oficial de saúde pública da OMS'
    });
  }
  return { itens, ignorados };
}

// ------------------------------------------------------------------ ONU
async function adaptadorONU(url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const html = await buscar(url);
  const itens: Item[] = [], ignorados: string[] = [];
  const anoAtual = new Date().getUTCFullYear();
  const linhas = html.split('<div class="views-row').slice(1);
  for (const l of linhas) {
    const t = l.match(/views-field-title[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const dt = l.match(/content="(\d{4})-(\d{2})-(\d{2})T/);
    const res = l.match(/views-field-field-url[\s\S]*?<a [^>]*>([^<]+)<\/a>/);
    if (!t || !dt) { ignorados.push(texto(l).slice(0, 80)); continue; }
    const nome = decode(t[2]).replace(/\s+/g, ' ').trim();
    const ano = +dt[1], mes = +dt[2], dia = +dt[3];
    const semana = /week/i.test(nome), rng = nome.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+[A-Z][a-z]+/);
    /* ano antigo = data fixa anual (a ONU usa um ano-base); ano recente =
       data de um ano específico (dias móveis): só aquela data, sem inventar regra */
    const base: Item = ano <= anoAtual - 2
      ? { tipo_data: 'fixa', mes, dia }
      : { tipo_data: 'datas', datas: [{ data: dt[1] + '-' + dt[2] + '-' + dt[3] }] };
    itens.push({
      ...base, referencia: 'onu:' + norm(nome), nome, titulo_na_fonte: nome, duracao: semana && rng ? +rng[2] - +rng[1] + 1 : (semana ? 7 : 1),
      natureza: semana ? 'campanha' : 'comemorativa', abrangencia: 'internacional', categorias: categoriasEn(nome), tags: tagsDe(nome),
      confiabilidade: 'oficial', palavras_pt: base.tipo_data === 'fixa' ? palavrasPt(nome) : [],
      url: t[1].startsWith('http') ? t[1] : 'https://www.un.org' + t[1], detalhe: res ? 'Resolução ' + decode(res[1]).trim() : 'Nações Unidas'
    });
  }
  return { itens, ignorados };
}

// ------------------------------------------------------------ BrasilAPI
async function adaptadorBrasilAPI(url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const ano = new Date().getUTCFullYear();
  const porNome = new Map<string, Item>();
  for (const a of [ano, ano + 1]) {
    const lista = JSON.parse(await buscar(url + a)) as { date: string; name: string; type: string }[];
    if (!Array.isArray(lista)) throw new Error('Resposta inesperada da BrasilAPI');
    for (const f of lista) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !f.name) continue;
      const k = norm(f.name);
      const it = porNome.get(k) || {
        referencia: 'feriado:' + k, nome: f.name, titulo_na_fonte: f.name, tipo_data: 'datas', datas: [] as { data: string }[],
        natureza: 'feriado', abrangencia: f.type === 'national' ? 'nacional' : 'estadual', categorias: [], tags: ['feriado'],
        geral: true, confiabilidade: 'verificada', url: url + a, detalhe: 'Feriado nacional (BrasilAPI)'
      };
      (it.datas as { data: string }[]).push({ data: f.date });
      porNome.set(k, it);
    }
  }
  return { itens: [...porNome.values()], ignorados: [] };
}

const ADAPTADORES: Record<string, (url: string) => Promise<{ itens: Item[]; ignorados: string[] }>> = {
  ms_calendario: adaptadorMS, oms: adaptadorOMS, onu: adaptadorONU, brasilapi: adaptadorBrasilAPI
};

// ------------------------------------------------------------ handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let corpo: { fontes?: string[]; forcar?: boolean; diagnostico?: boolean } = {};
  try { corpo = await req.json(); } catch (_) { /* cron sem corpo */ }

  /* quem chamou? JWT de usuário → pode forçar só se for admin */
  let ehAdmin = false;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (token && token.split('.').length === 3) {
    const u = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } });
    const { data } = await u.rpc('oportunidades_posso_sincronizar');
    ehAdmin = data === true;
  }
  const forcar = !!corpo.forcar && ehAdmin;
  if ((corpo.forcar || corpo.diagnostico) && !ehAdmin) return json({ erro: 'Só administradores sincronizam manualmente.' }, 403);

  const { data: fontes, error } = await admin.from('oportunidade_fontes').select('*').eq('metodo', 'automatica').eq('ativo', true);
  if (error) return json({ erro: error.message }, 500);
  const agora = Date.now();
  /* anti-martelada global: sem admin, no máximo uma rodada a cada 30 min */
  if (!forcar && fontes!.some(f => f.ultima_tentativa && agora - Date.parse(f.ultima_tentativa) < 30 * 60e3)) {
    return json({ versao: VERSAO, pulado: 'sincronização recente (menos de 30 min)' });
  }
  const resultados: Record<string, unknown> = {};
  /* ordem importa: as datas oficiais em português (Ministério da Saúde)
     entram antes das listas em inglês (OMS/ONU), que se ligam a elas */
  const ORDEM = ['ms_calendario', 'brasilapi', 'oms', 'onu'];
  fontes!.sort((a, b) => (ORDEM.indexOf(a.id) + 1 || 99) - (ORDEM.indexOf(b.id) + 1 || 99));
  for (const f of fontes!) {
    if (corpo.fontes && !corpo.fontes.includes(f.id)) continue;
    const ultima = f.ultima_tentativa ? Date.parse(f.ultima_tentativa) : 0;
    const vencida = agora - ultima >= f.frequencia_dias * 864e5 * 0.9;
    if (!(vencida || (forcar && agora - ultima > 5 * 60e3))) { resultados[f.id] = 'em dia'; continue; }
    const ad = ADAPTADORES[f.id];
    if (!ad) { resultados[f.id] = 'sem adaptador'; continue; }
    try {
      const { itens, ignorados } = await ad(f.url);
      if (corpo.diagnostico && ehAdmin) { resultados[f.id] = { itens: itens.length, amostra: itens.slice(0, 5), ignorados }; continue; }
      const { data: r, error: e } = await admin.rpc('oportunidades_aplicar_lote', { p_fonte: f.id, p_itens: itens, p_erro: null, p_disparo: forcar ? 'manual' : 'cron' });
      if (e) {
        /* erro ao gravar: registra como falha da fonte (nada parcial fica gravado) */
        await admin.rpc('oportunidades_aplicar_lote', { p_fonte: f.id, p_itens: [], p_erro: 'Erro ao gravar: ' + e.message, p_disparo: forcar ? 'manual' : 'cron' });
        resultados[f.id] = { status: 'falha', erro: e.message };
      } else resultados[f.id] = { ...(r as object), nao_interpretados: ignorados.length, amostra_nao_interpretados: ignorados.slice(0, 8) };
    } catch (e) {
      const msg = (e as Error).message || String(e);
      await admin.rpc('oportunidades_aplicar_lote', { p_fonte: f.id, p_itens: [], p_erro: msg, p_disparo: forcar ? 'manual' : 'cron' });
      resultados[f.id] = { status: 'falha', erro: msg };
    }
  }
  return json({ versao: VERSAO, resultados });
});
