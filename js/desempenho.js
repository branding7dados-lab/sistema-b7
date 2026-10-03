/* =====================================================================
   DESEMPENHO (zzz2) — liga o MODO LEVE (styles/global.css) onde o vidro
   pesa: <html class="modo-leve"> troca o vidro desfocado por superfície
   sólida e tira os desfoques das entradas. O resto do visual é o mesmo.

   Três escolhas, por aparelho (Configurações → Aparência → Desempenho):
     • Automático (padrão): leve se o aparelho é simples (Android com
       ≤2 GB de memória ou ≤4 núcleos) OU se as trocas de tela estão
       travando de verdade — medido aqui, nos primeiros ~0,9 s depois de
       cada navegação. 3 de 4 trocas com >30% dos quadros atrasados
       (>40 ms) ligam o leve, e o aparelho guarda essa conclusão;
     • Leve: sempre;
     • Completo: nunca (vidro em tudo, mesmo travando).
   A primeira decisão é tomada no <head> do index.html, antes da primeira
   pintura — sem a tela "piscar" de um visual para o outro.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Desempenho = (function () {
  const html = document.documentElement;
  const ler = (k, p) => { try { return localStorage.getItem(k) || p; } catch (e) { return p; } };
  const gravar = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };

  const modo = () => ler('b7_desempenho', 'auto');
  function aparelhoSimples() {
    const ua = navigator.userAgent || '';
    return /Android/i.test(ua) &&
      ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));
  }
  const leveAgora = () => {
    const m = modo();
    return m === 'leve' || (m === 'auto' && (aparelhoSimples() || ler('b7_leve_auto', '') === '1'));
  };
  function aplicar() { html.classList.toggle('modo-leve', leveAgora()); }

  function definir(m) {
    if (!['auto', 'leve', 'completo'].includes(m)) return;
    gravar('b7_desempenho', m === 'auto' ? null : m);
    /* voltar ao automático recomeça a medição do zero */
    if (m === 'auto') { gravar('b7_leve_auto', null); amostras = []; }
    aplicar();
  }

  /* ------------------------------------------- medição nas trocas de tela */
  let amostras = [];
  const toque = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };
  function medir() {
    if (modo() !== 'auto' || html.classList.contains('modo-leve') || !toque() || document.hidden) return;
    const ab = document.getElementById('abertura');   /* a abertura tem o próprio ritmo */
    if (ab && ab.getClientRects().length) return;
    let ult = performance.now(), quadros = 0, lentos = 0;
    const ate = ult + 900;
    const passo = t => {
      const d = t - ult; ult = t; quadros++;
      if (d > 40) lentos++;
      if (t < ate && !document.hidden) requestAnimationFrame(passo); else fim();
    };
    const fim = () => {
      if (document.hidden || quadros < 3) return;
      amostras.push(lentos / quadros);
      if (amostras.length > 6) amostras.shift();
      const ruins = amostras.filter(x => x > 0.3).length;
      if (amostras.length >= 4 && ruins >= 3) {
        gravar('b7_leve_auto', '1');
        aplicar();
      }
    };
    requestAnimationFrame(passo);
  }
  window.addEventListener('hashchange', () => setTimeout(medir, 0));

  /* zzz6: animações ligadas/desligadas (a regra mora no <head> do
     index.html e em html.sem-animacao, styles/global.css) */
  const animacoesLigadas = () => !html.classList.contains('sem-animacao');
  function definirAnimacoes(ligadas) {
    gravar('b7_animacoes', ligadas ? null : 'desligadas');
    html.classList.toggle('sem-animacao', !ligadas);
  }

  const estado = () => ({ modo: modo(), leve: html.classList.contains('modo-leve'),
                          automatico: ler('b7_leve_auto', '') === '1', simples: aparelhoSimples() });
  aplicar();
  return { definir, modo, estado, aplicar, animacoesLigadas, definirAnimacoes };
})();
