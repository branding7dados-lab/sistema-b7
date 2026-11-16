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
export async function tokenDrive(sb: SupabaseClient): Promise<string | null> {
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
  const d = await r.json();
  if (!r.ok || !d.id) throw new Error('Drive: não criou a pasta (' + r.status + ')');
  return d.id;
}

/** id da pasta (cria e guarda em wa_drive_pastas na primeira vez) */
async function pasta(sb: SupabaseClient, tk: string, chave: string, nome: string, pai: string | null): Promise<string> {
  const { data } = await sb.from('wa_drive_pastas').select('drive_id').eq('chave', chave).maybeSingle();
  if (data?.drive_id) return data.drive_id;
  const id = await criarPasta(tk, nome, pai);
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
