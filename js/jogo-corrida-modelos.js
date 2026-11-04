/* =====================================================================
   "Corre pro Set!" — MODELOS (4.10.0)
   Pedido do Kevin: "melhora os modelos, deixa mais realista! obstáculos
   mais bem feitos". Tudo montado peça por peça (sem arquivos de modelo
   para baixar), com materiais físicos e texturas desenhadas na hora:
     • reflexo de estúdio (mapa de ambiente gerado de painéis de luz);
     • lâmpada de vidro com filamento aceso e rosca de metal;
     • treliça de alumínio (pular), treliça aérea com refletores PAR
       pendurados (rastejar), case de transporte com cantoneiras,
       cantos de bola, travas, alças e rodízios (desviar);
     • moeda com o B7 gravado, cadeira de diretor, refletor fresnel em
       tripé com saco de areia, cabos no chão;
     • o diretor, com jaqueta de botões, cinto, mãos, sola, óculos e
       boina.
   Cada peça é montada UMA vez e clonada (barato para o celular).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.CorridaModelos = (function () {
  /* ------------------------------------------------- texturas na hora */
  function tex(T, w, h, desenhar, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    desenhar(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  const ruido = (g, w, h, n, a, cor) => { g.fillStyle = cor; for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * a; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } g.globalAlpha = 1; };

  function texturas(T) {
    return {
      /* piso de estúdio: concreto encerado com placas e marcas de fita */
      piso: tex(T, 512, 512, (g, w, h) => {
        g.fillStyle = '#3a3048'; g.fillRect(0, 0, w, h);
        ruido(g, w, h, 9000, 0.25, '#ffffff'); ruido(g, w, h, 9000, 0.3, '#000000');
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,211,107,.55)'; g.lineWidth = 10; g.beginPath(); g.moveTo(60, 380); g.lineTo(160, 380); g.moveTo(110, 330); g.lineTo(110, 430); g.stroke();
      }, [6, 30]),
      /* pista: borracha escura com as 3 faixas pintadas */
      pista: tex(T, 256, 512, (g, w, h) => {
        g.fillStyle = '#2b2140'; g.fillRect(0, 0, w, h);
        ruido(g, w, h, 6000, 0.25, '#ffffff'); ruido(g, w, h, 6000, 0.35, '#000000');
        g.fillStyle = 'rgba(255,255,255,.85)';
        [w / 3, (2 * w) / 3].forEach(x => { for (let y = 0; y < h; y += 64) g.fillRect(x - 2, y, 4, 36); });
        g.fillStyle = '#ff3fa4'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
      }, [1, 40]),
      /* tolex do case (couro sintético preto texturizado) */
      tolex: tex(T, 256, 256, (g, w, h) => { g.fillStyle = '#17131f'; g.fillRect(0, 0, w, h); ruido(g, w, h, 14000, 0.22, '#ffffff'); ruido(g, w, h, 8000, 0.4, '#000000'); }, [2, 2]),
      /* lateral do case com o estêncil */
      estencil: tex(T, 512, 512, (g, w, h) => {
        g.fillStyle = '#17131f'; g.fillRect(0, 0, w, h); ruido(g, w, h, 14000, 0.22, '#ffffff');
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '900 120px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('B7', w / 2, h * 0.38);
        g.font = '800 46px Inter, sans-serif'; g.fillStyle = '#ffd200'; g.fillText('▲ FRÁGIL ▲', w / 2, h * 0.66);
        g.font = '700 30px Inter, sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('EQUIP. DE CÂMERA · SET 7', w / 2, h * 0.82);
      }),
      /* fita zebrada amarela e preta */
      zebra: tex(T, 256, 64, (g, w, h) => {
        g.fillStyle = '#ffcc00'; g.fillRect(0, 0, w, h); g.fillStyle = '#141018';
        for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
      }, [1, 1]),
      /* lona da cadeira de diretor */
      lona: tex(T, 256, 128, (g, w, h) => {
        g.fillStyle = '#1c1633'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd36b'; g.font = '900 54px Inter, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DIRETOR', w / 2, h / 2);
      }),
      /* face da moeda */
      moeda: tex(T, 256, 256, (g, w, h) => {
        const gr = g.createRadialGradient(w * .4, h * .35, 10, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#fff3c4'); gr.addColorStop(.55, '#ffcf4a'); gr.addColorStop(1, '#c98a00');
        g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,70,0,.6)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 22, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(120,70,0,.75)'; g.font = '900 110px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B7', w / 2, h / 2 + 6);
      }),
      /* brilho redondo e macio (halos e fachos) */
      halo: tex(T, 128, 128, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }),
      /* sombra de contato (escurece o chão embaixo dos objetos) */
      sombra: tex(T, 128, 128, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      })
    };
  }

  /* reflexos de estúdio: um "quarto" de painéis de luz vira mapa de ambiente */
  function ambiente(T, renderer) {
    const pm = new T.PMREMGenerator(renderer), sala = new T.Scene();
    sala.background = new T.Color(0x1a1028);
    const painel = (cor, x, y, z, w, h, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: cor, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; m.lookAt(0, 0, 0); sala.add(m); };
    painel(0xffffff, 0, 6, -8, 10, 4); painel(0xffd9f0, -9, 3, 0, 6, 6); painel(0xd9ccff, 9, 3, 2, 6, 6); painel(0xff7ac6, 0, -4, 8, 12, 3); painel(0xffffff, 0, 10, 0, 8, 8);
    const env = pm.fromScene(sala, 0.04).texture; pm.dispose();
    return env;
  }

  /* ------------------------------------------------------------ materiais */
  function materiais(T, X) {
    const S = o => new T.MeshStandardMaterial(o);
    return {
      aluminio: S({ color: 0xd8dbe2, metalness: 1, roughness: 0.28 }),
      aluminioEsc: S({ color: 0x9aa0ad, metalness: 1, roughness: 0.4 }),
      cromo: S({ color: 0xffffff, metalness: 1, roughness: 0.08 }),
      pretoFosco: S({ color: 0x15121c, roughness: 0.85 }),
      pretoMetal: S({ color: 0x1c1a22, metalness: 0.7, roughness: 0.35 }),
      borracha: S({ color: 0x0f0d12, roughness: 0.95 }),
      tolex: S({ map: X.tolex, roughness: 0.75, metalness: 0.1 }),
      estencil: S({ map: X.estencil, roughness: 0.75, metalness: 0.1 }),
      zebra: S({ map: X.zebra, roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.4 }),
      lona: S({ map: X.lona, roughness: 0.9 }),
      madeira: S({ color: 0x8a5a32, roughness: 0.6, metalness: 0.05 }),
      areia: S({ color: 0x6b5a3a, roughness: 1 }),
      lente: new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 3 }),
      moedaFace: S({ map: X.moeda, metalness: 0.85, roughness: 0.3 }),
      moedaBorda: S({ color: 0xffc53a, metalness: 1, roughness: 0.25 }),
      halo: (cor, op) => new T.SpriteMaterial({ map: X.halo, color: cor, transparent: true, opacity: op == null ? 0.8 : op, depthWrite: false, blending: T.AdditiveBlending }),
      sombra: new T.MeshBasicMaterial({ map: X.sombra, transparent: true, depthWrite: false })
    };
  }

  /* ------------------------------------------------------------ peças */
  const tubo = (T, m, r, a, b) => {                    /* cilindro de a até b */
    const va = new T.Vector3(...a), vb = new T.Vector3(...b), d = vb.clone().sub(va);
    const ms = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 10), m);
    ms.position.copy(va).add(vb).multiplyScalar(0.5);
    ms.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return ms;
  };
  function sombraChao(T, MT, w, d) { const s = new T.Mesh(new T.PlaneGeometry(w, d), MT.sombra); s.rotation.x = -Math.PI / 2; s.position.y = 0.115; return s; }

  /* treliça triangular de alumínio deitada ao longo de x */
  function trelica(T, MT, comp, lado) {
    const g = new T.Group(), r = 0.035, h = lado * 0.866;
    const cantos = [[0, 0, -lado / 2], [0, 0, lado / 2], [0, h, 0]];
    cantos.forEach(c => g.add(tubo(T, MT.aluminio, r, [-comp / 2, c[1], c[2]], [comp / 2, c[1], c[2]])));
    const passo = lado * 0.9;
    for (let x = -comp / 2, k = 0; x < comp / 2 - 0.01; x += passo, k++) {
      const x2 = Math.min(comp / 2, x + passo);
      for (let i = 0; i < 3; i++) {
        const a = cantos[i], b = cantos[(i + 1) % 3];
        g.add(tubo(T, MT.aluminioEsc, r * 0.55, k % 2 ? [x, a[1], a[2]] : [x2, a[1], a[2]], k % 2 ? [x2, b[1], b[2]] : [x, b[1], b[2]]));
      }
    }
    [-comp / 2, comp / 2].forEach(x => { const p = new T.Mesh(new T.BoxGeometry(0.06, h + 0.12, lado + 0.12), MT.pretoMetal); p.position.set(x, h / 2, 0); g.add(p); });
    return g;
  }

  function trussBaixo(T, MT) {          /* PULAR: treliça sobre dois sacos de areia, com fita zebrada */
    const g = new T.Group();
    const t = trelica(T, MT, 2.05, 0.42); t.position.y = 0.42; g.add(t);
    [-0.82, 0.82].forEach(x => {
      const saco = new T.Mesh(new T.CapsuleGeometry(0.17, 0.3, 6, 12), MT.areia); saco.rotation.x = Math.PI / 2; saco.scale.set(1.3, 1, 0.8); saco.position.set(x, 0.2, 0); saco.castShadow = true; g.add(saco);
      const alca = new T.Mesh(new T.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), MT.pretoFosco); alca.position.set(x, 0.38, 0); g.add(alca);
    });
    const fita = new T.Mesh(new T.BoxGeometry(2.08, 0.16, 0.02), MT.zebra); fita.position.set(0, 0.66, 0.24); g.add(fita);
    const fita2 = fita.clone(); fita2.position.z = -0.24; g.add(fita2);
    g.add(sombraChao(T, MT, 2.6, 1.2));
    return g;
  }

  function parLuz(T, MT, X) {           /* refletor PAR pendurado (lata + lente acesa) */
    const g = new T.Group();
    const lata = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.42, 18, 1, true), MT.pretoMetal); lata.rotation.x = Math.PI / 2 - 0.5; g.add(lata);
    const fundo = new T.Mesh(new T.CircleGeometry(0.17, 18), MT.pretoMetal); fundo.position.set(0, 0.1, -0.19); fundo.rotation.x = -0.5 + Math.PI; g.add(fundo);
    const lente = new T.Mesh(new T.CircleGeometry(0.18, 18), MT.lente); lente.position.set(0, -0.1, 0.19); lente.rotation.x = -0.5; g.add(lente);
    const garra = new T.Mesh(new T.TorusGeometry(0.22, 0.02, 6, 16, Math.PI), MT.pretoMetal); garra.rotation.z = Math.PI; garra.position.y = 0.05; g.add(garra);
    const h = new T.Sprite(MT.halo(0xfff0d0, 0.75)); h.scale.set(0.9, 0.9, 1); h.position.set(0, -0.14, 0.26); g.add(h);
    return g;
  }

  function trussAlto(T, MT, X) {        /* RASTEJAR: treliça aérea em duas torres, com PARs */
    const g = new T.Group();
    [-1.12, 1.12].forEach(x => {
      const torre = trelica(T, MT, 1.95, 0.3); torre.rotation.z = Math.PI / 2; torre.position.set(x + 0.13, 0.98, 0); g.add(torre);
      const base = new T.Mesh(new T.BoxGeometry(0.62, 0.05, 0.62), MT.pretoMetal); base.position.set(x, 0.14, 0); g.add(base);
    });
    const topo = trelica(T, MT, 2.5, 0.36); topo.position.y = 1.62; g.add(topo);
    [-0.6, 0.6].forEach(x => { const p = parLuz(T, MT, X); p.position.set(x, 1.48, 0.12); g.add(p); });
    const placa = new T.Mesh(new T.BoxGeometry(1.1, 0.24, 0.03), MT.zebra); placa.position.set(0, 2.08, 0.2); g.add(placa);
    g.add(sombraChao(T, MT, 2.8, 0.9));
    return g;
  }

  function flightCase(T, MT, w, h, d) { /* DESVIAR: case de transporte */
    const g = new T.Group();
    const corpo = new T.Mesh(new T.BoxGeometry(w, h, d), [MT.estencil, MT.estencil, MT.tolex, MT.tolex, MT.tolex, MT.tolex]);
    corpo.position.y = h / 2 + 0.12; corpo.castShadow = true; corpo.receiveShadow = true; g.add(corpo);
    const y0 = 0.12, e = 0.045;
    /* cantoneiras de alumínio nas 12 arestas */
    const xs = [-w / 2, w / 2], ys = [y0, y0 + h], zs = [-d / 2, d / 2];
    xs.forEach(x => ys.forEach(y => { const a = new T.Mesh(new T.BoxGeometry(e, e, d + e), MT.aluminio); a.position.set(x, y, 0); g.add(a); }));
    xs.forEach(x => zs.forEach(z => { const a = new T.Mesh(new T.BoxGeometry(e, h + e, e), MT.aluminio); a.position.set(x, y0 + h / 2, z); g.add(a); }));
    ys.forEach(y => zs.forEach(z => { const a = new T.Mesh(new T.BoxGeometry(w + e, e, e), MT.aluminio); a.position.set(0, y, z); g.add(a); }));
    /* faixa da tampa */
    zs.forEach(z => { const f = new T.Mesh(new T.BoxGeometry(w + e, 0.05, 0.03), MT.aluminioEsc); f.position.set(0, y0 + h * 0.78, z); g.add(f); });
    /* cantos de bola cromados */
    xs.forEach(x => ys.forEach(y => zs.forEach(z => { const b = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), MT.cromo); b.position.set(x, y, z); g.add(b); })));
    /* travas borboleta e alças */
    zs.forEach(z => [-w * 0.28, w * 0.28].forEach(x => {
      const tr = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.03), MT.cromo); tr.position.set(x, y0 + h * 0.78, z + Math.sign(z) * 0.02); g.add(tr);
    }));
    xs.forEach(x => { const al = new T.Mesh(new T.TorusGeometry(0.13, 0.025, 8, 16, Math.PI), MT.pretoMetal); al.rotation.y = Math.PI / 2; al.rotation.x = Math.PI; al.position.set(x + Math.sign(x) * 0.03, y0 + h * 0.62, 0); g.add(al); });
    /* rodízios */
    xs.forEach(x => zs.forEach(z => {
      const r = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.05, 14), MT.borracha); r.rotation.z = Math.PI / 2; r.position.set(x * 0.85, 0.06, z * 0.8); g.add(r);
    }));
    g.add(sombraChao(T, MT, w * 1.4, d * 1.3));
    return g;
  }
  function caseEmpilhado(T, MT) {       /* variação: dois cases empilhados */
    const g = new T.Group();
    const a = flightCase(T, MT, 1.95, 1.25, 2.3); g.add(a);
    const b = flightCase(T, MT, 1.6, 1.05, 1.9); b.position.set(0.08, 1.4, 0.05); b.rotation.y = 0.06; g.add(b);
    return g;
  }

  /* 4.10.1: moeda numa peça só (1 desenho em vez de 3) — as tampas levam o B7 */
  function moeda(T, MT) {
    const g = new T.Group();
    const m = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.09, 24), [MT.moedaBorda, MT.moedaFace, MT.moedaFace]); m.rotation.x = Math.PI / 2; g.add(m);
    return g;
  }

  /* ---------------------------------------------------------- cenário */
  function refletor(T, MT) {            /* fresnel em tripé com saco de areia */
    const g = new T.Group();
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.add(tubo(T, MT.aluminioEsc, 0.025, [0, 1.1, 0], [Math.cos(a) * 0.7, 0.02, Math.sin(a) * 0.7])); }
    g.add(tubo(T, MT.aluminio, 0.035, [0, 0.9, 0], [0, 3.6, 0]));
    const cab = new T.Group(); cab.position.y = 3.75; g.add(cab);
    const corpo = new T.Mesh(new T.BoxGeometry(0.62, 0.55, 0.7), MT.pretoMetal); cab.add(corpo);
    const frente = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.1, 22), MT.pretoMetal); frente.rotation.x = Math.PI / 2; frente.position.z = 0.39; cab.add(frente);
    const lente = new T.Mesh(new T.CircleGeometry(0.23, 22), MT.lente); lente.position.z = 0.445; cab.add(lente);
    [[0, 0.33, 0.45, 0.6, 0.02, 0.24, -0.6], [0, -0.33, 0.45, 0.6, 0.02, 0.24, 0.6]].forEach(p => { const ab = new T.Mesh(new T.BoxGeometry(p[3], p[4], p[5]), MT.pretoMetal); ab.position.set(p[0], p[1], p[2] + 0.1); ab.rotation.x = p[6]; cab.add(ab); });
    const h = new T.Sprite(MT.halo(0xfff2dc, 0.9)); h.scale.set(2.2, 2.2, 1); h.position.z = 0.6; cab.add(h);
    const saco = new T.Mesh(new T.CapsuleGeometry(0.14, 0.26, 6, 10), MT.areia); saco.rotation.z = Math.PI / 2; saco.position.set(0.45, 0.42, 0); g.add(saco);
    g.userData.cabeca = cab;
    return g;
  }
  function cadeiraDiretor(T, MT) {
    const g = new T.Group();
    [[-0.32, -0.25], [0.32, -0.25], [-0.32, 0.25], [0.32, 0.25]].forEach(([x, z]) => g.add(tubo(T, MT.madeira, 0.035, [x, 0, z], [-x * 0.9, 0.62, z])));
    [-0.34, 0.34].forEach(x => { g.add(tubo(T, MT.madeira, 0.035, [x, 0.62, -0.28], [x, 0.62, 0.3])); g.add(tubo(T, MT.madeira, 0.035, [x, 0.62, 0.3], [x, 1.32, 0.34])); });
    const assento = new T.Mesh(new T.BoxGeometry(0.66, 0.03, 0.5), MT.lona); assento.position.set(0, 0.64, 0); g.add(assento);
    const encosto = new T.Mesh(new T.BoxGeometry(0.7, 0.3, 0.02), MT.lona); encosto.position.set(0, 1.18, 0.34); g.add(encosto);
    return g;
  }
  function cabos(T, MT) {
    const g = new T.Group();
    const pts = []; for (let i = 0; i <= 20; i++) pts.push(new T.Vector3(Math.sin(i * 0.9) * 0.5, 0.03, i * 0.5 - 5));
    g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.035, 6), MT.borracha));
    const rolo = new T.Mesh(new T.TorusGeometry(0.32, 0.07, 8, 24), MT.borracha); rolo.rotation.x = Math.PI / 2; rolo.position.set(0.6, 0.07, 1); g.add(rolo);
    return g;
  }

  /* ---------------------------------------------------------- lâmpada */
  function lampada(T, MT, X, leve) {
    const g = new T.Group();
    /* perfil de uma lâmpada A60, girado */
    const perfil = [];
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; perfil.push(new T.Vector2(Math.cos(a) * 0.56, 1.25 + Math.sin(a) * 0.62)); }
    perfil.unshift(new T.Vector2(0.25, 0.5), new T.Vector2(0.27, 0.62), new T.Vector2(0.38, 0.72));
    const vidroMat = leve
      ? new T.MeshStandardMaterial({ color: 0xffd6ee, emissive: 0xe2409c, emissiveIntensity: 0.55, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0, depthWrite: false })
      : new T.MeshPhysicalMaterial({ color: 0xffe6f4, emissive: 0xe2409c, emissiveIntensity: 0.45, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.42, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, depthWrite: false });
    const vidro = new T.Mesh(new T.LatheGeometry(perfil.reverse(), 40), vidroMat); vidro.castShadow = true; g.add(vidro);
    /* filamento aceso (zigue-zague) e hastes */
    const fil = []; for (let i = 0; i <= 10; i++) fil.push(new T.Vector3(-0.18 + i * 0.036, 1.22 + (i % 2 ? 0.05 : -0.05), 0));
    const filMat = new T.MeshBasicMaterial({ color: 0xffe2f1 });
    const filamento = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(fil), 40, 0.018, 6), filMat); g.add(filamento);
    [-0.18, 0.18].forEach(x => g.add(tubo(T, MT.aluminioEsc, 0.01, [x, 1.2, 0], [x * 0.3, 0.62, 0])));
    const nucleo = new T.Sprite(MT.halo(0xff7ac6, 0.95)); nucleo.scale.set(1.1, 1.1, 1); nucleo.position.y = 1.22; g.add(nucleo);
    const aura = new T.Sprite(MT.halo(0xff7ac6, 0.35)); aura.scale.set(2.6, 2.6, 1); aura.position.y = 1.15; g.add(aura);
    /* rosca de metal com sulcos */
    const rosca = [];
    for (let i = 0; i <= 40; i++) { const y = 0.12 + (i / 40) * 0.4; rosca.push(new T.Vector2(0.24 + Math.sin(i * 1.25) * 0.018, y)); }
    const baseMat = new T.MeshStandardMaterial({ color: 0xd8c27a, metalness: 1, roughness: 0.28 });
    const base = new T.Mesh(new T.LatheGeometry(rosca, 32), baseMat); base.castShadow = true; g.add(base);
    const isol = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 0.08, 20), MT.pretoFosco); isol.position.y = 0.09; g.add(isol);
    const contato = new T.Mesh(new T.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3 })); contato.rotation.x = Math.PI; contato.position.y = 0.06; g.add(contato);
    return { g, vidroMat, filMat, baseMat, nucleo, aura };
  }

  /* ----------------------------------------------------------- diretor */
  function diretor(T, MT) {
    const S = o => new T.MeshStandardMaterial(o);
    const pele = S({ color: 0xe9b48e, roughness: 0.65 }), jaq = S({ color: 0x3a2b7a, roughness: 0.6 }), jaqEsc = S({ color: 0x2a1f5c, roughness: 0.6 }),
          calca = S({ color: 0x23262f, roughness: 0.8 }), sap = S({ color: 0x3a2214, roughness: 0.45 }), sola = S({ color: 0xece4d6, roughness: 0.9 }),
          camisa = S({ color: 0xf5f0e8, roughness: 0.85 }), lenco = S({ color: 0xd9264f, roughness: 0.7 }), cabelo = S({ color: 0x2b1b12, roughness: 0.95 }),
          oculos = S({ color: 0x050505, metalness: 0.9, roughness: 0.08 }), boinaM = S({ color: 0x15111c, roughness: 0.95 }), botao = S({ color: 0xd9b25a, metalness: 1, roughness: 0.3 });
    const g = new T.Group();
    const quadril = new T.Group(); quadril.position.y = 1.0; g.add(quadril);
    const corpo = new T.Group(); quadril.add(corpo);
    /* tronco torneado (mais largo no peito) */
    const pt = [[0.0, 0], [0.3, 0.02], [0.34, 0.2], [0.36, 0.45], [0.42, 0.72], [0.4, 0.86], [0.2, 0.98], [0.0, 1.0]].map(p => new T.Vector2(p[0], p[1]));
    const tronco = new T.Mesh(new T.LatheGeometry(pt, 28), jaq); tronco.scale.z = 0.72; tronco.castShadow = true; corpo.add(tronco);
    const camisaF = new T.Mesh(new T.PlaneGeometry(0.2, 0.5), camisa); camisaF.position.set(0, 0.68, -0.29); camisaF.rotation.y = Math.PI; corpo.add(camisaF);
    [0.75, 0.6, 0.45].forEach(y => { const b = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), botao); b.position.set(-0.13, y, -0.27); corpo.add(b); });
    const cinto = new T.Mesh(new T.CylinderGeometry(0.31, 0.31, 0.07, 24), S({ color: 0x1a120c, roughness: 0.5 })); cinto.scale.z = 0.74; cinto.position.y = 0.06; corpo.add(cinto);
    const fivela = new T.Mesh(new T.BoxGeometry(0.09, 0.06, 0.02), botao); fivela.position.set(0, 0.06, -0.235); corpo.add(fivela);
    [-0.2, 0.2].forEach(x => { const bo = new T.Mesh(new T.BoxGeometry(0.15, 0.12, 0.02), jaqEsc); bo.position.set(x, 0.3, -0.25); corpo.add(bo); });
    const gola = new T.Mesh(new T.TorusGeometry(0.15, 0.06, 10, 22), lenco); gola.rotation.x = Math.PI / 2; gola.position.y = 0.96; corpo.add(gola);
    const ponta = new T.Mesh(new T.ConeGeometry(0.07, 0.2, 10), lenco); ponta.position.set(0.04, 0.84, -0.2); ponta.rotation.x = Math.PI; corpo.add(ponta);
    const pesc = new T.Mesh(new T.CylinderGeometry(0.085, 0.1, 0.14, 14), pele); pesc.position.y = 1.03; corpo.add(pesc);
    /* "DIRETOR" nas costas */
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const gx = cv.getContext('2d');
    gx.fillStyle = '#ffd36b'; gx.font = '900 46px Inter, sans-serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText('DIRETOR', 128, 34);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    const nome = new T.Mesh(new T.PlaneGeometry(0.56, 0.14), new T.MeshBasicMaterial({ map: t, transparent: true })); nome.position.set(0, 0.68, 0.302); corpo.add(nome);
    /* cabeça */
    const cab = new T.Group(); cab.position.y = 1.3; corpo.add(cab);
    const cabeca = new T.Mesh(new T.SphereGeometry(0.26, 28, 22), pele); cabeca.scale.set(0.95, 1.1, 1); cab.add(cabeca);
    const queixo = new T.Mesh(new T.SphereGeometry(0.17, 18, 14), pele); queixo.position.set(0, -0.15, -0.06); cab.add(queixo);
    [-1, 1].forEach(l => { const o = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), pele); o.scale.set(0.5, 1, 0.8); o.position.set(l * 0.25, 0, 0.02); cab.add(o); });
    const nariz = new T.Mesh(new T.ConeGeometry(0.045, 0.12, 10), pele); nariz.rotation.x = -Math.PI / 2; nariz.position.set(0, -0.02, -0.28); cab.add(nariz);
    const bigode = new T.Mesh(new T.TorusGeometry(0.07, 0.025, 8, 14, Math.PI), cabelo); bigode.rotation.z = Math.PI; bigode.position.set(0, -0.1, -0.24); cab.add(bigode);
    const cab2 = new T.Mesh(new T.SphereGeometry(0.265, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), cabelo); cab2.rotation.x = 0.55; cab2.position.set(0, 0.02, 0.04); cab.add(cab2);
    [-0.1, 0.1].forEach(x => { const l = new T.Mesh(new T.SphereGeometry(0.075, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), oculos); l.rotation.x = -Math.PI / 2; l.scale.z = 0.35; l.position.set(x, 0.04, -0.245); cab.add(l); });
    cab.add(tubo(T, oculos, 0.008, [-0.03, 0.05, -0.27], [0.03, 0.05, -0.27]));
    [-1, 1].forEach(l => cab.add(tubo(T, oculos, 0.008, [l * 0.17, 0.05, -0.23], [l * 0.25, 0.05, 0.02])));
    const boina = new T.Mesh(new T.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), boinaM); boina.scale.set(1.15, 0.5, 1.15); boina.position.set(0.05, 0.17, 0.02); boina.rotation.z = -0.22; cab.add(boina);
    const aro = new T.Mesh(new T.TorusGeometry(0.255, 0.02, 8, 26), boinaM); aro.rotation.x = Math.PI / 2; aro.position.y = 0.17; cab.add(aro);
    const pino = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.06, 6), boinaM); pino.position.set(0.02, 0.33, 0.02); cab.add(pino);
    /* braços (ombro → cotovelo → mão) */
    const bracos = [], cotovelos = [];
    [-1, 1].forEach(lado => {
      const ombro = new T.Group(); ombro.position.set(lado * 0.4, 0.84, 0); corpo.add(ombro);
      const om = new T.Mesh(new T.SphereGeometry(0.11, 14, 10), jaq); ombro.add(om);
      const sup = new T.Mesh(new T.CapsuleGeometry(0.095, 0.24, 6, 12), jaq); sup.position.y = -0.18; ombro.add(sup);
      const cot = new T.Group(); cot.position.y = -0.36; ombro.add(cot);
      const ant = new T.Mesh(new T.CapsuleGeometry(0.085, 0.22, 6, 12), jaq); ant.position.y = -0.15; cot.add(ant);
      const punho = new T.Mesh(new T.CylinderGeometry(0.075, 0.08, 0.04, 12), camisa); punho.position.y = -0.3; cot.add(punho);
      const mao = new T.Mesh(new T.SphereGeometry(0.075, 14, 10), pele); mao.scale.set(0.85, 1.15, 0.7); mao.position.y = -0.38; cot.add(mao);
      if (lado > 0) {
        const mega = new T.Group(); mega.position.set(0, -0.42, -0.08); mega.rotation.x = -Math.PI / 2; cot.add(mega);
        const corneta = new T.Mesh(new T.CylinderGeometry(0.17, 0.06, 0.42, 22, 1, true), S({ color: 0xf2f2f2, roughness: 0.4, side: T.DoubleSide })); corneta.position.y = 0.26; mega.add(corneta);
        const aroM = new T.Mesh(new T.TorusGeometry(0.17, 0.02, 8, 22), S({ color: 0xd9264f, roughness: 0.5 })); aroM.rotation.x = Math.PI / 2; aroM.position.y = 0.47; mega.add(aroM);
        const cabo = new T.Mesh(new T.BoxGeometry(0.05, 0.14, 0.06), S({ color: 0x15111c })); cabo.position.set(0, 0.06, 0.06); mega.add(cabo);
      }
      bracos.push(ombro); cotovelos.push(cot);
    });
    /* pernas (quadril → joelho → pé) */
    const pernas = [], joelhos = [];
    [-0.15, 0.15].forEach(x => {
      const coxa = new T.Group(); coxa.position.set(x, 0, 0); quadril.add(coxa);
      const c = new T.Mesh(new T.CapsuleGeometry(0.13, 0.3, 6, 12), calca); c.position.y = -0.23; coxa.add(c);
      const joelho = new T.Group(); joelho.position.y = -0.48; coxa.add(joelho);
      const can = new T.Mesh(new T.CapsuleGeometry(0.11, 0.3, 6, 12), calca); can.position.y = -0.22; joelho.add(can);
      const pe = new T.Group(); pe.position.y = -0.46; joelho.add(pe);
      const sapato = new T.Mesh(new T.CapsuleGeometry(0.085, 0.2, 6, 10), sap); sapato.rotation.x = Math.PI / 2; sapato.position.set(0, -0.01, -0.07); pe.add(sapato);
      const so = new T.Mesh(new T.BoxGeometry(0.17, 0.03, 0.34), sola); so.position.set(0, -0.085, -0.07); pe.add(so);
      pernas.push(coxa); joelhos.push(joelho);
    });
    return { g, corpo, cab, bracos, cotovelos, pernas, joelhos };
  }

  /* 4.10.1 — OTIMIZAÇÃO: junta todas as pecinhas de um modelo que usam o
     mesmo material numa malha só. Um case tinha ~50 malhas (50 desenhos
     por quadro); depois disso, uns 6. Sprites e malhas com vários
     materiais ficam como estão. */
  function fundir(T, raiz) {
    raiz.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(raiz.matrixWorld).invert();
    const porMat = new Map(), soltos = [];
    raiz.traverse(o => {
      if (o.isSprite || (o.isMesh && Array.isArray(o.material))) { soltos.push(o); return; }
      if (!o.isMesh) return;
      const gm = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      gm.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!gm.attributes.normal) gm.computeVertexNormals();
      if (!gm.attributes.uv) gm.setAttribute('uv', new T.BufferAttribute(new Float32Array(gm.attributes.position.count * 2), 2));
      const k = o.material.uuid; if (!porMat.has(k)) porMat.set(k, { m: o.material, g: [] }); porMat.get(k).g.push(gm);
    });
    const out = new T.Group();
    porMat.forEach(({ m, g }) => {
      let n = 0; g.forEach(x => { n += x.attributes.position.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let i = 0;
      g.forEach(x => { pos.set(x.attributes.position.array, i * 3); nor.set(x.attributes.normal.array, i * 3); uv.set(x.attributes.uv.array, i * 2); i += x.attributes.position.count; x.dispose(); });
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geo.computeBoundingSphere(); out.add(new T.Mesh(geo, m));
    });
    soltos.forEach(o => { const c = o.clone(); c.matrixAutoUpdate = true; o.updateMatrixWorld(true); new T.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(c.position, c.quaternion, c.scale); out.add(c); });
    return out;
  }

  return { fundir, texturas, ambiente, materiais, trussBaixo, trussAlto, flightCase, caseEmpilhado, moeda, refletor, cadeiraDiretor, cabos, lampada, diretor };
})();
