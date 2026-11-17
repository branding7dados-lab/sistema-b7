// =====================================================================
// Geração de imagem do Otto (4.58.8)
// "Otto, gera uma imagem de ..." no WhatsApp → modelo de imagem do Gemini
// (a mesma GEMINI_API_KEY da IA de texto). Aceita imagens de referência
// (a foto citada, a logo do cliente) para editar/compor em cima delas.
//
// O modelo: GEMINI_MODELO_IMAGEM, se existir; senão o primeiro modelo
// "*-image*" que a conta enxerga (lista do Google, guardada por 6 h),
// na ordem de preferência abaixo. Assim um modelo novo entra sozinho.
// =====================================================================

const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const PREFERIDOS = ['gemini-3-pro-image', 'gemini-3.5-flash-image', 'gemini-3-flash-image', 'gemini-2.5-flash-image'];

export type Ref = { mime: string; b64: string };
export type Formato = '1:1' | '4:5' | '9:16' | '16:9';
export type Resultado = { ok: true; b64: string; mime: string; modelo: string } | { ok: false; erro: 'sem_chave' | 'sem_modelo' | 'cota' | 'faturamento' | 'recusado' | 'falhou'; detalhe?: string };

let cache: { em: number; modelos: string[] } | null = null;

async function modelosDeImagem(chave: string): Promise<string[]> {
  const fixo = (Deno.env.get('GEMINI_MODELO_IMAGEM') || '').trim();
  if (fixo) return [fixo];
  if (cache && Date.now() - cache.em < 6 * 3600_000) return cache.modelos;
  const todos: string[] = [];
  try {
    let token = '';
    for (let i = 0; i < 5; i++) {
      const r = await fetch(BASE + 'models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), { headers: { 'x-goog-api-key': chave }, signal: AbortSignal.timeout(10000) });
      const d = await r.json().catch(() => ({}));
      for (const m of d.models || []) {
        const nome = String(m.name || '').replace(/^models\//, '');
        if (/image/i.test(nome) && !/^imagen/i.test(nome) && (m.supportedGenerationMethods || []).includes('generateContent')) todos.push(nome);
      }
      token = d.nextPageToken || ''; if (!token) break;
    }
  } catch (_e) { /* sem lista: usa a preferência */ }
  const nota = (n: string) => { const i = PREFERIDOS.findIndex(p => n.startsWith(p)); return (i < 0 ? 50 : i) + (/preview|exp/.test(n) ? 0.5 : 0); };
  const lista = todos.length ? todos.sort((a, b) => nota(a) - nota(b)) : PREFERIDOS.map(p => p === 'gemini-3-pro-image' ? 'gemini-3-pro-image-preview' : p);
  cache = { em: Date.now(), modelos: lista.slice(0, 4) };
  return cache.modelos;
}

export async function gerarImagem(pedido: string, refs: Ref[] = [], formato: Formato = '1:1'): Promise<Resultado> {
  const chave = (Deno.env.get('GEMINI_API_KEY') || '').trim();
  if (!chave) return { ok: false, erro: 'sem_chave' };
  const modelos = await modelosDeImagem(chave);
  if (!modelos.length) return { ok: false, erro: 'sem_modelo' };
  const instr = 'Você cria imagens para uma agência de marketing (posts, stories, anúncios, referências visuais). ' +
    'Qualidade profissional, composição limpa, boa luz. Qualquer texto escrito NA imagem deve estar em português do Brasil e sem erros de ortografia; ' +
    'só coloque texto na imagem se o pedido pedir. Se vierem imagens junto, use-as como base ou referência, como o pedido disser.';
  let ultimo: Resultado = { ok: false, erro: 'falhou' };
  for (const modelo of modelos) {
    try {
      const r = await fetch(BASE + 'models/' + modelo + ':generateContent', {
        method: 'POST', signal: AbortSignal.timeout(120000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instr }] },
          contents: [{ role: 'user', parts: [{ text: pedido }, ...refs.slice(0, 3).map(x => ({ inlineData: { mimeType: x.mime, data: x.b64 } }))] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: formato } }
        })
      });
      const d = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        const msg = String(d?.error?.message || '').slice(0, 300);
        console.log('imagem', modelo, r.status, msg);
        if (r.status === 429) ultimo = { ok: false, erro: /limit: 0|billing/i.test(msg) ? 'faturamento' : 'cota', detalhe: msg };
        else if (r.status === 400 && /billing|paid/i.test(msg)) ultimo = { ok: false, erro: 'faturamento', detalhe: msg };
        else ultimo = { ok: false, erro: 'falhou', detalhe: r.status + ' ' + msg };
        continue;
      }
      if (d?.promptFeedback?.blockReason) return { ok: false, erro: 'recusado' };
      const partes = d?.candidates?.[0]?.content?.parts || [];
      const img = partes.find((p: any) => p?.inlineData?.data);
      if (img) return { ok: true, b64: img.inlineData.data, mime: img.inlineData.mimeType || 'image/png', modelo };
      const fim = String(d?.candidates?.[0]?.finishReason || '');
      if (/SAFETY|PROHIBITED|IMAGE_SAFETY|RECITATION/.test(fim)) return { ok: false, erro: 'recusado' };
      ultimo = { ok: false, erro: 'falhou', detalhe: 'sem imagem (' + fim + ')' };
    } catch (e) {
      console.log('imagem', modelo, String(e).slice(0, 200));
      ultimo = { ok: false, erro: 'falhou', detalhe: String(e).slice(0, 200) };
    }
  }
  return ultimo;
}

/** formato pedido em texto ("story", "vertical", "banner"...) */
export function formatoDoTexto(n: string): Formato {
  if (/story|stories|reels?|vertical|9 ?[:x] ?16|tela cheia/.test(n)) return '9:16';
  if (/banner|capa|horizontal|youtube|thumb|16 ?[:x] ?9|paisagem/.test(n)) return '16:9';
  if (/feed|4 ?[:x] ?5|retrato/.test(n)) return '4:5';
  return '1:1';
}
