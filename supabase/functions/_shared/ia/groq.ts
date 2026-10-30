// =====================================================================
// B7 IA — provedor Groq (API compatível com a da OpenAI, chamada direta)
//
// É o ÚNICO arquivo que conhece o Groq. Formato (console.groq.com/docs):
//
//   POST https://api.groq.com/openai/v1/chat/completions
//   cabeçalho  Authorization: Bearer <chave>
//   corpo      { model, messages, temperature, max_completion_tokens, stream }
//   resposta   choices[].message.content, choices[].finish_reason, usage, model
//   fluxo      SSE: data: { choices: [{ delta: { content } }] } ... data: [DONE]
//   erros      401 chave · 404 modelo · 429 limite por minuto/dia · 5xx serviço
//
// SEGREDOS (Supabase → Edge Functions → Secrets):
//   GROQ_API_KEY   chave criada em console.groq.com (camada gratuita)
//   GROQ_MODEL     opcional; sem ele vale o MODELO_PADRAO abaixo
//
// POR QUE. Na camada gratuita o Groq responde em menos de 1 s, onde o
// Gemini gratuito levava de 3 a 15 s (registro de uso, out/2026). Ele
// fica com o texto do dia a dia; quem decide o que vai para cada um é
// duplo.ts.
//
// MODELO. openai/gpt-oss-120b: modelo "de produção" no Groq (os de
// prévia somem sem aviso). Ele raciocina antes de responder; pedimos o
// mínimo (reasoning_effort low) e sem o raciocínio na resposta.
//
// JSON. Não se manda response_format: a tarefa já pede JSON nas
// instruções e quem valida é ela. Se falhar, duplo.ts passa ao Gemini.
// =====================================================================

import type { ErroDoProvedor, PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

export const MODELO_PADRAO = 'openai/gpt-oss-120b';
const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';

type RespostaOpenAI = {
  choices?: { message?: { content?: unknown }; delta?: { content?: unknown }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  model?: string;
  error?: { code?: number | string; type?: string; message?: string } | string;
};

function erroPorStatus(status: number, corpo: RespostaOpenAI | null): ErroDoProvedor {
  const e = corpo && corpo.error;
  const pista = (typeof e === 'string' ? e : e ? String(e.code || '') + ' ' + String(e.type || '') + ' ' + String(e.message || '') : '').toLowerCase();
  if (status === 401 || status === 403) return 'credencial';
  if (status === 404) return 'modelo';
  if (status === 400 || status === 422) return /model_not_found|model .*(not exist|decommissioned)/.test(pista) ? 'modelo' : 'pedido_invalido';
  if (status === 413) return 'pedido_invalido';
  if (status === 429) return /per ?day|daily|\(tpd\)|\(rpd\)/.test(pista) ? 'cota' : 'limite';
  if (status === 408 || status === 504) return 'tempo';
  return 'indisponivel';
}

const conteudo = (v: unknown): string => typeof v === 'string' ? v : '';

/** Cria o provedor a partir dos segredos. null = chave não configurada. */
export function criarGroq(env: (nome: string) => string | undefined, fetchFn: typeof fetch = fetch): Provedor | null {
  const chave = (env('GROQ_API_KEY') || '').trim();
  if (!chave) return null;
  const pedido = (env('GROQ_MODEL') || '').trim();
  const modelo = /^[\w][\w.\-/:]{1,80}$/.test(pedido) ? pedido : MODELO_PADRAO;
  const raciocina = /gpt-oss/.test(modelo);

  const corpoDe = (p: PedidoDeGeracao, fluxo: boolean) => JSON.stringify({
    model: modelo, messages: p.mensagens, temperature: p.temperatura,
    max_completion_tokens: p.maxTokens, stream: fluxo,
    ...(raciocina ? { reasoning_effort: 'low', include_reasoning: false } : {})
  });

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    /* só texto: áudio e imagem ficam com o Gemini */
    if (p.audio || p.imagem) return { ok: false, erro: 'pedido_invalido', status: null };
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    try {
      const r = await fetchFn(URL_GROQ, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
        body: corpoDe(p, false)
      });
      let corpo: RespostaOpenAI | null = null;
      try { corpo = await r.json(); } catch (_e) { corpo = null; }
      if (!r.ok) return { ok: false, erro: erroPorStatus(r.status, corpo), status: r.status };
      if (!corpo) return { ok: false, erro: 'resposta_invalida', status: r.status };

      const c = corpo.choices && corpo.choices[0];
      const fim = (c && c.finish_reason) || '';
      if (fim === 'content_filter') return { ok: false, erro: 'recusado', status: r.status };
      if (fim === 'length') return { ok: false, erro: 'resposta_invalida', status: r.status };
      const texto = conteudo(c && c.message && c.message.content);
      if (!texto.trim()) return { ok: false, erro: 'resposta_invalida', status: r.status };

      const uso = corpo.usage || {};
      return {
        ok: true, texto, modelo: corpo.model || modelo,
        tokensEntrada: typeof uso.prompt_tokens === 'number' ? uso.prompt_tokens : null,
        tokensSaida: typeof uso.completion_tokens === 'number' ? uso.completion_tokens : null
      };
    } catch (e) {
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio);
    }
  }

  /* o texto vai saindo enquanto o modelo escreve (chat) */
  async function gerarFluxo(p: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor> {
    if (p.audio || p.imagem) return { ok: false, erro: 'pedido_invalido', status: null };
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    try {
      const r = await fetchFn(URL_GROQ, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
        body: corpoDe(p, true)
      });
      if (!r.ok || !r.body) {
        let corpo: RespostaOpenAI | null = null;
        try { corpo = await r.json(); } catch (_e) { corpo = null; }
        return { ok: false, erro: r.ok ? 'resposta_invalida' : erroPorStatus(r.status, corpo), status: r.status };
      }
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let resto = '', texto = '', fim = '', modeloVisto = '';
      let ent: number | null = null, sai: number | null = null;
      const linha = (l: string) => {
        if (!l.startsWith('data:')) return;
        const dado = l.slice(5).trim();
        if (!dado || dado === '[DONE]') return;
        let o: RespostaOpenAI;
        try { o = JSON.parse(dado); } catch (_e) { return; }
        const c = o.choices && o.choices[0];
        const pedaco = conteudo(c && c.delta && c.delta.content);
        if (pedaco) { texto += pedaco; aoTrecho(pedaco); }
        if (c && c.finish_reason) fim = c.finish_reason;
        if (o.model) modeloVisto = o.model;
        const u = o.usage || (o.x_groq && o.x_groq.usage);
        if (u) {
          if (typeof u.prompt_tokens === 'number') ent = u.prompt_tokens;
          if (typeof u.completion_tokens === 'number') sai = u.completion_tokens;
        }
      };
      while (true) {
        const { value, done } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const partes = resto.split('\n');
        resto = partes.pop() || '';
        partes.forEach(linha);
      }
      if (resto) linha(resto);
      if (fim === 'content_filter') return { ok: false, erro: 'recusado', status: r.status };
      if (fim === 'length') return { ok: false, erro: 'resposta_invalida', status: r.status };
      if (!texto.trim()) return { ok: false, erro: 'resposta_invalida', status: r.status };
      return { ok: true, texto, modelo: modeloVisto || modelo, tokensEntrada: ent, tokensSaida: sai };
    } catch (e) {
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio);
    }
  }

  return { nome: 'groq', modelo, gerar, gerarFluxo };
}
