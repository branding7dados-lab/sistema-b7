/* =====================================================================
   AUTOSAVE
   Regras:
   • digitação  → junta as alterações e grava ~650ms depois da última tecla;
   • estrutura  → grava na hora (criar, excluir, duplicar, reordenar…);
   • sem rede   → texto fica numa fila local e sobe quando a conexão volta;
                  ações estruturais são bloqueadas, com aviso claro.
   O indicador do topo mostra sempre o estado real: nada de "Salvo" quando
   não salvou.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Save = (function () {
  const ESPERA = 650;
  const CHAVE_FILA = 'b7_fila_pendente';

  let pendentes = new Map();   // "tabela:id" -> patch acumulado
  let timer = null;
  let emVoo = 0;
  let ultimoErro = null;
  /* há um indicador no topo de cada tela; todos mostram o mesmo estado */

  /* ------------------------------------------------------- indicador */
  function pintar(estado, texto) {
    document.querySelectorAll('.salvamento').forEach(el => {
      el.className = 'salvamento ' + estado;
      el.querySelector('.txt').textContent = texto;
      el.onclick = estado === 'erro' ? tentarNovamente : null;
      el.title = estado === 'erro' ? 'Clique para tentar salvar de novo' : '';
    });
  }
  function atualizar() {
    if (!navigator.onLine) {
      const n = pendentes.size + fila().length;
      return pintar('offline', n ? 'Sem conexão · ' + n + ' pendente' + (n > 1 ? 's' : '') : 'Sem conexão');
    }
    if (ultimoErro) return pintar('erro', descartados ? 'Alteração não salva · ver aviso' : 'Erro ao salvar · tentar novamente');
    if (emVoo > 0 || pendentes.size) return pintar('salvando', 'Salvando…');
    pintar('salvo', 'Salvo ✓');
  }

  /* ------------------------------------------------- fila do offline */
  function fila() {
    try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]'); } catch (e) { return []; }
  }
  function gravarFila(f) {
    try { localStorage.setItem(CHAVE_FILA, JSON.stringify(f)); } catch (e) {}
  }
  function enfileirar(tabela, id, patch) {
    const f = fila();
    const existente = f.find(x => x.tabela === tabela && x.id === id);
    if (existente) Object.assign(existente.patch, patch);
    else f.push({ tabela, id, patch });
    gravarFila(f);
  }
  /* Só falha de rede merece fila: vai passar quando a conexão voltar.
     Erro que o banco devolveu (coluna inválida, regra violada, sem
     permissão) não muda se tentar de novo — reenfileirar prenderia o
     indicador em "Erro ao salvar" para sempre e bloquearia sair da
     página. Esses são descartados com aviso. */
  function ehErroDeRede(e) {
    if (!navigator.onLine) return true;
    if (e instanceof TypeError) return true;                 // fetch falhou
    const status = e && e.status;
    if (status === 0 || (status >= 500 && status < 600)) return true;   // gateway/servidor
    const code = String((e && e.code) || '');
    if (code === 'PGRST301' || code === 'PGRST302') return true;        // JWT expirado: o refresh resolve
    const msg = String((e && e.message) || e || '').toLowerCase();
    if (/failed to fetch|network|load failed|timeout|não respondeu|upstream server/.test(msg)) return true;
    /* erro sem código e sem status é indistinguível de queda: na dúvida,
       guarda — só o que o banco claramente recusou é descartado */
    return !code && !status;
  }
  /* Descartar não vira "Salvo ✓": o indicador fica em erro até a pessoa
     ver o aviso e clicar, e o console guarda o que foi perdido. */
  let descartados = 0;
  function descartar(item, e) {
    descartados++;
    console.error('Alteração descartada (o banco recusou)', item, e);
    ultimoErro = e;
    if (B7.UI && B7.UI.toast) {
      B7.UI.toast('Uma alteração não pôde ser salva: ' + ((e && e.message) || 'o banco recusou'),
        { tipo: 'erro', tempo: 8000 });
    }
  }
  function tratarFalha(item, e) {
    if (ehErroDeRede(e)) { enfileirar(item.tabela, item.id, item.patch); ultimoErro = e; }
    else descartar(item, e);
  }

  async function escoarFila() {
    const f = fila();
    if (!f.length) return;
    gravarFila([]);
    for (const item of f) {
      try { await gravarDireto(item.tabela, item.id, item.patch); }
      catch (e) { tratarFalha(item, e); }
    }
    atualizar();
  }

  async function gravarDireto(tabela, id, patch) {
    if (tabela === 'roteiros') return B7.DB.atualizarRoteiro(id, patch);
    if (tabela === 'cenas') return B7.DB.atualizarCena(id, patch);
    if (tabela === 'gravacoes') return B7.DB.atualizarGravacao(id, patch);
    if (tabela === 'clientes') return B7.DB.atualizarCliente(id, patch);
    if (tabela === 'cliente_inteligencia') return B7.DB.salvarInteligencia(id, patch);
    if (tabela === 'produtos') return B7.DB.atualizarProduto(id, patch);
    if (tabela === 'provas') return B7.DB.atualizarProva(id, patch);
    if (tabela === 'onboardings') return B7.DB.atualizarOnboarding(id, patch);
    if (tabela === 'linhas_editoriais') return B7.DB.atualizarLinha(id, patch);
    if (tabela === 'pilares') return B7.DB.atualizarPilar(id, patch);
    if (tabela === 'conteudos') return B7.DB.atualizarConteudo(id, patch);
    if (tabela === 'slides') return B7.DB.atualizarSlide(id, patch);
    if (tabela === 'frames') return B7.DB.atualizarFrame(id, patch);
    if (tabela === 'ideias') return B7.DB.atualizarIdeia(id, patch);
    if (tabela === 'status_semanais') return B7.DB.atualizarStatus(id, patch);
    if (tabela === 'status_itens') return B7.DB.atualizarItem(id, patch);
    const e = new Error('Tabela desconhecida: ' + tabela); e.code = 'B7_TABELA'; throw e;
  }

  /* --------------------------------------------------------- digitação */
  function campo(tabela, id, patch) {
    const chave = tabela + ':' + id;
    const atual = pendentes.get(chave) || { tabela, id, patch: {} };
    Object.assign(atual.patch, patch);
    pendentes.set(chave, atual);
    ultimoErro = null;
    atualizar();
    clearTimeout(timer);
    timer = setTimeout(descarregar, ESPERA);
  }

  async function descarregar() {
    if (!pendentes.size) return;
    const lote = [...pendentes.values()];
    pendentes.clear();

    if (!navigator.onLine) {
      lote.forEach(i => enfileirar(i.tabela, i.id, i.patch));
      atualizar();
      return;
    }

    emVoo++;
    atualizar();
    for (const item of lote) {
      try {
        await gravarDireto(item.tabela, item.id, item.patch);
        if (!descartados) ultimoErro = null;
      } catch (e) {
        console.error('Falha ao salvar', item, e);
        tratarFalha(item, e);
      }
    }
    emVoo--;
    atualizar();
  }

  /* Garante que tudo que está pendente vá para o banco agora. */
  async function agora() {
    clearTimeout(timer);
    await descarregar();
  }

  /* ------------------------------------------- ações que salvam já */
  async function acao(promessa, textoOk) {
    if (!navigator.onLine) {
      B7.UI.toast('Sem conexão — a ação não foi salva. Reconecte e tente de novo.', { tipo: 'erro' });
      throw new Error('offline');
    }
    emVoo++; atualizar();
    try {
      const r = await (typeof promessa === 'function' ? promessa() : promessa);
      ultimoErro = null;
      if (textoOk) B7.UI.toast(textoOk);
      return r;
    } catch (e) {
      ultimoErro = e;
      console.error(e);
      B7.UI.toast('Erro ao salvar: ' + (e.message || 'tente novamente'), { tipo: 'erro' });
      throw e;
    } finally {
      emVoo--; atualizar();
    }
  }

  async function tentarNovamente() {
    ultimoErro = null; descartados = 0;
    atualizar();
    await escoarFila();
    await descarregar();
    if (!ultimoErro) B7.UI.toast('Alterações salvas');
  }

  function temPendencias() { return pendentes.size > 0 || fila().length > 0 || emVoo > 0; }

  /* ------------------------------------------------------------ eventos */
  window.addEventListener('online', () => {
    B7.UI.toast('Conexão restabelecida — enviando alterações pendentes');
    escoarFila().then(atualizar);
  });
  window.addEventListener('offline', atualizar);
  window.addEventListener('beforeunload', e => {
    if (temPendencias()) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) agora(); });

  return { campo, acao, agora, atualizar, tentarNovamente, temPendencias, escoarFila };
})();
