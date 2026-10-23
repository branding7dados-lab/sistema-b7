/* Regras de permissão da tela (js/permissoes.js), sem navegador.
   Para cada tipo de pessoa: que telas abre e que nível tem em cada módulo.
   A trava de verdade é no banco (conferir_permissoes); aqui garantimos que
   a tela não oferece o que não deve. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const ler = f => readFile(fileURLToPath(new URL('../js/' + f, import.meta.url)), 'utf8');
const codigo = await ler('permissoes.js');

globalThis.window = globalThis;
globalThis.document = { querySelectorAll: () => [], querySelector: () => null, body: { classList: { toggle() {}, add() {}, remove() {} } } };
let sessao = null;
globalThis.B7 = {
  Auth: {
    usuario: () => sessao,
    papel: () => sessao && sessao.papel,
    funcao: () => sessao && sessao.funcao,
    funcoesExtra: () => (sessao && sessao.extras) || [],
    modulos: () => (sessao && sessao.modulos) || null,
    niveis: () => (sessao && sessao.niveis) || null,
    ehEquipe: () => !!sessao && ['admin', 'coordenador'].includes(sessao.papel)
  }
};
(0, eval)(codigo);
const P = B7.Perm;
const como = s => { sessao = s; };
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const MODS = P.MODULOS.map(m => m.id);
const ROTAS_MOD = P.MODULOS.flatMap(m => m.rotas);
const ADMIN_SO = ['usuarios', 'importar', 'atalhos'];

/* Sem sessão (instalação nova): tudo aberto, como antes do login */
como(null);
ok(P.podeRota('clientes') && P.nivel('linhas') === 'total', 'sem sessão: tudo liberado');

/* Administrador: tudo, Total em tudo */
como({ id: 'a', papel: 'admin', funcao: null });
for (const r of ROTAS_MOD.concat(ADMIN_SO, ['previa'])) ok(P.podeRota(r), 'admin abre #/' + r);
for (const m of MODS) ok(P.nivel(m) === 'total', 'admin tem Total em ' + m);

/* Cliente: só o portal, nenhum módulo da equipe */
como({ id: 'c', papel: 'cliente', funcao: null, modulos: MODS });
for (const r of ROTAS_MOD.filter(r => r !== 'aprovacoes').concat(ADMIN_SO, ['config', 'previa', 'painel', 'cliente', 'gravacao'])) ok(!P.podeRota(r), 'cliente não abre #/' + r);
for (const r of ['aprovacoes', 'minha-linha', 'meus-status', 'suporte']) ok(P.podeRota(r), 'cliente abre #/' + r);
for (const m of MODS) ok(P.nivel(m) === 'sem', 'cliente sem ' + m + ' (mesmo se a sessão trouxer módulos)');
ok(P.modulosEfetivos().length === 0, 'cliente sem módulos efetivos');

/* Designer com o padrão: abre o que a função dá, nada de administração */
como({ id: 'd', papel: 'designer', funcao: 'designer', modulos: ['design', 'linhas', 'calendario', 'whatsapp'],
       niveis: { design: 'total', linhas: 'ver', calendario: 'ver', whatsapp: 'editar' } });
for (const r of ['design', 'linhas', 'linha', 'calendario', 'cliente', 'gravacao', 'config']) ok(P.podeRota(r), 'designer abre #/' + r);
for (const r of ['clientes', 'roteiros', 'gravacoes', 'semanas', 'kanban', 'aprovacoes', 'lixeira', 'arquivados', 'previa'].concat(ADMIN_SO))
  ok(!P.podeRota(r), 'designer não abre #/' + r);
ok(P.podeNivel('linhas', 'ver') && !P.podeNivel('linhas', 'editar'), 'designer só vê linhas');
ok(P.podeNivel('design', 'total'), 'designer tem Total no design');
ok(P.nivel('clientes') === 'sem' && !P.podeNivel('clientes', 'ver'), 'designer sem clientes');
ok(P.nivelDaRota('#/linha/123') === 'ver', 'nível da rota segue o módulo');

/* Videomaker: a fila de vídeo e o contexto */
como({ id: 'v', papel: 'videomaker', funcao: 'videomaker', modulos: ['video', 'gravacoes', 'roteiros', 'calendario'] });
for (const r of ['video', 'gravacoes', 'roteiros', 'trends']) ok(P.podeRota(r), 'videomaker abre #/' + r);
for (const r of ['design', 'linhas', 'clientes', 'whatsapp'].concat(ADMIN_SO)) ok(!P.podeRota(r), 'videomaker não abre #/' + r);
ok(P.painelVisoes().join() === 'video', 'videomaker tem o Painel de vídeo');

/* Coordenação: módulos dados, sem os de administração */
const coord = MODS.filter(m => m !== 'lixeira' && m !== 'equipe');
como({ id: 'k', papel: 'coordenador', funcao: 'coordenador', modulos: coord, niveis: Object.fromEntries(coord.map(m => [m, 'total'])) });
for (const r of ['clientes', 'linhas', 'roteiros', 'gravacoes', 'semanas', 'kanban', 'arquivados']) ok(P.podeRota(r), 'coordenação abre #/' + r);
for (const r of ['lixeira'].concat(ADMIN_SO)) ok(!P.podeRota(r), 'coordenação não abre #/' + r);
ok(P.nivel('equipe') === 'sem', 'coordenação sem Agenda e recado por padrão');

/* Exceção da pessoa: perder um módulo some com a rota; nível Ver trava edição */
como({ id: 'k2', papel: 'coordenador', funcao: 'coordenador', modulos: coord.filter(m => m !== 'clientes'),
       niveis: { linhas: 'ver', roteiros: 'editar' } });
ok(!P.podeRota('clientes'), 'módulo negado tira a rota');
ok(P.podeRota('linhas') && !P.podeNivel('linhas', 'editar'), 'Ver abre a tela mas não edita');
ok(P.podeNivel('roteiros', 'editar') && !P.podeNivel('roteiros', 'total'), 'Editar não exclui');
ok(P.nivel('gravacoes') === 'total', 'módulo sem nível definido vale Total');

/* Sessão antiga (sem módulos do banco): cai no padrão da função */
como({ id: 'd2', papel: 'designer', funcao: 'designer' });
ok(P.temModulo('design') && !P.temModulo('clientes'), 'padrão do designer sem sessão nova');

/* Consistência: toda tabela que o banco trava por nível aponta para um módulo da tela */
const db = await ler('database.js');
const nomes = new Set(P.MODULOS.map(m => m.rotulo));
const usados = [...db.matchAll(/:\s*'([^']+)'/g)].map(m => m[1]).filter(r => /^(Clientes|Linhas editoriais|Roteiros|Gravações|Status semanal|WhatsApp|Agenda e recado da equipe)$/.test(r));
ok(usados.length > 0 && usados.every(r => nomes.has(r)), 'rótulos de TABELA_MODULO existem em MODULOS');

/* E toda tabela travada pela migration de níveis está no mapa de mensagens */
const mig = await readFile(fileURLToPath(new URL('../migration_permissoes_niveis.sql', import.meta.url)), 'utf8');
const travadas = new Set([...mig.matchAll(/alter policy \w+ on public\.(\w+)/g)].map(m => m[1]));
const mapa = db.slice(db.indexOf('TABELA_MODULO'), db.indexOf('function traduzirPermissao'));
for (const t of travadas) ok(new RegExp('\\b' + t + ':').test(mapa), 'mensagem de permissão para ' + t);

console.log('permissões: ' + n + ' conferências ok');
