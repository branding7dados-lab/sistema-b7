/* =====================================================================
   PEDIDO DE ACESSO (zzz216)
   Quem esbarra num módulo que não abre, ou que abre só para ver, pede
   mais acesso daqui. O pedido vai para os administradores (aviso no
   sino) e é respondido em Usuários e acessos. Quem decide e grava é o
   banco (acesso_pedir / acesso_decidir); esta tela só pergunta.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.PedidoAcesso = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NIVEIS = [['ver', 'Ver', 'abrir e consultar'], ['editar', 'Editar', 'criar e alterar'], ['total', 'Total', 'editar, aprovar e excluir']];
  const NUM = { sem: 0, ver: 1, editar: 2, total: 3 };
  const rotuloMod = id => ((B7.Perm && B7.Perm.MODULOS || []).find(m => m.id === id) || { rotulo: id }).rotulo;
  const rotuloNv = n => (NIVEIS.find(x => x[0] === n) || ['', 'Sem acesso'])[1];

  /* só a equipe interna que não é administrador pede (e nunca numa prévia "Visualizar como") */
  function podePedir() {
    const A = B7.Auth;
    if (!A || !A.usuario || !A.usuario()) return false;
    if (A.emSimulacao && A.emSimulacao()) return false;
    if (A.ehCliente && A.ehCliente()) return false;
    return !(A.ehAdmin && A.ehAdmin());
  }

  async function meusPendentes() {
    try { return ((await B7.DB.rpc('acesso_pedidos_listar', {})) || []).filter(p => p.estado === 'pendente'); }
    catch (e) { return []; }
  }

  async function modal(mod, atual) {
    const at = atual || (B7.Perm ? B7.Perm.nivel(mod) : 'sem');
    const opcoes = NIVEIS.filter(n => NUM[n[0]] > NUM[at]);
    if (!opcoes.length) return;
    let escolha = opcoes[0][0];
    const pend = (await meusPendentes()).find(p => p.modulo === mod);
    const m = B7.UI.modal(
      '<div class="pa-modal">' +
        '<div class="pa-topo"><span class="pa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="15" r="1.3"/></svg></span>' +
        '<div><h3>Pedir acesso a ' + esc(rotuloMod(mod)) + '</h3>' +
        '<p>Hoje: <b>' + esc(rotuloNv(at)) + '</b>. O pedido vai para a administração.</p></div></div>' +
        (pend ? '<div class="pa-pend">Você já pediu <b>' + esc(rotuloNv(pend.nivel)) + '</b> em ' + esc(B7.UI.quando ? B7.UI.quando(pend.created_at) : '') +
          '. Enviar de novo atualiza o mesmo pedido. <button type="button" class="pa-cancelar" data-cancelar="' + esc(pend.id) + '">Cancelar pedido</button></div>' : '') +
        '<label class="rot">O QUE VOCÊ PRECISA</label>' +
        '<div class="pa-niveis" role="radiogroup">' + opcoes.map(([v, r, d]) =>
          '<button type="button" role="radio" class="pa-nv' + (v === escolha ? ' on' : '') + '" data-nv="' + v + '"><b>' + r + '</b><small>' + d + '</small></button>').join('') + '</div>' +
        '<label class="rot" for="pa-motivo">POR QUÊ? <span class="leve">(opcional, ajuda a decidir)</span></label>' +
        '<textarea class="campo" id="pa-motivo" rows="3" maxlength="500" placeholder="Ex.: vou cobrir as artes da Ana nesta semana"></textarea>' +
        '<div class="acoes"><button class="b" data-fecha>Agora não</button><button class="b pri" id="pa-enviar">Enviar pedido</button></div>' +
      '</div>', { extra: 'pa-fundo' });
    m.querySelectorAll('[data-nv]').forEach(b => b.onclick = () => {
      escolha = b.dataset.nv;
      m.querySelectorAll('[data-nv]').forEach(x => x.classList.toggle('on', x === b));
    });
    const cx = m.querySelector('[data-cancelar]');
    if (cx) cx.onclick = async () => {
      try { await B7.DB.rpc('acesso_pedido_cancelar', { p_id: cx.dataset.cancelar }); B7.UI.toast('Pedido cancelado.'); m.fechar(); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível cancelar.', { tipo: 'erro' }); }
    };
    m.querySelector('#pa-enviar').onclick = async () => {
      const bt = m.querySelector('#pa-enviar'); bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        await B7.DB.rpc('acesso_pedir', { p_modulo: mod, p_nivel: escolha, p_motivo: m.querySelector('#pa-motivo').value.trim() || null });
        B7.UI.toast('Pedido enviado. Você recebe um aviso quando a administração responder.');
        m.fechar();
      } catch (e) {
        B7.UI.toast((e && e.message) || 'Não foi possível enviar o pedido.', { tipo: 'erro' });
        bt.disabled = false; bt.textContent = 'Enviar pedido';
      }
    };
  }

  /* faixa discreta no rodapé quando a tela é só Ver (ou Editar) */
  function aviso(rota) {
    const velho = document.getElementById('pa-aviso');
    const mod = B7.Perm && B7.Perm.moduloDaRota ? B7.Perm.moduloDaRota(rota) : null;
    const nv = mod ? B7.Perm.nivel(mod) : 'total';
    if (!mod || !podePedir() || (nv !== 'ver' && nv !== 'editar')) { if (velho) velho.remove(); return; }
    const el = velho || document.createElement('div');
    el.id = 'pa-aviso'; el.className = 'pa-aviso pnv-' + nv;
    el.innerHTML = '<span><i aria-hidden="true"></i>' + (nv === 'ver'
        ? 'Seu acesso a ' + esc(rotuloMod(mod)) + ' é só para ver.'
        : 'Seu acesso a ' + esc(rotuloMod(mod)) + ' é Editar: aprovar e excluir ficam com quem tem Total.') + '</span>' +
      '<button type="button">Pedir mais acesso</button>';
    el.querySelector('button').onclick = () => modal(mod, nv);
    if (!velho) document.body.appendChild(el);
  }

  /* botão para a tela "sem acesso" */
  function botaoSemAcesso(rota) {
    const mod = B7.Perm && B7.Perm.moduloDaRota ? B7.Perm.moduloDaRota(rota) : null;
    if (!mod || !podePedir()) return '';
    return '<button class="b pri" type="button" data-pedir-acesso="' + esc(mod) + '">Pedir acesso a ' + esc(rotuloMod(mod)) + '</button>';
  }
  function ligarSemAcesso(raiz) {
    (raiz || document).querySelectorAll('[data-pedir-acesso]').forEach(b => b.onclick = () => modal(b.dataset.pedirAcesso, 'sem'));
  }

  return { modal, aviso, botaoSemAcesso, ligarSemAcesso, podePedir };
})();
