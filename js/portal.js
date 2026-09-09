/* =====================================================================
   PORTAL DO CLIENTE

   Ambiente próprio, não uma versão reduzida do sistema interno. A
   pergunta que a home responde é "o que a Branding7 está produzindo para
   mim, e o que depende de mim?" — não "qual o panorama da agência".

   A troca de layout acontece antes de qualquer coisa aparecer: montar a
   navegação interna e depois substituí-la deixaria o cliente ver, por um
   instante, uma tela que não é dele.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Portal = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  /* As telas do portal escrevem dentro de um wrapper .conteudo. Este
     atalho evita repetir a estrutura em cada tela. */
  const conteudo = () => {
    let alvo = painel().querySelector('.conteudo');
    if (!alvo) {
      painel().innerHTML = '<div class="conteudo entra"></div>';
      alvo = painel().querySelector('.conteudo');
    }
    return alvo;
  };

  const empresa = () => {
    const u = B7.Auth.usuario();
    const lista = (u && u.empresas) || [];
    return lista[0] || null;
  };

  const FORMATOS = {
    roteiro: 'Roteiro', linha: 'Linha editorial',
    conteudo: 'Conteúdo', semana: 'Status semanal'
  };

  /* =================================================================
     LAYOUT
     A navegação do cliente é montada do zero, não filtrada da interna.
     ================================================================= */
  function montarLayout() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const itens = [
      ['#/', 'inicio', 'Início'],
      ['#/aprovacoes', 'aprovacoes', 'Aprovações'],
      ['#/minha-linha', 'linha', 'Linha editorial'],
      ['#/minha-producao', 'producao', 'Produção'],
      ['#/meus-status', 'semana', 'Status semanal'],
      ['#/historico', 'historico', 'Histórico']
    ];

    const emp = empresa();

    nav.innerHTML =
      /* Deixa claro em que ambiente a pessoa está. Sem isso, o portal
         parecia uma versão reduzida do sistema interno. */
      '<div class="pt-marcador">' +
        '<span class="pt-marcador-rot">PORTAL DO CLIENTE</span>' +
        (emp ? '<span class="pt-marcador-emp">' + esc(emp.nome) + '</span>' : '') +
      '</div>' +
      itens.map(([destino, icone, texto]) =>
        '<a data-ir="' + destino + '">' + ICONE[icone] +
        '<span>' + esc(texto) + '</span></a>').join('');

    /* Sair fica no rodapé da barra, onde a pessoa procura. */
    const rodape = document.querySelector('.lateral .rodape-lateral')
      || document.querySelector('.lateral');
    if (rodape && !document.getElementById('pt-sair')) {
      const bt = document.createElement('button');
      bt.id = 'pt-sair';
      bt.className = 'pt-sair';
      bt.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round"><path d="M15 17l5-5-5-5"/>' +
        '<path d="M20 12H9"/><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/></svg>' +
        '<span>Sair da conta</span>';
      bt.onclick = () => B7.Auth.sair();
      rodape.appendChild(bt);
    }

    document.body.classList.add('modo-portal');
  }

  const ICONE = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    aprovacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
    linha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3"/></svg>',
    producao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M4 12h10M4 17h13"/></svg>',
    semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    historico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 7v5l3.5 2"/><circle cx="12" cy="12" r="8.5"/></svg>'
  };

  /* =================================================================
     HOME
     ================================================================= */
  async function abrirHome() {
    const u = B7.Auth.usuario();
    const emp = empresa();
    marcarNav('#/');

    painel().innerHTML = '<div class="conteudo"><div class="b7-load">' +
      '<div class="simbolo"></div><div class="txt">Carregando seu acompanhamento…</div>' +
      '<div class="barra-load"><i></i></div></div></div>';

    /* serviço pausado ou cancelado tem tela própria, e nada é carregado */
    if (emp && emp.servico !== 'ativo') return telaServico(emp);

    let pendentes = [], producao = [], semana = null, linha = null;
    try {
      [pendentes, producao, semana, linha] = await Promise.all([
        B7.DB.aprovacoesDoCliente({ situacao: 'pendente' }).catch(() => []),
        B7.DB.conteudosVisiveis().catch(() => []),
        B7.DB.ultimoStatusPublicado().catch(() => null),
        B7.DB.linhaVisivelAtual().catch(() => null)
      ]);
    } catch (e) { /* segue com o que veio */ }

    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const primeiro = (u.nome || '').split(' ')[0];

    painel().innerHTML = '<div class="conteudo entra portal-home">' +

      '<header class="ph-cab">' +
        '<div>' +
          '<div class="ph-saud">' + esc(saudacao) + ', ' + esc(primeiro) + '.</div>' +
          '<h1>Sua produção na Branding7</h1>' +
          (emp ? '<p class="ph-emp">' + esc(emp.nome) + '</p>' : '') +
        '</div>' +
      '</header>' +

      /* ---- o que depende do cliente vem primeiro ---- */
      '<section class="ph-secao">' +
        '<div class="ph-titulo"><h2>Precisa da sua atenção</h2>' +
          (pendentes.length
            ? '<span class="ph-conta">' + pendentes.length + '</span>' : '') +
        '</div>' +
        (pendentes.length
          ? '<div class="ph-lista">' + pendentes.map(cartaoPendente).join('') + '</div>'
          : '<div class="ph-vazio"><div class="ph-vazio-ic">' + ICONE.aprovacoes + '</div>' +
            '<b>Nada aguardando você.</b>' +
            '<p>Quando a Branding7 enviar um material para sua aprovação, ele aparece aqui.</p>' +
            '</div>') +
      '</section>' +

      /* ---- panorama curto, só com número que significa algo ---- */
      '<section class="ph-numeros">' +
        numero(pendentes.length, 'Aguardando sua aprovação',
               'materiais enviados que ainda não têm sua decisão', '#/aprovacoes') +
        numero(producao.length, 'Em acompanhamento',
               'conteúdos liberados para você acompanhar', '#/minha-producao') +
      '</section>' +

      /* ---- o que a B7 publicou ---- */
      '<section class="ph-duplo">' +
        blocoLinha(linha) +
        blocoSemana(semana) +
      '</section>' +
    '</div>';

    ligar();
  }

  function cartaoPendente(a) {
    const quando = a.enviado_em ? B7.UI.quando(a.enviado_em) : '';
    return '<button class="ph-item" data-aprovacao="' + esc(a.id) + '">' +
      '<span class="ph-item-tipo">' + esc(FORMATOS[a.tipo] || a.tipo) + '</span>' +
      '<span class="ph-item-tx">' +
        '<b>' + esc(a.titulo || 'Sem título') + '</b>' +
        '<small>versão ' + String(a.versao).padStart(2, '0') +
        (quando ? ' · enviado ' + esc(quando) : '') +
        (a.comentarios_abertos ? ' · ' + a.comentarios_abertos + ' observação(ões)' : '') +
        '</small>' +
      '</span>' +
      '<span class="ph-item-ir">Revisar →</span>' +
    '</button>';
  }

  function numero(valor, titulo, ajuda, destino) {
    return '<button class="ph-num" data-ir="' + destino + '">' +
      '<b>' + valor + '</b><span>' + esc(titulo) + '</span>' +
      '<small>' + esc(ajuda) + '</small></button>';
  }

  function blocoLinha(l) {
    if (!l) {
      return '<div class="ph-bloco vazio"><h3>Linha editorial</h3>' +
        '<p>Nenhum planejamento liberado para este período.</p></div>';
    }
    return '<button class="ph-bloco" data-ir="#/minha-linha">' +
      '<h3>Linha editorial</h3>' +
      '<b>' + esc(l.nome || 'Planejamento') + '</b>' +
      '<p>' + (l.total_conteudos || 0) + ' conteúdos planejados</p>' +
      '<span class="ph-ir">Abrir →</span></button>';
  }

  function blocoSemana(s) {
    if (!s) {
      return '<div class="ph-bloco vazio"><h3>Status semanal</h3>' +
        '<p>Nenhum relatório publicado ainda.</p></div>';
    }
    return '<button class="ph-bloco" data-ir="#/meus-status">' +
      '<h3>Status semanal</h3>' +
      '<b>' + esc(B7.DocSemana ? B7.DocSemana.periodoTexto(s.semana_inicio, s.semana_fim)
                                : 'Semana') + '</b>' +
      '<p>' + (s.total_itens || 0) + ' demandas no período</p>' +
      '<span class="ph-ir">Abrir →</span></button>';
  }

  /* =================================================================
     SERVIÇO PAUSADO OU CANCELADO
     O desfoque é só apresentação: nada privado é carregado por trás.
     ================================================================= */
  function telaServico(emp) {
    const cancelado = emp.servico === 'cancelado';
    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="ph-bloqueio">' +
        '<div class="ph-bloqueio-fundo" aria-hidden="true">' +
          '<div class="ph-fake"></div><div class="ph-fake"></div><div class="ph-fake curto"></div>' +
        '</div>' +
        '<div class="ph-bloqueio-caixa">' +
          '<img class="ph-marca" src="assets/brand/logo-color.png" alt="Branding7">' +
          '<h2>' + (cancelado ? 'Serviço encerrado' : 'Serviço temporariamente pausado') + '</h2>' +
          '<p>' + esc(emp.mensagem || (cancelado
            ? 'Seu serviço com a Branding7 foi encerrado. O histórico permanece guardado.'
            : 'O acompanhamento está suspenso no momento. Nada foi perdido: ' +
              'seus materiais continuam guardados.')) + '</p>' +
          '<p class="ph-bloqueio-ct">Fale com a Branding7 para mais informações.</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* =================================================================
     APROVAÇÕES — lista
     ================================================================= */
  async function abrirAprovacoes(filtro) {
    marcarNav('#/aprovacoes');
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') return telaServico(emp);

    painel().innerHTML = '<div class="conteudo"><div class="b7-load">' +
      '<div class="simbolo"></div><div class="txt">Carregando…</div></div></div>';

    const situacao = filtro || 'pendente';
    let itens = [];
    try { itens = await B7.DB.aprovacoesDoCliente({ situacao }); } catch (e) { itens = []; }

    const abas = [['pendente', 'Pendentes'], ['ajustes', 'Ajustes solicitados'],
                  ['aprovado', 'Aprovados'], ['todos', 'Histórico']];

    painel().innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab"><div><h1>Aprovações</h1>' +
      '<p class="ph-emp">Materiais que a Branding7 enviou para você.</p></div></header>' +

      '<div class="abas">' + abas.map(([v, r]) =>
        '<button class="aba' + (v === situacao ? ' on' : '') + '" data-filtro="' + v + '">' +
        esc(r) + '</button>').join('') + '</div>' +

      (itens.length
        ? '<div class="ph-lista">' + itens.map(cartaoPendente).join('') + '</div>'
        : '<div class="ph-vazio"><b>Nada por aqui.</b>' +
          '<p>' + (situacao === 'pendente'
            ? 'Nenhum material aguardando sua decisão.'
            : 'Nenhum material nesta situação ainda.') + '</p></div>') +
    '</div>';

    painel().querySelectorAll('[data-filtro]').forEach(b =>
      b.onclick = () => abrirAprovacoes(b.dataset.filtro));
    ligar();
  }

  /* =================================================================
     AUXILIARES
     ================================================================= */
  function marcarNav(destino) {
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('on', a.dataset.ir === destino));
  }

  function ligar() {
    painel().querySelectorAll('[data-aprovacao]').forEach(b =>
      b.onclick = () => { location.hash = '#/revisar/' + b.dataset.aprovacao; });
  }



  /* =================================================================
     LINHA EDITORIAL DO CLIENTE
     O planejamento do mês que a equipe liberou. Sem notas internas,
     sem campos técnicos.
     ================================================================= */
  async function abrirLinha() {
    marcarNav('#/minha-linha');
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') return telaServico(emp);
    carregando('Carregando o planejamento…');

    let linha = null, conteudos = [];
    try {
      linha = await B7.DB.linhaVisivelAtual();
      if (linha) conteudos = await B7.DB.conteudosVisiveis().catch(() => []);
    } catch (e) {}

    if (!linha) {
      return tela('Linha editorial',
        'O planejamento de conteúdo do mês.',
        vazio('Nenhum planejamento liberado ainda.',
              'Assim que a Branding7 publicar a linha editorial do mês, ela aparece aqui.'));
    }

    const doMes = conteudos.filter(c => c.linha_id === linha.id);
    tela('Linha editorial', esc(linha.nome || 'Planejamento do mês'),
      (linha.objetivo
        ? '<div class="pt-destaque"><small>OBJETIVO DO MÊS</small><p>' +
          esc(linha.objetivo) + '</p></div>' : '') +

      (doMes.length
        ? '<div class="pt-grade">' + doMes.map(c =>
            '<article class="pt-item">' +
              '<span class="pt-formato">' + esc(c.tipo || 'Conteúdo') + '</span>' +
              '<h4>' + esc(c.titulo || 'Sem título') + '</h4>' +
              (c.data_postagem
                ? '<span class="pt-data">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span>' : '') +
              (c.objetivo ? '<p>' + esc(c.objetivo) + '</p>' : '') +
            '</article>').join('') + '</div>'
        : vazio('O planejamento ainda não tem conteúdos liberados.',
                'A equipe libera cada peça conforme fica pronta.')));
  }

  /* =================================================================
     PRODUÇÃO — o andamento do que é da empresa
     ================================================================= */
  async function abrirProducao() {
    marcarNav('#/minha-producao');
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') return telaServico(emp);
    carregando('Carregando a produção…');

    let conteudos = [], aprovacoes = [];
    try {
      [conteudos, aprovacoes] = await Promise.all([
        B7.DB.conteudosVisiveis().catch(() => []),
        B7.DB.aprovacoesDoCliente({ situacao: 'todos' }).catch(() => [])
      ]);
    } catch (e) {}

    /* Situação em linguagem de cliente, não o estado técnico interno. */
    const situacaoDe = c => {
      const ap = aprovacoes.filter(a => a.alvo_id === c.id)
        .sort((a, b) => (b.versao || 0) - (a.versao || 0))[0];
      if (ap && ap.situacao === 'aprovado') return ['aprovado', 'Aprovado'];
      if (ap && ap.situacao === 'ajustes')  return ['ajustes', 'Em ajuste'];
      if (ap && ap.situacao === 'pendente') return ['pendente', 'Aguardando você'];
      return ['producao', 'Em produção'];
    };

    if (!conteudos.length) {
      return tela('Produção', 'O andamento dos materiais da sua empresa.',
        vazio('Nada liberado para acompanhamento ainda.',
              'A equipe libera os materiais conforme avança a produção.'));
    }

    tela('Produção', 'O andamento dos materiais da sua empresa.',
      '<div class="pt-lista">' + conteudos.map(c => {
        const [cls, rot] = situacaoDe(c);
        return '<div class="pt-linha-item">' +
          '<div><b>' + esc(c.titulo || 'Sem título') + '</b>' +
          '<span>' + esc(c.tipo || 'Conteúdo') +
          (c.data_postagem ? ' · ' + esc(B7.UI.dataBR(c.data_postagem)) : '') + '</span></div>' +
          '<span class="pt-sit ' + cls + '">' + rot + '</span>' +
        '</div>';
      }).join('') + '</div>');
  }

  /* =================================================================
     STATUS SEMANAL PUBLICADO
     ================================================================= */
  async function abrirStatus() {
    marcarNav('#/meus-status');
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') return telaServico(emp);
    carregando('Carregando os relatórios…');

    let ultimo = null;
    try { ultimo = await B7.DB.ultimoStatusPublicado(); } catch (e) {}

    if (!ultimo) {
      return tela('Status semanal', 'O acompanhamento de sete dias.',
        vazio('Nenhum relatório publicado ainda.',
              'A Branding7 publica aqui o resumo de cada semana.'));
    }

    tela('Status semanal', 'O acompanhamento de sete dias.',
      '<div class="pt-destaque">' +
        '<small>SEMANA DE ' + esc(B7.UI.dataBR(ultimo.semana_inicio)) +
        ' A ' + esc(B7.UI.dataBR(ultimo.semana_fim)) + '</small>' +
        '<p>Publicado ' + esc(B7.UI.quando(ultimo.publicado_em)) + '.</p>' +
      '</div>' +
      '<div class="pt-lista" id="pt-semana-itens"></div>');

    try {
      const itens = await B7.DB.itensDoStatus(ultimo.id);
      const alvo = document.getElementById('pt-semana-itens');
      if (!alvo) return;
      alvo.innerHTML = itens.length
        ? itens.map(i => '<div class="pt-linha-item"><div><b>' + esc(i.titulo) + '</b>' +
            '<span>' + esc(i.etapa || '') +
            (i.data ? ' · ' + esc(B7.UI.dataBR(i.data)) : '') + '</span></div>' +
            '<span class="pt-sit">' + esc(i.situacao || '') + '</span></div>').join('')
        : '<p class="pt-nada">Sem demandas registradas nesta semana.</p>';
    } catch (e) {}
  }

  /* =================================================================
     HISTÓRICO — tudo que já foi decidido
     ================================================================= */
  async function abrirHistorico() {
    marcarNav('#/historico');
    const emp = empresa();
    if (emp && emp.servico !== 'ativo') return telaServico(emp);
    carregando('Carregando o histórico…');

    let itens = [];
    try { itens = await B7.DB.aprovacoesDoCliente({ situacao: 'todos' }); } catch (e) {}
    const decididos = itens.filter(a => a.situacao !== 'pendente');

    if (!decididos.length) {
      return tela('Histórico', 'Tudo que você já revisou.',
        vazio('Nada decidido ainda.',
              'Quando você aprovar ou pedir ajustes em um material, ele aparece aqui.'));
    }

    tela('Histórico', 'Tudo que você já revisou.',
      '<div class="pt-lista">' + decididos.map(a =>
        '<div class="pt-linha-item" data-ir="#/revisar/' + esc(a.id) + '">' +
          '<div><b>' + esc(a.titulo || 'Material') + '</b>' +
          '<span>' + esc(rotuloTipo(a.tipo)) + ' · versão ' + (a.versao || 1) +
          (a.enviado_em ? ' · ' + esc(B7.UI.quando(a.enviado_em)) : '') + '</span></div>' +
          '<span class="pt-sit ' + esc(a.situacao) + '">' +
          esc(rotuloSituacao(a.situacao)) + '</span>' +
        '</div>').join('') + '</div>');
  }

  /* ---- utilidades das telas do portal ---- */
  function carregando(texto) {
    painel().innerHTML = '<div class="conteudo"><div class="b7-load">' +
      '<div class="simbolo"></div><div class="txt">' + esc(texto) + '</div>' +
      '<div class="barra-load"><i></i></div></div></div>';
  }

  function tela(titulo, subtitulo, corpo) {
    painel().innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab"><div><h1>' + esc(titulo) + '</h1>' +
      '<p class="ph-emp">' + subtitulo + '</p></div></header>' +
      corpo +
    '</div>';
  }

  function vazio(titulo, texto) {
    return '<div class="pt-vazio"><div class="b7-marca fraca"></div>' +
      '<b>' + esc(titulo) + '</b><p>' + esc(texto) + '</p></div>';
  }

  /* =================================================================
     REVISÃO DE UM MATERIAL

     O cliente lê, decide por cena e decide o roteiro inteiro. Nunca
     edita: o texto pertence ao editor da equipe. O que ele escreve vira
     comentário, não substituição.
     ================================================================= */
  async function abrirRevisao(id) {
    marcarNav('#/aprovacoes');
    painel().innerHTML = '<div class="conteudo entra portal-revisao"></div>';
    conteudo().innerHTML = '<div class="b7-load"><div class="simbolo"></div>' +
      '<div class="txt">Abrindo material…</div><div class="barra-load"><i></i></div></div>';

    let ap, partes = [], comentarios = [];
    try {
      ap = await B7.DB.aprovacao(id);
      if (!ap) throw new Error('Material não encontrado.');
      [partes, comentarios] = await Promise.all([
        B7.DB.partesDaAprovacao(id).catch(() => []),
        B7.DB.comentariosAprovacao(id).catch(() => [])
      ]);
    } catch (e) {
      return conteudo().innerHTML = '<div class="pt-vazio"><b>' +
        esc(e.message || 'Não foi possível abrir este material.') + '</b></div>';
    }

    const snap = ap.snapshot || {};
    const cenas = Array.isArray(snap.cenas) ? snap.cenas : [];
    const decidido = ap.situacao !== 'pendente';
    const decisaoDe = pid => (partes.find(x => x.parte_id === pid) || {}).situacao || 'pendente';
    /* Quem decide é o cliente marcado como aprovador. Os demais veem,
       comentam e acompanham — sem botão de decisão, para não parecer
       que aprovaram quando o banco recusou em silêncio. */
    const u = B7.Auth.usuario() || {};
    const aprovador = u.papel !== 'cliente' || !!u.pode_aprovar;
    const podeAprovar = !B7.Portal.somenteLeitura && !decidido && aprovador;

    conteudo().innerHTML =
      '<a class="pt-voltar" href="#/aprovacoes">← Aprovações</a>' +

      '<header class="pt-rev-cab">' +
        '<div>' +
          '<span class="pt-tipo">' + esc(rotuloTipo(ap.tipo)) + ' · versão ' + (ap.versao || 1) + '</span>' +
          '<h1>' + esc(snap.titulo || 'Material') + '</h1>' +
          '<p>Enviado ' + esc(B7.UI.quando(ap.enviado_em)) +
            (ap.observacao_envio ? ' · ' + esc(ap.observacao_envio) : '') + '</p>' +
        '</div>' +
        '<span class="pt-sit ' + esc(ap.situacao) + '">' + esc(rotuloSituacao(ap.situacao)) + '</span>' +
      '</header>' +

      (cenas.length
        ? '<div class="pt-cenas">' + cenas.map((c, i) => cartaoCena(c, i, decisaoDe, podeAprovar)).join('') + '</div>'
        : '<div class="pt-corpo-simples">' + corpoSimples(snap) + '</div>') +

      /* Comentário geral: o cliente diz o que pensa do conjunto, sem
         precisar escolher uma cena. */
      '<section class="pt-bloco">' +
        '<h3>Observações</h3>' +
        '<div class="pt-coments" id="pt-coments">' +
          (comentarios.length ? comentarios.map(comentario).join('')
            : '<p class="pt-nada">Nenhuma observação ainda.</p>') +
        '</div>' +
        (B7.Portal.somenteLeitura ? '' :
          '<div class="pt-novo-com">' +
            '<input class="campo" id="pt-com" placeholder="Escrever uma observação…">' +
            '<button class="b pri" id="pt-com-add">Enviar</button>' +
          '</div>') +
      '</section>' +

      (podeAprovar
        ? '<div class="pt-decisao">' +
            '<div class="pt-decisao-tx"><b>Sua decisão sobre esta versão</b>' +
            '<span id="pt-aviso"></span></div>' +
            '<button class="b contorno" id="pt-ajustes">Solicitar ajustes</button>' +
            '<button class="b pri" id="pt-aprovar">Aprovar</button>' +
          '</div>'
        : '<div class="pt-decidido">' +
            (decidido
              ? 'Esta versão já foi ' + esc(rotuloSituacao(ap.situacao).toLowerCase()) +
                (ap.decidido_em ? ' ' + esc(B7.UI.quando(ap.decidido_em)) : '') + '.'
              : (aprovador ? 'Modo de visualização: nenhuma decisão é registrada.'
                         : 'Sua conta acompanha e comenta; a aprovação oficial fica com o responsável da empresa.')) +
          '</div>') +

      (ap.tipo === 'roteiro'
        ? '<div class="pt-baixar"><button class="b contorno" id="pt-pdf">Baixar PDF</button></div>'
        : '');

    ligarRevisao(ap, cenas, partes);
  }

  function cartaoCena(c, i, decisaoDe, podeAprovar) {
    const pid = c.id || ('cena-' + i);
    const sit = decisaoDe(pid);
    const campo = (rot, valor) => valor
      ? '<div class="pt-campo"><small>' + rot + '</small><p>' + esc(valor) + '</p></div>' : '';
    return '<article class="pt-cena ' + esc(sit) + '" data-parte="' + esc(pid) + '">' +
      '<div class="pt-cena-cab">' +
        '<span class="pt-cena-n">CENA ' + String(i + 1).padStart(2, '0') + '</span>' +
        (sit !== 'pendente'
          ? '<span class="pt-cena-sit ' + esc(sit) + '">' +
            (sit === 'aprovada' ? 'aprovada' : 'ajustes pedidos') + '</span>' : '') +
      '</div>' +
      /* Campos reais da cena: tipo, direção, texto e (na narração) a
         sugestão de cenas. Mantém compatibilidade com snapshots antigos. */
      '<div class="pt-cena-meta">' +
        (c.tipo ? '<span class="pt-cena-tipo">' + esc((c.funcao && c.funcao.trim()) || c.tipo) + '</span>' : '') +
        (c.direcao ? '<span class="pt-cena-dir">' + esc(c.direcao) + '</span>' : '') +
      '</div>' +
      (c.titulo ? '<h4>' + esc(c.titulo) + '</h4>' : '') +
      campo(c.tipo ? c.tipo.toUpperCase() : 'TEXTO', c.texto) +
      campo('SUGESTÃO DE CENAS', c.sugestao_cenas) +
      campo('HOOK', c.hook) + campo('NARRATIVA', c.narrativa) +
      campo('NARRAÇÃO', c.narracao) + campo('CTA', c.cta) +
      campo('TOMADA', c.tomada) +
      (podeAprovar
        ? '<div class="pt-cena-acoes">' +
            '<button class="b fina" data-cena-ajuste="' + esc(pid) + '">Pedir ajuste</button>' +
            '<button class="b fina pri" data-cena-ok="' + esc(pid) + '">Aprovar cena</button>' +
          '</div>'
        : '') +
    '</article>';
  }

  function corpoSimples(snap) {
    const campos = ['objetivo', 'ideia_geral', 'headline', 'legenda', 'cta', 'direcao'];
    const html = campos.filter(k => snap[k])
      .map(k => '<div class="pt-campo"><small>' + k.replace(/_/g, ' ').toUpperCase() +
        '</small><p>' + esc(snap[k]) + '</p></div>').join('');
    return html || '<p class="pt-nada">Este material não tem detalhes para exibir.</p>';
  }

  function comentario(c) {
    return '<div class="pt-com' + (c.resolvido ? ' resolvido' : '') + '">' +
      '<div class="pt-com-cab"><b>' + esc(c.autor_nome || 'Equipe') + '</b>' +
      (c.parte_rotulo ? '<i>' + esc(c.parte_rotulo) + '</i>' : '') +
      '<span>' + esc(B7.UI.quando(c.created_at)) + '</span></div>' +
      '<p>' + esc(c.texto) + '</p></div>';
  }

  function ligarRevisao(ap, cenas, partes) {
    const c = conteudo();

    /* decisão por cena */
    c.querySelectorAll('[data-cena-ok]').forEach(b => b.onclick = async () => {
      await decidirCena(ap.id, b.dataset.cenaOk, 'aprovada');
      abrirRevisao(ap.id);
    });
    c.querySelectorAll('[data-cena-ajuste]').forEach(b => b.onclick = async () => {
      const texto = await B7.UI.perguntar({
        titulo: 'O que precisa mudar nesta cena?',
        rotulo: 'Sua observação vai para a equipe. O texto não muda sozinho.',
        placeholder: 'ex.: trocar o exemplo do início'
      });
      if (texto === null) return;
      await decidirCena(ap.id, b.dataset.cenaAjuste, 'ajustes');
      if (texto) {
        const i = [...c.querySelectorAll('[data-parte]')]
          .findIndex(x => x.dataset.parte === b.dataset.cenaAjuste);
        await B7.DB.comentarAprovacao(ap.id, texto, {
          parteId: b.dataset.cenaAjuste,
          parteRotulo: 'Cena ' + String(i + 1).padStart(2, '0')
        });
      }
      abrirRevisao(ap.id);
    });

    /* comentário geral */
    const add = c.querySelector('#pt-com-add');
    if (add) add.onclick = async () => {
      const campo = c.querySelector('#pt-com');
      const texto = campo.value.trim();
      if (!texto) return;
      add.disabled = true;
      try {
        await B7.DB.comentarAprovacao(ap.id, texto);
        abrirRevisao(ap.id);
      } catch (e) {
        add.disabled = false;
        B7.UI.toast('Não foi possível enviar a observação', { tipo: 'erro' });
      }
    };

    /* decisão do material inteiro */
    const bAprovar = c.querySelector('#pt-aprovar');
    if (bAprovar) bAprovar.onclick = async () => {
      /* Aprovar o todo com cenas em ajuste seria uma contradição
         registrada no histórico. A interface avisa e não deixa passar
         calado. */
      const emAjuste = partes.filter(p => p.situacao === 'ajustes');
      if (emAjuste.length) {
        const segue = await B7.UI.confirmar({
          titulo: 'Há cenas com ajustes pedidos',
          texto: emAjuste.length === 1
            ? 'Uma cena está marcada para ajuste. Aprovar tudo agora vai contra esse pedido.'
            : emAjuste.length + ' cenas estão marcadas para ajuste. Aprovar tudo agora vai contra esses pedidos.',
          confirmar: 'Aprovar mesmo assim'
        });
        if (!segue) return;
      }
      try {
        await B7.DB.decidirAprovacao(ap.id, 'aprovado');
        await avisarKanban(ap, 'aprovado');
        B7.UI.toast('Material aprovado');
        abrirRevisao(ap.id);
      } catch (e) {
        B7.UI.toast(e.message || 'Não foi possível registrar a aprovação', { tipo: 'erro' });
      }
    };

    const bAjustes = c.querySelector('#pt-ajustes');
    if (bAjustes) bAjustes.onclick = async () => {
      const texto = await B7.UI.perguntar({
        titulo: 'O que precisa ser ajustado?',
        rotulo: 'A equipe recebe sua observação e prepara uma nova versão.',
        placeholder: 'descreva o ajuste'
      });
      if (texto === null) return;
      try {
        /* a decisão vai antes do comentário: se ela for recusada, não
           fica um comentário órfão de um pedido que não aconteceu */
        await B7.DB.decidirAprovacao(ap.id, 'ajustes');
        if (texto) await B7.DB.comentarAprovacao(ap.id, texto).catch(() => {});
        await avisarKanban(ap, 'ajustes');
        B7.UI.toast('Ajustes solicitados');
        abrirRevisao(ap.id);
      } catch (e) {
        B7.UI.toast(e.message || 'Não foi possível registrar o pedido de ajustes', { tipo: 'erro' });
      }
    };

    const pdf = c.querySelector('#pt-pdf');
    if (pdf) pdf.onclick = async () => {
      /* O PDF sai do retrato enviado, não da tabela: o cliente baixa
         exatamente a versão que está decidindo. */
      const snap = ap.snapshot || {};
      if (!Array.isArray(snap.cenas) || !snap.cenas.length) {
        return B7.UI.toast('Esta versão não tem cenas para gerar o PDF', { tipo: 'erro' });
      }
      const roteiro = {
        id: ap.alvo_id, titulo: snap.titulo || '', objetivo: snap.objetivo || '',
        observacao_gravacao: snap.observacao_gravacao || '',
        escala: snap.escala || 1, escala_automatica: snap.escala_automatica !== false
      };
      const ctx = {
        cliente: snap.cliente || (empresa() || {}).nome || '',
        clienteLogo: snap.cliente_logo_url || null,
        gravacao: snap.gravacao || '',
        dataGravacao: snap.data_gravacao ? B7.UI.dataBR(snap.data_gravacao) : '',
        roteiros: [roteiro], cenasPorRoteiro: { [roteiro.id]: snap.cenas }
      };
      const nome = B7.Export.nomeArquivo([ctx.cliente, 'ROTEIRO', roteiro.titulo, 'V' + (ap.versao || 1)], 'pdf');
      pdf.disabled = true; pdf.textContent = 'Gerando PDF…';
      try { await B7.Export.gerarPDF(ctx, [roteiro.id], false, nome); }
      catch (e) { B7.UI.toast('Não foi possível gerar o PDF', { tipo: 'erro' }); }
      finally { pdf.disabled = false; pdf.textContent = 'Baixar PDF'; }
    };
  }

  async function decidirCena(aprovacaoId, parteId, situacao) {
    const el = conteudo().querySelector('[data-parte="' + parteId + '"]');
    const i = [...conteudo().querySelectorAll('[data-parte]')].indexOf(el);
    try {
      await B7.DB.decidirParte(aprovacaoId, parteId,
        'Cena ' + String(i + 1).padStart(2, '0'), situacao);
    } catch (e) {
      B7.UI.toast('Não foi possível registrar a decisão', { tipo: 'erro' });
    }
  }

  /* O quadro da equipe reage a um evento real do fluxo, não a um
     comentário solto. */
  async function avisarKanban(ap, evento) {
    if (B7.Kanban && B7.Kanban.reagirAprovacao) {
      await B7.Kanban.reagirAprovacao(ap.tipo, ap.alvo_id, evento).catch(() => {});
    }
  }

  const rotuloTipo = t => ({ roteiro: 'Roteiro', linha: 'Linha editorial',
    conteudo: 'Conteúdo', semana: 'Status semanal' }[t] || t);
  const rotuloSituacao = s => ({ pendente: 'Aguardando você',
    aprovado: 'Aprovado', ajustes: 'Ajustes pedidos', cancelado: 'Cancelado' }[s] || s);

  return { montarLayout, abrirHome, abrirAprovacoes, abrirRevisao,
           abrirLinha, abrirProducao, abrirStatus, abrirHistorico,
           telaServico, empresa, marcarNav, somenteLeitura: false };
})();
