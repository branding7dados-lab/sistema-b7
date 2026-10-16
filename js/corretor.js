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
  const PRAZO_MS = 7000;
  const MIN = 4, MAX = 2000;

  const disponivel = () => !!(B7.IA && B7.IA.ligada && B7.IA.ligada('chat'));
  const ligado = () => disponivel() && !(B7.pref && B7.pref.ler('corrigir_auto', true) === false);
  function definir(v) { if (B7.pref) B7.pref.gravar('corrigir_auto', !!v); }

  /* só vale a pena corrigir se tem palavra; link, número ou emoji sozinhos ficam como estão */
  const temPalavras = t => (t.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).length > 0 && !/^\s*(https?:\/\/\S+\s*)+$/i.test(t);
  /* a correção não pode virar outro texto: tamanho muito diferente = descarta */
  const parecido = (a, b) => b.length >= a.length * 0.6 && b.length <= a.length * 1.5 + 12;

  async function corrigir(texto) {
    const original = String(texto == null ? '' : texto);
    const t = original.trim();
    if (!ligado() || t.length < MIN || t.length > MAX || !temPalavras(t)) return { ok: false, texto: original, mudou: false };
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), PRAZO_MS);
    try {
      const r = await B7.IA.pedir('whatsapp', { operacao: 'corrigir', texto: t }, { signal: ctrl.signal });
      const novo = r && r.ok ? String(r.texto || '').trim() : '';
      if (!novo || !parecido(t, novo)) return { ok: false, texto: original, mudou: false };
      /* preserva espaços que a pessoa deixou antes/depois */
      const ini = original.match(/^\s*/)[0], fim = original.match(/\s*$/)[0];
      const final = ini + novo + fim;
      return { ok: true, texto: final, mudou: novo !== t };
    } catch (e) {
      return { ok: false, texto: original, mudou: false };
    } finally { clearTimeout(relogio); }
  }

  return { corrigir, ligado, disponivel, definir };
})();
