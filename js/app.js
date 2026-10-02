/* =====================================================================
   BOOT + ROTAS
   #/                 → Central B7 (equipe) ou home do Portal (cliente)
   #/cliente/<id>     → ficha do cliente
   #/gravacao/<id>    → gravação (sessão de produção, itens, datas)
   #/gravacao/<id>/roteiros → editor  (?roteiro=<id> abre num roteiro específico)
   #/previa/<id>/…    → Portal do Cliente visto pelo admin, somente leitura

   Papel antes de interface: a navegação da equipe fica num <template>
   em index.html e só é montada (B7.montarShellInterno) depois que a
   sessão diz quem é. O cliente recebe a navegação do Portal; a interna
   nunca entra no DOM dele — nem por um quadro.
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
       uma tela nova não nascer aberta a todo mundo por esquecimento.
       O cliente é redirecionado para a home do Portal: a rota interna
       não fica nem na barra de endereço. */
    if (B7.Perm && !B7.Perm.podeRota(partes[0] || '')) {
      if (B7.Perm.redirecionaSeNegado()) {
        B7.UI.toast('Esta área não faz parte do seu acompanhamento.', { tipo: 'erro' });
        location.replace(B7.Perm.inicio());
        return;
      }
      mostrar('tela-dashboard');
      return B7.Dashboard.semPermissao(partes[0] || '');
    }

    /* Rotas do Portal: o cliente tem telas próprias, não versões
       reduzidas das internas. */
    if (B7.Auth && B7.Auth.ehCliente() && B7.Portal) {
      mostrar('tela-dashboard');
      /* ?empresa=<id> troca a empresa do acompanhamento — só se ela
         estiver na lista da sessão; fora dela o parâmetro é ignorado */
      if (params.get('empresa') && !B7.Portal.definirEmpresa(params.get('empresa'))) {
        B7.UI.toast('Essa empresa não está vinculada à sua conta.', { tipo: 'erro' });
        location.replace('#/' + (partes[0] || ''));
        return;
      }
      if (!partes[0])                    return B7.Portal.abrirHome();
      if (partes[0] === 'aprovacoes')    return B7.Portal.abrirAprovacoes(params.get('f'));
      /* cada rota abre a sua lista, com o filtro que lhe cabe — antes
         todas caíam na mesma tela, o que fazia o menu parecer quebrado */
      if (partes[0] === 'minha-linha')   return B7.Portal.abrirLinha();
      if (partes[0] === 'minha-producao')return B7.Portal.abrirProducao();
      if (partes[0] === 'minhas-gravacoes') return B7.Portal.abrirGravacoes();
      if (partes[0] === 'meus-status')   return B7.Portal.abrirStatus();
      if (partes[0] === 'historico')     return B7.Portal.abrirHistorico();
      if (partes[0] === 'perfil')        return B7.Portal.abrirPerfil();
      if (partes[0] === 'revisar' && partes[1]) return B7.Portal.abrirRevisao(partes[1]);
      if (partes[0] === 'revisar')       return B7.Portal.abrirAprovacoes();
      return B7.Portal.abrirHome();
    }

    /* Prévia do cliente (admin): o mesmo Portal, com a empresa escolhida
       e somente leitura. Sair da prévia devolve o shell da equipe. */
    if (partes[0] === 'previa' && partes[1] && B7.Portal && B7.Auth && B7.Auth.ehAdmin()) {
      mostrar('tela-dashboard');
      return B7.Portal.abrirPrevia(partes[1], partes.slice(2), params);
    }
    if (B7.Portal && B7.Portal.emPrevia && B7.Portal.emPrevia()) {
      B7.Portal.sairPrevia();
      B7.montarShellInterno();
    }

    B7.UI.esconderDica();

    /* #/diaria/ era o endereço da versão anterior; redireciona para não
       quebrar links que alguém já tenha guardado */
    if (partes[0] === 'diaria' && partes[1]) {
      location.replace('#/gravacao/' + partes[1] + (query ? '?' + query : ''));
      return;
    }
    /* Gravações 2.0: #/gravacao/<id> abre a GRAVAÇÃO (sessão de produção,
       js/gravacao.js). O editor de roteiros continua em
       #/gravacao/<id>/roteiros — e ?roteiro=<id> / ?imprimir=1 (links
       antigos, busca, notificações de roteiro) seguem indo direto nele. */
    if (partes[0] === 'gravacao' && partes[1] && B7.Gravacao && partes[2] !== 'roteiros' &&
        !params.get('roteiro') && !params.get('imprimir')) {
      mostrar('tela-dashboard');
      return B7.Gravacao.abrir(partes[1]);
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
      /* ?conteudo=<id> abre a linha já com o Criativo aberto — deep-link
         por ID, usado por "Publicações do Dia". */
      return B7.Linha.abrir(partes[1], partes[2], params.get('conteudo') || null);
    }
    /* PUBLICAÇÕES DO DIA — visão diária cross-cliente sobre os conteúdos
       que já existem nas Linhas Editoriais. #/publicacoes abre no dia de
       hoje; #/publicacoes/AAAA-MM-DD abre num dia específico. */
    if (partes[0] === 'publicacoes' && B7.Publicacoes) {
      mostrar('tela-dashboard');
      return B7.Publicacoes.abrir(partes[1]);
    }
    /* PAINEL — espaço pessoal: UM Painel por pessoa, montado pelas funções
       operacionais (B7.Painel.contexto; várias funções → js/painel-multi.js). A guarda de rota
       acima (B7.Perm.podeRota) já recusou quem não é elegível. */
    if (partes[0] === 'painel' && B7.Painel) { mostrar('tela-dashboard'); return B7.Painel.abrir(params); }
    if (partes[0] === 'linhas') { mostrar('tela-dashboard'); return B7.Conteudo.abrirLinhasGlobais(params); }
    if (partes[0] === 'kanban') { mostrar('tela-dashboard'); return B7.Kanban.abrir(); }
    if (partes[0] === 'design' && B7.Design) {
      mostrar('tela-dashboard');
      if (partes[1] === 'linha' && partes[2]) return B7.Design.abrirLinha(partes[2]);
      return partes[1] ? B7.Design.abrirDetalhe(partes[1]) : B7.Design.abrir(params.get('aba'), params);
    }
    if (partes[0] === 'video' && B7.Video) {
      mostrar('tela-dashboard');
      return partes[1] ? B7.Video.abrirDetalhe(partes[1]) : B7.Video.abrir(params);
    }
    if (partes[0] === 'oportunidades' && B7.Oportunidades) {
      mostrar('tela-dashboard');
      return B7.Oportunidades.abrir(params);
    }
    if (partes[0] === 'calendario' && B7.Calendario) {
      mostrar('tela-dashboard');
      return B7.Calendario.abrir(params);
    }
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
    /* Designer não grava nem escreve roteiro — a "Central de Produção"
       genérica (Gravações/Roteiros/Linhas) não é o trabalho dele, e os
       dois primeiros nem abrem (rota bloqueada). A home do Designer é
       a Central de Design: uma tela própria (o que precisa de mim, onde
       parei, minhas linhas), diferente da fila ampla em #/design.
       Desde a fase 3 do Painel, a CASA do Designer é o Painel (#/painel,
       aplicarCasaPadrao); a Central de Design continua aqui em "#/". */
    if (!partes[0] && B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'designer' && B7.Design) {
      return B7.Design.abrirCentral();
    }
    /* Videomaker: mesma lógica — a home dele é a própria fila (Central
       do Videomaker), não a Central de Produção genérica (que nem abre:
       'gravacoes'/'roteiros' estão fora de ROTAS.videomaker). */
    /* Agora a casa dele é o Painel (a fila completa continua em
       "Edição de vídeo"). replace: não deixa "#/" no histórico, então o
       Voltar do navegador não cai num laço de redirecionamento. */
    if (!partes[0] && B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'videomaker' && B7.Painel) {
      location.replace('#/painel');
      return;
    }
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
    document.title = partes && partes.length ? partes.join(' · ') + ' · Branding7' : 'Branding7';
  }

  /* Casa padrão de quem tem Painel (videomaker por papel ou por função
     extra): só quando o sistema abre SEM rota — abrir o site, o PWA, ou
     logo depois do login (sair limpa o endereço). "#/" explícito (clicar
     em Central B7, dar refresh nela) continua sendo a Central, e qualquer
     deep link continua valendo. replaceState não dispara hashchange:
     nenhum redirecionamento em cadeia. Chamada uma vez, no arranque. */
  function aplicarCasaPadrao() {
    if ((!location.hash || location.hash === '#') && B7.Perm && B7.Perm.painelElegivel && B7.Perm.painelElegivel()) {
      try { history.replaceState(null, '', '#/painel'); } catch (e) {}
      return true;
    }
    return false;
  }

  return { ir, recarregar, titulo, aoSair, aplicarCasaPadrao };
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

  /* =================================================================
     SHELL DA EQUIPE
     A navegação interna e os controles do topo (busca, Nova gravação,
     backup) vivem em <template> no index.html. Só entram no DOM aqui,
     depois que o papel é conhecido e NÃO é cliente. Idempotente: pode
     ser chamada de novo ao sair da prévia do cliente.
     ================================================================= */
  function montarShellInterno() {
    if (B7.Auth && B7.Auth.ehCliente()) return false;
    const nav = document.querySelector('.nav');
    const tpl = document.getElementById('tpl-nav-interna');
    if (nav && nav.dataset.shell !== 'interno') {
      /* Navegação da equipe: montada pelo modelo único (js/nav.js) a
         partir da sessão — permissão decide o que existe, função
         operacional decide a ordem. Sem sessão (instalação ainda sem
         login), cai no <template> antigo e é refeita quando a sessão
         chegar (shell 'interno-anon' não conta como montado). */
      const doModelo = !!(B7.Nav && B7.Nav.montarLateral());
      if (!doModelo && tpl) {
        nav.innerHTML = '';
        nav.appendChild(tpl.content.cloneNode(true));
        nav.dataset.shell = 'interno-anon';
      }
      /* a trilha luminosa é filha da nav: volta junto */
      if (B7.criarTrilha) B7.criarTrilha();
      aplicarPapelNaNavegacao();
      if (B7.Perm) B7.Perm.aplicarNavegacao();
      if (B7.PreviaUsuario) B7.PreviaUsuario.montarSeletor();
      if (!doModelo) {
        const ligarSe = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        ligarSe('nav-atalhos', () => B7.UI.atalhos());
        ligarSe('nav-config', () => { location.hash = '#/config'; });
        const toggle = document.getElementById('nav-mais-toggle'), caixa = document.getElementById('nav-mais');
        if (toggle && caixa) toggle.onclick = () => {
          const ab = !caixa.classList.contains('aberta');
          caixa.classList.toggle('aberta', ab);
          toggle.setAttribute('aria-expanded', ab ? 'true' : 'false');
          localStorage.setItem('b7-nav-mais', ab ? '1' : '0');
        };
      }
      if (B7.rotularNav) B7.rotularNav();
    }
    [['topo-interno-esq', 'tpl-topo-interno-esq'], ['topo-interno-dir', 'tpl-topo-interno-dir']].forEach(([id, t]) => {
      const alvo = document.getElementById(id), tp = document.getElementById(t);
      if (!alvo || !tp) return;
      const frag = tp.content.cloneNode(true);
      alvo.replaceWith(frag);
    });
    /* O topo é o mesmo para todos os papéis: quem decide o que aparece
       em "Criar" é o resolvedor de permissões (js/topo.js), não um ajuste
       por papel aqui. */
    document.body.classList.remove('modo-portal', 'modo-previa');
    document.body.dataset.shell = 'interno';
    /* celular: barra inferior; tablet: barra lateral em trilho */
    if (B7.Nav) { B7.Nav.montarInferior(); B7.Nav.aplicarLargura(); }
    if (B7.ligarTopoInterno) B7.ligarTopoInterno();
    if (B7.Topo) B7.Topo.render();
    if (B7.moverTrilha) setTimeout(() => B7.moverTrilha(), 0);
    return true;
  }
  B7.montarShellInterno = montarShellInterno;

  /* Mostra quem está logado, ou o caminho para entrar. Sem sessão e sem
     serviço publicado, não aparece nada: um botão que não leva a lugar
     nenhum é pior do que botão nenhum. */
  /* Conta (avatar → menu de conta) em todos os topos: js/topo.js. Sem
     sessão e sem serviço publicado, não aparece nada. */
  function pintarSessao() {
    if (B7.Topo) B7.Topo.pintarConta();
    if (B7.Topo) B7.Topo.renderCriar();
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
    /* Papel resolvido: agora sim a interface certa entra no DOM. O
       cliente recebe o Portal; a equipe recebe o shell interno. Os
       cliques da navegação são delegados no documento, então montar
       antes ou depois de montarSistema dá no mesmo. */
    if (B7.Auth.ehCliente() && B7.Portal) B7.Portal.montarLayout();
    else montarShellInterno();
    await B7.montarSistema();
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

    /* ---- topo: dashboard ----
       Estes controles são da equipe e só existem depois de
       montarShellInterno. No Portal do Cliente não existem: por isso
       tudo aqui é condicional, e a ligação pode ser refeita quando o
       admin sai da prévia do cliente. */
    const ligarTopo = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    B7.ligarTopoInterno = function () {
      /* busca, Criar e conta: js/topo.js (B7.Topo.render) */
      if (B7.Topo) B7.Topo.render();
    };
    B7.ligarTopoInterno();
    document.addEventListener('click', e => {
      const caixaRes = document.getElementById('resultados-busca');
      if (caixaRes && !e.target.closest('.busca')) caixaRes.classList.remove('aberto');
    });

    /* ---- topo: editor ---- */
    /* do editor de roteiros, "voltar" leva à GRAVAÇÃO (Gravações 2.0) */
    ligarTopo('bt-voltar', () => {
      const m = /^#\/gravacao\/([^/?]+)/.exec(location.hash);
      location.hash = m ? '#/gravacao/' + m[1] : '#/';
    });
    document.getElementById('ed-status').onclick = () => B7.Editor.menuStatus();
    ligarTopo('bt-imprimir', () => B7.Editor.imprimir());
    ligarTopo('bt-baixar', () => B7.Editor.baixar());
    ligarTopo('mn-ed-baixar', () => B7.Editor.baixar());   /* no celular o botão do topo some */
    document.getElementById('mn-ed-apresentar').onclick = () => B7.Editor.apresentar();
    /* Gravação só aparece no portal do cliente quando a equipe libera
       (gravacoes.visivel_cliente via gravacao_liberar_portal). */
    document.getElementById('mn-ed-portal').onclick = async () => {
      const g = B7.Editor.estado.gravacao, bt = document.getElementById('mn-ed-portal');
      const novo = !g.visivel_cliente;
      bt.disabled = true;
      try {
        await B7.DB.liberarGravacao(g.id, novo);
        g.visivel_cliente = novo;
        B7.pintarPortalGravacao();
        B7.UI.toast(novo ? 'Gravação liberada no portal do cliente' : 'Gravação retirada do portal do cliente');
      } catch (e) {
        B7.UI.toast('Não foi possível salvar: ' + (e.message || 'erro'), { tipo: 'erro' });
      }
      bt.disabled = false;
    };
    B7.pintarPortalGravacao = function () {
      const g = B7.Editor.estado.gravacao, bt = document.getElementById('mn-ed-portal');
      if (g && bt) bt.textContent = g.visivel_cliente ? '✓ Visível no portal do cliente' : 'Liberar no portal do cliente';
    };
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
      /* a prévia só ganha layout real ao virar a aba ativa no celular —
         se a escala é automática, a medida feita enquanto ela estava
         escondida não vale nada; reavalia agora que .folha é medível. */
      if (b.dataset.aba === 'previa') B7.Editor.reavaliarEscalaAtual();
    });

    /* ---- navegação por data-ir, em qualquer lugar ----
       A trilha de navegação (Central B7 / Clientes / …) é feita de botões
       com data-ir. Cada tela precisava ligar o clique por conta própria, e
       as que esqueciam deixavam a trilha morta. Uma delegação no documento
       resolve para todas de uma vez, inclusive telas futuras. */
    document.addEventListener('click', e => {
      const alvo = e.target.closest('[data-ir]');
      if (!alvo) return;
      const destino = alvo.dataset.ir;
      if (!destino) return;
      e.preventDefault();
      location.hash = destino;
      if (B7.fecharGaveta) B7.fecharGaveta();
    });

    /* ---- sidebar ----
       A navegação (da equipe ou do Portal) é montada por quem conhece o
       papel — montarShellInterno ou B7.Portal.montarLayout — e os
       cliques passam pela delegação acima. Os botões com id da equipe
       são ligados em montarShellInterno, porque só existem lá. */
    aplicarPapelNaNavegacao();
    /* recolhida só mostra ícones: o nome do item vai para o title */
    const rotularNav = () => {
      const r = document.body.classList.contains('recolhida');
      document.querySelectorAll('.nav a').forEach(a => {
        const sp = a.querySelector('span');
        /* o nome vai para aria-label; a dica visual é a flutuante de
           js/nav.js (title nativo duplicava a dica) */
        if (sp) a.setAttribute('aria-label', sp.textContent.trim());
        a.removeAttribute('title');
      });
    };
    B7.rotularNav = rotularNav;
    /* Recolher/expandir: ao recolher, os rótulos somem PRIMEIRO (90 ms) e
       só então a largura encolhe; ao expandir, a largura cresce e os
       rótulos entram com atraso (CSS) — nada de texto espremido. */
    const btRecolher = document.getElementById('bt-recolher');
    const rotularRecolher = () => {
      const r = document.body.classList.contains('recolhida');
      btRecolher.setAttribute('aria-label', r ? 'Expandir barra lateral' : 'Recolher barra lateral');
      btRecolher.setAttribute('aria-expanded', String(!r));
      const sp = btRecolher.querySelector('span'); if (sp) sp.textContent = 'Recolher';
    };
    B7.rotularRecolher = rotularRecolher;
    btRecolher.onclick = () => {
      /* no tablet a barra já é trilho fixo: recolher não se aplica */
      const b = document.body;
      if (b.classList.contains('trilho-tablet') || b.classList.contains('recolhendo')) return;
      if (B7.Nav && B7.Nav.fecharFlyout) B7.Nav.fecharFlyout(true);
      const depois = () => {
        rotularNav(); rotularRecolher();
        if (document.getElementById('tela-editor').classList.contains('ativa')) B7.Editor.aplicarZoom();
      };
      const calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!b.classList.contains('recolhida') && !calmo) {
        b.classList.add('recolhendo');
        setTimeout(() => { b.classList.remove('recolhendo'); b.classList.add('recolhida'); B7.pref.gravar('sidebar_recolhida', true); depois(); }, 90);
      } else {
        const r = b.classList.toggle('recolhida');
        B7.pref.gravar('sidebar_recolhida', r);
        depois();
      }
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
    rotularNav(); rotularRecolher();

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

    /* ---- B7 Light Trail: a trilha desliza até o item ativo ----
       A nav é reescrita ao trocar de shell (Portal ↔ equipe); a trilha
       é recriada por B7.criarTrilha quando isso acontece. */
    const nav = document.querySelector('.nav');
    B7.criarTrilha = function () {
      if (!nav.querySelector('.nav-trilha')) {
        const t = document.createElement('div');
        t.className = 'nav-trilha';
        nav.appendChild(t);
      }
    };
    B7.criarTrilha();
    B7.moverTrilha = function () {
      B7.criarTrilha();
      const trilha = nav.querySelector('.nav-trilha');
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
    /* Aparência: 'sistema' segue o sistema operacional (sem escolha
       guardada); 'light'/'dark' ficam guardados neste navegador. Usado
       pelo menu da conta e por Configurações → Aparência. */
    B7.definirTema = function (modo) {
      if (modo === 'light' || modo === 'dark') {
        document.documentElement.setAttribute('data-theme', modo);
        try { localStorage.setItem('b7_tema', modo); } catch (e) {}
      } else {
        try { localStorage.removeItem('b7_tema'); } catch (e) {}
        let escuro = false; try { escuro = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
        document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
      }
      trocarLogos();
      return modo;
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
        if (!noEditor && B7.Topo && document.body.dataset.shell === 'interno') { e.preventDefault(); B7.Topo.abrirBusca(''); }
      }
      if (e.key === '?') { e.preventDefault(); B7.UI.atalhos(); }
      /* atalhos de criar passam pelo mesmo resolvedor do "Criar": quem
         não pode criar gravação/cliente não abre o modal pelo teclado */
      if ((e.key === 'n' || e.key === 'N') && B7.Topo && B7.Topo.acoesCriar().some(a => a.id === 'gravacao')) { e.preventDefault(); B7.Topo.executar('gravacao'); }
      if ((e.key === 'c' || e.key === 'C') && B7.Topo && B7.Topo.acoesCriar().some(a => a.id === 'cliente')) { e.preventDefault(); B7.Topo.executar('cliente'); }
      if ((e.key === 'f' || e.key === 'F') && noEditor) { e.preventDefault(); B7.Editor.modoFoco(); }
      if ((e.key === 'p' || e.key === 'P') && noEditor) { e.preventDefault(); B7.Editor.imprimir(); }
      if ((e.key === 'd' || e.key === 'D') && noEditor) { e.preventDefault(); B7.Editor.baixar(); }
      if ((e.key === 'v' || e.key === 'V') && noEditor) { e.preventDefault(); B7.Editor.espiar(); }
    });

    B7.UI.ligarMenus(document);
    B7.Save.atualizar();
    B7.Save.escoarFila();
    B7.Rota.aplicarCasaPadrao();
    await B7.Rota.ir();

    /* ---- PWA ---- */
    ligarAtualizacao();
  }

  /* Service worker e atualização automática. Uma vez por página. */
  B7.ligarAtualizacao = ligarAtualizacao;
  let atualizacaoLigada = false;
  function ligarAtualizacao() {
    if (atualizacaoLigada) return;
    atualizacaoLigada = true;
    if (!location.protocol.startsWith('http')) return;

    /* COMO DESCOBRIR. A página sabe a versão que está rodando
       (B7.Auth.VERSAO) e pergunta ao servidor qual é a publicada, lendo o
       próprio js/auth.js: se o número é outro, há versão nova. É a
       pergunta direta, e não depende do service worker — a primeira
       tentativa dependia (esperava o evento de troca de service worker),
       e esse evento não chega a uma página aberta com recarregamento
       forçado (Ctrl+F5), que fica fora do controle dele: nada aparecia.

       Pergunta a cada 30 s com a aba visível, e na hora em que ela volta
       a aparecer, ganha foco ou a internet volta (no celular: reabrir o
       app). Sem rede, o service worker devolve a cópia guardada — a
       versão é a mesma e nada acontece. */
    const minha = (B7.Auth && B7.Auth.VERSAO) || '';
    let registro = null;      /* service worker, quando existe */
    let alvo = null;          /* versão publicada, diferente da que roda */
    let avisou = false, conferindo = false, ultima = 0;

    async function conferir(forcar) {
      if (!minha || conferindo || !navigator.onLine) return;
      if (!forcar && (document.hidden || Date.now() - ultima < 10000)) return;
      conferindo = true; ultima = Date.now();
      try {
        const r = await fetch('js/auth.js', { cache: 'no-store' });
        if (r.ok) {
          const m = /VERSAO\s*=\s*'([^']+)'/.exec(await r.text());
          if (m && m[1] !== minha) haVersaoNova(m[1]);
        }
      } catch (e) { /* sem rede agora: pergunta de novo depois */ }
      finally { conferindo = false; }
    }

    /* QUANDO APLICAR. A atualização entra sozinha, mas nunca por cima do
       que a pessoa está fazendo: recarregar apaga o que está digitado
       num campo, fecha um modal no meio e derruba uma apresentação.
       Então recarrega na hora se a aba está em segundo plano ou se
       ninguém mexe há alguns segundos, e nada está aberto/por salvar;
       senão espera — e aproveita a próxima troca de tela, que é um
       momento em que recarregar não custa nada. O aviso com "Atualizar"
       fica na tela enquanto isso, para quem quiser na hora. */
    let ultimoGesto = Date.now();
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(t =>
      window.addEventListener(t, () => { ultimoGesto = Date.now(); }, { passive: true, capture: true }));
    const ocupado = () => {
      if (B7.Save && B7.Save.temPendencias && B7.Save.temPendencias()) return true;
      if (document.fullscreenElement || document.webkitFullscreenElement) return true;
      if (document.querySelector('.fundo-modal, .preview-fundo, .apresentacao, .tele')) return true;
      const a = document.activeElement;
      return !!(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
    };
    const parado = () => Date.now() - ultimoGesto > 8000;
    /* trava contra laço: recarrega sozinho uma vez por versão. Se depois
       de recarregar a versão ainda não for a publicada (servidor ainda
       distribuindo os arquivos), fica só o aviso. */
    const jaTentei = () => { try { return sessionStorage.getItem('b7-recarga-alvo') === alvo; } catch (e) { return false; } };
    const recarregar = () => {
      try { sessionStorage.setItem('b7-recarga-alvo', alvo || ''); } catch (e) {}
      location.reload();
    };
    const tentar = () => { if (alvo && !ocupado() && !jaTentei() && (document.hidden || parado())) recarregar(); };

    function haVersaoNova(v) {
      alvo = v;
      /* o service worker novo renova a reserva offline; a recarga em si
         já busca os arquivos na rede, com ou sem ele */
      if (registro) registro.update().catch(() => {});
      if (!avisou) {
        avisou = true;
        B7.UI.toast('Nova versão do B7 disponível.', { acao: 'Atualizar', tempo: 24 * 3600 * 1000, aoClicar: recarregar });
        setInterval(tentar, 2000);
        document.addEventListener('visibilitychange', tentar);
        window.addEventListener('hashchange', () => { if (alvo && !ocupado() && !jaTentei()) recarregar(); });
      }
      tentar();
    }

    setInterval(() => conferir(false), 30000);
    document.addEventListener('visibilitychange', () => conferir(false));
    window.addEventListener('focus', () => conferir(false));
    window.addEventListener('pageshow', () => conferir(false));
    window.addEventListener('online', () => conferir(true));

    if (navigator.serviceWorker) {
      /* um service worker novo assumiu: confere na hora, sem esperar o
         relógio. Se a página já está na versão publicada (acabou de ser
         aberta), não há o que fazer — antes isso gerava um aviso à toa. */
      navigator.serviceWorker.addEventListener('controllerchange', () => conferir(true));
      navigator.serviceWorker.register('./sw.js').then(reg => { registro = reg; }).catch(() => {});
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
      /* tela de login na frente: nenhum shell é montado — nem o da
         equipe nem o do Portal. Ao entrar, B7.aoEntrar decide qual. */
      /* a tela de acesso também se atualiza sozinha */
      if (r.exigido) { ligarAtualizacao(); fecharCortina(); return; }
      /* Papel conhecido. O cliente recebe o Portal; a equipe (ou o
         sistema aberto sem serviço de acesso) recebe o shell interno.
         A navegação interna não existia no DOM até este ponto. */
      if (B7.Auth.ehCliente() && B7.Portal) B7.Portal.montarLayout();
      else montarShellInterno();
    } else {
      montarShellInterno();
    }

    try { await montarSistema(); }
    finally { fecharCortina(); }
  });
})();
