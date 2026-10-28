/* =====================================================================
   PROJETOS AVULSOS (zzz274)

   O cliente que não tem mês contratado: comprou um vídeo, uma edição.
   Três tipos:
     • completo      → a B7 faz roteiro, gravação e edição;
     • cliente_grava → a B7 faz roteiro e edição; o cliente grava;
     • so_edicao     → o cliente manda o material; a B7 só edita.
   Criar o projeto já monta as tarefas nos lugares de sempre (banco:
   projeto_avulso_criar) — roteiros numa gravação, a gravação na agenda
   (só no completo) e as demandas de edição, travadas até a hora delas.
   O cliente avulso não usa o portal: o roteiro vai pelo WhatsApp (texto
   ou PDF) e a equipe marca "o cliente aprovou". O material chega por
   link do Drive; "Material recebido" destrava a edição.

   Telas: #/projetos (lista), #/projetos/<id> (o projeto, com a linha do
   tempo e o próximo passo), a seção "Projetos" do cliente e a janela
   "Novo projeto avulso" (Criar, cliente e lista).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Projetos = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');

  const TIPOS = {
    completo: { r: 'Vídeo completo', d: 'a B7 faz roteiro, gravação e edição', curto: 'Completo' },
    cliente_grava: { r: 'Cliente grava', d: 'a B7 faz roteiro e edição; o cliente grava e manda', curto: 'Cliente grava' },
    so_edicao: { r: 'Só edição', d: 'o cliente manda o material; a B7 edita', curto: 'Só edição' }
  };
  const ETAPAS = {
    roteiro: 'Roteiro', gravacao: 'Gravação', material: 'Material do cliente', edicao: 'Edição',
    aprovacao: 'Aprovação', entregue: 'Entregue', cancelado: 'Cancelado'
  };
  /* a linha do tempo de cada tipo, na ordem */
  const PASSOS = {
    completo: ['roteiro', 'gravacao', 'edicao', 'aprovacao', 'entregue'],
    cliente_grava: ['roteiro', 'material', 'edicao', 'aprovacao', 'entregue'],
    so_edicao: ['material', 'edicao', 'aprovacao', 'entregue']
  };
  const ST_DEMANDA = { pendente: 'Para editar', em_edicao: 'Em edição', aguardando_aprovacao: 'Com o cliente', correcao: 'Correção',
    standby: 'Travada', entregue: 'Entregue', descartado: 'Descartada' };

  const podeGerir = () => !!(B7.Perm && B7.Perm.pode ? B7.Perm.pode('projeto.gerir') : B7.Auth && B7.Auth.ehAdmin && B7.Auth.ehAdmin());
  const dataBR = d => d ? B7.UI.dataBR(String(d).slice(0, 10)) : '';
  const quando = d => d ? B7.UI.quando(d) : '';

  /* ------------------------------------------------ existe algum? (menu) */
  const CHAVE_TEM = 'b7_tem_projetos';
  let tem = (() => { try { return localStorage.getItem(CHAVE_TEM) === '1'; } catch (e) { return false; } })();
  const temAlgum = () => tem;
  function marcarTem(v) {
    if (v === tem) return;
    tem = v;
    try { localStorage.setItem(CHAVE_TEM, v ? '1' : '0'); } catch (e) {}
    if (B7.Nav && document.body.dataset.shell === 'interno') { try { B7.Nav.montar(); } catch (e) {} }
  }
  async function conferirTem() {
    if (!B7.Auth || !B7.Auth.usuario() || (B7.Auth.ehCliente && B7.Auth.ehCliente())) return;
    if (!B7.Perm || !B7.Perm.podeRota('projetos')) return;
    try { const l = await listar(); marcarTem(l.length > 0); } catch (e) {}
  }
  /* uma conferida quando a sessão chegar (o menu aparece no primeiro projeto) */
  (function esperarSessao(n) {
    if (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) return setTimeout(conferirTem, 1500);
    if (n < 40) setTimeout(() => esperarSessao(n + 1), 1500);
  })(0);

  async function listar(clienteId, abertos) {
    return (await B7.DB.rpc('projetos_avulsos_listar', { p_client: clienteId || null, p_abertos: !!abertos })) || [];
  }
  async function avancar(p, acao, drive) {
    return B7.DB.rpc('projeto_avulso_avancar', { p_id: p.id, p_acao: acao, p_drive: drive || null });
  }

  /* --------------------------------------------------------- pedaços */
  function chipTipo(p) { return '<span class="pj-tipo pj-t-' + esc(p.tipo) + '">' + esc((TIPOS[p.tipo] || {}).curto || p.tipo) + '</span>'; }
  function chipEtapa(p) { return '<span class="pj-etapa pj-e-' + esc(p.etapa) + '">' + esc(ETAPAS[p.etapa] || p.etapa) + '</span>'; }
  function progresso(p) {
    const passos = PASSOS[p.tipo] || [];
    const i = p.etapa === 'cancelado' ? -1 : passos.indexOf(p.etapa);
    return '<span class="pj-prog" aria-hidden="true">' + passos.map((s, k) =>
      '<i class="' + (p.etapa === 'entregue' || k < i ? 'feito' : k === i ? 'agora' : '') + '"></i>').join('') + '</span>';
  }
  /* o que o projeto espera agora, numa frase */
  function espera(p) {
    if (p.etapa === 'roteiro') return 'Escrever o roteiro e mandar para o cliente aprovar';
    if (p.etapa === 'gravacao') return p.data_gravacao ? 'Gravação em ' + dataBR(p.data_gravacao) : 'Marcar a gravação';
    if (p.etapa === 'material') return p.tipo === 'cliente_grava' ? 'O cliente gravar e mandar o material' : 'O cliente mandar o material';
    if (p.etapa === 'edicao') {
      const d = p.demandas || [], ok = d.filter(x => x.status === 'entregue').length;
      return 'Editando · ' + ok + ' de ' + d.filter(x => x.status !== 'descartado').length + ' entregues';
    }
    if (p.etapa === 'aprovacao') return 'O cliente aprovar a edição';
    if (p.etapa === 'entregue') return 'Entregue ' + quando(p.entregue_em);
    return 'Cancelado ' + quando(p.cancelado_em);
  }
  function cartao(p, comCliente) {
    const atrasado = p.prazo && !['entregue', 'cancelado'].includes(p.etapa) && String(p.prazo) < hojeISO();
    return '<a class="pj-card' + (['entregue', 'cancelado'].includes(p.etapa) ? ' fechado' : '') + '" href="#/projetos/' + esc(p.id) + '">' +
      (comCliente ? '<span class="pj-card-logo">' + B7.UI.avatarCliente(p.cliente, p.cliente_logo, 'sm') + '</span>' : '') +
      '<span class="pj-card-tx">' +
        (comCliente ? '<small class="pj-card-cli">' + esc(p.cliente) + '</small>' : '') +
        '<b>' + esc(p.nome) + '</b>' +
        '<span class="pj-card-meta">' + chipTipo(p) + chipEtapa(p) +
          '<span>' + p.qtd_videos + (p.qtd_videos === 1 ? ' vídeo' : ' vídeos') + '</span>' +
          (p.prazo ? '<span class="' + (atrasado ? 'pj-atraso' : '') + '">prazo ' + esc(dataBR(p.prazo)) + '</span>' : '') + '</span>' +
        '<small class="pj-card-espera">' + esc(espera(p)) + '</small>' +
      '</span>' + progresso(p) + '</a>';
  }
  function hojeISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ------------------------------------------------------------ lista */
  let filtro = 'abertos';
  async function abrir(id, params) {
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/projetos');
    if (id) return abrirProjeto(id);
    if (params && params.get && params.get('f')) filtro = params.get('f');
    B7.Rota.titulo(['Projetos avulsos']);
    painel().innerHTML = '<div class="conteudo entra pj">' +
      '<div class="cb-topo"><div class="cb-titulo"><h1>Projetos avulsos</h1>' +
        '<p class="gt-intro">Clientes que compraram um trabalho pontual — um vídeo, uma edição. Cada projeto mostra em que pé está e o que falta.</p></div>' +
        (podeGerir() ? '<button class="b pri" id="pj-novo">+ Novo projeto</button>' : '') + '</div>' +
      '<div class="filtro rolavel" role="tablist">' + [['abertos', 'Em andamento'], ['entregues', 'Entregues'], ['todos', 'Todos']].map(([k, r]) =>
        '<button role="tab" data-f="' + k + '" class="' + (filtro === k ? 'on' : '') + '" aria-selected="' + (filtro === k) + '">' + r + '<span class="gt-n" data-n-' + k + '></span></button>').join('') + '</div>' +
      '<div id="pj-corpo">' + B7.UI.skeleton('lista', { n: 3 }) + '</div></div>';
    const novo = document.getElementById('pj-novo');
    if (novo) novo.onclick = () => abrirNovo(null);
    const vale = B7.Rota.marca();
    let lista;
    try { lista = await listar(null, false); }
    catch (e) {
      if (!vale()) return;
      document.getElementById('pj-corpo').innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar.') + '</div>';
      return;
    }
    if (!vale()) return;
    marcarTem(lista.length > 0);
    const grupos = {
      abertos: lista.filter(p => !['entregue', 'cancelado'].includes(p.etapa)),
      entregues: lista.filter(p => p.etapa === 'entregue'),
      todos: lista
    };
    Object.keys(grupos).forEach(k => { const el = painel().querySelector('[data-n-' + k + ']'); if (el && k !== 'todos') el.textContent = grupos[k].length || ''; });
    const pintar = () => {
      const l = grupos[filtro] || lista;
      document.getElementById('pj-corpo').innerHTML = l.length
        ? '<div class="pj-lista">' + l.map(p => cartao(p, true)).join('') + '</div>'
        : '<div class="estado-b7"><b>' + (filtro === 'abertos' ? 'Nenhum projeto em andamento.' : 'Nada por aqui ainda.') + '</b>' +
          '<p>Quando um cliente comprar um vídeo ou uma edição avulsa, crie o projeto: o sistema já monta o roteiro, a gravação e a edição.</p></div>';
    };
    painel().querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      filtro = b.dataset.f;
      painel().querySelectorAll('[data-f]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      try { history.replaceState(null, '', '#/projetos?f=' + filtro); } catch (e) {}
      pintar();
    });
    pintar();
  }

  /* ---------------------------------------------- Gestão → Avulsos */
  async function montarGestao(el) {
    el.innerHTML = B7.UI.skeleton('lista', { n: 3 });
    let lista;
    try { lista = await listar(null, false); }
    catch (e) { el.innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar.') + '</div>'; return; }
    if (!el.isConnected) return;
    const abertos = lista.filter(p => !['entregue', 'cancelado'].includes(p.etapa));
    const esperando = abertos.filter(p => p.etapa === 'material').length;
    const mes = hojeISO().slice(0, 7);
    const entreguesMes = lista.filter(p => p.etapa === 'entregue' && String(p.entregue_em || '').slice(0, 7) === mes).length;
    const clientes = new Set(lista.map(p => p.client_id)).size;
    el.innerHTML = '<div class="gt-kpis">' +
      '<div class="gt-kpi"><b>' + abertos.length + '</b><span>projetos em andamento</span></div>' +
      '<div class="gt-kpi' + (esperando ? ' atencao' : '') + '"><b>' + esperando + '</b><span>esperando material do cliente</span></div>' +
      '<div class="gt-kpi ok"><b>' + entreguesMes + '</b><span>entregues no mês</span></div>' +
      '<div class="gt-kpi"><b>' + clientes + '</b><span>clientes com projeto</span><small>no histórico todo</small></div></div>' +
      '<p class="gt-nota">Cliente avulso não entra na saúde dos clientes nem no “mês atrasado” do Panorama: ele não tem mês contratado. O que conta é o projeto.</p>' +
      '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Em andamento</h2><a class="cb-link" href="#/projetos">Ver todos →</a></div>' +
        (abertos.length ? '<div class="pj-lista">' + abertos.map(p => cartao(p, true)).join('') + '</div>' : '<p class="gt-vazio">Nenhum projeto avulso em andamento.</p>') +
      '</section>';
  }

  /* ---------------------------------------------- seção do cliente */
  async function secaoCliente(el, cliente) {
    let lista;
    try { lista = await listar(cliente.id, false); }
    catch (e) { el.innerHTML = '<p class="cfg-g-nota">Não foi possível carregar os projetos.</p>'; return; }
    if (!el.isConnected) return;
    const naSecao = (location.hash || '').includes('/projetos');
    if (!lista.length && !naSecao) {
      /* visão geral do cliente avulso sem projeto: um convite */
      el.innerHTML = podeGerir() ? '<section class="pj-convite"><div><b>Este cliente é avulso</b><p>Abra um projeto para o que ele comprou — o sistema já monta roteiro, gravação e edição.</p></div>' +
        '<button class="b pri fina" data-pj-novo>+ Novo projeto</button></section>' : '';
    } else {
      const abertos = lista.filter(p => !['entregue', 'cancelado'].includes(p.etapa));
      const fechados = lista.filter(p => ['entregue', 'cancelado'].includes(p.etapa));
      el.innerHTML = '<section class="pj-sec">' +
        '<div class="gt-bloco-cab"><h2>Projetos' + (abertos.length ? ' <small>' + abertos.length + ' em andamento</small>' : '') + '</h2>' +
          (podeGerir() ? '<button class="b fina contorno" data-pj-novo>+ Novo projeto</button>' : '') + '</div>' +
        (lista.length
          ? '<div class="pj-lista">' + abertos.concat(naSecao ? fechados : fechados.slice(0, 3)).map(p => cartao(p, false)).join('') + '</div>' +
            (!naSecao && fechados.length > 3 ? '<a class="cb-link" href="#/cliente/' + esc(cliente.id) + '/projetos">Ver o histórico todo →</a>' : '')
          : '<p class="gt-vazio">Nenhum projeto ainda. Cliente mensal também pode comprar um trabalho avulso — é só abrir um projeto.</p>') +
        '</section>';
    }
    el.querySelectorAll('[data-pj-novo]').forEach(b => b.onclick = () => abrirNovo(cliente));
  }

  /* ------------------------------------------------- novo projeto */
  async function abrirNovo(cliente) {
    if (!podeGerir()) return B7.UI.toast('Sua conta não cria projetos avulsos. Peça à administração.', { tipo: 'erro' });
    let clientes = [], vms = [];
    try {
      [clientes, vms] = await Promise.all([
        cliente ? Promise.resolve([cliente]) : B7.DB.listarClientes(),
        B7.DB.listarVideomakers().catch(() => [])
      ]);
    } catch (e) { return B7.UI.toast('Não consegui carregar os clientes.', { tipo: 'erro' }); }
    /* avulsos primeiro: é para eles que o projeto existe */
    clientes = clientes.slice().sort((a, b) => (a.contrato === 'avulso' ? 0 : 1) - (b.contrato === 'avulso' ? 0 : 1) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const m = B7.UI.modal('<h3>Novo projeto avulso</h3>' +
      '<div class="sub">Um trabalho pontual, fora do mês. O sistema já cria o que cada tipo precisa: roteiro, gravação e as demandas de edição (que esperam a hora delas).</div>' +
      (cliente ? '<input type="hidden" id="pj-cli" value="' + esc(cliente.id) + '">' :
        '<div class="mb"><label class="rot" for="pj-cli">CLIENTE</label><select class="campo" id="pj-cli"><option value="">Escolha…</option>' +
          clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + (c.contrato === 'avulso' ? ' · avulso' : '') + '</option>').join('') + '</select>' +
          '<small class="leve">Cliente novo? Cadastre em Clientes como “Avulso” e volte aqui.</small></div>') +
      '<div class="mb"><span class="rot">O QUE ELE COMPROU</span><div class="cli-modos pj-tipos">' +
        Object.keys(TIPOS).map((k, i) => '<label class="cli-modo"><input type="radio" name="pj-tipo" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' +
          '<span><b>' + TIPOS[k].r + '</b><small>' + TIPOS[k].d + '</small></span></label>').join('') + '</div></div>' +
      '<div class="mb"><label class="rot" for="pj-nome">NOME DO PROJETO</label><input class="campo" id="pj-nome" maxlength="120" placeholder="Ex.: Vídeo de lançamento" data-foco></div>' +
      '<div class="pj-grade2">' +
        '<div class="mb"><label class="rot" for="pj-qtd">QUANTOS VÍDEOS</label><input class="campo" id="pj-qtd" type="number" min="1" max="30" value="1" inputmode="numeric"></div>' +
        '<div class="mb"><label class="rot" for="pj-prazo">PRAZO DE ENTREGA <span class="leve">— opcional</span></label><input class="campo" id="pj-prazo" type="date"></div>' +
      '</div>' +
      '<div class="pj-grade2" data-so-completo>' +
        '<div class="mb"><label class="rot" for="pj-data">DATA DA GRAVAÇÃO <span class="leve">— opcional</span></label><input class="campo" id="pj-data" type="date"></div>' +
        '<div class="mb"><label class="rot" for="pj-vm">VIDEOMAKER <span class="leve">— opcional</span></label><select class="campo" id="pj-vm"><option value="">Ninguém ainda</option>' +
          (vms || []).map(v => '<option value="' + esc(v.id) + '">' + esc(v.nome) + '</option>').join('') + '</select></div>' +
      '</div>' +
      '<div class="mb"><label class="rot" for="pj-drive">LINK DO DRIVE <span class="leve">— onde o material chega (pode pôr depois)</span></label>' +
        '<input class="campo" id="pj-drive" type="url" placeholder="https://drive.google.com/…"></div>' +
      '<div class="mb"><label class="rot" for="pj-obs">OBSERVAÇÕES <span class="leve">— opcional</span></label><textarea class="campo" id="pj-obs" rows="2" maxlength="2000" placeholder="Referências, combinados com o cliente…"></textarea></div>' +
      '<p class="ajuda" data-pj-resumo></p>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Criar projeto</button></div>', { larga: true });
    const q = s => m.querySelector(s);
    const tipo = () => (m.querySelector('input[name="pj-tipo"]:checked') || {}).value || 'completo';
    const resumo = () => {
      const t = tipo(), n = Math.max(1, Math.min(30, parseInt(q('#pj-qtd').value, 10) || 1));
      const vids = n === 1 ? '1 vídeo' : n + ' vídeos';
      q('[data-so-completo]').hidden = t !== 'completo';
      q('[data-pj-resumo]').textContent = t === 'completo'
        ? 'Vai criar: ' + (n === 1 ? '1 roteiro' : n + ' roteiros') + ', a gravação' + (q('#pj-data').value ? ' na agenda' : ' (sem data ainda)') + ' e ' + vids + ' para editar — que liberam quando a gravação acontecer.'
        : t === 'cliente_grava'
          ? 'Vai criar: ' + (n === 1 ? '1 roteiro' : n + ' roteiros') + ' para mandar ao cliente e ' + vids + ' para editar — que liberam quando o material dele chegar.'
          : 'Vai criar ' + vids + ' para editar — que liberam quando o material do cliente chegar.';
    };
    m.querySelectorAll('input,select').forEach(i => { i.addEventListener('change', resumo); i.addEventListener('input', resumo); });
    resumo();
    const bt = q('[data-ok]');
    bt.onclick = async () => {
      const cli = q('#pj-cli').value, nome = q('#pj-nome').value.trim(), drive = q('#pj-drive').value.trim();
      if (!cli) { q('#pj-cli').classList.add('erro'); q('#pj-cli').focus(); return; }
      if (nome.length < 2) { q('#pj-nome').classList.add('erro'); q('#pj-nome').focus(); return; }
      if (drive && !/^https?:\/\//i.test(drive)) { q('#pj-drive').classList.add('erro'); B7.UI.toast('O link do Drive precisa começar com https://', { tipo: 'erro' }); return; }
      const t = tipo();
      bt.disabled = true;
      try {
        const id = await B7.DB.rpc('projeto_avulso_criar', {
          p_client: cli, p_tipo: t, p_nome: nome, p_qtd: parseInt(q('#pj-qtd').value, 10) || 1, p_prazo: q('#pj-prazo').value || null,
          p_drive: drive, p_obs: q('#pj-obs').value, p_videomaker: t === 'completo' ? (q('#pj-vm').value || null) : null,
          p_data_gravacao: t === 'completo' ? (q('#pj-data').value || null) : null
        });
        m.fechar();
        marcarTem(true);
        B7.UI.toast('Projeto criado. Tudo o que ele precisa já está montado.');
        location.hash = '#/projetos/' + id;
      } catch (e) {
        bt.disabled = false;
        B7.UI.toast((e && e.message) || 'Não foi possível criar o projeto.', { tipo: 'erro' });
      }
    };
  }

  /* --------------------------------------------------------- o projeto */
  async function abrirProjeto(id) {
    B7.Rota.titulo(['Projetos avulsos']);
    painel().innerHTML = '<div class="conteudo entra pj">' + B7.UI.skeleton('detalhe') + '</div>';
    const vale = B7.Rota.marca();
    let p;
    try { p = (await listar(null, false)).find(x => x.id === id); }
    catch (e) { if (!vale()) return; painel().innerHTML = '<div class="conteudo"><div class="cb-aviso erro">' + esc(e.message || 'Não foi possível carregar.') + '</div></div>'; return; }
    if (!vale()) return;
    if (p) marcarTem(true);
    if (!p) {
      painel().innerHTML = '<div class="conteudo"><div class="estado-b7"><b>Projeto não encontrado.</b><p>Ele pode ter sido excluído.</p>' +
        '<div class="acoes"><a class="b" href="#/projetos">Ver os projetos</a></div></div></div>';
      return;
    }
    B7.Rota.titulo(['Projetos avulsos', p.nome]);
    pintarProjeto(p);
  }

  function linhaDoTempo(p) {
    const passos = PASSOS[p.tipo] || [];
    const i = passos.indexOf(p.etapa);
    const datas = {
      roteiro: p.roteiro_aprovado_em ? 'aprovado ' + dataBR(p.roteiro_aprovado_em) : '',
      gravacao: p.gravacao_concluida ? 'gravado' : p.data_gravacao ? dataBR(p.data_gravacao) : '',
      material: p.material_recebido_em ? 'recebido ' + dataBR(p.material_recebido_em) : '',
      entregue: p.entregue_em ? dataBR(p.entregue_em) : ''
    };
    return '<ol class="pj-tempo">' +
      '<li class="feito"><i>✓</i><span><b>Projeto aberto</b><small>' + esc(dataBR(p.created_at)) + '</small></span></li>' +
      passos.map((s, k) => {
        const cls = p.etapa === 'cancelado' ? '' : (p.etapa === 'entregue' || k < i) ? 'feito' : k === i ? 'agora' : '';
        return '<li class="' + cls + '"><i>' + (cls === 'feito' ? '✓' : k + 1) + '</i><span><b>' + esc(s === 'material' && p.tipo === 'cliente_grava' ? 'Cliente grava e manda' : ETAPAS[s]) + '</b>' +
          '<small>' + esc(datas[s] || (cls === 'agora' ? 'agora' : '')) + '</small></span></li>';
      }).join('') +
      (p.etapa === 'cancelado' ? '<li class="cancelado"><i>×</i><span><b>Cancelado</b><small>' + esc(dataBR(p.cancelado_em)) + '</small></span></li>' : '') +
    '</ol>';
  }

  /* o cartão "agora": o que fazer e o botão que faz */
  function proximoPasso(p) {
    const g = podeGerir();
    const temDrive = !!p.drive_link;
    const campoDrive = '<div class="pj-drive"><input class="campo" id="pj-drive-in" type="url" placeholder="Cole o link do Drive com o material" value="' + esc(p.drive_link || '') + '"></div>';
    let tit = '', txt = '', acoes = '';
    if (p.etapa === 'roteiro') {
      tit = 'Roteiro → aprovação do cliente';
      txt = 'Escreva ' + (p.qtd_videos === 1 ? 'o roteiro' : 'os roteiros') + ', mande ao cliente pelo WhatsApp (texto ou PDF) e, quando ele aprovar, marque aqui.';
      acoes = (p.gravacao_id ? '<a class="b contorno" href="#/gravacao/' + esc(p.gravacao_id) + '/roteiros">Escrever roteiro</a>' : '') +
        (B7.WhatsApp && B7.WhatsApp.podeEnviar() ? '<button class="b contorno" data-pj="wa-roteiro">' + (B7.WhatsApp.icone || '') + '<span>Enviar no WhatsApp</span></button>' : '') +
        (p.gravacao_id ? '<a class="b contorno" href="#/gravacao/' + esc(p.gravacao_id) + '/roteiros?imprimir=1">PDF</a>' : '') +
        (g ? '<button class="b pri" data-pj="roteiro_aprovado">Cliente aprovou o roteiro</button>' : '');
    } else if (p.etapa === 'gravacao') {
      tit = p.data_gravacao ? 'Gravação em ' + dataBR(p.data_gravacao) : 'Marcar a gravação';
      txt = 'Quando a gravação for concluída (na tela da gravação ou aqui), a edição é liberada sozinha para o videomaker.';
      acoes = (p.gravacao_id ? '<a class="b contorno" href="#/gravacao/' + esc(p.gravacao_id) + '">Abrir a gravação</a>' : '') +
        (g ? '<button class="b pri" data-pj="gravado">Gravação feita — liberar edição</button>' : '');
    } else if (p.etapa === 'material') {
      tit = p.tipo === 'cliente_grava' ? 'Esperando o cliente gravar' : 'Esperando o material do cliente';
      txt = 'O material chega pelo Drive. Cole o link e marque “Material recebido”: as demandas de edição saem da espera e vão para quem edita.' +
        ' Se demorar, o sistema lembra a coordenação de cobrar a cada 3 dias.';
      acoes = (g ? campoDrive : '') +
        (B7.WhatsApp && B7.WhatsApp.podeEnviar() ? '<button class="b contorno" data-pj="wa-material">' + (B7.WhatsApp.icone || '') + '<span>Pedir no WhatsApp</span></button>' : '') +
        (g ? '<button class="b pri" data-pj="material_recebido">Material recebido</button>' : '');
    } else if (p.etapa === 'edicao' || p.etapa === 'aprovacao') {
      tit = p.etapa === 'edicao' ? 'Em edição' : 'Com o cliente para aprovar';
      txt = 'As demandas seguem na Edição de vídeo, como as de qualquer cliente. O projeto acompanha sozinho: quando todas forem entregues, ele fecha.';
      acoes = (g ? '<button class="b contorno" data-pj="entregue">Marcar tudo como entregue</button>' : '');
    } else {
      tit = p.etapa === 'entregue' ? 'Projeto entregue 🎉' : 'Projeto cancelado';
      txt = p.etapa === 'entregue' ? 'Se o cliente voltar para comprar de novo, abra um projeto novo — o histórico fica aqui.' : 'As demandas que ainda não tinham começado foram descartadas.';
      acoes = g ? '<button class="b contorno" data-pj="reabrir">Reabrir</button>' + (p.etapa === 'entregue' ? '<button class="b pri" data-pj="novo-mesmo">Novo projeto para este cliente</button>' : '') : '';
    }
    return '<section class="pj-agora pj-e-' + esc(p.etapa) + '"><h2>' + esc(tit) + '</h2><p>' + esc(txt) + '</p>' +
      (temDrive && p.etapa !== 'material' ? '<p class="pj-drive-lk"><a href="' + esc(p.drive_link) + '" target="_blank" rel="noopener">Abrir a pasta do Drive ↗</a></p>' : '') +
      (acoes ? '<div class="pj-agora-acoes">' + acoes + '</div>' : '') + '</section>';
  }

  function pintarProjeto(p) {
    const g = podeGerir();
    const dem = p.demandas || [], rots = p.roteiros || [];
    painel().innerHTML = '<div class="conteudo entra pj pj-det">' +
      '<div class="trilha"><a href="#/projetos">Projetos avulsos</a><span>/</span><a href="#/cliente/' + esc(p.client_id) + '/projetos">' + esc(p.cliente) + '</a><span>/</span><b>' + esc(p.nome) + '</b></div>' +
      '<header class="pj-cab">' + B7.UI.avatarCliente(p.cliente, p.cliente_logo, 'cli-av') +
        '<div><p class="pj-cab-cli">' + esc(p.cliente) + '</p><h1>' + esc(p.nome) + '</h1>' +
          '<p class="pj-card-meta">' + chipTipo(p) + chipEtapa(p) + '<span>' + p.qtd_videos + (p.qtd_videos === 1 ? ' vídeo' : ' vídeos') + '</span>' +
            (p.prazo ? '<span>prazo ' + esc(dataBR(p.prazo)) + '</span>' : '') + (p.videomaker ? '<span>' + esc(p.videomaker) + '</span>' : '') + '</p></div>' +
        (g && !['entregue', 'cancelado'].includes(p.etapa) ? '<div class="menu pj-menu"><button class="ico" aria-label="Mais ações">⋯</button><div class="lista">' +
          '<button data-pj="drive-editar">' + (p.drive_link ? 'Trocar o link do Drive' : 'Pôr o link do Drive') + '</button><hr>' +
          '<button class="perigo" data-pj="cancelar">Cancelar projeto</button></div></div>' : '') +
      '</header>' +
      '<div class="pj-det-grade"><div>' + proximoPasso(p) +
        (rots.length ? '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Roteiros</h2></div><div class="pj-itens">' + rots.map(r =>
          '<a class="pj-item" href="#/gravacao/' + esc(p.gravacao_id) + '/roteiros?roteiro=' + esc(r.id) + '"><b>' + esc(r.titulo || 'Sem título') + '</b><span class="pj-st">' + esc(r.status) + '</span></a>').join('') + '</div></section>' : '') +
        '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Edição</h2></div><div class="pj-itens">' + (dem.length ? dem.map(d =>
          '<a class="pj-item" href="#/video/' + esc(d.id) + '"><b>' + esc(d.titulo) + '</b><span class="pj-st pj-ds-' + esc(d.status) + '">' + esc(ST_DEMANDA[d.status] || d.status) + '</span>' +
            (d.videomaker ? '<small>' + esc(d.videomaker) + '</small>' : '') + '</a>').join('') : '<p class="gt-vazio">Sem demandas.</p>') + '</div></section>' +
        (p.observacoes ? '<section class="gt-bloco"><div class="gt-bloco-cab"><h2>Observações</h2></div><p class="pj-obs">' + esc(p.observacoes) + '</p></section>' : '') +
      '</div><aside class="gt-bloco pj-lado"><div class="gt-bloco-cab"><h2>Linha do tempo</h2></div>' + linhaDoTempo(p) + '</aside></div></div>';
    ligarProjeto(p);
  }

  function ligarProjeto(p) {
    const raiz = painel();
    if (B7.UI.ligarMenus) B7.UI.ligarMenus(raiz);
    const recarregar = () => abrirProjeto(p.id);
    const fazer = async (acao, drive, ok) => {
      try { await avancar(p, acao, drive); if (ok) B7.UI.toast(ok); recarregar(); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    raiz.querySelectorAll('[data-pj]').forEach(b => b.onclick = async ev => {
      ev.stopPropagation();
      const a = b.dataset.pj;
      if (a === 'roteiro_aprovado') return fazer(a, null, p.tipo === 'completo' ? 'Roteiro aprovado. Próximo passo: a gravação.' : 'Roteiro aprovado. Agora é com o cliente: gravar e mandar o material.');
      if (a === 'gravado') {
        if (!await B7.UI.confirmar({ titulo: 'A gravação aconteceu?', texto: 'As demandas de edição saem da espera e vão para quem edita.', rotulo: 'Liberar edição' })) return;
        return fazer(a, null, 'Edição liberada.');
      }
      if (a === 'material_recebido') {
        const inp = raiz.querySelector('#pj-drive-in');
        const link = inp ? inp.value.trim() : '';
        if (!link && !p.drive_link) { if (inp) { inp.classList.add('erro'); inp.focus(); } return B7.UI.toast('Cole o link do Drive com o material.', { tipo: 'erro' }); }
        return fazer(a, link && link !== p.drive_link ? link : null, 'Material recebido. A edição já está na fila.');
      }
      if (a === 'entregue') {
        if (!await B7.UI.confirmar({ titulo: 'Fechar o projeto como entregue?', texto: 'Todas as demandas abertas dele ficam como entregues.', rotulo: 'Marcar entregue' })) return;
        return fazer(a, null, 'Projeto entregue.');
      }
      if (a === 'cancelar') {
        if (!await B7.UI.confirmar({ titulo: 'Cancelar este projeto?', texto: 'As demandas que ainda não começaram são descartadas. Dá para reabrir depois.', rotulo: 'Cancelar projeto', perigo: true })) return;
        return fazer(a, null, 'Projeto cancelado.');
      }
      if (a === 'reabrir') return fazer(a, null, 'Projeto reaberto.');
      if (a === 'novo-mesmo') return abrirNovo({ id: p.client_id, nome: p.cliente });
      if (a === 'drive-editar') {
        const m = B7.UI.modal('<h3>Link do Drive</h3><div class="mb"><input class="campo" id="pj-dv" type="url" data-foco value="' + esc(p.drive_link || '') + '" placeholder="https://drive.google.com/…"></div>' +
          '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Salvar</button></div>');
        m.querySelector('[data-ok]').onclick = async () => {
          const v = m.querySelector('#pj-dv').value.trim();
          if (!/^https?:\/\//i.test(v)) { m.querySelector('#pj-dv').classList.add('erro'); return; }
          m.fechar(); fazer('drive', v, 'Link salvo.');
        };
        return;
      }
      if (a === 'wa-roteiro') return enviarRoteiro(p);
      if (a === 'wa-material') {
        const inp = raiz.querySelector('#pj-drive-in');
        return B7.WhatsApp.enviar({ tipo: 'material', clienteId: p.client_id, clienteNome: p.cliente, titulo: p.nome, link: (inp && inp.value.trim()) || p.drive_link || '' });
      }
    });
  }

  /* o roteiro em texto de WhatsApp: *negrito* no título, cenas numeradas */
  async function enviarRoteiro(p) {
    let cenas = [];
    const rots = p.roteiros || [];
    try { cenas = rots.length ? await B7.DB.listarCenasDaGravacao(rots.map(r => r.id)) : []; } catch (e) { cenas = []; }
    const texto = rots.map(r => {
      const cs = cenas.filter(c => c.script_id === r.id).sort((a, b) => a.position - b.position);
      const corpo = cs.map((c, i) => {
        const fala = String(c.texto || '').replace(/<[^>]+>/g, '').trim();
        const dir = String(c.direcao || '').replace(/<[^>]+>/g, '').trim();
        return (i + 1) + '. ' + (fala || '—') + (dir ? '\n   _' + dir + '_' : '');
      }).join('\n');
      return (rots.length > 1 ? '*' + (r.titulo || 'Roteiro') + '*\n' : '') + (corpo || '(roteiro ainda sem cenas)');
    }).join('\n\n');
    if (!cenas.length) B7.UI.toast('O roteiro ainda está vazio — escreva as cenas antes de mandar.', { tipo: 'erro' });
    B7.WhatsApp.enviar({ tipo: 'roteiro', clienteId: p.client_id, clienteNome: p.cliente, titulo: rots.length === 1 ? (rots[0].titulo || p.nome) : p.nome, texto });
  }

  return { abrir, secaoCliente, montarGestao, novo: abrirNovo, podeGerir, temAlgum, conferirTem, _espera: espera, TIPOS, PASSOS };
})();
