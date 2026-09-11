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
  /* ícone de GRAVAÇÃO no calendário: câmera, deliberadamente diferente de
     todo ícone de formato de postagem — em cinza também dá pra separar */
  const ICONE_GRAVACAO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1-1.8h5L15.5 6h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>';

  /* -------------------------------------------------------------- DESIGN
     Rótulo/classe (as mesmas do chip-revisao, já existente no sistema)
     por status de design_deliverables. */
  const DESIGN_STATUS = {
    aguardando_producao: ['Não iniciado', 'criacao'],
    em_criacao:          ['Em criação', 'criacao'],
    revisao_interna:     ['Revisão interna', 'revisao'],
    ajustes:              ['Ajustes', 'revisao'],
    aprovado_interno:    ['Aprovado', 'aprovado'],
    aguardando_cliente:  ['Aguardando cliente', 'pronto'],
    ajustes_cliente:     ['Ajustes do cliente', 'revisao'],
    aprovado_cliente:    ['Aprovado pelo cliente', 'aprovado'],
    finalizado:          ['Finalizado', 'gravado']
  };
  const rotuloDesign = s => (DESIGN_STATUS[s] || [s || 'Sem status', 'criacao'])[0];
  const classeDesign = s => (DESIGN_STATUS[s] || [s, 'criacao'])[1];
  const TIPO_DESIGN_ROTULO = { card: 'Card', capa_reel: 'Capa de Reel', carrossel: 'Carrossel',
                                stories: 'Stories', outro: 'Outro' };
  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

  let L = { linha: null, conteudos: [], pilares: [], gravacoes: [], aba: 'geral', cliente: null,
            aprovacao: null, cal: null, design: [], designProducao: null, designPorConteudo: {} };

  /* A aba se chamava "Design" — igual ao nome da Central de Design do
     Designer (sidebar/home dele, builds -j/-k). As duas mostram peças de
     Design, então o rótulo repetido confundia: "Produção" deixa claro que
     aqui é o status das peças DESTA linha, não a fila de trabalho pessoal
     do Designer (essa é a Central). A chave interna ('design', usada em
     dataset/roteamento) não muda — só o texto do botão da aba. */
  const ABAS = [['geral', 'Visão geral'], ['estrategia', 'Estratégia'],
                ['criativos', 'Criativos'], ['postagens', 'Postagens'], ['design', 'Produção']];

  /* ------------------------------------------------------------ abrir */
  async function abrir(id, aba) {
    L.aba = ABAS.some(([k]) => k === aba) ? aba : 'geral';
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('detalhe') + '</div>';
    try {
      L.linha = await B7.DB.linha(id);
      [L.conteudos, L.cliente, L.pilares] = await Promise.all([
        B7.DB.listarConteudos(id), B7.DB.cliente(L.linha.client_id),
        B7.DB.listarPilares(id).catch(() => [])
      ]);
      try { L.aprovacao = (await B7.DB.ultimasAprovacoes('linha', [id]))[id] || null; } catch (e) { L.aprovacao = null; }
      /* gravações do cliente entram no calendário editorial (Gravação),
         ao lado das postagens — sem inventar data: só as que já têm
         data_gravacao aparecem. Falha aqui não impede a linha de abrir. */
      try { L.gravacoes = await B7.DB.listarGravacoes(L.linha.client_id); } catch (e) { L.gravacoes = []; }
    } catch (e) { return B7.Dashboard.erroConteudo(e, (L.linha || {}).client_id || ''); }

    /* Design (B7 Design): busca só uma vez ao abrir a linha, nunca por
       card — falha aqui não impede a linha de abrir. */
    await carregarDesign();

    /* o calendário abre no mês da linha; a navegação é só visual */
    L.cal = { ano: +L.linha.ano, mes: +L.linha.mes };
    B7.Rota.titulo([L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano), L.linha.cliente_nome]);
    render();
  }

  /* Só a equipe (admin/coordenador) envia conteúdo para Design — mesma
     regra do banco (sou_equipe), espelhada aqui só para esconder a ação
     de quem não pode usá-la. Sem sessão, comporta-se como antes da
     autenticação (mesmo padrão de B7.Perm). */
  function podeEnviarDesign() {
    return !(B7.Auth && B7.Auth.usuario()) || B7.Auth.ehEquipe();
  }

  async function carregarDesign() {
    try {
      L.design = await B7.DB.listarDesign({ linhaId: L.linha.id });
    } catch (e) { L.design = []; }
    try {
      L.designProducao = await B7.DB.designProducaoDaLinha(L.linha.id);
    } catch (e) { L.designProducao = null; }
    L.designPorConteudo = {};
    L.design.forEach(p => { if (p.conteudo_id) L.designPorConteudo[p.conteudo_id] = p; });
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
           L.aba === 'criativos' ? criativos() :
           L.aba === 'design' ? design() : postagens();
  }

  function render() {
    const l = L.linha;
    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha-nav"><button data-ir="#/">' + (C.souDesignerSomenteLeitura() ? 'Central de Design' : 'Central B7') + '</button><span>/</span>' +
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
    B7.UI.ligarMenus(corpo);
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
      (l.canais ? '<span class="p"></span><span>' + esc(l.canais) + '</span>' : '') +
      (l.concluida_em ? '<span class="p"></span><span title="Última conclusão formal — libera demandas de Design">Concluída · v' + (l.versao_design || 1) + '</span>' : '') +
      '</div></div>' +
      '<div class="acoes">' +
        (C.souDesignerSomenteLeitura() ? '' : '<button class="b pri" data-novo-conteudo>+ Novo conteúdo</button>') +
        '<button class="b clara" data-baixar-linha>Baixar PDF</button>' +
        /* O menu "⋯" é só de gestão da Linha Editorial (duplicar, status,
           enviar para aprovação do cliente, portal, arquivar, excluir) —
           nada disso é ação do Designer. Ele chega aqui pelo link "Ver
           contexto da Linha Editorial" (B7.Design.abrirLinha), só para
           entender o briefing; a produção de Design dele fica na própria
           Central de Design, não aqui. */
        (C.souDesignerSomenteLeitura() ? '' :
        '<div class="menu"><button class="ico" style="color:rgba(255,255,255,.7)">⋯</button><div class="lista">' +
          '<button data-duplicar-linha>Duplicar para outro mês</button>' +
          '<button data-status-semanal>Criar status semanal</button>' +
          (podeEnviarDesign() ? '<button data-concluir-linha><b>Concluir Linha Editorial</b></button>' : '') +
          (podeEnviarDesign() ? '<button data-enviar-design-linha>Enviar para Design (rápido, sem versão)</button>' : '') +
          '<div class="rot">STATUS DA LINHA</div>' +
          C.STATUS_LINHA.map(v => '<button data-status-linha="' + esc(v) + '">' +
            (l.status === v ? '● ' : '') + esc(v) + '</button>').join('') +
          '<hr><button data-enviar-aprovacao>Enviar para aprovação do cliente</button>' +
          '<button data-portal-linha>' + (l.visivel_cliente ? '✓ Visível no portal do cliente' : 'Liberar no portal do cliente') + '</button>' +
          '<button data-arquivar-linha>' + (l.archived_at ? 'Desarquivar' : 'Arquivar') + '</button>' +
          '<button class="perigo" data-excluir-linha>Excluir linha editorial</button>' +
        '</div></div>') +
      '</div></div>';
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

  /* --------------------------------------------------- ENVIAR P/ DESIGN
     Gera as peças de Design (design_deliverables) a partir dos conteúdos
     da linha inteira ou de um conteúdo específico. Idempotente no banco:
     repetir nunca duplica — só recarrega os números reais depois. */
  async function enviarLinhaParaDesign() {
    try {
      const r = await B7.DB.gerarDesignDaLinha(L.linha.id);
      const criadas = r.criadas || 0, existentes = r.existentes || 0;
      let msg;
      if (criadas && existentes) {
        msg = plural(existentes, 'peça já existia', 'peças já existiam') + '. ' +
              plural(criadas, 'nova peça foi criada', 'novas peças foram criadas') + '.';
      } else if (criadas) {
        msg = plural(criadas, 'peça enviada', 'peças enviadas') + ' para Design.';
      } else if (existentes) {
        msg = plural(existentes, 'peça já existia', 'peças já existiam') + '.';
      } else {
        msg = 'Nenhuma peça gerada — nenhum conteúdo desta linha tem requisito visual de Design.';
      }
      B7.UI.toast(msg);
      await carregarDesign();
      atualizar();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível enviar para Design.', { tipo: 'erro' });
    }
  }

  /* -------------------------------------------------- CONCLUIR LINHA
     Gatilho formal (spec "B7 Design Final Operational Refinement" §5-13):
     gera/atualiza as peças de Design com um snapshot versionado, permite
     atribuir a um Designer específico (ou deixar em "Demandas a fazer"
     para qualquer um assumir) e dispara a notificação em lote. Distinto
     do "Enviar para Design" acima, que continua existindo para quem
     quiser gerar peças rapidamente sem passar pela versão/():
     linha_concluir reusa a mesma geração por baixo, então repetir aqui
     nunca duplica peça nenhuma. */
  async function concluirLinhaEditorial() {
    let designers = [];
    try { designers = await B7.DB.listarDesigners(); } catch (e) {}
    const jaConcluida = !!L.linha.concluida_em;
    const m = B7.UI.modal('<h3>Concluir Linha Editorial</h3>' +
      '<div class="sub">' + (jaConcluida
        ? 'Esta linha já foi concluída antes (v' + (L.linha.versao_design || 1) + '). Concluir de novo gera a próxima versão, mantém o histórico e sinaliza para o(a) Designer qualquer peça cujo briefing mudou.'
        : 'Libera as peças de Design desta linha para produção. Rascunhos e linhas ainda não concluídas não aparecem para o(a) Designer.') + '</div>' +
      '<label class="rot">RESPONSÁVEL PELO DESIGN (opcional)</label>' +
      '<select class="campo" id="cl-resp"><option value="">Sem responsável — fica em "Demandas a fazer"</option>' +
      designers.map(d => '<option value="' + esc(d.id) + '">' + esc(d.nome) + '</option>').join('') + '</select>' +
      '<div class="ajuda">Se escolher um(a) Designer, as peças sem responsável desta linha são atribuídas a ele(a) automaticamente e ele(a) é notificado(a).</div>' +
      '<div id="cl-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="cl-confirmar">Concluir</button></div>');
    const botao = m.querySelector('#cl-confirmar'), erro = m.querySelector('#cl-erro');
    botao.onclick = async () => {
      botao.disabled = true; botao.textContent = 'Concluindo…'; erro.textContent = '';
      try {
        const respId = m.querySelector('#cl-resp').value || null;
        const r = await B7.DB.concluirLinha(L.linha.id, respId);
        m.fechar();
        const partes = [plural(r.total_pecas || 0, 'peça de Design', 'peças de Design')];
        if (r.pecas_criadas) partes.push(plural(r.pecas_criadas, 'nova peça', 'novas peças'));
        if (r.pecas_atualizadas) partes.push(plural(r.pecas_atualizadas, 'peça com briefing atualizado', 'peças com briefing atualizado'));
        if (r.pecas_atribuidas) partes.push(plural(r.pecas_atribuidas, 'peça atribuída agora', 'peças atribuídas agora'));
        B7.UI.toast('Linha concluída (v' + r.versao + ') — ' + partes.join(', ') + '.');
        L.linha = await B7.DB.linha(L.linha.id);
        await carregarDesign();
        atualizar();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Concluir';
        erro.textContent = e.message || 'Não foi possível concluir a linha.';
      }
    };
  }

  async function enviarConteudoParaDesign(conteudoId) {
    try {
      const r = await B7.DB.gerarDesignDoConteudo(conteudoId);
      if (r.criada) B7.UI.toast('Peça de Design criada.');
      else if (r.motivo === 'ja_existia') B7.UI.toast('Peça de Design já existia.');
      else if (r.motivo === 'sem_requisito_visual') B7.UI.toast('Este conteúdo não gera peça de Design (Reel sem capa).');
      else B7.UI.toast('Não foi possível enviar para Design.', { tipo: 'erro' });
      await carregarDesign();
      atualizar();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível enviar para Design.', { tipo: 'erro' });
    }
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
          (C.souDesignerSomenteLeitura() ? '' : '<button class="b pri" data-novo-conteudo>+ Novo conteúdo</button>') +
        '</div></div>';
    }

    const metricas = [
      [total, total === 1 ? 'CONTEÚDO' : 'CONTEÚDOS'],
      estruturados ? [estruturados, 'ESTRUTURADOS'] : null,
      canais.length ? [canais.length, canais.length === 1 ? 'CANAL' : 'CANAIS'] : null,
      L.linha.meta_conteudos ? [L.linha.meta_conteudos, 'META'] : null
    ].filter(Boolean);

    return (B7.Aprovacoes ? '<div class="mb" id="ap-status-linha">' + B7.Aprovacoes.blocoStatus(L.aprovacao, { botaoEnviar: !C.souDesignerSomenteLeitura() }) + '</div>' : '') +
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
          '<button class="b p" data-ir-aba="estrategia" style="margin-top:10px">' +
          (C.souDesignerSomenteLeitura() ? 'Ver pilares' : 'Editar pilares') + '</button></div>' : '') +
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
  /* Uma barra só por pilar, não duas paradas em cima uma da outra: o
     preenchimento colorido é o REAL (quanto já foi feito), e uma marca
     (um tracinho vertical) sobre a barra indica onde fica o PLANEJADO —
     o mesmo padrão de "meta numa régua" que qualquer gráfico de
     progresso usa. Duas barras finas e paralelas, mesmo com cor e
     legenda certas, liam como elemento quebrado à primeira vista (é o
     que o dono seguiu reportando mesmo depois do contraste corrigido no
     build `-k`) — uma barra só, com uma marca de meta, é inequívoca sem
     precisar decifrar a legenda antes. */
  function distribuicaoPilares() {
    if (!L.pilares.length) return '';
    const maxB = Math.max(1, ...L.pilares.map(p => Math.max(planejadosDoPilar(p), reaisDoPilar(p))));
    const soltos = semPilar();
    return '<div class="pil-dist">' + L.pilares.map((p, i) => {
      const plan = planejadosDoPilar(p), real = reaisDoPilar(p);
      const estado = !L.conteudos.length ? '' : real === plan ? ' ok' : real < plan ? ' abaixo' : ' acima';
      /* "X de 0 planejados" lê como conta quebrada quando o pilar não tem
         percentual definido (0%). Nesse caso o texto muda para deixar
         claro que é falta de meta, não um erro de cálculo — sem
         percentual, também não existe marca de meta na barra. */
      const rf = pct(p) > 0
        ? '<b>' + real + '</b> de ' + plan + ' planejado' + (plan === 1 ? '' : 's')
        : '<b>' + real + '</b> ' + (real === 1 ? 'conteúdo' : 'conteúdos') + ' · sem % definido';
      return '<div class="pil-dist-l' + estado + '">' +
        '<div class="pil-dist-cab"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<b>' + esc(p.nome || 'Pilar sem nome') + '</b><span class="pc">' + pct(p) + '%</span>' +
        '<span class="rf">' + rf + '</span></div>' +
        '<div class="pil-dist-barras"><div class="barra unica" title="' + real + ' real' +
          (plan > 0 ? ' · meta ' + plan : '') + '">' +
          '<i class="fill" style="width:' + (real / maxB * 100) + '%"></i>' +
          (plan > 0 ? '<i class="alvo" style="left:' + Math.min(100, plan / maxB * 100) + '%"></i>' : '') +
        '</div></div></div>';
    }).join('') +
    '<div class="pil-legenda"><span class="real">Real</span><span class="plan">Meta (planejado)</span>' +
      (soltos ? '<span class="solto">' + soltos + ' conteúdo' + (soltos === 1 ? '' : 's') + ' sem pilar</span>' : '') +
    '</div></div>';
  }

  function secaoPilares() {
    const soma = somaPilares();
    const leitura = C.souDesignerSomenteLeitura();
    /* Designer: nada de input/select/botão de adicionar ou remover — não
       é "o mesmo card com os campos desabilitados", é um card diferente,
       só de leitura (cardPilarLeitura), sem "+ ADICIONAR PILAR". */
    return '<div class="bloco mb bloco-pilares" id="bloco-pilares">' +
      '<div class="pil-cab"><h3>' + (leitura ? 'PILARES DE CONTEÚDO' : 'ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO') + '</h3>' +
      '<div class="pil-soma" id="pil-soma">' + avisoSoma(soma) + '</div></div>' +
      (leitura ? '' : '<p class="ajuda" style="margin:0 0 12px">Os temas que sustentam o mês, com o peso de cada um. ' +
      'Cada conteúdo pode apontar para um pilar; a distribuição real aparece ao lado da planejada.</p>') +
      '<div id="pil-barra">' + barraPilares() + '</div>' +
      '<div id="lista-pilares">' + L.pilares.map((p, i) => leitura ? cardPilarLeitura(p, i) : cardPilar(p, i)).join('') + '</div>' +
      (L.pilares.length ? '' :
        '<div class="pil-vazio">Nenhum pilar ainda' + (leitura ? '.' : '. Comece com dois ou três: educação, autoridade, oferta…') + '</div>') +
      (leitura ? '' : '<button class="add-largo" id="add-pilar">+ ADICIONAR PILAR</button>') +
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

  /* Versão só de leitura do cartão de pilar (Designer): nada de
     input/select/textarea nem botão de remover — texto puro, seções
     vazias somem em vez de aparecer como um campo em branco. */
  function cardPilarLeitura(p, i) {
    const bloco = (rot, v) => !String(v || '').trim() ? '' :
      '<div class="pl-campo"><b>' + rot + '</b><p>' + esc(v) + '</p></div>';
    return '<div class="cartao-pilar leitura">' +
      '<div class="pilar-num">' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div class="pilar-corpo">' +
        '<div class="pl-cab"><b class="pl-nome">' + esc(p.nome || 'Pilar sem nome') + '</b>' +
          '<span class="pl-pct">' + pct(p) + '%</span>' +
          (p.funil ? '<span class="pl-funil">' + esc(p.funil) + '</span>' : '') + '</div>' +
        bloco('OBJETIVO DO PILAR', p.objetivo) +
        bloco('OBSERVAÇÕES', p.observacoes) +
      '</div></div>';
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
        (C.souDesignerSomenteLeitura() ? '' : '<div class="acoes"><button class="b pri" data-novo-conteudo>+ Novo conteúdo</button></div>') +
        '</div>';
    }
    return '<div class="grade-criativos" id="lista-criativos">' +
      L.conteudos.map((c, i) => cardConteudo(c, i)).join('') + '</div>' +
      (C.souDesignerSomenteLeitura() ? '' : '<button class="add-largo" data-novo-conteudo>+ NOVO CONTEÚDO</button>');
  }

  function cardConteudo(c, i) {
    const peca = L.designPorConteudo[c.id];
    const badgeDesign = peca
      ? '<button class="chip-revisao ' + classeDesign(peca.status) + ' badge-design" ' +
        'data-abrir-design="' + esc(peca.id) + '" title="Abrir peça de Design">' +
        'Design · ' + esc(rotuloDesign(peca.status)) + '</button>'
      : '';

    return '<div class="card-criativo spot eleva" data-conteudo="' + esc(c.id) + '">' +
      '<div class="cc-topo"><div class="cc-topo-esq"><span class="cc-num">POST ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="cc-formato">' + ICONE_FORMATO[c.tipo] + esc(c.tipo) + '</span></div>' +
        (podeEnviarDesign() ? '<div class="menu cc-menu"><button class="ico" title="Mais ações">⋯</button>' +
          '<div class="lista"><button data-enviar-design="' + esc(c.id) + '">Enviar para Design</button></div></div>' : '') +
      '</div>' +
      '<h3>' + esc(c.titulo || 'Sem título') + '</h3>' +
      '<div class="cc-meta">' +
        (c.canal ? '<span>' + esc(c.canal) + '</span><span class="p"></span>' : '') +
        '<span>' + (c.data_postagem ? B7.UI.dataBR(c.data_postagem) : 'sem data') + '</span>' +
        (nomeDoPilar(c.pilar_id) ? '<span class="p"></span><span class="cc-pilar">' + esc(nomeDoPilar(c.pilar_id)) + '</span>' : '') +
      '</div>' +
      (badgeDesign ? '<div class="cc-design">' + badgeDesign + '</div>' : '') +
      '<div class="cc-rodape">' + chipConteudo(c.status) +
        '<button class="cc-espiar" data-espiar="' + esc(c.id) + '" title="Visualização rápida">👁</button>' +
        '<span class="abrir">Abrir →</span></div></div>';
  }

  /* Cor dedicada ao status do Criativo — ver .status-conteudo em
     global.css. Independente de .chip-revisao (Design/Linha usam aquele). */
  const MAPA_STATUS_CONTEUDO = {
    'Ideia': 'sc-ideia', 'Em criação': 'sc-criacao', 'Em revisão': 'sc-revisao',
    'Aprovado': 'sc-aprovado', 'Programado': 'sc-programado', 'Publicado': 'sc-publicado'
  };
  function chipConteudo(s) {
    return '<span class="status-conteudo ' + (MAPA_STATUS_CONTEUDO[s] || 'sc-ideia') + '">' + esc(s) + '</span>';
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

  /* Postagem e Gravação são tipos de EVENTO — o que o item É — e nunca
     se confundem com o status (em que pé está a produção). O status
     entra só como um pontinho discreto (cal-ev-st); a cor/ícone/forma
     principal do item é sempre do tipo, e nunca muda com o status. */
  function statusPostagemDot(s) {
    if (s === 'Aprovado' || s === 'Publicado') return 'st-ok';
    if (s === 'Em revisão') return 'st-ambar';
    return '';
  }
  function statusGravacaoDot(s) {
    if (s === 'Gravado') return 'st-ok';
    if (s === 'Pronto para gravar') return 'st-ambar';
    return '';
  }

  function itemCal(item) {
    if (item._evento === 'gravacao') {
      const st = statusGravacaoDot(item.status);
      return '<button class="cal-ev cal-ev-grav" data-gravacao="' + esc(item.id) + '" ' +
        'title="Gravação — ' + esc(item.nome || 'Sem título') + (item.status ? ' · ' + esc(item.status) : '') + '">' +
        '<span class="cal-ev-ic">' + ICONE_GRAVACAO + '</span>' +
        '<span class="cal-ev-tx">' + esc(item.nome || 'Gravação') + '</span>' +
        (st ? '<span class="cal-ev-st ' + st + '" aria-hidden="true"></span>' : '') +
      '</button>';
    }
    const st = statusPostagemDot(item.status);
    return '<button class="cal-ev cal-ev-post" data-postagem-ver="' + esc(item.id) + '" ' +
      'title="Postagem — ' + esc(item.titulo || 'Sem título') + (item.status ? ' · ' + esc(item.status) : '') + '">' +
      '<span class="cal-ev-ic">' + ICONE_FORMATO[item.tipo] + '</span>' +
      '<span class="cal-ev-tx">' + esc(item.titulo || 'Sem título') + '</span>' +
      (st ? '<span class="cal-ev-st ' + st + '" aria-hidden="true"></span>' : '') +
    '</button>';
  }

  /* Todos os eventos (postagens + gravações) do mês, agrupados por dia
     ISO. Data-only o tempo todo — nunca `new Date('YYYY-MM-DD')`, que em
     UTC-3 desloca a data para o dia anterior. Uma gravação só entra aqui
     quando já tem data_gravacao de verdade: nunca é inventada. */
  function eventosPorDia() {
    const porDia = {};
    L.conteudos.filter(c => c.data_postagem).forEach(c => {
      const d = String(c.data_postagem).slice(0, 10);
      (porDia[d] = porDia[d] || []).push(Object.assign({ _evento: 'postagem' }, c));
    });
    (L.gravacoes || []).filter(g => g.data_gravacao).forEach(g => {
      const d = String(g.data_gravacao).slice(0, 10);
      (porDia[d] = porDia[d] || []).push(Object.assign({ _evento: 'gravacao' }, g));
    });
    Object.values(porDia).forEach(lista => lista.sort((a, b) => {
      if (a._evento !== b._evento) return a._evento === 'postagem' ? -1 : 1;
      return (a.position || 0) - (b.position || 0);
    }));
    return porDia;
  }

  function legendaCal() {
    return '<div class="cal-legenda">' +
      '<span class="cal-leg-item post"><span class="cal-leg-ic">' + ICONE_FORMATO.Reel + '</span>Postagem</span>' +
      '<span class="cal-leg-item grav"><span class="cal-leg-ic">' + ICONE_GRAVACAO + '</span>Gravação</span>' +
    '</div>';
  }

  function calendario() {
    const cal = L.cal || { ano: +L.linha.ano, mes: +L.linha.mes };
    const hoje = B7.UI.hojeISO();
    const porDia = eventosPorDia();

    const cels = celulasDoMes(cal.ano, cal.mes);
    const prefixo = iso(cal.ano, cal.mes, 1).slice(0, 7);
    const postsNoMes = L.conteudos.filter(c => c.data_postagem && String(c.data_postagem).slice(0, 7) === prefixo).length;
    const gravsNoMes = (L.gravacoes || []).filter(g => g.data_gravacao && String(g.data_gravacao).slice(0, 7) === prefixo).length;
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
      : '<div class="cal-ag-vazio">Nenhuma postagem ou gravação marcada em ' + esc(MESES[cal.mes - 1]) + '.</div>';

    return '<div class="cal-mes">' +
      legendaCal() +
      '<div class="cal-nav">' +
        '<button class="ico" data-cal="ant" aria-label="Mês anterior" title="Mês anterior">‹</button>' +
        '<div class="cal-titulo"><b>' + esc(MESES[cal.mes - 1]) + '</b><span>' + cal.ano + '</span>' +
          '<small>' + postsNoMes + ' postage' + (postsNoMes === 1 ? 'm' : 'ns') +
          (gravsNoMes ? ' · ' + gravsNoMes + ' gravaç' + (gravsNoMes === 1 ? 'ão' : 'ões') : '') + '</small></div>' +
        '<button class="ico" data-cal="prox" aria-label="Próximo mês" title="Próximo mês">›</button>' +
        (mesDaLinha ? '' : '<button class="b p" data-cal="linha">Mês da linha</button>') +
      '</div>' +
      '<div class="cal-grade-mes">' +
        '<div class="cal-cab">' + DIAS_SEMANA.map(d => '<span>' + d + '</span>').join('') + '</div>' +
        '<div class="cal-dias">' + grade + '</div>' +
      '</div>' +
      '<div class="cal-agenda">' + agenda + '</div>' +
      /* sem data não é pendência: é conteúdo que ainda não foi agendado.
         Gravação sem data nunca aparece aqui — não é inventada. */
      (semData.length ? '<div class="cal-soltos"><small>SEM DATA DEFINIDA</small>' +
        semData.map(c => itemCal(Object.assign({ _evento: 'postagem' }, c))).join('') + '</div>' : '') +
    '</div>';
  }

  function postagens() {
    const comData = L.conteudos.filter(c => c.data_postagem)
      .sort((a, b) => String(a.data_postagem).localeCompare(String(b.data_postagem)));
    const semData = L.conteudos.filter(c => !c.data_postagem);

    if (!L.conteudos.length) {
      return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        '<b>Nenhuma postagem ainda.</b><p>Os conteúdos aparecem aqui assim que forem criados.</p>' +
        (C.souDesignerSomenteLeitura() ? '' : '<div class="acoes"><button class="b pri" data-novo-conteudo>+ Novo conteúdo</button></div>') +
        '</div>';
    }

    const seletor = '<div class="vista-postagens">' +
      '<button data-vista="lista"' + (vistaPostagens === 'lista' ? ' class="on"' : '') + '>Lista</button>' +
      '<button data-vista="calendario"' + (vistaPostagens === 'calendario' ? ' class="on"' : '') + '>Calendário</button>' +
      '</div>';
    if (vistaPostagens === 'calendario') return seletor + '<div class="bloco bloco-cal">' + calendario() + '</div>';

    const linhaPost = c => {
      const d = c.data_postagem ? String(c.data_postagem).slice(0, 10) : '';
      return '<div class="post-linha" data-postagem-ver="' + esc(c.id) + '" role="button" tabindex="0" ' +
        'aria-label="Ver detalhe da postagem — ' + esc(c.titulo || 'Sem título') + '">' +
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

  /* ------------------------------------------------------------ DESIGN
     Produção de Design da linha: números reais de design_producao_linha
     e a lista real de design_resumo. Nada é inventado — se a linha ainda
     não tem nenhuma peça, o convite é para enviar, não um gráfico vazio. */
  function design() {
    const prod = L.designProducao;
    const podeEnviar = podeEnviarDesign();
    const acaoEnviar = podeEnviar
      ? '<button class="b pri" id="design-enviar-linha">Enviar linha para Design</button>' : '';

    if (!prod || !prod.total) {
      return '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        '<b>Nenhuma peça de Design ainda.</b>' +
        '<p>Envie os conteúdos desta linha para o time de Design gerar as peças — card, ' +
        'capa de reel (quando marcado), carrossel e stories.</p>' +
        (acaoEnviar ? '<div class="acoes">' + acaoEnviar + '</div>' : '') + '</div>';
    }

    const metricas = [
      [prod.total, prod.total === 1 ? 'PEÇA' : 'PEÇAS'],
      prod.finalizadas ? [prod.finalizadas, 'FINALIZADAS'] : null,
      prod.em_criacao ? [prod.em_criacao, 'EM CRIAÇÃO'] : null,
      prod.em_revisao ? [prod.em_revisao, 'EM REVISÃO INTERNA'] : null,
      prod.em_ajustes ? [prod.em_ajustes, 'EM AJUSTES'] : null,
      prod.aprovadas ? [prod.aprovadas, 'APROVADAS'] : null,
      prod.aguardando ? [prod.aguardando, 'AGUARDANDO PRODUÇÃO'] : null
    ].filter(Boolean);

    return (podeEnviar ? '<div class="linha-acao mb">' + acaoEnviar +
        '<small>Gera as peças que faltam para os conteúdos desta linha — não duplica o que já existe.</small></div>' : '') +
      '<div class="mini-metricas">' + metricas.map(([n, r]) =>
        '<div class="mini-metrica"><b>' + n + '</b><span>' + r + '</span></div>').join('') +
      '</div>' +
      '<div class="bloco"><h3>Peças de Design</h3>' +
        '<div class="design-tabela" id="lista-design">' + (L.design || []).map(linhaDesign).join('') + '</div>' +
      '</div>';
  }

  function linhaDesign(p) {
    return '<button class="design-linha" data-abrir-design="' + esc(p.id) + '">' +
      '<div class="dl-conteudo"><b>' + esc(p.conteudo_titulo || p.titulo || 'Sem título') + '</b>' +
      '<small>' + esc(TIPO_DESIGN_ROTULO[p.tipo] || p.tipo) + '</small></div>' +
      '<span class="dl-designer">' + esc(p.designer_nome || 'Sem designer') + '</span>' +
      '<span class="chip-revisao ' + classeDesign(p.status) + '">' + esc(rotuloDesign(p.status)) + '</span>' +
      '<span class="dl-prazo">' + (p.prazo ? B7.UI.dataBR(p.prazo) : '—') + '</span>' +
      '<span class="dl-versao">' + (p.ultima_versao ? 'v' + p.ultima_versao : '—') + '</span>' +
    '</button>';
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
        linha: L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano), gatilho: b
      });
    });
    p.querySelectorAll('[data-conteudo]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      abrirConteudo(el.dataset.conteudo);
    });
    /* Postagens (lista e calendário): abre a ficha de leitura, nunca o
       editor do Criativo direto — quem pode editar tem o botão "Abrir
       nos Criativos" dentro da própria ficha. */
    p.querySelectorAll('[data-postagem-ver]').forEach(el => {
      el.onclick = e => { e.stopPropagation(); abrirDetalhePostagem(el.dataset.postagemVer, el); };
      /* linhas da lista são <div role="button">: Enter/Espaço não disparam
         click sozinhos como num <button> de verdade */
      el.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      };
    });
    /* clique numa Gravação do calendário abre a ficha da gravação —
       o registro canônico, não uma cópia criada só pra desenhar o dia */
    p.querySelectorAll('[data-gravacao]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      location.hash = '#/gravacao/' + el.dataset.gravacao;
    });
    /* Design: enviar (linha inteira ou um conteúdo) e abrir a peça —
       o badge no card, a linha da tabela e o item do menu do card. */
    p.querySelectorAll('[data-enviar-design-linha], #design-enviar-linha').forEach(b => b.onclick = () => enviarLinhaParaDesign());
    p.querySelectorAll('[data-concluir-linha]').forEach(b => b.onclick = () => concluirLinhaEditorial());
    p.querySelectorAll('[data-enviar-design]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      enviarConteudoParaDesign(b.dataset.enviarDesign);
    });
    p.querySelectorAll('[data-abrir-design]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      location.hash = '#/design/' + b.dataset.abrirDesign;
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
      const itens = (eventosPorDia()[dia] || []);
      cel.classList.add('aberta');
      cel.querySelector('.cal-evs').innerHTML = itens.map(itemCal).join('');
      cel.querySelectorAll('[data-conteudo]').forEach(el => el.onclick = ev => {
        ev.stopPropagation(); abrirConteudo(el.dataset.conteudo);
      });
      cel.querySelectorAll('[data-gravacao]').forEach(el => el.onclick = ev => {
        ev.stopPropagation(); location.hash = '#/gravacao/' + el.dataset.gravacao;
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
              canal: c.canal,
              /* Carrossel não usa headline/cta próprios (Slide 1 e o
                 último slide já carregam isso) — só copia para os
                 formatos que ainda têm esses campos. */
              headline: c.tipo === 'Carrossel' ? null : c.headline,
              sub_headline: c.sub_headline,
              cta: c.tipo === 'Carrossel' ? null : c.cta,
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
      /* quem ficou por último no arrasto vira o CTA */
      if (cfg.attr === 'slide') marcarSlides(lista);
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
  /* Ficha de leitura da Postagem (aba Postagens: lista e calendário).
     Reaproveita o painel do QuickView — já é somente leitura por
     natureza — em vez de recriar um segundo componente de "espiada".
     Quem pode editar Criativos (mesma regra de podeEnviarDesign, que já
     é a regra real de equipe/RLS) ganha o botão "Abrir nos Criativos";
     quem não pode, nunca vê esse botão — e mesmo que chegasse lá, o
     editor de Criativo já trava sozinho para Designer (souDesignerSomenteLeitura). */
  function abrirDetalhePostagem(id, gatilho) {
    const c = L.conteudos.find(x => x.id === id);
    if (!c) return;
    B7.QuickView.abrirConteudo(c, {
      cliente: L.linha.cliente_nome, clienteLogo: L.linha.cliente_logo_url,
      linha: L.linha.nome || (MESES[L.linha.mes - 1] + ' ' + L.linha.ano),
      contexto: 'postagem', podeAbrirCriativos: podeEnviarDesign(), gatilho: gatilho
    });
  }

  async function abrirConteudo(id) {
    const c = L.conteudos.find(x => x.id === id);
    if (!c) return;
    /* ligarCampos (chamado mais abaixo) já trava os campos com
       data-campo/data-tab (Título, Canal, Data, Pilar, Objetivo…) para o
       Designer — mas os botões de AÇÃO deste modal (Status, Visível no
       portal, Necessita capa, Excluir, adicionar/remover slide ou story,
       vincular/desvincular roteiro) são ligados à parte, fora desse
       mecanismo, e continuavam clicáveis mesmo sem nenhum campo editável
       por perto. Aqui trocamos cada um por uma versão só de leitura. */
    const leitura = C.souDesignerSomenteLeitura();
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
      '<div class="mb"><label class="rot">STATUS</label>' +
        (leitura
          ? '<div class="opcoes"><button class="on" disabled>' + esc(c.status || 'Ideia') + '</button></div>'
          : '<div class="opcoes" id="st-conteudo">' +
            C.STATUS_CONTEUDO.map(v => '<button data-st="' + esc(v) + '"' + (c.status === v ? ' class="on"' : '') + '>' +
              v + '</button>').join('') + '</div>') +
      '</div>' +
      (leitura
        ? '<div class="op-mini' + (c.visivel_cliente ? ' on' : '') + '">' +
          (c.visivel_cliente ? '✓ Visível no portal do cliente' : 'Não visível no portal do cliente') + '</div>'
        : '<label class="op-mini' + (c.visivel_cliente ? ' on' : '') + '" id="ct-portal">' +
          '<input type="checkbox"' + (c.visivel_cliente ? ' checked' : '') + '> Visível no portal do cliente</label>') +
      C.campo('OBJETIVO', c.objetivo, t + ' data-campo="objetivo"') +
      C.campo('IDEIA GERAL', c.ideia_geral, t + ' data-campo="ideia_geral"');

    /* cada formato mostra só o que faz sentido para ele */
    let especifico = '';
    if (c.tipo === 'Reel') {
      especifico = '<div class="bloco-formato"><h4>Vídeo / Reel</h4>' +
        C.campoLinha('HEADLINE', c.headline, t + ' data-campo="headline"') +
        C.campoLinha('CTA', c.cta, t + ' data-campo="cta"') +
        '<div class="mb"><label class="rot">NECESSITA CAPA? <span class="leve">— opcional</span></label>' +
        (leitura
          ? '<div class="opcoes"><button class="on" disabled>' + (c.precisa_capa === true ? 'Sim' : c.precisa_capa === false ? 'Não' : 'Não definido') + '</button></div>'
          : '<div class="opcoes" id="op-capa">' +
            '<button data-capa="sim"' + (c.precisa_capa === true ? ' class="on"' : '') + '>Sim</button>' +
            '<button data-capa="nao"' + (c.precisa_capa === false ? ' class="on"' : '') + '>Não</button>' +
          '</div>') +
        '<div class="ajuda">Só com "Sim" o Enviar para Design gera a peça de capa deste Reel.</div></div>' +
        '<div class="vinculo-roteiro">' +
          (roteiro
            ? '<div class="vr-ok"><div><small>ROTEIRO VINCULADO</small>' +
              '<b>' + esc(roteiro.titulo || 'Sem título') + '</b></div>' +
              '<button class="b fina pri" data-abrir-roteiro="' + esc(roteiro.id) + '">Abrir roteiro</button>' +
              (leitura ? '' : '<button class="b fina" data-desvincular>Desvincular</button>') + '</div>'
            : leitura
              ? '<div class="vr-vazio"><div><b>Nenhum roteiro vinculado</b>' +
                '<small>O texto do vídeo vive no editor de roteiros, não aqui.</small></div></div>'
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
        '<button type="button" class="b fina contorno" id="btn-copiar-legenda" aria-label="Copiar legenda">Copiar legenda</button>' +
        C.campo('OBSERVAÇÃO PARA O DESIGN', c.observacao_design, t + ' data-campo="observacao_design"') + '</div>';
    }
    if (c.tipo === 'Carrossel') {
      /* Sem Headline nem CTA separados: o Slide 1 É a abertura (título/gancho)
         e o último slide É o CTA — sempre, dinamicamente, seja qual for a
         posição dele depois de adicionar, remover ou reordenar. */
      especifico = '<div class="bloco-formato"><h4>Carrossel</h4>' +
        '<div class="ajuda" style="margin:-4px 0 12px">O Slide 1 é a abertura. O último slide é sempre o CTA.</div>' +
        '<div id="lista-slides">' + slides.map((s, i) => itemSlide(s, i, slides.length)).join('') + '</div>' +
        (leitura ? '' : '<button class="add-largo" id="add-slide">+ ADICIONAR SLIDE</button>') +
        C.campo('LEGENDA', c.legenda, t + ' data-campo="legenda"') +
        '<button type="button" class="b fina contorno" id="btn-copiar-legenda" aria-label="Copiar legenda">Copiar legenda</button></div>';
    }
    if (c.tipo === 'Story') {
      especifico = '<div class="bloco-formato"><h4>Sequência de stories</h4>' +
        '<div id="lista-frames">' + frames.map((f, i) => itemFrame(f, i)).join('') + '</div>' +
        (leitura ? '' : '<button class="add-largo" id="add-frame">+ ADICIONAR STORY</button>') +
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
      '<div class="acoes">' +
      (leitura ? '' : '<button class="b perigo" data-excluir-conteudo>Excluir conteúdo</button>') +
      '<div style="flex:1"></div><button class="b pri" data-fecha>Concluir</button></div>',
      { larga: true, extra: 'modal-conteudo', aoFechar: () => { B7.Save.agora().catch(() => {}); atualizar(); } });

    C.ligarCampos(m, espelhar);

    /* "Copiar legenda" copia o valor ATUAL do campo, mesmo o que ainda
       não foi salvo (autosave tem debounce de 650ms) — lê direto do
       textarea na hora do clique, nunca do objeto em memória, que pode
       estar um instante atrasado em relação ao que a pessoa digitou. */
    const campoLegenda = m.querySelector('[data-campo="legenda"]');
    const btnCopiarLegenda = m.querySelector('#btn-copiar-legenda');
    if (campoLegenda && btnCopiarLegenda) {
      const atualizarBotaoCopiar = () => { btnCopiarLegenda.disabled = !campoLegenda.value.trim(); };
      atualizarBotaoCopiar();
      campoLegenda.addEventListener('input', atualizarBotaoCopiar);
      btnCopiarLegenda.onclick = () => B7.UI.copiarTexto(campoLegenda.value);
    }

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

    const opCapa = m.querySelector('#op-capa');
    if (opCapa) opCapa.querySelectorAll('[data-capa]').forEach(b => b.onclick = async () => {
      const valor = b.dataset.capa === 'sim';
      opCapa.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      c.precisa_capa = valor;
      try {
        await B7.Save.acao(() => B7.DB.atualizarConteudo(c.id, { precisa_capa: valor }),
          'Necessita capa: ' + (valor ? 'Sim' : 'Não'));
      } catch (e) {}
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
      const lista = m.querySelector('#lista-slides');
      const total = lista.querySelectorAll('[data-slide]').length;
      const novo = await B7.Save.acao(() => B7.DB.criarSlide({ content_id: c.id, position: total }), 'Slide adicionado');
      lista.insertAdjacentHTML('beforeend', itemSlide(novo, total, total + 1));
      /* o novo slide vira o último → vira o CTA; o antigo último deixa de ser */
      marcarSlides(lista);
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

  function itemSlide(s, i, total) {
    const t = 'data-tab="slides" data-id="' + esc(s.id) + '"';
    return '<div class="item-slide" data-slide="' + esc(s.id) + '">' +
      '<div class="is-num">' + rotuloSlide(i, total) + '</div>' +
      C.campoLinha('TÍTULO', s.titulo, t + ' data-campo="titulo"') +
      C.campo('TEXTO', s.texto, t + ' data-campo="texto"') +
      (C.souDesignerSomenteLeitura() ? '' :
        '<button class="ico perigo" data-excluir-slide="' + esc(s.id) + '" title="Remover">✕</button>') + '</div>';
  }

  /* Rótulo "SLIDE 01 · CAPA" / "SLIDE 06 · CTA" — a designação de CTA é
     sempre estrutural (o último slide), nunca um número gravado no banco. */
  function rotuloSlide(i, total) {
    const primeiro = i === 0, ultimo = i === total - 1, unico = total === 1;
    let rot = 'SLIDE ' + String(i + 1).padStart(2, '0');
    if (unico) rot += ' · CAPA · CTA';
    else if (primeiro) rot += ' · CAPA';
    else if (ultimo) rot += ' <span class="badge-cta">CTA</span>';
    return rot;
  }

  /* Renumera e reaplica os rótulos CAPA/CTA depois de adicionar, remover
     ou arrastar um slide — a posição no banco já mudou, isto só refaz o
     texto na tela sem precisar reler nada do servidor. */
  function marcarSlides(lista) {
    if (!lista) return;
    const itens = [...lista.querySelectorAll('[data-slide]')];
    itens.forEach((el, i) => {
      const num = el.querySelector('.is-num');
      if (num) num.innerHTML = rotuloSlide(i, itens.length);
    });
  }

  function itemFrame(f, i) {
    const t = 'data-tab="frames" data-id="' + esc(f.id) + '"';
    return '<div class="item-slide" data-frame="' + esc(f.id) + '">' +
      '<div class="is-num">STORY ' + String(i + 1).padStart(2, '0') + '</div>' +
      C.campo('TEXTO', f.texto, t + ' data-campo="texto"') +
      C.campo('DIREÇÃO VISUAL', f.direcao_visual, t + ' data-campo="direcao_visual"') +
      (C.souDesignerSomenteLeitura() ? '' :
        '<button class="ico perigo" data-excluir-frame="' + esc(f.id) + '" title="Remover">✕</button>') + '</div>';
  }

  function ligarRemocoes(m) {
    m.querySelectorAll('[data-excluir-slide]').forEach(b => b.onclick = async () => {
      await B7.Save.acao(() => B7.DB.excluirSlide(b.dataset.excluirSlide), 'Slide removido');
      const lista = b.closest('#lista-slides') || m.querySelector('#lista-slides');
      b.closest('[data-slide]').remove();
      /* quem sobrou por último agora é o CTA */
      marcarSlides(lista);
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
           duplicar: () => L.linha && modalDuplicar(),
           /* status do Criativo com a mesma cor em qualquer lugar do
              sistema que o mostre (card, ficha de Postagem, QuickView) */
           chipConteudo: chipConteudo };
})();
