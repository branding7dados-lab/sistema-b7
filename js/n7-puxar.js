/* =====================================================================
   PUXAR DO NÚCLEO 7 (4.89.0)

   O cadastro dos clientes que já está preenchido no Núcleo 7 vem para o
   cadastro do B7 — sem digitar de novo.
     • Um por vez: aba Cadastro do cliente → "Puxar do Núcleo 7". Mostra o
       que está no B7 e o que está no Núcleo 7, campo a campo; a pessoa
       escolhe. Campo vazio no B7 já vem marcado; valor diferente, não.
     • Todos de uma vez: tela Clientes → "Puxar cadastros do Núcleo 7"
       (administrador). Preenche SÓ os campos vazios; nunca troca valor.
   O servidor (função n7-clientes) só lê o Núcleo 7 e nunca manda valor,
   pagamento, senha ou acesso. Gravar é pelo cliente_cadastro_salvar, com
   as validações de sempre. Nada do Núcleo 7 muda.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.N7Puxar = (function () {
  const esc = s => B7.UI.esc(s == null ? '' : s);
  const SIT = { ativo: 'ativo', encerrando: 'encerrando', cancelado: 'cancelado', pausa: 'em pausa', inativo: 'inativo' };
  const fmtCnpj = n => (String(n || '').length === 14 ? String(n).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '');
  const fmtFone = s => { const n = String(s || '').replace(/\D/g, ''); return n.length === 11 ? n.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : n.length === 10 ? n.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3') : s; };
  const fmtData = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; };
  const MESES = { 1: '1 mês', 3: '3 meses', 6: '6 meses', 12: '12 meses ou mais' };
  /* o valor do jeito que se lê na tela */
  function mostrar(campo, v) {
    if (!v) return '<span class="np-vazio">vazio</span>';
    if (campo === 'cnpj') return esc(fmtCnpj(String(v).replace(/\D/g, '')) || v);
    if (campo === 'resp_whatsapp') return esc(fmtFone(v));
    if (campo === 'inicio') return esc(fmtData(v));
    if (campo === 'meses') return esc(MESES[+v] || v);
    if (campo === 'instagram') return '@' + esc(String(v).replace(/^@+/, ''));
    if (campo === 'logo') return /^https:\/\//i.test(v) ? '<img class="np-logo" src="' + esc(v) + '" alt="Logo no Núcleo 7">' : esc(v);
    const t = String(v);
    return esc(t.length > 140 ? t.slice(0, 140) + '…' : t);
  }
  /* os campos escolhidos → o corpo do cliente_cadastro_salvar (mesma regra do servidor) */
  function corpo(campos, n7Id) {
    const interno = { n7_cliente_id: n7Id }, perfil = {}, d = { interno };
    let logo = '';
    campos.forEach(c => {
      if (c.bloco === 'logo') logo = c.n7;
      else if (c.bloco === 'perfil') perfil[c.chave] = c.n7;
      else interno[c.chave] = c.chave === 'contrato_meses' ? Number(c.n7) : c.n7;
    });
    if (Object.keys(perfil).length) d.perfil = perfil;
    if (logo) d.logo_n7 = logo;
    return d;
  }
  const situacao = s => (s && s !== 'ativo' ? ' <span class="np-sit">' + esc(SIT[s] || s) + '</span>' : '');
  const candidato = c => '<button type="button" class="np-cand" data-np-n7="' + esc(c.id) + '"><b>' + esc(c.nome) + situacao(c.situacao) + '</b>' +
    '<small>' + [c.cnpj ? 'CNPJ ' + esc(fmtCnpj(c.cnpj)) : '', esc(c.cidade || '')].filter(Boolean).join(' · ') + '</small></button>';

  /* ================================================================ um por vez */
  function um(clienteId, nomeB7, aoSalvar) {
    const m = B7.UI.modal('<h3>Puxar do Núcleo 7</h3><div class="sub">' + esc(nomeB7 || '') + '</div><div class="np-corpo" data-np-corpo>' + B7.UI.skeleton('lista', { n: 4 }) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-np-ok hidden>Trazer</button></div>', { larga: true, extra: 'np-janela' });
    const cx = m.querySelector('[data-np-corpo]'), ok = m.querySelector('[data-np-ok]');
    let atual = null;

    const erro = e => { cx.innerHTML = '<div class="cb-aviso erro">' + esc((e && e.message) || 'Não foi possível falar com o Núcleo 7.') + '</div>'; ok.hidden = true; };
    async function carregar(n7Id) {
      cx.innerHTML = B7.UI.skeleton('lista', { n: 4 }); ok.hidden = true;
      let r;
      try { r = await B7.DB.n7Clientes('buscar', Object.assign({ cliente_id: clienteId }, n7Id ? { n7_id: n7Id } : {})); }
      catch (e) { if (m.isConnected) erro(e); return; }
      if (!m.isConnected) return;
      atual = r;
      if (r.tipo === 'escolher') return pintarEscolha('Há mais de um cliente com este nome no Núcleo 7. Qual é este?', r.candidatos);
      if (r.tipo === 'nenhum') return pintarBusca('Não achei este cliente no Núcleo 7 pelo nome. Procure pelo nome que ele tem lá:');
      pintarCampos();
    }
    function pintarEscolha(texto, lista) {
      ok.hidden = true;
      cx.innerHTML = '<p class="np-nota">' + esc(texto) + '</p><div class="np-cands">' + lista.map(candidato).join('') + '</div>' +
        '<p class="np-nota leve">Não é nenhum desses? <button type="button" class="cb-link" data-np-procurar>Procurar outro nome</button></p>';
      cx.querySelectorAll('[data-np-n7]').forEach(b => b.onclick = () => carregar(b.dataset.npN7));
      cx.querySelector('[data-np-procurar]').onclick = () => pintarBusca('Procure pelo nome que o cliente tem no Núcleo 7:');
    }
    function pintarBusca(texto) {
      ok.hidden = true;
      cx.innerHTML = '<p class="np-nota">' + esc(texto) + '</p><input class="campo" data-np-termo placeholder="Nome no Núcleo 7" data-foco>' +
        '<div class="np-cands" data-np-res></div>';
      const inp = cx.querySelector('[data-np-termo]'), res = cx.querySelector('[data-np-res]');
      let t = null, seq = 0;
      inp.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
        const q = inp.value.trim(), eu = ++seq;
        if (q.length < 2) { res.innerHTML = ''; return; }
        try {
          const r = await B7.DB.n7Clientes('procurar', { termo: q });
          if (eu !== seq || !m.isConnected) return;
          res.innerHTML = (r.clientes || []).length ? r.clientes.map(candidato).join('') : '<p class="np-nota leve">Nenhum cliente com esse nome no Núcleo 7.</p>';
          res.querySelectorAll('[data-np-n7]').forEach(b => b.onclick = () => carregar(b.dataset.npN7));
        } catch (e) { if (eu === seq) res.innerHTML = '<p class="np-nota erro">' + esc(e.message) + '</p>'; }
      }, 300); };
      inp.focus();
    }
    function pintarCampos() {
      const r = atual, campos = r.campos || [];
      const lig = '<div class="np-lig"><span>No Núcleo 7: <b>' + esc(r.n7.nome) + '</b>' + situacao(r.n7.situacao) +
        (r.n7.cnpj ? ' · CNPJ ' + esc(fmtCnpj(r.n7.cnpj)) : '') + '</span><button type="button" class="cb-link" data-np-trocar>Trocar</button></div>';
      if (!campos.length) {
        cx.innerHTML = lig + '<p class="np-nota">O cadastro do B7 já tem tudo o que está no Núcleo 7.</p>';
        ok.hidden = r.ligado === r.n7.id; ok.textContent = 'Guardar a ligação';
      } else {
        cx.innerHTML = lig + '<p class="np-nota">Marque o que trazer. Campos vazios no B7 já vêm marcados; quando os dois têm valores diferentes, você decide.</p>' +
          '<div class="np-tab" role="table"><div class="np-l np-cab" role="row"><span></span><span role="columnheader">Campo</span><span role="columnheader">No B7</span><span role="columnheader">No Núcleo 7</span></div>' +
          campos.map((c, i) => '<label class="np-l' + (c.vazio ? '' : ' dif') + '" role="row"><span><input type="checkbox" data-np-i="' + i + '"' + (c.vazio ? ' checked' : '') + ' aria-label="Trazer ' + esc(c.rotulo) + '"></span>' +
            '<span class="np-campo" role="cell">' + esc(c.rotulo) + (c.vazio ? '' : '<small>diferente</small>') + '</span>' +
            '<span class="np-b7" role="cell">' + mostrar(c.campo, c.b7) + '</span><span class="np-n7" role="cell">' + mostrar(c.campo, c.n7) + '</span></label>').join('') + '</div>';
        const conta = () => { const n = cx.querySelectorAll('[data-np-i]:checked').length; ok.disabled = !n; ok.textContent = n ? 'Trazer ' + n + (n === 1 ? ' campo' : ' campos') : 'Marque o que trazer'; };
        cx.querySelectorAll('[data-np-i]').forEach(x => x.onchange = conta); conta(); ok.hidden = false;
      }
      cx.querySelector('[data-np-trocar]').onclick = () => pintarBusca('Procure o cliente certo no Núcleo 7:');
    }
    ok.onclick = async () => {
      if (!atual || !atual.n7) return;
      const escolhidos = [...cx.querySelectorAll('[data-np-i]:checked')].map(x => atual.campos[+x.dataset.npI]);
      ok.disabled = true;
      try {
        const novo = await B7.Save.acao(() => B7.DB.salvarCadastro(clienteId, corpo(escolhidos, atual.n7.id)),
          escolhidos.length ? (escolhidos.length === 1 ? '1 campo trazido do Núcleo 7' : escolhidos.length + ' campos trazidos do Núcleo 7') : 'Ligação com o Núcleo 7 guardada');
        m.fechar(); if (aoSalvar) aoSalvar(novo);
      } catch (e) { ok.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
    };
    carregar(null);
    return m;
  }

  /* ================================================================ todos de uma vez */
  function todos(depois) {
    const m = B7.UI.modal('<h3>Puxar cadastros do Núcleo 7</h3><div class="sub">Só preenche os campos que estão vazios no B7. Nada que já está preenchido é trocado.</div>' +
      '<div class="np-corpo" data-np-corpo>' + B7.UI.skeleton('lista', { n: 5 }) + '</div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-np-ok hidden></button></div>',
      { larga: true, extra: 'np-janela', aoFechar: () => { if (mexeu && depois) depois(); } });
    const cx = m.querySelector('[data-np-corpo]'), ok = m.querySelector('[data-np-ok]');
    let r = null, mexeu = false;
    const ir = id => { m.fechar(); location.hash = '#/cliente/' + id + '/cadastro'; };
    (async () => {
      try { r = await B7.DB.n7Clientes('todos', {}); }
      catch (e) { if (m.isConnected) cx.innerHTML = '<div class="cb-aviso erro">' + esc(e.message || 'Não foi possível falar com o Núcleo 7.') + '</div>'; return; }
      if (!m.isConnected) return;
      const ach = r.achados || [], comCampos = ach.filter(a => a.campos.length), soLigar = ach.length - comCampos.length;
      const nCampos = comCampos.reduce((n, a) => n + a.campos.length, 0);
      const grupo = (t, lista, linha) => lista.length ? '<section class="np-grupo"><h4>' + t + ' <small>' + lista.length + '</small></h4><ul>' + lista.map(linha).join('') + '</ul></section>' : '';
      const ver = c => '<li><span>' + esc(c.nome) + '</span><button type="button" class="cb-link" data-np-ir="' + esc(c.id) + '">Abrir o cadastro</button></li>';
      cx.innerHTML =
        '<div class="np-kpis"><span><b>' + comCampos.length + '</b>com campos a preencher</span><span><b>' + nCampos + '</b>campos no total</span>' +
          '<span><b>' + ((r.escolher || []).length + (r.nenhum || []).length) + '</b>precisam de você</span><span><b>' + (r.completos + soLigar) + '</b>já completos</span></div>' +
        grupo('Achados, com campos a preencher', comCampos, a => '<li><span><b>' + esc(a.nome) + '</b><small>' + esc(a.campos.join(', ')) + '</small></span></li>') +
        grupo('Mais de um com o mesmo nome no Núcleo 7', r.escolher || [], ver) +
        grupo('Não achados no Núcleo 7', r.nenhum || [], ver) +
        (r.total ? '' : '<p class="np-nota">Nenhum cliente ativo no B7.</p>');
      cx.querySelectorAll('[data-np-ir]').forEach(b => b.onclick = () => ir(b.dataset.npIr));
      if (ach.length) {
        ok.hidden = false;
        ok.textContent = comCampos.length ? 'Preencher os campos vazios de ' + comCampos.length + (comCampos.length === 1 ? ' cliente' : ' clientes') : 'Guardar as ligações com o Núcleo 7';
      }
    })();
    ok.onclick = async () => {
      if (!r) return;
      ok.disabled = true; mexeu = true;
      const lista = r.achados || [], falhas = [];
      let feitos = 0, campos = 0;
      for (let i = 0; i < lista.length; i++) {
        if (!m.isConnected) return;
        ok.textContent = 'Preenchendo ' + (i + 1) + ' de ' + lista.length + '…';
        try { await B7.DB.salvarCadastro(lista[i].id, lista[i].dados); feitos++; campos += lista[i].campos.length; }
        catch (e) { falhas.push({ nome: lista[i].nome, erro: (e && e.message) || 'erro' }); }
      }
      if (!m.isConnected) return;
      cx.innerHTML = '<div class="np-fim"><b>' + feitos + (feitos === 1 ? ' cliente preenchido' : ' clientes preenchidos') + ', ' + campos + (campos === 1 ? ' campo.' : ' campos.') + '</b>' +
        (falhas.length ? '<p class="np-nota">Estes não foram salvos:</p><ul class="np-falhas">' + falhas.map(f => '<li><b>' + esc(f.nome) + '</b>: ' + esc(f.erro) + '</li>').join('') + '</ul>' : '') + '</div>';
      ok.hidden = true;
      B7.UI.toast(feitos + (feitos === 1 ? ' cliente preenchido' : ' clientes preenchidos') + ' pelo Núcleo 7');
    };
    return m;
  }

  return { um, todos, corpo };
})();
