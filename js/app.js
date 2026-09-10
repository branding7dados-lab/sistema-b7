/* =====================================================================
   BOOT + ROTAS
   #/                 → dashboard
   #/cliente/<id>     → gravações daquele cliente
   #/gravacao/<id>    → editor  (?roteiro=<id> abre num roteiro específico)
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Rota = (function () {
  let atual = '';

  function mostrar(tela) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(tela).classList.add('ativa');
  }

  /* Limpeza ao sair da rota. Uma tela que assina Realtime ou liga um
     timer registra aqui como desligar; a próxima troca de rota chama
     tudo o que ficou pendente. Sem isto, cada visita à mesma tela
     somava mais um canal aberto. */
  let limpezas = [];
  function aoSair(fn) { if (typeof fn === 'function') limpezas.push(fn); }
  function limpar() {
    const fila = limpezas; limpezas = [];
    fila.forEach(fn => { try { fn(); } catch (e) {} });
  }

  async function ir() {
    limpar();
    /* no celular a sidebar é uma gaveta: navegar fecha a gaveta */
    if (B7.fecharGaveta) B7.fecharGaveta(); else document.body.classList.remove('gaveta');
    const bruto = location.hash || '#/';
    atual = bruto;
    const [caminho, query] = bruto.slice(1).split('?');
    const partes = caminho.split('/').filter(Boolean);
    const params = new URLSearchParams(query || '');

    /* Guarda de rota: esconder o menu não basta, o endereço digitado à mão
       também precisa recusar. A regra vive em um lugar só (B7.Perm), para
       uma tela nova não nascer aberta a todo mundo por esquecimento. */
    if (B7.Perm && !B7.Perm.podeRota(partes[0] || '')) {
      mostrar('tela-dashboard');
      return B7.Dashboard.semPermissao(partes[0] || '');
    }

    /* Rotas do Portal: o cliente tem telas próprias, não versões
       reduzidas das internas. */
    if (B7.Auth && B7.Auth.ehCliente() && B7.Portal) {
      mostrar('tela-dashboard');
      if (!partes[0])                    return B7.Portal.abrirHome();
      if (partes[0] === 'aprovacoes')    return B7.Portal.abrirAprovacoes();
      /* cada rota abre a sua lista, com o filtro que lhe cabe — antes
         todas caíam na mesma tela, o que fazia o menu parecer quebrado */
      if (partes[0] === 'minha-linha')   return B7.Portal.abrirLinha();
      if (partes[0] === 'minha-producao')return B7.Portal.abrirProducao();
      if (partes[0] === 'meus-status')   return B7.Portal.abrirStatus();
      if (partes[0] === 'historico')     return B7.Portal.abrirHistorico();
      if (partes[0] === 'revisar' && partes[1]) return B7.Portal.abrirRevisao(partes[1]);
      if (partes[0] === 'revisar')       return B7.Portal.abrirAprovacoes();
      return B7.Portal.abrirHome();
    }

    B7.UI.esconderDica();

    /* #/diaria/ era o endereço da versão anterior; redireciona para não
       quebrar links que alguém já tenha guardado */
    if (partes[0] === 'diaria' && partes[1]) {
      location.replace('#/gravacao/' + partes[1] + (query ? '?' + query : ''));
      return;
    }
    if (partes[0] === 'gravacao' && partes[1]) {
      mostrar('tela-editor');
      document.querySelectorAll('.nav a').forEach(a =>
        a.classList.toggle('on', a.dataset.ir === '#/gravacoes'));
      if (B7.moverTrilha) B7.moverTrilha();
      document.body.dataset.aba = document.body.dataset.aba || 'editor';
      await B7.Editor.abrir(partes[1], params.get('roteiro'));
      if (params.get('imprimir')) setTimeout(() => B7.Editor.imprimir(), 350);
      return;
    }
    if (partes[0] === 'cliente' && partes[1]) {
      mostrar('tela-dashboard');
      /* #/cliente/<id>/inteligencia · /onboarding · /linhas */
      if (partes[2] === 'inteligencia') return B7.Conteudo.abrirInteligencia(partes[1]);
      if (partes[2] === 'onboarding')   return B7.Conteudo.abrirOnboarding(partes[1]);
      if (partes[2] === 'linhas')       return B7.Conteudo.abrirLinhas(partes[1]);
      if (partes[2] === 'ideias')       return B7.Conteudo.abrirIdeias(partes[1]);
      await B7.Dashboard.abrirCliente(partes[1]);
      return;
    }
    if (partes[0] === 'linha' && partes[1]) {
      mostrar('tela-dashboard');
      return B7.Linha.abrir(partes[1], partes[2]);
    }
    if (partes[0] === 'linhas') { mostrar('tela-dashboard'); return B7.Conteudo.abrirLinhasGlobais(); }
    if (partes[0] === 'kanban') { mostrar('tela-dashboard'); return B7.Kanban.abrir(); }
    if (partes[0] === 'aprovacoes' && B7.Aprovacoes) {
      mostrar('tela-dashboard');
      return partes[1] ? B7.Aprovacoes.abrirDetalhe(partes[1]) : B7.Aprovacoes.abrir();
    }
    if (partes[0] === 'usuarios') { mostrar('tela-dashboard'); return B7.Usuarios.abrir(); }
    if (partes[0] === 'semanas') { mostrar('tela-dashboard'); return B7.Semana.abrirLista(); }
    if (partes[0] === 'semana' && partes[1]) { mostrar('tela-dashboard'); return B7.Semana.abrir(partes[1]); }
    if (partes[0] === 'config')     { mostrar('tela-dashboard'); return B7.Dashboard.abrirConfig(); }
    if (partes[0] === 'lixeira')    { mostrar('tela-dashboard'); return B7.Dashboard.abrirLixeira(); }
    if (partes[0] === 'arquivados') { mostrar('tela-dashboard'); return B7.Dashboard.abrirArquivados(); }
    if (partes[0] === 'clientes')  { mostrar('tela-dashboard'); return B7.Dashboard.abrirClientes(); }
    if (partes[0] === 'gravacoes') { mostrar('tela-dashboard'); return B7.Dashboard.abrirGravacoes(); }
    if (partes[0] === 'roteiros')  { mostrar('tela-dashboard'); return B7.Dashboard.abrirRoteiros(); }
    mostrar('tela-dashboard');
    await B7.Central.abrir();
  }

  function recarregar() {
    const h = location.hash;
    if (h.startsWith('#/gravacao/')) location.hash = '#/';
    else ir();
  }

  window.addEventListener('hashchange', () => {
    /* garante que nada digitado se perca ao trocar de tela */
    B7.Save.agora().finally(ir);
  });

  /* título da aba acompanha o contexto */
  function titulo(partes) {
    document.title = partes && partes.length ? partes.join(' · ') + ' · Roteiros B7' : 'Roteiros B7';
  }

  return { ir, recarregar, titulo, aoSair };
})();


/* ===================================================== inicialização */
(function iniciar() {
  /* =================================================================
     ABERTURA
     Cobre o intervalo entre entrar e o sistema estar montado. Some com
     transição, para a troca não ser um corte seco.
     ================================================================= */
  /* A abertura é do arranque (e do instante entre o login e a montagem
     do sistema). Depois disso ela não volta: troca de rota usa os
     skeletons de B7.UI.skeleton, nunca esta tela. */
  let arranqueConcluido = false;
  function abrirCortina(titulo, texto) {
    if (arranqueConcluido) return null;
    let el = document.querySelector('.b7-abertura');
    if (el && el.classList.contains('saindo')) { el.remove(); el = null; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'b7-abertura';
      el.innerHTML = '<div class="fundo"><span class="a"></span><span class="b"></span><span class="c"></span>' +
          '<i class="p p1"></i><i class="p p2"></i><i class="p p3"></i>' +
          '<i class="p p4"></i><i class="p p5"></i><i class="p p6"></i></div>' +
        '<div class="nucleo">' +
          '<svg class="giro" viewBox="0 0 200 200" aria-hidden="true">' +
            '<defs><linearGradient id="abGrad2" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0" stop-color="#3A1E86" stop-opacity="0"/>' +
              '<stop offset=".45" stop-color="#7C1E85"/>' +
              '<stop offset="1" stop-color="#FF6FB5"/></linearGradient></defs>' +
            '<circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>' +
            '<circle cx="100" cy="100" r="92" fill="none" stroke="url(#abGrad2)" stroke-width="2.5" ' +
              'stroke-linecap="round" stroke-dasharray="330 248" transform="rotate(-90 100 100)"/>' +
          '</svg><div class="marca"></div></div>' +
        '<div class="txt"><b>' + B7.UI.esc(titulo || 'Branding7') + '</b>' +
        B7.UI.esc(texto || 'Preparando o seu espaço…') + '</div>' +
        '<div class="barra"><i></i></div>';
      document.body.appendChild(el);
    } else {
      const t = el.querySelector('.txt');
      if (t) t.innerHTML = '<b>' + B7.UI.esc(titulo || 'Branding7') + '</b>' +
        B7.UI.esc(texto || 'Preparando o seu espaço…');
    }
    return el;
  }

  function fecharCortina() {
    if (jaMontado) arranqueConcluido = true;
    const el = document.querySelector('.b7-abertura');
    if (!el || el.classList.contains('saindo')) return;
    el.classList.add('saindo');
    /* espera a transição antes de remover: tirar na hora devolve o corte
       seco que a cortina existe para evitar */
    setTimeout(() => el.remove(), 520);
  }
  B7.abrirCortina = abrirCortina;
  B7.fecharCortina = fecharCortina;

  /* Mostra quem está logado, ou o caminho para entrar. Sem sessão e sem
     serviço publicado, não aparece nada: um botão que não leva a lugar
     nenhum é pior do que botão nenhum. */
  function pintarSessao() {
    const alvo = document.getElementById('area-sessao');
    if (!alvo || !B7.Auth) return;
    const u = B7.Auth.usuario();
    if (u) {
      const rotulo = { admin: 'Administrador', coordenador: 'Coordenador de mídias',
                       cliente: 'Cliente' }[u.papel] || u.papel;
      const tom = ' tom-' + B7.UI.tomDoNome(u.nome || u.username);
      const foto = u.avatar_url
        ? '<img src="' + B7.UI.esc(u.avatar_url) + '" alt="">'
        : '<span>' + B7.UI.esc(B7.UI.iniciais(u.nome || u.username)) + '</span>';
      alvo.innerHTML = '<div class="menu sessao-menu"><button class="ico-sessao av-pessoa' +
        (u.avatar_url ? ' com-foto' : tom) + '" ' +
        'title="' + B7.UI.esc(u.nome) + '" aria-label="Sua conta">' + foto + '</button>' +
        '<div class="lista">' +
          '<div class="sessao-cab">' +
            '<div class="sessao-av av-pessoa' + (u.avatar_url ? ' com-foto' : tom) + '">' +
              foto + '</div>' +
            '<div class="sessao-tx"><b>' + B7.UI.esc(u.nome) + '</b>' +
            '<span>@' + B7.UI.esc(u.username) + '</span></div>' +
          '</div>' +
          '<div class="sessao-papel ' + B7.UI.esc(u.papel) + '">' + B7.UI.esc(rotulo) + '</div>' +
          '<hr>' +
          '<button data-perfil>Editar perfil</button>' +
          (B7.Perm && B7.Perm.podeConfig('usuarios')
            ? '<button data-ir="#/usuarios">Usuários e acessos</button>' : '') +
          (B7.Perm && B7.Perm.podeRota('config')
            ? '<button data-ir="#/config">Configurações</button>' : '') +
          '<hr>' +
          '<button class="perigo" data-sair>Sair da conta</button>' +
        '</div></div>';
      B7.UI.ligarMenus(alvo);
      alvo.querySelectorAll('[data-sair]').forEach(b => b.onclick = () => B7.Auth.sair());
      alvo.querySelectorAll('[data-perfil]').forEach(b => b.onclick = () =>
        /* um perfil só: dois modais diferentes para a mesma coisa era o
           motivo de a foto aparecer num caminho e não no outro */
        (B7.Perfil ? B7.Perfil.abrir() : B7.Auth.abrirPerfil()));
    } else if (B7.acessoIndisponivel) {
      /* Só aparece na situação em que o sistema abriu sem login porque o
         serviço de acesso não respondeu. Fora dela, a tela de login já
         está na frente e um botão "Entrar" seria redundante. */
      alvo.innerHTML = '<button class="b p" id="bt-entrar">Entrar</button>';
      const b = document.getElementById('bt-entrar');
      if (b) b.onclick = () => B7.Auth.telaLogin();
    } else {
      alvo.innerHTML = '';
    }
  }
  B7.pintarSessao = function () {
    pintarSessao();
    if (B7.Notif) B7.Notif.montar();
    if (B7.Presenca) B7.Presenca.iniciar();
  };

  /* Itens marcados com data-papel só existem para quem tem aquele papel.
     Some da tela, não fica desabilitado: uma opção com cadeado só serve
     para lembrar a pessoa do que ela não pode fazer. */
  function aplicarPapelNaNavegacao() {
    const admin = B7.Auth && B7.Auth.ehAdmin();
    document.querySelectorAll('[data-papel="admin"]').forEach(el => {
      el.style.display = admin ? '' : 'none';
    });
    /* grupo sem nenhum item visível também some */
    document.querySelectorAll('.nav .grupo').forEach(g => {
      let algum = false, n = g.nextElementSibling;
      while (n && !n.classList.contains('grupo')) {
        if (n.style.display !== 'none') algum = true;
        n = n.nextElementSibling;
      }
      if (!algum) g.style.display = 'none';
    });
  }
  B7.aplicarPapelNaNavegacao = aplicarPapelNaNavegacao;
  B7.aoEntrar = async () => {
    const u = B7.Auth.usuario();
    abrirCortina('Bem-vindo' + (u && u.nome ? ', ' + u.nome.split(' ')[0] : ''),
                 'Preparando o seu espaço…');
    B7.pintarSessao();
    /* Monta o sistema aqui mesmo. Nada de recarregar: a sessão já está em
       memória e válida, e esperar que ela chegue ao armazenamento antes de
       recarregar era exatamente o que produzia o laço. */
    B7.Auth.anotar('aoEntrar', 'montando sem recarregar');
    /* O layout do portal é montado ANTES de montarSistema, que é quem
       liga os cliques da sidebar. Montar de novo depois recriaria os
       links sem handler — a sidebar ficava morta até recarregar. */
    if (B7.Auth.ehCliente() && B7.Portal) B7.Portal.montarLayout();
    await B7.montarSistema();
    if (!(B7.Auth.ehCliente() && B7.Portal) && B7.Perm) B7.Perm.aplicarNavegacao();
    B7.pintarSessao();

    /* A persistência ainda importa para a próxima visita — só que agora
       é um aviso, não um bloqueio. */
    fecharCortina();
    const persiste = await B7.Auth.sessaoPersiste();
    B7.Auth.anotar('aoEntrar', 'persiste=' + persiste);
    if (!persiste) {
      B7.UI.toast('Você entrou, mas este navegador não guardou a sessão: ' +
        'na próxima visita o login será pedido de novo.', { tipo: 'erro', tempo: 9000 });
    }
  };

  /* O corpo do arranque, separado do evento: assim o sistema pode ser
     montado logo após o login, sem recarregar a página. Recarregar era o
     ponto frágil — dependia de a sessão já ter sido gravada no
     armazenamento, o que nem sempre terminou a tempo. */
  let jaMontado = false;
  async function montarSistema() {
    if (jaMontado) return;
    jaMontado = true;
    B7.Auth && B7.Auth.anotar('app', 'montando o sistema');
    await arrancar();
  }
  B7.montarSistema = montarSistema;

  /* Tudo que monta a interface. Chamado no arranque quando já há sessão,
     ou logo depois do login — sem recarregar a página. */
  async function arrancar() {

    /* ---- configuração ausente: explica em vez de quebrar ---- */
    document.body.classList.remove('apurando');   /* sem banco, mostra o setup */
    if (!B7.configurado || !B7.sb) {
      if (B7.motivoConfig === 'painel') {
        document.querySelector('#setup h2').textContent = 'URL errada no config.js';
        document.querySelector('#setup p').innerHTML =
          'O endereço em <code>js/config.js</code> é o do painel do Supabase, não o do projeto. ' +
          'O certo termina em <b>.supabase.co</b> e está em Project Settings → API → Project URL:';
      }
      document.getElementById('setup').classList.add('ativo');
      fecharCortina();
      return;
    }

    /* Rede de segurança: aconteça o que acontecer, a abertura não fica
       na frente para sempre. */
    setTimeout(fecharCortina, 12000);

    document.body.classList.remove('apurando');

    /* ---- topo: dashboard ---- */
    const busca = document.getElementById('campo-busca');
    const caixaRes = document.getElementById('resultados-busca');
    busca.addEventListener('input', () => B7.Dashboard.buscar(busca.value, caixaRes));
    busca.addEventListener('focus', () => { if (busca.value.trim()) caixaRes.classList.add('aberto'); });
    document.addEventListener('click', e => {
      if (!e.target.closest('.busca')) caixaRes.classList.remove('aberto');
    });
    const ligarTopo = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    ligarTopo('bt-nova-gravacao', () => B7.Dashboard.modalNovaGravacao());
    document.getElementById('mn-novo-cliente').onclick = () => B7.Dashboard.modalNovoCliente();
    document.getElementById('mn-paleta').onclick = () => B7.UI.paleta();
    document.getElementById('mn-exportar').onclick = () => B7.Backup.exportar();
    document.getElementById('mn-importar').onclick = () => B7.Backup.importar();

    /* ---- topo: editor ---- */
    ligarTopo('bt-voltar', () => { location.hash = '#/'; });
    document.getElementById('ed-status').onclick = () => B7.Editor.menuStatus();
    ligarTopo('bt-imprimir', () => B7.Editor.imprimir());
    ligarTopo('bt-baixar', () => B7.Editor.baixar());
    ligarTopo('mn-ed-baixar', () => B7.Editor.baixar());   /* no celular o botão do topo some */
    document.getElementById('mn-ed-apresentar').onclick = () => B7.Editor.apresentar();
    document.getElementById('mn-ed-arquivar').onclick = () =>
      B7.Dashboard.arquivarGravacao(B7.Editor.estado.gravacao.id, true);
    document.getElementById('mn-ed-dados').onclick = () => B7.Editor.editarGravacao();
    document.getElementById('mn-ed-foco').onclick = () => B7.Editor.modoFoco();
    ligarTopo('bt-foco', () => B7.Editor.modoFoco());
    document.getElementById('mn-ed-novo').onclick = () => B7.Editor.novoRoteiro();
    document.getElementById('mn-ed-exportar').onclick = () => B7.Backup.exportar();
    document.getElementById('mn-ed-excluir').onclick = () =>
      B7.Dashboard.excluirGravacao(B7.Editor.estado.gravacao.id);

    /* ---- zoom ---- */
    document.getElementById('zoom-menos').onclick = () => B7.Editor.zoom(-0.08);
    document.getElementById('zoom-mais').onclick = () => B7.Editor.zoom(0.08);
    document.getElementById('zoom-ajustar').onclick = () => B7.Editor.zoomAjustar();

    /* ---- abas do celular ---- */
    document.querySelectorAll('.abas button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.abas button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.body.dataset.aba = b.dataset.aba;
      B7.Editor.aplicarZoom();
    });

    /* ---- navegação por data-ir, em qualquer lugar ----
       A trilha de navegação (Central B7 / Clientes / …) é feita de botões
       com data-ir. Cada tela precisava ligar o clique por conta própria, e
       as que esqueciam deixavam a trilha morta. Uma delegação no documento
       resolve para todas de uma vez, inclusive telas futuras. */
    document.addEventListener('click', e => {
      const alvo = e.target.closest('[data-ir]');
      if (!alvo || alvo.closest('.nav')) return;      /* a sidebar tem o seu */
      const destino = alvo.dataset.ir;
      if (!destino) return;
      e.preventDefault();
      location.hash = destino;
      if (B7.fecharGaveta) B7.fecharGaveta();
    });

    aplicarPapelNaNavegacao();

    /* ---- sidebar ---- */
    document.querySelectorAll('.nav a[data-ir]').forEach(a => a.onclick = () => {
      location.hash = a.dataset.ir;
      if (B7.fecharGaveta) B7.fecharGaveta();
    });
    /* Estes botões não existem no Portal do Cliente: a navegação dele é
       outra. Amarrar evento sem checar derrubava o arranque inteiro antes
       de a home ser montada. */
    const ligarSe = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    ligarSe('nav-backup', () => B7.Backup.menu());
    ligarSe('nav-atalhos', () => B7.UI.atalhos());
    ligarSe('nav-config', () => { location.hash = '#/config'; });
    /* recolhida só mostra ícones: o nome do item vai para o title */
    const rotularNav = () => {
      const r = document.body.classList.contains('recolhida');
      document.querySelectorAll('.nav a').forEach(a => {
        const sp = a.querySelector('span');
        if (r && sp) a.title = sp.textContent.trim(); else a.removeAttribute('title');
      });
    };
    document.getElementById('bt-recolher').onclick = () => {
      const r = document.body.classList.toggle('recolhida');
      B7.pref.gravar('sidebar_recolhida', r);
      rotularNav();
      if (document.getElementById('tela-editor').classList.contains('ativa')) B7.Editor.aplicarZoom();
    };
    /* ---- gaveta (sidebar no celular) ----
       Abre pelo hambúrguer; fecha ao tocar fora (o overlay é o próprio
       body.gaveta:before), no ESC, ao navegar (B7.Rota.ir) e ao voltar
       para uma largura em que a sidebar é fixa. */
    const gaveta = aberta => {
      document.body.classList.toggle('gaveta', aberta);
      document.querySelectorAll('.abre-menu').forEach(b => b.setAttribute('aria-expanded', aberta ? 'true' : 'false'));
    };
    B7.fecharGaveta = () => gaveta(false);
    const fecha = document.getElementById('fecha-gaveta');
    if (fecha) fecha.onclick = e => { e.stopPropagation(); gaveta(false); };
    document.querySelectorAll('.abre-menu').forEach(b => {
      b.setAttribute('aria-label', 'Abrir menu');
      b.setAttribute('aria-expanded', 'false');
      b.onclick = e => { e.stopPropagation(); gaveta(!document.body.classList.contains('gaveta')); };
    });
    document.addEventListener('click', e => {
      if (document.body.classList.contains('gaveta') && !e.target.closest('.lateral')) gaveta(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('gaveta')) gaveta(false);
    });
    try {
      window.matchMedia('(min-width:1081px)').addEventListener('change', ev => { if (ev.matches) gaveta(false); });
    } catch (e) {}
    if (B7.pref.ler('sidebar_recolhida', false)) document.body.classList.add('recolhida');
    rotularNav();

    /* O estado do banco saiu da sidebar: durante a produção normal a
       equipe não precisa ver infraestrutura. Ele vive em Configurações →
       Banco de dados. O que continua visível é o que afeta o trabalho:
       falha de autosave e perda de conexão, avisadas em contexto. */
    const avisarConexao = () => {
      if (!navigator.onLine) {
        B7.UI.toast('Sem conexão. As alterações serão salvas quando a rede voltar.',
          { tipo: 'erro' });
      }
    };
    window.addEventListener('offline', avisarConexao);

    /* ---- B7 Light Trail: a trilha desliza até o item ativo ---- */
    const nav = document.querySelector('.nav');
    const trilha = document.createElement('div');
    trilha.className = 'nav-trilha';
    nav.appendChild(trilha);
    B7.moverTrilha = function () {
      const ativo = nav.querySelector('a.on');
      if (!ativo) { trilha.classList.remove('visivel'); return; }
      trilha.style.top = (ativo.offsetTop + 8) + 'px';
      trilha.style.height = (ativo.offsetHeight - 16) + 'px';
      trilha.classList.add('visivel');
    };
    /* nada de observar mutações aqui: a própria trilha muda de classe e o
       observador se auto-alimentava. Quem marca a seção ativa chama isto. */
    window.addEventListener('resize', () => B7.moverTrilha());
    setTimeout(() => B7.moverTrilha(), 60);

    /* ---- tema claro/escuro ---- */
    const trocarLogos = () => {
      const escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      /* troca o arquivo oficial, nunca inverte ou recolore a marca */
      document.querySelectorAll('[data-logo="lockup"]').forEach(img => {
        img.src = 'assets/brand/logo-' + (escuro ? 'white' : 'color') + '.png';
      });
    };
    B7.alternarTema = function () {
      const escuro = document.documentElement.getAttribute('data-theme') === 'dark';
      const novo = escuro ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      try { localStorage.setItem('b7_tema', novo); } catch (e) {}
      trocarLogos();
      return novo;
    };
    document.querySelectorAll('[data-tema]').forEach(b => b.onclick = () => B7.alternarTema());

    /* densidade da interface, guardada por navegador */
    B7.aplicarDensidade = function (valor) {
      const d = valor || B7.pref.ler('densidade', 'confortavel');
      document.documentElement.setAttribute('data-densidade', d);
      if (valor) B7.pref.gravar('densidade', valor);
      return d;
    };
    B7.aplicarDensidade();
    trocarLogos();
    /* enquanto a pessoa não escolher manualmente, seguimos o sistema */
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ev => {
        if (localStorage.getItem('b7_tema')) return;
        document.documentElement.setAttribute('data-theme', ev.matches ? 'dark' : 'light');
        trocarLogos();
      });
    } catch (e) {}

    /* ---- preferências locais ---- */
    if (B7.pref.ler('foco', false)) document.body.classList.add('foco');

    /* ---- atalhos ---- */
    document.addEventListener('keydown', e => {
      const alvo = document.activeElement;
      /* atalhos de letra só fora de campos de texto — nunca no meio de um roteiro */
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable;
      const noEditor = document.getElementById('tela-editor').classList.contains('ativa');
      const temModal = !!document.querySelector('.fundo-modal');

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); B7.Save.agora(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); B7.UI.paleta(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && noEditor) {
        e.preventDefault(); B7.Editor.imprimir(); return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || digitando || temModal) return;

      if (e.key === '/') {
        const busca = document.getElementById('campo-busca');
        if (busca && !noEditor) { e.preventDefault(); busca.focus(); }
      }
      if (e.key === '?') { e.preventDefault(); B7.UI.atalhos(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); B7.Dashboard.modalNovaGravacao(); }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); B7.Dashboard.modalNovoCliente(); }
      if ((e.key === 'f' || e.key === 'F') && noEditor) { e.preventDefault(); B7.Editor.modoFoco(); }
      if ((e.key === 'p' || e.key === 'P') && noEditor) { e.preventDefault(); B7.Editor.imprimir(); }
      if ((e.key === 'd' || e.key === 'D') && noEditor) { e.preventDefault(); B7.Editor.baixar(); }
      if ((e.key === 'v' || e.key === 'V') && noEditor) { e.preventDefault(); B7.Editor.espiar(); }
    });

    B7.UI.ligarMenus(document);
    B7.Save.atualizar();
    B7.Save.escoarFila();
    await B7.Rota.ir();

    /* ---- PWA ---- */
    if (navigator.serviceWorker && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {

    /* ---- configuração ausente: explica em vez de quebrar ---- */
    document.body.classList.remove('apurando');   /* sem banco, mostra o setup */
    if (!B7.configurado || !B7.sb) {
      if (B7.motivoConfig === 'painel') {
        document.querySelector('#setup h2').textContent = 'URL errada no config.js';
        document.querySelector('#setup p').innerHTML =
          'O endereço em <code>js/config.js</code> é o do painel do Supabase, não o do projeto. ' +
          'O certo termina em <b>.supabase.co</b> e está em Project Settings → API → Project URL:';
      }
      document.getElementById('setup').classList.add('ativo');
      fecharCortina();
      return;
    }

    /* Rede de segurança: aconteça o que acontecer, a abertura não fica
       na frente para sempre. */
    setTimeout(fecharCortina, 12000);

    /* ---- sessão ----
       O login vem antes do sistema: sem sessão, a tela de acesso ocupa a
       janela inteira e nada mais é carregado.

       A única exceção é o serviço de acesso não responder. Aí exigir
       login seria trancar todo mundo numa porta que não abre — o sistema
       segue aberto e as Configurações explicam o que falta publicar. */
    if (B7.Auth) {
      let r = { sessao: null, exigido: false };
      try { r = await B7.Auth.iniciar({ exigir: true }); } catch (e) {}
      B7.acessoIndisponivel = !!r.indisponivel;
      /* a partir daqui o papel é conhecido: pode desenhar */
      document.body.classList.remove('apurando');
      B7.Auth.anotar('app', 'exigido=' + !!r.exigido + ' sessao=' + !!r.sessao);
      B7.pintarSessao();
      /* Antes de montar qualquer tela: o cliente não pode ver a navegação
         interna nem por um instante. */
      if (B7.Auth.ehCliente() && B7.Portal) B7.Portal.montarLayout();
      else if (B7.Perm) B7.Perm.aplicarNavegacao();
      /* tela de login na frente: não montamos o resto agora. Ao entrar,
         a página recarrega e este trecho roda de novo, já com sessão. */
      if (r.exigido) { fecharCortina(); return; }
    }

    try { await montarSistema(); }
    finally { fecharCortina(); }
  });
})();
