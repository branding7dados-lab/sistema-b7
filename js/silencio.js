/* =====================================================================
   HORÁRIO DE SILÊNCIO (zzz252)

   Fora do horário escolhido os avisos continuam chegando no sino, mas
   sem push e sem som; quando o silêncio acaba chega UM aviso com o
   resumo do que ficou guardado. A regra mora no banco (em_silencio,
   trigger notif_silencio, _resumo_silencio); aqui só o formulário,
   usado em dois lugares:
     • Notificações (a pessoa): seguir a equipe, horário próprio ou nunca;
     • Equipe (administração): o expediente padrão da equipe.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Silencio = (function () {
  const esc = s => B7.UI.esc(s);
  const PADRAO = { ativo: true, de: '20:00', ate: '08:00', fds: true };
  const hora = h => String(h || '').replace(/^0(\d)/, '$1').replace(':00', 'h').replace(/:(\d\d)$/, 'h$1');

  function frase(s) {
    if (!s || !s.ativo) return 'Sem silêncio: os avisos chegam a qualquer hora.';
    return 'Das ' + hora(s.de) + ' às ' + hora(s.ate) + (s.fds ? ', e o fim de semana inteiro' : '') +
      ', os avisos ficam guardados no sino. Às ' + hora(s.ate) + ' chega um resumo.';
  }

  function campos(s, pref) {
    s = Object.assign({}, PADRAO, s || {});
    return '<div class="sl-campos" data-sl-campos>' +
      '<label class="sl-hora"><span>Silêncio a partir de</span><input type="time" class="campo fina" data-sl-de value="' + esc(s.de) + '" id="' + pref + '-de"></label>' +
      '<label class="sl-hora"><span>até</span><input type="time" class="campo fina" data-sl-ate value="' + esc(s.ate) + '" id="' + pref + '-ate"></label>' +
      '<label class="sl-fds"><input type="checkbox" data-sl-fds' + (s.fds ? ' checked' : '') + '> Sábado e domingo inteiros em silêncio</label>' +
    '</div>';
  }
  const ler = raiz => ({
    ativo: true,
    de: raiz.querySelector('[data-sl-de]').value || PADRAO.de,
    ate: raiz.querySelector('[data-sl-ate]').value || PADRAO.ate,
    fds: !!raiz.querySelector('[data-sl-fds]').checked
  });

  /* ---------------------------------------------------- da pessoa */
  async function montarPessoa(alvo) {
    if (!alvo) return;
    const u = (B7.Auth && B7.Auth.usuario()) || {};
    const cliente = B7.Auth.papel && B7.Auth.papel() === 'cliente';
    const proprio = u.preferencias && u.preferencias.silencio;
    let equipe = null;
    if (!cliente) { try { equipe = await B7.DB.rpc('expediente_equipe', {}); } catch (e) { equipe = null; } }
    if (!alvo.isConnected) return;
    const temEquipe = !!(equipe && equipe.ativo);
    let modo = proprio ? (proprio.ativo ? 'meu' : 'nunca') : (temEquipe ? 'equipe' : 'nunca');
    const opc = (v, rot) => '<button type="button" class="sl-op" role="radio" data-sl-modo="' + v + '">' + esc(rot) + '</button>';
    alvo.innerHTML =
      '<div class="pf-sub">Horário de silêncio</div>' +
      '<div class="sl-caixa">' +
        '<div class="sl-ops" role="radiogroup" aria-label="Horário de silêncio">' +
          (cliente ? '' : opc('equipe', 'Seguir a equipe')) + opc('meu', 'Meu horário') + opc('nunca', 'Sempre avisar') +
        '</div>' +
        '<div data-sl-meu hidden>' + campos(proprio && proprio.ativo ? proprio : (temEquipe ? equipe : null), 'sl-p') +
          '<div class="sl-acoes"><button type="button" class="b fina pri" data-sl-salvar>Salvar horário</button></div></div>' +
        '<p class="ajuda sl-frase" data-sl-frase></p>' +
        '<span class="perfil-msg" data-sl-msg role="status"></span>' +
      '</div>';
    const msg = alvo.querySelector('[data-sl-msg]');
    const pintar = () => {
      alvo.querySelectorAll('[data-sl-modo]').forEach(b => b.setAttribute('aria-checked', b.dataset.slModo === modo ? 'true' : 'false'));
      alvo.querySelector('[data-sl-meu]').hidden = modo !== 'meu';
      alvo.querySelector('[data-sl-frase]').textContent =
        modo === 'equipe' ? (temEquipe ? 'Expediente da equipe. ' + frase(equipe) : 'A equipe ainda não tem expediente definido: os avisos chegam a qualquer hora.')
        : modo === 'meu' ? frase(ler(alvo)) : frase(null);
    };
    async function gravar(valor, texto) {
      msg.className = 'perfil-msg'; msg.textContent = 'Salvando…';
      try {
        const novas = await B7.DB.rpc('silencio_gravar', { p: valor });
        if (u) u.preferencias = novas || u.preferencias;
        msg.className = 'perfil-msg ok'; msg.textContent = texto;
      } catch (e) { msg.className = 'perfil-msg erro'; msg.textContent = (e && e.message) || 'Não foi possível salvar.'; }
    }
    alvo.querySelectorAll('[data-sl-modo]').forEach(b => b.onclick = () => {
      modo = b.dataset.slModo; pintar();
      if (modo === 'equipe') gravar(null, 'Agora você segue o expediente da equipe.');
      if (modo === 'nunca') gravar({ ativo: false, de: PADRAO.de, ate: PADRAO.ate, fds: false }, 'Os avisos chegam a qualquer hora.');
    });
    alvo.querySelectorAll('[data-sl-campos] input').forEach(i => i.oninput = i.onchange = pintar);
    alvo.querySelector('[data-sl-salvar]').onclick = () => gravar(ler(alvo), 'Horário salvo.');
    pintar();
  }

  /* -------------------------------------------- da equipe (admin) */
  async function montarEquipe(alvo) {
    if (!alvo) return;
    let s = null;
    try { s = await B7.DB.rpc('expediente_equipe', {}); } catch (e) { s = null; }
    if (!alvo.isConnected) return;
    const ativo = !!(s && s.ativo);
    alvo.innerHTML =
      '<section class="cfg-g"><h2 class="cfg-g-t">Expediente da equipe</h2>' +
        '<p class="cfg-g-nota">Fora do expediente, os avisos de quem é da equipe ficam guardados no sino, sem push nem som, e um resumo chega quando o expediente começa. Cada pessoa pode escolher o próprio horário em Notificações.</p>' +
        '<div class="sl-caixa">' +
          '<div class="perfil-opcao"><span class="perfil-opcao-tx"><b>Silêncio fora do expediente</b><small data-sl-frase></small></span>' +
            '<button type="button" class="chave" role="switch" aria-checked="' + ativo + '" aria-label="Silêncio fora do expediente" data-sl-ativo></button></div>' +
          campos(s, 'sl-e') +
          '<div class="sl-acoes"><span class="perfil-msg" data-sl-msg role="status"></span><button type="button" class="b fina pri" data-sl-salvar>Salvar expediente</button></div>' +
        '</div>' +
      '</section>';
    const chave = alvo.querySelector('[data-sl-ativo]'), msg = alvo.querySelector('[data-sl-msg]');
    const valor = () => Object.assign(ler(alvo), { ativo: chave.getAttribute('aria-checked') === 'true' });
    const pintar = () => {
      alvo.querySelector('[data-sl-campos]').classList.toggle('sl-off', !valor().ativo);
      alvo.querySelector('[data-sl-frase]').textContent = frase(valor());
    };
    chave.onclick = () => { chave.setAttribute('aria-checked', chave.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); pintar(); };
    alvo.querySelectorAll('[data-sl-campos] input').forEach(i => i.oninput = i.onchange = pintar);
    alvo.querySelector('[data-sl-salvar]').onclick = async () => {
      msg.className = 'perfil-msg'; msg.textContent = 'Salvando…';
      try { await B7.DB.rpc('expediente_equipe_gravar', { p: valor() }); msg.className = 'perfil-msg ok'; msg.textContent = 'Expediente salvo.'; }
      catch (e) { msg.className = 'perfil-msg erro'; msg.textContent = (e && e.message) || 'Não foi possível salvar.'; }
    };
    pintar();
  }

  return { montarPessoa, montarEquipe, frase };
})();
