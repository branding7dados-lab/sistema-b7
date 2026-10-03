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

  /* ------------------------------------------------- medição de verdade
     O slide tem altura fixa (190,5mm) e TANTO .slide QUANTO .sl-corpo
     têm overflow:hidden. Isso significa que o slide nunca "cresce":
     B7.Folha.estourou() compara scrollHeight com clientHeight do .slide
     e por isso nunca acusa nada — B7.Folha.ajustar() jamais reduz a
     fonte de um slide, e o que passa da altura simplesmente é cortado na
     captura (html2canvas), sumindo do PDF sem aviso. Foi exatamente o
     que aconteceu com 15 criativos/postagens num teto de 30 por slide.

     A correção é a mesma técnica que o documento A4 já usa em
     B7.FolhaLinha.montarFolhas: montar no DOM, medir o corpo de verdade
     e quebrar onde precisa. Aqui a medição é feita no .sl-corpo (o
     .slide externo nunca estoura por causa do overflow:hidden).

     Devolve null quando não há como medir (sem DOM, sem `area`, ou
     elemento sem layout — jsdom, por exemplo); nesse caso a paginação
     cai num teto conservador, nunca no corte. */
  function criarMedidor(area) {
    if (typeof document === 'undefined' || !area || !area.appendChild) return null;
    let caixa;
    try {
      caixa = document.createElement('div');
      caixa.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
      area.appendChild(caixa);
    } catch (e) { return null; }

    const cabe = html => {
      try {
        caixa.innerHTML = slide(html, { secao: 'MEDIÇÃO', rodape: '', num: 1 });
        const f = caixa.querySelector('.slide');
        const corpo = f && f.querySelector('.sl-corpo');
        if (!corpo || !corpo.clientHeight) return null;   // sem layout: não dá para medir
        return corpo.scrollHeight <= corpo.clientHeight + 2;
      } catch (e) { return null; }
    };

    /* sonda: se o ambiente não faz layout, some com o medidor e avisa */
    if (cabe('<div style="height:1px"></div>') === null) {
      try { caixa.remove(); } catch (e) {}
      return null;
    }
    return {
      cabe: html => cabe(html) === true,
      fim: () => { try { caixa.remove(); } catch (e) {} }
    };
  }

  /* Tetos de segurança — usados só quando não há medição disponível.
     São próximos do que cabe de fato no slide (o primeiro gasta altura
     com o cabeçalho grande de seção, os seguintes só com a tarja
     `.sl-cont`). Conservadores de propósito: sobrar espaço é aceitável,
     perder conteúdo não. */
  const TETO_PRIMEIRO = 9;
  const TETO_SEGUINTES = 12;

  /* Quebra `itens` em partes que realmente cabem.
     `montar(parte, k, total)` devolve o HTML do corpo do slide da parte k
     (0-based). A busca binária vale porque a altura cresce junto com a
     quantidade de linhas. Nunca devolve parte vazia: se nem uma linha
     couber, a linha vai assim mesmo (e aí o corte fica visível numa
     linha só, em vez de sumir com o resto). */
  function fatiar(itens, montar, medidor) {
    const partes = [];
    let i = 0;
    while (i < itens.length) {
      const k = partes.length;
      const restante = itens.length - i;
      let n;
      if (medidor) {
        const coube = c => medidor.cabe(montar(itens.slice(i, i + c), k, k + 1));
        if (coube(restante)) n = restante;
        else {
          let lo = 1, hi = restante - 1, melhor = 0;
          while (lo <= hi) {
            const meio = (lo + hi) >> 1;
            if (coube(meio)) { melhor = meio; lo = meio + 1; } else hi = meio - 1;
          }
          n = Math.max(1, melhor);
        }
      } else {
        n = Math.min(restante, k === 0 ? TETO_PRIMEIRO : TETO_SEGUINTES);
      }
      partes.push(itens.slice(i, i + n));
      i += n;
    }
    return partes;
  }

  /* Tarja das partes seguintes. O total exibido é o do conjunto inteiro
     (15 criativos continuam sendo 15 na parte 2), não o da parte. */
  const contHTML = (rot, k, totalPartes, totalItens, unidade) =>
    '<div class="sl-cont">' + rot + ' · PARTE ' + (k + 1) + ' DE ' + totalPartes +
    ' · ' + totalItens + ' ' + unidade + ' NO TOTAL</div>';

  /* ------------------------------------------------------------ montagem
     Cada entrada da lista vira um slide. Seção sem conteúdo não entra:
     não existe slide vazio só para manter a estrutura.

     `area` (o #area-impressao) é opcional e serve só para medir: com ele
     a paginação das tabelas é real; sem ele, cai no teto conservador. */
  function slidesDo(ctx, area) {
    const l = ctx.linha;
    const lista = [];
    let secao = 1;
    /* só é criado quando há tabela para paginar; null = sem medição */
    const medidor = (ctx.conteudos && ctx.conteudos.length) ? criarMedidor(area) : null;

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
      /* Teto fixo (era 30) cortava conteúdo: com 15 criativos tudo ia
         para um slide só e o que passava da altura sumia na captura.
         Agora as linhas são medidas de verdade (ver criarMedidor) e o
         que não cabe vai para um slide de continuação. */
      const totalCri = ctx.conteudos.length;
      const linhasCri = ctx.conteudos.map((c, idx) =>
        '<tr data-cid="' + esc(c.id) + '" title="Ver detalhes">' +
        '<td class="d">' + String(idx + 1).padStart(2, '0') + '</td>' +
        '<td>' + esc(c.tipo) + '</td>' +
        '<td class="d">' + (c.data_postagem ? esc(B7.UI.dataBR(c.data_postagem)) : '') + '</td>' +
        (pilares.length ? '<td>' + esc((pilares.find(p => p.id === c.pilar_id) || {}).nome || '') + '</td>' : '') +
        '<td class="t">' + esc(c.titulo || 'Sem título') + '</td></tr>');

      const montarCri = (linhas, k, totalPartes) =>
        (k === 0
          ? abreSecao(secao, totalCri + ' CONTEÚDO' + (totalCri === 1 ? '' : 'S'), 'Criativos')
          : contHTML('CRIATIVOS', k, totalPartes, totalCri, 'CONTEÚDO' + (totalCri === 1 ? '' : 'S'))) +
        '<table class="sl-tabela"><thead><tr>' +
          '<th>POST</th><th>FORMATO</th><th>DATA</th>' + (pilares.length ? '<th>PILAR</th>' : '') +
          '<th>TÍTULO</th>' +
        '</tr></thead><tbody>' + linhas.join('') + '</tbody></table>';

      /* O total de partes só é conhecido depois de paginar tudo — por
         isso o rótulo definitivo ("PARTE 2 DE 3") só é montado aqui,
         depois do fatiamento. */
      const partesCri = fatiar(linhasCri, montarCri, medidor);
      partesCri.forEach((linhas, k) =>
        lista.push({ secao: 'CRIATIVOS', num: null, html: montarCri(linhas, k, partesCri.length) }));
      secao++;
    }

    /* ---- postagens ---- */
    const comAlgo = ctx.conteudos.filter(c => c.data_postagem || c.canal);
    if (ctx.conteudos.length) {
      const ordenados = ctx.conteudos.slice().sort((a, b) =>
        String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));
      /* Mesmo caso dos Criativos: o teto de 30 cortava. Agora mede.
         O eyebrow passa a trazer a contagem real ("15 POSTAGENS"), no
         mesmo estilo do slide de Criativos — antes era só "TABELA DE
         POSTAGENS", sem número. */
      const totalPost = ordenados.length;
      const unidPost = totalPost === 1 ? 'POSTAGEM' : 'POSTAGENS';
      const linhasPost = ordenados.map(c =>
        '<tr data-cid="' + esc(c.id) + '" data-lista="post" title="Ver detalhes">' +
        '<td class="d">' + (c.data_postagem ? esc(B7.UI.dataBR(c.data_postagem)) : '') + '</td>' +
        '<td>' + esc(c.canal || '') + '</td>' +
        '<td>' + esc(c.tipo) + '</td>' +
        (pilares.length ? '<td>' + esc((pilares.find(p => p.id === c.pilar_id) || {}).nome || '') + '</td>' : '') +
        '<td class="t">' + esc(c.titulo || 'Sem título') + '</td></tr>');

      const montarPost = (linhas, k, totalPartes) =>
        (k === 0
          ? abreSecao(secao, totalPost + ' ' + unidPost, 'Postagens')
          : contHTML('POSTAGENS', k, totalPartes, totalPost, unidPost)) +
        '<table class="sl-tabela"><thead><tr>' +
          '<th>DATA</th><th>CANAL</th><th>FORMATO</th>' + (pilares.length ? '<th>PILAR</th>' : '') +
          '<th>CONTEÚDO</th>' +
        '</tr></thead><tbody>' + linhas.join('') + '</tbody></table>';

      const partesPost = fatiar(linhasPost, montarPost, medidor);
      partesPost.forEach((linhas, k) =>
        lista.push({ secao: 'POSTAGENS', num: null, html: montarPost(linhas, k, partesPost.length) }));
      secao++;
    }

    if (medidor) medidor.fim();
    return lista;
  }

  /* ------------------------------------------------------ documento */
  function documentoHTML(ctx, area) {
    const lista = slidesDo(ctx, area);
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
  async function esperarFontes() {
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  }

  async function esperarPronto(area) {
    await esperarFontes();
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
    /* fontes ANTES de montar: a paginação dos slides mede altura de
       texto no DOM, e medir com a fonte do sistema pagina errado */
    await esperarFontes();
    area.innerHTML = documentoHTML(ctx, area);
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

  return { documentoHTML, slidesDo, capa, slide, contar, esperarFontes, esperarPronto, nomeArquivoSlide, baixarTodosPNG };
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
  const menosMovimento = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  };

  async function apresentar(linhaId) {
    /* Apresentar É tela cheia. O navegador só aceita o pedido enquanto o
       clique que abriu a apresentação ainda "vale", e buscar os dados da
       linha pode demorar mais que isso — então a tela cheia é pedida
       AGORA, numa caixa de espera, e os dados chegam depois. "Visualizar"
       (o preview antes de exportar) continua dentro da janela: lá a
       pessoa está conferindo o documento, não mostrando pra ninguém. */
    const caixa = document.createElement('div');
    caixa.className = 'preview-fundo wide';
    caixa.innerHTML = '<div class="preview-carrega"><i></i>Preparando a apresentação…</div>';
    document.body.appendChild(caixa);
    const pedir = caixa.requestFullscreen || caixa.webkitRequestFullscreen || caixa.msRequestFullscreen;
    const pedido = pedir ? Promise.resolve().then(() => pedir.call(caixa)).catch(() => {}) : Promise.resolve();
    try {
      const ctx = await B7.BaixarLinha.reunir(linhaId, { incluirCapa: true });
      /* espera a resposta da tela cheia só um instante: há navegador que
         nunca responde ao pedido, e a apresentação não pode ficar presa
         nisso — se a tela cheia vier depois, o evento reescala o slide */
      await Promise.race([pedido, new Promise(res => setTimeout(res, 1200))]);
      await abrir(ctx, 'slides', { apresentacao: true, caixa: caixa });
    } catch (e) {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e2) {}
      }
      caixa.remove();
      throw e;
    }
  }

  async function abrir(ctx, formato, opcoes) {
    opcoes = opcoes || {};
    estado.ctx = ctx;
    estado.formato = formato || 'slides';
    estado.i = 0;
    const ehSlides = estado.formato === 'slides';

    const caixa = opcoes.caixa || document.createElement('div');
    caixa.className = 'preview-fundo' + (ehSlides ? ' wide' : '') + (opcoes.apresentacao ? ' modo-show' : '');
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
          '<button class="b p" data-telacheia aria-label="Entrar em tela cheia">Tela cheia</button>' +
          '<button class="b p" data-fechar>Fechar (Esc)</button>' +
        '</div>' +
      '</div>' +
      '<div class="preview-palco">' +
        '<button class="preview-seta esq" data-ant aria-label="Slide anterior">‹</button>' +
        '<div class="preview-in" id="preview-in"></div>' +
        '<button class="preview-seta dir" data-prox aria-label="Próximo slide">›</button>' +
        '<div class="preview-prog"><i></i></div>' +
      '</div>' +
      '<div class="preview-nav">' +
        '<button class="b p" data-ant2>Anterior</button>' +
        '<span class="cont" id="preview-cont">—</span>' +
        '<button class="b p" data-prox2>Próximo</button>' +
      '</div>';
    if (!caixa.isConnected) document.body.appendChild(caixa);
    B7.UI.ligarMenus(caixa);

    /* monta as páginas de verdade, fora da tela, e depois mostra uma a uma */
    const area = document.getElementById('area-impressao');
    const guardado = area.innerHTML;
    area.style.display = 'block';
    area.classList.toggle('modo-slides', estado.formato === 'slides');
    /* fontes ANTES de montar: tanto a paginação medida dos slides quanto
       a do A4 (documentoMedidoHTML) medem o DOM aqui dentro */
    await B7.Slides.esperarFontes();
    area.innerHTML = estado.formato === 'slides'
      ? B7.Slides.documentoHTML(ctx, area)
      : B7.FolhaLinha.documentoMedidoHTML(ctx, area);
    await B7.Slides.esperarPronto(area);
    area.querySelectorAll('.le-folha, .slide').forEach(f => B7.Folha.ajustar(f));
    estado.paginas = [...area.querySelectorAll('.slide, .folha')].map(el => el.outerHTML);
    area.innerHTML = guardado;
    area.style.display = '';
    area.classList.remove('modo-slides');

    /* ------------------------------------------------------ tela cheia
       Apresentar de verdade é a tela toda, como no PowerPoint: sem barra
       do navegador, sem sistema em volta. A API de fullscreen só funciona
       a partir de um gesto do usuário (clique/tecla), nunca sozinha — por
       isso é pedida no clique de "Apresentar"/"Tela cheia", e uma recusa
       (permissão, iframe sem allow, navegador antigo) só mantém a
       apresentação como overlay, sem quebrar nada. */
    const pedirTelaCheia = el =>
      (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen || (() => Promise.reject()))
        .call(el);
    const sairTelaCheia = () =>
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || (() => {}))
        .call(document);
    const emTelaCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

    const btTelaCheia = caixa.querySelector('[data-telacheia]');
    let esteveCheia = false, fechado = false;
    function pintarBotaoTelaCheia() {
      if (fechado) return;
      const dentro = emTelaCheia();
      /* Na apresentação, sair da tela cheia (Esc do navegador) encerra a
         apresentação, como num programa de slides: não existe o estado
         "apresentando numa janelinha". Se o navegador nunca deixou entrar
         em tela cheia, ela segue como overlay e o botão continua ali. */
      if (opcoes.apresentacao && esteveCheia && !dentro) return fechar();
      if (dentro) {
        esteveCheia = true;
        /* Em tela cheia o Esc é do navegador: ele sai da tela cheia sem
           avisar a página — e, com um detalhe aberto, isso encerraria a
           apresentação inteira em vez de fechar só o detalhe. Onde o
           navegador permite (Chrome, Edge), a tecla é reservada para a
           página: um toque fecha o detalhe (ou a apresentação, se não há
           detalhe); segurar Esc continua saindo da tela cheia. */
        try { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); } catch (e) {}
      }
      btTelaCheia.textContent = dentro ? 'Sair da tela cheia' : 'Tela cheia';
      btTelaCheia.setAttribute('aria-label', dentro ? 'Sair da tela cheia' : 'Entrar em tela cheia');
      btTelaCheia.style.display = (opcoes.apresentacao && dentro) ? 'none' : '';   /* lá, sair = Fechar */
      caixa.classList.toggle('tela-cheia', dentro);
      acordar();
      escalar();   /* a área útil mudou: o slide precisa reescalar */
    }

    /* Em tela cheia os controles somem quando o mouse para (como num
       player) e voltam ao primeiro movimento: a tela é só o slide. */
    let relogioOcioso = null;
    function acordar() {
      caixa.classList.remove('ocioso');
      clearTimeout(relogioOcioso);
      relogioOcioso = setTimeout(() => {
        if (fechado || !emTelaCheia()) return;
        if (caixa.querySelector('.pv-det, .fundo-modal:not(.saindo), .menu.aberto,.preview-topo:hover, .preview-nav:hover, .preview-seta:hover')) return acordar();
        caixa.classList.add('ocioso');
      }, 2600);
    }
    caixa.addEventListener('mousemove', acordar);
    caixa.addEventListener('touchstart', acordar, { passive: true });
    btTelaCheia.onclick = () => {
      if (emTelaCheia()) sairTelaCheia();
      else Promise.resolve(pedirTelaCheia(caixa)).catch(() => {
        B7.UI.toast('Este navegador não permitiu a tela cheia — a apresentação segue nesta janela.');
      });
    };
    /* O navegador sai da tela cheia por conta própria (Esc nativo, F11,
       troca de aba). Escutar o evento é a única forma de manter o botão e
       a escala coerentes — não dá pra confiar só no nosso clique. */
    document.addEventListener('fullscreenchange', pintarBotaoTelaCheia);
    document.addEventListener('webkitfullscreenchange', pintarBotaoTelaCheia);

    function fechar() {
      if (fechado) return;
      fechado = true;
      clearTimeout(relogioOcioso);
      document.removeEventListener('fullscreenchange', pintarBotaoTelaCheia);
      document.removeEventListener('webkitfullscreenchange', pintarBotaoTelaCheia);
      window.removeEventListener('resize', escalar);
      document.removeEventListener('keydown', tecla);
      try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); } catch (e) {}
      if (emTelaCheia()) Promise.resolve(sairTelaCheia()).catch(() => {});
      caixa.remove();
    }
    /* Um detalhe read-only (clique num item) abre por cima como modal
       comum (B7.UI.modal, que também escuta Esc) — quando ele está
       aberto, Esc precisa fechar só o detalhe, não a apresentação
       inteira por baixo. */
    const tecla = e => {
      if (document.querySelector('.fundo-modal:not(.saindo)')) return;
      const det = caixa.querySelector('.pv-det');
      if (det) { if (det.b7Tecla) det.b7Tecla(e); return; }
      const noBotao = e.target && e.target.closest && e.target.closest('button, a, input, select, textarea');
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(-1);
      else if ((e.key === ' ' || e.key === 'Enter') && !noBotao) { e.preventDefault(); ir(1); }
      else if (e.key === 'Home') ir(-estado.paginas.length);
      else if (e.key === 'End') ir(estado.paginas.length);
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
      const novo = Math.max(0, Math.min(estado.paginas.length - 1, estado.i + d));
      if (novo === estado.i) return;   /* já está na ponta: não anima à toa */
      estado.i = novo;
      desenhar(d > 0 ? 'avanca' : 'volta');
    }
    /* A troca é uma TRANSIÇÃO entre dois slides, não um slide piscando:
       cada slide vive numa camada própria. Na navegação, a camada antiga
       continua na tela e sai (recua e escurece) enquanto a nova entra por
       cima, vinda do lado para onde a apresentação está indo. Só depois
       que a nova assenta é que o conteúdo dela se apresenta, em cascata.
       O primeiro desenho não tem direção: a capa abre. Navegar rápido não
       acumula camadas: a que ainda estava saindo é retirada na hora.
       Quem pediu menos movimento no sistema recebe a troca seca. */
    function desenhar(direcao) {
      const alvo = caixa.querySelector('#preview-in');
      const animar = ehSlides && !menosMovimento();
      alvo.querySelectorAll('.pv-camada.saindo').forEach(c => c.remove());
      const antiga = alvo.querySelector('.pv-camada');
      const nova = document.createElement('div');
      nova.className = 'pv-camada';
      nova.innerHTML = estado.paginas[estado.i] || '';
      alvo.appendChild(nova);
      if (antiga) {
        if (direcao && animar) {
          antiga.className = 'pv-camada saindo sai-' + direcao;
          nova.classList.add('entra-' + direcao);
          const tirar = () => antiga.remove();
          antiga.addEventListener('animationend', e => { if (e.target === antiga) tirar(); });
          setTimeout(tirar, 1200);   /* rede de segurança se o evento não vier */
        } else antiga.remove();
      } else if (animar) nova.classList.add('entra-abre');
      if (ehSlides) encenar(nova, animar ? (direcao ? 360 : 260) : 0);

      caixa.querySelector('#preview-cont').textContent =
        (estado.i + 1) + ' / ' + estado.paginas.length;
      caixa.querySelector('.preview-prog i').style.setProperty('--p',
        estado.paginas.length > 1 ? estado.i / (estado.paginas.length - 1) : 1);
      caixa.querySelectorAll('[data-ant],[data-ant2]').forEach(b => b.disabled = estado.i === 0);
      caixa.querySelectorAll('[data-prox],[data-prox2]').forEach(b => b.disabled = estado.i >= estado.paginas.length - 1);
      escalar();
      ligarDetalhe(nova, ctx, caixa);
    }
    function escalar() {
      const dentro = caixa.querySelector('#preview-in');
      const camada = dentro.lastElementChild;
      const pagina = camada && camada.firstElementChild;
      if (!pagina) return;
      /* em tela cheia o slide ocupa a tela inteira, sem moldura em volta */
      const cheia = ehSlides && caixa.classList.contains('tela-cheia');
      const f = Math.min(
        (palco.clientWidth - (cheia ? 0 : 100)) / pagina.offsetWidth,
        (palco.clientHeight - (cheia ? 0 : 40)) / pagina.offsetHeight);
      dentro.style.transform = 'scale(' + f + ')';
      dentro.style.width = pagina.offsetWidth + 'px';
      dentro.style.height = pagina.offsetHeight + 'px';
    }
    window.addEventListener('resize', escalar);
    desenhar();
    /* depois do primeiro desenho: se já entrou em tela cheia lá em cima,
       o botão precisa nascer dizendo "Sair da tela cheia" e o palco já
       escalado para a tela inteira */
    pintarBotaoTelaCheia();
  }

  /* ------------------------------------------------------- encenação
     Distribui a entrada dos elementos do slide na ordem de leitura. A
     lista de seletores é lida num querySelectorAll só, de propósito: o
     DOM devolve em ordem de documento, que é justamente a ordem em que a
     pessoa lê o slide — cabeçalho, número da seção, título, e então o
     conteúdo. Nada de ordenar à mão por tipo.

     Um elemento cujo ancestral já vai animar é PULADO: animar pai e
     filho ao mesmo tempo multiplica opacidades e faz o filho piscar duas
     vezes. Por isso `.sl-pilar` entra inteiro, e não cada pedaço dele.

     Só o palco da apresentação passa por aqui. As exportações montam o
     slide em #area-impressao e capturam de lá, sem nenhuma destas
     classes — o PDF e o PNG não têm como sair com item apagado. */
  const ALVOS_ANIMADOS = [
    /* Cabeçalho: os filhos entram um a um, e por isso `.sl-secao` (o
       contêiner deles) NÃO entra na lista — se entrasse, o filtro de
       aninhamento abaixo pularia os filhos e o cabeçalho inteiro
       apareceria de um golpe só, que é justamente o que se quer evitar
       na abertura do slide. */
    /* `.sl-topo` e `.sl-pe` (a moldura) também ficam de fora: a página
       que entra na transição precisa chegar com cara de slide, não como
       uma folha em branco. */
    '.sl-num', '.sl-kicker', '.sl-secao h2', '.sl-risco', '.sl-cont',
    /* capa: marca, olho, título (linha a linha), mês e cada dado */
    '.slide.escuro .marca', '.sl-capa .olho', '.sl-capa h1', '.sl-mes', '.sl-dados > div',
    /* blocos de conteúdo */
    '.sl-objetivo-hero', '.sl-objetivo-meta', '.sl-objetivo-apoio',
    '.sl-pos-grid > *', '.sl-campo',
    '.sl-numeros > div', '.sl-dist > div', '.sl-chips > span',
    '.sl-pilar', '.sl-barra-total',
    '.sl-tabela thead', '.sl-tabela tbody tr',
    '.sl-cri-topo', '.sl-cri-t', '.sl-slides .sl-slide', '.sl-txt', '.sl-links'
  ].join(',');

  /* Cada tipo de elemento chega do seu jeito — é isso que separa uma
     apresentação de uma página com fade: o número da seção gira e
     assenta, o título é revelado de baixo para cima, o risco é traçado,
     os cartões de pilar sobem com profundidade, as linhas de tabela
     entram pelo lado, os números contam. O primeiro seletor que casar
     decide; o que não casa com nenhum usa a entrada padrão (sl-ani). */
  const ENTRADAS = [
    ['.sl-num', 'sl-ani-num'],
    ['.sl-capa h1', 'sl-ani-linhas'],
    ['.sl-secao h2, .sl-cri-t', 'sl-ani-titulo'],
    ['.sl-risco', 'sl-ani-barra'],
    ['.sl-numeros > div', 'sl-ani-numero'],
    ['.sl-pilar, .sl-slides .sl-slide', 'sl-ani-carta'],
    ['.sl-tabela tbody tr, .sl-dist > div, .sl-objetivo-hero, .sl-kicker, .sl-capa .olho', 'sl-ani-lado'],
    ['.sl-chips > span', 'sl-ani-pop'],
    ['.sl-tabela thead, .slide.escuro .marca', 'sl-ani-fade']
  ];

  /* Ritmo: os primeiros itens respiram, o resto acelera — uma tabela de
     12 linhas com passo fixo levaria a apresentação inteira para
     terminar. O teto garante que nenhum slide passe de ~1s pra assentar,
     por mais itens que tenha. */
  function atrasoDe(i) {
    const passo = i < 4 ? 70 : i < 9 ? 45 : 26;
    const base = i < 4 ? 0 : i < 9 ? 280 : 505;
    const inicio = i < 4 ? 0 : i < 9 ? 4 : 9;
    return Math.min(base + (i - inicio) * passo, 1000);
  }

  /* Número que conta de zero até o valor ("12", "30%"), começando quando
     o elemento dele entra. A largura final é reservada antes, para o
     slide não "respirar" enquanto os dígitos mudam. */
  function contarAte(el, esperaMs) {
    const m = /^(\d+)(\D*)$/.exec(el.textContent.trim());
    if (!m || !+m[1]) return;
    const fim = +m[1], sufixo = m[2];
    const dono = el.closest('.sl-numeros > div') || el;
    dono.style.minWidth = dono.offsetWidth + 'px';
    const dur = Math.min(1200, 520 + fim * 14);
    const t0 = performance.now() + esperaMs;
    el.textContent = '0' + sufixo;
    (function passo(agora) {
      if (!el.isConnected) return;
      const p = Math.min(1, Math.max(0, (agora - t0) / dur));
      el.textContent = Math.round(fim * (1 - Math.pow(1 - p, 3))) + sufixo;
      if (p < 1) requestAnimationFrame(passo);
    })(performance.now());
    /* se o navegador segurar os quadros (aba em segundo plano), o valor
       final entra de qualquer jeito: número errado na tela, nunca */
    setTimeout(() => { if (el.isConnected) el.textContent = fim + sufixo; }, esperaMs + dur + 120);
  }

  /* `base` = quanto esperar antes de o primeiro item entrar: o tempo de
     a página nova assentar na transição. 0 = sem movimento (a troca foi
     seca), e aí nada é marcado: o slide aparece inteiro. */
  function encenar(camada, base) {
    const slide = camada.firstElementChild;
    if (!slide || !base) return;
    slide.style.setProperty('--base', base + 'ms');
    const marcados = [];
    let i = 0;
    slide.querySelectorAll(ALVOS_ANIMADOS).forEach(el => {
      if (marcados.some(m => m.contains(el))) return;   /* já anima junto com um ancestral */
      marcados.push(el);
      el.style.setProperty('--d', atrasoDe(i++) + 'ms');
      const tipo = ENTRADAS.find(par => el.matches(par[0]));
      el.classList.add(tipo ? tipo[1] : 'sl-ani');
    });
    const atraso = el => parseInt(el.style.getPropertyValue('--d'), 10) || 0;

    /* título da capa: cada linha sobe de trás de uma máscara, uma depois
       da outra — a quebra é a do próprio <br> do título */
    const h1 = slide.querySelector('.sl-capa h1.sl-ani-linhas');
    if (h1) {
      h1.innerHTML = h1.innerHTML.split(/<br\s*\/?>/i).map((t, k) =>
        '<span class="sl-linha"><span style="--k:' + k + '">' + t + '</span></span>').join('');
    }
    /* a logo do cliente fecha a capa: entra por último, com um salto */
    const logo = slide.querySelector('.sl-logo-cliente');
    if (logo) {
      logo.style.setProperty('--d', (marcados.length ? atraso(marcados[marcados.length - 1]) + 160 : 0) + 'ms');
      logo.classList.add('sl-ani-pop');
    }
    /* a linha que separa os dados da capa é traçada antes de eles subirem */
    const dados = slide.querySelector('.sl-dados');
    if (dados) {
      const primeiro = dados.querySelector('.sl-ani');
      dados.style.setProperty('--d', Math.max(0, (primeiro ? atraso(primeiro) : 0) - 120) + 'ms');
      dados.classList.add('sl-ani-traco');
    }
    /* as barras internas entram depois da linha que as contém, somando um
       atraso próprio à posição do item — parecem estar sendo preenchidas
       assim que a linha se assenta */
    slide.querySelectorAll('.sl-dist .ba i, .sl-barra-total > *').forEach((b, k) => {
      const linha = b.closest('.sl-ani, .sl-ani-lado, .sl-ani-numero');
      b.style.setProperty('--d', ((linha ? atraso(linha) : 0) + 140 + k * 70) + 'ms');
      b.classList.add('sl-ani-barra');
    });
    /* números contam: os grandes, o percentual de cada pilar e o total de
       cada formato */
    slide.querySelectorAll('.sl-numeros b, .sl-pilar .pct, .sl-dist > div > b').forEach(n => {
      const dono = n.closest('.sl-ani-numero, .sl-ani-carta, .sl-ani-lado');
      contarAte(n, base + (dono ? atraso(dono) : 0) + 80);
    });
  }

  /* ------------------------------------------------- interação (item 12)
     Clicar num item de conteúdo (linha da tabela de postagens, ou o
     cabeçalho de um slide de criativo) abre um detalhe read-only por
     cima, sem sair do slide atual. Só os campos reais do conteúdo. */
  function ligarDetalhe(area, ctx, caixa) {
    area.querySelectorAll('[data-cid]').forEach(el => el.onclick = () => abrirDetalheConteudo(el.dataset.cid, ctx, caixa, el));
  }

  /* O detalhe é uma peça da apresentação, não um modal do sistema: nasce
     DENTRO da caixa (em tela cheia o navegador só desenha o que está
     dentro do elemento em tela cheia), tem a cara dos slides e abre a
     partir da linha clicada — o cartão cresce de onde o clique aconteceu
     e o conteúdo entra em cascata. Dá para passar de um conteúdo para o
     outro sem fechar (setas), na mesma ordem da tabela de onde se veio:
     a de Criativos (ordem dos posts) ou a de Postagens (por data). */
  function abrirDetalheConteudo(id, ctx, caixa, origem) {
    const esc = B7.UI.esc;
    const todos = ctx.conteudos || [];
    const lista = (origem && origem.dataset.lista === 'post')
      ? todos.slice().sort((a, b) => String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')))
      : todos;
    let i = lista.findIndex(x => x.id === id);
    if (i < 0 || !caixa) return;
    const anterior = caixa.querySelector('.pv-det');
    if (anterior) anterior.remove();

    /* texto em parágrafos (uma quebra de linha = um parágrafo), com as
       hashtags destacadas quando é legenda */
    const texto = (v, tags) => String(v).split('\n').map(s => s.trim()).filter(Boolean).map(p => {
      let h = esc(p);
      if (tags) h = h.replace(/(^|\s)(#[\wÀ-ÿ]+)/g, '$1<span class="tag">$2</span>');
      return '<p>' + h + '</p>';
    }).join('');
    const tem = v => !!String(v || '').trim();
    const bloco = (rot, v, classe, tags) => !tem(v) ? '' :
      '<section class="pv-det-bloco' + (classe ? ' ' + classe : '') + '"><b>' + rot + '</b>' +
      '<div class="pv-det-txt">' + texto(v, tags) + '</div></section>';

    function miolo(c) {
      const pilar = (ctx.pilares || []).find(p => p.id === c.pilar_id);
      const dado = (rot, v) => !tem(v) ? '' : '<div><b>' + rot + '</b><span>' + esc(v) + '</span></div>';
      const corpo = bloco('OBJETIVO', c.objetivo) + bloco('IDEIA GERAL', c.ideia_geral) +
        bloco('LEGENDA', c.legenda, 'legenda', true);
      return '<aside class="pv-det-lado">' +
          '<div class="pv-det-brilho"></div>' +
          '<div class="pv-det-topo"><span class="pv-det-fmt">' + esc(String(c.tipo || 'Conteúdo').toUpperCase()) + '</span>' +
            '<span class="pv-det-pos">' + String(i + 1).padStart(2, '0') + ' / ' + String(lista.length).padStart(2, '0') + '</span></div>' +
          '<h3>' + esc(c.titulo || 'Sem título') + '</h3>' +
          '<div class="pv-det-dados">' +
            dado('DATA', c.data_postagem ? B7.UI.dataBR(c.data_postagem) : '') +
            dado('CANAL', c.canal) +
            dado('PILAR', pilar ? (pilar.nome || 'Pilar sem nome') : '') +
          '</div>' +
          (tem(c.cta) ? '<div class="pv-det-cta"><b>CHAMADA PARA AÇÃO</b><p>' + esc(String(c.cta).trim()) + '</p></div>' : '') +
        '</aside>' +
        '<div class="pv-det-corpo">' +
          (corpo || '<div class="pv-det-vazio">Este conteúdo ainda não tem objetivo, ideia geral nem legenda preenchidos.</div>') +
        '</div>';
    }

    const det = document.createElement('div');
    det.className = 'pv-det';
    det.setAttribute('role', 'dialog');
    det.setAttribute('aria-modal', 'true');
    det.innerHTML = '<div class="pv-det-fundo"></div>' +
      '<button class="pv-det-nav ant" aria-label="Conteúdo anterior">‹</button>' +
      '<div class="pv-det-cartao"><div class="pv-det-miolo">' + miolo(lista[i]) + '</div>' +
        '<button class="pv-det-x" aria-label="Fechar detalhe">×</button></div>' +
      '<button class="pv-det-nav prox" aria-label="Próximo conteúdo">›</button>';

    /* de onde o cartão nasce: o centro da linha clicada, medido em
       relação ao centro da tela (onde o cartão vai parar) */
    if (origem && origem.getBoundingClientRect) {
      const r = origem.getBoundingClientRect(), k = caixa.getBoundingClientRect();
      det.style.setProperty('--ox', Math.round(r.left + r.width / 2 - (k.left + k.width / 2)) + 'px');
      det.style.setProperty('--oy', Math.round(r.top + r.height / 2 - (k.top + k.height / 2)) + 'px');
      origem.classList.add('sl-ativo');
    }
    caixa.appendChild(det);

    const cartao = det.querySelector('.pv-det-cartao');
    const bAnt = det.querySelector('.pv-det-nav.ant'), bProx = det.querySelector('.pv-det-nav.prox');
    const pintarSetas = () => { bAnt.disabled = i === 0; bProx.disabled = i >= lista.length - 1; };
    pintarSetas();

    function trocar(d) {
      const novo = i + d;
      if (novo < 0 || novo >= lista.length) return;
      i = novo;
      const m = det.querySelector('.pv-det-miolo');
      m.className = 'pv-det-miolo';
      void m.offsetWidth;   /* reinicia a animação mesmo indo duas vezes para o mesmo lado */
      m.innerHTML = miolo(lista[i]);
      m.classList.add(d > 0 ? 'troca-avanca' : 'troca-volta');
      pintarSetas();
    }
    let fechando = false;
    function fechar() {
      if (fechando) return;
      fechando = true;
      if (origem) origem.classList.remove('sl-ativo');
      if (menosMovimento()) return det.remove();
      det.classList.add('saindo');
      setTimeout(() => det.remove(), 300);
    }
    det.querySelector('.pv-det-fundo').onclick = fechar;
    det.querySelector('.pv-det-x').onclick = fechar;
    bAnt.onclick = () => trocar(-1);
    bProx.onclick = () => trocar(1);
    /* quem recebe o teclado enquanto o detalhe está aberto (ver `tecla`
       em abrir): Esc fecha só o detalhe, as setas trocam de conteúdo */
    det.b7Tecla = e => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') trocar(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') trocar(-1);
    };
    /* toque: arrastar para o lado troca de conteúdo */
    let tx = null;
    cartao.addEventListener('touchstart', e => { tx = e.touches.length ? e.touches[0].clientX : null; }, { passive: true });
    cartao.addEventListener('touchend', e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 70) trocar(dx < 0 ? 1 : -1);
    }, { passive: true });
    try { det.querySelector('.pv-det-x').focus({ preventScroll: true }); } catch (e) {}
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
