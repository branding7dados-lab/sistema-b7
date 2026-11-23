// =====================================================================
// WhatsApp (Evolution API) — peças comuns de wa-entrada e wa-evolution
//   • conversa com o Evolution (evo)
//   • token do webhook (derivado da chave, sem segredo novo)
//   • interpretar uma mensagem do WhatsApp e gravar em wa_conversas/wa_mensagens
// =====================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { criarResolvedor, waPadraoCom, semTabela, type Numero } from './wa-numeros.ts';
export type { Numero } from './wa-numeros.ts';

export const admin = (): SupabaseClient => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const BASE = () => (Deno.env.get('EVOLUTION_URL') || '').replace(/\/+$/, '');
export const CHAVE = () => Deno.env.get('EVOLUTION_API_KEY') || '';
export const INST = () => Deno.env.get('EVOLUTION_INSTANCE') || 'b7-piloto';

/* 4.84.0: vários números. INST() continua sendo o número padrão (Otto, relógio); o resto usa o número da conversa. */
export const numeros = criarResolvedor(async () => {
  const { data, error } = await admin().from('wa_numeros').select('*').order('ordem');
  /* só a tabela ausente (banco sem a zzz383) vale como "sem números"; erro passageiro sobe (quem chamou responde 503) */
  if (error) { if (semTabela(error)) return []; throw new Error('wa_numeros: ' + (error.message || error.code)); }
  return (data || []) as Numero[];
});
/** instância do Evolution de um número (já pronta para a URL) */
export const instanciaDe = (n?: Numero | null) => encodeURIComponent(n?.instancia || INST());
const idPadrao = async () => (await numeros.padrao())?.id || null;
/** wa_conversas / wa_mensagens presos ao número padrão (o Otto só enxerga ele) */
export const waPadrao = (sb: SupabaseClient) => waPadraoCom(sb, idPadrao);
/** filtro do número numa consulta (sem número = banco antigo: não filtra) */
const noNum = (q: any, nid: string | null) => nid ? q.eq('numero_id', nid) : q;
const nidDe = async (num?: Numero | null) => num?.id || await idPadrao();

export async function evo(caminho: string, metodo = 'GET', corpo?: unknown, ms = 25000): Promise<{ ok: boolean; status: number; dados: any }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(BASE() + caminho, {
      method: metodo,
      headers: { apikey: CHAVE(), 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctl.signal
    });
    let dados: any = null;
    try { dados = await r.json(); } catch (_e) { dados = null; }
    return { ok: r.ok, status: r.status, dados };
  } finally { clearTimeout(t); }
}

/** token do webhook: HMAC da chave do Evolution (quem tem a chave, tem o token) */
export async function tokenWebhook(): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(CHAVE() || 'sem-chave'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('b7-wa-webhook'));
  return Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const ehGrupo = (jid: string) => /@g\.us$/.test(jid || '');
const numeroDe = (jid: string) => String(jid || '').split('@')[0].split(':')[0];

/* tira os "embrulhos" (mensagem temporária, ver uma vez, editada…) */
function desembrulhar(m: any): any {
  let x = m || {};
  for (let i = 0; i < 4; i++) {
    const w = x.ephemeralMessage || x.viewOnceMessage || x.viewOnceMessageV2 || x.viewOnceMessageV2Extension || x.documentWithCaptionMessage;
    if (w && w.message) x = w.message; else break;
  }
  return x;
}

export type Linha = Record<string, unknown>;

/** o número (@s.whatsapp.net) que o WhatsApp manda ao lado do código @lid, numa conversa individual */
export function pnAlt(key: any): string {
  const x = [key?.remoteJidAlt, key?.senderPn].find((v: any) => typeof v === 'string' && /@s\.whatsapp\.net$/.test(v));
  return x ? String(x) : '';
}
/** 4.58.6: o jid de conversa que o B7 usa. A mesma pessoa vinha ora pelo número, ora pelo @lid,
    e virava duas conversas. Agora fica sempre no número quando dá pra saber qual é. */
export async function jidCanonico(sb: SupabaseClient, key: any): Promise<string> {
  const jid = String(key?.remoteJid || '');
  if (!/@lid$/.test(jid)) return jid;
  const alt = pnAlt(key);
  if (alt) {
    await sb.from('wa_contatos').upsert({ jid, numero: alt.split('@')[0], atualizado_em: new Date().toISOString() });
    return alt;
  }
  const { data: ct } = await sb.from('wa_contatos').select('numero').eq('jid', jid).maybeSingle();
  return ct?.numero && /^\d{8,}$/.test(ct.numero) ? ct.numero + '@s.whatsapp.net' : jid;
}

/** mensagem do Evolution → linha de wa_mensagens (ou um "efeito": reação, apagada, editada) */
export function interpretar(raw: any): { linha?: Linha; efeito?: { tipo: string; alvo: string; valor?: string; autor?: string } } | null {
  const key = raw?.key || {};
  const jidOrig: string = key.remoteJid || '';
  /* 4.58.6: conversa individual vinda pelo código @lid com o número ao lado: fica no número */
  const jid: string = /@lid$/.test(jidOrig) ? (pnAlt(key) || jidOrig) : jidOrig;
  if (!jid || jid === 'status@broadcast' || /@newsletter$/.test(jid)) return null;
  const m = desembrulhar(raw.message);
  const ts = Number(raw.messageTimestamp || 0);
  const quando = ts ? new Date(ts * 1000).toISOString() : new Date().toISOString();
  const autorJid = key.fromMe ? null : (key.participant || raw.participant || jid);

  if (m.reactionMessage) return { efeito: { tipo: 'reacao', alvo: m.reactionMessage.key?.id, valor: m.reactionMessage.text || '', autor: key.fromMe ? 'eu' : (autorJid || jid) } };
  if (m.protocolMessage) {
    const p = m.protocolMessage;
    if (p.type === 0 || p.type === 'REVOKE') return { efeito: { tipo: 'apagada', alvo: p.key?.id } };
    if (p.editedMessage || p.type === 14 || p.type === 'MESSAGE_EDIT') {
      const e = desembrulhar(p.editedMessage);
      return { efeito: { tipo: 'editada', alvo: p.key?.id, valor: e.conversation || e.extendedTextMessage?.text || e.imageMessage?.caption || '' } };
    }
    return null;
  }
  if (m.editedMessage) {
    const e = desembrulhar(m.editedMessage);
    const pm = e.protocolMessage;
    if (pm) { const n = desembrulhar(pm.editedMessage); return { efeito: { tipo: 'editada', alvo: pm.key?.id, valor: n.conversation || n.extendedTextMessage?.text || '' } }; }
  }

  let tipo = 'outro', texto: string | null = null, mime: string | null = null, nome: string | null = null, tam: number | null = null, dur: number | null = null, mini: string | null = null;
  const ctx = raw.contextInfo || m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo || m.audioMessage?.contextInfo || m.documentMessage?.contextInfo || null;
  const miniDe = (o: any) => (typeof o?.jpegThumbnail === 'string' && o.jpegThumbnail.length < 60000) ? o.jpegThumbnail : null;
  if (m.conversation != null || m.extendedTextMessage) { tipo = 'texto'; texto = m.conversation ?? m.extendedTextMessage?.text ?? ''; }
  else if (m.imageMessage) { tipo = 'imagem'; texto = m.imageMessage.caption || null; mime = m.imageMessage.mimetype; tam = Number(m.imageMessage.fileLength) || null; mini = miniDe(m.imageMessage); }
  else if (m.videoMessage) { tipo = 'video'; texto = m.videoMessage.caption || null; mime = m.videoMessage.mimetype; tam = Number(m.videoMessage.fileLength) || null; dur = Number(m.videoMessage.seconds) || null; mini = miniDe(m.videoMessage); }
  else if (m.audioMessage) { tipo = 'audio'; mime = m.audioMessage.mimetype; dur = Number(m.audioMessage.seconds) || null; tam = Number(m.audioMessage.fileLength) || null; }
  else if (m.documentMessage) { tipo = 'documento'; texto = m.documentMessage.caption || null; mime = m.documentMessage.mimetype; nome = m.documentMessage.fileName || m.documentMessage.title || 'arquivo'; tam = Number(m.documentMessage.fileLength) || null; mini = miniDe(m.documentMessage); }
  else if (m.stickerMessage) { tipo = 'figurinha'; mime = m.stickerMessage.mimetype || 'image/webp'; }
  else if (m.locationMessage || m.liveLocationMessage) { const l = m.locationMessage || m.liveLocationMessage; tipo = 'localizacao'; texto = (l.name || l.address || '') + '|' + l.degreesLatitude + ',' + l.degreesLongitude; }
  else if (m.contactMessage) { tipo = 'contato'; texto = m.contactMessage.displayName || 'Contato'; }
  else if (m.contactsArrayMessage) { tipo = 'contato'; texto = (m.contactsArrayMessage.contacts || []).map((c: any) => c.displayName).join(', '); }
  else if (m.pollCreationMessage || m.pollCreationMessageV3) { const p = m.pollCreationMessage || m.pollCreationMessageV3; tipo = 'enquete'; texto = p.name || 'Enquete'; }
  else if (m.senderKeyDistributionMessage && Object.keys(m).length <= 2) return null;
  else if (!Object.keys(m).length) return null;

  /* 4.52.5: nos grupos o WhatsApp manda um código @lid; o número de verdade pode vir ao lado */
  const alt = [key.participantAlt, key.participantPn, key.senderPn, key.remoteJidAlt, raw.participantAlt].find((x: any) => typeof x === 'string' && /@s\.whatsapp\.net$/.test(x));
  const nomeAutor = raw.pushName && raw.pushName !== 'Você' ? String(raw.pushName) : (alt ? '+' + numeroDe(alt) : numeroDe(autorJid || jid));
  const linha: Linha = {
    id: key.id, jid, de_mim: !!key.fromMe,
    autor_jid: autorJid, autor_nome: key.fromMe ? null : nomeAutor,
    tipo, texto, midia_mime: mime, midia_nome: nome, midia_tamanho: tam, duracao: dur, miniatura: mini,
    status: raw.status || (key.fromMe ? 'SERVER_ACK' : null), criada_em: quando
  };
  /* 4.52.5: o necessário para baixar a mídia depois (sem a miniatura, que já fica em `miniatura`) */
  const tipoMidia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find(k => m[k]);
  if (tipoMidia) { const o = { ...m[tipoMidia] }; delete o.jpegThumbnail; delete o.contextInfo; delete o.thumbnailDirectPath; linha.midia_raw = { key: { id: key.id, remoteJid: jidOrig, fromMe: !!key.fromMe, participant: key.participant || undefined }, message: { [tipoMidia]: o } }; }
  if (ctx?.stanzaId) {
    linha.citada_id = ctx.stanzaId;
    const q = desembrulhar(ctx.quotedMessage || {});
    linha.citada_previa = (q.conversation || q.extendedTextMessage?.text || (q.imageMessage ? '📷 ' + (q.imageMessage.caption || 'Foto') : q.videoMessage ? '🎬 ' + (q.videoMessage.caption || 'Vídeo') : q.audioMessage ? '🎤 Áudio' : q.documentMessage ? '📄 ' + (q.documentMessage.fileName || 'Documento') : q.stickerMessage ? 'Figurinha' : '') || '').slice(0, 200);
    linha.citada_autor = ctx.participant ? numeroDe(ctx.participant) : null;
  }
  return { linha };
}

export function previaDe(l: Linha): string {
  const t = String(l.texto || '');
  switch (l.tipo) {
    case 'imagem': return '📷 ' + (t || 'Foto');
    case 'video': return '🎬 ' + (t || 'Vídeo');
    case 'audio': return '🎤 Áudio' + (l.duracao ? ' (' + Math.floor(Number(l.duracao) / 60) + ':' + String(Number(l.duracao) % 60).padStart(2, '0') + ')' : '');
    case 'documento': return '📄 ' + (l.midia_nome || 'Documento');
    case 'figurinha': return 'Figurinha';
    case 'localizacao': return '📍 Localização';
    case 'contato': return '👤 ' + t;
    case 'enquete': return '📊 ' + t;
    case 'texto': return t.slice(0, 200);
    default: return 'Mensagem';
  }
}

/** grava (ou atualiza) uma mensagem e a conversa dela. Devolve a linha gravada. */
/** números (8 últimos dígitos) da equipe cadastrada na tela do Otto — cache de 1 min */
let equipeCache: { em: number; nums: Set<string> } | null = null;
export async function numerosDaEquipe(sb: SupabaseClient): Promise<Set<string>> {
  if (equipeCache && Date.now() - equipeCache.em < 60_000) return equipeCache.nums;
  const { data } = await sb.from('wa_assistente').select('equipe').eq('id', 1).maybeSingle();
  /* 4.80.0: o número principal e os "outros números" de cada pessoa (ex.: celular pessoal) */
  const nums = new Set<string>(((data?.equipe || []) as any[]).flatMap(p => [p?.numero, ...String(p?.outros_numeros || '').split(/[,;\n]/)])
    .map(n => String(n || '').replace(/\D/g, '')).filter(n => n.length >= 10).map(n => n.slice(-8)));
  equipeCache = { em: Date.now(), nums };
  return nums;
}
export async function gravar(sb: SupabaseClient, raw: any, extra: Linha = {}, opcoes: { historico?: boolean } = {}, num?: Numero | null): Promise<Linha | null> {
  const r = interpretar(raw);
  if (!r) return null;
  const nid = await nidDe(num);
  if (r.efeito) { await aplicarEfeito(sb, raw?.key?.remoteJid, r.efeito, nid); return null; }
  const l = Object.assign(r.linha!, extra);
  if (nid) l.numero_id = nid;
  if (/@lid$/.test(String(raw?.key?.remoteJid || ''))) l.jid = await jidCanonico(sb, raw.key);
  const jid = String(l.jid);
  /* 4.53.1: sem pushName (código @lid) — usa o nome já conhecido do contato */
  /* 4.80.3: nome dado pela equipe na Central (nome_fixo) vale sobre o do WhatsApp; nome sem letra nem número (".") não conta */
  const semNome = (n: unknown) => !n || /^\+?\d+$/.test(String(n)) || !/[\p{L}\p{N}]/u.test(String(n));
  if (!l.de_mim && l.autor_jid) {
    const { data: ct } = await sb.from('wa_contatos').select('nome, nome_fixo').eq('jid', String(l.autor_jid)).maybeSingle();
    if (ct?.nome && (ct.nome_fixo || semNome(l.autor_nome)) && !semNome(ct.nome)) l.autor_nome = ct.nome;
    if (!ct?.nome_fixo && raw.pushName && raw.pushName !== 'Você' && !semNome(raw.pushName))
      await sb.from('wa_contatos').upsert({ jid: String(l.autor_jid), nome: String(raw.pushName), atualizado_em: new Date().toISOString() });
  }
  await garantirConversa(sb, jid, l.de_mim ? null : (ehGrupo(jid) ? null : String(raw.pushName || '')), undefined, undefined, num);
  const { data: ja } = await noNum(sb.from('wa_mensagens').select('id, enviada_por, midia_path, status'), nid).eq('id', l.id).maybeSingle();
  if (ja) {
    /* já existe (ex.: o B7 gravou ao enviar e o eco chegou): só completa o que faltar */
    const patch: Linha = {};
    for (const k of ['miniatura', 'midia_mime', 'midia_tamanho', 'duracao', 'midia_nome']) if (l[k] != null) patch[k] = l[k];
    /* 4.53.2: o status só sobe (✓ → ✓✓ → lida); o eco "PENDING" não volta o relógio */
    if (l.status != null && STATUS_ORDEM.indexOf(String(l.status)) > STATUS_ORDEM.indexOf(String(ja.status || ''))) patch.status = l.status;
    if (Object.keys(patch).length) await noNum(sb.from('wa_mensagens').update(patch), nid).eq('id', l.id);
    return null;
  }
  const { error } = await sb.from('wa_mensagens').insert(l);
  if (error) return null;
  /* 4.79.3: alguém da equipe escrevendo do celular PESSOAL num grupo de cliente ("Ótima segunda a todos" do Matheus)
     não é o cliente esperando resposta — conta como resposta da equipe. Confere pelo número (nunca pelo nome). */
  let daEquipe = false;
  if (!l.de_mim && ehGrupo(jid)) {
    const k = raw?.key || {};
    const alt = [k.participantAlt, k.participantPn, k.senderPn, raw?.participantAlt].find((x: any) => typeof x === 'string' && /@s\.whatsapp\.net$/.test(x));
    let fone = alt ? numeroDe(alt) : (/@s\.whatsapp\.net$/.test(String(l.autor_jid || '')) ? numeroDe(String(l.autor_jid)) : '');
    if (!fone && l.autor_jid) { const { data: ct } = await sb.from('wa_contatos').select('numero').eq('jid', String(l.autor_jid)).maybeSingle(); fone = String(ct?.numero || '').replace(/\D/g, ''); }
    if (fone) daEquipe = (await numerosDaEquipe(sb)).has(fone.slice(-8));
  }
  /* a conversa: prévia, hora, não lidas, "esperando resposta" */
  const { data: c } = await noNum(sb.from('wa_conversas').select('ultima_em, nao_lidas, esperando_desde, aguardando_cliente_desde, arquivada_auto'), nid).eq('jid', jid).maybeSingle();
  const maisNova = !c?.ultima_em || new Date(String(l.criada_em)) >= new Date(c.ultima_em);
  const patch: Linha = { atualizado_em: new Date().toISOString() };
  if (maisNova) {
    patch.ultima_em = l.criada_em;
    patch.previa = previaDe(l);
    patch.previa_autor = l.de_mim ? (l.enviada_por_nome || null) : (ehGrupo(jid) ? l.autor_nome : null);
    patch.previa_de_mim = !!l.de_mim;
    /* 4.80.0: DE QUEM É A VEZ. Última palavra da equipe (número do B7 ou celular de alguém da equipe) → a gente
       está esperando o cliente; última palavra do cliente → o cliente está esperando a gente. Um zera o outro. */
    if (l.de_mim || daEquipe) { patch.esperando_desde = null; if (!c?.aguardando_cliente_desde) patch.aguardando_cliente_desde = l.criada_em; }
    else { patch.aguardando_cliente_desde = null; if (!c?.esperando_desde) patch.esperando_desde = l.criada_em; }
  }
  if (!l.de_mim && !opcoes.historico) patch.nao_lidas = (c?.nao_lidas || 0) + 1;
  /* 4.81.0: arquivada sozinha por estar parada — mensagem nova traz de volta para a lista */
  if (maisNova && !opcoes.historico && c?.arquivada_auto) { patch.arquivada = false; patch.arquivada_auto = false; }
  await noNum(sb.from('wa_conversas').update(patch), nid).eq('jid', jid);
  return l;
}

async function aplicarEfeito(sb: SupabaseClient, jid: string, e: { tipo: string; alvo: string; valor?: string; autor?: string }, nid: string | null) {
  if (!e.alvo) return;
  if (e.tipo === 'apagada') { await noNum(sb.from('wa_mensagens').update({ apagada: true, texto: null }), nid).eq('id', e.alvo); return; }
  if (e.tipo === 'editada') { await noNum(sb.from('wa_mensagens').update({ editada: true, texto: e.valor || '' }), nid).eq('id', e.alvo); return; }
  if (e.tipo === 'reacao') {
    const { data } = await noNum(sb.from('wa_mensagens').select('reacoes'), nid).eq('id', e.alvo).maybeSingle();
    if (!data) return;
    const r: Record<string, string[]> = data.reacoes || {};
    let quem = e.autor || jid;
    /* 4.82.2: a reação que o Otto manda volta pelo WhatsApp como "eu" (sai do número da B7). Se o Otto já reagiu e
       ninguém da Central reagiu, é o eco dele — não conta de novo como "Você". */
    if (quem === 'eu') { const l = Object.values(r).flat(); if (l.includes('otto') && !l.includes('eu')) quem = 'otto'; }
    for (const k of Object.keys(r)) { r[k] = r[k].filter(x => x !== quem); if (!r[k].length) delete r[k]; }
    if (e.valor) (r[e.valor] = r[e.valor] || []).push(quem);
    await noNum(sb.from('wa_mensagens').update({ reacoes: r }), nid).eq('id', e.alvo);
  }
}

/** cria a conversa se não existir; nome do grupo vem do Evolution; liga ao cliente pelo nome do grupo */
export async function garantirConversa(sb: SupabaseClient, jid: string, nomeContato: string | null, nomeGrupo?: string | null, foto?: string | null, num?: Numero | null) {
  const nid = await nidDe(num);
  const { data: c } = await noNum(sb.from('wa_conversas').select('jid, nome, nome_fixo, cliente_id, foto_url'), nid).eq('jid', jid).maybeSingle();
  const semNome = (n: unknown) => !n || /^\+?\d+$/.test(String(n)) || !/[\p{L}\p{N}]/u.test(String(n));
  const grupo = ehGrupo(jid);
  let nome = c?.nome || null;
  if (grupo && (nomeGrupo || !nome)) {
    if (nomeGrupo) nome = nomeGrupo;
    else {
      try {
        const g = await evo('/group/findGroupInfos/' + instanciaDe(num || await numeros.padrao()) + '?groupJid=' + encodeURIComponent(jid), 'GET', undefined, 8000);
        if (g.ok && g.dados?.subject) { nome = g.dados.subject; if (!foto && g.dados.pictureUrl) foto = g.dados.pictureUrl; }
      } catch (_e) { /* fica sem nome por ora */ }
    }
  }
  if (!grupo && semNome(nome) && !semNome(nomeContato) && nomeContato !== 'Você') nome = nomeContato;
  if (!grupo && semNome(nome)) {
    /* 4.52.6: conversa começada por nós (sem pushName) — usa o nome guardado do contato */
    const { data: ct } = await sb.from('wa_contatos').select('nome').eq('jid', jid).maybeSingle();
    if (ct?.nome && !semNome(ct.nome)) nome = ct.nome;
  }
  if (c?.nome_fixo) nome = c.nome;   /* 4.80.3: renomeado pela equipe — o WhatsApp não troca */
  let cliente = c?.cliente_id || null;
  if (!cliente && grupo && nome) {
    const { data: g } = await sb.from('whatsapp_grupos').select('cliente_id').eq('nome', nome).eq('ignorar', false).not('cliente_id', 'is', null).maybeSingle();
    cliente = g?.cliente_id || null;
  }
  if (!c) {
    await sb.from('wa_conversas').insert({ ...(nid ? { numero_id: nid } : {}), jid, tipo: grupo ? 'grupo' : 'contato', nome: nome || numeroDe(jid), cliente_id: cliente, foto_url: foto || null });
  } else {
    const p: Linha = {};
    if (nome && nome !== c.nome) p.nome = nome;
    if (cliente && !c.cliente_id) p.cliente_id = cliente;
    if (foto && foto !== c.foto_url) p.foto_url = foto;
    if (Object.keys(p).length) await noNum(sb.from('wa_conversas').update(p), nid).eq('jid', jid);
  }
}

export const STATUS_ORDEM = ['ERROR', 'PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED'];
