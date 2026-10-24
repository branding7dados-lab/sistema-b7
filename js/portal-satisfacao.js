/* =====================================================================
   PORTAL — PESQUISA DE SATISFAÇÃO DO MÊS (zzz265)

   A partir do dia 20, quem ainda não respondeu no mês vê no Início um
   cartão "De 0 a 10, …?" com um comentário opcional. A resposta vai
   para a Branding7 (aviso na hora; nota baixa chega como "Atenção").
   O cliente não vê a nota dos colegas. Na prévia não aparece.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PortalSatisfacao = (function () {
  const esc = s => B7.UI.esc(s);
  const FRASE = n => n <= 6 ? 'Poxa. Conta pra gente o que podemos melhorar?' : n <= 8 ? 'Obrigado! O que faria virar um 10?' : 'Que bom! 💜 Quer deixar um recado para a equipe?';

  async function talvez(emp, alvo) {
    if (!emp || !alvo || (B7.Portal && B7.Portal.emPrevia())) return;
    let pend = false;
    try { pend = await B7.DB.rpc('satisfacao_pendente', { p_client: emp.id }); } catch (e) { return; }
    if (!pend || !alvo.isConnected) return;
    alvo.innerHTML = '<section class="psat" aria-label="Pesquisa de satisfação">' +
      '<div class="psat-cab"><span class="psat-ic" aria-hidden="true">💬</span><div><b>De 0 a 10, quanto você recomendaria a Branding7 este mês?</b>' +
        '<small>Leva 10 segundos e ajuda muito a gente a melhorar.</small></div>' +
        '<button type="button" class="psat-x" aria-label="Agora não" title="Agora não">×</button></div>' +
      '<div class="psat-notas" role="group" aria-label="Nota de 0 a 10">' +
        Array.from({ length: 11 }, (_, n) => '<button type="button" class="psat-n n' + (n <= 6 ? 'b' : n <= 8 ? 'm' : 'a') + '" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="psat-eixo"><span>nada provável</span><span>muito provável</span></div>' +
      '<div class="psat-mais" hidden><label class="rot" for="psat-com"></label>' +
        '<textarea class="campo" id="psat-com" rows="2" maxlength="1000" placeholder="Opcional"></textarea>' +
        '<div class="acoes"><button type="button" class="b pri" data-enviar>Enviar</button></div></div>' +
    '</section>';
    const cx = alvo.querySelector('.psat');
    let nota = null;
    cx.querySelector('.psat-x').onclick = () => cx.remove();
    cx.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
      nota = +b.dataset.n;
      cx.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b));
      const mais = cx.querySelector('.psat-mais'); mais.hidden = false;
      mais.querySelector('label').textContent = FRASE(nota);
    });
    cx.querySelector('[data-enviar]').onclick = async e => {
      if (nota == null) return;
      const bt = e.currentTarget; bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        await B7.DB.rpc('satisfacao_responder', { p_client: emp.id, p_nota: nota, p_comentario: cx.querySelector('#psat-com').value.trim() || null });
        cx.classList.add('feito');
        cx.innerHTML = '<div class="psat-obg"><span aria-hidden="true">' + (nota >= 9 ? '🎉' : '💜') + '</span><b>Obrigado pela sua resposta!</b><small>A equipe da Branding7 já recebeu.</small></div>';
        setTimeout(() => { if (cx.isConnected) cx.remove(); }, 4000);
      } catch (err) {
        bt.disabled = false; bt.textContent = 'Enviar';
        B7.UI.toast(err.message || 'Não foi possível enviar agora.', { tipo: 'erro' });
      }
    };
  }

  return { talvez };
})();
