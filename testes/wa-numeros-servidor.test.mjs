/* 4.84.0: peças puras dos vários números de WhatsApp (supabase/functions/_shared/wa-numeros.ts).
   Rodar com: node --experimental-strip-types --no-warnings testes/wa-numeros-servidor.test.mjs */
import { instanciaDoEvento, podeVerNumero, instanciaNova, criarResolvedor } from '../supabase/functions/_shared/wa-numeros.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };
const N = (o) => Object.assign({ id: 'x', nome: 'X', instancia: 'b7-x', cor: '#000', equipes: [], padrao: false, ativo: true, numero: null, estado: null }, o);

ok(instanciaDoEvento({ instance: 'b7-design' }) === 'b7-design', 'instância em texto');
ok(instanciaDoEvento({ instance: { instanceName: 'x' } }) === 'x', 'instância em objeto');
ok(instanciaDoEvento({}) === '' && instanciaDoEvento(null) === '', 'sem instância → vazio');

const vid = N({ id: 'v', equipes: ['videomaker'], padrao: true }), des = N({ id: 'd', equipes: ['designer'] });
ok(podeVerNumero({ eh_admin: true, papel: 'admin', estado: 'ativa' }, des), 'admin vê qualquer número');
ok(podeVerNumero({ papel: 'designer', estado: 'ativa' }, des), 'designer vê o dos designers');
ok(!podeVerNumero({ papel: 'designer', estado: 'ativa' }, vid), 'designer não vê o dos vídeos');
ok(podeVerNumero({ papel: 'coordenador', estado: 'ativa', funcoes_adicionais: ['videomaker'] }, vid), 'função extra conta');
ok(!podeVerNumero({ papel: 'videomaker', estado: 'inativa' }, vid), 'pessoa inativa não vê');
ok(!podeVerNumero({ papel: 'cliente', estado: 'ativa', funcoes_adicionais: ['videomaker'] }, vid), 'cliente nunca vê');
ok(!podeVerNumero({ papel: 'designer', estado: 'ativa' }, N({ equipes: ['designer'], ativo: false })), 'número desativado: só admin');
ok(podeVerNumero({ eh_admin: true, estado: 'ativa' }, N({ ativo: false })), 'admin vê desativado');

ok(instanciaNova('Coordenação', []) === 'b7-coordenacao', 'nome sem acento');
ok(instanciaNova('Design', ['b7-design']) === 'b7-design-2', 'repetido ganha -2');
ok(instanciaNova('Design', ['b7-design', 'b7-design-2']) === 'b7-design-3', 'e -3');
ok(instanciaNova('Número dos Videomakers da Agência B7', []).length <= 27, 'curto');
ok(instanciaNova('!!!', []) === 'b7-numero', 'nome sem letras');

let buscas = 0;
const r = criarResolvedor(async () => { buscas++; return [vid, des]; });
ok((await r.porId(null))?.id === 'v' && (await r.porId(''))?.id === 'v', 'vazio = padrão');
ok((await r.porId('d'))?.id === 'd', 'por id');
ok((await r.porId('nada')) === null, 'id desconhecido → null');
ok((await r.porInstancia('b7-x'))?.id === 'v' && (await r.porInstancia('nada')) === null && (await r.porInstancia('')) === null, 'por instância');
ok((await r.padrao())?.id === 'v' && (await r.todos()).length === 2, 'padrão e todos');
ok(buscas === 1, 'uma busca só dentro do tempo');
r.limpar(); await r.todos(); ok(buscas === 2, 'limpar força nova busca');

if (falhas) { console.error(falhas + ' falha(s)'); process.exit(1); }
console.log('wa-numeros (servidor): ok');
