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

/* =====================================================================
   ADMIN: SAÚDE, MÉDICO E COMUNICADO (zzz139)

   B7.Saude — uma tela de leitura: as rotinas agendadas rodaram? os avisos
     (push) estão saindo? o Google Agenda está conectado? quanto espaço
     foi usado? a IA está respondendo? Não muda nada.
   B7.Medico — o que está incompleto nos cadastros. Não corrige nada: cada
     achado leva até o registro, onde a pessoa corrige.
   B7.Comunicado — o administrador escreve uma vez e a mensagem chega na
     conversa de cada pessoa escolhida, com "lido por".
   ===================================================================== */
B7.Saude = (function () {
  const esc = s => B7.UI.esc(s);
  const ROT_ROTINA = {
    'agenda-lembretes': ['Lembretes da agenda', 'a cada 5 minutos', 15],
    'notif-agendados': ['Avisos agendados (resumo do dia e parados)', 'de hora em hora, das 8h às 19h', 0],
    'oportunidades-sync': ['Atualização das Oportunidades', 'toda segunda-feira', 0]
  };
  const mb = b => b >= 1073741824 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' GB' : Math.round(b / 1048576) + ' MB';
  const LIMITE_ARQUIVOS = 1073741824;           /* 1 GB: o limite do plano para os arquivos */
  const idade = iso => iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null;
  const quando = iso => iso ? (B7.UI.quando ? B7.UI.quando(iso) : new Date(iso).toLocaleString('pt-BR')) : '—';

  function avaliar(r) {
    const pontos = [];
    const linhas = (r.rotinas || []).map(j => {
      const rot = ROT_ROTINA[j.nome] || [j.nome, j.agenda, 0];
      const min = idade(j.ultima);
      let cls = 'ok', tx = j.ultima ? 'rodou ' + quando(j.ultima) : 'ainda não rodou';
      if (!j.ativa) { cls = 'erro'; tx = 'desligada'; pontos.push(rot[0] + ' está desligada.'); }
      else if (j.status && j.status !== 'succeeded') { cls = 'erro'; tx = 'falhou ' + quando(j.ultima); pontos.push(rot[0] + ' falhou na última vez.'); }
      else if (rot[2] && min !== null && min > rot[2]) { cls = 'erro'; tx = 'parada: última vez ' + quando(j.ultima); pontos.push(rot[0] + ' não roda há ' + min + ' minutos.'); }
      else if (!j.ultima) cls = 'neutro';
      return { nome: rot[0], quando: rot[1], cls, tx };
    });
    const p = r.push || {}, g = (r.google || [])[0], ia = r.ia || {};
    const itens = [];
    itens.push({ nome: 'Avisos no celular e no computador (push)', cls: Number(p.falhas24) > 0 ? 'erro' : 'ok',
      tx: (Number(p.ok24) || 0) + ' enviados nas últimas 24 h' + (Number(p.falhas24) ? ', ' + p.falhas24 + ' com falha' : '') + ' · ' + (p.aparelhos || 0) + ' aparelhos cadastrados' });
    if (Number(p.falhas24) > 0) pontos.push(p.falhas24 + ' aviso(s) push falharam nas últimas 24 h.');
    itens.push({ nome: 'Google Agenda', cls: g && g.status === 'ativa' ? 'ok' : (g ? 'erro' : 'neutro'),
      tx: g ? (g.status === 'ativa' ? 'conectado · última sincronização ' + quando(g.ultima) : 'status "' + esc(g.status) + '"' + (g.erro ? ': ' + esc(g.erro) : '')) : 'nenhuma conta conectada' });
    if (g && g.status !== 'ativa') pontos.push('O Google Agenda não está conectado.');
    const taxa = ia.total24 ? Number(ia.erros24) / Number(ia.total24) : 0;
    itens.push({ nome: 'Assistente (IA)', cls: taxa > 0.3 ? 'erro' : 'ok',
      tx: (ia.total24 || 0) + ' chamadas nas últimas 24 h' + (ia.erros24 ? ', ' + ia.erros24 + ' com erro' : '') });
    if (taxa > 0.3) pontos.push('Mais de 30% dos pedidos à IA deram erro nas últimas 24 h.');
    const usoArq = Number(r.arquivos_bytes) / LIMITE_ARQUIVOS;
    itens.push({ nome: 'Espaço dos arquivos', cls: usoArq > 0.8 ? 'erro' : 'ok',
      tx: mb(Number(r.arquivos_bytes)) + ' de 1 GB (' + Math.round(usoArq * 100) + '%) · ' + r.arquivos_qtd + ' arquivos' });
    if (usoArq > 0.8) pontos.push('Os arquivos já usam mais de 80% do espaço.');
    itens.push({ nome: 'Banco de dados', cls: 'ok', tx: mb(Number(r.banco_bytes)) + ' usados' });
    itens.push({ nome: 'Equipe agora', cls: 'neutro', tx: r.online + ' online de ' + r.equipe + ' na equipe' });
    return { pontos, linhas, itens };
  }

  const ponto = cls => '<i class="sd-ponto ' + cls + '" aria-hidden="true"></i>';

  function corpo(r) {
    const a = avaliar(r);
    return '<div class="sd-resumo ' + (a.pontos.length ? 'atencao' : 'ok') + '">' +
        '<b>' + (a.pontos.length ? (a.pontos.length === 1 ? '1 ponto de atenção' : a.pontos.length + ' pontos de atenção') : 'Tudo certo') + '</b>' +
        (a.pontos.length ? '<ul>' + a.pontos.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>' : '<small>Nada fora do normal agora.</small>') + '</div>' +
      '<h4 class="adm-sub">Rotinas agendadas</h4>' + a.linhas.map(l =>
        '<div class="sd-linha">' + ponto(l.cls) + '<span><b>' + esc(l.nome) + '</b><small>' + esc(l.quando) + ' · ' + esc(l.tx) + '</small></span></div>').join('') +
      '<h4 class="adm-sub">Serviços e espaço</h4>' + a.itens.map(l =>
        '<div class="sd-linha">' + ponto(l.cls) + '<span><b>' + esc(l.nome) + '</b><small>' + l.tx + '</small></span></div>').join('') +
      '<p class="adm-nota">Só leitura. Quem está com uma versão antiga do B7 aberta não aparece aqui: o sistema não guarda a versão de cada aparelho.</p>';
  }

  function abrir() {
    const m = B7.UI.modal('<h3>Saúde do sistema</h3><p class="sub">Se as rotinas rodaram, se os avisos estão saindo e quanto espaço sobra.</p>' +
      '<div class="adm-corpo" id="sd-corpo"><p class="adm-vazio">Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b contorno" id="sd-atualizar">Atualizar</button><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#sd-corpo');
    async function carregar() {
      cx.classList.add('carregando');
      try { const r = await B7.DB.rpc('saude_sistema', {}); if (cx.isConnected) cx.innerHTML = corpo(r); }
      catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível carregar.') + '</p>'; }
      cx.classList.remove('carregando');
    }
    m.querySelector('#sd-atualizar').onclick = carregar;
    carregar();
  }
  return { abrir, _avaliar: avaliar };
})();

B7.Medico = (function () {
  const esc = s => B7.UI.esc(s);
  function corpo(r) {
    const l = r.achados || [];
    if (!l.length) return '<div class="sd-resumo ok"><b>Nada para corrigir</b><small>Os cadastros que o médico confere estão completos.</small></div>';
    return l.map(a => '<section class="adm-grupo md-achado"><header><b>' + esc(a.titulo) + '</b><small>' + a.qtd + (a.qtd === 1 ? ' caso' : ' casos') + '</small></header>' +
      '<p class="md-dica">' + esc(a.dica) + '</p>' +
      a.itens.map(i => '<div class="md-item"><span>' + esc(i.nome) + '</span><button type="button" class="b fina contorno" data-rota="' + esc(i.rota) + '">Abrir</button></div>').join('') +
      (a.qtd > a.itens.length ? '<p class="md-mais">e mais ' + (a.qtd - a.itens.length) + '…</p>' : '') + '</section>').join('');
  }
  function abrir() {
    const m = B7.UI.modal('<h3>Médico do sistema</h3><p class="sub">Procura o que está incompleto nos cadastros. Não corrige nada sozinho: o botão Abrir leva até o registro.</p>' +
      '<div class="adm-corpo" id="md-corpo"><p class="adm-vazio">Procurando…</p></div>' +
      '<div class="acoes"><button type="button" class="b contorno" id="md-atualizar">Procurar de novo</button><button type="button" class="b pri" data-fecha>Fechar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#md-corpo');
    async function carregar() {
      cx.classList.add('carregando');
      try {
        const r = await B7.DB.rpc('medico_achados', {});
        if (!cx.isConnected) return;
        cx.innerHTML = corpo(r || {});
        cx.querySelectorAll('[data-rota]').forEach(b => b.onclick = () => { m.fechar(); location.hash = b.dataset.rota; });
      } catch (e) { if (cx.isConnected) cx.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível procurar.') + '</p>'; }
      cx.classList.remove('carregando');
    }
    m.querySelector('#md-atualizar').onclick = carregar;
    carregar();
  }
  return { abrir };
})();

B7.Comunicado = (function () {
  const esc = s => B7.UI.esc(s);
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : new Date(iso).toLocaleString('pt-BR'));
  async function equipe() {
    const eu = B7.Auth.usuario() && B7.Auth.usuario().id;
    const { data, error } = await B7.sb.from('perfis').select('id, nome, username, funcao, papel').eq('estado', 'ativa').neq('papel', 'cliente').order('nome');
    if (error) throw error;
    return (data || []).filter(p => p.id !== eu);
  }
  function abrir() {
    const m = B7.UI.modal('<h3>Comunicado pela conversa</h3>' +
      '<p class="sub">A mensagem chega na conversa de cada pessoa escolhida, com aviso. Cada um vê só a própria conversa com você. Você acompanha quem já leu.</p>' +
      '<div class="mb"><label class="rot" for="cm-texto">MENSAGEM</label><textarea class="campo" id="cm-texto" rows="4" maxlength="2000" placeholder="Ex.: Amanhã a gravação do Cantinho do Posto será às 9h." data-foco></textarea></div>' +
      '<div class="mb"><label class="rot">PARA QUEM</label><div id="cm-quem" class="cm-quem"><span class="adm-vazio">Carregando…</span></div></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b pri" id="cm-enviar" disabled>Enviar</button></div>' +
      '<h4 class="adm-sub">Enviados</h4><div id="cm-lista" class="adm-corpo"><p class="adm-vazio">Carregando…</p></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const quem = m.querySelector('#cm-quem'), enviar = m.querySelector('#cm-enviar'), texto = m.querySelector('#cm-texto');
    let pessoas = [];
    const marcados = () => [...quem.querySelectorAll('input[data-p]:checked')].map(i => i.dataset.p);
    const atualizarBotao = () => {
      const n = marcados().length;
      enviar.disabled = !texto.value.trim() || !n;
      enviar.textContent = n ? 'Enviar para ' + n + (n === 1 ? ' pessoa' : ' pessoas') : 'Enviar';
    };
    equipe().then(l => {
      pessoas = l;
      quem.innerHTML = '<label class="cm-todos"><input type="checkbox" id="cm-todos" checked> Toda a equipe</label>' +
        l.map(p => '<label class="cm-pessoa"><input type="checkbox" data-p="' + esc(p.id) + '" checked> ' + esc(p.nome || p.username) +
          (p.funcao ? ' <small>' + esc(p.funcao) + '</small>' : '') + '</label>').join('');
      const todos = quem.querySelector('#cm-todos');
      todos.onchange = () => { quem.querySelectorAll('input[data-p]').forEach(i => i.checked = todos.checked); atualizarBotao(); };
      quem.querySelectorAll('input[data-p]').forEach(i => i.onchange = () => { todos.checked = quem.querySelectorAll('input[data-p]:not(:checked)').length === 0; atualizarBotao(); });
      atualizarBotao();
    }).catch(() => { quem.innerHTML = '<span class="adm-vazio">Não foi possível carregar a equipe.</span>'; });
    texto.addEventListener('input', atualizarBotao);
    enviar.onclick = async () => {
      const ids = marcados(); if (!ids.length || !texto.value.trim()) return;
      enviar.disabled = true; enviar.textContent = 'Enviando…';
      try {
        await B7.DB.rpc('chat_comunicado', { p_texto: texto.value.trim(), p_destinos: ids });
        B7.UI.toast('Comunicado enviado para ' + ids.length + (ids.length === 1 ? ' pessoa.' : ' pessoas.'));
        texto.value = ''; atualizarBotao(); lista();
      } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível enviar.', { tipo: 'erro' }); atualizarBotao(); }
    };
    const cxLista = m.querySelector('#cm-lista');
    async function lista() {
      try {
        const l = await B7.DB.rpc('chat_comunicados_lista', {});
        if (!cxLista.isConnected) return;
        cxLista.innerHTML = (l && l.length) ? l.map(c => '<div class="cm-env"><p>' + esc(c.texto) + '</p><div><small>' + esc(quando(c.created_at)) + ' · lido por ' + c.lidos + ' de ' + c.total + '</small>' +
            '<button type="button" class="adm-link" data-lidos="' + esc(c.id) + '">Ver quem leu</button></div><div class="cm-quem-leu" data-leu="' + esc(c.id) + '"></div></div>').join('')
          : '<p class="adm-vazio">Nenhum comunicado enviado ainda.</p>';
        cxLista.querySelectorAll('[data-lidos]').forEach(b => b.onclick = async () => {
          const alvo = cxLista.querySelector('[data-leu="' + b.dataset.lidos + '"]');
          if (alvo.innerHTML) { alvo.innerHTML = ''; return; }
          try {
            const r = await B7.DB.rpc('chat_comunicado_lidos', { p_id: b.dataset.lidos });
            alvo.innerHTML = r.map(x => '<span class="' + (x.lida ? 'leu' : 'nao') + '">' + esc(x.nome) + ' · ' + (x.lida ? 'leu ' + esc(quando(x.lida_em)) : x.entregue ? 'recebeu, não leu' : 'ainda não recebeu') + '</span>').join('');
          } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível ver.', { tipo: 'erro' }); }
        });
      } catch (e) { if (cxLista.isConnected) cxLista.innerHTML = '<p class="adm-vazio">' + esc((e && e.message) || 'Não foi possível carregar.') + '</p>'; }
    }
    lista();
  }
  return { abrir };
})();
