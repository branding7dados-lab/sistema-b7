/* =====================================================================
   COMPONENTES DE INTERFACE
   Toasts, modais, confirmação, menus, dica flutuante e utilitários.
   Nada de alert() nas ações comuns.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.UI = (function () {
  const esc = t => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ------------------------------------------------------------ toasts */
  function toast(msg, opcoes = {}) {
    const cx = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (opcoes.tipo === 'erro' ? ' erro' : '');
    el.innerHTML = '<span>' + esc(msg) + '</span>';
    if (opcoes.acao) {
      const b = document.createElement('button');
      b.className = 'acao';
      b.textContent = opcoes.acao;
      b.onclick = () => { fecha(); opcoes.aoClicar && opcoes.aoClicar(); };
      el.appendChild(b);
    }
    cx.appendChild(el);
    const tempo = opcoes.tempo || (opcoes.acao ? 7000 : 3200);
    const t = setTimeout(fecha, tempo);
    function fecha() {
      clearTimeout(t);
      el.classList.add('saindo');
      setTimeout(() => el.remove(), 200);
    }
    return fecha;
  }

  /* ------------------------------------------------------------ modais */
  function modal(html, opcoes = {}) {
    const anterior = document.activeElement;      // para devolver o foco ao fechar
    const fundo = document.createElement('div');
    fundo.className = 'fundo-modal' + (opcoes.classe ? ' ' + opcoes.classe : '');
    fundo.innerHTML = '<div class="modal' + (opcoes.larga ? ' larga' : '') +
      (opcoes.extra ? ' ' + opcoes.extra : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', tecla);

    const focaveis = () => [...fundo.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),' +
      ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);

    function tecla(e) {
      if (e.key === 'Escape') return fechar();
      if (e.key !== 'Tab') return;
      /* foco preso dentro do modal enquanto ele estiver aberto */
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0], ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
    function fechar() {
      document.removeEventListener('keydown', tecla);
      fundo.remove();
      if (anterior && anterior.focus) anterior.focus();
      opcoes.aoFechar && opcoes.aoFechar();
    }
    fundo.fechar = fechar;
    document.body.appendChild(fundo);
    fundo.querySelectorAll('[data-fecha]').forEach(b => b.onclick = fechar);
    const foco = fundo.querySelector('[data-foco]');
    if (foco) { foco.focus(); if (foco.select) foco.select(); }
    return fundo;
  }

  /* Devolve uma Promise que resolve true no Confirmar e false no Cancelar,
     em qualquer forma de fechar o modal.

     Antes esta função devolvia o próprio modal. Quem escrevia
     `if (await confirmar(...))` recebia um objeto — sempre verdadeiro — e a
     ação acontecia na hora, com a caixa de confirmação ainda na tela. Foi
     assim que exclusões passaram sem ninguém confirmar nada.

     O callback `aoConfirmar` continua funcionando para as chamadas antigas,
     e `confirmar` é aceito como apelido de `rotulo`. */
  /* Caixa de texto de uma pergunta só. Resolve com o texto digitado,
     string vazia se a pessoa confirmou sem escrever, ou null se
     cancelou — três respostas diferentes, porque "não quis dizer nada"
     não é o mesmo que "desistiu". */
  function perguntar({ titulo, rotulo, placeholder = '', confirmar = 'Enviar' }) {
    let resolver;
    const promessa = new Promise(r => { resolver = r; });
    let decidido = false;

    const m = modal('<h3>' + esc(titulo) + '</h3>' +
      (rotulo ? '<div class="sub">' + esc(rotulo) + '</div>' : '') +
      '<textarea class="campo alta" id="pg-texto" rows="3" data-foco ' +
        'placeholder="' + esc(placeholder) + '"></textarea>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>' + esc(confirmar) + '</button></div>',
      { aoFechar: () => { if (!decidido) { decidido = true; resolver(null); } } });

    m.querySelector('[data-ok]').onclick = () => {
      decidido = true;
      const t = m.querySelector('#pg-texto').value.trim();
      m.fechar();
      resolver(t);
    };
    return promessa;
  }

  function confirmar(opcoes) {
    const { titulo, texto, perigo = false, aoConfirmar } = opcoes || {};
    const rotulo = opcoes.rotulo || opcoes.confirmar || 'Confirmar';
    let resolver;
    const promessa = new Promise(r => { resolver = r; });
    let decidido = false;

    const m = modal(
      '<h3>' + esc(titulo) + '</h3><div class="sub">' + esc(texto) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri' + (perigo ? ' perigo' : '') + '" data-ok data-foco>' +
      esc(rotulo) + '</button></div>',
      /* fechar pelo X, pelo fundo ou pelo Esc conta como cancelar */
      { aoFechar: () => { if (!decidido) { decidido = true; resolver(false); } } });

    m.querySelector('[data-ok]').onclick = () => {
      decidido = true;
      m.fechar();
      resolver(true);
      if (typeof aoConfirmar === 'function') aoConfirmar();
    };
    /* a Promise também expõe fechar(), para quem guardava o modal */
    promessa.fechar = () => m.fechar();
    return promessa;
  }

  /* ------------------------------------------------------------- menus */
  /* =================================================================
     MENUS SUSPENSOS
     O dropdown era posicionado com `absolute` dentro do card. Sempre que o
     ancestral tinha overflow:hidden — capa da linha editorial, card de
     gravação, cabeçalho — o menu era cortado ou aparecia no lugar errado.
     Agora ele é posicionado em coordenadas de tela (fixed), calculadas na
     hora de abrir. Não depende mais de nenhum ancestral.
     ================================================================= */
  /* Um ancestral com `transform` (o card tem, no hover) vira o bloco de
     referência de qualquer position:fixed dentro dele — e o menu aparecia
     deslocado centenas de pixels. A única saída confiável é tirar a lista
     de dentro do card enquanto ela estiver aberta: ela vai para o body e
     volta para o lugar ao fechar. */
  let menuAberto = null;

  function fecharMenus() {
    document.querySelectorAll('.menu.aberto').forEach(m => m.classList.remove('aberto', 'para-cima'));
    if (menuAberto) {
      const { menu, lista } = menuAberto;
      lista.removeAttribute('style');
      lista.classList.remove('solta', 'mostrando', 'acima');
      /* Se a tela redesenhou enquanto o menu estava aberto, o dono saiu do
         documento. Devolver a lista a um nó órfão a deixaria flutuando na
         tela para sempre — nesse caso ela é descartada. */
      if (menu.isConnected) menu.appendChild(lista);
      else lista.remove();
      menuAberto = null;
    }
    /* rede de segurança: qualquer lista que tenha sobrado solta no body de
       um render anterior sai junto */
    document.querySelectorAll('body > .lista').forEach(l => l.remove());
  }

  function posicionarMenu(menu, botao) {
    const lista = menu.querySelector('.lista');
    if (!lista) return;
    const MARGEM = 10;

    /* sai do card e passa a viver na raiz, livre de transform de ancestral */
    lista.classList.add('solta');
    lista.style.position = 'fixed';
    lista.style.left = '0px';
    lista.style.top = '0px';
    lista.style.right = 'auto';
    lista.style.maxHeight = '';
    document.body.appendChild(lista);
    menuAberto = { menu, lista };

    const r = botao.getBoundingClientRect();
    const alturaLista = lista.offsetHeight;
    const larguraLista = lista.offsetWidth;

    let left = r.right - larguraLista;                    /* alinhado à direita do botão */
    left = Math.max(MARGEM, Math.min(left, window.innerWidth - larguraLista - MARGEM));

    const espacoAbaixo = window.innerHeight - r.bottom - MARGEM;
    const espacoAcima = r.top - MARGEM;
    let top;
    if (alturaLista <= espacoAbaixo || espacoAbaixo >= espacoAcima) {
      top = r.bottom + 6;
      if (alturaLista > espacoAbaixo) lista.style.maxHeight = espacoAbaixo + 'px';
      lista.classList.remove('acima');
    } else {
      top = Math.max(MARGEM, r.top - alturaLista - 6);
      if (alturaLista > espacoAcima) lista.style.maxHeight = espacoAcima + 'px';
      lista.classList.add('acima');
    }

    lista.style.left = Math.round(left) + 'px';
    lista.style.top = Math.round(top) + 'px';
    lista.style.overflowY = lista.style.maxHeight ? 'auto' : '';
    /* a classe de abertura entra depois da posição, para a animação nascer
       no lugar certo em vez de deslizar da posição antiga */
    requestAnimationFrame(() => lista.classList.add('mostrando'));
  }

  function ligarMenus(raiz = document) {
    /* a tela acabou de ser montada: nenhum menu deve continuar aberto de
       antes, e nenhuma lista órfã deve ter sobrado na tela */
    fecharMenus();
    raiz.querySelectorAll('.menu > button').forEach(b => {
      if (b.dataset.ligado) return;
      b.dataset.ligado = '1';
      b.addEventListener('click', e => {
        e.stopPropagation();
        const menu = b.parentElement;
        const jaAberto = menu.classList.contains('aberto');
        fecharMenus();
        if (jaAberto) return;
        menu.classList.add('aberto');
        posicionarMenu(menu, b);
      });
    });
  }

  document.addEventListener('click', fecharMenus);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMenus(); });
  /* rolar ou redimensionar com o menu aberto deixaria ele flutuando solto */
  window.addEventListener('resize', fecharMenus);
  window.addEventListener('scroll', fecharMenus, true);

  /* ------------------------------------------------------------- dica */
  let dicaEl = null;
  function dica(alvo, texto) {
    esconderDica();
    if (!texto) return;
    dicaEl = document.createElement('div');
    dicaEl.className = 'dica';
    dicaEl.textContent = texto;
    document.body.appendChild(dicaEl);
    const r = alvo.getBoundingClientRect();
    dicaEl.style.left = Math.min(window.innerWidth - dicaEl.offsetWidth - 10, r.right + 10) + 'px';
    dicaEl.style.top = (r.top + r.height / 2 - dicaEl.offsetHeight / 2) + 'px';
  }
  function esconderDica() { if (dicaEl) { dicaEl.remove(); dicaEl = null; } }

  /* --------------------------------------------------------- utilidades */
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d + '/' + m + '/' + a;
  }
  function mesRotulo(iso) {
    if (!iso) return 'Sem data';
    const [a, m] = String(iso).slice(0, 10).split('-');
    return (MESES[+m - 1] || '') + ' ' + a;
  }
  function quando(iso) {
    if (!iso) return '';
    const d = new Date(iso), agora = new Date();
    const seg = (agora - d) / 1000;
    if (seg < 60) return 'agora há pouco';
    if (seg < 3600) return 'há ' + Math.floor(seg / 60) + ' min';
    if (d.toDateString() === agora.toDateString()) return 'hoje às ' + d.toTimeString().slice(0, 5);
    const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return 'ontem';
    if (seg < 604800) return 'há ' + Math.floor(seg / 86400) + ' dias';
    return d.toLocaleDateString('pt-BR');
  }
  /* ------------------------------------------------- avatar do cliente
     Um lugar só decide entre logo e iniciais. Usado no dashboard, na
     lista de clientes, nas gravações, na busca e na paleta.
     A logo do cliente nunca é recolorida, cortada ou distorcida. */
  function avatarCliente(nome, logoUrl, classe) {
    const cls = 'avatar' + (classe ? ' ' + classe : '');
    if (logoUrl) {
      return '<div class="' + cls + ' com-logo"><img src="' + esc(logoUrl) + '" alt="' + esc(nome || '') + '" ' +
        'onerror="this.parentElement.classList.remove(\'com-logo\');' +
        'this.parentElement.textContent=this.dataset.ini" data-ini="' + esc(iniciais(nome)) + '"></div>';
    }
    return '<div class="' + cls + '">' + esc(iniciais(nome)) + '</div>';
  }

  /* Avatar de PESSOA sem foto: iniciais de nome + sobrenome e um tom da
     paleta escolhido pelo nome — a mesma pessoa tem sempre a mesma cor,
     e duas pessoas na mesma lista raramente ficam iguais. */
  function tomDoNome(nome) {
    let h = 0; const s = String(nome || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 6;
  }
  function avatarPessoa(u, classe) {
    const nome = (u && (u.nome || u.username)) || '?';
    const cls = 'av-pessoa' + (classe ? ' ' + classe : '');
    if (u && u.avatar_url) {
      return '<div class="' + cls + ' com-foto"><img src="' + esc(u.avatar_url) + '" alt="" ' +
        'onerror="this.parentElement.classList.remove(\'com-foto\');' +
        'this.parentElement.textContent=this.dataset.ini" data-ini="' + esc(iniciais(nome)) + '"></div>';
    }
    return '<div class="' + cls + ' tom-' + tomDoNome(nome) + '" title="' + esc(nome) + '">' +
      '<span>' + esc(iniciais(nome)) + '</span></div>';
  }

  /* "Mercato Sadia" → MS · "ClimaPro" → CP · "Águas Mucugê" → ÁM
     Nome de uma palavra só usa a maiúscula interna quando existe
     (ClimaPro, AutoEscola); sem ela, cai nas duas primeiras letras. */
  function iniciais(nome) {
    const limpo = (nome || '?').trim();
    if (!limpo) return '?';
    const partes = limpo.split(/\s+/).filter(Boolean);
    if (partes.length > 1) return (partes[0][0] + partes[1][0]).toUpperCase();
    const interna = partes[0].slice(1).match(/[A-ZÀ-Þ0-9]/);
    return (partes[0][0] + (interna ? interna[0] : (partes[0][1] || ''))).toUpperCase();
  }
  function classeStatus(s) {
    if (s === 'Gravado') return 'gravado';
    if (s === 'Pronto para gravar') return 'pronto';
    return 'rascunho';
  }
  /* estágios do roteiro (revisão) — linguagem visual própria, sem neon */
  const REVISAO = ['Em criação', 'Em revisão', 'Aprovado internamente', 'Pronto para gravar', 'Gravado'];
  const CLASSE_REVISAO = {
    'Em criação': 'criacao', 'Em revisão': 'revisao', 'Aprovado internamente': 'aprovado',
    'Pronto para gravar': 'pronto', 'Gravado': 'gravado'
  };
  function chipRevisao(s) {
    const v = s || 'Em criação';
    return '<span class="chip-revisao ' + (CLASSE_REVISAO[v] || 'criacao') + '">' + esc(v) + '</span>';
  }

  function chipStatus(s) {
    return '<span class="chip-status ' + classeStatus(s) + '">' + esc(s || 'Rascunho') + '</span>';
  }
  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }
  function autoAltura(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

  /* ------------------------------------------------ paleta de comandos */
  /* Ctrl+K: ações e busca de cliente, gravação e roteiro no mesmo lugar.
     Navegação por ↑ ↓ Enter Esc. */
  const ICP = {
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/></svg>',
    grav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    rot:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.5V9h5"/></svg>'
  };

  function paleta() {
    /* Smart actions: o que a paleta oferece depende de onde a pessoa está.
       Dentro de uma linha editorial, "novo conteúdo" é o que ela quer. */
    const rota = location.hash || '';
    const emLinha = /^#\/linha\/([^/?]+)/.exec(rota);
    const emCliente = /^#\/cliente\/([^/?]+)/.exec(rota);
    const contextuais = [];

    if (emLinha && window.B7.Linha && window.B7.BaixarLinha) {
      contextuais.push(
        { ic: ICP.mais, rot: 'Novo conteúdo', dica: 'nesta linha editorial',
          fn: () => B7.Linha.novoConteudo() },
        { ic: ICP.rot, rot: 'Baixar linha editorial', dica: 'gerar o documento',
          fn: () => B7.BaixarLinha.abrir(emLinha[1]) },
        { ic: ICP.rot, rot: 'Duplicar mês', dica: 'copiar para outro mês',
          fn: () => B7.Linha.duplicar() });
    }
    if (emCliente) {
      const id = emCliente[1];
      contextuais.push(
        { ic: ICP.mais, rot: 'Nova linha editorial', dica: 'planejar um mês',
          fn: () => { location.hash = '#/cliente/' + id + '/linhas'; } },
        { ic: ICP.mais, rot: 'Nova ideia', dica: 'guardar no banco de ideias',
          fn: () => { location.hash = '#/cliente/' + id + '/ideias'; } },
        { ic: ICP.mais, rot: 'Novo onboarding', dica: 'contexto do mês',
          fn: () => { location.hash = '#/cliente/' + id + '/onboarding'; } },
        { ic: ICP.pessoa, rot: 'Abrir inteligência', dica: 'contexto da marca',
          fn: () => { location.hash = '#/cliente/' + id + '/inteligencia'; } });
    }


    const acoes = contextuais.concat([
      { ic: ICP.mais,   rot: 'Novo status semanal', dica: 'acompanhamento de sete dias',
        fn: () => B7.Semana.modalNovo(emCliente ? emCliente[1] : null) },
      { ic: ICP.rot,    rot: 'Abrir status semanal', dica: 'lista de semanas',
        fn: () => { location.hash = '#/semanas'; } },
      { ic: ICP.mais,   rot: 'Nova gravação',  dica: 'começar um grupo de roteiros', fn: () => B7.Dashboard.modalNovaGravacao() },
      { ic: ICP.pessoa, rot: 'Novo cliente',   dica: 'cadastrar um cliente',         fn: () => B7.Dashboard.modalNovoCliente() },
      { ic: ICP.grav,   rot: 'Ir para clientes', dica: 'todos os workspaces',        fn: () => { location.hash = '#/clientes'; } },
      { ic: ICP.grav,   rot: 'Ver gravações',  dica: 'todas as gravações',           fn: () => { location.hash = '#/gravacoes'; } },
      { ic: ICP.play,   rot: 'Configurações',  dica: 'tema, densidade e dados',      fn: () => { location.hash = '#/config'; } },
      { ic: ICP.play,   rot: 'Alternar tema',  dica: 'claro ou escuro',              fn: () => B7.alternarTema && B7.alternarTema() }
    ]);

    const m = modal(
      '<div class="busca-cp"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="cp-in" data-foco placeholder="Buscar ou executar uma ação…"></div>' +
      '<div class="cp-lista" id="cp-lista"></div>' +
      '<div class="cp-pe"><span><kbd>↑↓</kbd>navegar</span><span><kbd>Enter</kbd>abrir</span>' +
      '<span><kbd>Esc</kbd>fechar</span></div>', { classe: 'paleta' });

    const entrada = m.querySelector('#cp-in');
    const lista = m.querySelector('#cp-lista');
    let itens = [], foco = 0;

    function pintar(html, novosItens) {
      lista.innerHTML = html;
      itens = novosItens;
      foco = 0;
      marcar();
      [...lista.querySelectorAll('.cp-item')].forEach((b, i) => b.onclick = () => executar(i));
    }
    function marcar() {
      [...lista.querySelectorAll('.cp-item')].forEach((b, i) => b.classList.toggle('ativo', i === foco));
      const ativo = lista.querySelector('.cp-item.ativo');
      if (ativo) ativo.scrollIntoView({ block: 'nearest' });
    }
    function executar(i) {
      const it = itens[i];
      if (!it) return;
      m.fechar();
      it.fn();
    }
    const linha = (ic, titulo, sub) =>
      '<button class="cp-item"><div class="ic">' + ic + '</div><div><b>' + esc(titulo) +
      '</b><small>' + esc(sub) + '</small></div></button>';

    /* sem nada digitado, a paleta funciona como launcher: o que foi mexido
       por último vem primeiro, depois as ações */
    async function inicial() {
      let html = '', itens = [];
      try {
        const [gravacoes, clientes] = await Promise.all([
          B7.DB.gravacoesRecentes(3), B7.DB.listarClientes()
        ]);
        const cli = clientes
          .sort((a, b) => String(b.ultima_atividade).localeCompare(String(a.ultima_atividade)))
          .slice(0, 2);
        if (gravacoes.length || cli.length) {
          html += '<div class="cp-grupo">RECENTES</div>';
          gravacoes.forEach(g => {
            html += linha(ICP.grav, g.nome, g.cliente_nome + ' · editado ' + quando(g.updated_at));
            itens.push({ fn: () => { location.hash = '#/gravacao/' + g.id; } });
          });
          cli.forEach(c => {
            html += linha(c.logo_url
              ? '<img src="' + esc(c.logo_url) + '" style="width:100%;height:100%;object-fit:contain">'
              : '<span>' + esc(iniciais(c.nome)) + '</span>', c.nome, 'abrir workspace');
            itens.push({ fn: () => { location.hash = '#/cliente/' + c.id; } });
          });
        }
      } catch (e) { /* sem banco: só as ações */ }
      html += '<div class="cp-grupo">AÇÕES</div>' + acoes.map(a => linha(a.ic, a.rot, a.dica)).join('');
      pintar(html, itens.concat(acoes));
    }

    function mostrarAcoes(filtro) {
      const f = (filtro || '').toLowerCase();
      const lst = acoes.filter(a => !f || (a.rot + ' ' + a.dica).toLowerCase().includes(f));
      pintar('<div class="cp-grupo">AÇÕES</div>' + lst.map(a => linha(a.ic, a.rot, a.dica)).join(''), lst);
    }
    inicial();

    const procurar = debounce(async termo => {
      if (!termo.trim()) return inicial();
      const acoesFiltradas = acoes.filter(a => (a.rot + ' ' + a.dica).toLowerCase().includes(termo.toLowerCase()));
      let html = '', novos = [];
      if (acoesFiltradas.length) {
        html += '<div class="cp-grupo">AÇÕES</div>' + acoesFiltradas.map(a => linha(a.ic, a.rot, a.dica)).join('');
        novos = novos.concat(acoesFiltradas);
      }
      try {
        const r = await B7.DB.buscar(termo);
        if (r.clientes.length) {
          html += '<div class="cp-grupo">CLIENTES</div>' + r.clientes.map(c =>
            linha(c.logo_url ? '<img src="' + esc(c.logo_url) + '" style="width:100%;height:100%;object-fit:contain">'
                             : '<span>' + esc(iniciais(c.nome)) + '</span>', c.nome,
              c.total_gravacoes + ' gravaç' + (c.total_gravacoes === 1 ? 'ão' : 'ões'))).join('');
          novos = novos.concat(r.clientes.map(c => ({ fn: () => { location.hash = '#/cliente/' + c.id; } })));
        }
        if (r.gravacoes.length) {
          html += '<div class="cp-grupo">GRAVAÇÕES</div>' + r.gravacoes.map(g =>
            linha(ICP.grav, g.nome, g.cliente_nome)).join('');
          novos = novos.concat(r.gravacoes.map(g => ({ fn: () => { location.hash = '#/gravacao/' + g.id; } })));
        }
        if (r.roteiros.length) {
          html += '<div class="cp-grupo">ROTEIROS</div>' + r.roteiros.map(t =>
            linha(ICP.rot, t.titulo || 'Sem título', 'abrir na gravação')).join('');
          novos = novos.concat(r.roteiros.map(t => ({
            fn: () => { location.hash = '#/gravacao/' + t.recording_session_id + '?roteiro=' + t.id; } })));
        }
        if ((r.linhas || []).length) {
          html += '<div class="cp-grupo">LINHAS EDITORIAIS</div>' + r.linhas.map(l =>
            linha(ICP.rot, l.nome || 'Linha editorial', l.cliente_nome)).join('');
          novos = novos.concat(r.linhas.map(l => ({ fn: () => { location.hash = '#/linha/' + l.id; } })));
        }
        if ((r.conteudos || []).length) {
          html += '<div class="cp-grupo">CONTEÚDOS</div>' + r.conteudos.map(c =>
            linha(ICP.rot, c.titulo || 'Sem título', c.tipo)).join('');
          novos = novos.concat(r.conteudos.map(c => ({
            fn: () => { location.hash = '#/linha/' + c.linha_id + '/criativos'; } })));
        }
        if ((r.ideias || []).length) {
          html += '<div class="cp-grupo">IDEIAS</div>' + r.ideias.map(i =>
            linha(ICP.rot, i.titulo || 'Sem título', i.status)).join('');
          novos = novos.concat(r.ideias.map(i => ({
            fn: () => { location.hash = '#/cliente/' + i.client_id + '/ideias'; } })));
        }
        if ((r.semanas || []).length) {
          html += '<div class="cp-grupo">STATUS SEMANAL</div>' + r.semanas.map(w =>
            linha(ICP.rot, w.cliente_nome,
              B7.DocSemana.periodoTexto(w.semana_inicio, w.semana_fim) +
              ' · ' + w.total_itens + ' demandas')).join('');
          novos = novos.concat(r.semanas.map(w => ({
            fn: () => { location.hash = '#/semana/' + w.id; } })));
        }
      } catch (e) { /* sem banco: só as ações */ }
      pintar(html || '<div class="nada" style="padding:26px;text-align:center;color:var(--ink-3)">Nada encontrado</div>', novos);
    }, 220);

    entrada.oninput = () => procurar(entrada.value);
    entrada.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); foco = Math.min(foco + 1, itens.length - 1); marcar(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); foco = Math.max(foco - 1, 0); marcar(); }
      if (e.key === 'Enter')     { e.preventDefault(); executar(foco); }
    };
  }

  async function recentes() {
    try {
      const lista = await B7.DB.gravacoesRecentes(8);
      if (!lista.length) return toast('Nenhuma gravação ainda');
      const m = modal('<h3>Gravações recentes</h3><div class="sub">Escolha onde continuar.</div>' +
        '<div class="corpo">' + lista.map(g =>
          '<button class="cp-item" data-id="' + esc(g.id) + '"><div class="ic">' + ICP.grav + '</div>' +
          '<div><b>' + esc(g.nome) + '</b><small>' + esc(g.cliente_nome) + ' · ' + g.total_roteiros +
          ' roteiro' + (g.total_roteiros === 1 ? '' : 's') + ' · editado ' + quando(g.updated_at) +
          '</small></div></button>').join('') + '</div>' +
        '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
      m.querySelectorAll('.cp-item').forEach(b => b.onclick = () => {
        m.fechar(); location.hash = '#/gravacao/' + b.dataset.id;
      });
    } catch (e) { toast('Não consegui buscar as gravações', { tipo: 'erro' }); }
  }

  /* lista de atalhos, para quem quiser trabalhar sem tirar a mão do teclado */
  function atalhos() {
    const linha = (t, d) => '<div style="display:flex;align-items:center;gap:12px;padding:10px 2px;' +
      'border-bottom:1px solid var(--borda)"><kbd style="font-family:inherit;background:var(--suave);' +
      'border-radius:6px;padding:4px 9px;font-size:12px;font-weight:600;min-width:74px;text-align:center">' +
      t + '</kbd><span style="font-size:13.5px;color:var(--ink-2)">' + d + '</span></div>';
    modal('<h3>Atalhos</h3><div class="sub">As letras funcionam quando você não está digitando ' +
      'em nenhum campo.</div>' +
      '<div class="corpo">' +
      linha('Ctrl K', 'ações rápidas e busca') +
      linha('/', 'ir para a busca do topo') +
      linha('N', 'nova gravação') +
      linha('C', 'novo cliente') +
      linha('F', 'modo foco (no editor)') +
      linha('P', 'imprimir (no editor)') +
      linha('Ctrl S', 'forçar o salvamento agora') +
      linha('?', 'abrir esta lista') +
      linha('Esc', 'fechar janela aberta') +
      '</div><div class="acoes"><button class="b pri" data-fecha>Entendi</button></div>');
  }

  /* =================================================================
     SKELETON
     O que aparece entre a troca de rota e a chegada dos dados. Reproduz
     a silhueta da tela que vem a seguir — nunca um spinner de tela cheia
     nem a abertura de novo: aquela é só do arranque.

       skeleton('linhas', { n: 4 })          → parágrafo de linhas
       skeleton('cards',  { n: 6 })          → grade de cards
       skeleton('tabela', { n: 6, cols: 4 }) → linhas de tabela
       skeleton('lista',  { n: 5 })          → itens com avatar + texto
       skeleton('pagina', { titulo: true })  → cabeçalho + linhas + cards
       skeleton('central')                   → hero + métricas + colunas

     Todas devolvem HTML; quem chama coloca dentro de .conteudo.
     ================================================================= */
  function skeleton(tipo, o = {}) {
    const n = o.n || 0;
    const bloco = (cls, estilo) => '<div class="esq ' + cls + '"' + (estilo ? ' style="' + estilo + '"' : '') + '></div>';
    const linhas = (q, larguras) => '<div class="esq-linhas">' +
      Array.from({ length: q }, (_, i) =>
        bloco('esq-linha', 'width:' + (larguras ? larguras[i % larguras.length] : [92, 74, 84, 58][i % 4]) + '%')).join('') +
      '</div>';
    const cards = q => '<div class="esq-grade">' +
      Array.from({ length: q }, () => '<div class="esq-card">' + bloco('esq-capa') +
        linhas(2, [70, 45]) + '</div>').join('') + '</div>';
    const lista = q => '<div class="esq-lista">' +
      Array.from({ length: q }, () => '<div class="esq-item">' + bloco('esq-av') +
        '<div class="esq-tx">' + bloco('esq-linha', 'width:46%') + bloco('esq-linha fina', 'width:28%') + '</div></div>').join('') +
      '</div>';
    const tabela = (q, cols) => '<div class="esq-tabela">' +
      Array.from({ length: q }, () => '<div class="esq-tr">' +
        Array.from({ length: cols }, (_, c) => bloco('esq-linha', 'width:' + (c === 0 ? 80 : 55) + '%')).join('') +
        '</div>').join('') + '</div>';
    const titulo = o.titulo === false ? '' :
      '<div class="esq-cab">' + bloco('esq-titulo') + bloco('esq-linha fina', 'width:34%') + '</div>';

    let corpo;
    switch (tipo) {
      case 'linhas':  corpo = linhas(n || 5); break;
      case 'cards':   corpo = titulo + cards(n || 6); break;
      case 'lista':   corpo = titulo + lista(n || 5); break;
      case 'tabela':  corpo = titulo + tabela(n || 6, o.cols || 4); break;
      case 'central': corpo = bloco('esq-hero') +
        '<div class="esq-metricas">' + bloco('esq-metrica').repeat(4) + '</div>' +
        '<div class="esq-colunas"><div>' + cards(4) + '</div><div>' + bloco('esq-apoio') + '</div></div>';
        break;
      case 'detalhe': corpo = titulo + bloco('esq-capa grande') + linhas(4) + cards(3); break;
      default:        corpo = titulo + linhas(3) + cards(n || 3);
    }
    return '<div class="esqueleto-tela" role="status" aria-live="polite" aria-label="Carregando…">' + corpo + '</div>';
  }

  return { atalhos, avatarCliente, avatarPessoa, iniciais, tomDoNome, chipRevisao, REVISAO, CLASSE_REVISAO, esc, toast, modal, confirmar, perguntar, ligarMenus, dica, esconderDica, MESES, paleta,
           dataBR, mesRotulo, quando, iniciais, chipStatus, classeStatus, hojeISO, debounce, autoAltura, skeleton };
})();
