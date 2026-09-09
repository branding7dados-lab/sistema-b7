/* =====================================================================
   FICHA A4 + IMPRESSÃO
   Este arquivo desenha a folha (usada tanto na prévia quanto na
   impressão), faz o ajuste automático de escala e monta a seleção de
   roteiros para imprimir.
   O texto do roteiro é impresso exatamente como foi digitado: aqui só se
   quebra em parágrafos nas quebras de linha que a pessoa escreveu.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Folha = (function () {
  const esc = B7.UI.esc;
  /* Marca na impressão — arquivos oficiais, sem redesenho e sem efeito:
     • ficha (fundo branco)   → símbolo colorido, que imprime com contraste;
     • abertura (fundo preto) → lockup branco. */
  const MARCA = 'assets/brand/symbol-color.png';
  const LOGO  = 'assets/brand/logo-white.png';

  const paragrafos = txt => {
    const ls = String(txt || '').split('\n').map(s => s.trim()).filter(Boolean);
    return (ls.length ? ls : ['']).map(p => '<p>' + esc(p) + '</p>').join('');
  };
  const vazio = t => !String(t || '').trim();

  const CLASSE = {
    'Gancho': 'bl-gancho', 'Narrativa': 'bl-narrativa',
    'Narração': 'bl-narracao', 'CTA': 'bl-cta'
  };

  function cenaHTML(cena, indice) {
    const tipo = cena.tipo || 'Narrativa';
    const etiqueta = (cena.funcao && cena.funcao.trim()) ? cena.funcao.trim().toUpperCase() : tipo.toUpperCase();
    let corpo;
    if (tipo === 'Gancho') {
      corpo = '<div class="bl-gancho"><div class="aspas">&ldquo;</div>' +
              '<div class="txt">' + paragrafos(cena.texto) + '</div></div>';
    } else if (tipo === 'CTA') {
      corpo = '<div class="bl-cta">' + paragrafos(cena.texto) + '</div>';
    } else if (tipo === 'Narração') {
      corpo = '<div class="bl-narracao">' + paragrafos(cena.texto) + '</div>' +
              '<div class="sug"><b>SUGESTÃO DE CENAS</b><div class="sug-txt">' +
              paragrafos(cena.sugestao_cenas) + '</div></div>';
    } else {
      corpo = '<div class="bl-narrativa">' + paragrafos(cena.texto) + '</div>';
    }
    return '<div class="cena-bloco"><div class="cena-cabeca">' +
      '<div class="cena-num">CENA ' + (indice + 1) + '</div>' +
      '<div class="cena-dir">' + esc(cena.direcao || '') + '</div>' +
      '<div class="cena-linha"></div>' +
      '<div class="etiqueta e-' + esc(tipo) + '">' + esc(etiqueta) + '</div>' +
      '</div>' + corpo + '</div>';
  }

  /* ctx = { cliente, dataGravacao, gravacao, roteiro, cenas, indice, total }
     dataGravacao é opcional: sem data, a coluna some da folha em vez de
     mostrar um campo vazio. */
  function folhaHTML(ctx) {
    const r = ctx.roteiro;
    const cenas = ctx.cenas.map((c, i) => cenaHTML(c, i)).join('<div class="esp"></div>');
    const num = String(ctx.indice + 1).padStart(2, '0');
    return '<div class="folha" data-roteiro="' + esc(r.id) + '" style="--fs:' + (r.escala || 1) + '">' +
      '<div class="faixa-topo"></div>' +
      '<div class="folha-cabeca"><div class="esq"><img src="' + MARCA + '" alt="">' +
        '<span>B7 &nbsp;/&nbsp; BRANDING7</span></div>' +
        '<div class="dir">ROTEIROS DE GRAVAÇÃO</div></div>' +
      '<div class="proj">' +
        '<div class="cel"><b>CLIENTE</b>' +
          (ctx.clienteLogo
            ? '<div class="cli-com-logo"><img src="' + esc(ctx.clienteLogo) + '" alt="">' +
              '<span>' + esc(ctx.cliente || 'Cliente') + '</span></div>'
            : '<span class="' + (ctx.cliente ? '' : 'fraco') + '">' + esc(ctx.cliente || 'Cliente') + '</span>') +
        '</div>' +
        '<div class="cel"><b>GRAVAÇÃO</b><span class="' + (ctx.gravacao ? '' : 'fraco') + '">' +
          esc(ctx.gravacao || 'Gravação') + '</span></div>' +
        (ctx.dataGravacao ? '<div class="cel"><b>DATA</b><span>' + esc(ctx.dataGravacao) + '</span></div>' : '') +
        '<div class="cel fim"><b>VÍDEO</b><span>' + num + ' / ' + String(ctx.total).padStart(2, '0') + '</span></div>' +
      '</div>' +
      '<div class="titulo-bloco"><div class="numero">' + num + '</div><div class="titulo-dir">' +
        '<div class="kicker"><i></i>ROTEIRO ' + num + ' &nbsp;·&nbsp; ' + ctx.cenas.length +
          ' CENA' + (ctx.cenas.length === 1 ? '' : 'S') + '</div>' +
        '<h2 class="' + (vazio(r.titulo) ? 'fraco' : '') + '">' + esc(r.titulo || 'Título do roteiro') + '</h2>' +
        '<div class="risco-titulo"></div>' +
        (vazio(r.objetivo) ? '' : '<div class="obj"><b>OBJETIVO</b><div class="obj-txt">' + esc(r.objetivo) + '</div></div>') +
        (vazio(r.observacao_gravacao) ? '' : '<div class="nota-grav"><b>NA GRAVAÇÃO</b><div class="obj-txt">' +
          esc(r.observacao_gravacao) + '</div></div>') +
      '</div></div>' +
      '<div class="folha-corpo"><div class="esp"></div>' + cenas + '<div class="esp fim"></div></div>' +
      takesHTML(ctx.cenas.length) +
      '<div class="folha-pe"><div class="esq">B7 / BRANDING7 &nbsp;·&nbsp; ROTEIROS DE GRAVAÇÃO</div>' +
        '<div class="dir">' + num + '</div></div>' +
      '<div class="aviso-overflow">PASSOU DA PÁGINA — REDUZA A FONTE (A−) OU TIRE UMA CENA</div>' +
    '</div>';
  }

  /* Uma caixinha por cena, para o videomaker ir marcando o que já gravou.
     Cresce junto com o roteiro. */
  function takesHTML(quantas) {
    const caixas = [];
    for (let i = 1; i <= quantas; i++) {
      caixas.push('<div class="tk"><span class="bx"></span>' + String(i).padStart(2, '0') + '</div>');
    }
    return '<div class="takes"><div class="tk-rot">CENAS GRAVADAS</div>' +
      caixas.join('') + '<div class="sp"></div>' +
      '<div class="tk"><span class="bx"></span>APROVADO</div></div>';
  }

  function aberturaHTML(ctx) {
    const itens = ctx.roteiros.map((r, i) =>
      '<div class="it"><b>' + String(i + 1).padStart(2, '0') + '</b><span>' +
      esc(r.titulo || 'Sem título') + '</span></div>').join('');
    return '<div class="folha abertura">' +
      '<div class="brilho"></div>' +
      '<img class="marca" src="' + LOGO + '" alt="B7">' +
      '<div class="miolo">' +
        '<div class="olho"><i></i>PRODUÇÃO DE CONTEÚDO</div>' +
        '<h1>Roteiros<br>de Gravação</h1>' +
        '<div class="dados">' +
          '<div class="cel"><b>CLIENTE</b><span>' + esc(ctx.cliente || '—') + '</span></div>' +
          '<div class="cel"><b>GRAVAÇÃO</b><span>' + esc(ctx.gravacao || '—') + '</span></div>' +
          (ctx.dataGravacao ? '<div class="cel"><b>DATA</b><span>' + esc(ctx.dataGravacao) + '</span></div>' : '') +
        '</div>' +
        '<div class="indice"><div class="rot">ROTEIROS DESTA GRAVAÇÃO</div>' + itens + '</div>' +
      '</div></div>';
  }

  /* ------------------------------------------------- ajuste de escala */
  function estourou(folha) {
    return folha.scrollHeight > folha.clientHeight + 2 || folha.scrollWidth > folha.clientWidth + 2;
  }
  /* Reduz só o necessário. No automático nunca passa de 100%. */
  function ajustar(folha) {
    let e = 1;
    folha.style.setProperty('--fs', e);
    while (estourou(folha) && e > 0.58) {
      e = +(e - 0.01).toFixed(2);
      folha.style.setProperty('--fs', e);
    }
    return e;
  }
  function marcarOverflow(folha) {
    folha.classList.toggle('estourou', estourou(folha));
  }

  return { folhaHTML, aberturaHTML, ajustar, estourou, marcarOverflow };
})();


B7.Impressao = (function () {
  const esc = B7.UI.esc;

  /* ctx = { cliente, dataGravacao, gravacao, roteiros:[], cenasPorRoteiro:{} } */
  const ICP = {
    impressora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5M6 18H4v-6h16v6h-2M8 14h8v6H8z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7l5 5v13H6z"/><path d="M13 3v5h5"/><path d="M9 13h6M9 16.5h4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.5"/></svg>',
    dica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18h5M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>',
    margem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7.5 3.5v17M16.5 3.5v17M3.5 7.5h17M3.5 16.5h17"/></svg>',
    fundo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-4.5 5-2-2L3 19"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ctx = { cliente, clienteLogo, gravacao, dataGravacao, roteiros, cenasPorRoteiro } */
  function abrirSelecao(ctx) {
    const marcarAbertura = B7.pref.ler('abertura', false);

    const linhas = ctx.roteiros.map((r, i) =>
      '<label class="rot-item selecionado" data-id="' + esc(r.id) + '">' +
        '<input type="checkbox" checked hidden>' +
        '<span class="caixa" aria-hidden="true">' + ICP.check + '</span>' +
        '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="ic-doc">' + ICP.doc + '</span>' +
        '<span class="tit">' + esc(r.titulo || 'Sem título') + '</span>' +
        '<span class="cenas">' + (ctx.cenasPorRoteiro[r.id] || []).length + ' cenas</span>' +
      '</label>').join('');

    const m = B7.UI.modal(
      '<div class="mp">' +

        '<aside class="mp-lado">' +
          '<div class="mp-ic">' + ICP.impressora + '</div>' +
          '<h3>Imprimir roteiros</h3>' +
          '<p class="mp-sub">Cada roteiro será gerado em uma folha A4.</p>' +
          '<div class="mp-folhas" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<div class="mp-config"><div class="mp-config-tit">Para melhor resultado no Chrome</div>' +
            '<div class="mp-linha">' + ICP.margem + '<span>Margens: <b>Nenhuma</b></span></div>' +
            '<div class="mp-linha">' + ICP.fundo + '<span>Ativar: <b>Gráficos de plano de fundo</b></span></div>' +
          '</div>' +
          '<div class="mp-dica">' + ICP.dica +
            '<div><b>Dica</b><span>Para melhor resultado, utilize o navegador Google Chrome.</span></div>' +
          '</div>' +
        '</aside>' +

        '<section class="mp-principal">' +
          '<header class="mp-topo">' +
            '<div><h3>O que deseja imprimir?</h3>' +
            '<p class="mp-sub">Escolha os roteiros e opções abaixo para personalizar sua impressão.</p></div>' +
            '<button class="ico" data-fecha aria-label="Fechar">' + ICP.x + '</button>' +
          '</header>' +

          '<div class="mp-lista rolagem" id="mp-lista">' + linhas + '</div>' +

          '<div class="mp-marcar"><span>Selecionar:</span>' +
            '<button class="b fina" data-todos>Todos</button>' +
            '<button class="b fina" data-nenhum>Nenhum</button>' +
          '</div>' +

          '<label class="rot-item extra' + (marcarAbertura ? ' selecionado' : '') + '" id="mp-abertura">' +
            '<input type="checkbox" hidden' + (marcarAbertura ? ' checked' : '') + '>' +
            '<span class="caixa" aria-hidden="true">' + ICP.check + '</span>' +
            '<span class="tx"><b>Incluir folha de abertura</b>' +
            '<small>Adiciona cliente, gravação, data — quando existir — e a lista de roteiros.</small></span>' +
          '</label>' +

          '<div class="mp-info">' + ICP.info +
            '<div><b>Configurações recomendadas no Chrome</b>' +
            '<span>Margens: Nenhuma · Gráficos de plano de fundo: ativado</span></div>' +
          '</div>' +

          '<footer class="mp-pe">' +
            '<span class="mp-contador" id="mp-contador"></span>' +
            '<button class="b" data-fecha>Cancelar</button>' +
            '<button class="b pri" data-ok id="mp-gerar">' + ICP.impressora +
              '<span class="mp-texto-bt">Gerar impressão</span></button>' +
          '</footer>' +
        '</section>' +

      '</div>', { extra: 'modal-impressao' });

    const lista = m.querySelector('#mp-lista');
    const gerar = m.querySelector('#mp-gerar');
    const contador = m.querySelector('#mp-contador');
    const abertura = m.querySelector('#mp-abertura');

    const marcados = () => [...lista.querySelectorAll('.rot-item.selecionado')];

    function atualizar() {
      const n = marcados().length;
      contador.textContent = n === 0 ? 'Nenhum roteiro selecionado'
                                     : n + ' roteiro' + (n === 1 ? '' : 's') + ' selecionado' + (n === 1 ? '' : 's');
      gerar.disabled = n === 0;      /* nunca gerar documento vazio */
    }

    function alternar(item) {
      const cx = item.querySelector('input');
      cx.checked = !cx.checked;
      item.classList.toggle('selecionado', cx.checked);
      atualizar();
    }

    /* clique em qualquer parte do card alterna; teclado também */
    [...lista.querySelectorAll('.rot-item'), abertura].forEach(item => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'checkbox');
      item.setAttribute('aria-checked', item.classList.contains('selecionado'));
      item.addEventListener('click', e => {
        e.preventDefault();
        alternar(item);
        item.setAttribute('aria-checked', item.classList.contains('selecionado'));
      });
      item.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          alternar(item);
          item.setAttribute('aria-checked', item.classList.contains('selecionado'));
        }
      });
    });

    m.querySelector('[data-todos]').onclick = () => {
      lista.querySelectorAll('.rot-item').forEach(i => {
        i.querySelector('input').checked = true;
        i.classList.add('selecionado');
        i.setAttribute('aria-checked', 'true');
      });
      atualizar();
    };
    m.querySelector('[data-nenhum]').onclick = () => {
      lista.querySelectorAll('.rot-item').forEach(i => {
        i.querySelector('input').checked = false;
        i.classList.remove('selecionado');
        i.setAttribute('aria-checked', 'false');
      });
      atualizar();
    };

    gerar.onclick = async () => {
      const ids = marcados().map(i => i.dataset.id);
      if (!ids.length) return;
      const comAbertura = abertura.classList.contains('selecionado');
      B7.pref.gravar('abertura', comAbertura);

      gerar.disabled = true;
      gerar.classList.add('carregando');
      m.querySelector('.mp-texto-bt').textContent = 'Preparando impressão…';
      try {
        await imprimir(ctx, ids, comAbertura);
        m.fechar();
      } catch (e) {
        console.error(e);
        B7.UI.toast('Não foi possível gerar a impressão.', { tipo: 'erro' });
        gerar.classList.remove('carregando');
        gerar.disabled = false;
        m.querySelector('.mp-texto-bt').textContent = 'Gerar impressão';
      }
    };

    atualizar();
    gerar.focus();
    return m;
  }

  function imprimir(ctx, ids, comAbertura) {
    return new Promise((resolve, reject) => {
     try {
    const area = document.getElementById('area-impressao');
    const selecionados = ctx.roteiros.filter(r => ids.includes(r.id));
    let html = '';
    if (comAbertura) {
      html += B7.Folha.aberturaHTML({
        cliente: ctx.cliente, dataGravacao: ctx.dataGravacao,
        gravacao: ctx.gravacao, roteiros: selecionados
      });
    }
    selecionados.forEach((r, i) => {
      html += B7.Folha.folhaHTML({
        cliente: ctx.cliente, clienteLogo: ctx.clienteLogo,
        dataGravacao: ctx.dataGravacao, gravacao: ctx.gravacao,
        roteiro: r, cenas: ctx.cenasPorRoteiro[r.id] || [],
        indice: ctx.roteiros.indexOf(r), total: ctx.roteiros.length
      });
    });
    area.innerHTML = html;

    /* mede com a área visível para o ajuste automático funcionar */
    area.style.display = 'block';
    area.querySelectorAll('.folha:not(.abertura)').forEach(f => {
      const id = f.dataset.roteiro;
      const r = selecionados.find(x => x.id === id);
      if (r && r.escala_automatica !== false) B7.Folha.ajustar(f);
      else f.style.setProperty('--fs', r ? (r.escala || 1) : 1);
    });
    area.style.display = '';

    setTimeout(() => {
      try { window.print(); } catch (e) { return reject(e); }
      setTimeout(() => { area.innerHTML = ''; }, 800);
      resolve();
    }, 140);
     } catch (e) { reject(e); }
    });
  }

  return { abrirSelecao, imprimir };
})();
