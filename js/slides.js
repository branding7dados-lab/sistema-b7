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

    /* ---- objetivo do mês ---- */
    const objetivo = campo('OBJETIVO PRINCIPAL', l.objetivo) +
                     campo('O QUE A ESTRATÉGIA PRETENDE GERAR', l.objetivo_detalhe);
    if (objetivo) {
      lista.push({ secao: 'OBJETIVO', num: null,
        html: abreSecao(secao++, rotulo(l).toUpperCase(), 'Objetivo do mês') +
              '<div class="sl-duas">' + objetivo + '</div>' });
    }

    /* ---- posicionamento ---- */
    const pos = campo('A MARCA SE POSICIONA COMO', l.posicionamento) +
                campo('TOM DE VOZ', l.tom_voz) +
                campo('PROPOSTA ÚNICA DE VALOR', l.puv) +
                campo('PERCEPÇÃO DESEJADA', l.percepcao);
    if (pos) {
      lista.push({ secao: 'POSICIONAMENTO', num: null,
        html: abreSecao(secao++, 'COMO A MARCA SE APRESENTA', 'Posicionamento') +
              '<div class="sl-duas">' + pos + '</div>' });
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

    /* ---- criativos: um slide por conteúdo, dividindo quando for longo ---- */
    if (ctx.conteudos.length) {
      lista.push({ abertura: true, secao: 'CRIATIVOS', num: null,
        html: abreSecao(secao++, ctx.conteudos.length + ' CONTEÚDO' +
          (ctx.conteudos.length === 1 ? '' : 'S'), 'Criativos') });
      ctx.conteudos.forEach((c, i) => slidesCriativo(c, i, ctx).forEach(x => lista.push(x)));
    }

    /* ---- postagens ---- */
    const comAlgo = ctx.conteudos.filter(c => c.data_postagem || c.canal);
    if (ctx.conteudos.length) {
      const ordenados = ctx.conteudos.slice().sort((a, b) =>
        String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));
      const POR_SLIDE = 8;   /* mais que isso vira letra miúda na projeção */
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
            parte.map(c => '<tr>' +
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

  /* Um criativo pode precisar de mais de um slide. Em vez de encolher a
     fonte, ele continua na parte seguinte. */
  function slidesCriativo(c, i, ctx) {
    const post = 'POST ' + String(i + 1).padStart(2, '0');
    const pilarDe = x => {
      const p = x.pilar_id && (ctx.pilares || []).find(y => y.id === x.pilar_id);
      return p ? (p.nome || 'Pilar sem nome') : '';
    };
    const cabecalho = (parte, total) =>
      '<div class="sl-cri-topo">' +
        '<span class="n">' + post + '</span>' +
        '<span class="f">' + esc(c.tipo.toUpperCase()) + '</span>' +
        (c.data_postagem ? '<span class="d">' + esc(B7.UI.dataBR(c.data_postagem)) + '</span>' : '') +
        (c.canal ? '<span class="d">' + esc(c.canal) + '</span>' : '') +
        (pilarDe(c) ? '<span class="d">' + esc(pilarDe(c)) + '</span>' : '') +
        (total > 1 ? '<span class="p">PARTE ' + parte + ' DE ' + total + '</span>' : '') +
      '</div>' +
      '<h3 class="sl-cri-t">' + esc(c.titulo || 'Sem título') + '</h3>';

    /* roteiro entra só pelo título, e nem isso se for igual ao do conteúdo */
    const roteiro = c.script_id ? ctx.roteiros[c.script_id] : null;
    const linhaRoteiro = (roteiro && !vazio(roteiro.titulo) &&
        roteiro.titulo.trim().toLowerCase() !== String(c.titulo || '').trim().toLowerCase())
      ? campo('ROTEIRO', roteiro.titulo) : '';

    const base = campo('OBJETIVO', c.objetivo) + campo('IDEIA GERAL', c.ideia_geral);

    if (c.tipo === 'Reel') {
      const corpo = base + campo('HEADLINE', c.headline) + linhaRoteiro + campo('CTA', c.cta) +
        links('REFERÊNCIAS', c.referencias);
      return [{ secao: 'CRIATIVOS', html: cabecalho(1, 1) + '<div class="sl-duas">' + corpo + '</div>' }];
    }

    if (c.tipo === 'Card') {
      const corpo = base + campo('HEADLINE', c.headline) + campo('SUB-HEADLINE', c.sub_headline) +
        campo('DIREÇÃO VISUAL', c.direcao) + campo('CTA', c.cta) + campo('LEGENDA', c.legenda) +
        links('REFERÊNCIAS', c.referencias);
      return [{ secao: 'CRIATIVOS', html: cabecalho(1, 1) + '<div class="sl-duas">' + corpo + '</div>' }];
    }

    if (c.tipo === 'Carrossel') {
      const slides = ctx.slides[c.id] || [];
      const POR = 6;
      const partes = Math.max(1, Math.ceil(slides.length / POR));
      const saida = [];
      for (let k = 0; k < partes; k++) {
        const grupo = slides.slice(k * POR, (k + 1) * POR);
        const corpo = (k === 0 ? base + campo('CAPA / HEADLINE', c.headline) : '') +
          (grupo.length ? '<div class="sl-slides">' + grupo.map((s, n) => {
            const idx = k * POR + n;
            return '<div class="sl-slide"><span>' + String(idx + 1).padStart(2, '0') +
              (idx === 0 ? ' · CAPA' : '') + '</span>' +
              (vazio(s.titulo) ? '' : '<b>' + esc(s.titulo) + '</b>') +
              (vazio(s.texto) ? '' : '<div class="sl-txt">' + paragrafos(s.texto) + '</div>') +
            '</div>';
          }).join('') + '</div>' : '') +
          (k === partes - 1 ? campo('CTA', c.cta) + campo('LEGENDA', c.legenda) : '');
        saida.push({ secao: 'CRIATIVOS', html: cabecalho(k + 1, partes) + corpo });
      }
      return saida;
    }

    /* Story */
    const frames = ctx.frames[c.id] || [];
    const POR = 6;
    const partes = Math.max(1, Math.ceil(frames.length / POR));
    const saida = [];
    for (let k = 0; k < partes; k++) {
      const grupo = frames.slice(k * POR, (k + 1) * POR);
      const corpo = (k === 0 ? base : '') +
        (grupo.length ? '<div class="sl-slides">' + grupo.map((f, n) =>
          '<div class="sl-slide"><span>STORY ' + String(k * POR + n + 1).padStart(2, '0') + '</span>' +
          (vazio(f.texto) ? '' : '<div class="sl-txt">' + paragrafos(f.texto) + '</div>') +
          (vazio(f.direcao_visual) ? '' : '<div class="sl-dir">' + esc(f.direcao_visual) + '</div>') +
          '</div>').join('') + '</div>' : '') +
        (k === partes - 1 ? campo('CTA', c.cta) : '');
      saida.push({ secao: 'CRIATIVOS', html: cabecalho(k + 1, partes) + corpo });
    }
    return saida;
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

  return { documentoHTML, slidesDo, capa, slide, contar };
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

  function abrir(ctx, formato) {
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
          '<button class="b p" data-baixar>Baixar PDF</button>' +
          '<button class="b p" data-fechar>Fechar</button>' +
        '</div>' +
      '</div>' +
      '<div class="preview-palco"><div class="preview-in" id="preview-in"></div></div>' +
      '<div class="preview-nav">' +
        '<button class="b p" data-ant>Anterior</button>' +
        '<span class="cont" id="preview-cont">—</span>' +
        '<button class="b p" data-prox>Próximo</button>' +
      '</div>';
    document.body.appendChild(caixa);

    /* monta as páginas de verdade, fora da tela, e depois mostra uma a uma */
    const area = document.getElementById('area-impressao');
    const guardado = area.innerHTML;
    area.style.display = 'block';
    area.classList.toggle('modo-slides', estado.formato === 'slides');
    area.innerHTML = estado.formato === 'slides'
      ? B7.Slides.documentoHTML(ctx)
      : B7.FolhaLinha.documentoMedidoHTML(ctx, area);
    area.querySelectorAll('.le-folha, .slide').forEach(f => B7.Folha.ajustar(f));
    estado.paginas = [...area.querySelectorAll('.slide, .folha')].map(el => el.outerHTML);
    area.innerHTML = guardado;
    area.style.display = '';
    area.classList.remove('modo-slides');

    const fechar = () => {
      caixa.remove();
      document.removeEventListener('keydown', tecla);
    };
    const tecla = e => {
      if (e.key === 'Escape') fechar();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(-1);
    };
    document.addEventListener('keydown', tecla);

    caixa.querySelector('[data-fechar]').onclick = fechar;
    caixa.querySelector('[data-ant]').onclick = () => ir(-1);
    caixa.querySelector('[data-prox]').onclick = () => ir(1);
    caixa.querySelector('[data-baixar]').onclick = async () => {
      fechar();
      await B7.BaixarLinha.gerar(ctx, estado.formato);
    };

    function ir(d) {
      estado.i = Math.max(0, Math.min(estado.paginas.length - 1, estado.i + d));
      desenhar();
    }
    function desenhar() {
      const alvo = caixa.querySelector('#preview-in');
      alvo.innerHTML = estado.paginas[estado.i] || '';
      caixa.querySelector('#preview-cont').textContent =
        String(estado.i + 1).padStart(2, '0') + ' / ' +
        String(estado.paginas.length).padStart(2, '0');
      caixa.querySelector('[data-ant]').disabled = estado.i === 0;
      caixa.querySelector('[data-prox]').disabled = estado.i >= estado.paginas.length - 1;
      escalar();
    }
    function escalar() {
      const palco = caixa.querySelector('.preview-palco');
      const dentro = caixa.querySelector('#preview-in');
      const pagina = dentro.firstElementChild;
      if (!pagina) return;
      const f = Math.min(
        (palco.clientWidth - 40) / pagina.offsetWidth,
        (palco.clientHeight - 40) / pagina.offsetHeight);
      dentro.style.transform = 'scale(' + f + ')';
      dentro.style.width = pagina.offsetWidth + 'px';
      dentro.style.height = pagina.offsetHeight + 'px';
    }
    window.addEventListener('resize', escalar);
    desenhar();
  }

  return { abrir };
})();
