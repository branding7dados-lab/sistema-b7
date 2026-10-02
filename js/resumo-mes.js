/* =====================================================================
   RESUMO DO MÊS — uma folha A4 por cliente e mês, para a reunião com o
   cliente: o que foi planejado, publicado, produzido e gravado.

   Não é tela nem módulo: é um documento, aberto pelo "⋯" da página do
   cliente. Só LÊ o que já existe (Linha Editorial, Design, Vídeo,
   Gravações), pelo mês de REFERÊNCIA — o mesmo recorte que a equipe já
   usa em cada uma dessas telas. Nada é gravado.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.ResumoMes = (function () {
  const esc = B7.UI.esc;
  const MESES = B7.UI.MESES;
  const FORMATOS = [['Reel', 'Reels'], ['Card', 'Cards'], ['Carrossel', 'Carrosséis'], ['Story', 'Stories']];
  const MAX_LINHAS = 22;
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

  /* `leitura`: parágrafo opcional que abre a folha (escrito pela equipe,
     com ou sem a ajuda da IA). Ocupa o lugar de algumas linhas da lista. */
  const LEITURA_MAX = 600;
  function folhaHTML(cliente, ano, mes, d, leitura) {
    const r = calcular(d);
    const temLinha = (d.linhas || []).length > 0;
    const lista = (d.conteudos || []).slice().sort((a, b) =>
      String(a.data_postagem || '9999').localeCompare(String(b.data_postagem || '9999')));
    leitura = String(leitura || '').replace(/\s+/g, ' ').trim().slice(0, LEITURA_MAX);
    /* ~98 caracteres por linha de 20px + título e respiro; cada linha da lista tem 27px */
    const custo = leitura ? Math.ceil((Math.ceil(leitura.length / 98) * 20 + 58) / 27) : 0;
    const visiveis = lista.slice(0, Math.max(6, MAX_LINHAS - custo));
    const logo = cliente.logo_url
      ? '<img class="rm-logo" src="' + esc(cliente.logo_url) + '" alt="" crossorigin="anonymous">'
      : '<span class="rm-logo rm-logo-ini">' + esc(B7.UI.iniciais(cliente.nome)) + '</span>';
    const maior = Math.max(1, ...r.formatos.map(f => f.total));

    return '<div class="rm-folha">' +
      '<header class="rm-topo">' + logo +
        '<div class="rm-topo-tx"><small>RESUMO DO MÊS</small><h1>' + esc(cliente.nome) + '</h1></div>' +
        '<div class="rm-mes"><b>' + esc(MESES[mes - 1]) + '</b><span>' + ano + '</span></div>' +
      '</header>' +

      '<section class="rm-kpis">' +
        kpi(r.publicados, temLinha ? r.planejados : null, 'Conteúdos publicados',
          !temLinha ? 'Sem linha editorial neste mês' : r.programados ? r.programados + ' programado' + (r.programados === 1 ? '' : 's') : 'do planejado no mês') +
        kpi(r.artesProntas, r.artes || null, 'Artes finalizadas', r.artes ? 'das peças da linha do mês' : 'Nenhuma peça neste mês') +
        kpi(r.videosEntregues, r.videos || null, 'Vídeos entregues', r.videos ? 'das demandas do mês' : 'Nenhuma demanda neste mês') +
        kpi(r.gravadas, r.gravacoes || null, 'Gravações realizadas', r.gravacoes ? 'das gravações do mês' : 'Nenhuma gravação neste mês') +
      '</section>' +

      (leitura ? '<section class="rm-bloco rm-leitura"><h2>Leitura do mês</h2><p>' + esc(leitura) + '</p></section>' : '') +

      (r.formatos.length ? '<section class="rm-bloco"><h2>Conteúdos por formato</h2><div class="rm-formatos">' +
        r.formatos.map(f => '<div class="rm-formato"><span>' + esc(f.rotulo) + '</span>' +
          '<div class="rm-barra"><i style="width:' + Math.round((f.total / maior) * 100) + '%"><u style="width:' +
            Math.round((f.publicados / f.total) * 100) + '%"></u></i></div>' +
          '<b>' + f.publicados + ' de ' + f.total + '</b></div>').join('') +
        '</div><p class="rm-legenda"><i class="rm-q rm-q-pub"></i>publicado <i class="rm-q rm-q-plan"></i>planejado</p></section>' : '') +

      '<section class="rm-bloco rm-cresce"><h2>Conteúdos do mês</h2>' +
        (visiveis.length
          ? '<div class="rm-tabela">' + visiveis.map(c =>
              '<div class="rm-linha"><span class="rm-data">' + (c.data_postagem ? esc(c.data_postagem.slice(8, 10) + '/' + c.data_postagem.slice(5, 7)) : '—') + '</span>' +
              '<span class="rm-tipo">' + esc(c.tipo || '') + '</span>' +
              '<span class="rm-tit">' + esc(c.titulo || 'Sem título') + '</span>' +
              '<span class="rm-st' + (c.status === 'Publicado' ? ' ok' : '') + '">' + esc(c.status || '') + '</span></div>').join('') +
            (lista.length > visiveis.length ? '<div class="rm-mais">+ ' + (lista.length - visiveis.length) + ' conteúdos</div>' : '') + '</div>'
          : '<p class="rm-vazio">' + (temLinha ? 'A linha editorial deste mês ainda não tem conteúdos.' : 'Não há linha editorial para este mês.') + '</p>') +
      '</section>' +

      '<footer class="rm-pe"><img src="assets/brand/symbol-color.png" alt=""><span>Branding7 · ' +
        esc(MESES[mes - 1]) + ' de ' + ano + ' · gerado em ' + esc(B7.UI.dataBR(B7.UI.hojeISO())) + '</span></footer>' +
    '</div>';
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

  function abrir(cliente) {
    const meses = opcoesMes();
    const m = B7.UI.modal(
      '<h3>Resumo do mês</h3>' +
      '<div class="sub">' + esc(cliente.nome) + ' · uma folha para levar à reunião com o cliente.</div>' +
      '<div class="rm-barra-topo"><select class="campo fina" id="rm-mes" aria-label="Mês">' +
        meses.map(([v, r]) => '<option value="' + v + '">' + esc(r) + '</option>').join('') + '</select>' +
        '<span class="rm-aviso" id="rm-aviso"></span></div>' +
      '<div class="rm-leitura-cx">' +
        '<label class="rot" for="rm-leitura">LEITURA DO MÊS <span class="leve">— opcional, abre a folha</span></label>' +
        '<textarea class="campo" id="rm-leitura" rows="3" maxlength="' + LEITURA_MAX + '" ' +
          'placeholder="Um parágrafo sobre o mês para o cliente. Escreva ou peça para a IA."></textarea>' +
        (B7.IATexto && B7.IATexto.ligado() ? '<div class="ia-texto-linha">' + B7.IATexto.botaoHTML('Escrever com IA') + '</div>' + B7.IATexto.painelHTML() : '') +
      '</div>' +
      '<div class="rm-previa" id="rm-previa"><div class="rm-carregando">Montando o resumo…</div></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button>' +
        '<button class="b pri" id="rm-baixar" disabled>Baixar PDF</button></div>',
      { larga: true, extra: 'modal-resumo', aoFechar: () => window.removeEventListener('resize', ajustar) });

    const previa = m.querySelector('#rm-previa'), sel = m.querySelector('#rm-mes'), baixar = m.querySelector('#rm-baixar');
    const campoLeitura = m.querySelector('#rm-leitura');
    let atual = null, vez = 0, dadosMes = null;
    const chaveMes = () => cliente.id + ':' + sel.value;

    /* a leitura não é gravada no banco: fica guardada enquanto o B7 está
       aberto, por cliente e mês, e sai na folha do jeito que está no campo */
    function redesenhar() {
      if (!dadosMes) return;
      const [ano, mes] = sel.value.split('-').map(Number);
      atual = { ano, mes, html: folhaHTML(cliente, ano, mes, dadosMes, campoLeitura.value) };
      previa.innerHTML = atual.html;
      ajustar();
    }
    campoLeitura.oninput = B7.UI.debounce(() => { leituras.set(chaveMes(), campoLeitura.value); redesenhar(); }, 250);
    function ligarIA() {
      if (!B7.IATexto) return;
      const [ano, mes] = sel.value.split('-').map(Number);
      B7.IATexto.ligar(m.querySelector('.rm-leitura-cx'), {
        chave: 'mes:' + chaveMes(),
        titulo: 'Leitura do mês', base: 'A partir dos números de ' + MESES[mes - 1],
        gerando: 'Escrevendo a leitura do mês…',
        pouco: 'Este mês ainda não tem registros para resumir.',
        nota: 'Confira os números antes de enviar. Nada entra na folha até você aplicar.',
        dados: () => ({ operacao: 'resumo_mes', cliente_id: cliente.id, ano: ano, mes: mes }),
        atual: () => campoLeitura.value,
        aplicar: texto => { campoLeitura.value = texto; leituras.set(chaveMes(), texto); redesenhar(); }
      });
    }

    function ajustar() {
      const folha = previa.querySelector('.rm-folha'); if (!folha) return;
      const z = Math.min(1, previa.clientWidth / 794);
      folha.style.transform = 'scale(' + z + ')';
      previa.style.height = Math.round(1123 * z) + 'px';
    }

    async function carregar() {
      const [ano, mes] = sel.value.split('-').map(Number);
      const minha = ++vez;
      baixar.disabled = true; atual = null; dadosMes = null;
      campoLeitura.value = leituras.get(chaveMes()) || '';
      ligarIA();
      previa.style.height = ''; previa.innerHTML = '<div class="rm-carregando">Montando o resumo…</div>';
      try {
        const d = await B7.DB.resumoMensal(cliente.id, ano, mes);
        if (minha !== vez || !m.isConnected) return;
        dadosMes = d;
        redesenhar();
        baixar.disabled = false;
      } catch (e) {
        if (minha !== vez) return;
        previa.innerHTML = '<div class="rm-carregando">Não foi possível montar o resumo. ' + esc(e.message || '') + '</div>';
      }
    }

    sel.onchange = carregar;
    window.addEventListener('resize', ajustar);

    baixar.onclick = async () => {
      if (!atual) return;
      const rot = baixar.textContent; baixar.disabled = true; baixar.textContent = 'Gerando…';
      const area = document.getElementById('area-impressao');
      try {
        /* mesma área fora da tela das outras exportações: tamanho real, sem escala */
        area.innerHTML = atual.html; area.style.display = 'block';
        const folha = area.querySelector('.rm-folha');
        await Promise.all([...folha.querySelectorAll('img')].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
        const canvas = await html2canvas(folha, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          windowWidth: 794, windowHeight: 1123 });
        const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        pdf.save(B7.Export.nomeArquivo([cliente.nome, 'RESUMO', MESES[atual.mes - 1], String(atual.ano)], 'pdf'));
        B7.UI.toast('Resumo baixado');
      } catch (e) {
        B7.UI.toast('Não foi possível gerar o PDF.', { tipo: 'erro' });
      } finally {
        area.innerHTML = ''; area.style.display = '';
        baixar.disabled = false; baixar.textContent = rot;
      }
    };

    carregar();
  }

  return { abrir, folhaHTML, calcular };
})();
