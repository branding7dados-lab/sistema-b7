/* =====================================================================
   USUÁRIOS E ACESSOS — só para o Administrador

   Nada aqui decide permissão: toda operação passa pela função b7-auth,
   que relê o papel de quem chamou direto do banco. Se alguém abrir esta
   tela sem ser admin, os botões existem mas o backend recusa.

   A senha aparece uma única vez, no momento da criação ou da
   redefinição, para a equipe copiar e entregar. Depois disso ela não é
   recuperável — nem por aqui, nem por ninguém.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Usuarios = (function () {
  const esc = B7.UI.esc;
  /* zzz244: Usuários e acessos mora dentro das Configurações (seção
     "Pessoas e acessos"); lá abrir() recebe { alvo } e desenha nele */
  let hospede = null, matrizAlvo = null;
  const painel = () => hospede || document.getElementById('painel-dashboard');
  const vivo = el => !!(el && el.isConnected && el.dataset.montado);
  const naTela = () => location.hash.indexOf('#/usuarios') === 0 || vivo(hospede) || vivo(matrizAlvo);
  /* zzz249: depois de salvar, redesenha onde a pessoa está (lista de contas
     nas Configurações, a matriz de permissões ou a tela antiga #/usuarios) */
  const reabrir = () => {
    if (vivo(matrizAlvo)) montarMatriz(matrizAlvo);
    if (vivo(hospede)) return abrir({ alvo: hospede });
    if (location.hash.indexOf('#/usuarios') === 0) return abrir();
  };

  const PAPEIS = [
    ['admin', 'Administrador', 'controla a plataforma, contas e configurações'],
    ['coordenador', 'Coordenador de mídias', 'produz e organiza o conteúdo'],
    ['designer', 'Designer', 'produz as artes a partir da Linha Editorial'],
    ['videomaker', 'Videomaker', 'filma e edita os vídeos das demandas'],
    ['cliente', 'Cliente', 'acompanha e aprova o que foi liberado']
  ];
  const rotuloPapel = p => (PAPEIS.find(x => x[0] === p) || [, p])[1];

  /* Funções extras de produção (B7 Vídeo Parte 1.1): aditivo ao papel
     principal acima, não substitui nada. Hoje só "videomaker" — uma
     pessoa continua com UM papel (ex.: Administrador) e pode acumular
     essa função extra sem precisar de uma segunda conta (ex.: Kevin,
     Administrador + Videomaker, numa conta só). Nunca combina com
     Cliente (perfil externo) — o bloco some quando o papel escolhido é
     "cliente", tanto ao criar quanto ao editar. */
  const FUNCOES_EXTRA = [
    ['videomaker', 'Videomaker', 'também filma e edita, além do papel principal'],
    /* Coordenação como função extra existe só para o Administrador: ele
       já tem, no banco, todas as permissões de coordenação; a função só
       liga o Painel do Coordenador (casa padrão). Em qualquer outro papel
       ela exigiria permissões que o papel não tem — por isso some. */
    ['coordenador', 'Coordenador de mídias', 'recebe o Painel de coordenação (só para Administrador)'],
    /* Designer como função extra: só Administrador e Coordenador (já são
       equipe no banco — leem e editam todo o Design). A função faz a
       pessoa aparecer como responsável possível das peças e ganhar o
       Painel do Designer. */
    ['designer', 'Designer', 'pode receber peças de Design (Administrador ou Coordenador)']
  ];
  /* a função extra não se aplica a este papel? (redundante ou restrita) */
  const extraIndisponivel = (funcao, papel) => funcao === papel || (funcao === 'coordenador' && papel !== 'admin') ||
    (funcao === 'designer' && papel !== 'admin' && papel !== 'coordenador');
  const rotuloFuncaoExtra = f => (FUNCOES_EXTRA.find(x => x[0] === f) || [, f])[1];

  /* =================================================================
     LISTA
     ================================================================= */
  /* =================================================================
     FUNÇÕES E ACESSOS (zzz68)
     Conta interna = administrador (sim/não) + UMA função principal +
     módulos. Os módulos vêm do PADRÃO da função (herança de verdade:
     mudar o padrão muda todo mundo que não tem exceção) e cada pessoa
     pode ter exceções — um módulo a mais ou um a menos.
     A função NÃO muda por causa de um módulo. Quem grava é o servidor
     (b7-auth), que confere se quem chamou é administrador.
     ================================================================= */
  const FUNCOES = [
    ['coordenador', 'Coordenador', 'organiza conteúdo, linha editorial e aprovações'],
    ['designer', 'Designer', 'produz as artes'],
    ['videomaker', 'Videomaker', 'filma e edita']
  ];
  /* zzz216: funções personalizadas ('p_...') vêm do banco; rótulo e base */
  const personalizada = fn => (ACESSO.personalizadas || []).find(x => x.id === fn) || null;
  const rotuloFuncao = fn => { const p = personalizada(fn); return p ? p.rotulo : (FUNCOES.find(x => x[0] === fn) || [, 'Sem função'])[1]; };
  const todasFuncoes = () => FUNCOES.map(([v, r, d]) => ({ id: v, rotulo: r, descricao: d, base: null }))
    .concat((ACESSO.personalizadas || []).map(p => ({ id: p.id, rotulo: p.rotulo, descricao: p.descricao || '', base: p.base })));
  /* carregado a cada abertura da tela (listar_usuarios) */
  let ACESSO = { modulos: [], presets: {}, presetNivel: {}, excecoes: {}, personalizadas: [], secundarias: {} };
  /* zzz215: nível dentro de cada módulo. Total = editar + aprovar + excluir. */
  const NIVEIS = [['sem', 'Sem acesso', 'a tela some'], ['ver', 'Ver', 'abre e consulta, sem alterar'],
                  ['editar', 'Editar', 'cria e altera, sem aprovar nem excluir'], ['total', 'Total', 'edita, aprova e exclui']];
  const rotuloNivel = n => (NIVEIS.find(x => x[0] === n) || NIVEIS[3])[1];
  function seletorNivel(mod, atual, pers, base) {
    return '<div class="ac-nv" role="radiogroup" aria-label="Nível">' + NIVEIS.map(([v, r, d]) =>
      '<button type="button" role="radio" aria-checked="' + (v === atual) + '" class="ac-nv-b anv-' + v + (v === atual ? ' on' : '') +
      (base && v === base && v !== atual ? ' base' : '') + '" data-mod="' + esc(mod) + '" data-nv="' + v + '" title="' + esc(r + ': ' + d) + '">' + r + '</button>').join('') + '</div>';
  }
  function carregarAcesso(dados) {
    const reg = (dados.modulos && dados.modulos.length) ? dados.modulos
      : (B7.Perm && B7.Perm.MODULOS ? B7.Perm.MODULOS.map(m => ({ id: m.id, rotulo: m.rotulo })) : []);
    const presets = { coordenador: [], designer: [], videomaker: [] }, presetNivel = { coordenador: {}, designer: {}, videomaker: {} };
    if (dados.presets) dados.presets.forEach(p => {
      (presets[p.funcao] = presets[p.funcao] || []).push(p.modulo);
      (presetNivel[p.funcao] = presetNivel[p.funcao] || {})[p.modulo] = p.nivel || 'total';
    });
    else if (B7.Perm && B7.Perm.PADRAO_FUNCAO) Object.assign(presets, B7.Perm.PADRAO_FUNCAO);
    const excecoes = {};
    (dados.excecoes || []).forEach(e => { (excecoes[e.perfil_id] = excecoes[e.perfil_id] || {})[e.modulo] = e.efeito === 'negar' ? 'negar' : (e.nivel || 'permitir'); });
    const secundarias = {};
    (dados.secundarias || []).forEach(x => { (secundarias[x.perfil_id] = secundarias[x.perfil_id] || {})[x.funcao] = x.nivel_max; });
    ACESSO = { modulos: reg, presets, presetNivel, excecoes, personalizadas: dados.personalizadas || [], secundarias };
  }
  /* nível do pacote de uma função num módulo; e o somatório função + secundárias (com teto) + cargos */
  const ORD = { sem: 0, ver: 1, editar: 2, total: 3 }, DE_ORD = ['sem', 'ver', 'editar', 'total'];
  const nivelPacote = (fn, md) => (ACESSO.presets[fn] || []).includes(md) ? ((ACESSO.presetNivel[fn] || {})[md] || 'total') : 'sem';
  function nivelSomado(fn, sec, cargos, md) {
    let n = ORD[nivelPacote(fn, md)];
    (cargos || []).forEach(c => { n = Math.max(n, ORD[nivelPacote(c, md)]); });
    Object.keys(sec || {}).forEach(f => { n = Math.max(n, Math.min(ORD[nivelPacote(f, md)], ORD[sec[f]] || 0)); });
    return DE_ORD[n];
  }
  const identidadeDe = u => ({
    tipo: u.papel === 'cliente' ? 'cliente' : 'interno',
    ehAdmin: u.eh_admin !== undefined ? !!u.eh_admin : u.papel === 'admin',
    funcao: u.funcao_personalizada || (u.funcao !== undefined ? (u.funcao || '') : (['coordenador', 'designer', 'videomaker'].includes(u.papel) ? u.papel : ''))
  });
  function modulosEfetivosDe(u) {
    const id = identidadeDe(u);
    if (id.tipo === 'cliente') return [];
    if (id.ehAdmin) return ACESSO.modulos.map(m => m.id);
    return ACESSO.modulos.map(m => m.id).filter(m => nivelDe(u, m) !== 'sem');
  }
  /* zzz215: nível da pessoa no módulo e o do padrão da função dela */
  function nivelPadraoDe(u, md) {
    return nivelSomado(identidadeDe(u).funcao, ACESSO.secundarias[u.id], (u.funcoes_adicionais || []), md);
  }
  function nivelDe(u, md) {
    const idt = identidadeDe(u);
    if (idt.tipo === 'cliente') return 'sem';
    if (idt.ehAdmin) return 'total';
    const ex = (ACESSO.excecoes[u.id] || {})[md], nb = nivelPadraoDe(u, md);
    if (!ex) return nb;
    if (ex === 'negar') return 'sem';
    if (ex === 'permitir') return nb === 'sem' ? 'total' : nb;
    return ex;
  }
  const rotuloModulo = id => (ACESSO.modulos.find(m => m.id === id) || { rotulo: id }).rotulo;

  const ICU = {
    pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/></svg>',
    id: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16a3.4 3.4 0 0 1 6.4 0M14.5 10h3.5M14.5 13.5h2.5"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    emp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/></svg>',
    extra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
    chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/></svg>'
  };
  const IC_ACESSO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  function acessoTipoHTML(px, tipo) {
    return '<section class="ng-bloco ac-tipo"><h4>' + IC_ACESSO + 'Tipo de conta</h4>' +
      '<div class="nu-papeis ac-dois" id="' + px + '-tipo">' +
        '<button type="button" class="nu-papel' + (tipo === 'interno' ? ' on' : '') + '" data-tipo="interno"><i aria-hidden="true"></i><b>Equipe B7</b></button>' +
        '<button type="button" class="nu-papel' + (tipo === 'cliente' ? ' on' : '') + '" data-tipo="cliente"><i aria-hidden="true"></i><b>Cliente</b></button>' +
      '</div>' +
      '<div class="nu-papel-desc" id="' + px + '-tipo-desc"></div></section>';
  }
  function acessoInternoHTML(px) {
    return '<section class="ng-bloco ac-interno" id="' + px + '-interno"><h4>' + IC_ACESSO + 'Função e acesso</h4>' +
      '<label class="op-mini nu-chave-linha ac-admin" id="' + px + '-admin"><span>Administrador' +
        '<small>abre tudo e gerencia contas e configurações</small></span><input type="checkbox" role="switch"></label>' +
      '<label class="rot ac-rot">FUNÇÃO PRINCIPAL</label>' +
      '<div class="nu-papeis ac-funcoes' + (todasFuncoes().length > 3 ? ' ac-varias' : '') + '" id="' + px + '-funcao">' +
        todasFuncoes().map(f => '<button type="button" class="nu-papel' + (f.base ? ' ac-fn-pers' : '') + '" data-funcao="' + esc(f.id) + '"><i aria-hidden="true"></i><b>' + esc(f.rotulo) + '</b></button>').join('') +
        '<button type="button" class="nu-papel" data-funcao=""><i aria-hidden="true"></i><b>Nenhuma</b></button>' +
      '</div>' +
      '<p class="gv-ajuda ac-ajuda" id="' + px + '-fdesc"></p>' +
      '<div class="ac-sec" id="' + px + '-sec-bloco"><label class="rot ac-rot">OUTRAS FUNÇÕES</label>' +
        '<p class="gv-ajuda ac-ajuda">Para quem ajuda em outra área. <b>Ver/Editar/Total</b> abre os módulos daquela função até esse nível, sem mudar a função. ' +
        '<b>Atua como</b> faz a pessoa também receber o trabalho dela e ganhar o Painel.</p>' +
        '<div class="ac-sec-lista" id="' + px + '-sec"></div></div>' +
      '<div class="ac-mod-cab"><label class="rot ac-rot">ACESSO AOS MÓDULOS</label>' +
        '<button type="button" class="ac-restaurar" id="' + px + '-restaurar" hidden>Restaurar padrão</button></div>' +
      '<p class="ac-resumo" id="' + px + '-resumo"></p>' +
      '<p class="gv-ajuda ac-nota" id="' + px + '-nota" hidden></p>' +
      '<div class="ac-mods" id="' + px + '-mods"></div>' +
    '</section>';
  }
  /* zzz70: empresas do cliente — o mesmo bloco ao criar e ao editar
     (pílulas com busca e contador). zzz261: em cada empresa marcada, o
     papel da pessoa (Dono, Gestor, Equipe), no lugar do "pode aprovar".
     ligadas: [{ client_id, papel }] */
  const PAPEIS_CLI = [['dono', 'Dono', 'vê tudo, aprova e cuida da equipe'], ['gestor', 'Gestor', 'vê tudo e aprova'], ['equipe', 'Equipe', 'vê e comenta']];
  function clienteHTML(px, clientes, ligadas) {
    const lig = (ligadas || []).map(v => v.client_id);
    return '<section class="ng-bloco" id="' + px + '-cliente"><h4>' + ICU.emp + 'Empresas que acompanha' +
        '<span class="mg-obr leve" id="' + px + '-cont">nenhuma</span></h4>' +
        (clientes.length
          ? (clientes.length > 8 ? '<div class="nu-busca"><input class="campo" id="' + px + '-busca-emp" type="search" placeholder="Buscar empresa…" aria-label="Buscar empresa"></div>' : '') +
            '<div class="nu-empresas nu-pilulas">' + clientes.map(c =>
              '<label class="op-mini' + (lig.includes(c.id) ? ' on' : '') + '" data-nome="' + esc(String(c.nome).toLowerCase()) + '">' +
              '<input type="checkbox" value="' + esc(c.id) + '"' + (lig.includes(c.id) ? ' checked' : '') + '>' +
              '<span>' + esc(c.nome) + '</span></label>').join('') + '</div>'
          : '<div class="vazio-leve">Cadastre um cliente primeiro.</div>') +
        '<div class="nu-papel-emp" id="' + px + '-papeis"></div>' +
      '</section>';
  }
  function ligarCliente(m, px, ligadas, clientes) {
    const bloco = m.querySelector('#' + px + '-cliente');
    /* papel escolhido por empresa; quem é marcada agora começa como Dono
       (a B7 cria o dono, e o dono convida o resto pelo portal) */
    const papel = {};
    (ligadas || []).forEach(v => { papel[v.client_id] = v.papel || 'gestor'; });
    const nomeDe = id => ((clientes || []).find(c => c.id === id) || {}).nome || '';
    const marcadas = () => [...bloco.querySelectorAll('.nu-pilulas input:checked')].map(c => c.value);
    const pintarPapeis = () => {
      const alvo = m.querySelector('#' + px + '-papeis');
      const ids = marcadas();
      alvo.innerHTML = ids.length ? '<span class="rot">PAPEL EM CADA EMPRESA</span>' + ids.map(id =>
        '<div class="nu-pe-linha"><b>' + esc(nomeDe(id)) + '</b><select class="campo fina" data-papel-emp="' + esc(id) + '" aria-label="Papel em ' + esc(nomeDe(id)) + '">' +
          PAPEIS_CLI.map(([k, r, t]) => '<option value="' + k + '"' + ((papel[id] || 'dono') === k ? ' selected' : '') + '>' + r + ' · ' + t + '</option>').join('') +
        '</select></div>').join('') : '';
      alvo.querySelectorAll('[data-papel-emp]').forEach(sel => sel.onchange = () => { papel[sel.dataset.papelEmp] = sel.value; });
    };
    bloco.lerEmpresas = () => marcadas().map(id => ({ client_id: id, papel: papel[id] || 'dono' }));
    const contar = () => {
      const n = bloco.querySelectorAll('.nu-pilulas input:checked').length;
      const c = m.querySelector('#' + px + '-cont');
      if (c) { c.textContent = n ? n + (n === 1 ? ' selecionada' : ' selecionadas') : 'nenhuma'; c.classList.toggle('leve', !n); }
    };
    bloco.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () => {
      cx.closest('.op-mini').classList.toggle('on', cx.checked);
      contar(); pintarPapeis();
    });
    const buscaEmp = m.querySelector('#' + px + '-busca-emp');
    if (buscaEmp) buscaEmp.oninput = () => {
      const t = buscaEmp.value.trim().toLowerCase();
      bloco.querySelectorAll('.nu-pilulas .op-mini').forEach(l => { l.hidden = !!t && !l.dataset.nome.includes(t); });
    };
    contar(); pintarPapeis();
    return bloco;
  }
  /* o "pode aprovar" da conta acompanha os papéis (sessões antigas ainda o leem) */
  const aprovaPorPapel = lista => lista.some(e => e.papel === 'dono' || e.papel === 'gestor');
  /* ini: { tipo, ehAdmin, funcao, excecoes, secundarias, cargos } — aoTipo(tipo) avisa a troca cliente/equipe.
     zzz216: secundarias = { funcao: 'ver'|'editar'|'total' } (abre o pacote até o nível, sem mudar a função);
     cargos = funções que a pessoa também exerce de verdade (recebe trabalho e ganha o Painel). */
  function ligarAcesso(m, px, ini, aoTipo) {
    const E = { tipo: ini.tipo, ehAdmin: !!ini.ehAdmin, funcao: ini.funcao || '', excecoes: Object.assign({}, ini.excecoes || {}),
                secundarias: Object.assign({}, ini.secundarias || {}), cargos: (ini.cargos || []).slice() };
    const funcaoInicial = E.funcao;
    const q = sel => m.querySelector('#' + px + '-' + sel);
    const nivelBase = id => nivelSomado(E.funcao, E.secundarias, E.cargos, id);
    const nivelEf = id => {
      if (E.ehAdmin) return 'total';
      const ex = E.excecoes[id];
      if (!ex) return nivelBase(id);
      if (ex === 'negar') return 'sem';
      if (ex === 'permitir') return nivelBase(id) === 'sem' ? 'total' : nivelBase(id);
      return ex;
    };
    const efetivo = id => nivelEf(id) !== 'sem';
    /* exceção que ficou igual ao padrão deixa de ser exceção */
    const limpar = () => { Object.keys(E.excecoes).forEach(id => { if (nivelEf(id) === nivelBase(id)) delete E.excecoes[id]; }); };
    const baseDe = fn => { const p = personalizada(fn); return p ? p.base : fn; };

    function pintarSecundarias() {
      const outras = todasFuncoes().filter(f => f.id !== E.funcao);
      /* a função de base da principal não entra como "atua como" dela mesma */
      q('sec').innerHTML = outras.map(f => {
        const ehCargo = E.cargos.includes(f.id), nv = E.secundarias[f.id] || '';
        const podeCargo = !f.base && f.id !== baseDe(E.funcao);
        const op = [['', 'Não'], ['ver', 'Ver'], ['editar', 'Editar'], ['total', 'Total']].concat(podeCargo ? [['cargo', 'Atua como']] : []);
        const atual = ehCargo ? 'cargo' : nv;
        return '<div class="ac-sec-linha' + (atual ? ' on' : '') + '"><span><b>' + esc(f.rotulo) + '</b>' +
            (f.base ? '<small>personalizada · base ' + esc(rotuloFuncao(f.base)) + '</small>' : '') + '</span>' +
          '<div class="ac-nv">' + op.map(([v, r]) => '<button type="button" class="ac-nv-b' + (v === atual ? ' on' : '') +
            (v === 'cargo' ? ' anv-cargo' : v ? ' anv-' + v : ' anv-sem') + '" data-sec="' + esc(f.id) + '" data-v="' + v + '">' + r + '</button>').join('') + '</div></div>';
      }).join('');
      q('sec').querySelectorAll('[data-sec]').forEach(b => b.onclick = () => {
        const f = b.dataset.sec, v = b.dataset.v;
        E.cargos = E.cargos.filter(x => x !== f); delete E.secundarias[f];
        if (v === 'cargo') E.cargos.push(f); else if (v) E.secundarias[f] = v;
        pintar();
      });
    }

    function pintar() {
      /* a principal não pode ser também secundária/cargo */
      delete E.secundarias[E.funcao]; E.cargos = E.cargos.filter(c => c !== E.funcao && c !== baseDe(E.funcao));
      limpar();
      q('tipo').querySelectorAll('[data-tipo]').forEach(b => b.classList.toggle('on', b.dataset.tipo === E.tipo));
      q('tipo-desc').textContent = E.tipo === 'cliente' ? 'Acompanha e aprova o que foi liberado, só no Portal.'
        : 'Pessoa da equipe: tem uma função e abre os módulos liberados.';
      q('interno').style.display = E.tipo === 'interno' ? '' : 'none';
      const adm = q('admin'); adm.querySelector('input').checked = E.ehAdmin; adm.classList.toggle('on', E.ehAdmin);
      q('funcao').classList.toggle('ac-tres', !E.ehAdmin);
      q('funcao').querySelectorAll('[data-funcao]').forEach(b => {
        b.classList.toggle('on', b.dataset.funcao === E.funcao);
        /* "Nenhuma" só existe para administrador */
        if (b.dataset.funcao === '') b.hidden = !E.ehAdmin;
      });
      const fn = FUNCOES.find(x => x[0] === E.funcao), fp = personalizada(E.funcao);
      q('fdesc').textContent = fp ? fp.rotulo + (fp.descricao ? ': ' + fp.descricao : '') + '. Função personalizada, com base em ' + rotuloFuncao(fp.base) +
          ' (a base define o Painel e o trabalho que a pessoa pode receber).'
        : fn ? fn[1] + ': ' + fn[2] + '. Define o Painel e o trabalho que a pessoa pode receber.'
        : E.ehAdmin ? 'Sem função: só administra, sem Painel de produção.' : 'Escolha a função da pessoa.';
      q('sec-bloco').hidden = E.ehAdmin || !E.funcao;
      if (!E.ehAdmin && E.funcao) pintarSecundarias();
      const n = Object.keys(E.excecoes).length;
      q('restaurar').hidden = E.ehAdmin || !n;
      const nota = q('nota');
      nota.hidden = !(n && !E.ehAdmin && E.funcao !== funcaoInicial);
      nota.textContent = 'A função mudou: o padrão passa a ser o de ' + rotuloFuncao(E.funcao) + '. ' +
        (n === 1 ? 'A personalização continua' : 'As ' + n + ' personalizações continuam') + ' valendo — use "Restaurar padrão" para tirar.';
      const total = ACESSO.modulos.length, abertos = ACESSO.modulos.filter(md => efetivo(md.id)).length;
      const nSec = Object.keys(E.secundarias).length + E.cargos.length;
      const resumo = q('resumo');
      resumo.classList.toggle('pers', !E.ehAdmin && n > 0);
      resumo.textContent = E.ehAdmin ? 'Administrador abre todos os módulos.'
        : !E.funcao ? 'Os módulos aparecem depois de escolher a função.'
        : abertos + ' de ' + total + ' · padrão de ' + rotuloFuncao(E.funcao) +
          (nSec ? ' + ' + nSec + (nSec === 1 ? ' outra função' : ' outras funções') : '') +
          (n ? ' + ' + n + (n === 1 ? ' personalização' : ' personalizações') : '');
      q('mods').hidden = E.ehAdmin || !E.funcao;
      q('mods').innerHTML = ACESSO.modulos.map(md => {
        const nv = nivelEf(md.id), nb = nivelBase(md.id), pers = !E.ehAdmin && !!E.excecoes[md.id];
        return '<div class="ac-mod ac-mod-nv' + (nv !== 'sem' ? ' on' : '') + (pers ? ' pers' : '') + '"' +
          (pers ? ' title="Padrão: ' + esc(rotuloNivel(nb)) + '"' : '') + '>' +
          '<span>' + esc(md.rotulo) + (pers ? '<em class="ac-tag">personalizado · padrão ' + esc(rotuloNivel(nb)) + '</em>' : '') + '</span>' +
          seletorNivel(md.id, nv, pers, nb) + '</div>';
      }).join('');
      q('mods').querySelectorAll('[data-nv]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.mod, v = b.dataset.nv;
        if (v === nivelBase(id)) delete E.excecoes[id];
        else E.excecoes[id] = v === 'sem' ? 'negar' : v;
        pintar();
      }));
    }
    q('tipo').querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => {
      E.tipo = b.dataset.tipo; pintar(); if (aoTipo) aoTipo(E.tipo);
    }));
    q('admin').querySelector('input').addEventListener('change', ev => {
      E.ehAdmin = ev.target.checked;
      if (!E.ehAdmin && !E.funcao) E.funcao = funcaoInicial || '';
      pintar();
    });
    q('funcao').querySelectorAll('[data-funcao]').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      E.funcao = b.dataset.funcao; pintar();
    }));
    q('restaurar').addEventListener('click', () => { E.excecoes = {}; pintar(); });
    pintar();
    if (aoTipo) aoTipo(E.tipo);
    return {
      tipo: () => E.tipo,
      /* cargos lidos depois (vêm do banco) */
      definirCargos(lista) { E.cargos = (lista || []).filter(c => FUNCOES.some(f => f[0] === c)); pintar(); },
      /* devolve os campos do pedido, ou { erro } */
      ler() {
        if (E.tipo === 'cliente') return { tipo: 'cliente', papel: 'cliente' };
        if (!E.ehAdmin && !E.funcao) return { erro: 'Escolha a função principal (ou marque Administrador).' };
        limpar();
        return { tipo: 'interno', eh_admin: E.ehAdmin, funcao: E.funcao || null, modulos: E.ehAdmin ? {} : Object.assign({}, E.excecoes),
                 secundarias: E.ehAdmin ? {} : Object.assign({}, E.secundarias), cargos: E.ehAdmin ? [] : E.cargos.slice() };
      }
    };
  }

  /* Funções e acessos: o pacote de cada função (as três do sistema e as
     personalizadas). Salvar muda o acesso de TODOS que têm a função e não
     têm exceção no módulo. zzz216: criar, renomear e excluir funções
     personalizadas (com base numa das três). */
  function modalFuncoes(usuarios, inicial) {
    let atual = inicial || 'coordenador';
    const pessoas = (usuarios || []).filter(u => u.papel !== 'cliente' && u.estado === 'ativa');
    const rasc = {}, meta = {};
    /* rasc[funcao] = { modulo: 'ver' | 'editar' | 'total' } — módulo fora = sem acesso */
    const doPadrao = v => { const o = {}; (ACESSO.presets[v] || []).forEach(md => { o[md] = (ACESSO.presetNivel[v] || {})[md] || 'total'; }); return o; };
    const assinatura = o => Object.keys(o).sort().map(k => k + ':' + o[k]).join();
    todasFuncoes().forEach(f => { rasc[f.id] = doPadrao(f.id); if (f.base) meta[f.id] = { rotulo: f.rotulo, descricao: f.descricao, base: f.base }; });
    const NOVA = '__nova';
    rasc[NOVA] = {}; meta[NOVA] = { rotulo: '', descricao: '', base: 'designer' };
    const m = B7.UI.modal('<div class="ng-topo"><span class="ng-ic">' + IC_ACESSO + '</span><div><h3>Funções e acessos</h3>' +
      '<div class="sub">O que cada função abre e em que nível. Quem tem a função herda — menos onde a pessoa tem um acesso personalizado.</div></div></div>' +
      '<div class="fa-abas" id="fa-abas"></div>' +
      '<div class="fa-meta" id="fa-meta"></div>' +
      '<p class="ac-quem" id="fa-quem"></p>' +
      '<div class="ac-mods" id="fa-mods"></div>' +
      '<div id="fa-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Fechar</button>' +
      '<button class="b pri" id="fa-salvar">Salvar padrão</button></div>', { larga: true, extra: 'ng-modal nu-modal fa-modal' });
    const ehPers = fn => fn === NOVA || !!meta[fn];
    const mudouMeta = fn => ehPers(fn) && fn !== NOVA && (() => { const p = personalizada(fn) || {}; return meta[fn].rotulo.trim() !== p.rotulo || (meta[fn].descricao || '') !== (p.descricao || '') || meta[fn].base !== p.base; })();
    const mudou = fn => fn === NOVA ? !!meta[NOVA].rotulo.trim() : (assinatura(rasc[fn]) !== assinatura(doPadrao(fn)) || mudouMeta(fn));
    function pintarAbas() {
      const lista = todasFuncoes().map(f => f.id).concat([NOVA]);
      m.querySelector('#fa-abas').innerHTML = lista.map(id => {
        const n = Object.keys(rasc[id]).length;
        return '<button type="button" class="fa-aba' + (id === atual ? ' on' : '') + (id === NOVA ? ' fa-nova' : ehPers(id) ? ' fa-pers' : '') + '" data-aba="' + esc(id) + '">' +
          (id === NOVA ? '<b>+ Nova função</b><small>com nome seu</small>'
            : '<b>' + esc(rotuloFuncao(id)) + (mudou(id) ? ' •' : '') + '</b><small>' + n + (n === 1 ? ' módulo' : ' módulos') + (ehPers(id) ? ' · personalizada' : '') + '</small>') +
          '</button>';
      }).join('');
      m.querySelectorAll('#fa-abas [data-aba]').forEach(b => b.onclick = () => { atual = b.dataset.aba; pintar(); });
    }
    function pintarMeta() {
      const box = m.querySelector('#fa-meta');
      if (!ehPers(atual)) { box.innerHTML = ''; box.hidden = true; return; }
      box.hidden = false;
      const mt = meta[atual];
      box.innerHTML = '<div class="fa-meta-grid"><div><label class="rot" for="fa-nome">NOME DA FUNÇÃO</label>' +
          '<input class="campo" id="fa-nome" maxlength="40" placeholder="Ex.: Social media" value="' + esc(mt.rotulo) + '"></div>' +
        '<div><label class="rot" for="fa-desc">O QUE FAZ <span class="leve">(opcional)</span></label>' +
          '<input class="campo" id="fa-desc" maxlength="160" placeholder="Ex.: posta e responde nas redes" value="' + esc(mt.descricao || '') + '"></div></div>' +
        '<label class="rot">FUNÇÃO DE BASE</label>' +
        '<div class="fa-bases">' + FUNCOES.map(([v, r, d]) => '<button type="button" class="fa-base' + (mt.base === v ? ' on' : '') + '" data-base="' + v + '"><b>' + r + '</b><small>' + d + '</small></button>').join('') + '</div>' +
        '<p class="gv-ajuda">A base define o Painel e o trabalho que a pessoa pode receber. Os módulos abaixo definem o que ela abre.</p>' +
        (atual !== NOVA ? '<button type="button" class="fa-excluir" id="fa-excluir">Excluir esta função</button>' : '');
      box.querySelector('#fa-nome').oninput = e => { mt.rotulo = e.target.value; pintarRodape(); };
      box.querySelector('#fa-desc').oninput = e => { mt.descricao = e.target.value; pintarRodape(); };
      box.querySelectorAll('[data-base]').forEach(b => b.onclick = () => { mt.base = b.dataset.base; pintarMeta(); pintarRodape(); });
      const ex = box.querySelector('#fa-excluir'); if (ex) ex.onclick = excluir;
    }
    function pintarRodape() {
      const bt = m.querySelector('#fa-salvar');
      bt.disabled = !mudou(atual);
      bt.textContent = atual === NOVA ? 'Criar função' : 'Salvar ' + (ehPers(atual) ? 'função' : 'padrão de ' + rotuloFuncao(atual));
      pintarAbas();
    }
    function pintar() {
      pintarAbas(); pintarMeta();
      /* quem herda este padrão: administrador abre tudo de qualquer jeito */
      const daFuncao = atual === NOVA ? [] : pessoas.filter(u => identidadeDe(u).funcao === atual && !identidadeDe(u).ehAdmin);
      const comExcecao = daFuncao.filter(u => Object.keys(ACESSO.excecoes[u.id] || {}).length).length;
      const primeiro = u => String(u.nome || '').trim().split(/\s+/)[0];
      m.querySelector('#fa-quem').innerHTML = atual === NOVA ? 'Crie a função, escolha o que ela abre e depois dê a função às pessoas em cada conta.'
        : daFuncao.length
        ? '<b>' + daFuncao.length + (daFuncao.length === 1 ? ' pessoa herda' : ' pessoas herdam') + ':</b> ' +
          esc(daFuncao.map(primeiro).join(', ')) + '.' +
          (comExcecao ? ' <span>' + comExcecao + ' com acesso personalizado.</span>' : '')
        : 'Ninguém com esta função por enquanto.';
      m.querySelector('#fa-mods').innerHTML = ACESSO.modulos.map(md => {
        const nv = rasc[atual][md.id] || 'sem';
        return '<div class="ac-mod ac-mod-nv' + (nv !== 'sem' ? ' on' : '') + '"><span>' + esc(md.rotulo) + '</span>' + seletorNivel(md.id, nv) + '</div>';
      }).join('');
      m.querySelectorAll('#fa-mods [data-nv]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.nv === 'sem') delete rasc[atual][b.dataset.mod]; else rasc[atual][b.dataset.mod] = b.dataset.nv;
        pintar();
      }));
      pintarRodape();
    }
    m.querySelector('#fa-salvar').onclick = async () => {
      const bt = m.querySelector('#fa-salvar'), erro = m.querySelector('#fa-erro');
      erro.textContent = ''; bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        if (ehPers(atual)) {
          const mt = meta[atual];
          if (mt.rotulo.trim().length < 2) throw new Error('Dê um nome para a função.');
          const id = await B7.DB.rpc('funcao_personalizada_salvar', { p_id: atual === NOVA ? null : atual, p_rotulo: mt.rotulo.trim(),
            p_descricao: (mt.descricao || '').trim() || null, p_base: mt.base, p_modulos: Object.assign({}, rasc[atual]) });
          B7.UI.toast(atual === NOVA ? 'Função "' + mt.rotulo.trim() + '" criada. Agora é só escolher ela na conta de cada pessoa.' : 'Função salva.');
          m.fechar();
          if (naTela()) reabrir();
          return;
        }
        await B7.DB.chamarAuth({ acao: 'salvar_preset', funcao: atual, modulos: Object.assign({}, rasc[atual]) });
        ACESSO.presets[atual] = Object.keys(rasc[atual]);
        ACESSO.presetNivel[atual] = Object.assign({}, rasc[atual]);
        B7.UI.toast('Padrão de ' + rotuloFuncao(atual) + ' salvo. Quem tem a função já herda.');
        pintar();
        if (naTela()) reabrir();
      } catch (e) { erro.textContent = e.message || 'Não foi possível salvar.'; pintar(); }
    };
    async function excluir() {
      const nome = rotuloFuncao(atual);
      const ok = await B7.UI.confirmar({ titulo: 'Excluir a função "' + nome + '"?', texto: 'Quem tiver ela como função secundária perde esse acesso. Contas com ela como função principal precisam ser trocadas antes.', rotulo: 'Excluir', perigo: true });
      if (!ok) return;
      try {
        await B7.DB.rpc('funcao_personalizada_excluir', { p_id: atual });
        B7.UI.toast('Função excluída.'); m.fechar();
        if (naTela()) reabrir();
      } catch (e) { m.querySelector('#fa-erro').textContent = e.message || 'Não foi possível excluir.'; }
    }
    pintar();
  }

  /* =================================================================
     zzz216: PEDIDOS DE ACESSO e CONFERÊNCIA DE ACESSOS
     Pedidos: quem esbarrou num módulo pede; aqui o administrador aprova
     (podendo dar outro nível) ou recusa — quem grava é acesso_decidir.
     Conferência: só aponta o que parece fora do lugar; não muda nada.
     ================================================================= */
  const IC_HIST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4.5V9h4.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const primeiroNome = u => String((u && (u.nome || u.username)) || '').trim().split(/\s+/)[0];
  /* =================================================================
     4.34.0 — ACESSOS CEDIDOS
     Kevin: "quando eu ceder um acesso (pela telinha de pedir ou pelo
     suporte), já aparece como cedido na minha tela; quando eu quiser
     tirar, é só tirar." Cada acesso cedido vira um cartão: quem, o quê,
     de onde veio, até quando — com "Tirar" (volta exatamente ao que era
     antes) e o prazo, que dá para mudar. "Ceder acesso" cede direto,
     sem pedido; o mesmo formulário abre de dentro de um chamado do
     suporte. Quem grava e desfaz é o banco (acesso_ceder / acesso_revogar
     / acesso_prazo; o vencido sai sozinho de hora em hora).
     ================================================================= */
  const PRAZOS = [[0, 'Sem prazo'], [1, '1 dia'], [7, '7 dias'], [30, '30 dias']];
  const NV_ROT = { sem: 'Sem acesso', ver: 'Ver', editar: 'Editar', total: 'Total' };
  const ORIGEM = { pedido: 'Pedido pela tela', suporte: 'Pelo suporte', manual: 'Cedido direto' };
  const IC_CEDE = {
    chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
  };
  function quandoVence(iso) {
    if (!iso) return { tx: 'sem prazo', classe: '' };
    const h = (new Date(iso) - Date.now()) / 36e5;
    if (h <= 0) return { tx: 'vencendo agora', classe: 'perto' };
    if (h < 24) return { tx: 'vence em ' + Math.max(1, Math.round(h)) + ' h', classe: 'perto' };
    const d = Math.round(h / 24);
    return { tx: 'vence em ' + d + (d === 1 ? ' dia' : ' dias'), classe: d <= 2 ? 'perto' : '' };
  }
  function blocoCedidos(usuarios, pedidos) {
    const cedidos = (pedidos || []).filter(p => p.estado === 'aprovado');
    const saiu = (pedidos || []).filter(p => p.estado === 'revogado' || p.estado === 'expirado').slice(0, 8);
    const pessoa = p => usuarios.find(x => x.id === p.perfil_id) || { nome: p.nome, username: p.username, avatar_url: p.avatar_url, id: p.perfil_id };
    const origem = p => p.origem === 'suporte' && p.chamado_numero ? 'Suporte #' + p.chamado_numero : (ORIGEM[p.origem] || ORIGEM.pedido);
    const cartao = p => {
      const u = pessoa(p), v = quandoVence(p.expira_em);
      return '<div class="lu6-cedido" data-cedido="' + esc(p.id) + '">' +
        B7.UI.avatarPessoa(u, 'lu-avatar') +
        '<div class="lu6-tx"><b>' + esc(u.nome || p.nome) + '</b>' +
          '<span class="lu6-acesso"><em class="lu5-nv hnv-' + esc(p.nivel_dado || p.nivel) + '">' + NV_ROT[p.nivel_dado || p.nivel] + '</em> em <b>' + esc(p.modulo_rotulo) + '</b></span>' +
          '<small>' + esc(origem(p)) + ' · cedido ' + esc(B7.UI.quando ? B7.UI.quando(p.decidido_em || p.created_at) : '') +
            (p.decidido_por_nome ? ' por ' + esc(primeiroNome({ nome: p.decidido_por_nome })) : '') +
            (p.antes_efeito && p.antes_efeito !== 'padrao' ? ' · antes: ' + NV_ROT[p.antes_nivel || 'sem'] : '') + '</small></div>' +
        '<label class="lu6-prazo ' + v.classe + '" title="Até quando vale">' + IC_CEDE.relogio +
          '<span>' + esc(v.tx) + '</span><select data-prazo-cedido aria-label="Mudar o prazo">' +
          '<option value="" selected disabled>mudar</option>' + PRAZOS.map(([d, rot]) => '<option value="' + d + '">' + rot + '</option>').join('') + '</select></label>' +
        '<button type="button" class="b fina lu6-tirar" data-tirar>Tirar</button></div>';
    };
    return '<section class="lu5-bloco lu6-cedidos">' +
      '<header><h3><span class="lu6-ic" aria-hidden="true">' + IC_CEDE.chave + '</span>Acessos cedidos' + (cedidos.length ? ' <b>' + cedidos.length + '</b>' : '') + '</h3>' +
        '<button type="button" class="b fina lu6-ceder" data-ceder>' + IC_CEDE.mais + 'Ceder acesso</button></header>' +
      '<p class="lu6-sub">O que você liberou fora do padrão da função de cada pessoa. Tirar volta exatamente ao que era antes.</p>' +
      (cedidos.length ? '<div class="lu6-lista">' + cedidos.map(cartao).join('') + '</div>'
        : '<div class="lu6-vazio">Nenhum acesso cedido agora. Quando você aprovar um pedido ou ceder pelo suporte, ele aparece aqui.</div>') +
      (saiu.length ? '<details class="lu6-saiu"><summary>Retirados recentemente (' + saiu.length + ')</summary>' + saiu.map(p => {
          const u = pessoa(p);
          return '<div class="lu6-saiu-it">' + esc(primeiroNome(u)) + ' · ' + NV_ROT[p.nivel_dado || p.nivel] + ' em ' + esc(p.modulo_rotulo) + ' · ' +
            (p.estado === 'expirado' ? 'venceu' : 'tirado') + ' ' + esc(B7.UI.quando ? B7.UI.quando(p.revogado_em) : '') +
            (p.revogado_por_nome ? ' por ' + esc(primeiroNome({ nome: p.revogado_por_nome })) : '') + '</div>';
        }).join('') + '</details>' : '') +
      '</section>';
  }
  function ligarCedidos(box, usuarios) {
    const bt = box.querySelector('[data-ceder]');
    if (bt) bt.onclick = () => cederAcesso({ usuarios, modulos: ACESSO.modulos, aoCeder: reabrir });
    box.querySelectorAll('[data-cedido]').forEach(el => {
      const id = el.dataset.cedido;
      el.querySelector('[data-tirar]').onclick = async () => {
        const motivo = B7.UI.perguntar ? await B7.UI.perguntar({ titulo: 'Tirar este acesso?', rotulo: 'A pessoa volta ao acesso que tinha antes e recebe um aviso. Se quiser, diga o motivo.', placeholder: 'Opcional', confirmar: 'Tirar acesso' }) : '';
        if (motivo === null || motivo === undefined || motivo === false) return;
        el.classList.add('saindo');
        try {
          await B7.DB.rpc('acesso_revogar', { p_id: id, p_motivo: typeof motivo === 'string' ? motivo : null });
          B7.UI.toast('Acesso retirado. A pessoa já recebeu o aviso.');
          reabrir();
        } catch (e) { el.classList.remove('saindo'); B7.UI.toast((e && e.message) || 'Não foi possível tirar.', { tipo: 'erro' }); }
      };
      el.querySelector('[data-prazo-cedido]').onchange = async ev => {
        const dias = +ev.target.value;
        try { await B7.DB.rpc('acesso_prazo', { p_id: id, p_dias: dias }); B7.UI.toast(dias ? 'Prazo ajustado: vale por mais ' + dias + (dias === 1 ? ' dia.' : ' dias.') : 'Agora sem prazo.'); reabrir(); }
        catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível mudar o prazo.', { tipo: 'erro' }); }
      };
    });
  }
  /* o formulário de ceder — aqui e de dentro de um chamado do suporte */
  async function cederAcesso(op) {
    op = op || {};
    let usuarios = op.usuarios, modulosBanco = op.modulos;
    if (!usuarios || !modulosBanco) {
      try { const d = (await B7.DB.chamarAuth({ acao: 'listar_usuarios' })) || {}; usuarios = usuarios || d.usuarios || []; modulosBanco = modulosBanco || d.modulos; }
      catch (e) { usuarios = usuarios || []; }
    }
    const equipe = (Array.isArray(usuarios) ? usuarios : []).filter(u => u.papel !== 'cliente' && u.estado === 'ativa' && !identidadeDe(u).ehAdmin);
    if (!equipe.length) return B7.UI.toast('Não achei ninguém da equipe para ceder acesso.', { tipo: 'erro' });
    /* os módulos que o banco conhece (a lista do app tem rotas a mais, como Trends) */
    const mods = ((modulosBanco && modulosBanco.length ? modulosBanco : (B7.Perm && B7.Perm.MODULOS) || []))
      .filter(m => m.id !== 'equipe').map(m => ({ id: m.id, rotulo: m.rotulo }));
    let nivel = op.nivel || 'editar', dias = 0;
    const m = B7.UI.modal(
      '<div class="ng-topo"><span class="ng-ic">' + IC_CEDE.chave + '</span><div><h3>Ceder acesso</h3>' +
        '<div class="sub">' + (op.chamado ? 'Pelo chamado #' + esc(op.chamadoNumero || '') + '. ' : '') + 'A pessoa recebe o aviso na hora. Dá para tirar quando quiser.</div></div></div>' +
      '<section class="ng-bloco"><label class="rot" for="ca-pessoa">PARA QUEM</label>' +
        '<select class="campo" id="ca-pessoa">' + equipe.map(u => '<option value="' + esc(u.id) + '"' + (u.id === op.perfil ? ' selected' : '') + '>' + esc(u.nome || u.username) + '</option>').join('') + '</select></section>' +
      '<section class="ng-bloco"><label class="rot" for="ca-modulo">ONDE</label>' +
        '<select class="campo" id="ca-modulo">' + mods.map(x => '<option value="' + esc(x.id) + '"' + (x.id === op.modulo ? ' selected' : '') + '>' + esc(x.rotulo) + '</option>').join('') + '</select>' +
        '<label class="rot" style="margin-top:12px">NÍVEL</label><div class="lu6-seg" data-grupo="nivel">' +
          [['ver', 'Ver', 'abrir e consultar'], ['editar', 'Editar', 'criar e alterar'], ['total', 'Total', 'também aprovar e excluir']].map(([k, r2, d]) =>
            '<button type="button" data-v="' + k + '"' + (k === nivel ? ' class="on"' : '') + '><b>' + r2 + '</b><small>' + d + '</small></button>').join('') + '</div></section>' +
      '<section class="ng-bloco"><label class="rot">POR QUANTO TEMPO</label><div class="lu6-seg curto" data-grupo="dias">' +
          PRAZOS.map(([d, r2]) => '<button type="button" data-v="' + d + '"' + (d === 0 ? ' class="on"' : '') + '><b>' + r2 + '</b></button>').join('') + '</div>' +
        '<div class="gv-ajuda">Com prazo, o acesso sai sozinho quando vencer e a pessoa é avisada.</div></section>' +
      '<section class="ng-bloco"><label class="rot" for="ca-motivo">MOTIVO <span class="mg-obr leve">opcional</span></label>' +
        '<input class="campo" id="ca-motivo" maxlength="300" placeholder="Ex.: cobrir as férias da Ana" value="' + esc(op.motivo || '') + '"></section>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Ceder acesso</button></div>',
      { extra: 'ng-modal lu6-modal' });
    m.querySelectorAll('.lu6-seg').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (g.dataset.grupo === 'nivel') nivel = b.dataset.v; else dias = +b.dataset.v;
    }));
    m.querySelector('[data-ok]').onclick = async () => {
      const ok = m.querySelector('[data-ok]'); ok.disabled = true; ok.textContent = 'Cedendo…';
      try {
        await B7.DB.rpc('acesso_ceder', { p_perfil: m.querySelector('#ca-pessoa').value, p_modulo: m.querySelector('#ca-modulo').value,
          p_nivel: nivel, p_dias: dias || null, p_chamado: op.chamado || null, p_motivo: m.querySelector('#ca-motivo').value.trim() || null });
        m.fechar();
        B7.UI.toast('Acesso cedido. A pessoa já recebeu o aviso.');
        if (op.aoCeder) op.aoCeder();
      } catch (e) { ok.disabled = false; ok.textContent = 'Ceder acesso'; B7.UI.toast((e && e.message) || 'Não foi possível ceder.', { tipo: 'erro' }); }
    };
  }

  function pintarAvisos(usuarios, pedidos, editar, diasSem, presenca) {
    const box = document.getElementById('lu-avisos');
    if (!box) return;
    const pend = pedidos.filter(p => p.estado === 'pendente');
    const ativos = usuarios.filter(u => u.estado === 'ativa' && u.papel !== 'cliente');
    const baseDe = u => { const f = identidadeDe(u).funcao; const p = personalizada(f); return p ? p.base : f; };
    const achados = [];
    const add = (id, cor, titulo, texto, pessoas) => { if (pessoas.length) achados.push({ id, cor, titulo, texto, pessoas }); };
    add('aprova', 'ambar', 'Aprovam sem ser da coordenação', 'Total em Aprovações permite aprovar e anular aprovações de cliente.',
      ativos.filter(u => !identidadeDe(u).ehAdmin && baseDe(u) !== 'coordenador' && nivelDe(u, 'aprovacoes') === 'total'));
    add('exclui-cli', 'ambar', 'Podem excluir clientes', 'Total em Clientes inclui excluir o cadastro de um cliente.',
      ativos.filter(u => !identidadeDe(u).ehAdmin && baseDe(u) !== 'coordenador' && nivelDe(u, 'clientes') === 'total'));
    add('parada', 'ambar', 'Contas paradas com acesso', 'Sem entrar há mais de 60 dias (ou nunca entraram), mas ainda abrem módulos.',
      ativos.filter(u => { if (presenca(u).online) return false; const d = diasSem(u); const criada = u.created_at ? (Date.now() - new Date(u.created_at)) / 864e5 : 99;
        return (d === null ? criada > 14 : d >= 60) && (identidadeDe(u).ehAdmin || modulosEfetivosDe(u).length); }));
    const principal = { designer: 'design', videomaker: 'video' };
    add('sem-principal', 'violeta', 'Sem o módulo da própria função', 'Ex.: designer sem Design. Pode ser de propósito, mas costuma ser engano.',
      ativos.filter(u => !identidadeDe(u).ehAdmin && !personalizada(identidadeDe(u).funcao) && principal[baseDe(u)] && nivelDe(u, principal[baseDe(u)]) === 'sem'));
    add('muitos', 'violeta', 'Muitos ajustes manuais', '4 ou mais módulos diferentes do padrão. Talvez valha criar uma função para essas pessoas.',
      ativos.filter(u => Object.keys(ACESSO.excecoes[u.id] || {}).length >= 4));
    const admins = ativos.filter(u => identidadeDe(u).ehAdmin);
    add('admins', 'violeta', 'Administradores parados', 'Administrador abre tudo; quem não usa há 30+ dias não precisa ser administrador.',
      admins.filter(u => { const d = diasSem(u); return !presenca(u).online && (d === null || d >= 30); }));
    const semNinguem = (ACESSO.personalizadas || []).filter(f => !usuarios.some(u => u.funcao_personalizada === f.id) &&
      !Object.values(ACESSO.secundarias).some(sc => sc[f.id]));
    const chip = u => '<button type="button" class="lu5-pessoa" data-editar-pessoa="' + esc(u.id) + '" title="Ajustar o acesso de ' + esc(u.nome) + '">' +
      B7.UI.avatarPessoa(u, 'lu-avatar') + '<span>' + esc(primeiroNome(u)) + '</span></button>';
    const NVR = { ver: 'Ver', editar: 'Editar', total: 'Total', sem: 'Sem acesso' };

    box.innerHTML =
      (pend.length ? '<section class="lu5-bloco lu5-pedidos" id="lu-pedidos"><header><h3><i class="lu5-sino" aria-hidden="true"></i>Pedidos de acesso <b>' + pend.length + '</b></h3>' +
          '<p>A equipe pediu; você decide. Pode aprovar com outro nível.</p></header>' +
        pend.map(p => {
          const u = usuarios.find(x => x.id === p.perfil_id) || { nome: p.nome, username: p.username, avatar_url: p.avatar_url, id: p.perfil_id };
          return '<div class="lu5-pedido" data-pedido="' + esc(p.id) + '">' + B7.UI.avatarPessoa(u, 'lu-avatar') +
            '<div class="lu5-ped-txt"><b>' + esc(u.nome || p.nome) + '</b> pede <em class="lu5-nv hnv-' + esc(p.nivel) + '">' + NVR[p.nivel] + '</em> em <b>' + esc(p.modulo_rotulo) + '</b>' +
              '<small>hoje: ' + NVR[p.nivel_atual || 'sem'] + ' · ' + esc(B7.UI.quando ? B7.UI.quando(p.created_at) : '') + '</small>' +
              (p.motivo ? '<q>' + esc(p.motivo) + '</q>' : '') + '</div>' +
            '<div class="lu5-ped-acoes"><select class="campo fina" data-nivel aria-label="Nível a dar">' +
              ['ver', 'editar', 'total'].map(n => '<option value="' + n + '"' + (n === p.nivel ? ' selected' : '') + '>' + NVR[n] + '</option>').join('') + '</select>' +
              '<select class="campo fina" data-prazo aria-label="Por quanto tempo">' + PRAZOS.map(([d, rot]) => '<option value="' + d + '">' + rot + '</option>').join('') + '</select>' +
              '<button type="button" class="b fina pri" data-aprovar>Ceder</button><button type="button" class="b fina" data-recusar>Recusar</button></div></div>';
        }).join('') + '</section>' : '') +
      blocoCedidos(usuarios, pedidos) +
      (achados.length || semNinguem.length
        ? '<details class="lu5-bloco lu5-conf"' + (pend.length ? '' : ' open') + '><summary><h3>Conferência de acessos <b>' + achados.length + '</b></h3>' +
            '<span>o que parece fora do lugar · nada aqui muda sozinho</span></summary>' +
          achados.map(a => '<div class="lu5-achado c-' + a.cor + '"><div><b>' + esc(a.titulo) + '</b><small>' + esc(a.texto) + '</small></div>' +
            '<div class="lu5-pessoas">' + a.pessoas.map(chip).join('') + '</div></div>').join('') +
          (semNinguem.length ? '<div class="lu5-achado c-cinza"><div><b>Funções sem ninguém</b><small>Funções personalizadas que ninguém usa: ' +
            esc(semNinguem.map(f => f.rotulo).join(', ')) + '.</small></div></div>' : '') +
          '</details>'
        : '<div class="lu5-bloco lu5-ok"><b>Acessos em ordem.</b><span>A conferência não achou nada fora do lugar.</span></div>');

    box.querySelectorAll('[data-editar-pessoa]').forEach(b => b.onclick = () => editar(usuarios.find(u => u.id === b.dataset.editarPessoa)));
    ligarCedidos(box, usuarios);
    box.querySelectorAll('[data-pedido]').forEach(el => {
      const decidir = async aprovar => {
        el.querySelectorAll('button,select').forEach(x => { x.disabled = true; });
        let resposta = null;
        if (!aprovar && B7.UI.perguntar) {
          resposta = await B7.UI.perguntar({ titulo: 'Recusar o pedido?', rotulo: 'Se quiser, diga o motivo (a pessoa recebe no aviso).', placeholder: 'Opcional', confirmar: 'Recusar' });
          if (resposta === null || resposta === undefined || resposta === false) { el.querySelectorAll('button,select').forEach(x => { x.disabled = false; }); return; }
        }
        try {
          await B7.DB.rpc('acesso_decidir', { p_id: el.dataset.pedido, p_aprovar: aprovar, p_nivel: el.querySelector('[data-nivel]').value, p_resposta: typeof resposta === 'string' ? resposta : null });
          const dias = +((el.querySelector('[data-prazo]') || {}).value || 0);
          if (aprovar && dias) await B7.DB.rpc('acesso_prazo', { p_id: el.dataset.pedido, p_dias: dias }).catch(() => {});
          B7.UI.toast(aprovar ? 'Acesso cedido. Ele já aparece em "Acessos cedidos".' : 'Pedido recusado.');
          reabrir();
        } catch (e) {
          B7.UI.toast((e && e.message) || 'Não foi possível responder.', { tipo: 'erro' });
          el.querySelectorAll('button,select').forEach(x => { x.disabled = false; });
        }
      };
      el.querySelector('[data-aprovar]').onclick = () => decidir(true);
      el.querySelector('[data-recusar]').onclick = () => decidir(false);
    });
  }

  /* zzz216: HISTÓRICO DE ACESSOS — quem mudou o quê de quem, com o antes e o depois */
  async function modalHistorico(pessoa, usuarios) {
    const m = B7.UI.modal('<div class="ng-topo"><span class="ng-ic">' + IC_HIST + '</span><div><h3>' +
        (pessoa ? 'Histórico de acesso de ' + esc(primeiroNome(pessoa)) : 'Histórico de acessos') + '</h3>' +
        '<div class="sub">Quem mudou função, módulos e níveis, quando, e o que era antes.</div></div></div>' +
      (pessoa ? '' : '<div class="lu5-hist-filtro"><select class="campo fina" id="hi-pessoa" aria-label="Pessoa"><option value="">Todas as pessoas</option>' +
        (usuarios || []).filter(u => u.papel !== 'cliente').map(u => '<option value="' + esc(u.id) + '">' + esc(u.nome) + '</option>').join('') + '</select></div>') +
      '<div class="lu5-hist" id="hi-lista">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true, extra: 'ng-modal nu-modal hi-modal' });
    const NVR = { sem: 'Sem acesso', ver: 'Ver', editar: 'Editar', total: 'Total' };
    const rot = id => rotuloModulo(id);
    const difNiveis = (a, b) => {
      const ks = [...new Set(Object.keys(a || {}).concat(Object.keys(b || {})))];
      return ks.filter(k => ((a || {})[k] || 'sem') !== ((b || {})[k] || 'sem'))
        .map(k => '<li><b>' + esc(rot(k)) + '</b> <s>' + NVR[(a || {})[k] || 'sem'] + '</s> → <span class="hnv-' + ((b || {})[k] || 'sem') + '">' + NVR[(b || {})[k] || 'sem'] + '</span></li>');
    };
    function linhas(h) {
      const d = h.detalhe || {}, out = [];
      const ac = d.acesso;
      if (ac && ac.depois) {
        const a = ac.antes || {}, b = ac.depois;
        if (ac.antes && a.funcao !== b.funcao) out.push('<li>Função: <s>' + esc(rotuloFuncao(a.funcao) || '—') + '</s> → <b>' + esc(rotuloFuncao(b.funcao) || '—') + '</b></li>');
        if (ac.antes && !!a.eh_admin !== !!b.eh_admin) out.push('<li>' + (b.eh_admin ? '<b>Virou administrador</b>' : '<b>Deixou de ser administrador</b>') + '</li>');
        if (ac.antes && a.estado !== b.estado) out.push('<li>Conta: <s>' + esc(a.estado || '') + '</s> → <b>' + esc(b.estado || '') + '</b></li>');
        const sa = a.secundarias || {}, sb = b.secundarias || {};
        [...new Set(Object.keys(sa).concat(Object.keys(sb)))].filter(k => sa[k] !== sb[k]).forEach(k =>
          out.push('<li>Outra função <b>' + esc(rotuloFuncao(k)) + '</b>: <s>' + (sa[k] ? NVR[sa[k]] : 'não') + '</s> → ' + (sb[k] ? NVR[sb[k]] : 'não') + '</li>'));
        out.push.apply(out, ac.antes ? difNiveis(a.niveis, b.niveis) : []);
        if (!ac.antes) out.push('<li>Conta criada' + (b.eh_admin ? ' como administrador' : ' como ' + esc(rotuloFuncao(b.funcao))) + '</li>');
      } else if (h.acao === 'salvar_preset' || h.acao === 'funcao_personalizada_salvar') {
        out.push.apply(out, difNiveis(d.antes || {}, d.depois || d.modulos || {}));
      } else if (h.acao === 'alterar_conta') {
        if (d.funcao !== undefined) out.push('<li>Função: <b>' + esc(rotuloFuncao(d.funcao) || '—') + '</b></li>');
        if (d.eh_admin !== undefined) out.push('<li>Administrador: <b>' + (d.eh_admin ? 'sim' : 'não') + '</b></li>');
        if (d.estado) out.push('<li>Conta: <b>' + esc(d.estado) + '</b></li>');
        if (d.papel && d.funcao === undefined) out.push('<li>Perfil: <b>' + esc(d.papel) + '</b></li>');
        if (Array.isArray(d.excecoes)) out.push('<li>' + d.excecoes.length + ' ajuste(s) de módulo</li>');
      }
      return out;
    }
    const TIT = {
      alterar_conta: 'alterou o acesso de', criar_usuario: 'criou a conta de', excluir_conta: 'excluiu a conta de',
      salvar_preset: 'mudou o padrão da função', acesso_pedido_aprovado: 'aprovou o pedido de', acesso_pedido_recusado: 'recusou o pedido de',
      funcao_personalizada_salvar: 'salvou a função', funcao_personalizada_excluir: 'excluiu a função', bootstrap_admin: 'criou o primeiro administrador'
    };
    async function carregar(id) {
      const lista = m.querySelector('#hi-lista');
      try {
        const itens = (await B7.DB.rpc('acessos_historico', { p_perfil: id || null, p_limite: 150 })) || [];
        if (!itens.length) { lista.innerHTML = '<div class="estado-b7"><b>Nada registrado ainda.</b><p>As próximas mudanças de acesso aparecem aqui.</p></div>'; return; }
        lista.innerHTML = itens.map(h => {
          const d = h.detalhe || {};
          const alvo = h.acao === 'salvar_preset' ? rotuloFuncao(h.alvo_descricao || '') : (h.acao || '').indexOf('funcao_personalizada') === 0 ? (h.alvo_descricao || '') : (h.alvo_nome || '');
          const extra = h.acao === 'acesso_pedido_aprovado' ? ' — ' + esc(rot(d.modulo)) + ': pediu ' + NVR[d.pedido] + ', recebeu ' + NVR[d.dado]
            : h.acao === 'acesso_pedido_recusado' ? ' — ' + esc(rot(d.modulo)) + ' (' + NVR[d.pedido] + ')' + (d.resposta ? ': "' + esc(d.resposta) + '"' : '') : '';
          const ls = h.acao === 'acesso_pedido_recusado' ? [] : linhas(h);
          return '<article class="hi-item"><span class="hi-av">' + B7.UI.avatarPessoa({ nome: h.autor_nome || '?', avatar_url: h.autor_avatar }, 'lu-avatar') + '</span>' +
            '<div><p><b>' + esc(h.autor_nome || 'Sistema') + '</b> ' + (TIT[h.acao] || h.acao) + ' <b>' + esc(alvo) + '</b>' + extra + '</p>' +
            '<time>' + esc(B7.UI.quando ? B7.UI.quando(h.created_at) : h.created_at) + ' · ' + new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</time>' +
            (ls.length ? '<ul>' + ls.join('') + '</ul>' : '') + '</div></article>';
        }).join('');
      } catch (e) { lista.innerHTML = '<div class="estado-b7"><b>' + esc(e.message || 'Não foi possível carregar o histórico.') + '</b></div>'; }
    }
    const sel = m.querySelector('#hi-pessoa');
    if (sel) sel.onchange = () => { m.querySelector('#hi-lista').innerHTML = B7.UI.skeleton('lista', { n: 4 }); carregar(sel.value); };
    carregar(pessoa ? pessoa.id : null);
  }

  async function abrir(opc) {
    hospede = (opc && opc.alvo) || null;
    B7.Dashboard.marcarNav('#/config');
    if (!hospede) B7.Rota.titulo(['Usuários e acessos']);
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 5 }) + '</div>';

    const vale = B7.Rota.marca();   /* zzz234: não desenha por cima de outra tela */
    let dados, clientes, pedidos;
    try {
      [dados, clientes, pedidos] = await Promise.all([
        B7.DB.chamarAuth({ acao: 'listar_usuarios' }),
        B7.DB.listarClientes().catch(() => []),
        B7.DB.rpc('acesso_pedidos_listar', {}).catch(() => []),
        B7.Equipe ? B7.Equipe.carregar().catch(() => null) : null
      ]);
    } catch (e) {
      if (!vale()) return;
      /* sem sessão o caminho é entrar, não ficar lendo mensagem de erro */
      const semSessao = !B7.Auth || !B7.Auth.usuario();
      return painel().innerHTML = '<div class="conteudo entra">' +
        '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
        '<b>Usuários e acessos</b></div>' +
        '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
        (semSessao
          ? '<b>Entre para gerenciar as contas.</b>' +
            '<p>Esta área é do administrador. Use o botão <b>Entrar</b>, no topo da tela.</p>' +
            '<div class="acoes"><button class="b pri" id="ua-entrar">Entrar</button></div>'
          : '<b>' + esc(e.message || 'Não foi possível carregar as contas.') + '</b>' +
            '<p>Sua conta precisa ser de administrador para abrir esta área.</p>') +
        '</div></div>';
    } finally {
      const b = document.getElementById('ua-entrar');
      if (b) b.onclick = () => B7.Auth.telaLogin();
    }

    if (!vale()) return;
    const usuarios = dados.usuarios || [];
    const vinculos = dados.vinculos || [];
    const funcoesExtraTodas = dados.funcoes_extra || [];
    carregarAcesso(dados);
    const ROT_PAPEL = { dono: 'dono', gestor: 'gestor', equipe: 'equipe' };
    const empresasDe = id => vinculos.filter(v => v.perfil_id === id)
      .map(v => ((v.clientes && v.clientes.nome) || '') + (v.papel ? ' (' + ROT_PAPEL[v.papel] + ')' : ''));
    const funcoesExtraDe = id => funcoesExtraTodas.filter(f => f.perfil_id === id).map(f => f.funcao);

    const presenca = u => B7.Presenca ? B7.Presenca.rotulo(u)
      : { online: false, texto: u.ultimo_acesso ? 'Último acesso: ' + B7.UI.quando(u.ultimo_acesso) : 'Nunca acessou' };
    const ativos = usuarios.filter(u => u.estado === 'ativa');
    const online = ativos.filter(u => presenca(u).online).length;
    const inativas = usuarios.length - ativos.length;

    /* zzz200: Usuários em cartões. No alto, os números da equipe (cada um
       filtra a lista); embaixo, um cartão por conta com função, funções
       extras, o mapa dos módulos (cheio = abre; contorno = mudou do padrão
       da função), os alertas da conta e o último acesso. Mesmas ações e
       mesmos dados de antes: nada aqui decide permissão. */
    const extrasDe = id => funcoesExtraDe(id).filter(f => f !== identidadeDe(usuarios.find(x => x.id === id) || {}).funcao);
    const diasSem = u => {
      const c = [u.last_seen_at, u.last_login_at, u.ultimo_acesso].filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x));
      return c.length ? Math.floor((Date.now() - Math.max.apply(null, c)) / 864e5) : null;
    };
    const difDe = u => {
      const idt = identidadeDe(u);
      if (idt.tipo === 'cliente' || idt.ehAdmin) return [];
      const exc = ACESSO.excecoes[u.id] || {};
      return Object.keys(exc).filter(md => nivelDe(u, md) !== nivelPadraoDe(u, md));
    };
    const alertasDe = u => {
      if (u.estado !== 'ativa') return [{ t: 'Conta desativada', c: 'cinza' }];
      const a = [], d = diasSem(u), idt = identidadeDe(u);
      /* zzz247: férias, folga, atestado (Configurações → Ausências e aniversários) */
      const fora = B7.Equipe && B7.Equipe.ausenciaDe(u.id);
      if (fora) a.push({ t: B7.Equipe.rotuloAusencia(fora), c: 'violeta' });
      if (presenca(u).online) { /* online agora: nada de "sem acesso" */ }
      else if (d === null) a.push({ t: 'Nunca acessou', c: 'ambar' });
      else if (d >= 30) a.push({ t: 'Sem acesso há ' + d + ' dias', c: 'ambar' });
      if (idt.tipo === 'cliente') { if (!empresasDe(u.id).length) a.push({ t: 'Sem empresa vinculada', c: 'ambar' }); }
      else {
        if (!idt.ehAdmin && !idt.funcao) a.push({ t: 'Sem função', c: 'ambar' });
        if (difDe(u).length) a.push({ t: 'Acesso personalizado', c: 'violeta' });
      }
      return a;
    };
    const atencao = u => alertasDe(u).some(x => x.c === 'ambar');
    const equipeAtiva = ativos.filter(u => u.papel !== 'cliente');
    const conta = {
      todos: usuarios.length,
      online,
      admin: equipeAtiva.filter(u => identidadeDe(u).ehAdmin).length,
      coordenador: equipeAtiva.filter(u => identidadeDe(u).funcao === 'coordenador').length,
      designer: equipeAtiva.filter(u => identidadeDe(u).funcao === 'designer').length,
      videomaker: equipeAtiva.filter(u => identidadeDe(u).funcao === 'videomaker').length,
      clientes: ativos.filter(u => u.papel === 'cliente').length,
      personalizado: equipeAtiva.filter(u => difDe(u).length).length,
      atencao: usuarios.filter(atencao).length,
      inativas
    };
    /* zzz302: três grupos — Parceiros B7 (freelancers e parceiros de fora,
       marcados na conta), Colaboradores (a equipe interna, administradores
       incluídos) e Clientes (Portal).
       Um seletor no alto troca o grupo; os filtros finos (online, pedem
       atenção, acesso personalizado, desativadas) aparecem só quando têm
       alguém. Mesmos dados e ações de antes: nada aqui decide permissão. */
    const grupoDe = u => u.papel === 'cliente' ? 'clientes' : u.parceiro ? 'parceiros' : 'colaboradores';
    const GRUPOS = [
      ['parceiros', 'Parceiros B7', 'Freelancers e parceiros de fora que produzem com a B7. Marque em ⋯ → Marcar como Parceiro B7.'],
      ['colaboradores', 'Colaboradores', 'A equipe interna: administração, coordenação, design e vídeo — cada um com os módulos da sua função.'],
      ['clientes', 'Clientes', 'Quem acompanha e aprova pelo Portal, só nas empresas vinculadas.']
    ];
    const nGrupo = g => usuarios.filter(u => grupoDe(u) === g && u.estado === 'ativa').length;
    if (!GRUPOS.some(g => g[0] === filtro.grupo)) filtro.grupo = 'colaboradores';
    const FILTROS = [['todos', 'Todas'], ['online', 'Online agora'], ['atencao', 'Pedem atenção'], ['personalizado', 'Acesso personalizado'], ['inativas', 'Desativadas']];
    if (!FILTROS.some(f => f[0] === filtro.tipo)) filtro.tipo = 'todos';
    const contaNoGrupo = id => usuarios.filter(u => grupoDe(u) === filtro.grupo).filter(u =>
      id === 'online' ? u.estado === 'ativa' && presenca(u).online : id === 'atencao' ? atencao(u)
      : id === 'personalizado' ? u.estado === 'ativa' && difDe(u).length > 0 : id === 'inativas' ? u.estado !== 'ativa' : u.estado === 'ativa').length;
    const ICG = {
      parceiros: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>',
      colaboradores: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.6c2.3.1 4.2 1.4 4.8 4.4"/></svg>',
      clientes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>'
    };

    painel().innerHTML = '<div class="conteudo entra lu3 lu4 lu6">' +
      '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
      '<b>Usuários e acessos</b></div>' +
      '<div class="cab-conteudo lu3-cab lu6-cab"><div><h1>Usuários e acessos</h1>' +
        '<p>' + ativos.length + ' conta' + (ativos.length === 1 ? '' : 's') + ' ativa' + (ativos.length === 1 ? '' : 's') +
          (online ? ' · <span class="lu6-on"><i class="lu3-ponto vivo" aria-hidden="true"></i>' + online + ' online agora</span>' : '') + '</p></div>' +
        '<div class="lu6-acoes">' +
          '<button class="b contorno lu3-funcoes" id="lu-hist" title="Quem mudou o acesso de quem">' + IC_HIST + '<span>Histórico</span></button>' +
          '<button class="b contorno lu3-funcoes" id="lu-funcoes">' + IC_ACESSO + '<span>Funções</span></button>' +
          '<button class="b pri lu3-novo" id="novo-usuario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Novo usuário</span></button>' +
        '</div>' +
      '</div>' +

      (usuarios.length
        ? '<div class="lu6-grupos" role="tablist" aria-label="Grupo de contas">' + GRUPOS.map(([k, r]) =>
            '<button type="button" role="tab" class="lu6-g' + (filtro.grupo === k ? ' on' : '') + '" data-lu-grupo="' + k + '" aria-selected="' + (filtro.grupo === k) + '">' +
              '<span class="lu6-g-ic ' + k + '">' + ICG[k] + '</span><span class="lu6-g-tx"><b>' + r + '</b><small>' + nGrupo(k) + (nGrupo(k) === 1 ? ' conta' : ' contas') + '</small></span></button>').join('') +
          '</div>' +
          '<div id="lu-avisos" class="lu5-avisos"></div>' +
          '<p class="lu6-ajuda" id="lu-ajuda"></p>' +
          '<div class="lu3-barra lu6-barra">' +
            '<label class="lu-busca lu3-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input id="lu-busca" placeholder="Buscar por nome ou usuário…" autocomplete="off" value="' + esc(filtro.termo) + '"></label>' +
            '<div class="lu3-pils" role="group" aria-label="Filtrar contas" id="lu-pils"></div>' +
          '</div>' +
          '<div id="lu-lista"></div>'
        : '<div class="estado-b7"><b>Nenhuma conta ainda.</b>' +
          '<p>Crie a primeira conta de colaborador ou cliente.</p></div>') +
    '</div>';

    document.getElementById('novo-usuario').onclick = () => modalNovo(clientes);
    const btFuncoes = document.getElementById('lu-funcoes'); if (btFuncoes) btFuncoes.onclick = () => modalFuncoes(usuarios);
    const btHist = document.getElementById('lu-hist'); if (btHist) btHist.onclick = () => modalHistorico(null, usuarios);
    pintarAvisos(usuarios, pedidos || [], u => abrirAcao(u, 'editar'), diasSem, presenca);
    if (/[?&]pedidos=1/.test(location.hash)) { const pa = document.getElementById('lu-pedidos'); if (pa) pa.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

    const abrirAcao = (u, acao, estado) => {
      if (acao === 'senha') return modalSenha(u);
      /* zzz218: para quem perdeu o celular ou o acesso ao e-mail */
      if (acao === '2fa') return (async () => {
        const ok = await B7.UI.confirmar({ titulo: 'Desligar a verificação em 2 etapas de ' + u.nome + '?',
          texto: 'Use quando a pessoa perdeu o celular ou o acesso ao e-mail. Ela entra só com a senha e pode ligar de novo em Meu perfil → Segurança. Os aparelhos de confiança dela são esquecidos.',
          confirmar: 'Desligar' });
        if (!ok) return;
        try { await B7.DB.chamarAuth({ acao: 'seg_resetar', perfil_id: u.id }); B7.UI.toast('Verificação em 2 etapas desligada para ' + u.nome + '.'); }
        catch (e) { B7.UI.toast('Não foi possível: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
      })();
      if (acao === 'editar') return modalEditar(u, clientes, vinculos, funcoesExtraDe(u.id));
      if (acao === 'repasse') return B7.Equipe.repasse(u, { aoTerminar: reabrir });
      if (acao === 'estado') return alterarEstado(u, estado);
      if (acao === 'foto') return modalFoto(u);
      if (acao === 'excluir') return excluirConta(u);
      if (acao === 'historico') return modalHistorico(u, usuarios);
      /* zzz302: o que a pessoa entregou (Gestão → Equipe) */
      if (acao === 'entregas') { location.hash = '#/gestao?aba=equipe&p=' + encodeURIComponent(u.id); return; }
      if (acao === 'parceiro') return (async () => {
        const vira = !u.parceiro;
        try {
          await B7.DB.rpc('perfil_parceiro_definir', { p_perfil: u.id, p_parceiro: vira });
          u.parceiro = vira;
          B7.UI.toast(u.nome + (vira ? ' agora está em Parceiros B7.' : ' voltou para Colaboradores.'));
          reabrir();
        } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível mudar.', { tipo: 'erro' }); }
      })();
    };

    /* A lista é redesenhada a partir do que já veio do servidor: buscar
       e filtrar não refazem a consulta. */
    function pintar() {
      const alvo = document.getElementById('lu-lista');
      if (!alvo) return;
      const g = GRUPOS.find(x => x[0] === filtro.grupo);
      const ajuda = document.getElementById('lu-ajuda'); if (ajuda) ajuda.textContent = g[2];
      const pils = document.getElementById('lu-pils');
      if (pils) {
        const vis = FILTROS.filter(f => f[0] === 'todos' || contaNoGrupo(f[0]) || filtro.tipo === f[0]);
        if (!vis.some(f => f[0] === filtro.tipo)) filtro.tipo = 'todos';
        pils.innerHTML = vis.length > 1 ? vis.map(([id, rot]) => '<button type="button" class="lu3-pil' + (filtro.tipo === id ? ' on' : '') + '" data-lu-tipo="' + id + '">' +
          (id === 'online' ? '<i class="lu3-ponto vivo" aria-hidden="true"></i>' : '') +
          (id === 'atencao' ? '<i class="lu4-ponto-at" aria-hidden="true"></i>' : '') +
          rot + '<b>' + contaNoGrupo(id) + '</b></button>').join('') : '';
        pils.querySelectorAll('[data-lu-tipo]').forEach(b => b.onclick = () => {
          const t = b.dataset.luTipo;
          filtro.tipo = filtro.tipo === t || t === 'todos' ? 'todos' : t;
          pintar();
        });
      }
      const termo = filtro.termo.trim().toLowerCase();
      const t = filtro.tipo;
      const passaTipo = u => t === 'online' ? (u.estado === 'ativa' && presenca(u).online)
        : t === 'personalizado' ? u.estado === 'ativa' && difDe(u).length > 0
        : t === 'atencao' ? atencao(u)
        : t === 'inativas' ? u.estado !== 'ativa' : true;
      const passa = u => grupoDe(u) === filtro.grupo && passaTipo(u) && (!termo || (u.nome || '').toLowerCase().includes(termo) ||
        (u.username || '').toLowerCase().includes(termo));
      const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
      const minha = u => (eu && eu.id === u.id ? 0 : 1);
      const ordem = (a, b) => minha(a) - minha(b) ||
        (presenca(b).online ? 1 : 0) - (presenca(a).online ? 1 : 0) ||
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      const lista = usuarios.filter(passa);
      const ativas = lista.filter(u => u.estado === 'ativa').sort(ordem);
      const desativadas = lista.filter(u => u.estado !== 'ativa').sort(ordem);
      const ehCli = filtro.grupo === 'clientes';
      let n = 0;
      const grade = l => '<div class="lu4-grade">' + l.map(u => cartaoPessoa(u, empresasDe(u.id), extrasDe(u.id), presenca(u), alertasDe(u), ehCli, n++)).join('') + '</div>';

      alvo.innerHTML = lista.length
        ? (ativas.length ? grade(ativas) : '') +
          (desativadas.length ? '<details class="lu6-desat"' + (t === 'inativas' || !ativas.length ? ' open' : '') + '><summary>Desativadas <span>' + desativadas.length + '</span></summary>' + grade(desativadas) + '</details>' : '')
        : '<div class="estado-b7"><b>Ninguém aqui' + (filtro.termo ? ' para “' + esc(filtro.termo) + '”' : '') + '.</b>' +
          (!termo && t === 'todos' ? '<p>Use <b>Novo usuário</b> para criar a primeira conta deste grupo.</p>' : '') + '</div>';

      B7.UI.ligarMenus(alvo);
      alvo.querySelectorAll('[data-acao-conta]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        abrirAcao(usuarios.find(x => x.id === b.dataset.id), b.dataset.acaoConta, b.dataset.estado);
      });
      /* o cartão inteiro abre "Editar acesso"; o menu ⋯ guarda o resto */
      alvo.querySelectorAll('.lu4-card').forEach(el => {
        const abrirEdicao = () => abrirAcao(usuarios.find(x => x.id === el.dataset.id), 'editar');
        el.onclick = e => { if (!e.target.closest('.menu') && !e.target.closest('[data-acao-conta]')) abrirEdicao(); };
        el.onkeydown = e => { if (e.key === 'Enter' && e.target === el) abrirEdicao(); };
      });
    }
    pintar();
    painel().querySelectorAll('[data-lu-grupo]').forEach(b => b.onclick = () => {
      filtro.grupo = b.dataset.luGrupo;
      filtro.tipo = 'todos';
      painel().querySelectorAll('[data-lu-grupo]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      pintar();
    });
    const busca = document.getElementById('lu-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { filtro.termo = busca.value; pintar(); }, 120);
  }

  /* uma conta = um cartão: foto (com o ponto verde de online), nome,
     @usuário, função e funções extras; o mapa dos módulos (equipe) ou as
     empresas (cliente); os alertas; e o último acesso. O cartão inteiro
     abre "Editar acesso"; o ⋯ guarda o resto. */
  function cartaoPessoa(u, empresas, extras, pres, alertas, ehCliente, i) {
    const inativa = u.estado !== 'ativa';
    const idt = identidadeDe(u), mods = modulosEfetivosDe(u);
    const totalMods = ACESSO.modulos.length;
    const base = ACESSO.presets[idt.funcao] || [], exc = idt.ehAdmin ? {} : (ACESSO.excecoes[u.id] || {});
    const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const souEu = !!(eu && eu.id === u.id);
    const quando = pres.online ? 'Online agora' : String(pres.texto || '').replace(/^Último acesso:\s*/i, '');
    const nunca = !pres.online && /^nunca/i.test(quando);

    const tags = ehCliente
      ? '<span class="lu4-tag lu3-p-cliente">Cliente</span>' +
        (empresas.some(e => / \(dono\)$/.test(e)) ? '<span class="lu4-tag leve">dono</span>'
          : empresas.some(e => / \(gestor\)$/.test(e)) ? '<span class="lu4-tag leve">aprova</span>' : '')
      : (u.parceiro ? '<span class="lu4-tag lu6-parceiro" title="Freelancer ou parceiro de fora">Parceiro B7</span>' : '') +
        (idt.ehAdmin ? (u.superadmin === 'supremo' ? '<span class="lu4-tag lu3-p-super supremo" title="Acima de todos os administradores">Programador</span>'
          : u.superadmin === 'super' ? '<span class="lu4-tag lu3-p-super" title="Acima dos administradores">Super admin</span>'
          : '<span class="lu4-tag lu3-p-admin">Administrador</span>') : '') +
        (idt.funcao ? '<span class="lu4-tag lu3-p-' + esc(idt.funcao) + '">' + esc(rotuloFuncao(idt.funcao)) + '</span>' : '') +
        extras.map(f => '<span class="lu4-tag leve" title="Função extra">+ ' + esc(rotuloFuncaoExtra(f)) + '</span>').join('');

    let meio = '';
    if (ehCliente) {
      meio = '<div class="lu4-emp"><span class="lu4-rot">Empresas</span>' + (empresas.length
        ? '<b title="' + esc(empresas.join(', ')) + '">' + esc(empresas.slice(0, 3).join(', ')) + (empresas.length > 3 ? ' +' + (empresas.length - 3) : '') + '</b>'
        : '<i>nenhuma vinculada</i>') + '</div>';
    } else if (totalMods) {
      const tudo = idt.ehAdmin;
      const pontos = ACESSO.modulos.map(m => {
        const on = tudo || mods.includes(m.id), nv = nivelDe(u, m.id), np = nivelPadraoDe(u, m.id);
        const ordem = { sem: 0, ver: 1, editar: 2, total: 3 };
        const mudou = !tudo && exc[m.id] && nv !== np;
        const cls = (on ? 'on' : 'off') + (on && nv !== 'total' ? ' nv-' + nv : '') + (mudou ? (ordem[nv] > ordem[np] ? ' mais' : ' menos') : '');
        const dica = m.rotulo + ': ' + (on ? rotuloNivel(nv) : 'sem acesso') + (mudou ? ' (padrão: ' + rotuloNivel(np) + ')' : '');
        return '<i class="' + cls + '" title="' + esc(dica) + '"></i>';
      }).join('');
      meio = '<div class="lu4-mods"><div class="lu4-mods-cab"><span class="lu4-rot">Acesso</span><b>' +
          (tudo ? 'abre tudo' : mods.length + ' de ' + totalMods + ' módulos') + '</b></div>' +
        '<div class="lu4-pontos" aria-label="' + esc(tudo ? 'Abre todos os módulos' : mods.map(rotuloModulo).join(', ') || 'Nenhum módulo') + '">' + pontos + '</div></div>';
    }

    return '<article class="lu4-card' + (inativa ? ' inativa' : '') + (pres.online && !inativa ? ' online' : '') + '" tabindex="0" data-id="' + esc(u.id) + '"' +
        ' style="--i:' + Math.min(i, 16) + '" title="Editar acesso de ' + esc(u.nome) + '">' +
      '<header class="lu4-topo">' +
        '<span class="lu3-av">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</span>' +
        '<div class="lu4-id"><b>' + esc(u.nome) + (souEu ? '<em>você</em>' : '') + '</b><span>@' + esc(u.username) + '</span></div>' +
        '<div class="menu"><button class="ico" aria-label="Ações da conta de ' + esc(u.nome) + '">⋯</button><div class="lista">' +
          '<button data-acao-conta="editar" data-id="' + esc(u.id) + '">Editar acesso</button>' +
          (!ehCliente && B7.Colaboradores && B7.Auth.ehAdmin && B7.Auth.ehAdmin() ? '<button data-acao-conta="entregas" data-id="' + esc(u.id) + '">Ver entregas</button>' : '') +
          (!ehCliente ? '<button data-acao-conta="parceiro" data-id="' + esc(u.id) + '">' + (u.parceiro ? 'Mover para Colaboradores' : 'Marcar como Parceiro B7') + '</button>' : '') +
          '<button data-acao-conta="historico" data-id="' + esc(u.id) + '">Histórico de acesso</button>' +
          '<button data-acao-conta="foto" data-id="' + esc(u.id) + '">Foto de perfil</button>' +
          '<button data-acao-conta="senha" data-id="' + esc(u.id) + '">Redefinir senha</button>' +
          '<button data-acao-conta="2fa" data-id="' + esc(u.id) + '">Desligar verificação em 2 etapas</button>' +
          (u.papel !== 'cliente' && !souEu && B7.Equipe ? '<button data-acao-conta="repasse" data-id="' + esc(u.id) + '">Passar o trabalho…</button>' : '') +
          '<hr>' +
          (inativa
            ? '<button data-acao-conta="estado" data-estado="ativa" data-id="' + esc(u.id) + '">Reativar conta</button>'
            : '<button data-acao-conta="estado" data-estado="desativada" data-id="' + esc(u.id) + '">Desativar conta</button>') +
          '<button class="perigo" data-acao-conta="excluir" data-id="' + esc(u.id) + '">Excluir conta</button>' +
        '</div></div>' +
      '</header>' +
      '<div class="lu4-tags">' + tags + '</div>' +
      meio +
      (alertas.length ? '<div class="lu4-alertas">' + alertas.map(a => '<span class="lu4-al ' + a.c + '">' + esc(a.t) + '</span>').join('') + '</div>' : '') +
      '<footer class="lu4-pe"><span class="lu3-acesso' + (pres.online && !inativa ? ' online' : nunca ? ' nunca' : '') + '">' +
        (pres.online && !inativa ? '<i class="lu3-ponto vivo" aria-hidden="true"></i>' : '') + esc(inativa ? 'Desativada' : quando) + '</span>' +
        '<span class="lu4-abrir" aria-hidden="true">Editar acesso<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></footer>' +
    '</article>';
  }

  /* o que estava digitado na busca sobrevive a um redesenho da tela
     (depois de editar uma conta, a lista é recarregada) */
  const filtro = { termo: '', tipo: 'todos', grupo: '' };

  /* =================================================================
     CRIAR
     ================================================================= */
  function modalNovo(clientes) {
    /* zzz41: no padrão novo — blocos com ícone, perfil em grade
       compacta, empresas em pílulas com busca e contador, aprovação como
       chave e botões lado a lado. Mesmos ids e regras. */
    const m = B7.UI.modal(
      '<div class="ng-topo"><span class="ng-ic">' + ICU.pessoa + '</span><div><h3>Novo usuário</h3>' +
      '<div class="sub">A conta é criada aqui e a senha é entregue pela equipe. Sem e-mail nem convite.</div></div></div>' +

      '<section class="ng-bloco"><h4>' + ICU.id + 'Quem é</h4>' +
        '<div class="mb"><label class="rot" for="nu-nome">NOME</label>' +
          '<input class="campo" id="nu-nome" placeholder="Nome da pessoa"></div>' +
        '<div class="mb ng-ult"><label class="rot" for="nu-user">USUÁRIO</label>' +
          '<div class="nu-arroba"><span aria-hidden="true">@</span><input class="campo" id="nu-user" autocapitalize="none" spellcheck="false" ' +
          'placeholder="maria.silva"></div></div>' +
      '</section>' +

      acessoTipoHTML('nu', 'cliente') +

      clienteHTML('nu', clientes, []) +

      acessoInternoHTML('nu') +

      '<section class="ng-bloco"><h4>' + ICU.chave + 'Senha inicial</h4>' +
        '<div class="nu-senha">' +
          '<input class="campo" id="nu-senha" autocomplete="new-password" aria-label="Senha inicial">' +
          '<button class="b p" type="button" id="nu-gerar">Gerar</button>' +
        '</div>' +
        '<div class="gv-ajuda">Mínimo de 10 caracteres, com letras e números.</div>' +
      '</section>' +

      '<div id="nu-erro" class="ajuda erro-txt"></div>' +

      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar usuário</button></div>', { larga: true, extra: 'ng-modal nu-modal' });

    /* empresa e permissão de aprovação só fazem sentido para cliente */
    const blocoCliente = ligarCliente(m, 'nu', [], clientes);
    const acesso = ligarAcesso(m, 'nu', { tipo: 'cliente', ehAdmin: false, funcao: '', excecoes: {} },
      tipo => { blocoCliente.style.display = tipo === 'cliente' ? '' : 'none'; });

    m.querySelector('#nu-gerar').onclick = () => {
      m.querySelector('#nu-senha').value = gerarSenha();
      m.querySelector('#nu-senha').type = 'text';
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#nu-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = m.querySelector('#nu-cliente').lerEmpresas();
      const idn = acesso.ler();
      if (idn.erro) { erro.textContent = idn.erro; return; }
      const ehCli = idn.tipo === 'cliente';
      const corpo = Object.assign({
        acao: 'criar_usuario',
        nome: m.querySelector('#nu-nome').value.trim(),
        username: m.querySelector('#nu-user').value.trim(),
        senha: m.querySelector('#nu-senha').value,
        empresas: ehCli ? empresas : [],
        pode_aprovar: ehCli && aprovaPorPapel(empresas)
      }, idn);
      const cargosNovos = corpo.cargos || []; delete corpo.cargos;
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        const criado = await B7.DB.chamarAuth(corpo);
        if (cargosNovos.length && criado && criado.id) await B7.DB.rpc('perfil_definir_cargos', { p_id: criado.id, p_cargos: cargosNovos }).catch(() => {});
        const senha = corpo.senha;
        m.fechar();
        mostrarSenha(corpo.username, senha, 'Conta criada', corpo.nome);
        reabrir();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Criar usuário';
        erro.textContent = e.message || 'Não foi possível criar a conta.';
      }
    };
  }

  /* =================================================================
     EDITAR ACESSO
     ================================================================= */
  function modalEditar(u, clientes, vinculos, funcoesExtraAtuais) {
    const ligadas = vinculos.filter(v => v.perfil_id === u.id).map(v => ({ client_id: v.client_id, papel: v.papel || (u.pode_aprovar ? 'gestor' : 'equipe') }));
    const extrasAtuais = funcoesExtraAtuais || [];
    const m = B7.UI.modal(
      '<div class="ng-topo ed-topo"><span class="lu3-av ed-av">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</span><div><h3>' + esc(u.nome) + '</h3>' +
      '<div class="sub">@' + esc(u.username) + ' · o nome de usuário não muda</div></div></div>' +

      '<section class="ng-bloco"><h4>' + ICU.id + 'Quem é</h4>' +
        '<div class="mb ng-ult"><label class="rot" for="ed-nome">NOME</label>' +
          '<input class="campo" id="ed-nome" value="' + esc(u.nome) + '"></div>' +
      '</section>' +

      acessoTipoHTML('ed', u.papel === 'cliente' ? 'cliente' : 'interno') +

      clienteHTML('ed', clientes, ligadas) +

      acessoInternoHTML('ed') +

      '<div id="ed-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { larga: true, extra: 'ng-modal nu-modal ed-modal' });

    const blocoCliente = ligarCliente(m, 'ed', ligadas, clientes);
    const idt0 = identidadeDe(u);
    const acesso = ligarAcesso(m, 'ed', { tipo: idt0.tipo, ehAdmin: idt0.ehAdmin, funcao: idt0.funcao, excecoes: ACESSO.excecoes[u.id] || {},
        secundarias: ACESSO.secundarias[u.id] || {}, cargos: (extrasAtuais || []).slice() },
      tipo => { blocoCliente.style.display = tipo === 'cliente' ? '' : 'none'; });

    /* cargos adicionais atuais (lidos do banco) */
    B7.sb.from('perfis').select('funcoes_adicionais').eq('id', u.id).maybeSingle().then(({ data }) => {
      const atuais = (data && data.funcoes_adicionais) || [];
      acesso.definirCargos([...new Set(atuais.concat(extrasAtuais || []))]);
    }, () => {});

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#ed-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = blocoCliente.lerEmpresas();
      const idn = acesso.ler();
      if (idn.erro) { erro.textContent = idn.erro; return; }
      const ehCli = idn.tipo === 'cliente';
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth(Object.assign({
          acao: 'alterar_conta', perfil_id: u.id,
          nome: m.querySelector('#ed-nome').value.trim(),
          empresas: ehCli ? empresas : [],
          pode_aprovar: ehCli && aprovaPorPapel(empresas)
        }, Object.assign({}, idn, { cargos: undefined })));
        if (!ehCli) {
          await B7.DB.rpc('perfil_definir_cargos', { p_id: u.id, p_cargos: idn.cargos || [] });
        }
        m.fechar();
        B7.UI.toast('Acesso atualizado');
        reabrir();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Salvar';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };
  }

  /* =================================================================
     REDEFINIR SENHA
     ================================================================= */
  function modalSenha(u) {
    const m = B7.UI.modal('<h3>Redefinir senha</h3>' +
      '<div class="sub">A senha atual não pode ser consultada — só substituída. ' +
      'As sessões abertas de @' + esc(u.username) + ' serão encerradas.</div>' +
      '<label class="rot">NOVA SENHA</label>' +
      '<div class="nu-senha">' +
        '<input class="campo" id="rs-senha" autocomplete="new-password">' +
        '<button class="b p" type="button" id="rs-gerar">Gerar</button>' +
      '</div>' +
      '<div class="ajuda">Mínimo de 10 caracteres, com letras e números.</div>' +
      '<div id="rs-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Redefinir</button></div>');

    m.querySelector('#rs-gerar').onclick = () => {
      m.querySelector('#rs-senha').value = gerarSenha();
      m.querySelector('#rs-senha').type = 'text';
    };
    m.querySelector('[data-ok]').onclick = async () => {
      const senha = m.querySelector('#rs-senha').value;
      const erro = m.querySelector('#rs-erro');
      const botao = m.querySelector('[data-ok]');
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Redefinindo…';
      try {
        await B7.DB.chamarAuth({ acao: 'redefinir_senha', perfil_id: u.id, senha });
        m.fechar();
        mostrarSenha(u.username, senha, 'Senha redefinida', u.nome);
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Redefinir';
        erro.textContent = e.message || 'Não foi possível redefinir.';
      }
    };
  }

  async function alterarEstado(u, estado) {
    const desativando = estado !== 'ativa';
    /* zzz248: quem sai com trabalho em aberto: primeiro escolher para quem vai */
    if (desativando && u.papel !== 'cliente' && B7.Equipe) {
      const tem = await B7.Equipe.temTrabalho(u.id).catch(() => 0);
      if (tem) return B7.Equipe.repasse(u, { desativar: true, aoTerminar: reabrir });
    }
    const ok = await B7.UI.confirmar({
      titulo: desativando ? 'Desativar esta conta?' : 'Reativar esta conta?',
      texto: desativando
        ? '@' + u.username + ' deixa de entrar e as sessões abertas são encerradas. ' +
          'O histórico e a autoria continuam preservados.'
        : '@' + u.username + ' volta a acessar com a mesma senha de antes.',
      confirmar: desativando ? 'Desativar' : 'Reativar',
      perigo: desativando
    });
    if (!ok) return;
    try {
      await B7.DB.chamarAuth({ acao: 'alterar_conta', perfil_id: u.id, estado });
      B7.UI.toast(desativando ? 'Conta desativada' : 'Conta reativada');
      reabrir();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível alterar', { tipo: 'erro' });
    }
  }

  /* =================================================================
     A SENHA APARECE UMA VEZ SÓ
     ================================================================= */
  /* 4.31.0 (Kevin: "essa tela tá meio feia"): entrega de acesso nova —
     cabeçalho de sucesso, usuário e senha em linhas com copiar cada um,
     senha que dá para esconder, a mensagem pronta (com o endereço do
     sistema) para copiar ou mandar no WhatsApp, e o aviso de que a senha
     não aparece de novo. */
  const SITE_B7 = 'https://branding7dados-lab.github.io/sistema-b7/';
  function mostrarSenha(username, senha, titulo, nome) {
    const primeiro = String(nome || '').trim().split(/\s+/)[0] || '';
    const msg = () => B7.Textos.ler('acesso_entrega', { nome: primeiro || username, usuario: username, senha: senha, link: SITE_B7 })
      .replace(/^Olá, !/, 'Olá!');
    const IC = {
      ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
      copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
      olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s6.1 1.8 7.5 5.4"/></svg>',
      chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',
      zap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.6l4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.1 8.1 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.4-.2z"/></svg>',
      alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
    };
    const m = B7.UI.modal(
      '<div class="se-topo"><span class="se-selo" aria-hidden="true">' + IC.ok + '</span>' +
        '<div><h3>' + esc(titulo) + '</h3><p>' + (nome ? 'Acesso de <b>' + esc(nome) + '</b> pronto para entregar.' : 'Acesso pronto para entregar.') + '</p></div></div>' +
      '<div class="se-cartao">' +
        '<div class="se-linha"><span class="se-ic" aria-hidden="true">' + IC.user + '</span>' +
          '<div class="se-tx"><small>Usuário</small><b>' + esc(username) + '</b></div>' +
          '<button type="button" class="se-bt" data-copiar="usuario" aria-label="Copiar usuário">' + IC.copiar + '<span>Copiar</span></button></div>' +
        '<div class="se-linha"><span class="se-ic" aria-hidden="true">' + IC.chave + '</span>' +
          '<div class="se-tx"><small>Senha</small><b class="se-senha" id="se-valor">' + esc(senha) + '</b></div>' +
          '<button type="button" class="se-bt so-ic" data-olho aria-label="Esconder a senha" aria-pressed="false">' + IC.olho + '</button>' +
          '<button type="button" class="se-bt" data-copiar="senha" aria-label="Copiar senha">' + IC.copiar + '<span>Copiar</span></button></div>' +
      '</div>' +
      '<div class="se-msg"><small>Mensagem pronta</small><pre id="se-msg"></pre></div>' +
      '<p class="se-aviso">' + IC.alerta + '<span>Esta senha não aparece de novo. Se perder, é só redefinir.</span></p>' +
      '<div class="se-acoes">' +
        '<button type="button" class="b pri se-principal" data-copiar="msg">' + IC.copiar + '<span>Copiar mensagem</span></button>' +
        '<a class="b se-zap" target="_blank" rel="noopener" id="se-zap">' + IC.zap + '<span>WhatsApp</span></a>' +
      '</div>' +
      '<button type="button" class="b se-fim" data-fecha>Concluído</button>',
      { extra: 'se-modal' });
    m.querySelector('#se-msg').textContent = msg();
    m.querySelector('#se-zap').href = 'https://wa.me/?text=' + encodeURIComponent(msg());
    const valor = { usuario: username, senha: senha, msg: msg() };
    m.querySelectorAll('[data-copiar]').forEach(b => b.onclick = async () => {
      const k = b.dataset.copiar;
      try {
        await navigator.clipboard.writeText(valor[k]);
        const sp = b.querySelector('span'), antes = sp ? sp.textContent : '';
        b.classList.add('ok'); if (sp) sp.textContent = 'Copiado';
        setTimeout(() => { b.classList.remove('ok'); if (sp) sp.textContent = antes; }, 1600);
      } catch (e) {
        B7.UI.toast('Não foi possível copiar — selecione o texto', { tipo: 'erro' });
      }
    });
    const olho = m.querySelector('[data-olho]'), campo = m.querySelector('#se-valor');
    olho.onclick = () => {
      const esconde = !campo.classList.contains('oculta');
      campo.classList.toggle('oculta', esconde);
      olho.setAttribute('aria-pressed', String(esconde));
      olho.setAttribute('aria-label', esconde ? 'Mostrar a senha' : 'Esconder a senha');
    };
  }


  /* =================================================================
     FOTO DE PERFIL

     A foto é do usuário, mas o Admin pode gerenciá-la sem a senha dele.
     O endereço é validado como imagem antes de salvar: um link quebrado
     viraria um quadrado vazio sem explicação.
     ================================================================= */
  function modalFoto(u) {
    const iniciais = esc(B7.UI.iniciais(u.nome || u.username));
    const m = B7.UI.modal('<h3>Foto de perfil</h3>' +
      '<div class="sub">De @' + esc(u.username) + '. A pessoa também pode trocar a dela.</div>' +

      '<div class="foto-atual">' +
        '<div class="foto-previa av-pessoa tom-' + B7.UI.tomDoNome(u.nome || u.username) + '" id="fp-previa">' +
          (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="">' : '<span>' + iniciais + '</span>') +
        '</div>' +
        '<div class="foto-tx"><b>' + esc(u.nome) + '</b>' +
        '<span id="fp-estado">' + (u.avatar_url ? 'tem foto' : 'usando as iniciais') + '</span></div>' +
      '</div>' +

      '<div id="fp-zona"></div>' +
      '<div id="fp-erro" class="ajuda erro-txt"></div>' +

      '<div class="acoes">' +
        (u.avatar_url ? '<button class="b perigo" data-remover>Remover foto</button>' +
          '<div style="flex:1"></div>' : '') +
        '<button class="b" data-fecha>Cancelar</button>' +
        '<button class="b pri" data-ok disabled>Salvar foto</button>' +
      '</div>');

    const botao = m.querySelector('[data-ok]');
    const escolha = B7.Foto.montar(m.querySelector('#fp-zona'), {
      aoEscolher: dataUrl => {
        m.querySelector('#fp-previa').innerHTML = '<img src="' + dataUrl + '" alt="">';
        m.querySelector('#fp-estado').textContent = 'nova foto — ainda não salva';
        botao.disabled = false;
      }
    });

    const salvar = async (imagem) => {
      const erro = m.querySelector('#fp-erro');
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({ acao: 'avatar_de', perfil_id: u.id, imagem: imagem });
        m.fechar();
        B7.UI.toast(imagem ? 'Foto atualizada' : 'Foto removida');
        reabrir();
      } catch (e) {
        botao.disabled = !escolha.dataUrl(); botao.textContent = 'Salvar foto';
        erro.textContent = e.message || 'Não foi possível salvar.';
      }
    };

    botao.onclick = () => { if (escolha.dataUrl()) salvar(escolha.dataUrl()); };
    const rem = m.querySelector('[data-remover]');
    if (rem) rem.onclick = () => salvar(null);
  }

  /* =================================================================
     EXCLUIR CONTA
     ================================================================= */
  async function excluirConta(u) {
    const ok = await B7.UI.confirmar({
      titulo: 'Excluir a conta de ' + u.nome + '?',
      texto: '@' + u.username + ' perde o acesso definitivamente e não dá para desfazer. ' +
             'O que essa pessoa produziu — roteiros, comentários, aprovações — continua ' +
             'no sistema, com a autoria preservada. Se você só quer suspender o acesso, ' +
             'use Desativar conta.',
      confirmar: 'Excluir definitivamente',
      perigo: true
    });
    if (!ok) return;

    try {
      await B7.DB.chamarAuth({ acao: 'excluir_conta', perfil_id: u.id, confirmar: 'EXCLUIR' });
      B7.UI.toast('Conta excluída');
      reabrir();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível excluir', { tipo: 'erro' });
    }
  }

  /* Sorteio com crypto: Math.random não serve para gerar credencial. */
  function gerarSenha() {
    const letras = 'abcdefghijkmnopqrstuvwxyz';
    const maius = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const todos = letras + maius + nums;
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    let s = '';
    for (let i = 0; i < 14; i++) s += todos[bytes[i] % todos.length];
    /* garante ao menos uma letra e um número, que é o que a função exige */
    return s.slice(0, 12) + maius[bytes[12] % maius.length] + nums[bytes[13] % nums.length];
  }


  /* =================================================================
     zzz249: MATRIZ DE PERMISSÕES (Configurações → Funções e permissões)
     Uma visão geral: o padrão de cada função e o que vale para cada
     pessoa hoje, módulo a módulo. Mudar continua nos mesmos lugares
     (Funções e acessos; conta da pessoa) — aqui só abre.
     ================================================================= */
  const CONTEUDO = ['clientes', 'linhas', 'roteiros', 'gravacoes', 'semanas'];
  const chipNv = (n, cls) => '<span class="pm-nv pm-' + n + (cls ? ' ' + cls : '') + '" title="' + esc(rotuloNivel(n)) + '">' + (n === 'sem' ? '—' : esc(rotuloNivel(n))) + '</span>';
  async function montarMatriz(alvo) {
    if (!alvo) return;
    matrizAlvo = alvo;
    if (!alvo.innerHTML.trim()) alvo.innerHTML = B7.UI.skeleton('lista', { n: 5 });
    let dados, clientes;
    try {
      [dados, clientes] = await Promise.all([B7.DB.chamarAuth({ acao: 'listar_usuarios' }), B7.DB.listarClientes().catch(() => [])]);
    } catch (e) { alvo.innerHTML = '<p class="cfg-g-nota">Não foi possível carregar as permissões. ' + esc((e && e.message) || '') + '</p>'; return; }
    if (!alvo.isConnected) return;
    carregarAcesso(dados);
    const usuarios = dados.usuarios || [], vinculos = dados.vinculos || [], extras = dados.funcoes_extra || [];
    const equipe = usuarios.filter(u => u.papel !== 'cliente' && u.estado === 'ativa')
      .sort((a, b) => (identidadeDe(b).ehAdmin - identidadeDe(a).ehAdmin) || String(a.nome).localeCompare(b.nome));
    const fns = todasFuncoes(), mods = ACESSO.modulos;
    const so = id => ['designer', 'videomaker'].includes(id);
    /* zzz302: uma função (ou uma pessoa) por vez, módulo a módulo, em vez
       da tabela larga que não cabia no celular. Mesma leitura, mesmas regras. */
    const DESC_MOD = (m, n, extra) => n === 'sem' ? 'não aparece no menu' : n === 'ver' ? 'abre e consulta' : n === 'editar' ? 'cria e altera' : 'edita, aprova e exclui';
    let vista = 'funcao', fnSel = (fns[0] || {}).id, pessoaSel = (equipe.find(u => !identidadeDe(u).ehAdmin) || equipe[0] || {}).id;
    const resumoNv = lista => {
      const abre = lista.filter(n => n !== 'sem').length;
      return 'Abre <b>' + abre + '</b> de ' + lista.length + ' módulos' + (abre ? ' · ' + lista.filter(n => n === 'total').length + ' em Total' : '');
    };
    function blocoMatriz() {
      if (vista === 'funcao') {
        const f = fns.find(x => x.id === fnSel) || fns[0];
        if (!f) return '<p class="cfg-g-nota">Nenhuma função cadastrada.</p>';
        const niveis = mods.map(m => nivelPacote(f.id, m.id));
        const quem = equipe.filter(u => identidadeDe(u).funcao === f.id);
        return '<div class="pm2-sel" role="tablist" aria-label="Função">' + fns.map(x =>
            '<button type="button" role="tab" class="pm2-chip' + (x.id === f.id ? ' on' : '') + '" data-pm2-fn="' + esc(x.id) + '" aria-selected="' + (x.id === f.id) + '">' + esc(x.rotulo) +
            '<small>' + equipe.filter(u => identidadeDe(u).funcao === x.id).length + '</small></button>').join('') + '</div>' +
          '<div class="pm2-cab"><span>' + resumoNv(niveis) + '</span><span class="pm2-quem">' +
            (quem.length ? quem.map(u => '<i title="' + esc(u.nome) + '">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</i>').join('') + '<em>' + quem.length + (quem.length === 1 ? ' pessoa' : ' pessoas') + '</em>' : '<em>ninguém com esta função</em>') +
          '</span></div>' +
          '<div class="pm2-lista">' + mods.map((m, i) => {
            const n = niveis[i], trab = so(f.id) && CONTEUDO.includes(m.id) && ORD[n] >= 2;
            return '<div class="pm2-l' + (n === 'sem' ? ' off' : '') + '"><span class="pm2-mod"><b>' + esc(m.rotulo) + '</b><small>' +
              (trab ? 'vale para o trabalho dele (peças, demandas, entregas)' : DESC_MOD(m, n)) + '</small></span>' + chipNv(n, trab ? 'pm-trab' : '') + '</div>';
          }).join('') + '</div>' +
          '<div class="pm-acoes"><button type="button" class="b pri fina" data-pm-funcoes>Editar funções e acessos</button></div>';
      }
      const u = equipe.find(x => x.id === pessoaSel) || equipe[0];
      if (!u) return '<p class="cfg-g-nota">Ninguém na equipe ainda.</p>';
      const idt = identidadeDe(u), niveis = mods.map(m => nivelDe(u, m.id));
      const difs = idt.ehAdmin ? 0 : mods.filter((m, i) => niveis[i] !== nivelPadraoDe(u, m.id)).length;
      return '<div class="pm2-sel pm2-pessoas" role="tablist" aria-label="Pessoa">' + equipe.map(x =>
          '<button type="button" role="tab" class="pm2-chip pm2-p' + (x.id === u.id ? ' on' : '') + '" data-pm2-p="' + esc(x.id) + '" aria-selected="' + (x.id === u.id) + '">' +
          '<i>' + B7.UI.avatarPessoa(x, 'lu-avatar') + '</i>' + esc(primeiroNome(x)) + '</button>').join('') + '</div>' +
        '<div class="pm2-cab"><span><b>' + esc(u.nome) + '</b> · ' + esc(idt.ehAdmin ? 'Parceiro B7 (administrador)' : rotuloFuncao(idt.funcao)) + '<br>' +
          (idt.ehAdmin ? 'Abre tudo em Total.' : resumoNv(niveis) + (difs ? ' · <b class="pm2-dif">' + difs + (difs === 1 ? ' diferente da função' : ' diferentes da função') + '</b>' : ' · igual à função')) + '</span>' +
          '<button type="button" class="b fina contorno" data-pm-pessoa="' + esc(u.id) + '">Mudar o acesso</button></div>' +
        '<div class="pm2-lista">' + mods.map((m, i) => {
          const n = niveis[i], pad = nivelPadraoDe(u, m.id), dif = !idt.ehAdmin && n !== pad;
          return '<div class="pm2-l' + (n === 'sem' ? ' off' : '') + (dif ? ' dif' : '') + '"><span class="pm2-mod"><b>' + esc(m.rotulo) + '</b><small>' +
            (dif ? 'só para ' + esc(primeiroNome(u)) + ' · a função dá ' + esc(rotuloNivel(pad).toLowerCase()) : DESC_MOD(m, n)) + '</small></span>' + chipNv(n, dif ? 'pm-dif' : '') + '</div>';
        }).join('') + '</div>';
    }
    alvo.innerHTML =
      '<section class="cfg-g pm2"><h2 class="cfg-g-t">Quem abre o quê</h2>' +
        '<p class="cfg-g-nota">Escolha uma função para ver o padrão dela, ou uma pessoa para ver o que vale para ela hoje. Exceções de uma pessoa só mudam na conta dela.</p>' +
        '<div class="cl-seg pm2-vista" role="tablist"><button type="button" role="tab" data-pm2-vista="funcao" class="on" aria-selected="true">Por função</button>' +
          '<button type="button" role="tab" data-pm2-vista="pessoa" aria-selected="false">Por pessoa</button></div>' +
        '<div data-pm2></div>' +
      '</section>' +
      '<section class="cfg-g" data-pm-acoes></section>' +
      (B7.Auth.ehAdmin && B7.Auth.ehAdmin() ? '<section class="cfg-g"><h2 class="cfg-g-t">Conferência de segurança</h2>' +
        '<p class="cfg-g-nota">O banco testa sozinho cada pessoa em cada módulo e cada regra de acesso: ninguém pode alterar mais do que o nível dado, cliente não entra em módulo da equipe e nenhuma tabela fica aberta.</p>' +
        '<div class="pm-conf" data-pm-conf></div>' +
        '<div class="pm-acoes"><button type="button" class="b fina" data-pm-conferir>Conferir agora</button></div>' +
      '</section>' : '') +
      '<section class="cfg-g"><h2 class="cfg-g-t">Como os níveis funcionam</h2>' +
        '<div class="cfg-lista">' + NIVEIS.map(([v, r, d]) => '<div class="cfg-l"><span class="cfg-l-tx"><b>' + chipNv(v) + ' ' + esc(r) + '</b><small>' + esc(d) + '</small></span></div>').join('') + '</div>' +
        '<p class="cfg-g-nota">O banco confere cada ação pelo nível: quem só pode ver recebe um aviso se tentar alterar. ' +
        'Administrador tem tudo em Total. <b>Designer e videomaker</b>: o nível marcado com pontinho vale para o trabalho deles (peças, demandas, entregas); ' +
        'para alterar o conteúdo de Clientes, Linhas, Roteiros ou Gravações, ligue a ação em <b>O que cada um pode fazer</b> (acima), na função ou só na pessoa.</p>' +
      '</section>';
    const cxM = alvo.querySelector('[data-pm2]');
    const pintarMatriz = () => {
      if (!cxM || !cxM.isConnected) return;
      cxM.innerHTML = blocoMatriz();
      cxM.querySelectorAll('[data-pm2-fn]').forEach(b => b.onclick = () => { fnSel = b.dataset.pm2Fn; pintarMatriz(); });
      cxM.querySelectorAll('[data-pm2-p]').forEach(b => b.onclick = () => { pessoaSel = b.dataset.pm2P; pintarMatriz(); });
      const btF = cxM.querySelector('[data-pm-funcoes]'); if (btF) btF.onclick = () => modalFuncoes(usuarios);
      cxM.querySelectorAll('[data-pm-pessoa]').forEach(b => b.onclick = () => {
        const u = usuarios.find(x => x.id === b.dataset.pmPessoa); if (!u) return;
        modalEditar(u, clientes, vinculos, extras.filter(f => f.perfil_id === u.id).map(f => f.funcao));
      });
    };
    alvo.querySelectorAll('[data-pm2-vista]').forEach(b => b.onclick = () => {
      vista = b.dataset.pm2Vista;
      alvo.querySelectorAll('[data-pm2-vista]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      pintarMatriz();
    });
    pintarMatriz();
    const cxA = alvo.querySelector('[data-pm-acoes]'); if (cxA) montarAcoes(cxA, equipe);
    const btC = alvo.querySelector('[data-pm-conferir]');
    if (btC) { btC.onclick = () => conferir(alvo, btC); conferir(alvo, btC); }
  }

  /* =================================================================
     zzz269: O QUE CADA UM PODE FAZER (ações)
     Além do nível do módulo, cada ação importante tem um sim/não: por
     função (vale para todos com a função) e por pessoa (vale só para ela,
     por cima da função). Quem decide de verdade é o banco (pode_acao);
     sem nada marcado vale o padrão, que é a regra de sempre.
     ================================================================= */
  async function montarAcoes(caixa, equipe) {
    const cab = '<h2 class="cfg-g-t">O que cada um pode fazer</h2>' +
      '<p class="cfg-g-nota">Cada ação liga ou desliga sozinha, por cima do nível do módulo. Marque por <b>função</b> (vale para todos com ela) ' +
      'ou abra uma <b>pessoa</b> para dar ou tirar só dela. O banco obedece na hora, e a pessoa vê a mudança sem precisar sair e entrar.</p>';
    caixa.innerHTML = cab + B7.UI.skeleton('lista', { n: 4 });
    let d;
    try { d = await B7.DB.rpc('acoes_painel', {}); }
    catch (e) { caixa.innerHTML = cab + '<p class="cfg-g-nota">Não foi possível carregar as ações. ' + esc((e && e.message) || '') + '</p>'; return; }
    if (!caixa.isConnected) return;
    const cat = d.catalogo || [];
    let fx = {}, px = {}, ef = d.efetivo || {};
    const ler = dd => {
      fx = {}; px = {}; ef = dd.efetivo || {};
      (dd.funcoes || []).forEach(f => { (fx[f.funcao] = fx[f.funcao] || {})[f.acao] = !!f.permitido; });
      (dd.pessoas || []).forEach(x => { (px[x.perfil_id] = px[x.perfil_id] || {})[x.acao] = x.efeito; });
    };
    ler(d);
    const fns = todasFuncoes();
    const pessoas = (equipe || []).filter(u => !identidadeDe(u).ehAdmin);
    let aba = 'funcao', pessoaSel = pessoas[0] ? pessoas[0].id : null;
    const modulosCat = []; cat.forEach(a => { if (!modulosCat.includes(a.modulo)) modulosCat.push(a.modulo); });
    /* o padrão de uma função: o cargo está na regra de sempre e o nível no módulo alcança */
    const padraoFn = (f, a) => {
      const n = ORD[nivelPacote(f.id, a.modulo)] || 0;
      return f.base ? n >= a.nivel_min : (a.padrao_funcoes || []).includes(f.id) && n >= a.nivel_min;
    };
    const valorFn = (f, a) => (fx[f.id] && a.id in fx[f.id]) ? fx[f.id][a.id] : padraoFn(f, a);
    const recarregar = async () => { try { ler(await B7.DB.rpc('acoes_painel', {})); } catch (e) {} };

    /* zzz302: uma função por vez, ação por ação, com um interruptor —
       no lugar da tabela larga (mesmos botões e mesma gravação). */
    let fnA = (fns[0] || {}).id;
    function tabelaFuncoes() {
      const f = fns.find(x => x.id === fnA) || fns[0];
      if (!f) return '<p class="cfg-g-nota">Nenhuma função cadastrada.</p>';
      const nPers = cat.filter(a => fx[f.id] && a.id in fx[f.id] && fx[f.id][a.id] !== padraoFn(f, a)).length;
      return '<div class="pm2-sel" role="tablist" aria-label="Função">' + fns.map(x =>
          '<button type="button" role="tab" class="pm2-chip' + (x.id === f.id ? ' on' : '') + '" data-pa-fn="' + esc(x.id) + '" aria-selected="' + (x.id === f.id) + '">' + esc(x.rotulo) + '</button>').join('') + '</div>' +
        '<p class="cfg-g-nota">' + esc(f.rotulo) + ': pode ' + cat.filter(a => valorFn(f, a)).length + ' de ' + cat.length + ' ações' +
          (nPers ? ' · <b>' + nPers + (nPers === 1 ? ' mudada por você' : ' mudadas por você') + '</b>' : ' · tudo no padrão') + '. Toque para ligar ou desligar.</p>' +
        '<div class="pa-lista pa2">' + modulosCat.map(md => '<div class="pa-grupo"><h3>' + esc(rotuloModulo(md)) + '</h3>' +
          cat.filter(a => a.modulo === md).map(a => {
            const v = valorFn(f, a), pers = fx[f.id] && a.id in fx[f.id] && fx[f.id][a.id] !== padraoFn(f, a);
            return '<div class="pa-linha' + (pers ? ' pers' : '') + '"><span class="pa-ac"><b>' + esc(a.rotulo) + '</b><small>' +
                (a.descricao ? esc(a.descricao) + ' · ' : '') + (pers ? 'mudado por você (o padrão era ' + (padraoFn(f, a) ? 'sim' : 'não') + ')' : 'padrão') + '</small></span>' +
              '<button type="button" class="pa-cel pa-sw ' + (v ? 'sim' : 'nao') + (pers ? ' pers' : '') + '" role="switch" data-fn="' + esc(f.id) + '" data-ac="' + esc(a.id) + '" aria-checked="' + v + '" ' +
                'aria-label="' + esc(f.rotulo + ' · ' + a.rotulo) + '"><i aria-hidden="true"></i><span>' + (v ? 'Pode' : 'Não pode') + '</span></button></div>';
          }).join('') + '</div>').join('') + '</div>';
    }
    function blocoPessoa() {
      if (!pessoas.length) return '<p class="cfg-g-nota">Só há administradores na equipe: eles podem tudo.</p>';
      const u = pessoas.find(x => x.id === pessoaSel) || pessoas[0];
      const meu = px[u.id] || {}, efu = ef[u.id] || {};
      const n = Object.keys(meu).length;
      return '<div class="pa-pessoas" role="tablist" aria-label="Pessoa">' + pessoas.map(x =>
          '<button type="button" role="tab" class="pa-p' + (x.id === u.id ? ' on' : '') + '" data-pa-pessoa="' + esc(x.id) + '" aria-selected="' + (x.id === u.id) + '">' +
          '<b>' + esc(primeiroNome(x)) + '</b><small>' + esc(rotuloFuncao(identidadeDe(x).funcao)) + (Object.keys(px[x.id] || {}).length ? ' · ' + Object.keys(px[x.id]).length + (Object.keys(px[x.id]).length === 1 ? ' exceção' : ' exceções') : '') + '</small></button>').join('') + '</div>' +
        '<p class="cfg-g-nota">' + esc(u.nome) + ' · ' + esc(rotuloFuncao(identidadeDe(u).funcao)) + (n ? ' · <b>' + n + (n === 1 ? ' exceção marcada' : ' exceções marcadas') + '</b>' : ' · segue a função em tudo') + '</p>' +
        '<div class="pa-lista">' + modulosCat.map(md => '<div class="pa-grupo"><h3>' + esc(rotuloModulo(md)) + '</h3>' +
          cat.filter(a => a.modulo === md).map(a => {
            const e = meu[a.id] || '', v = efu[a.id] ? !!efu[a.id].v : false;
            const daFuncao = e ? null : v;
            return '<div class="pa-linha' + (e ? ' pers' : '') + '"><span class="pa-ac"><b>' + esc(a.rotulo) + '</b><small>' +
                (e ? 'Só para ' + esc(primeiroNome(u)) + ': ' + (e === 'permitir' ? 'pode' : 'não pode') : 'Pela função: ' + (daFuncao ? 'pode' : 'não pode')) + '</small></span>' +
              '<div class="ac-nv pa-seg" role="radiogroup" aria-label="' + esc(a.rotulo) + '">' +
                [['', 'Como a função'], ['permitir', 'Sim'], ['negar', 'Não']].map(([k, r]) =>
                  '<button type="button" role="radio" aria-checked="' + (k === e) + '" class="ac-nv-b' + (k === e ? ' on' : '') + (k === 'permitir' ? ' anv-total' : k === 'negar' ? ' anv-sem' : ' anv-ver') + '" data-pa-ac="' + esc(a.id) + '" data-pa-ef="' + k + '">' + r + '</button>').join('') +
              '</div></div>';
          }).join('') + '</div>').join('') + '</div>';
    }
    function pintar() {
      if (!caixa.isConnected) return;
      caixa.innerHTML = cab +
        '<div class="pa-abas" role="tablist"><button type="button" role="tab" data-pa-aba="funcao" class="' + (aba === 'funcao' ? 'on' : '') + '" aria-selected="' + (aba === 'funcao') + '">Por função</button>' +
        '<button type="button" role="tab" data-pa-aba="pessoa" class="' + (aba === 'pessoa' ? 'on' : '') + '" aria-selected="' + (aba === 'pessoa') + '">Por pessoa</button></div>' +
        (aba === 'funcao' ? tabelaFuncoes() : blocoPessoa());
      caixa.querySelectorAll('[data-pa-aba]').forEach(b => b.onclick = () => { aba = b.dataset.paAba; pintar(); });
      caixa.querySelectorAll('[data-pa-pessoa]').forEach(b => b.onclick = () => { pessoaSel = b.dataset.paPessoa; pintar(); });
      caixa.querySelectorAll('[data-pa-fn]').forEach(b => b.onclick = () => { fnA = b.dataset.paFn; pintar(); });
      caixa.querySelectorAll('.pa-cel[data-fn]').forEach(b => b.onclick = async () => {
        const f = fns.find(x => x.id === b.dataset.fn), a = cat.find(x => x.id === b.dataset.ac);
        if (!f || !a) return;
        const novo = !valorFn(f, a);
        b.disabled = true;
        try {
          await B7.DB.rpc('funcao_acao_definir', { p_funcao: f.id, p_acao: a.id, p_permitido: novo === padraoFn(f, a) ? null : novo });
          await recarregar();
          B7.UI.toast(f.rotulo + ': ' + a.rotulo.toLowerCase() + ' — ' + (novo ? 'pode' : 'não pode') + '. Quem tem a função já vê a mudança.');
        } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
        pintar();
      });
      caixa.querySelectorAll('[data-pa-ac]').forEach(b => b.onclick = async () => {
        const u = pessoas.find(x => x.id === pessoaSel) || pessoas[0], a = cat.find(x => x.id === b.dataset.paAc);
        if (!u || !a || b.classList.contains('on')) return;
        caixa.querySelectorAll('[data-pa-ac="' + a.id + '"]').forEach(x => { x.disabled = true; });
        try {
          const r = await B7.DB.rpc('perfil_acao_definir', { p_perfil: u.id, p_acao: a.id, p_efeito: b.dataset.paEf || null });
          if (b.dataset.paEf) (px[u.id] = px[u.id] || {})[a.id] = b.dataset.paEf; else if (px[u.id]) delete px[u.id][a.id];
          if (r) (ef[u.id] = ef[u.id] || {})[a.id] = r;
          B7.UI.toast(primeiroNome(u) + ': ' + a.rotulo.toLowerCase() + ' — ' + (r && r.v ? 'pode' : 'não pode') + '. Já está valendo.');
        } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
        pintar();
      });
    }
    pintar();
  }

  async function conferir(alvo, bt) {
    const caixa = alvo.querySelector('[data-pm-conf]'); if (!caixa) return;
    bt.disabled = true; caixa.innerHTML = '<p class="cfg-g-nota">Conferindo…</p>';
    let r;
    try { r = await B7.DB.conferirPermissoes(); }
    catch (e) { caixa.innerHTML = '<p class="cfg-g-nota">Não foi possível conferir. ' + esc((e && e.message) || '') + '</p>'; bt.disabled = false; return; }
    if (!caixa.isConnected) return;
    bt.disabled = false;
    const quando = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    caixa.innerHTML = !r || !r.length
      ? '<div class="pm-conf-ok">' + ICU.perfil + '<span><b>Tudo certo</b><small>Nenhum problema encontrado · conferido às ' + quando + '</small></span></div>'
      : '<div class="pm-conf-mal"><b>' + r.length + (r.length === 1 ? ' problema encontrado' : ' problemas encontrados') + '</b>' +
          '<ul>' + r.map(p => '<li><b>' + esc(p.onde) + '</b><small>' + esc(p.detalhe) + '</small></li>').join('') + '</ul>' +
          '<small>Conferido às ' + quando + '. Corrija em Funções e acessos ou na conta da pessoa; se for uma regra do banco, peça ajuda ao suporte.</small></div>';
  }

  return { abrir, gerarSenha, montarMatriz, mostrarSenha, cederAcesso };
})();
