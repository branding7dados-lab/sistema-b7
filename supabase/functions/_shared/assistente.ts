// =====================================================================
// ASSISTENTE B7 nos grupos do WhatsApp — o "Gabriel" do B7
// (4.54.0; 4.55.0: continuar a conversa citando, ordens da equipe, áudio,
//  horário de atendimento, registro de atividade, modo de teste)
//
// Ideia trazida do Núcleo7 (agente-grupo), refeita para o B7:
//   • num grupo de CLIENTE, quando alguém marca o número conectado (@) — ou
//     RESPONDE CITANDO uma mensagem do assistente —, ele responde ali, com a
//     conversa recente e o que está em produção para aquele cliente;
//   • áudio citando o assistente: ele transcreve e responde;
//   • o que não sabe ele não inventa: diz que vai confirmar, pergunta à equipe
//     no privado e, quando alguém responde (citando o aviso, ou pela tela),
//     reescreve e manda no grupo — e guarda como APRENDIZADO;
//   • alguém da EQUIPE marcando o assistente num grupo = uma ORDEM
//     ("@B7 avisa que a arte sai amanhã"): ele escreve isso para o cliente;
//   • fora do horário de atendimento (se ligado): avisa que o time responde
//     no próximo horário e pergunta à equipe do mesmo jeito;
//   • tudo fica em wa_assistente_registro (tela: Atividade).
// Sem marcação ele fica calado (a não ser com "sem_marcacao" ligado).
// Configuração: public.wa_assistente. Chamado pela wa-entrada (webhook).
// =====================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { evo, INST, gravar } from './wa.ts';
import { gerar, provedorAtual } from './ia/servico.ts';
import { carregarContexto } from './ia/whatsapp.ts';

type Pessoa = { nome?: string; numero?: string; assuntos?: string; duvidas?: boolean };
type Horario = { ativo?: boolean; ini?: string; fim?: string; dias?: number[]; mensagem?: string };
export type Config = {
  ativo: boolean; nome: string; jeito: string; regras: string; equipe: Pessoa[]; sem_marcacao: boolean;
  pausa_min: number; espera_min_s: number; espera_max_s: number; grupos: Record<string, { desligado?: boolean; regras?: string }>;
  meu_lid: string | null; horario?: Horario; ouvir_audio?: boolean;
  grupo_equipe?: string | null; resumo_horas?: number; resumo_ultimo?: string | null; resumo_espera_min?: number;
};
type Saida = { texto: string; provedor?: string; modelo?: string; tokensEntrada?: number | null; tokensSaida?: number | null; ms?: number };

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
  return m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || m.audioMessage?.contextInfo || raw?.contextInfo || {};
}

let meuNumeroCache = '';
async function meuNumero(): Promise<string> {
  if (meuNumeroCache) return meuNumeroCache;
  const l = await evo('/instance/fetchInstances?instanceName=' + I());
  const i = Array.isArray(l.dados) ? l.dados[0] : null;
  meuNumeroCache = dig(i?.ownerJid || i?.owner || '');
  return meuNumeroCache;
}
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

export async function lerConfig(sb: SupabaseClient): Promise<Config | null> {
  const { data } = await sb.from('wa_assistente').select('*').eq('id', 1).maybeSingle();
  return data ? data as Config : null;
}
function daEquipe(cfg: Config, numero: string): Pessoa | null {
  const f = numero.slice(-8);
  return f ? (cfg.equipe || []).find(p => fim8(p.numero) === f) || null : null;
}

/** Dentro do horário de atendimento? (fuso de Brasília) */
export function dentroDoHorario(h: Horario | undefined, agora = new Date()): boolean {
  if (!h?.ativo) return true;
  const br = new Date(agora.getTime() - 3 * 3600000);
  const dia = br.getUTCDay();
  if (Array.isArray(h.dias) && h.dias.length && !h.dias.includes(dia)) return false;
  const min = br.getUTCHours() * 60 + br.getUTCMinutes();
  const p = (s?: string, d = 0) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : d; };
  return min >= p(h.ini, 0) && min < p(h.fim, 24 * 60);
}

async function registrar(sb: SupabaseClient, r: Record<string, unknown>) {
  try { await sb.from('wa_assistente_registro').insert(r); } catch (_e) { /* registro nunca derruba a resposta */ }
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
async function ia(sistema: string, usuario: string, maxTokens = 450, audio?: { mime: string; base64: string }): Promise<Saida> {
  const provedor = provedorAtual(n => Deno.env.get(n));
  const r = await gerar(provedor, [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
    { maxTokens, temperatura: audio ? 0.1 : 0.4, limpar: limparIA, prazoMs: 45000, ...(audio ? { audio } : {}) });
  if (!r.ok) return { texto: '', ms: r.ms, provedor: r.provedor || undefined, modelo: r.modelo || undefined };
  return { texto: r.texto, provedor: r.servidoPor ? r.provedor + ':' + r.servidoPor : r.provedor, modelo: r.modelo, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, ms: r.ms };
}
const usoDe = (s: Saida) => ({ provedor: s.provedor || null, modelo: s.modelo || null, tokens_entrada: s.tokensEntrada ?? null, tokens_saida: s.tokensSaida ?? null, ms: s.ms ?? null });

/** Áudio → texto (só quando a pessoa respondeu o assistente com um áudio). */
async function transcrever(raw: any): Promise<string> {
  const m = desembrulhar(raw?.message);
  if (!m.audioMessage) return '';
  const b = await evo('/chat/getBase64FromMediaMessage/' + I(), 'POST', { message: { key: raw.key, message: { audioMessage: m.audioMessage } } }, 60000);
  const b64 = b.dados?.base64;
  if (!b.ok || !b64 || b64.length > 1_400_000) return '';
  const s = await ia('Você transcreve áudios de WhatsApp em português do Brasil. Devolva só o que a pessoa falou, sem comentários. Sem fala compreensível: [[SEM_FALA]].',
    'Transcreva o áudio.', 600, { mime: String(b.dados?.mimetype || m.audioMessage.mimetype || 'audio/ogg').split(';')[0], base64: b64 });
  return /\[\[SEM_FALA\]\]/.test(s.texto) ? '' : s.texto;
}

/** Monta o pedido e pergunta à IA (usado de verdade e no "Testar" da tela). */
export async function pensar(sb: SupabaseClient, cfg: Config, conv: { jid: string; nome: string | null; cliente_id: string | null }, texto: string, autor: string,
  modo: 'marcado' | 'sem_marcacao' | 'ordem' | 'fora_horario'): Promise<{ saida: Saida; resposta: string; perguntaEquipe: string; mencionar: string[] }> {
  const jid = conv.jid;
  const g = (cfg.grupos || {})[jid] || {};
  const { data: msgs } = await sb.from('wa_mensagens').select('de_mim, autor_nome, enviada_por_nome, texto, tipo, criada_em, do_assistente')
    .eq('jid', jid).eq('nota', false).order('criada_em', { ascending: false }).limit(25);
  const historico = (msgs || []).reverse().filter(m => (m.texto || '').trim() || m.tipo !== 'texto').map(m => {
    const quem = m.de_mim ? '[EQUIPE] ' + (m.do_assistente ? cfg.nome : (m.enviada_por_nome || 'Branding7')) : (m.autor_nome || 'Cliente');
    return quem + ': ' + (m.texto ? String(m.texto).slice(0, 500) : '(' + m.tipo + ')');
  }).join('\n');
  let pend: string[] = [];
  if (conv.cliente_id) { try { pend = (await carregarContexto(sb, { clienteId: conv.cliente_id } as any)).pendencias; } catch (_e) { /* sem pendências */ } }
  const { data: ap } = await sb.from('wa_assistente_aprendizados').select('pergunta, resposta').eq('ativo', true).order('criado_em', { ascending: false }).limit(40);
  const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero);
  const temQuemPerguntar = equipe.some(p => p.duvidas !== false);
  const pedido = texto.replace(/@\d{6,}/g, '').trim();
  const papel = {
    marcado: 'Responda SÓ ao pedido de quem te marcou ou te respondeu. Mensagem curta de WhatsApp (até 3 frases), sem textão, sem listas longas, no máximo 1 emoji.',
    sem_marcacao: 'Você NÃO foi marcado. Só responda se for um pedido de ajuda, dúvida ou demanda para a agência que ninguém respondeu. Conversa entre as pessoas, aviso, agradecimento, bom dia, piada ou algo já respondido: responda exatamente [[SILENCIO]]. Na dúvida, [[SILENCIO]].',
    ordem: 'Quem escreveu agora é da EQUIPE da agência e te deu uma ORDEM. Escreva a mensagem para o CLIENTE no grupo cumprindo a ordem, em primeira pessoa, curta e cordial. Não diga que recebeu ordem nem cite a pessoa da equipe. Não use [[PERGUNTAR]].',
    fora_horario: 'Agora está FORA do horário de atendimento. Responda curto e cordial: se a pergunta tiver resposta no contexto, responda; senão, diga que o time responde no próximo horário de atendimento.'
  }[modo];
  const sistema = [
    `Você é ${cfg.nome}, do atendimento da Branding7 (agência de conteúdo para redes sociais: vídeos, artes, gravações), num grupo de WhatsApp com o cliente "${conv.nome || ''}".`,
    'Seu papel: atender o cliente — entender o pedido, responder com o que está no contexto e dizer com clareza o próximo passo.',
    papel,
    'Use o que está EM PRODUÇÃO para responder sobre artes, vídeos e gravações (ex.: "a arte X está em criação, prazo 18/11"). Não invente prazo, preço, valor, data, resultado nem promessa que não esteja aqui.',
    modo !== 'ordem' && temQuemPerguntar
      ? 'Se a resposta depender de algo que você não sabe (prazo novo, valor, decisão, algo fora da lista), diga ao cliente que vai confirmar com o time e já retorna, e na ÚLTIMA linha escreva [[PERGUNTAR: a pergunta objetiva para a equipe]]. Essa linha não vai para o cliente.'
      : '',
    'Nunca fale de valores, cobrança ou financeiro: diga que o time vai falar sobre isso. Nunca exponha dados de outro cliente nem coisas internas da agência.',
    'Não assine a mensagem. Português do Brasil, tom próximo e profissional.',
    equipe.length ? '\nQUEM CUIDA DE CADA ASSUNTO (para chamar a pessoa, escreva {{marcar:Nome}} com o nome exato; no máximo 1 pessoa, só quando ajudar):\n' + equipe.map(p => '- ' + p.nome + (p.assuntos ? ': ' + p.assuntos : '')).join('\n') : '',
    (ap || []).length ? '\nO QUE A EQUIPE JÁ RESPONDEU (vale como verdade; use em vez de perguntar de novo):\n' + (ap || []).map(a => '- ' + a.pergunta + ' → ' + a.resposta).join('\n') : '',
    cfg.jeito?.trim() ? '\nCOMO SE COMPORTAR (definido pela agência):\n' + cfg.jeito.trim().slice(0, 3000) : '',
    cfg.regras?.trim() ? '\nREGRAS FIXAS (valem acima de tudo):\n' + cfg.regras.trim().slice(0, 3000) : '',
    g.regras?.trim() ? '\nREGRAS DESTE GRUPO:\n' + g.regras.trim().slice(0, 2000) : '',
    modo === 'fora_horario' && cfg.horario?.mensagem ? '\nMENSAGEM PADRÃO PARA FORA DO HORÁRIO (adapte se ajudar):\n' + cfg.horario.mensagem : ''
  ].filter(Boolean).join('\n');
  const usuario = [
    'EM PRODUÇÃO PARA ESTE CLIENTE:', ...(pend.length ? pend.map(x => '- ' + x) : ['- nada registrado agora']),
    '', 'CONVERSA RECENTE DO GRUPO (mais antiga primeiro):', historico || '(sem histórico)',
    '', modo === 'ordem' ? 'ORDEM DA EQUIPE (' + autor + '):' : autor + (modo === 'sem_marcacao' ? ' escreveu (sem te marcar):' : ' escreveu para você:'), pedido || texto,
    '', 'Escreva só a mensagem que vai no grupo.'
  ].join('\n');

  const saida = await ia(sistema, usuario);
  let resposta = saida.texto;
  let perguntaEquipe = '';
  resposta = resposta.replace(/\[\[\s*PERGUNTAR\s*:\s*([\s\S]*?)\]\]/i, (_m, q: string) => { perguntaEquipe = q.trim(); return ''; }).trim();
  if (!resposta && perguntaEquipe) resposta = 'Vou confirmar com o time e já te retorno por aqui 😉';
  const mencionar: string[] = [];
  resposta = resposta.replace(/\{\{\s*marcar\s*:\s*([^}]+)\}\}/gi, (_m, n: string) => {
    const p = equipe.find(x => x.nome!.toLowerCase() === n.trim().toLowerCase());
    if (!p) return n.trim();
    const d = dig(p.numero); mencionar.push(d); return '@' + d;
  });
  return { saida, resposta, perguntaEquipe, mencionar };
}

/** Entrada: toda mensagem que chega pelo webhook (já gravada no B7). */
export async function aoReceber(sb: SupabaseClient, raw: any): Promise<void> {
  const key = raw?.key || {};
  const jid = String(key.remoteJid || '');
  const id = String(key.id || '');
  if (!jid || !id || jid === 'status@broadcast') return;
  const cfg = await lerConfig(sb);
  if (!cfg?.ativo) return;
  const { data: novo } = await sb.from('wa_assistente_vistos').upsert({ msg_id: id }, { onConflict: 'msg_id', ignoreDuplicates: true }).select('msg_id');
  if (!novo || !novo.length) return;
  let texto = textoDe(raw);
  const ctx = ctxDe(raw);
  const numero = await meuNumero();
  /* 4.56.0: de tempos em tempos, as pendências vão para o grupo da equipe */
  talvezResumo(sb, cfg).catch(e => console.log('resumo', String(e)));
  /* grupo da equipe: perguntas sobre qualquer cliente */
  if (cfg.grupo_equipe && jid === cfg.grupo_equipe) { await noGrupoEquipe(sb, cfg, raw, texto, ctx, numero); return; }

  /* ---- privado: resposta da equipe a uma dúvida ---- */
  if (!/@g\.us$/.test(jid)) {
    if (!texto) return;
    const alt = [key.remoteJidAlt, key.senderPn, key.participantPn].find((x: any) => typeof x === 'string' && /@s\.whatsapp\.net$/.test(x));
    let fone = dig(alt || (/@s\.whatsapp\.net$/.test(jid) ? jid : ''));
    if (!fone && /@lid$/.test(jid)) { const { data: ct } = await sb.from('wa_contatos').select('numero').eq('jid', jid).maybeSingle(); fone = dig(ct?.numero); }
    const comigo = key.fromMe && (fim8(jid) === numero.slice(-8) || (cfg.meu_lid && dig(jid) === cfg.meu_lid));
    const pessoa = key.fromMe ? (comigo ? { nome: 'Você' } : null) : daEquipe(cfg, fone);
    if (!pessoa) return;
    await responderDuvida(sb, cfg, texto, String(ctx.stanzaId || ''), pessoa.nome || 'equipe', jid);
    return;
  }

  /* ---- grupo ---- */
  if (key.fromMe) return;
  const { data: conv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').eq('jid', jid).maybeSingle();
  const g = (cfg.grupos || {})[jid] || {};
  if (!conv?.cliente_id || g.desligado) return;
  const autorJid = String(key.participant || raw.participant || '');
  const autorFone = dig([key.participantAlt, key.participantPn].find((x: any) => typeof x === 'string') || autorJid);
  const daCasa = daEquipe(cfg, autorFone);

  /* marcado? (@número, @código do WhatsApp, @nome) — ou respondeu CITANDO uma mensagem do assistente */
  const marcados = new Set<string>([...((ctx.mentionedJid || []) as string[]).map(dig), ...[...texto.matchAll(/@(\d{8,})/g)].map(v => v[1])]);
  const lid = marcados.size ? await meuLid(sb, cfg, jid, numero) : (cfg.meu_lid || '');
  let fuiMarcado = [...marcados].some(x => x === numero || x.slice(-8) === numero.slice(-8) || (lid && x === lid))
    || new RegExp('@' + cfg.nome.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(texto);
  if (!fuiMarcado && ctx.stanzaId) {
    const { data: citada } = await sb.from('wa_mensagens').select('do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle();
    fuiMarcado = !!citada?.do_assistente;
  }
  /* áudio respondendo o assistente: transcreve */
  if (!texto && fuiMarcado && cfg.ouvir_audio !== false) texto = await transcrever(raw);
  if (!texto) return;

  let modo: 'marcado' | 'sem_marcacao' | 'ordem' | 'fora_horario' = 'marcado';
  if (daCasa) {
    if (!fuiMarcado) return;               /* equipe conversando no grupo: não é com ele */
    modo = 'ordem';
  } else if (!fuiMarcado) {
    if (!cfg.sem_marcacao || marcados.size) return;
    const desde = new Date(Date.now() - Math.max(1, cfg.pausa_min || 30) * 60000).toISOString();
    const { count } = await sb.from('wa_mensagens').select('id', { count: 'exact', head: true }).eq('jid', jid).eq('de_mim', true).eq('do_assistente', false).gte('criada_em', desde);
    if ((count || 0) > 0) return;
    modo = 'sem_marcacao';
  }
  if (modo !== 'ordem' && !dentroDoHorario(cfg.horario)) modo = 'fora_horario';

  const autor = String(raw.pushName || (daCasa?.nome) || 'alguém do grupo');
  const r = await pensar(sb, cfg, conv, texto, autor, modo);
  if (!r.resposta || /\[\[\s*SILENCIO\s*\]\]/i.test(r.saida.texto)) {
    if (!r.saida.texto) await registrar(sb, { tipo: 'erro', jid, grupo: conv.nome, autor, pergunta: texto.slice(0, 800), ...usoDe(r.saida) });
    return;
  }
  await digitando(jid, cfg);
  const foi = await enviar(sb, cfg, jid, r.resposta, { ...(modo === 'ordem' ? {} : { quoted: { key, message: { conversation: texto.slice(0, 300) } } }), ...(r.mencionar.length ? { mentioned: r.mencionar } : {}) });
  await registrar(sb, { tipo: !foi ? 'erro' : modo === 'ordem' ? 'instrucao' : modo === 'fora_horario' ? 'fora_horario' : (r.perguntaEquipe ? 'duvida' : 'resposta'),
    jid, grupo: conv.nome, autor, pergunta: texto.slice(0, 800), resposta: r.resposta.slice(0, 1500), ...usoDe(r.saida) });

  if (r.perguntaEquipe || modo === 'fora_horario') {
    const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero && p.duvidas !== false);
    if (!equipe.length) return;
    const pergunta = r.perguntaEquipe || 'O cliente escreveu fora do horário — o que respondo?';
    const { data: dv } = await sb.from('wa_assistente_duvidas').insert({ jid, grupo_nome: conv.nome, autor, pergunta: texto.slice(0, 800), pergunta_equipe: pergunta, msg_id: id, msg_raw: { key, texto: texto.slice(0, 300) } }).select('id').single();
    const aviso = '🤖 *Dúvida no grupo ' + (conv.nome || 'do cliente') + '*\n' + autor + ': “' + texto.slice(0, 400) + '”\n\n*O que preciso saber:* ' + pergunta +
      '\n\n_Responda *citando esta mensagem* (segure → Responder) que eu repasso ao cliente._';
    const ids: string[] = [];
    for (const p of equipe) { const d = await enviar(sb, cfg, dig(p.numero) + '@s.whatsapp.net', aviso); if (d?.key?.id) ids.push(d.key.id); }
    if (dv?.id && ids.length) await sb.from('wa_assistente_duvidas').update({ avisos_ids: ids }).eq('id', dv.id);
  }
}

/** A equipe respondeu uma dúvida (citando o aviso, ou pela tela): reescreve, manda no grupo e aprende. */
export async function responderDuvida(sb: SupabaseClient, cfg: Config | null, respostaEquipe: string, citado: string, quem: string, jidAviso: string | null, duvidaId?: string): Promise<{ ok: boolean; erro?: string }> {
  cfg = cfg || await lerConfig(sb);
  if (!cfg) return { ok: false, erro: 'Assistente não configurado.' };
  let dv: any = null;
  if (duvidaId) dv = (await sb.from('wa_assistente_duvidas').select('*').eq('id', duvidaId).is('respondida_em', null).maybeSingle()).data;
  else {
    if (!citado) return { ok: false };
    const { data: abertas } = await sb.from('wa_assistente_duvidas').select('*').is('respondida_em', null).order('criada_em', { ascending: false }).limit(30);
    dv = (abertas || []).find(x => (x.avisos_ids || []).includes(citado)) || null;
    if (!dv) {
      /* citou um aviso antigo (já respondido)? avisa; citou outra coisa qualquer: fica quieto */
      const { data: velha } = await sb.from('wa_assistente_duvidas').select('id').contains('avisos_ids', [citado]).limit(1);
      if (velha?.length && jidAviso) await enviar(sb, cfg, jidAviso, 'Essa dúvida já foi respondida 👍');
      return { ok: false };
    }
  }
  if (!dv) return { ok: false, erro: 'Essa dúvida já foi respondida.' };
  const sistema = `Você é ${cfg.nome}, do atendimento da Branding7, num grupo de WhatsApp com o cliente. Repasse ao cliente a resposta que a equipe deu, em mensagem curta e cordial de WhatsApp, em primeira pessoa. Não diga que perguntou a alguém nem cite nomes da equipe. Não acrescente nada além do que a equipe respondeu. Sem assinatura.` +
    (cfg.jeito?.trim() ? '\n\nCOMO SE COMPORTAR:\n' + cfg.jeito.trim().slice(0, 2000) : '');
  const s = await ia(sistema, 'Pergunta do cliente (' + (dv.autor || 'cliente') + '): ' + dv.pergunta + '\n\nResposta da equipe: ' + respostaEquipe + '\n\nEscreva só a mensagem para o cliente.', 300);
  const paraCliente = s.texto || respostaEquipe;
  const k = dv.msg_raw?.key;
  const foi = await enviar(sb, cfg, dv.jid, paraCliente, k?.id ? { quoted: { key: k, message: { conversation: String(dv.msg_raw?.texto || dv.pergunta).slice(0, 300) } } } : {});
  if (!foi) return { ok: false, erro: 'O WhatsApp não aceitou a mensagem.' };
  await sb.from('wa_assistente_duvidas').update({ resposta: respostaEquipe, respondida_por: quem, respondida_em: new Date().toISOString() }).eq('id', dv.id);
  await sb.from('wa_assistente_aprendizados').insert({ pergunta: dv.pergunta_equipe || dv.pergunta, resposta: respostaEquipe, grupo: dv.grupo_nome, respondido_por: quem });
  await registrar(sb, { tipo: 'repasse', jid: dv.jid, grupo: dv.grupo_nome, autor: quem, pergunta: dv.pergunta, resposta: paraCliente.slice(0, 1500), ...usoDe(s) });
  if (jidAviso) await enviar(sb, cfg, jidAviso, '✅ Repassei ao grupo ' + (dv.grupo_nome || 'do cliente') + '.');
  return { ok: true };
}

/** "Testar" da tela: o que ele responderia, sem mandar nada. */
export async function testar(sb: SupabaseClient, jid: string, texto: string, autor: string, comoEquipe: boolean) {
  const cfg = await lerConfig(sb);
  if (!cfg) return { erro: 'Assistente não configurado.' };
  const { data: conv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').eq('jid', jid).maybeSingle();
  if (!conv) return { erro: 'Grupo não encontrado.' };
  const modo = comoEquipe ? 'ordem' : dentroDoHorario(cfg.horario) ? 'marcado' : 'fora_horario';
  const r = await pensar(sb, cfg, conv, texto, autor || 'Cliente', modo);
  await registrar(sb, { tipo: 'teste', jid, grupo: conv.nome, autor: autor || 'teste', pergunta: texto.slice(0, 800), resposta: r.resposta.slice(0, 1500), ...usoDe(r.saida) });
  if (!r.saida.texto) return { erro: 'A IA não respondeu agora. Tente de novo em instantes.' };
  return { resposta: r.resposta, perguntaEquipe: r.perguntaEquipe || null, modo, provedor: r.saida.provedor || null, ms: r.saida.ms || null };
}


/* =====================================================================
   4.56.0 — GRUPO DA EQUIPE
   • Resumo de pendências: o que os clientes pediram nos grupos e ninguém
     respondeu (há mais de resumo_espera_min), a cada resumo_horas, só no
     horário de atendimento (seg–sex 8h–18h se o horário não estiver ligado).
     O relógio é o próprio webhook: a cada mensagem que chega, confere se já
     passou da hora (sem depender de agendador).
   • Perguntas da equipe marcando o assistente nesse grupo, sobre QUALQUER
     cliente ("@B7 o que tem da Arena Deck?", "@B7 pendências").
   ===================================================================== */
const HORARIO_PADRAO: Horario = { ativo: true, ini: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5] };
const semAcento = (v: string) => String(v || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const ha = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' h' + (m % 60 >= 10 ? ' ' + (m % 60) : '') : Math.floor(m / 1440) + ' d'; };

async function talvezResumo(sb: SupabaseClient, cfg: Config) {
  if (!cfg.grupo_equipe) return;
  const h = Math.max(1, cfg.resumo_horas || 3);
  if (!dentroDoHorario(cfg.horario?.ativo ? cfg.horario : HORARIO_PADRAO)) return;
  const limite = new Date(Date.now() - h * 3600000).toISOString();
  /* "pega a vez" de forma atômica: só um webhook manda o resumo */
  const { data } = await sb.from('wa_assistente').update({ resumo_ultimo: new Date().toISOString() }).eq('id', 1)
    .or('resumo_ultimo.is.null,resumo_ultimo.lt.' + limite).select('id');
  if (!data || !data.length) return;
  await mandarResumo(sb, cfg, false);
}

/** Conversas de cliente esperando resposta, com o que o cliente escreveu desde a última resposta da equipe. */
async function coletarEsperando(sb: SupabaseClient, cfg: Config, clienteIds?: string[]) {
  const espera = Math.max(5, cfg.resumo_espera_min || 30);
  let q: any = sb.from('wa_conversas').select('jid, nome, cliente_id, esperando_desde').eq('tipo', 'grupo').not('cliente_id', 'is', null).eq('arquivada', false);
  if (clienteIds?.length) q = q.in('cliente_id', clienteIds);
  else q = q.not('esperando_desde', 'is', null).lt('esperando_desde', new Date(Date.now() - espera * 60000).toISOString());
  const { data: convs } = await q.order('esperando_desde', { ascending: true }).limit(15);
  const blocos: string[] = [];
  for (const c of (convs || []) as any[]) {
    const { data: ult } = await sb.from('wa_mensagens').select('criada_em').eq('jid', c.jid).eq('de_mim', true).eq('nota', false).order('criada_em', { ascending: false }).limit(1);
    let mq: any = sb.from('wa_mensagens').select('autor_nome, texto, tipo, criada_em').eq('jid', c.jid).eq('de_mim', false).order('criada_em', { ascending: false }).limit(clienteIds ? 15 : 10);
    if (!clienteIds && ult?.[0]) mq = mq.gt('criada_em', ult[0].criada_em);
    const { data: ms } = await mq;
    const linhas = ((ms || []) as any[]).reverse().map((m: any) => '  - ' + (m.autor_nome || 'cliente') + ' (' + ha(m.criada_em) + ' atrás): ' + (m.texto ? String(m.texto).slice(0, 300) : '(' + m.tipo + ')'));
    if (!linhas.length && !clienteIds) continue;
    blocos.push('GRUPO "' + c.nome + '"' + (c.esperando_desde ? ' — esperando resposta há ' + ha(c.esperando_desde) : '') + ':\n' + (linhas.join('\n') || '  (sem mensagens recentes do cliente)'));
  }
  return blocos;
}

export async function mandarResumo(sb: SupabaseClient, cfg: Config | null, forcado: boolean): Promise<{ ok: boolean; vazio?: boolean; erro?: string }> {
  cfg = cfg || await lerConfig(sb);
  if (!cfg?.grupo_equipe) return { ok: false, erro: 'Escolha o grupo da equipe primeiro.' };
  const blocos = await coletarEsperando(sb, cfg);
  if (!blocos.length) {
    if (forcado) await enviar(sb, cfg, cfg.grupo_equipe, '✅ Nenhum cliente esperando resposta agora.');
    await registrar(sb, { tipo: 'resumo', jid: cfg.grupo_equipe, pergunta: forcado ? 'pedido' : 'automático', resposta: 'nada pendente' });
    return { ok: true, vazio: true };
  }
  /* 4.56.1: UMA mensagem curta — uma linha por cliente, marcando quem cuida (ou todo mundo) */
  const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero);
  const s = await ia(
    'Você ajuda a equipe da Branding7 (agência de conteúdo) a não deixar cliente sem resposta. Recebe, por grupo de cliente, o que o cliente mandou e a equipe ainda não respondeu.\n' +
    'Escreva UMA mensagem curta de WhatsApp para o grupo da equipe, exatamente neste formato:\n' +
    '🔔 *Clientes esperando resposta*\n' +
    '• *Nome do cliente* (há X) — o que o cliente quer, em até 12 palavras' + (equipe.length ? ' {{marcar:Nome de quem cuida}}' : '') + '\n' +
    'Uma linha por cliente, do que espera há mais tempo para o mais recente. Junte vários pedidos do mesmo cliente na mesma linha. Nada além disso: sem introdução, sem conclusão, sem títulos extras.\n' +
    'Ignore cumprimentos, agradecimentos, "ok", figurinhas e conversa entre as pessoas — se num grupo só houver isso, deixe o cliente de fora.' +
    (equipe.length ? '\nQUEM CUIDA DE CADA ASSUNTO (marque com {{marcar:Nome}} exatamente como aqui; se não souber de quem é, não marque):\n' + equipe.map(p => '- ' + p.nome + (p.assuntos ? ': ' + p.assuntos : '')).join('\n') : '') +
    '\nSe nenhum cliente precisar de resposta, responda exatamente [[NADA]].',
    blocos.join('\n\n'), 700);
  if (!s.texto) { await registrar(sb, { tipo: 'erro', jid: cfg.grupo_equipe, pergunta: 'resumo', ...usoDe(s) }); return { ok: false, erro: 'A IA não respondeu agora.' }; }
  if (/\[\[NADA\]\]/.test(s.texto)) {
    if (forcado) await enviar(sb, cfg, cfg.grupo_equipe, '✅ Nenhum cliente esperando resposta agora.');
    await registrar(sb, { tipo: 'resumo', jid: cfg.grupo_equipe, pergunta: forcado ? 'pedido' : 'automático', resposta: 'nada pendente', ...usoDe(s) });
    return { ok: true, vazio: true };
  }
  /* marcações: quem cuida de cada linha; quem não foi marcado em nenhuma linha vai no fim ("todo mundo") */
  const mencionar: string[] = [];
  let texto = s.texto.replace(/\{\{\s*marcar\s*:\s*([^}]+)\}\}/gi, (_m, n: string) => {
    const p = equipe.find(x => x.nome!.toLowerCase() === n.trim().toLowerCase() || x.nome!.toLowerCase().split(' ')[0] === n.trim().toLowerCase().split(' ')[0]);
    if (!p) return '';
    const d = dig(p.numero); if (!mencionar.includes(d)) mencionar.push(d); return '@' + d;
  }).replace(/[ \t]+\n/g, '\n').trim();
  let extra: Record<string, unknown> = {};
  if (equipe.length) {
    const resto = equipe.map(p => dig(p.numero)).filter(d => !mencionar.includes(d));
    if (resto.length) { texto += '\n\n' + resto.map(d => '@' + d).join(' '); mencionar.push(...resto); }
    extra = { mentioned: mencionar };
  } else extra = { mentionsEveryOne: true };   /* sem equipe cadastrada: marca o grupo todo */
  const foi = await enviar(sb, cfg, cfg.grupo_equipe, texto, extra);
  await registrar(sb, { tipo: 'resumo', jid: cfg.grupo_equipe, pergunta: forcado ? 'pedido' : 'automático', resposta: texto.slice(0, 1500), ...usoDe(s) });
  return foi ? { ok: true } : { ok: false, erro: 'O WhatsApp não aceitou a mensagem.' };
}

/** Clientes citados no texto (pelo nome do cliente ou do grupo). */
async function clientesCitados(sb: SupabaseClient, texto: string): Promise<{ id: string; nome: string }[]> {
  const t = ' ' + semAcento(texto).replace(/[^a-z0-9 ]+/g, ' ') + ' ';
  const { data } = await sb.from('clientes').select('id, nome').is('deleted_at', null).limit(500);
  const achou: { id: string; nome: string }[] = [];
  for (const c of data || []) {
    const n = semAcento(c.nome).replace(/[^a-z0-9 ]+/g, ' ').trim();
    if (!n) continue;
    const palavras = n.split(/\s+/).filter(w => w.length >= 4 && !['clinica', 'studio', 'grupo', 'loja', 'farma', 'odonto'].includes(w));
    if (t.includes(' ' + n + ' ') || palavras.some(w => t.includes(' ' + w + ' '))) achou.push({ id: c.id, nome: c.nome });
    if (achou.length >= 3) break;
  }
  return achou;
}

async function noGrupoEquipe(sb: SupabaseClient, cfg: Config, raw: any, texto: string, ctx: any, numero: string) {
  const key = raw?.key || {};
  if (key.fromMe || !texto) return;
  const marcados = new Set<string>([...((ctx.mentionedJid || []) as string[]).map(dig), ...[...texto.matchAll(/@(\d{8,})/g)].map(v => v[1])]);
  const lid = marcados.size ? await meuLid(sb, cfg, cfg.grupo_equipe!, numero) : (cfg.meu_lid || '');
  let marcado = [...marcados].some(x => x === numero || x.slice(-8) === numero.slice(-8) || (lid && x === lid))
    || new RegExp('@' + cfg.nome.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(texto);
  if (!marcado && ctx.stanzaId) { const { data: c } = await sb.from('wa_mensagens').select('do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle(); marcado = !!c?.do_assistente; }
  if (!marcado) return;
  const pedido = texto.replace(/@\d{6,}/g, '').trim();
  if (/pend[eê]ncia|quem (est[aá]|t[aá]) esperando|sem resposta/i.test(pedido) && !(await clientesCitados(sb, pedido)).length) { await mandarResumo(sb, cfg, true); return; }
  const clientes = await clientesCitados(sb, pedido);
  let contexto = '';
  if (clientes.length) {
    for (const c of clientes) {
      let pend: string[] = [];
      try { pend = (await carregarContexto(sb, { clienteId: c.id } as any)).pendencias; } catch (_e) { /* sem */ }
      const conversa = await coletarEsperando(sb, cfg, [c.id]);
      contexto += '\n\nCLIENTE: ' + c.nome + '\nEM PRODUÇÃO:\n' + (pend.length ? pend.map(x => '- ' + x).join('\n') : '- nada registrado no sistema') + '\nÚLTIMAS MENSAGENS DO CLIENTE NO GRUPO:\n' + (conversa.join('\n') || '(grupo do cliente não encontrado no WhatsApp do B7)');
    }
  } else {
    const esperando = await coletarEsperando(sb, cfg);
    contexto = '\n\nGRUPOS DE CLIENTE ESPERANDO RESPOSTA:\n' + (esperando.join('\n\n') || '(nenhum)');
  }
  const s = await ia(
    `Você é ${cfg.nome}, assistente interno da equipe da Branding7, respondendo no grupo da EQUIPE (não é cliente). Responda o que perguntaram usando só os dados abaixo: o que está em produção (artes, vídeos, gravações) e o que os clientes escreveram nos grupos. ` +
    'Seja objetivo, formato de WhatsApp (tópicos curtos com "•", *negrito* nos nomes de clientes). Se não houver dado sobre o que perguntaram, diga isso claramente. Não invente.',
    'PERGUNTA DE ' + String(raw.pushName || 'alguém da equipe') + ': ' + pedido + contexto, 700);
  if (!s.texto) return;
  await digitando(cfg.grupo_equipe!, cfg);
  await enviar(sb, cfg, cfg.grupo_equipe!, s.texto, { quoted: { key, message: { conversation: texto.slice(0, 300) } } });
  await registrar(sb, { tipo: 'consulta', jid: cfg.grupo_equipe, autor: String(raw.pushName || ''), pergunta: pedido.slice(0, 800), resposta: s.texto.slice(0, 1500), ...usoDe(s) });
}
