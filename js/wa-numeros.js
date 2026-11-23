/* =====================================================================
   NÚMEROS DO WHATSAPP (4.84.0) — a peça comum das telas
   O B7 tem vários números (Videomakers, Designers, Coordenação…), em
   wa_numeros. O banco só devolve os que a pessoa pode ver (admin: todos).
   Usado pela Central (barra "Todos · Vídeo · Design"), pelas Configurações
   e pelo "Enviar no WhatsApp".
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WaNumeros = (function () {
  const esc = s => B7.UI.esc(s);
  let lista = [], em = 0, pedido = null;

  async function carregar(forcar) {
    if (!forcar && em && Date.now() - em < 60000) return lista;
    if (pedido) return pedido;
    pedido = (async () => {
      try {
        const { data, error } = await B7.sb.from('wa_numeros').select('*').eq('ativo', true).order('ordem').order('criado_em');
        if (!error) { lista = data || []; em = Date.now(); }
      } catch (e) { /* sem rede: fica o que tinha */ }
      pedido = null;
      return lista;
    })();
    return pedido;
  }
  const porId = id => lista.find(n => n.id === id) || null;
  const padrao = () => lista.find(n => n.padrao) || null;

  /* o número "da casa" de cada pessoa: o do papel; senão o de uma função extra; senão o padrão */
  function daPessoa(u, nums) {
    nums = nums || lista;
    if (!nums.length) return null;
    const p = u && u.papel;
    const extras = (u && (u.funcoes_extra || u.funcoes_adicionais)) || [];
    return nums.find(n => p && (n.equipes || []).includes(p)) ||
      nums.find(n => (n.equipes || []).some(e => extras.includes(e))) ||
      nums.find(n => n.padrao) || nums[0];
  }

  function escolhido() { try { return (B7.pref && B7.pref.ler('wa_num', 'todos')) || 'todos'; } catch (e) { return 'todos'; } }
  function escolher(v) { try { if (B7.pref) B7.pref.gravar('wa_num', v || 'todos'); } catch (e) {} }

  const ponto = n => n ? '<i class="wz-num-pt" style="--c:' + esc(n.cor || '#1B8F6A') + '" title="' + esc(n.nome) + '" aria-label="' + esc(n.nome) + '"></i>' : '';

  /* barra da Central: só aparece para quem vê 2 números ou mais */
  function barraHtml(nums, sel, contagens) {
    if (!nums || nums.length < 2) return '';
    const c = contagens || {};
    const tot = nums.reduce((s, n) => s + (c[n.id] || 0), 0);
    const bt = (id, rot, n, qtd) => '<button type="button" data-num="' + esc(id) + '" class="wz-num' + (sel === id ? ' on' : '') + '"' +
      (n ? ' style="--c:' + esc(n.cor || '#1B8F6A') + '"' : '') + ' aria-pressed="' + (sel === id) + '">' +
      (n ? '<i class="wz-num-pt"></i>' : '') + '<span>' + esc(rot) + '</span>' + (qtd ? '<b>' + qtd + '</b>' : '') + '</button>';
    return '<div class="wz-nums" role="toolbar" aria-label="Números do WhatsApp">' + bt('todos', 'Todos', null, tot) +
      nums.map(n => bt(n.id, n.nome, n, c[n.id] || 0)).join('') + '</div>';
  }

  return { carregar, lista: () => lista, porId, padrao, daPessoa, escolhido, escolher, ponto, barraHtml };
})();
