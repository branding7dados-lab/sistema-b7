/* =====================================================================
   CENTRAL DOS SISTEMAS DENTRO DO B7 (4.91.0)

   Quem trabalha em mais de um sistema da casa (Núcleo 7, Disparos,
   Connect Sev, TURBIC, B7) vê "Central" no pé da barra lateral e no
   menu da conta: leva para a Central do Núcleo 7, na mesma aba. Quem
   tem só o B7 não vê nada (a regra é a mesma da Central de lá).

   Quais sistemas a pessoa tem vem do servidor (n7-clientes, acao
   'meus_sistemas'), pelo e-mail dela em Pessoas e acessos. Guardado
   na sessão do navegador por 10 minutos para não perguntar a cada tela.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.CentralN7 = (function () {
  const CHAVE = 'b7_central_n7', VALIDADE = 10 * 60 * 1000;
  let estado = null;   /* { sistemas: [...], central: 'https://…', em: ms } */

  const ehDaCasa = () => !!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario() && !(B7.Auth.ehCliente && B7.Auth.ehCliente()));
  /* a Central só aparece para quem tem mais de um sistema */
  const temCentral = () => !!(estado && Array.isArray(estado.sistemas) && estado.sistemas.length > 1 && /^https:\/\//.test(estado.central || ''));
  const url = () => (temCentral() ? estado.central : null);

  function lerGuardado(uid) {
    try { const g = JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); if (g && g.uid === uid && Date.now() - g.em < VALIDADE) return g; } catch (e) {}
    return null;
  }
  async function carregar() {
    if (!ehDaCasa() || !B7.DB || !B7.DB.n7Clientes) { estado = null; return pintar(); }
    const uid = B7.Auth.usuario().id, g = lerGuardado(uid);
    if (g) { estado = g; return pintar(); }
    try {
      const r = await B7.DB.n7Clientes('meus_sistemas', {});
      estado = { uid, sistemas: (r && r.sistemas) || [], central: (r && r.central) || '', em: Date.now() };
      try { sessionStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
    } catch (e) { estado = null; }   /* sem resposta: não mostra (o B7 segue igual) */
    pintar();
  }
  const ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></svg>';
  function pintar() {
    const pe = document.querySelector('.pe-lateral');
    let bt = document.getElementById('bt-central-n7');
    if (!pe) return;
    if (!temCentral()) { if (bt) bt.remove(); return; }
    if (!bt) {
      bt = document.createElement('a');
      bt.id = 'bt-central-n7'; bt.className = 'bt-central-n7';
      bt.innerHTML = ICONE + '<span><b>Central</b><small>os seus sistemas</small></span>';
      bt.setAttribute('aria-label', 'Central dos sistemas (Núcleo 7)');
      bt.title = 'Central dos sistemas';
      pe.insertBefore(bt, pe.firstChild);
    }
    bt.href = estado.central;
  }
  function sair() { estado = null; try { sessionStorage.removeItem(CHAVE); } catch (e) {} pintar(); }

  return { carregar, temCentral, url, sair, ICONE };
})();
