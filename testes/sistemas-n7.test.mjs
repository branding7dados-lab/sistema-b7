/* 4.91.0: quais sistemas da casa a pessoa tem (supabase/functions/_shared/sistemas-n7.ts) — a mesma regra da Central do Núcleo 7.
   Rodar com: node --experimental-strip-types --no-warnings testes/sistemas-n7.test.mjs */
import { sistemasDe } from '../supabase/functions/_shared/sistemas-n7.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const j = a => a.join(',');
ok(j(sistemasDe({ is_super_admin: true })) === 'gestao,disparos,connectsev,turbic,b7', 'super admin: todos');
ok(j(sistemasDe({ screen_permissions: {} })) === 'gestao', 'equipe sem nada marcado: só a N7 Gestão (vem liberada)');
ok(j(sistemasDe({ screen_permissions: { sistemas: { b7: true } } })) === 'gestao,b7', 'B7 liberado: Gestão + B7 (vê a Central)');
ok(j(sistemasDe({ screen_permissions: { sistemas: { b7: true, gestao: false } } })) === 'b7', 'Gestão desligada: só o B7 (não vê a Central)');
ok(j(sistemasDe({ is_active: false, is_super_admin: true })) === '', 'conta inativa: nenhum');
ok(j(sistemasDe(null)) === '' && j(sistemasDe({ screen_permissions: 'lixo' })) === 'gestao', 'sem conta: nenhum; permissão estranha: só o que vem liberado');
ok(j(sistemasDe({ screen_permissions: { sistemas: { b7: 'sim' } } })) === 'gestao', 'só true de verdade libera');
if (falhas) process.exit(1);
console.log('Sistemas do Núcleo 7: ok');
