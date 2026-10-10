/* =====================================================================
   TELEPROMPTER B7 — camada de EXECUÇÃO sobre o roteiro canônico.

   Não tem conteúdo próprio: lê o roteiro e as cenas que já existem no
   B7 (tabelas roteiros/cenas, com o RLS de quem está logado) e mostra de
   dois jeitos:
     • CONTÍNUO  — rolagem tradicional, do começo ao fim.
     • POR CENAS — uma cena por vez, para gravar em takes: PREPARAR
                   (orientação para o videomaker) → APRESENTAR (só a fala).
   Nada é gravado no banco, exceto a ação explícita "Marcar como gravado",
   que é o MESMO check da lista "O que vamos gravar" da gravação.

   Pensado em PAISAGEM: no celular, retrato mostra o aviso de girar.
   Espelhamento horizontal só na área de leitura (vidro do teleprompter);
   os controles nunca espelham.

   Estado de reprodução é local e some ao sair. Preferências (fonte,
   velocidade, espelho…) ficam neste aparelho, em B7.pref.

   zzz148 — CÂMERA: com "Gravar com a câmera" ligado, a câmera da frente
   aparece atrás do texto e cada leitura (uma cena, ou o roteiro inteiro no
   contínuo) vira um vídeo. No app Android o vídeo vai direto para a
   galeria (Filmes/Sistema B7), em partes, sem passar inteiro pela memória;
   no navegador, é baixado ao terminar. Em retrato também (vídeo vertical),
   com a faixa de leitura no alto, perto da câmera, para o olhar não fugir.
   O texto não sai no vídeo: só a câmera é gravada.

   Seções: 1 conteúdo · 2 preferências · 3 aparelho (orientação, tela
   cheia, tela ligada) · 4 rolagem · 5 sessão e telas · 5b câmera ·
   6 entradas.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Teleprompter = (function () {
  const esc = B7.UI.esc;

  /* ================================================================
     1. CONTEÚDO — roteiro canônico → o que o teleprompter mostra
     Fala = cenas.texto. Orientação = cenas.direcao. Imagens sugeridas =
     cenas.sugestao_cenas. Só a fala vai para a área de leitura.
     ================================================================ */
  function normalizar(roteiro, cenas, extra) {
    const lista = (cenas || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0)).map((c, i) => ({
      n: i + 1,
      tipo: String(c.tipo || '').trim(),
      orientacao: String(c.direcao || '').trim(),
      imagens: String(c.sugestao_cenas || '').trim(),
      fala: String(c.texto || '').replace(/\r\n?/g, '\n').trim()
    }));
    return Object.assign({
      id: roteiro.id,
      titulo: String(roteiro.titulo || '').trim() || 'Roteiro sem título',
      observacao: String(roteiro.observacao_gravacao || '').trim(),
      cenas: lista,
      comFala: lista.filter(c => c.fala)
    }, extra || {});
  }

  /* ================================================================
     2. PREFERÊNCIAS — deste aparelho (não vão para o banco)
     ================================================================ */
  const PADRAO = { modo: 'cenas', fonte: 0, velocidade: 7, espaco: 'normal', largura: 'media',
                   espelho: false, contagem: 3, preparar: true, camera: false };
  const ESPACO = { compacto: 1.18, normal: 1.38, amplo: 1.62 };
  const LARGURA = { estreita: 58, media: 76, larga: 94 };
  const FONTE = { min: 26, max: 132, passo: 4 };
  const VEL = { min: 1, max: 20 };
  let P = null;
  function lerPrefs() {
    const salvo = B7.pref.ler('teleprompter', {}) || {};
    P = Object.assign({}, PADRAO, salvo);
    if (!ESPACO[P.espaco]) P.espaco = PADRAO.espaco;
    if (!LARGURA[P.largura]) P.largura = PADRAO.largura;
    if (![0, 3, 5, 10].includes(P.contagem)) P.contagem = PADRAO.contagem;
    if (P.modo !== 'continuo') P.modo = 'cenas';
    P.velocidade = Math.min(VEL.max, Math.max(VEL.min, Number(P.velocidade) || PADRAO.velocidade));
    /* sem tamanho salvo: proporcional à altura da tela em paisagem */
    if (!P.fonte) P.fonte = Math.round(Math.min(72, Math.max(38, Math.min(window.innerWidth, window.innerHeight) * 0.15)) / 2) * 2;
    P.fonte = Math.min(FONTE.max, Math.max(FONTE.min, Number(P.fonte) || 56));
  }
  function gravarPrefs() { B7.pref.gravar('teleprompter', P); }

  /* ================================================================
     3. APARELHO — orientação, tela cheia e tela ligada
     Tudo aqui é melhoria progressiva: sem a API, o teleprompter segue.
     ================================================================ */
  const ehCelular = () => {
    try { return window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; }
    catch (e) { return false; }
  };
  /* pelas medidas da janela, que já estão certas na hora do "resize" — a
     consulta de mídia (orientation) pode atualizar um instante depois */
  const emRetrato = () => window.innerHeight > window.innerWidth;
  /* com a câmera, retrato vale: é o vídeo vertical (Reels, TikTok) */
  const precisaGirar = () => ehCelular() && emRetrato() && !(S && S.camera);

  const elTelaCheia = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function entrarTelaCheia() {
    if (!S || elTelaCheia()) return;
    const pedir = S.el.requestFullscreen || S.el.webkitRequestFullscreen;
    if (!pedir) return;
    try {
      const p = pedir.call(S.el, { navigationUI: 'hide' });
      /* travar em paisagem só funciona (quando funciona) em tela cheia */
      const travar = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
      if (p && p.then) p.then(travar).catch(() => {}); else travar();
    } catch (e) {}
  }
  function sairTelaCheia() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    if (!elTelaCheia()) return;
    try { (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {}); } catch (e) {}
  }

  let trava = null;
  async function manterTelaLigada() {
    if (!S || trava || !('wakeLock' in navigator) || document.hidden) return;
    try {
      trava = await navigator.wakeLock.request('screen');
      trava.addEventListener('release', () => { trava = null; });
      if (!S) soltarTela();           /* fechou enquanto pedia */
    } catch (e) { trava = null; }
  }
  function soltarTela() { try { if (trava) trava.release(); } catch (e) {} trava = null; }

  /* ================================================================
     4. ROLAGEM — um motor só, usado pelo modo contínuo e pelas cenas
     longas. Posição em pixels, movida por transform (sem reflow), no
     ritmo do requestAnimationFrame; a velocidade é em LINHAS por segundo,
     então mudar o tamanho da letra não muda o ritmo de leitura.
     ================================================================ */
  const R = { y: 0, max: 0, tocando: false, raf: 0, ultimo: 0, marcas: [] };
  /* 1 = bem devagar; 7 (padrão) ≈ fala tranquila; 20 = leitura corrida */
  const linhasPorSegundo = () => 0.15 + (P.velocidade - 1) * 0.08;
  /* em pé com a câmera a tela é estreita: a letra cai para ~60% (o ajuste
     A−/A+ continua mexendo nela, proporcionalmente) e o texto usa a
     largura toda */
  const emPeComCamera = () => !!(S && S.camera && emRetrato());
  const fonte = () => emPeComCamera() ? Math.max(FONTE.min, Math.round(P.fonte * 0.6)) : P.fonte;
  const pxPorSegundo = () => linhasPorSegundo() * fonte() * ESPACO[P.espaco];

  function aplicarRolagem() {
    if (!S) return;
    S.rolo.style.transform = 'translate3d(0,' + (-R.y).toFixed(2) + 'px,0)';
    S.prog.style.transform = 'scaleX(' + (R.max > 0 ? Math.min(1, R.y / R.max) : (S.fase === 'cena-ap' ? 1 : 0)) + ')';
  }
  function passo(dt) {
    R.y += pxPorSegundo() * dt;
    if (R.y >= R.max) { R.y = R.max; aplicarRolagem(); pausar(); aoChegarAoFim(); return false; }
    aplicarRolagem();
    acompanharCena();
    return true;
  }
  function quadro(t) {
    if (!R.tocando) return;
    const dt = Math.min(0.06, Math.max(0, (t - R.ultimo) / 1000));
    R.ultimo = t;
    if (passo(dt)) R.raf = requestAnimationFrame(quadro);
  }
  function tocar() {
    if (!S || R.tocando || R.max <= 0 || R.y >= R.max) return;
    R.tocando = true; R.ultimo = performance.now();
    R.raf = requestAnimationFrame(quadro);
    aoMudarReproducao();
  }
  function pausar() {
    if (!R.tocando) return;
    R.tocando = false; cancelAnimationFrame(R.raf);
    aoMudarReproducao();
  }
  function irPara(y) { R.y = Math.min(R.max, Math.max(0, y)); aplicarRolagem(); acompanharCena(); }

  /* mede de novo (mudou letra, largura, tela) mantendo o ponto de leitura */
  function medir(manter) {
    if (!S) return;
    const antes = R.max > 0 ? R.y / R.max : 0;
    const h = S.palco.clientHeight;
    /* com a câmera, a leitura fica no alto, perto da lente */
    const foco = Math.round(h * (S.camera ? 0.17 : 0.36));
    S.el.style.setProperty('--tele-foco', foco + 'px');
    const miolo = S.rolo.firstElementChild;
    const alturaTexto = miolo ? miolo.offsetHeight : 0;
    const cabe = S.fase === 'cena-ap' && alturaTexto <= h - 24;
    S.palco.classList.toggle('cabe', cabe);
    if (cabe) { R.max = 0; R.y = 0; R.marcas = []; }
    else {
      /* a primeira linha nasce na faixa de leitura e a última sai por ela */
      R.max = Math.max(0, alturaTexto - Math.round(fonte() * ESPACO[P.espaco] * 0.6));
      R.marcas = [...S.rolo.querySelectorAll('[data-cena]')].map(el => ({ i: Number(el.dataset.cena), y: el.offsetTop }));
      R.y = manter ? Math.min(R.max, antes * R.max) : 0;
    }
    aplicarRolagem();
  }
  /* no contínuo: em que cena a leitura está (para o "Cena 3 de 7" e os saltos) */
  function cenaNaLeitura() {
    let atual = 0;
    for (const m of R.marcas) { if (m.y <= R.y + 2) atual = m.i; else break; }
    return atual;
  }
  let ultimaCenaVista = -1;
  function acompanharCena() {
    if (!S || S.fase !== 'continuo') return;
    const c = cenaNaLeitura();
    if (c !== ultimaCenaVista) { ultimaCenaVista = c; S.cena = c; pintarOnde(); }
  }

  /* ================================================================
     5. SESSÃO E TELAS
     fase: inicio | continuo | cena-prep | cena-ap | fim | aviso
     ================================================================ */
  let S = null;
  const IC = {
    sair: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" class="cheio"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" class="cheio"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
    ant: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    prox: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    repetir: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4h4"/></svg>',
    espelho: '<svg viewBox="0 0 24 24"><path d="M12 3.5v17"/><path d="M8.5 7.5L4 12l4.5 4.5z"/><path d="M15.5 7.5L20 12l-4.5 4.5z"/></svg>',
    cheia: '<svg viewBox="0 0 24 24"><path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24"><path d="M5 7h9M18 7h1M5 12h2M11 12h8M5 17h7M16 17h3"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="17" r="2"/></svg>',
    girar: '<svg viewBox="0 0 64 64"><rect x="22" y="8" width="20" height="36" rx="4"/><path d="M12 44a22 22 0 0 0 22 14"/><path d="M34 52v6h-6"/><rect x="34" y="30" width="24" height="14" rx="3" class="alvo"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2 8.8-9.4"/></svg>'
  };
  const roteiro = () => S.roteiros[S.i];
  const falas = t => t.split(/\n{1,}/).map(l => l.trim()).filter(Boolean).map(l => '<span>' + esc(l) + '</span>').join('');

  function aplicarPrefs() {
    const e = S.el.style;
    e.setProperty('--tele-fonte', fonte() + 'px');
    e.setProperty('--tele-linha', ESPACO[P.espaco]);
    e.setProperty('--tele-largura', (emPeComCamera() ? 94 : LARGURA[P.largura]) + '%');
    /* espelho é para o vidro do teleprompter; gravando com a câmera, não */
    S.palco.classList.toggle('espelho', !!P.espelho && !S.camera);
    S.el.querySelectorAll('[data-tele="espelho"]').forEach(b => { b.classList.toggle('on', !!P.espelho); b.setAttribute('aria-pressed', String(!!P.espelho)); });
  }

  /* ---------------------------------------------------- montagem */
  function montar() {
    const el = document.createElement('div');
    el.className = 'tele'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Teleprompter');
    el.innerHTML =
      '<div class="tele-palco" id="tele-palco">' +
        '<div class="tele-zona" aria-hidden="true"></div>' +
        '<div class="tele-rolo" id="tele-rolo"></div>' +
        '<div class="tele-contagem" id="tele-contagem" aria-live="assertive" hidden></div>' +
      '</div>' +
      '<div class="tele-prog" aria-hidden="true"><i id="tele-prog"></i></div>' +
      '<header class="tele-topo">' +
        '<button type="button" class="tele-bt" data-tele="sair" aria-label="Sair do teleprompter">' + IC.sair + '</button>' +
        '<div class="tele-onde" id="tele-onde"></div>' +
        '<button type="button" class="tele-bt" data-tele="espelho" aria-pressed="false" aria-label="Espelhar o texto" title="Espelhar (M)">' + IC.espelho + '<span>Espelhar</span></button>' +
        '<button type="button" class="tele-bt" data-tele="cheia" aria-label="Tela cheia" title="Tela cheia (F)">' + IC.cheia + '</button>' +
        '<button type="button" class="tele-bt" data-tele="ajustes" aria-label="Ajustes de leitura" aria-haspopup="dialog">' + IC.ajustes + '</button>' +
      '</header>' +
      '<div class="tele-rec" id="tele-rec" hidden><i></i><span id="tele-rec-t">REC 0:00</span>' +
        '<button type="button" data-tele="parar-gravacao" aria-label="Parar a gravação e salvar">Parar</button></div>' +
      '<footer class="tele-ctrl" id="tele-ctrl"></footer>' +
      '<section class="tele-painel" id="tele-painel" hidden></section>' +
      '<aside class="tele-folha" id="tele-folha" role="dialog" aria-label="Ajustes de leitura" hidden></aside>' +
      '<div class="tele-gate" id="tele-gate" role="alert" hidden>' + IC.girar +
        '<b>Gire o celular para continuar</b><span>O Teleprompter B7 funciona no modo paisagem.</span>' +
        (camDisponivel() ? '<button type="button" class="tele-acao" data-tele="camera">Gravar em pé com a câmera</button>' : '') +
        '<button type="button" class="tele-bt texto" data-tele="sair">Sair</button></div>';
    document.body.appendChild(el);
    document.body.classList.add('tele-aberto');
    return el;
  }

  function pintarOnde() {
    if (!S) return;
    const r = roteiro(); const cx = S.el.querySelector('#tele-onde');
    const partes = [];
    if (S.roteiros.length > 1) partes.push('Roteiro ' + (S.i + 1) + ' de ' + S.roteiros.length);
    const lista = S.fase === 'continuo' ? r.comFala : r.cenas;
    if ((S.fase === 'continuo' || S.fase === 'cena-ap' || S.fase === 'cena-prep') && lista.length) {
      partes.push('Cena ' + (Math.min(S.cena, lista.length - 1) + 1) + ' de ' + lista.length);
    }
    /* na tela de início o título já está no painel: aqui fica só o contexto */
    cx.innerHTML = S.fase === 'inicio'
      ? '<b>Teleprompter</b><small>' + esc(S.ctx.cliente || '') + '</small>'
      : '<b>' + esc(r ? r.titulo : 'Teleprompter') + '</b><small>' + esc(partes.join(' · ')) + '</small>';
  }

  /* --------------------------------------------- controles (rodapé) */
  function bt(acao, ic, rotulo, extra) {
    return '<button type="button" class="tele-bt ' + (extra || '') + '" data-tele="' + acao + '" aria-label="' + esc(rotulo) + '" title="' + esc(rotulo) + '">' + ic + '</button>';
  }
  function pintarCtrl() {
    if (!S) return;
    const cx = S.el.querySelector('#tele-ctrl');
    const rola = R.max > 0;
    const tocando = R.tocando;
    const principal = S.contando
      ? bt('cancelar-contagem', IC.pausa, 'Cancelar a contagem', 'pri')
      : bt('tocar', tocando ? IC.pausa : IC.play, tocando ? 'Pausar (Espaço)' : 'Continuar (Espaço)', 'pri');
    const ajusteRapido =
      '<span class="tele-grupo" role="group" aria-label="Velocidade">' +
        '<button type="button" class="tele-bt texto" data-tele="vel-" aria-label="Mais devagar">−</button>' +
        '<output id="tele-vel" aria-label="Velocidade">' + P.velocidade + '</output>' +
        '<button type="button" class="tele-bt texto" data-tele="vel+" aria-label="Mais rápido">+</button></span>' +
      '<span class="tele-grupo" role="group" aria-label="Tamanho do texto">' +
        '<button type="button" class="tele-bt texto" data-tele="fonte-" aria-label="Diminuir o texto">A−</button>' +
        '<button type="button" class="tele-bt texto" data-tele="fonte+" aria-label="Aumentar o texto">A+</button></span>';
    if (S.fase === 'continuo') {
      cx.innerHTML =
        '<span class="tele-grupo">' + bt('reiniciar', IC.repetir, 'Voltar ao início (R)') + bt('cena-ant', IC.ant, 'Cena anterior (←)') + '</span>' +
        principal +
        '<span class="tele-grupo">' + bt('cena-prox', IC.prox, 'Próxima cena (→)') + '</span>' + ajusteRapido;
    } else if (S.fase === 'cena-ap') {
      const ultima = S.cena >= roteiro().cenas.length - 1;
      cx.innerHTML =
        '<button type="button" class="tele-bt rot" data-tele="cena-ant"' + (S.cena === 0 ? ' disabled' : '') + '>' + IC.ant + '<span>Anterior</span></button>' +
        '<button type="button" class="tele-bt rot" data-tele="repetir">' + IC.repetir + '<span>Repetir</span></button>' +
        (rola || S.contando ? principal : '') +
        '<button type="button" class="tele-bt rot pri-rot" data-tele="cena-prox">' + '<span>' + (ultima ? 'Finalizar roteiro' : 'Próxima cena') + '</span>' + IC.prox + '</button>' +
        (rola ? ajusteRapido : '<span class="tele-grupo" role="group" aria-label="Tamanho do texto">' +
          '<button type="button" class="tele-bt texto" data-tele="fonte-" aria-label="Diminuir o texto">A−</button>' +
          '<button type="button" class="tele-bt texto" data-tele="fonte+" aria-label="Aumentar o texto">A+</button></span>');
    } else cx.innerHTML = '';
  }

  /* some com os controles enquanto a pessoa lê; um toque traz de volta */
  let tempoQuieto = 0;
  function mostrarControles() {
    if (!S) return;
    S.el.classList.remove('tele-quieto');
    clearTimeout(tempoQuieto);
    const lendo = (S.fase === 'continuo' || S.fase === 'cena-ap') && (R.tocando || S.contando || (S.fase === 'cena-ap' && R.max === 0 && S.apresentando));
    if (lendo && S.folha.hidden) tempoQuieto = setTimeout(() => { if (S) S.el.classList.add('tele-quieto'); }, 3200);
  }
  function aoMudarReproducao() { pintarCtrl(); mostrarControles(); }

  /* ------------------------------------------------- contagem */
  let contagemT = 0;
  function contar(depois) {
    cancelarContagem();
    const n = P.contagem;
    if (!n) { depois(); return; }
    const cx = S.el.querySelector('#tele-contagem');
    S.contando = true; S.palco.classList.add('contando');
    let falta = n;
    const tique = () => {
      if (!S || !S.contando) return;
      if (falta <= 0) { cancelarContagem(); depois(); return; }
      cx.hidden = false; cx.textContent = falta; cx.classList.remove('bate'); void cx.offsetWidth; cx.classList.add('bate');
      falta--; contagemT = setTimeout(tique, 1000);
    };
    tique(); pintarCtrl(); mostrarControles();
  }
  function cancelarContagem() {
    clearTimeout(contagemT);
    if (!S) return;
    const era = S.contando; S.contando = false;
    S.palco.classList.remove('contando');
    const cx = S.el.querySelector('#tele-contagem'); if (cx) cx.hidden = true;
    if (era) { pintarCtrl(); mostrarControles(); }
  }

  /* ------------------------------------------------- painéis */
  function painel(html, classe) {
    const cx = S.el.querySelector('#tele-painel');
    cx.className = 'tele-painel ' + (classe || '');
    cx.innerHTML = html; cx.hidden = false;
    S.el.classList.add('com-painel');
    const foco = cx.querySelector('[data-foco]'); if (foco) foco.focus({ preventScroll: true });
  }
  function fecharPainel() {
    const cx = S.el.querySelector('#tele-painel'); cx.hidden = true; cx.innerHTML = '';
    S.el.classList.remove('com-painel');
  }

  function ajustesHTML() {
    const seg = (chave, opcoes) => '<div class="tele-seg" role="radiogroup">' + opcoes.map(([v, r]) =>
      '<button type="button" role="radio" aria-checked="' + (String(P[chave]) === String(v)) + '" data-pref="' + chave + '" data-valor="' + v + '">' + esc(r) + '</button>').join('') + '</div>';
    const liga = (chave, rotulo, dica) => '<label class="tele-liga"><span><b>' + esc(rotulo) + '</b>' + (dica ? '<small>' + esc(dica) + '</small>' : '') + '</span>' +
      '<button type="button" role="switch" aria-checked="' + !!P[chave] + '" data-pref="' + chave + '" aria-label="' + esc(rotulo) + '"><i></i></button></label>';
    return '<div class="tele-ajustes">' +
      '<div class="tele-aj"><span>Tamanho do texto</span><div class="tele-passo">' +
        '<button type="button" data-tele="fonte-" aria-label="Diminuir o texto">A−</button><output data-mostra="fonte">' + P.fonte + '</output>' +
        '<button type="button" data-tele="fonte+" aria-label="Aumentar o texto">A+</button></div></div>' +
      '<div class="tele-aj"><span>Velocidade</span><div class="tele-passo">' +
        '<button type="button" data-tele="vel-" aria-label="Mais devagar">−</button><output data-mostra="velocidade">' + P.velocidade + '</output>' +
        '<button type="button" data-tele="vel+" aria-label="Mais rápido">+</button></div></div>' +
      '<div class="tele-aj"><span>Espaçamento</span>' + seg('espaco', [['compacto', 'Compacto'], ['normal', 'Normal'], ['amplo', 'Amplo']]) + '</div>' +
      '<div class="tele-aj"><span>Largura do texto</span>' + seg('largura', [['estreita', 'Estreita'], ['media', 'Média'], ['larga', 'Larga']]) + '</div>' +
      '<div class="tele-aj"><span>Contagem regressiva</span>' + seg('contagem', [[0, 'Desligada'], [3, '3s'], [5, '5s'], [10, '10s']]) + '</div>' +
      liga('espelho', 'Espelhar', 'Para o vidro do teleprompter. Só o texto espelha.') +
      liga('preparar', 'Preparar antes de cada cena', 'No modo por cenas, mostra a orientação antes da fala.') +
    '</div>';
  }
  function atualizarAjustes() {
    S.el.querySelectorAll('[data-mostra]').forEach(o => { o.textContent = P[o.dataset.mostra]; });
    S.el.querySelectorAll('[data-pref]').forEach(b => {
      if (b.getAttribute('role') === 'switch') b.setAttribute('aria-checked', String(!!P[b.dataset.pref]));
      else b.setAttribute('aria-checked', String(String(P[b.dataset.pref]) === b.dataset.valor));
    });
    const v = S.el.querySelector('#tele-vel'); if (v) v.textContent = P.velocidade;
  }
  function mudarPref(chave, valor) {
    if (chave === 'contagem') valor = Number(valor);
    P[chave] = valor; gravarPrefs(); aplicarPrefs(); atualizarAjustes();
    if (chave === 'espaco' || chave === 'largura') medir(true);
  }
  function mudarFonte(delta) {
    P.fonte = Math.min(FONTE.max, Math.max(FONTE.min, P.fonte + delta * FONTE.passo));
    gravarPrefs(); aplicarPrefs(); atualizarAjustes(); medir(true);
    if (S.fase === 'cena-ap') pintarCtrl();
  }
  function mudarVelocidade(delta) {
    P.velocidade = Math.min(VEL.max, Math.max(VEL.min, P.velocidade + delta));
    gravarPrefs(); atualizarAjustes();
  }
  function abrirFolha() {
    pausar(); cancelarContagem();
    S.folha.innerHTML = '<div class="tele-folha-cab"><b>Ajustes de leitura</b>' +
      '<button type="button" class="tele-bt" data-tele="fechar-folha" aria-label="Fechar os ajustes" data-foco>' + IC.sair + '</button></div>' + ajustesHTML();
    S.folha.hidden = false; S.el.classList.add('com-folha');
    S.folha.querySelector('[data-foco]').focus({ preventScroll: true });
    mostrarControles();
  }
  function fecharFolha() { S.folha.hidden = true; S.folha.innerHTML = ''; S.el.classList.remove('com-folha'); mostrarControles(); }

  /* ---- tela de início: roteiro, modo e ajustes — pronto em segundos */
  function telaInicio() {
    pausar(); cancelarContagem(); pararGravacao();
    S.fase = 'inicio'; S.apresentando = false;
    S.rolo.innerHTML = ''; R.max = 0; R.y = 0; aplicarRolagem();
    const r = roteiro();
    const semFala = !r.comFala.length;
    const lista = S.roteiros.length > 1
      ? '<div class="tele-lista" role="listbox" aria-label="Roteiros desta gravação">' + S.roteiros.map((x, i) =>
          '<button type="button" role="option" aria-selected="' + (i === S.i) + '" data-roteiro="' + i + '">' +
            '<i>' + String(i + 1).padStart(2, '0') + '</i><span><b>' + esc(x.titulo) + '</b><small>' +
              (x.comFala.length ? x.cenas.length + (x.cenas.length === 1 ? ' cena' : ' cenas') : 'sem fala escrita') +
              (x.gravado ? ' · gravado' : '') + '</small></span>' + (x.gravado ? '<em>' + IC.check + '</em>' : '') + '</button>').join('') + '</div>'
      : '';
    painel(
      '<div class="tele-inicio">' +
        '<div class="tele-col">' +
          '<small class="tele-olho">' + (S.roteiros.length > 1 ? 'ROTEIRO ' + (S.i + 1) + ' DE ' + S.roteiros.length : 'ROTEIRO') + '</small>' +
          '<h2>' + esc(r.titulo) + '</h2>' +
          '<p class="tele-sub">' +
            (semFala ? 'Este roteiro ainda não tem fala escrita.' : r.cenas.length + (r.cenas.length === 1 ? ' cena' : ' cenas')) + '</p>' +
          '<div class="tele-modo" role="radiogroup" aria-label="Modo">' +
            '<button type="button" role="radio" aria-checked="' + (P.modo === 'cenas') + '" data-modo="cenas"><b>Por cenas</b><small>Uma cena por vez, para gravar em takes</small></button>' +
            '<button type="button" role="radio" aria-checked="' + (P.modo === 'continuo') + '" data-modo="continuo"><b>Contínuo</b><small>O roteiro inteiro, rolando</small></button>' +
          '</div>' +
          (camDisponivel()
            ? '<label class="tele-liga tele-cam-liga"><span><b>Gravar com a câmera</b><small>' +
                (S.camera ? 'Câmera da frente ligada. Cada leitura vira um vídeo' + (B7.AppNativo && B7.AppNativo.ativo ? ' na galeria.' : ', baixado ao terminar.')
                  : 'A câmera da frente grava enquanto você lê.') + '</small></span>' +
                '<button type="button" role="switch" aria-checked="' + !!S.camera + '" data-tele="camera" aria-label="Gravar com a câmera"><i></i></button></label>'
            : '') +
          '<button type="button" class="tele-acao" data-tele="iniciar" data-foco' + (semFala ? ' disabled' : '') + '>' + IC.play + '<span>' + (S.camera ? 'Iniciar e gravar' : 'Iniciar') + '</span></button>' +
          (semFala ? '<p class="tele-nota">Escreva a fala das cenas no roteiro para usar o teleprompter.</p>' : '') +
          (lista ? '<small class="tele-rotulo">Roteiros desta gravação</small>' + lista : '') +
        '</div>' +
        '<div class="tele-col">' + ajustesHTML() + '</div>' +
      '</div>', 'inicio');
    pintarOnde(); pintarCtrl(); mostrarControles();
  }

  /* ---------------------------------------------- modo contínuo */
  function iniciarContinuo() {
    fecharPainel(); pararGravacao();
    S.fase = 'continuo'; S.cena = 0; ultimaCenaVista = -1; S.apresentando = true;
    const r = roteiro();
    S.rolo.innerHTML = '<div class="tele-texto">' + r.comFala.map((c, i) =>
      '<p class="tele-fala" data-cena="' + i + '">' + falas(c.fala) + '</p>').join('') + '</div>';
    medir(false); pintarOnde(); pintarCtrl();
    contar(() => { gravar('roteiro'); tocar(); });
  }

  /* ------------------------------------------------ modo por cenas */
  function prepararCena(i) {
    pausar(); cancelarContagem(); pararGravacao();
    const r = roteiro();
    S.cena = Math.min(r.cenas.length - 1, Math.max(0, i));
    S.fase = 'cena-prep'; S.apresentando = false;
    S.rolo.innerHTML = ''; R.max = 0; R.y = 0; aplicarRolagem();
    const c = r.cenas[S.cena];
    const imagens = c.imagens ? c.imagens.split('\n').map(l => l.trim()).filter(Boolean) : [];
    painel(
      '<div class="tele-prep">' +
        '<div class="tele-prep-cab"><span class="tele-num">CENA ' + c.n + ' DE ' + r.cenas.length + '</span>' +
          (c.tipo ? '<span class="tele-tipo">' + esc(c.tipo) + '</span>' : '') + '</div>' +
        (S.cena === 0 && r.observacao ? '<div class="tele-campo"><small>Observação da gravação</small><p>' + esc(r.observacao) + '</p></div>' : '') +
        (c.orientacao ? '<div class="tele-campo"><small>Orientação</small><p>' + esc(c.orientacao) + '</p></div>' : '') +
        (imagens.length ? '<div class="tele-campo"><small>Imagens sugeridas</small><ul>' + imagens.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') +
        '<div class="tele-campo fala"><small>Fala</small>' + (c.fala ? '<p>' + esc(c.fala).replace(/\n+/g, '<br>') + '</p>' : '<p class="vazio">Cena sem fala escrita.</p>') + '</div>' +
        '<div class="tele-prep-acoes">' +
          '<button type="button" class="tele-bt rot" data-tele="cena-ant"' + (S.cena === 0 ? ' disabled' : '') + '>' + IC.ant + '<span>Anterior</span></button>' +
          (c.fala
            ? '<button type="button" class="tele-acao" data-tele="apresentar" data-foco>' + IC.play + '<span>Apresentar cena</span></button>'
            : '<button type="button" class="tele-acao" data-tele="cena-prox" data-foco><span>' + (S.cena >= r.cenas.length - 1 ? 'Finalizar roteiro' : 'Próxima cena') + '</span>' + IC.prox + '</button>') +
          (c.fala ? '<button type="button" class="tele-bt rot" data-tele="cena-prox"><span>' + (S.cena >= r.cenas.length - 1 ? 'Finalizar' : 'Pular') + '</span>' + IC.prox + '</button>' : '') +
        '</div>' +
      '</div>', 'prep');
    pintarOnde(); pintarCtrl(); mostrarControles();
  }
  function apresentarCena(i, repeticao) {
    pausar(); cancelarContagem(); fecharPainel(); pararGravacao();
    const r = roteiro();
    S.cena = Math.min(r.cenas.length - 1, Math.max(0, i));
    const c = r.cenas[S.cena];
    if (!c.fala) { prepararCena(S.cena); return; }
    S.fase = 'cena-ap'; S.apresentando = true;
    S.rolo.innerHTML = '<div class="tele-texto"><p class="tele-fala">' + falas(c.fala) + '</p></div>';
    medir(false); pintarOnde(); pintarCtrl();
    contar(() => { gravar('cena ' + c.n); if (R.max > 0) tocar(); else { pintarCtrl(); mostrarControles(); } });
  }
  function irCena(delta) {
    const r = roteiro();
    if (S.fase === 'continuo') {
      const atual = cenaNaLeitura();
      const alvo = R.marcas.find(m => m.i === atual + delta);
      /* "anterior" no meio de uma cena volta ao começo dela primeiro */
      const inicioAtual = (R.marcas.find(m => m.i === atual) || { y: 0 }).y;
      if (delta < 0 && R.y - inicioAtual > fonte()) irPara(inicioAtual);
      else if (alvo) irPara(alvo.y);
      else if (delta > 0) { irPara(R.max); pausar(); aoChegarAoFim(); }
      return;
    }
    const alvo = S.cena + delta;
    if (alvo < 0) return;
    if (alvo >= r.cenas.length) { telaFim(); return; }
    if (P.preparar || !r.cenas[alvo].fala) prepararCena(alvo); else apresentarCena(alvo);
  }
  function repetir() {
    if (S.fase === 'cena-ap') apresentarCena(S.cena, true);
    else if (S.fase === 'continuo') { pausar(); cancelarContagem(); irPara(0); pintarCtrl(); mostrarControles(); }
  }
  function aoChegarAoFim() {
    if (!S) return;
    if (S.fase === 'continuo') setTimeout(() => { if (S && S.fase === 'continuo' && R.y >= R.max) telaFim(); }, 1400);
    else { pintarCtrl(); mostrarControles(); }
  }

  /* ---------------------------------------------------- fim do roteiro */
  function telaFim() {
    pausar(); cancelarContagem(); pararGravacao();
    S.fase = 'fim'; S.apresentando = false;
    const r = roteiro(); const prox = S.roteiros[S.i + 1];
    const podeMarcar = !!(r.itemId && S.ctx.marcar && S.ctx.podeMarcar);
    painel(
      '<div class="tele-fim">' +
        '<small class="tele-olho">FIM DO ROTEIRO' + (S.roteiros.length > 1 ? ' · ' + (S.i + 1) + ' DE ' + S.roteiros.length : '') + '</small>' +
        '<h2>' + esc(r.titulo) + '</h2>' +
        (podeMarcar
          ? (r.gravado
              ? '<p class="tele-ok">' + IC.check + '<span>Marcado como gravado na lista da gravação.</span></p>'
              : '<button type="button" class="tele-bt rot marca" data-tele="marcar">' + IC.check + '<span>Marcar como gravado</span></button>' +
                '<p class="tele-nota" id="tele-marca-msg">É o mesmo check da lista “O que vamos gravar”. Nada é marcado sozinho.</p>')
          : '') +
        '<div class="tele-prep-acoes">' +
          '<button type="button" class="tele-bt rot" data-tele="de-novo">' + IC.repetir + '<span>Repetir roteiro</span></button>' +
          (prox ? '<button type="button" class="tele-acao" data-tele="prox-roteiro" data-foco><span>Próximo: ' + esc(prox.titulo) + '</span>' + IC.prox + '</button>'
                : '<button type="button" class="tele-acao" data-tele="sair" data-foco><span>Concluir</span></button>') +
          (S.roteiros.length > 1 ? '<button type="button" class="tele-bt rot" data-tele="lista"><span>Ver roteiros</span></button>' : '') +
        '</div>' +
      '</div>', 'fim');
    pintarOnde(); pintarCtrl(); mostrarControles();
  }
  function comecarRoteiro() {
    if (!roteiro().comFala.length) { telaInicio(); return; }
    if (P.modo === 'continuo') iniciarContinuo();
    else if (P.preparar) prepararCena(0); else apresentarCena(0);
  }
  async function marcarGravado() {
    const r = roteiro(); const b = S.el.querySelector('[data-tele="marcar"]'); const msg = S.el.querySelector('#tele-marca-msg');
    if (!b || !r.itemId) return;
    b.disabled = true;
    try { await S.ctx.marcar(r.itemId); r.gravado = true; if (S && S.fase === 'fim') telaFim(); }
    catch (e) { b.disabled = false; if (msg) { msg.textContent = 'Não foi possível marcar agora. Tente de novo ou marque na lista da gravação.'; msg.classList.add('erro'); } }
  }

  function telaAviso(titulo, texto) {
    S.fase = 'aviso';
    painel('<div class="tele-fim"><small class="tele-olho">TELEPROMPTER</small><h2>' + esc(titulo) + '</h2><p class="tele-sub">' + esc(texto) + '</p>' +
      '<div class="tele-prep-acoes"><button type="button" class="tele-acao" data-tele="sair" data-foco><span>Voltar</span></button></div></div>', 'fim');
    S.el.querySelector('#tele-onde').innerHTML = '<b>Teleprompter</b>';
  }

  /* --------------------------------------------- orientação e janela */
  function conferirOrientacao() {
    if (!S) return;
    S.tamanho = window.innerWidth + 'x' + window.innerHeight;
    const girar = precisaGirar();
    const gate = S.el.querySelector('#tele-gate');
    if (girar && gate.hidden) { pausar(); cancelarContagem(); gate.hidden = false; S.el.classList.add('com-gate'); }
    else if (!girar && !gate.hidden) { gate.hidden = true; S.el.classList.remove('com-gate'); }
    if (!girar) { if (S.camera) aplicarPrefs(); medir(true); mostrarControles(); }
  }
  let medirT = 0;
  let medirT2 = 0;
  const aoRedimensionar = () => {
    clearTimeout(medirT); clearTimeout(medirT2);
    medirT = setTimeout(conferirOrientacao, 80);
    medirT2 = setTimeout(conferirOrientacao, 450);      /* alguns aparelhos terminam de girar depois do evento */
  };
  function aoMudarVisibilidade() {
    if (!S) return;
    if (document.hidden) { pausar(); cancelarContagem(); }
    else manterTelaLigada();
  }

  /* -------------------------------------------------------- ações */
  function agir(a, alvo) {
    if (!S) return;
    if (a === 'sair') return fechar();
    if (a === 'espelho') return mudarPref('espelho', !P.espelho);
    if (a === 'cheia') return elTelaCheia() ? sairTelaCheia() : entrarTelaCheia();
    if (a === 'ajustes') return S.folha.hidden ? abrirFolha() : fecharFolha();
    if (a === 'fechar-folha') return fecharFolha();
    if (a === 'fonte-') return mudarFonte(-1);
    if (a === 'fonte+') return mudarFonte(1);
    if (a === 'vel-') return mudarVelocidade(-1);
    if (a === 'vel+') return mudarVelocidade(1);
    if (a === 'iniciar') { entrarTelaCheia(); manterTelaLigada(); return comecarRoteiro(); }
    if (a === 'apresentar') return apresentarCena(S.cena);
    if (a === 'tocar') {
      if (S.contando) return cancelarContagem();
      if (R.tocando) return pausar();
      if (R.max > 0 && R.y >= R.max) return;
      return R.y === 0 ? contar(() => tocar()) : tocar();
    }
    if (a === 'cancelar-contagem') return cancelarContagem();
    if (a === 'reiniciar' || a === 'repetir') return repetir();
    if (a === 'cena-ant') return irCena(-1);
    if (a === 'cena-prox') return irCena(1);
    if (a === 'de-novo') return comecarRoteiro();
    if (a === 'prox-roteiro') { S.i = Math.min(S.roteiros.length - 1, S.i + 1); return comecarRoteiro(); }
    if (a === 'lista') return telaInicio();
    if (a === 'marcar') return marcarGravado();
    if (a === 'camera') return alternarCamera();
    if (a === 'parar-gravacao') return pararGravacao();
  }
  function aoClicar(e) {
    if (!S) return;
    const b = e.target.closest('[data-tele],[data-pref],[data-modo],[data-roteiro]');
    if (!b || b.disabled) {
      /* toque na área de leitura: mostra ou esconde os controles */
      if (e.target.closest('.tele-palco')) {
        if (S.el.classList.contains('tele-quieto')) mostrarControles();
        else if (R.tocando || (S.fase === 'cena-ap' && R.max === 0)) S.el.classList.add('tele-quieto');
      }
      return;
    }
    if (b.dataset.tele) agir(b.dataset.tele, b);
    else if (b.dataset.modo) { P.modo = b.dataset.modo; gravarPrefs(); S.el.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-checked', String(x === b))); }
    else if (b.dataset.roteiro) { S.i = Number(b.dataset.roteiro); telaInicio(); }
    else if (b.dataset.pref) mudarPref(b.dataset.pref, b.getAttribute('role') === 'switch' ? !P[b.dataset.pref] : b.dataset.valor);
    mostrarControles();
  }
  function aoTeclar(e) {
    if (!S || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!S.el.querySelector('#tele-gate').hidden) { if (e.key === 'Escape') fechar(); return; }
    const k = e.key;
    const emBotao = e.target && e.target.closest && e.target.closest('button');
    /* o teleprompter está por cima de tudo: os atalhos da tela de trás não disparam */
    if (k !== 'Tab') e.stopPropagation();
    if (k === 'Escape') {
      e.preventDefault();
      if (!S.folha.hidden) return fecharFolha();
      if (elTelaCheia()) return;                     /* o navegador sai da tela cheia */
      if (S.fase === 'cena-ap') return prepararCena(S.cena);
      if (S.fase === 'continuo' || S.fase === 'cena-prep' || S.fase === 'fim') return telaInicio();
      return fechar();
    }
    if (S.fase === 'inicio' || S.fase === 'aviso' || !S.folha.hidden) return;
    if (k === ' ' || k === 'Spacebar') {
      if (emBotao) return;                            /* o botão focado já responde ao espaço */
      e.preventDefault();
      if (S.fase === 'cena-prep') return agir(roteiro().cenas[S.cena].fala ? 'apresentar' : 'cena-prox');
      if (S.fase === 'cena-ap' && R.max === 0 && !S.contando) return;
      if (S.fase === 'fim') return;
      return agir('tocar');
    }
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); return S.fase === 'fim' ? null : irCena(1); }
    if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); return S.fase === 'fim' ? null : irCena(-1); }
    if (k === 'ArrowUp') { e.preventDefault(); return mudarVelocidade(1); }
    if (k === 'ArrowDown') { e.preventDefault(); return mudarVelocidade(-1); }
    if (k === 'r' || k === 'R') return repetir();
    if (k === 'm' || k === 'M') return agir('espelho');
    if (k === 'f' || k === 'F') return agir('cheia');
    if (k === '+' || k === '=') return mudarFonte(1);
    if (k === '-' || k === '_') return mudarFonte(-1);
    mostrarControles();
  }

  /* --------------------------------------------- abrir e fechar */
  let empurrou = false;
  const aoVoltar = () => { empurrou = false; fechar(true); };
  const aoTrocarRota = () => fechar(true);

  function criarSessao(ctx) {
    if (S) fechar(true);
    lerPrefs();
    const el = montar();
    S = { el, palco: el.querySelector('#tele-palco'), rolo: el.querySelector('#tele-rolo'), prog: el.querySelector('#tele-prog'),
          folha: el.querySelector('#tele-folha'), roteiros: [], i: 0, cena: 0, fase: 'inicio', contando: false, apresentando: false,
          ctx: ctx || {}, anterior: document.activeElement };
    R.y = 0; R.max = 0; R.tocando = false; R.marcas = [];
    /* o resto da página fica fora do alcance do teclado e do leitor de tela */
    S.inertes = [...document.body.children].filter(c => c !== el && !c.inert);
    S.inertes.forEach(c => { try { c.inert = true; } catch (e) {} });
    aplicarPrefs();
    el.addEventListener('click', aoClicar);
    document.addEventListener('keydown', aoTeclar, true);
    window.addEventListener('resize', aoRedimensionar);
    window.addEventListener('orientationchange', aoRedimensionar);
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    el.addEventListener('pointermove', mostrarControles, { passive: true });
    /* rede de segurança: há navegador que gira a tela sem avisar por
       "resize". Conferir o tamanho duas vezes por segundo custa nada e
       garante o aviso de girar (e a pausa) em qualquer aparelho. */
    S.tamanho = window.innerWidth + 'x' + window.innerHeight;
    S.vigia = setInterval(() => {
      if (!S) return;
      const agora = window.innerWidth + 'x' + window.innerHeight;
      if (agora !== S.tamanho) { S.tamanho = agora; conferirOrientacao(); }
    }, 500);
    /* o "voltar" do Android fecha o teleprompter em vez de sair da página */
    try { history.pushState({ b7tele: 1 }, '', location.href); empurrou = true; window.addEventListener('popstate', aoVoltar); } catch (e) {}
    window.addEventListener('hashchange', aoTrocarRota);
    /* tela cheia JÁ na abertura (ainda dentro do toque que abriu o
       teleprompter): o aviso do navegador "para sair da tela cheia…" não
       pode ser removido por nenhuma página, então ele aparece aqui, na
       tela de preparação, e já sumiu quando a leitura começa. */
    entrarTelaCheia();
    manterTelaLigada();
    if (P.camera && camDisponivel()) ligarCamera();
    conferirOrientacao();
    return S;
  }
  function fechar(semHistorico) {
    if (!S) return;
    pausar(); cancelarContagem(); clearTimeout(tempoQuieto); clearTimeout(medirT); clearTimeout(medirT2); clearInterval(S.vigia);
    desligarCamera();
    sairTelaCheia(); soltarTela();
    document.removeEventListener('keydown', aoTeclar, true);
    window.removeEventListener('resize', aoRedimensionar);
    window.removeEventListener('orientationchange', aoRedimensionar);
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    window.removeEventListener('popstate', aoVoltar);
    window.removeEventListener('hashchange', aoTrocarRota);
    (S.inertes || []).forEach(c => { try { c.inert = false; } catch (e) {} });
    const foco = S.anterior, aoFechar = S.ctx.aoFechar;
    S.el.remove(); document.body.classList.remove('tele-aberto');
    S = null;
    if (empurrou && semHistorico !== true) { empurrou = false; try { history.back(); } catch (e) {} }
    empurrou = false;
    if (foco && foco.focus && document.contains(foco)) { try { foco.focus({ preventScroll: true }); } catch (e) {} }
    if (aoFechar) { try { aoFechar(); } catch (e) {} }
  }

  /* ================================================================
     5b. CÂMERA — vídeo da câmera da frente atrás do texto e gravação
     ================================================================ */
  const camDisponivel = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const TIPOS_VIDEO = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'], ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm']
  ];
  const tipoVideo = () => TIPOS_VIDEO.find(([t]) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || ['', 'webm'];

  async function ligarCamera() {
    if (!S || S.camera || S.ligandoCamera) return;
    const minha = S;
    S.ligandoCamera = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      if (S !== minha) { stream.getTracks().forEach(t => t.stop()); return; }
      const v = document.createElement('video');
      v.className = 'tele-cam'; v.muted = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute('playsinline', ''); v.srcObject = stream;
      S.el.insertBefore(v, S.el.firstChild);
      v.play().catch(() => {});
      S.camera = { stream, video: v, rec: null };
      S.el.classList.add('com-camera');
      P.camera = true; gravarPrefs(); aplicarPrefs();
    } catch (e) {
      if (S !== minha) return;
      P.camera = false; gravarPrefs();
      const negou = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      B7.UI.toast(negou ? 'Sem permissão para a câmera e o microfone. Libere nas configurações e tente de novo.'
        : 'Não foi possível abrir a câmera.', { tipo: 'erro' });
    } finally {
      if (S === minha) S.ligandoCamera = false;
    }
    if (S === minha) { conferirOrientacao(); if (S.fase === 'inicio') telaInicio(); }
  }

  function desligarCamera() {
    if (!S || !S.camera) return;
    pararGravacao();
    try { S.camera.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    S.camera.video.remove();
    S.camera = null;
    S.el.classList.remove('com-camera');
    aplicarPrefs();
  }

  function alternarCamera() {
    if (S.camera) { desligarCamera(); P.camera = false; gravarPrefs(); conferirOrientacao(); telaInicio(); }
    else ligarCamera();
  }

  /* para onde vai o vídeo: galeria do celular (app) ou download (navegador) */
  function destinoDoVideo(nome, tipo, ext) {
    const N = B7.AppNativo;
    if (N && N.ativo && N.pedir) {
      let fila = N.pedir('videoInicio', { nome: nome + '.' + ext, tipo }).then(r => { if (!r.ok) throw new Error('galeria'); });
      return {
        parte: blob => {
          fila = fila.then(() => blob.arrayBuffer()).then(buf => {
            if (N.recursos && N.recursos.binario && window.B7Nativo) window.B7Nativo.postMessage(buf);
            else return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); })
              .then(b64 => N.pedir('videoParte', { base64: b64 }));
          });
        },
        fim: () => fila.then(() => N.pedir('videoFim')).then(r => { if (!r.ok) throw new Error('galeria'); })
          .catch(() => { N.pedir('videoCancelar'); B7.UI.toast('Não foi possível salvar o vídeo na galeria.', { tipo: 'erro' }); })
      };
    }
    const partes = [];
    return {
      parte: blob => partes.push(blob),
      fim: () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(partes, { type: tipo || 'video/webm' }));
        a.download = nome + '.' + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        B7.UI.toast('Vídeo baixado: ' + a.download);
      }
    };
  }

  /* começa a gravar quando a leitura começa (fim da contagem) */
  function gravar(oQue) {
    if (!S || !S.camera || S.camera.rec) return;
    const [tipo, ext] = tipoVideo();
    const r = roteiro();
    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0') + 'h' + String(agora.getMinutes()).padStart(2, '0') + '-' + String(agora.getSeconds()).padStart(2, '0');
    const nome = ('B7 ' + (r ? r.titulo : 'teleprompter') + ' ' + oQue + ' ' + hora).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    let rec;
    try { rec = new MediaRecorder(S.camera.stream, Object.assign({ videoBitsPerSecond: 8000000 }, tipo ? { mimeType: tipo } : {})); }
    catch (e) { B7.UI.toast('Este aparelho não grava vídeo por aqui.', { tipo: 'erro' }); return; }
    const destino = destinoDoVideo(nome, rec.mimeType || tipo, ext);
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) destino.parte(ev.data); };
    rec.onstop = () => destino.fim();
    rec.start(1000);
    const cam = S.camera;
    cam.rec = rec; cam.inicio = Date.now();
    const caixa = S.el.querySelector('#tele-rec'), tempo = S.el.querySelector('#tele-rec-t');
    caixa.hidden = false;
    const pintar = () => { const t = Math.floor((Date.now() - cam.inicio) / 1000); tempo.textContent = 'REC ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    pintar(); cam.relogio = setInterval(pintar, 500);
  }

  function pararGravacao() {
    if (!S || !S.camera || !S.camera.rec) return;
    const cam = S.camera;
    clearInterval(cam.relogio);
    try { if (cam.rec.state !== 'inactive') cam.rec.stop(); } catch (e) {}
    cam.rec = null;
    const caixa = S.el.querySelector('#tele-rec'); if (caixa) caixa.hidden = true;
  }

  /* ================================================================
     6. ENTRADAS
     ================================================================ */
  /* dados já em mãos (editor de roteiros): { roteiros:[{roteiro,cenas}], indice, cliente } */
  /* zzz89: o teleprompter é de quem grava ou coordena (e do administrador) */
  function podeUsar() {
    const A = B7.Auth;
    if (!A || !A.usuario || !A.usuario()) return false;
    if (A.papel && A.papel() === 'admin') return true;
    const fn = A.funcao ? A.funcao() : null;
    return fn === 'videomaker' || fn === 'coordenador';
  }
  const semAcesso = () => { if (B7.UI && B7.UI.toast) B7.UI.toast('O teleprompter é para videomaker e coordenação.'); };
  function abrir(op) {
    if (!podeUsar()) return semAcesso();
    criarSessao({ cliente: op.cliente || '', marcar: op.marcar, podeMarcar: !!op.podeMarcar, aoFechar: op.aoFechar });
    S.roteiros = (op.roteiros || []).map(x => normalizar(x.roteiro, x.cenas, { itemId: x.itemId || null, gravado: !!x.gravado }));
    S.i = Math.min(Math.max(0, op.indice || 0), Math.max(0, S.roteiros.length - 1));
    if (!S.roteiros.length) return telaAviso('Nenhum roteiro para mostrar', 'Esta gravação ainda não tem roteiro. Adicione um roteiro para usar o teleprompter.');
    telaInicio();
  }
  /* a partir do editor: usa o que está na tela agora (inclusive o que ainda está salvando) */
  function abrirDoEditor(contexto, indice) {
    abrir({ cliente: contexto.cliente, indice,
      roteiros: (contexto.roteiros || []).map(r => ({ roteiro: r, cenas: (contexto.cenasPorRoteiro || {})[r.id] || [] })) });
  }
  /* a partir da gravação: os roteiros da lista "O que vamos gravar", na ordem dela */
  async function abrirDaGravacao(gravacao, itens, op) {
    if (!podeUsar()) return semAcesso();
    op = op || {};
    criarSessao({ cliente: gravacao.cliente_nome || '', marcar: op.marcar, podeMarcar: !!op.podeMarcar, aoFechar: op.aoFechar });
    const minha = S;
    S.fase = 'aviso';
    painel('<div class="tele-fim"><small class="tele-olho">TELEPROMPTER</small><h2>Carregando os roteiros…</h2></div>', 'fim');
    S.el.querySelector('#tele-onde').innerHTML = '<b>' + esc(gravacao.nome || 'Teleprompter') + '</b>';
    const doRoteiro = (itens || []).filter(i => i.tipo === 'roteiro' && i.roteiro_id && !i.roteiro_removido);
    if (!doRoteiro.length) return telaAviso('Nenhum roteiro nesta gravação', 'Adicione um roteiro à lista “O que vamos gravar” para usar o teleprompter.');
    try {
      const ids = [...new Set(doRoteiro.map(i => i.roteiro_id))];
      const [roteiros, cenas] = await Promise.all([B7.DB.roteirosPorIds(ids), B7.DB.listarCenasDaGravacao(ids)]);
      if (S !== minha) return;
      const porId = {}; (roteiros || []).forEach(r => { porId[r.id] = r; });
      const cenasDe = {}; (cenas || []).forEach(c => { (cenasDe[c.script_id] = cenasDe[c.script_id] || []).push(c); });
      S.roteiros = doRoteiro.filter(i => porId[i.roteiro_id]).map(i =>
        normalizar(porId[i.roteiro_id], cenasDe[i.roteiro_id] || [], { itemId: i.id, gravado: !!i.gravado }));
      if (!S.roteiros.length) return telaAviso('Roteiros indisponíveis', 'Os roteiros desta gravação não puderam ser abertos. Eles podem ter sido removidos.');
      /* começa no primeiro que ainda não foi gravado */
      const pendente = S.roteiros.findIndex(r => !r.gravado && r.comFala.length);
      S.i = pendente >= 0 ? pendente : 0;
      if (op.roteiroId) { const k = S.roteiros.findIndex(r => r.id === op.roteiroId); if (k >= 0) S.i = k; }
      telaInicio();
    } catch (e) {
      if (S !== minha) return;
      telaAviso('Não foi possível abrir o teleprompter', 'Confira a conexão e tente de novo. ' + (e && e.message ? e.message : ''));
    }
  }

  /* _teste: só para a página de testes dar passos na rolagem sem depender de animação */
  return { podeUsar, abrir, abrirDoEditor, abrirDaGravacao, fechar, normalizar,
           _teste: { passo: dt => passo(dt), estado: () => S && ({ fase: S.fase, i: S.i, cena: S.cena, y: R.y, max: R.max, tocando: R.tocando, contando: S.contando, prefs: Object.assign({}, P) }) } };
})();
