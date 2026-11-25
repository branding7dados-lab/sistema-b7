/* 4.91.6: "quem escreveu é da equipe?" — uma regra só (supabase/functions/_shared/equipe-autor.ts).
   Caso real: o Pedro respondeu o Mercato do celular pessoal e o Otto seguiu cobrando "há 7 dias".
   Rodar com: node --experimental-strip-types --no-warnings testes/equipe-autor.test.mjs */
import { ehDaEquipe, nomeEhDaEquipe, nomesPreparados, fim8, desdeClienteEspera } from '../supabase/functions/_shared/equipe-autor.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const nomes = nomesPreparados(['Pedro Henrique Lima', 'Matheus Araújo', 'Bia', '', 'Pedro Henrique Lima']);
const eq = { nums: new Set([fim8('5583999990001')]), nomes };
ok(nomes.length === 3, 'nomes sem repetição e sem vazio');
ok(ehDaEquipe(eq, { autor_nome: 'Pedro Lima' }), 'Pedro pelo nome (nome + sobrenome), mesmo sem o número na lista do Otto');
ok(ehDaEquipe(eq, { autor_nome: 'pedro henrique lima 🎨' }), 'nome com emoji e minúsculas');
ok(ehDaEquipe(eq, { autor_nome: 'Matheus Araujo' }), 'sem acento');
ok(ehDaEquipe(eq, { autor_nome: '+55 83 99999-0001' }, '5583999990001@s.whatsapp.net'), 'pelo número (8 últimos dígitos)');
ok(ehDaEquipe(eq, { de_mim: true }), 'o próprio número do B7');
ok(!ehDaEquipe(eq, { autor_nome: 'Pedro Souza' }), 'Pedro de outro sobrenome (cliente) não é da equipe');
ok(!ehDaEquipe(eq, { autor_nome: 'Pedro' }), 'só "Pedro" não basta para nome de duas palavras');
ok(ehDaEquipe(eq, { autor_nome: 'Bia' }) && !ehDaEquipe(eq, { autor_nome: 'Bia Mercato' }), 'nome de uma palavra: só igual');
ok(!ehDaEquipe(eq, { autor_nome: '558399999' }) && !nomeEhDaEquipe(nomes, ''), 'número no lugar do nome ou vazio: não');
ok(!ehDaEquipe(eq, { autor_nome: 'Mercato' }, '123@lid'), '@lid sem telefone conhecido não vira número');
/* 4.91.7: desde quando o cliente espera a gente (lembrete "Clientes esperando a gente") */
const L = (...q) => q.map(([h]) => ({ criada_em: '2026-11-17T' + h + ':00.000Z' }));
const C = false, E = true;
ok(desdeClienteEspera(L(['10:00'], ['11:00']), [C, E], '2026-11-17T10:00:00.000Z') === null,
  'equipe falou por último (ex.: "vamos mandar o PDF"): ninguém fica esperando a gente — o lembrete não cobra');
ok(desdeClienteEspera(L(['10:00'], ['11:00'], ['12:00']), [C, E, C], '2026-11-17T10:00:00.000Z') === '2026-11-17T12:00:00.000Z',
  'equipe respondeu e o cliente voltou a falar: conta da nova fala do cliente, não da antiga');
ok(desdeClienteEspera(L(['10:00'], ['10:30']), [C, C], '2026-11-17T10:00:00.000Z') === '2026-11-17T10:00:00.000Z',
  'só o cliente falou: a espera continua de quando começou');
ok(desdeClienteEspera(L(['10:00'], ['10:30']), [C, C], null) === '2026-11-17T10:00:00.000Z', 'sem espera anterior: a primeira fala do cliente');
ok(desdeClienteEspera([], [], null) === null, 'conversa vazia: ninguém espera');

if (falhas) process.exit(1);
console.log('Quem é da equipe: ok');
