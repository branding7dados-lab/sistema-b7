// =====================================================================
// Google Drive da agência — onde ficam os arquivos do WhatsApp do B7 (4.53.0)
// A conexão (refresh_token) é feita pela google-agenda e fica em
// drive_conexoes, que só a service role lê. Escopo drive.file: o B7 só
// enxerga o que ele mesmo criou.
// Pastas: "B7 · WhatsApp" / <conversa> / <AAAA-MM>
// =====================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CID = () => Deno.env.get('GOOGLE_CLIENT_ID') || '';
const CSEC = () => Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const API = 'https://www.googleapis.com/drive/v3';
const RAIZ = 'B7 · WhatsApp';

/** token de acesso válido, ou null se o Drive não estiver conectado */
/* 4.58.4: se o Google recusou (401/403), para de tentar por 15 min.
   Antes cada arquivo aberto tentava o Drive de novo e a tela ficava lenta. */
let pausaAte = 0;
export async function tokenDrive(sb: SupabaseClient): Promise<string | null> {
  if (Date.now() < pausaAte) return null;
  const { data: c } = await sb.from('drive_conexoes').select('*').eq('status', 'ativa').order('conectado_em', { ascending: false }).limit(1).maybeSingle();
  if (!c) return null;
  const expira = c.token_expira_em ? new Date(c.token_expira_em).getTime() : 0;
  if (c.access_token && expira - Date.now() > 60_000) return c.access_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID(), client_secret: CSEC(), refresh_token: c.refresh_token, grant_type: 'refresh_token' })
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) {
    await sb.from('drive_conexoes').update({ status: 'erro', ultimo_erro: t.error_description || t.error || 'falha ao renovar' }).eq('id', c.id);
    return null;
  }
  await sb.from('drive_conexoes').update({ access_token: t.access_token, token_expira_em: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(), ultimo_erro: null }).eq('id', c.id);
  return t.access_token;
}

const limpar = (s: string) => String(s || 'sem nome').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 100) || 'sem nome';

async function criarPasta(tk: string, nome: string, pai: string | null): Promise<string> {
  const r = await fetch(API + '/files?fields=id', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', ...(pai ? { parents: [pai] } : {}) })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) {
    const motivo = d?.error?.errors?.[0]?.reason || d?.error?.status || '';
    const msg = String(d?.error?.message || '').slice(0, 300);
    if (r.status === 401 || r.status === 403) pausaAte = Date.now() + 15 * 60_000;
    throw new Error('Drive: não criou a pasta (' + r.status + (motivo ? ' ' + motivo : '') + ')' + (msg ? ' — ' + msg : ''));
  }
  return d.id;
}

/** id da pasta (cria e guarda em wa_drive_pastas na primeira vez) */
async function pasta(sb: SupabaseClient, tk: string, chave: string, nome: string, pai: string | null): Promise<string> {
  const { data } = await sb.from('wa_drive_pastas').select('drive_id').eq('chave', chave).maybeSingle();
  if (data?.drive_id) return data.drive_id;
  let id: string;
  try { id = await criarPasta(tk, nome, pai); }
  catch (e) {
    /* guarda o motivo pra tela de conexão mostrar (sem derrubar a conexão) */
    await sb.from('drive_conexoes').update({ ultimo_erro: String((e as Error).message).slice(0, 400) }).eq('status', 'ativa');
    throw e;
  }
  await sb.from('wa_drive_pastas').upsert({ chave, drive_id: id });
  return id;
}

export async function pastaDaConversa(sb: SupabaseClient, tk: string, jid: string, nomeConversa: string, quando: string): Promise<string> {
  const raiz = await pasta(sb, tk, 'raiz', RAIZ, null);
  const conv = await pasta(sb, tk, 'c:' + jid, limpar(nomeConversa), raiz);
  const mes = String(quando || new Date().toISOString()).slice(0, 7);
  return pasta(sb, tk, 'c:' + jid + ':' + mes, mes, conv);
}

/** sobe o arquivo (envio "resumable", aguenta vídeo grande) e devolve o id no Drive */
export async function subir(tk: string, pastaId: string, nome: string, mime: string, dados: Uint8Array): Promise<string> {
  const ini = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(dados.byteLength) },
    body: JSON.stringify({ name: limpar(nome), parents: [pastaId] })
  });
  const onde = ini.headers.get('location');
  if (!ini.ok || !onde) throw new Error('Drive: não iniciou o envio (' + ini.status + ')');
  const up = await fetch(onde, { method: 'PUT', headers: { 'Content-Type': mime }, body: dados });
  const d = await up.json().catch(() => ({}));
  if (!up.ok || !d.id) throw new Error('Drive: envio falhou (' + up.status + ')');
  return d.id;
}

/** lê o arquivo do Drive (repassa Range, para vídeo/áudio andarem) */
export async function ler(tk: string, id: string, range?: string | null): Promise<Response> {
  return fetch(API + '/files/' + encodeURIComponent(id) + '?alt=media', { headers: { Authorization: 'Bearer ' + tk, ...(range ? { Range: range } : {}) } });
}

/* ---------- link curto e assinado para a tela abrir o arquivo (img/video/audio não mandam cabeçalho) */
async function chaveHmac() {
  const seg = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return crypto.subtle.importKey('raw', new TextEncoder().encode(seg + ':b7-drive'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export async function assinar(id: string, exp: number) {
  return hex(await crypto.subtle.sign('HMAC', await chaveHmac(), new TextEncoder().encode(id + '.' + exp))).slice(0, 40);
}
export async function linkAssinado(id: string, segundos = 6 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + segundos;
  return Deno.env.get('SUPABASE_URL') + '/functions/v1/wa-evolution?m=' + encodeURIComponent(id) + '&e=' + exp + '&s=' + await assinar(id, exp);
}

export const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'application/pdf': 'pdf' };

/* 4.53.0: com o Google Drive conectado, os arquivos vão para lá ("B7 · WhatsApp"/conversa/mês)
   e saem do Storage do Supabase; a tela abre por um link assinado desta função. */
export async function midiaParaDrive(sb: SupabaseClient, m: any, dados?: { bin: Uint8Array; mime: string }): Promise<string | null> {
  const tk = await tokenDrive(sb);
  if (!tk) return null;
  let bin = dados?.bin, mime = dados?.mime || m.midia_mime || 'application/octet-stream';
  if (!bin && m.midia_path) {
    const d = await sb.storage.from('wa-midia').download(m.midia_path);
    if (d.error || !d.data) return null;
    bin = new Uint8Array(await d.data.arrayBuffer()); mime = m.midia_mime || d.data.type || mime;
  }
  if (!bin) return null;
  const { data: conv } = await sb.from('wa_conversas').select('nome').eq('jid', m.jid).maybeSingle();
  const pasta = await pastaDaConversa(sb, tk, m.jid, conv?.nome || String(m.jid).split('@')[0], m.criada_em);
  const ext = EXT[String(mime).split(';')[0]] || (String(m.midia_nome || '').includes('.') ? String(m.midia_nome).split('.').pop() : 'bin');
  const quando = String(m.criada_em || new Date().toISOString()).slice(0, 16).replace('T', ' ').replace(':', 'h');
  const base = m.midia_nome ? String(m.midia_nome) : ({ imagem: 'foto', video: 'video', audio: 'audio', figurinha: 'figurinha' } as Record<string, string>)[m.tipo] || 'arquivo';
  const nome = quando + ' · ' + (m.de_mim ? (m.enviada_por_nome || 'B7') : (m.autor_nome || 'contato')) + ' · ' + base + (/\.[a-z0-9]{2,5}$/i.test(base) ? '' : '.' + ext);
  const driveId = await subir(tk, pasta, nome, String(mime).split(';')[0], bin);
  await sb.from('wa_mensagens').update({ drive_id: driveId, midia_mime: mime, midia_path: null }).eq('id', m.id);
  if (m.midia_path) await sb.storage.from('wa-midia').remove([m.midia_path]);
  return driveId;
}

/** 4.80.6: arquivos que ficaram no armazenamento do sistema (Drive desconectado na época, ou abertos antes de existir
 *  o Drive) vão para o Drive aos poucos — o relógio do Otto chama a cada 5 min. Sem Drive conectado, não faz nada. */
export async function levarAntigosProDrive(sb: SupabaseClient, max = 15): Promise<number> {
  if (!(await tokenDrive(sb))) return 0;
  const { data } = await sb.from('wa_mensagens').select('id, jid, tipo, de_mim, autor_nome, enviada_por_nome, midia_path, midia_mime, midia_nome, criada_em')
    .not('midia_path', 'is', null).is('drive_id', null).order('criada_em', { ascending: false }).limit(max);
  let n = 0;
  for (const m of (data || []) as any[]) {
    try {
      if (await midiaParaDrive(sb, m)) { n++; continue; }
      if (!(await tokenDrive(sb))) break;   /* o Drive caiu no meio: tenta na próxima rodada */
      /* o arquivo não está mais no armazenamento: solta a referência (ao abrir, o B7 busca de novo no WhatsApp) */
      await sb.from('wa_mensagens').update({ midia_path: null }).eq('id', m.id).eq('midia_path', m.midia_path);
    } catch (e) { console.log('drive antigos', String(e)); break; }
  }
  return n;
}
