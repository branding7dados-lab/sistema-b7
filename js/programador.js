/* =====================================================================
   PROGRAMADOR (antigo "Admin supremo") — animação de entrada
   Só para quem tem o cargo (perfis.superadmin = 'supremo'), uma vez por
   sessão do navegador: um terminal digita o acesso, chovem caracteres nas
   cores da B7 e o título "</> Programador" aparece com um glitch.
   Toque/clique ou Esc pula. Não aparece em "ver como" nem em modo leve.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Programador = (function () {
  const CHAVE = 'b7-prog-visto';
  const ehProg = () => !!(B7.Auth && B7.Auth.superadmin && B7.Auth.superadmin() === 'supremo' &&
    !(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()));

  function tocar(forcar) {
    if (!forcar) { try { if (sessionStorage.getItem(CHAVE)) return; sessionStorage.setItem(CHAVE, '1'); } catch (e) {} }
    if (document.querySelector('.prog-intro')) return;
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('modo-leve');
    const u = B7.Auth.usuario && B7.Auth.usuario();
    const nome = String((u && (u.nome || u.username)) || 'dev').trim().split(/\s+/)[0].toLowerCase();
    const el = document.createElement('div');
    el.className = 'prog-intro' + (calmo ? ' calmo' : '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<canvas class="prog-chuva" aria-hidden="true"></canvas>' +
      '<div class="prog-term"><div class="prog-linhas"></div></div>' +
      '<div class="prog-titulo"><span class="prog-tag" aria-hidden="true">&lt;/&gt;</span>' +
      '<b data-t="Programador">Programador</b><small>acesso total · modo deus ligado</small></div>';
    document.body.appendChild(el);
    let fim = false, raf = 0;
    const sair = () => { if (fim) return; fim = true; cancelAnimationFrame(raf); el.classList.add('saindo'); setTimeout(() => el.remove(), 450); removeEventListener('keydown', tecla); };
    const tecla = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') sair(); };
    el.addEventListener('click', sair); addEventListener('keydown', tecla);
    if (calmo) { el.classList.add('titulo'); setTimeout(sair, 1800); return; }

    /* chuva de caracteres */
    const cv = el.querySelector('canvas'), cx = cv.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.scale(dpr, dpr);
    const fs = 15, cols = Math.ceil(W / fs), y = Array.from({ length: cols }, () => Math.random() * -40);
    const CH = '01<>/{}[];=+*B7$#&ABCDEF', CORES = ['#7B4DFF', '#B5248F', '#E2409C', '#4C6FFF'];
    let t0 = 0;
    const passo = t => {
      if (t - t0 > 45) {
        t0 = t;
        cx.fillStyle = 'rgba(8,4,20,.18)'; cx.fillRect(0, 0, W, H);
        cx.font = '600 ' + fs + 'px ui-monospace,Consolas,monospace';
        for (let i = 0; i < cols; i++) {
          cx.fillStyle = Math.random() < .06 ? '#fff' : CORES[i % 4];
          cx.fillText(CH[(Math.random() * CH.length) | 0], i * fs, y[i] * fs);
          if (y[i] * fs > H && Math.random() > .96) y[i] = 0; y[i]++;
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);

    /* terminal digitando */
    const linhas = ['$ ssh ' + nome + '@sistema-b7', '> autenticando chave… ok', '> cargo: PROGRAMADOR', '> sudo liberado ✓'];
    const caixa = el.querySelector('.prog-linhas');
    let li = 0;
    const proxima = () => {
      if (fim) return;
      if (li >= linhas.length) { setTimeout(() => { if (!fim) el.classList.add('titulo'); }, 180); setTimeout(sair, 2700); return; }
      const p = document.createElement('p'); caixa.appendChild(p);
      const tx = linhas[li++]; let k = 0;
      const dig = () => { if (fim) return; p.textContent = tx.slice(0, ++k); if (k < tx.length) setTimeout(dig, 18); else setTimeout(proxima, 120); };
      dig();
    };
    setTimeout(proxima, 250);
  }

  /* espera o login; toca uma vez quando o programador entra */
  let tentativas = 0;
  function vigiar() {
    if (ehProg() && !document.querySelector('.b7-abertura:not([hidden]), .tela-login:not([hidden])')) return setTimeout(() => tocar(), 400);
    if (++tentativas < 240) setTimeout(vigiar, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiar); else vigiar();
  return { tocar: () => tocar(true), eh: ehProg };
})();
