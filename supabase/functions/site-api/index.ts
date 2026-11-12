// =====================================================================
// site-api (4.37.0) — números do site branding7.com.br para outras
// ferramentas (ex.: a IA comercial do Gabriel). Só leitura.
//
// Autenticação: chave gerada no Sistema B7 → Site → Métricas → API.
//   Authorization: Bearer b7site_...      (ou cabeçalho x-api-key)
// Só o resumo SHA-256 da chave fica no banco (site_api_chaves).
//
// GET /functions/v1/site-api?recurso=metricas&dias=30
//   recurso: metricas (funil, origens, campanhas, por dia, dispositivos)
//            leads    (contatos do formulário; ?status=novo opcional)
//            tudo     (os dois)
//   dias: 1 a 365 (padrão 30)
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const H = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store'
};
const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: H });

async function sha256(t: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: H });
  if (req.method !== 'GET' && req.method !== 'POST') return resp({ erro: 'Use GET.' }, 405);

  const chave = (req.headers.get('x-api-key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')).trim();
  if (!/^b7site_[0-9a-f]{48}$/.test(chave)) return resp({ erro: 'Chave ausente ou inválida.' }, 401);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ok = await sb.rpc('_site_api_conferir', { p_resumo: await sha256(chave) });
  if (ok.error) return resp({ erro: 'Falha ao conferir a chave.' }, 500);
  if (!ok.data) return resp({ erro: 'Chave inválida ou revogada.' }, 401);

  const url = new URL(req.url);
  let p: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') { try { p = { ...p, ...(await req.json()) }; } catch (_) { /* corpo vazio */ } }
  const recurso = String(p.recurso || 'tudo');
  const dias = Math.min(365, Math.max(1, parseInt(String(p.dias || '30'), 10) || 30));
  const saida: Record<string, unknown> = { fonte: 'branding7.com.br', dias };

  if (recurso === 'metricas' || recurso === 'tudo') {
    const m = await sb.rpc('_site_metricas', { p_dias: dias });
    if (m.error) return resp({ erro: 'Falha ao ler as métricas.' }, 500);
    saida.metricas = m.data;
  }
  if (recurso === 'leads' || recurso === 'tudo') {
    let q = sb.from('site_leads')
      .select('id, created_at, nome, whatsapp, empresa, cidade, interesse, mensagem, origem, status, notas, atualizado_em')
      .gte('created_at', new Date(Date.now() - dias * 864e5).toISOString())
      .order('created_at', { ascending: false }).limit(500);
    if (p.status) q = q.eq('status', String(p.status));
    const l = await q;
    if (l.error) return resp({ erro: 'Falha ao ler os contatos.' }, 500);
    saida.leads = l.data;
  }
  if (!('metricas' in saida) && !('leads' in saida)) return resp({ erro: 'recurso deve ser metricas, leads ou tudo.' }, 400);
  return resp(saida);
});
