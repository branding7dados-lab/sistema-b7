/* =====================================================================
   RESUMO DO MÊS — um documento 4:5 (1080 × 1350) por cliente e mês, para
   mandar ao cliente: o que foi planejado, publicado, produzido e gravado.

   Segue o MESMO padrão visual do Status Semanal (js/doc-semana.js,
   styles/semana.css → .pag45): cabeçalho escuro com a marca, faixa do
   cliente, corpo claro, rodapé B7. Sai como imagem (PNG) ou PDF 4:5.

   Não é tela nem módulo: é um documento, aberto pelo botão "Resumo do
   mês" da página do cliente. Só LÊ o que já existe (Linha Editorial,
   Design, Vídeo, Gravações), pelo mês de REFERÊNCIA — o mesmo recorte que
   a equipe já usa em cada uma dessas telas. Nada é gravado.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.ResumoMes = (function () {
  const esc = B7.UI.esc;
  const MESES = B7.UI.MESES;
  const FORMATOS = [['Reel', 'Reels'], ['Card', 'Cards'], ['Carrossel', 'Carrosséis'], ['Story', 'Stories']];
  const LARGURA = 1080, ALTURA = 1350;          /* 4:5, igual ao Status Semanal */
  const LEITURA_MAX = 800;
  const LOGO = 'assets/brand/logo-white.png', MARCA = 'assets/brand/symbol-color.png';
  const leituras = new Map();     /* cliente:ano-mes → leitura do mês digitada ou aplicada (só em memória) */

  const pad = n => String(n).padStart(2, '0');

  function calcular(d) {
    const cont = d.conteudos || [];
    const gravs = (d.gravacoes || []).filter(g => g.situacao !== 'Cancelada');
    return {
      planejados: cont.length,
      publicados: cont.filter(c => c.status === 'Publicado').length,
      programados: cont.filter(c => c.status === 'Programado').length,
      formatos: FORMATOS.map(([k, r]) => {
        const doTipo = cont.filter(c => c.tipo === k);
        return { rotulo: r, total: doTipo.length, publicados: doTipo.filter(c => c.status === 'Publicado').length };
      }).filter(f => f.total),
      artes: (d.design || []).length,
      artesProntas: (d.design || []).filter(x => x.status === 'finalizado' || x.status === 'aprovado_cliente').length,
      videos: (d.videos || []).length,
      videosEntregues: (d.videos || []).filter(v => v.editing_status === 'entregue').length,
      gravacoes: gravs.length,
      gravadas: gravs.filter(g => g.situacao === 'Gravada').length
    };
  }

  function kpi(n, de, rotulo, sub) {
    return '<div class="rm-kpi"><b>' + n + (de !== null ? '<i>/' + de + '</i>' : '') + '</b><span>' + esc(rotulo) + '</span>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
  }

  /* para o cliente só interessam três estados: foi ao ar, vai ao ar, em produção */
  function estado(c) {
    if (c.status === 'Publicado') return ['pub', 'Publicado'];
    if (c.status === 'Programado') return ['prog', 'Programado'];
    return ['prod', 'Em produção'];
  }
  function linhaConteudo(c, duas) {
    const [cls, rot] = estado(c);
    return '<div class="rm-linha"><span class="rm-data">' + (c.data_postagem ? esc(c.data_postagem.slice(8, 10) + '/' + c.data_postagem.slice(5, 7)) : '—') + '</span>' +
      (c.tipo ? '<span class="rm-tipo">' + esc(c.tipo) + '</span>' : '') +
      '<span class="rm-tit">' + esc(c.titulo || 'Sem título') + '</span>' +
      '<span class="rm-st ' + cls + '"><i></i>' + (duas ? '' : esc(rot)) + '</span></div>';
  }

  /* Monta a página. `n` = quantos conteúdos listar; `comFormatos` = mostra
     ou não o bloco de barras. Quem decide os dois é montar(), medindo. */
  function paginaHTML(cliente, ano, mes, d, leitura, n, comFormatos, nivel) {
    const r = calcular(d);
    const linhaEd = (d.linhas || [])[0] || null;
    const temLinha = !!linhaEd;
    const lista = (d.conteudos || []).slice().sort((a, b) =>
      String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));
    const visiveis = lista.slice(0, n);
    const duas = visiveis.length > 9;
    const maior = Math.max(1, ...r.formatos.map(f => f.total));

    return '<div class="pag45 rm45' + (nivel ? ' ' + nivel : '') + '">' +
      '<div class="ps-cabeca"><div class="ps-brilho"></div>' +
        '<div class="ps-cabeca-in"><div class="ps-olho"><i></i>B7 / BRANDING7</div>' +
          '<div class="ps-cab-linha"><h1>Resumo do mês</h1>' +
          '<span class="ps-periodo">' + esc(MESES[mes - 1]) + ' · ' + ano + '</span></div></div>' +
        '<img class="ps-logo" src="' + LOGO + '" alt="B7">' +
      '</div>' +

      '<div class="ps-cliente">' +
        (cliente.logo_url
          ? '<div class="ps-cli-logo"><img src="' + esc(cliente.logo_url) + '" alt="" crossorigin="anonymous"></div>'
          : '<div class="ps-cli-logo ps-cli-logo-vazio">' + esc((cliente.nome || '?').trim().slice(0, 1).toUpperCase()) + '</div>') +
        '<div><small>CLIENTE</small><b>' + esc(cliente.nome || '') + '</b></div>' +
        (linhaEd ? '<div class="ps-selo"><small>LINHA EDITORIAL</small><b>' + esc(linhaEd.nome || (MESES[mes - 1] + ' ' + ano)) + '</b></div>' : '') +
      '</div>' +

      '<div class="ps-corpo">' +
        (leitura ? '<div class="rm-leitura"><small>LEITURA DO MÊS</small><p>' + esc(leitura) + '</p></div>' : '') +

        '<div class="rm-kpis">' +
          kpi(r.publicados, temLinha ? r.planejados : null, 'Conteúdos publicados',
            !temLinha ? 'Sem linha editorial neste mês' : r.programados ? r.programados + ' programado' + (r.programados === 1 ? '' : 's') : 'do planejado no mês') +
          kpi(r.artesProntas, r.artes || null, 'Artes finalizadas', r.artes ? 'das peças do mês' : 'Nenhuma peça neste mês') +
          kpi(r.videosEntregues, r.videos || null, 'Vídeos entregues', r.videos ? 'das demandas do mês' : 'Nenhuma demanda neste mês') +
          kpi(r.gravadas, r.gravacoes || null, 'Gravações realizadas', r.gravacoes ? 'das gravações do mês' : 'Nenhuma gravação neste mês') +
        '</div>' +

        (comFormatos && r.formatos.length ? '<div class="rm-bloco"><h2>Conteúdos por formato</h2><div class="rm-formatos">' +
          r.formatos.map(f => '<div class="rm-formato"><span>' + esc(f.rotulo) + '</span>' +
            '<div class="rm-barra"><i style="width:' + Math.round((f.total / maior) * 100) + '%"><u style="width:' +
              Math.round((f.publicados / f.total) * 100) + '%"></u></i></div>' +
            '<b>' + f.publicados + ' de ' + f.total + '</b></div>').join('') +
          '</div></div>' : '') +

        '<div class="rm-bloco"><h2>Conteúdos do mês</h2>' +
          (visiveis.length
            ? '<div class="rm-tabela' + (duas ? ' duas' : '') + '"' + (duas ? ' style="grid-template-rows:repeat(' + Math.ceil(visiveis.length / 2) + ',auto)"' : '') + '>' +
                visiveis.map(c => linhaConteudo(c, duas)).join('') + '</div>' +
              '<div class="rm-legenda"><span class="rm-st pub"><i></i>Publicado</span><span class="rm-st prog"><i></i>Programado</span>' +
                '<span class="rm-st prod"><i></i>Em produção</span>' +
                (lista.length > visiveis.length ? '<b>+ ' + (lista.length - visiveis.length) + ' conteúdo' + (lista.length - visiveis.length === 1 ? '' : 's') + ' no mês</b>' : '') + '</div>'
            : '<p class="rm-vazio">' + (temLinha ? 'A linha editorial deste mês ainda não tem conteúdos.' : 'Não há linha editorial para este mês.') + '</p>') +
        '</div>' +
      '</div>' +

      '<div class="ps-rodape"><div class="esq"><img src="' + MARCA + '" alt="">' +
        '<span>B7 / BRANDING7 &nbsp;·&nbsp; RESUMO DO MÊS</span></div></div>' +
    '</div>';
  }

  /* UMA PÁGINA, SEMPRE — a mesma regra do Status Semanal: mede de verdade
     fora da tela. Primeiro tenta a lista inteira; se o corpo estourar,
     encurta a lista (até 6 linhas); se ainda assim não couber, tira o
     bloco de barras por formato (os números dele já estão na lista). */
  function montar(cliente, ano, mes, d, leitura, area) {
    leitura = String(leitura || '').replace(/\s+/g, ' ').trim().slice(0, LEITURA_MAX);
    const total = (d.conteudos || []).length;
    const medidor = document.createElement('div');
    medidor.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    (area || document.body).appendChild(medidor);
    const cabe = (n, comFormatos, nivel) => {
      medidor.innerHTML = paginaHTML(cliente, ano, mes, d, leitura, n, comFormatos, nivel);
      const c = medidor.querySelector('.ps-corpo');
      return c.scrollHeight <= c.clientHeight + 2;
    };
    /* mês leve preenche a página com letra grande (como no Status Semanal):
       testa do maior para o menor e só no último nível começa a cortar */
    let escolhido = null;
    for (const nivel of ['rm-enorme', 'rm-grande']) {
      if (cabe(total, true, nivel)) { escolhido = [total, true, nivel]; break; }
    }
    if (!escolhido) {
      for (const comFormatos of [true, false]) {
        for (let n = total; n >= Math.min(total, 6); n--) {
          if (cabe(n, comFormatos, '')) { escolhido = [n, comFormatos, '']; break; }
        }
        if (escolhido) break;
      }
    }
    if (!escolhido) escolhido = [Math.min(total, 4), false, ''];
    medidor.remove();
    return paginaHTML(cliente, ano, mes, d, leitura, escolhido[0], escolhido[1], escolhido[2]);
  }

  /* últimos 12 meses, o atual primeiro */
  function opcoesMes() {
    const h = new Date(); const op = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
      op.push([d.getFullYear() + '-' + pad(d.getMonth() + 1), MESES[d.getMonth()] + ' de ' + d.getFullYear()]);
    }
    return op;
  }

  const fontes = () => (B7.DocSemana && B7.DocSemana.carregarFontes ? B7.DocSemana.carregarFontes() : Promise.resolve());

  function abrir(cliente) {
    const meses = opcoesMes();
    const m = B7.UI.modal(
      '<h3>Resumo do mês</h3>' +
      '<div class="sub">' + esc(cliente.nome) + ' · uma imagem para enviar ao cliente, no mesmo padrão do Status Semanal.</div>' +
      '<div class="rm-barra-topo"><select class="campo fina" id="rm-mes" aria-label="Mês">' +
        meses.map(([v, r]) => '<option value="' + v + '">' + esc(r) + '</option>').join('') + '</select>' +
        '<span class="rm-aviso" id="rm-aviso"></span></div>' +
      '<div class="rm-leitura-cx">' +
        '<label class="rot" for="rm-leitura">LEITURA DO MÊS <span class="leve">— opcional, abre o resumo</span></label>' +
        '<textarea class="campo" id="rm-leitura" rows="4" maxlength="' + LEITURA_MAX + '" ' +
          'placeholder="Um parágrafo sobre o mês para o cliente. Escreva ou peça para a IA."></textarea>' +
        (B7.IATexto && B7.IATexto.ligado() ? '<div class="ia-texto-linha">' + B7.IATexto.botaoHTML('Escrever com IA') + '</div>' + B7.IATexto.painelHTML() : '') +
      '</div>' +
      '<div class="rm-previa" id="rm-previa"><div class="rm-carregando">Montando o resumo…</div></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button>' +
        '<button class="b contorno" id="rm-pdf" disabled>Baixar PDF</button>' +
        '<button class="b pri" id="rm-png" disabled>Baixar imagem</button></div>',
      { larga: true, extra: 'modal-resumo', aoFechar: () => window.removeEventListener('resize', ajustar) });

    const previa = m.querySelector('#rm-previa'), sel = m.querySelector('#rm-mes');
    const btPng = m.querySelector('#rm-png'), btPdf = m.querySelector('#rm-pdf');
    const campoLeitura = m.querySelector('#rm-leitura');
    let atual = null, vez = 0, dadosMes = null;
    const chaveMes = () => cliente.id + ':' + sel.value;

    function ajustar() {
      const pag = previa.querySelector('.pag45'); if (!pag) return;
      const z = Math.min(1, previa.clientWidth / LARGURA);
      pag.style.transform = 'scale(' + z + ')';
      previa.style.height = Math.round(ALTURA * z) + 'px';
    }

    /* a leitura não é gravada no banco: fica guardada enquanto o B7 está
       aberto, por cliente e mês, e sai no resumo do jeito que está no campo */
    function redesenhar() {
      if (!dadosMes) return;
      const [ano, mes] = sel.value.split('-').map(Number);
      atual = { ano, mes, leitura: campoLeitura.value };
      previa.innerHTML = montar(cliente, ano, mes, dadosMes, campoLeitura.value, previa);
      ajustar();
    }
    campoLeitura.oninput = B7.UI.debounce(() => { leituras.set(chaveMes(), campoLeitura.value); redesenhar(); }, 250);
    function ligarIA() {
      if (!B7.IATexto) return;
      const [ano, mes] = sel.value.split('-').map(Number);
      B7.IATexto.ligar(m.querySelector('.rm-leitura-cx'), {
        chave: 'mes:' + chaveMes(),
        titulo: 'Leitura do mês', base: 'A partir do planejamento e das entregas de ' + MESES[mes - 1],
        gerando: 'Escrevendo a leitura do mês…',
        pouco: 'Este mês ainda não tem registros para resumir.',
        nota: 'Confira os números antes de enviar. Nada entra no resumo até você aplicar.',
        dados: () => ({ operacao: 'resumo_mes', cliente_id: cliente.id, ano: ano, mes: mes }),
        atual: () => campoLeitura.value,
        aplicar: texto => { campoLeitura.value = texto; leituras.set(chaveMes(), texto); redesenhar(); }
      });
    }

    async function carregar() {
      const [ano, mes] = sel.value.split('-').map(Number);
      const minha = ++vez;
      btPng.disabled = btPdf.disabled = true; atual = null; dadosMes = null;
      campoLeitura.value = leituras.get(chaveMes()) || '';
      ligarIA();
      previa.style.height = ''; previa.innerHTML = '<div class="rm-carregando">Montando o resumo…</div>';
      try {
        /* as fontes precisam estar carregadas antes de medir o que cabe na página */
        const [d] = await Promise.all([B7.DB.resumoMensal(cliente.id, ano, mes), fontes()]);
        if (minha !== vez || !m.isConnected) return;
        dadosMes = d;
        redesenhar();
        btPng.disabled = btPdf.disabled = false;
      } catch (e) {
        if (minha !== vez) return;
        previa.innerHTML = '<div class="rm-carregando">Não foi possível montar o resumo. ' + esc(e.message || '') + '</div>';
      }
    }

    sel.onchange = carregar;
    window.addEventListener('resize', ajustar);

    /* mesma área fora da tela e mesmo caminho das exportações do Status
       Semanal: tamanho real (1080 × 1350), sem a escala da prévia */
    async function exportar(tipo, botao) {
      if (!atual || !dadosMes) return;
      const rot = botao.textContent; btPng.disabled = btPdf.disabled = true; botao.textContent = 'Gerando…';
      const area = document.getElementById('area-impressao');
      try {
        await fontes();
        area.style.display = 'block'; area.classList.add('modo-45');
        area.innerHTML = montar(cliente, atual.ano, atual.mes, dadosMes, atual.leitura, area);
        const pagina = area.querySelector('.pag45');
        await Promise.all([...pagina.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
        const canvas = await html2canvas(pagina, { scale: tipo === 'pdf' ? 3 : 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          windowWidth: pagina.offsetWidth, windowHeight: pagina.offsetHeight });
        const nome = [cliente.nome, 'RESUMO', MESES[atual.mes - 1], String(atual.ano)];
        if (tipo === 'pdf') {
          const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: [216, 270], orientation: 'portrait', compress: true });
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 216, 270, undefined, 'FAST');
          B7.Export.baixarBlob(pdf.output('blob'), B7.Export.nomeArquivo(nome, 'pdf'));
        } else {
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          B7.Export.baixarBlob(blob, B7.Export.nomeArquivo(nome, 'png'));
        }
        canvas.width = canvas.height = 0;
        B7.UI.toast('Resumo baixado');
      } catch (e) {
        B7.UI.toast('Não foi possível gerar o arquivo.', { tipo: 'erro' });
      } finally {
        area.innerHTML = ''; area.style.display = ''; area.classList.remove('modo-45');
        btPng.disabled = btPdf.disabled = false; botao.textContent = rot;
      }
    }
    btPng.onclick = () => exportar('png', btPng);
    btPdf.onclick = () => exportar('pdf', btPdf);

    carregar();
  }

  return { abrir, montar, calcular, LARGURA, ALTURA };
})();
