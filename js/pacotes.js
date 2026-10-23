/* =====================================================================
   PACOTES DE PRODUÇÃO (zzz255)

   Um pacote é o que o cliente contrata por mês ("Pacote mensal: 12 posts
   + 4 vídeos"). Ao criar a linha editorial com um pacote, os conteúdos
   nascem de uma vez, em Ideia, com o tipo e a data já espalhada pelos
   dias escolhidos (linha_aplicar_pacote no banco). As peças de Design e
   as demandas de vídeo seguem nascendo dos conteúdos, como sempre.

   Aqui: a lista e o editor (Configurações → Pacotes de produção) e o
   seletor usado na janela "Nova linha editorial".
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Pacotes = (function () {
  const esc = s => B7.UI.esc(s);
  const TIPOS = [['Card', 'Cards'], ['Carrossel', 'Carrosséis'], ['Reel', 'Reels'], ['Story', 'Stories']];
  const DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [7, 'Dom']];
  const podeEditar = () => !B7.Perm || B7.Perm.podeNivel('linhas', 'editar');

  const total = p => (p.itens || []).reduce((t, i) => t + (Number(i.qtd) || 0), 0);
  function resumo(p) {
    const partes = (p.itens || []).filter(i => i.qtd > 0).map(i => {
      const t = TIPOS.find(x => x[0] === i.tipo) || [i.tipo, i.tipo];
      return i.qtd + ' ' + (i.qtd === 1 ? t[0] : t[1]).toLowerCase() + (i.tipo === 'Reel' && i.producao === 'edicao' ? ' (só edição)' : '');
    });
    return partes.join(' + ') + ' · ' + total(p) + ' no mês';
  }

  async function listar() {
    return B7.DB.listarPacotes();
  }

  /* ----------------------------------------------- Configurações */
  async function montar(alvo) {
    if (!alvo) return;
    alvo.innerHTML = B7.UI.skeleton('lista', { n: 3 });
    let lista;
    try { lista = await listar(); }
    catch (e) { alvo.innerHTML = '<p class="cfg-g-nota">Não foi possível carregar os pacotes. ' + esc((e && e.message) || '') + '</p>'; return; }
    if (!alvo.isConnected) return;
    const ed = podeEditar();
    alvo.innerHTML = '<section class="cfg-g"><h2 class="cfg-g-t">Pacotes</h2>' +
      '<p class="cfg-g-nota">O que cada cliente contrata por mês. Ao criar uma linha editorial com um pacote, os conteúdos já nascem com o tipo e a data espalhada pelo mês. O último pacote usado com cada cliente já vem escolhido na próxima linha.</p>' +
      '<div class="cfg-lista">' +
        (lista.length ? lista.map(p => '<div class="cfg-l"><span class="cfg-l-tx"><b>' + esc(p.nome) + '</b><small>' + esc(resumo(p)) +
            (p.descricao ? ' · ' + esc(p.descricao) : '') + '</small></span>' +
            (ed ? '<button type="button" class="b fina contorno" data-pc-editar="' + esc(p.id) + '">Editar</button>' : '') + '</div>').join('')
          : '<div class="cfg-l"><span class="cfg-l-tx"><b>Nenhum pacote ainda</b><small>crie o primeiro abaixo</small></span></div>') +
        (ed ? '<button type="button" class="cfg-l eq-novo" data-pc-novo><span class="cfg-l-tx"><b>Novo pacote</b><small>ex.: 8 cards + 4 carrosséis + 4 reels</small></span><span class="cfg-acao" aria-hidden="true">Criar</span></button>' : '') +
      '</div></section>';
    const novo = alvo.querySelector('[data-pc-novo]'); if (novo) novo.onclick = () => editor(null, () => montar(alvo));
    alvo.querySelectorAll('[data-pc-editar]').forEach(b => b.onclick = () => editor(lista.find(p => p.id === b.dataset.pcEditar), () => montar(alvo)));
  }

  function editor(p, depois) {
    p = p || { nome: '', descricao: '', itens: [{ tipo: 'Card', qtd: 4 }, { tipo: 'Carrossel', qtd: 4 }, { tipo: 'Reel', qtd: 4, producao: 'gravacao' }], dias_semana: [1, 2, 3, 4, 5] };
    const qtd = t => { const i = (p.itens || []).find(x => x.tipo === t); return i ? i.qtd : 0; };
    const reel = (p.itens || []).find(x => x.tipo === 'Reel') || {};
    const m = B7.UI.modal(
      '<h3>' + (p.id ? 'Editar pacote' : 'Novo pacote') + '</h3>' +
      '<div class="mb"><label class="rot" for="pc-nome">NOME</label><input class="campo" id="pc-nome" maxlength="80" value="' + esc(p.nome) + '" placeholder="Pacote mensal" data-foco></div>' +
      '<div class="mb"><label class="rot" for="pc-desc">DESCRIÇÃO <span class="mg-obr leve">opcional</span></label><input class="campo" id="pc-desc" maxlength="120" value="' + esc(p.descricao || '') + '" placeholder="12 posts + 4 vídeos"></div>' +
      '<div class="mb"><span class="rot">POR MÊS</span><div class="pc-qtds">' + TIPOS.map(([t, r]) =>
        '<label class="pc-qtd"><span>' + r + '</span><input type="number" class="campo fina" min="0" max="60" inputmode="numeric" data-pc-tipo="' + t + '" value="' + qtd(t) + '"></label>').join('') + '</div>' +
        '<label class="pc-edicao"><input type="checkbox" id="pc-edicao"' + (reel.producao === 'edicao' ? ' checked' : '') + '> Reels só de edição (sem gravação)</label></div>' +
      '<div class="mb"><span class="rot">DIAS DE POSTAGEM</span><div class="pc-dias">' + DIAS.map(([n, r]) =>
        '<label class="pc-dia"><input type="checkbox" data-pc-dia="' + n + '"' + ((p.dias_semana || []).includes(n) ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>' +
        '<p class="ajuda" data-pc-total></p></div>' +
      '<div class="acoes">' + (p.id ? '<button class="b contorno pc-arquivar" data-pc-arquivar>Arquivar</button>' : '') +
        '<button class="b" data-fecha>Cancelar</button><button class="b pri" data-pc-salvar>Salvar</button></div>');
    const ler = () => {
      const itens = TIPOS.map(([t]) => ({ tipo: t, qtd: Math.max(0, Math.min(60, parseInt(m.querySelector('[data-pc-tipo="' + t + '"]').value, 10) || 0)) }))
        .filter(i => i.qtd > 0).map(i => i.tipo === 'Reel' ? Object.assign(i, { producao: m.querySelector('#pc-edicao').checked ? 'edicao' : 'gravacao' }) : i);
      const dias = DIAS.map(d => d[0]).filter(n => m.querySelector('[data-pc-dia="' + n + '"]').checked);
      return { nome: m.querySelector('#pc-nome').value.trim(), descricao: m.querySelector('#pc-desc').value.trim(), itens, dias_semana: dias };
    };
    const pintar = () => { const v = ler(); m.querySelector('[data-pc-total]').textContent = total(v) + ' conteúdos por mês, em ' + v.dias_semana.length + (v.dias_semana.length === 1 ? ' dia' : ' dias') + ' da semana.'; };
    m.querySelectorAll('input').forEach(i => i.oninput = i.onchange = pintar);
    pintar();
    m.querySelector('[data-pc-salvar]').onclick = async () => {
      const v = ler();
      if (!v.nome) return B7.UI.toast('Dê um nome ao pacote', { tipo: 'erro' });
      if (!v.itens.length) return B7.UI.toast('Coloque pelo menos um conteúdo', { tipo: 'erro' });
      if (!v.dias_semana.length) return B7.UI.toast('Escolha pelo menos um dia', { tipo: 'erro' });
      try { await B7.Save.acao(() => B7.DB.salvarPacote(p.id || null, v), 'Pacote salvo'); m.fechar(); depois && depois(); } catch (e) {}
    };
    const arq = m.querySelector('[data-pc-arquivar]');
    if (arq) arq.onclick = async () => {
      if (!(await B7.UI.confirmar({ titulo: 'Arquivar "' + p.nome + '"?', texto: 'Ele some da lista e da nova linha editorial. As linhas já criadas não mudam.', rotulo: 'Arquivar' }))) return;
      try { await B7.Save.acao(() => B7.DB.salvarPacote(p.id, { arquivado_em: new Date().toISOString() }), 'Pacote arquivado'); m.fechar(); depois && depois(); } catch (e) {}
    };
  }

  /* ---------------------------------------------- Nova linha editorial */
  function blocoNovaLinha(icone) {
    return '<section class="ng-bloco" data-pc-bloco hidden><h4>' + (icone || '') + 'Pacote <span class="mg-obr leve">opcional</span></h4>' +
      '<div class="mb ng-ult"><select class="campo" id="nl-pacote" aria-label="Pacote de produção"><option value="">Começar vazia</option></select>' +
      '<div class="gv-ajuda" data-pc-ajuda>Escolha um pacote e os conteúdos do mês já nascem prontos para planejar.</div></div></section>';
  }
  async function ligarNovaLinha(m, clienteDe) {
    const bloco = m.querySelector('[data-pc-bloco]'); if (!bloco || !podeEditar()) return;
    let lista = [];
    try { lista = await listar(); } catch (e) { return; }
    if (!lista.length || !m.isConnected) return;
    const sel = m.querySelector('#nl-pacote'), ajuda = m.querySelector('[data-pc-ajuda]');
    sel.innerHTML = '<option value="">Começar vazia</option>' + lista.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + ' — ' + total(p) + ' conteúdos</option>').join('');
    bloco.hidden = false;
    const dica = () => { const p = lista.find(x => x.id === sel.value); ajuda.textContent = p ? resumo(p) + '. Datas em ' + DIAS.filter(d => (p.dias_semana || []).includes(d[0])).map(d => d[1]).join(', ') + '.' : 'Escolha um pacote e os conteúdos do mês já nascem prontos para planejar.'; };
    const doCliente = async () => {
      const cli = clienteDe(); if (!cli) return;
      try { const id = await B7.DB.pacoteDoCliente(cli); if (id && lista.some(p => p.id === id)) sel.value = id; else sel.value = ''; } catch (e) {}
      dica();
    };
    sel.onchange = dica;
    await doCliente();
    return { doCliente, escolhido: () => sel.value || null };
  }
  async function aplicar(linhaId, pacoteId) {
    const n = await B7.DB.rpc('linha_aplicar_pacote', { p_linha: linhaId, p_pacote: pacoteId });
    B7.UI.toast(n + (n === 1 ? ' conteúdo criado' : ' conteúdos criados') + ' pelo pacote');
    return n;
  }

  return { montar, editor, blocoNovaLinha, ligarNovaLinha, aplicar, resumo };
})();
