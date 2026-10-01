// =====================================================================
// B7 IA — porta de entrada das funções de IA do Sistema B7
//
//   tela (B7.IA.pedir)
//     → esta função: sessão, permissão, limite de uso, registro
//       → tarefa (_shared/ia/roteiro.ts): valida o pedido, carrega o
//         contexto com o RLS da pessoa e monta as instruções
//         → serviço (_shared/ia/servico.ts): roteador, modelos gratuitos,
//           troca de modelo, prazo
//
// O navegador nunca fala com o roteador nem com provedor de IA, e nunca
// manda prompt: pede uma tarefa conhecida. Hoje existe uma: "roteiro".
// Uma tarefa nova entra como mais um arquivo em _shared/ia/ e mais um
// caso aqui — sem tela nova, sem chave nova.
//
// Corpo:  { tarefa: 'roteiro', acao, cena_id, texto, cena_inteira?, instrucao? }
// Resposta de produto (HTTP 200):
//   { ok: true, texto }
//   { ok: false, categoria }   categoria ∈ entrada_invalida | nao_encontrado
//                              | limite | ocupado | indisponivel | tempo
// Sessão e permissão respondem 401 / 403 com { ok: false, categoria }.
// A resposta nunca traz nome de modelo, de provedor nem erro cru: isso
// fica em public.ia_uso, que só o servidor lê.
//
// Segredos: B7_IA_BASE_URL, B7_IA_API_KEY, B7_IA_MODELOS (ver servico.ts).
// Sem eles a função responde "indisponivel" — o resto do B7 não depende
// dela para nada.
//
// Deploy:  supabase functions deploy b7-ia
// =====================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gerar, lerConfig, type Resultado } from '../_shared/ia/servico.ts';
import { carregarContexto, limparSaida, montarMensagens, validar } from '../_shared/ia/roteiro.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* Limites por pessoa. Folgados para quem está escrevendo de verdade
   (várias tentativas seguidas numa cena), apertados para um laço
   acidental ou abuso: os modelos gratuitos têm cota. */
const LIMITE = { porMinuto: 8, porHora: 80, simultaneos: 2, corpo: 20_000 };

async function dentroDoLimite(sb: SupabaseClient, perfilId: string): Promise<'ok' | 'limite' | 'ocupado'> {
  const agora = Date.now();
  const desde = (ms: number) => new Date(agora - ms).toISOString();
  const { data } = await sb.from('ia_uso').select('created_at, status')
    .eq('perfil_id', perfilId).gte('created_at', desde(3_600_000)).order('created_at', { ascending: false }).limit(LIMITE.porHora + 5);
  const linhas = data || [];
  const noMinuto = linhas.filter(l => l.created_at >= desde(60_000));
  if (noMinuto.filter(l => l.status === 'andamento' && l.created_at >= desde(75_000)).length >= LIMITE.simultaneos) return 'ocupado';
  if (noMinuto.length >= LIMITE.porMinuto || linhas.length >= LIMITE.porHora) return 'limite';
  return 'ok';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, categoria: 'entrada_invalida' }, 405);

  /* ---- sessão: quem é, conferido no servidor ---- */
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: quem } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  const user = quem && quem.user;
  if (!user) return json({ ok: false, categoria: 'sessao' }, 401);

  /* ---- a IA é ferramenta da equipe: cliente do Portal não usa ---- */
  const { data: perfil } = await sb.from('perfis').select('id, estado, papel').eq('id', user.id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa' || perfil.papel === 'cliente') return json({ ok: false, categoria: 'sem_permissao' }, 403);

  /* ---- pedido ---- */
  const bruto = await req.text();
  if (bruto.length > LIMITE.corpo) return json({ ok: false, categoria: 'entrada_invalida' });
  let corpo: Record<string, unknown> = {};
  try { corpo = JSON.parse(bruto); } catch (_e) { return json({ ok: false, categoria: 'entrada_invalida' }); }
  if (corpo.tarefa !== 'roteiro') return json({ ok: false, categoria: 'entrada_invalida' });
  const v = validar(corpo);
  if (!v.ok) return json({ ok: false, categoria: 'entrada_invalida' });
  const pedido = v.pedido;

  /* ---- sem roteador configurado: recurso indisponível, sem custo nenhum ---- */
  const cfg = lerConfig(n => Deno.env.get(n));
  if (!cfg) return json({ ok: false, categoria: 'indisponivel' });

  /* ---- limite de uso ---- */
  const limite = await dentroDoLimite(sb, perfil.id);
  if (limite !== 'ok') return json({ ok: false, categoria: limite });

  /* ---- permissão sobre ESTA cena: o RLS da própria pessoa decide ---- */
  const sbDaPessoa = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false }
  });
  const ctx = await carregarContexto(sbDaPessoa, pedido.cenaId);
  if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });

  /* ---- registro: metadados, nunca o texto do roteiro nem a sugestão ---- */
  const { data: reg } = await sb.from('ia_uso').insert({
    perfil_id: perfil.id, recurso: 'roteiro', acao: pedido.acao,
    entidade_tipo: 'cena', entidade_id: pedido.cenaId, tamanho_entrada: pedido.texto.length
  }).select('id').maybeSingle();

  let r: Resultado;
  try {
    r = await gerar(cfg, montarMensagens(pedido, ctx), { maxTokens: 900, temperatura: 0.7, limpar: limparSaida });
  } catch (_e) {
    r = { ok: false, categoria: 'indisponivel', tentativas: [], ms: 0 };
  }

  if (reg) {
    await sb.from('ia_uso').update(r.ok ? {
      status: 'ok', duracao_ms: r.ms, modelo: r.modeloServido || r.modelo, provedor: r.provedor,
      tentativas: r.tentativas, houve_fallback: r.tentativas.length > 0 || (r.trocasNoRoteador || 0) > 0,
      tokens_entrada: r.tokensEntrada, tokens_saida: r.tokensSaida, custo: r.custo, tamanho_saida: r.texto.length
    } : {
      status: 'erro', erro_categoria: r.categoria, duracao_ms: r.ms,
      tentativas: r.tentativas, houve_fallback: r.tentativas.length > 1
    }).eq('id', reg.id);
  }

  if (r.ok) return json({ ok: true, texto: r.texto });
  /* chave do roteador errada é problema de configuração: para a pessoa, "indisponível" */
  return json({ ok: false, categoria: r.categoria === 'tempo' ? 'tempo' : 'indisponivel' });
});
