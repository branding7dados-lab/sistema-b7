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
      'linha', 'semanas', 'semana', 'arquivados', 'config', 'kanban'
    ],   /* sem usuarios, importar, atalhos e lixeira */
    cliente: [
      '', 'aprovacoes', 'revisar', 'minha-linha', 'minha-producao',
      'meus-status', 'historico', 'perfil'
    ]
  };

  /* Itens da barra lateral. A do cliente não é a da equipe com menos
     coisas: é outra navegação, voltada a acompanhar e aprovar. */
  const NAV = {
    admin: null,      /* null = mostra tudo que existe no HTML */
    coordenador: {
      ocultar: ['#/usuarios', '#/importar', '#/atalhos', '#/lixeira'],
      grupos: { 'MAIS FERRAMENTAS': true }
    },
    cliente: {
      ocultar: ['#/kanban', '#/usuarios', '#/clientes', '#/gravacoes', '#/roteiros', '#/linhas',
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
    cliente:     ['aparencia', 'conta']
  };

  const papel = () => (B7.Auth && B7.Auth.papel()) || null;

  /* Sem sessão o sistema se comporta como antes da autenticação: é o
     estado da instalação que ainda não tem ninguém cadastrado. */
  function semSessao() { return !B7.Auth || !B7.Auth.usuario(); }

  function podeRota(rota) {
    if (semSessao()) return true;
    const lista = ROTAS[papel()];
    if (!lista) return false;
    if (lista === '*') return true;
    return lista.includes(String(rota || '').replace(/^#\//, '').split('/')[0]);
  }

  function podeConfig(secao) {
    if (semSessao()) return true;
    const lista = CONFIG[papel()];
    return !lista || lista.includes(secao);
  }

  /* Para onde mandar quem tentou uma rota que não pode abrir. */
  function inicio() {
    if (semSessao()) return '#/';
    return papel() === 'cliente' ? '#/' : '#/';
  }

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

    /* um grupo sem itens vira só um título solto */
    document.querySelectorAll('.nav .grupo').forEach(g => {
      let irmao = g.nextElementSibling, temItem = false;
      while (irmao && !irmao.classList.contains('grupo')) {
        if (irmao.tagName === 'A' || irmao.tagName === 'BUTTON') { temItem = true; break; }
        irmao = irmao.nextElementSibling;
      }
      if (!temItem) g.remove();
    });
  }

  return { podeRota, podeConfig, inicio, aplicarNavegacao, papel, semSessao,
           ROTAS, CONFIG };
})();
