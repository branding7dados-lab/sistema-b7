/* =====================================================================
   SOM DA ABERTURA (pacote zp, 03/10; trilha refeita na zzz110, 08/10)
   Trilha de ~6,6 s sincronizada com a abertura "a ideia acende",
   100% sintetizada com Web Audio: nenhum arquivo baixado, nenhuma
   música de terceiros.

   zzz110 — pedido do Kevin: "melhorar a trilha sonora... premium".
   A trilha deixou de ser uma fila de efeitos e virou uma peça curta em
   dó, com começo, clímax e assinatura:
     0,00 s  PRÓLOGO: um golpe distante e grave, um pedal de dó que
             cresce devagar e ar passando (o escuro tem tamanho)
     0,40 s  duas notas de sino, sol → dó: a pergunta
     1,55 s  tensão (zumbido que abre o filtro até a ignição)
     2,40 s  riser; 2,55 e 2,98 s duas batidas de coração
     3,12 s  estalos do filamento
     3,40 s  IGNIÇÃO: sub-grave + batida + estouro de ar + um "braam"
             de metais graves + o brilho harmônico
     3,45 s  cama: acorde aberto sob o logo
     3,80 s  arpejo de sinos subindo (dó, sol, ré, mi)
     4,78 s  whoosh do "Branding7"      5,20 s  cintilar do brilho
     5,50 s  ASSINATURA: sol → dó agudo, a resposta da pergunta do
             prólogo, com um dó grave embaixo (o cartão de título)
     saída   sopro + a cama se resolve + "toc" no pouso
   Abaixo, o roteiro antigo, para referência dos tempos internos:
     0,05 s  zumbido grave de tensão (sobe o filtro até a ignição)
     0,9 s   riser: ruído e tom subindo junto com a luz na lâmpada
     1,6 s   estalos elétricos do filamento piscando (duas vezes)
     1,9 s   IGNIÇÃO: sub-grave + batida + estouro de ar + brilho
             harmônico (dó maior) com reverberação longa
     3,28 s  whoosh do "Branding7" se escrevendo
     3,7 s   cintilar do brilho passando pelo logo
     1,95 s  cama: acorde grave e quente sob o logo, até a saída
     saída   um sopro + a cama se resolve + "toc" abafado no pouso
             (pacote zzp: nada de repetir o cintilar no pouso)
   Regras:
   • desligável em Configurações → Aparência ("Som da abertura");
   • o navegador pode bloquear som sem um toque antes (política de
     autoplay). Se bloquear, a abertura segue muda — nada quebra — e o
     som destrava no primeiro toque (ex.: "Entrar" no login, que toca a
     saída). "Ver abertura" nas Configurações toca a trilha inteira.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.SomAbertura = (function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ligado = () => {
    try { const v = localStorage.getItem('b7_pref_som_abertura'); return v === null ? true : JSON.parse(v); }
    catch (e) { return true; }
  };
  let ctx = null, saida = null, sala = null, ruido = null, drone = null;

  function preparar(contexto) {
    if (!contexto && (ctx || !AC)) return !!ctx;
    if (contexto) ctx = contexto;
    else { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; } }
    /* mestre: volume moderado + compressor (nada estoura no alto-falante do celular) */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = .004; comp.release.value = .25;
    saida = ctx.createGain(); saida.gain.value = .7;
    saida.connect(comp); comp.connect(ctx.destination);
    /* sala: reverberação gerada (ruído com cauda que decai) */
    const seg = 3.6, n = Math.floor(ctx.sampleRate * seg);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
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
  function tensao(t, ate) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(1300, ate);
    lp.Q.value = 6;
    [55, 55.6, 82.4].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(ate + 1.4);
    });
    lp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.05, t + 1.2);
    g.gain.exponentialRampToValueAtTime(.08, ate);
    g.gain.exponentialRampToValueAtTime(0.0001, ate + 1.2);
    drone = g;
  }
  function riser(t, dur) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(7500, t + dur);
    const g = ctx.createGain(); fonteRuido(t, dur).connect(bp); bp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + dur * .96);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .04);
    const o = ctx.createOscillator(), go = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    o.connect(go); go.connect(saida); o.start(t); o.stop(t + dur + .05);
    go.gain.setValueAtTime(0.0001, t); go.gain.exponentialRampToValueAtTime(.025, t + dur * .95);
    go.gain.exponentialRampToValueAtTime(0.0001, t + dur + .03);
  }
  function estalo(t) {
    for (let k = 0; k < 3; k++) {
      const tt = t + k * .018 + Math.random() * .01;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
      const g = ctx.createGain(); fonteRuido(tt, .03).connect(hp); hp.connect(g); g.connect(saida);
      env(g, tt, .15 - k * .04, .002, .025);
    }
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
  /* ---------- peças da trilha longa (zzz110) ---------- */
  /* sino: fundamental + dois parciais, ataque seco e cauda longa na sala */
  function sino(t, hz, vol, dur) {
    [[1, 1], [2, .28], [3.01, .1], [4.2, .04]].forEach(([m, p]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz * m;
      o.connect(g); g.connect(saida); g.connect(sala);
      o.start(t); o.stop(t + dur + .1);
      env(g, t, Math.max(vol * p, .0002), .006, dur / (1 + (m - 1) * .5));
    });
  }
  /* prólogo: golpe distante + pedal de dó crescendo + ar */
  function prologo(t, ate) {
    const k = ctx.createOscillator(), gk = ctx.createGain(); k.type = 'sine';
    k.frequency.setValueAtTime(62, t); k.frequency.exponentialRampToValueAtTime(31, t + 1.3);
    k.connect(gk); gk.connect(saida); gk.connect(sala); k.start(t); k.stop(t + 2.4);
    env(gk, t + .06, .5, .02, 2.1);
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .8;
    lp.frequency.setValueAtTime(90, t); lp.frequency.exponentialRampToValueAtTime(520, ate);
    [[32.7, 'sine', .9], [65.41, 'triangle', .5], [98, 'triangle', .22], [130.81, 'sawtooth', .08]].forEach(([hz, tipo, p]) => {
      [-5, 5].forEach(dt => {
        const o = ctx.createOscillator(), go = ctx.createGain(); o.type = tipo; o.frequency.value = hz; o.detune.value = dt;
        go.gain.value = p; o.connect(go); go.connect(lp); o.start(t); o.stop(ate + 1.6);
      });
    });
    lp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.05, t + 1.2);
    g.gain.exponentialRampToValueAtTime(.085, ate);
    g.gain.exponentialRampToValueAtTime(0.0001, ate + 1.4);
    /* ar: ruído grave e largo, quase vento */
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .6;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(900, ate);
    const ga = ctx.createGain(); fonteRuido(t, ate - t + .6).connect(bp); bp.connect(ga); ga.connect(saida); ga.connect(sala);
    ga.gain.setValueAtTime(0.0001, t); ga.gain.exponentialRampToValueAtTime(.022, t + 1); ga.gain.exponentialRampToValueAtTime(0.0001, ate + .5);
  }
  /* batida de coração antes da ignição */
  function batida(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(38, t + .13);
    o.connect(g); g.connect(saida); g.connect(sala); o.start(t); o.stop(t + .4);
    env(g, t, vol, .004, .26);
  }
  /* "braam": metais graves de trailer, o corpo do impacto */
  function braam(t, f = 1) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
    lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1900, t + .12);
    lp.frequency.exponentialRampToValueAtTime(260, t + 2);
    [65.41, 98, 130.81, 196].forEach((hz, i) => {
      [-9, 0, 9].forEach(dt => {
        const o = ctx.createOscillator(), go = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = dt;
        go.gain.value = i < 2 ? .34 : .16; o.connect(go); go.connect(lp); o.start(t); o.stop(t + 2.4);
      });
    });
    lp.connect(g); g.connect(saida); g.connect(sala);
    env(g, t, .11 * f, .03, 2.1);
  }
  /* arpejo que sobe depois da ignição */
  function arpejo(t) {
    [[523.25, 0], [783.99, .2], [1174.66, .4], [1318.51, .6]].forEach(([hz, d], i) => sino(t + d, hz, .03 - i * .003, 1.9));
  }
  /* assinatura: responde o prólogo (sol → dó agudo) e fecha em dó */
  function assinatura(t) {
    sino(t, 783.99, .055, 1.6);
    sino(t + .19, 1046.5, .07, 2.6);
    sino(t + .19, 1567.98, .018, 2.2);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 65.41;
    o.connect(g); g.connect(saida); g.connect(sala); o.start(t + .19); o.stop(t + 2.6);
    env(g, t + .19, .3, .02, 2);
  }

  function whoosh(t, dur, de, para, vol) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9;
    bp.frequency.setValueAtTime(de, t); bp.frequency.exponentialRampToValueAtTime(para, t + dur);
    const g = ctx.createGain(); fonteRuido(t, dur).connect(bp); bp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * .45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function cintilar(t) {
    [1567.98, 2093, 2637.02, 3135.96, 4186].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      o.connect(g); g.connect(saida); g.connect(sala);
      const tt = t + i * .055; o.start(tt); o.stop(tt + 1);
      env(g, tt, .035, .006, .8);
    });
  }
  /* cama: um acorde aberto (dó com 9ª), grave e quente, que nasce da
     ignição e fica sob o logo até a saída — é o que dá "trilha de
     cinema" em vez de efeitos soltos. aoSair resolve e apaga. */
  let cama = null;
  function camaSonora(t, f = 1) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .7;
    lp.frequency.setValueAtTime(280, t); lp.frequency.exponentialRampToValueAtTime(1500, t + 1.6);
    const oscs = [];
    [65.41, 130.81, 196, 293.66, 329.63].forEach((hz, i) => {
      [-6, 6].forEach(dt => {
        const o = ctx.createOscillator(); o.type = i < 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz; o.detune.value = dt + (Math.random() - .5) * 3;
        const go = ctx.createGain(); go.gain.value = i < 2 ? .5 : .16;
        o.connect(go); go.connect(lp); o.start(t); o.stop(t + 20); oscs.push(o);
      });
    });
    lp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(.05 * f, t + 1.4);
    g.gain.setValueAtTime(.05 * f, t + 17);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 19.8);   /* rede de segurança: espera longa */
    cama = { g, lp, oscs };
  }
  /* saída (pacote zzp): UM gesto sonoro só, diferente de tudo que já
     tocou — antes eram dois whooshes opostos ao mesmo tempo + o mesmo
     cintilar do brilho do logo repetido no pouso ("enjoativo").
       0,00  sopro de ar subindo junto com a íris e o voo do logo
       0,00  a cama resolve: o filtro fecha e o acorde se apaga em ~1,2 s
       0,78  pouso: um "toc" abafado e curto no topo (sem brilho, sem eco) */
  function partida(t) {
    whoosh(t, .8, 320, 1900, .075);
    if (cama) {
      try {
        cama.g.gain.cancelScheduledValues(t); cama.g.gain.setTargetAtTime(0.0001, t + .1, .38);
        cama.lp.frequency.cancelScheduledValues(t); cama.lp.frequency.setTargetAtTime(220, t, .3);
        cama.oscs.forEach(o => o.stop(t + 2.6));
      } catch (e) {}
      cama = null;
    }
    if (drone) { try { drone.gain.cancelScheduledValues(t); drone.gain.setTargetAtTime(0.0001, t, .12); } catch (e) {} }
    const tp = t + .78, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sine'; o.frequency.setValueAtTime(196, tp); o.frequency.exponentialRampToValueAtTime(92, tp + .09);
    lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(saida); o.start(tp); o.stop(tp + .25);
    env(g, tp, .07, .004, .16);
  }

  /* ---------- trilha completa, alinhada ao relógio da animação ----------
     decorrido = quanto da abertura já passou quando o som pôde começar
     (o CSS começa a animar antes deste script e antes do áudio destravar).
     O que já passou é pulado — som atrasado soaria fora de sincronia. */
  const ROTEIRO = [
    [0.0, t => prologo(t, t + 3.4)], [0.4, t => sino(t, 392, .05, 2.2)], [0.95, t => sino(t, 523.25, .06, 2.6)],
    [1.55, t => tensao(t, t + 1.85)], [2.4, t => riser(t, 1.0)],
    [2.55, t => batida(t, .34)], [2.98, t => batida(t, .46)],
    [3.12, estalo], [3.26, estalo], [3.4, ignicao], [3.4, braam], [3.45, camaSonora], [3.8, arpejo],
    [4.78, t => whoosh(t, .7, 600, 3800, .1)], [5.2, cintilar], [5.5, assinatura]
  ];
  /* versão relâmpago (recarregar na mesma sessão, pacote zzc): ~1 s,
     mesmos tempos do CSS da curta (styles/global.css, abRelAcende etc.):
       0,00  subida curta de luz        0,34  estalo do filamento
       0,30  whoosh do "Branding7"       0,40  ACENDE (impacto mais leve)
       0,95  cintilar do brilho passando pelo logo */
  const ROTEIRO_CURTO = [
    [0.0, t => riser(t, .38)], [0.3, t => whoosh(t, .45, 700, 3800, .07)],
    [0.34, estalo], [0.4, t => ignicao(t, .62)], [0.45, t => camaSonora(t, .7)], [0.95, cintilar]
  ];
  let inicioAnim = null, tocada = false, roteiro = ROTEIRO;
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
    if (curta) roteiro = ROTEIRO_CURTO;
    if (!preparar()) return;
    requestAnimationFrame(() => {
      const a = el.querySelector(curta ? '.ab-palco' : '.ab-simbolo');
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
    try { partida(ctx.currentTime + .02); } catch (e) {}
  }
  /* "Ver abertura" (Configurações): toque do usuário → som garantido */
  function reproduzir() {
    if (!ligado() || !preparar()) return;
    tocada = false; roteiro = ROTEIRO;
    ctx.resume().then(() => { inicioAnim = null; tocarTrilha(0); }).catch(() => {});
  }

  /* ensaio sem tocar: renderiza a trilha inteira (+ saída em 4,3 s) num
     contexto offline e devolve o pico por fatia de 100 ms. Serve para
     conferir sincronia e volume sem alto-falante (DevTools). */
  async function ensaio(qual) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const salvo = [ctx, saida, sala, ruido, drone, cama];
    const curto = qual === 'curta';
    const off = new OAC(2, 44100 * (curto ? 3.5 : 9), 44100);
    preparar(off);
    (curto ? ROTEIRO_CURTO : ROTEIRO).forEach(([quando, fn]) => fn(quando));
    partida(curto ? 1.0 : 6.4);
    const buf = await off.startRendering();
    [ctx, saida, sala, ruido, drone, cama] = salvo;
    const d = buf.getChannelData(0), passo = 4410, picos = [];
    for (let i = 0; i < d.length; i += passo) {
      let p = 0; for (let j = i; j < Math.min(i + passo, d.length); j++) p = Math.max(p, Math.abs(d[j]));
      picos.push(+p.toFixed(3));
    }
    return picos;
  }

  aoCarregar();
  return { aoSair, reproduzir, ligado, ensaio };
})();
