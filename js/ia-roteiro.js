/* =====================================================================
   ASSISTENTE DE IA NOS ROTEIROS

   Uma entrada discreta em cada cena ("Assistente de IA"). Ela abre um
   painel dentro da própria cena, logo abaixo do texto — sem modal, sem
   barra lateral, sem tirar espaço do editor quando não está em uso.

   O painel passa por quatro momentos:
     ações      escolhe o que pedir (ou escreve uma instrução)
     gerando    "Gerando sugestão…", com Cancelar
     resultado  a sugestão, com Aplicar / Copiar / Gerar novamente / Descartar
     erro       a frase do que houve, com Tentar novamente

   REGRA DO PRODUTO: a IA nunca mexe no roteiro sozinha. O texto só muda
   quando a pessoa clica em Aplicar — e aí a mudança entra pelo MESMO
   caminho da digitação (evento input do campo → estado do editor →
   autosave → prévia). Não existe um segundo jeito de salvar.

   Estado por cena (um Map): duas cenas podem gerar ao mesmo tempo sem se
   atrapalhar; a mesma cena só gera uma por vez. O editor redesenha as
   cenas com frequência — o estado mora aqui, não no DOM, e o painel é
   redesenhado junto. Uma resposta só é aceita se ainda for a do pedido
   corrente daquela cena: sugestão atrasada nunca cai na cena errada.

   Seleção: com um trecho selecionado no campo da cena, o assistente
   trabalha só aquele trecho e o Aplicar troca só ele. Sem seleção,
   trabalha o texto inteiro da cena.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.IARoteiro = (function () {
  const esc = B7.UI.esc;
  const estados = new Map();      /* cenaId → estado do painel */
  const ligadas = new Map();      /* cenaId → cena, como o editor ligou por último */
  let seq = 0;

  const ligado = () => !!(B7.IA && B7.IA.ligada('roteiros'));

  const IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 4l1.7 4.6L17.3 10l-4.6 1.7L11 16.3l-1.7-4.6L4.7 10l4.6-1.4z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>';

  const ROTULO = {
    melhorar: 'Melhorar este trecho', variacao: 'Criar outra versão', gancho: 'Melhorar o gancho',
    cta: 'Sugerir CTA', encurtar: 'Encurtar', naturalizar: 'Deixar mais natural', instrucao: 'Instrução'
  };
  const LIMITE_TEXTO = 4000, LIMITE_INSTRUCAO = 300;

  /* ----------------------------------------------------- HTML da cena */
  function html(cena) {
    if (!ligado()) return '';
    return '<div class="ia-rot" data-ia>' +
      '<button type="button" class="ia-entrada" data-ia-abrir aria-expanded="false">' + IC + '<span>Melhorar com IA</span></button>' +
      '<div class="ia-painel" data-ia-painel role="region" aria-label="Assistente de IA desta cena" hidden></div>' +
    '</div>';
  }

  /* o campo e o painel de uma cena, como estão no DOM agora */
  function refs(cenaId) {
    const el = document.querySelector('#escrita .cena[data-cena="' + (window.CSS && CSS.escape ? CSS.escape(cenaId) : cenaId) + '"]');
    if (!el) return null;
    const cx = el.querySelector('[data-ia]'), campo = el.querySelector('[data-c-campo="texto"]');
    if (!cx || !campo) return null;
    return { el, cx, campo, painel: cx.querySelector('[data-ia-painel]'), entrada: cx.querySelector('[data-ia-abrir]') };
  }

  /* ações que fazem sentido para esta cena e este alvo */
  function acoesDe(cena, st) {
    const vazio = !st.alvo.original.trim();
    const lista = [];
    if (cena.tipo === 'Gancho' && st.alvo.tipo === 'cena' && !vazio) lista.push('gancho');
    if (cena.tipo === 'CTA' && st.alvo.tipo === 'cena') lista.push('cta');
    if (!vazio) lista.push('melhorar', 'variacao', 'encurtar', 'naturalizar');
    return lista;
  }

  /* --------------------------------------------------------- desenho */
  function pintar(cena) {
    const r = refs(cena.id);
    if (!r) return;
    const st = estados.get(cena.id);
    r.entrada.setAttribute('aria-expanded', st ? 'true' : 'false');
    r.entrada.classList.toggle('on', !!st);
    if (!st) { r.painel.hidden = true; r.painel.innerHTML = ''; return; }
    r.painel.hidden = false;

    const alvoTx = st.alvo.tipo === 'selecao'
      ? 'Trecho selecionado · ' + st.alvo.original.length + ' caracteres'
      : 'Texto inteiro desta cena';
    const cab = '<div class="ia-cab"><span class="ia-titulo">' + IC + '<b>Assistente de IA</b></span>' +
      '<span class="ia-alvo">' + esc(alvoTx) + '</span>' +
      '<button type="button" class="ia-fechar" data-ia-fechar aria-label="Fechar o assistente">×</button></div>';

    let corpo = '';
    if (st.fase === 'acoes') {
      const acoes = acoesDe(cena, st);
      const longo = st.alvo.original.length > LIMITE_TEXTO;
      corpo =
        (st.alvo.tipo === 'selecao' ? '<blockquote class="ia-original">' + esc(st.alvo.original) + '</blockquote>' : '') +
        (longo ? '<p class="ia-nota erro">Este texto passa de ' + LIMITE_TEXTO + ' caracteres. Selecione um trecho menor.</p>' :
          (acoes.length
            ? '<div class="ia-acoes" role="group" aria-label="O que pedir">' +
                acoes.map(a => '<button type="button" class="ia-acao" data-ia-acao="' + a + '">' + esc(ROTULO[a]) + '</button>').join('') + '</div>'
            : '<p class="ia-nota">A cena está vazia. Escreva uma instrução para o assistente criar o texto.</p>') +
          '<form class="ia-instrucao" data-ia-form>' +
            '<label class="rot" for="ia-in-' + esc(cena.id) + '">ESCREVER INSTRUÇÃO</label>' +
            '<div class="ia-instrucao-linha">' +
              '<input class="campo" id="ia-in-' + esc(cena.id) + '" data-ia-instrucao maxlength="' + LIMITE_INSTRUCAO + '" autocomplete="off" ' +
                'placeholder="Ex.: deixe mais descontraída, com até 15 segundos" value="' + esc(st.instrucao || '') + '">' +
              '<button type="submit" class="b fina contorno">Gerar</button>' +
            '</div>' +
          '</form>') +
        '<p class="ia-nota">' + (st.daRevisao ? 'A instrução veio da revisão do roteiro: ajuste se quiser e clique em Gerar. ' : 'A sugestão aparece aqui. ') +
          'Nada muda no roteiro até você aplicar.</p>';
    } else if (st.fase === 'gerando') {
      corpo = '<div class="ia-gerando" role="status" aria-live="polite">' +
        '<span class="ia-pontos" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span>Gerando sugestão…</span>' +
        '<button type="button" class="b fina" data-ia-cancelar>Cancelar</button></div>' +
        '<p class="ia-nota">Você pode continuar olhando o roteiro enquanto isso.</p>';
    } else if (st.fase === 'resultado') {
      corpo =
        (st.alvo.tipo === 'selecao'
          ? '<div class="ia-rotulo">Original</div><blockquote class="ia-original">' + esc(st.alvo.original) + '</blockquote>' : '') +
        '<div class="ia-rotulo">Sugestão · ' + esc(st.acao === 'instrucao' ? '“' + st.instrucao + '”' : ROTULO[st.acao]) + '</div>' +
        '<div class="ia-sugestao" data-ia-sugestao tabindex="0">' + esc(st.sugestao) + '</div>' +
        (st.aviso ? '<p class="ia-nota erro" role="alert">' + esc(st.aviso) + '</p>' : '') +
        '<div class="ia-botoes">' +
          (st.bloqueado ? '' : '<button type="button" class="b pri fina" data-ia-aplicar>' + (st.confirmar ? 'Aplicar mesmo assim' : 'Aplicar') + '</button>') +
          '<button type="button" class="b fina contorno" data-ia-copiar>Copiar</button>' +
          '<button type="button" class="b fina contorno" data-ia-de-novo>Gerar novamente</button>' +
          '<button type="button" class="b fina" data-ia-descartar>Descartar sugestão</button>' +
        '</div>' +
        '<p class="ia-nota">O roteiro ainda não foi alterado.</p>';
    } else if (st.fase === 'erro') {
      corpo = '<p class="ia-erro" role="alert">' + esc(st.erro) + '</p>' +
        '<div class="ia-botoes">' +
          '<button type="button" class="b fina contorno" data-ia-de-novo>Tentar novamente</button>' +
          '<button type="button" class="b fina" data-ia-voltar>Voltar</button>' +
        '</div>' +
        '<p class="ia-nota">Seu texto continua como estava.</p>';
    }
    r.painel.innerHTML = cab + corpo;
    ligarPainel(cena, r);
  }

  function ligarPainel(cena, r) {
    const p = r.painel, q = s => p.querySelector(s);
    const st = estados.get(cena.id);
    if (!st) return;
    q('[data-ia-fechar]').onclick = () => fechar(cena);
    p.querySelectorAll('[data-ia-acao]').forEach(b => b.onclick = () => gerar(cena, b.dataset.iaAcao, null));
    const form = q('[data-ia-form]');
    if (form) {
      const campo = q('[data-ia-instrucao]');
      campo.oninput = () => { st.instrucao = campo.value; };
      form.onsubmit = ev => {
        ev.preventDefault();
        const texto = campo.value.replace(/\s+/g, ' ').trim();
        if (texto.length < 3) { campo.focus(); return; }
        gerar(cena, 'instrucao', texto);
      };
    }
    const b = sel => q(sel);
    if (b('[data-ia-cancelar]')) b('[data-ia-cancelar]').onclick = () => cancelar(cena);
    if (b('[data-ia-aplicar]')) b('[data-ia-aplicar]').onclick = () => aplicar(cena);
    if (b('[data-ia-copiar]')) b('[data-ia-copiar]').onclick = ev => copiar(cena, ev.currentTarget);
    if (b('[data-ia-de-novo]')) b('[data-ia-de-novo]').onclick = () => gerar(cena, st.acao, st.acao === 'instrucao' ? st.instrucao : null);
    if (b('[data-ia-descartar]')) b('[data-ia-descartar]').onclick = () => fechar(cena);
    if (b('[data-ia-voltar]')) b('[data-ia-voltar]').onclick = () => { st.fase = 'acoes'; pintar(cena); focar(cena, '[data-ia-acao], [data-ia-instrucao]'); };
    /* Esc: só fecha a escolha de ações. Com sugestão na tela, Esc não
       descarta nada sem a pessoa pedir. */
    p.onkeydown = ev => {
      if (ev.key !== 'Escape' || st.fase !== 'acoes') return;
      ev.stopPropagation(); fechar(cena);
    };
  }

  function focar(cena, seletor) {
    const r = refs(cena.id);
    const alvo = r && r.painel.querySelector(seletor);
    if (alvo) { try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); } }
  }

  /* ------------------------------------------------------------ fluxo */
  function abrir(cena) {
    const r = refs(cena.id);
    if (!r) return;
    if (estados.has(cena.id)) { fechar(cena); return; }
    /* o campo guarda a seleção mesmo depois de perder o foco para o botão */
    const v = r.campo.value, i = r.campo.selectionStart || 0, f = r.campo.selectionEnd || 0;
    const trecho = v.slice(i, f);
    const parcial = f > i && trecho.trim().length >= 3 && trecho.trim() !== v.trim();
    estados.set(cena.id, {
      fase: 'acoes', acao: null, instrucao: '', sugestao: '', erro: '', token: 0, ctrl: null,
      alvo: parcial ? { tipo: 'selecao', inicio: i, fim: f, original: trecho } : { tipo: 'cena', original: v }
    });
    pintar(cena);
    focar(cena, '[data-ia-acao], [data-ia-instrucao]');
  }

  /* Abre o assistente de uma cena já com a instrução preenchida (vinda de
     uma observação da revisão). Não gera nada: a pessoa confere a
     instrução, clica em Gerar e depois decide se aplica. */
  function abrirCom(cenaId, instrucao) {
    const cena = ligadas.get(cenaId), r = refs(cenaId);
    if (!ligado() || !cena || !r) return false;
    const antigo = estados.get(cenaId);
    if (antigo && antigo.ctrl) antigo.ctrl.abort();
    estados.set(cenaId, {
      fase: 'acoes', acao: null, sugestao: '', erro: '', token: 0, ctrl: null, daRevisao: true,
      instrucao: String(instrucao || '').replace(/\s+/g, ' ').trim().slice(0, LIMITE_INSTRUCAO),
      alvo: { tipo: 'cena', original: r.campo.value }
    });
    pintar(cena);
    focar(cena, '[data-ia-instrucao]');
    return true;
  }

  function fechar(cena) {
    const st = estados.get(cena.id);
    if (st && st.ctrl) st.ctrl.abort();
    estados.delete(cena.id);
    pintar(cena);
    const r = refs(cena.id);
    if (r) r.entrada.focus();
  }

  function cancelar(cena) {
    const st = estados.get(cena.id);
    if (!st) return;
    if (st.ctrl) st.ctrl.abort();
    st.token = 0; st.ctrl = null; st.fase = 'acoes';
    pintar(cena);
    focar(cena, '[data-ia-acao], [data-ia-instrucao]');
  }

  async function gerar(cena, acao, instrucao) {
    const st = estados.get(cena.id);
    const r = refs(cena.id);
    if (!st || !r || st.fase === 'gerando') return;     /* uma geração por cena de cada vez */
    /* cena inteira: sempre o texto de agora; seleção: o trecho escolhido */
    if (st.alvo.tipo === 'cena') st.alvo.original = r.campo.value;
    st.base = r.campo.value;
    st.acao = acao; st.instrucao = instrucao || st.instrucao || '';
    st.aviso = ''; st.confirmar = false; st.bloqueado = false; st.erro = '';
    st.fase = 'gerando';
    const token = st.token = ++seq;
    st.ctrl = new AbortController();
    pintar(cena);
    focar(cena, '[data-ia-cancelar]');

    const resp = await B7.IA.pedir('roteiro', {
      acao: acao, cena_id: cena.id, texto: st.alvo.original,
      cena_inteira: st.alvo.tipo === 'selecao' ? st.base : undefined,
      instrucao: acao === 'instrucao' ? instrucao : undefined
    }, { signal: st.ctrl.signal });

    /* resposta atrasada: o painel foi fechado, cancelado ou já pediu outra coisa */
    if (estados.get(cena.id) !== st || st.token !== token) return;
    st.ctrl = null;
    if (resp.cancelado) return;
    if (resp.ok) { st.fase = 'resultado'; st.sugestao = resp.texto; }
    else { st.fase = 'erro'; st.erro = resp.mensagem; }
    pintar(cena);
    focar(cena, st.fase === 'resultado' ? '[data-ia-sugestao]' : '[data-ia-de-novo]');
  }

  async function copiar(cena, botao) {
    const st = estados.get(cena.id);
    if (!st || !st.sugestao) return;
    const ok = await B7.UI.copiarTexto(st.sugestao, { msgSucesso: 'Sugestão copiada.', msgErro: 'Não foi possível copiar a sugestão.', msgVazio: 'Não há sugestão para copiar.' });
    if (ok && botao && botao.isConnected) {
      botao.textContent = 'Copiado';
      setTimeout(() => { if (botao.isConnected) botao.textContent = 'Copiar'; }, 1600);
    }
  }

  /* Escreve no campo pelo caminho da digitação: o editor atualiza o
     estado, o autosave grava e a prévia redesenha — como em qualquer
     edição feita à mão. */
  function escrever(campo, valor) {
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function aplicar(cena) {
    const st = estados.get(cena.id);
    const r = refs(cena.id);
    if (!st || !r || st.fase !== 'resultado' || st.aplicando) return;
    const atual = r.campo.value;
    let ini = 0, fim = atual.length;

    if (st.alvo.tipo === 'selecao') {
      ini = st.alvo.inicio; fim = st.alvo.fim;
      if (atual.slice(ini, fim) !== st.alvo.original) {
        /* o texto andou: só aplica se o trecho original ainda existir, e uma vez só */
        const onde = atual.indexOf(st.alvo.original);
        if (onde < 0 || atual.indexOf(st.alvo.original, onde + 1) >= 0) {
          st.bloqueado = true;
          st.aviso = 'O texto da cena mudou depois do pedido e o trecho original não foi encontrado. Copie a sugestão e cole onde quiser.';
          pintar(cena); focar(cena, '[data-ia-copiar]');
          return;
        }
        ini = onde; fim = onde + st.alvo.original.length;
      }
    } else if (atual !== st.base && !st.confirmar) {
      st.confirmar = true;
      st.aviso = 'O texto desta cena mudou depois do pedido. Aplicar vai substituir o texto atual pela sugestão.';
      pintar(cena); focar(cena, '[data-ia-aplicar]');
      return;
    }

    st.aplicando = true;
    const novo = atual.slice(0, ini) + st.sugestao + atual.slice(fim);
    const cenaId = cena.id;
    escrever(r.campo, novo);
    estados.delete(cenaId);
    pintar(cena);
    try { r.campo.focus({ preventScroll: true }); r.campo.setSelectionRange(ini, ini + st.sugestao.length); } catch (e) {}

    B7.UI.toast('Sugestão aplicada.', {
      acao: 'Desfazer',
      aoClicar: () => {
        const agora = refs(cenaId);
        if (!agora) return;
        if (agora.campo.value !== novo) { B7.UI.toast('O texto já mudou depois disso. Nada foi desfeito.'); return; }
        escrever(agora.campo, atual);
      }
    });
  }

  /* ---------------------------------------------- ligação com o editor */
  function ligar(el, cena) {
    if (!ligado()) return;
    const cx = el.querySelector('[data-ia]');
    if (!cx) return;
    ligadas.set(cena.id, cena);
    cx.querySelector('[data-ia-abrir]').onclick = () => abrir(cena);
    if (estados.has(cena.id)) pintar(cena);     /* o editor redesenhou: o painel volta como estava */
  }

  return { html, ligar, abrirCom };
})();
