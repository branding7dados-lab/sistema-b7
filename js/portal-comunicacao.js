/* =====================================================================
   PORTAL — RECADOS DA B7 E RESUMO SEMANAL POR E-MAIL (zzz268)

   • Recados: o administrador publica (Gestão → Recados) um aviso para
     todos os clientes ou para um só — feriado, novidade, atenção. Eles
     aparecem no Início do portal até a data marcada; o cliente pode
     dispensar (fica dispensado neste aparelho).
   • Resumo semanal: em Meu perfil o cliente informa o e-mail e recebe,
     toda segunda de manhã, o que foi aprovado, o que espera por ele e o
     que vai ao ar (b7-auth, ação resumo_semanal, chamada pelo cron).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PortalComunicacao = (function () {
  const esc = s => B7.UI.esc(s);
  const ICONE = { info: '📣', feriado: '🗓️', novidade: '✨', atencao: '⚠️' };
  const chave = id => 'b7-recado-visto-' + id;
  const visto = id => { try { return !!localStorage.getItem(chave(id)); } catch (e) { return false; } };

  async function recados(emp, alvo) {
    if (!emp || !alvo) return;
    const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    let l = [];
    try {
      const { data } = await B7.sb.from('b7_recados').select('id, tipo, titulo, texto, ate, client_id, created_at')
        .is('arquivado_em', null).or('client_id.is.null,client_id.eq.' + emp.id).or('ate.is.null,ate.gte.' + hoje)
        .order('created_at', { ascending: false }).limit(5);
      l = (data || []).filter(r => !visto(r.id)).slice(0, 3);
    } catch (e) { return; }
    if (!l.length || !alvo.isConnected) return;
    alvo.innerHTML = l.map((r, i) => '<div class="prc prc-' + esc(r.tipo) + '" style="--i:' + i + '" data-id="' + esc(r.id) + '">' +
      '<span class="prc-ic" aria-hidden="true">' + (ICONE[r.tipo] || ICONE.info) + '</span>' +
      '<div class="prc-tx"><small>Recado da Branding7</small><b>' + esc(r.titulo) + '</b>' + (r.texto ? '<p>' + esc(r.texto) + '</p>' : '') + '</div>' +
      '<button type="button" class="prc-x" aria-label="Dispensar recado" title="Dispensar">×</button></div>').join('');
    alvo.querySelectorAll('.prc-x').forEach(b => b.onclick = () => {
      const c = b.closest('.prc');
      try { localStorage.setItem(chave(c.dataset.id), '1'); } catch (e) {}
      c.classList.add('saindo'); setTimeout(() => c.remove(), 260);
    });
  }

  async function blocoEmail(alvo) {
    if (!alvo || (B7.Portal && B7.Portal.emPrevia())) return;
    let atual = null;
    try { atual = await B7.DB.rpc('meu_email_resumo', {}); } catch (e) { return; }
    const pinta = () => {
      alvo.innerHTML = '<section class="pre-cx"><div class="pre-cab"><span aria-hidden="true">📬</span><div><b>Resumo semanal por e-mail</b>' +
        '<small>Toda segunda de manhã: o que foi aprovado, o que espera por você e o que vai ao ar na semana.</small></div>' +
        (atual ? '<span class="pre-on">Ativo</span>' : '') + '</div>' +
        '<div class="pre-linha"><input class="campo" type="email" id="pre-email" maxlength="160" placeholder="seu@email.com" value="' + esc(atual || '') + '" autocomplete="email">' +
        '<button type="button" class="b pri" data-salvar>' + (atual ? 'Salvar' : 'Ativar') + '</button>' +
        (atual ? '<button type="button" class="b contorno" data-parar>Parar de receber</button>' : '') + '</div></section>';
      const salvar = async email => {
        try { await B7.DB.rpc('meu_email_resumo_definir', { p_email: email }); atual = email || null; pinta();
              B7.UI.toast(email ? 'Pronto! O resumo chega toda segunda.' : 'Você não vai mais receber o resumo.'); }
        catch (e) { B7.UI.toast(e.message || 'Não foi possível salvar.', { tipo: 'erro' }); }
      };
      alvo.querySelector('[data-salvar]').onclick = () => {
        const v = alvo.querySelector('#pre-email').value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return B7.UI.toast('Confira o e-mail', { tipo: 'erro' });
        salvar(v);
      };
      const p = alvo.querySelector('[data-parar]'); if (p) p.onclick = () => salvar(null);
    };
    pinta();
  }

  return { recados, blocoEmail };
})();
