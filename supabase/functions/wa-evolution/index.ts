// =====================================================================
// WA-EVOLUTION — o B7 conversando com o Evolution API (WhatsApp, piloto)
//
// O Evolution roda no Pterodactyl (servidor/evolution/pterodactyl). Esta
// função é o ÚNICO caminho entre o B7 e ele: a chave do Evolution fica só
// nos secrets daqui, nunca no navegador nem no Git.
//
// Secrets:
//   EVOLUTION_URL        ex.: http://node.skyrixs.com:25570 (sem barra no fim)
//   EVOLUTION_API_KEY    o conteúdo de .b7-chave no servidor
//   EVOLUTION_INSTANCE   (opcional) nome da conexão; padrão "b7-piloto"
//
// Ações (POST { acao }), só administrador nesta etapa:
//   estado        → { configurado, existe, estado: 'open'|'connecting'|'close'|..., numero? }
//   conectar      → cria a conexão se não existir e devolve o QR Code { qr (data:image/png;base64), codigo? }
//                   { numero } → devolve também o código de 8 letras para "Conectar com número de telefone"
//   desconectar   → desliga o número (logout); a conexão continua criada
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { comCors } from '../_shared/cors.ts';

const VERSAO = 'wa-evolution 2 (4.50.1)';
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Perfil = { id: string; papel: string; estado: string; eh_admin?: boolean };
async function quemChamou(req: Request): Promise<Perfil | null> {
  const cab = req.headers.get('authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await sb.from('perfis').select('id, papel, estado, eh_admin').eq('id', data.user.id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa') return null;
  return perfil as Perfil;
}
const ehAdmin = (p: Perfil | null) => !!p && (p.papel === 'admin' || p.eh_admin === true);

const BASE = () => (Deno.env.get('EVOLUTION_URL') || '').replace(/\/+$/, '');
const CHAVE = () => Deno.env.get('EVOLUTION_API_KEY') || '';
const INST = () => Deno.env.get('EVOLUTION_INSTANCE') || 'b7-piloto';

async function evo(caminho: string, metodo = 'GET', corpo?: unknown): Promise<{ ok: boolean; status: number; dados: any }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
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

/* o Evolution devolve o QR com ou sem o prefixo data: */
const comPrefixo = (b: string) => !b ? '' : b.startsWith('data:') ? b : 'data:image/png;base64,' + b;

async function estado() {
  if (!BASE() || !CHAVE()) return { configurado: false };
  const r = await evo('/instance/connectionState/' + encodeURIComponent(INST()));
  if (r.status === 404) return { configurado: true, existe: false, estado: 'sem_conexao' };
  if (r.status === 401) return { configurado: true, erro: 'O Evolution recusou a chave (EVOLUTION_API_KEY diferente da .b7-chave).' };
  if (!r.ok) return { configurado: true, erro: 'O Evolution respondeu ' + r.status + '.' };
  const st = r.dados?.instance?.state || r.dados?.state || 'desconhecido';
  let numero: string | null = null;
  if (st === 'open') {
    const l = await evo('/instance/fetchInstances?instanceName=' + encodeURIComponent(INST()));
    const i = Array.isArray(l.dados) ? l.dados[0] : null;
    numero = (i?.ownerJid || i?.owner || '').split('@')[0] || null;
  }
  return { configurado: true, existe: true, estado: st, numero, instancia: INST() };
}

/* numero (só dígitos, com DDI, ex.: 5562999990000) = conectar pelo código de 8 letras
   ("Conectar com número de telefone" no celular), em vez do QR Code */
async function conectar(numero: string) {
  if (!BASE() || !CHAVE()) return { configurado: false };
  const q = numero ? '?number=' + numero : '';
  let r = await evo('/instance/connect/' + encodeURIComponent(INST()) + q);
  if (r.status === 404) {
    r = await evo('/instance/create', 'POST', Object.assign({ instanceName: INST(), integration: 'WHATSAPP-BAILEYS', qrcode: true }, numero ? { number: numero } : {}));
    if (!r.ok) return { erro: 'Não consegui criar a conexão no Evolution (' + r.status + ').' };
    const q = r.dados?.qrcode || {};
    return { qr: comPrefixo(q.base64 || ''), codigo: q.pairingCode || null };
  }
  if (!r.ok) return { erro: 'O Evolution respondeu ' + r.status + '.' };
  if (r.dados?.instance?.state === 'open') return { conectado: true };
  return { qr: comPrefixo(r.dados?.base64 || ''), codigo: r.dados?.pairingCode || null };
}

Deno.serve(comCors(async (req: Request) => {
  /* diagnóstico sem dado sensível: os segredos existem? o Evolution responde? a chave vale? */
  if (req.method === 'GET') {
    const d: Record<string, unknown> = { ok: true, versao: VERSAO, configurado: !!(BASE() && CHAVE()) };
    if (d.configurado) {
      try {
        const r = await evo('/instance/fetchInstances?instanceName=' + encodeURIComponent(INST()));
        d.evolution = r.status === 401 ? 'chave recusada' : r.ok ? 'ok' : 'respondeu ' + r.status;
      } catch (_e) { d.evolution = 'sem resposta'; }
    }
    return json(d);
  }
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const p = await quemChamou(req);
  if (!p) return json({ erro: 'Entre no sistema de novo.' }, 401);
  if (!ehAdmin(p)) return json({ erro: 'Só administrador mexe na conexão do WhatsApp (piloto).' }, 403);
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { /* vazio */ }
  const acao = String(corpo.acao || 'estado');
  try {
    if (acao === 'estado') return json(await estado());
    if (acao === 'conectar') {
      const numero = String(corpo.numero || '').replace(/\D/g, '');
      if (numero && (numero.length < 10 || numero.length > 15)) return json({ erro: 'Número inválido. Use DDI + DDD + número, ex.: 55 62 99999-0000.' });
      return json(await conectar(numero));
    }
    if (acao === 'desconectar') {
      const r = await evo('/instance/logout/' + encodeURIComponent(INST()), 'DELETE');
      return json({ ok: r.ok });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? 'O Evolution demorou para responder.' : 'Não consegui falar com o Evolution.';
    return json({ erro: msg }, 502);
  }
}));
