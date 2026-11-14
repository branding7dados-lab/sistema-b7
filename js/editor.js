/* =====================================================================
   EDITOR
   Trilho de roteiros | painel de escrita | prévia A4 ao vivo.
   Nada aqui altera o texto do usuário: o que ele digita é o que vai para
   o banco e para o papel.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Editor = (function () {
  const esc = B7.UI.esc;
  const TIPOS = ['Gancho', 'Narrativa', 'Narração', 'CTA'];
  const vazio = t => !String(t || '').trim();
  const DIRECAO_PADRAO = { 'Gancho': 'DIRETO PRA CÂMERA', 'Narrativa': 'DIRETO PRA CÂMERA',
                           'Narração': 'VOZ EM OFF', 'CTA': 'DIRETO PRA CÂMERA' };

  let E = { gravacao: null, roteiros: [], cenas: {}, atual: null, aprovacoes: {} };
  let zoomManual = null;
  let fechadas = new Set();     // cenas recolhidas (só visual)
  let detalhesAbertos = false;  // 4.48.0: painel "Detalhes" do roteiro (objetivo, estágio, notas)

  /* =================================================== carregar */
  /* zzz64: quem é da casa mas não é equipe (videomaker, designer) abre
     o roteiro só para LER: nada é editável, nada é salvo. Continuam o
     Teleprompter, a apresentação, a visualização rápida, baixar e
     imprimir. O banco já recusava a escrita; isto evita a tela fingir
     que deixa. */
  const soLeitura = () => !!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario() && B7.Auth.ehEquipe && !B7.Auth.ehEquipe());
  function travarLeitura(cx) {
    if (!soLeitura() || !cx) return;
    cx.querySelectorAll('input, textarea').forEach(el => { el.readOnly = true; el.setAttribute('aria-readonly', 'true'); });
    cx.querySelectorAll('select').forEach(el => { el.disabled = true; });
    cx.querySelectorAll('[draggable="true"]').forEach(el => { el.draggable = false; el.ondragstart = e => e.preventDefault(); });
    cx.querySelectorAll('#revisao button, .tipos button').forEach(b => { b.disabled = true; });
  }

  async function abrir(gravacaoId, roteiroAlvo, acaoIA) {
    document.body.classList.toggle('ed-leitura', soLeitura());
    /* zzz48: o zoom era gravado e nunca lido — a escolha se perdia a cada
       recarga. E `fechadas` guardava as cenas recolhidas da gravação
       anterior, que reapareciam recolhidas na próxima. */
    zoomManual = B7.pref.ler('zoom', null);
    fechadas = new Set();
    document.getElementById('escrita').innerHTML =
      '<div class="b7-load"><div class="simbolo"></div><div class="txt">Carregando roteiros…</div></div>';
    document.getElementById('folhas').innerHTML = '';

    try {
      /* 4.15.0: "banco-<cliente>" abre o banco de roteiros do cliente
         (roteiros sem gravação) no mesmo editor */
      const banco = String(gravacaoId).startsWith('banco-');
      let gravacao, roteiros;
      if (gravacaoId === 'banco-geral') {
        gravacao = { id: gravacaoId, banco: true, geral: true, client_id: null, nome: 'Ideias e modelos, sem cliente', cliente_nome: 'Banco geral', cliente_logo_url: null, status: '', data_gravacao: null };
        roteiros = await B7.DB.roteirosGerais();
      } else if (banco) {
        const clienteId = String(gravacaoId).slice(6), c = await B7.DB.cliente(clienteId);
        gravacao = { id: gravacaoId, banco: true, client_id: clienteId, nome: 'Banco de roteiros', cliente_nome: c ? c.nome : '',
          cliente_logo_url: c ? c.logo_url : null, status: '', data_gravacao: null };
        roteiros = await B7.DB.roteirosDoBanco(clienteId);
      } else {
        gravacao = await B7.DB.gravacao(gravacaoId);
        roteiros = await B7.DB.listarRoteiros(gravacaoId);
      }
      document.body.classList.toggle('ed-banco', banco);
      document.body.classList.toggle('ed-geral', gravacaoId === 'banco-geral');
      const ids = roteiros.map(r => r.id);
      const todasCenas = await B7.DB.listarCenasDaGravacao(ids);
      const cenas = {};
      ids.forEach(id => cenas[id] = []);
      todasCenas.forEach(c => (cenas[c.script_id] = cenas[c.script_id] || []).push(c));

      let aprovacoes = {};
      try { aprovacoes = await B7.DB.ultimasAprovacoes('roteiro', ids); } catch (e) { aprovacoes = {}; }
      E = { gravacao, roteiros, cenas, atual: null, aprovacoes };
      const ultimo = B7.pref.ler('ultimo_roteiro_' + gravacaoId, null);
      E.atual = (roteiroAlvo && ids.includes(roteiroAlvo)) ? roteiroAlvo
              : (ultimo && ids.includes(ultimo) ? ultimo : (ids[0] || null));

      cabecalho();
      /* Antes criava o primeiro roteiro em branco automaticamente. Passou
         a NÃO criar mais: uma gravação marcada pelo calendário pode nunca
         precisar de roteiro nosso (às vezes o cliente já traz o dele
         pronto) — quem quiser o primeiro roteiro clica em "+ Novo roteiro"
         no estado vazio abaixo. */
      renderTrilho(); renderEscrita(); renderPrevia();
      B7.Save.atualizar();
      /* 4.15.0: a gravação já passou e ainda há roteiro sem "Gravado" */
      const hoje = new Date().toISOString().slice(0, 10), g0 = E.gravacao;
      const pend = !g0.banco && !soLeitura() && g0.data_gravacao && g0.data_gravacao < hoje ? E.roteiros.filter(r => r.status !== 'Gravado') : [];
      if (pend.length) B7.UI.toast('A gravação foi em ' + B7.UI.dataBR(g0.data_gravacao) + ' e ' + pend.length + (pend.length === 1 ? ' roteiro ainda não está' : ' roteiros ainda não estão') + ' como Gravado.', {
        tipo: 'aviso', tempo: 12000, acao: 'Marcar como gravados',
        aoClicar: async () => {
          try {
            await B7.Save.acao(async () => { for (const r of pend) { await B7.DB.atualizarRoteiro(r.id, { status: 'Gravado' }); r.status = 'Gravado'; } }, 'Roteiros marcados como gravados');
            renderTrilho(); renderEscrita();
          } catch (e) {}
        } });
      /* zzz128: veio de "Criar roteiro com IA" (linha editorial): abre a
         janela de rascunho deste roteiro. Só abre — quem manda gerar e
         quem escolhe as cenas é a pessoa. O "ia=rascunho" sai do endereço
         para não reabrir a janela ao recarregar. */
      if (acaoIA === 'novo' && !soLeitura()) { history.replaceState(null, '', location.hash.replace(/[?&]ia=novo/, '')); novoRoteiro(); }
      if (acaoIA === 'rascunho' && roteiroAlvo && E.atual === roteiroAlvo) {
        try { history.replaceState(null, '', location.pathname + location.search + location.hash.replace(/[?&]ia=rascunho/, '')); } catch (e) {}
        setTimeout(() => { const b = document.querySelector('#escrita [data-ia-rascunho]'); if (b) b.click(); }, 250);
      }
    } catch (e) {
      console.error(e);
      B7.UI.toast('Não consegui carregar a gravação: ' + (e.message || ''), { tipo: 'erro' });
      location.hash = '#/gravacoes';
    }
  }

  /* =================================================== cabeçalho */
  function cabecalho() {
    const g = E.gravacao;
    document.getElementById('ed-cliente').textContent = g.cliente_nome;
    B7.Rota.titulo([g.nome, g.cliente_nome]);
    document.getElementById('ed-gravacao').textContent =
      g.nome + (g.data_gravacao ? ' · ' + B7.UI.dataBR(g.data_gravacao) : '');
    const bt = document.getElementById('ed-status');
    bt.innerHTML = g.banco ? '<span class="chip-revisao">Sem gravação</span>' : B7.UI.chipStatus(g.status);
    if (B7.pintarPortalGravacao) B7.pintarPortalGravacao();
  }

  /* =================================================================
     ENVIAR PARA APROVAÇÃO

     Congela um retrato do roteiro e libera essa versão ao cliente. É uma
     ação explícita: o autosave grava o tempo todo e nunca envia nada.
     ================================================================= */
  async function enviarParaAprovacao() {
    if (soLeitura()) return;
    /* O estado do editor guarda a lista e o id do roteiro aberto; o
       roteiro em si é encontrado por E.atual. */
    const r = E.roteiros.find(x => x.id === E.atual), g = E.gravacao;
    if (!r || !g) { B7.UI.toast('Abra um roteiro antes de enviar', { tipo: 'erro' }); return; }

    let anteriores = [];
    try { anteriores = await B7.DB.aprovacoesDoMaterial('roteiro', r.id); } catch (e) {}
    const ultima = anteriores[0];
    const proxima = ultima ? (ultima.versao || 0) + 1 : 1;

    const m = B7.UI.modal('<h3>Enviar para aprovação</h3>' +
      '<div class="sub">O cliente vê o roteiro como está agora. ' +
      'Alterações depois do envio não mudam esta versão.</div>' +

      (ultima
        ? '<div class="env-anterior">Última versão enviada: <b>v' + (ultima.versao || 1) +
          '</b> — ' + esc(({ pendente: 'aguardando decisão', parcial: 'parcialmente revisada', aprovado: 'aprovada',
            ajustes: 'com ajustes pedidos', recusado: 'recusada', substituido: 'substituída' }[ultima.situacao] || ultima.situacao)) +
          '. Este envio cria a <b>v' + proxima + '</b>.</div>'
        : '<div class="env-anterior">Primeiro envio deste roteiro: será a <b>v1</b>.</div>') +

      '<label class="rot">RECADO PARA O CLIENTE (opcional)</label>' +
      '<textarea class="campo alta" id="env-obs" rows="2" ' +
        'placeholder="ex.: ajustamos o gancho conforme conversamos"></textarea>' +
      '<div id="env-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Enviar v' + proxima + '</button></div>');

    m.querySelector('[data-ok]').onclick = async () => {
      const botao = m.querySelector('[data-ok]');
      const erro = m.querySelector('#env-erro');
      botao.disabled = true; botao.textContent = 'Enviando…';
      try {
        /* O snapshot guarda o texto no momento do envio. Sem ele, editar
           o roteiro depois mudaria o que o cliente aprovou. */
        const cenas = (E.cenas[r.id] || []).map(c => ({
          id: c.id, position: c.position, tipo: c.tipo, direcao: c.direcao,
          funcao: c.funcao, texto: c.texto, sugestao_cenas: c.sugestao_cenas
        }));
        await B7.DB.enviarParaAprovacao({
          client_id: g.client_id,
          tipo: 'roteiro',
          alvo_id: r.id,
          snapshot: {
            titulo: r.titulo, objetivo: r.objetivo,
            observacao_gravacao: r.observacao_gravacao,
            escala: r.escala, escala_automatica: r.escala_automatica,
            cenas, gravacao: g.nome,
            cliente: g.cliente_nome, cliente_logo_url: g.cliente_logo_url || null,
            data_gravacao: g.data_gravacao || null
          },
          observacao: m.querySelector('#env-obs').value.trim() || null
        });
        m.fechar();
        B7.UI.toast('Roteiro enviado para aprovação (v' + proxima + ') — o cliente foi avisado');
        try { E.aprovacoes = Object.assign(E.aprovacoes, await B7.DB.ultimasAprovacoes('roteiro', [r.id])); } catch (e) {}
        renderEscrita();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Enviar v' + proxima;
        erro.textContent = e.message || 'Não foi possível enviar.';
      }
    };
  }

  function menuStatus() {
    if (E.gravacao && E.gravacao.banco) return;
    if (soLeitura()) return;
    const m = B7.UI.modal('<h3>Status da gravação</h3><div class="sub">Aparece no dashboard e na lista do cliente.</div>' +
      ['Rascunho', 'Pronto para gravar', 'Gravado'].map(s =>
        '<button class="b" style="width:100%;justify-content:flex-start;margin-bottom:8px" data-s="' + s + '">' +
        B7.UI.chipStatus(s) + '</button>').join('') +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
      const s = b.dataset.s;
      /* "Gravado" = concluir a gravação: passa pela regra canônica (data,
         histórico, calendário). Voltar de "Gravado" não desfaz a conclusão. */
      if (s === 'Gravado') {
        m.fechar();
        const ok = await B7.UI.confirmar({ titulo: 'Concluir esta gravação?',
          texto: 'Registra que a gravação aconteceu. Os itens que não foram marcados continuam como não gravados.', rotulo: 'Concluir gravação' });
        if (!ok) return;
        try {
          await B7.Save.acao(() => B7.DB.gravacaoConcluir(E.gravacao.id), 'Gravação concluída');
          Object.assign(E.gravacao, { status: 'Gravado', situacao: 'Gravada' }); cabecalho();
        } catch (e) {}
        return;
      }
      if (E.gravacao.situacao === 'Gravada') {
        m.fechar();
        B7.UI.toast('Esta gravação já foi concluída — a conclusão fica registrada no histórico.');
        return;
      }
      E.gravacao.status = s;

      /* A situação operacional acompanha o status escolhido aqui. Sem isto,
         marcar "Gravado" no editor não chegava à Central de Produção: a
         gravação continuava contada como "faltam gravar". */
      const patch = { status: s };
      Object.assign(E.gravacao, patch);

      cabecalho(); m.fechar();
      try {
        await B7.Save.acao(() => B7.DB.atualizarGravacao(E.gravacao.id, patch), 'Status: ' + s);
      } catch (e) {}
    });
  }

  /* ==================================================== trilho */
  function renderTrilho() {
    const t = document.getElementById('trilho');
    t.innerHTML = E.roteiros.map((r, i) =>
      /* zzz16: no celular o chip mostra também o começo do título
         (no desktop o trilho é estreito e o .chip-t fica escondido) */
      '<button class="chip' + (r.id === E.atual ? ' on' : '') + '" draggable="true" data-id="' + esc(r.id) + '">' +
      '<span class="chip-n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="chip-t">' + esc(r.titulo || 'Sem título') + '</span></button>').join('') +
      '<button class="add" id="bt-add-roteiro" title="Novo roteiro">+</button>';

    t.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => selecionar(c.dataset.id);
      c.onmouseenter = () => {
        const r = E.roteiros.find(x => x.id === c.dataset.id);
        B7.UI.dica(c, r && r.titulo ? r.titulo : 'Sem título');
      };
      c.onmouseleave = B7.UI.esconderDica;
      c.ondragstart = ev => { ev.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('arrastando'); B7.UI.esconderDica(); };
      c.ondragend = () => { c.classList.remove('arrastando'); t.querySelectorAll('.chip').forEach(x => x.classList.remove('alvo-drop-v')); };
      c.ondragover = ev => { ev.preventDefault(); c.classList.add('alvo-drop-v'); };
      c.ondragleave = () => c.classList.remove('alvo-drop-v');
      c.ondrop = ev => {
        ev.preventDefault();
        c.classList.remove('alvo-drop-v');
        moverRoteiro(ev.dataTransfer.getData('text/plain'), c.dataset.id);
      };
    });
    document.getElementById('bt-add-roteiro').onclick = () => novoRoteiro();
    travarLeitura(t);
  }

  function selecionar(id) {
    if (id === E.atual) return;
    E.atual = id;
    B7.pref.gravar('ultimo_roteiro_' + E.gravacao.id, id);
    renderTrilho(); renderEscrita(); renderPrevia();
    document.getElementById('escrita').scrollTop = 0;
  }

  async function moverRoteiro(idArrastado, idAlvo) {
    if (soLeitura()) return;
    if (idArrastado === idAlvo) return;
    const de = E.roteiros.findIndex(r => r.id === idArrastado);
    const para = E.roteiros.findIndex(r => r.id === idAlvo);
    if (de < 0 || para < 0) return;
    const [item] = E.roteiros.splice(de, 1);
    E.roteiros.splice(para, 0, item);
    E.roteiros.forEach((r, i) => r.position = i);
    renderTrilho(); renderPrevia();
    try {
      await B7.Save.acao(() => B7.DB.reordenarRoteiros(E.roteiros.map(r => ({ id: r.id, position: r.position }))));
    } catch (e) {}
  }

  /* ================================================== roteiros */
  async function novoRoteiro(silencioso) {
    if (soLeitura()) return;
    try {
      const r = await B7.Save.acao(() => B7.DB.criarRoteiro({
        recording_session_id: E.gravacao.banco ? null : E.gravacao.id,
        client_id: E.gravacao.client_id,
        position: E.roteiros.length,
        titulo: '', objetivo: '', observacao_gravacao: '',
        escala: 1, escala_automatica: true
      }), silencioso ? null : 'Roteiro criado');

      /* estrutura inicial que já usávamos: gancho, narrativa e CTA */
      const cenas = await B7.DB.criarCenas([
        { script_id: r.id, position: 0, tipo: 'Gancho', direcao: DIRECAO_PADRAO['Gancho'], texto: '', sugestao_cenas: '', funcao: '' },
        { script_id: r.id, position: 1, tipo: 'Narrativa', direcao: DIRECAO_PADRAO['Narrativa'], texto: '', sugestao_cenas: '', funcao: '' },
        { script_id: r.id, position: 2, tipo: 'CTA', direcao: DIRECAO_PADRAO['CTA'], texto: '', sugestao_cenas: '', funcao: '' }
      ]);
      E.roteiros.push(r);
      E.cenas[r.id] = cenas.sort((a, b) => a.position - b.position);
      E.atual = r.id;
      renderTrilho(); renderEscrita(); renderPrevia();
      const campo = document.querySelector('#escrita [data-campo="titulo"]');
      if (campo) campo.focus();
    } catch (e) {}
  }

  async function duplicarRoteiro(id) {
    if (soLeitura()) return;
    const r = E.roteiros.find(x => x.id === id);
    if (!r) return;
    try {
      const copia = await B7.Save.acao(() => B7.DB.duplicarRoteiro(r, E.roteiros.length), 'Roteiro duplicado');
      E.roteiros.push(copia);
      E.cenas[copia.id] = await B7.DB.listarCenas(copia.id);
      selecionar(copia.id);
      renderTrilho();
    } catch (e) {}
  }

  /* 4.17.0: mover / duplicar para: banco geral, banco de um cliente ou
     uma gravação (escolhendo cliente e gravação) */
  function escolher(titulo, sub, ops) {
    return new Promise(res => {
      let feito = false;
      const m = B7.UI.modal('<h3>' + esc(titulo) + '</h3>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
        '<div class="mv-lista">' + ops.map((o, i) => '<button type="button" class="mv-op" data-i="' + i + '">' + esc(o.nome) + (o.dica ? '<small>' + esc(o.dica) + '</small>' : '') + '</button>').join('') + '</div>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button></div>', { aoFechar: () => { if (!feito) res(null); } });
      m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { feito = true; m.fechar(); res(ops[+b.dataset.i]); });
    });
  }
  async function escolherDestino(r, duplicar) {
    const g = E.gravacao, nomeR = '“' + (r.titulo || 'Roteiro sem título') + '”';
    const ops = [];
    if (duplicar || !g.geral) ops.push({ k: 'geral', nome: '📚 Banco geral (sem cliente)' });
    if (g.client_id) {
      if (duplicar || !g.banco) ops.push({ k: 'banco', cli: g.client_id, nome: '📥 Banco de roteiros de ' + (g.cliente_nome || 'este cliente') });
      ops.push({ k: 'grav', cli: g.client_id, nome: '🎬 Uma gravação de ' + (g.cliente_nome || 'este cliente') + '…' });
    }
    ops.push({ k: 'outro', nome: g.client_id ? '👤 Outro cliente…' : '👤 Um cliente…', dica: 'banco de roteiros ou gravação do cliente' });
    let o = await escolher((duplicar ? 'Duplicar ' : 'Mover ') + nomeR, duplicar ? 'A cópia vai para o destino; o original fica onde está.' : 'As cenas vão junto.', ops);
    if (!o) return null;
    if (o.k === 'geral') return { gid: null, cli: null, rot: 'Banco geral' };
    let cli = o.cli, cliNome = g.cliente_nome;
    if (o.k === 'outro') {
      let cs = []; try { cs = await B7.DB.listarClientes(); } catch (e) {}
      cs = cs.filter(c => !c.deleted_at && c.id !== g.client_id).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      const c = await escolher('Para qual cliente?', '', cs.map(c => ({ id: c.id, nome: c.nome })));
      if (!c) return null;
      cli = c.id; cliNome = c.nome;
      const d = await escolher('Onde, em ' + c.nome + '?', '', [{ k: 'banco', nome: '📥 Banco de roteiros (sem gravação)' }, { k: 'grav', nome: '🎬 Uma gravação…' }]);
      if (!d) return null;
      o = { k: d.k };
    }
    if (o.k === 'banco') return { gid: null, cli, rot: 'Banco de roteiros de ' + cliNome };
    let gravs = []; try { gravs = await B7.DB.gravacoesAbertasDoCliente(cli); } catch (e) {}
    gravs = gravs.filter(x => x.id !== g.id);
    if (!gravs.length) { B7.UI.toast(cliNome + ' não tem gravação aberta. Crie uma gravação ou use o banco de roteiros.'); return null; }
    const gg = await escolher('Qual gravação?', '', gravs.map(x => ({ id: x.id, nome: x.nome + (x.data_gravacao ? ' · ' + B7.UI.dataBR(x.data_gravacao) : ' · sem data') })));
    if (!gg) return null;
    return { gid: gg.id, cli, rot: gg.nome };
  }
  const rotaDe = d => '#/gravacao/' + (d.gid || (d.cli ? 'banco-' + d.cli : 'banco-geral')) + '/roteiros';
  async function moverRoteiro(r) {
    if (soLeitura()) return;
    const d = await escolherDestino(r, false); if (!d) return;
    try {
      await B7.Save.acao(() => B7.DB.moverRoteiro(r.id, d.gid, d.cli), 'Roteiro movido');
      const idx = E.roteiros.findIndex(x => x.id === r.id);
      if (idx >= 0) E.roteiros.splice(idx, 1);
      if (E.atual === r.id) E.atual = E.roteiros.length ? E.roteiros[Math.max(0, idx - 1)].id : null;
      renderTrilho(); renderEscrita(); renderPrevia();
      B7.UI.toast('Roteiro movido para ' + d.rot, { acao: 'Abrir', aoClicar: () => { location.hash = rotaDe(d) + '?roteiro=' + r.id; } });
    } catch (e) {}
  }
  async function duplicarPara(r) {
    if (soLeitura()) return;
    const d = await escolherDestino(r, true); if (!d) return;
    try {
      const c = await B7.Save.acao(() => B7.DB.duplicarRoteiroPara(r, d.gid, d.cli), 'Roteiro duplicado');
      B7.UI.toast('Cópia criada em ' + d.rot, { acao: 'Abrir', aoClicar: () => { location.hash = rotaDe(d) + '?roteiro=' + c.id; } });
    } catch (e) {}
  }

  function excluirRoteiro(id) {
    if (soLeitura()) return;
    const idx = E.roteiros.findIndex(r => r.id === id);
    if (idx < 0) return;
    const registro = { ...E.roteiros[idx] };
    /* 4.13.1: só apaga com o nome do roteiro digitado */
    if (!excluirRoteiro.confirmado) {
      B7.UI.confirmar({ titulo: 'Apagar este roteiro?', texto: 'Ele vai para a Lixeira (dá para restaurar).', rotulo: 'Apagar roteiro', perigo: true,
        digitar: registro.titulo || 'apagar' }).then(ok => { if (ok) { excluirRoteiro.confirmado = true; try { excluirRoteiro(id); } finally { excluirRoteiro.confirmado = false; } } });
      return;
    }

    const aplicar = async () => {
      E.roteiros.splice(idx, 1);
      delete E.cenas[id];
      if (E.atual === id) E.atual = E.roteiros.length ? E.roteiros[Math.max(0, idx - 1)].id : null;
      renderTrilho(); renderEscrita(); renderPrevia();
      /* Vai para a lixeira, não é apagado: as cenas ficam no lugar e os
         vínculos (conteúdo da linha editorial, demandas da semana) não
         se perdem. Desfazer é só limpar deleted_at. */
      try {
        await B7.Save.acao(() => B7.DB.paraLixeira('roteiros', id));
        B7.UI.toast('Roteiro movido para a lixeira', {
          acao: 'Desfazer',
          aoClicar: async () => {
            try {
              await B7.Save.acao(() => B7.DB.restaurar_('roteiros', id), 'Roteiro restaurado');
              await abrir(E.gravacao.id, registro.id);
            } catch (e) {}
          }
        });
      } catch (e) {}
    };

    if (E.roteiros.length === 1) {
      B7.UI.confirmar({
        titulo: 'Excluir o único roteiro?',
        texto: 'A gravação ficará sem roteiros. Você pode desfazer logo em seguida.',
        rotulo: 'Excluir', perigo: true, aoConfirmar: aplicar
      });
    } else aplicar();
  }

  async function fixarRoteiro(r) {
    if (soLeitura()) return;
    try {
      await B7.Save.acao(() => B7.DB.fixar('roteiros', r.id, !r.is_pinned),
        r.is_pinned ? 'Removido dos fixados' : 'Adicionado aos fixados');
      r.is_pinned = !r.is_pinned;
      renderEscrita(); renderTrilho();
    } catch (e) {}
  }

  /* ============================================ painel de escrita */
  function renderEscrita() {
    const cx = document.getElementById('escrita');
    const r = E.roteiros.find(x => x.id === E.atual);
    if (!r) {
      cx.innerHTML = soLeitura()
        ? '<div class="vazio"><b>Nenhum roteiro nesta gravação</b><p>Quando a equipe escrever os roteiros, eles aparecem aqui.</p></div>'
        : '<div class="vazio"><b>Nenhum roteiro nesta gravação</b>' +
        '<p>Crie o primeiro roteiro para começar.</p>' +
        '<button class="b pri" onclick="B7.Editor.novoRoteiro()">+ Novo roteiro</button></div>';
      return;
    }
    const idx = E.roteiros.findIndex(x => x.id === r.id);
    const cenas = E.cenas[r.id] || [];

    /* 4.48.0: escrita em primeiro lugar — abre direto no título e nas
       cenas, como um documento. O que não é fala (objetivo, estágio,
       observação, nota interna, fonte da folha, IA e aprovação) fica no
       painel "Detalhes"; as ações do dia a dia ficam na barra de baixo. */
    const estagio = r.status || 'Em criação';
    const ia = B7.IAAnalise && !soLeitura() ? B7.IAAnalise.botoesHTML(r, cenas) : '';
    const IC_IA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z"/></svg>';
    cx.innerHTML =
      '<div class="ed2">' +
      '<div class="ed2-cab">' +
        '<div class="ed2-meta"><span class="ed2-n">Roteiro ' + String(idx + 1).padStart(2, '0') + '</span>' +
          '<span class="ed2-pt">·</span><span>' + cenas.length + ' cena' + (cenas.length === 1 ? '' : 's') + '</span>' +
          '<span class="ed2-estagio">' + esc(estagio) + '</span>' +
          '<div class="menu ed2-menu"><button class="ico" aria-label="Mais ações do roteiro">⋯</button><div class="lista">' +
            '<button data-acao="enviar-aprovacao">Enviar para aprovação</button><hr>' +
            '<button data-acao="baixar">Baixar roteiro</button>' +
            '<button data-acao="espiar">Visualização rápida</button>' +
            '<button data-acao="apresentar">Apresentar roteiros</button>' +
            (window.B7.Teleprompter && B7.Teleprompter.podeUsar && !B7.Teleprompter.podeUsar() ? '' : '<button data-acao="teleprompter">Abrir Teleprompter</button><hr>') +
            '<button data-acao="duplicar">Duplicar roteiro</button>' +
            '<button data-acao="mover">Mover para…</button>' +
            '<button data-acao="duplicar-para">Duplicar para…</button>' +
            '<button data-acao="novo">Novo roteiro</button>' +
            '<button data-acao="fixar">' + (r.is_pinned ? 'Desafixar' : 'Fixar roteiro') + '</button><hr>' +
            '<button class="perigo" data-acao="excluir">Excluir roteiro</button>' +
          '</div></div></div>' +
        '<textarea class="ed2-titulo cresce" data-campo="titulo" rows="1" placeholder="Título do roteiro">' + esc(r.titulo) + '</textarea>' +
        (vazio(r.objetivo) ? '' : '<p class="ed2-obj">' + esc(r.objetivo) + '</p>') +
        '<button class="ed2-det-bt' + (detalhesAbertos ? ' on' : '') + '" id="ed2-det-bt" aria-expanded="' + detalhesAbertos + '">' +
          '<span>Detalhes</span><small>objetivo, estágio, notas' + (ia ? ', IA' : '') + ' e aprovação</small><i>▾</i></button>' +
        '<div class="ed2-det"' + (detalhesAbertos ? '' : ' hidden') + ' id="ed2-det">' +
          ia +
          '<div class="mb" id="ap-status-roteiro">' + (B7.Aprovacoes ? B7.Aprovacoes.blocoStatus(E.aprovacoes[r.id], { botaoEnviar: !soLeitura() }) : '') + '</div>' +
          '<div class="mb"><label class="rot">OBJETIVO DO ROTEIRO</label>' +
          '<textarea class="campo cresce" data-campo="objetivo" rows="2" placeholder="O que esse vídeo precisa gerar">' + esc(r.objetivo) + '</textarea></div>' +
          '<div class="mb"><label class="rot">ESTÁGIO DO ROTEIRO</label>' +
          '<div class="opcoes" id="revisao">' + B7.UI.REVISAO.map(v =>
            '<button data-rev="' + v + '"' + (estagio === v ? ' class="on"' : '') + '>' + v + '</button>').join('') + '</div></div>' +
          '<div class="mb"><label class="rot">OBSERVAÇÃO DE GRAVAÇÃO</label>' +
          '<textarea class="campo cresce" data-campo="observacao_gravacao" rows="2" placeholder="Ex: plano fechado, mais energia, pausa antes do CTA">' + esc(r.observacao_gravacao) + '</textarea>' +
          '<div class="ajuda">Não faz parte da fala. Sai na folha como nota de produção.</div></div>' +
          '<div class="nota-b7"><label class="rot">NOTA INTERNA B7</label>' +
          '<textarea class="campo cresce" data-campo="nota_interna" rows="2" placeholder="Só a equipe vê. Ex: cliente pediu para evitar a palavra promoção.">' + esc(r.nota_interna || '') + '</textarea>' +
          '<div class="ajuda">Nunca entra no roteiro, na folha A4, no PDF nem no PNG.</div></div>' +
          '<div class="mb ed2-fonte"><label class="rot">TAMANHO DA LETRA NA FOLHA</label><div class="ed2-fonte-l">' +
            '<div class="escala"><button data-escala="-1" title="Diminuir fonte">A−</button>' +
            '<div class="pc">' + Math.round((r.escala || 1) * 100) + '%</div>' +
            '<button data-escala="1" title="Aumentar fonte">A+</button></div>' +
            '<button class="auto-bt' + (r.escala_automatica ? ' on' : '') + '" data-auto title="Ajusta a fonte sozinho">auto</button></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="ed2-cenas" id="lista-cenas">' +
        cenas.map((c, i) => cenaHTML(c, i)).join('') +
        '<button class="ed2-add" id="bt-add-cena"><i>+</i>Nova cena</button>' +
      '</div>' +
      (soLeitura() ? '' : '<div class="ed2-barra">' +
        '<button class="ed2-b" data-ed2="cena"><i>+</i><span>Cena</span></button>' +
        (ia ? '<button class="ed2-b" data-ed2="ia">' + IC_IA + '<span>IA</span></button>' : '') +
        '<button class="ed2-b" data-ed2="previa"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Prévia</span></button>' +
        '<button class="ed2-b pri" data-ed2="enviar"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4 12l16-8-6 16-3-7z"/></svg><span>Enviar</span></button>' +
      '</div>') +
      '</div>';

    ligarEscrita(r);
    B7.UI.ligarMenus(cx);
    travarLeitura(cx);
    if (B7.IAAnalise && !soLeitura()) B7.IAAnalise.ligar(cx, r, { impressao: () => impressaoDoRoteiro(r.id), salvar: () => B7.Save.agora(), verCena: verCena,
      ajustarCena: (cenaId, instrucao) => { verCena(cenaId); if (B7.IARoteiro) B7.IARoteiro.abrirCom(cenaId, instrucao); },
      adicionarCenas: lista => cenasDoRascunho(r.id, lista) });
  }

  /* Cenas de um rascunho da IA que a pessoa escolheu manter. Roteiro só
     com cenas em branco (o padrão de um roteiro novo): o rascunho ocupa
     essas cenas, na ordem, e o que sobrar entra no fim. Roteiro que já
     tem algo escrito: nada é tocado, as cenas novas entram no fim. */
  async function cenasDoRascunho(roteiroId, itens) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId] || (E.cenas[roteiroId] = []);
    const emBranco = c => !String(c.texto || '').trim() && !String(c.sugestao_cenas || '').trim();
    const livres = lista.every(emBranco) ? lista.slice() : [];
    const novas = [];
    itens.forEach(it => {
      const tipo = TIPOS.includes(it.tipo) ? it.tipo : 'Narrativa';
      const dados = { tipo: tipo, direcao: String(it.orientacao || '').trim() || DIRECAO_PADRAO[tipo], texto: String(it.fala || '') };
      const livre = livres.shift();
      if (livre) { Object.assign(livre, dados); B7.Save.campo('cenas', livre.id, dados); }
      else novas.push(dados);
    });
    if (novas.length) {
      const criadas = await B7.DB.criarCenas(novas.map((d, i) => Object.assign(
        { script_id: roteiroId, position: lista.length + i, sugestao_cenas: '', funcao: '' }, d)));
      criadas.sort((a, b) => a.position - b.position).forEach(c => lista.push(c));
      await persistirOrdemCenas(roteiroId);
    }
    try { await B7.Save.agora(); } catch (e) {}
    renderEscrita(); renderPrevia();
  }

  /* "Impressão" do roteiro como está na tela agora: título, objetivo e
     cenas. A análise de IA guarda a impressão do momento do pedido; se o
     roteiro mudar depois, a tela avisa que a análise ficou velha. */
  function impressaoDoRoteiro(id) {
    const r = E.roteiros.find(x => x.id === id); if (!r) return '';
    const s = JSON.stringify([r.titulo || '', r.objetivo || '', r.content_id || '',
      (E.cenas[id] || []).map(c => [c.id, c.tipo || '', c.direcao || '', c.texto || ''])]);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return s.length + ':' + h;
  }
  /* leva até a cena citada numa observação: abre se estiver recolhida, rola e destaca */
  function verCena(cenaId) {
    const el = document.querySelector('#lista-cenas .cena[data-cena="' + cenaId + '"]');
    if (!el) { B7.UI.toast('Esta cena não está mais no roteiro.'); return; }
    if (el.classList.contains('fechada')) { fechadas.delete(cenaId); el.classList.remove('fechada'); }
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.add('ia-alvo');
    setTimeout(() => el.classList.remove('ia-alvo'), 2200);
    const campo = el.querySelector('[data-c-campo="texto"]');
    if (campo) { try { campo.focus({ preventScroll: true }); } catch (e) {} }
  }

  /* 4.48.0: cena na linha do tempo — número na bolinha (cor do tipo),
     tipo numa etiqueta que abre a lista de tipos, direção em linha, texto
     sem caixa. "Melhorar com IA" aparece quando a cena está em foco. */
  const CHAVE_TIPO = { 'Gancho': 'gancho', 'Narrativa': 'narrativa', 'Narração': 'narracao', 'CTA': 'cta' };
  function cenaHTML(c, i) {
    const fechada = fechadas.has(c.id);
    const falta = c.tipo === 'Narração' && !String(c.sugestao_cenas || '').trim();
    const k = CHAVE_TIPO[c.tipo] || 'narrativa';
    return '<div class="entre" data-antes="' + i + '"><button aria-label="Adicionar cena aqui">+</button></div>' +
      '<div class="cena ed2-cena c-' + k + (fechada ? ' fechada' : '') + (falta ? ' alerta' : '') + '" data-cena="' + esc(c.id) + '" draggable="true">' +
      '<div class="cena-topo" title="Recolher / abrir"><span class="ed2-bola">' + (i + 1) + '</span></div>' +
      '<div class="ed2-cena-cx">' +
        '<div class="ed2-cena-meta">' +
          '<div class="menu ed2-tipo-menu"><button class="ed2-tipo" aria-label="Tipo da cena">' + esc(c.tipo || 'Narrativa') + '<i>▾</i></button><div class="lista">' +
            TIPOS.map(t => '<button data-tipo="' + t + '"' + (c.tipo === t ? ' class="on"' : '') + '>' + t + '</button>').join('') + '</div></div>' +
          '<input class="ed2-dir" data-c-campo="direcao" placeholder="Direção (ex.: direto pra câmera)" value="' + esc(c.direcao) + '" aria-label="Direção da cena">' +
          '<span class="puxa" title="Arraste para reordenar">⠿</span>' +
          '<div class="menu"><button class="ico" data-menu aria-label="Ações da cena">⋯</button><div class="lista">' +
            '<button data-c-acao="duplicar">Duplicar cena</button>' +
            '<button data-c-acao="cima">Mover para cima</button>' +
            '<button data-c-acao="baixo">Mover para baixo</button><hr>' +
            '<button class="perigo" data-c-acao="excluir">Excluir cena</button>' +
          '</div></div>' +
        '</div>' +
        '<div class="cena-corpo">' +
          '<textarea class="ed2-texto cresce" data-c-campo="texto" rows="2" placeholder="Escreva a fala desta cena…">' + esc(c.texto) + '</textarea>' +
          (c.tipo === 'Narração' ?
            '<div class="sugestao-cx ed2-sug' + (falta ? ' falta' : '') + '">' +
            '<label class="rot">IMAGENS DA NARRAÇÃO' + (falta ? ' · OBRIGATÓRIO' : '') + '</label>' +
            '<textarea class="cresce" data-c-campo="sugestao_cenas" rows="1" placeholder="Uma imagem por linha (ex.: motorista buscando o pedido)">' + esc(c.sugestao_cenas) + '</textarea></div>' : '') +
          /* assistente de IA do texto desta cena (só existe se o recurso estiver ligado) */
          (B7.IARoteiro && !soLeitura() ? B7.IARoteiro.html(c) : '') +
        '</div>' +
      '</div></div>';
  }

  function ligarEscrita(r) {
    const cx = document.getElementById('escrita');

    cx.querySelectorAll('textarea.cresce').forEach(B7.UI.autoAltura);

    /* campos do roteiro */
    cx.querySelectorAll('[data-campo]').forEach(el => {
      el.oninput = () => {
        if (el.tagName === 'TEXTAREA') B7.UI.autoAltura(el);
        const campo = el.dataset.campo;
        r[campo] = el.value;
        B7.Save.campo('roteiros', r.id, { [campo]: el.value });
        if (campo === 'titulo') renderTrilho();
        renderPrevia();
      };
    });

    /* escala */
    cx.querySelectorAll('[data-escala]').forEach(b => b.onclick = () => {
      const passo = +b.dataset.escala * 0.03;
      r.escala_automatica = false;
      r.escala = Math.min(1.15, Math.max(0.58, +((+r.escala || 1) + passo).toFixed(2)));
      B7.Save.campo('roteiros', r.id, { escala: r.escala, escala_automatica: false });
      renderEscrita(); renderPrevia();
    });
    cx.querySelector('[data-auto]').onclick = () => {
      r.escala_automatica = !r.escala_automatica;
      B7.Save.campo('roteiros', r.id, { escala_automatica: r.escala_automatica });
      renderEscrita(); renderPrevia();
    };

    /* estágio do roteiro: salva na hora e vira atividade */
    const rev = cx.querySelector('#revisao');
    if (rev) rev.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => {
      const v = b.dataset.rev;
      rev.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      r.status = v;
      try {
        await B7.Save.acao(() => B7.DB.atualizarRoteiro(r.id, { status: v }), 'Estágio: ' + v);
        B7.DB.registrar({ tipo: 'status', entidade: 'roteiro', id: r.id,
          cliente: E.gravacao.client_id, gravacao: E.gravacao.banco ? null : E.gravacao.id,
          texto: (r.titulo || 'Roteiro sem título') + ' → ' + v });
      } catch (e) {}
      renderTrilho();
    });

    /* bloco de aprovação (status do cliente) */
    cx.querySelectorAll('[data-ap-enviar]').forEach(b => b.onclick = () => enviarParaAprovacao());
    cx.querySelectorAll('#ap-status-roteiro [data-ir]').forEach(b => b.onclick = () => { location.hash = b.dataset.ir; });

    /* menu do roteiro */
    cx.querySelectorAll('[data-acao]').forEach(b => b.onclick = () => {
      const a = b.dataset.acao;
      if (a === 'enviar-aprovacao') return enviarParaAprovacao();
      if (a === 'duplicar') duplicarRoteiro(r.id);
      if (a === 'mover') moverRoteiro(r);
      if (a === 'duplicar-para') duplicarPara(r);
      if (a === 'novo') novoRoteiro();
      if (a === 'baixar') baixar(r.id);
      if (a === 'espiar') espiar(r);
      if (a === 'apresentar') apresentar();
      if (a === 'teleprompter') teleprompter();
      if (a === 'fixar') fixarRoteiro(r);
      if (a === 'excluir') excluirRoteiro(r.id);
    });

    /* 4.48.0: título — Enter vai para a primeira cena (o título não quebra linha) */
    const tit = cx.querySelector('.ed2-titulo');
    if (tit) tit.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const t1 = cx.querySelector('#lista-cenas [data-c-campo="texto"]');
      if (t1) t1.focus(); else tit.blur();
    });
    /* painel Detalhes */
    const detBt = cx.querySelector('#ed2-det-bt'), det = cx.querySelector('#ed2-det');
    if (detBt && det) detBt.onclick = () => {
      detalhesAbertos = det.hidden;
      det.hidden = !detalhesAbertos;
      detBt.classList.toggle('on', detalhesAbertos);
      detBt.setAttribute('aria-expanded', String(detalhesAbertos));
      if (detalhesAbertos) det.querySelectorAll('textarea.cresce').forEach(B7.UI.autoAltura);
    };
    /* barra de baixo */
    cx.querySelectorAll('[data-ed2]').forEach(b => b.onclick = () => {
      const a = b.dataset.ed2;
      if (a === 'cena') return novaCena(r.id, (E.cenas[r.id] || []).length);
      if (a === 'enviar') return enviarParaAprovacao();
      if (a === 'previa') { const ab = document.querySelector('#tela-editor .abas [data-aba="previa"]'); if (ab && getComputedStyle(ab).display !== 'none' && ab.offsetParent) ab.click(); else espiar(r); return; }
      if (a === 'ia') {
        if (det && det.hidden) detBt.click();
        const bloco = cx.querySelector('.ia-bloco');
        if (bloco) { bloco.scrollIntoView({ block: 'center', behavior: 'smooth' }); bloco.classList.add('ia-alvo'); setTimeout(() => bloco.classList.remove('ia-alvo'), 1800); }
      }
    });

    /* cenas */
    cx.querySelectorAll('.cena').forEach(el => ligarCena(el, r));
    cx.querySelectorAll('.entre').forEach(e => {
      e.querySelector('button').onclick = () => novaCena(r.id, +e.dataset.antes);
    });
    document.getElementById('bt-add-cena').onclick = () => novaCena(r.id, (E.cenas[r.id] || []).length);
  }

  function ligarCena(el, r) {
    const id = el.dataset.cena;
    const cena = (E.cenas[r.id] || []).find(c => c.id === id);
    if (!cena) return;

    /* recolher/expandir */
    el.querySelector('.cena-topo').onclick = ev => {
      if (ev.target.closest('.menu') || ev.target.closest('.puxa')) return;
      el.classList.toggle('fechada');
      if (el.classList.contains('fechada')) fechadas.add(id); else fechadas.delete(id);
    };

    /* tipo */
    el.querySelectorAll('[data-tipo]').forEach(b => b.onclick = async () => {
      const t = b.dataset.tipo;
      const patch = { tipo: t };
      if (!cena.direcao || Object.values(DIRECAO_PADRAO).includes(cena.direcao)) {
        patch.direcao = DIRECAO_PADRAO[t];
      }
      Object.assign(cena, patch);
      B7.Save.campo('cenas', id, patch);
      renderEscrita(); renderPrevia();
    });

    /* campos */
    el.querySelectorAll('[data-c-campo]').forEach(campo => {
      campo.oninput = () => {
        if (campo.tagName === 'TEXTAREA') B7.UI.autoAltura(campo);
        const nome = campo.dataset.cCampo;
        cena[nome] = campo.value;
        B7.Save.campo('cenas', id, { [nome]: campo.value });
        if (nome === 'direcao') { const d = el.querySelector('.cena-topo .dir'); if (d) d.textContent = campo.value; }
        if (nome === 'sugestao_cenas') {
          const cx = el.querySelector('.sugestao-cx');
          const falta = !campo.value.trim();
          cx.classList.toggle('falta', falta);
          el.classList.toggle('alerta', falta);
          cx.querySelector('.rot').textContent = 'IMAGENS DA NARRAÇÃO' + (falta ? ' · OBRIGATÓRIO' : '');
        }
        renderPrevia();
      };
    });

    /* menu da cena */
    el.querySelectorAll('[data-c-acao]').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const a = b.dataset.cAcao;
      if (a === 'duplicar') duplicarCena(r.id, id);
      if (a === 'cima') moverCena(r.id, id, -1);
      if (a === 'baixo') moverCena(r.id, id, 1);
      if (a === 'excluir') excluirCena(r.id, id);
    });

    /* arrastar — o card inteiro tem draggable, mas isso sequestra o gesto
       de selecionar texto dentro do textarea/input (o navegador entende
       "clicou e arrastou" como início de um drag nativo, mesmo dentro de
       um campo de texto). Por isso o draggable só fica ligado quando o
       mousedown NÃO começou dentro de um campo — clicar no texto pra
       selecionar continua sendo seleção; arrastar pela alça (⠿) ou pelo
       resto do card continua reordenando normalmente. */
    el.addEventListener('mousedown', ev => {
      el.draggable = !ev.target.closest('input, textarea, select, [contenteditable], [data-ia]');
    });

    /* assistente de IA: a sugestão só entra no campo quando a pessoa
       aplica, e entra pelo oninput acima, como texto digitado */
    if (B7.IARoteiro) B7.IARoteiro.ligar(el, cena);
    el.ondragstart = ev => { ev.dataTransfer.setData('text/plain', id); el.classList.add('arrastando'); };
    el.ondragend = () => {
      el.classList.remove('arrastando');
      document.querySelectorAll('.cena').forEach(c => c.classList.remove('alvo-drop'));
    };
    el.ondragover = ev => { ev.preventDefault(); el.classList.add('alvo-drop'); };
    el.ondragleave = () => el.classList.remove('alvo-drop');
    el.ondrop = ev => {
      ev.preventDefault();
      el.classList.remove('alvo-drop');
      const arrastado = ev.dataTransfer.getData('text/plain');
      if (arrastado && arrastado !== id) soltarCena(r.id, arrastado, id);
    };
  }

  /* ==================================================== cenas */
  async function novaCena(roteiroId, posicao) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId] || (E.cenas[roteiroId] = []);
    try {
      const c = await B7.Save.acao(() => B7.DB.criarCena({
        script_id: roteiroId, position: posicao,
        tipo: 'Narrativa', direcao: DIRECAO_PADRAO['Narrativa'],
        texto: '', sugestao_cenas: '', funcao: ''
      }), 'Cena adicionada');
      lista.splice(posicao, 0, c);
      await persistirOrdemCenas(roteiroId);
      renderEscrita(); renderPrevia();
      const el = document.querySelector('[data-cena="' + c.id + '"] [data-c-campo="texto"]');
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    } catch (e) {}
  }

  async function duplicarCena(roteiroId, id) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId];
    const i = lista.findIndex(c => c.id === id);
    const o = lista[i];
    try {
      const c = await B7.Save.acao(() => B7.DB.criarCena({
        script_id: roteiroId, position: i + 1, tipo: o.tipo, direcao: o.direcao,
        funcao: o.funcao, texto: o.texto, sugestao_cenas: o.sugestao_cenas
      }), 'Cena duplicada');
      lista.splice(i + 1, 0, c);
      await persistirOrdemCenas(roteiroId);
      renderEscrita(); renderPrevia();
    } catch (e) {}
  }

  async function moverCena(roteiroId, id, dir) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId];
    const i = lista.findIndex(c => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    renderEscrita(); renderPrevia();
    await persistirOrdemCenas(roteiroId);
  }

  async function soltarCena(roteiroId, idArrastado, idAlvo) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId];
    const de = lista.findIndex(c => c.id === idArrastado);
    const para = lista.findIndex(c => c.id === idAlvo);
    if (de < 0 || para < 0) return;
    const [item] = lista.splice(de, 1);
    lista.splice(para, 0, item);
    renderEscrita(); renderPrevia();
    await persistirOrdemCenas(roteiroId);
  }

  async function persistirOrdemCenas(roteiroId) {
    const lista = E.cenas[roteiroId] || [];
    lista.forEach((c, i) => c.position = i);
    try {
      await B7.Save.acao(() => B7.DB.reordenarCenas(lista.map(c => ({ id: c.id, position: c.position }))));
    } catch (e) {}
  }

  function excluirCena(roteiroId, id) {
    if (soLeitura()) return;
    const lista = E.cenas[roteiroId];
    const i = lista.findIndex(c => c.id === id);
    if (i < 0) return;
    const registro = { ...lista[i] };
    lista.splice(i, 1);
    renderEscrita(); renderPrevia();
    B7.Save.acao(() => B7.DB.excluirCena(id)).then(() => {
      persistirOrdemCenas(roteiroId);
      B7.UI.toast('Cena excluída', {
        acao: 'Desfazer',
        aoClicar: async () => {
          try {
            await B7.Save.acao(() => B7.DB.restaurar('cenas', registro), 'Cena restaurada');
            lista.splice(Math.min(i, lista.length), 0, registro);
            await persistirOrdemCenas(roteiroId);
            renderEscrita(); renderPrevia();
          } catch (e) {}
        }
      });
    }).catch(() => {});
  }

  /* ==================================================== prévia
     Ajuste automático de escala (B7.Folha.ajustar) mede scrollHeight/
     clientHeight da própria folha — e um elemento dentro de um
     ancestral com display:none não tem layout nenhum, então as duas
     medidas voltam 0 e "estourou" nunca é true. No celular a coluna
     .previa fica display:none enquanto a aba ativa é "Editor" (ver
     styles/editor.css, @media max-width:1000px) — era exatamente aí
     que o Automático travava em 100%: o cálculo rodava cedo demais,
     contra uma folha invisível, e nunca mais era refeito. */
  function folhaMedivel(folha) {
    return !!folha && folha.offsetParent !== null;
  }

  function medirEAjustar(folha, r) {
    if (!folhaMedivel(folha)) return; /* a folha sumiu de novo (trocou de aba/roteiro) antes do frame chegar */
    const novo = B7.Folha.ajustar(folha);
    if (novo !== +r.escala) {
      r.escala = novo;
      if (!soLeitura()) B7.Save.campo('roteiros', r.id, { escala: novo });
      const pc = document.querySelector('#escrita .escala .pc');
      if (pc) pc.textContent = Math.round(novo * 100) + '%';
    }
    B7.Folha.marcarOverflow(folha);
  }

  /* Espera as fontes carregarem (fonte ainda não trocada = a medida sai
     errada) e um frame de layout depois disso (o reflow de um
     display:none → flex/block não está garantido pronto no mesmo tick
     em todo Android/Chrome) antes de medir de verdade. */
  function agendarMedicao(folha, r) {
    const medir = () => requestAnimationFrame(() => medirEAjustar(folha, r));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    else medir();
  }

  function renderPrevia() {
    const r = E.roteiros.find(x => x.id === E.atual);
    const cx = document.getElementById('folhas');
    if (!r) { cx.innerHTML = ''; return; }
    const idx = E.roteiros.findIndex(x => x.id === r.id);

    cx.innerHTML = B7.Folha.folhaHTML({
      cliente: E.gravacao.cliente_nome, semCliente: !!E.gravacao.geral,
      clienteLogo: E.gravacao.cliente_logo_url || null,
      gravacao: E.gravacao.nome,
      dataGravacao: E.gravacao.data_gravacao ? B7.UI.dataBR(E.gravacao.data_gravacao) : '',
      roteiro: r, cenas: E.cenas[r.id] || [], indice: idx, total: E.roteiros.length
    });

    const folha = cx.querySelector('.folha');
    if (r.escala_automatica) {
      if (folhaMedivel(folha)) {
        agendarMedicao(folha, r);
      } else {
        /* não dá pra medir agora (aba Editor no celular, ou a coluna
           ainda não tem largura) — usa a última escala conhecida até
           reavaliarEscalaAtual() rodar quando a prévia ficar visível. */
        folha.style.setProperty('--fs', r.escala || 1);
      }
    } else {
      folha.style.setProperty('--fs', r.escala || 1);
    }
    B7.Folha.marcarOverflow(folha);
    aplicarZoom();
  }

  /* Chamado quando a prévia passa a ficar visível de verdade: ao trocar
     pra aba "Prévia" no celular, ou quando a tela cresce o bastante pra
     as 3 colunas caberem lado a lado de novo. Se a escala é automática
     e a última medição rodou com a folha escondida, ela não vale nada —
     recalcula com a folha já visível. Não faz nada se a escala for
     manual (100%, A−/A+): aí o usuário decidiu o valor, não o sistema. */
  function reavaliarEscalaAtual() {
    const r = E.roteiros.find(x => x.id === E.atual);
    if (!r || !r.escala_automatica) return;
    const folha = document.querySelector('#folhas .folha');
    if (!folhaMedivel(folha)) return;
    agendarMedicao(folha, r);
  }

  function aplicarZoom() {
    const previa = document.getElementById('previa');
    const folhas = document.getElementById('folhas');
    const disp = previa.clientWidth - 60;
    const z = zoomManual !== null ? zoomManual : Math.min(1, Math.max(.3, disp / 794));
    folhas.style.setProperty('--z', z);
    document.getElementById('palco').style.height = (folhas.offsetHeight * z) + 'px';
    document.getElementById('zoom-valor').textContent = Math.round(z * 100) + '%';
  }
  function zoom(delta) {
    const atual = parseFloat(getComputedStyle(document.getElementById('folhas')).getPropertyValue('--z')) || .62;
    zoomManual = Math.min(1.6, Math.max(.25, +(atual + delta).toFixed(2)));
    B7.pref.gravar('zoom', zoomManual);
    aplicarZoom();
  }
  function zoomAjustar() { zoomManual = null; B7.pref.gravar('zoom', null); aplicarZoom(); }

  /* contexto único para impressão, download, quick view e apresentação */
  function contexto() {
    return {
      cliente: E.gravacao.cliente_nome, semCliente: !!E.gravacao.geral,
      clienteLogo: E.gravacao.cliente_logo_url || null,
      clienteId: E.gravacao.client_id,
      gravacao: E.gravacao.nome,
      gravacaoId: E.gravacao.id,
      dataGravacao: E.gravacao.data_gravacao ? B7.UI.dataBR(E.gravacao.data_gravacao) : '',
      roteiros: E.roteiros,
      cenasPorRoteiro: E.cenas
    };
  }

  function baixar(roteiroId) { B7.Export.abrirCentral(contexto(), roteiroId); }
  function espiar(roteiro) { B7.QuickView.abrir(contexto(), roteiro || E.roteiros.find(r => r.id === E.atual)); }
  function apresentar() {
    B7.Apresentar.abrir(contexto(), Math.max(0, E.roteiros.findIndex(r => r.id === E.atual)));
  }
  /* o teleprompter lê o que está no editor agora — o roteiro é a fonte, nada é copiado */
  function teleprompter() {
    B7.Teleprompter.abrirDoEditor(contexto(), Math.max(0, E.roteiros.findIndex(r => r.id === E.atual)));
  }

  /* =================================================== impressão */
  function imprimir() {
    B7.Impressao.abrirSelecao(contexto()); }

  /* ============================================== dados da gravação */
  function editarGravacao() {
    if (soLeitura() || E.gravacao.banco) return;
    const g = E.gravacao;
    const m = B7.UI.modal('<h3>Dados da gravação</h3>' +
      '<div class="mb"><label class="rot">NOME DA GRAVAÇÃO</label><input class="campo" id="dd-nome" data-foco value="' + esc(g.nome) + '"></div>' +
      /* data e status moram na GRAVAÇÃO (Gravações 2.0): marcar/remarcar
         guarda o histórico — por isso não se edita a data por aqui */
      '<div class="mb"><label class="rot">DATA</label><div class="vd-so-leitura">' +
        esc(g.data_gravacao ? B7.UI.dataBR(g.data_gravacao) : 'Sem data marcada') +
        ' · <a href="#/gravacao/' + esc(g.id) + '">marcar ou remarcar na gravação</a></div></div>' +
      '<div class="mb"><label class="rot">LOCAL</label><input class="campo" id="dd-local" value="' + esc(g.local || '') + '"></div>' +
      '<div class="linha mb"><div><label class="rot">RESPONSÁVEL</label>' +
        '<input class="campo" id="dd-resp" value="' + esc(g.responsavel || '') + '"></div>' +
        '<div><label class="rot">VIDEOMAKER</label><input class="campo" id="dd-video" value="' + esc(g.videomaker || '') + '"></div></div>' +
      '<div class="mb"><label class="rot">OBSERVAÇÕES</label>' +
        '<textarea class="campo" id="dd-obs" rows="2">' + esc(g.observacoes || '') + '</textarea></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>');

    m.querySelector('[data-ok]').onclick = async () => {
      const patch = {
        nome: m.querySelector('#dd-nome').value.trim() || g.nome,
        local: m.querySelector('#dd-local').value,
        responsavel: m.querySelector('#dd-resp').value,
        videomaker: m.querySelector('#dd-video').value,
        observacoes: m.querySelector('#dd-obs').value
      };
      Object.assign(E.gravacao, patch);
      m.fechar(); cabecalho(); renderPrevia();
      try { await B7.Save.acao(() => B7.DB.atualizarGravacao(g.id, patch), 'Gravação atualizada'); } catch (e) {}
    };
  }

  /* ==================================================== modo foco */
  function modoFoco() {
    const ligado = document.body.classList.toggle('foco');
    B7.pref.gravar('foco', ligado);
    aplicarZoom();
    B7.UI.toast(ligado ? 'Modo foco ligado' : 'Modo foco desligado');
  }

  window.addEventListener('resize', () => {
    if (document.getElementById('tela-editor').classList.contains('ativa')) {
      aplicarZoom();
      reavaliarEscalaAtual(); /* orientação/breakpoint pode ter tornado a folha (i)medível */
    }
  });

  return { abrir, novoRoteiro, duplicarRoteiro, excluirRoteiro, imprimir, editarGravacao,
           enviarParaAprovacao,
           baixar, espiar, apresentar, contexto,
           menuStatus, modoFoco, zoom, zoomAjustar, aplicarZoom, reavaliarEscalaAtual,
           get estado() { return E; } };
})();
