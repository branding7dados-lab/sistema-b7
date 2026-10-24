/* =====================================================================
   PORTAL — PEDIDOS DO CLIENTE (zzz263)

   O cliente pede algo novo à Branding7 ("uma arte para a promoção de
   sexta") sem sair do portal. O pedido vira um cartão no Kanban da
   equipe (cliente_pedido_criar) e a coordenação é avisada. Conforme o
   cartão anda no Kanban, o pedido muda aqui sozinho (Recebido → Em
   produção → Pronto) e quem pediu recebe um aviso.
   Qualquer papel da empresa pode pedir; na prévia é só leitura.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PortalPedidos = (function () {
  const esc = s => B7.UI.esc(s);
  const TIPOS = {
    arte:  { nome: 'Arte',  txt: 'Post, story, banner, convite…' },
    video: { nome: 'Vídeo', txt: 'Reels, corte, vídeo para anúncio…' },
    post:  { nome: 'Post',  txt: 'Publicação completa: arte e legenda.' },
    texto: { nome: 'Texto', txt: 'Legenda, roteiro, texto para site…' },
    outro: { nome: 'Outro', txt: 'Qualquer outra coisa.' }
  };
  const SITUACAO = {
    recebido:    ['Recebido', 'A Branding7 recebeu e vai organizar.'],
    em_producao: ['Em produção', 'A equipe está trabalhando nele.'],
    concluido:   ['Pronto', 'Ficou pronto. Se for para aprovar, ele aparece em Aprovações.'],
    cancelado:   ['Encerrado', 'Foi encerrado pela Branding7. Fale com a gente pelo Suporte se precisar.']
  };
  const dataBR = iso => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m + '/' + a; };

  async function abrir() {
    const P = B7.Portal;
    P.marcarNav(P.rota('pedidos'));
    const emp = P.empresa();
    const previa = P.emPrevia();
    if (!emp) return P.abrirHome();
    if (emp.servico && emp.servico !== 'ativo') return P.telaServico(emp);
    const painel = document.getElementById('painel-dashboard');
    painel.innerHTML = '<div class="conteudo portal-home"><span class="sr-only">Carregando os pedidos…</span>' + B7.UI.skeleton('lista', { n: 3 }) + '</div>';
    const vale = B7.Rota.marca();
    let lista;
    try { lista = await B7.DB.rpc('cliente_pedidos_listar', { p_client: emp.id }); }
    catch (e) {
      if (!vale()) return;
      painel.innerHTML = '<div class="conteudo entra portal-home"><div class="pt-vazio pt-erro" role="alert"><b>Não foi possível carregar os pedidos</b>' +
        '<p>' + esc(e.message || 'Tente de novo em instantes.') + '</p><div class="acoes"><button type="button" class="b pri" data-tentar>Tentar de novo</button></div></div></div>';
      painel.querySelector('[data-tentar]').onclick = abrir;
      return;
    }
    if (!vale()) return;
    lista = lista || [];
    const abertos = lista.filter(p => p.situacao === 'recebido' || p.situacao === 'em_producao');
    const fechados = lista.filter(p => !abertos.includes(p));

    const cartao = p => {
      const s = SITUACAO[p.situacao] || [p.situacao, ''];
      return '<article class="pp-pedido">' +
        '<div class="pp-topo"><span class="pp-tipo">' + esc((TIPOS[p.tipo] || TIPOS.outro).nome) + '</span>' +
          '<span class="pp-sit pp-' + esc(p.situacao) + '" title="' + esc(s[1]) + '">' + esc(s[0]) + '</span></div>' +
        '<h3>' + esc(p.titulo) + '</h3>' +
        (p.descricao ? '<p class="pp-desc">' + esc(p.descricao) + '</p>' : '') +
        '<div class="pp-pe">' + esc(p.sou_eu ? 'Você pediu' : (p.autor || 'Alguém da empresa') + ' pediu') + ' ' + esc(B7.UI.quando(p.created_at)) +
          (p.para_quando ? ' · <b>para ' + esc(dataBR(p.para_quando)) + '</b>' : '') + '</div>' +
      '</article>';
    };

    painel.innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab com-acao"><div><h1>Pedidos</h1>' +
        '<p class="ph-emp">Precisa de algo novo? Peça aqui e acompanhe até ficar pronto.</p></div>' +
        '<button type="button" class="b pri" data-novo' + (previa ? ' disabled title="Na prévia nada é registrado"' : '') + '>Fazer um pedido</button></header>' +
      (lista.length ? '' :
        '<div class="pt-vazio"><b>Nenhum pedido ainda.</b><p>Uma arte para uma data especial, um vídeo, um texto? ' +
        'Toque em "Fazer um pedido": ele vai direto para a equipe da Branding7.</p></div>') +
      (abertos.length ? '<h2 class="pp-sec">Em andamento <small>' + abertos.length + '</small></h2><section class="pp-lista">' + abertos.map(cartao).join('') + '</section>' : '') +
      (fechados.length ? '<h2 class="pp-sec">Anteriores</h2><section class="pp-lista">' + fechados.map(cartao).join('') + '</section>' : '') +
    '</div>';
    const novo = painel.querySelector('[data-novo]');
    if (novo && !previa) novo.onclick = () => pedir(emp);
  }

  function pedir(emp) {
    const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const m = B7.UI.modal(
      '<h3>Fazer um pedido</h3><p class="sub">Vai direto para a equipe da Branding7. Você acompanha em "Pedidos".</p>' +
      '<div class="mb"><span class="rot">O QUE VOCÊ PRECISA</span><div class="pp-tipos">' + Object.keys(TIPOS).map(k =>
        '<label class="pp-tipo-op"><input type="radio" name="pp-tipo" value="' + k + '"' + (k === 'arte' ? ' checked' : '') + '>' +
        '<span><b>' + TIPOS[k].nome + '</b><small>' + esc(TIPOS[k].txt) + '</small></span></label>').join('') + '</div></div>' +
      '<div class="mb"><label class="rot" for="pp-titulo">EM POUCAS PALAVRAS</label>' +
        '<input class="campo" id="pp-titulo" maxlength="120" placeholder="ex.: arte para a promoção de sexta" autocomplete="off" data-foco></div>' +
      '<div class="mb"><label class="rot" for="pp-desc">DETALHES <small>(opcional)</small></label>' +
        '<textarea class="campo" id="pp-desc" rows="4" maxlength="2000" placeholder="Textos, preços, cores, referências, onde vai ser usado…"></textarea></div>' +
      '<div class="mb"><label class="rot" for="pp-data">PARA QUANDO <small>(opcional)</small></label>' +
        '<input class="campo" id="pp-data" type="date" min="' + hoje + '"></div>' +
      '<div class="pp-ia" hidden></div>' +
      '<div class="acoes">' + (B7.IAFerramentas ? '<button class="b contorno pp-ia-bt" data-ia>✨ Conferir com a IA</button>' : '') +
        '<button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Enviar pedido</button></div>');
    const ok = m.querySelector('[data-ok]');
    /* zzz267: a IA aponta o que falta no pedido (formato, textos, data…);
       as perguntas entram nos detalhes para a pessoa responder ali mesmo */
    const ia = m.querySelector('[data-ia]');
    if (ia) ia.onclick = async () => {
      const titulo = m.querySelector('#pp-titulo').value.trim();
      if (titulo.length < 3) return B7.UI.toast('Escreva primeiro o que você precisa', { tipo: 'erro' });
      const cx = m.querySelector('.pp-ia');
      ia.disabled = true; cx.hidden = false; cx.innerHTML = '<div class="iaf-pensa"><span class="iaf-orbe" aria-hidden="true"></span><b>Lendo o seu pedido…</b></div>';
      const r = await B7.IAFerramentas.pedidoPerguntas({ clienteId: emp.id, tipo: (m.querySelector('input[name="pp-tipo"]:checked') || {}).value || 'outro',
        titulo, texto: m.querySelector('#pp-desc').value.trim() });
      ia.disabled = false;
      if (!r.ok) { cx.innerHTML = '<p class="pp-ia-erro">' + esc(r.mensagem || 'A IA não respondeu agora. Pode enviar assim mesmo.') + '</p>'; return; }
      const itens = r.itens || [];
      if (!itens.length) { cx.innerHTML = '<p class="pp-ia-ok">✅ Seu pedido está bem completo. Pode enviar!</p>'; return; }
      cx.innerHTML = '<p class="pp-ia-tit">✨ Para a equipe acertar de primeira, responda nos detalhes:</p><ul>' + itens.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul>' +
        '<button type="button" class="b fina contorno" data-por>Colocar as perguntas nos detalhes</button>';
      cx.querySelector('[data-por]').onclick = () => {
        const d = m.querySelector('#pp-desc');
        d.value = (d.value.trim() ? d.value.trim() + '\n\n' : '') + itens.map(q => q + '\n→ ').join('\n');
        d.focus(); cx.hidden = true;
      };
    };
    ok.onclick = async () => {
      const titulo = m.querySelector('#pp-titulo').value.trim();
      if (titulo.length < 3) return B7.UI.toast('Escreva em poucas palavras o que você precisa', { tipo: 'erro' });
      const tipo = (m.querySelector('input[name="pp-tipo"]:checked') || {}).value || 'outro';
      ok.disabled = true; ok.textContent = 'Enviando…';
      try {
        await B7.DB.rpc('cliente_pedido_criar', {
          p_client: emp.id, p_tipo: tipo, p_titulo: titulo,
          p_descricao: m.querySelector('#pp-desc').value.trim() || null,
          p_para_quando: m.querySelector('#pp-data').value || null
        });
        m.fechar();
        B7.UI.toast('Pedido enviado. A Branding7 já foi avisada.');
        abrir();
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Enviar pedido';
        B7.UI.toast(e.message || 'Não foi possível enviar o pedido.', { tipo: 'erro' });
      }
    };
  }

  return { abrir, pedir };
})();
