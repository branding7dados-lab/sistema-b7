// =====================================================================
// B7 IA — provedor OmniRoute (roteador de modelos, hospedado pela B7)
//
// É o ÚNICO arquivo que conhece o OmniRoute
// (github.com/diegosouzapw/OmniRoute). Ele expõe uma API compatível com
// a da OpenAI e, por dentro, distribui o pedido entre os provedores que
// estiverem conectados no painel dele. Conferido na documentação do
// projeto (README e docs/openapi.yaml) em 02/10/2026:
//
//   POST {base}/chat/completions      Authorization: Bearer <chave>
//   corpo      { model, messages, stream: false, temperature, max_tokens }
//   resposta   choices[].message.content, choices[].finish_reason, usage, model
//   cabeçalhos X-OmniRoute-Model, X-OmniRoute-Provider,
//              X-OmniRoute-Fallback-Attempts (só quando > 0),
//              X-OmniRoute-Tokens-In, X-OmniRoute-Tokens-Out,
//              X-OmniRoute-Response-Cost (USD)
//   erros      401 chave ausente ou inválida · 502 todos os provedores
//              falharam · 503 nenhum provedor saudável
//
// SEGREDOS (Supabase → Edge Functions → Secrets). Os três juntos ligam
// este provedor; faltando qualquer um, o B7 continua no Gemini direto:
//   OMNIROUTE_URL      endereço público em HTTPS (com ou sem /v1 no fim)
//   OMNIROUTE_API_KEY  chave de API criada no painel do OmniRoute
//   OMNIROUTE_MODEL    o que o B7 pede: nome de um combo ou id de modelo
//
// UMA CHAMADA POR PEDIDO. Quem troca de modelo quando um provedor falha
// é o roteador, dentro do combo; o B7 não repete nem tenta outro nome.
//
// CUSTO ZERO. O B7 só pede OMNIROUTE_MODEL. Quem garante que isso é
// gratuito é o painel do roteador ter só provedores gratuitos no combo.
// Como segunda tranca, o custo que o roteador informar vai para o
// registro de uso (ia_uso.custo): qualquer valor acima de zero aparece.
//
// JSON. Não se manda response_format: nem todo provedor gratuito atrás
// do roteador aceita, e um que recuse derrubaria o pedido. As instruções
// da tarefa já pedem JSON e quem valida é a tarefa, como sempre.
// =====================================================================

import type { ErroDoProvedor, PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

type RespostaOpenAI = {
  choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  error?: { code?: number | string; type?: string; message?: string } | string;
};

const numero = (v: string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* O conteúdo pode vir como texto ou como lista de partes, conforme o provedor. */
function textoDaResposta(corpo: RespostaOpenAI): string {
  const c = corpo.choices && corpo.choices[0] && corpo.choices[0].message ? corpo.choices[0].message.content : null;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map(p => (typeof p === 'string' ? p : (p && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))).join('');
  }
  return '';
}

function erroPorStatus(status: number, corpo: RespostaOpenAI | null): ErroDoProvedor {
  const e = corpo && corpo.error;
  const pista = (typeof e === 'string' ? e : e ? String(e.code || '') + ' ' + String(e.type || '') + ' ' + String(e.message || '') : '').toLowerCase();
  if (status === 401 || status === 403) return 'credencial';
  if (status === 404) return 'modelo';
  if (status === 400 || status === 422) return /model|combo/.test(pista) ? 'modelo' : 'pedido_invalido';
  if (status === 402) return 'cota';
  if (status === 429) return /quota|per ?day|daily|insufficient/.test(pista) ? 'cota' : 'limite';
  if (status === 408 || status === 504) return 'tempo';
  return 'indisponivel';
}

/** Cria o provedor a partir dos segredos. null = OmniRoute não configurado. */
export function criarOmniRoute(env: (nome: string) => string | undefined, fetchFn: typeof fetch = fetch): Provedor | null {
  let base = (env('OMNIROUTE_URL') || '').trim().replace(/\/+$/, '');
  const chave = (env('OMNIROUTE_API_KEY') || '').trim();
  const modelo = (env('OMNIROUTE_MODEL') || '').trim();
  /* só HTTPS: a chave e o texto do cliente passam por esta ligação */
  if (!/^https:\/\/[^\s/]+/.test(base) || !chave || !/^[\w][\w.\-/:]{0,80}$/.test(modelo)) return null;
  if (!/\/v1$/.test(base)) base += '/v1';

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    /* zzz126: o roteador só leva texto; pedido com áudio não é atendido aqui */
    if (p.audio || p.imagem) return { ok: false, erro: 'pedido_invalido', status: null };
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), p.prazoMs);
    try {
      const r = await fetchFn(base + '/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + chave },
        body: JSON.stringify({ model: modelo, messages: p.mensagens, stream: false, temperature: p.temperatura, max_tokens: p.maxTokens })
      });

      let corpo: RespostaOpenAI | null = null;
      try { corpo = await r.json(); } catch (_e) { corpo = null; }
      if (!r.ok) return { ok: false, erro: erroPorStatus(r.status, corpo), status: r.status };
      if (!corpo) return { ok: false, erro: 'resposta_invalida', status: r.status };

      const fim = (corpo.choices && corpo.choices[0] && corpo.choices[0].finish_reason) || '';
      if (fim === 'content_filter') return { ok: false, erro: 'recusado', status: r.status };
      /* cortado no limite de tokens: uma sugestão pela metade não serve */
      if (fim === 'length') return { ok: false, erro: 'resposta_invalida', status: r.status };

      const texto = textoDaResposta(corpo);
      if (!texto.trim()) return { ok: false, erro: 'resposta_invalida', status: r.status };

      const h = r.headers;
      const uso = corpo.usage || {};
      return {
        ok: true, texto,
        modelo: h.get('x-omniroute-model') || corpo.model || modelo,
        servidoPor: h.get('x-omniroute-provider'),
        trocas: numero(h.get('x-omniroute-fallback-attempts')),
        custo: numero(h.get('x-omniroute-response-cost')),
        tokensEntrada: numero(h.get('x-omniroute-tokens-in')) ?? (typeof uso.prompt_tokens === 'number' ? uso.prompt_tokens : null),
        tokensSaida: numero(h.get('x-omniroute-tokens-out')) ?? (typeof uso.completion_tokens === 'number' ? uso.completion_tokens : null)
      };
    } catch (e) {
      return { ok: false, erro: (e as Error).name === 'AbortError' ? 'tempo' : 'indisponivel', status: null };
    } finally {
      clearTimeout(relogio);
    }
  }

  return { nome: 'omniroute', modelo, gerar };
}
