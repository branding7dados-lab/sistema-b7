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
      '<div id="tr-corpo">' + B7.UI.skeleton('cards', { n: 4, titulo: false }) + '</div></div>';
    const p = painel();
    p.querySelector('#tr-nova').onclick = () => editar(null);
    p.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; p.querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); }); pintar(); });
    p.querySelector('#tr-q').oninput = e => { busca = e.target.value; pintar(); };
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
  function pintar() {
    const cx = document.getElementById('tr-corpo'); if (!cx) return;
    const cont = { novas: 0, usadas: 0, arquivadas: 0 };
    lista.forEach(t => cont[grupoDe(t)]++);
    Object.keys(cont).forEach(k => { const n = painel().querySelector('[data-n-' + k + ']'); if (n) n.textContent = cont[k] || ''; });
    const q = busca.trim().toLowerCase();
    const itens = lista.filter(t => grupoDe(t) === filtro && (!q || (t.titulo + ' ' + t.nota + ' ' + t.link).toLowerCase().includes(q)));
    if (!itens.length) {
      cx.innerHTML = '<div class="estado-b7 tr-vazio"><b>' + (q ? 'Nenhuma trend com essa busca.' : filtro === 'novas' ? 'Nenhuma trend esperando.' : filtro === 'usadas' ? 'Nenhuma trend usada ainda.' : 'Nada arquivado.') + '</b>' +
        (filtro === 'novas' && !q ? '<span>Cole o link de um Reels, TikTok ou áudio que a equipe deveria gravar.</span><button type="button" class="b pri" data-nova-vazio>+ Nova trend</button>' : '') + '</div>';
      const b = cx.querySelector('[data-nova-vazio]'); if (b) b.onclick = () => editar(null);
      return;
    }
    cx.innerHTML = '<div class="tr-grade">' + itens.map((t, i) => cartao(t, i)).join('') + '</div>';
    cx.querySelectorAll('[data-usar]').forEach(b => b.onclick = () => usar(lista.find(t => t.id === b.dataset.usar)));
    cx.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => editar(lista.find(t => t.id === b.dataset.editar)));
    cx.querySelectorAll('[data-arquivar]').forEach(b => b.onclick = () => arquivar(lista.find(t => t.id === b.dataset.arquivar)));
  }
  function cartao(t, i) {
    const [k, nome] = origem(t.link), link = linkSeguro(t.link), usos = t.usos || [];
    return '<article class="tr-card ad-in" style="--i:' + Math.min(i, 12) + '">' +
      '<div class="tr-card-topo"><span class="tr-orig tr-o-' + k + '">' + nome + '</span>' +
        '<small>' + esc(t.criado_por_nome || '') + (t.criado_por_nome ? ' · ' : '') + esc(B7.UI.quando ? B7.UI.quando(t.created_at) : '') + '</small></div>' +
      '<h3>' + esc(t.titulo || 'Sem nome') + '</h3>' +
      (t.nota ? '<p class="tr-nota">' + esc(t.nota) + '</p>' : '') +
      (link ? '<a class="tr-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Abrir a referência ↗</a>' : '') +
      (usos.length ? '<div class="tr-usos">' + usos.slice(-4).map(u => '<a class="tr-uso" href="#/gravacao/' + esc(u.gravacao_id) + '?roteiro=' + esc(u.roteiro_id) + '">' + esc(u.cliente_nome || 'Cliente') + '</a>').join('') + '</div>' : '') +
      '<div class="tr-acoes">' +
        (t.arquivada_at ? '' : '<button type="button" class="b fina pri" data-usar="' + esc(t.id) + '">Usar para um cliente</button>') +
        '<button type="button" class="b fina contorno" data-editar="' + esc(t.id) + '">Editar</button>' +
        '<button type="button" class="adm-link" data-arquivar="' + esc(t.id) + '">' + (t.arquivada_at ? 'Desarquivar' : 'Arquivar') + '</button>' +
      '</div></article>';
  }

  function editar(t) {
    const nova = !t;
    const m = B7.UI.modal('<h3>' + (nova ? 'Nova trend' : 'Editar trend') + '</h3>' +
      '<p class="sub">Só o link já basta. O nome é o que a equipe vai ler na lista.</p>' +
      '<div class="mb"><label class="rot" for="tr-link">LINK (Reels, TikTok, YouTube, áudio…)</label><input class="campo" id="tr-link" type="url" inputmode="url" maxlength="600" placeholder="https://" value="' + esc(t ? t.link : '') + '" data-foco></div>' +
      '<div class="mb"><label class="rot" for="tr-tit">NOME</label><input class="campo" id="tr-tit" maxlength="140" placeholder="Ex.: “POV: primeiro dia na clínica”" value="' + esc(t ? t.titulo : '') + '"></div>' +
      '<div class="mb"><label class="rot" for="tr-nota">COMO USAR (opcional)</label><textarea class="campo" id="tr-nota" rows="3" maxlength="1200" placeholder="Ex.: serve para clínicas e restaurantes; usar o áudio original">' + esc(t ? t.nota : '') + '</textarea></div>' +
      '<div class="acoes">' + (nova ? '' : '<button type="button" class="b contorno perigo tr-esq" id="tr-excluir">Excluir</button>') +
        '<button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tr-salvar">' + (nova ? 'Guardar trend' : 'Salvar') + '</button></div>');
    const lk = m.querySelector('#tr-link'), tit = m.querySelector('#tr-tit');
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
        if (nova) lista.unshift(await db.criar({ titulo, link, nota, criado_por_nome: (u && (u.nome || u.username)) || '' }));
        else { const n = await db.atualizar(t.id, { titulo, link, nota }); Object.assign(t, n); }
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

  return { abrir, nova: () => editar(null), _origem: origem };
})();
