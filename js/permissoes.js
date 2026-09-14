/* =====================================================================
   PERMISSÕES POR PERFIL

   Um lugar só decide o que cada papel alcança: navegação, rotas e seções
   de configuração. Espalhar essa decisão por vários arquivos é como
   surgem as brechas — uma tela nova nasce visível para todo mundo porque
   ninguém lembrou de escondê-la.

   IMPORTANTE: isto é interface, não segurança. Esconder um menu não
   impede ninguém de chamar a API direto. O que protege de verdade são as
   políticas do banco (migration_rls.sql). Enquanto elas não rodarem, um
   cliente determinado ainda alcança os dados por fora do sistema.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Perm = (function () {

  /* Rotas que cada papel pode abrir. O cliente tem uma lista curta e
     explícita: tudo que não estiver aqui é negado. */
  const ROTAS = {
    admin: '*',
    coordenador: [
      '', 'clientes', 'cliente', 'gravacoes', 'gravacao', 'roteiros', 'linhas',
      'linha', 'semanas', 'semana', 'arquivados', 'config', 'kanban', 'aprovacoes', 'design', 'video'
    ],   /* sem usuarios, importar, atalhos e lixeira */
    /* Designer é produção interna, não administração: só o que precisa
       para entender o briefing e entregar o trabalho. Sem usuários,
       Kanban geral, aprovações de cliente, importar/backup.
       'cliente' entra aqui pela mesma spec de refino: o Designer pode
       VER o contexto do cliente (ICP, posicionamento — abas Inteligência/
       Onboarding, que moram sob a rota #/cliente/<id>/...) para entender
       o briefing, mas nunca editar — a UI trava os campos (ver
       souDesignerSomenteLeitura em js/conteudo.js) e o RLS do banco
       bloqueia a escrita de verdade mesmo se alguém pular a UI. */
    designer: ['', 'design', 'linhas', 'linha', 'gravacao', 'cliente', 'config'],
    /* Videomaker filma e edita: só precisa da própria fila de demandas
       de edição e do contexto mínimo do cliente/gravação por trás
       delas — mesma lógica do Designer, sem administração nenhuma. */
    videomaker: ['', 'video', 'gravacao', 'cliente', 'config'],
    cliente: [
      '', 'aprovacoes', 'revisar', 'minha-linha', 'minha-producao',
      'minhas-gravacoes', 'meus-status', 'historico', 'perfil'
    ]
  };
  /* Acesso a "#/video" (Produção de Vídeo / Central de Vídeo) por
     ASSOCIAÇÃO, não só pela lista estática acima: além de quem já tem
     'video' no próprio papel (admin '*', coordenador), também entra
     quem ganhou a FUNÇÃO EXTRA "videomaker" (B7 Vídeo Parte 1.1) —
     ex.: um Designer que também é Videomaker. Cliente nunca entra
     aqui, função extra é só para papéis internos. */
  function acessoVideoDinamico() {
    if (semSessao()) return true;
    if (papel() === 'cliente') return false;
    if (papel() === 'admin' || (ROTAS[papel()] || []).includes('video')) return true;
    return !!(B7.Auth && B7.Auth.souVideomakerElegivel && B7.Auth.souVideomakerElegivel());
  }

  /* "Visualizar como cliente" (#/previa/<id>) é só do administrador:
     admin tem '*'; coordenador e cliente não têm 'previa' e caem na
     recusa. A prévia é somente leitura de qualquer forma (portal.js). */

  /* Itens da barra lateral. A do cliente não é a da equipe com menos
     coisas: é outra navegação, voltada a acompanhar e aprovar. */
  const NAV = {
    admin: null,      /* null = mostra tudo que existe no HTML */
    coordenador: {
      ocultar: ['#/usuarios', '#/importar', '#/atalhos', '#/lixeira'],
      grupos: { 'MAIS FERRAMENTAS': true }
    },
    /* Designer vê a fila de trabalho e o contexto que precisa; nada de
       administração de clientes, quadro geral ou aprovações de cliente. */
    designer: {
      ocultar: ['#/usuarios', '#/importar', '#/atalhos', '#/lixeira', '#/clientes',
                '#/kanban', '#/aprovacoes', '#/semanas', '#/arquivados',
                '#/roteiros', '#/gravacoes'],
      grupos: { 'MAIS FERRAMENTAS': false }
    },
    /* Videomaker vê a própria Central e o contexto que precisa; nada de
       administração, quadro geral ou aprovações de cliente. */
    videomaker: {
      ocultar: ['#/usuarios', '#/importar', '#/atalhos', '#/lixeira', '#/clientes',
                '#/kanban', '#/aprovacoes', '#/semanas', '#/arquivados',
                '#/roteiros', '#/linhas', '#/design'],
      grupos: { 'MAIS FERRAMENTAS': false }
    },
    cliente: {
      ocultar: ['#/kanban', '#/aprovacoes', '#/usuarios', '#/clientes', '#/gravacoes', '#/roteiros', '#/linhas',
                '#/semanas', '#/arquivados', '#/lixeira', '#/importar',
                '#/atalhos', '#/config'],
      grupos: { 'PRODUÇÃO': false, 'MAIS FERRAMENTAS': false }
    }
  };

  /* Seções da tela de configurações. Aparência e sair valem para todos;
     o resto é administrativo. */
  const CONFIG = {
    admin:       ['aparencia', 'interface', 'impressao', 'acesso', 'usuarios',
                  'banco', 'dados', 'conta'],
    coordenador: ['aparencia', 'interface', 'impressao', 'conta'],
    designer:    ['aparencia', 'conta'],
    videomaker:  ['aparencia', 'conta'],
    cliente:     ['aparencia', 'conta']
  };

  const papel = () => (B7.Auth && B7.Auth.papel()) || null;

  /* Sem sessão o sistema se comporta como antes da autenticação: é o
     estado da instalação que ainda não tem ninguém cadastrado. */
  function semSessao() { return !B7.Auth || !B7.Auth.usuario(); }

  function podeRota(rota) {
    if (semSessao()) return true;
    const base = String(rota || '').replace(/^#\//, '').split('/')[0];
    if (base === 'video') return acessoVideoDinamico();
    const lista = ROTAS[papel()];
    if (!lista) return false;
    if (lista === '*') return true;
    return lista.includes(base);
  }

  function podeConfig(secao) {
    if (semSessao()) return true;
    const lista = CONFIG[papel()];
    return !lista || lista.includes(secao);
  }

  /* Para onde mandar quem tentou uma rota que não pode abrir. O cliente
     é REDIRECIONADO (app.js troca o endereço), não só avisado: uma
     rota interna digitada à mão não pode nem ficar na barra. */
  function inicio() { return '#/'; }
  function redirecionaSeNegado() { return papel() === 'cliente'; }

  /* Esconde o que o papel não alcança. Some do DOM em vez de ficar
     desabilitado: opção com cadeado só informa o que a pessoa não pode
     fazer, e isso não ajuda ninguém. */
  function aplicarNavegacao() {
    if (semSessao()) return;
    const regra = NAV[papel()];
    if (!regra) return;

    (regra.ocultar || []).forEach(destino => {
      document.querySelectorAll('.nav [data-ir="' + destino + '"]').forEach(el => el.remove());
      /* alguns itens são botões com id em vez de data-ir */
      const porId = { '#/config': 'nav-config', '#/atalhos': 'nav-atalhos',
                      '#/importar': 'nav-backup', '#/usuarios': 'nav-usuarios' };
      if (porId[destino]) {
        const b = document.getElementById(porId[destino]);
        if (b) b.remove();
      }
    });

    /* "#/video" some para quem não tem acesso por papel NEM por função
       extra — a lista estática de ocultar acima não sabe da função
       extra (decidida em tempo de sessão), então este passo roda
       separado, depois dela. */
    if (!acessoVideoDinamico()) {
      document.querySelectorAll('.nav [data-ir="#/video"]').forEach(el => el.remove());
    }

    /* um grupo sem itens vira só um título solto */
    document.querySelectorAll('.nav .grupo').forEach(g => {
      let irmao = g.nextElementSibling, temItem = false;
      while (irmao && !irmao.classList.contains('grupo')) {
        if (irmao.tagName === 'A' || irmao.tagName === 'BUTTON') { temItem = true; break; }
        irmao = irmao.nextElementSibling;
      }
      if (!temItem) g.remove();
    });

    /* Designer: o item "Central B7" da barra lateral é o mesmo rótulo
       genérico que admin/coordenador veem, mas o conteúdo por trás dele
       (rota "#/") já é só Design (js/app.js). Sem isso a pessoa clica,
       cai direto na fila de Design, e o menu continua dizendo "Central
       B7" — confuso, parece que não mudou nada. Só o rótulo muda; a
       rota e o destino continuam "#/" (não existe uma rota "#/design"
       separada para a home do Designer). */
    if (papel() === 'designer') {
      const rotulo = document.querySelector('.nav [data-ir="#/"] span');
      if (rotulo) rotulo.textContent = 'Central de Design';
    }
    if (papel() === 'videomaker') {
      const rotulo = document.querySelector('.nav [data-ir="#/"] span');
      if (rotulo) rotulo.textContent = 'Central do Videomaker';
    }
  }

  return { podeRota, podeConfig, inicio, redirecionaSeNegado, aplicarNavegacao, papel, semSessao,
           ROTAS, CONFIG };
})();
