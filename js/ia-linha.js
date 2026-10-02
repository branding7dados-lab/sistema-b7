/* =====================================================================
   ASSISTENTE DE IA NA LINHA EDITORIAL

   A mesma camada de IA dos roteiros (B7.IA → função b7-ia), com a tarefa
   "linha". Três formas de ajuda, todas pedidas pela pessoa:

     1. CAMPO      um ícone discreto no rótulo de um campo de texto abre
                   um painel logo abaixo do campo: ações → gerando →
                   sugestão (Aplicar / Copiar / Gerar novamente /
                   Descartar). Vale para os campos da estratégia, o
                   objetivo de um pilar e os textos de um conteúdo.
     2. SUGESTÕES  "Sugerir pilares" e "Sugerir conteúdos" abrem uma
                   janela com uma lista; a pessoa MARCA o que quer e só
                   isso é criado — pelo mesmo caminho de um pilar ou
                   conteúdo criado à mão (quem cria é a linha.js).
     3. REVISÃO    "Revisar estratégia" e "Revisar linha editorial"
                   mostram observações. Não alteram nada.

   REGRA DO PRODUTO: a IA nunca mexe na linha sozinha. Um campo só muda
   em "Aplicar", e a mudança entra pelo evento input do próprio campo —
   o mesmo caminho da digitação (espelho em memória + autosave). Nada
   aqui grava no banco.

   Nada roda sozinho: não há pedido ao abrir a linha, ao trocar de aba,
   ao digitar nem ao salvar. Com a IA fora do ar, a linha funciona igual.

   Quem não edita a linha (designer) não vê nenhuma entrada de IA.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.IALinha = (function () {
  const esc = B7.UI.esc;
  const ligado = () => !!(B7.IA && B7.IA.ligada('linhas')) &&
    !(B7.Conteudo && B7.Conteudo.souDesignerSomenteLeitura && B7.Conteudo.souDesignerSomenteLeitura());

  const IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 4l1.7 4.6L17.3 10l-4.6 1.7L11 16.3l-1.7-4.6L4.7 10l4.6-1.4z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>';
  const GERANDO = txt => '<div class="ia-gerando" role="status" aria-live="polite">' +
    '<span class="ia-pontos" aria-hidden="true"><i></i><i></i><i></i></span><span>' + esc(txt) + '</span>' +
    '<button type="button" class="b fina" data-ia-cancelar>Cancelar</button></div>';

  /* ================================================================
     1. CAMPOS
     Quais campos têm assistência e que ações fazem sentido em cada um.
     A lista é a mesma do servidor (_shared/ia/linha.ts → CAMPOS): só
     campos que já existem no B7.
     ================================================================ */
  const A = (acao, rot) => [acao, rot];
  const TIPOS = {
    longo:    { com: [A('melhorar', 'Melhorar'), A('clarear', 'Deixar mais claro'), A('desenvolver', 'Desenvolver melhor'), A('resumir', 'Resumir'), A('variacao', 'Criar outra versão')],
                sem: [A('criar', 'Sugerir um texto')] },
    tom:      { com: [A('melhorar', 'Melhorar'), A('clarear', 'Deixar mais claro'), A('variacao', 'Criar outra versão')], sem: [A('criar', 'Sugerir tom de voz')] },
    pilar:    { com: [A('melhorar', 'Melhorar descrição'), A('clarear', 'Deixar mais claro'), A('variacao', 'Criar outra versão')], sem: [A('criar', 'Sugerir descrição')] },
    titulo:   { com: [A('melhorar', 'Melhorar título'), A('variacao', 'Criar outra versão'), A('encurtar', 'Encurtar')], sem: [A('criar', 'Sugerir título')] },
    conceito: { com: [A('melhorar', 'Melhorar conceito'), A('desenvolver', 'Desenvolver ideia'), A('encurtar', 'Encurtar'), A('variacao', 'Criar outra versão')], sem: [A('criar', 'Sugerir conceito')] },
    curto:    { com: [A('melhorar', 'Melhorar'), A('variacao', 'Criar outra versão'), A('encurtar', 'Encurtar')], sem: [A('criar', 'Sugerir')] },
    cta:      { com: [A('melhorar', 'Melhorar CTA'), A('variacao', 'Criar outra versão')], sem: [A('criar', 'Sugerir CTA')] },
    legenda:  { com: [A('melhorar', 'Melhorar legenda'), A('variacao', 'Criar outra versão'), A('encurtar', 'Encurtar'), A('naturalizar', 'Deixar mais natural'), A('hashtags', 'Sugerir hashtags')], sem: [A('criar', 'Criar legenda')] },
    /* orientação para o designer (Direção visual / Observação para o design) */
    direcao:  { com: [A('melhorar', 'Melhorar'), A('clarear', 'Deixar mais claro'), A('variacao', 'Criar outra versão')], sem: [A('criar', 'Sugerir orientação')] }
  };
  const CAMPOS = {
    'linhas_editoriais.objetivo': ['linha', 'longo'], 'linhas_editoriais.objetivo_detalhe': ['linha', 'longo'],
    'linhas_editoriais.posicionamento': ['linha', 'longo'], 'linhas_editoriais.tom_voz': ['linha', 'tom'],
    'linhas_editoriais.puv': ['linha', 'longo'], 'linhas_editoriais.percepcao': ['linha', 'longo'],
    'pilares.objetivo': ['pilar', 'pilar'],
    'conteudos.titulo': ['conteudo', 'titulo'], 'conteudos.objetivo': ['conteudo', 'longo'], 'conteudos.ideia_geral': ['conteudo', 'conceito'],
    'conteudos.headline': ['conteudo', 'curto'], 'conteudos.sub_headline': ['conteudo', 'curto'],
    'conteudos.cta': ['conteudo', 'cta'], 'conteudos.legenda': ['conteudo', 'legenda'],
    'conteudos.direcao': ['conteudo', 'direcao'], 'conteudos.observacao_design': ['conteudo', 'direcao']
  };
  const LIMITE_TEXTO = 4000, LIMITE_INSTRUCAO = 300;
  const TODOS = Object.keys(TIPOS).reduce((m, k) => { TIPOS[k].com.concat(TIPOS[k].sem).forEach(([a, r]) => { m[k + '.' + a] = r; }); return m; }, {});

  const estados = new Map();   /* chave do campo → estado do painel */
  const vivos = new Map();     /* chave do campo → { el, botao, painel, rotulo, tipo, alvo } como estão no DOM agora */
  let seq = 0, hooks = null;

  const chaveDe = el => el.dataset.tab + ':' + el.dataset.id + ':' + el.dataset.campo;
  const ref = k => { const v = vivos.get(k); return v && v.el.isConnected ? v : null; };

  function ligarCampos(raiz) {
    raiz.querySelectorAll('[data-campo][data-tab]').forEach(el => {
      const cfg = CAMPOS[el.dataset.tab + '.' + el.dataset.campo];
      if (!cfg || el.disabled || el.readOnly) return;
      const cx = el.closest('.mb') || el.parentElement;
      const rotulo = cx && cx.querySelector('label.rot');
      if (!rotulo) return;
      const k = chaveDe(el);
      let botao = rotulo.querySelector('.ia-campo-btn');
      if (!botao) {
        const nome = (rotulo.textContent || '').replace(/—.*$/, '').trim();
        rotulo.classList.add('rot-ia');
        botao = document.createElement('button');
        botao.type = 'button'; botao.className = 'ia-campo-btn';
        botao.title = 'Assistente de IA';
        botao.setAttribute('aria-label', 'Assistente de IA: ' + nome.toLowerCase());
        botao.setAttribute('aria-expanded', 'false');
        botao.innerHTML = IC + '<span>IA</span>';
        rotulo.appendChild(botao);
        const painel = document.createElement('div');
        painel.className = 'ia-painel ia-campo-painel'; painel.hidden = true;
        painel.setAttribute('role', 'region'); painel.setAttribute('aria-label', 'Assistente de IA: ' + nome.toLowerCase());
        el.insertAdjacentElement('afterend', painel);
        vivos.set(k, { el, botao, painel, rotulo: nome, alvo: cfg[0], tipo: cfg[1] });
        botao.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); alternar(k); };
      }
      /* a tela foi redesenhada: se havia sugestão ou pedido deste campo, o painel volta */
      if (estados.has(k)) pintar(k);
    });
  }

  function alternar(k) {
    if (estados.has(k)) return fechar(k);
    estados.set(k, { fase: 'acoes', acao: null, instrucao: '', sugestao: '', erro: '', token: 0, ctrl: null });
    pintar(k);
    focar(k, '[data-ia-acao], [data-ia-instrucao]');
  }
  function fechar(k) {
    const st = estados.get(k);
    if (st && st.ctrl) st.ctrl.abort();
    estados.delete(k);
    pintar(k);
    const r = ref(k); if (r) r.botao.focus();
  }
  function focar(k, seletor) {
    const r = ref(k), alvo = r && r.painel.querySelector(seletor);
    if (alvo) { try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); } }
  }

  function pintar(k) {
    const r = ref(k);
    if (!r) return;
    const st = estados.get(k);
    r.botao.setAttribute('aria-expanded', st ? 'true' : 'false');
    r.botao.classList.toggle('on', !!st);
    if (!st) { r.painel.hidden = true; r.painel.innerHTML = ''; return; }
    r.painel.hidden = false;

    const cab = '<div class="ia-cab"><span class="ia-titulo">' + IC + '<b>Assistente de IA</b></span>' +
      '<span class="ia-alvo">' + esc(r.rotulo) + '</span>' +
      '<button type="button" class="ia-fechar" data-ia-fechar aria-label="Fechar o assistente">×</button></div>';
    let corpo = '';
    if (st.fase === 'acoes') {
      const vazio = !r.el.value.trim();
      const longo = r.el.value.length > LIMITE_TEXTO;
      const acoes = TIPOS[r.tipo][vazio ? 'sem' : 'com'];
      corpo = longo
        ? '<p class="ia-nota erro">Este texto passa de ' + LIMITE_TEXTO + ' caracteres. Reduza antes de pedir ajuda.</p>'
        : '<div class="ia-acoes" role="group" aria-label="O que pedir">' +
            acoes.map(([a, rot]) => '<button type="button" class="ia-acao" data-ia-acao="' + a + '">' + esc(rot) + '</button>').join('') + '</div>' +
          '<form class="ia-instrucao" data-ia-form>' +
            '<label class="rot" for="ia-in-' + esc(k) + '">ESCREVER INSTRUÇÃO</label>' +
            '<div class="ia-instrucao-linha">' +
              '<input class="campo" id="ia-in-' + esc(k) + '" data-ia-instrucao maxlength="' + LIMITE_INSTRUCAO + '" autocomplete="off" ' +
                'placeholder="Ex.: menos comercial, mais educativo" value="' + esc(st.instrucao || '') + '">' +
              '<button type="submit" class="b fina contorno">Gerar</button>' +
            '</div></form>' +
          '<p class="ia-nota">' + (vazio ? 'O campo está vazio: a sugestão usa só o que já está preenchido nesta linha. ' : '') +
            'Nada muda até você aplicar.</p>';
    } else if (st.fase === 'gerando') {
      corpo = GERANDO('Gerando sugestão…');
    } else if (st.fase === 'resultado') {
      corpo = '<div class="ia-rotulo">Sugestão · ' + esc(st.acao === 'instrucao' ? '“' + st.instrucao + '”' : (TODOS[r.tipo + '.' + st.acao] || '')) + '</div>' +
        '<div class="ia-sugestao" data-ia-sugestao tabindex="0">' + esc(st.sugestao) + '</div>' +
        (st.aviso ? '<p class="ia-nota erro" role="alert">' + esc(st.aviso) + '</p>' : '') +
        '<div class="ia-botoes">' +
          '<button type="button" class="b pri fina" data-ia-aplicar>' + (st.confirmar ? 'Aplicar mesmo assim' : 'Aplicar') + '</button>' +
          '<button type="button" class="b fina contorno" data-ia-copiar>Copiar</button>' +
          '<button type="button" class="b fina contorno" data-ia-de-novo>Gerar novamente</button>' +
          '<button type="button" class="b fina" data-ia-descartar>Descartar sugestão</button>' +
        '</div><p class="ia-nota">O campo ainda não foi alterado.</p>';
    } else {
      corpo = '<p class="ia-erro" role="alert">' + esc(st.erro) + '</p>' +
        '<div class="ia-botoes"><button type="button" class="b fina contorno" data-ia-de-novo>Tentar novamente</button>' +
        '<button type="button" class="b fina" data-ia-voltar>Voltar</button></div>' +
        '<p class="ia-nota">Seu texto continua como estava.</p>';
    }
    r.painel.innerHTML = cab + corpo;

    const p = r.painel, q = s => p.querySelector(s);
    q('[data-ia-fechar]').onclick = () => fechar(k);
    p.querySelectorAll('[data-ia-acao]').forEach(b => b.onclick = () => gerar(k, b.dataset.iaAcao, null));
    const form = q('[data-ia-form]');
    if (form) {
      const campo = q('[data-ia-instrucao]');
      campo.oninput = () => { st.instrucao = campo.value; };
      form.onsubmit = ev => {
        ev.preventDefault(); ev.stopPropagation();
        const texto = campo.value.replace(/\s+/g, ' ').trim();
        if (texto.length < 3) { campo.focus(); return; }
        gerar(k, 'instrucao', texto);
      };
    }
    if (q('[data-ia-cancelar]')) q('[data-ia-cancelar]').onclick = () => { if (st.ctrl) st.ctrl.abort(); st.token = 0; st.ctrl = null; st.fase = 'acoes'; pintar(k); focar(k, '[data-ia-acao], [data-ia-instrucao]'); };
    if (q('[data-ia-aplicar]')) q('[data-ia-aplicar]').onclick = () => aplicar(k);
    if (q('[data-ia-copiar]')) q('[data-ia-copiar]').onclick = ev => copiar(st.sugestao, ev.currentTarget);
    if (q('[data-ia-de-novo]')) q('[data-ia-de-novo]').onclick = () => gerar(k, st.acao, st.acao === 'instrucao' ? st.instrucao : null);
    if (q('[data-ia-descartar]')) q('[data-ia-descartar]').onclick = () => fechar(k);
    if (q('[data-ia-voltar]')) q('[data-ia-voltar]').onclick = () => { st.fase = 'acoes'; pintar(k); focar(k, '[data-ia-acao], [data-ia-instrucao]'); };
    /* Esc dentro do painel: fecha só a escolha de ações, e não o modal em volta */
    p.onkeydown = ev => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      if (st.fase === 'acoes') fechar(k);
    };
  }

  async function gerar(k, acao, instrucao) {
    const st = estados.get(k), r = ref(k);
    if (!st || !r || st.fase === 'gerando') return;        /* uma geração por campo de cada vez */
    /* campo que ficou vazio (ou deixou de estar) entre abrir e pedir */
    const vazio = !r.el.value.trim();
    if (acao !== 'instrucao') acao = vazio ? 'criar' : (acao === 'criar' ? 'melhorar' : acao);
    st.base = r.el.value; st.acao = acao; st.instrucao = instrucao || st.instrucao || '';
    st.aviso = ''; st.confirmar = false; st.erro = '';
    st.fase = 'gerando';
    const token = st.token = ++seq;
    st.ctrl = new AbortController();
    pintar(k); focar(k, '[data-ia-cancelar]');

    /* o servidor lê os OUTROS campos do banco: o que ainda estava no
       tempo de espera do autosave vai agora */
    try { await B7.Save.agora(); } catch (e) {}
    const resp = await B7.IA.pedir('linha', {
      operacao: 'campo', linha_id: hooks.linhaId(), alvo_tipo: r.alvo, alvo_id: r.el.dataset.id, campo: r.el.dataset.campo,
      acao: acao, texto: st.base, instrucao: acao === 'instrucao' ? instrucao : undefined
    }, { signal: st.ctrl.signal });

    /* resposta atrasada: o painel foi fechado, cancelado ou já pediu outra coisa */
    if (estados.get(k) !== st || st.token !== token) return;
    st.ctrl = null;
    if (resp.cancelado) return;
    if (resp.ok && resp.texto) { st.fase = 'resultado'; st.sugestao = resp.texto; }
    else { st.fase = 'erro'; st.erro = resp.mensagem || 'Não foi possível gerar a sugestão.'; }
    pintar(k);
    focar(k, st.fase === 'resultado' ? '[data-ia-sugestao]' : '[data-ia-de-novo]');
  }

  async function copiar(texto, botao) {
    const ok = await B7.UI.copiarTexto(texto, { msgSucesso: 'Sugestão copiada.', msgErro: 'Não foi possível copiar a sugestão.', msgVazio: 'Não há sugestão para copiar.' });
    if (ok && botao && botao.isConnected) {
      const antes = botao.textContent;
      botao.textContent = 'Copiado';
      setTimeout(() => { if (botao.isConnected) botao.textContent = antes; }, 1600);
    }
  }

  /* Escreve no campo pelo caminho da digitação: o evento input é o que
     a linha já usa para espelhar o valor em memória e chamar o autosave. */
  function escrever(el, valor) {
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function aplicar(k) {
    const st = estados.get(k), r = ref(k);
    if (!st || !r || st.fase !== 'resultado' || st.aplicando) return;
    const atual = r.el.value;
    if (atual !== st.base && !st.confirmar) {
      st.confirmar = true;
      st.aviso = 'O texto deste campo mudou depois do pedido. Aplicar vai substituir o texto atual pela sugestão.';
      pintar(k); focar(k, '[data-ia-aplicar]');
      return;
    }
    st.aplicando = true;
    /* campo de uma linha só nunca recebe quebra de linha */
    const novo = r.el.tagName === 'INPUT' ? st.sugestao.replace(/\s*\n+\s*/g, ' ') : st.sugestao;
    escrever(r.el, novo);
    estados.delete(k);
    pintar(k);
    try { r.el.focus({ preventScroll: true }); } catch (e) {}
    B7.UI.toast('Sugestão aplicada.', {
      acao: 'Desfazer',
      aoClicar: () => {
        const agora = ref(k);
        if (!agora) return;
        if (agora.el.value !== novo) { B7.UI.toast('O texto já mudou depois disso. Nada foi desfeito.'); return; }
        escrever(agora.el, atual);
      }
    });
  }

  /* ================================================================
     2 e 3. SUGESTÕES E REVISÕES — uma janela, quatro usos
     ================================================================ */
  const JANELAS = {
    sugerir_conteudos: { titulo: 'Sugerir conteúdos', gerando: 'Criando ideias…', lista: true,
      sub: 'Ideias a partir da estratégia, dos pilares e do que já está planejado neste mês. Você escolhe quais viram conteúdo.' },
    sugerir_pilares: { titulo: 'Sugerir pilares', gerando: 'Gerando sugestões…', lista: true,
      sub: 'Tipos de pilar que ainda não estão nesta linha, com base na estratégia. Você escolhe quais adicionar; o peso de cada um continua com você.' },
    revisar_estrategia: { titulo: 'Revisar estratégia', gerando: 'Analisando estratégia…',
      sub: 'Observações sobre o que está preenchido. Nada é alterado.' },
    revisar_linha: { titulo: 'Revisar linha editorial', gerando: 'Analisando o planejamento…',
      sub: 'O planejamento do mês visto como conjunto: repetições, pilares, formatos, CTAs e alinhamento com a estratégia. Nada é alterado.' }
  };
  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

  function abrirJanela(operacao, opcoes) {
    opcoes = opcoes || {};
    const J = JANELAS[operacao];
    const pilar = opcoes.pilarId ? (hooks.pilares() || []).find(p => p.id === opcoes.pilarId) : null;
    const S = { fase: operacao === 'sugerir_conteudos' ? 'config' : 'gerando', itens: [], marcados: new Set(), erro: '', aviso: '',
                quantidade: 5, foco: '', token: 0, ctrl: null, ocupado: false, fechada: false };

    const m = B7.UI.modal(
      '<div class="ia-jan-cab"><span class="ia-titulo">' + IC + '<b>' + esc(J.titulo) + '</b></span>' +
        '<button class="ico" data-fecha aria-label="Fechar">✕</button></div>' +
      '<div class="sub ia-jan-sub">' + esc(pilar && pilar.nome ? 'Ideias para o pilar “' + pilar.nome + '”. Você escolhe quais viram conteúdo.' : J.sub) + '</div>' +
      '<div class="ia-jan-corpo" data-corpo></div><div class="acoes" data-rodape></div>',
      { larga: true, extra: 'ia-janela', aoFechar: () => { S.fechada = true; if (S.ctrl) S.ctrl.abort(); } });
    const corpo = m.querySelector('[data-corpo]'), rodape = m.querySelector('[data-rodape]');

    function itemHTML(it, i) {
      const on = S.marcados.has(i);
      if (operacao === 'sugerir_conteudos') {
        return '<label class="ia-item' + (on ? ' on' : '') + '"><input type="checkbox" data-item="' + i + '"' + (on ? ' checked' : '') + '>' +
          '<span class="ia-item-tx"><span class="ia-item-meta"><span class="ia-chip">' + esc(it.formato) + '</span>' +
            (it.pilar ? '<span class="ia-chip pilar">' + esc(it.pilar) + '</span>' : '') + '</span>' +
          '<b>' + esc(it.titulo) + '</b>' + (it.ideia ? '<span class="ia-item-ds">' + esc(it.ideia) + '</span>' : '') +
          (it.cta ? '<span class="ia-item-nota">CTA: ' + esc(it.cta) + '</span>' : '') +
          (it.parecido ? '<span class="ia-item-nota alerta">Parecido com um conteúdo que já está na linha.</span>' : '') +
          (it.falhou ? '<span class="ia-item-nota alerta">Não foi possível adicionar. Tente de novo.</span>' : '') +
          '</span></label>';
      }
      return '<label class="ia-item' + (on ? ' on' : '') + '"><input type="checkbox" data-item="' + i + '"' + (on ? ' checked' : '') + '>' +
        '<span class="ia-item-tx"><span class="ia-item-meta"><span class="ia-chip">Funil: ' + esc(it.funil) + '</span></span>' +
        '<b>' + esc(it.tipo) + '</b><span class="ia-item-ds">' + esc(it.objetivo) + '</span>' +
        (it.motivo ? '<span class="ia-item-nota">Por quê: ' + esc(it.motivo) + '</span>' : '') +
        (it.falhou ? '<span class="ia-item-nota alerta">Não foi possível adicionar. Tente de novo.</span>' : '') +
        '</span></label>';
    }

    function pintarJanela() {
      if (S.fechada) return;
      let c = '', r = '';
      if (S.fase === 'config') {
        c = '<label class="rot">QUANTAS IDEIAS</label>' +
          '<div class="ia-qtd" role="radiogroup" aria-label="Quantas ideias">' + [3, 5, 8].map(n =>
            '<button type="button" role="radio" aria-checked="' + (S.quantidade === n) + '" class="' + (S.quantidade === n ? 'on' : '') + '" data-qtd="' + n + '">' + n + '</button>').join('') + '</div>' +
          '<label class="rot" for="ia-foco">DIRECIONAMENTO <span class="leve">— opcional</span></label>' +
          '<input class="campo" id="ia-foco" maxlength="' + LIMITE_INSTRUCAO + '" autocomplete="off" placeholder="Ex.: mais conteúdos educativos, voltados para pais" value="' + esc(S.foco) + '">' +
          '<p class="ia-nota">Nenhum conteúdo é criado agora: primeiro você vê as ideias.</p>';
        r = '<button class="b" data-fecha>Cancelar</button><button class="b pri" data-gerar data-foco>Gerar sugestões</button>';
      } else if (S.fase === 'gerando') {
        c = GERANDO(J.gerando);
      } else if (S.fase === 'erro') {
        c = '<p class="ia-erro" role="alert">' + esc(S.erro) + '</p><p class="ia-nota">Nada foi alterado na linha.</p>';
        r = '<button class="b" data-fecha>Fechar</button><button class="b pri" data-gerar>Tentar novamente</button>';
      } else if (S.fase === 'vazio') {
        c = '<p class="ia-nota">' + esc(S.aviso) + '</p>';
        r = '<button class="b pri" data-fecha>Fechar</button>';
      } else if (J.lista) {
        const n = S.marcados.size;
        c = (S.aviso ? '<p class="ia-nota erro" role="alert">' + esc(S.aviso) + '</p>' : '') +
          '<div class="ia-itens" role="group" aria-label="Sugestões">' + S.itens.map(itemHTML).join('') + '</div>' +
          '<p class="ia-nota">Marque o que quiser manter. O que não for marcado é descartado ao fechar.</p>';
        r = '<button class="b" data-fecha>Descartar</button><button class="b contorno" data-gerar' + (S.ocupado ? ' disabled' : '') + '>Gerar outras</button>' +
          '<button class="b pri" data-adicionar' + (!n || S.ocupado ? ' disabled' : '') + '>' +
          (S.ocupado ? 'Adicionando…' : n ? 'Adicionar ' + plural(n, 'selecionado', 'selecionados') : 'Adicionar selecionados') + '</button>';
      } else {
        /* revisão do conjunto: cartões estruturados (tipo, conteúdos citados, sugestão);
           revisão da estratégia continua no formato tema + texto */
        const estruturado = S.itens.some(o => o.tipo) && B7.IAAnalise;
        c = (estruturado
            ? '<p class="ia-ach-conta">' + (S.itens.length === 1 ? 'Encontrei 1 observação.' : 'Encontrei ' + S.itens.length + ' observações.') + '</p>' +
              B7.IAAnalise.cartoesHTML(S.itens, S.resumo)
            : '<div class="ia-obs-lista">' + S.itens.map(o => '<div class="ia-obs"><b>' + esc(o.tema) + '</b><p>' + esc(o.texto) + '</p></div>').join('') + '</div>') +
          '<p class="ia-nota">São observações para apoiar a sua decisão. Nada foi alterado.</p>';
        r = '<button class="b" data-copiar>Copiar</button><button class="b contorno" data-gerar>Gerar novamente</button><button class="b pri" data-fecha>Fechar</button>';
      }
      corpo.innerHTML = c; rodape.innerHTML = r;

      m.querySelectorAll('[data-fecha]').forEach(b => b.onclick = () => m.fechar());
      corpo.querySelectorAll('[data-qtd]').forEach(b => b.onclick = () => { S.foco = (corpo.querySelector('#ia-foco') || {}).value || ''; S.quantidade = +b.dataset.qtd; pintarJanela(); });
      const foco = corpo.querySelector('#ia-foco');
      if (foco) { foco.oninput = () => { S.foco = foco.value; }; foco.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); pedir(); } }; }
      const cancelar = corpo.querySelector('[data-ia-cancelar]');
      if (cancelar) cancelar.onclick = () => m.fechar();
      const g = rodape.querySelector('[data-gerar]');
      if (g) g.onclick = () => pedir();
      corpo.querySelectorAll('[data-item]').forEach(ch => ch.onchange = () => {
        const i = +ch.dataset.item;
        if (ch.checked) S.marcados.add(i); else S.marcados.delete(i);
        pintarJanela();
        const de = corpo.querySelector('[data-item="' + i + '"]'); if (de) de.focus();
      });
      const ad = rodape.querySelector('[data-adicionar]');
      if (ad) ad.onclick = () => adicionar();
      const cp = rodape.querySelector('[data-copiar]');
      if (cp) cp.onclick = ev => copiar(S.itens.some(o => o.tipo) && B7.IAAnalise
        ? B7.IAAnalise.textoParaCopiar(S.itens, S.resumo)
        : S.itens.map(o => o.tema + ': ' + o.texto).join('\n\n'), ev.currentTarget);
    }

    async function pedir() {
      if (S.fase === 'gerando' || S.ocupado) return;
      const instrucao = (S.foco || '').replace(/\s+/g, ' ').trim();
      S.fase = 'gerando'; S.erro = ''; S.aviso = ''; S.itens = []; S.marcados = new Set();
      const token = S.token = ++seq;
      S.ctrl = new AbortController();
      pintarJanela();
      try { await B7.Save.agora(); } catch (e) {}
      const dados = { operacao: operacao, linha_id: hooks.linhaId() };
      if (operacao === 'sugerir_conteudos') {
        dados.quantidade = S.quantidade;
        if (opcoes.pilarId) dados.pilar_id = opcoes.pilarId;
        if (instrucao.length >= 3) dados.instrucao = instrucao;
      }
      const resp = await B7.IA.pedir('linha', dados, { signal: S.ctrl.signal });
      if (S.fechada || S.token !== token) return;          /* a janela fechou ou já pediu de novo */
      S.ctrl = null;
      if (resp.cancelado) return;
      if (resp.ok && resp.itens) {
        S.itens = resp.itens; S.resumo = resp.resumo || '';
        if (!S.itens.length) {
          S.fase = 'vazio';
          S.aviso = operacao === 'sugerir_pilares' ? 'Esta linha já tem todos os tipos de pilar do B7.'
            : operacao === 'revisar_linha' ? (S.resumo || 'Não encontrei repetições nem desequilíbrios relevantes neste planejamento.')
            : 'Nenhuma sugestão desta vez.';
        }
        else S.fase = 'lista';
      } else {
        S.fase = 'erro';
        S.erro = operacao === 'revisar_linha' && resp.categoria === 'contexto'
          ? 'Esta linha editorial ainda não possui conteúdos suficientes para uma análise do conjunto.'
          : (resp.mensagem || 'Não foi possível gerar as sugestões.');
      }
      pintarJanela();
    }

    /* Cria só o que foi marcado, um por vez, pelo caminho de sempre. O
       que deu certo sai da lista na hora — repetir o clique depois de
       uma falha nunca cria duas vezes a mesma coisa. */
    async function adicionar() {
      if (S.ocupado || !S.marcados.size) return;
      S.ocupado = true; S.aviso = '';
      pintarJanela();
      const criar = operacao === 'sugerir_conteudos' ? hooks.criarConteudo : hooks.criarPilar;
      const ordem = [...S.marcados].sort((a, b) => a - b);
      const feitos = new Set(); let falhas = 0;
      for (const i of ordem) {
        try { await criar(S.itens[i]); feitos.add(i); }
        catch (e) { falhas++; S.itens[i].falhou = true; }
      }
      S.ocupado = false;
      if (feitos.size) hooks.depois();
      const nome = operacao === 'sugerir_conteudos' ? ['conteúdo adicionado', 'conteúdos adicionados'] : ['pilar adicionado', 'pilares adicionados'];
      if (!falhas) {
        m.fechar();
        B7.UI.toast(plural(feitos.size, nome[0], nome[1]) + '.');
        return;
      }
      /* falha parcial: fica só o que ainda não entrou, já marcado para tentar de novo */
      const restantes = S.itens.map((it, i) => ({ it, i })).filter(x => !feitos.has(x.i));
      S.itens = restantes.map(x => x.it);
      S.marcados = new Set(restantes.map((x, n) => x.it.falhou ? n : -1).filter(n => n >= 0));
      S.aviso = (feitos.size ? plural(feitos.size, nome[0], nome[1]) + '. ' : '') +
        plural(falhas, 'item não foi adicionado', 'itens não foram adicionados') + '. Confira a conexão e tente de novo.';
      if (S.fechada) { B7.UI.toast(S.aviso, { tipo: 'erro' }); return; }
      pintarJanela();
    }

    pintarJanela();
    if (S.fase === 'gerando') { S.fase = 'config'; pedir(); }
    return m;
  }

  /* ================================================================
     Ligação com a linha.js
     ================================================================ */
  /* Botão de entrada (HTML). Vazio quando a IA está desligada ou a
     pessoa não edita a linha — a tela fica exatamente como era. */
  function botao(operacao, rotulo, extra) {
    if (!ligado()) return '';
    return '<button type="button" class="ia-entrada" data-ia-linha="' + operacao + '"' +
      (extra && extra.pilar ? ' data-ia-pilar="' + esc(extra.pilar) + '"' : '') + '>' + IC + '<span>' + esc(rotulo) + '</span></button>';
  }

  /* `h`: { linhaId(), pilares(), criarConteudo(item), criarPilar(item), depois() } */
  function ligar(raiz, h) {
    if (!ligado() || !raiz) return;
    hooks = h;
    ligarCampos(raiz);
    raiz.querySelectorAll('[data-ia-linha]').forEach(b => b.onclick = ev => {
      ev.preventDefault(); ev.stopPropagation();
      abrirJanela(b.dataset.iaLinha, { pilarId: b.dataset.iaPilar || null });
    });
  }

  return { botao, ligar, ligado };
})();
