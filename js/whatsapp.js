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
  if (D && D.aoNaoLidas) D.aoNaoLidas(n => {
    naoLidas = +n || 0; pintarContagem();
    const el = document.getElementById('wa-nl');
    if (el) { el.hidden = !naoLidas; el.textContent = naoLidas + (naoLidas === 1 ? ' não lida' : ' não lidas'); }
  });
  /* clicou no aviso de mensagem do WhatsApp: vem para a tela dele */
  if (D && D.aoIr) D.aoIr(() => { if (location.hash.indexOf('#/whatsapp') !== 0) location.hash = '#/whatsapp'; });
  /* o menu lateral é redesenhado às vezes: recoloca o número */
  addEventListener('hashchange', () => setTimeout(pintarContagem, 200));

  /* --------------------------------------------- a tela #/whatsapp */
  /* zzz172: se algo der errado, a tela DIZ o quê (antes ficava parada na
     tela anterior, sem nenhum sinal) */
  async function abrir() {
    try { await abrirTela(); }
    catch (e) {
      const painel = document.getElementById('painel-dashboard');
      if (painel) painel.innerHTML = '<div class="conteudo entra wa-fora">' + icone + '<h1>WhatsApp</h1>' +
        '<p>Não consegui abrir o WhatsApp agora.</p><p class="leve"><code>' + esc((e && e.message) || String(e)) + '</code></p>' +
        '<div class="acoes"><button type="button" class="b pri" onclick="location.reload()">Recarregar</button></div></div>';
    }
  }
  async function abrirTela() {
    const painel = document.getElementById('painel-dashboard');
    if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp']);
    if (!D) return telaFora(painel);
    /* o programa pode demorar a responder: não espera mais que 2 s */
    const cfg = await Promise.race([D.config().catch(() => ({})), new Promise(r => setTimeout(() => r({}), 2000))]) || {};
    if (!cfg.nome) { cfg.nome = primeiroNome(); D.definirConfig({ nome: cfg.nome }); }
    const extras = !!(D.zoom && D.desconectar);
    painel.innerHTML = '<div class="wa-tela">' +
      '<div class="wa-barra">' +
        '<span class="wa-tit">' + icone + '<b>WhatsApp</b><i class="wa-nl" id="wa-nl"' + (naoLidas ? '' : ' hidden') + '>' + naoLidas + ' não lidas</i></span>' +
        '<div class="wa-assin' + (cfg.assinatura !== false ? ' on' : '') + '" id="wa-assin">' +
          '<button type="button" class="wa-chave" id="wa-ass" role="switch" aria-checked="' + (cfg.assinatura !== false) + '" title="Assinar as mensagens com o seu nome"><i></i></button>' +
          '<span class="wa-assin-rot">Assinatura</span>' +
          '<span class="wa-assin-ex"><b>*</b><input id="wa-nome" maxlength="40" value="' + esc(cfg.nome || '') + '" placeholder="Seu nome" aria-label="Nome da assinatura" size="8"><b>:*</b></span>' +
          '<span class="wa-prev" id="wa-prev"></span>' +
        '</div>' +
        '<div class="wa-ferr">' +
          (B7.Chat ? '<button type="button" class="wa-ic wa-ia" id="wa-ia" title="Assistente do B7" aria-label="Abrir o assistente">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9z"/><path d="M18.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg></button>' : '') +
          (extras ? '<button type="button" class="wa-ic" id="wa-menos" title="Letra menor" aria-label="Letra menor">A−</button>' +
                    '<button type="button" class="wa-ic" id="wa-mais" title="Letra maior" aria-label="Letra maior">A+</button>' : '') +
          '<button type="button" class="wa-ic" id="wa-recarregar" title="Recarregar o WhatsApp" aria-label="Recarregar o WhatsApp">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg></button>' +
          (extras ? '<button type="button" class="wa-ic" id="wa-sair" title="Desconectar este WhatsApp do programa" aria-label="Desconectar">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16l-4-4 4-4M6 12h9"/></svg></button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="wa-area" id="wa-area"><div class="wa-espera">' + icone + '<b>WhatsApp</b><span>Carregando…</span></div></div>' +
    '</div>';
    const caixa = painel.querySelector('#wa-assin'), cb = painel.querySelector('#wa-ass'), nome = painel.querySelector('#wa-nome'), prev = painel.querySelector('#wa-prev');
    const ligada = () => caixa.classList.contains('on');
    const previa = () => {
      nome.size = Math.max(4, Math.min(18, (nome.value || nome.placeholder).length));
      prev.innerHTML = ligada() && nome.value.trim() ? 'sai como <b>' + esc(nome.value.trim()) + ':</b>' : 'desligada';
    };
    const salvar = () => { D.definirConfig({ nome: nome.value.trim(), assinatura: ligada() }); previa(); };
    cb.onclick = () => { caixa.classList.toggle('on'); cb.setAttribute('aria-checked', String(ligada())); salvar(); };
    nome.oninput = previa; nome.onchange = salvar;
    nome.onkeydown = e => { if (e.key === 'Enter') { nome.blur(); salvar(); } };
    const btIa = painel.querySelector('#wa-ia');
    if (btIa) btIa.onclick = () => B7.Chat.abrir();
    painel.querySelector('#wa-recarregar').onclick = () => D.recarregar && D.recarregar();
    if (extras) {
      painel.querySelector('#wa-menos').onclick = () => D.zoom(-1);
      painel.querySelector('#wa-mais').onclick = () => D.zoom(+1);
      painel.querySelector('#wa-sair').onclick = async () => {
        const ok = await B7.UI.confirmar({ titulo: 'Desconectar o WhatsApp?', texto: 'O WhatsApp sai deste programa (as conversas continuam no celular). Para usar de novo, é só ler o QR Code.', rotulo: 'Desconectar', perigo: true });
        if (ok) D.desconectar();
      };
    }
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
  /* zzz173: confere uma GRADE de pontos (antes eram só o centro e os
     cantos): os menus do topo (Criar, avisos, conta) caem só na faixa de
     cima e passavam despercebidos — ficavam cortados atrás do WhatsApp */
  function coberta(area, r) {
    const pts = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++)
      pts.push([r.left + 8 + (r.width - 16) * i / 7, r.top + 6 + (r.height - 12) * j / 5]);
    const grandes = new Set();
    /* botão flutuante, aviso (toast) e dica pequena não contam: só o que é
       grande de verdade (janela, menu, painel) esconde o WhatsApp */
    return pts.some(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return true;
      if (area.contains(el)) return false;
      let c = el;
      while (c && c !== document.body && !c.contains(area)) {
        if (grandes.has(c)) return true;
        const b = c.getBoundingClientRect();
        if (b.width >= 140 && b.height >= 90) { grandes.add(c); return true; }
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
      if (!escondido) {
        escondido = true; ultimoRet = '';
        if (fora || !D.foto) {
          /* programa antigo (até 1.0.17): ele mesmo tira a foto e some */
          Promise.resolve(D.esconder(!fora)).then(f => porFoto(f)).catch(() => {});
        } else {
          /* zzz175: SEM PISCADA — primeiro a foto entra no lugar (já pronta
             na tela), só depois o WhatsApp sai da frente. Antes ele sumia
             primeiro e a foto chegava um instante depois (o "piscar"). */
          const usar = f => porFoto(f).then(() => { if (escondido) D.esconder(false); });
          if (fotoPronta && Date.now() - fotoPronta.em < 4000) usar(fotoPronta.f);
          else Promise.race([D.foto(), new Promise(r => setTimeout(() => r(null), 400))]).then(usar, () => usar(null));
        }
      }
      return;
    }
    const ret = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
    if (ret === ultimoRet && !escondido) return;
    ultimoRet = ret; escondido = false;
    setTimeout(() => { const a = document.getElementById('wa-area'); if (a && !escondido) { a.classList.remove('com-foto'); a.style.backgroundImage = ''; } }, 120);
    D.mostrar({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  }
  /* foto do WhatsApp posta como fundo da área; espera a imagem estar
     decodificada para a troca ser instantânea */
  let fotoPronta = null;
  function porFoto(f) {
    const a = document.getElementById('wa-area');
    if (!a || typeof f !== 'string' || !f.startsWith('data:image') || !escondido) return Promise.resolve();
    const img = new Image(); img.src = f;
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
      if (!escondido) return;
      a.style.backgroundImage = 'url("' + f + '")'; a.classList.add('com-foto');
    });
  }
  /* o mouse chegou ao topo (onde ficam Criar, avisos e conta): já deixa
     uma foto pronta, para o menu abrir sem esperar nada */
  function preFoto() {
    if (!ativo || escondido || !D || !D.foto) return;
    if (fotoPronta && Date.now() - fotoPronta.em < 1500) return;
    D.foto().then(f => { if (f) fotoPronta = { f, em: Date.now() }; }).catch(() => {});
  }
  function ligar() {
    const topoG = document.querySelector('#tela-dashboard .topo');
    if (topoG && !topoG._waFoto) { topoG._waFoto = true; topoG.addEventListener('pointerenter', preFoto); }
    document.body.classList.add('wa-aberta');
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
    document.body.classList.remove('wa-aberta'); fotoPronta = null;
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
