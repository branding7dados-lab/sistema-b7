/* =====================================================================
   AJUDA E TUTORIAIS (zzz209) — #/ajuda e #/ajuda/<tutorial>

   Um tutorial para cada parte do sistema, dentro do próprio sistema:
   onde fica, quem usa, passo a passo, dicas e cuidados. Tem busca e,
   em qualquer tela, o botão "?" do topo abre direto o tutorial DAQUELA
   tela (e dá para voltar para ela com um clique).

   O conteúdo mora em js/ajuda-dados.js (gerado dos tutoriais; para
   mudar um texto, edite lá). Não usa banco: funciona até sem internet.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Ajuda = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const dados = () => (B7.AJUDA_DADOS || []);
  let sel = null, busca = '', voltarPara = '';

  const todos = () => dados().reduce((a, g) => a.concat(g.itens.map(i => Object.assign({ grupo: g.nome }, i))), []);
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const textoDe = i => normal([i.titulo, i.onde, i.quem, i.serve, i.antes,
    (i.passos || []).map(p => p[0] + ' ' + (p[1] || []).join(' ')).join(' '),
    (i.dicas || []).map(p => p[0]).join(' '), (i.cuidados || []).map(p => p[0]).join(' ')].join(' '));
  const estreito = () => !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
  const rotaBase = () => String(location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];

  /* tutorial da tela em que a pessoa está agora (ou null) */
  function daRota(base) {
    const b = base == null ? rotaBase() : base;
    return todos().find(i => (i.rotas || []).includes(b)) || null;
  }

  /* ---- botão "?" do topo (ao lado das conversas e do sino) ---- */
  function montar() {
    const papel = B7.Auth && B7.Auth.papel && B7.Auth.papel();
    if (!B7.Auth || !B7.Auth.usuario || !B7.Auth.usuario() || papel === 'cliente') { document.querySelectorAll('.aj-bt').forEach(b => b.remove()); return; }
    document.querySelectorAll('.topo .area-sessao').forEach(area => {
      if (area.parentNode.querySelector('.aj-bt')) return;
      const bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'ico aj-bt'; bt.setAttribute('aria-label', 'Ajuda e tutoriais'); bt.title = 'Ajuda: como usar esta tela';
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8"/><path d="M12 16.6h.01"/></svg>';
      bt.onclick = e => { e.stopPropagation(); abrirDaTela(); };
      const antes = area.parentNode.querySelector('.conv-bt') || area.parentNode.querySelector('.sino') || area;
      area.parentNode.insertBefore(bt, antes);
    });
  }
  function abrirDaTela() {
    const aqui = location.hash || '#/';
    const t = /^#\/ajuda/.test(aqui) ? null : daRota();
    if (!/^#\/ajuda/.test(aqui)) voltarPara = aqui;
    location.hash = '#/ajuda' + (t ? '/' + t.id : '');
  }

  /* ---- tela ---- */
  function abrir(id) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/ajuda');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Ajuda e tutoriais']);
    const lista = todos();
    sel = id && lista.some(i => i.id === id) ? id : (estreito() ? null : 'por-onde-comecar');
    painel().innerHTML = '<div class="conteudo entra aj-tela">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Ajuda e tutoriais</h1><p>Um passo a passo para cada parte do sistema. Use a busca ou escolha ao lado.</p></div>' +
      '<div class="cb-topo-acoes"><a class="b contorno" href="#/suporte">Falar com o suporte</a></div></div>' +
      '<div class="aj-grade" id="aj-grade"><aside class="aj-indice"><input class="campo fina" id="aj-q" type="search" placeholder="Buscar: print, entregue, WhatsApp…" aria-label="Buscar nos tutoriais" value="' + esc(busca) + '" autocomplete="off"><div id="aj-lista"></div></aside>' +
      '<article class="aj-leitura" id="aj-leitura"></article></div></div>';
    const q = painel().querySelector('#aj-q');
    q.oninput = () => { busca = q.value; pintarLista(); };
    pintar();
  }

  function pintar() {
    const g = document.getElementById('aj-grade'); if (!g) return;
    g.classList.toggle('com-sel', !!sel);
    pintarLista(); pintarLeitura();
  }

  function pintarLista() {
    const cx = document.getElementById('aj-lista'); if (!cx) return;
    const termos = normal(busca).split(/\s+/).filter(Boolean);
    let n = 0;
    const html = dados().map(g => {
      const itens = g.itens.filter(i => !termos.length || termos.every(w => textoDe(i).indexOf(w) > -1));
      n += itens.length;
      return itens.length ? '<div class="aj-g"><b>' + esc(g.nome) + '</b>' + itens.map(i => '<a href="#/ajuda/' + esc(i.id) + '" class="aj-it' + (sel === i.id ? ' on' : '') + '" data-id="' + esc(i.id) + '">' + esc(i.titulo) + '</a>').join('') + '</div>' : '';
    }).join('');
    cx.innerHTML = html || '<p class="leve aj-nada">Nenhum tutorial com essa palavra. Tente outra, ou <a href="#/suporte">peça pelo suporte</a>.</p>';
  }

  function lista() { return todos(); }

  function pintarLeitura() {
    const cx = document.getElementById('aj-leitura'); if (!cx) return;
    const todosI = lista(), i = todosI.find(x => x.id === sel);
    if (!i) { cx.innerHTML = '<div class="aj-vazio">Escolha um tutorial na lista.</div>'; return; }
    const pos = todosI.indexOf(i), ant = todosI[pos - 1], prox = todosI[pos + 1];
    const meta = (r, v) => v ? '<div><dt>' + r + '</dt><dd>' + fmt(v) + '</dd></div>' : '';
    const li = p => '<li>' + fmt(p[0]) + ((p[1] || []).length ? '<ul>' + p[1].map(f => '<li>' + fmt(f) + '</li>').join('') + '</ul>' : '') + '</li>';
    cx.innerHTML =
      '<button type="button" class="aj-volta" id="aj-volta">← Todos os tutoriais</button>' +
      (voltarPara && !/^#\/ajuda/.test(voltarPara) ? '<a class="aj-tela-voltar" href="' + esc(voltarPara) + '">← Voltar para a tela em que eu estava</a>' : '') +
      '<span class="aj-tag">' + esc(i.grupo) + '</span><h2>' + esc(i.titulo) + '</h2>' +
      '<dl class="aj-meta">' + meta('Onde fica', i.onde) + meta('Quem usa', i.quem) + meta('Serve para', i.serve) + meta('Antes de começar', i.antes) + '</dl>' +
      ((i.passos || []).length ? '<h3>Passo a passo</h3><ol class="aj-passos">' + i.passos.map(li).join('') + '</ol>' : '') +
      ((i.dicas || []).length ? '<div class="aj-caixa aj-dica"><h3>Dicas</h3><ul>' + i.dicas.map(li).join('') + '</ul></div>' : '') +
      ((i.cuidados || []).length ? '<div class="aj-caixa aj-cuidado"><h3>Cuidado</h3><ul>' + i.cuidados.map(li).join('') + '</ul></div>' : '') +
      '<div class="aj-rodape"><nav class="aj-nav">' + (ant ? '<a href="#/ajuda/' + esc(ant.id) + '">← ' + esc(ant.titulo) + '</a>' : '<span></span>') +
        (prox ? '<a href="#/ajuda/' + esc(prox.id) + '">' + esc(prox.titulo) + ' →</a>' : '<span></span>') + '</nav>' +
        '<p class="leve">Algo está diferente do que está escrito, ou faltou explicar? <a href="#/suporte">Conte pelo suporte</a>.</p></div>';
    cx.querySelector('#aj-volta').onclick = () => { location.hash = '#/ajuda'; };
    try { cx.scrollTop = 0; if (estreito()) window.scrollTo(0, 0); } catch (e) {}
  }

  return { abrir, montar, daRota };
})();
