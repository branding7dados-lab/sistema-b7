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
  const ABAS = [['contatos', 'Contatos'], ['video', 'Vídeos'], ['depoimento', 'Depoimentos'], ['servico', 'Serviços'], ['cliente', 'Clientes'], ['sobre', 'Sobre nós'], ['agenda', 'Agenda'], ['pagina', 'Página'], ['metricas', 'Métricas']];
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
  let aba = 'contatos', itens = [], leads = [], cfg = {}, clientesB7 = [], dias = 30, reunioes = [], pessoas = [], funcoesP = {};
  /* 4.46.3: cargo no site a partir das funções do sistema (igual a _site_cargo_de no banco) */
  const ROT_FN = { coordenador: 'Coordenador', designer: 'Designer', videomaker: 'Videomaker', admin: 'Administrador' };
  const cargoDe = x => x ? [...new Set([funcoesP[x.funcao_personalizada] || x.funcao].concat(x.funcoes_adicionais || []).filter(Boolean).map(f => ROT_FN[f] || f))].join(' · ') : '';

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
    const [c, i, l, k, a, pe, fp] = await Promise.all([
      sb().from('site_config').select('dados').eq('id', 1).maybeSingle(),
      sb().from('site_itens').select('*').order('ordem', { ascending: true }).order('created_at', { ascending: false }),
      sb().from('site_leads').select('*').order('created_at', { ascending: false }).limit(300),
      sb().from('clientes').select('id, nome, logo_url, no_site, site_ordem, teste').is('deleted_at', null).order('nome'),
      sb().from('site_agendamentos').select('id, lead_id, inicio, fim, status').gte('inicio', new Date(Date.now() - 30 * 864e5).toISOString()).order('inicio'),
      sb().from('perfis').select('id, nome, avatar_url, estado, parceiro, funcao, funcoes_adicionais, funcao_personalizada').eq('estado', 'ativa').order('nome'),
      sb().from('funcoes_personalizadas').select('id, rotulo')
    ]);
    cfg = (ok(c) || {}).dados || {}; itens = ok(i) || []; leads = ok(l) || [];
    clientesB7 = (k.error ? [] : (k.data || [])).filter(x => !x.teste);
    reunioes = a.error ? [] : (a.data || []);
    pessoas = pe.error ? [] : (pe.data || []).filter(x => !x.parceiro && !/teste/i.test(x.nome || ''));
    funcoesP = fp.error ? {} : Object.fromEntries((fp.data || []).map(x => [x.id, x.rotulo]));
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
    n.cliente += clientesB7.filter(x => x.no_site).length;
    n.sobre = itens.filter(i => i.tipo === 'equipe' || i.tipo === 'bastidor').length;
    n.agenda = reunioes.filter(r => r.status === 'marcado' && new Date(r.fim) > new Date()).length;
    p.querySelectorAll('[data-n]').forEach(s => { const v = n[s.dataset.n]; s.textContent = v ? v : ''; s.classList.toggle('alerta', s.dataset.n === 'contatos' && v > 0); });
  }

  function pintar() {
    const cx = document.getElementById('st-corpo'); if (!cx) return;
    contadores();
    if (aba === 'contatos') return pintarContatos(cx);
    if (aba === 'pagina') return pintarPagina(cx);
    if (aba === 'metricas') return pintarMetricas(cx);
    if (aba === 'cliente') return pintarClientes(cx);
    if (aba === 'sobre') return pintarSobre(cx);
    if (aba === 'agenda') return pintarAgenda(cx);
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
        reunioes.filter(r => r.lead_id === l.id && r.status === 'marcado').map(r => '<span class="st-chip st-reuniao">Reunião ' + esc(quandoReuniao(r.inicio)) + '</span>').join('') +
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
    cliente: { um: 'cliente', novo: '+ Novo cliente', vazio: 'Nenhum cliente na faixa "Marcas que confiam". Coloque o nome ou o logo.' },
    equipe: { um: 'pessoa', novo: '+ Pessoa da equipe', vazio: 'Ninguém da equipe ainda. Coloque nome, cargo e uma foto: aparece na página "Sobre" do site.' },
    bastidor: { um: 'foto', novo: '+ Foto de bastidor', vazio: 'Sem fotos de bastidor. Gravações, set, equipe em ação: aparecem na página "Sobre".' }
  };
  function pintarItens(cx, tipo) {
    const lista = itens.filter(i => i.tipo === tipo);
    const T = TIPO[tipo];
    const semCapa = lista.filter(x => !x.capa_url && /instagram\.com|youtu|drive\.google/i.test(x.video_url || '')).length;
    if (semCapa && !pintarItens.tentou) {
      pintarItens.tentou = true;
      puxarCapas({ todos: true }).then(f => { if (f && f.some(x => x.ok)) { pintar(); B7.UI.toast('Capas puxadas do Instagram/YouTube.'); } });
    }
    cx.innerHTML = '<div class="st-barra"><button class="b pri" id="st-novo">' + T.novo + '</button>' +
      ((tipo === 'video' || tipo === 'depoimento') && lista.some(x => /instagram\.com|youtu|drive\.google/i.test(x.video_url || '')) ? '<button class="b" id="st-capas">Atualizar capas</button>' : '') +
      (lista.length > 1 ? '<small>Use as setas para mudar a ordem no site.</small>' : '') + '</div>' +
      (lista.length ? '<div class="st-lista st-l-' + tipo + '">' + lista.map((i, k) => {
        const midia = i.capa_url ? '<img src="' + esc(i.capa_url) + '" alt="" loading="lazy">'
          : tipoLink(i.video_url) === 'Arquivo' ? '<video src="' + esc(i.video_url) + '#t=0.5" muted preload="metadata"></video>' : '';
        const titulo = tipo === 'cliente' ? (i.cliente_nome || i.titulo) : tipo === 'depoimento' ? (i.cliente_nome || 'Depoimento') : tipo === 'bastidor' ? (i.titulo || 'Bastidor') : i.titulo || i.cliente_nome || '(sem título)';
        const sub = tipo === 'video' ? [i.cliente_nome, i.categoria, tipoLink(i.video_url), i.visualizacoes ? i.visualizacoes + ' visualizações' : '', i.resultado || ''].filter(Boolean).join(' · ')
          : tipo === 'depoimento' ? (i.video_url ? 'Vídeo · ' + tipoLink(i.video_url) : '“' + String(i.texto || '').slice(0, 90) + (String(i.texto || '').length > 90 ? '…' : '') + '”')
          : tipo === 'servico' ? String(i.texto || '').slice(0, 110) : tipo === 'equipe' ? (i.texto || 'sem cargo') + (i.foto_perfil ? ' · foto do perfil' : i.capa_url ? '' : ' · sem foto')
          : tipo === 'bastidor' ? 'Foto' : i.capa_url ? 'com logo' : 'só o nome';
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
    const bc = cx.querySelector('#st-capas');
    if (bc) bc.onclick = async () => {
      bc.disabled = true; bc.textContent = 'Puxando…';
      const f = await puxarCapas({ refazer: true });
      if (!f) B7.UI.toast('Não foi possível puxar as capas agora.', { tipo: 'erro' });
      else { const okN = f.filter(x => x.ok).length, falha = f.filter(x => !x.ok);
        B7.UI.toast(okN + ' capa' + (okN === 1 ? '' : 's') + ' atualizada' + (okN === 1 ? '' : 's') + (falha.length ? '; ' + falha.length + ' sem capa (' + falha[0].motivo + ')' : '') + '.'); }
      pintar();
    };
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

  /* 4.39.0: cliente do vídeo/depoimento escolhido da lista do sistema (ou digitado) */
  function seletorCliente(atual) {
    const nomes = clientesB7.map(c => c.nome);
    const outro = !!atual && !nomes.includes(atual);
    return '<label class="rot" for="si-cli-sel">CLIENTE</label><select class="campo" id="si-cli-sel">' +
      '<option value="">Escolha o cliente</option>' + clientesB7.map(c => '<option value="' + esc(c.nome) + '"' + (c.nome === atual ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
      '<option value="__outro"' + (outro ? ' selected' : '') + '>Outro (digitar)…</option></select>' +
      '<input class="campo st-cli-outro" id="si-cli" maxlength="120" placeholder="Nome do cliente" value="' + esc(outro ? atual : (atual || '')) + '"' + (outro ? '' : ' hidden') + '>';
  }

  /* 4.39.0: capa automática dos vídeos de link (função site-capa) */
  async function puxarCapas(corpo) {
    try {
      const r = await sb().functions.invoke('site-capa', { body: corpo });
      if (r.error) throw r.error;
      const feitos = (r.data && r.data.feitos) || [];
      feitos.forEach(f => { if (f.ok) itens = itens.map(x => x.id === f.id ? { ...x, capa_url: f.capa_url } : x); });
      return feitos;
    } catch (e) { return null; }
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
      (tipo === 'equipe' ? '<label class="rot" for="si-perfil">PESSOA DO SISTEMA <span class="mg-obr leve">usa a foto de perfil dela</span></label>' +
        '<div class="st-pessoa"><span class="st-pessoa-av" id="si-perfil-av"></span><select class="campo" id="si-perfil"><option value="">Ninguém (vou enviar a foto)</option>' +
        pessoas.map(x => '<option value="' + esc(x.id) + '"' + (x.id === i.perfil_id ? ' selected' : '') + '>' + esc(x.nome) + (x.avatar_url ? '' : ' (sem foto no perfil)') + '</option>').join('') + '</select></div>' +
        '<div class="st-2"><div>' + campo('si-titulo', 'NOME', i.titulo, ' maxlength="140"') + '</div><div>' + campo('si-texto', 'CARGO', i.texto, ' maxlength="120" placeholder="Ex.: Filmmaker e editor"') + '</div></div>' +
        '<label class="check st-check" id="si-cargo-pf-l"><input type="checkbox" id="si-cargo-pf"' + (i.cargo_perfil ? ' checked' : '') + '><span>Cargo = as funções da pessoa no sistema (muda sozinho quando mudarem)</span></label>' +
        campo('si-arroba', '@ DO INSTAGRAM (opcional)', i.cliente_arroba ? String(i.cliente_arroba).replace(/^@/, '') : '', ' maxlength="60" placeholder="sem o @"') : '') +
      (tipo === 'bastidor' ? campo('si-titulo', 'LEGENDA (opcional)', i.titulo, ' maxlength="140" placeholder="Ex.: Gravação na Academia Força"') : '') +
      (tipo !== 'servico' && tipo !== 'equipe' && tipo !== 'bastidor' ? '<div class="st-2">' + '<div>' + (tipo === 'cliente' ? campo('si-cli', 'NOME DA MARCA', i.cliente_nome, ' maxlength="120"') : seletorCliente(i.cliente_nome)) + '</div>' +
        (tipo !== 'cliente' ? '<div>' + campo('si-arroba', '@ DO INSTAGRAM', i.cliente_arroba ? String(i.cliente_arroba).replace(/^@/, '') : '', ' maxlength="60" placeholder="sem o @"') + '</div>' : '') + '</div>' : '') +
      (tipo === 'video' ? '<div class="st-resultados"><b>Resultados <small>(aparecem no cartão do vídeo; deixe em branco o que não tiver)</small></b><div class="st-3">' +
          '<div>' + campo('si-views', 'VISUALIZAÇÕES', i.visualizacoes, ' maxlength="20" placeholder="Ex.: 120 mil"') + '</div>' +
          '<div>' + campo('si-likes', 'CURTIDAS', i.curtidas, ' maxlength="20" placeholder="Ex.: 8,2 mil"') + '</div>' +
          '<div>' + campo('si-coment', 'COMENTÁRIOS', i.comentarios, ' maxlength="20" placeholder="Ex.: 340"') + '</div></div>' +
          campo('si-result', 'RESULTADO PARA O CLIENTE', i.resultado, ' maxlength="140" placeholder="Ex.: +30 orçamentos na semana do vídeo"') + '</div>' : '') +
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
      (tipo !== 'servico' ? '<label class="rot" for="si-capa">' + (tipo === 'cliente' ? 'LOGO (PNG transparente, de preferência)' : tipo === 'equipe' ? 'OUTRA FOTO <span class="mg-obr leve">opcional; troca a do perfil</span>' : tipo === 'bastidor' ? 'FOTO' : 'CAPA <span class="mg-obr leve">opcional</span>') + '</label>' +
        (i.capa_url ? '<div class="st-capa-atual"><img src="' + esc(i.capa_url) + '" alt=""><label class="check"><input type="checkbox" id="si-tira-capa"><span>Tirar a imagem atual</span></label></div>' : '') +
        '<input class="campo" id="si-capa" type="file" accept="image/png,image/jpeg,image/webp">' +
        (tipo === 'video' ? '<div class="gv-ajuda">Link do Instagram ou do YouTube: a capa vem sozinha ao salvar. Envie uma imagem só se quiser outra capa.</div>' : '') : '') +
      (tipo === 'video' ? '<label class="check st-check"><input type="checkbox" id="si-dest"' + (i.destaque ? ' checked' : '') + '><span>Destaque: toca no fundo da abertura do site (precisa ser arquivo enviado)</span></label>' : '') +
      '<label class="check st-check"><input type="checkbox" id="si-pub"' + (i.publicado ? ' checked' : '') + '><span>Aparecer no site</span></label>';
    const m = B7.UI.modal('<div class="ng-topo"><span class="ng-ic">' + IC.globo + '</span><div><h3>' + (novo ? 'Novo ' : 'Editar ') + TIPO[tipo].um + '</h3><div class="sub">Aparece em branding7.com.br assim que você salvar.</div></div></div>' +
      '<section class="ng-bloco st-form">' + corpo + '</section>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Salvar</button></div>', { extra: 'ng-modal st-modal' });
    /* 4.46.2: equipe ligada ao perfil do sistema → foto de perfil */
    const selP = m.querySelector('#si-perfil');
    if (selP) {
      const mostra = () => {
        const x = pessoas.find(y => y.id === selP.value), av = m.querySelector('#si-perfil-av');
        av.innerHTML = x && x.avatar_url ? '<img src="' + esc(x.avatar_url) + '" alt="">' : esc(x ? (x.nome || '?').charAt(0) : '');
        av.hidden = !x;
      };
      const ck = m.querySelector('#si-cargo-pf'), cargo = m.querySelector('#si-texto');
      const sincCargo = () => {
        const x = pessoas.find(y => y.id === selP.value);
        m.querySelector('#si-cargo-pf-l').hidden = !x;
        const usa = !!x && ck.checked;
        cargo.readOnly = usa;
        if (usa) cargo.value = cargoDe(x) || cargo.value;
      };
      ck.onchange = sincCargo;
      selP.onchange = () => {
        const x = pessoas.find(y => y.id === selP.value), nome = m.querySelector('#si-titulo');
        if (x && nome && !nome.value.trim()) nome.value = x.nome || '';
        mostra(); sincCargo();
      };
      mostra(); sincCargo();
    }
    const sel = m.querySelector('#si-cli-sel');
    if (sel) sel.onchange = () => {
      const inp = m.querySelector('#si-cli'), o = sel.value === '__outro';
      inp.hidden = !o; inp.value = o ? '' : sel.value; if (o) inp.focus();
    };
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
      /* 4.40.0: cliente do sistema → o logo dele vira a foto de perfil no site */
      const selC = m.querySelector('#si-cli-sel');
      if (selC) { const c = clientesB7.find(x => x.nome === selC.value); d.avatar_url = c && c.logo_url ? c.logo_url : (selC.value === '__outro' ? null : (i.avatar_url || null)); }
      if (val('si-arroba') !== undefined) d.cliente_arroba = (val('si-arroba') || '').replace(/^@/, '') || null;
      if (val('si-cat') !== undefined) d.categoria = val('si-cat') || null;
      if (val('si-views') !== undefined) { d.visualizacoes = val('si-views') || null; d.curtidas = val('si-likes') || null; d.comentarios = val('si-coment') || null; d.resultado = val('si-result') || null; }
      const dest = m.querySelector('#si-dest'); if (dest) d.destaque = dest.checked;
      /* validação do que o site precisa para mostrar algo */
      if (tipo === 'servico' && !d.titulo) return B7.UI.toast('Dê um nome ao serviço.', { tipo: 'erro' });
      /* 4.40.0: vídeo e depoimento precisam do cliente (sem ele o nome sumia do site) */
      if (selC && !d.cliente_nome) return B7.UI.toast(selC.value === '__outro' ? 'Digite o nome do cliente.' : 'Escolha o cliente.', { tipo: 'erro' });
      if (tipo === 'cliente' && !d.cliente_nome) return B7.UI.toast('Coloque o nome da marca.', { tipo: 'erro' });
      if (tipo === 'equipe' && !d.titulo) return B7.UI.toast('Coloque o nome da pessoa.', { tipo: 'erro' });
      const capaArq = m.querySelector('#si-capa');
      if (tipo === 'bastidor' && !(capaArq && capaArq.files[0]) && !i.capa_url) return B7.UI.toast('Escolha a foto.', { tipo: 'erro' });
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
        if (selP) {
          const x = pessoas.find(y => y.id === selP.value);
          d.perfil_id = x ? x.id : null;
          const tira = m.querySelector('#si-tira-capa') && m.querySelector('#si-tira-capa').checked;
          d.foto_perfil = !!(x && !(capa && capa.files[0]) && !tira);
          d.cargo_perfil = !!(x && m.querySelector('#si-cargo-pf').checked);
          if (d.foto_perfil) d.capa_url = x.avatar_url || null;
        }
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
        const salvo = itens.find(x => x.id === (novo ? itens[itens.length - 1].id : i.id));
        if (salvo && !salvo.capa_url && /instagram\.com|youtu|drive\.google/i.test(salvo.video_url || '')) {
          const f = await puxarCapas({ id: salvo.id });
          if (f && f[0] && f[0].ok) { pintar(); B7.UI.toast('Capa puxada do ' + (/instagram/i.test(salvo.video_url) ? 'Instagram' : /drive/i.test(salvo.video_url) ? 'Google Drive' : 'YouTube') + '.'); }
          else if (f && f[0]) B7.UI.toast('Não deu para puxar a capa: ' + f[0].motivo + '. Você pode enviar uma imagem.', { tipo: 'aviso' });
        }
      } catch (e) {
        bt.disabled = false; bt.textContent = 'Salvar';
        B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' });
      }
    };
  }

  /* ---------------------------------------------------------- sobre nós (4.46.0)
     Página branding7.com.br/sobre: história, equipe e fotos de bastidor. */
  async function salvarCfg(extra) {
    const dados = Object.assign({}, cfg, extra);
    ok(await sb().from('site_config').update({ dados, atualizado_em: new Date().toISOString(), atualizado_por: (B7.Auth.usuario() || {}).id || null }).eq('id', 1));
    cfg = dados;
  }
  function pintarSobre(cx) {
    const c = cfg || {};
    cx.innerHTML = '<div class="st-pagina">' +
      '<section class="st-bloco"><h3>Nossa história</h3><p class="gv-ajuda">Aparece no topo da página <a href="' + SITE + 'sobre/" target="_blank" rel="noopener">branding7.com.br/sobre</a>. Deixe em branco para usar o texto padrão.</p>' +
        '<div class="st-campo"><label class="rot" for="ss-tit">TÍTULO</label><input class="campo" id="ss-tit" maxlength="90" value="' + esc(c.historia_titulo || '') + '" placeholder="A gente conta histórias que vendem."></div>' +
        '<div class="st-campo"><label class="rot" for="ss-txt">HISTÓRIA (pule uma linha entre os parágrafos)</label><textarea class="campo" id="ss-txt" rows="6" maxlength="3000" placeholder="Como a Branding7 começou, o que vocês acreditam, como trabalham…">' + esc(c.historia || '') + '</textarea></div>' +
        '<div class="st-campo"><label class="rot" for="ss-marcos">MARCOS (ano | o que aconteceu, um por linha; opcional)</label><textarea class="campo" id="ss-marcos" rows="4" placeholder="2021 | Primeiro vídeo para um cliente\n2023 | Estúdio próprio\n2025 | +40 marcas atendidas">' + esc((c.marcos || []).map(x => x.ano + ' | ' + x.tx).join('\n')) + '</textarea></div>' +
        '<div class="st-salvar"><button class="b pri" id="ss-salvar">Salvar a história</button></div></section>' +
      '<section class="st-bloco"><h3>Equipe</h3><div id="ss-equipe"></div></section>' +
      '<section class="st-bloco"><h3>Bastidores</h3><div id="ss-bast"></div></section></div>';
    pintarItens(cx.querySelector('#ss-equipe'), 'equipe');
    pintarItens(cx.querySelector('#ss-bast'), 'bastidor');
    cx.querySelector('#ss-salvar').onclick = async e => {
      const bt = e.currentTarget, v = id => cx.querySelector('#' + id).value.trim();
      bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        await salvarCfg({ historia_titulo: v('ss-tit'), historia: v('ss-txt'), marcos: pares(v('ss-marcos'), 10).map(([ano, tx]) => ({ ano, tx })) });
        B7.UI.toast('História salva. Já está no site.');
      } catch (er) { B7.UI.toast('Não foi possível salvar: ' + ((er && er.message) || ''), { tipo: 'erro' }); }
      bt.disabled = false; bt.textContent = 'Salvar a história';
    };
  }

  /* ---------------------------------------------------------- agenda (4.46.0)
     O visitante escolhe dia e horário no site. Os horários livres já
     descontam as reuniões marcadas e os compromissos da agenda do Google
     conectada ao sistema. */
  const DIAS_S = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [7, 'Dom']];
  const quandoReuniao = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '') + ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  };
  function pintarAgenda(cx) {
    const a = Object.assign({ ativo: false, dias: [1, 2, 3, 4, 5], inicio: '09:00', fim: '18:00', duracao: 30, antecedencia_h: 2, ate_dias: 14 }, cfg.agenda || {});
    const agora = new Date();
    const prox = reunioes.filter(r => new Date(r.fim) > agora || r.status === 'marcado').filter(r => r.status !== 'cancelado');
    const passadas = reunioes.filter(r => !prox.includes(r)).reverse().slice(0, 15);
    const linha = r => {
      const l = leads.find(x => x.id === r.lead_id) || {};
      const msg = 'Olá, ' + String(l.nome || '').split(' ')[0] + '! Aqui é da Branding7. Confirmando a nossa conversa ' + quandoReuniao(r.inicio) + '.';
      return '<div class="st-reu st-reu-' + esc(r.status) + '" data-reu="' + esc(r.id) + '"><div class="st-reu-q"><b>' + esc(quandoReuniao(r.inicio)) + '</b><small>' + esc(r.status === 'marcado' ? 'Marcada' : r.status === 'feito' ? 'Feita' : 'Cancelada') + '</small></div>' +
        '<div class="st-tx"><b>' + esc(l.nome || 'Contato apagado') + '</b><small>' + esc([l.empresa, l.interesse].filter(Boolean).join(' · ')) + '</small></div>' +
        (l.whatsapp ? '<a class="b fina st-zap" target="_blank" rel="noopener" href="https://wa.me/' + telLimpo(l.whatsapp) + '?text=' + encodeURIComponent(msg) + '">' + IC.zap + 'Confirmar</a>' : '') +
        (r.status === 'marcado' ? '<button class="b fina" data-reu-st="feito">Feita</button><button class="b fina contorno" data-reu-st="cancelado">Cancelar</button>' : '') + '</div>';
    };
    cx.innerHTML = '<div class="st-pagina">' +
      '<section class="st-bloco"><h3>Próximas reuniões</h3>' + (prox.length ? '<div class="st-reus">' + prox.map(linha).join('') + '</div>'
        : '<p class="gv-ajuda">Nenhuma reunião marcada. Quando alguém escolher um horário no site, aparece aqui, em Contatos e no sino.</p>') + '</section>' +
      '<section class="st-bloco"><h3>Horários que o site oferece</h3>' +
        '<label class="check st-check"><input type="checkbox" id="sa-ativo"' + (a.ativo ? ' checked' : '') + '><span>Deixar o visitante marcar reunião pelo site</span></label>' +
        '<label class="rot">DIAS DA SEMANA</label><div class="st-secoes">' + DIAS_S.map(([k, r]) => '<label class="check"><input type="checkbox" data-dia="' + k + '"' + (a.dias.includes(k) ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>' +
        '<div class="st-3"><div class="st-campo"><label class="rot" for="sa-ini">COMEÇA</label><input class="campo" type="time" id="sa-ini" value="' + esc(a.inicio) + '"></div>' +
          '<div class="st-campo"><label class="rot" for="sa-fim">TERMINA</label><input class="campo" type="time" id="sa-fim" value="' + esc(a.fim) + '"></div>' +
          '<div class="st-campo"><label class="rot" for="sa-dur">DURAÇÃO</label><select class="campo" id="sa-dur">' + [15, 20, 30, 45, 60, 90].map(m => '<option value="' + m + '"' + (+a.duracao === m ? ' selected' : '') + '>' + m + ' min</option>').join('') + '</select></div></div>' +
        '<div class="st-2"><div class="st-campo"><label class="rot" for="sa-ant">ANTECEDÊNCIA MÍNIMA</label><select class="campo" id="sa-ant">' + [[1, '1 hora'], [2, '2 horas'], [4, '4 horas'], [12, '12 horas'], [24, '1 dia'], [48, '2 dias']].map(([v, r]) => '<option value="' + v + '"' + (+a.antecedencia_h === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
          '<div class="st-campo"><label class="rot" for="sa-ate">MOSTRAR ATÉ</label><select class="campo" id="sa-ate">' + [[7, '1 semana à frente'], [14, '2 semanas à frente'], [21, '3 semanas à frente'], [30, '1 mês à frente']].map(([v, r]) => '<option value="' + v + '"' + (+a.ate_dias === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div></div>' +
        '<p class="gv-ajuda">Os compromissos da agenda do Google conectada ao sistema somem dos horários livres sozinhos. O site nunca mostra o que tem na agenda, só os horários.</p>' +
        '<div class="st-salvar"><button class="b pri" id="sa-salvar">Salvar horários</button></div></section>' +
      (passadas.length ? '<section class="st-bloco"><h3>Anteriores</h3><div class="st-reus">' + passadas.map(linha).join('') + '</div></section>' : '') + '</div>';
    cx.querySelectorAll('[data-reu]').forEach(el => el.querySelectorAll('[data-reu-st]').forEach(b => b.onclick = async () => {
      const st = b.dataset.reuSt, r = reunioes.find(x => x.id === el.dataset.reu);
      if (st === 'cancelado' && !(await B7.UI.confirmar({ titulo: 'Cancelar esta reunião?', texto: 'O horário volta a ficar livre no site. Avise a pessoa pelo WhatsApp.', rotulo: 'Cancelar reunião', perigo: true }))) return;
      try { ok(await sb().from('site_agendamentos').update({ status: st, atualizado_em: new Date().toISOString() }).eq('id', r.id)); r.status = st; pintar(); }
      catch (er) { B7.UI.toast('Não foi possível salvar.', { tipo: 'erro' }); }
    }));
    cx.querySelector('#sa-salvar').onclick = async e => {
      const bt = e.currentTarget, v = id => cx.querySelector('#' + id).value;
      const dias = [...cx.querySelectorAll('[data-dia]')].filter(x => x.checked).map(x => +x.dataset.dia);
      if (!dias.length) return B7.UI.toast('Marque pelo menos um dia.', { tipo: 'erro' });
      if (!v('sa-ini') || !v('sa-fim') || v('sa-fim') <= v('sa-ini')) return B7.UI.toast('O horário de término precisa ser depois do início.', { tipo: 'erro' });
      bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        await salvarCfg({ agenda: { ativo: cx.querySelector('#sa-ativo').checked, dias, inicio: v('sa-ini'), fim: v('sa-fim'), duracao: +v('sa-dur'), antecedencia_h: +v('sa-ant'), ate_dias: +v('sa-ate') } });
        B7.UI.toast('Horários salvos. Já valem no site.');
      } catch (er) { B7.UI.toast('Não foi possível salvar: ' + ((er && er.message) || ''), { tipo: 'erro' }); }
      bt.disabled = false; bt.textContent = 'Salvar horários';
    };
  }

  /* ---------------------------------------------------------- página */
  const SECOES = [['sobre', 'Sobre'], ['trabalhos', 'Vídeos (projetos)'], ['processo', 'Processo (câmera 3D)'], ['servicos', 'Serviços'],
    ['depoimentos', 'Depoimentos'], ['clientes', 'Marcas que confiam'], ['regioes', 'Regiões'], ['faq', 'Perguntas frequentes']];
  /* textos padrão do site (branding7-site/components/Site.jsx) — aparecem como dica */
  const PAD = {
    fita: 'VENDER, VIRALIZAR, PERFORMAR, ROTEIRO, GRAVAÇÃO, EDIÇÃO, CRIATIVOS, ANÚNCIOS',
    manifesto: 'PRENDA A ATENÇÃO.\nCONTE A SUA HISTÓRIA.\nFAÇA VENDER.',
    notas: 'Os primeiros 3 segundos decidem se a pessoa fica.\nVídeo bom é o que traz cliente, não só curtida.',
    sobre_titulo: 'Muito além de gravar um vídeo.',
    sobre_texto: 'Na Branding7, cada vídeo nasce de uma estratégia...\n\nO resultado é conteúdo que a sua marca tem orgulho de postar...',
    cta: 'Quero vídeos assim',
    passos: 'Diagnóstico | Entendemos o seu negócio...\nRoteiro | Ganchos, falas e cenas...\nGravação | ...\nEdição | ...\nPublicação | ...\nPerformance | ...',
    faq: 'Vocês gravam na minha cidade? | ...\nEu preciso saber falar na câmera? | ...'
  };
  const pares = (t, max) => t.split('\n').map(x => x.split('|')).filter(p => p[0] && p[0].trim() && p[1] && p[1].trim())
    .slice(0, max).map(p => [p[0].trim(), p.slice(1).join('|').trim()]);
  function pintarPagina(cx) {
    const c = cfg || {};
    const linhas = a => (Array.isArray(a) ? a : []).join('\n');
    const nums = (Array.isArray(c.numeros) ? c.numeros : []).map(n => (n.valor || '') + ' | ' + (n.rotulo || '')).join('\n');
    const sec = c.secoes || {};
    const ta = (id, rot, val, rows, ph) => '<div class="st-campo"><label class="rot" for="' + id + '">' + rot + '</label><textarea class="campo" id="' + id + '" rows="' + rows + '" placeholder="' + esc(ph || '') + '">' + esc(val || '') + '</textarea></div>';
    const g = (id, rot, val, ajuda, extra) => '<div class="st-campo"><label class="rot" for="' + id + '">' + rot + '</label><input class="campo" id="' + id + '" value="' + esc(val || '') + '"' + (extra || '') + '>' + (ajuda ? '<div class="gv-ajuda">' + ajuda + '</div>' : '') + '</div>';
    cx.innerHTML = '<div class="st-pagina">' +
      '<section class="st-bloco"><h3>Abertura</h3>' +
        g('sp-palavras', 'PALAVRAS QUE GIRAM NO TÍTULO', (c.palavras || ['vender', 'viralizar', 'performar']).join(', '), '“O vídeo que faz você ___.” Separe por vírgula.') +
        '<div class="st-campo"><label class="rot" for="sp-sub">FRASE ABAIXO DO TÍTULO</label><textarea class="campo" id="sp-sub" rows="2" maxlength="240">' + esc(c.subtitulo || '') + '</textarea></div></section>' +
      '<section class="st-bloco"><h3>Seções do site</h3><p class="gv-ajuda">Desmarque para esconder uma parte inteira do site.</p><div class="st-secoes">' +
        SECOES.map(([k, r]) => '<label class="check"><input type="checkbox" data-secao="' + k + '"' + (sec[k] === false ? '' : ' checked') + '><span>' + r + '</span></label>').join('') + '</div></section>' +
      '<section class="st-bloco"><h3>Textos</h3><p class="gv-ajuda">Deixe em branco para usar o texto padrão (aparece apagado no campo).</p>' +
        g('sp-fita', 'FAIXA DE PALAVRAS (separe por vírgula)', (c.fita || []).join(', '), '', ' placeholder="' + esc(PAD.fita) + '"') +
        ta('sp-manif', 'MANIFESTO (uma frase por linha; a última fica com o degradê)', linhas(c.manifesto), 3, PAD.manifesto) +
        ta('sp-notas', 'FRASES SOLTAS DO MANIFESTO (até 2, uma por linha)', linhas(c.notas), 2, PAD.notas) +
        g('sp-sobre-tit', 'TÍTULO DO "SOBRE"', c.sobre_titulo, '', ' maxlength="90" placeholder="' + esc(PAD.sobre_titulo) + '"') +
        ta('sp-sobre', 'TEXTO DO "SOBRE" (pule uma linha entre os parágrafos)', c.sobre_texto, 4, PAD.sobre_texto) +
        g('sp-cta', 'TEXTO DO BOTÃO PRINCIPAL', c.cta, '', ' maxlength="40" placeholder="' + esc(PAD.cta) + '"') +
        ta('sp-passos', 'PASSOS DO PROCESSO (Título | descrição, até 6)', (c.passos || []).map(x => x.t + ' | ' + x.d).join('\n'), 6, PAD.passos) +
        ta('sp-faq', 'PERGUNTAS FREQUENTES (Pergunta | resposta, uma por linha)', (c.faq || []).map(x => x.p + ' | ' + x.r).join('\n'), 6, PAD.faq) +
      '</section>' +
      '<section class="st-bloco"><h3>Contato</h3><div class="st-2">' +
        g('sp-wpp', 'WHATSAPP (com DDD)', c.whatsapp, 'É para onde vão o botão verde e o formulário.', ' inputmode="tel"') +
        g('sp-insta', 'INSTAGRAM', c.instagram, 'Sem o @.') + '</div><div class="st-2">' +
        g('sp-nome', 'NOME DE QUEM ATENDE', c.whatsapp_nome) + g('sp-cargo', 'CARGO', c.whatsapp_cargo) + '</div>' +
        ta('sp-interesses', 'OPÇÕES DE "O QUE VOCÊ PRECISA?" NO FORMULÁRIO (uma por linha)', linhas(c.interesses), 5, 'Vídeos para Reels e TikTok\nCriativos para anúncios\nGravação e edição\nCasamento\nEvento\nVídeo institucional\nGestão de redes sociais\nAinda não sei, quero conversar') +
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
        pixel_meta: v('sp-pixel').replace(/\D/g, ''), ga4: ga.toUpperCase(),
        secoes: Object.fromEntries([...cx.querySelectorAll('[data-secao]')].map(i => [i.dataset.secao, i.checked])),
        fita: v('sp-fita').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12),
        manifesto: v('sp-manif').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 4),
        notas: v('sp-notas').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 2),
        sobre_titulo: v('sp-sobre-tit'), sobre_texto: v('sp-sobre'), cta: v('sp-cta'),
        passos: pares(v('sp-passos'), 6).map(([t, d]) => ({ t, d })),
        faq: pares(v('sp-faq'), 12).map(([p, r]) => ({ p, r })),
        interesses: v('sp-interesses').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15)
      });
      const bt = cx.querySelector('#sp-salvar'); bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        ok(await sb().from('site_config').update({ dados, atualizado_em: new Date().toISOString(), atualizado_por: (B7.Auth.usuario() || {}).id || null }).eq('id', 1));
        cfg = dados; B7.UI.toast('Página salva. Já está no site.');
      } catch (e) { B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || ''), { tipo: 'erro' }); }
      bt.disabled = false; bt.textContent = 'Salvar a página';
    };
  }

  /* ---------------------------------------------------------- clientes (4.37.0)
     Os clientes do sistema (com o logo que já está cadastrado) entram na
     faixa "Marcas que confiam" com um toque. Embaixo, marcas avulsas. */
  function pintarClientes(cx) {
    const noSite = clientesB7.filter(c => c.no_site).length;
    cx.innerHTML = '<section class="st-bloco st-cli-b7"><div class="st-cli-cab"><div><h3>Clientes do sistema</h3>' +
        '<p class="gv-ajuda">Toque para ligar ou desligar quem aparece no site. O logo é o mesmo do cadastro do cliente.</p></div>' +
        '<span class="st-chip">' + noSite + ' no site</span></div>' +
      (clientesB7.length ? '<div class="st-cli-grade">' + clientesB7.map(c =>
        '<button type="button" class="st-cli' + (c.no_site ? ' on' : '') + '" data-cli="' + esc(c.id) + '" aria-pressed="' + !!c.no_site + '">' +
          '<span class="st-cli-logo">' + (c.logo_url ? '<img src="' + esc(c.logo_url) + '" alt="" loading="lazy">' : '<b>' + esc(String(c.nome || '?').charAt(0)) + '</b>') + '</span>' +
          '<span class="st-cli-nome">' + esc(c.nome) + '</span>' +
          '<span class="st-cli-chave" aria-hidden="true"></span>' +
          (c.logo_url ? '' : '<small>sem logo: aparece o nome</small>') +
        '</button>').join('') + '</div>' : '<p class="gv-ajuda">Nenhum cliente cadastrado.</p>') +
      '</section><section class="st-bloco"><h3>Outras marcas</h3><p class="gv-ajuda">Marcas que não estão no sistema (ex.: trabalhos antigos).</p><div id="st-cli-extra"></div></section>';
    cx.querySelectorAll('[data-cli]').forEach(b => b.onclick = async () => {
      const c = clientesB7.find(x => x.id === b.dataset.cli); if (!c) return;
      const v = !c.no_site; c.no_site = v; b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v));
      try { ok(await sb().from('clientes').update({ no_site: v }).eq('id', c.id)); contadores(); const ch = cx.querySelector('.st-cli-b7 .st-chip'); if (ch) ch.textContent = clientesB7.filter(x => x.no_site).length + ' no site'; }
      catch (e) { c.no_site = !v; b.classList.toggle('on', !v); B7.UI.toast('Não foi possível salvar.', { tipo: 'erro' }); }
    });
    pintarItens(cx.querySelector('#st-cli-extra'), 'cliente');
  }

  /* ---------------------------------------------------------- métricas (4.37.0) */
  const FUNIL = [['visitantes', 'Visitaram o site'], ['engajaram', 'Rolaram ou viram vídeo'], ['clicaram_contato', 'Clicaram para falar'], ['viraram_lead', 'Mandaram o formulário']];
  const API_URL = 'https://rartcafydsaocdzshqcx.supabase.co/functions/v1/site-api';
  async function pintarMetricas(cx) {
    cx.innerHTML = '<div class="st-met-topo"><div class="st-fonte st-dias">' + [7, 30, 90].map(d => '<button type="button" data-dias="' + d + '"' + (d === dias ? ' class="on"' : '') + '>' + d + ' dias</button>').join('') + '</div></div>' +
      '<div id="st-met">' + B7.UI.skeleton('cards', { n: 4 }) + '</div><div id="st-api"></div>';
    cx.querySelectorAll('[data-dias]').forEach(b => b.onclick = () => { dias = +b.dataset.dias; pintarMetricas(cx); });
    pintarApi(cx.querySelector('#st-api'));
    let m;
    try { m = ok(await sb().rpc('site_metricas', { p_dias: dias })); }
    catch (e) { const el = cx.querySelector('#st-met'); if (el) el.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as métricas.</div>'; return; }
    const el = cx.querySelector('#st-met'); if (!el || aba !== 'metricas') return;
    const f = m.funil || {}, topo = Math.max(1, f.visitantes || 0);
    const pc = (a, b) => b ? Math.round(a * 100 / b) + '%' : '—';
    const dia = m.por_dia || [], maxD = Math.max(1, ...dia.map(d => d.visitantes));
    const tabela = (lista, chave, rot) => lista && lista.length ? '<table class="st-tab"><thead><tr><th>' + rot + '</th><th>Visitantes</th><th>Contatos</th><th>Conversão</th></tr></thead><tbody>' +
      lista.slice(0, 12).map(o => '<tr><td>' + esc(o[chave]) + '</td><td>' + o.visitantes + '</td><td>' + o.leads + '</td><td>' + pc(o.leads, o.visitantes) + '</td></tr>').join('') + '</tbody></table>'
      : '<p class="gv-ajuda">Ainda sem dados.</p>';
    const disp = m.dispositivos || {}, totD = Object.values(disp).reduce((a, b) => a + b, 0);
    el.innerHTML = '<section class="st-bloco"><h3>Funil do site</h3><div class="st-funil">' + FUNIL.map(([k, r], n) => {
        const v = f[k] || 0;
        return '<div class="st-f"><div class="st-f-barra" style="--w:' + Math.max(3, v * 100 / topo).toFixed(1) + '%"></div><b>' + v + '</b><span>' + r + '</span>' +
          (n ? '<small>' + pc(v, f[FUNIL[n - 1][0]] || 0) + ' da etapa anterior</small>' : '<small>pessoas diferentes</small>') + '</div>';
      }).join('') + '</div>' +
      '<div class="st-cliques"><span>WhatsApp <b>' + ((m.cliques || {}).whatsapp || 0) + '</b></span><span>Formulário aberto <b>' + ((m.cliques || {}).formulario || 0) + '</b></span>' +
        '<span>Instagram <b>' + ((m.cliques || {}).instagram || 0) + '</b></span><span>Vídeos assistidos <b>' + ((m.cliques || {}).videos || 0) + '</b></span>' +
        '<span>Contatos no período <b>' + ((m.leads || {}).total || 0) + '</b></span></div></section>' +
      '<section class="st-bloco"><h3>Visitantes por dia</h3>' + (dia.length ? '<div class="st-dias-graf">' + dia.map(d =>
        '<div title="' + esc(B7.UI.dataBR ? B7.UI.dataBR(d.dia) : d.dia) + ': ' + d.visitantes + ' visitantes, ' + d.leads + ' contatos"><i style="--h:' + Math.max(4, d.visitantes * 100 / maxD).toFixed(1) + '%"></i>' + (d.leads ? '<em></em>' : '') + '</div>').join('') + '</div>'
        : '<p class="gv-ajuda">Os números começam a aparecer conforme as pessoas visitam o site.</p>') + '</section>' +
      '<div class="st-2"><section class="st-bloco"><h3>De onde vieram</h3>' + tabela(m.origens, 'origem', 'Origem') + '</section>' +
        '<section class="st-bloco"><h3>Campanhas (UTM)</h3>' + tabela(m.campanhas, 'campanha', 'Campanha') +
        '<p class="gv-ajuda">Nos anúncios, use links com ?utm_source=meta&amp;utm_campaign=nome-da-campanha para ver cada uma aqui.</p></section></div>' +
      '<section class="st-bloco"><h3>Aparelho</h3><div class="st-cliques">' + (totD ? Object.entries(disp).map(([k, v]) => '<span>' + esc(k) + ' <b>' + pc(v, totD) + '</b></span>').join('') : '<span>Sem dados ainda</span>') + '</div>' +
        '<p class="gv-ajuda">Contagem própria do site (sem cookies e sem dado pessoal). Os números do Google Analytics e do Pixel da Meta continuam nos painéis deles.</p></section>';
  }

  async function pintarApi(el) {
    if (!el) return;
    const r = await sb().from('site_api_chaves').select('id, nome, prefixo, created_at, ultimo_uso, usos, revogada_em').order('created_at', { ascending: false });
    const lista = (r.data || []).filter(k => !k.revogada_em);
    el.innerHTML = '<section class="st-bloco"><div class="st-cli-cab"><div><h3>API para outras ferramentas</h3>' +
      '<p class="gv-ajuda">Para a IA do comercial (ou qualquer sistema) ler o funil, as origens e os contatos do site. Só leitura.</p></div>' +
      '<button class="b" id="st-api-nova">+ Gerar chave</button></div>' +
      (lista.length ? '<div class="st-lista">' + lista.map(k => '<div class="st-item"><div class="st-tx"><b>' + esc(k.nome) + '</b><small>' + esc(k.prefixo) + '… · criada ' +
        esc(B7.UI.quando(k.created_at)) + (k.ultimo_uso ? ' · último uso ' + esc(B7.UI.quando(k.ultimo_uso)) + ' (' + k.usos + ')' : ' · nunca usada') + '</small></div>' +
        '<button class="b fina perigo" data-revogar="' + esc(k.id) + '">Revogar</button></div>').join('') + '</div>' : '<p class="gv-ajuda">Nenhuma chave ativa.</p>') +
      '<details class="st-doc"><summary>Como usar</summary><pre>GET ' + API_URL + '?recurso=tudo&amp;dias=30\nAuthorization: Bearer SUA_CHAVE</pre>' +
      '<p class="gv-ajuda"><b>recurso</b>: metricas (funil, origens, campanhas, visitantes por dia, aparelhos), leads (contatos do formulário, aceita &amp;status=novo) ou tudo. <b>dias</b>: 1 a 365. A resposta é JSON.</p></details></section>';
    el.querySelector('#st-api-nova').onclick = async () => {
      const nome = await B7.UI.perguntar({ titulo: 'Nova chave de API', rotulo: 'Para quem é?', placeholder: 'Ex.: IA do Gabriel', confirmar: 'Gerar' });
      if (!nome) return;
      try {
        const chave = ok(await sb().rpc('site_api_chave_criar', { p_nome: nome }));
        const m = B7.UI.modal('<h3>Chave criada</h3><div class="sub">Copie agora: por segurança ela não aparece de novo. Se perder, gere outra e revogue esta.</div>' +
          '<div class="st-chave"><code>' + esc(chave) + '</code></div>' +
          '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-copiar>Copiar chave</button></div>', { extra: 'st-modal' });
        m.querySelector('[data-copiar]').onclick = () => B7.UI.copiarTexto(chave, { msgSucesso: 'Chave copiada.', msgErro: 'Não foi possível copiar. Selecione e copie à mão.' });
        pintarApi(el);
      } catch (e) { B7.UI.toast('Não foi possível gerar a chave.', { tipo: 'erro' }); }
    };
    el.querySelectorAll('[data-revogar]').forEach(b => b.onclick = async () => {
      if (!(await B7.UI.confirmar({ titulo: 'Revogar esta chave?', texto: 'Quem usa ela para de ler os números do site na hora.', rotulo: 'Revogar', perigo: true }))) return;
      try { ok(await sb().rpc('site_api_chave_revogar', { p_id: b.dataset.revogar })); pintarApi(el); B7.UI.toast('Chave revogada.'); }
      catch (e) { B7.UI.toast('Não foi possível revogar.', { tipo: 'erro' }); }
    });
  }

  return { abrir };
})();
