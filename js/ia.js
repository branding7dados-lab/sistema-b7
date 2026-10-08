/* =====================================================================
   B7 IA — cliente das funções de IA (lado do navegador)

   Uma tela pede uma TAREFA ao B7 ("roteiro: melhorar esta cena") e
   recebe um texto. Não sabe qual modelo respondeu, não monta prompt e
   não guarda chave nenhuma: tudo isso mora na Edge Function b7-ia.

   Uso:
     const r = await B7.IA.pedir('roteiro', { acao, cena_id, texto }, { signal });
     r.ok      → r.texto (um campo) ou r.itens (uma lista; as análises trazem também r.resumo)
     !r.ok     → r.mensagem (frase pronta, em português) e r.categoria
     cancelado → r.cancelado === true (nada a mostrar)

   Resposta aparecendo enquanto é escrita (zzz123, só o chat):
     const r = await B7.IA.pedir('chat', dados, { aoTrecho: pedaco => … });
   Os pedaços chegam na ordem; o `r` do fim é o mesmo de sempre e traz o
   texto definitivo (é ele que vale). Se o servidor responder do jeito
   antigo, nenhum pedaço chega e o resultado é igual.

   Nada aqui roda sozinho: não há chamada ao abrir tela, ao digitar nem
   em segundo plano. Sem B7_CONFIG.IA ligado para o recurso, a tela nem
   mostra a entrada — e o resto do B7 funciona igual com a IA fora do ar.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.IA = (function () {
  const cfg = () => window.B7_CONFIG || {};

  /* Recurso ligado nesta instalação? (js/config.js → IA: { roteiros: true }) */
  function ligada(recurso) {
    const ia = cfg().IA;
    return !!(ia && ia[recurso] && B7.sb) && remoto()[recurso] !== false;
  }

  /* zzz71: liga/desliga que vale para TODOS (Configurações →
     Administração). Mora no banco (sistema_config, chave "ia"); a cópia
     local só evita o botão piscar ao abrir. O servidor (b7-ia) confere de
     novo: desligado aqui, o pedido é recusado lá. */
  let remotoMem = null;
  function remoto() {
    return remotoMem || (B7.pref ? B7.pref.ler('sis_ia', null) : null) || {};
  }
  function definirRemoto(v) {
    remotoMem = v || {};
    if (B7.pref) B7.pref.gravar('sis_ia', remotoMem);
    /* o botão do chat aparece/some conforme a configuração */
    try { if (B7.Chat && B7.Chat.montar) B7.Chat.montar(); } catch (e) {}
  }
  async function sincronizar() {
    if (!B7.sb) return;
    try {
      const { data } = await B7.sb.from('sistema_config').select('valor').eq('chave', 'ia').maybeSingle();
      if (data && data.valor) definirRemoto(data.valor);
    } catch (e) {}
  }

  /* O que a pessoa lê. Nunca o erro cru do provedor nem nome de modelo. */
  const MENSAGENS = {
    sessao: 'Sua sessão expirou. Entre de novo para usar o assistente.',
    sem_permissao: 'Você não tem acesso ao assistente aqui.',
    nao_encontrado: 'Este item não foi encontrado. Recarregue a página e tente de novo.',
    entrada_invalida: 'Não foi possível usar este texto. Confira o tamanho do trecho e da instrução.',
    contexto: 'Ainda não há informação suficiente para sugerir sem inventar. Preencha um pouco mais da estratégia e tente de novo.',
    pouco: 'Ainda não há conteúdo suficiente para uma análise completa. Escreva um pouco mais e tente de novo.',
    sem_vinculo: 'Este roteiro não está ligado a um conteúdo da Linha Editorial, então não há planejamento para comparar.',
    limite: 'Muitos pedidos em sequência. Espere um minuto e tente de novo.',
    ocupado: 'Já existe uma sugestão sendo gerada. Aguarde ela terminar.',
    cota: 'Limite temporário do assistente atingido. Tente novamente mais tarde.',
    recusado: 'O assistente não conseguiu trabalhar este trecho. Reformule o pedido ou escreva o texto de outro jeito.',
    igual: 'A IA não encontrou uma versão melhor e devolveu o mesmo texto. Escreva um pedido mais específico (ex.: "deixe mais curto e direto", "tire a contradição do pagamento") e gere de novo.',
    fora: 'Esse pedido não é sobre o texto. Escreva o que você quer que mude nele (ex.: "deixe mais descontraído").',
    desligado: 'O assistente está desligado nas Configurações do sistema.',
    sem_fala: 'Não deu para entender o áudio. Fale mais perto do microfone e tente de novo.',
    indisponivel: 'Assistente de IA temporariamente indisponível. Tente novamente em alguns minutos.',
    tempo: 'A sugestão demorou demais para chegar. Tente novamente.',
    rede: 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  };
  const falha = categoria => ({ ok: false, categoria, mensagem: MENSAGENS[categoria] || MENSAGENS.indisponivel });

  /* Prazo do lado de cá: o servidor desiste antes (30 s), isto é só a
     rede de segurança para a tela nunca ficar "gerando" para sempre. */
  const PRAZO_MS = 70000;

  /* a resposta de produto (JSON comum, ou o evento "fim" do fluxo) */
  function interpretar(corpo, status) {
    if (corpo && corpo.ok === true && typeof corpo.texto === 'string' && corpo.texto.trim()) {
      return { ok: true, texto: corpo.texto, conversa_id: corpo.conversa_id || null, titulo: corpo.titulo || '', cliente_id: corpo.cliente_id || null,
               acao: (corpo.acao && typeof corpo.acao === 'object') ? corpo.acao : null,
               /* zzz124: várias propostas na mesma resposta */
               acoes: Array.isArray(corpo.acoes) ? corpo.acoes.filter(a => a && typeof a === 'object') : null };
    }
    /* tarefas que devolvem lista (pilares, conteúdos, observações, ideias) */
    if (corpo && corpo.ok === true && Array.isArray(corpo.itens)) {
      return { ok: true, itens: corpo.itens, resumo: typeof corpo.resumo === 'string' ? corpo.resumo : '' };
    }
    if (corpo && typeof corpo.categoria === 'string') return falha(corpo.categoria);
    if (status === 401) return falha('sessao');
    if (status === 403) return falha('sem_permissao');
    return falha('indisponivel');
  }

  /* lê o fluxo (text/event-stream): repassa os pedaços e devolve o fim */
  async function lerFluxo(resp, aoTrecho) {
    const leitor = resp.body.getReader(), dec = new TextDecoder();
    let resto = '', fim = null;
    const tratar = linha => {
      if (linha.slice(0, 5) !== 'data:') return;
      let ev = null;
      try { ev = JSON.parse(linha.slice(5).trim()); } catch (e) { return; }
      if (!ev) return;
      if (ev.t === 'trecho' && typeof ev.texto === 'string') { try { aoTrecho(ev.texto); } catch (e) {} }
      else if (ev.t === 'fim') fim = interpretar(ev, 200);
      else if (ev.t === 'erro') fim = falha(ev.categoria);
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
    return fim || falha('indisponivel');
  }

  async function pedir(tarefa, dados, opcoes) {
    opcoes = opcoes || {};
    if (!B7.sb) return falha('indisponivel');
    if (!navigator.onLine) return falha('rede');

    let token = null;
    try { const s = await B7.sb.auth.getSession(); token = s && s.data && s.data.session && s.data.session.access_token; } catch (e) {}
    if (!token) return falha('sessao');

    const querFluxo = typeof opcoes.aoTrecho === 'function' && !!(window.ReadableStream && window.TextDecoder);
    const ctrl = new AbortController();
    let estourou = false;
    const relogio = setTimeout(() => { estourou = true; ctrl.abort(); }, PRAZO_MS);
    const externo = opcoes.signal;
    const aoCancelar = () => ctrl.abort();
    if (externo) {
      if (externo.aborted) { clearTimeout(relogio); return { ok: false, cancelado: true }; }
      externo.addEventListener('abort', aoCancelar);
    }

    try {
      const base = String(cfg().SUPABASE_URL || '').trim().replace(/\/+$/, '');
      const resp = await fetch(base + '/functions/v1/b7-ia', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'apikey': String(cfg().SUPABASE_PUBLISHABLE_KEY || '').trim(), 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(Object.assign({ tarefa: tarefa }, dados || {}, querFluxo ? { fluxo: true } : {}))
      });
      if (querFluxo && resp.ok && resp.body && /text\/event-stream/i.test(resp.headers.get('content-type') || '')) {
        return await lerFluxo(resp, opcoes.aoTrecho);
      }
      let corpo = null;
      try { corpo = await resp.json(); } catch (e) {}
      return interpretar(corpo, resp.status);
    } catch (e) {
      if (externo && externo.aborted) return { ok: false, cancelado: true };
      if (estourou) return falha('tempo');
      return falha('rede');
    } finally {
      clearTimeout(relogio);
      if (externo) externo.removeEventListener('abort', aoCancelar);
    }
  }

  return { ligada, pedir, remoto, definirRemoto, sincronizar };
})();
