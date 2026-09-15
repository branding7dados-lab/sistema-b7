// =====================================================================
// GOOGLE AGENDA — integração real com o Google Calendar da conta
// branding7dados (Calendário de Gravações, B7 Vídeo Parte 3)
//
// Este sistema já teve uma integração assim antes; foi removida de
// propósito numa rodada anterior ("essa função passa a viver no sistema
// da N7", ver CENTRAL.md). Está sendo reconstruída aqui a pedido
// explícito de quem usa o sistema — essa reversão foi decisão de vocês.
//
// Por que isto tem que ser uma Edge Function (e não RPC direto do
// frontend, como quase tudo no resto do B7): o refresh_token do Google
// dá acesso de longo prazo à agenda da empresa. Ele SÓ existe na tabela
// public.calendario_conexoes, que não tem nenhum grant para
// "authenticated" — só quem lê com a service role (esta função) chega
// nela. O client_id/client_secret do Google e a service role key ficam
// só nos secrets desta função, nunca no repositório nem no navegador.
//
// Rotas:
//   POST { acao: 'iniciar_conexao' }     — admin/coordenador — devolve a
//                                          URL de consentimento do Google
//   GET  ?code=...&state=...             — o PRÓPRIO Google chama isto
//                                          (redirect_uri), sem JWT nenhum
//   POST { acao: 'desconectar' }         — admin/coordenador
//   POST { acao: 'listar_calendarios' }  — admin/coordenador
//   POST { acao: 'sincronizar',
//          inicio, fim }                 — qualquer um da equipe interna
//   POST { acao: 'atualizar_evento',
//          evento_id, inicio, fim,
//          ocorrencia_id? }              — admin/coordenador — usada pela
//                                          remarcação (migration_calendario_
//                                          status.sql): move a data do MESMO
//                                          evento no Google, nunca cria outro
//   POST { acao: 'cancelar_evento',
//          evento_id, ocorrencia_id? }   — admin/coordenador — cancela
//                                          (PATCH status=cancelled, não
//                                          apaga) o evento correspondente
//   POST { acao: 'criar_evento',
//          ocorrencia_id, titulo,
//          inicio, fim?, local? }        — admin/coordenador — usada por
//                                          "marcar gravação" direto do
//                                          calendário (migration_
//                                          calendario_marcar.sql): cria
//                                          um evento NOVO na "agenda de
//                                          escrita" (calendario_agendas.
//                                          escrita_padrao) e grava o
//                                          vínculo na ocorrência
//
// (Status da conexão, escolher quais agendas ficam ativas, vincular a
// uma gravação, criar gravação a partir de um evento, e agora também o
// status de ocorrência — marcada/remarcada/concluída/cancelada — tudo
// isso é RPC direto no banco: migration_calendario.sql e
// migration_calendario_status.sql. Esta função só entra quando é preciso
// falar com o Google de verdade.)
//
// Secrets (supabase secrets set ...):
//   GOOGLE_CLIENT_ID        do Google Cloud Console (tipo "Web application")
//   GOOGLE_CLIENT_SECRET    idem — NUNCA vai para o frontend nem para o Git
//   GOOGLE_REDIRECT_URI     a URL desta função, EXATAMENTE como cadastrada
//                           nos "Authorized redirect URIs" do Google —
//                           algo como
//                           https://<ref>.supabase.co/functions/v1/google-agenda
//   APP_URL                 (opcional) URL do sistema publicado, pra onde
//                           o navegador volta depois de conectar —
//                           padrão: https://branding7dados-lab.github.io/sistema-b7/
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm da plataforma.
//
// Deploy:  supabase functions deploy google-agenda --no-verify-jwt
// (--no-verify-jwt porque o callback do Google não carrega JWT de
// usuário nenhum — a verificação de quem chamou acontece manualmente
// aqui dentro, igual ao padrão já usado em b7-auth)
//
// Ver o RELATÓRIO desta rodada para o passo a passo de configuração no
// Google Cloud Console — nenhum valor de segredo aparece nele.
// =====================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const VERSAO = '2026-09-15-c';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function paginaHtml(corpo: string, status = 200): Response {
  return new Response(corpo, { status, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } });
}

const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';
const APP_URL = Deno.env.get('APP_URL') || 'https://branding7dados-lab.github.io/sistema-b7/';
// A partir desta rodada, além de ler (listar agendas + eventos), também
// escreve: mover a data de um evento numa remarcação, e cancelar um
// evento quando a gravação é cancelada no B7 — sempre feito nesta Edge
// Function, nunca no navegador. Quem já tinha conectado antes desta
// rodada (com escopo só-leitura) precisa desconectar e conectar de novo
// pra conceder a permissão de escrita — o Google não amplia escopo de um
// token já concedido sozinho.
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

type Perfil = { id: string; nome: string; papel: string; estado: string };

async function quemChamou(req: Request): Promise<Perfil | null> {
  const cab = req.headers.get('authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await sb.from('perfis').select('id, nome, papel, estado').eq('id', data.user.id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa') return null;
  return perfil as Perfil;
}
const ehEquipe = (p: Perfil | null) => !!p && ['admin', 'coordenador'].includes(p.papel);
const ehEquipeInterna = (p: Perfil | null) => !!p && ['admin', 'coordenador', 'designer', 'videomaker'].includes(p.papel);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);

  // ---- callback do Google: navegação direta do navegador, sem JWT ----
  if (req.method === 'GET' && (url.searchParams.has('code') || url.searchParams.has('error'))) {
    return await tratarCallback(url);
  }
  if (req.method === 'GET') return json({ ok: true, versao: VERSAO });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { /* corpo vazio é válido pra algumas ações */ }
  const acao = String(corpo.acao || '');

  const perfil = await quemChamou(req);
  if (!perfil) return json({ erro: 'Sessão inválida ou expirada.' }, 401);

  if (acao === 'iniciar_conexao') return await iniciarConexao(perfil);
  if (acao === 'desconectar') return await desconectar(perfil);
  if (acao === 'listar_calendarios') return await listarCalendarios(perfil);
  if (acao === 'sincronizar') return await sincronizar(perfil, corpo);
  if (acao === 'atualizar_evento') return await atualizarEvento(perfil, corpo);
  if (acao === 'cancelar_evento') return await cancelarEvento(perfil, corpo);
  if (acao === 'criar_evento') return await criarEvento(perfil, corpo);

  return json({ erro: 'Ação desconhecida: ' + acao }, 400);
});

// =====================================================================
// CONEXÃO
// =====================================================================
async function iniciarConexao(perfil: Perfil): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador conectam o Google Calendar.' }, 403);
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return json({ erro: 'Integração não configurada nesta função: faltam os secrets GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI.' }, 500);
  }
  const estado = crypto.randomUUID() + crypto.randomUUID();
  const sb = admin();
  const { error } = await sb.from('calendario_oauth_estados').insert({ estado, admin_id: perfil.id });
  if (error) return json({ erro: 'Não foi possível iniciar a conexão: ' + error.message }, 500);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: estado
  });
  return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString() });
}

async function tratarCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const erroGoogle = url.searchParams.get('error');
  if (erroGoogle) return paginaRetorno(false, 'Conexão cancelada no Google (' + erroGoogle + ').');
  if (!code || !state) return paginaRetorno(false, 'Retorno do Google incompleto — faltou code ou state.');

  const sb = admin();
  const { data: estadoRow } = await sb.from('calendario_oauth_estados').select('*').eq('estado', state).maybeSingle();
  if (!estadoRow || estadoRow.usado) return paginaRetorno(false, 'Link de conexão expirado ou já usado — tente conectar de novo.');
  const idadeMin = (Date.now() - new Date(estadoRow.criado_em).getTime()) / 60000;
  if (idadeMin > 10) return paginaRetorno(false, 'Link de conexão expirou (mais de 10 minutos) — tente de novo.');
  await sb.from('calendario_oauth_estados').update({ usado: true }).eq('estado', state);

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code'
    })
  });
  const tok = await resp.json();
  if (!resp.ok || !tok.refresh_token) {
    console.error('google-agenda: falha ao trocar code por token', tok);
    const motivo = tok.error_description || tok.error ||
      'O Google não devolveu um refresh_token (revogue o acesso do app em myaccount.google.com/permissions e conecte de novo, pra forçar um novo consentimento).';
    return paginaRetorno(false, motivo);
  }

  let contaEmail = '';
  try {
    const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } });
    if (ui.ok) { const uj = await ui.json(); contaEmail = uj.email || ''; }
  } catch (_e) { /* não impede a conexão — só não mostra o e-mail */ }

  const expiraEm = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  /* Uma conexão só por vez, de propósito (fonte única de verdade) — a
     conexão nova substitui qualquer anterior. */
  await sb.from('calendario_conexoes').delete().not('id', 'is', null);
  await sb.from('calendario_conexoes').insert({
    conta_email: contaEmail, refresh_token: tok.refresh_token, access_token: tok.access_token,
    token_expira_em: expiraEm, escopo: tok.scope || SCOPE, status: 'ativa', conectado_por: estadoRow.admin_id
  });

  return paginaRetorno(true, 'Conectado como ' + (contaEmail || 'conta do Google') + '.');
}

function paginaRetorno(ok: boolean, mensagem: string): Response {
  const destino = APP_URL.replace(/\/$/, '') + '/#/calendario?conectado=' + (ok ? '1' : '0');
  const cor = ok ? '#2E7D32' : '#C2185B';
  const msgSegura = mensagem.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  /* Se esta página foi aberta como popup pela tela de Configurações do
     Calendário, avisa a janela original por postMessage e se fecha
     sozinha — volta pro mesmo lugar sem trocar de aba. Sem opener
     (abriu direto, ou o navegador bloqueou o "window.close"), cai no
     redirecionamento normal via meta refresh. */
  return paginaHtml(
    '<!doctype html><html><head><meta charset="utf-8"><title>Sistema B7</title>' +
    '<meta http-equiv="refresh" content="3;url=' + destino + '"></head>' +
    '<body style="font-family:system-ui,sans-serif;padding:48px 24px;text-align:center;color:' + cor + '">' +
    '<p style="font-size:15px">' + (ok ? '✓' : '✗') + ' ' + msgSegura + '</p>' +
    '<p style="color:#888;font-size:13px">Redirecionando de volta ao sistema…</p>' +
    '<p><a href="' + destino + '">Clique aqui se não redirecionar sozinho</a></p>' +
    '<script>try{if(window.opener){window.opener.postMessage({tipo:"b7-google-agenda",ok:' + (ok ? 'true' : 'false') + ',mensagem:' + JSON.stringify(mensagem) + '},"*");window.close();}}catch(e){}</script>' +
    '</body></html>'
  );
}

async function desconectar(perfil: Perfil): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador desconectam o Google Calendar.' }, 403);
  const sb = admin();
  const { data: conexao } = await sb.from('calendario_conexoes').select('*').order('conectado_em', { ascending: false }).limit(1).maybeSingle();
  if (conexao) {
    /* revogação é best-effort: mesmo se o Google recusar, a conexão sai
       do nosso banco — o usuário não deve ficar preso a uma conexão que
       o sistema não consegue mais usar. */
    try {
      await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(conexao.refresh_token), { method: 'POST' });
    } catch (_e) { /* ignorado de propósito */ }
    await sb.from('calendario_conexoes').delete().eq('id', conexao.id);
  }
  return json({ ok: true });
}

// =====================================================================
// TOKEN VÁLIDO (renova sozinho quando perto de expirar)
// =====================================================================
async function obterConexaoAtiva(sb: SupabaseClient) {
  const { data } = await sb.from('calendario_conexoes').select('*').eq('status', 'ativa')
    .order('conectado_em', { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function obterAccessTokenValido(sb: SupabaseClient): Promise<{ accessToken: string; conexao: any } | { erro: string }> {
  const conexao = await obterConexaoAtiva(sb);
  if (!conexao) return { erro: 'Nenhuma conexão ativa com o Google Calendar — conecte em Configurações do Calendário.' };
  const expira = conexao.token_expira_em ? new Date(conexao.token_expira_em).getTime() : 0;
  if (conexao.access_token && expira - Date.now() > 60_000) {
    return { accessToken: conexao.access_token, conexao };
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conexao.refresh_token, grant_type: 'refresh_token'
    })
  });
  const tok = await resp.json();
  if (!resp.ok) {
    const motivo = tok.error_description || tok.error || 'Falha ao renovar o token.';
    await sb.from('calendario_conexoes').update({ status: 'erro', ultimo_erro: motivo }).eq('id', conexao.id);
    return { erro: 'A conexão com o Google expirou ou foi revogada — reconecte em Configurações do Calendário (' + motivo + ').' };
  }
  const expiraEm = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await sb.from('calendario_conexoes').update({ access_token: tok.access_token, token_expira_em: expiraEm, status: 'ativa', ultimo_erro: null }).eq('id', conexao.id);
  return { accessToken: tok.access_token, conexao: { ...conexao, access_token: tok.access_token } };
}

// =====================================================================
// AGENDAS
// =====================================================================
async function listarCalendarios(perfil: Perfil): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador gerenciam as agendas.' }, 403);
  const sb = admin();
  const t = await obterAccessTokenValido(sb);
  if ('erro' in t) return json({ erro: t.erro }, 409);

  const resp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250', {
    headers: { Authorization: 'Bearer ' + t.accessToken }
  });
  const dados = await resp.json();
  if (!resp.ok) return json({ erro: dados.error?.message || 'Não foi possível listar as agendas do Google.' }, 502);

  const itens = (dados.items || []).map((c: any) => ({
    conexao_id: t.conexao.id, external_calendar_id: c.id,
    nome: c.summaryOverride || c.summary || c.id, cor: c.backgroundColor || null
  }));
  if (itens.length) {
    const { error } = await sb.from('calendario_agendas').upsert(itens, { onConflict: 'conexao_id,external_calendar_id' });
    if (error) return json({ erro: 'Agendas lidas do Google, mas não consegui salvar: ' + error.message }, 500);
  }
  const { data: salvos } = await sb.from('calendario_agendas').select('*').eq('conexao_id', t.conexao.id).order('nome');
  return json({ agendas: salvos || [] });
}

// =====================================================================
// SINCRONIZAÇÃO DE EVENTOS
// =====================================================================
async function sincronizar(perfil: Perfil, corpo: Record<string, unknown>): Promise<Response> {
  if (!ehEquipeInterna(perfil)) return json({ erro: 'Sem acesso ao calendário.' }, 403);
  const sb = admin();
  const t = await obterAccessTokenValido(sb);
  if ('erro' in t) return json({ erro: t.erro }, 409);

  const { data: agendas } = await sb.from('calendario_agendas').select('*').eq('conexao_id', t.conexao.id).eq('ativo', true);
  if (!agendas || !agendas.length) {
    return json({ sincronizados: 0, avisos: [], aviso_geral: 'Nenhuma agenda ativa — escolha ao menos uma em Configurações do Calendário.' });
  }

  const inicio = typeof corpo.inicio === 'string' ? corpo.inicio : new Date().toISOString();
  const fim = typeof corpo.fim === 'string' ? corpo.fim : new Date(Date.now() + 30 * 86400000).toISOString();

  let totalEventos = 0;
  const erros: string[] = [];

  for (const agenda of agendas) {
    try {
      totalEventos += await sincronizarUmaAgenda(sb, t.accessToken, agenda, inicio, fim);
    } catch (e) {
      erros.push(agenda.nome + ': ' + ((e as Error).message || 'erro de sincronização'));
    }
  }

  await sb.from('calendario_conexoes').update({
    ultima_sincronizacao: new Date().toISOString(), status: 'ativa',
    ultimo_erro: erros.length ? erros.join(' | ') : null
  }).eq('id', t.conexao.id);

  return json({ sincronizados: totalEventos, avisos: erros });
}

async function sincronizarUmaAgenda(sb: SupabaseClient, accessToken: string, agenda: any, inicio: string, fim: string): Promise<number> {
  let usandoSyncToken = !!agenda.sync_token;
  let pageToken: string | undefined;
  let novoSyncToken: string | null = agenda.sync_token || null;
  let total = 0;

  for (let pagina = 0; pagina < 10; pagina++) {   // teto de segurança contra loop infinito
    const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250', showDeleted: 'true' });
    if (usandoSyncToken) params.set('syncToken', agenda.sync_token);
    else { params.set('timeMin', new Date(inicio).toISOString()); params.set('timeMax', new Date(fim).toISOString()); }
    if (pageToken) params.set('pageToken', pageToken);

    const resp = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(agenda.external_calendar_id) + '/events?' + params.toString(),
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    const dados = await resp.json();

    if (!resp.ok) {
      if (usandoSyncToken && dados.error?.code === 410) {
        /* syncToken expirado/inválido do lado do Google — reinicia do
           zero com a janela de datas, igual à primeira sincronização. */
        usandoSyncToken = false; pageToken = undefined; novoSyncToken = null;
        pagina--; continue;
      }
      throw new Error(dados.error?.message || 'HTTP ' + resp.status);
    }

    for (const ev of (dados.items || [])) {
      const cancelado = ev.status === 'cancelled';
      const inicioEv: string | null = ev.start ? (ev.start.dateTime || ev.start.date || null) : null;
      if (!inicioEv) continue;   // evento sem data de início utilizável — ignora, não inventa
      const diaInteiro = !!(ev.start && ev.start.date && !ev.start.dateTime);
      const fimEv: string | null = ev.end ? (ev.end.dateTime || ev.end.date || null) : null;

      const { error } = await sb.from('calendario_eventos').upsert({
        agenda_id: agenda.id, external_event_id: ev.id,
        titulo: ev.summary || '(sem título)', descricao: ev.description || null,
        local: ev.location || null,
        responsavel_texto: (ev.organizer && (ev.organizer.displayName || ev.organizer.email)) || null,
        inicio: inicioEv, fim: fimEv, dia_inteiro: diaInteiro,
        status_provider: cancelado ? 'cancelled' : (ev.status === 'tentative' ? 'tentative' : 'confirmed'),
        external_updated_at: ev.updated || null, updated_at: new Date().toISOString()
      }, { onConflict: 'agenda_id,external_event_id' });
      if (!error) total++;
    }

    novoSyncToken = dados.nextSyncToken || novoSyncToken;
    pageToken = dados.nextPageToken;
    if (!pageToken) break;
  }

  await sb.from('calendario_agendas').update({
    sync_token: novoSyncToken, ultima_sincronizacao: new Date().toISOString()
  }).eq('id', agenda.id);

  return total;
}

// =====================================================================
// ESCRITA — mover ou cancelar um evento existente no Google, sempre a
// partir de uma ocorrência que já foi atualizada no B7 primeiro (a
// mudança no B7 nunca depende do Google responder: se a chamada abaixo
// falhar, quem chamou registra o aviso com
// calendario_ocorrencia_marcar_erro_sync e o dado do B7 continua valendo).
// Nunca CRIA evento novo aqui — sempre atualiza o mesmo external_event_id
// já vinculado, pra não duplicar nada na agenda da branding7dados.
// =====================================================================
async function obterEventoEAgenda(sb: SupabaseClient, eventoId: string): Promise<{ ev: any; ag: any } | { erro: string }> {
  const { data: ev } = await sb.from('calendario_eventos').select('*').eq('id', eventoId).maybeSingle();
  if (!ev) return { erro: 'Evento não encontrado no B7 — não há o que sincronizar com o Google.' };
  const { data: ag } = await sb.from('calendario_agendas').select('*').eq('id', ev.agenda_id).maybeSingle();
  if (!ag) return { erro: 'Agenda do evento não encontrada.' };
  return { ev, ag };
}

async function atualizarEvento(perfil: Perfil, corpo: Record<string, unknown>): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador remarcam um evento no Google.' }, 403);
  const eventoId = typeof corpo.evento_id === 'string' ? corpo.evento_id : '';
  const inicioISO = typeof corpo.inicio === 'string' ? corpo.inicio : '';
  const fimISO = typeof corpo.fim === 'string' ? corpo.fim : inicioISO;
  const ocorrenciaId = typeof corpo.ocorrencia_id === 'string' ? corpo.ocorrencia_id : null;
  if (!eventoId || !inicioISO) return json({ erro: 'Faltam dados para atualizar o evento no Google.' }, 400);

  const sb = admin();
  const par = await obterEventoEAgenda(sb, eventoId);
  if ('erro' in par) return json({ erro: par.erro }, 404);
  const t = await obterAccessTokenValido(sb);
  if ('erro' in t) {
    if (ocorrenciaId) await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: t.erro });
    return json({ erro: t.erro }, 409);
  }

  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(par.ag.external_calendar_id) +
      '/events/' + encodeURIComponent(par.ev.external_event_id),
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: { dateTime: inicioISO }, end: { dateTime: fimISO } })
    }
  );
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const motivo = dados.error?.message || ('HTTP ' + resp.status);
    if (ocorrenciaId) await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: 'Google recusou remarcar o evento: ' + motivo });
    return json({ erro: 'A gravação foi remarcada no B7, mas o Google recusou atualizar o evento: ' + motivo }, 502);
  }

  await sb.from('calendario_eventos').update({
    inicio: dados.start?.dateTime || dados.start?.date || inicioISO,
    fim: dados.end?.dateTime || dados.end?.date || fimISO,
    external_updated_at: dados.updated || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', eventoId);

  return json({ ok: true });
}

async function cancelarEvento(perfil: Perfil, corpo: Record<string, unknown>): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador cancelam um evento no Google.' }, 403);
  const eventoId = typeof corpo.evento_id === 'string' ? corpo.evento_id : '';
  const ocorrenciaId = typeof corpo.ocorrencia_id === 'string' ? corpo.ocorrencia_id : null;
  if (!eventoId) return json({ erro: 'Falta o evento a cancelar.' }, 400);

  const sb = admin();
  const par = await obterEventoEAgenda(sb, eventoId);
  if ('erro' in par) return json({ erro: par.erro }, 404);
  const t = await obterAccessTokenValido(sb);
  if ('erro' in t) {
    if (ocorrenciaId) await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: t.erro });
    return json({ erro: t.erro }, 409);
  }

  // PATCH pra status 'cancelled' em vez de DELETE — o evento continua
  // existindo (com o histórico de quem criou, comentários etc.) só que
  // marcado como cancelado, igual a uma pessoa cancelando pela interface
  // do Google. Nunca apaga de verdade.
  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(par.ag.external_calendar_id) +
      '/events/' + encodeURIComponent(par.ev.external_event_id),
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' })
    }
  );
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const motivo = dados.error?.message || ('HTTP ' + resp.status);
    if (ocorrenciaId) await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: 'Google recusou cancelar o evento: ' + motivo });
    return json({ erro: 'A gravação foi cancelada no B7, mas o Google recusou cancelar o evento: ' + motivo }, 502);
  }

  await sb.from('calendario_eventos').update({ status_provider: 'cancelled', updated_at: new Date().toISOString() }).eq('id', eventoId);
  return json({ ok: true });
}

// =====================================================================
// CRIAR — usada por "marcar gravação" direto do Calendário de Gravações
// (migration_calendario_marcar.sql). Ao contrário de atualizarEvento/
// cancelarEvento, aqui NÃO existe ainda um external_event_id — a
// ocorrência já foi criada no B7 (calendario_marcar_gravacao) antes desta
// chamada, sem evento_id. Criamos o evento na "agenda de escrita" e só
// então gravamos o vínculo — se o Google falhar, a gravação e a
// ocorrência continuam existindo no B7 normalmente, só sem evento
// vinculado ainda (o mesmo padrão best-effort das outras duas ações).
// =====================================================================
async function criarEvento(perfil: Perfil, corpo: Record<string, unknown>): Promise<Response> {
  if (!ehEquipe(perfil)) return json({ erro: 'Só admin/coordenador marcam uma gravação com evento no Google.' }, 403);
  const ocorrenciaId = typeof corpo.ocorrencia_id === 'string' ? corpo.ocorrencia_id : '';
  const titulo = typeof corpo.titulo === 'string' ? corpo.titulo : '';
  const inicioISO = typeof corpo.inicio === 'string' ? corpo.inicio : '';
  const fimISO = typeof corpo.fim === 'string' ? corpo.fim : inicioISO;
  const local = typeof corpo.local === 'string' ? corpo.local : '';
  if (!ocorrenciaId || !titulo || !inicioISO) return json({ erro: 'Faltam dados para criar o evento no Google.' }, 400);

  const sb = admin();
  const t = await obterAccessTokenValido(sb);
  if ('erro' in t) {
    await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: t.erro });
    return json({ erro: t.erro }, 409);
  }

  const { data: agenda } = await sb.from('calendario_agendas')
    .select('*').eq('conexao_id', t.conexao.id).eq('escrita_padrao', true).eq('ativo', true).maybeSingle();
  if (!agenda) {
    const motivo = 'Nenhuma agenda de escrita escolhida — defina uma em Configurações do Calendário antes de marcar gravações.';
    await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: motivo });
    return json({ erro: motivo }, 409);
  }

  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(agenda.external_calendar_id) + '/events',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t.accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: titulo,
        location: local || undefined,
        start: { dateTime: inicioISO },
        end: { dateTime: fimISO }
      })
    }
  );
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const motivo = dados.error?.message || ('HTTP ' + resp.status);
    await sb.rpc('calendario_ocorrencia_marcar_erro_sync', { p_ocorrencia_id: ocorrenciaId, p_erro: 'Google recusou criar o evento: ' + motivo });
    return json({ erro: 'A gravação foi marcada no B7, mas o Google recusou criar o evento: ' + motivo }, 502);
  }

  const { data: novoEvento, error: erroEvento } = await sb.from('calendario_eventos').upsert({
    agenda_id: agenda.id, external_event_id: dados.id,
    titulo: dados.summary || titulo, local: dados.location || local || null,
    inicio: dados.start?.dateTime || dados.start?.date || inicioISO,
    fim: dados.end?.dateTime || dados.end?.date || fimISO,
    dia_inteiro: false, status_provider: 'confirmed',
    external_updated_at: dados.updated || null, updated_at: new Date().toISOString()
  }, { onConflict: 'agenda_id,external_event_id' }).select('id').single();

  if (erroEvento || !novoEvento) {
    await sb.rpc('calendario_ocorrencia_marcar_erro_sync', {
      p_ocorrencia_id: ocorrenciaId,
      p_erro: 'Evento criado no Google, mas não deu pra salvar a cópia local: ' + (erroEvento?.message || '')
    });
    return json({ erro: 'Evento criado no Google, mas não deu pra salvar o vínculo — sincronize a agenda depois pra recuperar.' }, 500);
  }

  await sb.from('gravacoes_ocorrencias').update({ evento_id: novoEvento.id, atualizado_em: new Date().toISOString() }).eq('id', ocorrenciaId);
  return json({ ok: true, evento_id: novoEvento.id });
}
