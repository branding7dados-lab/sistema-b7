/* =====================================================================
   TEMPO REAL (zzz165)

   Alguém da equipe mexe em algo (cria uma demanda, muda a situação,
   manda uma versão, edita um conteúdo) e a tela de quem está olhando
   para aquilo se atualiza sozinha — sem F5.

   Um canal só, aberto enquanto a pessoa da equipe está logada. Cada
   mudança no banco diz a TABELA; cada tela diz de quais tabelas depende.
   Se a tela atual depende da tabela, ela é redesenhada em silêncio
   (sem animação de entrada, mantendo a rolagem).

   Nunca atrapalha:
     • com uma janela aberta, campo em foco (digitando) ou arrastando um
       cartão, espera — e atualiza assim que a pessoa terminar;
     • com a aba escondida, guarda e atualiza ao voltar;
     • logo depois de a própria pessoa clicar ou digitar (1 s), espera — a
       mudança provavelmente é dela e a tela dela já mostra.
   zzz169 — mais rápido: atualiza ~0,3 s depois da mudança (era 0,9 s +
   2,5 s de espera a cada rolagem/toque); rolar a tela não segura mais a
   atualização (a rolagem é mantida); se a ligação cair (Wi-Fi, PC que
   dormiu, aba parada), reconecta sozinho e atualiza a tela na volta.
   Telas com tempo real próprio (Design, Produção, Aprovações,
   Calendário, Conversas) ficam de fora para não atualizar duas vezes.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.TempoReal = (function () {
  const TABELAS = ['demandas_edicao', 'demandas_edicao_eventos', 'video_versoes', 'design_deliverables', 'conteudos',
    'linhas_editoriais', 'gravacoes', 'clientes', 'trends'];
  /* rota (primeira parte do hash) → tabelas que mudam o que ela mostra */
  const DEPENDE = {
    '': ['demandas_edicao', 'design_deliverables', 'gravacoes', 'conteudos', 'clientes'],
    painel: ['demandas_edicao', 'design_deliverables', 'gravacoes', 'conteudos'],
    video: ['demandas_edicao', 'demandas_edicao_eventos', 'video_versoes'],
    gravacoes: ['gravacoes'],
    clientes: ['clientes', 'gravacoes'],
    cliente: ['clientes', 'gravacoes', 'demandas_edicao', 'design_deliverables', 'linhas_editoriais'],
    linhas: ['linhas_editoriais', 'conteudos'],
    linha: ['linhas_editoriais', 'conteudos'],
    publicacoes: ['conteudos'],
    semanas: ['conteudos'],
    trends: ['trends'],
    tv: ['demandas_edicao', 'design_deliverables', 'gravacoes', 'conteudos']
  };
  let canal = null, pendente = false, relogio = 0, ultimaMexida = 0, arrastando = false, caiu = false, tReconectar = 0, escondidaEm = 0;

  const rotaAtual = () => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || '');
  const podeAtualizar = () => {
    if (document.hidden) return false;
    if (arrastando) return false;
    if (Date.now() - ultimaMexida < 1000) return false;
    if (document.querySelector('.fundo-modal, .hj-tela, .b7-abertura, body.tele-aberto, .ds-lightbox, .ds-ws-fundo')) return false;
    /* zzz234: na demanda de vídeo os campos só valem ao tocar em Salvar; um
       link digitado e ainda não salvo não some com a atualização, mesmo sem
       foco (as telas com salvamento automático não precisam disso) */
    const painel = document.getElementById('painel-dashboard');
    if (painel && rotaAtual() === 'video' && [...painel.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=search]), textarea')]
      .some(c => c.value !== c.defaultValue)) return false;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && a.closest('#painel-dashboard')) return false;
    if (window.getSelection && String(window.getSelection() || '').length > 0) return false;   /* selecionando texto */
    return true;
  };

  /* zzz308: rolagens de DENTRO da tela (colunas do quadro, listas com
     rolagem própria). Cada elemento rolado é lembrado por uma chave (id,
     classes e data-*) e pela posição entre os iguais; depois do redesenho
     o elemento equivalente volta para o mesmo ponto. */
  const chaveDe = el => el.tagName + '#' + (el.id || '') + '.' + [...el.classList].filter(c => !/^(entra|vd-troca|ativa?|mostra)$/.test(c)).sort().join('.') +
    Object.keys(el.dataset || {}).sort().map(k => '[' + k + '=' + el.dataset[k] + ']').join('');
  function guardarRolagens(raiz) {
    const lista = [];
    if (!raiz) return lista;
    const conta = {};
    raiz.querySelectorAll('*').forEach(el => {
      const k = chaveDe(el), i = conta[k] = (conta[k] || 0);
      conta[k]++;
      if (el.scrollTop > 0 || el.scrollLeft > 0) lista.push({ k, i, top: el.scrollTop, left: el.scrollLeft });
    });
    return lista;
  }
  function voltarRolagens(raiz, lista) {
    if (!raiz || !lista || !lista.length) return;
    const porChave = {};
    raiz.querySelectorAll('*').forEach(el => {
      const k = chaveDe(el);
      (porChave[k] = porChave[k] || []).push(el);
    });
    lista.forEach(r => {
      const el = (porChave[r.k] || [])[r.i];
      if (el) { el.scrollTop = r.top; el.scrollLeft = r.left; }
    });
  }

  /* zzz308: durante a atualização silenciosa o painel não aceita o
     esqueleto de carregamento ("class=\"esq …"). A tela antiga fica
     inteira, parada e clicável, até a nova estar pronta — e aí troca de
     uma vez, sem piscar. Vale para todas as telas, sem mexer em cada uma. */
  const DESC_HTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  function blindar(painel) {
    if (!painel || !DESC_HTML) return () => {};
    try {
      Object.defineProperty(painel, 'innerHTML', {
        configurable: true,
        get() { return DESC_HTML.get.call(this); },
        set(v) {
          if (typeof v === 'string' && v.indexOf('class="esq ') >= 0) return;
          DESC_HTML.set.call(this, v);
        }
      });
    } catch (e) { return () => {}; }
    return () => { try { delete painel.innerHTML; } catch (e) {} };
  }

  /* Partes que carregam sozinhas depois da tela (ex.: Oportunidades e
     Projetos dentro do cliente) também mostravam o esqueleto. Enquanto a
     atualização acontece, uma parte com id que acabou de virar esqueleto
     recebe de volta o conteúdo que tinha antes; quando a busca dela
     termina, ela mesma escreve o conteúdo novo por cima. */
  function vigiarPartes(painel, ms) {
    if (!painel || !window.MutationObserver) return;
    const antes = new Map();
    painel.querySelectorAll('[id]').forEach(el => {
      if (el.querySelector('.esq')) return;
      const h = DESC_HTML.get.call(el);
      if (h && h.length < 300000) antes.set(el.id, h);
    });
    if (!antes.size) return;
    const obs = new MutationObserver(() => {
      painel.querySelectorAll('.esq').forEach(esq => {
        let el = esq.parentElement;
        while (el && el !== painel && !(el.id && antes.has(el.id))) el = el.parentElement;
        if (el && el !== painel && el.isConnected) { const h = antes.get(el.id); antes.delete(el.id); DESC_HTML.set.call(el, h); }
      });
    });
    obs.observe(painel, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), ms);
  }

  let atualizando = false;
  async function atualizar() {
    if (!pendente) return;
    if (atualizando || !podeAtualizar()) { agendar(500); return; }
    pendente = false;
    atualizando = true;
    /* guarda a rolagem de quem rola (a página ou o painel) */
    const rolagens = [];
    const painel = document.getElementById('painel-dashboard');
    let el = painel;
    while (el) { if (el.scrollTop > 0) rolagens.push([el, el.scrollTop]); el = el.parentElement; }
    const raiz = document.scrollingElement; if (raiz && raiz.scrollTop) rolagens.push([raiz, raiz.scrollTop]);
    const dentro = guardarRolagens(painel);
    const hash = location.hash;
    document.documentElement.classList.add('b7-rt-silencioso');
    const soltar = blindar(painel);
    vigiarPartes(painel, 6000);
    B7.recargaSilenciosa = true;
    try {
      await Promise.race([Promise.resolve(B7.Rota.ir()), new Promise(r => setTimeout(r, 8000))]);
    } catch (e) {}
    finally { soltar(); B7.recargaSilenciosa = false; atualizando = false; }
    if (location.hash !== hash) { document.documentElement.classList.remove('b7-rt-silencioso'); return; }
    const voltar = () => {
      rolagens.forEach(([e, t]) => { try { e.scrollTop = t; } catch (x) {} });
      voltarRolagens(document.getElementById('painel-dashboard'), dentro);
    };
    voltar(); requestAnimationFrame(voltar); setTimeout(voltar, 350);
    setTimeout(() => document.documentElement.classList.remove('b7-rt-silencioso'), 600);
  }
  function agendar(ms) { clearTimeout(relogio); relogio = setTimeout(atualizar, ms); }

  function aoMudar(p) {
    const r = rotaAtual(), dep = DEPENDE[r];
    if (!dep || !dep.includes(p.table)) return;
    pendente = true;
    agendar(300);   /* várias mudanças juntas viram uma atualização só */
  }

  function ligar() {
    if (canal || !B7.DB || !B7.DB.canal) return;
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    if (!u || u.papel === 'cliente') return;
    let meu = null;
    meu = canal = B7.DB.canal('b7-tempo-real-' + u.id, TABELAS.map(t => ({ table: t })), aoMudar, st => aoEstado(st, meu));
  }
  /* a ligação caiu: reconecta e, ao voltar, atualiza a tela (pode ter
     perdido alguma mudança enquanto estava fora) */
  function aoEstado(st, deQuem) {
    if (!deQuem || deQuem !== canal) return;     /* aviso de um canal antigo, já trocado */
    if (st === 'SUBSCRIBED') {
      if (caiu) { caiu = false; recarregarTela(); }
      return;
    }
    if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
      caiu = true;
      clearTimeout(tReconectar);
      tReconectar = setTimeout(() => { desligar(); ligar(); caiu = true; }, 3000);
    }
  }
  function recarregarTela() {
    if (!DEPENDE[rotaAtual()]) return;
    pendente = true; agendar(200);
  }
  function desligar() { if (canal) { const c = canal; canal = null; B7.DB.fecharCanal(c); } }

  /* o que conta como "a pessoa está mexendo" */
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { ultimaMexida = Date.now(); }, { passive: true, capture: true }));
  addEventListener('dragstart', () => { arrastando = true; }, true);
  addEventListener('dragend', () => { arrastando = false; ultimaMexida = Date.now(); }, true);
  /* aba escondida por mais de 1 min: o navegador pode ter parado a ligação
     — ao voltar, atualiza do mesmo jeito */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { escondidaEm = Date.now(); return; }
    if (escondidaEm && Date.now() - escondidaEm > 60000) recarregarTela();
    else if (pendente) agendar(150);
  });
  addEventListener('online', () => { if (canal) { desligar(); ligar(); } recarregarTela(); });
  /* ao trocar de tela, o que estava pendente para a tela anterior não vale */
  addEventListener('hashchange', () => { pendente = false; clearTimeout(relogio); });

  /* liga quando a pessoa entra (e tenta de novo até a sessão existir) */
  let tentativas = 0;
  const t = setInterval(() => {
    if (canal || ++tentativas > 120) return clearInterval(t);
    ligar();
  }, 2000);

  return { ligar, desligar, guardarRolagens, voltarRolagens, _depende: DEPENDE, _simular: tabela => aoMudar({ table: tabela }), arrastando: v => { arrastando = !!v; } };
})();
