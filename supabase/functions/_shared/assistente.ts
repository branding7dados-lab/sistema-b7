// =====================================================================
// ASSISTENTE B7 nos grupos do WhatsApp (4.54.0) — o "Gabriel" do B7
//
// Ideia trazida do Núcleo7 (agente-grupo), refeita para o B7:
//   • num grupo de CLIENTE, quando alguém marca o número conectado (@), ele
//     responde ali mesmo, com a conversa recente do grupo e o que está em
//     produção para aquele cliente (artes, vídeos, gravações);
//   • o que não sabe (prazo novo, valor, decisão) ele não inventa: diz que vai
//     confirmar, pergunta à equipe no privado e, quando alguém responde
//     (citando a mensagem, ou pela Central), reescreve e manda no grupo;
//   • a resposta da equipe vira APRENDIZADO e entra nas próximas respostas;
//   • pode marcar a pessoa da equipe que cuida do assunto.
// Sem marcação ele fica calado (a não ser que "sem_marcacao" esteja ligado,
// e mesmo assim só fala se a equipe não respondeu o grupo há pouco).
// Configuração: public.wa_assistente (tela: Central → ⋮ → Assistente).
// Chamado só pela wa-entrada (webhook), em segundo plano.
// =====================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { evo, INST, gravar, interpretar, type Linha } from './wa.ts';
import { gerar, provedorAtual } from './ia/servico.ts';
import { carregarContexto } from './ia/whatsapp.ts';

type Pessoa = { nome?: string; numero?: string; assuntos?: string; duvidas?: boolean };
type Config = {
  ativo: boolean; nome: string; jeito: string; regras: string; equipe: Pessoa[]; sem_marcacao: boolean;
  pausa_min: number; espera_min_s: number; espera_max_s: number; grupos: Record<string, { desligado?: boolean; regras?: string }>;
  meu_lid: string | null;
};

const I = () => encodeURIComponent(INST());
const dig = (s: unknown) => String(s || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const fim8 = (s: unknown) => dig(s).slice(-8);
const dorme = (ms: number) => new Promise(r => setTimeout(r, ms));

function desembrulhar(m: any): any {
  let x = m || {};
  for (let i = 0; i < 4; i++) {
    const w = x.ephemeralMessage || x.viewOnceMessage || x.viewOnceMessageV2 || x.documentWithCaptionMessage;
    if (w && w.message) x = w.message; else break;
  }
  return x;
}
function textoDe(raw: any): string {
  const m = desembrulhar(raw?.message);
  return String(m.conversation ?? m.extendedTextMessage?.text ?? m.imageMessage?.caption ?? m.videoMessage?.caption ?? m.documentMessage?.caption ?? '').trim();
}
function ctxDe(raw: any): any {
  const m = desembrulhar(raw?.message);
  return m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || raw?.contextInfo || {};
}

let meuNumeroCache = '';
async function meuNumero(): Promise<string> {
  if (meuNumeroCache) return meuNumeroCache;
  const l = await evo('/instance/fetchInstances?instanceName=' + I());
  const i = Array.isArray(l.dados) ? l.dados[0] : null;
  meuNumeroCache = dig(i?.ownerJid || i?.owner || '');
  return meuNumeroCache;
}
/** O código @lid do próprio número (a marcação nos grupos chega por ele). Descobre pela lista de participantes. */
async function meuLid(sb: SupabaseClient, cfg: Config, grupoJid: string, numero: string): Promise<string> {
  if (cfg.meu_lid) return cfg.meu_lid;
  try {
    const r = await evo('/group/participants/' + I() + '?groupJid=' + encodeURIComponent(grupoJid), 'GET', undefined, 8000);
    for (const p of (r.dados?.participants || []) as any[]) {
      const fone = dig(p?.phoneNumber || p?.jid || '');
      if (fone && fone.slice(-8) === numero.slice(-8) && /@lid$/.test(String(p?.id || ''))) {
        const lid = dig(p.id);
        await sb.from('wa_assistente').update({ meu_lid: lid }).eq('id', 1);
        cfg.meu_lid = lid;
        return lid;
      }
    }
  } catch (_e) { /* segue sem o lid */ }
  return '';
}

async function lerConfig(sb: SupabaseClient): Promise<Config | null> {
  const { data } = await sb.from('wa_assistente').select('*').eq('id', 1).maybeSingle();
  return data ? data as Config : null;
}

/** Quem da equipe é este número (pelos 8 últimos dígitos). */
function daEquipe(cfg: Config, numero: string): Pessoa | null {
  const f = numero.slice(-8);
  return f ? (cfg.equipe || []).find(p => fim8(p.numero) === f) || null : null;
}

async function enviar(sb: SupabaseClient, cfg: Config, jid: string, texto: string, extra: Record<string, unknown> = {}) {
  const r = await evo('/message/sendText/' + I(), 'POST', { number: jid, text: texto.slice(0, 3000), ...extra }, 30000);
  if (!r.ok) { console.log('assistente envio', r.status, JSON.stringify(r.dados).slice(0, 200)); return null; }
  try { await gravar(sb, r.dados, { enviada_por_nome: cfg.nome, do_assistente: true }); } catch (_e) { /* o eco grava depois */ }
  if (r.dados?.key?.id) await sb.from('wa_mensagens').update({ do_assistente: true, enviada_por_nome: cfg.nome, status: 'SERVER_ACK' }).eq('id', r.dados.key.id);
  return r.dados;
}
async function digitando(jid: string, cfg: Config) {
  const min = Math.max(1, cfg.espera_min_s || 4), max = Math.max(min, cfg.espera_max_s || 9);
  const ms = Math.round((min + Math.random() * (max - min)) * 1000);
  const t0 = Date.now();
  await evo('/chat/sendPresence/' + I(), 'POST', { number: jid, presence: 'composing', delay: ms }, ms + 6000).catch(() => null);
  const falta = ms - (Date.now() - t0);
  if (falta > 0) await dorme(falta);
}

const limparIA = (t: string) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
async function ia(sistema: string, usuario: string, maxTokens = 450): Promise<string> {
  const provedor = provedorAtual(n => Deno.env.get(n));
  const r = await gerar(provedor, [{ role: 'system', content: sistema }, { role: 'user', content: usuario }], { maxTokens, temperatura: 0.4, limpar: limparIA, prazoMs: 45000 });
  return r.ok ? r.texto : '';
}

/** Entrada: toda mensagem que chega pelo webhook (já gravada no B7). */
export async function aoReceber(sb: SupabaseClient, raw: any): Promise<void> {
  const key = raw?.key || {};
  const jid = String(key.remoteJid || '');
  const id = String(key.id || '');
  if (!jid || !id || jid === 'status@broadcast') return;
  const cfg = await lerConfig(sb);
  if (!cfg?.ativo) return;
  /* cada mensagem uma vez só */
  const { data: novo } = await sb.from('wa_assistente_vistos').upsert({ msg_id: id }, { onConflict: 'msg_id', ignoreDuplicates: true }).select('msg_id');
  if (!novo || !novo.length) return;
  const texto = textoDe(raw);
  if (!texto) return;

  const numero = await meuNumero();
  /* ---- resposta da equipe a uma dúvida (no privado do número, ou no "conversar comigo") ---- */
  if (!/@g\.us$/.test(jid)) {
    const alt = [key.remoteJidAlt, key.senderPn, key.participantPn].find((x: any) => typeof x === 'string' && /@s\.whatsapp\.net$/.test(x));
    let fone = dig(alt || (/@s\.whatsapp\.net$/.test(jid) ? jid : ''));
    if (!fone && /@lid$/.test(jid)) { const { data: ct } = await sb.from('wa_contatos').select('numero').eq('jid', jid).maybeSingle(); fone = dig(ct?.numero); }
    const comigo = key.fromMe && (fim8(jid) === numero.slice(-8) || (cfg.meu_lid && dig(jid) === cfg.meu_lid));
    const pessoa = key.fromMe ? (comigo ? { nome: 'Você' } : null) : daEquipe(cfg, fone);
    if (!pessoa) return;
    const citado = String(ctxDe(raw).stanzaId || '');
    await responderDuvida(sb, cfg, texto, citado, pessoa.nome || 'equipe', jid);
    return;
  }

  /* ---- grupo ---- */
  if (key.fromMe) return;
  const { data: conv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').eq('jid', jid).maybeSingle();
  const g = (cfg.grupos || {})[jid] || {};
  if (!conv?.cliente_id || g.desligado) return;   /* só grupos ligados a cliente */
  const autorJid = String(key.participant || raw.participant || '');
  const autorFone = dig([key.participantAlt, key.participantPn].find((x: any) => typeof x === 'string') || autorJid);
  if (daEquipe(cfg, autorFone)) return;            /* a equipe falando no grupo não aciona o assistente */

  const ctx = ctxDe(raw);
  const marcados = new Set<string>([...((ctx.mentionedJid || []) as string[]).map(dig), ...[...texto.matchAll(/@(\d{8,})/g)].map(v => v[1])]);
  const lid = marcados.size ? await meuLid(sb, cfg, jid, numero) : (cfg.meu_lid || '');
  const fuiMarcado = [...marcados].some(x => x === numero || x.slice(-8) === numero.slice(-8) || (lid && x === lid))
    || new RegExp('@' + cfg.nome.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(texto);
  if (!fuiMarcado) {
    if (!cfg.sem_marcacao || marcados.size) return;
    /* sem marcação: calado se a equipe falou no grupo há pouco */
    const desde = new Date(Date.now() - Math.max(1, cfg.pausa_min || 30) * 60000).toISOString();
    const { count } = await sb.from('wa_mensagens').select('id', { count: 'exact', head: true }).eq('jid', jid).eq('de_mim', true).eq('do_assistente', false).gte('criada_em', desde);
    if ((count || 0) > 0) return;
  }

  /* contexto: conversa recente + o que está em produção + aprendizados */
  const { data: msgs } = await sb.from('wa_mensagens').select('de_mim, autor_nome, enviada_por_nome, texto, tipo, criada_em, do_assistente')
    .eq('jid', jid).eq('nota', false).order('criada_em', { ascending: false }).limit(25);
  const historico = (msgs || []).reverse().filter(m => (m.texto || '').trim() || m.tipo !== 'texto').map(m => {
    const quem = m.de_mim ? '[EQUIPE] ' + (m.do_assistente ? cfg.nome : (m.enviada_por_nome || 'Branding7')) : (m.autor_nome || 'Cliente');
    return quem + ': ' + (m.texto ? String(m.texto).slice(0, 500) : '(' + m.tipo + ')');
  }).join('\n');
  let pend: string[] = [];
  try { pend = (await carregarContexto(sb, { clienteId: conv.cliente_id } as any)).pendencias; } catch (_e) { /* sem pendências */ }
  const { data: ap } = await sb.from('wa_assistente_aprendizados').select('pergunta, resposta').eq('ativo', true).order('criado_em', { ascending: false }).limit(40);
  const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero);
  const temQuemPerguntar = equipe.some(p => p.duvidas !== false);
  const autor = String(raw.pushName || 'alguém do grupo');
  const pedido = texto.replace(/@\d{6,}/g, '').trim();

  const sistema = [
    `Você é ${cfg.nome}, do atendimento da Branding7 (agência de conteúdo para redes sociais: vídeos, artes, gravações), respondendo num grupo de WhatsApp com o cliente "${conv.nome || ''}".`,
    'Seu papel: atender o cliente — entender o pedido, responder com o que está no contexto e dizer com clareza o próximo passo.',
    fuiMarcado
      ? 'Responda SÓ ao pedido de quem te marcou. Mensagem curta de WhatsApp (até 3 frases), sem textão, sem listas longas, no máximo 1 emoji.'
      : 'Você NÃO foi marcado. Só responda se for um pedido de ajuda, dúvida ou demanda para a agência que ninguém respondeu. Conversa entre as pessoas, aviso, agradecimento, bom dia, piada ou algo já respondido: responda exatamente [[SILENCIO]]. Na dúvida, [[SILENCIO]].',
    'Use o que está em PRODUÇÃO para responder sobre artes, vídeos e gravações (ex.: "a arte X está em criação, prazo 18/11"). Não invente prazo, preço, valor, data, resultado nem promessa que não esteja aqui.',
    temQuemPerguntar
      ? 'Se a resposta depender de algo que você não sabe (prazo novo, valor, decisão, aprovação de algo fora da lista), diga ao cliente que vai confirmar com o time e já retorna, e na ÚLTIMA linha escreva [[PERGUNTAR: a pergunta objetiva para a equipe]]. Essa linha não vai para o cliente.'
      : 'Se não souber, diga que vai confirmar com o time e retorna.',
    'Nunca fale de valores, cobrança ou financeiro: diga que o time vai falar sobre isso. Nunca exponha dados de outro cliente nem coisas internas da agência.',
    'Não assine a mensagem. Português do Brasil, tom próximo e profissional.',
    equipe.length ? '\nQUEM CUIDA DE CADA ASSUNTO (para chamar a pessoa, escreva {{marcar:Nome}} com o nome exato; no máximo 1 pessoa, só quando ajudar):\n' + equipe.map(p => '- ' + p.nome + (p.assuntos ? ': ' + p.assuntos : '')).join('\n') : '',
    (ap || []).length ? '\nO QUE A EQUIPE JÁ RESPONDEU (vale como verdade; use em vez de perguntar de novo):\n' + (ap || []).map(a => '- ' + a.pergunta + ' → ' + a.resposta).join('\n') : '',
    cfg.jeito?.trim() ? '\nCOMO SE COMPORTAR (definido pela agência):\n' + cfg.jeito.trim().slice(0, 3000) : '',
    cfg.regras?.trim() ? '\nREGRAS FIXAS (valem acima de tudo):\n' + cfg.regras.trim().slice(0, 3000) : '',
    g.regras?.trim() ? '\nREGRAS DESTE GRUPO:\n' + g.regras.trim().slice(0, 2000) : ''
  ].filter(Boolean).join('\n');
  const usuario = [
    'EM PRODUÇÃO PARA ESTE CLIENTE:', ...(pend.length ? pend.map(x => '- ' + x) : ['- nada registrado agora']),
    '', 'CONVERSA RECENTE DO GRUPO (mais antiga primeiro):', historico || '(sem histórico)',
    '', autor + (fuiMarcado ? ' te marcou e escreveu:' : ' escreveu (sem te marcar):'), pedido || texto,
    '', 'Escreva só a mensagem que vai no grupo.'
  ].join('\n');

  let resposta = await ia(sistema, usuario);
  if (!resposta || /\[\[\s*SILENCIO\s*\]\]/i.test(resposta)) return;
  let perguntaEquipe = '';
  resposta = resposta.replace(/\[\[\s*PERGUNTAR\s*:\s*([\s\S]*?)\]\]/i, (_m, q: string) => { perguntaEquipe = q.trim(); return ''; }).trim();
  if (!resposta && perguntaEquipe) resposta = 'Vou confirmar com o time e já te retorno por aqui 😉';
  /* {{marcar:Nome}} → @número de verdade */
  const mencionar: string[] = [];
  resposta = resposta.replace(/\{\{\s*marcar\s*:\s*([^}]+)\}\}/gi, (_m, n: string) => {
    const p = equipe.find(x => x.nome!.toLowerCase() === n.trim().toLowerCase());
    if (!p) return n.trim();
    const d = dig(p.numero); mencionar.push(d); return '@' + d;
  });
  await digitando(jid, cfg);
  await enviar(sb, cfg, jid, resposta, { quoted: { key, message: { conversation: texto.slice(0, 300) } }, ...(mencionar.length ? { mentioned: mencionar } : {}) });

  if (perguntaEquipe) {
    const { data: dv } = await sb.from('wa_assistente_duvidas').insert({ jid, grupo_nome: conv.nome, autor, pergunta: pedido || texto, pergunta_equipe: perguntaEquipe, msg_id: id, msg_raw: { key, texto: texto.slice(0, 300) } }).select('id').single();
    const aviso = '🤖 *Dúvida no grupo ' + (conv.nome || 'do cliente') + '*\n' + autor + ': “' + (pedido || texto).slice(0, 400) + '”\n\n*O que preciso saber:* ' + perguntaEquipe +
      '\n\n_Responda *citando esta mensagem* (segure → Responder) que eu repasso ao cliente._';
    const ids: string[] = [];
    for (const p of equipe.filter(x => x.duvidas !== false)) { const d = await enviar(sb, cfg, dig(p.numero) + '@s.whatsapp.net', aviso); if (d?.key?.id) ids.push(d.key.id); }
    if (dv?.id && ids.length) await sb.from('wa_assistente_duvidas').update({ avisos_ids: ids }).eq('id', dv.id);
  }
}

/** A equipe respondeu uma dúvida (citando o aviso, ou pela Central): reescreve, manda no grupo e aprende. */
export async function responderDuvida(sb: SupabaseClient, cfg: Config | null, respostaEquipe: string, citado: string, quem: string, jidAviso: string | null, duvidaId?: string): Promise<{ ok: boolean; erro?: string }> {
  cfg = cfg || await lerConfig(sb);
  if (!cfg) return { ok: false, erro: 'Assistente não configurado.' };
  let dv: any = null;
  if (duvidaId) dv = (await sb.from('wa_assistente_duvidas').select('*').eq('id', duvidaId).is('respondida_em', null).maybeSingle()).data;
  else {
    const { data: abertas } = await sb.from('wa_assistente_duvidas').select('*').is('respondida_em', null).order('criada_em', { ascending: false }).limit(20);
    dv = (abertas || []).find(x => citado && (x.avisos_ids || []).includes(citado)) || null;
    if (!dv) {
      /* sem citação: só não é ambíguo se houver uma dúvida aberta; mensagem comum fica quieta */
      if (!citado) return { ok: false };
      if (jidAviso) await enviar(sb, cfg, jidAviso, 'Não achei a dúvida dessa mensagem (talvez já respondida). Responda citando o meu aviso da dúvida.');
      return { ok: false };
    }
  }
  if (!dv) return { ok: false, erro: 'Essa dúvida já foi respondida.' };
  const sistema = `Você é ${cfg.nome}, do atendimento da Branding7, num grupo de WhatsApp com o cliente. Repasse ao cliente a resposta que a equipe deu, em mensagem curta e cordial de WhatsApp, em primeira pessoa. Não diga que perguntou a alguém nem cite nomes da equipe. Não acrescente nada além do que a equipe respondeu. Sem assinatura.` +
    (cfg.jeito?.trim() ? '\n\nCOMO SE COMPORTAR:\n' + cfg.jeito.trim().slice(0, 2000) : '');
  const paraCliente = (await ia(sistema, 'Pergunta do cliente (' + (dv.autor || 'cliente') + '): ' + dv.pergunta + '\n\nResposta da equipe: ' + respostaEquipe + '\n\nEscreva só a mensagem para o cliente.', 300)) || respostaEquipe;
  const k = dv.msg_raw?.key;
  const foi = await enviar(sb, cfg, dv.jid, paraCliente, k?.id ? { quoted: { key: k, message: { conversation: String(dv.msg_raw?.texto || dv.pergunta).slice(0, 300) } } } : {});
  if (!foi) return { ok: false, erro: 'O WhatsApp não aceitou a mensagem.' };
  await sb.from('wa_assistente_duvidas').update({ resposta: respostaEquipe, respondida_por: quem, respondida_em: new Date().toISOString() }).eq('id', dv.id);
  await sb.from('wa_assistente_aprendizados').insert({ pergunta: dv.pergunta_equipe || dv.pergunta, resposta: respostaEquipe, grupo: dv.grupo_nome, respondido_por: quem });
  if (jidAviso) await enviar(sb, cfg, jidAviso, '✅ Repassei ao grupo ' + (dv.grupo_nome || 'do cliente') + '.');
  return { ok: true };
}

export type { Linha };
export const _teste = { textoDe, ctxDe, dig, interpretar };
