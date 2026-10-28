/* =====================================================================
   RETROSPECTIVA DO MÊS (zzz280) — o mês da B7 contado em "stories",
   como a retrospectiva do Spotify: tela cheia, uma história por vez,
   números que sobem, o dia mais cheio, o cliente do mês, o pódio da
   equipe e, no fim, o mês de quem está vendo.

   B7.Retro.abrir(ano?, mes?)  → abre (sem mês: o mês atual, "até agora")
   B7.Retro.convite()          → nos 5 primeiros dias do mês, uma vez por
                                 pessoa, oferece a retrospectiva do mês
                                 que acabou (chamado no login da equipe)

   Os números vêm de retrospectiva_mes (banco). Cliente do mês e pódio só
   chegam para a coordenação e a administração; o resto, para toda a
   equipe interna. Nada é gravado, a não ser "já vi a deste mês" (B7.pref).

   Controles: tocar/clicar à direita avança, à esquerda volta, segurar
   pausa; ← → e espaço no teclado; Esc fecha.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Retro = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const DURACAO = 6500;
  const calmo = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const n = v => Number(v) || 0;
  const fmt = v => n(v).toLocaleString('pt-BR');
  const plural = (q, um, varios) => q === 1 ? um : varios;
  const ini = s => String(s || '?').trim().charAt(0).toUpperCase();
  /* pecinhas que caem (posts / confete), cada uma num lugar e num ritmo */
  const pecas = q => Array.from({ length: q }, (_, k) => '<i style="left:' + Math.round((k * 37 + 11) % 100) + '%;animation-delay:-' +
    ((k * 0.73) % 5).toFixed(2) + 's;animation-duration:' + (3.2 + (k % 5) * 0.55).toFixed(2) + 's"></i>').join('');

  function horas(h) {
    if (h === null || h === undefined) return null;
    if (h < 1) return 'menos de 1 hora';
    if (h < 24) return Math.round(h) + plural(Math.round(h), ' hora', ' horas');
    const d = Math.round(h / 24); return d + plural(d, ' dia', ' dias');
  }
  function dataLonga(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    const dt = new Date(a, m - 1, d);
    return { texto: d + ' de ' + MESES[m - 1], semana: DIAS[(dt.getDay() + 6) % 7] };
  }

  /* --------------------------------------------------------- histórias
     Cada uma: { tema, html }. Tema escolhe as cores do fundo. Números com
     data-conta="N" sobem de 0 até N quando a história aparece. */
  function historias(d) {
    const t = d.totais || {}, mes = MESES[d.mes - 1], L = [];
    const entregas = n(d.entregas);
    const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);

    L.push({ tema: 'capa', html:
      '<div class="rtv-capa"><span class="rtv-selo">Retrospectiva B7</span>' +
      '<h2 class="rtv-mega">' + esc(Mes) + '<small>' + d.ano + '</small></h2>' +
      '<p class="rtv-lead">' + (d.parcial ? 'O mês ainda não acabou, mas já dá para contar uma boa história.' : 'Um mês inteiro de trabalho. Bora relembrar?') + '</p>' +
      '<span class="rtv-dica">Toque para avançar</span></div>' });

    if (entregas) L.push({ tema: 'roxo', html:
      '<p class="rtv-pre">Em ' + esc(mes) + ', a B7 entregou</p>' +
      '<b class="rtv-num" data-conta="' + entregas + '">0</b>' +
      '<p class="rtv-pos">' + plural(entregas, 'peça', 'peças') + ' prontas</p>' +
      '<div class="rtv-par">' +
        '<span><b data-conta="' + n(t.videos) + '">0</b>' + plural(n(t.videos), 'vídeo editado', 'vídeos editados') + '</span>' +
        '<span><b data-conta="' + n(t.artes) + '">0</b>' + plural(n(t.artes), 'arte finalizada', 'artes finalizadas') + '</span></div>' +
      (n(d.entregas_mes_anterior) && entregas > n(d.entregas_mes_anterior)
        ? '<p class="rtv-sobe">↑ ' + Math.round((entregas / n(d.entregas_mes_anterior) - 1) * 100) + '% a mais que ' + esc(MESES[(d.mes + 10) % 12]) + '</p>' : '') });

    if (n(t.posts)) L.push({ tema: 'rosa', html:
      '<p class="rtv-pre">Foram ao ar</p>' +
      '<b class="rtv-num" data-conta="' + n(t.posts) + '">0</b>' +
      '<p class="rtv-pos">' + plural(n(t.posts), 'post publicado', 'posts publicados') + '</p>' +
      (n(t.clientes) ? '<p class="rtv-lead">para <b>' + fmt(t.clientes) + '</b> ' + plural(n(t.clientes), 'cliente', 'clientes') + ' diferentes</p>' : '') +
      '<div class="rtv-chuva" aria-hidden="true">' + pecas(14) + '</div>' });

    const bast = [[t.gravacoes, 'gravação', 'gravações', '🎬'], [t.roteiros, 'roteiro escrito', 'roteiros escritos', '✍️'],
      [t.legendas, 'legenda consertada pela IA', 'legendas consertadas pela IA', '💬']].filter(x => n(x[0]));
    if (bast.length) L.push({ tema: 'azul', html:
      '<p class="rtv-pre">Nos bastidores</p><h3 class="rtv-tit">O que ninguém vê, mas faz tudo acontecer</h3>' +
      '<ul class="rtv-bast">' + bast.map((x, i) => '<li style="--i:' + i + '"><span aria-hidden="true">' + x[3] + '</span><b data-conta="' + n(x[0]) + '">0</b>' +
        esc(plural(n(x[0]), x[1], x[2])) + '</li>').join('') + '</ul>' });

    if (d.pico && n(d.pico.entregas) > 1) {
      const p = dataLonga(d.pico.dia), sem = (d.semana || []).map(n), max = Math.max(1, ...sem), top = sem.indexOf(Math.max(...sem));
      L.push({ tema: 'laranja', html:
        '<p class="rtv-pre">O dia mais corrido foi</p>' +
        '<h3 class="rtv-dia">' + esc(p.texto) + '<small>' + esc(/sábado|domingo/.test(p.semana) ? 'um ' + p.semana : 'uma ' + p.semana + '-feira') + '</small></h3>' +
        '<p class="rtv-lead"><b data-conta="' + n(d.pico.entregas) + '">0</b> entregas num dia só. Ufa.</p>' +
        (sem.some(Boolean) ? '<div class="rtv-barras" role="img" aria-label="Entregas por dia da semana">' + sem.map((v, i) =>
          '<span class="' + (i === top ? 'on' : '') + '" style="--h:' + Math.max(4, Math.round(v * 100 / max)) + '%;--i:' + i + '"><i></i><small>' + DIAS[i].slice(0, 3) + '</small></span>').join('') + '</div>' +
          '<p class="rtv-nota">' + esc(DIAS[top].charAt(0).toUpperCase() + DIAS[top].slice(1)) + ' é o dia da B7.</p>' : '') });
    }

    if (n(t.aprovadas)) {
      const r = horas(t.resposta_horas);
      L.push({ tema: 'verde', html:
        '<p class="rtv-pre">Os clientes disseram “aprovado”</p>' +
        '<b class="rtv-num" data-conta="' + n(t.aprovadas) + '">0</b>' +
        '<p class="rtv-pos">' + plural(n(t.aprovadas), 'vez', 'vezes') + '</p>' +
        (r ? '<p class="rtv-lead">e responderam, em média, em <b>' + esc(r) + '</b></p>' : '') +
        '<div class="rtv-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>' });
    }

    const c = d.cliente_do_mes;
    if (c && n(c.total)) L.push({ tema: 'ouro', html:
      '<p class="rtv-pre">Cliente do mês</p>' +
      '<div class="rtv-logo">' + (c.logo ? '<img src="' + esc(c.logo) + '" alt="">' : '<i>' + esc(ini(c.nome)) + '</i>') + '</div>' +
      '<h3 class="rtv-tit">' + esc(c.nome) + '</h3>' +
      '<p class="rtv-lead"><b data-conta="' + n(c.total) + '">0</b> entregas para o cliente em ' + esc(mes) + '</p>' +
      '<div class="rtv-par">' + [[c.videos, 'vídeo', 'vídeos'], [c.artes, 'arte', 'artes'], [c.posts, 'post', 'posts']].filter(x => n(x[0]))
        .map(x => '<span><b>' + fmt(x[0]) + '</b>' + plural(n(x[0]), x[1], x[2]) + '</span>').join('') + '</div>' });

    const pd = d.podio || [];
    if (pd.length) {
      const ordem = pd.length === 3 ? [1, 0, 2] : pd.length === 2 ? [1, 0] : [0];
      L.push({ tema: 'noite', html:
        '<p class="rtv-pre">Quem mais entregou</p><h3 class="rtv-tit">O pódio de ' + esc(mes) + '</h3>' +
        '<div class="rtv-podio">' + ordem.map(i => { const p = pd[i]; return '<div class="rtv-deg rtv-deg' + (i + 1) + '" style="--i:' + i + '">' +
          '<span class="rtv-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '<i>' + esc(ini(p.nome)) + '</i>') + '</span>' +
          '<b>' + esc(String(p.nome || '').split(' ')[0]) + '</b><small>' + fmt(p.entregas) + ' ' + plural(n(p.entregas), 'entrega', 'entregas') + '</small>' +
          '<em>' + (i + 1) + 'º</em></div>'; }).join('') + '</div>' });
    }

    const v = d.voce || {}, meu = n(v.artes) + n(v.videos);
    if (meu || n(v.gravacoes) || n(v.legendas)) {
      const itens = [[v.videos, 'vídeo entregue', 'vídeos entregues'], [v.artes, 'arte entregue', 'artes entregues'],
        [v.gravacoes, 'gravação', 'gravações'], [v.legendas, 'legenda consertada', 'legendas consertadas']].filter(x => n(x[0]));
      const pr = n(v.com_prazo) ? Math.round(n(v.no_prazo) * 100 / n(v.com_prazo)) : null;
      L.push({ tema: 'voce', html:
        '<p class="rtv-pre">E você' + (v.nome ? ', ' + esc(v.nome) : '') + '?</p><h3 class="rtv-tit">O seu ' + esc(mes) + '</h3>' +
        '<ul class="rtv-meu">' + itens.map((x, i) => '<li style="--i:' + i + '"><b data-conta="' + n(x[0]) + '">0</b>' + esc(plural(n(x[0]), x[1], x[2])) + '</li>').join('') + '</ul>' +
        (pr !== null ? '<div class="rtv-anel" style="--p:' + pr + '"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" pathLength="100"/></svg>' +
          '<span><b>' + pr + '%</b>no prazo</span></div>' : '') });
    }

    L.push({ tema: 'fim', html:
      '<div class="rtv-capa"><span class="rtv-selo">Retrospectiva B7</span>' +
      '<h2 class="rtv-mega rtv-mega-s">' + (d.parcial ? 'E ainda tem mais ' + esc(mes) + ' pela frente.' : 'Obrigado por ' + esc(mes) + '.') + '</h2>' +
      '<p class="rtv-lead">' + (d.parcial ? 'Volte no fim do mês para ver a história completa.' : 'Que ' + esc(MESES[d.mes % 12]) + ' venha ainda maior. 🚀') + '</p>' +
      '<div class="rtv-fim-acoes"><button type="button" class="rtv-bt" data-rt-denovo>Ver de novo</button>' +
      '<button type="button" class="rtv-bt rtv-bt-pri" data-rt-fechar>Fechar</button></div>' +
      '<button type="button" class="rtv-outro" data-rt-anterior>Ver ' + esc(MESES[(d.mes + 10) % 12]) + ' →</button></div>' +
      '<div class="rtv-confete" aria-hidden="true">' + pecas(28) + '</div>' });
    return L;
  }

  /* ----------------------------------------------------------- player */
  let aberto = null;
  function contar(el) {
    el.querySelectorAll('[data-conta]').forEach(b => {
      const alvo = n(b.dataset.conta);
      if (calmo() || alvo < 4) { b.textContent = fmt(alvo); return; }
      const t0 = performance.now(), dur = Math.min(1400, 500 + alvo * 6);
      const passo = agora => {
        if (!b.isConnected) return;
        const k = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        b.textContent = fmt(Math.round(alvo * e));
        if (k < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  function montar(d) {
    const L = historias(d);
    const raiz = document.createElement('div');
    raiz.className = 'rtv'; raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true');
    raiz.setAttribute('aria-label', 'Retrospectiva de ' + MESES[d.mes - 1] + ' de ' + d.ano);
    raiz.innerHTML = '<div class="rtv-palco">' +
      '<div class="rtv-fundo" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="rtv-barra">' + L.map(() => '<span><i></i></span>').join('') + '</div>' +
      '<button type="button" class="rtv-x" data-rt-fechar aria-label="Fechar (Esc)">✕</button>' +
      '<button type="button" class="rtv-pausa" data-rt-pausa aria-label="Pausar">❚❚</button>' +
      '<div class="rtv-hist" aria-live="polite"></div>' +
      '<button type="button" class="rtv-nav rtv-ant" data-rt-ant aria-label="Anterior"></button>' +
      '<button type="button" class="rtv-nav rtv-prox" data-rt-prox aria-label="Próxima"></button></div>';
    document.body.appendChild(raiz);
    document.documentElement.classList.add('rtv-aberto');
    const hist = raiz.querySelector('.rtv-hist'), palco = raiz.querySelector('.rtv-palco');
    const barras = [...raiz.querySelectorAll('.rtv-barra span')];
    const btPausa = raiz.querySelector('[data-rt-pausa]');
    let i = -1, t = 0, inicio = 0, resta = DURACAO, pausado = false;

    const marcar = () => barras.forEach((b, k) => {
      b.classList.toggle('feita', k < i); b.classList.toggle('agora', k === i);
      const f = b.firstChild; f.style.transition = 'none'; f.style.transform = 'scaleX(' + (k < i ? 1 : 0) + ')';
    });
    function correr() {
      clearTimeout(t);
      if (i >= L.length - 1) return;               /* a última fica parada */
      const f = barras[i].firstChild;
      void f.offsetWidth;
      f.style.transition = 'transform ' + resta + 'ms linear'; f.style.transform = 'scaleX(1)';
      inicio = Date.now(); t = setTimeout(() => ir(i + 1), resta);
    }
    function pausar(sim) {
      if (sim === pausado) return; pausado = sim;
      palco.classList.toggle('pausado', sim);
      btPausa.textContent = sim ? '▶' : '❚❚'; btPausa.setAttribute('aria-label', sim ? 'Continuar' : 'Pausar');
      if (sim) {
        clearTimeout(t); resta = Math.max(300, resta - (Date.now() - inicio));
        const f = barras[i].firstChild, k = 1 - resta / DURACAO;
        f.style.transition = 'none'; f.style.transform = 'scaleX(' + k + ')';
      } else correr();
    }
    function ir(k) {
      if (k < 0) k = 0;
      if (k >= L.length) return fechar();
      i = k; resta = DURACAO;
      const h = L[i];
      palco.dataset.tema = h.tema;
      hist.innerHTML = '<div class="rtv-cena">' + h.html + '</div>';
      marcar(); contar(hist);
      ligarBotoes();
      if (!pausado) correr();
    }
    function ligarBotoes() {
      const den = hist.querySelector('[data-rt-denovo]'); if (den) den.onclick = e => { e.stopPropagation(); ir(0); };
      const ant = hist.querySelector('[data-rt-anterior]');
      if (ant) ant.onclick = e => { e.stopPropagation(); const m = d.mes === 1 ? 12 : d.mes - 1, a = d.mes === 1 ? d.ano - 1 : d.ano; fechar(false, () => abrir(a, m)); };
      hist.querySelectorAll('[data-rt-fechar]').forEach(b => b.onclick = e => { e.stopPropagation(); fechar(); });
    }
    /* "voltar" do Android (e do navegador) fecha a retrospectiva em vez de
       trocar a tela por trás dela: abrimos com uma entrada no histórico e,
       ao fechar por outro caminho, tiramos essa entrada (mesmo jeito do Meu dia) */
    let fechado = false, empurrou = false;
    function fechar(semHistorico, depois) {
      if (fechado) return; fechado = true;
      clearTimeout(t);
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('popstate', aoVoltar);
      raiz.classList.add('saindo');
      document.documentElement.classList.remove('rtv-aberto');
      setTimeout(() => raiz.remove(), 260);
      if (aberto === api) aberto = null;
      const seguir = () => { if (depois) { try { depois(); } catch (e) {} } };
      if (empurrou && semHistorico !== true) {
        const uma = () => { window.removeEventListener('popstate', uma); seguir(); };
        window.addEventListener('popstate', uma);
        try { history.back(); } catch (e) { uma(); }
        setTimeout(() => { window.removeEventListener('popstate', uma); }, 1500);
      } else seguir();
    }
    function aoVoltar() { fechar(true); }
    function tecla(e) {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); }
      else if (e.key === ' ' && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); pausar(!pausado); }
    }
    document.addEventListener('keydown', tecla, true);
    raiz.querySelector('.rtv-x').onclick = fechar;
    btPausa.onclick = () => pausar(!pausado);

    /* segurar pausa; toque curto navega */
    let apertou = 0, segurando = false, timerSeg = 0;
    const lado = (e, sinal) => {
      if (segurando) { segurando = false; pausar(false); return; }
      ir(i + sinal);
    };
    raiz.querySelectorAll('.rtv-nav').forEach(b => {
      b.addEventListener('pointerdown', () => { apertou = Date.now(); timerSeg = setTimeout(() => { segurando = true; pausar(true); }, 260); });
      b.addEventListener('pointerup', e => { clearTimeout(timerSeg); lado(e, b.hasAttribute('data-rt-prox') ? 1 : -1); });
      b.addEventListener('pointerleave', () => { clearTimeout(timerSeg); if (segurando) { segurando = false; pausar(false); } });
      b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ir(i + (b.hasAttribute('data-rt-prox') ? 1 : -1)); } });
    });
    /* fora da janela pausa sozinho */
    const vis = () => { if (document.hidden) pausar(true); };
    document.addEventListener('visibilitychange', vis);
    const api = { fechar };
    try { history.pushState({ b7retro: 1 }, ''); empurrou = true; } catch (e) {}
    window.addEventListener('popstate', aoVoltar);
    ir(0);
    raiz.querySelector('[data-rt-prox]').focus({ preventScroll: true });
    return api;
  }

  async function abrir(ano, mes) {
    if (aberto) aberto.fechar();
    const hoje = new Date();
    ano = ano || hoje.getFullYear(); mes = mes || hoje.getMonth() + 1;
    const carregando = document.createElement('div');
    carregando.className = 'rtv rtv-carregando';
    carregando.innerHTML = '<div class="rtv-palco" data-tema="capa"><div class="rtv-fundo" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="rtv-cena"><div class="rtv-capa"><span class="rtv-selo">Retrospectiva B7</span><p class="rtv-lead">Juntando o mês de ' + esc(MESES[mes - 1]) + '…</p></div></div></div>';
    document.body.appendChild(carregando);
    let d;
    try { d = await B7.DB.rpc('retrospectiva_mes', { p_ano: ano, p_mes: mes }); }
    catch (e) { carregando.remove(); B7.UI.toast((e && e.message) || 'Não foi possível montar a retrospectiva.', { tipo: 'erro' }); return; }
    carregando.remove();
    if (!d || (!n(d.entregas) && !n((d.totais || {}).posts) && !n((d.totais || {}).gravacoes))) {
      B7.UI.toast('Ainda não tem nada registrado em ' + MESES[mes - 1] + ' para contar.', { tipo: 'info' });
      return;
    }
    aberto = montar(d);
  }

  /* nos 5 primeiros dias do mês, uma vez: "a retrospectiva de outubro chegou" */
  function convite() {
    const hoje = new Date();
    if (hoje.getDate() > 5) return;
    const mes = hoje.getMonth() === 0 ? 12 : hoje.getMonth(), ano = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
    const chave = ano + '-' + mes;
    const vistos = (B7.pref && B7.pref.ler('retro_vistas', [])) || [];
    if (vistos.includes(chave)) return;
    if (B7.pref) B7.pref.gravar('retro_vistas', vistos.concat(chave).slice(-12));
    setTimeout(() => B7.UI.toast('✨ A retrospectiva de ' + MESES[mes - 1] + ' chegou.', {
      acao: 'Ver agora', tempo: 12000, aoClicar: () => abrir(ano, mes)
    }), 4000);
  }

  return { abrir, convite, _historias: historias };
})();
