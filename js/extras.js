/* =====================================================================
   B7 DOWNLOAD CENTER · QUICK VIEW · APRESENTAÇÃO
   Três coisas que o sistema não tinha: levar o roteiro embora (PDF/PNG),
   espiar sem entrar no editor, e mostrar na tela para o cliente.
   Regra que atravessa as três: o arquivo e a folha seguem SEMPRE o
   design de impressão, mesmo com a interface no modo escuro.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Export = (function () {
  const esc = B7.UI.esc;

  /* MERCATO_SADIA_ROTEIRO_03_CASHBACK.pdf */
  function nomeArquivo(partes, ext) {
    const limpo = partes.filter(Boolean).join('_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '_').toUpperCase().slice(0, 90);
    return (limpo || 'ROTEIRO_B7') + '.' + ext;
  }

  /* Monta as folhas numa área fora da tela, sempre com os estilos de
     impressão, e devolve os elementos prontos para virar imagem. */
  function montarFolhas(ctx, ids, comAbertura) {
    const area = document.getElementById('area-impressao');
    const selecionados = ctx.roteiros.filter(r => ids.includes(r.id));
    let html = '';
    if (comAbertura) {
      html += B7.Folha.aberturaHTML({
        cliente: ctx.cliente, dataGravacao: ctx.dataGravacao,
        gravacao: ctx.gravacao, roteiros: selecionados
      });
    }
    selecionados.forEach(r => {
      html += B7.Folha.folhaHTML({
        cliente: ctx.cliente, clienteLogo: ctx.clienteLogo,
        gravacao: ctx.gravacao, dataGravacao: ctx.dataGravacao,
        roteiro: r, cenas: ctx.cenasPorRoteiro[r.id] || [],
        indice: ctx.roteiros.indexOf(r), total: ctx.roteiros.length
      });
    });
    area.innerHTML = html;
    area.style.display = 'block';
    area.querySelectorAll('.folha:not(.abertura)').forEach(f => {
      const r = selecionados.find(x => x.id === f.dataset.roteiro);
      if (r && r.escala_automatica !== false) B7.Folha.ajustar(f);
      else f.style.setProperty('--fs', r ? (r.escala || 1) : 1);
    });
    return { area, folhas: [...area.querySelectorAll('.folha')], selecionados };
  }

  function limpar(area) { area.innerHTML = ''; area.style.display = ''; }

  async function paraCanvas(folha) {
    /* escala 3 ≈ 300dpi numa A4; fundo branco fixo, nunca o tema */
    return html2canvas(folha, {
      scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false,
      windowWidth: folha.offsetWidth, windowHeight: folha.offsetHeight
    });
  }

  function baixarBlob(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------------------------------------------------------- PDF */
  async function gerarPDF(ctx, ids, comAbertura, nome, aoAndar) {
    const { area, folhas } = montarFolhas(ctx, ids, comAbertura);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      for (let i = 0; i < folhas.length; i++) {
        aoAndar && aoAndar(i + 1, folhas.length);
        const canvas = await paraCanvas(folhas[i]);
        const img = canvas.toDataURL('image/jpeg', 0.94);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(nome);
    } finally { limpar(area); }
  }

  /* ---------------------------------------------------------- PNG */
  async function gerarPNG(ctx, ids, comAbertura, base, aoAndar) {
    const { area, folhas, selecionados } = montarFolhas(ctx, ids, comAbertura);
    try {
      for (let i = 0; i < folhas.length; i++) {
        aoAndar && aoAndar(i + 1, folhas.length);
        const canvas = await paraCanvas(folhas[i]);
        const ehAbertura = folhas[i].classList.contains('abertura');
        const r = ehAbertura ? null : selecionados[comAbertura ? i - 1 : i];
        const nome = nomeArquivo(
          ehAbertura ? [base, 'ABERTURA']
                     : [base, 'ROTEIRO_' + String(ctx.roteiros.indexOf(r) + 1).padStart(2, '0'), r && r.titulo],
          'png');
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        baixarBlob(blob, nome);
        await new Promise(res => setTimeout(res, 350));   // o navegador não gosta de rajada
      }
    } finally { limpar(area); }
  }

  /* ================================================ DOWNLOAD CENTER */
  function abrirCentral(ctx, idInicial) {
    const marcados = new Set(idInicial ? [idInicial] : ctx.roteiros.map(r => r.id));

    const linhas = ctx.roteiros.map((r, i) =>
      '<label class="rot-item' + (marcados.has(r.id) ? ' selecionado' : '') + '" data-id="' + esc(r.id) + '">' +
        '<span class="caixa" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
        '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="tit">' + esc(r.titulo || 'Sem título') + '</span>' +
        '<span class="cenas">' + (ctx.cenasPorRoteiro[r.id] || []).length + ' cenas</span>' +
      '</label>').join('');

    const m = B7.UI.modal(
      '<div class="mp">' +
        '<aside class="mp-lado">' +
          '<div class="mp-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/>' +
            '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>' +
          '<h3>Baixar roteiros</h3>' +
          '<p class="mp-sub">Os arquivos saem no layout de impressão, em A4, mesmo com o sistema no modo escuro.</p>' +
          '<div class="mp-folhas" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<div class="mp-config"><div class="mp-config-tit">Formatos</div>' +
            '<div class="mp-linha"><b>PDF</b><span>· um arquivo com todas as folhas</span></div>' +
            '<div class="mp-linha"><b>PNG</b><span>· uma imagem por folha, em alta resolução</span></div>' +
          '</div>' +
          '<div class="mp-dica"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.5"/></svg>' +
            '<div><b>Nome do arquivo</b><span>Gerado a partir do cliente, do número e do título do roteiro.</span></div>' +
          '</div>' +
        '</aside>' +

        '<section class="mp-principal">' +
          '<header class="mp-topo"><div><h3>Exportar</h3>' +
            '<p class="mp-sub">' + esc(ctx.cliente) + ' · ' + esc(ctx.gravacao) + '</p></div>' +
            '<button class="ico" data-fecha aria-label="Fechar">✕</button></header>' +

          '<div class="mb"><label class="rot">FORMATO</label>' +
            '<div class="opcoes" id="dl-formato">' +
              '<button data-v="pdf" class="on">PDF</button>' +
              '<button data-v="png">PNG</button>' +
            '</div></div>' +

          '<div class="mp-lista rolagem" id="dl-lista">' + linhas + '</div>' +

          '<div class="mp-marcar"><span>Selecionar:</span>' +
            '<button class="b fina" data-todos>Todos</button>' +
            '<button class="b fina" data-nenhum>Nenhum</button></div>' +

          '<label class="rot-item extra" id="dl-abertura">' +
            '<span class="caixa" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
            '<span class="tx"><b>Incluir folha de abertura</b>' +
            '<small>Cliente, gravação, data — quando existir — e a lista de roteiros.</small></span></label>' +

          '<div class="mp-info" id="dl-estado" style="display:none"></div>' +

          '<footer class="mp-pe"><span class="mp-contador" id="dl-contador"></span>' +
            '<button class="b" data-fecha>Cancelar</button>' +
            '<button class="b pri" id="dl-baixar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/>' +
              '<path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>' +
              '<span class="mp-texto-bt">Baixar</span></button></footer>' +
        '</section>' +
      '</div>', { extra: 'modal-impressao' });

    const lista = m.querySelector('#dl-lista');
    const botao = m.querySelector('#dl-baixar');
    const contador = m.querySelector('#dl-contador');
    const abertura = m.querySelector('#dl-abertura');
    const estado = m.querySelector('#dl-estado');
    let formato = 'pdf';

    const selecionados = () => [...lista.querySelectorAll('.rot-item.selecionado')];
    function atualizar() {
      const n = selecionados().length;
      const paginas = n + (abertura.classList.contains('selecionado') ? 1 : 0);
      contador.textContent = n === 0 ? 'Nada selecionado'
        : n + ' roteiro' + (n === 1 ? '' : 's') + ' · ' + paginas + ' folha' + (paginas === 1 ? '' : 's');
      botao.disabled = n === 0;
    }
    function alternar(el) {
      el.classList.toggle('selecionado');
      el.setAttribute('aria-checked', el.classList.contains('selecionado'));
      atualizar();
    }
    [...lista.querySelectorAll('.rot-item'), abertura].forEach(el => {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'checkbox');
      el.addEventListener('click', e => { e.preventDefault(); alternar(el); });
      el.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(el); }
      });
    });
    m.querySelector('[data-todos]').onclick = () => {
      lista.querySelectorAll('.rot-item').forEach(i => i.classList.add('selecionado')); atualizar();
    };
    m.querySelector('[data-nenhum]').onclick = () => {
      lista.querySelectorAll('.rot-item').forEach(i => i.classList.remove('selecionado')); atualizar();
    };
    m.querySelectorAll('#dl-formato button').forEach(b => b.onclick = () => {
      m.querySelectorAll('#dl-formato button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); formato = b.dataset.v;
    });

    botao.onclick = async () => {
      const ids = selecionados().map(i => i.dataset.id);
      if (!ids.length) return;
      const comAbertura = abertura.classList.contains('selecionado');
      botao.disabled = true;
      estado.style.display = '';
      const texto = m.querySelector('.mp-texto-bt');
      texto.textContent = 'Preparando arquivos…';

      const base = [ctx.cliente, ctx.gravacao].join('_');
      const andar = (i, total) => {
        estado.innerHTML = '<div><b>Preparando arquivos…</b><span>folha ' + i + ' de ' + total + '</span></div>';
      };
      try {
        if (formato === 'pdf') {
          const nome = nomeArquivo(ids.length === 1
            ? [ctx.cliente, 'ROTEIRO_' + String(ctx.roteiros.findIndex(r => r.id === ids[0]) + 1).padStart(2, '0'),
               (ctx.roteiros.find(r => r.id === ids[0]) || {}).titulo]
            : [base], 'pdf');
          await gerarPDF(ctx, ids, comAbertura, nome, andar);
        } else {
          await gerarPNG(ctx, ids, comAbertura, ctx.cliente, andar);
        }
        estado.innerHTML = '<div><b>Download pronto ✓</b><span>confira a pasta de downloads</span></div>';
        B7.UI.toast('Download pronto');
        B7.DB.registrar({ tipo: 'download', entidade: 'gravacao', id: ctx.gravacaoId,
          cliente: ctx.clienteId, gravacao: ctx.gravacaoId,
          texto: ids.length + ' roteiro(s) em ' + formato.toUpperCase() });
        setTimeout(() => m.fechar(), 900);
      } catch (e) {
        console.error(e);
        estado.innerHTML = '<div><b>Não foi possível gerar o arquivo.</b><span>tente de novo</span></div>';
        B7.UI.toast('Não foi possível gerar o arquivo.', { tipo: 'erro' });
        texto.textContent = 'Baixar';
        botao.disabled = false;
      }
    };

    atualizar();
    botao.focus();
    return m;
  }

  /* ---- ZIP "store" (sem compressão), escrito à mão, sem biblioteca
     externa — mesma implementação que o Design já usava só para si
     (§15/§16); movida para cá para servir qualquer tela que precise
     empacotar vários arquivos num download só (Design e, agora,
     exportação em lote do Status Semanal). Limite real: memória do
     navegador, tudo fica em RAM até o clique. */
  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function montarZip(entradas) {   // [{ nome, bytes: Uint8Array }]
    const enc = new TextEncoder(); const partes = []; const central = []; let offset = 0;
    const agora = new Date();
    const dosTime = ((agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate()) & 0xFFFF;
    const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
    const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
    entradas.forEach(en => {
      const nome = enc.encode(en.nome), crc = crc32(en.bytes), tam = en.bytes.length;
      const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nome.length), ...u16(0), ...nome]);
      partes.push(local, en.bytes);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nome]));
      offset += local.length + tam;
    });
    const tamCentral = central.reduce((s, c) => s + c.length, 0);
    const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entradas.length), ...u16(entradas.length), ...u32(tamCentral), ...u32(offset), ...u16(0)]);
    return new Blob([...partes, ...central, fim], { type: 'application/zip' });
  }

  return { abrirCentral, gerarPDF, gerarPNG, nomeArquivo, paraCanvas, baixarBlob, montarZip };
})();


/* =====================================================================
   QUICK VIEW — espiar um roteiro sem entrar no editor
   ===================================================================== */
B7.QuickView = (function () {
  const esc = B7.UI.esc;
  let painel = null;
  let gatilhoAnterior = null; /* elemento que abriu o painel — foco volta pra ele ao fechar */

  function fechar() {
    if (!painel) return;
    painel.classList.remove('aberto');
    const p = painel; painel = null;
    setTimeout(() => p.remove(), 200);
    document.removeEventListener('keydown', tecla);
    if (gatilhoAnterior && document.contains(gatilhoAnterior) && gatilhoAnterior.focus) gatilhoAnterior.focus();
    gatilhoAnterior = null;
  }
  function focaveis(p) {
    return Array.from(p.querySelectorAll('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'));
  }
  function tecla(e) {
    if (e.key === 'Escape') { fechar(); return; }
    if (e.key === 'Tab' && painel) {
      const els = focaveis(painel);
      if (!els.length) return;
      const primeiro = els[0], ultimo = els[els.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  }
  function focarAoAbrir(p, gatilho) {
    gatilhoAnterior = gatilho || document.activeElement;
    const fecharBtn = p.querySelector('[data-fechar]');
    if (fecharBtn) fecharBtn.focus();
  }

  /* ctx igual ao da impressão + roteiro escolhido */
  function abrir(ctx, roteiro) {
    fechar();
    const cenas = ctx.cenasPorRoteiro[roteiro.id] || [];
    const indice = ctx.roteiros.findIndex(r => r.id === roteiro.id);
    const selo = ctx.clienteLogo
      ? '<div class="qv-selo"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>'
      : '<div class="qv-selo">' + esc(B7.UI.iniciais(ctx.cliente)) + '</div>';

    painel = document.createElement('div');
    painel.className = 'qv-fundo';
    painel.innerHTML = '<aside class="qv" role="dialog" aria-modal="true">' +
      '<header class="qv-topo">' + selo +
        '<div class="qv-ctx"><b>' + esc(ctx.cliente) + '</b><small>' + esc(ctx.gravacao) +
        (ctx.dataGravacao ? ' · ' + esc(ctx.dataGravacao) : '') + '</small></div>' +
        '<button class="ico" data-fechar aria-label="Fechar">✕</button></header>' +

      '<div class="qv-corpo rolagem">' +
        '<div class="qv-num">ROTEIRO ' + String(indice + 1).padStart(2, '0') + '</div>' +
        '<h2>' + esc(roteiro.titulo || 'Sem título') + '</h2>' +
        (roteiro.objetivo ? '<p class="qv-obj">' + esc(roteiro.objetivo) + '</p>' : '') +
        '<div class="qv-meta">' + B7.UI.chipRevisao(roteiro.status) +
          '<span>' + cenas.length + ' cena' + (cenas.length === 1 ? '' : 's') + '</span>' +
          '<span>editado ' + B7.UI.quando(roteiro.updated_at) + '</span></div>' +
        (roteiro.nota_interna ? '<div class="qv-nota"><b>NOTA INTERNA B7</b><p>' +
          esc(roteiro.nota_interna) + '</p></div>' : '') +
        '<div class="qv-mini" id="qv-mini"></div>' +
      '</div>' +

      '<footer class="qv-pe">' +
        '<button class="b pri" data-abrir>Abrir editor</button>' +
        '<button class="b contorno" data-baixar>Baixar</button>' +
        '<button class="b contorno" data-imprimir>Imprimir</button>' +
        '<button class="b contorno" data-duplicar>Duplicar</button>' +
      '</footer></aside>';

    document.body.appendChild(painel);
    requestAnimationFrame(() => painel.classList.add('aberto'));
    document.addEventListener('keydown', tecla);
    painel.addEventListener('mousedown', e => { if (e.target === painel) fechar(); });
    painel.querySelector('[data-fechar]').onclick = fechar;
    focarAoAbrir(painel, null);

    /* miniatura da folha, reduzida por transform — mesmo desenho da impressão */
    const mini = painel.querySelector('#qv-mini');
    mini.innerHTML = '<div class="qv-folha">' + B7.Folha.folhaHTML({
      cliente: ctx.cliente, clienteLogo: ctx.clienteLogo, gravacao: ctx.gravacao,
      dataGravacao: ctx.dataGravacao, roteiro: roteiro, cenas: cenas,
      indice: indice, total: ctx.roteiros.length
    }) + '</div>';
    const folha = mini.querySelector('.folha');
    if (roteiro.escala_automatica !== false) B7.Folha.ajustar(folha);
    const escala = (mini.clientWidth - 2) / 794;
    mini.querySelector('.qv-folha').style.transform = 'scale(' + escala + ')';
    mini.style.height = (1123 * escala) + 'px';

    painel.querySelector('[data-abrir]').onclick = () => {
      fechar();
      location.hash = '#/gravacao/' + ctx.gravacaoId + '?roteiro=' + roteiro.id;
    };
    painel.querySelector('[data-baixar]').onclick = () => { fechar(); B7.Export.abrirCentral(ctx, roteiro.id); };
    painel.querySelector('[data-imprimir]').onclick = () => { fechar(); B7.Impressao.abrirSelecao(ctx); };
    painel.querySelector('[data-duplicar]').onclick = async () => {
      try {
        await B7.Save.acao(() => B7.DB.duplicarRoteiro(roteiro, ctx.roteiros.length), 'Roteiro duplicado');
        fechar();
        B7.Rota.recarregar();
      } catch (e) {}
    };
  }

  /* -------------------------------------------------------------------
     Quick View de conteúdo (Card, Carrossel, Story).
     O Reel não passa por aqui: ele tem roteiro, então usa a espiada da
     ficha A4 acima. Cada formato mostra o que é seu — carrossel mostra a
     lista de slides, story mostra a sequência, card mostra headline e
     direção. Nada de campo vazio ocupando espaço.
     ------------------------------------------------------------------- */
  const IC_FMT = { Card: '▣', Carrossel: '❯', Story: '⬍', Reel: '▶' };

  async function abrirConteudo(conteudo, extra) {
    fechar();
    extra = extra || {};
    let slides = [], frames = [], roteiro = null;
    try {
      if (conteudo.tipo === 'Carrossel') slides = await B7.DB.listarSlides(conteudo.id);
      if (conteudo.tipo === 'Story') frames = await B7.DB.listarFrames(conteudo.id);
      if (conteudo.tipo === 'Reel' && conteudo.script_id) {
        roteiro = await B7.DB.roteiro(conteudo.script_id).catch(() => null);
      }
    } catch (e) { console.warn(e); }

    const campo = (rot, v) => !String(v || '').trim() ? '' :
      '<div class="qv-campo"><b>' + rot + '</b><p>' + esc(v) + '</p></div>';
    /* LEGENDA sempre com "Copiar legenda" junto — texto exato, canônico
       (persistido), sem prefixo nem aspas. Some junto com o campo quando
       não há legenda: nunca finge sucesso copiando um valor vazio. */
    const campoLegenda = v => {
      const t = String(v || '');
      if (!t.trim()) return '';
      return '<div class="qv-campo"><div class="qv-campo-cab"><b>LEGENDA</b>' +
        '<button type="button" class="qv-copiar" data-copiar-legenda aria-label="Copiar legenda">Copiar legenda</button></div>' +
        '<p>' + esc(t) + '</p></div>';
    };

    let corpo = campo('OBJETIVO', conteudo.objetivo) + campo('IDEIA GERAL', conteudo.ideia_geral);

    if (conteudo.tipo === 'Card') {
      corpo += campo('HEADLINE', conteudo.headline) + campo('SUB-HEADLINE', conteudo.sub_headline) +
        campo('DIREÇÃO VISUAL', conteudo.direcao) + campoLegenda(conteudo.legenda) +
        campo('OBSERVAÇÃO PARA O DESIGN', conteudo.observacao_design);
    }
    if (conteudo.tipo === 'Carrossel') {
      corpo += campo('CAPA / HEADLINE', conteudo.headline) +
        (slides.length ? '<div class="qv-campo"><b>SLIDES</b><div class="qv-slides">' +
          slides.map((sl, i) => '<div class="qv-slide"><span>' +
            String(i + 1).padStart(2, '0') + (i === 0 ? ' · CAPA' : '') + '</span>' +
            (sl.titulo ? '<b>' + esc(sl.titulo) + '</b>' : '') +
            (sl.texto ? '<p>' + esc(sl.texto) + '</p>' : '') + '</div>').join('') +
          '</div></div>'
          : '<div class="qv-campo"><b>SLIDES</b><p class="fraco">Nenhum slide ainda.</p></div>') +
        campoLegenda(conteudo.legenda);
    }
    if (conteudo.tipo === 'Story') {
      corpo += frames.length ? '<div class="qv-campo"><b>SEQUÊNCIA</b><div class="qv-slides">' +
        frames.map((f, i) => '<div class="qv-slide"><span>STORY ' + String(i + 1).padStart(2, '0') + '</span>' +
          (f.texto ? '<p>' + esc(f.texto) + '</p>' : '') +
          (f.direcao_visual ? '<p class="dir">' + esc(f.direcao_visual) + '</p>' : '') +
          '</div>').join('') + '</div></div>'
        : '<div class="qv-campo"><b>SEQUÊNCIA</b><p class="fraco">Nenhum story ainda.</p></div>';
    }
    if (conteudo.tipo === 'Reel') {
      corpo += campo('HEADLINE', conteudo.headline) +
        (roteiro ? '<div class="qv-campo"><b>ROTEIRO VINCULADO</b><p>' +
          esc(roteiro.titulo || 'Sem título') + '</p></div>'
          : '<div class="qv-campo"><b>ROTEIRO</b><p class="fraco">Nenhum roteiro vinculado.</p></div>') +
        /* mesmo "Copiar legenda" de Card e Carrossel — o Reel também tem
           legenda de post, e quem abre a visualização rápida normalmente
           está justamente indo copiar esse texto pra publicar */
        campoLegenda(conteudo.legenda);
    }
    corpo += campo('CTA', conteudo.cta);

    const selo = extra.clienteLogo
      ? '<div class="qv-selo"><img src="' + esc(extra.clienteLogo) + '" alt=""></div>'
      : '<div class="qv-selo">' + esc(B7.UI.iniciais(extra.cliente || 'B7')) + '</div>';

    /* Detalhe de Postagem (aba Postagens): ficha estritamente de leitura.
       "Editar conteúdo" vira "Abrir nos Criativos" e só aparece pra quem
       tem permissão real de editar Criativo — não é só esconder o botão,
       é a mesma regra que já trava a edição de verdade lá dentro. Nos
       outros contextos (espiada de Criativos), continua como sempre foi. */
    const contexto = extra.contexto || 'criativo';
    const ehPostagem = contexto === 'postagem';
    const rotuloEditar = ehPostagem ? 'Abrir nos Criativos' : 'Editar conteúdo';
    const mostrarEditar = ehPostagem ? !!extra.podeAbrirCriativos : true;
    const statusChip = (B7.Linha && B7.Linha.chipConteudo) ? B7.Linha.chipConteudo(conteudo.status) : B7.UI.chipRevisao(conteudo.status);

    painel = document.createElement('div');
    painel.className = 'qv-fundo';
    painel.innerHTML = '<aside class="qv" role="dialog" aria-modal="true"' +
      (ehPostagem ? ' aria-label="Detalhe da postagem"' : ' aria-label="Visualização rápida do conteúdo"') + '>' +
      '<header class="qv-topo">' + selo +
        '<div class="qv-ctx"><b>' + esc(extra.cliente || 'Cliente') + '</b>' +
        '<small>' + esc(extra.linha || 'Linha editorial') + '</small></div>' +
        '<button class="ico" data-fechar aria-label="Fechar">✕</button></header>' +
      '<div class="qv-corpo rolagem">' +
        '<div class="qv-num">' + IC_FMT[conteudo.tipo] + ' ' + esc(conteudo.tipo.toUpperCase()) + '</div>' +
        '<h2>' + esc(conteudo.titulo || 'Sem título') + '</h2>' +
        '<div class="qv-meta">' + statusChip +
          (conteudo.canal ? '<span>' + esc(conteudo.canal) + '</span>' : '') +
          '<span>' + (conteudo.data_postagem ? B7.UI.dataBR(conteudo.data_postagem) : 'sem data') + '</span>' +
        '</div>' + corpo +
      '</div>' +
      '<footer class="qv-pe">' +
        (mostrarEditar ? '<button class="b pri" data-editar>' + rotuloEditar + '</button>' : '') +
        (roteiro ? '<button class="b contorno" data-roteiro>Abrir roteiro</button>' : '') +
      '</footer></aside>';

    document.body.appendChild(painel);
    requestAnimationFrame(() => painel.classList.add('aberto'));
    document.addEventListener('keydown', tecla);
    painel.addEventListener('mousedown', e => { if (e.target === painel) fechar(); });
    painel.querySelector('[data-fechar]').onclick = fechar;
    focarAoAbrir(painel, extra.gatilho);
    const btnEditar = painel.querySelector('[data-editar]');
    if (btnEditar) btnEditar.onclick = () => {
      fechar();
      /* Quando a ficha foi aberta de FORA da Linha Editorial (ex.:
         Publicações do Dia), o módulo da Linha não tem esse conteúdo em
         memória e `abrirConteudo` não teria o que abrir. Nesse caso quem
         chamou informa `linhaId` e a gente navega por ID até a linha já
         com o Criativo aberto — nunca procurando o registro por título
         ou data. */
      if (extra.linhaId) {
        location.hash = '#/linha/' + extra.linhaId + '/criativos?conteudo=' + conteudo.id;
        return;
      }
      if (B7.Linha && B7.Linha.abrirConteudo) B7.Linha.abrirConteudo(conteudo.id);
    };
    const btnCopiarLegenda = painel.querySelector('[data-copiar-legenda]');
    if (btnCopiarLegenda) btnCopiarLegenda.onclick = () => B7.UI.copiarTexto(conteudo.legenda);
    const br = painel.querySelector('[data-roteiro]');
    if (br) br.onclick = () => {
      fechar();
      location.hash = '#/gravacao/' + roteiro.recording_session_id + '?roteiro=' + roteiro.id;
    };
  }

  return { abrir, abrirConteudo, fechar };
})();


/* =====================================================================
   APRESENTAÇÃO — mostrar os roteiros para o cliente, sem a interface
   ===================================================================== */
B7.Apresentar = (function () {
  let tela = null, atual = 0, ctx = null;

  function fechar() {
    if (!tela) return;
    document.removeEventListener('keydown', tecla);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    tela.remove(); tela = null;
  }
  function tecla(e) {
    if (e.key === 'Escape') return fechar();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(-1);
  }
  function ir(passo) {
    const total = ctx.roteiros.length;
    atual = Math.min(total - 1, Math.max(0, atual + passo));
    desenhar();
  }
  function desenhar() {
    const r = ctx.roteiros[atual];
    const palco = tela.querySelector('.ap-palco');
    palco.innerHTML = B7.Folha.folhaHTML({
      cliente: ctx.cliente, clienteLogo: ctx.clienteLogo, gravacao: ctx.gravacao,
      dataGravacao: ctx.dataGravacao, roteiro: r, cenas: ctx.cenasPorRoteiro[r.id] || [],
      indice: atual, total: ctx.roteiros.length
    });
    const folha = palco.querySelector('.folha');
    if (r.escala_automatica !== false) B7.Folha.ajustar(folha);
    /* a folha ocupa o máximo da tela sem cortar */
    const escala = Math.min((window.innerHeight - 150) / 1123, (window.innerWidth - 80) / 794);
    folha.style.transform = 'scale(' + escala + ')';
    palco.style.height = (1123 * escala) + 'px';
    tela.querySelector('.ap-contador').textContent =
      String(atual + 1).padStart(2, '0') + ' / ' + String(ctx.roteiros.length).padStart(2, '0');
    tela.querySelector('[data-ant]').disabled = atual === 0;
    tela.querySelector('[data-prox]').disabled = atual === ctx.roteiros.length - 1;
  }

  /* Nada de nota interna, ação administrativa ou dado técnico aqui. */
  function abrir(contexto, indice) {
    ctx = contexto;
    atual = indice || 0;
    tela = document.createElement('div');
    tela.className = 'apresentacao';
    tela.innerHTML =
      '<header class="ap-topo">' +
        '<img src="assets/brand/logo-white.png" alt="Branding7" class="ap-marca">' +
        '<div class="ap-ctx"><b>' + B7.UI.esc(ctx.cliente) + '</b>' +
        '<small>' + B7.UI.esc(ctx.gravacao) + '</small></div>' +
        '<div class="ap-espaco"></div>' +
        '<button class="b clara" data-tela>Tela cheia</button>' +
        '<button class="b clara" data-sair>Sair da apresentação</button>' +
      '</header>' +
      '<div class="ap-palco"></div>' +
      '<footer class="ap-pe">' +
        '<button class="b clara" data-ant>← Anterior</button>' +
        '<span class="ap-contador"></span>' +
        '<button class="b clara" data-prox>Próximo →</button>' +
      '</footer>';
    document.body.appendChild(tela);
    document.addEventListener('keydown', tecla);
    tela.querySelector('[data-sair]').onclick = fechar;
    tela.querySelector('[data-ant]').onclick = () => ir(-1);
    tela.querySelector('[data-prox]').onclick = () => ir(1);
    tela.querySelector('[data-tela]').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else tela.requestFullscreen().catch(() => {});
    };
    window.addEventListener('resize', () => { if (tela) desenhar(); });
    desenhar();
  }

  return { abrir, fechar };
})();
