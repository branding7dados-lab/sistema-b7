/* 4.90.0: o bilhete de entrada Núcleo 7 → B7 (supabase/functions/_shared/ponte.ts).
   Rodar com: node --experimental-strip-types --no-warnings testes/ponte.test.mjs */
import { assinar, conferir, normEmail, VALIDADE_S, MOTIVO } from '../supabase/functions/_shared/ponte.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const S = 'x'.repeat(40), OUTRO = 'y'.repeat(40), T = 1_800_000_000;

const b = await assinar({ email: '  Kevin@Branding7.com.br ', nome: 'Kevin' }, S, T);
ok(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(b) && b.length < 600, 'bilhete curto e só com caracteres de endereço');
let r = await conferir(b, S, T + 10);
ok(r.ok && r.bilhete.e === 'kevin@branding7.com.br' && r.bilhete.n === 'Kevin' && /^[0-9a-f-]{36}$/.test(r.bilhete.j), 'confere: e-mail normalizado, nome e número único');
ok(r.ok && r.bilhete.x === T + VALIDADE_S && VALIDADE_S === 60, 'vale 60 segundos');
ok((await conferir(b, S, T + 61)).motivo === 'vencido', 'depois de 60 s: vencido');
ok((await conferir(b, OUTRO, T)).motivo === 'assinatura', 'outro segredo: assinatura recusada');
/* trocar o e-mail mantendo a assinatura */
const [corpo, sig] = b.split('.');
const outro = JSON.parse(Buffer.from(corpo, 'base64url').toString()); outro.e = 'yury@branding7.com.br';
const forjado = Buffer.from(JSON.stringify(outro)).toString('base64url') + '.' + sig;
ok((await conferir(forjado, S, T)).motivo === 'assinatura', 'trocar o e-mail invalida a assinatura');
/* assinatura certa num corpo longo demais (alguém com o segredo tentando um bilhete de 1 dia) */
const { createHmac } = await import('node:crypto');
const longo = Buffer.from(JSON.stringify({ v: 1, e: 'a@b.co', n: 'a', x: T + 86400, j: '00000000-0000-4000-8000-000000000000' })).toString('base64url');
ok((await conferir(longo + '.' + createHmac('sha256', S).update(longo).digest('base64url'), S, T)).motivo === 'formato', 'bilhete com validade longa é recusado mesmo assinado');
for (const ruim of ['', 'abc', 'a.b.c', '!!!.###', b + 'x', 'x'.repeat(3000)]) ok(!(await conferir(ruim, S, T)).ok, 'formato estranho recusado: ' + JSON.stringify(ruim.slice(0, 12)));
ok((await conferir(b, 'curto', T)).motivo === 'segredo', 'sem segredo (ou curto): recusa como "não configurado"');
let erro = ''; try { await assinar({ email: 'a@b.co', nome: '' }, ''); } catch (e) { erro = e.message; }
ok(/segredo/.test(erro), 'assinar sem segredo falha alto');
ok(normEmail(' A@B.Co ') === 'a@b.co', 'e-mail sem espaço e minúsculo');
ok(['formato', 'assinatura', 'vencido', 'usado', 'segredo', 'sem_conta', 'inativa', 'cliente'].every(k => MOTIVO[k] && MOTIVO[k].length > 20), 'todo motivo tem uma frase em português');

if (falhas) process.exit(1);
console.log('Ponte (bilhete): ok');
