/* =====================================================================
   SUPORTE E FEEDBACK (zzz208) — #/suporte

   A equipe relata um problema, manda uma sugestão, tira uma dúvida ou
   elogia, sem sair do sistema. O chamado leva, sozinho, o que ajuda a
   resolver: a tela em que a pessoa estava, a versão, o aparelho e os
   últimos erros (dá para desmarcar). Print: colar (Ctrl+V), arrastar ou
   escolher.

   Quem abre vê só os seus. Admin e coordenação veem todos, respondem
   (ou deixam nota interna) e mudam o andamento; quem abriu recebe aviso
   no sino a cada resposta e a cada mudança.

   Banco: migration_suporte.sql — suporte_chamados, suporte_mensagens e a
   pasta privada "suporte". Toda escrita passa pelas funções do banco.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Suporte = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const painel = () => document.getElementById('painel-dashboard');
  const BUCKET = 'suporte';
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const eu = () => { const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario(); return u ? u.id : null; };
  const equipe = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());

  const TIPOS = {
    bug: { rot: 'Problema', plural: 'Problemas', dica: 'Algo não funciona ou apareceu errado',
      titulo: 'Ex.: o botão Salvar não responde na linha editorial', desc: 'O que você estava fazendo, o que esperava que acontecesse e o que aconteceu de verdade.' },
    sugestao: { rot: 'Sugestão', plural: 'Sugestões', dica: 'Uma ideia para melhorar',
      titulo: 'Ex.: avisar quando o cliente responder no WhatsApp', desc: 'Conte a ideia e em que situação ela ajudaria o seu dia.' },
    duvida: { rot: 'Dúvida', plural: 'Dúvidas', dica: 'Não sei como fazer algo',
      titulo: 'Ex.: como marco uma gravação como remarcada?', desc: 'Diga o que você quer fazer e onde travou.' },
    elogio: { rot: 'Elogio', plural: 'Elogios', dica: 'Algo que ficou bom',
      titulo: 'Ex.: a preparação da gravação ajudou muito', desc: 'Conte o que funcionou bem (ajuda a gente a saber o que manter).' }
  };
  const STATUS = {
    novo: 'Novo', em_analise: 'Em análise', em_andamento: 'Em andamento', resolvido: 'Resolvido', nao_vamos_fazer: 'Não será feito'
  };
  const ABERTOS = ['novo', 'em_analise', 'em_andamento'];
  const PRIO = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

  /* ---- últimos erros da tela (só texto, ficam na memória; vão no chamado se a pessoa deixar) ---- */
  const erros = [];
  const guardarErro = msg => { erros.push({ msg: String(msg || '').slice(0, 220), em: new Date().toISOString() }); if (erros.length > 8) erros.shift(); };
  window.addEventListener('error', e => guardarErro((e && e.message) || 'erro'));
  window.addEventListener('unhandledrejection', e => guardarErro('promessa: ' + ((e && e.reason && (e.reason.message || e.reason)) || 'rejeitada')));

  function plataforma() {
    const ua = navigator.userAgent || '';
    if (/Electron\//.test(ua)) return 'Programa de Windows';
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return 'App de celular';
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'App instalado pelo navegador';
    return 'Navegador';
  }
  function contexto() {
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    let rastro = [];
    try { rastro = (B7.Auth.rastro ? B7.Auth.rastro() : []).slice(-10); } catch (e) {}
    return {
      versao: (B7.Auth && B7.Auth.VERSAO) || '',
      tela: String(location.hash || '#/').split('?')[0],
      plataforma: plataforma(),
      navegador: (navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 160),
      janela: window.innerWidth + '×' + window.innerHeight,
      papel: (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || (u && u.papel) || '',
      online: navigator.onLine,
      erros: erros.slice(),
      rastro
    };
  }
  const contextoTexto = c => [
    'Tela: ' + c.tela, 'Versão: ' + c.versao, 'Onde: ' + c.plataforma + ' · janela ' + c.janela,
    c.erros && c.erros.length ? 'Erros recentes: ' + c.erros.length : 'Sem erros recentes na tela'
  ].join('\n');

  /* ---- imagem: reduz e vira JPEG (print de tela grande pesa) ---- */
  function reduzir(arquivo) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = () => {
        const max = 1600, f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res({ blob: b, url: '' }) : rej(new Error('imagem')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui ler essa imagem.')); };
      img.src = url;
    });
  }

  /* ======================================================== novo chamado */
  function novo(tipoInicial, pre) {
    pre = pre || {};
    let tipo = TIPOS[tipoInicial] ? tipoInicial : 'bug';
    const imagens = [];                         /* { blob, mini } */
    const ctx = contexto();
    const m = B7.UI.modal('<h3>Suporte e feedback</h3>' +
      '<p class="sub">Conte o que aconteceu ou o que você quer. A equipe responde por aqui e você recebe um aviso no sino.</p>' +
      '<div class="sp-tipos" role="group" aria-label="Tipo">' +
        Object.keys(TIPOS).map(k => '<button type="button" class="sp-tipo" data-tipo="' + k + '"><b>' + TIPOS[k].rot + '</b><small>' + TIPOS[k].dica + '</small></button>').join('') + '</div>' +
      '<div class="mb"><label class="rot" for="sp-tit">RESUMO</label><input class="campo" id="sp-tit" maxlength="140" data-foco value="' + esc(pre.titulo || '') + '"></div>' +
      '<div class="sp-sug" id="sp-sug" hidden></div>' +
      '<div class="mb"><label class="rot" for="sp-desc">DETALHES <span class="leve">— quanto mais, mais rápido a gente resolve</span></label><textarea class="campo" id="sp-desc" rows="5" maxlength="4000">' + esc(pre.descricao || '') + '</textarea></div>' +
      '<label class="sp-urg" id="sp-urg"><input type="checkbox" id="sp-urg-c"> Está me impedindo de trabalhar</label>' +
      '<div class="mb"><label class="rot">PRINT <span class="leve">— opcional</span></label>' +
        '<div class="sp-solta" id="sp-solta" tabindex="0"><span>Cole um print aqui (<kbd>Ctrl</kbd>+<kbd>V</kbd>), arraste ou <button type="button" class="adm-link" id="sp-escolher">escolha um arquivo</button></span>' +
        '<small>Dica: <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> tira print de uma parte da tela.</small></div>' +
        '<input type="file" id="sp-arq" accept="image/*" multiple hidden><div class="sp-minis" id="sp-minis"></div></div>' +
      '<label class="sp-info"><input type="checkbox" id="sp-info-c" checked> Enviar junto as informações da tela <button type="button" class="adm-link" id="sp-info-ver">ver o que vai</button></label>' +
      '<pre class="sp-info-tx" id="sp-info-tx" hidden>' + esc(contextoTexto(ctx)) + '</pre>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="sp-enviar">Enviar</button></div>', { larga: true });
    const q = s => m.querySelector(s);
    const pintarTipo = () => {
      m.querySelectorAll('[data-tipo]').forEach(b => b.classList.toggle('on', b.dataset.tipo === tipo));
      q('#sp-tit').placeholder = TIPOS[tipo].titulo; q('#sp-desc').placeholder = TIPOS[tipo].desc;
      q('#sp-urg').hidden = tipo !== 'bug';
    };
    /* zzz210: enquanto a pessoa escreve, mostra tutoriais que talvez resolvam (dúvida e problema) */
    let relSug = null;
    const sugerir = () => {
      const cx = q('#sp-sug'), t = q('#sp-tit').value.trim();
      const r = (tipo === 'duvida' || tipo === 'bug') && t.length >= 4 && B7.Ajuda && B7.Ajuda.procurar ? B7.Ajuda.procurar(t).slice(0, 3) : [];
      cx.hidden = !r.length;
      cx.innerHTML = r.length ? '<b>Talvez um tutorial resolva:</b>' + r.map(x => '<a href="#/ajuda/' + esc(x.i.id) + '" data-tut><span>' + esc(x.i.titulo) + '</span><small>' + esc(x.i.grupo) + '</small></a>').join('') : '';
      cx.querySelectorAll('[data-tut]').forEach(a => a.onclick = () => m.fechar());
    };
    q('#sp-tit').addEventListener('input', () => { clearTimeout(relSug); relSug = setTimeout(sugerir, 250); });
    m.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { tipo = b.dataset.tipo; pintarTipo(); sugerir(); });
    pintarTipo(); sugerir();
    q('#sp-info-ver').onclick = () => { const p = q('#sp-info-tx'); p.hidden = !p.hidden; };

    const pintarMinis = () => {
      q('#sp-minis').innerHTML = imagens.map((x, i) => '<span class="sp-mini"><img alt="Print ' + (i + 1) + '" src="' + esc(x.mini) + '"><button type="button" data-tirar="' + i + '" aria-label="Tirar este print">×</button></span>').join('');
      q('#sp-minis').querySelectorAll('[data-tirar]').forEach(b => b.onclick = () => { imagens.splice(+b.dataset.tirar, 1); pintarMinis(); });
    };
    const adicionar = async arquivos => {
      for (const a of arquivos) {
        if (!/^image\//.test(a.type)) continue;
        if (imagens.length >= 3) { B7.UI.toast('Até 3 prints por chamado.', { tipo: 'erro' }); break; }
        try { const r = await reduzir(a); imagens.push({ blob: r.blob, mini: r.url || URL.createObjectURL(r.blob) }); pintarMinis(); }
        catch (e) { B7.UI.toast((e && e.message) || 'Não consegui ler essa imagem.', { tipo: 'erro' }); }
      }
    };
    const arq = q('#sp-arq');
    q('#sp-escolher').onclick = () => arq.click();
    arq.onchange = () => { adicionar([...arq.files]); arq.value = ''; };
    const solta = q('#sp-solta');
    solta.addEventListener('dragover', e => { e.preventDefault(); solta.classList.add('sobre'); });
    solta.addEventListener('dragleave', () => solta.classList.remove('sobre'));
    solta.addEventListener('drop', e => { e.preventDefault(); solta.classList.remove('sobre'); adicionar([...(e.dataTransfer.files || [])]); });
    m.addEventListener('paste', e => {
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type));
      if (fs.length) { e.preventDefault(); adicionar(fs); }
    });

    q('#sp-enviar').onclick = async () => {
      const titulo = q('#sp-tit').value.trim(), desc = q('#sp-desc').value.trim();
      if (titulo.length < 3) { q('#sp-tit').classList.add('erro'); q('#sp-tit').focus(); return B7.UI.toast('Escreva um resumo (pelo menos 3 letras).', { tipo: 'erro' }); }
      const bt = q('#sp-enviar'); bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        const id = await B7.DB.rpc('suporte_criar', { p_tipo: tipo, p_titulo: titulo, p_descricao: desc, p_urgente: tipo === 'bug' && q('#sp-urg-c').checked,
          p_contexto: q('#sp-info-c').checked ? ctx : { tela: ctx.tela, versao: ctx.versao } });
        const paths = [];
        for (const im of imagens) {
          const caminho = id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString(16).slice(2)) + '.jpg';
          const r = await sb().storage.from(BUCKET).upload(caminho, im.blob, { contentType: 'image/jpeg', upsert: false });
          if (!r.error) paths.push(caminho);
        }
        if (paths.length) await B7.DB.rpc('suporte_anexar', { p_id: id, p_paths: paths });
        m.fechar();
        B7.UI.toast(imagens.length && paths.length < imagens.length ? 'Chamado enviado, mas algum print não subiu.' : 'Chamado enviado. A equipe responde por aqui.');
        if (/^#\/suporte/.test(location.hash)) abrir(id); else location.hash = '#/suporte/' + id;
      } catch (e) {
        bt.disabled = false; bt.textContent = 'Enviar';
        B7.UI.toast('Não foi possível enviar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' });
      }
    };
  }

  /* ============================================================== tela
     zzz210: números no alto, busca, "nova resposta" (o que mudou desde a
     última vez que a pessoa abriu), linha do tempo do andamento, "Isso
     resolveu?" (reabre), respostas prontas para a equipe e atualização
     sozinha enquanto a tela está aberta. */
  let lista = [], sel = null, filtro = 'abertos', visao = 'meus', vez = 0, q = '', relogio = null;
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : String(iso || '').slice(0, 10));
  const chipStatus = s => '<span class="sp-st sp-st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>';
  const ini = n => (B7.UI.iniciais ? B7.UI.iniciais(n || '?') : String(n || '?').slice(0, 2).toUpperCase());
  const av = n => '<span class="sp-av tom-' + esc(B7.UI.tomDoNome ? B7.UI.tomDoNome(n || '') : '1') + '" aria-hidden="true">' + esc(ini(n)) + '</span>';
  const ICT = {
    bug: '<path d="M8 8.5V7a4 4 0 0 1 8 0v1.5"/><rect x="6.5" y="8.5" width="11" height="11" rx="5.5"/><path d="M12 11v8M3.5 13h3M17.5 13h3M4.5 8.5l2 1.5M19.5 8.5l-2 1.5M4.5 18.5l2.2-1.6M19.5 18.5l-2.2-1.6"/>',
    sugestao: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    duvida: '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8"/><path d="M12 16.6h.01"/>',
    elogio: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
  };
  const icTipo = t => '<span class="sp-ict sp-tp-' + esc(t) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICT[t] || ICT.duvida) + '</svg></span>';
  /* "visto" por chamado, neste aparelho: mostra a bolinha de novidade */
  const chaveVisto = () => 'suporte_visto_' + (eu() || 'anon');
  const vistos = () => (B7.pref && B7.pref.ler(chaveVisto(), {})) || {};
  const marcarVisto = c => { const v = vistos(); v[c.id] = c.updated_at; if (B7.pref) B7.pref.gravar(chaveVisto(), v); };
  const temNovidade = c => { const v = vistos()[c.id]; return v ? new Date(c.updated_at) > new Date(v) : (c.criado_por !== eu() && ABERTOS.includes(c.status)); };
  const RESPOSTAS = [
    'Recebemos! Vamos olhar e te avisamos por aqui.',
    'Consegue mandar um print da tela quando acontecer? Ajuda muito a achar o problema.',
    'Corrigido na versão mais nova. Atualize o sistema (feche e abra de novo) e confira, por favor.',
    'Boa ideia! Entrou na nossa lista. Te avisamos quando sair.'
  ];

  async function carregar() { lista = ok(await sb().from('suporte_chamados').select('*').order('updated_at', { ascending: false }).limit(300)) || []; }

  async function abrir(id) {
    const minha = ++vez;
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/suporte');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Suporte e feedback']);
    if (!equipe()) visao = 'meus';
    sel = id && typeof id === 'string' ? id : (/^#\/suporte$/.test(location.hash) ? null : sel);
    painel().innerHTML = '<div class="conteudo entra sp-tela">' +
      '<header class="sp-hero"><div class="sp-hero-tx"><span class="sp-hero-tag">Suporte e feedback</span><h1>Fale com a equipe do sistema</h1>' +
        '<p>Relate um problema, mande uma ideia, tire uma dúvida ou elogie. A resposta chega aqui e no sino.</p></div>' +
        '<div class="sp-hero-ac"><button type="button" class="b pri" id="sp-novo">+ Novo chamado</button><a class="b contorno" href="#/ajuda">Ver tutoriais</a></div>' +
        '<div class="sp-tipos-rap">' + Object.keys(TIPOS).map(k => '<button type="button" data-rap="' + k + '">' + icTipo(k) + '<span><b>' + TIPOS[k].rot + '</b><small>' + TIPOS[k].dica + '</small></span></button>').join('') + '</div>' +
      '</header>' +
      '<div id="sp-nums" class="sp-nums"></div><div id="sp-barra"></div><div class="sp-grade" id="sp-grade">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelector('#sp-novo').onclick = () => novo();
    painel().querySelectorAll('[data-rap]').forEach(b => b.onclick = () => novo(b.dataset.rap));
    try { await carregar(); }
    catch (e) {
      if (minha !== vez) return;
      const semTabela = e && (e.code === '42P01' || e.code === 'PGRST205');
      painel().querySelector('#sp-grade').innerHTML = '<div class="cb-aviso erro">' + (semTabela ? 'O Suporte ainda está sendo ligado no banco. Volte daqui a pouco.' : 'Não foi possível carregar os chamados.') + '</div>';
      return;
    }
    if (minha !== vez) return;
    if (sel && !lista.some(c => c.id === sel)) sel = null;
    pintar();
    vigiar(minha);
  }

  /* atualiza sozinho a cada 40 s com a tela aberta e visível */
  function vigiar(minha) {
    clearInterval(relogio);
    relogio = setInterval(async () => {
      if (minha !== vez || !document.getElementById('sp-grade')) { clearInterval(relogio); return; }
      if (document.hidden) return;
      const antes = JSON.stringify(lista.map(c => [c.id, c.updated_at, c.status]));
      try { await carregar(); } catch (e) { return; }
      if (JSON.stringify(lista.map(c => [c.id, c.updated_at, c.status])) === antes) return;
      const txt = document.getElementById('sp-resp-t'); const rascunho = txt ? txt.value : '';
      pintar();
      const t2 = document.getElementById('sp-resp-t'); if (t2 && rascunho) t2.value = rascunho;
    }, 40000);
  }

  const daVisao = () => lista.filter(c => visao === 'todos' || c.criado_por === eu());
  const precisaResposta = c => equipe() ? (ABERTOS.includes(c.status) && c.criado_por !== eu() && temNovidade(c)) : temNovidade(c);
  const doFiltro = () => {
    const t = String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return daVisao().filter(c =>
      (filtro === 'todos' ? true : filtro === 'abertos' ? ABERTOS.includes(c.status) : filtro === 'novidade' ? temNovidade(c) : c.status === filtro) &&
      (!t || (c.titulo + ' ' + (c.descricao || '') + ' ' + (c.criado_por_nome || '') + ' #' + c.numero).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)));
  };

  function pintarNums() {
    const cx = document.getElementById('sp-nums'); if (!cx) return;
    const base = daVisao(), mes = Date.now() - 30 * 864e5;
    const n = { abertos: base.filter(c => ABERTOS.includes(c.status)).length, novidade: base.filter(temNovidade).length,
      urg: base.filter(c => c.urgente && ABERTOS.includes(c.status)).length, res: base.filter(c => c.status === 'resolvido' && new Date(c.resolvido_em || c.updated_at) > mes).length };
    const num = (k, v, r, cl) => '<button type="button" class="sp-num ' + (cl || '') + (filtro === k ? ' on' : '') + '" data-num="' + k + '"><b>' + v + '</b><span>' + r + '</span></button>';
    cx.innerHTML = num('abertos', n.abertos, 'em aberto') + num('novidade', n.novidade, equipe() ? 'com novidade' : 'com resposta nova', n.novidade ? 'quente' : '') +
      (equipe() ? num('urgentes', n.urg, 'urgentes', n.urg ? 'alerta' : '') : '') + num('resolvido', n.res, 'resolvidos em 30 dias', 'ok');
    cx.querySelectorAll('[data-num]').forEach(b => b.onclick = () => { filtro = b.dataset.num === 'urgentes' ? 'abertos' : b.dataset.num; if (b.dataset.num === 'urgentes') q = ''; sel = null; pintar(); });
  }

  function pintarBarra() {
    const cx = document.getElementById('sp-barra'); if (!cx) return;
    const base = daVisao();
    const n = f => f === 'todos' ? base.length : f === 'abertos' ? base.filter(c => ABERTOS.includes(c.status)).length : base.filter(c => c.status === f).length;
    cx.innerHTML = '<div class="sp-barra">' +
      '<div class="sp-barra-l">' + (equipe() ? '<div class="filtro" role="tablist" aria-label="De quem">' +
        '<button role="tab" data-v="meus" class="' + (visao === 'meus' ? 'on' : '') + '">Meus</button>' +
        '<button role="tab" data-v="todos" class="' + (visao === 'todos' ? 'on' : '') + '">Todos da equipe</button></div>' : '') +
        '<label class="sp-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="M20 20l-4.2-4.2"/></svg>' +
          '<input id="sp-q" type="search" placeholder="Buscar por título, pessoa ou número" value="' + esc(q) + '" aria-label="Buscar chamados" autocomplete="off"></label></div>' +
      '<div class="sp-filtros" role="group" aria-label="Andamento">' +
        [['abertos', 'Em aberto'], ['novo', 'Novos'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['resolvido', 'Resolvidos'], ['nao_vamos_fazer', 'Não será feito'], ['todos', 'Todos']]
          .map(([k, r]) => '<button type="button" class="sp-f' + (filtro === k ? ' on' : '') + '" data-f="' + k + '">' + r + '<i>' + n(k) + '</i></button>').join('') + '</div></div>';
    cx.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { visao = b.dataset.v; sel = null; pintar(); });
    cx.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; sel = null; pintar(); });
    const qi = cx.querySelector('#sp-q');
    qi.oninput = () => { q = qi.value; pintarLista(); };
  }

  function pintar() {
    pintarNums(); pintarBarra();
    const cx = document.getElementById('sp-grade'); if (!cx) return;
    cx.className = 'sp-grade' + (sel ? ' com-sel' : '');
    const tela = cx.closest('.sp-tela'); if (tela) tela.classList.toggle('com-sel', !!sel);
    cx.innerHTML = '<div class="sp-lista" id="sp-lista"></div><div class="sp-detalhe" id="sp-det"></div>';
    pintarLista();
    if (sel) detalhe(sel);
    else document.getElementById('sp-det').innerHTML = '<div class="sp-det-vazio"><span class="sp-det-vazio-ic">' + icTipo('duvida') + '</span><b>Escolha um chamado</b><p>A conversa com a equipe e o andamento aparecem aqui.</p></div>';
  }

  function pintarLista() {
    const cx = document.getElementById('sp-lista'); if (!cx) return;
    const itens = doFiltro();
    const itemHTML = c => {
      const nov = temNovidade(c) && sel !== c.id;
      return '<button type="button" class="sp-item' + (sel === c.id ? ' on' : '') + (nov ? ' nov' : '') + '" data-id="' + esc(c.id) + '">' + icTipo(c.tipo) +
        '<span class="sp-item-tx"><span class="sp-item-l1"><b>' + esc(c.titulo) + '</b>' + (nov ? '<i class="sp-dot" title="Novidade"></i>' : '') + '</span>' +
        '<span class="sp-meta">#' + c.numero + ' · ' + (visao === 'todos' ? esc((c.criado_por_nome || 'alguém').split(' ')[0]) + ' · ' : '') + esc(quando(c.updated_at || c.created_at)) +
          (c.urgente && ABERTOS.includes(c.status) ? ' · <em class="sp-urgente">urgente</em>' : '') + '</span></span>' + chipStatus(c.status) + '</button>';
    };
    cx.innerHTML = itens.length ? itens.map(itemHTML).join('') :
      '<div class="sp-vazio"><b>' + (lista.length ? 'Nenhum chamado aqui.' : 'Nenhum chamado ainda.') + '</b><p>' + (lista.length ? 'Troque o filtro ou a busca.' : 'Achou algo estranho, tem uma ideia ou ficou com dúvida? Conte pra gente.') + '</p>' +
        '<button type="button" class="b pri" data-novo-vazio>+ Novo chamado</button></div>';
    const nv = cx.querySelector('[data-novo-vazio]'); if (nv) nv.onclick = () => novo();
    cx.querySelectorAll('.sp-item').forEach(b => b.onclick = () => { sel = b.dataset.id; pintar(); });
  }

  const ETAPAS = [['novo', 'Recebido'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['resolvido', 'Resolvido']];
  function linhaTempo(c) {
    if (c.status === 'nao_vamos_fazer') return '<div class="sp-tempo fim-nao"><span class="sp-et feito"><i></i>Recebido</span><span class="sp-et atual"><i></i>Não será feito</span></div>';
    const at = ETAPAS.findIndex(e => e[0] === c.status);
    return '<div class="sp-tempo" style="--at:' + at + '">' + ETAPAS.map((e, k) => '<span class="sp-et' + (k < at ? ' feito' : k === at ? ' atual' : '') + '"><i></i>' + e[1] + '</span>').join('') + '</div>';
  }

  async function detalhe(id) {
    const cx = document.getElementById('sp-det'); if (!cx) return;
    const c = lista.find(x => x.id === id); if (!c) return;
    marcarVisto(c);
    const t = TIPOS[c.tipo] || TIPOS.bug, souAutor = c.criado_por === eu(), fechado = !ABERTOS.includes(c.status);
    cx.innerHTML = '<button type="button" class="sp-volta" id="sp-volta">← Voltar</button>' +
      '<header class="sp-det-cab">' + icTipo(c.tipo) + '<div class="sp-det-tit"><div class="sp-det-l1"><span class="sp-tp sp-tp-' + esc(c.tipo) + '">' + esc(t.rot) + '</span><span class="sp-meta">#' + c.numero + '</span>' +
        (c.urgente && !fechado ? '<em class="sp-urgente">urgente</em>' : '') + (equipe() && c.prioridade !== 'normal' ? '<span class="sp-prio sp-prio-' + esc(c.prioridade) + '">prioridade ' + esc(PRIO[c.prioridade]) + '</span>' : '') + '</div>' +
        '<h2>' + esc(c.titulo) + '</h2><span class="sp-meta">' + av(c.criado_por_nome) + esc(c.criado_por_nome || 'alguém') + ' · aberto ' + esc(quando(c.created_at)) + '</span></div></header>' +
      linhaTempo(c) +
      (c.status === 'resolvido' && souAutor ? '<div class="sp-resolveu"><div><b>Isso resolveu?</b><p>Se ainda acontece, reabra e conte o que viu.</p></div><div><button type="button" class="b contorno" id="sp-sim">Sim, obrigado</button><button type="button" class="b pri" id="sp-reabrir">Não, ainda acontece</button></div></div>' : '') +
      (equipe() ? '<div class="sp-andamento"><label>Situação <select class="campo fina" id="sp-st">' + Object.keys(STATUS).map(k => '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('') + '</select></label>' +
        '<label>Prioridade <select class="campo fina" id="sp-pr">' + Object.keys(PRIO).map(k => '<option value="' + k + '"' + (c.prioridade === k ? ' selected' : '') + '>' + PRIO[k] + '</option>').join('') + '</select></label>' +
        '<button type="button" class="b fina pri" id="sp-and-b" disabled>Salvar</button></div>' : '') +
      '<div class="sp-desc-box">' + (c.descricao ? '<p class="sp-desc">' + esc(c.descricao).replace(/\n/g, '<br>') + '</p>' : '<p class="sp-desc leve">Sem detalhes.</p>') +
        '<div class="sp-anexos" id="sp-anexos"></div>' + contextoHTML(c) + '</div>' +
      '<h3 class="sp-h">Conversa</h3><div class="sp-msgs" id="sp-msgs">' + B7.UI.skeleton('lista', { n: 2 }) + '</div>' +
      '<div class="sp-resp">' +
        (equipe() && !souAutor ? '<div class="sp-prontas">' + RESPOSTAS.map((r, k) => '<button type="button" data-pronta="' + k + '">' + esc(r.slice(0, 34)) + '…</button>').join('') + '</div>' : '') +
        '<textarea class="campo" id="sp-resp-t" rows="3" maxlength="4000" placeholder="' + (equipe() && !souAutor ? 'Responder para ' + esc((c.criado_por_nome || 'a pessoa').split(' ')[0]) + '…' : fechado ? 'Escrever (o chamado continua ' + esc(STATUS[c.status].toLowerCase()) + ')…' : 'Escrever uma mensagem para a equipe…') + '"></textarea>' +
        '<div class="sp-resp-ac">' + (equipe() ? '<label class="sp-nota"><input type="checkbox" id="sp-resp-i"> Nota interna (só a equipe vê)</label>' : '<small class="leve">Ctrl+Enter envia</small>') +
        '<button type="button" class="b pri" id="sp-resp-b">Enviar</button></div></div>';
    cx.querySelector('#sp-volta').onclick = () => { sel = null; pintar(); };
    anexos(c); mensagens(c);
    const tx = cx.querySelector('#sp-resp-t');
    cx.querySelectorAll('[data-pronta]').forEach(b => b.onclick = () => { tx.value = RESPOSTAS[+b.dataset.pronta]; tx.focus(); });
    const enviar = async () => {
      const texto = tx.value.trim(); if (!texto) return;
      const bt = cx.querySelector('#sp-resp-b'); bt.disabled = true;
      try {
        await B7.DB.rpc('suporte_responder', { p_id: c.id, p_texto: texto, p_interno: !!(cx.querySelector('#sp-resp-i') && cx.querySelector('#sp-resp-i').checked) });
        tx.value = ''; c.updated_at = new Date().toISOString(); marcarVisto(c); await mensagens(c);
      } catch (e) { B7.UI.toast('Não foi possível enviar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
      bt.disabled = false;
    };
    cx.querySelector('#sp-resp-b').onclick = enviar;
    tx.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } });
    const sim = cx.querySelector('#sp-sim');
    if (sim) sim.onclick = () => { B7.UI.toast('Que bom! Obrigado por avisar.'); sim.closest('.sp-resolveu').remove(); };
    const re = cx.querySelector('#sp-reabrir');
    if (re) re.onclick = async () => {
      const motivo = await B7.UI.perguntar({ titulo: 'O que ainda acontece?', confirmar: 'Reabrir chamado' });
      if (motivo === null) return;
      try { await B7.DB.rpc('suporte_reabrir', { p_id: c.id, p_motivo: motivo || '' }); await carregar(); B7.UI.toast('Chamado reaberto. A equipe foi avisada.'); pintar(); }
      catch (e) { B7.UI.toast('Não foi possível reabrir: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
    };
    const ab = cx.querySelector('#sp-and-b');
    if (ab) {
      const st = cx.querySelector('#sp-st'), pr = cx.querySelector('#sp-pr');
      const mudou = () => { ab.disabled = st.value === c.status && pr.value === c.prioridade; };
      st.onchange = mudou; pr.onchange = mudou;
      ab.onclick = async () => {
        ab.disabled = true;
        try {
          await B7.DB.rpc('suporte_status', { p_id: c.id, p_status: st.value, p_prioridade: pr.value });
          await carregar(); B7.UI.toast('Andamento salvo. ' + (c.criado_por !== eu() ? 'A pessoa foi avisada.' : '')); pintar();
        } catch (e) { B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); mudou(); }
      };
    }
  }

  function contextoHTML(c) {
    const x = c.contexto || {}; if (!Object.keys(x).length) return '';
    const l = (r, v) => v ? '<div><span>' + r + '</span><b>' + esc(String(v)) + '</b></div>' : '';
    return '<details class="sp-ctx"><summary>Informações da tela' + ((x.erros || []).length ? ' · <em>' + x.erros.length + ' erro' + (x.erros.length === 1 ? '' : 's') + '</em>' : '') + '</summary><div class="sp-ctx-g">' +
      l('Tela', x.tela) + l('Versão', x.versao) + l('Onde', x.plataforma) + l('Janela', x.janela) + l('Perfil', x.papel) + (x.online === false ? l('Conexão', 'sem internet') : '') +
      (x.navegador ? '<div class="sp-ctx-l"><span>Navegador</span><b>' + esc(x.navegador) + '</b></div>' : '') +
      ((x.erros || []).length ? '<div class="sp-ctx-l"><span>Erros recentes</span><pre>' + esc(x.erros.map(e => e.msg).join('\n')) + '</pre></div>' : '') +
      ((x.rastro || []).length && equipe() ? '<div class="sp-ctx-l"><span>Rastro</span><pre>' + esc(JSON.stringify(x.rastro).slice(0, 900)) + '</pre></div>' : '') +
      '</div></details>';
  }

  async function anexos(c) {
    if (!(c.anexos || []).length) return;
    const urls = await Promise.all(c.anexos.map(async p => { try { const { data } = await sb().storage.from(BUCKET).createSignedUrl(p, 3600); return data && data.signedUrl; } catch (e) { return null; } }));
    const box = document.getElementById('sp-anexos'); if (!box) return;
    box.innerHTML = urls.filter(Boolean).map((u, i) => '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"><img alt="Print ' + (i + 1) + '" src="' + esc(u) + '"></a>').join('');
  }

  async function mensagens(c) {
    const cx = document.getElementById('sp-msgs'); if (!cx) return;
    let ms = [];
    try { ms = ok(await sb().from('suporte_mensagens').select('*').eq('chamado_id', c.id).order('created_at')) || []; }
    catch (e) { cx.innerHTML = '<p class="leve">Não foi possível carregar a conversa.</p>'; return; }
    const box = document.getElementById('sp-msgs'); if (!box || sel !== c.id) return;
    box.innerHTML = ms.length ? ms.map(m => m.sistema
      ? '<div class="sp-sis"><span>' + esc(m.texto) + ' · ' + esc((m.autor_nome || '').split(' ')[0]) + ' · ' + esc(quando(m.created_at)) + '</span></div>'
      : '<div class="sp-msg' + (m.autor_id === eu() ? ' minha' : '') + (m.interno ? ' interna' : '') + '">' + (m.autor_id === eu() ? '' : av(m.autor_nome)) +
        '<div class="sp-bolha"><div class="sp-msg-c"><b>' + esc(m.autor_id === eu() ? 'Você' : (m.autor_nome || 'Alguém')) + '</b>' + (m.interno ? '<em>nota interna</em>' : '') + '<small>' + esc(quando(m.created_at)) + '</small></div>' +
        '<p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p></div></div>').join('')
      : '<div class="sp-sem-msg">Ainda sem mensagens. ' + (equipe() && c.criado_por !== eu() ? 'Responda para a pessoa saber que o chamado foi visto.' : 'A equipe responde por aqui.') + '</div>';
    box.scrollTop = box.scrollHeight;
  }

  return { abrir, novo };
})();
