/* =====================================================================
   SOM DA ABERTURA (pacote zp, 03/10; trilha refeita na zzz110, 08/10;
   épica na zzz229, 22/10 — "melhorar a trilha sonora... muito mais
   cinematográfico": coral sintetizado, passagens em estéreo, brilhos da
   montagem, prato ao contrário, fôlego antes do impacto, golpe metálico,
   boom longo, brasas, uma nota por letra e sala de cinema. O roteiro
   atual está em ROTEIRO, mais abaixo)
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
  /* ---------- peças da trilha épica (zzz229) ---------- */
  /* posição no estéreo (-1 esquerda, 1 direita); sem suporte, fica no meio */
  function lado(no, p) {
    if (!ctx.createStereoPanner) return no;
    const sp = ctx.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p)); no.connect(sp); return sp;
  }
  /* coral: serras desafinadas passando por filtros de vogal ("aah") —
     o "coro de trailer" sintetizado */
  function coro(t, dur, notas, vol, ataque) {
    const soma = ctx.createGain(); soma.gain.value = 1;
    notas.forEach(hz => [-9, -3, 4, 10].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = dt + (Math.random() - .5) * 4;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6 + Math.random() * .8; vg.gain.value = 7;
      vib.connect(vg); vg.connect(o.detune); vib.start(t); vib.stop(t + dur + .2);
      o.connect(soma); o.start(t); o.stop(t + dur + .2);
    }));
    const g = ctx.createGain(), sai = ctx.createGain(); sai.gain.value = 1 / Math.sqrt(notas.length * 4);
    [[730, 7, 1], [1090, 9, .55], [2440, 11, .22]].forEach(([f, q, v]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gv = ctx.createGain(); gv.gain.value = v * 3; soma.connect(bp); bp.connect(gv); gv.connect(sai);
    });
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    sai.connect(lp); lp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (ataque || dur * .6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
  /* algo passando rente à câmera: ar + um tom que cai (efeito Doppler), da esquerda para a direita (ou ao contrário) */
  function passagem(t, de, vol) {
    const dur = .85;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * .5); bp.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = ctx.createGain(); fonteRuido(t, dur).connect(bp); bp.connect(g);
    let fim = g;
    if (ctx.createStereoPanner) { const sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(de, t); sp.pan.linearRampToValueAtTime(-de, t + dur); g.connect(sp); fim = sp; }
    fim.connect(saida); fim.connect(sala);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator(), go = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(980, t); o.frequency.exponentialRampToValueAtTime(520, t + dur);
    o.connect(go); go.connect(fim); o.start(t); o.stop(t + dur + .05);
    go.gain.setValueAtTime(0.0001, t); go.gain.exponentialRampToValueAtTime(vol * .18, t + dur * .5); go.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  /* brilhos: notinhas da escala pentatônica de dó, cada vez mais juntas, espalhadas no estéreo — a lâmpada se montando */
  function brilhos(t0, t1, qtd, vol) {
    const ESC = [1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96, 3520];
    for (let i = 0; i < qtd; i++) {
      const u = Math.sqrt(Math.random()), t = t0 + (t1 - t0) * u;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.value = ESC[Math.floor(Math.random() * ESC.length)] * (Math.random() < .15 ? 2 : 1);
      o.connect(g); lado(g, Math.random() * 2 - 1).connect(sala);
      g.connect(saida);
      o.start(t); o.stop(t + .3);
      env(g, t, vol * (.4 + .6 * u), .002, .22);
    }
  }
  /* prato ao contrário: sobe até um instante antes do impacto e corta seco */
  function pratoReverso(t, ate) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(2200, t); hp.frequency.exponentialRampToValueAtTime(5200, ate);
    const g = ctx.createGain(); fonteRuido(t, ate - t + .02).connect(hp); hp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.16, ate - .01); g.gain.setValueAtTime(0.0001, ate);
  }
  /* o fôlego antes do golpe: tudo some por um instante (só na saída direta; a sala continua) */
  function folego(t, ate) {
    try {
      saida.gain.setValueAtTime(.7, t); saida.gain.linearRampToValueAtTime(.12, t + .05);
      saida.gain.setValueAtTime(.12, ate - .005); saida.gain.linearRampToValueAtTime(.7, ate);
    } catch (e) {}
  }
  /* golpe metálico com parciais inarmônicos, que fica soando na sala */
  function metal(t, hz, vol) {
    [[1, 1], [2.76, .5], [5.4, .25], [8.93, .12]].forEach(([m, p]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz * m;
      o.connect(g); g.connect(saida); g.connect(sala); o.start(t); o.stop(t + 3);
      env(g, t, vol * p, .003, 2.6 / Math.sqrt(m));
    });
  }
  /* boom longo: o grave que fica tremendo depois do impacto */
  function boom(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(24, t + 2.8);
    o.connect(g); g.connect(saida); o.start(t); o.stop(t + 3.2);
    env(g, t, vol, .01, 3);
  }
  /* brasas: estalinhos esparsos depois da explosão */
  function brasas(t0, t1, qtd) {
    for (let i = 0; i < qtd; i++) {
      const t = t0 + (t1 - t0) * Math.pow(Math.random(), 1.6);
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2500 + Math.random() * 4000; hp.Q.value = 2;
      const g = ctx.createGain(); fonteRuido(t, .02).connect(hp); hp.connect(g); lado(g, Math.random() * 1.6 - .8).connect(saida);
      env(g, t, .05 + Math.random() * .07, .001, .015 + Math.random() * .02);
    }
  }
  /* uma nota por letra do "Branding7", da esquerda para a direita (como as partículas escrevem) */
  function letras(t) {
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98].forEach((hz, i) => {
      const tt = t + i * .052;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = hz; o2.type = 'sine'; o2.frequency.value = hz * 2;
      o.connect(g); o2.connect(g); const p = lado(g, -.5 + i * .13); p.connect(saida); p.connect(sala);
      o.start(tt); o2.start(tt); o.stop(tt + .5); o2.stop(tt + .5);
      env(g, tt, .028, .003, .38);
    });
  }
  /* ---------- estilo "streaming" (zzz230) ---------- */
  /* uma batida grave e cheia; "grande" = a segunda, que fica soando na sala */
  function tumba(t, grande) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(grande ? 88 : 104, t); o.frequency.exponentialRampToValueAtTime(grande ? 36 : 50, t + (grande ? .5 : .22));
    o.connect(g); g.connect(saida); if (grande) g.connect(sala); o.start(t); o.stop(t + (grande ? 2.2 : .6));
    env(g, t, grande ? .95 : .7, .004, grande ? 1.9 : .42);
    /* corpo: um tom médio abafado que dá o "dum" */
    const c = ctx.createOscillator(), gc = ctx.createGain(), lp = ctx.createBiquadFilter(); c.type = 'triangle';
    c.frequency.setValueAtTime(grande ? 176 : 208, t); c.frequency.exponentialRampToValueAtTime(grande ? 88 : 120, t + .3);
    lp.type = 'lowpass'; lp.frequency.value = grande ? 900 : 700;
    c.connect(lp); lp.connect(gc); gc.connect(saida); gc.connect(sala); c.start(t); c.stop(t + 1.4);
    env(gc, t, grande ? .22 : .16, .003, grande ? 1.1 : .3);
    /* ataque: um "toc" curto de ruído */
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 2400;
    const gn = ctx.createGain(); fonteRuido(t, .06).connect(bp); bp.connect(gn); gn.connect(saida);
    env(gn, t, grande ? .22 : .16, .001, .05);
  }
  /* ---------- estilo "hiperespaço" (zzz231) ---------- */
  /* o motor: um zumbido que sobe de tom até o salto, com ar correndo junto */
  function motor(t, ate) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(4200, ate);
    [0, 7, -5].forEach((dt, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt;
      o.frequency.setValueAtTime(48 * (i === 2 ? .5 : 1), t); o.frequency.exponentialRampToValueAtTime(620 * (i === 2 ? .5 : 1), ate);
      o.connect(lp); o.start(t); o.stop(ate + .08);
    });
    lp.connect(g); g.connect(saida); g.connect(sala);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + (ate - t) * .4);
    g.gain.exponentialRampToValueAtTime(.12, ate - .02); g.gain.exponentialRampToValueAtTime(0.0001, ate + .06);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6000, ate);
    const gn = ctx.createGain(); fonteRuido(t, ate - t + .1).connect(bp); bp.connect(gn); gn.connect(saida); gn.connect(sala);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(.11, ate - .02); gn.gain.exponentialRampToValueAtTime(0.0001, ate + .05);
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
  function partida(t) {
    cortarTrilha(t);
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
  /* zzz229 — trilha épica, alinhada à abertura com câmera 3D:
       0,00  boom distante + pedal grave + coral que nasce do escuro
       0,40 / 0,95  as duas notas de sino (a pergunta)
       0,7 / 1,3 / 1,95  luzes passando rente à câmera (esquerda ↔ direita)
       1,6–3,3  brilhos cada vez mais juntos: a lâmpada se montando
       1,55  tensão; 2,4 riser; 2,55 e 2,98 o coração
       1,8–3,33  prato ao contrário subindo
       3,30  FÔLEGO: um instante quase mudo
       3,40  IMPACTO: sub-grave, batida, ar, braam, golpe metálico, boom
             longo e o coral em acorde cheio
       3,5–5,2  brasas estalando; 3,8 arpejo
       4,62  uma nota por letra do "Branding7"
       5,2  cintilar; 5,5 assinatura com o coral embaixo */
  const ROTEIRO = [
    [0.0, t => prologo(t, t + 3.4)], [0.0, t => coro(t, 3.5, [65.41, 98, 130.81, 196], .07, 3.1)],
    [0.4, t => sino(t, 392, .05, 2.2)], [0.95, t => sino(t, 523.25, .06, 2.6)],
    [0.7, t => passagem(t, -.9, .05)], [1.3, t => passagem(t, .9, .06)], [1.95, t => passagem(t, -.8, .07)],
    [1.6, t => brilhos(t, t + 1.7, 130, .026)],
    [1.55, t => tensao(t, t + 1.85)], [2.4, t => riser(t, .9)],
    [2.55, t => batida(t, .34)], [2.98, t => batida(t, .46)],
    [1.8, t => pratoReverso(t, t + 1.53)], [3.3, t => folego(t, t + .1)],
    [3.12, estalo], [3.26, estalo],
    [3.4, ignicao], [3.4, t => braam(t, 1.35)], [3.4, t => metal(t, 196, .06)], [3.4, t => boom(t, .55)],
    [3.4, t => coro(t, 3.2, [130.81, 196, 261.63, 329.63, 392], .09, .06)],
    [3.45, camaSonora], [3.5, t => brasas(t, t + 1.7, 34)], [3.8, arpejo],
    [4.62, letras], [4.78, t => whoosh(t, .7, 600, 3800, .08)], [5.2, cintilar],
    [5.5, assinatura], [5.5, t => coro(t + .19, 2.6, [130.81, 196, 261.63, 392], .04, .3)]
  ];
  /* zzz230 — estilo "streaming" (4,9 s), alinhado a styles/abertura.css (abStMarca):
       0,42  "tu" — batida grave curta        0,86  "DUM" — a batida grande, com sala
       0,90  um acorde de sinos acende com o logo
       1,40–2,35  o mergulho: coral e riser subindo, ar entrando
       2,30  a lâmpada se abre em luz: impacto suave + cama
       2,6–3,4  as faixas passando pelos lados (estéreo) e brilhos
       3,30  sopro: as faixas vão abrir o sistema (zzz231: o logo não volta;
             a saída da abertura, com o sistema aparecendo, é o próprio fim) */
  const ROTEIRO_STREAMING = [
    [0.42, t => tumba(t, false)], [0.86, t => tumba(t, true)],
    [0.9, t => { sino(t, 523.25, .03, 2.4); sino(t + .03, 659.25, .02, 2.2); sino(t + .06, 783.99, .02, 2.2); }],
    [1.4, t => coro(t, 1.4, [130.81, 196, 261.63, 329.63], .07, 1.1)], [1.5, t => riser(t, .8)],
    [1.7, t => whoosh(t, .7, 300, 2600, .07)],
    [2.3, t => ignicao(t, .7)], [2.3, camaSonora], [2.3, t => coro(t, 2.2, [261.63, 392, 523.25, 659.25], .06, .1)],
    [2.6, t => passagem(t, -.9, .06)], [2.95, t => passagem(t, .9, .07)], [2.7, t => brilhos(t, t + .8, 50, .02)],
    [3.3, t => whoosh(t, .5, 500, 4200, .09)]
  ];
  /* zzz231 — estilo "hiperespaço" (4,0 s), alinhado a styles/abertura.css (abHiMarca) e js/abertura-hiper.js:
       0,00  o escuro: pedal grave e coral bem baixo
       0,50–1,70  o motor sobe (tom e ar) e o prato ao contrário
       1,64  fôlego; 1,72 O SALTO: impacto, boom e braam
       1,75  a saída do salto: sopro descendo
       1,85  o logo: coral em acorde e sinos; 2,5 uma nota por letra
       3,00  cintilar do brilho; 3,2 assinatura */
  const ROTEIRO_HIPER = [
    [0.0, t => prologo(t, t + 1.8)], [0.0, t => coro(t, 1.9, [65.41, 98, 130.81], .035, 1.5)],
    [0.5, t => motor(t, t + 1.2)], [0.9, t => pratoReverso(t, t + .8)], [1.64, t => folego(t, t + .08)],
    [1.72, t => ignicao(t, 1)], [1.72, t => boom(t, .5)], [1.72, t => braam(t, 1.1)],
    [1.75, t => whoosh(t, .8, 4200, 260, .1)],
    [1.85, camaSonora], [1.85, t => coro(t, 2.2, [261.63, 392, 523.25, 659.25], .06, .08)],
    [1.9, t => { sino(t, 523.25, .03, 2.2); sino(t + .05, 783.99, .025, 2); }],
    [2.5, letras], [3.0, cintilar], [3.2, assinatura]
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
  /* zzz234 — os 5 estilos novos, alinhados a styles/abertura.css e js/abertura-cenas.js:
       tinta (4,2 s)    gotas caindo na água, coral subindo; 2,3 o logo nasce: impacto suave
       glitch (4,2 s)   estalos digitais e uma nota por letra digitada; 1,72 estouro; 1,9 o logo
       aurora (4,2 s)   coral e sinos calmos; 1,6 o logo aparece num acorde aberto
       neon (3,8 s)     o zumbido do letreiro e um estalo em cada piscada; 1,2 aceso de vez
       mosaico (4,2 s)  as peças virando (estalos em cascata); 2,0 se abrem; 2,3 o logo */
  const ROTEIRO_TINTA = [
    [0.0, t => coro(t, 2.4, [65.41, 98, 130.81], .04, 1.8)],
    [0.1, t => sino(t, 392, .03, 1.6)], [0.45, t => sino(t, 466.16, .025, 1.6)], [0.8, t => sino(t, 523.25, .03, 1.8)],
    [0.3, t => passagem(t, -.8, .045)], [1.0, t => passagem(t, .8, .05)],
    [1.3, t => riser(t, 1.0)], [1.4, t => whoosh(t, .9, 300, 2200, .06)], [2.22, t => folego(t, t + .08)],
    [2.3, t => ignicao(t, .75)], [2.3, t => boom(t, .35)], [2.3, camaSonora],
    [2.3, t => coro(t, 2.2, [261.63, 392, 523.25, 659.25], .06, .1)],
    [2.8, letras], [3.3, cintilar], [3.5, assinatura]
  ];
  const ROTEIRO_GLITCH = [
    [0.0, t => prologo(t, t + 1.7)],
    [0.25, t => { for (let i = 0; i < 10; i++) estalo(t + i * .09); }],
    [0.9, t => motor(t, t + .8)], [1.2, t => pratoReverso(t, t + .5)], [1.66, t => folego(t, t + .06)],
    [1.72, t => ignicao(t, .9)], [1.72, t => boom(t, .45)], [1.72, t => braam(t, .9)],
    [1.9, camaSonora], [1.9, t => coro(t, 2.0, [261.63, 392, 523.25, 659.25], .055, .06)],
    [1.92, t => { estalo(t); estalo(t + .05); }],
    [2.2, letras], [2.8, cintilar], [3.1, assinatura]
  ];
  const ROTEIRO_AURORA = [
    [0.0, t => coro(t, 2.0, [65.41, 98, 130.81, 196], .05, 1.6)],
    [0.2, t => brilhos(t, t + 1.6, 60, .016)],
    [0.3, t => sino(t, 659.25, .02, 2.4)], [0.75, t => sino(t, 783.99, .018, 2.4)], [1.2, t => sino(t, 987.77, .016, 2.4)],
    [0.6, t => passagem(t, -.7, .04)], [1.1, t => passagem(t, .7, .045)],
    [1.2, t => riser(t, .5)],
    [1.6, t => ignicao(t, .55)], [1.6, camaSonora], [1.6, t => coro(t, 2.6, [196, 261.63, 392, 493.88, 659.25], .06, .25)],
    [2.4, letras], [3.1, cintilar], [3.3, assinatura]
  ];
  const ROTEIRO_NEON = [
    [0.0, t => motor(t, t + .55)],
    [0.6, estalo], [0.7, estalo], [0.9, estalo], [1.2, estalo],
    [0.6, t => metal(t, 120, .03)], [0.9, t => metal(t, 120, .035)],
    [1.2, t => ignicao(t, .6)], [1.2, t => boom(t, .3)], [1.25, camaSonora],
    [1.25, t => coro(t, 2.2, [130.81, 196, 261.63, 329.63], .055, .1)],
    [1.8, estalo], [1.9, estalo], [2.0, letras], [2.6, cintilar], [2.8, assinatura]
  ];
  const ROTEIRO_MOSAICO = [
    [0.0, t => coro(t, 2.2, [65.41, 98, 130.81], .04, 1.5)],
    [0.2, t => { for (let i = 0; i < 16; i++) estalo(t + Math.pow(i / 16, 1.3) * 1.75); }],
    [0.6, t => passagem(t, -.8, .04)], [1.2, t => passagem(t, .8, .05)],
    [1.4, t => riser(t, .6)], [1.95, t => folego(t, t + .06)],
    [2.0, t => whoosh(t, .6, 500, 3800, .08)], [2.05, t => brilhos(t, t + .5, 40, .02)],
    [2.3, t => ignicao(t, .7)], [2.3, camaSonora], [2.3, t => coro(t, 2.0, [261.63, 392, 523.25, 659.25], .06, .08)],
    [2.6, letras], [3.2, cintilar], [3.4, assinatura]
  ];
  const ROTEIROS_EST = { streaming: ROTEIRO_STREAMING, hiper: ROTEIRO_HIPER, tinta: ROTEIRO_TINTA, glitch: ROTEIRO_GLITCH, aurora: ROTEIRO_AURORA, neon: ROTEIRO_NEON, mosaico: ROTEIRO_MOSAICO };
  const estiloAtual = () => document.documentElement.getAttribute('data-ab-estilo');
  const roteiroCompleto = () => ROTEIROS_EST[estiloAtual()] || ROTEIRO;
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
    if (curta) roteiro = ROTEIRO_CURTO; else roteiro = roteiroCompleto();
    if (!preparar()) return;
    requestAnimationFrame(() => {
      const a = el.querySelector(curta ? '.ab-palco' : ROTEIROS_EST[estiloAtual()] ? '.ab-marca' : '.ab-simbolo');
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
    (curto ? ROTEIRO_CURTO : ROTEIROS_EST[qual] || ROTEIRO).forEach(([quando, fn]) => fn(quando));
    partida(curto ? 1.0 : (saidaEm || ({ streaming: 3.6, hiper: 4.0, tinta: 4.2, glitch: 4.2, aurora: 4.2, neon: 3.8, mosaico: 4.2 })[qual] || 6.4));
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
