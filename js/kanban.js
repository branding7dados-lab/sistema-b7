/* =====================================================================
   KANBAN DE PRODUÇÃO — interno da equipe

   O card guarda o vínculo com o material, nunca uma cópia dele. Abrir a
   demanda de um roteiro leva ao editor do roteiro; o texto continua
   morando lá.

   Arrastar é a forma rápida, não a única: cada card tem um menu para
   mover por teclado ou toque, porque arrastar em celular e com teclado é
   ruim ou impossível.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Kanban = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  const COLUNAS = [
    ['a_fazer',            'A fazer',           'o que ainda não começou'],
    ['producao',           'Em produção',       'sendo feito agora'],
    ['revisao',            'Revisão interna',   'a equipe confere antes de enviar'],
    ['aguardando_cliente', 'Aguardando cliente','enviado, esperando decisão'],
    ['ajustes',            'Ajustes',           'o cliente pediu mudanças'],
    ['pronto',             'Pronto',            'aprovado, falta publicar'],
    ['concluida',          'Concluída',         'encerrado']
  ];
  const nomeColuna = c => (COLUNAS.find(x => x[0] === c) || [, c])[1];

  const TIPOS = [
    ['producao', 'Produção'], ['gravacao', 'Gravação'], ['reuniao', 'Reunião'],
    ['entrega', 'Entrega'], ['ajuste', 'Ajuste'], ['outro', 'Outro']
  ];

  let dados = [], clientes = [], equipe = [];
  let F = { cliente: '', responsavel: '', tipo: '', busca: '', vista: 'quadro' };

  /* =================================================================
     TELA
     ================================================================= */
  async function abrir() {
    B7.Dashboard.marcarNav('#/kanban');
    B7.Rota.titulo(['Produção']);
    painel().innerHTML = '<div class="conteudo"><div class="b7-load"><div class="simbolo"></div>' +
      '<div class="txt">Carregando demandas…</div><div class="barra-load"><i></i></div></div></div>';

    try {
      [dados, clientes, equipe] = await Promise.all([
        B7.DB.listarDemandas(),
        B7.DB.listarClientes().catch(() => []),
        B7.DB.listarEquipe().catch(() => [])
      ]);
    } catch (e) {
      return painel().innerHTML = '<div class="conteudo entra">' +
        '<div class="estado-b7"><b>Não foi possível carregar o Kanban.</b>' +
        '<p>' + esc(e.message || '') + '</p>' +
        '<p>Se o sistema acabou de ser atualizado, rode o migration_kanban.sql no Supabase.</p>' +
        '</div></div>';
    }
    desenhar();
  }

  function desenhar() {
    const vis = filtrar(dados);
    painel().innerHTML = '<div class="conteudo entra kanban-tela">' +
      '<div class="cab-conteudo"><div><h1>Produção</h1>' +
      '<p>As demandas da equipe. O cliente não vê esta área.</p></div>' +
      '<button class="b pri" id="kb-nova">+ Nova demanda</button></div>' +

      barraFiltros(vis.length) +

      (F.vista === 'lista' ? lista(vis) : quadro(vis)) +
    '</div>';
    ligar();
  }

  function barraFiltros(total) {
    const opc = (valor, atual, itens) =>
      '<select class="campo fina" data-filtro="' + valor + '">' +
      itens.map(([v, r]) =>
        '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' +
        esc(r) + '</option>').join('') + '</select>';

    return '<div class="kb-barra">' +
      '<input class="campo fina kb-busca" id="kb-busca" placeholder="Buscar demanda…" ' +
        'value="' + esc(F.busca) + '">' +
      opc('cliente', F.cliente, [['', 'Todos os clientes']]
        .concat(clientes.map(c => [c.id, c.nome]))) +
      opc('responsavel', F.responsavel, [['', 'Qualquer responsável'], ['sem', 'Sem responsável']]
        .concat(equipe.map(p => [p.id, p.nome]))) +
      opc('tipo', F.tipo, [['', 'Todos os tipos']].concat(TIPOS)) +
      '<div class="kb-espaco"></div>' +
      '<span class="kb-total">' + total + (total === 1 ? ' demanda' : ' demandas') + '</span>' +
      '<div class="seg-vista">' +
        '<button class="' + (F.vista === 'quadro' ? 'on' : '') + '" data-vista="quadro">Quadro</button>' +
        '<button class="' + (F.vista === 'lista' ? 'on' : '') + '" data-vista="lista">Lista</button>' +
      '</div>' +
    '</div>';
  }

  function filtrar(lista) {
    const t = F.busca.trim().toLowerCase();
    return lista.filter(d => {
      if (d.arquivada_em) return false;
      if (F.cliente && d.client_id !== F.cliente) return false;
      if (F.responsavel === 'sem' && d.responsavel_id) return false;
      if (F.responsavel && F.responsavel !== 'sem' && d.responsavel_id !== F.responsavel) return false;
      if (F.tipo && d.tipo !== F.tipo) return false;
      if (t && !(d.titulo || '').toLowerCase().includes(t) &&
               !(d.cliente_nome || '').toLowerCase().includes(t)) return false;
      return true;
    });
  }

  /* =================================================================
     QUADRO
     ================================================================= */
  function quadro(vis) {
    return '<div class="kb-quadro">' + COLUNAS.map(([id, rotulo, ajuda]) => {
      const itens = vis.filter(d => d.coluna === id)
        .sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
      return '<section class="kb-col" data-coluna="' + id + '">' +
        '<header><div><b>' + esc(rotulo) + '</b><small>' + esc(ajuda) + '</small></div>' +
        '<span class="kb-cont">' + itens.length + '</span></header>' +
        '<div class="kb-lista" data-drop="' + id + '">' +
          itens.map(cartao).join('') +
          (itens.length ? '' : '<div class="kb-vazio">nada aqui</div>') +
        '</div>' +
      '</section>';
    }).join('') + '</div>';
  }

  function cartao(d) {
    const atrasada = d.prazo && !d.concluida_em &&
      new Date(d.prazo + 'T23:59:59') < new Date();
    return '<article class="kb-card' + (d.prioridade === 'alta' ? ' alta' : '') + '" ' +
      'draggable="true" data-demanda="' + esc(d.id) + '" tabindex="0">' +
      '<div class="kb-card-topo">' +
        '<span class="kb-tipo ' + esc(d.tipo || 'producao') + '">' +
          esc((TIPOS.find(t => t[0] === d.tipo) || [, 'Produção'])[1]) + '</span>' +
        '<button class="kb-mover" data-mover="' + esc(d.id) + '" ' +
          'aria-label="Mover demanda">⋮</button>' +
      '</div>' +
      '<h4>' + esc(d.titulo) + '</h4>' +
      (d.cliente_nome ? '<div class="kb-cli">' + esc(d.cliente_nome) + '</div>' : '') +
      '<div class="kb-pe">' +
        (d.responsavel_nome
          ? '<span class="kb-resp" title="' + esc(d.responsavel_nome) + '">' +
            esc(B7.UI.iniciais(d.responsavel_nome)) + '</span>' : '') +
        (d.prazo ? '<span class="kb-prazo' + (atrasada ? ' atrasada' : '') + '">' +
          esc(B7.UI.dataBR(d.prazo)) + '</span>' : '') +
        (d.comentarios_abertos ? '<span class="kb-coment">' + d.comentarios_abertos + '</span>' : '') +
        (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa'
          ? '<span class="kb-vinc" title="vinculada a ' + esc(d.tipo_vinculo) + '">⧉</span>' : '') +
      '</div>' +
    '</article>';
  }

  /* =================================================================
     LISTA — mesma fonte de dados, outra leitura
     ================================================================= */
  function lista(vis) {
    if (!vis.length) {
      return '<div class="estado-b7"><b>Nenhuma demanda com esses filtros.</b>' +
             '<p>Ajuste a busca ou crie a primeira demanda.</p></div>';
    }
    return '<div class="kb-tabela">' +
      '<div class="kb-th"><span>Demanda</span><span>Cliente</span><span>Situação</span>' +
      '<span>Responsável</span><span>Prazo</span></div>' +
      vis.sort((a, b) => (a.coluna || '').localeCompare(b.coluna || '') ||
                         (a.posicao || 0) - (b.posicao || 0))
         .map(d =>
        '<div class="kb-tr" data-demanda="' + esc(d.id) + '" tabindex="0">' +
          '<span><b>' + esc(d.titulo) + '</b></span>' +
          '<span>' + esc(d.cliente_nome || '—') + '</span>' +
          '<span><i class="kb-chip ' + esc(d.coluna) + '">' + esc(nomeColuna(d.coluna)) + '</i></span>' +
          '<span>' + esc(d.responsavel_nome || '—') + '</span>' +
          '<span>' + (d.prazo ? esc(B7.UI.dataBR(d.prazo)) : '—') + '</span>' +
        '</div>').join('') +
    '</div>';
  }

  /* =================================================================
     INTERAÇÕES
     ================================================================= */
  function ligar() {
    const p = painel();
    p.querySelector('#kb-nova').onclick = () => modalDemanda(null);

    const busca = p.querySelector('#kb-busca');
    if (busca) {
      let t;
      busca.oninput = () => {
        clearTimeout(t);
        t = setTimeout(() => { F.busca = busca.value; desenhar();
          const b = painel().querySelector('#kb-busca');
          if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 260);
      };
    }
    p.querySelectorAll('[data-filtro]').forEach(s => s.onchange = () => {
      F[s.dataset.filtro] = s.value; desenhar();
    });
    p.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; desenhar();
    });

    p.querySelectorAll('[data-demanda]').forEach(el => {
      el.onclick = e => {
        if (e.target.closest('[data-mover]')) return;
        abrirDetalhe(el.dataset.demanda);
      };
      el.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(el.dataset.demanda); }
      };
    });

    /* mover sem arrastar: menu por card, para teclado e celular */
    p.querySelectorAll('[data-mover]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      menuMover(b, b.dataset.mover);
    });

    ligarArrastar(p);
  }

  function menuMover(botao, id) {
    const d = dados.find(x => x.id === id);
    if (!d) return;
    const lista = document.createElement('div');
    lista.className = 'lista solta mostrando kb-menu-mover';
    lista.innerHTML = '<div class="rot">MOVER PARA</div>' +
      COLUNAS.filter(([c]) => c !== d.coluna)
        .map(([c, r]) => '<button data-para="' + c + '">' + esc(r) + '</button>').join('');
    document.body.appendChild(lista);

    const r = botao.getBoundingClientRect();
    const alt = lista.offsetHeight, larg = lista.offsetWidth;
    lista.style.position = 'fixed';
    lista.style.left = Math.max(10, Math.min(r.right - larg, window.innerWidth - larg - 10)) + 'px';
    lista.style.top = (r.bottom + alt + 10 < window.innerHeight
      ? r.bottom + 6 : Math.max(10, r.top - alt - 6)) + 'px';

    const fechar = () => lista.remove();
    lista.querySelectorAll('[data-para]').forEach(b => b.onclick = async () => {
      fechar();
      await mover(id, b.dataset.para, null);
    });
    setTimeout(() => document.addEventListener('click', fechar, { once: true }), 0);
  }

  /* ---------------------------------------------------- arrastar */
  function ligarArrastar(raiz) {
    let arrastando = null;

    raiz.querySelectorAll('.kb-card').forEach(card => {
      card.ondragstart = e => {
        arrastando = card.dataset.demanda;
        card.classList.add('arrastando');
        e.dataTransfer.effectAllowed = 'move';
        /* Firefox exige algum dado para iniciar o arrasto */
        e.dataTransfer.setData('text/plain', card.dataset.demanda);
      };
      card.ondragend = () => {
        card.classList.remove('arrastando');
        raiz.querySelectorAll('.kb-lista').forEach(l => l.classList.remove('sobre'));
        arrastando = null;
      };
    });

    raiz.querySelectorAll('.kb-lista').forEach(zona => {
      zona.ondragover = e => {
        e.preventDefault();
        zona.classList.add('sobre');
        e.dataTransfer.dropEffect = 'move';
      };
      zona.ondragleave = () => zona.classList.remove('sobre');
      zona.ondrop = async e => {
        e.preventDefault();
        zona.classList.remove('sobre');
        const id = arrastando || e.dataTransfer.getData('text/plain');
        if (!id) return;
        /* posição pelo ponto onde soltou, para reordenar dentro da coluna */
        const cards = [...zona.querySelectorAll('.kb-card:not(.arrastando)')];
        const antes = cards.find(c => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        await mover(id, zona.dataset.drop, antes ? antes.dataset.demanda : null);
      };
    });
  }

  /* Calcula a posição entre vizinhos. Números fracionários evitam
     reescrever a coluna inteira a cada movimento. */
  function calcularPosicao(coluna, antesDoId) {
    const naColuna = dados.filter(d => d.coluna === coluna && !d.arquivada_em)
      .sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
    if (!naColuna.length) return 1000;
    if (!antesDoId) return (naColuna[naColuna.length - 1].posicao || 0) + 1000;
    const i = naColuna.findIndex(d => d.id === antesDoId);
    if (i <= 0) return (naColuna[0].posicao || 1000) / 2;
    return ((naColuna[i - 1].posicao || 0) + (naColuna[i].posicao || 0)) / 2;
  }

  async function mover(id, coluna, antesDoId) {
    const d = dados.find(x => x.id === id);
    if (!d) return;
    const de = d.coluna;
    const posicao = calcularPosicao(coluna, antesDoId);

    /* otimista na tela, confirmado no banco: se falhar, volta e avisa —
       nada de mostrar "salvo" antes da confirmação */
    const anterior = { coluna: d.coluna, posicao: d.posicao };
    d.coluna = coluna; d.posicao = posicao;
    desenhar();

    try {
      await B7.DB.moverDemanda(id, {
        coluna, posicao,
        concluida_em: coluna === 'concluida' ? new Date().toISOString() : null
      });
      if (de !== coluna) {
        await B7.DB.registrarKanban(id, de, coluna).catch(() => {});
      }
    } catch (e) {
      d.coluna = anterior.coluna; d.posicao = anterior.posicao;
      desenhar();
      B7.UI.toast('Não foi possível mover: ' + (e.message || 'erro ao salvar'),
        { tipo: 'erro' });
    }
  }

  /* =================================================================
     CRIAR E EDITAR
     ================================================================= */
  function modalDemanda(id) {
    const d = id ? dados.find(x => x.id === id) : null;
    const m = B7.UI.modal('<h3>' + (d ? 'Editar demanda' : 'Nova demanda') + '</h3>' +
      '<div class="sub">Demanda avulsa não precisa de cliente nem de material vinculado.</div>' +
      '<div class="corpo">' +
        '<label class="rot">TÍTULO</label>' +
        '<input class="campo" id="kd-titulo" value="' + esc(d ? d.titulo : '') + '" ' +
          'placeholder="ex.: Gravar depoimento da Dra. Ana">' +

        '<label class="rot">DESCRIÇÃO</label>' +
        '<textarea class="campo alta" id="kd-desc" rows="3">' +
          esc(d ? (d.descricao || '') : '') + '</textarea>' +

        '<div class="linha mb">' +
          '<div><label class="rot">CLIENTE</label>' +
            '<select class="campo" id="kd-cliente"><option value="">Sem cliente</option>' +
            clientes.map(c => '<option value="' + esc(c.id) + '"' +
              (d && d.client_id === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">TIPO</label>' +
            '<select class="campo" id="kd-tipo">' +
            TIPOS.map(([v, r]) => '<option value="' + v + '"' +
              (d && d.tipo === v ? ' selected' : '') + '>' + r + '</option>').join('') +
            '</select></div>' +
        '</div>' +

        '<div class="linha mb">' +
          '<div><label class="rot">RESPONSÁVEL</label>' +
            '<select class="campo" id="kd-resp"><option value="">Sem responsável</option>' +
            equipe.map(p => '<option value="' + esc(p.id) + '"' +
              (d && d.responsavel_id === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">PRAZO</label>' +
            '<input class="campo" type="date" id="kd-prazo" value="' +
            esc(d ? (d.prazo || '') : '') + '"></div>' +
        '</div>' +

        '<label class="rot">PRIORIDADE</label>' +
        '<div class="seg-linha" id="kd-prio">' +
          [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta']].map(([v, r]) =>
            '<button type="button" data-prio="' + v + '" class="' +
            ((d ? d.prioridade : 'normal') === v ? 'on' : '') + '">' + r + '</button>').join('') +
        '</div>' +

        '<label class="rot" style="margin-top:16px">LINKS DE REFERÊNCIA</label>' +
        '<textarea class="campo" id="kd-ref" rows="2" placeholder="um link por linha">' +
          esc(d ? (d.referencias || '') : '') + '</textarea>' +
        '<div id="kd-erro" class="ajuda erro-txt"></div>' +
      '</div>' +
      '<div class="acoes">' +
        (d ? '<button class="b perigo" data-excluir>Excluir</button><div style="flex:1"></div>' : '') +
        '<button class="b" data-fecha>Cancelar</button>' +
        '<button class="b pri" data-ok>' + (d ? 'Salvar' : 'Criar demanda') + '</button>' +
      '</div>', { larga: true });

    let prio = d ? d.prioridade : 'normal';
    m.querySelectorAll('[data-prio]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-prio]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); prio = b.dataset.prio;
    });

    m.querySelector('[data-ok]').onclick = async () => {
      const titulo = m.querySelector('#kd-titulo').value.trim();
      const erro = m.querySelector('#kd-erro');
      if (!titulo) { erro.textContent = 'A demanda precisa de um título.'; return; }

      const campos = {
        titulo,
        descricao: m.querySelector('#kd-desc').value.trim() || null,
        client_id: m.querySelector('#kd-cliente').value || null,
        tipo: m.querySelector('#kd-tipo').value,
        responsavel_id: m.querySelector('#kd-resp').value || null,
        prazo: m.querySelector('#kd-prazo').value || null,
        prioridade: prio,
        referencias: m.querySelector('#kd-ref').value.trim() || null
      };
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        if (d) await B7.DB.atualizarDemanda(d.id, campos);
        else {
          campos.coluna = 'a_fazer';
          campos.posicao = calcularPosicao('a_fazer', null);
          campos.tipo_vinculo = 'avulsa';
          await B7.DB.criarDemanda(campos);
        }
        m.fechar();
        await abrir();
      } catch (e) {
        botao.disabled = false; botao.textContent = d ? 'Salvar' : 'Criar demanda';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };

    const bx = m.querySelector('[data-excluir]');
    if (bx) bx.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Excluir esta demanda?',
        texto: 'Ela sai do quadro. O material vinculado, se houver, não é afetado.',
        confirmar: 'Excluir', perigo: true
      });
      if (!ok) return;
      await B7.DB.excluirDemanda(d.id);
      m.fechar();
      await abrir();
    };
  }

  /* =================================================================
     DETALHE
     ================================================================= */
  async function abrirDetalhe(id) {
    const d = dados.find(x => x.id === id);
    if (!d) return;

    let comentarios = [], historico = [];
    try {
      [comentarios, historico] = await Promise.all([
        B7.DB.comentariosDemanda(id).catch(() => []),
        B7.DB.historicoDemanda(id).catch(() => [])
      ]);
    } catch (e) {}

    const links = String(d.referencias || '').split('\n').map(x => x.trim()).filter(Boolean);
    const m = B7.UI.modal(
      '<div class="kd-cab">' +
        '<span class="kb-tipo ' + esc(d.tipo || 'producao') + '">' +
          esc((TIPOS.find(t => t[0] === d.tipo) || [, 'Produção'])[1]) + '</span>' +
        '<span class="kb-chip ' + esc(d.coluna) + '">' + esc(nomeColuna(d.coluna)) + '</span>' +
        '<button class="ico" data-fecha aria-label="Fechar">✕</button>' +
      '</div>' +
      '<h3>' + esc(d.titulo) + '</h3>' +
      '<div class="kd-meta">' +
        (d.cliente_nome ? '<span>' + esc(d.cliente_nome) + '</span>' : '') +
        (d.responsavel_nome ? '<span>' + esc(d.responsavel_nome) + '</span>' : '') +
        (d.prazo ? '<span>prazo ' + esc(B7.UI.dataBR(d.prazo)) + '</span>' : '') +
      '</div>' +

      '<div class="corpo">' +
        (d.descricao ? '<p class="kd-desc">' + esc(d.descricao) + '</p>' : '') +

        (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa' && d.vinculo_id
          ? '<div class="kd-vinculo"><div><small>MATERIAL VINCULADO</small>' +
            '<b>' + esc(d.tipo_vinculo) + '</b></div>' +
            '<button class="b fina pri" data-abrir-material>Abrir</button></div>'
          : '') +

        (links.length
          ? '<div class="kd-bloco"><small>REFERÊNCIAS</small>' +
            /* só http(s) vira link: "javascript:" digitado no campo não
               pode executar ao clicar */
            links.map(l => /^https?:\/\//i.test(l)
              ? '<a class="kd-link" href="' + esc(l) + '" target="_blank" ' +
                'rel="noopener noreferrer">' + esc(l) + '</a>'
              : '<span class="kd-link">' + esc(l) + '</span>').join('') + '</div>'
          : '') +

        '<div class="kd-bloco"><small>OBSERVAÇÕES DA EQUIPE</small>' +
          '<div class="kd-coments">' +
            (comentarios.length
              ? comentarios.map(c =>
                  '<div class="kd-com' + (c.resolvido_em ? ' resolvido' : '') + '">' +
                  '<div class="kd-com-cab"><b>' + esc(c.autor_nome || 'Equipe') + '</b>' +
                  '<span>' + esc(B7.UI.quando(c.created_at)) + '</span></div>' +
                  '<p>' + esc(c.texto) + '</p></div>').join('')
              : '<div class="vazio-leve">Nenhuma observação ainda.</div>') +
          '</div>' +
          '<div class="kd-novo-com">' +
            '<input class="campo fina" id="kd-com" placeholder="Escrever uma observação…">' +
            '<button class="b fina pri" id="kd-com-add">Adicionar</button>' +
          '</div>' +
        '</div>' +

        (historico.length
          ? '<div class="kd-bloco"><small>HISTÓRICO</small>' +
            historico.slice(0, 8).map(h =>
              '<div class="kd-hist">' + esc(h.autor_nome || 'Alguém') + ' moveu de ' +
              esc(nomeColuna(h.de)) + ' para ' + esc(nomeColuna(h.para)) +
              ' · ' + esc(B7.UI.quando(h.created_at)) + '</div>').join('') + '</div>'
          : '') +
      '</div>' +

      '<div class="acoes"><button class="b" data-editar>Editar</button>' +
      '<div style="flex:1"></div>' +
      '<button class="b contorno" data-arquivar>Arquivar</button>' +
      '<button class="b pri" data-fecha>Fechar</button></div>', { larga: true });

    m.querySelector('[data-editar]').onclick = () => { m.fechar(); modalDemanda(id); };

    m.querySelector('[data-arquivar]').onclick = async () => {
      await B7.DB.atualizarDemanda(id, { arquivada_em: new Date().toISOString() });
      m.fechar(); await abrir();
    };

    const add = m.querySelector('#kd-com-add');
    if (add) add.onclick = async () => {
      const campo = m.querySelector('#kd-com');
      const texto = campo.value.trim();
      if (!texto) return;
      add.disabled = true;
      try {
        const u = B7.Auth && B7.Auth.usuario();
        await B7.DB.comentarDemanda(id, texto, u ? u.nome : 'Equipe');
        m.fechar();
        abrirDetalhe(id);
      } catch (e) {
        add.disabled = false;
        B7.UI.toast('Não foi possível comentar', { tipo: 'erro' });
      }
    };

    const bm = m.querySelector('[data-abrir-material]');
    if (bm) bm.onclick = async () => {
      /* Cada material abre onde ele mora: roteiro no editor da gravação,
         conteúdo na linha editorial, gravação no editor, linha na linha. */
      try {
        let destino = null;
        if (d.tipo_vinculo === 'roteiro') {
          const r = await B7.DB.roteiro(d.vinculo_id);
          destino = '#/gravacao/' + r.recording_session_id + '?roteiro=' + r.id;
        } else if (d.tipo_vinculo === 'conteudo') {
          const c = await B7.DB.conteudo(d.vinculo_id);
          destino = '#/linha/' + c.linha_id + '/criativos';
        } else if (d.tipo_vinculo === 'gravacao') {
          destino = '#/gravacao/' + d.vinculo_id;
        } else if (d.tipo_vinculo === 'linha') {
          destino = '#/linha/' + d.vinculo_id;
        }
        if (!destino) return;
        m.fechar();
        location.hash = destino;
      } catch (e) {
        B7.UI.toast('O material vinculado não foi encontrado (pode estar na lixeira)', { tipo: 'erro' });
      }
    };
  }

  /* =================================================================
     GANCHO DO FLUXO DE APROVAÇÃO
     Chamado quando um material é enviado ou devolvido pelo cliente. A
     demanda muda de coluna por causa de um evento real, não de um
     comentário solto.
     ================================================================= */
  async function reagirAprovacao(tipoVinculo, vinculoId, evento) {
    const destino = { enviado: 'aguardando_cliente', ajustes: 'ajustes',
                      aprovado: 'pronto' }[evento];
    if (!destino) return;
    try {
      const ligadas = await B7.DB.demandasDoMaterial(tipoVinculo, vinculoId);
      for (const d of ligadas) {
        if (d.coluna === 'concluida') continue;   /* já encerrada: não reabre */
        await B7.DB.moverDemanda(d.id, { coluna: destino, posicao: d.posicao });
        await B7.DB.registrarKanban(d.id, d.coluna, destino, 'aprovação: ' + evento)
          .catch(() => {});
      }
    } catch (e) { /* o fluxo de aprovação não pode quebrar por causa do quadro */ }
  }

  return { abrir, reagirAprovacao, COLUNAS, nomeColuna };
})();
