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
  /* Tipos de pilar oferecidos no select. A coluna `pilares.nome` é texto
     livre: pilar antigo com nome fora desta lista continua valendo e
     aparece como "(personalizado)" — por isso acrescentar um tipo aqui
     nunca invalida o que já está cadastrado. A ordem é a de leitura da
     estratégia, do conteúdo que atrai ao conteúdo que converte. */
  const TIPO_PILAR = ['Entretenimento', 'Educativo', 'Informativo', 'Inspirador', 'Conversão', 'Institucional'];
  const STATUS_LINHA = ['Em criação', 'Em revisão', 'Aprovada', 'Finalizada'];

  /* ------------------------------------------ regras canônicas da Linha
     Um lugar só: a lista de Linhas (filtro por endereço) e o Painel do
     Coordenador usam ESTAS funções, então o número do Painel e a lista
     que ele abre nunca divergem.
     • em andamento = tudo que ainda não é "Finalizada" (mesma regra da
       Central: "em elaboração");
     • planejamento atrasado = ainda "Em criação" com o período já
       começado ou começando em até 7 dias (e não encerrado). */
  const pad2 = n => String(n).padStart(2, '0');
  const inicioLinha = l => l.periodo_inicio || (l.ano && l.mes ? l.ano + '-' + pad2(l.mes) + '-01' : null);
  function fimLinha(l) {
    if (l.periodo_fim) return l.periodo_fim;
    if (!l.ano || !l.mes) return null;
    return l.ano + '-' + pad2(l.mes) + '-' + pad2(new Date(l.ano, l.mes, 0).getDate());
  }
  function somarDiasISO(s, n) {
    const [a, m, d] = s.split('-').map(Number); const dt = new Date(a, m - 1, d + n);
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }
  const REGRAS_LINHA = {
    andamento: { rotulo: 'Em andamento', teste: l => l.status !== 'Finalizada' },
    planejamento: { rotulo: 'Ainda em criação perto do início', teste: l => {
      if (l.status !== 'Em criação') return false;
      const hoje = B7.UI.hojeISO(), ini = inicioLinha(l), fim = fimLinha(l);
      return !!ini && ini <= somarDiasISO(hoje, 7) && (!fim || fim >= hoje);
    } },
    revisao: { rotulo: 'Em revisão', teste: l => l.status === 'Em revisão' }
  };

  /* ---------------------------------------------------------- helpers */
  const campo = (rot, valor, attrs, dica) =>
    '<div class="mb"><label class="rot">' + rot + '</label>' +
    '<textarea class="campo cresce" rows="2" ' + attrs + '>' + esc(valor || '') + '</textarea>' +
    (dica ? '<div class="ajuda">' + dica + '</div>' : '') + '</div>';

  const campoLinha = (rot, valor, attrs) =>
    '<div class="mb"><label class="rot">' + rot + '</label>' +
    '<input class="campo" value="' + esc(valor || '') + '" ' + attrs + '></div>';

  /* `extra` é opcional: { icone } põe um ícone à esquerda do título e
     { conta: true } reserva o selo de contagem à direita (quem preenche
     o selo é a tela — ver resumoInteligencia). */
  const SETA = '<svg class="seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function secao(id, titulo, resumo, conteudo, aberta, extra) {
    extra = extra || {};
    return '<section class="sanfona' + (aberta ? ' aberta' : '') + '" data-secao="' + id + '">' +
      '<button class="sanfona-topo" type="button" aria-expanded="' + (aberta ? 'true' : 'false') + '">' +
      (extra.icone ? '<span class="sf-ic" aria-hidden="true">' + extra.icone + '</span>' : '') +
      '<div class="tx"><b>' + esc(titulo) + '</b>' +
      '<small>' + esc(resumo) + '</small></div>' +
      (extra.conta ? '<span class="sf-conta"></span>' : '') + SETA + '</button>' +
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
      const aberta = b.parentElement.classList.toggle('aberta');
      b.setAttribute('aria-expanded', aberta ? 'true' : 'false');
      /* os campos nascem escondidos: a altura só pode ser medida agora */
      if (aberta) b.parentElement.querySelectorAll('textarea.cresce').forEach(B7.UI.autoAltura);
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
    /* O subtítulo de cada seção nasce com a descrição do que vai ali;
       resumoInteligencia troca pela prévia do que já está escrito. */
    const sec = (id, titulo, conteudo, aberta) =>
      secao(id, titulo, DICA_INTEL[id], conteudo, aberta, { icone: IC_INTEL[id], conta: true });
    const ex = texto => ' placeholder="' + esc(texto) + '"';
    /* Instagram e Site ganham um atalho "Abrir" ao lado do rótulo */
    const campoLink = (rot, valor, attrs) =>
      '<div class="mb"><label class="rot rot-link"><span>' + rot + '</span>' +
      '<a class="int-abrir" target="_blank" rel="noopener noreferrer" hidden>Abrir ↗</a></label>' +
      '<input class="campo" value="' + esc(valor || '') + '" ' + attrs + ' inputmode="url" autocapitalize="none" spellcheck="false"></div>';

    painel().innerHTML = '<div class="conteudo entra int-tela">' +
      B7.Dashboard.trilhaCliente(cliente, 'Inteligência') +
      '<div class="cab-conteudo"><div><h1>Inteligência do cliente</h1>' +
      '<p>Contexto permanente da marca. Preencha aos poucos — nada aqui é obrigatório, ' +
      'e o que estiver preenchido vira base para as linhas editoriais.</p></div></div>' +

      /* o estado do salvamento aparece no topo global: um selo aqui ficava
         parado em "Salvo ✓" e empurrava a tela ao aparecer e sumir */
      '<div class="int-resumo">' + B7.UI.avatarCliente(cliente.nome, cliente.logo_url) +
        '<div class="int-res-tx"><b>' + esc(cliente.nome) + '</b><small id="int-res-txt"></small>' +
        '<div class="barra-progresso"><i id="int-res-barra" style="width:0"></i></div></div>' +
        '<span class="int-res-pct" id="int-res-pct"></span></div>' +

      sec('gerais', 'Informações gerais',
        '<div class="linha">' +
          '<div>' + campoLinha('NICHO', dados.nicho, t + ' data-campo="nicho"' + ex('Ex.: Odontologia')) + '</div>' +
          '<div>' + campoLink('INSTAGRAM', dados.instagram, t + ' data-campo="instagram"' + ex('@perfil')) + '</div>' +
          '<div>' + campoLink('SITE', dados.site, t + ' data-campo="site"' + ex('https://')) + '</div>' +
        '</div>' +
        campo('DESCRIÇÃO DO NEGÓCIO', dados.descricao, t + ' data-campo="descricao"' +
          ex('O que a empresa faz, onde atua e para quem.')) +
        campo('OBSERVAÇÕES', dados.observacoes, t + ' data-campo="observacoes"' +
          ex('Regras da conta: hashtags, o que evitar, combinados com o cliente.')), true) +

      sec('icp', 'ICP — cliente ideal',
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

      sec('publico', 'Público e persona',
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

      sec('voz', 'Brand voice',
        campo('TOM DE VOZ', dados.voz_tom, t + ' data-campo="voz_tom"') +
        campo('CARACTERÍSTICAS DA COMUNICAÇÃO', dados.voz_caracteristicas, t + ' data-campo="voz_caracteristicas"') +
        campo('PALAVRAS E EXPRESSÕES A USAR', dados.voz_usar, t + ' data-campo="voz_usar"') +
        campo('O QUE EVITAR', dados.voz_evitar, t + ' data-campo="voz_evitar"') +
        campo('PALAVRAS PROIBIDAS', dados.voz_proibidas, t + ' data-campo="voz_proibidas"',
              'Ex: nomes de concorrentes, termos que o cliente não aceita.') +
        campo('ESTILO DE CTA', dados.voz_cta, t + ' data-campo="voz_cta"')) +

      sec('posicionamento', 'Posicionamento',
        campo('POSICIONAMENTO', dados.posicionamento, t + ' data-campo="posicionamento"') +
        campo('PROPOSTA ÚNICA DE VALOR', dados.puv, t + ' data-campo="puv"') +
        campo('PERCEPÇÃO DESEJADA', dados.percepcao, t + ' data-campo="percepcao"',
              'Serve de base para as linhas editoriais deste cliente.')) +

      sec('produtos', 'Produtos e serviços',
        '<div id="lista-produtos">' + produtos.map(itemProduto).join('') + '</div>' +
        '<button class="add-largo" id="add-produto">+ ADICIONAR PRODUTO</button>') +

      sec('provas', 'Provas e cases',
        '<div id="lista-provas">' + provas.map(itemProva).join('') + '</div>' +
        '<button class="add-largo" id="add-prova">+ ADICIONAR PROVA</button>') +
    '</div>';

    ligarCampos(painel());
    ligarProdutos(clienteId);
    resumoInteligencia(painel().querySelector('.int-tela'));
  }

  /* O que vai em cada seção — aparece enquanto ela está vazia. */
  const DICA_INTEL = {
    gerais: 'Nicho, redes e descrição do negócio',
    icp: 'Perfil, porte e dores do cliente ideal',
    publico: 'Quem a marca quer alcançar nas redes',
    voz: 'Como a marca fala e o que evita',
    posicionamento: 'Como a marca quer ser percebida',
    produtos: 'O que a marca vende',
    provas: 'Resultados, números e depoimentos'
  };
  const svgI = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const IC_INTEL = {
    gerais: svgI('<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'),
    icp: svgI('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>'),
    publico: svgI('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M15.5 6.2a3 3 0 010 5.6M17.5 14.8c1.7.6 2.7 2 3 4.2"/>'),
    voz: svgI('<path d="M5 5h14v10H10l-5 4z"/>'),
    posicionamento: svgI('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
    produtos: svgI('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),
    provas: svgI('<circle cx="12" cy="9.5" r="5.5"/><path d="M8.5 14L7 20l5-2.5 5 2.5-1.5-6"/>')
  };

  /* Contagem, prévia e progresso da Inteligência, sempre lidos dos
     próprios campos da tela: o que a pessoa digita já conta, sem esperar
     o autosave nem recarregar. Produtos e provas contam por item. */
  let atualizaIntel = null;
  function resumoInteligencia(raiz) {
    if (!raiz) return;
    const CAMPOS = '.sanfona-corpo [data-tab="cliente_inteligencia"][data-campo]';
    const cheio = el => el.value.trim() !== '';
    const corta = s => { s = s.trim().replace(/\s+/g, ' '); return s.length > 70 ? s.slice(0, 69).trimEnd() + '…' : s; };
    const LISTAS = { produtos: ['[data-produto]', 'produto', 'produtos'], provas: ['[data-prova]', 'prova', 'provas'] };

    function linkDe(campo, valor) {
      const v = valor.trim();
      if (!v) return '';
      if (/^https?:\/\/\S+$/i.test(v)) return v;
      if (campo === 'instagram') {
        const m = v.match(/^@?([A-Za-z0-9._]{2,30})$/);
        return m ? 'https://www.instagram.com/' + m[1] + '/' : '';
      }
      return /^[^\s@]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? 'https://' + v : '';
    }

    function atualizar() {
      let feitosTotal = 0, total = 0;
      raiz.querySelectorAll('.sanfona').forEach(s => {
        const selo = s.querySelector('.sf-conta'), sub = s.querySelector('.sanfona-topo small');
        const id = s.dataset.secao, lista = LISTAS[id];
        let estado = '';
        if (lista) {
          const n = s.querySelectorAll(lista[0]).length;
          selo.textContent = String(n);
          sub.textContent = n ? n + ' ' + lista[n === 1 ? 1 : 2] + ' no cadastro' : DICA_INTEL[id];
          estado = n ? 'cheia' : '';
        } else {
          const cs = [...s.querySelectorAll(CAMPOS)], feitos = cs.filter(cheio);
          total += cs.length; feitosTotal += feitos.length;
          selo.textContent = feitos.length + '/' + cs.length;
          /* aberta, os campos já estão à vista: a prévia só serve fechada */
          sub.textContent = feitos.length && !s.classList.contains('aberta')
            ? feitos.slice(0, 3).map(el => corta(el.value)).join(' · ') : DICA_INTEL[id];
          estado = !feitos.length ? '' : feitos.length === cs.length ? 'cheia' : 'parcial';
        }
        s.classList.toggle('cheia', estado === 'cheia');
        s.classList.toggle('parcial', estado === 'parcial');
      });
      const pct = total ? Math.round(feitosTotal / total * 100) : 0;
      raiz.querySelector('#int-res-txt').textContent = feitosTotal
        ? feitosTotal + ' de ' + total + ' campos preenchidos'
        : 'Cadastro em branco — comece pelas informações gerais';
      raiz.querySelector('#int-res-pct').textContent = pct + '%';
      raiz.querySelector('#int-res-barra').style.width = pct + '%';

      raiz.querySelectorAll('.int-abrir').forEach(a => {
        const el = a.closest('.mb').querySelector('[data-campo]');
        const url = linkDe(el.dataset.campo, el.value);
        a.hidden = !url;
        if (url) a.href = url; else a.removeAttribute('href');
      });
    }

    /* o título do cartão acompanha o nome digitado */
    raiz.addEventListener('input', e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.campo) return;
      const item = el.closest('.cartao-item');
      if (item && (el.dataset.campo === 'nome' || el.dataset.campo === 'titulo')) {
        const b = item.querySelector('.cartao-item-topo b');
        if (b) b.textContent = el.value.trim() || (item.dataset.produto ? 'Novo produto' : 'Nova prova');
      }
      atualizar();
    });
    raiz.addEventListener('click', e => { if (e.target.closest('.sanfona-topo')) atualizar(); });
    atualizaIntel = atualizar;
    atualizar();
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
        ligarCampos(painel()); ligarProdutos(clienteId); if (atualizaIntel) atualizaIntel();
      } catch (e) {}
    };
    const addP = document.getElementById('add-prova');
    if (addP) addP.onclick = async () => {
      const total = painel().querySelectorAll('[data-prova]').length;
      try {
        const nova = await B7.Save.acao(() => B7.DB.criarProva(clienteId, total), 'Prova adicionada');
        document.getElementById('lista-provas').insertAdjacentHTML('beforeend', itemProva(nova));
        ligarCampos(painel()); ligarProdutos(clienteId); if (atualizaIntel) atualizaIntel();
      } catch (e) {}
    };
    painel().querySelectorAll('[data-excluir-produto]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.excluirProduto(b.dataset.excluirProduto), 'Produto removido');
        b.closest('[data-produto]').remove(); if (atualizaIntel) atualizaIntel();
      } catch (e) {}
    });
    painel().querySelectorAll('[data-excluir-prova]').forEach(b => b.onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.excluirProva(b.dataset.excluirProva), 'Prova removida');
        b.closest('[data-prova]').remove(); if (atualizaIntel) atualizaIntel();
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
  let filtroRegra = '';   /* chave de REGRAS_LINHA vinda do endereço (?status=) */
  let filtroStatus = '';  /* um dos STATUS_LINHA, escolhido nos chips da tela */
  let dadosLinhas = null; /* { linhas, clientes } da última leitura: buscar e filtrar não releem o banco */

  /* params (URLSearchParams) só vem da rota: é ela que define o filtro
     por regra. Busca e chips de situação só redesenham a lista. */
  async function abrirLinhasGlobais(params) {
    if (params && typeof params.get === 'function') {
      const s = params.get('status') || '';
      filtroRegra = REGRAS_LINHA[s] ? s : '';
    }
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
    dadosLinhas = { linhas, clientes };
    if (filtroStatus && !linhas.some(l => l.status === filtroStatus)) filtroStatus = '';

    /* clientes sem nenhuma linha ficam à mão, para criar em um clique */
    const comLinha = new Set(linhas.map(l => l.client_id));
    const semLinha = clientes.filter(c => !comLinha.has(c.id));

    /* Design é só leitura aqui: essa tela é planejamento/estratégia de
       conteúdo (criar linha, distribuir clientes sem planejamento), não
       produção. O Designer já tem sua própria entrada operacional
       ("Design"/"Central de Design") — aqui ele só navega pra ver o
       contexto de uma linha, nunca cria uma nova. */
    const leitura = souDesignerSomenteLeitura();

    painel().innerHTML = '<div class="conteudo entra lg-tela">' +
      '<div class="trilha"><a href="#/">Central B7</a><span>/</span><b>Linhas editoriais</b></div>' +
      '<div class="cab-conteudo"><div><h1>Linhas editoriais</h1>' +
      '<p>O planejamento de conteúdo de cada cliente, mês a mês.</p></div>' +
      (leitura ? '' : '<button class="b pri" id="nova-linha-global">+ Nova linha editorial</button>') + '</div>' +

      (linhas.length
        ? '<div class="lg-barra">' +
            '<label class="lg-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input id="busca-linha" placeholder="Buscar por cliente ou mês…" value="' + esc(filtroLinhas) + '" autocomplete="off"></label>' +
            '<div class="lg-chips" id="lg-chips" role="group" aria-label="Filtrar por situação"></div>' +
          '</div>' +
          '<div id="lg-lista"></div>'
        : '<div class="estado-b7"><div class="b7-marca fraca"></div>' +
          '<b>Nenhuma linha editorial ainda.</b>' +
          (leitura ? '<p>Nenhum planejamento foi criado ainda.</p>'
            : '<p>Escolha um cliente e comece o planejamento do mês.</p>' +
              '<div class="acoes"><button class="b pri" id="nova-linha-vazia">+ Criar linha editorial</button></div>') + '</div>') +

      (semLinha.length && !leitura ? '<div class="secao-sem-linha">' +
        '<div class="ssl-cab"><b>Clientes sem planejamento</b>' +
        '<span>' + semLinha.length + (semLinha.length === 1 ? ' cliente' : ' clientes') +
        ' ainda sem linha editorial. Clique para criar a primeira.</span></div>' +
        '<div class="ssl-grade">' + semLinha.slice(0, 12).map(c =>
          '<button class="ssl-cliente" data-criar-para="' + esc(c.id) + '" title="Criar linha editorial para ' + esc(c.nome) + '">' +
          B7.UI.avatarCliente(c.nome, c.logo_url, 'p') +
          '<span class="nm">' + esc(c.nome) + '</span>' +
          '<span class="add">+</span></button>').join('') +
        (semLinha.length > 12
          ? '<div class="ssl-mais">+' + (semLinha.length - 12) + ' outros</div>' : '') +
        '</div></div>' : '') +
    '</div>';

    pintarListaLinhas();

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
      busca.oninput = B7.UI.debounce(() => { filtroLinhas = busca.value; pintarListaLinhas(); }, 140);
    }
  }

  /* Desenha os chips de situação e a lista, a partir do que já está em
     memória. Digitar na busca ou trocar de chip não vai ao banco e não
     pisca a tela inteira: só esta parte muda. */
  function pintarListaLinhas() {
    const alvo = document.getElementById('lg-lista');
    const chips = document.getElementById('lg-chips');
    if (!alvo || !dadosLinhas) return;
    const linhas = dadosLinhas.linhas;
    const termo = filtroLinhas.trim().toLowerCase();
    const regra = filtroRegra && REGRAS_LINHA[filtroRegra];

    /* a busca e o filtro do endereço valem para as contagens dos chips;
       o chip escolhido só filtra a lista */
    const base = linhas.filter(l => (!regra || regra.teste(l)) && (!termo || (
      (l.cliente_nome || '').toLowerCase().includes(termo) ||
      (l.nome || '').toLowerCase().includes(termo) ||
      (MESES[l.mes - 1] + ' ' + l.ano).toLowerCase().includes(termo))));
    const filtradas = filtroStatus ? base.filter(l => l.status === filtroStatus) : base;

    if (chips) {
      const conta = s => base.filter(l => l.status === s).length;
      chips.innerHTML =
        '<button class="lg-chip' + (filtroStatus ? '' : ' on') + '" data-st="">Todas<b>' + base.length + '</b></button>' +
        STATUS_LINHA.filter(s => conta(s) || s === filtroStatus).map(s =>
          '<button class="lg-chip' + (filtroStatus === s ? ' on' : '') + '" data-st="' + esc(s) + '">' +
          '<i class="' + classeSituacaoLinha(s) + '"></i>' + esc(s) + '<b>' + conta(s) + '</b></button>').join('');
      chips.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
        filtroStatus = b.dataset.st; pintarListaLinhas();
      });
    }

    const chipRegra = regra
      ? '<div class="filtro-ativo-linhas"><span>Mostrando: <b>' + esc(regra.rotulo) + '</b> · ' +
        filtradas.length + (filtradas.length === 1 ? ' linha' : ' linhas') + '</span>' +
        '<a class="b fina contorno" href="#/linhas">Ver todas</a></div>'
      : '';

    alvo.innerHTML = chipRegra + (filtradas.length
      ? blocoLinhasPorMes(filtradas, !!(termo || filtroStatus || regra))
      : '<div class="estado-b7"><b>' + (termo ? 'Nada encontrado para “' + esc(filtroLinhas) + '”.'
          : 'Nenhuma linha editorial neste filtro.') + '</b>' +
        (termo || filtroStatus ? '<div class="acoes"><button class="b" id="lg-limpar">Limpar filtros</button></div>' : '') +
        '</div>');

    const limpar = document.getElementById('lg-limpar');
    if (limpar) limpar.onclick = () => {
      filtroLinhas = ''; filtroStatus = '';
      const b = document.getElementById('busca-linha'); if (b) b.value = '';
      pintarListaLinhas();
    };
  }

  /* cor da situação da linha — a mesma correspondência do card de linha
     dentro do cliente (cardLinha): aprovada/finalizada em verde, revisão
     em âmbar, criação neutra */
  const classeSituacaoLinha = s =>
    (s === 'Aprovada' || s === 'Finalizada') ? 'gravado' : s === 'Em revisão' ? 'revisao' : 'criacao';

  /* Agrupa por ano/mês, mais recente primeiro. Os meses antigos (antes do
     mês passado) nascem recolhidos: a tela abre no que está em jogo agora
     e o histórico fica a um clique. Com busca ou filtro, tudo abre — quem
     procura quer ver o resultado, não um título fechado. */
  function blocoLinhasPorMes(lista, tudoAberto) {
    const grupos = new Map();
    lista.forEach(l => {
      const chave = l.ano && l.mes ? l.ano + '-' + String(l.mes).padStart(2, '0') : '';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(l);
    });
    const hoje = new Date();
    const atual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const passado = ant.getFullYear() + '-' + String(ant.getMonth() + 1).padStart(2, '0');
    const chaves = [...grupos.keys()].sort((a, b) => !a ? -1 : !b ? 1 : b.localeCompare(a));
    let n = 0;
    return chaves.map(chave => {
      const itens = grupos.get(chave).slice().sort((a, b) =>
        String(a.cliente_nome || '').localeCompare(String(b.cliente_nome || ''), 'pt-BR'));
      const rotulo = chave ? (MESES[+chave.slice(5, 7) - 1] + ' ' + chave.slice(0, 4)) : 'Sem mês definido';
      const conteudos = itens.reduce((t, l) => t + (+l.total_conteudos || 0), 0);
      const emCriacao = itens.filter(l => l.status === 'Em criação').length;
      const aberto = tudoAberto || !chave || chave >= passado;
      return '<details class="lg-grupo"' + (aberto ? ' open' : '') + '>' +
        '<summary><span class="lg-seta-g" aria-hidden="true">›</span>' +
          '<h3>' + esc(rotulo) + '</h3>' +
          (chave === atual ? '<span class="lg-agora">Mês atual</span>' : '') +
          '<span class="lg-resumo">' + itens.length + (itens.length === 1 ? ' linha' : ' linhas') +
            ' · ' + conteudos + (conteudos === 1 ? ' conteúdo' : ' conteúdos') +
            (emCriacao ? ' · <b>' + emCriacao + ' em criação</b>' : '') + '</span>' +
        '</summary>' +
        '<div class="lg-grade">' + itens.map(l => cardLinhaGlobal(l, n++)).join('') + '</div></details>';
    }).join('');
  }

  /* O card é o cliente: dentro de um grupo "Outubro 2026", repetir o mês
     em cada card não diz nada. Em destaque ficam quem é, em que pé está e
     quanto do mês já tem estrutura. O card inteiro é o link. */
  function cardLinhaGlobal(l, i) {
    const total = +l.total_conteudos || 0, estr = +l.total_estruturados || 0, meta = +l.meta_conteudos || 0;
    const pct = total ? Math.round(estr / total * 100) : 0;
    const quando = l.updated_at ? B7.UI.quando(l.updated_at) : '';
    const mesRot = MESES[l.mes - 1] ? MESES[l.mes - 1] + ' ' + l.ano : '';
    const canais = String(l.canais || '').split(',').map(x => x.trim()).filter(Boolean).join(' · ');
    const sub = (l.nome && l.nome !== mesRot) ? l.nome : (canais || mesRot);
    const alerta = REGRAS_LINHA.planejamento.teste(l);
    return '<a class="lg-card" href="#/linha/' + esc(l.id) + '" style="--i:' + Math.min(i || 0, 14) + '">' +
      '<div class="lg-topo">' +
        B7.UI.avatarCliente(l.cliente_nome || '', l.cliente_logo_url) +
        '<div class="lg-id"><b>' + esc(l.cliente_nome || 'Sem cliente') + '</b>' +
          (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' +
        '<span class="lg-abrir" aria-hidden="true">→</span>' +
      '</div>' +
      (total
        ? '<div class="lg-prog">' +
            '<div class="lg-prog-tx"><span><b>' + total + '</b> conteúdo' + (total === 1 ? '' : 's') +
              (meta ? ' <em>de ' + meta + ' na meta</em>' : '') + '</span>' +
              '<span>' + estr + ' estruturado' + (estr === 1 ? '' : 's') + '</span></div>' +
            '<div class="lg-prog-barra" title="' + pct + '% dos conteúdos estruturados"><i style="--p:' + (pct / 100) + '"></i></div>' +
          '</div>'
        : '<div class="lg-vazio">Nenhum conteúdo planejado ainda</div>') +
      '<div class="lg-pe">' +
        '<span class="chip-revisao ' + classeSituacaoLinha(l.status) + '">' + esc(l.status || 'Em criação') + '</span>' +
        (alerta ? '<span class="lg-alerta" title="' + esc(REGRAS_LINHA.planejamento.rotulo) + '">Começa em breve</span>' : '') +
        (quando ? '<span class="lg-quando">editada ' + esc(quando) + '</span>' : '') +
      '</div></a>';
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
           secao, FORMATOS, FUNIL, STATUS_CONTEUDO, STATUS_LINHA, TIPO_PILAR, souDesignerSomenteLeitura,
           REGRAS_LINHA, inicioLinha, fimLinha, novaLinha: () => modalNovaLinha(null, null) };
})();
