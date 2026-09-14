/* =====================================================================
   B7 VÍDEO — CENTRAL DO VIDEOMAKER (Parte 1)

   Escopo desta primeira etapa (ver migration_video.sql e o relatório de
   build): fila de Demandas de Edição, atribuição, mudança de situação,
   entrega por LINK EXTERNO (Drive/WeTransfer…) e importação de planilha
   (CSV). Não existe ainda revisão/versão do vídeo dentro do sistema —
   isso é fase futura, fora do que foi pedido aqui.

   Mesma arquitetura de B7 Design (js/design.js): leitura direta de uma
   view resumo, toda escrita passa por função do banco (js/database.js
   só embrulha as chamadas), papel decide o que aparece.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Video = (function () {
  const esc = B7.UI.esc;
  const painel = () => document.getElementById('painel-dashboard');
  const souEquipe = () => B7.Auth && ['admin', 'coordenador'].includes(B7.Auth.papel());
  const souVideomaker = () => B7.Auth && B7.Auth.papel() === 'videomaker';

  const SITUACOES = [
    ['pendente', 'Pendente'],
    ['em_edicao', 'Em edição'],
    ['correcao', 'Correção'],
    ['standby', 'Standby'],
    ['entregue', 'Entregue'],
    ['descartado', 'Descartado']
  ];
  const rotuloSituacao = s => (SITUACOES.find(x => x[0] === s) || [, s])[1];

  let demandas = [], clientes = [], videomakers = [];

  /* ================================================================
     CENTRAL — lista/quadro
     ================================================================ */
  async function abrir() {
    B7.Dashboard.marcarNav('#/video');
    B7.Rota.titulo(['Edição de vídeo']);
    painel().innerHTML = '<div class="conteudo vd-tela">' +
      '<header class="vd-cab"><h1>Edição de vídeo</h1>' +
      '<p>Carregando as demandas…</p></header>' +
      B7.UI.skeleton('tabela', { n: 4, cols: 3 }) + '</div>';

    try {
      const chamadas = [B7.DB.minhasDemandasVideo()];
      if (souEquipe()) chamadas.push(B7.DB.listarClientes(), B7.DB.listarVideomakers());
      const [d, c, v] = await Promise.all(chamadas);
      demandas = d || [];
      clientes = c || [];
      videomakers = v || [];
    } catch (e) {
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        '<b>Não foi possível carregar a Edição de vídeo.</b>' +
        '<p>' + esc(e.message || 'Confira a conexão e tente de novo.') + '</p>' +
        '<div class="acoes"><button class="b pri" onclick="location.reload()">Tentar de novo</button></div>' +
        '</div></div>';
      return;
    }
    desenhar();
  }

  function saudacao() {
    if (souVideomaker()) return 'O que precisa de você agora';
    return 'Demandas de edição';
  }

  function desenhar() {
    const grupos = SITUACOES.map(([chave, nome]) => ({
      chave, nome, itens: demandas.filter(d => d.editing_status === chave)
    }));

    painel().innerHTML = '<div class="conteudo vd-tela">' +
      '<header class="vd-cab"><div><h1>' + esc(saudacao()) + '</h1>' +
      '<p>' + demandas.length + ' demanda' + (demandas.length === 1 ? '' : 's') +
      (souVideomaker() ? ' atribuída' + (demandas.length === 1 ? '' : 's') + ' a você.' : ' no total.') + '</p></div>' +
      (souEquipe()
        ? '<div class="vd-acoes-topo">' +
          '<button class="b contorno" id="vd-importar">Importar planilha</button>' +
          '<button class="b pri" id="vd-nova">+ Nova demanda</button></div>'
        : '') +
      '</header>' +
      (demandas.length
        ? '<div class="vd-quadro">' + grupos.map(colunaHTML).join('') + '</div>'
        : '<div class="estado-b7"><b>' +
          (souVideomaker() ? 'Nenhuma demanda atribuída a você ainda.' : 'Nenhuma demanda de edição ainda.') +
          '</b><p>' + (souEquipe() ? 'Crie uma demanda manual ou importe uma planilha.' : 'Assim que a equipe atribuir algo, aparece aqui.') + '</p></div>') +
      '</div>';

    ligar();
  }

  function cardHTML(d) {
    const prazo = d.prazo ? B7.UI.dataBR(d.prazo) : '';
    const atrasado = d.prazo && d.editing_status !== 'entregue' && d.editing_status !== 'descartado' && d.prazo < B7.UI.hojeISO();
    return '<div class="vd-card" data-demanda="' + d.id + '" tabindex="0">' +
      '<div class="vd-card-topo"><b>' + esc(d.cliente_nome || 'Cliente') + '</b>' +
      (d.codigo ? '<span class="vd-codigo">' + esc(d.codigo) + '</span>' : '') + '</div>' +
      '<div class="vd-card-titulo">' + esc(d.titulo) + '</div>' +
      (d.pacote ? '<div class="vd-card-pacote">' + esc(d.pacote) + '</div>' : '') +
      '<div class="vd-card-rodape">' +
      (d.videomaker_nome ? '<span class="vd-quem">' + esc(d.videomaker_nome) + '</span>' : '<span class="vd-quem fraca">sem videomaker</span>') +
      (prazo ? '<span class="vd-prazo' + (atrasado ? ' atrasado' : '') + '">' + esc(prazo) + '</span>' : '') +
      '</div></div>';
  }

  function colunaHTML(g) {
    return '<div class="vd-coluna" data-coluna="' + g.chave + '">' +
      '<div class="vd-coluna-cab"><span>' + esc(g.nome) + '</span><b>' + g.itens.length + '</b></div>' +
      '<div class="vd-coluna-corpo">' +
      (g.itens.length ? g.itens.map(cardHTML).join('') : '<div class="vd-vazia">—</div>') +
      '</div></div>';
  }

  function ligar() {
    painel().querySelectorAll('[data-demanda]').forEach(el => {
      const ir = () => location.hash = '#/video/' + el.dataset.demanda;
      el.onclick = ir;
      el.onkeydown = e => { if (e.key === 'Enter') ir(); };
    });
    const btNova = document.getElementById('vd-nova');
    if (btNova) btNova.onclick = () => modalNovaDemanda();
    const btImportar = document.getElementById('vd-importar');
    if (btImportar) btImportar.onclick = () => modalImportar();
  }

  /* ================================================================
     NOVA DEMANDA (manual, equipe)
     ================================================================ */
  function modalNovaDemanda() {
    if (!clientes.length) { B7.UI.toast('Cadastre um cliente antes de criar uma demanda.'); return; }
    const m = B7.UI.modal(
      '<h3>Nova demanda de edição</h3>' +
      '<label class="rot">Cliente</label>' +
      '<select class="campo" id="vd-nd-cliente" data-foco>' +
        clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') +
      '</select>' +
      '<label class="rot">Título</label>' +
      '<input class="campo" id="vd-nd-titulo" placeholder="Ex.: Reel de lançamento">' +
      '<div class="vd-grid-2">' +
        '<div><label class="rot">Código (opcional)</label><input class="campo" id="vd-nd-codigo" placeholder="Ex.: 014"></div>' +
        '<div><label class="rot">Pacote (opcional)</label><input class="campo" id="vd-nd-pacote" placeholder="Ex.: Mensal 8 vídeos"></div>' +
      '</div>' +
      '<div class="vd-grid-2">' +
        '<div><label class="rot">Prazo (opcional)</label><input class="campo" type="date" id="vd-nd-prazo"></div>' +
        '<div><label class="rot">Videomaker (opcional)</label><select class="campo" id="vd-nd-videomaker">' +
          '<option value="">Sem atribuir ainda</option>' +
          videomakers.map(v => '<option value="' + v.id + '">' + esc(v.nome) + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<label class="rot">Vincular a uma gravação deste cliente (opcional)</label>' +
      '<select class="campo" id="vd-nd-gravacao"><option value="">Carregando…</option></select>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" id="vd-nd-salvar">Criar demanda</button></div>');

    const selGravacao = m.querySelector('#vd-nd-gravacao');
    const carregarGravacoes = async clienteId => {
      selGravacao.innerHTML = '<option value="">Carregando…</option>';
      try {
        const gs = await B7.DB.gravacoesDoClienteParaVideo(clienteId);
        selGravacao.innerHTML = '<option value="">Sem vínculo</option>' +
          gs.map(g => '<option value="' + g.id + '">' + esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</option>').join('');
      } catch (e) { selGravacao.innerHTML = '<option value="">Sem vínculo</option>'; }
    };
    carregarGravacoes(m.querySelector('#vd-nd-cliente').value);
    m.querySelector('#vd-nd-cliente').onchange = e => carregarGravacoes(e.target.value);

    m.querySelector('#vd-nd-salvar').onclick = async () => {
      const titulo = m.querySelector('#vd-nd-titulo').value.trim();
      if (!titulo) { B7.UI.toast('Dê um título para a demanda.'); return; }
      const btn = m.querySelector('#vd-nd-salvar');
      btn.disabled = true; btn.textContent = 'Criando…';
      try {
        await B7.DB.criarDemandaVideo({
          clienteId: m.querySelector('#vd-nd-cliente').value,
          titulo,
          codigo: m.querySelector('#vd-nd-codigo').value.trim(),
          pacote: m.querySelector('#vd-nd-pacote').value.trim(),
          prazo: m.querySelector('#vd-nd-prazo').value || null,
          videomakerId: m.querySelector('#vd-nd-videomaker').value || null,
          gravacaoId: selGravacao.value || null
        });
        m.fechar();
        B7.UI.toast('Demanda criada.');
        abrir();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Criar demanda';
        B7.UI.toast(e.message || 'Não foi possível criar a demanda.');
      }
    };
  }

  /* ================================================================
     DETALHE DE UMA DEMANDA
     ================================================================ */
  async function abrirDetalhe(id) {
    B7.Dashboard.marcarNav('#/video');
    B7.Rota.titulo(['Edição de vídeo', 'Demanda']);
    painel().innerHTML = '<div class="conteudo vd-tela">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';

    let d, historico;
    try {
      [d, historico] = await Promise.all([B7.DB.demandaVideo(id), B7.DB.historicoDemandaVideo(id)]);
      if (souEquipe() && !clientes.length) clientes = await B7.DB.listarClientes().catch(() => []);
      if (souEquipe() && !videomakers.length) videomakers = await B7.DB.listarVideomakers().catch(() => []);
    } catch (e) {
      painel().innerHTML = '<div class="conteudo vd-tela"><div class="estado-b7">' +
        '<b>Não foi possível abrir esta demanda.</b><p>' + esc(e.message || '') + '</p>' +
        '<div class="acoes"><button class="b" onclick="location.hash=\'#/video\'">Voltar</button></div>' +
        '</div></div>';
      return;
    }

    const podeEditar = souEquipe();
    const podeOperar = souEquipe() || d.videomaker_id === (B7.Auth.usuario() && B7.Auth.usuario().id);

    painel().innerHTML = '<div class="conteudo vd-tela vd-detalhe">' +
      '<div class="trilha"><a href="#/video">Edição de vídeo</a><span>/</span><b>' + esc(d.titulo) + '</b></div>' +
      '<header class="vd-cab"><div><h1>' + esc(d.titulo) + '</h1>' +
      '<p>' + esc(d.cliente_nome || '') + (d.codigo ? ' · ' + esc(d.codigo) : '') + '</p></div>' +
      (podeEditar ? '<button class="b fina contorno" id="vd-dt-excluir">Excluir</button>' : '') +
      '</header>' +

      '<div class="vd-dt-grid">' +
        '<div class="vd-dt-campo"><label class="rot">Situação</label>' +
        (podeOperar
          ? '<select class="campo" id="vd-dt-status">' +
            SITUACOES.map(([v, n]) => '<option value="' + v + '"' + (v === d.editing_status ? ' selected' : '') + '>' + n + '</option>').join('') +
            '</select>'
          : '<div class="vd-so-leitura">' + esc(rotuloSituacao(d.editing_status)) + '</div>') +
        '</div>' +
        '<div class="vd-dt-campo"><label class="rot">Videomaker</label>' +
        (podeEditar
          ? '<select class="campo" id="vd-dt-videomaker"><option value="">Sem atribuir</option>' +
            videomakers.map(v => '<option value="' + v.id + '"' + (v.id === d.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') +
            '</select>'
          : '<div class="vd-so-leitura">' + esc(d.videomaker_nome || 'sem videomaker') + '</div>') +
        '</div>' +
        '<div class="vd-dt-campo"><label class="rot">Prazo</label>' +
        (podeEditar ? '<input class="campo" type="date" id="vd-dt-prazo" value="' + (d.prazo || '') + '">' :
          '<div class="vd-so-leitura">' + (d.prazo ? esc(B7.UI.dataBR(d.prazo)) : '—') + '</div>') +
        '</div>' +
        '<div class="vd-dt-campo"><label class="rot">Pacote</label>' +
        (podeEditar ? '<input class="campo" id="vd-dt-pacote" value="' + esc(d.pacote || '') + '">' :
          '<div class="vd-so-leitura">' + esc(d.pacote || '—') + '</div>') +
        '</div>' +
        '<div class="vd-dt-campo"><label class="rot">Gravação vinculada</label>' +
        (podeEditar
          ? '<select class="campo" id="vd-dt-gravacao"><option value="">Carregando…</option></select>'
          : '<div class="vd-so-leitura">' + (d.gravacao_nome ? esc(d.gravacao_nome) + ' (' + esc(d.gravacao_situacao || '') + ')' : 'sem vínculo') + '</div>') +
        '</div>' +
      '</div>' +

      '<div class="vd-dt-campo vd-dt-link"><label class="rot">Link do material editado</label>' +
      (podeOperar
        ? '<div class="vd-link-linha"><input class="campo" id="vd-dt-link" placeholder="https://drive.google.com/…" value="' + esc(d.link_material || '') + '">' +
          '<button class="b" id="vd-dt-link-salvar">Salvar</button></div>' +
          '<p class="fraca">Link externo (Drive, WeTransfer…) — nesta etapa o vídeo não é enviado para dentro do sistema.</p>'
        : (d.link_material
            ? '<a class="b contorno" href="' + esc(d.link_material) + '" target="_blank" rel="noopener">Abrir material</a>'
            : '<div class="vd-so-leitura">Ainda sem link.</div>')) +
      '</div>' +

      (podeEditar
        ? '<div class="vd-dt-campo"><label class="rot">Observações</label>' +
          '<textarea class="campo alta" id="vd-dt-obs" rows="3">' + esc(d.observacoes || '') + '</textarea>' +
          '<div class="acoes"><button class="b pri" id="vd-dt-salvar">Salvar alterações</button></div></div>'
        : (d.observacoes ? '<div class="vd-dt-campo"><label class="rot">Observações</label><div class="vd-so-leitura">' + esc(d.observacoes) + '</div></div>' : '')) +

      '<div class="vd-dt-campo"><label class="rot">Histórico</label>' +
      (historico.length
        ? '<ul class="vd-timeline">' + historico.map(linhaHistorico).join('') + '</ul>'
        : '<div class="vd-so-leitura">Sem eventos ainda.</div>') +
      '</div>' +
    '</div>';

    ligarDetalhe(d);
  }

  function linhaHistorico(ev) {
    let texto;
    if (ev.tipo === 'criada') texto = 'Demanda criada';
    else if (ev.tipo === 'atribuida') texto = ev.mensagem === 'Atribuição removida' ? 'Atribuição removida' : 'Videomaker atribuído';
    else if (ev.tipo === 'status') texto = 'Situação mudou para "' + esc(rotuloSituacao(ev.para_status)) + '"';
    else if (ev.tipo === 'link_material') texto = 'Link do material atualizado';
    else texto = esc(ev.tipo);
    return '<li><b>' + esc(ev.ator_nome || 'Alguém') + '</b> — ' + texto +
      (ev.mensagem && ev.tipo === 'status' ? '<div class="vd-tl-msg">' + esc(ev.mensagem) + '</div>' : '') +
      '<span class="vd-tl-quando">' + esc(B7.UI.quando ? B7.UI.quando(ev.created_at) : ev.created_at) + '</span></li>';
  }

  function ligarDetalhe(d) {
    const selStatus = document.getElementById('vd-dt-status');
    if (selStatus) selStatus.onchange = async () => {
      const novo = selStatus.value;
      let mensagem = null;
      if (novo === 'correcao') {
        mensagem = await B7.UI.perguntar({ titulo: 'O que precisa corrigir?', confirmar: 'Marcar correção' });
        if (mensagem === null) { selStatus.value = d.editing_status; return; }
      }
      try {
        await B7.DB.mudarStatusVideo(d.id, novo, mensagem || null);
        B7.UI.toast('Situação atualizada.');
        abrirDetalhe(d.id);
      } catch (e) { B7.UI.toast(e.message || 'Não foi possível mudar a situação.'); selStatus.value = d.editing_status; }
    };

    const selVm = document.getElementById('vd-dt-videomaker');
    if (selVm) selVm.onchange = async () => {
      try { await B7.DB.atribuirVideo(d.id, selVm.value || null); B7.UI.toast('Atribuição atualizada.'); abrirDetalhe(d.id); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível atribuir.'); selVm.value = d.videomaker_id || ''; }
    };

    const btLink = document.getElementById('vd-dt-link-salvar');
    if (btLink) btLink.onclick = async () => {
      const link = document.getElementById('vd-dt-link').value.trim();
      btLink.disabled = true;
      try { await B7.DB.definirLinkVideo(d.id, link); B7.UI.toast('Link salvo.'); }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar o link.'); }
      finally { btLink.disabled = false; }
    };

    const selGravacaoDt = document.getElementById('vd-dt-gravacao');
    if (selGravacaoDt) {
      B7.DB.gravacoesDoClienteParaVideo(d.client_id).then(gs => {
        selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>' +
          gs.map(g => '<option value="' + g.id + '"' + (g.id === d.gravacao_id ? ' selected' : '') + '>' +
            esc(g.nome) + (g.data_gravacao ? ' · ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</option>').join('');
      }).catch(() => { selGravacaoDt.innerHTML = '<option value="">Sem vínculo</option>'; });
    }

    const btSalvar = document.getElementById('vd-dt-salvar');
    if (btSalvar) btSalvar.onclick = async () => {
      btSalvar.disabled = true; btSalvar.textContent = 'Salvando…';
      try {
        await B7.DB.editarDemandaVideo(d.id, {
          pacote: document.getElementById('vd-dt-pacote').value.trim(),
          prazo: document.getElementById('vd-dt-prazo').value || null,
          temPrazo: true,
          observacoes: document.getElementById('vd-dt-obs').value.trim(),
          gravacaoId: document.getElementById('vd-dt-gravacao').value || null,
          temGravacao: true
        });
        B7.UI.toast('Alterações salvas.');
        abrirDetalhe(d.id);
      } catch (e) {
        btSalvar.disabled = false; btSalvar.textContent = 'Salvar alterações';
        B7.UI.toast(e.message || 'Não foi possível salvar.');
      }
    };

    const btExcluir = document.getElementById('vd-dt-excluir');
    if (btExcluir) btExcluir.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Excluir esta demanda?', texto: 'A demanda sai da lista. Isso não apaga o histórico.', perigo: true, rotulo: 'Excluir' });
      if (!ok) return;
      try { await B7.DB.excluirDemandaVideo(d.id); B7.UI.toast('Demanda excluída.'); location.hash = '#/video'; }
      catch (e) { B7.UI.toast(e.message || 'Não foi possível excluir.'); }
    };
  }

  /* ================================================================
     IMPORTAÇÃO DE PLANILHA (CSV ou XLSX)
     O navegador lê e interpreta o arquivo; o banco só recebe JSON já
     pronto (ver migration_video.sql, seção 13). Colunas esperadas no
     cabeçalho (nem todas obrigatórias): cliente, titulo, codigo,
     pacote, prazo, observacoes, ano, mes.

     XLSX usa a biblioteca SheetJS (js/vendor/xlsx.full.min.js, mesmo
     padrão de vendorização do html2canvas/jspdf) — lê só a primeira
     aba do arquivo. Testado com arquivos .xlsx sintéticos gerados
     para este build (cabeçalho normal, datas, acentos); **não foi
     testado contra uma planilha real do usuário**, porque nenhuma foi
     fornecida — ver o relatório do build para o que isso significa na
     prática.
     ================================================================ */
  function normalizarCabecalho(h) {
    return String(h == null ? '' : h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function parseCSV(texto) {
    const linhas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!linhas.length) return [];
    const sep = linhas[0].includes(';') && !linhas[0].includes(',') ? ';' : ',';
    const partirLinha = l => {
      const campos = []; let atual = '', dentro = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { if (dentro && l[i + 1] === '"') { atual += '"'; i++; } else { dentro = !dentro; } }
        else if (c === sep && !dentro) { campos.push(atual); atual = ''; }
        else atual += c;
      }
      campos.push(atual);
      return campos.map(x => x.trim());
    };
    const cab = partirLinha(linhas[0]).map(normalizarCabecalho);
    return linhas.slice(1).map(l => {
      const campos = partirLinha(l);
      const obj = {};
      cab.forEach((h, i) => { obj[h] = campos[i] || ''; });
      return obj;
    });
  }

  /* lê só a primeira aba; datas viram texto AAAA-MM-DD (dateNF), pronto
     para o `prazo::date` do banco. Linhas totalmente vazias são
     descartadas (planilha real sempre tem algumas no fim). */
  function parseXLSX(arrayBuffer) {
    if (!window.XLSX) throw new Error('Biblioteca de leitura de XLSX não carregou.');
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const aba = wb.SheetNames[0];
    if (!aba) return [];
    const bruto = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
    if (!bruto.length) return [];
    const cab = bruto[0].map(normalizarCabecalho);
    return bruto.slice(1)
      .filter(l => l.some(v => String(v).trim() !== ''))
      .map(l => {
        const obj = {};
        cab.forEach((h, i) => { obj[h] = l[i] != null ? String(l[i]).trim() : ''; });
        return obj;
      });
  }

  function modalImportar() {
    const m = B7.UI.modal(
      '<h3>Importar planilha (CSV ou XLSX)</h3>' +
      '<p class="fraca">O arquivo precisa de uma linha de cabeçalho com (ao menos) as colunas ' +
      '<code>cliente</code> e <code>titulo</code>. Colunas opcionais: <code>codigo</code>, <code>pacote</code>, ' +
      '<code>prazo</code> (AAAA-MM-DD), <code>observacoes</code>, <code>ano</code>, <code>mes</code>. ' +
      'No XLSX só a primeira aba do arquivo é lida.</p>' +
      '<input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="vd-imp-arquivo" data-foco>' +
      '<div id="vd-imp-resultado"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true });

    m.querySelector('#vd-imp-arquivo').onchange = async ev => {
      const arquivo = ev.target.files[0];
      if (!arquivo) return;
      const ehXlsx = /\.xlsx?$/i.test(arquivo.name);
      let linhas;
      try {
        linhas = ehXlsx ? parseXLSX(await arquivo.arrayBuffer()) : parseCSV(await arquivo.text());
      } catch (e) {
        B7.UI.toast('Não foi possível ler este arquivo (' + (e.message || 'formato inválido') + ').');
        return;
      }
      if (!linhas.length) { B7.UI.toast('Planilha vazia.'); return; }

      const area = m.querySelector('#vd-imp-resultado');
      area.innerHTML = '<p>Processando ' + linhas.length + ' linha(s)…</p>';
      let loteId;
      try { loteId = await B7.DB.importarPlanilhaVideo(arquivo.name, linhas); }
      catch (e) { area.innerHTML = '<p class="vd-erro">' + esc(e.message || 'Falha ao importar.') + '</p>'; return; }
      await desenharResultadoImportacao(area, loteId);
    };
  }

  async function desenharResultadoImportacao(area, loteId) {
    const [lote, linhasImp] = await Promise.all([
      B7.DB.loteImportacaoVideo(loteId), B7.DB.linhasImportacaoVideo(loteId)
    ]);
    if (!clientes.length) clientes = await B7.DB.listarClientes().catch(() => []);

    const pendentes = linhasImp.filter(l => !l.confirmada);
    area.innerHTML =
      '<p><b>' + lote.linhas_ok + '</b> linha(s) prontas, <b>' + lote.linhas_erro + '</b> com pendência, de ' + lote.total_linhas + ' no total.</p>' +
      '<table class="vd-imp-tabela"><thead><tr><th>#</th><th>Cliente (planilha)</th><th>Título</th><th>Situação</th><th></th></tr></thead><tbody>' +
      pendentes.map(l => '<tr data-linha="' + l.id + '">' +
        '<td>' + l.linha_numero + '</td>' +
        '<td>' + esc(l.cliente_nome_planilha || '—') + '</td>' +
        '<td>' + esc((l.dados_originais && l.dados_originais.titulo) || '—') + '</td>' +
        '<td>' + (l.resolvida
          ? '<span class="vd-ok">pronta</span>'
          : '<select class="campo fina" data-resolver="' + l.id + '"><option value="">resolver cliente…</option>' +
            clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select>') +
        '</td><td>' + (l.problemas && l.problemas.length ? esc(l.problemas.join(', ')) : '') + '</td>' +
        '</tr>').join('') +
      '</tbody></table>' +
      (pendentes.length
        ? '<div class="acoes"><button class="b pri" id="vd-imp-confirmar">Confirmar linhas prontas</button></div>'
        : '<p class="vd-ok">Tudo confirmado.</p>');

    area.querySelectorAll('[data-resolver]').forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      try {
        await B7.DB.resolverLinhaImportacaoVideo(sel.dataset.resolver, sel.value, true);
        await desenharResultadoImportacao(area, loteId);
      } catch (e) { B7.UI.toast(e.message || 'Não foi possível resolver esta linha.'); }
    });

    const btConfirmar = area.querySelector('#vd-imp-confirmar');
    if (btConfirmar) btConfirmar.onclick = async () => {
      btConfirmar.disabled = true; btConfirmar.textContent = 'Confirmando…';
      try {
        const n = await B7.DB.confirmarLoteImportacaoVideo(loteId);
        B7.UI.toast(n + ' demanda(s) criada(s).');
        await desenharResultadoImportacao(area, loteId);
        abrir();
      } catch (e) {
        btConfirmar.disabled = false; btConfirmar.textContent = 'Confirmar linhas prontas';
        B7.UI.toast(e.message || 'Não foi possível confirmar.');
      }
    };
  }

  return { abrir, abrirDetalhe };
})();
