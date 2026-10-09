/* =====================================================================
   PAINEL DE TV (zzz129) — a agência no mês, para deixar aberta numa TV
   (#/tv). É uma tela só de LEITURA e só de produção:

     · sem nome de pessoa da equipe, sem comentário, sem notificação,
       sem valor, sem contato de cliente e sem nenhum link ou botão de
       ação — ninguém opera nada daqui;
     · o menu, a barra do topo, o sino, o assistente e os avisos que
       sobem no canto ficam escondidos enquanto ela está aberta.

   Os números vêm das MESMAS fontes das telas que já existem, com o
   acesso de quem está logado na TV: panorama_mes (Panorama), as
   gravações do Calendário, as publicações do dia e as datas das
   Oportunidades. Nada é gravado e não há consulta nova no banco.

   Fica aberta por horas: relógio a cada 15 s, dados a cada 5 min (aba
   escondida não consulta), a tela não apaga (quando o navegador deixa)
   e, com clientes demais para uma página, a lista roda sozinha.
   Sair: Esc, ou o botão que aparece ao mexer o mouse.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.TV = (function () {
  const esc = s => B7.UI.esc(s);
  const pad = n => String(n).padStart(2, '0');
  const hoje = () => B7.UI.hojeISO();
  const local = iso => { const p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const somarDias = (iso, n) => { const d = local(iso); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const diaDoTs = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const hora = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const DOW = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const DOW_C = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const ROT = { atraso: 'com atraso', atencao: 'pedem atenção', andamento: 'em andamento', ok: 'em dia', vazio: 'sem movimento' };
  const PESO = { atraso: 0, atencao: 1, andamento: 2, ok: 3, vazio: 4 };
  /* as sete etapas do Panorama, na mesma ordem, em nome curto para o cabeçalho */
  const ETAPA_CURTA = ['Linha', 'Rot.', 'Grav.', 'Vídeo', 'Design', 'Aprov.', 'Publ.'];

  let raiz = null, pulso = 0, giro = 0, troca = 0, ultima = 0, diaPintado = '', pagina = 0, trava = null, antes = '#/';
  const S = { panorama: null, gravacoes: null, publicacoes: null, pubSemana: null, hojeDia: null, erro: false };
  /* zzz136 — o que aparece é escolha do administrador (Configurações → Admin →
     Painel de TV), guardada em sistema_config "tv". Sem nada guardado, vale isto: */
  const PADRAO = { clientes: true, nomes: true, etapas: true, gravacoes: true, publicacoes: true, hoje: true, agenda: false, intervalo: 45,
    modo: 'painel', vinheta: false };
  let cfg = Object.assign({}, PADRAO), tela = 'agencia';
  /* zzz137 — "só a animação da B7": a TV fica com a cena da abertura do
     sistema, em ciclo, sem número nenhum. Vale pela configuração ou pelo
     endereço (#/tv?modo=animacao), que ganha da configuração. */
  let modoForcado = '', modoAtivo = '', animTimer = 0, vinhetaTimer = 0, ultimaVinheta = 0, eraCurta = false;
  const modoDaVez = () => modoForcado || (cfg.modo === 'animacao' ? 'animacao' : 'painel');
  const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* a mesma marcação da abertura do sistema: `completa` = a sequência de
     entrada (uns 7 s); senão a cena viva, que fica em ciclo sem fim */
  function cena(completa) {
    const el = document.createElement('div');
    el.className = 'b7-abertura tv-cena' + (completa ? ' inicial' : '');
    el.dataset.fechando = '1';                 /* o fechamento da cortina do sistema não mexe nesta */
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = B7.moldeAbertura ? B7.moldeAbertura() : '';
    const esp = el.querySelector('.ab-espera'); if (esp) esp.remove();
    return el;
  }
  function trocarCena(completa, depois) {
    const palco = raiz && raiz.querySelector('#tv-anim'); if (!palco) return;
    palco.classList.add('tv-corte');           /* um corte para o preto entre as cenas */
    setTimeout(() => {
      if (!raiz) return;
      palco.innerHTML = ''; palco.appendChild(cena(completa));
      void palco.offsetWidth; palco.classList.remove('tv-corte');
      depois && depois();
    }, 420);
  }
  function cicloAnimacao() {
    clearTimeout(animTimer);
    const passo = completa => {
      if (!raiz || modoAtivo !== 'animacao') return;
      trocarCena(completa && !reduz(), () => { animTimer = setTimeout(() => passo(!completa), completa && !reduz() ? 7400 : 50000); });
    };
    passo(true);
  }
  /* vinheta: a abertura passa por cima do painel e some */
  function passarVinheta() {
    const palco = raiz && raiz.querySelector('#tv-anim'); if (!palco || modoAtivo !== 'painel' || reduz()) return;
    ultimaVinheta = Date.now();
    palco.hidden = false; palco.classList.add('tv-corte');
    trocarCena(true, () => {
      clearTimeout(vinhetaTimer);
      vinhetaTimer = setTimeout(() => {
        palco.classList.add('tv-corte');
        setTimeout(() => { if (raiz && modoAtivo === 'painel') { palco.hidden = true; palco.innerHTML = ''; palco.classList.remove('tv-corte'); pintar(true); } }, 450);
      }, 7200);
    });
  }
  function aplicarModo() {
    if (!raiz) return;
    const m = modoDaVez(); if (m === modoAtivo) return;
    modoAtivo = m;
    clearTimeout(animTimer); clearTimeout(vinhetaTimer);
    const palco = raiz.querySelector('#tv-anim');
    raiz.classList.toggle('tv-so-anim', m === 'animacao');
    if (m === 'animacao') { palco.hidden = false; cicloAnimacao(); }
    else { palco.hidden = true; palco.innerHTML = ''; palco.classList.remove('tv-corte'); ultimaVinheta = Date.now(); }
  }
  /* os números sobem até o valor (só na entrada da tela, não a cada renovação) */
  function contar(cx) {
    if (reduz()) return;
    cx.querySelectorAll('[data-conta]').forEach(el => {
      const alvo = Number(el.dataset.conta) || 0, t0 = performance.now(), dur = 900 + Math.min(alvo, 100) * 4;
      if (!alvo) return;
      el.textContent = '0';
      const passo = t => {
        const p = Math.min(1, (t - t0) / dur), v = Math.round(alvo * (1 - Math.pow(1 - p, 3)));
        if (el.isConnected) { el.textContent = v; if (p < 1) requestAnimationFrame(passo); }
      };
      requestAnimationFrame(passo);
    });
  }
  async function lerConfig() {
    try {
      const { data } = await B7.sb.from('sistema_config').select('valor').eq('chave', 'tv').maybeSingle();
      cfg = Object.assign({}, PADRAO, (data && data.valor && typeof data.valor === 'object') ? data.valor : {});
    } catch (e) {}
    return cfg;
  }

  /* ------------------------------------------------------------ leitura */
  async function carregar() {
    const h = hoje(), a = new Date();
    const tenta = p => Promise.resolve(p).catch(() => null);
    await lerConfig();
    aplicarModo();
    if (modoAtivo === 'animacao') return;          /* só a animação: nenhum dado é consultado */
    const [pan, grav, pub, ops, pubSem] = await Promise.all([
      tenta(B7.DB.panoramaMes(a.getFullYear(), a.getMonth() + 1)),
      tenta(B7.Eventos && B7.Eventos.carregarDominio ? B7.Eventos.carregarDominio('gravacao', h, somarDias(h, 7)) : null),
      tenta(B7.Perm.podeRota('publicacoes') ? B7.DB.publicacoesDoPeriodo(h, h) : null),
      tenta(B7.Oportunidades && B7.Oportunidades.periodo && B7.Perm.podeRota('oportunidades') ? B7.Oportunidades.periodo(h, h) : null),
      tenta(cfg.agenda && B7.Perm.podeRota('publicacoes') && B7.DB.contagemPublicacoesPorDia ? B7.DB.contagemPublicacoesPorDia(h, somarDias(h, 6)) : null)
    ]);
    S.pubSemana = pubSem;
    S.erro = !pan;
    if (pan) S.panorama = pan.map(B7.Panorama.ler);
    S.gravacoes = grav ? grav.filter(e => !e.historico && !e.cancelado && !e.concluido)
      .map(e => ({ titulo: e.titulo, cliente: e.clienteNome, inicio: e.extra && e.extra.bruto ? e.extra.bruto.inicio : null, diaInteiro: e.diaInteiro }))
      .filter(g => g.inicio).sort((x, y) => String(x.inicio).localeCompare(String(y.inicio))) : null;
    S.publicacoes = pub;
    S.hojeDia = ops ? ops.filter(i => i.nivelMax && i.ini === h).map(i => i.op.nome) : null;
  }

  /* -------------------------------------------------------------- peças */
  function relogio() {
    const cx = raiz && raiz.querySelector('#tv-relogio'); if (!cx) return;
    const a = new Date(), k = pad(a.getHours()) + ':' + pad(a.getMinutes());
    if (cx.dataset.h === k) return;
    cx.dataset.h = k;
    cx.innerHTML = '<b>' + pad(a.getHours()) + '<i>:</i>' + pad(a.getMinutes()) + '</b>' +
      '<span>' + DOW[a.getDay()] + ', ' + a.getDate() + ' de ' + MES[a.getMonth()] + '</span>';
  }

  function resumo(linhas) {
    const n = { atraso: 0, atencao: 0, andamento: 0, ok: 0, vazio: 0 };
    let soma = 0, com = 0;
    linhas.forEach(l => { n[l.estado]++; if (l.etapas) { soma += l.pct; com++; } });
    const pct = com ? Math.round(soma / com * 100) : 0, r = 52, c = 2 * Math.PI * r;
    return '<section class="tv-resumo" aria-label="Resumo do mês">' +
      '<div class="tv-anel" role="img" aria-label="Andamento médio do mês: ' + pct + '%"><svg viewBox="0 0 120 120">' +
        '<circle class="f" cx="60" cy="60" r="' + r + '"/><circle class="v" cx="60" cy="60" r="' + r + '" style="--c:' + c.toFixed(1) + ';--o:' + (c * (1 - pct / 100)).toFixed(1) + '"/></svg>' +
        '<b><span data-conta="' + pct + '">' + pct + '</span><i>%</i></b></div>' +
      '<div class="tv-resumo-tx"><span>Andamento do mês</span><strong>' + com + (com === 1 ? ' cliente' : ' clientes') + ' com movimento</strong></div>' +
      '<div class="tv-nums">' + ['ok', 'andamento', 'atencao', 'atraso'].map(k =>
        '<div class="tv-num tv-e-' + k + '"><b data-conta="' + n[k] + '">' + n[k] + '</b><span>' + ROT[k] + '</span></div>').join('') + '</div>' +
    '</section>';
  }

  /* quantos clientes cabem numa página: mede a altura que sobrou */
  function capacidade() {
    const cx = raiz && raiz.querySelector('#tv-clientes-corpo');
    /* tela estreita (não é TV): a lista inteira, rolando, sem páginas */
    if (window.innerWidth <= 1100) return { colunas: 1, porColuna: 999, total: 999 };
    const colunas = window.innerWidth >= 1280 ? 2 : 1;
    const alt = cx ? cx.clientHeight : 600;
    /* uma linha de cada coluna é o cabeçalho com o nome das etapas */
    const porColuna = Math.max(4, Math.floor(alt / Math.max(36, window.innerHeight * 0.052)) - 1);
    return { colunas, porColuna, total: colunas * porColuna };
  }

  function clientes(linhas) {
    const cx = raiz.querySelector('#tv-clientes-corpo'); if (!cx) return;
    const vivos = linhas.filter(l => l.estado !== 'vazio').sort((a, b) => PESO[a.estado] - PESO[b.estado] || a.pct - b.pct ||
      String(a.c.nome).localeCompare(String(b.c.nome), 'pt-BR'));
    const cap = capacidade(), paginas = Math.max(1, Math.ceil(vivos.length / cap.total));
    if (pagina >= paginas) pagina = 0;
    const fatia = vivos.slice(pagina * cap.total, (pagina + 1) * cap.total);
    const parados = linhas.length - vivos.length;
    const nota = raiz.querySelector('#tv-clientes-nota');
    if (nota) nota.textContent = [paginas > 1 ? 'página ' + (pagina + 1) + ' de ' + paginas : '',
      parados ? parados + (parados === 1 ? ' cliente sem movimento' : ' clientes sem movimento') : ''].filter(Boolean).join(' · ');
    if (!vivos.length) { cx.innerHTML = '<p class="tv-vazio">Nenhum cliente com movimento neste mês.</p>'; return; }
    const porCol = Math.min(cap.porColuna, Math.ceil(fatia.length / cap.colunas));
    cx.style.setProperty('--tv-colunas', cap.colunas);
    cx.style.setProperty('--tv-linhas', porCol + 1);
    const cab = '<div class="tv-cli tv-cli-cab" aria-hidden="true"><span class="tv-cli-nome"></span><span class="tv-cli-etapas">' +
      ETAPA_CURTA.map(r => '<i>' + r + '</i>').join('') + '</span><b class="tv-cli-pct"></b></div>';
    const linha = (l, i) =>
      '<div class="tv-cli tv-e-' + l.estado + '" style="--i:' + i + '">' + B7.UI.avatarCliente(l.c.nome, l.c.logo_url, 'tv-cli-av') +
        '<span class="tv-cli-nome">' + esc(l.c.nome) + '</span>' +
        '<span class="tv-cli-etapas">' + B7.Panorama.ETAPAS.map(([k]) => {
          const x = l.cels[k];
          return '<i class="tv-e-' + x.estado + '">' + esc(x.valor || '') + '</i>';
        }).join('') + '</span>' +
        '<b class="tv-cli-pct">' + (l.etapas ? Math.round(l.pct * 100) + '%' : '') + '</b></div>';
    let html = '';
    for (let c = 0; c * porCol < fatia.length; c++) html += cab + fatia.slice(c * porCol, (c + 1) * porCol).map((l, i) => linha(l, c * porCol + i)).join('');
    cx.innerHTML = html;
  }

  function etapas(linhas) {
    return '<div class="tv-etapas">' + B7.Panorama.ETAPAS.map(([k, rot]) => {
      const n = { atraso: 0, atencao: 0, andamento: 0, ok: 0 };
      linhas.forEach(l => { const e = l.cels[k].estado; if (n[e] !== undefined) n[e]++; });
      const total = n.atraso + n.atencao + n.andamento + n.ok;
      const frase = !total ? 'nada no mês' : [n.ok && n.ok + ' em dia', n.andamento && n.andamento + ' andando', n.atencao && n.atencao + ' atenção', n.atraso && n.atraso + ' atraso'].filter(Boolean).join(' · ');
      return '<div class="tv-etapa"><span class="tv-etapa-rot">' + esc(rot) + '</span>' +
        '<span class="tv-etapa-barra">' + (total ? ['ok', 'andamento', 'atencao', 'atraso'].filter(e => n[e]).map(e =>
          '<i class="tv-e-' + e + '" style="flex:' + n[e] + '"></i>').join('') : '<i class="tv-e-vazio" style="flex:1"></i>') + '</span>' +
        '<small>' + frase + '</small></div>';
    }).join('') + '</div>';
  }

  function agenda() {
    const h = hoje();
    let grav;
    if (!S.gravacoes) grav = '<p class="tv-vazio">Agenda indisponível para esta conta.</p>';
    else if (!S.gravacoes.length) grav = '<p class="tv-vazio">Nenhuma gravação nos próximos 7 dias.</p>';
    else grav = '<ul class="tv-lista">' + S.gravacoes.slice(0, window.innerHeight >= 1000 ? 3 : 2).map(g => {
      const dia = diaDoTs(g.inicio), eHoje = dia === h, d = local(dia);
      return '<li' + (eHoje ? ' class="hoje"' : '') + '><time><b>' + (eHoje ? 'hoje' : DOW_C[d.getDay()] + ' ' + pad(d.getDate())) + '</b>' +
        (g.diaInteiro ? '' : '<span>' + hora(g.inicio) + '</span>') + '</time>' +
        '<span class="tv-lista-tx"><b>' + esc(nomeGrav(g)) + '</b>' +
        (cfg.nomes && g.cliente && g.titulo ? '<small>' + esc(g.titulo) + '</small>' : '') + '</span></li>';
    }).join('') + '</ul>';

    let pub = '';
    if (S.publicacoes) {
      const t = S.publicacoes.length, p = S.publicacoes.filter(x => x.status === 'Publicado').length;
      pub = '<div class="tv-pub"><div class="tv-pub-n"><b>' + p + '</b><span>de ' + t + (t === 1 ? ' publicação de hoje' : ' publicações de hoje') + '</span></div>' +
        '<span class="tv-etapa-barra"><i class="tv-e-ok" style="flex:' + p + '"></i><i class="tv-e-vazio" style="flex:' + Math.max(t - p, t ? 0 : 1) + '"></i></span></div>';
    }
    return (pub && cfg.publicacoes ? '<h2>Publicações</h2>' + pub : '') + (cfg.gravacoes ? '<h2>Próximas gravações</h2>' + grav : '');
  }
  /* com "nomes de clientes" desligado, a gravação aparece só pelo título */
  const nomeGrav = g => (cfg.nomes ? (g.cliente || g.titulo || 'Gravação') : (g.titulo || 'Gravação'));

  /* segunda tela (opcional): os próximos 7 dias, um quadro por dia */
  function semana() {
    const h = hoje();
    const porDia = {}; (S.pubSemana || []).forEach(p => { porDia[p.data_postagem] = (porDia[p.data_postagem] || 0) + 1; });
    return '<section class="tv-semana" aria-label="Próximos 7 dias">' + Array.from({ length: 7 }, (_, i) => {
      const iso = somarDias(h, i), d = local(iso), gs = (S.gravacoes || []).filter(g => diaDoTs(g.inicio) === iso), np = porDia[iso] || 0;
      return '<article class="tv-sdia' + (i === 0 ? ' hoje' : '') + (d.getDay() === 0 || d.getDay() === 6 ? ' fds' : '') + '">' +
        '<header><span>' + (i === 0 ? 'hoje' : DOW_C[d.getDay()]) + '</span><b>' + pad(d.getDate()) + '</b></header>' +
        '<div class="tv-sdia-corpo">' + (gs.length ? gs.slice(0, 4).map(g => '<p><time>' + (g.diaInteiro ? 'dia todo' : hora(g.inicio)) + '</time><b>' + esc(nomeGrav(g)) + '</b></p>').join('') +
            (gs.length > 4 ? '<p class="tv-sdia-mais">+ ' + (gs.length - 4) + '</p>' : '') : '<p class="tv-sdia-livre">sem gravação</p>') + '</div>' +
        (S.pubSemana ? '<footer><b>' + np + '</b><span>' + (np === 1 ? 'publicação' : 'publicações') + '</span></footer>' : '') + '</article>';
    }).join('') + '</section>';
  }

  function faixaHoje() {
    const cx = raiz.querySelector('#tv-hoje'); if (!cx) return;
    const l = cfg.hoje ? (S.hojeDia || []) : [];
    cx.hidden = !l.length;
    if (l.length) cx.innerHTML = '<small>Hoje é dia de</small><b>' + esc(l[0]) + '</b>' + (l.length > 1 ? '<em>e mais ' + (l.length - 1) + '</em>' : '');
  }

  function pintar(entrando) {
    if (!raiz || modoAtivo === 'animacao') return;
    const corpo = raiz.querySelector('#tv-corpo');
    faixaHoje();
    if (!S.panorama) {
      corpo.innerHTML = '<p class="tv-vazio tv-centro">' + (S.erro ? 'Não foi possível carregar os dados agora. Nova tentativa em instantes.' : 'Carregando…') + '</p>';
      return;
    }
    const a = new Date();
    if (!cfg.agenda) tela = 'agencia';
    const blocoAgenda = cfg.gravacoes || (cfg.publicacoes && S.publicacoes) ? '<section class="tv-bloco tv-agenda">' + agenda() + '</section>' : '';
    const blocoEtapas = cfg.etapas ? '<section class="tv-bloco"><h2>Etapas da agência</h2>' + etapas(S.panorama) + '</section>' : '';
    const lado = blocoEtapas + blocoAgenda;
    const primeira = !corpo.dataset.pronto; corpo.dataset.pronto = '1';
    corpo.className = 'tv-corpo' + (tela === 'semana' ? ' tv-tela-semana' : (cfg.clientes ? '' : ' sem-clientes') + (lado ? '' : ' sem-lado')) +
      (entrando || primeira ? ' tv-entra' : '');
    corpo.innerHTML = resumo(S.panorama) + (tela === 'semana' ? semana()
      : (cfg.clientes ? '<section class="tv-bloco tv-clientes"><header><h2>Clientes em ' + MES[a.getMonth()] + '</h2>' +
          '<span class="tv-nota" id="tv-clientes-nota"></span></header>' +
          '<div class="tv-clientes-corpo" id="tv-clientes-corpo"></div></section>' : '') +
        (lado ? '<aside class="tv-lado">' + lado + '</aside>' : ''));
    clientes(S.panorama);
    if (entrando || primeira) contar(corpo);
    const at = raiz.querySelector('#tv-atualizado');
    if (at) at.textContent = (S.erro ? 'sem conexão — mostrando o último dado · ' : '') + 'atualizado às ' + pad(a.getHours()) + ':' + pad(a.getMinutes());
  }

  async function renovar() {
    ultima = Date.now(); diaPintado = hoje();
    await carregar();
    pintar();
  }

  /* ---------------------------------------------------------- abrir/sair */
  async function manterAcesa() {
    try { if (navigator.wakeLock && !document.hidden) trava = await navigator.wakeLock.request('screen'); } catch (e) { trava = null; }
  }
  const aoVoltar = () => { if (!document.hidden) { manterAcesa(); if (Date.now() - ultima > 5 * 60000) renovar(); } };
  const aoTecla = e => { if (e.key === 'Escape') sair(); };
  let somemEm = 0;
  const aoMexer = () => {
    if (!raiz) return;
    raiz.classList.add('tv-mexeu'); clearTimeout(somemEm);
    somemEm = setTimeout(() => raiz && raiz.classList.remove('tv-mexeu'), 3000);
  };
  const aoRedimensionar = () => { if (S.panorama) clientes(S.panorama); };

  function sair() { const para = antes && !/^#\/tv/.test(antes) ? antes : '#/config'; fechar(); location.hash = para; }

  function fechar() {
    clearInterval(pulso); clearInterval(giro); clearInterval(troca); clearTimeout(somemEm); pulso = giro = troca = 0; tela = 'agencia';
    clearTimeout(animTimer); clearTimeout(vinhetaTimer); modoAtivo = ''; modoForcado = '';
    if (eraCurta) { document.documentElement.classList.add('ab-curta'); eraCurta = false; }
    document.removeEventListener('visibilitychange', aoVoltar);
    document.removeEventListener('keydown', aoTecla);
    window.removeEventListener('resize', aoRedimensionar);
    try { if (trava) trava.release(); } catch (e) {} trava = null;
    document.body.classList.remove('modo-tv');
    if (raiz) raiz.remove(); raiz = null;
  }

  function abrir(vindoDe) {
    if (B7.Recursos && !B7.Recursos.ligado('tv')) { B7.UI.toast('O Painel de TV não está liberado para esta conta.'); location.hash = '#/'; return; }
    fechar();
    antes = vindoDe || anterior || '#/config';
    B7.Rota.titulo(['Painel de TV']);
    document.body.classList.add('modo-tv');
    raiz = document.createElement('div');
    raiz.className = 'tv'; raiz.id = 'tv-raiz';
    raiz.innerHTML =
      '<header class="tv-cab"><div class="tv-marca"><img class="tv-logo claro" src="assets/brand/logo-color.png" alt="Branding7">' +
          '<img class="tv-logo escuro" src="assets/brand/logo-white.png" alt="" aria-hidden="true"></div>' +
        '<div class="tv-hoje" id="tv-hoje" hidden></div>' +
        '<div class="tv-relogio" id="tv-relogio"></div></header>' +
      '<i class="tv-luz" aria-hidden="true"></i><i class="tv-luz dois" aria-hidden="true"></i><i class="tv-grao" aria-hidden="true"></i>' +
      '<div class="tv-corpo" id="tv-corpo" role="main"></div>' +
      '<div class="tv-anim" id="tv-anim" hidden></div>' +
      '<footer class="tv-pe"><span id="tv-atualizado"></span><span>somente leitura · sem dados pessoais</span></footer>' +
      '<button type="button" class="tv-sair" id="tv-sair">Sair do Painel de TV <kbd>Esc</kbd></button>';
    document.body.appendChild(raiz);
    raiz.querySelector('#tv-sair').onclick = sair;
    raiz.addEventListener('mousemove', aoMexer);
    document.addEventListener('visibilitychange', aoVoltar);
    document.addEventListener('keydown', aoTecla);
    window.addEventListener('resize', aoRedimensionar);
    B7.Rota.aoSair(fechar);

    Object.keys(S).forEach(k => { S[k] = k === 'erro' ? false : null; });
    pagina = 0; modoAtivo = '';
    modoForcado = (m => (m && (m[1] === 'animacao' || m[1] === 'painel')) ? m[1] : '')(/[?&]modo=([a-z]+)/.exec(location.hash));
    /* a abertura completa só toca inteira sem a marca de "já vi nesta sessão" */
    eraCurta = document.documentElement.classList.contains('ab-curta'); document.documentElement.classList.remove('ab-curta');
    if (modoForcado) aplicarModo();
    relogio(); pintar(); renovar(); manterAcesa();
    pulso = setInterval(() => {
      if (!raiz || !raiz.isConnected) { fechar(); return; }
      relogio();
      if (document.hidden) return;
      if (diaPintado !== hoje() || Date.now() - ultima >= 5 * 60000) renovar();
    }, 15000);
    /* zzz136: com a agenda da semana ligada, as duas telas se alternam */
    let ultimaTroca = Date.now();
    troca = setInterval(() => {
      if (!raiz || document.hidden || !S.panorama || !cfg.agenda) return;
      if (modoAtivo !== 'painel' || !raiz.querySelector('#tv-anim').hidden) return;
      if (Date.now() - ultimaTroca < (Number(cfg.intervalo) || 45) * 1000) return;
      ultimaTroca = Date.now();
      /* a tela sai, troca e entra (zzz137) */
      const corpo = raiz.querySelector('#tv-corpo'); corpo.classList.add('tv-sai');
      setTimeout(() => { if (raiz) { tela = tela === 'agencia' ? 'semana' : 'agencia'; pintar(true); } }, reduz() ? 0 : 430);
    }, 5000);
    /* vinheta da B7 a cada 5 minutos, se ligada */
    ultimaVinheta = Date.now();
    const vinhetas = setInterval(() => {
      if (!raiz) { clearInterval(vinhetas); return; }
      if (document.hidden || !cfg.vinheta || modoAtivo !== 'painel' || !S.panorama) return;
      if (Date.now() - ultimaVinheta >= 5 * 60000) passarVinheta();
    }, 10000);
    /* clientes demais para uma página: a lista roda sozinha */
    giro = setInterval(() => {
      if (!raiz || document.hidden || !S.panorama) return;
      const vivos = S.panorama.filter(l => l.estado !== 'vazio').length;
      if (vivos <= capacidade().total) return;
      pagina++; clientes(S.panorama);
    }, 20000);
  }

  /* de onde a pessoa veio, para o "Sair" devolver ao mesmo lugar */
  let anterior = '';
  window.addEventListener('hashchange', ev => {
    try { const h = new URL(ev.oldURL).hash; if (!/^#\/tv/.test(h)) anterior = h || '#/'; } catch (e) {}
    /* saiu do endereço por qualquer caminho (voltar do navegador, link): a tela some junto */
    if (raiz && !/^#\/tv/.test(location.hash)) fechar();
  });

  /* ------------------------------------------- configuração (administrador) */
  function configurar() {
    const OPCOES = [
      ['clientes', 'Lista de clientes', 'cada cliente com as sete etapas e o percentual'],
      ['nomes', 'Nome do cliente nas gravações', 'desligado, a gravação aparece só pelo título'],
      ['etapas', 'Etapas da agência', 'quantos clientes em dia, andando, em atenção e atraso por etapa'],
      ['gravacoes', 'Próximas gravações', 'as dos próximos 7 dias'],
      ['publicacoes', 'Publicações de hoje', 'publicadas de quantas'],
      ['hoje', '“Hoje é dia de…”', 'a data relevante do dia, no topo'],
      ['agenda', 'Alternar com a agenda da semana', 'uma segunda tela com os próximos 7 dias'],
      ['vinheta', 'Vinheta da B7 a cada 5 minutos', 'a animação de abertura passa por cima do painel e some']];
    const m = B7.UI.modal('<h3>Painel de TV</h3><p class="sub">O que aparece na tela da agência. Vale para todo aparelho que abrir o Painel de TV; quem já está com ele aberto recebe em até 5 minutos.</p>' +
      '<div class="tv-cfg" id="tv-cfg"><p class="adm-vazio">Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tv-cfg-ok" disabled>Salvar</button></div>');
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#tv-cfg'), ok = m.querySelector('#tv-cfg-ok');
    lerConfig().then(c => {
      if (!cx.isConnected) return;
      cx.innerHTML = '<div class="tv-cfg-modo" role="radiogroup" aria-label="O que a TV mostra">' +
          [['painel', 'Painel da agência', 'os números do mês, em visual de cinema'], ['animacao', 'Só a animação da B7', 'a abertura do sistema em ciclo, sem número nenhum']].map(([v, t, d]) =>
            '<label><input type="radio" name="tv-modo" value="' + v + '"' + ((c.modo === 'animacao' ? 'animacao' : 'painel') === v ? ' checked' : '') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>').join('') + '</div>' +
        '<div class="tv-cfg-blocos" id="tv-cfg-blocos">' + OPCOES.map(([k, t, d]) => '<label class="tv-cfg-l"><input type="checkbox" data-k="' + k + '"' + (c[k] ? ' checked' : '') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>').join('') +
        '<label class="tv-cfg-int" id="tv-cfg-int"><span>Trocar de tela a cada</span><select class="campo" id="tv-cfg-seg">' +
          [[20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [120, '2 minutos']].map(([v, r]) =>
            '<option value="' + v + '"' + (Number(c.intervalo) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label>' +
        '<p class="tv-cfg-aviso" id="tv-cfg-aviso" hidden></p></div>';
      const conferir = () => {
        const v = k => cx.querySelector('[data-k="' + k + '"]').checked;
        cx.querySelector('#tv-cfg-int').hidden = !v('agenda');
        cx.querySelector('#tv-cfg-blocos').classList.toggle('apagado', cx.querySelector('input[name="tv-modo"]:checked').value === 'animacao');
        const av = cx.querySelector('#tv-cfg-aviso');
        av.hidden = v('clientes') || v('etapas') || v('gravacoes') || v('publicacoes');
        av.textContent = 'Com tudo desligado, a tela fica só com o resumo do mês e o relógio.';
      };
      cx.querySelectorAll('input').forEach(i => i.onchange = conferir); conferir();
      ok.disabled = false;
    });
    ok.onclick = async () => {
      const novo = { intervalo: Number(cx.querySelector('#tv-cfg-seg').value) || 45, modo: cx.querySelector('input[name="tv-modo"]:checked').value };
      cx.querySelectorAll('[data-k]').forEach(i => { novo[i.dataset.k] = i.checked; });
      ok.disabled = true; ok.textContent = 'Salvando…';
      try {
        await B7.DB.rpc('tv_config_definir', { p_valor: novo });
        m.fechar(); B7.UI.toast('Painel de TV configurado.');
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Salvar';
        B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' });
      }
    };
  }

  return { abrir, configurar };
})();
