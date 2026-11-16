// =====================================================================
// WA-ENTRADA — webhook do Evolution API → B7
//
// O Evolution chama esta função a cada mensagem nova (recebida ou enviada
// pelo celular), mudança de status (✓✓), mensagem apagada, grupo novo.
// Ela grava em wa_conversas/wa_mensagens; a Central de Conversas recebe
// por tempo real. Autenticação: cabeçalho x-b7-token (HMAC da chave do
// Evolution, configurado pela wa-evolution ao ligar o webhook).
// =====================================================================
import { admin, gravar, garantirConversa, tokenWebhook, STATUS_ORDEM } from '../_shared/wa.ts';
import { iguais } from '../_shared/cors.ts';

const ok = (d: unknown = { ok: true }) => new Response(JSON.stringify(d), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') return ok({ ok: true, versao: 'wa-entrada 1 (4.51.0)' });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  const tk = req.headers.get('x-b7-token') || new URL(req.url).searchParams.get('t') || '';
  if (!tk || !iguais(tk, await tokenWebhook())) return new Response('Sem permissão', { status: 401 });

  let corpo: any = null;
  try { corpo = await req.json(); } catch (_e) { return ok({ ok: false }); }
  const evento = String(corpo?.event || '').toLowerCase().replace(/_/g, '.');
  const dados = corpo?.data;
  const sb = admin();

  try {
    if (evento === 'messages.upsert' || evento === 'send.message') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const m of lista) await gravar(sb, m);
    } else if (evento === 'messages.set') {
      /* histórico em lote: guarda só as mais recentes de cada conversa */
      const lista = (Array.isArray(dados) ? dados : dados?.messages || []).slice(-800);
      for (const m of lista) await gravar(sb, m, {}, { historico: true });
    } else if (evento === 'messages.update') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const u of lista) {
        const id = u?.keyId || u?.key?.id || u?.messageId;
        const st = u?.status;
        if (!id || !st) continue;
        const { data: m } = await sb.from('wa_mensagens').select('status').eq('id', id).maybeSingle();
        if (m && STATUS_ORDEM.indexOf(st) > STATUS_ORDEM.indexOf(m.status || '')) await sb.from('wa_mensagens').update({ status: st }).eq('id', id);
      }
    } else if (evento === 'messages.delete') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const k of lista) { const id = k?.id || k?.key?.id; if (id) await sb.from('wa_mensagens').update({ apagada: true, texto: null }).eq('id', id); }
    } else if (evento === 'groups.upsert' || evento === 'group.update' || evento === 'groups.update') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const g of lista) if (g?.id && /@g\.us$/.test(g.id)) await garantirConversa(sb, g.id, null, g.subject || null, g.pictureUrl || null);
    } else if (evento === 'chats.upsert') {
      const lista = Array.isArray(dados) ? dados : [dados];
      for (const c of lista) {
        const jid = c?.remoteJid || c?.id;
        if (jid && !/@g\.us$/.test(jid) && /@s\.whatsapp\.net$/.test(jid) && c?.name) await garantirConversa(sb, jid, c.name);
      }
    }
  } catch (e) {
    console.error('wa-entrada', evento, (e as Error)?.message);
  }
  return ok();
});
