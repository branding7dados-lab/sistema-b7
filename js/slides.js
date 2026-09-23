/* =====================================================================
   APRESENTAÇÃO DA LINHA EDITORIAL — 16:9

   Mesmo conteúdo do documento A4, lido do mesmo lugar. O que muda é a
   composição: aqui cada slide tem respiro, tipografia maior e leitura à
   distância. Não é uma folha A4 deitada.

   Identidade preservada: capa escura com gradiente B7, marca oficial,
   logo do cliente quando existir, numeração editorial, riscos e detalhes
   em magenta. O slide é sempre claro (fora a capa), como a folha.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Slides = (function () {
  const esc = B7.UI.esc;
  const MESES = B7.UI.MESES;
  const MARCA = 'assets/brand/symbol-color.png';
  const LOGO = 'assets/brand/logo-white.png';

  const vazio = t => !String(t || '').trim();
  const paragrafos = txt => String(txt || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map(p => '<p>' + esc(p) + '</p>').join('');

  /* campo vazio não existe no slide, como no documento */
  const campo = (rot, valor) => vazio(valor) ? '' :
    '<div class="sl-campo"><b>' + rot + '</b><div class="sl-txt">' + paragrafos(valor) + '</div></div>';

  /* referências entram como lista de links, não como parágrafo corrido */
  const links = (rot, texto) => {
    const linhas = String(texto || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (!linhas.length) return '';
    return '<div class="sl-campo"><b>' + rot + '</b><div class="sl-links">' +
      linhas.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div>';
  };

  const periodo = l => (l.periodo_inicio && l.periodo_fim)
    ? B7.UI.dataBR(l.periodo_inicio) + ' a ' + B7.UI.dataBR(l.periodo_fim) : '';

  const rotulo = l => (l.nome || (MESES[l.mes - 1] + ' ' + l.ano));

  /* ---------------------------------------------------------- moldura */
  function slide(conteudo, opcoes) {
    opcoes = opcoes || {};
    return '<div class="slide' + (opcoes.escuro ? ' escuro' : '') + '">' +
      (opcoes.escuro ? '' :
        '<div class="sl-topo"><div class="esq"><img src="' + MARCA + '" alt="">' +
        '<span>B7 &nbsp;/&nbsp; BRANDING7</span></div>' +
        '<div class="dir">' + esc(opcoes.secao || '') + '</div></div>') +
      '<div class="sl-corpo">' + conteudo + '</div>' +
      (opcoes.escuro ? '' :
        '<div class="sl-pe"><span>' + esc(opcoes.rodape || '') + '</span>' +
        '<span class="n">' + (opcoes.num ? String(opcoes.num).padStart(2, '0') : '') + '</span></div>') +
      '<div class="aviso-overflow">PASSOU DO SLIDE</div></div>';
  }

  /* ------------------------------------------------------------- capa */
  function capa(ctx) {
    const l = ctx.linha;
    return '<div class="slide escuro sl-capa">' +
      '<div class="brilho"></div>' +
      '<img class="marca" src="' + LOGO + '" alt="B7">' +
      (ctx.clienteLogo
        ? '<div class="sl-logo-cliente"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>' : '') +
      '<div class="sl-capa-in">' +
        '<div class="olho"><i></i>PLANEJAMENTO DE CONTEÚDO</div>' +
        '<h1>Linha<br>Editorial</h1>' +
        '<div class="sl-mes">' + esc((MESES[l.mes - 1] || '').toUpperCase()) + ' ' +
          esc(String(l.ano)) + '</div>' +
        '<div class="sl-dados">' +
          '<div><b>CLIENTE</b><span>' + esc(l.cliente_nome || '') + '</span></div>' +
          (periodo(l) ? '<div><b>PERÍODO</b><span>' + esc(periodo(l)) + '</span></div>' : '') +
          (ctx.conteudos.length ? '<div><b>CONTEÚDOS</b><span>' + ctx.conteudos.length +
            '</span></div>' : '') +
        '</div>' +
      '</div></div>';
  }

  /* -------------------------------------------------- slide de seção */
  function abreSecao(num, kicker, titulo) {
    return '<div class="sl-secao">' +
      '<div class="sl-num">' + String(num).padStart(2, '0') + '</div>' +
      '<div><div class="sl-kicker"><i></i>' + esc(kicker) + '</div>' +
      '<h2>' + esc(titulo) + '</h2><div class="sl-risco"></div></div></div>';
  }

  /* ------------------------------------------------------------ montagem
     Cada entrada da lista vira um slide. Seção sem conteúdo não entra:
     não existe slide vazio só para manter a estrutura. */
  function slidesDo(ctx) {
    const l = ctx.linha;
    const lista = [];
    let secao = 1;

    /* ---- objetivo do mês ----
       Três blocos distintos, não um parágrafo solto: o objetivo principal
       em destaque, o período/mês como contexto ao lado, e o complemento
       ("o que a estratégia pretende gerar") como apoio abaixo — a mesma
       separação hero/meta/apoio que a spec pediu para não sobrar espaço
       vazio em volta de um único bloco de texto. */
    if (!vazio(l.objetivo) || !vazio(l.objetivo_detalhe)) {
      const meta = [
        ['MÊS', rotulo(l)],
        periodo(l) ? ['PERÍODO', periodo(l)] : null
      ].filter(Boolean);
      lista.push({ secao: 'OBJETIVO', num: null,
        html: abreSecao(secao++, rotulo(l).toUpperCase(), 'Objetivo do mês') +
          '<div class="sl-objetivo">' +
            (vazio(l.objetivo) ? '' : '<div class="sl-objetivo-hero"><b>OBJETIVO PRINCIPAL</b>' +
              paragrafos(l.objetivo) + '</div>') +
            (meta.length ? '<div class="sl-objetivo-meta">' + meta.map(([r, v]) =>
              '<div><b>' + r + '</b><span>' + esc(v) + '</span></div>').join('') + '</div>' : '') +
            (vazio(l.objetivo_detalhe) ? '' : '<div class="sl-objetivo-apoio">' +
              campo('O QUE A ESTRATÉGIA PRETENDE GERAR', l.objetivo_detalhe) + '</div>') +
          '</div>' });
    }

    /* ---- posicionamento ----
       Grade de campos, não coluna corrida: cada campo real do sistema
       (a marca se posiciona como / tom de voz / proposta única de valor /
       percepção desejada) ocupa seu próprio espaço, sem virar cartão. */
    const pos = campo('A MARCA SE POSICIONA COMO', l.posicionamento) +
                campo('TOM DE VOZ', l.tom_voz) +
                campo('PROPOSTA ÚNICA DE VALOR', l.puv) +
                campo('PERCEPÇÃO DESEJADA', l.percepcao);
    if (pos) {
      lista.push({ secao: 'POSICIONAMENTO', num: null,
        html: abreSecao(secao++, 'COMO A MARCA SE APRESENTA', 'Posicionamento') +
              '<div class="sl-pos-grid">' + pos + '</div>' });
    }

    /* ---- pilares: até 4 por slide, sem encolher letra ---- */
    const pilares = (ctx.pilares || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    if (pilares.length) {
      const pct = p => Math.max(0, +p.percentual || 0);
      const soma = pilares.reduce((t, p) => t + pct(p), 0);
      const base = +l.meta_conteudos || ctx.conteudos.length;
      const planejados = p => Math.round(base * pct(p) / 100);
      const reais = p => ctx.conteudos.filter(c => c.pilar_id === p.id).length;
      const POR = 4;
      const partes = Math.ceil(pilares.length / POR);
      for (let k = 0; k < partes; k++) {
        const grupo = pilares.slice(k * POR, (k + 1) * POR);
        lista.push({ secao: 'PILARES', num: null,
          html: (k === 0
            ? abreSecao(secao, 'ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO', 'Pilares de conteúdo')
            : '<div class="sl-cont">PILARES · PARTE ' + (k + 1) + ' DE ' + partes + '</div>') +
            (k === 0 && soma > 0
              ? '<div class="sl-barra-total">' + pilares.map((p, i) =>
                  '<i class="f' + (i % 4) + '" style="width:' + (pct(p) / Math.max(100, soma) * 100) + '%"></i>').join('') +
                '</div>'
              : '') +
            '<div class="sl-pilares">' + grupo.map(p => {
              const i = pilares.indexOf(p);
              return '<div class="sl-pilar"><div class="sl-pilar-topo">' +
                '<span class="n f' + (i % 4) + '">' + String(i + 1).padStart(2, '0') + '</span>' +
                (pct(p) ? '<span class="pct">' + pct(p) + '%</span>' : '') + '</div>' +
                '<h3>' + esc(p.nome || 'Pilar sem nome') + '</h3>' +
                '<div class="sl-pilar-meta">' +
                  (p.funil ? '<span class="fun">' + esc(String(p.funil).toUpperCase()) + ' DE FUNIL</span>' : '') +
                  (ctx.conteudos.length ? '<span class="rf">' + reais(p) + ' de ' + planejados(p) + ' planejado' +
                    (planejados(p) === 1 ? '' : 's') + '</span>' : '') +
                '</div>' +
                (vazio(p.objetivo) ? '' : '<div class="sl-txt">' + paragrafos(p.objetivo) + '</div>') +
                (vazio(p.observacoes) ? '' : '<div class="sl-dir">' + esc(p.observacoes) + '</div>') +
              '</div>';
            }).join('') + '</div>' });
      }
      secao++;
    }

    /* ---- visão dos conteúdos ---- */
    if (ctx.conteudos.length) {
      const porFormato = {};
      ['Reel', 'Card', 'Carrossel', 'Story'].forEach(f => {
        const n = ctx.conteudos.filter(c => c.tipo === f).length;
        if (n) porFormato[f] = n;
      });
      const canais = (l.canais || '').split(',').map(x => x.trim()).filter(Boolean);
      const numeros = [
        [ctx.conteudos.length, ctx.conteudos.length === 1 ? 'CONTEÚDO' : 'CONTEÚDOS'],
        canais.length ? [canais.length, canais.length === 1 ? 'CANAL' : 'CANAIS'] : null,
        l.meta_conteudos ? [l.meta_conteudos, 'META'] : null
      ].filter(Boolean);

      lista.push({ secao: 'CONTEÚDOS', num: null,
        html: abreSecao(secao++, rotulo(l).toUpperCase(), 'Visão dos conteúdos') +
          '<div class="sl-numeros">' + numeros.map(([n, r]) =>
            '<div><b>' + n + '</b><span>' + r + '</span></div>').join('') + '</div>' +
          (Object.keys(porFormato).length > 1
            ? '<div class="sl-dist">' + Object.keys(porFormato).map(f =>
                '<div><span class="r">' + esc(f) + '</span>' +
                '<span class="ba"><i style="width:' +
                  (porFormato[f] / Math.max.apply(null, Object.values(porFormato)) * 100) +
                '%"></i></span><b>' + porFormato[f] + '</b></div>').join('') + '</div>'
            : '') +
          (canais.length ? '<div class="sl-chips">' +
            canais.map(c => '<span>' + esc(c) + '</span>').join('') + '</div>' : '') });
    }

    /* ---- criativos: lista compacta do mês, não um slide por conteúdo
       explicando cada um (objetivo, headline, roteiro…) — isso é o que o
       editor de Linha Editorial já mostra. Na apresentação, o que importa
       é dar uma visão geral rápida: o que existe, em que formato, quando
       sai. Mesma tabela compacta que Postagens já usa (sl-tabela), só que
       na ordem dos posts em vez de por data. */
    if (ctx.conteudos.length) {
      /* Antes era 12 (mesmo problema do que Postagens tinha): fixo demais,
         gerava slide quase vazio na última parte de um mês comum. O slide
         (.slide) já passa por B7.Folha.ajustar depois de montado — reduz a
         fonte da tabela (var(--fs) em .sl-tabela) até 58% se precisar, em
         vez de cortar. Então o teto aqui pode ser bem mais alto: cabe tudo
         num slide só na maioria dos meses, com fonte um pouco menor
         quando for muitos itens — só quebra em partes se nem a 58% coubesse. */
      const POR_SLIDE_CRI = 30;
      for (let i = 0; i < ctx.conteudos.length; i += POR_SLIDE_CRI) {
        const parte = ctx.conteudos.slice(i, i + POR_SLIDE_CRI);
        const parteNum = Math.floor(i / POR_SLIDE_CRI) + 1;
        const total = Math.ceil(ctx.conteudos.length / POR_SLIDE_CRI);
        lista.push({ secao: 'CRIATIVOS', num: null,
          html: (i === 0
            ? abreSecao(secao, ctx.conteudos.length + ' CONTEÚDO' +
                (ctx.conteudos.length === 1 ? '' : 'S'), 'Criativos')
            : '<div class="sl-cont">CRIATIVOS · PARTE ' + parteNum + ' DE ' + total + '</div>') +
            '<table class="sl-tabela"><thead><tr>' +
              '<th>POST</th><th>FORMATO</th><th>DATA</th>' + (pilares.length ? '<th>PILAR</th>' : '') +
              '<th>TÍTULO</th>' +
            '</tr></thead><tbody>' +
            parte.map((c, k) => '<tr data-cid="' + esc(c.id) + '" title="Ver detalhes">' +
              '<td class="d">' + String(i + k + 1).padStart(2, '0') + '</td>' +
              '<td>' + esc(c.tipo) + '</td>' +
              '<td class="d">' + (c.data_postagem ? esc(B7.UI.dataBR(c.data_postagem)) : '') + '</td>' +
              (pilares.length ? '<td>' + esc((pilares.find(p => p.id === c.pilar_id) || {}).nome || '') + '</td>' : '') +
              '<td class="t">' + esc(c.titulo || 'Sem título') + '</td></tr>').join('') +
            '</tbody></table>' });
      }
      secao++;
    }

    /* ---- postagens ---- */
    const comAlgo = ctx.conteudos.filter(c => c.data_postagem || c.canal);
    if (ctx.conteudos.length) {
      const ordenados = ctx.conteudos.slice().sort((a, b) =>
        String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));
      /* Era 8, achando que precisava reservar isso pra letra não ficar
         miúda — mas o slide já reduz a fonte sozinho (B7.Folha.ajustar,
         --fs até 58%) quando o conteúdo não cabe, em vez de simplesmente
         cortar. Teto bem mais alto: a maioria dos meses cabe num slide só;
         só quebra em partes quando nem a 58% resolveria. */
      const POR_SLIDE = 30;
      for (let i = 0; i < ordenados.length; i += POR_SLIDE) {
        const parte = ordenados.slice(i, i + POR_SLIDE);
        const parteNum = Math.floor(i / POR_SLIDE) + 1;
        const total = Math.ceil(ordenados.length / POR_SLIDE);
        lista.push({ secao: 'POSTAGENS', num: null,
          html: (i === 0
            ? abreSecao(secao, 'TABELA DE POSTAGENS', 'Postagens')
            : '<div class="sl-cont">POSTAGENS · PARTE ' + parteNum + ' DE ' + total + '</div>') +
            '<table class="sl-tabela"><thead><tr>' +
              '<th>DATA</th><th>CANAL</th><th>FORMATO</th>' + (pilares.length ? '<th>PILAR</th>' : '') +
              '<th>CONTEÚDO</th>' +
            '</tr></thead><tbody>' +
            parte.map(c => '<tr data-cid="' + esc(c.id) + '" title="Ver detalhes">' +
              '<td class="d">' + (c.data_postagem ? esc(B7.UI.dataBR(c.data_postagem)) : '') + '</td>' +
              '<td>' + esc(c.canal || '') + '</td>' +
              '<td>' + esc(c.tipo) + '</td>' +
              (pilares.length ? '<td>' + esc((pilares.find(p => p.id === c.pilar_id) || {}).nome || '') + '</td>' : '') +
              '<td class="t">' + esc(c.titulo || 'Sem título') + '</td></tr>').join('') +
            '</tbody></table>' });
      }
      secao++;
    }

    return lista;
  }

  /* ------------------------------------------------------ documento */
  function documentoHTML(ctx) {
    const lista = slidesDo(ctx);
    const rodape = (ctx.linha.cliente_nome || '') + ' · ' + rotulo(ctx.linha);
    let n = 0;
    return (ctx.incluirCapa ? capa(ctx) : '') +
      lista.map(s => {
        n++;
        return slide(s.html, { secao: s.secao, rodape: rodape, num: n });
      }).join('');
  }

  /* quantos slides o documento terá, sem montar o HTML */
  const contar = ctx => slidesDo(ctx).length + (ctx.incluirCapa ? 1 : 0);

  /* Espera fontes/imagens antes de medir — mesma regra usada na prévia.
     Compartilhada aqui porque tanto o modal de exportação (PNG "todos os
     slides") quanto a apresentação chamam esta função. */
  async function esperarPronto(area) {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    try {
      const imgs = [...area.querySelectorAll('img')];
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() :
        new Promise(res => { img.onload = img.onerror = res; })));
    } catch (e) {}
  }

  function nomeArquivoSlide(ctx, indice) {
    const base = [ctx.linha.cliente_nome, ctx.linha.nome ||
      (MESES[ctx.linha.mes - 1] + ' ' + ctx.linha.ano), 'SLIDE_' + String(indice + 1).padStart(2, '0')];
    return B7.Export.nomeArquivo(base, 'png');
  }

  /* --------------------------------------------------------------- PNG
     Mesmo caminho de captura já usado no sistema para roteiros
     (B7.Export.paraCanvas → html2canvas): um arquivo por slide. Único
     ponto que gera PNG de todos os slides — usado pelo modal de
     exportação e pela apresentação (B7.PreviewLinha), sem duplicar. */
  async function baixarTodosPNG(ctx) {
    const area = document.getElementById('area-impressao');
    const guardado = area.innerHTML;
    area.style.display = 'block';
    area.classList.add('modo-slides');
    area.innerHTML = documentoHTML(ctx);
    await esperarPronto(area);
    const paginas = [...area.querySelectorAll('.slide')];
    paginas.forEach(f => B7.Folha.ajustar(f));
    try {
      for (let i = 0; i < paginas.length; i++) {
        const canvas = await B7.Export.paraCanvas(paginas[i]);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        B7.Export.baixarBlob(blob, nomeArquivoSlide(ctx, i));
        await new Promise(res => setTimeout(res, 300));   // o navegador não gosta de rajada
      }
    } finally {
      area.innerHTML = guardado;
      area.style.display = '';
      area.classList.remove('modo-slides');
    }
  }

  return { documentoHTML, slidesDo, capa, slide, contar, esperarPronto, nomeArquivoSlide, baixarTodosPNG };
})();


/* =====================================================================
   PREVIEW DA LINHA EDITORIAL
   Nome próprio de propósito: B7.Apresentar já existe e é o modo
   apresentação do editor de roteiros (Share View, com tela cheia). Este
   aqui é outra coisa — conferência do que vai virar PDF.
   Mostra exatamente o que o PDF vai gerar, em 16:9, com navegação. Não é
   um editor: é conferência antes de mandar para o cliente.
   ===================================================================== */
B7.PreviewLinha = (function () {
  let estado = { paginas: [], i: 0, formato: 'slides', ctx: null };

  /* Ponto de entrada dedicado ("Apresentar Linha Editorial"): reúne os
     dados (mesma função usada pelo PDF, B7.BaixarLinha.reunir — fonte
     única) e abre direto em 16:9, sem passar pelo modal de exportação. */
  async function apresentar(linhaId) {
    const ctx = await B7.BaixarLinha.reunir(linhaId, { incluirCapa: true });
    await abrir(ctx, 'slides');
  }

  async function abrir(ctx, formato) {
    estado.ctx = ctx;
    estado.formato = formato || 'slides';
    estado.i = 0;

    const caixa = document.createElement('div');
    caixa.className = 'preview-fundo' + (estado.formato === 'slides' ? ' wide' : '');
    caixa.innerHTML =
      '<div class="preview-topo">' +
        '<b>' + B7.UI.esc(ctx.linha.cliente_nome || '') + ' · ' +
        B7.UI.esc(ctx.linha.nome || (B7.UI.MESES[ctx.linha.mes - 1] + ' ' + ctx.linha.ano)) + '</b>' +
        '<span class="fmt">' + (estado.formato === 'slides' ? 'Apresentação 16:9' : 'Documento A4') + '</span>' +
        '<div class="preview-acoes">' +
          '<div class="menu"><button class="b p" data-menu-baixar">Baixar ▾</button><div class="lista">' +
            '<button data-baixar-pdf>PDF</button>' +
            (estado.formato === 'slides' ? '<button data-baixar-png-atual>PNG — este slide</button>' +
              '<button data-baixar-png-todos>PNG — todos os slides</button>' : '') +
          '</div></div>' +
          '<button class="b p" data-fechar>Fechar (Esc)</button>' +
        '</div>' +
      '</div>' +
      '<div class="preview-palco">' +
        '<button class="preview-seta esq" data-ant aria-label="Slide anterior">‹</button>' +
        '<div class="preview-in" id="preview-in"></div>' +
        '<button class="preview-seta dir" data-prox aria-label="Próximo slide">›</button>' +
      '</div>' +
      '<div class="preview-nav">' +
        '<button class="b p" data-ant2>Anterior</button>' +
        '<span class="cont" id="preview-cont">—</span>' +
        '<button class="b p" data-prox2>Próximo</button>' +
      '</div>';
    document.body.appendChild(caixa);
    B7.UI.ligarMenus(caixa);

    /* monta as páginas de verdade, fora da tela, e depois mostra uma a uma */
    const area = document.getElementById('area-impressao');
    const guardado = area.innerHTML;
    area.style.display = 'block';
    area.classList.toggle('modo-slides', estado.formato === 'slides');
    area.innerHTML = estado.formato === 'slides'
      ? B7.Slides.documentoHTML(ctx)
      : B7.FolhaLinha.documentoMedidoHTML(ctx, area);
    await B7.Slides.esperarPronto(area);
    area.querySelectorAll('.le-folha, .slide').forEach(f => B7.Folha.ajustar(f));
    estado.paginas = [...area.querySelectorAll('.slide, .folha')].map(el => el.outerHTML);
    area.innerHTML = guardado;
    area.style.display = '';
    area.classList.remove('modo-slides');

    const fechar = () => {
      caixa.remove();
      document.removeEventListener('keydown', tecla);
    };
    /* Um detalhe read-only (clique num item) abre por cima como modal
       comum (B7.UI.modal, que também escuta Esc) — quando ele está
       aberto, Esc precisa fechar só o detalhe, não a apresentação
       inteira por baixo. */
    const tecla = e => {
      if (document.querySelector('.fundo-modal')) return;
      if (e.key === 'Escape') fechar();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(-1);
    };
    document.addEventListener('keydown', tecla);

    caixa.querySelector('[data-fechar]').onclick = fechar;
    caixa.querySelectorAll('[data-ant],[data-ant2]').forEach(b => b.onclick = () => ir(-1));
    caixa.querySelectorAll('[data-prox],[data-prox2]').forEach(b => b.onclick = () => ir(1));
    caixa.querySelector('[data-baixar-pdf]').onclick = async () => {
      fechar();
      await B7.BaixarLinha.gerar(ctx, estado.formato);
    };
    const btnPngAtual = caixa.querySelector('[data-baixar-png-atual]');
    if (btnPngAtual) btnPngAtual.onclick = () => baixarPNGAtual();
    const btnPngTodos = caixa.querySelector('[data-baixar-png-todos]');
    if (btnPngTodos) btnPngTodos.onclick = () => B7.Slides.baixarTodosPNG(ctx);

    /* swipe (touch): esquerda = próximo, direita = anterior — só no
       palco, para não atrapalhar a rolagem do resto da tela */
    const palco = caixa.querySelector('.preview-palco');
    let tx = null, ty = null;
    palco.addEventListener('touchstart', e => {
      if (!e.touches.length) return;
      tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    }, { passive: true });
    palco.addEventListener('touchend', e => {
      if (tx === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - tx, dy = t.clientY - ty;
      tx = ty = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) ir(dx < 0 ? 1 : -1);
    }, { passive: true });

    function ir(d) {
      estado.i = Math.max(0, Math.min(estado.paginas.length - 1, estado.i + d));
      desenhar();
    }
    function desenhar() {
      const alvo = caixa.querySelector('#preview-in');
      alvo.innerHTML = estado.paginas[estado.i] || '';
      caixa.querySelector('#preview-cont').textContent =
        (estado.i + 1) + ' / ' + estado.paginas.length;
      caixa.querySelectorAll('[data-ant],[data-ant2]').forEach(b => b.disabled = estado.i === 0);
      caixa.querySelectorAll('[data-prox],[data-prox2]').forEach(b => b.disabled = estado.i >= estado.paginas.length - 1);
      escalar();
      ligarDetalhe(alvo, ctx);
    }
    function escalar() {
      const dentro = caixa.querySelector('#preview-in');
      const pagina = dentro.firstElementChild;
      if (!pagina) return;
      const f = Math.min(
        (palco.clientWidth - 100) / pagina.offsetWidth,
        (palco.clientHeight - 40) / pagina.offsetHeight);
      dentro.style.transform = 'scale(' + f + ')';
      dentro.style.width = pagina.offsetWidth + 'px';
      dentro.style.height = pagina.offsetHeight + 'px';
    }
    window.addEventListener('resize', escalar);
    desenhar();
  }

  /* ------------------------------------------------- interação (item 12)
     Clicar num item de conteúdo (linha da tabela de postagens, ou o
     cabeçalho de um slide de criativo) abre um detalhe read-only por
     cima, sem sair do slide atual. Só os campos reais do conteúdo. */
  function ligarDetalhe(area, ctx) {
    area.querySelectorAll('[data-cid]').forEach(el => el.onclick = () => abrirDetalheConteudo(el.dataset.cid, ctx));
  }
  function abrirDetalheConteudo(id, ctx) {
    const c = (ctx.conteudos || []).find(x => x.id === id);
    if (!c) return;
    const esc = B7.UI.esc;
    const pilar = (ctx.pilares || []).find(p => p.id === c.pilar_id);
    const campo = (rot, v) => (!v || !String(v).trim()) ? '' :
      '<div class="le-campo"><b>' + rot + '</b><div class="le-txt"><p>' + esc(v) + '</p></div></div>';
    B7.UI.modal('<h3>' + esc(c.titulo || 'Sem título') + '</h3>' +
      '<div class="sub">' + esc(c.tipo || '') +
        (c.canal ? ' · ' + esc(c.canal) : '') +
        (c.data_postagem ? ' · ' + esc(B7.UI.dataBR(c.data_postagem)) : '') +
        (pilar ? ' · ' + esc(pilar.nome || 'Pilar sem nome') : '') + '</div>' +
      campo('OBJETIVO', c.objetivo) +
      campo('IDEIA GERAL', c.ideia_geral) +
      campo('LEGENDA', c.legenda) +
      campo('CTA', c.cta) +
      '<div class="acoes"><button class="b pri" data-fecha>Voltar à apresentação</button></div>');
  }

  /* --------------------------------------------------------------- PNG
     Mesmo caminho de captura já usado no sistema para roteiros
     (B7.Export.paraCanvas → html2canvas), aplicado aos slides da Linha
     Editorial. O slide atual é recriado fora da tela (mesmo caminho de
     baixarTodosPNG) em vez de capturar o nó visível do preview — esse nó
     está dentro de #preview-in, que tem um `transform:scale()` para
     caber no palco, e capturar um elemento transformado dá resultado
     inconsistente (tamanho/nitidez variam com o zoom da tela no
     momento). Capturando sempre em tamanho real, o PNG de "este slide"
     sai idêntico ao de "todos os slides". */
  async function baixarPNGAtual() {
    const area = document.getElementById('area-impressao');
    const guardado = area.innerHTML;
    area.style.display = 'block';
    area.classList.add('modo-slides');
    area.innerHTML = estado.paginas[estado.i] || '';
    await B7.Slides.esperarPronto(area);
    const pagina = area.querySelector('.slide, .folha');
    try {
      if (!pagina) return;
      B7.Folha.ajustar(pagina);
      const canvas = await B7.Export.paraCanvas(pagina);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      B7.Export.baixarBlob(blob, B7.Slides.nomeArquivoSlide(estado.ctx, estado.i));
    } catch (e) {
      B7.UI.toast('Não foi possível gerar o PNG.', { tipo: 'erro' });
    } finally {
      area.innerHTML = guardado;
      area.style.display = '';
      area.classList.remove('modo-slides');
    }
  }

  return { abrir, apresentar };
})();
