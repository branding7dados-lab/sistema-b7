/* =====================================================================
   ADMIN: SESSÕES ATIVAS E USO DA IA (zzz136) — duas janelas de leitura
   em Configurações → Admin, só para administrador (o banco confere).

   B7.Sessoes — em quais aparelhos cada conta está aberta, e encerrar uma
     sessão ou todas as de uma pessoa. Usa o controle de sessões do
     próprio Supabase; não mexe em senha nem em conta. Encerrar derruba o
     aparelho em até 1 minuto (zzz139): a consulta que cada tela faz a cada
     minuto confere se a sessão ainda existe e, se não, sai da conta. O endereço de rede não é mostrado.

   B7.UsoIA — os números do registro de uso da IA (ia_uso): quantas
     chamadas, por quem, em qual tarefa, quantos erros e quanto demorou.
     O texto dos pedidos e das respostas nunca foi guardado, então não há
     conteúdo para mostrar.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Sessoes = (function () {
  const esc = s => B7.UI.esc(s);
  const ROT_PAPEL = { admin: 'Administrador', coordenador: 'Coordenação', designer: 'Design', videomaker: 'Vídeo', cliente: 'Cliente' };

  /* "Chrome · Windows" a partir do que o navegador informa (só para ler; não decide nada) */
  function aparelho(ua) {
    ua = String(ua || '');
    if (!ua) return 'Aparelho não identificado';
    const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
      : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox'
      : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /node|Deno|supabase|python|curl/i.test(ua) ? 'Acesso por programa' : '';
    return [nav, so].filter(Boolean).join(' · ') || ua.slice(0, 40);
  }
  const celular = ua => /iPhone|iPad|Android/.test(String(ua || ''));
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : new Date(iso).toLocaleString('pt-BR'));
  const dia = iso => { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };

  function abrir() {
    const m = B7.UI.modal('<h3>Sessões ativas</h3>' +
      '<p class="sub">Cada linha é um aparelho ou navegador onde a conta está aberta. Encerrar tira o acesso daquele aparelho: com o B7 aberto, ele sai da conta em até 1 minuto, e a pessoa precisa entrar de novo. Não muda a senha.</p>' +
      '<div class="adm-corpo" id="adm-sessoes"><p class="adm-vazio">' + B7.UI.spin() + 'Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#adm-sessoes');

    const pintar = lista => {
      if (!lista.length) { cx.innerHTML = '<p class="adm-vazio">Nenhuma sessão aberta.</p>'; return; }
      const grupos = new Map();
      lista.forEach(s => { if (!grupos.has(s.perfil_id)) grupos.set(s.perfil_id, { nome: s.nome, papel: s.papel, itens: [] }); grupos.get(s.perfil_id).itens.push(s); });
      cx.innerHTML = [...grupos.entries()].map(([id, g]) => {
        const outras = g.itens.filter(s => !s.atual).length;
        return '<section class="adm-grupo"><header><b>' + esc(g.nome) + '</b><small>' + esc(ROT_PAPEL[g.papel] || g.papel || '') + ' · ' +
            g.itens.length + (g.itens.length === 1 ? ' sessão' : ' sessões') + '</small>' +
            (outras > 1 ? '<button type="button" class="adm-link perigo" data-todas="' + esc(id) + '" data-nome="' + esc(g.nome) + '">Encerrar todas</button>' : '') + '</header>' +
          g.itens.map(s => '<div class="adm-sessao"><span class="adm-ic">' + (celular(s.aparelho)
              ? '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.6"/><path d="M11 17.6h2"/></svg>'
              : '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="11" rx="2.2"/><path d="M9 20h6M12 16v4"/></svg>') + '</span>' +
            '<span class="adm-sessao-tx"><b>' + esc(aparelho(s.aparelho)) + (s.atual ? ' <i class="adm-atual">esta sessão</i>' : '') + '</b>' +
              '<small>em uso ' + esc(quando(s.ativa_em)) + ' · aberta em ' + esc(dia(s.criada_em)) + '</small></span>' +
            (s.atual ? '' : '<button type="button" class="b fina contorno" data-encerrar="' + esc(s.sessao) + '" data-nome="' + esc(g.nome) + '">Encerrar</button>') +
          '</div>').join('') + '</section>';
      }).join('');
      cx.querySelectorAll('[data-encerrar]').forEach(b => b.onclick = () => B7.UI.confirmar({
        titulo: 'Encerrar esta sessão de ' + b.dataset.nome + '?', texto: 'Esse aparelho sai da conta em até 1 minuto (se o B7 estiver fechado, ao abrir) e a pessoa precisa entrar de novo. A senha continua a mesma.',
        rotulo: 'Encerrar', perigo: true, aoConfirmar: async () => {
          try { await B7.DB.rpc('sessao_encerrar', { p_sessao: b.dataset.encerrar }); B7.UI.toast('Sessão encerrada.'); carregar(); }
          catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível encerrar.', { tipo: 'erro' }); }
        } }));
      cx.querySelectorAll('[data-todas]').forEach(b => b.onclick = () => B7.UI.confirmar({
        titulo: 'Encerrar todas as sessões de ' + b.dataset.nome + '?', texto: 'Todos os aparelhos dessa conta saem da conta em até 1 minuto. A senha continua a mesma: se a ideia é impedir que a pessoa volte, redefina a senha em Usuários e acessos.',
        rotulo: 'Encerrar todas', perigo: true, aoConfirmar: async () => {
          try { const n = await B7.DB.rpc('sessoes_encerrar_pessoa', { p_perfil: b.dataset.todas }); B7.UI.toast(n + (n === 1 ? ' sessão encerrada.' : ' sessões encerradas.')); carregar(); }
          catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível encerrar.', { tipo: 'erro' }); }
        } }));
    };
    async function carregar() {
      try { const l = await B7.DB.rpc('sessoes_listar', {}); if (cx.isConnected) pintar(l || []); }
      catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível carregar as sessões.') + '</p>'; }
    }
    carregar();
  }

  return { abrir, _aparelho: aparelho };
})();

B7.UsoIA = (function () {
  const esc = s => B7.UI.esc(s);
  const ROT_RECURSO = { chat: 'Assistente (conversa)', roteiro: 'Roteiros', analise: 'Análise de roteiro', linha: 'Linha editorial', resumo: 'Resumos',
    oportunidade: 'Ideias das Oportunidades', voz: 'Voz (transcrição)', agencia: 'Resumo da semana (administrador)' };
  const ROT_ERRO = { indisponivel: 'provedor fora do ar ou lento', limite: 'limite de uso atingido', ocupado: 'muitos pedidos ao mesmo tempo',
    resposta_invalida: 'resposta que não deu para usar', tempo: 'demorou demais', sem_fala: 'áudio sem fala', entrada_invalida: 'pedido inválido', 'sem categoria': 'sem categoria' };
  const seg = ms => (ms >= 1000 ? (ms / 1000).toFixed(1).replace('.', ',') + ' s' : ms + ' ms');
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  let dias = 7;

  function corpo(r) {
    const max = Math.max(1, ...r.por_dia.map(d => d.total));
    const passo = r.por_dia.length > 31 ? 7 : r.por_dia.length > 10 ? 3 : 1;
    const linha = (n, t, e, extra) => '<tr><td>' + esc(n) + '</td><td class="num">' + t + '</td><td class="num' + (e ? ' erro' : '') + '">' + e + '</td>' + (extra !== undefined ? '<td class="num">' + extra + '</td>' : '') + '</tr>';
    return '<div class="adm-kpis">' +
        '<div class="adm-kpi"><b>' + r.hoje.total + '</b><span>chamadas hoje</span>' + (r.hoje.erros ? '<small class="erro">' + r.hoje.erros + ' com erro</small>' : '') + '</div>' +
        '<div class="adm-kpi"><b>' + r.total + '</b><span>nos últimos ' + r.dias + ' dias</span></div>' +
        '<div class="adm-kpi"><b>' + pct(r.erros, r.total) + '%</b><span>deram erro</span><small>' + r.erros + ' de ' + r.total + '</small></div>' +
        '<div class="adm-kpi"><b>' + seg(Number(r.tempo_medio_ms) || 0) + '</b><span>tempo médio do modelo</span></div></div>' +
      '<h4 class="adm-sub">Por dia</h4><div class="adm-barras" role="img" aria-label="Chamadas por dia">' + r.por_dia.map((d, i) => {
        const dt = new Date(d.dia + 'T12:00:00');
        return '<div class="adm-barra" title="' + String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + ': ' + d.total + ' chamadas' + (d.erros ? ', ' + d.erros + ' com erro' : '') + '">' +
          '<span class="adm-barra-n">' + (d.total || '') + '</span><i style="height:' + Math.max(d.total ? 6 : 2, Math.round(d.total / max * 100)) + '%">' +
            (d.erros ? '<u style="height:' + Math.round(d.erros / d.total * 100) + '%"></u>' : '') + '</i>' +
          '<small>' + (i % passo === 0 ? (r.por_dia.length <= 10 ? DOW[dt.getDay()] : String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0')) : '') + '</small></div>';
      }).join('') + '</div>' +
      '<div class="adm-duas"><div><h4 class="adm-sub">Por pessoa</h4>' + (r.por_pessoa.length
          ? '<table class="adm-tab"><thead><tr><th>Quem</th><th class="num">Chamadas</th><th class="num">Erros</th></tr></thead><tbody>' + r.por_pessoa.map(p => linha(p.nome, p.total, p.erros)).join('') + '</tbody></table>'
          : '<p class="adm-vazio">Ninguém usou no período.</p>') + '</div>' +
        '<div><h4 class="adm-sub">Por tarefa</h4>' + (r.por_recurso.length
          ? '<table class="adm-tab"><thead><tr><th>Tarefa</th><th class="num">Chamadas</th><th class="num">Erros</th><th class="num">Tempo</th></tr></thead><tbody>' +
            r.por_recurso.map(x => linha(ROT_RECURSO[x.recurso] || x.recurso, x.total, x.erros, seg(Number(x.tempo_medio_ms) || 0))).join('') + '</tbody></table>'
          : '<p class="adm-vazio">Sem chamadas no período.</p>') + '</div></div>' +
      (r.erros_tipo.length ? '<h4 class="adm-sub">Motivo dos erros</h4><p class="adm-erros">' + r.erros_tipo.map(e =>
        '<span><b>' + e.total + '</b> ' + esc(ROT_ERRO[e.categoria] || e.categoria) + '</span>').join('') + '</p>' : '') +
      '<p class="adm-nota">O B7 limita cada pessoa a 8 pedidos por minuto e 80 por hora. O teto diário do provedor (camada gratuita) não é informado ao sistema, então não dá para mostrar "quanto falta": ' +
        'quando ele estoura, aparece aqui como erro de limite ou de provedor fora do ar.' + (Number(r.reserva) ? ' O provedor reserva foi usado ' + r.reserva + ' vez(es).' : '') + '</p>';
  }

  function abrir() {
    const m = B7.UI.modal('<h3>Uso da IA</h3>' +
      '<div class="adm-periodo" role="radiogroup" aria-label="Período">' + [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([v, r]) =>
        '<button type="button" role="radio" data-dias="' + v + '" aria-checked="' + (v === dias) + '"' + (v === dias ? ' class="on"' : '') + '>' + r + '</button>').join('') + '</div>' +
      '<div class="adm-corpo" id="adm-ia"><p class="adm-vazio">' + B7.UI.spin() + 'Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#adm-ia');
    async function carregar() {
      cx.classList.add('carregando');
      try { const r = await B7.DB.rpc('ia_uso_resumo', { p_dias: dias }); if (cx.isConnected) cx.innerHTML = corpo(r); }
      catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível carregar o uso da IA.') + '</p>'; }
      cx.classList.remove('carregando');
    }
    m.querySelectorAll('[data-dias]').forEach(b => b.onclick = () => {
      dias = Number(b.dataset.dias);
      m.querySelectorAll('[data-dias]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      carregar();
    });
    carregar();
  }

  return { abrir };
})();

/* =====================================================================
   ADMIN: TELAS DO ADMINISTRADOR (zzz139 a zzz144)

   Saúde do sistema, Médico, Comunicado, Aparência, Resumo da semana,
   Redistribuição e o administrador pelo assistente. Todas são janelas
   (B7.UI.modal) com a mesma linguagem visual, definida em
   styles/sistema.css (prefixo "ad-"): cartões, indicadores, barras que
   crescem, entrada em cascata e carregamento em esqueleto. Nada aqui
   roda sozinho: cada janela só consulta quando abre ou quando a pessoa
   aperta o botão.
   ===================================================================== */
B7.AdUI = (function () {
  const esc = s => B7.UI.esc(s);
  const sv = p => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
  const IC = {
    ok: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.3 9.6"/>'),
    alerta: sv('<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17.3v.1"/>'),
    relogio: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>'),
    enviar: sv('<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>'),
    disco: sv('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>'),
    ia: sv('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    agenda: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    pessoas: sv('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M16 5.6a3.2 3.2 0 010 5.8M18.5 14.3c1.6.7 2.6 2.2 2.9 4.4"/>'),
    seta: sv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    chevron: sv('<path d="M6 9l6 6 6-6"/>'),
    atualizar: sv('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>'),
    copiar: sv('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/>'),
    imagem: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>'),
    doc: sv('<path d="M7 3.5h7l4 4V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M14 3.5V8h4M9 13h6M9 16.5h4"/>'),
    video: sv('<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/>'),
    quadro: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9 4.5v15M15 4.5v15"/>'),
    camera: sv('<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.4"/>'),
    pessoa: sv('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.7-3.7 3.5-5.5 7-5.5s6.3 1.8 7 5.5"/>'),
    lido: sv('<path d="M3 12.5l4 4L15 8"/><path d="M10.5 15.5L12 17l9-9"/>'),
    recebido: sv('<path d="M5 12.5l4.5 4.5L19 8"/>'),
    cadeado: sv('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>')
  };
  const ICONE_ACHADO = { sem_logo: 'imagem', sem_linha: 'doc', sem_memoria: 'ia', video_sem_resp: 'video', kanban_sem_resp: 'quadro',
    grav_sem_video: 'camera', sem_funcao: 'pessoa', google_erro: 'agenda' };

  const ini = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const matiz = nome => { let h = 0; String(nome || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 360; }); return h; };
  const avatar = (nome, cls) => '<span class="ad-av' + (cls ? ' ' + cls : '') + '" style="--h:' + matiz(nome) + '" aria-hidden="true">' + esc(ini(nome)) + '</span>';
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : new Date(iso).toLocaleString('pt-BR'));
  const esqueleto = n => '<div class="ad-sk-grupo" aria-hidden="true">' + Array.from({ length: n || 4 }, (_, i) => '<i class="ad-sk" style="--i:' + i + '"></i>').join('') + '</div>';
  const kpi = (o, i) => '<div class="ad-kpi ad-in ' + (o.cls || '') + '" style="--i:' + i + '"><span class="ad-kpi-ic">' + (IC[o.ic] || '') + '</span>' +
    '<b data-conta="' + esc(String(o.v)) + '">' + esc(String(o.v)) + '</b><span class="ad-kpi-l">' + esc(o.l) + '</span>' +
    (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') +
    (o.bar != null ? '<i class="ad-bar" aria-hidden="true"><u data-w="' + Math.max(2, Math.min(100, o.bar)) + '"></u></i>' : '') + '</div>';
  /* barras que crescem depois de pintadas (a transição só roda se a largura muda depois da primeira pintura) */
  const crescer = raiz => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (raiz && raiz.isConnected) raiz.querySelectorAll('u[data-w]').forEach(u => { u.style.width = u.dataset.w + '%'; });
  }));
  /* os números sobem até o valor (só inteiros; sem movimento reduzido) */
  function contar(raiz) {
    if (!raiz || (B7.Desempenho && B7.Desempenho.animacoesLigadas && !B7.Desempenho.animacoesLigadas())) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    raiz.querySelectorAll('b[data-conta]').forEach(b => {
      const alvo = b.dataset.conta, m = /^(\d+)(.*)$/.exec(alvo);
      if (!m || Number(m[1]) < 2) return;
      const n = Number(m[1]), suf = m[2], t0 = performance.now(), dur = 700;
      const passo = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); b.textContent = Math.round(n * e) + suf; if (p < 1 && b.isConnected) requestAnimationFrame(passo); };
      requestAnimationFrame(passo);
    });
  }
  return { esc, IC, ICONE_ACHADO, ini, avatar, quando, esqueleto, kpi, crescer, contar };
})();

/* ---------------------------------------------------------------- SAÚDE */
B7.Saude = (function () {
  const U = B7.AdUI, esc = U.esc;
  const ROT_ROTINA = {
    'agenda-lembretes': ['Lembretes da agenda', 'a cada 5 minutos', 15],
    'notif-agendados': ['Avisos agendados (resumo do dia e parados)', 'de hora em hora, das 8h às 19h', 0],
    'oportunidades-sync': ['Atualização das Oportunidades', 'toda segunda-feira', 0]
  };
  const mb = b => b >= 1073741824 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' GB' : Math.round(b / 1048576) + ' MB';
  const LIMITE_ARQUIVOS = 1073741824;           /* 1 GB: o limite do plano para os arquivos */
  const idade = iso => iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null;

  function avaliar(r) {
    const pontos = [];
    const linhas = (r.rotinas || []).map(j => {
      const rot = ROT_ROTINA[j.nome] || [j.nome, j.agenda, 0];
      const min = idade(j.ultima);
      let cls = 'ok', tx = j.ultima ? 'rodou ' + U.quando(j.ultima) : 'ainda não rodou';
      if (!j.ativa) { cls = 'erro'; tx = 'desligada'; pontos.push(rot[0] + ' está desligada.'); }
      else if (j.status && j.status !== 'succeeded') { cls = 'erro'; tx = 'falhou ' + U.quando(j.ultima); pontos.push(rot[0] + ' falhou na última vez.'); }
      else if (rot[2] && min !== null && min > rot[2]) { cls = 'erro'; tx = 'parada: última vez ' + U.quando(j.ultima); pontos.push(rot[0] + ' não roda há ' + min + ' minutos.'); }
      else if (!j.ultima) cls = 'neutro';
      return { nome: rot[0], quando: rot[1], cls, tx };
    });
    const p = r.push || {}, g = (r.google || [])[0], ia = r.ia || {};
    const itens = [];
    itens.push({ ic: 'enviar', nome: 'Avisos no celular e no computador (push)', cls: Number(p.falhas24) > 0 ? 'erro' : 'ok',
      tx: (Number(p.ok24) || 0) + ' enviados nas últimas 24 h' + (Number(p.falhas24) ? ', ' + p.falhas24 + ' com falha' : '') + ' · ' + (p.aparelhos || 0) + ' aparelhos cadastrados' });
    if (Number(p.falhas24) > 0) pontos.push(p.falhas24 + ' aviso(s) push falharam nas últimas 24 h.');
    itens.push({ ic: 'agenda', nome: 'Google Agenda', cls: g && g.status === 'ativa' ? 'ok' : (g ? 'erro' : 'neutro'),
      tx: g ? (g.status === 'ativa' ? 'conectado · última sincronização ' + U.quando(g.ultima) : 'status "' + g.status + '"' + (g.erro ? ': ' + g.erro : '')) : 'nenhuma conta conectada' });
    if (g && g.status !== 'ativa') pontos.push('O Google Agenda não está conectado.');
    const taxa = ia.total24 ? Number(ia.erros24) / Number(ia.total24) : 0;
    itens.push({ ic: 'ia', nome: 'Assistente (IA)', cls: taxa > 0.3 ? 'erro' : 'ok',
      tx: (ia.total24 || 0) + ' pedidos nas últimas 24 h' + (ia.erros24 ? ', ' + ia.erros24 + ' com erro (' + Math.round(taxa * 100) + '%)' : '') });
    if (taxa > 0.3) pontos.push('Mais de 30% dos pedidos à IA deram erro nas últimas 24 h.');
    const usoArq = Number(r.arquivos_bytes) / LIMITE_ARQUIVOS;
    if (usoArq > 0.8) pontos.push('Os arquivos já usam mais de 80% do espaço.');
    return { pontos, linhas, itens, usoArq, taxa };
  }

  function corpo(r) {
    const a = avaliar(r), p = r.push || {}, ia = r.ia || {};
    const emDia = a.linhas.filter(l => l.cls !== 'erro').length;
    const kpis = [
      { ic: 'relogio', v: emDia + '/' + a.linhas.length, l: 'rotinas em dia', cls: a.linhas.some(l => l.cls === 'erro') ? 'erro' : 'ok' },
      { ic: 'enviar', v: Number(p.ok24) || 0, l: 'avisos em 24 h', sub: Number(p.falhas24) ? p.falhas24 + ' falharam' : 'nenhuma falha', cls: Number(p.falhas24) ? 'erro' : 'ok' },
      { ic: 'disco', v: Math.round(a.usoArq * 100) + '%', l: 'espaço dos arquivos', sub: mb(Number(r.arquivos_bytes)) + ' de 1 GB', bar: a.usoArq * 100, cls: a.usoArq > 0.8 ? 'erro' : '' },
      { ic: 'ia', v: ia.total24 || 0, l: 'pedidos à IA em 24 h', sub: ia.erros24 ? ia.erros24 + ' com erro' : 'sem erro', cls: a.taxa > 0.3 ? 'erro' : '' }
    ];
    const n = a.pontos.length;
    const linha = (l, i) => '<div class="ad-linha ad-in" style="--i:' + (i + 5) + '"><i class="ad-ponto ' + l.cls + '"></i>' +
      '<span class="ad-linha-tx"><b>' + esc(l.nome) + '</b><small>' + esc(l.quando) + ' · ' + esc(l.tx) + '</small></span></div>';
    const servico = (l, i) => '<div class="ad-linha ad-in" style="--i:' + (i + 9) + '"><span class="ad-linha-ic ' + l.cls + '">' + U.IC[l.ic] + '</span>' +
      '<span class="ad-linha-tx"><b>' + esc(l.nome) + '</b><small>' + esc(l.tx) + '</small></span></div>';
    return '<div class="ad-banner ' + (n ? 'atencao' : 'ok') + ' ad-in" style="--i:0"><span class="ad-banner-ic">' + (n ? U.IC.alerta : U.IC.ok) + '</span>' +
        '<span class="ad-banner-tx"><b>' + (n ? (n === 1 ? '1 ponto de atenção' : n + ' pontos de atenção') : 'Tudo certo') + '</b>' +
        (n ? '<ul>' + a.pontos.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<small>Nada fora do normal agora.</small>') + '</span></div>' +
      '<div class="ad-kpis">' + kpis.map((k, i) => U.kpi(k, i + 1)).join('') + '</div>' +
      '<section class="ad-cartao"><h4 class="ad-t">Rotinas agendadas</h4>' + a.linhas.map(linha).join('') + '</section>' +
      '<section class="ad-cartao"><h4 class="ad-t">Serviços</h4>' + a.itens.map(servico).join('') +
        '<div class="ad-linha ad-in" style="--i:12"><span class="ad-linha-ic">' + U.IC.disco + '</span><span class="ad-linha-tx"><b>Banco de dados</b><small>' + mb(Number(r.banco_bytes)) + ' usados</small></span></div>' +
        '<div class="ad-linha ad-in" style="--i:13"><span class="ad-linha-ic">' + U.IC.pessoas + '</span><span class="ad-linha-tx"><b>Equipe agora</b><small>' + r.online + ' online de ' + r.equipe + ' na equipe</small></span></div></section>' +
      '<p class="ad-nota">Só leitura. Quem está com uma versão antiga do B7 aberta não aparece aqui: o sistema não guarda a versão de cada aparelho.</p>';
  }

  function abrir() {
    const m = B7.UI.modal('<h3>Saúde do sistema</h3><p class="sub">Se as rotinas rodaram, se os avisos estão saindo e quanto espaço sobra.</p>' +
      '<div class="ad-corpo" id="sd-corpo">' + U.esqueleto(5) + '</div>' +
      '<div class="acoes"><span class="ad-atual" id="sd-quando"></span><button type="button" class="b contorno ad-bt-ic" id="sd-atualizar">' + U.IC.atualizar + '<span>Atualizar</span></button><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#sd-corpo'), bt = m.querySelector('#sd-atualizar');
    async function carregar() {
      bt.classList.add('girando'); bt.disabled = true; cx.classList.add('carregando');
      try {
        const r = await B7.DB.rpc('saude_sistema', {});
        if (!cx.isConnected) return;
        cx.innerHTML = corpo(r); U.crescer(cx); U.contar(cx);
        m.querySelector('#sd-quando').textContent = 'atualizado às ' + new Date().toTimeString().slice(0, 5);
      } catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="ad-vazio">' + esc((e && e.message) || 'Não foi possível carregar.') + '</p>'; }
      cx.classList.remove('carregando'); bt.classList.remove('girando'); bt.disabled = false;
    }
    bt.onclick = carregar;
    carregar();
  }
  return { abrir, _avaliar: avaliar };
})();

/* --------------------------------------------------------------- MÉDICO */
B7.Medico = (function () {
  const U = B7.AdUI, esc = U.esc;
  function corpo(r) {
    const l = r.achados || [];
    if (!l.length) return '<div class="ad-banner ok ad-in" style="--i:0"><span class="ad-banner-ic">' + U.IC.ok + '</span><span class="ad-banner-tx"><b>Nada para corrigir</b><small>Os cadastros que o médico confere estão completos.</small></span></div>';
    const total = l.reduce((s, a) => s + a.qtd, 0);
    return '<div class="ad-banner atencao ad-in" style="--i:0"><span class="ad-banner-ic">' + U.IC.alerta + '</span><span class="ad-banner-tx"><b>' + total + (total === 1 ? ' pendência' : ' pendências') +
        ' em ' + l.length + (l.length === 1 ? ' área' : ' áreas') + '</b><small>Abra cada área para ver os casos. Nada é corrigido sozinho.</small></span></div>' +
      l.map((a, i) => '<details class="ad-acc ad-in" style="--i:' + (i + 1) + '"' + (i === 0 ? ' open' : '') + '><summary>' +
        '<span class="ad-acc-ic">' + (U.IC[U.ICONE_ACHADO[a.id]] || U.IC.alerta) + '</span>' +
        '<span class="ad-acc-tx"><b>' + esc(a.titulo) + '</b><small>' + esc(a.dica) + '</small></span>' +
        '<span class="ad-acc-n">' + a.qtd + '</span><span class="ad-acc-seta">' + U.IC.chevron + '</span></summary>' +
        '<div class="ad-acc-corpo">' + a.itens.map(x => '<div class="ad-item"><span>' + esc(x.nome) + '</span>' +
          '<button type="button" class="ad-abrir" data-rota="' + esc(x.rota) + '" aria-label="Abrir ' + esc(x.nome) + '">Abrir' + U.IC.seta + '</button></div>').join('') +
        (a.qtd > a.itens.length ? '<p class="ad-mais">e mais ' + (a.qtd - a.itens.length) + '…</p>' : '') + '</div></details>').join('');
  }
  function abrir() {
    const m = B7.UI.modal('<h3>Médico do sistema</h3><p class="sub">Procura o que está incompleto nos cadastros. Não corrige nada sozinho: o botão Abrir leva até o registro.</p>' +
      '<div class="ad-corpo" id="md-corpo">' + U.esqueleto(4) + '</div>' +
      '<div class="acoes"><button type="button" class="b contorno ad-bt-ic" id="md-atualizar">' + U.IC.atualizar + '<span>Procurar de novo</span></button><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#md-corpo'), bt = m.querySelector('#md-atualizar');
    async function carregar() {
      bt.classList.add('girando'); bt.disabled = true; cx.classList.add('carregando');
      try {
        const r = await B7.DB.rpc('medico_achados', {});
        if (!cx.isConnected) return;
        cx.innerHTML = corpo(r || {});
        cx.querySelectorAll('[data-rota]').forEach(b => b.onclick = () => { m.fechar(); location.hash = b.dataset.rota; });
      } catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="ad-vazio">' + esc((e && e.message) || 'Não foi possível procurar.') + '</p>'; }
      cx.classList.remove('carregando'); bt.classList.remove('girando'); bt.disabled = false;
    }
    bt.onclick = carregar;
    carregar();
  }
  return { abrir };
})();

/* ----------------------------------------------------------- COMUNICADO */
B7.Comunicado = (function () {
  const U = B7.AdUI, esc = U.esc;
  const FN = { coordenador: 'Coordenação', videomaker: 'Videomakers', designer: 'Designers' };
  const MODELOS = ['Reunião hoje às ', 'Lembrete: ', 'Atenção equipe: '];
  async function equipe() {
    const eu = B7.Auth.usuario() && B7.Auth.usuario().id;
    const { data, error } = await B7.sb.from('perfis').select('id, nome, username, funcao, papel').eq('estado', 'ativa').neq('papel', 'cliente').order('nome');
    if (error) throw error;
    return (data || []).filter(p => p.id !== eu);
  }
  const horaDe = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function abrir() {
    const m = B7.UI.modal('<h3>Comunicado pela conversa</h3>' +
      '<p class="sub">A mensagem chega na conversa de cada pessoa escolhida, com aviso. Cada um vê só a própria conversa com você. Você acompanha quem já leu.</p>' +
      '<div class="cm-grade"><div class="cm-esq">' +
        '<label class="rot" for="cm-texto">MENSAGEM</label>' +
        '<div class="cm-campo"><textarea class="campo" id="cm-texto" rows="4" maxlength="2000" placeholder="Ex.: Amanhã a gravação do Cantinho do Posto será às 9h." data-foco></textarea>' +
          '<div class="cm-rodape"><span class="cm-modelos">' + MODELOS.map(t => '<button type="button" class="ad-chip" data-modelo="' + esc(t) + '">' + esc(t.trim().replace(/:$/, '')) + '</button>').join('') + '</span>' +
          '<span class="cm-cont" id="cm-cont">0/2000</span></div></div>' +
        '<label class="rot">PARA QUEM</label><div id="cm-quem" class="cm-quem">' + U.esqueleto(2) + '</div></div>' +
        '<div class="cm-dir"><label class="rot">COMO VAI CHEGAR</label><div class="cm-previa"><div class="cm-previa-topo">' + U.avatar('Você', 'p') + '<b>Você</b></div>' +
          '<div class="cm-bolha"><span class="conv-comun">Comunicado</span><p id="cm-previa-tx" class="vazio">Sua mensagem aparece aqui.</p><time>' + horaDe(new Date().toISOString()) + '</time></div></div></div></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b pri ad-bt-ic" id="cm-enviar" disabled>' + U.IC.enviar + '<span>Enviar</span></button></div>' +
      '<h4 class="ad-t ad-t-solto">Enviados</h4><div id="cm-lista" class="ad-corpo ad-corpo-baixo">' + U.esqueleto(2) + '</div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const quem = m.querySelector('#cm-quem'), enviar = m.querySelector('#cm-enviar'), texto = m.querySelector('#cm-texto');
    let pessoas = [];
    const marcados = () => [...quem.querySelectorAll('input[data-p]:checked')].map(i => i.dataset.p);
    const atualizar = () => {
      const n = marcados().length, t = texto.value;
      enviar.disabled = !t.trim() || !n;
      enviar.querySelector('span').textContent = n ? 'Enviar para ' + n + (n === 1 ? ' pessoa' : ' pessoas') : 'Enviar';
      m.querySelector('#cm-cont').textContent = t.length + '/2000';
      const pv = m.querySelector('#cm-previa-tx'); pv.textContent = t.trim() || 'Sua mensagem aparece aqui.'; pv.classList.toggle('vazio', !t.trim());
      texto.style.height = 'auto'; texto.style.height = Math.min(220, Math.max(96, texto.scrollHeight + 2)) + 'px';
      /* os atalhos de grupo acompanham as escolhas */
      quem.querySelectorAll('[data-grupo]').forEach(g => {
        const ids = pessoas.filter(p => g.dataset.grupo === 'todos' || p.funcao === g.dataset.grupo).map(p => p.id);
        const todos = ids.length && ids.every(id => quem.querySelector('input[data-p="' + id + '"]').checked);
        g.classList.toggle('on', !!todos); g.setAttribute('aria-pressed', String(!!todos));
      });
    };
    equipe().then(l => {
      pessoas = l;
      const grupos = [['todos', 'Toda a equipe']].concat(Object.keys(FN).filter(f => l.some(p => p.funcao === f)).map(f => [f, FN[f]]));
      quem.innerHTML = '<div class="cm-grupos">' + grupos.map(g => '<button type="button" class="ad-chip" data-grupo="' + g[0] + '" aria-pressed="false">' + esc(g[1]) + '</button>').join('') + '</div>' +
        '<div class="cm-pessoas">' + l.map(p => '<label class="cm-pessoa"><input type="checkbox" data-p="' + esc(p.id) + '" checked>' +
          U.avatar(p.nome || p.username) + '<span><b>' + esc(p.nome || p.username) + '</b>' + (p.funcao ? '<small>' + esc(FN[p.funcao] || p.funcao) + '</small>' : '') + '</span></label>').join('') + '</div>';
      quem.querySelectorAll('[data-grupo]').forEach(g => g.onclick = () => {
        const ids = pessoas.filter(p => g.dataset.grupo === 'todos' || p.funcao === g.dataset.grupo).map(p => p.id);
        const ligar = !g.classList.contains('on'), todosOn = quem.querySelector('[data-grupo="todos"]').classList.contains('on');
        /* com todos marcados, tocar num grupo escolhe SÓ aquele grupo; depois, cada grupo liga ou desliga os seus */
        if (g.dataset.grupo !== 'todos' && todosOn) quem.querySelectorAll('input[data-p]').forEach(i => { i.checked = ids.includes(i.dataset.p); });
        else ids.forEach(id => { quem.querySelector('input[data-p="' + id + '"]').checked = ligar; });
        atualizar();
      });
      quem.querySelectorAll('input[data-p]').forEach(i => i.onchange = atualizar);
      atualizar();
    }).catch(() => { quem.innerHTML = '<span class="ad-vazio">Não foi possível carregar a equipe.</span>'; });
    texto.addEventListener('input', atualizar);
    m.querySelectorAll('[data-modelo]').forEach(b => b.onclick = () => { texto.value = (texto.value ? texto.value + ' ' : '') + b.dataset.modelo; texto.focus(); atualizar(); });
    enviar.onclick = async () => {
      const ids = marcados(); if (!ids.length || !texto.value.trim()) return;
      enviar.disabled = true; enviar.classList.add('enviando'); enviar.querySelector('span').textContent = 'Enviando…';
      try {
        await B7.DB.rpc('chat_comunicado', { p_texto: texto.value.trim(), p_destinos: ids });
        enviar.classList.remove('enviando'); enviar.classList.add('enviado'); enviar.querySelector('span').textContent = 'Enviado';
        B7.UI.toast('Comunicado enviado para ' + ids.length + (ids.length === 1 ? ' pessoa.' : ' pessoas.'));
        texto.value = ''; lista(true);
        setTimeout(() => { if (enviar.isConnected) { enviar.classList.remove('enviado'); atualizar(); } }, 1400);
      } catch (e) { enviar.classList.remove('enviando'); B7.UI.toast((e && e.message) || 'Não foi possível enviar.', { tipo: 'erro' }); atualizar(); }
    };
    const cxLista = m.querySelector('#cm-lista');
    async function lista(novo) {
      try {
        const l = await B7.DB.rpc('chat_comunicados_lista', {});
        if (!cxLista.isConnected) return;
        cxLista.innerHTML = (l && l.length) ? l.map((c, i) => {
          const pct = c.total ? Math.round(c.lidos / c.total * 100) : 0;
          return '<article class="cm-env ad-in' + (novo && i === 0 ? ' novo' : '') + '" style="--i:' + i + '"><p>' + esc(c.texto) + '</p>' +
            '<div class="cm-env-meta"><small>' + esc(U.quando(c.created_at)) + '</small><span class="cm-prog"><i class="ad-bar"><u data-w="' + Math.max(pct, 3) + '"></u></i><small>lido por <b>' + c.lidos + '</b> de ' + c.total + '</small></span>' +
            '<button type="button" class="adm-link" data-lidos="' + esc(c.id) + '" aria-expanded="false">Ver quem leu</button></div><div class="cm-leu" data-leu="' + esc(c.id) + '"></div></article>';
        }).join('') : '<p class="ad-vazio">Nenhum comunicado enviado ainda.</p>';
        U.crescer(cxLista);
        cxLista.querySelectorAll('[data-lidos]').forEach(b => b.onclick = async () => {
          const alvo = cxLista.querySelector('[data-leu="' + b.dataset.lidos + '"]');
          if (alvo.classList.contains('aberto')) { alvo.classList.remove('aberto'); b.setAttribute('aria-expanded', 'false'); b.textContent = 'Ver quem leu'; return; }
          try {
            const r = await B7.DB.rpc('chat_comunicado_lidos', { p_id: b.dataset.lidos });
            alvo.innerHTML = r.map(x => '<div class="cm-leu-l ' + (x.lida ? 'leu' : x.entregue ? 'rec' : 'nao') + '">' + U.avatar(x.nome, 'p') + '<b>' + esc(x.nome) + '</b>' +
              '<span>' + (x.lida ? U.IC.lido + 'leu ' + esc(U.quando(x.lida_em)) : x.entregue ? U.IC.recebido + 'recebeu, não leu' : U.IC.relogio + 'ainda não recebeu') + '</span></div>').join('');
            alvo.classList.add('aberto'); b.setAttribute('aria-expanded', 'true'); b.textContent = 'Esconder';
          } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível ver.', { tipo: 'erro' }); }
        });
      } catch (e) { if (cxLista.isConnected) cxLista.innerHTML = '<p class="ad-vazio">' + esc((e && e.message) || 'Não foi possível carregar.') + '</p>'; }
    }
    lista();
  }
  /* usado pelo assistente (zzz142): o texto vai para todos ou para uma função */
  async function enviarPara(texto, para) {
    const l = await equipe();
    const alvo = para === 'todos' ? l : l.filter(p => p.funcao === para);
    if (!alvo.length) throw new Error('Ninguém da equipe com essa função.');
    await B7.DB.rpc('chat_comunicado', { p_texto: texto, p_destinos: alvo.map(p => p.id) });
    return alvo.length;
  }
  return { abrir, enviarPara };
})();

/* ------------------------------------------------------------ APARÊNCIA (5.23.1: só a identidade Espectro)
   A paleta da marca: Padrão B7, Matriz ou Laser (quadro "Config-aparencia"). O administrador escolhe o
   padrão da equipe (sistema_config.aparencia, entregue na consulta de cada minuto, sistema_avisos) e cada
   pessoa pode ter a sua só neste aparelho (b7_ap_pessoal) — enquanto tiver, a dela manda.
   A paleta vira html[data-paleta] (styles/espectro/paletas.css); o <head> do index.html lê as mesmas cópias
   do aparelho para pintar antes da primeira pintura. Claro ou escuro continua sendo escolha de cada pessoa.
   As opções do visual antigo (11 cores, cor personalizada, menu, botões, brilho, fundos, cantos e as datas
   especiais da abertura) saíram junto com ele. Só visual: nada de regra, acesso ou dado. */
B7.Aparencia = (function () {
  const esc = B7.AdUI.esc;
  const CHAVE = 'b7_sis_aparencia', CHAVE_EU = 'b7_ap_pessoal';
  const PALETAS = [
    { id: 'b7', nome: 'Padrão B7', faixa: ['#001561', '#520083', '#7328A5', '#E02F75', '#FF5A57'] },
    { id: 'matriz', nome: 'Matriz', faixa: ['#001561', '#0A2A8A', '#2A4BC0', '#6E86E0', '#C9D3F5'] },
    { id: 'laser', nome: 'Laser', faixa: ['#520083', '#E02F75', '#FF5A57', '#FF8E6B', '#FFD2C2'] }
  ];
  /* qualquer coisa que não seja uma das 3 (inclusive as paletas antigas guardadas) vira o Padrão B7 */
  const paleta = c => (c && PALETAS.some(p => p.id === c.paleta)) ? c.paleta : 'b7';
  const normalizar = c => ({ paleta: paleta(c) });
  const ler = k => { try { const c = JSON.parse(localStorage.getItem(k) || 'null'); return c ? normalizar(c) : null; } catch (e) { return null; } };
  let cfg = ler(CHAVE) || { paleta: 'b7' };
  let meu = ler(CHAVE_EU);
  const efetiva = () => meu || cfg;

  function pintar(c) {
    const r = document.documentElement, id = paleta(c);
    if (id === 'b7') r.removeAttribute('data-paleta'); else r.setAttribute('data-paleta', id);
  }
  /* as cópias antigas do aparelho podiam trazer CSS do visual antigo: regrava só com a paleta */
  (function limparCopias() {
    try {
      if (meu) localStorage.setItem(CHAVE_EU, JSON.stringify(meu));
      if (localStorage.getItem(CHAVE)) { if (cfg.paleta === 'b7') localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, JSON.stringify(cfg)); }
    } catch (e) {}
    const velho = document.getElementById('b7-aparencia'); if (velho) velho.remove();
    document.documentElement.removeAttribute('data-ap');
    pintar(efetiva());
  })();

  function guardarPessoal(c) {
    meu = c ? normalizar(c) : null;
    try { if (!meu) localStorage.removeItem(CHAVE_EU); else localStorage.setItem(CHAVE_EU, JSON.stringify(meu)); } catch (e) {}
    aplicar();
  }
  function aplicar(c) { pintar(c || efetiva()); }
  /* recebe o que veio do banco; null = conta que não recebe (Portal) */
  function sincronizar(c) {
    if (c === null || c === undefined || typeof c !== 'object') return;
    cfg = normalizar(c);
    pintar(efetiva());
    try { if (cfg.paleta === 'b7') localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, JSON.stringify(cfg)); } catch (e) {}
  }
  /* a cópia do aparelho pode estar atrasada: antes de editar, lê o que está no banco */
  async function trazer() {
    try { const r = await B7.DB.rpc('sistema_avisos'); if (r && r.aparencia) sincronizar(r.aparencia); } catch (e) {}
  }
  /* o banco ainda guarda os campos de antes: vão no padrão (sem datas especiais, que eram do visual antigo) */
  const gravar = c => B7.DB.rpc('aparencia_definir', { p_valor: { paleta: paleta(c), cor: '', menu: 'padrao', botoes: 'degrade', brilho: false, tinta: 'suave', cantos: 'padrao', estacoes: [] } });
  async function definirPaleta(p) {
    await trazer();
    const nova = { paleta: paleta({ paleta: p }) };
    await gravar(nova); sincronizar(nova);
  }
  const rotuloPaleta = id => PALETAS.find(x => x.id === paleta({ paleta: id })).nome;
  const resumo = () => rotuloPaleta(cfg.paleta);
  const resumoPessoal = () => meu ? rotuloPaleta(meu.paleta) + ' · sua escolha' : rotuloPaleta(cfg.paleta) + ' · o padrão do sistema';

  /* troca de cor com um esmaecer suave da tela inteira, onde o navegador deixa */
  function aplicarSuave(c) {
    const anima = document.startViewTransition && !(B7.Desempenho && B7.Desempenho.animacoesLigadas && !B7.Desempenho.animacoesLigadas()) &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pinta = () => pintar(c);
    if (!anima) return pinta();
    try { const vt = document.startViewTransition(pinta); vt.ready.catch(() => {}); vt.finished.catch(() => {}); } catch (e) { pinta(); }
  }

  /* a paleta da equipe (administrador): as 3 da marca em cartões */
  async function abrir() {
    await trazer();
    const OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const m = B7.UI.modal('<h3>Paleta da equipe</h3><p class="sub">O padrão de quem não escolheu a sua em Configurações → Aparência. As 3 dentro da nova marca.</p>' +
      '<div class="cfg-cores cfg-pals" role="radiogroup" aria-label="Paleta da equipe">' + PALETAS.map(p =>
        '<button type="button" role="radio" class="cfg-cor cfg-pal' + (paleta(cfg) === p.id ? ' on' : '') + '" aria-checked="' + (paleta(cfg) === p.id) + '" data-pal="' + p.id + '">' +
        '<span class="cfg-pal-faixa">' + p.faixa.map(c => '<b style="background:' + c + '"></b>').join('') + '</span>' +
        '<span class="cfg-pal-pe"><span>' + esc(p.nome) + '</span>' + OK + '</span></button>').join('') + '</div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button></div>');
    m.querySelectorAll('[data-pal]').forEach(b => b.onclick = async () => {
      if (b.classList.contains('on')) return;
      m.querySelectorAll('[data-pal]').forEach(x => { x.disabled = true; });
      try {
        await definirPaleta(b.dataset.pal);
        m.querySelectorAll('[data-pal]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        B7.UI.toast('Paleta da equipe: ' + rotuloPaleta(b.dataset.pal) + '. A equipe recebe em até 1 minuto.');
        if (location.hash.indexOf('#/config') === 0 && B7.Dashboard && B7.Dashboard.abrirConfig) B7.Dashboard.abrirConfig();
      } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
      m.querySelectorAll('[data-pal]').forEach(x => { x.disabled = false; });
    });
  }

  /* escolher a paleta direto na tela de Configurações — vale só para a pessoa, neste aparelho */
  function escolherRapido(id) {
    if (id === 'equipe') { guardarPessoal(null); aplicarSuave(efetiva()); return; }
    meu = normalizar({ paleta: id });
    aplicarSuave(meu);
    try { localStorage.setItem(CHAVE_EU, JSON.stringify(meu)); } catch (e) {}
  }
  /* os cartões de paleta para a tela de Configurações */
  function bolinhas() {
    const atual = paleta(efetiva());
    return PALETAS.map(p => ({ id: p.id, nome: p.nome, faixa: p.faixa, fundo: 'linear-gradient(135deg,' + p.faixa.join(',') + ')', on: atual === p.id }));
  }

  return { abrir, sincronizar, aplicar, escolherRapido, bolinhas, resumo, resumoPessoal, definirPaleta, rotuloPaleta,
           paletaAtual: () => paleta(efetiva()), pessoal: () => meu, usarDoSistema: () => guardarPessoal(null), PALETAS };
})();

/* ------------------------------------------------- RESUMO DA SEMANA (IA) */
B7.ResumoAgencia = (function () {
  const U = B7.AdUI, esc = U.esc;
  const SECOES = { 'O QUE ANDOU': ['ok', 'ok'], 'O QUE TRAVOU': ['alerta', 'alerta'], 'CARGA': ['pessoas', ''], 'PARA OLHAR PRIMEIRO': ['seta', 'foco'] };
  const FRASES = ['Lendo os números…', 'Escrevendo o resumo…', 'Conferindo se os números batem…'];

  function numeros(d) {
    const v = d.video || {}, g = d.design || {}, c = d.conteudo || {}, gr = d.gravacoes || {};
    return [
      { ic: 'video', v: Number(v.entregues_7d) || 0, l: 'vídeos entregues' },
      { ic: 'quadro', v: Number(g.finalizadas_7d) || 0, l: 'peças finalizadas' },
      { ic: 'enviar', v: Number(c.publicados_7d) || 0, l: 'conteúdos publicados' },
      { ic: 'camera', v: Number(gr.realizadas_7d) || 0, l: 'gravações realizadas' },
      { ic: 'alerta', v: Number(v.atrasadas) || 0, l: 'vídeos com prazo vencido', cls: Number(v.atrasadas) ? 'erro' : 'ok' },
      { ic: 'relogio', v: Number(g.paradas_5d) || 0, l: 'peças paradas há 5+ dias', cls: Number(g.paradas_5d) ? 'atencao' : 'ok' }
    ];
  }
  function secoes(texto) {
    const out = []; let atual = null;
    String(texto || '').split('\n').forEach(bruta => {
      const linha = bruta.trim(); if (!linha) return;
      const m = /^(O QUE ANDOU|O QUE TRAVOU|CARGA|PARA OLHAR PRIMEIRO)\s*:\s*(.*)$/i.exec(linha);
      if (m) { atual = { t: m[1].toUpperCase(), itens: [] }; out.push(atual); if (m[2]) atual.itens.push({ tipo: 'p', tx: m[2] }); return; }
      if (!atual) { atual = { t: '', itens: [] }; out.push(atual); }
      atual.itens.push(/^[-•]\s+/.test(linha) ? { tipo: 'li', tx: linha.replace(/^[-•]\s+/, '') } : { tipo: 'p', tx: linha });
    });
    return out;
  }
  function renderTexto(texto) {
    return secoes(texto).map((s, i) => {
      const cfg = SECOES[s.t] || ['doc', ''], lis = s.itens.filter(x => x.tipo === 'li'), ps = s.itens.filter(x => x.tipo === 'p');
      return '<section class="ra-sec ad-in ' + cfg[1] + '" style="--i:' + i + '"><span class="ra-sec-ic">' + (U.IC[cfg[0]] || U.IC.doc) + '</span><div>' +
        (s.t ? '<h5>' + esc(s.t.charAt(0) + s.t.slice(1).toLowerCase()) + '</h5>' : '') + ps.map(p => '<p>' + esc(p.tx) + '</p>').join('') +
        (lis.length ? '<ul>' + lis.map(l => '<li>' + esc(l.tx) + '</li>').join('') + '</ul>' : '') + '</div></section>';
    }).join('');
  }
  function abrir() {
    const m = B7.UI.modal('<h3>Resumo da semana</h3>' +
      '<p class="sub">Os últimos 7 dias da agência. Os números vêm do sistema; a IA só escreve em cima deles. Só é gerado quando você pede, e nada fica guardado.</p>' +
      '<div class="ad-kpis ra-kpis" id="ra-kpis">' + U.esqueleto(1) + '</div>' +
      '<details class="ra-dir"><summary>Direcionar a leitura <small>(opcional)</small></summary><input class="campo" id="ra-dir" maxlength="300" placeholder="Ex.: dê mais atenção ao vídeo" autocomplete="off"></details>' +
      '<div class="ad-corpo" id="ra-corpo"><div class="ra-vazio"><span>' + U.IC.ia + '</span><b>Pronto para escrever</b><small>Aperte “Gerar resumo” para ler a semana em texto.</small></div></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b contorno ad-bt-ic ad-oculto" id="ra-copiar">' + U.IC.copiar + '<span>Copiar</span></button>' +
      '<button type="button" class="b pri ad-bt-ic" id="ra-gerar">' + U.IC.ia + '<span>Gerar resumo</span></button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#ra-corpo'), gerar = m.querySelector('#ra-gerar'), copiar = m.querySelector('#ra-copiar'), kp = m.querySelector('#ra-kpis');
    B7.DB.rpc('agencia_semana_dados', {}).then(d => {
      if (!kp.isConnected) return;
      kp.innerHTML = numeros(d || {}).map((k, i) => U.kpi(k, i)).join(''); U.contar(kp);
    }).catch(() => { if (kp.isConnected) kp.innerHTML = ''; });
    let texto = '', relogio = 0;
    gerar.onclick = async () => {
      gerar.disabled = true; gerar.querySelector('span').textContent = 'Gerando…'; copiar.classList.add('ad-oculto');
      let k = 0;
      const frase = () => '<div class="ra-gerando"><div class="ra-pontos" aria-hidden="true"><i></i><i></i><i></i></div><b id="ra-frase">' + FRASES[k % FRASES.length] + '</b></div>' + U.esqueleto(4);
      cx.innerHTML = frase();
      relogio = setInterval(() => { k++; const f = cx.querySelector('#ra-frase'); if (f) f.textContent = FRASES[k % FRASES.length]; }, 2200);
      const r = await B7.IA.pedir('agencia', { operacao: 'semana', instrucao: (m.querySelector('#ra-dir').value || '').trim() });
      clearInterval(relogio);
      if (!cx.isConnected) return;
      gerar.disabled = false; gerar.querySelector('span').textContent = 'Gerar de novo';
      if (r && r.ok && r.texto) {
        texto = r.texto; cx.innerHTML = '<div class="ra-texto">' + renderTexto(texto) + '</div>'; copiar.classList.remove('ad-oculto');
      } else if (r && r.categoria === 'sem_permissao') cx.innerHTML = '<p class="ad-vazio">Só administrador usa o resumo da agência.</p>';
      else cx.innerHTML = '<div class="ra-vazio erro"><span>' + U.IC.alerta + '</span><b>Não deu para gerar agora</b><small>' + esc((r && r.mensagem) || 'Tente de novo.') +
        ((r && r.categoria === 'recusado') ? ' O texto só é aceito quando todos os números batem com os do sistema: gere de novo.' : '') + '</small></div>';
    };
    copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(texto); copiar.querySelector('span').textContent = 'Copiado'; setTimeout(() => { if (copiar.isConnected) copiar.querySelector('span').textContent = 'Copiar'; }, 1500); }
      catch (e) { B7.UI.toast('Não foi possível copiar. Selecione o texto e copie.', { tipo: 'erro' }); }
    };
  }
  return { abrir, _secoes: secoes };
})();

/* -------------------------------------------------------- REDISTRIBUIÇÃO */
B7.Redistribuicao = (function () {
  const U = B7.AdUI, esc = U.esc;
  const ROT_AREA = { design: 'Design', video: 'Vídeo' }, IC_AREA = { design: 'quadro', video: 'video' };
  const prazo = p => { if (!p) return 'sem prazo'; const q = String(p).slice(0, 10).split('-'); return 'prazo ' + q[2] + '/' + q[1]; };

  function barras(a) {
    const max = Math.max(1, ...(a.pessoas || []).map(p => p.abertas));
    return '<div class="rd-barras">' + (a.pessoas || []).map(p => {
      const cls = a.origem && p.id === a.origem.id ? 'alta' : a.destino && p.id === a.destino.id ? 'baixa' : '';
      return '<div class="rd-b ' + cls + '">' + U.avatar(p.nome, 'p') + '<b>' + esc(p.nome) + '</b><i class="ad-bar"><u data-w="' + Math.max(p.abertas ? 3 : 0, p.abertas / max * 100) + '"></u></i><span>' + p.abertas + '</span></div>';
    }).join('') + '</div>';
  }
  function bloco(a, i) {
    const cab = '<header class="rd-h"><span class="rd-h-ic">' + U.IC[IC_AREA[a.area]] + '</span><b>' + ROT_AREA[a.area] + '</b><small>itens em aberto por pessoa</small></header>' + barras(a);
    if (a.equilibrado) return '<section class="ad-cartao ad-in" style="--i:' + i + '">' + cab + '<p class="rd-msg ok">' + U.IC.ok + 'Carga equilibrada: nada a sugerir.</p></section>';
    if (a.sem_itens) {
      return '<section class="ad-cartao ad-in" style="--i:' + i + '">' + cab + '<p class="rd-msg">' + U.IC.alerta + '<span><b>' + esc(a.origem.nome) + '</b> tem ' + a.origem.abertas + ' em aberto e <b>' + esc(a.destino.nome) + '</b> tem ' + a.destino.abertas +
        ', mas nenhum item de ' + esc(a.origem.nome) + ' está esperando para começar. Não sugiro tirar o que já está em andamento. Se quiser equilibrar, escolha os itens na tela de ' + ROT_AREA[a.area] + '.</span></p></section>';
    }
    return '<section class="ad-cartao rd-sug ad-in" style="--i:' + i + '" data-area="' + a.area + '" data-destino="' + esc(a.destino.id) + '">' + cab +
      '<div class="rd-fluxo"><span>' + U.avatar(a.origem.nome, 'p') + esc(a.origem.nome) + '</span>' + U.IC.seta + '<span>' + U.avatar(a.destino.nome, 'p') + esc(a.destino.nome) + '</span>' +
        '<em>' + a.itens.length + (a.itens.length === 1 ? ' item' : ' itens') + '</em></div>' +
      (B7.Equipe && B7.Equipe.ausenciaDe(a.destino.id) ? '<p class="rd-msg rd-fora">' + U.IC.alerta + '<span><b>' + esc(a.destino.nome) + '</b> está fora (' +
        esc(B7.Equipe.rotuloAusencia(B7.Equipe.ausenciaDe(a.destino.id)).toLowerCase()) + '). Melhor escolher outra pessoa na tela de ' + ROT_AREA[a.area] + '.</span></p>' : '') +
      '<p class="rd-msg">Só entram itens que ainda não começaram' + (a.nao_iniciadas > a.itens.length ? '; há ' + a.nao_iniciadas + ' assim' : '') + ', os de prazo mais distante primeiro.</p>' +
      '<label class="rd-todos"><input type="checkbox" data-todos checked> Marcar todos</label>' +
      a.itens.map(x => '<label class="rd-item"><input type="checkbox" data-id="' + esc(x.id) + '" checked><span><b>' + esc(x.titulo) + '</b><small>' + esc(x.cliente) + ' · ' + prazo(x.prazo) + '</small></span></label>').join('') +
      '<div class="rd-acoes"><button type="button" class="b fina pri" data-aplicar>Passar os marcados para ' + esc(a.destino.nome) + '</button></div></section>';
  }
  function abrir() {
    const m = B7.UI.modal('<h3>Sugestão de redistribuição</h3>' +
      '<p class="sub">Compara a carga de quem tem a mesma função e sugere passar o que ainda não começou. Nada muda sozinho: você marca o que quer e aplica.</p>' +
      '<div class="ad-corpo" id="rd-corpo">' + U.esqueleto(3) + '</div>' +
      '<div class="acoes"><button type="button" class="b contorno ad-bt-ic" id="rd-atualizar">' + U.IC.atualizar + '<span>Calcular de novo</span></button><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#rd-corpo'), bt = m.querySelector('#rd-atualizar');
    async function carregar() {
      bt.classList.add('girando'); bt.disabled = true; cx.classList.add('carregando');
      try {
        const [r] = await Promise.all([B7.DB.rpc('redistribuicao_sugestoes', {}), B7.Equipe ? B7.Equipe.carregar(true).catch(() => null) : null]);
        if (!cx.isConnected) return;
        cx.innerHTML = (r.areas || []).map(bloco).join('') + '<p class="ad-nota">A carga conta o que está em aberto (vídeo: pendente, em edição e aguardando aprovação; design: tudo que não está finalizado). Não inclui o Kanban.</p>';
        U.crescer(cx);
        cx.querySelectorAll('.rd-sug').forEach(s => {
          s.querySelector('[data-aplicar]').onclick = () => aplicar(s);
          const todos = s.querySelector('[data-todos]'), itens = [...s.querySelectorAll('input[data-id]')];
          todos.onchange = () => itens.forEach(i => { i.checked = todos.checked; });
          itens.forEach(i => i.onchange = () => { todos.checked = itens.every(x => x.checked); });
        });
      } catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="ad-vazio">' + esc((e && e.message) || 'Não foi possível calcular.') + '</p>'; }
      cx.classList.remove('carregando'); bt.classList.remove('girando'); bt.disabled = false;
    }
    async function aplicar(s) {
      const ids = [...s.querySelectorAll('input[data-id]:checked')].map(i => i.dataset.id);
      if (!ids.length) { B7.UI.toast('Marque pelo menos um item.', { tipo: 'erro' }); return; }
      const area = s.dataset.area, destino = s.dataset.destino;
      B7.UI.confirmar({
        titulo: 'Passar ' + ids.length + (ids.length === 1 ? ' item' : ' itens') + ' de ' + ROT_AREA[area] + '?',
        texto: 'O responsável de cada item marcado muda para a outra pessoa, e a pessoa é avisada pelo caminho de sempre. Fica no histórico do item.',
        rotulo: 'Passar', aoConfirmar: async () => {
          let ok = 0, falhou = 0;
          for (const id of ids) {
            try { await (area === 'design' ? B7.DB.atribuirDesign(id, destino) : B7.DB.atribuirVideo(id, destino)); ok++; }
            catch (e) { falhou++; }
          }
          B7.UI.toast(ok + (ok === 1 ? ' item passado.' : ' itens passados.') + (falhou ? ' ' + falhou + ' não foi possível passar.' : ''), falhou ? { tipo: 'erro' } : undefined);
          carregar();
        } });
    }
    bt.onclick = carregar;
    carregar();
  }
  return { abrir };
})();

/* =====================================================================
   ADMIN PELO ASSISTENTE (zzz142)

   O administrador pede no chat ("desliga a IA de voz", "põe a cor do
   sistema em oceano", "avisa os designers que…") e o assistente monta um
   CARTÃO com o antes e o depois. Nada muda sem o toque em Aplicar. A
   mudança usa as mesmas funções das Configurações; o banco só deixa
   passar quem é administrador.

   Só três comandos: ligar/desligar/liberar um recurso, cor do sistema e
   comunicado. Permissões, funções, contas e exclusões ficam de fora de
   propósito: isso é em Usuários e acessos.
   ===================================================================== */
B7.AdminChat = (function () {
  const FN = { coordenador: 'Coordenação', videomaker: 'Videomakers', designer: 'Designers' };
  const regraDe = x => x.modo === 'funcoes' ? { modo: 'funcoes', funcoes: Array.isArray(x.funcoes) ? x.funcoes : [] }
    : x.modo === 'desligado' ? { modo: 'desligado' } : { modo: 'todos' };
  const rotuloRegra = r => r.modo === 'desligado' ? 'Desligado'
    : r.modo === 'funcoes' ? (r.funcoes.length ? 'Administradores + ' + r.funcoes.map(f => FN[f] || f).join(', ') : 'Só administradores') : 'Todos';

  function linhas(x) {
    if (x.comando === 'recurso') return [['Recurso', x.nome || x.recurso], ['Agora', B7.Recursos.rotulo(x.recurso)], ['Fica', rotuloRegra(regraDe(x))]];
    if (x.comando === 'paleta') return [['O que', 'Cor do sistema'], ['Agora', B7.Aparencia.rotuloPaleta(B7.Aparencia.paletaAtual())], ['Fica', B7.Aparencia.rotuloPaleta(x.paleta)]];
    if (x.comando === 'comunicado') return [['O que', 'Comunicado pela conversa'], ['Para', x.para === 'todos' ? 'Toda a equipe' : (FN[x.para] || x.para)], ['Mensagem', x.texto]];
    return [['Comando', 'desconhecido']];
  }

  async function aplicar(x) {
    const A = B7.Auth;
    if (!(A && (A.ehAdminReal ? A.ehAdminReal() : A.ehAdmin()))) throw new Error('Só administrador aplica essa alteração.');
    if (x.comando === 'recurso') {
      if (!B7.Recursos.LISTA.some(r => r.id === x.recurso)) throw new Error('Recurso desconhecido.');
      await B7.Recursos.definir(x.recurso, regraDe(x));
    } else if (x.comando === 'paleta') {
      await B7.Aparencia.definirPaleta(x.paleta);
    } else if (x.comando === 'comunicado') {
      const n = await B7.Comunicado.enviarPara(x.texto, x.para);
      B7.UI.toast('Comunicado enviado para ' + n + (n === 1 ? ' pessoa.' : ' pessoas.'));
    } else throw new Error('Comando desconhecido.');
    /* a tela de Configurações, se estiver aberta por trás, se refaz */
    try { if (location.hash.indexOf('#/config') === 0 && B7.Dashboard && B7.Dashboard.abrirConfig) B7.Dashboard.abrirConfig(); } catch (e) {}
  }
  return { linhas, aplicar };
})();

/* =====================================================================
   ABERTURA DO SISTEMA (zzz231) — Configurações → Admin → Aparência do sistema.
   Pedido do Kevin: "uma opção em que eu possa escolher qual vai ser a
   abertura padrão do sistema para todo mundo, ou para uma pessoa só".
   Grava em sistema_config 'abertura' (abertura_definir, só administrador).
   Cada pessoa recebe a sua por sistema_avisos() e passa a ver a partir da
   próxima vez que abrir o B7. Quem escolheu um estilo em Configurações →
   Aparência fica com o dela; quem está em "Padrão do sistema" segue este.
   ===================================================================== */
B7.AberturaAdm = (function () {
  const esc = s => B7.UI.esc(s);
  const ROT_PAPEL = { admin: 'Administrador', coordenador: 'Coordenação', designer: 'Design', videomaker: 'Vídeo' };
  const opcoes = (atual, comHerdar) => (comHerdar ? [['', 'Padrão do sistema']] : []).concat(B7.Abertura.ESTILOS)
    .map(([v, r]) => '<option value="' + v + '"' + (v === (atual || '') ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
  async function abrir() {
    if (!B7.Abertura) return;
    const m = B7.UI.modal('<h3>Abertura do sistema</h3>' +
      '<p class="sub">A animação que aparece quando o B7 abre. Vale a partir da próxima vez que cada pessoa abrir o sistema. Quem escolheu outra em Configurações → Aparência continua com a dela.</p>' +
      '<div class="adm-corpo" id="abadm-corpo"><p class="adm-vazio">' + B7.UI.spin() + 'Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b" data-fecha>Cancelar</button><button type="button" class="b pri" id="abadm-salvar" disabled>Salvar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#abadm-corpo');
    let cfg, pessoas;
    try {
      const [c, { data, error }] = await Promise.all([
        B7.DB.rpc('abertura_config', {}),
        B7.sb.from('perfis').select('id, nome, papel, estado').neq('papel', 'cliente').order('nome')
      ]);
      if (error) throw error;
      cfg = c || { padrao: 'streaming', pessoas: {} };
      pessoas = (data || []).filter(p => p.estado !== 'removida' && p.estado !== 'desativada');
    } catch (e) { cx.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível carregar.') + '</p>'; return; }
    const testar = estilo => {
      if (!B7.reverAbertura || document.querySelector('.b7-abertura')) return;
      m.fechar();
      document.documentElement.setAttribute('data-ab-estilo', estilo);
      B7.reverAbertura();
      setTimeout(() => { if (!document.querySelector('.b7-abertura')) B7.Abertura.aplicar(); else setTimeout(() => B7.Abertura.aplicar(), 2500); }, (B7.duracaoAbertura ? B7.duracaoAbertura() : 6400) + 2500);
    };
    cx.innerHTML =
      '<div class="adm-sub">Para todo mundo</div>' +
      '<div class="abadm-linha"><select class="campo" id="abadm-padrao" aria-label="Abertura para todo mundo">' + opcoes(cfg.padrao, false) + '</select>' +
        '<button type="button" class="b fina contorno" id="abadm-testar">Testar</button></div>' +
      /* zzz234: o carregamento (a versão curta) para todo mundo */
      '<div class="adm-sub">Tela de carregamento <small>ao recarregar e entre o login e o sistema</small></div>' +
      '<div class="abadm-linha"><select class="campo" id="abadm-carga" aria-label="Tela de carregamento para todo mundo">' +
        B7.Abertura.CARGAS.map(([v, r]) => '<option value="' + v + '"' + (v === (cfg.carregamento || 'relampago') ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>' +
        '<button type="button" class="b fina contorno" id="abadm-testar-carga">Testar</button></div>' +
      '<div class="adm-sub">Para uma pessoa só <small>deixe em "Padrão do sistema" para seguir a de cima</small></div>' +
      pessoas.map(p => '<div class="adm-sessao"><span class="adm-sessao-tx"><b>' + esc(p.nome) + '</b><small>' + esc((p.financeiro ? 'Financeiro' : ROT_PAPEL[p.papel]) || p.papel || '') + '</small></span>' +
        '<select class="campo fina" data-pessoa="' + esc(p.id) + '" aria-label="Abertura de ' + esc(p.nome) + '">' + opcoes((cfg.pessoas || {})[p.id], true) + '</select></div>').join('') +
      '<p class="adm-nota">Estilos: Streaming (o logo, duas batidas e o mergulho em faixas de luz que abrem o sistema) · Hiperespaço (o salto para a velocidade da luz) · Tinta (gotas de tinta que giram até o logo) · Glitch (um terminal que quebra e estoura no logo) · Aurora (cortinas de luz no céu) · Neon (o letreiro que liga piscando) · Mosaico (quadrados que viram e se abrem no logo) · Big bang (partículas e nebulosa) · Clássica (a lâmpada que acende).</p>';
    const salvar = m.querySelector('#abadm-salvar');
    cx.querySelectorAll('select').forEach(s => s.onchange = () => { salvar.disabled = false; });
    cx.querySelector('#abadm-testar').onclick = () => testar(cx.querySelector('#abadm-padrao').value);
    cx.querySelector('#abadm-testar-carga').onclick = () => {
      if (!B7.testarCarregamento || document.querySelector('.b7-abertura')) return;
      m.fechar();
      document.documentElement.setAttribute('data-ab-carga', cx.querySelector('#abadm-carga').value);
      B7.testarCarregamento();
      setTimeout(() => B7.Abertura.aplicar(), 4200);
    };
    salvar.onclick = async () => {
      const novo = { padrao: cx.querySelector('#abadm-padrao').value, pessoas: {}, carregamento: cx.querySelector('#abadm-carga').value };
      cx.querySelectorAll('[data-pessoa]').forEach(s => { if (s.value) novo.pessoas[s.dataset.pessoa] = s.value; });
      salvar.disabled = true;
      try {
        await B7.DB.rpc('abertura_definir', { p_valor: novo });
        /* a de quem está salvando já vale neste aparelho */
        const eu = B7.Auth.usuario() && B7.Auth.usuario().id;
        try { localStorage.setItem('b7_ab_padrao', (eu && novo.pessoas[eu]) || novo.padrao); localStorage.setItem('b7_carga_padrao', novo.carregamento); } catch (e) {}
        B7.Abertura.aplicar();
        const n = Object.keys(novo.pessoas).length;
        B7.UI.toast('Abertura salva' + (n ? ' (com ' + n + (n === 1 ? ' pessoa' : ' pessoas') + ' à parte)' : '') + '. Vale na próxima vez que cada um abrir o B7.');
        m.fechar();
        try { if (location.hash.indexOf('#/config') === 0 && B7.Dashboard && B7.Dashboard.abrirConfig) B7.Dashboard.abrirConfig(); } catch (e) {}
      } catch (e) { salvar.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
    };
  }
  return { abrir };
})();
