/* =====================================================================
   JOGO DA MANUTENÇÃO — "Corre pro Set!" (4.9.0)
   Pedido do Kevin: corrida infinita "no mesmo estilo" dos jogos de
   correr em 3 faixas: obstáculos para pular, ir para a direita ou a
   esquerda, ou rastejar por baixo; tutorial; quando bate, o diretor do
   estúdio vem correndo atrás; moedas para trocar de skin.
   Personagem, cenário e nome são da B7 (nada copiado de outro jogo).

   Regras:
     • a lâmpada corre sozinha, cada vez mais rápido, em 3 faixas;
     • ← → (ou deslizar) troca de faixa; ↑ pula; ↓ rasteja;
     • TRIPÉ deitado = pule; VARAL DE LUZ suspenso = rasteje por baixo;
       CASE de equipamento = desvie de faixa (bater de frente = fim);
     • bater de raspão num tripé ou varal = tropeção: o DIRETOR aparece
       correndo atrás. Tropeçar de novo com ele perto = pego, fim;
     • moedas B7 (carteira guardada no aparelho) compram skins; poderes:
       ímã, ×2, superpulo e claquete-escudo; dá para continuar a partida
       uma vez pagando moedas.
   Tutorial guiado na primeira vez (e pelo botão "Como jogar").
   ===================================================================== */
window.B7 = window.B7 || {};

B7.JogoCorrida = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const L = {
    get(k, p) { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch (e) { return p; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduz = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const leve = Math.min(innerWidth, innerHeight) < 700 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const vibrar = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  const SKINS = [
    { id: 'classica', nome: 'Clássica', preco: 0, cor: 0xffb3e0, brilho: 0xe2409c, base: 0xc21c83 },
    { id: 'neon', nome: 'Neon azul', preco: 150, cor: 0x9fe8ff, brilho: 0x1aa0ff, base: 0x1a5cff },
    { id: 'menta', nome: 'Menta', preco: 250, cor: 0xb8ffe0, brilho: 0x2fcb71, base: 0x0f8a4f },
    { id: 'fantasma', nome: 'Fantasma', preco: 400, cor: 0xffffff, brilho: 0xb9aecf, base: 0x6b5f8a, transp: true },
    { id: 'dourada', nome: 'Dourada', preco: 600, cor: 0xffe08a, brilho: 0xffb020, base: 0xb07800, metal: true },
    { id: 'lava', nome: 'Lava', preco: 800, cor: 0xffb070, brilho: 0xff3d00, base: 0x7a1a00 },
    { id: 'arcoiris', nome: 'Arco-íris', preco: 1200, cor: 0xffffff, brilho: 0xff00aa, base: 0x5b44c0, arco: true },
    { id: 'diretora', nome: 'Diretora', preco: 2000, cor: 0xffc8ea, brilho: 0xff3fa4, base: 0x2a1b6b, boina: true }
  ];
  const FAIXA = [-2.3, 0, 2.3];

  /* ------------------------------------------------------------------ som */
  function criarSom() {
    let ctx = null, mudo = L.get('b7_jogo_mudo', false);
    const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
    const tom = (f, d, tipo, v, q, f2) => {
      const c = ac(); if (!c || mudo) return;
      const t = c.currentTime + (q || 0), o = c.createOscillator(), g = c.createGain();
      o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    };
    return {
      acordar: ac, get mudo() { return mudo; }, alternar() { mudo = !mudo; L.set('b7_jogo_mudo', mudo); if (mudo && this.musica) this.musica.parar(); return mudo; },
      moeda(n) { tom(988 * Math.pow(1.03, n % 8), 0.07, 'square', 0.05); tom(1318 * Math.pow(1.03, n % 8), 0.1, 'triangle', 0.06, 0.04); },
      pulo() { tom(330, 0.18, 'sine', 0.1, 0, 700); },
      rasteja() { tom(500, 0.18, 'sine', 0.08, 0, 180); },
      lado() { tom(600, 0.06, 'triangle', 0.06, 0, 900); },
      tropeco() { tom(160, 0.3, 'sawtooth', 0.12, 0, 90); },
      fim() { [392, 330, 262, 196].forEach((f, i) => tom(f, 0.28, 'sine', 0.12, i * 0.14)); },
      poder() { [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.12, 'triangle', 0.1, i * 0.05)); },
      compra() { [659, 880, 1175].forEach((f, i) => tom(f, 0.15, 'sine', 0.1, i * 0.08)); },
      apito() { tom(2200, 0.12, 'square', 0.05); tom(2400, 0.2, 'square', 0.05, 0.13); },
      prancha() { tom(220, 0.35, 'sawtooth', 0.06, 0, 880); tom(440, 0.3, 'triangle', 0.08, 0.05, 1320); },
      /* 4.11.0: trilha sonora feita na hora (sem arquivo): baixo, arpejo,
         bumbo e chimbal em lá menor; acelera junto com a corrida */
      musica: (function () {
        let tmr = 0, prox = 0, passo = 0, bpm = 124, mestre = null, ruidoBuf = null;
        const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], BAIXO = [45, 41, 48, 43];
        const hz = m => 440 * Math.pow(2, (m - 69) / 12);
        function nota(c, f, t, d, tipo, v) { const o = c.createOscillator(), g = c.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g).connect(mestre); o.start(t); o.stop(t + d + 0.02); }
        function bumbo(c, t) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
          g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g).connect(mestre); o.start(t); o.stop(t + 0.18); }
        function chimbal(c, t, v) { if (!ruidoBuf) { ruidoBuf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate); const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
          const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = ruidoBuf; f.type = 'highpass'; f.frequency.value = 7000;
          g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f).connect(g).connect(mestre); s.start(t); }
        function agendar() {
          const c = ac(); if (!c) return;
          while (prox < c.currentTime + 0.2) {
            const sx = 60 / bpm / 4, comp = Math.floor(passo / 16) % 4, k = passo % 16, ac2 = ACORDES[comp];
            if (k % 4 === 0) bumbo(c, prox);
            if (k % 4 === 2) chimbal(c, prox, 0.09); else if (k % 2) chimbal(c, prox, 0.03);
            if (k % 2 === 0) nota(c, hz(BAIXO[comp] - (k === 6 || k === 14 ? -12 : 0)), prox, sx * 1.8, 'square', 0.07);
            nota(c, hz(ac2[k % 3] + 12 + (k >= 8 ? 12 : 0)), prox, sx * 0.9, 'triangle', 0.045);
            prox += sx; passo++;
          }
        }
        return {
          iniciar() { const c = ac(); if (!c || mudo || tmr) return; if (!mestre) { mestre = c.createGain(); mestre.gain.value = 0.6; mestre.connect(c.destination); }
            mestre.gain.setValueAtTime(0.6, c.currentTime); prox = c.currentTime + 0.05; tmr = setInterval(agendar, 60); agendar(); },
          parar() { clearInterval(tmr); tmr = 0; if (mestre && ctx) mestre.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); },
          ritmo(v) { bpm = Math.min(168, 118 + (v - 11) * 2.2); }
        };
      })()
    };
  }

  /* =================================================================== */
  function montar(caixa, opcoes) {
    opcoes = opcoes || {};
    const raiz = document.createElement('div');
    raiz.className = 'j3 jc';
    raiz.innerHTML =
      '<div class="j3-palco">' +
        '<canvas class="j3-tela" tabindex="0" aria-label="Jogo Corre pro Set: deslize para os lados, para cima para pular e para baixo para rastejar"></canvas>' +
        '<div class="j3-hud" aria-hidden="true">' +
          '<div class="j3-placar"><span class="j3-pts">0</span><small>pts</small></div>' +
          '<div class="jc-moedas"><i class="jc-moeda-ic"></i><span>0</span></div>' +
          '<div class="j3-dir"><span class="jc-poderes"></span><button type="button" class="j3-bt jc-prancha-bt" title="Prancha (toque duas vezes ou tecla E)">🛹<i>0</i></button><button type="button" class="j3-bt j3-som" title="Som">🔊</button><button type="button" class="j3-bt j3-cheia" title="Tela cheia">⛶</button></div>' +
          '<div class="j3-grito"></div><div class="j3-pops"></div><div class="j3-vinheta"></div>' +
          '<div class="jc-dica" hidden></div>' +
          '<div class="jc-perigo" hidden>🎬 O diretor está atrás de você!</div>' +
        '</div>' +
        '<div class="j3-menu">' +
          '<div class="jc-titulo">CORRE PRO <b>SET!</b></div>' +
          '<p class="j3-sub">Fuja do diretor, suba nos trens e junte moedas B7.<br><small>PC: setas ou WASD · <b>E</b> usa a prancha · Celular: deslize · toque 2× = prancha</small></p>' +
          '<div class="jc-bts"><button type="button" class="b pri j3-jogar">▶ Correr</button>' +
            '<button type="button" class="b contorno jc-loja-bt">🛍 Skins</button>' +
            '<button type="button" class="b contorno jc-tuto-bt">❓ Como jogar</button></div>' +
          '<div class="j3-info"><span class="jc-rec"></span><span class="jc-carteira"></span></div>' +
          (opcoes.jogos && opcoes.jogos.length ? '<div class="jc-outros"><small>Outros jogos</small>' + opcoes.jogos.map((j, i) => '<button type="button" class="jc-outro" data-j="' + i + '">' + esc(j.nome) + '</button>').join('') + '</div>' :
            opcoes.outroJogo ? '<button type="button" class="jc-outro">ou jogue "Ação! Corta!" →</button>' : '') +
          '<p class="j3-carregando" hidden>Montando o set…</p>' +
        '</div>' +
        '<div class="jc-loja" hidden><div class="jc-loja-cab"><b>Skins</b><span class="jc-carteira2"></span><button type="button" class="j3-bt jc-loja-x" title="Fechar">✕</button></div><div class="jc-grade"></div></div>' +
        '<div class="jc-fim" hidden></div>' +
        '<div class="j3-toast" aria-live="polite"></div>' +
      '</div>' +
      '<div class="j3-ranking" hidden><b>🏆 Ranking da equipe — Corre pro Set!</b><ol></ol></div>';
    caixa.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    const tela = $('.j3-tela'), palco = $('.j3-palco'), menu = $('.j3-menu');
    const som = criarSom();
    const HUD = { pts: $('.j3-pts'), moedas: $('.jc-moedas span'), poderes: $('.jc-poderes') };
    $('.j3-som').textContent = som.mudo ? '🔇' : '🔊';
    $('.j3-som').onclick = e => { e.stopPropagation(); $('.j3-som').textContent = som.alternar() ? '🔇' : '🔊'; };
    const sairCheia = B7.JogoTelaCheia ? B7.JogoTelaCheia(raiz, () => medir()) : () => {};
    if (opcoes.jogos) raiz.querySelectorAll('.jc-outro').forEach(b => b.onclick = () => { parar(); raiz.remove(); opcoes.jogos[+b.dataset.j].abrir(); });
    else if (opcoes.outroJogo) $('.jc-outro').onclick = () => { parar(); raiz.remove(); opcoes.outroJogo(); };

    /* ------------------------------------------------- carteira e skins */
    const carteira = () => L.get('b7_corrida_moedas', 0);
    const donas = () => L.get('b7_corrida_skins', ['classica']);
    const PRECO_PRANCHA = 300;
    const pranchas = () => L.get('b7_corrida_pranchas', 3);
    const hudPrancha = () => { const b = $('.jc-prancha-bt'); b.querySelector('i').textContent = pranchas(); b.classList.toggle('on', !!(S && S.prancha > performance.now())); };
    const skinAtual = () => SKINS.find(s => s.id === L.get('b7_corrida_skin', 'classica')) || SKINS[0];
    function pintarMenu() {
      const r = L.get('b7_corrida_recorde', 0);
      $('.jc-rec').textContent = r ? '🏅 Recorde: ' + r.toLocaleString('pt-BR') : '🏅 Sem recorde ainda';
      $('.jc-carteira').innerHTML = '🪙 ' + carteira().toLocaleString('pt-BR') + ' moedas';
    }
    pintarMenu();
    function toast(html) { const t = $('.j3-toast'); t.innerHTML = html; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2400); }
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    function pintarLoja() {
      const d = donas(), atual = skinAtual().id, tem = carteira();
      $('.jc-carteira2').textContent = '🪙 ' + tem.toLocaleString('pt-BR');
      $('.jc-grade').innerHTML = SKINS.map(s => {
        const minha = d.includes(s.id), usando = s.id === atual;
        const fundo = s.arco ? 'conic-gradient(#ff3fa4,#ffd36b,#3ddc97,#4cc3ff,#8b7bff,#ff3fa4)' : 'radial-gradient(circle at 35% 30%,#fff,' + hex(s.cor) + ' 40%,' + hex(s.brilho) + ')';
        return '<button type="button" class="jc-skin' + (usando ? ' on' : '') + (!minha && tem < s.preco ? ' cara' : '') + '" data-skin="' + s.id + '">' +
          '<span class="jc-skin-bola" style="background:' + fundo + (s.transp ? ';opacity:.6' : '') + '">' + (s.boina ? '<i class="jc-boina"></i>' : '') + '</span>' +
          '<b>' + esc(s.nome) + '</b><small>' + (usando ? 'Usando' : minha ? 'Equipar' : '🪙 ' + s.preco.toLocaleString('pt-BR')) + '</small></button>';
      }).join('');
      raiz.querySelectorAll('.jc-skin').forEach(b => b.onclick = () => {
        const s = SKINS.find(x => x.id === b.dataset.skin);
        if (!donas().includes(s.id)) {
          if (carteira() < s.preco) { toast('Faltam 🪙 ' + (s.preco - carteira()).toLocaleString('pt-BR') + ' para a ' + esc(s.nome)); return; }
          L.set('b7_corrida_moedas', carteira() - s.preco); L.set('b7_corrida_skins', donas().concat(s.id));
          som.compra(); vibrar([20, 30, 20]); toast('<b>Nova skin!</b> ' + esc(s.nome));
        }
        L.set('b7_corrida_skin', s.id); vestir(); pintarLoja(); pintarMenu();
      });
      const pb = document.createElement('button'); pb.type = 'button'; pb.className = 'jc-skin jc-skin-prancha' + (carteira() < PRECO_PRANCHA ? ' cara' : '');
      pb.innerHTML = '<span class="jc-skin-bola jc-prancha-ic">🛹</span><b>Prancha (' + pranchas() + ')</b><small>🪙 ' + PRECO_PRANCHA + '</small>';
      pb.onclick = () => { if (carteira() < PRECO_PRANCHA) { toast('Faltam 🪙 ' + (PRECO_PRANCHA - carteira()) + ' para a prancha'); return; }
        L.set('b7_corrida_moedas', carteira() - PRECO_PRANCHA); L.set('b7_corrida_pranchas', pranchas() + 1); som.compra(); toast('<b>+1 prancha!</b> Toque duas vezes na tela (ou tecla E) para usar'); pintarLoja(); pintarMenu(); hudPrancha(); };
      $('.jc-grade').prepend(pb);
    }
    $('.jc-loja-bt').onclick = () => { pintarLoja(); $('.jc-loja').hidden = false; };
    $('.jc-loja-x').onclick = () => { $('.jc-loja').hidden = true; };

    async function ranking() {
      if (!(B7.DB && B7.DB.rpc)) return;
      try {
        const l = await B7.DB.rpc('jogo_ranking_v2', { p_jogo: 'corrida' });
        if (!Array.isArray(l) || !l.length || !raiz.isConnected) return;
        $('.j3-ranking ol').innerHTML = l.map((x, i) => '<li><span>' + ['🥇', '🥈', '🥉', '4º', '5º'][i] + ' ' + esc(x.nome || 'Alguém') + '</span><b>' + esc(Number(x.pontos || 0).toLocaleString('pt-BR')) + '</b></li>').join('');
        $('.j3-ranking').hidden = false;
      } catch (e) {}
    }
    ranking();

    /* ------------------------------------------------------------- 3D */
    let T = null, renderer, cena, cam, W = 0, H = 0, fim = false, quadro = 0;
    const M = {}; let MD = null, X = null, MT = null;
    function medir() { if (!renderer) return; const r = tela.getBoundingClientRect(); W = Math.max(280, r.width); H = Math.max(200, r.height); renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
    const aoRedim = () => medir();
    async function preparar() {
      if (renderer) return;
      $('.j3-carregando').hidden = false;
      await B7.vendor('three'); T = window.THREE;
      renderer = new T.WebGLRenderer({ canvas: tela, antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, leve ? 1 : 1.25));
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5;
      renderer.shadowMap.enabled = false;   /* 4.10.1: sombras de contato no lugar das reais (desenhavam tudo 2×) */
      cena = new T.Scene(); cena.background = new T.Color(0x24163d); cena.fog = new T.Fog(0x24163d, 28, 80);
      cam = new T.PerspectiveCamera(60, 1, 0.1, 85); cam.position.set(0, 3.4, 7);
      /* 4.10.0: modelos realistas (js/jogo-corrida-modelos.js) e reflexo de estúdio */
      MD = B7.CorridaModelos; X = MD.texturas(T); MT = MD.materiais(T, X);
      try { cena.environment = MD.ambiente(T, renderer); } catch (e) {}
      try { montarMundo(); } catch (e) { renderer.dispose(); renderer = null; throw e; }
      vestir(); medir(); addEventListener('resize', aoRedim);
      $('.j3-carregando').hidden = true;
    }
    const mat = o => new T.MeshStandardMaterial(o);
    function montarMundo() {
      cena.add(new T.HemisphereLight(0xd8ccff, 0x4a3570, 1.5)); cena.add(new T.AmbientLight(0xffffff, 0.35));
      const sol = new T.DirectionalLight(0xffe6f4, 1.2); sol.position.set(5, 12, 8); sol.castShadow = false;
      sol.shadow.mapSize.set(512, 512); Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 10, bottom: -30, near: 1, far: 60 }); cena.add(sol);
      /* chão e pista com 3 faixas */
      const chao = new T.Mesh(new T.PlaneGeometry(70, 200), mat({ map: X.piso, color: 0xb9a8d8, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.6 }));
      chao.rotation.x = -Math.PI / 2; chao.position.z = -70; chao.receiveShadow = true; cena.add(chao);
      M.pistaTex = X.pista; const pista = new T.Mesh(new T.BoxGeometry(7.4, 0.1, 200), mat({ map: X.pista, color: 0xd6c8ff, roughness: 0.62, metalness: 0.1, envMapIntensity: 0.5 }));
      pista.position.set(0, 0.05, -70); pista.receiveShadow = true; cena.add(pista);
      M.neon = [];
      [-3.65, -1.15, 1.15, 3.65].forEach((x, i) => {
        const b = new T.Mesh(new T.BoxGeometry(i === 0 || i === 3 ? 0.14 : 0.05, 0.12, 200), mat({ color: 0xff3fa4, emissive: i === 0 || i === 3 ? 0xff3fa4 : 0x8b7bff, emissiveIntensity: i === 0 || i === 3 ? 1.6 : 0.9 }));
        b.position.set(x, 0.1, -70); cena.add(b); M.neon.push(b);
      });
      /* faixas no chão que passam (sensação de velocidade) */
      M.listras = [];
      for (let i = 0; i < 0; i++) { const l = new T.Mesh(new T.BoxGeometry(7, 0.02, 0.08), mat({ color: 0x7b5cff, emissive: 0x7b5cff, emissiveIntensity: 0.35, transparent: true, opacity: 0.5 })); l.position.set(0, 0.11, -i * 6); cena.add(l); M.listras.push(l); }
      /* cenário dos lados: refletores e cases empilhados que passam */
      M.lados = [];
      const tplRef = MD.fundir(T, MD.refletor(T, MT)), tplCad = MD.fundir(T, MD.cadeiraDiretor(T, MT)), tplCase = MD.fundir(T, MD.flightCase(T, MT, 1.3, 0.9, 1)), tplCabo = MD.fundir(T, MD.cabos(T, MT));
      for (let i = 0; i < 9; i++) {
        const g = new T.Group(), lado = i % 2 ? 1 : -1;
        if (leve && i % 2) { g.position.set(lado * 6.2, 0, -i * 12); cena.add(g); M.lados.push(g); continue; }
        const r = tplRef.clone(); r.rotation.y = lado > 0 ? -2.2 : 2.2; g.add(r);
        if (i % 3 === 0) { const c = tplCad.clone(); c.position.set(lado * -1.3, 0, 1.5); c.rotation.y = lado * 0.6 + Math.PI; g.add(c); }
        if (i % 3 === 1) { const c = tplCase.clone(); c.position.set(lado * -1.1, 0, -1.2); c.rotation.y = 0.3 * lado; g.add(c); }
        if (i % 4 === 2) { const c = tplCabo.clone(); c.position.set(lado * -1.4, 0, 0); c.scale.setScalar(0.5); g.add(c); }
        g.position.set(lado * 6.2, 0, -i * 12); cena.add(g); M.lados.push(g);
      }
      for (let i = 0; i < 0; i++) { const pl = new T.PointLight(i % 2 ? 0xff7ac6 : 0x9c8cff, 10, 22, 2); pl.position.set(i % 2 ? 4 : -4, 4, -8 - i * 12); cena.add(pl); }
      const ciclo = new T.Mesh(new T.PlaneGeometry(120, 40), mat({ color: 0x2a1240, emissive: 0x5a1e78, emissiveIntensity: 0.7 }));
      ciclo.position.set(0, 14, -110); cena.add(ciclo);

      /* a lâmpada */
      const lamp = new T.Group(); cena.add(lamp);
      const corpo = new T.Group(); lamp.add(corpo);
      const LP = MD.lampada(T, MT, X, leve); LP.g.position.y = -0.02; corpo.add(LP.g);
      M.sombraLamp = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), MT.sombra); M.sombraLamp.rotation.x = -Math.PI / 2; M.sombraLamp.position.y = 0.12; lamp.add(M.sombraLamp);
      M.bulboMat = LP.vidroMat; M.filMat = LP.filMat; M.baseMat = LP.baseMat; M.nucleo = LP.nucleo; M.aura = LP.aura;
      const bulbo = LP.g;
      M.pontos = [];
      for (let i = 0; i < 5; i++) { const p = new T.Mesh(new T.SphereGeometry(0.07 + (i % 3) * 0.02, 10, 8), new T.MeshBasicMaterial({ color: i % 2 ? 0x8b7bff : 0xff7ac6 })); corpo.add(p); M.pontos.push(p); }
      /* boina (skin Diretora) */
      M.boina = new T.Mesh(new T.CylinderGeometry(0.5, 0.42, 0.18, 24), mat({ color: 0x1c1633, roughness: 0.8 })); M.boina.position.set(0.08, 1.85, 0); M.boina.rotation.z = -0.25; corpo.add(M.boina);
      M.luz = new T.PointLight(0xff7ac6, 6, 7, 2); M.luz.position.y = 1.3; lamp.add(M.luz);
      M.escudo = new T.Mesh(new T.SphereGeometry(1.15, 24, 16), new T.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
      M.escudo.position.y = 1.05; M.escudo.visible = false; lamp.add(M.escudo);
      Object.assign(M, { lamp, corpo, bulbo });

      { /* o diretor (4.10.0: modelo de js/jogo-corrida-modelos.js) */
        const D = MD.diretor(T, MT); const dir = D.g; dir.visible = false; dir.scale.setScalar(0.92); cena.add(dir);
        M.dir = dir; M.dirCorpo = D.corpo; M.dirCab = D.cab; M.bracos = D.bracos; M.cotovelos = D.cotovelos; M.pernas = D.pernas; M.joelhos = D.joelhos;
        const sd = new T.Mesh(new T.PlaneGeometry(1.2, 0.8), MT.sombra); sd.rotation.x = -Math.PI / 2; sd.position.y = 0.12; dir.add(sd); }

      /* modelos dos obstáculos e itens (reaproveitados) */
      M.mats = {
        tripe: mat({ color: 0xb8b0cc, metalness: 0.8, roughness: 0.25 }),
        listra: mat({ color: 0xffd200, emissive: 0xffb000, emissiveIntensity: 1.4 }),
        preto: mat({ color: 0x141018, roughness: 0.6 }),
        varal: mat({ color: 0xffffff, emissive: 0xff3fa4, emissiveIntensity: 3 }),
        case: mat({ color: 0x5a4a8a, metalness: 0.4, roughness: 0.35 }),
        caseBorda: mat({ color: 0x7df9ff, emissive: 0x22d3ee, emissiveIntensity: 2.2 }),
        aviso: new T.MeshBasicMaterial({ color: 0xff3d6e, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }),
        moeda: mat({ color: 0xffd36b, emissive: 0xffa000, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.25 })
      };
      M.geoMoeda = new T.CylinderGeometry(0.32, 0.32, 0.08, 22);
      const F = g => MD.fundir(T, g);
      M.tpl = { baixo: F(MD.trussBaixo(T, MT)), alto: F(MD.trussAlto(T, MT, X)), case: F(MD.flightCase(T, MT, 1.95, 2.45, 2.3)), case2: F(MD.caseEmpilhado(T, MT)), moeda: F(MD.moeda(T, MT)),
        trem: [F(MD.trem(T, MT, 0xffffff)), F(MD.trem(T, MT, 0xc9e8ff)), F(MD.trem(T, MT, 0xffe0a8))], rampa: F(MD.rampa(T, MT)) };
      M.prancha = MD.prancha(T); M.prancha.position.y = 0.16; M.prancha.visible = false; M.lamp.add(M.prancha);
      /* 4.11.0: poderes com geometria e material reaproveitados */
      M.geoPoder = new T.IcosahedronGeometry(0.42, 0); M.geoAnel = new T.TorusGeometry(0.62, 0.05, 8, 32); M.matPoder = {}; M.corArco = new T.Color();
      M.objs = [];
      /* rastro */
      const NR = 50; M.rastro = { n: NR, pos: new Float32Array(NR * 3), i: 0 };
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(M.rastro.pos, 3));
      M.rastroPts = new T.Points(rg, new T.PointsMaterial({ color: 0xff9ad5, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending }));
      cena.add(M.rastroPts);
    }
    function vestir() {
      if (!M.bulboMat) return;
      const s = skinAtual(), c = new T.Color(s.brilho);
      M.bulboMat.emissive.setHex(s.brilho); M.bulboMat.color.setHex(s.transp ? 0xdde6ff : 0xffffff);
      if (M.bulboMat.attenuationColor) M.bulboMat.attenuationColor.setHex(s.cor);
      M.bulboMat.opacity = s.transp ? 0.35 : (M.bulboMat.transmission ? 1 : 0.5);
      M.filMat.color.copy(c).lerp(new T.Color(0xffffff), 0.55);
      M.nucleo.material.color.setHex(s.brilho); M.aura.material.color.setHex(s.brilho);
      M.baseMat.color.setHex(s.metal ? 0xffd36b : 0xd8c27a).lerp(new T.Color(s.base), 0.35);
      M.boina.visible = !!s.boina;
      M.luz.color.setHex(s.brilho); M.rastroPts.material.color.setHex(s.brilho);
    }

    /* ---------------------------------------------- obstáculos e moedas */
    /* 4.11.0: coisas sólidas (dá para subir em cima): frente/fundo em z
       local e a altura do topo; a rampa sobe de 0 a 2,6 m */
    const SOLIDO = { case: { f: 1.15, b: -1.15, topo: 2.57 }, trem: { f: 4.5, topo: 2.6 }, rampa: { f: 3, b: -3, topo: 2.6, rampa: true } };
    function altura(o, zl) {
      const d = o.sol; if (zl > d.f || zl < d.b) return -1;
      return d.rampa ? d.topo * (d.f - zl) / (d.f - d.b) : d.topo;
    }
    function criar(tipo, faixa, z, extra) {
      extra = extra || {};
      const g = new T.Group(); g.position.set(FAIXA[faixa], 0, z);
      if (tipo === 'baixo') g.add(M.tpl.baixo.clone());                       /* treliça baixa: pule */
      else if (tipo === 'alto') g.add(M.tpl.alto.clone());                   /* treliça aérea com PARs: rasteje */
      else if (tipo === 'case') g.add((Math.random() < 0.35 ? M.tpl.case2 : M.tpl.case).clone());   /* case: desvie (ou suba com superpulo) */
      else if (tipo === 'trem') { const n = extra.carros || 1, cor = Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) { const c = M.tpl.trem[cor].clone(); c.position.z = -i * 9.2; g.add(c); } }
      else if (tipo === 'rampa') g.add(M.tpl.rampa.clone());
      else if (tipo === 'moeda' || tipo === 'moedaAlta') {
        g.add(M.tpl.moeda.clone()); g.position.y = tipo === 'moedaAlta' ? 2.1 : 1;
      } else {                       /* poderes */
        const cores = { ima: 0xff4d6d, x2: 0x3ddc97, pulo: 0x4cc3ff, escudo: 0xffd36b };
        const mp = M.matPoder[tipo] || (M.matPoder[tipo] = [mat({ color: cores[tipo], emissive: cores[tipo], emissiveIntensity: 1.6 }), new T.MeshBasicMaterial({ color: cores[tipo] })]);
        g.add(new T.Mesh(M.geoPoder, mp[0])); g.position.y = 1.2 + (extra.y || 0); g.userData.y0 = g.position.y;
        g.add(new T.Mesh(M.geoAnel, mp[1]));
      }
      cena.add(g);
      const o = { tipo, faixa, g, vivo: true, obst: tipo === 'baixo' || tipo === 'alto' || tipo === 'case' || tipo === 'trem' || tipo === 'rampa',
        moeda: tipo === 'moeda' || tipo === 'moedaAlta', mov: extra.mov || 0 };
      if (SOLIDO[tipo]) { o.sol = Object.assign({}, SOLIDO[tipo]); if (tipo === 'trem') o.sol.b = -4.5 - ((extra.carros || 1) - 1) * 9.2; }
      if (extra.y && o.moeda) g.position.y += extra.y;
      M.objs.push(o); return o;
    }
    /* gera uma "fileira" lá na frente: sempre deixa ao menos uma saída */
    /* 4.11.0: fileira de trens — parados (com rampa para subir) ou vindo
       na sua direção; sempre sobra uma faixa livre. Devolve o espaço extra. */
    function fileiraTrem(z) {
      const livre = Math.floor(Math.random() * 3); let maior = 0;
      for (let f = 0; f < 3; f++) {
        if (f === livre) { if (Math.random() < 0.6) for (let k = 0; k < 6; k++) criar('moeda', f, z - k * 1.6); continue; }
        if (Math.random() < 0.25) continue;
        const carros = 1 + Math.floor(Math.random() * (S.dist > 900 ? 3 : 2)), anda = S.dist > 400 && Math.random() < 0.35;
        const tz = z - 4.5, o = criar('trem', f, tz, { carros, mov: anda ? 6 + Math.random() * 4 : 0 });
        const comp = 9 + (carros - 1) * 9.2; maior = Math.max(maior, comp + (anda ? 18 : 0));
        if (!anda) {
          if (Math.random() < 0.6) criar('rampa', f, tz + 4.5 + 3);
          for (let k = 0; k < Math.floor(comp / 1.8); k++) criar('moeda', f, tz + 3.5 - k * 1.8, { y: 2.6 });
          if (Math.random() < 0.25) criar(['ima', 'x2', 'pulo', 'escudo'][Math.floor(Math.random() * 4)], f, tz - comp + 6, { y: 2.6 });
        } else o.g.userData.farol = true;
      }
      return maior;
    }
    function fileira(z) {
      const n = S.dist;
      const teste = L.get('b7_corrida_teste', 0);
      if ((n > 150 || teste) && !S.tutorial && Math.random() < (teste ? 0.8 : Math.min(0.42, 0.18 + n / 6000))) return fileiraTrem(z);
      const livre = Math.floor(Math.random() * 3);
      for (let f = 0; f < 3; f++) {
        if (f === livre) { if (Math.random() < 0.7) for (let k = 0; k < 5; k++) criar('moeda', f, z - k * 1.6); continue; }
        const r = Math.random();
        if (r < 0.28) continue;
        const tipo = r < 0.52 ? 'baixo' : r < 0.74 ? 'alto' : 'case';
        criar(tipo, f, z);
        if (tipo === 'baixo' && Math.random() < 0.5) for (let k = -1; k <= 1; k++) criar(k === 0 ? 'moedaAlta' : 'moeda', f, z + k * 1.4);
      }
      if (n > 300 && Math.random() < 0.12) criar(['ima', 'x2', 'pulo', 'escudo'][Math.floor(Math.random() * 4)], livre, z - 9);
      return 0;
    }

    /* ------------------------------------------------------------ estado */
    let S = null;
    hudPrancha();
    if (L.get('b7_corrida_teste', 0)) window.B7_CORRIDA_TESTE = () => ({ dist: S && S.dist, y: S && S.y, chao: S && S.chao, tipos: M.objs.map(o => o.tipo + '@' + o.faixa + ':' + Math.round(o.g.position.z)) });
    function novaPartida(tutorial) {
      M.objs.forEach(o => cena.remove(o.g)); M.objs = [];
      S = { faixa: 1, x: 0, y: 0, vy: 0, rastejaAte: 0, vel: tutorial ? 11 : 13, dist: 0, pontos: 0, moedas: 0, mostrado: 0,
            mult: 1, perseg: 0, dirZ: 9, proxFileira: -30, rodando: true, ultimo: performance.now(), tremor: 0,
            poderes: {}, chao: 0, prancha: 0, invul: 0, continuou: false, tutorial: tutorial ? 1 : 0, tutoZ: 0, morrendo: 0, cor: 0 };
      M.dir.visible = false; $('.jc-perigo').hidden = true; hudPrancha(); som.musica.iniciar();
      if (tutorial) {
        criar('case', 1, -26); criar('case', 1, -30);
        for (let f = 0; f < 3; f++) criar('baixo', f, -62);
        for (let f = 0; f < 3; f++) criar('alto', f, -96);
        S.proxFileira = -130; S.tutoPassos = [{ z: -26, dica: '⬅️ ➡️ Deslize para o lado para desviar do case!', ok: () => S.faixa !== 1 },
          { z: -62, dica: '⬆️ Deslize para CIMA para pular o tripé!', ok: () => S.y > 0.6 },
          { z: -96, dica: '⬇️ Deslize para BAIXO para rastejar sob o varal!', ok: () => performance.now() < S.rastejaAte }];
      }
      grito(tutorial ? 'TUTORIAL' : 'AÇÃO!', 'acao');
      $('.jc-fim').hidden = true;
    }
    function grito(t, c) { const g = $('.j3-grito'); g.textContent = t; g.className = 'j3-grito ' + c; void g.offsetWidth; g.classList.add('on'); }
    function pop(t, c) { const p = document.createElement('span'); p.className = 'j3-pop ' + (c || ''); p.textContent = t; p.style.left = (40 + Math.random() * 20) + '%'; $('.j3-pops').appendChild(p); setTimeout(() => p.remove(), 1100); }

    /* ------------------------------------------------------------- comandos */
    function mover(d) {
      if (!S || !S.rodando || S.morrendo) return;
      const nova = Math.max(0, Math.min(2, S.faixa + d));
      if (nova === S.faixa) { tropecar('lado'); return; }
      /* bateu de lado num trem/case mais alto que você: quica de volta */
      for (const o of M.objs) if (o.sol && o.faixa === nova && o.vivo) { const h = altura(o, -o.g.position.z); if (h > 0 && S.y < h - 0.35) { tropecar('lado'); return; } }
      S.faixa = nova; som.lado();
    }
    function pular() { if (!S || !S.rodando || S.morrendo || S.y - S.chao > 0.08) return; const ag = performance.now(); S.vy = S.poderes.pulo > ag ? 16 : S.prancha > ag ? 12.6 : 11.5; S.rastejaAte = 0; som.pulo(); }
    /* 4.11.0: prancha — toque duas vezes (ou tecla E / botão 🛹): 30 s
       voando baixo; se bater, ela quebra no seu lugar */
    function retomar() {   /* pausado (aba escondida): toque ou tecla volta */
      if (!S || S.rodando || S.morrendo > 0 || !$('.jc-fim').hidden || !menu.hidden || raiz.closest('.mn-liberada')) return false;
      S.rodando = true; S.ultimo = performance.now(); S.invul = S.ultimo + 1000; raiz.classList.add('j3-jogando'); grito('AÇÃO!', 'acao'); som.musica.iniciar(); return true;
    }
    function usarPrancha() {
      if (!S || !S.rodando || S.morrendo) return;
      const ag = performance.now();
      if (S.prancha > ag) return;
      if (pranchas() <= 0) { toast('Sem pranchas — compre na loja 🛍'); return; }
      L.set('b7_corrida_pranchas', pranchas() - 1); S.prancha = ag + 30000; som.prancha(); vibrar(30); pop('🛹 PRANCHA!', 'poder'); hudPrancha();
    }
    function salvo(agora) {   /* prancha ou escudo seguram uma batida */
      if (S.prancha > agora) { S.prancha = 0; S.invul = agora + 1600; pop('Prancha quebrou! 🛹💥', 'pego'); som.tropeco(); vibrar(60); hudPrancha(); return true; }
      if (S.escudo) { S.escudo = false; S.invul = agora + 1200; pop('Escudo salvou! 🛡', 'poder'); som.poder(); return true; }
      return false;
    }
    function rastejar() { if (!S || !S.rodando || S.morrendo) return; S.rastejaAte = performance.now() + 750; if (S.y > 0.05) S.vy = -18; som.rasteja(); }

    /* ---------------------------------------------------------------- laço */
    function passo(agora) {
      if (fim) return;
      if (!raiz.isConnected) return parar();
      quadro = requestAnimationFrame(passo);
      if (!renderer) return;
      let dt = Math.min(0.05, (agora - (S ? S.ultimo : agora)) / 1000); if (S) S.ultimo = agora;
      if (S && S.rodando && (raiz.closest('.mn-liberada') || document.hidden)) { S.rodando = false; raiz.classList.remove('j3-jogando'); som.musica.parar(); grito('Pausado', 'acao'); }
      const t = agora / 1000;
      if (S && S.rodando) logica(agora, dt);
      animar(t, dt, agora);
      qualidade(agora);
      renderer.render(cena, cam);
    }
    /* 4.10.1: qualidade automática — a cada ~1 s olha o tempo médio dos
       quadros; travando (>24 ms), baixa a resolução; sobrando fôlego
       (<15 ms), sobe de volta até o teto do aparelho */
    let qMedia = 16, qUlt = 0, qN = 0;
    function qualidade(agora) {
      if (qUlt) qMedia = qMedia * 0.9 + Math.min(100, agora - qUlt) * 0.1;
      qUlt = agora;
      if (++qN < 30) return; qN = 0;
      const teto = Math.min(window.devicePixelRatio || 1, leve ? 1 : 1.25), pr = renderer.getPixelRatio();
      let novo = pr;
      if (qMedia > 20 && pr > 0.5) novo = Math.max(0.5, pr - 0.25);
      else if (qMedia < 15 && pr < teto) novo = Math.min(teto, pr + 0.1);
      if (novo !== pr) { renderer.setPixelRatio(novo); medir(); }
    }

    function logica(agora, dt) {
      /* tutorial: desacelera perto de cada obstáculo até a pessoa acertar */
      let fator = 1;
      if (S.tutorial && S.tutoPassos.length) {
        const p = S.tutoPassos[0], dz = p.z + S.dist;   /* distância até o obstáculo */
        if (dz > -9 && dz < 2) {
          const dica = $('.jc-dica'); if (dica.hidden || dica.textContent !== p.dica) { dica.textContent = p.dica; dica.hidden = false; }
          if (p.ok()) { S.tutoPassos.shift(); dica.hidden = true; pop('Isso! ✨', 'limite'); som.moeda(4); }
          else fator = 0.08;
        } else if (dz >= 2) { S.tutoPassos.shift(); $('.jc-dica').hidden = true; }   /* passou: segue para o próximo */
      
        if (!S.tutoPassos.length && !S.tutoFim) { S.tutoFim = true; L.set('b7_corrida_tuto', true); setTimeout(() => { if (S) grito('AGORA É PRA VALER!', 'cena'); }, 900); }
      }
      if (S.morrendo) { S.morrendo -= dt; if (S.morrendo <= 0) acabou(); return; }
      S.vel = Math.min(30, S.vel + dt * 0.18);
      const avanco = S.vel * dt * fator;
      S.dist += avanco;
      S.pontos += avanco * S.mult * (S.poderes.x2 > agora ? 2 : 1) * 1.5;
      /* mover objetos (o mundo vem até você) */
      let j = 0;
      for (const o of M.objs) {
        const g = o.g; g.position.z += avanco + o.mov * dt * fator;
        const z = g.position.z, fundo = o.sol ? z + o.sol.b : z;
        if (o.tipo === 'baixo' || o.tipo === 'alto' || o.tipo === 'case') { if (z > 1.9) g.scale.y = Math.max(0.001, 1 - (z - 1.9) * 1.8); if (z > 2.5) { cena.remove(g); continue; } }
        else if (fundo > (o.sol ? 3 : 8)) { cena.remove(g); continue; }
        M.objs[j++] = o;
      }
      M.objs.length = j;
      S.proxFileira += avanco;
      while (S.proxFileira > -52) { const ex = fileira(S.proxFileira - 26); S.proxFileira -= Math.max(9, 17 - S.vel * 0.25) + ex; }
      /* física: chão = o topo mais alto debaixo de você (trem, case, rampa) */
      S.x += (FAIXA[S.faixa] - S.x) * Math.min(1, dt * 14);
      let chao = 0;
      for (const o of M.objs) {
        if (!o.sol || !o.vivo || Math.abs(o.g.position.x - S.x) > 0.95) continue;
        const h = altura(o, -o.g.position.z); if (h < 0) continue;
        if (S.y >= h - (o.sol.rampa ? 0.7 : 0.4)) { if (h > chao) chao = h; }
        else if (agora > S.invul && !(S.tutorial && !S.tutoFim)) {   /* bateu de frente */
          if (salvo(agora)) { o.vivo = false; cena.remove(o.g); continue; }
          pego(o.tipo === 'trem' ? (o.mov ? 'Atropelado pelo trem!' : 'Bateu no trem!') : o.tipo === 'rampa' ? 'Bateu na rampa!' : 'Bateu no case!'); return;
        } else if (S.tutorial && !S.tutoFim && !o.passou) { o.passou = true; pop('Quase! Tente de novo 💪', 'poder'); }
      }
      S.chao = chao;
      S.vy -= 34 * dt; S.y += S.vy * dt; if (S.y <= chao) { S.y = chao; if (S.vy < 0) S.vy = 0; }
      const rasteja = agora < S.rastejaAte, alturaTopo = rasteja ? 0.75 : 1.9;
      /* colisões */
      const ima = S.poderes.ima > agora, x2 = S.poderes.x2 > agora ? 2 : 1;
      for (const o of M.objs) {
        if (!o.vivo) continue;
        const z = o.g.position.z, mesmaFaixa = Math.abs(o.g.position.x - S.x) < 0.95;
        if (o.moeda) {
          /* ímã: puxa TODAS as moedas em volta da lâmpada (as 3 faixas, em cima dos trens também) */
          if (ima && z > -14 && z < 2) { const k = Math.min(1, dt * (z > -5 ? 12 : 6)); o.g.position.x += (S.x - o.g.position.x) * k; o.g.position.y += (S.y + 1 - o.g.position.y) * k; o.g.position.z += (0 - z) * k * 0.6; }
          const yOk = Math.abs(o.g.position.y - (S.y + 1)) < 1.2;
          if (Math.abs(z) < 0.8 && Math.abs(o.g.position.x - S.x) < 0.9 && yOk) { o.vivo = false; cena.remove(o.g); S.moedas++; S.pontos += 10 * x2; som.moeda(S.moedas); }
          continue;
        }
        if (['ima', 'x2', 'pulo', 'escudo'].includes(o.tipo)) {
          if (Math.abs(z) < 1 && mesmaFaixa) {
            o.vivo = false; cena.remove(o.g); som.poder(); vibrar(25);
            if (o.tipo === 'escudo') { S.escudo = true; pop('🎬 ESCUDO!', 'poder'); }
            else { S.poderes[o.tipo] = agora + 9000; pop({ ima: '🧲 ÍMÃ!', x2: '✖️2 PONTOS!', pulo: '🦘 SUPERPULO!' }[o.tipo], 'poder'); }
          }
          continue;
        }
        if (o.sol || !mesmaFaixa || z < -0.9 || z > 0.9 || o.passou) continue;
        let bateu = false;
        if (o.tipo === 'baixo') bateu = S.y < 0.95;
        else if (o.tipo === 'alto') bateu = alturaTopo > 1.3 && S.y < 2.2;
        if (bateu && agora < S.invul) bateu = false;
        if (!bateu) { o.passou = true; continue; }
        if (S.tutorial && !S.tutoFim) { o.passou = true; pop('Quase! Tente de novo 💪', 'poder'); continue; }   /* no tutorial ninguém perde */
        o.passou = true;
        if (salvo(agora)) { o.vivo = false; cena.remove(o.g); continue; }
        tropecar(o.tipo);
      }
      if (S.prancha && S.prancha < agora) { S.prancha = 0; pop('A prancha acabou', ''); hudPrancha(); }
      som.musica.ritmo(S.vel);
      /* perseguição do diretor */
      if (S.perseg > 0) { S.perseg -= dt; if (S.perseg <= 0) { $('.jc-perigo').hidden = true; } }
      if (S.dist > 0 && Math.floor(S.dist / 500) > (S.marco || 0)) { S.marco = Math.floor(S.dist / 500); grito(S.marco * 500 + ' m!', 'cena'); som.apito(); }
    }
    function tropecar() {
      if (!S || S.morrendo) return;
      S.tremor = reduz() ? 0 : 0.8; vibrar(80); som.tropeco();
      $('.j3-vinheta').classList.remove('on'); void $('.j3-vinheta').offsetWidth; $('.j3-vinheta').classList.add('on');
      if (S.perseg > 0) { pego('O diretor te pegou!'); return; }
      S.perseg = 7; S.vel = Math.max(11, S.vel - 3); M.dir.visible = true; S.dirZ = 5.6; S.dirX = S.x;
      $('.jc-perigo').hidden = false; pop('Tropeçou! 😬', 'pego'); grito('CORTA!!', 'corta');
    }
    function pego(motivo) {
      som.musica.parar(); S.morrendo = 1.3; S.motivo = motivo; M.dir.visible = true; S.perseg = 2; som.tropeco(); vibrar([120, 60, 160]);
      grito('CORTA!', 'corta'); $('.jc-perigo').hidden = true;
    }

    function animar(t, dt, agora) {
      const corre = S && S.rodando && !S.morrendo ? 1 : 0;
      const vel = S ? S.vel : 6;
      /* chão e cenário passando */
      const av = (S && S.rodando ? vel : 4) * dt;
      M.listras.forEach(l => { l.position.z += av; if (l.position.z > 8) l.position.z -= 24 * 6; });
      if (M.pistaTex) { M.pistaTex.offset.y = (M.pistaTex.offset.y + av / 5) % 1; X.piso.offset.y = (X.piso.offset.y + av / 6.67) % 1; }
      M.lados.forEach(g => { g.position.z += av; if (g.position.z > 10) g.position.z -= 9 * 12; });
      const pulso = 1.3 + Math.sin(t * 5) * 0.4; M.neon.forEach((b, i) => { if (i === 0 || i === 3) b.material.emissiveIntensity = pulso; });
      /* lâmpada */
      const x = S ? S.x : 0, y = S ? S.y : 0, rast = S && agora < S.rastejaAte;
      M.lamp.position.set(x, y, 0);
      const ch = S ? S.chao : 0, prOn = !!(S && S.prancha > agora);
      if (M.sombraLamp) { M.sombraLamp.position.y = ch + 0.12 - y; const k = Math.max(0.35, 1 - (y - ch) * 0.25); M.sombraLamp.scale.set(k, k, k); }
      M.prancha.visible = prOn; if (prOn) { M.prancha.rotation.z = (S ? (FAIXA[S.faixa] - S.x) * -0.35 : 0); M.prancha.position.y = 0.16 + Math.sin(t * 9) * 0.04; }
      M.lamp.visible = !(S && agora < S.invul && Math.floor(agora / 90) % 2);
      M.corpo.scale.y += ((rast ? 0.5 : 1) - M.corpo.scale.y) * Math.min(1, dt * 18);
      M.corpo.rotation.x = rast ? -0.5 : -0.15 * corre;
      M.corpo.position.y = (prOn ? 0.3 : 0) + (y - ch > 0.02 || prOn ? 0 : Math.abs(Math.sin(t * 14)) * 0.12 * corre);
      M.corpo.rotation.z = S ? (FAIXA[S.faixa] - S.x) * -0.25 : 0;
      if (y - ch > 0.05) M.corpo.rotation.x -= Math.min(1, y - ch) * 0.6;
      M.pontos.forEach((p, i) => { const a = t * (2 + i * 0.2) + i * 1.3, r = 0.9 + (i % 3) * 0.1; p.position.set(Math.cos(a) * r, 1.15 + Math.sin(a * 1.4) * 0.3, Math.sin(a) * r); });
      const s = skinAtual(); if (s.arco) { S && (S.cor = (S.cor + dt * 0.35) % 1); const c = M.corArco.setHSL(S ? S.cor : t % 1, 0.9, 0.6); M.bulboMat.emissive.copy(c); M.luz.color.copy(c); M.rastroPts.material.color.copy(c); M.nucleo.material.color.copy(c); M.aura.material.color.copy(c); }
      M.escudo.visible = !!(S && S.escudo); if (M.escudo.visible) M.escudo.material.opacity = 0.18 + Math.sin(t * 6) * 0.06;
      if (corre) { const r = M.rastro; r.pos[r.i * 3] = x + (Math.random() - 0.5) * 0.4; r.pos[r.i * 3 + 1] = y + 0.5 + Math.random() * 0.9; r.pos[r.i * 3 + 2] = 0.7; r.i = (r.i + 1) % r.n; }
      for (let i = 0; i < M.rastro.n; i++) M.rastro.pos[i * 3 + 2] += av;
      M.rastroPts.geometry.attributes.position.needsUpdate = true;
      /* objetos girando */
      for (const o of M.objs) { if (o.moeda) o.g.rotation.y += dt * 4; else if (!o.obst) { o.g.rotation.y += dt * 2; o.g.position.y = o.g.userData.y0 + Math.sin(t * 4) * 0.15; } }
      /* diretor correndo atrás */
      if (M.dir.visible && S) {
        const alvo = S.morrendo ? 1.2 : S.perseg > 0 ? 4.4 : 14;
        S.dirZ += (alvo - S.dirZ) * Math.min(1, dt * (S.morrendo ? 6 : 2));
        /* segue a faixa da lâmpada com um atraso (corre pelo caminho já livre) */
        S.dirX = S.dirX == null ? S.x : S.dirX + (S.x - S.dirX) * Math.min(1, dt * 3);
        M.dir.position.set(S.dirX + (S.morrendo ? 0 : (S.x > 0 ? -0.9 : 0.9)), 0, S.dirZ); M.dir.rotation.y = 0;
        const fase = t * 15, passoD = Math.sin(fase);
        M.pernas[0].rotation.x = passoD * 0.9; M.pernas[1].rotation.x = -passoD * 0.9;
        M.joelhos[0].rotation.x = Math.max(0, -Math.cos(fase)) * 1.1; M.joelhos[1].rotation.x = Math.max(0, Math.cos(fase)) * 1.1;
        M.bracos[0].rotation.x = -passoD * 1.0;
        M.bracos[1].rotation.x = S.morrendo ? -1.4 : -0.9 + Math.sin(t * 6) * 0.25;   /* megafone apontado para você */
        M.cotovelos[0].rotation.x = -0.9 - Math.max(0, passoD) * 0.4; M.cotovelos[1].rotation.x = -0.5;
        M.dirCorpo.rotation.x = -0.18; M.dirCab.rotation.y = Math.sin(t * 3) * 0.2;
        M.dir.position.y = Math.abs(Math.cos(fase)) * 0.1;
        if (S.dirZ > 13) M.dir.visible = false;
      }
      /* câmera */
      const cx = x * 0.55, cy = 3.3 + ch * 0.75 + (y - ch) * 0.3, cz = 7 + (rast ? -0.6 : 0);
      cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 6);
      cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 5);
      cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 5);
      if (S && S.tremor > 0) { cam.position.x += (Math.random() - 0.5) * 0.45 * S.tremor; cam.position.y += (Math.random() - 0.5) * 0.3 * S.tremor; S.tremor = Math.max(0, S.tremor - dt * 2.5); }
      cam.fov += ((60 + Math.min(14, (vel - 13) * 0.6)) - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix();
      cam.lookAt(x * 0.3, 1.2 + ch * 0.6, -8);
      /* HUD */
      if (S) {
        S.mostrado += (S.pontos - S.mostrado) * Math.min(1, dt * 10);
        /* 4.11.0: só mexe no HUD quando muda (mexer no DOM todo quadro pesa) */
        const pts = Math.round(S.mostrado), ag = agora;
        if (pts !== M.hP) { M.hP = pts; HUD.pts.textContent = pts.toLocaleString('pt-BR'); }
        if (S.moedas !== M.hM) { M.hM = S.moedas; HUD.moedas.textContent = S.moedas; }
        const ps = (S.poderes.ima > ag ? '🧲 ' : '') + (S.poderes.x2 > ag ? '✖️2 ' : '') + (S.poderes.pulo > ag ? '🦘 ' : '') + (S.escudo ? '🛡 ' : '') + (prOn ? '🛹' + Math.ceil((S.prancha - ag) / 1000) + 's' : '');
        if (ps !== M.hS) { M.hS = ps; HUD.poderes.textContent = ps; }
      }
    }

    /* ---------------------------------------------------------- partida */
    async function jogar(tutorial) {
      som.acordar(); $('.jc-loja').hidden = true;
      try { await preparar(); } catch (e) { toast('Este aparelho não conseguiu abrir o jogo 3D.'); return; }
      menu.hidden = true; raiz.classList.add('j3-jogando');
      novaPartida(tutorial === true || !L.get('b7_corrida_tuto', false));
      try { tela.focus({ preventScroll: true }); } catch (e) {}
    }
    function acabou() {
      S.rodando = false; raiz.classList.remove('j3-jogando'); som.musica.parar(); som.fim();
      const pts = Math.round(S.pontos);
      const rec = L.get('b7_corrida_recorde', 0), novo = pts > rec && !S.tutorial;
      if (novo) L.set('b7_corrida_recorde', pts);
      L.set('b7_corrida_moedas', carteira() + S.moedas);
      if (!S.tutorial && B7.DB && B7.DB.rpc && pts > 0) B7.DB.rpc('jogo_registrar_v2', { p_pontos: pts, p_jogo: 'corrida' }).catch(() => {}).then(ranking);
      const precoVolta = 100 + Math.round(S.dist / 10);
      const f = $('.jc-fim');
      f.innerHTML = '<b class="jc-fim-t">' + esc(S.motivo || 'CORTA!') + '</b>' +
        (novo ? '<span class="j3-novo">🏅 NOVO RECORDE!</span>' : '') +
        '<span class="j3-final">' + esc(pts.toLocaleString('pt-BR')) + ' pts</span>' +
        '<span class="jc-fim-l">' + esc(Math.round(S.dist)) + ' m · 🪙 +' + esc(S.moedas) + ' moedas (total ' + esc(carteira().toLocaleString('pt-BR')) + ')</span>' +
        '<div class="jc-bts">' + (!S.continuou && !S.tutorial ? '<button type="button" class="b pri jc-volta">↻ Continuar (🪙 ' + precoVolta + ')</button>' : '') +
        '<button type="button" class="b ' + (S.continuou || S.tutorial ? 'pri' : 'contorno') + ' jc-denovo">▶ Nova corrida</button><button type="button" class="b contorno jc-menu-bt">Menu</button></div>';
      f.hidden = false;
      const v = f.querySelector('.jc-volta');
      if (v) v.onclick = () => {
        if (carteira() < precoVolta) { toast('Faltam 🪙 ' + (precoVolta - carteira()) + ' para continuar'); return; }
        L.set('b7_corrida_moedas', carteira() - precoVolta);
        Object.assign(S, { rodando: true, morrendo: 0, perseg: 0, continuou: true, escudo: true, moedas: 0, ultimo: performance.now() });
        M.objs.filter(o => o.g.position.z > -14).forEach(o => { cena.remove(o.g); o.vivo = false; });
        M.dir.visible = false; f.hidden = true; raiz.classList.add('j3-jogando'); grito('DE VOLTA!', 'acao'); som.poder(); som.musica.iniciar(); S.invul = performance.now() + 1500;
      };
      f.querySelector('.jc-denovo').onclick = () => { f.hidden = true; jogar(false); };
      f.querySelector('.jc-menu-bt').onclick = () => { f.hidden = true; pintarMenu(); menu.hidden = false; };
      pintarMenu();
    }

    /* ---------------------------------------------------------- controles */
    $('.j3-jogar').onclick = () => jogar(false);
    $('.jc-tuto-bt').onclick = () => jogar(true);
    let p0 = null;
    let ultToque = 0;
    palco.addEventListener('pointerdown', e => { if (e.target.closest('button, .jc-loja, .jc-fim, .j3-menu')) return; if (retomar()) return; const ag = performance.now();
      if (ag - ultToque < 300) { usarPrancha(); ultToque = 0; } else ultToque = ag;
      p0 = { x: e.clientX, y: e.clientY, t: ag, feito: false }; });
    $('.jc-prancha-bt').onclick = e => { e.stopPropagation(); usarPrancha(); };
    palco.addEventListener('pointermove', e => {
      if (!p0 || p0.feito) return;
      const dx = e.clientX - p0.x, dy = e.clientY - p0.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      p0.feito = true; ultToque = 0;
      if (Math.abs(dx) > Math.abs(dy)) mover(dx > 0 ? 1 : -1); else if (dy < 0) pular(); else rastejar();
    });
    addEventListener('pointerup', () => { p0 = null; });
    palco.addEventListener('touchmove', e => { if (S && S.rodando) e.preventDefault(); }, { passive: false });
    const tecla = e => {
      if (!raiz.isConnected) return;
      const k = e.code;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(k)) return;
      e.preventDefault();
      if (S && !S.rodando && !e.repeat && retomar()) return;
      if (!S || !S.rodando) { if (!menu.hidden && (k === 'Space') && !e.repeat) jogar(false); return; }
      if (e.repeat) return;
      if (k === 'ArrowLeft' || k === 'KeyA') mover(-1);
      else if (k === 'ArrowRight' || k === 'KeyD') mover(1);
      else if (k === 'KeyE' || k === 'ShiftLeft' || k === 'ShiftRight') usarPrancha();
      else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') pular();
      else rastejar();
    };
    addEventListener('keydown', tecla);

    quadro = requestAnimationFrame(passo);
    preparar().catch(() => {});

    function parar() {
      if (fim) return; fim = true; cancelAnimationFrame(quadro); try { sairCheia(); } catch (e) {} som.musica.parar();
      removeEventListener('resize', aoRedim); removeEventListener('keydown', tecla);
      try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch (e) {}
    }
    return { parar };
  }

  return { montar };
})();
