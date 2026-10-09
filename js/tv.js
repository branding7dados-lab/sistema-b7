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
  const S = { panorama: null, gravacoes: null, publicacoes: null, pubSemana: null, hojeDia: null, clima: null, erro: false };
  /* zzz136 — o que aparece é escolha do administrador (Configurações → Admin →
     Painel de TV), guardada em sistema_config "tv". Sem nada guardado, vale isto: */
  const PADRAO = { clientes: true, nomes: true, etapas: true, gravacoes: true, publicacoes: true, hoje: true, agenda: false, intervalo: 45,
    modo: 'painel', vinheta: false,
    /* zzz138 */ visual: 'cinema', fundo: 'fixo', zoom: 100, recado: '', recado_modo: 'destaque', saudacao: false, mural: false,
    clima: false, cidade: null, logo_img: '', logo_frase: '', logo_relogio: true };
  const VISUAIS = [['cinema', 'Cinema', 'escuro, com luzes e brilho'], ['aurora', 'Aurora', 'escuro, em verde-água e violeta'],
    ['claro', 'Claro', 'fundo claro, para sala iluminada'], ['minimal', 'Minimalista', 'preto e branco, sem efeitos']];
  let cfg = Object.assign({}, PADRAO), tela = 'agencia';
  /* zzz137 — "só a animação da B7": a TV fica com a cena da abertura do
     sistema, em ciclo, sem número nenhum. Vale pela configuração ou pelo
     endereço (#/tv?modo=animacao), que ganha da configuração. */
  let modoForcado = '', modoAtivo = '', animTimer = 0, vinhetaTimer = 0, ultimaVinheta = 0, eraCurta = false;
  const modoDaVez = () => modoForcado || (cfg.modo === 'animacao' || cfg.modo === 'logo' ? cfg.modo : 'painel');
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
    raiz.classList.toggle('tv-so-logo', m === 'logo');
    if (m === 'animacao') { palco.hidden = false; cicloAnimacao(); }
    else { palco.hidden = true; palco.innerHTML = ''; palco.classList.remove('tv-corte'); ultimaVinheta = Date.now(); }
    pintarLogo(); pintarRecado();
  }

  /* =================================================================
     zzz138 — visual, tamanho, fundo que muda, recado, saudação, mural,
     clima e a tela "só a logo". Tudo vem da configuração (sistema_config
     "tv"); nada aqui grava.
     ================================================================= */
  const zoomAtual = () => Math.min(1.5, Math.max(0.7, (Number(cfg.zoom) || 100) / 100));
  /* tamanho: a cena inteira é ampliada ou reduzida; a caixa encolhe na
     proporção inversa para continuar cobrindo a tela exata */
  function aplicarVisual() {
    if (!raiz) return;
    VISUAIS.forEach(v => raiz.classList.toggle('tv-v-' + v[0], (cfg.visual || 'cinema') === v[0]));
    const z = zoomAtual();
    if (Math.abs(z - 1) > 0.01) Object.assign(raiz.style, { width: (100 / z) + 'vw', height: (100 / z) + 'vh', right: 'auto', bottom: 'auto', transform: 'scale(' + z + ')', transformOrigin: '0 0' });
    else Object.assign(raiz.style, { width: '', height: '', right: '', bottom: '', transform: '', transformOrigin: '' });
    aplicarFundo();
  }
  /* fundo: fixo (o do visual), pelo horário do dia, ou pela situação da agência */
  function aplicarFundo() {
    if (!raiz) return;
    let a = '', b = '';
    if (cfg.fundo === 'dia') {
      const h = new Date().getHours();
      if (h >= 5 && h < 11) { a = 'rgba(255,150,80,.46)'; b = 'rgba(240,79,168,.34)'; }            /* manhã: quente */
      else if (h >= 11 && h < 17) { a = 'rgba(214,46,150,.42)'; b = 'rgba(92,78,255,.4)'; }         /* tarde: o tom da casa */
      else if (h >= 17 && h < 20) { a = 'rgba(255,92,92,.42)'; b = 'rgba(150,70,255,.42)'; }        /* fim de tarde */
      else { a = 'rgba(60,110,255,.4)'; b = 'rgba(40,200,220,.26)'; }                               /* noite: frio */
    } else if (cfg.fundo === 'atraso' && S.panorama) {
      const tem = k => S.panorama.some(l => l.estado === k);
      if (tem('atraso')) { a = 'rgba(255,70,110,.48)'; b = 'rgba(255,140,60,.3)'; }
      else if (tem('atencao')) { a = 'rgba(242,190,98,.42)'; b = 'rgba(240,79,168,.3)'; }
      else { a = 'rgba(79,224,166,.38)'; b = 'rgba(60,140,255,.32)'; }
    }
    if (a) { raiz.style.setProperty('--tv-luz-a', a); raiz.style.setProperty('--tv-luz-b', b); }
    else { raiz.style.removeProperty('--tv-luz-a'); raiz.style.removeProperty('--tv-luz-b'); }
  }

  /* recado do administrador: em destaque no alto, ou numa faixa correndo embaixo */
  function pintarRecado() {
    if (!raiz) return;
    const alto = raiz.querySelector('#tv-recado'), faixa = raiz.querySelector('#tv-faixa'); if (!alto || !faixa) return;
    const tx = String(cfg.recado || '').trim(), vale = !!tx && modoAtivo === 'painel';
    const emFaixa = cfg.recado_modo === 'faixa';
    alto.hidden = !(vale && !emFaixa); faixa.hidden = !(vale && emFaixa);
    if (!vale) { alto.dataset.t = faixa.dataset.t = ''; return; }
    if (!emFaixa && alto.dataset.t !== tx) { alto.dataset.t = tx; alto.innerHTML = '<i aria-hidden="true"></i><b>' + esc(tx) + '</b>'; }
    if (emFaixa && faixa.dataset.t !== tx) {
      faixa.dataset.t = tx;
      const peca = '<span>' + esc(tx) + '</span><i aria-hidden="true">✦</i>';
      /* o texto repetido o bastante para a faixa nunca ficar vazia; duas metades iguais fazem a volta sem emenda */
      const vezes = Math.max(2, Math.ceil(90 / Math.max(8, tx.length)));
      faixa.innerHTML = '<div class="tv-faixa-rola" style="animation-duration:' + Math.max(18, Math.round(vezes * (tx.length + 6) * 0.26)) + 's">' +
        peca.repeat(vezes) + '<span aria-hidden="true" class="tv-faixa-copia">' + peca.repeat(vezes) + '</span></div>';
    }
  }

  /* clima (opcional): a temperatura da cidade escolhida, ao lado da data.
     Vem do Open-Meteo, serviço aberto e sem chave; só as coordenadas da
     cidade saem do navegador. Falhou, não aparece. */
  const ROT_CLIMA = c => (c === 0 ? 'céu limpo' : c <= 2 ? 'poucas nuvens' : c === 3 ? 'nublado' : c <= 48 ? 'neblina' : c <= 57 ? 'garoa'
    : c <= 67 ? 'chuva' : c <= 77 ? 'neve' : c <= 82 ? 'pancadas de chuva' : c <= 86 ? 'neve' : 'trovoada');
  let ultimoClima = 0;
  async function carregarClima() {
    if (!cfg.clima || !cfg.cidade || typeof cfg.cidade.lat !== 'number') { S.clima = null; return; }
    if (S.clima && Date.now() - ultimoClima < 20 * 60000) return;
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + cfg.cidade.lat + '&longitude=' + cfg.cidade.lon + '&current=temperature_2m,weather_code&timezone=auto');
      const j = await r.json();
      if (j && j.current && typeof j.current.temperature_2m === 'number') { S.clima = { t: Math.round(j.current.temperature_2m), cod: Number(j.current.weather_code) || 0 }; ultimoClima = Date.now(); }
    } catch (e) { /* sem rede ou serviço fora: fica sem o clima */ }
    const cx = raiz && raiz.querySelector('#tv-relogio'); if (cx) { cx.dataset.h = ''; relogio(); }
  }

  /* "só a logo": a marca (ou a imagem que o administrador enviou), uma frase e o relógio, opcionais */
  function pintarLogo() {
    const cx = raiz && raiz.querySelector('#tv-logo'); if (!cx) return;
    cx.hidden = modoAtivo !== 'logo';
    if (cx.hidden) { cx.dataset.k = ''; return; }
    const padrao = (cfg.visual === 'claro') ? 'assets/brand/logo-color.png' : 'assets/brand/logo-white.png';
    const img = cfg.logo_img || padrao, frase = String(cfg.logo_frase || '').trim();
    const k = img + '|' + frase + '|' + (cfg.logo_relogio ? 1 : 0);
    if (cx.dataset.k !== k) {
      cx.dataset.k = k;
      cx.innerHTML = '<div class="tv-logo-caixa"><span class="tv-logo-img"><img src="' + esc(img) + '" alt="Branding7">' +
        /* o reflexo passa só por cima do desenho da logo (a própria imagem serve de máscara) */
        '<i aria-hidden="true" style="-webkit-mask-image:url(&quot;' + esc(encodeURI(img)) + '&quot;);mask-image:url(&quot;' + esc(encodeURI(img)) + '&quot;)"></i></span>' +
        (frase ? '<p>' + esc(frase) + '</p>' : '') + '</div>' + (cfg.logo_relogio ? '<div class="tv-logo-hora" id="tv-logo-hora"></div>' : '');
    }
    const hr = cx.querySelector('#tv-logo-hora');
    if (hr) { const a = new Date(); hr.innerHTML = '<b>' + pad(a.getHours()) + '<i>:</i>' + pad(a.getMinutes()) + '</b><span>' + DOW[a.getDay()] + ', ' + a.getDate() + ' de ' + MES[a.getMonth()] + '</span>'; }
  }

  /* mural: quem tem publicação ou gravação hoje, pela logo */
  function muralItens() {
    const h = hoje(), mapa = new Map(), logos = new Map();
    (S.panorama || []).forEach(l => { logos.set(l.c.id, l.c.logo_url); logos.set('n:' + String(l.c.nome).toLowerCase(), l.c.logo_url); });
    const item = (id, nome) => { const k = id || 'n:' + String(nome || '').toLowerCase(); if (!mapa.has(k)) mapa.set(k, { nome: nome || '', logo: logos.get(id) || logos.get('n:' + String(nome || '').toLowerCase()) || null, pubs: 0, feitas: 0, grav: '' }); return mapa.get(k); };
    (S.publicacoes || []).forEach(p => { const c = p.clientes || {}; if (!c.nome) return; const it = item(c.id || p.client_id, c.nome); if (c.logo_url) it.logo = c.logo_url; it.pubs++; if (p.status === 'Publicado') it.feitas++; });
    (S.gravacoes || []).filter(g => diaDoTs(g.inicio) === h && g.cliente).forEach(g => { const it = item(g.clienteId, g.cliente); if (!it.grav) it.grav = g.diaInteiro ? 'gravação hoje' : 'gravação às ' + hora(g.inicio); });
    return [...mapa.values()].sort((a, b) => (b.grav ? 1 : 0) - (a.grav ? 1 : 0) || b.pubs - a.pubs || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function mural() {
    const l = muralItens().slice(0, 18);
    return '<section class="tv-mural" aria-label="Hoje na agência"><header><h2>Hoje na agência</h2><span>' + l.length + (l.length === 1 ? ' cliente' : ' clientes') + ' com publicação ou gravação</span></header>' +
      '<div class="tv-mural-grade" style="--n:' + l.length + '">' + l.map((x, i) => '<article style="--i:' + i + '">' + B7.UI.avatarCliente(x.nome, x.logo, 'tv-mural-av') +
        (cfg.nomes ? '<b>' + esc(x.nome) + '</b>' : '') +
        '<p>' + [x.grav && '<span class="g">' + esc(x.grav) + '</span>', x.pubs && '<span>' + x.feitas + ' de ' + x.pubs + (x.pubs === 1 ? ' publicação' : ' publicações') + '</span>'].filter(Boolean).join('') + '</p></article>').join('') + '</div></section>';
  }
  /* as telas do rodízio, na ordem */
  const telas = () => ['agencia'].concat(cfg.agenda ? ['semana'] : [], cfg.mural && muralItens().length ? ['mural'] : []);

  /* saudação por horário: "Bom dia, equipe" às 8h e o resumo do dia às 18h,
     por cima do painel por alguns segundos. Uma vez por dia em cada TV. */
  let saudaTimer = 0;
  function mostrarSaudacao(tipo) {
    const cx = raiz && raiz.querySelector('#tv-sauda'); if (!cx || modoAtivo !== 'painel' || !S.panorama) return;
    const h = hoje(), a = new Date(), n = { atraso: 0, atencao: 0 };
    let soma = 0, com = 0; S.panorama.forEach(l => { if (n[l.estado] !== undefined) n[l.estado]++; if (l.etapas) { soma += l.pct; com++; } });
    const gravHoje = (S.gravacoes || []).filter(g => diaDoTs(g.inicio) === h).length;
    const pubs = S.publicacoes ? S.publicacoes.length : null, feitas = S.publicacoes ? S.publicacoes.filter(x => x.status === 'Publicado').length : 0;
    const fato = (v, r) => '<div><b>' + v + '</b><span>' + r + '</span></div>';
    const fatos = tipo === 'resumo'
      ? [pubs !== null ? fato(feitas + '<i>/' + pubs + '</i>', 'publicações de hoje no ar') : '', fato(gravHoje, gravHoje === 1 ? 'gravação hoje' : 'gravações hoje'),
         fato((com ? Math.round(soma / com * 100) : 0) + '<i>%</i>', 'andamento do mês'), fato(n.atraso, n.atraso === 1 ? 'cliente com atraso' : 'clientes com atraso')]
      : [fato(gravHoje, gravHoje === 1 ? 'gravação hoje' : 'gravações hoje'), pubs !== null ? fato(pubs, pubs === 1 ? 'publicação para hoje' : 'publicações para hoje') : '',
         fato(n.atraso, n.atraso === 1 ? 'cliente com atraso' : 'clientes com atraso')];
    cx.innerHTML = '<div class="tv-sauda-caixa"><small>' + DOW[a.getDay()] + ', ' + a.getDate() + ' de ' + MES[a.getMonth()] + '</small>' +
      '<h1>' + (tipo === 'resumo' ? 'Resumo do dia' : 'Bom dia, equipe') + '</h1>' +
      (tipo !== 'resumo' && cfg.hoje && S.hojeDia && S.hojeDia.length ? '<p>Hoje: <b>' + esc(S.hojeDia[0]) + '</b></p>' : '') +
      '<div class="tv-sauda-fatos">' + fatos.join('') + '</div></div>';
    cx.hidden = false; void cx.offsetWidth; cx.classList.add('on');
    clearTimeout(saudaTimer);
    saudaTimer = setTimeout(() => { cx.classList.remove('on'); setTimeout(() => { if (raiz) { cx.hidden = true; cx.innerHTML = ''; pintar(true); } }, 600); }, 14000);
  }
  function conferirSaudacao() {
    if (!cfg.saudacao || modoAtivo !== 'painel' || !S.panorama) return;
    const a = new Date(), hh = a.getHours(), mm = a.getMinutes(), dia = hoje();
    const tipo = hh === 8 && mm < 10 ? 'bomdia' : hh === 18 && mm < 10 ? 'resumo' : '';
    if (!tipo) return;
    const visto = (B7.pref && B7.pref.ler('tv_sauda', {})) || {};
    if (visto[tipo] === dia) return;
    visto[tipo] = dia; if (B7.pref) B7.pref.gravar('tv_sauda', visto);
    mostrarSaudacao(tipo);
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
    aplicarVisual();
    aplicarModo();
    pintarLogo(); pintarRecado();
    if (modoAtivo !== 'painel') return;            /* só a animação ou só a logo: nenhum dado da agência é consultado */
    carregarClima();
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
      .map(e => ({ titulo: e.titulo, cliente: e.clienteNome, clienteId: e.clienteId || null, inicio: e.extra && e.extra.bruto ? e.extra.bruto.inicio : null, diaInteiro: e.diaInteiro }))
      .filter(g => g.inicio).sort((x, y) => String(x.inicio).localeCompare(String(y.inicio))) : null;
    S.publicacoes = pub;
    S.hojeDia = ops ? ops.filter(i => i.nivelMax && i.ini === h).map(i => i.op.nome) : null;
    aplicarFundo();
  }

  /* -------------------------------------------------------------- peças */
  function relogio() {
    const cx = raiz && raiz.querySelector('#tv-relogio'); if (!cx) return;
    const a = new Date(), k = pad(a.getHours()) + ':' + pad(a.getMinutes());
    if (cx.dataset.h === k) return;
    cx.dataset.h = k;
    const clima = cfg.clima && S.clima ? '<em class="tv-clima"><strong>' + S.clima.t + '°</strong> ' + ROT_CLIMA(S.clima.cod) + (cfg.cidade && cfg.cidade.nome ? ' · ' + esc(cfg.cidade.nome) : '') + '</em>' : '';
    cx.innerHTML = '<b>' + pad(a.getHours()) + '<i>:</i>' + pad(a.getMinutes()) + '</b>' +
      '<span>' + DOW[a.getDay()] + ', ' + a.getDate() + ' de ' + MES[a.getMonth()] + clima + '</span>';
    pintarLogo();
    if (a.getMinutes() === 0) aplicarFundo();
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
    /* duas colunas só se sobrar espaço para o nome do cliente (o tamanho "maior" estreita a tela útil) */
    const vw = window.innerWidth, util = vw / zoomAtual();
    const celula = Math.min(41, Math.max(28, vw * 0.0215)), lado = Math.min(460, Math.max(300, vw * 0.24));
    const nome = (util - lado - 130) / 2 - (38 + 7 * (celula + 5) + 60 + 40);
    const colunas = util >= 1280 && nome >= 140 ? 2 : 1;
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
    else grav = '<ul class="tv-lista">' + S.gravacoes.slice(0, 5).map(g => {
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
    if (!telas().includes(tela)) tela = 'agencia';
    pintarRecado();
    const blocoAgenda = cfg.gravacoes || (cfg.publicacoes && S.publicacoes) ? '<section class="tv-bloco tv-agenda">' + agenda() + '</section>' : '';
    const blocoEtapas = cfg.etapas ? '<section class="tv-bloco"><h2>Etapas da agência</h2>' + etapas(S.panorama) + '</section>' : '';
    const lado = blocoEtapas + blocoAgenda;
    const primeira = !corpo.dataset.pronto; corpo.dataset.pronto = '1';
    corpo.className = 'tv-corpo' + (tela === 'semana' ? ' tv-tela-semana' : tela === 'mural' ? ' tv-tela-semana tv-tela-mural' : (cfg.clientes ? '' : ' sem-clientes') + (lado ? '' : ' sem-lado')) +
      (entrando || primeira ? ' tv-entra' : '');
    corpo.innerHTML = resumo(S.panorama) + (tela === 'semana' ? semana() : tela === 'mural' ? mural()
      : (cfg.clientes ? '<section class="tv-bloco tv-clientes"><header><h2>Clientes em ' + MES[a.getMonth()] + '</h2>' +
          '<span class="tv-nota" id="tv-clientes-nota"></span></header>' +
          '<div class="tv-clientes-corpo" id="tv-clientes-corpo"></div></section>' : '') +
        (lado ? '<aside class="tv-lado">' + lado + '</aside>' : ''));
    clientes(S.panorama);
    /* as gravações que não couberem no bloco saem do fim (recado, tamanho e tela mudam o espaço) */
    const ag = corpo.querySelector('.tv-agenda');
    if (ag) { const li = ag.querySelectorAll('.tv-lista li'); let n = li.length; while (n > 0 && ag.scrollHeight > ag.clientHeight + 2) { li[--n].remove(); }
      if (li.length && !n) { const ul = ag.querySelector('.tv-lista'); if (ul) { if (ul.previousElementSibling && ul.previousElementSibling.tagName === 'H2') ul.previousElementSibling.remove(); ul.remove(); } } }
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
    clearTimeout(animTimer); clearTimeout(vinhetaTimer); clearTimeout(saudaTimer); modoAtivo = ''; modoForcado = ''; ultimoClima = 0;
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
      '<div class="tv-recado" id="tv-recado" role="status" hidden></div>' +
      '<i class="tv-luz" aria-hidden="true"></i><i class="tv-luz dois" aria-hidden="true"></i><i class="tv-grao" aria-hidden="true"></i>' +
      '<div class="tv-corpo" id="tv-corpo" role="main"></div>' +
      '<div class="tv-faixa" id="tv-faixa" role="status" hidden></div>' +
      '<div class="tv-logo-tela" id="tv-logo" hidden></div>' +
      '<div class="tv-sauda" id="tv-sauda" hidden></div>' +
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
    modoForcado = (m => (m && ['animacao', 'painel', 'logo'].includes(m[1])) ? m[1] : '')(/[?&]modo=([a-z]+)/.exec(location.hash));
    /* #/tv?previa=bomdia|resumo — mostra a saudação na hora, para conferir como fica */
    const previa = (m => (m && (m[1] === 'bomdia' || m[1] === 'resumo')) ? m[1] : '')(/[?&]previa=([a-z]+)/.exec(location.hash));
    let previaFeita = false;
    aplicarVisual();
    /* a abertura completa só toca inteira sem a marca de "já vi nesta sessão" */
    eraCurta = document.documentElement.classList.contains('ab-curta'); document.documentElement.classList.remove('ab-curta');
    if (modoForcado) aplicarModo();
    relogio(); pintar(); renovar(); manterAcesa();
    pulso = setInterval(() => {
      if (!raiz || !raiz.isConnected) { fechar(); return; }
      relogio();
      if (document.hidden) return;
      if (previa && !previaFeita && S.panorama) { previaFeita = true; mostrarSaudacao(previa); }
      conferirSaudacao();
      if (diaPintado !== hoje() || Date.now() - ultima >= 5 * 60000) renovar();
    }, 15000);
    if (previa) { const t = setInterval(() => { if (!raiz || previaFeita) { clearInterval(t); return; } if (S.panorama) { previaFeita = true; mostrarSaudacao(previa); } }, 800); }
    /* zzz136: com a agenda da semana ligada, as duas telas se alternam */
    let ultimaTroca = Date.now();
    troca = setInterval(() => {
      if (!raiz || document.hidden || !S.panorama || telas().length < 2) return;
      if (modoAtivo !== 'painel' || !raiz.querySelector('#tv-anim').hidden || !raiz.querySelector('#tv-sauda').hidden) return;
      if (Date.now() - ultimaTroca < (Number(cfg.intervalo) || 45) * 1000) return;
      ultimaTroca = Date.now();
      /* a tela sai, troca e entra (zzz137) */
      const corpo = raiz.querySelector('#tv-corpo'); corpo.classList.add('tv-sai');
      setTimeout(() => { if (raiz) { const l = telas(); tela = l[(l.indexOf(tela) + 1) % l.length]; pintar(true); } }, reduz() ? 0 : 430);
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
    const BLOCOS = [
      ['clientes', 'Lista de clientes', 'cada cliente com as sete etapas e o percentual'],
      ['nomes', 'Nome dos clientes', 'desligado, gravações e mural aparecem sem o nome'],
      ['etapas', 'Etapas da agência', 'quantos clientes em dia, andando, em atenção e atraso por etapa'],
      ['gravacoes', 'Próximas gravações', 'as dos próximos 7 dias'],
      ['publicacoes', 'Publicações de hoje', 'publicadas de quantas'],
      ['hoje', '“Hoje é dia de…”', 'a data relevante do dia, no topo']];
    const TELAS = [
      ['agenda', 'Agenda da semana', 'uma tela com os próximos 7 dias'],
      ['mural', 'Mural de hoje', 'as logos dos clientes com publicação ou gravação hoje']];
    const EXTRAS = [
      ['saudacao', 'Saudação por horário', '“Bom dia, equipe” às 8h e o resumo do dia às 18h'],
      ['vinheta', 'Vinheta da B7 a cada 5 minutos', 'a animação de abertura passa por cima do painel e some'],
      ['clima', 'Clima', 'a temperatura da cidade, ao lado da data']];
    const m = B7.UI.modal('<h3>Painel de TV</h3><p class="sub">Vale para todo aparelho que abrir o Painel de TV; quem já está com ele aberto recebe em até 5 minutos.</p>' +
      '<div class="tv-cfg" id="tv-cfg"><p class="adm-vazio">Carregando…</p></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="tv-cfg-ok" disabled>Salvar</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const cx = m.querySelector('#tv-cfg'), ok = m.querySelector('#tv-cfg-ok');
    let cidade = null, logoImg = '';
    const chave = (k, t, d, c) => '<label class="tv-cfg-l"><input type="checkbox" data-k="' + k + '"' + (c[k] ? ' checked' : '') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>';
    const escolha = (nome, itens, atual) => '<div class="tv-cfg-esc" role="radiogroup">' + itens.map(([v, t, d]) =>
      '<label><input type="radio" name="' + nome + '" value="' + v + '"' + (String(atual) === String(v) ? ' checked' : '') + '><span><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</span></label>').join('') + '</div>';
    lerConfig().then(c => {
      if (!cx.isConnected) return;
      cidade = c.cidade || null; logoImg = c.logo_img || '';
      const modo = c.modo === 'animacao' || c.modo === 'logo' ? c.modo : 'painel';
      cx.innerHTML =
        '<h4 class="tv-cfg-t">O que a TV mostra</h4>' + escolha('tv-modo', [['painel', 'Painel da agência', 'os números do mês'], ['animacao', 'Só a animação da B7', 'a abertura em ciclo'], ['logo', 'Só a logo', 'a marca, parada, do seu jeito']], modo) +
        '<h4 class="tv-cfg-t">Visual</h4>' + '<div class="tv-cfg-vis" role="radiogroup">' + VISUAIS.map(([v, t, d]) =>
          '<label><input type="radio" name="tv-visual" value="' + v + '"' + ((c.visual || 'cinema') === v ? ' checked' : '') + '><span class="tv-cfg-am tv-am-' + v + '" aria-hidden="true"><i></i><i></i><i></i></span><b>' + t + '</b><small>' + d + '</small></label>').join('') + '</div>' +
        '<div class="tv-cfg-duas"><div><h4 class="tv-cfg-t">Fundo</h4>' + escolha('tv-fundo', [['fixo', 'Fixo'], ['dia', 'Muda com o horário'], ['atraso', 'Muda com a situação']], c.fundo || 'fixo') +
            '<small class="tv-cfg-dica" id="tv-cfg-fundo-d"></small></div>' +
          '<div><h4 class="tv-cfg-t">Tamanho</h4>' + escolha('tv-zoom', [[85, 'Menor'], [100, 'Normal'], [115, 'Maior'], [130, 'Bem maior']], [85, 100, 115, 130].includes(Number(c.zoom)) ? Number(c.zoom) : 100) +
            '<small class="tv-cfg-dica">Maior deixa as letras maiores e cabe menos por tela; a lista de clientes passa a rodar em mais páginas.</small></div></div>' +
        '<div id="tv-cfg-painel">' +
          '<h4 class="tv-cfg-t">Blocos do painel</h4><div class="tv-cfg-grade">' + BLOCOS.map(b => chave(b[0], b[1], b[2], c)).join('') + '</div>' +
          '<h4 class="tv-cfg-t">Telas que se alternam com o painel</h4><div class="tv-cfg-grade">' + TELAS.map(b => chave(b[0], b[1], b[2], c)).join('') + '</div>' +
          '<label class="tv-cfg-int" id="tv-cfg-int"><span>Trocar de tela a cada</span><select class="campo" id="tv-cfg-seg">' +
            [[20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [120, '2 minutos']].map(([v, r]) =>
              '<option value="' + v + '"' + (Number(c.intervalo) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label>' +
          '<h4 class="tv-cfg-t">Extras</h4><div class="tv-cfg-grade">' + EXTRAS.map(b => chave(b[0], b[1], b[2], c)).join('') + '</div>' +
          '<div class="tv-cfg-cidade" id="tv-cfg-cidade"><label class="rot" for="tv-cfg-cid">CIDADE DO CLIMA</label><div class="tv-cfg-linha"><input class="campo" id="tv-cfg-cid" placeholder="Ex.: Goiânia" maxlength="60" autocomplete="off">' +
            '<button type="button" class="b contorno" id="tv-cfg-cid-b">Buscar</button></div><div class="tv-cfg-cid-r" id="tv-cfg-cid-r"></div>' +
            '<small class="tv-cfg-dica">O clima vem do Open-Meteo, um serviço aberto. Só as coordenadas da cidade saem daqui.</small></div>' +
          '<h4 class="tv-cfg-t">Recado na TV</h4><input class="campo" id="tv-cfg-recado" maxlength="200" placeholder="Ex.: Reunião geral hoje às 15h" autocomplete="off">' +
          escolha('tv-recado-modo', [['destaque', 'Em destaque, no alto'], ['faixa', 'Faixa correndo embaixo']], c.recado_modo || 'destaque') +
          '<small class="tv-cfg-dica">Deixe em branco para não mostrar recado.</small>' +
          '<p class="tv-cfg-aviso" id="tv-cfg-aviso" hidden></p></div>' +
        '<div id="tv-cfg-logo"><h4 class="tv-cfg-t">A tela “Só a logo”</h4>' +
          '<div class="tv-cfg-img"><span class="tv-cfg-img-pv" id="tv-cfg-img-pv"></span><div><b id="tv-cfg-img-t"></b>' +
            '<div class="tv-cfg-linha"><input type="file" id="tv-cfg-arq" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>' +
              '<button type="button" class="b fina contorno" id="tv-cfg-img-b">Enviar uma imagem</button><button type="button" class="b fina contorno" id="tv-cfg-img-x">Voltar para a logo da B7</button></div>' +
            '<small class="tv-cfg-dica">PNG com fundo transparente fica melhor. A imagem fica no espaço público de logos do sistema.</small></div></div>' +
          '<label class="rot" for="tv-cfg-frase">FRASE ABAIXO DA LOGO (OPCIONAL)</label><input class="campo" id="tv-cfg-frase" maxlength="120" placeholder="Ex.: Ideias que acendem" autocomplete="off">' +
          '<div class="tv-cfg-grade">' + chave('logo_relogio', 'Mostrar o relógio', 'hora e data, discretas, embaixo', c) + '</div></div>' +
        '<p class="tv-cfg-ver">Para ver como fica: <a href="#/tv" data-ver>painel</a> · <a href="#/tv?modo=animacao" data-ver>animação</a> · <a href="#/tv?modo=logo" data-ver>só a logo</a> · ' +
          '<a href="#/tv?previa=bomdia" data-ver>“Bom dia”</a> · <a href="#/tv?previa=resumo" data-ver>resumo das 18h</a> <small>(abre com o que já está salvo)</small></p>';
      cx.querySelector('#tv-cfg-recado').value = c.recado || '';
      cx.querySelector('#tv-cfg-frase').value = c.logo_frase || '';
      cx.querySelectorAll('[data-ver]').forEach(a => a.addEventListener('click', () => m.fechar()));

      const pintarImg = () => {
        cx.querySelector('#tv-cfg-img-pv').innerHTML = '<img src="' + esc(logoImg || 'assets/brand/logo-white.png') + '" alt="">';
        cx.querySelector('#tv-cfg-img-t').textContent = logoImg ? 'Imagem personalizada' : 'Logo da B7 (padrão)';
        cx.querySelector('#tv-cfg-img-x').hidden = !logoImg;
      };
      const pintarCidade = () => {
        cx.querySelector('#tv-cfg-cid-r').innerHTML = cidade ? '<span class="tv-cfg-cid-ok">Cidade escolhida: <b>' + esc(cidade.nome || '') + '</b></span>' : '<span class="tv-cfg-cid-no">Nenhuma cidade escolhida ainda.</span>';
      };
      const conferir = () => {
        const v = k => cx.querySelector('[data-k="' + k + '"]').checked, r = n => cx.querySelector('input[name="' + n + '"]:checked').value;
        const modoAgora = r('tv-modo');
        cx.querySelector('#tv-cfg-painel').hidden = modoAgora !== 'painel';
        cx.querySelector('#tv-cfg-logo').hidden = modoAgora !== 'logo';
        cx.querySelector('#tv-cfg-int').hidden = !(v('agenda') || v('mural'));
        cx.querySelector('#tv-cfg-cidade').hidden = !v('clima');
        cx.querySelector('#tv-cfg-fundo-d').textContent = r('tv-visual') === 'minimal' ? 'O visual minimalista não tem luzes de fundo: esta opção não muda nada nele.'
          : r('tv-fundo') === 'dia' ? 'Tons quentes de manhã, o tom da casa à tarde, avermelhado no fim do dia e frio à noite.'
          : r('tv-fundo') === 'atraso' ? 'Avermelhado com cliente em atraso, âmbar com cliente pedindo atenção, verde com tudo em dia.' : '';
        const av = cx.querySelector('#tv-cfg-aviso');
        av.hidden = v('clientes') || v('etapas') || v('gravacoes') || v('publicacoes');
        av.textContent = 'Com todos os blocos desligados, o painel fica só com o resumo do mês e o relógio.';
      };
      cx.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(i => i.addEventListener('change', conferir));
      pintarImg(); pintarCidade(); conferir();

      /* cidade: busca pelo nome e a pessoa escolhe entre os resultados */
      const buscar = async () => {
        const q = cx.querySelector('#tv-cfg-cid').value.trim(), rcx = cx.querySelector('#tv-cfg-cid-r'); if (q.length < 2) return;
        rcx.innerHTML = '<span class="tv-cfg-cid-no">Procurando…</span>';
        try {
          const j = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=6&language=pt&format=json')).json();
          const l = (j && j.results) || [];
          if (!l.length) { rcx.innerHTML = '<span class="tv-cfg-cid-no">Não achei essa cidade. Tente só o nome, sem estado.</span>'; return; }
          rcx.innerHTML = l.map((x, i) => '<button type="button" class="tv-cfg-cid-op" data-i="' + i + '">' + esc([x.name, x.admin1, x.country].filter(Boolean).join(', ')) + '</button>').join('');
          rcx.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const x = l[Number(b.dataset.i)]; cidade = { nome: x.name, lat: x.latitude, lon: x.longitude }; pintarCidade(); });
        } catch (e) { rcx.innerHTML = '<span class="tv-cfg-cid-no">Não foi possível buscar agora. Confira a internet.</span>'; }
      };
      cx.querySelector('#tv-cfg-cid-b').onclick = buscar;
      cx.querySelector('#tv-cfg-cid').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });

      /* imagem da tela "só a logo": sobe para o espaço público de logos, o mesmo das logos de cliente */
      const arq = cx.querySelector('#tv-cfg-arq'), btImg = cx.querySelector('#tv-cfg-img-b');
      btImg.onclick = () => arq.click();
      arq.onchange = async () => {
        const f = arq.files && arq.files[0]; arq.value = ''; if (!f) return;
        if (f.size > 4 * 1024 * 1024) { B7.UI.toast('A imagem passa de 4 MB.', { tipo: 'erro' }); return; }
        btImg.disabled = true; btImg.textContent = 'Enviando…';
        try { const r = await B7.DB.enviarLogo(f, 'sistema-tv'); logoImg = r.url; pintarImg(); }
        catch (e) { B7.UI.toast('Não foi possível enviar a imagem: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
        btImg.disabled = false; btImg.textContent = 'Enviar uma imagem';
      };
      cx.querySelector('#tv-cfg-img-x').onclick = () => { logoImg = ''; pintarImg(); };
      ok.disabled = false;
    });
    ok.onclick = async () => {
      const r = n => cx.querySelector('input[name="' + n + '"]:checked').value;
      const novo = { intervalo: Number(cx.querySelector('#tv-cfg-seg').value) || 45, modo: r('tv-modo'), visual: r('tv-visual'), fundo: r('tv-fundo'),
        zoom: Number(r('tv-zoom')) || 100, recado: cx.querySelector('#tv-cfg-recado').value, recado_modo: r('tv-recado-modo'),
        logo_frase: cx.querySelector('#tv-cfg-frase').value, logo_img: logoImg || '', cidade: cidade };
      cx.querySelectorAll('[data-k]').forEach(i => { novo[i.dataset.k] = i.checked; });
      if (novo.clima && !cidade) { B7.UI.toast('Escolha a cidade do clima (ou desligue o clima).', { tipo: 'erro' }); return; }
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
