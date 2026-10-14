/* =====================================================================
   WHATSAPP NO SISTEMA (zzz170)

   Item "WhatsApp" na barra lateral (rota #/whatsapp):
     • no programa de Windows, o WhatsApp Web de verdade aparece ENCAIXADO
       no lugar das telas — a barra lateral e o topo do B7 continuam ali.
       Quem desenha é o programa (app-desktop/whatsapp.js): esta tela só
       diz a ele onde fica o espaço, e quando esconder (ao sair da tela,
       ou quando uma janela do sistema abre por cima — o WhatsApp fica
       sempre na frente das telas, então ele some um instante);
     • no navegador, o WhatsApp não deixa ser posto dentro de outro site:
       a tela tem o botão para abrir o WhatsApp Web numa aba;
     • no app Android, abre o app do WhatsApp.

   Assinatura: no programa, toda mensagem sai com "*Seu nome:*" na
   primeira linha (o WhatsApp mostra em negrito). Liga/desliga e o nome
   ficam no topo desta tela.

   "Enviar ao cliente" (vídeo e gravação marcada): B7.WhatsApp.enviar()
   abre uma caixinha com a mensagem pronta e, no programa, o arquivo
   escolhido na hora. "Abrir no WhatsApp" entra no grupo do cliente
   (clientes.whatsapp_grupo), anexa o vídeo como DOCUMENTO e põe a
   mensagem — quem aperta enviar é sempre a pessoa. O envio fica
   registrado (whatsapp_envios; na demanda de vídeo, também no histórico).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WhatsApp = (function () {
  const esc = s => B7.UI.esc(s);
  const D = window.B7Desktop && window.B7Desktop.wa ? window.B7Desktop.wa : null;     /* programa de Windows */
  const nativo = () => !!(B7.AppNativo && B7.AppNativo.ativo);                         /* app Android */
  const icone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.8-.6.3-1.4.4-2.4 0a9 9 0 0 1-4.9-4.9c-.4-1-.3-1.8 0-2.5z"/></svg>';

  let naoLidas = 0, ativo = false, relogio = 0, observador = null, ultimoRet = '', escondido = true;

  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
  const primeiroNome = () => String(eu().nome || eu().username || '').trim().split(/\s+/)[0] || '';
  const podeEnviar = () => { const u = eu(); return !!u.id && u.papel !== 'cliente'; };

  /* ------------------------------------------------ número no menu */
  function pintarContagem() {
    document.querySelectorAll('[data-nav="whatsapp"]').forEach(a => {
      let b = a.querySelector('.wa-n');
      if (!naoLidas) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('i'); b.className = 'wa-n'; a.appendChild(b); }
      b.textContent = naoLidas > 99 ? '99+' : naoLidas;
    });
  }
  if (D && D.aoNaoLidas) D.aoNaoLidas(n => { naoLidas = +n || 0; pintarContagem(); });
  /* clicou no aviso de mensagem do WhatsApp: vem para a tela dele */
  if (D && D.aoIr) D.aoIr(() => { if (location.hash.indexOf('#/whatsapp') !== 0) location.hash = '#/whatsapp'; });
  /* o menu lateral é redesenhado às vezes: recoloca o número */
  addEventListener('hashchange', () => setTimeout(pintarContagem, 200));

  /* --------------------------------------------- a tela #/whatsapp */
  async function abrir() {
    const painel = document.getElementById('painel-dashboard');
    if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp']);
    if (!D) return telaFora(painel);
    const cfg = await D.config().catch(() => ({})) || {};
    if (!cfg.nome) { cfg.nome = primeiroNome(); D.definirConfig({ nome: cfg.nome }); }
    painel.innerHTML = '<div class="wa-tela">' +
      '<div class="wa-barra">' +
        '<span class="wa-tit">' + icone + '<b>WhatsApp</b></span>' +
        '<label class="wa-ass" title="Toda mensagem sai com o seu nome em negrito na primeira linha">' +
          '<input type="checkbox" id="wa-ass"' + (cfg.assinatura !== false ? ' checked' : '') + '><span>Assinar como</span></label>' +
        '<input class="campo wa-nome" id="wa-nome" maxlength="40" value="' + esc(cfg.nome || '') + '" placeholder="Seu nome" aria-label="Nome da assinatura">' +
        '<span class="wa-prev" id="wa-prev"></span>' +
        '<button type="button" class="b fina contorno" id="wa-recarregar" title="Recarregar o WhatsApp">Recarregar</button>' +
      '</div>' +
      '<div class="wa-area" id="wa-area"><div class="wa-espera">' + icone + '<b>WhatsApp</b><span>Carregando…</span></div></div>' +
    '</div>';
    const cb = painel.querySelector('#wa-ass'), nome = painel.querySelector('#wa-nome'), prev = painel.querySelector('#wa-prev');
    const previa = () => { prev.innerHTML = cb.checked && nome.value.trim() ? 'Sai assim: <b>' + esc(nome.value.trim()) + ':</b> sua mensagem…' : 'Sem assinatura'; };
    const salvar = () => { D.definirConfig({ nome: nome.value.trim(), assinatura: cb.checked }); previa(); };
    cb.onchange = salvar; nome.oninput = previa; nome.onchange = salvar;
    painel.querySelector('#wa-recarregar').onclick = () => D.recarregar && D.recarregar();
    previa();
    ligar();
    if (B7.Rota && B7.Rota.aoSair) B7.Rota.aoSair(desligar);
  }

  /* navegador e celular */
  function telaFora(painel) {
    const cel = nativo();
    painel.innerHTML = '<div class="conteudo entra wa-fora">' + icone +
      '<h1>WhatsApp</h1>' +
      '<p>' + (cel
        ? 'No celular, o WhatsApp abre no app dele. Os botões “Enviar no WhatsApp” do sistema já mandam a mensagem pronta para lá.'
        : 'No navegador, o WhatsApp não deixa ser aberto dentro de outro site. No <b>programa do B7 para Windows</b>, ele aparece aqui dentro, com a sua assinatura em negrito.') + '</p>' +
      '<div class="acoes"><button type="button" class="b pri" id="wa-abrir-fora">' + (cel ? 'Abrir o WhatsApp' : 'Abrir o WhatsApp Web') + '</button></div></div>';
    painel.querySelector('#wa-abrir-fora').onclick = () => {
      if (cel) location.href = 'whatsapp://send';
      else window.open('https://web.whatsapp.com/', '_blank', 'noopener');
    };
  }

  /* o espaço da tela → o programa. Se alguma coisa do sistema estiver por
     cima (janela, menu, assistente, conversas), esconde o WhatsApp até
     ela fechar. */
  function coberta(area, r) {
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 12, r.top + 12], [r.right - 12, r.top + 12],
                 [r.left + 12, r.bottom - 12], [r.right - 12, r.bottom - 12]];
    /* botão flutuante, aviso (toast) e dica pequena não contam: só o que é
       grande de verdade (janela, menu, painel) esconde o WhatsApp */
    return pts.some(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return true;
      if (area.contains(el)) return false;
      let c = el;
      while (c && c !== document.body && !c.contains(area)) {
        const b = c.getBoundingClientRect();
        if (b.width >= 160 && b.height >= 120) return true;
        c = c.parentElement;
      }
      return false;
    });
  }
  function medir() {
    if (!ativo) return;
    const area = document.getElementById('wa-area');
    if (!area) return desligar();
    /* a área vai até o pé da janela */
    const topo = area.getBoundingClientRect().top + (window.scrollY || 0);
    const alt = Math.max(320, Math.round(innerHeight - topo - 14));
    if (Math.abs(area.offsetHeight - alt) > 1) area.style.height = alt + 'px';
    const r = area.getBoundingClientRect();
    const fora = r.width < 60 || r.height < 60 || document.hidden;
    if (fora || coberta(area, r)) {
      if (!escondido) { escondido = true; ultimoRet = ''; D.esconder(); }
      return;
    }
    const ret = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
    if (ret === ultimoRet && !escondido) return;
    ultimoRet = ret; escondido = false;
    D.mostrar({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  }
  function ligar() {
    ativo = true; escondido = true; ultimoRet = '';
    clearInterval(relogio);
    relogio = setInterval(medir, 250);           /* barra lateral abrindo, rolagem, zoom: segue junto */
    addEventListener('resize', medir);
    observador = new MutationObserver(() => requestAnimationFrame(medir));
    observador.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ['class'] });
    requestAnimationFrame(medir);
  }
  function desligar() {
    if (!ativo) return;
    ativo = false; clearInterval(relogio); removeEventListener('resize', medir);
    if (observador) { observador.disconnect(); observador = null; }
    escondido = true; ultimoRet = '';
    if (D) D.esconder();
  }
  addEventListener('hashchange', () => { if (location.hash.indexOf('#/whatsapp') !== 0) desligar(); });

  /* ------------------------------------------------ modelos de texto */
  const MODELOS = {
    video: 'Olá, {cliente}! 🎬\nSegue o vídeo{titulo} para vocês conferirem. Qualquer ajuste, é só nos falar por aqui.',
    gravacao: 'Olá, {cliente}! 🎥\nPassando para confirmar a nossa gravação:\n📅 {data}{hora}{local}\nQualquer mudança, nos avise por aqui. Até lá!'
  };
  const chaveModelo = t => 'wa_modelo_' + t;
  function preencher(tpl, d) {
    return tpl
      .replace(/\{cliente\}/g, d.clienteNome || '')
      .replace(/\{titulo\}/g, d.titulo ? ' "' + d.titulo + '"' : '')
      .replace(/\{data\}/g, d.data || '')
      .replace(/\{hora\}/g, d.hora ? ' às ' + d.hora : '')
      .replace(/\{local\}/g, d.local ? '\n📍 ' + d.local : '');
  }

  /* ----------------------------------------- "Enviar ao cliente" */
  async function enviar(d) {
    let grupo = '';
    if (d.clienteId) { try { const c = await B7.DB.cliente(d.clienteId); grupo = (c && c.whatsapp_grupo) || ''; } catch (e) {} }
    const tpl = B7.pref.ler(chaveModelo(d.tipo), MODELOS[d.tipo] || '');
    const prog = !!D, cel = nativo();
    const m = B7.UI.modal('<h3>' + (d.tipo === 'gravacao' ? 'Avisar a gravação no WhatsApp' : 'Enviar o vídeo no WhatsApp') + '</h3>' +
      '<p class="sub">' + (prog
        ? 'O sistema abre o grupo, ' + (d.comArquivo ? 'anexa o vídeo como documento ' : '') + 'e escreve a mensagem. <b>Quem aperta enviar é você.</b>'
        : cel ? 'Abre o WhatsApp com a mensagem' + (d.comArquivo ? ' e o vídeo' : '') + ' — você escolhe o grupo e envia.'
        : 'A mensagem é copiada e o WhatsApp Web abre numa aba: cole (Ctrl+V) no grupo' + (d.comArquivo ? ' e anexe o vídeo como documento' : '') + '.') + '</p>' +
      '<div class="mb"><label class="rot" for="wa-g">GRUPO DO CLIENTE</label>' +
        '<input class="campo" id="wa-g" maxlength="120" value="' + esc(grupo) + '" placeholder="Nome do grupo, igual aparece no WhatsApp">' +
        '<small class="leve wa-g-dica" id="wa-g-dica">' + (grupo ? '' : 'Este cliente ainda não tem grupo cadastrado — o nome que você puser aqui fica salvo nele.') + '</small></div>' +
      (d.comArquivo && (prog || cel)
        ? '<div class="mb"><label class="rot">VÍDEO</label><div class="wa-arq">' +
            '<button type="button" class="b contorno" id="wa-arq">Escolher o vídeo…</button><span id="wa-arq-nome" class="leve">' +
            (cel ? 'você escolhe ao tocar em “Abrir no WhatsApp”' : 'nenhum escolhido') + '</span></div></div>'
        : '') +
      '<div class="mb"><label class="rot" for="wa-tx">MENSAGEM</label>' +
        '<textarea class="campo alta" id="wa-tx" rows="6">' + esc(preencher(tpl, d)) + '</textarea>' +
        '<small class="leve">' + (prog ? 'A assinatura com o seu nome entra sozinha quando você enviar.' : '') +
          ' <button type="button" class="link" id="wa-modelo">Usar este texto como modelo</button></small></div>' +
      '<div class="acoes"><button type="button" class="b" data-fecha>Cancelar</button>' +
        '<button type="button" class="b pri" id="wa-ok">' + icone + 'Abrir no WhatsApp</button></div>', { larga: true });
    let arquivo = null;
    const btArq = m.querySelector('#wa-arq');
    if (btArq && prog) btArq.onclick = async () => {
      const a = await D.escolherArquivo({ tipo: d.tipo }).catch(() => null);
      if (!a) return;
      arquivo = a;
      m.querySelector('#wa-arq-nome').textContent = a.nome + ' · ' + tamanho(a.tamanho);
    };
    if (btArq && cel) btArq.remove();
    m.querySelector('#wa-modelo').onclick = () => {
      /* guarda o texto com os espaços {cliente}, {data}… no lugar dos valores */
      let t = m.querySelector('#wa-tx').value;
      if (d.clienteNome) t = t.split(d.clienteNome).join('{cliente}');
      if (d.titulo) t = t.split(' "' + d.titulo + '"').join('{titulo}');
      if (d.data) t = t.split(d.data).join('{data}');
      if (d.hora) t = t.split(' às ' + d.hora).join('{hora}');
      if (d.local) t = t.split('\n📍 ' + d.local).join('{local}');
      B7.pref.gravar(chaveModelo(d.tipo), t);
      B7.UI.toast('Modelo guardado. Os próximos envios já começam com ele.');
    };
    m.querySelector('#wa-ok').onclick = async () => {
      const g = m.querySelector('#wa-g').value.trim();
      let texto = m.querySelector('#wa-tx').value.trim();
      const bt = m.querySelector('#wa-ok');
      if (prog && !g) { m.querySelector('#wa-g').classList.add('erro'); m.querySelector('#wa-g').focus(); return; }
      if (prog && d.comArquivo && !arquivo) {
        const seguir = await B7.UI.confirmar({ titulo: 'Sem vídeo?', texto: 'Nenhum vídeo foi escolhido. Mandar só a mensagem?', rotulo: 'Só a mensagem' });
        if (!seguir) return;
      }
      bt.disabled = true;
      /* grupo novo ou trocado: guarda no cliente */
      if (d.clienteId && g && g !== grupo) { try { await B7.DB.atualizarCliente(d.clienteId, { whatsapp_grupo: g }); } catch (e) {} }
      let ok = false, aviso = '';
      try {
        if (prog) {
          location.hash = '#/whatsapp';
          const r = await D.enviar({ grupo: g, texto, caminho: arquivo ? arquivo.caminho : '', documento: true });
          ok = !!(r && r.ok);
          aviso = r && r.ok ? 'Confira no WhatsApp e aperte enviar.' :
            ((r && r.motivo) || 'Não consegui preparar sozinho.') + ' A mensagem ficou copiada: cole (Ctrl+V) no grupo.';
        } else if (cel) {
          const nome = primeiroNome();
          if (nome) texto = '*' + nome + ':*\n' + texto;
          const r = await B7.AppNativo.whatsCompartilhar(texto, !!d.comArquivo);
          ok = !!(r && r.ok);
          aviso = ok ? 'Escolha o grupo no WhatsApp e envie.' : 'Não consegui abrir o WhatsApp.';
        } else {
          const nome = primeiroNome();
          if (nome) texto = '*' + nome + ':*\n' + texto;
          try { await navigator.clipboard.writeText(texto); } catch (e) {}
          window.open('https://web.whatsapp.com/', '_blank', 'noopener');
          ok = true; aviso = 'Mensagem copiada. No grupo, cole com Ctrl+V.';
        }
      } catch (e) { aviso = (e && e.message) || 'Não deu para abrir o WhatsApp.'; }
      m.fechar();
      B7.UI.toast(aviso, ok ? {} : { tipo: 'erro' });
      if (ok || prog) {
        try {
          await B7.sb.rpc('whatsapp_registrar_envio', {
            p_tipo: d.tipo, p_ref_id: d.refId || null, p_cliente_id: d.clienteId || null, p_grupo: g,
            p_arquivo: arquivo ? arquivo.nome : '', p_texto: texto, p_demanda_id: d.demandaId || null
          });
        } catch (e) { /* o registro é só histórico: não atrapalha o envio */ }
      }
    };
  }
  const tamanho = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(b > 104857600 ? 0 : 1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  return { abrir, enviar, podeEnviar, icone, noPrograma: !!D };
})();
