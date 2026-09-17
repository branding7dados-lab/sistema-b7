/* =====================================================================
   CENTRAL DE CONTEÚDO B7
   Inteligência do cliente · Onboarding mensal · Linha editorial
   (estratégia, pilares e conteúdos por formato).

   Duas regras que valem para o arquivo inteiro:
   1. Nada aqui é obrigatório. Cliente só com nome funciona em todas as telas.
   2. Nada é preenchido sozinho. O sistema organiza e sugere estrutura;
      quem escreve é a equipe.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Conteudo = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const MESES = B7.UI.MESES;

  const FORMATOS = ['Reel', 'Card', 'Carrossel', 'Story'];
  const FUNIL = ['Topo', 'Meio', 'Fundo'];
  const STATUS_CONTEUDO = ['Ideia', 'Em criação', 'Em revisão', 'Aprovado', 'Programado', 'Publicado'];
  const TIPO_PILAR = ['Entretenimento', 'Educativo', 'Inspirador', 'Conversão', 'Institucional'];
  const STATUS_LINHA = ['Em criação', 'Em revisão', 'Aprovada', 'Finalizada'];

  /* ---------------------------------------------------------- helpers */
  const campo = (rot, valor, attrs, dica) =>
    '<div class="mb"><label class="rot">' + rot + '</label>' +
    '<textarea class="campo cresce" rows="2" ' + attrs + '>' + esc(valor || '') + '</textarea>' +
    (dica ? '<div class="ajuda">' + dica + '</div>' : '') + '</div>';

  const campoLinha = (rot, valor, attrs) =>
    '<div class="mb"><label class="rot">' + rot + '</label>' +
    '<input class="campo" value="' + esc(valor || '') + '" ' + attrs + '></div>';

  function secao(id, titulo, resumo, conteudo, aberta) {
    return '<section class="sanfona' + (aberta ? ' aberta' : '') + '" data-secao="' + id + '">' +
      '<button class="sanfona-topo"><div class="tx"><b>' + esc(titulo) + '</b>' +
      '<small>' + esc(resumo) + '</small></div><span class="seta">▾</span></button>' +
      '<div class="sanfona-corpo">' + conteudo + '</div></section>';
  }

  /* Liga autosave em qualquer campo com data-tab/data-id/data-campo.
     `aoMudar(tab, id, patch)` é opcional: quem renderiza a partir de um
     objeto em memória usa isso para espelhar o valor digitado nele —
     senão, a próxima renderização (troca de aba, por exemplo) volta ao
     valor antigo enquanto o banco ainda nem recebeu o novo. */
  /* Designer tem acesso de LEITURA a Linha Editorial/conteúdo/cliente
     (spec "B7 Design Final Operational Refinement" §18/§24): não é só
     esconder botão — o RLS do banco já bloqueia a escrita de verdade
     (ver migration_editorial_versao.sql, testado com tentativa de UPDATE
     direta). Aqui a UI acompanha isso: os mesmos campos viram somente
     leitura para quem é designer, num único ponto central (ligarCampos é
     o autosave usado por linha.js/conteudo.js para todas as tabelas desta
     lista — nenhuma delas é do B7 Design, que tem sua própria tela). */
  function souDesignerSomenteLeitura() {
    return !!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario() && B7.Auth.papel && B7.Auth.papel() === 'designer');
  }

  function ligarCampos(raiz, aoMudar) {
    const bloquear = souDesignerSomenteLeitura();
    raiz.querySelectorAll('[data-campo][data-tab]').forEach(el => {
      if (bloquear) {
        if ('readOnly' in el) el.readOnly = true;
        el.disabled = true;
        el.classList.add('so-leitura');
        el.title = 'Somente leitura — quem edita a Linha Editorial é a equipe.';
        return;
      }
      const gravar = () => {
        if (el.tagName === 'TEXTAREA') B7.UI.autoAltura(el);
        /* date e number vazios precisam ir como null: '' não é uma data
           nem um número para o Postgres, e o erro travaria o autosave.
           data-nulo marca outros campos (uuid em select) com a mesma regra */
        const vazio = el.value === '' &&
          (el.type === 'date' || el.type === 'number' || el.dataset.nulo !== undefined);
        /* data-vazio="0": coluna not null que não aceita null nem '' */
        const valor = vazio ? (el.dataset.vazio !== undefined ? el.dataset.vazio : null) : el.value;
        const patch = { [el.dataset.campo]: valor };
        B7.Save.campo(el.dataset.tab, el.dataset.id, patch);
        if (aoMudar) aoMudar(el.dataset.tab, el.dataset.id, patch);
      };
      if (el.tagName === 'SELECT') el.onchange = gravar; else el.oninput = gravar;
      if (el.tagName === 'TEXTAREA') B7.UI.autoAltura(el);
    });
    raiz.querySelectorAll('.sanfona-topo').forEach(b => b.onclick = () => {
      b.parentElement.classList.toggle('aberta');
    });
  }

  /* =================================================================
     INTELIGÊNCIA DO CLIENTE
     ================================================================= */
  async function abrirInteligencia(clienteId) {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('detalhe') + '</div>';
    let cliente, dados, produtos, provas;
    try {
      [cliente, dados, produtos, provas] = await Promise.all([
        B7.DB.cliente(clienteId), B7.DB.inteligencia(clienteId),
        B7.DB.listarProdutos(clienteId), B7.DB.listarProvas(clienteId)
      ]);
    } catch (e) { return B7.Dashboard.erroConteudo(e, clienteId); }

    const t = 'data-tab="cliente_inteligencia" data-id="' + esc(clienteId) + '"';
    const preenchido = campos => campos.filter(Boolean).length + ' de ' + campos.length + ' preenchidos';

    painel().innerHTML = '<div class="conteudo entra">' +
      B7.Dashboard.trilhaCliente(cliente, 'Inteligência') +
      '<div class="cab-conteudo"><div><h1>Inteligência do cliente</h1>' +
      '<p>Contexto permanente da marca. Preencha aos poucos — nada aqui é obrigatório, ' +
      'e o que estiver preenchido vira base para as linhas editoriais.</p></div>' +
      '<div class="salvamento" id="ind-inteligencia"><span class="pt"></span><span class="txt">Salvo ✓</span></div></div>' +

      secao('gerais', 'Informações gerais', preenchido([dados.nicho, dados.site, dados.instagram, dados.descricao]),
        '<div class="linha">' +
          '<div>' + campoLinha('NICHO', dados.nicho, t + ' data-campo="nicho"') + '</div>' +
          '<div>' + campoLinha('INSTAGRAM', dados.instagram, t + ' data-campo="instagram"') + '</div>' +
          '<div>' + campoLinha('SITE', dados.site, t + ' data-campo="site"') + '</div>' +
        '</div>' +
        campo('DESCRIÇÃO DO NEGÓCIO', dados.descricao, t + ' data-campo="descricao"') +
        campo('OBSERVAÇÕES', dados.observacoes, t + ' data-campo="observacoes"'), true) +

      secao('icp', 'ICP — cliente ideal',
        preenchido([dados.icp_perfil, dados.icp_segmento, dados.icp_dores, dados.icp_necessidades]),
        campo('PERFIL', dados.icp_perfil, t + ' data-campo="icp_perfil"') +
        '<div class="linha">' +
          '<div>' + campoLinha('SEGMENTO', dados.icp_segmento, t + ' data-campo="icp_segmento"') + '</div>' +
          '<div>' + campoLinha('PORTE', dados.icp_porte, t + ' data-campo="icp_porte"') + '</div>' +
          '<div>' + campoLinha('LOCALIZAÇÃO', dados.icp_localizacao, t + ' data-campo="icp_localizacao"') + '</div>' +
        '</div>' +
        '<div class="linha">' +
          '<div>' + campoLinha('FATURAMENTO', dados.icp_faturamento, t + ' data-campo="icp_faturamento"') + '</div>' +
          '<div>' + campoLinha('DECISOR', dados.icp_decisor, t + ' data-campo="icp_decisor"') + '</div>' +
        '</div>' +
        campo('NECESSIDADES', dados.icp_necessidades, t + ' data-campo="icp_necessidades"') +
        campo('DORES', dados.icp_dores, t + ' data-campo="icp_dores"') +
        campo('CARACTERÍSTICAS', dados.icp_caracteristicas, t + ' data-campo="icp_caracteristicas"')) +

      secao('publico', 'Público e persona',
        preenchido([dados.publico_principal, dados.publico_dores, dados.publico_desejos, dados.publico_objecoes]),
        campo('PÚBLICO PRINCIPAL', dados.publico_principal, t + ' data-campo="publico_principal"') +
        '<div class="linha">' +
          '<div>' + campoLinha('FAIXA ETÁRIA', dados.publico_faixa, t + ' data-campo="publico_faixa"') + '</div>' +
          '<div>' + campoLinha('REGIÃO', dados.publico_regiao, t + ' data-campo="publico_regiao"') + '</div>' +
        '</div>' +
        campo('INTERESSES', dados.publico_interesses, t + ' data-campo="publico_interesses"') +
        campo('DORES', dados.publico_dores, t + ' data-campo="publico_dores"') +
        campo('DESEJOS', dados.publico_desejos, t + ' data-campo="publico_desejos"') +
        campo('OBJEÇÕES', dados.publico_objecoes, t + ' data-campo="publico_objecoes"') +
        campo('COMPORTAMENTOS', dados.publico_comportamentos, t + ' data-campo="publico_comportamentos"')) +

      secao('voz', 'Brand voice',
        preenchido([dados.voz_tom, dados.voz_usar, dados.voz_evitar, dados.voz_cta]),
        campo('TOM DE VOZ', dados.voz_tom, t + ' data-campo="voz_tom"') +
        campo('CARACTERÍSTICAS DA COMUNICAÇÃO', dados.voz_caracteristicas, t + ' data-campo="voz_caracteristicas"') +
        campo('PALAVRAS E EXPRESSÕES A USAR', dados.voz_usar, t + ' data-campo="voz_usar"') +
        campo('O QUE EVITAR', dados.voz_evitar, t + ' data-campo="voz_evitar"') +
        campo('PALAVRAS PROIBIDAS', dados.voz_proibidas, t + ' data-campo="voz_proibidas"',
              'Ex: nomes de concorrentes, termos que o cliente não aceita.') +
        campo('ESTILO DE CTA', dados.voz_cta, t + ' data-campo="voz_cta"')) +

      secao('posicionamento', 'Posicionamento',
        preenchido([dados.posicionamento, dados.puv, dados.percepcao]),
        campo('POSICIONAMENTO', dados.posicionamento, t + ' data-campo="posicionamento"') +
        campo('PROPOSTA ÚNICA DE VALOR', dados.puv, t + ' data-campo="puv"') +
        campo('PERCEPÇÃO DESEJADA', dados.percepcao, t + ' data-campo="percepcao"',
              'Serve de base para as linhas editoriais deste cliente.')) +

      secao('produtos', 'Produtos e serviços', produtos.length + ' cadastrado' + (produtos.length === 1 ? '' : 's'),
        '<div id="lista-produtos">' + produtos.map(itemProduto).join('') + '</div>' +
        '<button class="add-largo" id="add-produto">+ ADICIONAR PRODUTO</button>') +

      secao('provas', 'Provas e cases', provas.length + ' cadastrada' + (provas.length === 1 ? '' : 's'),
        '<div id="lista-provas">' + provas.map(itemProva).join('') + '</div>' +
        '<button class="add-largo" id="add-prova">+ ADICIONAR PROVA</button>') +
    '</div>';

    ligarCampos(painel());
    ligarProdutos(clienteId);
  }

  function itemProduto(p) {
    const t = 'data-tab="produtos" data-id="' + esc(p.id) + '"';
    return '<div class="cartao-item" data-produto="' + esc(p.id) + '">' +
      '<div class="cartao-item-topo"><b>' + (p.nome ? esc(p.nome) : 'Novo produto') + '</b>' +
      '<button class="ico perigo" data-excluir-produto="' + esc(p.id) + '" title="Remover">✕</button></div>' +
      campoLinha('NOME', p.nome, t + ' data-campo="nome"') +
      campo('DESCRIÇÃO', p.descricao, t + ' data-campo="descricao"') +
      campo('BENEFÍCIOS', p.beneficios, t + ' data-campo="beneficios"') +
      campo('DIFERENCIAIS', p.diferenciais, t + ' data-campo="diferenciais"') +
      campo('OBJEÇÕES COMUNS', p.objecoes, t + ' data-campo="objecoes"') +
      '<div class="linha">' +
        '<div>' + campoLinha('PÚBLICO', p.publico, t + ' data-campo="publico"') + '</div>' +
        '<div>' + campoLinha('CTA IDEAL', p.cta, t + ' data-campo="cta"') + '</div>' +
      '</div></div>';
  }

  function itemProva(p) {
    const t = 'data-tab="provas" data-id="' + esc(p.id) + '"';
    return '<div class="cartao-item" data-prova="' + esc(p.id) + '">' +
      '<div class="cartao-item-topo"><b>' + (p.titulo ? esc(p.titulo) : 'Nova prova') + '</b>' +
      '<button class="ico perigo" data-excluir-prova="' + esc(p.id) + '" title="Remover">✕</button></div>' +
      '<div class="linha">' +
        '<div>' + campoLinha('TÍTULO', p.titulo, t + ' data-campo="titulo"') + '</div>' +
        '<div>' + campoLinha('NÚMERO / RESULTADO', p.numero, t + ' data-campo="numero"') + '</div>' +
      '</div>' +
      campo('DESCRIÇÃO', p.descricao, t + ' data-campo="descricao"') + '</div>';
  }

  function ligarProdutos(clienteId) {
    const add = document.getElementById('add-produto');
    if (add) add.onclick = async () => {
      const total = painel().querySelectorAll('[data-produto]').length;
      try {
        const novo = await B7.Save.acao(() => B7.DB.criarProduto(clienteId, total), 'Produto adicionado');
        document.getElementById('lista-produtos').insertAdjacentHTML('beforeend', itemProduto(novo));
        ligarCampos(painel()); ligarProdutos(clienteId);
      } catch (e) {}
    };
    const addP = document.getElementById('add-prova');
    if (addP) addP.onclick = async () => {
      const total = painel().querySelectorAll('[data-prova]').length;
      try {
        const nova = await B7.Save.acao(() => B7.DB.criarProva(clienteId, total), 'Prova adicionada');
        document.getElementById('lista-provas').insertAdjacentHTML('beforeend', itemProva(nova));
        ligarCampos(painel()); ligarProdutos(clienteId);
      } catch (e) {}
    };
    painel().querySelectorAll('[data-excluir-produto]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.excluirProduto(b.dataset.excluirProduto), 'Produto removido');
        b.closest('[data-produto]').remove();
      } catch (e) {}
    });
    painel().querySelectorAll('[data-excluir-prova]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.excluirProva(b.dataset.excluirProva), 'Prova removida');
        b.closest('[data-prova]').remove();
      } catch (e) {}
    });
  }

  /* =================================================================
     ONBOARDING MENSAL
     ================================================================= */
  async function abrirOnboarding(clienteId) {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';
    let cliente, lista;
    try {
      [cliente, lista] = await Promise.all([B7.DB.cliente(clienteId), B7.DB.listarOnboardings(clienteId)]);
    } catch (e) { return B7.Dashboard.erroConteudo(e, clienteId); }

    const atual = lista[0];
    painel().innerHTML = '<div class="conteudo entra">' +
      B7.Dashboard.trilhaCliente(cliente, 'Onboarding mensal') +
      '<div class="cab-conteudo"><div><h1>Onboarding mensal</h1>' +
      '<p>O que muda neste mês: campanhas, datas, produtos em foco. Separado da ' +
      'inteligência, que é o contexto permanente da marca.</p></div>' +
      '<button class="b pri" id="novo-onb">+ Novo mês</button></div>' +
      (lista.length ? lista.map((o, i) => cartaoOnboarding(o, i === 0)).join('')
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhum onboarding ainda.</b><p>Comece registrando o que muda neste mês para este cliente.</p>' +
          '<div class="acoes"><button class="b pri" id="novo-onb-vazio">+ Criar o primeiro mês</button></div></div>') +
    '</div>';

    ligarCampos(painel());
    const criar = async () => {
      const hoje = new Date();
      const dados = { client_id: clienteId, mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
      try {
        let novo;
        if (atual) {
          const m = await confirmarDuplicar(atual);
          novo = m ? await B7.Save.acao(() => B7.DB.duplicarOnboarding(atual, dados.mes, dados.ano), 'Mês criado')
                   : await B7.Save.acao(() => B7.DB.criarOnboarding(dados), 'Mês criado');
        } else {
          novo = await B7.Save.acao(() => B7.DB.criarOnboarding(dados), 'Mês criado');
        }
        B7.DB.registrar({ tipo: 'criar', entidade: 'onboarding', id: novo.id, cliente: clienteId,
          texto: 'Onboarding de ' + MESES[novo.mes - 1] + ' ' + novo.ano });
        abrirOnboarding(clienteId);
      } catch (e) {}
    };
    ['novo-onb', 'novo-onb-vazio'].forEach(id => {
      const b = document.getElementById(id); if (b) b.onclick = criar;
    });
  }

  function confirmarDuplicar(anterior) {
    return new Promise(resolve => {
      const m = B7.UI.modal('<h3>Novo mês</h3>' +
        '<div class="sub">Você já tem o onboarding de ' + MESES[anterior.mes - 1] + ' ' + anterior.ano +
        '. Quer começar do zero ou aproveitar o contexto do mês anterior?</div>' +
        '<div class="acoes"><button class="b" data-zero>Começar do zero</button>' +
        '<button class="b pri" data-dup>Duplicar mês anterior</button></div>');
      m.querySelector('[data-zero]').onclick = () => { m.fechar(); resolve(false); };
      m.querySelector('[data-dup]').onclick = () => { m.fechar(); resolve(true); };
    });
  }

  function cartaoOnboarding(o, aberto) {
    const t = 'data-tab="onboardings" data-id="' + esc(o.id) + '"';
    return secao('onb-' + o.id, MESES[o.mes - 1] + ' ' + o.ano,
      (o.objetivo ? o.objetivo.slice(0, 70) : 'sem objetivo definido'),
      campo('OBJETIVO DO MÊS', o.objetivo, t + ' data-campo="objetivo"') +
      campo('CAMPANHAS OU AÇÕES', o.campanhas, t + ' data-campo="campanhas"') +
      campo('PRODUTOS PRIORITÁRIOS', o.prioritarios, t + ' data-campo="prioritarios"') +
      campo('OFERTAS E CONDIÇÕES', o.ofertas, t + ' data-campo="ofertas"') +
      campo('DATAS IMPORTANTES', o.datas, t + ' data-campo="datas"') +
      campo('NOVIDADES', o.novidades, t + ' data-campo="novidades"') +
      campo('ASSUNTOS OBRIGATÓRIOS', o.obrigatorios, t + ' data-campo="obrigatorios"') +
      campo('O QUE EVITAR', o.evitar, t + ' data-campo="evitar"') +
      campo('PEDIDOS ESPECÍFICOS DO CLIENTE', o.pedidos, t + ' data-campo="pedidos"'), aberto);
  }

  /* =================================================================
     LINHAS EDITORIAIS
     ================================================================= */
  /* =================================================================
     LINHAS EDITORIAIS — VISÃO GLOBAL
     Entrada direta pelo menu, sem passar por cliente, gravação ou roteiro.
     Mostra os planejamentos recentes, não uma lista de todos os meses de
     todos os clientes sem contexto.
     ================================================================= */
  let filtroLinhas = '';

  async function abrirLinhasGlobais() {
    B7.Dashboard.marcarNav('#/linhas');
    B7.Rota.titulo(['Linhas editoriais']);
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('cards', { n: 6 }) + '</div>';
    let linhas, clientes;
    try {
      [linhas, clientes] = await Promise.all([
        B7.DB.listarTodasLinhas().catch(() => []),
        B7.DB.listarClientes().catch(() => [])
      ]);
    } catch (e) { return B7.Dashboard.erroConteudo(e); }

    const termo = filtroLinhas.trim().toLowerCase();
    const filtradas = termo
      ? linhas.filter(l => (
          (l.cliente_nome || '').toLowerCase().includes(termo) ||
          (l.nome || '').toLowerCase().includes(termo) ||
          (MESES[l.mes - 1] + ' ' + l.ano).toLowerCase().includes(termo)))
      : linhas;

    /* clientes sem nenhuma linha ficam à mão, para criar em um clique */
    const comLinha = new Set(linhas.map(l => l.client_id));
    const semLinha = clientes.filter(c => !comLinha.has(c.id));

    /* Design é só leitura aqui: essa tela é planejamento/estratégia de
       conteúdo (criar linha, distribuir clientes sem planejamento), não
       produção. O Designer já tem sua própria entrada operacional
       ("Design"/"Central de Design") — aqui ele só navega pra ver o
       contexto de uma linha, nunca cria uma nova. */
    const leitura = souDesignerSomenteLeitura();

    painel().innerHTML = '<div class="conteudo entra">' +
      '<div class="trilha"><a href="#/">Central B7</a><span>/</span><b>Linhas editoriais</b></div>' +
      '<div class="cab-conteudo"><div><h1>Linhas editoriais</h1>' +
      '<p>O planejamento de conteúdo de cada cliente, mês a mês.</p></div>' +
      (leitura ? '' : '<button class="b pri" id="nova-linha-global">+ Nova linha editorial</button>') + '</div>' +

      (linhas.length
        ? '<div class="busca-linhas"><input class="campo" id="busca-linha" ' +
          'placeholder="Buscar por cliente ou mês…" value="' + esc(filtroLinhas) + '"></div>' +
          (filtradas.length
            ? blocoLinhasPorMes(filtradas)
            : '<div class="estado-b7"><b>Nada encontrado para “' + esc(filtroLinhas) + '”.</b></div>')
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhuma linha editorial ainda.</b>' +
          (leitura ? '<p>Nenhum planejamento foi criado ainda.</p>'
            : '<p>Escolha um cliente e comece o planejamento do mês.</p>' +
              '<div class="acoes"><button class="b pri" id="nova-linha-vazia">+ Criar linha editorial</button></div>') + '</div>') +

      (semLinha.length && !leitura ? '<div class="secao-sem-linha">' +
        '<div class="ssl-cab"><b>Clientes sem planejamento</b>' +
        '<span>' + semLinha.length + (semLinha.length === 1 ? ' cliente' : ' clientes') +
        ' ainda sem linha editorial</span></div>' +
        '<div class="ssl-grade">' + semLinha.slice(0, 12).map(c =>
          '<button class="ssl-cliente" data-criar-para="' + esc(c.id) + '">' +
          B7.UI.avatarCliente(c.nome, c.logo_url, 'p') +
          '<span class="nm">' + esc(c.nome) + '</span>' +
          '<span class="add">+</span></button>').join('') +
        (semLinha.length > 12
          ? '<div class="ssl-mais">+' + (semLinha.length - 12) + ' outros</div>' : '') +
        '</div></div>' : '') +
    '</div>';

    painel().querySelectorAll('[data-linha]').forEach(el => el.onclick = () => {
      location.hash = '#/linha/' + el.dataset.linha;
    });
    if (!leitura) {
      ['nova-linha-global', 'nova-linha-vazia'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.onclick = () => modalNovaLinha(null, null);
      });
      painel().querySelectorAll('[data-criar-para]').forEach(b => b.onclick = async () => {
        const lista = await B7.DB.listarLinhas(b.dataset.criarPara).catch(() => []);
        modalNovaLinha(b.dataset.criarPara, lista);
      });
    }
    const busca = document.getElementById('busca-linha');
    if (busca) {
      busca.oninput = B7.UI.debounce(() => {
        filtroLinhas = busca.value;
        const pos = busca.selectionStart;
        abrirLinhasGlobais().then(() => {
          const novo = document.getElementById('busca-linha');
          if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
        });
      }, 260);
    }
  }

  /* agrupa por ano/mês, mais recente primeiro — mesmo padrão visual das
     Gravações (dashboard.js agrupa por data_gravacao). */
  function blocoLinhasPorMes(lista) {
    const grupos = new Map();
    lista.forEach(l => {
      const chave = l.ano && l.mes ? l.ano + '-' + String(l.mes).padStart(2, '0') : '';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(l);
    });
    const chaves = [...grupos.keys()].sort((a, b) => !a ? -1 : !b ? 1 : b.localeCompare(a));
    return chaves.map(chave => {
      const itens = grupos.get(chave);
      const rotulo = chave ? (MESES[+chave.slice(5, 7) - 1] + ' ' + chave.slice(0, 4)) : 'Sem mês definido';
      return '<div class="grupo-mes"><h3 class="grupo-mes-tit">' + esc(rotulo) +
        '<span class="conta-mes">' + itens.length + '</span></h3>' +
        '<div class="grade">' + itens.map(cardLinhaGlobal).join('') + '</div></div>';
    }).join('');
  }

  function cardLinhaGlobal(l) {
    const quando = l.updated_at ? B7.UI.quando(l.updated_at) : '';
    return '<div class="cartao card-linha" data-linha="' + esc(l.id) + '">' +
      '<div class="cl-topo">' +
        B7.UI.avatarCliente(l.cliente_nome || '', l.cliente_logo_url, 'p') +
        '<span class="cl-cli">' + esc(l.cliente_nome || 'Sem cliente') + '</span>' +
      '</div>' +
      '<h3>' + esc(l.nome || (MESES[l.mes - 1] + ' ' + l.ano)) + '</h3>' +
      '<div class="cl-meta">' +
        '<span>' + (l.total_conteudos || 0) + ' conteúdo' +
          ((l.total_conteudos || 0) === 1 ? '' : 's') + '</span>' +
        (quando ? '<span>· editada ' + esc(quando) + '</span>' : '') +
      '</div>' +
      '<button class="b p">Abrir</button>' +
    '</div>';
  }

  async function abrirLinhas(clienteId) {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('cards', { n: 4 }) + '</div>';
    let cliente, linhas;
    try {
      [cliente, linhas] = await Promise.all([B7.DB.cliente(clienteId), B7.DB.listarLinhas(clienteId)]);
    } catch (e) { return B7.Dashboard.erroConteudo(e, clienteId); }

    const leitura = souDesignerSomenteLeitura();

    painel().innerHTML = '<div class="conteudo entra">' +
      B7.Dashboard.trilhaCliente(cliente, 'Linhas editoriais') +
      '<div class="cab-conteudo"><div><h1>Linhas editoriais</h1>' +
      '<p>O planejamento de conteúdo de cada mês: o que será produzido, para onde vai ' +
      'e quando.</p></div>' +
      (leitura ? '' : '<button class="b pri" id="nova-linha">+ Nova linha editorial</button>') + '</div>' +
      (linhas.length ? '<div class="grade">' + linhas.map(cardLinha).join('') + '</div>'
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhuma linha editorial ainda.</b>' +
          (leitura ? '<p>Nenhuma linha editorial foi criada ainda para este cliente.</p>'
            : '<p>Crie a linha do mês para organizar os conteúdos deste cliente.</p>' +
              '<div class="acoes"><button class="b pri" id="nova-linha-vazio">+ Criar linha editorial</button></div>') + '</div>') +
    '</div>';

    painel().querySelectorAll('[data-linha]').forEach(el => el.onclick = () => {
      location.hash = '#/linha/' + el.dataset.linha;
    });
    if (!leitura) {
      ['nova-linha', 'nova-linha-vazio'].forEach(id => {
        const b = document.getElementById(id); if (b) b.onclick = () => modalNovaLinha(clienteId, linhas);
      });
    }
  }

  function cardLinha(l) {
    const progresso = l.total_conteudos
      ? Math.round((l.total_estruturados / l.total_conteudos) * 100) : 0;
    return '<div class="card-gravacao spot eleva" data-linha="' + esc(l.id) + '">' +
      '<div class="capa"><div class="malha"></div><div class="marca"></div>' +
        '<div class="selo">' + esc(String(l.mes).padStart(2, '0')) + '</div>' +
        '<div class="tit"><small>' + esc(l.cliente_nome) + '</small>' +
        '<b>' + esc(l.nome || (MESES[l.mes - 1] + ' ' + l.ano)) + '</b></div></div>' +
      '<div class="meta"><span>' + l.total_conteudos + ' conteúdo' + (l.total_conteudos === 1 ? '' : 's') + '</span>' +
        '<span class="p"></span><span>' + l.total_pilares + ' pilar' + (l.total_pilares === 1 ? '' : 'es') + '</span>' +
        '<span class="p"></span><span>editado ' + B7.UI.quando(l.updated_at) + '</span></div>' +
      '<div class="barra-progresso"><i style="width:' + progresso + '%"></i></div>' +
      '<div class="rodape"><span class="chip-revisao ' +
        (l.status === 'Aprovada' || l.status === 'Finalizada' ? 'gravado' :
         l.status === 'Em revisão' ? 'revisao' : 'criacao') + '">' + esc(l.status) + '</span>' +
      '<span class="abrir">Abrir →</span></div></div>';
  }

  /* Criar uma linha editorial é escolher cliente, mês e ano. Nada de ICP,
     onboarding, posicionamento, pilares ou meta antes de existir a linha:
     tudo isso é opcional e vem depois, se vier. */
  async function modalNovaLinha(clienteId, existentes) {
    const hoje = new Date();
    const anos = [];
    for (let a = hoje.getFullYear() - 1; a <= hoje.getFullYear() + 2; a++) anos.push(a);

    /* dentro de um cliente, ele já vem escolhido; fora, é preciso escolher */
    let clientes = [];
    if (!clienteId) {
      try { clientes = await B7.DB.listarClientes(); } catch (e) {}
      if (!clientes.length) return B7.UI.toast('Cadastre um cliente primeiro');
    }

    const m = B7.UI.modal('<h3>Nova linha editorial</h3>' +
      '<div class="sub">Escolha o mês e comece. As informações de estratégia entram depois, ' +
      'se fizerem sentido.</div>' +

      (clienteId ? '' :
        '<div class="mb"><label class="rot">CLIENTE</label>' +
        '<select class="campo" id="nl-cliente">' + clientes.map(c =>
          '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('') +
        '</select></div>') +

      '<div class="linha mb"><div><label class="rot">MÊS</label>' +
        '<select class="campo" id="nl-mes">' + MESES.map((n, i) =>
          '<option value="' + (i + 1) + '"' + (i === hoje.getMonth() ? ' selected' : '') + '>' +
          n + '</option>').join('') + '</select></div>' +
        '<div><label class="rot">ANO</label><select class="campo" id="nl-ano">' +
          anos.map(a => '<option' + (a === hoje.getFullYear() ? ' selected' : '') + '>' + a +
          '</option>').join('') + '</select></div></div>' +

      '<div class="mb"><label class="rot">NOME <span class="leve">— opcional</span></label>' +
        '<input class="campo" id="nl-nome" value="' +
        esc(MESES[hoje.getMonth()] + ' ' + hoje.getFullYear()) + '"></div>' +

      '<div id="nl-aviso"></div>' +

      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Criar linha editorial</button></div>');

    const selMes = m.querySelector('#nl-mes');
    const selAno = m.querySelector('#nl-ano');
    const campoNome = m.querySelector('#nl-nome');
    const selCli = m.querySelector('#nl-cliente');
    let nomeTocado = false;
    campoNome.addEventListener('input', () => { nomeTocado = true; });

    /* o nome acompanha mês e ano até a pessoa escrever o dela */
    const sincronizar = async () => {
      if (!nomeTocado) campoNome.value = MESES[+selMes.value - 1] + ' ' + selAno.value;
      await avisarExistente();
    };
    selMes.onchange = sincronizar;
    selAno.onchange = sincronizar;
    if (selCli) selCli.onchange = sincronizar;

    /* Já existe uma linha para esse cliente e mês? Avisamos e oferecemos
       abrir — sem impedir de criar outra, porque às vezes faz sentido. */
    async function avisarExistente() {
      const alvo = m.querySelector('#nl-aviso');
      const cli = clienteId || (selCli && selCli.value);
      if (!cli) return alvo.innerHTML = '';
      const lista = cli === clienteId && existentes
        ? existentes : await B7.DB.listarLinhas(cli).catch(() => []);
      const igual = lista.find(l => l.mes === +selMes.value && l.ano === +selAno.value);
      alvo.innerHTML = igual
        ? '<div class="aviso-suave" style="display:flex;align-items:center;gap:10px">' +
          '<span>Já existe uma linha editorial para este mês.</span>' +
          '<button class="b p" data-abrir-existente="' + esc(igual.id) + '">Abrir a existente</button>' +
          '</div>'
        : '';
      const b = alvo.querySelector('[data-abrir-existente]');
      if (b) b.onclick = () => { m.fechar(); location.hash = '#/linha/' + b.dataset.abrirExistente; };
    }
    avisarExistente();

    m.querySelector('[data-ok]').onclick = async () => {
      const cli = clienteId || (selCli && selCli.value);
      if (!cli) return B7.UI.toast('Escolha um cliente', { tipo: 'erro' });
      const mes = +selMes.value;
      const ano = +selAno.value;
      const botao = m.querySelector('[data-ok]');
      botao.disabled = true;
      botao.textContent = 'Criando…';
      try {
        const nova = await B7.Save.acao(() => B7.DB.criarLinha({
          client_id: cli, mes: mes, ano: ano,
          nome: campoNome.value.trim() || (MESES[mes - 1] + ' ' + ano)
        }), 'Linha editorial criada');
        B7.DB.registrar({ tipo: 'criar', entidade: 'linha', id: nova.id, cliente: cli,
          texto: 'Linha editorial: ' + nova.nome });
        m.fechar();
        /* abre direto no que acabou de ser criado */
        location.hash = '#/linha/' + nova.id;
      } catch (e) {
        botao.disabled = false;
        botao.textContent = 'Criar linha editorial';
      }
    };
  }



  /* =================================================================
     BANCO DE IDEIAS
     Fica no cliente, não na linha. Uma ideia vira conteúdo quando
     entra numa linha editorial — e aí ela some da fila de pendentes.
     ================================================================= */
  const STATUS_IDEIA = ['Ideia', 'Selecionada', 'Virou conteúdo', 'Arquivada'];

  async function abrirIdeias(clienteId) {
    painel().innerHTML = '<div class="conteudo">' + B7.UI.skeleton('lista', { n: 6 }) + '</div>';
    let cliente, ideias, linhas;
    try {
      [cliente, ideias, linhas] = await Promise.all([
        B7.DB.cliente(clienteId), B7.DB.listarIdeias(clienteId),
        B7.DB.listarLinhas(clienteId).catch(() => [])
      ]);
    } catch (e) { return B7.Dashboard.erroConteudo(e, clienteId); }

    const ativas = ideias.filter(i => i.status !== 'Arquivada');
    const arquivadas = ideias.filter(i => i.status === 'Arquivada');

    painel().innerHTML = '<div class="conteudo entra">' +
      B7.Dashboard.trilhaCliente(cliente, 'Banco de ideias') +
      '<div class="cab-conteudo"><div><h1>Banco de ideias</h1>' +
      '<p>Onde as ideias esperam a vez. Quando uma entra no planejamento, ' +
      'ela vira conteúdo dentro de uma linha editorial.</p></div>' +
      '<button class="b pri" id="nova-ideia">+ Nova ideia</button></div>' +

      (ativas.length ? '<div class="grade-ideias" id="lista-ideias">' +
        ativas.map(i => cardIdeia(i, linhas)).join('') + '</div>'
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhuma ideia guardada.</b>' +
          '<p>Anote agora o que surgir na reunião; depois vira conteúdo de um mês.</p>' +
          '<div class="acoes"><button class="b pri" id="nova-ideia-vazio">+ Anotar primeira ideia</button></div></div>') +

      (arquivadas.length ? '<div class="secao" style="margin-top:22px">' +
        '<div class="secao-topo"><h2>Arquivadas</h2>' +
        '<span class="cont">' + arquivadas.length + '</span></div>' +
        '<div class="grade-ideias">' + arquivadas.map(i => cardIdeia(i, linhas)).join('') + '</div></div>' : '') +
    '</div>';

    ligarIdeias(clienteId, linhas);
  }

  function cardIdeia(i, linhas) {
    const classe = { 'Ideia': 'criacao', 'Selecionada': 'revisao',
                     'Virou conteúdo': 'gravado', 'Arquivada': 'criacao' }[i.status] || 'criacao';
    return '<div class="card-ideia' + (i.status === 'Arquivada' ? ' apagada' : '') +
      '" data-ideia="' + esc(i.id) + '">' +
      '<div class="ci-topo"><span class="chip-revisao ' + classe + '">' + esc(i.status) + '</span>' +
        '<div class="menu"><button class="ico">⋯</button><div class="lista">' +
          '<div class="rot">STATUS</div>' +
          STATUS_IDEIA.filter(s => s !== 'Virou conteúdo').map(s =>
            '<button data-st-ideia="' + esc(s) + '" data-id="' + esc(i.id) + '">' +
            (i.status === s ? '● ' : '') + esc(s) + '</button>').join('') +
          '<hr><button class="perigo" data-excluir-ideia="' + esc(i.id) + '">Excluir</button>' +
        '</div></div></div>' +
      '<h3>' + esc(i.titulo || 'Sem título') + '</h3>' +
      (i.objetivo ? '<p>' + esc(i.objetivo) + '</p>' : '') +
      '<div class="ci-meta">' +
        (i.pilar ? '<span>' + esc(i.pilar) + '</span>' : '') +
        (i.formato ? '<span>' + esc(i.formato) + '</span>' : '') +
      '</div>' +
      (i.status === 'Virou conteúdo'
        ? '<div class="ci-virou">Já virou conteúdo</div>'
        : (linhas.length
          ? '<button class="b fina contorno" data-virar="' + esc(i.id) + '">Transformar em conteúdo</button>'
          : '<div class="ci-nota">Crie uma linha editorial para transformar em conteúdo.</div>')) +
    '</div>';
  }

  function ligarIdeias(clienteId, linhas) {
    B7.UI.ligarMenus(painel());
    const criar = () => {
      const m = B7.UI.modal('<h3>Nova ideia</h3>' +
        '<div class="sub">Só o título já basta. O resto dá para completar depois.</div>' +
        '<div class="mb"><label class="rot">TÍTULO</label>' +
          '<input class="campo" id="ni-titulo" data-foco placeholder="Ex: Mitos sobre implante"></div>' +
        '<div class="linha mb">' +
          '<div><label class="rot">PILAR <span class="leve">— opcional</span></label>' +
            '<input class="campo" id="ni-pilar"></div>' +
          '<div><label class="rot">FORMATO <span class="leve">— opcional</span></label>' +
            '<select class="campo" id="ni-formato"><option value="">—</option>' +
            FORMATOS.map(f => '<option>' + f + '</option>').join('') + '</select></div>' +
        '</div>' +
        '<div class="mb"><label class="rot">OBJETIVO <span class="leve">— opcional</span></label>' +
          '<textarea class="campo cresce" rows="2" id="ni-objetivo"></textarea></div>' +
        '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
        '<button class="b pri" data-ok>Guardar ideia</button></div>');
      m.querySelector('[data-ok]').onclick = async () => {
        const titulo = m.querySelector('#ni-titulo').value.trim();
        if (!titulo) return m.querySelector('#ni-titulo').focus();
        try {
          await B7.Save.acao(() => B7.DB.criarIdeia({
            client_id: clienteId, titulo: titulo,
            pilar: m.querySelector('#ni-pilar').value.trim(),
            formato: m.querySelector('#ni-formato').value,
            objetivo: m.querySelector('#ni-objetivo').value.trim()
          }), 'Ideia guardada');
          m.fechar();
          abrirIdeias(clienteId);
        } catch (e) {}
      };
    };
    ['nova-ideia', 'nova-ideia-vazio'].forEach(id => {
      const b = document.getElementById(id); if (b) b.onclick = criar;
    });

    painel().querySelectorAll('[data-st-ideia]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.atualizarIdeia(b.dataset.id, { status: b.dataset.stIdeia }),
          'Status: ' + b.dataset.stIdeia);
        abrirIdeias(clienteId);
      } catch (e) {}
    });
    painel().querySelectorAll('[data-excluir-ideia]').forEach(b => b.onclick = () =>
      B7.UI.confirmar({
        titulo: 'Excluir esta ideia?', texto: 'Ela vai para a lixeira.',
        rotulo: 'Excluir', perigo: true,
        aoConfirmar: async () => {
          await B7.Save.acao(() => B7.DB.excluirIdeia(b.dataset.excluirIdeia), 'Ideia excluída');
          abrirIdeias(clienteId);
        }
      }));

    painel().querySelectorAll('[data-virar]').forEach(b => b.onclick = async () => {
      const ideia = (await B7.DB.listarIdeias(clienteId)).find(x => x.id === b.dataset.virar);
      if (!ideia) return;
      virarConteudo(ideia, linhas, clienteId);
    });
  }

  /* Transformar em conteúdo: escolhe a linha e o formato, cria o conteúdo
     já com o que a ideia tinha e marca a ideia como aproveitada. */
  function virarConteudo(ideia, linhas, clienteId) {
    const m = B7.UI.modal('<h3>Transformar em conteúdo</h3>' +
      '<div class="sub">' + esc(ideia.titulo || 'Sem título') + '</div>' +
      '<div class="mb"><label class="rot">LINHA EDITORIAL</label>' +
        '<select class="campo" id="vc-linha">' + linhas.map(l =>
          '<option value="' + esc(l.id) + '">' +
          esc(l.nome || (MESES[l.mes - 1] + ' ' + l.ano)) + '</option>').join('') + '</select></div>' +
      '<label class="rot">FORMATO</label>' +
      '<div class="grade-formatos">' + FORMATOS.map(f =>
        '<button class="opcao-formato' + (ideia.formato === f ? ' on' : '') +
        '" data-formato="' + f + '"><b>' + f + '</b><small>' +
        (f === 'Reel' ? 'vídeo com roteiro' : f === 'Card' ? 'peça única' :
         f === 'Carrossel' ? 'sequência de slides' : 'sequência de stories') +
        '</small></button>').join('') + '</div>');

    m.querySelectorAll('[data-formato]').forEach(b => b.onclick = async () => {
      const linhaId = m.querySelector('#vc-linha').value;
      try {
        const existentes = await B7.DB.listarConteudos(linhaId);
        const novo = await B7.Save.acao(() => B7.DB.criarConteudo({
          client_id: clienteId, linha_id: linhaId, tipo: b.dataset.formato,
          position: existentes.length, status: 'Ideia',
          titulo: ideia.titulo, objetivo: ideia.objetivo, ideia_geral: ideia.observacoes
        }), 'Conteúdo criado a partir da ideia');
        await B7.DB.atualizarIdeia(ideia.id, { status: 'Virou conteúdo', content_id: novo.id });
        m.fechar();
        location.hash = '#/linha/' + linhaId + '/criativos';
      } catch (e) {}
    });
  }

  return { abrirInteligencia, abrirOnboarding, abrirLinhas, abrirLinhasGlobais, abrirIdeias, ligarCampos, campo, campoLinha,
           secao, FORMATOS, FUNIL, STATUS_CONTEUDO, STATUS_LINHA, TIPO_PILAR, souDesignerSomenteLeitura };
})();
