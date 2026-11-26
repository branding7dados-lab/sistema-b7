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

    const linha = p => {
      const s = SITUACAO[p.situacao] || [p.situacao, ''];
      return '<article class="pp-pedido">' +
        '<div class="pp-tx"><h3>' + esc(p.titulo) + '</h3>' +
          '<div class="pp-pe"><span class="pp-tipo">' + esc((TIPOS[p.tipo] || TIPOS.outro).nome) + '</span> · ' + esc(p.sou_eu ? 'Você pediu' : (p.autor || 'Alguém da empresa') + ' pediu') +
            (p.para_quando ? ' · <b>para ' + esc(dataBR(p.para_quando)) + '</b>' : '') + '</div>' +
          (p.descricao ? '<p class="pp-desc">' + esc(p.descricao) + '</p>' : '') + '</div>' +
        '<span class="pp-quando">' + esc(B7.UI.quando(p.created_at)) + '</span>' +
        '<span class="pp-sit pp-' + esc(p.situacao) + '" title="' + esc(s[1]) + '">' + esc(s[0]) + '</span>' +
      '</article>';
    };

    painel.innerHTML = '<div class="conteudo entra portal-home pc-tela pp-tela">' +
      '<header class="ph-cab"><div><h1>Pedidos</h1>' +
        '<p class="ph-emp">Precisa de algo novo? Peça aqui e acompanhe até ficar pronto.</p></div></header>' +
      '<div class="pp-grade">' +
        '<section class="pp-lista pc-cartao"><p class="pc-cartao-tit">Seus pedidos' + (abertos.length ? ' <small>' + abertos.length + ' em andamento</small>' : '') + '</p>' +
          (lista.length
            ? '<div class="pp-cab" aria-hidden="true"><span>Pedido</span><span>Enviado</span><span>Situação</span></div>' + abertos.concat(fechados).map(linha).join('')
            : '<div class="pt-vazio"><b>Nenhum pedido ainda.</b><p>Uma arte para uma data especial, um vídeo, um texto? ' +
              'Faça o pedido ao lado: ele vai direto para a equipe da Branding7.</p></div>') +
        '</section>' +
        '<section class="pp-novo pc-cartao" data-novo></section>' +
      '</div>' +
    '</div>';
    const novo = painel.querySelector('[data-novo]');
    pedir(emp, novo);
    if (previa) novo.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; el.title = 'Na prévia nada é registrado'; });
  }

  /* zzz-espectro: o pedido é feito no cartão "Novo pedido" ao lado da lista
     (alvo); sem alvo, abre na janela como antes */
  function pedir(emp, alvo) {
    const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const corpo =
      '<div class="mb"><label class="rot" for="pp-titulo">O que você precisa?</label>' +
        '<input class="campo" id="pp-titulo" maxlength="120" placeholder="ex.: arte para a promoção de sexta" autocomplete="off"' + (alvo ? '' : ' data-foco') + '></div>' +
      '<div class="mb"><span class="rot">Tipo</span><div class="pp-tipos">' + Object.keys(TIPOS).map(k =>
        '<label class="pp-tipo-op" title="' + esc(TIPOS[k].txt) + '"><input type="radio" name="pp-tipo" value="' + k + '"' + (k === 'arte' ? ' checked' : '') + '>' +
        '<span><b>' + TIPOS[k].nome + '</b><small>' + esc(TIPOS[k].txt) + '</small></span></label>').join('') + '</div></div>' +
      '<div class="mb"><label class="rot" for="pp-data">Para quando? <small>(opcional)</small></label>' +
        '<input class="campo" id="pp-data" type="date" min="' + hoje + '"></div>' +
      '<div class="mb"><label class="rot" for="pp-desc">Detalhes <small>(opcional)</small></label>' +
        '<textarea class="campo" id="pp-desc" rows="4" maxlength="2000" placeholder="Textos, preços, cores, referências, onde vai ser usado…"></textarea></div>' +
      '<div class="pp-ia" hidden></div>';
    const iaBt = B7.IAFerramentas ? '<button type="button" class="b contorno pp-ia-bt" data-ia>✨ Conferir com a IA</button>' : '';
    const enviar = '<button type="button" class="b pri" data-ok><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5L21 3l-8.5 18-2-7.5z"/></svg>Enviar pedido</button>';
    let m;
    if (alvo) {
      alvo.innerHTML = '<p class="pc-cartao-tit">Novo pedido</p>' + corpo + '<div class="acoes">' + iaBt + enviar + '</div>';
      m = alvo; m.fechar = () => {};
    } else {
      m = B7.UI.modal('<h3>Fazer um pedido</h3><p class="sub">Vai direto para a equipe da Branding7. Você acompanha em "Pedidos".</p>' + corpo +
        '<div class="acoes">' + iaBt + '<button class="b" data-fecha>Cancelar</button>' + enviar + '</div>');
    }
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
      const rotOk = ok.innerHTML;
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
        ok.disabled = false; ok.innerHTML = rotOk;
        B7.UI.toast(e.message || 'Não foi possível enviar o pedido.', { tipo: 'erro' });
      }
    };
  }

  return { abrir, pedir };
})();
