// =====================================================================
// WHATSAPP B7 — mais um CANAL de aviso (zzz83)
//
// Igual ao push: quem recebe, com que título e com que texto é decidido
// no banco (public.notificacoes). Aqui só se entrega — e só os avisos
// IMPORTANTES, só para a equipe interna, só para quem tem número
// cadastrado (public.perfil_contatos, que o navegador não lê).
//
// Serviço NÃO OFICIAL, escolhido pelos segredos (o primeiro conjunto
// completo vale). Nenhuma chave entra no código, no banco ou no navegador:
//
//   Z-API          ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
//   Evolution API  EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
//
// Opcional: B7_SITE_URL (endereço do app, para o link do aviso).
// Sem segredos, nada é enviado e nada quebra.
//
// Atenção: serviços não oficiais contrariam os termos do WhatsApp; o
// número conectado pode ser bloqueado. Use um número só para isso.
// O texto do aviso passa pelo serviço escolhido.
// =====================================================================

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type ProvedorWhats = { nome: 'zapi' | 'evolution'; enviar(numero: string, texto: string): Promise<{ ok: boolean; status: number | null }> };

const PRAZO_MS = 8000;
async function postar(url: string, cabecalhos: Record<string, string>, corpo: unknown): Promise<{ ok: boolean; status: number | null }> {
  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), PRAZO_MS);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo) });
    try { await r.body?.cancel(); } catch (_e) { /* resposta não interessa */ }
    return { ok: r.ok, status: r.status };
  } catch (_e) {
    return { ok: false, status: null };
  } finally { clearTimeout(relogio); }
}

export function provedorWhats(env: (n: string) => string | undefined): ProvedorWhats | null {
  const zi = (env('ZAPI_INSTANCE_ID') || '').trim(), zt = (env('ZAPI_TOKEN') || '').trim(), zc = (env('ZAPI_CLIENT_TOKEN') || '').trim();
  if (zi && zt && zc) {
    return { nome: 'zapi', enviar: (numero, texto) => postar(
      'https://api.z-api.io/instances/' + encodeURIComponent(zi) + '/token/' + encodeURIComponent(zt) + '/send-text',
      { 'Client-Token': zc }, { phone: numero, message: texto }) };
  }
  const eu = (env('EVOLUTION_URL') || '').trim().replace(/\/+$/, ''), ek = (env('EVOLUTION_API_KEY') || '').trim(), ei = (env('EVOLUTION_INSTANCE') || '').trim();
  if (/^https:\/\//i.test(eu) && ek && ei) {
    return { nome: 'evolution', enviar: (numero, texto) => postar(
      eu + '/message/sendText/' + encodeURIComponent(ei), { apikey: ek }, { number: numero, text: texto }) };
  }
  return null;
}

/* O que vale um WhatsApp. O resto continua só no sino e no push.
   (decisão do Kevin, 07/10/2026: "só os importantes") */
const IMPORTANTE = [
  /\.atribuida$/,                                   // trabalho passou a ser meu
  /\.prazo_amanha$/, /\.atrasado(_critico|_escalado)?$/,   // prazo vencendo ou vencido
  /^video\.correcao_solicitada$/, /^design\.ajuste_solicitado$/, /^(aprovacao|parte)\.ajustes$/,   // correção pedida
  /^video\.aprovado_cliente$/, /^design\.cliente_(aprovado|recusado|ajustes)$/, /^aprovacao\.(aprovada|recusada)$/,   // decisão do cliente
  /^gravacao\.(remarcada|cancelada)$/, /^agenda\.gravacao_(24h|1h)$/   // gravação
];
export const ehImportante = (tipo: string) => IMPORTANTE.some(r => r.test(tipo || ''));

const SITE = (env: (n: string) => string | undefined) => ((env('B7_SITE_URL') || 'https://branding7dados-lab.github.io/sistema-b7/').trim().replace(/\/+$/, '') + '/');
const limpo = (v: unknown, n: number) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export function montarTexto(n: { titulo?: string | null; mensagem?: string | null; link?: string | null }, cliente: string | null, site: string): string {
  const link = typeof n.link === 'string' && /^#\/[\w\-/?=&.%]*$/.test(n.link) ? n.link : '#/';
  const corpo = [cliente, limpo(n.mensagem, 500)].filter(Boolean).join(' · ');
  return '*' + limpo(n.titulo || 'Sistema B7', 120).replace(/\*/g, '') + '*' + (corpo ? '\n' + corpo : '') + '\n\n' + site + link;
}

export async function numeroDe(sb: SupabaseClient, perfilId: string): Promise<string | null> {
  const { data } = await sb.from('perfil_contatos').select('whatsapp').eq('perfil_id', perfilId).maybeSingle();
  const num = data && typeof data.whatsapp === 'string' ? data.whatsapp : '';
  return /^\d{10,15}$/.test(num) ? num : null;
}

type Notif = { id: string; destinatario_id: string; tipo?: string | null; titulo?: string | null; mensagem?: string | null; link?: string | null; client_id?: string | null };

/** Entrega (ou não) uma notificação por WhatsApp. Nunca lança. */
export async function entregarWhats(sb: SupabaseClient, n: Notif, perfil: { papel?: string | null; estado?: string | null },
                                    env: (nome: string) => string | undefined): Promise<string> {
  let status = 'erro';
  try {
    const prov = provedorWhats(env);
    if (!prov) return 'nao_configurado';                 /* sem serviço: nem registra */
    if (!ehImportante(n.tipo || '')) return 'fora_da_lista';
    if (perfil.estado !== 'ativa' || perfil.papel === 'cliente') return 'fora_da_equipe';
    const numero = await numeroDe(sb, n.destinatario_id);
    if (!numero) status = 'sem_numero';
    else {
      let cliente: string | null = null;
      if (n.client_id) {
        const { data: c } = await sb.from('clientes').select('nome').eq('id', n.client_id).maybeSingle();
        cliente = c && c.nome ? limpo(c.nome, 60) : null;
      }
      const r = await prov.enviar(numero, montarTexto(n, cliente, SITE(env)));
      status = r.ok ? 'enviado' : 'falha' + (r.status ? '_' + r.status : '');
      /* nunca o número nem o texto no registro */
      console.log(JSON.stringify({ b7whats: status, servico: prov.nome, tipo: n.tipo || null }));
    }
    await sb.from('notificacoes').update({ whatsapp_status: status, whatsapp_em: new Date().toISOString() }).eq('id', n.id);
  } catch (_e) { /* canal extra: falha aqui não derruba o push */ }
  return status;
}
