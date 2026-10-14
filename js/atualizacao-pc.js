/* =====================================================================
   ATUALIZAÇÃO DO PROGRAMA DE WINDOWS (zzz169)

   Só vale dentro do app de Windows (window.B7Desktop). Quando sai uma
   versão nova do PROGRAMA (não do sistema, que já se atualiza sozinho),
   aparece um selo no topo, antes do sino:
     • "Atualização · baixando 40%"  enquanto o programa baixa;
     • "Atualizar agora"             quando já pode instalar (um clique
                                      fecha, instala e abre de novo).

   Programas instalados antes desta versão não contam o estado ao site.
   Para eles, o site pergunta ao GitHub qual é o instalador mais novo
   (release "app-desktop") e, se for maior que o instalado, mostra o selo
   "Atualização disponível" — o clique pede ao programa para procurar e
   baixar (ele avisa quando terminar).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.AtualizacaoPC = (function () {
  const D = window.B7Desktop;
  if (!D) return { ativo: false };
  const RELEASE = 'https://api.github.com/repos/branding7dados-lab/sistema-b7/releases/tags/app-desktop';
  let estado = { estado: 'nada' }, el = null;

  const maior = (a, b) => {   /* "1.0.12" > "1.0.9" */
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  };

  function pintar() {
    const sino = document.querySelector('.topo .sino');
    if (estado.estado === 'nada') { if (el) { el.remove(); el = null; } return; }
    if (!sino) { setTimeout(pintar, 1500); return; }
    if (!el) {
      el = document.createElement('button'); el.type = 'button'; el.id = 'b7-att-pc'; el.className = 'nv-topo att-pc';
      el.onclick = clicar;
    }
    if (el.parentNode !== sino.parentNode) sino.parentNode.insertBefore(el, sino);
    const v = estado.versao ? ' ' + estado.versao : '';
    let tx, dica;
    if (estado.estado === 'baixando') { tx = 'Atualização · ' + (estado.pct || 0) + '%'; dica = 'Baixando a versão' + v + ' do programa. Pode continuar usando.'; }
    else if (estado.estado === 'pronta') { tx = 'Atualizar agora'; dica = 'A versão' + v + ' do programa está pronta. Clique para instalar (leva uns segundos).'; }
    else { tx = 'Atualização disponível'; dica = 'Tem versão nova do programa' + v + '. Clique para baixar.'; }
    el.classList.toggle('pronta', estado.estado !== 'baixando');
    el.title = dica; el.setAttribute('aria-label', dica);
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg><span>' + tx + '</span>';
  }

  async function clicar() {
    if (estado.estado === 'pronta' && D.instalarAtualizacao) {
      const ok = await B7.UI.confirmar({ titulo: 'Instalar a atualização agora?',
        texto: 'O programa fecha e abre de novo em alguns segundos. Nada do que já foi salvo se perde.', rotulo: 'Instalar agora' });
      if (ok) D.instalarAtualizacao();
      return;
    }
    if (estado.estado === 'disponivel' && D.procurarAtualizacao) {
      D.procurarAtualizacao();
      estado = { ...estado, estado: 'baixando', pct: 0 }; pintar();
      return;
    }
    if (B7.UI && B7.UI.toast) B7.UI.toast(el ? el.title : 'Baixando a atualização…');
  }

  /* programa antigo (sem aoAtualizacao): pergunta ao GitHub */
  async function conferirPeloSite() {
    try {
      const atual = await D.versao();
      const r = await fetch(RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) return;
      const j = await r.json();
      let nova = '';
      (j.assets || []).forEach(a => { const m = /setup-(\d+\.\d+\.\d+)\.exe$/.exec(a.name || ''); if (m && (!nova || maior(m[1], nova))) nova = m[1]; });
      if (nova && atual && maior(nova, atual) && estado.estado === 'nada') { estado = { estado: 'disponivel', versao: nova }; pintar(); }
    } catch (e) { /* sem internet ou limite do GitHub: tenta depois */ }
  }

  if (D.aoAtualizacao) {
    D.aoAtualizacao(e => { estado = e || { estado: 'nada' }; pintar(); });
    if (D.estadoAtualizacao) D.estadoAtualizacao().then(e => { if (e) { estado = e; pintar(); } }).catch(() => {});
  } else {
    setTimeout(conferirPeloSite, 8000);
    setInterval(conferirPeloSite, 60 * 60 * 1000);
  }
  /* o topo é redesenhado em algumas trocas de tela: recoloca o selo */
  addEventListener('hashchange', () => setTimeout(pintar, 300));

  return { ativo: true, _estado: () => estado, _simular: e => { estado = e; pintar(); } };
})();
