/* 4.91.1: a resposta da equipe pelo celular PESSOAL zera o "cliente esperando" (supabase/functions/_shared/wa.ts → gravar).
   Caso real: o Pedro respondeu o Mercato no grupo e o Otto seguiu cobrando "há 7 dias".
   Roda o gravar de verdade com um banco falso em memória (o npm:@supabase vira um stub).
   Rodar com: node --experimental-strip-types --no-warnings testes/wa-espera-equipe.test.mjs */
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, n) { if (s.startsWith('npm:')) return { url: 'data:text/javascript,export const createClient=()=>null;', shortCircuit: true }; return n(s, c); }`));
globalThis.Deno = { env: { get: () => '' } };
const { gravar, equipeDasMensagens } = await import('../supabase/functions/_shared/wa.ts');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };

/* banco falso: tabelas em memória, só o que o gravar usa */
function banco(t) {
  const q = (nome) => {
    let linhas = () => t[nome] || (t[nome] = []), filtros = [], op = 'select', dado = null;
    const passa = (l) => filtros.every(f => f(l));
    const fim = () => {
      if (op === 'insert') { linhas().push(...[].concat(dado)); return { data: null, error: null }; }
      if (op === 'upsert') { const d = [].concat(dado); for (const x of d) { const i = linhas().findIndex(l => l.jid === x.jid); i >= 0 ? Object.assign(linhas()[i], x) : linhas().push({ ...x }); } return { data: null, error: null }; }
      if (op === 'update') { linhas().filter(passa).forEach(l => Object.assign(l, dado)); return { data: null, error: null }; }
      return { data: linhas().filter(passa), error: null };
    };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(k, v) { filtros.push(l => l[k] === v); return b; }, neq(k, v) { filtros.push(l => l[k] !== v); return b; },
      in(k, v) { filtros.push(l => v.includes(l[k])); return b; },
      insert(d) { op = 'insert'; dado = d; return b; }, update(d) { op = 'update'; dado = d; return b; }, upsert(d) { op = 'upsert'; dado = d; return b; },
      async maybeSingle() { const r = fim(); return { data: Array.isArray(r.data) ? r.data[0] || null : null, error: null }; },
      then(res, rej) { return Promise.resolve(fim()).then(res, rej); }
    };
    return b;
  };
  return { from: q, t };
}
const GRUPO = '120363000000000001@g.us', NUM = { id: 'n1', nome: 'Videomakers' };
const base = (extra = {}) => ({
  wa_assistente: [{ id: 1, equipe: [{ nome: 'Matheus Araújo', numero: '5583999990001' }] }],   /* o Pedro NÃO está na lista do Otto */
  perfis: [{ nome: 'Pedro Henrique Lima', estado: 'ativa', papel: 'designer' }, { nome: 'Cliente Mercato', estado: 'ativa', papel: 'cliente' }],
  wa_conversas: [{ jid: GRUPO, numero_id: 'n1', nome: 'Mercato', cliente_id: 'c1', ultima_em: '2026-11-17T12:00:00.000Z', nao_lidas: 0,
    esperando_desde: '2026-11-17T12:00:00.000Z', aguardando_cliente_desde: null }],
  wa_mensagens: [], wa_contatos: [], wa_grupo_membros: [], ...extra });
const msg = (id, participant, pushName, texto, quando, alt) => ({ key: { remoteJid: GRUPO, fromMe: false, id, participant, ...(alt ? { participantAlt: alt } : {}) },
  pushName, messageTimestamp: Math.floor(Date.parse(quando) / 1000), message: { conversation: texto } });
const conv = (sb) => sb.t.wa_conversas[0];

{ const sb = banco(base());
  await gravar(sb, msg('A1', '999001@lid', 'Pedro Henrique Lima', 'Oi! Já tá pronto, segue a arte 👇', '2026-11-17T13:00:00Z'), {}, {}, NUM);
  ok(conv(sb).esperando_desde === null, 'Pedro (celular pessoal, fora da lista do Otto) responde pelo nome: o "esperando" zera');
  ok(!!conv(sb).aguardando_cliente_desde, 'e passa a ser a gente esperando o cliente'); }

{ const sb = banco(base({ wa_grupo_membros: [{ grupo_jid: GRUPO, membro_jid: '999002@lid', telefone: '5583999990001' }] }));
  await gravar(sb, msg('A2', '999002@lid', 'Theus 🎬', 'Resolvido!', '2026-11-17T13:00:00Z'), {}, {}, NUM);
  ok(conv(sb).esperando_desde === null, 'Matheus por @lid, com apelido no WhatsApp: acha o número pela lista de membros do grupo'); }

{ const sb = banco(base());
  await gravar(sb, msg('A3', '5583988887777@s.whatsapp.net', 'Pedro Souza', 'Pessoal, e a arte?', '2026-11-17T13:00:00Z'), {}, {}, NUM);
  ok(conv(sb).esperando_desde === '2026-11-17T12:00:00.000Z', 'cliente chamado Pedro (outro sobrenome) não conta como equipe: a espera continua'); }

{ const sb = banco(base());
  const lista = [{ de_mim: false, autor_jid: '999001@lid', autor_nome: 'Pedro Henrique Lima' }, { de_mim: false, autor_jid: '1@lid', autor_nome: 'Ana Mercato' }, { de_mim: true }];
  const daEq = await equipeDasMensagens(sb, GRUPO, lista);
  ok(lista.map(daEq).join() === 'true,false,true', 'a mesma regra para a avaliação da vez, o vigia e o lembrete'); }

if (falhas) process.exit(1);
console.log('Espera zera com a resposta da equipe: ok');
