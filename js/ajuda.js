/* =====================================================================
   AJUDA E TUTORIAIS (zzz209 · repaginada no zzz210) — #/ajuda

   Início da ajuda: busca grande, "Para você" (os tutoriais da função da
   pessoa), atalho para o tutorial da tela de onde ela veio e os assuntos
   com o progresso de leitura. A busca mostra o trecho onde a palavra
   aparece, destacado.

   Tutorial (#/ajuda/<id>): "Ir para a tela", passos que a pessoa marca
   enquanto faz ("Fazer junto"), "Marcar como lido", "Isso ajudou?" (o
   "Não" abre um chamado no Suporte já preenchido) e anterior/próximo.

   O botão "?" do topo abre o tutorial da tela atual. Lido, passos e
   "ajudou" ficam só neste aparelho (preferência local, por pessoa).
   Conteúdo: js/ajuda-dados.js (gerado dos tutoriais; edite lá).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Ajuda = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const dados = () => (B7.AJUDA_DADOS || []);
  let busca = '', voltarPara = '', idxBusca = '';

  const todos = () => dados().reduce((a, g) => a.concat(g.itens.map(i => Object.assign({ grupo: g.nome, grupoId: g.id }, i))), []);
  const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fmt = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const estreito = () => !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
  const rotaBase = h => String(h || location.hash || '#/').replace(/^#\//, '').split(/[/?]/)[0];
  const campos = i => [i.titulo, i.serve, i.onde, i.quem, i.antes].concat((i.passos || []).map(p => [p[0]].concat(p[1] || []).join(' ')),
    (i.dicas || []).map(p => p[0]), (i.cuidados || []).map(p => p[0]));
  const minutos = i => Math.max(1, Math.round(campos(i).join(' ').split(/\s+/).length / 190));

  /* ---- o que a pessoa já leu / marcou (só neste aparelho) ---- */
  const chave = () => { const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario(); return 'ajuda_' + (u ? u.id : 'anon'); };
  const est = () => { const e = (B7.pref && B7.pref.ler(chave(), null)) || {}; e.lidos = e.lidos || {}; e.passos = e.passos || {}; e.util = e.util || {}; return e; };
  const salvar = e => { if (B7.pref) B7.pref.gravar(chave(), e); };

  const ICONES = {
    intro: '<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9z"/>',
    comeco: '<circle cx="12" cy="12" r="8.5"/><path d="M15.2 8.8l-2.1 4.3-4.3 2.1 2.1-4.3z"/>',
    planejar: '<rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4"/>',
    producao: '<rect x="2.8" y="6.3" width="12.6" height="11.4" rx="3"/><path d="M15.4 10.5l5.3-3v9l-5.3-3"/>',
    comunicar: '<path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-5.2L8 19.4V16H7a2.5 2.5 0 0 1-2.5-2.5z"/>',
    admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.4H2.9a2 2 0 1 1 0-4H3a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.6 4V3.9a2 2 0 1 1 4 0V4a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1A1.6 1.6 0 0 0 19.4 15z"/>'
  };
  const ic = (k, cl) => '<svg class="' + (cl || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES[k] || ICONES.intro) + '</svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2 8.8-9.4"/></svg>';

  /* os tutoriais que mais importam para cada função */
  const PARA = {
    videomaker: ['painel', 'edicao-de-video', 'gravacoes', 'roteiros', 'calendario', 'notificacoes-sino'],
    designer: ['painel', 'design', 'linhas-editoriais', 'calendario', 'conversas', 'notificacoes-sino'],
    coordenador: ['panorama', 'linhas-editoriais', 'gravacoes', 'aprovacoes', 'status-semanal', 'whatsapp'],
    admin: ['panorama', 'clientes', 'configuracoes', 'usuarios-e-acessos', 'suporte-e-feedback', 'lixeira']
  };
  const NOME_FUNCAO = { videomaker: 'videomaker', designer: 'design', coordenador: 'coordenação', admin: 'administração' };
  function minhaFuncao() {
    const f = B7.Auth && B7.Auth.funcao && B7.Auth.funcao();
    const p = B7.Auth && B7.Auth.papel && B7.Auth.papel();
    return PARA[f] ? f : PARA[p] ? p : 'coordenador';
  }

  function daRota(base) {
    const b = base == null ? rotaBase() : base;
    return todos().find(i => (i.rotas || []).includes(b)) || null;
  }

  /* ---- botão "?" do topo ---- */
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
    if (/^#\/ajuda/.test(aqui)) { location.hash = '#/ajuda'; return; }
    voltarPara = aqui;
    const t = daRota();
    location.hash = '#/ajuda' + (t ? '/' + t.id : '');
  }

  /* ---- busca: pontua e devolve o trecho com a palavra destacada ---- */
  const VAZIAS = new Set('como que qual quais onde para pra por com sem uma um uns umas the de da do das dos em no na nos nas eu meu minha se ao aos as os ja nao sim mais esta este isso faco fazer quero'.split(' '));
  function procurar(q) {
    /* palavras soltas ("como", "de") não contam; o fim da palavra é
       cortado para "gravação" achar "gravações" e "remarcar" achar "remarcada" */
    const termos = normal(q).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !VAZIAS.has(w)).map(w => w.length > 5 ? w.slice(0, -2) : w);
    if (!termos.length) return [];
    const vezes = (t, w) => { let n = 0, k = t.indexOf(w); while (k > -1 && n < 8) { n++; k = t.indexOf(w, k + w.length); } return n; };
    return todos().map(i => {
      const cs = campos(i), txt = normal(cs.join(' '));
      if (!termos.every(w => txt.includes(w))) return null;
      let pts = 0; termos.forEach(w => { if (normal(i.titulo).includes(w)) pts += 6; if (normal(i.serve).includes(w)) pts += 2; pts += 1 + vezes(txt, w) * .5; });
      const campo = cs.slice(1).find(c => termos.some(w => normal(c).includes(w))) || i.serve || '';
      return { i, pts, trecho: trecho(campo, termos) };
    }).filter(Boolean).sort((a, b) => b.pts - a.pts);
  }
  function marcar(texto, termos) {
    const n = [...texto].map(c => normal(c)).join('');
    if (n.length !== texto.length) return esc(texto);
    const marcas = new Array(texto.length).fill(false);
    termos.forEach(w => { let k = n.indexOf(w); while (k > -1) { for (let j = k; j < k + w.length; j++) marcas[j] = true; k = n.indexOf(w, k + w.length); } });
    let out = '', dentro = false;
    [...texto].forEach((c, j) => { if (marcas[j] && !dentro) { out += '<mark>'; dentro = true; } if (!marcas[j] && dentro) { out += '</mark>'; dentro = false; } out += esc(c); });
    return out + (dentro ? '</mark>' : '');
  }
  function trecho(campo, termos) {
    const t = String(campo || '').replace(/\*\*/g, ''), n = normal(t);
    let k = -1; termos.some(w => (k = n.indexOf(w)) > -1);
    const ini = Math.max(0, k - 60), fim = Math.min(t.length, (k < 0 ? 0 : k) + 140);
    return (ini > 0 ? '…' : '') + marcar(t.slice(ini, fim), termos) + (fim < t.length ? '…' : '');
  }

  /* ================================================================ telas */
  function abrir(id) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/ajuda');
    const i = id && todos().find(x => x.id === id);
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(i ? [i.titulo, 'Ajuda'] : ['Ajuda e tutoriais']);
    if (i) return tutorial(i);
    inicio();
  }

  /* ---------------- início ---------------- */
  function inicio() {
    const e = est(), lista = todos(), f = minhaFuncao();
    const daTela = voltarPara ? daRota(rotaBase(voltarPara)) : null;
    const lidos = lista.filter(i => e.lidos[i.id]).length;
    const cartao = i => '<a class="aj-card" href="#/ajuda/' + esc(i.id) + '">' +
      '<span class="aj-card-g">' + ic(i.grupoId, 'aj-ic') + esc(i.grupo) + '</span>' +
      '<b>' + esc(i.titulo) + '</b><small>' + esc(String(i.serve || '').replace(/\*\*/g, '').slice(0, 110)) + (String(i.serve || '').length > 110 ? '…' : '') + '</small>' +
      '<span class="aj-card-pe">' + (e.lidos[i.id] ? '<em class="aj-lido">' + CHECK + 'Lido</em>' : '<em>' + minutos(i) + ' min de leitura</em>') + '</span></a>';
    const para = (PARA[f] || []).map(id => lista.find(i => i.id === id)).filter(Boolean);
    const grupos = dados().filter(g => g.id !== 'intro').map(g => {
      const n = g.itens.length, l = g.itens.filter(i => e.lidos[i.id]).length;
      return '<section class="aj-assunto"><div class="aj-assunto-cab">' + ic(g.id, 'aj-ic-g') + '<div><h3>' + esc(g.nome) + '</h3><small>' + n + ' tutoriais · ' + l + ' lido' + (l === 1 ? '' : 's') + '</small></div></div>' +
        '<div class="aj-barra" aria-hidden="true"><i style="--p:' + Math.round(l / n * 100) + '%"></i></div>' +
        '<ul>' + g.itens.map(i => '<li><a href="#/ajuda/' + esc(i.id) + '"' + (e.lidos[i.id] ? ' class="lido"' : '') + '>' + (e.lidos[i.id] ? CHECK : '<i></i>') + esc(i.titulo) + '</a></li>').join('') + '</ul></section>';
    }).join('');
    const SUGS = ['print', 'entregue', 'gravação fixa', 'referência', 'WhatsApp', 'senha'];
    painel().innerHTML = '<div class="conteudo entra aj-tela aj-home">' +
      '<header class="aj-hero"><span class="aj-hero-tag">' + ic('intro') + 'Ajuda do Sistema B7</span>' +
        '<h1>Como podemos ajudar?</h1><p>Um passo a passo para cada parte do sistema, com os nomes dos botões do jeito que aparecem na tela.</p>' +
        '<label class="aj-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="M20 20l-4.2-4.2"/></svg>' +
          '<input id="aj-q" type="search" placeholder="O que você quer fazer? Ex.: entregar várias demandas" aria-label="Buscar nos tutoriais" value="' + esc(busca) + '" autocomplete="off"></label>' +
        '<div class="aj-sugs">Procure por: ' + SUGS.map(s => '<button type="button" data-sug="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>' +
        '<div class="aj-hero-prog"><div class="aj-barra" aria-hidden="true"><i style="--p:' + Math.round(lidos / lista.length * 100) + '%"></i></div><small>Você já leu <b>' + lidos + '</b> de ' + lista.length + ' tutoriais</small></div>' +
      '</header>' +
      '<div id="aj-res"></div>' +
      '<div id="aj-blocos">' +
        (daTela ? '<a class="aj-aqui" href="#/ajuda/' + esc(daTela.id) + '">' + ic(daTela.grupoId, 'aj-ic-g') + '<div><small>Você estava em</small><b>' + esc(daTela.titulo) + '</b></div><span>Ver o tutorial desta tela →</span></a>' : '') +
        (!e.lidos['por-onde-comecar'] ? '<a class="aj-aqui aj-comece" href="#/ajuda/por-onde-comecar">' + ic('intro', 'aj-ic-g') + '<div><small>Primeira vez aqui?</small><b>Por onde começar</b></div><span>Ler em 1 minuto →</span></a>' : '') +
        (para.length ? '<h2 class="aj-sec">Para você <small>· ' + esc(NOME_FUNCAO[f] || '') + '</small></h2><div class="aj-cards">' + para.map(cartao).join('') + '</div>' : '') +
        '<h2 class="aj-sec">Por assunto</h2><div class="aj-assuntos">' + grupos + '</div>' +
        '<div class="aj-fim"><div><b>Não achou o que precisava?</b><p>Conte para a equipe pelo Suporte: a gente responde e melhora o tutorial.</p></div>' +
          '<div class="aj-fim-ac"><a class="b contorno" href="#/suporte">Meus chamados</a><button type="button" class="b pri" id="aj-chamado">Abrir um chamado</button></div></div>' +
      '</div></div>';
    const q = painel().querySelector('#aj-q');
    q.oninput = () => { busca = q.value; resultados(); };
    painel().querySelectorAll('[data-sug]').forEach(b => b.onclick = () => { q.value = busca = b.dataset.sug; resultados(); q.focus(); });
    painel().querySelector('#aj-chamado').onclick = () => B7.Suporte && B7.Suporte.novo('duvida');
    if (busca) resultados();
    if (!estreito()) setTimeout(() => { try { q.focus({ preventScroll: true }); } catch (x) {} }, 60);
  }
  function resultados() {
    const cx = document.getElementById('aj-res'), bl = document.getElementById('aj-blocos'); if (!cx) return;
    const termos = normal(busca).split(/\s+/).filter(w => w.length > 1);
    if (!termos.length) { cx.innerHTML = ''; bl.hidden = false; return; }
    bl.hidden = true;
    const r = procurar(busca);
    cx.innerHTML = '<h2 class="aj-sec">' + (r.length ? r.length + (r.length === 1 ? ' tutorial' : ' tutoriais') + ' para “' + esc(busca.trim()) + '”' : 'Nada encontrado para “' + esc(busca.trim()) + '”') + '</h2>' +
      (r.length ? '<div class="aj-resultados">' + r.slice(0, 20).map(x => '<a class="aj-res-it" href="#/ajuda/' + esc(x.i.id) + '">' +
          ic(x.i.grupoId, 'aj-ic-g') + '<div><span class="aj-card-g">' + esc(x.i.grupo) + '</span><b>' + marcar(x.i.titulo, termos) + '</b><p>' + x.trecho + '</p></div></a>').join('') + '</div>'
        : '<div class="aj-nada"><p>Tente outra palavra (ex.: o nome do botão ou da tela). Se não existir tutorial para isso, peça pelo Suporte.</p><button type="button" class="b pri" id="aj-pedir">Pedir ajuda ao suporte</button></div>');
    const p = cx.querySelector('#aj-pedir');
    if (p) p.onclick = () => B7.Suporte && B7.Suporte.novo('duvida', { titulo: busca.trim(), descricao: 'Procurei na Ajuda por "' + busca.trim() + '" e não achei.\n\nO que eu quero fazer: ' });
  }

  /* ---------------- tutorial ---------------- */
  function tutorial(i) {
    const e = est(), lista = todos(), pos = lista.findIndex(x => x.id === i.id), ant = lista[pos - 1], prox = lista[pos + 1];
    const feitos = e.passos[i.id] || [], np = (i.passos || []).length;
    const rota = (i.rotas || [])[0];
    const podeIr = rota != null && (!B7.Perm || !B7.Perm.podeRota || B7.Perm.podeRota(rota)) && rota !== 'ajuda';
    const meta = (r, v, k) => v ? '<div class="aj-m aj-m-' + k + '"><dt>' + r + '</dt><dd>' + fmt(v) + '</dd></div>' : '';
    const li = (p, n) => '<li class="aj-passo' + (feitos.includes(n) ? ' feito' : '') + '"><button type="button" class="aj-ck" data-passo="' + n + '" aria-pressed="' + feitos.includes(n) + '" aria-label="Marcar o passo ' + (n + 1) + ' como feito">' + CHECK + '<span>' + (n + 1) + '</span></button>' +
      '<div>' + fmt(p[0]) + ((p[1] || []).length ? '<ul>' + p[1].map(x => '<li>' + fmt(x) + '</li>').join('') + '</ul>' : '') + '</div></li>';
    const bl = p => '<li>' + fmt(p[0]) + ((p[1] || []).length ? '<ul>' + p[1].map(x => '<li>' + fmt(x) + '</li>').join('') + '</ul>' : '') + '</li>';
    const indice = dados().map(g => '<div class="aj-g"><b>' + esc(g.nome) + '</b>' + g.itens.map(x => '<a href="#/ajuda/' + esc(x.id) + '" class="aj-it' + (x.id === i.id ? ' on' : '') + (e.lidos[x.id] ? ' lido' : '') + '" data-t="' + esc(normal(x.titulo)) + '">' + (e.lidos[x.id] ? CHECK : '<i></i>') + esc(x.titulo) + '</a>').join('') + '</div>').join('');
    const voltar = voltarPara && !/^#\/ajuda/.test(voltarPara) ? voltarPara : '';
    painel().innerHTML = '<div class="conteudo entra aj-tela aj-tut">' +
      '<div class="aj-grade"><aside class="aj-indice"><a class="aj-ind-home" href="#/ajuda">' + ic('intro') + 'Início da ajuda</a>' +
        '<input class="campo fina" id="aj-iq" type="search" placeholder="Filtrar tutoriais" aria-label="Filtrar tutoriais" value="' + esc(idxBusca) + '" autocomplete="off"><nav id="aj-ind">' + indice + '</nav></aside>' +
      '<article class="aj-leitura">' +
        '<nav class="aj-trilha"><a href="#/ajuda">Ajuda</a><span>›</span><span>' + esc(i.grupo) + '</span></nav>' +
        (voltar ? '<a class="aj-tela-voltar" href="' + esc(voltar) + '">← Voltar para a tela em que eu estava</a>' : '') +
        '<header class="aj-tut-cab">' + ic(i.grupoId, 'aj-ic-tut') + '<div><h1>' + esc(i.titulo) + '</h1>' +
          '<div class="aj-chips"><span>' + minutos(i) + ' min de leitura</span>' + (np ? '<span>' + np + ' passos</span>' : '') + (e.lidos[i.id] ? '<span class="ok">' + CHECK + 'Lido</span>' : '') + '</div></div></header>' +
        '<div class="aj-acoes">' + (podeIr ? '<a class="b pri" href="#/' + esc(rota) + '">Ir para a tela</a>' : '') +
          '<button type="button" class="b contorno" id="aj-lido">' + (e.lidos[i.id] ? 'Marcar como não lido' : 'Marcar como lido') + '</button></div>' +
        '<dl class="aj-meta">' + meta('Serve para', i.serve, 'serve') + meta('Onde fica', i.onde, 'onde') + meta('Quem usa', i.quem, 'quem') + meta('Antes de começar', i.antes, 'antes') + '</dl>' +
        (np ? '<section class="aj-bloco"><div class="aj-bloco-cab"><h2>Passo a passo</h2><span class="aj-prog" id="aj-prog"></span></div>' +
          '<p class="aj-dica-uso">Fazendo agora? Toque no número de cada passo quando terminar.</p>' +
          '<ol class="aj-passos">' + i.passos.map(li).join('') + '</ol></section>' : '') +
        ((i.dicas || []).length ? '<section class="aj-caixa aj-dica"><h2>Dicas</h2><ul>' + i.dicas.map(bl).join('') + '</ul></section>' : '') +
        ((i.cuidados || []).length ? '<section class="aj-caixa aj-cuidado"><h2>Cuidado</h2><ul>' + i.cuidados.map(bl).join('') + '</ul></section>' : '') +
        '<section class="aj-util" id="aj-util"></section>' +
        '<nav class="aj-nav">' + (ant ? '<a href="#/ajuda/' + esc(ant.id) + '"><small>Anterior</small><b>' + esc(ant.titulo) + '</b></a>' : '<span></span>') +
          (prox ? '<a class="prox" href="#/ajuda/' + esc(prox.id) + '"><small>Próximo</small><b>' + esc(prox.titulo) + '</b></a>' : '<span></span>') + '</nav>' +
      '</article></div></div>';
    const raiz = painel();
    const pintarProg = () => {
      const s = est(), fs = s.passos[i.id] || [], el = raiz.querySelector('#aj-prog');
      if (el) el.innerHTML = fs.length ? fs.length + ' de ' + np + ' feitos' + (fs.length ? ' · <button type="button" id="aj-zerar">recomeçar</button>' : '') : '';
      const z = raiz.querySelector('#aj-zerar'); if (z) z.onclick = () => { const s2 = est(); delete s2.passos[i.id]; salvar(s2); raiz.querySelectorAll('.aj-passo').forEach(x => x.classList.remove('feito')); pintarProg(); };
    };
    pintarProg();
    raiz.querySelectorAll('[data-passo]').forEach(b => b.onclick = () => {
      const n = +b.dataset.passo, s = est(), fs = new Set(s.passos[i.id] || []);
      if (fs.has(n)) fs.delete(n); else fs.add(n);
      s.passos[i.id] = [...fs];
      const tudo = fs.size === np;
      if (tudo && !s.lidos[i.id]) { s.lidos[i.id] = Date.now(); B7.UI.toast('Tudo feito! Tutorial marcado como lido.'); }
      salvar(s);
      b.closest('.aj-passo').classList.toggle('feito', fs.has(n)); b.setAttribute('aria-pressed', String(fs.has(n)));
      pintarProg();
    });
    raiz.querySelector('#aj-lido').onclick = () => {
      const s = est(); if (s.lidos[i.id]) delete s.lidos[i.id]; else s.lidos[i.id] = Date.now(); salvar(s); tutorial(i);
    };
    pintarUtil(i);
    const iq = raiz.querySelector('#aj-iq');
    const filtrar = () => {
      idxBusca = iq.value; const t = normal(idxBusca).trim();
      raiz.querySelectorAll('#aj-ind .aj-it').forEach(a => { a.hidden = !!t && a.dataset.t.indexOf(t) < 0; });
      raiz.querySelectorAll('#aj-ind .aj-g').forEach(g => { g.hidden = !g.querySelector('.aj-it:not([hidden])'); });
    };
    iq.oninput = filtrar; filtrar();
    const on = raiz.querySelector('#aj-ind .aj-it.on'); if (on && on.scrollIntoView && !estreito()) { try { on.scrollIntoView({ block: 'center' }); } catch (x) {} }
    try { window.scrollTo(0, 0); } catch (x) {}
  }

  function pintarUtil(i) {
    const cx = document.getElementById('aj-util'); if (!cx) return;
    const v = est().util[i.id];
    if (v === 1) { cx.innerHTML = '<p class="aj-util-ok">' + CHECK + 'Que bom que ajudou! Obrigado por avisar.</p>'; return; }
    if (v === -1) {
      cx.innerHTML = '<p><b>Poxa. Conta pra gente o que faltou?</b> A equipe responde e melhora este tutorial.</p><button type="button" class="b pri" id="aj-util-ch">Contar pelo suporte</button>';
      cx.querySelector('#aj-util-ch').onclick = () => B7.Suporte && B7.Suporte.novo('duvida', { titulo: 'Tutorial "' + i.titulo + '": ', descricao: 'Li o tutorial "' + i.titulo + '" e não resolveu.\n\nO que eu queria fazer: \n\nOnde travei: ' });
      return;
    }
    cx.innerHTML = '<p><b>Este tutorial ajudou?</b></p><div class="aj-util-bts"><button type="button" class="b contorno" data-u="1">Sim</button><button type="button" class="b contorno" data-u="-1">Não</button></div>';
    cx.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const s = est(); s.util[i.id] = +b.dataset.u; salvar(s); pintarUtil(i); });
  }

  return { abrir, montar, daRota, procurar };
})();
