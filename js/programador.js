/* =====================================================================
   PROGRAMADOR (antigo "Admin supremo") — abertura e carregamento próprios
   zzz291. Quem tem o cargo (perfis.superadmin = 'supremo') fica marcado
   neste aparelho (localStorage b7_prog); o <head> do index.html põe a
   classe html.b7-prog antes da primeira pintura, e o conteúdo da abertura
   normal fica escondido (styles/programador.css). No lugar:
     abertura      (primeira do dia/sessão) terminal dando boot, chuva de
                   caracteres nas cores da B7 e "</> Programador" com glitch
     carregamento  (ao recarregar, html.ab-curta) "</>" pulsando, linha de
                   "compilando" e barra de progresso — rápido
   Toque/clique ou Esc pula. Movimento reduzido/modo leve: versão calma.
   Troca de conta (html.ab-sem) não mostra nada.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Programador = (function () {
  const R = document.documentElement;
  const ehProg = () => !!(B7.Auth && B7.Auth.superadmin && B7.Auth.superadmin() === 'supremo' &&
    !(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()));
  const nomeCurto = () => {
    let n = '';
    try { const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario(); n = (u && (u.nome || u.username)) || localStorage.getItem('b7_prog_nome') || ''; } catch (e) {}
    return String(n).trim().split(/\s+/)[0] || 'dev';
  };

  function chuva(cv) {
    const cx = cv.getContext('2d'); if (!cx) return () => {};
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.scale(dpr, dpr);
    const fs = 15, cols = Math.ceil(W / fs), y = Array.from({ length: cols }, () => Math.random() * -30);
    const CH = '01<>/{}[];=+*B7$#&ABCDEF', CORES = ['#7B4DFF', '#B5248F', '#E2409C', '#4C6FFF'];
    let t0 = 0, raf = 0;
    const passo = t => {
      if (t - t0 > 40) {
        t0 = t; cx.fillStyle = 'rgba(8,4,20,.2)'; cx.fillRect(0, 0, W, H);
        cx.font = '600 ' + fs + 'px ui-monospace,Consolas,monospace';
        for (let i = 0; i < cols; i++) {
          cx.fillStyle = Math.random() < .06 ? '#fff' : CORES[i % 4];
          cx.fillText(CH[(Math.random() * CH.length) | 0], i * fs, y[i] * fs);
          if (y[i] * fs > H && Math.random() > .95) y[i] = 0; y[i]++;
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }

  function montar(tipo) {
    if (document.querySelector('.prog-intro')) return;
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches || R.classList.contains('modo-leve');
    const el = document.createElement('div');
    el.className = 'prog-intro prog-modo-' + tipo + (calmo ? ' calmo' : '');
    el.setAttribute('role', 'status'); el.setAttribute('aria-label', tipo === 'carga' ? 'Carregando' : 'Bem-vindo, programador');
    if (tipo === 'carga') {
      el.innerHTML = '<div class="prog-carga"><span class="prog-tag" aria-hidden="true"><b>&lt;</b><i>/</i><b>&gt;</b></span>' +
        '<p class="prog-compila">compilando sistema-b7<span>…</span></p><div class="prog-barra"><i></i></div></div>';
    } else {
      el.innerHTML = '<canvas class="prog-chuva" aria-hidden="true"></canvas>' +
        '<div class="prog-term"><div class="prog-linhas"></div></div>' +
        '<div class="prog-titulo"><span class="prog-tag" aria-hidden="true">&lt;/&gt;</span>' +
        '<b data-t="Programador">Programador</b><small>bem-vindo de volta, ' + nomeCurto().toLowerCase().replace(/[<>&"]/g, '') + '</small></div>';
    }
    document.body.appendChild(el);
    R.classList.add('b7-prog-on');
    let fim = false, parar = () => {};
    const sair = () => {
      if (fim) return; fim = true; parar(); el.classList.add('saindo');
      removeEventListener('keydown', tecla);
      setTimeout(() => { el.remove(); R.classList.remove('b7-prog-on'); }, 450);
    };
    const tecla = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') sair(); };
    el.addEventListener('click', sair); addEventListener('keydown', tecla);

    if (tipo === 'carga') { setTimeout(sair, calmo ? 700 : 1250); return; }
    if (calmo) { el.classList.add('titulo'); setTimeout(sair, 1800); return; }
    parar = chuva(el.querySelector('canvas'));
    const linhas = ['$ ssh ' + nomeCurto().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@sistema-b7',
      '> carregando módulos… ok', '> cargo: PROGRAMADOR', '> sudo liberado ✓'];
    const caixa = el.querySelector('.prog-linhas');
    let li = 0;
    const proxima = () => {
      if (fim) return;
      if (li >= linhas.length) { setTimeout(() => { if (!fim) el.classList.add('titulo'); }, 150); setTimeout(sair, 2300); return; }
      const p = document.createElement('p'); caixa.appendChild(p);
      const tx = linhas[li++]; let k = 0;
      const dig = () => { if (fim) return; p.textContent = tx.slice(0, ++k); if (k < tx.length) setTimeout(dig, 14); else setTimeout(proxima, 90); };
      dig();
    };
    setTimeout(proxima, 200);
  }

  /* no arranque: se este aparelho já sabe que é o programador, a abertura é a dele */
  function arranque() {
    if (!R.classList.contains('b7-prog') || R.classList.contains('ab-sem')) return;
    montar(R.classList.contains('ab-curta') ? 'carga' : 'abertura');
  }
  if (document.body) arranque(); else document.addEventListener('DOMContentLoaded', arranque);

  /* depois do login: marca (ou desmarca) este aparelho. Na primeira vez
     que descobre que é o programador, toca a abertura dele já. */
  let tentativas = 0;
  function vigiar() {
    const logado = !!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario());
    if (logado && !(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro())) {
      const eh = ehProg();
      let antes = null; try { antes = localStorage.getItem('b7_prog'); } catch (e) {}
      try {
        if (eh) { localStorage.setItem('b7_prog', '1'); localStorage.setItem('b7_prog_nome', nomeCurto()); }
        else { localStorage.removeItem('b7_prog'); localStorage.removeItem('b7_prog_nome'); }
      } catch (e) {}
      R.classList.toggle('b7-prog', eh);
      if (eh && antes !== '1') setTimeout(() => montar('abertura'), 300);
      return;
    }
    if (++tentativas < 240) setTimeout(vigiar, 1000);
  }
  setTimeout(vigiar, 800);
  return { tocar: () => montar('abertura'), carga: () => montar('carga'), eh: ehProg };
})();
