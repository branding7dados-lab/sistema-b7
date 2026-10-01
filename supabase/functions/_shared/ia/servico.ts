// =====================================================================
// B7 IA — serviço de geração (a única parte do B7 que fala com o roteador)
//
// Quem usa: as tarefas de IA (hoje, só o assistente de roteiros). Uma
// tarefa monta as mensagens e chama gerar(); não sabe qual modelo nem
// qual provedor respondeu. Trocar de roteador, de modelo ou de provedor
// é mexer em três segredos, não no código das telas.
//
// O roteador é o OmniRoute (github.com/diegosouzapw/OmniRoute), que
// expõe uma API compatível com a da OpenAI:
//   POST {base}/chat/completions   Authorization: Bearer <chave>
//   200 → { choices: [{ message: { content } }], usage, model }
//   401 → chave ausente ou inválida
//   502 → todos os provedores do roteador falharam
// e devolve, em cabeçalhos X-OmniRoute-*, qual modelo/provedor atendeu,
// quantas trocas internas fez, tokens e custo.
// (conferido na documentação do projeto em 01/10/2026: docs/openapi.yaml,
// docs/OMNIROUTE_PROVIDER_FAILOVER.md e docs/getting-started/*)
//
// SEGREDOS (supabase secrets set …) — nenhum vai para o navegador:
//   B7_IA_BASE_URL   endereço público do roteador, terminando em /v1
//   B7_IA_API_KEY    chave de API criada no painel do roteador
//   B7_IA_MODELOS    lista ORDENADA, separada por vírgula, do que o B7
//                    pode pedir: nomes de combos e/ou ids de modelos
//
// POLÍTICA DE CUSTO ZERO desta fase
//   O B7 só pede o que está em B7_IA_MODELOS. Não existe modelo "de
//   reserva" fora da lista e não existe troca para modelo pago: quando a
//   lista acaba, a resposta é uma falha controlada. Quem garante que a
//   lista é gratuita é a configuração do roteador (só provedores
//   gratuitos conectados). Como segunda tranca, se o roteador informar
//   custo maior que zero, isso fica registrado em `custo` para auditoria.
//
// TROCA DE MODELO (fallback), na ordem da lista:
//   troca  → sem resposta, tempo esgotado, 408/425/429, 5xx, modelo
//            desconhecido para o roteador (400/404/422) e resposta vazia
//            ou fora do formato
//   para   → 401/403 (a chave do roteador está errada: nenhum outro
//            modelo resolveria)
//   Uma tentativa por modelo, sem repetição, com prazo total. O roteador
//   ainda faz as trocas internas dele dentro de cada combo.
// =====================================================================

export type Mensagem = { role: 'system' | 'user'; content: string };

export type Tentativa = { modelo: string; erro: string; status: number | null; ms: number };

export type Categoria = 'nao_configurado' | 'credencial' | 'indisponivel' | 'tempo';

export type Sucesso = {
  ok: true; texto: string; ms: number;
  /** o que o B7 pediu (item da lista) */
  modelo: string;
  /** o que de fato atendeu, quando o roteador informa */
  modeloServido: string | null; provedor: string | null;
  tentativas: Tentativa[]; trocasNoRoteador: number | null;
  tokensEntrada: number | null; tokensSaida: number | null; custo: number | null;
};
export type Falha = { ok: false; categoria: Categoria; tentativas: Tentativa[]; ms: number };
export type Resultado = Sucesso | Falha;

export type Config = { baseUrl: string; chave: string; modelos: string[] };

export type Opcoes = {
  maxTokens: number; temperatura: number;
  /** transforma a saída crua em texto utilizável; devolver '' = resposta inválida */
  limpar: (bruto: string) => string;
  tempoPorTentativaMs?: number; prazoTotalMs?: number;
  /** só para teste */
  fetchFn?: typeof fetch;
};

/** Lê a configuração. null = recurso não configurado neste ambiente. */
export function lerConfig(env: (nome: string) => string | undefined): Config | null {
  const baseUrl = (env('B7_IA_BASE_URL') || '').trim().replace(/\/+$/, '');
  const chave = (env('B7_IA_API_KEY') || '').trim();
  const modelos = (env('B7_IA_MODELOS') || '').split(',').map(m => m.trim()).filter(Boolean);
  if (!/^https?:\/\//.test(baseUrl) || !chave || !modelos.length) return null;
  return { baseUrl, chave, modelos: modelos.slice(0, 6) };
}

const numero = (v: string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* O conteúdo pode vir como texto ou como lista de partes, conforme o provedor. */
function textoDaResposta(json: unknown): string {
  const escolha = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0];
  const c = escolha?.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map(p => (typeof p === 'string' ? p : (p && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))).join('');
  }
  return '';
}

const TROCA = new Set([400, 404, 408, 422, 425, 429]);

export async function gerar(cfg: Config | null, mensagens: Mensagem[], op: Opcoes): Promise<Resultado> {
  const inicio = Date.now();
  const tentativas: Tentativa[] = [];
  if (!cfg) return { ok: false, categoria: 'nao_configurado', tentativas, ms: 0 };

  const buscar = op.fetchFn || fetch;
  const porTentativa = op.tempoPorTentativaMs ?? 25_000;
  const prazo = op.prazoTotalMs ?? 50_000;

  for (const modelo of cfg.modelos) {
    const restante = prazo - (Date.now() - inicio);
    if (restante < 3_000) break;
    const t0 = Date.now();
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), Math.min(porTentativa, restante));
    const falhou = (erro: string, status: number | null = null) =>
      tentativas.push({ modelo, erro, status, ms: Date.now() - t0 });

    try {
      const r = await buscar(cfg.baseUrl + '/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.chave },
        body: JSON.stringify({ model: modelo, messages: mensagens, stream: false, temperature: op.temperatura, max_tokens: op.maxTokens })
      });

      if (r.status === 401 || r.status === 403) {
        falhou('credencial', r.status);
        return { ok: false, categoria: 'credencial', tentativas, ms: Date.now() - inicio };
      }
      if (!r.ok) {
        try { await r.body?.cancel(); } catch (_e) { /* nada a liberar */ }
        if (r.status >= 500 || TROCA.has(r.status)) { falhou(r.status === 429 ? 'limite' : r.status >= 500 ? 'provedor' : 'modelo_recusado', r.status); continue; }
        falhou('http', r.status); continue;
      }

      let json: unknown = null;
      try { json = await r.json(); } catch (_e) { falhou('formato', r.status); continue; }
      const texto = op.limpar(textoDaResposta(json));
      if (!texto) { falhou('vazia', r.status); continue; }

      const uso = (json as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage || {};
      const h = r.headers;
      return {
        ok: true, texto, ms: Date.now() - inicio, modelo,
        modeloServido: h.get('x-omniroute-model') || (json as { model?: string }).model || null,
        provedor: h.get('x-omniroute-provider'),
        tentativas, trocasNoRoteador: numero(h.get('x-omniroute-fallback-attempts')),
        tokensEntrada: numero(h.get('x-omniroute-tokens-in')) ?? (typeof uso.prompt_tokens === 'number' ? uso.prompt_tokens : null),
        tokensSaida: numero(h.get('x-omniroute-tokens-out')) ?? (typeof uso.completion_tokens === 'number' ? uso.completion_tokens : null),
        custo: numero(h.get('x-omniroute-response-cost'))
      };
    } catch (e) {
      falhou((e as Error).name === 'AbortError' ? 'tempo' : 'rede');
    } finally {
      clearTimeout(relogio);
    }
  }

  const soTempo = tentativas.length > 0 && tentativas.every(t => t.erro === 'tempo');
  return { ok: false, categoria: soTempo ? 'tempo' : 'indisponivel', tentativas, ms: Date.now() - inicio };
}
