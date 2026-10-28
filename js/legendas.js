/* =====================================================================
   LEGENDAS (zzz278) — consertar legenda de vídeo (.srt) com IA

   A aba #/legendas tem três partes:
     • Consertar  — arrasta o .srt (ou cola), escolhe o cliente e a IA
                    corrige ortografia, acento, maiúscula, pontuação, %, R$,
                    marcas e erros claros de transcrição (regras do agente
                    que o Kevin usava; b7-ia, tarefa extra "srt");
     • Histórico  — o que já foi corrigido, para baixar de novo;
     • Marcas e termos — lista geral + a de cada cliente (grafia oficial).

   Segurança da estrutura: a IA recebe SÓ o texto de cada legenda, com um
   índice. Número e tempo de cada legenda são guardados aqui e remontados
   pelo sistema — a IA não tem como mudar tempo, juntar ou sumir com
   legenda. Se ela devolver uma legenda muito diferente da original
   (reescrita), o sistema mantém a original e avisa.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Legendas = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const POR_PARTE = 60;
  const podeEditar = () => !B7.Perm || !B7.Perm.podeNivel || B7.Perm.podeNivel('legendas', 'editar');
  const podeGeral = () => !B7.Perm || !B7.Perm.podeNivel || B7.Perm.podeNivel('legendas', 'total');
  const sb = () => B7.sb;

  /* ------------------------------------------------------------ SRT */
  function ler(txt) {
    const limpo = String(txt || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    if (!limpo) return null;
    const blocos = limpo.split(/\n[ \t]*\n+/);
    const cues = [];
    for (const b of blocos) {
      const l = b.split('\n');
      const k = l.findIndex(x => /-->/.test(x));
      if (k < 0) return null;
      cues.push({ num: l.slice(0, k).join('\n').trim(), tempo: l[k].trim(), texto: l.slice(k + 1).join('\n') });
    }
    return cues.length ? cues : null;
  }
  const montar = (cues, campo) => cues.map(c => (c.num ? c.num + '\n' : '') + c.tempo + '\n' + c[campo]).join('\n\n') + '\n';

  /* palavras para comparar (sem pontuação e maiúsculas: isso é correção, não reescrita) */
  /* números falados viram algarismo, % e R$ — isso também é correção, não conta como reescrita */
  const NUMEROS = new Set(('zero um uma dois duas tres quatro cinco seis sete oito nove dez onze doze treze quatorze catorze quinze dezesseis dezessete dezoito dezenove ' +
    'vinte trinta quarenta cinquenta sessenta setenta oitenta noventa cem cento duzentos trezentos quatrocentos quinhentos seiscentos setecentos oitocentos novecentos ' +
    'mil milhao milhoes e por cento reais real centavos centavo').split(' '));
  const base = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s%$]/gu, ' ').split(/\s+/)
    .filter(w => w && !NUMEROS.has(w) && !/^(r\$?|\$)?[\d.,]*%?$/.test(w));
  function parecido(a, b) {
    const x = base(a), y = base(b);
    if (x.length < 4) return true;
    const m = lcs(x, y);
    return m / Math.max(x.length, y.length) >= 0.55;
  }
  function lcs(a, b) {
    const n = a.length, m = b.length, d = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) { let p = 0; for (let j = 1; j <= m; j++) { const t = d[j]; d[j] = a[i - 1] === b[j - 1] ? p + 1 : Math.max(d[j], d[j - 1]); p = t; } }
    return d[m];
  }
  /* diferença palavra a palavra: o que saiu e o que entrou */
  function diff(a, b) {
    const x = String(a).split(/(\s+)/), y = String(b).split(/(\s+)/);
    const n = x.length, m = y.length, t = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0, j = 0, antes = '', depois = '';
    while (i < n || j < m) {
      if (i < n && j < m && x[i] === y[j]) { antes += esc(x[i]); depois += esc(y[j]); i++; j++; }
      else if (j < m && (i >= n || t[i][j + 1] >= t[i + 1][j])) { depois += /\S/.test(y[j]) ? '<mark>' + esc(y[j]) + '</mark>' : esc(y[j]); j++; }
      else { antes += /\S/.test(x[i]) ? '<del>' + esc(x[i]) + '</del>' : esc(x[i]); i++; }
    }
    return { antes: antes.replace(/\n/g, '<br>'), depois: depois.replace(/\n/g, '<br>') };
  }

  /* ------------------------------------------------------------ tela */
  let aba = 'consertar';
  let S = null;   /* { nome, cues, clienteId, demandaId, salvoComo } */
  async function abrir(params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/legendas');
    B7.Rota.titulo(['Legendas']);
    const q = k => (params && params.get ? params.get(k) : null);
    if (q('aba')) aba = q('aba');
    const demandaId = q('demanda');
    painel().innerHTML = '<div class="conteudo entra lg">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Legendas</h1>' +
        '<p class="gt-intro">A IA conserta a legenda automática do vídeo: ortografia, acento, maiúscula, pontuação, %, R$ e nome das marcas — sem reescrever o que foi falado. Os tempos não mudam.</p></div></div>' +
      '<div class="filtro rolavel" role="tablist">' + [['consertar', 'Consertar'], ['historico', 'Histórico'], ['termos', 'Marcas e termos']].map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '" aria-selected="' + (aba === k) + '">' + r + '</button>').join('') + '</div>' +
      '<div id="lg-corpo"></div></div>';
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => {
      aba = b.dataset.aba;
      painel().querySelectorAll('[data-aba]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      try { history.replaceState(null, '', '#/legendas?aba=' + aba); } catch (e) {}
      pintar();
    });
    if (demandaId) {
      try {
        const d = await B7.DB.demandaVideo(demandaId);
        S = { nome: '', cues: null, clienteId: d.client_id, demandaId: d.id, demandaTitulo: d.titulo, clienteNome: d.cliente_nome };
        aba = 'consertar';
      } catch (e) { S = null; }
    }
    pintar();
  }
  function pintar() {
    const cx = document.getElementById('lg-corpo');
    if (!cx) return;
    if (aba === 'historico') return historico(cx);
    if (aba === 'termos') return termos(cx);
    return consertar(cx);
  }

  /* ------------------------------------------------------- consertar */
  async function consertar(cx) {
    if (S && S.cues && S.feito) return resultado(cx);
    const clientes = await B7.DB.listarClientes().catch(() => []);
    if (!cx.isConnected) return;
    const fixo = S && S.demandaId;
    cx.innerHTML = '<section class="lg-entrada">' +
      (fixo ? '<p class="lg-para">Para a demanda <b>' + esc(S.demandaTitulo || '') + '</b> · ' + esc(S.clienteNome || '') +
          ' <a class="cb-link" href="#/legendas">trocar</a></p>'
        : '<div class="mb"><label class="rot" for="lg-cli">CLIENTE DO VÍDEO</label><select class="campo" id="lg-cli"><option value="">Escolha… (usa as marcas e termos dele)</option>' +
          clientes.map(c => '<option value="' + esc(c.id) + '"' + (S && S.clienteId === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select></div>') +
      '<label class="lg-solta" id="lg-solta"><input type="file" accept=".srt,.txt,text/plain,application/x-subrip" hidden id="lg-arq">' +
        '<span class="lg-solta-ic" aria-hidden="true">CC</span><b>Arraste o arquivo .srt aqui</b><small>ou clique para escolher</small>' +
        '<em id="lg-arq-nome"></em></label>' +
      '<details class="lg-colar"><summary>Ou cole o texto da legenda</summary><textarea class="campo" id="lg-texto" rows="8" placeholder="1&#10;00:00:01,000 --> 00:00:02,000&#10;texto da legenda"></textarea></details>' +
      '<div class="lg-acoes"><button class="b pri" id="lg-ir"' + (podeEditar() ? '' : ' disabled title="Sua conta só vê as legendas"') + '>✨ Consertar com IA</button></div>' +
      '<div id="lg-prog"></div></section>';
    let arquivo = { nome: '', texto: '' };
    const solta = cx.querySelector('#lg-solta'), inp = cx.querySelector('#lg-arq');
    const pegar = async f => {
      if (!f) return;
      if (f.size > 900000) return B7.UI.toast('Arquivo grande demais (máx. ~900 KB).', { tipo: 'erro' });
      arquivo = { nome: f.name, texto: await f.text() };
      cx.querySelector('#lg-arq-nome').textContent = f.name + ' · ' + ((ler(arquivo.texto) || []).length) + ' legendas';
      solta.classList.add('ok');
    };
    inp.onchange = () => pegar(inp.files[0]);
    ['dragenter', 'dragover'].forEach(ev => solta.addEventListener(ev, e => { e.preventDefault(); solta.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach(ev => solta.addEventListener(ev, e => { e.preventDefault(); solta.classList.remove('sobre'); }));
    solta.addEventListener('drop', e => pegar(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]));
    cx.querySelector('#lg-ir').onclick = async () => {
      const colado = cx.querySelector('#lg-texto').value;
      const texto = arquivo.texto || colado;
      const cues = ler(texto);
      if (!cues) return B7.UI.toast(texto.trim() ? 'Isso não parece uma legenda .srt (faltam os tempos "-->").' : 'Escolha o arquivo .srt ou cole o texto.', { tipo: 'erro' });
      const clienteId = fixo ? S.clienteId : (cx.querySelector('#lg-cli').value || null);
      if (!clienteId && !await B7.UI.confirmar({ titulo: 'Sem cliente?', texto: 'Sem o cliente, a IA usa a lista geral e o nome de todos os clientes, mas não os termos específicos de um cliente. Seguir assim?', rotulo: 'Seguir' })) return;
      const nome = arquivo.nome || 'legenda.srt';
      S = Object.assign(S || {}, { nome, clienteId, cues: cues.map(c => Object.assign(c, { ia: c.texto, usar: 'ia' })), feito: false, salvoComo: null });
      await processar(cx);
    };
  }

  async function processar(cx) {
    const prog = cx.querySelector('#lg-prog'), bt = cx.querySelector('#lg-ir');
    bt.disabled = true;
    const cues = S.cues;
    const comTexto = cues.map((c, i) => ({ i, t: c.texto })).filter(c => c.t.trim());
    const partes = [];
    for (let k = 0; k < comTexto.length; k += POR_PARTE) partes.push(comTexto.slice(k, k + POR_PARTE));
    let falhas = 0;
    for (let p = 0; p < partes.length; p++) {
      prog.innerHTML = '<div class="lg-prog"><span class="iaf-orbe" aria-hidden="true"></span><b>Corrigindo… parte ' + (p + 1) + ' de ' + partes.length + '</b>' +
        '<i style="--p:' + Math.round(100 * p / partes.length) + '%"></i></div>';
      let r = await B7.IA.pedir('extra', { operacao: 'srt', cliente_id: S.clienteId, cues: partes[p] }, { prazo: 100000 });
      if (!r.ok && !r.cancelado) r = await B7.IA.pedir('extra', { operacao: 'srt', cliente_id: S.clienteId, cues: partes[p] }, { prazo: 100000 });
      if (!cx.isConnected) return;
      if (!r.ok) { falhas++; continue; }
      (r.itens || []).forEach(x => {
        const c = cues[x.i]; if (!c || typeof x.t !== 'string' || !x.t.trim()) return;
        if (parecido(c.texto, x.t)) c.ia = x.t;
        else { c.ia = c.texto; c.barrada = x.t; }   /* reescreveu: fica a original */
      });
    }
    S.feito = true;
    if (falhas === partes.length) {
      S.feito = false; bt.disabled = false;
      prog.innerHTML = '<div class="iaf-erro">Não deu para corrigir agora. Tente de novo em instantes.</div>';
      return;
    }
    if (falhas) B7.UI.toast(falhas + (falhas === 1 ? ' parte ficou' : ' partes ficaram') + ' sem correção (a IA não respondeu). Essas legendas ficam como estavam.', { tipo: 'erro', tempo: 8000 });
    resultado(cx);
  }

  function texto(c) { return c.usar === 'ia' ? c.ia : c.texto; }
  function resultado(cx) {
    const cues = S.cues;
    const mudou = c => c.ia !== c.texto;
    const n = cues.filter(mudou).length, barradas = cues.filter(c => c.barrada).length;
    let soMudadas = n > 0;
    const linhas = () => cues.map((c, i) => ({ c, i })).filter(x => !soMudadas || mudou(x.c) || x.c.barrada).map(({ c, i }) => {
      const d = diff(c.texto, c.ia), desfeita = c.usar !== 'ia';
      return '<div class="lg-cue' + (mudou(c) ? ' mudou' : '') + (desfeita ? ' desfeita' : '') + '" data-i="' + i + '">' +
        '<div class="lg-cue-cab"><b>' + esc(c.num || String(i + 1)) + '</b><small>' + esc(c.tempo) + '</small>' +
          (mudou(c) ? '<button type="button" class="cb-link" data-desfazer="' + i + '">' + (desfeita ? 'Usar a correção' : 'Desfazer esta') + '</button>' : '') + '</div>' +
        (mudou(c) ? '<div class="lg-dois"><p class="lg-antes">' + d.antes + '</p><p class="lg-depois">' + (desfeita ? esc(c.texto).replace(/\n/g, '<br>') : d.depois) + '</p></div>'
          : '<p class="lg-igual">' + esc(c.texto).replace(/\n/g, '<br>') + '</p>') +
        (c.barrada ? '<p class="lg-barrada">⚠️ A IA quis reescrever esta legenda; ficou a original. Sugestão dela: “' + esc(c.barrada) + '”</p>' : '') +
      '</div>';
    }).join('');
    cx.innerHTML = '<section class="lg-res">' +
      '<div class="lg-res-cab"><div><h2>' + esc(S.nome) + '</h2><p>' + cues.length + ' legendas · <b>' + n + '</b> corrigida' + (n === 1 ? '' : 's') +
        (barradas ? ' · ' + barradas + ' mantida' + (barradas === 1 ? '' : 's') + ' por segurança' : '') + ' · tempos iguais ao original</p></div>' +
        '<div class="lg-res-bts"><button class="b pri" data-lg="baixar">Baixar .srt corrigido</button><button class="b contorno" data-lg="copiar">Copiar</button>' +
        '<button class="b contorno" data-lg="nova">Outra legenda</button></div></div>' +
      '<label class="lg-filtro"><input type="checkbox" id="lg-so"' + (soMudadas ? ' checked' : '') + '> Mostrar só as que mudaram</label>' +
      '<div class="lg-cues" id="lg-cues"></div></section>';
    const lista = cx.querySelector('#lg-cues');
    const repintar = () => {
      lista.innerHTML = linhas() || '<p class="gt-vazio">A IA não encontrou nada para corrigir.</p>';
      lista.querySelectorAll('[data-desfazer]').forEach(b => b.onclick = () => {
        const c = cues[+b.dataset.desfazer]; c.usar = c.usar === 'ia' ? 'original' : 'ia'; S.salvoComo = null; repintar();
      });
    };
    repintar();
    cx.querySelector('#lg-so').onchange = e => { soMudadas = e.target.checked; repintar(); };
    cx.querySelectorAll('[data-lg]').forEach(b => b.onclick = async () => {
      const a = b.dataset.lg;
      if (a === 'nova') { S = S && S.demandaId ? { clienteId: S.clienteId, demandaId: S.demandaId, demandaTitulo: S.demandaTitulo, clienteNome: S.clienteNome } : null; return consertar(cx); }
      const final = montar(cues.map(c => Object.assign({}, c, { saida: texto(c) })), 'saida');
      if (a === 'baixar') baixar(final, nomeCorrigido(S.nome));
      else B7.UI.copiarTexto(final, { msgSucesso: 'Legenda copiada', msgErro: 'Não foi possível copiar' });
      salvar(final);
    });
  }
  const nomeCorrigido = n => String(n || 'legenda.srt').replace(/(\.srt|\.txt)?$/i, '') + ' (corrigida).srt';
  function baixar(conteudo, nome) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/x-subrip;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  /* guarda no histórico uma vez por versão (desfazer uma correção gera outra) */
  async function salvar(final) {
    if (!S || S.salvoComo === final) return;
    S.salvoComo = final;
    const alteradas = S.cues.filter(c => texto(c) !== c.texto).length;
    try {
      await B7.DB.rpc('legenda_salvar', { p_client: S.clienteId || null, p_demanda: S.demandaId || null, p_nome: S.nome,
        p_original: montar(S.cues, 'texto'), p_corrigido: final, p_total: S.cues.length, p_alteradas: alteradas });
      if (S.demandaId) B7.UI.toast('Guardada também na demanda de edição.');
    } catch (e) { S.salvoComo = null; console.warn('legenda não guardada no histórico:', e && e.message); }
  }

  /* -------------------------------------------------------- histórico */
  async function historico(cx, filtroDemanda) {
    cx.innerHTML = B7.UI.skeleton('lista', { n: 4 });
    let l = [];
    try {
      let q = sb().from('legendas').select('id,nome_arquivo,client_id,demanda_id,total,alteradas,criado_por,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
      if (filtroDemanda) q = q.eq('demanda_id', filtroDemanda);
      const r = await q; if (r.error) throw r.error; l = r.data || [];
    } catch (e) { cx.innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar.') + '</div>'; return; }
    const [clientes, pessoas] = await Promise.all([B7.DB.listarClientes().catch(() => []), Promise.all([B7.DB.listarEquipe().catch(() => []), B7.DB.listarVideomakers().catch(() => [])]).then(([a, b]) => (a || []).concat(b || []))]);
    const nomeCli = id => ((clientes || []).find(c => c.id === id) || {}).nome || '';
    const nomeP = id => (Array.isArray(pessoas) ? (pessoas.find(p => p.id === id) || {}).nome : '') || '';
    if (!cx.isConnected) return;
    cx.innerHTML = l.length ? '<div class="lg-hist">' + l.map(x =>
      '<div class="lg-h"><span class="lg-h-ic" aria-hidden="true">CC</span><span class="lg-h-tx"><b>' + esc(x.nome_arquivo) + '</b>' +
        '<small>' + [nomeCli(x.client_id), x.alteradas + ' de ' + x.total + ' corrigidas', nomeP(x.criado_por), B7.UI.quando(x.created_at)].filter(Boolean).map(esc).join(' · ') + '</small></span>' +
        (x.demanda_id ? '<a class="b fina contorno" href="#/video/' + esc(x.demanda_id) + '">Demanda</a>' : '') +
        '<button class="b fina pri" data-baixar="' + esc(x.id) + '">Baixar</button>' +
        (podeEditar() ? '<button class="b fina contorno ico" data-apagar="' + esc(x.id) + '" aria-label="Apagar do histórico" title="Apagar do histórico">✕</button>' : '') + '</div>').join('') + '</div>'
      : '<div class="estado-b7"><b>Nenhuma legenda corrigida ainda.</b><p>As legendas que você baixar ou copiar depois de corrigir ficam guardadas aqui.</p></div>';
    cx.querySelectorAll('[data-baixar]').forEach(b => b.onclick = async () => {
      const r = await sb().from('legendas').select('nome_arquivo,corrigido').eq('id', b.dataset.baixar).single();
      if (r.error) return B7.UI.toast('Não foi possível baixar.', { tipo: 'erro' });
      baixar(r.data.corrigido, nomeCorrigido(r.data.nome_arquivo));
    });
    cx.querySelectorAll('[data-apagar]').forEach(b => b.onclick = async () => {
      if (!await B7.UI.confirmar({ titulo: 'Apagar do histórico?', texto: 'Só some desta lista; o arquivo que você já baixou continua com você.', rotulo: 'Apagar', perigo: true })) return;
      try { await B7.DB.rpc('legenda_apagar', { p_id: b.dataset.apagar }); historico(cx, filtroDemanda); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível apagar.', { tipo: 'erro' }); }
    });
  }

  /* -------------------------------------------------- marcas e termos */
  let clienteTermos = '';
  async function termos(cx) {
    cx.innerHTML = B7.UI.skeleton('lista', { n: 3 });
    const [r, clientes] = await Promise.all([sb().from('legenda_termos').select('id,termo,client_id').order('termo'), B7.DB.listarClientes().catch(() => [])]);
    if (!cx.isConnected) return;
    if (r.error) { cx.innerHTML = '<div class="cb-aviso erro">' + esc(r.error.message) + '</div>'; return; }
    const todos = r.data || [];
    const chips = (l, pode) => l.length ? '<div class="lg-chips">' + l.map(t => '<span class="lg-chip">' + esc(t.termo) +
      (pode ? '<button type="button" data-tirar="' + esc(t.id) + '" aria-label="Tirar ' + esc(t.termo) + '">×</button>' : '') + '</span>').join('') + '</div>'
      : '<p class="gt-vazio">Nenhum termo ainda.</p>';
    const add = (id, pode, ph) => pode ? '<div class="lg-add"><input class="campo" id="' + id + '" maxlength="400" placeholder="' + ph + '"><button class="b fina pri" data-add="' + id + '">Adicionar</button></div>' : '';
    const doCli = todos.filter(t => t.client_id && t.client_id === clienteTermos);
    cx.innerHTML =
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Lista geral</h2></div>' +
        '<p class="gt-nota">Marcas, siglas e nomes que valem para todos os vídeos. A IA sempre usa esta grafia — e o nome de todos os clientes da agência já entra sozinho.</p>' +
        chips(todos.filter(t => !t.client_id), podeGeral() && podeEditar()) + add('lg-add-geral', podeGeral() && podeEditar(), 'Ex.: Instagram, PJe-Calc, DHT (separe por vírgula)') + '</section>' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Do cliente</h2></div>' +
        '<p class="gt-nota">Nome do dono, produtos, procedimentos, bairros… Valem quando o vídeo é deste cliente.</p>' +
        '<div class="mb"><select class="campo" id="lg-tcli"><option value="">Escolha o cliente…</option>' +
          (clientes || []).map(c => '<option value="' + esc(c.id) + '"' + (c.id === clienteTermos ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') + '</select></div>' +
        (clienteTermos ? chips(doCli, podeEditar()) + add('lg-add-cli', podeEditar(), 'Ex.: Dr. Fulano, Botox, Harmonização (separe por vírgula)') : '') + '</section>';
    cx.querySelector('#lg-tcli').onchange = e => { clienteTermos = e.target.value; termos(cx); };
    cx.querySelectorAll('[data-add]').forEach(b => {
      const inp = cx.querySelector('#' + b.dataset.add);
      const ir = async () => {
        const l = inp.value.split(/[,;\n]/).map(x => x.trim()).filter(x => x.length >= 2);
        if (!l.length) return;
        try {
          await B7.DB.rpc('legenda_termo_salvar', { p_client: b.dataset.add === 'lg-add-geral' ? null : clienteTermos, p_termos: l });
          termos(cx);
        } catch (e) { B7.UI.toast(e.message || 'Não foi possível adicionar.', { tipo: 'erro' }); }
      };
      b.onclick = ir; inp.onkeydown = e => { if (e.key === 'Enter') ir(); };
    });
    cx.querySelectorAll('[data-tirar]').forEach(b => b.onclick = async () => {
      try { await B7.DB.rpc('legenda_termo_remover', { p_id: b.dataset.tirar }); termos(cx); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível tirar.', { tipo: 'erro' }); }
    });
  }

  return { abrir, historico, _ler: ler, _montar: montar, _parecido: parecido, _diff: diff };
})();
