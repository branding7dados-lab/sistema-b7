// =====================================================================
// Otto · memória, avisos por conta própria, voz e resumo do dia (4.61.0)
// =====================================================================
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gerar, provedorAtual } from './ia/servico.ts';

const sem = (s: unknown) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const agoraBR = () => new Date(Date.now() - 3 * 3600_000);
const hojeISO = () => agoraBR().toISOString().slice(0, 10);
const dm = (iso: string) => { const [, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m; };

/* ------------------------------------------------------------ memória */
export async function memorias(sb: SupabaseClient, filtro?: string[]): Promise<string> {
  const { data } = await sb.from('wa_otto_memoria').select('texto, sobre').eq('ativo', true).order('criada_em', { ascending: false }).limit(80);
  let l = (data || []) as any[];
  if (filtro) { const f = filtro.map(sem).filter(Boolean); l = l.filter(m => f.some(x => sem(m.sobre).includes(x) || sem(m.texto).includes(x))); }
  if (!l.length) return '';
  return 'MEMÓRIA (combinados e preferências que você deve seguir):\n' + l.map(m => '- ' + m.texto + (m.sobre ? ' (' + m.sobre + ')' : '')).join('\n');
}
export async function lembrar(sb: SupabaseClient, texto: string, sobre: string, quem: string): Promise<boolean> {
  const t = String(texto || '').trim().slice(0, 500);
  if (t.length < 3) return false;
  const { error } = await sb.from('wa_otto_memoria').insert({ texto: t, sobre: String(sobre || '').trim().slice(0, 120) || null, criado_por: quem });
  return !error;
}
export async function esquecer(sb: SupabaseClient, trecho: string): Promise<number> {
  const t = String(trecho || '').trim();
  if (t.length < 3) return 0;
  const { data } = await sb.from('wa_otto_memoria').update({ ativo: false }).eq('ativo', true).ilike('texto', '%' + t.replace(/[%_]/g, '') + '%').select('id');
  return (data || []).length;
}

/* ------------------------------------------------------------ voz (Gemini TTS → WAV) */
let modelosTTS: string[] | null = null;
/* 4.68.0: modelo de voz sem cota (429) fica de fora por 15 min — não perde tempo tentando de novo */
const semCota = new Map<string, number>();
let ultimoTTS = '';
async function ttsModelos(chave: string): Promise<string[]> {
  const fixo = (Deno.env.get('GEMINI_MODELO_TTS') || '').trim();
  if (fixo) return [fixo];
  if (modelosTTS) return modelosTTS;
  const l: string[] = [];
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': chave }, signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    for (const m of d.models || []) { const n = String(m.name || '').replace(/^models\//, ''); if (/tts/i.test(n)) l.push(n); }
  } catch (_e) { /* usa a lista padrão */ }
  const nota = (n: string) => (/flash/.test(n) ? 0 : 1) + (/preview/.test(n) ? 0.5 : 0);
  /* 4.68.0: TODOS os modelos de voz (cada um tem a sua cota no Google); o que funcionou por último vai na frente */
  modelosTTS = (l.length ? l.sort((a, b) => nota(a) - nota(b)) : ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']).slice(0, 8);
  return modelosTTS;
}
/* 4.62.2/4.63.1: o modelo de voz às vezes solta um "tch" (ruído curto) DEPOIS de terminar de falar.
   Janelas de 10 ms: corta silêncio do fim; corta o último trecho com som se for curto (≤ 0,5 s), vier
   depois de uma pausa (≥ 0,06 s) e for agudo (≥ 1,2 kHz) OU um estalo (pico alto e curtíssimo);
   suaviza começo (15 ms) e fim (120 ms) e põe 250 ms de silêncio. A medida do fim fica em `ultimoDiag`. */
export let ultimoDiag: Record<string, unknown> = {};
export function limparPCM(pcm: Uint8Array, rate: number): Uint8Array {
  const n = Math.floor(pcm.length / 2);
  const dv = new DataView(pcm.buffer, pcm.byteOffset, n * 2);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = dv.getInt16(i * 2, true);
  const w = Math.max(1, Math.floor(rate * 0.01)), nw = Math.floor(n / w);
  const rms = new Float32Array(nw), zc = new Float32Array(nw);
  let max = 0;
  for (let k = 0; k < nw; k++) {
    let e = 0, z = 0;
    for (let i = k * w; i < (k + 1) * w; i++) { e += a[i] * a[i]; if (i > k * w && (a[i] < 0) !== (a[i - 1] < 0)) z++; }
    rms[k] = Math.sqrt(e / w); zc[k] = z / w * rate / 2; if (rms[k] > max) max = rms[k];
  }
  const lim = Math.max(200, max * 0.04);
  const cortes: string[] = [];
  let fim = nw;
  for (let volta = 0; volta < 4; volta++) {
    while (fim > 0 && rms[fim - 1] < lim) fim--;
    /* o último "evento": sons separados por menos de 0,1 s contam como um só (o "tch" costuma ser 2 estalos colados) */
    let ini = fim, gap = fim;
    for (;;) {
      while (ini > 0 && rms[ini - 1] >= lim) ini--;
      gap = ini; while (gap > 0 && rms[gap - 1] < lim) gap--;
      if (gap > 0 && (ini - gap) * 0.01 < 0.1) { ini = gap; continue; }
      break;
    }
    const dur = (fim - ini) * 0.01, pausa = (ini - gap) * 0.01;
    let zm = 0, pico = 0; for (let k = ini; k < fim; k++) { zm += zc[k]; if (rms[k] > pico) pico = rms[k]; }
    zm = fim > ini ? zm / (fim - ini) : 0;
    const agudo = zm >= 1200, estalo = dur <= 0.08 && pico >= max * 0.15;
    if (gap > 0 && dur <= 0.5 && pausa >= 0.12 && (agudo || estalo)) { cortes.push(dur.toFixed(2) + 's/' + Math.round(zm) + 'Hz/pausa' + pausa.toFixed(2)); fim = gap; continue; }
    break;
  }
  /* medida dos últimos 1,2 s (para conferir) */
  const ult: string[] = [];
  for (let k = Math.max(0, nw - 120); k < nw; k += 5) { let r = 0, z = 0; for (let j = k; j < Math.min(nw, k + 5); j++) { r = Math.max(r, rms[j]); z += zc[j]; } ult.push(Math.round(r) + '/' + Math.round(z / 5)); }
  ultimoDiag = { dur: (n / rate).toFixed(2), max: Math.round(max), lim: Math.round(lim), cortes, fimEm: (fim * 0.01).toFixed(2), ultimos50ms_rms_zc: ult.join(' ') };
  const corte = Math.min(n, fim * w + Math.floor(rate * 0.06));
  const pad = Math.floor(rate * 0.25);
  const out = new Int16Array(corte + pad);
  const fi = Math.floor(rate * 0.015), ff = Math.min(Math.floor(rate * 0.12), corte);
  for (let i = 0; i < corte; i++) {
    let v = a[i];
    if (i < fi) v *= i / fi;
    if (i > corte - ff) v *= Math.max(0, (corte - i) / ff);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return new Uint8Array(out.buffer);
}
function wav(pcm: Uint8Array, rate = 24000): Uint8Array {
  const h = new ArrayBuffer(44), v = new DataView(h);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h), 0); out.set(pcm, 44); return out;
}
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
/* 4.62.0: as 30 vozes do Gemini (nome · jeito) */
export const VOZES: [string, string][] = [
  ['Orus', 'firme'], ['Puck', 'animada'], ['Charon', 'informativa'], ['Fenrir', 'empolgada'], ['Kore', 'firme (fem.)'], ['Aoede', 'leve (fem.)'],
  ['Leda', 'jovem (fem.)'], ['Zephyr', 'clara (fem.)'], ['Callirrhoe', 'tranquila (fem.)'], ['Autonoe', 'clara (fem.)'], ['Enceladus', 'sussurrada'],
  ['Iapetus', 'clara'], ['Umbriel', 'tranquila'], ['Algieba', 'suave'], ['Despina', 'suave (fem.)'], ['Erinome', 'clara (fem.)'], ['Algenib', 'grave'],
  ['Rasalgethi', 'informativa'], ['Laomedeia', 'animada (fem.)'], ['Achernar', 'suave (fem.)'], ['Alnilam', 'firme'], ['Schedar', 'equilibrada'],
  ['Gacrux', 'madura (fem.)'], ['Pulcherrima', 'direta (fem.)'], ['Achird', 'amigável'], ['Zubenelgenubi', 'casual'], ['Vindemiatrix', 'gentil (fem.)'],
  ['Sadachbia', 'viva'], ['Sadaltager', 'conhecedora'], ['Sulafat', 'calorosa (fem.)']
];
export type Voz = { provedor?: string; voz?: string; estilo?: string; elevenId?: string | null };
export type Audio = { b64: string; mime: string; segundos: number };
/** a resposta escrita vira FALA: curta, natural, sem lista/link/código; diz se é bom mandar o texto junto */
export async function roteiroDeFala(texto: string, op: { modo?: 'auto' | 'sempre' | 'nunca'; maxSegundos?: number } = {}): Promise<{ fala: string; comTexto: boolean }> {
  const t = String(texto || '').replace(/\[\[\s*NOVA\s*\]\]/gi, '\n').trim();
  const temCoisaDeLer = /https?:\/\/|www\.|\n\s*[-•*\d]+[.)]?\s|\b[A-Z]{2,}-\d+\b|@\d{6,}/.test(t) || t.length > 700;
  const palavras = Math.round(2.7 * Math.max(15, Math.min(120, op.maxSegundos || 40)));
  /* 4.68.0: reescrever para fala custa uma chamada de IA (1 a 20 s). No "auto", só quando precisa:
     link, lista, número, sigla, emoji/markdown ou texto longo. Texto simples vai direto para a voz. */
  const simples = !temCoisaDeLer && !/\d|[*_~#]|\b[A-Z]{2,}\b/.test(t) && t.split(/\s+/).length <= palavras;
  if (op.modo === 'nunca' || (op.modo !== 'sempre' && simples))
    return { fala: t.replace(/[*_~`#]/g, '').replace(/https?:\/\/\S+/g, '').split(/\s+/).slice(0, palavras).join(' '), comTexto: temCoisaDeLer };
  const r = await gerar(provedorAtual(n => Deno.env.get(n)), [
    { role: 'system', content: 'Reescreva a mensagem abaixo como FALA de um áudio de WhatsApp em português do Brasil: natural, como quem fala, frases curtas, sem listas, sem emojis, sem links, sem códigos, sem markdown. Datas e horas por extenso ("dezoito de novembro", "às três da tarde"), números como se fala, siglas como se pronuncia. Mantenha o sentido e os fatos; se houver links, listas longas ou códigos, diga só o essencial ("te mandei os detalhes por escrito aqui embaixo"). No máximo uns ' + Math.round(palavras / 2.7) + ' segundos de fala (até ~' + palavras + ' palavras). Devolva só o texto falado.' },
    { role: 'user', content: t.slice(0, 3000) }
  ], { maxTokens: 400, temperatura: 0.4, prazoMs: 20000, limpar: (x: string) => String(x || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^["“]|["”]$/g, '').trim() });
  const fala = r.ok && r.texto ? r.texto : t.replace(/[*_~`#]/g, '').replace(/https?:\/\/\S+/g, '').slice(0, 700);
  return { fala, comTexto: temCoisaDeLer };
}
/** ElevenLabs (se houver ELEVENLABS_API_KEY e uma voz escolhida) — mais natural, aceita voz clonada */
async function falarEleven(texto: string, vozId: string): Promise<Audio | null> {
  const chave = (Deno.env.get('ELEVENLABS_API_KEY') || '').trim();
  if (!chave || !vozId) return null;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(vozId) + '?output_format=mp3_44100_128', {
      method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: texto, model_id: Deno.env.get('ELEVENLABS_MODELO') || 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } })
    });
    if (!r.ok) { console.log('eleven', r.status, (await r.text()).slice(0, 200)); return null; }
    const mp3 = new Uint8Array(await r.arrayBuffer());
    return { b64: b64(mp3), mime: 'audio/mpeg', segundos: mp3.length / 16000 };   /* 128 kbps */
  } catch (e) { console.log('eleven', String(e).slice(0, 200)); return null; }
}
/** texto (já em forma de fala) → áudio. Gemini TTS por padrão; ElevenLabs se configurado. */
export async function falar(texto: string, v: Voz | string = 'Orus'): Promise<Audio | null> {
  const o: Voz = typeof v === 'string' ? { voz: v } : v;
  const limpo = String(texto || '').replace(/\[\[\s*NOVA\s*\]\]/gi, '\n').replace(/[*_~`#]/g, '').replace(/@(\d{6,})/g, '')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim().slice(0, 1200);
  if (!limpo) return null;
  if (o.provedor === 'elevenlabs' && o.elevenId) { const e = await falarEleven(limpo, o.elevenId); if (e) return e; }
  const chave = (Deno.env.get('GEMINI_API_KEY') || '').trim();
  if (!chave) return null;
  const estilo = String(o.estilo || 'animado, simpático e natural, como um colega de trabalho brasileiro mandando áudio no WhatsApp').slice(0, 200);
  const lista = (await ttsModelos(chave)).filter(m => (semCota.get(m) || 0) < Date.now());
  if (ultimoTTS && lista.includes(ultimoTTS)) lista.splice(lista.indexOf(ultimoTTS), 1), lista.unshift(ultimoTTS);
  for (const m of lista) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
        method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            '# AUDIO PROFILE: Otto\n' +
            '## THE SCENE: um colega de trabalho brasileiro gravando um áudio de WhatsApp para a equipe.\n' +
            "### DIRECTOR'S NOTES\nEstilo: " + estilo + '.\nSotaque: português do Brasil.\nRitmo: de conversa, natural, sem soar como locutor nem robô.\n' +
            'Leia em voz alta SOMENTE o texto da seção TRANSCRIPT. Não leia estas notas.\n\n' +
            '#### TRANSCRIPT\n' + limpo }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voz || 'Orus' } } } }
        })
      });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok) { console.log('tts', m, r.status, String(d?.error?.message || '').slice(0, 200)); if (r.status === 429) semCota.set(m, Date.now() + 15 * 60_000); continue; }
      const p = (d?.candidates?.[0]?.content?.parts || []).find((x: any) => x?.inlineData?.data);
      if (!p) continue;
      const rate = Number(/rate=(\d+)/.exec(String(p.inlineData.mimeType || ''))?.[1] || 24000);
      const pcm = limparPCM(Uint8Array.from(atob(p.inlineData.data), c => c.charCodeAt(0)), rate);
      ultimoTTS = m;
      return { b64: b64(wav(pcm, rate)), mime: 'audio/wav', segundos: pcm.length / 2 / rate };
    } catch (e) { console.log('tts', m, String(e).slice(0, 200)); }
  }
  return null;
}

/* ------------------------------------------------------------ avisos por conta própria */
const APROVOU = /\b(aprovad[oa]s?|aprovo|aprovei|pode (postar|subir|publicar)|gostei( de todos| muito)?|ficou (otimo|top|lindo|perfeito|show|incrivel)|amei|perfeito,? pode)\b/;
export type Aviso = { chave: string; linha: string; marcar?: string | null };
/** junta o que merece aviso agora (sem repetir o que já foi avisado) */
export async function avisosPendentes(sb: SupabaseClient): Promise<Aviso[]> {
  const hoje = hojeISO();
  const amanha = new Date(Date.parse(hoje + 'T12:00:00Z') + 86400_000).toISOString().slice(0, 10);
  const [{ data: ds }, { data: ps }, { data: convs }, { data: cls }] = await Promise.all([
    sb.from('demandas_edicao').select('id, codigo, titulo, prazo, editing_status, videomaker_id, client_id').is('deleted_at', null).not('editing_status', 'in', '(entregue,descartado,standby)').not('prazo', 'is', null).lte('prazo', amanha).gte('prazo', new Date(Date.parse(hoje + 'T12:00:00Z') - 30 * 86400_000).toISOString().slice(0, 10)).limit(200),
    sb.from('perfis').select('id, nome'),
    sb.from('wa_conversas').select('jid, nome, cliente_id, esperando_desde').not('cliente_id', 'is', null).not('esperando_desde', 'is', null)
      .lt('esperando_desde', new Date(Date.now() - 2 * 3600_000).toISOString()).gt('esperando_desde', new Date(Date.now() - 24 * 3600_000).toISOString()).limit(50),
    sb.from('clientes').select('id, nome')
  ]);
  const pessoa = new Map(((ps || []) as any[]).map(p => [p.id, p.nome]));
  const cliente = new Map(((cls || []) as any[]).map(c => [c.id, c.nome]));
  const avisos: Aviso[] = [];
  for (const d of (ds || []) as any[]) {
    const quem = pessoa.get(d.videomaker_id) || null;
    const rot = (d.codigo ? d.codigo + ' · ' : '') + String(d.titulo || '').slice(0, 60) + (cliente.get(d.client_id) ? ' (' + cliente.get(d.client_id) + ')' : '');
    if (d.prazo < hoje) avisos.push({ chave: 'atrasada:' + d.id + ':' + hoje, linha: 'atrasada desde ' + dm(d.prazo) + ': ' + rot, marcar: quem });
    else if (d.prazo === amanha && d.editing_status === 'pendente') avisos.push({ chave: 'amanha:' + d.id, linha: 'vence amanhã e ainda não começou: ' + rot, marcar: quem });
  }
  for (const c of (convs || []) as any[]) {
    const h = Math.round((Date.now() - Date.parse(c.esperando_desde)) / 3600_000);
    avisos.push({ chave: 'espera:' + c.jid + ':' + c.esperando_desde, linha: (cliente.get(c.cliente_id) || c.nome) + ' está esperando resposta há ' + h + 'h', marcar: null });
  }
  /* cliente aprovou alguma coisa nos últimos 40 min */
  const { data: ms } = await sb.from('wa_mensagens').select('id, jid, texto, autor_nome, criada_em').eq('de_mim', false).eq('tipo', 'texto')
    .gte('criada_em', new Date(Date.now() - 40 * 60_000).toISOString()).limit(200);
  const jids = [...new Set(((ms || []) as any[]).map(m => m.jid))];
  if (jids.length) {
    const { data: cv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').in('jid', jids).not('cliente_id', 'is', null);
    const ehCliente = new Map(((cv || []) as any[]).map(c => [c.jid, c]));
    for (const m of (ms || []) as any[]) {
      const c = ehCliente.get(m.jid); if (!c) continue;
      if (APROVOU.test(sem(m.texto))) avisos.push({ chave: 'aprov:' + m.id, linha: (cliente.get(c.cliente_id) || c.nome) + ' disse "' + String(m.texto).slice(0, 80) + '" — parece aprovação. Quer que eu marque como aprovado/entregue?', marcar: null });
    }
  }
  if (!avisos.length) return [];
  /* tira os já avisados */
  const { data: ja } = await sb.from('wa_otto_avisos').select('chave').in('chave', avisos.map(a => a.chave));
  const feitos = new Set(((ja || []) as any[]).map(x => x.chave));
  return avisos.filter(a => !feitos.has(a.chave));
}
export async function marcarAvisados(sb: SupabaseClient, chaves: string[]): Promise<string[]> {
  if (!chaves.length) return [];
  const { data } = await sb.from('wa_otto_avisos').upsert(chaves.map(chave => ({ chave })), { onConflict: 'chave', ignoreDuplicates: true }).select('chave');
  return ((data || []) as any[]).map(x => x.chave);
}

/* ------------------------------------------------------------ resumo do dia */
export async function dadosDoDia(sb: SupabaseClient): Promise<string> {
  const hoje = hojeISO();
  const ini = new Date(Date.parse(hoje + 'T03:00:00Z')).toISOString();   /* 00:00 de Brasília */
  const amanha = new Date(Date.parse(hoje + 'T12:00:00Z') + 86400_000).toISOString().slice(0, 10);
  const [{ data: ms }, { data: entregues }, { data: criadas }, { data: vencem }, { data: atrasadas }, { data: esperando }, { data: cls }, { data: ps }] = await Promise.all([
    sb.from('wa_mensagens').select('jid, de_mim').gte('criada_em', ini).limit(5000),
    sb.from('demandas_edicao').select('codigo, titulo, client_id, videomaker_id').gte('entregue_em', ini).is('deleted_at', null).limit(100),
    sb.from('demandas_edicao').select('codigo, titulo, client_id').gte('created_at', ini).is('deleted_at', null).limit(100),
    sb.from('demandas_edicao').select('codigo, titulo, client_id, videomaker_id, editing_status').eq('prazo', amanha).is('deleted_at', null).not('editing_status', 'in', '(entregue,descartado)').limit(100),
    sb.from('demandas_edicao').select('codigo, titulo, client_id, videomaker_id, prazo').lt('prazo', hoje).is('deleted_at', null).not('editing_status', 'in', '(entregue,descartado,standby)').limit(100),
    sb.from('wa_conversas').select('nome, cliente_id, esperando_desde').not('cliente_id', 'is', null).not('esperando_desde', 'is', null).limit(60),
    sb.from('clientes').select('id, nome'), sb.from('perfis').select('id, nome')
  ]);
  const cliente = new Map(((cls || []) as any[]).map(c => [c.id, c.nome]));
  const pessoa = new Map(((ps || []) as any[]).map(p => [p.id, p.nome]));
  const { data: cv } = await sb.from('wa_conversas').select('jid, nome, cliente_id').not('cliente_id', 'is', null);
  const conv = new Map(((cv || []) as any[]).map(c => [c.jid, c]));
  const porCliente: Record<string, number> = {};
  for (const m of (ms || []) as any[]) if (!m.de_mim && conv.has(m.jid)) { const c = conv.get(m.jid); const n = cliente.get(c.cliente_id) || c.nome; porCliente[n] = (porCliente[n] || 0) + 1; }
  const d = (l: any[] | null, f: (x: any) => string) => ((l || []) as any[]).map(f).join('\n') || '(nenhuma)';
  const rot = (x: any) => '- ' + (x.codigo ? x.codigo + ' · ' : '') + String(x.titulo || '').slice(0, 60) + ' (' + (cliente.get(x.client_id) || '') + ')' + (x.videomaker_id ? ' — ' + (pessoa.get(x.videomaker_id) || '') : '');
  return [
    'DIA: ' + dm(hoje),
    'MENSAGENS DE CLIENTES HOJE (por cliente): ' + (Object.entries(porCliente).sort((a, b) => b[1] - a[1]).map(([n, q]) => n + ' ' + q).join(', ') || 'nenhuma'),
    'DEMANDAS DE VÍDEO ENTREGUES HOJE:\n' + d(entregues, rot),
    'DEMANDAS CRIADAS HOJE:\n' + d(criadas, rot),
    'VENCEM AMANHÃ (ainda abertas):\n' + d(vencem, rot),
    'ATRASADAS:\n' + d(atrasadas, x => rot(x) + ' · prazo ' + dm(x.prazo)),
    'CLIENTES ESPERANDO RESPOSTA AGORA: ' + (((esperando || []) as any[]).map(c => cliente.get(c.cliente_id) || c.nome).join(', ') || 'nenhum')
  ].join('\n\n');
}
export async function escreverResumoDia(nomeOtto: string): Promise<(dados: string) => Promise<string>> {
  return async (dados: string) => {
    const r = await gerar(provedorAtual(n => Deno.env.get(n)), [
      { role: 'system', content: 'Você é ' + nomeOtto + ', assistente da Branding7. Escreva o RESUMO DO DIA para o grupo da equipe no WhatsApp, com base nos dados. Curto e útil: comece com uma frase geral do dia, depois o que foi entregue, o que ficou para amanhã (e o que está atrasado), e quem está esperando resposta. Pode usar uma linha por item quando houver itens. Sem títulos com #, sem negrito em excesso. Termine com uma frase leve de fechamento. Não invente nada. Não assine.' },
      { role: 'user', content: dados }
    ], { maxTokens: 900, temperatura: 0.4, prazoMs: 45000, limpar: (t: string) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim() });
    return r.ok ? r.texto : '';
  };
}
