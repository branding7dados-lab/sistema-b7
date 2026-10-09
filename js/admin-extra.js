/* =====================================================================
   ADMIN: SESSÕES ATIVAS E USO DA IA (zzz136) — duas janelas de leitura
   em Configurações → Admin, só para administrador (o banco confere).

   B7.Sessoes — em quais aparelhos cada conta está aberta, e encerrar uma
     sessão ou todas as de uma pessoa. Usa o controle de sessões do
     próprio Supabase; não mexe em senha nem em conta. Encerrar não é
     instantâneo: o aparelho cai quando o acesso em uso vence (até 1 hora)
     e não consegue renovar. O endereço de rede não é mostrado.

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
      '<p class="sub">Cada linha é um aparelho ou navegador onde a conta está aberta. Encerrar tira o acesso daquele aparelho: ele cai em até 1 hora e a pessoa precisa entrar de novo. Não muda a senha.</p>' +
      '<div class="adm-corpo" id="adm-sessoes"><p class="adm-vazio">Carregando…</p></div>' +
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
        titulo: 'Encerrar esta sessão de ' + b.dataset.nome + '?', texto: 'Esse aparelho perde o acesso em até 1 hora e a pessoa precisa entrar de novo. A senha continua a mesma.',
        rotulo: 'Encerrar', perigo: true, aoConfirmar: async () => {
          try { await B7.DB.rpc('sessao_encerrar', { p_sessao: b.dataset.encerrar }); B7.UI.toast('Sessão encerrada.'); carregar(); }
          catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível encerrar.', { tipo: 'erro' }); }
        } }));
      cx.querySelectorAll('[data-todas]').forEach(b => b.onclick = () => B7.UI.confirmar({
        titulo: 'Encerrar todas as sessões de ' + b.dataset.nome + '?', texto: 'Todos os aparelhos dessa conta perdem o acesso em até 1 hora. A senha continua a mesma: se a ideia é impedir que a pessoa volte, redefina a senha em Usuários e acessos.',
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
    oportunidade: 'Ideias das Oportunidades', voz: 'Voz (transcrição)' };
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
      '<div class="adm-corpo" id="adm-ia"><p class="adm-vazio">Carregando…</p></div>' +
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
