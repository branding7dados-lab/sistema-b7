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
  const painel = () => document.getElementById('painel-dashboard');

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
  const rotuloFuncao = fn => (FUNCOES.find(x => x[0] === fn) || [, 'Sem função'])[1];
  /* carregado a cada abertura da tela (listar_usuarios) */
  let ACESSO = { modulos: [], presets: {}, excecoes: {} };
  let CONTATOS = {};   /* perfil_id → WhatsApp (só dígitos); vem de listar_usuarios */
  function carregarAcesso(dados) {
    const reg = (dados.modulos && dados.modulos.length) ? dados.modulos
      : (B7.Perm && B7.Perm.MODULOS ? B7.Perm.MODULOS.map(m => ({ id: m.id, rotulo: m.rotulo })) : []);
    const presets = { coordenador: [], designer: [], videomaker: [] };
    if (dados.presets) dados.presets.forEach(p => { (presets[p.funcao] = presets[p.funcao] || []).push(p.modulo); });
    else if (B7.Perm && B7.Perm.PADRAO_FUNCAO) Object.assign(presets, B7.Perm.PADRAO_FUNCAO);
    const excecoes = {};
    (dados.excecoes || []).forEach(e => { (excecoes[e.perfil_id] = excecoes[e.perfil_id] || {})[e.modulo] = e.efeito; });
    ACESSO = { modulos: reg, presets, excecoes };
    CONTATOS = {};
    (dados.contatos || []).forEach(k => { if (k.whatsapp) CONTATOS[k.perfil_id] = k.whatsapp; });
  }
  const identidadeDe = u => ({
    tipo: u.papel === 'cliente' ? 'cliente' : 'interno',
    ehAdmin: u.eh_admin !== undefined ? !!u.eh_admin : u.papel === 'admin',
    funcao: u.funcao !== undefined ? (u.funcao || '') : (['coordenador', 'designer', 'videomaker'].includes(u.papel) ? u.papel : '')
  });
  function modulosEfetivosDe(u) {
    const id = identidadeDe(u);
    if (id.tipo === 'cliente') return [];
    if (id.ehAdmin) return ACESSO.modulos.map(m => m.id);
    const ex = ACESSO.excecoes[u.id] || {}, base = ACESSO.presets[id.funcao] || [];
    return ACESSO.modulos.map(m => m.id).filter(m => ex[m] ? ex[m] === 'permitir' : base.includes(m));
  }
  /* 5577999990000 → (77) 99999-0000 */
  const mascaraWhats = d => {
    let n = String(d || '').replace(/\D/g, '');
    if (n.length >= 12 && n.indexOf('55') === 0) n = n.slice(2);
    if (n.length < 10) return n;
    return '(' + n.slice(0, 2) + ') ' + n.slice(2, n.length - 4) + '-' + n.slice(-4);
  };
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
      '<div class="nu-papeis ac-funcoes" id="' + px + '-funcao">' +
        FUNCOES.map(([v, r]) => '<button type="button" class="nu-papel" data-funcao="' + v + '"><i aria-hidden="true"></i><b>' + r + '</b></button>').join('') +
        '<button type="button" class="nu-papel" data-funcao=""><i aria-hidden="true"></i><b>Nenhuma</b></button>' +
      '</div>' +
      '<p class="gv-ajuda ac-ajuda" id="' + px + '-fdesc"></p>' +
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
  /* ini: { tipo, ehAdmin, funcao, excecoes } — aoTipo(tipo) avisa a troca cliente/equipe */
  function ligarAcesso(m, px, ini, aoTipo) {
    const E = { tipo: ini.tipo, ehAdmin: !!ini.ehAdmin, funcao: ini.funcao || '', excecoes: Object.assign({}, ini.excecoes || {}) };
    const funcaoInicial = E.funcao;
    const q = sel => m.querySelector('#' + px + '-' + sel);
    const base = () => ACESSO.presets[E.funcao] || [];
    const efetivo = id => E.ehAdmin ? true : (E.excecoes[id] ? E.excecoes[id] === 'permitir' : base().includes(id));
    /* exceção que ficou igual ao padrão deixa de ser exceção */
    const limpar = () => { Object.keys(E.excecoes).forEach(id => { if ((E.excecoes[id] === 'permitir') === base().includes(id)) delete E.excecoes[id]; }); };

    function pintar() {
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
      const fn = FUNCOES.find(x => x[0] === E.funcao);
      q('fdesc').textContent = fn ? fn[1] + ': ' + fn[2] + '. Define o Painel e o trabalho que a pessoa pode receber.'
        : E.ehAdmin ? 'Sem função: só administra, sem Painel de produção.' : 'Escolha a função da pessoa.';
      const n = Object.keys(E.excecoes).length;
      q('restaurar').hidden = E.ehAdmin || !n;
      const nota = q('nota');
      nota.hidden = !(n && !E.ehAdmin && E.funcao !== funcaoInicial);
      nota.textContent = 'A função mudou: o padrão passa a ser o de ' + rotuloFuncao(E.funcao) + '. ' +
        (n === 1 ? 'A personalização continua' : 'As ' + n + ' personalizações continuam') + ' valendo — use "Restaurar padrão" para tirar.';
      const total = ACESSO.modulos.length, abertos = ACESSO.modulos.filter(md => efetivo(md.id)).length;
      const resumo = q('resumo');
      resumo.classList.toggle('pers', !E.ehAdmin && n > 0);
      resumo.textContent = E.ehAdmin ? 'Administrador abre todos os módulos.'
        : !E.funcao ? 'Os módulos aparecem depois de escolher a função.'
        : abertos + ' de ' + total + ' · padrão de ' + rotuloFuncao(E.funcao) +
          (n ? ' + ' + n + (n === 1 ? ' personalização' : ' personalizações') : '');
      q('mods').hidden = E.ehAdmin || !E.funcao;
      q('mods').innerHTML = ACESSO.modulos.map(md => {
        const on = efetivo(md.id), pers = !E.ehAdmin && !!E.excecoes[md.id];
        return '<label class="op-mini nu-chave-linha ac-mod' + (on ? ' on' : '') + (pers ? ' pers' : '') + '"' +
          (pers ? ' title="Diferente do padrão de ' + esc(rotuloFuncao(E.funcao)) + '"' : '') + '>' +
          '<span>' + esc(md.rotulo) + '</span>' +
          (pers ? '<em class="ac-tag">' + (on ? 'a mais' : 'tirado') + '</em>' : '') +
          '<input type="checkbox" role="switch" data-mod="' + esc(md.id) + '"' + (on ? ' checked' : '') + '></label>';
      }).join('');
      q('mods').querySelectorAll('input[data-mod]').forEach(cx => cx.addEventListener('change', () => {
        E.excecoes[cx.dataset.mod] = cx.checked ? 'permitir' : 'negar';
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
      /* devolve os campos do pedido, ou { erro } */
      ler() {
        if (E.tipo === 'cliente') return { tipo: 'cliente', papel: 'cliente' };
        if (!E.ehAdmin && !E.funcao) return { erro: 'Escolha a função principal (ou marque Administrador).' };
        limpar();
        return { tipo: 'interno', eh_admin: E.ehAdmin, funcao: E.funcao || null, modulos: E.ehAdmin ? {} : Object.assign({}, E.excecoes) };
      }
    };
  }

  /* Padrões por função: o que cada função abre por padrão. Salvar muda
     o acesso de TODOS que têm a função e não têm exceção no módulo. */
  function modalFuncoes(usuarios) {
    let atual = 'coordenador';
    const pessoas = (usuarios || []).filter(u => u.papel !== 'cliente' && u.estado === 'ativa');
    const rasc = {};
    FUNCOES.forEach(([v]) => { rasc[v] = (ACESSO.presets[v] || []).slice(); });
    const m = B7.UI.modal('<div class="ng-topo"><span class="ng-ic">' + IC_ACESSO + '</span><div><h3>Funções e acessos</h3>' +
      '<div class="sub">O que cada função abre por padrão. Quem tem a função herda — menos onde a pessoa tem um acesso personalizado.</div></div></div>' +
      '<div class="nu-papeis ac-funcoes ac-abas" id="fa-abas">' +
        FUNCOES.map(([v, r]) => '<button type="button" class="nu-papel" data-funcao="' + v + '"><i aria-hidden="true"></i><b>' + r + '</b><small id="fa-n-' + v + '"></small></button>').join('') +
      '</div>' +
      '<p class="ac-quem" id="fa-quem"></p>' +
      '<div class="ac-mods" id="fa-mods"></div>' +
      '<div id="fa-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Fechar</button>' +
      '<button class="b pri" id="fa-salvar">Salvar padrão</button></div>', { larga: true, extra: 'ng-modal nu-modal' });
    const mudou = fn => rasc[fn].slice().sort().join() !== (ACESSO.presets[fn] || []).slice().sort().join();
    function pintar() {
      m.querySelectorAll('#fa-abas [data-funcao]').forEach(b => b.classList.toggle('on', b.dataset.funcao === atual));
      FUNCOES.forEach(([v]) => { m.querySelector('#fa-n-' + v).textContent = rasc[v].length + (rasc[v].length === 1 ? ' módulo' : ' módulos') + (mudou(v) ? ' •' : ''); });
      /* quem herda este padrão: administrador abre tudo de qualquer jeito */
      const daFuncao = pessoas.filter(u => identidadeDe(u).funcao === atual && !identidadeDe(u).ehAdmin);
      const comExcecao = daFuncao.filter(u => Object.keys(ACESSO.excecoes[u.id] || {}).length).length;
      const primeiro = u => String(u.nome || '').trim().split(/\s+/)[0];
      m.querySelector('#fa-quem').innerHTML = daFuncao.length
        ? '<b>' + daFuncao.length + (daFuncao.length === 1 ? ' pessoa herda' : ' pessoas herdam') + ':</b> ' +
          esc(daFuncao.map(primeiro).join(', ')) + '.' +
          (comExcecao ? ' <span>' + comExcecao + ' com acesso personalizado.</span>' : '')
        : 'Ninguém com esta função por enquanto.';
      m.querySelector('#fa-mods').innerHTML = ACESSO.modulos.map(md => {
        const on = rasc[atual].includes(md.id);
        return '<label class="op-mini nu-chave-linha ac-mod' + (on ? ' on' : '') + '"><span>' + esc(md.rotulo) + '</span>' +
          '<input type="checkbox" role="switch" data-mod="' + esc(md.id) + '"' + (on ? ' checked' : '') + '></label>';
      }).join('');
      m.querySelectorAll('#fa-mods input').forEach(cx => cx.addEventListener('change', () => {
        rasc[atual] = cx.checked ? rasc[atual].concat(cx.dataset.mod) : rasc[atual].filter(x => x !== cx.dataset.mod);
        pintar();
      }));
      const bt = m.querySelector('#fa-salvar');
      bt.disabled = !mudou(atual); bt.textContent = 'Salvar padrão de ' + rotuloFuncao(atual);
    }
    m.querySelectorAll('#fa-abas [data-funcao]').forEach(b => b.addEventListener('click', () => { atual = b.dataset.funcao; pintar(); }));
    m.querySelector('#fa-salvar').onclick = async () => {
      const bt = m.querySelector('#fa-salvar'), erro = m.querySelector('#fa-erro');
      erro.textContent = ''; bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        await B7.DB.chamarAuth({ acao: 'salvar_preset', funcao: atual, modulos: rasc[atual] });
        ACESSO.presets[atual] = rasc[atual].slice();
        B7.UI.toast('Padrão de ' + rotuloFuncao(atual) + ' salvo. Quem tem a função já herda.');
        pintar();
        if (location.hash.indexOf('#/usuarios') === 0) abrir();
      } catch (e) { erro.textContent = e.message || 'Não foi possível salvar o padrão.'; pintar(); }
    };
    pintar();
  }

  async function abrir() {
    B7.Dashboard.marcarNav('#/config');
    B7.Rota.titulo(['Usuários e acessos']);
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 5 }) + '</div>';

    let dados, clientes;
    try {
      [dados, clientes] = await Promise.all([
        B7.DB.chamarAuth({ acao: 'listar_usuarios' }),
        B7.DB.listarClientes().catch(() => [])
      ]);
    } catch (e) {
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

    /* zzz9: tela mais calma — cabeçalho igual ao das outras telas, filtros
       numa fileira de pílulas com contagem e as pessoas numa lista
       agrupada (Equipe / Clientes), uma linha por conta. Mesmas ações e
       mesmos dados de antes. */
    const equipeN = ativos.filter(u => u.papel !== 'cliente').length;
    const clientesN = ativos.filter(u => u.papel === 'cliente').length;
    const pilula = (id, rot, n) => '<button type="button" class="lu3-pil' + (filtro.tipo === id ? ' on' : '') + '" data-lu-tipo="' + id + '">' +
      (id === 'online' ? '<i class="lu3-ponto' + (n ? ' vivo' : '') + '" aria-hidden="true"></i>' : '') +
      rot + '<b>' + n + '</b></button>';

    painel().innerHTML = '<div class="conteudo entra lu3">' +
      '<div class="trilha"><a href="#/config">Configurações</a><span>/</span>' +
      '<b>Usuários e acessos</b></div>' +
      '<div class="cab-conteudo lu3-cab"><div><h1>Usuários e acessos</h1>' +
        '<p>' + usuarios.length + ' conta' + (usuarios.length === 1 ? '' : 's') +
          (online ? ' · <span class="lu3-on">' + online + ' online agora</span>' : '') +
          ' · criadas pela Branding7, sem cadastro público.</p></div>' +
        '<button class="b contorno lu3-funcoes" id="lu-funcoes">' + IC_ACESSO + '<span>Funções e acessos</span></button>' +
        '<button class="b pri lu3-novo" id="novo-usuario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Novo usuário</span></button>' +
      '</div>' +

      (usuarios.length
        ? '<div class="lu3-barra">' +
            '<label class="lu-busca lu3-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input id="lu-busca" placeholder="Buscar por nome ou usuário…" autocomplete="off" value="' + esc(filtro.termo) + '"></label>' +
            '<div class="lu3-pils" role="group" aria-label="Filtrar contas">' +
              pilula('todos', 'Todas', usuarios.length) +
              pilula('online', 'Online', online) +
              pilula('equipe', 'Equipe', equipeN) +
              (clientesN ? pilula('clientes', 'Clientes', clientesN) : '') +
              (inativas ? pilula('inativas', 'Desativadas', inativas) : '') +
            '</div>' +
          '</div>' +
          '<div id="lu-lista"></div>'
        : '<div class="estado-b7"><b>Nenhuma conta ainda.</b>' +
          '<p>Crie a primeira conta de coordenador ou cliente.</p></div>') +
    '</div>';

    document.getElementById('novo-usuario').onclick = () => modalNovo(clientes);
    const btFuncoes = document.getElementById('lu-funcoes'); if (btFuncoes) btFuncoes.onclick = () => modalFuncoes(usuarios);

    const abrirAcao = (u, acao, estado) => {
      if (acao === 'senha') return modalSenha(u);
      if (acao === 'editar') return modalEditar(u, clientes, vinculos, funcoesExtraDe(u.id));
      if (acao === 'estado') return alterarEstado(u, estado);
      if (acao === 'foto') return modalFoto(u);
      if (acao === 'excluir') return excluirConta(u);
    };

    /* A lista é redesenhada a partir do que já veio do servidor: buscar
       e filtrar não refazem a consulta. Equipe e clientes em blocos
       separados — quem produz × quem acompanha. */
    function pintar() {
      const alvo = document.getElementById('lu-lista');
      if (!alvo) return;
      const termo = filtro.termo.trim().toLowerCase();
      const passaTipo = u => filtro.tipo === 'online' ? (u.estado === 'ativa' && presenca(u).online)
        : filtro.tipo === 'equipe' ? u.papel !== 'cliente'
        : filtro.tipo === 'clientes' ? u.papel === 'cliente'
        : filtro.tipo === 'inativas' ? u.estado !== 'ativa' : true;
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
          '<div class="lu3-lista">' +
            lista.map(u => linhaPessoa(u, empresasDe(u.id), funcoesExtraDe(u.id), presenca(u), ehCliente, n++)).join('') +
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
      alvo.querySelectorAll('.lu3-linha').forEach(el => {
        const abrirEdicao = () => abrirAcao(usuarios.find(x => x.id === el.dataset.id), 'editar');
        el.onclick = e => { if (!e.target.closest('.menu')) abrirEdicao(); };
        el.onkeydown = e => { if (e.key === 'Enter' && e.target === el) abrirEdicao(); };
      });
    }
    pintar();
    painel().querySelectorAll('[data-lu-tipo]').forEach(b => b.onclick = () => {
      const t = b.dataset.luTipo;
      filtro.tipo = filtro.tipo === t || t === 'todos' ? 'todos' : t;
      painel().querySelectorAll('[data-lu-tipo]').forEach(x => x.classList.toggle('on', x.dataset.luTipo === filtro.tipo));
      pintar();
    });
    const busca = document.getElementById('lu-busca');
    if (busca) busca.oninput = B7.UI.debounce(() => { filtro.termo = busca.value; pintar(); }, 120);
  }

  /* uma conta = uma linha: foto (com o ponto verde de online), nome,
     @usuário e papel; à direita, empresas (cliente) e o último acesso.
     A linha inteira abre "Editar acesso"; o ⋯ guarda o resto. */
  function linhaPessoa(u, empresas, funcoesExtra, pres, ehCliente, i) {
    const inativa = u.estado !== 'ativa';
    const idt = identidadeDe(u), mods = modulosEfetivosDe(u);
    /* zzz70: em vez dos três primeiros módulos, quantos a pessoa abre e
       só o que é DIFERENTE do padrão da função (+ a mais, − tirado). */
    const totalMods = ACESSO.modulos.length;
    const qtd = idt.ehAdmin || (totalMods && mods.length === totalMods) ? 'abre tudo'
      : !mods.length ? 'nenhum módulo' : mods.length + (mods.length === 1 ? ' módulo' : ' módulos');
    const basePadrao = ACESSO.presets[idt.funcao] || [], exc = idt.ehAdmin ? {} : (ACESSO.excecoes[u.id] || {});
    const dif = Object.keys(exc).filter(md => (exc[md] === 'permitir') !== basePadrao.includes(md));
    const difs = dif.slice(0, 3).map(md => exc[md] === 'permitir'
        ? '<span class="lu3-extra lu3-mais" title="A mais que o padrão de ' + esc(rotuloFuncao(idt.funcao)) + '">+ ' + esc(rotuloModulo(md)) + '</span>'
        : '<span class="lu3-extra lu3-menos" title="Tirado do padrão de ' + esc(rotuloFuncao(idt.funcao)) + '">− ' + esc(rotuloModulo(md)) + '</span>').join('') +
      (dif.length > 3 ? '<span class="lu3-extra">+' + (dif.length - 3) + '</span>' : '');
    const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    const souEu = !!(eu && eu.id === u.id);
    const quando = pres.online ? 'Online agora' : String(pres.texto || '').replace(/^Último acesso:\s*/i, '');
    const nunca = !pres.online && /^nunca/i.test(quando);
    const acesso = inativa ? '<span class="lu-estado">Desativada</span>'
      : '<span class="lu3-acesso' + (pres.online ? ' online' : nunca ? ' nunca' : '') + '">' + esc(quando) + '</span>';
    return '<div class="lu3-linha' + (inativa ? ' inativa' : '') + (pres.online && !inativa ? ' online' : '') + '" tabindex="0" data-id="' + esc(u.id) + '"' +
        ' style="--i:' + Math.min(i, 14) + '" title="Editar acesso de ' + esc(u.nome) + '">' +
      '<span class="lu3-av">' + B7.UI.avatarPessoa(u, 'lu-avatar') + '</span>' +
      '<div class="lu3-id">' +
        '<b>' + esc(u.nome) + (souEu ? '<em>você</em>' : '') + '</b>' +
        '<span class="lu3-meta">' + (ehCliente
            ? '<span class="lu3-papel lu3-p-cliente">Cliente</span>'
            : (idt.ehAdmin ? '<span class="lu3-papel lu3-p-admin">Admin</span>' : '') +
              (idt.funcao ? '<span class="lu3-papel lu3-p-' + esc(idt.funcao) + '">' + esc(rotuloFuncao(idt.funcao)) + '</span>'
                : (idt.ehAdmin ? '' : '<span class="lu3-extra">sem função</span>')) +
              '<span class="lu3-qtd" title="' + esc(mods.map(rotuloModulo).join(', ')) + '">' + qtd + '</span>' + difs) +
          (ehCliente && u.pode_aprovar ? '<span class="lu3-extra">aprova</span>' : '') +
          (!ehCliente && CONTATOS[u.id] ? '<span class="lu3-extra lu3-whats" title="Recebe avisos por WhatsApp">WhatsApp</span>' : '') +
          '<span class="lu3-user">@' + esc(u.username) + '</span></span>' +
        (ehCliente
          ? '<span class="lu3-empresas"' + (empresas.length ? ' title="' + esc(empresas.join(', ')) + '"' : '') + '>' +
              (empresas.length ? esc(empresas.slice(0, 2).join(', ')) + (empresas.length > 2 ? ' +' + (empresas.length - 2) : '')
                : '<i>sem empresa vinculada</i>') + '</span>'
          : '') +
        '<span class="lu3-acesso-cx lu3-so-estreito">' + acesso + '</span>' +
      '</div>' +
      '<span class="lu3-acesso-cx lu3-so-largo">' + acesso + '</span>' +
      '<div class="menu"><button class="ico" aria-label="Ações da conta de ' + esc(u.nome) + '">⋯</button><div class="lista">' +
        '<button data-acao-conta="editar" data-id="' + esc(u.id) + '">Editar acesso</button>' +
        '<button data-acao-conta="foto" data-id="' + esc(u.id) + '">Foto de perfil</button>' +
        '<button data-acao-conta="senha" data-id="' + esc(u.id) + '">Redefinir senha</button>' +
        '<hr>' +
        (inativa
          ? '<button data-acao-conta="estado" data-estado="ativa" data-id="' + esc(u.id) + '">Reativar conta</button>'
          : '<button data-acao-conta="estado" data-estado="desativada" data-id="' + esc(u.id) + '">Desativar conta</button>') +
        '<button class="perigo" data-acao-conta="excluir" data-id="' + esc(u.id) + '">Excluir conta</button>' +
      '</div></div>' +
    '</div>';
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
      erro.textContent = '';
      botao.disabled = true; botao.textContent = 'Criando…';
      try {
        await B7.DB.chamarAuth(corpo);
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
        '<div class="mb"><label class="rot" for="ed-nome">NOME</label>' +
          '<input class="campo" id="ed-nome" value="' + esc(u.nome) + '"></div>' +
        '<div class="mb ng-ult" id="ed-whats-cx"><label class="rot" for="ed-whats">WHATSAPP <span class="leve">— opcional</span></label>' +
          '<input class="campo" id="ed-whats" type="tel" inputmode="tel" placeholder="(77) 99999-0000" value="' + esc(mascaraWhats(CONTATOS[u.id])) + '" ' +
            'name="b7-whats-equipe" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other">' +
          '<div class="gv-ajuda">Recebe por WhatsApp os avisos importantes: trabalho atribuído, prazo, correção, decisão do cliente e gravação. Só a equipe.</div></div>' +
      '</section>' +

      acessoTipoHTML('ed', u.papel === 'cliente' ? 'cliente' : 'interno') +

      clienteHTML('ed', clientes, ligadas, !!u.pode_aprovar) +

      acessoInternoHTML('ed') +

      '<div id="ed-erro" class="ajuda erro-txt"></div>' +
      '<div class="acoes ng-acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Salvar</button></div>', { larga: true, extra: 'ng-modal nu-modal ed-modal' });

    const blocoCliente = ligarCliente(m, 'ed');
    const idt0 = identidadeDe(u);
    const acesso = ligarAcesso(m, 'ed', { tipo: idt0.tipo, ehAdmin: idt0.ehAdmin, funcao: idt0.funcao, excecoes: ACESSO.excecoes[u.id] || {} },
      tipo => { blocoCliente.style.display = tipo === 'cliente' ? '' : 'none';
                m.querySelector('#ed-whats-cx').style.display = tipo === 'cliente' ? 'none' : ''; });

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
          whatsapp: ehCli ? '' : m.querySelector('#ed-whats').value.trim(),
          empresas: ehCli ? empresas : [],
          pode_aprovar: ehCli && m.querySelector('#ed-aprovar input').checked
        }, idn));
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
        await navigator.clipboard.writeText('Usuário: ' + username + '\nSenha: ' + senha);
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
