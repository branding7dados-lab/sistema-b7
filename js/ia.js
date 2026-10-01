/* =====================================================================
   B7 IA — cliente das funções de IA (lado do navegador)

   Uma tela pede uma TAREFA ao B7 ("roteiro: melhorar esta cena") e
   recebe um texto. Não sabe qual modelo respondeu, não monta prompt e
   não guarda chave nenhuma: tudo isso mora na Edge Function b7-ia.

   Uso:
     const r = await B7.IA.pedir('roteiro', { acao, cena_id, texto }, { signal });
     r.ok      → r.texto
     !r.ok     → r.mensagem (frase pronta, em português) e r.categoria
     cancelado → r.cancelado === true (nada a mostrar)

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
    return !!(ia && ia[recurso] && B7.sb);
  }

  /* O que a pessoa lê. Nunca o erro cru do provedor nem nome de modelo. */
  const MENSAGENS = {
    sessao: 'Sua sessão expirou. Entre de novo para usar o assistente.',
    sem_permissao: 'Você não tem acesso ao assistente neste roteiro.',
    nao_encontrado: 'Esta cena não foi encontrada. Recarregue o roteiro e tente de novo.',
    entrada_invalida: 'Não foi possível usar este texto. Confira o tamanho do trecho e da instrução.',
    limite: 'Muitos pedidos em sequência. Espere um minuto e tente de novo.',
    ocupado: 'Já existe uma sugestão sendo gerada. Aguarde ela terminar.',
    cota: 'Limite temporário do assistente atingido. Tente novamente mais tarde.',
    recusado: 'O assistente não conseguiu trabalhar este trecho. Reformule o pedido ou escreva o texto de outro jeito.',
    indisponivel: 'Assistente de IA temporariamente indisponível. Tente novamente em alguns minutos.',
    tempo: 'A sugestão demorou demais para chegar. Tente novamente.',
    rede: 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  };
  const falha = categoria => ({ ok: false, categoria, mensagem: MENSAGENS[categoria] || MENSAGENS.indisponivel });

  /* Prazo do lado de cá: o servidor desiste antes (30 s), isto é só a
     rede de segurança para a tela nunca ficar "gerando" para sempre. */
  const PRAZO_MS = 70000;

  async function pedir(tarefa, dados, opcoes) {
    opcoes = opcoes || {};
    if (!B7.sb) return falha('indisponivel');
    if (!navigator.onLine) return falha('rede');

    let token = null;
    try { const s = await B7.sb.auth.getSession(); token = s && s.data && s.data.session && s.data.session.access_token; } catch (e) {}
    if (!token) return falha('sessao');

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
        body: JSON.stringify(Object.assign({ tarefa: tarefa }, dados || {}))
      });
      let corpo = null;
      try { corpo = await resp.json(); } catch (e) {}
      if (corpo && corpo.ok === true && typeof corpo.texto === 'string' && corpo.texto.trim()) {
        return { ok: true, texto: corpo.texto };
      }
      if (corpo && typeof corpo.categoria === 'string') return falha(corpo.categoria);
      if (resp.status === 401) return falha('sessao');
      if (resp.status === 403) return falha('sem_permissao');
      return falha('indisponivel');
    } catch (e) {
      if (externo && externo.aborted) return { ok: false, cancelado: true };
      if (estourou) return falha('tempo');
      return falha('rede');
    } finally {
      clearTimeout(relogio);
      if (externo) externo.removeEventListener('abort', aoCancelar);
    }
  }

  return { ligada, pedir };
})();
