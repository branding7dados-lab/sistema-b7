/* =====================================================================
   JOGO DA MANUTENÇÃO — "Memória do Set" (4.11.0)
   Pedido do Kevin: ter outras opções de jogo além da corrida. Jogo da
   memória com coisas de set de filmagem, leve (só HTML, sem 3D):
     • 3 fases (12, 16 e 20 cartas), contra o relógio;
     • sequência de acertos dá bônus (combo);
     • pontos = acertos + combo + tempo que sobrou; ranking da equipe.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.JogoMemoria = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const L = { get(k, p) { try { const v = localStorage.getItem(k); return v == null ? p : JSON.parse(v); } catch (e) { return p; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const ICONES = ['🎬', '🎥', '📷', '💡', '🎤', '🎞️', '🍿', '🎧', '🎭', '📽️', '🪩', '⭐'];
  const FASES = [{ pares: 6, col: 4, tempo: 45 }, { pares: 8, col: 4, tempo: 60 }, { pares: 10, col: 5, tempo: 75 }];
  let ctx = null;
  function tom(f, d, v, q) {
    try { if (L.get('b7_jogo_mudo', false)) return; ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + (q || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {}
  }

  function montar(caixa, opcoes) {
    opcoes = opcoes || {};
    const raiz = document.createElement('div');
    raiz.className = 'jmem';
    raiz.innerHTML =
      '<div class="jmem-topo">' + (opcoes.voltar ? '<button type="button" class="jmem-volta">← Corre pro Set!</button>' : '<span></span>') +
        '<b class="jmem-tit">Memória do Set</b><span class="jmem-rec"></span></div>' +
      '<div class="jmem-hud"><span>Fase <b class="jmem-fase">1</b>/3</span><span>⏱ <b class="jmem-tempo">0</b>s</span><span>⭐ <b class="jmem-pts">0</b></span><span class="jmem-combo"></span></div>' +
      '<div class="jmem-barra"><i></i></div>' +
      '<div class="jmem-grade"></div>' +
      '<div class="jmem-tela"><b>Memória do Set</b><p>Ache os pares antes do tempo acabar. Acertos seguidos valem mais!</p><button type="button" class="b pri jmem-jogar">▶ Jogar</button></div>' +
      '<div class="jmem-rank" hidden><b>🏆 Ranking — Memória do Set</b><ol></ol></div>';
    caixa.appendChild(raiz);
    const $ = s => raiz.querySelector(s);
    let fase = 0, pts = 0, combo = 0, tempo = 0, total = 0, tmr = 0, abertas = [], travado = false, achados = 0, fim = false;
    const rec = () => L.get('b7_memoria_recorde', 0);
    const pintarRec = () => { $('.jmem-rec').textContent = rec() ? '🏅 ' + rec().toLocaleString('pt-BR') : ''; };
    pintarRec();
    if (opcoes.voltar) $('.jmem-volta').onclick = () => { parar(); raiz.remove(); opcoes.voltar(); };

    function embaralhar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function iniciarFase() {
      const F = FASES[fase];
      const icones = embaralhar(ICONES.slice()).slice(0, F.pares);
      const cartas = embaralhar(icones.concat(icones));
      const g = $('.jmem-grade'); g.style.setProperty('--col', F.col);
      g.innerHTML = cartas.map((ic, i) => '<button type="button" class="jmem-carta" data-ic="' + esc(ic) + '" data-i="' + i + '"><span class="jmem-verso">B7</span><span class="jmem-frente">' + ic + '</span></button>').join('');
      g.querySelectorAll('.jmem-carta').forEach(b => b.onclick = () => virar(b));
      abertas = []; achados = 0; tempo = F.tempo; total = F.tempo; travado = true;
      $('.jmem-fase').textContent = fase + 1; $('.jmem-tempo').textContent = tempo;
      /* espiada de 1,2 s no começo de cada fase */
      g.querySelectorAll('.jmem-carta').forEach(b => b.classList.add('aberta'));
      setTimeout(() => { if (fim) return; g.querySelectorAll('.jmem-carta').forEach(b => b.classList.remove('aberta')); travado = false; }, 1200 + fase * 300);
      clearInterval(tmr);
      tmr = setInterval(() => {
        if (fim || !raiz.isConnected) return parar();
        tempo--; $('.jmem-tempo').textContent = tempo; $('.jmem-barra i').style.width = (tempo / total * 100) + '%';
        if (tempo <= 5 && tempo > 0) tom(880, 0.06, 0.05);
        if (tempo <= 0) acabou(false);
      }, 1000);
      $('.jmem-barra i').style.width = '100%';
    }
    function virar(b) {
      if (travado || b.classList.contains('aberta')) return;
      b.classList.add('aberta'); abertas.push(b); tom(520 + abertas.length * 120, 0.08, 0.06);
      if (abertas.length < 2) return;
      const [a, c] = abertas; abertas = [];
      if (a.dataset.ic === c.dataset.ic) {
        combo++; achados++; const ganho = 50 + (combo - 1) * 25; pts += ganho;
        a.classList.add('ok'); c.classList.add('ok'); tom(784, 0.1, 0.08); tom(1046, 0.14, 0.08, 0.07);
        $('.jmem-combo').textContent = combo > 1 ? '🔥 combo ×' + combo : '';
        $('.jmem-pts').textContent = pts.toLocaleString('pt-BR');
        if (achados === FASES[fase].pares) {
          clearInterval(tmr); pts += tempo * 10; $('.jmem-pts').textContent = pts.toLocaleString('pt-BR');
          if (fase < FASES.length - 1) { fase++; mostrar('Fase ' + fase + ' completa! +' + tempo * 10 + ' de tempo', 'Próxima fase ▶', iniciarFase); }
          else acabou(true);
        }
      } else {
        combo = 0; $('.jmem-combo').textContent = ''; travado = true; tom(200, 0.18, 0.07);
        setTimeout(() => { a.classList.remove('aberta'); c.classList.remove('aberta'); travado = false; }, 650);
      }
    }
    function mostrar(txt, bt, acao) {
      const t = $('.jmem-tela'); t.innerHTML = '<b>' + esc(txt) + '</b><button type="button" class="b pri">' + esc(bt) + '</button>'; t.hidden = false;
      t.querySelector('button').onclick = () => { t.hidden = true; acao(); };
    }
    function acabou(venceu) {
      clearInterval(tmr); travado = true;
      const novo = pts > rec(); if (novo) L.set('b7_memoria_recorde', pts); pintarRec();
      if (B7.DB && B7.DB.rpc && pts > 0) B7.DB.rpc('jogo_registrar_v2', { p_pontos: pts, p_jogo: 'memoria' }).catch(() => {}).then(ranking);
      mostrar((venceu ? '🎬 É um wrap! ' : '⏱ Acabou o tempo! ') + pts.toLocaleString('pt-BR') + ' pts' + (novo ? ' · 🏅 recorde!' : ''), '↻ Jogar de novo', comecar);
    }
    function comecar() { fase = 0; pts = 0; combo = 0; $('.jmem-pts').textContent = '0'; $('.jmem-combo').textContent = ''; iniciarFase(); }
    $('.jmem-jogar').onclick = () => { $('.jmem-tela').hidden = true; comecar(); };
    async function ranking() {
      if (!(B7.DB && B7.DB.rpc)) return;
      try { const l = await B7.DB.rpc('jogo_ranking_v2', { p_jogo: 'memoria' }); if (!Array.isArray(l) || !l.length || !raiz.isConnected) return;
        $('.jmem-rank ol').innerHTML = l.map((x, i) => '<li><span>' + ['🥇', '🥈', '🥉', '4º', '5º'][i] + ' ' + esc(x.nome || 'Alguém') + '</span><b>' + esc(Number(x.pontos || 0).toLocaleString('pt-BR')) + '</b></li>').join('');
        $('.jmem-rank').hidden = false; } catch (e) {}
    }
    ranking();
    function parar() { fim = true; clearInterval(tmr); }
    return { parar };
  }
  return { montar };
})();
