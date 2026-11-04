/* =====================================================================
   JOGO DA MANUTENÇÃO 3D — "Ação! Corta!" (4.8.0)
   Pedido do Kevin: "quero o jogo 3D, bem mais elaborado e bonito, com
   mais coisas, pra dopaminar a pessoa".

   A batatinha frita 1, 2, 3 num set de gravação em 3D:
     • a lâmpada da B7 corre por uma passarela de luz até a câmera;
     • virada para você (luz verde, filmando) = AÇÃO: segure para andar;
     • quando ela vira de costas (luz vermelha) = CORTA: solte!
       Mexeu depois que ela te viu → perde uma vida e é empurrado para trás.
     • Soltar bem na hora em que ela começa a girar = "NO LIMITE!": bônus
       e combo (×2, ×3… até ×5).
     • Ideias douradas no caminho (+pontos × combo), café (corre mais por
       3 s) e claquete de ouro (vida extra, rara).
     • Cada chegada = CENA GRAVADA: confete, estrelas (1 a 3), fanfarra e
       o diretor fica mais rápido e mais traiçoeiro.
     • Conquistas guardadas no aparelho, recorde e ranking da equipe
       (jogo_registrar / jogo_ranking, os mesmos da 4.7.0).
   Som sintetizado na hora (Web Audio, com botão de mudo) e vibração no
   celular. three.js só baixa quando o jogo abre (B7.vendor('three')).
   Sem WebGL, cai no jogo 2D de antes (js/jogo-manut.js).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Jogo3D = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const L = {
    get(k, p) { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch (e) { return p; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduz = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const celular = () => Math.min(innerWidth, innerHeight) < 700 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const temWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };

  const CONQUISTAS = [
    ['primeira', '🎬', 'Primeira cena', 'Grave sua primeira cena'],
    ['limite5', '🧊', 'Nervos de aço', '5 paradas "no limite" numa partida'],
    ['ideias50', '💡', 'Colecionador', '50 ideias numa partida'],
    ['cenas5', '⭐', 'Diretor favorito', '5 cenas numa partida'],
    ['semcorte', '🎯', 'Take perfeito', 'Uma cena sem perder vida'],
    ['combo5', '🔥', 'Pegando fogo', 'Chegue no combo ×5'],
    ['cenas10', '🏆', 'Lenda do set', '10 cenas numa partida'],
    ['pts10k', '💎', 'Blockbuster', '10.000 pontos numa partida']
  ];

  /* ------------------------------------------------------------------ som */
  function criarSom() {
    let ctx = null, mudo = L.get('b7_jogo_mudo', false);
    const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
    function tom(freq, dur, tipo, vol, quando, desliza) {
      const c = ac(); if (!c || mudo) return;
      const t = c.currentTime + (quando || 0), o = c.createOscillator(), g = c.createGain();
      o.type = tipo || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (desliza) o.frequency.exponentialRampToValueAtTime(desliza, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function ruido(dur, vol, filtro) {
      const c = ac(); if (!c || mudo) return;
      const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = filtro || 2400; g.gain.value = vol || 0.25;
      s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start();
    }
    return {
      acordar: ac,
      get mudo() { return mudo; },
      alternar() { mudo = !mudo; L.set('b7_jogo_mudo', mudo); return mudo; },
      ideia(n) { const f = 660 * Math.pow(1.06, Math.min(n, 12)); tom(f, 0.09, 'triangle', 0.12); tom(f * 1.5, 0.12, 'sine', 0.08, 0.05); },
      acao() { ruido(0.18, 0.12, 1200); tom(300, 0.25, 'sine', 0.06, 0, 600); },
      corta() { ruido(0.06, 0.4, 3200); tom(180, 0.08, 'square', 0.06); },
      pego() { tom(140, 0.35, 'sawtooth', 0.12, 0, 70); ruido(0.2, 0.15, 400); },
      limite(c) { tom(880 + c * 80, 0.1, 'sine', 0.14); tom(1320 + c * 120, 0.16, 'sine', 0.1, 0.07); },
      poder() { [523, 659, 784, 1046].forEach((f, i) => tom(f, 0.12, 'triangle', 0.1, i * 0.05)); },
      cena() { [523, 659, 784, 1046, 1318].forEach((f, i) => tom(f, 0.22, 'triangle', 0.12, i * 0.09)); tom(1046, 0.6, 'sine', 0.08, 0.5); },
      fim() { [392, 330, 262, 196].forEach((f, i) => tom(f, 0.3, 'sine', 0.12, i * 0.16)); },
      conquista() { [784, 988, 1175, 1568].forEach((f, i) => tom(f, 0.18, 'sine', 0.1, i * 0.07)); }
    };
  }

  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* =================================================================== */
  function montar(caixa) {
    const raiz = document.createElement('div');
    raiz.className = 'j3';
    raiz.innerHTML =
      '<div class="j3-palco">' +
        '<canvas class="j3-tela" tabindex="0" aria-label="Jogo Ação! Corta! em 3D: segure para andar enquanto a câmera filma, solte quando ela virar de costas"></canvas>' +
        '<div class="j3-hud" aria-hidden="true">' +
          '<div class="j3-placar"><span class="j3-pts">0</span><small>pts</small></div>' +
          '<div class="j3-meio"><span class="j3-cena">Cena 1</span><div class="j3-barra"><i></i></div></div>' +
          '<div class="j3-dir"><span class="j3-vidas"></span><button type="button" class="j3-bt j3-som" title="Som">🔊</button><button type="button" class="j3-bt j3-cheia" title="Tela cheia">⛶</button></div>' +
          '<div class="j3-combo" hidden></div>' +
          '<div class="j3-grito"></div>' +
          '<div class="j3-pops"></div>' +
          '<div class="j3-vinheta"></div>' +
        '</div>' +
        '<div class="j3-menu">' +
          '<div class="j3-logo"><span>AÇÃO!</span><span>CORTA!</span></div>' +
          '<p class="j3-sub">No <b>AÇÃO!</b> a câmera te filma: segure para correr. No <b>CORTA!</b> ela vira de costas: <b>solte na hora!</b></p>' +
          '<button type="button" class="b pri j3-jogar">▶ Jogar</button>' +
          '<div class="j3-info"><span class="j3-rec"></span><span class="j3-conq-n"></span></div>' +
          '<div class="j3-conqs"></div>' +
          '<p class="j3-carregando" hidden>Montando o set…</p>' +
        '</div>' +
        '<div class="j3-toast" aria-live="polite"></div>' +
      '</div>' +
      '<div class="j3-ranking" hidden><b>🏆 Ranking da equipe</b><ol></ol></div>';
    caixa.appendChild(raiz);

    const $ = s => raiz.querySelector(s);
    const tela = $('.j3-tela'), palco = $('.j3-palco'), menu = $('.j3-menu');
    const som = criarSom();
    $('.j3-som').textContent = som.mudo ? '🔇' : '🔊';
    $('.j3-som').onclick = e => { e.stopPropagation(); $('.j3-som').textContent = som.alternar() ? '🔇' : '🔊'; };
    $('.j3-cheia').onclick = e => { e.stopPropagation(); raiz.classList.toggle('j3-cheio'); setTimeout(medir, 30); };

    /* ------------------------------------------------- menu: recorde etc. */
    const conq = () => L.get('b7_jogo_conq', {});
    function pintarMenu() {
      const rec = L.get('b7_jogo3d_recorde', 0), c = conq();
      $('.j3-rec').textContent = rec ? '🏅 Recorde: ' + rec.toLocaleString('pt-BR') : '🏅 Sem recorde ainda';
      $('.j3-conq-n').textContent = '🎖 ' + Object.keys(c).length + '/' + CONQUISTAS.length + ' conquistas';
      $('.j3-conqs').innerHTML = CONQUISTAS.map(([id, ic, nome, desc]) =>
        '<span class="j3-medalha' + (c[id] ? ' ok' : '') + '" title="' + esc(nome + ': ' + desc) + '">' + (c[id] ? ic : '🔒') + '</span>').join('');
    }
    pintarMenu();
    let toastAte = 0;
    function toast(html) {
      const t = $('.j3-toast'); t.innerHTML = html; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
      toastAte = performance.now() + 2600; setTimeout(() => { if (performance.now() >= toastAte) t.classList.remove('on'); }, 2700);
    }
    function ganhar(id) {
      const c = conq(); if (c[id]) return;
      c[id] = Date.now(); L.set('b7_jogo_conq', c);
      const d = CONQUISTAS.find(x => x[0] === id); if (!d) return;
      som.conquista(); vibrar([30, 40, 30]);
      toast('<b>' + d[1] + ' Conquista!</b> ' + esc(d[2]));
    }
    async function ranking() {
      if (!(B7.DB && B7.DB.rpc)) return;
      try {
        const l = await B7.DB.rpc('jogo_ranking', {});
        if (!Array.isArray(l) || !l.length || !raiz.isConnected) return;
        $('.j3-ranking ol').innerHTML = l.map((x, i) => '<li><span>' + ['🥇', '🥈', '🥉', '4º', '5º'][i] + ' ' + esc(x.nome || 'Alguém') + '</span><b>' + esc(Number(x.pontos || 0).toLocaleString('pt-BR')) + '</b></li>').join('');
        $('.j3-ranking').hidden = false;
      } catch (e) {}
    }
    ranking();

    /* --------------------------------------------------- carrega o 3D */
    let T = null, fim = false, quadro = 0;
    let renderer, cena, cam, mundo = {}, W = 0, H = 0;
    const leve = celular();
    function medir() {
      if (!renderer) return;
      const r = tela.getBoundingClientRect(); W = Math.max(280, r.width); H = Math.max(200, r.height);
      renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    }
    const aoRedim = () => medir();

    async function prepararMundo() {
      $('.j3-carregando').hidden = false;
      await B7.vendor('three');
      T = window.THREE;
      renderer = new T.WebGLRenderer({ canvas: tela, antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, leve ? 1 : 1.25));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = !leve; renderer.shadowMap.type = T.PCFSoftShadowMap;
      cena = new T.Scene();
      cena.background = new T.Color(0x0c0714); cena.fog = new T.Fog(0x0c0714, 30, 110);
      cam = new T.PerspectiveCamera(55, 1, 0.1, 200);
      montarSet();
      medir(); addEventListener('resize', aoRedim);
      $('.j3-carregando').hidden = true;
    }

    const PISTA = 40;   /* comprimento da passarela (z de 0 a -PISTA) */
    function montarSet() {
      const M = (o) => new T.MeshStandardMaterial(o);
      /* luz ambiente e de preenchimento */
      cena.add(new T.HemisphereLight(0x9c7cff, 0x1a0e28, 0.55));
      const sol = new T.DirectionalLight(0xffe2f2, 1.1); sol.position.set(6, 14, 6);
      sol.castShadow = false; sol.shadow.mapSize.set(512, 512);
      Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -50, near: 1, far: 80 });
      cena.add(sol);
      /* chão de estúdio brilhante */
      const chao = new T.Mesh(new T.PlaneGeometry(60, 140), M({ color: 0x150c22, roughness: 0.32, metalness: 0.35 }));
      chao.rotation.x = -Math.PI / 2; chao.position.z = -40; chao.receiveShadow = true; cena.add(chao);
      /* passarela com bordas de luz que pulsam */
      const pista = new T.Mesh(new T.BoxGeometry(4.2, 0.12, PISTA + 6), M({ color: 0x241638, roughness: 0.25, metalness: 0.4 }));
      pista.position.set(0, 0.06, -PISTA / 2 + 1); pista.receiveShadow = true; cena.add(pista);
      mundo.bordas = [];
      [-2.15, 2.15].forEach(x => {
        const b = new T.Mesh(new T.BoxGeometry(0.12, 0.16, PISTA + 6), M({ color: 0xff3fa4, emissive: 0xff3fa4, emissiveIntensity: 1.6 }));
        b.position.set(x, 0.1, -PISTA / 2 + 1); cena.add(b); mundo.bordas.push(b);
      });
      /* faixas no chão da passarela, a cada 4 m (sensação de velocidade) */
      mundo.faixas = [];
      for (let z = 0; z > -PISTA; z -= 4) {
        const f = new T.Mesh(new T.BoxGeometry(3.6, 0.02, 0.18), M({ color: 0x7b5cff, emissive: 0x7b5cff, emissiveIntensity: 0.9 }));
        f.position.set(0, 0.13, z); cena.add(f); mundo.faixas.push(f);
      }
      /* fundo: um ciclorama curvo com a luz da marca */
      const cicloMat = M({ color: 0x2a1240, emissive: 0x5a1e78, emissiveIntensity: 0.9, side: T.BackSide, roughness: 1 });
      const ciclo = new T.Mesh(new T.CylinderGeometry(26, 26, 18, 48, 1, true, Math.PI * 0.15, Math.PI * 0.7), cicloMat);
      ciclo.position.set(0, 8, -PISTA - 4); ciclo.rotation.y = Math.PI; cena.add(ciclo);
      /* refletores laterais (softbox + tripé) */
      mundo.softs = [];
      for (let i = 0; i < 6; i++) {
        const lado = i % 2 ? 1 : -1, z = -6 - Math.floor(i / 2) * 13;
        const pe = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 4.2, 8), M({ color: 0x1b1428, metalness: 0.8, roughness: 0.3 }));
        pe.position.set(lado * 6, 2.1, z); cena.add(pe);
        const caixaL = new T.Mesh(new T.BoxGeometry(1.8, 1.2, 0.3), M({ color: 0xffffff, emissive: i % 3 ? 0xffd9f0 : 0xd9ccff, emissiveIntensity: 1.4 }));
        caixaL.position.set(lado * 6, 4.4, z); caixaL.lookAt(0, 1, z - 3); cena.add(caixaL); mundo.softs.push(caixaL);
        if (false) { const pl = new T.PointLight(i % 2 ? 0xff7ac6 : 0x9c8cff, 6, 16, 2); pl.position.set(lado * 4.5, 4, z); cena.add(pl); }
      }
      /* poeira de luz flutuando */
      const N = leve ? 160 : 380, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = -Math.random() * 70 + 6; }
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      mundo.poeira = new T.Points(pg, new T.PointsMaterial({ color: 0xffc8ea, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }));
      cena.add(mundo.poeira);

      /* ---- a câmera do diretor (o "boneco" que vira) ---- */
      const dir = new T.Group(); dir.position.set(0, 0, -PISTA - 1.2); dir.scale.setScalar(1.6); cena.add(dir);
      /* luz própria no diretor: ele precisa ser visto lá do começo */
      const luzDir = new T.SpotLight(0xffe6f4, 120, 30, 0.6, 0.5, 1.2); luzDir.position.set(0, 9, -PISTA + 6);
      luzDir.target.position.set(0, 3, -PISTA - 1.2); cena.add(luzDir); cena.add(luzDir.target);
      const aura = new T.Mesh(new T.CircleGeometry(4.2, 48), new T.MeshBasicMaterial({ color: 0xff3fa4, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
      aura.position.set(0, 4.2, -PISTA - 4); cena.add(aura); mundo.aura = aura;
      const tripe = new T.Group(); dir.add(tripe);
      for (let i = 0; i < 3; i++) {
        const perna = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 2.6, 6), M({ color: 0x0e0a16, metalness: 0.7, roughness: 0.4 }));
        const a = i * Math.PI * 2 / 3; perna.position.set(Math.cos(a) * 0.45, 1.2, Math.sin(a) * 0.45);
        perna.rotation.z = Math.cos(a) * 0.32; perna.rotation.x = -Math.sin(a) * 0.32; tripe.add(perna);
      }
      const cabeca = new T.Group(); cabeca.position.y = 2.55; dir.add(cabeca);
      const corpo = new T.Mesh(new T.BoxGeometry(1.5, 1, 1.9), M({ color: 0x241a33, roughness: 0.35, metalness: 0.55 }));
      corpo.castShadow = true; cabeca.add(corpo);
      const lente = new T.Mesh(new T.CylinderGeometry(0.42, 0.52, 0.9, 24), M({ color: 0x0b0812, roughness: 0.2, metalness: 0.8 }));
      lente.rotation.x = Math.PI / 2; lente.position.z = 1.35; cabeca.add(lente);
      const vidro = new T.Mesh(new T.CircleGeometry(0.36, 24), M({ color: 0x3a5cff, emissive: 0x2238aa, emissiveIntensity: 0.8, roughness: 0.05, metalness: 1 }));
      vidro.position.z = 1.81; cabeca.add(vidro);
      mundo.rolos = [];
      [-0.45, 0.55].forEach((z, i) => {
        const rolo = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.16, 28), M({ color: 0x1a1426, metalness: 0.7, roughness: 0.3 }));
        rolo.rotation.z = Math.PI / 2; rolo.position.set(0, 0.95, z); cabeca.add(rolo); mundo.rolos.push(rolo);
      });
      const rec = new T.Mesh(new T.SphereGeometry(0.13, 16, 16), M({ color: 0x3ddc97, emissive: 0x3ddc97, emissiveIntensity: 3 }));
      rec.position.set(0.55, 0.3, 0.96); cabeca.add(rec);
      const recLuz = new T.PointLight(0x3ddc97, 8, 9, 2); recLuz.position.set(0, 0.4, 1.4); cabeca.add(recLuz);
      /* o facho de "te vi": um cone de luz vermelha que aparece no corta */
      const facho = new T.Mesh(new T.ConeGeometry(4.5, PISTA * 0.9, 32, 1, true),
        new T.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      facho.rotation.x = Math.PI / 2; facho.position.set(0, -1.6, PISTA * 0.45 + 1.8); cabeca.add(facho); facho.visible = false;   /* 4.8.0: tirado; a aura e a luz REC já dizem tudo */
      Object.assign(mundo, { dir, cabeca, rec, recLuz, facho, vidro });

      /* ---- a lâmpada (a jogadora) ---- */
      const lamp = new T.Group(); cena.add(lamp);
      const bulbo = new T.Mesh(new T.SphereGeometry(0.62, 32, 24), M({ color: 0xffb3e0, emissive: 0xe2409c, emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.1 }));
      bulbo.scale.set(1, 1.12, 1); bulbo.position.y = 1.25; bulbo.castShadow = true; lamp.add(bulbo);
      const nucleo = new T.Mesh(new T.SphereGeometry(0.28, 16, 12), new T.MeshBasicMaterial({ color: 0xfff1fb }));
      nucleo.position.y = 1.25; lamp.add(nucleo);
      [0.5, 0.36, 0.22].forEach((y, i) => {
        const anel = new T.Mesh(new T.CylinderGeometry(0.3 - i * 0.04, 0.3 - i * 0.04, 0.1, 20), M({ color: 0xc21c83, emissive: 0x7a1050, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }));
        anel.position.y = y; anel.castShadow = true; lamp.add(anel);
      });
      /* os pontinhos do logo orbitando */
      mundo.pontos = [];
      for (let i = 0; i < 6; i++) {
        const p = new T.Mesh(new T.SphereGeometry(0.07 + (i % 3) * 0.025, 10, 8), new T.MeshBasicMaterial({ color: i % 2 ? 0x8b7bff : 0xff7ac6 }));
        lamp.add(p); mundo.pontos.push(p);
      }
      const luzLamp = new T.PointLight(0xff7ac6, 6, 7, 2); luzLamp.position.y = 1.4; lamp.add(luzLamp);
      Object.assign(mundo, { lamp, bulbo, luzLamp });

      /* ---- itens: ideias, café, claquete ---- */
      mundo.itens = [];
      mundo.geoIdeia = new T.OctahedronGeometry(0.32, 0);
      mundo.matIdeia = M({ color: 0xffd36b, emissive: 0xffb020, emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.2 });
      mundo.geoCafe = new T.CylinderGeometry(0.28, 0.22, 0.5, 16);
      mundo.matCafe = M({ color: 0x4cc3ff, emissive: 0x1aa0ff, emissiveIntensity: 1.2 });
      mundo.geoClaq = new T.BoxGeometry(0.7, 0.5, 0.08);
      mundo.matClaq = M({ color: 0xffe066, emissive: 0xffc400, emissiveIntensity: 1.6, metalness: 0.8, roughness: 0.2 });

      /* ---- confete ---- */
      const NC = leve ? 220 : 480;
      mundo.conf = { n: NC, pos: new Float32Array(NC * 3), vel: new Float32Array(NC * 3), vida: 0 };
      const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.BufferAttribute(mundo.conf.pos, 3));
      const cores = new Float32Array(NC * 3), paleta = [[1, .25, .64], [.55, .48, 1], [1, .83, .42], [.24, .86, .59], [.3, .76, 1]];
      for (let i = 0; i < NC; i++) { const c = paleta[i % paleta.length]; cores.set(c, i * 3); }
      cg.setAttribute('color', new T.BufferAttribute(cores, 3));
      mundo.confPts = new T.Points(cg, new T.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
      cena.add(mundo.confPts);
      /* rastro da lâmpada */
      const NR = 60; mundo.rastro = { n: NR, pos: new Float32Array(NR * 3), i: 0 };
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(mundo.rastro.pos, 3));
      mundo.rastroPts = new T.Points(rg, new T.PointsMaterial({ color: 0xff9ad5, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
      cena.add(mundo.rastroPts);
    }

    function espalharItens(nivel) {
      mundo.itens.forEach(it => cena.remove(it.m)); mundo.itens = [];
      const qtd = 9 + Math.min(10, nivel * 2);
      for (let i = 0; i < qtd; i++) {
        const z = -4 - (i / qtd) * (PISTA - 8) - Math.random() * 1.5, x = (Math.random() - 0.5) * 2.4;
        const m = new T.Mesh(mundo.geoIdeia, mundo.matIdeia); m.position.set(x, 1.1, z);
        cena.add(m); mundo.itens.push({ m, tipo: 'ideia', vivo: true, fase: Math.random() * 6 });
      }
      if (Math.random() < 0.75) { const m = new T.Mesh(mundo.geoCafe, mundo.matCafe); m.position.set((Math.random() - 0.5) * 2, 1.1, -10 - Math.random() * 20); cena.add(m); mundo.itens.push({ m, tipo: 'cafe', vivo: true, fase: 0 }); }
      if (nivel >= 1 && Math.random() < 0.3) { const m = new T.Mesh(mundo.geoClaq, mundo.matClaq); m.position.set((Math.random() - 0.5) * 2, 1.3, -16 - Math.random() * 16); cena.add(m); mundo.itens.push({ m, tipo: 'claq', vivo: true, fase: 0 }); }
    }

    /* ------------------------------------------------------------- estado */
    let S = null, segurando = false;
    const LIMITE_MAX = 5;
    function novaPartida() {
      S = { z: 0, x: 0, vel: 0, cenas: 0, vidas: 3, pontos: 0, mostrado: 0, combo: 1, maxCombo: 1, limites: 0,
            ideias: 0, perdeuNaCena: false, fase: 'acao', ate: 0, falso: false, giro: 0, giroAlvo: 0,
            viu: false, tVirou: 0, cafeAte: 0, tremor: 0, rodando: true, ultimo: performance.now(), slowAte: 0, tCena: performance.now() };
      espalharItens(0);
      mundo.lamp.position.set(0, 0, 0);
      fase('acao', performance.now(), true);
      atualizarHud(true);
    }
    /* o diretor: olhando para você = AÇÃO; virando de costas = CORTA */
    function fase(f, agora, primeira) {
      const n = S.cenas;
      if (f === 'acao') {
        S.fase = 'acao'; S.viu = false; S.giroAlvo = 0;
        const base = Math.max(850, 2700 - n * 170);
        S.falso = !primeira && n >= 1 && Math.random() < Math.min(0.38, 0.12 + n * 0.05);
        S.ate = agora + (S.falso ? 280 + Math.random() * 220 : base * (0.55 + Math.random() * 0.9));
        grito(S.falso ? 'Aç…' : 'AÇÃO!', 'acao'); if (!primeira) som.acao();
      } else {
        S.fase = 'corta'; S.giroAlvo = Math.PI; S.tVirou = agora;
        S.ate = agora + 1150 + Math.random() * 1300;
        /* o tempo que a câmera leva para virar = o tempo para soltar */
        S.janela = Math.max(150, 330 - n * 16);
        S.soltouNoLimite = false;
        grito('CORTA!', 'corta'); som.corta(); vibrar(20);
      }
    }

    function grito(txt, tipo) {
      const g = $('.j3-grito'); g.textContent = txt; g.className = 'j3-grito ' + tipo; void g.offsetWidth; g.classList.add('on');
    }
    function pop(txt, cls) {
      const p = document.createElement('span'); p.className = 'j3-pop ' + (cls || ''); p.textContent = txt;
      p.style.left = (38 + Math.random() * 24) + '%';
      $('.j3-pops').appendChild(p); setTimeout(() => p.remove(), 1100);
    }
    function atualizarHud(tudo) {
      $('.j3-cena').textContent = 'Cena ' + (S.cenas + 1);
      $('.j3-vidas').textContent = '❤️'.repeat(Math.max(0, S.vidas)) + '🖤'.repeat(Math.max(0, 3 - S.vidas));
      const c = $('.j3-combo');
      if (S.combo > 1) { c.hidden = false; c.textContent = '×' + S.combo + ' COMBO'; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      else c.hidden = true;
      if (tudo) $('.j3-pts').textContent = '0';
    }
    function confete(x, y, z) {
      const c = mundo.conf; c.vida = 1;
      for (let i = 0; i < c.n; i++) {
        c.pos[i * 3] = x; c.pos[i * 3 + 1] = y; c.pos[i * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2, f = 3 + Math.random() * 7;
        c.vel[i * 3] = Math.cos(a) * f * 0.6; c.vel[i * 3 + 1] = 6 + Math.random() * 8; c.vel[i * 3 + 2] = Math.sin(a) * f * 0.6;
      }
    }

    /* ---------------------------------------------------------------- laço */
    function passo(agora) {
      if (fim) return;
      if (!raiz.isConnected) return parar();
      quadro = requestAnimationFrame(passo);
      if (!renderer) return;
      let dt = Math.min(0.05, (agora - (S ? S.ultimo : agora)) / 1000);
      if (S) S.ultimo = agora;
      const tempo = agora / 1000;
      /* a manutenção acabou ou a aba sumiu: pausa */
      if (S && S.rodando && (raiz.closest('.mn-liberada') || document.hidden)) { S.rodando = false; segurando = false; raiz.classList.remove('j3-jogando'); if (raiz.closest('.mn-liberada')) grito('Pausado', 'acao'); }
      if (S && S.slowAte > agora) dt *= 0.35;

      if (S && S.rodando) logica(agora, dt);
      animar(tempo, dt, agora);
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
      if (agora >= S.ate) fase(S.fase === 'acao' ? 'corta' : 'acao', agora);
      /* soltou durante o giro: NO LIMITE */
      if (S.fase === 'corta' && !segurando && !S.soltouNoLimite && S.estavaSegurando && agora - S.tVirou < S.janela) {
        S.soltouNoLimite = true; S.limites++;
        S.combo = Math.min(LIMITE_MAX, S.combo + 1); S.maxCombo = Math.max(S.maxCombo, S.combo);
        const b = 150 * S.combo; S.pontos += b;
        pop('NO LIMITE! +' + b, 'limite'); som.limite(S.combo); vibrar(15); atualizarHud();
        if (S.limites >= 5) ganhar('limite5'); if (S.combo >= 5) ganhar('combo5');
      }
      S.estavaSegurando = segurando;
      /* a câmera já virou (passou da janela) e você ainda se mexe: pego */
      if (S.fase === 'corta' && segurando && !S.viu && agora - S.tVirou >= S.janela) {
        S.viu = true; S.vidas--; S.perdeuNaCena = true; S.combo = 1;
        segurando = false; S.estavaSegurando = false;
        S.z = Math.max(0, S.z - PISTA * 0.22); S.tremor = reduz() ? 0 : 1;
        $('.j3-vinheta').classList.remove('on'); void $('.j3-vinheta').offsetWidth; $('.j3-vinheta').classList.add('on');
        som.pego(); vibrar([90, 40, 90]);
        pop(S.vidas > 0 ? 'MEXEU NO CORTA! −1 ❤️' : 'FIM DE GRAVAÇÃO', 'pego'); atualizarHud();
        if (S.vidas <= 0) return acabou();
      }
      /* andar */
      const andando = segurando && S.fase === 'acao' || (segurando && S.fase === 'corta' && agora - S.tVirou < S.janela);
      const alvoVel = andando ? (6.2 + S.cenas * 0.45) * (agora < S.cafeAte ? 1.6 : 1) : 0;
      S.vel += (alvoVel - S.vel) * Math.min(1, dt * (andando ? 7 : 14));
      S.z += S.vel * dt;
      S.pontos += Math.round(S.vel * dt * 10);
      /* itens */
      const lz = -S.z;
      for (const it of mundo.itens) {
        if (!it.vivo) continue;
        if (Math.abs(it.m.position.z - lz) < 0.9 && Math.abs(it.m.position.x - mundo.lamp.position.x) < 1.6) {
          it.vivo = false; cena.remove(it.m);
          if (it.tipo === 'ideia') { S.ideias++; const v = 50 * S.combo; S.pontos += v; pop('+' + v, 'ideia'); som.ideia(S.ideias % 13); if (S.ideias >= 50) ganhar('ideias50'); }
          else if (it.tipo === 'cafe') { S.cafeAte = agora + 3000; pop('☕ TURBO!', 'poder'); som.poder(); }
          else if (it.tipo === 'claq') { S.vidas = Math.min(5, S.vidas + 1); pop('🎬 +1 VIDA', 'poder'); som.poder(); atualizarHud(); }
        }
      }
      /* chegou na câmera */
      if (S.z >= PISTA - 1.5) {
        S.cenas++;
        const seg = (agora - S.tCena) / 1000;
        const estrelas = (S.perdeuNaCena ? 1 : 2) + (seg < 9 + S.cenas ? 1 : 0);
        const b = 1000 + estrelas * 250; S.pontos += b;
        confete(0, 2, -PISTA + 2); som.cena(); vibrar([40, 30, 40, 30, 80]);
        grito('CENA ' + S.cenas + ' GRAVADA! ' + '⭐'.repeat(estrelas), 'cena');
        pop('+' + b, 'cena');
        S.slowAte = agora + (reduz() ? 0 : 650);
        if (S.cenas === 1) ganhar('primeira'); if (!S.perdeuNaCena) ganhar('semcorte');
        if (S.cenas >= 5) ganhar('cenas5'); if (S.cenas >= 10) ganhar('cenas10');
        S.z = 0; S.vel = 0; S.perdeuNaCena = false; S.tCena = agora + 1600;
        espalharItens(S.cenas); segurando = false;
        S.ate = agora + 1600; S.fase = 'acao'; S.giroAlvo = 0;   /* respiro antes da próxima */
        atualizarHud();
      }
      if (S.pontos >= 10000) ganhar('pts10k');
      /* barra de progresso */
      $('.j3-barra i').style.width = Math.min(100, (S.z / (PISTA - 1.5)) * 100) + '%';
    }

    function animar(t, dt, agora) {
      const m = mundo;
      /* placar subindo como contador */
      if (S) { S.mostrado += (S.pontos - S.mostrado) * Math.min(1, dt * 10); $('.j3-pts').textContent = Math.round(S.mostrado).toLocaleString('pt-BR'); }
      /* cabeça da câmera gira suave */
      const alvo = S ? S.giroAlvo : Math.sin(t * 0.6) * 0.5;
      const atual = m.cabeca.rotation.y; const vel = S && S.fase === 'corta' ? 14 : 5;
      m.cabeca.rotation.y = atual + (alvo - atual) * Math.min(1, dt * vel);
      const olhando = Math.abs(m.cabeca.rotation.y) < 0.6;
      const corta = S && S.fase === 'corta';
      const cor = corta ? 0xff2d55 : 0x3ddc97;
      m.rec.material.color.setHex(cor); m.rec.material.emissive.setHex(cor); m.recLuz.color.setHex(cor);
      m.rec.material.emissiveIntensity = corta ? 3 + Math.sin(t * 20) * 1.5 : 2.5;
      m.facho.material.opacity += ((!corta && olhando ? 0.11 : 0) - m.facho.material.opacity) * Math.min(1, dt * 10);
      m.rolos.forEach((r, i) => { r.rotation.x += (corta ? 0.5 : 5) * dt * (i ? -1 : 1); });
      /* bordas e faixas pulsando no ritmo */
      const pulso = 1.3 + Math.sin(t * (corta ? 14 : 4)) * 0.5;
      m.bordas.forEach(b => { b.material.emissive.setHex(corta ? 0xff2d55 : 0xff3fa4); b.material.emissiveIntensity = pulso; });
      m.faixas.forEach((f, i) => { f.material.emissiveIntensity = 0.5 + Math.max(0, Math.sin(t * 6 - i * 0.8)) * 1.2; });
      m.softs.forEach((s, i) => { s.material.emissiveIntensity = 1.2 + Math.sin(t * 1.3 + i) * 0.2; });
      if (m.aura) { m.aura.material.color.setHex(corta ? 0xff2d55 : 0x3ddc97); m.aura.material.opacity = 0.18 + Math.sin(t * (corta ? 16 : 3)) * 0.06; m.aura.scale.setScalar(1 + Math.sin(t * 2) * 0.04); }
      /* poeira subindo devagar */
      const pp = m.poeira.geometry.attributes.position;
      for (let i = 0; i < pp.count; i++) { let y = pp.getY(i) + dt * 0.25; if (y > 12) y = 0; pp.setY(i, y); }
      pp.needsUpdate = true;
      /* lâmpada: posição, balanço ao correr, pontinhos orbitando */
      const z = -(S ? S.z : 0), corre = S ? Math.min(1, S.vel / 6) : 0;
      m.lamp.position.z = z;
      m.lamp.position.y = Math.abs(Math.sin(t * 12)) * 0.18 * corre;
      m.lamp.rotation.z = Math.sin(t * 12) * 0.08 * corre;
      m.lamp.rotation.x = -0.18 * corre;
      const sq = 1 + Math.sin(t * 24) * 0.04 * corre;
      m.bulbo.scale.set(1 / sq, 1.12 * sq, 1 / sq);
      const turbo = S && agora < S.cafeAte;
      m.bulbo.material.emissiveIntensity = 1 + corre * 0.8 + (turbo ? Math.sin(t * 30) * 0.5 + 0.6 : 0);
      m.luzLamp.intensity = 5 + corre * 5;
      m.pontos.forEach((p, i) => { const a = t * (1.6 + i * 0.15) + i * 1.05, r = 0.95 + (i % 3) * 0.12; p.position.set(Math.cos(a) * r, 1.25 + Math.sin(a * 1.3) * 0.35, Math.sin(a) * r); });
      /* rastro */
      if (corre > 0.2) { const r = m.rastro; r.pos[r.i * 3] = (Math.random() - 0.5) * 0.5; r.pos[r.i * 3 + 1] = 0.6 + Math.random() * 0.9; r.pos[r.i * 3 + 2] = z + 0.6; r.i = (r.i + 1) % r.n; m.rastroPts.geometry.attributes.position.needsUpdate = true; }
      m.rastroPts.material.opacity += ((corre > 0.2 ? 0.55 : 0) - m.rastroPts.material.opacity) * Math.min(1, dt * 4);
      /* itens girando e flutuando */
      m.itens.forEach(it => { if (!it.vivo) return; it.m.rotation.y += dt * 2.4; it.m.position.y = 1.1 + Math.sin(t * 3 + it.fase) * 0.15; });
      /* confete com gravidade */
      const c = m.conf;
      if (c.vida > 0) {
        c.vida -= dt * 0.45;
        for (let i = 0; i < c.n; i++) { c.vel[i * 3 + 1] -= 14 * dt; c.pos[i * 3] += c.vel[i * 3] * dt; c.pos[i * 3 + 1] += c.vel[i * 3 + 1] * dt; c.pos[i * 3 + 2] += c.vel[i * 3 + 2] * dt; if (c.pos[i * 3 + 1] < 0.1) { c.pos[i * 3 + 1] = 0.1; c.vel[i * 3 + 1] *= -0.3; } }
        m.confPts.geometry.attributes.position.needsUpdate = true;
      }
      m.confPts.material.opacity = Math.max(0, Math.min(1, c.vida * 1.4));
      /* câmera do jogador: atrás e acima da lâmpada; aproxima no corta */
      const perto = corta ? 1 : 0;
      const cx = Math.sin(t * 0.5) * 0.4, cy = 3.4 - perto * 0.6, cz = z + 7.5 - perto * 1.6 - corre * 0.6;
      cam.position.x += (cx - cam.position.x) * Math.min(1, dt * 3);
      cam.position.y += (cy - cam.position.y) * Math.min(1, dt * 3);
      cam.position.z += (cz - cam.position.z) * Math.min(1, dt * 4);
      if (S && S.tremor > 0) { cam.position.x += (Math.random() - 0.5) * 0.5 * S.tremor; cam.position.y += (Math.random() - 0.5) * 0.3 * S.tremor; S.tremor = Math.max(0, S.tremor - dt * 2.5); }
      cam.fov += ((55 + corre * 6 + (turbo ? 8 : 0)) - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix();
      cam.lookAt(0, 1.4, z - 9);
    }

    /* --------------------------------------------------------- partida */
    async function jogar() {
      som.acordar();
      menu.classList.add('saindo');
      try { if (!renderer) await prepararMundo(); }
      catch (e) {
        /* sem 3D: volta o jogo 2D */
        raiz.remove(); if (B7.JogoManut) B7.JogoManut.montar(caixa); return;
      }
      menu.hidden = true; menu.classList.remove('saindo');
      raiz.classList.add('j3-jogando');
      novaPartida(); segurando = false;
      try { tela.focus({ preventScroll: true }); } catch (e) {}
    }
    function acabou() {
      S.rodando = false; raiz.classList.remove('j3-jogando'); som.fim();
      const pts = S.pontos, rec = L.get('b7_jogo3d_recorde', 0), novo = pts > rec;
      if (novo) { L.set('b7_jogo3d_recorde', pts); setTimeout(() => { confete(0, 2, mundo.lamp.position.z - 2); som.cena(); }, 600); }
      if (B7.DB && B7.DB.rpc && pts > 0) B7.DB.rpc('jogo_registrar', { p_pontos: pts }).catch(() => {}).then(ranking);
      setTimeout(() => {
        if (fim) return;
        pintarMenu();
        menu.querySelector('.j3-sub').innerHTML =
          (novo ? '<b class="j3-novo">🏅 NOVO RECORDE!</b><br>' : '') +
          '<b class="j3-final">' + esc(pts.toLocaleString('pt-BR')) + ' pts</b><br>' +
          esc(S.cenas) + (S.cenas === 1 ? ' cena' : ' cenas') + ' · ' + esc(S.ideias) + ' ideias · combo máx. ×' + esc(S.maxCombo);
        menu.querySelector('.j3-jogar').textContent = '↻ Jogar de novo';
        menu.hidden = false;
      }, 1400);
    }

    /* ---------------------------------------------------------- controles */
    const segura = e => { if (!S || !S.rodando) return; if (e && e.cancelable) e.preventDefault(); segurando = true; };
    const solta = () => { segurando = false; };
    palco.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; segura(e); });
    addEventListener('pointerup', solta); addEventListener('pointercancel', solta); addEventListener('blur', solta);
    palco.addEventListener('contextmenu', e => e.preventDefault());
    const tecla = e => {
      if (!raiz.isConnected || !['Space', 'ArrowUp', 'ArrowRight', 'KeyW'].includes(e.code)) return;
      e.preventDefault();
      if (e.type === 'keydown') { if (!S || !S.rodando) { if (!menu.hidden && !e.repeat) jogar(); return; } segurando = true; }
      else segurando = false;
    };
    addEventListener('keydown', tecla); addEventListener('keyup', tecla);
    $('.j3-jogar').onclick = jogar;
    /* setas ← → desviam para pegar ideias (opcional, só no teclado) */
    const desvio = e => {
      if (!S || !S.rodando) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') mundo.lamp.position.x = Math.max(-1.4, mundo.lamp.position.x - 0.7);
      if (e.code === 'KeyD') mundo.lamp.position.x = Math.min(1.4, mundo.lamp.position.x + 0.7);
    };
    addEventListener('keydown', desvio);
    /* no toque: arrastar para os lados também desvia */
    let x0 = null;
    palco.addEventListener('pointermove', e => {
      if (!S || !S.rodando || !segurando) { x0 = null; return; }
      if (x0 == null) { x0 = e.clientX; return; }
      const d = (e.clientX - x0) / Math.max(120, W * 0.35);
      mundo.lamp.position.x = Math.max(-1.4, Math.min(1.4, mundo.lamp.position.x + d * 1.4)); x0 = e.clientX;
    });

    quadro = requestAnimationFrame(passo);
    /* o set já aparece montado no fundo do menu (fica mais bonito que um quadro vazio) */
    if (temWebGL()) prepararMundo().then(() => { if (!S) { cam.position.set(4, 4.5, 8); } }).catch(() => {});

    function parar() {
      if (fim) return; fim = true; cancelAnimationFrame(quadro);
      removeEventListener('resize', aoRedim); removeEventListener('pointerup', solta); removeEventListener('pointercancel', solta); removeEventListener('blur', solta);
      removeEventListener('keydown', tecla); removeEventListener('keyup', tecla); removeEventListener('keydown', desvio);
      try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch (e) {}
    }
    return { parar };
  }

  /* escolhe o 3D quando dá; sem WebGL, o 2D de antes */
  function montarMelhor(caixa) {
    if (temWebGL() && B7.vendor) return montar(caixa);
    return B7.JogoManut && B7.JogoManut.montar(caixa);
  }

  return { montar, montarMelhor };
})();
