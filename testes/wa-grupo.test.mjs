/* 4.85.0: peças puras dos dados do grupo (supabase/functions/_shared/wa-grupo.ts).
   Rodar com: node --experimental-strip-types --no-warnings testes/wa-grupo.test.mjs */
import { membrosDe, telefoneDe, b7AdminDe, dadosGrupo, eventoParticipantes, participanteParaEnvio, resultadoMembros } from '../supabase/functions/_shared/wa-grupo.ts';
let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(telefoneDe('556299990000@s.whatsapp.net') === '556299990000' && telefoneDe('123@lid') === null && telefoneDe('') === null && telefoneDe('556299990000:12@s.whatsapp.net') === '556299990000', 'telefone só de jid @s.whatsapp.net');

const info = { id: '1@g.us', subject: 'Cliente Alfa', desc: 'Grupo do cliente', creation: 1700000000, owner: '556211110000@s.whatsapp.net', announce: true, restrict: false, size: 3,
  participants: [{ id: '556211110000@s.whatsapp.net', admin: 'superadmin' }, { id: '777@lid', phoneNumber: '556222220000@s.whatsapp.net', admin: 'admin' }, { id: '888@lid', admin: null }, { admin: 'admin' }] };
const ms = membrosDe(info);
ok(ms.length === 3, 'ignora participante sem jid');
ok(igual(ms[0], { jid: '556211110000@s.whatsapp.net', telefone: '556211110000', admin: 'superadmin' }), 'membro por número');
ok(igual(ms[1], { jid: '777@lid', telefone: '556222220000', admin: 'admin' }), '@lid com phoneNumber ao lado');
ok(igual(ms[2], { jid: '888@lid', telefone: null, admin: null }), '@lid sem telefone');
ok(membrosDe([{ id: 'a@s.whatsapp.net' }]).length === 1 && membrosDe(null).length === 0, 'aceita lista direta e vazio');

ok(b7AdminDe(ms, '556222220000') === true, 'número da B7 admin');
ok(b7AdminDe([{ jid: 'a', telefone: '5511', admin: null }, { jid: 'b', telefone: '5522', admin: 'admin' }], '5511') === false, 'número da B7 está mas não é admin');
ok(b7AdminDe(ms, '559999999999') === null, 'não achou e há membros sem telefone: não dá para saber');
ok(b7AdminDe([{ jid: 'a', telefone: '5511', admin: 'admin' }], '5599') === false, 'todos com telefone e o número não está: false');
ok(b7AdminDe(ms, null) === null, 'sem telefone do número: null');

const d = dadosGrupo(info);
ok(d.nome === 'Cliente Alfa' && d.descricao === 'Grupo do cliente' && d.criado_wa === new Date(1700000000000).toISOString() && d.so_admins_enviam === true && d.so_admins_editam === false && d.membros_qtd === 3 && d.dono_jid === '556211110000@s.whatsapp.net', 'dados do grupo');
ok(dadosGrupo({}).criado_wa === null && dadosGrupo({}).so_admins_enviam === null, 'dados ausentes viram null');

ok(igual(eventoParticipantes({ id: '1@g.us', action: 'ADD', participants: ['556233330000@s.whatsapp.net'] }), { grupo: '1@g.us', acao: 'add', membros: [{ jid: '556233330000@s.whatsapp.net', telefone: '556233330000', admin: null }] }), 'evento com participantes em texto');
ok(eventoParticipantes({ groupJid: '1@g.us', action: 'promote', participants: [{ id: '9@lid', phoneNumber: '5562@s.whatsapp.net' }] }).membros[0].telefone === '5562', 'evento com participantes em objeto');
ok(eventoParticipantes({ id: '1@g.us', action: 'modify', participants: ['a'] }) === null && eventoParticipantes({ action: 'add' }) === null && eventoParticipantes(null) === null, 'formato desconhecido é ignorado');

ok(participanteParaEnvio('+55 (62) 99999-0000') === '5562999990000' && participanteParaEnvio('123') === null && participanteParaEnvio('9@lid') === '9@lid' && participanteParaEnvio('5562@s.whatsapp.net') === '5562@s.whatsapp.net', 'participante para envio');

const r = resultadoMembros({ updateParticipants: [{ status: '200', jid: '5511@s.whatsapp.net' }, { status: '403', jid: '5522@s.whatsapp.net' }, { status: '409', jid: '5533@s.whatsapp.net' }] }, ['5511', '5522', '5533']);
ok(igual(r.ok, ['5511@s.whatsapp.net']) && r.falhou.length === 2 && /privacidade/.test(r.falhou[0].motivo) && /já está/.test(r.falhou[1].motivo), 'resultado por pessoa, com o motivo');
ok(resultadoMembros([{ status: 200, jid: 'x' }], ['x']).ok.length === 1, 'lista direta e status numérico');
ok(igual(resultadoMembros({}, ['5511']).ok, ['5511']), 'sem detalhe: considera que deu certo');

if (falhas) { console.error(falhas + ' falha(s)'); process.exit(1); }
console.log('wa-grupo: ok');
