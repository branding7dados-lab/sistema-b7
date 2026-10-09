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
//         { tarefa: 'chat', texto, conversa_id?, cliente_id?, fluxo? }     (ver _shared/ia/chat.ts)
//         { tarefa: 'oportunidade', oportunidade_id, cliente_id, dia?, instrucao? }  (ver _shared/ia/oportunidade.ts)
//         { tarefa: 'voz', audio (base64), mime }                          (ver _shared/ia/voz.ts)
//         { tarefa: 'agencia', operacao: 'semana', instrucao? }            (só administrador; ver _shared/ia/agencia.ts)
//
// MEMÓRIA DO CLIENTE (zzz123). Toda tarefa que é de um cliente recebe,
// antes da mensagem da tarefa, o que a equipe anotou para a IA na ficha
// dele (_shared/ia/memoria.ts). Lida com a sessão da pessoa.
//
// FLUXO (zzz123). Só no chat, e só se a tela pedir ("fluxo": true): a
// resposta sai como text/event-stream, uma linha "data: {json}" por vez:
//   { t: 'trecho', texto }           pedaço do texto, na ordem
//   { t: 'fim', ok: true, texto, … } o mesmo objeto da resposta comum
//   { t: 'erro', categoria }         o mesmo de { ok: false, categoria }
// Sessão, permissão, limite e pedido inválido continuam respondendo em
// JSON comum, antes de qualquer fluxo começar.
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
import { gerar, gerarFluxo, provedorAtual, quaseIgual, type Resultado } from '../_shared/ia/servico.ts';
import type { Mensagem } from '../_shared/ia/provedor.ts';
import { carregarContexto, limiteDeSaida, limparSaida, montarMensagens, validar, FORA } from '../_shared/ia/roteiro.ts';
import * as Linha from '../_shared/ia/linha.ts';
import * as Analise from '../_shared/ia/analise.ts';
import * as Resumo from '../_shared/ia/resumo.ts';
import * as Chat from '../_shared/ia/chat.ts';
import * as Oportunidade from '../_shared/ia/oportunidade.ts';
import * as Memoria from '../_shared/ia/memoria.ts';
import * as Voz from '../_shared/ia/voz.ts';
import * as Agencia from '../_shared/ia/agencia.ts';

const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
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
  /* zzz128: perfil, liga/desliga do administrador e limite de uso são três
     leituras que só dependem de quem é a pessoa: saem juntas (antes era
     uma esperando a outra). Cada uma é conferida no mesmo lugar de antes. */
  const pCfgIa = sb.from('sistema_config').select('valor').eq('chave', 'ia').maybeSingle().then(r => r);
  /* zzz129: para quem cada recurso novo aparece (Configurações → Admin → Recursos) */
  const pRecursos = sb.from('sistema_config').select('valor').eq('chave', 'recursos').maybeSingle().then(r => r);
  const pLimite = dentroDoLimite(sb, user.id).catch(() => 'limite' as const);
  const { data: perfil } = await sb.from('perfis').select('id, estado, papel, nome, funcao').eq('id', user.id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa' || perfil.papel === 'cliente') return json({ ok: false, categoria: 'sem_permissao' }, 403);

  /* ---- pedido ---- */
  const bruto = await req.text();
  /* só a transcrição de voz (zzz126) pode vir grande: o áudio vai no corpo */
  if (bruto.length > Voz.LIMITE.corpo) return json({ ok: false, categoria: 'entrada_invalida' });
  let corpo: Record<string, unknown> = {};
  try { corpo = JSON.parse(bruto); } catch (_e) { return json({ ok: false, categoria: 'entrada_invalida' }); }
  if (bruto.length > LIMITE.corpo && corpo.tarefa !== 'voz' && !(corpo.tarefa === 'chat' && corpo.imagem != null)) return json({ ok: false, categoria: 'entrada_invalida' });
  const pRoteiro = corpo.tarefa === 'roteiro' ? validar(corpo) : null;
  const pLinha = corpo.tarefa === 'linha' ? Linha.validar(corpo) : null;
  const pAnalise = corpo.tarefa === 'analise' ? Analise.validar(corpo) : null;
  const pResumo = corpo.tarefa === 'resumo' ? Resumo.validar(corpo) : null;
  const pChat = corpo.tarefa === 'chat' ? Chat.validar(corpo) : null;
  const pOport = corpo.tarefa === 'oportunidade' ? Oportunidade.validar(corpo) : null;
  const pVoz = corpo.tarefa === 'voz' ? Voz.validar(corpo) : null;
  const pAgencia = corpo.tarefa === 'agencia' ? Agencia.validar(corpo) : null;
  const v = pRoteiro || pLinha || pAnalise || pResumo || pChat || pOport || pVoz || pAgencia;
  if (!v || !v.ok) return json({ ok: false, categoria: 'entrada_invalida' });

  /* zzz71: liga/desliga do administrador (Configurações → Administração),
     guardado em sistema_config. Roteiro e análise seguem "roteiros";
     linha e resumo seguem "linhas". Sem a linha no banco = ligado. */
  {
    const { data: cfgIa } = await pCfgIa;
    const recursoCfg = (pChat || pVoz) ? 'chat' : pAgencia ? 'agencia' : (pRoteiro || pAnalise) ? 'roteiros' : 'linhas';
    const valorIa = (cfgIa && cfgIa.valor) as Record<string, unknown> | null;
    if (valorIa && valorIa[recursoCfg] === false) return json({ ok: false, categoria: 'desligado' });
  }

  /* zzz129: recurso de IA que o administrador ainda não liberou para esta
     pessoa. É a mesma conta de js/recursos.js: sem regra = todos; "eu" =
     só aquela pessoa; "funcoes" = administradores + funções marcadas. */
  {
    const idRecurso = pVoz ? 'ia_voz' : pOport ? 'ia_ideias' : (pChat && corpo.imagem != null) ? 'ia_imagem' : null;
    if (idRecurso) {
      const { data: cfgRec } = await pRecursos;
      const regra = cfgRec && cfgRec.valor ? (cfgRec.valor as Record<string, { modo?: string; pessoa?: string; funcoes?: string[] }>)[idRecurso] : null;
      const liberado = !regra || !regra.modo || regra.modo === 'todos' ? true
        : regra.modo === 'desligado' ? false
        : regra.modo === 'eu' ? regra.pessoa === user.id
        : perfil.papel === 'admin' || (!!perfil.funcao && (regra.funcoes || []).includes(perfil.funcao));
      if (!liberado) return json({ ok: false, categoria: 'desligado' });
    }
  }

  /* Linha editorial: designer só lê (a tela já trava os campos para ele);
     quem não pode editar não ganha um caminho de escrita pela IA. A
     análise de roteiro segue a mesma regra: é ferramenta de quem escreve. */
  if ((pLinha || pAnalise || pResumo || pOport) && perfil.papel === 'designer') return json({ ok: false, categoria: 'sem_permissao' }, 403);
  /* zzz141: o resumo da agência é do administrador (o banco confere de novo) */
  if (pAgencia && perfil.papel !== 'admin') return json({ ok: false, categoria: 'sem_permissao' }, 403);

  /* ---- sem provedor configurado: recurso indisponível, nenhuma chamada externa ---- */
  const provedor = provedorAtual(n => Deno.env.get(n));
  if (!provedor) return json({ ok: false, categoria: 'indisponivel' });

  /* ---- limite de uso ---- */
  const limite = await pLimite;
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
    /** depois de dar certo: grava o que precisar e devolve campos a mais para a tela */
    aposOk?: (texto: string) => Promise<Record<string, unknown>>;
    /** zzz126: áudio que vai junto (só a transcrição de voz) */
    audio?: { mime: string; base64: string };
    /** zzz128: imagem anexada à mensagem do chat */
    imagem?: { mime: string; base64: string };
  };
  /* de qual cliente é o pedido, para a memória (o chat diz na conversa) */
  let clienteDoPedido: string | null | undefined = undefined;
  /* o chat já lê a memória junto do contexto (zzz128) */
  let memoriaPronta: { memoria: string; exemplos: string } | null = null;
  if (pChat && pChat.ok) {
    /* conversa livre: a conversa tem que ser da pessoa; o que o assistente
       sabe do B7 é lido com a sessão dela (RLS) */
    const pedido = pChat.pedido;
    const conv = await Chat.abrirConversa(sb, sbDaPessoa, perfil.id, pedido);
    if (!conv) return json({ ok: false, categoria: 'nao_encontrado' });
    clienteDoPedido = conv.clienteId;
    const [hist, contexto, mem, exs] = await Promise.all([Chat.historico(sb, conv), Chat.carregarContexto(sbDaPessoa, conv.clienteId, sb),
      Memoria.memoriaDoCliente(sbDaPessoa, conv.clienteId), Memoria.exemplosDoCliente(sbDaPessoa, conv.clienteId, 'legendas')]);
    memoriaPronta = { memoria: mem, exemplos: exs };
    const FUNCOES: Record<string, string> = { coordenador: 'Coordenação', designer: 'Designer', videomaker: 'Videomaker' };
    const quem = { nome: String(perfil.nome || ''), funcao: perfil.papel === 'admin' ? 'Administrador' : (FUNCOES[String(perfil.funcao)] || '') };
    /* zzz89: só recebe a instrução de PROPOR ação quem pode criar demanda
       de vídeo (a mesma regra da função do banco: equipe ou videomaker) */
    const podeAgir = perfil.papel === 'admin' || perfil.papel === 'coordenador' || perfil.funcao === 'videomaker';
    /* zzz127: peça de design, gravação e conteúdo na linha — só quem é da
       equipe de coordenação cria essas coisas nas telas (e o banco confere
       de novo na hora de criar) */
    const coordena = perfil.papel === 'admin' || perfil.papel === 'coordenador';
    const permitidas: Chat.TipoAcao[] = [...(podeAgir ? ['video_demanda' as const] : []),
      /* só para a tela que sabe mostrar esses cartões (acoes_v >= 2): a tela
         antiga trataria qualquer proposta como demanda de vídeo */
      ...(coordena && Number(corpo.acoes_v) >= 2 ? ['design_peca' as const, 'gravacao' as const, 'conteudo' as const] : [])];
    t = {
      recurso: 'chat', acao: 'mensagem', entidadeTipo: 'conversa', entidadeId: conv.id, tamanhoEntrada: pedido.texto.length,
      mensagens: Chat.montarMensagens(pedido, contexto, hist, quem, permitidas), maxTokens: 1200, temperatura: 0.6, limpar: Chat.limpar, json: false,
      ...(pedido.imagem ? { imagem: pedido.imagem } : {}),
      aposOk: async (texto: string) => {
        const ex = permitidas.length ? await Chat.extrairAcao(texto, sbDaPessoa, permitidas) : { texto: Chat.semAcao(texto) || texto, acao: null, acoes: [] };
        /* a imagem não é guardada: no histórico fica só a marca de que havia uma */
        const mensagemId = await Chat.gravar(sb, perfil.id, conv, pedido.texto + (pedido.imagem ? '\n[imagem anexada]' : ''), ex.texto, ex.acoes);
        /* `acoes` = todas as propostas (zzz124); `acao` = a única de vídeo, para as telas antigas */
        return { conversa_id: conv.id, titulo: conv.titulo, cliente_id: conv.clienteId, texto: ex.texto,
          ...(mensagemId ? { mensagem_id: mensagemId } : {}),
          ...(ex.acao ? { acao: ex.acao } : {}), ...(ex.acoes.length ? { acoes: ex.acoes } : {}) };
      }
    };
  } else if (pRoteiro && pRoteiro.ok) {
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
  } else if (pVoz && pVoz.ok) {
    /* ditado: o áudio vira texto para o campo de mensagem. Nada é guardado
       e nada é enviado ao assistente por aqui — quem envia é a pessoa. */
    const pedido = pVoz.pedido;
    clienteDoPedido = null;
    t = {
      recurso: 'voz', acao: 'transcrever', entidadeTipo: 'perfil', entidadeId: perfil.id, tamanhoEntrada: pedido.audio.length,
      mensagens: Voz.montarMensagens(await Voz.vocabulario(sbDaPessoa)), maxTokens: 1200, temperatura: 0, limpar: Voz.limpar, json: false,
      audio: { mime: pedido.mime, base64: pedido.audio }
    };
  } else if (pAgencia && pAgencia.ok) {
    /* resumo da semana para o administrador: os números vêm do banco, o modelo só escreve */
    const pedido = pAgencia.pedido;
    const ctx = await Agencia.carregarContexto(sbDaPessoa, pedido);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    clienteDoPedido = null;
    t = {
      recurso: 'agencia', acao: Agencia.nomeNoRegistro(pedido), entidadeTipo: 'perfil', entidadeId: perfil.id, tamanhoEntrada: ctx.linhas.join('\n').length,
      mensagens: Agencia.montarMensagens(pedido, ctx), maxTokens: Agencia.limiteDeSaida(pedido), temperatura: 0.3, limpar: Agencia.limpador(pedido, ctx), json: false
    };
  } else if (pOport && pOport.ok) {
    /* ideias para uma data e um cliente: lista para ler e copiar, nada é aplicado */
    const pedido = pOport.pedido;
    const ctx = await Oportunidade.carregarContexto(sbDaPessoa, pedido);
    if (!ctx) return json({ ok: false, categoria: 'nao_encontrado' });
    if (!Oportunidade.suficiente(ctx)) return json({ ok: false, categoria: 'contexto' });
    clienteDoPedido = pedido.clienteId;
    t = {
      recurso: 'oportunidade', acao: 'ideias', entidadeTipo: 'oportunidade', entidadeId: pedido.oportunidadeId, tamanhoEntrada: pedido.instrucao.length,
      mensagens: Oportunidade.montarMensagens(pedido, ctx), maxTokens: 2200, temperatura: 0.9, limpar: Oportunidade.limpar, json: true,
      esquema: Oportunidade.esquema()
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

  /* ---- memória do cliente: entra antes da mensagem da tarefa ---- */
  if (memoriaPronta) {
    t.mensagens = Memoria.comMemoria(t.mensagens, memoriaPronta.memoria, memoriaPronta.exemplos);
  } else {
    const cli = clienteDoPedido !== undefined ? clienteDoPedido : await Memoria.clienteDaTarefa(sbDaPessoa, corpo);
    /* exemplos do que já saiu (zzz128): em tudo que ESCREVE para o cliente;
       resumo de status e transcrição de voz não precisam */
    const quais: Memoria.Exemplos = (pResumo || pVoz || pAgencia) ? 'nenhum' : 'todos';
    const [mem, exs] = await Promise.all([Memoria.memoriaDoCliente(sbDaPessoa, cli), Memoria.exemplosDoCliente(sbDaPessoa, cli, quais)]);
    t.mensagens = Memoria.comMemoria(t.mensagens, mem, exs);
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
  const op = { maxTokens: t.maxTokens, temperatura: t.temperatura, limpar: t.limpar, json: t.json, esquema: t.esquema, audio: t.audio, imagem: t.imagem };

  const fecharRegistro = async (r: Resultado) => {
    if (!reg) return;
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
  };

  /* ---- zzz123: chat em fluxo — o texto vai saindo enquanto é escrito ---- */
  if (pChat && pChat.ok && corpo.fluxo === true) {
    const enc = new TextEncoder();
    const tarefa = t;
    const fluxo = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const manda = (o: unknown) => { try { ctrl.enqueue(enc.encode('data: ' + JSON.stringify(o) + '\n\n')); } catch (_e) { /* a pessoa fechou a tela */ } };
        try {
          const rf = await gerarFluxo(provedor, tarefa.mensagens, op, Chat.filtroDeFluxo(texto => manda({ t: 'trecho', texto })));
          await fecharRegistro(rf);
          if (!rf.ok) manda({ t: 'erro', categoria: rf.categoria });
          else {
            const extra = tarefa.aposOk ? await tarefa.aposOk(rf.texto) : {};
            manda({ t: 'fim', ok: true, texto: rf.texto, id: reg ? reg.id : null, ...extra });
          }
        } catch (_e) {
          manda({ t: 'erro', categoria: 'indisponivel' });
        }
        try { ctrl.close(); } catch (_e) { /* já fechado */ }
      }
    });
    return new Response(fluxo, { headers: { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  }

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

  await fecharRegistro(r);

  if (!r.ok) return json({ ok: false, categoria: r.categoria });
  /* pedido sem relação com o texto: o modelo responde o código combinado
     (roteiro.ts / linha.ts) em vez de ecoar o original */
  if (!t.json && r.texto.trim() === FORA) return json({ ok: false, categoria: 'fora' });
  if (pVoz && r.texto.trim() === Voz.SILENCIO) return json({ ok: false, categoria: 'sem_fala' });
  if (repetiu && t.original && quaseIgual(r.texto, t.original)) return json({ ok: false, categoria: 'igual' });
  /* listas: o limpador da tarefa já validou e devolveu { itens } */
  if (t.json) {
    const lido = JSON.parse(r.texto);
    return json({ ok: true, itens: lido.itens, id: reg ? reg.id : null,
      ...(typeof lido.resumo === 'string' ? { resumo: lido.resumo } : {}) });
  }
  const extra = t.aposOk ? await t.aposOk(r.texto) : {};
  return json({ ok: true, texto: r.texto, id: reg ? reg.id : null, ...extra });
}));
