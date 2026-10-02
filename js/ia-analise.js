/* =====================================================================
   IA QUE REVISA E COMPARA — a mesma camada de IA do B7 (B7.IA → b7-ia),
   com a tarefa "analise". Em vez de escrever, ela LÊ o trabalho pronto:

     • Revisar roteiro            o roteiro inteiro como peça falada
     • Comparar com planejamento  o roteiro × o conteúdo da Linha Editorial
                                  de onde ele nasceu (só quando o vínculo
                                  existe de verdade: roteiros.content_id)

   Também desenha os cartões da revisão do conjunto da linha editorial
   (js/ia-linha.js usa cartoesHTML).

   E uma ação que escreve: "Criar rascunho", para o roteiro ainda sem
   fala. Ela só PROPÕE cenas; entram as que a pessoa marcar.

   REGRA DO PRODUTO: análise nunca altera nada. Não há "aplicar": são
   observações, e a equipe decide o que fazer. De uma observação dá para
   ir direto ao assistente da cena ("Ajustar com IA"), que continua
   exigindo Gerar e Aplicar. Nada roda sozinho — só quando a pessoa clica. O resultado fica em memória enquanto a tela
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
      (it.cena_id ? '<div class="ia-ach-acoes">' +
        /* fecha o ciclo: a sugestão vira instrução no assistente da cena — quem gera e aplica é a pessoa */
        (it.sugestao ? '<button type="button" class="b fina pri" data-ajustar-cena="' + esc(it.cena_id) + '" data-instrucao="' + esc(it.sugestao) + '">Ajustar com IA</button>' : '') +
        '<button type="button" class="b fina contorno" data-ver-cena="' + esc(it.cena_id) + '">Ver cena</button></div>' : '') +
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
      corpo.querySelectorAll('[data-ajustar-cena]').forEach(b => b.onclick = () => {
        const id = b.dataset.ajustarCena, instrucao = b.dataset.instrucao;
        m.fechar(); hooks.ajustarCena(id, instrucao);
      });
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

  /* ------------------------------------------------ rascunho do roteiro
     A única ação daqui que escreve — e mesmo assim só propõe: a pessoa vê
     as cenas, marca as que quer e só então elas entram no roteiro, pelo
     caminho de sempre do editor (hooks.adicionarCenas). */
  const LIMITE_INSTRUCAO = 300;
  function abrirRascunho(roteiro, hooks) {
    if (!roteiro || aberta) return;
    aberta = true;
    const S = { fase: 'config', itens: [], marcados: new Set(), instrucao: '', erro: '', aviso: '', token: 0, ctrl: null, ocupado: false, fechada: false };
    const m = B7.UI.modal(
      '<div class="ia-jan-cab"><span class="ia-titulo">' + IC + '<b>Criar rascunho do roteiro</b></span>' +
        '<button class="ico" data-fecha aria-label="Fechar">✕</button></div>' +
      '<div class="sub ia-jan-sub">Uma primeira versão das cenas, a partir do título e do objetivo' +
        (roteiro.content_id ? ' e do conteúdo planejado na Linha Editorial' : '') + '. Você escolhe o que entra no roteiro.</div>' +
      '<div class="ia-jan-corpo" data-corpo></div><div class="acoes" data-rodape></div>',
      { larga: true, extra: 'ia-janela', aoFechar: () => { S.fechada = true; aberta = false; if (S.ctrl) S.ctrl.abort(); } });
    const corpo = m.querySelector('[data-corpo]'), rodape = m.querySelector('[data-rodape]');
    const plural = n => n === 1 ? '1 cena' : n + ' cenas';

    function pintar() {
      if (S.fechada) return;
      let c = '', r = '';
      if (S.fase === 'config') {
        c = '<label class="rot" for="ia-rasc-in">O QUE O VÍDEO PRECISA DIZER <span class="leve">— opcional</span></label>' +
          '<textarea class="campo" id="ia-rasc-in" rows="3" maxlength="' + LIMITE_INSTRUCAO + '" ' +
            'placeholder="Ex.: explicar em 3 passos como funciona a primeira consulta, tom leve">' + esc(S.instrucao) + '</textarea>' +
          '<p class="ia-nota">Nenhuma cena é criada agora: primeiro você vê o rascunho.</p>';
        r = '<button class="b" data-fecha>Cancelar</button><button class="b pri" data-gerar>Gerar rascunho</button>';
      } else if (S.fase === 'gerando') {
        c = '<div class="ia-gerando" role="status" aria-live="polite"><span class="ia-pontos" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<span>Escrevendo o rascunho…</span><button type="button" class="b fina" data-ia-cancelar>Cancelar</button></div>';
      } else if (S.fase === 'erro') {
        c = '<p class="ia-erro" role="alert">' + esc(S.erro) + '</p><p class="ia-nota">Nada foi alterado no roteiro.</p>';
        r = '<button class="b" data-fecha>Fechar</button><button class="b pri" data-voltar>Voltar</button>';
      } else {
        const n = S.marcados.size;
        c = (S.aviso ? '<p class="ia-nota erro" role="alert">' + esc(S.aviso) + '</p>' : '') +
          '<div class="ia-itens" role="group" aria-label="Cenas do rascunho">' + S.itens.map((it, i) => {
            const on = S.marcados.has(i);
            return '<label class="ia-item' + (on ? ' on' : '') + '"><input type="checkbox" data-item="' + i + '"' + (on ? ' checked' : '') + '>' +
              '<span class="ia-item-tx"><span class="ia-item-meta"><span class="ia-chip pilar">' + esc(it.tipo) + '</span>' +
                (it.orientacao ? '<span class="ia-chip">' + esc(it.orientacao) + '</span>' : '') + '</span>' +
              '<span class="ia-item-fala">' + esc(it.fala) + '</span></span></label>';
          }).join('') + '</div>' +
          '<p class="ia-nota">É um rascunho: confira dados e o que estiver entre [colchetes] antes de gravar. As cenas marcadas entram no roteiro e podem ser editadas normalmente.</p>';
        r = '<button class="b" data-fecha>Descartar</button><button class="b contorno" data-gerar' + (S.ocupado ? ' disabled' : '') + '>Gerar outro</button>' +
          '<button class="b pri" data-adicionar' + (!n || S.ocupado ? ' disabled' : '') + '>' +
          (S.ocupado ? 'Adicionando…' : n ? 'Adicionar ' + plural(n) : 'Adicionar cenas') + '</button>';
      }
      corpo.innerHTML = c; rodape.innerHTML = r;
      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = () => m.fechar());
      const campo = corpo.querySelector('#ia-rasc-in'); if (campo) campo.oninput = () => { S.instrucao = campo.value; };
      const cancelar = corpo.querySelector('[data-ia-cancelar]'); if (cancelar) cancelar.onclick = () => m.fechar();
      const g = rodape.querySelector('[data-gerar]'); if (g) g.onclick = () => pedir();
      const v = rodape.querySelector('[data-voltar]'); if (v) v.onclick = () => { S.fase = 'config'; pintar(); };
      corpo.querySelectorAll('[data-item]').forEach(ch => ch.onchange = () => {
        const i = +ch.dataset.item;
        if (ch.checked) S.marcados.add(i); else S.marcados.delete(i);
        pintar();
        const de = corpo.querySelector('[data-item="' + i + '"]'); if (de) de.focus();
      });
      const ad = rodape.querySelector('[data-adicionar]'); if (ad) ad.onclick = () => adicionar();
    }

    async function pedir() {
      if (S.fase === 'gerando' || S.ocupado) return;
      const instrucao = (S.instrucao || '').replace(/\s+/g, ' ').trim();
      S.fase = 'gerando'; S.erro = ''; S.aviso = '';
      const token = S.token = ++seq;
      S.ctrl = new AbortController();
      pintar();
      try { await hooks.salvar(); } catch (e) {}
      const dados = { operacao: 'rascunho_roteiro', roteiro_id: roteiro.id };
      if (instrucao.length >= 3) dados.instrucao = instrucao;
      const resp = await B7.IA.pedir('analise', dados, { signal: S.ctrl.signal });
      if (S.fechada || S.token !== token) return;
      S.ctrl = null;
      if (resp.cancelado) return;
      if (resp.ok && resp.itens && resp.itens.length) {
        S.itens = resp.itens; S.marcados = new Set(resp.itens.map((x, i) => i)); S.fase = 'lista';
      } else {
        S.fase = 'erro';
        S.erro = resp.categoria === 'contexto'
          ? 'Ainda não há assunto para escrever. Dê um título ou objetivo ao roteiro, ou escreva acima o que o vídeo precisa dizer.'
          : (resp.mensagem || 'Não foi possível criar o rascunho agora.');
      }
      pintar();
    }

    async function adicionar() {
      if (S.ocupado || !S.marcados.size) return;
      S.ocupado = true; S.aviso = '';
      pintar();
      const escolhidas = [...S.marcados].sort((a, b) => a - b).map(i => S.itens[i]);
      try {
        await hooks.adicionarCenas(escolhidas);
        m.fechar();
        B7.UI.toast((escolhidas.length === 1 ? '1 cena adicionada' : escolhidas.length + ' cenas adicionadas') + ' ao roteiro.');
      } catch (e) {
        S.ocupado = false;
        S.aviso = 'Não foi possível adicionar as cenas. Confira a conexão e tente de novo.';
        if (S.fechada) { B7.UI.toast(S.aviso, { tipo: 'erro' }); return; }
        pintar();
      }
    }

    pintar();
    const campo = corpo.querySelector('#ia-rasc-in'); if (campo) { try { campo.focus({ preventScroll: true }); } catch (e) {} }
    return m;
  }

  /* Bloco da IA no topo do roteiro (vazio com a IA desligada).
     `cenas`: as cenas do roteiro como estão na tela — com o roteiro ainda
     sem fala, a ação principal é criar o rascunho. */
  function botoesHTML(roteiro, cenas) {
    if (!ligado() || !roteiro) return '';
    const falado = (cenas || []).reduce((n, c) => n + String(c.texto || '').trim().length, 0);
    const semFala = falado < 60;
    return '<div class="ia-bloco">' +
      '<div class="ia-bloco-cab">' + IC + '<b>IA do roteiro</b><span>' +
        (semFala ? 'Comece por um rascunho e ajuste do seu jeito.' : 'Uma segunda leitura antes de gravar. Nada muda sem você.') + '</span></div>' +
      '<div class="ia-roteiro-acoes">' +
        (semFala ? '<button type="button" class="ia-entrada cheia" data-ia-rascunho>' + IC + '<span>Criar rascunho</span></button>' : '') +
        '<button type="button" class="ia-entrada' + (semFala ? '' : ' cheia') + '" data-ia-analise="revisar_roteiro">' + IC + '<span>Revisar roteiro</span></button>' +
        /* só existe quando o roteiro nasceu de um conteúdo da Linha Editorial — vínculo real, nunca por título */
        (roteiro.content_id ? '<button type="button" class="ia-entrada" data-ia-analise="comparar_planejamento">' + IC + '<span>Comparar com planejamento</span></button>' : '') +
      '</div></div>';
  }
  /* `hooks`: { impressao(), salvar(), verCena(id), ajustarCena(id, instrucao), adicionarCenas(lista) } */
  function ligar(raiz, roteiro, hooks) {
    if (!ligado() || !raiz) return;
    raiz.querySelectorAll('[data-ia-analise]').forEach(b => b.onclick = ev => {
      ev.preventDefault();
      abrir(b.dataset.iaAnalise, roteiro, hooks);
    });
    const rasc = raiz.querySelector('[data-ia-rascunho]');
    if (rasc) rasc.onclick = ev => { ev.preventDefault(); abrirRascunho(roteiro, hooks); };
  }

  return { botoesHTML, ligar, cartoesHTML, textoParaCopiar, ligado };
})();
