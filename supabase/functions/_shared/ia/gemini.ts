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
//   GEMINI_MODELO_RAPIDO  opcional; padrão gemini-3.5-flash ("nenhum" desliga)
//
// 4.4.4 — MODELO RÁPIDO NA FRENTE. Medido em 05/11/2026 com a mesma
// revisão de legenda (395 tokens de entrada, ~330 de saída): o Flash-Lite
// levou de 13 a 33 s, o Flash de 2,4 a 4,4 s. Cada pedido tenta primeiro
// o rápido; se ele responder "sobrecarregado", "limite/cota" ou "modelo
// indisponível", ou travar sem mandar nada, o MESMO pedido vai para o
// modelo padrão (o de antes). Recusa por conteúdo e pedido inválido não
// mudam de modelo.
//
// MODELO. gemini-3.5-flash-lite: na página de preços aparece como
// "Free of charge" na camada gratuita e, na de modelos, como o mais
// rápido e econômico da linha 3.5 — o que este recurso pede (reescrever
// trechos curtos em português, com pouca espera). Um modelo maior não
// melhora "encurte esta fala" e gasta a cota mais rápido.
//
// CAMADA GRATUITA. Este arquivo não liga cobrança: uma chave, e dois
// modelos da mesma chave (o rápido na frente, o padrão de reserva). Quando o Google responde que o
// limite ou a cota acabou, isso sobe como 'limite' ou 'cota' e a pessoa
// vê um aviso — nada é tentado de novo, para não gastar mais cota.
// Cobrança só existe se alguém ativar o faturamento do projeto no
// Google; com faturamento desligado, a cota esgotada apenas recusa.
// =====================================================================

import type { ErroDoProvedor, PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

export const MODELO_PADRAO = 'gemini-3.5-flash-lite';
export const MODELO_RAPIDO = 'gemini-3.5-flash';
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
  const rapidoPedido = (env('GEMINI_MODELO_RAPIDO') || '').trim();
  const rapido = rapidoPedido === 'nenhum' ? null
    : /^[a-z0-9][a-z0-9.\-]{2,60}$/.test(rapidoPedido) ? rapidoPedido : MODELO_RAPIDO;
  /* a ordem de tentativa: o rápido (se houver e for outro) e depois o padrão */
  const ordem = rapido && rapido !== modelo ? [rapido, modelo] : [modelo];
  /* erros em que vale tentar o outro modelo */
  const TROCA = new Set(['indisponivel', 'limite', 'cota', 'modelo', 'sem_inicio']);

  /* zzz300: os modelos 3.x "pensam" antes de responder; para reescrever
     um trecho isso é só espera. Pedimos o mínimo. Se este modelo não
     aceitar o ajuste (400 falando de thinking), o pedido sai de novo sem
     ele e não se tenta mais nesta instância. GEMINI_THINKING=padrao desliga. */
  const pensarDesligado = (env('GEMINI_THINKING') || '').trim() === 'padrao';
  const naoAceitaPensar = new Set<string>();   /* modelos que recusaram o ajuste */
  const pensarPouco = (m: string) => !pensarDesligado && !naoAceitaPensar.has(m);
  const pensar = (m: string) => pensarPouco(m) ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {};
  const recusouPensar = (m: string, status: number, corpo: RespostaGemini | null) => {
    const e = (corpo && corpo.error) || {};
    return pensarPouco(m) && status === 400 && /think/i.test(String(e.message || ''));
  };

  async function gerarCom(m: string, p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    const r = await gerarUma(m, p);
    if (!r.ok && r.erro === 'sem_pensar') { naoAceitaPensar.add(m); return (await gerarUma(m, p)) as RespostaDoProvedor; }
    return r as RespostaDoProvedor;
  }

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    const t0 = Date.now();
    let r: RespostaDoProvedor = { ok: false, erro: 'indisponivel', status: null } as RespostaDoProvedor;
    for (let i = 0; i < ordem.length; i++) {
      const sobra = p.prazoMs - (Date.now() - t0);
      if (i > 0 && sobra < 4000) break;
      r = await gerarCom(ordem[i], i ? { ...p, prazoMs: sobra } : p);
      if (r.ok || !TROCA.has(String(r.erro))) return r;
      if (i + 1 < ordem.length) console.error('[b7-ia] gemini ' + ordem[i] + ': ' + r.erro + '; tentando ' + ordem[i + 1]);
    }
    return r;
  }

  async function gerarUma(modelo: string, p: PedidoDeGeracao): Promise<RespostaDoProvedor | { ok: false; erro: 'sem_pensar'; status: number }> {
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
          contents: [{ role: 'user', parts: [{ text: usuario },
            ...(p.audio ? [{ inlineData: { mimeType: p.audio.mime, data: p.audio.base64 } }] : []),
            ...(p.imagem ? [{ inlineData: { mimeType: p.imagem.mime, data: p.imagem.base64 } }] : [])] }],
          generationConfig: {
            temperature: p.temperatura, maxOutputTokens: p.maxTokens, ...pensar(modelo),
            ...(p.json ? { responseMimeType: 'application/json' } : {}),
            /* resposta estruturada: prende o JSON ao formato pedido (sem
               campo inventado nem texto em volta) */
            ...(p.json && p.esquema ? { responseSchema: p.esquema } : {})
          }
        })
      });

      let corpo: RespostaGemini | null = null;
      try { corpo = await r.json(); } catch (_e) { corpo = null; }
      if (!r.ok && recusouPensar(modelo, r.status, corpo)) return { ok: false, erro: 'sem_pensar', status: r.status };
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
  /* zzz308: às vezes o Google aceita o pedido e não manda nada (ficava 30 s
     parado e dava "tempo esgotado" — 6 vezes seguidas num dia). Normalmente
     o primeiro pedaço chega em 1–2 s; se em GEMINI_PRIMEIRO_MS (padrão 8 s)
     não chegou nada, aquela ligação é largada e o MESMO pedido vai de novo,
     uma vez, com o tempo que sobrar. */
  const primeiroMs = Number(env('GEMINI_PRIMEIRO_MS')) || 8000;
  async function gerarFluxo(p: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor> {
    const t0 = Date.now();
    /* 1ª ligação: o modelo rápido (ou o único). Se travar sem mandar nada,
       ou responder sobrecarregado/limite, a 2ª vai para o modelo padrão
       (ou de novo para o mesmo, quando só há um), com o tempo que sobrar.
       Só se tenta a troca enquanto nenhum texto saiu para a tela. */
    let saiuTexto = false;
    const ouvir = (t: string) => { saiuTexto = true; aoTrecho(t); };
    const um = async (m: string, pp: PedidoDeGeracao, inicio: number) => {
      let r = await fluxoUm(m, pp, ouvir, inicio);
      if (!r.ok && r.erro === 'sem_pensar') { naoAceitaPensar.add(m); r = await fluxoUm(m, pp, ouvir, inicio); }
      return r;
    };
    let r = await um(ordem[0], p, primeiroMs);
    if (!r.ok && !saiuTexto && TROCA.has(String(r.erro))) {
      const segundo = ordem[1] || ordem[0];
      const sobra = p.prazoMs - (Date.now() - t0);
      console.error('[b7-ia] gemini ' + ordem[0] + ': ' + r.erro + '; pedindo de novo em ' + segundo);
      if (sobra < 4000) return { ok: false, erro: 'tempo', status: null };
      r = await um(segundo, { ...p, prazoMs: sobra }, sobra);
    }
    if (!r.ok && (r.erro === 'sem_inicio' || r.erro === 'sem_pensar')) return { ok: false, erro: 'tempo', status: null };
    return r as RespostaDoProvedor;
  }

  async function fluxoUm(modelo: string, p: PedidoDeGeracao, aoTrecho: (texto: string) => void, inicioMs: number):
    Promise<RespostaDoProvedor | { ok: false; erro: 'sem_pensar'; status: number } | { ok: false; erro: 'sem_inicio'; status: null }> {
    const sistema = p.mensagens.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const usuario = p.mensagens.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    /* nada chegou ainda? larga esta ligação (gerarFluxo pede de novo) */
    let comecou = false, largou = false;
    const vigia = setTimeout(() => { if (!comecou) { largou = true; ctrl.abort(); } }, Math.min(inicioMs, p.prazoMs));
    try {
      const r = await fetchFn(BASE + modelo + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: usuario },
            ...(p.imagem ? [{ inlineData: { mimeType: p.imagem.mime, data: p.imagem.base64 } }] : [])] }],
          generationConfig: { temperature: p.temperatura, maxOutputTokens: p.maxTokens, ...pensar(modelo) }
        })
      });
      if (!r.ok || !r.body) {
        let corpo: RespostaGemini | null = null;
        try { corpo = await r.json(); } catch (_e) { corpo = null; }
        if (!r.ok && recusouPensar(modelo, r.status, corpo)) return { ok: false, erro: 'sem_pensar', status: r.status };
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
        comecou = true;   /* o Google respondeu: daqui em diante vale o prazo inteiro */
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
      if (largou) return { ok: false, erro: 'sem_inicio', status: null };
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio); clearTimeout(vigia);
    }
  }

  return { nome: 'gemini', modelo: ordem[0], gerar, gerarFluxo };
}
