/* =====================================================================
   SOM DA ABERTURA — 100% sintetizado com Web Audio: nenhum arquivo baixado,
   nenhuma música de terceiros. 5.23.1: só as trilhas da identidade Espectro
   (Ignição, Hiperespaço, Aurora e o carregamento curto); as trilhas do visual
   antigo (streaming, hiper, tinta, glitch, aurora, neon, mosaico, programador
   e a "a ideia acende") saíram junto com as aberturas dele.
   • o navegador pode bloquear som sem um toque antes (política de
     autoplay). Se bloquear, a abertura segue muda — nada quebra — e o
     som destrava no primeiro toque (ex.: "Entrar" no login, que toca a
     saída). "Ver abertura" nas Configurações toca a trilha inteira.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.SomAbertura = (function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ligado = () => {
    /* zzz269: troca de conta abre sem abertura — e sem som */
    if (document.documentElement.classList.contains('ab-sem')) return false;
    try { const v = localStorage.getItem('b7_pref_som_abertura'); return v === null ? true : JSON.parse(v); }
    catch (e) { return true; }
  };
  let ctx = null, saida = null, sala = null, ruido = null, drone = null, comp = null, conv = null;

  function preparar(contexto) {
    if (!contexto && (ctx || !AC)) return !!ctx;
    if (contexto) ctx = contexto;
    else { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; } }
    /* mestre: volume moderado + compressor (nada estoura no alto-falante do celular) */
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = .004; comp.release.value = .25;
    saida = ctx.createGain(); saida.gain.value = .7;
    saida.connect(comp); comp.connect(ctx.destination);
    /* sala: reverberação de cinema gerada (zzz229): pré-atraso, primeiras
       reflexões e uma cauda longa que escurece com o tempo (o agudo morre
       antes do grave), com os dois lados diferentes (largura estéreo) */
    const seg = 4.6, n = Math.floor(ctx.sampleRate * seg), pre = Math.floor(ctx.sampleRate * .022);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const x = (i - pre) / (n - pre);
        const a = .35 + .6 * x;                              /* filtro fecha com o tempo */
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * Math.pow(1 - x, 2.4) * 2.2;
      }
      [.011, .019, .029, .041, .057].forEach((r, k) => { const j = pre + Math.floor(ctx.sampleRate * (r + c * .003)); if (j < n) d[j] += (k % 2 ? -1 : 1) * (.5 - k * .07); });
    }
    conv = ctx.createConvolver(); conv.buffer = ir;
    sala = ctx.createGain(); sala.gain.value = .42;
    sala.connect(conv); conv.connect(saida);
    /* ruído branco reaproveitado */
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const r = ruido.getChannelData(0);
    for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
    return true;
  }

  /* ---------- peças sonoras ---------- */
  const env = (g, t, pico, ataque, queda, sustenta) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + ataque);
    if (sustenta) g.gain.setValueAtTime(pico, t + ataque + sustenta);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + (sustenta || 0) + queda);
  };
  function fonteRuido(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true;
    s.start(t, Math.random()); s.stop(t + dur + .05); return s;
  }
  /* f = força (1 na completa; menor na relâmpago, que é mais curta) */
  function ignicao(t, f = 1) {
    /* sub-grave que afunda */
    const sub = ctx.createOscillator(), gs = ctx.createGain(); sub.type = 'sine';
    sub.frequency.setValueAtTime(78, t); sub.frequency.exponentialRampToValueAtTime(30, t + 1.1 * f);
    sub.connect(gs); gs.connect(saida); sub.start(t); sub.stop(t + 1.9);
    env(gs, t, .95 * f, .008, 1.7 * f);
    /* batida (o "tum" do impacto) */
    const k = ctx.createOscillator(), gk = ctx.createGain(); k.type = 'sine';
    k.frequency.setValueAtTime(170, t); k.frequency.exponentialRampToValueAtTime(45, t + .14);
    k.connect(gk); gk.connect(saida); k.start(t); k.stop(t + .4);
    env(gk, t, .8 * f, .003, .3);
    /* estouro de ar */
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(300, t + .9);
    const gn = ctx.createGain(); fonteRuido(t, 1.2).connect(lp); lp.connect(gn); gn.connect(saida); gn.connect(sala);
    env(gn, t, .32 * f, .004, f);
    /* brilho harmônico: a luz que fica no ar */
    [523.25, 783.99, 1046.5, 1567.98, 2093].forEach((hz, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.value = hz; o.detune.value = (Math.random() - .5) * 8;
      o.connect(g); g.connect(saida); g.connect(sala);
      const tt = t + .02 + i * .012;
      o.start(tt); o.stop(tt + 3.2);
      env(g, tt, (.05 - i * .006) * Math.max(f, .6), .02, 2.8 * f);
    });
  }
  /* cama: um acorde aberto (dó com 9ª), grave e quente, que nasce da
     ignição e fica sob o logo até a saída — é o que dá "trilha de
     cinema" em vez de efeitos soltos. aoSair resolve e apaga. */
  let cama = null;
  /* saída (pacote zzp): UM gesto sonoro só, diferente de tudo que já
     tocou — antes eram dois whooshes opostos ao mesmo tempo + o mesmo
     cintilar do brilho do logo repetido no pouso ("enjoativo").
       0,00  sopro de ar subindo junto com a íris e o voo do logo
       0,00  a cama resolve: o filtro fecha e o acorde se apaga em ~1,2 s
       0,78  pouso: um "toc" abafado e curto no topo (sem brilho, sem eco) */
  /* zzz112 — "a abertura saiu e o áudio da trilha ainda fica no fundo".
     A trilha longa agenda sons para os próximos segundos (pedal, arpejo,
     assinatura). Se a abertura saía antes, eles tocavam sem imagem.
     Na saída, tudo o que é da trilha passa por um barramento que é
     fechado em ~0,35 s; os sons da própria saída nascem num barramento
     novo. Nada da trilha sobrevive à abertura. */
  function cortarTrilha(t) {
    if (!saida || !comp) return;
    const velhaSaida = saida, velhaSala = sala;
    try {
      velhaSaida.gain.cancelScheduledValues(t); velhaSaida.gain.setValueAtTime(velhaSaida.gain.value, t);
      velhaSaida.gain.linearRampToValueAtTime(0.0001, t + .35);
      velhaSala.gain.cancelScheduledValues(t); velhaSala.gain.setValueAtTime(velhaSala.gain.value, t);
      velhaSala.gain.linearRampToValueAtTime(0.0001, t + .25);
    } catch (e) {}
    saida = ctx.createGain(); saida.gain.value = .7; saida.connect(comp);
    sala = ctx.createGain(); sala.gain.value = .3; sala.connect(conv);
    try { conv.disconnect(); conv.connect(saida); } catch (e) {}
    /* a cauda da sala que já soava some junto: entra de volta em rampa */
    try { saida.gain.setValueAtTime(0.0001, t); saida.gain.linearRampToValueAtTime(.7, t + .12); } catch (e) {}
    if (ctx.constructor && /Offline/.test(ctx.constructor.name)) return;
    setTimeout(() => { try { velhaSaida.disconnect(); velhaSala.disconnect(); } catch (e) {} }, 1200);
  }

  /* ---------- trilha completa, alinhada ao relógio da animação ----------
     decorrido = quanto da abertura já passou quando o som pôde começar
     (o CSS começa a animar antes deste script e antes do áudio destravar).
     O que já passou é pulado — som atrasado soaria fora de sincronia. */
  /* =================================================================
     5.16.0 — SOM DO ESPECTRO (2ª versão). Pedido do Kevin: a 1ª versão "parece feita de qualquer
     jeito" — muitas camadas baratas (batida, palmas, chimbal, onda quadrada). Agora é o contrário:
     poucas peças, bem acabadas, como uma assinatura sonora de marca:
       • AR: um sopro largo em estéreo que cresce com a imagem (ruído rosado filtrado, dois lados);
       • IMPACTO: um só, encorpado e macio — grave que desce e um "whoomp" abafado, sem estalo;
       • PIANO ELÉTRICO (FM suave) para os acordes, em lá maior com sétima e nona;
       • CRISTAL (parciais de sino, aditivo) para a ASSINATURA DE TRÊS NOTAS (mi · lá · dó#), a
         mesma nas três aberturas, no momento em que a marca aparece;
       • uma sala própria, clara e de 2,4 s (não a sala de cinema da trilha antiga).
     ================================================================= */
  const NOTA = { A1: 55, A2: 110, E3: 164.81, A3: 220, B3: 246.94, Cs4: 277.18, E4: 329.63, Gs4: 415.3, A4: 440, B4: 493.88,
    Cs5: 554.37, E5: 659.25, Fs5: 739.99, Gs5: 830.61, A5: 880, B5: 987.77, Cs6: 1108.73, E6: 1318.51, A6: 1760 };
  const ACORDE = [NOTA.A2, NOTA.E3, NOTA.Cs4, NOTA.Gs4, NOTA.B4];          /* lá com sétima maior e nona, aberto */
  const MOTIVO = [NOTA.E5, NOTA.A5, NOTA.Cs6];                              /* a assinatura de três notas */
  function salaEsp() {
    if (ctx.__sala && ctx.__salaSaida === saida) return ctx.__sala;
    const seg = 2.4, n = Math.floor(ctx.sampleRate * seg), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const x = i / n; lp = lp * .55 + (Math.random() * 2 - 1) * .45; d[i] = lp * Math.pow(1 - x, 3) * (i < ctx.sampleRate * .012 ? i / (ctx.sampleRate * .012) : 1); }
    }
    const cv = ctx.createConvolver(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    cv.buffer = ir; g.gain.value = .55; hp.type = 'highpass'; hp.frequency.value = 180;
    g.connect(hp); hp.connect(cv); cv.connect(saida);
    ctx.__sala = g; ctx.__salaSaida = saida; return g;
  }
  const painel = (no, p) => { if (!ctx.createStereoPanner || !p) return no; const s = ctx.createStereoPanner(); s.pan.value = p; no.connect(s); return s; };
  function saidaCom(no, molhado) { no.connect(saida); const g = ctx.createGain(); g.gain.value = molhado; no.connect(g); g.connect(salaEsp()); }
  /* AR: ruído rosado (filtrado) nos dois lados, crescendo (ou descendo) com um filtro que abre */
  function ar(t, dur, v = .05, sobe = true, largura = .7) {
    [-largura, largura].forEach((p, k) => {
      const lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 5200; bp.type = 'bandpass'; bp.Q.value = .7;
      bp.frequency.setValueAtTime(sobe ? 500 : 3600, t); bp.frequency.exponentialRampToValueAtTime(sobe ? 3600 + k * 400 : 400, t + dur);
      fonteRuido(t, dur).connect(lp); lp.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(0.0001, t);
      if (sobe) { g.gain.exponentialRampToValueAtTime(v, t + dur * .92); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .12); }
      else { g.gain.exponentialRampToValueAtTime(v, t + dur * .12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
      saidaCom(painel(g, p), .35);
    });
  }
  /* IMPACTO: grave descendo + um "whoomp" abafado; nada de estalo */
  function impacto(t, v = .7) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(38, t + .9);
    o.connect(g); g.connect(saida); o.start(t); o.stop(t + 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .018); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    const lp = ctx.createBiquadFilter(), gn = ctx.createGain(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(90, t + .45);
    fonteRuido(t, .6).connect(lp); lp.connect(gn); saidaCom(gn, .5);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v * .5, t + .012); gn.gain.exponentialRampToValueAtTime(0.0001, t + .55);
  }
  /* PIANO ELÉTRICO: FM suave (moduladora 1:1 para o corpo e um toque agudo no ataque) */
  function piano(t, hz, v = .05, dur = 2.4, pan = 0) {
    const c = ctx.createOscillator(), m = ctx.createOscillator(), gm = ctx.createGain(), m2 = ctx.createOscillator(), gm2 = ctx.createGain(), g = ctx.createGain();
    c.type = 'sine'; m.type = 'sine'; m2.type = 'sine'; c.frequency.value = hz; m.frequency.value = hz; m2.frequency.value = hz * 14;
    gm.gain.setValueAtTime(hz * 1.3, t); gm.gain.exponentialRampToValueAtTime(hz * .15, t + 1.2);
    gm2.gain.setValueAtTime(hz * .9, t); gm2.gain.exponentialRampToValueAtTime(1, t + .08);
    m.connect(gm); gm.connect(c.frequency); m2.connect(gm2); gm2.connect(c.frequency);
    c.connect(g); saidaCom(painel(g, pan), .45);
    [c, m, m2].forEach(o => { o.start(t); o.stop(t + dur + .1); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .006); g.gain.exponentialRampToValueAtTime(v * .35, t + .5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function acorde(t, notas = ACORDE, v = .04, dur = 3, dedilhado = .018) { notas.forEach((n, i) => piano(t + i * dedilhado, n, v * (n < 150 ? 1.3 : 1), dur, (i / (notas.length - 1) - .5) * .7)); }
  /* CRISTAL: parciais de sino (1 · 2,76 · 5,4 · 8,93), cada uma morrendo no seu tempo */
  function cristal(t, hz, v = .03, dur = 2.2, pan = 0) {
    const g = ctx.createGain(); saidaCom(painel(g, pan), .6);
    g.gain.value = 1;
    [[1, 1, 1], [2.76, .45, .55], [5.4, .22, .3], [8.93, .1, .16]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(), go = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz * r;
      o.connect(go); go.connect(g); o.start(t); o.stop(t + dur * d + .1);
      go.gain.setValueAtTime(0.0001, t); go.gain.exponentialRampToValueAtTime(v * a, t + .004); go.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
    });
  }
  /* CAMA: o acorde sustentado, quente, entrando devagar */
  function camaEsp(t, dur, notas = ACORDE, v = .03, abre = 1800) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(abre, t + dur * .5);
    notas.forEach((n, i) => [-5, 5].forEach(d => { const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = n; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 1.6); }));
    lp.connect(g); saidaCom(g, .5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(1.4, dur * .45)); g.gain.setValueAtTime(v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
  }
  /* a assinatura: mi · lá · dó#, no cristal com o piano dobrando uma oitava abaixo */
  function assinaturaEsp(t, v = 1, passo = .2) {
    MOTIVO.forEach((n, i) => { cristal(t + i * passo, n, .032 * v, i === 2 ? 3 : 1.8, (i - 1) * .35); piano(t + i * passo, n / 2, .03 * v, 2.2, (i - 1) * .35); });
  }

  /* IGNIÇÃO (8 s): 0,0 o ar cresce com as linhas · 1,44–1,6 a lâmpada pisca (quatro "tins") · 1,62 ACENDE:
     o impacto e o acorde aberto no piano · 2,1 as metades do B7 passam (ar dos dois lados) · 3,2 travam (um
     impacto pequeno) · 3,86 a palavra: a assinatura · 5,0 a frase: a cama do acorde e um brilho */
  const ROTEIRO_IGNICAO = [
    [0.0, t => ar(t, 1.6, .045)], [0.2, t => camaEsp(t, 1.3, [NOTA.A2, NOTA.E3], .02, 700)],
    [1.44, t => cristal(t, NOTA.A6, .01, .4)], [1.49, t => cristal(t, NOTA.E6, .008, .3)], [1.55, t => cristal(t, NOTA.A6, .01, .4)], [1.6, t => cristal(t, NOTA.E6, .012, .5)],
    [1.62, t => impacto(t, .75)], [1.62, t => acorde(t, ACORDE, .045, 3.2)], [1.64, t => cristal(t, NOTA.A6, .016, 2.6)],
    [2.05, t => ar(t, .55, .03, true, .9)], [2.12, t => ar(t, .55, .03, true, -.9)],
    [3.2, t => impacto(t, .3)], [3.86, t => assinaturaEsp(t)],
    [5.0, t => camaEsp(t, 1.9, ACORDE, .028, 2400)], [5.0, t => piano(t, NOTA.A3, .035, 3)], [5.05, t => cristal(t, NOTA.E6, .014, 2.6, .3)]
  ];
  /* HIPERESPAÇO (7 s): 0,3–3,6 o túnel — o ar crescendo devagar, um grave subindo por baixo e os anéis
     passando (ar curto, um lado e outro) · 3,66 um respiro mudo · 3,78 O SALTO: impacto e acorde ·
     3,95 o halo: brilho · 4,9 "SISTEMA B7": a assinatura · 5,5 a cama do acorde */
  const ROTEIRO_HIPERESPACO = [
    [0.3, t => ar(t, 3.3, .05)],
    [0.3, t => { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'triangle'; o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(110, t + 3.3);
      lp.type = 'lowpass'; lp.frequency.value = 500; o.connect(lp); lp.connect(g); g.connect(saida); o.start(t); o.stop(t + 3.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + 3.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.36); }],
    ...[.9, 1.5, 2.0, 2.45, 2.85, 3.2].map((x, i) => [x, t => ar(t, .4, .018 + i * .003, true, i % 2 ? .9 : -.9)]),
    [3.78, t => impacto(t, .85)], [3.78, t => acorde(t, ACORDE, .05, 3.2, .012)], [3.95, t => cristal(t, NOTA.A6, .016, 2.6)],
    [4.9, t => assinaturaEsp(t, 1, .17)], [5.5, t => camaEsp(t, 1.4, ACORDE, .026, 2400)]
  ];
  /* AURORA (4,6 s): calma — a cama aberta desde o começo e brilhos de cristal espalhados como a poeira ·
     1,2 o símbolo acende: acorde macio · 1,3 a frase: a assinatura, devagar · 2,8 o acorde se resolve */
  const ROTEIRO_AURORA_ESP = [
    [0.0, t => camaEsp(t, 3.8, ACORDE, .026, 1500)], [0.1, t => ar(t, 1.2, .02)],
    ...[NOTA.E6, NOTA.B5, NOTA.Cs6, NOTA.A5, NOTA.E6, NOTA.Gs5, NOTA.B5].map((n, i) => [.35 + i * .45, t => cristal(t, n, .009, 1.8, i % 2 ? .6 : -.6)]),
    [1.2, t => impacto(t, .25)], [1.2, t => acorde(t, ACORDE, .032, 3, .03)],
    [1.35, t => assinaturaEsp(t, .8, .26)], [2.8, t => piano(t, NOTA.A3, .028, 2.4)], [2.8, t => cristal(t, NOTA.A5, .014, 2.4)]
  ];
  /* recarregar no Espectro (carregamentos): só a assinatura, baixinha */
  const ROTEIRO_CURTO_ESP = [[0.0, t => ar(t, .35, .015)], [0.3, t => assinaturaEsp(t, .55, .12)]];
  /* saída no Espectro: o ar desce e o lá grave fecha */
  function partidaEsp(t) {
    cortarTrilha(t);
    ar(t, .6, .03, false);
    piano(t + .35, NOTA.A2, .03, 1.6);
  }
  const ROTEIROS_EST = { ignicao: ROTEIRO_IGNICAO, hiperespaco: ROTEIRO_HIPERESPACO, 'aurora-espectro': ROTEIRO_AURORA_ESP };
  const estiloAtual = () => document.documentElement.getAttribute('data-ab-estilo');
  const roteiroCompleto = () => ROTEIROS_EST[estiloAtual()] || ROTEIRO_IGNICAO;
  let inicioAnim = null, tocada = false, roteiro = ROTEIRO_IGNICAO;
  function tocarTrilha(decorrido) {
    if (!ctx || ctx.state !== 'running' || tocada) return;
    tocada = true;
    const agora = ctx.currentTime + .03;
    roteiro.forEach(([quando, fn]) => {
      const t = quando - decorrido;
      if (t >= -.12) { try { fn(agora + Math.max(0, t)); } catch (e) {} }
    });
  }
  const decorridoAgora = () => inicioAnim == null ? 0 :
    Math.max(0, ((document.timeline ? document.timeline.currentTime : performance.now()) - inicioAnim) / 1000);

  /* arranque: tenta tocar junto com a abertura completa da página */
  function aoCarregar() {
    if (!ligado() || !AC) return;
    const el = document.getElementById('abertura');
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { destravarNoToque(); return; }
    /* recarregar na mesma sessão: a trilha relâmpago, alinhada ao palco
       (na curta a lâmpada já está parada no logo; quem anima é o palco) */
    const curta = document.documentElement.classList.contains('ab-curta');
    roteiro = curta ? ROTEIRO_CURTO_ESP : roteiroCompleto();
    if (!preparar()) return;
    requestAnimationFrame(() => {
      const a = el.querySelector(curta ? '.esp-ab-marca' : '.cine-relogio');
      const an = a && a.getAnimations ? a.getAnimations()[0] : null;
      inicioAnim = an && an.startTime != null ? an.startTime : 0;   /* startTime = o 0 s da sequência (o atraso conta depois) */
      const vai = () => { if (el.isConnected && !el.classList.contains('saindo')) tocarTrilha(decorridoAgora()); };
      if (ctx.state === 'running') vai();
      else ctx.resume().then(vai).catch(() => {});
      destravarNoToque(vai);
    });
  }
  /* política de autoplay: o primeiro toque destrava o áudio (e, se a
     abertura ainda estiver na tela, toca o que falta dela) */
  function destravarNoToque(depois) {
    const fn = () => {
      if (!ligado() || !preparar()) return;
      ctx.resume().then(() => { if (depois) depois(); }).catch(() => {});
      ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.removeEventListener(e, fn, true));
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => document.addEventListener(e, fn, { capture: true, passive: true }));
  }

  /* chamada pela saída da abertura (js/app.js) */
  function aoSair() {
    if (!ligado() || !ctx || ctx.state !== 'running') return;
    try { partidaEsp(ctx.currentTime + .02); } catch (e) {}
  }
  /* "Ver abertura" (Configurações): toque do usuário → som garantido */
  function reproduzir() {
    if (!ligado() || !preparar()) return;
    tocada = false; roteiro = roteiroCompleto();
    ctx.resume().then(() => { inicioAnim = null; tocarTrilha(0); }).catch(() => {});
  }

  /* ensaio sem tocar: renderiza a trilha inteira (+ saída em 4,3 s) num
     contexto offline e devolve o pico por fatia de 100 ms. Serve para
     conferir sincronia e volume sem alto-falante (DevTools). */
  async function ensaio(qual, saidaEm, cru) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const salvo = [ctx, saida, sala, ruido, drone, cama];
    const curto = qual === 'curta';
    const off = new OAC(2, 44100 * (curto ? 3.5 : 9), 44100);
    preparar(off);
    (curto ? ROTEIRO_CURTO_ESP : ROTEIROS_EST[qual] || ROTEIRO_IGNICAO).forEach(([quando, fn]) => fn(quando));
    partidaEsp(curto ? 1.0 : (saidaEm || ({ ignicao: 7.0, hiperespaco: 6.3, 'aurora-espectro': 4.4 })[qual] || 7.0));
    const buf = await off.startRendering();
    [ctx, saida, sala, ruido, drone, cama] = salvo;
    if (cru) return [buf.getChannelData(0), buf.getChannelData(1)];
    const d = buf.getChannelData(0), passo = 4410, picos = [];
    for (let i = 0; i < d.length; i += passo) {
      let p = 0; for (let j = i; j < Math.min(i + passo, d.length); j++) p = Math.max(p, Math.abs(d[j]));
      picos.push(+p.toFixed(3));
    }
    return picos;
  }

  /* zzz156: saiu do app (ou trocou de aba) com a trilha tocando: cala na
     hora. O contexto é fechado (o que estava programado não volta a tocar
     ao reabrir); "Ver abertura" cria outro quando pedir. O app Android
     também chama B7Pausou() ao ir para segundo plano (MainActivity.onPause). */
  function calar() {
    if (!ctx || (ctx.close === undefined)) return;
    const c = ctx;
    ctx = null; saida = null; sala = null; conv = null; comp = null; drone = null;
    tocada = true;
    try { c.close().catch(() => {}); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) calar(); });
  window.addEventListener('pagehide', calar);
  window.B7Pausou = calar;

  /* zzz259: no app a abertura começa depois do código carregar */
  if (document.documentElement.classList.contains('ab-espera-app')) document.addEventListener('b7:abertura-solta', aoCarregar, { once: true });
  else aoCarregar();
  return { aoSair, reproduzir, ligado, ensaio, calar };
})();
