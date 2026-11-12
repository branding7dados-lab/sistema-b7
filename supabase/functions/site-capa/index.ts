// =====================================================================
// site-capa (4.39.0) — puxa a capa dos vídeos do site que são link.
// Instagram: /p/<código>/media/?size=l redireciona para a imagem da capa
// (1080×1920 nos Reels). YouTube: img.youtube.com/vi/<id>/(maxres|hq)default.
// A imagem é guardada no bucket "site" (o endereço do Instagram expira) e
// vira o capa_url do item. Só administrador (confere sou_admin no banco).
//   POST { id }            um item
//   POST { todos: true }   todos os vídeos/depoimentos de link sem capa
//   POST { ..., refazer: true }  troca mesmo se já tiver capa
// Sem login (o site chama ao ver vídeo de link sem capa): só { todos } —
// completa o que falta; escolher item ou refazer é só do administrador.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
/* CORS: o mesmo critério de _shared/cors.ts (só o sistema e o site) */
const ORIGENS = ['https://sistema.branding7.com.br', 'https://branding7.com.br', 'https://www.branding7.com.br', 'https://branding7dados-lab.github.io']
  .concat((Deno.env.get('B7_ORIGENS') || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean));
function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  const ok = ORIGENS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return { 'Access-Control-Allow-Origin': ok ? o : ORIGENS[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

function alvo(u: string): { tipo: string; cod: string; urls: string[] } | null {
  const ig = u.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([\w-]+)/i);
  if (ig) return { tipo: 'ig', cod: ig[1], urls: [`https://www.instagram.com/p/${ig[1]}/media/?size=l`] };
  const yt = u.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  if (yt) return { tipo: 'yt', cod: yt[1], urls: [`https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`, `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`] };
  return null;
}

Deno.serve(async req => {
  const H = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: H });
  const resp = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const eu = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: 'Bearer ' + jwt } }, auth: { persistSession: false } });
    const adm = jwt ? await eu.rpc('sou_admin') : { data: false, error: null };
    const souAdm = !adm.error && adm.data === true;
    const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    let p = await req.json().catch(() => ({}));
    /* visitante do site (sem login): só completa as capas que faltam, sem
       escolher item nem refazer — o próprio site se conserta sozinho */
    if (!souAdm) p = { todos: true };
    let q = sb.from('site_itens').select('id, video_url, capa_url').in('tipo', ['video', 'depoimento']).not('video_url', 'is', null);
    if (p.id) q = q.eq('id', String(p.id));
    else if (!p.refazer) q = q.is('capa_url', null);
    const { data: itens, error } = await q.limit(60);
    if (error) return resp({ erro: 'Falha ao ler os vídeos.' }, 500);

    const feitos: unknown[] = [];
    for (const it of itens || []) {
      if (it.capa_url && !p.refazer && !p.id) continue;
      const a = alvo(String(it.video_url || ''));
      if (!a) { feitos.push({ id: it.id, ok: false, motivo: 'link sem capa automática' }); continue; }
      let bytes: Uint8Array | null = null, tipo = 'image/jpeg';
      for (const u of a.urls) {
        const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/*,*/*' }, redirect: 'follow' }).catch(() => null);
        if (!r || !r.ok) continue;
        const ct = r.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) continue;
        const b = new Uint8Array(await r.arrayBuffer());
        if (b.length < 3000) continue;              /* imagem vazia/placeholder */
        bytes = b; tipo = ct.split(';')[0]; break;
      }
      if (!bytes) { feitos.push({ id: it.id, ok: false, motivo: 'o ' + (a.tipo === 'ig' ? 'Instagram' : 'YouTube') + ' não entregou a capa (post privado ou removido?)' }); continue; }
      const ext = tipo.includes('webp') ? 'webp' : tipo.includes('png') ? 'png' : 'jpg';
      const caminho = `capas/${a.tipo}-${a.cod}.${ext}`;
      const up = await sb.storage.from('site').upload(caminho, bytes, { contentType: tipo, upsert: true, cacheControl: '31536000' });
      if (up.error) { feitos.push({ id: it.id, ok: false, motivo: 'falha ao guardar a imagem' }); continue; }
      const pub = sb.storage.from('site').getPublicUrl(caminho).data.publicUrl + '?v=' + Date.now().toString(36);
      await sb.from('site_itens').update({ capa_url: pub, updated_at: new Date().toISOString() }).eq('id', it.id);
      feitos.push({ id: it.id, ok: true, capa_url: pub });
    }
    return resp({ feitos });
  } catch (e) {
    return resp({ erro: 'Falha inesperada.' }, 500);
  }
});
