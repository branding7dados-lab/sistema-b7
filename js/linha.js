/* =====================================================================
   LINHA EDITORIAL
   Abas: Visão geral · Estratégia · Criativos · Postagens.

   Pilares saíram da experiência: a linha editorial passou a ser sobre o que
   será produzido no mês, não sobre proporções. Os dados antigos continuam no
   banco intactos — só deixaram de ser lidos e exigidos aqui.
   Mesma linguagem visual do editor de roteiros, composição própria —
   o roteiro fala de cena e gravação, a linha fala do mês.

   Conteúdo de vídeo NÃO tem editor próprio: ele aponta para um roteiro
   do sistema (script_id) e abre o editor que já existe.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Linha = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const MESES = B7.UI.MESES;
  const C = B7.Conteudo;

  const CANAIS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn'];
  const ICONE_FORMATO = {
    Reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    Card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 9.5h9M7.5 13h6"/></svg>',
    Carrossel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="4.5" width="11" height="15" rx="2.5"/><path d="M3.5 8v8M20.5 8v8"/></svg>',
    Story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3.5" width="10" height="17" rx="2.5"/><path d="M10 20.5h4"/></svg>'
  };

  let L = { linha: null, conteudos: [], aba: 'geral', cliente: null };

  /* ------------------------------------------------------------ abrir */
  async function abrir(id, aba) {
    L.aba = aba || 'geral';
    painel().innerHTML = '<div class="conteudo">' +
      '<div class="b7-load"><div class="simbolo"></div><div class="txt">Abrindo a linha editorial…</div></div></div>';
    try {
      L.linha = await B7.DB.linha(id);
      [L.conteudos, L.cliente] = await Promise.all([
        B7.DB.listarConteudos(id), B7.DB.cliente(L.linha.client_id)
      ]);
    } catch (e) { return B7.Dashboard.erroConteudo(e, (L.linha || {}).client_id || ''); }

    B7.Rota.titulo([L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano), L.linha.cliente_nome]);
    render();
  }

  function render() {
    const l = L.linha;
    const abas = [['geral', 'Visão geral'], ['estrategia', 'Estratégia'],
                  ['criativos', 'Criativos'], ['postagens', 'Postagens']];

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span>' +
        '<button data-ir="#/clientes">Clientes</button><span>/</span>' +
        '<button data-ir="#/cliente/' + esc(l.client_id) + '">' + esc(l.cliente_nome) + '</button>' +
        '<span>/</span><button data-ir="#/cliente/' + esc(l.client_id) + '/linhas">Linhas editoriais</button>' +
        '<span>/</span><b>' + esc(l.nome || MESES[l.mes - 1] + ' ' + l.ano) + '</b></div>' +

      capa(l) +
      '<div class="abas-cliente">' + abas.map(([k, r]) =>
        '<button data-aba="' + k + '"' + (L.aba === k ? ' class="on"' : '') + '>' + r + '</button>').join('') +
      '</div>' +
      '<div id="corpo-linha">' +
        (L.aba === 'geral' ? visaoGeral() :
         L.aba === 'estrategia' ? estrategia() :
         L.aba === 'criativos' ? criativos() : postagens()) +
      '</div></div>';

    painel().querySelectorAll('[data-ir]').forEach(b => b.onclick = () => location.hash = b.dataset.ir);
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { L.aba = b.dataset.aba; render(); });
    C.ligarCampos(painel());
    B7.UI.ligarMenus(painel());
    ligarAba();
  }

  function capa(l) {
    const selo = l.cliente_logo_url
      ? '<div class="selo"><img src="' + esc(l.cliente_logo_url) + '" alt=""></div>'
      : '<div class="selo">' + esc(B7.UI.iniciais(l.cliente_nome)) + '</div>';
    const estruturados = L.conteudos.filter(c => c.status !== 'Ideia').length;
    return '<div class="capa-cliente"><div class="malha"></div><div class="brilho"></div>' +
      '<div class="b7-marca"></div>' + selo +
      '<div class="info"><div class="olho">LINHA EDITORIAL · ' + esc(l.cliente_nome.toUpperCase()) + '</div>' +
      '<h1>' + esc(l.nome || (MESES[l.mes - 1] + ' ' + l.ano)) + '</h1>' +
      '<div class="meta"><span>' + L.conteudos.length + ' conteúdo' + (L.conteudos.length === 1 ? '' : 's') + '</span>' +
      '<span class="p"></span><span>' + estruturados + ' estruturado' + (estruturados === 1 ? '' : 's') + '</span>' +
      (l.canais ? '<span class="p"></span><span>' + esc(l.canais) + '</span>' : '') + '</div></div>' +
      '<div class="acoes">' +
        '<button class="b pri" data-novo-conteudo>+ Novo conteúdo</button>' +
        '<button class="b clara" data-baixar-linha>Baixar PDF</button>' +
        '<div class="menu"><button class="ico" style="color:rgba(255,255,255,.7)">⋯</button><div class="lista">' +
          '<button data-duplicar-linha>Duplicar para outro mês</button>' +
          '<button data-status-semanal>Criar status semanal</button>' +
          '<div class="rot">STATUS DA LINHA</div>' +
          C.STATUS_LINHA.map(v => '<button data-status-linha="' + esc(v) + '">' +
            (l.status === v ? '● ' : '') + esc(v) + '</button>').join('') +
          '<hr><button data-portal-linha>' + (l.visivel_cliente ? '✓ Visível no portal do cliente' : 'Liberar no portal do cliente') + '</button>' +
          '<button data-arquivar-linha>' + (l.archived_at ? 'Desarquivar' : 'Arquivar') + '</button>' +
          '<button class="perigo" data-excluir-linha>Excluir linha editorial</button>' +
        '</div></div></div></div>';
  }

  /* ------------------------------------------------------- VISÃO GERAL */
  function visaoGeral() {
    const porFormato = {};
    C.FORMATOS.forEach(f => {
      const n = L.conteudos.filter(c => c.tipo === f).length;
      if (n) porFormato[f] = n;
    });
    const formatosUsados = Object.keys(porFormato);
    const maxF = Math.max(1, ...Object.values(porFormato));
    const total = L.conteudos.length;
    const estruturados = L.conteudos.filter(c => c.status !== 'Ideia').length;
    const canais = (L.linha.canais || '').split(',').map(x => x.trim()).filter(Boolean);

    const proximos = L.conteudos.filter(c => c.data_postagem)
      .sort((a, b) => a.data_postagem.localeCompare(b.data_postagem)).slice(0, 5);

    /* Linha nova e vazia: nada de gráfico de zero. Só o convite para começar. */
    if (!total) {
      return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        '<b>Comece o planejamento de ' + esc(L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano)) + '.</b>' +
        '<p>Crie o primeiro conteúdo do mês. As informações de estratégia podem vir depois — ' +
        'ou nunca, se não fizerem falta.</p>' +
        '<div class="acoes">' +
          '<button class="b" data-ir-aba="estrategia">Adicionar informações</button>' +
          '<button class="b pri" data-novo-conteudo>+ Novo conteúdo</button>' +
        '</div></div>';
    }

    const metricas = [
      [total, total === 1 ? 'CONTEÚDO' : 'CONTEÚDOS'],
      estruturados ? [estruturados, 'ESTRUTURADOS'] : null,
      canais.length ? [canais.length, canais.length === 1 ? 'CANAL' : 'CANAIS'] : null,
      L.linha.meta_conteudos ? [L.linha.meta_conteudos, 'META'] : null
    ].filter(Boolean);

    return '<div class="mini-metricas">' + metricas.map(([n, r]) =>
        '<div class="mini-metrica"><b>' + n + '</b><span>' + r + '</span></div>').join('') +
      '</div>' +

      '<div class="colunas"><div>' +
        /* um único formato não merece gráfico: a métrica acima já disse tudo */
        (formatosUsados.length > 1
          ? '<div class="bloco mb"><h3>Distribuição por formato</h3>' +
            formatosUsados.map(f =>
              '<div class="barra-linha"><span class="rot-barra">' + f + '</span>' +
              '<div class="barra"><i style="width:' + (porFormato[f] / maxF * 100) + '%"></i></div>' +
              '<b>' + porFormato[f] + '</b></div>').join('') + '</div>'
          : '') +

        '<div class="bloco mb"><h3>Criativos do mês</h3>' +
          L.conteudos.slice(0, 6).map(c =>
            '<div class="proximo" data-conteudo="' + esc(c.id) + '">' +
            '<div class="tx" style="padding-left:0"><small>' + esc(c.tipo.toUpperCase()) + '</small>' +
            '<b>' + esc(c.titulo || 'Sem título') + '</b></div></div>').join('') +
          (total > 6 ? '<button class="b p" data-ir-aba="criativos">Ver os ' + total + '</button>'
                     : '<button class="b p" data-ir-aba="criativos">Abrir criativos</button>') +
        '</div>' +
      '</div><div class="apoio">' +
        (proximos.length ? '<div class="bloco"><h3>Próximos conteúdos</h3>' +
          proximos.map(c =>
            '<div class="proximo" data-conteudo="' + esc(c.id) + '">' +
            '<div class="dia"><b>' + esc(c.data_postagem.slice(8, 10)) + '</b>' +
            '<small>' + esc(MESES[+c.data_postagem.slice(5, 7) - 1].slice(0, 3).toUpperCase()) + '</small></div>' +
            '<div class="tx"><small>' + esc(c.tipo.toUpperCase()) + '</small>' +
            '<b>' + esc(c.titulo || 'Sem título') + '</b></div></div>').join('') +
          '</div>' : '') +
        (L.linha.objetivo ? '<div class="bloco"><h3>Objetivo do mês</h3>' +
          '<p class="texto-bloco">' + esc(L.linha.objetivo) + '</p></div>' : '') +
      '</div></div>';
  }

  /* -------------------------------------------------------- ESTRATÉGIA */
  function estrategia() {
    const l = L.linha;
    const t = 'data-tab="linhas_editoriais" data-id="' + esc(l.id) + '"';
    const canais = (l.canais || '').split(',').map(x => x.trim()).filter(Boolean);

    return '<p class="nota-secao">Todos os campos desta aba são opcionais. O que estiver vazio ' +
      'simplesmente não aparece no documento.</p>' +

      '<div class="bloco mb"><h3>Referências do mês</h3>' +
        '<p class="ajuda" style="margin-bottom:10px">Links que servem de base para os ' +
        'conteúdos deste mês. Um por linha.</p>' +
        C.campo('LINKS DE REFERÊNCIA', l.referencias,
          t + ' data-campo="referencias" placeholder="https://…"') +
      '</div>' +

      '<div class="bloco mb"><h3>Informações gerais</h3>' +
        '<div class="linha mb">' +
          '<div><label class="rot">INÍCIO DO PERÍODO</label>' +
          '<input class="campo" type="date" value="' + esc(l.periodo_inicio || '') + '" ' + t + ' data-campo="periodo_inicio"></div>' +
          '<div><label class="rot">FIM DO PERÍODO</label>' +
          '<input class="campo" type="date" value="' + esc(l.periodo_fim || '') + '" ' + t + ' data-campo="periodo_fim"></div>' +
          '<div><label class="rot">META DE CONTEÚDOS</label>' +
          '<input class="campo" type="number" min="0" value="' + esc(l.meta_conteudos || '') + '" ' + t + ' data-campo="meta_conteudos"></div>' +
        '</div>' +
        '<label class="rot">CANAIS</label><div class="chips-canais">' +
          CANAIS.map(c => '<button class="chip-canal' + (canais.includes(c) ? ' on' : '') +
            '" data-canal="' + c + '">' + c + '</button>').join('') +
          canais.filter(c => !CANAIS.includes(c)).map(c =>
            '<button class="chip-canal on" data-canal="' + esc(c) + '">' + esc(c) + '</button>').join('') +
          '<button class="chip-canal add" id="canal-novo">+ Outro</button>' +
        '</div>' +
      '</div>' +

      '<div class="bloco mb"><h3>Objetivo principal</h3>' +
        C.campo('OBJETIVO DO PERÍODO', l.objetivo, t + ' data-campo="objetivo"') +
        C.campo('O QUE A ESTRATÉGIA PRETENDE GERAR', l.objetivo_detalhe, t + ' data-campo="objetivo_detalhe"') +
      '</div>' +

      '<div class="bloco"><h3>Posicionamento</h3>' +
        '<div class="linha-acao"><button class="b fina contorno" id="usar-inteligencia">' +
          'Usar posicionamento do cliente</button>' +
          '<small>Traz o que está na Inteligência. Editar aqui não altera o cadastro do cliente.</small></div>' +
        C.campo('A MARCA SE POSICIONA COMO', l.posicionamento, t + ' data-campo="posicionamento"') +
        C.campo('TOM DE VOZ', l.tom_voz, t + ' data-campo="tom_voz"') +
        C.campo('PROPOSTA ÚNICA DE VALOR', l.puv, t + ' data-campo="puv"') +
        C.campo('PERCEPÇÃO DESEJADA', l.percepcao, t + ' data-campo="percepcao"') +
      '</div>';
  }

  /* --------------------------------------------------------- CRIATIVOS */
  function criativos() {
    if (!L.conteudos.length) {
      return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        '<b>Nenhum conteúdo ainda.</b>' +
        '<p>Cada conteúdo vira um card com a estrutura do formato: reel, card, carrossel ou story.</p>' +
        '<div class="acoes"><button class="b pri" data-novo-conteudo>+ Novo conteúdo</button></div></div>';
    }
    return '<div class="grade-criativos" id="lista-criativos">' +
      L.conteudos.map((c, i) => cardConteudo(c, i)).join('') + '</div>' +
      '<button class="add-largo" data-novo-conteudo>+ NOVO CONTEÚDO</button>';
  }

  function cardConteudo(c, i) {

    return '<div class="card-criativo spot eleva" data-conteudo="' + esc(c.id) + '">' +
      '<div class="cc-topo"><span class="cc-num">POST ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="cc-formato">' + ICONE_FORMATO[c.tipo] + esc(c.tipo) + '</span></div>' +
      '<h3>' + esc(c.titulo || 'Sem título') + '</h3>' +
      '<div class="cc-meta">' +
        (c.canal ? '<span>' + esc(c.canal) + '</span><span class="p"></span>' : '') +
        '<span>' + (c.data_postagem ? B7.UI.dataBR(c.data_postagem) : 'sem data') + '</span></div>' +
      '<div class="cc-rodape">' + chipConteudo(c.status) +
        '<button class="cc-espiar" data-espiar="' + esc(c.id) + '" title="Visualização rápida">👁</button>' +
        '<span class="abrir">Abrir →</span></div></div>';
  }

  function chipConteudo(s) {
    const mapa = { 'Ideia': 'criacao', 'Em criação': 'criacao', 'Em revisão': 'revisao',
                   'Aprovado': 'aprovado', 'Programado': 'pronto', 'Publicado': 'gravado' };
    return '<span class="chip-revisao ' + (mapa[s] || 'criacao') + '">' + esc(s) + '</span>';
  }

  /* --------------------------------------------------------- POSTAGENS
     Duas visualizações: lista e calendário do mês da linha. É calendário
     editorial, não agenda: cada dia mostra o que está marcado para ele. */
  let vistaPostagens = 'lista';

  function calendario() {
    const semData = L.conteudos.filter(c => !c.data_postagem);
    const l = L.linha;
    const primeiro = new Date(l.ano, l.mes - 1, 1);
    const dias = new Date(l.ano, l.mes, 0).getDate();
    const inicio = primeiro.getDay();               // 0 = domingo
    const porDia = {};
    L.conteudos.filter(c => c.data_postagem).forEach(c => {
      const d = c.data_postagem;
      if (+d.slice(0, 4) === l.ano && +d.slice(5, 7) === l.mes) {
        (porDia[+d.slice(8, 10)] = porDia[+d.slice(8, 10)] || []).push(c);
      }
    });
    const foraDoMes = L.conteudos.filter(c => c.data_postagem &&
      (+c.data_postagem.slice(0, 4) !== l.ano || +c.data_postagem.slice(5, 7) !== l.mes));

    let celulas = '';
    for (let i = 0; i < inicio; i++) celulas += '<div class="cal-cel vazia"></div>';
    for (let d = 1; d <= dias; d++) {
      const itens = porDia[d] || [];
      celulas += '<div class="cal-cel' + (itens.length ? ' com' : '') + '">' +
        '<div class="cal-dia">' + d + '</div>' +
        itens.map(c => '<button class="cal-item" data-conteudo="' + esc(c.id) + '" ' +
          'title="' + esc(c.titulo || 'Sem título') + '">' +
          '<span class="cal-ic">' + ICONE_FORMATO[c.tipo] + '</span>' +
          '<span class="cal-tx">' + esc(c.titulo || 'Sem título') + '</span></button>').join('') +
      '</div>';
    }

    return '<div class="cal-grade-topo">' +
        ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => '<span>' + d + '</span>').join('') +
      '</div><div class="cal-grade">' + celulas + '</div>' +
      (foraDoMes.length ? '<div class="aviso-suave">' + foraDoMes.length +
        ' conteúdo' + (foraDoMes.length === 1 ? '' : 's') + ' com data fora de ' +
        esc(MESES[l.mes - 1]) + ' — aparece' + (foraDoMes.length === 1 ? '' : 'm') +
        ' na lista.</div>' : '') +
      /* sem data não é pendência: é conteúdo que ainda não foi agendado */
      (semData.length ? '<div class="cal-sem-data"><small>SEM DATA DEFINIDA</small>' +
        semData.map(c => '<button class="cal-item" data-conteudo="' + esc(c.id) + '" ' +
          'title="' + esc(c.titulo || 'Sem título') + '">' +
          '<span class="cal-ic">' + ICONE_FORMATO[c.tipo] + '</span>' +
          '<span class="cal-tx">' + esc(c.titulo || 'Sem título') + '</span></button>').join('') +
        '</div>' : '');
  }

  function postagens() {
    const comData = L.conteudos.filter(c => c.data_postagem)
      .sort((a, b) => a.data_postagem.localeCompare(b.data_postagem));
    const semData = L.conteudos.filter(c => !c.data_postagem);

    if (!L.conteudos.length) {
      return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        '<b>Nenhuma postagem ainda.</b><p>Os conteúdos aparecem aqui assim que forem criados.</p>' +
        '<div class="acoes"><button class="b pri" data-novo-conteudo>+ Novo conteúdo</button></div></div>';
    }

    const seletor = '<div class="vista-postagens">' +
      '<button data-vista="lista"' + (vistaPostagens === 'lista' ? ' class="on"' : '') + '>Lista</button>' +
      '<button data-vista="calendario"' + (vistaPostagens === 'calendario' ? ' class="on"' : '') + '>Calendário</button>' +
      '</div>';
    if (vistaPostagens === 'calendario') return seletor + '<div class="bloco">' + calendario() + '</div>';

    const linhaPost = c => {
  
      return '<div class="post-linha" data-conteudo="' + esc(c.id) + '">' +
        '<div class="post-data">' + (c.data_postagem
          ? '<b>' + esc(c.data_postagem.slice(8, 10)) + '</b><small>' +
            esc(MESES[+c.data_postagem.slice(5, 7) - 1].slice(0, 3).toUpperCase()) + '</small>'
          : '<span class="sem-data">—</span>') + '</div>' +
        '<span class="post-formato">' + ICONE_FORMATO[c.tipo] + '</span>' +
        '<div class="post-tx"><b>' + esc(c.titulo || 'Sem título') + '</b>' +
        '<small>' +
        (c.canal ? ' · ' + esc(c.canal) : '') + '</small></div>' +
        chipConteudo(c.status) + '</div>';
    };

    return seletor + '<div class="bloco">' +
      (comData.length ? '<h3>Com data definida</h3>' + comData.map(linhaPost).join('') : '') +
      (semData.length ? '<h3 style="margin-top:18px">Sem data definida</h3>' +
        semData.map(linhaPost).join('') : '') + '</div>';
  }

  /* ==================================================== interações */
  function ligarAba() {
    const p = painel();

    p.querySelectorAll('[data-novo-conteudo]').forEach(b => b.onclick = () => modalNovoConteudo());
    p.querySelectorAll('[data-espiar]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const c = L.conteudos.find(x => x.id === b.dataset.espiar);
      if (c) B7.QuickView.abrirConteudo(c, {
        cliente: L.linha.cliente_nome, clienteLogo: L.linha.cliente_logo_url,
        linha: L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano)
      });
    });
    p.querySelectorAll('[data-conteudo]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      abrirConteudo(el.dataset.conteudo);
    });
    p.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      vistaPostagens = b.dataset.vista; render();
    });
    p.querySelectorAll('[data-status-semanal]').forEach(b => b.onclick = () =>
      B7.Semana.modalNovo(L.linha.client_id, L.linha.id));
    const baixar = p.querySelector('[data-baixar-linha]');
    if (baixar) baixar.onclick = () => B7.BaixarLinha.abrir(L.linha.id);
    const dup = p.querySelector('[data-duplicar-linha]');
    if (dup) dup.onclick = () => modalDuplicar();
    ligarArrasto();

    p.querySelectorAll('[data-status-linha]').forEach(b => b.onclick = async () => {
      const v = b.dataset.statusLinha;
      try {
        await B7.Save.acao(() => B7.DB.atualizarLinha(L.linha.id, { status: v }), 'Status: ' + v);
        if (v === 'Aprovada' || v === 'Finalizada') {
          B7.DB.registrar({ tipo: 'status', entidade: 'linha', id: L.linha.id,
            cliente: L.linha.client_id, texto: (L.linha.nome || 'Linha editorial') + ' → ' + v });
        }
        L.linha.status = v;
        render();
      } catch (e) {}
    });
    /* Liberar no portal é uma decisão explícita da equipe: nada fica
       visível ao cliente só porque foi salvo. */
    const portal = p.querySelector('[data-portal-linha]');
    if (portal) portal.onclick = async () => {
      const ligar = !L.linha.visivel_cliente;
      try {
        await B7.Save.acao(() => B7.DB.atualizarLinha(L.linha.id, { visivel_cliente: ligar }),
          ligar ? 'Linha liberada no portal do cliente' : 'Linha oculta do portal');
        L.linha.visivel_cliente = ligar;
        render();
      } catch (e) {}
    };

    const arquivar = p.querySelector('[data-arquivar-linha]');
    if (arquivar) arquivar.onclick = async () => {
      const ligar = !L.linha.archived_at;
      try {
        await B7.Save.acao(() => B7.DB.arquivarLinha(L.linha.id, ligar),
          ligar ? 'Linha arquivada' : 'Linha desarquivada');
        L.linha.archived_at = ligar ? new Date().toISOString() : null;
        render();
      } catch (e) {}
    };
    const excluir = p.querySelector('[data-excluir-linha]');
    if (excluir) excluir.onclick = () => B7.UI.confirmar({
      titulo: 'Excluir esta linha editorial?',
      texto: 'Ela vai para a lixeira com os conteúdos ligados a ela. Dá para restaurar depois.',
      rotulo: 'Excluir', perigo: true,
      aoConfirmar: async () => {
        try {
          await B7.Save.acao(() => B7.DB.excluirLinha(L.linha.id), 'Linha excluída');
          location.hash = '#/cliente/' + L.linha.client_id + '/linhas';
        } catch (e) {}
      }
    });

    /* canais */
    p.querySelectorAll('[data-canal]').forEach(b => b.onclick = async () => {
      const atuais = (L.linha.canais || '').split(',').map(x => x.trim()).filter(Boolean);
      const c = b.dataset.canal;
      const novos = atuais.includes(c) ? atuais.filter(x => x !== c) : atuais.concat(c);
      L.linha.canais = novos.join(', ');
      b.classList.toggle('on');
      B7.Save.campo('linhas_editoriais', L.linha.id, { canais: L.linha.canais });
    });
    const canalNovo = p.querySelector('#canal-novo');
    if (canalNovo) canalNovo.onclick = () => {
      const m = B7.UI.modal('<h3>Outro canal</h3>' +
        '<div class="mb"><label class="rot">NOME DO CANAL</label>' +
        '<input class="campo" id="cn-nome" data-foco placeholder="Ex: WhatsApp, Newsletter"></div>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
        '<button class="b pri" data-ok>Adicionar</button></div>');
      m.querySelector('[data-ok]').onclick = async () => {
        const nome = m.querySelector('#cn-nome').value.trim();
        if (!nome) return;
        const atuais = (L.linha.canais || '').split(',').map(x => x.trim()).filter(Boolean);
        L.linha.canais = atuais.concat(nome).join(', ');
        await B7.Save.acao(() => B7.DB.atualizarLinha(L.linha.id, { canais: L.linha.canais }), 'Canal adicionado');
        m.fechar(); render();
      };
    };

    /* posicionamento vindo da inteligência */
    const usar = p.querySelector('#usar-inteligencia');
    if (usar) usar.onclick = async () => {
      try {
        const i = await B7.DB.inteligencia(L.linha.client_id);
        const patch = { posicionamento: i.posicionamento || '', puv: i.puv || '',
                        percepcao: i.percepcao || '', tom_voz: i.voz_tom || '' };
        if (!patch.posicionamento && !patch.puv && !patch.percepcao && !patch.tom_voz) {
          return B7.UI.toast('Este cliente ainda não tem posicionamento na Inteligência');
        }
        await B7.Save.acao(() => B7.DB.atualizarLinha(L.linha.id, patch), 'Posicionamento aplicado');
        Object.assign(L.linha, patch);
        render();
      } catch (e) {}
    };
  }


  /* ------------------------------------------------------ duplicar
     O usuário escolhe o que levar para o mês novo. Criativos e datas
     ficam desmarcados por padrão: normalmente o mês novo tem conteúdo
     novo, e copiar tudo só dá trabalho de apagar depois. */
  function modalDuplicar() {
    const hoje = new Date();
    const anos = [];
    for (let a = L.linha.ano - 1; a <= L.linha.ano + 1; a++) anos.push(a);

    const m = B7.UI.modal('<h3>Duplicar linha editorial</h3>' +
      '<div class="sub">Escolha o mês de destino e o que deve ser copiado de ' +
      esc(L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano)) + '.</div>' +
      '<div class="linha mb"><div><label class="rot">MÊS</label>' +
        '<select class="campo" id="dp-mes">' + MESES.map((n, i) =>
          '<option value="' + (i + 1) + '"' + (i === L.linha.mes % 12 ? ' selected' : '') + '>' +
          n + '</option>').join('') + '</select></div>' +
        '<div><label class="rot">ANO</label><select class="campo" id="dp-ano">' +
          anos.map(a => '<option' + (a === L.linha.ano ? ' selected' : '') + '>' + a + '</option>').join('') +
        '</select></div></div>' +
      '<label class="rot">O QUE COPIAR</label>' +
      '<div class="lista-check">' +
        [['objetivo', 'Objetivo do mês', true], ['posicionamento', 'Posicionamento', true],
         ['canais', 'Canais e meta', true],
         ['criativos', 'Criativos', false], ['datas', 'Datas de postagem', false]].map(([k, r, on]) =>
          '<label class="check"><input type="checkbox" data-copiar="' + k + '"' +
          (on ? ' checked' : '') + (k === 'datas' ? ' data-dep="criativos" disabled' : '') + '>' +
          '<span>' + r + '</span></label>').join('') +
      '</div>' +
      '<div class="ajuda">As datas só podem ser copiadas junto com os criativos.</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Duplicar</button></div>');

    /* datas dependem dos criativos */
    const cri = m.querySelector('[data-copiar="criativos"]');
    const dat = m.querySelector('[data-copiar="datas"]');
    cri.onchange = () => {
      dat.disabled = !cri.checked;
      if (!cri.checked) dat.checked = false;
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const btn = m.querySelector('[data-ok]');
      btn.disabled = true; btn.textContent = 'Duplicando…';
      const quer = k => m.querySelector('[data-copiar="' + k + '"]').checked;
      const mes = +m.querySelector('#dp-mes').value;
      const ano = +m.querySelector('#dp-ano').value;
      const o = L.linha;

      try {
        const dados = { client_id: o.client_id, nome: MESES[mes - 1] + ' ' + ano, mes: mes, ano: ano };
        if (quer('objetivo')) { dados.objetivo = o.objetivo; dados.objetivo_detalhe = o.objetivo_detalhe; }
        if (quer('posicionamento')) {
          dados.posicionamento = o.posicionamento; dados.tom_voz = o.tom_voz;
          dados.puv = o.puv; dados.percepcao = o.percepcao;
        }
        if (quer('canais')) { dados.canais = o.canais; dados.meta_conteudos = o.meta_conteudos; }

        const nova = await B7.DB.criarLinha(dados);

        if (quer('criativos')) {
          for (let i = 0; i < L.conteudos.length; i++) {
            const c = L.conteudos[i];
            const novoC = await B7.DB.criarConteudo({
              client_id: c.client_id, linha_id: nova.id, tipo: c.tipo, position: i,
              titulo: c.titulo, objetivo: c.objetivo, ideia_geral: c.ideia_geral, tema: c.tema,
              canal: c.canal, headline: c.headline, sub_headline: c.sub_headline, cta: c.cta,
              legenda: c.legenda, direcao: c.direcao, observacao_design: c.observacao_design,
              data_postagem: quer('datas') ? c.data_postagem : null,
              status: 'Ideia'   /* o mês novo começa do começo, não aprovado */
            });
            /* slides e frames acompanham o criativo */
            if (c.tipo === 'Carrossel') {
              const ss = await B7.DB.listarSlides(c.id).catch(() => []);
              for (const sl of ss) await B7.DB.criarSlide({ content_id: novoC.id,
                position: sl.position, titulo: sl.titulo, texto: sl.texto });
            }
            if (c.tipo === 'Story') {
              const fs = await B7.DB.listarFrames(c.id).catch(() => []);
              for (const fr of fs) await B7.DB.criarFrame({ content_id: novoC.id,
                position: fr.position, texto: fr.texto, direcao_visual: fr.direcao_visual });
            }
          }
        }

        B7.DB.registrar({ tipo: 'criar', entidade: 'linha', id: nova.id, cliente: o.client_id,
          texto: 'Linha editorial duplicada: ' + nova.nome });
        B7.UI.toast('Linha duplicada para ' + nova.nome);
        m.fechar();
        location.hash = '#/linha/' + nova.id;
      } catch (e) {
        console.error(e);
        btn.disabled = false; btn.textContent = 'Duplicar';
        B7.UI.toast('Não foi possível duplicar', { tipo: 'erro' });
      }
    };
  }

  /* -------------------------------------------------- drag and drop
     Reordena slides e stories dentro do editor. A posição
     é gravada no banco na hora em que o item é solto. */
  function ligarArrasto(raiz) {
    const alvo = raiz || painel();
    const listas = [
      { sel: '#lista-slides', item: '[data-slide]', attr: 'slide', salvar: B7.DB.atualizarSlide },
      { sel: '#lista-frames', item: '[data-frame]', attr: 'frame', salvar: B7.DB.atualizarFrame }
    ];

    listas.forEach(cfg => {
      const lista = alvo.querySelector(cfg.sel);
      if (!lista) return;
      lista.querySelectorAll(cfg.item).forEach(el => {
        el.setAttribute('draggable', 'true');
        el.classList.add('arrastavel');
        el.ondragstart = e => {
          el.classList.add('arrastando');
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', el.dataset[cfg.attr]); } catch (err) {}
        };
        el.ondragend = async () => {
          el.classList.remove('arrastando');
          lista.querySelectorAll('.sobre').forEach(x => x.classList.remove('sobre'));
          await gravarOrdem(lista, cfg);
        };
        el.ondragover = e => {
          e.preventDefault();
          const arrastando = lista.querySelector('.arrastando');
          if (!arrastando || arrastando === el) return;
          const meio = el.getBoundingClientRect().top + el.offsetHeight / 2;
          lista.insertBefore(arrastando, e.clientY < meio ? el : el.nextSibling);
        };
      });
    });
  }

  async function gravarOrdem(lista, cfg) {
    const itens = [...lista.querySelectorAll(cfg.item)];
    try {
      for (let i = 0; i < itens.length; i++) {
        const id = itens[i].dataset[cfg.attr];
        await cfg.salvar(id, { position: i });
      }
      /* mantém o estado local coerente com a tela */
      B7.UI.toast('Ordem salva');
    } catch (e) {
      console.error(e);
      B7.UI.toast('Não foi possível salvar a ordem', { tipo: 'erro' });
    }
  }

  function renumerar(lista, sel, prefixo) {
    [...lista.children].forEach((el, i) => {
      const alvo = el.querySelector(sel);
      if (!alvo) return;
      const n = String(i + 1).padStart(2, '0');
      alvo.textContent = prefixo ? prefixo + ' ' + n + (prefixo === 'SLIDE' && i === 0 ? ' · CAPA' : '') : n;
    });
  }

  /* ------------------------------------------------- novo conteúdo */
  function modalNovoConteudo() {
    const m = B7.UI.modal('<h3>Novo conteúdo</h3>' +
      '<div class="sub">Escolha o formato: cada um tem a sua própria estrutura de edição.</div>' +
      '<div class="grade-formatos">' + C.FORMATOS.map(f =>
        '<button class="opcao-formato" data-formato="' + f + '">' + ICONE_FORMATO[f] +
        '<b>' + f + '</b><small>' +
        (f === 'Reel' ? 'vídeo com roteiro' : f === 'Card' ? 'peça única' :
         f === 'Carrossel' ? 'sequência de slides' : 'sequência de stories') + '</small></button>').join('') +
      '</div>');

    m.querySelectorAll('[data-formato]').forEach(b => b.onclick = async () => {
      const tipo = b.dataset.formato;
      try {
        const novo = await B7.Save.acao(() => B7.DB.criarConteudo({
          client_id: L.linha.client_id, linha_id: L.linha.id, tipo: tipo,
          position: L.conteudos.length, status: 'Ideia'
        }), 'Conteúdo criado');
        B7.DB.registrar({ tipo: 'criar', entidade: 'conteudo', id: novo.id,
          cliente: L.linha.client_id, texto: 'Novo ' + tipo + ' em ' + L.linha.nome });
        L.conteudos.push(novo);
        m.fechar();
        abrirConteudo(novo.id);
      } catch (e) {}
    });
  }

  /* ------------------------------------------- editor do conteúdo */
  async function abrirConteudo(id) {
    const c = L.conteudos.find(x => x.id === id);
    if (!c) return;
    let slides = [], frames = [], roteiro = null;
    try {
      if (c.tipo === 'Carrossel') slides = await B7.DB.listarSlides(c.id);
      if (c.tipo === 'Story') frames = await B7.DB.listarFrames(c.id);
      if (c.script_id) roteiro = await B7.DB.roteiro(c.script_id).catch(() => null);
    } catch (e) {}

    const t = 'data-tab="conteudos" data-id="' + esc(c.id) + '"';
    const geral =
      C.campoLinha('TÍTULO / TEMA', c.titulo, t + ' data-campo="titulo"') +
      '<div class="linha mb">' +
        '<div><label class="rot">CANAL</label>' +
          '<input class="campo" value="' + esc(c.canal || '') + '" ' + t + ' data-campo="canal" ' +
          'placeholder="Instagram"></div>' +
        '<div><label class="rot">DATA <span class="leve">— opcional</span></label>' +
          '<input class="campo" type="date" value="' + esc(c.data_postagem || '') + '" ' + t + ' data-campo="data_postagem"></div>' +
      '</div>' +
      '<div class="mb"><label class="rot">STATUS</label><div class="opcoes" id="st-conteudo">' +
        C.STATUS_CONTEUDO.map(v => '<button data-st="' + esc(v) + '"' + (c.status === v ? ' class="on"' : '') + '>' +
          v + '</button>').join('') + '</div></div>' +
      '<label class="op-mini' + (c.visivel_cliente ? ' on' : '') + '" id="ct-portal">' +
        '<input type="checkbox"' + (c.visivel_cliente ? ' checked' : '') + '> Visível no portal do cliente</label>' +
      C.campo('OBJETIVO', c.objetivo, t + ' data-campo="objetivo"') +
      C.campo('IDEIA GERAL', c.ideia_geral, t + ' data-campo="ideia_geral"');

    /* cada formato mostra só o que faz sentido para ele */
    let especifico = '';
    if (c.tipo === 'Reel') {
      especifico = '<div class="bloco-formato"><h4>Vídeo / Reel</h4>' +
        C.campoLinha('HEADLINE', c.headline, t + ' data-campo="headline"') +
        C.campoLinha('CTA', c.cta, t + ' data-campo="cta"') +
        '<div class="vinculo-roteiro">' +
          (roteiro
            ? '<div class="vr-ok"><div><small>ROTEIRO VINCULADO</small>' +
              '<b>' + esc(roteiro.titulo || 'Sem título') + '</b></div>' +
              '<button class="b fina pri" data-abrir-roteiro="' + esc(roteiro.id) + '">Abrir roteiro</button>' +
              '<button class="b fina" data-desvincular>Desvincular</button></div>'
            : '<div class="vr-vazio"><div><b>Nenhum roteiro vinculado</b>' +
              '<small>O texto do vídeo vive no editor de roteiros, não aqui.</small></div>' +
              '<button class="b fina contorno" data-vincular>Vincular roteiro existente</button></div>') +
        '</div></div>';
    }
    if (c.tipo === 'Card') {
      especifico = '<div class="bloco-formato"><h4>Card estático</h4>' +
        C.campoLinha('HEADLINE', c.headline, t + ' data-campo="headline"') +
        C.campoLinha('SUB-HEADLINE', c.sub_headline, t + ' data-campo="sub_headline"') +
        C.campoLinha('CTA', c.cta, t + ' data-campo="cta"') +
        C.campo('DIREÇÃO VISUAL', c.direcao, t + ' data-campo="direcao"') +
        C.campo('LEGENDA', c.legenda, t + ' data-campo="legenda"') +
        C.campo('OBSERVAÇÃO PARA O DESIGN', c.observacao_design, t + ' data-campo="observacao_design"') + '</div>';
    }
    if (c.tipo === 'Carrossel') {
      especifico = '<div class="bloco-formato"><h4>Carrossel</h4>' +
        C.campoLinha('CAPA / HEADLINE', c.headline, t + ' data-campo="headline"') +
        '<div id="lista-slides">' + slides.map((s, i) => itemSlide(s, i)).join('') + '</div>' +
        '<button class="add-largo" id="add-slide">+ ADICIONAR SLIDE</button>' +
        C.campoLinha('CTA DO ÚLTIMO SLIDE', c.cta, t + ' data-campo="cta"') +
        C.campo('LEGENDA', c.legenda, t + ' data-campo="legenda"') + '</div>';
    }
    if (c.tipo === 'Story') {
      especifico = '<div class="bloco-formato"><h4>Sequência de stories</h4>' +
        '<div id="lista-frames">' + frames.map((f, i) => itemFrame(f, i)).join('') + '</div>' +
        '<button class="add-largo" id="add-frame">+ ADICIONAR STORY</button>' +
        C.campoLinha('CTA', c.cta, t + ' data-campo="cta"') + '</div>';
    }

    const m = B7.UI.modal(
      '<div class="cab-conteudo-modal"><span class="cc-formato">' + ICONE_FORMATO[c.tipo] + esc(c.tipo) + '</span>' +
      '<button class="ico" data-fecha aria-label="Fechar">✕</button></div>' +
      '<div class="corpo">' + geral + especifico +
        /* onde a equipe cola o que serviu de referência: um link por linha */
        '<div class="bloco-formato"><h4>Referências</h4>' +
        C.campo('LINKS DE REFERÊNCIA', c.referencias,
          t + ' data-campo="referencias" placeholder="Um link por linha"') +
        '</div>' + '</div>' +
      '<div class="acoes"><button class="b perigo" data-excluir-conteudo>Excluir conteúdo</button>' +
      '<div style="flex:1"></div><button class="b pri" data-fecha>Concluir</button></div>',
      { larga: true, extra: 'modal-conteudo', aoFechar: () => abrir(L.linha.id, L.aba) });

    C.ligarCampos(m);

    const chkPortal = m.querySelector('#ct-portal input');
    if (chkPortal) chkPortal.onchange = async () => {
      const ligar = chkPortal.checked;
      m.querySelector('#ct-portal').classList.toggle('on', ligar);
      try {
        await B7.Save.acao(() => B7.DB.atualizarConteudo(c.id, { visivel_cliente: ligar }),
          ligar ? 'Conteúdo visível no portal' : 'Conteúdo oculto do portal');
        c.visivel_cliente = ligar;
      } catch (e) { chkPortal.checked = !ligar; }
    };

    m.querySelectorAll('#st-conteudo [data-st]').forEach(b => b.onclick = async () => {
      m.querySelectorAll('#st-conteudo button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      c.status = b.dataset.st;
      await B7.Save.acao(() => B7.DB.atualizarConteudo(c.id, { status: c.status }), 'Status: ' + c.status);
      if (c.status === 'Aprovado' || c.status === 'Publicado') {
        B7.DB.registrar({ tipo: 'status', entidade: 'conteudo', id: c.id, cliente: L.linha.client_id,
          texto: (c.titulo || 'Conteúdo') + ' → ' + c.status });
      }
    });

    const excluir = m.querySelector('[data-excluir-conteudo]');
    if (excluir) excluir.onclick = () => B7.UI.confirmar({
      titulo: 'Excluir este conteúdo?', texto: 'Ele vai para a lixeira e pode ser restaurado.',
      rotulo: 'Excluir', perigo: true,
      aoConfirmar: async () => {
        await B7.Save.acao(() => B7.DB.excluirConteudo(c.id), 'Conteúdo excluído');
        L.conteudos = L.conteudos.filter(x => x.id !== c.id);
        m.fechar();
      }
    });

    /* slides e frames */
    const addSlide = m.querySelector('#add-slide');
    if (addSlide) addSlide.onclick = async () => {
      const total = m.querySelectorAll('[data-slide]').length;
      const novo = await B7.Save.acao(() => B7.DB.criarSlide({ content_id: c.id, position: total }), 'Slide adicionado');
      m.querySelector('#lista-slides').insertAdjacentHTML('beforeend', itemSlide(novo, total));
      C.ligarCampos(m); ligarRemocoes(m); ligarArrasto(m);
    };
    const addFrame = m.querySelector('#add-frame');
    if (addFrame) addFrame.onclick = async () => {
      const total = m.querySelectorAll('[data-frame]').length;
      const novo = await B7.Save.acao(() => B7.DB.criarFrame({ content_id: c.id, position: total }), 'Story adicionado');
      m.querySelector('#lista-frames').insertAdjacentHTML('beforeend', itemFrame(novo, total));
      C.ligarCampos(m); ligarRemocoes(m); ligarArrasto(m);
    };
    ligarRemocoes(m);
    ligarArrasto(m);

    /* vínculo com o editor de roteiros existente */
    const vincular = m.querySelector('[data-vincular]');
    if (vincular) vincular.onclick = () => escolherRoteiro(c, m);
    const abrirRot = m.querySelector('[data-abrir-roteiro]');
    if (abrirRot) abrirRot.onclick = async () => {
      const r = await B7.DB.roteiro(c.script_id);
      m.fechar();
      location.hash = '#/gravacao/' + r.recording_session_id + '?roteiro=' + r.id;
    };
    const desv = m.querySelector('[data-desvincular]');
    if (desv) desv.onclick = async () => {
      await B7.Save.acao(() => B7.DB.atualizarConteudo(c.id, { script_id: null }), 'Roteiro desvinculado');
      c.script_id = null;
      m.fechar(); abrirConteudo(c.id);
    };
  }

  function itemSlide(s, i) {
    const t = 'data-tab="slides" data-id="' + esc(s.id) + '"';
    return '<div class="item-slide" data-slide="' + esc(s.id) + '">' +
      '<div class="is-num">SLIDE ' + String(i + 1).padStart(2, '0') + (i === 0 ? ' · CAPA' : '') + '</div>' +
      C.campoLinha('TÍTULO', s.titulo, t + ' data-campo="titulo"') +
      C.campo('TEXTO', s.texto, t + ' data-campo="texto"') +
      '<button class="ico perigo" data-excluir-slide="' + esc(s.id) + '" title="Remover">✕</button></div>';
  }

  function itemFrame(f, i) {
    const t = 'data-tab="frames" data-id="' + esc(f.id) + '"';
    return '<div class="item-slide" data-frame="' + esc(f.id) + '">' +
      '<div class="is-num">STORY ' + String(i + 1).padStart(2, '0') + '</div>' +
      C.campo('TEXTO', f.texto, t + ' data-campo="texto"') +
      C.campo('DIREÇÃO VISUAL', f.direcao_visual, t + ' data-campo="direcao_visual"') +
      '<button class="ico perigo" data-excluir-frame="' + esc(f.id) + '" title="Remover">✕</button></div>';
  }

  function ligarRemocoes(m) {
    m.querySelectorAll('[data-excluir-slide]').forEach(b => b.onclick = async () => {
      await B7.Save.acao(() => B7.DB.excluirSlide(b.dataset.excluirSlide), 'Slide removido');
      b.closest('[data-slide]').remove();
    });
    m.querySelectorAll('[data-excluir-frame]').forEach(b => b.onclick = async () => {
      await B7.Save.acao(() => B7.DB.excluirFrame(b.dataset.excluirFrame), 'Story removido');
      b.closest('[data-frame]').remove();
    });
  }

  /* escolher um roteiro já existente do cliente */
  async function escolherRoteiro(c, modalPai) {
    let roteiros = [];
    try { roteiros = await B7.DB.roteirosDoCliente(L.linha.client_id, 40); } catch (e) {}
    if (!roteiros.length) {
      return B7.UI.toast('Este cliente ainda não tem roteiros. Crie na área de Gravações.', { tipo: 'erro' });
    }
    const m = B7.UI.modal('<h3>Vincular roteiro</h3>' +
      '<div class="sub">O conteúdo aponta para o roteiro; o texto continua vivendo no editor de roteiros.</div>' +
      '<div class="corpo">' + roteiros.map(r =>
        '<button class="cp-item" data-r="' + esc(r.id) + '"><div class="ic">R</div>' +
        '<div><b>' + esc(r.titulo || 'Sem título') + '</b><small>' +
        (r.gravacao ? esc(r.gravacao.nome) + ' · ' : '') + 'editado ' + B7.UI.quando(r.updated_at) +
        '</small></div></button>').join('') + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button></div>');
    m.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => {
      await B7.Save.acao(() => B7.DB.atualizarConteudo(c.id, { script_id: b.dataset.r }), 'Roteiro vinculado');
      /* o roteiro também guarda o DNA: formato e tema vêm do conteúdo */
      B7.DB.atualizarRoteiro(b.dataset.r, {
        content_id: c.id, formato: c.tipo, tema: c.tema || c.titulo || ''
      }).catch(() => {});
      c.script_id = b.dataset.r;
      m.fechar(); modalPai.fechar(); abrirConteudo(c.id);
    });
  }

  return { abrir, abrirConteudo,
           /* usados pela paleta de comandos quando já há uma linha aberta */
           novoConteudo: () => L.linha && modalNovoConteudo(),
           duplicar: () => L.linha && modalDuplicar() };
})();
