/* =====================================================================
   B7 STATUS SEMANAL — interface

   Recorte operacional de sete dias, montado a partir da linha editorial
   e completado com demandas manuais. O que a equipe faz aqui é rápido:
   olhar a semana, mexer em etapa e situação, escrever uma observação
   curta e mandar o card para o cliente.

   Etapa é o que será feito. Situação é o andamento. São campos separados
   de propósito.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Semana = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const D = () => B7.DocSemana;

  const ETAPAS = ['Produção', 'Postagem', 'Gravação', 'Aprovação',
                  'Ajustes', 'Entrega', 'Reunião', 'Outro'];
  /* Formatos de peça de verdade — só esses direcionam pra um vocabulário
     de status próprio (Card, Story, Carrossel, Reel, Capa de Reel);
     demandas sem formato usam a etapa (Gravação tem vocabulário próprio
     também; as demais caem no genérico). "Nenhum" limpa o campo. */
  const FORMATOS_DEMANDA = ['Card', 'Carrossel', 'Reel', 'Story', 'Capa de Reel'];
  const SITUACOES_RELATORIO = ['Rascunho', 'Pronto para envio', 'Enviado'];

  /* Opções de status pro contexto (formato, ou a etapa quando não há
     formato) — só o vocabulário daquele formato, nunca a lista inteira
     do sistema (seria ruído: um Card não precisa ver "Gravando" no
     seletor). Se o valor atual não pertence mais ao vocabulário do
     contexto (ex.: dado antigo, ou o formato acabou de mudar), ele
     ainda aparece — como primeira opção — pra nunca sumir sozinho do
     seletor nem forçar uma troca silenciosa. */
  function opcoesSituacao(contexto, atual) {
    const base = D().estagiosDe(contexto);
    const lista = (atual && !base.includes(atual)) ? [atual].concat(base) : base.slice();
    return [...new Set(lista)];
  }

  let S = { relatorio: null, itens: [], linha: null, expandido: null, pagina: 0 };
  let filtro = '';

  /* ------------------------------------------------------------ datas */
  const hojeISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  };
  /* segunda-feira da semana de uma data, sem passar por fuso */
  function segundaDe(iso) {
    const p = D().partes(iso);
    const t = Date.UTC(p.ano, p.mes - 1, p.dia);
    const dow = new Date(t).getUTCDay();          /* 0 domingo */
    const recuo = dow === 0 ? 6 : dow - 1;
    return somarDias(iso, -recuo);
  }
  function somarDias(iso, n) {
    const p = D().partes(iso);
    const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia) + n * 864e5);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(d.getUTCDate()).padStart(2, '0');
  }

  /* =================================================================
     LISTA GLOBAL
     ================================================================= */
  async function abrirLista() {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 5 }) + '</div>';
    let lista;
    try { lista = await B7.DB.listarStatus({}); }
    catch (e) { return B7.Dashboard.erroConteudo(e); }

    const termo = filtro.trim().toLowerCase();
    const filtradas = termo
      ? lista.filter(r => (r.cliente_nome || '').toLowerCase().includes(termo) ||
          D().periodoTexto(r.semana_inicio, r.semana_fim).toLowerCase().includes(termo))
      : lista;

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha"><a href="#/">Central B7</a><span>/</span><b>Status semanal</b></div>' +
      '<div class="cab-conteudo"><div><h1>Status semanal</h1>' +
      '<p>O acompanhamento de sete dias que vai para o cliente.</p></div>' +
      '<button class="b pri" id="novo-status">+ Novo status</button></div>' +

      (lista.length
        ? '<div class="busca-linhas"><input class="campo" id="busca-status" ' +
          'placeholder="Buscar por cliente ou período…" value="' + esc(filtro) + '"></div>' +
          (filtradas.length
            ? '<div class="lista-status">' + filtradas.map(cardStatus).join('') + '</div>'
            : '<div class="estado-b7"><b>Nada encontrado para “' + esc(filtro) + '”.</b></div>')
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhum status semanal ainda.</b>' +
          '<p>Monte a semana de um cliente a partir da linha editorial e mande o card ' +
          'pronto para ele.</p>' +
          '<div class="acoes"><button class="b pri" id="novo-status-vazio">' +
          '+ Criar primeiro status</button></div></div>') +
    '</div>';

    ['novo-status', 'novo-status-vazio'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.onclick = () => modalNovo(null);
    });
    painel().querySelectorAll('[data-abrir-status]').forEach(el => el.onclick = () => {
      location.hash = '#/semana/' + el.dataset.abrirStatus;
    });
    painel().querySelectorAll('[data-quick-status]').forEach(el => el.onclick = e => {
      e.stopPropagation();
      quickView(el.dataset.quickStatus);
    });
    const busca = document.getElementById('busca-status');
    if (busca) busca.oninput = B7.UI.debounce(() => {
      filtro = busca.value;
      const pos = busca.selectionStart;
      abrirLista().then(() => {
        const novo = document.getElementById('busca-status');
        if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
      });
    }, 260);
  }

  function cardStatus(r) {
    const classe = { 'Rascunho': 'neutro', 'Pronto para envio': 'pronto',
                     'Enviado': 'enviado' }[r.situacao] || 'neutro';
    return '<div class="item-status" data-abrir-status="' + esc(r.id) + '">' +
      B7.UI.avatarCliente(r.cliente_nome, r.cliente_logo_url, 'p') +
      '<div class="is-tx">' +
        '<b>' + esc(r.cliente_nome) + '</b>' +
        '<span class="is-per">' + esc(D().periodoTexto(r.semana_inicio, r.semana_fim)) + '</span>' +
      '</div>' +
      '<div class="is-meta">' +
        '<span>' + r.total_itens + ' demanda' + (r.total_itens === 1 ? '' : 's') + '</span>' +
        (r.updated_at ? '<span>· ' + esc(B7.UI.quando(r.updated_at)) + '</span>' : '') +
      '</div>' +
      (r.total_atencao ? '<span class="is-atencao">' + r.total_atencao + ' aguardando</span>' : '') +
      '<span class="is-situacao ' + classe + '">' + esc(r.situacao || 'Rascunho') + '</span>' +
      '<button class="b p" data-quick-status="' + esc(r.id) + '">Prévia</button>' +
      '<span class="is-seta">Abrir →</span>' +
    '</div>';
  }

  /* =================================================================
     CRIAÇÃO — cliente, semana e fonte. Nada além disso.
     ================================================================= */
  async function modalNovo(clienteId, linhaId) {
    let clientes = [];
    if (!clienteId) {
      clientes = await B7.DB.listarClientes().catch(() => []);
      if (!clientes.length) return B7.UI.toast('Cadastre um cliente primeiro');
    }
    const inicioPadrao = segundaDe(hojeISO());

    const m = B7.UI.modal('<h3>Novo status semanal</h3>' +
      '<div class="sub">Sete dias a partir da data escolhida. O resto vem da linha ' +
      'editorial, se houver.</div>' +

      (clienteId ? '' :
        '<div class="mb"><label class="rot">CLIENTE</label>' +
        '<select class="campo" id="ns-cliente">' + clientes.map(c =>
          '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') +
        '</select></div>') +

      '<div class="mb"><label class="rot">INÍCIO DA SEMANA</label>' +
        '<input class="campo" type="date" id="ns-inicio" value="' + inicioPadrao + '">' +
        '<div class="ajuda" id="ns-periodo"></div></div>' +

      '<div class="mb"><label class="rot">FONTE DO PLANEJAMENTO</label>' +
        '<select class="campo" id="ns-linha"><option value="">Nenhuma — começar vazio</option></select>' +
        '<div class="ajuda" id="ns-fonte">As postagens previstas no período entram como demandas.</div></div>' +

      '<div id="ns-aviso"></div>' +

      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar status semanal</button></div>');

    const selCli = m.querySelector('#ns-cliente');
    const campoInicio = m.querySelector('#ns-inicio');
    const selLinha = m.querySelector('#ns-linha');
    const cliente = () => clienteId || (selCli && selCli.value);

    async function carregarLinhas() {
      const cli = cliente();
      const linhas = cli ? await B7.DB.listarLinhas(cli).catch(() => []) : [];
      selLinha.innerHTML = '<option value="">Nenhuma — começar vazio</option>' +
        linhas.map(l => '<option value="' + esc(l.id) + '">' +
          esc(l.nome || (B7.UI.MESES[l.mes - 1] + ' ' + l.ano)) + '</option>').join('');
      /* escolhe sozinho a linha do mês da semana, quando existir */
      const p = D().partes(campoInicio.value || inicioPadrao);
      const combina = linhas.find(l => l.mes === p.mes && l.ano === p.ano);
      if (linhaId) selLinha.value = linhaId;
      else if (combina) selLinha.value = combina.id;
      m.querySelector('#ns-fonte').textContent = linhas.length
        ? 'As postagens previstas no período entram como demandas.'
        : 'Este cliente ainda não tem linha editorial. Dá para criar o status vazio ' +
          'e adicionar demandas à mão.';
    }

    async function atualizarPeriodo() {
      const ini = campoInicio.value;
      if (!ini) return;
      const fim = somarDias(ini, 6);
      m.querySelector('#ns-periodo').textContent = D().periodoTexto(ini, fim);
      const cli = cliente();
      const alvo = m.querySelector('#ns-aviso');
      alvo.innerHTML = '';
      if (!cli) return;
      const existente = await B7.DB.statusDaSemana(cli, ini).catch(() => null);
      if (existente) {
        alvo.innerHTML = '<div class="aviso-suave" style="display:flex;align-items:center;gap:10px">' +
          '<span>Já existe um status para esta semana.</span>' +
          '<button class="b p" data-abrir-existente="' + esc(existente.id) + '">Abrir o existente</button>' +
          '</div>';
        alvo.querySelector('[data-abrir-existente]').onclick = () => {
          m.fechar();
          location.hash = '#/semana/' + existente.id;
        };
      }
    }

    campoInicio.onchange = () => { atualizarPeriodo(); carregarLinhas(); };
    if (selCli) selCli.onchange = () => { atualizarPeriodo(); carregarLinhas(); };
    await carregarLinhas();
    await atualizarPeriodo();

    m.querySelector('[data-ok]').onclick = async () => {
      const cli = cliente();
      const ini = campoInicio.value;
      if (!cli || !ini) return B7.UI.toast('Escolha o cliente e a data inicial', { tipo: 'erro' });
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        const fim = somarDias(ini, 6);
        const novo = await B7.Save.acao(() => B7.DB.criarStatus({
          client_id: cli, linha_id: selLinha.value || null,
          semana_inicio: ini, semana_fim: fim
        }), 'Status semanal criado');

        /* importa só o que tem postagem dentro do intervalo */
        if (selLinha.value) {
          const conteudos = await B7.DB.conteudosDoPeriodo(selLinha.value, ini, fim).catch(() => []);
          if (conteudos.length) {
            await B7.DB.criarItens(conteudos.map((c, i) => ({
              report_id: novo.id, data: c.data_postagem, position: i,
              titulo: c.titulo || 'Sem título',
              etapa: 'Postagem',
              /* estado inicial neutro (o sistema não sabe o que já foi
                 feito): primeira etapa do vocabulário do próprio formato
                 — "A produzir" pra Card/Story, "A estruturar" pro
                 Carrossel, "Escrevendo roteiro" pro Reel. */
              situacao: D().estagiosDe(D().contextoDe({ formato: c.tipo || null, etapa: 'Postagem' }))[0],
              canal: c.canal || null, formato: c.tipo || null,
              content_id: c.id, script_id: c.script_id || null,
              origem: 'linha_editorial',
              source_snapshot: { titulo: c.titulo, data_postagem: c.data_postagem,
                                 canal: c.canal, tipo: c.tipo }
            })));
          }
        }
        B7.DB.registrar({ tipo: 'criar', entidade: 'status', id: novo.id, cliente: cli,
          texto: 'Status semanal: ' + D().periodoTexto(ini, fim) });
        m.fechar();
        location.hash = '#/semana/' + novo.id;
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Criar status semanal';
      }
    };
  }

  /* =================================================================
     EDITOR
     ================================================================= */
  async function abrir(id) {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('detalhe') + '</div>';
    try {
      S.relatorio = await B7.DB.status(id);
      S.itens = await B7.DB.listarItens(id);
      S.linha = S.relatorio.linha_id
        ? await B7.DB.linha(S.relatorio.linha_id).catch(() => null) : null;
    } catch (e) { return B7.Dashboard.erroConteudo(e); }
    S.pagina = 0;
    B7.Rota.titulo([D().periodoTexto(S.relatorio.semana_inicio, S.relatorio.semana_fim),
                    S.relatorio.cliente_nome]);
    render();
  }

  function render() {
    const r = S.relatorio;
    const dias = D().diasDoPeriodo(r.semana_inicio, r.semana_fim);
    const porDia = {};
    S.itens.forEach(i => { (porDia[i.data] = porDia[i.data] || []).push(i); });
    const semData = S.itens.filter(i => !i.data);

    painel().innerHTML = '<div class="conteudo entra sem-editor">' +
      '<div class="trilha-nav"><button data-ir="#/">Central B7</button><span>/</span>' +
        '<button data-ir="#/cliente/' + esc(r.client_id) + '">' + esc(r.cliente_nome) + '</button>' +
        '<span>/</span><button data-ir="#/semanas">Status semanal</button>' +
        '<span>/</span><b>' + esc(D().periodoTexto(r.semana_inicio, r.semana_fim)) + '</b></div>' +

      '<div class="sem-cab">' +
        '<div><small>' + esc(r.cliente_nome) + '</small>' +
        '<h1>Status semanal</h1>' +
        '<span class="sem-per">' + esc(D().periodoTexto(r.semana_inicio, r.semana_fim)) + '</span></div>' +
        '<div class="sem-acoes">' +
          '<button class="b pri" data-nova-demanda>+ Adicionar demanda</button>' +
          '<button class="b" data-exportar>Exportar</button>' +
          '<div class="menu"><button class="ico">⋯</button><div class="lista">' +
            '<div class="rot">ESTADO DO RELATÓRIO</div>' +
            SITUACOES_RELATORIO.map(v => '<button data-situacao-rel="' + esc(v) + '">' +
              (r.situacao === v ? '● ' : '') + esc(v) + '</button>').join('') +
            '<hr><button data-portal-semana>' + (r.publicado_em ? '✓ Publicado no portal do cliente' : 'Publicar no portal do cliente') + '</button>' +
            '<button data-duplicar-semana>Duplicar para outra semana</button>' +
            '<button data-versoes>Versões exportadas</button>' +
            (S.linha ? '<button data-ir-linha>Abrir linha editorial</button>' : '') +
            '<hr><button data-arquivar-semana>Arquivar</button>' +
            '<button class="perigo" data-excluir-semana>Excluir</button>' +
          '</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="sem-grade">' +
        '<div class="sem-edicao">' +
          blocoInfo() +
          blocoRevisao() +
          dias.map(d => blocoDia(d, (porDia[d] || []))).join('') +
          (semData.length ? blocoDia(null, semData) : '') +
        '</div>' +
        '<div class="sem-preview" id="sem-preview">' +
          '<div class="sp-topo"><span>Prévia</span>' +
            '<button class="b p" data-recolher>Recolher</button>' +
          '</div>' +
          '<div class="sp-palco"><div class="sp-in" id="sp-in"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>';

    painel().querySelectorAll('[data-ir]').forEach(b => b.onclick = () => location.hash = b.dataset.ir);
    B7.Conteudo.ligarCampos(painel());
    B7.UI.ligarMenus(painel());
    ligar();
    desenharPreview();
  }

  /* preferencias é o jsonb já existente na tabela (nunca usado até
     agora) — guarda os dois ajustes de apresentação novos sem precisar
     de coluna nova no banco. */
  const prefs = () => (S.relatorio && S.relatorio.preferencias) || {};
  const mostrarConcluidos = () => !!prefs().mostrar_concluidos;
  const mostrarAPartirDeHoje = () => prefs().mostrar_periodo === 'a_partir_hoje';

  function blocoInfo() {
    const r = S.relatorio;
    const t = 'data-tab="status_semanais" data-id="' + esc(r.id) + '"';
    return '<div class="bloco mb sem-info">' +
      '<label class="rot">OBSERVAÇÃO GERAL DA SEMANA <span class="leve">— opcional</span></label>' +
      '<textarea class="campo cresce" rows="2" ' + t + ' data-campo="observacao_geral" ' +
      'placeholder="Algo que resume a semana para o cliente.">' +
      esc(r.observacao_geral || '') + '</textarea>' +
      '<div class="sem-opcoes">' +
        '<label class="op-mini' + (r.mostrar_dias_vazios !== false ? ' on' : '') + '">' +
          '<input type="checkbox" data-opcao="mostrar_dias_vazios"' +
          (r.mostrar_dias_vazios !== false ? ' checked' : '') + '>' +
          '<span>Mostrar dias sem atividades</span></label>' +
        '<label class="op-mini' + (r.mostrar_observacoes !== false ? ' on' : '') + '">' +
          '<input type="checkbox" data-opcao="mostrar_observacoes"' +
          (r.mostrar_observacoes !== false ? ' checked' : '') + '>' +
          '<span>Incluir observações</span></label>' +
        '<label class="op-mini' + (mostrarConcluidos() ? ' on' : '') + '">' +
          '<input type="checkbox" data-pref-bool="mostrar_concluidos"' +
          (mostrarConcluidos() ? ' checked' : '') + '>' +
          '<span>Mostrar itens concluídos <small>trabalho já postado/finalizado — cancelados nunca aparecem</small></span></label>' +
      '</div>' +
      '<div class="mb" style="margin-top:10px;max-width:280px">' +
        '<label class="rot">MOSTRAR ATIVIDADES</label>' +
        '<select class="campo" data-pref-select="mostrar_periodo">' +
          '<option value="toda_semana"' + (mostrarAPartirDeHoje() ? '' : ' selected') + '>Toda a semana</option>' +
          '<option value="a_partir_hoje"' + (mostrarAPartirDeHoje() ? ' selected' : '') + '>A partir de hoje</option>' +
        '</select>' +
      '</div>' +
    '</div>';
  }

  /* Um item "precisa de revisão" quando a situação guardada nele não
     está mais no vocabulário do contexto atual (formato/etapa) — é o
     caso de item criado antes desta rodada, com um rótulo genérico de
     antes (Previsto, Em andamento, Confirmado...), ou item cujo
     formato/etapa mudou sem que a situação tenha acompanhado. Card
     concluído/cancelado não entra aqui — "Postado"/"Cancelada" já são
     claros por si, mesmo fora do vocabulário "a fazer". */
  function precisaRevisao(it) {
    if (!it.situacao) return false;
    if (D().ehConcluido(it) || D().ehCancelado(it)) return false;
    return !D().estagiosDe(D().contextoDe(it)).includes(it.situacao);
  }

  /* Aviso no topo do editor, sempre que existir pelo menos um item com
     situação genérica — resolve o incômodo de "só aparece previsto/em
     andamento pro cliente": ao migrar pra esta rodada, os itens que já
     existiam continuam com o texto antigo até alguém escolher a
     situação real (nunca é trocado sozinho, por decisão consciente —
     ver CORRECOES). Este bloco deixa a troca rápida: escolher aqui
     salva na hora, sem precisar abrir cada item. Some da lista assim
     que o item tiver uma situação específica de novo. */
  function blocoRevisao() {
    const pendentes = S.itens.filter(precisaRevisao);
    if (!pendentes.length) return '';
    const plural = pendentes.length > 1;
    return '<div class="bloco mb sem-revisao">' +
      '<div class="sr-cab"><b>' + pendentes.length + ' situaç' + (plural ? 'ões genéricas' : 'ão genérica') + ' pra especificar</b>' +
      '<p class="leve">Esses itens ainda estão com um status antigo (ex.: "Previsto", "Em andamento") — o cliente vê exatamente esse texto no relatório, sem saber se é roteiro, gravação, edição ou aprovação. Escolha a etapa real de cada um.</p></div>' +
      pendentes.map(it => {
        const contexto = D().contextoDe(it);
        const opcoes = D().estagiosDe(contexto);
        return '<div class="sr-item">' +
          '<span class="sr-tit">' + esc(it.titulo || 'Sem título') +
            '<small>' + esc(contexto) + ' · atualmente "' + esc(it.situacao) + '"</small></span>' +
          '<select class="campo" data-revisar-situacao="' + esc(it.id) + '">' +
            '<option value="" selected disabled>Escolher situação real…</option>' +
            opcoes.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('') +
          '</select></div>';
      }).join('') +
    '</div>';
  }

  function blocoDia(iso, itens) {
    const rot = iso
      ? D().DIAS[D().diaDaSemana(iso)] + ' · ' + D().curto(iso)
      : 'SEM DATA';
    return '<div class="sem-dia" data-dia="' + esc(iso || '') + '">' +
      '<div class="sd-cab"><b>' + rot + '</b>' +
        (itens.length ? '<span>' + itens.length + '</span>' : '') +
      '</div>' +
      (itens.length
        ? '<div class="sd-itens">' + itens
            .slice().sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((i, n) => cardItem(i, n, itens.length)).join('') + '</div>'
        : '<div class="sd-vazio">Sem atividades programadas.</div>') +
      (iso ? '<button class="sd-add" data-add-dia="' + esc(iso) + '">+ Adicionar demanda neste dia</button>' : '') +
    '</div>';
  }

  function cardItem(it, indice, total) {
    const aberto = S.expandido === it.id;
    const t = 'data-tab="status_itens" data-id="' + esc(it.id) + '"';
    const contexto = D().contextoDe(it);
    const opcoes = opcoesSituacao(contexto, it.situacao);
    const ehReel = it.formato === 'Reel';

    return '<div class="sd-item' + (aberto ? ' aberto' : '') + '" data-item="' + esc(it.id) + '">' +
      '<div class="si-topo" data-expandir="' + esc(it.id) + '">' +
        '<span class="si-ic">' + (D().ICONE[it.formato] || D().ICONE[it.etapa] || D().ICONE.Outro) + '</span>' +
        '<div class="si-tx"><b>' + esc(it.titulo || 'Sem título') + '</b>' +
          '<div class="si-estado"><span>' + esc(it.formato || it.etapa) + '</span>' +
          '<span class="ps-ponto" style="background:' + D().corSituacao(it.situacao) + '"></span>' +
          '<span>' + esc(it.situacao) + '</span>' +
          (it.origem === 'linha_editorial' ? '<span class="si-origem">linha editorial</span>' : '') +
          '</div></div>' +
        '<div class="si-ordem">' +
          '<button class="ico" data-mover="' + esc(it.id) + '" data-dir="-1"' +
            (indice === 0 ? ' disabled title="Já é o primeiro do dia"' : ' title="Mover para cima"') + '>↑</button>' +
          '<button class="ico" data-mover="' + esc(it.id) + '" data-dir="1"' +
            (indice === total - 1 ? ' disabled title="Já é o último do dia"' : ' title="Mover para baixo"') + '>↓</button>' +
        '</div>' +
        '<div class="menu"><button class="ico">⋯</button><div class="lista">' +
          '<button data-duplicar-item="' + esc(it.id) + '">Duplicar demanda</button>' +
          (it.content_id ? '<button data-desvincular="' + esc(it.id) + '">Desvincular da origem</button>' : '') +
          '<hr><button class="perigo" data-excluir-item="' + esc(it.id) + '">Remover do relatório</button>' +
        '</div></div>' +
      '</div>' +

      (aberto ? '<div class="si-corpo">' +
        '<div class="linha mb">' +
          '<div><label class="rot">TÍTULO</label>' +
            '<input class="campo" value="' + esc(it.titulo || '') + '" ' + t + ' data-campo="titulo"></div>' +
          '<div><label class="rot">' + ((ehReel || it.etapa === 'Gravação') ? 'DATA DE GRAVAÇÃO' : 'DATA DE POSTAGEM') + '</label>' +
            '<input class="campo" type="date" value="' + esc(it.data || '') + '" ' +
            'data-data-item="' + esc(it.id) + '"></div>' +
        '</div>' +
        (ehReel ? '<div class="linha mb"><div><label class="rot">DATA DE POSTAGEM ' +
          '<span class="leve">— opcional, se for diferente da gravação</span></label>' +
          '<input class="campo" type="date" value="' + esc(it.data_postagem || '') + '" ' +
          'data-data-postagem-item="' + esc(it.id) + '"></div></div>' : '') +
        '<div class="linha mb">' +
          '<div><label class="rot">FORMATO <span class="leve">— opcional</span></label>' +
            '<select class="campo" data-formato-item="' + esc(it.id) + '">' +
              '<option value=""' + (!it.formato ? ' selected' : '') + '>Nenhum específico</option>' +
              FORMATOS_DEMANDA.map(f => '<option value="' + esc(f) + '"' +
                (it.formato === f ? ' selected' : '') + '>' + esc(f) + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">ETAPA</label>' +
            '<select class="campo" data-etapa-item="' + esc(it.id) + '">' + ETAPAS.map(e =>
              '<option' + (it.etapa === e ? ' selected' : '') + '>' + e + '</option>').join('') +
            '</select></div>' +
        '</div>' +
        '<div class="linha mb">' +
          '<div><label class="rot">SITUAÇÃO <span class="leve">— ' + esc(contexto) + '</span></label>' +
            '<select class="campo" ' + t + ' data-campo="situacao">' + opcoes.map(v =>
              '<option' + (it.situacao === v ? ' selected' : '') + '>' + v + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">CANAL <span class="leve">— opcional</span></label>' +
            '<input class="campo" value="' + esc(it.canal || '') + '" ' + t + ' data-campo="canal"></div>' +
        '</div>' +
        '<label class="rot">COMO APARECE PARA O CLIENTE <span class="leve">' +
          '— opcional, simplifica o texto do status sem mudar o status real</span></label>' +
        '<input class="campo" value="' + esc(it.situacao_cliente || '') + '" ' + t +
        ' data-campo="situacao_cliente" placeholder="' + esc(it.situacao) + '" style="margin-bottom:10px">' +
        '<label class="rot">OBSERVAÇÃO PARA O CLIENTE <span class="leve">— opcional</span></label>' +
        '<textarea class="campo cresce" rows="2" ' + t + ' data-campo="observacao" ' +
        'placeholder="Uma frase curta: o que o cliente precisa saber.">' +
        esc(it.observacao || '') + '</textarea>' +
      '</div>' : '') +
    '</div>';
  }

  /* ------------------------------------------------------- handlers */
  function ligar() {
    const p = painel();

    p.querySelectorAll('[data-expandir]').forEach(el => el.onclick = e => {
      if (e.target.closest('.menu') || e.target.closest('.si-ordem')) return;
      S.expandido = S.expandido === el.dataset.expandir ? null : el.dataset.expandir;
      render();
    });

    p.querySelectorAll('[data-nova-demanda]').forEach(b => b.onclick = () => modalDemanda(null));
    p.querySelectorAll('[data-add-dia]').forEach(b => b.onclick = () => modalDemanda(b.dataset.addDia));
    p.querySelectorAll('[data-exportar]').forEach(b => b.onclick = modalExportar);

    /* bloco "situações a revisar" — escolher aqui já salva a situação
       real do item, sem precisar abrir o card. Some da lista sozinho no
       próximo render() porque deixa de bater em precisaRevisao(). */
    p.querySelectorAll('[data-revisar-situacao]').forEach(sel => sel.onchange = async () => {
      const it = S.itens.find(x => x.id === sel.dataset.revisarSituacao);
      if (!it || !sel.value) return;
      const titulo = it.titulo || 'Sem título';
      it.situacao = sel.value;
      try { await B7.Save.campo('status_itens', it.id, { situacao: sel.value }); } catch (e) {}
      B7.UI.toast('"' + titulo + '" agora está como "' + sel.value + '"');
      render();
      desenharPreview();
    });

    p.querySelectorAll('[data-opcao]').forEach(cx => cx.onchange = async () => {
      const patch = {}; patch[cx.dataset.opcao] = cx.checked;
      cx.closest('.op-mini').classList.toggle('on', cx.checked);
      S.relatorio = Object.assign(S.relatorio, patch);
      try { await B7.Save.campo('status_semanais', S.relatorio.id, patch); } catch (e) {}
      desenharPreview();
    });

    /* preferências dentro do jsonb — mesmo padrão do data-opcao acima,
       só que fazendo merge dentro de preferencias em vez de gravar uma
       coluna própria. */
    async function salvarPref(chave, valor) {
      const novo = Object.assign({}, prefs(), { [chave]: valor });
      S.relatorio.preferencias = novo;
      try { await B7.Save.campo('status_semanais', S.relatorio.id, { preferencias: novo }); } catch (e) {}
      desenharPreview();
    }
    p.querySelectorAll('[data-pref-bool]').forEach(cx => cx.onchange = () => {
      cx.closest('.op-mini').classList.toggle('on', cx.checked);
      salvarPref(cx.dataset.prefBool, cx.checked);
    });
    p.querySelectorAll('[data-pref-select]').forEach(sel => sel.onchange = () => {
      salvarPref(sel.dataset.prefSelect, sel.value);
    });

    p.querySelectorAll('[data-situacao-rel]').forEach(b => b.onclick = async () => {
      const v = b.dataset.situacaoRel;
      const patch = { situacao: v };
      if (v === 'Enviado') patch.enviado_em = new Date().toISOString();
      try {
        await B7.Save.acao(() => B7.DB.atualizarStatus(S.relatorio.id, patch), 'Estado: ' + v);
        S.relatorio.situacao = v;
        if (v === 'Enviado') {
          B7.DB.registrar({ tipo: 'editar', entidade: 'status', id: S.relatorio.id,
            cliente: S.relatorio.client_id, texto: 'Status semanal marcado como enviado' });
        }
        render();
      } catch (e) {}
    });

    /* Publicar no portal é separado de "Enviado": enviado é o registro de
       que a equipe mandou o card; publicado é o cliente poder abrir no
       portal. Despublicar tira do portal sem apagar nada. */
    const portal = p.querySelector('[data-portal-semana]');
    if (portal) portal.onclick = async () => {
      const ligar = !S.relatorio.publicado_em;
      const patch = { publicado_em: ligar ? new Date().toISOString() : null };
      try {
        await B7.Save.acao(() => B7.DB.atualizarStatus(S.relatorio.id, patch),
          ligar ? 'Status publicado no portal do cliente' : 'Status retirado do portal');
        Object.assign(S.relatorio, patch);
        render();
      } catch (e) {}
    };

    /* Quando etapa/formato muda, o vocabulário de status válido muda
       junto — se a situação atual não pertence mais a ele, o sistema
       nunca converte silenciosamente pra outra coisa: ajusta pra
       primeira opção válida do novo contexto e avisa por toast, pra
       quem editou saber que precisa conferir/escolher a situação de
       novo. */
    async function revalidarSituacao(it) {
      const contexto = D().contextoDe(it);
      const validas = D().estagiosDe(contexto);
      if (validas.includes(it.situacao)) return;
      const nova = validas[0];
      it.situacao = nova;
      try { await B7.Save.campo('status_itens', it.id, { situacao: nova }); } catch (e) {}
      B7.UI.toast('Situação ajustada para "' + nova + '" (novo formato/etapa: ' + contexto + ')');
    }

    p.querySelectorAll('[data-etapa-item]').forEach(sel => sel.onchange = async () => {
      const it = S.itens.find(x => x.id === sel.dataset.etapaItem);
      if (!it) return;
      it.etapa = sel.value;
      try { await B7.Save.campo('status_itens', it.id, { etapa: sel.value }); } catch (e) {}
      await revalidarSituacao(it);
      render();
    });

    p.querySelectorAll('[data-formato-item]').forEach(sel => sel.onchange = async () => {
      const it = S.itens.find(x => x.id === sel.dataset.formatoItem);
      if (!it) return;
      it.formato = sel.value || null;
      if (it.formato !== 'Reel') it.data_postagem = null;
      try {
        await B7.Save.campo('status_itens', it.id,
          { formato: it.formato, data_postagem: it.data_postagem });
      } catch (e) {}
      await revalidarSituacao(it);
      render();
    });

    p.querySelectorAll('[data-data-postagem-item]').forEach(inp => inp.onchange = async () => {
      const it = S.itens.find(x => x.id === inp.dataset.dataPostagemItem);
      if (!it) return;
      it.data_postagem = inp.value || null;
      try { await B7.Save.campo('status_itens', it.id, { data_postagem: it.data_postagem }); } catch (e) {}
      desenharPreview();
    });

    /* mudar a data pode tirar a demanda da semana: avisamos antes */
    p.querySelectorAll('[data-data-item]').forEach(inp => inp.onchange = async () => {
      const it = S.itens.find(x => x.id === inp.dataset.dataItem);
      if (!it) return;
      const nova = inp.value;
      const dentro = !nova || (nova >= S.relatorio.semana_inicio && nova <= S.relatorio.semana_fim);
      if (!dentro) {
        const ok = await B7.UI.confirmar({
          titulo: 'Essa data está fora da semana',
          texto: 'A demanda sai deste relatório e passa a aparecer como sem data. ' +
                 'Talvez ela pertença a outra semana.',
          confirmar: 'Mudar mesmo assim'
        });
        if (!ok) { inp.value = it.data || ''; return; }
      }
      it.data = nova || null;
      try { await B7.Save.campo('status_itens', it.id, { data: it.data }); } catch (e) {}
      render();
    });

    p.querySelectorAll('[data-mover]').forEach(b => b.onclick = async e => {
      e.stopPropagation();
      const it = S.itens.find(x => x.id === b.dataset.mover);
      if (!it) return;
      const doDia = S.itens.filter(x => x.data === it.data)
        .sort((a, b2) => (a.position || 0) - (b2.position || 0));
      const i = doDia.indexOf(it);
      const j = i + Number(b.dataset.dir);
      if (j < 0 || j >= doDia.length) return;
      doDia.splice(i, 1);
      doDia.splice(j, 0, it);
      doDia.forEach((x, n) => { x.position = n; });
      render();
      try {
        for (const x of doDia) await B7.DB.atualizarItem(x.id, { position: x.position });
      } catch (e2) {}
      desenharPreview();
    });

    p.querySelectorAll('[data-duplicar-item]').forEach(b => b.onclick = async () => {
      const it = S.itens.find(x => x.id === b.dataset.duplicarItem);
      if (!it) return;
      try {
        const contexto = D().contextoDe(it);
        const novo = await B7.Save.acao(() => B7.DB.criarItem({
          report_id: S.relatorio.id, data: it.data, position: (it.position || 0) + 1,
          titulo: it.titulo, etapa: it.etapa, situacao: D().estagiosDe(contexto)[0],
          canal: it.canal, formato: it.formato, content_id: it.content_id,
          script_id: it.script_id, recording_id: it.recording_id,
          origem: it.origem, source_snapshot: it.source_snapshot
        }), 'Demanda duplicada');
        S.itens.push(novo);
        S.expandido = novo.id;
        render();
      } catch (e) {}
    });

    p.querySelectorAll('[data-desvincular]').forEach(b => b.onclick = async () => {
      const it = S.itens.find(x => x.id === b.dataset.desvincular);
      if (!it) return;
      try {
        await B7.Save.acao(() => B7.DB.atualizarItem(it.id,
          { content_id: null, origem: 'manual' }), 'Demanda desvinculada');
        it.content_id = null; it.origem = 'manual';
        render();
      } catch (e) {}
    });

    p.querySelectorAll('[data-excluir-item]').forEach(b => b.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Remover esta demanda?',
        texto: 'Ela sai só deste relatório. O conteúdo na linha editorial continua lá.',
        confirmar: 'Remover'
      });
      if (!ok) return;
      try {
        await B7.Save.acao(() => B7.DB.excluirItem(b.dataset.excluirItem), 'Demanda removida');
        S.itens = S.itens.filter(x => x.id !== b.dataset.excluirItem);
        B7.DB.registrar({ tipo: 'excluir', entidade: 'status', id: S.relatorio.id,
          cliente: S.relatorio.client_id, texto: 'Demanda removida do status semanal' });
        render();
      } catch (e) {}
    });

    p.querySelectorAll('[data-duplicar-semana]').forEach(b => b.onclick = modalDuplicar);
    p.querySelectorAll('[data-versoes]').forEach(b => b.onclick = modalVersoes);
    p.querySelectorAll('[data-ir-linha]').forEach(b => b.onclick = () => {
      location.hash = '#/linha/' + S.relatorio.linha_id;
    });
    p.querySelectorAll('[data-arquivar-semana]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.arquivarStatus(S.relatorio.id, true), 'Semana arquivada');
        location.hash = '#/semanas';
      } catch (e) {}
    });
    p.querySelectorAll('[data-excluir-semana]').forEach(b => b.onclick = async () => {
      const ok = await B7.UI.confirmar({
        titulo: 'Excluir este status semanal?',
        texto: 'Ele vai para a lixeira com as demandas. Nada da linha editorial é afetado.',
        confirmar: 'Excluir'
      });
      if (!ok) return;
      try {
        await B7.Save.acao(() => B7.DB.excluirStatus(S.relatorio.id), 'Status excluído');
        location.hash = '#/semanas';
      } catch (e) {}
    });

    p.querySelectorAll('[data-recolher]').forEach(b => b.onclick = () => {
      const alvo = document.getElementById('sem-preview');
      const recolhido = alvo.classList.toggle('recolhido');
      b.textContent = recolhido ? 'Mostrar prévia' : 'Recolher';
      try { localStorage.setItem('b7_sem_preview', recolhido ? '0' : '1'); } catch (e) {}
      if (!recolhido) desenharPreview();
    });
    try {
      if (localStorage.getItem('b7_sem_preview') === '0') {
        const alvo = document.getElementById('sem-preview');
        alvo.classList.add('recolhido');
        const b = p.querySelector('[data-recolher]');
        if (b) b.textContent = 'Mostrar prévia';
      }
    } catch (e) {}

    /* o preview acompanha o que está sendo digitado, com folga para não
       redesenhar a cada tecla */
    p.querySelectorAll('[data-campo]').forEach(el => {
      el.addEventListener('input', B7.UI.debounce(() => {
        const id = el.dataset.id, campo = el.dataset.campo;
        if (el.dataset.tab === 'status_itens') {
          const it = S.itens.find(x => x.id === id);
          if (it) it[campo] = el.value;
        } else {
          S.relatorio[campo] = el.value;
        }
        desenharPreview();
      }, 350));
      el.addEventListener('change', () => {
        const id = el.dataset.id, campo = el.dataset.campo;
        if (el.dataset.tab === 'status_itens') {
          const it = S.itens.find(x => x.id === id);
          if (it) it[campo] = el.value;
        } else { S.relatorio[campo] = el.value; }
        desenharPreview();
      });
    });
  }

  /* ------------------------------------------------- preview vivo
     Usa exatamente o mesmo renderizador da exportação. O que se vê é o
     que sai no arquivo. */
  async function desenharPreview() {
    const alvo = document.getElementById('sp-in');
    if (!alvo) return;
    const ctx = {
      relatorio: S.relatorio, itens: S.itens, linha: S.linha,
      clienteLogo: S.relatorio.cliente_logo_url || ''
    };
    /* espera E força o carregamento das fontes antes de medir — sem isso
       a decisão de densidade/colunas pode rodar com a fonte de fallback
       (font-display:swap) ainda no lugar e ficar errada assim que a
       fonte certa trocar (document.fonts.ready sozinho não basta: só
       espera o que já foi pedido, e um peso que a tela ainda não usou
       nunca chega a ser pedido antes de montar() usá-lo pela primeira
       vez). */
    await D().carregarFontes();
    if (!document.getElementById('sp-in')) return; /* saiu da tela enquanto esperava */
    /* sempre uma página só — D().montar() nunca devolve mais de um .pag45 */
    alvo.innerHTML = D().montar(ctx, alvo.parentElement, opcoesDoc());
    escalarPreview();
  }

  function escalarPreview() {
    const palco = painel().querySelector('.sp-palco');
    const dentro = document.getElementById('sp-in');
    if (!palco || !dentro || !dentro.firstElementChild) return;
    const pag = dentro.firstElementChild;
    const f = Math.min((palco.clientWidth - 24) / pag.offsetWidth,
                       (palco.clientHeight - 24) / pag.offsetHeight);
    dentro.style.transform = 'scale(' + f + ')';
    dentro.style.width = pag.offsetWidth + 'px';
    dentro.style.height = pag.offsetHeight + 'px';
  }
  window.addEventListener('resize', B7.UI.debounce(() => {
    if (document.getElementById('sp-in')) escalarPreview();
  }, 200));

  const opcoesDoc = () => ({
    mostrarDiasVazios: S.relatorio.mostrar_dias_vazios !== false,
    mostrarObservacoes: S.relatorio.mostrar_observacoes !== false,
    mostrarLegenda: S.relatorio.mostrar_legenda || 'auto',
    mostrarConcluidos: mostrarConcluidos(),
    somenteAPartirDeHoje: mostrarAPartirDeHoje()
  });

  /* =================================================================
     ADICIONAR DEMANDA
     ================================================================= */
  async function modalDemanda(dataPadrao) {
    const r = S.relatorio;
    const m = B7.UI.modal('<h3>Adicionar demanda</h3>' +
      '<div class="sub">Escolha um conteúdo do planejamento ou crie uma demanda ' +
      'avulsa, como uma gravação ou uma aprovação.</div>' +
      '<div class="opcoes mb" id="md-tipo">' +
        '<button data-tipo="conteudo" class="on">Conteúdo existente</button>' +
        '<button data-tipo="avulsa">Demanda avulsa</button>' +
      '</div>' +
      '<div id="md-corpo"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Adicionar</button></div>', { larga: true });

    let tipo = 'conteudo';
    let escolhido = null;
    let conteudos = [];

    async function corpoConteudo(termo) {
      const alvo = m.querySelector('#md-corpo');
      if (!conteudos.length) {
        /* prioriza a linha editorial da semana; sem ela, o cliente inteiro */
        conteudos = r.linha_id
          ? await B7.DB.listarConteudos(r.linha_id).catch(() => [])
          : await B7.DB.listarConteudosDoCliente(r.client_id).catch(() => []);
      }
      const t = (termo || '').trim().toLowerCase();
      const lista = (t ? conteudos.filter(c =>
        (c.titulo || '').toLowerCase().includes(t) ||
        (c.tipo || '').toLowerCase().includes(t)) : conteudos).slice(0, 30);

      alvo.innerHTML =
        '<div class="mb"><input class="campo" id="md-busca" placeholder="Buscar conteúdo…" ' +
        'value="' + esc(termo || '') + '"></div>' +
        (lista.length
          ? '<div class="md-lista">' + lista.map(c =>
              '<button class="md-cont' + (escolhido && escolhido.id === c.id ? ' on' : '') +
              '" data-cont="' + esc(c.id) + '">' +
              '<span class="ic">' + (D().ICONE[c.tipo] || D().ICONE.Outro) + '</span>' +
              '<span class="tx"><b>' + esc(c.titulo || 'Sem título') + '</b>' +
              '<small>' + esc(c.tipo) +
                (c.data_postagem ? ' · ' + B7.UI.dataBR(c.data_postagem) : '') +
                (c.canal ? ' · ' + esc(c.canal) : '') + '</small></span></button>').join('') +
            '</div>'
          : '<div class="vazio-leve">Nenhum conteúdo encontrado.' +
            (r.linha_id ? '' : ' Este cliente não tem linha editorial vinculada.') + '</div>') +

        camposComuns();

      const busca = alvo.querySelector('#md-busca');
      busca.oninput = B7.UI.debounce(() => {
        const pos = busca.selectionStart;
        corpoConteudo(busca.value).then(() => {
          const n = m.querySelector('#md-busca');
          if (n) { n.focus(); n.setSelectionRange(pos, pos); }
        });
      }, 250);
      alvo.querySelectorAll('[data-cont]').forEach(b => b.onclick = () => {
        escolhido = lista.find(c => c.id === b.dataset.cont);
        alvo.querySelectorAll('.md-cont').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        const campoTitulo = m.querySelector('#md-titulo');
        if (campoTitulo && escolhido) campoTitulo.value = escolhido.titulo || '';
        const campoData = m.querySelector('#md-data');
        if (campoData && escolhido && escolhido.data_postagem && !campoData.value) {
          campoData.value = escolhido.data_postagem;
        }
        const campoFormato = m.querySelector('#md-formato');
        if (campoFormato && escolhido && escolhido.tipo && FORMATOS_DEMANDA.includes(escolhido.tipo)) {
          campoFormato.value = escolhido.tipo;
          campoFormato.onchange();
        }
      });
      ligarCamposComuns();
    }

    function camposComuns() {
      const data = dataPadrao || r.semana_inicio;
      return '<div class="linha mb">' +
          '<div><label class="rot">TÍTULO</label>' +
            '<input class="campo" id="md-titulo" placeholder="O que será feito"></div>' +
          '<div><label class="rot" id="md-rot-data">DATA DE POSTAGEM</label>' +
            '<input class="campo" type="date" id="md-data" value="' + esc(data) + '" ' +
            'min="' + esc(r.semana_inicio) + '" max="' + esc(r.semana_fim) + '"></div>' +
        '</div>' +
        '<div class="linha mb" id="md-data-postagem-wrap" hidden>' +
          '<div><label class="rot">DATA DE POSTAGEM <span class="leve">— opcional, se diferente da gravação</span></label>' +
            '<input class="campo" type="date" id="md-data-postagem" ' +
            'min="' + esc(r.semana_inicio) + '" max="' + esc(r.semana_fim) + '"></div>' +
        '</div>' +
        '<div class="linha mb">' +
          '<div><label class="rot">FORMATO <span class="leve">— opcional</span></label>' +
            '<select class="campo" id="md-formato">' +
              '<option value="">Nenhum específico</option>' +
              FORMATOS_DEMANDA.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">ETAPA</label><select class="campo" id="md-etapa">' +
            ETAPAS.map(e => '<option>' + e + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div class="mb"><label class="rot" id="md-rot-situacao">SITUAÇÃO</label>' +
          '<select class="campo" id="md-situacao"></select></div>' +
        '<div class="mb"><label class="rot">OBSERVAÇÃO PARA O CLIENTE ' +
          '<span class="leve">— opcional</span></label>' +
          '<textarea class="campo cresce" rows="2" id="md-obs"></textarea></div>';
    }

    function ligarCamposComuns() {
      const etapa = m.querySelector('#md-etapa');
      const formato = m.querySelector('#md-formato');
      const situacao = m.querySelector('#md-situacao');
      const rotData = m.querySelector('#md-rot-data');
      const rotSituacao = m.querySelector('#md-rot-situacao');
      const wrapPostagem = m.querySelector('#md-data-postagem-wrap');
      if (!etapa || !situacao) return;
      const preencher = () => {
        const contexto = D().contextoDe({ formato: formato.value || null, etapa: etapa.value });
        const opcoes = D().estagiosDe(contexto);
        situacao.innerHTML = opcoes.map(v => '<option>' + v + '</option>').join('');
        situacao.value = opcoes[0];
        if (rotSituacao) rotSituacao.textContent = 'SITUAÇÃO — ' + contexto;
        const ehReel = formato.value === 'Reel';
        if (wrapPostagem) wrapPostagem.hidden = !ehReel;
        if (rotData) rotData.textContent = (ehReel || etapa.value === 'Gravação')
          ? 'DATA DE GRAVAÇÃO' : 'DATA DE POSTAGEM';
      };
      etapa.onchange = preencher;
      if (formato) formato.onchange = preencher;
      preencher();
    }

    function corpoAvulsa() {
      m.querySelector('#md-corpo').innerHTML =
        '<div class="ajuda mb">Uma reunião, uma gravação, um envio para aprovação — ' +
        'nada disso precisa virar conteúdo na linha editorial.</div>' + camposComuns();
      ligarCamposComuns();
      const etapa = m.querySelector('#md-etapa');
      if (etapa) { etapa.value = 'Reunião'; etapa.onchange(); }
    }

    m.querySelectorAll('#md-tipo [data-tipo]').forEach(b => b.onclick = () => {
      m.querySelectorAll('#md-tipo button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      tipo = b.dataset.tipo;
      escolhido = null;
      if (tipo === 'conteudo') corpoConteudo(''); else corpoAvulsa();
    });
    await corpoConteudo('');

    m.querySelector('[data-ok]').onclick = async () => {
      const titulo = m.querySelector('#md-titulo').value.trim() ||
                     (escolhido ? escolhido.titulo : '');
      if (!titulo) return m.querySelector('#md-titulo').focus();
      const data = m.querySelector('#md-data').value || null;
      try {
        const irmaos = S.itens.filter(x => x.data === data);
        const formatoEscolhido = m.querySelector('#md-formato').value || null;
        const campoPostagem = m.querySelector('#md-data-postagem');
        const novo = await B7.Save.acao(() => B7.DB.criarItem({
          report_id: r.id, data: data, position: irmaos.length,
          titulo: titulo,
          etapa: m.querySelector('#md-etapa').value,
          situacao: m.querySelector('#md-situacao').value,
          observacao: m.querySelector('#md-obs').value.trim(),
          canal: escolhido && tipo === 'conteudo' ? (escolhido.canal || null) : null,
          /* o formato do seletor manda sempre — inicialmente vem do
             conteúdo escolhido, mas a pessoa pode ajustar (ex.: marcar
             como "Capa de Reel" uma demanda sobre a capa de um Reel). */
          formato: formatoEscolhido,
          data_postagem: (formatoEscolhido === 'Reel' && campoPostagem && campoPostagem.value)
            ? campoPostagem.value : null,
          content_id: escolhido && tipo === 'conteudo' ? escolhido.id : null,
          script_id: escolhido && tipo === 'conteudo' ? (escolhido.script_id || null) : null,
          origem: escolhido && tipo === 'conteudo' ? 'linha_editorial' : 'manual',
          source_snapshot: escolhido && tipo === 'conteudo'
            ? { titulo: escolhido.titulo, data_postagem: escolhido.data_postagem,
                canal: escolhido.canal, tipo: escolhido.tipo } : {}
        }), 'Demanda adicionada');
        S.itens.push(novo);
        B7.DB.registrar({ tipo: 'criar', entidade: 'status', id: r.id, cliente: r.client_id,
          texto: 'Demanda adicionada ao status semanal: ' + titulo });
        m.fechar();
        render();
      } catch (e) {}
    };
  }

  /* =================================================================
     EXPORTAÇÃO
     O progresso mostrado é o real: render por página, depois a montagem
     do arquivo. Não dizemos "baixado" — o navegador é quem decide o que
     faz com o arquivo depois que a gente dispara o download.
     ================================================================= */
  function modalExportar() {
    const r = S.relatorio;
    const m = B7.UI.modal('<h3>Exportar status semanal</h3>' +
      '<div class="sub">' + esc(r.cliente_nome) + ' · ' +
      esc(D().periodoTexto(r.semana_inicio, r.semana_fim)) + '</div>' +

      '<label class="rot">FORMATO</label>' +
      '<div class="grade-formatos exp-formatos">' +
        '<button class="opcao-formato on" data-fmt="png">' +
          '<b>PNG 4:5</b><small>imagem pronta para o WhatsApp</small></button>' +
        '<button class="opcao-formato" data-fmt="pdf">' +
          '<b>PDF 4:5</b><small>arquivo para anexar ou arquivar</small></button>' +
      '</div>' +

      '<details class="exp-avancado"><summary>Opções</summary>' +
        '<label class="op-mini on" id="ex-alta"><input type="checkbox">' +
          '<span>Alta resolução <small>2160 × 2700 · arquivo maior</small></span></label>' +
        '<label class="op-mini' + (r.mostrar_dias_vazios !== false ? ' on' : '') + '" id="ex-vazios">' +
          '<input type="checkbox"' + (r.mostrar_dias_vazios !== false ? ' checked' : '') + '>' +
          '<span>Mostrar dias sem atividades</span></label>' +
        '<label class="op-mini' + (r.mostrar_observacoes !== false ? ' on' : '') + '" id="ex-obs">' +
          '<input type="checkbox"' + (r.mostrar_observacoes !== false ? ' checked' : '') + '>' +
          '<span>Incluir observações</span></label>' +
        '<label class="op-mini' + (mostrarConcluidos() ? ' on' : '') + '" id="ex-concluidos">' +
          '<input type="checkbox"' + (mostrarConcluidos() ? ' checked' : '') + '>' +
          '<span>Mostrar itens concluídos</span></label>' +
        '<div class="mb" style="margin-top:10px"><label class="rot">LEGENDA</label>' +
          '<select class="campo" id="ex-legenda">' +
            '<option value="auto">Automática</option>' +
            '<option value="sim">Sempre incluir</option>' +
            '<option value="nao">Não incluir</option>' +
          '</select></div>' +
        '<div class="mb" style="margin-top:10px"><label class="rot">MOSTRAR ATIVIDADES</label>' +
          '<select class="campo" id="ex-periodo">' +
            '<option value="toda_semana"' + (mostrarAPartirDeHoje() ? '' : ' selected') + '>Toda a semana</option>' +
            '<option value="a_partir_hoje"' + (mostrarAPartirDeHoje() ? ' selected' : '') + '>A partir de hoje</option>' +
          '</select></div>' +
      '</details>' +

      '<div class="exp-progresso" id="ex-prog"></div>' +

      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b" data-mensagem>Copiar mensagem</button>' +
      '<button class="b pri" data-ok>Baixar PNG</button></div>');

    let formato = 'png';
    m.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-fmt]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      formato = b.dataset.fmt;
      m.querySelector('[data-ok]').textContent = formato === 'png' ? 'Baixar PNG' : 'Baixar PDF';
    });
    m.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () =>
      cx.closest('.op-mini').classList.toggle('on', cx.checked));

    m.querySelector('[data-mensagem]').onclick = async () => {
      const texto = 'Olá! Segue o acompanhamento das demandas desta semana, de ' +
        D().periodoTexto(r.semana_inicio, r.semana_fim).replace(' · ', ' de ') +
        '. Qualquer atualização, estamos à disposição.';
      try {
        await navigator.clipboard.writeText(texto);
        B7.UI.toast('Mensagem copiada');
      } catch (e) {
        B7.UI.toast('Não foi possível copiar', { tipo: 'erro' });
      }
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const botao = m.querySelector('[data-ok]');
      const prog = m.querySelector('#ex-prog');
      botao.disabled = true;
      prog.textContent = 'Preparando documento…';

      const opcoes = {
        alta: m.querySelector('#ex-alta input').checked,
        mostrarDiasVazios: m.querySelector('#ex-vazios input').checked,
        mostrarObservacoes: m.querySelector('#ex-obs input').checked,
        mostrarLegenda: m.querySelector('#ex-legenda').value,
        mostrarConcluidos: m.querySelector('#ex-concluidos input').checked,
        somenteAPartirDeHoje: m.querySelector('#ex-periodo').value === 'a_partir_hoje'
      };
      const aoAndar = (fase) => {
        prog.textContent = fase === 'render' ? 'Renderizando documento…' : 'Gerando arquivo…';
      };

      try {
        const ctx = await B7.BaixarSemana.reunir(r.id);
        formato === 'png'
          ? await B7.BaixarSemana.gerarPNG(ctx, opcoes, aoAndar)
          : await B7.BaixarSemana.gerarPDF(ctx, opcoes, aoAndar);

        /* snapshot do que foi exportado: é o histórico de versões */
        const versao = await B7.DB.criarVersao(r.id, formato, {
          relatorio: ctx.relatorio, itens: ctx.itens, opcoes: opcoes
        }).catch(() => null);

        prog.textContent = 'Download iniciado.';
        B7.DB.registrar({ tipo: 'exportar', entidade: 'status', id: r.id,
          cliente: r.client_id,
          texto: 'Status semanal exportado em ' + formato.toUpperCase() +
                 (versao ? ' · V' + String(versao.versao).padStart(2, '0') : '') });
        B7.UI.toast(formato.toUpperCase() + ' gerado.');
        setTimeout(() => m.fechar(), 900);
      } catch (e) {
        console.error(e);
        botao.disabled = false;
        prog.textContent = '';
        B7.UI.toast('Não foi possível gerar o arquivo', { tipo: 'erro' });
      }
    };
  }

  /* =================================================================
     DUPLICAR SEMANA
     Situações não vêm junto: "Publicado" da semana passada não é verdade
     na semana nova. Tudo volta para Previsto.
     ================================================================= */
  function modalDuplicar() {
    const r = S.relatorio;
    const sugerido = somarDias(r.semana_inicio, 7);
    const m = B7.UI.modal('<h3>Duplicar para outra semana</h3>' +
      '<div class="sub">As demandas escolhidas são recriadas com situação ' +
      '<b>Previsto</b>. Nada é copiado como concluído ou publicado.</div>' +
      '<div class="mb"><label class="rot">INÍCIO DA NOVA SEMANA</label>' +
        '<input class="campo" type="date" id="dp-inicio" value="' + sugerido + '">' +
        '<div class="ajuda" id="dp-periodo"></div></div>' +
      '<label class="rot">O QUE COPIAR</label>' +
      '<div class="lista-copiar">' +
        '<label class="op-copiar on"><input type="checkbox" data-copiar="demandas" checked>' +
          '<span><b>Demandas</b><small>títulos, etapas e canais; as datas andam sete dias</small></span></label>' +
        '<label class="op-copiar"><input type="checkbox" data-copiar="observacoes">' +
          '<span><b>Observações</b><small>as observações escritas para o cliente</small></span></label>' +
        '<label class="op-copiar on"><input type="checkbox" data-copiar="preferencias" checked>' +
          '<span><b>Preferências de apresentação</b></span></label>' +
      '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Duplicar</button></div>');

    const campo = m.querySelector('#dp-inicio');
    const mostrar = () => {
      m.querySelector('#dp-periodo').textContent =
        campo.value ? D().periodoTexto(campo.value, somarDias(campo.value, 6)) : '';
    };
    campo.onchange = mostrar; mostrar();
    m.querySelectorAll('[data-copiar]').forEach(cx => cx.onchange = () =>
      cx.closest('.op-copiar').classList.toggle('on', cx.checked));

    m.querySelector('[data-ok]').onclick = async () => {
      const ini = campo.value;
      if (!ini) return;
      const quer = k => m.querySelector('[data-copiar="' + k + '"]').checked;
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true; botao.textContent = 'Duplicando…';
      try {
        const existente = await B7.DB.statusDaSemana(r.client_id, ini).catch(() => null);
        if (existente) {
          botao.disabled = false; botao.textContent = 'Duplicar';
          return B7.UI.toast('Já existe um status para essa semana', { tipo: 'erro' });
        }
        const dados = {
          client_id: r.client_id, linha_id: r.linha_id,
          semana_inicio: ini, semana_fim: somarDias(ini, 6)
        };
        if (quer('preferencias')) {
          dados.mostrar_dias_vazios = r.mostrar_dias_vazios;
          dados.mostrar_observacoes = r.mostrar_observacoes;
          dados.mostrar_legenda = r.mostrar_legenda;
        }
        const nova = await B7.Save.acao(() => B7.DB.criarStatus(dados), 'Semana duplicada');

        if (quer('demandas') && S.itens.length) {
          const desloca = 7;
          await B7.DB.criarItens(S.itens.map((it, i) => ({
            report_id: nova.id,
            data: it.data ? somarDias(it.data, desloca) : null,
            data_postagem: it.data_postagem ? somarDias(it.data_postagem, desloca) : null,
            position: it.position || i,
            titulo: it.titulo, etapa: it.etapa,
            situacao: D().estagiosDe(D().contextoDe(it))[0], /* nunca herda o estado antigo */
            observacao: quer('observacoes') ? it.observacao : null,
            canal: it.canal, formato: it.formato,
            content_id: it.content_id, script_id: it.script_id,
            origem: it.origem, source_snapshot: it.source_snapshot
          })));
        }
        B7.DB.registrar({ tipo: 'criar', entidade: 'status', id: nova.id, cliente: r.client_id,
          texto: 'Status semanal duplicado: ' + D().periodoTexto(ini, somarDias(ini, 6)) });
        m.fechar();
        location.hash = '#/semana/' + nova.id;
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Duplicar';
      }
    };
  }

  /* =================================================================
     VERSÕES EXPORTADAS
     ================================================================= */
  async function modalVersoes() {
    const versoes = await B7.DB.listarVersoes(S.relatorio.id).catch(() => []);
    B7.UI.modal('<h3>Versões exportadas</h3>' +
      '<div class="sub">Cada exportação guarda um retrato do relatório naquele momento.</div>' +
      (versoes.length
        ? '<div class="lista-versoes">' + versoes.map(v =>
            '<div class="lv-item"><b>V' + String(v.versao).padStart(2, '0') + '</b>' +
            '<span>' + esc(B7.UI.dataBR(v.created_at)) + ' · ' +
            esc(new Date(v.created_at).toLocaleTimeString('pt-BR',
              { hour: '2-digit', minute: '2-digit' })) + '</span>' +
            '<span class="fmt">' + esc((v.formato || '').toUpperCase()) + '</span></div>').join('') +
          '</div>'
        : '<div class="vazio-leve">Nenhuma exportação ainda. A primeira vira a V01.</div>') +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
  }

  /* =================================================================
     QUICK VIEW — resumo sem abrir o editor
     ================================================================= */
  async function quickView(id) {
    let r, itens;
    try {
      r = await B7.DB.status(id);
      itens = await B7.DB.listarItens(id);
    } catch (e) { return B7.UI.toast('Não foi possível abrir', { tipo: 'erro' }); }

    const porDia = {};
    itens.forEach(i => { (porDia[i.data] = porDia[i.data] || []).push(i); });
    const dias = D().diasDoPeriodo(r.semana_inicio, r.semana_fim);

    const m = B7.UI.modal('<h3>' + esc(r.cliente_nome) + '</h3>' +
      '<div class="sub">' + esc(D().periodoTexto(r.semana_inicio, r.semana_fim)) + ' · ' +
      itens.length + (itens.length === 1 ? ' demanda' : ' demandas') +
      ' · ' + esc(r.situacao || 'Rascunho') + '</div>' +
      '<div class="qv-dias">' + dias.map(d => {
        const doDia = porDia[d] || [];
        return '<div class="qv-dia"><b>' + D().DIAS[D().diaDaSemana(d)] + ' · ' +
          D().curto(d) + '</b>' +
          (doDia.length
            ? '<div>' + doDia.map(i =>
                '<span class="qv-item"><span class="ps-ponto" style="background:' +
                D().corSituacao(i.situacao) + '"></span>' +
                esc(i.titulo || 'Sem título') + '</span>').join('') + '</div>'
            : '<span class="qv-vazio">sem atividades</span>') + '</div>';
      }).join('') + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button>' +
      '<button class="b pri" data-abrir-editor>Abrir editor</button></div>', { larga: true });

    m.querySelector('[data-abrir-editor]').onclick = () => {
      m.fechar();
      location.hash = '#/semana/' + id;
    };
  }

  return { abrirLista, abrir, modalNovo };
})();
