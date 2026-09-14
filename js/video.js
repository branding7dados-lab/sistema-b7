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
     pronto (ver migration_video.sql, seção 13, e
     migration_video_import_fix.sql). Testado contra uma planilha real
     de produção (732 linhas, cabeçalho "Mês, Cliente, Pacote, Cód.,
     Briefing / Título, Prioridade, Data de Gravação, Prazo de
     ENTREGA, STATUS, Responsável, Observações", com uma linha de lixo
     antes do cabeçalho de verdade) — ver o relatório do build.

     Como planilha real de produção quase nunca usa exatamente
     "cliente"/"titulo" como cabeçalho (a primeira tentativa deste
     módulo assumia isso e falhou contra a planilha real do Yury: toda
     linha caía como "sem_nome_de_cliente, sem_titulo"), a leitura
     agora faz duas coisas que a primeira versão não fazia:

     1) Acha a linha de cabeçalho de verdade em vez de assumir que é a
        primeira linha do arquivo — pontua as primeiras linhas por
        quantas colunas reconhecidas elas têm e usa a que pontuar mais
        (raspa de fora qualquer linha de lixo antes do cabeçalho).
     2) Casa CADA coluna por uma lista de sinônimos (ex.: "titulo" e
        "briefing" mapeiam pra `titulo`; "cod" casa com "Cód.";
        "gravacao" casa com "Data de Gravação"), não por igualdade
        exata do nome da coluna.

     Colunas reconhecidas (nenhuma obrigatória, exceto ter cliente e
     título pra a linha valer alguma coisa): cliente, titulo (ou
     briefing), codigo (cod), pacote, prazo, mes/competência
     ("Mês" no formato "julho/2026"), status (ENTREGUE/DESCARTADO/
     PENDENTE/EDIÇÃO/CORREÇÃO/STANDBY — vira a situação inicial da
     demanda), observações, prioridade e responsável (planilha) — as
     duas últimas não têm campo próprio no sistema ainda, então
     entram como texto dentro de observações, pra não se perder.
     Datas em DD/MM/AAAA (formato brasileiro) são convertidas para
     AAAA-MM-DD.
     ================================================================ */
  function normalizarCabecalho(h) {
    return String(h == null ? '' : h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  const SINONIMOS_COLUNA = {
    cliente: ['cliente'],
    titulo: ['titulo', 'briefing'],
    codigo: ['cod'],
    pacote: ['pacote'],
    prazo: ['prazo'],
    competencia: ['mes'],
    status: ['status', 'situacao'],
    observacoes: ['observaco'],
    prioridade: ['prioridade'],
    responsavel: ['responsavel'],
    data_gravacao: ['gravacao']
  };

  function mapearColunas(cabecalhoNormalizado) {
    const mapa = {};
    cabecalhoNormalizado.forEach((h, i) => {
      if (!h) return;
      for (const campo in SINONIMOS_COLUNA) {
        if (mapa[campo] !== undefined) continue;
        if (SINONIMOS_COLUNA[campo].some(chave => h.includes(chave))) { mapa[campo] = i; break; }
      }
    });
    return mapa;
  }

  /* varre as primeiras linhas do arquivo e escolhe a que "parece mais
     um cabeçalho" (mais colunas reconhecidas) — assim uma linha de
     lixo antes do cabeçalho de verdade (comum em planilha exportada
     à mão) não vira o cabeçalho por engano. */
  function acharLinhaCabecalho(bruto) {
    let melhorIndice = 0, melhorPontuacao = -1;
    for (let i = 0; i < Math.min(bruto.length, 15); i++) {
      const pontos = Object.keys(mapearColunas(bruto[i].map(normalizarCabecalho))).length;
      if (pontos > melhorPontuacao) { melhorPontuacao = pontos; melhorIndice = i; }
    }
    return melhorIndice;
  }

  const MESES_PT = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  function parseCompetencia(v) {
    const m = normalizarCabecalho(v).match(/([a-z]+)\s*\/\s*(\d{4})/);
    const mes = m && MESES_PT[m[1]];
    return mes ? { ano: m[2], mes: String(mes) } : {};
  }

  /* aceita DD/MM/AAAA (planilha brasileira) ou já AAAA-MM-DD; qualquer
     outra coisa vira '' (sem prazo) em vez de quebrar a importação. */
  function parseDataBR(v) {
    const s = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
  }

  const STATUS_PLANILHA = {
    entregue: 'entregue', descartado: 'descartado', pendente: 'pendente',
    edicao: 'em_edicao', 'em edicao': 'em_edicao', correcao: 'correcao',
    ajuste: 'correcao', ajustes: 'correcao', standby: 'standby'
  };
  function parseStatus(v) { return STATUS_PLANILHA[normalizarCabecalho(v)] || ''; }

  /* bruto: array de linhas, cada linha um array de células (mesmo
     formato pra CSV e XLSX) — a partir daqui os dois caminhos usam a
     mesma lógica de achar cabeçalho e montar as linhas. */
  function linhasParaObjetos(bruto) {
    if (!bruto.length) return [];
    const idxCab = acharLinhaCabecalho(bruto);
    const mapa = mapearColunas(bruto[idxCab].map(normalizarCabecalho));
    const pegar = (linha, campo) => mapa[campo] !== undefined ? String(linha[mapa[campo]] == null ? '' : linha[mapa[campo]]).trim() : '';

    return bruto.slice(idxCab + 1)
      .filter(l => l.some(v => String(v == null ? '' : v).trim() !== ''))
      .map(l => {
        const comp = parseCompetencia(pegar(l, 'competencia'));
        const extras = [];
        const prioridade = pegar(l, 'prioridade');
        const responsavel = pegar(l, 'responsavel');
        const dataGravacao = parseDataBR(pegar(l, 'data_gravacao'));
        if (prioridade) extras.push('Prioridade (planilha): ' + prioridade);
        if (responsavel) extras.push('Responsável (planilha): ' + responsavel);
        if (dataGravacao) extras.push('Data de gravação (planilha): ' + dataGravacao.split('-').reverse().join('/'));
        const observacoes = [pegar(l, 'observacoes'), ...extras].filter(Boolean).join(' · ');

        return {
          cliente: pegar(l, 'cliente'),
          titulo: pegar(l, 'titulo'),
          codigo: pegar(l, 'codigo'),
          pacote: pegar(l, 'pacote'),
          prazo: parseDataBR(pegar(l, 'prazo')),
          observacoes,
          ano: comp.ano || '',
          mes: comp.mes || '',
          status: parseStatus(pegar(l, 'status'))
        };
      });
  }

  function csvParaLinhasBrutas(texto) {
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
    return linhas.map(partirLinha);
  }
  function parseCSV(texto) { return linhasParaObjetos(csvParaLinhasBrutas(texto)); }

  /* lê só a primeira aba; datas viram texto AAAA-MM-DD (dateNF), pronto
     para o `prazo::date` do banco. */
  function parseXLSX(arrayBuffer) {
    if (!window.XLSX) throw new Error('Biblioteca de leitura de XLSX não carregou.');
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const aba = wb.SheetNames[0];
    if (!aba) return [];
    const bruto = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
    return linhasParaObjetos(bruto);
  }

  function modalImportar() {
    const m = B7.UI.modal(
      '<h3>Importar planilha (CSV ou XLSX)</h3>' +
      '<p class="fraca">O sistema encontra sozinho a linha de cabeçalho (mesmo com linhas de lixo antes ' +
      'dela) e reconhece colunas parecidas com Cliente, Briefing/Título, Cód., Pacote, Prazo, Mês/Competência ' +
      'e Status, em qualquer ordem. Uma coluna de cliente é obrigatória — as demais são opcionais e, quando ' +
      'faltar título, a linha ainda é importada com um título de referência. No XLSX só a primeira aba do ' +
      'arquivo é lida.</p>' +
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
    const naoResolvidas = pendentes.filter(l => !l.resolvida);
    const prontas = pendentes.filter(l => l.resolvida);

    // Planilhas reais costumam repetir o mesmo cliente dezenas ou centenas
    // de vezes. Resolver o cliente de UMA linha já resolve todas as linhas
    // irmãs (mesmo nome, mesmo lote) — então a lista aqui agrupa por nome
    // de cliente da planilha, em vez de mostrar uma linha por registro.
    const grupos = [];
    const porNome = new Map();
    naoResolvidas.forEach(l => {
      const chave = (l.cliente_nome_planilha || '').trim().toLowerCase();
      let g = porNome.get(chave);
      if (!g) {
        g = { nome: l.cliente_nome_planilha, linhas: [], problemas: new Set() };
        porNome.set(chave, g);
        grupos.push(g);
      }
      g.linhas.push(l);
      (l.problemas || []).forEach(p => g.problemas.add(p));
    });

    area.innerHTML =
      '<p><b>' + lote.linhas_ok + '</b> linha(s) prontas, <b>' + lote.linhas_erro + '</b> com pendência, de ' + lote.total_linhas + ' no total.</p>' +
      (grupos.length
        ? '<p class="fraca">Resolver o cliente de um grupo abaixo aplica a mesma escolha a todas as linhas com esse nome na planilha.</p>' +
          '<table class="vd-imp-tabela"><thead><tr><th>Linhas</th><th>Cliente (planilha)</th><th>Problema</th><th></th></tr></thead><tbody>' +
          grupos.map(g => '<tr data-linha="' + g.linhas[0].id + '">' +
            '<td>' + g.linhas.length + '</td>' +
            '<td>' + esc(g.nome || '—') + '</td>' +
            '<td>' + esc(Array.from(g.problemas).join(', ')) + '</td>' +
            '<td><select class="campo fina" data-resolver="' + g.linhas[0].id + '"><option value="">resolver cliente…</option>' +
              clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select></td>' +
            '</tr>').join('') +
          '</tbody></table>'
        : '') +
      (prontas.length ? '<p class="vd-ok">' + prontas.length + ' linha(s) resolvida(s), prontas para confirmar.</p>' : '') +
      (pendentes.length
        ? (prontas.length ? '<div class="acoes"><button class="b pri" id="vd-imp-confirmar">Confirmar linhas prontas</button></div>' : '')
        : '<p class="vd-ok">Tudo confirmado.</p>');

    area.querySelectorAll('[data-resolver]').forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      try {
        const n = await B7.DB.resolverLinhaImportacaoVideo(sel.dataset.resolver, sel.value, true);
        if (n > 1) B7.UI.toast(n + ' linha(s) resolvida(s) com este cliente.');
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
