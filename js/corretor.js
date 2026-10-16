/* =====================================================================
   CORRETOR DE TEXTO (zzz202) — ortografia e gramática do que a pessoa
   escreve no chat de Conversas e no WhatsApp do programa de Windows.

   Usa a IA do B7 (b7-ia, tarefa "whatsapp", operação "corrigir"): só
   conserta a escrita, sem mudar o sentido nem o tom. Roda quando a pessoa
   manda a mensagem (nunca enquanto digita). Qualquer problema — IA
   desligada, sem internet, demora, resposta estranha — devolve o texto
   ORIGINAL: a mensagem sempre sai, no máximo sem correção.
   Liga/desliga por pessoa (botão ✨), ligado por padrão.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Corretor = (function () {
  const MIN = 4, MAX = 2000;

  const disponivel = () => !!(B7.IA && B7.IA.ligada && B7.IA.ligada('chat'));
  const ligado = () => disponivel() && !(B7.pref && B7.pref.ler('corrigir_auto', true) === false);
  function definir(v) { if (B7.pref) B7.pref.gravar('corrigir_auto', !!v); }

  /* só vale a pena corrigir se tem palavra; link, número ou emoji sozinhos ficam como estão */
  const temPalavras = t => (t.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).length > 0 && !/^\s*(https?:\/\/\S+\s*)+$/i.test(t);
  /* a correção não pode virar outro texto: tamanho muito diferente = descarta */
  const parecido = (a, b) => b.length >= a.length * 0.6 && b.length <= a.length * 1.5 + 12;

  /* A IA gratuita às vezes leva 7–10 s para um texto curto. Por isso a correção
     começa quando a pessoa PARA de digitar (preparar) e, ao enviar, já está
     pronta na maioria das vezes. Só uma chamada por vez (o servidor recusa
     pedidos em paralelo da mesma pessoa) e cada texto é pedido uma só vez. */
  const PRAZO_CHAMADA = 25000, ESPERA_ENVIO = 15000;
  const guardado = new Map();            /* texto → Promise<{ok,texto,mudou}> */
  let emVoo = Promise.resolve();

  function chamar(t) {
    const p = emVoo.catch(() => {}).then(async () => {
      const ctrl = new AbortController();
      const relogio = setTimeout(() => ctrl.abort(), PRAZO_CHAMADA);
      try {
        const r = await B7.IA.pedir('whatsapp', { operacao: 'corrigir', texto: t }, { signal: ctrl.signal });
        const novo = r && r.ok ? String(r.texto || '').trim() : '';
        if (!novo || !parecido(t, novo)) return { ok: false, texto: t, mudou: false };
        return { ok: true, texto: novo, mudou: novo !== t };
      } catch (e) { return { ok: false, texto: t, mudou: false }; }
      finally { clearTimeout(relogio); }
    });
    emVoo = p;
    return p;
  }
  function pedido(t) {
    if (!guardado.has(t)) {
      const p = chamar(t);
      guardado.set(t, p);
      /* falha não fica guardada: da próxima vez tenta de novo */
      p.then(r => { if (!r.ok) guardado.delete(t); });
      if (guardado.size > 20) guardado.delete(guardado.keys().next().value);
    }
    return guardado.get(t);
  }
  const valido = t => ligado() && t.length >= MIN && t.length <= MAX && temPalavras(t);

  /* chamado enquanto a pessoa escreve (depois de uma pausa): só adianta o trabalho */
  function preparar(texto) {
    const t = String(texto == null ? '' : texto).trim();
    if (valido(t)) pedido(t);
  }

  async function corrigir(texto) {
    const original = String(texto == null ? '' : texto);
    const t = original.trim();
    if (!valido(t)) return { ok: false, texto: original, mudou: false };
    const espera = new Promise(res => setTimeout(() => res(null), ESPERA_ENVIO));
    const r = await Promise.race([pedido(t), espera]);
    if (!r || !r.ok) return { ok: false, texto: original, mudou: false };
    /* preserva espaços que a pessoa deixou antes/depois */
    const ini = original.match(/^\s*/)[0], fim = original.match(/\s*$/)[0];
    return { ok: true, texto: ini + r.texto + fim, mudou: r.mudou };
  }

  return { corrigir, preparar, ligado, disponivel, definir };
})();
