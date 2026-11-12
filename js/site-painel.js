/* =====================================================================
   SITE (4.36.0) — o painel do site da agência (branding7.com.br).
   Tudo que aparece no site sai daqui, sem mexer em código:
     Contatos     quem pediu orçamento pelo formulário (com a origem do anúncio)
     Vídeos       portfólio: link do Instagram/YouTube/Drive ou arquivo
     Depoimentos  em texto ou em vídeo
     Serviços     os cartões da seção "Serviços"
     Clientes     nomes ou logos da faixa "Marcas que confiam"
     Página       textos, WhatsApp, Instagram, regiões, números, Pixel e GA4
   Banco: site_config, site_itens, site_leads e o bucket "site"
   (supabase/sql/zzz323_site.sql). Só administrador.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.SitePainel = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const sb = () => B7.sb;
  const ok = r => { if (r.error) throw r.error; return r.data; };
  const SITE = 'https://branding7.com.br/';
  const ABAS = [['contatos', 'Contatos'], ['video', 'Vídeos'], ['depoimento', 'Depoimentos'], ['servico', 'Serviços'], ['cliente', 'Clientes'], ['pagina', 'Página']];
  const STATUS = [['novo', 'Novo', 'rosa'], ['em_contato', 'Em contato', 'azul'], ['virou_cliente', 'Virou cliente', 'verde'], ['descartado', 'Descartado', 'cinza']];
  const IC = {
    globo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.9 3.9 5.9 3.9 9s-1.3 6.1-3.9 9c-2.6-2.9-3.9-5.9-3.9-9s1.3-6.1 3.9-9z"/></svg>',
    zap: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.6l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm4.4 11.8c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.4-.2z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    cima: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
    baixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
    estrela: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
  };
  let aba = 'contatos', itens = [], leads = [], cfg = {};

  const tipoLink = u => {
    u = String(u || '');
    if (/instagram\.com\/(reel|p|tv)\//i.test(u)) return 'Instagram';
    if (/youtu\.?be/i.test(u)) return 'YouTube';
    if (/drive\.google\.com/i.test(u)) return 'Drive';
    if (/\.(mp4|webm|mov)(\?|#|$)/i.test(u) || /supabase\.co\/storage/i.test(u)) return 'Arquivo';
    return u ? 'Link' : '';
  };
  const telLimpo = t => { let d = String(t || '').replace(/\D/g, ''); if (d.length <= 11) d = '55' + d; return d; };

  async function carregar() {
    const [c, i, l] = await Promise.all([
      sb().from('site_config').select('dados').eq('id', 1).maybeSingle(),
      sb().from('site_itens').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false }),
      sb().from('site_leads').select('*').order('created_at', { ascending: false }).limit(300)
    ]);
    cfg = (ok(c) || {}).dados || {}; itens = ok(i) || []; leads = ok(l) || [];
  }

  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/site');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Site']);
    const pedida = params && params.get && params.get('aba');
    if (pedida && ABAS.some(a => a[0] === pedida)) aba = pedida;
    painel().innerHTML = '<div class="conteudo entra st-tela">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Site</h1><p class="st-intro">O que aparece em <b>branding7.com.br</b>: vídeos, depoimentos, serviços, clientes e textos. E os contatos que chegam pelo formulário.</p></div>' +
        '<div class="cb-topo-acoes"><a class="b contorno" href="' + SITE + '" target="_blank" rel="noopener">' + IC.globo + 'Abrir o site</a></div></div>' +
      '<div class="filtro st-abas" role="tablist">' + ABAS.map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '" aria-selected="' + (aba === k) + '">' + r + '<span class="cb-n" data-n="' + k + '"></span></button>').join('') + '</div>' +
      '<div id="st-corpo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    const p = painel();
    p.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
      aba = b.dataset.aba; history.replaceState(null, '', '#/site?aba=' + aba);
      p.querySelectorAll('[data-aba]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
      pintar();
    });
    try { await carregar(); }
    catch (e) {
      const cx = document.getElementById('st-corpo');
      if (cx) cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar o site. ' + esc((e && e.message) || '') + ' <button class="cb-link" id="st-denovo">Tentar de novo</button></div>';
      const b = document.getElementById('st-denovo'); if (b) b.onclick = () => abrir();
      return;
    }
    pintar();
  }

  function contadores() {
    const p = painel(); if (!p) return;
    const n = { contatos: leads.filter(l => l.status === 'novo').length };
    ['video', 'depoimento', 'servico', 'cliente'].forEach(t => { n[t] = itens.filter(i => i.tipo === t).length; });
    p.querySelectorAll('[data-n]').forEach(s => { const v = n[s.dataset.n]; s.textContent = v ? v : ''; s.classList.toggle('alerta', s.dataset.n === 'contatos' && v > 0); });
  }

  function pintar() {
    const cx = document.getElementById('st-corpo'); if (!cx) return;
    contadores();
    if (aba === 'contatos') return pintarContatos(cx);
    if (aba === 'pagina') return pintarPagina(cx);
    pintarItens(cx, aba);
  }

  /* ---------------------------------------------------------- contatos */
  function pintarContatos(cx) {
    if (!leads.length) {
      cx.innerHTML = '<div class="estado-b7"><div class="b7-marca fraca"></div><b>Nenhum contato ainda.</b><p>Quando alguém preencher o formulário do site, aparece aqui e você recebe um aviso no sino.</p></div>';
      return;
    }
    const origemTx = o => {
      o = o || {};
      const partes = [o.utm_source, o.utm_campaign].filter(Boolean);
      if (partes.length) return 'Anúncio: ' + partes.join(' · ');
      if (o.fbclid) return 'Veio do Facebook/Instagram';
      if (o.gclid) return 'Veio do Google Ads';
      if (o.referrer) { try { return 'Veio de ' + new URL(o.referrer).hostname.replace(/^www\./, ''); } catch (e) {} }
      return 'Direto no site';
    };
    cx.innerHTML = '<div class="st-leads">' + leads.map(l => {
      const st = STATUS.find(s => s[0] === l.status) || STATUS[0];
      const msg = 'Olá, ' + String(l.nome || '').split(' ')[0] + '! Aqui é da Branding7, vi o seu contato pelo site.';
      return '<article class="st-lead st-' + esc(st[2]) + '" data-lead="' + esc(l.id) + '">' +
        '<div class="st-lead-cab"><div><b>' + esc(l.nome) + '</b><small>' + esc([l.empresa, l.cidade].filter(Boolean).join(' · ') || 'sem empresa/cidade') + '</small></div>' +
          '<select class="campo fina st-status" aria-label="Situação">' + STATUS.map(([k, r]) => '<option value="' + k + '"' + (k === l.status ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
        (l.interesse ? '<span class="st-chip">' + esc(l.interesse) + '</span>' : '') +
        (l.mensagem ? '<p class="st-msg">' + esc(l.mensagem) + '</p>' : '') +
        '<div class="st-lead-pe"><small>' + esc(B7.UI.quando ? B7.UI.quando(l.created_at) : '') + ' · ' + esc(origemTx(l.origem)) + '</small>' +
          '<a class="b fina st-zap" target="_blank" rel="noopener" href="https://wa.me/' + telLimpo(l.whatsapp) + '?text=' + encodeURIComponent(msg) + '">' + IC.zap + esc(l.whatsapp) + '</a></div>' +
        '<textarea class="campo st-notas" rows="1" maxlength="1000" placeholder="Anotação (só a equipe vê)">' + esc(l.notas || '') + '</textarea>' +
      '</article>';
    }).join('') + '</div>';
    cx.querySelectorAll('[data-lead]').forEach(el => {
      const id = el.dataset.lead, l = leads.find(x => x.id === id);
      el.querySelector('.st-status').onchange = async e => {
        const v = e.target.value;
        try { ok(await sb().from('site_leads').update({ status: v, atualizado_em: new Date().toISOString() }).eq('id', id)); l.status = v; pintar(); }
        catch (er) { B7.UI.toast('Não foi possível salvar: ' + ((er && er.message) || ''), { tipo: 'erro' }); }
      };
      const n = el.querySelector('.st-notas');
      n.onchange = async () => {
        try { ok(await sb().from('site_leads').update({ notas: n.value.trim() || null, atualizado_em: new Date().toISOString() }).eq('id', id)); l.notas = n.value.trim(); B7.UI.toast('Anotação salva.'); }
        catch (er) { B7.UI.toast('Não foi possível salvar a anotação.', { tipo: 'erro' }); }
      };
    });
  }

  /* ---------------------------------------------------------- itens */
  const TIPO = {
    video: { um: 'vídeo', novo: '+ Novo vídeo', vazio: 'Nenhum vídeo ainda. Os vídeos aparecem no site em "Projetos selecionados"; o marcado com estrela também toca na abertura.' },
    depoimento: { um: 'depoimento', novo: '+ Novo depoimento', vazio: 'Nenhum depoimento ainda. Coloque o print da fala do cliente em texto ou o vídeo dele falando.' },
    servico: { um: 'serviço', novo: '+ Novo serviço', vazio: 'Sem serviços cadastrados: o site mostra 6 serviços padrão (Reels, anúncios, gravação, edição, roteiro, redes). Cadastre aqui para trocar pelos seus.' },
    cliente: { um: 'cliente', novo: '+ Novo cliente', vazio: 'Nenhum cliente na faixa "Marcas que confiam". Coloque o nome ou o logo.' }
  };
  function pintarItens(cx, tipo) {
    const lista = itens.filter(i => i.tipo === tipo);
    const T = TIPO[tipo];
    cx.innerHTML = '<div class="st-barra"><button class="b pri" id="st-novo">' + T.novo + '</button>' +
      (lista.length > 1 ? '<small>Use as setas para mudar a ordem no site.</small>' : '') + '</div>' +
      (lista.length ? '<div class="st-lista st-l-' + tipo + '">' + lista.map((i, k) => {
        const midia = i.capa_url ? '<img src="' + esc(i.capa_url) + '" alt="" loading="lazy">'
          : tipoLink(i.video_url) === 'Arquivo' ? '<video src="' + esc(i.video_url) + '#t=0.5" muted preload="metadata"></video>' : '';
        const titulo = tipo === 'cliente' ? (i.cliente_nome || i.titulo) : tipo === 'depoimento' ? (i.cliente_nome || 'Depoimento') : i.titulo || i.cliente_nome || '(sem título)';
        const sub = tipo === 'video' ? [i.cliente_nome, i.cliente_arroba ? '@' + String(i.cliente_arroba).replace(/^@/, '') : '', i.categoria, tipoLink(i.video_url)].filter(Boolean).join(' · ')
          : tipo === 'depoimento' ? (i.video_url ? 'Vídeo · ' + tipoLink(i.video_url) : '“' + String(i.texto || '').slice(0, 90) + (String(i.texto || '').length > 90 ? '…' : '') + '”')
          : tipo === 'servico' ? String(i.texto || '').slice(0, 110) : i.capa_url ? 'com logo' : 'só o nome';
        return '<div class="st-item' + (i.publicado ? '' : ' oculto') + '" data-item="' + esc(i.id) + '">' +
          (tipo === 'servico' ? '<span class="st-num">' + esc(i.icone || String(k + 1).padStart(2, '0')) + '</span>'
            : '<span class="st-midia' + (tipo === 'cliente' ? ' logo' : '') + '">' + midia + (tipo !== 'cliente' && (i.video_url) ? '<i>' + IC.play + '</i>' : '') + '</span>') +
          '<div class="st-tx"><b>' + esc(titulo) + (i.destaque ? ' <em class="st-dest" title="Toca na abertura do site">' + IC.estrela + '</em>' : '') + '</b><small>' + esc(sub) + '</small></div>' +
          '<label class="st-pub" title="Aparece no site"><input type="checkbox" data-pub' + (i.publicado ? ' checked' : '') + '><span>' + (i.publicado ? 'No site' : 'Escondido') + '</span></label>' +
          '<div class="st-acoes">' +
            '<button class="cb-ic" data-mover="-1" aria-label="Subir"' + (k === 0 ? ' disabled' : '') + '>' + IC.cima + '</button>' +
            '<button class="cb-ic" data-mover="1" aria-label="Descer"' + (k === lista.length - 1 ? ' disabled' : '') + '>' + IC.baixo + '</button>' +
            '<button class="cb-ic" data-editar aria-label="Editar">' + IC.lapis + '</button>' +
            '<button class="cb-ic perigo" data-apagar aria-label="Apagar">' + IC.lixo + '</button></div></div>';
      }).join('') + '</div>' : '<div class="estado-b7"><div class="b7-marca fraca"></div><p>' + esc(T.vazio) + '</p></div>');
    cx.querySelector('#st-novo').onclick = () => editar(tipo, null);
    cx.querySelectorAll('[data-item]').forEach(el => {
      const id = el.dataset.item, i = itens.find(x => x.id === id);
      el.querySelector('[data-editar]').onclick = () => editar(tipo, i);
      el.querySelector('[data-pub]').onchange = async e => {
        try { ok(await sb().from('site_itens').update({ publicado: e.target.checked, updated_at: new Date().toISOString() }).eq('id', id)); i.publicado = e.target.checked; pintar(); }
        catch (er) { e.target.checked = !e.target.checked; B7.UI.toast('Não foi possível salvar.', { tipo: 'erro' }); }
      };
      el.querySelector('[data-apagar]').onclick = async () => {
        const sim = await B7.UI.confirmar({ titulo: 'Apagar este ' + TIPO[tipo].um + '?', texto: 'Ele sai do site. Se quiser só tirar por um tempo, use "No site" para esconder.', rotulo: 'Apagar', perigo: true });
        if (!sim) return;
        try { ok(await sb().from('site_itens').delete().eq('id', id)); itens = itens.filter(x => x.id !== id); pintar(); B7.UI.toast('Apagado.'); }
        catch (er) { B7.UI.toast('Não foi possível apagar.', { tipo: 'erro' }); }
      };
      el.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => mover(tipo, id, +b.dataset.mover));
    });
  }
  async function mover(tipo, id, d) {
    const lista = itens.filter(i => i.tipo === tipo);
    const k = lista.findIndex(i => i.id === id), j = k + d;
    if (j < 0 || j >= lista.length) return;
    [lista[k], lista[j]] = [lista[j], lista[k]];
    lista.forEach((i, n) => { i.ordem = n; });
    itens = itens.filter(i => i.tipo !== tipo).concat(lista);
    pintar();
    try { await Promise.all(lista.map((i, n) => sb().from('site_itens').update({ ordem: n }).eq('id', i.id))); }
    catch (e) { B7.UI.toast('Não foi possível salvar a ordem.', { tipo: 'erro' }); }
  }

  /* envio para o bucket "site" */
  async function subir(arquivo, pasta) {
    const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const caminho = pasta + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + ext;
    ok(await sb().storage.from('site').upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false, cacheControl: '31536000' }));
    return sb().storage.from('site').getPublicUrl(caminho).data.publicUrl;
  }

  function editar(tipo, i) {
    const novo = !i; i = i || { tipo, publicado: true };
    const campo = (id, rot, val, extra) => '<label class="rot" for="' + id + '">' + rot + '</label><input class="campo" id="' + id + '" value="' + esc(val || '') + '"' + (extra || '') + '>';
    const temVideo = tipo === 'video' || tipo === 'depoimento';
    const fonteInicial = tipoLink(i.video_url) === 'Arquivo' ? 'arquivo' : 'link';
    const corpo =
      (tipo === 'video' ? campo('si-titulo', 'TÍTULO', i.titulo, ' maxlength="140" placeholder="Ex.: Lançamento da coleção de verão"') : '') +
      (tipo === 'servico' ? campo('si-titulo', 'NOME DO SERVIÇO', i.titulo, ' maxlength="140"') +
        '<label class="rot" for="si-texto">DESCRIÇÃO</label><textarea class="campo" id="si-texto" rows="3" maxlength="800">' + esc(i.texto || '') + '</textarea>' +
        campo('si-icone', 'NÚMERO OU EMOJI', i.icone, ' maxlength="4" placeholder="01"') : '') +
      (tipo !== 'servico' ? '<div class="st-2">' + '<div>' + campo('si-cli', tipo === 'cliente' ? 'NOME DA MARCA' : 'CLIENTE', i.cliente_nome, ' maxlength="120"') + '</div>' +
        (tipo !== 'cliente' ? '<div>' + campo('si-arroba', '@ DO INSTAGRAM', i.cliente_arroba ? String(i.cliente_arroba).replace(/^@/, '') : '', ' maxlength="60" placeholder="sem o @"') + '</div>' : '') + '</div>' : '') +
      (tipo === 'video' ? campo('si-cat', 'CATEGORIA (vira filtro no site)', i.categoria, ' maxlength="60" list="si-cats" placeholder="Ex.: Reels, Anúncio, Institucional"') +
        '<datalist id="si-cats">' + [...new Set(itens.filter(x => x.categoria).map(x => x.categoria).concat(['Reels', 'Anúncio', 'Institucional', 'Depoimento']))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist>' : '') +
      (tipo === 'depoimento' ? '<label class="rot" for="si-texto">O QUE O CLIENTE DISSE <span class="mg-obr leve">ou use um vídeo abaixo</span></label><textarea class="campo" id="si-texto" rows="3" maxlength="800" placeholder="Ex.: O vídeo ficou top! Em uma semana a gente teve mais procura que no mês inteiro.">' + esc(i.texto || '') + '</textarea>' +
        campo('si-titulo', 'CARGO OU EMPRESA (opcional)', i.titulo, ' maxlength="140" placeholder="Ex.: Dono da Academia Força"') : '') +
      (temVideo ? '<label class="rot">VÍDEO' + (tipo === 'depoimento' ? ' <span class="mg-obr leve">opcional</span>' : '') + '</label>' +
        '<div class="st-fonte" role="tablist"><button type="button" data-fonte="link"' + (fonteInicial === 'link' ? ' class="on"' : '') + '>Link (Instagram, YouTube, Drive)</button><button type="button" data-fonte="arquivo"' + (fonteInicial === 'arquivo' ? ' class="on"' : '') + '>Enviar arquivo</button></div>' +
        '<div data-painel="link"' + (fonteInicial === 'link' ? '' : ' hidden') + '><input class="campo" id="si-link" placeholder="https://www.instagram.com/reel/…" value="' + esc(fonteInicial === 'link' ? (i.video_url || '') : '') + '">' +
          '<div class="gv-ajuda">Recomendado: não gasta espaço no banco. Funciona com Reels, YouTube (inclusive Shorts) e Google Drive (compartilhado como "qualquer pessoa com o link").</div></div>' +
        '<div data-painel="arquivo"' + (fonteInicial === 'arquivo' ? '' : ' hidden') + '><input class="campo" id="si-arq" type="file" accept="video/mp4,video/webm,video/quicktime">' +
          '<div class="gv-ajuda">Até 50 MB. Prefira MP4 comprimido (1080×1920, até 30 s). ' + (fonteInicial === 'arquivo' ? 'Já tem um vídeo enviado; escolha outro só para trocar.' : '') + ' Arquivo próprio toca sozinho no site (prévia muda) — o de link abre ao tocar.</div></div>' : '') +
      ((tipo === 'video' || tipo === 'cliente' || tipo === 'depoimento') ? '<label class="rot" for="si-capa">' + (tipo === 'cliente' ? 'LOGO (PNG transparente, de preferência)' : 'CAPA <span class="mg-obr leve">opcional</span>') + '</label>' +
        (i.capa_url ? '<div class="st-capa-atual"><img src="' + esc(i.capa_url) + '" alt=""><label class="check"><input type="checkbox" id="si-tira-capa"><span>Tirar a imagem atual</span></label></div>' : '') +
        '<input class="campo" id="si-capa" type="file" accept="image/png,image/jpeg,image/webp">' +
        (tipo === 'video' ? '<div class="gv-ajuda">Para vídeos de link a capa é o que aparece no site; sem capa, entra um fundo com o degradê da B7.</div>' : '') : '') +
      (tipo === 'video' ? '<label class="check st-check"><input type="checkbox" id="si-dest"' + (i.destaque ? ' checked' : '') + '><span>Destaque: toca no fundo da abertura do site (precisa ser arquivo enviado)</span></label>' : '') +
      '<label class="check st-check"><input type="checkbox" id="si-pub"' + (i.publicado ? ' checked' : '') + '><span>Aparecer no site</span></label>';
    const m = B7.UI.modal('<div class="ng-topo"><span class="ng-ic">' + IC.globo + '</span><div><h3>' + (novo ? 'Novo ' : 'Editar ') + TIPO[tipo].um + '</h3><div class="sub">Aparece em branding7.com.br assim que você salvar.</div></div></div>' +
      '<section class="ng-bloco st-form">' + corpo + '</section>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Salvar</button></div>', { extra: 'ng-modal st-modal' });
    let fonte = fonteInicial;
    m.querySelectorAll('[data-fonte]').forEach(b => b.onclick = () => {
      fonte = b.dataset.fonte;
      m.querySelectorAll('[data-fonte]').forEach(x => x.classList.toggle('on', x === b));
      m.querySelectorAll('[data-painel]').forEach(p => { p.hidden = p.dataset.painel !== fonte; });
    });
    const val = id => { const e = m.querySelector('#' + id); return e ? e.value.trim() : undefined; };
    m.querySelector('[data-ok]').onclick = async () => {
      const bt = m.querySelector('[data-ok]');
      const d = { tipo, publicado: m.querySelector('#si-pub').checked, updated_at: new Date().toISOString() };
      if (val('si-titulo') !== undefined) d.titulo = val('si-titulo') || null;
      if (val('si-texto') !== undefined) d.texto = val('si-texto') || null;
      if (val('si-icone') !== undefined) d.icone = val('si-icone') || null;
      if (val('si-cli') !== undefined) d.cliente_nome = val('si-cli') || null;
      if (val('si-arroba') !== undefined) d.cliente_arroba = (val('si-arroba') || '').replace(/^@/, '') || null;
      if (val('si-cat') !== undefined) d.categoria = val('si-cat') || null;
      const dest = m.querySelector('#si-dest'); if (dest) d.destaque = dest.checked;
      /* validação do que o site precisa para mostrar algo */
      if (tipo === 'servico' && !d.titulo) return B7.UI.toast('Dê um nome ao serviço.', { tipo: 'erro' });
      if (tipo === 'cliente' && !d.cliente_nome) return B7.UI.toast('Coloque o nome da marca.', { tipo: 'erro' });
      bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        if (temVideo) {
          if (fonte === 'link') {
            const u = val('si-link');
            if (u && !/^https?:\/\//i.test(u)) throw new Error('O link precisa começar com https://');
            d.video_url = u || null;
          } else {
            const f = m.querySelector('#si-arq').files[0];
            if (f) {
              if (f.size > 50 * 1024 * 1024) throw new Error('O vídeo passa de 50 MB. Comprima e tente de novo.');
              bt.textContent = 'Enviando o vídeo…';
              d.video_url = await subir(f, 'videos');
            } else if (tipoLink(i.video_url) !== 'Arquivo') throw new Error('Escolha o arquivo do vídeo.');
          }
          if (tipo === 'video' && !d.video_url) throw new Error('Coloque o link ou envie o vídeo.');
          if (tipo === 'depoimento' && !d.video_url && !d.texto) throw new Error('Escreva o que o cliente disse ou coloque um vídeo.');
          if (d.destaque && tipoLink(d.video_url) !== 'Arquivo') { d.destaque = false; B7.UI.toast('Destaque só toca na abertura com arquivo enviado; marquei sem destaque.'); }
        }
        const capa = m.querySelector('#si-capa');
        if (capa && capa.files[0]) {
          if (capa.files[0].size > 5 * 1024 * 1024) throw new Error('A imagem passa de 5 MB.');
          bt.textContent = 'Enviando a imagem…'; d.capa_url = await subir(capa.files[0], 'capas');
        } else if (m.querySelector('#si-tira-capa') && m.querySelector('#si-tira-capa').checked) d.capa_url = null;
        /* só um destaque por vez */
        if (d.destaque) ok(await sb().from('site_itens').update({ destaque: false }).eq('tipo', 'video').neq('id', i.id || '00000000-0000-0000-0000-000000000000'));
        if (novo) {
          d.ordem = itens.filter(x => x.tipo === tipo).length;
          const r = ok(await sb().from('site_itens').insert(d).select().single());
          itens.push(r);
        } else {
          const r = ok(await sb().from('site_itens').update(d).eq('id', i.id).select().single());
          itens = itens.map(x => x.id === r.id ? r : (d.destaque && x.tipo === 'video' ? { ...x, destaque: false } : x));
        }
        m.fechar(); pintar();
        B7.UI.toast(d.publicado ? 'Salvo. Já está no site.' : 'Salvo (escondido do site).');
      } catch (e) {
        bt.disabled = false; bt.textContent = 'Salvar';
        B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' });
      }
    };
  }

  /* ---------------------------------------------------------- página */
  function pintarPagina(cx) {
    const c = cfg || {};
    const linhas = a => (Array.isArray(a) ? a : []).join('\n');
    const nums = (Array.isArray(c.numeros) ? c.numeros : []).map(n => (n.valor || '') + ' | ' + (n.rotulo || '')).join('\n');
    const g = (id, rot, val, ajuda, extra) => '<div class="st-campo"><label class="rot" for="' + id + '">' + rot + '</label><input class="campo" id="' + id + '" value="' + esc(val || '') + '"' + (extra || '') + '>' + (ajuda ? '<div class="gv-ajuda">' + ajuda + '</div>' : '') + '</div>';
    cx.innerHTML = '<div class="st-pagina">' +
      '<section class="st-bloco"><h3>Abertura</h3>' +
        g('sp-palavras', 'PALAVRAS QUE GIRAM NO TÍTULO', (c.palavras || ['vender', 'viralizar', 'performar']).join(', '), '“O vídeo que faz você ___.” Separe por vírgula.') +
        '<div class="st-campo"><label class="rot" for="sp-sub">FRASE ABAIXO DO TÍTULO</label><textarea class="campo" id="sp-sub" rows="2" maxlength="240">' + esc(c.subtitulo || '') + '</textarea></div></section>' +
      '<section class="st-bloco"><h3>Contato</h3><div class="st-2">' +
        g('sp-wpp', 'WHATSAPP (com DDD)', c.whatsapp, 'É para onde vão o botão verde e o formulário.', ' inputmode="tel"') +
        g('sp-insta', 'INSTAGRAM', c.instagram, 'Sem o @.') + '</div><div class="st-2">' +
        g('sp-nome', 'NOME DE QUEM ATENDE', c.whatsapp_nome) + g('sp-cargo', 'CARGO', c.whatsapp_cargo) + '</div>' +
        '<div class="st-campo"><label class="rot" for="sp-msg">MENSAGEM QUE JÁ VEM ESCRITA NO WHATSAPP</label><textarea class="campo" id="sp-msg" rows="2" maxlength="300">' + esc(c.whatsapp_msg || '') + '</textarea></div></section>' +
      '<section class="st-bloco"><h3>Regiões e números</h3><div class="st-2">' +
        '<div class="st-campo"><label class="rot" for="sp-reg">REGIÕES ONDE GRAVAM (uma por linha)</label><textarea class="campo" id="sp-reg" rows="4" placeholder="Vitória da Conquista\nSudoeste da Bahia">' + esc(linhas(c.regioes)) + '</textarea><div class="gv-ajuda">Vazio = a seção não aparece.</div></div>' +
        '<div class="st-campo"><label class="rot" for="sp-num">NÚMEROS (valor | descrição, um por linha)</label><textarea class="campo" id="sp-num" rows="4" placeholder="+300 | vídeos entregues\n+40 | marcas atendidas">' + esc(nums) + '</textarea><div class="gv-ajuda">Aparecem embaixo do manifesto. Vazio = não aparece.</div></div></div></section>' +
      '<section class="st-bloco"><h3>Anúncios e métricas</h3><div class="st-2">' +
        g('sp-pixel', 'PIXEL DA META (ID)', c.pixel_meta, 'Só os números. Marca visita, clique no WhatsApp e envio do formulário (Lead).', ' inputmode="numeric"') +
        g('sp-ga', 'GOOGLE ANALYTICS 4 (ID)', c.ga4, 'Começa com G-, ex.: G-ABC123XYZ.') + '</div></section>' +
      '<div class="st-salvar"><button class="b pri" id="sp-salvar">Salvar a página</button><small>Muda no site na hora (quem estiver com ele aberto vê ao recarregar).</small></div></div>';
    cx.querySelector('#sp-salvar').onclick = async () => {
      const v = id => cx.querySelector('#' + id).value.trim();
      const wpp = v('sp-wpp').replace(/\D/g, '');
      if (wpp.length < 10) return B7.UI.toast('Coloque o WhatsApp com DDD.', { tipo: 'erro' });
      const ga = v('sp-ga');
      if (ga && !/^G-[A-Z0-9]+$/i.test(ga)) return B7.UI.toast('O ID do Google Analytics começa com G-.', { tipo: 'erro' });
      const dados = Object.assign({}, cfg, {
        palavras: v('sp-palavras').split(',').map(x => x.trim()).filter(Boolean).slice(0, 6),
        subtitulo: v('sp-sub'), whatsapp: wpp.length <= 11 ? '55' + wpp : wpp, instagram: v('sp-insta').replace(/^@/, ''),
        whatsapp_nome: v('sp-nome'), whatsapp_cargo: v('sp-cargo'), whatsapp_msg: v('sp-msg'),
        regioes: v('sp-reg').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30),
        numeros: v('sp-num').split('\n').map(x => x.split('|')).filter(p => p[0] && p[0].trim()).slice(0, 6).map(p => ({ valor: p[0].trim(), rotulo: (p[1] || '').trim() })),
        pixel_meta: v('sp-pixel').replace(/\D/g, ''), ga4: ga.toUpperCase()
      });
      const bt = cx.querySelector('#sp-salvar'); bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        ok(await sb().from('site_config').update({ dados, atualizado_em: new Date().toISOString(), atualizado_por: (B7.Auth.usuario() || {}).id || null }).eq('id', 1));
        cfg = dados; B7.UI.toast('Página salva. Já está no site.');
      } catch (e) { B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || ''), { tipo: 'erro' }); }
      bt.disabled = false; bt.textContent = 'Salvar a página';
    };
  }

  return { abrir };
})();
