/* =====================================================================
   MODO MANUTENÇÃO E NOVIDADES (zzz130) — dois avisos do administrador
   para a agência inteira. Os dois moram em sistema_config e só o
   administrador grava (o banco confere).

   B7.Manutencao — o administrador avisa que vai mexer no sistema. Quem
     não é administrador vê primeiro uma faixa com contagem ("salve o
     que estiver fazendo") e, na hora marcada, a tela fica travada com a
     mensagem dele até a manutenção acabar. O administrador nunca é
     travado: vê só um lembrete de que está ligado.
     É uma trava de TELA: não muda regra de acesso nenhuma no banco. Cada
     tela aberta confere a cada minuto (e ao voltar para a aba), com a
     hora do servidor. Teleprompter aberto segura a trava até fechar.

   B7.Novidades — o que mudou no B7. As novidades de cada versão vêm
     junto com o sistema (js/novidades.js) e aparecem sozinhas; o
     administrador pode publicar um aviso a mais, à mão. A equipe vê um
     cartão quando há algo que ainda não leu, e relê quando quiser em
     Configurações → Geral.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Manutencao = (function () {
  const esc = s => B7.UI.esc(s);
  const pad = n => String(n).padStart(2, '0');
  let atual = null, desvio = 0, poll = 0, tique = 0, ligado = false, ultimaConf = 0;

  const agora = () => Date.now() + desvio;
  const souAdmin = () => !!(B7.Auth && B7.Auth.ehAdminReal && B7.Auth.ehAdminReal());
  const horaDe = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  /* nenhuma | aviso (vai começar) | ativa (em vigor) */
  function fase() {
    if (!atual || !atual.ativo) return 'nenhuma';
    if (atual.fim && new Date(atual.fim).getTime() <= agora()) return 'nenhuma';
    const falta = new Date(atual.inicio).getTime() - agora();
    /* zzz136: agendada para mais tarde — ainda não é hora nem da contagem */
    return falta > 10 * 60000 ? 'agendada' : falta > 0 ? 'aviso' : 'ativa';
  }
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /* "hoje às 22:00", "amanhã às 08:00", "sáb 12/10 às 22:00" — na hora deste aparelho */
  function quandoDe(ts) {
    const d = new Date(new Date(ts).getTime() - desvio), h = new Date(), a = new Date(); a.setDate(h.getDate() + 1);
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (d.toDateString() === h.toDateString()) return 'hoje às ' + hm;
    if (d.toDateString() === a.toDateString()) return 'amanhã às ' + hm;
    return DOW[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' às ' + hm;
  }

  /* zzz139: o administrador encerrou esta sessão — sai da conta agora, sem esperar o acesso vencer */
  let derrubada = false;
  function derrubar() {
    if (derrubada || !(B7.Auth && B7.Auth.sair)) return;
    derrubada = true;
    try { B7.UI.toast('Sua sessão foi encerrada por um administrador. Entre de novo.', { tipo: 'erro' }); } catch (e) {}
    setTimeout(() => B7.Auth.sair(), 1800);
  }

  async function conferir() {
    if (!B7.DB || !B7.DB.rpc || !(B7.Auth && B7.Auth.usuario && B7.Auth.usuario())) return;
    ultimaConf = Date.now();
    try {
      const r = await B7.DB.rpc('sistema_avisos');
      if (!r) return;
      if (r.agora) desvio = new Date(r.agora).getTime() - Date.now();
      atual = r.manutencao || null;
      if (r.sessao === false) derrubar();
    } catch (e) { /* sem rede: fica o último estado conhecido */ }
    pintar();
  }

  function tirar(id) { const el = document.getElementById(id); if (el) el.remove(); }
  function destravar() {
    tirar('b7-manut');
    document.body.classList.remove('em-manutencao');
    const app = document.getElementById('app'); if (app) app.inert = false;
  }

  const ROT_FASE = { nenhuma: 'Desligado', agendada: 'Agendado', aviso: 'Marcado', ativa: 'Ligado' };
  /* zzz132: a linha em Configurações → Admin acompanha o estado de verdade.
     Antes ela era desenhada uma vez só: aberta antes de a consulta voltar,
     ficava dizendo "Desligado" com a manutenção ligada. */
  function atualizarLinha() {
    const f = fase();
    document.querySelectorAll('[data-mn-v]').forEach(v => {
      if (v.textContent !== ROT_FASE[f]) v.textContent = ROT_FASE[f];
      v.classList.toggle('erro', f !== 'nenhuma');
    });
    const d = descricao();
    document.querySelectorAll('[data-mn-d]').forEach(x => { if (x.textContent !== d) x.textContent = d; });
  }

  function pintar() {
    const f = fase();
    atualizarLinha();
    clearInterval(tique); tique = 0;
    if (f === 'nenhuma') { destravar(); tirar('b7-manut-faixa'); return; }
    /* enquanto houver manutenção marcada, o relógio anda de segundo em segundo */
    tique = setInterval(pintar, f === 'agendada' ? 30000 : 1000);

    const fimTx = atual.fim ? 'previsão de volta às ' + horaDe(new Date(atual.fim).getTime() - desvio) : 'sem hora marcada para voltar';
    if (f === 'agendada') {
      /* só o administrador recebe o agendamento antes da hora; o lembrete
         aparece no dia (até 24 h antes) — antes disso fica só nas Configurações */
      destravar();
      if (souAdmin() && new Date(atual.inicio).getTime() - agora() <= 24 * 3600000)
        faixa('adm', 'Manutenção agendada para ' + quandoDe(atual.inicio), 'Gerenciar', () => abrirGerenciar());
      else tirar('b7-manut-faixa');
      return;
    }
    if (souAdmin()) {
      destravar();
      faixa('adm', (f === 'aviso' ? 'Manutenção marcada: a equipe é travada em ' + contagem() : 'Modo manutenção ligado: a equipe está travada') +
        ' · ' + fimTx, 'Gerenciar', () => abrirGerenciar());
      return;
    }
    if (f === 'aviso') {
      destravar();
      faixa('aviso', 'O sistema entra em manutenção em ' + contagem() + '. Salve o que estiver fazendo.', '', null);
      return;
    }
    tirar('b7-manut-faixa');
    /* travado: confere mais vezes, para liberar logo se o administrador desligar antes */
    if (Date.now() - ultimaConf > 20000 && !document.hidden) { conferir(); return; }
    /* teleprompter aberto: não corta uma gravação — trava ao fechar */
    if (document.body.classList.contains('tele-aberto')) { destravar(); return; }
    travar(fimTx);
  }

  function contagem() {
    const s = Math.max(0, Math.round((new Date(atual.inicio).getTime() - agora()) / 1000));
    return s >= 60 ? Math.floor(s / 60) + ' min ' + pad(s % 60) + ' s' : s + ' s';
  }

  function faixa(tipo, texto, rotulo, acao) {
    let el = document.getElementById('b7-manut-faixa');
    if (!el) {
      el = document.createElement('div'); el.id = 'b7-manut-faixa'; el.setAttribute('role', 'status');
      el.innerHTML = '<span class="mn-ponto" aria-hidden="true"></span><span class="mn-tx"></span><button type="button" class="mn-bt" hidden></button>';
      document.body.appendChild(el);
    }
    el.className = 'mn-faixa mn-' + tipo;
    const tx = el.querySelector('.mn-tx'); if (tx.textContent !== texto) tx.textContent = texto;
    const bt = el.querySelector('.mn-bt');
    bt.hidden = !acao; if (acao) { bt.textContent = rotulo; bt.onclick = acao; }
  }

  const MSG_PADRAO = 'Estamos fazendo uma melhoria no sistema. Voltamos em instantes.';
  /* a mesma tela que a equipe vê, só para o administrador conferir antes de ligar */
  function previa(mensagem, fimTx) {
    tirar('b7-manut-previa');
    const el = document.createElement('div'); el.id = 'b7-manut-previa'; el.className = 'mn-trava mn-so-previa';
    el.innerHTML = '<div class="mn-caixa"><img class="mn-logo claro" src="assets/brand/logo-color.png" alt="Branding7">' +
      '<img class="mn-logo escuro" src="assets/brand/logo-white.png" alt="" aria-hidden="true">' +
      '<h2>Sistema em manutenção</h2><p class="mn-msg"></p><p class="mn-fim"></p>' +
      '<p class="mn-nota">Esta tela se libera sozinha quando terminar. O que você já tinha salvo continua guardado.</p>' +
      '<button type="button" class="b contorno mn-fechar-previa">Fechar prévia</button><small class="mn-previa-aviso">Prévia: é isto que a equipe vê. Nada foi ligado.</small></div>';
    el.querySelector('.mn-msg').textContent = (mensagem || '').trim() || MSG_PADRAO;
    el.querySelector('.mn-fim').textContent = fimTx;
    el.querySelector('.mn-fechar-previa').onclick = () => el.remove();
    document.body.appendChild(el);
    el.querySelector('.mn-fechar-previa').focus();
  }

  function travar(fimTx) {
    const msg = (atual.mensagem || '').trim() || MSG_PADRAO;
    let el = document.getElementById('b7-manut');
    if (!el) {
      el = document.createElement('div'); el.id = 'b7-manut'; el.className = 'mn-trava';
      el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'mn-titulo');
      el.innerHTML = '<div class="mn-caixa"><img class="mn-logo claro" src="assets/brand/logo-color.png" alt="Branding7">' +
        '<img class="mn-logo escuro" src="assets/brand/logo-white.png" alt="" aria-hidden="true">' +
        '<h2 id="mn-titulo">Sistema em manutenção</h2><p class="mn-msg"></p><p class="mn-fim"></p>' +
        '<p class="mn-nota">Esta tela se libera sozinha quando terminar. O que você já tinha salvo continua guardado.</p></div>';
      document.body.appendChild(el);
      /* tira o foco de onde estava: ninguém digita por baixo da trava */
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    }
    const m = el.querySelector('.mn-msg'), fm = el.querySelector('.mn-fim');
    if (m.textContent !== msg) m.textContent = msg;
    if (fm.textContent !== fimTx) fm.textContent = fimTx;
    document.body.classList.add('em-manutencao');
    const app = document.getElementById('app'); if (app) app.inert = true;
  }

  function iniciar() {
    if (ligado) { conferir(); return; }
    ligado = true;
    conferir();
    poll = setInterval(() => { if (!document.hidden) conferir(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) conferir(); });
  }

  /* ------------------------------------------------ janela do administrador */
  function abrirGerenciar(aoMudar) {
    const f = fase();
    const opcoes = (nome, itens, marcado) => '<div class="mn-ops" role="radiogroup">' + itens.map(([v, r]) =>
      '<label><input type="radio" name="' + nome + '" value="' + v + '"' + (String(v) === String(marcado) ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>';
    const m = B7.UI.modal('<h3>Modo manutenção</h3>' +
      (f === 'nenhuma'
        ? '<p class="sub">Trava a tela de toda a equipe com um aviso seu, enquanto você mexe em algo. Administradores continuam usando normalmente. ' +
            'É uma trava de tela: não altera nenhuma regra de acesso.</p>' +
          '<div class="mb"><label class="rot" for="mn-msg">MENSAGEM PARA A EQUIPE</label>' +
            '<textarea class="campo" id="mn-msg" rows="2" maxlength="300">' + MSG_PADRAO + '</textarea></div>' +
          '<div class="mb"><label class="rot">COMEÇA</label>' + opcoes('mn-ini', [[2, 'Em 2 minutos'], [5, 'Em 5 minutos'], [0, 'Agora'], ['agendar', 'Agendar…']], 2) +
            '<input type="datetime-local" class="campo mn-quando" id="mn-quando" aria-label="Dia e horário de início" hidden>' +
            '<small class="mn-dica">Com antecedência, a equipe vê uma contagem para salvar o que está fazendo. “Agora” pode cortar alguém no meio de um formulário.</small></div>' +
          '<div class="mb"><label class="rot">DURA</label>' + opcoes('mn-dur', [[15, '15 minutos'], [30, '30 minutos'], [60, '1 hora'], ['', 'Até eu desligar']], 15) + '</div>' +
          '<label class="mn-check"><input type="checkbox" id="mn-portal"><span>Travar também o Portal do cliente</span></label>' +
          '<div class="acoes"><button type="button" class="b contorno" id="mn-previa">Ver como a equipe vê</button><span class="mn-esp"></span>' +
            '<button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="mn-ok">Ligar manutenção</button></div>'
        : '<p class="sub">' + (f === 'agendada' ? 'Agendada para ' + quandoDe(atual.inicio) + '. A equipe vê a contagem 10 minutos antes.'
            : f === 'aviso' ? 'Marcada: a equipe é travada às ' + horaDe(new Date(atual.inicio).getTime() - desvio) + '.' : 'Ligado agora: a equipe está com a tela travada.') +
            ' ' + (atual.fim ? 'Termina sozinho às ' + horaDe(new Date(atual.fim).getTime() - desvio) + '.' : 'Fica ligado até você desligar.') +
            (atual.portal ? ' Vale também para o Portal do cliente.' : ' O Portal do cliente não é afetado.') + '</p>' +
          '<div class="mn-previa"><small>MENSAGEM</small><p>' + esc((atual.mensagem || '').trim() || 'Estamos fazendo uma melhoria no sistema. Voltamos em instantes.') + '</p></div>' +
          '<div class="acoes">' + (f === 'ativa' && atual.fim ? '<button type="button" class="b contorno" id="mn-mais">+ 15 minutos</button><span class="mn-esp"></span>' : '') +
            '<button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b pri" id="mn-desligar">' + (f === 'agendada' ? 'Cancelar o agendamento' : 'Desligar agora') + '</button></div>'));
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    const feito = async (bt, rotulo, chamada, aviso) => {
      bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        await chamada();
        m.fechar(); B7.UI.toast(aviso);
        await conferir();
        if (aoMudar) aoMudar();
        /* aberto pela faixa, com as Configurações na tela: a linha de lá acompanha */
        else if (location.hash.indexOf('#/config') === 0 && B7.Dashboard && B7.Dashboard.abrirConfig) B7.Dashboard.abrirConfig();
      } catch (e) {
        bt.disabled = false; bt.textContent = rotulo;
        B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' });
      }
    };
    const ok = m.querySelector('#mn-ok');
    /* zzz136: "Agendar…" abre o campo de dia e horário (até 30 dias à frente) */
    const quando = m.querySelector('#mn-quando');
    const localISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (quando) {
      const agoraLocal = new Date(), padrao = new Date(agoraLocal.getTime() + 3600000); padrao.setMinutes(0, 0, 0);
      quando.min = localISO(agoraLocal); quando.max = localISO(new Date(agoraLocal.getTime() + 30 * 86400000)); quando.value = localISO(padrao);
      const trocar = () => {
        const ag = m.querySelector('input[name="mn-ini"]:checked').value === 'agendar';
        quando.hidden = !ag; ok.textContent = ag ? 'Agendar manutenção' : 'Ligar manutenção';
      };
      m.querySelectorAll('input[name="mn-ini"]').forEach(x => x.onchange = trocar); trocar();
    }
    if (ok) ok.onclick = () => {
      const dur = m.querySelector('input[name="mn-dur"]:checked').value, ini = m.querySelector('input[name="mn-ini"]:checked').value;
      const args = { p_ativo: true, p_mensagem: m.querySelector('#mn-msg').value, p_inicio_min: ini === 'agendar' ? 0 : Number(ini),
        p_duracao_min: dur === '' ? null : Number(dur), p_portal: m.querySelector('#mn-portal').checked };
      if (ini === 'agendar') {
        const d = new Date(quando.value);
        if (!quando.value || isNaN(d)) { B7.UI.toast('Escolha o dia e o horário.', { tipo: 'erro' }); return; }
        if (d.getTime() < Date.now()) { B7.UI.toast('Esse horário já passou.', { tipo: 'erro' }); return; }
        args.p_inicio_em = d.toISOString();
      }
      feito(ok, ini === 'agendar' ? 'Agendar manutenção' : 'Ligar manutenção', () => B7.DB.rpc('manutencao_definir', args),
        ini === 'agendar' ? 'Manutenção agendada. A equipe vê a contagem 10 minutos antes.' : 'Manutenção ligada. Chega a cada pessoa em até 1 minuto.');
    };
    const pv = m.querySelector('#mn-previa');
    if (pv) pv.onclick = () => {
      const dur = m.querySelector('input[name="mn-dur"]:checked').value, iniV = m.querySelector('input[name="mn-ini"]:checked').value;
      const base = iniV === 'agendar' && quando && quando.value ? new Date(quando.value).getTime() : Date.now() + Number(iniV) * 60000;
      previa(m.querySelector('#mn-msg').value, dur === '' ? 'sem hora marcada para voltar'
        : 'previsão de volta às ' + horaDe(base + Number(dur) * 60000));
    };
    /* estender: mesma mensagem e mesmo alcance, só empurra o fim */
    const mais = m.querySelector('#mn-mais');
    if (mais) mais.onclick = () => {
      const resta = Math.max(0, Math.ceil((new Date(atual.fim).getTime() - agora()) / 60000));
      feito(mais, '+ 15 minutos', () => B7.DB.rpc('manutencao_definir', {
        p_ativo: true, p_mensagem: atual.mensagem || '', p_inicio_min: 0, p_duracao_min: Math.min(1440, resta + 15), p_portal: !!atual.portal
      }), 'Manutenção estendida em 15 minutos.');
    };
    const des = m.querySelector('#mn-desligar');
    if (des) des.onclick = () => feito(des, 'Desligar agora', () => B7.DB.rpc('manutencao_definir', { p_ativo: false }),
      'Manutenção desligada. As telas se liberam em até 1 minuto.');
  }

  function descricao() {
    const f = fase();
    if (f === 'nenhuma') return 'trava a tela da equipe com um aviso seu';
    const fim = atual.fim ? 'termina sozinho às ' + horaDe(new Date(atual.fim).getTime() - desvio) : 'fica ligado até você desligar';
    if (f === 'agendada') return 'agendado para ' + quandoDe(atual.inicio) + (atual.fim ? ' · dura ' + Math.round((new Date(atual.fim) - new Date(atual.inicio)) / 60000) + ' min' : ' · até você desligar');
    return (f === 'ativa' ? 'ligado agora: a equipe está travada' : 'marcado: trava a equipe às ' + horaDe(new Date(atual.inicio).getTime() - desvio)) + ' · ' + fim;
  }

  return { iniciar, conferir, fase, descricao, abrirGerenciar };
})();

B7.Novidades = (function () {
  const esc = s => B7.UI.esc(s);
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  let lista = null;

  /* as que o administrador escreveu à mão (banco) */
  const doBanco = () => lista || (B7.pref ? B7.pref.ler('sis_novidades', null) : null) || [];
  /* zzz131: as de cada versão vêm junto com o sistema (js/novidades.js) e
     aparecem sozinhas; cada pessoa só recebe as que valem para ela */
  function valePara(n) {
    const A = B7.Auth || {}, P = B7.Perm || {};
    const admin = !!(A.ehAdminReal && A.ehAdminReal());
    if (n.para === 'admin' && !admin) return false;
    if (n.funcao && !admin && !(A.funcao && A.funcao() === n.funcao)) return false;
    if (n.rota && !(P.podeRota && P.podeRota(n.rota))) return false;
    if (n.recurso && B7.Recursos && !B7.Recursos.ligado(n.recurso)) return false;
    if (n.ia && !(B7.IA && B7.IA.ligada && B7.IA.ligada(n.ia))) return false;
    return true;
  }
  const dasVersoes = () => (B7.NOVIDADES_VERSOES || []).filter(valePara);
  const dados = () => doBanco().concat(dasVersoes()).sort((a, b) => new Date(b.em) - new Date(a.em));
  const dia = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' de ' + MESES[d.getMonth()]; };
  const vistas = () => (B7.pref && B7.pref.ler('novidades_vistas', [])) || [];
  const naoLidas = () => { const v = vistas(); return dados().filter(n => !v.includes(n.id)); };
  function marcarLidas() { if (B7.pref) B7.pref.gravar('novidades_vistas', dados().map(n => n.id)); tirarCartao(); }
  function tirarCartao() { const el = document.getElementById('b7-novidades'); if (el) el.remove(); }

  async function sincronizar() {
    if (!B7.sb) return;
    try {
      const { data } = await B7.sb.from('sistema_config').select('valor').eq('chave', 'novidades').maybeSingle();
      lista = (data && Array.isArray(data.valor)) ? data.valor : [];
      if (B7.pref) B7.pref.gravar('sis_novidades', lista);
    } catch (e) { /* sem rede: as novidades da versão aparecem do mesmo jeito */ }
    cartao();
  }

  /* cartão discreto no canto: só quando há algo que a pessoa ainda não leu */
  function cartao() {
    tirarCartao();
    const novas = naoLidas(); if (!novas.length) return;
    const el = document.createElement('div');
    el.id = 'b7-novidades'; el.className = 'nv-cartao'; el.setAttribute('role', 'status');
    el.innerHTML = '<span class="nv-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5l2.2 5.3 5.6.5-4.2 3.8 1.3 5.6L12 15.8l-4.9 2.9 1.3-5.6-4.2-3.8 5.6-.5z"/></svg></span>' +
      '<span class="nv-tx"><small>' + (novas.length === 1 ? 'Novidade no B7' : novas.length + ' novidades no B7') + '</small><b>' + esc(novas[0].titulo) + '</b></span>' +
      '<button type="button" class="nv-ver">Ver</button><button type="button" class="nv-x" aria-label="Dispensar">×</button>';
    document.body.appendChild(el);
    el.querySelector('.nv-ver').onclick = abrir;
    el.querySelector('.nv-x').onclick = marcarLidas;
  }

  function corpoLista(itens, comRemover) {
    if (!itens.length) return '<p class="nv-vazio">' + (comRemover ? 'Nenhum aviso seu publicado.' : 'Nenhuma novidade ainda.') + '</p>';
    const v = vistas();
    return '<div class="nv-lista">' + itens.map(n =>
      '<article class="nv-item' + (!comRemover && !v.includes(n.id) ? ' nova' : '') + '"><header><b>' + esc(n.titulo) + '</b>' +
        '<small>' + esc([dia(n.em), n.versao || ''].filter(Boolean).join(' · ')) + '</small>' +
        (comRemover ? '<button type="button" class="nv-rm" data-rm="' + esc(n.id) + '">Remover</button>' : '') + '</header>' +
        ((n.itens || []).length ? '<ul>' + n.itens.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') + '</article>').join('') + '</div>';
  }

  function abrir() {
    const m = B7.UI.modal('<h3>Novidades do B7</h3><p class="sub">O que mudou no sistema, do mais recente para o mais antigo.</p>' +
      corpoLista(dados(), false) +
      '<div class="acoes"><button type="button" class="b pri" data-fecha>Entendi</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    marcarLidas();
  }

  /* ------------------------------------------------ janela do administrador */
  function abrirPublicar(aoMudar) {
    const versao = ((B7.Auth && B7.Auth.VERSAO) || '').split('-').pop();
    const m = B7.UI.modal('<h3>Publicar novidade</h3>' +
      '<p class="sub">As novidades de cada versão já entram sozinhas. Use aqui só para um aviso a mais, escrito por você. ' +
        'A equipe vê um cartão no canto da tela ao abrir o B7; o Portal do cliente não recebe.</p>' +
      '<div class="mb"><label class="rot" for="nv-titulo">TÍTULO</label><input class="campo" id="nv-titulo" maxlength="120" placeholder="Ex.: Painel de TV e textos padrão" data-foco></div>' +
      '<div class="mb"><label class="rot" for="nv-itens">O QUE MUDOU <span class="nv-leve">— uma linha por item, até 12</span></label>' +
        '<textarea class="campo" id="nv-itens" rows="5" placeholder="Agora dá para deixar a agência aberta numa TV&#10;As mensagens prontas para o cliente podem ser editadas"></textarea></div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b pri" id="nv-ok">Publicar</button></div>' +
      '<h4 class="nv-sub">Avisos seus já publicados</h4><div id="nv-publicadas">' + corpoLista(doBanco(), true) + '</div>', { larga: true });
    /* a tela de trás (Configurações) só se atualiza depois que a janela fecha */
    let mudou = false;
    const fechar = () => { m.fechar(); if (mudou && aoMudar) aoMudar(); };
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = fechar);
    const gravar = async nova => {
      const r = await B7.DB.rpc('novidades_definir', { p_lista: nova });
      lista = Array.isArray(r) ? r : nova;
      if (B7.pref) B7.pref.gravar('sis_novidades', lista);
      mudou = true;
    };
    const ligarRemover = () => m.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        await gravar(doBanco().filter(n => n.id !== b.dataset.rm));
        m.querySelector('#nv-publicadas').innerHTML = corpoLista(doBanco(), true); ligarRemover();
        B7.UI.toast('Novidade removida.');
      } catch (e) { b.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível remover.', { tipo: 'erro' }); }
    });
    ligarRemover();
    const ok = m.querySelector('#nv-ok');
    ok.onclick = async () => {
      const titulo = m.querySelector('#nv-titulo').value.trim();
      const itens = m.querySelector('#nv-itens').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
      if (!titulo) { B7.UI.toast('Escreva um título.', { tipo: 'erro' }); m.querySelector('#nv-titulo').focus(); return; }
      ok.disabled = true; ok.textContent = 'Publicando…';
      try {
        const id = 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        /* a mais nova primeiro; passando de 30, as mais antigas saem */
        await gravar([{ id, titulo, versao, itens }].concat(doBanco()).slice(0, 30));
        fechar();
        B7.UI.toast('Novidade publicada. A equipe vê ao abrir o B7.');
        cartao();
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Publicar';
        B7.UI.toast((e && e.message) || 'Não foi possível publicar.', { tipo: 'erro' });
      }
    };
  }

  return { sincronizar, abrir, abrirPublicar, total: () => dados().length, manuais: () => doBanco().length, pendentes: () => naoLidas().length };
})();
