/* =====================================================================
   IA QUE REVISA E COMPARA — a mesma camada de IA do B7 (B7.IA → b7-ia),
   com a tarefa "analise". Em vez de escrever, ela LÊ o trabalho pronto:

     • Revisar roteiro            o roteiro inteiro como peça falada
     • Comparar com planejamento  o roteiro × o conteúdo da Linha Editorial
                                  de onde ele nasceu (só quando o vínculo
                                  existe de verdade: roteiros.content_id)

   Também desenha os cartões da revisão do conjunto da linha editorial
   (js/ia-linha.js usa cartoesHTML).

   REGRA DO PRODUTO: análise nunca altera nada. Não há "aplicar": são
   observações, e a equipe decide o que fazer. Nada roda sozinho — só
   quando a pessoa clica. O resultado fica em memória enquanto a tela
   está aberta; reabrir mostra o mesmo resultado sem gastar outra
   chamada, com aviso se o roteiro mudou desde então.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.IAAnalise = (function () {
  const esc = B7.UI.esc;
  const ligado = () => !!(B7.IA && B7.IA.ligada('roteiros')) &&
    !(B7.Auth && B7.Auth.papel && B7.Auth.papel() === 'designer');

  const IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 4l1.7 4.6L17.3 10l-4.6 1.7L11 16.3l-1.7-4.6L4.7 10l4.6-1.4z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>';

  /* o que o servidor chama de "tipo"/"aspecto", em português de tela */
  const TIPO = {
    gancho: 'Gancho', coerencia: 'Coerência', repeticao: 'Repetição', naturalidade: 'Naturalidade da fala',
    clareza: 'Clareza', ritmo: 'Ritmo', cta: 'CTA', alinhamento: 'Alinhamento', conferir: 'Conferir informação',
    semelhantes: 'Conteúdos semelhantes', abordagem: 'Repetição de abordagem', formatos: 'Variedade de formatos',
    pilares: 'Distribuição de pilares', variacao: 'Variação', oportunidade: 'Oportunidade'
  };
  const ASPECTO = { ideia: 'Ideia central', objetivo: 'Objetivo', angulo: 'Ângulo', pontos: 'Pontos-chave', formato: 'Formato', cta: 'CTA', tom: 'Tom de voz' };
  const SITUACAO = { alinhado: 'Alinhado', atencao: 'Atenção', mudanca: 'Mudança de abordagem' };
  const IMPORTANCIA = { atencao: 'Atenção', importante: 'Importante' };

  const OPERACOES = {
    revisar_roteiro: { titulo: 'Revisão do roteiro', gerando: 'Revisando roteiro…', de_novo: 'Revisar novamente',
      sub: 'Observações sobre o roteiro inteiro. Nada é alterado.',
      vazio: 'Não encontrei pontos relevantes para ajustar neste roteiro.',
      pouco: 'Adicione mais conteúdo ao roteiro para realizar uma revisão completa.',
      falha: 'Não foi possível revisar este roteiro agora.' },
    comparar_planejamento: { titulo: 'Comparação com o planejamento', gerando: 'Comparando com o planejamento…', de_novo: 'Comparar novamente',
      sub: 'O roteiro atual diante do conteúdo planejado na Linha Editorial. Nada é alterado.',
      vazio: 'Não há pontos para comparar.',
      pouco: 'Adicione mais conteúdo ao roteiro para comparar com o planejamento.',
      contexto: 'O conteúdo planejado ainda tem pouca informação para comparar. Preencha a ideia ou o objetivo dele na Linha Editorial.',
      falha: 'Não foi possível comparar este roteiro agora.' }
  };

  /* ---------------------------------------------------------- cartões */
  function cartao(it) {
    const comparacao = !!it.situacao;
    const classe = comparacao ? 'sit-' + it.situacao : 'imp-' + (it.importancia || 'observacao');
    const rotulo = comparacao ? (SITUACAO[it.situacao] || 'Observação') : (TIPO[it.tipo] || 'Observação');
    const extra = comparacao ? (ASPECTO[it.aspecto] || '') : (IMPORTANCIA[it.importancia] || '');
    const conteudos = Array.isArray(it.conteudos) ? it.conteudos : [];
    return '<article class="ia-ach ' + esc(classe) + '">' +
      '<div class="ia-ach-cab"><span class="ia-ach-tipo">' + esc(rotulo) + '</span>' +
        (extra ? '<span class="ia-ach-extra">' + esc(extra) + '</span>' : '') +
        (it.cena ? '<span class="ia-ach-cena">Cena ' + esc(it.cena) + '</span>' : '') + '</div>' +
      (it.titulo ? '<b class="ia-ach-tit">' + esc(it.titulo) + '</b>' : '') +
      '<p>' + esc(it.texto) + '</p>' +
      (it.sugestao ? '<p class="ia-ach-sug"><span>Sugestão</span>' + esc(it.sugestao) + '</p>' : '') +
      (conteudos.length ? '<div class="ia-ach-itens">' + conteudos.map(c =>
        '<span class="ia-chip" title="' + esc(c.titulo) + '">' + (c.tipo ? esc(c.tipo) + ' · ' : '') + esc(c.titulo) + '</span>').join('') + '</div>' : '') +
      (it.cena_id ? '<button type="button" class="b fina" data-ver-cena="' + esc(it.cena_id) + '">Ver cena</button>' : '') +
    '</article>';
  }
  function cartoesHTML(itens, resumo) {
    return (resumo ? '<p class="ia-ach-resumo">' + esc(resumo) + '</p>' : '') +
      '<div class="ia-ach-lista">' + (itens || []).map(cartao).join('') + '</div>';
  }
  function textoParaCopiar(itens, resumo) {
    const linhas = (itens || []).map(it => {
      const cab = it.situacao ? (SITUACAO[it.situacao] || '') + (ASPECTO[it.aspecto] ? ' · ' + ASPECTO[it.aspecto] : '')
                              : (TIPO[it.tipo] || 'Observação') + (it.cena ? ' · Cena ' + it.cena : '');
      return cab.toUpperCase() + '\n' + (it.titulo ? it.titulo + '\n' : '') + it.texto + (it.sugestao ? '\nSugestão: ' + it.sugestao : '');
    });
    return (resumo ? resumo + '\n\n' : '') + linhas.join('\n\n');
  }
  const contagem = (operacao, n) => operacao === 'comparar_planejamento'
    ? (n === 1 ? '1 ponto comparado.' : n + ' pontos comparados.')
    : (n === 1 ? 'Encontrei 1 observação.' : 'Encontrei ' + n + ' observações.');

  /* -------------------------------------------------- janela do roteiro
     Resultado guardado por roteiro e operação, com a "impressão" do
     roteiro no momento do pedido: se o texto mudar, a tela avisa. */
  const guardados = new Map();
  let seq = 0, aberta = false;

  function abrir(operacao, roteiro, hooks) {
    const O = OPERACOES[operacao];
    if (!O || !roteiro || aberta) return;        /* uma análise por vez: clique repetido não gera pedido duplicado */
    aberta = true;
    const chave = operacao + ':' + roteiro.id;
    const S = { fase: 'gerando', erro: '', token: 0, ctrl: null, fechada: false };

    const m = B7.UI.modal(
      '<div class="ia-jan-cab"><span class="ia-titulo">' + IC + '<b>' + esc(O.titulo) + '</b></span>' +
        '<button class="ico" data-fecha aria-label="Fechar">✕</button></div>' +
      '<div class="sub ia-jan-sub">' + esc(O.sub) + '</div>' +
      '<div class="ia-jan-corpo" data-corpo></div><div class="acoes" data-rodape></div>',
      { larga: true, extra: 'ia-janela', aoFechar: () => { S.fechada = true; aberta = false; if (S.ctrl) S.ctrl.abort(); } });
    const corpo = m.querySelector('[data-corpo]'), rodape = m.querySelector('[data-rodape]');

    function pintar() {
      if (S.fechada) return;
      const g = guardados.get(chave);
      let c = '', r = '';
      if (S.fase === 'gerando') {
        c = '<div class="ia-gerando" role="status" aria-live="polite"><span class="ia-pontos" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span>' + esc(O.gerando) + '</span><button type="button" class="b fina" data-ia-cancelar>Cancelar</button></div>';
      } else if (S.fase === 'erro') {
        c = '<p class="ia-erro" role="alert">' + esc(S.erro) + '</p><p class="ia-nota">Nada foi alterado no roteiro.</p>';
        r = '<button class="b" data-fecha>Fechar</button>' + (S.semRepetir ? '' : '<button class="b pri" data-gerar>Tentar novamente</button>');
      } else if (g) {
        const mudou = hooks.impressao() !== g.impressao;
        c = (mudou ? '<div class="ia-mudou" role="status"><span>O conteúdo mudou desde esta ' + (operacao === 'comparar_planejamento' ? 'comparação' : 'revisão') + '.</span>' +
              '<button type="button" class="b fina contorno" data-gerar>' + esc(O.de_novo) + '</button></div>' : '') +
          (g.itens.length
            ? '<p class="ia-ach-conta">' + esc(contagem(operacao, g.itens.length)) + '</p>' + cartoesHTML(g.itens, g.resumo)
            : '<p class="ia-ach-resumo">' + esc(g.resumo || O.vazio) + '</p>') +
          '<p class="ia-nota">São observações para apoiar a decisão da equipe. Nada foi alterado no roteiro.</p>';
        r = (g.itens.length ? '<button class="b" data-copiar>Copiar</button>' : '') +
          '<button class="b contorno" data-gerar>' + esc(O.de_novo) + '</button><button class="b pri" data-fecha>Fechar</button>';
      }
      corpo.innerHTML = c; rodape.innerHTML = r;
      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = () => m.fechar());
      const cancelar = corpo.querySelector('[data-ia-cancelar]'); if (cancelar) cancelar.onclick = () => m.fechar();
      m.querySelectorAll('[data-gerar]').forEach(b => b.onclick = () => pedir());
      const cp = rodape.querySelector('[data-copiar]');
      if (cp) cp.onclick = () => B7.UI.copiarTexto(textoParaCopiar(g.itens, g.resumo),
        { msgSucesso: 'Observações copiadas.', msgErro: 'Não foi possível copiar.', msgVazio: 'Não há observações para copiar.' });
      corpo.querySelectorAll('[data-ver-cena]').forEach(b => b.onclick = () => { const id = b.dataset.verCena; m.fechar(); hooks.verCena(id); });
    }

    async function pedir() {
      if (S.fase === 'gerando' && S.ctrl) return;                /* um pedido por vez */
      S.fase = 'gerando'; S.erro = ''; S.semRepetir = false;
      const token = S.token = ++seq;
      S.ctrl = new AbortController();
      pintar();
      /* o servidor lê o roteiro salvo: garante que o que está na tela já foi gravado */
      try { await hooks.salvar(); } catch (e) {}
      const impressao = hooks.impressao();
      const resp = await B7.IA.pedir('analise', { operacao: operacao, roteiro_id: roteiro.id }, { signal: S.ctrl.signal });
      if (S.fechada || S.token !== token) return;               /* fechou ou pediu de novo: resposta velha não aparece */
      S.ctrl = null;
      if (resp.cancelado) return;
      if (resp.ok && resp.itens) {
        guardados.set(chave, { itens: resp.itens, resumo: resp.resumo || '', impressao: impressao });
        S.fase = 'pronto';
      } else {
        S.fase = 'erro';
        S.semRepetir = ['pouco', 'sem_vinculo', 'contexto', 'sem_permissao'].includes(resp.categoria);
        S.erro = (resp.categoria && O[resp.categoria]) || (resp.categoria === 'indisponivel' ? O.falha + ' ' : '') + (resp.mensagem || O.falha);
      }
      pintar();
    }

    if (guardados.has(chave)) { S.fase = 'pronto'; pintar(); }
    else pedir();
    return m;
  }

  /* botões de entrada no cabeçalho do roteiro (vazio com a IA desligada) */
  function botoesHTML(roteiro) {
    if (!ligado() || !roteiro) return '';
    return '<div class="ia-roteiro-acoes">' +
      '<button type="button" class="ia-entrada" data-ia-analise="revisar_roteiro">' + IC + '<span>Revisar roteiro</span></button>' +
      /* só existe quando o roteiro nasceu de um conteúdo da Linha Editorial — vínculo real, nunca por título */
      (roteiro.content_id ? '<button type="button" class="ia-entrada" data-ia-analise="comparar_planejamento">' + IC + '<span>Comparar com planejamento</span></button>' : '') +
    '</div>';
  }
  /* `hooks`: { impressao(), salvar(), verCena(id) } */
  function ligar(raiz, roteiro, hooks) {
    if (!ligado() || !raiz) return;
    raiz.querySelectorAll('[data-ia-analise]').forEach(b => b.onclick = ev => {
      ev.preventDefault();
      abrir(b.dataset.iaAnalise, roteiro, hooks);
    });
  }

  return { botoesHTML, ligar, cartoesHTML, textoParaCopiar, ligado };
})();
