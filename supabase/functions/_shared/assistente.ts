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
import { evo, INST, gravar, jidCanonico } from './wa.ts';
import { gerar, provedorAtual } from './ia/servico.ts';
import { carregarContexto } from './ia/whatsapp.ts';
import { fichaRoteiros, type Logo } from './ficha.ts';
import { fichaLinha } from './ficha-linha.ts';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

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
/* 4.56.4: jeito de WhatsApp — **negrito** do Markdown vira *negrito*, sem títulos (#), sem o
   próprio nome no começo (a assinatura entra sozinha), sem linhas em branco demais */
function noJeitoDoWhats(cfg: Config, t: string): string {
  const n = String(cfg.nome || 'Otto').split(/\s+/)[0];
  return String(t || '').replace(/\*\*([^*\n]+)\*\*/g, '*$1*').replace(/__([^_\n]+)__/g, '_$1_')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '').replace(new RegExp('^\\s*\\*?' + n + ':?\\*?:?\\s*', 'i'), '')
    .replace(/\n{3,}/g, '\n\n').trim();
}
/* 4.58.1: mais de uma mensagem seguida — a IA separa com uma linha [[NOVA]] (até 3). A primeira leva a
   assinatura, a citação e as marcações; as outras saem em seguida, com "digitando…" proporcional ao texto. */
const SEP = /\n?\s*\[\[\s*NOVA\s*\]\]\s*\n?/i;
async function enviar(sb: SupabaseClient, cfg: Config, jid: string, texto: string, extra: Record<string, unknown> = {}) {
  const partes = String(texto || '').split(SEP).map(t => t.trim()).filter(Boolean).slice(0, 3);
  if (partes.length > 1) {
    const primeira = await enviarUma(sb, cfg, jid, partes[0], extra, true);
    for (const t of partes.slice(1)) {
      const ms = Math.min(6000, 1200 + t.length * 45);
      await evo('/chat/sendPresence/' + I(), 'POST', { number: jid, presence: 'composing', delay: ms }, ms + 5000).catch(() => null);
      await enviarUma(sb, cfg, jid, t, {}, false);
    }
    return primeira;
  }
  return enviarUma(sb, cfg, jid, partes[0] || String(texto || ''), extra, true);
}
async function enviarUma(sb: SupabaseClient, cfg: Config, jid: string, texto: string, extra: Record<string, unknown>, assinar: boolean) {
  /* assinatura igual à da equipe: *Otto:* e a mensagem embaixo (só na primeira de uma sequência) */
  texto = (assinar ? '*' + String(cfg.nome || 'Otto').split(/\s+/)[0] + ':*\n' : '') + noJeitoDoWhats(cfg, texto);
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

const temAudio = (raw: any) => !!desembrulhar(raw?.message)?.audioMessage;
/** 4.58.5: o Otto falou nesta conversa há pouco? (aí um áudio sem o nome também é com ele) */
async function conversandoComOtto(sb: SupabaseClient, jid: string, min = 30): Promise<boolean> {
  const desde = new Date(Date.now() - min * 60000).toISOString();
  const { count } = await sb.from('wa_mensagens').select('id', { count: 'exact', head: true }).eq('jid', jid).eq('do_assistente', true).gte('criada_em', desde);
  return (count || 0) > 0;
}
/** 4.58.7: transcreve uma vez e guarda na mensagem ("🎤 ..."); se já foi transcrita, reaproveita. */
async function ouvirEGuardar(sb: SupabaseClient, raw: any, id: string): Promise<string> {
  try {
    const { data: ja } = await sb.from('wa_mensagens').select('texto').eq('id', id).maybeSingle();
    if (ja?.texto && String(ja.texto).startsWith('🎤 ')) return String(ja.texto).slice(3);
    const t = await transcrever(raw);
    if (t) await sb.from('wa_mensagens').update({ texto: '🎤 ' + t.slice(0, 4000) }).eq('id', id);
    return t;
  } catch (e) { console.log('ouvir', String(e).slice(0, 200)); return ''; }
}
/** Central: transcrever um áudio antigo (o midia_raw guardado tem a mesma forma da mensagem). */
export async function transcreverGuardada(sb: SupabaseClient, m: any): Promise<string> {
  if (!m?.midia_raw || m.tipo !== 'audio') return '';
  return ouvirEGuardar(sb, m.midia_raw, String(m.id));
}
/** Áudio → texto. */
async function transcrever(raw: any): Promise<string> {
  const m = desembrulhar(raw?.message);
  if (!m.audioMessage) return '';
  const b = await evo('/chat/getBase64FromMediaMessage/' + I(), 'POST', { message: { key: raw.key, message: { audioMessage: m.audioMessage } } }, 60000);
  const b64 = b.dados?.base64;
  if (!b.ok || !b64 || b64.length > 9_000_000) { console.log('transcrever: sem áudio do Evolution', b.status, b64 ? b64.length : 0); return ''; }
  const mime = String(b.dados?.mimetype || m.audioMessage.mimetype || 'audio/ogg').split(';')[0];
  /* 4.58.7: Whisper (Groq), feito para transcrever e firme em áudio longo; o Gemini fica de reserva */
  const w = await whisper(b64, mime);
  if (w !== null) return w;
  const s = await ia('Você transcreve áudios de WhatsApp em português do Brasil. Devolva só o que a pessoa falou, sem comentários. Sem fala compreensível: [[SEM_FALA]].',
    'Transcreva o áudio.', 1500, { mime, base64: b64 });
  if (!s.texto) console.log('transcrever: reserva sem texto', s.provedor || '', (s as any).erro || '');
  return /\[\[SEM_FALA\]\]/.test(s.texto) ? '' : s.texto;
}
/** Whisper do Groq: null = não deu (aí tenta a reserva); '' = sem fala. */
async function whisper(b64: string, mime: string): Promise<string | null> {
  const chave = (Deno.env.get('GROQ_API_KEY') || '').trim();
  if (!chave) return null;
  try {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : mime.includes('webm') ? 'webm' : 'ogg';
    const fd = new FormData();
    fd.append('file', new Blob([bin], { type: mime }), 'audio.' + ext);
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', 'pt');
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + chave }, body: fd, signal: AbortSignal.timeout(60000)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.log('whisper', r.status, JSON.stringify(d).slice(0, 200)); return null; }
    return String(d.text || '').trim();
  } catch (e) { console.log('whisper', String(e).slice(0, 200)); return null; }
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
    'Não assine a mensagem (a assinatura entra sozinha). Português do Brasil, tom próximo e profissional.',
    'ESCREVA COMO UMA PESSOA NO WHATSAPP: texto corrido, frases normais. NÃO use listas, tópicos, marcadores (•, -, 1.), títulos nem negrito — a não ser que a pessoa peça explicitamente uma lista.',
    'Se ficar mais natural, você pode mandar ATÉ 3 mensagens curtas seguidas (ex.: uma responde, a outra complementa), separando-as com uma linha contendo só [[NOVA]]. Use só quando ajudar; resposta simples = uma mensagem.',
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

/** 4.56.3: chamaram pelo nome ("Otto, …", "…, Otto?", "@Otto") — sem precisar marcar */
function chamouPeloNome(cfg: Config, texto: string): boolean {
  const n = semAcento(String(cfg.nome || 'Otto').split(/\s+/)[0]).replace(/[^a-z0-9]/g, '');
  if (n.length < 3) return false;
  return new RegExp('(^|[^a-z0-9])@?' + n + '([^a-z0-9]|$)').test(semAcento(texto));
}

/** Entrada: toda mensagem que chega pelo webhook (já gravada no B7). */
export async function aoReceber(sb: SupabaseClient, raw: any): Promise<void> {
  const key = raw?.key || {};
  const id = String(key.id || '');
  if (!key.remoteJid || !id || key.remoteJid === 'status@broadcast') return;
  /* 4.58.6: mesma conversa que o B7 guardou (número no lugar do @lid) */
  const jid = await jidCanonico(sb, key);
  const cfg = await lerConfig(sb);
  /* 4.58.7: todo áudio vira texto na Central (mesmo com o Otto desligado) */
  const ouvido = temAudio(raw) && cfg?.ouvir_audio !== false ? await ouvirEGuardar(sb, raw, id) : '';
  if (!cfg?.ativo) return;
  const { data: novo } = await sb.from('wa_assistente_vistos').upsert({ msg_id: id }, { onConflict: 'msg_id', ignoreDuplicates: true }).select('msg_id');
  if (!novo || !novo.length) return;
  let texto = textoDe(raw) || ouvido;
  const porAudio = !!ouvido;
  const ctx = ctxDe(raw);
  /* 4.56.4: nunca reagir à própria mensagem (ela começa com "*Otto:*") — evita conversa em loop */
  if (key.fromMe) {
    const assin = '*' + String(cfg.nome || 'Otto').split(/\s+/)[0].toLowerCase() + ':*';
    if (texto.toLowerCase().startsWith(assin)) return;
    const { data: minha } = await sb.from('wa_mensagens').select('do_assistente').eq('id', id).maybeSingle();
    if (minha?.do_assistente) return;
  }
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
    /* 4.58.5: áudio no privado. Da equipe: é com o Otto. De outros: só se citou o Otto ou ele falou ali há pouco. */
    /* resposta a uma dúvida (citando o aviso) */
    if (pessoa && ctx.stanzaId) { const r = await responderDuvida(sb, cfg, texto, String(ctx.stanzaId || ''), pessoa.nome || 'equipe', jid); if (r.ok) return; }
    /* 4.56.3: chamaram o Otto no privado */
    let chamado = chamouPeloNome(cfg, texto) || (porAudio && (!!pessoa || await conversandoComOtto(sb, jid)));
    if (!chamado && ctx.stanzaId) { const { data: c } = await sb.from('wa_mensagens').select('do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle(); chamado = !!c?.do_assistente; }
    if (!chamado) return;
    if (pessoa) { await consultaInterna(sb, cfg, raw, texto, jid); return; }        /* equipe (ou você no "conversar comigo"): pergunta interna */
    const { data: convP } = await sb.from('wa_conversas').select('jid, nome, cliente_id').eq('jid', jid).maybeSingle();
    const conv = convP || { jid, nome: String(raw.pushName || ''), cliente_id: null };
    const modoP = key.fromMe ? 'ordem' : dentroDoHorario(cfg.horario) ? 'marcado' : 'fora_horario';
    const autorP = key.fromMe ? 'Você' : String(raw.pushName || 'contato');
    if (await talvezRecado(sb, cfg, raw, texto, jid, { quem: autorP, onde: 'conversa no privado', cliente: !key.fromMe })) return;
    const rp = await pensar(sb, cfg, conv, texto, autorP, modoP);
    if (!rp.resposta || /\[\[\s*SILENCIO\s*\]\]/i.test(rp.saida.texto)) return;
    await digitando(jid, cfg);
    const foiP = await enviar(sb, cfg, jid, rp.resposta, modoP === 'ordem' ? {} : { quoted: { key, message: { conversation: texto.slice(0, 300) } } });
    await registrar(sb, { tipo: !foiP ? 'erro' : modoP === 'ordem' ? 'instrucao' : 'resposta', jid, grupo: conv.nome, autor: autorP, pergunta: texto.slice(0, 800), resposta: rp.resposta.slice(0, 1500), ...usoDe(rp.saida) });
    return;
  }

  /* ---- grupo ---- */
  /* 4.56.3: você, pelo celular conectado, chamando o Otto num grupo = uma ordem */
  if (key.fromMe && !chamouPeloNome(cfg, texto)) return;
  const { data: conv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').eq('jid', jid).maybeSingle();
  const g = (cfg.grupos || {})[jid] || {};
  if (!conv?.cliente_id || g.desligado) return;
  const autorJid = String(key.participant || raw.participant || '');
  const autorFone = dig([key.participantAlt, key.participantPn].find((x: any) => typeof x === 'string') || autorJid);
  const daCasa = key.fromMe ? { nome: 'Você' } : daEquipe(cfg, autorFone);

  /* marcado? (@número, @código do WhatsApp, @nome) — ou respondeu CITANDO uma mensagem do assistente */
  const marcados = new Set<string>([...((ctx.mentionedJid || []) as string[]).map(dig), ...[...texto.matchAll(/@(\d{8,})/g)].map(v => v[1])]);
  const lid = marcados.size ? await meuLid(sb, cfg, jid, numero) : (cfg.meu_lid || '');
  let fuiMarcado = [...marcados].some(x => x === numero || x.slice(-8) === numero.slice(-8) || (lid && x === lid))
    || chamouPeloNome(cfg, texto);
  if (!fuiMarcado && ctx.stanzaId) {
    const { data: citada } = await sb.from('wa_mensagens').select('do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle();
    fuiMarcado = !!citada?.do_assistente;
  }
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
  /* 4.57.0: a equipe pedindo um documento no grupo do cliente → o PDF vai ali mesmo */
  if (modo === 'ordem') {
    const { data: cl } = await sb.from('clientes').select('id, nome').eq('id', conv.cliente_id).maybeSingle();
    if (await talvezDocumento(sb, cfg, raw, texto.replace(/@\d{6,}/g, '').trim(), jid, cl)) return;
  }
  if (modo !== 'sem_marcacao' && await talvezRecado(sb, cfg, raw, texto, jid, { quem: autor, onde: 'grupo ' + (conv.nome || ''), cliente: !daCasa })) return;
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
  const sistema = `Você é ${cfg.nome}, do atendimento da Branding7, num grupo de WhatsApp com o cliente. Repasse ao cliente a resposta que a equipe deu, em mensagem curta e cordial de WhatsApp, em primeira pessoa. Não diga que perguntou a alguém nem cite nomes da equipe. Não acrescente nada além do que a equipe respondeu. Sem assinatura. Se a resposta for longa, pode dividir em até 3 mensagens curtas separadas por uma linha contendo só [[NOVA]].` +
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
  const ids = [...new Set(((convs || []) as any[]).map((c: any) => c.cliente_id).filter(Boolean))];
  const { data: cls } = ids.length ? await sb.from('clientes').select('id, nome').in('id', ids) : { data: [] as any[] };
  const nomeCli = new Map(((cls || []) as any[]).map((x: any) => [x.id, x.nome]));
  for (const c of (convs || []) as any[]) {
    const { data: ult } = await sb.from('wa_mensagens').select('criada_em').eq('jid', c.jid).eq('de_mim', true).eq('nota', false).order('criada_em', { ascending: false }).limit(1);
    let mq: any = sb.from('wa_mensagens').select('autor_nome, texto, tipo, criada_em').eq('jid', c.jid).eq('de_mim', false).order('criada_em', { ascending: false }).limit(clienteIds ? 15 : 10);
    if (!clienteIds && ult?.[0]) mq = mq.gt('criada_em', ult[0].criada_em);
    const { data: ms } = await mq;
    const linhas = ((ms || []) as any[]).reverse().map((m: any) => '  - ' + (m.autor_nome || 'cliente') + ' (' + ha(m.criada_em) + ' atrás): ' + (m.texto ? String(m.texto).slice(0, 300) : '(' + m.tipo + ')'));
    if (!linhas.length && !clienteIds) continue;
    blocos.push('CLIENTE "' + (nomeCli.get(c.cliente_id) || c.nome) + '" (grupo "' + c.nome + '")' + (c.esperando_desde ? ' — esperando resposta há ' + ha(c.esperando_desde) : '') + ':\n' + (linhas.join('\n') || '  (sem mensagens recentes do cliente)'));
  }
  return blocos;
}

export async function mandarResumo(sb: SupabaseClient, cfg: Config | null, forcado: boolean, destinoPedido?: string): Promise<{ ok: boolean; vazio?: boolean; erro?: string }> {
  cfg = cfg || await lerConfig(sb);
  const destino = destinoPedido || cfg?.grupo_equipe;
  if (!cfg || !destino) return { ok: false, erro: 'Escolha o grupo da equipe primeiro.' };
  const blocos = await coletarEsperando(sb, cfg);
  if (!blocos.length) {
    if (forcado) await enviar(sb, cfg, destino, '✅ Nenhum cliente esperando resposta agora.');
    await registrar(sb, { tipo: 'resumo', jid: destino, pergunta: forcado ? 'pedido' : 'automático', resposta: 'nada pendente' });
    return { ok: true, vazio: true };
  }
  /* 4.56.1: UMA mensagem curta — uma linha por cliente, marcando quem cuida (ou todo mundo) */
  const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero);
  const s = await ia(
    'Você ajuda a equipe da Branding7 (agência de conteúdo) a não deixar cliente sem resposta. Recebe, por grupo de cliente, o que o cliente mandou e a equipe ainda não respondeu.\n' +
    'Escreva UMA mensagem curta de WhatsApp para o grupo da equipe, exatamente neste formato:\n' +
    '🔔 *Clientes esperando resposta*\n' +
    '• *Nome do cliente* (há X) — o que o cliente quer, em até 10 palavras' + (equipe.length ? ' {{marcar:Nome de quem cuida}}' : '') + '\n' +
    'Uma linha por cliente, do que espera há mais tempo para o mais recente. Junte vários pedidos do mesmo cliente na mesma linha. Nada além disso: sem introdução, sem conclusão, sem títulos extras.\n' +
    'Use o nome do CLIENTE (não o nome do grupo; nada de "Suporte N7 –"). Só entra o que precisa de resposta ou ação da equipe: pedido, pergunta, aprovação, ajuste, agendamento. Ignore cumprimentos, agradecimentos, "ok", figurinhas, "enviei o documento" sem pedido e conversa entre as pessoas — se só houver isso, deixe o cliente de fora. Escreva o que o cliente quer ("quer trocar a cor da mesa"), não o que ele fez ("enviou áudio").' +
    (equipe.length ? '\nQUEM CUIDA DE CADA ASSUNTO (marque com {{marcar:Nome}} exatamente como aqui; se não souber de quem é, não marque):\n' + equipe.map(p => '- ' + p.nome + (p.assuntos ? ': ' + p.assuntos : '')).join('\n') : '') +
    '\nSe nenhum cliente precisar de resposta, responda exatamente [[NADA]].',
    blocos.join('\n\n'), 700);
  if (!s.texto) { await registrar(sb, { tipo: 'erro', jid: destino, pergunta: 'resumo', ...usoDe(s) }); return { ok: false, erro: 'A IA não respondeu agora.' }; }
  if (/\[\[NADA\]\]/.test(s.texto)) {
    if (forcado) await enviar(sb, cfg, destino, '✅ Nenhum cliente esperando resposta agora.');
    await registrar(sb, { tipo: 'resumo', jid: destino, pergunta: forcado ? 'pedido' : 'automático', resposta: 'nada pendente', ...usoDe(s) });
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
  const foi = await enviar(sb, cfg, destino, texto, extra);
  await registrar(sb, { tipo: 'resumo', jid: destino, pergunta: forcado ? 'pedido' : 'automático', resposta: texto.slice(0, 1500), ...usoDe(s) });
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
  if (!texto) return;
  if (key.fromMe && !chamouPeloNome(cfg, texto)) return;
  const marcados = new Set<string>([...((ctx.mentionedJid || []) as string[]).map(dig), ...[...texto.matchAll(/@(\d{8,})/g)].map(v => v[1])]);
  const lid = marcados.size ? await meuLid(sb, cfg, cfg.grupo_equipe!, numero) : (cfg.meu_lid || '');
  let marcado = [...marcados].some(x => x === numero || x.slice(-8) === numero.slice(-8) || (lid && x === lid)) || chamouPeloNome(cfg, texto);
  if (!marcado && ctx.stanzaId) { const { data: c } = await sb.from('wa_mensagens').select('do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle(); marcado = !!c?.do_assistente; }
  if (!marcado) return;
  await consultaInterna(sb, cfg, raw, texto, cfg.grupo_equipe!);
}

/* =====================================================================
   4.57.0 — DOCUMENTOS: "Otto, me manda o PDF dos roteiros da Sabor da Feira
   de novembro" / "a linha editorial da Arena Deck". Só para a equipe.
   ===================================================================== */
function mesDoTexto(t: string): { mes: number | null; ano: number | null } {
  const n = semAcento(t), hoje = new Date(Date.now() - 3 * 3600000);
  let mes: number | null = null, ano: number | null = null;
  MESES.forEach((m, i) => { if (new RegExp('\\b' + semAcento(m) + '\\b').test(n)) mes = i + 1; });
  if (/mes passado|ultimo mes/.test(n)) { mes = hoje.getUTCMonth() === 0 ? 12 : hoje.getUTCMonth(); ano = hoje.getUTCMonth() === 0 ? hoje.getUTCFullYear() - 1 : hoje.getUTCFullYear(); }
  else if (/(esse|este|deste|desse) mes/.test(n)) { mes = hoje.getUTCMonth() + 1; }
  else if (/proximo mes/.test(n)) { mes = hoje.getUTCMonth() === 11 ? 1 : hoje.getUTCMonth() + 2; ano = hoje.getUTCMonth() === 11 ? hoje.getUTCFullYear() + 1 : hoje.getUTCFullYear(); }
  const a = n.match(/\b(20\d{2})\b/); if (a) ano = Number(a[1]);
  if (mes && !ano) ano = hoje.getUTCFullYear();
  return { mes, ano };
}
async function enviarDocumento(sb: SupabaseClient, cfg: Config, jid: string, nome: string, media: string, legenda: string, citar?: any) {
  const r = await evo('/message/sendMedia/' + I(), 'POST', { number: jid, mediatype: 'document', mimetype: 'application/pdf', fileName: nome,
    media, caption: '*' + String(cfg.nome || 'Otto').split(/\s+/)[0] + ':*\n' + legenda, ...(citar ? { quoted: citar } : {}) }, 90000);
  if (!r.ok) { console.log('documento', r.status, JSON.stringify(r.dados).slice(0, 200)); return null; }
  try { await gravar(sb, r.dados, { enviada_por_nome: cfg.nome, do_assistente: true }); } catch (_e) { /* o eco grava */ }
  if (r.dados?.key?.id) await sb.from('wa_mensagens').update({ do_assistente: true, enviada_por_nome: cfg.nome, status: 'SERVER_ACK' }).eq('id', r.dados.key.id);
  return r.dados;
}
/** Pedido de documento? Responde e devolve true; senão false (segue a conversa normal). */
async function talvezDocumento(sb: SupabaseClient, cfg: Config, raw: any, pedido: string, destino: string, clientePadrao?: { id: string; nome: string } | null): Promise<boolean> {
  const n = semAcento(pedido);
  const querLinha = /editorial|linha (do|da|de)|linha editorial/.test(n);
  const querRoteiro = /roteiro/.test(n);
  if (!(querLinha || querRoteiro) || !/pdf|manda|envia|mande|envie|passa|me da|preciso d|quero/.test(n)) return false;
  const citar = raw?.key?.id ? { key: raw.key, message: { conversation: pedido.slice(0, 200) } } : undefined;
  let clientes = await clientesCitados(sb, pedido);
  if (!clientes.length && clientePadrao) clientes = [clientePadrao];
  if (!clientes.length) { await enviar(sb, cfg, destino, 'De qual cliente? Me fala o nome que eu já te mando o PDF.', citar ? { quoted: citar } : {}); return true; }
  const c = clientes[0];
  const { mes, ano } = mesDoTexto(pedido);
  await digitando(destino, cfg);
  if (querLinha) {
    let q: any = sb.from('linhas_editoriais').select('id, mes, ano, nome').eq('client_id', c.id).is('deleted_at', null);
    if (mes) q = q.eq('mes', mes); if (ano) q = q.eq('ano', ano);
    const { data: ls } = await q.order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1);
    if (!ls?.length) { await enviar(sb, cfg, destino, 'Não achei linha editorial da ' + c.nome + (mes ? ' de ' + MESES[mes - 1] : '') + ' no sistema.', citar ? { quoted: citar } : {}); return true; }
    const doc = await pdfDaLinha(sb, ls[0].id);
    if (!doc) { await enviar(sb, cfg, destino, 'Não consegui montar a linha editorial agora.', citar ? { quoted: citar } : {}); return true; }
    const tit = 'linha editorial da ' + c.nome + ' de ' + MESES[(ls[0].mes || 1) - 1] + (ls[0].ano ? ' de ' + ls[0].ano : '');
    const foi = await enviarDocumento(sb, cfg, destino, doc.nome, paraB64(doc.bytes), 'Aqui está a ' + tit + '.', citar);
    await registrar(sb, { tipo: foi ? 'documento' : 'erro', jid: destino, autor: String(raw?.pushName || ''), pergunta: pedido.slice(0, 500), resposta: tit });
    return true;
  }
  let q: any = sb.from('gravacoes').select('id, nome, data_gravacao, competencia_mes, competencia_ano').eq('client_id', c.id).is('deleted_at', null).is('archived_at', null);
  const { data: gs } = await q.order('data_gravacao', { ascending: false, nullsFirst: false }).limit(60);
  let lista = (gs || []) as any[];
  if (mes) lista = lista.filter(g => (g.competencia_mes ? Number(g.competencia_mes) === mes && (!ano || Number(g.competencia_ano) === ano)
    : g.data_gravacao && Number(String(g.data_gravacao).slice(5, 7)) === mes && (!ano || Number(String(g.data_gravacao).slice(0, 4)) === ano)));
  const nomeG = lista.find(g => semAcento(g.nome).split(/\s+/).filter((w: string) => w.length >= 5).some((w: string) => n.includes(w)));
  const escolhidas = nomeG ? [nomeG] : lista.slice(0, mes ? 3 : 1);
  if (!escolhidas.length) { await enviar(sb, cfg, destino, 'Não achei gravação da ' + c.nome + (mes ? ' em ' + MESES[mes - 1] : '') + ' com roteiros no sistema.', citar ? { quoted: citar } : {}); return true; }
  for (const g of escolhidas) {
    const r = await pdfDaGravacao(sb, g.id);
    if (!r) { await enviar(sb, cfg, destino, 'A gravação ' + g.nome + ' não tem roteiros.', citar ? { quoted: citar } : {}); continue; }
    const foi = await enviarDocumento(sb, cfg, destino, r.nome, paraB64(r.bytes), 'Aqui estão os roteiros da ' + c.nome + ' · ' + g.nome + '.', citar);
    await registrar(sb, { tipo: foi ? 'documento' : 'erro', jid: destino, autor: String(raw?.pushName || ''), pergunta: pedido.slice(0, 500), resposta: 'roteiros · ' + c.nome + ' · ' + g.nome });
  }
  return true;
}

/* 4.58.0: a ficha de roteiro do B7, desenhada aqui (supabase/functions/_shared/ficha.ts) */
function paraB64(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
const nomeArq = (partes: string[]) => (partes.filter(Boolean).join('_').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '_').toUpperCase().slice(0, 90) || 'ROTEIRO_B7') + '.pdf';
/* logo do cliente para o PDF (PNG/JPEG; outro formato fica de fora, como no sistema quando a imagem falha) */
async function logoDe(url: unknown): Promise<Logo | null> {
  if (!url || typeof url !== 'string') return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const u = new Uint8Array(await r.arrayBuffer());
    if (u.length > 3_000_000) return null;
    const fmt = u[0] === 0x89 && u[1] === 0x50 ? 'PNG' : u[0] === 0xFF && u[1] === 0xD8 ? 'JPEG' : null;
    if (fmt) return { b64: paraB64(u), fmt };
    // WebP (RIFF....WEBP): a maioria das logos. O jsPDF não lê, então converte pra PNG.
    const ehWebp = u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50;
    if (!ehWebp) return null;
    const png = await webpParaPng(u);
    return png ? { b64: paraB64(png), fmt: 'PNG' } : null;
  } catch (_e) { return null; }
}
let webpPronto: Promise<any> | null = null;
async function webpParaPng(u: Uint8Array): Promise<Uint8Array | null> {
  try {
    webpPronto ||= (async () => {
      const [{ default: decode, init }, { encode }, { WEBP_DEC_WASM }] = await Promise.all([
        import('npm:@jsquash/webp@1.4.0/decode.js'), import('npm:fast-png@6.2.0'), import('./webp-dec.ts')
      ]);
      const bin = Uint8Array.from(atob(WEBP_DEC_WASM), c => c.charCodeAt(0));
      await init(await WebAssembly.compile(bin));
      return { decode, encode };
    })();
    const { decode, encode } = await webpPronto;
    const img = await decode(u.slice().buffer);
    if (!img?.width) return null;
    return encode({ width: img.width, height: img.height, data: new Uint8Array(img.data.buffer), channels: 4 });
  } catch (_e) { webpPronto = null; return null; }
}
async function pdfDaGravacao(sb: SupabaseClient, gravacaoId: string): Promise<{ nome: string; bytes: Uint8Array } | null> {
  const { data: g } = await sb.from('gravacoes_resumo').select('*').eq('id', gravacaoId).maybeSingle();
  if (!g) return null;
  const { data: rts } = await sb.from('roteiros').select('*').eq('recording_session_id', gravacaoId).is('deleted_at', null).order('position');
  if (!rts?.length) return null;
  const { data: cenas } = await sb.from('cenas').select('*').in('script_id', rts.map((r: any) => r.id)).order('position');
  const por: Record<string, any[]> = {};
  rts.forEach((r: any) => { por[r.id] = (cenas || []).filter((c: any) => c.script_id === r.id); });
  const data = g.data_gravacao ? String(g.data_gravacao).slice(0, 10).split('-').reverse().join('/') : '';
  const bytes = fichaRoteiros({ cliente: g.cliente_nome, clienteLogo: g.geral ? null : await logoDe(g.cliente_logo_url), semCliente: !!g.geral, gravacao: g.nome, dataGravacao: data, roteiros: rts, cenasPorRoteiro: por });
  return { nome: nomeArq([g.cliente_nome, g.nome, 'ROTEIROS']), bytes };
}
/* 4.58.3: a linha editorial, como o "Baixar PDF" (A4) da tela */
async function pdfDaLinha(sb: SupabaseClient, linhaId: string): Promise<{ nome: string; bytes: Uint8Array } | null> {
  const { data: l } = await sb.from('linhas_resumo').select('*').eq('id', linhaId).maybeSingle();
  if (!l) return null;
  const [cs, pl, cl] = await Promise.all([
    sb.from('conteudos').select('*').eq('linha_id', linhaId).is('deleted_at', null).order('position'),
    sb.from('pilares').select('*').eq('linha_id', linhaId).order('position'),
    sb.from('clientes_resumo').select('logo_url').eq('id', l.client_id).maybeSingle()
  ]);
  const conteudos = (cs.data || []) as any[];
  const ids = (t: string) => conteudos.filter(c => c.tipo === t).map(c => c.id);
  const [sl, fr, rt] = await Promise.all([
    ids('Carrossel').length ? sb.from('slides').select('*').in('content_id', ids('Carrossel')).order('position') : { data: [] as any[] },
    ids('Story').length ? sb.from('frames').select('*').in('content_id', ids('Story')).order('position') : { data: [] as any[] },
    conteudos.some(c => c.script_id) ? sb.from('roteiros').select('id, titulo').in('id', conteudos.filter(c => c.script_id).map(c => c.script_id)) : { data: [] as any[] }
  ]);
  const agrupa = (lista: any[]) => { const o: Record<string, any[]> = {}; (lista || []).forEach(x => (o[x.content_id] = o[x.content_id] || []).push(x)); return o; };
  const roteiros: Record<string, any> = {}; ((rt.data || []) as any[]).forEach(r => { roteiros[r.id] = r; });
  const bytes = fichaLinha({ linha: l, conteudos, pilares: (pl.data || []) as any[], slides: agrupa(sl.data as any[]), frames: agrupa(fr.data as any[]), roteiros, clienteLogo: await logoDe((cl.data as any)?.logo_url) });
  const MESU = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  return { nome: nomeArq([l.cliente_nome, 'LINHA_EDITORIAL', MESU[(l.mes || 1) - 1] || '', String(l.ano || '')]), bytes };
}

/* =====================================================================
   4.58.2 — RECADOS: "Otto, avisa o Kevin pra ele me responder no WhatsApp".
   O Otto manda no privado da pessoa da equipe (cadastrada na aba Equipe)
   dizendo quem pediu, de onde e o quê — e confirma para quem pediu.
   ===================================================================== */
const VERBO_RECADO = /\b(avis[ae]|avisar|fal[ae] (pr[ao]|com|para)|diz(er)? (pr[ao]|para)|manda(r)? (uma )?(mensagem|msg|recado) (pr[ao]|para)|cham[ae] (o|a)|ped[ei] (pr[ao]|para)|lembr[ae] (o|a)|recado (pr[ao]|para))\b/;
async function talvezRecado(sb: SupabaseClient, cfg: Config, raw: any, texto: string, destino: string, origem: { quem: string; onde: string; cliente?: boolean }): Promise<boolean> {
  const n = semAcento(texto);
  if (!VERBO_RECADO.test(n)) return false;
  const equipe = (cfg.equipe || []).filter(p => p.nome && p.numero);
  /* quem deve receber: o primeiro nome de alguém da equipe citado no texto (não quem está pedindo) */
  const alvo = equipe.find(p => { const pn = semAcento(String(p.nome).split(/\s+/)[0]); return pn.length >= 3 && new RegExp('(^|[^a-z0-9])' + pn + '([^a-z0-9]|$)').test(n) && semAcento(origem.quem).split(/\s+/)[0] !== pn; });
  if (!alvo) return false;
  const citar = raw?.key?.id ? { key: raw.key, message: { conversation: texto.slice(0, 200) } } : undefined;
  const s = await ia(
    `Você é ${cfg.nome}, assistente da agência Branding7. Escreva um RECADO curto (1 ou 2 frases, tom de WhatsApp, em primeira pessoa como assistente) para ${alvo.nome}, da equipe, ` +
    'dizendo QUEM pediu, DE ONDE (grupo/conversa) e O QUE a pessoa quer — ex.: "Oi, Kevin! O Kaique pediu pra você responder ele no WhatsApp." Se houver assunto, inclua. Sem assinatura, sem listas.',
    'PEDIDO (de ' + origem.quem + (origem.onde ? ', em ' + origem.onde : '') + (origem.cliente ? ', cliente' : '') + '): ' + texto.replace(/@\d{6,}/g, '').trim(), 200);
  const recado = s.texto || ('Oi, ' + String(alvo.nome).split(/\s+/)[0] + '! ' + origem.quem + (origem.onde ? ' (' + origem.onde + ')' : '') + ' pediu: ' + texto.slice(0, 300));
  const foi = await enviar(sb, cfg, dig(alvo.numero) + '@s.whatsapp.net', recado);
  await registrar(sb, { tipo: foi ? 'recado' : 'erro', jid: destino, autor: origem.quem, pergunta: texto.slice(0, 500), resposta: 'para ' + alvo.nome + ': ' + recado.slice(0, 800), ...usoDe(s) });
  await digitando(destino, cfg);
  await enviar(sb, cfg, destino, foi ? 'Pronto, avisei ' + (/a$/i.test(String(alvo.nome).split(/\s+/)[0]) ? 'a ' : 'o ') + String(alvo.nome).split(/\s+/)[0] + ' 👍' : 'Não consegui mandar o recado agora, tenta de novo daqui a pouco.', citar ? { quoted: citar } : {});
  return true;
}

/** Pergunta interna da equipe (grupo da equipe ou privado): pendências ou o que há de um cliente. */
async function consultaInterna(sb: SupabaseClient, cfg: Config, raw: any, texto: string, destino: string) {
  const key = raw?.key || {};
  const pedido = texto.replace(/@\d{6,}/g, '').trim();
  if (await talvezDocumento(sb, cfg, raw, pedido, destino)) return;
  if (await talvezRecado(sb, cfg, raw, pedido, destino, { quem: String(raw?.pushName || (key.fromMe ? 'Você' : 'alguém da equipe')), onde: destino === cfg.grupo_equipe ? 'grupo da equipe' : 'privado' })) return;
  if (/pend[eê]ncia|quem (est[aá]|t[aá]) esperando|sem resposta|esperando resposta/i.test(pedido) && !(await clientesCitados(sb, pedido)).length) { await mandarResumo(sb, cfg, true, destino); return; }
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
    `Você é ${cfg.nome}, assistente interno da equipe da Branding7, respondendo alguém da EQUIPE (não é cliente). Responda o que perguntaram usando só os dados abaixo: o que está em produção (artes, vídeos, gravações) e o que os clientes escreveram nos grupos. ` +
    'Responda como uma pessoa da equipe falando no WhatsApp: texto corrido, curto (2 a 4 frases), direto ao ponto, sem listas, tópicos, marcadores, títulos, negrito nem "próximos passos sugeridos" — a não ser que a pessoa peça explicitamente uma lista. Não assine (a assinatura entra sozinha). Se ficar mais natural, pode mandar até 3 mensagens curtas seguidas, separadas por uma linha contendo só [[NOVA]]. Se não houver dado sobre o que perguntaram, diga isso claramente. Não invente.',
    'PERGUNTA DE ' + String(raw.pushName || 'alguém da equipe') + ': ' + pedido + contexto, 700);
  if (!s.texto) return;
  await digitando(destino, cfg);
  await enviar(sb, cfg, destino, s.texto, { quoted: { key, message: { conversation: texto.slice(0, 300) } } });
  await registrar(sb, { tipo: 'consulta', jid: destino, autor: String(raw.pushName || ''), pergunta: pedido.slice(0, 800), resposta: s.texto.slice(0, 1500), ...usoDe(s) });
}
