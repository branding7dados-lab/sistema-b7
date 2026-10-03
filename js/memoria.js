/* =====================================================================
   MEMÓRIA DE DADOS — telas abrindo na hora (zzz2)

   Antes: toda tela buscava tudo de novo no Supabase ao abrir e mostrava
   esqueleto enquanto esperava. A "foto da tela" (movimento.js) escondia
   isso só nas telas já vistas na sessão.

   Agora as LEITURAS de lista e painel guardam a última resposta (em
   memória e no IndexedDB do aparelho, por conta). Ao abrir uma tela:
     • há resposta guardada → a tela monta NA HORA com ela, sem esqueleto,
       e em paralelo a busca de verdade vai ao banco ("stale-while-
       revalidate");
     • a resposta nova veio diferente → a tela é redesenhada em silêncio,
       na mesma rolagem, se a pessoa ainda não começou a mexer nela; se já
       começou, a resposta fica guardada para a próxima vez.
   Regras de segurança dos dados:
     • só leituras da lista LEITURAS passam por aqui. Editor de roteiro,
       linha editorial, demanda aberta etc. continuam lendo SEMPRE do banco
       (nada de texto velho dentro de um editor que salva sozinho);
     • qualquer escrita (criar/atualizar/excluir/…) e qualquer aviso do
       Realtime marcam tudo como "a conferir": a leitura seguinte espera o
       banco (com a guardada só de reserva, se a rede cair);
     • sem login não há memória; sair da conta apaga tudo do aparelho;
     • a chave inclui a conta e o papel: conta de outro, simulação de papel
       e troca de pessoa nunca se misturam.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Memoria = (function () {
  if (!B7.DB) return { invalidar() {}, limpar() {} };

  /* leituras que alimentam listas, painéis e cabeçalhos */
  const LEITURAS = [
    'listarClientes', 'cliente', 'previaRoteiros', 'atividades', 'fixados', 'lixeira',
    'listarGravacoes', 'gravacoesRecentes', 'gravacao', 'gravacaoItens', 'gravacaoHistorico', 'gravacaoOcorrencias',
    'roteirosDoCliente', 'conteudosDoCliente', 'listarLinhas', 'listarTodasLinhas', 'listarStatus',
    'listarConteudosDoCliente', 'publicacoesDoPeriodo', 'contagemPublicacoesPorDia', 'publicacoesPendentes',
    'conteudosDoPeriodo', 'painelProducao', 'listarGravacoesPor', 'listarRoteirosPor',
    'aprovacoesDoCliente', 'painelAprovacoes', 'ultimasAprovacoes',
    'listarDemandas', 'demandas', 'listarEquipe', 'listarIdeias', 'resumoMensal', 'roteirosRecentes',
    'listarDesign', 'nomesPerfis', 'listarVideomakers', 'listarDesigners',
    'painelDemandasAtivas', 'painelEntregas', 'painelGravacoes', 'painelDesignMinhas', 'painelDesignEnvios',
    'painelDesignPartes', 'painelCoordConteudos', 'painelCoordConteudosEmRevisao', 'painelCoordRoteirosEmRevisao',
    'painelCoordRoteirosDasGravacoes', 'minhasDemandasVideo', 'videoDoCliente', 'resumoGestaoVideo',
    'cargaEquipeVideo', 'producaoPorClienteVideo', 'eventosCalendario', 'ocorrenciasCalendario',
    'publicacoesCalendario', 'prazosVideoPeriodo', 'prazosDesignPeriodo', 'oportunidadesBase',
    'producaoDoCliente', 'gravacoesDoCliente', 'statusPublicados',
    'pacotesVideo', 'statusConexaoCalendario', 'listarCalendariosGoogle'
  ];
  /* tudo que muda dado no banco; o resto (heartbeat, sessão, leituras de
     detalhe) não mexe na memória */
  const ESCRITA = /^(criar|atualizar|excluir|fixar|arquivar|paraLixeira|restaurar|reordenar|duplicar|salvar|definir|mover|registrar(?!Push)|enviar|decidir|anular|comentar|resolver|liberar|gerar|atribuir|assumir|concluir|solicitar|aprovar|finalizar|fechar|reabrir|importar|confirmar|backfill|vincular|desvincular|alternar|sincronizar|editar|remover(?!Push)|revisar|cancelar|apagar|mudar|desconectar|iniciarConexao|reprocessar|verificarAlertas|chamarCalendario|marcarConclusao|marcarGravacao|oportunidade(Ajustar|Vincular|Desvincular|DefinirEstado|Unir|CadastrarManual)|oportunidadesSincronizar|cliente(Municipios|Segmentos)Definir|conteudoDefinir|ocorrencia(Concluir|Remarcar|Cancelar)|gravacao(Item(Adicionar|Editar|Remover|Mover|Marcar)|Agendar|Concluir|Cancelar))/;

  const FRESCA = 5000;            /* resposta com menos de 5 s nem volta ao banco */
  const VALIDADE = 7 * 864e5;     /* no aparelho, no máximo uma semana */
  const MAX = 220;                /* quantas respostas guardar */
  const TAM_MAX = 900000;         /* resposta maior que ~900 KB não é guardada */

  const mapa = new Map();         /* chave → { v: texto JSON, t, g } */
  const voando = new Map();       /* chave → promessa da busca em andamento */
  let geracao = 1;                /* sobe a cada escrita: o que é de antes espera o banco */
  let conferirDesde = 0;          /* antes disto, mostra mas confere por trás */

  const conta = () => {
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    if (!u || !u.id) return null;
    return u.id + '|' + (u.papel || '');
  };
  const copia = texto => texto === undefined ? undefined : JSON.parse(texto);

  /* ------------------------------------------------ IndexedDB do aparelho */
  let idb = null;
  const pronto = new Promise(resolve => {
    let feito = false;
    const fim = () => { if (!feito) { feito = true; resolve(); } };
    setTimeout(fim, 400);            /* aparelho lento: segue sem a memória salva */
    try {
      const req = indexedDB.open('b7-memoria', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('r');
      req.onerror = fim;
      req.onsuccess = () => {
        idb = req.result;
        try {
          const tx = idb.transaction('r', 'readonly');
          const cur = tx.objectStore('r').openCursor();
          const agora = Date.now();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return fim();
            const e = c.value;
            /* o que veio do aparelho é antigo: mostra na hora, mas sempre
               confere (t velho = nunca "fresca") */
            if (e && e.v && agora - e.t < VALIDADE && !mapa.has(c.key)) mapa.set(c.key, { v: e.v, t: e.t, g: 1 });
            c.continue();
          };
          cur.onerror = fim;
        } catch (er) { fim(); }
      };
    } catch (e) { fim(); }
  });

  let sujas = new Set(), timerGravar = 0;
  function gravarDepois(chave) {
    sujas.add(chave);
    clearTimeout(timerGravar);
    timerGravar = setTimeout(gravarAgora, 1200);
  }
  function gravarAgora() {
    if (!idb) return;
    const lista = sujas; sujas = new Set();
    try {
      const tx = idb.transaction('r', 'readwrite');
      const st = tx.objectStore('r');
      lista.forEach(k => {
        const e = mapa.get(k);
        if (e) st.put({ v: e.v, t: e.t }, k); else st.delete(k);
      });
    } catch (e) {}
  }
  function aparar() {
    if (mapa.size <= MAX) return;
    const velhas = [...mapa.entries()].sort((a, b) => a[1].t - b[1].t).slice(0, mapa.size - MAX);
    velhas.forEach(([k]) => { mapa.delete(k); gravarDepois(k); });
  }

  /* ------------------------------------------------------ redesenho quieto */
  let navegouEm = Date.now(), mexeu = false, timerRedesenho = 0;
  window.addEventListener('hashchange', () => { navegouEm = Date.now(); mexeu = false; });
  ['pointerdown', 'keydown', 'wheel'].forEach(ev =>
    document.addEventListener(ev, e => { if (Date.now() - navegouEm > 250 && e.isTrusted) mexeu = true; }, { capture: true, passive: true }));

  /* 0 = não; 1 = sim; 2 = ainda não (foto ou voo do cartão na tela) */
  function podeRedesenhar() {
    if (mexeu || Date.now() - navegouEm > 6000) return 0;
    const h = location.hash || '#/';
    /* telas com edição dentro: nunca redesenhar por baixo da pessoa */
    if (/^#\/(gravacao\/[^/]+\/roteiros|linha\/|semana\/|design\/[^/]+$|video\/[^/]+$|usuarios|config|perfil)/.test(h)) return 0;
    if (document.querySelector('#tela-editor.ativa, .fundo-modal')) return 0;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return 0;
    if (document.querySelector('.b7-foto, .b7-voo, .b7-voo-brilho')) return 2;
    return 1;
  }
  function agendarRedesenho(espera) {
    clearTimeout(timerRedesenho);
    timerRedesenho = setTimeout(() => {
      const pode = podeRedesenhar();
      if (pode === 2) return agendarRedesenho(250);
      if (pode !== 1 || !B7.Rota || !B7.Rota.ir) return;
      const p = document.getElementById('painel-dashboard');
      const rolagem = [window.scrollY, p ? p.scrollTop : 0];
      const hash = location.hash;
      if (p) p.classList.add('b7-sem-entrada');
      Promise.resolve(B7.Rota.ir()).catch(() => {}).then(() => {
        if (location.hash !== hash) return;
        requestAnimationFrame(() => {
          window.scrollTo(0, rolagem[0]);
          if (p) p.scrollTop = rolagem[1];
          setTimeout(() => p && p.classList.remove('b7-sem-entrada'), 400);
        });
      });
    }, espera || 120);
  }

  /* --------------------------------------------------------- o embrulho */
  function buscar(nome, orig, args, chave) {
    if (voando.has(chave)) return voando.get(chave);
    const g = geracao;
    const p = Promise.resolve(orig.apply(B7.DB, args)).then(r => {
      let texto;
      try { texto = JSON.stringify(r === undefined ? null : r); } catch (e) { texto = null; }
      const antes = mapa.get(chave);
      const mudou = !antes || antes.v !== texto;
      if (texto && texto.length < TAM_MAX && g === geracao) {
        mapa.set(chave, { v: texto, t: Date.now(), g });
        gravarDepois(chave);
        aparar();
      }
      return { r, mudou };
    });
    voando.set(chave, p);
    p.then(() => voando.delete(chave), () => voando.delete(chave));
    return p;
  }

  function embrulhar(nome) {
    const orig = B7.DB[nome];
    if (typeof orig !== 'function') return;
    B7.DB[nome] = async function (...args) {
      const quem = conta();
      if (!quem) return orig.apply(B7.DB, args);
      let chave;
      try { chave = quem + '|' + nome + '|' + JSON.stringify(args); } catch (e) { return orig.apply(B7.DB, args); }
      if (!mapa.has(chave)) await pronto;
      const e = mapa.get(chave);

      /* nada guardado: busca normal */
      if (!e) return (await buscar(nome, orig, args, chave)).r;

      /* guardado, mas houve escrita depois: espera o banco; a guardada só
         se a rede falhar */
      if (e.g < geracao) {
        try { return (await buscar(nome, orig, args, chave)).r; }
        catch (er) { if (navigator.onLine === false) return copia(e.v); throw er; }
      }

      /* guardado e conferido há pouco: nem pergunta ao banco */
      if (e.t > conferirDesde && Date.now() - e.t < FRESCA) return copia(e.v);

      /* guardado: mostra já e confere por trás */
      buscar(nome, orig, args, chave).then(({ mudou }) => { if (mudou) agendarRedesenho(); }, () => {});
      return copia(e.v);
    };
  }
  LEITURAS.forEach(embrulhar);

  function invalidar() { geracao++; }

  Object.keys(B7.DB).forEach(nome => {
    if (!ESCRITA.test(nome) || LEITURAS.includes(nome)) return;
    const orig = B7.DB[nome];
    if (typeof orig !== 'function') return;
    B7.DB[nome] = function (...args) {
      invalidar();
      const r = orig.apply(B7.DB, args);
      /* a escrita terminou: o que alguém leu NO MEIO dela também é velho */
      if (r && typeof r.then === 'function') r.then(invalidar, invalidar);
      return r;
    };
  });

  /* chamada direta ao rpc fora do database.js: na dúvida, é escrita */
  const rpcOrig = B7.DB.rpc;
  if (typeof rpcOrig === 'function') {
    B7.DB.rpc = function (nome, ...resto) {
      if (!/^(painel|listar|contar|contagem|resumo|minhas?_|buscar|ler_|ver_)/.test(String(nome || ''))) invalidar();
      return rpcOrig.call(B7.DB, nome, ...resto);
    };
  }

  /* Realtime: alguém mudou algo → o que está guardado vira "a conferir" */
  const canalOrig = B7.DB.canal;
  if (typeof canalOrig === 'function') {
    B7.DB.canal = function (nome, assinaturas, aoMudar) {
      return canalOrig.call(B7.DB, nome, assinaturas, p => { invalidar(); return aoMudar(p); });
    };
  }

  /* voltar ao app depois de um tempo fora: tudo a conferir */
  let saiuEm = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saiuEm = Date.now(); gravarAgora(); }
    else if (saiuEm && Date.now() - saiuEm > 60000) conferirDesde = Date.now();
  });
  window.addEventListener('pagehide', gravarAgora);

  /* sair da conta: nada fica no aparelho */
  function limpar() {
    mapa.clear(); voando.clear(); sujas.clear(); invalidar();
    try { if (idb) idb.transaction('r', 'readwrite').objectStore('r').clear(); } catch (e) {}
    try { indexedDB.deleteDatabase('b7-memoria'); } catch (e) {}
  }

  /* zzz7: AQUECER — logo depois do login, em segundo plano e uma de cada
     vez, as leituras das telas principais (mesmos argumentos que elas
     usam) entram na memória. A 1ª visita a cada aba também abre pronta,
     sem esqueleto. Só com internet, aba visível e se ainda não estiverem
     guardadas há pouco. */
  let aquecido = false;
  function aquecer() {
    if (aquecido || !conta() || navigator.onLine === false) return;
    if (B7.Auth && B7.Auth.ehCliente && B7.Auth.ehCliente()) return;   /* Portal tem as telas dele */
    aquecido = true;
    const fila = [
      ['listarClientes', []], ['listarGravacoes', []], ['roteirosRecentes', [1000]],
      ['minhasDemandasVideo', []], ['listarVideomakers', []], ['pacotesVideo', []],
      ['fixados', []], ['gravacoesRecentes', [7]]
    ].filter(([n]) => typeof B7.DB[n] === 'function');
    const proximo = () => {
      const item = fila.shift();
      if (!item || !conta()) return;
      if (document.hidden) { setTimeout(() => fila.unshift(item) && proximo(), 4000); return; }
      Promise.resolve(B7.DB[item[0]].apply(B7.DB, item[1])).catch(() => {})
        .then(() => setTimeout(proximo, 250));
    };
    setTimeout(proximo, 3500);
  }

  return { invalidar, limpar, aquecer, _mapa: mapa };
})();
