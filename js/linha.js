/* =====================================================================
   LINHA EDITORIAL
   Abas: Visão geral · Estratégia · Criativos · Postagens.

   Estado em memória (L) é a fonte da tela. Tudo que a pessoa digita é
   espelhado em L na hora (ver espelhar) e vai para o banco pelo autosave;
   trocar de aba só troca o corpo — não refaz a página nem relê o banco.

   Pilares de conteúdo voltaram: a aba Estratégia tem a seção
   "ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO" (CRUD, percentual, funil)
   e cada conteúdo pode apontar para um pilar (conteudos.pilar_id). Nada é
   obrigatório: linha sem pilar funciona como antes.

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

  let L = { linha: null, conteudos: [], pilares: [], aba: 'geral', cliente: null,
            aprovacao: null, cal: null };

  const ABAS = [['geral', 'Visão geral'], ['estrategia', 'Estratégia'],
                ['criativos', 'Criativos'], ['postagens', 'Postagens']];

  /* ------------------------------------------------------------ abrir */
  async function abrir(id, aba) {
    L.aba = ABAS.some(([k]) => k === aba) ? aba : 'geral';
    painel().innerHTML = '<div class="conteudo">' +
      '<div class="b7-load"><div class="simbolo"></div><div class="txt">Abrindo a linha editorial…</div></div></div>';
    try {
      L.linha = await B7.DB.linha(id);
      [L.conteudos, L.cliente, L.pilares] = await Promise.all([
        B7.DB.listarConteudos(id), B7.DB.cliente(L.linha.client_id),
        B7.DB.listarPilares(id).catch(() => [])
      ]);
      try { L.aprovacao = (await B7.DB.ultimasAprovacoes('linha', [id]))[id] || null; } catch (e) { L.aprovacao = null; }
    } catch (e) { return B7.Dashboard.erroConteudo(e, (L.linha || {}).client_id || ''); }

    /* o calendário abre no mês da linha; a navegação é só visual */
    L.cal = { ano: +L.linha.ano, mes: +L.linha.mes };
    B7.Rota.titulo([L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano), L.linha.cliente_nome]);
    render();
  }

  /* --------------------------------------------- espelho em memória
     O autosave manda o patch para o banco; aqui o mesmo patch entra no
     objeto que a tela usa para renderizar. Sem isso, trocar de aba
     mostrava o valor anterior (bug "a estratégia some"). */
  function espelhar(tab, id, patch) {
    let alvo = null;
    if (tab === 'linhas_editoriais' && L.linha && L.linha.id === id) alvo = L.linha;
    else if (tab === 'conteudos') alvo = L.conteudos.find(c => c.id === id);
    else if (tab === 'pilares') alvo = L.pilares.find(p => p.id === id);
    if (!alvo) return;
    Object.assign(alvo, patch);
    if (tab === 'pilares' && 'percentual' in patch) resumoPilaresAoVivo();
  }

  function corpoHTML() {
    return L.aba === 'geral' ? visaoGeral() :
           L.aba === 'estrategia' ? estrategia() :
           L.aba === 'criativos' ? criativos() : postagens();
  }

  function render() {
    const l = L.linha;
    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span>' +
        '<button data-ir="#/clientes">Clientes</button><span>/</span>' +
        '<button data-ir="#/cliente/' + esc(l.client_id) + '">' + esc(l.cliente_nome) + '</button>' +
        '<span>/</span><button data-ir="#/cliente/' + esc(l.client_id) + '/linhas">Linhas editoriais</button>' +
        '<span>/</span><b>' + esc(l.nome || MESES[l.mes - 1] + ' ' + l.ano) + '</b></div>' +

      capa(l) +
      '<div class="abas-cliente abas-linha">' + ABAS.map(([k, r]) =>
        '<button data-aba="' + k + '"' + (L.aba === k ? ' class="on"' : '') + '>' + r + '</button>').join('') +
      '</div>' +
      '<div id="corpo-linha">' + corpoHTML() + '</div></div>';

    painel().querySelectorAll('[data-ir]').forEach(b => b.onclick = () => location.hash = b.dataset.ir);
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => trocarAba(b.dataset.aba));
    C.ligarCampos(painel(), espelhar);
    B7.UI.ligarMenus(painel());
    ligarAba();
  }

  /* Só o corpo é trocado: capa, trilha e abas ficam onde estão, e nada
     é relido do banco — o que está em L é o que a pessoa acabou de ver. */
  function trocarAba(k) {
    if (!ABAS.some(([x]) => x === k)) return;
    /* o que ainda estava no debounce vai agora; a tela não espera por
       isso porque L já tem o valor (espelhar) */
    B7.Save.agora().catch(() => {});
    L.aba = k;
    painel().querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === k));
    renderCorpo();
  }

  function renderCorpo() {
    const corpo = document.getElementById('corpo-linha');
    if (!corpo) return render();
    corpo.innerHTML = corpoHTML();
    C.ligarCampos(corpo, espelhar);
    ligarAba();
  }

  /* Redesenha a página inteira a partir de L (sem ler o banco), mantendo
     a rolagem. Usado quando capa e corpo mudam juntos (contagens). */
  function atualizar() {
    const y = window.scrollY;
    const cx = painel().closest('.principal, main, .conteudo-rolavel');
    const st = cx ? cx.scrollTop : 0;
    render();
    window.scrollTo(0, y);
    if (cx) cx.scrollTop = st;
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
          '<hr><button data-enviar-aprovacao>Enviar para aprovação do cliente</button>' +
          '<button data-portal-linha>' + (l.visivel_cliente ? '✓ Visível no portal do cliente' : 'Liberar no portal do cliente') + '</button>' +
          '<button data-arquivar-linha>' + (l.archived_at ? 'Desarquivar' : 'Arquivar') + '</button>' +
          '<button class="perigo" data-excluir-linha>Excluir linha editorial</button>' +
        '</div></div></div></div>';
  }

  /* ------------------------------------------------ ENVIAR PARA APROVAÇÃO
     O cliente aprova o PLANEJAMENTO (versão congelada). Não aprova roteiro,
     arte final nem publicação — cada um tem a própria aprovação. Os
     roteiros vinculados entram só pelo título. */
  async function enviarParaAprovacao() {
    const l = L.linha;
    const ultima = L.aprovacao;
    const proxima = ultima ? (ultima.versao || 0) + 1 : 1;
    const m = B7.UI.modal('<h3>Enviar planejamento para aprovação</h3>' +
      '<div class="sub">O cliente vê a linha editorial como está agora (' + L.conteudos.length + ' conteúdo(s)). ' +
      'Alterações depois do envio não mudam esta versão.</div>' +
      (ultima ? '<div class="env-anterior">Última versão: <b>v' + ultima.versao + '</b> — ' +
        esc(B7.Aprovacoes.rotulo(ultima.situacao).toLowerCase()) + '. Este envio cria a <b>v' + proxima + '</b>.</div>'
        : '<div class="env-anterior">Primeiro envio deste planejamento: será a <b>v1</b>.</div>') +
      '<label class="rot">RECADO PARA O CLIENTE (opcional)</label>' +
      '<textarea class="campo alta" id="env-obs" rows="2" placeholder="ex.: segue o planejamento de outubro para sua aprovação"></textarea>' +
      '<div id="env-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Enviar v' + proxima + '</button></div>');
    m.querySelector('[data-ok]').onclick = async () => {
      const botao = m.querySelector('[data-ok]'), erro = m.querySelector('#env-erro');
      botao.disabled = true; botao.textContent = 'Enviando…';
      try {
        const titulos = {};
        for (const c of L.conteudos.filter(x => x.script_id)) {
          try { const r = await B7.DB.roteiro(c.script_id); titulos[c.id] = r && r.titulo; } catch (e) {}
        }
        await B7.DB.enviarParaAprovacao({
          client_id: l.client_id, tipo: 'linha', alvo_id: l.id,
          snapshot: {
            titulo: l.nome || (MESES[l.mes - 1] + ' ' + l.ano),
            periodo: (l.periodo_inicio ? B7.UI.dataBR(l.periodo_inicio) : '') + (l.periodo_fim ? ' a ' + B7.UI.dataBR(l.periodo_fim) : ''),
            objetivo: l.objetivo || '', posicionamento_mes: l.posicionamento_mes || '', canais: l.canais || '',
            estrategia: l.estrategia || '', mes: l.mes, ano: l.ano, cliente: l.cliente_nome,
            /* pilares congelados junto: o cliente aprova a estratégia inteira */
            pilares: L.pilares.map(p => ({ id: p.id, nome: p.nome, percentual: +p.percentual || 0,
              funil: p.funil, objetivo: p.objetivo || '', observacoes: p.observacoes || '',
              planejados: planejadosDoPilar(p), reais: reaisDoPilar(p) })),
            conteudos: L.conteudos.map(c => ({ id: c.id, tipo: c.tipo, titulo: c.titulo, data_postagem: c.data_postagem,
              objetivo: c.objetivo, canal: c.canal, roteiro_titulo: titulos[c.id] || null,
              pilar_id: c.pilar_id || null, pilar: nomeDoPilar(c.pilar_id) }))
          },
          observacao: m.querySelector('#env-obs').value.trim() || null
        });
        m.fechar();
        B7.UI.toast('Planejamento enviado para aprovação (v' + proxima + ') — o cliente foi avisado');
        abrir(l.id, L.aba);
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Enviar v' + proxima;
        erro.textContent = e.message || 'Não foi possível enviar.';
      }
    };
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

    return (B7.Aprovacoes ? '<div class="mb" id="ap-status-linha">' + B7.Aprovacoes.blocoStatus(L.aprovacao, { botaoEnviar: true }) + '</div>' : '') +
      '<div class="mini-metricas">' + metricas.map(([n, r]) =>
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
        (L.pilares.length ? '<div class="bloco"><h3>Pilares de conteúdo</h3>' +
          distribuicaoPilares() +
          '<button class="b p" data-ir-aba="estrategia" style="margin-top:10px">Editar pilares</button></div>' : '') +
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
        /* o campo antigo só aparece se já tinha texto: nada se perde, mas
           a seção dele foi substituída pelos pilares */
        (String(l.objetivo_detalhe || '').trim()
          ? C.campo('COMPLEMENTO DO OBJETIVO', l.objetivo_detalhe, t + ' data-campo="objetivo_detalhe"') : '') +
      '</div>' +

      secaoPilares() +

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

  /* ----------------------------------------------------------- PILARES
     A distribuição planejada é o percentual; a real é quantos conteúdos
     apontam para o pilar. A base do planejado é a meta de conteúdos ou,
     sem meta, o total de conteúdos da linha. Somar 100% é aviso, não
     bloqueio: a equipe decide. */
  const pct = p => Math.max(0, +p.percentual || 0);
  const somaPilares = () => L.pilares.reduce((s, p) => s + pct(p), 0);
  const basePlanejada = () => +L.linha.meta_conteudos || L.conteudos.length;
  const planejadosDoPilar = p => Math.round(basePlanejada() * pct(p) / 100);
  const reaisDoPilar = p => L.conteudos.filter(c => c.pilar_id === p.id).length;
  const nomeDoPilar = id => { const p = id && L.pilares.find(x => x.id === id); return p ? (p.nome || 'Pilar sem nome') : null; };
  const semPilar = () => L.conteudos.filter(c => !c.pilar_id || !L.pilares.some(p => p.id === c.pilar_id)).length;

  function avisoSoma(soma) {
    const s = Math.round(soma * 100) / 100;
    if (!L.pilares.length) return '';
    if (s === 100) return '<span class="ok">Soma 100%</span>';
    if (s < 100) return '<span class="falta">Soma ' + s + '% — faltam ' + (Math.round((100 - s) * 100) / 100) + '%</span>';
    return '<span class="falta">Soma ' + s + '% — passa ' + (Math.round((s - 100) * 100) / 100) + '% de 100</span>';
  }

  /* barra empilhada com a proporção planejada de cada pilar */
  function barraPilares() {
    const soma = somaPilares();
    if (!soma) return '';
    return '<div class="barra-total pil-barra">' + L.pilares.map((p, i) =>
      '<i class="faixa-' + (i % 4) + '" style="width:' + (pct(p) / Math.max(100, soma) * 100) + '%" ' +
      'title="' + esc(p.nome || 'Pilar ' + (i + 1)) + ' · ' + pct(p) + '%"></i>').join('') + '</div>';
  }

  /* real × planejado, um par de barras por pilar (usado na visão geral e
     dentro da seção de pilares) */
  function distribuicaoPilares() {
    if (!L.pilares.length) return '';
    const maxB = Math.max(1, ...L.pilares.map(p => Math.max(planejadosDoPilar(p), reaisDoPilar(p))));
    const soltos = semPilar();
    return '<div class="pil-dist">' + L.pilares.map((p, i) => {
      const plan = planejadosDoPilar(p), real = reaisDoPilar(p);
      const estado = !L.conteudos.length ? '' : real === plan ? ' ok' : real < plan ? ' abaixo' : ' acima';
      return '<div class="pil-dist-l' + estado + '">' +
        '<div class="pil-dist-cab"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<b>' + esc(p.nome || 'Pilar sem nome') + '</b><span class="pc">' + pct(p) + '%</span>' +
        '<span class="rf"><b>' + real + '</b> de ' + plan + ' planejado' + (plan === 1 ? '' : 's') + '</span></div>' +
        '<div class="pil-dist-barras">' +
          '<div class="barra plan" title="Planejado"><i style="width:' + (plan / maxB * 100) + '%"></i></div>' +
          '<div class="barra real" title="Real"><i style="width:' + (real / maxB * 100) + '%"></i></div>' +
        '</div></div>';
    }).join('') +
    '<div class="pil-legenda"><span class="plan">Planejado</span><span class="real">Real</span>' +
      (soltos ? '<span class="solto">' + soltos + ' conteúdo' + (soltos === 1 ? '' : 's') + ' sem pilar</span>' : '') +
    '</div></div>';
  }

  function secaoPilares() {
    const soma = somaPilares();
    return '<div class="bloco mb bloco-pilares" id="bloco-pilares">' +
      '<div class="pil-cab"><h3>ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO</h3>' +
      '<div class="pil-soma" id="pil-soma">' + avisoSoma(soma) + '</div></div>' +
      '<p class="ajuda" style="margin:0 0 12px">Os temas que sustentam o mês, com o peso de cada um. ' +
      'Cada conteúdo pode apontar para um pilar; a distribuição real aparece ao lado da planejada.</p>' +
      '<div id="pil-barra">' + barraPilares() + '</div>' +
      '<div id="lista-pilares">' + L.pilares.map((p, i) => cardPilar(p, i)).join('') + '</div>' +
      (L.pilares.length ? '' :
        '<div class="pil-vazio">Nenhum pilar ainda. Comece com dois ou três: educação, autoridade, oferta…</div>') +
      '<button class="add-largo" id="add-pilar">+ ADICIONAR PILAR</button>' +
      (L.pilares.length ? '<div class="pil-sub">DISTRIBUIÇÃO DOS CONTEÚDOS</div>' +
        '<div id="pil-dist">' + distribuicaoPilares() + '</div>' : '') +
    '</div>';
  }

  function cardPilar(p, i) {
    const t = 'data-tab="pilares" data-id="' + esc(p.id) + '"';
    return '<div class="cartao-pilar" data-pilar="' + esc(p.id) + '">' +
      '<div class="pilar-num">' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div class="pilar-corpo">' +
        '<div class="linha mb pil-linha">' +
          '<div class="pil-nome"><label class="rot">NOME DO PILAR</label>' +
            '<input class="campo" value="' + esc(p.nome || '') + '" ' + t + ' data-campo="nome" placeholder="Ex: Educação"></div>' +
          '<div class="pil-pct"><label class="rot">PERCENTUAL</label>' +
            '<input class="campo" type="number" min="0" max="100" step="1" value="' + esc(pct(p) || '') + '" ' +
            t + ' data-campo="percentual" data-vazio="0" placeholder="%"></div>' +
          '<div class="pil-funil"><label class="rot">FUNIL</label>' +
            '<select class="campo" ' + t + ' data-campo="funil">' + C.FUNIL.map(f =>
              '<option' + (p.funil === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></div>' +
        '</div>' +
        C.campo('OBJETIVO DO PILAR', p.objetivo, t + ' data-campo="objetivo"') +
        C.campo('OBSERVAÇÕES', p.observacoes, t + ' data-campo="observacoes"') +
      '</div>' +
      '<button class="ico perigo" data-excluir-pilar="' + esc(p.id) + '" title="Remover pilar">✕</button></div>';
  }

  /* soma e barra reagem a cada tecla, sem redesenhar os cartões (o foco
     ficaria perdido) */
  function resumoPilaresAoVivo() {
    const soma = document.getElementById('pil-soma');
    if (soma) soma.innerHTML = avisoSoma(somaPilares());
    const barra = document.getElementById('pil-barra');
    if (barra) barra.innerHTML = barraPilares();
    const dist = document.getElementById('pil-dist');
    if (dist) dist.innerHTML = distribuicaoPilares();
  }

  function ligarPilares(p) {
    const add = p.querySelector('#add-pilar');
    if (add) add.onclick = async () => {
      try {
        const novo = await B7.Save.acao(() => B7.DB.criarPilar({
          linha_id: L.linha.id, position: L.pilares.length, nome: '', percentual: 0, funil: 'Topo'
        }), 'Pilar adicionado');
        L.pilares.push(novo);
        renderCorpo();
        const campo = document.querySelector('[data-pilar="' + novo.id + '"] [data-campo="nome"]');
        if (campo) campo.focus();
      } catch (e) {}
    };
    p.querySelectorAll('[data-excluir-pilar]').forEach(b => b.onclick = () => {
      const id = b.dataset.excluirPilar;
      const pilar = L.pilares.find(x => x.id === id);
      const ligados = reaisDoPilar({ id });
      B7.UI.confirmar({
        titulo: 'Remover o pilar ' + (pilar && pilar.nome ? '“' + pilar.nome + '”' : '') + '?',
        texto: ligados ? ligados + ' conteúdo' + (ligados === 1 ? ' fica' : 's ficam') + ' sem pilar. Nenhum conteúdo é apagado.'
                       : 'Nenhum conteúdo está ligado a ele.',
        rotulo: 'Remover', perigo: true,
        aoConfirmar: async () => {
          try {
            await B7.Save.agora().catch(() => {});
            await B7.Save.acao(() => B7.DB.excluirPilar(id), 'Pilar removido');
            L.pilares = L.pilares.filter(x => x.id !== id);
            L.conteudos.forEach(c => { if (c.pilar_id === id) c.pilar_id = null; });
            renderCorpo();
          } catch (e) {}
        }
      });
    });
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
        '<span>' + (c.data_postagem ? B7.UI.dataBR(c.data_postagem) : 'sem data') + '</span>' +
        (nomeDoPilar(c.pilar_id) ? '<span class="p"></span><span class="cc-pilar">' + esc(nomeDoPilar(c.pilar_id)) + '</span>' : '') +
      '</div>' +
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
     Duas visualizações: lista e calendário. É calendário editorial, não
     agenda: cada dia mostra o que está marcado para ele.

     Datas são "date-only": strings YYYY-MM-DD do começo ao fim. Nunca
     `new Date('YYYY-MM-DD')` — isso é meia-noite UTC e no Brasil vira o
     dia anterior. Só o dia da semana usa Date, e com componentes locais. */
  let vistaPostagens = 'lista';

  const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const iso = (a, m, d) => a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const diasNoMes = (a, m) => new Date(a, m, 0).getDate();       // m = 1..12
  const diaSemana = (a, m, d) => new Date(a, m - 1, d).getDay();  // 0 = domingo, local
  const MAX_POR_DIA = 3;

  function mesAnterior(c) { return c.mes === 1 ? { ano: c.ano - 1, mes: 12 } : { ano: c.ano, mes: c.mes - 1 }; }
  function mesSeguinte(c) { return c.mes === 12 ? { ano: c.ano + 1, mes: 1 } : { ano: c.ano, mes: c.mes + 1 }; }

  /* as células de um mês, em semanas completas (DOM..SÁB), com os dias
     vizinhos marcados como `fora` */
  function celulasDoMes(ano, mes) {
    const total = diasNoMes(ano, mes);
    const antes = diaSemana(ano, mes, 1);
    const ant = mesAnterior({ ano, mes }), seg = mesSeguinte({ ano, mes });
    const totalAnt = diasNoMes(ant.ano, ant.mes);
    const cels = [];
    for (let i = antes - 1; i >= 0; i--) cels.push({ iso: iso(ant.ano, ant.mes, totalAnt - i), dia: totalAnt - i, fora: true });
    for (let d = 1; d <= total; d++) cels.push({ iso: iso(ano, mes, d), dia: d, fora: false });
    let d = 1;
    while (cels.length % 7) cels.push({ iso: iso(seg.ano, seg.mes, d), dia: d++, fora: true });
    return cels;
  }

  function itemCal(c) {
    return '<button class="cal-ev" data-conteudo="' + esc(c.id) + '" title="' + esc(c.titulo || 'Sem título') + '">' +
      '<span class="cal-ev-ic">' + ICONE_FORMATO[c.tipo] + '</span>' +
      '<span class="cal-ev-tx">' + esc(c.titulo || 'Sem título') + '</span></button>';
  }

  function calendario() {
    const cal = L.cal || { ano: +L.linha.ano, mes: +L.linha.mes };
    const hoje = B7.UI.hojeISO();
    const porDia = {};
    L.conteudos.filter(c => c.data_postagem).forEach(c => {
      const d = String(c.data_postagem).slice(0, 10);
      (porDia[d] = porDia[d] || []).push(c);
    });
    Object.values(porDia).forEach(lista => lista.sort((a, b) => (a.position || 0) - (b.position || 0)));

    const cels = celulasDoMes(cal.ano, cal.mes);
    const prefixo = iso(cal.ano, cal.mes, 1).slice(0, 7);
    const noMes = L.conteudos.filter(c => c.data_postagem && String(c.data_postagem).slice(0, 7) === prefixo);
    const semData = L.conteudos.filter(c => !c.data_postagem);
    const mesDaLinha = cal.ano === +L.linha.ano && cal.mes === +L.linha.mes;

    const grade = cels.map(cel => {
      const itens = porDia[cel.iso] || [];
      const extra = itens.length - MAX_POR_DIA;
      return '<div class="cal-d' + (cel.fora ? ' fora' : '') + (itens.length ? ' tem' : '') +
        (cel.iso === hoje ? ' hoje' : '') + '" data-dia="' + cel.iso + '">' +
        '<div class="cal-n">' + cel.dia + '</div>' +
        '<div class="cal-evs">' + itens.slice(0, MAX_POR_DIA).map(itemCal).join('') +
        (extra > 0 ? '<button class="cal-mais" data-mais="' + cel.iso + '">+' + extra + '</button>' : '') +
        '</div></div>';
    }).join('');

    /* vista agenda: a mesma informação em lista por dia (celular) */
    const diasComItens = Object.keys(porDia).filter(d => d.startsWith(prefixo)).sort();
    const agenda = diasComItens.length
      ? diasComItens.map(d => {
          const dia = +d.slice(8, 10);
          return '<div class="cal-ag-dia' + (d === hoje ? ' hoje' : '') + '">' +
            '<div class="cal-ag-data"><b>' + dia + '</b><small>' + DIAS_SEMANA[diaSemana(cal.ano, cal.mes, dia)] + '</small></div>' +
            '<div class="cal-ag-itens">' + porDia[d].map(itemCal).join('') + '</div></div>';
        }).join('')
      : '<div class="cal-ag-vazio">Nenhuma postagem marcada em ' + esc(MESES[cal.mes - 1]) + '.</div>';

    return '<div class="cal-mes">' +
      '<div class="cal-nav">' +
        '<button class="ico" data-cal="ant" aria-label="Mês anterior" title="Mês anterior">‹</button>' +
        '<div class="cal-titulo"><b>' + esc(MESES[cal.mes - 1]) + '</b><span>' + cal.ano + '</span>' +
          '<small>' + noMes.length + ' postage' + (noMes.length === 1 ? 'm' : 'ns') + '</small></div>' +
        '<button class="ico" data-cal="prox" aria-label="Próximo mês" title="Próximo mês">›</button>' +
        (mesDaLinha ? '' : '<button class="b p" data-cal="linha">Mês da linha</button>') +
      '</div>' +
      '<div class="cal-grade-mes">' +
        '<div class="cal-cab">' + DIAS_SEMANA.map(d => '<span>' + d + '</span>').join('') + '</div>' +
        '<div class="cal-dias">' + grade + '</div>' +
      '</div>' +
      '<div class="cal-agenda">' + agenda + '</div>' +
      /* sem data não é pendência: é conteúdo que ainda não foi agendado */
      (semData.length ? '<div class="cal-soltos"><small>SEM DATA DEFINIDA</small>' +
        semData.map(itemCal).join('') + '</div>' : '') +
    '</div>';
  }

  function postagens() {
    const comData = L.conteudos.filter(c => c.data_postagem)
      .sort((a, b) => String(a.data_postagem).localeCompare(String(b.data_postagem)));
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
    if (vistaPostagens === 'calendario') return seletor + '<div class="bloco bloco-cal">' + calendario() + '</div>';

    const linhaPost = c => {
      const d = c.data_postagem ? String(c.data_postagem).slice(0, 10) : '';
      return '<div class="post-linha" data-conteudo="' + esc(c.id) + '">' +
        '<div class="post-data">' + (d
          ? '<b>' + esc(d.slice(8, 10)) + '</b><small>' +
            esc(MESES[+d.slice(5, 7) - 1].slice(0, 3).toUpperCase()) + '</small>'
          : '<span class="sem-data">—</span>') + '</div>' +
        '<span class="post-formato">' + ICONE_FORMATO[c.tipo] + '</span>' +
        '<div class="post-tx"><b>' + esc(c.titulo || 'Sem título') + '</b>' +
        '<small>' + esc(c.tipo) +
        (c.canal ? ' · ' + esc(c.canal) : '') +
        (nomeDoPilar(c.pilar_id) ? ' · ' + esc(nomeDoPilar(c.pilar_id)) : '') + '</small></div>' +
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
      vistaPostagens = b.dataset.vista; renderCorpo();
    });
    p.querySelectorAll('[data-ir-aba]').forEach(b => b.onclick = () => trocarAba(b.dataset.irAba));

    /* calendário: navegação de mês e "+N" (expande o dia) */
    p.querySelectorAll('[data-cal]').forEach(b => b.onclick = () => {
      const c = L.cal || { ano: +L.linha.ano, mes: +L.linha.mes };
      L.cal = b.dataset.cal === 'ant' ? mesAnterior(c)
            : b.dataset.cal === 'prox' ? mesSeguinte(c)
            : { ano: +L.linha.ano, mes: +L.linha.mes };
      renderCorpo();
    });
    p.querySelectorAll('[data-mais]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const cel = b.closest('.cal-d');
      const dia = b.dataset.mais;
      const itens = L.conteudos.filter(c => c.data_postagem && String(c.data_postagem).slice(0, 10) === dia)
        .sort((x, y) => (x.position || 0) - (y.position || 0));
      cel.classList.add('aberta');
      cel.querySelector('.cal-evs').innerHTML = itens.map(itemCal).join('');
      cel.querySelectorAll('[data-conteudo]').forEach(el => el.onclick = ev => {
        ev.stopPropagation(); abrirConteudo(el.dataset.conteudo);
      });
    });
    ligarPilares(p);
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
        atualizar();
      } catch (e) {}
    });
    /* Liberar no portal é uma decisão explícita da equipe: nada fica
       visível ao cliente só porque foi salvo. */
    p.querySelectorAll('[data-enviar-aprovacao], [data-ap-enviar]').forEach(b => b.onclick = () => enviarParaAprovacao());
    p.querySelectorAll('#ap-status-linha [data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });

    const portal = p.querySelector('[data-portal-linha]');
    if (portal) portal.onclick = async () => {
      const ligar = !L.linha.visivel_cliente;
      try {
        await B7.Save.acao(() => B7.DB.atualizarLinha(L.linha.id, { visivel_cliente: ligar }),
          ligar ? 'Linha liberada no portal do cliente' : 'Linha oculta do portal');
        L.linha.visivel_cliente = ligar;
        atualizar();
      } catch (e) {}
    };

    const arquivar = p.querySelector('[data-arquivar-linha]');
    if (arquivar) arquivar.onclick = async () => {
      const ligar = !L.linha.archived_at;
      try {
        await B7.Save.acao(() => B7.DB.arquivarLinha(L.linha.id, ligar),
          ligar ? 'Linha arquivada' : 'Linha desarquivada');
        L.linha.archived_at = ligar ? new Date().toISOString() : null;
        atualizar();
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
        m.fechar(); atualizar();
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
        atualizar();
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
         ['canais', 'Canais e meta', true], ['pilares', 'Pilares de conteúdo', true],
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

        /* pilares copiados ganham id novo; o mapa liga o antigo ao novo
           para os criativos continuarem apontando para o pilar certo */
        const mapaPilar = {};
        if (quer('pilares')) {
          for (let i = 0; i < L.pilares.length; i++) {
            const pl = L.pilares[i];
            const novoP = await B7.DB.criarPilar({ linha_id: nova.id, position: i, nome: pl.nome,
              percentual: pl.percentual, funil: pl.funil, objetivo: pl.objetivo, observacoes: pl.observacoes });
            mapaPilar[pl.id] = novoP.id;
          }
        }

        if (quer('criativos')) {
          for (let i = 0; i < L.conteudos.length; i++) {
            const c = L.conteudos[i];
            const novoC = await B7.DB.criarConteudo({
              client_id: c.client_id, linha_id: nova.id, tipo: c.tipo, position: i,
              titulo: c.titulo, objetivo: c.objetivo, ideia_geral: c.ideia_geral, tema: c.tema,
              canal: c.canal, headline: c.headline, sub_headline: c.sub_headline, cta: c.cta,
              legenda: c.legenda, direcao: c.direcao, observacao_design: c.observacao_design,
              data_postagem: quer('datas') ? c.data_postagem : null,
              pilar_id: (c.pilar_id && mapaPilar[c.pilar_id]) || null,
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
      /* pilar: só quando a linha tem pilares; vazio grava null (data-nulo) */
      (L.pilares.length
        ? '<div class="mb"><label class="rot">PILAR DE CONTEÚDO <span class="leve">— opcional</span></label>' +
          '<select class="campo" ' + t + ' data-campo="pilar_id" data-nulo>' +
            '<option value=""' + (!c.pilar_id ? ' selected' : '') + '>Sem pilar</option>' +
            L.pilares.map((p, i) => '<option value="' + esc(p.id) + '"' + (c.pilar_id === p.id ? ' selected' : '') + '>' +
              String(i + 1).padStart(2, '0') + ' · ' + esc(p.nome || 'Pilar sem nome') +
              (pct(p) ? ' (' + pct(p) + '%)' : '') + '</option>').join('') +
          '</select></div>'
        : '') +
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
      { larga: true, extra: 'modal-conteudo', aoFechar: () => { B7.Save.agora().catch(() => {}); atualizar(); } });

    C.ligarCampos(m, espelhar);

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
      C.ligarCampos(m, espelhar); ligarRemocoes(m); ligarArrasto(m);
    };
    const addFrame = m.querySelector('#add-frame');
    if (addFrame) addFrame.onclick = async () => {
      const total = m.querySelectorAll('[data-frame]').length;
      const novo = await B7.Save.acao(() => B7.DB.criarFrame({ content_id: c.id, position: total }), 'Story adicionado');
      m.querySelector('#lista-frames').insertAdjacentHTML('beforeend', itemFrame(novo, total));
      C.ligarCampos(m, espelhar); ligarRemocoes(m); ligarArrasto(m);
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
