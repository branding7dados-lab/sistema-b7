/* =====================================================================
   B7 STATUS SEMANAL — documento 4:5, UMA PÁGINA SÓ

   Redesenho: o relatório cliente precisa caber inteiro numa página,
   sempre, mostrando o que vai acontecer na semana — não o que já
   aconteceu. Tipo de atividade e status da tarefa são dois sistemas de
   cor semânticos separados (tokens em TIPOS/SITUACOES abaixo). Cabeçalho
   e faixa do cliente são sempre compactos; o que varia por densidade é
   só o corpo (linhas de dia, espaçamento, tipografia), numa escada de
   níveis medida de verdade — nunca `transform:scale` na página inteira,
   que borra o texto.

   Duas regras que valem para o arquivo inteiro:
   • Campo vazio não aparece. Sem observação, sem linha de observação.
   • A peça é sempre clara na área de conteúdo, mesmo com o sistema em
     dark mode. Os tokens são redefinidos dentro de .pag45.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.DocSemana = (function () {
  const esc = B7.UI.esc;
  const MARCA = 'assets/brand/symbol-color.png';

  /* `document.fonts.ready` só espera as fontes que JÁ foram pedidas —
     se nada na página ainda usou, por exemplo, Archivo 800 (o peso do
     nome do cliente e da data do dia), essa promise resolve na hora,
     sem esperar nada, e só quando o HTML da peça é inserido é que o
     navegador pede o arquivo da fonte pela primeira vez (com
     font-display:swap, mostrando a fonte de fallback até lá). Isso é
     uma corrida de verdade: a medição de densidade pode rodar (e o
     screenshot/canvas pode capturar) ANTES da troca pra fonte real
     acontecer, com a fonte de fallback ocupando menos espaço — e o
     texto real, mais largo/alto, estoura silenciosamente uma página
     que "coube" na medição. Por isso força o carregamento de cada peso
     usado no documento explicitamente, em vez de só esperar o que já
     estava em andamento. */
  async function carregarFontes() {
    if (!(window.document && document.fonts && document.fonts.load)) return;
    const pesos = [
      '400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter',
      '700 16px Archivo', '800 16px Archivo', '900 16px Archivo'
    ];
    try {
      await Promise.all(pesos.map(p => document.fonts.load(p).catch(() => null)));
      await document.fonts.ready;
    } catch (e) { /* segue mesmo assim — melhor tentar montar do que travar */ }
  }
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

  /* =================================================================
     DOIS SISTEMAS DE COR SEPARADOS
     TIPO responde "que tipo de atividade é essa" — aparece como rótulo
     de texto colorido, discreto, nunca em pílula. SITUAÇÃO responde "em
     que pé essa tarefa está" — aparece em pílula forte, com ponto e
     fundo, porque o dono do sistema pediu status extremamente visível.
     A cor nunca carrega a informação sozinha: o texto está sempre lá.
     ================================================================= */
  const TIPOS = {
    'Postagem':  { cor: '#C21C83' },
    'Gravação':  { cor: '#0E8074' },
    'Produção':  { cor: '#6D3FC4' },
    'Aprovação': { cor: '#A8790A' },
    'Ajustes':   { cor: '#D2572B' },
    'Entrega':   { cor: '#1E6FA8' },
    'Reunião':   { cor: '#4A4E8C' },
    'Outro':     { cor: '#6B6478' }
  };
  const corTipo = t => (TIPOS[t] || TIPOS.Outro).cor;

  /* Confirmado/Em revisão não estão na lista oficial de 8 do produto,
     mas continuam em uso real no editor (sugestões de Gravação/Reunião/
     Produção/Aprovação) — ficam no sistema de cor com tom próprio, na
     mesma família do estado mais próximo, pra nada ficar sem token. */
  const SITUACOES = {
    'Previsto':           { cor: '#6B6478', bg: 'rgba(107,100,120,.11)',  legenda: 'Planejado para a semana.' },
    'Programado':         { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)',   legenda: 'Preparado para publicação.' },
    'Confirmado':         { cor: '#5B47C4', bg: 'rgba(91,71,196,.12)',    legenda: 'Data e horário confirmados.' },
    'Em andamento':       { cor: '#2464C7', bg: 'rgba(36,100,199,.12)',   legenda: 'Em execução.' },
    'Em revisão':         { cor: '#3A7BD5', bg: 'rgba(58,123,213,.12)',   legenda: 'Em conferência interna.' },
    'Aguardando cliente': { cor: '#B98900', bg: 'rgba(185,137,0,.14)',    legenda: 'Depende de retorno do cliente.' },
    'Atenção':            { cor: '#C2185B', bg: 'rgba(194,24,91,.14)',    legenda: 'Precisa de ação.' },
    'Concluído':          { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)',   legenda: 'Etapa finalizada.' },
    'Publicado':          { cor: '#158F7A', bg: 'rgba(21,143,122,.14)',   legenda: 'Publicado no canal.' },
    'Cancelado':          { cor: '#4A4458', bg: 'rgba(74,68,88,.15)',     legenda: 'Não será realizado.' }
  };
  const sitInfo = s => SITUACOES[s] || SITUACOES.Previsto;
  /* Cor de status pra quem só precisa do tom (ex.: o pontinho da lista
     de itens do editor, fora da peça pro cliente) — mesmo token da
     pílula, sem precisar montar a pílula inteira. */
  const corSituacao = s => sitInfo(s).cor;

  /* Trabalho já concluído não é "o que vai acontecer nesta semana" — o
     relatório cliente é sempre olhando pra frente. Isso NUNCA apaga a
     demanda: só tira dela da apresentação desta peça. O editor (semana.js)
     continua mostrando tudo, sempre. */
  const EXCLUIR_DO_PLANEJAMENTO = ['Concluído', 'Publicado', 'Cancelado'];

  const ICONE = {
    Reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg>',
    Card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5"/></svg>',
    Carrossel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="5" width="10" height="14" rx="2.5"/><path d="M4 8v8M20 8v8"/></svg>',
    Story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6.5" y="3.5" width="11" height="17" rx="3"/><path d="M10 7.5h4"/></svg>',
    Gravação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="6.5" width="12" height="11" rx="2.5"/><path d="M14.5 10.5l7-3.5v10l-7-3.5z"/></svg>',
    Aprovação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    Reunião: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="3"/><path d="M3 19v-.8A4.2 4.2 0 0 1 7.2 14h3.6A4.2 4.2 0 0 1 15 18.2V19M16 6.2a3 3 0 0 1 0 5.6M17 14.2a4.2 4.2 0 0 1 4 4.2V19"/></svg>',
    Ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a3 3 0 0 1-3.9 3.9l-6 6V19h2.8l6-6a3 3 0 0 1 3.9-3.9l-2.2 2.2 1.4 1.4z"/></svg>',
    Entrega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l9-5 9 5-9 5-9-5z"/><path d="M3 8.5V16l9 5 9-5V8.5M12 13.5V21"/></svg>',
    Outro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16h.01"/></svg>'
  };
  const iconeDe = it => ICONE[it.formato] || ICONE[it.etapa] || ICONE.Outro;

  /* ---------------------------------------------------------- CABEÇA
     Compacta sempre — o cabeçalho não precisa dominar a página pra a
     marca aparecer. Título, período e logo numa faixa só. */
  function cabecalho(ctx) {
    const r = ctx.relatorio;
    return '<div class="ps-cabeca">' +
      '<div class="ps-brilho"></div>' +
      '<div class="ps-cabeca-in">' +
        '<div class="ps-olho"><i></i>B7 / BRANDING7</div>' +
        '<div class="ps-cab-linha"><h1>Status da semana</h1>' +
          '<span class="ps-periodo">' + esc(periodoTexto(r.semana_inicio, r.semana_fim)) + '</span></div>' +
      '</div>' +
      '<img class="ps-logo" src="' + LOGO + '" alt="B7">' +
    '</div>';
  }

  /* ------------------------------------------------------- CLIENTE
     Compacta sempre — cliente, logo (nunca o avatar pessoal como
     substituto), e a linha editorial vinculada, quando existe. */
  function faixaCliente(ctx) {
    const r = ctx.relatorio;
    /* O estado da linha editorial só entra quando diz algo ao cliente.
       "Em criação" e "Em revisão" são etapas internas da B7: mostrar isso
       no card seria expor o nosso processo, não informar o cliente. */
    const PARA_CLIENTE = ['Aprovada', 'Finalizada'];
    const estado = ctx.linha && PARA_CLIENTE.includes(ctx.linha.status)
      ? '<span>' + esc(ctx.linha.status) + '</span>' : '';
    const selo = ctx.linha
      ? '<div class="ps-selo"><small>LINHA EDITORIAL</small><b>' + esc(ctx.linha.nome || 'Linha editorial') + '</b>' + estado + '</div>'
      : '';
    return '<div class="ps-cliente">' +
      (ctx.clienteLogo
        ? '<div class="ps-cli-logo"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>'
        : '<div class="ps-cli-logo ps-cli-logo-vazio">' + esc((r.cliente_nome || '?').trim().slice(0, 1).toUpperCase()) + '</div>') +
      '<div><small>CLIENTE</small><b>' + esc(r.cliente_nome || '') + '</b></div>' +
      selo + '</div>';
  }

  /* ----------------------------------------------------- FAIXA DE DIA */
  function faixaDia(iso, itens) {
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
      '<div class="ps-itens">' + itens.map(linhaItem).join('') + '</div></div>';
  }

  /* Título + pílula de status: os dois elementos mais fortes da linha.
     Tipo/canal ficam abaixo, discretos — nunca maiores que o título. */
  function linhaItem(it) {
    const s = sitInfo(it.situacao);
    return '<div class="ps-item">' +
      '<div class="ps-item-topo">' +
        '<b class="ps-titulo">' + esc(it.titulo || 'Sem título') + '</b>' +
        (it.situacao ? '<span class="ps-pill" style="color:' + s.cor + ';background:' + s.bg + '">' +
          '<i style="background:' + s.cor + '"></i>' + esc(it.situacao) + '</span>' : '') +
      '</div>' +
      '<div class="ps-meta">' +
        (it.etapa ? '<span class="ps-tipo" style="color:' + corTipo(it.etapa) + '">' +
          '<span class="ps-tipo-ic">' + iconeDe(it) + '</span>' + esc(it.etapa) + '</span>' : '') +
        (it.canal ? '<span class="ps-canal">' + esc(it.canal) + '</span>' : '') +
      '</div>' +
      (!vazio(it.observacao) ? '<p class="ps-obs">' + esc(it.observacao) + '</p>' : '') +
    '</div>';
  }

  /* --------------------------------------------------------- LEGENDA
     Só o que realmente aparece na semana — uma legenda de oito tipos
     quando só dois foram usados é ruído. Sempre compacta: ícone/ponto +
     rótulo, sem frase explicativa, pra nunca disputar espaço com a
     agenda de verdade. */
  function legenda(itens) {
    const tiposUsados = [...new Set(itens.map(i => i.etapa).filter(Boolean))]
      .filter(t => TIPOS[t]);
    const statusUsados = [...new Set(itens.map(i => i.situacao).filter(Boolean))]
      .filter(s => SITUACOES[s]);
    if (!tiposUsados.length && !statusUsados.length) return '';
    const linha = (rot, chips) => chips.length
      ? '<div class="ps-leg-linha"><b>' + rot + '</b>' + chips + '</div>' : '';
    return '<div class="ps-legendas">' +
      linha('TIPOS', tiposUsados.map(t =>
        '<span class="ps-leg-chip" style="color:' + corTipo(t) + '">' +
          '<span class="ps-leg-ic">' + iconeDe({ etapa: t }) + '</span>' + esc(t) + '</span>').join('')) +
      linha('STATUS', statusUsados.map(s =>
        '<span class="ps-leg-chip"><i style="background:' + sitInfo(s).cor + '"></i>' + esc(s) + '</span>').join('')) +
    '</div>';
  }

  /* Aviso curto de quantas demandas dependem do cliente. Só com dado
     real, e sem alarme vermelho gigante. */
  function atencao(itens) {
    const n = itens.filter(i =>
      i.situacao === 'Aguardando cliente' || i.situacao === 'Atenção').length;
    if (!n) return '';
    return '<div class="ps-atencao"><span class="ps-ponto" style="background:' + SITUACOES['Aguardando cliente'].cor + '"></span>' +
      '<span>Atenção nesta semana: <b>' + n + ' demanda' + (n === 1 ? '' : 's') +
      '</b> ' + (n === 1 ? 'precisa' : 'precisam') + ' de retorno.</span></div>';
  }

  function rodape(ctx) {
    return '<div class="ps-rodape">' +
      '<div class="esq"><img src="' + MARCA + '" alt="">' +
      '<span>B7 / BRANDING7 &nbsp;·&nbsp; STATUS SEMANAL</span></div>' +
    '</div>';
  }

  /* =================================================================
     UMA PÁGINA, SEMPRE
     Nunca gera página 2. Em vez de paginar, testa os níveis do MAIOR
     pro menor e usa o primeiro que couber de verdade — uma semana leve
     preenche a página com texto grande (nunca sobra espaço em branco
     com letra pequena só porque "coube"); só uma semana cheia desce a
     escada até um piso legível. Se mesmo o nível mais denso não couber,
     usa uma composição de duas colunas balanceadas — ainda uma página
     só, nunca um dia dividido ao meio. */
  const NIVEIS = ['nv-enorme', 'nv-grande', '', 'nv-compacta', 'nv-densa', 'nv-muito-densa'];

  function montar(ctx, area, opcoes) {
    opcoes = opcoes || {};
    const r = ctx.relatorio;
    const itensTodos = ctx.itens || [];
    const itens = itensTodos.filter(i => !EXCLUIR_DO_PLANEJAMENTO.includes(i.situacao));
    const mostrarVazios = opcoes.mostrarDiasVazios !== false;
    const mostrarObs = opcoes.mostrarObservacoes !== false;
    const querLegenda = opcoes.mostrarLegenda !== 'nao';

    const porDia = {};
    itens.forEach(i => { (porDia[i.data] = porDia[i.data] || []).push(i); });

    const diasCompletos = diasDoPeriodo(r.semana_inicio, r.semana_fim);
    const diasVisiveis = diasCompletos.filter(d => mostrarVazios || (porDia[d] || []).length);
    const semData = itens.filter(i => !i.data);

    /* blocos na ordem do documento — cada um é atômico: nunca é
       dividido entre colunas nem entre densidades */
    const blocos = [];
    if (mostrarObs && !vazio(r.observacao_geral)) {
      blocos.push({ html: '<div class="ps-nota-geral">' + esc(r.observacao_geral) + '</div>', peso: 1.6 });
    }
    const av = atencao(itens);
    if (av) blocos.push({ html: av, peso: 1.3 });

    diasVisiveis.forEach(d => {
      const doDia = (porDia[d] || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      blocos.push({ html: faixaDia(d, doDia), peso: doDia.length ? 1.1 + doDia.length * 1.35 : 0.55 });
    });

    if (semData.length) {
      blocos.push({ html: '<div class="ps-dia sem-data">' +
        '<div class="ps-data"><span class="dow">SEM</span><span class="dt">DATA</span></div>' +
        '<div class="ps-itens">' + semData.map(linhaItem).join('') + '</div></div>', peso: 1.1 + semData.length * 1.35 });
    }

    const leg = querLegenda ? legenda(itens) : '';
    if (leg) blocos.push({ html: leg, peso: 1.4 });

    if (!blocos.length) {
      blocos.push({ html: '<div class="ps-sem-nada">Nenhuma atividade prevista para esta semana.</div>', peso: 1 });
    }

    /* -------------------------------------------------- medição real
       Renderiza fora da tela e mede se o corpo estoura a caixa
       disponível — a mesma técnica de sempre, só que agora decidindo
       entre densidade/colunas em vez de decidir quando abrir página 2. */
    const medidor = document.createElement('div');
    medidor.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    (area || document.body).appendChild(medidor);

    const cabeca = cabecalho(ctx);
    const cliente = faixaCliente(ctx);
    const pe = rodape(ctx);

    const paginaHtml = (nivel, corpoHtml, duasColunas) =>
      '<div class="pag45' + (nivel ? ' ' + nivel : '') + '">' +
        cabeca + cliente + '<div class="ps-corpo' + (duasColunas ? ' duas-colunas' : '') + '">' + corpoHtml + '</div>' + pe +
      '</div>';

    const corpoUnaColuna = blocos.map(b => b.html).join('');

    /* Candidatos de corte pra duas colunas, do mais equilibrado (por peso
       estimado) pro menos — nunca só o "melhor" teórico. O peso é uma
       estimativa; a única forma de saber se um corte realmente cabe é
       medir de verdade, então testamos vários candidatos em ordem de
       preferência até achar um que meça certo. Um dia nunca é dividido
       entre as duas colunas. */
    function candidatosCorte() {
      const cortes = [];
      for (let c = 1; c < blocos.length; c++) {
        const esq = blocos.slice(0, c).reduce((s, b) => s + b.peso, 0);
        const dir = blocos.slice(c).reduce((s, b) => s + b.peso, 0);
        cortes.push({ c, diff: Math.abs(esq - dir) });
      }
      cortes.sort((a, b) => a.diff - b.diff);
      return cortes.map(x => x.c);
    }
    function htmlDuasColunas(corte) {
      const esquerda = blocos.slice(0, corte).map(b => b.html).join('');
      const direita = blocos.slice(corte).map(b => b.html).join('');
      return '<div class="ps-col">' + esquerda + '</div><div class="ps-col">' + direita + '</div>';
    }

    function cabeUnaColuna(nivel) {
      medidor.innerHTML = paginaHtml(nivel, corpoUnaColuna, false);
      const c = medidor.querySelector('.ps-corpo');
      return c.scrollHeight <= c.clientHeight + 2;
    }
    /* Mede as duas colunas de verdade e devolve o quanto estourou (0 se
       coube). Nunca confia só no peso estimado — o peso só ordena os
       candidatos, quem decide é a medição real no DOM. */
    function medirDuasColunas(nivel, corte) {
      medidor.innerHTML = paginaHtml(nivel, htmlDuasColunas(corte), true);
      const cols = medidor.querySelectorAll('.ps-col');
      let estouro = 0;
      cols.forEach(c => { estouro = Math.max(estouro, c.scrollHeight - c.clientHeight); });
      return estouro;
    }

    let escolhido = null;
    for (const nivel of NIVEIS) {
      if (cabeUnaColuna(nivel)) { escolhido = { nivel, corpo: corpoUnaColuna, duas: false }; break; }
    }
    if (!escolhido) {
      const cortes = candidatosCorte();
      let melhorFallback = null; /* pior caso: guarda o menor estouro visto, pra usar como último recurso */
      for (const nivel of NIVEIS) {
        for (const corte of cortes) {
          const estouro = medirDuasColunas(nivel, corte);
          if (estouro <= 2) { escolhido = { nivel, corpo: htmlDuasColunas(corte), duas: true }; break; }
          if (!melhorFallback || estouro < melhorFallback.estouro) {
            melhorFallback = { nivel, corte, estouro };
          }
        }
        if (escolhido) break;
      }
      /* semana excepcionalmente cheia: nada coube de verdade — usa a
         combinação (nível + corte) que menos estourou, nunca a primeira
         que apareceu. Ainda assim, nunca uma segunda página. */
      if (!escolhido) {
        escolhido = { nivel: melhorFallback.nivel, corpo: htmlDuasColunas(melhorFallback.corte), duas: true };
      }
    }

    medidor.remove();
    return paginaHtml(escolhido.nivel, escolhido.corpo, escolhido.duas);
  }

  return { montar, periodoTexto, diasDoPeriodo, diaDaSemana, curto, partes, carregarFontes,
           SITUACOES, TIPOS, corTipo, corSituacao, EXCLUIR_DO_PLANEJAMENTO, ICONE, DIAS, MESES_CURTO };
})();


/* =====================================================================
   EXPORTAÇÃO DO STATUS SEMANAL
   Reutiliza a infraestrutura de render que o Download Center já usa
   (html2canvas + jsPDF, via B7.Export.paraCanvas/baixarBlob). Nada de
   window.print aqui: o pedido é arquivo, não impressão. Sempre uma
   página — B7.DocSemana.montar() nunca devolve mais de um .pag45.
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

  /* Monta a página fora da tela e devolve o elemento pronto.
     Espera as fontes carregarem ANTES de montar: a medição de altura
     que decide densidade/colunas roda no DOM real, e se a fonte ainda
     não trocou (font-display:swap usa uma fonte de fallback até lá) a
     medida fica errada — o texto pode crescer depois que a fonte certa
     chega, estourando uma página que "coube" na medição. Isso também
     evita que o html2canvas capture a página ainda com a fonte de
     fallback. */
  async function preparar(ctx, opcoes) {
    await B7.DocSemana.carregarFontes();
    const area = document.getElementById('area-impressao');
    area.style.display = 'block';
    area.classList.add('modo-45');
    area.innerHTML = B7.DocSemana.montar(ctx, area, opcoes);
    return { area: area, pagina: area.querySelector('.pag45') };
  }
  function limpar(area) {
    area.innerHTML = '';
    area.style.display = '';
    area.classList.remove('modo-45');
  }

  /* ---------------------------------------------------------- PNG */
  async function gerarPNG(ctx, opcoes, aoAndar) {
    const { area, pagina } = await preparar(ctx, opcoes);
    const escala = (opcoes && opcoes.alta) ? 4 : 2;   /* 2 → 1080×1350, 4 → 2160×2700 */
    try {
      aoAndar && aoAndar('render', 1, 1);
      const canvas = await html2canvas(pagina, {
        scale: escala, backgroundColor: '#ffffff', useCORS: true, logging: false,
        windowWidth: pagina.offsetWidth, windowHeight: pagina.offsetHeight
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      canvas.width = canvas.height = 0;             /* não segura canvas gigante na memória */

      aoAndar && aoAndar('arquivo', 1, 1);
      B7.Export.baixarBlob(blob, B7.Export.nomeArquivo([nomeBase(ctx)], 'png'));
      return 1;
    } finally { limpar(area); }
  }

  /* ---------------------------------------------------------- PDF
     Página com a mesma proporção 4:5 (216 × 270 mm), não A4 — e sempre
     uma única página no PDF, igual ao PNG. */
  async function gerarPDF(ctx, opcoes, aoAndar) {
    const { area, pagina } = await preparar(ctx, opcoes);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [216, 270],
                              orientation: 'portrait', compress: true });
      aoAndar && aoAndar('render', 1, 1);
      const canvas = await html2canvas(pagina, {
        scale: (opcoes && opcoes.alta) ? 4 : 3, backgroundColor: '#ffffff',
        useCORS: true, logging: false,
        windowWidth: pagina.offsetWidth, windowHeight: pagina.offsetHeight
      });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(img, 'JPEG', 0, 0, 216, 270, undefined, 'FAST');
      canvas.width = canvas.height = 0;
      aoAndar && aoAndar('arquivo', 1, 1);
      /* mesmo caminho de download do resto do sistema, em vez de pdf.save():
         um só lugar cuidando de Blob, link temporário e limpeza */
      B7.Export.baixarBlob(pdf.output('blob'), B7.Export.nomeArquivo([nomeBase(ctx)], 'pdf'));
      return 1;
    } finally { limpar(area); }
  }

  return { reunir, gerarPNG, gerarPDF, preparar, limpar, nomeBase, LARGURA, ALTURA };
})();
