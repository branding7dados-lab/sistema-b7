/* =====================================================================
   IA QUE ESCREVE O TEXTO PARA O CLIENTE — a mesma camada de IA do B7
   (B7.IA → b7-ia), com a tarefa "resumo":

     • Status Semanal   a observação geral da semana
     • Resumo do Mês    a leitura do mês que abre a folha

   A tela manda só a operação e os ids; quem lê os dados e conta os
   números é o servidor. Aqui mora o painel, igual nos dois lugares:

     gerando    "Escrevendo…", com Cancelar
     resultado  a sugestão, com Aplicar / Copiar / Gerar novamente /
                Descartar e um campo curto para pedir um ajuste
     erro       a frase do que houve, com Tentar novamente

   REGRA DO PRODUTO: nada roda sozinho e nada entra no relatório sem a
   pessoa clicar em Aplicar. O estado fica por chave (um status, um
   cliente+mês): se a tela for redesenhada, o painel volta como estava.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.IATexto = (function () {
  const esc = B7.UI.esc;
  /* mesma chave da IA da Linha Editorial: é texto de planejamento/relato para o cliente */
  const ligado = () => !!(B7.IA && B7.IA.ligada('linhas')) &&
    !(B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'designer');

  const IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 4l1.7 4.6L17.3 10l-4.6 1.7L11 16.3l-1.7-4.6L4.7 10l4.6-1.4z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>';
  const LIMITE_INSTRUCAO = 300;

  const estados = new Map();     /* chave → estado do painel */
  const vivos = new Map();       /* chave → { botao, painel, cfg } como estão no DOM agora */
  let seq = 0;

  /* botão de entrada + lugar do painel (HTML). Vazio com a IA desligada. */
  function botaoHTML(rotulo) {
    if (!ligado()) return '';
    return '<button type="button" class="ia-entrada" data-ia-texto aria-expanded="false">' + IC + '<span>' + esc(rotulo || 'Escrever com IA') + '</span></button>';
  }
  const painelHTML = () => ligado() ? '<div class="ia-painel ia-texto-painel" data-ia-texto-painel role="region" aria-label="Assistente de IA" hidden></div>' : '';

  const ref = k => { const v = vivos.get(k); return v && v.painel.isConnected ? v : null; };

  function pintar(k) {
    const r = ref(k); if (!r) return;
    const st = estados.get(k);
    r.botao.setAttribute('aria-expanded', st ? 'true' : 'false');
    r.botao.classList.toggle('on', !!st);
    if (!st) { r.painel.hidden = true; r.painel.innerHTML = ''; return; }
    r.painel.hidden = false;
    const cab = '<div class="ia-cab"><span class="ia-titulo">' + IC + '<b>' + esc(r.cfg.titulo || 'Assistente de IA') + '</b></span>' +
      '<span class="ia-alvo">' + esc(r.cfg.base || '') + '</span>' +
      '<button type="button" class="ia-fechar" data-ia-fechar aria-label="Fechar o assistente">×</button></div>';
    let corpo = '';
    if (st.fase === 'gerando') {
      corpo = '<div class="ia-gerando" role="status" aria-live="polite"><span class="ia-pontos" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span>' + esc(r.cfg.gerando || 'Escrevendo…') + '</span><button type="button" class="b fina" data-ia-cancelar>Cancelar</button></div>';
    } else if (st.fase === 'resultado') {
      const substitui = String(r.cfg.atual() || '').trim() && r.cfg.atual().trim() !== st.sugestao;
      corpo = '<div class="ia-rotulo">Sugestão</div>' +
        '<div class="ia-sugestao" data-ia-sugestao tabindex="0">' + esc(st.sugestao) + '</div>' +
        '<div class="ia-botoes">' +
          '<button type="button" class="b pri fina" data-ia-aplicar>' + (substitui ? 'Substituir o texto atual' : 'Aplicar') + '</button>' +
          '<button type="button" class="b fina contorno" data-ia-copiar>Copiar</button>' +
          '<button type="button" class="b fina contorno" data-ia-de-novo>Gerar novamente</button>' +
          '<button type="button" class="b fina" data-ia-fechar>Descartar</button>' +
        '</div>' +
        '<form class="ia-instrucao" data-ia-form style="margin-top:12px"><div class="ia-instrucao-linha">' +
          '<input class="campo" data-ia-instrucao maxlength="' + LIMITE_INSTRUCAO + '" autocomplete="off" aria-label="Pedir um ajuste" ' +
            'placeholder="Pedir um ajuste. Ex.: mais curto, citar a gravação de quinta" value="' + esc(st.instrucao || '') + '">' +
          '<button type="submit" class="b fina contorno">Ajustar</button></div></form>' +
        '<p class="ia-nota">' + esc(r.cfg.nota || 'Confira antes de enviar ao cliente. Nada muda até você aplicar.') + '</p>';
    } else {
      corpo = '<p class="ia-erro" role="alert">' + esc(st.erro) + '</p>' +
        '<div class="ia-botoes">' + (st.semRepetir ? '' : '<button type="button" class="b fina contorno" data-ia-de-novo>Tentar novamente</button>') +
        '<button type="button" class="b fina" data-ia-fechar>Fechar</button></div>' +
        '<p class="ia-nota">Nada foi alterado.</p>';
    }
    r.painel.innerHTML = cab + corpo;

    const q = s => r.painel.querySelector(s);
    r.painel.querySelectorAll('[data-ia-fechar]').forEach(b => b.onclick = () => fechar(k));
    if (q('[data-ia-cancelar]')) q('[data-ia-cancelar]').onclick = () => fechar(k);
    if (q('[data-ia-de-novo]')) q('[data-ia-de-novo]').onclick = () => gerar(k, '');
    if (q('[data-ia-copiar]')) q('[data-ia-copiar]').onclick = () => B7.UI.copiarTexto(st.sugestao,
      { msgSucesso: 'Texto copiado.', msgErro: 'Não foi possível copiar.', msgVazio: 'Não há texto para copiar.' });
    if (q('[data-ia-aplicar]')) q('[data-ia-aplicar]').onclick = () => aplicar(k);
    const form = q('[data-ia-form]');
    if (form) {
      const campo = q('[data-ia-instrucao]');
      campo.oninput = () => { st.instrucao = campo.value; };
      form.onsubmit = ev => {
        ev.preventDefault();
        const t = campo.value.replace(/\s+/g, ' ').trim();
        if (t.length < 3) { campo.focus(); return; }
        gerar(k, t);
      };
    }
  }

  function fechar(k) {
    const st = estados.get(k);
    if (st && st.ctrl) st.ctrl.abort();
    estados.delete(k);
    pintar(k);
  }

  async function gerar(k, instrucao) {
    const r = ref(k); if (!r) return;
    let st = estados.get(k);
    if (st && st.fase === 'gerando') return;                 /* um pedido por vez */
    st = { fase: 'gerando', sugestao: '', erro: '', instrucao: instrucao || '', token: ++seq, ctrl: new AbortController() };
    estados.set(k, st);
    pintar(k);
    /* o servidor lê o que está salvo: garante que a tela já foi gravada */
    try { if (B7.Save && B7.Save.agora) await B7.Save.agora(); } catch (e) {}
    const dados = Object.assign({}, r.cfg.dados());
    if (instrucao) dados.instrucao = instrucao;
    const resp = await B7.IA.pedir('resumo', dados, { signal: st.ctrl.signal });
    if (estados.get(k) !== st) return;                       /* fechou ou pediu de novo: resposta velha não aparece */
    st.ctrl = null;
    if (resp.cancelado) return;
    if (resp.ok && resp.texto) { st.fase = 'resultado'; st.sugestao = resp.texto; }
    else {
      st.fase = 'erro';
      st.semRepetir = ['pouco', 'sem_permissao', 'nao_encontrado'].includes(resp.categoria);
      st.erro = (resp.categoria === 'pouco' && r.cfg.pouco) || resp.mensagem || 'Não foi possível escrever o texto agora.';
    }
    pintar(k);
  }

  function aplicar(k) {
    const r = ref(k), st = estados.get(k);
    if (!r || !st || st.fase !== 'resultado') return;
    const antes = String(r.cfg.atual() || ''), novo = st.sugestao;
    r.cfg.aplicar(novo);
    estados.delete(k);
    pintar(k);
    B7.UI.toast('Texto aplicado.', {
      acao: 'Desfazer',
      aoClicar: () => {
        const agora = ref(k);
        if (!agora) return;
        if (String(agora.cfg.atual() || '') !== novo) { B7.UI.toast('O texto já mudou depois disso. Nada foi desfeito.'); return; }
        agora.cfg.aplicar(antes);
      }
    });
  }

  /* `cfg`: { chave, dados(), atual(), aplicar(texto), titulo?, base?, gerando?, pouco?, nota? }
     Um clique no botão = um pedido. Clicar de novo com o painel aberto fecha. */
  function ligar(raiz, cfg) {
    if (!ligado() || !raiz) return;
    const botao = raiz.querySelector('[data-ia-texto]'), painel = raiz.querySelector('[data-ia-texto-painel]');
    if (!botao || !painel) return;
    const k = cfg.chave;
    vivos.set(k, { botao, painel, cfg });
    botao.onclick = ev => {
      ev.preventDefault();
      if (estados.has(k)) fechar(k); else gerar(k, '');
    };
    if (estados.has(k)) pintar(k);      /* a tela foi redesenhada: o painel volta como estava */
  }

  return { botaoHTML, painelHTML, ligar, ligado };
})();
