/* zzz284: a "Equipe ao vivo" só existe para super admin / admin supremo.
   Confere a trava de B7.AoVivo.pode() em js/aovivo.js. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function carregar(superadminRet) {
  const ctx = { window: {}, document: { addEventListener() {}, removeEventListener() {} },
    location: { hash: '#/' }, setInterval() {}, clearTimeout() {}, setTimeout() {}, console };
  ctx.window = ctx; ctx.B7 = { UI: { esc: s => String(s == null ? '' : s) }, Auth: { usuario: () => ({ id: 'u', nome: 'K' }), superadmin: () => superadminRet } };
  ctx.window.B7 = ctx.B7; ctx.window.addEventListener = () => {}; ctx.window.removeEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../js/aovivo.js', import.meta.url), 'utf8'), ctx);
  return ctx.B7.AoVivo;
}

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.error('✗ ' + m); } };

ok(typeof carregar(null).pode === 'function', 'expõe pode()');
ok(typeof carregar('supremo').acompanhar === 'function', 'expõe acompanhar()');
ok(carregar('supremo').pode() === true, 'admin supremo pode');
ok(carregar('super').pode() === true, 'super admin pode');
ok(carregar(null).pode() === false, 'admin comum (sem super) NÃO pode');
/* abrir() sem permissão não monta nada (document.body ausente aqui = não quebra) */
let quebrou = false;
try { carregar(null).abrir(); } catch (e) { quebrou = true; }
ok(!quebrou, 'abrir() sem permissão sai sem erro');
/* acompanhar sem ser super não faz nada e não quebra */
let q2 = false;
try { carregar(null).acompanhar('x'); } catch (e) { q2 = true; }
ok(!q2, 'acompanhar() sem permissão sai sem erro');

/* zzz296: o espelho nunca leva senha nem código de verificação */
const campo = (attrs, privadoPai) => ({ getAttribute: k => attrs[k] == null ? null : attrs[k], closest: sel => (sel === '[data-av-privado]' && privadoPai) ? {} : null });
const AV = carregar('supremo');
ok(AV._ehPrivado(campo({ type: 'password' })), 'senha é privada');
ok(AV._ehPrivado(campo({ type: 'text', autocomplete: 'one-time-code' })), 'código de verificação é privado');
ok(AV._ehPrivado(campo({ type: 'text', autocomplete: 'new-password' })), 'nova senha é privada');
ok(AV._ehPrivado(campo({ type: 'text' }, true)), 'campo dentro de data-av-privado é privado');
ok(!AV._ehPrivado(campo({ type: 'text' })), 'campo comum aparece no espelho');
ok(!AV._ehPrivado(null), 'sem elemento não quebra');
const src = readFileSync(new URL('../js/aovivo.js', import.meta.url), 'utf8');
ok((src.match(/private: true/g) || []).length >= 3, 'todos os canais ao vivo são privados');
ok(/sandbox="allow-same-origin"/.test(src) && !/allow-scripts/.test(src), 'o espelho não roda script nenhum');

console.log((falhas ? '✗ ' : '✓ ') + 'aovivo: ' + (total - falhas) + '/' + total);
process.exit(falhas ? 1 : 0);
