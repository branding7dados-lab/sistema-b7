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
// zzz148 — APP ANDROID: o aparelho com o app entra em push_subscricoes com
// endpoint "fcm:<token do Firebase>". Essas inscrições vão pelo Firebase
// Cloud Messaging (API v1), com a conta de serviço do projeto Firebase no
// segredo FCM_SERVICE_ACCOUNT (o JSON inteiro). Sem ele, só o app fica sem
// aviso: o navegador continua pelo Web Push.
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
import { comCors, iguais } from '../_shared/cors.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const VERSAO = '2026-10-29-zzz299';

/* Endereço do cartão do aviso (função b7-arte) e a assinatura que ela
   exige: HMAC do id, com um segredo que só as duas funções conhecem.
   Sem a assinatura certa a b7-arte responde 404. */
const ARTE = (Deno.env.get('SUPABASE_URL') ?? '') + '/functions/v1/b7-arte';
async function assinar(texto: string): Promise<string> {
  const chave = Deno.env.get('B7_WEBHOOK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const m = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('b7-arte:' + texto));
  return Array.from(new Uint8Array(m)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* zzz297: aviso de conversa igual ao do WhatsApp. O aviso leva uma
   assinatura que vale só para aquela pessoa e aquela conversa, por 7 dias:
   com ela, os botões da notificação (Responder, Marcar como lida,
   Silenciar) funcionam sem abrir o B7 e sem sessão. */
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
async function assinarConversa(perfil: string, conversa: string, exp: number): Promise<string> {
  const chave = Deno.env.get('B7_WEBHOOK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const m = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('b7-conversa:' + perfil + ':' + conversa + ':' + exp));
  return Array.from(new Uint8Array(m)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type MsgAviso = { n: string; f: string; t: string; em: number };
type Conversa = { id: string; nome: string; grupo: boolean; perfil: string; exp: number; ass: string; mensagens: MsgAviso[] };

function previaDe(m: { tipo?: string; texto?: string | null; arquivo_nome?: string | null }): string {
  if (m.tipo === 'audio') return '🎤 Mensagem de voz';
  if (m.tipo === 'imagem') return '📷 Foto' + (m.texto ? ': ' + m.texto : '');
  if (m.tipo === 'arquivo') return '📄 ' + (m.arquivo_nome || 'Arquivo');
  return String(m.texto || '');
}

/* as mensagens ainda não lidas daquela conversa (até 6), com nome e foto de quem mandou */
async function montarConversa(sb: SupabaseClient, dest: string, conversa: string): Promise<{ c: Conversa | null; silenciada: boolean }> {
  const { data: part } = await sb.from('chat_participantes').select('lida_ate, silenciada_ate')
    .eq('conversa_id', conversa).eq('perfil_id', dest).maybeSingle();
  if (!part) return { c: null, silenciada: false };
  if (part.silenciada_ate && new Date(part.silenciada_ate).getTime() > Date.now()) return { c: null, silenciada: true };
  const { data: conv } = await sb.from('chat_conversas').select('tipo, nome').eq('id', conversa).maybeSingle();
  let q = sb.from('chat_mensagens').select('autor_id, tipo, texto, arquivo_nome, created_at')
    .eq('conversa_id', conversa).neq('autor_id', dest).is('apagada_em', null)
    .order('created_at', { ascending: false }).limit(6);
  if (part.lida_ate) q = q.gt('created_at', part.lida_ate);
  const { data: msgs } = await q;
  let lista = (msgs || []).reverse();
  /* zzz299: mensagens em sequência — a tela pode ter marcado como lida no
     meio do caminho; mesmo assim o aviso é de conversa (a última de quem mandou) */
  if (!lista.length) {
    const { data: ult } = await sb.from('chat_mensagens').select('autor_id, tipo, texto, arquivo_nome, created_at')
      .eq('conversa_id', conversa).neq('autor_id', dest).is('apagada_em', null)
      .order('created_at', { ascending: false }).limit(1);
    lista = ult || [];
  }
  if (!lista.length) return { c: null, silenciada: false };
  const ids = [...new Set(lista.map((m: any) => m.autor_id))];
  const { data: pessoas } = await sb.from('perfis').select('id, nome, username, avatar_url').in('id', ids);
  const quem = new Map((pessoas || []).map((p: any) => [p.id, p]));
  const grupo = !!(conv && conv.tipo && conv.tipo !== 'direta');
  const exp = Date.now() + SETE_DIAS;
  const ultimo: any = quem.get(lista[lista.length - 1].autor_id) || {};
  return { silenciada: false, c: {
    id: conversa, grupo, perfil: dest, exp, ass: await assinarConversa(dest, conversa, exp),
    nome: grupo ? String((conv && conv.nome) || 'Grupo') : String(ultimo.nome || ultimo.username || 'Equipe'),
    mensagens: lista.map((m: any) => {
      const p: any = quem.get(m.autor_id) || {};
      return { n: String(p.nome || p.username || 'Equipe'), f: String(p.avatar_url || ''), t: previaDe(m).slice(0, 500), em: new Date(m.created_at).getTime() };
    })
  } };
}

const CORS = {
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

/* ------------------------------------------------ Firebase (app Android) */
type Conta = { project_id: string; client_email: string; private_key: string; token_uri?: string };
let contaFcm: Conta | null | undefined;
let acessoFcm: { token: string; ate: number } | null = null;

function lerConta(): Conta | null {
  if (contaFcm !== undefined) return contaFcm;
  try {
    const c = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '');
    contaFcm = c && c.project_id && c.client_email && c.private_key ? c : null;
  } catch (_e) { contaFcm = null; }
  return contaFcm ?? null;
}

const b64url = (b: Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : b;
  let t = ''; bytes.forEach(x => { t += String.fromCharCode(x); });
  return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/* token de acesso do Google (vale 1 h; guardado enquanto a função vive) */
async function tokenFcm(conta: Conta): Promise<string> {
  if (acessoFcm && acessoFcm.ate > Date.now() + 60000) return acessoFcm.token;
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: conta.token_uri || 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600
  }));
  const pem = conta.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const ass = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(cab + '.' + corpo)));
  const r = await fetch(conta.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + cab + '.' + corpo + '.' + b64url(ass)
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw Object.assign(new Error('oauth'), { statusCode: 500 });
  acessoFcm = { token: j.access_token, ate: Date.now() + (j.expires_in || 3600) * 1000 };
  return acessoFcm.token;
}

/* mesmo aviso, no formato do Firebase: título, texto, imagem e, nos
   dados, o link e o id (o app abre a tela certa ao tocar) */
async function enviarFcm(token: string, payload: string, ttl: number, versaoApp = '') {
  const conta = lerConta();
  if (!conta) throw Object.assign(new Error('sem_fcm'), { statusCode: 503 });
  const p = JSON.parse(payload);
  /* zzz297: app que sabe montar o aviso de conversa ("fcm2") recebe só os
     DADOS — quem desenha é o próprio app (foto, mensagens, Responder…).
     App antigo continua recebendo o aviso pronto, como antes. */
  if (p.conversa && versaoApp === 'fcm2') {
    const r0 = await fetch('https://fcm.googleapis.com/v1/projects/' + conta.project_id + '/messages:send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await tokenFcm(conta), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token,
        data: { kind: 'conversa', conversa: JSON.stringify(p.conversa), link: String(p.link || '#/'), id: String(p.id || '') },
        android: { priority: 'HIGH', ttl: ttl + 's' } } })
    });
    if (!r0.ok) {
      const j = await r0.json().catch(() => ({}));
      const sumiu = /UNREGISTERED/.test(JSON.stringify(j)) || r0.status === 404;
      throw Object.assign(new Error('fcm'), { statusCode: sumiu ? 410 : r0.status });
    }
    return;
  }
  /* imagem, logo e botões vão também nos dados: com o app aberto quem
     mostra o aviso é o próprio app (zzz152), e ele monta o mesmo cartão */
  const dados: Record<string, string> = {
    link: String(p.link || '#/'), id: String(p.id || ''), tipo: String(p.tipo || ''),
    imagem: String(p.imagem || ''), logo: String(p.logo || ''), acoes: JSON.stringify(p.acoes || [])
  };
  const notif: Record<string, unknown> = {
    channel_id: 'avisos', color: '#D63384', tag: String(p.id || ''),
    default_sound: true, notification_priority: 'PRIORITY_HIGH'
  };
  if (p.imagem) notif.image = p.imagem;
  const r = await fetch('https://fcm.googleapis.com/v1/projects/' + conta.project_id + '/messages:send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await tokenFcm(conta), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token,
      notification: { title: String(p.titulo || 'Sistema B7'), body: String(p.corpo || '') },
      data: dados,
      android: { priority: 'HIGH', ttl: ttl + 's', notification: notif }
    } })
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    /* token que o Firebase não conhece mais: igual ao 410 do Web Push */
    const sumiu = /UNREGISTERED/.test(JSON.stringify(j)) || r.status === 404;
    throw Object.assign(new Error('fcm'), { statusCode: sumiu ? 410 : r.status });
  }
}

/* Envia um payload para uma lista de inscrições. Inscrição que o
   navegador já descartou (404/410) é apagada: não adianta insistir. */
async function enviar(sb: SupabaseClient, lista: Inscricao[], payload: string, ttl: number) {
  let enviados = 0, removidos = 0;
  const falhas: string[] = [];
  await Promise.all(lista.map(async s => {
    try {
      if (s.endpoint.startsWith('fcm:')) {
        await enviarFcm(s.endpoint.slice(4), payload, ttl, s.p256dh);
        enviados++;
        return;
      }
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        /* 'high' (zzz2): com 'normal', o Android em repouso (Doze) segura
           o aviso até a pessoa acordar o aparelho — chegava "atrasado ou
           nunca". Aviso do B7 é sempre algo para agir, então vai na hora. */
        payload, { TTL: ttl, urgency: 'high' }
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

Deno.serve(comCors(async (req: Request) => {
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
      imagem: ARTE + '?teste=1&s=' + await assinar('teste'),
      link: '#/', acoes: [{ id: 'abrir', rotulo: 'Abrir B7', link: '#/' }]
    });
    const r = await enviar(sb, lista, payload, 60 * 10);
    console.log(JSON.stringify({ b7push: 'teste', enviados: r.enviados, removidos: r.removidos, falhas: r.falhas }));
    if (r.enviados) return json({ ok: true, enviado: true, versao: VERSAO });
    if (r.removidos) return json({ ok: false, motivo: 'inscricao_expirada', versao: VERSAO });
    return json({ ok: false, motivo: 'falha_envio', status: r.falhas[0] || null, versao: VERSAO });
  }

  /* ================================================================
     BOTÕES DO AVISO DE CONVERSA (zzz297) — sem sessão: vale a assinatura
     que foi junto no aviso (só aquela pessoa, só aquela conversa, 7 dias)
     ================================================================ */
  const ac = (corpo as any).conversa_acao;
  if (ac && typeof ac === 'object') {
    const perfil = String(ac.perfil || ''), conversa = String(ac.conversa || ''), exp = Number(ac.exp) || 0;
    if (!UUID.test(perfil) || !UUID.test(conversa) || exp < Date.now() || exp > Date.now() + SETE_DIAS + 60000)
      return json({ ok: false, erro: 'Aviso expirado. Abra a conversa no B7.' }, 401);
    if (!iguais(String(ac.ass || ''), await assinarConversa(perfil, conversa, exp)))
      return json({ ok: false, erro: 'Aviso inválido.' }, 401);
    const { data: quem } = await sb.from('perfis').select('estado').eq('id', perfil).maybeSingle();
    if (!quem || quem.estado !== 'ativa') return json({ ok: false, erro: 'Conta inativa.' }, 403);
    let r: { error: any } = { error: null };
    if (ac.acao === 'responder') {
      const texto = String(ac.texto || '').trim().slice(0, 4000);
      if (!texto) return json({ ok: false, erro: 'Mensagem vazia.' }, 400);
      r = await sb.rpc('chat_enviar_como', { p_autor: perfil, p_conversa: conversa, p_texto: texto });
    } else if (ac.acao === 'lida') {
      r = await sb.rpc('chat_marcar_lida_como', { p_perfil: perfil, p_conversa: conversa });
    } else if (ac.acao === 'silenciar') {
      r = await sb.rpc('chat_silenciar_como', { p_perfil: perfil, p_conversa: conversa, p_horas: 8 });
    } else return json({ ok: false, erro: 'Ação desconhecida.' }, 400);
    if (r.error) return json({ ok: false, erro: String(r.error.message || 'Não foi possível.').slice(0, 160) }, 400);
    return json({ ok: true, versao: VERSAO });
  }

  /* ================================================================
     WEBHOOK — uma notificação acabou de nascer
     ================================================================ */
  /* Sem segredo configurado, a função RECUSA (antes aceitava qualquer
     chamada: qualquer um mandaria um aviso com texto inventado para o
     celular de alguém da equipe). Comparação em tempo constante. */
  const segredo = Deno.env.get('B7_WEBHOOK_SECRET') || '';
  if (!segredo) {
    console.error('b7-push: B7_WEBHOOK_SECRET não configurado — webhook recusado.');
    return json({ erro: 'Webhook não configurado.' }, 503);
  }
  if (!iguais(req.headers.get('x-b7-webhook-secret') || '', segredo)) return json({ erro: 'Segredo do webhook inválido.' }, 401);

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

  /* Imagem grande do aviso: o cartão desenhado pela b7-arte (logo do
     cliente, selo, dado em destaque e, quando o banco apontou uma, a
     prévia real da peça de Design). Aqui vai só o endereço assinado; o
     aparelho busca a imagem ao exibir. Se a busca falhar, o aviso
     continua completo — só não tem a arte. */
  let imagem: string | null = null;
  try { imagem = ARTE + '?n=' + n.id + '&s=' + await assinar(n.id); } catch (_e) { imagem = null; }

  const tipo = n.tipo || '';
  const link = n.link || '#/';
  /* zzz297: mensagem de conversa — vai com as mensagens, a foto de quem
     mandou e a assinatura dos botões; conversa silenciada não toca */
  let conversa: Conversa | null = null;
  if (tipo === 'chat.mensagem' && typeof dados.conversa === 'string' && UUID.test(dados.conversa)) {
    try {
      const m = await montarConversa(sb, n.destinatario_id, dados.conversa);
      if (m.silenciada) {
        await registrar(sb, n.id, 'conversa_silenciada');
        return json({ ok: true, enviados: 0, motivo: 'conversa silenciada', versao: VERSAO });
      }
      conversa = m.c;
    } catch (_e) { conversa = null; }
  }
  if (conversa) {
    const ult = conversa.mensagens[conversa.mensagens.length - 1];
    logo = ult.f || logo;
  }
  /* aviso de conversa nunca leva o cartão grande (b7-arte): é mensagem, não demanda */
  if (tipo === 'chat.mensagem') imagem = null;
  const payload = JSON.stringify({ conversa,
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
}, 'x-b7-webhook-secret'));
