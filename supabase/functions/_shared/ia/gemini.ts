// =====================================================================
// B7 IA — provedor Gemini (API do Google Gemini, chamada direta)
//
// É o ÚNICO arquivo que conhece o Google. Conferido na documentação
// oficial (ai.google.dev) em 01/10/2026:
//
//   POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent
//   cabeçalho  x-goog-api-key: <chave>
//   corpo      { systemInstruction, contents: [{ role, parts: [{ text }] }],
//                generationConfig: { temperature, maxOutputTokens,
//                                    responseMimeType (só quando se pede JSON),
//                                    responseSchema (quando a tarefa manda o formato) } }
//   resposta   candidates[].content.parts[].text, candidates[].finishReason,
//              promptFeedback.blockReason, usageMetadata, modelVersion
//   erros      401/403 chave · 404 modelo · 429 limite por minuto OU cota
//              diária · 500/503/504 serviço
//
// SEGREDOS (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   chave criada no Google AI Studio (aistudio.google.com/apikey)
//   GEMINI_MODEL     opcional; sem ele vale o MODELO_PADRAO abaixo
//
// MODELO. gemini-3.5-flash-lite: na página de preços aparece como
// "Free of charge" na camada gratuita e, na de modelos, como o mais
// rápido e econômico da linha 3.5 — o que este recurso pede (reescrever
// trechos curtos em português, com pouca espera). Um modelo maior não
// melhora "encurte esta fala" e gasta a cota mais rápido.
//
// CAMADA GRATUITA. Este arquivo não liga cobrança nem tem modelo pago
// "de reserva": uma chave, um modelo. Quando o Google responde que o
// limite ou a cota acabou, isso sobe como 'limite' ou 'cota' e a pessoa
// vê um aviso — nada é tentado de novo, para não gastar mais cota.
// Cobrança só existe se alguém ativar o faturamento do projeto no
// Google; com faturamento desligado, a cota esgotada apenas recusa.
// =====================================================================

import type { ErroDoProvedor, PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

export const MODELO_PADRAO = 'gemini-3.5-flash-lite';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

type ParteGemini = { text?: string; thought?: boolean };
type RespostaGemini = {
  candidates?: { content?: { parts?: ParteGemini[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
  error?: { code?: number | string; status?: string; message?: string };
};

/* Motivos de término em que o Google parou por conta do conteúdo. */
const RECUSA = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'LANGUAGE', 'IMAGE_SAFETY']);

function erroPorStatus(status: number, corpo: RespostaGemini | null): ErroDoProvedor {
  const e = (corpo && corpo.error) || {};
  const pista = (String(e.code || '') + ' ' + String(e.status || '') + ' ' + String(e.message || '')).toLowerCase();
  if (status === 401 || status === 403) return 'credencial';
  /* chave inválida também pode vir como 400 */
  if (status === 400) return /api[ _-]?key|authentication/.test(pista) ? 'credencial' : 'pedido_invalido';
  if (status === 404) return 'modelo';
  /* 402 = crédito pré-pago esgotado: para a pessoa, é cota */
  if (status === 402) return 'cota';
  if (status === 429) {
    /* dois 429 diferentes: por minuto (passa logo) e cota do dia (só amanhã) */
    return /quota_exceeded|per ?day|daily|perday/.test(pista) ? 'cota' : 'limite';
  }
  if (status === 408 || status === 504) return 'tempo';
  return 'indisponivel';
}

/** Cria o provedor a partir dos segredos. null = chave não configurada. */
export function criarGemini(env: (nome: string) => string | undefined, fetchFn: typeof fetch = fetch): Provedor | null {
  const chave = (env('GEMINI_API_KEY') || '').trim();
  if (!chave) return null;
  const pedido = (env('GEMINI_MODEL') || '').trim();
  const modelo = /^[a-z0-9][a-z0-9.\-]{2,60}$/.test(pedido) ? pedido : MODELO_PADRAO;

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    const sistema = p.mensagens.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const usuario = p.mensagens.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    try {
      const r = await fetchFn(BASE + modelo + ':generateContent', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: usuario }] }],
          generationConfig: {
            temperature: p.temperatura, maxOutputTokens: p.maxTokens,
            ...(p.json ? { responseMimeType: 'application/json' } : {}),
            /* resposta estruturada: prende o JSON ao formato pedido (sem
               campo inventado nem texto em volta) */
            ...(p.json && p.esquema ? { responseSchema: p.esquema } : {})
          }
        })
      });

      let corpo: RespostaGemini | null = null;
      try { corpo = await r.json(); } catch (_e) { corpo = null; }
      if (!r.ok) return { ok: false, erro: erroPorStatus(r.status, corpo), status: r.status };
      if (!corpo) return { ok: false, erro: 'resposta_invalida', status: r.status };

      if (corpo.promptFeedback && corpo.promptFeedback.blockReason) return { ok: false, erro: 'recusado', status: r.status };
      const c = corpo.candidates && corpo.candidates[0];
      const fim = (c && c.finishReason) || '';
      if (RECUSA.has(fim)) return { ok: false, erro: 'recusado', status: r.status };
      /* cortado no limite de tokens: uma sugestão pela metade não serve */
      if (fim === 'MAX_TOKENS') return { ok: false, erro: 'resposta_invalida', status: r.status };

      const texto = ((c && c.content && c.content.parts) || [])
        .filter(x => x && !x.thought && typeof x.text === 'string').map(x => x.text).join('');
      if (!texto.trim()) return { ok: false, erro: 'resposta_invalida', status: r.status };

      const uso = corpo.usageMetadata || {};
      return {
        ok: true, texto, modelo: corpo.modelVersion || modelo,
        tokensEntrada: typeof uso.promptTokenCount === 'number' ? uso.promptTokenCount : null,
        tokensSaida: typeof uso.candidatesTokenCount === 'number' ? uso.candidatesTokenCount : null
      };
    } catch (e) {
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio);
    }
  }

  /* zzz123 — a mesma chamada, em fluxo (streamGenerateContent, SSE): o
     texto chega em pedaços e vai sendo repassado. As regras do fim são
     as de gerar(): recusa, corte por limite de tokens e resposta vazia
     continuam sendo erro, mesmo que parte do texto já tenha saído. */
  async function gerarFluxo(p: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor> {
    const sistema = p.mensagens.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const usuario = p.mensagens.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    try {
      const r = await fetchFn(BASE + modelo + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: usuario }] }],
          generationConfig: { temperature: p.temperatura, maxOutputTokens: p.maxTokens }
        })
      });
      if (!r.ok || !r.body) {
        let corpo: RespostaGemini | null = null;
        try { corpo = await r.json(); } catch (_e) { corpo = null; }
        return { ok: false, erro: r.ok ? 'resposta_invalida' : erroPorStatus(r.status, corpo), status: r.status };
      }

      const leitor = r.body.getReader(), dec = new TextDecoder();
      let resto = '', texto = '', fim = '', versao = '', bloqueio = false;
      let uso: { promptTokenCount?: number; candidatesTokenCount?: number } = {};
      const tratar = (linha: string) => {
        if (!linha.startsWith('data:')) return;
        const dado = linha.slice(5).trim();
        if (!dado || dado === '[DONE]') return;
        let j: RespostaGemini | null = null;
        try { j = JSON.parse(dado); } catch (_e) { return; }
        if (!j) return;
        if (j.promptFeedback && j.promptFeedback.blockReason) bloqueio = true;
        if (j.usageMetadata) uso = j.usageMetadata;
        if (j.modelVersion) versao = j.modelVersion;
        const c = j.candidates && j.candidates[0];
        if (!c) return;
        if (c.finishReason) fim = c.finishReason;
        const pedaco = ((c.content && c.content.parts) || [])
          .filter(x => x && !x.thought && typeof x.text === 'string').map(x => x.text).join('');
        if (pedaco) { texto += pedaco; try { aoTrecho(pedaco); } catch (_e) { /* quem ouve não derruba a geração */ } }
      };
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const linhas = resto.split(/\r?\n/);
        resto = linhas.pop() || '';
        linhas.forEach(tratar);
      }
      if (resto) tratar(resto);

      if (bloqueio || RECUSA.has(fim)) return { ok: false, erro: 'recusado', status: r.status };
      if (fim === 'MAX_TOKENS') return { ok: false, erro: 'resposta_invalida', status: r.status };
      if (!texto.trim()) return { ok: false, erro: 'resposta_invalida', status: r.status };
      return {
        ok: true, texto, modelo: versao || modelo,
        tokensEntrada: typeof uso.promptTokenCount === 'number' ? uso.promptTokenCount : null,
        tokensSaida: typeof uso.candidatesTokenCount === 'number' ? uso.candidatesTokenCount : null
      };
    } catch (e) {
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio);
    }
  }

  return { nome: 'gemini', modelo, gerar, gerarFluxo };
}
