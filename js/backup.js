/* =====================================================================
   BACKUP
   Segurança extra, não é onde os dados moram. O banco continua sendo o
   Supabase; isto aqui só gera e devolve um arquivo.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Backup = (function () {

  function baixar(obj, nome) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      a.download = nome;
      a.style.display = 'none';
      document.body.appendChild(a);          // Firefox exige o link no documento
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function exportar() {
    try {
      const pacote = await B7.Save.acao(() => B7.DB.exportarTudo());
      const hoje = new Date().toISOString().slice(0, 10);
      if (baixar(pacote, 'backup_roteiros_b7_' + hoje + '.json')) {
        B7.UI.toast('Backup gerado · ' + pacote.roteiros.length + ' roteiros');
      } else {
        B7.UI.toast('O navegador bloqueou o download do backup', { tipo: 'erro' });
      }
    } catch (e) {}
  }

  function importar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const leitor = new FileReader();
      leitor.onload = async () => {
        let pacote;
        try { pacote = JSON.parse(leitor.result); }
        catch (e) { return B7.UI.toast('Arquivo inválido', { tipo: 'erro' }); }
        if (!pacote || !Array.isArray(pacote.clientes)) {
          return B7.UI.toast('Este arquivo não é um backup do Roteiros B7', { tipo: 'erro' });
        }
        B7.UI.confirmar({
          titulo: 'Importar backup?',
          texto: 'Os registros do arquivo entram no banco. O que já existir com o mesmo id ' +
                 'será sobrescrito pela versão do arquivo. Nada é apagado.',
          rotulo: 'Importar',
          aoConfirmar: async () => {
            try {
              const r = await B7.Save.acao(() => B7.DB.importarTudo(pacote));
              B7.UI.toast('Importado: ' + r.clientes + ' clientes, ' + r.gravacoes + ' gravações, ' +
                          r.roteiros + ' roteiros, ' + r.cenas + ' cenas' +
                          (r.conteudo ? ', ' + r.conteudo + ' itens de conteúdo' : ''));
              B7.Rota.recarregar();
            } catch (e) {}
          }
        });
      };
      leitor.readAsText(f);
    };
    input.click();
  }

  /* atalho da sidebar: as duas opções numa janela só */
  function menu() {
    const m = B7.UI.modal(
      '<h3>Importar / Exportar</h3>' +
      '<div class="sub">O banco continua sendo o Supabase. Isto aqui é segurança extra: ' +
      'um arquivo com clientes, gravações, roteiros, cenas e toda a Central de Conteúdo ' +
      '(inteligência, onboardings, linhas editoriais, pilares e conteúdos).</div>' +
      '<button class="acao-rapida" data-exp><div class="ic">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>' +
        '<div class="tx"><b>Exportar backup</b><small>baixa um .json com tudo</small></div></button>' +
      '<button class="acao-rapida" data-imp><div class="ic">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>' +
        '<div class="tx"><b>Importar backup</b><small>devolve os registros de um arquivo</small></div></button>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div>');
    m.querySelector('[data-exp]').onclick = () => { m.fechar(); exportar(); };
    m.querySelector('[data-imp]').onclick = () => { m.fechar(); importar(); };
  }

  return { exportar, importar, menu };
})();
