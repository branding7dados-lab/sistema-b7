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
      'linha', 'semanas', 'semana', 'arquivados', 'config', 'kanban', 'aprovacoes', 'design', 'video', 'calendario',
      /* Oportunidades (fase 7): datas comemorativas com fonte e relevância
         por cliente — planejamento editorial é trabalho da coordenação. */
      'oportunidades',
      /* Publicações do Dia: visão operacional do que sai hoje em todos os
         clientes. É leitura sobre a Linha Editorial, e coordenação é
         exatamente o trabalho de quem olha isso todo dia. */
      'publicacoes'
    ],   /* sem usuarios, importar, atalhos e lixeira */
    /* Designer é produção interna, não administração: só o que precisa
       para entender o briefing e entregar o trabalho. Sem usuários,
       Kanban geral, aprovações de cliente, importar/backup.
       'cliente' entra aqui pela mesma spec de refino: o Designer pode
       VER o contexto do cliente (ICP, posicionamento — seção Inteligência,
       que mora sob a rota #/cliente/<id>/...) para entender
       o briefing, mas nunca editar — a UI trava os campos (ver
       souDesignerSomenteLeitura em js/conteudo.js) e o RLS do banco
       bloqueia a escrita de verdade mesmo se alguém pular a UI. */
    /* 'calendario' entra pro Designer só como LEITURA (a tela em si não
       mostra ações de conectar/gerenciar agenda nem vincular/criar
       gravação pra quem não é admin/coordenador — ver souGestorCalendario
       em js/calendario.js) — é contexto (o que vai ser gravado), não
       administração. */
    designer: ['', 'design', 'linhas', 'linha', 'gravacao', 'cliente', 'config', 'calendario'],
    /* Videomaker filma e edita: só precisa da própria fila de demandas
       de edição e do contexto mínimo do cliente/gravação por trás
       delas — mesma lógica do Designer, sem administração nenhuma.
       'calendario' também é só leitura pra ele (mesma nota acima). */
    /* zzz64: também a ÁREA de Gravações e a de Roteiros (com o
       Teleprompter e a exportação), sempre em leitura — o banco só
       deixa a equipe escrever em gravações, roteiros e cenas. */
    videomaker: ['', 'video', 'gravacao', 'gravacoes', 'roteiros', 'cliente', 'config', 'calendario'],
    cliente: [
      '', 'aprovacoes', 'revisar', 'minha-linha', 'minha-producao',
      'minhas-gravacoes', 'meus-status', 'historico', 'perfil'
    ]
  };
  /* =================================================================
     FUNÇÕES E ACESSOS (zzz68)

     FUNÇÃO ≠ ACESSO A MÓDULO.
       • B7.Auth.funcao()  — o que a pessoa FAZ (uma só): decide Painel e
         elegibilidade operacional. Não muda por ganhar um módulo.
       • B7.Auth.modulos() — o que ela ABRE: o acesso efetivo, resolvido
         no banco (padrão da função + exceções por usuário).
       • Administrador abre tudo; isso NÃO faz dele videomaker, designer
         ou coordenador.

     REGISTRO CANÔNICO: cada módulo é dono de uma ou mais rotas. Os ids
     são os mesmos da tabela public.modulos. Menu, guarda de rota, busca,
     "Criar" e atalhos decidem por B7.Perm.podeRota — um lugar só.
     ================================================================= */
  const MODULOS = [
    { id: 'clientes',      rotulo: 'Clientes',            rotas: ['clientes'] },
    { id: 'linhas',        rotulo: 'Linhas editoriais',   rotas: ['linhas', 'linha'] },
    { id: 'roteiros',      rotulo: 'Roteiros',            rotas: ['roteiros'] },
    { id: 'gravacoes',     rotulo: 'Gravações',           rotas: ['gravacoes'] },
    { id: 'video',         rotulo: 'Vídeo',               rotas: ['video'] },
    { id: 'design',        rotulo: 'Design',              rotas: ['design'] },
    { id: 'publicacoes',   rotulo: 'Publicações do Dia',  rotas: ['publicacoes'] },
    { id: 'aprovacoes',    rotulo: 'Aprovações',          rotas: ['aprovacoes'] },
    { id: 'semanas',       rotulo: 'Status semanal',      rotas: ['semanas', 'semana'] },
    { id: 'kanban',        rotulo: 'Produção (quadro)',   rotas: ['kanban'] },
    { id: 'calendario',    rotulo: 'Calendário',          rotas: ['calendario'] },
    { id: 'oportunidades', rotulo: 'Oportunidades',       rotas: ['oportunidades'] }
  ];
  const ROTA_MODULO = {};
  MODULOS.forEach(m => m.rotas.forEach(r => { ROTA_MODULO[r] = m.id; }));
  /* Rotas de CONTEXTO: toda a equipe interna abre, com ou sem o módulo
     "dono" — o detalhe de um cliente e o de uma gravação são o pano de
     fundo de uma peça, de uma demanda ou de um roteiro (o Designer já
     abria os dois sem ter Clientes nem Gravações). O que cada um pode
     FAZER lá dentro continua sendo regra da tela e do banco. */
  const ROTAS_INTERNAS = ['', 'config', 'cliente', 'gravacao'];
  /* Padrão de cada função — só usado se a sessão ainda não trouxer os
     módulos (aba antiga aberta durante a atualização). O valor de verdade
     vem do banco (funcao_modulos + perfil_modulos). */
  const PADRAO_FUNCAO = {
    coordenador: MODULOS.map(m => m.id),
    designer: ['design', 'linhas', 'calendario'],
    videomaker: ['video', 'gravacoes', 'roteiros', 'calendario']
  };
  const funcao = () => (B7.Auth && B7.Auth.funcao ? B7.Auth.funcao() : null);
  const souAdmin = () => papel() === 'admin';
  function modulosEfetivos() {
    if (semSessao() || papel() === 'cliente') return [];
    if (souAdmin()) return MODULOS.map(m => m.id);
    const doBanco = B7.Auth && B7.Auth.modulos ? B7.Auth.modulos() : null;
    return doBanco || PADRAO_FUNCAO[funcao()] || [];
  }
  const temModulo = id => modulosEfetivos().includes(id);

  /* PAINEL (#/painel) — espaço de trabalho PESSOAL, montado a partir das
     funções operacionais REAIS da pessoa. Não é troca de perfil: ela
     continua com todas as permissões do papel dela; o Painel é só mais
     uma tela. Duas visões existem hoje:
       • 'coordenacao' — Coordenador de mídias pelo papel principal, ou
         Administrador com a função extra "coordenador" (a função extra de
         coordenação só vale para Administrador: é ele que já tem, no
         banco, as permissões de coordenação — ver usuarios.js/b7-auth);
       • 'video' — videomaker pelo papel principal ou pela função extra;
       • 'design' — Designer pelo papel principal ou pela função extra
         "designer" (fase 3).
     Quem tem mais de uma vê todas no mesmo Painel (alternância de visão,
     não de identidade). Admin sem nenhuma dessas funções não vê o
     Painel — a Central B7 segue sendo a casa dele. */
  /* zzz68: UMA função principal. O Painel é o da função; ter o módulo de
     Vídeo ou de Design não cria um segundo Painel. Administrador sem
     função não tem Painel (a casa dele é a Central). */
  function souCoordenadorElegivel() { return !semSessao() && papel() !== 'cliente' && funcao() === 'coordenador'; }
  function souDesignerElegivel() { return !semSessao() && papel() !== 'cliente' && funcao() === 'designer'; }
  function painelVisoes() {
    if (semSessao() || papel() === 'cliente') return [];
    return ({ coordenador: ['coordenacao'], videomaker: ['video'], designer: ['design'] })[funcao()] || [];
  }
  function painelElegivel() { return painelVisoes().length > 0; }

  /* FUNÇÕES OPERACIONAIS — o trabalho que a pessoa FAZ (não o acesso).
     Administrador NÃO é função operacional: é gestão/acesso. Um admin
     puro não tem nenhuma aqui (e por isso não ganha Painel operacional).
     Ordem fixa e determinística (coordenação → vídeo → design): é a que a
     navegação usa para priorizar quando a pessoa tem mais de uma.
     'designer' vale pelo papel principal ou pela função extra (o banco
     aceita a função extra "designer"). Isto decide PRIORIDADE visual;
     quem decide ACESSO continua sendo podeRota. */
  function funcoesOperacionais() {
    if (semSessao() || papel() === 'cliente') return [];
    return funcao() ? [funcao()] : [];
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
                '#/roteiros', '#/gravacoes', '#/publicacoes'],
      grupos: { 'MAIS FERRAMENTAS': false }
    },
    /* Videomaker vê a própria Central e o contexto que precisa; nada de
       administração, quadro geral ou aprovações de cliente. */
    videomaker: {
      ocultar: ['#/usuarios', '#/importar', '#/atalhos', '#/lixeira', '#/clientes',
                '#/kanban', '#/aprovacoes', '#/semanas', '#/arquivados',
                '#/linhas', '#/design', '#/publicacoes'],
      grupos: { 'MAIS FERRAMENTAS': false }
    },
    cliente: {
      ocultar: ['#/kanban', '#/aprovacoes', '#/usuarios', '#/clientes', '#/gravacoes', '#/roteiros', '#/linhas',
                '#/semanas', '#/arquivados', '#/lixeira', '#/importar',
                '#/atalhos', '#/config', '#/calendario', '#/publicacoes'],
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

  /* zzz68: o que some do menu fixo. Cliente segue a lista dele; admin vê
     tudo; o resto da equipe perde o que é só de administrador e cada
     módulo que não está no acesso efetivo. */
  const SO_ADMIN = ['usuarios', 'importar', 'atalhos', 'lixeira'];
  function regraNav() {
    if (papel() === 'cliente') return NAV.cliente;
    if (souAdmin()) return null;
    const ocultar = SO_ADMIN.map(r => '#/' + r);
    MODULOS.forEach(m => { if (!temModulo(m.id)) m.rotas.forEach(r => ocultar.push('#/' + r)); });
    if (!podeRota('arquivados')) ocultar.push('#/arquivados');
    return { ocultar, grupos: { 'MAIS FERRAMENTAS': podeRota('arquivados') } };
  }

  /* Sem sessão o sistema se comporta como antes da autenticação: é o
     estado da instalação que ainda não tem ninguém cadastrado. */
  function semSessao() { return !B7.Auth || !B7.Auth.usuario(); }

  function podeRota(rota) {
    if (semSessao()) return true;
    const base = String(rota || '').replace(/^#\//, '').split('/')[0];
    if (papel() === 'cliente') return ROTAS.cliente.includes(base);
    if (base === 'painel') return painelElegivel();
    if (souAdmin()) return true;
    if (ROTAS_INTERNAS.includes(base)) return true;
    /* Arquivados é ferramenta de gestão (restaura gravações): equipe */
    if (base === 'arquivados') return !!(B7.Auth.ehEquipe && B7.Auth.ehEquipe());
    const mod = ROTA_MODULO[base];
    return !!mod && temModulo(mod);      /* rota sem dono = só administrador */
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

    /* Painel e logo — roda ANTES do retorno do admin (NAV.admin é null,
       então tudo abaixo não roda pra ele). Quem não é elegível perde o
       item; quem é videomaker SÓ perde a "Central" (#/), que pra ele era
       a própria fila — isso agora é o Painel, e a fila completa continua
       em "Edição de vídeo". A logo ("ir para o início") leva ao início
       de verdade de cada um. */
    const elegivel = painelElegivel();
    if (!elegivel) document.querySelectorAll('.nav [data-ir="#/painel"]').forEach(el => el.remove());
    if (elegivel && papel() === 'videomaker') document.querySelectorAll('.nav [data-ir="#/"]').forEach(el => el.remove());
    document.querySelectorAll('.marca-clique').forEach(logo => { logo.dataset.ir = elegivel ? '#/painel' : '#/'; });

    const regra = regraNav();
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
    if (!podeRota('video')) {
      document.querySelectorAll('.nav [data-ir="#/video"]').forEach(el => el.remove());
    }

    /* um grupo sem itens vira só um título solto */
    document.querySelectorAll('.nav .grupo').forEach(g => {
      let irmao = g.nextElementSibling, temItem = false;
      while (irmao && !irmao.classList.contains('grupo')) {
        if (irmao.tagName === 'A' || irmao.tagName === 'BUTTON' || (irmao.querySelector && irmao.querySelector('a'))) { temItem = true; break; }
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
    /* (videomaker: o item "#/" não existe mais — ver Painel acima) */
  }

  return { podeRota, podeConfig, inicio, redirecionaSeNegado, aplicarNavegacao, papel, semSessao,
           painelElegivel, painelVisoes, souCoordenadorElegivel, souDesignerElegivel, funcoesOperacionais, ROTAS, CONFIG,
           MODULOS, PADRAO_FUNCAO, modulosEfetivos, temModulo, funcao };
})();
