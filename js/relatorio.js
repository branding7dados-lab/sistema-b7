/* =====================================================================
   RELATÓRIO DO MÊS (zzz254) — para a coordenação e a administração.
   Abre do Panorama ("Relatório do mês"), para o mês que está na tela.

   Duas visões, dos mesmos números (relatorio_mes no banco):
     • Clientes: posts planejados × publicados, artes e vídeos entregues,
       quantos atrasaram, aprovações e quantas voltaram com ajuste;
     • Equipe: o que cada pessoa entregou, quanto foi no prazo, quantas
       versões cada arte precisou e o que está atrasado hoje.
   Sai também em planilha (CSV). Nada é gravado.

   Para o cliente continua valendo o "Resumo do mês" da página dele
   (js/resumo-mes.js), que é um documento para mandar.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Relatorio = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const pct = (a, b) => b ? Math.round(a * 100 / b) + '%' : '—';
  const horas = h => h === null || h === undefined ? '—' : h < 24 ? String(h).replace('.', ',') + ' h' : (Math.round(h / 2.4) / 10).toString().replace('.', ',') + ' dias';
  const FUNCAO = { designer: 'Design', videomaker: 'Vídeo', coordenador: 'Coordenação', admin: 'Administração' };

  function totais(d) {
    const c = d.clientes || [], p = d.pessoas || [];
    const s = (l, k) => l.reduce((t, x) => t + (Number(x[k]) || 0), 0);
    const prazo = s(p, 'artes_no_prazo') + s(p, 'videos_no_prazo'), comPrazo = s(p, 'artes_com_prazo') + s(p, 'videos_com_prazo');
    return [
      [s(c, 'publicados') + '/' + s(c, 'planejados'), 'posts publicados'],
      [s(c, 'artes'), 'artes entregues'],
      [s(c, 'videos'), 'vídeos entregues'],
      [pct(prazo, comPrazo), 'entregas no prazo'],
      [s(c, 'aprov_ajustes'), 'pedidos de ajuste']
    ];
  }

  const num = (v, alerta) => '<td class="rl-n' + (alerta && Number(v) > 0 ? ' rl-alerta' : '') + '">' + esc(v === null || v === undefined ? '—' : v) + '</td>';
  const nomeCel = (img, nome, sub) => '<th scope="row"><span class="rl-nome">' +
    (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<i>' + esc(String(nome || '?').trim().charAt(0)) + '</i>') +
    '<span><b>' + esc(nome) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></span></th>';

  function tabelaClientes(l) {
    if (!l.length) return '<p class="rl-vazio">Nenhum cliente com movimento neste mês.</p>';
    return '<div class="rl-rolar"><table class="rl-tabela"><thead><tr><th>Cliente</th><th>Posts publicados</th><th>Artes</th><th>Vídeos</th>' +
      '<th>Entregas atrasadas</th><th>Aprovações</th><th>Voltaram com ajuste</th><th>Resposta do cliente</th></tr></thead><tbody>' +
      l.map(c => '<tr>' + nomeCel(c.logo, c.nome) +
        '<td class="rl-n">' + c.publicados + '<small>/' + c.planejados + '</small></td>' + num(c.artes) + num(c.videos) +
        num(c.artes_atrasadas + c.videos_atrasados, true) +
        '<td class="rl-n">' + c.aprov_aprovadas + '<small>/' + c.aprov_enviadas + '</small></td>' + num(c.aprov_ajustes, true) +
        '<td class="rl-n">' + esc(horas(c.resposta_horas)) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  function tabelaPessoas(l) {
    if (!l.length) return '<p class="rl-vazio">Ninguém entregou nada registrado neste mês.</p>';
    return '<div class="rl-rolar"><table class="rl-tabela"><thead><tr><th>Pessoa</th><th>Artes</th><th>Vídeos</th><th>No prazo</th>' +
      '<th>Versões por arte</th><th>Atrasados hoje</th></tr></thead><tbody>' +
      l.map(p => '<tr>' + nomeCel(p.foto, p.nome, FUNCAO[p.funcao] || '') + num(p.artes) + num(p.videos) +
        '<td class="rl-n">' + pct(p.artes_no_prazo + p.videos_no_prazo, p.artes_com_prazo + p.videos_com_prazo) + '</td>' +
        '<td class="rl-n">' + esc(p.versoes_por_arte === null ? '—' : String(p.versoes_por_arte).replace('.', ',')) + '</td>' +
        num(p.artes_atrasadas_abertas + p.videos_atrasados_abertos, true) + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function csv(d) {
    const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const linhas = [['Clientes'], ['Cliente', 'Posts planejados', 'Posts publicados', 'Artes', 'Artes atrasadas', 'Vídeos', 'Vídeos atrasados',
      'Aprovações enviadas', 'Aprovadas', 'Com ajuste', 'Resposta média (horas)']];
    (d.clientes || []).forEach(c => linhas.push([c.nome, c.planejados, c.publicados, c.artes, c.artes_atrasadas, c.videos, c.videos_atrasados,
      c.aprov_enviadas, c.aprov_aprovadas, c.aprov_ajustes, c.resposta_horas]));
    linhas.push([], ['Equipe'], ['Pessoa', 'Função', 'Artes', 'Artes no prazo', 'Artes com prazo', 'Versões por arte', 'Vídeos',
      'Vídeos no prazo', 'Vídeos com prazo', 'Artes atrasadas hoje', 'Vídeos atrasados hoje']);
    (d.pessoas || []).forEach(p => linhas.push([p.nome, FUNCAO[p.funcao] || p.funcao, p.artes, p.artes_no_prazo, p.artes_com_prazo, p.versoes_por_arte,
      p.videos, p.videos_no_prazo, p.videos_com_prazo, p.artes_atrasadas_abertas, p.videos_atrasados_abertos]));
    const blob = new Blob(['﻿' + linhas.map(l => l.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'relatorio-b7-' + d.ano + '-' + String(d.mes).padStart(2, '0') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function abrir(ano, mes) {
    let aba = 'clientes', dados = null;
    const m = B7.UI.modal(
      '<div class="rl-cab"><div><h3>Relatório de ' + esc(MESES[mes - 1]) + ' de ' + ano + '</h3>' +
        '<p class="sub">Entregas, prazos e aprovações do mês, por cliente e por pessoa.</p></div>' +
        '<button type="button" class="b fina contorno" data-rl-csv disabled>Baixar planilha</button></div>' +
      '<div class="rl-kpis" data-rl-kpis></div>' +
      '<div class="rl-abas" role="tablist"><button type="button" role="tab" data-rl-aba="clientes" aria-selected="true">Clientes</button>' +
        '<button type="button" role="tab" data-rl-aba="pessoas" aria-selected="false">Equipe</button></div>' +
      '<div class="rl-corpo" data-rl-corpo>' + B7.UI.skeleton('lista', { n: 5 }) + '</div>' +
      '<p class="rl-nota">No prazo: entregue até o dia do prazo (só conta o que tinha prazo). Versões por arte: quantas versões cada arte precisou até ficar pronta. ' +
        'Resposta do cliente: tempo médio entre o envio e a decisão pelo portal.</p>' +
      '<div class="acoes"><button type="button" class="b" data-fecha>Fechar</button></div>',
      { larga: true, extra: 'rl-modal' });
    const corpo = m.querySelector('[data-rl-corpo]');
    const pintar = () => {
      m.querySelectorAll('[data-rl-aba]').forEach(b => b.setAttribute('aria-selected', b.dataset.rlAba === aba ? 'true' : 'false'));
      corpo.innerHTML = aba === 'clientes' ? tabelaClientes(dados.clientes || []) : tabelaPessoas(dados.pessoas || []);
    };
    m.querySelectorAll('[data-rl-aba]').forEach(b => b.onclick = () => { aba = b.dataset.rlAba; if (dados) pintar(); });
    try { dados = await B7.DB.rpc('relatorio_mes', { p_ano: ano, p_mes: mes }); }
    catch (e) { corpo.innerHTML = '<p class="rl-vazio">Não foi possível montar o relatório. ' + esc((e && e.message) || '') + '</p>'; return; }
    if (!m.isConnected) return;
    m.querySelector('[data-rl-kpis]').innerHTML = totais(dados).map(([v, r]) => '<div class="rl-kpi"><b>' + esc(v) + '</b><span>' + esc(r) + '</span></div>').join('');
    const bt = m.querySelector('[data-rl-csv]'); bt.disabled = false; bt.onclick = () => csv(dados);
    pintar();
  }

  return { abrir };
})();
