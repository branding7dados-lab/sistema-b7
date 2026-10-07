// =====================================================================
// B7 IA — porta de entrada das funções de IA do Sistema B7
//
//   tela (B7.IA.pedir)
//     → esta função: sessão, permissão, limite de uso, registro
//       → tarefa (_shared/ia/roteiro.ts): valida o pedido, carrega o
//         contexto com o RLS da pessoa e monta as instruções
//         → serviço (_shared/ia/servico.ts)
//           → provedor (_shared/ia/omniroute.ts ou gemini.ts, conforme os segredos)
//
// O navegador nunca fala com provedor de IA e nunca manda prompt: pede
// uma tarefa conhecida. Hoje existem duas: "roteiro" (uma cena) e
// "linha" (linha editorial: estratégia, pilares, conteúdos). Uma tarefa
// nova entra como mais um arquivo em _shared/ia/ e mais um caso aqui —
// sem tela nova, sem chave nova.
//
// Corpo:  { tarefa: 'roteiro', acao, cena_id, texto, cena_inteira?, instrucao? }
//         { tarefa: 'linha', operacao, linha_id, … }   (ver _shared/ia/linha.ts)
//         { tarefa: 'analise', operacao, roteiro_id }  (ver _shared/ia/analise.ts)
//         { tarefa: 'resumo', operacao, status_id | cliente_id+ano+mes }  (ver _shared/ia/resumo.ts)
// Resposta de produto (HTTP 200), no formato do B7 — a tela não conhece
// o formato do provedor:
//   { ok: true, texto, id }    um campo de texto
//   { ok: true, itens, id }    uma lista (pilares, conteúdos, observações)
//   { ok: false, categoria }   categoria ∈ entrada_invalida | nao_encontrado
//                              | contexto | limite | ocupado | cota | tempo
//                              | recusado | indisponivel
// Sessão e permissão respondem 401 / 403 com { ok: false, categoria }.
// A resposta nunca traz nome de modelo, de provedor nem erro cru: isso
// fica em public.ia_uso, que só o servidor lê.
//
// Segredos: GEMINI_API_KEY (ver gemini.ts) ou os três OMNIROUTE_* (ver
// omniroute.ts). Sem nenhum, a função responde "indisponivel" — o resto
// do B7 não depende dela para nada.
//
// Deploy:  supabase functions deploy b7-ia --no-verify-jwt
// (a sessão é conferida aqui dentro, com auth.getUser)
// =====================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { comCors } from '../_shared/cors.ts';
import { gerar, provedorAtual, quaseIgual } from '../_shared/ia/servico.ts';
import type { Mensagem } from '../_shared/ia/provedor.ts';
import { carregarContexto, limiteDeSaida, limparSaida, montarMensagens, validar, FORA } from '../_shared/ia/roteiro.ts';
import * as Linha from '../_shared/ia/linha.ts';
import * as Analise from '../_shared/ia/analise.ts';
import * as Resumo from '../_shared/ia/resumo.ts';

const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* Limites por pessoa. Folgados para quem está escrevendo de verdade
   (várias tentativas seguidas numa cena), apertados para um laço
   acidental ou abuso: a cota gratuita é uma só, dividida pela equipe. */
const LIMITE = { porMinuto: 8, porHora: 80, simultaneos: 2, corpo: 20_000 };

async function dentroDoLimite(sb: SupabaseClient, perfilId: string): Promise<'ok' | 'limite' | 'ocupado'> {
  const agora = Date.now();
  const desde = (ms: number) => new Date(agora - ms).toISOString();
  const { data } = await sb.from('ia_uso').select('created_at, status')
    .eq('perfil_id', perfilId).gte('created_at', desde(3_600_000)).order('created_at', { ascending: false }).limit(LIMITE.porHora + 5);
  const linhas = data || [];
  const noMinuto = linhas.filter(l => l.created_at >= desde(60_000));
  if (noMinuto.filter(l => l.status === 'andamento').length >= LIMITE.simultaneos) return 'ocupado';
  if (noMinuto.length >= LIMITE.porMinuto || linhas.length >= LIMITE.porHora) return 'limite';
  return 'ok';
}

Deno.serve(comCors(async (req: Request) => {
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
  const pRoteiro = corpo.tarefa === 'roteiro' ? validar(corpo) : null;
  const pLinha = corpo.tarefa === 'linha' ? Linha.validar(corpo) : null;
  const pAnalise = corpo.tarefa === 'analise' ? Analise.validar(corpo) : null;
  const pResumo = corpo.tarefa === 'resumo' ? Resumo.validar(corpo) : null;
  const v = pRoteiro || pLinha || pAnalise || pResumo;
  if (!v || !v.ok) return json({ ok: false, categoria: 'entrada_invalida' });

  /* zzz71: liga/desliga do administrador (Configurações → Administração),
     guardado em sistema_config. Roteiro e análise seguem "roteiros";
     linha e resumo seguem "linhas". Sem a linha no banco = ligado. */
  {
    const { data: cfgIa } = await sb.from('sistema_config').select('valor').eq('chave', 'ia').maybeSingle();
    const recursoCfg = (pRoteiro || pAnalise) ? 'roteiros' : 'linhas';
    const valorIa = (cfgIa && cfgIa.valor) as Record<string, unknown> | null;
    if (valorIa && valorIa[recursoCfg] === false) return json({ ok: false, categoria: 'desligado' });
  }

  /* Linha editorial: designer só lê (a tela já trava os campos para ele);
     quem não pode editar não ganha um caminho de escrita pela IA. A
     análise de roteiro segue a mesma regra: é ferramenta de quem escreve. */
  if ((pLinha || pAnalise || pResumo) && perfil.papel === 'designer') return json({ ok: false, categoria: 'sem_permissao' }, 403);

  /* ---- sem provedor configurado: recurso indisponível, nenhuma chamada externa ---- */
  const provedor = provedorAtual(n => Deno.env.get(n));
  if (!provedor) return json({ ok: false, categoria: 'indisponivel' });

  /* ---- limite de uso ---- */
  const limite = await dentroDoLimite(sb, perfil.id);
  if (limite !== 'ok') return json({ ok: false, categoria: limite });

  /* ---- permissão sobre ESTE registro: o RLS da própria pessoa decide ---- */
  const sbDaPessoa = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false }
  });

  /* Cada tarefa entrega a mesma coisa: o que registrar e o que pedir. */
  let t: {
    recurso: string; acao: string; entidadeTipo: string; entidadeId: string; tamanhoEntrada: number;
    mensagens: Mensagem[]; maxTokens: number; temperatura: number; limpar: (b: string) => string; json: boolean;
    esquema?: Record<string, unknown>;
    /** reescrita de um texto existente: a sugestão não pode voltar igual a ele */
    original?: string;
  };
  if (pRoteiro && pRoteiro.ok) {
    const pedido = pRoteiro.pedido;
    const ctx = await carregarContexto(sbDaPessoa, pedido.cenaId);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    t = {
      recurso: 'roteiro', acao: pedido.acao, entidadeTipo: 'cena', entidadeId: pedido.cenaId, tamanhoEntrada: pedido.texto.length,
      mensagens: montarMensagens(pedido, ctx), maxTokens: limiteDeSaida(pedido.acao), temperatura: 0.7, limpar: limparSaida, json: false,
      original: pedido.texto || undefined
    };
  } else if (pAnalise && pAnalise.ok) {
    /* revisar e comparar: o contexto é montado por operação, com a sessão
       da pessoa (RLS), e a resposta é uma lista estruturada e validada */
    const pedido = pAnalise.pedido;
    const ctx = await Analise.carregarContexto(sbDaPessoa, pedido);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    const base = Analise.suficiente(pedido, ctx);
    if (base !== 'ok') return json({ ok: false, categoria: base });      /* sem base: avisa e não gasta uma chamada */
    t = {
      recurso: 'analise', acao: Analise.nomeNoRegistro(pedido), entidadeTipo: 'roteiro', entidadeId: pedido.roteiroId,
      tamanhoEntrada: ctx.cenas.reduce((n, c) => n + c.fala.length, 0) + pedido.instrucao.length,
      mensagens: Analise.montarMensagens(pedido, ctx), maxTokens: Analise.limiteDeSaida(pedido),
      temperatura: pedido.operacao === 'rascunho_roteiro' ? 0.8 : 0.3, limpar: Analise.limpador(pedido, ctx), json: true, esquema: Analise.esquema(pedido)
    };
  } else if (pResumo && pResumo.ok) {
    /* texto para o cliente (status semanal, resumo do mês): o contexto e
       os números são lidos aqui, com a sessão da pessoa */
    const pedido = pResumo.pedido;
    const ctx = await Resumo.carregarContexto(sbDaPessoa, pedido);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    if (!Resumo.suficiente(pedido, ctx)) return json({ ok: false, categoria: 'pouco' });
    t = {
      recurso: 'resumo', acao: Resumo.nomeNoRegistro(pedido), entidadeTipo: Resumo.entidade(pedido), entidadeId: ctx.entidadeId,
      tamanhoEntrada: ctx.linhas.join('\n').length,
      mensagens: Resumo.montarMensagens(pedido, ctx), maxTokens: Resumo.limiteDeSaida(pedido),
      temperatura: 0.5, limpar: Resumo.limpador(pedido, ctx), json: false
    };
  } else {
    const pedido = (pLinha as { ok: true; pedido: Linha.Pedido }).pedido;
    const ctx = await Linha.carregarContexto(sbDaPessoa, pedido);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    /* sem base para ajudar sem inventar: avisa e não gasta uma chamada */
    if (!Linha.contextoSuficiente(pedido, ctx)) return json({ ok: false, categoria: 'contexto' });
    /* a linha já tem todos os tipos de pilar: não há o que sugerir */
    if (pedido.operacao === 'sugerir_pilares' && Linha.tiposLivres(ctx).length < 1) return json({ ok: true, itens: [] });
    t = {
      recurso: 'linha', acao: Linha.nomeNoRegistro(pedido),
      entidadeTipo: pedido.alvoTipo || 'linha', entidadeId: pedido.alvoId || pedido.linhaId, tamanhoEntrada: pedido.texto.length,
      mensagens: Linha.montarMensagens(pedido, ctx), maxTokens: Linha.limiteDeSaida(pedido),
      temperatura: pedido.operacao.startsWith('revisar') ? 0.4 : 0.8, limpar: Linha.limpador(pedido, ctx), json: Linha.pedeJson(pedido),
      esquema: Linha.esquema(pedido),
      original: pedido.operacao === 'campo' && pedido.texto && pedido.acao !== 'hashtags' ? pedido.texto : undefined
    };
  }

  /* ---- registro: metadados, nunca o texto enviado nem a sugestão ---- */
  const { data: reg } = await sb.from('ia_uso').insert({
    perfil_id: perfil.id, recurso: t.recurso, acao: t.acao,
    entidade_tipo: t.entidadeTipo, entidade_id: t.entidadeId, tamanho_entrada: t.tamanhoEntrada,
    provedor: provedor.nome, modelo: provedor.modelo
  }).select('id').maybeSingle();

  /* um pedido da pessoa = uma chamada ao provedor — com UMA exceção: a
     reescrita que volta praticamente igual ao texto original não serve
     para nada (a pessoa veria a "sugestão" idêntica ao que já escreveu).
     Nesse caso o modelo recebe a própria resposta de volta, com o aviso,
     e tem mais uma chance. Se repetir de novo, a tela recebe "igual" e
     explica — nunca uma sugestão idêntica. Erro de cota/limite não
     repete (ver servico.ts). */
  const op = { maxTokens: t.maxTokens, temperatura: t.temperatura, limpar: t.limpar, json: t.json, esquema: t.esquema };
  let r = await gerar(provedor, t.mensagens, op);
  let repetiu = false;
  if (r.ok && t.original && r.texto.trim() !== FORA && quaseIgual(r.texto, t.original)) {
    repetiu = true;
    const segunda = await gerar(provedor, [...t.mensagens,
      { role: 'user', content: 'ATENÇÃO: uma primeira tentativa devolveu <<<' + r.texto + '>>>, que é praticamente igual ao texto original e não ajuda quem pediu. ' +
        'Escreva uma versão realmente diferente, cumprindo a tarefa: outras palavras e outra construção, sem inventar dados.' }
    ], { ...op, temperatura: Math.min(1, op.temperatura + 0.2) });
    if (segunda.ok) r = segunda;
  }

  if (reg) {
    await sb.from('ia_uso').update(r.ok ? {
      status: 'ok', duracao_ms: r.ms, modelo: r.modelo,
      tokens_entrada: r.tokensEntrada, tokens_saida: r.tokensSaida, tamanho_saida: r.texto.length,
      /* com roteador: quem atendeu por trás dele, se houve troca e o custo informado */
      ...(r.servidoPor ? { provedor: (r.provedor + ':' + r.servidoPor).slice(0, 80) } : {}),
      ...(r.trocas ? { houve_fallback: true } : {}),
      ...(r.custo != null ? { custo: r.custo } : {})
    } : {
      status: 'erro', erro_categoria: r.erro, duracao_ms: r.ms
    }).eq('id', reg.id);
  }

  if (!r.ok) return json({ ok: false, categoria: r.categoria });
  /* pedido sem relação com o texto: o modelo responde o código combinado
     (roteiro.ts / linha.ts) em vez de ecoar o original */
  if (!t.json && r.texto.trim() === FORA) return json({ ok: false, categoria: 'fora' });
  if (repetiu && t.original && quaseIgual(r.texto, t.original)) return json({ ok: false, categoria: 'igual' });
  /* listas: o limpador da tarefa já validou e devolveu { itens } */
  if (t.json) {
    const lido = JSON.parse(r.texto);
    return json({ ok: true, itens: lido.itens, id: reg ? reg.id : null,
      ...(typeof lido.resumo === 'string' ? { resumo: lido.resumo } : {}) });
  }
  return json({ ok: true, texto: r.texto, id: reg ? reg.id : null });
}));
