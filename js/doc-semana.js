/* =====================================================================
   B7 STATUS SEMANAL — documento 4:5

   Mesma linguagem visual das fichas de roteiro e da linha editorial:
   cabeçalho escuro com gradiente B7, tipografia editorial, faixas com
   cantos suaves, assinatura no rodapé. A composição é própria — sete
   faixas de dia, uma por data — mas o DNA é o mesmo.

   Duas regras que valem para o arquivo inteiro:
   • Campo vazio não aparece. Sem observação, sem linha de observação.
   • A peça é sempre clara na área de conteúdo, mesmo com o sistema em
     dark mode. Os tokens são redefinidos dentro de .pag45.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.DocSemana = (function () {
  const esc = B7.UI.esc;
  const MARCA = 'assets/brand/symbol-color.png';
  const LOGO = 'assets/brand/logo-white.png';

  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
                       'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const vazio = t => !String(t || '').trim();

  /* Datas puras: '2026-09-07' vira 7 de setembro em qualquer fuso. Passar
     por new Date('2026-09-07') daria 06/09 no horário de Brasília. */
  function partes(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return { ano: a, mes: m, dia: d };
  }
  function diaDaSemana(iso) {
    const p = partes(iso);
    return new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  }
  const curto = iso => {
    const p = partes(iso);
    return String(p.dia).padStart(2, '0') + '/' + String(p.mes).padStart(2, '0');
  };

  /* '07 a 13 de setembro · 2026' — e quando a semana cruza o mês,
     '31 de agosto a 06 de setembro · 2026' */
  function periodoTexto(inicio, fim) {
    const a = partes(inicio), b = partes(fim);
    const dia = n => String(n).padStart(2, '0');
    if (a.mes === b.mes && a.ano === b.ano) {
      return dia(a.dia) + ' a ' + dia(b.dia) + ' de ' + MESES[a.mes - 1] + ' · ' + a.ano;
    }
    if (a.ano === b.ano) {
      return dia(a.dia) + ' de ' + MESES[a.mes - 1] + ' a ' +
             dia(b.dia) + ' de ' + MESES[b.mes - 1] + ' · ' + a.ano;
    }
    return dia(a.dia) + ' ' + MESES_CURTO[a.mes - 1] + ' ' + a.ano + ' a ' +
           dia(b.dia) + ' ' + MESES_CURTO[b.mes - 1] + ' ' + b.ano;
  }

  /* os sete dias do período, em ordem */
  function diasDoPeriodo(inicio, fim) {
    const a = partes(inicio), b = partes(fim);
    const ini = Date.UTC(a.ano, a.mes - 1, a.dia);
    const f = Date.UTC(b.ano, b.mes - 1, b.dia);
    const saida = [];
    for (let t = ini; t <= f; t += 864e5) {
      const d = new Date(t);
      saida.push(d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(d.getUTCDate()).padStart(2, '0'));
    }
    return saida;
  }

  /* ------------------------------------------------------ situações
     A cor nunca carrega a informação sozinha: o texto está sempre lá. */
  const SITUACOES = {
    'Previsto':           { classe: 'neutro',  legenda: 'Planejado para a semana.' },
    'Em andamento':       { classe: 'producao', legenda: 'Em criação ou edição.' },
    'Aguardando cliente': { classe: 'espera',  legenda: 'Depende de validação ou retorno.' },
    'Programado':         { classe: 'pronto',  legenda: 'Preparado para publicação.' },
    'Concluído':          { classe: 'pronto',  legenda: 'Etapa finalizada.' },
    'Publicado':          { classe: 'pronto',  legenda: 'Publicado no canal.' },
    'Atenção':            { classe: 'atencao', legenda: 'Precisa de ação ou ajuste.' },
    'Cancelado':          { classe: 'neutro',  legenda: 'Não será realizado.' },
    'Confirmado':         { classe: 'pronto',  legenda: 'Data e horário confirmados.' },
    'Em revisão':         { classe: 'producao', legenda: 'Em conferência interna.' }
  };
  const classeSituacao = s => (SITUACOES[s] || { classe: 'neutro' }).classe;

  const ICONE = {
    Reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg>',
    Card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5"/></svg>',
    Carrossel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="5" width="10" height="14" rx="2.5"/><path d="M4 8v8M20 8v8"/></svg>',
    Story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6.5" y="3.5" width="11" height="17" rx="3"/><path d="M10 7.5h4"/></svg>',
    Gravação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="6.5" width="12" height="11" rx="2.5"/><path d="M14.5 10.5l7-3.5v10l-7-3.5z"/></svg>',
    Aprovação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    Reunião: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="3"/><path d="M3 19v-.8A4.2 4.2 0 0 1 7.2 14h3.6A4.2 4.2 0 0 1 15 18.2V19M16 6.2a3 3 0 0 1 0 5.6M17 14.2a4.2 4.2 0 0 1 4 4.2V19"/></svg>',
    Outro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16h.01"/></svg>'
  };
  const iconeDe = it => ICONE[it.formato] || ICONE[it.etapa] || ICONE.Outro;

  /* ---------------------------------------------------------- CABEÇA */
  function cabecalho(ctx, continuacao) {
    const r = ctx.relatorio;
    return '<div class="ps-cabeca">' +
      '<div class="ps-brilho"></div>' +
      '<img class="ps-logo" src="' + LOGO + '" alt="B7">' +
      '<div class="ps-cabeca-in">' +
        '<div class="ps-olho"><i></i>B7 / BRANDING7</div>' +
        '<h1>Status<br>da semana' + (continuacao ? '<em> · continuação</em>' : '') + '</h1>' +
        '<div class="ps-periodo">' + esc(periodoTexto(r.semana_inicio, r.semana_fim)) + '</div>' +
      '</div></div>';
  }

  /* ------------------------------------------------------- CLIENTE */
  function faixaCliente(ctx) {
    const r = ctx.relatorio;
    /* O estado da linha editorial só entra quando diz algo ao cliente.
       "Em criação" e "Em revisão" são etapas internas da B7: mostrar isso
       no card seria expor o nosso processo, não informar o cliente. */
    const PARA_CLIENTE = ['Aprovada', 'Finalizada'];
    const estado = ctx.linha && PARA_CLIENTE.includes(ctx.linha.status)
      ? '<span>' + esc(ctx.linha.status) + '</span>' : '';
    const selo = ctx.linha
      ? '<div class="ps-selo"><b>LINHA EDITORIAL · ' +
        esc(ctx.linha.nome || '') + '</b>' + estado + '</div>'
      : '';
    return '<div class="ps-cliente">' +
      (ctx.clienteLogo
        ? '<div class="ps-cli-logo"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>' : '') +
      '<div><small>CLIENTE</small><b>' + esc(r.cliente_nome || '') + '</b></div>' +
      selo + '</div>';
  }

  /* ----------------------------------------------------- FAIXA DE DIA */
  function faixaDia(iso, itens, opcoes) {
    const dow = DIAS[diaDaSemana(iso)];
    if (!itens.length) {
      return '<div class="ps-dia ps-dia-vazio">' +
        '<div class="ps-data"><span class="dow">' + dow + '</span>' +
        '<span class="dt">' + curto(iso) + '</span></div>' +
        '<div class="ps-itens"><div class="ps-sem">Sem atividades programadas.</div></div></div>';
    }
    return '<div class="ps-dia">' +
      '<div class="ps-data"><span class="dow">' + dow + '</span>' +
      '<span class="dt">' + curto(iso) + '</span></div>' +
      '<div class="ps-itens">' + itens.map(i => linhaItem(i, opcoes)).join('') + '</div></div>';
  }

  function linhaItem(it, opcoes) {
    const mostrarObs = !opcoes || opcoes.mostrarObservacoes !== false;
    return '<div class="ps-item">' +
      '<span class="ps-ic">' + iconeDe(it) + '</span>' +
      '<div class="ps-item-tx">' +
        '<b>' + esc(it.titulo || 'Sem título') + '</b>' +
        '<div class="ps-estado">' +
          '<span class="ps-etapa">' + esc(it.etapa || '') + '</span>' +
          '<span class="ps-ponto ' + classeSituacao(it.situacao) + '"></span>' +
          '<span class="ps-situacao">' + esc(it.situacao || '') + '</span>' +
          (it.canal ? '<span class="ps-canal">' + esc(it.canal) + '</span>' : '') +
        '</div>' +
        (mostrarObs && !vazio(it.observacao)
          ? '<p class="ps-obs">' + esc(it.observacao) + '</p>' : '') +
      '</div></div>';
  }

  /* --------------------------------------------------------- LEGENDA
     Só as situações que realmente aparecem na semana. Legenda de oito
     estados quando só dois foram usados é ruído. */
  function legenda(itens) {
    const usadas = [...new Set(itens.map(i => i.situacao).filter(Boolean))]
      .filter(s => SITUACOES[s]);
    if (usadas.length < 2) return '';
    return '<div class="ps-legenda">' + usadas.map(s =>
      '<div><span class="ps-ponto ' + classeSituacao(s) + '"></span>' +
      '<b>' + esc(s) + '</b><span>' + esc(SITUACOES[s].legenda) + '</span></div>').join('') +
      '</div>';
  }

  /* Aviso curto de quantas demandas dependem do cliente. Só com dado
     real, e sem alarme vermelho gigante. */
  function atencao(itens) {
    const n = itens.filter(i =>
      i.situacao === 'Aguardando cliente' || i.situacao === 'Atenção').length;
    if (!n) return '';
    return '<div class="ps-atencao"><span class="ps-ponto espera"></span>' +
      '<span>Atenção nesta semana: <b>' + n + ' demanda' + (n === 1 ? '' : 's') +
      '</b> ' + (n === 1 ? 'precisa' : 'precisam') + ' de retorno.</span></div>';
  }

  function rodape(ctx, pagina, total) {
    return '<div class="ps-rodape">' +
      '<div class="esq"><img src="' + MARCA + '" alt="">' +
      '<span>B7 / BRANDING7 &nbsp;·&nbsp; STATUS SEMANAL</span></div>' +
      '<div class="dir">' + (total > 1 ? String(pagina).padStart(2, '0') + ' / ' +
        String(total).padStart(2, '0') : '') + '</div></div>';
  }

  /* =================================================================
     PAGINAÇÃO
     Legibilidade primeiro: a fonte não encolhe para caber mais. Quando
     não cabe, abre outra página 4:5. Um dia inteiro tenta ficar junto;
     se não couber sozinho, ele é dividido com indicação de continuação.
     ================================================================= */
  function montar(ctx, area, opcoes) {
    opcoes = opcoes || {};
    const r = ctx.relatorio;
    const itens = ctx.itens || [];
    const mostrarVazios = opcoes.mostrarDiasVazios !== false;

    const porDia = {};
    itens.forEach(i => { (porDia[i.data] = porDia[i.data] || []).push(i); });

    const dias = diasDoPeriodo(r.semana_inicio, r.semana_fim)
      .filter(d => mostrarVazios || (porDia[d] || []).length);

    /* demandas sem data não somem do documento: entram no fim */
    const semData = itens.filter(i => !i.data);

    const medidor = document.createElement('div');
    medidor.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    (area || document.body).appendChild(medidor);

    const pagina = (corpo, primeira, continuacao) =>
      '<div class="pag45' + (primeira ? ' primeira' : '') + '">' +
        (primeira ? cabecalho(ctx, false) + faixaCliente(ctx) : cabecalho(ctx, true)) +
        '<div class="ps-corpo">' + corpo + '</div>' +
        rodape(ctx, 1, 1) +
        '<div class="aviso-overflow">PASSOU DA PÁGINA</div>' +
      '</div>';

    const cabe = (corpo, primeira, continuacao) => {
      medidor.innerHTML = pagina(corpo, primeira, continuacao);
      const c = medidor.querySelector('.ps-corpo');
      return c.scrollHeight <= c.clientHeight + 2;
    };

    /* blocos na ordem do documento */
    const blocos = [];
    if (opcoes.mostrarObservacoes !== false && !vazio(r.observacao_geral)) {
      blocos.push({ html: '<div class="ps-nota-geral">' + esc(r.observacao_geral) + '</div>' });
    }
    const av = atencao(itens);
    if (av) blocos.push({ html: av });

    dias.forEach(d => {
      const doDia = (porDia[d] || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      blocos.push({ dia: d, itens: doDia, html: faixaDia(d, doDia, opcoes) });
    });

    if (semData.length) {
      blocos.push({ html: '<div class="ps-dia sem-data">' +
        '<div class="ps-data"><span class="dow">SEM</span><span class="dt">DATA</span></div>' +
        '<div class="ps-itens">' + semData.map(i => linhaItem(i, opcoes)).join('') + '</div></div>' });
    }

    const querLegenda = opcoes.mostrarLegenda === 'sim' ||
      (opcoes.mostrarLegenda !== 'nao' && true);
    const leg = querLegenda ? legenda(itens) : '';
    if (leg) blocos.push({ html: leg, legenda: true });

    /* Empilha medindo. Quando um bloco sozinho não cabe numa página
       inteira, ele é dividido em partes — nunca cortado, nunca espremido
       com fonte menor. */
    const paginas = [];
    let atual = '', atuais = [], primeira = true;

    /* devolve as partes de um dia que não cabe sozinho */
    function dividirDia(b) {
      const partes = [];
      let resto = b.itens.slice();
      while (resto.length) {
        let grupo = [resto[0]];
        let i = 1;
        while (i < resto.length) {
          const tenta = grupo.concat([resto[i]]);
          const html = faixaDia(b.dia, tenta, opcoes) +
            (i + 1 < resto.length ? '<div class="ps-cont">continua na próxima página</div>' : '');
          if (!cabe(html, false, true)) break;
          grupo = tenta;
          i++;
        }
        resto = resto.slice(grupo.length);
        partes.push(faixaDia(b.dia, grupo, opcoes) +
          (resto.length ? '<div class="ps-cont">continua na próxima página</div>' : ''));
      }
      return partes;
    }

    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      if (cabe(atual + b.html, primeira, !primeira)) {
        atual += b.html; atuais.push(b.html); continue;
      }

      /* fecha o que já estava montado antes de lidar com o bloco */
      if (atual) {
        paginas.push({ html: atual, primeira: primeira, blocos: atuais });
        primeira = false;
        atual = ''; atuais = [];
      }

      /* o bloco sozinho cabe? então ele começa a próxima página */
      if (cabe(b.html, primeira, !primeira)) { atual = b.html; atuais = [b.html]; continue; }

      /* não cabe nem sozinho: divide se for um dia com várias demandas */
      if (b.dia && b.itens && b.itens.length > 1) {
        const partes = dividirDia(b);
        partes.forEach((html, n) => {
          if (n === partes.length - 1) { atual = html; atuais = [html]; }
          else {
            paginas.push({ html: html, primeira: primeira, blocos: [html] });
            primeira = false;
          }
        });
        continue;
      }

      /* bloco indivisível maior que a página: fica sozinho na sua */
      paginas.push({ html: b.html, primeira: primeira, blocos: [b.html] });
      primeira = false;
    }
    if (atual) paginas.push({ html: atual, primeira: primeira, blocos: atuais });

    /* ---------------------------------------------------- equilíbrio
       Uma última página com três linhas e o resto em branco não parece
       um documento desenhado. Se ela sobrou muito vazia, puxamos blocos
       da página anterior enquanto couberem. Nada é cortado nem reduzido:
       só melhor distribuído. */
    /* O corpo tem flex:1, então scrollHeight nunca é menor que a caixa —
       ele serve para detectar estouro, não para medir sobra. A ocupação
       real vem de onde o último elemento termina. */
    const ocupacao = (p) => {
      medidor.innerHTML = pagina(p.html, p.primeira, !p.primeira);
      const c = medidor.querySelector('.ps-corpo');
      const ultimo = c.lastElementChild;
      if (!ultimo || !c.clientHeight) return 1;
      const fim = ultimo.getBoundingClientRect().bottom - c.getBoundingClientRect().top;
      return fim / c.clientHeight;
    };
    for (let n = paginas.length - 1; n >= 1; n--) {
      const ultima = paginas[n], anterior = paginas[n - 1];
      let seguranca = 0;
      while (anterior.blocos.length > 1 && seguranca++ < 12) {
        const antes = Math.abs(ocupacao(anterior) - ocupacao(ultima));
        const movido = anterior.blocos[anterior.blocos.length - 1];
        const novoAnterior = { html: anterior.blocos.slice(0, -1).join(''),
                               primeira: anterior.primeira };
        const novaUltima = { html: movido + ultima.html, primeira: ultima.primeira };
        /* só aceita se continuar cabendo e o desequilíbrio diminuir */
        if (!cabe(novaUltima.html, ultima.primeira, !ultima.primeira)) break;
        const depois = Math.abs(ocupacao(novoAnterior) - ocupacao(novaUltima));
        if (depois >= antes) break;
        anterior.blocos.pop();
        anterior.html = novoAnterior.html;
        ultima.blocos.unshift(movido);
        ultima.html = novaUltima.html;
      }
    }

    medidor.remove();

    const total = paginas.length;
    return paginas.map((p, i) =>
      '<div class="pag45' + (p.primeira ? ' primeira' : '') + '">' +
        (p.primeira ? cabecalho(ctx, false) + faixaCliente(ctx) : cabecalho(ctx, true)) +
        '<div class="ps-corpo">' + p.html + '</div>' +
        rodape(ctx, i + 1, total) +
        '<div class="aviso-overflow">PASSOU DA PÁGINA</div>' +
      '</div>').join('');
  }

  return { montar, periodoTexto, diasDoPeriodo, diaDaSemana, curto, partes,
           SITUACOES, classeSituacao, ICONE, DIAS, MESES_CURTO };
})();


/* =====================================================================
   EXPORTAÇÃO DO STATUS SEMANAL
   Reutiliza a infraestrutura de render que o Download Center já usa
   (html2canvas + jsPDF, via B7.Export.paraCanvas/baixarBlob). Nada de
   window.print aqui: o pedido é arquivo, não impressão.
   ===================================================================== */
B7.BaixarSemana = (function () {
  const LARGURA = 1080, ALTURA = 1350;          /* 4:5 exato */

  async function reunir(reportId) {
    const relatorio = await B7.DB.status(reportId);
    const itens = await B7.DB.listarItens(reportId);
    let linha = null;
    if (relatorio.linha_id) linha = await B7.DB.linha(relatorio.linha_id).catch(() => null);
    return {
      relatorio: relatorio, itens: itens, linha: linha,
      clienteLogo: relatorio.cliente_logo_url || ''
    };
  }

  function nomeBase(ctx) {
    const r = ctx.relatorio;
    const a = B7.DocSemana.partes(r.semana_inicio), b = B7.DocSemana.partes(r.semana_fim);
    const dia = n => String(n).padStart(2, '0');
    return [r.cliente_nome, 'STATUS',
            dia(a.dia) + '-' + dia(b.dia),
            B7.DocSemana.MESES_CURTO[b.mes - 1], String(b.ano)].join('_');
  }

  /* Monta as páginas fora da tela e devolve os elementos prontos. */
  function preparar(ctx, opcoes) {
    const area = document.getElementById('area-impressao');
    area.style.display = 'block';
    area.classList.add('modo-45');
    area.innerHTML = B7.DocSemana.montar(ctx, area, opcoes);
    return { area: area, paginas: [...area.querySelectorAll('.pag45')] };
  }
  function limpar(area) {
    area.innerHTML = '';
    area.style.display = '';
    area.classList.remove('modo-45');
  }

  /* ---------------------------------------------------------- PNG */
  async function gerarPNG(ctx, opcoes, aoAndar) {
    const { area, paginas } = preparar(ctx, opcoes);
    const escala = (opcoes && opcoes.alta) ? 4 : 2;   /* 2 → 1080×1350, 4 → 2160×2700 */
    try {
      const blobs = [];
      for (let i = 0; i < paginas.length; i++) {
        aoAndar && aoAndar('render', i + 1, paginas.length);
        const canvas = await html2canvas(paginas[i], {
          scale: escala, backgroundColor: '#ffffff', useCORS: true, logging: false,
          windowWidth: paginas[i].offsetWidth, windowHeight: paginas[i].offsetHeight
        });
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        blobs.push(blob);
        canvas.width = canvas.height = 0;            /* não segura canvas gigante na memória */
      }

      aoAndar && aoAndar('arquivo', paginas.length, paginas.length);
      const base = nomeBase(ctx);
      if (blobs.length === 1) {
        B7.Export.baixarBlob(blobs[0], B7.Export.nomeArquivo([base], 'png'));
      } else {
        /* várias páginas viram um zip: o navegador bloqueia rajada de
           downloads, e o cliente não quer receber cinco arquivos soltos */
        const zip = await montarZip(blobs.map((b, i) => ({
          nome: B7.Export.nomeArquivo([base, 'P' + String(i + 1).padStart(2, '0')], 'png'),
          blob: b
        })));
        B7.Export.baixarBlob(zip, B7.Export.nomeArquivo([base], 'zip'));
      }
      return paginas.length;
    } finally { limpar(area); }
  }

  /* ---------------------------------------------------------- PDF
     Página com a mesma proporção 4:5 (216 × 270 mm), não A4. */
  async function gerarPDF(ctx, opcoes, aoAndar) {
    const { area, paginas } = preparar(ctx, opcoes);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [216, 270],
                              orientation: 'portrait', compress: true });
      for (let i = 0; i < paginas.length; i++) {
        aoAndar && aoAndar('render', i + 1, paginas.length);
        const canvas = await html2canvas(paginas[i], {
          scale: (opcoes && opcoes.alta) ? 4 : 3, backgroundColor: '#ffffff',
          useCORS: true, logging: false,
          windowWidth: paginas[i].offsetWidth, windowHeight: paginas[i].offsetHeight
        });
        const img = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage([216, 270], 'portrait');
        pdf.addImage(img, 'JPEG', 0, 0, 216, 270, undefined, 'FAST');
        canvas.width = canvas.height = 0;
      }
      aoAndar && aoAndar('arquivo', paginas.length, paginas.length);
      /* mesmo caminho de download do resto do sistema, em vez de pdf.save():
         um só lugar cuidando de Blob, link temporário e limpeza */
      B7.Export.baixarBlob(pdf.output('blob'), B7.Export.nomeArquivo([nomeBase(ctx)], 'pdf'));
      return paginas.length;
    } finally { limpar(area); }
  }

  /* ZIP mínimo (armazenado, sem compressão) para não trazer uma
     biblioteca inteira só por causa disso. */
  async function montarZip(arquivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let offset = 0;

    const crcTabela = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      return t;
    })();
    const crc32 = bytes => {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < bytes.length; i++) c = crcTabela[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    };
    const u32 = v => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
    const u16 = v => new Uint8Array([v & 255, (v >>> 8) & 255]);

    for (const a of arquivos) {
      const dados = new Uint8Array(await a.blob.arrayBuffer());
      const nome = enc.encode(a.nome);
      const crc = crc32(dados);
      const local = [
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dados.length), u32(dados.length), u16(nome.length), u16(0),
        nome, dados
      ];
      local.forEach(p => partes.push(p));
      const tamanhoLocal = 30 + nome.length + dados.length;
      central.push([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dados.length), u32(dados.length),
        u16(nome.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nome
      ]);
      offset += tamanhoLocal;
    }

    const inicioCentral = offset;
    let tamanhoCentral = 0;
    central.forEach(reg => {
      reg.forEach(p => partes.push(p));
      tamanhoCentral += reg.reduce((t, p) => t + p.length, 0);
    });
    partes.push(u32(0x06054b50), u16(0), u16(0),
      u16(arquivos.length), u16(arquivos.length),
      u32(tamanhoCentral), u32(inicioCentral), u16(0));

    return new Blob(partes, { type: 'application/zip' });
  }

  return { reunir, gerarPNG, gerarPDF, preparar, limpar, nomeBase, LARGURA, ALTURA };
})();
