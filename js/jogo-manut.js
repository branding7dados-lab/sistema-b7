/* =====================================================================
   JOGO DA MANUTENÇÃO — "Ação! Corta!" (4.7.0)
   Pedido do Kevin: um joguinho na tela de manutenção, "tipo batatinha
   frita 1, 2, 3". No set de gravação: com "AÇÃO!" você segura e a
   lâmpada da B7 anda até a câmera; com "CORTA!" tem que soltar na hora.
   Mexeu no corta → perde uma vida e volta um pouco. 3 vidas.
   Cada chegada na câmera = +1 cena, e o diretor fica mais rápido e mais
   imprevisível (às vezes engana: "Aç… CORTA!").
   Controles: segurar o dedo/mouse no jogo, ou a barra de espaço / seta →.
   Pontos = cenas × 1000 + distância andada. Recorde no aparelho e
   ranking da equipe no banco (jogo_registrar / jogo_ranking).
   Desenhado em canvas, sem baixar nada; para sozinho quando a tela de
   manutenção sai (o elemento deixa de existir).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.JogoManut = (function () {
  const CHAVE_RECORDE = 'b7_jogo_recorde';
  const lerRecorde = () => { try { return +localStorage.getItem(CHAVE_RECORDE) || 0; } catch (e) { return 0; } };
  const gravarRecorde = v => { try { localStorage.setItem(CHAVE_RECORDE, String(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduzMov = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function montar(alvo) {
    const raiz = document.createElement('div');
    raiz.className = 'jm';
    raiz.innerHTML =
      '<div class="jm-topo"><b>Ação! Corta!</b><span class="jm-dica">Segure para andar no <i>AÇÃO!</i> e solte no <i>CORTA!</i></span></div>' +
      '<div class="jm-palco"><canvas class="jm-tela" aria-label="Jogo Ação! Corta!: segure para andar, solte quando o diretor gritar corta"></canvas>' +
      '<div class="jm-capa"><button type="button" class="b pri jm-jogar">Jogar</button><p class="jm-capa-tx"></p></div></div>' +
      '<div class="jm-pe"><span class="jm-recorde"></span><span class="jm-teclas">Espaço ou → também funcionam</span></div>' +
      '<div class="jm-ranking" hidden><b>Ranking da equipe</b><ol></ol></div>';
    alvo.appendChild(raiz);

    const cv = raiz.querySelector('.jm-tela'), g = cv.getContext('2d');
    const capa = raiz.querySelector('.jm-capa'), capaTx = raiz.querySelector('.jm-capa-tx'), botao = raiz.querySelector('.jm-jogar');
    const recEl = raiz.querySelector('.jm-recorde');
    const mostrarRecorde = () => { const r = lerRecorde(); recEl.textContent = r ? 'Seu recorde: ' + r.toLocaleString('pt-BR') + ' pts' : 'Ainda sem recorde'; };
    mostrarRecorde();

    const lamp = new Image(); lamp.src = 'assets/brand/symbol-color.png';
    let W = 0, H = 0, dpr = 1;
    function medir() {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(260, r.width); H = Math.max(150, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    medir();
    const aoRedim = () => medir();
    addEventListener('resize', aoRedim);

    /* ------------------------------------------------------------- estado */
    let S = null, segurando = false, quadro = 0, fim = false;
    function novoJogo() {
      S = { pos: 0, cenas: 0, vidas: 3, pontos: 0, fase: 'acao', ate: 0, falso: false,
            tremor: 0, flash: 0, msg: '', msgAte: 0, andado: 0, rodando: true, ultimo: performance.now() };
      proximaFase('acao', performance.now());
    }
    /* o diretor: o tempo de cada fase encurta a cada cena */
    function proximaFase(fase, agora) {
      const nivel = S.cenas;
      if (fase === 'acao') {
        const base = Math.max(900, 2600 - nivel * 180);
        S.fase = 'acao'; S.ate = agora + base * (0.55 + Math.random() * 0.9);
        /* às vezes engana: um "Aç…" curtinho antes do corta */
        S.falso = nivel >= 1 && Math.random() < Math.min(0.35, 0.1 + nivel * 0.05);
        if (S.falso) S.ate = agora + 260 + Math.random() * 200;
      } else {
        S.fase = 'corta'; S.ate = agora + 1100 + Math.random() * 1300;
        S.tolerancia = agora + Math.max(140, 260 - nivel * 15);   /* tempo de reação para soltar */
      }
    }
    const velocidade = () => 0.16 + S.cenas * 0.012;   /* fração da pista por segundo */

    function passo(agora) {
      if (fim) return;
      if (!raiz.isConnected) return parar();
      quadro = requestAnimationFrame(passo);
      if (!S) { desenhar(agora); return; }
      /* a manutenção acabou: o jogo pausa (o aviso "o sistema voltou" aparece por cima) */
      if (S.rodando && raiz.closest('.mn-liberada')) { S.rodando = false; segurando = false; raiz.classList.remove('jm-jogando'); S.msg = 'Pausado: o sistema voltou'; S.msgAte = Infinity; }
      const dt = Math.min(0.05, (agora - S.ultimo) / 1000); S.ultimo = agora;
      if (S.rodando) {
        if (agora >= S.ate) proximaFase(S.fase === 'acao' ? 'corta' : 'acao', agora);
        if (segurando && S.fase === 'acao') {
          const d = velocidade() * dt; S.pos += d; S.andado += d;
          if (S.pos >= 1) {
            S.pos = 0; S.cenas++; S.pontos += 1000;
            S.msg = 'Cena ' + S.cenas + ' gravada! 🎬'; S.msgAte = agora + 1300;
            proximaFase('acao', agora);
          }
        }
        if (segurando && S.fase === 'corta' && agora > S.tolerancia) {
          S.vidas--; S.flash = 1; S.tremor = reduzMov() ? 0 : 1;
          S.pos = Math.max(0, S.pos - 0.25);
          S.msg = S.vidas > 0 ? 'Mexeu no corta! −1 vida' : 'Fim de gravação!'; S.msgAte = agora + 1200;
          segurando = false;
          if (S.vidas <= 0) acabou();
          else S.tolerancia = Infinity;   /* uma penalidade por corta */
        }
        S.pontos = S.cenas * 1000 + Math.round(S.pos * 1000);
      }
      S.flash = Math.max(0, S.flash - dt * 2.2); S.tremor = Math.max(0, S.tremor - dt * 3);
      desenhar(agora);
    }

    /* -------------------------------------------------------------- desenho */
    const css = n => getComputedStyle(raiz).getPropertyValue(n).trim();
    function desenhar(agora) {
      const escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      g.save();
      if (S && S.tremor) g.translate((Math.random() - 0.5) * 8 * S.tremor, 0);
      g.clearRect(-10, -10, W + 20, H + 20);
      /* chão do set */
      const chaoY = H * 0.72;
      g.fillStyle = escuro ? 'rgba(255,255,255,.05)' : 'rgba(42,22,80,.05)';
      g.fillRect(0, chaoY, W, H - chaoY);
      /* faixa de luz no chão (o caminho) */
      const x0 = 34, x1 = W - 70;
      g.strokeStyle = escuro ? 'rgba(255,255,255,.14)' : 'rgba(42,22,80,.14)';
      g.setLineDash([6, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(x0, chaoY + 12); g.lineTo(x1, chaoY + 12); g.stroke(); g.setLineDash([]);
      /* a câmera do diretor */
      const cx = W - 46, cy = chaoY - 30;
      g.fillStyle = escuro ? '#2B1F3C' : '#3A2A55';
      arredondado(cx - 26, cy - 16, 40, 30, 7); g.fill();
      g.beginPath(); g.moveTo(cx + 14, cy - 6); g.lineTo(cx + 28, cy - 14); g.lineTo(cx + 28, cy + 14); g.lineTo(cx + 14, cy + 6); g.closePath(); g.fill();
      g.fillRect(cx - 9, cy + 14, 6, chaoY - cy - 14);
      const corta = S && S.fase === 'corta';
      g.fillStyle = corta ? '#FF4D6D' : '#3DDC97';
      g.beginPath(); g.arc(cx - 16, cy - 7, 4.5, 0, Math.PI * 2); g.fill();
      if (corta) { g.fillStyle = 'rgba(255,77,109,.25)'; g.beginPath(); g.arc(cx - 16, cy - 7, 10, 0, Math.PI * 2); g.fill(); }
      /* a lâmpada */
      const px = x0 + ((S ? S.pos : 0) * (x1 - x0 - 30)), lw = 34, lh = 44;
      const balanca = S && segurando && !corta ? Math.sin(agora / 70) * 2.5 : 0;
      if (lamp.complete && lamp.naturalWidth) g.drawImage(lamp, px, chaoY - lh + balanca * 0.4, lw, lh);
      else { g.fillStyle = '#E2409C'; g.beginPath(); g.arc(px + 16, chaoY - 24, 14, 0, Math.PI * 2); g.fill(); }
      /* placa do diretor */
      const texto = !S ? 'Pronto?' : corta ? 'CORTA!' : (S.falso ? 'Aç…' : 'AÇÃO!');
      g.font = '800 ' + Math.round(Math.min(34, W / 11)) + 'px "B7 Titulo", Inter, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = !S ? (escuro ? '#F3EEFA' : '#1C1633') : corta ? '#FF4D6D' : '#2FCB71';
      g.fillText(texto, W / 2, H * 0.24);
      /* placar */
      if (S) {
        g.font = '700 13px Inter, sans-serif'; g.textAlign = 'left'; g.fillStyle = escuro ? '#D3C8E6' : '#4A4266';
        g.fillText('🎬 ' + S.cenas + '   ' + S.pontos.toLocaleString('pt-BR') + ' pts', 12, 18);
        g.textAlign = 'right'; g.fillText('❤'.repeat(Math.max(0, S.vidas)) + '♡'.repeat(Math.max(0, 3 - S.vidas)), W - 12, 18);
        if (S.msg && agora < S.msgAte) {
          g.textAlign = 'center'; g.font = '700 14px Inter, sans-serif'; g.fillStyle = escuro ? '#FF9AD5' : '#C21C83';
          g.fillText(S.msg, W / 2, H * 0.24 + 30);
        }
      }
      if (S && S.flash) { g.fillStyle = 'rgba(255,77,109,' + (0.28 * S.flash) + ')'; g.fillRect(-10, -10, W + 20, H + 20); }
      g.restore();
    }
    function arredondado(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    /* ------------------------------------------------------------- partida */
    function comecar() {
      novoJogo(); capa.hidden = true; segurando = false; raiz.classList.add('jm-jogando');
      try { cv.focus({ preventScroll: true }); } catch (e) {}
    }
    function acabou() {
      S.rodando = false; raiz.classList.remove('jm-jogando');
      const pts = S.pontos, rec = lerRecorde(), novo = pts > rec;
      if (novo) gravarRecorde(pts);
      mostrarRecorde();
      setTimeout(() => {
        if (fim) return;
        capaTx.innerHTML = (novo ? '<b>Novo recorde!</b> ' : '') + esc(S.cenas) + (S.cenas === 1 ? ' cena' : ' cenas') + ' · ' + esc(pts.toLocaleString('pt-BR')) + ' pts';
        botao.textContent = 'Jogar de novo'; capa.hidden = false;
      }, 900);
      registrar(pts);
    }
    async function registrar(pts) {
      if (!(B7.DB && B7.DB.rpc) || pts <= 0) return carregarRanking();
      try { await B7.DB.rpc('jogo_registrar', { p_pontos: pts }); } catch (e) {}
      carregarRanking();
    }
    async function carregarRanking() {
      if (!(B7.DB && B7.DB.rpc)) return;
      try {
        const l = await B7.DB.rpc('jogo_ranking', {});
        if (fim || !Array.isArray(l) || !l.length) return;
        const box = raiz.querySelector('.jm-ranking');
        box.querySelector('ol').innerHTML = l.map(x => '<li><span>' + esc(x.nome || 'Alguém') + '</span><b>' + esc(Number(x.pontos || 0).toLocaleString('pt-BR')) + '</b></li>').join('');
        box.hidden = false;
      } catch (e) {}
    }
    carregarRanking();

    /* ------------------------------------------------------------ controles */
    const segura = e => { if (!S || !S.rodando) return; if (e) e.preventDefault(); segurando = true; };
    const solta = () => { segurando = false; };
    cv.addEventListener('pointerdown', segura); addEventListener('pointerup', solta); addEventListener('pointercancel', solta);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const tecla = e => {
      if (!raiz.isConnected) return;
      if (e.code !== 'Space' && e.code !== 'ArrowRight') return;
      e.preventDefault();
      if (e.type === 'keydown') { if (!S || !S.rodando) { if (!capa.hidden && !e.repeat) comecar(); return; } segurando = true; }
      else segurando = false;
    };
    addEventListener('keydown', tecla); addEventListener('keyup', tecla);
    addEventListener('blur', solta);
    botao.onclick = comecar;
    capaTx.textContent = 'Ande até a câmera sem se mexer no corta.';

    quadro = requestAnimationFrame(passo);

    function parar() {
      if (fim) return; fim = true;
      cancelAnimationFrame(quadro);
      removeEventListener('resize', aoRedim); removeEventListener('pointerup', solta); removeEventListener('pointercancel', solta);
      removeEventListener('keydown', tecla); removeEventListener('keyup', tecla); removeEventListener('blur', solta);
    }
    return { parar };
  }

  return { montar };
})();
