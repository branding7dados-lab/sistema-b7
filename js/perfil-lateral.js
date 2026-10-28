/* =====================================================================
   PERFIL NA BARRA LATERAL (zzz270)

   A conta saiu do topo (no computador) e virou um cartão no pé da barra
   lateral, logo acima do "Visualizar como…": foto, nome, função e o
   status. Tocar abre um painel ao lado com:
     • Meu status — Disponível, Em gravação, Em reunião, Ausente, Não
       perturbe — e um recado curto. A equipe vê a bolinha. "Não perturbe"
       segura os avisos como o horário de silêncio (o banco decide:
       em_silencio olha o status).
     • Meu dia — o que é meu para hoje, atrasado e as gravações de hoje
       (meu_dia), cada número leva à tela certa.
     • Atalhos — perfil, configurações, tema, ajuda, atalhos e sair.
   No celular a barra lateral é gaveta: o topo continua com o avatar de
   sempre (js/topo.js), e o mesmo painel abre como folha.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PerfilLateral = (function () {
  const esc = s => B7.UI.esc(s);
  const STATUS = [
    ['disponivel', 'Disponível', '#22C55E'],
    ['gravacao', 'Em gravação', '#A855F7'],
    ['reuniao', 'Em reunião', '#F59E0B'],
    ['ausente', 'Ausente', '#94A3B8'],
    ['nao_perturbe', 'Não perturbe', '#EF4444']
  ];
  const corDe = s => (STATUS.find(x => x[0] === s) || STATUS[0])[2];
  const rotDe = s => (STATUS.find(x => x[0] === s) || STATUS[0])[1];
  const sv = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    setas: sv('<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>'),
    config: sv('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/>'),
    tema: sv('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    ajuda: sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>'),
    teclado: sv('<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>'),
    suporte: sv('<path d="M4.5 18.5V12a7.5 7.5 0 0 1 15 0v6.5"/><rect x="3" y="13" width="4" height="6" rx="1.6"/><rect x="17" y="13" width="4" height="6" rx="1.6"/>'),
    super: sv('<path d="M4 17l2-9 4 4 2-6 2 6 4-4 2 9z"/><path d="M4 20h16"/>'),
    sair: sv('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>')
  };
  let estado = { status: 'disponivel', recado: '' }, dia = null, aberto = null;

  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const souEquipe = () => { const u = eu(); return !!u && u.papel !== 'cliente'; };
  const funcoes = u => (B7.Topo && B7.Topo.funcoesDoUsuario ? B7.Topo.funcoesDoUsuario(u) : '') || 'Equipe B7';

  function avatar(u, classe) {
    const html = B7.UI.avatarPessoa ? B7.UI.avatarPessoa(u, 'pf-av ' + (classe || '')) : '';
    return html.replace(/<\/div>$/, '<i class="pf-ponto" style="--pf-cor:' + corDe(estado.status) + '" aria-hidden="true"></i></div>');
  }

  /* ----------------------------------------------------------- cartão */
  function montar() {
    const pe = document.querySelector('.lateral .pe-lateral');
    const velho = document.getElementById('pf-card');
    if (!pe || !souEquipe()) { if (velho) velho.remove(); document.body.classList.remove('perfil-lateral'); return; }
    const u = eu();
    const card = velho || document.createElement('button');
    card.type = 'button'; card.id = 'pf-card'; card.className = 'pf-card';
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-label', 'Sua conta: ' + (u.nome || u.username) + ' · ' + rotDe(estado.status));
    card.innerHTML = avatar(u) +
      '<span class="pf-tx"><b>' + esc(u.nome || u.username) + '</b><small>' +
        esc((funcoes(u).split(' · ')[0] || '') + ' · ' + (estado.recado || rotDe(estado.status))) + '</small></span>' + IC.setas;
    card.onclick = e => { e.stopPropagation(); aberto ? fechar() : abrir(); };
    if (!velho) pe.insertBefore(card, pe.firstChild);
    document.body.classList.add('perfil-lateral');
    if (!montar._lido) { montar._lido = true; lerEstado(); }
  }

  async function lerEstado() {
    const u = eu(); if (!u || !B7.sb) return;
    try {
      const { data } = await B7.sb.from('perfis').select('status_presenca, status_recado').eq('id', u.id).maybeSingle();
      if (data) { estado = { status: data.status_presenca || 'disponivel', recado: data.status_recado || '' }; montar(); }
    } catch (e) { /* sem a coluna ainda: fica Disponível */ }
  }

  /* ----------------------------------------------------------- painel */
  function htmlPainel() {
    const u = eu();
    const sup = B7.Auth.superadmin && B7.Auth.superadmin();
    const outro = !!(B7.Auth.naContaDeOutro && B7.Auth.naContaDeOutro());
    const temaAtual = (() => { let t = null; try { t = localStorage.getItem('b7_tema'); } catch (e) {} return t === 'dark' || t === 'light' ? t : 'sistema'; })();
    const num = (n, rot, ir, cls) => '<button type="button" class="pf-num' + (cls || '') + '" data-ir-pf="' + ir + '"><b>' + (dia ? n : '–') + '</b><small>' + rot + '</small></button>';
    return '<div class="pf-painel">' +
      '<div class="pf-topo">' + avatar(u, 'pf-av-g') +
        '<div class="pf-quem"><b>' + esc(u.nome || u.username) + '</b><small>' + esc(funcoes(u)) + (sup && !outro ? ' · ' + (sup === 'supremo' ? 'Admin supremo' : 'Super admin') : '') + '</small></div>' +
        '<button type="button" class="pf-editar" data-pf="perfil">Editar perfil</button></div>' +
      '<div class="pf-rot">Meu status</div>' +
      '<div class="pf-st" role="radiogroup" aria-label="Meu status">' + STATUS.map(([k, r, c]) =>
        '<button type="button" role="radio" aria-checked="' + (k === estado.status) + '" class="' + (k === estado.status ? 'on' : '') + '" data-st="' + k + '" style="--pf-cor:' + c + '"><i></i>' + r + '</button>').join('') + '</div>' +
      '<input class="pf-recado" id="pf-recado" maxlength="80" placeholder="Recado curto (ex.: volto às 15h)" value="' + esc(estado.recado) + '" aria-label="Recado do status">' +
      (estado.status === 'nao_perturbe' ? '<p class="pf-dica">Os avisos ficam guardados no sino, sem som. Ao voltar, chega um resumo.</p>' : '') +
      '<div class="pf-rot">Meu dia</div>' +
      '<div class="pf-dia">' + num(dia && dia.hoje, 'para hoje', '#/painel') + num(dia && dia.atrasadas, 'atrasadas', '#/painel', dia && dia.atrasadas ? ' at' : '') +
        num(dia && dia.gravacoes, 'gravações hoje', '#/calendario') + '</div>' +
      '<div class="pf-rot">Atalhos</div>' +
      '<div class="pf-lista">' +
        (B7.Perm && B7.Perm.podeRota('config') ? '<button type="button" class="pf-it" data-pf="config">' + IC.config + 'Preferências e configurações</button>' : '') +
        (sup && !outro ? '<button type="button" class="pf-it" data-pf="super">' + IC.super + 'Super admin</button>' : '') +
        '<div class="pf-it pf-tema-l">' + IC.tema + 'Tema<div class="pf-tema" role="radiogroup" aria-label="Tema">' +
          [['light', 'Claro'], ['dark', 'Escuro'], ['sistema', 'Auto']].map(([k, r]) => '<button type="button" role="radio" aria-checked="' + (k === temaAtual) + '" class="' + (k === temaAtual ? 'on' : '') + '" data-tema="' + k + '">' + r + '</button>').join('') + '</div></div>' +
        '<button type="button" class="pf-it" data-pf="ajuda">' + IC.ajuda + 'Ajuda e tutoriais</button>' +
        '<button type="button" class="pf-it" data-pf="suporte">' + IC.suporte + 'Suporte e feedback</button>' +
        '<button type="button" class="pf-it pf-so-pc" data-pf="atalhos">' + IC.teclado + 'Atalhos de teclado<span>?</span></button>' +
        '<div class="pf-sep"></div>' +
        '<button type="button" class="pf-it pf-sair" data-pf="sair">' + IC.sair + (outro ? 'Voltar para minha conta' : 'Sair da conta') + '</button>' +
      '</div></div>';
  }

  const ACOES = {
    perfil: () => (B7.Perfil ? B7.Perfil.abrir() : B7.Auth.abrirPerfil()),
    config: () => { location.hash = '#/config'; },
    super: () => { location.hash = '#/config?s=super-painel'; },
    ajuda: () => { location.hash = '#/ajuda'; },
    suporte: () => { location.hash = '#/suporte'; },
    atalhos: () => B7.UI.atalhos(),
    sair: () => B7.Auth.sair()
  };

  function ligar(raiz) {
    raiz.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { const k = b.dataset.pf; fechar(); ACOES[k] && ACOES[k](); });
    raiz.querySelectorAll('[data-ir-pf]').forEach(b => b.onclick = () => { fechar(); location.hash = b.dataset.irPf; });
    raiz.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => {
      if (B7.definirTema) B7.definirTema(b.dataset.tema);
      raiz.querySelectorAll('[data-tema]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
    });
    const rec = raiz.querySelector('#pf-recado');
    raiz.querySelectorAll('[data-st]').forEach(b => b.onclick = () => salvar(b.dataset.st, rec ? rec.value : estado.recado, raiz));
    if (rec) {
      rec.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); salvar(estado.status, rec.value, raiz); rec.blur(); } };
      rec.onchange = () => salvar(estado.status, rec.value, raiz);
    }
  }

  async function salvar(status, recado, raiz) {
    const antes = Object.assign({}, estado);
    estado = { status, recado: String(recado || '').trim() };
    repintar(raiz); montar();
    try {
      await B7.DB.rpc('meu_status_definir', { p_status: status, p_recado: estado.recado || null });
      if (status !== antes.status) B7.UI.toast('Status: ' + rotDe(status) + (status === 'nao_perturbe' ? '. Os avisos ficam guardados no sino.' : '.'), { tipo: 'ok' });
    } catch (e) {
      estado = antes; repintar(raiz); montar();
      B7.UI.toast((e && e.message) || 'Não foi possível mudar o status.', { tipo: 'erro' });
    }
  }
  function repintar(raiz) {
    if (!raiz || !raiz.isConnected) return;
    const foco = document.activeElement && document.activeElement.id === 'pf-recado';
    raiz.innerHTML = htmlPainel(); ligar(raiz);
    if (foco) { const r = raiz.querySelector('#pf-recado'); if (r) { r.focus(); r.setSelectionRange(r.value.length, r.value.length); } }
  }

  async function lerDia(raiz) {
    try { dia = await B7.DB.rpc('meu_dia', {}); } catch (e) { dia = null; }
    repintar(raiz);
  }

  const ehCelular = () => window.matchMedia('(max-width: 760px)').matches;
  function abrir() {
    const card = document.getElementById('pf-card');
    if (!card) return;
    if (ehCelular()) {
      const m = B7.UI.modal('<div class="pf-folha"></div>', { classe: 'tp-folha', aoFechar: () => { aberto = null; } });
      const raiz = m.querySelector('.pf-folha');
      raiz.innerHTML = htmlPainel(); ligar(raiz);
      aberto = { fechar: () => m.fechar() };
      lerDia(raiz);
      return;
    }
    const pop = document.createElement('div');
    pop.className = 'pf-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Sua conta');
    pop.innerHTML = htmlPainel();
    document.body.appendChild(pop);
    ligar(pop);
    posicionar(pop, card);
    card.classList.add('on'); card.setAttribute('aria-expanded', 'true');
    const fora = e => { if (!pop.contains(e.target) && !card.contains(e.target)) fechar(); };
    const tecla = e => { if (e.key === 'Escape') { fechar(); card.focus(); } };
    setTimeout(() => { document.addEventListener('pointerdown', fora, true); document.addEventListener('keydown', tecla, true); }, 0);
    const reposicionar = () => posicionar(pop, card);
    addEventListener('resize', reposicionar);
    aberto = { fechar: () => {
      document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', tecla, true);
      removeEventListener('resize', reposicionar);
      card.classList.remove('on'); card.setAttribute('aria-expanded', 'false');
      pop.classList.add('saindo'); setTimeout(() => pop.remove(), 160);
    } };
    lerDia(pop);
  }
  function posicionar(pop, card) {
    const r = card.getBoundingClientRect();
    pop.style.left = Math.round(r.right + 12) + 'px';
    pop.style.bottom = Math.max(12, Math.round(innerHeight - r.bottom)) + 'px';
  }
  function fechar() { if (aberto) { const a = aberto; aberto = null; a.fechar(); } }
  addEventListener('hashchange', fechar);

  return { montar, abrir, fechar, STATUS };
})();
