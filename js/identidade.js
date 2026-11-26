/* =====================================================================
   IDENTIDADE NOVA — DIREÇÃO ESPECTRO (4.93.0)

   A nova identidade da Branding7 (manual 2026) entra atrás de uma chave:
   cada pessoa da equipe liga em Configurações → Aparência → "Identidade
   nova". Ligada, o <html> ganha data-identidade="espectro" e o
   styles/espectro.css troca cores, fonte (Grimblade), componentes e a
   casca (menu flutuante e topo). Desligada, nada muda. O cliente (Portal)
   nunca vê a chave e continua no visual atual até a liberação geral.

   O atributo é posto antes da primeira pintura pelo <head> do index.html
   (lê b7_pref_identidade); aqui ficam a troca dos logos e o liga/desliga.
   Pacote: assets/brand/espectro/ (logos e LEIA-ME), assets/fonts/grimblade.otf.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Identidade = (function () {
  const html = document.documentElement;
  const ESPECTRO = 'espectro';
  /* logos da casca: marca da barra lateral e marca do topo (celular) */
  const LOGOS = [
    ['.marca-lateral img.lockup', 'assets/brand/espectro/horizontal-branco.svg', 'assets/brand/espectro/horizontal-preto.svg'],
    ['.marca-lateral img.simbolo', 'assets/brand/espectro/simbolo-mono-branco.svg', 'assets/brand/espectro/simbolo.svg'],
    ['.topo-marca img.tm-cor', 'assets/brand/espectro/simbolo.svg', 'assets/brand/espectro/simbolo.svg'],
    ['.topo-marca img.tm-branca', 'assets/brand/espectro/simbolo-mono-branco.svg', 'assets/brand/espectro/simbolo-mono-branco.svg']
  ];

  const ligada = () => html.getAttribute('data-identidade') === ESPECTRO;
  const ehCliente = () => !!(B7.Auth && B7.Auth.ehCliente && B7.Auth.ehCliente());

  /* logo branco sobre o escuro; o colorido (degradê) só sobre o branco — regra do manual.
     No tema claro o menu flutuante é branco: o símbolo vai colorido. */
  function aplicarLogos() {
    const escuro = html.getAttribute('data-theme') === 'dark';
    LOGOS.forEach(([sel, sobreEscuro, sobreClaro]) => document.querySelectorAll(sel).forEach(img => {
      if (!img.dataset.srcOriginal) img.dataset.srcOriginal = img.getAttribute('src') || '';
      const alvo = ligada() ? (sel.indexOf('.marca-lateral') === 0 && !escuro ? sobreClaro : sobreEscuro) : img.dataset.srcOriginal;
      if (alvo && img.getAttribute('src') !== alvo) img.setAttribute('src', alvo);
    }));
  }

  /* o menu flutuante pode ABRIR (ícone + nome, 248 px) — botão no pé do menu, guardado no aparelho */
  const MENU_ABERTO = 'esp-menu-aberto';
  const SETAS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l5 5-5 5M13 7l5 5-5 5"/></svg>';
  function menuAberto() { try { return !!B7.pref.ler('esp_menu_aberto', false); } catch (e) { return false; } }
  function aplicarMenu() {
    const aberto = ligada() && menuAberto();
    html.classList.toggle(MENU_ABERTO, aberto);
    const pe = document.querySelector('.lateral .pe-lateral');
    let bt = document.querySelector('.esp-alterna-menu');
    if (!ligada()) { if (bt) bt.remove(); return; }
    if (!pe) return;
    if (!bt) {
      bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'esp-alterna-menu';
      bt.innerHTML = SETAS + '<span>Fechar menu</span>';
      bt.onclick = () => { try { B7.pref.gravar('esp_menu_aberto', !menuAberto()); } catch (e) {} aplicarMenu(); };
      pe.insertBefore(bt, pe.firstChild);
    }
    bt.setAttribute('aria-expanded', String(aberto));
    bt.setAttribute('aria-label', aberto ? 'Fechar o menu' : 'Abrir o menu com os nomes');
    bt.title = aberto ? 'Fechar o menu' : 'Abrir o menu';
  }

  function definir(ligar) {
    try { B7.pref.gravar('identidade', ligar ? ESPECTRO : null); } catch (e) {}
    if (ligar && !ehCliente()) html.setAttribute('data-identidade', ESPECTRO); else html.removeAttribute('data-identidade');
    aplicarLogos(); aplicarMenu();
  }

  /* o Portal do cliente fica no visual atual (aparelho compartilhado, chave ligada por outra pessoa) */
  function conferirPapel() { if (ehCliente() && ligada()) html.removeAttribute('data-identidade'); aplicarLogos(); aplicarMenu(); }

  /* o tema troca os logos da casca (o menu é branco no claro e vidro no escuro) */
  new MutationObserver(() => { if (ligada()) aplicarLogos(); }).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  const iniciar = () => { aplicarLogos(); aplicarMenu(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  return { ligada, definir, aplicarLogos, aplicarMenu, conferirPapel };
})();
