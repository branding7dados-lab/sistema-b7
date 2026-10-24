/* =====================================================================
   PORTAL — CALENDÁRIO DE PUBLICAÇÕES (zzz265)

   O mês do cliente num olhar: o que vai ao ar em cada dia (com a
   miniatura da arte, quando há) e as gravações marcadas. Lê as mesmas
   views do portal (portal_producao, portal_gravacoes): só o que a
   equipe liberou. Toque num item com aprovação abre a revisão.
   No computador é uma grade do mês; no celular, uma agenda por dia.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PortalCalendario = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const SEMANA = ['dom','seg','ter','qua','qui','sex','sáb'];
  const ICONE = { video: '🎬', reels: '🎬', carrossel: '🖼️', arte: '🎨', post: '🖼️', story: '📱', stories: '📱', gravacao: '🎥' };
  const icone = t => ICONE[String(t || '').toLowerCase()] || '✨';
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let mes = null;                 // primeiro dia do mês aberto
  const urls = new Map();         // caminho → url assinada (cache da sessão)

  async function abrir(desloc) {
    const P = B7.Portal;
    P.marcarNav(P.rota('meu-calendario'));
    const emp = P.empresa();
    if (!emp) return P.abrirHome();
    if (emp.servico && emp.servico !== 'ativo') return P.telaServico(emp);
    if (!mes) { const h = new Date(); mes = new Date(h.getFullYear(), h.getMonth(), 1); }
    if (desloc) mes = new Date(mes.getFullYear(), mes.getMonth() + desloc, 1);
    const painel = document.getElementById('painel-dashboard');
    if (!desloc) painel.innerHTML = '<div class="conteudo portal-home"><span class="sr-only">Carregando o calendário…</span>' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';
    const vale = B7.Rota.marca();
    let prod = [], grav = [];
    try { [prod, grav] = await Promise.all([B7.DB.producaoDoCliente(emp.id, 400), B7.DB.gravacoesDoCliente(emp.id, 120)]); }
    catch (e) {
      if (!vale()) return;
      painel.innerHTML = '<div class="conteudo entra portal-home"><div class="pt-vazio pt-erro" role="alert"><b>Não foi possível carregar o calendário</b>' +
        '<p>' + esc(e.message || 'Tente de novo em instantes.') + '</p><div class="acoes"><button type="button" class="b pri" data-tentar>Tentar de novo</button></div></div></div>';
      painel.querySelector('[data-tentar]').onclick = () => abrir();
      return;
    }
    if (!vale()) return;

    const ini = iso(mes), fim = iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    const porDia = {};
    const poe = (dia, item) => { (porDia[dia] = porDia[dia] || []).push(item); };
    (prod || []).forEach(c => {
      const d = String(c.data_postagem || '').slice(0, 10);
      if (d >= ini && d <= fim) poe(d, { tipo: 'post', icone: icone(c.tipo), titulo: c.titulo || 'Sem título', sub: c.tipo || 'Conteúdo',
        status: c.status_cliente, aprovacao: c.aprovacao_id, aprovTipo: c.aprovacao_tipo });
    });
    (grav || []).forEach(g => {
      const d = String(g.data_gravacao || '').slice(0, 10);
      if (d >= ini && d <= fim && g.status_cliente !== 'cancelada') poe(d, { tipo: 'grav', icone: ICONE.gravacao, titulo: g.nome || 'Gravação', sub: 'Gravação' });
    });
    const total = Object.values(porDia).reduce((n, l) => n + l.filter(i => i.tipo === 'post').length, 0);
    const gravs = Object.values(porDia).reduce((n, l) => n + l.filter(i => i.tipo === 'grav').length, 0);

    const hoje = iso(new Date());
    const chip = it => {
      const tag = it.aprovacao ? 'button type="button"' : 'div';
      return '<' + tag + ' class="pcal-item pcal-' + it.tipo + (it.status ? ' st-' + esc(it.status) : '') + '"' + (it.aprovacao ? ' data-aprovacao="' + esc(it.aprovacao) + '"' : '') +
        ' title="' + esc(it.titulo + (it.status ? ' · ' + (B7.Portal.statusCli(it.status) || '') : '')) + '">' +
        (it.aprovTipo === 'design_versao' ? '<span class="pcal-mini" data-mini="' + esc(it.aprovacao) + '"></span>' : '<span class="pcal-ic" aria-hidden="true">' + it.icone + '</span>') +
        '<span class="pcal-tx"><b>' + esc(it.titulo) + '</b>' + (it.status ? '<small>' + esc(B7.Portal.statusCli(it.status) || '') + '</small>' : '<small>' + esc(it.sub) + '</small>') + '</span>' +
      '</' + tag.split(' ')[0] + '>';
    };

    // grade do mês (computador)
    const primeiro = mes.getDay();
    const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    let grade = SEMANA.map(s => '<div class="pcal-sem">' + s + '</div>').join('');
    for (let i = 0; i < primeiro; i++) grade += '<div class="pcal-dia vazio"></div>';
    for (let d = 1; d <= dias; d++) {
      const k = iso(new Date(mes.getFullYear(), mes.getMonth(), d));
      const l = porDia[k] || [];
      grade += '<div class="pcal-dia' + (k === hoje ? ' hoje' : '') + (k < hoje ? ' passado' : '') + (l.length ? ' tem' : '') + '">' +
        '<span class="pcal-n">' + d + '</span>' + l.slice(0, 3).map(chip).join('') +
        (l.length > 3 ? '<span class="pcal-mais">+' + (l.length - 3) + '</span>' : '') + '</div>';
    }
    // agenda (celular)
    const agenda = Object.keys(porDia).sort().map(k => {
      const dt = new Date(k + 'T12:00:00');
      return '<section class="pcal-ag-dia' + (k === hoje ? ' hoje' : '') + '"><h3><b>' + dt.getDate() + '</b><span>' + SEMANA[dt.getDay()] + (k === hoje ? ' · hoje' : '') + '</span></h3>' +
        '<div>' + porDia[k].map(chip).join('') + '</div></section>';
    }).join('');

    painel.innerHTML = '<div class="conteudo entra portal-home pcal-tela">' +
      '<header class="ph-cab com-acao"><div><h1>Calendário</h1>' +
        '<p class="ph-emp">' + (total || gravs
          ? (total ? total + (total === 1 ? ' publicação' : ' publicações') : '') + (total && gravs ? ' e ' : '') + (gravs ? gravs + (gravs === 1 ? ' gravação' : ' gravações') : '') + ' em ' + MESES[mes.getMonth()] + '.'
          : 'Nada marcado em ' + MESES[mes.getMonth()] + ' ainda.') + '</p></div>' +
        '<div class="pcal-nav"><button type="button" class="b fina contorno" data-mes="-1" aria-label="Mês anterior">‹</button>' +
          '<b>' + MESES[mes.getMonth()] + ' ' + mes.getFullYear() + '</b>' +
          '<button type="button" class="b fina contorno" data-mes="1" aria-label="Próximo mês">›</button></div></header>' +
      '<div class="pcal-grade">' + grade + '</div>' +
      '<div class="pcal-agenda">' + (agenda || '<div class="pt-vazio"><b>Nada marcado neste mês.</b><p>As datas aparecem aqui quando a Branding7 libera o planejamento.</p></div>') + '</div>' +
      '<p class="pcal-legenda"><span class="pcal-l post"></span>publicação <span class="pcal-l grav"></span>gravação · toque para abrir o que tem aprovação</p>' +
    '</div>';

    painel.querySelectorAll('[data-mes]').forEach(b => b.onclick = () => abrir(+b.dataset.mes));
    painel.querySelectorAll('[data-aprovacao]').forEach(b => b.onclick = () => { location.hash = B7.Portal.rota('revisar/' + b.dataset.aprovacao); });
    miniaturas(painel);
  }

  /* miniaturas das artes: uma consulta para as aprovações do mês e a
     primeira imagem de cada uma, assinada (fica em cache na sessão) */
  async function miniaturas(painel) {
    const els = [...painel.querySelectorAll('[data-mini]')];
    const ids = [...new Set(els.map(e => e.dataset.mini))].slice(0, 60);
    if (!ids.length) return;
    let linhas = [];
    try { linhas = await B7.DB.aprovacoesSnapshots(ids); } catch (e) { return; }
    await Promise.all((linhas || []).map(async a => {
      const arqs = (a.snapshot && (a.snapshot.arquivos_efetivos || a.snapshot.arquivos)) || [];
      const img = arqs.find(x => x && x.caminho && /\.(png|jpe?g|webp|gif)$/i.test(x.caminho));
      if (!img) return;
      try {
        let url = urls.get(img.caminho);
        if (!url) { url = await B7.DB.urlArquivoDesign(img.caminho); urls.set(img.caminho, url); }
        painel.querySelectorAll('[data-mini="' + CSS.escape(a.id) + '"]').forEach(el => {
          el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")'; el.classList.add('ok');
        });
      } catch (e) { /* sem miniatura: fica o fundo de cor */ }
    }));
  }

  return { abrir };
})();
