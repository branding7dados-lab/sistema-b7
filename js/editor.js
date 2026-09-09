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
  const DIRECAO_PADRAO = { 'Gancho': 'DIRETO PRA CÂMERA', 'Narrativa': 'DIRETO PRA CÂMERA',
                           'Narração': 'VOZ EM OFF', 'CTA': 'DIRETO PRA CÂMERA' };

  let E = { gravacao: null, roteiros: [], cenas: {}, atual: null, aprovacoes: {} };
  let zoomManual = null;
  let fechadas = new Set();     // cenas recolhidas (só visual)

  /* =================================================== carregar */
  async function abrir(gravacaoId, roteiroAlvo) {
    document.getElementById('escrita').innerHTML =
      '<div class="b7-load"><div class="simbolo"></div><div class="txt">Carregando roteiros…</div></div>';
    document.getElementById('folhas').innerHTML = '';

    try {
      const gravacao = await B7.DB.gravacao(gravacaoId);
      const roteiros = await B7.DB.listarRoteiros(gravacaoId);
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
      if (!E.roteiros.length) await novoRoteiro(true);
      else { renderTrilho(); renderEscrita(); renderPrevia(); }
      B7.Save.atualizar();
    } catch (e) {
      console.error(e);
      B7.UI.toast('Não consegui carregar a gravação: ' + (e.message || ''), { tipo: 'erro' });
      location.hash = '#/';
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
    bt.innerHTML = B7.UI.chipStatus(g.status);
  }

  /* =================================================================
     ENVIAR PARA APROVAÇÃO

     Congela um retrato do roteiro e libera essa versão ao cliente. É uma
     ação explícita: o autosave grava o tempo todo e nunca envia nada.
     ================================================================= */
  async function enviarParaAprovacao() {
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
    const m = B7.UI.modal('<h3>Status da gravação</h3><div class="sub">Aparece no dashboard e na lista do cliente.</div>' +
      ['Rascunho', 'Pronto para gravar', 'Gravado'].map(s =>
        '<button class="b" style="width:100%;justify-content:flex-start;margin-bottom:8px" data-s="' + s + '">' +
        B7.UI.chipStatus(s) + '</button>').join('') +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
      const s = b.dataset.s;
      E.gravacao.status = s;

      /* A situação operacional acompanha o status escolhido aqui. Sem isto,
         marcar "Gravado" no editor não chegava à Central de Produção: a
         gravação continuava contada como "faltam gravar". */
      const patch = { status: s };
      if (s === 'Gravado') {
        patch.situacao = 'Gravada';
        if (!E.gravacao.gravada_em) patch.gravada_em = new Date().toISOString();
      } else if (E.gravacao.situacao === 'Gravada') {
        /* voltou atrás: a gravação deixa de ser um fato confirmado */
        patch.situacao = E.gravacao.data_gravacao ? 'Agendada' : 'Pendente';
        patch.gravada_em = null;
      }
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
      '<button class="chip' + (r.id === E.atual ? ' on' : '') + '" draggable="true" data-id="' + esc(r.id) + '">' +
      String(i + 1).padStart(2, '0') + '</button>').join('') +
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
  }

  function selecionar(id) {
    if (id === E.atual) return;
    E.atual = id;
    B7.pref.gravar('ultimo_roteiro_' + E.gravacao.id, id);
    renderTrilho(); renderEscrita(); renderPrevia();
    document.getElementById('escrita').scrollTop = 0;
  }

  async function moverRoteiro(idArrastado, idAlvo) {
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
    try {
      const r = await B7.Save.acao(() => B7.DB.criarRoteiro({
        recording_session_id: E.gravacao.id,
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

  function excluirRoteiro(id) {
    const idx = E.roteiros.findIndex(r => r.id === id);
    if (idx < 0) return;
    const registro = { ...E.roteiros[idx] };

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
      cx.innerHTML = '<div class="vazio"><b>Nenhum roteiro nesta gravação</b>' +
        '<p>Crie o primeiro roteiro para começar.</p>' +
        '<button class="b pri" onclick="B7.Editor.novoRoteiro()">+ Novo roteiro</button></div>';
      return;
    }
    const idx = E.roteiros.findIndex(x => x.id === r.id);
    const cenas = E.cenas[r.id] || [];

    cx.innerHTML =
      '<div class="bloco"><div class="bloco-topo">' +
        '<div class="rn">ROTEIRO ' + String(idx + 1).padStart(2, '0') + '</div>' +
        '<div class="escala"><button data-escala="-1" title="Diminuir fonte">A−</button>' +
        '<div class="pc">' + Math.round((r.escala || 1) * 100) + '%</div>' +
        '<button data-escala="1" title="Aumentar fonte">A+</button></div>' +
        '<button class="auto-bt' + (r.escala_automatica ? ' on' : '') + '" data-auto title="Ajusta a fonte sozinho">auto</button>' +
        '<div class="menu"><button class="ico">⋯</button><div class="lista">' +
          '<button data-acao="enviar-aprovacao">Enviar para aprovação</button><hr>' +
          '<button data-acao="baixar">Baixar roteiro</button>' +
          '<button data-acao="espiar">Visualização rápida</button>' +
          '<button data-acao="apresentar">Apresentar roteiros</button><hr>' +
          '<button data-acao="duplicar">Duplicar roteiro</button>' +
          '<button data-acao="novo">Novo roteiro</button>' +
          '<button data-acao="fixar">' + (r.is_pinned ? 'Desafixar' : 'Fixar roteiro') + '</button><hr>' +
          '<button class="perigo" data-acao="excluir">Excluir roteiro</button>' +
        '</div></div>' +
      '</div><div class="bloco-corpo">' +
        '<div class="mb" id="ap-status-roteiro">' + (B7.Aprovacoes ? B7.Aprovacoes.blocoStatus(E.aprovacoes[r.id], { botaoEnviar: true }) : '') + '</div>' +
        '<div class="mb"><label class="rot">TÍTULO</label>' +
        '<input class="campo" data-campo="titulo" placeholder="Título do roteiro" value="' + esc(r.titulo) + '"></div>' +
        '<div class="mb"><label class="rot">OBJETIVO DO ROTEIRO</label>' +
        '<textarea class="campo cresce" data-campo="objetivo" rows="2" placeholder="O que esse vídeo precisa gerar">' + esc(r.objetivo) + '</textarea></div>' +
        '<div class="mb"><label class="rot">ESTÁGIO DO ROTEIRO</label>' +
        '<div class="opcoes" id="revisao">' + B7.UI.REVISAO.map(v =>
          '<button data-rev="' + v + '"' + ((r.status || 'Em criação') === v ? ' class="on"' : '') + '>' +
          v + '</button>').join('') + '</div></div>' +
        '<div class="mb"><label class="rot">OBSERVAÇÃO DE GRAVAÇÃO</label>' +
        '<textarea class="campo cresce" data-campo="observacao_gravacao" rows="2" placeholder="Ex: plano fechado, mais energia, pausa antes do CTA">' + esc(r.observacao_gravacao) + '</textarea>' +
        '<div class="ajuda">Não faz parte da fala. Sai na folha como nota de produção.</div></div>' +
        '<div class="nota-b7"><label class="rot">NOTA INTERNA B7</label>' +
        '<textarea class="campo cresce" data-campo="nota_interna" rows="2" ' +
          'placeholder="Só a equipe vê. Ex: cliente pediu para evitar a palavra promoção.">' +
          esc(r.nota_interna || '') + '</textarea>' +
        '<div class="ajuda">Nunca entra no roteiro, na folha A4, no PDF nem no PNG.</div></div>' +
      '</div></div>' +

      '<div class="bloco"><div class="bloco-topo"><div class="rn">CENAS</div>' +
        '<span style="font-size:12px;color:var(--grey)">' + cenas.length + '</span></div>' +
        '<div class="bloco-corpo" id="lista-cenas">' +
          cenas.map((c, i) => cenaHTML(c, i)).join('') +
          '<button class="add-largo" id="bt-add-cena">+ NOVA CENA</button>' +
        '</div></div>';

    ligarEscrita(r);
    B7.UI.ligarMenus(cx);
  }

  function cenaHTML(c, i) {
    const fechada = fechadas.has(c.id);
    const falta = c.tipo === 'Narração' && !String(c.sugestao_cenas || '').trim();
    const tipos = TIPOS.map(t =>
      '<button data-tipo="' + t + '"' + (c.tipo === t ? ' class="on"' : '') + '>' + t + '</button>').join('');

    return '<div class="entre" data-antes="' + i + '"><button>+ ADICIONAR CENA</button></div>' +
      '<div class="cena' + (fechada ? ' fechada' : '') + (falta ? ' alerta' : '') + '" data-cena="' + esc(c.id) + '" draggable="true">' +
      '<div class="cena-topo">' +
        '<span class="puxa" title="Arraste para reordenar">⠿</span>' +
        '<div class="rot"><span class="pt t-' + esc(c.tipo) + '"></span>CENA ' + (i + 1) +
          '<span class="dir">' + esc(c.direcao || '') + '</span></div>' +
        '<div class="menu"><button class="ico" data-menu>⋯</button><div class="lista">' +
          '<button data-c-acao="duplicar">Duplicar cena</button>' +
          '<button data-c-acao="cima">Mover para cima</button>' +
          '<button data-c-acao="baixo">Mover para baixo</button><hr>' +
          '<button class="perigo" data-c-acao="excluir">Excluir cena</button>' +
        '</div></div>' +
        '<span class="abre">▾</span>' +
      '</div>' +
      '<div class="cena-corpo">' +
        '<div class="tipos">' + tipos + '</div>' +
        '<input class="campo" data-c-campo="direcao" placeholder="DIREÇÃO" ' +
          'style="padding:8px 12px;font-size:12px;letter-spacing:.06em;margin-bottom:10px" value="' + esc(c.direcao) + '">' +
        '<textarea class="campo cresce" data-c-campo="texto" rows="3" ' +
          'placeholder="Texto da cena — Enter cria um novo parágrafo">' + esc(c.texto) + '</textarea>' +
        (c.tipo === 'Narração' ?
          '<div class="sugestao-cx' + (falta ? ' falta' : '') + '">' +
          '<label class="rot">SUGESTÃO DE CENAS' + (falta ? ' · OBRIGATÓRIO' : '') + '</label>' +
          '<textarea class="campo cresce" data-c-campo="sugestao_cenas" rows="2" ' +
            'placeholder="Uma imagem por linha">' + esc(c.sugestao_cenas) + '</textarea>' +
          '<div class="ajuda">Cada linha vira um item da lista na folha.</div></div>' : '') +
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
          cliente: E.gravacao.client_id, gravacao: E.gravacao.id,
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
      if (a === 'novo') novoRoteiro();
      if (a === 'baixar') baixar(r.id);
      if (a === 'espiar') espiar(r);
      if (a === 'apresentar') apresentar();
      if (a === 'fixar') fixarRoteiro(r);
      if (a === 'excluir') excluirRoteiro(r.id);
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
        if (nome === 'direcao') el.querySelector('.cena-topo .dir').textContent = campo.value;
        if (nome === 'sugestao_cenas') {
          const cx = el.querySelector('.sugestao-cx');
          const falta = !campo.value.trim();
          cx.classList.toggle('falta', falta);
          el.classList.toggle('alerta', falta);
          cx.querySelector('.rot').textContent = 'SUGESTÃO DE CENAS' + (falta ? ' · OBRIGATÓRIO' : '');
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

    /* arrastar */
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
    const lista = E.cenas[roteiroId];
    const i = lista.findIndex(c => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    renderEscrita(); renderPrevia();
    await persistirOrdemCenas(roteiroId);
  }

  async function soltarCena(roteiroId, idArrastado, idAlvo) {
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

  /* ==================================================== prévia */
  function renderPrevia() {
    const r = E.roteiros.find(x => x.id === E.atual);
    const cx = document.getElementById('folhas');
    if (!r) { cx.innerHTML = ''; return; }
    const idx = E.roteiros.findIndex(x => x.id === r.id);

    cx.innerHTML = B7.Folha.folhaHTML({
      cliente: E.gravacao.cliente_nome,
      clienteLogo: E.gravacao.cliente_logo_url || null,
      gravacao: E.gravacao.nome,
      dataGravacao: E.gravacao.data_gravacao ? B7.UI.dataBR(E.gravacao.data_gravacao) : '',
      roteiro: r, cenas: E.cenas[r.id] || [], indice: idx, total: E.roteiros.length
    });

    const folha = cx.querySelector('.folha');
    if (r.escala_automatica) {
      const novo = B7.Folha.ajustar(folha);
      if (novo !== +r.escala) {
        r.escala = novo;
        B7.Save.campo('roteiros', r.id, { escala: novo });
        const pc = document.querySelector('#escrita .escala .pc');
        if (pc) pc.textContent = Math.round(novo * 100) + '%';
      }
    } else {
      folha.style.setProperty('--fs', r.escala || 1);
    }
    B7.Folha.marcarOverflow(folha);
    aplicarZoom();
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
      cliente: E.gravacao.cliente_nome,
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

  /* =================================================== impressão */
  function imprimir() {
    B7.Impressao.abrirSelecao(contexto()); }

  /* ============================================== dados da gravação */
  function editarGravacao() {
    const g = E.gravacao;
    const m = B7.UI.modal('<h3>Dados da gravação</h3>' +
      '<div class="mb"><label class="rot">NOME DA GRAVAÇÃO</label><input class="campo" id="dd-nome" data-foco value="' + esc(g.nome) + '"></div>' +
      '<div class="linha mb"><div><label class="rot">DATA (OPCIONAL)</label>' +
        '<input class="campo" id="dd-data" type="date" value="' + (g.data_gravacao || '') + '"></div>' +
        '<div><label class="rot">LOCAL</label><input class="campo" id="dd-local" value="' + esc(g.local || '') + '"></div></div>' +
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
        data_gravacao: m.querySelector('#dd-data').value || null,
        local: m.querySelector('#dd-local').value,
        responsavel: m.querySelector('#dd-resp').value,
        videomaker: m.querySelector('#dd-video').value,
        observacoes: m.querySelector('#dd-obs').value
      };
      /* a data manda na situação, exceto quando já foi confirmada como
         gravada: aí quem decide é a equipe, não o calendário */
      if (E.gravacao.situacao !== 'Gravada' && E.gravacao.situacao !== 'Cancelada') {
        patch.situacao = patch.data_gravacao ? 'Agendada' : 'Pendente';
      }
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
    if (document.getElementById('tela-editor').classList.contains('ativa')) aplicarZoom();
  });

  return { abrir, novoRoteiro, duplicarRoteiro, excluirRoteiro, imprimir, editarGravacao,
           enviarParaAprovacao,
           baixar, espiar, apresentar, contexto,
           menuStatus, modoFoco, zoom, zoomAjustar, aplicarZoom,
           get estado() { return E; } };
})();
