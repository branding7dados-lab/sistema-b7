/* =====================================================================
   AÇÕES EM LOTE (zzz275) — o que vale para várias demandas selecionadas,
   nas três telas de produção (Edição de vídeo, Design e Produção).

   Hoje: APAGAR — manda para a lixeira (nada sai do banco), com "Desfazer"
   no aviso e "Restaurar" na Lixeira. O banco confere a permissão
   (demandas_para_lixeira: video.excluir / design.excluir / kanban.excluir).

   B7.Lote.podeApagar(tipo)            → a tela mostra o botão?
   B7.Lote.apagar(tipo, ids, depois)   → confirma, apaga, avisa; depois(ok)
   B7.Lote.barra(n, acoes, limpar)     → a faixa de baixo com o número de
                                         marcados (n=0 some); acoes =
                                         [{ rotulo, perigo, fazer }]
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Lote = (function () {
  const ACAO = { video: 'video.excluir', design: 'design.excluir', kanban: 'kanban.excluir' };
  const NOME = { video: ['demanda de edição', 'demandas de edição'], design: ['peça de design', 'peças de design'], kanban: ['demanda', 'demandas'] };

  function podeApagar(tipo) {
    if (!B7.Auth || !B7.Auth.usuario() || (B7.Auth.ehCliente && B7.Auth.ehCliente())) return false;
    if (B7.Perm && B7.Perm.podeNivel && !B7.Perm.podeNivel(tipo, 'total')) return false;
    return !B7.Perm || !B7.Perm.pode || B7.Perm.pode(ACAO[tipo]);
  }

  async function apagar(tipo, ids, depois) {
    ids = [...new Set(ids || [])];
    if (!ids.length) return false;
    const n = ids.length, nome = NOME[tipo] || NOME.kanban;
    const ok = await B7.UI.confirmar({
      titulo: n === 1 ? 'Apagar esta ' + nome[0] + '?' : 'Apagar ' + n + ' ' + nome[1] + '?',
      texto: (n === 1 ? 'Ela vai' : 'Elas vão') + ' para a Lixeira e some' + (n === 1 ? '' : 'm') + ' das filas. Dá para restaurar por lá.',
      rotulo: 'Apagar', perigo: true
    });
    if (!ok) return false;
    try {
      const feitos = await B7.DB.rpc('demandas_para_lixeira', { p_tipo: tipo, p_ids: ids });
      B7.UI.toast((feitos === 1 ? '1 ' + nome[0] + ' apagada' : feitos + ' ' + nome[1] + ' apagadas') + ' — estão na Lixeira.', {
        acao: 'Desfazer',
        aoClicar: async () => {
          try { await B7.DB.rpc('demandas_restaurar', { p_tipo: tipo, p_ids: ids }); B7.UI.toast('Restaurado.'); if (depois) depois(true); }
          catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível restaurar.', { tipo: 'erro' }); }
        }
      });
      if (depois) depois(true);
      return true;
    } catch (e) {
      B7.UI.toast((e && e.message) || 'Não foi possível apagar.', { tipo: 'erro' });
      if (depois) depois(false);
      return false;
    }
  }

  /* a mesma faixa do arrastar em lote (styles/global.css: .arr-barra) */
  let faixa = null;
  function barra(n, acoes, limpar) {
    if (!n) { if (faixa) { faixa.remove(); faixa = null; } return; }
    if (!faixa) { faixa = document.createElement('div'); faixa.className = 'arr-barra lote-barra'; document.body.appendChild(faixa); }
    faixa.innerHTML = '<b>' + n + (n === 1 ? ' marcada' : ' marcadas') + '</b>' +
      (acoes || []).map((a, i) => '<button type="button" data-i="' + i + '"' + (a.perigo ? ' class="perigo"' : '') + '>' + B7.UI.esc(a.rotulo) + '</button>').join('') +
      '<button type="button" data-limpar>Limpar</button>';
    faixa.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-limpar')) return limpar && limpar();
      const a = (acoes || [])[+b.dataset.i]; if (a) a.fazer();
    };
    requestAnimationFrame(() => faixa && faixa.classList.add('on'));
  }
  window.addEventListener('hashchange', () => barra(0));

  return { podeApagar, apagar, barra };
})();
