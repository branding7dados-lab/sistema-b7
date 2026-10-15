// =====================================================================
// B7 IA — tarefa "whatsapp" (zzz194): ajuda na conversa com o cliente.
//
// Duas operações, sempre pedidas por um botão no painel do WhatsApp:
//   resumo     "O que rolou aqui?" — o que o cliente pediu, o que está
//              pendente e o que já foi resolvido, em tópicos curtos.
//   resposta   uma sugestão de mensagem para responder o cliente agora.
//              A pessoa edita e envia — nada é enviado por aqui.
//
// As mensagens vêm da tela (o programa de Windows lê a conversa aberta,
// só leitura). As pendências do cliente (vídeo, design, gravações) são
// lidas aqui COM A SESSÃO DA PESSOA. Nada é guardado além do registro de
// uso de sempre (ia_uso: metadados, nunca o texto).
// =====================================================================

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Mensagem } from './provedor.ts';
import { limparSaida } from './roteiro.ts';

export type Msg = { de: string; texto: string; minha: boolean; quando: string };
export type Pedido = { operacao: 'resumo' | 'resposta'; grupo: string; clienteId: string | null; msgs: Msg[]; instrucao: string; autor: string };
const LIMITES = { msgs: 80, texto: 700, instrucao: 300, grupo: 160 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const corta = (v: unknown, max: number) => String(v ?? '').replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

export function validar(corpo: unknown): { ok: true; pedido: Pedido } | { ok: false } {
  const c = (corpo && typeof corpo === 'object') ? corpo as Record<string, unknown> : {};
  if (c.operacao !== 'resumo' && c.operacao !== 'resposta') return { ok: false };
  if (!Array.isArray(c.mensagens) || !c.mensagens.length) return { ok: false };
  const msgs: Msg[] = (c.mensagens as unknown[]).slice(-LIMITES.msgs).map(m => {
    const o = (m && typeof m === 'object') ? m as Record<string, unknown> : {};
    return { de: corta(o.de, 60), texto: corta(o.texto, LIMITES.texto), minha: o.minha === true, quando: corta(o.quando, 40) };
  }).filter(m => m.texto);
  if (!msgs.length) return { ok: false };
  const clienteId = typeof c.cliente_id === 'string' && UUID.test(c.cliente_id) ? c.cliente_id : null;
  return { ok: true, pedido: { operacao: c.operacao, grupo: corta(c.grupo, LIMITES.grupo), clienteId, msgs,
    instrucao: corta(c.instrucao, LIMITES.instrucao), autor: corta(c.autor, 40) } };
}

export type Contexto = { cliente: string; pendencias: string[] };
type Obj = Record<string, unknown>;
const ROT_VIDEO: Record<string, string> = { pendente: 'na fila', em_edicao: 'em edição', aguardando_aprovacao: 'com o cliente para aprovar', correcao: 'em ajustes' };
const ROT_DESIGN: Record<string, string> = { aguardando_producao: 'na fila', em_producao: 'em criação', revisao_interna: 'em revisão interna',
  aguardando_cliente: 'com o cliente para aprovar', ajustes: 'em ajustes', aprovado_interno: 'aprovada pela B7 (falta mandar/aprovar com o cliente)', aprovado_cliente: 'aprovada pelo cliente' };
const dm = (iso: unknown) => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; };

export async function carregarContexto(sb: SupabaseClient, p: Pedido): Promise<Contexto> {
  if (!p.clienteId) return { cliente: '', pendencias: [] };
  const hoje = new Date().toISOString().slice(0, 10);
  const [c, v, d, g] = await Promise.all([
    sb.from('clientes').select('nome').eq('id', p.clienteId).maybeSingle(),
    sb.from('demandas_edicao_resumo').select('titulo,codigo,editing_status,prazo').eq('client_id', p.clienteId).is('deleted_at', null)
      .in('editing_status', ['pendente', 'em_edicao', 'aguardando_aprovacao', 'correcao']).limit(10),
    sb.from('design_deliverables').select('titulo,tipo,status,prazo').eq('client_id', p.clienteId).is('deleted_at', null).neq('status', 'finalizado').limit(10),
    sb.from('gravacoes_resumo').select('nome,data_gravacao,hora_inicio,situacao').eq('client_id', p.clienteId).is('deleted_at', null).gte('data_gravacao', hoje).limit(3)
  ]);
  const pend: string[] = [];
  ((v.data || []) as Obj[]).forEach(x => pend.push('Vídeo "' + corta(x.titulo || x.codigo, 80) + '": ' + (ROT_VIDEO[String(x.editing_status)] || x.editing_status) + (x.prazo ? ' · prazo ' + dm(x.prazo) : '')));
  ((d.data || []) as Obj[]).forEach(x => pend.push('Arte "' + corta(x.titulo || x.tipo, 80) + '": ' + (ROT_DESIGN[String(x.status)] || x.status) + (x.prazo ? ' · prazo ' + dm(x.prazo) : '')));
  ((g.data || []) as Obj[]).filter(x => x.situacao !== 'Cancelada').forEach(x => pend.push('Gravação "' + corta(x.nome, 80) + '": ' + dm(x.data_gravacao) + (x.hora_inicio ? ' às ' + String(x.hora_inicio).slice(0, 5) : '')));
  return { cliente: corta(c.data && (c.data as Obj).nome, 80), pendencias: pend };
}

export const limiteDeSaida = (p: Pedido) => p.operacao === 'resumo' ? 900 : 500;
export const limpar = (t: string) => limparSaida(t).replace(/^\s*(resposta|sugestão|mensagem)\s*:\s*/i, '').trim();

const SISTEMA_BASE = [
  'Você ajuda a equipe da Branding7 (agência de conteúdo para redes sociais: vídeos, artes, gravações e linha editorial) a atender clientes pelo WhatsApp.',
  'Abaixo vem a conversa de um GRUPO do WhatsApp com o cliente. Mensagens marcadas [EQUIPE] são da agência; as outras são do cliente.',
  'Atenção: pessoas da equipe às vezes aparecem com nome próprio (ex.: Kevin, Pedro, Mateus, Talita, Bruna, Alissan, Kaique, Yury, Lucas) ou como "Atendimento", "Coordenação", "Comercial", "Financeiro", "Núcleo7", "Branding7", "B7" — trate essas como EQUIPE mesmo sem a marca.',
  'Use só o que está na conversa e nas pendências do sistema. Não invente prazo, valor, data nem promessa. Português do Brasil, tom profissional e próximo.'
];

export function montarMensagens(p: Pedido, ctx: Contexto): Mensagem[] {
  const tarefa = p.operacao === 'resumo'
    ? ['TAREFA: resuma a conversa para alguém da equipe que vai assumir agora. Responda em tópicos curtos, nesta ordem e só com as seções que tiverem conteúdo:',
       '• O que o cliente pediu / perguntou (o que ainda não foi respondido primeiro)',
       '• O que está pendente com a agência',
       '• O que já foi resolvido ou aprovado',
       'No máximo 10 tópicos no total. Sem introdução e sem conclusão.']
    : ['TAREFA: escreva UMA mensagem curta para a agência mandar agora no grupo, respondendo o que o cliente pediu ou perguntou por último e ainda não foi respondido.',
       'Se a resposta depende de algo que você não sabe (prazo, valor, decisão), diga que vai confirmar e retornar — sem inventar.',
       'Use as pendências do sistema quando ajudarem (ex.: "a arte X está em criação"). Até 3 frases, no máximo 1 emoji, sem assinatura (o nome entra sozinho), sem aspas, só o texto da mensagem.'];
  const conversa = p.msgs.map(m => (m.minha ? '[EQUIPE] ' : '') + (m.de || (m.minha ? 'Agência' : 'Cliente')) + (m.quando ? ' (' + m.quando + ')' : '') + ': ' + m.texto).join('\n');
  const user = [
    'GRUPO: ' + (p.grupo || '—') + (ctx.cliente ? ' · CLIENTE: ' + ctx.cliente : ''),
    p.autor ? 'QUEM VAI RESPONDER: ' + p.autor : '',
    '',
    'PENDÊNCIAS NO SISTEMA:', ...(ctx.pendencias.length ? ctx.pendencias.map(x => '- ' + x) : ['- nenhuma registrada']),
    '',
    'CONVERSA (mais antiga primeiro):', '<<<', conversa, '>>>',
    p.instrucao ? '\nPEDIDO DE QUEM ESTÁ USANDO: ' + p.instrucao : ''
  ].filter(x => x !== '').join('\n');
  return [{ role: 'system', content: [...SISTEMA_BASE, '', ...tarefa].join('\n') }, { role: 'user', content: user }];
}
