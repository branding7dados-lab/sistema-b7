/* =====================================================================
   TRENDS (zzz164) — o mural de trends da equipe.

   Quem vê uma trend (um Reels, um TikTok, um áudio, um formato) joga aqui
   em vez de mandar no WhatsApp: link, um nome curto e, se quiser, uma nota
   de como usar. Depois, "Usar para um cliente" cria um roteiro numa
   gravação em aberto dele — já com o nome e a referência — e abre o
   editor. A trend guarda onde foi usada, para ninguém repetir sem saber.

   Tabela public.trends (migration_trends_e_modo_cliente.sql): toda a
   equipe interna lê e escreve; cliente não vê.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Trends = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const sb = () => B7.sb;
  let filtro = 'novas', busca = '', lista = [];
  /* zzz207: etiquetas, "sugerir para um cliente" e seleção em lote */
  let fEtq = '', sugerir = null, clientes = [];
  const marcadas = new Set();
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const PARADAS = new Set(['para', 'com', 'sem', 'uma', 'uns', 'umas', 'dos', 'das', 'nos', 'nas', 'que', 'por', 'mais', 'como', 'seu', 'sua', 'seus', 'suas', 'esse', 'essa', 'isso', 'este', 'esta', 'isto',
    'muito', 'muita', 'tudo', 'todo', 'toda', 'cada', 'sobre', 'entre', 'quando', 'onde', 'pode', 'voce', 'voces', 'cliente', 'clientes', 'conteudo', 'conteudos', 'video', 'videos', 'reels', 'reel',
    'trend', 'trends', 'instagram', 'tiktok', 'post', 'posts', 'feed', 'story', 'stories', 'tema', 'ideia', 'geral', 'objetivo', 'mensagem', 'marca', 'empresa',
    'antes', 'depois', 'primeiro', 'segundo', 'rapida', 'rapido', 'facil', 'melhor', 'novo', 'nova', 'dica', 'dicas', 'mostrar', 'falar', 'usar', 'fazer', 'ter']);
  const palavras = s => [...new Set(norm(s).split(/[^a-z0-9]+/).map(w => w.replace(/s$/, '')).filter(w => w.length >= 4 && !PARADAS.has(w)))];
  const etqLimpas = txt => [...new Set(String(txt || '').split(/[,;\n]/).map(x => norm(x).replace(/[^a-z0-9 \-]/g, '').trim().slice(0, 24)).filter(Boolean))].slice(0, 8);
  const todasEtq = () => { const c = new Map(); lista.forEach(t => (t.etiquetas || []).forEach(e => c.set(e, (c.get(e) || 0) + 1))); return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };

  /* o que o cliente "é": linha do mês (posicionamento, tom, pilares, títulos dos conteúdos) + nome */
  async function perfilDoCliente(c) {
    const ls = await B7.DB.listarLinhas(c.id).catch(() => []);
    const l = (ls || [])[0];
    let textos = [c.nome || '', c.observacoes || ''];
    if (l) {
      textos.push(l.nome, l.posicionamento, l.tom_voz, l.puv, l.percepcao, l.objetivo, l.objetivo_detalhe);
      try { (await B7.DB.listarPilares(l.id)).forEach(p => textos.push(p.nome)); } catch (e) {}
      try {
        const cs = ok(await sb().from('conteudos').select('titulo,tema').eq('linha_id', l.id).is('deleted_at', null).limit(80));
        cs.forEach(x => { textos.push(x.titulo); textos.push(x.tema); });
      } catch (e) {}
    }
    return { termos: new Set(palavras(textos.filter(Boolean).join(' '))), linha: !!l };
  }
  /* quanto uma trend combina com o perfil; etiqueta pesa 3, nome 2, nota 1 */
  function pontuar(t, perfil) {
    const ach = new Map();
    const olhar = (txt, peso) => palavras(txt).forEach(w => { if (perfil.termos.has(w)) ach.set(w, Math.max(ach.get(w) || 0, peso)); });
    olhar((t.etiquetas || []).join(' '), 3); olhar(t.titulo, 2); olhar(t.nota, 1);
    let pts = 0; ach.forEach(v => { pts += v; });
    /* mostra a palavra como a pessoa escreveu (com acento), não o radical usado na comparação */
    const orig = new Map();
    [(t.etiquetas || []).join(' '), t.titulo, t.nota].forEach(txt => String(txt || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach(w => {
      const st = norm(w).replace(/s$/, ''); if (st && !orig.has(st)) orig.set(st, w);
    }));
    return { pts, porque: [...ach.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => orig.get(x[0]) || x[0]) };
  }

  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const db = {
    listar: async () => ok(await sb().from('trends').select('*').order('created_at', { ascending: false }).limit(300)),
    criar: async d => ok(await sb().from('trends').insert([d]).select())[0],
    atualizar: async (id, p) => ok(await sb().from('trends').update(Object.assign({ updated_at: new Date().toISOString() }, p)).eq('id', id).select())[0],
    excluir: async id => ok(await sb().from('trends').delete().eq('id', id))
  };

  /* de onde é o link — só para o rótulo e a cor da etiqueta */
  function origem(link) {
    const l = String(link || '').toLowerCase();
    if (/instagram\.com/.test(l)) return ['ig', 'Instagram'];
    if (/tiktok\.com/.test(l)) return ['tt', 'TikTok'];
    if (/youtu\.?be/.test(l)) return ['yt', 'YouTube'];
    if (/pinterest\./.test(l)) return ['pin', 'Pinterest'];
    if (l) return ['web', 'Link'];
    return ['nota', 'Ideia'];
  }
  const linkSeguro = l => /^https?:\/\//i.test(String(l || '').trim()) ? String(l).trim() : '';

  async function abrir() {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/trends');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Trends']);
    painel().innerHTML = '<div class="conteudo entra tr-tela">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Trends</h1><p class="tr-intro">Viu uma trend boa? Guarde aqui. Na hora de gravar, ela vira roteiro para o cliente certo em dois toques.</p></div>' +
        '<div class="cb-topo-acoes"><button type="button" class="b pri" id="tr-nova">+ Nova trend</button></div></div>' +
      '<div class="tr-barra"><div class="filtro" role="tablist" aria-label="Quais trends">' +
        [['novas', 'Para usar'], ['usadas', 'Já usadas'], ['arquivadas', 'Arquivadas']].map(([k, r]) =>
          '<button role="tab" data-f="' + k + '" class="' + (filtro === k ? 'on' : '') + '" aria-selected="' + (filtro === k) + '">' + r + '<span class="cb-n" data-n-' + k + '></span></button>').join('') + '</div>' +
        '<input class="campo fina tr-busca" id="tr-q" type="search" placeholder="Buscar trend" value="' + esc(busca) + '" aria-label="Buscar trend"></div>' +
      '<div class="tr-faixa" id="tr-faixa"></div>' +
      '<div id="tr-corpo">' + B7.UI.skeleton('cards', { n: 4, titulo: false }) + '</div></div>';
    const p = painel();
    p.querySelector('#tr-nova').onclick = () => editar(null);
    p.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; p.querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); }); pintar(); });
    p.querySelector('#tr-q').oninput = e => { busca = e.target.value; pintar(); };
    B7.DB.listarClientes().then(l => { clientes = l || []; pintarFaixa(); }).catch(() => {});
    try { lista = await db.listar() || []; }
    catch (e) {
      const cx = document.getElementById('tr-corpo');
      const semTabela = e && (e.code === '42P01' || e.code === 'PGRST205' || /trends/.test(e.message || '') && /exist|schema cache/i.test(e.message || ''));
      if (cx) cx.innerHTML = semTabela
        ? '<div class="cb-aviso">O mural de Trends ainda está sendo ligado no banco. Volte daqui a pouco.</div>'
        : '<div class="cb-aviso erro">Não foi possível carregar as trends. <button class="cb-link" id="tr-denovo">Tentar de novo</button></div>';
      const b = document.getElementById('tr-denovo'); if (b) b.onclick = abrir;
      return;
    }
    pintar();
    /* veio de "Nova trend" no Criar */
    if (/[?&]nova=1/.test(location.hash)) { history.replaceState(null, '', '#/trends'); editar(null); }
  }

  const grupoDe = t => t.arquivada_at ? 'arquivadas' : (t.usos || []).length ? 'usadas' : 'novas';
  const usadaPor = (t, cid) => (t.usos || []).some(u => u.cliente_id === cid);

  function pintarFaixa() {
    const cx = document.getElementById('tr-faixa'); if (!cx) return;
    const etq = todasEtq().slice(0, 14);
    cx.innerHTML =
      '<div class="tr-sug"><label for="tr-sug-cli">Sugerir para</label><select class="campo fina" id="tr-sug-cli"><option value="">— escolha um cliente —</option>' +
        clientes.map(c => '<option value="' + esc(c.id) + '"' + (sugerir && sugerir.cliente.id === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select>' +
        (sugerir ? '<button type="button" class="b fina contorno" data-pasta>Pasta de referências</button><button type="button" class="adm-link" data-sug-limpar>Limpar</button>' : '') + '</div>' +
      (etq.length ? '<div class="tr-etqs" role="group" aria-label="Filtrar por etiqueta">' +
        '<button type="button" class="tr-etq' + (!fEtq ? ' on' : '') + '" data-etq="">Todas</button>' +
        etq.map(([e, n]) => '<button type="button" class="tr-etq' + (fEtq === e ? ' on' : '') + '" data-etq="' + esc(e) + '">' + esc(e) + '<i>' + n + '</i></button>').join('') + '</div>' : '');
    const sel = cx.querySelector('#tr-sug-cli');
    sel.onchange = async () => {
      if (!sel.value) { sugerir = null; pintarFaixa(); return pintar(); }
      const c = clientes.find(x => x.id === sel.value); if (!c) return;
      sel.disabled = true;
      const perfil = await perfilDoCliente(c);
      sugerir = { cliente: c, perfil };
      pintarFaixa(); pintar();
    };
    const lp = cx.querySelector('[data-sug-limpar]'); if (lp) lp.onclick = () => { sugerir = null; pintarFaixa(); pintar(); };
    const pa = cx.querySelector('[data-pasta]'); if (pa) pa.onclick = () => pasta(sugerir.cliente.id, sugerir.cliente.nome);
    cx.querySelectorAll('[data-etq]').forEach(b => b.onclick = () => { fEtq = b.dataset.etq; pintarFaixa(); pintar(); });
  }

  function pintar() {
    const cx = document.getElementById('tr-corpo'); if (!cx) return;
    pintarFaixa();
    const cont = { novas: 0, usadas: 0, arquivadas: 0 };
    lista.forEach(t => cont[grupoDe(t)]++);
    Object.keys(cont).forEach(k => { const n = painel().querySelector('[data-n-' + k + ']'); if (n) n.textContent = cont[k] || ''; });
    const q = busca.trim().toLowerCase();
    let itens = lista.filter(t => grupoDe(t) === filtro && (!q || (t.titulo + ' ' + t.nota + ' ' + t.link + ' ' + (t.etiquetas || []).join(' ')).toLowerCase().includes(q)) &&
      (!fEtq || (t.etiquetas || []).includes(fEtq)));
    let semRelacao = 0;
    const porque = new Map();
    if (sugerir) {
      const cid = sugerir.cliente.id, ranque = [];
      itens.forEach(t => {
        if (t.client_id && t.client_id !== cid) return;                    /* feita para outro cliente */
        if (usadaPor(t, cid)) return;                                      /* esse cliente já usou */
        const r = t.client_id === cid ? { pts: 100, porque: ['feita para este cliente'] } : pontuar(t, sugerir.perfil);
        if (r.pts > 0) { ranque.push([t, r]); porque.set(t.id, r.porque); } else semRelacao++;
      });
      ranque.sort((a, b) => b[1].pts - a[1].pts);
      itens = ranque.map(x => x[0]);
    }
    if (!itens.length) {
      cx.innerHTML = '<div class="estado-b7 tr-vazio"><b>' + (sugerir ? 'Nenhuma trend combina com ' + esc(sugerir.cliente.nome) + ' ainda.' : q || fEtq ? 'Nenhuma trend com esse filtro.' : filtro === 'novas' ? 'Nenhuma trend esperando.' : filtro === 'usadas' ? 'Nenhuma trend usada ainda.' : 'Nada arquivado.') + '</b>' +
        (sugerir ? '<span>' + (sugerir.perfil.linha ? 'Dê etiquetas às trends (ex.: o nicho do cliente) para elas aparecerem aqui.' : 'Este cliente ainda não tem linha editorial; sem ela a sugestão fica limitada ao nome.') + '</span>' : '') +
        (!sugerir && filtro === 'novas' && !q && !fEtq ? '<span>Cole o link de um Reels, TikTok ou áudio que a equipe deveria gravar.</span><button type="button" class="b pri" data-nova-vazio>+ Nova trend</button>' : '') + '</div>';
      const b = cx.querySelector('[data-nova-vazio]'); if (b) b.onclick = () => editar(null);
      barraLote();
      return;
    }
    cx.innerHTML = (sugerir ? '<p class="tr-sug-info">Combinam com <b>' + esc(sugerir.cliente.nome) + '</b>, da que mais combina para a que menos' +
        (semRelacao ? ' · ' + semRelacao + ' sem relação escondida' + (semRelacao === 1 ? '' : 's') : '') + '.</p>' : '') +
      '<div class="tr-grade">' + itens.map((t, i) => cartao(t, i, porque.get(t.id))).join('') + '</div>';
    cx.querySelectorAll('[data-usar]').forEach(b => b.onclick = () => usar(lista.find(t => t.id === b.dataset.usar)));
    cx.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => editar(lista.find(t => t.id === b.dataset.editar)));
    cx.querySelectorAll('[data-arquivar]').forEach(b => b.onclick = () => arquivar(lista.find(t => t.id === b.dataset.arquivar)));
    cx.querySelectorAll('[data-marca]').forEach(c => c.onchange = () => { if (c.checked) marcadas.add(c.dataset.marca); else marcadas.delete(c.dataset.marca); c.closest('.tr-card').classList.toggle('sel', c.checked); barraLote(); });
    cx.querySelectorAll('[data-etq-card]').forEach(b => b.onclick = () => { fEtq = b.dataset.etqCard; pintar(); });
    barraLote();
  }
  function cartao(t, i, porque) {
    const [k, nome] = origem(t.link), link = linkSeguro(t.link), usos = t.usos || [];
    const cli = t.client_id ? (clientes.find(c => c.id === t.client_id) || {}).nome : '';
    return '<article class="tr-card ad-in' + (marcadas.has(t.id) ? ' sel' : '') + '" style="--i:' + Math.min(i, 12) + '">' +
      '<div class="tr-card-topo"><span class="tr-orig tr-o-' + k + '">' + nome + '</span>' +
        '<small>' + esc(t.criado_por_nome || '') + (t.criado_por_nome ? ' · ' : '') + esc(B7.UI.quando ? B7.UI.quando(t.created_at) : '') + '</small>' +
        (t.arquivada_at ? '' : '<label class="tr-marca" title="Escolher para adicionar à gravação"><input type="checkbox" data-marca="' + esc(t.id) + '"' + (marcadas.has(t.id) ? ' checked' : '') + ' aria-label="Escolher esta trend"></label>') + '</div>' +
      '<h3>' + esc(t.titulo || 'Sem nome') + '</h3>' +
      (porque && porque.length ? '<div class="tr-porque">Combina por: ' + porque.map(w => '<b>' + esc(w) + '</b>').join(' · ') + '</div>' : '') +
      (t.nota ? '<p class="tr-nota">' + esc(t.nota) + '</p>' : '') +
      ((t.etiquetas || []).length || cli ? '<div class="tr-tags">' + (cli ? '<span class="tr-cli">Só para ' + esc(cli) + '</span>' : '') +
        (t.etiquetas || []).map(e => '<button type="button" class="tr-tag" data-etq-card="' + esc(e) + '">' + esc(e) + '</button>').join('') + '</div>' : '') +
      (link ? '<a class="tr-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Abrir a referência ↗</a>' : '') +
      (usos.length ? '<div class="tr-usos">' + usos.slice(-4).map(u => '<a class="tr-uso" href="#/gravacao/' + esc(u.gravacao_id) + (u.roteiro_id ? '?roteiro=' + esc(u.roteiro_id) : '') + '">' + esc(u.cliente_nome || 'Cliente') + '</a>').join('') + '</div>' : '') +
      '<div class="tr-acoes">' +
        (t.arquivada_at ? '' : '<button type="button" class="b fina pri" data-usar="' + esc(t.id) + '">Usar para um cliente</button>') +
        '<button type="button" class="b fina contorno" data-editar="' + esc(t.id) + '">Editar</button>' +
        '<button type="button" class="adm-link" data-arquivar="' + esc(t.id) + '">' + (t.arquivada_at ? 'Desarquivar' : 'Arquivar') + '</button>' +
      '</div></article>';
  }

  /* barra de escolhidas: adiciona todas na gravação de um cliente de uma vez */
  function barraLote() {
    let b = document.getElementById('tr-lote');
    const n = [...marcadas].filter(id => lista.some(t => t.id === id)).length;
    if (!n || !document.getElementById('tr-corpo')) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'tr-lote'; b.setAttribute('role', 'toolbar'); document.body.appendChild(b); }
    b.innerHTML = '<span><b>' + n + '</b> escolhida' + (n === 1 ? '' : 's') + '</span><button type="button" class="b pri fina" data-a="add">Adicionar à gravação…</button><button type="button" class="b fina" data-a="limpar">Limpar</button>';
    b.onclick = e => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (a === 'limpar') { marcadas.clear(); pintar(); }
      else if (a === 'add') adicionarEmLote([...marcadas].map(id => lista.find(t => t.id === id)).filter(Boolean));
    };
  }
  window.addEventListener('hashchange', () => { marcadas.clear(); const b = document.getElementById('tr-lote'); if (b) b.remove(); });

  async function adicionarEmLote(ts) {
    if (!ts.length) return;
    if (!clientes.length) { try { clientes = await B7.DB.listarClientes(); } catch (e) {} }
    const m = B7.UI.modal('<h3>Adicionar à gravação</h3>' +
      '<p class="sub">' + ts.length + (ts.length === 1 ? ' trend entra' : ' trends entram') + ' como referência na lista “O que vamos gravar” da gravação escolhida.</p>' +
      '<div class="mb"><label class="rot" for="tl-cli">CLIENTE</label><select class="campo" id="tl-cli"><option value="">Escolha o cliente</option>' +
        clientes.map(c => '<option value="' + esc(c.id) + '"' + (sugerir && sugerir.cliente.id === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select></div>' +
      '<div class="mb" id="tl-grav-cx" hidden><label class="rot" for="tl-grav">GRAVAÇÃO</label><select class="campo" id="tl-grav"></select></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tl-ok" disabled>Adicionar</button></div>');
    const sCli = m.querySelector('#tl-cli'), sGrav = m.querySelector('#tl-grav'), cxG = m.querySelector('#tl-grav-cx'), ok2 = m.querySelector('#tl-ok');
    const carregarGravs = async () => {
      ok2.disabled = true; cxG.hidden = true;
      if (!sCli.value) return;
      let gravs = [];
      try { gravs = (await B7.DB.gravacoesDoClienteParaVideo(sCli.value)).filter(g => !['Gravada', 'Cancelada'].includes(g.situacao)); } catch (e) {}
      const hoje = new Date().toISOString().slice(0, 10);
      gravs.sort((a, b) => {                                              /* a próxima data primeiro; sem data por último */
        const da = a.data_gravacao ? String(a.data_gravacao).slice(0, 10) : '9999', db2 = b.data_gravacao ? String(b.data_gravacao).slice(0, 10) : '9999';
        const fa = da >= hoje ? 0 : 1, fb = db2 >= hoje ? 0 : 1;
        return fa - fb || (da < db2 ? -1 : da > db2 ? 1 : 0);
      });
      const rot = g => (g.nome || 'Gravação') + (g.data_gravacao ? ' · ' + B7.UI.dataBR(String(g.data_gravacao).slice(0, 10)) : ' · sem data');
      sGrav.innerHTML = gravs.map(g => '<option value="' + esc(g.id) + '">' + esc(rot(g)) + '</option>').join('') + '<option value="__nova">+ Gravação nova “Trends” (sem data)</option>';
      cxG.hidden = false; ok2.disabled = false;
    };
    sCli.onchange = carregarGravs;
    if (sCli.value) carregarGravs();
    ok2.onclick = async () => {
      const cli = clientes.find(c => c.id === sCli.value); if (!cli) return;
      ok2.disabled = true; ok2.textContent = 'Adicionando…';
      try {
        let gid = sGrav.value;
        if (gid === '__nova') gid = (await B7.DB.criarGravacao({ client_id: cli.id, nome: 'Trends', competencia_ano: new Date().getFullYear(), competencia_mes: new Date().getMonth() + 1 })).id;
        const ja = new Set(((await B7.DB.gravacaoItens(gid)) || []).filter(i => i.tipo === 'referencia').map(i => String(i.url || '').trim()));
        let add = 0, semLink = 0, repetidas = 0;
        for (const t of ts) {
          const link = linkSeguro(t.link);
          if (!link) { semLink++; continue; }
          if (ja.has(link)) { repetidas++; continue; }
          await B7.DB.gravacaoItemAdicionar(gid, { tipo: 'referencia', titulo: t.titulo || 'Trend', url: link, observacao: t.nota || '' });
          ja.add(link); add++;
          const usos = (t.usos || []).concat([{ cliente_id: cli.id, cliente_nome: cli.nome, gravacao_id: gid, roteiro_id: null, em: new Date().toISOString() }]);
          try { Object.assign(t, await db.atualizar(t.id, { usos })); } catch (e) {}
        }
        marcadas.clear(); m.fechar(); pintar();
        const extra = (semLink ? ' ' + semLink + ' sem link ficou' + (semLink === 1 ? '' : 'ram') + ' de fora.' : '') + (repetidas ? ' ' + repetidas + ' já estava' + (repetidas === 1 ? '' : 'm') + ' lá.' : '');
        B7.UI.toast((add ? add + (add === 1 ? ' trend adicionada' : ' trends adicionadas') + ' à gravação.' : 'Nada novo para adicionar.') + extra);
        if (add) location.hash = '#/gravacao/' + gid;
      } catch (e) {
        ok2.disabled = false; ok2.textContent = 'Adicionar';
        B7.UI.toast('Não foi possível adicionar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' });
      }
    };
  }

  /* pasta de referências de um cliente: trends nas gravações dele + links da linha editorial */
  async function pasta(clienteId, nome) {
    const m = B7.UI.modal('<h3>Referências de ' + esc(nome || 'cliente') + '</h3><div id="pf-corpo">' + B7.UI.skeleton('lista', { n: 3 }) + '</div><div class="acoes"><button type="button" class="b" data-fecha>Fechar</button></div>');
    const cx = m.querySelector('#pf-corpo');
    try {
      const gravs = ok(await sb().from('gravacoes').select('id,nome,data_gravacao').eq('client_id', clienteId).is('deleted_at', null));
      const ids = gravs.map(g => g.id);
      const itens = ids.length ? ok(await sb().from('gravacao_itens_resumo').select('gravacao_id,titulo,url,tipo').in('gravacao_id', ids).eq('tipo', 'referencia')) : [];
      const ls = ok(await sb().from('linhas_editoriais').select('id,mes,ano,referencias').eq('client_id', clienteId).is('deleted_at', null).order('ano', { ascending: false }).order('mes', { ascending: false }).limit(3));
      const lids = ls.map(l => l.id);
      const cts = lids.length ? ok(await sb().from('conteudos').select('id,titulo,referencia_link,linha_id').in('linha_id', lids).is('deleted_at', null).neq('referencia_link', '')) : [];
      let uso = [];
      try { uso = lids.length ? ok(await sb().from('linha_ref_uso').select('linha_id,conteudo_id,link,uso').in('linha_id', lids)) : []; } catch (e) {}
      const usoDe = (lid, cid, link) => { const u = uso.find(x => x.linha_id === lid && (x.conteudo_id || null) === (cid || null) && x.link === link); return u ? (u.uso === 'gravacao' ? 'edição e gravação' : 'só edição') : 'a decidir'; };
      const gNome = id => { const g = gravs.find(x => x.id === id); return g ? (g.nome || 'Gravação') + (g.data_gravacao ? ' · ' + B7.UI.dataBR(String(g.data_gravacao).slice(0, 10)) : '') : 'Gravação'; };
      const linhaRef = [];
      ls.forEach(l => String(l.referencias || '').split('\n').map(x => x.trim()).filter(x => linkSeguro(x)).forEach(x => linhaRef.push({ titulo: 'Referência do mês ' + String(l.mes).padStart(2, '0') + '/' + l.ano, link: x, uso: usoDe(l.id, null, x) })));
      cts.forEach(c => linhaRef.push({ titulo: c.titulo || 'Conteúdo', link: c.referencia_link, uso: usoDe(c.linha_id, c.id, c.referencia_link) }));
      const li = (titulo, link, sub) => '<li><a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer"><b>' + esc(titulo) + '</b><small>' + esc(sub) + '</small></a></li>';
      cx.innerHTML =
        '<h4 class="pf-t">Trends e referências nas gravações <i>' + itens.length + '</i></h4>' +
        (itens.length ? '<ul class="pf-lista">' + itens.map(i => li(i.titulo || 'Referência', linkSeguro(i.url) || '#', gNome(i.gravacao_id))).join('') + '</ul>' : '<p class="leve">Nenhuma ainda.</p>') +
        '<h4 class="pf-t">Links da linha editorial <i>' + linhaRef.length + '</i></h4>' +
        (linhaRef.length ? '<ul class="pf-lista">' + linhaRef.map(r => li(r.titulo, linkSeguro(r.link) || '#', r.uso)).join('') + '</ul>' : '<p class="leve">Nenhum link nas linhas recentes.</p>');
    } catch (e) { cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as referências.</div>'; }
  }

  function editar(t) {
    const nova = !t;
    const m = B7.UI.modal('<h3>' + (nova ? 'Nova trend' : 'Editar trend') + '</h3>' +
      '<p class="sub">Só o link já basta. O nome é o que a equipe vai ler na lista.</p>' +
      '<div class="mb"><label class="rot" for="tr-link">LINK (Reels, TikTok, YouTube, áudio…)</label><input class="campo" id="tr-link" type="url" inputmode="url" maxlength="600" placeholder="https://" value="' + esc(t ? t.link : '') + '" data-foco></div>' +
      '<div class="mb"><label class="rot" for="tr-tit">NOME</label><input class="campo" id="tr-tit" maxlength="140" placeholder="Ex.: “POV: primeiro dia na clínica”" value="' + esc(t ? t.titulo : '') + '"></div>' +
      '<div class="mb"><label class="rot" for="tr-nota">COMO USAR (opcional)</label><textarea class="campo" id="tr-nota" rows="3" maxlength="1200" placeholder="Ex.: serve para clínicas e restaurantes; usar o áudio original">' + esc(t ? t.nota : '') + '</textarea></div>' +
      '<div class="mb"><label class="rot" for="tr-etq">ETIQUETAS (opcional)</label><input class="campo" id="tr-etq" maxlength="160" placeholder="Ex.: saúde, humor, antes e depois — separe por vírgula" value="' + esc(t ? (t.etiquetas || []).join(', ') : '') + '">' +
        '<div class="tr-etq-sug" id="tr-etq-sug">' + todasEtq().slice(0, 10).map(([e]) => '<button type="button" class="tr-tag" data-add-etq="' + esc(e) + '">+ ' + esc(e) + '</button>').join('') + '</div>' +
        '<small class="leve">As etiquetas ajudam a sugerir a trend para o cliente certo (use o nicho, o assunto e o formato).</small></div>' +
      '<div class="mb"><label class="rot" for="tr-cli-so">SÓ PARA UM CLIENTE (opcional)</label><select class="campo" id="tr-cli-so"><option value="">Serve para vários clientes</option>' +
        clientes.map(c => '<option value="' + esc(c.id) + '"' + (t && t.client_id === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select></div>' +
      '<div class="acoes">' + (nova ? '' : '<button type="button" class="b contorno perigo tr-esq" id="tr-excluir">Excluir</button>') +
        '<button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tr-salvar">' + (nova ? 'Guardar trend' : 'Salvar') + '</button></div>');
    const lk = m.querySelector('#tr-link'), tit = m.querySelector('#tr-tit');
    m.querySelectorAll('[data-add-etq]').forEach(b => b.onclick = () => {
      const campo = m.querySelector('#tr-etq'), atuais = etqLimpas(campo.value);
      if (!atuais.includes(b.dataset.addEtq)) atuais.push(b.dataset.addEtq);
      campo.value = atuais.join(', ');
    });
    /* sem nome digitado, sugere um pela origem do link */
    lk.addEventListener('change', () => { if (!tit.value.trim() && lk.value.trim()) tit.placeholder = 'Trend do ' + origem(lk.value)[1]; });
    m.querySelector('#tr-salvar').onclick = async () => {
      const link = lk.value.trim(), nota = m.querySelector('#tr-nota').value.trim();
      let titulo = tit.value.trim();
      if (!link && !titulo && !nota) return B7.UI.toast('Cole o link ou escreva a ideia.', { tipo: 'erro' });
      if (link && !linkSeguro(link)) return B7.UI.toast('O link precisa começar com https://', { tipo: 'erro' });
      if (!titulo) titulo = link ? 'Trend do ' + origem(link)[1] : nota.slice(0, 60);
      const bt = m.querySelector('#tr-salvar'); bt.disabled = true;
      try {
        const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
        const etiquetas = etqLimpas(m.querySelector('#tr-etq').value), client_id = m.querySelector('#tr-cli-so').value || null;
        if (nova) lista.unshift(await db.criar({ titulo, link, nota, etiquetas, client_id, criado_por_nome: (u && (u.nome || u.username)) || '' }));
        else { const n = await db.atualizar(t.id, { titulo, link, nota, etiquetas, client_id }); Object.assign(t, n); }
        m.fechar(); if (nova) filtro = 'novas';
        abrirOuPintar();
        B7.UI.toast(nova ? 'Trend guardada.' : 'Trend salva.');
      } catch (e) { bt.disabled = false; B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
    };
    const ex = m.querySelector('#tr-excluir');
    if (ex) ex.onclick = async () => {
      if (!(await B7.UI.confirmar({ titulo: 'Excluir esta trend?', texto: 'Os roteiros feitos com ela continuam onde estão.', rotulo: 'Excluir' }))) return;
      try { await db.excluir(t.id); lista = lista.filter(x => x.id !== t.id); m.fechar(); pintar(); B7.UI.toast('Trend excluída.'); }
      catch (e) { B7.UI.toast('Não foi possível excluir.', { tipo: 'erro' }); }
    };
  }
  const abrirOuPintar = () => { if (location.hash.indexOf('#/trends') === 0 && document.getElementById('tr-corpo')) { abrir(); } };

  async function arquivar(t) {
    try { const n = await db.atualizar(t.id, { arquivada_at: t.arquivada_at ? null : new Date().toISOString() }); Object.assign(t, n); pintar(); }
    catch (e) { B7.UI.toast('Não foi possível arquivar.', { tipo: 'erro' }); }
  }

  /* ---- usar: cliente → gravação em aberto → roteiro novo, e abre o editor ---- */
  async function usar(t) {
    let clientes = [];
    try { clientes = (await B7.DB.listarClientes()).filter(c => !c.teste || true); } catch (e) {}
    if (!clientes.length) return B7.UI.toast('Não há clientes para escolher.', { tipo: 'erro' });
    const m = B7.UI.modal('<h3>Usar a trend</h3>' +
      '<p class="sub">Cria um roteiro novo com <b>' + esc(t.titulo) + '</b> e a referência dentro, numa gravação em aberto do cliente, e abre o editor.</p>' +
      '<div class="mb"><label class="rot" for="tr-cli">CLIENTE</label><select class="campo" id="tr-cli"><option value="">Escolha o cliente</option>' +
        clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</select></div>' +
      '<div class="mb" id="tr-grav-cx" hidden><label class="rot" for="tr-grav">GRAVAÇÃO</label><select class="campo" id="tr-grav"></select></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tr-criar" disabled>Criar roteiro e abrir</button></div>');
    const sCli = m.querySelector('#tr-cli'), sGrav = m.querySelector('#tr-grav'), cxG = m.querySelector('#tr-grav-cx'), bt = m.querySelector('#tr-criar');
    sCli.onchange = async () => {
      bt.disabled = true; cxG.hidden = true;
      if (!sCli.value) return;
      let gravs = [];
      try { gravs = (await B7.DB.gravacoesDoClienteParaVideo(sCli.value)).filter(g => !['Gravada', 'Cancelada'].includes(g.situacao)); } catch (e) {}
      const rot = g => (g.nome || 'Gravação') + (g.data_gravacao ? ' · ' + B7.UI.dataBR(String(g.data_gravacao).slice(0, 10)) : ' · sem data');
      sGrav.innerHTML = gravs.map(g => '<option value="' + esc(g.id) + '">' + esc(rot(g)) + '</option>').join('') +
        '<option value="__nova">+ Gravação nova “Trends” (sem data)</option>';
      cxG.hidden = false; bt.disabled = false;
    };
    bt.onclick = async () => {
      const cli = clientes.find(c => c.id === sCli.value); if (!cli) return;
      bt.disabled = true; bt.textContent = 'Criando…';
      try {
        let gid = sGrav.value;
        if (gid === '__nova') gid = (await B7.DB.criarGravacao({ client_id: cli.id, nome: 'Trends' })).id;
        const existentes = await B7.DB.listarRoteiros(gid);
        const link = linkSeguro(t.link);
        const r = await B7.DB.criarRoteiro({ recording_session_id: gid, position: existentes.length, titulo: t.titulo || 'Trend',
          objetivo: [t.nota, link ? 'Referência: ' + link : ''].filter(Boolean).join('\n'), observacao_gravacao: link ? 'Trend: ' + link : '',
          escala: 1, escala_automatica: true, tema: t.titulo || '', status: 'Em criação' });
        const usos = (t.usos || []).concat([{ cliente_id: cli.id, cliente_nome: cli.nome, gravacao_id: gid, roteiro_id: r.id, em: new Date().toISOString() }]);
        try { Object.assign(t, await db.atualizar(t.id, { usos })); } catch (e) {}
        try { B7.DB.registrar({ tipo: 'criar', entidade: 'roteiro', id: r.id, cliente: cli.id, gravacao: gid, texto: 'Novo roteiro a partir da trend: ' + (t.titulo || '') }); } catch (e) {}
        m.fechar();
        location.hash = '#/gravacao/' + gid + '?roteiro=' + r.id;
      } catch (e) {
        bt.disabled = false; bt.textContent = 'Criar roteiro e abrir';
        B7.UI.toast('Não foi possível criar o roteiro: ' + ((e && e.message) || 'erro'), { tipo: 'erro' });
      }
    };
  }

  return { abrir, nova: () => editar(null), pasta, _origem: origem };
})();
