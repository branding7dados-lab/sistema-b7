// =====================================================================
// WA-EVOLUTION — o B7 conversando com o Evolution API (WhatsApp)
//
// Única ponte entre o B7 e o Evolution: a chave fica só nos secrets.
//   EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE (padrão b7-piloto)
//
// Ações (POST { acao, ... }):
//  só administrador:  estado · conectar {numero?} · desconectar · importar {pagina?}
//  quem vê o WhatsApp (admin + videomakers):
//    enviar_texto {jid, texto, citar?} · enviar_midia {jid, path, tipo, nome?, mime?, legenda?, citar?}
//    enviar_audio {jid, path} · reagir {id, emoji} · apagar {id} · lida {jid} · midia {id}
// O webhook (mensagens chegando → wa-entrada) é ligado sozinho ao conectar.
// =====================================================================
import { comCors } from '../_shared/cors.ts';
import { admin, evo, BASE, CHAVE, INST, tokenWebhook, gravar, garantirConversa } from '../_shared/wa.ts';

const VERSAO = 'wa-evolution 3 (4.51.0)';
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const I = () => encodeURIComponent(INST());

type Perfil = { id: string; nome: string; papel: string; estado: string; eh_admin?: boolean };
async function quemChamou(req: Request): Promise<Perfil | null> {
  const cab = req.headers.get('authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: p } = await sb.from('perfis').select('id, nome, username, papel, estado, eh_admin').eq('id', data.user.id).maybeSingle();
  if (!p || p.estado !== 'ativa') return null;
  return { ...p, nome: (p.nome || '').trim() || p.username } as Perfil;
}
const ehAdmin = (p: Perfil) => p.papel === 'admin' || p.eh_admin === true;
async function podeVer(p: Perfil) {
  if (ehAdmin(p)) return true;
  const { data } = await admin().rpc('eh_videomaker_elegivel', { p_id: p.id });
  return !!data;
}

const comPrefixo = (b: string) => !b ? '' : b.startsWith('data:') ? b : 'data:image/png;base64,' + b;

const EVENTOS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE', 'GROUPS_UPSERT', 'GROUP_UPDATE', 'CHATS_UPSERT', 'CONNECTION_UPDATE'];
async function ligarWebhook() {
  const url = Deno.env.get('SUPABASE_URL') + '/functions/v1/wa-entrada';
  return evo('/webhook/set/' + I(), 'POST', { webhook: { enabled: true, url, headers: { 'x-b7-token': await tokenWebhook() }, byEvents: false, base64: false, events: EVENTOS } });
}

async function estado() {
  if (!BASE() || !CHAVE()) return { configurado: false };
  const r = await evo('/instance/connectionState/' + I());
  if (r.status === 404) return { configurado: true, existe: false, estado: 'sem_conexao' };
  if (r.status === 401) return { configurado: true, erro: 'O Evolution recusou a chave (EVOLUTION_API_KEY diferente da .b7-chave).' };
  if (!r.ok) return { configurado: true, erro: 'O Evolution respondeu ' + r.status + '.' };
  const st = r.dados?.instance?.state || r.dados?.state || 'desconhecido';
  let numero: string | null = null;
  if (st === 'open') {
    const l = await evo('/instance/fetchInstances?instanceName=' + I());
    const i = Array.isArray(l.dados) ? l.dados[0] : null;
    numero = (i?.ownerJid || i?.owner || '').split('@')[0] || null;
    await ligarWebhook().catch(() => null);
  }
  return { configurado: true, existe: true, estado: st, numero, instancia: INST() };
}

async function conectar(numero: string) {
  if (!BASE() || !CHAVE()) return { configurado: false };
  const q = numero ? '?number=' + numero : '';
  let r = await evo('/instance/connect/' + I() + q);
  if (r.status === 404) {
    r = await evo('/instance/create', 'POST', Object.assign({ instanceName: INST(), integration: 'WHATSAPP-BAILEYS', qrcode: true }, numero ? { number: numero } : {}));
    if (!r.ok) return { erro: 'Não consegui criar a conexão no Evolution (' + r.status + ').' };
    await ligarWebhook().catch(() => null);
    const q2 = r.dados?.qrcode || {};
    return { qr: comPrefixo(q2.base64 || ''), codigo: q2.pairingCode || null };
  }
  if (!r.ok) return { erro: 'O Evolution respondeu ' + r.status + '.' };
  if (r.dados?.instance?.state === 'open') return { conectado: true };
  await ligarWebhook().catch(() => null);
  return { qr: comPrefixo(r.dados?.base64 || ''), codigo: r.dados?.pairingCode || null };
}

/* histórico recente: grupos, conversas e as últimas mensagens de cada uma (em páginas de 15 conversas) */
async function importar(pagina: number) {
  const sb = admin();
  let grupos = 0, conversas = 0, mensagens = 0;
  if (pagina === 0) {
    const g = await evo('/group/fetchAllGroups/' + I() + '?getParticipants=false', 'GET', undefined, 60000);
    if (g.ok && Array.isArray(g.dados)) for (const x of g.dados) { if (x?.id) { await garantirConversa(sb, x.id, null, x.subject || null, x.pictureUrl || null); grupos++; } }
  }
  const c = await evo('/chat/findChats/' + I(), 'POST', {}, 60000);
  const lista = (Array.isArray(c.dados) ? c.dados : [])
    .filter((x: any) => /@(g\.us|s\.whatsapp\.net)$/.test(x?.remoteJid || ''))
    .sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 90);
  const fatia = lista.slice(pagina * 15, pagina * 15 + 15);
  for (const ch of fatia) {
    await garantirConversa(sb, ch.remoteJid, ch.pushName || ch.name || null, null, ch.profilePicUrl || null);
    conversas++;
    const m = await evo('/chat/findMessages/' + I(), 'POST', { where: { key: { remoteJid: ch.remoteJid } }, page: 1, offset: 40 }, 30000);
    const recs = m.dados?.messages?.records || (Array.isArray(m.dados) ? m.dados : []);
    for (const r of [...recs].reverse()) { if (await gravar(sb, r, {}, { historico: true })) mensagens++; }
  }
  return { grupos, conversas, mensagens, proxima: (pagina + 1) * 15 < lista.length ? pagina + 1 : null, total: lista.length };
}

async function msgDe(id: string) {
  const { data } = await admin().from('wa_mensagens').select('*').eq('id', id).maybeSingle();
  return data;
}
async function citacao(citar: string | undefined) {
  if (!citar) return undefined;
  const q = await msgDe(citar);
  if (!q) return undefined;
  return { key: { remoteJid: q.jid, fromMe: q.de_mim, id: q.id, participant: q.autor_jid || undefined }, message: { conversation: q.texto || q.citada_previa || '' } };
}
/* grava o que o B7 enviou, com quem enviou (o eco do webhook pode chegar antes) */
async function registrarEnvio(dados: any, p: Perfil, extra: Record<string, unknown> = {}) {
  const sb = admin();
  if (!dados?.key?.id) return null;
  await gravar(sb, dados, { enviada_por: p.id, enviada_por_nome: p.nome, ...extra });
  await sb.from('wa_mensagens').update({ enviada_por: p.id, enviada_por_nome: p.nome, ...extra }).eq('id', dados.key.id);
  return dados.key.id;
}
async function urlAssinada(path: string, s = 900) {
  const { data } = await admin().storage.from('wa-midia').createSignedUrl(path, s);
  return data?.signedUrl || null;
}
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'application/pdf': 'pdf' };

async function baixarMidia(id: string) {
  const m = await msgDe(id);
  if (!m) return { erro: 'Mensagem não encontrada.' };
  if (m.midia_path) return { url: await urlAssinada(m.midia_path, 3600), mime: m.midia_mime };
  if (Number(m.midia_tamanho || 0) > 80 * 1024 * 1024) return { erro: 'Arquivo grande demais para abrir aqui (mais de 80 MB). Abra pelo celular.' };
  const r = await evo('/chat/getBase64FromMediaMessage/' + I(), 'POST', { message: { key: { id } }, convertToMp4: m.tipo === 'video' }, 120000);
  const b64 = r.dados?.base64;
  if (!r.ok || !b64) return { erro: 'O WhatsApp não liberou este arquivo (pode ter expirado).' };
  const mime = r.dados?.mimetype || m.midia_mime || 'application/octet-stream';
  const ext = EXT[String(mime).split(';')[0]] || (String(m.midia_nome || '').split('.').pop() || 'bin');
  const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const path = 'rec/' + m.jid.split('@')[0] + '/' + id + '.' + ext;
  const up = await admin().storage.from('wa-midia').upload(path, bin, { contentType: String(mime).split(';')[0], upsert: true });
  if (up.error) return { erro: 'Não consegui guardar o arquivo.' };
  await admin().from('wa_mensagens').update({ midia_path: path, midia_mime: mime }).eq('id', id);
  return { url: await urlAssinada(path, 3600), mime };
}

Deno.serve(comCors(async (req: Request) => {
  if (req.method === 'GET') {
    const d: Record<string, unknown> = { ok: true, versao: VERSAO, configurado: !!(BASE() && CHAVE()) };
    if (d.configurado) {
      try {
        const r = await evo('/instance/fetchInstances?instanceName=' + I());
        d.evolution = r.status === 401 ? 'chave recusada' : r.ok ? 'ok' : 'respondeu ' + r.status;
      } catch (_e) { d.evolution = 'sem resposta'; }
    }
    return json(d);
  }
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const p = await quemChamou(req);
  if (!p) return json({ erro: 'Entre no sistema de novo.' }, 401);
  let c: Record<string, any> = {};
  try { c = await req.json(); } catch (_e) { /* vazio */ }
  const acao = String(c.acao || 'estado');
  const soAdmin = ['estado', 'conectar', 'desconectar', 'importar'];
  if (soAdmin.includes(acao) ? !ehAdmin(p) : !(await podeVer(p))) return json({ erro: 'Sem permissão para o WhatsApp do B7.' }, 403);
  if (!BASE() || !CHAVE()) return json({ configurado: false, erro: 'O WhatsApp do B7 não está configurado.' });

  try {
    switch (acao) {
      case 'estado': return json(await estado());
      case 'conectar': {
        const numero = String(c.numero || '').replace(/\D/g, '');
        if (numero && (numero.length < 10 || numero.length > 15)) return json({ erro: 'Número inválido. Use DDI + DDD + número, ex.: 55 62 99999-0000.' });
        return json(await conectar(numero));
      }
      case 'desconectar': { const r = await evo('/instance/logout/' + I(), 'DELETE'); return json({ ok: r.ok }); }
      case 'importar': return json(await importar(Math.max(0, Number(c.pagina) || 0)));
      case 'enviar_texto': {
        const texto = String(c.texto || '').slice(0, 4000);
        if (!c.jid || !texto.trim()) return json({ erro: 'Escreva a mensagem.' });
        const r = await evo('/message/sendText/' + I(), 'POST', { number: c.jid, text: texto, quoted: await citacao(c.citar) }, 30000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou a mensagem (' + r.status + ').' });
        return json({ ok: true, id: await registrarEnvio(r.dados, p) });
      }
      case 'enviar_midia': {
        if (!c.jid || !c.path || !String(c.path).startsWith('envio/')) return json({ erro: 'Arquivo inválido.' });
        const url = await urlAssinada(String(c.path), 900);
        if (!url) return json({ erro: 'Não achei o arquivo enviado.' });
        const tipo = ['image', 'video', 'document'].includes(c.tipo) ? c.tipo : 'document';
        const r = await evo('/message/sendMedia/' + I(), 'POST', {
          number: c.jid, mediatype: tipo, mimetype: c.mime || undefined, caption: c.legenda || undefined,
          media: url, fileName: c.nome || undefined, quoted: await citacao(c.citar)
        }, 120000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou o arquivo (' + r.status + ').' });
        return json({ ok: true, id: await registrarEnvio(r.dados, p, { midia_path: c.path }) });
      }
      case 'enviar_audio': {
        if (!c.jid || !c.path || !String(c.path).startsWith('envio/')) return json({ erro: 'Áudio inválido.' });
        const url = await urlAssinada(String(c.path), 900);
        if (!url) return json({ erro: 'Não achei o áudio gravado.' });
        const r = await evo('/message/sendWhatsAppAudio/' + I(), 'POST', { number: c.jid, audio: url }, 120000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou o áudio (' + r.status + ').' });
        return json({ ok: true, id: await registrarEnvio(r.dados, p, { midia_path: c.path }) });
      }
      case 'reagir': {
        const m = await msgDe(String(c.id || ''));
        if (!m) return json({ erro: 'Mensagem não encontrada.' });
        const emoji = String(c.emoji || '').slice(0, 8);
        const r = await evo('/message/sendReaction/' + I(), 'POST', { key: { remoteJid: m.jid, fromMe: m.de_mim, id: m.id, participant: m.autor_jid || undefined }, reaction: emoji });
        if (!r.ok) return json({ erro: 'Não deu para reagir agora.' });
        const rs: Record<string, string[]> = m.reacoes || {};
        for (const k of Object.keys(rs)) { rs[k] = rs[k].filter(x => x !== 'eu'); if (!rs[k].length) delete rs[k]; }
        if (emoji) (rs[emoji] = rs[emoji] || []).push('eu');
        await admin().from('wa_mensagens').update({ reacoes: rs }).eq('id', m.id);
        return json({ ok: true });
      }
      case 'apagar': {
        const m = await msgDe(String(c.id || ''));
        if (!m || !m.de_mim) return json({ erro: 'Só dá para apagar mensagem enviada por nós.' });
        if (!m.nota) {
          const r = await evo('/chat/deleteMessageForEveryone/' + I(), 'DELETE', { id: m.id, remoteJid: m.jid, fromMe: true });
          if (!r.ok) return json({ erro: 'O WhatsApp não deixou apagar (passou do tempo?).' });
        }
        await admin().from('wa_mensagens').update({ apagada: true, texto: null }).eq('id', m.id);
        return json({ ok: true });
      }
      case 'lida': {
        const sb = admin();
        const { data: ult } = await sb.from('wa_mensagens').select('id, jid, autor_jid').eq('jid', c.jid).eq('de_mim', false).order('criada_em', { ascending: false }).limit(20);
        if (ult && ult.length) await evo('/chat/markMessageAsRead/' + I(), 'POST', { readMessages: ult.map((x: any) => ({ remoteJid: x.jid, fromMe: false, id: x.id })) }).catch(() => null);
        await sb.from('wa_conversas').update({ nao_lidas: 0 }).eq('jid', c.jid);
        return json({ ok: true });
      }
      case 'midia': return json(await baixarMidia(String(c.id || '')));
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? 'O WhatsApp demorou para responder.' : 'Não consegui falar com o WhatsApp do B7.';
    return json({ erro: msg }, 502);
  }
}));
