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
//   ibge_municipios IBGE — lista oficial de municípios (só referência)
//   feriados_br    repositório feriados-brasil (MIT) — feriados estaduais
//                  e municipais das cidades dos clientes (secundária)
//   datas_br       mesmo repositório — datas populares/comerciais
// Câmara/Planalto/conselhos: cadastro assistido/verificação (não há API).
//
// Cada adaptador SÓ busca e interpreta. Quem grava é a função do banco
// public.oportunidades_aplicar_lote (idempotente; falha ou lote suspeito
// não altera nada; nunca apaga).
//
// Disparo:
//   • pg_cron semanal: cabeçalho x-b7-cron-secret com o segredo
//     B7_CRON_SECRET. Só as fontes "vencidas" e no máximo uma rodada a
//     cada 30 min — não martela os sites oficiais.
//   • "Sincronizar agora" (admin, com JWT): pode forçar (mín. 5 min).
//
// zzz51: antes a rodada normal bastava a chave PÚBLICA anon — a mesma que
// está em js/config.js, à vista de qualquer um que abra o site. Quem
// soubesse o endereço disparava a sincronização de todas as fontes à
// vontade: trabalho de graça no nosso servidor e tráfego em nome da
// Branding7 contra os sites oficiais (Ministério da Saúde, OMS, ONU,
// IBGE), que é como se perde acesso a eles. Agora toda rodada precisa ou
// do segredo do cron ou de um JWT de administrador.
//
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY vêm da
// plataforma. B7_CRON_SECRET é nosso:
//   supabase secrets set B7_CRON_SECRET=<segredo longo e aleatório>
// e o mesmo valor vai no cabeçalho do cron (migration_oportunidades_cron.sql).
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { comCors, iguais } from '../_shared/cors.ts';

const VERSAO = '2026-10-02-op3';
const UA = 'Branding7-B7/1.0 (calendario editorial interno)';
const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-b7-cron-secret',
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
/* A BrasilAPI marca Carnaval e Corpus Christi como "national", mas a lei
   federal de feriados não os inclui (ponto facultativo); Páscoa é domingo.
   Só vale para oportunidades novas: a natureza de uma que já existe não é
   mudada pela sincronização. */
const NATUREZA_BRASILAPI: Record<string, string> = { 'carnaval': 'facultativo', 'corpus christi': 'facultativo', 'pascoa': 'comemorativa' };
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
        natureza: NATUREZA_BRASILAPI[k] || 'feriado', abrangencia: 'nacional', categorias: [], tags: ['feriado'],
        geral: true, confiabilidade: 'verificada', url: url + a,
        detalhe: NATUREZA_BRASILAPI[k] === 'facultativo' ? 'Ponto facultativo nacional (BrasilAPI)' : 'Feriado nacional (BrasilAPI)'
      };
      (it.datas as { data: string }[]).push({ data: f.date });
      porNome.set(k, it);
    }
  }
  return { itens: [...porNome.values()], ignorados: [] };
}

// ------------------------------------------------- IBGE — municípios
/* Lista oficial (API de Localidades, sem chave). Não gera datas: alimenta
   a tabela municipios, de onde sai a cidade dos clientes. Grava pelo
   municipios_aplicar_lote, não pelo lote de oportunidades. */
async function adaptadorIBGE(url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const lista = JSON.parse(await buscar(url, 40000)) as Record<string, unknown>[];
  if (!Array.isArray(lista)) throw new Error('Resposta inesperada do IBGE');
  const itens: Item[] = [], ignorados: string[] = [];
  for (const m of lista) {
    const ibge = String(m['municipio-id'] ?? ''), nome = String(m['municipio-nome'] ?? '').trim(), uf = String(m['UF-sigla'] ?? '');
    if (/^\d{7}$/.test(ibge) && nome && /^[A-Z]{2}$/.test(uf)) itens.push({ ibge, nome, uf });
    else ignorados.push(JSON.stringify(m).slice(0, 80));
  }
  return { itens, ignorados };
}

// ------------------------------------- repositório feriados-brasil (MIT)
/* github.com/joaopbini/feriados-brasil — base comunitária, licença MIT,
   um arquivo JSON por ano: { data: 'DD/MM/AAAA', nome, tipo, descricao,
   uf, codigo_ibge }. Fonte SECUNDÁRIA: nada daqui vira "Oficial".
   Lê o ano atual (obrigatório) e o seguinte (se já publicado). */
const RAW_FERIADOS = 'https://raw.githubusercontent.com/joaopbini/feriados-brasil/master/dados/';
type Fer = { data: string; nome: string; tipo: string; descricao?: string | null; uf?: string | null; codigo_ibge?: number | string | null };
async function lerFeriados(pasta: string, ano: number, obrigatorio: boolean): Promise<Fer[] | null> {
  try {
    const j = JSON.parse(await buscar(RAW_FERIADOS + pasta + '/json/' + ano + '.json', 40000));
    if (!Array.isArray(j)) throw new Error('formato inesperado em ' + pasta + '/' + ano);
    return j as Fer[];
  } catch (e) {
    if (!obrigatorio && /HTTP 404/.test(String((e as Error).message))) return null;   /* ano ainda não publicado */
    throw e;
  }
}
const isoDeBR = (s: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const ehAniversario = (t: string) => /anivers|emancipa|funda[cç][aã]o/i.test(t);
/* temas por palavra-chave (determinístico) — datas populares e locais */
const CAT_LOCAL: [RegExp, string][] = [
  [/\b(namorad|maes|pais|avos|idoso|familia|natal|reveillon|ano novo)/, 'familia'],
  [/\b(crianca|criancas|jovem|juventude|estudante)/, 'infancia'],
  [/\b(santo|santa|sao|nossa senhora|catolic|evangel|padroeir|corpus|paixao|cristo|pascoa|natal|reis)\b/, 'religiao'],
  [/\b(professor|escola|livro|leitura)/, 'educacao'],
  [/\b(terra|meio ambiente|agua|arvore|floresta)/, 'meio_ambiente'],
  [/\b(saude)\b/, 'saude'],
  [/\b(joao|junina|carnaval|folclore|halloween|colono|cultura|independencia|consciencia negra)/, 'cultura'],
  [/\b(consumidor|cliente|black friday|namorad|maes|pais|criancas|natal)\b/, 'comercio']
];
const catLocal = (nome: string) => { const n = norm(nome), s = new Set<string>(); CAT_LOCAL.forEach(([re, c]) => { if (re.test(n)) s.add(c); }); return [...s]; };

async function adaptadorFeriadosBR(_url: string, ctx: Ctx): Promise<{ itens: Item[]; ignorados: string[] }> {
  /* municipais: só as cidades dos clientes (a base inteira tem ~8.500
     feriados municipais por ano, a maioria sem nome — não serve a ninguém) */
  const { data: cms, error } = await ctx.admin.from('cliente_municipios').select('municipio_ibge, municipios(nome, uf)');
  if (error) throw new Error('Não foi possível ler as cidades dos clientes: ' + error.message);
  const cidades = new Map<string, { nome: string; uf: string }>();
  (cms || []).forEach((r: Record<string, unknown>) => {
    const m = r.municipios as { nome: string; uf: string } | null;
    if (m) cidades.set(String(r.municipio_ibge), m);
  });
  const ano = new Date().getUTCFullYear();
  const itens = new Map<string, Item>(), ignorados: string[] = [];
  for (const [a, obrig] of [[ano, true], [ano + 1, false]] as [number, boolean][]) {
    const [nac, est, mun, fac] = await Promise.all([
      lerFeriados('feriados/nacional', a, obrig), lerFeriados('feriados/estadual', a, obrig),
      lerFeriados('feriados/municipal', a, obrig), lerFeriados('feriados/facultativo', a, obrig)
    ]);
    if (!nac || !est || !mun || !fac) continue;
    /* um feriado local na MESMA data de um feriado nacional (ex.: Sexta-
       -feira Santa por lei municipal) já está coberto pelo nacional */
    const datasNacionais = new Set(nac.map(f => isoDeBR(f.data)).filter(Boolean) as string[]);
    for (const f of [...est, ...mun, ...fac]) {
      const data = isoDeBR(f.data), nomeFonte = String(f.nome || '').trim();
      if (!data || !nomeFonte) { ignorados.push(JSON.stringify(f).slice(0, 80)); continue; }
      const ibge = f.codigo_ibge != null && String(f.codigo_ibge).trim() ? String(f.codigo_ibge).padStart(7, '0') : null;
      const uf = f.uf ? String(f.uf).trim().toUpperCase() : null;
      const facultativo = String(f.tipo).toUpperCase() === 'FACULTATIVO';
      let abr: string;
      if (ibge) { if (!cidades.has(ibge)) continue; abr = 'municipal'; }
      else if (uf) abr = 'estadual';
      else continue;   /* facultativo nacional: Carnaval/Corpus Christi já vêm da BrasilAPI */
      const desc = String(f.descricao || '').trim();
      if (datasNacionais.has(data) && !ehAniversario(nomeFonte + ' ' + desc)) continue;
      const cidade = ibge ? cidades.get(ibge)! : null;
      let nome = nomeFonte;
      if (cidade && /^anivers[aá]rio d[ao] (cidade|munic[ií]pio)$/i.test(nomeFonte)) nome = 'Aniversário de ' + cidade.nome;
      else if (cidade && /^(feriado municipal|facultativo|ponto facultativo)$/i.test(nomeFonte)) nome = (facultativo ? 'Ponto facultativo em ' : 'Feriado municipal em ') + cidade.nome;
      const escopo = ibge ? 'mun:' + ibge : 'uf:' + uf;
      const ref = 'fer:' + escopo + ':' + (facultativo ? 'fac:' : '') + norm(nomeFonte);
      const it = itens.get(ref) || {
        referencia: ref, nome, titulo_na_fonte: nomeFonte, tipo_data: 'datas', datas: [] as { data: string }[],
        natureza: facultativo ? 'facultativo' : 'feriado', abrangencia: abr,
        uf: cidade ? cidade.uf : uf, municipio: cidade ? cidade.nome : null, municipio_ibge: ibge,
        descricao: desc && norm(desc) !== norm(nomeFonte) ? desc.slice(0, 400) : (cidade && nome !== nomeFonte ? 'A fonte não informa o motivo do feriado.' : null),
        categorias: ehAniversario(nomeFonte + ' ' + desc) ? [] : catLocal(nomeFonte),
        tags: [facultativo ? 'ponto facultativo' : 'feriado', ...(ehAniversario(nomeFonte + ' ' + desc) && cidade ? ['aniversario cidade'] : [])],
        confiabilidade: 'pendente', url: 'https://github.com/joaopbini/feriados-brasil',
        detalhe: (abr === 'municipal' ? 'Feriado municipal — ' + cidade!.nome + '/' + cidade!.uf : 'Feriado estadual — ' + uf) +
          (facultativo ? ' (ponto facultativo)' : '') + ' · base feriados-brasil'
      };
      const ds = it.datas as { data: string }[];
      if (!ds.some(x => x.data === data)) ds.push({ data });
      itens.set(ref, it);
    }
  }
  return { itens: [...itens.values()], ignorados };
}

/* datas populares/comerciais do mesmo repositório (dados/comemorativas).
   A regra anual só é usada quando a PRÓPRIA descrição da fonte a diz
   ("celebrado em 12 de junho", "segundo domingo de agosto") e bate com
   as datas publicadas; senão fica só a data do ano. */
const ORD: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, ultimo: -1 };
const GERAL_POPULAR = new Set(['dia dos namorados', 'dia dos pais', 'dia das maes', 'dia das criancas', 'vespera de natal', 'reveillon']);
async function adaptadorDatasBR(_url: string): Promise<{ itens: Item[]; ignorados: string[] }> {
  const ano = new Date().getUTCFullYear();
  const porNome = new Map<string, { f: Fer; datas: string[] }>(), ignorados: string[] = [];
  for (const [a, obrig] of [[ano - 1, false], [ano, true], [ano + 1, false]] as [number, boolean][]) {
    const lista = await lerFeriados('comemorativas', a, obrig);
    (lista || []).forEach(f => {
      const d = isoDeBR(f.data); if (!d || !f.nome) { ignorados.push(String(f.nome || '').slice(0, 60)); return; }
      const k = norm(f.nome), g = porNome.get(k) || { f, datas: [] };
      g.datas.push(d); porNome.set(k, g);
    });
  }
  const itens: Item[] = [];
  porNome.forEach(({ f, datas }, k) => {
    const desc = norm(String(f.descricao || ''));
    let base: Item | null = null;
    const r = desc.match(/\b(primeiro|segundo|terceiro|quarto|ultimo) (domingo|segunda|terca|quarta|quinta|sexta|sabado)(?: feira)? de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
    if (r) {
      const regra = 'nth:' + (MESES_PT.indexOf(r[3]) + 1) + ':' + DOW[r[2]] + ':' + ORD[r[1]];
      base = { tipo_data: 'regra', regra };
    } else {
      const fx = desc.match(/\b(?:em|no dia|dia) (\d{1,2})(?:o)? de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/);
      if (fx) {
        const mes = MESES_PT.indexOf(fx[2]) + 1, dia = +fx[1];
        const mmdd = '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
        if (datas.every(d => d.endsWith(mmdd))) base = { tipo_data: 'fixa', mes, dia };
      }
    }
    if (!base) base = { tipo_data: 'datas', datas: datas.filter(d => +d.slice(0, 4) >= ano).map(data => ({ data })) };
    if (base.tipo_data === 'datas' && !(base.datas as unknown[]).length) { ignorados.push(f.nome + ' (só anos passados)'); return; }
    itens.push({
      ...base, referencia: 'com:' + k, nome: String(f.nome).trim(), titulo_na_fonte: f.nome,
      natureza: 'comemorativa', abrangencia: /mundial|internacional/.test(k) ? 'internacional' : 'nacional',
      descricao: f.descricao ? String(f.descricao).slice(0, 400) : null,
      categorias: catLocal(f.nome), tags: tagsDe(f.nome), geral: GERAL_POPULAR.has(k), confiabilidade: 'popular',
      url: 'https://github.com/joaopbini/feriados-brasil/tree/master/dados/comemorativas', detalhe: 'Data popular · base feriados-brasil'
    });
  });
  return { itens, ignorados };
}

type Ctx = { admin: ReturnType<typeof createClient> };
const ADAPTADORES: Record<string, (url: string, ctx: Ctx) => Promise<{ itens: Item[]; ignorados: string[] }>> = {
  ms_calendario: adaptadorMS, oms: adaptadorOMS, onu: adaptadorONU, brasilapi: adaptadorBrasilAPI,
  ibge_municipios: adaptadorIBGE, feriados_br: adaptadorFeriadosBR, datas_br: adaptadorDatasBR
};

// ------------------------------------------------------------ handler
Deno.serve(comCors(async (req) => {
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

  /* ---- quem pode disparar uma rodada NORMAL ----
     Sem segredo configurado a função RECUSA, em vez de voltar a aceitar
     qualquer chamada (mesma decisão do b7-push). É o cron que tem de ser
     consertado, não a porta que tem de ficar aberta. Comparação em tempo
     constante. */
  const segredoCron = Deno.env.get('B7_CRON_SECRET') || '';
  if (!ehAdmin) {
    if (!segredoCron) {
      console.error('oportunidades-sync: B7_CRON_SECRET não configurado — rodada recusada.');
      return json({ erro: 'Sincronização automática não configurada.' }, 503);
    }
    if (!iguais(req.headers.get('x-b7-cron-secret') || '', segredoCron)) {
      return json({ erro: 'Não autorizado.' }, 401);
    }
  }

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
  /* o IBGE vem antes dos feriados locais (que usam os nomes das cidades) */
  const ORDEM = ['ms_calendario', 'brasilapi', 'ibge_municipios', 'feriados_br', 'datas_br', 'oms', 'onu'];
  fontes!.sort((a, b) => (ORDEM.indexOf(a.id) + 1 || 99) - (ORDEM.indexOf(b.id) + 1 || 99));
  for (const f of fontes!) {
    if (corpo.fontes && !corpo.fontes.includes(f.id)) continue;
    const ultima = f.ultima_tentativa ? Date.parse(f.ultima_tentativa) : 0;
    const vencida = agora - ultima >= f.frequencia_dias * 864e5 * 0.9;
    if (!(vencida || (forcar && agora - ultima > 5 * 60e3))) { resultados[f.id] = 'em dia'; continue; }
    const ad = ADAPTADORES[f.id];
    if (!ad) { resultados[f.id] = 'sem adaptador'; continue; }
    /* municípios do IBGE gravam na tabela de referência, não em oportunidades */
    const gravar = (itens: Item[], erro: string | null) => f.id === 'ibge_municipios'
      ? admin.rpc('municipios_aplicar_lote', { p_itens: itens, p_erro: erro, p_disparo: forcar ? 'manual' : 'cron' })
      : admin.rpc('oportunidades_aplicar_lote', { p_fonte: f.id, p_itens: itens, p_erro: erro, p_disparo: forcar ? 'manual' : 'cron' });
    try {
      const { itens, ignorados } = await ad(f.url, { admin });
      if (corpo.diagnostico && ehAdmin) { resultados[f.id] = { itens: itens.length, amostra: itens.slice(0, 5), ignorados }; continue; }
      const { data: r, error: e } = await gravar(itens, null);
      if (e) {
        /* erro ao gravar: registra como falha da fonte (nada parcial fica gravado) */
        await gravar([], 'Erro ao gravar: ' + e.message);
        resultados[f.id] = { status: 'falha', erro: e.message };
      } else resultados[f.id] = { ...(r as object), nao_interpretados: ignorados.length, amostra_nao_interpretados: ignorados.slice(0, 8) };
    } catch (e) {
      /* uma fonte que falha não derruba as outras e não apaga nada */
      const msg = (e as Error).message || String(e);
      await gravar([], msg);
      resultados[f.id] = { status: 'falha', erro: msg };
    }
  }
  return json({ versao: VERSAO, resultados });
}));
