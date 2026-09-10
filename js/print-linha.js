/* =====================================================================
   DOCUMENTO DA LINHA EDITORIAL
   Mesmo DNA visual das fichas de roteiro (marca, tipografia, faixas,
   margens), mas composição própria: aqui o assunto é o mês, não a cena.

   Duas regras que valem para o arquivo inteiro:
   • Campo vazio não aparece. Sem CTA, sem "CTA: —"; sem período, sem
     linha de período. O documento tem que parecer intencional.
   • A folha é sempre clara, mesmo com o sistema em dark mode. Os tokens
     são redefinidos dentro de .folha em print.css.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.FolhaLinha = (function () {
  const esc = B7.UI.esc;
  const MARCA = 'assets/brand/symbol-color.png';
  const LOGO  = 'assets/brand/logo-white.png';
  const MESES = B7.UI.MESES;

  const vazio = t => !String(t || '').trim();
  const paragrafos = txt => String(txt || '').split('\n').map(s => s.trim()).filter(Boolean)
    .map(p => '<p>' + esc(p) + '</p>').join('');

  /* um campo só existe no documento se tiver conteúdo */
  const bloco = (rot, valor) => vazio(valor) ? '' :
    '<div class="le-campo"><b>' + rot + '</b><div class="le-txt">' + paragrafos(valor) + '</div></div>';

  const ICONE = { Reel: '▶', Card: '▣', Carrossel: '❯', Story: '⬍' };

  function cabeca(sub) {
    return '<div class="faixa-topo"></div>' +
      '<div class="folha-cabeca"><div class="esq"><img src="' + MARCA + '" alt="">' +
      '<span>B7 &nbsp;/&nbsp; BRANDING7</span></div>' +
      '<div class="dir">' + esc(sub) + '</div></div>';
  }
  function pe(num, rot) {
    return '<div class="folha-pe"><div class="esq">B7 / BRANDING7 &nbsp;·&nbsp; ' + esc(rot) + '</div>' +
      '<div class="dir">' + String(num).padStart(2, '0') + '</div></div>';
  }

  const periodo = l => (l.periodo_inicio && l.periodo_fim)
    ? B7.UI.dataBR(l.periodo_inicio) + ' a ' + B7.UI.dataBR(l.periodo_fim) : '';

  /* ------------------------------------------------------------ CAPA */
  function capaHTML(ctx) {
    const l = ctx.linha;
    return '<div class="folha abertura le-capa">' +
      '<div class="brilho"></div>' +
      '<img class="marca" src="' + LOGO + '" alt="B7">' +
      (ctx.clienteLogo ? '<div class="le-logo-cliente"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>' : '') +
      '<div class="miolo">' +
        '<div class="olho"><i></i>PLANEJAMENTO DE CONTEÚDO</div>' +
        '<h1>Linha<br>Editorial</h1>' +
        '<div class="le-mes">' + esc((MESES[l.mes - 1] || '').toUpperCase()) + ' ' + esc(String(l.ano)) + '</div>' +
        '<div class="dados">' +
          '<div class="cel"><b>CLIENTE</b><span>' + esc(l.cliente_nome || '—') + '</span></div>' +
          (periodo(l) ? '<div class="cel"><b>PERÍODO</b><span>' + esc(periodo(l)) + '</span></div>' : '') +
          (ctx.conteudos.length ? '<div class="cel"><b>CONTEÚDOS</b><span>' +
            ctx.conteudos.length + '</span></div>' : '') +
        '</div>' +
      '</div></div>';
  }

  /* Título de seção: o mesmo bloco visual de sempre (numeração grande em
     outline, kicker, risco). A diferença é que agora ele é um bloco que
     pode aparecer no meio de uma folha, em vez de exigir folha própria. */
  /* Cada linha do campo vira um item. Sem inventar título de página: o
     documento mostra o link como a equipe escreveu. */
  function linksHTML(rotulo, texto) {
    const linhas = String(texto || '').split('\n').map(x => x.trim()).filter(Boolean);
    if (!linhas.length) return '';
    return '<div class="le-campo"><b>' + rotulo + '</b><div class="le-links">' +
      linhas.map(x => '<span>' + esc(x) + '</span>').join('') + '</div></div>';
  }

  function tituloSecao(num, kicker, titulo) {
    return '<div class="titulo-bloco"><div class="numero">' + String(num).padStart(2, '0') + '</div>' +
      '<div class="titulo-dir"><div class="kicker"><i></i>' + esc(kicker) + '</div>' +
      '<h2>' + esc(titulo) + '</h2><div class="risco-titulo"></div></div></div>';
  }

  /* Abertura compacta: usada quando a capa é dispensada. Mantém a marca e
     a identificação, sem gastar uma página inteira. */
  function aberturaCompacta(ctx) {
    const l = ctx.linha;
    return '<div class="le-abertura-c">' +
      '<div class="le-ac-esq"><div class="olho"><i></i>PLANEJAMENTO DE CONTEÚDO</div>' +
      '<h1>Linha Editorial</h1>' +
      '<div class="le-ac-mes">' + esc((MESES[l.mes - 1] || '').toUpperCase()) + ' ' + esc(String(l.ano)) + '</div></div>' +
      '<div class="le-ac-dir"><b>CLIENTE</b><span>' + esc(l.cliente_nome || '') + '</span></div>' +
      '</div>';
  }

  /* --------------------------------------------- VISÃO GERAL + OBJETIVO
     Devolve uma lista de blocos. Cada um é indivisível; a paginação decide
     onde eles caem. Um bloco vazio simplesmente não entra na lista, então
     não existe "seção sem conteúdo ocupando página". */
  function blocosVisao(ctx, num) {
    const l = ctx.linha;
    const porFormato = {};
    ['Reel', 'Card', 'Carrossel', 'Story'].forEach(f => {
      const n = ctx.conteudos.filter(c => c.tipo === f).length;
      if (n) porFormato[f] = n;
    });
    const formatos = Object.keys(porFormato);
    const canais = (l.canais || '').split(',').map(x => x.trim()).filter(Boolean);

    const numeros = [
      ctx.conteudos.length ? [ctx.conteudos.length, ctx.conteudos.length === 1 ? 'CONTEÚDO' : 'CONTEÚDOS'] : null,
      canais.length ? [canais.length, canais.length === 1 ? 'CANAL' : 'CANAIS'] : null,
      l.meta_conteudos ? [l.meta_conteudos, 'META'] : null
    ].filter(Boolean);

    const corpo =
      (numeros.length ? '<div class="le-numeros">' + numeros.map(([n, r]) =>
        '<div><b>' + n + '</b><span>' + r + '</span></div>').join('') + '</div>' : '') +
      (periodo(l) ? '<div class="le-campo"><b>PERÍODO</b><div class="le-txt"><p>' +
        esc(periodo(l)) + '</p></div></div>' : '') +
      (canais.length ? '<div class="le-campo"><b>CANAIS</b><div class="le-chips">' +
        canais.map(c => '<span>' + esc(c) + '</span>').join('') + '</div></div>' : '') +
      /* barra de distribuição só quando há mais de um formato: uma barra
         sozinha dizendo "1 Reel" não informa nada */
      (formatos.length > 1 ? '<div class="le-campo"><b>DISTRIBUIÇÃO POR FORMATO</b>' +
        '<div class="le-dist">' + formatos.map(f =>
          '<div class="le-dist-l"><span class="r">' + esc(f) + '</span>' +
          '<span class="ba"><i style="width:' +
            (porFormato[f] / Math.max.apply(null, Object.values(porFormato)) * 100) + '%"></i></span>' +
          '<b>' + porFormato[f] + '</b></div>').join('') + '</div></div>' : '') +
      bloco('OBJETIVO PRINCIPAL', l.objetivo) +
      bloco('O QUE A ESTRATÉGIA PRETENDE GERAR', l.objetivo_detalhe) +
      bloco('OBSERVAÇÕES', l.observacoes) +
      linksHTML('REFERÊNCIAS DO MÊS', l.referencias);

    const posicionamento =
      bloco('A MARCA SE POSICIONA COMO', l.posicionamento) +
      bloco('TOM DE VOZ', l.tom_voz) +
      bloco('PROPOSTA ÚNICA DE VALOR', l.puv) +
      bloco('PERCEPÇÃO DESEJADA', l.percepcao);

    const blocos = [];
    if (corpo) {
      blocos.push({ secao: 'LINHA EDITORIAL', titulo: true,
                    html: tituloSecao(num, (MESES[l.mes - 1] || '').toUpperCase() + ' ' + l.ano,
                                      'Visão geral') });
      blocos.push({ secao: 'LINHA EDITORIAL', html: corpo });
    }
    if (posicionamento) {
      blocos.push({ secao: 'POSICIONAMENTO',
                    html: '<div class="le-sub">POSICIONAMENTO</div>' + posicionamento });
    }
    return blocos;
  }

  /* --------------------------------------------------------- PILARES
     "ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO": barra com a proporção
     planejada, depois um bloco por pilar (indivisível, para a paginação
     não cortar um pilar ao meio). Real × planejado entra quando a linha
     já tem conteúdos. */
  const nomePilar = (ctx, id) => {
    const p = id && (ctx.pilares || []).find(x => x.id === id);
    return p ? (p.nome || 'Pilar sem nome') : '';
  };
  function blocosPilares(ctx, num) {
    const pilares = (ctx.pilares || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    if (!pilares.length) return [];
    const pct = p => Math.max(0, +p.percentual || 0);
    const soma = pilares.reduce((s, p) => s + pct(p), 0);
    const base = +ctx.linha.meta_conteudos || ctx.conteudos.length;
    const planejados = p => Math.round(base * pct(p) / 100);
    const reais = p => ctx.conteudos.filter(c => c.pilar_id === p.id).length;

    const blocos = [{ secao: 'PILARES', titulo: true,
      html: tituloSecao(num, 'ESTRATÉGIA BASEADA NOS PILARES DE CONTEÚDO', 'Pilares de conteúdo') }];

    if (soma > 0) {
      blocos.push({ secao: 'PILARES',
        html: '<div class="le-barra-total">' + pilares.map((p, i) =>
          '<i class="f' + (i % 4) + '" style="width:' + (pct(p) / Math.max(100, soma) * 100) + '%"></i>').join('') +
          '</div>' +
          '<div class="le-pilar-legenda">' + pilares.map((p, i) =>
            '<span><i class="f' + (i % 4) + '"></i>' + esc(p.nome || 'Pilar ' + (i + 1)) + ' · ' + pct(p) + '%</span>').join('') +
          (Math.round(soma) !== 100 ? '<span class="soma">soma ' + (Math.round(soma * 100) / 100) + '%</span>' : '') +
          '</div>' });
    }

    pilares.forEach((p, i) => {
      blocos.push({ secao: 'PILARES',
        html: '<div class="le-pilar"><div class="le-pilar-n">' + String(i + 1).padStart(2, '0') + '</div>' +
          '<div class="le-pilar-c"><div class="le-pilar-topo">' +
            '<h3>' + esc(p.nome || 'Pilar sem nome') + '</h3>' +
            (pct(p) ? '<span class="pct">' + pct(p) + '%</span>' : '') +
            (p.funil ? '<span class="fun">' + esc(String(p.funil).toUpperCase()) + ' DE FUNIL</span>' : '') +
            (ctx.conteudos.length ? '<span class="rf">' + reais(p) + ' de ' + planejados(p) +
              ' conteúdo' + (planejados(p) === 1 ? '' : 's') + ' planejado' + (planejados(p) === 1 ? '' : 's') + '</span>' : '') +
          '</div>' +
          bloco('OBJETIVO', p.objetivo) + bloco('OBSERVAÇÕES', p.observacoes) +
          '</div></div>' });
    });
    return blocos;
  }

  /* ------------------------------------------------------- CRIATIVOS
     Um bloco por conteúdo. A distinção entre formatos é por ícone e
     rótulo — não por quatro sistemas visuais diferentes. */
  function criativoHTML(c, i, ctx) {
    const roteiro = c.script_id ? ctx.roteiros[c.script_id] : null;

    let especifico = '';
    if (c.tipo === 'Card') {
      especifico = bloco('HEADLINE', c.headline) + bloco('SUB-HEADLINE', c.sub_headline) +
        bloco('DIREÇÃO VISUAL', c.direcao) + bloco('LEGENDA', c.legenda) +
        bloco('OBSERVAÇÃO PARA O DESIGN', c.observacao_design);
    }
    if (c.tipo === 'Carrossel') {
      /* Sem Headline nem CTA separados: o Slide 1 é a abertura e o último
         slide é o CTA. Registros antigos que ainda têm c.headline/c.cta
         preenchidos (de antes desta mudança) continuam aparecendo — como
         conteúdo do próprio slide 1/último, só se o slide estiver vazio,
         nunca apagando nada do que já foi salvo. */
      const slides = (ctx.slides[c.id] || []);
      especifico = (slides.length ? '<div class="le-campo"><b>SLIDES</b><div class="le-slides">' +
          slides.map((s, n) => {
            const ultimo = n === slides.length - 1, unico = slides.length === 1;
            const legadoAbertura = n === 0 && vazio(s.titulo) && vazio(s.texto) ? c.headline : '';
            const legadoCta = ultimo && vazio(s.titulo) && vazio(s.texto) ? c.cta : '';
            const texto = s.texto || legadoAbertura || legadoCta;
            return '<div class="le-slide"><span>' + String(n + 1).padStart(2, '0') +
              (unico ? ' · CAPA · CTA' : n === 0 ? ' · CAPA' : ultimo ? ' · CTA' : '') + '</span>' +
              (vazio(s.titulo) ? '' : '<b>' + esc(s.titulo) + '</b>') +
              (vazio(texto) ? '' : '<div class="le-txt">' + paragrafos(texto) + '</div>') +
            '</div>';
          }).join('') + '</div></div>'
        : (vazio(c.headline) ? '' : bloco('CAPA / HEADLINE (registro antigo)', c.headline))) +
        bloco('LEGENDA', c.legenda);
    }
    if (c.tipo === 'Story') {
      const frames = (ctx.frames[c.id] || []);
      especifico = frames.length ? '<div class="le-campo"><b>SEQUÊNCIA</b><div class="le-slides">' +
        frames.map((f, n) => '<div class="le-slide"><span>STORY ' + String(n + 1).padStart(2, '0') + '</span>' +
          (vazio(f.texto) ? '' : '<div class="le-txt">' + paragrafos(f.texto) + '</div>') +
          (vazio(f.direcao_visual) ? '' : '<div class="le-dir">' + esc(f.direcao_visual) + '</div>') +
        '</div>').join('') + '</div></div>' : '';
    }
    if (c.tipo === 'Reel') {
      especifico = bloco('HEADLINE', c.headline);
      /* A linha editorial apresenta o que será produzido; o roteiro completo
         vive na ficha de gravação. Aqui entra só o título do que está
         vinculado — e nem isso, se for igual ao título do conteúdo. */
      if (roteiro && !vazio(roteiro.titulo) &&
          roteiro.titulo.trim().toLowerCase() !== String(c.titulo || '').trim().toLowerCase()) {
        especifico += '<div class="le-campo"><b>ROTEIRO</b><div class="le-txt"><p>' +
          esc(roteiro.titulo) + '</p></div></div>';
      }
    }

    return '<div class="le-criativo">' +
      '<div class="le-cri-topo">' +
        '<span class="le-cri-n">POST ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="le-cri-f"><i>' + ICONE[c.tipo] + '</i>' + esc(c.tipo.toUpperCase()) + '</span>' +
        (c.data_postagem ? '<span class="le-cri-d">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span>' : '') +
        (nomePilar(ctx, c.pilar_id) ? '<span class="le-cri-p">' + esc(nomePilar(ctx, c.pilar_id)) + '</span>' : '') +
      '</div>' +
      '<h3 class="' + (vazio(c.titulo) ? 'fraco' : '') + '">' + esc(c.titulo || 'Sem título') + '</h3>' +
      bloco('OBJETIVO', c.objetivo) +
      bloco('IDEIA GERAL', c.ideia_geral) +
      especifico +
      (c.tipo === 'Carrossel' ? '' : bloco('CTA', c.cta)) +
      linksHTML('REFERÊNCIAS', c.referencias) +
    '</div>';
  }

  /* --------------------------------------------------------- BLOCOS
     Cada criativo é um bloco. A folha recebe quantos couberem. */
  function blocosCriativos(ctx, num) {
    if (!ctx.conteudos.length) return [];
    const blocos = [{ secao: 'CRIATIVOS', titulo: true,
      html: tituloSecao(num, ctx.conteudos.length + ' CONTEÚDO' +
        (ctx.conteudos.length === 1 ? '' : 'S'), 'Criativos') }];
    ctx.conteudos.forEach((c, i) =>
      blocos.push({ secao: 'CRIATIVOS', html: criativoHTML(c, i, ctx) }));
    return blocos;
  }

  /* A tabela é fatiada em pedaços de linhas para poder atravessar folhas
     sem cortar nenhuma linha ao meio. */
  function blocosTabela(ctx, num, porBloco) {
    if (!ctx.conteudos.length) return [];
    const ordenados = ctx.conteudos.slice().sort((a, b) =>
      String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));

    const comPilar = (ctx.pilares || []).length > 0;
    const cabecalho = '<tr><th>DATA</th><th>CANAL</th><th>FORMATO</th>' +
      (comPilar ? '<th>PILAR</th>' : '') + '<th>CONTEÚDO</th></tr>';
    const linha = c =>
      '<tr><td class="d">' + (c.data_postagem ? esc(B7.UI.dataBR(c.data_postagem)) : '') + '</td>' +
      '<td>' + esc(c.canal || '') + '</td>' +
      '<td>' + esc(c.tipo) + '</td>' +
      (comPilar ? '<td>' + esc(nomePilar(ctx, c.pilar_id)) + '</td>' : '') +
      '<td class="t">' + esc(c.titulo || 'Sem título') + '</td></tr>';

    const blocos = [{ secao: 'POSTAGENS', titulo: true,
      html: tituloSecao(num, 'TABELA DE POSTAGENS', 'Postagens') }];

    const tamanho = porBloco || 12;
    for (let i = 0; i < ordenados.length; i += tamanho) {
      blocos.push({ secao: 'POSTAGENS',
        html: '<table class="le-tabela"><thead>' + cabecalho + '</thead><tbody>' +
              ordenados.slice(i, i + tamanho).map(linha).join('') + '</tbody></table>' });
    }
    return blocos;
  }

  /* ------------------------------------------------------- PAGINAÇÃO
     A regra antiga era "cada seção começa numa folha nova", e por isso um
     mês com um único conteúdo gerava três páginas quase vazias. Agora os
     blocos são empilhados na mesma folha enquanto couberem, medindo de
     verdade no DOM. Só se abre folha nova quando a atual estoura. */
  function montarFolhas(ctx, blocos, area) {
    if (!blocos.length) return '';

    const medidor = document.createElement('div');
    medidor.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    (area || document.body).appendChild(medidor);

    const folha = (conteudo, secao, num) =>
      '<div class="folha le-folha" data-secao="' + esc(secao) + '">' + cabeca(secao) +
      '<div class="folha-corpo">' + conteudo + '</div>' + pe(num, secao) +
      '<div class="aviso-overflow">PASSOU DA PÁGINA — REDUZA A FONTE (A−)</div></div>';

    const cabe = (conteudo, secao, num) => {
      medidor.innerHTML = folha(conteudo, secao, num);
      const f = medidor.querySelector('.folha');
      const corpo = f.querySelector('.folha-corpo');
      return corpo.scrollHeight <= corpo.clientHeight + 2 && !B7.Folha.estourou(f);
    };

    const folhas = [];
    let atual = '', secaoAtual = blocos[0].secao;

    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      const tentativa = atual + b.html;

      /* Um título de seção não pode terminar a folha sozinho: só entra se o
         primeiro bloco da seção couber junto com ele. Senão, os dois vão
         para a folha seguinte. */
      if (b.titulo && blocos[i + 1] && atual) {
        if (!cabe(tentativa + blocos[i + 1].html, secaoAtual, folhas.length + 1)) {
          folhas.push({ html: atual, secao: secaoAtual });
          atual = b.html;
          secaoAtual = b.secao;
          continue;
        }
      }

      if (cabe(tentativa, secaoAtual, folhas.length + 1)) { atual = tentativa; continue; }

      if (atual) {
        folhas.push({ html: atual, secao: secaoAtual });
        atual = b.html;
        secaoAtual = b.secao;
        /* um bloco sozinho maior que a folha fica sozinho mesmo: a escala
           automática da folha cuida do resto, sem cortar texto */
        if (!cabe(atual, secaoAtual, folhas.length + 1)) {
          folhas.push({ html: atual, secao: secaoAtual });
          atual = '';
        }
      } else {
        folhas.push({ html: b.html, secao: b.secao });
        atual = '';
      }
      if (!atual && blocos[i + 1]) secaoAtual = blocos[i + 1].secao;
    }
    if (atual) folhas.push({ html: atual, secao: secaoAtual });
    medidor.remove();

    return folhas.map((f, i) => folha(f.html, f.secao, i + 1)).join('');
  }

  /* Lista completa de blocos do documento, na ordem editorial. */
  function blocosDocumento(ctx) {
    let num = 1;
    let blocos = [];
    if (!ctx.incluirCapa) {
      blocos.push({ secao: 'LINHA EDITORIAL', html: aberturaCompacta(ctx) });
    }
    const visao = blocosVisao(ctx, num);
    if (visao.length) { blocos = blocos.concat(visao); num++; }
    const pil = blocosPilares(ctx, num);
    if (pil.length) { blocos = blocos.concat(pil); num++; }
    const cri = blocosCriativos(ctx, num);
    if (cri.length) { blocos = blocos.concat(cri); num++; }
    const tab = blocosTabela(ctx, num);
    if (tab.length) blocos = blocos.concat(tab);
    return blocos;
  }

  /* documento com paginação medida — é o usado na geração real */
  function documentoMedidoHTML(ctx, area) {
    return (ctx.incluirCapa ? capaHTML(ctx) : '') +
           montarFolhas(ctx, blocosDocumento(ctx), area);
  }

  /* Versão sem medição, para quando não há DOM (testes, prévia rápida).
     Aproxima por quantidade de blocos em vez de medir. */
  function documentoHTML(ctx) {
    const blocos = blocosDocumento(ctx);
    let html = ctx.incluirCapa ? capaHTML(ctx) : '';
    const POR_FOLHA = 3;
    for (let i = 0; i < blocos.length; i += POR_FOLHA) {
      const g = blocos.slice(i, i + POR_FOLHA);
      html += '<div class="folha le-folha">' + cabeca(g[0].secao) +
        '<div class="folha-corpo">' + g.map(x => x.html).join('') + '</div>' +
        pe(Math.floor(i / POR_FOLHA) + 1, g[0].secao) + '</div>';
    }
    return html;
  }

  return { documentoHTML, documentoMedidoHTML, montarFolhas, blocosDocumento,
           blocosVisao, blocosPilares, blocosCriativos, blocosTabela, criativoHTML,
           tituloSecao, aberturaCompacta, capaHTML };
})();

/* =====================================================================
   DOWNLOAD DA LINHA EDITORIAL
   Usa o mesmo caminho do Download Center que já existe: monta as folhas
   em #area-impressao e manda para o navegador.
   ===================================================================== */
B7.BaixarLinha = (function () {
  const esc = B7.UI.esc;

  /* Um único reunir para os dois formatos: A4 e apresentação leem o mesmo
     conteúdo do Supabase. Nada é duplicado. */
  async function reunir(linhaId, opcoes) {
    opcoes = opcoes || {};
    const linha = await B7.DB.linha(linhaId);
    const [conteudos, cliente, pilares] = await Promise.all([
      B7.DB.listarConteudos(linhaId), B7.DB.cliente(linha.client_id),
      B7.DB.listarPilares(linhaId).catch(() => [])
    ]);

    const slides = {}, frames = {}, roteiros = {};
    for (const c of conteudos) {
      if (c.tipo === 'Carrossel') slides[c.id] = await B7.DB.listarSlides(c.id).catch(() => []);
      if (c.tipo === 'Story') frames[c.id] = await B7.DB.listarFrames(c.id).catch(() => []);
      /* só o roteiro, sem as cenas: a linha editorial mostra o título e
         nada mais — o texto do vídeo vive na ficha de gravação */
      if (c.script_id) {
        const r = await B7.DB.roteiro(c.script_id).catch(() => null);
        if (r) roteiros[r.id] = r;
      }
    }
    return {
      linha: linha, conteudos: conteudos, pilares: pilares || [], slides: slides, frames: frames,
      roteiros: roteiros, clienteLogo: cliente.logo_url || '',
      incluirCapa: opcoes.incluirCapa !== false
    };
  }

  /* ------------------------------------------------ modal de exportação */
  function abrir(linhaId) {
    const m = B7.UI.modal('<h3>Exportar linha editorial</h3>' +
      '<div class="sub">Os dois formatos usam o mesmo conteúdo salvo. Campos vazios ' +
      'não aparecem, e notas internas nunca entram.</div>' +

      '<label class="rot">FORMATO</label>' +
      '<div class="grade-formatos exp-formatos">' +
        '<button class="opcao-formato on" data-fmt="a4">' +
          '<b>Documento A4</b><small>vertical, para consulta, envio e impressão</small></button>' +
        '<button class="opcao-formato" data-fmt="slides">' +
          '<b>Apresentação 16:9</b><small>horizontal, para reunião e tela compartilhada</small></button>' +
      '</div>' +

      '<label class="op-copiar on" id="exp-capa" style="margin-top:14px">' +
        '<input type="checkbox" checked><span><b>Incluir capa</b>' +
        '<small>Sem capa, o documento abre com um cabeçalho compacto.</small></span></label>' +

      '<div class="acoes">' +
        '<button class="b" data-fecha>Cancelar</button>' +
        '<button class="b contorno" data-preview>Visualizar</button>' +
        '<button class="b pri" data-ok>Baixar PDF</button>' +
      '</div>');

    let formato = 'a4';
    m.querySelectorAll('[data-fmt]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-fmt]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      formato = b.dataset.fmt;
    });
    m.querySelector('#exp-capa input').onchange = e =>
      m.querySelector('#exp-capa').classList.toggle('on', e.target.checked);

    const opcoesAtuais = () => ({ incluirCapa: m.querySelector('#exp-capa input').checked });

    m.querySelector('[data-preview]').onclick = async () => {
      const btn = m.querySelector('[data-preview]');
      btn.disabled = true; btn.textContent = 'Preparando…';
      try {
        const ctx = await reunir(linhaId, opcoesAtuais());
        m.fechar();
        B7.PreviewLinha.abrir(ctx, formato);
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Visualizar';
        B7.UI.toast('Não foi possível preparar a visualização', { tipo: 'erro' });
      }
    };

    m.querySelector('[data-ok]').onclick = async () => {
      const btn = m.querySelector('[data-ok]');
      btn.disabled = true; btn.textContent = 'Preparando documento…';
      try {
        const ctx = await reunir(linhaId, opcoesAtuais());
        m.fechar();
        await gerar(ctx, formato);
      } catch (e) {
        console.error(e);
        btn.disabled = false; btn.textContent = 'Baixar PDF';
        B7.UI.toast('Não foi possível montar o documento', { tipo: 'erro' });
      }
    };
  }

  /* Monta as folhas em #area-impressao e entrega ao navegador — o mesmo
     caminho que o Download Center já usa para as fichas de roteiro. */
  /* O tamanho da página do PDF vem de @page, que não pode depender de uma
     classe no HTML. Então trocamos a regra na hora de gerar. */
  function definirPagina(slides) {
    let tag = document.getElementById('regra-pagina');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'regra-pagina';
      document.head.appendChild(tag);
    }
    tag.textContent = slides
      ? '@media print{@page{size:338.7mm 190.5mm;margin:0}}'
      : '@media print{@page{size:A4 portrait;margin:0}}';
  }

  function gerar(ctx, formato) {
    return new Promise((resolve, reject) => {
      try {
        const area = document.getElementById('area-impressao');
        const slides = formato === 'slides';
        definirPagina(slides);
        area.style.display = 'block';
        area.classList.toggle('modo-slides', slides);
        area.innerHTML = slides
          ? B7.Slides.documentoHTML(ctx, area)
          : B7.FolhaLinha.documentoMedidoHTML(ctx, area);
        area.querySelectorAll('.le-folha, .slide').forEach(f => B7.Folha.ajustar(f));
        area.style.display = '';
        setTimeout(() => {
          try { window.print(); } catch (e) { return reject(e); }
          setTimeout(() => {
            area.innerHTML = '';
            area.classList.remove('modo-slides');
            definirPagina(false);          /* volta ao A4 para não afetar as fichas */
          }, 800);
          resolve();
        }, 180);
      } catch (e) { reject(e); }
    });
  }

  return { abrir, reunir, gerar, definirPagina };
})();
