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
  let hospede = null;
  const painel = () => hospede || document.getElementById('painel-dashboard');
  const naTela = () => location.hash.indexOf('#/usuarios') === 0 || !!(hospede && hospede.isConnected);
  const reabrir = () => abrir(hospede ? { alvo: hospede } : undefined);

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
  /* zzz70: empresas + aprovação do cliente — o mesmo bloco ao criar e ao
     editar (pílulas com busca e contador, aprovação como chave). */
  function clienteHTML(px, clientes, ligadas, podeAprovar) {
    const lig = ligadas || [];
    return '<section class="ng-bloco" id="' + px + '-cliente"><h4>' + ICU.emp + 'Empresas que acompanha' +
        '<span class="mg-obr leve" id="' + px + '-cont">nenhuma</span></h4>' +
        (clientes.length
          ? (clientes.length > 8 ? '<div class="nu-busca"><input class="campo" id="' + px + '-busca-emp" type="search" placeholder="Buscar empresa…" aria-label="Buscar empresa"></div>' : '') +
            '<div class="nu-empresas nu-pilulas">' + clientes.map(c =>
              '<label class="op-mini' + (lig.includes(c.id) ? ' on' : '') + '" data-nome="' + esc(String(c.nome).toLowerCase()) + '">' +
              '<input type="checkbox" value="' + esc(c.id) + '"' + (lig.includes(c.id) ? ' checked' : '') + '>' +
              '<span>' + esc(c.nome) + '</span></label>').join('') + '</div>'
          : '<div class="vazio-leve">Cadastre um cliente primeiro.</div>') +
        '<label class="op-mini nu-chave-linha' + (podeAprovar ? ' on' : '') + '" id="' + px + '-aprovar">' +
          '<span>Pode aprovar oficialmente' +
          '<small>sem isso, a pessoa visualiza e comenta, mas não aprova</small></span>' +
          '<input type="checkbox" role="switch"' + (podeAprovar ? ' checked' : '') + '></label>' +
      '</section>';
  }
  function ligarCliente(m, px) {
    const bloco = m.querySelector('#' + px + '-cliente');
    const contar = () => {
      const n = bloco.querySelectorAll('.nu-pilulas input:checked').length;
      const c = m.querySelector('#' + px + '-cont');
      if (c) { c.textContent = n ? n + (n === 1 ? ' selecionada' : ' selecionadas') : 'nenhuma'; c.classList.toggle('leve', !n); }
    };
    bloco.querySelectorAll('.op-mini input').forEach(cx => cx.onchange = () => {
      cx.closest('.op-mini').classList.toggle('on', cx.checked);
      contar();
    });
    const buscaEmp = m.querySelector('#' + px + '-busca-emp');
    if (buscaEmp) buscaEmp.oninput = () => {
      const t = buscaEmp.value.trim().toLowerCase();
      bloco.querySelectorAll('.nu-pilulas .op-mini').forEach(l => { l.hidden = !!t && !l.dataset.nome.includes(t); });
    };
    contar();
    return bloco;
  }
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
              '<button type="button" class="b fina pri" data-aprovar>Aprovar</button><button type="button" class="b fina" data-recusar>Recusar</button></div></div>';
        }).join('') + '</section>' : '') +
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
          B7.UI.toast(aprovar ? 'Acesso liberado. A pessoa já recebeu o aviso.' : 'Pedido recusado.');
          abrir();
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
    const empresasDe = id => vinculos.filter(v => v.perfil_id === id)
      .map(v => (v.clientes && v.clientes.nome) || '');
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
    const FILTROS = [['todos', 'Todas'], ['online', 'Online'], ['admin', 'Administradores'], ['coordenador', 'Coordenação'], ['designer', 'Design'],
      ['videomaker', 'Vídeo'], ['clientes', 'Clientes'], ['personalizado', 'Acesso personalizado'], ['atencao', 'Pedem atenção'], ['inativas', 'Desativadas']];
    if (!FILTROS.some(f => f[0] === filtro.tipo)) filtro.tipo = 'todos';
    const pilula = (id, rot) => '<button type="button" class="lu3-pil' + (filtro.tipo === id ? ' on' : '') + '" data-lu-tipo="' + id + '">' +
      (id === 'online' ? '<i class="lu3-ponto' + (conta.online ? ' vivo' : '') + '" aria-hidden="true"></i>' : '') +
      (id === 'atencao' ? '<i class="lu4-ponto-at" aria-hidden="true"></i>' : '') +
      rot + '<b>' + conta[id] + '</b></button>';
    const kpi = (id, n, rot, cls, i) => '<button type="button" class="lu4-kpi ' + (cls || '') + (filtro.tipo === id ? ' on' : '') + '" data-lu-tipo="' + id + '" style="--i:' + i + '">' +
      '<b>' + n + '</b><span>' + rot + '</span></button>';

    painel().innerHTML = '<div class="conteudo entra lu3 lu4">' +
      '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
      '<b>Usuários e acessos</b></div>' +
      '<div class="cab-conteudo lu3-cab"><div><h1>Usuários e acessos</h1>' +
        '<p>' + usuarios.length + ' conta' + (usuarios.length === 1 ? '' : 's') + ' · criadas pela Branding7, sem cadastro público.</p></div>' +
        '<button class="b contorno lu3-funcoes" id="lu-hist" title="Quem mudou o acesso de quem">' + IC_HIST + '<span>Histórico</span></button>' +
        '<button class="b contorno lu3-funcoes" id="lu-funcoes">' + IC_ACESSO + '<span>Funções e acessos</span></button>' +
        '<button class="b pri lu3-novo" id="novo-usuario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Novo usuário</span></button>' +
      '</div>' +

      (usuarios.length
        ? '<div class="lu4-kpis">' +
            kpi('todos', equipeAtiva.length, 'na equipe', '', 0) +
            kpi('online', conta.online, 'online agora', conta.online ? 'ok' : '', 1) +
            kpi('admin', conta.admin, conta.admin === 1 ? 'administrador' : 'administradores', '', 2) +
            kpi('personalizado', conta.personalizado, 'com acesso personalizado', conta.personalizado ? 'violeta' : '', 3) +
            kpi('atencao', conta.atencao, conta.atencao === 1 ? 'conta pede atenção' : 'contas pedem atenção', conta.atencao ? 'ambar' : 'ok', 4) +
            (conta.clientes ? kpi('clientes', conta.clientes, 'no Portal', '', 5) : '') +
          '</div>' +
          '<div id="lu-avisos" class="lu5-avisos"></div>' +
          '<div class="lu3-barra">' +
            '<label class="lu-busca lu3-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input id="lu-busca" placeholder="Buscar por nome ou usuário…" autocomplete="off" value="' + esc(filtro.termo) + '"></label>' +
            '<div class="lu3-pils" role="group" aria-label="Filtrar contas">' +
              FILTROS.filter(f => f[0] === 'todos' || conta[f[0]]).map(f => pilula(f[0], f[1])).join('') +
            '</div>' +
          '</div>' +
          '<div id="lu-lista"></div>'
        : '<div class="estado-b7"><b>Nenhuma conta ainda.</b>' +
          '<p>Crie a primeira conta de coordenador ou cliente.</p></div>') +
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
      if (acao === 'estado') return alterarEstado(u, estado);
      if (acao === 'foto') return modalFoto(u);
      if (acao === 'excluir') return excluirConta(u);
      if (acao === 'historico') return modalHistorico(u, usuarios);
    };

    /* A lista é redesenhada a partir do que já veio do servidor: buscar
       e filtrar não refazem a consulta. Equipe e clientes em blocos
       separados — quem produz × quem acompanha. */
    function pintar() {
      const alvo = document.getElementById('lu-lista');
      if (!alvo) return;
      const termo = filtro.termo.trim().toLowerCase();
      const t = filtro.tipo, idt = u => identidadeDe(u);
      const passaTipo = u => t === 'online' ? (u.estado === 'ativa' && presenca(u).online)
        : t === 'admin' ? u.estado === 'ativa' && u.papel !== 'cliente' && idt(u).ehAdmin
        : ['coordenador', 'designer', 'videomaker'].includes(t) ? u.estado === 'ativa' && u.papel !== 'cliente' && idt(u).funcao === t
        : t === 'clientes' ? u.papel === 'cliente' && u.estado === 'ativa'
        : t === 'personalizado' ? u.estado === 'ativa' && difDe(u).length > 0
        : t === 'atencao' ? atencao(u)
        : t === 'inativas' ? u.estado !== 'ativa' : true;
      const passa = u => passaTipo(u) && (!termo || (u.nome || '').toLowerCase().includes(termo) ||
        (u.username || '').toLowerCase().includes(termo));
      const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
      const minha = u => (eu && eu.id === u.id ? 0 : 1);
      const ordem = (a, b) => minha(a) - minha(b) ||
        (a.estado === 'ativa' ? 0 : 1) - (b.estado === 'ativa' ? 0 : 1) ||
        (presenca(b).online ? 1 : 0) - (presenca(a).online ? 1 : 0) ||
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      const equipe = usuarios.filter(u => u.papel !== 'cliente' && passa(u)).sort(ordem);
      const clis = usuarios.filter(u => u.papel === 'cliente' && passa(u)).sort(ordem);
      let n = 0;
      const bloco = (titulo, ajuda, lista, ehCliente) => !lista.length ? '' :
        '<section class="lu3-grupo">' +
          '<h2 class="lu3-grupo-tit" title="' + ajuda + '">' + titulo + '<span>' + lista.length + '</span></h2>' +
          '<div class="lu4-grade">' +
            lista.map(u => cartaoPessoa(u, empresasDe(u.id), extrasDe(u.id), presenca(u), alertasDe(u), ehCliente, n++)).join('') +
          '</div></section>';

      alvo.innerHTML = (equipe.length || clis.length)
        ? bloco('Equipe', 'Quem produz e organiza o trabalho dentro do B7.', equipe, false) +
          bloco('Clientes', 'Quem acompanha e aprova pelo Portal, só nas empresas vinculadas.', clis, true)
        : '<div class="estado-b7"><b>Ninguém aqui' + (filtro.termo ? ' para “' + esc(filtro.termo) + '”' : '') + '.</b></div>';

      B7.UI.ligarMenus(alvo);
      alvo.querySelectorAll('[data-acao-conta]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        abrirAcao(usuarios.find(x => x.id === b.dataset.id), b.dataset.acaoConta, b.dataset.estado);
      });
      /* o cartão inteiro abre "Editar acesso"; o menu ⋯ guarda o resto */
      alvo.querySelectorAll('.lu4-card').forEach(el => {
        const abrirEdicao = () => abrirAcao(usuarios.find(x => x.id === el.dataset.id), 'editar');
        el.onclick = e => { if (!e.target.closest('.menu')) abrirEdicao(); };
        el.onkeydown = e => { if (e.key === 'Enter' && e.target === el) abrirEdicao(); };
      });
    }
    pintar();
    const marcarFiltro = () => painel().querySelectorAll('[data-lu-tipo]').forEach(x => x.classList.toggle('on', x.dataset.luTipo === filtro.tipo));
    painel().querySelectorAll('[data-lu-tipo]').forEach(b => b.onclick = () => {
      const t = b.dataset.luTipo;
      filtro.tipo = filtro.tipo === t || t === 'todos' ? 'todos' : t;
      marcarFiltro();
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
      ? '<span class="lu4-tag lu3-p-cliente">Cliente</span>' + (u.pode_aprovar ? '<span class="lu4-tag leve">aprova</span>' : '')
      : (idt.ehAdmin ? (u.superadmin === 'supremo' ? '<span class="lu4-tag lu3-p-super supremo" title="Acima de todos os administradores">Admin supremo</span>'
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
          '<button data-acao-conta="historico" data-id="' + esc(u.id) + '">Histórico de acesso</button>' +
          '<button data-acao-conta="foto" data-id="' + esc(u.id) + '">Foto de perfil</button>' +
          '<button data-acao-conta="senha" data-id="' + esc(u.id) + '">Redefinir senha</button>' +
          '<button data-acao-conta="2fa" data-id="' + esc(u.id) + '">Desligar verificação em 2 etapas</button>' +
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
  const filtro = { termo: '', tipo: 'todos' };

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

      clienteHTML('nu', clientes, [], false) +

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
    const blocoCliente = ligarCliente(m, 'nu');
    const acesso = ligarAcesso(m, 'nu', { tipo: 'cliente', ehAdmin: false, funcao: '', excecoes: {} },
      tipo => { blocoCliente.style.display = tipo === 'cliente' ? '' : 'none'; });

    m.querySelector('#nu-gerar').onclick = () => {
      m.querySelector('#nu-senha').value = gerarSenha();
      m.querySelector('#nu-senha').type = 'text';
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const erro = m.querySelector('#nu-erro');
      const botao = m.querySelector('[data-ok]');
      const empresas = [...m.querySelectorAll('#nu-cliente input[type=checkbox][value]')]
        .filter(c => c.checked).map(c => c.value);
      const idn = acesso.ler();
      if (idn.erro) { erro.textContent = idn.erro; return; }
      const ehCli = idn.tipo === 'cliente';
      const corpo = Object.assign({
        acao: 'criar_usuario',
        nome: m.querySelector('#nu-nome').value.trim(),
        username: m.querySelector('#nu-user').value.trim(),
        senha: m.querySelector('#nu-senha').value,
        empresas: ehCli ? empresas : [],
        pode_aprovar: ehCli && m.querySelector('#nu-aprovar input').checked
      }, idn);
      const cargosNovos = corpo.cargos || []; delete corpo.cargos;
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        const criado = await B7.DB.chamarAuth(corpo);
        if (cargosNovos.length && criado && criado.id) await B7.DB.rpc('perfil_definir_cargos', { p_id: criado.id, p_cargos: cargosNovos }).catch(() => {});
        const senha = corpo.senha;
        m.fechar();
        mostrarSenha(corpo.username, senha, 'Conta criada');
        abrir();
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
    const ligadas = vinculos.filter(v => v.perfil_id === u.id).map(v => v.client_id);
    const extrasAtuais = funcoesExtraAtuais || [];
    const m = B7.UI.modal(
      '<div class="ng-topo ed-topo"><span class="lu3-av ed-av">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</span><div><h3>' + esc(u.nome) + '</h3>' +
      '<div class="sub">@' + esc(u.username) + ' · o nome de usuário não muda</div></div></div>' +

      '<section class="ng-bloco"><h4>' + ICU.id + 'Quem é</h4>' +
        '<div class="mb ng-ult"><label class="rot" for="ed-nome">NOME</label>' +
          '<input class="campo" id="ed-nome" value="' + esc(u.nome) + '"></div>' +
      '</section>' +

      acessoTipoHTML('ed', u.papel === 'cliente' ? 'cliente' : 'interno') +

      clienteHTML('ed', clientes, ligadas, !!u.pode_aprovar) +

      acessoInternoHTML('ed') +

      '<div id="ed-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { larga: true, extra: 'ng-modal nu-modal ed-modal' });

    const blocoCliente = ligarCliente(m, 'ed');
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
      const empresas = [...m.querySelectorAll('#ed-cliente input[type=checkbox][value]')]
        .filter(c => c.checked).map(c => c.value);
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
          pode_aprovar: ehCli && m.querySelector('#ed-aprovar input').checked
        }, Object.assign({}, idn, { cargos: undefined })));
        if (!ehCli) {
          await B7.DB.rpc('perfil_definir_cargos', { p_id: u.id, p_cargos: idn.cargos || [] });
        }
        m.fechar();
        B7.UI.toast('Acesso atualizado');
        abrir();
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
        mostrarSenha(u.username, senha, 'Senha redefinida');
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Redefinir';
        erro.textContent = e.message || 'Não foi possível redefinir.';
      }
    };
  }

  async function alterarEstado(u, estado) {
    const desativando = estado !== 'ativa';
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
      abrir();
    } catch (e) {
      B7.UI.toast(e.message || 'Não foi possível alterar', { tipo: 'erro' });
    }
  }

  /* =================================================================
     A SENHA APARECE UMA VEZ SÓ
     ================================================================= */
  function mostrarSenha(username, senha, titulo) {
    const m = B7.UI.modal('<h3>' + esc(titulo) + '</h3>' +
      '<div class="sub">Copie agora e entregue pelo canal que a equipe usa. ' +
      'Esta senha não poderá ser consultada depois.</div>' +
      '<div class="senha-entrega">' +
        '<div><small>USUÁRIO</small><b>' + esc(username) + '</b></div>' +
        '<div><small>SENHA</small><b id="se-valor">' + esc(senha) + '</b></div>' +
      '</div>' +
      '<button class="b contorno" id="se-copiar" style="width:100%">Copiar usuário e senha</button>' +
      '<div class="acoes"><button class="b pri" data-fecha>Concluído</button></div>');

    m.querySelector('#se-copiar').onclick = async () => {
      try {
        await navigator.clipboard.writeText(B7.Textos.ler('acesso_entrega', { usuario: username, senha: senha }));
        m.querySelector('#se-copiar').textContent = 'Copiado';
      } catch (e) {
        B7.UI.toast('Não foi possível copiar — selecione o texto acima', { tipo: 'erro' });
      }
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
        abrir();
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
      abrir();
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

  return { abrir, gerarSenha };
})();
