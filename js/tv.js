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

  let raiz = null, pulso = 0, giro = 0, ultima = 0, diaPintado = '', pagina = 0, trava = null, antes = '#/';
  const S = { panorama: null, gravacoes: null, publicacoes: null, hojeDia: null, erro: false };

  /* ------------------------------------------------------------ leitura */
  async function carregar() {
    const h = hoje(), a = new Date();
    const tenta = p => Promise.resolve(p).catch(() => null);
    const [pan, grav, pub, ops] = await Promise.all([
      tenta(B7.DB.panoramaMes(a.getFullYear(), a.getMonth() + 1)),
      tenta(B7.Eventos && B7.Eventos.carregarDominio ? B7.Eventos.carregarDominio('gravacao', h, somarDias(h, 7)) : null),
      tenta(B7.Perm.podeRota('publicacoes') ? B7.DB.publicacoesDoPeriodo(h, h) : null),
      tenta(B7.Oportunidades && B7.Oportunidades.periodo && B7.Perm.podeRota('oportunidades') ? B7.Oportunidades.periodo(h, h) : null)
    ]);
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
        '<b>' + pct + '<i>%</i></b></div>' +
      '<div class="tv-resumo-tx"><span>Andamento do mês</span><strong>' + com + (com === 1 ? ' cliente' : ' clientes') + ' com movimento</strong></div>' +
      '<div class="tv-nums">' + ['ok', 'andamento', 'atencao', 'atraso'].map(k =>
        '<div class="tv-num tv-e-' + k + '"><b>' + n[k] + '</b><span>' + ROT[k] + '</span></div>').join('') + '</div>' +
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
        '<span class="tv-lista-tx"><b>' + esc(g.cliente || g.titulo || 'Gravação') + '</b>' +
        (g.cliente && g.titulo ? '<small>' + esc(g.titulo) + '</small>' : '') + '</span></li>';
    }).join('') + '</ul>';

    let pub = '';
    if (S.publicacoes) {
      const t = S.publicacoes.length, p = S.publicacoes.filter(x => x.status === 'Publicado').length;
      pub = '<div class="tv-pub"><div class="tv-pub-n"><b>' + p + '</b><span>de ' + t + (t === 1 ? ' publicação de hoje' : ' publicações de hoje') + '</span></div>' +
        '<span class="tv-etapa-barra"><i class="tv-e-ok" style="flex:' + p + '"></i><i class="tv-e-vazio" style="flex:' + Math.max(t - p, t ? 0 : 1) + '"></i></span></div>';
    }
    return (pub ? '<h2>Publicações</h2>' + pub : '') + '<h2>Próximas gravações</h2>' + grav;
  }

  function faixaHoje() {
    const cx = raiz.querySelector('#tv-hoje'); if (!cx) return;
    const l = S.hojeDia || [];
    cx.hidden = !l.length;
    if (l.length) cx.innerHTML = '<small>Hoje é dia de</small><b>' + esc(l[0]) + '</b>' + (l.length > 1 ? '<em>e mais ' + (l.length - 1) + '</em>' : '');
  }

  function pintar() {
    if (!raiz) return;
    const corpo = raiz.querySelector('#tv-corpo');
    faixaHoje();
    if (!S.panorama) {
      corpo.innerHTML = '<p class="tv-vazio tv-centro">' + (S.erro ? 'Não foi possível carregar os dados agora. Nova tentativa em instantes.' : 'Carregando…') + '</p>';
      return;
    }
    const a = new Date();
    corpo.innerHTML = resumo(S.panorama) +
      '<section class="tv-bloco tv-clientes"><header><h2>Clientes em ' + MES[a.getMonth()] + '</h2>' +
        '<span class="tv-nota" id="tv-clientes-nota"></span></header>' +
        '<div class="tv-clientes-corpo" id="tv-clientes-corpo"></div></section>' +
      '<aside class="tv-lado"><section class="tv-bloco"><h2>Etapas da agência</h2>' + etapas(S.panorama) + '</section>' +
        '<section class="tv-bloco tv-agenda">' + agenda() + '</section></aside>';
    clientes(S.panorama);
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
    clearInterval(pulso); clearInterval(giro); clearTimeout(somemEm); pulso = giro = 0;
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
      '<div class="tv-corpo" id="tv-corpo" role="main"></div>' +
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
    pagina = 0;
    relogio(); pintar(); renovar(); manterAcesa();
    pulso = setInterval(() => {
      if (!raiz || !raiz.isConnected) { fechar(); return; }
      relogio();
      if (document.hidden) return;
      if (diaPintado !== hoje() || Date.now() - ultima >= 5 * 60000) renovar();
    }, 15000);
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

  return { abrir };
})();
