/* =====================================================================
   DADOS DO GRUPO E PERFIL DO CONTATO (4.85.0) — B7.WaInfo
   Painel por cima da coluna da direita da Central (no celular, tela cheia).
   Abre com o que está guardado (wa_conversas / wa_grupo_membros, lidos com
   RLS) e atualiza com o WhatsApp (wa-evolution: grupo_dados, contato_perfil).
   Só o administrador do B7 mexe no grupo (o servidor confere de novo):
   membros, admins, nome, descrição, foto, link de convite e regras.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WaInfo = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  let ctx = null, el = null, vez = 0, estado = null;

  const IC = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    foto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    conversa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/></svg>'
  };
  const souAdmin = () => !!(ctx && ctx.souAdmin && ctx.souAdmin());
  const ini = s => String(s || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
  const fmtTel = t => { const d = String(t || '').replace(/\D/g, ''); if (!d) return ''; return d.length >= 12 ? '+' + d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, -4) + '-' + d.slice(-4) : '+' + d; };
  const foto = (url, nome, cls) => '<span class="wz-info-av ' + (cls || '') + '">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + '<b>' + esc(ini(nome)) + '</b></span>';
  const dataBR = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  /* ------------------------------------------------------------ casca */
  function casca(titulo) {
    fechar();
    const raiz = ctx.raiz();
    if (!raiz) return null;
    el = document.createElement('aside');
    el.className = 'wz-info'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', titulo);
    el.innerHTML = '<header class="wz-info-cab"><button class="wz-ic" data-info="fechar" aria-label="Fechar">' + IC.x + '</button><h3>' + esc(titulo) + '</h3><small class="wz-info-st" aria-live="polite"></small></header><div class="wz-info-corpo"></div>';
    raiz.appendChild(el);
    el.addEventListener('click', clique);
    document.addEventListener('keydown', tecla);
    return ++vez;
  }
  function tecla(e) { if (e.key === 'Escape' && el && !document.querySelector('.fundo-modal')) fechar(); }
  function fechar() {
    vez++;
    if (el) { el.remove(); el = null; }
    estado = null;
    document.removeEventListener('keydown', tecla);
  }
  const corpo = () => el && el.querySelector('.wz-info-corpo');
  const status = t => { const s = el && el.querySelector('.wz-info-st'); if (s) s.textContent = t || ''; };

  /* ------------------------------------------------------------ grupo */
  async function abrirGrupo(c, contexto) {
    ctx = contexto || ctx;
    const t = casca('Dados do grupo'); if (!t) return;
    estado = { tipo: 'grupo', c, jid: c.jid, num: c.numero_id || null, membros: null, b7_admin: null, fresco: false, busca: '', menu: null, link: null, grupo: { ...c } };
    /* 1) o que está guardado */
    try {
      let q = sb().from('wa_grupo_membros').select('membro_jid,telefone,admin').eq('grupo_jid', c.jid);
      if (c.numero_id) q = q.eq('numero_id', c.numero_id);
      const { data } = await q.limit(1100);
      if (t !== vez) return;
      if (data && data.length) estado.membros = await comNomes(data.map(m => ({ jid: m.membro_jid, telefone: m.telefone, admin: m.admin })));
    } catch (e) { /* sem guardado */ }
    if (t !== vez) return;
    pintarGrupo();
    /* 2) atualiza com o WhatsApp */
    atualizarGrupo(t);
  }
  async function comNomes(ms) {
    try {
      const { data } = await sb().from('wa_contatos').select('jid,nome,foto_url').in('jid', ms.map(m => m.jid).slice(0, 500));
      const mp = new Map((data || []).map(x => [x.jid, x]));
      return ms.map(m => Object.assign({ nome: (mp.get(m.jid) || {}).nome || null, foto: (mp.get(m.jid) || {}).foto_url || null }, m));
    } catch (e) { return ms; }
  }
  async function atualizarGrupo(t) {
    status('atualizando…');
    let r;
    try { r = await ctx.chamar('grupo_dados', { jid: estado.jid, numero: estado.num || undefined }); } catch (e) { r = { erro: e.message }; }
    if (t !== vez || !estado) return;
    if (r.erro) { estado.erro = r.erro; status(''); return pintarGrupo(); }
    estado.erro = null; estado.fresco = true;
    estado.grupo = Object.assign({}, estado.grupo, r.grupo || {});
    estado.membros = r.membros || [];
    estado.b7_admin = r.b7_admin;
    status('');
    pintarGrupo();
  }
  const ordem = m => (m.b7 ? 0 : m.admin ? 1 : 2);
  function pintarGrupo() {
    const cx = corpo(); if (!cx || !estado) return;
    const g = estado.grupo, adm = souAdmin(), ms = estado.membros;
    const podeMexer = adm && estado.b7_admin !== false;
    const nB7 = ctx.numero && ctx.numero(estado.num);
    const desligado = adm && estado.b7_admin === false ? '<div class="wz-info-aviso">O número ' + esc(nB7 ? nB7.nome : 'da B7') + ' não é admin deste grupo — para mexer, alguém precisa torná-lo admin pelo celular.</div>' : '';
    const erro = estado.erro ? '<div class="wz-info-aviso erro">' + esc(estado.erro) + ' <button class="link" data-info="tentar">Tentar de novo</button></div>' : '';
    const nomeWa = g.nome || '';
    const local = estado.c.nome_fixo && estado.c.nome && estado.c.nome !== nomeWa ? '<small class="wz-info-local">No B7: ' + esc(estado.c.nome) + '</small>' : '';
    const qtd = ms ? ms.length : (g.membros_qtd || 0);
    const via = nB7 && ctx.varios && ctx.varios() ? ' · via ' + (B7.WaNumeros ? B7.WaNumeros.ponto(nB7) + ' ' : '') + esc(nB7.nome) : '';
    const busca = estado.busca.toLowerCase();
    const lista = (ms || []).filter(m => !busca || ((m.nome || '') + ' ' + (m.telefone || '')).toLowerCase().includes(busca))
      .sort((a, b) => ordem(a) - ordem(b) || String(a.nome || a.telefone || 'zzz').localeCompare(String(b.nome || b.telefone || 'zzz'), 'pt'));
    cx.innerHTML =
      '<div class="wz-info-topo">' + foto(g.foto_url, nomeWa, 'g') +
        '<div class="wz-info-nome"><b>' + esc(nomeWa || 'Grupo') + '</b>' + (podeMexer ? '<button class="wz-ic p" data-info="nome" title="Trocar o nome no WhatsApp" aria-label="Trocar o nome no WhatsApp">' + IC.lapis + '</button>' : '') + '</div>' + local +
        '<small>Grupo · ' + qtd + (qtd === 1 ? ' membro' : ' membros') + via + '</small>' +
        (podeMexer ? '<button class="b contorno p" data-info="foto">' + IC.foto + ' Trocar foto</button><input type="file" accept="image/jpeg,image/png,image/webp" id="wz-info-foto" hidden>' : '') +
      '</div>' + erro + desligado +
      '<section class="wz-info-bl"><div class="wz-info-bl-t"><h4>Descrição</h4>' + (podeMexer ? '<button class="wz-ic p" data-info="descricao" title="Trocar a descrição" aria-label="Trocar a descrição">' + IC.lapis + '</button>' : '') + '</div>' +
        '<p class="wz-info-desc">' + (g.descricao ? esc(g.descricao).replace(/\n/g, '<br>') : '<span class="wz-mudo">Sem descrição.</span>') + '</p>' +
        (g.criado_wa ? '<small class="wz-mudo">Criado em ' + dataBR(g.criado_wa) + '</small>' : '') + '</section>' +
      (adm ? '<section class="wz-info-bl"><h4>Administração</h4>' +
        '<div class="wz-info-lin"><span>' + IC.link + ' Link de convite</span><button class="b contorno p" data-info="link"' + (podeMexer ? '' : ' disabled') + '>' + (estado.link ? 'Copiar' : 'Ver link') + '</button></div>' +
        (estado.link ? '<div class="wz-info-link"><code>' + esc(estado.link) + '</code><button class="link perigo" data-info="revogar">Trocar o link</button></div>' : '') +
        regra('so_admins_enviam', 'Só admins enviam mensagens', g.so_admins_enviam, podeMexer) +
        regra('so_admins_editam', 'Só admins mudam os dados do grupo', g.so_admins_editam, podeMexer) + '</section>' : '') +
      '<section class="wz-info-bl"><div class="wz-info-bl-t"><h4>' + qtd + (qtd === 1 ? ' membro' : ' membros') + '</h4>' + (podeMexer ? '<button class="b pri p" data-info="add">+ Adicionar</button>' : '') + '</div>' +
        ((ms || []).length > 12 ? '<label class="wz-info-busca"><input type="search" id="wz-info-busca" placeholder="Buscar membro" value="' + esc(estado.busca) + '"></label>' : '') +
        (ms == null ? '<div class="wz-mudo">' + (estado.erro ? 'Sem a lista de membros agora.' : 'Buscando os membros…') + '</div>' :
          '<div class="wz-info-membros">' + lista.map(m => membroHtml(m, podeMexer)).join('') + '</div>') + '</section>';
    const bi = cx.querySelector('#wz-info-busca');
    if (bi) { bi.oninput = () => { estado.busca = bi.value; const p = bi.selectionStart; pintarGrupo(); const n = corpo().querySelector('#wz-info-busca'); if (n) { n.focus(); n.setSelectionRange(p, p); } }; }
    const fi = cx.querySelector('#wz-info-foto'); if (fi) fi.onchange = () => trocarFoto(fi.files[0]);
  }
  function regra(k, rotulo, v, pode) {
    const liga = pode && estado.fresco;
    return '<label class="wz-info-lin wz-info-regra"><span>' + rotulo + '</span><span class="asw-tg"><input type="checkbox" data-regra="' + k + '"' + (v ? ' checked' : '') + (liga ? '' : ' disabled') + '><span></span></span></label>';
  }
  function membroHtml(m, podeMexer) {
    const nome = m.nome || (m.telefone ? fmtTel(m.telefone) : 'Contato do WhatsApp');
    const selos = (m.b7 ? '<em class="s b7">Número da B7</em>' : '') + (m.equipe && !m.b7 ? '<em class="s eq">Equipe B7</em>' : '') + (m.admin ? '<em class="s ad">Admin</em>' : '');
    const aberto = estado.menu === m.jid;
    const conv = conversaDe(m);
    return '<div class="wz-info-m" data-m="' + esc(m.jid) + '"><button class="wz-info-m-b" data-info="perfil" data-jid="' + esc(m.jid) + '">' + foto(m.foto, nome) +
        '<span class="wz-info-m-t"><b>' + esc(nome) + '</b><small>' + esc(m.nome && m.telefone ? fmtTel(m.telefone) : '') + '</small></span><span class="wz-info-selos">' + selos + '</span></button>' +
      '<button class="wz-ic p" data-info="menu" data-jid="' + esc(m.jid) + '" aria-label="Opções de ' + esc(nome) + '" aria-expanded="' + aberto + '">' + IC.mais + '</button>' +
      (aberto ? '<div class="wz-info-menu" role="menu">' +
        '<button data-info="perfil" data-jid="' + esc(m.jid) + '">Ver perfil</button>' +
        '<button data-info="mensagem" data-jid="' + esc(m.jid) + '">' + (conv ? 'Conversar no privado' : 'Mandar mensagem no privado') + '</button>' +
        (podeMexer && !m.b7 ? (m.admin ? '<button data-info="demote" data-jid="' + esc(m.jid) + '">Tirar de admin</button>' : '<button data-info="promote" data-jid="' + esc(m.jid) + '">Tornar admin</button>') +
          '<button class="perigo" data-info="remove" data-jid="' + esc(m.jid) + '">Remover do grupo</button>' : '') +
      '</div>' : '') + '</div>';
  }
  function conversaDe(m) {
    const num = estado ? estado.num : null;
    return (ctx.conv(m.jid, num) || (m.telefone ? ctx.conv(m.telefone + '@s.whatsapp.net', num) : null)) || null;
  }

  /* ------------------------------------------------------------ ações do grupo (só admin) */
  /* revisão: toda ação guarda o painel que a pediu (t); se a pessoa trocou de painel, a resposta não pinta em outro */
  const mesmo = t => t === vez && estado && estado.tipo === 'grupo';
  async function membros(acao, quem, nomes) {
    const t = vez;
    let r;
    try { r = await ctx.chamar('grupo_membros', { jid: estado.jid, numero: estado.num || undefined, operacao: acao, participantes: quem }); }
    catch (e) { return B7.UI.toast(e.message, { tipo: 'erro' }); }
    if (r.erro) return B7.UI.toast(r.erro, { tipo: 'erro' });
    const f = r.falhou || [];
    if (f.length) B7.UI.toast(f.map(x => (nomes[x.quem] || fmtTel(String(x.quem).split('@')[0])) + ': ' + x.motivo).join(' · '), { tipo: 'erro', tempo: 9000 });
    else B7.UI.toast({ add: 'Adicionado ao grupo.', remove: 'Removido do grupo.', promote: 'Agora é admin.', demote: 'Não é mais admin.' }[acao]);
    if (mesmo(t)) atualizarGrupo(t);
  }
  async function adicionar() {
    const m = B7.UI.modal('<h3>Adicionar ao grupo</h3><div class="sub">Número com DDI e DDD, ou procure nos contatos do WhatsApp.</div>' +
      '<div class="mb"><input class="campo" id="wz-add-n" placeholder="Ex.: 55 62 99999-0000 ou nome" autocomplete="off"></div><div class="wz-info-sug" id="wz-add-sug"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="wz-add-ok">Adicionar</button></div>');
    const inp = m.querySelector('#wz-add-n'), sug = m.querySelector('#wz-add-sug');
    let esc_t = 0, alvo = null;
    setTimeout(() => inp.focus(), 50);
    inp.oninput = () => {
      alvo = null; clearTimeout(esc_t);
      const v = inp.value.trim(); if (v.length < 2 || /^[\d+\s()-]+$/.test(v)) { sug.innerHTML = ''; return; }
      esc_t = setTimeout(async () => {
        try {
          const { data } = await sb().from('wa_contatos').select('jid,nome,numero').ilike('nome', '%' + v.replace(/[%_]/g, '') + '%').not('numero', 'is', null).limit(6);
          sug.innerHTML = (data || []).map(c => '<button type="button" data-sug="' + esc(c.numero) + '" data-nome="' + esc(c.nome) + '"><b>' + esc(c.nome) + '</b><small>' + esc(fmtTel(c.numero)) + '</small></button>').join('');
        } catch (e) { sug.innerHTML = ''; }
      }, 250);
    };
    sug.onclick = e => { const b = e.target.closest('[data-sug]'); if (!b) return; alvo = b.dataset.sug; inp.value = b.dataset.nome + ' · ' + fmtTel(alvo); sug.innerHTML = ''; };
    m.querySelector('#wz-add-ok').onclick = () => {
      const n = alvo || inp.value.replace(/\D/g, '');
      if (n.length < 10 || n.length > 15) { B7.UI.toast('Use o número com DDI e DDD, ex.: 55 62 99999-0000.'); inp.focus(); return; }
      m.fechar(); membros('add', [n], {});
    };
  }
  async function editarTexto(campo) {
    const t = vez, g = estado.grupo;
    const v = await B7.UI.perguntar({ titulo: campo === 'nome' ? 'Nome do grupo no WhatsApp' : 'Descrição do grupo', rotulo: campo === 'nome' ? 'Todos os membros veem a troca.' : 'Aparece para todos os membros.', valor: (campo === 'nome' ? g.nome : g.descricao) || '', confirmar: 'Salvar' });
    if (v == null || !mesmo(t)) return;
    const val = String(v).trim();
    if (campo === 'nome' && !val) return B7.UI.toast('O nome não pode ficar vazio.');
    try { const r = await ctx.chamar('grupo_editar', { jid: estado.jid, numero: estado.num || undefined, [campo]: val }); if (r.erro) throw new Error(r.erro); }
    catch (e) { return B7.UI.toast(e.message, { tipo: 'erro' }); }
    B7.UI.toast(campo === 'nome' ? 'Nome trocado no WhatsApp.' : 'Descrição trocada.');
    if (mesmo(t)) { estado.grupo[campo] = val; pintarGrupo(); }
  }
  async function trocarFoto(f) {
    if (!f) return;
    const t = vez;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) return B7.UI.toast('Use uma imagem JPG, PNG ou WebP de até 5 MB.', { tipo: 'erro' });
    status('enviando a foto…');
    try {
      const u = (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
      const path = 'envio/' + (u.id || 'x') + '/' + Date.now() + '_grupo.' + (f.type.split('/')[1] || 'jpg');
      const up = await sb().storage.from('wa-midia').upload(path, f, { contentType: f.type });
      if (up.error) throw new Error('Não consegui subir a imagem.');
      const r = await ctx.chamar('grupo_foto', { jid: estado.jid, numero: estado.num || undefined, path });
      if (r.erro) throw new Error(r.erro);
      B7.UI.toast('Foto do grupo trocada.'); if (mesmo(t)) atualizarGrupo(t);
    } catch (e) { if (mesmo(t)) status(''); B7.UI.toast(e.message, { tipo: 'erro' }); }
  }
  async function link(revogar) {
    const t = vez;
    if (revogar && !(await B7.UI.confirmar({ titulo: 'Trocar o link de convite?', texto: 'O link atual para de funcionar na hora. Quem ainda não entrou vai precisar do link novo.', confirmar: 'Trocar o link', perigo: true }))) return;
    if (!revogar && estado.link) { try { await navigator.clipboard.writeText(estado.link); B7.UI.toast('Link copiado.'); } catch (e) { B7.UI.toast(estado.link); } return; }
    try { const r = await ctx.chamar('grupo_convite', { jid: estado.jid, numero: estado.num || undefined, revogar: !!revogar }); if (r.erro) throw new Error(r.erro); if (revogar) B7.UI.toast('Link trocado. O antigo não funciona mais.'); if (mesmo(t)) { estado.link = r.link; pintarGrupo(); } }
    catch (e) { B7.UI.toast(e.message, { tipo: 'erro' }); }
  }
  async function mudarRegra(inp) {
    const t = vez, k = inp.dataset.regra, v = inp.checked;
    const txt = { so_admins_enviam: v ? 'Só os admins vão poder mandar mensagem no grupo — inclusive o cliente fica sem poder escrever.' : 'Todos os membros voltam a poder mandar mensagem.',
      so_admins_editam: v ? 'Só os admins vão poder trocar nome, foto e descrição.' : 'Todos os membros vão poder trocar nome, foto e descrição.' }[k];
    if (!(await B7.UI.confirmar({ titulo: 'Mudar a regra do grupo?', texto: txt, confirmar: 'Mudar', perigo: v }))) { inp.checked = !v; return; }
    inp.disabled = true;
    try { const r = await ctx.chamar('grupo_regra', { jid: estado.jid, numero: estado.num || undefined, [k]: v }); if (r.erro) throw new Error(r.erro); if (mesmo(t)) estado.grupo[k] = v; B7.UI.toast('Regra do grupo mudada.'); }
    catch (e) { inp.checked = !v; B7.UI.toast(e.message, { tipo: 'erro' }); }
    if (mesmo(t)) pintarGrupo();
  }

  /* ------------------------------------------------------------ perfil do contato */
  async function abrirContato(jid, numeroId, contexto) {
    ctx = contexto || ctx;
    const voltar = estado && estado.tipo === 'grupo' ? { c: estado.c } : null;
    const t = casca('Perfil do contato'); if (!t) return;
    estado = { tipo: 'contato', jid, num: numeroId || null, perfil: null, grupos: null, voltar };
    try {
      const { data } = await sb().from('wa_contatos').select('nome,numero,foto_url').eq('jid', jid).maybeSingle();
      if (t !== vez) return;
      const tel = /@s\.whatsapp\.net$/.test(jid) ? jid.split('@')[0] : (data && data.numero) || null;
      estado.perfil = { nome: data && data.nome, foto: data && data.foto_url, telefone: tel };
    } catch (e) { estado.perfil = { telefone: /@s\.whatsapp\.net$/.test(jid) ? jid.split('@')[0] : null }; }
    pintarContato();
    status('atualizando…');
    let r;
    try { r = await ctx.chamar('contato_perfil', { jid, numero: numeroId || undefined }); } catch (e) { r = { erro: e.message }; }
    if (t !== vez || !estado) return;
    status('');
    if (r.erro) { estado.erro = r.erro; return pintarContato(); }
    estado.perfil = Object.assign({}, estado.perfil, Object.fromEntries(Object.entries(r.perfil || {}).filter(([, v]) => v != null && v !== '')));
    estado.grupos = r.grupos || [];
    pintarContato();
  }
  function pintarContato() {
    const cx = corpo(); if (!cx || !estado) return;
    const p = estado.perfil || {};
    const nome = p.nome || (p.telefone ? fmtTel(p.telefone) : 'Contato do WhatsApp');
    const conv = conversaDe({ jid: estado.jid, telefone: p.telefone });
    const cli = conv && conv.cliente_id && (ctx.clientes() || []).find(x => x.id === conv.cliente_id);
    const gs = estado.grupos;
    cx.innerHTML =
      (estado.voltar ? '<button class="link wz-info-volta" data-info="voltar-grupo">‹ Voltar ao grupo</button>' : '') +
      '<div class="wz-info-topo">' + foto(p.foto, nome, 'g') + '<div class="wz-info-nome"><b>' + esc(nome) + '</b></div>' +
        (p.telefone && p.nome ? '<small>' + esc(fmtTel(p.telefone)) + '</small>' : '') +
        '<button class="b pri p" data-info="mensagem" data-jid="' + esc(estado.jid) + '">' + IC.conversa + ' Mensagem</button>' + '</div>' +
      (estado.erro ? '<div class="wz-info-aviso erro">' + esc(estado.erro) + '</div>' : '') +
      '<section class="wz-info-bl"><h4>Recado</h4><p>' + (p.recado ? esc(p.recado) : '<span class="wz-mudo">' + (gs == null && !estado.erro ? 'Buscando…' : 'Sem recado.') + '</span>') + '</p></section>' +
      (p.comercial ? '<section class="wz-info-bl"><h4>Conta comercial</h4>' + (p.descricao ? '<p>' + esc(p.descricao) + '</p>' : '') +
        (p.email ? '<p><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></p>' : '') + (p.site ? '<p><a href="' + esc(/^https?:/.test(p.site) ? p.site : 'https://' + p.site) + '" target="_blank" rel="noopener">' + esc(p.site) + '</a></p>' : '') + '</section>' : '') +
      (cli ? '<section class="wz-info-bl"><h4>Cliente</h4><p><a href="#/cliente/' + esc(cli.id) + '">' + esc(cli.nome) + '</a></p></section>' : '') +
      '<section class="wz-info-bl"><h4>Grupos em comum' + (gs && gs.length ? ' · ' + gs.length : '') + '</h4>' +
        (gs == null ? '<div class="wz-mudo">' + (estado.erro ? 'Sem a lista agora.' : 'Buscando…') + '</div>' : !gs.length ? '<div class="wz-mudo">Nenhum grupo em comum conhecido.' + (!p.telefone ? ' (sem o número desta pessoa, a lista pode estar incompleta)' : '') + '</div>' :
          '<div class="wz-info-membros">' + gs.map(g => { const n = ctx.numero && ctx.numero(g.numero_id);
            return '<button class="wz-info-m-b" data-info="abrir-grupo" data-jid="' + esc(g.grupo_jid) + '" data-num="' + esc(g.numero_id) + '">' + foto(g.foto_url, g.nome) +
              '<span class="wz-info-m-t"><b>' + esc(g.nome) + '</b>' + (n && ctx.varios && ctx.varios() ? '<small>via ' + esc(n.nome) + '</small>' : '') + '</span></button>'; }).join('') + '</div>') + '</section>';
  }

  /* ------------------------------------------------------------ cliques */
  async function clique(e) {
    const rg = e.target.closest('[data-regra]'); if (rg) return mudarRegra(rg);
    const b = e.target.closest('[data-info]'); if (!b) { if (estado && estado.menu && !e.target.closest('.wz-info-menu')) { estado.menu = null; pintarGrupo(); } return; }
    const a = b.dataset.info, jid = b.dataset.jid;
    if (a === 'fechar') return fechar();
    if (a === 'tentar') return estado.tipo === 'grupo' ? atualizarGrupo(vez) : abrirContato(estado.jid, estado.num);
    if (a === 'menu') { estado.menu = estado.menu === jid ? null : jid; return pintarGrupo(); }
    if (a === 'perfil') return abrirContato(jid, estado.num);
    if (a === 'voltar-grupo') return abrirGrupo(estado.voltar.c);
    if (a === 'abrir-grupo') { const c = ctx.conv(jid, b.dataset.num || null); fechar(); if (c) ctx.abrirConversa(jid, b.dataset.num || null); return; }
    /* Mensagem (como no WhatsApp): abre a conversa no privado no mesmo número; se ainda não existe, o B7 cria e abre */
    if (a === 'mensagem' || a === 'conversar') {
      const m = estado.tipo === 'grupo' ? (estado.membros || []).find(x => x.jid === jid) : { jid: estado.jid, telefone: (estado.perfil || {}).telefone };
      if (!m) return;
      const num = estado.num, c = conversaDe(m);
      if (c) { fechar(); return ctx.abrirConversa(c.jid, num); }
      const alvo = m.telefone ? m.telefone + '@s.whatsapp.net' : m.jid;
      b.disabled = true; status('abrindo a conversa…');
      let r;
      try { r = await ctx.chamar('conversa_abrir', { jid: alvo, numero: num || undefined }); } catch (e) { r = { erro: e.message }; }
      if (r.erro || !r.jid) { b.disabled = false; status(''); return B7.UI.toast(r.erro || 'Não consegui abrir a conversa.', { tipo: 'erro' }); }
      fechar();
      if (ctx.recarregar) await ctx.recarregar();
      return ctx.abrirConversa(r.jid, num);
    }
    if (!souAdmin()) return;
    if (a === 'add') return adicionar();
    if (a === 'nome' || a === 'descricao') return editarTexto(a);
    if (a === 'foto') { const fi = el.querySelector('#wz-info-foto'); if (fi) fi.click(); return; }
    if (a === 'link') return link(false);
    if (a === 'revogar') return link(true);
    if (a === 'promote' || a === 'demote' || a === 'remove') {
      const m = (estado.membros || []).find(x => x.jid === jid); if (!m) return;
      const nome = m.nome || fmtTel(m.telefone) || 'esta pessoa';
      estado.menu = null; pintarGrupo();
      if (a === 'remove' && !(await B7.UI.confirmar({ titulo: 'Remover ' + nome + ' do grupo?', texto: 'A pessoa sai do grupo na hora e o WhatsApp avisa a todos. Para voltar, alguém precisa adicioná-la de novo.', confirmar: 'Remover', perigo: true }))) return;
      return membros(a, [m.telefone || m.jid], { [m.jid]: nome, [m.telefone + '@s.whatsapp.net']: nome });
    }
  }

  return { abrirGrupo, abrirContato, fechar, aberto: () => !!el };
})();
