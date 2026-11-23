/* 4.84.0: peças puras dos vários números de WhatsApp (supabase/functions/_shared/wa-numeros.ts).
   Rodar com: node --experimental-strip-types --no-warnings testes/wa-numeros-servidor.test.mjs */
import { instanciaDoEvento, podeVerNumero, instanciaNova, criarResolvedor, semTabela, numeroDoEvento, podeAcao } from '../supabase/functions/_shared/wa-numeros.ts';

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

/* revisão final: erro passageiro ao ler os números não pode virar "banco antigo" */
ok(semTabela({ code: '42P01' }) && semTabela({ code: 'PGRST205' }) && !semTabela({ code: '57014' }) && !semTabela({ message: 'timeout' }) && !semTabela(null), 'só tabela ausente conta como banco antigo');
{ let k = 0; const r2 = criarResolvedor(async () => { k++; if (k === 1) throw new Error('caiu'); return [vid]; });
  let erro = null; try { await r2.todos(); } catch (e) { erro = e; }
  ok(erro && (await r2.todos()).length === 1 && k === 2, 'erro não fica guardado: a próxima leitura tenta de novo'); }
{ let lista = [vid]; const r3 = criarResolvedor(async () => lista);
  await r3.todos(); lista = [vid, N({ id: 'novo', instancia: 'b7-novo' })];
  ok((await numeroDoEvento(r3, 'b7-novo', 'b7-piloto')).numero?.id === 'novo', 'número criado há pouco: relê antes de ignorar'); }
{ const r4 = criarResolvedor(async () => [N({ id: 'v', instancia: 'b7-piloto', padrao: true })]);
  const a = await numeroDoEvento(r4, 'b7-oficial', 'b7-oficial');
  ok(a.numero?.id === 'v' && a.corrigir === 'b7-oficial', 'instância do segredo (EVOLUTION_INSTANCE) = número padrão, e pede para corrigir o cadastro');
  const b = await numeroDoEvento(r4, 'outra', 'b7-oficial');
  ok(b.numero === null && !b.corrigir, 'instância desconhecida continua ignorada');
  ok((await numeroDoEvento(r4, '', 'b7-oficial')).numero === null, 'sem instância: ignorada'); }
{ const pad = N({ id: 'v', equipes: ['videomaker'], padrao: true, ativo: true }), dsg = N({ id: 'd', equipes: ['designer'], ativo: true });
  const designer = { papel: 'designer', estado: 'ativa' }, vm = { papel: 'videomaker', estado: 'ativa' }, adm = { eh_admin: true, estado: 'ativa' };
  ok(podeAcao('enviar_texto', designer, dsg, pad), 'designer envia pelo número dele');
  ok(!podeAcao('enviar_texto', designer, pad, pad), 'designer não envia pelo número dos vídeos');
  ok(!podeAcao('responder_duvida', designer, dsg, pad) && !podeAcao('sugerir_resposta', designer, dsg, pad) && !podeAcao('voz_amostra', designer, dsg, pad), 'ações do Otto exigem ver o número padrão');
  ok(podeAcao('sugerir_resposta', vm, pad, pad) && podeAcao('responder_duvida', vm, null, pad), 'videomaker usa as ações do Otto');
  ok(!podeAcao('numero_salvar', vm, pad, pad) && podeAcao('numero_salvar', adm, pad, pad), 'cadastro de números só admin');
  ok(!podeAcao('enviar_texto', adm, N({ ativo: false }), pad), 'nem admin envia por número desativado'); }

/* revisão 4.86.0: o Financeiro nunca vê WhatsApp, nem com função de videomaker */
{ const pad = N({ id: 'v', equipes: ['videomaker'], padrao: true, ativo: true });
  ok(!podeVerNumero({ eh_admin: true, papel: 'admin', estado: 'ativa', financeiro: true }, pad), 'financeiro (admin) não vê o número');
  ok(!podeVerNumero({ papel: 'admin', estado: 'ativa', financeiro: true, funcoes_adicionais: ['videomaker'] }, pad), 'financeiro + videomaker não vê o número');
  ok(!podeAcao('enviar_texto', { papel: 'admin', estado: 'ativa', financeiro: true, funcoes_adicionais: ['videomaker'] }, pad, pad), 'financeiro + videomaker não envia'); }

if (falhas) { console.error(falhas + ' falha(s)'); process.exit(1); }
console.log('wa-numeros (servidor): ok');
