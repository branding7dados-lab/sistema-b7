/* Tutoriais para o assistente de IA (zzz211).

   O assistente (função b7-ia) não lê arquivos do site: ele leva uma cópia
   em texto dos tutoriais, gerada daqui a partir de js/ajuda-dados.js.

   node ajuda-ia.mjs            → regrava supabase/functions/_shared/ia/ajuda.ts
   node ajuda-ia.mjs --conferir → falha se a cópia estiver desatualizada (roda no npm test) */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = p => fileURLToPath(new URL('../' + p, import.meta.url));
const fonte = await readFile(raiz('js/ajuda-dados.js'), 'utf8');
const ctx = { window: {} }; ctx.window.B7 = {};
new Function('window', 'B7', fonte)(ctx.window, ctx.window.B7);
const grupos = ctx.window.B7.AJUDA_DADOS;

const limpa = s => String(s || '').replace(/\*\*/g, '').trim();
const lista = (itens, num) => (itens || []).map((x, k) => {
  const [t, sub] = Array.isArray(x) ? x : [x, []];
  return (num ? (k + 1) + '. ' : '- ') + limpa(t) + (sub || []).map(s => '\n   - ' + limpa(Array.isArray(s) ? s[0] : s)).join('');
}).join('\n');

const tutoriais = {};
for (const g of grupos) for (const i of g.itens) {
  const partes = [
    i.onde && 'Onde fica: ' + limpa(i.onde),
    i.quem && 'Quem usa: ' + limpa(i.quem),
    i.serve && 'Serve para: ' + limpa(i.serve),
    i.antes && 'Antes de começar: ' + limpa(i.antes),
    (i.passos || []).length && 'Passo a passo:\n' + lista(i.passos, true),
    (i.dicas || []).length && 'Dicas:\n' + lista(i.dicas),
    (i.cuidados || []).length && 'Cuidado:\n' + lista(i.cuidados)
  ].filter(Boolean);
  tutoriais[i.id] = { titulo: i.titulo, grupo: g.nome, texto: partes.join('\n') };
}

const saida = '// GERADO por testes/ajuda-ia.mjs a partir de js/ajuda-dados.js — não edite aqui.\n' +
  '// Os tutoriais da tela Ajuda, em texto, para o assistente responder "como faço…".\n' +
  'export type Tutorial = { titulo: string; grupo: string; texto: string };\n' +
  'export const TUTORIAIS: Record<string, Tutorial> = ' + JSON.stringify(tutoriais, null, 1) + ';\n';

const destino = raiz('supabase/functions/_shared/ia/ajuda.ts');
if (process.argv.includes('--conferir')) {
  let atual = '';
  try { atual = await readFile(destino, 'utf8'); } catch (e) {}
  if (atual !== saida) { console.error('supabase/functions/_shared/ia/ajuda.ts está desatualizado: rode "node testes/ajuda-ia.mjs".'); process.exit(1); }
  console.log('ajuda-ia: cópia dos tutoriais para a IA em dia (' + Object.keys(tutoriais).length + ').');
} else {
  await writeFile(destino, saida);
  console.log('ajuda-ia: ' + Object.keys(tutoriais).length + ' tutoriais gravados.');
}
