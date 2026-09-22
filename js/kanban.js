/* =====================================================================
   KANBAN DE PRODUÇÃO — interno da equipe

   O card guarda o vínculo com o material, nunca uma cópia dele. Abrir a
   demanda de um roteiro leva ao editor do roteiro; o texto continua
   morando lá.

   Colunas: A fazer · Em produção · Revisão interna · Aguardando cliente ·
   Ajustes · Pronto · Concluída.
     Pronto    = a produção criativa terminou (o cliente aprovou), mas
                 ainda existe etapa depois: gravar, editar, publicar.
     Concluída = não há mais nada a fazer. Sai do quadro do dia a dia e
                 fica visível pelo botão "Concluídas".
   Status de produção ≠ status de aprovação: o card mostra os dois, e
   "aprovado pelo cliente" nunca vira "concluída" sozinho.

   A automação vem do banco (aprov_processar_evento + trigger
   kanban_evento_parte): enviar → Aguardando cliente; pedido de ajuste
   (por cena ou do todo) → Ajustes, agregando os pedidos do mesmo ciclo
   na MESMA demanda; reenvio → Aguardando cliente; aprovação → Pronto.
   Aqui só se desenha o que o banco decidiu.

   Arrastar é a forma rápida, não a única: cada card tem "Mover para…"
   para teclado e celular. O quadro rola na horizontal dentro de um
   viewport próprio, sem a barra nativa; no celular mostra uma coluna
   por vez.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Kanban = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');

  const COLUNAS = [
    ['a_fazer',            'A fazer',            'ainda não começou'],
    ['producao',           'Em produção',        'sendo feito agora'],
    ['revisao',            'Revisão interna',    'a equipe confere antes de enviar'],
    ['aguardando_cliente', 'Aguardando cliente', 'enviado, esperando decisão'],
    ['ajustes',            'Ajustes',            'o cliente pediu mudanças'],
    ['pronto',             'Pronto',             'aprovado; falta gravar ou publicar'],
    ['concluida',          'Concluída',          'nada mais a fazer']
  ];
  const PRINCIPAIS = COLUNAS.filter(c => c[0] !== 'concluida');
  const nomeColuna = c => (COLUNAS.find(x => x[0] === c) || [, c])[1];

  const TIPOS = [
    ['producao', 'Produção'], ['video', 'Vídeo'], ['design', 'Design'],
    ['gravacao', 'Gravação'], ['reuniao', 'Reunião'],
    ['entrega', 'Entrega'], ['ajuste', 'Ajuste'], ['outro', 'Outro']
  ];
  const VINCULOS = { roteiro: 'Roteiro', linha: 'Linha editorial', conteudo: 'Conteúdo', gravacao: 'Gravação' };
  const ORIGEM_CLIENTE = ['parte.ajustes', 'aprovacao.ajustes', 'aprovacao.recusada'];
  const rotuloAprov = s => (B7.Aprovacoes && B7.Aprovacoes.rotulo) ? B7.Aprovacoes.rotulo(s) : s;

  let dados = [], clientes = [], equipe = [];
  const F_PADRAO = { cliente: '', responsavel: '', tipo: '', prazo: '', busca: '',
                     vista: 'quadro', concluidas: false, colunaMovel: 'a_fazer',
                     ordem: 'coluna', ordemDir: 1 };
  let F = Object.assign({}, F_PADRAO);
  /* os filtros sobrevivem à navegação dentro da sessão */
  try { Object.assign(F, JSON.parse(sessionStorage.getItem('b7.kanban.filtros') || '{}')); } catch (e) {}
  function guardarFiltros() {
    try { sessionStorage.setItem('b7.kanban.filtros', JSON.stringify(F)); } catch (e) {}
  }

  const ehMovel = () => window.matchMedia('(max-width: 760px)').matches;

  /* =================================================================
     TELA
     ================================================================= */
  async function abrir() {
    B7.Dashboard.marcarNav('#/kanban');
    B7.Rota.titulo(['Produção']);
    painel().innerHTML = '<div class="conteudo kanban-tela">' +
      '<div class="cab-conteudo"><div><h1>Produção</h1>' +
      '<p>As demandas da equipe. O cliente não vê esta área.</p></div></div>' +
      B7.UI.skeleton('tabela', { n: 6, cols: 4 }) + '</div>';

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
        '<p>Se o sistema acabou de ser atualizado, rode migration_kanban_v2.sql no Supabase.</p>' +
        '</div></div>';
    }
    desenhar();
    assinar();

    /* #/kanban/<id> abre a demanda direto (link vindo das aprovações) */
    const alvo = (location.hash.split('?')[0].split('/')[2] || '');
    if (alvo && dados.find(d => d.id === alvo)) abrirDetalhe(alvo);
  }

  function desenhar() {
    painel().innerHTML = '<div class="conteudo entra kanban-tela">' +
      '<div class="cab-conteudo"><div><h1>Produção</h1>' +
      '<p>As demandas da equipe. O cliente não vê esta área.</p></div>' +
      '<button class="b pri" id="kb-nova">+ Nova demanda</button></div>' +
      '<div id="kb-barra"></div>' +
      '<div id="kb-area"></div>' +
    '</div>';
    painel().querySelector('#kb-nova').onclick = () => modalDemanda(null);
    desenharBarra();
    desenharArea();
  }

  /* =================================================================
     FILTROS — barra compacta; "Limpar filtros" só quando há filtro
     ================================================================= */
  function filtrosAtivos() {
    return !!(F.cliente || F.responsavel || F.tipo || F.prazo || F.busca.trim());
  }

  function desenharBarra() {
    const cx = painel().querySelector('#kb-barra');
    if (!cx) return;
    const opc = (chave, atual, itens, rotulo) =>
      '<select class="campo fina kb-filtro' + (atual ? ' ativo' : '') + '" data-filtro="' + chave + '" aria-label="' + esc(rotulo) + '">' +
      itens.map(([v, r]) =>
        '<option value="' + esc(v) + '"' + (atual === v ? ' selected' : '') + '>' +
        esc(r) + '</option>').join('') + '</select>';

    const concluidas = dados.filter(d => d.coluna === 'concluida').length;
    cx.innerHTML = '<div class="kb-barra">' +
      '<div class="kb-busca-cx"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>' +
        '<input class="campo fina kb-busca" id="kb-busca" placeholder="Buscar demanda ou cliente…" ' +
        'value="' + esc(F.busca) + '" aria-label="Buscar"></div>' +
      opc('cliente', F.cliente, [['', 'Cliente']].concat(clientes.map(c => [c.id, c.nome])), 'Cliente') +
      opc('responsavel', F.responsavel, [['', 'Responsável'], ['sem', 'Sem responsável']]
        .concat(equipe.map(p => [p.id, p.nome])), 'Responsável') +
      opc('tipo', F.tipo, [['', 'Tipo'], ['vinc:roteiro', 'Roteiro'], ['vinc:linha', 'Linha editorial'],
        ['vinc:conteudo', 'Conteúdo'], ['vinc:gravacao', 'Gravação']]
        .concat(TIPOS.filter(t => t[0] !== 'producao').map(([v, r]) => ['tipo:' + v, r])), 'Tipo') +
      opc('prazo', F.prazo, [['', 'Prazo'], ['atrasadas', 'Atrasadas'], ['hoje', 'Para hoje'],
        ['semana', 'Próximos 7 dias'], ['sem', 'Sem prazo']], 'Prazo') +
      (filtrosAtivos()
        ? '<button class="b fina contorno kb-limpar" id="kb-limpar">Limpar filtros</button>' : '') +
      '<div class="kb-espaco"></div>' +
      '<span class="kb-total" id="kb-total"></span>' +
      '<button class="b fina kb-concluidas' + (F.concluidas ? ' on' : '') + '" id="kb-concluidas" ' +
        'aria-pressed="' + (F.concluidas ? 'true' : 'false') + '" title="Concluídas nos últimos 30 dias">' +
        'Concluídas <b>' + concluidas + '</b></button>' +
      '<div class="seg-vista" role="tablist">' +
        '<button role="tab" class="' + (F.vista === 'quadro' ? 'on' : '') + '" data-vista="quadro">Quadro</button>' +
        '<button role="tab" class="' + (F.vista === 'lista' ? 'on' : '') + '" data-vista="lista">Lista</button>' +
      '</div>' +
    '</div>';

    const busca = cx.querySelector('#kb-busca');
    let t;
    busca.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => { F.busca = busca.value; guardarFiltros(); desenharArea(); atualizarLimpar(); }, 220);
    };
    cx.querySelectorAll('[data-filtro]').forEach(s => s.onchange = () => {
      F[s.dataset.filtro] = s.value; guardarFiltros();
      s.classList.toggle('ativo', !!s.value);
      desenharArea(); atualizarLimpar();
    });
    cx.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => {
      F.vista = b.dataset.vista; guardarFiltros();
      cx.querySelectorAll('[data-vista]').forEach(x => x.classList.toggle('on', x === b));
      desenharArea();
    });
    cx.querySelector('#kb-concluidas').onclick = () => {
      F.concluidas = !F.concluidas; guardarFiltros(); desenharBarra(); desenharArea();
    };
    const limpar = cx.querySelector('#kb-limpar');
    if (limpar) limpar.onclick = () => {
      F.cliente = F.responsavel = F.tipo = F.prazo = F.busca = '';
      guardarFiltros(); desenharBarra(); desenharArea();
    };
  }

  /* o botão "Limpar filtros" aparece e some sem redesenhar a barra inteira
     (o campo de busca manteria o foco perdido) */
  function atualizarLimpar() {
    const cx = painel().querySelector('.kb-barra');
    if (!cx) return;
    const existe = cx.querySelector('#kb-limpar');
    if (filtrosAtivos() && !existe) {
      const b = document.createElement('button');
      b.className = 'b fina contorno kb-limpar'; b.id = 'kb-limpar'; b.textContent = 'Limpar filtros';
      b.onclick = () => { F.cliente = F.responsavel = F.tipo = F.prazo = F.busca = '';
        guardarFiltros(); desenharBarra(); desenharArea(); };
      cx.insertBefore(b, cx.querySelector('.kb-espaco'));
    } else if (!filtrosAtivos() && existe) existe.remove();
  }

  /* contagens da barra sem redesenhá-la (a busca manteria o foco perdido) */
  function atualizarContagens() {
    const b = painel().querySelector('#kb-concluidas b');
    if (b) b.textContent = dados.filter(d => d.coluna === 'concluida').length;
  }

  function filtrar(lista) {
    const t = F.busca.trim().toLowerCase();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7 = new Date(hoje); em7.setDate(hoje.getDate() + 7);
    return lista.filter(d => {
      if (d.arquivada_em || d.deleted_at) return false;
      if (d.coluna === 'concluida' && !F.concluidas) return false;
      if (F.cliente && d.client_id !== F.cliente) return false;
      if (F.responsavel === 'sem' && d.responsavel_id) return false;
      if (F.responsavel && F.responsavel !== 'sem' && d.responsavel_id !== F.responsavel) return false;
      if (F.tipo) {
        const [k, v] = F.tipo.split(':');
        if (k === 'vinc' && d.tipo_vinculo !== v) return false;
        if (k === 'tipo' && d.tipo !== v) return false;
      }
      if (F.prazo) {
        const p = d.prazo ? new Date(d.prazo + 'T00:00:00') : null;
        if (F.prazo === 'sem' && p) return false;
        if (F.prazo !== 'sem' && !p) return false;
        if (F.prazo === 'atrasadas' && !(p < hoje && !d.concluida_em)) return false;
        if (F.prazo === 'hoje' && p.getTime() !== hoje.getTime()) return false;
        if (F.prazo === 'semana' && !(p >= hoje && p <= em7)) return false;
      }
      if (t && !(d.titulo || '').toLowerCase().includes(t) &&
               !(d.cliente_nome || '').toLowerCase().includes(t) &&
               !(d.responsavel_nome || '').toLowerCase().includes(t)) return false;
      return true;
    });
  }

  /* =================================================================
     ÁREA — quadro ou lista, sobre os mesmos dados
     ================================================================= */
  function desenharArea() {
    const area = painel().querySelector('#kb-area');
    if (!area) return;
    const vis = filtrar(dados);
    const total = painel().querySelector('#kb-total');
    if (total) total.textContent = vis.length + (vis.length === 1 ? ' demanda' : ' demandas');

    /* guarda a rolagem horizontal para um redesenho não "pular" o quadro */
    const rolAntes = area.querySelector('#kb-rol');
    const scrollX = rolAntes ? rolAntes.scrollLeft : 0;

    area.innerHTML = F.vista === 'lista' ? lista(vis) : quadro(vis);
    ligar(area);

    const rol = area.querySelector('#kb-rol');
    if (rol) { rol.scrollLeft = scrollX; ligarViewport(area); }
    const chip = area.querySelector('.kb-movel-sel .on');
    if (chip && chip.scrollIntoView) { try { chip.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} }
  }

  /* =================================================================
     QUADRO
     ================================================================= */
  function quadro(vis) {
    const cols = F.concluidas ? COLUNAS : PRINCIPAIS;
    const movel = ehMovel();
    if (movel && !cols.find(c => c[0] === F.colunaMovel)) F.colunaMovel = cols[0][0];

    const coluna = ([id, rotulo, ajuda]) => {
      const itens = vis.filter(d => d.coluna === id)
        .sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
      return '<section class="kb-col" data-coluna="' + id + '" aria-label="' + esc(rotulo) + '">' +
        '<header><div><b>' + esc(rotulo) + '</b><small>' + esc(ajuda) + '</small></div>' +
        '<span class="kb-cont">' + itens.length + '</span></header>' +
        '<div class="kb-lista" data-drop="' + id + '">' +
          itens.map(cartao).join('') +
          (itens.length ? '' : '<div class="kb-vazio">nada aqui</div>') +
        '</div>' +
      '</section>';
    };

    if (movel) {
      /* celular: uma coluna por vez, seletor em cima */
      return '<div class="kb-movel">' +
        '<div class="kb-movel-sel" role="tablist" aria-label="Coluna">' +
          cols.map(([id, rotulo]) => {
            const n = vis.filter(d => d.coluna === id).length;
            return '<button role="tab" data-col-movel="' + id + '" class="' + (F.colunaMovel === id ? 'on' : '') +
              '" aria-selected="' + (F.colunaMovel === id) + '">' + esc(rotulo) + '<b>' + n + '</b></button>';
          }).join('') +
        '</div>' +
        coluna(cols.find(c => c[0] === F.colunaMovel)) +
      '</div>';
    }

    return '<div class="kb-viewport" id="kb-vp">' +
      '<button class="kb-seta esq" data-seta="-1" aria-label="Colunas anteriores" hidden>' +
        '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="kb-rolagem" id="kb-rol" tabindex="0" aria-label="Quadro de produção; use as setas para rolar">' +
        '<div class="kb-quadro' + (F.concluidas ? ' sete' : '') + '">' + cols.map(coluna).join('') + '</div>' +
      '</div>' +
      '<button class="kb-seta dir" data-seta="1" aria-label="Próximas colunas" hidden>' +
        '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>' +
    '</div>';
  }

  function rotuloTipo(d) {
    if (d.tipo_vinculo && VINCULOS[d.tipo_vinculo]) return VINCULOS[d.tipo_vinculo];
    return (TIPOS.find(t => t[0] === d.tipo) || [, 'Produção'])[1];
  }
  function classeTipo(d) {
    return (d.tipo_vinculo && VINCULOS[d.tipo_vinculo]) ? 'v-' + d.tipo_vinculo : (d.tipo || 'producao');
  }
  const doCliente = d => ORIGEM_CLIENTE.includes(d.origem_evento || '') && d.coluna === 'ajustes';
  const pendentes = d => +(d.ajustes_pendentes || 0);

  function cartao(d) {
    const atrasada = d.prazo && !d.concluida_em &&
      new Date(d.prazo + 'T23:59:59') < new Date();
    const n = pendentes(d);
    return '<article class="kb-card' + (d.prioridade === 'alta' ? ' alta' : '') +
      (doCliente(d) ? ' do-cliente' : '') + '" ' +
      'draggable="true" data-demanda="' + esc(d.id) + '" tabindex="0" role="button" ' +
      'aria-label="' + esc(d.titulo) + '">' +
      '<div class="kb-card-topo">' +
        (d.cliente_nome
          ? '<span class="kb-cli">' + B7.UI.avatarCliente(d.cliente_nome, d.cliente_logo, 'xs') +
            '<span>' + esc(d.cliente_nome) + '</span></span>'
          : '<span class="kb-cli sem">Interno</span>') +
        '<button class="kb-mover" data-menu="' + esc(d.id) + '" aria-label="Ações da demanda" aria-haspopup="menu">' +
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button>' +
      '</div>' +
      '<h4>' + esc(d.titulo) + '</h4>' +
      '<div class="kb-tags">' +
        '<span class="kb-tipo ' + esc(classeTipo(d)) + '">' + esc(rotuloTipo(d)) + '</span>' +
        (d.aprovacao_situacao
          ? '<span class="kb-ap ' + esc(d.aprovacao_situacao) + '" title="Aprovação do cliente' +
            (d.aprovacao_versao ? ' (v' + d.aprovacao_versao + ')' : '') + '">' +
            esc(rotuloAprov(d.aprovacao_situacao)) + '</span>' : '') +
      '</div>' +
      (n
        ? '<button class="kb-feedback" data-feedback="' + esc(d.id) + '" title="Ver o feedback do cliente">' +
          '<svg viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/></svg>' +
          n + (n === 1 ? ' ajuste pendente' : ' ajustes pendentes') +
          (doCliente(d) ? '<small>solicitado pelo cliente</small>' : '') + '</button>'
        : (doCliente(d) ? '<div class="kb-origem">Ajuste solicitado pelo cliente</div>' : '')) +
      /* aviso operacional gravado pela anulação de aprovação (v3) */
      (d.aviso ? '<div class="kb-aviso" title="' + esc(d.aviso) + '">⚠ Revisar: aprovação anulada</div>' : '') +
      '<div class="kb-pe">' +
        (d.responsavel_nome
          ? B7.UI.avatarPessoa({ nome: d.responsavel_nome, avatar_url: d.responsavel_avatar }, 'xs')
          : '<span class="kb-sem-resp" title="Sem responsável"></span>') +
        (d.prazo ? '<span class="kb-prazo' + (atrasada ? ' atrasada' : '') + '">' +
          esc(prazoCurto(d.prazo)) + '</span>' : '') +
        '<span class="kb-espaco"></span>' +
        (d.comentarios_abertos ? '<span class="kb-notas" title="Notas internas em aberto">' +
          '<svg viewBox="0 0 24 24"><path d="M5 4h14v12H9l-4 4z"/></svg>' + d.comentarios_abertos + '</span>' : '') +
        (d.automacao_travada ? '<span class="kb-lock" title="Automação travada: a aprovação não move esta demanda">' +
          '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>' : '') +
        (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa'
          ? '<span class="kb-vinc" title="Vinculada a ' + esc(rotuloTipo(d).toLowerCase()) + '">' +
            '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg></span>' : '') +
      '</div>' +
    '</article>';
  }

  function prazoCurto(iso) {
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    const hoje = new Date();
    if (+a === hoje.getFullYear()) return d + '/' + m;
    return d + '/' + m + '/' + a.slice(2);
  }

  /* =================================================================
     LISTA — mesma fonte de dados, outra leitura, ordenável
     ================================================================= */
  function lista(vis) {
    if (!vis.length) {
      return '<div class="estado-b7"><b>Nenhuma demanda com esses filtros.</b>' +
             '<p>Ajuste a busca ou crie a primeira demanda.</p></div>';
    }
    const idx = c => COLUNAS.findIndex(x => x[0] === c);
    const chave = {
      titulo: d => (d.titulo || '').toLowerCase(),
      cliente: d => (d.cliente_nome || '').toLowerCase(),
      coluna: d => idx(d.coluna) * 1e9 + (d.posicao || 0),
      responsavel: d => (d.responsavel_nome || 'zzz').toLowerCase(),
      prazo: d => d.prazo || '9999',
      atualizada: d => d.updated_at || ''
    }[F.ordem] || (d => 0);
    const ordenada = vis.slice().sort((a, b) => {
      const x = chave(a), y = chave(b);
      return (x < y ? -1 : x > y ? 1 : 0) * F.ordemDir;
    });
    const th = (k, r) => '<button class="kb-ord' + (F.ordem === k ? ' on' : '') + '" data-ordem="' + k + '">' +
      esc(r) + (F.ordem === k ? '<i>' + (F.ordemDir > 0 ? '↑' : '↓') + '</i>' : '') + '</button>';

    return '<div class="kb-tabela">' +
      '<div class="kb-th">' + th('titulo', 'Demanda') + th('cliente', 'Cliente') + th('coluna', 'Situação') +
        '<span>Aprovação</span>' + th('responsavel', 'Responsável') + th('prazo', 'Prazo') + '</div>' +
      ordenada.map(d => {
        const n = pendentes(d);
        const atrasada = d.prazo && !d.concluida_em && new Date(d.prazo + 'T23:59:59') < new Date();
        return '<div class="kb-tr' + (doCliente(d) ? ' do-cliente' : '') + '" data-demanda="' + esc(d.id) + '" tabindex="0" role="button">' +
          '<span class="kb-tr-titulo"><b>' + esc(d.titulo) + '</b><small>' + esc(rotuloTipo(d)) +
            (n ? ' · ' + n + (n === 1 ? ' ajuste pendente' : ' ajustes pendentes') : '') + '</small></span>' +
          /* data-rot: no celular a tabela vira cartão (ver kanban.css,
             @media 820px) e cada linha perde a coluna do cabeçalho —
             o rótulo volta como ::before só ali, pra célula solta não
             virar um "—" sem contexto. */
          '<span data-rot="Cliente">' + esc(d.cliente_nome || '—') + '</span>' +
          '<span data-rot="Situação"><i class="kb-chip ' + esc(d.coluna) + '">' + esc(nomeColuna(d.coluna)) + '</i></span>' +
          '<span data-rot="Aprovação">' + (d.aprovacao_situacao
            ? '<i class="kb-ap ' + esc(d.aprovacao_situacao) + '">' + esc(rotuloAprov(d.aprovacao_situacao)) +
              (d.aprovacao_versao ? ' v' + d.aprovacao_versao : '') + '</i>' : '—') + '</span>' +
          '<span data-rot="Responsável">' + esc(d.responsavel_nome || '—') + '</span>' +
          '<span data-rot="Prazo" class="' + (atrasada ? 'kb-prazo atrasada' : '') + '">' + (d.prazo ? esc(B7.UI.dataBR(d.prazo)) : '—') + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* =================================================================
     INTERAÇÕES
     ================================================================= */
  function ligar(area) {
    area.querySelectorAll('[data-demanda]').forEach(el => {
      el.onclick = e => {
        if (e.target.closest('[data-menu]')) return;
        const fb = e.target.closest('[data-feedback]');
        abrirDetalhe(el.dataset.demanda, fb ? 'feedback' : null);
      };
      el.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(el.dataset.demanda); }
        if (e.key === 'm' || e.key === 'M') {
          const b = el.querySelector('[data-menu]'); if (b) { e.preventDefault(); menuCard(b, el.dataset.demanda); }
        }
      };
    });
    area.querySelectorAll('[data-menu]').forEach(b => b.onclick = e => {
      e.stopPropagation(); menuCard(b, b.dataset.menu);
    });
    area.querySelectorAll('[data-col-movel]').forEach(b => b.onclick = () => {
      F.colunaMovel = b.dataset.colMovel; guardarFiltros(); desenharArea();
    });
    area.querySelectorAll('[data-ordem]').forEach(b => b.onclick = () => {
      if (F.ordem === b.dataset.ordem) F.ordemDir = -F.ordemDir;
      else { F.ordem = b.dataset.ordem; F.ordemDir = 1; }
      guardarFiltros(); desenharArea();
    });
    ligarArrastar(area);
  }

  /* menu do card: mover por teclado/toque, abrir material, editar */
  function menuCard(botao, id) {
    const d = dados.find(x => x.id === id);
    if (!d) return;
    const cols = COLUNAS;
    const lista = document.createElement('div');
    lista.className = 'lista solta mostrando kb-menu';
    lista.setAttribute('role', 'menu');
    lista.innerHTML =
      '<button role="menuitem" data-acao="abrir">Abrir demanda</button>' +
      (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa' && d.vinculo_id
        ? '<button role="menuitem" data-acao="material">Abrir ' + esc(rotuloTipo(d).toLowerCase()) + '</button>' : '') +
      '<hr><div class="rot">MOVER PARA</div>' +
      cols.filter(([c]) => c !== d.coluna)
        .map(([c, r]) => '<button role="menuitem" data-para="' + c + '">' + esc(r) + '</button>').join('') +
      '<hr><button role="menuitem" data-acao="editar">Editar</button>';
    document.body.appendChild(lista);

    const r = botao.getBoundingClientRect();
    const alt = lista.offsetHeight, larg = lista.offsetWidth;
    lista.style.position = 'fixed';
    lista.style.left = Math.max(10, Math.min(r.right - larg, window.innerWidth - larg - 10)) + 'px';
    lista.style.top = (r.bottom + alt + 10 < window.innerHeight
      ? r.bottom + 6 : Math.max(10, r.top - alt - 6)) + 'px';

    const fechar = () => { lista.remove(); document.removeEventListener('keydown', tecla); };
    function tecla(e) {
      if (e.key === 'Escape') { fechar(); botao.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const bs = [...lista.querySelectorAll('button')];
        const i = bs.indexOf(document.activeElement);
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
      }
    }
    document.addEventListener('keydown', tecla);
    lista.querySelectorAll('[data-para]').forEach(b => b.onclick = async () => {
      fechar(); await mover(id, b.dataset.para, null);
    });
    lista.querySelectorAll('[data-acao]').forEach(b => b.onclick = () => {
      fechar();
      if (b.dataset.acao === 'abrir') abrirDetalhe(id);
      if (b.dataset.acao === 'editar') modalDemanda(id);
      if (b.dataset.acao === 'material') abrirMaterial(d);
    });
    const primeiro = lista.querySelector('button'); if (primeiro) primeiro.focus();
    setTimeout(() => document.addEventListener('click', fechar, { once: true }), 0);
  }

  /* ---------------------------------------------------- viewport */
  /* Rolagem horizontal própria do quadro: sem a barra nativa, com fades
     nas bordas e setas que só existem quando há o que rolar. */
  function ligarViewport(area) {
    const vp = area.querySelector('#kb-vp'), rol = area.querySelector('#kb-rol');
    if (!vp || !rol) return;
    const setas = vp.querySelectorAll('.kb-seta');

    function estado() {
      const max = rol.scrollWidth - rol.clientWidth;
      const tem = max > 2;
      vp.classList.toggle('tem-esq', tem && rol.scrollLeft > 2);
      vp.classList.toggle('tem-dir', tem && rol.scrollLeft < max - 2);
      setas.forEach(s => {
        s.hidden = !tem;
        s.disabled = s.dataset.seta === '-1' ? rol.scrollLeft <= 2 : rol.scrollLeft >= max - 2;
      });
    }
    rol.addEventListener('scroll', estado, { passive: true });
    setas.forEach(s => s.onclick = () => {
      const col = rol.querySelector('.kb-col');
      const passo = col ? col.offsetWidth + 12 : 280;
      rol.scrollBy({ left: passo * +s.dataset.seta * 2, behavior: 'smooth' });
    });
    /* teclado no viewport (o foco chega por Tab) */
    rol.onkeydown = e => {
      if (e.target !== rol) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); rol.scrollBy({ left: 300, behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); rol.scrollBy({ left: -300, behavior: 'smooth' }); }
    };
    /* roda vertical em cima do quadro rola as colunas quando a página
       não tem para onde ir (Shift+roda continua nativo) */
    rol.addEventListener('wheel', e => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const lista = e.target.closest('.kb-lista');
      if (lista && lista.scrollHeight > lista.clientHeight) return;   /* a coluna rola por conta própria */
      const max = rol.scrollWidth - rol.clientWidth;
      if (max <= 2) return;
      if ((e.deltaY > 0 && rol.scrollLeft < max) || (e.deltaY < 0 && rol.scrollLeft > 0)) {
        e.preventDefault(); rol.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(estado); ro.observe(rol);
      B7.Rota.aoSair(() => ro.disconnect());
    } else window.addEventListener('resize', estado);
    estado();

    /* mudar entre celular e desktop redesenha a área no formato certo */
    if (!ligarViewport.mq) {
      ligarViewport.mq = window.matchMedia('(max-width: 760px)');
      ligarViewport.mq.addEventListener('change', () => { if (painel().querySelector('#kb-area')) desenharArea(); });
    }
  }

  /* ---------------------------------------------------- arrastar */
  function ligarArrastar(raiz) {
    let arrastando = null, marcador = null, autoRolar = null;
    const rol = raiz.querySelector('#kb-rol');

    const limpar = () => {
      raiz.querySelectorAll('.kb-lista').forEach(l => l.classList.remove('sobre'));
      if (marcador) { marcador.remove(); marcador = null; }
      clearInterval(autoRolar); autoRolar = null;
    };

    raiz.querySelectorAll('.kb-card').forEach(card => {
      card.ondragstart = e => {
        arrastando = card.dataset.demanda;
        card.classList.add('arrastando');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.demanda);   /* Firefox exige */
      };
      card.ondragend = () => { card.classList.remove('arrastando'); arrastando = null; limpar(); };
    });

    /* perto da borda do viewport, o quadro rola sozinho */
    if (rol) rol.ondragover = e => {
      const r = rol.getBoundingClientRect(), M = 56;
      const v = e.clientX < r.left + M ? -14 : e.clientX > r.right - M ? 14 : 0;
      if (!v) { clearInterval(autoRolar); autoRolar = null; return; }
      if (!autoRolar) autoRolar = setInterval(() => { rol.scrollLeft += v; }, 16);
    };

    raiz.querySelectorAll('.kb-lista').forEach(zona => {
      zona.ondragover = e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zona.classList.add('sobre');
        /* marcador de posição entre os vizinhos */
        if (!marcador) { marcador = document.createElement('div'); marcador.className = 'kb-marcador'; }
        const cards = [...zona.querySelectorAll('.kb-card:not(.arrastando)')];
        const antes = cards.find(c => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        if (antes) zona.insertBefore(marcador, antes); else zona.appendChild(marcador);
      };
      zona.ondragleave = e => {
        if (!zona.contains(e.relatedTarget)) { zona.classList.remove('sobre'); if (marcador) marcador.remove(); }
      };
      zona.ondrop = async e => {
        e.preventDefault();
        const id = arrastando || e.dataTransfer.getData('text/plain');
        const antes = marcador && marcador.nextElementSibling && marcador.nextElementSibling.classList.contains('kb-card')
          ? marcador.nextElementSibling.dataset.demanda : null;
        limpar();
        if (!id) return;
        await mover(id, zona.dataset.drop, antes);
      };
    });
  }

  /* Calcula a posição entre vizinhos. Números fracionários evitam
     reescrever a coluna inteira a cada movimento. */
  function calcularPosicao(coluna, antesDoId, ignorarId) {
    const naColuna = dados.filter(d => d.coluna === coluna && !d.arquivada_em && d.id !== ignorarId)
      .sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
    if (!naColuna.length) return 1000;
    if (!antesDoId) return (naColuna[naColuna.length - 1].posicao || 0) + 1000;
    const i = naColuna.findIndex(d => d.id === antesDoId);
    if (i < 0) return (naColuna[naColuna.length - 1].posicao || 0) + 1000;
    if (i === 0) return (naColuna[0].posicao || 1000) / 2;
    return ((naColuna[i - 1].posicao || 0) + (naColuna[i].posicao || 0)) / 2;
  }

  /* Movimentos entram numa fila: dois arrastos rápidos não disputam a
     mesma linha, e cada um só é confirmado depois do banco responder. */
  let fila = Promise.resolve();
  const emMovimento = new Set();
  function mover(id, coluna, antesDoId) {
    const d = dados.find(x => x.id === id);
    if (!d) return Promise.resolve();
    const posicao = calcularPosicao(coluna, antesDoId, id);

    /* otimista na tela, confirmado no banco: se falhar, volta e avisa —
       nada de "salvo" antes da confirmação */
    const anterior = { coluna: d.coluna, posicao: d.posicao, concluida_em: d.concluida_em };
    d.coluna = coluna; d.posicao = posicao;
    d.concluida_em = coluna === 'concluida' ? (d.concluida_em || new Date().toISOString()) : null;
    emMovimento.add(id);
    desenharArea();

    fila = fila.then(async () => {
      try {
        const linha = await B7.DB.moverDemanda(id, coluna, posicao);
        if (linha) Object.assign(d, { coluna: linha.coluna, posicao: linha.posicao,
                                      concluida_em: linha.concluida_em, updated_at: linha.updated_at });
        /* precisão acabou? renormaliza a coluna (raro: muitas inserções no mesmo ponto) */
        await renormalizarSePreciso(coluna);
        atualizarDrawerSeAberto(id);
      } catch (e) {
        Object.assign(d, anterior);
        desenharArea();
        B7.UI.toast('Não foi possível mover: ' + (e.message || 'erro ao salvar'), { tipo: 'erro' });
      } finally {
        emMovimento.delete(id);
        if (pendentesRealtime.has(id)) { pendentesRealtime.delete(id); agendarReleitura([id]); }
      }
    });
    return fila;
  }

  async function renormalizarSePreciso(coluna) {
    const col = dados.filter(d => d.coluna === coluna && !d.arquivada_em)
      .sort((a, b) => (a.posicao || 0) - (b.posicao || 0));
    let apertado = false;
    for (let i = 1; i < col.length; i++) if (Math.abs(col[i].posicao - col[i - 1].posicao) < 1e-6) apertado = true;
    if (!apertado) return;
    for (let i = 0; i < col.length; i++) {
      const p = (i + 1) * 1000;
      await B7.DB.moverDemanda(col[i].id, coluna, p);
      col[i].posicao = p;
    }
    desenharArea();
  }

  /* =================================================================
     REALTIME — um canal, só o que muda
     ================================================================= */
  let canal = null, releitura = null;
  const paraReler = new Set(), pendentesRealtime = new Set();

  function assinar() {
    desassinar();
    if (!B7.DB.canal) return;
    canal = B7.DB.canal('kanban-' + Date.now(), [
      { table: 'kanban_demandas' },
      { table: 'aprovacoes', event: 'UPDATE' },
      { table: 'comentarios', event: 'INSERT' }
    ], p => {
      const novo = p.new || {}, velho = p.old || {};
      if (p.table === 'kanban_demandas') {
        if (p.eventType === 'DELETE') return remover(velho.id);
        if (novo.deleted_at || novo.arquivada_em) return remover(novo.id);
        return agendarReleitura([novo.id]);
      }
      if (p.table === 'aprovacoes') {
        const ids = dados.filter(d => d.aprovacao_id === novo.id ||
          (d.tipo_vinculo === novo.tipo && d.vinculo_id === novo.alvo_id)).map(d => d.id);
        return agendarReleitura(ids);
      }
      if (p.table === 'comentarios') {
        return agendarReleitura(dados.filter(d => d.aprovacao_id === novo.aprovacao_id).map(d => d.id));
      }
    });
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desassinar);
  }
  function desassinar() {
    clearTimeout(releitura); releitura = null; paraReler.clear();
    if (canal) { B7.DB.fecharCanal(canal); canal = null; }
  }

  function agendarReleitura(ids) {
    ids.forEach(id => { if (emMovimento.has(id)) pendentesRealtime.add(id); else paraReler.add(id); });
    if (!paraReler.size) return;
    clearTimeout(releitura);
    releitura = setTimeout(async () => {
      const lote = [...paraReler]; paraReler.clear();
      try {
        const linhas = await B7.DB.demandas(lote);
        const vistos = new Set();
        linhas.forEach(l => {
          vistos.add(l.id);
          const i = dados.findIndex(d => d.id === l.id);
          if (l.deleted_at || l.arquivada_em) { if (i >= 0) dados.splice(i, 1); return; }
          if (i >= 0) dados[i] = l; else dados.push(l);
        });
        lote.forEach(id => { if (!vistos.has(id)) remover(id, true); });
        if (painel().querySelector('#kb-area')) { atualizarContagens(); desenharArea(); }
        lote.forEach(atualizarDrawerSeAberto);
      } catch (e) { /* a próxima mudança tenta de novo */ }
    }, 350);
  }
  function remover(id, silencioso) {
    const i = dados.findIndex(d => d.id === id);
    if (i < 0) return;
    dados.splice(i, 1);
    if (!silencioso && painel().querySelector('#kb-area')) { atualizarContagens(); desenharArea(); }
    if (drawer && drawer.id === id) fecharDrawer();
  }

  /* =================================================================
     CRIAR E EDITAR — só o título é obrigatório
     ================================================================= */
  function modalDemanda(id) {
    const d = id ? dados.find(x => x.id === id) : null;
    const m = B7.UI.modal('<h3>' + (d ? 'Editar demanda' : 'Nova demanda') + '</h3>' +
      '<div class="sub">Só o título é obrigatório. Cliente, responsável, prazo e material vinculado são opcionais.</div>' +
      '<div class="corpo">' +
        '<label class="rot" for="kd-titulo">TÍTULO</label>' +
        '<input class="campo" id="kd-titulo" data-foco value="' + esc(d ? d.titulo : '') + '" ' +
          'placeholder="ex.: Gravar depoimento da Dra. Ana">' +

        '<div class="linha mb kd-linha">' +
          '<div><label class="rot" for="kd-cliente">CLIENTE</label>' +
            '<select class="campo" id="kd-cliente"><option value="">Sem cliente</option>' +
            clientes.map(c => '<option value="' + esc(c.id) + '"' +
              (d && d.client_id === c.id ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot" for="kd-resp">RESPONSÁVEL</label>' +
            '<select class="campo" id="kd-resp"><option value="">Sem responsável</option>' +
            equipe.map(p => '<option value="' + esc(p.id) + '"' +
              (d && d.responsavel_id === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') +
            '</select></div>' +
        '</div>' +

        '<div class="linha mb kd-linha">' +
          '<div><label class="rot" for="kd-prazo">PRAZO</label>' +
            '<input class="campo" type="date" id="kd-prazo" value="' + esc(d ? (d.prazo || '') : '') + '"></div>' +
          '<div><label class="rot" for="kd-tipo">TIPO</label>' +
            '<select class="campo" id="kd-tipo">' +
            TIPOS.map(([v, r]) => '<option value="' + v + '"' +
              ((d ? d.tipo : 'producao') === v ? ' selected' : '') + '>' + r + '</option>').join('') +
            '</select></div>' +
          '<div><label class="rot">PRIORIDADE</label>' +
            '<div class="seg-linha" id="kd-prio">' +
            [['normal', 'Normal'], ['alta', 'Alta']].map(([v, r]) =>
              '<button type="button" data-prio="' + v + '" class="' +
              ((d ? (d.prioridade === 'alta' ? 'alta' : 'normal') : 'normal') === v ? 'on' : '') + '">' + r + '</button>').join('') +
            '</div></div>' +
        '</div>' +

        /* vínculo opcional: só faz sentido com cliente escolhido */
        (!d || d.tipo_vinculo === 'avulsa' || !d.tipo_vinculo
          ? '<div id="kd-vinculo-cx" class="kd-vinculo-cx">' +
              '<label class="rot" for="kd-vinculo">VINCULAR A UM MATERIAL <span class="kd-opc">opcional</span></label>' +
              '<select class="campo" id="kd-vinculo" disabled><option value="">Escolha um cliente para ver os materiais</option></select>' +
            '</div>'
          : '<div class="kd-vinculo-fixo">Vinculada a <b>' + esc(rotuloTipo(d).toLowerCase()) + '</b> — o vínculo não muda depois de criada.</div>') +

        '<details class="kd-mais"' + (d && (d.descricao || d.referencias) ? ' open' : '') + '><summary>Descrição e referências</summary>' +
          '<label class="rot" for="kd-desc">DESCRIÇÃO</label>' +
          '<textarea class="campo alta" id="kd-desc" rows="3">' + esc(d ? (d.descricao || '') : '') + '</textarea>' +
          '<label class="rot" for="kd-ref" style="margin-top:12px">LINKS DE REFERÊNCIA</label>' +
          '<textarea class="campo" id="kd-ref" rows="2" placeholder="um link por linha">' +
            esc(d ? (d.referencias || '') : '') + '</textarea>' +
        '</details>' +
        '<div id="kd-erro" class="ajuda erro-txt" role="alert"></div>' +
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

    /* materiais do cliente escolhido — carregados só quando o cliente muda */
    const selCli = m.querySelector('#kd-cliente'), selVinc = m.querySelector('#kd-vinculo');
    let materiais = [];
    async function carregarMateriais() {
      if (!selVinc) return;
      const cid = selCli.value;
      selVinc.disabled = true; materiais = [];
      if (!cid) { selVinc.innerHTML = '<option value="">Escolha um cliente para ver os materiais</option>'; return; }
      selVinc.innerHTML = '<option value="">Carregando…</option>';
      try { materiais = await B7.DB.materiaisParaVinculo(cid); } catch (e) { materiais = []; }
      if (selCli.value !== cid) return;
      const grupo = (t, r) => {
        const its = materiais.filter(x => x.tipo === t);
        return its.length ? '<optgroup label="' + r + '">' + its.map(x =>
          '<option value="' + t + ':' + esc(x.id) + '">' + esc(x.titulo) + (x.extra ? ' · ' + esc(x.extra) : '') + '</option>').join('') + '</optgroup>' : '';
      };
      selVinc.innerHTML = '<option value="">Sem vínculo (demanda avulsa)</option>' +
        grupo('roteiro', 'Roteiros') + grupo('linha', 'Linhas editoriais') + grupo('gravacao', 'Gravações');
      selVinc.disabled = false;
      if (!materiais.length) selVinc.innerHTML = '<option value="">Este cliente ainda não tem materiais</option>';
    }
    if (selVinc) { selCli.onchange = carregarMateriais; carregarMateriais(); }

    m.querySelector('[data-ok]').onclick = async () => {
      const titulo = m.querySelector('#kd-titulo').value.trim();
      const erro = m.querySelector('#kd-erro');
      if (!titulo) { erro.textContent = 'A demanda precisa de um título.'; m.querySelector('#kd-titulo').focus(); return; }

      const campos = {
        titulo,
        descricao: m.querySelector('#kd-desc').value.trim() || null,
        client_id: selCli.value || null,
        tipo: m.querySelector('#kd-tipo').value,
        responsavel_id: m.querySelector('#kd-resp').value || null,
        prazo: m.querySelector('#kd-prazo').value || null,
        prioridade: prio,
        referencias: m.querySelector('#kd-ref').value.trim() || null
      };
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        if (d) {
          if (selVinc && selVinc.value) {
            const [tv, vid] = selVinc.value.split(':');
            campos.tipo_vinculo = tv; campos.vinculo_id = vid;
          }
          await B7.DB.atualizarDemanda(d.id, campos);
          const novo = await B7.DB.demanda(d.id);
          if (novo) Object.assign(d, novo);
        } else {
          campos.coluna = 'a_fazer';
          campos.posicao = calcularPosicao('a_fazer', null);
          if (selVinc && selVinc.value) {
            const [tv, vid] = selVinc.value.split(':');
            campos.tipo_vinculo = tv; campos.vinculo_id = vid;
          } else campos.tipo_vinculo = 'avulsa';
          const criada = await B7.DB.criarDemanda(campos);
          const linha = await B7.DB.demanda(criada.id).catch(() => null);
          dados.push(linha || Object.assign({ cliente_nome: (clientes.find(c => c.id === campos.client_id) || {}).nome,
            responsavel_nome: (equipe.find(p => p.id === campos.responsavel_id) || {}).nome }, criada));
        }
        m.fechar();
        atualizarContagens(); desenharArea();
        atualizarDrawerSeAberto(d ? d.id : null);
        B7.UI.toast(d ? 'Demanda salva' : 'Demanda criada');
      } catch (e) {
        botao.disabled = false; botao.textContent = d ? 'Salvar' : 'Criar demanda';
        erro.textContent = e.code === '23505' || /kanban_vinculo_ativo_unico/.test(e.message || '')
          ? 'Este material já tem uma demanda ativa no quadro. Abra a demanda existente em vez de criar outra.'
          : (e.message || 'Não foi possível salvar.');
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
      try {
        await B7.DB.excluirDemanda(d.id);
        m.fechar(); remover(d.id);
        B7.UI.toast('Demanda excluída');
      } catch (e) { B7.UI.toast('Não foi possível excluir: ' + (e.message || ''), { tipo: 'erro' }); }
    };
  }

  /* =================================================================
     DETALHE — gaveta lateral com abas
       Detalhes · Feedback do cliente · Notas internas · Histórico
     Notas internas e comentários do cliente vivem em tabelas diferentes
     e aparecem em abas diferentes: o que é da equipe nunca vai ao portal.
     ================================================================= */
  let drawer = null;   /* { id, aba, el, extra } */

  async function abrirDetalhe(id, aba) {
    const d = dados.find(x => x.id === id);
    if (!d) return;
    if (drawer && drawer.id !== id) fecharDrawer();

    if (!drawer) {
      const el = document.createElement('div');
      el.className = 'kb-drawer-fundo';
      el.innerHTML = '<aside class="kb-drawer" role="dialog" aria-modal="true" aria-label="Detalhe da demanda"><div class="kb-dr-corpo">' +
        B7.UI.skeleton('tabela', { n: 4, cols: 2 }) + '</div></aside>';
      document.body.appendChild(el);
      document.body.classList.add('kb-drawer-aberta');
      el.addEventListener('mousedown', e => { if (e.target === el) fecharDrawer(); });
      const tecla = e => { if (e.key === 'Escape') fecharDrawer(); };
      document.addEventListener('keydown', tecla);
      drawer = { id, aba: aba || 'detalhes', el, extra: null, anterior: document.activeElement, tecla };
      if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(fecharDrawer);
    } else if (aba) drawer.aba = aba;

    try { drawer.extra = await B7.DB.detalheDemanda(d); }
    catch (e) { drawer.extra = { notas: [], historico: [], partes: [], comentarios: [], eventos: [] }; }
    if (!drawer || drawer.id !== id) return;
    desenharDrawer();
  }

  function fecharDrawer() {
    if (!drawer) return;
    document.removeEventListener('keydown', drawer.tecla);
    drawer.el.remove();
    document.body.classList.remove('kb-drawer-aberta');
    const foco = drawer.anterior;
    drawer = null;
    if (foco && foco.focus && document.contains(foco)) foco.focus();
  }

  /* o Realtime ou um movimento mudou a demanda aberta: redesenha, mas
     não por cima de uma nota que está sendo escrita */
  async function atualizarDrawerSeAberto(id) {
    if (!drawer || (id && drawer.id !== id)) return;
    const campo = drawer.el.querySelector('#kd-nota');
    if (campo && campo.value.trim()) return;
    const d = dados.find(x => x.id === drawer.id);
    if (!d) return fecharDrawer();
    try { drawer.extra = await B7.DB.detalheDemanda(d); } catch (e) {}
    if (drawer && drawer.id === d.id) desenharDrawer();
  }

  function desenharDrawer() {
    const d = dados.find(x => x.id === drawer.id);
    if (!d) return fecharDrawer();
    const x = drawer.extra || { notas: [], historico: [], partes: [], comentarios: [], eventos: [] };
    const aside = drawer.el.querySelector('.kb-drawer');
    const temAprov = !!d.aprovacao_id;
    const nFeedback = pendentes(d);
    const nNotas = x.notas.filter(n => !n.resolvido_em).length;

    const abas = [['detalhes', 'Detalhes', 0]]
      .concat(temAprov ? [['feedback', 'Feedback do cliente', nFeedback]] : [])
      .concat([['notas', 'Notas internas', nNotas], ['historico', 'Histórico', 0]]);
    if (!abas.find(a => a[0] === drawer.aba)) drawer.aba = 'detalhes';

    aside.innerHTML =
      '<header class="kb-dr-cab">' +
        '<div class="kb-dr-linha1">' +
          '<span class="kb-tipo ' + esc(classeTipo(d)) + '">' + esc(rotuloTipo(d)) + '</span>' +
          '<select class="kb-dr-coluna kb-chip ' + esc(d.coluna) + '" id="kd-coluna" aria-label="Situação">' +
            COLUNAS.map(([c, r]) => '<option value="' + c + '"' + (d.coluna === c ? ' selected' : '') + '>' + esc(r) + '</option>').join('') +
          '</select>' +
          (doCliente(d) ? '<span class="kb-origem">Ajuste solicitado pelo cliente</span>' : '') +
          '<span class="kb-espaco"></span>' +
          '<button class="ico" data-editar aria-label="Editar demanda" title="Editar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12.5 7.5l4 4"/></svg></button>' +
          '<button class="ico" data-fechar aria-label="Fechar">✕</button>' +
        '</div>' +
        '<h3>' + esc(d.titulo) + '</h3>' +
        '<div class="kb-dr-meta">' +
          (d.cliente_nome ? '<span class="kb-cli">' + B7.UI.avatarCliente(d.cliente_nome, d.cliente_logo, 'xs') + esc(d.cliente_nome) + '</span>' : '<span>Demanda interna</span>') +
          (d.aprovacao_situacao ? '<span class="kb-ap ' + esc(d.aprovacao_situacao) + '">' + esc(rotuloAprov(d.aprovacao_situacao)) +
            (d.aprovacao_versao ? ' · v' + d.aprovacao_versao : '') + '</span>' : '') +
        '</div>' +
        '<nav class="kb-dr-abas" role="tablist">' + abas.map(([k, r, n]) =>
          '<button role="tab" data-aba="' + k + '" class="' + (drawer.aba === k ? 'on' : '') + '" aria-selected="' + (drawer.aba === k) + '">' +
          esc(r) + (n ? '<b>' + n + '</b>' : '') + '</button>').join('') + '</nav>' +
      '</header>' +
      '<div class="kb-dr-corpo" role="tabpanel">' +
        (drawer.aba === 'detalhes' ? abaDetalhes(d) :
         drawer.aba === 'feedback' ? abaFeedback(d, x) :
         drawer.aba === 'notas' ? abaNotas(d, x) : abaHistorico(d, x)) +
      '</div>' +
      '<footer class="kb-dr-pe">' +
        (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa' && d.vinculo_id
          ? '<button class="b pri" data-abrir-material>Abrir ' + esc(rotuloTipo(d).toLowerCase()) + '</button>' : '') +
        (d.aprovacao_id ? '<button class="b contorno" data-ir="#/aprovacoes/' + esc(d.aprovacao_id) + '">Ver aprovação</button>' : '') +
        '<span class="kb-espaco"></span>' +
        '<button class="b" data-arquivar>Arquivar</button>' +
      '</footer>';

    ligarDrawer(d, x);
  }

  function abaDetalhes(d) {
    const links = String(d.referencias || '').split('\n').map(l => l.trim()).filter(Boolean);
    return '<div class="kb-dr-grade">' +
      '<label class="kb-dr-campo"><small>RESPONSÁVEL</small>' +
        '<select class="campo fina" id="kd-resp2"><option value="">Sem responsável</option>' +
        equipe.map(p => '<option value="' + esc(p.id) + '"' + (d.responsavel_id === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') +
        '</select></label>' +
      '<label class="kb-dr-campo"><small>PRAZO</small>' +
        '<input class="campo fina" type="date" id="kd-prazo2" value="' + esc(d.prazo || '') + '"></label>' +
      '<label class="kb-dr-campo"><small>PRIORIDADE</small>' +
        '<select class="campo fina" id="kd-prio2">' +
        [['baixa', 'Baixa'], ['normal', 'Normal'], ['alta', 'Alta']].map(([v, r]) =>
          '<option value="' + v + '"' + ((d.prioridade || 'normal') === v ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select></label>' +
      '<span class="kb-dr-salvo" id="kd-salvo" aria-live="polite"></span>' +
    '</div>' +

    (d.aviso ? '<div class="kd-aviso"><b>Atenção:</b> ' + esc(d.aviso) +
      ' <button class="b fina" data-limpar-aviso>Já revisei</button></div>' : '') +
    (d.descricao ? '<div class="kd-bloco"><small>DESCRIÇÃO</small><p class="kd-desc">' + esc(d.descricao) + '</p></div>'
                 : '<div class="kd-bloco"><small>DESCRIÇÃO</small><p class="vazio-leve">Sem descrição. <a href="#" data-editar>Adicionar</a></p></div>') +

    (d.tipo_vinculo && d.tipo_vinculo !== 'avulsa' && d.vinculo_id
      ? '<div class="kd-bloco"><small>MATERIAL VINCULADO</small>' +
        '<div class="kd-vinculo"><div><b>' + esc(rotuloTipo(d)) + '</b>' +
          (d.aprovacao_titulo ? '<span class="kd-vinc-tit">' + esc(d.aprovacao_titulo) + '</span>' : '') +
          (d.aprovacao_versao ? '<span class="kd-vinc-v">versão ' + d.aprovacao_versao + ' enviada ao cliente · ' +
            esc(rotuloAprov(d.aprovacao_situacao || '')) + '</span>' : '') +
        '</div><button class="b fina" data-abrir-material>Abrir</button></div>' +
        '<label class="op-mini' + (d.automacao_travada ? ' on' : '') + '" id="kd-trava"><input type="checkbox"' + (d.automacao_travada ? ' checked' : '') + '>' +
          '<span>Travar automação<small>a aprovação do cliente não move esta demanda de coluna</small></span></label>' +
        '</div>'
      : '') +

    (links.length
      ? '<div class="kd-bloco"><small>REFERÊNCIAS</small>' +
        /* só http(s) vira link: "javascript:" digitado no campo não executa */
        links.map(l => /^https?:\/\//i.test(l)
          ? '<a class="kd-link" href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + esc(l) + '</a>'
          : '<span class="kd-link">' + esc(l) + '</span>').join('') + '</div>'
      : '') +

    '<div class="kd-bloco kd-rodape-info"><small>CRIADA</small>' + esc(B7.UI.quando(d.created_at)) +
      (d.origem_evento ? ' · última automação: <code>' + esc(d.origem_evento) + '</code>' : '') + '</div>';
  }

  /* Feedback do cliente: exatamente a versão e os comentários que geraram
     a demanda. Resolvido continua no histórico, mas sai da lista ativa. */
  function abaFeedback(d, x) {
    const partesAjuste = x.partes.filter(p => p.situacao === 'ajustes');
    const partesOk = x.partes.filter(p => p.situacao === 'aprovada');
    const cliente = x.comentarios.filter(c => c.autor_papel === 'cliente');
    const equipeCom = x.comentarios.filter(c => c.autor_papel !== 'cliente');
    const decididas = new Set(x.partes.filter(p => p.situacao !== 'pendente').map(p => String(p.parte_id)));
    const abertos = cliente.filter(c => !c.resolvido && !(c.parte_id && decididas.has(String(c.parte_id))));
    const resolvidos = cliente.filter(c => c.resolvido || (c.parte_id && partesOk.find(p => String(p.parte_id) === String(c.parte_id))));
    const porParte = pid => cliente.filter(c => String(c.parte_id) === String(pid));

    const com = c => '<div class="kd-com' + (c.resolvido ? ' resolvido' : '') + '">' +
      '<div class="kd-com-cab"><b>' + esc(c.autor_nome || 'Cliente') + '</b>' +
      '<span>' + esc(B7.UI.quando(c.created_at)) + '</span>' +
      (!c.resolvido ? '<button class="kd-resolver" data-resolver="' + esc(c.id) + '">Marcar resolvido</button>' : '<i>resolvido</i>') +
      '</div><p>' + esc(c.texto) + '</p></div>';

    return '<div class="kd-fb-cab">' +
        '<b>' + esc(d.aprovacao_titulo || d.titulo) + '</b>' +
        '<span>Versão ' + (d.aprovacao_versao || '?') + ' · ' + esc(rotuloAprov(d.aprovacao_situacao || '')) +
        (d.aprovacao_decidida_em ? ' · ' + esc(B7.UI.quando(d.aprovacao_decidida_em)) : '') + '</span>' +
      '</div>' +

      (partesAjuste.length
        ? '<div class="kd-bloco"><small>CENAS COM AJUSTE PEDIDO (' + partesAjuste.length + ')</small>' +
          partesAjuste.map(p => '<div class="kd-parte">' +
            '<div class="kd-parte-cab"><b>' + esc(p.parte_rotulo || 'Cena') + '</b><span>' +
              esc(p.decidido_por_nome || 'Cliente') + ' · ' + esc(B7.UI.quando(p.decidido_em)) + '</span></div>' +
            (porParte(p.parte_id).length
              ? porParte(p.parte_id).map(c => '<p class="kd-parte-txt">“' + esc(c.texto) + '”</p>').join('')
              : '<p class="kd-parte-txt vazio-leve">Pedido de ajuste sem comentário.</p>') +
          '</div>').join('') + '</div>'
        : '') +

      '<div class="kd-bloco"><small>COMENTÁRIOS DO CLIENTE EM ABERTO (' + abertos.length + ')</small>' +
        (abertos.length ? abertos.map(com).join('')
          : '<div class="vazio-leve">' + (partesAjuste.length ? 'Nenhum comentário além dos pedidos por cena.' :
            (d.aprovacao_situacao === 'aprovado' ? 'O cliente aprovou esta versão sem pendências.' : 'Nenhum pedido de ajuste em aberto nesta versão.')) + '</div>') +
      '</div>' +

      (equipeCom.length
        ? '<div class="kd-bloco"><small>RESPOSTAS DA EQUIPE NA APROVAÇÃO</small>' +
          equipeCom.map(c => '<div class="kd-com equipe"><div class="kd-com-cab"><b>' + esc(c.autor_nome || 'Equipe') + '</b><span>' +
            esc(B7.UI.quando(c.created_at)) + '</span></div><p>' + esc(c.texto) + '</p></div>').join('') + '</div>'
        : '') +

      (resolvidos.length || partesOk.length
        ? '<details class="kd-mais"><summary>Já resolvido nesta versão (' + (resolvidos.length + partesOk.length) + ')</summary>' +
          partesOk.map(p => '<div class="kd-hist">' + esc(p.parte_rotulo || 'Cena') + ' aprovada por ' + esc(p.decidido_por_nome || 'cliente') +
            ' · ' + esc(B7.UI.quando(p.decidido_em)) + '</div>').join('') +
          resolvidos.filter(c => c.resolvido).map(com).join('') + '</details>'
        : '') +

      '<p class="kd-nota-fim">Versões anteriores e a conversa completa ficam na tela de aprovação.</p>';
  }

  function abaNotas(d, x) {
    const abertas = x.notas.filter(n => !n.resolvido_em), feitas = x.notas.filter(n => n.resolvido_em);
    const nota = n => '<div class="kd-com' + (n.resolvido_em ? ' resolvido' : '') + '">' +
      '<div class="kd-com-cab"><b>' + esc(n.autor_nome || 'Equipe') + '</b><span>' + esc(B7.UI.quando(n.created_at)) + '</span>' +
      '<button class="kd-resolver" data-nota="' + esc(n.id) + '" data-res="' + (n.resolvido_em ? '0' : '1') + '">' +
        (n.resolvido_em ? 'Reabrir' : 'Resolver') + '</button></div>' +
      '<p>' + esc(n.texto) + '</p></div>';
    return '<p class="kd-aviso-int">Só a equipe vê estas notas. Nada daqui vai para o portal do cliente.</p>' +
      '<div class="kd-coments">' +
        (abertas.length ? abertas.map(nota).join('') : '<div class="vazio-leve">Nenhuma nota em aberto.</div>') +
      '</div>' +
      (feitas.length ? '<details class="kd-mais"><summary>Resolvidas (' + feitas.length + ')</summary>' + feitas.map(nota).join('') + '</details>' : '') +
      '<div class="kd-novo-com">' +
        '<textarea class="campo fina" id="kd-nota" rows="2" placeholder="Escrever uma nota interna…"></textarea>' +
        '<button class="b fina pri" id="kd-nota-add">Adicionar</button>' +
      '</div>';
  }

  /* Linha do tempo: movimentos do quadro + eventos da aprovação ativa */
  function abaHistorico(d, x) {
    const itens = x.historico.map(h => ({
      t: h.created_at, tipo: 'quadro',
      txt: esc(h.autor_nome || 'Alguém') + ' moveu de <b>' + esc(nomeColuna(h.de)) + '</b> para <b>' + esc(nomeColuna(h.para)) + '</b>'
    })).concat(x.eventos.map(ev => ({
      t: ev.created_at, tipo: 'evento',
      txt: esc(rotuloEvento(ev)) + (ev.erro ? ' <i class="kd-ev-erro">falhou: ' + esc(ev.erro) + '</i>' : '')
    })));
    itens.push({ t: d.created_at, tipo: 'quadro', txt: 'Demanda criada' +
      (d.origem_evento && ORIGEM_CLIENTE.concat(['aprovacao.enviada']).includes(d.origem_evento) && !d.criado_por ? ' pela automação' : '') });
    itens.sort((a, b) => (b.t || '').localeCompare(a.t || ''));
    return '<div class="kd-timeline">' + itens.map(i =>
      '<div class="kd-tl ' + i.tipo + '"><span class="kd-tl-pt"></span><div>' + i.txt +
      '<small>' + esc(B7.UI.quando(i.t)) + '</small></div></div>').join('') + '</div>';
  }

  function rotuloEvento(ev) {
    const quem = ev.ator_nome || 'Alguém';
    const r = (ev.payload && ev.payload.rotulo) || 'cena';
    return {
      'aprovacao.enviada': 'Versão ' + (ev.versao || '') + ' enviada ao cliente por ' + quem,
      'aprovacao.aprovada': quem + ' aprovou a versão ' + (ev.versao || ''),
      'aprovacao.ajustes': quem + ' solicitou ajustes na versão ' + (ev.versao || ''),
      'aprovacao.recusada': quem + ' recusou a versão ' + (ev.versao || ''),
      'parte.aprovada': quem + ' aprovou a ' + r,
      'parte.ajustes': quem + ' pediu ajuste na ' + r
    }[ev.tipo] || ev.tipo;
  }

  function ligarDrawer(d, x) {
    const el = drawer.el;
    el.querySelector('[data-fechar]').onclick = fecharDrawer;
    el.querySelectorAll('[data-editar]').forEach(b => b.onclick = e => { e.preventDefault(); modalDemanda(d.id); });
    el.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { drawer.aba = b.dataset.aba; desenharDrawer(); });
    el.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { fecharDrawer(); location.hash = b.dataset.ir; });
    el.querySelectorAll('[data-abrir-material]').forEach(b => b.onclick = () => abrirMaterial(d));

    /* mover pela gaveta = mesma fila do arrastar */
    const col = el.querySelector('#kd-coluna');
    if (col) col.onchange = () => mover(d.id, col.value, null);

    const salvo = el.querySelector('#kd-salvo');
    const salvar = async (campos, rotulo) => {
      if (salvo) { salvo.textContent = 'Salvando…'; salvo.className = 'kb-dr-salvo salvando'; }
      try {
        await B7.DB.atualizarDemanda(d.id, campos);
        const novo = await B7.DB.demanda(d.id);
        if (novo) Object.assign(d, novo); else Object.assign(d, campos);
        if (salvo) { salvo.textContent = rotulo + ' salvo'; salvo.className = 'kb-dr-salvo salvo'; }
        desenharArea();
      } catch (e) {
        if (salvo) { salvo.textContent = 'Não foi possível salvar'; salvo.className = 'kb-dr-salvo erro'; }
        B7.UI.toast('Não foi possível salvar: ' + (e.message || ''), { tipo: 'erro' });
        desenharDrawer();
      }
    };
    const resp = el.querySelector('#kd-resp2');
    if (resp) resp.onchange = () => salvar({ responsavel_id: resp.value || null }, 'Responsável');
    const prazo = el.querySelector('#kd-prazo2');
    if (prazo) prazo.onchange = () => salvar({ prazo: prazo.value || null }, 'Prazo');
    const prio = el.querySelector('#kd-prio2');
    if (prio) prio.onchange = () => salvar({ prioridade: prio.value }, 'Prioridade');

    const trava = el.querySelector('#kd-trava input');
    if (trava) trava.onchange = async () => {
      try {
        await B7.DB.atualizarDemanda(d.id, { automacao_travada: trava.checked });
        d.automacao_travada = trava.checked;
        el.querySelector('#kd-trava').classList.toggle('on', trava.checked);
        B7.UI.toast(trava.checked ? 'Automação travada nesta demanda' : 'Automação liberada');
        desenharArea();
      } catch (e) { trava.checked = !trava.checked; B7.UI.toast('Não foi possível salvar', { tipo: 'erro' }); }
    };

    const limparAviso = el.querySelector('[data-limpar-aviso]');
    if (limparAviso) limparAviso.onclick = async () => {
      limparAviso.disabled = true;
      try { await B7.DB.atualizarDemanda(d.id, { aviso: null }); d.aviso = null; limparAviso.closest('.kd-aviso').remove(); B7.UI.toast('Aviso removido'); desenharArea(); }
      catch (e) { limparAviso.disabled = false; B7.UI.toast('Não foi possível salvar', { tipo: 'erro' }); }
    };

    el.querySelector('[data-arquivar]').onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Arquivar esta demanda?',
        texto: 'Ela sai do quadro e da lista. O material vinculado não é afetado.', confirmar: 'Arquivar' });
      if (!ok) return;
      try {
        await B7.DB.atualizarDemanda(d.id, { arquivada_em: new Date().toISOString() });
        remover(d.id); B7.UI.toast('Demanda arquivada');
      } catch (e) { B7.UI.toast('Não foi possível arquivar', { tipo: 'erro' }); }
    };

    /* notas internas */
    const add = el.querySelector('#kd-nota-add');
    if (add) add.onclick = async () => {
      const campo = el.querySelector('#kd-nota');
      const texto = campo.value.trim();
      if (!texto) { campo.focus(); return; }
      add.disabled = true; add.textContent = 'Salvando…';
      try {
        await B7.DB.comentarDemanda(d.id, texto);
        campo.value = '';
        await atualizarDrawerSeAberto(d.id);
        const l = await B7.DB.demanda(d.id).catch(() => null);
        if (l) { Object.assign(d, l); desenharArea(); }
      } catch (e) {
        add.disabled = false; add.textContent = 'Adicionar';
        B7.UI.toast('Não foi possível salvar a nota', { tipo: 'erro' });
      }
    };
    el.querySelectorAll('[data-nota]').forEach(b => b.onclick = async () => {
      try {
        await B7.DB.resolverNotaDemanda(b.dataset.nota, b.dataset.res === '1');
        await atualizarDrawerSeAberto(d.id);
        const l = await B7.DB.demanda(d.id).catch(() => null);
        if (l) { Object.assign(d, l); desenharArea(); }
      } catch (e) { B7.UI.toast('Não foi possível atualizar a nota', { tipo: 'erro' }); }
    });
    /* comentários do cliente: resolver = "a equipe tratou" (fica no histórico) */
    el.querySelectorAll('[data-resolver]').forEach(b => b.onclick = async () => {
      try {
        await B7.DB.resolverComentario(b.dataset.resolver);
        const l = await B7.DB.demanda(d.id).catch(() => null);
        if (l) Object.assign(d, l);
        await atualizarDrawerSeAberto(d.id);
        desenharArea();
      } catch (e) { B7.UI.toast('Não foi possível marcar como resolvido', { tipo: 'erro' }); }
    });

    const foco = el.querySelector('[data-aba].on');
    if (foco && !el.contains(document.activeElement)) foco.focus();
  }

  /* Cada material abre onde ele mora: roteiro no editor da gravação,
     conteúdo na linha editorial, gravação no editor, linha na linha. */
  async function abrirMaterial(d) {
    try {
      let destino = null;
      if (d.tipo_vinculo === 'roteiro') {
        const r = await B7.DB.roteiro(d.vinculo_id);
        destino = '#/gravacao/' + r.recording_session_id + '?roteiro=' + r.id;
      } else if (d.tipo_vinculo === 'conteudo') {
        const c = await B7.DB.conteudo(d.vinculo_id);
        destino = '#/linha/' + c.linha_id + '/criativos';
      } else if (d.tipo_vinculo === 'gravacao') destino = '#/gravacao/' + d.vinculo_id;
      else if (d.tipo_vinculo === 'linha') destino = '#/linha/' + d.vinculo_id;
      if (!destino) return;
      fecharDrawer();
      location.hash = destino;
    } catch (e) {
      B7.UI.toast('O material vinculado não foi encontrado (pode estar na lixeira)', { tipo: 'erro' });
    }
  }

  return { abrir, abrirDetalhe, COLUNAS, nomeColuna };
})();
