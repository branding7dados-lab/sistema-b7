/* =====================================================================
   SOM DA ABERTURA (pacote zp, 03/10)
   Trilha de ~4,5 s sincronizada com a abertura "a ideia acende",
   100% sintetizada com Web Audio: nenhum arquivo baixado, nenhuma
   música de terceiros. Roteiro sonoro (mesmos tempos do CSS):
     0,05 s  zumbido grave de tensão (sobe o filtro até a ignição)
     0,9 s   riser: ruído e tom subindo junto com a luz na lâmpada
     1,6 s   estalos elétricos do filamento piscando (duas vezes)
     1,9 s   IGNIÇÃO: sub-grave + batida + estouro de ar + brilho
             harmônico (dó maior) com reverberação longa
     3,28 s  whoosh do "Branding7" se escrevendo
     3,7 s   cintilar do brilho passando pelo logo
     saída   whoosh de ar + assentamento grave quando o logo voa
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
    const seg = 2.8, n = Math.floor(ctx.sampleRate * seg);
    const ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    sala = ctx.createGain(); sala.gain.value = .38;
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
  function assenta(t) {
    whoosh(t, .75, 2600, 380, .12);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(130.81, t + .3); o.frequency.exponentialRampToValueAtTime(98, t + 1.1);
    o.connect(g); g.connect(saida); g.connect(sala); o.start(t + .3); o.stop(t + 1.6);
    env(g, t + .3, .09, .03, 1.1);
    if (drone) { try { drone.gain.cancelScheduledValues(t); drone.gain.setTargetAtTime(0.0001, t, .12); } catch (e) {} }
  }

  /* ---------- trilha completa, alinhada ao relógio da animação ----------
     decorrido = quanto da abertura já passou quando o som pôde começar
     (o CSS começa a animar antes deste script e antes do áudio destravar).
     O que já passou é pulado — som atrasado soaria fora de sincronia. */
  const ROTEIRO = [
    [0.05, t => tensao(t, t + 1.85)], [0.9, t => riser(t, 1.0)],
    [1.62, estalo], [1.76, estalo], [1.9, ignicao],
    [3.28, t => whoosh(t, .7, 600, 3800, .1)], [3.7, cintilar]
  ];
  /* versão relâmpago (recarregar na mesma sessão, pacote zzc): ~1 s,
     mesmos tempos do CSS da curta (styles/global.css, abRelAcende etc.):
       0,00  subida curta de luz        0,34  estalo do filamento
       0,30  whoosh do "Branding7"       0,40  ACENDE (impacto mais leve)
       0,95  cintilar do brilho passando pelo logo */
  const ROTEIRO_CURTO = [
    [0.0, t => riser(t, .38)], [0.3, t => whoosh(t, .45, 700, 3800, .07)],
    [0.34, estalo], [0.4, t => ignicao(t, .62)], [0.95, cintilar]
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
    try { assenta(ctx.currentTime + .02); } catch (e) {}
    /* onda de luz (zzo): o anel corre pela tela (0,04–0,84 s) e o logo
       pousa no topo (~0,82 s) — um sopro subindo e um cintilar curto */
    try { whoosh(ctx.currentTime + .06, .75, 260, 2400, .05); } catch (e) {}
    try { cintilar(ctx.currentTime + .8); } catch (e) {}
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
    const salvo = [ctx, saida, sala, ruido, drone];
    const curto = qual === 'curta';
    const off = new OAC(2, 44100 * (curto ? 3.5 : 6.5), 44100);
    preparar(off);
    (curto ? ROTEIRO_CURTO : ROTEIRO).forEach(([quando, fn]) => fn(quando));
    assenta(curto ? 1.0 : 4.3);
    const buf = await off.startRendering();
    [ctx, saida, sala, ruido, drone] = salvo;
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
