// =====================================================================
// PUSH B7 — entrega por Web Push o que já foi decidido no banco
//
// O push é só um CANAL. Quem recebe, com que título e com que texto é
// decidido no banco (notif_entregar → public.notificacoes); esta função
// não escolhe destinatário nenhum.
//
// Dois jeitos de ser chamada:
//
// 1. Database Webhook (INSERT em public.notificacoes), corpo padrão:
//      { type: 'INSERT', table: 'notificacoes', schema: 'public',
//        record: { id, destinatario_id, tipo, titulo, mensagem, link,
//                  client_id, dados } }
//    Protegida pelo header x-b7-webhook-secret.
//    Lê as inscrições do destinatário, respeita perfis.preferencias.push
//    e dados.silenciosa (preferência daquele tipo de aviso desligada), e
//    monta o aviso: logo do cliente como ícone, ações que só navegam e,
//    quando a notificação é de uma peça de Design, a prévia REAL da peça
//    (URL assinada, o bucket continua privado).
//
// 2. Teste pedido pela própria pessoa, em Meu perfil → Notificações:
//      { teste: true, endpoint: '<endpoint deste navegador>' }
//    Autenticada pelo JWT da sessão (Authorization: Bearer …). Manda um
//    push de verdade só para aquele aparelho e NÃO grava notificação: o
//    teste não vira pendência, não conta como não lida e não escala.
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
// (o webhook não carrega JWT de usuário; o teste confere o JWT aqui dentro)
// Ver PUSH.md para o passo a passo.
// =====================================================================

import webpush from 'npm:web-push@3.6.7';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const VERSAO = '2026-10-01-v';

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
  client_id?: string | null; dados?: Record<string, unknown> | null;
};
type Inscricao = { id: string; endpoint: string; p256dh: string; auth: string };
type Acao = { id: string; rotulo: string; link: string };

/* Ações do aviso: só navegam. Nada de aprovar, concluir ou cancelar
   pela tela de bloqueio — qualquer mudança de estado acontece dentro do
   B7, com a pessoa autenticada. */
function acoesDe(tipo: string, link: string): Acao[] {
  const abrir = (rotulo: string): Acao => ({ id: 'abrir', rotulo, link });
  if (link.startsWith('#/gravacao/') && !link.includes('roteiro=')) {
    return [abrir('Abrir gravação'), { id: 'roteiros', rotulo: 'Ver roteiros', link: link.split('?')[0] + '/roteiros' }];
  }
  if (tipo.startsWith('roteiro.')) return [abrir('Abrir roteiro')];
  if (tipo.startsWith('video.')) return [abrir('Abrir demanda')];
  if (link.startsWith('#/linha/')) return [abrir('Abrir linha editorial')];
  if (tipo.startsWith('design.') || tipo.startsWith('linha.')) {
    return [abrir(link.startsWith('#/design/linha/') ? 'Abrir demanda' : 'Abrir peça')];
  }
  if (tipo.startsWith('aprovacao.') || tipo.startsWith('parte.')) return [abrir('Abrir aprovação')];
  if (tipo === 'resumo.diario') return [abrir('Abrir B7'), { id: 'calendario', rotulo: 'Abrir calendário', link: '#/calendario' }];
  if (tipo.startsWith('agenda.')) return [abrir('Abrir calendário')];
  return [abrir('Abrir B7')];
}

/* Envia um payload para uma lista de inscrições. Inscrição que o
   navegador já descartou (404/410) é apagada: não adianta insistir. */
async function enviar(sb: SupabaseClient, lista: Inscricao[], payload: string, ttl: number) {
  let enviados = 0, removidos = 0;
  const falhas: string[] = [];
  await Promise.all(lista.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload, { TTL: ttl, urgency: 'normal' }
      );
      enviados++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode || 0;
      if (status === 404 || status === 410) {
        await sb.from('push_subscricoes').delete().eq('id', s.id);
        removidos++;
      } else {
        falhas.push(String(status || 'erro'));
      }
    }
  }));
  return { enviados, removidos, falhas };
}

/* Diagnóstico gravado na própria notificação (colunas push_*), para dar
   pra responder "por que não chegou?" sem abrir o log da função. Só o
   resultado — nunca o texto do aviso, nunca chave. */
async function registrar(sb: SupabaseClient, id: string, status: string, info: Record<string, unknown> = {}) {
  try {
    await sb.from('notificacoes')
      .update({ push_status: status, push_em: new Date().toISOString(), push_info: { ...info, versao: VERSAO } })
      .eq('id', id);
  } catch (_e) { /* diagnóstico nunca derruba o envio */ }
  console.log(JSON.stringify({ b7push: status, id, ...info }));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);

  let corpo: { type?: string; table?: string; record?: Notificacao; teste?: boolean; endpoint?: string } = {};
  try { corpo = await req.json(); } catch (_e) { return json({ erro: 'Corpo inválido.' }, 400); }

  /* ---- chaves VAPID ---- */
  const pub = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const priv = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@branding7.com.br';
  if (!pub || !priv) {
    return json({ ok: false, motivo: 'vapid_ausente', erro: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configuradas nos secrets.', versao: VERSAO }, 500);
  }
  webpush.setVapidDetails(subject, pub, priv);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  /* ================================================================
     TESTE — a própria pessoa, para o próprio aparelho
     ================================================================ */
  if (corpo.teste === true) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: quem } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    const user = quem && quem.user;
    if (!user) return json({ ok: false, motivo: 'sem_sessao', versao: VERSAO }, 401);

    const { data: perfil } = await sb.from('perfis').select('id, estado').eq('id', user.id).maybeSingle();
    if (!perfil || perfil.estado !== 'ativa') return json({ ok: false, motivo: 'perfil_inativo', versao: VERSAO }, 403);

    const endpoint = typeof corpo.endpoint === 'string' ? corpo.endpoint : '';
    const { data: insc } = await sb.from('push_subscricoes')
      .select('id, endpoint, p256dh, auth').eq('perfil_id', user.id).eq('endpoint', endpoint);
    const lista = (insc || []) as Inscricao[];
    if (!lista.length) return json({ ok: false, motivo: 'sem_inscricao', versao: VERSAO });

    const payload = JSON.stringify({
      v: 2, id: 'teste-' + Date.now(), tipo: 'teste.push', teste: true,
      titulo: 'Notificação de teste do B7',
      corpo: 'Se você recebeu esta mensagem, as notificações deste dispositivo estão funcionando corretamente.',
      link: '#/', acoes: [{ id: 'abrir', rotulo: 'Abrir B7', link: '#/' }]
    });
    const r = await enviar(sb, lista, payload, 60 * 10);
    console.log(JSON.stringify({ b7push: 'teste', enviados: r.enviados, removidos: r.removidos, falhas: r.falhas }));
    if (r.enviados) return json({ ok: true, enviado: true, versao: VERSAO });
    if (r.removidos) return json({ ok: false, motivo: 'inscricao_expirada', versao: VERSAO });
    return json({ ok: false, motivo: 'falha_envio', status: r.falhas[0] || null, versao: VERSAO });
  }

  /* ================================================================
     WEBHOOK — uma notificação acabou de nascer
     ================================================================ */
  const segredo = Deno.env.get('B7_WEBHOOK_SECRET') || '';
  if (segredo) {
    const recebido = req.headers.get('x-b7-webhook-secret') || '';
    if (recebido !== segredo) return json({ erro: 'Segredo do webhook inválido.' }, 401);
  } else {
    console.warn('b7-push: B7_WEBHOOK_SECRET não configurado — qualquer chamada é aceita.');
  }

  if (corpo.type && corpo.type !== 'INSERT') return json({ ok: true, ignorado: corpo.type, versao: VERSAO });
  if (corpo.table && corpo.table !== 'notificacoes') return json({ ok: true, ignorado: corpo.table, versao: VERSAO });
  const n = corpo.record;
  if (!n || !n.id || !n.destinatario_id) return json({ erro: 'record.destinatario_id ausente.' }, 400);
  const dados = (n.dados && typeof n.dados === 'object') ? n.dados : {};

  /* ---- preferência daquele tipo de aviso: fica no sino, não interrompe ---- */
  if (dados.silenciosa === true) {
    await registrar(sb, n.id, 'silenciada');
    return json({ ok: true, enviados: 0, motivo: 'silenciada pela preferência', versao: VERSAO });
  }

  /* ---- preferência da pessoa: push desligado = nada enviado ---- */
  const { data: perfil } = await sb.from('perfis')
    .select('id, estado, preferencias').eq('id', n.destinatario_id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa') return json({ ok: true, enviados: 0, motivo: 'perfil inativo', versao: VERSAO });
  const prefs = (perfil.preferencias && typeof perfil.preferencias === 'object') ? perfil.preferencias as Record<string, unknown> : {};
  if (prefs.push === false) {
    await registrar(sb, n.id, 'push_desligado');
    return json({ ok: true, enviados: 0, motivo: 'push desligado nas preferências', versao: VERSAO });
  }

  /* ---- inscrições ---- */
  const { data: inscricoes, error } = await sb.from('push_subscricoes')
    .select('id, endpoint, p256dh, auth').eq('perfil_id', n.destinatario_id);
  if (error) return json({ erro: 'Não foi possível ler push_subscricoes: ' + error.message }, 500);
  const lista = (inscricoes || []) as Inscricao[];
  if (!lista.length) {
    await registrar(sb, n.id, 'sem_inscricao');
    return json({ ok: true, enviados: 0, motivo: 'sem inscrições', versao: VERSAO });
  }

  /* Cliente da notificação: o nome abre o corpo do aviso e a logo vira o
     ícone (bucket client-logos é público, então o aparelho baixa direto).
     Sem cliente ou sem logo, o service worker usa o ícone do B7.
     Falha aqui nunca derruba o push — segue sem cliente. */
  let cliente: string | null = null;
  let logo: string | null = null;
  if (n.client_id) {
    const { data: c } = await sb.from('clientes')
      .select('nome, logo_url').eq('id', n.client_id).maybeSingle();
    if (c) { cliente = c.nome || null; logo = c.logo_url || null; }
  }

  /* Prévia real da peça (só quando o banco apontou uma). O bucket é
     privado: a URL é assinada aqui, vale 48 h — mais que o TTL do push —
     e só vai para quem já foi resolvido como destinatário. Sem imagem,
     o aviso continua completo. */
  let imagem: string | null = null;
  const img = dados.imagem as { bucket?: string; caminho?: string } | undefined;
  if (img && typeof img.bucket === 'string' && typeof img.caminho === 'string') {
    try {
      const { data: s } = await sb.storage.from(img.bucket).createSignedUrl(img.caminho, 60 * 60 * 48);
      imagem = (s && s.signedUrl) || null;
    } catch (_e) { imagem = null; }
  }

  const tipo = n.tipo || '';
  const link = n.link || '#/';
  const payload = JSON.stringify({
    v: 2, id: n.id, tipo: tipo || null, link,
    titulo: n.titulo || 'Sistema B7',
    corpo: [cliente, n.mensagem].filter(Boolean).join(' · '),
    logo, imagem, acoes: acoesDe(tipo, link),
    /* campos do formato antigo: um aparelho que ainda roda o service
       worker anterior continua mostrando um aviso legível */
    mensagem: n.mensagem || '', cliente
  });

  /* lembrete de "em 1 hora" não faz sentido chegar no dia seguinte */
  const ttl = /^agenda\..*_1h$/.test(tipo) ? 60 * 60 : 60 * 60 * 24;
  const r = await enviar(sb, lista, payload, ttl);
  await registrar(sb, n.id, r.enviados ? 'enviado' : (r.falhas.length ? 'falha' : 'sem_inscricao'),
    { enviados: r.enviados, removidos: r.removidos, falhas: r.falhas, imagem: !!imagem });

  return json({ ok: true, enviados: r.enviados, removidos: r.removidos, falhas: r.falhas, versao: VERSAO });
});
