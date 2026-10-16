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
  function novo(tipoInicial) {
    let tipo = TIPOS[tipoInicial] ? tipoInicial : 'bug';
    const imagens = [];                         /* { blob, mini } */
    const ctx = contexto();
    const m = B7.UI.modal('<h3>Suporte e feedback</h3>' +
      '<p class="sub">Conte o que aconteceu ou o que você quer. A equipe responde por aqui e você recebe um aviso no sino.</p>' +
      '<div class="sp-tipos" role="group" aria-label="Tipo">' +
        Object.keys(TIPOS).map(k => '<button type="button" class="sp-tipo" data-tipo="' + k + '"><b>' + TIPOS[k].rot + '</b><small>' + TIPOS[k].dica + '</small></button>').join('') + '</div>' +
      '<div class="mb"><label class="rot" for="sp-tit">RESUMO</label><input class="campo" id="sp-tit" maxlength="140" data-foco></div>' +
      '<div class="mb"><label class="rot" for="sp-desc">DETALHES <span class="leve">— quanto mais, mais rápido a gente resolve</span></label><textarea class="campo" id="sp-desc" rows="5" maxlength="4000"></textarea></div>' +
      '<label class="sp-urg" id="sp-urg"><input type="checkbox" id="sp-urg-c"> Está me impedindo de trabalhar</label>' +
      '<div class="mb"><label class="rot">PRINT <span class="leve">— opcional</span></label>' +
        '<div class="sp-solta" id="sp-solta" tabindex="0">Cole um print aqui (<kbd>Ctrl</kbd>+<kbd>V</kbd>), arraste ou <button type="button" class="adm-link" id="sp-escolher">escolha um arquivo</button>' +
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
    m.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { tipo = b.dataset.tipo; pintarTipo(); });
    pintarTipo();
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

  /* ============================================================== tela */
  let lista = [], sel = null, filtro = 'abertos', visao = 'meus', vez = 0;

  const chipStatus = s => '<span class="sp-st sp-st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>';
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : String(iso || '').slice(0, 10));

  async function abrir(id) {
    const minha = ++vez;
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/suporte');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Suporte e feedback']);
    if (!equipe()) visao = 'meus';
    if (id && typeof id === 'string') sel = id;
    painel().innerHTML = '<div class="conteudo entra sp-tela">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Suporte e feedback</h1><p>Relate um problema, mande uma ideia, tire uma dúvida ou elogie. A equipe responde aqui mesmo.</p></div>' +
      '<div class="cb-topo-acoes"><button type="button" class="b pri" id="sp-novo">+ Novo chamado</button></div></div>' +
      '<div id="sp-barra"></div><div class="sp-grade" id="sp-grade">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelector('#sp-novo').onclick = () => novo();
    try { lista = ok(await sb().from('suporte_chamados').select('*').order('created_at', { ascending: false }).limit(300)) || []; }
    catch (e) {
      if (minha !== vez) return;
      const semTabela = e && (e.code === '42P01' || e.code === 'PGRST205');
      painel().querySelector('#sp-grade').innerHTML = '<div class="cb-aviso erro">' + (semTabela ? 'O Suporte ainda está sendo ligado no banco. Volte daqui a pouco.' : 'Não foi possível carregar os chamados.') + '</div>';
      return;
    }
    if (minha !== vez) return;
    if (sel && !lista.some(c => c.id === sel)) sel = null;
    pintar();
  }

  const doFiltro = () => lista.filter(c =>
    (visao === 'todos' || c.criado_por === eu()) &&
    (filtro === 'todos' ? true : filtro === 'abertos' ? ABERTOS.includes(c.status) : c.status === filtro));

  function pintarBarra() {
    const cx = document.getElementById('sp-barra'); if (!cx) return;
    const base = lista.filter(c => visao === 'todos' || c.criado_por === eu());
    const n = f => f === 'todos' ? base.length : f === 'abertos' ? base.filter(c => ABERTOS.includes(c.status)).length : base.filter(c => c.status === f).length;
    cx.innerHTML = '<div class="sp-barra">' +
      (equipe() ? '<div class="filtro" role="tablist" aria-label="De quem">' +
        '<button role="tab" data-v="meus" class="' + (visao === 'meus' ? 'on' : '') + '">Meus chamados</button>' +
        '<button role="tab" data-v="todos" class="' + (visao === 'todos' ? 'on' : '') + '">Todos da equipe</button></div>' : '') +
      '<div class="sp-filtros" role="group" aria-label="Andamento">' +
        [['abertos', 'Em aberto'], ['novo', 'Novos'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['resolvido', 'Resolvidos'], ['nao_vamos_fazer', 'Não será feito'], ['todos', 'Todos']]
          .map(([k, r]) => '<button type="button" class="tr-etq' + (filtro === k ? ' on' : '') + '" data-f="' + k + '">' + r + '<i>' + n(k) + '</i></button>').join('') + '</div></div>';
    cx.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { visao = b.dataset.v; sel = null; pintar(); });
    cx.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; sel = null; pintar(); });
  }

  function pintar() {
    pintarBarra();
    const cx = document.getElementById('sp-grade'); if (!cx) return;
    const itens = doFiltro();
    const itemHTML = c => {
      const t = TIPOS[c.tipo] || TIPOS.bug;
      return '<button type="button" class="sp-item' + (sel === c.id ? ' on' : '') + '" data-id="' + esc(c.id) + '">' +
        '<span class="sp-tp sp-tp-' + esc(c.tipo) + '">' + esc(t.rot) + '</span>' +
        '<b>' + esc(c.titulo) + '</b>' +
        '<span class="sp-meta">#' + c.numero + ' · ' + esc(visao === 'todos' ? (c.criado_por_nome || 'alguém') + ' · ' : '') + esc(quando(c.created_at)) +
          (c.urgente && ABERTOS.includes(c.status) ? ' · <em class="sp-urgente">urgente</em>' : '') + '</span>' + chipStatus(c.status) + '</button>';
    };
    const vazio = '<div class="estado-b7"><b>' + (lista.length ? 'Nenhum chamado nesse filtro.' : 'Você ainda não abriu nenhum chamado.') + '</b>' +
      '<span>Achou algo estranho, tem uma ideia ou ficou com dúvida? Conte pra gente.</span><button type="button" class="b pri" data-novo-vazio>+ Novo chamado</button></div>';
    cx.className = 'sp-grade' + (sel ? ' com-sel' : '');
    cx.innerHTML = '<div class="sp-lista">' + (itens.length ? itens.map(itemHTML).join('') : vazio) + '</div><div class="sp-detalhe" id="sp-det">' +
      (sel ? '' : '<div class="sp-det-vazio">Escolha um chamado para ver a conversa.</div>') + '</div>';
    const nv = cx.querySelector('[data-novo-vazio]'); if (nv) nv.onclick = () => novo();
    cx.querySelectorAll('.sp-item').forEach(b => b.onclick = () => { sel = b.dataset.id; pintar(); });
    if (sel) detalhe(sel);
  }

  async function detalhe(id) {
    const cx = document.getElementById('sp-det'); if (!cx) return;
    const c = lista.find(x => x.id === id); if (!c) return;
    const t = TIPOS[c.tipo] || TIPOS.bug;
    cx.innerHTML = '<button type="button" class="sp-volta" id="sp-volta">← Voltar</button>' +
      '<div class="sp-det-cab"><span class="sp-tp sp-tp-' + esc(c.tipo) + '">' + esc(t.rot) + '</span><span class="sp-meta">#' + c.numero + ' · ' + esc(c.criado_por_nome || 'alguém') + ' · ' + esc(quando(c.created_at)) + '</span>' + chipStatus(c.status) +
        (c.urgente && ABERTOS.includes(c.status) ? '<em class="sp-urgente">urgente</em>' : '') + '</div>' +
      '<h2>' + esc(c.titulo) + '</h2>' +
      (c.descricao ? '<p class="sp-desc">' + esc(c.descricao).replace(/\n/g, '<br>') + '</p>' : '<p class="leve">Sem detalhes.</p>') +
      '<div class="sp-anexos" id="sp-anexos"></div>' + contextoHTML(c) +
      '<h3 class="sp-h">Conversa</h3><div class="sp-msgs" id="sp-msgs">' + B7.UI.skeleton('lista', { n: 2 }) + '</div>' +
      '<div class="sp-resp"><textarea class="campo" id="sp-resp-t" rows="3" maxlength="4000" placeholder="' + (equipe() && c.criado_por !== eu() ? 'Responder para ' + esc((c.criado_por_nome || 'a pessoa').split(' ')[0]) + '…' : 'Escrever uma mensagem…') + '"></textarea>' +
        '<div class="sp-resp-ac">' + (equipe() ? '<label class="sp-nota"><input type="checkbox" id="sp-resp-i"> Nota interna (só a equipe vê)</label>' : '') +
        '<button type="button" class="b pri" id="sp-resp-b">Enviar</button></div></div>' +
      (equipe() ? '<div class="sp-andamento"><h3 class="sp-h">Andamento</h3><div class="sp-and-campos">' +
        '<label>Situação <select class="campo fina" id="sp-st">' + Object.keys(STATUS).map(k => '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>').join('') + '</select></label>' +
        '<label>Prioridade <select class="campo fina" id="sp-pr">' + Object.keys(PRIO).map(k => '<option value="' + k + '"' + (c.prioridade === k ? ' selected' : '') + '>' + PRIO[k] + '</option>').join('') + '</select></label>' +
        '<button type="button" class="b fina contorno" id="sp-and-b">Salvar andamento</button></div></div>' : '');
    cx.querySelector('#sp-volta').onclick = () => { sel = null; pintar(); };
    anexos(c); mensagens(c);
    cx.querySelector('#sp-resp-b').onclick = async () => {
      const tx = cx.querySelector('#sp-resp-t'), texto = tx.value.trim(); if (!texto) return;
      const bt = cx.querySelector('#sp-resp-b'); bt.disabled = true;
      try {
        await B7.DB.rpc('suporte_responder', { p_id: c.id, p_texto: texto, p_interno: !!(cx.querySelector('#sp-resp-i') && cx.querySelector('#sp-resp-i').checked) });
        tx.value = ''; await mensagens(c);
      } catch (e) { B7.UI.toast('Não foi possível enviar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
      bt.disabled = false;
    };
    const ab = cx.querySelector('#sp-and-b');
    if (ab) ab.onclick = async () => {
      ab.disabled = true;
      try {
        await B7.DB.rpc('suporte_status', { p_id: c.id, p_status: cx.querySelector('#sp-st').value, p_prioridade: cx.querySelector('#sp-pr').value });
        c.status = cx.querySelector('#sp-st').value; c.prioridade = cx.querySelector('#sp-pr').value;
        B7.UI.toast('Andamento salvo.'); pintar();
      } catch (e) { B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); ab.disabled = false; }
    };
  }

  function contextoHTML(c) {
    const x = c.contexto || {}; if (!Object.keys(x).length) return '';
    const l = (r, v) => v ? '<div><span>' + r + '</span><b>' + esc(String(v)) + '</b></div>' : '';
    return '<details class="sp-ctx"><summary>Informações da tela</summary><div class="sp-ctx-g">' +
      l('Tela', x.tela) + l('Versão', x.versao) + l('Onde', x.plataforma) + l('Janela', x.janela) + l('Perfil', x.papel) + (x.online === false ? l('Conexão', 'sem internet') : '') +
      (x.navegador ? '<div class="sp-ctx-l"><span>Navegador</span><b>' + esc(x.navegador) + '</b></div>' : '') +
      ((x.erros || []).length ? '<div class="sp-ctx-l"><span>Erros recentes</span><pre>' + esc(x.erros.map(e => e.msg).join('\n')) + '</pre></div>' : '') +
      ((x.rastro || []).length && equipe() ? '<div class="sp-ctx-l"><span>Rastro</span><pre>' + esc(JSON.stringify(x.rastro).slice(0, 900)) + '</pre></div>' : '') +
      '</div></details>';
  }

  async function anexos(c) {
    const cx = document.getElementById('sp-anexos'); if (!cx || !(c.anexos || []).length) return;
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
    box.innerHTML = ms.length ? ms.map(m => '<div class="sp-msg' + (m.autor_id === eu() ? ' minha' : '') + (m.interno ? ' interna' : '') + '"><div class="sp-msg-c"><b>' + esc(m.autor_nome || 'Alguém') + '</b>' +
      (m.interno ? '<em>nota interna</em>' : '') + '<small>' + esc(quando(m.created_at)) + '</small></div><p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p></div>').join('')
      : '<p class="leve">Ainda sem mensagens.</p>';
    box.scrollTop = box.scrollHeight;
  }

  return { abrir, novo };
})();
