/* =====================================================================
   WHATSAPP NO SISTEMA (zzz170)

   Item "WhatsApp" na barra lateral (rota #/whatsapp):
     • no programa de Windows, o WhatsApp Web de verdade aparece ENCAIXADO
       no lugar das telas — a barra lateral e o topo do B7 continuam ali.
       Quem desenha é o programa (app-desktop/whatsapp.js): esta tela só
       diz a ele onde fica o espaço, e quando esconder (ao sair da tela,
       ou quando uma janela do sistema abre por cima — o WhatsApp fica
       sempre na frente das telas, então ele some um instante);
     • no navegador, o WhatsApp não deixa ser posto dentro de outro site:
       a tela tem o botão para abrir o WhatsApp Web numa aba;
     • no app Android, abre o app do WhatsApp.

   Assinatura: no programa, toda mensagem sai com "*Seu nome:*" na
   primeira linha (o WhatsApp mostra em negrito). Liga/desliga e o nome
   ficam no topo desta tela.

   "Enviar ao cliente" (vídeo e gravação marcada): B7.WhatsApp.enviar()
   abre uma caixinha com a mensagem pronta e, no programa, o arquivo
   escolhido na hora. "Abrir no WhatsApp" entra no grupo do cliente
   (clientes.whatsapp_grupo), anexa o vídeo como DOCUMENTO e põe a
   mensagem — quem aperta enviar é sempre a pessoa. O envio fica
   registrado (whatsapp_envios; na demanda de vídeo, também no histórico).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WhatsApp = (function () {
  const esc = s => B7.UI.esc(s);
  const D = window.B7Desktop && window.B7Desktop.wa ? window.B7Desktop.wa : null;     /* programa de Windows */
  const nativo = () => !!(B7.AppNativo && B7.AppNativo.ativo);                         /* app Android */
  const icone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.8-.6.3-1.4.4-2.4 0a9 9 0 0 1-4.9-4.9c-.4-1-.3-1.8 0-2.5z"/></svg>';

  let naoLidas = 0, ativo = false, relogio = 0, observador = null, ultimoRet = '', escondido = true;

  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
  const primeiroNome = () => String(eu().nome || eu().username || '').trim().split(/\s+/)[0] || '';
  const podeEnviar = () => { const u = eu(); return !!u.id && u.papel !== 'cliente'; };

  /* ------------------------------------------------ número no menu */
  function pintarContagem() {
    document.querySelectorAll('[data-nav="whatsapp"]').forEach(a => {
      let b = a.querySelector('.wa-n');
      if (!naoLidas) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('i'); b.className = 'wa-n'; a.appendChild(b); }
      b.textContent = naoLidas > 99 ? '99+' : naoLidas;
    });
  }
  if (D && D.aoNaoLidas) D.aoNaoLidas(n => {
    naoLidas = +n || 0; pintarContagem();
    const el = document.getElementById('wa-nl');
    if (el) { el.hidden = !naoLidas; el.textContent = naoLidas + (naoLidas === 1 ? ' não lida' : ' não lidas'); }
  });
  /* clicou no aviso de mensagem do WhatsApp: vem para a tela dele */
  if (D && D.aoIr) D.aoIr(() => { if (location.hash.indexOf('#/whatsapp') !== 0) location.hash = '#/whatsapp'; });
  /* o menu lateral é redesenhado às vezes: recoloca o número */
  addEventListener('hashchange', () => setTimeout(pintarContagem, 200));

  /* --------------------------------------------- a tela #/whatsapp */
  /* zzz172: se algo der errado, a tela DIZ o quê (antes ficava parada na
     tela anterior, sem nenhum sinal) */
  async function abrir() {
    try { await abrirTela(); }
    catch (e) {
      const painel = document.getElementById('painel-dashboard');
      if (painel) painel.innerHTML = '<div class="conteudo entra wa-fora">' + icone + '<h1>WhatsApp</h1>' +
        '<p>Não consegui abrir o WhatsApp agora.</p><p class="leve"><code>' + esc((e && e.message) || String(e)) + '</code></p>' +
        '<div class="acoes"><button type="button" class="b pri" onclick="location.reload()">Recarregar</button></div></div>';
    }
  }
  async function abrirTela() {
    const painel = document.getElementById('painel-dashboard');
    if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp']);
    /* zzz182: o menu lateral marca o WhatsApp (ficava aceso o da tela anterior) */
    const marcar = () => document.querySelectorAll('.nav a[data-nav], #nav-inferior a[data-nav]').forEach(x => {
      const on = x.dataset.nav === 'whatsapp'; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
    });
    marcar(); setTimeout(marcar, 120); setTimeout(marcar, 500);
    if (!D) return telaFora(painel);
    /* o programa pode demorar a responder: não espera mais que 2 s */
    /* zzz181: a tela desenha NA HORA com o que ficou guardado da última vez;
       a resposta do programa chega depois e só acerta o nome/assinatura
       (antes a tela esperava o programa — até 2 s parada na tela anterior) */
    const cfg = Object.assign({}, B7.pref.ler('wa_cfg', {}));
    if (!cfg.nome) cfg.nome = primeiroNome();
    D.config().then(c => {
      if (!c) return;
      if (!c.nome) { c.nome = cfg.nome; D.definirConfig({ nome: c.nome }); }
      B7.pref.gravar('wa_cfg', { nome: c.nome, assinatura: c.assinatura !== false });
      const n = document.getElementById('wa-nome'), cx = document.getElementById('wa-assin');
      if (n && document.activeElement !== n && n.value !== c.nome) { n.value = c.nome; n.dispatchEvent(new Event('input')); }
      if (cx) { cx.classList.toggle('on', c.assinatura !== false); const b = document.getElementById('wa-ass'); if (b) b.setAttribute('aria-checked', String(c.assinatura !== false)); }
    }).catch(() => {});
    const extras = !!(D.zoom && D.desconectar);
    painel.innerHTML = '<div class="wa-tela">' +
      '<div class="wa-barra">' +
        '<span class="wa-tit">' + icone + '<b>WhatsApp</b><i class="wa-nl" id="wa-nl"' + (naoLidas ? '' : ' hidden') + '>' + naoLidas + ' não lidas</i><i class="wa-esp" id="wa-esp" hidden></i></span>' +
        '<div class="wa-assin' + (cfg.assinatura !== false ? ' on' : '') + '" id="wa-assin">' +
          '<button type="button" class="wa-chave" id="wa-ass" role="switch" aria-checked="' + (cfg.assinatura !== false) + '" title="Assinar as mensagens com o seu nome"><i></i></button>' +
          '<span class="wa-assin-rot">Assinatura</span>' +
          '<span class="wa-assin-ex"><b>*</b><input id="wa-nome" maxlength="40" value="' + esc(cfg.nome || '') + '" placeholder="Seu nome" aria-label="Nome da assinatura" size="8"><b>:*</b></span>' +
          '<span class="wa-prev" id="wa-prev"></span>' +
        '</div>' +
        '<div class="wa-ferr">' +
          (D.aoConversas ? '<button type="button" class="wa-ic' + (ladoAberto ? ' on' : '') + '" id="wa-lado-bt" title="Mostrar/esconder o painel do cliente" aria-label="Painel do cliente">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M14.5 4.5v15"/></svg></button>' : '') +
          (B7.Chat ? '<button type="button" class="wa-ic wa-ia" id="wa-ia" title="Assistente do B7" aria-label="Abrir o assistente">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9z"/><path d="M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg></button>' : '') +
          (extras ? '<button type="button" class="wa-ic" id="wa-menos" title="Letra menor" aria-label="Letra menor">A−</button>' +
                    '<button type="button" class="wa-ic" id="wa-mais" title="Letra maior" aria-label="Letra maior">A+</button>' : '') +
          '<button type="button" class="wa-ic" id="wa-recarregar" title="Recarregar o WhatsApp" aria-label="Recarregar o WhatsApp">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg></button>' +
          (extras ? '<button type="button" class="wa-ic" id="wa-sair" title="Desconectar este WhatsApp do programa" aria-label="Desconectar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h9"/></svg></button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="wa-corpo' + (ladoAberto && D.aoConversas ? ' com-lado' : '') + '" id="wa-corpo">' +
        /* zzz198: abre com a FOTO da última vez (o WhatsApp como estava) —
           quando o de verdade chega, é idêntico: sem tela preta, sem pulo.
           Sem foto guardada: um esqueleto com a cara do WhatsApp. */
        (fotoGuardada()
          ? '<div class="wa-area com-foto abrindo" id="wa-area" style="background-image:url(&quot;' + fotoGuardada() + '&quot;)"></div>'
          : '<div class="wa-area abrindo" id="wa-area"><div class="wa-esq" aria-hidden="true"><div class="wa-esq-lista">' +
              '<i class="wa-esq-busca"></i>' + Array.from({ length: 7 }, (_, i) => '<div class="wa-esq-it" style="--i:' + i + '"><i class="av"></i><span><i></i><i></i></span></div>').join('') +
            '</div><div class="wa-esq-chat"><span class="wa-esp-ic">' + icone + '</span><b>Abrindo o WhatsApp…</b></div></div></div>') +
        (D.aoConversas ? '<aside class="wa-lado" id="wa-lado" aria-label="Painel do cliente"></aside>' : '') +
      '</div>' +
    '</div>';
    const caixa = painel.querySelector('#wa-assin'), cb = painel.querySelector('#wa-ass'), nome = painel.querySelector('#wa-nome'), prev = painel.querySelector('#wa-prev');
    const ligada = () => caixa.classList.contains('on');
    const previa = () => {
      nome.size = Math.max(4, Math.min(18, (nome.value || nome.placeholder).length));
      prev.innerHTML = ligada() && nome.value.trim() ? 'sai como <b>' + esc(nome.value.trim()) + ':</b>' : 'desligada';
    };
    const salvar = () => { D.definirConfig({ nome: nome.value.trim(), assinatura: ligada() }); B7.pref.gravar('wa_cfg', { nome: nome.value.trim(), assinatura: ligada() }); previa(); };
    cb.onclick = () => { caixa.classList.toggle('on'); cb.setAttribute('aria-checked', String(ligada())); salvar(); };
    nome.oninput = previa; nome.onchange = salvar;
    nome.onkeydown = e => { if (e.key === 'Enter') { nome.blur(); salvar(); } };
    const btLado = painel.querySelector('#wa-lado-bt');
    if (btLado) btLado.onclick = () => {
      ladoAberto = !ladoAberto; B7.pref.gravar('wa_lado', ladoAberto);
      btLado.classList.toggle('on', ladoAberto);
      painel.querySelector('#wa-corpo').classList.toggle('com-lado', ladoAberto);
      if (ladoAberto) pintarLado();
    };
    if (D.estadoLeitura) D.estadoLeitura().then(e => { if (e) { conversaAberta = e.conversa || null; if (e.lista && e.lista.length) aoLista(e.lista); else pintarLado(); } }).catch(() => {});
    carregarGrupos().then(() => { pintarLado(); vigiarEsperando(); });
    const btIa = painel.querySelector('#wa-ia');
    if (btIa) btIa.onclick = () => B7.Chat.abrir();
    painel.querySelector('#wa-recarregar').onclick = () => D.recarregar && D.recarregar();
    if (extras) {
      painel.querySelector('#wa-menos').onclick = () => D.zoom(-1);
      painel.querySelector('#wa-mais').onclick = () => D.zoom(+1);
      painel.querySelector('#wa-sair').onclick = async () => {
        const ok = await B7.UI.confirmar({ titulo: 'Desconectar o WhatsApp?', texto: 'O WhatsApp sai deste programa (as conversas continuam no celular). Para usar de novo, é só ler o QR Code.', rotulo: 'Desconectar', perigo: true });
        if (ok) D.desconectar();
      };
    }
    previa();
    ligar();
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desligar);
  }

  /* navegador e celular */
  function telaFora(painel) {
    const cel = nativo();
    painel.innerHTML = '<div class="conteudo entra wa-fora">' + icone +
      '<h1>WhatsApp</h1>' +
      '<p>' + (cel
        ? 'No celular, o WhatsApp abre no app dele. Os botões “Enviar no WhatsApp” do sistema já mandam a mensagem pronta para lá.'
        : 'No navegador, o WhatsApp não deixa ser aberto dentro de outro site. No <b>programa do B7 para Windows</b>, ele aparece aqui dentro, com a sua assinatura em negrito.') + '</p>' +
      '<div class="acoes"><button type="button" class="b pri" id="wa-abrir-fora">' + (cel ? 'Abrir o WhatsApp' : 'Abrir o WhatsApp Web') + '</button></div></div>';
    painel.querySelector('#wa-abrir-fora').onclick = () => {
      if (cel) location.href = 'whatsapp://send';
      else window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    };
  }

  /* o espaço da tela → o programa. Se alguma coisa do sistema estiver por
     cima (janela, menu, assistente, conversas), esconde o WhatsApp até
     ela fechar. */
  /* zzz173: confere uma GRADE de pontos (antes eram só o centro e os
     cantos): os menus do topo (Criar, avisos, conta) caem só na faixa de
     cima e passavam despercebidos — ficavam cortados atrás do WhatsApp */
  function coberta(area, r) {
    const pts = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++)
      pts.push([r.left + 8 + (r.width - 16) * i / 7, r.top + 6 + (r.height - 12) * j / 5]);
    const grandes = new Set();
    /* botão flutuante, aviso (toast) e dica pequena não contam: só o que é
       grande de verdade (janela, menu, painel) esconde o WhatsApp */
    return pts.some(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return true;
      if (area.contains(el)) return false;
      let c = el;
      while (c && c !== document.body && !c.contains(area)) {
        if (grandes.has(c)) return true;
        const b = c.getBoundingClientRect();
        if (b.width >= 140 && b.height >= 90) { grandes.add(c); return true; }
        c = c.parentElement;
      }
      return false;
    });
  }
  function medir() {
    if (!ativo) return;
    const area = document.getElementById('wa-area');
    if (!area) return desligar();
    /* a área vai até o pé da janela */
    const caixa = document.getElementById('wa-corpo') || area;
    const topo = caixa.getBoundingClientRect().top;
    const alt = Math.max(320, Math.round(innerHeight - topo - 14));
    if (Math.abs(caixa.offsetHeight - alt) > 1) caixa.style.height = alt + 'px';
    const r = area.getBoundingClientRect();
    const fora = r.width < 60 || r.height < 60 || document.hidden;
    if (fora || coberta(area, r)) {
      if (!escondido) {
        escondido = true; ultimoRet = '';
        if (fora || !D.foto) {
          /* programa antigo (até 1.0.17): ele mesmo tira a foto e some */
          Promise.resolve(D.esconder(!fora)).then(f => porFoto(f)).catch(() => {});
        } else {
          /* zzz175: SEM PISCADA — primeiro a foto entra no lugar (já pronta
             na tela), só depois o WhatsApp sai da frente. Antes ele sumia
             primeiro e a foto chegava um instante depois (o "piscar"). */
          const usar = f => porFoto(f).then(() => { if (escondido) D.esconder(false); });
          if (fotoPronta && Date.now() - fotoPronta.em < 8000) usar(fotoPronta.f);
          else Promise.race([D.foto(), new Promise(r => setTimeout(() => r(null), 150))]).then(usar, () => usar(null));
        }
      }
      return;
    }
    const ret = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
    if (ret === ultimoRet && !escondido) return;
    ultimoRet = ret; escondido = false;
    setTimeout(() => { const a = document.getElementById('wa-area'); if (a && !escondido) { a.classList.remove('com-foto'); a.style.backgroundImage = ''; } }, 120);
    D.mostrar({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), raio: 16 });
    area.classList.add('pronta');
  }
  /* foto do WhatsApp posta como fundo da área; espera a imagem estar
     decodificada para a troca ser instantânea */
  let fotoPronta = null, ligadoEm = 0, fotoSalvaEm = 0;
  const fotoGuardada = () => { try { return localStorage.getItem('b7_wa_foto') || ''; } catch (e) { return ''; } };
  function guardarFoto(f) {
    if (!f || Date.now() - fotoSalvaEm < 30000) return;
    fotoSalvaEm = Date.now();
    try { localStorage.setItem('b7_wa_foto', f); } catch (e) { try { localStorage.removeItem('b7_wa_foto'); } catch (x) {} }
  }
  function porFoto(f) {
    const a = document.getElementById('wa-area');
    if (!a || typeof f !== 'string' || !f.startsWith('data:image') || !escondido) return Promise.resolve();
    const img = new Image(); img.src = f;
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
      if (!escondido) return;
      a.style.backgroundImage = 'url("' + f + '")'; a.classList.add('com-foto');
    });
  }
  /* o mouse chegou ao topo (onde ficam Criar, avisos e conta): já deixa
     uma foto pronta, para o menu abrir sem esperar nada */
  function preFoto() {
    if (!ativo || escondido || !D || !D.foto) return;
    if (fotoPronta && Date.now() - fotoPronta.em < 1500) return;
    D.foto().then(f => { if (f) { fotoPronta = { f, em: Date.now() }; guardarFoto(f); } }).catch(() => {});
  }
  function ligar() {
    const topoG = document.querySelector('#tela-dashboard .topo');
    if (topoG && !topoG._waFoto) { topoG._waFoto = true; topoG.addEventListener('pointerenter', preFoto); }
    document.body.classList.add('wa-aberta');
    ativo = true; escondido = true; ultimoRet = ''; ligadoEm = Date.now();
    clearInterval(relogio);
    let tique = 0;
    relogio = setInterval(() => {
      if (Date.now() - ligadoEm > 200) medir();
      /* zzz186: foto sempre fresca (a cada 2 s) — janela que abre por cima
         troca o WhatsApp pela foto NA HORA, sem ele ficar "boiando" claro
         por cima do escurecido enquanto a foto era tirada */
      if (++tique % 8 === 0 && document.hasFocus()) preFoto();
    }, 250);           /* barra lateral abrindo, rolagem, zoom: segue junto */
    addEventListener('resize', medir);
    observador = new MutationObserver(() => { if (Date.now() - ligadoEm > 200) requestAnimationFrame(medir); });
    observador.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
    /* zzz176: espera a tela terminar de entrar (a animação do sistema)
       antes de pôr o WhatsApp — ele chega já no lugar certo, sem pulo */
    setTimeout(() => requestAnimationFrame(medir), 430);   /* zzz198: depois da abertura (0,42 s) */
  }
  function desligar() {
    if (!ativo) return;
    ativo = false; clearInterval(relogio); removeEventListener('resize', medir);
    if (fotoPronta) { fotoSalvaEm = 0; guardarFoto(fotoPronta.f); }
    document.body.classList.remove('wa-aberta'); fotoPronta = null;
    if (observador) { observador.disconnect(); observador = null; }
    escondido = true; ultimoRet = '';
    if (D) D.esconder();
  }
  addEventListener('hashchange', () => { if (location.hash.indexOf('#/whatsapp') !== 0) desligar(); });


  /* =================================================================
     GRUPOS (zzz176) — o programa lê a lista de conversas do WhatsApp
     (só leitura) e o sistema casa o nome de cada grupo com um cliente:
       "Suporte B7-3X - Infinite Fio Conquista" → Infinite Fio (Suporte B7-3X)
       "ARTES MERCATO - LOJA"                    → Mercato (Artes · Loja)
     Casamento certo (o nome inteiro do cliente aparece no grupo, e só um
     cliente casa) entra sozinho; o resto espera a conferência
     ("Conferir grupos"). Tudo fica em whatsapp_grupos — vale para toda a
     equipe, de qualquer computador.
     ================================================================= */
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'the', 'and', 'ltda', 'me', 'eireli', 'grupo', 'b7', 'cliente']);
  let grupos = new Map();          /* nome → linha de whatsapp_grupos */
  let clientes = [];               /* clientes_resumo */
  let listaViva = [];              /* última leitura da lista do WhatsApp */
  let conversaAberta = null;       /* { titulo, msgs } */
  let carregouGrupos = 0;

  async function carregarGrupos(forcar) {
    if (!forcar && Date.now() - carregouGrupos < 60000) return;
    carregouGrupos = Date.now();
    try {
      const [g, c] = await Promise.all([
        B7.sb.from('whatsapp_grupos').select('*').limit(1000),
        clientes.length && !forcar ? Promise.resolve({ data: clientes }) : B7.sb.from('clientes_resumo').select('id,nome,logo_url,whatsapp_grupo,teste').is('deleted_at', null).order('nome')
      ]);
      if (g.data) {
        const novo = new Map(g.data.map(x => [x.nome, x]));
        /* o que acabou de ser lido e ainda não chegou ao banco continua valendo */
        listaViva.forEach(x => { if (!novo.has(x.nome)) novo.set(x.nome, Object.assign({ cliente_id: null, tipo: '', ignorar: false, confirmado: false }, grupos.get(x.nome) || {}, x)); });
        grupos = novo;
      }
      if (c.data) clientes = c.data.filter(x => !x.teste);
    } catch (e) { /* sem rede: segue com o que tem */ }
  }
  const tokens = t => norm(t).split(' ').filter(w => w.length >= 3 && !VAZIAS.has(w));
  /* devolve { cliente, tipo, certo } ou null.
     zzz177 — a regra da equipe (Kevin): o NOME DO CLIENTE vem sempre
     DEPOIS do traço, ou o grupo é só o nome do cliente:
       "Suporte B7 Start - AutoEscola Sudoeste" → AutoEscola Sudoeste, tipo "Suporte B7 Start"
       "Sabor da Feira"                          → Sabor da Feira, sem tipo
     O que vem antes do traço é o tipo (Suporte + pacote, Artes…). Só se a
     parte depois do traço não for cliente nenhum é que o resto do nome é
     tentado — e aí vira só sugestão. Grupo interno não casa. */
  const TIPO_GRUPO_RE = /\b(suporte|producao|produca|artes?|social|trafego|design|video|videos|midias?|marketing|conteudo|grupo)\b/;
  const AGENCIA_RE = /^(b7|n7|nucleo ?7|branding ?7)\b|\b(da|do) (nucleo ?7|branding ?7)$/;
  /* equipe B7/N7/Núcleo7/Branding7: mensagem deles não é "cliente esperando" */
  const EQUIPE = ['matheus', 'mateus', 'kaique', 'alissan', 'pedro', 'yury', 'lucas', 'bruna', 'kevin', 'talita', 'atendimento', 'coordenacao', 'financeiro', 'comercial'];
  const ehEquipe = autor => { const a = norm(autor); return !!a && (EQUIPE.some(n => a === n || a.startsWith(n + ' ') || a.includes(' ' + n)) || AGENCIA_RE.test(a) || /\b(nucleo ?7|branding ?7|b7|n7)\b/.test(a)); };
  /* zzz179: aviso do próprio WhatsApp ("Os membros do grupo mudaram") não é cliente */
  const SISTEMA_RE = /membros do grupo|adicionou|removeu|saiu do grupo|saiu$|entrou usando|est[aá] no grupo|entrou no grupo|agora [eé] (um )?admin|fixou uma mensagem|mudou (o|a|as)|criou o grupo|mensagens tempor|criptografia|codigo de seguranca|código de segurança/i;
  /* quem mandou: o autor lido, ou o "Nome:" do começo da prévia; prévia que
     é só "B7", "Núcleo7" (nome do remetente da equipe) também conta */
  function daEquipe(g) {
    /* a conversa aberta é a fonte mais certa: quem mandou a última mensagem */
    if (conversaAberta && conversaAberta.titulo === g.nome && (conversaAberta.msgs || []).length) {
      const u = conversaAberta.msgs[conversaAberta.msgs.length - 1];
      if (u.minha || ehEquipe(u.de)) return true;
    }
    /* zzz184: tira as marcas invisíveis de direção (‪…‬) que o WhatsApp põe na prévia */
    const pv = String(g.previa || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim();
    const m = /^~?\s*([^:]{1,40}):\s/.exec(pv);
    /* prévia que começa com o nome de alguém da equipe ("Talita  Bom dia…",
       assinatura no começo) também é da equipe */
    /* zzz193: só vale como ASSINATURA — o nome seguido de quebra de linha
       (vira 2+ espaços na prévia). "Pedro, consegue ver?" é o CLIENTE
       falando COM o Pedro e continua esperando resposta. */
    const assin = /^([^\s,:!?.]{2,20})(?:\s{2,}|\n)\s*\S/.exec(pv);
    return ehEquipe(g.autor) || (m && ehEquipe(m[1])) || ehEquipe(pv.length <= 20 ? pv : '') || !!(assin && EQUIPE.includes(norm(assin[1])));
  }
  const INTERNO_RE = /\b(interno|internos|equipe|time b7|\(voce\)|concluidos|producao b7)\b/;
  const limpar = t => String(t || '').replace(/[^\p{L}\p{N}\s.&'’-]/gu, ' ').replace(/\s+/g, ' ').trim();
  function pontuar(parte) {
    const pn = norm(parte), tp = tokens(parte);
    if (pn.length < 2) return [];
    const r = [];
    clientes.forEach(c => {
      const cn = norm(c.nome); if (cn.length < 2) return;
      const tc = tokens(c.nome);
      let p = 0;
      const pj = pn.replace(/ /g, ''), cj = cn.replace(/ /g, '');
      if (pn === cn || pj === cj) p = 200;                                                   /* "Auto Escola" = "AutoEscola" */
      else if (cj.length >= 5 && pj.includes(cj)) p = 140 + cn.length;
      else if ((' ' + pn + ' ').includes(' ' + cn + ' ')) p = 150 + cn.length;           /* "Infinite Fio Conquista" ⊃ "Infinite Fio" */
      else if (pn.length >= 4 && (' ' + cn + ' ').includes(' ' + pn + ' ')) p = 120 + pn.length;   /* "Mercato" ⊂ "Mercato Sadia" */
      else if (tc.length) {
        const casa = w => tp.some(t => t === w || (Math.min(t.length, w.length) >= 5 && (t.startsWith(w) || w.startsWith(t))));
        const achou = tc.filter(casa);
        if (achou.length === tc.length) p = 110 + cn.length;
        else if (achou.some(w => w.length >= 5)) p = 40 + achou.join('').length;
      }
      if (p) r.push({ c, p });
    });
    return r.sort((a, b) => b.p - a.p);
  }
  function casar(nomeGrupo) {
    const bruto = String(nomeGrupo || '');
    if (INTERNO_RE.test(norm(bruto)) || /\(você\)/i.test(bruto)) return null;
    const partes = bruto.split(/\s+[-–—|]\s+/).map(limpar).filter(Boolean);
    if (!partes.length) return null;
    const fim = partes[partes.length - 1], antes = partes.slice(0, -1).join(' - ');
    /* zzz178: só GRUPO de cliente — "Suporte …", "Produção …", "Artes …".
       Contato salvo como "Pessoa - Empresa" não entra; nem a própria
       agência (B7, N7, Núcleo7, Branding7) do lado do cliente. */
    if (partes.length > 1 && !TIPO_GRUPO_RE.test(norm(antes))) return null;
    if (AGENCIA_RE.test(norm(fim)) || /\b(nucleo ?7|branding ?7)\b/.test(norm(fim))) return null;
    let r = pontuar(fim), tipo = antes, regra = true;
    if (!r.length && partes.length > 1) {
      /* fora da regra (ex.: "ARTES MERCATO - LOJA"): tenta o resto, só como sugestão */
      for (let k = partes.length - 2; k >= 0 && !r.length; k--) {
        if (/^suporte\b/.test(norm(partes[k]))) continue;      /* "Suporte <pacote>": pacote não é cliente */
        r = pontuar(partes[k]);
        if (r.length) tipo = partes.filter((_, i) => i !== k).join(' - ');
      }
      regra = false;
    }
    if (!r.length) return null;
    const melhor = r[0], empate = r.length > 1 && r[1].p === melhor.p;
    const certo = regra && melhor.p >= 110 && !empate;
    const tipoBonito = tipo && tipo === tipo.toUpperCase() ? tipo.toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase()) : tipo;
    return { cliente: melhor.c, tipo: (tipoBonito || '').slice(0, 40), certo };
  }
  const clienteDe = id => clientes.find(c => c.id === id) || null;
  /* o grupo já ligado (conferido ou automático) → cliente */
  function grupoInfo(nome) {
    const g = grupos.get(nome);
    if (g && g.ignorar) return { ignorar: true };
    if (g && g.cliente_id) return { cliente: clienteDe(g.cliente_id), tipo: g.tipo, ligado: true };
    const s = casar(nome);
    return s ? { cliente: s.cliente, tipo: s.tipo, sugestao: true, certo: s.certo } : null;
  }
  const gruposDoCliente = id => [...grupos.values()].filter(g => g.cliente_id === id && !g.ignorar);

  /* leitura nova chegou do programa: guarda no banco (com calma) e liga
     sozinho os casamentos certos */
  let paraMandar = new Map(), tMandar = 0;
  async function aoLista(l) {
    listaViva = Array.isArray(l) ? l : [];
    await carregarGrupos();
    listaViva.forEach(x => {
      const g = grupos.get(x.nome);
      if (!g || g.ultima_em !== x.ultima_em || g.minha !== x.minha || g.nao_lidas !== x.nao_lidas) paraMandar.set(x.nome, x);
      grupos.set(x.nome, Object.assign({}, g || { nome: x.nome, cliente_id: null, tipo: '', ignorar: false, confirmado: false }, x));
    });
    clearTimeout(tMandar); tMandar = setTimeout(mandarLeitura, 4000);
    vigiarEsperando();
    pintarLado();
  }
  async function mandarLeitura() {
    const itens = [...paraMandar.values()]; paraMandar = new Map();
    if (itens.length) { try { await B7.sb.rpc('whatsapp_grupos_sincronizar', { p_itens: itens }); } catch (e) {} }
    /* casamentos certos que ainda não estão ligados: liga sozinho (todos os
       grupos conhecidos, não só os que mudaram — a regra pode ter ficado
       melhor desde a última vez) */
    for (const x of [...grupos.values()]) {
      const g = grupos.get(x.nome);
      if (g && (g.cliente_id || g.ignorar || g.confirmado)) continue;
      const s = casar(x.nome);
      if (s && s.certo) {
        try {
          await B7.sb.rpc('whatsapp_grupo_vincular', { p_nome: x.nome, p_cliente_id: s.cliente.id, p_tipo: s.tipo, p_ignorar: false });
          Object.assign(g, { cliente_id: s.cliente.id, tipo: s.tipo, confirmado: true });
        } catch (e) {}
      }
    }
  }

  /* ------------------------------------- esperando resposta */
  const ESPERA_MIN = 15;
  function esperando() {
    const agora = Date.now();
    return [...grupos.values()].filter(g => !g.ignorar && !g.sem_espera && !g.minha && !daEquipe(g) && !SISTEMA_RE.test(g.previa || '') && g.ultima_em && (g.cliente_id || (!g.confirmado && (casar(g.nome) || {}).certo)) &&
      agora - new Date(g.ultima_em).getTime() > ESPERA_MIN * 60000 && agora - new Date(g.ultima_em).getTime() < 3 * 86400000)
      .sort((a, b) => new Date(a.ultima_em) - new Date(b.ultima_em));
  }
  const ha = iso => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.floor(m / 60);
    return h < 24 ? 'há ' + h + 'h' + (m % 60 >= 10 && h < 3 ? String(m % 60).padStart(2, '0') : '') : 'há ' + Math.floor(h / 24) + (h < 48 ? ' dia' : ' dias');
  };
  /* aviso do Windows quando um grupo de cliente passa de 1 h sem resposta
     (uma vez por mensagem) */
  const avisados = new Set();
  function vigiarEsperando() {
    const n = esperando();
    const chip = document.getElementById('wa-esp');
    if (chip) { chip.hidden = !n.length; chip.textContent = n.length + (n.length === 1 ? ' grupo esperando' : ' grupos esperando'); }
    n.forEach(g => {
      const chave = g.nome + '|' + g.ultima_em;
      if (avisados.has(chave) || Date.now() - new Date(g.ultima_em).getTime() < 60 * 60000) return;
      avisados.add(chave);
      try {
        if (window.Notification && Notification.permission === 'granted') {
          const c = clienteDe(g.cliente_id) || (casar(g.nome) || {}).cliente;
          const av = new Notification('Esperando resposta · ' + (c ? c.nome : g.nome), { body: (g.autor ? g.autor + ': ' : '') + (g.previa || 'mensagem nova') + ' (' + ha(g.ultima_em) + ')', tag: 'wa-esp-' + g.nome });
          av.onclick = () => { location.hash = '#/whatsapp'; if (D && D.abrirGrupo) D.abrirGrupo(g.nome); };
        }
      } catch (e) {}
    });
  }
  if (D && D.aoConversas) {
    D.aoConversas(aoLista);
    D.aoConversa(c => { if (!c || !conversaAberta || c.titulo !== conversaAberta.titulo) querLigar = false; conversaAberta = c; pintarLado(); });
    setInterval(vigiarEsperando, 60000);
  }

  /* ------------------------------------- cartão do cliente (ao lado) */
  const pendCache = new Map();
  async function pendencias(clienteId) {
    const c = pendCache.get(clienteId);
    if (c && Date.now() - c.em < 60000) return c.d;
    const hoje = new Date().toISOString().slice(0, 10);
    const [v, d, gv] = await Promise.all([
      B7.sb.from('demandas_edicao_resumo').select('id,titulo,codigo,editing_status,prazo').eq('client_id', clienteId).is('deleted_at', null)
        .in('editing_status', ['pendente', 'em_edicao', 'aguardando_aprovacao', 'correcao']).order('updated_at', { ascending: false }).limit(8),
      B7.sb.from('design_deliverables').select('id,titulo,tipo,status,prazo').eq('client_id', clienteId).is('deleted_at', null)
        .neq('status', 'finalizado').order('updated_at', { ascending: false }).limit(8),
      B7.sb.from('gravacoes_resumo').select('id,nome,data_gravacao,hora_inicio,hora_fim,local,situacao').eq('client_id', clienteId).is('deleted_at', null)
        .gte('data_gravacao', hoje).order('data_gravacao').limit(3)
    ]).catch(() => [{}, {}, {}]);
    const dados = { videos: v.data || [], design: d.data || [], gravacoes: (gv.data || []).filter(x => x.situacao !== 'Cancelada' && x.situacao !== 'Gravada') };
    pendCache.set(clienteId, { em: Date.now(), d: dados });
    return dados;
  }
  const ROT_VIDEO = { pendente: 'Na fila', em_edicao: 'Em edição', aguardando_aprovacao: 'Com o cliente', correcao: 'Ajustes' };
  const ROT_DESIGN = { aguardando_producao: 'Na fila', em_producao: 'Em criação', revisao_interna: 'Revisão interna', aguardando_cliente: 'Com o cliente', ajustes: 'Ajustes', aprovado: 'Aprovada', aprovado_interno: 'Aprovada pela B7', aprovado_cliente: 'Aprovada pelo cliente' };
  const APROVA_RE = /\b(aprovad[oa]s?|aprovo|pode (postar|publicar|seguir|soltar|mandar ver)|t[aá] (otimo|ótimo|perfeito|lindo|top)|ficou (otimo|ótimo|perfeito|lindo|top|show|massa)|perfeito|amei|aprovadíssimo)\b/i;
  const dataCurta = iso => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m; };

  let ladoAberto = B7.pref ? B7.pref.ler('wa_lado', innerWidth >= 1250) : true, pintandoLado = 0;
  async function pintarLado() {
    const lado = document.getElementById('wa-lado');
    if (!lado || !ladoAberto) return;
    const meu = ++pintandoLado;
    await carregarGrupos();
    const titulo = conversaAberta && conversaAberta.titulo;
    const info = titulo ? grupoInfo(titulo) : null;
    let html = '';
    if (!titulo) {
      html = '<div class="wl-vazio">' + icone + '<b>Abra uma conversa</b><span>O que está pendente com o cliente aparece aqui.</span></div>';
    } else if ((!info || !info.cliente) && !querLigar && ((info && info.ignorar) || ehEquipe(titulo) || conversaAberta.grupo === false || (conversaAberta.grupo !== true && !casar(titulo)))) {
      /* zzz195/197: conversa com uma PESSOA, da EQUIPE, ou grupo marcado
         como "não é de cliente": não pergunta "de qual cliente é" — só deixa
         a opção, se precisar */
      const daEq = ehEquipe(titulo);
      html = '<div class="wl-cab"><div class="wl-sem">' + (daEq ? 'B7' : conversaAberta.grupo === false ? '👤' : '#') + '</div><div><b>' + esc(titulo) + '</b><small>' +
        (daEq ? 'contato da equipe' : conversaAberta.grupo === false ? 'conversa pessoal' : 'não é de cliente') + '</small></div></div>' +
        (daEq ? '' : '<button type="button" class="wl-ligar-link" id="wl-quer-ligar">É de um cliente? Ligar a um cliente</button>');
    } else if (!info || info.ignorar || !info.cliente) {
      html = '<div class="wl-cab"><div class="wl-sem">?</div><div><b>' + esc(titulo) + '</b><small>' + (info && info.ignorar ? 'grupo ignorado' : 'não ligado a um cliente') + '</small></div></div>' +
        (info && info.ignorar && !querLigar ? '' : '<div class="wl-ligar"><label class="rot">ESTE GRUPO É DE QUAL CLIENTE?</label><select class="campo" id="wl-cli"><option value="">Escolha…</option>' +
          clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') + '</select>' +
          '<button type="button" class="b fina contorno" id="wl-ign">Não é de cliente</button></div>');
    } else {
      const c = info.cliente, p = await pendencias(c.id);
      if (meu !== pintandoLado) return;
      const ultimaDele = (conversaAberta.msgs || []).slice().reverse().find(m => !m.minha && !ehEquipe(m.de) && !/^\*?[^\n:*]{1,30}:\*?\s*\n/.test(m.texto) && APROVA_RE.test(m.texto));   /* zzz183: só o CLIENTE aprova — equipe (e mensagem assinada "Nome:") não conta */
      const comCliente = p.videos.filter(v => v.editing_status === 'aguardando_aprovacao');
      html = '<div class="wl-cab">' + B7.UI.avatarCliente(c.nome, c.logo_url, 'p') +
          '<div><b>' + esc(c.nome) + '</b><small>' + esc(info.tipo || 'grupo do cliente') + (info.sugestao ? ' · <a href="#" id="wl-conf">confirmar</a>' : '') + '</small></div>' +
          '<a class="wa-ic" href="#/cliente/' + esc(c.id) + '" title="Abrir o cliente no B7" aria-label="Abrir o cliente">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V8.5A1.5 1.5 0 0 1 6.5 7H10"/></svg></a></div>' +
        '<label class="wl-acomp"><input type="checkbox" id="wl-acomp"' + (grupos.get(titulo) && grupos.get(titulo).sem_espera ? '' : ' checked') + '><span>Avisar quando este grupo esperar resposta</span></label>' +
        (ultimaDele ? '<div class="wl-aprov"><b>Possível aprovação</b><p>“' + esc(ultimaDele.texto.slice(0, 120)) + '”</p><small>' + esc(ultimaDele.de || 'cliente') + (ultimaDele.quando ? ' · ' + esc(ultimaDele.quando.split(',')[0]) : '') + '</small>' +
          (comCliente.length ? comCliente.slice(0, 3).map(v => '<a class="b fina pri" href="#/video/' + esc(v.id) + '">Registrar em “' + esc(v.titulo || v.codigo || 'vídeo') + '”</a>').join('') : '<span class="leve">Nada com o cliente esperando decisão agora.</span>') + '</div>' : '') +
        secao('Vídeo', p.videos.map(v => item('#/video/' + v.id, v.titulo || v.codigo || 'Vídeo', ROT_VIDEO[v.editing_status] || v.editing_status, v.editing_status === 'aguardando_aprovacao',
            v.editing_status === 'aguardando_aprovacao' || v.editing_status === 'em_edicao' ? '<button type="button" class="wl-mini" data-env-video="' + esc(v.id) + '" title="Enviar no WhatsApp">' + icone + '</button>' : ''))) +
        secao('Design', p.design.map(d => item('#/design/' + d.id, d.titulo || d.tipo || 'Peça', ROT_DESIGN[d.status] || d.status, d.status === 'aguardando_cliente' || d.status === 'aprovado_interno',
            d.status !== 'aguardando_producao' ? '<button type="button" class="wl-mini" data-env-design="' + esc(d.id) + '" title="Enviar a arte no WhatsApp">' + icone + '</button>' : ''))) +
        secao('Gravações', p.gravacoes.map(g => item('#/gravacao/' + g.id, g.nome || 'Gravação', dataCurta(g.data_gravacao) + (g.hora_inicio ? ' · ' + String(g.hora_inicio).slice(0, 5) : ''), false,
            '<button type="button" class="wl-mini" data-env-grav="' + esc(g.id) + '" title="Avisar no WhatsApp">' + icone + '</button>')));
      if (!p.videos.length && !p.design.length && !p.gravacoes.length) html += '<p class="wl-nada">Nada pendente com este cliente. 🎉</p>';
      html = html.replace('<label class="wl-acomp">', blocoIA(titulo) + '<label class="wl-acomp">');
    }
    /* quem está esperando resposta (todos os grupos de cliente) */
    const esp = esperando();
    html += '<div class="wl-sec wl-esp"><div class="wl-sec-t">Esperando resposta' + (esp.length ? '<i>' + esp.length + '</i>' : '') + '</div>' +
      (esp.length ? esp.slice(0, 12).map(g => { const c = clienteDe(g.cliente_id);
        const c2 = c || (casar(g.nome) || {}).cliente;
        const nm = c2 ? c2.nome : g.nome;
        return '<div class="wl-g-l"><button type="button" class="wl-g" data-abrir-g="' + esc(g.nome) + '">' + B7.UI.avatarCliente(nm, c2 && c2.logo_url, 'p') +
          '<span class="wl-g-n">' + esc(nm) + (g.tipo ? ' <em>' + esc(g.tipo) + '</em>' : '') + '</span>' +
          '<span class="wl-g-p">' + esc((g.autor ? g.autor + ': ' : '') + String(g.previa || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')) + '</span><time>' + ha(g.ultima_em) + '</time></button>' +
          '<button type="button" class="wl-g-x" data-sem-espera="' + esc(g.nome) + '" title="Não acompanhar este grupo (outra área cuida)" aria-label="Não acompanhar este grupo">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg></button></div>'; }).join('')
        : '<p class="wl-nada">Ninguém esperando. ✔</p>') + '</div>' +
      '<button type="button" class="wl-conf" id="wl-conferir">Conferir grupos' + (pendentesConferir() ? ' · ' + pendentesConferir() + ' sem cliente' : '') + '</button>';
    if (meu !== pintandoLado) return;
    lado.innerHTML = html;
    ligarLado(lado, info, titulo);
  }
  /* ---------- zzz194: IA na conversa — resumo e sugestão de resposta.
     Só roda no clique; usa as mensagens da conversa aberta (lidas pelo
     programa) + as pendências do cliente (lidas no servidor). */
  let querLigar = false;      /* zzz195: a pessoa pediu para ligar uma conversa pessoal a um cliente */
  let iaRes = null;          /* { titulo, tipo, texto?, erro?, carregando } */
  const iaPode = () => !!(B7.IA && B7.IA.ligada && B7.IA.ligada('chat'));
  function blocoIA(titulo) {
    if (!iaPode() || !conversaAberta || !(conversaAberta.msgs || []).length) return '';
    const r = iaRes && iaRes.titulo === titulo ? iaRes : null;
    const bt = (tipo, rot, svg) => '<button type="button" class="wl-ia-bt' + (r && r.tipo === tipo ? ' on' : '') + '" data-ia="' + tipo + '"' + (r && r.carregando ? ' disabled' : '') + '>' + svg + rot + '</button>';
    let corpo = '';
    if (r && r.carregando) corpo = '<div class="wl-ia-res carregando"><i></i><i></i><i></i><span>' + (r.tipo === 'resumo' ? 'Lendo a conversa…' : 'Escrevendo uma resposta…') + '</span></div>';
    else if (r && r.erro) corpo = '<div class="wl-ia-res erro">' + esc(r.erro) + '</div>';
    else if (r && r.texto) corpo = '<div class="wl-ia-res"><div class="wl-ia-tx">' + esc(r.texto).replace(/\n/g, '<br>') + '</div><div class="wl-ia-acoes">' +
      (r.tipo === 'resposta' ? '<button type="button" class="b fina pri" data-ia-por>Colocar no WhatsApp</button>' : '') +
      '<button type="button" class="b fina" data-ia-copiar>Copiar</button><button type="button" class="b fina" data-ia="' + r.tipo + '">De novo</button>' +
      '<button type="button" class="wl-ia-x" data-ia-fechar aria-label="Fechar">×</button></div></div>';
    return '<div class="wl-ia"><div class="wl-ia-bts">' +
      bt('resumo', 'O que rolou aqui?', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 6h14M5 11h14M5 16h9"/></svg>') +
      bt('resposta', 'Sugerir resposta', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>') +
      '</div>' + corpo + '</div>';
  }
  async function pedirIA(tipo, titulo, info) {
    const msgs = ((conversaAberta && conversaAberta.titulo === titulo && conversaAberta.msgs) || []).slice(-60)
      .map(m => ({ de: m.de || '', texto: String(m.texto || ''), minha: !!m.minha || ehEquipe(m.de), quando: m.quando || '' }));
    if (!msgs.length) return;
    iaRes = { titulo, tipo, carregando: true }; pintarLado();
    const r = await B7.IA.pedir('whatsapp', { operacao: tipo, grupo: titulo, cliente_id: info && info.cliente ? info.cliente.id : null,
      mensagens: msgs, autor: primeiroNome() });
    if (!iaRes || iaRes.titulo !== titulo || iaRes.tipo !== tipo) return;
    iaRes = r.ok ? { titulo, tipo, texto: r.texto } : r.cancelado ? null : { titulo, tipo, erro: r.mensagem || 'Não deu para gerar agora.' };
    pintarLado();
  }
  function secao(t, itens) { return itens.length ? '<div class="wl-sec"><div class="wl-sec-t">' + t + '<i>' + itens.length + '</i></div>' + itens.join('') + '</div>' : ''; }
  function item(href, titulo, sit, destaque, extra) {
    return '<div class="wl-it' + (destaque ? ' quente' : '') + '"><a href="' + esc(href) + '"><b>' + esc(titulo) + '</b><small>' + esc(sit || '') + '</small></a>' + (extra || '') + '</div>';
  }
  /* só conta o que parece grupo de cliente (conversa pessoal não entra) */
  const pendentesConferir = () => [...grupos.values()].filter(g => !g.cliente_id && !g.ignorar && !g.confirmado && casar(g.nome)).length;
  function ligarLado(lado, info, titulo) {
    lado.querySelectorAll('[data-abrir-g]').forEach(b => b.onclick = () => D.abrirGrupo && D.abrirGrupo(b.dataset.abrirG));
    const conf = lado.querySelector('#wl-conferir'); if (conf) conf.onclick = conferirGrupos;
    const ql = lado.querySelector('#wl-quer-ligar'); if (ql) ql.onclick = () => { querLigar = true; pintarLado(); };
    lado.querySelectorAll('[data-ia]').forEach(b => b.onclick = () => pedirIA(b.dataset.ia, titulo, info));
    const iaX = lado.querySelector('[data-ia-fechar]'); if (iaX) iaX.onclick = () => { iaRes = null; pintarLado(); };
    const iaCp = lado.querySelector('[data-ia-copiar]');
    if (iaCp) iaCp.onclick = async () => { try { await navigator.clipboard.writeText(iaRes.texto); B7.UI.toast('Copiado.'); } catch (e) {} };
    const iaPor = lado.querySelector('[data-ia-por]');
    if (iaPor) iaPor.onclick = async () => {
      iaPor.disabled = true;
      const r = await D.enviar({ grupo: titulo, texto: iaRes.texto }).catch(() => null);
      B7.UI.toast(r && r.ok ? 'Pronto: confira e aperte enviar.' : ((r && r.motivo) || 'Não consegui escrever.') + ' O texto ficou copiado.', r && r.ok ? {} : { tipo: 'erro' });
      iaPor.disabled = false;
    };
    lado.querySelectorAll('[data-sem-espera]').forEach(b => b.onclick = () => semEspera(b.dataset.semEspera, true));
    const ac = lado.querySelector('#wl-acomp'); if (ac) ac.onchange = () => semEspera(titulo, !ac.checked);
    const sel = lado.querySelector('#wl-cli');
    if (sel) sel.onchange = async () => {
      if (!sel.value) return;
      const s = casar(titulo);
      await vincular(titulo, sel.value, s && s.cliente.id === sel.value ? s.tipo : '', false);
      pintarLado();
    };
    const ign = lado.querySelector('#wl-ign'); if (ign) ign.onclick = async () => { await vincular(titulo, null, '', true); pintarLado(); };
    const cf = lado.querySelector('#wl-conf'); if (cf) cf.onclick = async e => { e.preventDefault(); await vincular(titulo, info.cliente.id, info.tipo, false); pintarLado(); };
    lado.querySelectorAll('[data-env-video]').forEach(b => b.onclick = () => {
      const c = info.cliente;
      enviar({ tipo: 'video', refId: b.dataset.envVideo, demandaId: b.dataset.envVideo, clienteId: c.id, clienteNome: c.nome, comArquivo: true, grupo: titulo,
               titulo: (b.closest('.wl-it').querySelector('b') || {}).textContent || '' });
    });
    lado.querySelectorAll('[data-env-design]').forEach(b => b.onclick = () => {
      const c = info.cliente;
      enviar({ tipo: 'design', refId: b.dataset.envDesign, clienteId: c.id, clienteNome: c.nome, grupo: titulo,
               titulo: (b.closest('.wl-it').querySelector('b') || {}).textContent || '' });
    });
    lado.querySelectorAll('[data-env-grav]').forEach(async b => b.onclick = async () => {
      const c = info.cliente, p = await pendencias(c.id), g = p.gravacoes.find(x => x.id === b.dataset.envGrav);
      if (!g) return;
      const [a, m, d] = String(g.data_gravacao).slice(0, 10).split('-');
      const dt = new Date(+a, +m - 1, +d);
      enviar({ tipo: 'gravacao', refId: g.id, clienteId: c.id, clienteNome: c.nome, titulo: g.nome, grupo: titulo,
               data: dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
               hora: g.hora_inicio ? String(g.hora_inicio).slice(0, 5) + (g.hora_fim ? '–' + String(g.hora_fim).slice(0, 5) : '') : '', local: g.local || '' });
    });
  }
  /* zzz184: grupo que outra área cuida (ex.: designers) sai do "esperando resposta" */
  async function semEspera(nome, sem) {
    const g = grupos.get(nome); if (g) g.sem_espera = sem;
    pintarLado(); vigiarEsperando();
    try { await B7.sb.rpc('whatsapp_grupo_espera', { p_nome: nome, p_sem: sem }); }
    catch (e) { B7.UI.toast && B7.UI.toast('Não deu para salvar. Tente de novo.', { tipo: 'erro' }); }
    if (sem && B7.UI.toast) B7.UI.toast('Grupo fora do “esperando resposta”. Para voltar, abra o grupo e marque o aviso.');
  }
  async function vincular(nome, clienteId, tipo, ignorar) {
    try {
      await B7.sb.rpc('whatsapp_grupo_vincular', { p_nome: nome, p_cliente_id: clienteId, p_tipo: tipo || '', p_ignorar: !!ignorar });
      const g = grupos.get(nome) || { nome };
      grupos.set(nome, Object.assign(g, { cliente_id: clienteId, tipo: tipo || '', ignorar: !!ignorar, confirmado: true }));
      return true;
    } catch (e) { B7.UI.toast('Não consegui salvar o grupo.', { tipo: 'erro' }); return false; }
  }

  /* ------------------------------------- conferir grupos (uma vez) */
  async function conferirGrupos() {
    await carregarGrupos(true);
    /* zzz177: tela refeita — separada em "Para conferir", "Ligados" e
       "Ignorados"; cada grupo é um cartão com o nome inteiro em cima e os
       campos embaixo (antes ficava tudo espremido numa linha só) */
    const m = B7.UI.modal('<div class="wg">' +
      '<div class="wg-cab"><span class="wg-ic">' + icone + '</span><div><h3>Grupos do WhatsApp</h3>' +
        '<p class="sub">O cliente é o nome <b>depois do traço</b> (“Suporte B7 - <b>Arena Deck</b>”); o que vem antes vira o tipo. Confira uma vez — grupo novo entra sozinho depois.</p></div></div>' +
      '<div class="wg-barra"><div class="wg-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>' +
          '<input id="wg-busca" placeholder="Buscar grupo ou cliente…" autocomplete="off"></div>' +
        '<div class="wg-filtros" role="tablist">' +
          '<button type="button" class="on" data-f="conferir">Para conferir <i id="wg-n-conferir"></i></button>' +
          '<button type="button" data-f="ligados">Ligados <i id="wg-n-ligados"></i></button>' +
          '<button type="button" data-f="ignorados">Ignorados <i id="wg-n-ignorados"></i></button>' +
          '<button type="button" data-f="todas">Todas <i id="wg-n-todas"></i></button></div>' +
        (D && D.escanear ? '<button type="button" class="b fina contorno" id="wg-escanear">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg>Procurar todos os grupos</button>' : '') + '</div>' +
      '<div class="wg-lista" id="wg-lista"></div>' +
      '<div class="acoes wg-pe"><span class="wg-mud" id="wg-mud"></span><button type="button" class="b" data-fecha>Fechar</button><button type="button" class="b pri" id="wg-salvar">Salvar</button></div>' +
      '</div>', { larga: true, classe: 'wg-modal' });
    const mud = new Map();
    let filtro = 'conferir';
    const estado = g => {
      const k = mud.get(g.nome) || {};
      const s0 = !g.cliente_id && !g.ignorar ? casar(g.nome) : null;
      const cli = 'cli' in k ? k.cli : (g.cliente_id || (s0 ? s0.cliente.id : ''));
      const tipo = 'tipo' in k ? k.tipo : (g.cliente_id ? g.tipo : (s0 ? s0.tipo : ''));
      const ign = 'ign' in k ? k.ign : !!g.ignorar;
      const grupo = ign ? 'ignorados' : (g.cliente_id && !('cli' in k) ? 'ligados' : (cli ? 'conferir' : (g.confirmado ? 'ligados' : 'outros')));
      return { cli, tipo, ign, sug: !!s0 && !('cli' in k), grupo, mexeu: !!mud.get(g.nome) };
    };
    const pintar = () => {
      const q = norm(m.querySelector('#wg-busca').value);
      const todas = [...grupos.values()].map(g => ({ g, e: estado(g) }));
      const conta = f => todas.filter(x => f === 'todas' ? true : x.e.grupo === f).length;
      ['conferir', 'ligados', 'ignorados', 'todas'].forEach(f => { const el = m.querySelector('#wg-n-' + f); if (el) el.textContent = conta(f) || ''; });
      const lista = todas.filter(x => filtro === 'todas' || x.e.grupo === filtro)
        .filter(x => !q || norm(x.g.nome).includes(q) || norm((clienteDe(x.e.cli) || {}).nome).includes(q))
        .sort((a, b) => a.g.nome.localeCompare(b.g.nome, 'pt-BR'));
      const vazio = { conferir: 'Nada para conferir. ✔ Os grupos com o nome de um cliente já foram ligados sozinhos.',
        ligados: 'Nenhum grupo ligado ainda.', ignorados: 'Nenhum grupo ignorado.', todas: 'Nenhuma conversa lida ainda — clique em “Procurar todos os grupos”.' };
      m.querySelector('#wg-lista').innerHTML = lista.length ? lista.map(({ g, e }) => {
        const c = clienteDe(e.cli);
        const pill = e.ign ? '<span class="wg-pill p-ign">Ignorado</span>' : g.cliente_id && !e.mexeu ? '<span class="wg-pill p-ok">Ligado</span>' : e.sug ? '<span class="wg-pill p-sug">Sugestão</span>' : e.mexeu ? '<span class="wg-pill p-mud">Alterado</span>' : '';
        return '<div class="wg-l' + (e.ign ? ' wg-ign-l' : '') + (e.sug ? ' wg-sug' : '') + (e.mexeu ? ' mexeu' : '') + '" data-g="' + esc(g.nome) + '">' +
          '<div class="wg-top">' + (c ? B7.UI.avatarCliente(c.nome, c.logo_url, 'p') : '<span class="wg-sem">?</span>') +
            '<div class="wg-nm"><b title="' + esc(g.nome) + '">' + esc(g.nome) + '</b>' +
              '<small>' + (c ? esc(c.nome) + (e.tipo ? ' · ' + esc(e.tipo) : '') : 'sem cliente') + '</small></div>' + pill + '</div>' +
          (e.ign ? '<div class="wg-campos"><span class="leve">Este grupo não aparece no painel nem em “esperando resposta”.</span><button type="button" class="b fina contorno wg-ign">Voltar a usar</button></div>'
            : '<div class="wg-campos">' +
              '<label><span>Cliente</span><select class="campo wg-c"><option value="">— sem cliente —</option>' + clientes.map(cl => '<option value="' + esc(cl.id) + '"' + (cl.id === e.cli ? ' selected' : '') + '>' + esc(cl.nome) + '</option>').join('') + '</select></label>' +
              '<label><span>Tipo</span><input class="campo wg-t" placeholder="Suporte, Artes…" maxlength="40" value="' + esc(e.tipo || '') + '"></label>' +
              '<button type="button" class="b fina wg-ign" title="Não é grupo de cliente">Ignorar</button></div>') +
        '</div>';
      }).join('') : '<div class="wg-vazio">' + vazio[filtro] + '</div>';
      const n = [...mud.keys()].length + (filtro === 'conferir' ? 0 : 0);
      const sugs = todas.filter(x => x.e.sug && !x.e.ign).length;
      m.querySelector('#wg-mud').textContent = n ? n + ' alteração(ões) para salvar' : (sugs ? sugs + ' sugestão(ões) — “Salvar” aceita como estão' : '');
      m.querySelectorAll('.wg-l').forEach(l => {
        const nome = l.dataset.g, k = () => { if (!mud.has(nome)) mud.set(nome, {}); return mud.get(nome); };
        const sc = l.querySelector('.wg-c'), ti = l.querySelector('.wg-t');
        if (sc) sc.onchange = () => {
          k().cli = sc.value;
          const s1 = casar(nome); if (s1 && s1.cliente.id === sc.value && !ti.value) { ti.value = s1.tipo; k().tipo = s1.tipo; }
          pintar();
        };
        if (ti) ti.oninput = () => { k().tipo = ti.value; m.querySelector('#wg-mud').textContent = mud.size + ' alteração(ões) para salvar'; };
        l.querySelector('.wg-ign').onclick = () => { const e = estado(grupos.get(nome)); k().ign = !e.ign; pintar(); };
      });
    };
    m.querySelector('#wg-busca').oninput = pintar;
    m.querySelectorAll('.wg-filtros button').forEach(b => b.onclick = () => {
      filtro = b.dataset.f; m.querySelectorAll('.wg-filtros button').forEach(x => x.classList.toggle('on', x === b)); pintar();
    });
    const btE = m.querySelector('#wg-escanear');
    if (btE) btE.onclick = async () => {
      btE.disabled = true; btE.classList.add('girando'); const tx = btE.lastChild; tx.textContent = 'Procurando… (o WhatsApp rola sozinho)';
      const r = await D.escanear().catch(() => null);
      if (r && r.ok && r.lista) { await aoLista(r.lista); await mandarLeitura(); B7.UI.toast(r.lista.length + ' conversas lidas.'); }
      else B7.UI.toast((r && r.motivo) || 'Não consegui ler a lista agora.', { tipo: 'erro' });
      btE.disabled = false; btE.classList.remove('girando'); tx.textContent = 'Procurar todos os grupos';
      pintar();
    };
    m.querySelector('#wg-salvar').onclick = async () => {
      const bt = m.querySelector('#wg-salvar'); bt.disabled = true;
      /* as sugestões aceitas como estão também contam */
      [...grupos.values()].forEach(g => { const e = estado(g); if (e.sug && !e.ign && !mud.has(g.nome)) mud.set(g.nome, {}); });
      let n = 0;
      for (const [nome] of mud) {
        const g = grupos.get(nome); if (!g) continue;
        const e = estado(g);
        if (await vincular(nome, e.ign ? null : (e.cli || null), e.ign ? '' : (e.tipo || '').trim(), e.ign)) n++;
      }
      m.fechar(); B7.UI.toast(n ? n + ' grupo(s) salvos.' : 'Nada mudou.');
      pintarLado();
    };
    pintar();
  }

  /* ------------------------------------------------ modelos de texto */
  const MODELOS = {
    video: 'Olá, {cliente}! 🎬\nSegue o vídeo{titulo} para vocês conferirem. Qualquer ajuste, é só nos falar por aqui.',
    design: 'Olá, {cliente}! 🎨\nSegue a arte{titulo} para vocês conferirem. Qualquer ajuste, é só nos falar por aqui.',
    gravacao: 'Olá, {cliente}! 🎥\nPassando para confirmar a nossa gravação:\n📅 {data}{hora}{local}\nQualquer mudança, nos avise por aqui. Até lá!'
  };
  const chaveModelo = t => 'wa_modelo_' + t;
  function preencher(tpl, d) {
    return tpl
      .replace(/\{cliente\}/g, d.clienteNome || '')
      .replace(/\{titulo\}/g, d.titulo ? ' "' + d.titulo + '"' : '')
      .replace(/\{data\}/g, d.data || '')
      .replace(/\{hora\}/g, d.hora ? ' às ' + d.hora : '')
      .replace(/\{local\}/g, d.local ? '\n📍 ' + d.local : '');
  }

  /* ----------------------------------------- "Enviar ao cliente" */
  async function enviar(d) {
    let grupo = d.grupo || '';
    /* zzz176: os grupos reconhecidos do cliente (Suporte, Artes…) */
    await carregarGrupos();
    const dele = d.clienteId ? gruposDoCliente(d.clienteId) : [];
    if (!grupo && dele.length) grupo = dele.slice().sort((a, b) => new Date(b.ultima_em || 0) - new Date(a.ultima_em || 0))[0].nome;
    if (!grupo && d.clienteId) { try { const c = await B7.DB.cliente(d.clienteId); grupo = (c && c.whatsapp_grupo) || ''; } catch (e) {} }
    const tpl = B7.pref.ler(chaveModelo(d.tipo), MODELOS[d.tipo] || '');
    const prog = !!D, cel = nativo();
    /* zzz185: peça de design — as artes da última versão vão junto, sem escolher arquivo */
    const artes = d.tipo === 'design' ? await arquivosDesign(d.refId) : [];
    const autoArtes = prog && D.enviaUrls && artes.length;
    if (d.tipo === 'design' && prog && !autoArtes) d.comArquivo = true;
    const oQue = d.tipo === 'design' ? 'a arte' : 'o vídeo';
    const m = B7.UI.modal('<h3>' + (d.tipo === 'gravacao' ? 'Avisar a gravação no WhatsApp' : d.tipo === 'design' ? 'Enviar a arte no WhatsApp' : 'Enviar o vídeo no WhatsApp') + '</h3>' +
      '<p class="sub">' + (prog
        ? 'O sistema abre o grupo, ' + (autoArtes ? 'anexa ' + (artes.length > 1 ? 'as ' + artes.length + ' artes ' : 'a arte ') : d.comArquivo ? 'anexa ' + oQue + (d.tipo === 'video' ? ' como documento ' : ' ') : '') + 'e escreve a mensagem. <b>Quem aperta enviar é você.</b>'
        : cel ? 'Abre o WhatsApp com a mensagem' + (d.comArquivo ? ' e ' + oQue : '') + ' — você escolhe o grupo e envia.'
        : 'A mensagem é copiada e o WhatsApp Web abre numa aba: cole (Ctrl+V) no grupo' + (d.comArquivo || artes.length ? ' e anexe ' + oQue : '') + '.') + '</p>' +
      '<div class="mb"><label class="rot" for="wa-g">GRUPO DO CLIENTE</label>' +
        (dele.length > 1
          ? '<div class="wa-gs">' + dele.map(g => '<label class="wa-g-op"><input type="radio" name="wa-g-r" value="' + esc(g.nome) + '"' + (g.nome === grupo ? ' checked' : '') + '><span><b>' + esc(g.tipo || g.nome) + '</b><small>' + esc(g.nome) + '</small></span></label>').join('') + '</div>'
          : '') +
        '<input class="campo" id="wa-g" maxlength="120" value="' + esc(grupo) + '" placeholder="Nome do grupo, igual aparece no WhatsApp"' + (dele.length > 1 ? ' hidden' : '') + '>' +
        '<small class="leve wa-g-dica" id="wa-g-dica">' + (grupo ? '' : 'Este cliente ainda não tem grupo reconhecido — o nome que você puser aqui fica ligado a ele.') + '</small></div>' +
      (autoArtes
        ? '<div class="mb"><label class="rot">' + (artes.length > 1 ? artes.length + ' ARTES' : 'ARTE') + ' · VERSÃO MAIS NOVA</label><div class="wa-artes">' +
            artes.map((a, i) => '<label class="wa-arte" title="' + esc(a.nome_original || '') + '"><input type="checkbox" data-arte="' + i + '" checked><span>' + esc(a.nome_original || 'arte') + '</span></label>').join('') + '</div>' +
            '<div class="wa-arq"><button type="button" class="b fina contorno" id="wa-arq">+ Outras do computador…</button><span id="wa-arq-nome" class="leve"></span></div></div>'
        : '') +
      (d.comArquivo && (prog || cel)
        ? '<div class="mb"><label class="rot">' + (d.tipo === 'design' ? 'ARTE' : 'VÍDEO') + '</label><div class="wa-arq">' +
            '<button type="button" class="b contorno" id="wa-arq">Escolher ' + oQue + '…</button><span id="wa-arq-nome" class="leve">' +
            (cel ? 'você escolhe ao tocar em “Abrir no WhatsApp”' : 'nenhum escolhido') + '</span></div></div>'
        : '') +
      '<div class="mb"><label class="rot" for="wa-tx">MENSAGEM</label>' +
        '<textarea class="campo alta" id="wa-tx" rows="6">' + esc(preencher(tpl, d)) + '</textarea>' +
        '<small class="leve">' + (prog ? 'A assinatura com o seu nome entra sozinha quando você enviar.' : '') +
          ' <button type="button" class="link" id="wa-modelo">Usar este texto como modelo</button></small></div>' +
      '<div class="acoes"><button type="button" class="b" data-fecha>Cancelar</button>' +
        '<button type="button" class="b pri" id="wa-ok">' + icone + 'Abrir no WhatsApp</button></div>', { larga: true });
    m.querySelectorAll('input[name="wa-g-r"]').forEach(r => r.onchange = () => { m.querySelector('#wa-g').value = r.value; });
    let arquivo = null, arquivos = [];
    const btArq = m.querySelector('#wa-arq');
    if (btArq && prog) btArq.onclick = async () => {
      const a = await D.escolherArquivo({ tipo: d.tipo }).catch(() => null);
      if (!a) return;
      arquivo = a; arquivos = a.arquivos || [a];
      /* zzz186: arte pode ser várias (a mesma arte em proporções diferentes) */
      m.querySelector('#wa-arq-nome').textContent = arquivos.length > 1
        ? arquivos.length + ' arquivos · ' + tamanho(arquivos.reduce((t, x) => t + (x.tamanho || 0), 0))
        : a.nome + ' · ' + tamanho(a.tamanho);
    };
    if (btArq && cel) btArq.remove();
    m.querySelector('#wa-modelo').onclick = () => {
      /* guarda o texto com os espaços {cliente}, {data}… no lugar dos valores */
      let t = m.querySelector('#wa-tx').value;
      if (d.clienteNome) t = t.split(d.clienteNome).join('{cliente}');
      if (d.titulo) t = t.split(' "' + d.titulo + '"').join('{titulo}');
      if (d.data) t = t.split(d.data).join('{data}');
      if (d.hora) t = t.split(' às ' + d.hora).join('{hora}');
      if (d.local) t = t.split('\n📍 ' + d.local).join('{local}');
      B7.pref.gravar(chaveModelo(d.tipo), t);
      B7.UI.toast('Modelo guardado. Os próximos envios já começam com ele.');
    };
    m.querySelector('#wa-ok').onclick = async () => {
      const g = m.querySelector('#wa-g').value.trim();
      let texto = m.querySelector('#wa-tx').value.trim();
      const bt = m.querySelector('#wa-ok');
      if (prog && !g) { m.querySelector('#wa-g').classList.add('erro'); m.querySelector('#wa-g').focus(); return; }
      if (prog && d.comArquivo && !arquivo) {
        const seguir = await B7.UI.confirmar({ titulo: d.tipo === 'design' ? 'Sem arte?' : 'Sem vídeo?', texto: 'Nenhum arquivo foi escolhido. Mandar só a mensagem?', rotulo: 'Só a mensagem' });
        if (!seguir) return;
      }
      bt.disabled = true;
      /* grupo novo ou trocado: guarda no cliente */
      if (d.clienteId && g && !dele.some(x => x.nome === g)) {
        try { await B7.DB.atualizarCliente(d.clienteId, { whatsapp_grupo: g }); } catch (e) {}
        const s0 = casar(g); vincular(g, d.clienteId, s0 && s0.cliente.id === d.clienteId ? s0.tipo : '', false);
      }
      let ok = false, aviso = '';
      try {
        if (prog) {
          location.hash = '#/whatsapp';
          let urls = [];
          if (autoArtes) {
            bt.textContent = 'Preparando as artes…';
            const marcadas = artes.filter((a, i) => { const c = m.querySelector('[data-arte="' + i + '"]'); return !c || c.checked; });
            urls = (await Promise.all(marcadas.map(a => B7.DB.urlArquivoDesign(a.caminho).then(url => ({ url, nome: a.nome_original || 'arte' })).catch(() => null)))).filter(Boolean);
          }
          const r = await D.enviar({ grupo: g, texto, urls, caminho: D.enviaUrls && arquivos.length > 1 ? arquivos.map(x => x.caminho) : arquivo ? arquivo.caminho : '', documento: d.tipo !== 'design' });
          ok = !!(r && r.ok);
          /* zzz199: registro do que aconteceu no envio com arquivo (para achar a causa quando falha) */
          if (urls.length || arquivo || !ok) {
            try { B7.sb.rpc('whatsapp_diagnostico_registrar', { p_etapa: d.tipo + (ok ? ':ok' : ':erro'), p_motivo: (r && r.motivo) || '',
              p_dados: Object.assign({ app: !!D.enviaUrls, urls: urls.length, local: arquivos.length || (arquivo ? 1 : 0) }, (r && r.diag) || {}) }).then(() => {}, () => {}); } catch (e) {}
          }
          aviso = r && r.ok ? 'Confira no WhatsApp e aperte enviar.' :
            ((r && r.motivo) || 'Não consegui preparar sozinho.') + ' A mensagem ficou copiada: cole (Ctrl+V) no grupo.';
        } else if (cel) {
          const nome = primeiroNome();
          if (nome) texto = '*' + nome + ':*\n' + texto;
          const r = await B7.AppNativo.whatsCompartilhar(texto, !!d.comArquivo);
          ok = !!(r && r.ok);
          aviso = ok ? 'Escolha o grupo no WhatsApp e envie.' : 'Não consegui abrir o WhatsApp.';
        } else {
          const nome = primeiroNome();
          if (nome) texto = '*' + nome + ':*\n' + texto;
          try { await navigator.clipboard.writeText(texto); } catch (e) {}
          window.open('https://web.whatsapp.com/', '_blank', 'noopener');
          ok = true; aviso = 'Mensagem copiada. No grupo, cole com Ctrl+V.';
        }
      } catch (e) { aviso = (e && e.message) || 'Não deu para abrir o WhatsApp.'; }
      m.fechar();
      B7.UI.toast(aviso, ok ? {} : { tipo: 'erro' });
      if (ok || prog) {
        try {
          await B7.sb.rpc('whatsapp_registrar_envio', {
            p_tipo: d.tipo, p_ref_id: d.refId || null, p_cliente_id: d.clienteId || null, p_grupo: g,
            p_arquivo: arquivos.length ? arquivos.map(x => x.nome).join(', ') : autoArtes ? artes.map(a => a.nome_original).join(', ') : '', p_texto: texto, p_demanda_id: d.demandaId || null
          });
        } catch (e) { /* o registro é só histórico: não atrapalha o envio */ }
      }
    };
  }
  /* arquivos da última versão enviada da peça (prévias e finais, na ordem) */
  async function arquivosDesign(id) {
    try {
      const { data: vs } = await B7.sb.from('design_versoes').select('id,numero,estado').eq('deliverable_id', id).neq('estado', 'rascunho').order('numero', { ascending: false }).limit(1);
      if (!vs || !vs.length) return [];
      const { data } = await B7.sb.from('design_arquivos').select('nome_original,caminho,papel,posicao,parte_posicao,mime').eq('versao_id', vs[0].id).in('papel', ['preview', 'final', 'anexo']);
      /* zzz187: as proporções costumam vir como anexo (a prévia é uma delas):
         junta tudo que é imagem/PDF/vídeo, sem repetir a mesma arte em
         formato diferente (prefere final > anexo > prévia) */
      const peso = { final: 0, anexo: 1, preview: 2 };
      const base = n => String(n || '').replace(/\.[^.]+$/, '').toLowerCase();
      const l = (data || []).filter(a => a.caminho && /^(image|video)\/|pdf/.test(a.mime || ''))
        .sort((a, b) => peso[a.papel] - peso[b.papel]);
      const vistos = new Set(), r = [];
      l.forEach(a => { const k = base(a.nome_original); if (!vistos.has(k)) { vistos.add(k); r.push(a); } });
      return r.sort((a, b) => (a.parte_posicao || 0) - (b.parte_posicao || 0) || String(a.nome_original).localeCompare(String(b.nome_original), 'pt', { numeric: true }));
    } catch (e) { return []; }
  }
  const tamanho = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(b > 104857600 ? 0 : 1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  return { abrir, enviar, podeEnviar, icone, noPrograma: !!D, conferirGrupos, _casar: casar, _esperando: esperando, _clientes: c => { clientes = c; } };
})();
