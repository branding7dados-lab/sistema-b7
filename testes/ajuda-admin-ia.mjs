/* Tutoriais da ADMINISTRAÇÃO para o assistente do Suporte (zzz223).
   Mesma ideia de ajuda-ia.mjs, a partir de js/ajuda-admin.js. O assistente
   só usa estes para quem é administrador.

   node ajuda-admin-ia.mjs  → regrava supabase/functions/_shared/ia/ajuda_admin.ts */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = p => fileURLToPath(new URL('../' + p, import.meta.url));
const fonte = await readFile(raiz('js/ajuda-admin.js'), 'utf8');
const ctx = { window: {} }; ctx.window.B7 = {};
new Function('window', 'B7', fonte)(ctx.window, ctx.window.B7);
const grupos = ctx.window.B7.AJUDA_ADMIN;

const limpa = s => String(s || '').replace(/\*\*/g, '').trim();
const lista = (itens, num) => (itens || []).map((x, k) => {
  const [t, sub] = Array.isArray(x) ? x : [x, []];
  return (num ? (k + 1) + '. ' : '- ') + limpa(t) + (sub || []).map(s => '\n   - ' + limpa(Array.isArray(s) ? s[0] : s)).join('');
}).join('\n');

const tutoriais = {};
for (const g of grupos) for (const i of g.itens) {
  const partes = [
    i.onde && 'Onde fica: ' + limpa(i.onde), i.quem && 'Quem usa: ' + limpa(i.quem), i.serve && 'Serve para: ' + limpa(i.serve),
    i.antes && 'Antes de começar: ' + limpa(i.antes),
    (i.passos || []).length && 'Passo a passo:\n' + lista(i.passos, true),
    (i.dicas || []).length && 'Dicas:\n' + lista(i.dicas), (i.cuidados || []).length && 'Cuidado:\n' + lista(i.cuidados)
  ].filter(Boolean);
  tutoriais[i.id] = { titulo: i.titulo, grupo: g.nome, texto: partes.join('\n') };
}
const saida = '// GERADO por testes/ajuda-admin-ia.mjs a partir de js/ajuda-admin.js — não edite aqui.\n' +
  '// Tutoriais da administração, para o assistente do Suporte responder a quem é administrador.\n' +
  "import type { Tutorial } from './ajuda.ts';\n" +
  'export const TUTORIAIS_ADMIN: Record<string, Tutorial> = ' + JSON.stringify(tutoriais, null, 1) + ';\n';
await writeFile(raiz('supabase/functions/_shared/ia/ajuda_admin.ts'), saida);
console.log('ajuda-admin-ia: ' + Object.keys(tutoriais).length + ' tutoriais gravados.');
