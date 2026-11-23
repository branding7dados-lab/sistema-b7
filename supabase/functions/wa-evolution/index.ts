// =====================================================================
// WA-EVOLUTION — o B7 conversando com o Evolution API (WhatsApp)
//
// Única ponte entre o B7 e o Evolution: a chave fica só nos secrets.
//   EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE (padrão b7-piloto)
//
// Ações (POST { acao, ... }):
//  só administrador:  estado · conectar {telefone?} · desconectar · importar {pagina?}
//  quem vê o WhatsApp (admin + videomakers):
//    enviar_texto {jid, texto, citar?} · enviar_midia {jid, path, tipo, nome?, mime?, legenda?, citar?}
//    enviar_audio {jid, path} · reagir {id, emoji} · apagar {id} · lida {jid} · midia {id}
//  4.84.0: toda ação aceita {numero} (id em wa_numeros; vazio = padrão). Só admin: numeros · numero_salvar · numero_desativar.
// O webhook (mensagens chegando → wa-entrada) é ligado sozinho ao conectar.
// =====================================================================
import { comCors } from '../_shared/cors.ts';
import { admin, evo, BASE, CHAVE, INST, tokenWebhook, gravar, garantirConversa, interpretar, previaDe, numeros, instanciaDe, numerosDaEquipe, type Linha, type Numero } from '../_shared/wa.ts';
import { instanciaNova, EQUIPES, podeAcao, podeVerNumero, ACOES_ADMIN } from '../_shared/wa-numeros.ts';
import { membrosDe, telefoneDe, b7AdminDe, dadosGrupo, participanteParaEnvio, resultadoMembros, type Membro } from '../_shared/wa-grupo.ts';
import { responderDuvida, testar as testarAssistente, mandarResumo, transcreverGuardada, sugerirResposta, corrigirTexto } from '../_shared/assistente.ts';
import { falar, ultimoDiag } from '../_shared/otto-extras.ts';
import { tokenDrive, ler, assinar, linkAssinado, midiaParaDrive, EXT } from '../_shared/drive.ts';
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const VERSAO = 'wa-evolution 19 (4.84.0)';
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
/* 4.84.0: cada pedido fala com a instância do número da conversa (sem número = padrão) */
const I = (n?: Numero | null) => instanciaDe(n);
const doNum = (q: any, n?: Numero | null) => n?.id ? q.eq('numero_id', n.id) : q;

type Perfil = { id: string; nome: string; papel: string; estado: string; eh_admin?: boolean; funcoes_adicionais?: string[] | null };
async function quemChamou(req: Request): Promise<Perfil | null> {
  const cab = req.headers.get('authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: p } = await sb.from('perfis').select('id, nome, username, papel, estado, eh_admin, funcoes_adicionais').eq('id', data.user.id).maybeSingle();
  if (!p || p.estado !== 'ativa') return null;
  return { ...p, nome: (p.nome || '').trim() || p.username } as Perfil;
}
const ehAdmin = (p: Perfil) => p.papel === 'admin' || p.eh_admin === true;
/* banco ainda sem números cadastrados: a regra antiga (admin + videomakers) */
async function podeVerAntigo(p: Perfil) {
  if (ehAdmin(p)) return true;
  const { data } = await admin().rpc('eh_videomaker_elegivel', { p_id: p.id });
  return !!data;
}

const comPrefixo = (b: string) => !b ? '' : b.startsWith('data:') ? b : 'data:image/png;base64,' + b;

const EVENTOS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'SEND_MESSAGE', 'GROUPS_UPSERT', 'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE', 'CHATS_UPSERT', 'CONNECTION_UPDATE'];
async function ligarWebhook(n: Numero | null) {
  const url = Deno.env.get('SUPABASE_URL') + '/functions/v1/wa-entrada';
  return evo('/webhook/set/' + I(n), 'POST', { webhook: { enabled: true, url, headers: { 'x-b7-token': await tokenWebhook() }, byEvents: false, base64: false, events: EVENTOS } });
}

async function estado(n: Numero | null) {
  if (!BASE() || !CHAVE()) return { configurado: false };
  const r = await evo('/instance/connectionState/' + I(n));
  if (r.status === 404) return { configurado: true, existe: false, estado: 'sem_conexao' };
  if (r.status === 401) return { configurado: true, erro: 'O Evolution recusou a chave (EVOLUTION_API_KEY diferente da .b7-chave).' };
  if (!r.ok) return { configurado: true, erro: 'O Evolution respondeu ' + r.status + '.' };
  const st = r.dados?.instance?.state || r.dados?.state || 'desconhecido';
  let numero: string | null = null;
  if (st === 'open') {
    const l = await evo('/instance/fetchInstances?instanceName=' + I(n));
    const i = Array.isArray(l.dados) ? l.dados[0] : null;
    numero = (i?.ownerJid || i?.owner || '').split('@')[0] || null;
    await ligarWebhook(n).catch(() => null);
  }
  if (n?.id) await admin().from('wa_numeros').update({ estado: st, ...(numero ? { numero } : {}) }).eq('id', n.id).then(() => null, () => null);
  return { configurado: true, existe: true, estado: st, numero, instancia: n?.instancia || INST() };
}

async function conectar(n: Numero | null, numero: string) {
  if (!BASE() || !CHAVE()) return { configurado: false };
  /* 4.53.4: pelo número, o código só vale numa conexão "nova" — se a conexão está parada
     esperando (connecting), ela é apagada e criada de novo já com o número */
  if (numero) {
    const st = await evo('/instance/connectionState/' + I(n));
    const estadoAtual = st.dados?.instance?.state || st.dados?.state;
    if (st.ok && estadoAtual === 'open') return { conectado: true };
    if (st.ok) {
      await evo('/instance/logout/' + I(n), 'DELETE').catch(() => null);
      const del = await evo('/instance/delete/' + I(n), 'DELETE').catch(() => null);
      console.log('delete', del?.status, JSON.stringify(del?.dados || {}).slice(0, 200));
      /* espera o Evolution soltar o nome (até ~8 s) */
      for (let i = 0; i < 8; i++) {
        const f = await evo('/instance/fetchInstances?instanceName=' + I(n));
        if (f.status === 404 || (Array.isArray(f.dados) && !f.dados.length)) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    let cr = await evo('/instance/create', 'POST', { instanceName: n?.instancia || INST(), integration: 'WHATSAPP-BAILEYS', qrcode: true, number: numero }, 40000);
    if (!cr.ok) {
      console.log('create', cr.status, JSON.stringify(cr.dados || {}).slice(0, 300));
      /* o nome ainda está preso: pede o código na conexão que existe */
      const r2 = await evo('/instance/connect/' + I(n) + '?number=' + numero);
      if (r2.ok && r2.dados?.pairingCode) return { qr: comPrefixo(r2.dados?.base64 || ''), codigo: r2.dados.pairingCode };
      return { erro: 'O Evolution não deixou recriar a conexão (' + cr.status + '). Tente de novo em 1 minuto.' };
    }
    await ligarWebhook(n).catch(() => null);
    let codigo = cr.dados?.qrcode?.pairingCode || null;
    if (!codigo) { const r2 = await evo('/instance/connect/' + I(n) + '?number=' + numero); codigo = r2.dados?.pairingCode || null; }
    return { qr: comPrefixo(cr.dados?.qrcode?.base64 || ''), codigo };
  }
  const q = '';
  let r = await evo('/instance/connect/' + I(n) + q);
  if (r.status === 404) {
    r = await evo('/instance/create', 'POST', Object.assign({ instanceName: n?.instancia || INST(), integration: 'WHATSAPP-BAILEYS', qrcode: true }, numero ? { number: numero } : {}));
    if (!r.ok) return { erro: 'Não consegui criar a conexão no Evolution (' + r.status + ').' };
    await ligarWebhook(n).catch(() => null);
    const q2 = r.dados?.qrcode || {};
    return { qr: comPrefixo(q2.base64 || ''), codigo: q2.pairingCode || null };
  }
  if (!r.ok) return { erro: 'O Evolution respondeu ' + r.status + '.' };
  if (r.dados?.instance?.state === 'open') return { conectado: true };
  await ligarWebhook(n).catch(() => null);
  return { qr: comPrefixo(r.dados?.base64 || ''), codigo: r.dados?.pairingCode || null };
}

/* histórico recente. 4.52.1: o "findChats" do Evolution quebra com banco MySQL
   ("Named and positional parameters mixed"), então as conversas saem das próprias
   mensagens: lê as mais recentes de todas as conversas (da mais nova para a mais
   antiga), 150 por página, até 16 páginas (~2.400 mensagens). Página 0 também
   traz todos os grupos (nome e foto). */
const POR_PAGINA = 80, PAGINAS = 30;
/* 4.52.3: em pedaços curtos (o sistema desiste de pedidos longos): página 0 = só os
   grupos; páginas 1..30 = 80 mensagens cada (≈ 2.400 no total) */
async function importar(n: Numero | null, pagina: number) {
  const sb = admin();
  if (pagina === 0) {
    let grupos = 0;
    const g = await evo('/group/fetchAllGroups/' + I(n) + '?getParticipants=false', 'GET', undefined, 60000);
    if (g.ok && Array.isArray(g.dados)) for (const x of g.dados) { if (x?.id) { await garantirConversa(sb, x.id, null, x.subject || null, x.pictureUrl || null, n); grupos++; } }
    /* 4.52.5: nomes dos contatos (para trocar os códigos @lid pelo nome nos grupos) */
    let contatos = 0;
    try {
      const ct = await evo('/chat/findContacts/' + I(n), 'POST', {}, 45000);
      const lista = (Array.isArray(ct.dados) ? ct.dados : []).filter((c: any) => c?.remoteJid && c?.pushName && c.pushName !== 'Você')
        .map((c: any) => ({ jid: String(c.remoteJid), nome: String(c.pushName), numero: /@s\.whatsapp\.net$/.test(c.remoteJid) ? String(c.remoteJid).split('@')[0] : null, atualizado_em: new Date().toISOString() }));
      for (let i = 0; i < lista.length; i += 500) { const { error } = await sb.from('wa_contatos').upsert(lista.slice(i, i + 500)); if (!error) contatos += Math.min(500, lista.length - i); }
      await sb.rpc('wa_nomes_aplicar');
    } catch (_e) { /* segue sem os nomes */ }
    return { grupos, contatos, conversas: 0, mensagens: 0, proxima: 1, total: POR_PAGINA * PAGINAS, lidas: 0 };
  }
  /* 4.52.4: em lote — uma busca no Evolution, uma leitura das conversas, uma gravação das
     mensagens e uma atualização por conversa (antes eram ~5 consultas por mensagem) */
  const t0 = Date.now();
  const m = await evo('/chat/findMessages/' + I(n), 'POST', { page: pagina, offset: POR_PAGINA }, 45000);
  const msEvo = Date.now() - t0;
  if (!m.ok) return { erro: 'O Evolution não devolveu as mensagens (' + m.status + ').' };
  const recs: any[] = m.dados?.messages?.records || [];
  const total = Math.min(Number(m.dados?.messages?.total || 0), POR_PAGINA * PAGINAS);
  const linhas = new Map<string, Linha>(); const nomes = new Map<string, string>(); const autores = new Map<string, string>();
  for (const r of recs) {
    const jid = r?.key?.remoteJid || '';
    if (!/@(g\.us|s\.whatsapp\.net|lid)$/.test(jid)) continue;
    let x: ReturnType<typeof interpretar> = null;
    try { x = interpretar(r); } catch (_e) { continue; }
    if (!x?.linha) continue;   /* reações/edições antigas ficam de fora do histórico */
    const l = x.linha; if (!l.id) continue;
    linhas.set(String(l.id), l);
    if (!l.de_mim && r.pushName && !nomes.has(jid)) nomes.set(jid, String(r.pushName));
    if (!l.de_mim && l.autor_jid && r.pushName && r.pushName !== 'Você') autores.set(String(l.autor_jid), String(r.pushName));
  }
  const lista = [...linhas.values()];
  const jids = [...new Set(lista.map(l => String(l.jid)))];
  if (!lista.length) return { grupos: 0, conversas: 0, mensagens: 0, proxima: null, total, lidas: pagina * POR_PAGINA, msEvo };
  const { data: existentes } = await doNum(sb.from('wa_conversas').select('jid, ultima_em, esperando_desde'), n).in('jid', jids);
  if (n?.id) for (const l of lista) l.numero_id = n.id;
  const conv = new Map<string, any>((existentes || []).map((c: any) => [c.jid, c]));
  for (const jid of jids) if (!conv.has(jid)) {
    try { await garantirConversa(sb, jid, /@g\.us$/.test(jid) ? null : (nomes.get(jid) || null), undefined, undefined, n); } catch (_e) { /* segue */ }
    conv.set(jid, { jid, ultima_em: null, esperando_desde: null });
  }
  const { data: novas, error } = await sb.from('wa_mensagens')
    .upsert(lista, { onConflict: n?.id ? 'numero_id,id' : 'id', ignoreDuplicates: true, defaultToNull: false }).select('id');
  if (error) return { erro: 'Não consegui guardar as mensagens: ' + error.message };
  const ids = new Set((novas || []).map((n: any) => n.id));
  /* mensagens que já estavam no B7 sem os dados de download da mídia */
  const comMidia = lista.filter(l => l.midia_raw && !ids.has(l.id)).map(l => String(l.id));
  if (comMidia.length) {
    const { data: faltam } = await doNum(sb.from('wa_mensagens').select('id'), n).in('id', comMidia).is('midia_raw', null);
    for (const f of faltam || []) await doNum(sb.from('wa_mensagens').update({ midia_raw: linhas.get(f.id)!.midia_raw }), n).eq('id', f.id);
  }
  if (autores.size) {
    /* 4.80.3: não passa por cima do nome que a equipe deu na Central */
    const { data: fixos } = await sb.from('wa_contatos').select('jid').in('jid', [...autores.keys()]).eq('nome_fixo', true);
    const pula = new Set((fixos || []).map((f: any) => f.jid));
    const novosNomes = [...autores].filter(([jid]) => !pula.has(jid));
    if (novosNomes.length) await sb.from('wa_contatos').upsert(novosNomes.map(([jid, nome]) => ({ jid, nome, atualizado_em: new Date().toISOString() })));
  }
  await sb.rpc('wa_nomes_aplicar');
  await sb.rpc('wa_unir_lids');
  const ultima = new Map<string, Linha>();
  for (const l of lista) if (ids.has(l.id)) {
    const u = ultima.get(String(l.jid));
    if (!u || new Date(String(l.criada_em)) > new Date(String(u.criada_em))) ultima.set(String(l.jid), l);
  }
  for (const [jid, l] of ultima) {
    const c = conv.get(jid);
    if (c?.ultima_em && new Date(String(l.criada_em)) < new Date(c.ultima_em)) continue;
    const patch: Linha = { atualizado_em: new Date().toISOString(), ultima_em: l.criada_em, previa: previaDe(l),
      previa_autor: l.de_mim ? (l.enviada_por_nome || null) : (/@g\.us$/.test(jid) ? l.autor_nome : null), previa_de_mim: !!l.de_mim };
    if (l.de_mim) patch.esperando_desde = null; else if (!c?.esperando_desde) patch.esperando_desde = l.criada_em;
    await doNum(sb.from('wa_conversas').update(patch), n).eq('jid', jid);
  }
  const temMais = recs.length === POR_PAGINA && pagina < PAGINAS && pagina * POR_PAGINA < total;
  return { grupos: 0, conversas: ultima.size, mensagens: ids.size, proxima: temMais ? pagina + 1 : null, total, lidas: pagina * POR_PAGINA, msEvo, ms: Date.now() - t0 };
}

/* 4.53.1: nomes e fotos dos contatos (o admin chama sozinho ao abrir a Central, no máx. 2x por dia) */
async function atualizarContatos(n: Numero | null) {
  const sb = admin(); let qtd = 0, fotos = 0;
  const ct = await evo('/chat/findContacts/' + I(n), 'POST', {}, 45000);
  const agora = new Date().toISOString();
  const lista = (Array.isArray(ct.dados) ? ct.dados : []).filter((c: any) => c?.remoteJid && !/@g\.us$/.test(c.remoteJid))
    .map((c: any) => {
      const o: Linha = { jid: String(c.remoteJid), atualizado_em: agora };
      if (c.pushName && c.pushName !== 'Você') o.nome = String(c.pushName);
      if (/@s\.whatsapp\.net$/.test(c.remoteJid)) o.numero = String(c.remoteJid).split('@')[0];
      if (c.profilePicUrl) o.foto_url = String(c.profilePicUrl);
      return o;
    });
  /* só atualiza o que veio (upsert por grupos de colunas iguais) */
  const grupos = new Map<string, Linha[]>();
  for (const o of lista) { const k = Object.keys(o).sort().join(','); (grupos.get(k) || grupos.set(k, []).get(k)!).push(o); }
  for (const g of grupos.values()) for (let i = 0; i < g.length; i += 500) { const { error } = await sb.from('wa_contatos').upsert(g.slice(i, i + 500)); if (!error) qtd += Math.min(500, g.length - i); }
  await sb.rpc('wa_nomes_aplicar');
  await sb.rpc('wa_unir_lids');
  /* 4.58.6: fotos sem link ou com o link do WhatsApp vencido (o "oe=" do link é a validade,
     em hexadecimal; vence em poucos dias). Pergunta de novo, até 60 por vez, das mais recentes. */
  const { data: convs } = await doNum(sb.from('wa_conversas').select('jid, tipo, foto_url'), n).order('ultima_em', { ascending: false, nullsFirst: false }).limit(400);
  const limite = Date.now() / 1000 + 24 * 3600;
  const vencida = (u: string | null) => { if (!u) return true; const m = /[?&]oe=([0-9a-f]+)/i.exec(u); return !!m && parseInt(m[1], 16) < limite; };
  const precisa = (convs || []).filter((c: any) => vencida(c.foto_url)).slice(0, 60);
  for (let i = 0; i < precisa.length; i += 6) {
    await Promise.all(precisa.slice(i, i + 6).map(async (c: any) => {
      try {
        const grupo = c.tipo === 'grupo' || /@g\.us$/.test(c.jid);
        const r = await evo('/chat/fetchProfilePictureUrl/' + I(n), 'POST', { number: c.jid }, 8000);
        const url = r.ok ? (r.dados?.profilePictureUrl || null) : undefined;
        if (url === undefined) return;
        if (!grupo) await sb.from('wa_contatos').upsert({ jid: c.jid, foto_url: url, atualizado_em: agora });
        if (url !== c.foto_url) { await doNum(sb.from('wa_conversas').update({ foto_url: url }), n).eq('jid', c.jid); fotos++; }
      } catch (_e) { /* segue */ }
    }));
  }
  return { ok: true, contatos: qtd, fotos };
}

/* 4.85.0 (revisão): membros de todos os grupos do número — "grupos em comum" e o selo da equipe. Chamada à parte
   (a Central chama logo depois de "contatos"), em lotes paralelos, e para antes do limite de tempo da função. */
async function sincronizarGrupos(n: Numero | null) {
  const t0 = Date.now();
  const g = await evo('/group/fetchAllGroups/' + I(n) + '?getParticipants=true', 'GET', undefined, 90000);
  if (!g.ok || !Array.isArray(g.dados)) return { erro: 'O WhatsApp não mandou a lista de grupos (' + g.status + ').' };
  const lista = g.dados.filter((x: any) => x?.id && /@g\.us$/.test(String(x.id)));
  let feitos = 0;
  for (let i = 0; i < lista.length; i += 8) {
    if (Date.now() - t0 > 120000) break;
    await Promise.all(lista.slice(i, i + 8).map(async (x: any) => { try { await gravarGrupo(n, String(x.id), x); feitos++; } catch (_e) { /* segue */ } }));
  }
  return { ok: true, grupos: lista.length, feitos };
}

/* ------------------------------------------------ 4.85.0: dados do grupo */
/** guarda o que o WhatsApp contou do grupo: campos em wa_conversas e a lista de membros (troca a lista inteira) */
async function gravarGrupo(n: Numero | null, jid: string, info: any): Promise<Membro[]> {
  const sb = admin(); const d = dadosGrupo(info); const ms = membrosDe(info); const agora = new Date().toISOString();
  let { data: cv } = await doNum(sb.from('wa_conversas').select('jid, nome_fixo'), n).eq('jid', jid).maybeSingle();
  if (!cv) { await garantirConversa(sb, jid, null, d.nome, info?.pictureUrl || null, n); cv = { jid, nome_fixo: false }; }
  const patch: Linha = { descricao: d.descricao, criado_wa: d.criado_wa, dono_jid: d.dono_jid, so_admins_enviam: d.so_admins_enviam,
    so_admins_editam: d.so_admins_editam, membros_qtd: ms.length || d.membros_qtd, membros_em: agora };
  if (d.nome && !cv.nome_fixo) patch.nome = d.nome;
  if (info?.pictureUrl) patch.foto_url = String(info.pictureUrl);
  await doNum(sb.from('wa_conversas').update(patch), n).eq('jid', jid);
  if (n?.id && ms.length) {
    await sb.from('wa_grupo_membros').delete().eq('numero_id', n.id).eq('grupo_jid', jid);
    await sb.from('wa_grupo_membros').insert(ms.map(m => ({ numero_id: n.id, grupo_jid: jid, membro_jid: m.jid, telefone: m.telefone, admin: m.admin, atualizado_em: agora })));
  }
  return ms;
}
async function infoGrupo(n: Numero | null, jid: string) {
  const r = await evo('/group/findGroupInfos/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'GET', undefined, 20000);
  if (!r.ok || !r.dados) return null;
  return r.dados;
}
/** dados do grupo para a tela: membros com nome, foto e os selos (equipe do Otto, número da B7) */
async function dadosDoGrupo(n: Numero | null, jid: string) {
  const info = await infoGrupo(n, jid);
  if (!info) return { erro: n && n.estado && n.estado !== 'open' ? 'O número ' + n.nome + ' está desconectado.' : 'O WhatsApp não mandou os dados do grupo agora.' };
  const ms = await gravarGrupo(n, jid, info);
  const sb = admin();
  const { data: cts } = ms.length ? await sb.from('wa_contatos').select('jid, nome, foto_url').in('jid', ms.map(m => m.jid)) : { data: [] as any[] };
  const ct = new Map((cts || []).map((x: any) => [x.jid, x]));
  const equipe = await numerosDaEquipe(sb);
  const nossos = new Set((await numeros.todos()).map(x => String(x.numero || '').replace(/\D/g, '')).filter(Boolean));
  const d = dadosGrupo(info);
  return {
    grupo: { ...d, foto_url: info?.pictureUrl || null },
    membros: ms.map(m => { const c: any = ct.get(m.jid) || {};
      return { ...m, nome: c.nome || null, foto: c.foto_url || null, equipe: !!(m.telefone && equipe.has(m.telefone.slice(-8))), b7: !!(m.telefone && nossos.has(m.telefone)) }; }),
    b7_admin: b7AdminDe(ms, n?.numero || null), numero_estado: n?.estado || null
  };
}
async function perfilDoContato(p: Perfil, n: Numero | null, jid: string) {
  const sb = admin();
  const { data: ct } = await sb.from('wa_contatos').select('nome, numero, foto_url').eq('jid', jid).maybeSingle();
  const tel = telefoneDe(jid) || (ct?.numero ? String(ct.numero).replace(/\D/g, '') : null);
  let pf: any = null;
  try { const r = await evo('/chat/fetchProfile/' + I(n), 'POST', { number: tel || jid }, 15000); if (r.ok) pf = r.dados; } catch (_e) { /* segue com o guardado */ }
  const recado = typeof pf?.status === 'string' ? pf.status : (pf?.status?.status || null);
  const site = Array.isArray(pf?.website) ? pf.website[0] : (pf?.website || null);
  const foto = pf?.picture || pf?.profilePictureUrl || ct?.foto_url || null;
  if (foto && foto !== ct?.foto_url && !/@g\.us$/.test(jid)) await sb.from('wa_contatos').upsert({ jid, foto_url: foto, atualizado_em: new Date().toISOString() }).then(() => null, () => null);
  /* grupos em comum nos números que QUEM PEDIU vê */
  const vis = (await numeros.todos()).filter(x => podeVerNumero({ ...p, eh_admin: ehAdmin(p) }, x)).map(x => x.id);
  let grupos: any[] = [];
  if (vis.length) {
    const ors = ['membro_jid.eq.' + jid].concat(tel ? ['telefone.eq.' + tel] : []).join(',');
    const { data: gm } = await sb.from('wa_grupo_membros').select('numero_id, grupo_jid').in('numero_id', vis).or(ors).limit(200);
    const chaves = [...new Map((gm || []).map((g: any) => [g.numero_id + '|' + g.grupo_jid, g])).values()];
    if (chaves.length) {
      const { data: cv } = await sb.from('wa_conversas').select('numero_id, jid, nome, foto_url').in('jid', chaves.map((g: any) => g.grupo_jid)).in('numero_id', vis);
      const porChave = new Map((cv || []).map((c: any) => [c.numero_id + '|' + c.jid, c]));
      grupos = chaves.map((g: any) => { const c: any = porChave.get(g.numero_id + '|' + g.grupo_jid) || {}; return { numero_id: g.numero_id, grupo_jid: g.grupo_jid, nome: c.nome || g.grupo_jid, foto_url: c.foto_url || null }; })
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'));
    }
  }
  return { perfil: { nome: pf?.name || ct?.nome || null, recado, foto, comercial: !!pf?.isBusiness, descricao: pf?.description || null, email: pf?.email || null, site, telefone: tel }, grupos };
}

/* sem número (link do Drive, que só leva o id): a primeira cópia serve — o arquivo é o mesmo */
async function msgDe(id: string, n?: Numero | null) {
  const { data } = await doNum(admin().from('wa_mensagens').select('*'), n).eq('id', id).limit(1).maybeSingle();
  return data;
}
async function citacao(citar: string | undefined, n: Numero | null) {
  if (!citar) return undefined;
  const q = await msgDe(citar, n);
  if (!q) return undefined;
  return { key: { remoteJid: q.jid, fromMe: q.de_mim, id: q.id, participant: q.autor_jid || undefined }, message: { conversation: q.texto || q.citada_previa || '' } };
}
/* grava o que o B7 enviou, com quem enviou (o eco do webhook pode chegar antes) */
async function registrarEnvio(dados: any, p: Perfil, extra: Record<string, unknown> = {}, n: Numero | null = null) {
  const sb = admin();
  if (!dados?.key?.id) return null;
  await gravar(sb, dados, { enviada_por: p.id, enviada_por_nome: p.nome, ...extra }, {}, n);
  /* 4.53.2: o Evolution aceitou → já saiu (✓). O Evolution com MySQL não avisa os ✓✓ depois. */
  await doNum(sb.from('wa_mensagens').update({ enviada_por: p.id, enviada_por_nome: p.nome, ...extra }), n).eq('id', dados.key.id);
  await doNum(sb.from('wa_mensagens').update({ status: 'SERVER_ACK' }), n).eq('id', dados.key.id).in('status', ['PENDING', 'ERROR']);
  await doNum(sb.from('wa_mensagens').update({ status: 'SERVER_ACK' }), n).eq('id', dados.key.id).is('status', null);
  return dados.key.id;
}
async function urlAssinada(path: string, s = 900, bucket = 'wa-midia') {
  const { data } = await admin().storage.from(bucket).createSignedUrl(path, s);
  return data?.signedUrl || null;
}
/* 4.80.6: a ida para o Drive mora em _shared/drive.ts (o relógio do Otto também usa, para levar os antigos) */
const paraDrive = (m: any, dados?: { bin: Uint8Array; mime: string }) => midiaParaDrive(admin(), m, dados);
/* depois de enviar um arquivo pelo B7: leva a cópia para o Drive sem segurar a resposta */
function levarDepois(id: string | null, n: Numero | null) {
  if (!id) return;
  const job = (async () => { const m = await msgDe(id, n); if (m?.midia_path && !m.drive_id) await paraDrive(m); })().catch(e => console.log('drive', String(e)));
  try { EdgeRuntime?.waitUntil(job); } catch (_e) { /* segue */ }
}

/* os bytes de uma mídia já recebida, em base64 (Drive → Storage → WhatsApp) */
function paraB64(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
async function base64DaMidia(m: any, n: Numero | null): Promise<string> {
  const sb = admin();
  if (m.drive_id) { const tk = await tokenDrive(sb); if (tk) { const r = await ler(tk, m.drive_id); if (r.ok) return paraB64(new Uint8Array(await r.arrayBuffer())); } }
  if (m.midia_path) { const d = await sb.storage.from('wa-midia').download(m.midia_path); if (!d.error && d.data) return paraB64(new Uint8Array(await d.data.arrayBuffer())); }
  const r = await evo('/chat/getBase64FromMediaMessage/' + I(n), 'POST', { message: m.midia_raw || { key: { id: m.id } } }, 60000);
  return r.ok ? String(r.dados?.base64 || '') : '';
}

async function baixarMidia(id: string, n: Numero | null) {
  const m = await msgDe(id, n);
  if (!m) return { erro: 'Mensagem não encontrada.' };
  if (m.drive_id) return { url: await linkAssinado(id), mime: m.midia_mime };
  if (m.midia_path) {
    try { if (await paraDrive(m)) return { url: await linkAssinado(id), mime: m.midia_mime }; } catch (e) { console.log('drive', String(e)); }
    return { url: await urlAssinada(m.midia_path, 3600), mime: m.midia_mime };
  }
  if (Number(m.midia_tamanho || 0) > 80 * 1024 * 1024) return { erro: 'Arquivo grande demais para abrir aqui (mais de 80 MB). Abra pelo celular.' };
  /* 4.52.5: manda a mensagem inteira (o Evolution no MySQL não acha a mensagem só pelo id) */
  const r = await evo('/chat/getBase64FromMediaMessage/' + I(n), 'POST', { message: m.midia_raw || { key: { id } }, convertToMp4: m.tipo === 'video' }, 120000);
  if (!r.ok) console.log('midia', r.status, JSON.stringify(r.dados).slice(0, 300));
  const b64 = r.dados?.base64;
  if (!r.ok || !b64) return { erro: 'O WhatsApp não liberou este arquivo (pode ter expirado).' };
  const mime = r.dados?.mimetype || m.midia_mime || 'application/octet-stream';
  const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  try { if (await paraDrive(m, { bin, mime })) return { url: await linkAssinado(id), mime }; } catch (e) { console.log('drive', String(e)); }
  /* sem Drive conectado (ou o Drive falhou): fica no Storage, como antes */
  const ext = EXT[String(mime).split(';')[0]] || (String(m.midia_nome || '').split('.').pop() || 'bin');
  const path = 'rec/' + (n && !n.padrao ? n.instancia + '/' : '') + m.jid.split('@')[0] + '/' + id + '.' + ext;
  const up = await admin().storage.from('wa-midia').upload(path, bin, { contentType: String(mime).split(';')[0], upsert: true });
  if (up.error) return { erro: 'Não consegui guardar o arquivo.' };
  await doNum(admin().from('wa_mensagens').update({ midia_path: path, midia_mime: mime }), n).eq('id', id);
  return { url: await urlAssinada(path, 3600), mime };
}

/* GET ?m=<id da mensagem>&e=<expira>&s=<assinatura>[&dl=1]: entrega o arquivo do Drive */
async function entregarDoDrive(req: Request, u: URL): Promise<Response> {
  const id = u.searchParams.get('m') || '', exp = Number(u.searchParams.get('e') || 0), sig = u.searchParams.get('s') || '';
  if (!id || exp < Date.now() / 1000 || sig !== await assinar(id, exp)) return new Response('Link expirado. Abra o arquivo de novo pelo B7.', { status: 403 });
  /* a mesma mensagem pode estar em dois números: vale a cópia que já foi para o Drive */
  const { data: m } = await admin().from('wa_mensagens').select('*').eq('id', id).not('drive_id', 'is', null).limit(1).maybeSingle();
  if (!m?.drive_id) return new Response('Arquivo não encontrado.', { status: 404 });
  const tk = await tokenDrive(admin());
  if (!tk) return new Response('O Google Drive do B7 está desconectado.', { status: 503 });
  const r = await ler(tk, m.drive_id, req.headers.get('range'));
  if (!r.ok && r.status !== 206) return new Response('O Drive não entregou o arquivo (' + r.status + ').', { status: 502 });
  const h = new Headers({ 'Content-Type': String(m.midia_mime || r.headers.get('content-type') || 'application/octet-stream').split(';')[0], 'Cache-Control': 'private, max-age=3600', 'Accept-Ranges': 'bytes' });
  for (const k of ['content-length', 'content-range']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  if (u.searchParams.get('dl')) {
    const ext = EXT[String(m.midia_mime || '').split(';')[0]] || 'bin';
    const nome = m.midia_nome || ('whatsapp-' + id + '.' + ext);
    h.set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(nome));
  }
  return new Response(r.body, { status: r.status, headers: h });
}

Deno.serve(comCors(async (req: Request) => {
  if (req.method === 'GET') {
    const u = new URL(req.url);
    if (u.searchParams.get('m')) return await entregarDoDrive(req, u);
    const d: Record<string, unknown> = { ok: true, versao: VERSAO, configurado: !!(BASE() && CHAVE()) };
    const n = await numeros.padrao();   /* diagnóstico: sempre o número padrão */
    if (d.configurado) {
      try {
        const r = await evo('/instance/fetchInstances?instanceName=' + I(n));
        d.evolution = r.status === 401 ? 'chave recusada' : r.ok ? 'ok' : 'respondeu ' + r.status;
        /* ?diag=1: só contagens e formatos (sem nomes nem textos) para achar onde o histórico trava */
        if (new URL(req.url).searchParams.get('diag') === '1') {
          const st = await evo('/instance/connectionState/' + I(n));
          d.estado = st.dados?.instance?.state || st.status;
          const ch = await evo('/chat/findChats/' + I(n), 'POST', {}, 60000);
          const lista = Array.isArray(ch.dados) ? ch.dados : [];
          d.chats = { status: ch.status, n: lista.length, chaves: lista[0] ? Object.keys(lista[0]) : [], erro: !ch.ok ? JSON.stringify(ch.dados).slice(0, 300) : undefined,
            sufixos: lista.reduce((a: Record<string, number>, x: any) => { const s = String(x?.remoteJid || x?.id || '?').split('@')[1] || '?'; a[s] = (a[s] || 0) + 1; return a; }, {}) };
          const alvo = lista.find((x: any) => /@g\.us$/.test(x?.remoteJid || '')) || lista[0];
          if (alvo) {
            const m = await evo('/chat/findMessages/' + I(n), 'POST', { where: { key: { remoteJid: alvo.remoteJid } }, page: 1, offset: 5 }, 30000);
            const recs = m.dados?.messages?.records || (Array.isArray(m.dados) ? m.dados : []);
            d.mensagens = { status: m.status, formato: m.dados ? Object.keys(m.dados) : null, total: m.dados?.messages?.total, n: recs.length,
              chaves: recs[0] ? Object.keys(recs[0]) : [], tipos: recs.map((x: any) => x?.messageType), erro: !m.ok ? JSON.stringify(m.dados).slice(0, 300) : undefined };
          }
          const tudo = await evo('/chat/findMessages/' + I(n), 'POST', { page: 1, offset: 3 }, 30000);
          const rec0 = tudo.dados?.messages?.records || [];
          d.mensagensGeral = { status: tudo.status, total: tudo.dados?.messages?.total, erro: !tudo.ok ? JSON.stringify(tudo.dados).slice(0, 300) : undefined,
            maisRecentes: rec0.map((x: any) => ({ em: x?.messageTimestamp ? new Date(Number(x.messageTimestamp) * 1000).toISOString() : null, tipo: x?.messageType, deMim: x?.key?.fromMe, sufixo: String(x?.key?.remoteJid || '').split('@')[1] })) };
          const wh = await evo('/webhook/find/' + I(n));
          d.webhook = { status: wh.status, ligado: wh.dados?.enabled, eventos: wh.dados?.events, url: wh.dados?.url ? String(wh.dados.url).replace(/^https:\/\/[^/]+/, '…') : null };
        }
      } catch (_e) { d.evolution = 'sem resposta'; }
    }
    return json(d);
  }
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const p = await quemChamou(req);
  if (!p) return json({ erro: 'Entre no sistema de novo.' }, 401);
  let c: Record<string, any> = {};
  try { c = await req.json(); } catch (_e) { /* vazio */ }
  const acao = String(c.acao || 'estado');
  /* 4.84.0: o número da conversa (vazio = padrão). Banco sem números cadastrados: segue como antes (n = null).
     Erro passageiro lendo os números: 503 — nunca cai no número padrão por engano. */
  let cadastrados: Numero[] = [];
  try { cadastrados = await numeros.todos(); } catch (_e) { return json({ erro: 'Não consegui conferir os números do WhatsApp. Tente de novo.' }, 503); }
  const n: Numero | null = cadastrados.length ? await numeros.porId(c.numero ? String(c.numero) : null) : null;
  if (cadastrados.length && !n) return json({ erro: 'Número não encontrado.' }, 404);
  const pode = cadastrados.length
    ? podeAcao(acao, { ...p, eh_admin: ehAdmin(p) }, n, await numeros.padrao())
    : (ACOES_ADMIN.includes(acao) ? ehAdmin(p) : await podeVerAntigo(p));
  if (!pode) return json({ erro: n ? (n.ativo ? 'Sem permissão para este número.' : 'Este número está desativado.') : 'Sem permissão para o WhatsApp do B7.' }, 403);
  if (!BASE() || !CHAVE()) return json({ configurado: false, erro: 'O WhatsApp do B7 não está configurado.' });

  try {
    switch (acao) {
      case 'estado': return json(await estado(n));
      case 'conectar': {
        /* 4.84.0: o telefone para parear por código vem em {telefone} ({numero} agora é o id do número no B7) */
        const numero = String(c.telefone || '').replace(/\D/g, '');
        if (numero && (numero.length < 10 || numero.length > 15)) return json({ erro: 'Número inválido. Use DDI + DDD + número, ex.: 55 62 99999-0000.' });
        return json(await conectar(n, numero));
      }
      /* 4.83.5: sessão travada ("Connection Closed", nov/2026) não aceita logout — antes o botão dizia "desconectado" e
         nada mudava. Agora: tenta o logout e, de qualquer jeito, APAGA a conexão no Evolution. O próximo "Conectar"
         cria uma nova e mostra o QR Code. */
      case 'desconectar': {
        const lo = await evo('/instance/logout/' + I(n), 'DELETE', undefined, 15000).catch(() => ({ ok: false, status: 0, dados: null }));
        const del = await evo('/instance/delete/' + I(n), 'DELETE', undefined, 20000).catch(() => ({ ok: false, status: 0, dados: null }));
        let sumiu = false;
        for (let i = 0; i < 8 && !sumiu; i++) {
          const f = await evo('/instance/fetchInstances?instanceName=' + I(n));
          sumiu = f.status === 404 || (Array.isArray(f.dados) && !f.dados.length);
          if (!sumiu) await new Promise(r => setTimeout(r, 1000));
        }
        console.log('desconectar', lo.status, del.status, sumiu);
        if (!sumiu) return json({ erro: 'O Evolution não apagou a conexão (logout ' + lo.status + ', apagar ' + del.status + '). Reinicie o servidor do Evolution e tente de novo.' });
        if (!n || n.padrao) await admin().from('wa_assistente').update({ reiniciar_pedido: false, conexao_estado: 'sem_conexao' }).eq('id', 1).then(() => null, () => null);
        if (n) await admin().from('wa_numeros').update({ estado: 'sem_conexao' }).eq('id', n.id).then(() => null, () => null);
        return json({ ok: true });
      }
      case 'importar': return json(await importar(n, Math.max(0, Number(c.pagina) || 0)));
      case 'contatos': return json(await atualizarContatos(n));
      case 'grupos_sync': return json(await sincronizarGrupos(n));
      /* 4.56.0: mandar agora as pendências no grupo da equipe */
      case 'assistente_pendencias': return json(await mandarResumo(admin(), null, true));
      /* 4.84.0: cadastro de números (Configurações do WhatsApp → Números) */
      case 'numeros': {
        const lista = await numeros.todos();
        const comEstado = await Promise.all(lista.map(async x => {
          try {
            const st = await evo('/instance/connectionState/' + I(x), 'GET', undefined, 8000);
            const e = st.status === 404 ? 'sem_conexao' : String(st.dados?.instance?.state || st.dados?.state || (st.ok ? 'desconhecido' : 'erro'));
            if (e !== x.estado) await admin().from('wa_numeros').update({ estado: e }).eq('id', x.id).then(() => null, () => null);
            return { ...x, estado: e };
          } catch (_e) { return { ...x, estado: x.estado || 'desconhecido' }; }
        }));
        return json({ lista: comEstado });
      }
      case 'numero_salvar': {
        const nome = String(c.nome || '').replace(/\s+/g, ' ').trim();
        if (nome.length < 2 || nome.length > 40) return json({ erro: 'Dê um nome de 2 a 40 letras (ex.: Designers).' });
        const equipes = (Array.isArray(c.equipes) ? c.equipes : []).map((x: unknown) => String(x)).filter((x: string, i: number, a: string[]) => EQUIPES.includes(x) && a.indexOf(x) === i);
        const cor = /^#[0-9a-f]{6}$/i.test(String(c.cor || '')) ? String(c.cor) : '#1B8F6A';
        const sb = admin();
        const todosN = await numeros.todos();
        let r;
        if (c.id) {
          if (!todosN.some(x => x.id === c.id)) return json({ erro: 'Número não encontrado.' }, 404);
          r = await sb.from('wa_numeros').update({ nome, cor, equipes }).eq('id', String(c.id)).select('*').single();
        } else {
          const instancia = instanciaNova(nome, todosN.map(x => x.instancia));
          r = await sb.from('wa_numeros').insert({ nome, cor, equipes, instancia, ordem: todosN.length, estado: 'sem_conexao' }).select('*').single();
        }
        numeros.limpar();
        if (r.error) return json({ erro: 'Não consegui salvar o número: ' + r.error.message });
        return json({ numero: r.data });
      }
      case 'numero_desativar': {
        const alvo = (await numeros.todos()).find(x => x.id === c.id);
        if (!alvo) return json({ erro: 'Número não encontrado.' }, 404);
        if (alvo.padrao) return json({ erro: 'O número padrão não pode ser desativado.' });
        await evo('/instance/logout/' + I(alvo), 'DELETE', undefined, 15000).catch(() => null);
        const { error } = await admin().from('wa_numeros').update({ ativo: false, estado: 'sem_conexao' }).eq('id', alvo.id);
        numeros.limpar();
        return json(error ? { erro: 'Não consegui desativar: ' + error.message } : { ok: true });
      }
      /* 4.85.0: dados do grupo e perfil do contato (quem vê o número); mexer no grupo (só administrador) */
      case 'grupo_dados': {
        if (!/@g\.us$/.test(String(c.jid || ''))) return json({ erro: 'Isto não é um grupo.' });
        return json(await dadosDoGrupo(n, String(c.jid)));
      }
      case 'contato_perfil': {
        const jid = String(c.jid || '');
        if (!jid || /@g\.us$/.test(jid)) return json({ erro: 'Contato inválido.' });
        return json(await perfilDoContato(p, n, jid));
      }
      case 'grupo_membros': {
        /* {operacao}: o campo acao já é o nome da ação da função */
        const jid = String(c.jid || ''), ac = String(c.operacao || '');
        if (!/@g\.us$/.test(jid)) return json({ erro: 'Isto não é um grupo.' });
        if (!['add', 'remove', 'promote', 'demote'].includes(ac)) return json({ erro: 'Ação inválida.' });
        const quem = (Array.isArray(c.participantes) ? c.participantes : []).map((x: unknown) => participanteParaEnvio(String(x))).filter(Boolean) as string[];
        if (!quem.length || quem.length > 50) return json({ erro: 'Informe o número com DDI e DDD (ex.: 55 62 99999-0000).' });
        const r = await evo('/group/updateParticipant/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', { action: ac, participants: quem }, 30000);
        if (!r.ok) return json({ erro: r.status === 403 || r.status === 401 ? 'O número da B7 não é admin deste grupo.' : 'O WhatsApp não aceitou (' + r.status + ').' });
        const res = resultadoMembros(r.dados, quem);
        await dadosDoGrupo(n, jid).catch(() => null);
        return json({ feito: res.ok, falhou: res.falhou });
      }
      case 'grupo_editar': {
        const jid = String(c.jid || '');
        if (!/@g\.us$/.test(jid)) return json({ erro: 'Isto não é um grupo.' });
        if (c.nome != null) {
          const nome = String(c.nome).replace(/\s+/g, ' ').trim();
          if (!nome || nome.length > 100) return json({ erro: 'O nome do grupo precisa ter de 1 a 100 letras.' });
          const r = await evo('/group/updateGroupSubject/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', { subject: nome }, 20000);
          if (!r.ok) return json({ erro: 'O WhatsApp não deixou trocar o nome (' + r.status + '). O número da B7 é admin do grupo?' });
          await doNum(admin().from('wa_conversas').update({ nome }), n).eq('jid', jid).eq('nome_fixo', false);
        }
        if (c.descricao != null) {
          const descricao = String(c.descricao).slice(0, 2048);
          const r = await evo('/group/updateGroupDescription/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', { description: descricao }, 20000);
          if (!r.ok) return json({ erro: 'O WhatsApp não deixou trocar a descrição (' + r.status + ').' });
          await doNum(admin().from('wa_conversas').update({ descricao }), n).eq('jid', jid);
        }
        return json({ ok: true });
      }
      case 'grupo_foto': {
        const jid = String(c.jid || '');
        if (!/@g\.us$/.test(jid) || !String(c.path || '').startsWith('envio/')) return json({ erro: 'Imagem inválida.' });
        const url = await urlAssinada(String(c.path), 900);
        if (!url) return json({ erro: 'Não achei a imagem enviada.' });
        const r = await evo('/group/updateGroupPicture/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', { image: url }, 60000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou a foto (' + r.status + ').' });
        await dadosDoGrupo(n, jid).catch(() => null);
        return json({ ok: true });
      }
      case 'grupo_convite': {
        const jid = String(c.jid || '');
        if (!/@g\.us$/.test(jid)) return json({ erro: 'Isto não é um grupo.' });
        if (c.revogar) { const rv = await evo('/group/revokeInviteCode/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', {}, 20000); if (!rv.ok) return json({ erro: 'O WhatsApp não deixou trocar o link (' + rv.status + ').' }); }
        const r = await evo('/group/inviteCode/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'GET', undefined, 20000);
        const link = r.dados?.inviteUrl || (r.dados?.inviteCode ? 'https://chat.whatsapp.com/' + r.dados.inviteCode : null);
        return json(link ? { link } : { erro: 'O WhatsApp não mandou o link (' + r.status + '). O número da B7 é admin do grupo?' });
      }
      case 'grupo_regra': {
        const jid = String(c.jid || '');
        if (!/@g\.us$/.test(jid)) return json({ erro: 'Isto não é um grupo.' });
        const mudar: [string, string][] = [];
        if (typeof c.so_admins_enviam === 'boolean') mudar.push([c.so_admins_enviam ? 'announcement' : 'not_announcement', 'so_admins_enviam']);
        if (typeof c.so_admins_editam === 'boolean') mudar.push([c.so_admins_editam ? 'locked' : 'unlocked', 'so_admins_editam']);
        if (!mudar.length) return json({ erro: 'Nada para mudar.' });
        for (const [action, campo] of mudar) {
          const r = await evo('/group/updateSetting/' + I(n) + '?groupJid=' + encodeURIComponent(jid), 'POST', { action }, 20000);
          if (!r.ok) return json({ erro: 'O WhatsApp não deixou mudar a regra (' + r.status + ').' });
          await doNum(admin().from('wa_conversas').update({ [campo]: c[campo] }), n).eq('jid', jid);
        }
        return json({ ok: true });
      }
      /* 4.56.0: participantes do grupo, para marcar com @ */
      case 'participantes': {
        if (!/@g\.us$/.test(String(c.jid || ''))) return json({ lista: [] });
        const r = await evo('/group/participants/' + I(n) + '?groupJid=' + encodeURIComponent(String(c.jid)), 'GET', undefined, 15000);
        const ps: any[] = r.dados?.participants || [];
        const ids = ps.map(x => String(x?.id || '')).filter(Boolean);
        const { data: cts } = ids.length ? await admin().from('wa_contatos').select('jid, nome, numero').in('jid', ids) : { data: [] as any[] };
        const nomes = new Map((cts || []).map((x: any) => [x.jid, x]));
        return json({ lista: ps.map(x => { const id = String(x.id || ''); const ct: any = nomes.get(id) || {};
          const fone = String(x.phoneNumber || ct.numero || (/@s\.whatsapp\.net$/.test(id) ? id : '')).split('@')[0].replace(/\D/g, '');
          return { jid: id, nome: ct.nome || (fone ? '+' + fone : id.split('@')[0]), numero: fone || null, admin: !!x.admin }; }) });
      }
      /* 4.55.0: "Testar" da tela do assistente — o que ele responderia, sem mandar */
      case 'assistente_testar': {
        const t = String(c.texto || '').trim().slice(0, 1000);
        if (!c.jid || !t) return json({ erro: 'Escolha o grupo e escreva a mensagem.' });
        return json(await testarAssistente(admin(), String(c.jid), t, String(c.autor || ''), c.equipe === true));
      }
      /* 4.54.0: responder pela Central uma dúvida que o Assistente levou à equipe */
      case 'responder_duvida': {
        const t = String(c.resposta || '').trim().slice(0, 1500);
        if (!c.id || !t) return json({ erro: 'Escreva a resposta.' });
        return json(await responderDuvida(admin(), null, t, '', p.nome, null, String(c.id)));
      }
      case 'enviar_texto': {
        const texto = String(c.texto || '').slice(0, 4000);
        if (!c.jid || !texto.trim()) return json({ erro: 'Escreva a mensagem.' });
        /* 4.56.0: menções (@) — jids dos marcados; o texto já leva "@<código>" */
        const mencoes = Array.isArray(c.mencoes) ? c.mencoes.map((x: unknown) => String(x)).filter((x: string) => /^\d{6,}(@(s\.whatsapp\.net|lid))?$/.test(x)).slice(0, 50) : [];
        const r = await evo('/message/sendText/' + I(n), 'POST', { number: c.jid, text: texto, quoted: await citacao(c.citar, n), ...(mencoes.length ? { mentioned: mencoes } : {}) }, 30000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou a mensagem (' + r.status + ').' });
        return json({ ok: true, id: await registrarEnvio(r.dados, p, {}, n) });
      }
      case 'enviar_midia': {
        /* de onde vem o arquivo: o que a pessoa subiu agora (wa-midia/envio/) ou uma arte do Design */
        const bucket = c.bucket === 'design-files' ? 'design-files' : 'wa-midia';
        if (!c.jid || !c.path || (bucket === 'wa-midia' && !String(c.path).startsWith('envio/'))) return json({ erro: 'Arquivo inválido.' });
        const url = await urlAssinada(String(c.path), 900, bucket);
        if (!url) return json({ erro: 'Não achei o arquivo enviado.' });
        const tipo = ['image', 'video', 'document'].includes(c.tipo) ? c.tipo : 'document';
        const r = await evo('/message/sendMedia/' + I(n), 'POST', {
          number: c.jid, mediatype: tipo, mimetype: c.mime || undefined, caption: c.legenda || undefined,
          media: url, fileName: c.nome || undefined, quoted: await citacao(c.citar, n)
        }, 120000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou o arquivo (' + r.status + ').' });
        const idEnv = await registrarEnvio(r.dados, p, bucket === 'wa-midia' ? { midia_path: c.path } : {}, n);
        if (bucket === 'wa-midia') levarDepois(idEnv, n);
        return json({ ok: true, id: idEnv });
      }
      case 'enviar_audio': {
        if (!c.jid || !c.path || !String(c.path).startsWith('envio/')) return json({ erro: 'Áudio inválido.' });
        const url = await urlAssinada(String(c.path), 900);
        if (!url) return json({ erro: 'Não achei o áudio gravado.' });
        const r = await evo('/message/sendWhatsAppAudio/' + I(n), 'POST', { number: c.jid, audio: url }, 120000);
        if (!r.ok) return json({ erro: 'O WhatsApp não aceitou o áudio (' + r.status + ').' });
        const idAud = await registrarEnvio(r.dados, p, { midia_path: c.path }, n);
        levarDepois(idAud, n);
        return json({ ok: true, id: idAud });
      }
      /* 4.54.1: figurinha — uma que já chegou numa conversa ({id}) ou criada de uma imagem ({path} em envio/) */
      case 'enviar_figurinha': {
        if (!c.jid) return json({ erro: 'Conversa inválida.' });
        let sticker = '';
        if (c.path) {
          if (!String(c.path).startsWith('envio/')) return json({ erro: 'Arquivo inválido.' });
          sticker = (await urlAssinada(String(c.path), 900)) || '';
        } else if (c.id) {
          const m = await msgDe(String(c.id));
          if (!m || m.tipo !== 'figurinha') return json({ erro: 'Figurinha não encontrada.' });
          sticker = await base64DaMidia(m, n);
        }
        if (!sticker) return json({ erro: 'Não consegui pegar a figurinha.' });
        const r = await evo('/message/sendSticker/' + I(n), 'POST', { number: c.jid, sticker }, 60000);
        if (!r.ok) { console.log('figurinha', r.status, JSON.stringify(r.dados).slice(0, 200)); return json({ erro: 'O WhatsApp não aceitou a figurinha (' + r.status + ').' }); }
        const idF = await registrarEnvio(r.dados, p, c.path ? { midia_path: c.path } : {}, n);
        if (c.path) levarDepois(idF, n);
        return json({ ok: true, id: idF });
      }
      case 'reagir': {
        const m = await msgDe(String(c.id || ''), n);
        if (!m) return json({ erro: 'Mensagem não encontrada.' });
        const emoji = String(c.emoji || '').slice(0, 8);
        const r = await evo('/message/sendReaction/' + I(n), 'POST', { key: { remoteJid: m.jid, fromMe: m.de_mim, id: m.id, participant: m.autor_jid || undefined }, reaction: emoji });
        if (!r.ok) return json({ erro: 'Não deu para reagir agora.' });
        const rs: Record<string, string[]> = m.reacoes || {};
        for (const k of Object.keys(rs)) { rs[k] = rs[k].filter(x => x !== 'eu'); if (!rs[k].length) delete rs[k]; }
        if (emoji) (rs[emoji] = rs[emoji] || []).push('eu');
        await doNum(admin().from('wa_mensagens').update({ reacoes: rs }), n).eq('id', m.id);
        return json({ ok: true });
      }
      case 'apagar': {
        const m = await msgDe(String(c.id || ''), n);
        if (!m || !m.de_mim) return json({ erro: 'Só dá para apagar mensagem enviada por nós.' });
        if (!m.nota) {
          const r = await evo('/chat/deleteMessageForEveryone/' + I(n), 'DELETE', { id: m.id, remoteJid: m.jid, fromMe: true });
          if (!r.ok) return json({ erro: 'O WhatsApp não deixou apagar (passou do tempo?).' });
        }
        await doNum(admin().from('wa_mensagens').update({ apagada: true, texto: null }), n).eq('id', m.id);
        return json({ ok: true });
      }
      /* 4.63.0: editar uma mensagem enviada por nós (o WhatsApp deixa até ~15 min) */
      case 'editar': {
        const m = await msgDe(String(c.id || ''), n);
        const novo = String(c.texto || '').trim().slice(0, 4000);
        if (!m || !m.de_mim || m.nota) return json({ erro: 'Só dá para editar mensagem de texto enviada por nós.' });
        if (m.tipo !== 'texto') return json({ erro: 'Só dá para editar mensagem de texto.' });
        if (!novo) return json({ erro: 'Escreva o texto novo.' });
        const r = await evo('/chat/updateMessage/' + I(n), 'POST', { number: m.jid, key: { remoteJid: m.jid, fromMe: true, id: m.id }, text: novo });
        if (!r.ok) return json({ erro: 'O WhatsApp não deixou editar (passou de 15 minutos?).' });
        await doNum(admin().from('wa_mensagens').update({ editada: true, texto: novo }), n).eq('id', m.id);
        return json({ ok: true });
      }
      case 'lida': {
        const sb = admin();
        const { data: ult } = await doNum(sb.from('wa_mensagens').select('id, jid, autor_jid'), n).eq('jid', c.jid).eq('de_mim', false).order('criada_em', { ascending: false }).limit(20);
        if (ult && ult.length) await evo('/chat/markMessageAsRead/' + I(n), 'POST', { readMessages: ult.map((x: any) => ({ remoteJid: x.jid, fromMe: false, id: x.id })) }).catch(() => null);
        await doNum(sb.from('wa_conversas').update({ nao_lidas: 0 }), n).eq('jid', c.jid);
        return json({ ok: true });
      }
      case 'midia': return json(await baixarMidia(String(c.id || ''), n));
      /* 4.62.0: amostra da voz do Otto (tela do assistente) */
      case 'voz_amostra': {
        const texto = String(c.texto || 'Oi! Eu sou o Otto, o assistente da Branding7. É assim que eu falo nos áudios do WhatsApp. Curtiu?').slice(0, 300);
        const a = await falar(texto, { provedor: String(c.provedor || 'gemini'), voz: String(c.voz || 'Orus'), estilo: String(c.estilo || ''), elevenId: c.eleven_id ? String(c.eleven_id) : null });
        /* 4.63.1: guarda a medida do fim do áudio (para acertar o corte do chiado) */
        try { await admin().from('wa_assistente_registro').insert({ tipo: 'diag_voz', autor: p.nome, pergunta: 'voz_amostra ' + String(c.voz || ''), resposta: JSON.stringify(ultimoDiag).slice(0, 1500) }); } catch (_e) { /* sem registro */ }
        return a ? json({ ok: true, audio: 'data:' + a.mime + ';base64,' + a.b64 }) : json({ erro: 'A voz não respondeu agora (confira a chave do Google ou da ElevenLabs).' });
      }
      /* 4.69.0: ajudas para quem responde na Central (não enviam nada) */
      case 'sugerir_resposta': {
        /* a sugestão lê a conversa pelo Otto, que só enxerga o número padrão */
        if (n && !n.padrao) return json({ erro: 'A sugestão da IA ainda só funciona no número dos Videomakers.' });
        const r = await sugerirResposta(admin(), String(c.jid || ''), String(p.nome || ''), String(c.pedido || ''));
        return json(r.erro ? { erro: r.erro } : { ok: true, texto: r.texto });
      }
      case 'corrigir_texto': {
        const tom = ['manter', 'formal', 'leve', 'curto'].includes(String(c.tom)) ? String(c.tom) as any : 'manter';
        const r = await corrigirTexto(String(c.texto || ''), tom);
        return json(r.erro ? { erro: r.erro } : { ok: true, texto: r.texto });
      }
      /* 4.58.7: transcrever um áudio que ficou sem texto */
      case 'transcrever': {
        const m = await msgDe(String(c.id || ''), n);
        if (!m || m.tipo !== 'audio') return json({ erro: 'Áudio não encontrado.' });
        const t = await transcreverGuardada(admin(), m);
        return t ? json({ ok: true, texto: '🎤 ' + t }) : json({ erro: 'Não consegui entender esse áudio.' });
      }
      /* 4.58.4: o painel de figurinhas numa chamada só, sem repetidas (pelo
         fileSha256 do WhatsApp) e já com os links. Antes eram 40 chamadas. */
      case 'figurinhas': {
        const { data } = await admin().from('wa_mensagens')
          .select('id, midia_path, drive_id, sha:midia_raw->message->stickerMessage->fileSha256')
          .eq('tipo', 'figurinha').eq('apagada', false).order('criada_em', { ascending: false }).limit(400);
        const vistos = new Set<string>(), lista: any[] = [];
        for (const f of (data || []) as any[]) {
          const k = f.sha ? JSON.stringify(f.sha) : f.id;
          if (vistos.has(k)) continue; vistos.add(k); lista.push(f);
          if (lista.length >= 60) break;
        }
        const caminhos = lista.filter(f => f.midia_path && !f.drive_id).map(f => f.midia_path);
        const { data: ass } = caminhos.length ? await admin().storage.from('wa-midia').createSignedUrls(caminhos, 3600) : { data: [] as any[] };
        const porCaminho = new Map((ass || []).map((a: any) => [a.path, a.signedUrl]));
        const itens = await Promise.all(lista.map(async f => ({
          id: f.id,
          url: f.drive_id ? await linkAssinado(f.id) : (f.midia_path ? porCaminho.get(f.midia_path) || null : null)
        })));
        return json({ itens });
      }
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? 'O WhatsApp demorou para responder.' : 'Não consegui falar com o WhatsApp do B7.';
    return json({ erro: msg }, 502);
  }
}));
