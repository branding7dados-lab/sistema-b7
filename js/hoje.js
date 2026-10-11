/* =====================================================================
   B7 DE HOJE (zzz154) — "me mostra o meu dia em 30 segundos"

   Um carrossel em tela cheia, no jeito dos Stories: barrinhas no topo,
   cada tela passa sozinha (~6 s), toque à direita avança, à esquerda
   volta, segurar pausa, arrastar para baixo (ou X / Esc / voltar do
   Android) fecha.

   Telas (só entram as que têm o que mostrar; capa e fim sempre):
     1. capa       — bom dia + nome + data + os números do dia
     2. no ar hoje — publicações com data de hoje (gestão / quem vê
                     Publicações)
     3. gravações  — hoje e amanhã (gestão: todas; os outros: as suas)
     4. prazos     — vídeos e peças de design que vencem hoje
     5. atrasados  — o que passou do prazo
     6. fim        — atalhos (Painel, Calendário) e "abrir sozinho"

   Os números seguem a mesma regra do widget e do "Resumo do dia"
   (migration_widget_hoje.sql): prazos e atrasos são os DA PESSOA; a
   gestão (admin/coordenador) vê a operação inteira. O cliente de teste
   fica de fora. Tudo pelo RLS da própria sessão — nenhuma função nova
   no banco.

   Abre sozinho uma vez por dia, na primeira vez que a pessoa abre o
   sistema no celular (ou no app), se houver algo para mostrar. Dá para
   desligar na última tela. Também abre pelo menu "Mais" → "Meu dia".
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Hoje = (() => {
  const esc = s => (B7.UI && B7.UI.esc ? B7.UI.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const DURACAO = 6500;
  const MAX_LISTA = 5;
  const CHAVE_DIA = 'b7_hoje_visto';
  const CHAVE_AUTO = 'b7_hoje_auto';

  const ler = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  /* --------------------------------------------------------- datas */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const hojeISO = () => iso(new Date());
  const amanhaISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); };
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function dataLonga() {
    const d = new Date();
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }
  function saudacao() {
    const h = new Date().getHours();
    return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  function diasAtras(prazo) {
    const [a, m, d] = String(prazo).slice(0, 10).split('-').map(Number);
    const p = new Date(a, m - 1, d), h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((h - p) / 864e5));
  }
  const hora = h => h ? String(h).slice(0, 5) : '';

  /* --------------------------------------------------------- dados */
  const quemSou = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const gestao = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());
  const podeVer = rota => {
    try { return !B7.Perm || !B7.Perm.podeRota || B7.Perm.podeRota(rota); } catch (e) { return true; }
  };
  /* consulta que pode falhar sozinha (tabela sem acesso, rede) sem
     derrubar o resto */
  async function talvez(q) {
    try { const r = await q; return r && !r.error ? (r.data || []) : []; } catch (e) { return []; }
  }

  async function carregar() {
    const eu = quemSou();
    if (!eu || !B7.sb) return null;
    const sb = B7.sb, hoje = hojeISO(), amanha = amanhaISO(), g = gestao();
    const funcoes = [eu.papel].concat((B7.Auth.funcoesExtra && B7.Auth.funcoesExtra()) || []);
    const souVideomaker = funcoes.includes('videomaker') || (B7.Auth.funcao && B7.Auth.funcao() === 'videomaker');
    const verPub = g || podeVer('publicacoes');

    let qVid = sb.from('demandas_edicao_resumo')
      .select('id,titulo,codigo,client_id,cliente_nome,cliente_logo_url,editing_status,prazo,videomaker_id,videomaker_nome')
      .is('deleted_at', null).not('editing_status', 'in', '(entregue,descartado)')
      .lte('prazo', hoje).order('prazo', { ascending: true }).limit(60);
    if (!g) qVid = qVid.eq('videomaker_id', eu.id);
    let qDes = sb.from('design_resumo').select('*')
      .not('status', 'in', '(finalizado,aprovado_cliente)')
      .lte('prazo', hoje).order('prazo', { ascending: true }).limit(60);
    if (!g) qDes = qDes.eq('designer_id', eu.id);

    const [teste, pubs, gravs, vids, dess] = await Promise.all([
      talvez(sb.from('clientes').select('id').eq('teste', true)),
      verPub ? talvez(sb.from('conteudos')
        .select('id,titulo,tipo,canal,status,client_id,clientes(id,nome,logo_url)')
        .is('deleted_at', null).is('archived_at', null).eq('data_postagem', hoje)
        .order('position', { ascending: true }).limit(60)) : [],
      talvez(sb.from('gravacoes_resumo')
        .select('id,nome,client_id,cliente_nome,cliente_logo_url,data_gravacao,hora_inicio,hora_fim,local,videomaker_id,videomaker_nome,situacao,gravada_em,concluida_em')
        .is('deleted_at', null).is('archived_at', null)
        .gte('data_gravacao', hoje).lte('data_gravacao', amanha)
        .order('data_gravacao', { ascending: true }).order('hora_inicio', { ascending: true, nullsFirst: false })),
      talvez(qVid),
      talvez(qDes)
    ]);
    const fora = new Set(teste.map(t => t.id));
    const valido = r => !(r && r.client_id && fora.has(r.client_id));

    const publicacoes = pubs.filter(valido).map(p => ({
      id: p.id, titulo: p.titulo || 'Sem título', tipo: p.tipo || '', canal: p.canal || '',
      publicado: p.status === 'Publicado',
      cliente: (p.clientes && p.clientes.nome) || '', logo: (p.clientes && p.clientes.logo_url) || ''
    }));
    const gravacoes = gravs.filter(valido)
      .filter(x => !x.concluida_em && x.situacao !== 'concluida' && x.situacao !== 'cancelada')
      .filter(x => g || x.videomaker_id === eu.id || (!x.videomaker_id && souVideomaker))
      .map(x => ({
        id: x.id, nome: x.nome || 'Gravação', cliente: x.cliente_nome || '', logo: x.cliente_logo_url || '',
        dia: String(x.data_gravacao).slice(0, 10) === hoje ? 'hoje' : 'amanhã',
        hora: hora(x.hora_inicio), fim: hora(x.hora_fim), local: x.local || '', videomaker: x.videomaker_nome || ''
      }));
    const demandas = vids.filter(valido).map(d => ({
      id: d.id, tipo: 'video', titulo: d.titulo || d.codigo || 'Vídeo', cliente: d.cliente_nome || '',
      logo: d.cliente_logo_url || '', prazo: String(d.prazo).slice(0, 10), quem: g ? (d.videomaker_nome || '') : '',
      href: '#/video/' + d.id
    })).concat(dess.filter(valido).map(d => ({
      id: d.id, tipo: 'design', titulo: d.titulo || d.conteudo_titulo || 'Peça de design', cliente: d.cliente_nome || '',
      logo: d.cliente_logo_url || '', prazo: String(d.prazo).slice(0, 10), quem: g ? (d.designer_nome || '') : '',
      href: '#/design/' + d.id
    })));
    return {
      nome: String(eu.nome || '').split(' ')[0],
      gestao: g,
      verPub,
      publicacoes,
      gravacoes,
      prazos: demandas.filter(d => d.prazo === hoje),
      atrasados: demandas.filter(d => d.prazo < hoje).sort((a, b) => a.prazo < b.prazo ? -1 : 1)
    };
  }

  /* --------------------------------------------------------- telas */
  function logo(url, nome) {
    const ini = String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
    return '<span class="hj-logo" aria-hidden="true">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc(ini || '•')) + '</span>';
  }
  function lista(itens, linha) {
    const vis = itens.slice(0, MAX_LISTA);
    return '<ul class="hj-lista">' + vis.map((it, i) => '<li style="--i:' + i + '">' + linha(it) + '</li>').join('') + '</ul>' +
      (itens.length > MAX_LISTA ? '<p class="hj-mais">+ ' + (itens.length - MAX_LISTA) + ' ' + (itens.length - MAX_LISTA === 1 ? 'outro' : 'outros') + '</p>' : '');
  }
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  function montarTelas(d) {
    const t = [];
    const gHoje = d.gravacoes.filter(x => x.dia === 'hoje');
    const nPub = d.publicacoes.filter(p => !p.publicado).length;

    /* 1. capa */
    const numeros = [];
    if (d.verPub) numeros.push({ n: nPub, r: nPub === 1 ? 'publicação' : 'publicações' });
    numeros.push({ n: gHoje.length, r: gHoje.length === 1 ? 'gravação' : 'gravações' });
    numeros.push({ n: d.prazos.length, r: d.prazos.length === 1 ? 'prazo' : 'prazos' });
    numeros.push({ n: d.atrasados.length, r: d.atrasados.length === 1 ? 'atrasado' : 'atrasados', alerta: d.atrasados.length > 0 });
    const nada = !nPub && !gHoje.length && !d.prazos.length && !d.atrasados.length;
    t.push({
      id: 'capa', cor: 'capa',
      html: '<div class="hj-capa">' +
        '<p class="hj-kicker">' + esc(dataLonga()) + '</p>' +
        '<h2>' + esc(saudacao()) + (d.nome ? ', ' + esc(d.nome) : '') + '!</h2>' +
        '<p class="hj-sub">' + (nada ? 'Dia tranquilo por aqui. Nada vencendo e nada atrasado.' : 'Este é o seu dia no B7' + (d.gestao ? ' (visão da operação)' : '') + '.') + '</p>' +
        '<div class="hj-numeros">' + numeros.map((x, i) =>
          '<div class="hj-num' + (x.alerta ? ' alerta' : '') + '" style="--i:' + i + '"><b>' + x.n + '</b><span>' + x.r + '</span></div>').join('') + '</div>' +
        '<p class="hj-dica">Toque para passar · segure para pausar</p></div>'
    });

    /* 2. no ar hoje */
    if (d.publicacoes.length) {
      const feitas = d.publicacoes.length - nPub;
      t.push({
        id: 'publicacoes', cor: 'pub', rota: '#/publicacoes', rotulo: 'Ver publicações',
        html: '<p class="hj-kicker">No ar hoje</p><h2>' + plural(d.publicacoes.length, 'publicação', 'publicações') + '</h2>' +
          '<p class="hj-sub">' + (feitas ? feitas + ' já ' + (feitas === 1 ? 'publicada' : 'publicadas') + ' · ' : '') + (nPub ? nPub + ' para subir' : 'tudo no ar 🎉') + '</p>' +
          lista(d.publicacoes, p => logo(p.logo, p.cliente) +
            '<span class="hj-tx"><b>' + esc(p.titulo) + '</b><small>' + esc([p.cliente, p.tipo || p.canal].filter(Boolean).join(' · ')) + '</small></span>' +
            (p.publicado ? '<span class="hj-ok" title="Publicado">✓</span>' : ''))
      });
    }

    /* 3. gravações */
    if (d.gravacoes.length) {
      const amanha = d.gravacoes.length - gHoje.length;
      t.push({
        id: 'gravacoes', cor: 'grav', rota: '#/gravacoes', rotulo: 'Ver gravações',
        html: '<p class="hj-kicker">Gravações</p><h2>' + (gHoje.length ? plural(gHoje.length, 'gravação hoje', 'gravações hoje') : 'Nenhuma hoje') + '</h2>' +
          '<p class="hj-sub">' + (amanha ? plural(amanha, 'marcada para amanhã', 'marcadas para amanhã') : 'nada marcado para amanhã') + '</p>' +
          lista(d.gravacoes, x => logo(x.logo, x.cliente) +
            '<span class="hj-tx"><b>' + esc(x.nome) + '</b><small>' + esc([x.cliente, x.local, d.gestao ? x.videomaker : ''].filter(Boolean).join(' · ')) + '</small></span>' +
            '<span class="hj-quando"><b>' + esc(x.hora || '—') + '</b><small>' + esc(x.dia) + '</small></span>', 'grav')
      });
    }

    /* 4. prazos de hoje */
    if (d.prazos.length) {
      t.push({
        id: 'prazos', cor: 'prazo', rota: d.prazos.every(x => x.tipo === 'design') ? '#/design' : '#/video', rotulo: 'Abrir produção',
        html: '<p class="hj-kicker">Vence hoje</p><h2>' + plural(d.prazos.length, 'entrega', 'entregas') + '</h2>' +
          '<p class="hj-sub">' + (d.gestao ? 'da operação, ainda não entregues' : 'suas, ainda não entregues') + '</p>' +
          lista(d.prazos, x => logo(x.logo, x.cliente) +
            '<span class="hj-tx"><b>' + esc(x.titulo) + '</b><small>' + esc([x.tipo === 'video' ? 'Vídeo' : 'Design', x.cliente, x.quem].filter(Boolean).join(' · ')) + '</small></span>')
      });
    }

    /* 5. atrasados */
    if (d.atrasados.length) {
      t.push({
        id: 'atrasados', cor: 'atraso', rota: d.atrasados.every(x => x.tipo === 'design') ? '#/design' : '#/video', rotulo: 'Resolver atrasos',
        html: '<p class="hj-kicker">Atenção</p><h2>' + plural(d.atrasados.length, 'atrasado', 'atrasados') + '</h2>' +
          '<p class="hj-sub">passaram do prazo e ainda não foram entregues</p>' +
          lista(d.atrasados, x => logo(x.logo, x.cliente) +
            '<span class="hj-tx"><b>' + esc(x.titulo) + '</b><small>' + esc([x.tipo === 'video' ? 'Vídeo' : 'Design', x.cliente, x.quem].filter(Boolean).join(' · ')) + '</small></span>' +
            '<span class="hj-atraso">' + diasAtras(x.prazo) + 'd</span>')
      });
    }

    /* 6. fim */
    const auto = ler(CHAVE_AUTO) !== '0';
    t.push({
      id: 'fim', cor: 'fim',
      html: '<div class="hj-capa"><p class="hj-kicker">Pronto</p><h2>' + (nada ? 'Bom trabalho!' : 'Bora pra cima!') + '</h2>' +
        '<p class="hj-sub">Esse foi o seu dia em 30 segundos.</p>' +
        '<div class="hj-botoes">' +
          (podeVer('painel') ? '<a class="hj-bt" href="#/painel" data-ir>Abrir o Painel</a>' : '') +
          (podeVer('calendario') ? '<a class="hj-bt' + (podeVer('painel') ? ' sec' : '') + '" href="#/calendario" data-ir>Ver o calendário</a>' : '') +
          '<button type="button" class="hj-bt sec" data-rever>Ver de novo</button>' +
        '</div>' +
        '<label class="hj-auto"><input type="checkbox" data-auto' + (auto ? ' checked' : '') + '> Mostrar sozinho na primeira vez que abro o dia</label></div>'
    });
    return t;
  }

  /* --------------------------------------------------------- tela cheia */
  let S = null;

  async function abrir(opcoes) {
    if (S) return;
    opcoes = opcoes || {};
    const el = document.createElement('div');
    el.className = 'hj-tela';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Meu dia no B7');
    el.innerHTML = '<div class="hj-barras"></div>' +
      '<div class="hj-topo"><span class="hj-marca"><img src="assets/brand/symbol-white.png" alt=""> Meu dia</span>' +
      '<button type="button" class="hj-x" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="hj-palco"><div class="hj-carregando"><span></span>Montando o seu dia…</div></div>' +
      '<div class="hj-rodape"></div>';
    document.body.appendChild(el);
    document.body.classList.add('hj-aberto');
    S = { el, i: 0, telas: [], inicio: 0, gasto: 0, pausado: true, raf: 0, anterior: document.activeElement, empurrou: false };
    try { history.pushState({ b7hoje: 1 }, ''); S.empurrou = true; } catch (e) {}
    window.addEventListener('popstate', aoVoltar);
    document.addEventListener('keydown', aoTeclar, true);
    document.addEventListener('visibilitychange', aoVisibilidade);
    el.querySelector('.hj-x').onclick = e => { e.stopPropagation(); fechar(); };
    requestAnimationFrame(() => el.classList.add('on'));
    el.querySelector('.hj-x').focus({ preventScroll: true });

    let dados = opcoes.dados || null;
    if (!dados) { try { dados = await carregar(); } catch (e) { dados = null; } }
    if (!S || S.el !== el) return;
    if (!dados) {
      el.querySelector('.hj-palco').innerHTML = '<div class="hj-carregando">Não deu para carregar o seu dia agora. Confira a internet e tente de novo.</div>';
      return;
    }
    S.telas = montarTelas(dados);
    el.querySelector('.hj-barras').innerHTML = S.telas.map(() => '<span><i></i></span>').join('');
    ligarToques();
    ir(0);
  }

  function ir(n) {
    if (!S) return;
    if (n >= S.telas.length) return fechar();
    n = Math.max(0, n);
    S.i = n;
    const tela = S.telas[n];
    const palco = S.el.querySelector('.hj-palco');
    S.el.dataset.cor = tela.cor;
    palco.innerHTML = '<section class="hj-slide" data-tela="' + tela.id + '">' + tela.html + '</section>';
    palco.firstChild.setAttribute('aria-live', 'polite');
    const rod = S.el.querySelector('.hj-rodape');
    rod.innerHTML = tela.rota && podeVer(tela.rota.slice(2)) ? '<a class="hj-cta" href="' + esc(tela.rota) + '" data-ir>' + esc(tela.rotulo) + ' <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a>' : '';
    S.el.querySelectorAll('.hj-barras > span').forEach((b, k) => {
      b.classList.toggle('feita', k < n);
      b.querySelector('i').style.transform = 'scaleX(' + (k < n ? 1 : 0) + ')';
    });
    S.el.querySelectorAll('[data-ir]').forEach(a => a.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const destino = a.getAttribute('href');
      fechar(false, () => { location.hash = destino; });
    });
    const rv = S.el.querySelector('[data-rever]');
    if (rv) rv.onclick = e => { e.stopPropagation(); ir(0); };
    const au = S.el.querySelector('[data-auto]');
    if (au) {
      au.onclick = e => e.stopPropagation();
      au.onchange = () => gravar(CHAVE_AUTO, au.checked ? '1' : '0');
      au.closest('label').onclick = e => e.stopPropagation();
    }
    S.gasto = 0;
    /* a última tela fica parada: tem botões para tocar */
    if (tela.id === 'fim') { pausar(); preencher(1); return; }
    retomar();
  }

  function preencher(f) {
    const b = S && S.el.querySelectorAll('.hj-barras > span')[S.i];
    if (b) b.querySelector('i').style.transform = 'scaleX(' + Math.min(1, f) + ')';
  }
  function passo() {
    if (!S || S.pausado) return;
    const f = (S.gasto + (performance.now() - S.inicio)) / DURACAO;
    preencher(f);
    if (f >= 1) return ir(S.i + 1);
    S.raf = requestAnimationFrame(passo);
  }
  function pausar() {
    if (!S || S.pausado) return;
    S.gasto += performance.now() - S.inicio;
    S.pausado = true;
    cancelAnimationFrame(S.raf);
    S.el.classList.add('pausado');
  }
  function retomar() {
    if (!S || !S.telas.length || (S.telas[S.i] && S.telas[S.i].id === 'fim')) return;
    cancelAnimationFrame(S.raf);
    S.pausado = false;
    S.inicio = performance.now();
    S.el.classList.remove('pausado');
    S.raf = requestAnimationFrame(passo);
  }

  /* toque curto: lado esquerdo (1/3) volta, o resto avança; segurar
     pausa; arrastar para baixo fecha; para o lado troca de tela */
  function ligarToques() {
    const palco = S.el;
    let x0 = 0, y0 = 0, t0 = 0, segurando = null, ativo = false;
    palco.addEventListener('pointerdown', e => {
      if (e.target.closest('a, button, label, input')) return;
      ativo = true; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
      clearTimeout(segurando);
      segurando = setTimeout(pausar, 180);
    });
    palco.addEventListener('pointermove', e => {
      if (!ativo) return;
      const dy = e.clientY - y0;
      if (dy > 0 && Math.abs(dy) > Math.abs(e.clientX - x0)) {
        S.el.style.setProperty('--arrasto', Math.min(dy, 400) + 'px');
      }
    });
    const soltar = e => {
      if (!ativo || !S) return;
      ativo = false;
      clearTimeout(segurando);
      const dx = e.clientX - x0, dy = e.clientY - y0, dt = Date.now() - t0;
      S.el.style.removeProperty('--arrasto');
      if (dy > 110 && dy > Math.abs(dx)) return fechar();
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return ir(S.i + (dx < 0 ? 1 : -1));
      if (dt < 250 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        const larg = window.innerWidth || 1;
        return ir(S.i + (x0 < larg / 3 ? -1 : 1));
      }
      retomar();
    };
    palco.addEventListener('pointerup', soltar);
    palco.addEventListener('pointercancel', () => { ativo = false; clearTimeout(segurando); if (S) { S.el.style.removeProperty('--arrasto'); retomar(); } });
    palco.addEventListener('contextmenu', e => e.preventDefault());
  }

  function aoTeclar(e) {
    if (!S) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); ir(S.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(S.i - 1); }
    else if (e.key === ' ' && !e.target.closest('a, button, input')) { e.preventDefault(); S.pausado ? retomar() : pausar(); }
  }
  function aoVoltar() { if (S) { S.empurrou = false; fechar(true); } }
  function aoVisibilidade() { if (document.hidden) pausar(); }

  function fechar(semHistorico, depois) {
    if (!S) return;
    const { el, anterior, empurrou } = S;
    cancelAnimationFrame(S.raf);
    S = null;
    window.removeEventListener('popstate', aoVoltar);
    document.removeEventListener('keydown', aoTeclar, true);
    document.removeEventListener('visibilitychange', aoVisibilidade);
    document.body.classList.remove('hj-aberto');
    el.classList.remove('on');
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 260);
    const seguir = () => {
      if (depois) { try { depois(); } catch (e) {} }
      else if (anterior && anterior.focus && document.contains(anterior)) { try { anterior.focus({ preventScroll: true }); } catch (e) {} }
    };
    if (empurrou && semHistorico !== true) {
      /* tira a entrada que empurramos; só depois troca a rota (senão o
         back() desfaria a navegação do botão) */
      const uma = () => { window.removeEventListener('popstate', uma); seguir(); };
      window.addEventListener('popstate', uma);
      try { history.back(); } catch (e) { uma(); }
      setTimeout(() => { window.removeEventListener('popstate', uma); }, 1500);
    } else seguir();
  }

  /* --------------------------------------------------------- automático
     Uma vez por dia, no celular ou no app, para a equipe (cliente não),
     fora da prévia "Visualizar como…", e só se houver o que mostrar. */
  function celular() {
    const app = !!(B7.AppNativo && B7.AppNativo.ativo);
    let estreito = false;
    try { estreito = matchMedia('(max-width: 760px)').matches; } catch (e) {}
    return app || estreito;
  }
  let conferindo = false;
  async function talvezAbrirSozinho() {
    if (conferindo || S) return;
    const eu = quemSou();
    if (!eu || eu.papel === 'cliente') return;
    if (B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro()) return;
    if (B7.Auth.emSimulacao && B7.Auth.emSimulacao()) return;
    if (ler(CHAVE_AUTO) === '0' || !celular()) return;
    /* navegador automatizado (testes de fumaça): não cobre as telas */
    if (navigator.webdriver && !window.B7_HOJE_TESTE) return;
    const marca = eu.id + ':' + hojeISO();
    if (ler(CHAVE_DIA) === marca) return;
    /* espera a abertura e qualquer janela/tela cheia sair da frente */
    if (document.hidden || document.querySelector('.b7-abertura, .fundo-modal, .tele-aberto, .hj-tela')) return;
    if (document.body.classList.contains('tele-aberto')) return;
    conferindo = true;
    try {
      const dados = await carregar();
      if (!dados) return;
      gravar(CHAVE_DIA, marca);
      const algo = dados.publicacoes.length || dados.gravacoes.length || dados.prazos.length || dados.atrasados.length;
      if (!algo) return;
      if (document.querySelector('.fundo-modal, .hj-tela') || document.body.classList.contains('tele-aberto')) return;
      abrir({ dados });
    } catch (e) { /* tenta na próxima volta */ }
    finally { conferindo = false; }
  }
  function ligarAuto() {
    let tentativas = 0;
    const t = setInterval(() => {
      tentativas++;
      /* 3 s depois do sistema montado, ou desiste depois de ~2 min */
      if (tentativas > 60) return clearInterval(t);
      if (!quemSou() || !document.getElementById('app') || !document.getElementById('app').children.length) return;
      if (tentativas < 2) return;
      talvezAbrirSozinho().then(() => {
        const eu = quemSou();
        if (eu && ler(CHAVE_DIA) === eu.id + ':' + hojeISO()) clearInterval(t);
      });
    }, 2000);
    /* voltar ao app num dia novo (app que fica aberto de um dia para o
       outro) também conta como "primeira vez do dia" */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(talvezAbrirSozinho, 1500); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarAuto); else ligarAuto();

  return { abrir, fechar, carregar, montarTelas, aberto: () => !!S };
})();
