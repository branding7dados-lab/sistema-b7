// =====================================================================
// WA-ENTRADA — webhook do Evolution API → B7
//
// O Evolution chama esta função a cada mensagem nova (recebida ou enviada
// pelo celular), mudança de status (✓✓), mensagem apagada, grupo novo.
// Ela grava em wa_conversas/wa_mensagens; a Central de Conversas recebe
// por tempo real. Autenticação: cabeçalho x-b7-token (HMAC da chave do
// Evolution, configurado pela wa-evolution ao ligar o webhook).
// =====================================================================
import { admin, gravar, garantirConversa, tokenWebhook, STATUS_ORDEM, evo, INST, numeros, instanciaDe } from '../_shared/wa.ts';
import { instanciaDoEvento, numeroDoEvento } from '../_shared/wa-numeros.ts';
import { iguais } from '../_shared/cors.ts';
import { aoReceber, relogio } from '../_shared/assistente.ts';
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const ok = (d: unknown = { ok: true }) => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') return ok({ ok: true, versao: 'wa-entrada 3 (4.84.0)' });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  /* 4.79.2: relógio do Otto (pg_cron a cada 5 min) — segredo guardado só no banco (wa_relogio) */
  const rl = req.headers.get('x-b7-relogio');
  if (rl) {
    const sbR = admin();
    const { data: seg } = await sbR.from('wa_relogio').select('segredo').eq('id', 1).maybeSingle();
    if (!seg?.segredo || !iguais(rl, String(seg.segredo))) return new Response('Sem permissão', { status: 401 });
    /* 4.83.3: número desconectado = nada sai. Antes o relógio gerava o bom dia, marcava como enviado e a mensagem não
       chegava (19/11). Agora confere a conexão primeiro: sem ela, não roda (nem marca) nada — quando o número voltar,
       o bom dia e os avisos saem normalmente. A situação fica guardada para a tela de Configurações. */
    /* 4.83.3: sessão "aberta" mas morta ("Connection Closed", 19/11) — reinicia a instância do Evolution.
       Pedido manual ({"reiniciar":true}) ou automático (o envio do Otto marcou wa_assistente.reiniciar_pedido). */
    let corpoR: any = {}; try { corpoR = await req.clone().json(); } catch (_e) { /* sem corpo */ }
    const { data: pend } = await sbR.from('wa_assistente').select('reiniciar_pedido').eq('id', 1).maybeSingle().then(r => r, () => ({ data: null }));
    /* com o envio quebrado, tenta reiniciar no máximo a cada 15 min */
    let tentarAgora = !!corpoR?.reiniciar;
    if (!tentarAgora && pend?.reiniciar_pedido) {
      const { data: ult } = await sbR.from('wa_assistente_registro').select('em').eq('pergunta', 'reiniciou a conexão do WhatsApp').order('em', { ascending: false }).limit(1).maybeSingle();
      tentarAgora = !ult || Date.now() - Date.parse(ult.em) > 15 * 60_000;
    }
    if (tentarAgora) {
      const instP = instanciaDe(await numeros.padrao());
      const rr = await evo('/instance/restart/' + instP, 'POST', undefined, 30000).catch(e => ({ ok: false, status: 0, dados: String(e) }));
      const rr2 = rr.ok ? rr : await evo('/instance/restart/' + instP, 'PUT', undefined, 30000).catch(e => ({ ok: false, status: 0, dados: String(e) }));
      await sbR.from('wa_assistente_registro').insert({ tipo: 'erro', autor: 'B7', pergunta: 'reiniciou a conexão do WhatsApp', resposta: JSON.stringify({ status: rr2.status, ok: rr2.ok, dados: rr2.dados }).slice(0, 500) }).then(() => null, () => null);
      if (corpoR?.reiniciar) return ok({ ok: rr2.ok, reinicio: rr2 });
    }
    let conexao = 'desconhecido';
    try { const st = await evo('/instance/connectionState/' + instanciaDe(await numeros.padrao()), 'GET', undefined, 10000); conexao = String(st.dados?.instance?.state || st.dados?.state || (st.ok ? '?' : 'erro ' + st.status)); } catch (e) { conexao = 'erro ' + String((e as Error)?.message || e).slice(0, 60); }
    try { await sbR.from('wa_assistente').update({ conexao_estado: conexao, conexao_conferida_em: new Date().toISOString() }).eq('id', 1); } catch (_e) { /* coluna nova pode faltar */ }
    if (conexao !== 'open') return ok({ ok: false, conexao, tarefas: ['parado: WhatsApp não está conectado'] });
    /* "open" mas o último envio deu "Connection Closed": não roda nada (nem marca bom dia/avisos como feitos) até
       chegar ou sair uma mensagem de verdade — aí a bandeira cai sozinha (webhook) */
    if (pend?.reiniciar_pedido) return ok({ ok: false, conexao: 'open, mas o envio falha (Connection Closed)', tarefas: ['parado: sessão do WhatsApp caiu — conecte o número de novo'] });
    try { return ok({ ok: true, conexao, tarefas: await relogio(sbR) }); }
    catch (e) { console.error('relogio', (e as Error)?.message); return ok({ ok: false }); }
  }
  const tk = req.headers.get('x-b7-token') || new URL(req.url).searchParams.get('t') || '';
  if (!tk || !iguais(tk, await tokenWebhook())) return new Response('Sem permissão', { status: 401 });

  let corpo: any = null;
  try { corpo = await req.json(); } catch (_e) { return ok({ ok: false }); }
  /* 4.84.0: de qual número da B7 veio. Instância que não está cadastrada (ou desativada) não grava nada —
     nunca cai no número padrão por engano. */
  /* banco ainda sem a zzz383 (lista vazia): segue como antes, tudo no número de sempre */
  /* erro passageiro lendo os números: 503 — o Evolution manda de novo (nunca grava no número errado) */
  let cadastrados: unknown[] = [];
  try { cadastrados = await numeros.todos(); } catch (e) { console.error('wa-entrada números', (e as Error)?.message); return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
  const ev = cadastrados.length ? await numeroDoEvento(numeros, instanciaDoEvento(corpo), INST()) : { numero: null };
  const num = ev.numero;
  /* o número padrão estava com o nome de instância errado no cadastro (≠ EVOLUTION_INSTANCE): corrige sozinho */
  if (num && ev.corrigir) {
    console.error('wa-entrada: número padrão corrigido para a instância ' + ev.corrigir);
    await admin().from('wa_numeros').update({ instancia: ev.corrigir }).eq('id', num.id).then(() => null, () => null);
    numeros.limpar();
  }
  if (cadastrados.length && (!num || !num.ativo)) return ok({ ok: true, ignorado: 'instância desconhecida' });
  const ehPadrao = !num || num.padrao;
  const doNum = (q: any) => num ? q.eq('numero_id', num.id) : q;
  /* 4.83.3: chegou evento do WhatsApp = sessão viva de novo — o relógio volta a rodar (só o número do Otto) */
  if (ehPadrao && /messages\.upsert|send\.message|messages_upsert|send_message/i.test(String(corpo?.event || ''))) admin().from('wa_assistente').update({ reiniciar_pedido: false }).eq('id', 1).eq('reiniciar_pedido', true).then(() => null, () => null);
  const evento = String(corpo?.event || '').toLowerCase().replace(/_/g, '.');
  const dados = corpo?.data;
  const sb = admin();

  try {
    if (evento === 'messages.upsert' || evento === 'send.message') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const m of lista) await gravar(sb, m, {}, {}, num);
      /* 4.54.0: o Assistente B7 avalia a mensagem em segundo plano (o webhook responde já) */
      if (evento === 'messages.upsert' && ehPadrao) {
        const job = (async () => { for (const m of lista) { try { await aoReceber(sb, m); } catch (e) { console.error('assistente', (e as Error)?.message); } } })();
        try { EdgeRuntime?.waitUntil(job); } catch (_e) { /* segue */ }
      }
    } else if (evento === 'messages.set') {
      /* histórico em lote: guarda só as mais recentes de cada conversa */
      const lista = (Array.isArray(dados) ? dados : dados?.messages || []).slice(-800);
      for (const m of lista) await gravar(sb, m, {}, { historico: true }, num);
    } else if (evento === 'messages.update') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const u of lista) {
        const id = u?.keyId || u?.key?.id || u?.messageId;
        const st = u?.status;
        if (!id || !st) continue;
        const { data: m } = await doNum(sb.from('wa_mensagens').select('status')).eq('id', id).maybeSingle();
        if (m && STATUS_ORDEM.indexOf(st) > STATUS_ORDEM.indexOf(m.status || '')) await doNum(sb.from('wa_mensagens').update({ status: st })).eq('id', id);
      }
    } else if (evento === 'messages.delete') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const k of lista) { const id = k?.id || k?.key?.id; if (id) await doNum(sb.from('wa_mensagens').update({ apagada: true, texto: null })).eq('id', id); }
    } else if (evento === 'groups.upsert' || evento === 'group.update' || evento === 'groups.update') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const g of lista) if (g?.id && /@g\.us$/.test(g.id)) await garantirConversa(sb, g.id, null, g.subject || null, g.pictureUrl || null, num);
    } else if (evento === 'chats.upsert') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const c of lista) {
        const jid = c?.remoteJid || c?.id;
        if (jid && !/@g\.us$/.test(jid) && /@s\.whatsapp\.net$/.test(jid) && c?.name) await garantirConversa(sb, jid, c.name, undefined, undefined, num);
      }
    }
  } catch (e) {
    console.error('wa-entrada', evento, (e as Error)?.message);
  }
  return ok();
});
