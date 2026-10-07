/* =====================================================================
   MOVIMENTO — três assinaturas do B7 (pacote zzi, 03/10)
   Pedido do Kevin: "Faz o 1, 2 e 3".
   1. CARD QUE VIRA TELA. Tocar num item de lista (gravação, demanda de
      vídeo, status, cliente, linha do Painel…) faz o próprio cartão
      crescer até ocupar a área da tela enquanto o detalhe carrega por
      baixo; ao voltar para a lista, uma "tela" encolhe de volta para o
      cartão de onde veio, que pisca de leve ao receber o pouso.
      Não depende de API nova: é um fantasma posicionado (fixed) que
      anima posição/tamanho/cantos com Web Animations. A navegação em si
      continua sendo a de sempre (o clique segue para o handler normal).
   2. COMEMORAÇÃO. Concluir gravação, entregar vídeo, finalizar peça de
      design e o cliente aprovar soltam uma chuva curta de confete (rosa,
      violeta, branco, verde) e um selo carimbado ("Entregue!"). Gatilho
      central: as funções do banco que fazem essas ações são embrulhadas
      aqui — a festa só sai quando a ação deu certo (promessa resolvida).
   3. PUXAR PARA ATUALIZAR COM A LÂMPADA. No celular, puxar a tela para
      baixo no topo enche a lâmpada do B7 de luz conforme o dedo desce;
      soltando com ela cheia, ela "estoura" (onda de luz + vibração) e a
      tela recarrega os dados (sem recarregar a página). Se há versão
      nova esperando, aí sim recarrega a página. O puxar nativo do
      navegador fica desligado (CSS), para não brigar com este.
      zzk: anel de progresso em volta da lâmpada, legenda ("Puxe…",
      "Solte…", "Atualizando…", "Atualizado"), conteúdo descendo junto de
      verdade (`translate`) e travas para o disco nunca ficar preso na
      tela (segundo dedo, troca de tela, app em segundo plano, tela lenta).
   Tudo respeita "reduzir movimento" (1 e 2 somem; 3 funciona sem
   firula). Nada de dado ou regra muda.
   ===================================================================== */
window.B7 = window.B7 || {};

(function () {
  const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const painel = () => document.getElementById('painel-dashboard');
  const vibrar = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  /* ===================================================================
     1. CARD QUE VIRA TELA
     =================================================================== */
  const SEL_VOO = '.gl-item, .card-gravacao, .vg-ultima, .vd-m-card, .item-status, .cs-item, .pn-att, .pn-comp, ' +
                  '.vg-tile, [data-cliente]';
  const ATRIBUTOS = ['data-gravacao', 'data-demanda', 'data-abrir-status', 'data-cliente', 'data-abrir-linha', 'data-abrir-semana'];
  let pendente = null;          /* clique que ainda vai virar navegação */
  let ultimoVoo = null;         /* para o caminho de volta */

  function chaveDe(el) {
    for (const a of ATRIBUTOS) if (el.hasAttribute(a)) return '[' + a + '="' + CSS.escape(el.getAttribute(a)) + '"]';
    if (el.tagName === 'A' && el.getAttribute('href')) return 'a[href="' + CSS.escape(el.getAttribute('href')) + '"]';
    return null;
  }
  /* área onde o detalhe vai aparecer: o painel, abaixo do topo de vidro */
  function areaAlvo() {
    const p = painel();
    const r = p && p.offsetParent !== null ? p.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const topo = document.querySelector('#tela-dashboard .topo.topo-global');
    const tb = topo ? topo.getBoundingClientRect().bottom : r.top;
    const top = Math.max(r.top, Math.min(tb, r.top + 80));
    return { left: r.left, top, width: r.width, height: Math.max(120, (r.top + r.height) - top) };
  }
  const px = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });

  document.addEventListener('click', e => {
    if (reduz() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const p = painel(); if (!p) return;
    const el = e.target.closest && e.target.closest(SEL_VOO);
    if (!el || !p.contains(el)) return;
    /* tocou num botão/menu DENTRO do cartão (⋯, prévia, chips): não é abrir o cartão */
    const interno = e.target.closest('button, .menu, input, select, textarea, label, a');
    if (interno && interno !== el && el.contains(interno)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24) return;
    /* a cópia é feita AGORA: quando a navegação chega, o roteador já pode
       ter trocado a tela e o cartão original não existe mais */
    const copia = el.cloneNode(true);
    copia.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    copia.removeAttribute('id');
    const raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14;
    const tela = el.closest('.conteudo'), grupo = el.parentElement && el.parentElement.closest('.grupo-semana, .lista-status, .gl-lista, .vg-lista, .grade');
    const ctx = [tela ? tela.className : '', grupo ? grupo.className : ''].join(' ').replace(/\bentra\b/g, '');
    pendente = { el, r, copia, raio, ctx, chave: chaveDe(el), de: location.hash || '#/', t: performance.now() };
  }, true);

  function voarAbrindo(info) {
    const raio = info.raio;
    const g = document.createElement('div');
    g.className = 'b7-voo';
    g.setAttribute('aria-hidden', 'true');
    Object.assign(g.style, px(info.r), { borderRadius: raio + 'px' });
    /* a cópia vai dentro de um invólucro com as classes da tela de origem
       (estilos escopados, ex.: .ss-tela) e do grupo dela, para ficar igual */
    const miolo = document.createElement('div');
    miolo.className = info.ctx;
    miolo.appendChild(info.copia);
    info.copia.style.margin = '0';
    miolo.classList.add('b7-voo-miolo');
    miolo.style.padding = '0'; miolo.style.maxWidth = 'none'; miolo.style.background = 'none'; miolo.style.border = '0';
    Object.assign(miolo.style, { width: info.r.width + 'px', height: info.r.height + 'px', margin: '0', animation: 'none', transform: 'none', opacity: '1' });
    g.appendChild(miolo);
    document.body.appendChild(g);
    info.el.classList.add('b7-voo-origem');
    /* garantia: nunca fica preso na tela (aba em segundo plano congela animação) */
    setTimeout(() => { g.remove(); if (info.el.isConnected) info.el.classList.remove('b7-voo-origem'); }, 3000);
    const alvo = areaAlvo();
    /* zzs: antes o conteúdo do cartão se apagava e sobrava uma tela vazia
       esperando o detalhe carregar ("parece carregamento"). Agora:
       • o cartão cresce com mola, e o conteúdo dele CONTINUA visível,
         preso no alto, como o cabeçalho da tela que está abrindo;
       • enquanto o detalhe carrega, um brilho de luz varre a tela (a
         espera vira parte da animação, não um vazio);
       • quando o detalhe chega, o fantasma se dissolve com um leve zoom
         e o detalhe entra vindo de dentro dele (empurrão de câmera). */
    const DUR = 420, curva = 'cubic-bezier(.32,.72,0,1)';
    g.animate([Object.assign(px(info.r), { borderRadius: raio + 'px' }), Object.assign(px(alvo), { borderRadius: '22px' })],
      { duration: DUR, easing: curva, fill: 'forwards' });
    /* o miolo viaja junto com o canto do fantasma (fica no alto da tela) */
    miolo.animate([{ transform: 'none' }, { transform: 'translate3d(0,8px,0)' }], { duration: DUR, easing: curva, fill: 'forwards' });
    const brilho = document.createElement('i');
    brilho.className = 'b7-voo-brilho';
    g.appendChild(brilho);
    const t0 = performance.now();
    const pronto = () => {
      const pn = painel();
      const c = pn && pn.querySelector(':scope > .conteudo');
      return c && !c.querySelector(':scope > .esqueleto-tela') && performance.now() - t0 > DUR - 60;
    };
    const sair = () => {
      const c = painel() && painel().querySelector(':scope > .conteudo');
      if (c && c.animate) c.animate([{ opacity: 0, transform: 'scale(.965)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      const a = g.animate([{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0, transform: 'scale(1.03)', filter: 'blur(6px)' }],
        { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      a.onfinish = () => g.remove();
      if (info.el.isConnected) info.el.classList.remove('b7-voo-origem');
    };
    const espera = () => {
      if (pronto() || performance.now() - t0 > 2200 || document.getElementById('tela-editor')?.classList.contains('ativa') && performance.now() - t0 > DUR) sair();
      else setTimeout(espera, 40);
    };
    setTimeout(espera, DUR - 60);
    ultimoVoo = { de: info.de, chave: info.chave, quando: Date.now() };
  }

  /* volta (zzs): sem a "tela vazia" encolhendo. A lista entra como uma
     câmera recuando (de leve maior para o tamanho normal) e o cartão de
     onde se veio "pousa": vem de cima, maior e com sombra, e assenta no
     lugar dele com um anel de luz. */
  function voarVoltando(voo) {
    const t0 = performance.now();
    const procura = () => {
      const p = painel();
      const el = p && voo.chave ? p.querySelector(voo.chave) : null;
      const ok = el && el.getBoundingClientRect().height > 10 && !(p.querySelector(':scope > .conteudo > .esqueleto-tela'));
      if (ok) {
        const alvoTela = areaAlvo();
        const r0 = el.getBoundingClientRect();
        if (r0.top < alvoTela.top || r0.bottom > innerHeight - 70) p.scrollTop += r0.top - alvoTela.top - 80;
        const c = p.querySelector(':scope > .conteudo');
        if (c && c.animate) c.animate([{ transform: 'scale(1.035)', opacity: .4, filter: 'blur(3px)' }, { transform: 'none', opacity: 1, filter: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
        el.classList.add('b7-voo-pousando');
        el.animate([{ transform: 'translate3d(0,-10px,0) scale(1.06)', boxShadow: '0 30px 60px -20px rgba(40,10,70,.45)', zIndex: 6 },
                    { transform: 'none', boxShadow: '0 0 0 0 rgba(40,10,70,0)', zIndex: 6 }],
          { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)' }).onfinish = () => {
          el.classList.remove('b7-voo-pousando');
          el.classList.add('b7-voo-pouso'); setTimeout(() => el.classList.remove('b7-voo-pouso'), 700);
        };
      } else if (performance.now() - t0 < 2000) setTimeout(procura, 40);
    };
    setTimeout(procura, 30);
  }

  /* ===================================================================
     FOTO DA TELA (zzt) — o que fazia o sistema "parecer que carrega".
     Cada tela busca os dados de novo ao abrir e, enquanto isso, mostra o
     esqueleto cinza. Voltar para a lista (ou trocar de aba e voltar)
     piscava esqueleto toda vez. Agora, ao SAIR de uma tela, guardamos
     uma foto dela (o HTML já desenhado + a rolagem). Ao voltar para ela,
     a foto aparece na hora, no lugar exato, e a tela de verdade monta
     por baixo com os dados novos; quando fica pronta (sem esqueleto),
     a foto sai sem piscar. É só imagem: não recebe toque e some em no
     máximo 2,5 s, aconteça o que acontecer.
     =================================================================== */
  const fotos = new Map();                 /* hash → { html, cls, rolagem, quando } */
  const FOTO_VALE = 15 * 60 * 1000;
  let rotaVista = location.hash || '#/';
  let fotoAtual = null;
  const telaDoPainel = () => document.getElementById('tela-dashboard');
  /* esqueleto: o de B7.UI.skeleton (.esq .esq-*) e o dos blocos do Painel (<i class="esq">) —
     NÃO o .esq de "lado esquerdo" dos documentos (rodapé do Status semanal) */
  const temEsqueleto = el => !!el.querySelector('.esqueleto-tela, i.esq, .esq[class*=" esq-"]');
  function guardarFoto(hash) {
    const p = painel(), t = telaDoPainel();
    /* tela inteira ainda em esqueleto não vira foto; um bloco ou outro carregando, sim */
    if (!p || !t || !t.classList.contains('ativa') || !p.firstElementChild || p.querySelector(':scope > .conteudo > .esqueleto-tela, :scope > .esqueleto-tela')) return;
    fotos.set(hash, { html: p.innerHTML, cls: p.className, rolagem: p.scrollTop, quando: Date.now() });
    if (fotos.size > 24) fotos.delete(fotos.keys().next().value);
  }
  /* enquanto a foto está na tela, a tela de verdade monta por baixo SEM as
     animações de entrada (senão elas rodam escondidas e "repetem" quando a
     foto sai: era o desfoca-foca-desfoca do vídeo) */
  const semEntrada = liga => { const p = painel(); if (p) p.classList.toggle('b7-sem-entrada', liga); };
  function tirarFoto(rapido) {
    const f = fotoAtual; fotoAtual = null;
    if (!f) return;
    clearTimeout(f.limite);
    if (f.obs) f.obs.disconnect();
    /* a tela costuma remontar mais uma vez logo depois (segunda busca,
       tempo real): as entradas continuam desligadas por mais 1,5 s */
    clearTimeout(semEntrada.t);
    semEntrada.t = setTimeout(() => { if (!fotoAtual) semEntrada(false); }, 1500);
    if (rapido || !f.el.animate) { f.el.remove(); return; }
    /* troca seca: a tela real é igual à foto (mesma rolagem), então um
       esmaecer só mostraria as duas misturadas por um instante */
    const a = f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, easing: 'linear', fill: 'forwards' });
    a.onfinish = () => f.el.remove();
  }
  function montarFoto(foto) {
    const p = painel(), r = p.getBoundingClientRect(), cs = getComputedStyle(p);
    const el = document.createElement('div');
    el.className = foto.cls + ' b7-foto';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
      paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight });
    el.innerHTML = foto.html;
    el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    el.querySelectorAll('.entra').forEach(n => n.classList.remove('entra'));
    document.body.appendChild(el);
    el.scrollTop = foto.rolagem;
    return el;
  }
  function mostrarFoto(hash, antigo) {
    const foto = fotos.get(hash), p = painel();
    if (!foto || !p || Date.now() - foto.quando > FOTO_VALE) return null;
    tirarFoto(true);
    const el = montarFoto(foto);
    clearTimeout(semEntrada.t); semEntrada(true);
    const f = { el, hash, rolagem: foto.rolagem, antigo };
    fotoAtual = f;
    f.limite = setTimeout(() => { const pn = painel(); if (pn) pn.scrollTop = f.rolagem; tirarFoto(false); }, 3000);
    /* a tela de verdade está pronta quando o conteúdo antigo saiu e não
       há mais esqueleto: troca a foto por ela, na mesma rolagem */
    const t0 = performance.now();
    /* a tela real monta em etapas (números que sobem 5 → 7 → 9, blocos que
       chegam depois): a foto só sai quando ela está pronta E parada há
       180 ms — senão as etapas apareciam como piscadas */
    let ultimaMudanca = performance.now();
    try {
      f.obs = new MutationObserver(() => { ultimaMudanca = performance.now(); });
      f.obs.observe(p, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
    const confere = () => {
      if (fotoAtual !== f) return;
      if ((location.hash || '#/') !== hash) { tirarFoto(true); return; }
      const pn = painel();
      const trocou = pn && pn.firstElementChild && pn.firstElementChild !== antigo;
      if (trocou && !temEsqueleto(pn) && performance.now() - ultimaMudanca > 180) {
        pn.scrollTop = f.rolagem;
        /* a tela nova não refaz a entrada: a foto já fez o papel dela */
        pn.querySelectorAll(':scope > .conteudo.entra').forEach(c => c.classList.remove('entra'));
        tirarFoto(false);
      } else setTimeout(confere, 40);
    };
    setTimeout(confere, 40);
    return f;
  }
  B7.fotoDaTela = {
    guardar: guardarFoto,
    /* js/app.js, primeira linha do hashchange. O popstate do "voltar"
       chega primeiro e já fotografou a mesma navegação: a janela de
       250 ms evita serializar o painel duas vezes por ida. */
    antesDeNavegar: (de) => {
      if (performance.now() - fotografadoEm < 250) return;
      fotografar(de);
    },
    esquecer: h => h ? fotos.delete(h) : fotos.clear()
  };

  /* abrir uma tela JÁ VISTA a partir do cartão (zzu): nada de fantasma
     por cima — a própria tela de destino (a foto dela) se abre de dentro
     do retângulo do cartão, como uma janela expandindo: recorte que
     cresce do cartão até a tela inteira, com cantos arredondando */
  function abrirNaFoto(f, info) {
    const el = f.el, R = el.getBoundingClientRect(), r = info.r;
    el.scrollTop = 0; f.rolagem = 0;          /* abrir de novo começa do alto */
    const ins = [Math.max(0, r.top - R.top), Math.max(0, R.right - r.right), Math.max(0, R.bottom - r.bottom), Math.max(0, r.left - R.left)];
    const de = 'inset(' + ins.map(v => v.toFixed(0) + 'px').join(' ') + ' round ' + info.raio + 'px)';
    const ox = (r.left + r.width / 2 - R.left) + 'px', oy = (r.top + r.height / 2 - R.top) + 'px';
    el.style.transformOrigin = ox + ' ' + oy;
    /* por baixo, a tela que está saindo (a lista), parada e recuando um
       pouco — o roteador já a trocou por esqueleto, então ela vem da foto */
    const daLista = fotos.get(info.de);
    if (daLista) {
      const baixo = montarFoto(daLista);
      baixo.style.zIndex = '53';
      baixo.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.96)', opacity: .5 }],
        { duration: 400, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' }).onfinish = () => baixo.remove();
      setTimeout(() => baixo.remove(), 900);
    }
    el.animate([{ clipPath: de, transform: 'scale(.985)', boxShadow: '0 30px 80px -30px rgba(40,10,70,.55)' },
                { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'none', boxShadow: '0 0 0 0 rgba(40,10,70,0)' }],
      { duration: 420, easing: 'cubic-bezier(.32,.72,0,1)' });
    /* o cartão de origem some no mesmo instante: é ele que "vira" a tela */
    info.el.classList.add('b7-voo-origem');
    setTimeout(() => { if (info.el.isConnected) info.el.classList.remove('b7-voo-origem'); }, 600);
    ultimoVoo = { de: info.de, chave: info.chave, quando: Date.now() };
  }

  /* volta COM foto: a lista já está ali na hora. A câmera recua (de leve
     maior e desfocada para o normal) e o cartão de origem pousa na foto;
     a tela de verdade assume por baixo sem ninguém perceber */
  function voltarNaFoto(f, voo) {
    const el = voo.chave ? f.el.querySelector(voo.chave) : null;
    f.el.animate([{ transform: 'scale(1.03)' }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.32,.72,0,1)' });
    if (!el) return;
    const alvo = areaAlvo(), r0 = el.getBoundingClientRect();
    if (r0.top < alvo.top || r0.bottom > innerHeight - 70) { f.el.scrollTop += r0.top - alvo.top - 80; f.rolagem = f.el.scrollTop; }
    el.classList.add('b7-voo-pousando');
    el.animate([{ transform: 'translate3d(0,-10px,0) scale(1.06)', boxShadow: '0 30px 60px -20px rgba(40,10,70,.45)' },
                { transform: 'none', boxShadow: '0 0 0 0 rgba(40,10,70,0)' }],
      { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)' }).onfinish = () => el.classList.remove('b7-voo-pousando');
  }

  /* A foto é tirada ANTES de a navegação acontecer, e o momento é
     delicado: no hashchange já é tarde, porque js/app.js chama o roteador
     num microtask logo depois do listener DELE, que roda antes deste.

     zzz51: antes isto estava pendurado num clique em fase de captura no
     documento inteiro — ou seja, TODO toque fora de um campo de texto
     serializava o painel inteiro (`p.innerHTML`), inclusive abrir um
     filtro, marcar um chip, rolar e tocar, fechar um modal. Era o
     engasgo que o Kevin sentia: numa tela cheia de cartões isso é caro, e
     acontecia dezenas de vezes por minuto para usar UMA vez, quando enfim
     havia navegação.

     Agora a foto é tirada uma vez por NAVEGAÇÃO, em dois pontos:
       • `popstate` — o "voltar" do aparelho, que chega antes do hashchange;
       • `B7.fotoDaTela.antesDeNavegar(de)` — chamado por js/app.js como a
         primeira linha do hashchange dele, antes de o roteador rodar.
     O `de` vem de quem chama (app.js guarda o endereço anterior), então a
     chave não depende da ordem em que os listeners foram registrados. */
  let antigoNo = null;
  let fotografadoEm = 0;
  const fotografar = (hash) => {
    const p = painel();
    /* a chave é a rota que a tela MOSTRA: no popstate (e no hashchange) o
       endereço já mudou, mas a tela ainda é a antiga */
    guardarFoto(hash || rotaVista);
    antigoNo = p && p.firstElementChild;
    fotografadoEm = performance.now();
  };
  window.addEventListener('popstate', () => fotografar());
  window.addEventListener('hashchange', () => {
    const agora = location.hash || '#/';
    rotaVista = agora;
    const antigo = antigoNo; antigoNo = null;
    /* zzz7: troca de módulo com morph (View Transitions, js/app.js): o
       navegador já anima as duas telas — foto e voo ficam de fora */
    if (document.documentElement.classList.contains('b7-vt')) { pendente = null; return; }
    if (reduz()) { pendente = null; mostrarFoto(agora, antigo); return; }
    if (pendente && performance.now() - pendente.t < 450) {
      const info = pendente; pendente = null;
      /* detalhe já visitado: ele mesmo se abre do cartão; senão, o fantasma */
      const fa = mostrarFoto(agora, antigo);
      if (fa) abrirNaFoto(fa, info); else voarAbrindo(info);
      return;
    }
    pendente = null;
    const f = mostrarFoto(agora, antigo);
    if (ultimoVoo && ultimoVoo.de === agora && Date.now() - ultimoVoo.quando < 30 * 60 * 1000) {
      const voo = ultimoVoo; ultimoVoo = null;
      if (f) voltarNaFoto(f, voo); else voarVoltando(voo);
    }
  });

  /* ===================================================================
     2. COMEMORAÇÃO
     =================================================================== */
  const CORES = ['#FF4FA0', '#B03BE6', '#7C5CFF', '#FFD3EC', '#FFFFFF', '#3FD08A', '#FF8FCB'];
  function soltar(texto) {
    if (reduz()) return;
    vibrar([14, 40, 22]);
    /* confete em canvas: um quadro por frame, some sozinho */
    const cv = document.createElement('canvas');
    cv.className = 'b7-festa';
    cv.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cx = innerWidth / 2, cy = innerHeight * .42;
    const N = Math.round(Math.min(150, 70 + innerWidth / 8));
    const ps = Array.from({ length: N }, (_, i) => {
      const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25;
      const vel = 7 + Math.random() * 9;
      return { x: cx + (Math.random() - .5) * 40, y: cy + (Math.random() - .5) * 20,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 2, g: .28 + Math.random() * .12,
        r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * .35,
        cor: CORES[i % CORES.length], forma: i % 3, vida: 1 };
    });
    const t0 = performance.now(), DUR = 2000;
    const quadro = agora => {
      const t = agora - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach(p => {
        p.vx *= .985; p.vy = p.vy * .985 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const a = Math.max(0, 1 - Math.max(0, t - DUR * .55) / (DUR * .45));
        ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.cor;
        if (p.forma === 0) ctx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9);
        else if (p.forma === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r * .7, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * .35, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * .35, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      });
      if (t < DUR) requestAnimationFrame(quadro); else cv.remove();
    };
    requestAnimationFrame(quadro);
    setTimeout(() => cv.isConnected && cv.remove(), DUR + 600);   /* garantia */
    /* selo carimbado */
    if (texto) {
      const s = document.createElement('div');
      s.className = 'b7-carimbo';
      s.setAttribute('role', 'status');
      s.innerHTML = '<span class="b7-carimbo-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><b></b>';
      s.querySelector('b').textContent = texto;
      document.body.appendChild(s);
      setTimeout(() => { s.classList.add('sai'); setTimeout(() => s.remove(), 400); }, 1500);
    }
  }
  B7.Festa = { soltar };

  /* gatilhos: as funções do banco que concluem algo. Só comemora quando
     a promessa resolve (deu certo). Embrulhadas uma vez, na carga. */
  function embrulhar(nome, quando, texto) {
    const DB = B7.DB; if (!DB || typeof DB[nome] !== 'function' || DB[nome].__festa) return;
    const original = DB[nome];
    const novo = function () {
      const args = arguments;
      const r = original.apply(this, args);
      if (r && typeof r.then === 'function' && quando(args)) {
        r.then(res => {
          if (res && res.resultado === 'inalterado') return;    /* já estava assim: nada a comemorar */
          setTimeout(() => soltar(typeof texto === 'function' ? texto(args) : texto), 280);
        }).catch(() => {});
      }
      return r;
    };
    novo.__festa = true;
    DB[nome] = novo;
  }
  function ligarFesta() {
    embrulhar('gravacaoConcluir', () => true, 'Gravação concluída!');
    embrulhar('registrarEntregaVideo', () => true, 'Vídeo entregue!');
    embrulhar('mudarStatusVideo', a => a[1] === 'entregue', 'Vídeo entregue!');
    embrulhar('finalizarDesign', () => true, 'Peça finalizada!');
    embrulhar('decidirAprovacao', a => a[1] === 'aprovado', 'Aprovado!');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarFesta); else ligarFesta();

  /* ===================================================================
     3. PUXAR PARA ATUALIZAR COM A LÂMPADA
     =================================================================== */
  const LIMIAR = 72;            /* px de deslocamento visível para "encher" */
  const ROTULO = { puxa: 'Puxe para atualizar', solta: 'Solte para atualizar', vai: 'Atualizando…', ok: 'Atualizado', nova: 'Abrindo a versão nova…' };
  const ARCO = 2 * Math.PI * 20; /* circunferência do anel (r = 20) */
  let ind = null;
  function indicador() {
    if (ind && ind.isConnected) return ind;
    ind = document.createElement('div');
    ind.className = 'b7-puxa';
    ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML =
      '<span class="bp-disco">' +
        '<svg class="bp-anel" viewBox="0 0 48 48"><circle class="bp-trilho" cx="24" cy="24" r="20"/>' +
          '<circle class="bp-progresso" cx="24" cy="24" r="20" stroke-dasharray="' + ARCO.toFixed(2) + '" stroke-dashoffset="' + ARCO.toFixed(2) + '"/></svg>' +
        '<i class="bp-apagada"></i><i class="bp-acesa"></i>' +
      '</span><i class="bp-onda"></i><span class="bp-rotulo"></span>';
    document.body.appendChild(ind);
    return ind;
  }
  let y0 = 0, x0 = 0, ativo = false, puxando = false, desloc = 0, ocupado = false, alvoConteudo = null, cheiaAntes = false, fimTimer = 0;
  const podePuxar = () => {
    const p = painel();
    if (!p || p.offsetParent === null || ocupado) return false;
    if (!document.getElementById('tela-dashboard')?.classList.contains('ativa')) return false;
    if (document.querySelector('.fundo-modal:not(.saindo), .folha-mais.aberta, .b7-abertura, .tele, .apresentacao')) return false;
    return p.scrollTop <= 0;
  };
  function rotulo(chave) {
    const r = indicador().querySelector('.bp-rotulo');
    if (r.dataset.k === chave) return;
    r.dataset.k = chave; r.textContent = ROTULO[chave];
    r.classList.remove('troca'); void r.offsetWidth; r.classList.add('troca');
  }
  function posicionar(d, p) {
    const el = indicador();
    const topo = document.querySelector('#tela-dashboard .topo.topo-global');
    const base = topo ? topo.getBoundingClientRect().bottom : 0;
    el.style.setProperty('--bp-y', (base - 56 + d * .62).toFixed(1) + 'px');
    el.style.setProperty('--bp-p', p.toFixed(3));
    el.querySelector('.bp-progresso').setAttribute('stroke-dashoffset', (ARCO * (1 - p)).toFixed(2));
    const cheia = p >= 1;
    el.classList.toggle('cheia', cheia);
    if (puxando && cheia !== cheiaAntes) { rotulo(cheia ? 'solta' : 'puxa'); if (cheia) vibrar(8); }
    cheiaAntes = cheia;
    /* `translate` (e não `transform`): a animação de entrada da página usa
       transform com fill e não pode prender o conteúdo no lugar */
    if (alvoConteudo) alvoConteudo.style.translate = d ? '0 ' + d.toFixed(1) + 'px' : '';
  }
  /* devolve tudo ao lugar. Sempre termina limpo, mesmo se algo falhar no meio */
  function recolher() {
    const el = indicador();
    clearTimeout(fimTimer);
    el.classList.add('volta');
    document.documentElement.classList.remove('b7-recarga');
    if (alvoConteudo) alvoConteudo.style.transition = 'translate .6s cubic-bezier(.16,1,.3,1), opacity .35s ease, filter .35s ease';
    posicionar(0, 0);
    const alvo = alvoConteudo;
    fimTimer = setTimeout(() => {
      el.classList.remove('volta', 'estoura', 'girando', 'cheia', 'mostra', 'pronto');
      el.querySelector('.bp-rotulo').dataset.k = '';
      if (alvo) { alvo.style.transition = ''; alvo.style.translate = ''; }
      if (alvoConteudo === alvo) alvoConteudo = null;
      puxando = false; ativo = false; ocupado = false;
    }, 620);
  }
  async function estourar() {
    ocupado = true;
    const el = indicador();
    el.classList.add('estoura');
    vibrar(18);
    /* zzz32: durante a atualização quem desce é o PAINEL (que não é
       trocado), não o .conteudo — a tela nova entrava sem o deslocamento
       e subia por baixo da lâmpada, encavalando o título. O painel fica
       baixo e esmaecido até a tela nova estar pronta e então volta
       deslizando; a lâmpada assenta com mola em vez de pular. */
    const p = painel();
    if (alvoConteudo && p && alvoConteudo !== p) {
      const dAtual = alvoConteudo.style.translate;
      alvoConteudo.style.transition = 'none'; alvoConteudo.style.translate = '';
      p.style.transition = 'none'; p.style.translate = dAtual || '';
      void p.offsetWidth;
      alvoConteudo = p;
    }
    if (alvoConteudo) alvoConteudo.style.transition = 'translate .5s cubic-bezier(.16,1,.3,1), opacity .35s ease, filter .35s ease';
    document.documentElement.classList.add('b7-recarga');
    posicionar(56, 1);
    /* versão nova esperando? então recarrega a página de verdade */
    const aviso = [...document.querySelectorAll('#toasts .toast')].some(t => /Nova versão/.test(t.textContent));
    rotulo(aviso ? 'nova' : 'vai');
    setTimeout(() => el.classList.add('girando'), 380);
    if (aviso) { setTimeout(() => location.reload(), 420); return; }
    const t0 = Date.now();
    /* nunca fica preso: se a tela demorar mais de 6 s, o indicador sai assim mesmo */
    try {
      if (B7.Memoria) B7.Memoria.invalidar();   /* puxar = do banco, nunca da memória */
      /* telas que sabem atualizar "por baixo" (sem esqueleto nem
         entrada de novo) olham esta marca — ver js/video.js abrir() */
      B7.recargaSilenciosa = true;
      if (B7.Rota && B7.Rota.ir) await Promise.race([Promise.resolve(B7.Rota.ir()), new Promise(r => setTimeout(r, 6000))]);
    } catch (e) {} finally { B7.recargaSilenciosa = false; }
    /* o véu sai assim que a tela nova está pronta: os números deslizam à vista */
    document.documentElement.classList.remove('b7-recarga');
    await new Promise(r => setTimeout(r, Math.max(0, 900 - (Date.now() - t0))));
    el.classList.remove('girando');
    el.classList.add('pronto');
    rotulo('ok');
    setTimeout(recolher, 520);
  }
  /* tudo o que pode interromper um puxão no meio: volta ao lugar */
  function abortar() {
    if (ocupado) return;
    if (puxando || (ind && ind.classList.contains('mostra'))) recolher();
    ativo = false; puxando = false;
  }
  document.addEventListener('touchstart', e => {
    /* segundo dedo no meio do puxão: cancela (sem atualizar) em vez de deixar o disco preso */
    if (puxando) { ativo = false; puxando = false; recolher(); return; }
    const p = painel();
    if (e.touches.length !== 1 || !p || !p.contains(e.target) || !podePuxar()) { ativo = false; return; }
    /* começou dentro de algo que rola de lado (abas, chips, carrossel)? ok,
       o gesto vertical decide; mas dentro de campo de texto, não */
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) { ativo = false; return; }
    ativo = true; puxando = false; desloc = 0;
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!ativo || ocupado) return;
    /* zzz27: cartão do Kanban sendo arrastado no toque não é puxão */
    if (document.body.classList.contains('vd-arrastando-toque')) { abortar(); return; }
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (!puxando) {
      if (dy > 10 && dy > Math.abs(dx) * 1.4 && podePuxar()) {
        puxando = true; cheiaAntes = false;
        clearTimeout(fimTimer);
        alvoConteudo = painel().querySelector(':scope > .conteudo');
        if (alvoConteudo) alvoConteudo.style.transition = 'none';
        const el = indicador();
        el.classList.remove('volta', 'estoura', 'girando', 'pronto');
        el.classList.add('mostra');
        rotulo('puxa');
      } else if (dy < -4 || Math.abs(dx) > 14) { ativo = false; return; }
      else return;
    }
    /* resistência: quanto mais puxa, menos anda */
    desloc = 124 * (1 - Math.exp(-Math.max(0, dy - 10) / 140));
    posicionar(desloc, Math.min(1, desloc / LIMIAR));
  }, { passive: true });
  function fim() {
    if (!ativo && !puxando) return;
    ativo = false;
    if (!puxando) return;
    puxando = false;
    if (desloc >= LIMIAR) estourar(); else recolher();
  }
  document.addEventListener('touchend', fim, { passive: true });
  document.addEventListener('touchcancel', fim, { passive: true });
  window.addEventListener('hashchange', abortar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortar(); });

  /* ===================================================================
     4. KANBAN COM FÍSICA (zzj)
     No lugar da "foto" padrão do navegador ao arrastar, um cartão de
     verdade segue o cursor e INCLINA conforme a velocidade de lado (como
     segurar um papel), voltando a ficar reto quando a mão para. Ao soltar,
     o cartão no lugar novo "assenta" com mola. Só apresentação: o arrastar
     e o mover continuam sendo os de kanban.js / video.js.
     =================================================================== */
  const IMG_VAZIA = new Image();
  IMG_VAZIA.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function arrastoFisico(card, e) {
    if (reduz() || !e || !e.dataTransfer || !e.dataTransfer.setDragImage) return null;
    const r = card.getBoundingClientRect();
    const f = card.cloneNode(true);
    f.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    f.removeAttribute('id');
    f.classList.add('b7-arrasto');
    f.classList.remove('arrastando');
    Object.assign(f.style, { width: r.width + 'px', height: r.height + 'px' });
    try { e.dataTransfer.setDragImage(IMG_VAZIA, 0, 0); } catch (er) { return null; }
    /* zzz61: a cópia herdava a animação de entrada do cartão (nascia
       invisível, com atraso) e só andava quando o navegador mandava um
       "dragover" — que chega aos soluços. Agora o dragover só anota onde
       o cursor está; quem move a cópia é um laço por quadro, que a
       aproxima do alvo com amortecimento. Fica fluido mesmo com eventos
       espaçados, e a inclinação vem da velocidade real da cópia. */
    f.style.animation = 'none'; f.style.opacity = '1';
    f.style.backdropFilter = 'none'; f.style.webkitBackdropFilter = 'none';
    const offX = e.clientX - r.left, offY = e.clientY - r.top;
    let x = r.left, y = r.top, ax = x, ay = y, rot = 0, sc = 1, quadro = 0, vivo = true, t0 = performance.now();
    const pinta = () => { f.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')'; };
    pinta();
    document.body.appendChild(f);
    const passo = t => {
      if (!vivo) return;
      /* amortecimento independente da taxa de quadros */
      const dt = Math.min(48, t - t0) / 16.67; t0 = t;
      const k = 1 - Math.pow(1 - .34, dt);
      const dx = (ax - x) * k; x += dx; y += (ay - y) * k;
      rot += (Math.max(-9, Math.min(9, dx * .9)) - rot) * (1 - Math.pow(1 - .18, dt));
      sc += (1.04 - sc) * (1 - Math.pow(1 - .22, dt));
      pinta();
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    const segue = ev => {
      if (!ev.clientX && !ev.clientY) return;             /* evento sem coordenada (fim do arrasto) */
      ax = ev.clientX - offX; ay = ev.clientY - offY;
    };
    document.addEventListener('dragover', segue, true);
    return {
      fim() {
        vivo = false; cancelAnimationFrame(quadro);
        document.removeEventListener('dragover', segue, true);
        /* termina onde o cursor soltou, endireitando, e some */
        const de = f.style.transform;
        x = ax; y = ay; rot = 0; sc = .96; pinta();
        const a = f.animate([{ opacity: 1, transform: de }, { opacity: 0, transform: f.style.transform }],
          { duration: 170, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
        a.onfinish = () => f.remove();
        setTimeout(() => f.remove(), 500);
      }
    };
  }
  function assentar(el) {
    if (!el || reduz()) return;
    el.classList.remove('b7-assenta'); void el.offsetWidth; el.classList.add('b7-assenta');
    setTimeout(() => el.classList.remove('b7-assenta'), 750);
  }

  /* ===================================================================
     5. ARRASTAR DE LADO (zzk/zzl) — usado pelo Calendário e pelas
     Publicações do Dia. O elemento devolvido por `alvo()` segue o dedo
     (com resistência); passou de 56 px, chama aoIr(+1 | -1). Gesto
     vertical não é tocado (rolagem e "puxar para atualizar" seguem).
     =================================================================== */
  /* Algo entre o dedo e `limite` rola de lado (carrossel, abas, faixa
     de chips)? Então o gesto é desse elemento, não de "trocar de dia". */
  function rolaDeLado(alvo, limite) {
    for (let n = alvo; n && n !== limite && n.nodeType === 1; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  }
  /* opcoes.area: seletor — o gesto só vale se começar dentro dele */
  function deslizar(el, alvo, aoIr, opcoes) {
    if (!el || el._deslize) return; el._deslize = true;
    const area = opcoes && opcoes.area;
    let x0 = null, y0 = 0, dx = 0, modo = null, t0 = 0;
    el.addEventListener('touchstart', e => {
      x0 = null; modo = null; dx = 0;
      if (e.touches.length !== 1) { modo = 'nao'; return; }
      const t = e.target;
      if (area && !(t.closest && t.closest(area))) { modo = 'nao'; return; }
      if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) { modo = 'nao'; return; }
      if (rolaDeLado(t, el)) { modo = 'nao'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (modo === 'nao' || x0 === null) return;
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!modo) {
        if (Math.abs(mx) > 14 && Math.abs(mx) > Math.abs(my) * 1.6) modo = 'x';
        else { if (Math.abs(my) > 10) modo = 'nao'; return; }
      }
      dx = mx;
      const a = alvo(); if (!a) return;
      /* resistência suave: anda menos quanto mais longe vai */
      const d = Math.sign(dx) * 90 * (1 - Math.exp(-Math.abs(dx) / 160));
      a.style.transition = 'none';
      a.style.translate = d.toFixed(1) + 'px 0';
      a.style.opacity = String(1 - Math.min(.35, Math.abs(d) / 260));
    }, { passive: true });
    const fim = () => {
      const eraX = modo === 'x';
      /* passou de 64 px, ou foi um "peteleco" rápido de 36 px */
      const rapido = Date.now() - t0 < 260 && Math.abs(dx) > 36;
      const ok = eraX && (Math.abs(dx) > 64 || rapido);
      const a = alvo();
      modo = null; x0 = null;
      if (!a || !eraX) return;
      if (!ok) {
        a.style.transition = 'translate .34s cubic-bezier(.2,.9,.25,1.2), opacity .3s ease';
        a.style.translate = ''; a.style.opacity = '';
        setTimeout(() => { a.style.transition = ''; }, 360);
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      vibrar(6);
      /* o conteúdo atual sai para o lado do gesto; o novo entra do outro */
      let foi = false;
      const ir = () => {
        if (foi) return; foi = true;
        aoIr(dir);
        /* se a troca não redesenhou (ex.: nada a trocar), devolve ao lugar */
        if (a.isConnected) { a.getAnimations().forEach(x => x.cancel()); a.style.translate = ''; a.style.opacity = ''; a.style.transition = ''; }
      };
      if (reduz() || !a.animate) { ir(); return; }
      const ani = a.animate([{ translate: a.style.translate || '0 0', opacity: a.style.opacity || 1 },
                             { translate: (dir > 0 ? -70 : 70) + 'px 0', opacity: 0 }],
        { duration: 140, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      ani.onfinish = ir;
      setTimeout(ir, 220);
    };
    el.addEventListener('touchend', fim, { passive: true });
    el.addEventListener('touchcancel', fim, { passive: true });
  }
  B7.Movimento = { soltar, voarAbrindo: info => voarAbrindo(info), arrastoFisico, assentar, deslizar };
})();
