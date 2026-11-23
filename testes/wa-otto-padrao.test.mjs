/* 4.84.0: o Otto fica no número padrão (Videomakers).
   (a) nenhum arquivo do Otto lê/escreve conversas ou mensagens direto (só por waPadrao);
   (b–e) waPadraoCom põe o filtro / o numero_id certo. Rodar com --experimental-strip-types. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { waPadraoCom } from '../supabase/functions/_shared/wa-numeros.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const OTTO = ['assistente.ts', 'otto-controle.ts', 'otto-conversa.ts', 'otto-demandas.ts', 'otto-extras.ts', 'otto-social.ts', 'print-conversa.ts'];
for (const f of OTTO) {
  const t = await readFile(fileURLToPath(new URL('../supabase/functions/_shared/' + f, import.meta.url)), 'utf8');
  ok(!/from\(\s*['"]wa_(conversas|mensagens)['"]/.test(t), f + ': sem acesso direto a wa_conversas/wa_mensagens');
}

/* sb falso: registra cada chamada; o resultado do await é { data: registro } */
function sbFalso() {
  const reg = [];
  const builder = () => { const b = new Proxy({}, { get(_, k) {
    if (k === 'then') return (res) => res({ data: reg, error: null });
    return (...a) => { reg.push([k, a]); return b; }; } }); return b; };
  return { reg, from: (t) => { reg.push(['from', [t]]); return builder(); } };
}
const P = 'pad-1';
{ const sb = sbFalso(); await waPadraoCom(sb, async () => P).mensagens().select('id').eq('jid', 'x').limit(1);
  ok(JSON.stringify(sb.reg) === JSON.stringify([['from', ['wa_mensagens']], ['select', ['id']], ['eq', ['numero_id', P]], ['eq', ['jid', 'x']], ['limit', [1]]]), 'select filtra o número padrão'); }
{ const sb = sbFalso(); await waPadraoCom(sb, async () => P).conversas().update({ nome: 'a' }).eq('jid', 'x');
  ok(sb.reg[2][0] === 'eq' && sb.reg[2][1][1] === P, 'update filtra o número padrão'); }
{ const sb = sbFalso(); await waPadraoCom(sb, async () => P).conversas().insert({ jid: 'x' }).select('jid');
  ok(sb.reg[1][1][0].numero_id === P && !sb.reg.some(([k, a]) => k === 'eq'), 'insert leva numero_id e não filtra'); }
{ const sb = sbFalso(); await waPadraoCom(sb, async () => P).mensagens().upsert([{ id: '1' }], { onConflict: 'id', ignoreDuplicates: true });
  ok(sb.reg[1][1][0][0].numero_id === P && sb.reg[1][1][1].onConflict === 'numero_id,id' && sb.reg[1][1][1].ignoreDuplicates, 'upsert troca onConflict'); }
{ const sb = sbFalso(); await waPadraoCom(sb, async () => null).mensagens().select('id');
  ok(sb.reg.length === 2, 'sem número padrão (banco antigo): não filtra'); }
{ const sb = sbFalso(); let pegou = false;
  await waPadraoCom(sb, async () => P).mensagens().delete().eq('id', 'z').then(() => null, () => null).then(() => { pegou = true; });
  ok(pegou && sb.reg[1][0] === 'delete' && sb.reg[2][1][0] === 'numero_id', '.then(ok, erro) funciona'); }

if (falhas) { console.error(falhas + ' falha(s)'); process.exit(1); }
console.log('Otto no número padrão: ok');
