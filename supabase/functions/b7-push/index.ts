// =====================================================================
// PUSH B7 — envia Web Push quando nasce uma notificação
//
// Quem chama: um Database Webhook do Supabase, em INSERT na tabela
// public.notificacoes. O corpo que chega é o padrão do webhook:
//   { type: 'INSERT', table: 'notificacoes', schema: 'public',
//     record: { id, destinatario_id, titulo, mensagem, link, ... } }
//
// O que faz: lê as inscrições (push_subscricoes) do destinatário com a
// service role, respeita perfis.preferencias.push e manda o push com a
// chave PRIVADA VAPID que só existe aqui, como secret. Inscrições que o
// navegador já descartou (404/410) são apagadas.
//
// Segredos (supabase secrets set ...):
//   VAPID_PUBLIC_KEY    a mesma chave pública de js/config.js
//   VAPID_PRIVATE_KEY   NUNCA vai para o frontend nem para o banco
//   VAPID_SUBJECT       mailto:contato@branding7.com.br (ou a URL do site)
//   B7_WEBHOOK_SECRET   (recomendado) o webhook manda este valor no header
//                       x-b7-webhook-secret; sem ele, a função recusa.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm da plataforma.
//
// Deploy:  supabase functions deploy b7-push --no-verify-jwt
// (o webhook não carrega JWT de usuário; a proteção é o segredo acima)
// Ver PUSH.md para o passo a passo.
// =====================================================================

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERSAO = '2026-09-09-j';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-b7-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

type Notificacao = {
  id: string; destinatario_id: string; titulo: string;
  mensagem?: string | null; link?: string | null; tipo?: string | null;
};
type Inscricao = { id: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);

  /* ---- segredo do webhook ---- */
  const segredo = Deno.env.get('B7_WEBHOOK_SECRET') || '';
  if (segredo) {
    const recebido = req.headers.get('x-b7-webhook-secret') || '';
    if (recebido !== segredo) return json({ erro: 'Segredo do webhook inválido.' }, 401);
  } else {
    console.warn('b7-push: B7_WEBHOOK_SECRET não configurado — qualquer chamada é aceita.');
  }

  /* ---- chaves VAPID ---- */
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@branding7.com.br';
  if (!pub || !priv) {
    return json({ erro: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configuradas nos secrets.', versao: VERSAO }, 500);
  }
  webpush.setVapidDetails(subject, pub, priv);

  /* ---- corpo do webhook ---- */
  let corpo: { type?: string; table?: string; record?: Notificacao } = {};
  try { corpo = await req.json(); } catch (_e) { return json({ erro: 'Corpo inválido.' }, 400); }
  if (corpo.type && corpo.type !== 'INSERT') return json({ ok: true, ignorado: corpo.type, versao: VERSAO });
  if (corpo.table && corpo.table !== 'notificacoes') return json({ ok: true, ignorado: corpo.table, versao: VERSAO });
  const n = corpo.record;
  if (!n || !n.id || !n.destinatario_id) return json({ erro: 'record.destinatario_id ausente.' }, 400);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  /* ---- preferência da pessoa: push desligado = nada enviado ---- */
  const { data: perfil } = await sb.from('perfis')
    .select('id, estado, preferencias').eq('id', n.destinatario_id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa') return json({ ok: true, enviados: 0, motivo: 'perfil inativo', versao: VERSAO });
  const prefs = (perfil.preferencias && typeof perfil.preferencias === 'object') ? perfil.preferencias as Record<string, unknown> : {};
  if (prefs.push === false) return json({ ok: true, enviados: 0, motivo: 'push desligado nas preferências', versao: VERSAO });

  /* ---- inscrições ---- */
  const { data: inscricoes, error } = await sb.from('push_subscricoes')
    .select('id, endpoint, p256dh, auth').eq('perfil_id', n.destinatario_id);
  if (error) return json({ erro: 'Não foi possível ler push_subscricoes: ' + error.message }, 500);
  const lista = (inscricoes || []) as Inscricao[];
  if (!lista.length) return json({ ok: true, enviados: 0, motivo: 'sem inscrições', versao: VERSAO });

  const payload = JSON.stringify({
    id: n.id, titulo: n.titulo || 'Sistema B7',
    mensagem: n.mensagem || '', link: n.link || '#/', tipo: n.tipo || null
  });

  let enviados = 0, removidos = 0;
  const falhas: string[] = [];
  await Promise.all(lista.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload, { TTL: 60 * 60 * 24, urgency: 'normal' }
      );
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode || 0;
      if (status === 404 || status === 410) {
        /* o navegador cancelou a inscrição: não insistir */
        await sb.from('push_subscricoes').delete().eq('id', s.id);
        removidos++;
      } else {
        falhas.push(status + ' ' + ((e as Error).message || ''));
      }
    }
  }));

  return json({ ok: true, enviados, removidos, falhas, versao: VERSAO });
});
