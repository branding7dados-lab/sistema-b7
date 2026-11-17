// =====================================================================
// Otto · jeito de gente no grupo da equipe (4.59.2)
//  • reage com 😂 à mensagem que fez a turma rir (e às vezes manda uma
//    figurinha que combina); reage com 👏 ❤️ 🔥 a uma conquista/notícia boa;
//  • conhece as figurinhas: cada uma que chega ganha uma descrição curta
//    (IA com visão), e é por ela que ele escolhe qual mandar;
//  • tudo com moderação: não reage a tudo, espera entre uma e outra.
// =====================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { evo, INST, gravar } from './wa.ts';
import { gerar, provedorAtual } from './ia/servico.ts';

const I = () => encodeURIComponent(INST());
const RISADA = /^\s*(k{3,}|(ka|ak)+k*|(rs){2,}|(ha){2,}|(he){3,}|(ks)+k*|morri+|to morrendo|tô morrendo|me mijando|chorando de rir|[😂🤣💀]+)[\s!?.😂🤣💀]*$/iu;
const TEM_RISADA = /k{4,}|(ka){3,}|😂|🤣|(ha){3,}|(rs){3,}|morri de rir|me mijando|to morrendo|tô morrendo/iu;

function desembrulhar(m: any): any {
  let x = m || {};
  for (let i = 0; i < 4; i++) {
    const d = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x.viewOnceMessageV2?.message || x.documentWithCaptionMessage?.message || x.editedMessage?.message;
    if (!d) break; x = d;
  }
  return x;
}
const sha = (raw: any): string => {
  const s = desembrulhar(raw?.message)?.stickerMessage?.fileSha256;
  if (!s) return '';
  if (typeof s === 'string') return s;
  return JSON.stringify(s);
};

async function ia(sistema: string, usuario: string, maxTokens: number, imagem?: { mime: string; base64: string }): Promise<string> {
  const r = await gerar(provedorAtual(n => Deno.env.get(n)), [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
    { maxTokens, temperatura: 0.3, prazoMs: 30000, limpar: (t: string) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(), ...(imagem ? { imagem } : {}) });
  return r.ok ? r.texto : '';
}

/* ------------------------------------------------------------ figurinhas */
async function bytesDaFigurinha(sb: SupabaseClient, m: { id: string; midia_path?: string | null; midia_raw?: any }): Promise<string> {
  if (m.midia_path) {
    const d = await sb.storage.from('wa-midia').download(m.midia_path);
    if (!d.error && d.data) { const u = new Uint8Array(await d.data.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
  }
  if (!m.midia_raw) return '';
  const r = await evo('/chat/getBase64FromMediaMessage/' + I(), 'POST', { message: m.midia_raw }, 30000);
  return r.ok ? String(r.dados?.base64 || '') : '';
}

/** guarda a figurinha (uma por arquivo) e descreve com a IA de visão */
export async function conhecerFigurinha(sb: SupabaseClient, raw: any, msgId: string): Promise<void> {
  const k = sha(raw);
  if (!k) return;
  const { data: ja } = await sb.from('wa_figurinhas').select('sha, descricao').eq('sha', k).maybeSingle();
  if (ja?.descricao) return;
  if (!ja) await sb.from('wa_figurinhas').upsert({ sha: k, msg_id: msgId }, { onConflict: 'sha', ignoreDuplicates: true });
  await descrever(sb, k, msgId);
}
async function descrever(sb: SupabaseClient, k: string, msgId: string): Promise<string> {
  const { data: m } = await sb.from('wa_mensagens').select('id, midia_path, midia_raw').eq('id', msgId).maybeSingle();
  if (!m) return '';
  const b64 = await bytesDaFigurinha(sb, m as any);
  if (!b64 || b64.length > 1_400_000) return '';
  const t = await ia('Você descreve figurinhas de WhatsApp em português do Brasil, numa linha: o que aparece e em que situação ela cai bem. Ex.: "gato gargalhando — para algo muito engraçado". Até 15 palavras. Sem aspas.',
    'Descreva esta figurinha.', 120, { mime: 'image/webp', base64: b64 });
  const d = t.replace(/\s+/g, ' ').replace(/^["“]|["”]$/g, '').trim().slice(0, 160);
  if (d) await sb.from('wa_figurinhas').update({ descricao: d }).eq('sha', k);
  return d;
}

/** escolhe uma figurinha que combine com o momento (ou nenhuma) e manda */
export async function mandarFigurinha(sb: SupabaseClient, jid: string, momento: string, pedida = false): Promise<boolean> {
  let { data: figs } = await sb.from('wa_figurinhas').select('sha, msg_id, descricao, usos').not('descricao', 'is', null).limit(80);
  if ((figs || []).length < 8) {
    /* aprende as figurinhas que já estão nas conversas (até 6 por vez) */
    const { data: novas } = await sb.from('wa_mensagens').select('id, midia_raw').eq('tipo', 'figurinha').eq('apagada', false).order('criada_em', { ascending: false }).limit(60);
    let n = 0;
    for (const m of (novas || []) as any[]) {
      if (n >= 6) break;
      const k = sha({ message: m.midia_raw?.message });
      if (!k) continue;
      const { data: ja } = await sb.from('wa_figurinhas').select('sha').eq('sha', k).maybeSingle();
      if (ja) continue;
      await sb.from('wa_figurinhas').upsert({ sha: k, msg_id: m.id }, { onConflict: 'sha', ignoreDuplicates: true });
      if (await descrever(sb, k, m.id)) n++;
    }
    ({ data: figs } = await sb.from('wa_figurinhas').select('sha, msg_id, descricao, usos').not('descricao', 'is', null).limit(80));
  }
  const lista = (figs || []) as any[];
  if (!lista.length) return false;
  const esc = await ia('Você escolhe UMA figurinha de WhatsApp que combine com o momento do grupo, como uma pessoa bem-humorada faria. Responda só o número da figurinha' + (pedida ? ' — pediram uma figurinha, então escolha a que mais combina (nunca 0).' : ', ou 0 se nenhuma combinar bem.'),
    'MOMENTO: ' + momento.slice(0, 400) + '\n\nFIGURINHAS:\n' + lista.map((f, i) => (i + 1) + '. ' + f.descricao).join('\n'), 10);
  const i = parseInt(esc.replace(/\D/g, ''), 10);
  /* 4.66.4: pediram e a IA não escolheu → uma das menos usadas, para não repetir sempre a mesma */
  const f = i > 0 && i <= lista.length ? lista[i - 1] : pedida ? [...lista].sort((a, b) => (a.usos || 0) - (b.usos || 0))[Math.floor(Math.random() * Math.min(3, lista.length))] : null;
  if (!f) return false;
  const { data: m } = await sb.from('wa_mensagens').select('id, midia_path, midia_raw').eq('id', f.msg_id).maybeSingle();
  const b64 = m ? await bytesDaFigurinha(sb, m as any) : '';
  if (!b64) return false;
  const r = await evo('/message/sendSticker/' + I(), 'POST', { number: jid, sticker: b64 }, 45000);
  if (!r.ok) { console.log('otto figurinha', r.status); return false; }
  try { await gravar(sb, r.dados, { do_assistente: true, enviada_por_nome: 'Otto' } as any); } catch (_e) { /* o eco grava */ }
  if (r.dados?.key?.id) await sb.from('wa_mensagens').update({ do_assistente: true }).eq('id', r.dados.key.id);
  await sb.from('wa_figurinhas').update({ usos: (f.usos || 0) + 1 }).eq('sha', f.sha);
  return true;
}

/* ------------------------------------------------------------ reações */
async function reagir(sb: SupabaseClient, m: any, emoji: string): Promise<boolean> {
  const r = await evo('/message/sendReaction/' + I(), 'POST', { key: { remoteJid: m.jid, fromMe: !!m.de_mim, id: m.id, participant: m.autor_jid || undefined }, reaction: emoji });
  if (!r.ok) return false;
  const rs: Record<string, string[]> = m.reacoes || {};
  for (const k of Object.keys(rs)) { rs[k] = rs[k].filter(x => x !== 'otto'); if (!rs[k].length) delete rs[k]; }
  (rs[emoji] = rs[emoji] || []).push('otto');
  await sb.from('wa_mensagens').update({ reacoes: rs }).eq('id', m.id);
  return true;
}
const jaReagiu = (m: any) => Object.values(m?.reacoes || {}).some((l: any) => Array.isArray(l) && l.includes('otto'));
async function ultimaVez(sb: SupabaseClient, tipo: string, jid: string): Promise<number> {
  const { data } = await sb.from('wa_assistente_registro').select('em').eq('tipo', tipo).eq('jid', jid).order('em', { ascending: false }).limit(1).maybeSingle();
  return data?.em ? new Date(data.em).getTime() : 0;
}

/** Mensagem no grupo da equipe que NÃO era para o Otto: talvez reagir / mandar figurinha. */
export async function talvezReagir(sb: SupabaseClient, raw: any, texto: string, jid: string, msgId: string): Promise<void> {
  try {
    const agora = Date.now();
    const ctx = desembrulhar(raw?.message)?.extendedTextMessage?.contextInfo || {};
    /* 1) a turma riu: 😂 na mensagem que fez rir */
    if (RISADA.test(texto) || TEM_RISADA.test(texto)) {
      if (agora - await ultimaVez(sb, 'reacao', jid) < 90_000) return;
      let alvo: any = null;
      if (ctx.stanzaId) ({ data: alvo } = await sb.from('wa_mensagens').select('id, jid, de_mim, autor_jid, reacoes, texto, tipo, do_assistente').eq('id', String(ctx.stanzaId)).maybeSingle());
      if (!alvo) {
        const desde = new Date(agora - 4 * 60_000).toISOString();
        const { data: ant } = await sb.from('wa_mensagens').select('id, jid, de_mim, autor_jid, reacoes, texto, tipo, do_assistente, criada_em')
          .eq('jid', jid).neq('id', msgId).gte('criada_em', desde).order('criada_em', { ascending: false }).limit(12);
        alvo = ((ant || []) as any[]).find(m => !(m.tipo === 'texto' && (RISADA.test(m.texto || '') || TEM_RISADA.test(m.texto || ''))) && m.tipo !== 'figurinha' && !m.do_assistente) || null;
      }
      if (!alvo || jaReagiu(alvo) || alvo.do_assistente) return;
      /* nem toda risada: ~2 em 3 */
      if (Math.random() > 0.66) return;
      if (await reagir(sb, alvo, '😂')) {
        await sb.from('wa_assistente_registro').insert({ tipo: 'reacao', jid, autor: 'Otto', pergunta: String(alvo.texto || alvo.tipo || '').slice(0, 300), resposta: '😂' });
        /* às vezes, uma figurinha (no máx. 1 a cada 20 min) */
        if (Math.random() < 0.3 && agora - await ultimaVez(sb, 'figurinha', jid) > 20 * 60_000) {
          if (await mandarFigurinha(sb, jid, 'A turma está rindo de: ' + String(alvo.texto || '(uma mídia)')))
            await sb.from('wa_assistente_registro').insert({ tipo: 'figurinha', jid, autor: 'Otto', pergunta: String(alvo.texto || '').slice(0, 300), resposta: 'figurinha' });
        }
      }
      return;
    }
    /* 2) notícia boa, conquista, agradecimento: reação que combina (com calma) */
    if (texto.length < 8 || !/!|parab|fech|vend|aprovad|conseguimos|bateu|meta|top|show|brabo|incr[ií]vel|obrigad|valeu|bora|nasceu|anivers|[🎉🚀🔥👏❤️💪🥳]/i.test(texto)) return;
    if (agora - await ultimaVez(sb, 'reacao', jid) < 3 * 60_000) return;
    const e = (await ia('Você está num grupo de WhatsApp da equipe de uma agência. Diga se vale reagir à mensagem e com qual emoji, como um colega simpático faria (sem exagero: só quando for conquista, notícia boa, comemoração, agradecimento ou algo engraçado). Responda SÓ um destes: 👏 ❤️ 🔥 😂 🙏 🥳 — ou NADA.',
      'MENSAGEM: ' + texto.slice(0, 500), 8)).trim();
    const emoji = ['👏', '❤️', '🔥', '😂', '🙏', '🥳'].find(x => e.startsWith(x));
    if (!emoji) return;
    const { data: m } = await sb.from('wa_mensagens').select('id, jid, de_mim, autor_jid, reacoes').eq('id', msgId).maybeSingle();
    if (m && !jaReagiu(m) && await reagir(sb, m, emoji))
      await sb.from('wa_assistente_registro').insert({ tipo: 'reacao', jid, autor: 'Otto', pergunta: texto.slice(0, 300), resposta: emoji });
  } catch (e) { console.log('otto reagir', String(e).slice(0, 200)); }
}

/* ------------------------------------------------------------ outras IAs no grupo */
export type Bot = { jid?: string; nome: string; sobre?: string };
export function ehBot(bots: Bot[] | undefined, autorJid: string, autorNome: string): Bot | null {
  const n = String(autorNome || '').toLowerCase();
  return (bots || []).find(b => (b.jid && b.jid === autorJid) || (b.nome && n && n === String(b.nome).toLowerCase())) || null;
}
/** pode responder à outra IA agora? (no máx. 1 por minuto e 6 por hora, para as duas não conversarem para sempre) */
export async function podeResponderBot(sb: SupabaseClient, jid: string): Promise<boolean> {
  const { data } = await sb.from('wa_assistente_registro').select('em').eq('tipo', 'bot').eq('jid', jid).gte('em', new Date(Date.now() - 3600_000).toISOString()).order('em', { ascending: false }).limit(10);
  const l = (data || []) as any[];
  if (l.length >= 6) return false;
  return !l.length || Date.now() - new Date(l[0].em).getTime() > 60_000;
}

/* ------------------------------------------------------------ 4.59.3: reagir em vez de responder */
const OK_CURTO = /^\s*(ok+|okay|blz|beleza|valeu+|vlw|obrigad[oa]s?|brigad[oa]|top+|show+|massa|boa+|perfeito|fechou|tmj|demais|isso a[ií]|entendi|t[aá] bom|certo|uhum|sim|👍|🙏|❤️|👏|🔥)[\s!.]*$/iu;
export type Jeito = { acao: 'reagir' | 'responder' | 'ambos' | 'ignorar'; emoji: string };
/** Falaram com o Otto (ou responderam ele): vale texto, só uma reação, ou os dois? */
export async function decidirJeito(texto: string, chamadoPeloNome: boolean, conversa: string): Promise<Jeito> {
  const t = String(texto || '').trim();
  const semNome = t.replace(/^\s*@?otto[,:!]?\s*/i, '').replace(/[,\s]*@?otto[!.]*\s*$/i, '').trim();
  /* 4.71.0: falaram DO Otto (3ª pessoa: "o Otto tá desobediente", "pergunta pro Otto") e não COM ele → a IA decide, com "ignorar" */
  const terceira = chamadoPeloNome && !/^\s*@?otto\b/i.test(t) && !/[,\s]@?otto[?!.\s]*$/i.test(t) && /\b(o|do|no|pro|pra|pelo|ao|com o|que o|esse|nosso|seu) @?otto\b/i.test(t);
  if (RISADA.test(semNome)) return { acao: 'reagir', emoji: '😂' };
  if (OK_CURTO.test(semNome)) return { acao: 'reagir', emoji: /obrigad|brigad|valeu|vlw|🙏/i.test(semNome) ? '❤️' : '👍' };
  /* pergunta ou pedido claro: responde (e sem gastar IA para decidir) */
  if (!terceira && (/\?/.test(t) || t.length > 140) || !terceira && /\b(me (manda|envia|passa|fala|diz|explica|ajuda)|faz|faça|cria|crie|gera|gere|escreve|escreva|lista|quais|qual|como|quando|onde|quanto|por ?que|chama|chame|pv|privado|inbox|marca|marque|print|edita|editar|edite|corrige|corrija|apaga|apagar|apague|deleta|exclui|figurinha|sticker|audio|áudio)\b/i.test(t)) return { acao: 'responder', emoji: '' };
  const r = (await ia('Num grupo de WhatsApp da equipe, alguém escreveu para o Otto (a IA da agência) ou respondeu uma mensagem dele. Decida como uma pessoa esperta reagiria: ' +
    '"reagir" = só um emoji na mensagem (risada, comentário solto, provocação leve, elogio, "vish", algo que não pede resposta); ' +
    '"ambos" = emoji e uma resposta curta (notícia boa ou conquista que merece comemorar e comentar, brincadeira que pede réplica); ' +
    '"responder" = precisa de uma resposta em texto (pedido, dúvida, ordem); ' +
    '"ignorar" = falaram DO Otto para outra pessoa, não COM ele (ex.: "o Otto tá desobediente", "pergunta pro Otto depois") — não é com ele. ' +
    'Responda SÓ no formato: acao emoji — ex.: "reagir 😂", "ambos 🥳", "responder -", "ignorar -". Emojis possíveis: 😂 👍 ❤️ 👏 🔥 🥳 🙏 😮 👀.',
    (conversa ? 'CONVERSA RECENTE:\n' + conversa.slice(-1500) + '\n\n' : '') + (terceira ? 'O NOME DO OTTO APARECE NO MEIO DA FRASE (pode ser que estejam falando DELE, não com ele). ' : chamadoPeloNome ? 'CHAMARAM O OTTO PELO NOME. ' : 'RESPONDERAM A UMA MENSAGEM DO OTTO. ') + 'MENSAGEM: ' + t.slice(0, 400), 12)).trim().toLowerCase();
  const acao = r.startsWith('ignorar') ? 'ignorar' : r.startsWith('reagir') ? 'reagir' : r.startsWith('ambos') ? 'ambos' : 'responder';
  const emoji = ['😂', '👍', '❤️', '👏', '🔥', '🥳', '🙏', '😮', '👀'].find(e => r.includes(e)) || (acao === 'responder' || acao === 'ignorar' ? '' : '👍');
  return { acao, emoji };
}
/** reage na própria mensagem (pelo id) */
export async function reagirNaMensagem(sb: SupabaseClient, msgId: string, emoji: string, jid: string, texto: string): Promise<boolean> {
  const { data: m } = await sb.from('wa_mensagens').select('id, jid, de_mim, autor_jid, reacoes').eq('id', msgId).maybeSingle();
  if (!m || jaReagiu(m)) return false;
  const ok = await reagir(sb, m, emoji);
  if (ok) await sb.from('wa_assistente_registro').insert({ tipo: 'reacao', jid, autor: 'Otto', pergunta: texto.slice(0, 300), resposta: emoji });
  return ok;
}
