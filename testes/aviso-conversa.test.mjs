/* zzz297: aviso de conversa no estilo WhatsApp (sw.js) — quem mandou, as
   mensagens, a foto e os botões; Marcar como lida / Silenciar / Responder
   falam com a b7-push levando só a assinatura daquela conversa. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.error('✗ ' + m); } };

const ouvintes = {}, mostrados = [], pedidos = [];
const self = {
  addEventListener: (t, f) => { ouvintes[t] = f; },
  registration: { scope: 'https://x/', showNotification: (t, o) => { mostrados.push({ t, o }); return Promise.resolve(); } },
  clients: { matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve() },
  skipWaiting() {}, location: { origin: 'https://x' }
};
const ctx = { self, caches: {}, fetch: (u, o) => { pedidos.push({ u, o }); return Promise.resolve({ ok: true }); },
  Notification: { maxActions: 3 }, URL, console, Promise, setTimeout };
ctx.self.Notification = ctx.Notification;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), ctx);

const espera = [];
const ev = (dados) => ({ data: { json: () => dados }, waitUntil: p => espera.push(p) });
const conversa = { id: 'c1', nome: 'Kaique Viana', grupo: false, perfil: 'p1', exp: 9e12, ass: 'abc',
  mensagens: [{ n: 'Kaique Viana', f: 'https://x/k.png', t: 'Oi', em: 1 }, { n: 'Kaique Viana', f: 'https://x/k.png', t: 'Tudo bem?', em: 2 }] };
ouvintes.push(ev({ v: 2, tipo: 'chat.mensagem', link: '#/conversa/c1', conversa }));
await Promise.all(espera);
const a = mostrados[0];
ok(a && a.t === 'Kaique Viana', 'título é o nome de quem mandou');
ok(a && a.o.body === 'Oi\nTudo bem?', 'as mensagens não lidas, uma embaixo da outra');
ok(a && a.o.icon === 'https://x/k.png', 'a foto de quem mandou é o ícone');
ok(a && a.o.tag === 'b7-chat-c1' && a.o.renotify, 'uma notificação por conversa, que toca de novo');
ok(a && a.o.actions.map(x => x.action).join() === 'responder,lida,silenciar', 'botões Responder, Marcar como lida, Silenciar');
ok(a && a.o.actions[0].type === 'text', 'Responder tem campo de texto');

/* grupo: "Nome: mensagem" */
mostrados.length = 0;
ouvintes.push(ev({ conversa: Object.assign({}, conversa, { grupo: true, nome: 'Equipe B7' }) }));
await Promise.all(espera);
ok(mostrados[0] && mostrados[0].t === 'Equipe B7' && mostrados[0].o.body.startsWith('Kaique Viana: Oi'), 'em grupo, título do grupo e nome antes de cada mensagem');

const clique = (action, reply) => { const e = { action, reply, notification: { close() {}, data: a.o.data }, waitUntil: p => espera.push(p) }; ouvintes.notificationclick(e); };
clique('lida'); await Promise.all(espera);
let b = JSON.parse(pedidos[0].o.body);
ok(/b7-push$/.test(pedidos[0].u) && b.conversa_acao.acao === 'lida' && b.conversa_acao.ass === 'abc' && b.conversa_acao.conversa === 'c1', 'Marcar como lida chama a b7-push com a assinatura');
clique('silenciar'); await Promise.all(espera);
ok(JSON.parse(pedidos[1].o.body).conversa_acao.acao === 'silenciar', 'Silenciar chama a b7-push');
clique('responder', ' Já vou! '); await Promise.all(espera);
b = JSON.parse(pedidos[2].o.body);
ok(b.conversa_acao.acao === 'responder' && b.conversa_acao.texto === 'Já vou!', 'Responder manda o texto escrito na notificação');

console.log((falhas ? '✗ ' : '✓ ') + 'aviso de conversa: ' + (total - falhas) + '/' + total);
process.exit(falhas ? 1 : 0);
