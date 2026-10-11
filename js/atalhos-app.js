/* =====================================================================
   ATALHOS DO ÍCONE (zzz155) — app Android
   Segurar o ícone do B7 na tela inicial mostra 4 atalhos
   (app-android/.../res/xml/shortcuts.xml). Cada um abre o app com um
   link "b7:…", que chega por B7AppAbrir (js/app-nativo.js) e é
   resolvido aqui:

     b7:hoje          → "Meu dia em 30 segundos" (js/hoje.js)
     b7:gravacoes     → a gravação de hoje (se for só uma) ou a lista
     b7:teleprompter  → a próxima gravação (hoje ou amanhã) já com o
                        teleprompter aberto
     b7:ideia         → janelinha "Nova ideia": cliente + título

   Com o app fechado, o atalho chega antes do login e da abertura: espera
   o sistema montar (até ~25 s) e só então age.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.AtalhosApp = (() => {
  const esc = s => B7.UI.esc(s);
  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || null;
  const pode = r => !B7.Perm || !B7.Perm.podeRota || B7.Perm.podeRota(r);
  const hojeISO = () => B7.UI.hojeISO();
  const amanhaISO = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function esperarPronto(limite) {
    return new Promise(ok => {
      const t0 = Date.now();
      const conferir = () => {
        const app = document.getElementById('app');
        const pronto = eu() && B7.sb && app && app.children.length && !document.querySelector('.b7-abertura');
        if (pronto) return ok(true);
        if (Date.now() - t0 > (limite || 25000)) return ok(false);
        setTimeout(conferir, 300);
      };
      conferir();
    });
  }
  function esperarElemento(sel, limite) {
    return new Promise(ok => {
      const t0 = Date.now();
      const conferir = () => {
        const el = document.querySelector(sel);
        if (el) return ok(el);
        if (Date.now() - t0 > limite) return ok(null);
        setTimeout(conferir, 200);
      };
      conferir();
    });
  }

  /* gravações de hoje e amanhã que ainda não aconteceram, as da pessoa
     (gestão: todas) — a mesma regra do "Meu dia" */
  async function proximasGravacoes() {
    const u = eu(), g = !!(B7.Auth.ehEquipe && B7.Auth.ehEquipe());
    const funcoes = [u.papel].concat((B7.Auth.funcoesExtra && B7.Auth.funcoesExtra()) || []);
    const souVideomaker = funcoes.includes('videomaker') || (B7.Auth.funcao && B7.Auth.funcao() === 'videomaker');
    const r = await B7.sb.from('gravacoes_resumo')
      .select('id,nome,cliente_nome,data_gravacao,hora_inicio,videomaker_id,situacao,concluida_em')
      .is('deleted_at', null).is('archived_at', null)
      .gte('data_gravacao', hojeISO()).lte('data_gravacao', amanhaISO())
      .order('data_gravacao', { ascending: true }).order('hora_inicio', { ascending: true, nullsFirst: false });
    if (r.error) throw r.error;
    return (r.data || [])
      .filter(x => !x.concluida_em && x.situacao !== 'concluida' && x.situacao !== 'cancelada')
      .filter(x => g || x.videomaker_id === u.id || (!x.videomaker_id && souVideomaker));
  }

  async function gravacoes() {
    if (!pode('gravacoes')) { location.hash = '#/'; return; }
    try {
      const hoje = (await proximasGravacoes()).filter(x => String(x.data_gravacao).slice(0, 10) === hojeISO());
      if (hoje.length === 1) { location.hash = '#/gravacao/' + hoje[0].id; return; }
      location.hash = '#/gravacoes';
      if (!hoje.length) B7.UI.toast('Nenhuma gravação marcada para hoje.');
    } catch (e) { location.hash = '#/gravacoes'; }
  }

  async function teleprompter() {
    if (!(B7.Teleprompter && B7.Teleprompter.podeUsar && B7.Teleprompter.podeUsar())) {
      B7.UI.toast('O teleprompter é de quem grava ou coordena.'); return;
    }
    let g = null;
    try { g = (await proximasGravacoes())[0] || null; } catch (e) {}
    if (!g) {
      if (pode('gravacoes')) location.hash = '#/gravacoes';
      B7.UI.toast('Nenhuma gravação hoje ou amanhã. Abra uma gravação e toque em “Teleprompter”.');
      return;
    }
    location.hash = '#/gravacao/' + g.id;
    /* o botão da própria tela da gravação: abre com a lista dela (e o
       "marcar como gravado" funciona igual) */
    const bt = await esperarElemento('[data-gv="teleprompter"]', 9000);
    if (bt && (location.hash || '') === '#/gravacao/' + g.id) bt.click();
    else if (!bt) B7.UI.toast('Esta gravação ainda não tem roteiro na lista.');
  }

  async function ideia() {
    const designerSoLe = B7.Conteudo && B7.Conteudo.souDesignerSomenteLeitura && B7.Conteudo.souDesignerSomenteLeitura();
    if (!pode('clientes') || designerSoLe) { B7.UI.toast('Sua conta não cria ideias.'); return; }
    let clientes = [];
    try { clientes = (await B7.DB.listarClientes()).filter(c => !c.archived_at); } catch (e) {}
    if (!clientes.length) { B7.UI.toast('Nenhum cliente para guardar a ideia.'); return; }
    let ultimo = '';
    try { ultimo = localStorage.getItem('b7_atalho_ideia_cliente') || ''; } catch (e) {}
    if (!clientes.some(c => c.id === ultimo)) ultimo = '';
    const m = B7.UI.modal('<h3>Nova ideia</h3>' +
      '<div class="sub">Só o título já basta. O resto dá para completar depois.</div>' +
      '<div class="mb"><label class="rot" for="at-cli">CLIENTE</label>' +
        '<select class="campo" id="at-cli">' + (ultimo ? '' : '<option value="">Escolha o cliente…</option>') +
        clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === ultimo ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('') +
        '</select></div>' +
      '<div class="mb"><label class="rot" for="at-tit">IDEIA</label>' +
        '<input class="campo" id="at-tit" data-foco placeholder="Ex: Mitos sobre implante" autocomplete="off"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button>' +
      '<button class="b pri" data-ok>Guardar ideia</button></div>');
    const tit = m.querySelector('#at-tit'), cli = m.querySelector('#at-cli');
    setTimeout(() => { try { (ultimo ? tit : cli).focus(); } catch (e) {} }, 250);
    const salvar = async () => {
      const titulo = tit.value.trim(), clienteId = cli.value;
      if (!clienteId) return cli.focus();
      if (!titulo) return tit.focus();
      try {
        await B7.Save.acao(() => B7.DB.criarIdeia({ client_id: clienteId, titulo }), 'Ideia guardada');
        try { localStorage.setItem('b7_atalho_ideia_cliente', clienteId); } catch (e) {}
        m.fechar();
        B7.UI.toast('Ideia guardada no banco de ideias.', { acao: 'Ver ideias', aoClicar: () => { location.hash = '#/cliente/' + clienteId + '/ideias'; } });
      } catch (e) {}
    };
    m.querySelector('[data-ok]').onclick = salvar;
    tit.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } });
  }

  const ACOES = { hoje: () => B7.Hoje && B7.Hoje.abrir(), gravacoes, teleprompter, ideia };

  async function executar(link) {
    const nome = String(link || '').replace(/^b7:/, '');
    const fazer = ACOES[nome];
    if (!fazer) return;
    if (!(await esperarPronto())) return;
    const u = eu();
    if (!u || u.papel === 'cliente') return;
    /* quem chegou por um atalho já sabe o que quer: o "Meu dia" não abre
       sozinho por cima */
    if (B7.Hoje && B7.Hoje.marcarVisto) B7.Hoje.marcarVisto();
    if (nome !== 'hoje' && B7.Hoje && B7.Hoje.aberto && B7.Hoje.aberto()) B7.Hoje.fechar(true);
    try { await fazer(); } catch (e) { B7.UI.toast('Não deu para abrir o atalho agora.', { tipo: 'erro' }); }
  }

  return { executar };
})();
