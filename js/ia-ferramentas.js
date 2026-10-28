/* =====================================================================
   FERRAMENTAS DE IA (zzz267) — tarefa "extra" da b7-ia

     reuniao()           ata de reunião a partir de um áudio (gravar ou enviar)
     marca()             confere se um texto está na voz do cliente
     legenda(opcoes)     legendas + hashtags a partir da arte (imagem)
     riscos(alvo)        Gestão: o que olhar primeiro, escrito pela IA
     ajustesTarefas(o)   comentário do cliente → lista de tarefas
     pedidoPerguntas(o)  portal: o que falta no pedido do cliente
     demandasDaGravacao(id) roteiros da gravação → demandas de edição (revisar e criar)

   Nada é gravado sozinho: a pessoa lê, copia ou confirma.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.IAFerramentas = (function () {
  const esc = s => B7.UI.esc(s);
  const rico = (t, animar) => B7.IARico ? B7.IARico.html(t, { animar }) : '<p>' + esc(t).replace(/\n/g, '<br>') + '</p>';
  const ligada = () => !!(B7.IA && B7.IA.ligada && B7.IA.ligada('chat'));
  const pensando = frase => '<div class="iaf-pensa"><span class="iaf-orbe" aria-hidden="true"></span><b>' + esc(frase) + '</b></div>';
  const copiar = (t, msg) => B7.UI.copiarTexto(t, { msgSucesso: msg || 'Copiado', msgErro: 'Não foi possível copiar' });

  async function clientesOpcoes(sel) {
    let l = [];
    try { l = await B7.DB.listarClientes(); } catch (e) {}
    return '<option value="">' + (sel ? 'Escolha o cliente…' : 'Sem cliente (geral)') + '</option>' +
      (l || []).map(c => '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>').join('');
  }

  /* arquivo/URL de imagem → JPEG pequeno em base64 (máx. 1280px) */
  async function imagemBase64(fonte) {
    const url = typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte);
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = falha; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return { mime: 'image/jpeg', base64: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
    } finally { if (typeof fonte !== 'string') URL.revokeObjectURL(url); }
  }
  const arquivoBase64 = f => new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = falha; r.readAsDataURL(f); });

  /* ------------------------------------------------ resultado em modal */
  function janelaResultado(titulo, sub) {
    const m = B7.UI.modal('<h3>' + esc(titulo) + '</h3>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') +
      '<div class="iaf-saida"></div><div class="acoes"><button class="b" data-fecha>Fechar</button></div>', { larga: true, extra: 'iaf-modal' });
    return m;
  }

  /* ============================================================ REUNIÃO */
  async function reuniao() {
    const m = B7.UI.modal('<h3>Ata de reunião com IA</h3><p class="sub">Grave a reunião (ou envie o áudio) e a IA escreve o resumo, as decisões e as tarefas.</p>' +
      '<div class="mb"><label class="rot" for="iaf-cli">CLIENTE</label><select class="campo" id="iaf-cli"><option>Carregando…</option></select></div>' +
      '<div class="mb"><label class="rot" for="iaf-ass">ASSUNTO <small>(opcional)</small></label><input class="campo" id="iaf-ass" maxlength="120" placeholder="ex.: planejamento de novembro"></div>' +
      '<div class="iaf-grav"><button type="button" class="iaf-rec" data-rec aria-label="Gravar"><i></i></button>' +
        '<div><b data-rec-tx>Toque para gravar</b><small data-rec-sub>até 40 minutos · ou </small><label class="cb-link iaf-up">envie um áudio<input type="file" accept="audio/*" hidden data-up></label></div></div>' +
      '<div class="iaf-saida"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-gerar disabled>Gerar ata</button></div>', { larga: true, extra: 'iaf-modal' });
    m.querySelector('#iaf-cli').innerHTML = await clientesOpcoes(false);
    let audio = null, rec = null, pedacos = [], inicio = 0, relogio = null;
    const tx = m.querySelector('[data-rec-tx]'), sub = m.querySelector('[data-rec-sub]'), bt = m.querySelector('[data-rec]'), gerar = m.querySelector('[data-gerar]');
    const pronto = (blob, nome) => {
      if (blob.size > 6.6e6) { B7.UI.toast('Áudio grande demais (máx. ~6,5 MB). Grave por aqui: ele sai bem menor.', { tipo: 'erro' }); return; }
      audio = blob; gerar.disabled = false;
      tx.textContent = nome || 'Áudio pronto'; sub.textContent = (blob.size / 1e6).toFixed(1).replace('.', ',') + ' MB · ';
    };
    bt.onclick = async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tipo = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
        rec = new MediaRecorder(s, Object.assign({ audioBitsPerSecond: 24000 }, tipo ? { mimeType: tipo } : {}));
        pedacos = [];
        rec.ondataavailable = e => { if (e.data.size) pedacos.push(e.data); };
        rec.onstop = () => { clearInterval(relogio); s.getTracks().forEach(t => t.stop()); bt.classList.remove('on'); pronto(new Blob(pedacos, { type: rec.mimeType || 'audio/webm' }), 'Gravação pronta'); };
        rec.start(1000); inicio = Date.now(); bt.classList.add('on'); gerar.disabled = true;
        relogio = setInterval(() => {
          const s2 = Math.floor((Date.now() - inicio) / 1000);
          tx.textContent = 'Gravando… ' + Math.floor(s2 / 60) + ':' + String(s2 % 60).padStart(2, '0') + ' (toque para parar)';
          if (s2 >= 40 * 60) rec.stop();
        }, 500);
      } catch (e) { B7.UI.toast('Não consegui usar o microfone. Confira a permissão do navegador.', { tipo: 'erro' }); }
    };
    m.querySelector('[data-up]').onchange = e => { const f = e.target.files[0]; if (f) pronto(f, f.name); };
    gerar.onclick = async () => {
      if (!audio) return;
      const saida = m.querySelector('.iaf-saida');
      gerar.disabled = true; saida.innerHTML = pensando('Ouvindo a reunião e escrevendo a ata… pode levar até 2 minutos.');
      let r;
      try {
        r = await B7.IA.pedir('extra', { operacao: 'reuniao', cliente_id: m.querySelector('#iaf-cli').value || null,
          titulo: m.querySelector('#iaf-ass').value.trim(), mime: audio.type || 'audio/webm', audio: await arquivoBase64(audio) }, { prazo: 160000 });
      } catch (e) { r = { ok: false, mensagem: 'Não foi possível enviar o áudio.' }; }
      gerar.disabled = false;
      if (!r.ok) { saida.innerHTML = '<div class="iaf-erro">' + esc(r.categoria === 'sem_fala' ? 'Não encontrei fala nesse áudio.' : (r.mensagem || 'Não deu para gerar agora.')) + '</div>'; return; }
      saida.innerHTML = rico(r.texto, true) + '<div class="iaf-bts"><button type="button" class="b fina contorno" data-cp>Copiar a ata</button></div>';
      saida.querySelector('[data-cp]').onclick = () => copiar(B7.IARico ? B7.IARico.texto(r.texto) : r.texto, 'Ata copiada');
    };
    return m;
  }

  /* ============================================================== MARCA */
  async function marca(opcoes = {}) {
    const m = B7.UI.modal('<h3>Revisar na voz da marca</h3><p class="sub">Cole um texto (legenda, roteiro, mensagem) e a IA confere se está no tom do cliente.</p>' +
      '<div class="mb"><label class="rot" for="iaf-cli">CLIENTE</label><select class="campo" id="iaf-cli"><option>Carregando…</option></select></div>' +
      '<div class="mb"><label class="rot" for="iaf-tx">TEXTO</label><textarea class="campo" id="iaf-tx" rows="6" maxlength="4000" placeholder="Cole aqui o texto"></textarea></div>' +
      '<div class="iaf-saida"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-gerar>Revisar</button></div>', { larga: true, extra: 'iaf-modal' });
    const sel = m.querySelector('#iaf-cli'); sel.innerHTML = await clientesOpcoes(true);
    if (opcoes.clienteId) sel.value = opcoes.clienteId;
    if (opcoes.texto) m.querySelector('#iaf-tx').value = opcoes.texto;
    const gerar = m.querySelector('[data-gerar]');
    gerar.onclick = async () => {
      const texto = m.querySelector('#iaf-tx').value.trim();
      if (!sel.value) return B7.UI.toast('Escolha o cliente', { tipo: 'erro' });
      if (texto.length < 3) return B7.UI.toast('Cole o texto para revisar', { tipo: 'erro' });
      const saida = m.querySelector('.iaf-saida');
      gerar.disabled = true; saida.innerHTML = pensando('Lendo com os olhos da marca…');
      const r = await B7.IA.pedir('extra', { operacao: 'marca', cliente_id: sel.value, texto });
      gerar.disabled = false; gerar.textContent = 'Revisar de novo';
      if (!r.ok) { saida.innerHTML = '<div class="iaf-erro">' + esc(r.mensagem || 'Não deu para revisar agora.') + '</div>'; return; }
      const sugerida = (String(r.texto).split(/>\s*📌\s*Versão sugerida:?/i)[1] || '').replace(/^\s*>?\s?/gm, '').trim();
      saida.innerHTML = rico(r.texto, true) + '<div class="iaf-bts">' +
        (sugerida ? '<button type="button" class="b fina pri" data-cps>Copiar a versão sugerida</button>' : '') +
        '<button type="button" class="b fina contorno" data-cp>Copiar tudo</button></div>';
      const cs = saida.querySelector('[data-cps]'); if (cs) cs.onclick = () => copiar(B7.IARico ? B7.IARico.texto(sugerida) : sugerida, 'Versão sugerida copiada');
      saida.querySelector('[data-cp]').onclick = () => copiar(B7.IARico ? B7.IARico.texto(r.texto) : r.texto);
    };
    return m;
  }

  /* ============================================================ LEGENDA */
  async function legenda(opcoes = {}) {
    const m = B7.UI.modal('<h3>Legenda a partir da arte</h3><p class="sub">A IA olha a arte, segue o tom do cliente e sugere legendas com hashtags.</p>' +
      '<div class="mb"><label class="rot" for="iaf-cli">CLIENTE</label><select class="campo" id="iaf-cli"><option>Carregando…</option></select></div>' +
      '<div class="iaf-arte"><div class="iaf-arte-img" data-prev>' + (opcoes.imagemUrl ? '<img alt="Arte" src="' + esc(opcoes.imagemUrl) + '">' : '<span>Sem arte</span>') + '</div>' +
        '<div><label class="b fina contorno iaf-up">' + (opcoes.imagemUrl ? 'Trocar a arte' : 'Escolher a arte') + '<input type="file" accept="image/png,image/jpeg,image/webp" hidden data-up></label>' +
        '<label class="rot" for="iaf-tema" style="margin-top:10px;display:block">TEMA / CONTEXTO <small>(opcional)</small></label>' +
        '<textarea class="campo" id="iaf-tema" rows="3" maxlength="1000" placeholder="ex.: promoção de sexta, 20% em todos os óculos">' + esc(opcoes.tema || '') + '</textarea></div></div>' +
      '<div class="iaf-saida"></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button><button class="b pri" data-gerar>Gerar legendas</button></div>', { larga: true, extra: 'iaf-modal' });
    const sel = m.querySelector('#iaf-cli'); sel.innerHTML = await clientesOpcoes(true);
    if (opcoes.clienteId) sel.value = opcoes.clienteId;
    let fonte = opcoes.imagemUrl || null;
    m.querySelector('[data-up]').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      fonte = f; m.querySelector('[data-prev]').innerHTML = '<img alt="Arte" src="' + URL.createObjectURL(f) + '">';
    };
    const gerar = m.querySelector('[data-gerar]');
    gerar.onclick = async () => {
      const tema = m.querySelector('#iaf-tema').value.trim();
      if (!sel.value) return B7.UI.toast('Escolha o cliente', { tipo: 'erro' });
      if (!fonte && tema.length < 3) return B7.UI.toast('Escolha a arte ou escreva o tema', { tipo: 'erro' });
      const saida = m.querySelector('.iaf-saida');
      gerar.disabled = true; saida.innerHTML = pensando('Olhando a arte e escrevendo…');
      let imagem = null;
      if (fonte) { try { imagem = await imagemBase64(fonte); } catch (e) { saida.innerHTML = '<div class="iaf-erro">Não consegui abrir essa imagem.</div>'; gerar.disabled = false; return; } }
      const r = await B7.IA.pedir('extra', { operacao: 'legenda', cliente_id: sel.value, texto: tema, imagem });
      gerar.disabled = false; gerar.textContent = 'Gerar outras';
      if (!r.ok) { saida.innerHTML = '<div class="iaf-erro">' + esc(r.mensagem || 'Não deu para gerar agora.') + '</div>'; return; }
      saida.innerHTML = '<div class="iaf-legs">' + (r.itens || []).map((x, i) =>
        '<article class="iaf-leg" style="--i:' + i + '"><div class="iaf-leg-cab"><b>' + esc(x.titulo || ('Opção ' + (i + 1))) + '</b>' +
          '<button type="button" class="b fina pri" data-cpl="' + i + '">Copiar</button></div>' +
          '<p>' + esc(x.legenda).replace(/\n/g, '<br>') + '</p>' + (x.hashtags ? '<p class="iaf-tags">' + esc(x.hashtags) + '</p>' : '') + '</article>').join('') + '</div>';
      saida.querySelectorAll('[data-cpl]').forEach(b => b.onclick = () => { const x = r.itens[+b.dataset.cpl]; copiar(x.legenda + (x.hashtags ? '\n\n' + x.hashtags : ''), 'Legenda copiada'); });
    };
    return m;
  }

  /* ============================================================= RISCOS */
  async function riscos(alvo) {
    if (!alvo) return;
    alvo.innerHTML = '<div class="iaf-bloco">' + pensando('Lendo a saúde dos clientes…') + '</div>';
    const r = await B7.IA.pedir('extra', { operacao: 'riscos' });
    if (!alvo.isConnected) return;
    if (!r.ok) { alvo.innerHTML = '<div class="iaf-bloco"><div class="iaf-erro">' + esc(r.mensagem || 'Não deu para analisar agora.') + '</div></div>'; return; }
    alvo.innerHTML = '<div class="iaf-bloco"><div class="iaf-bloco-cab"><span class="iaf-selo">✨ Análise da IA</span><button type="button" class="cb-link" data-cp>Copiar</button></div>' + rico(r.texto, true) + '</div>';
    alvo.querySelector('[data-cp]').onclick = () => copiar(B7.IARico ? B7.IARico.texto(r.texto) : r.texto);
  }

  /* ===================================================== AJUSTES → TAREFAS */
  async function ajustesTarefas({ titulo, texto, aoConfirmar }) {
    const m = janelaResultado('Transformar ajustes em tarefas', 'A IA leu o que o cliente pediu e separou em tarefas. Desmarque o que não quiser.');
    const saida = m.querySelector('.iaf-saida');
    saida.innerHTML = pensando('Lendo os comentários do cliente…');
    const r = await B7.IA.pedir('extra', { operacao: 'ajustes', titulo, texto });
    if (!r.ok) { saida.innerHTML = '<div class="iaf-erro">' + esc(r.mensagem || 'Não deu para gerar agora.') + '</div>'; return; }
    const itens = r.itens || [];
    if (!itens.length) { saida.innerHTML = '<div class="iaf-erro">A IA não encontrou pedidos claros nesses comentários.</div>'; return; }
    saida.innerHTML = (r.resumo ? rico('> 💡 ' + r.resumo) : '') +
      '<ul class="iaf-tarefas">' + itens.map((t, i) => '<li style="--i:' + i + '"><label><input type="checkbox" checked data-t="' + i + '"><span>' + esc(t) + '</span></label></li>').join('') + '</ul>' +
      '<div class="iaf-bts">' + (aoConfirmar ? '<button type="button" class="b fina pri" data-add>Adicionar como notas internas</button>' : '') +
      '<button type="button" class="b fina contorno" data-cp>Copiar lista</button></div>';
    const marcadas = () => [...saida.querySelectorAll('[data-t]:checked')].map(c => itens[+c.dataset.t]);
    saida.querySelector('[data-cp]').onclick = () => copiar(marcadas().map(t => '☐ ' + t).join('\n'), 'Lista copiada');
    const add = saida.querySelector('[data-add]');
    if (add) add.onclick = async () => {
      const l = marcadas(); if (!l.length) return;
      add.disabled = true; add.textContent = 'Adicionando…';
      try { await aoConfirmar(l); m.fechar(); B7.UI.toast(l.length + (l.length === 1 ? ' tarefa adicionada' : ' tarefas adicionadas') + ' nas notas'); }
      catch (e) { add.disabled = false; add.textContent = 'Adicionar como notas internas'; B7.UI.toast(e.message || 'Não foi possível adicionar.', { tipo: 'erro' }); }
    };
  }

  /* ============================================ DEMANDAS DE EDIÇÃO (zzz277)
     A IA lê os roteiros da gravação e propõe uma demanda por roteiro:
     título curto e o resumo para quem edita. O prazo nasce da data da
     gravação + 3 dias úteis. A pessoa revisa tudo e confirma; roteiro que
     já tem demanda não entra (o banco também confere). */
  const podeDemandas = () => ligada() && !!(B7.Perm && B7.Perm.podeRota && B7.Perm.podeRota('video')) && (!B7.Perm.pode || B7.Perm.pode('video.criar'));
  function diasUteis(iso, n) {
    const d = new Date((iso || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
    while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  async function demandasDaGravacao(gravacaoId, aoCriar) {
    const m = B7.UI.modal('<h3>✨ Demandas de edição com IA</h3>' +
      '<p class="sub">A IA leu os roteiros desta gravação e preparou uma demanda para cada vídeo. Confira, ajuste o que quiser e confirme — nada é criado antes disso.</p>' +
      '<div class="iaf-saida"></div><div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-criar disabled>Criar demandas</button></div>',
      { larga: true, extra: 'iaf-modal' });
    const saida = m.querySelector('.iaf-saida'), btCriar = m.querySelector('[data-criar]');
    saida.innerHTML = pensando('Lendo os roteiros da gravação…');
    let g, rots, existentes, vms;
    try {
      [g, rots, existentes, vms] = await Promise.all([B7.DB.gravacao(gravacaoId), B7.DB.listarRoteiros(gravacaoId),
        B7.DB.demandasDaGravacaoVideo(gravacaoId).catch(() => []), B7.DB.listarVideomakers().catch(() => [])]);
    } catch (e) { saida.innerHTML = '<div class="iaf-erro">Não consegui abrir esta gravação.</div>'; return; }
    rots = (rots || []).filter(r => !r.deleted_at && !r.archived_at);
    if (!rots.length) { saida.innerHTML = '<div class="iaf-erro">Esta gravação ainda não tem roteiros.</div>'; return; }
    const jaTem = new Map((existentes || []).filter(d => d.roteiro_id).map(d => [d.roteiro_id, d]));
    if (rots.every(r => jaTem.has(r.id))) { saida.innerHTML = '<div class="iaf-erro">Todos os roteiros desta gravação já têm demanda de edição.</div>'; return; }
    const r = await B7.IA.pedir('extra', { operacao: 'demandas', ref_id: gravacaoId }, { prazo: 100000 });
    if (!m.isConnected) return;
    if (!r.ok) { saida.innerHTML = '<div class="iaf-erro">' + esc(r.mensagem || 'Não deu para ler os roteiros agora.') + '</div>'; return; }
    const daIA = new Map((r.itens || []).map(x => [x.roteiro_id, x]));
    const prazo = diasUteis(g.data_gravacao, 3);
    const itens = rots.map(rt => {
      const x = daIA.get(rt.id) || {};
      return { roteiro_id: rt.id, original: rt.titulo || 'Sem título', titulo: x.titulo || rt.titulo || g.nome, resumo: x.resumo || '', prazo, existe: jaTem.get(rt.id) };
    });
    saida.innerHTML =
      '<div class="iaf-dm-topo"><span>🎬 <b>' + esc(g.nome) + '</b>' + (g.data_gravacao ? ' · gravada em ' + esc(B7.UI.dataBR(g.data_gravacao)) : '') + '</span>' +
        '<label>Quem edita <select class="campo fina" data-vm><option value="">Ninguém ainda</option>' +
          (vms || []).map(v => '<option value="' + esc(v.id) + '"' + (v.id === g.videomaker_id ? ' selected' : '') + '>' + esc(v.nome) + '</option>').join('') + '</select></label></div>' +
      '<div class="iaf-dms">' + itens.map((it, i) => it.existe
        ? '<div class="iaf-dm feito" style="--i:' + i + '"><span class="iaf-dm-ja">já tem demanda' + (it.existe.codigo ? ' ' + esc(it.existe.codigo) : '') + '</span><b>' + esc(it.original) + '</b></div>'
        : '<div class="iaf-dm" style="--i:' + i + '" data-i="' + i + '">' +
            '<label class="iaf-dm-cab"><input type="checkbox" checked data-on><small>Roteiro: ' + esc(it.original) + '</small></label>' +
            '<input class="campo" data-tit maxlength="120" value="' + esc(it.titulo) + '" aria-label="Título da demanda">' +
            '<textarea class="campo" data-res rows="4" maxlength="2000" placeholder="Resumo para quem edita" aria-label="Resumo para quem edita">' + esc(it.resumo) + '</textarea>' +
            '<label class="iaf-dm-prazo">Prazo <input class="campo fina" type="date" data-prz value="' + esc(it.prazo) + '"></label>' +
          '</div>').join('') + '</div>' +
      '<p class="ajuda">Prazo sugerido: 3 dias úteis depois da gravação. O resumo vai nas observações da demanda.</p>';
    const contar = () => {
      const n = saida.querySelectorAll('[data-on]:checked').length;
      btCriar.disabled = !n; btCriar.textContent = n === 1 ? 'Criar 1 demanda' : 'Criar ' + n + ' demandas';
    };
    saida.querySelectorAll('[data-on]').forEach(c => c.onchange = () => { c.closest('.iaf-dm').classList.toggle('fora', !c.checked); contar(); });
    contar();
    btCriar.onclick = async () => {
      const lista = [...saida.querySelectorAll('.iaf-dm[data-i]')].filter(el => el.querySelector('[data-on]').checked).map(el => ({
        roteiro_id: itens[+el.dataset.i].roteiro_id, titulo: el.querySelector('[data-tit]').value.trim(),
        resumo: el.querySelector('[data-res]').value.trim(), prazo: el.querySelector('[data-prz]').value || null
      }));
      if (!lista.length) return;
      btCriar.disabled = true; btCriar.textContent = 'Criando…';
      try {
        const res = await B7.DB.criarDemandasIAVideo(gravacaoId, lista, saida.querySelector('[data-vm]').value || null);
        const novas = (res || []).filter(x => !x.ja_existia).length, ja = (res || []).length - novas;
        m.fechar();
        B7.UI.toast((novas === 1 ? '1 demanda de edição criada' : novas + ' demandas de edição criadas') + (ja ? ' · ' + ja + ' já existia' + (ja === 1 ? '' : 'm') : '') + '.',
          { acao: 'Ver na Edição de vídeo', aoClicar: () => { location.hash = '#/video'; } });
        if (aoCriar) aoCriar(res);
      } catch (e) { contar(); B7.UI.toast((e && e.message) || 'Não foi possível criar.', { tipo: 'erro' }); }
    };
  }

  /* ===================================================== PEDIDO (portal) */
  async function pedidoPerguntas({ clienteId, tipo, titulo, texto }) {
    return B7.IA.pedir('extra', { operacao: 'pedido', cliente_id: clienteId, tipo, titulo, texto });
  }

  return { ligada, reuniao, marca, legenda, riscos, ajustesTarefas, pedidoPerguntas, demandasDaGravacao, podeDemandas };
})();
