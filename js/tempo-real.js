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
     • logo depois de a própria pessoa mexer (2,5 s), espera — a mudança
       provavelmente é dela e a tela dela já mostra.
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
  let canal = null, pendente = false, relogio = 0, ultimaMexida = 0, arrastando = false;

  const rotaAtual = () => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || '');
  const podeAtualizar = () => {
    if (document.hidden) return false;
    if (arrastando) return false;
    if (Date.now() - ultimaMexida < 2500) return false;
    if (document.querySelector('.fundo-modal, .hj-tela, .b7-abertura, body.tele-aberto')) return false;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && a.closest('#painel-dashboard')) return false;
    if (window.getSelection && String(window.getSelection() || '').length > 0) return false;   /* selecionando texto */
    return true;
  };

  function atualizar() {
    if (!pendente) return;
    if (!podeAtualizar()) { agendar(1500); return; }
    pendente = false;
    /* guarda a rolagem de quem rola (a página ou o painel) */
    const rolagens = [];
    let el = document.getElementById('painel-dashboard');
    while (el) { if (el.scrollTop > 0) rolagens.push([el, el.scrollTop]); el = el.parentElement; }
    const raiz = document.scrollingElement; if (raiz && raiz.scrollTop) rolagens.push([raiz, raiz.scrollTop]);
    document.documentElement.classList.add('b7-rt-silencioso');
    try { B7.Rota.ir(); } catch (e) {}
    const voltar = () => rolagens.forEach(([e, t]) => { try { e.scrollTop = t; } catch (x) {} });
    requestAnimationFrame(voltar); setTimeout(voltar, 350); setTimeout(voltar, 900);
    setTimeout(() => document.documentElement.classList.remove('b7-rt-silencioso'), 1200);
  }
  function agendar(ms) { clearTimeout(relogio); relogio = setTimeout(atualizar, ms); }

  function aoMudar(p) {
    const r = rotaAtual(), dep = DEPENDE[r];
    if (!dep || !dep.includes(p.table)) return;
    pendente = true;
    agendar(900);   /* várias mudanças juntas viram uma atualização só */
  }

  function ligar() {
    if (canal || !B7.DB || !B7.DB.canal) return;
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    if (!u || u.papel === 'cliente') return;
    canal = B7.DB.canal('b7-tempo-real-' + u.id, TABELAS.map(t => ({ table: t })), aoMudar);
  }
  function desligar() { if (canal) { B7.DB.fecharCanal(canal); canal = null; } }

  /* o que conta como "a pessoa está mexendo" */
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { ultimaMexida = Date.now(); }, { passive: true, capture: true }));
  addEventListener('dragstart', () => { arrastando = true; }, true);
  addEventListener('dragend', () => { arrastando = false; ultimaMexida = Date.now(); }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pendente) agendar(400); });
  /* ao trocar de tela, o que estava pendente para a tela anterior não vale */
  addEventListener('hashchange', () => { pendente = false; clearTimeout(relogio); });

  /* liga quando a pessoa entra (e tenta de novo até a sessão existir) */
  let tentativas = 0;
  const t = setInterval(() => {
    if (canal || ++tentativas > 120) return clearInterval(t);
    ligar();
  }, 2000);

  return { ligar, desligar, _depende: DEPENDE, _simular: tabela => aoMudar({ table: tabela }), arrastando: v => { arrastando = !!v; } };
})();
