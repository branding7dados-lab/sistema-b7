/* =====================================================================
   WHATSAPP DO B7 (4.52.0) — "Enviar no WhatsApp" pelo Evolution API

   O WhatsApp Web que rodava dentro do programa saiu. A tela #/whatsapp é
   a Central de Conversas (js/central-wa.js) e os botões "Enviar no
   WhatsApp" do sistema (Design, Edição de vídeo, Aprovações, Projetos,
   Gravações) chamam B7.WhatsApp.enviar(d), que manda DIRETO para a
   conversa do cliente pela Edge Function wa-evolution:
     • escolhe a conversa ligada ao cliente (ou qualquer outra);
     • texto a partir do modelo do tipo (guardável);
     • arte do Design: as artes da versão mais nova vão junto, sozinhas;
     • vídeo: escolhido do computador/celular (até 95 MB) ou só o link;
     • a assinatura *Nome:* entra na mensagem.
   Fica registrado em whatsapp_envios (whatsapp_registrar_envio).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WhatsApp = (function () {
  const esc = s => B7.UI.esc(s);
  const icone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.8-.6.3-1.4.4-2.4 0a9 9 0 0 1-4.9-4.9c-.4-1-.3-1.8 0-2.5z"/></svg>';
  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
  const primeiroNome = () => String(eu().nome || eu().username || '').trim().split(/\s+/)[0] || '';
  /* quem pode mandar pelo WhatsApp do B7: administrador e videomakers (o banco confere de novo) */
  let podeCache = null;
  function podeEnviar() {
    const u = eu(); if (!u.id || u.papel === 'cliente') return false;
    if (podeCache != null) return podeCache;
    const adm = B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin());
    const vm = (B7.Auth.funcao && B7.Auth.funcao() === 'videomaker') || (B7.Auth.funcoesExtra && (B7.Auth.funcoesExtra() || []).includes('videomaker')) ||
      (Array.isArray(u.funcoes_adicionais) && u.funcoes_adicionais.includes('videomaker'));
    /* 4.84.0: quem vê algum número do WhatsApp (designer, coordenador…) também envia — pelo número da sua equipe */
    const nums = B7.WaNumeros ? B7.WaNumeros.lista() : [];
    if (B7.WaNumeros && !nums.length && !podeEnviar._pediu) { podeEnviar._pediu = true; B7.WaNumeros.carregar().then(l => { if (l.length) podeCache = null; }); }
    podeCache = !!(adm || vm || nums.length);
    return podeCache;
  }
  addEventListener('hashchange', () => { podeCache = null; });

  /* ------------------------------------------------ modelos de texto */
  const MODELOS = {
    video: 'Olá, {cliente}! 🎬\nSegue o vídeo{titulo} para vocês conferirem. Qualquer ajuste, é só nos falar por aqui.',
    design: 'Olá, {cliente}! 🎨\nSegue a arte{titulo} para vocês conferirem. Qualquer ajuste, é só nos falar por aqui.',
    gravacao: 'Olá, {cliente}! 🎥\nPassando para confirmar a nossa gravação:\n📅 {data}{hora}{local}\nQualquer mudança, nos avise por aqui. Até lá!',
    aprovacao: 'Olá, {cliente}! ✅\nTem material novo esperando a aprovação de vocês{titulo}:\n👉 {link}\nÉ só abrir, aprovar ou pedir ajuste por lá. Qualquer dúvida, estamos aqui!',
    roteiro: 'Olá, {cliente}! 📝\nSegue o roteiro{titulo} para vocês conferirem:\n\n{texto}\n\nEstando tudo certo, é só responder "aprovado" por aqui. Qualquer ajuste, nos fale!',
    material: 'Olá, {cliente}! 📂\nPara seguirmos com{titulo}, precisamos do material gravado. Pode subir os arquivos nesta pasta do Drive?{link}\nAssim que chegar, a edição começa. Obrigado!'
  };
  const chaveModelo = t => 'wa_modelo_' + t;
  function preencher(tpl, d) {
    return tpl
      .replace(/\{cliente\}/g, d.clienteNome || '')
      .replace(/\{titulo\}/g, d.titulo ? ' "' + d.titulo + '"' : '')
      .replace(/\{data\}/g, d.data || '')
      .replace(/\{hora\}/g, d.hora ? ' às ' + d.hora : '')
      .replace(/\{local\}/g, d.local ? '\n📍 ' + d.local : '')
      .replace(/\{link\}/g, d.tipo === 'material' ? (d.link ? '\n👉 ' + d.link : '') : (d.link || ''))
      .replace(/\{texto\}/g, d.texto || '');
  }
  function assinatura() {
    let cfg = {}; try { cfg = B7.pref.ler('wa_cfg', {}) || {}; } catch (e) {}
    if (cfg.assinatura === false) return '';
    const nome = (cfg.nome || primeiroNome()).trim();
    return nome ? '*' + nome + ':*\n' : '';
  }
  const tamanho = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  /* artes da última versão enviada da peça (prévias e finais, sem repetir) */
  async function arquivosDesign(id) {
    try {
      const { data: vs } = await B7.sb.from('design_versoes').select('id,numero,estado').eq('deliverable_id', id).neq('estado', 'rascunho').order('numero', { ascending: false }).limit(1);
      if (!vs || !vs.length) return [];
      const { data } = await B7.sb.from('design_arquivos').select('nome_original,caminho,papel,posicao,parte_posicao,mime').eq('versao_id', vs[0].id).in('papel', ['preview', 'final', 'anexo']);
      const peso = { final: 0, anexo: 1, preview: 2 };
      const base = n => String(n || '').replace(/\.[^.]+$/, '').toLowerCase();
      const l = (data || []).filter(a => a.caminho && /^(image|video)\/|pdf/.test(a.mime || '')).sort((a, b) => peso[a.papel] - peso[b.papel]);
      const vistos = new Set(), r = [];
      l.forEach(a => { const k = base(a.nome_original); if (!vistos.has(k)) { vistos.add(k); r.push(a); } });
      return r.sort((a, b) => (a.parte_posicao || 0) - (b.parte_posicao || 0) || String(a.nome_original).localeCompare(String(b.nome_original), 'pt', { numeric: true }));
    } catch (e) { return []; }
  }

  /* ----------------------------------------- "Enviar ao cliente" */
  async function enviar(d) {
    const nums = B7.WaNumeros ? await B7.WaNumeros.carregar() : [];
    podeCache = null;
    if (!podeEnviar()) { B7.UI.toast('Sua equipe ainda não tem um número de WhatsApp no B7. Peça a um administrador.'); return; }
    let todas = [];
    try { todas = (await B7.sb.from('wa_conversas').select('numero_id,jid,nome,tipo,cliente_id,ultima_em').order('ultima_em', { ascending: false, nullsFirst: false }).limit(600)).data || []; } catch (e) {}
    /* 4.84.0: começa no número da equipe de quem envia (designer → Designers); com 2+ números dá para trocar */
    let numSel = (B7.WaNumeros && B7.WaNumeros.daPessoa(eu(), nums) || {}).id || null;
    if (numSel && !todas.some(c => c.numero_id === numSel)) { const outro = nums.find(n => todas.some(c => c.numero_id === n.id)); if (outro) numSel = outro.id; }
    let conversas = numSel ? todas.filter(c => c.numero_id === numSel) : todas;
    if (!conversas.length) {
      const ok = await B7.UI.confirmar({ titulo: 'O WhatsApp do B7 ainda não tem conversas', texto: 'Conecte o número e puxe as conversas na tela do WhatsApp (menu ⋮). Abrir agora?', confirmar: 'Abrir o WhatsApp' });
      if (ok) location.hash = '#/whatsapp';
      return;
    }
    let dele = d.clienteId ? conversas.filter(c => c.cliente_id === d.clienteId) : [];
    let jid = dele.length ? dele[0].jid : '';
    const tpl = B7.pref.ler(chaveModelo(d.tipo), MODELOS[d.tipo] || '');
    const artes = d.tipo === 'design' && d.refId ? await arquivosDesign(d.refId) : [];
    const pedeArquivo = d.tipo === 'video' || (d.tipo === 'design' && !artes.length) || d.comArquivo;
    const titulo = { roteiro: 'Enviar o roteiro', material: 'Pedir o material', gravacao: 'Avisar a gravação', aprovacao: 'Avisar a aprovação', design: 'Enviar a arte', video: 'Enviar o vídeo' }[d.tipo] || 'Enviar no WhatsApp';
    const opcao = c => '<option value="' + esc(c.jid) + '"' + (c.jid === jid ? ' selected' : '') + '>' + esc(c.nome || c.jid.split('@')[0]) + (c.tipo === 'grupo' ? ' · grupo' : '') + '</option>';
    const opcoes = () => (dele.length ? '<optgroup label="Deste cliente">' + dele.map(opcao).join('') + '</optgroup>' : '<option value="">Escolha a conversa…</option>') +
        '<optgroup label="Todas as conversas">' + conversas.filter(c => !dele.includes(c)).map(opcao).join('') + '</optgroup>';
    const m = B7.UI.modal('<h3>' + esc(titulo) + ' no WhatsApp</h3>' +
      '<p class="sub">Vai <b>direto</b> pelo WhatsApp do B7, com a sua assinatura. Confira a conversa e o texto antes de enviar.</p>' +
      (nums.length > 1 ? '<div class="mb"><label class="rot" for="wae-n">ENVIAR PELO NÚMERO</label><select class="campo" id="wae-n">' +
        nums.map(n => '<option value="' + esc(n.id) + '"' + (n.id === numSel ? ' selected' : '') + '>' + esc(n.nome) + '</option>').join('') + '</select></div>' : '') +
      '<div class="mb"><label class="rot" for="wae-c">CONVERSA</label><select class="campo" id="wae-c">' + opcoes() + '</select>' +
        (!dele.length && d.clienteId ? '<small class="leve">Este cliente ainda não tem conversa ligada — a escolhida aqui fica ligada a ele.</small>' : '') + '</div>' +
      (artes.length ? '<div class="mb"><label class="rot">' + (artes.length > 1 ? artes.length + ' ARTES' : 'ARTE') + ' · VERSÃO MAIS NOVA</label><div class="wa-artes">' +
        artes.map((a, i) => '<label class="wa-arte" title="' + esc(a.nome_original || '') + '"><input type="checkbox" data-arte="' + i + '" checked><span>' + esc(a.nome_original || 'arte') + '</span></label>').join('') + '</div></div>' : '') +
      (pedeArquivo ? '<div class="mb"><label class="rot">' + (d.tipo === 'design' ? 'ARTE' : d.tipo === 'video' ? 'VÍDEO' : 'ARQUIVO') + ' <em>opcional</em></label><div class="wa-arq">' +
        '<button type="button" class="b contorno" id="wae-arq">Escolher do computador…</button><span id="wae-arq-nome" class="leve">nenhum escolhido</span></div>' +
        '<input type="file" id="wae-file" hidden' + (d.tipo === 'video' ? ' accept="video/*"' : d.tipo === 'design' ? ' accept="image/*,application/pdf,video/*"' : '') + ' multiple>' +
        (d.tipo === 'video' ? '<label class="wz-check"><input type="checkbox" id="wae-doc" checked> Enviar como arquivo (qualidade original)</label><small class="leve">Até 95 MB. Maior que isso, mande o link do Drive no texto.</small>' : '') + '</div>' : '') +
      '<div class="mb"><label class="rot" for="wae-tx">MENSAGEM</label><textarea class="campo alta" id="wae-tx" rows="' + (d.tipo === 'roteiro' ? 14 : 6) + '">' + esc(preencher(tpl, d)) + '</textarea>' +
        '<small class="leve">A assinatura <b>*' + esc(primeiroNome()) + ':*</b> entra sozinha. <button type="button" class="link" id="wae-modelo">Usar este texto como modelo</button></small></div>' +
      '<div class="acoes"><button type="button" class="b" data-fecha>Cancelar</button><button type="button" class="b pri" id="wae-ok">' + icone + ' Enviar agora</button></div>', { larga: true });
    const selN = m.querySelector('#wae-n');
    if (selN) selN.onchange = () => {
      numSel = selN.value; conversas = todas.filter(c => c.numero_id === numSel);
      dele = d.clienteId ? conversas.filter(c => c.cliente_id === d.clienteId) : [];
      jid = dele.length ? dele[0].jid : '';
      m.querySelector('#wae-c').innerHTML = opcoes();
    };
    let arquivos = [];
    const inp = m.querySelector('#wae-file');
    const bt = m.querySelector('#wae-arq');
    if (bt) bt.onclick = () => inp.click();
    if (inp) inp.onchange = () => {
      arquivos = [...inp.files];
      const grande = arquivos.find(f => f.size > 95 * 1024 * 1024);
      if (grande) { B7.UI.toast('"' + grande.name + '" passa de 95 MB — mande o link do Drive no texto.', { tipo: 'erro' }); arquivos = []; inp.value = ''; }
      m.querySelector('#wae-arq-nome').textContent = arquivos.length ? (arquivos.length > 1 ? arquivos.length + ' arquivos · ' : arquivos[0].name + ' · ') + tamanho(arquivos.reduce((t, f) => t + f.size, 0)) : 'nenhum escolhido';
    };
    m.querySelector('#wae-modelo').onclick = () => {
      let t = m.querySelector('#wae-tx').value;
      if (d.texto) t = t.split(d.texto).join('{texto}');
      if (d.clienteNome) t = t.split(d.clienteNome).join('{cliente}');
      if (d.titulo) t = t.split(' "' + d.titulo + '"').join('{titulo}');
      if (d.data) t = t.split(d.data).join('{data}');
      if (d.hora) t = t.split(' às ' + d.hora).join('{hora}');
      if (d.local) t = t.split('\n📍 ' + d.local).join('{local}');
      B7.pref.gravar(chaveModelo(d.tipo), t);
      B7.UI.toast('Modelo guardado. Os próximos envios já começam com ele.');
    };
    m.querySelector('#wae-ok').onclick = async () => {
      const ok = m.querySelector('#wae-ok');
      jid = m.querySelector('#wae-c').value;
      const texto = m.querySelector('#wae-tx').value.trim();
      if (!jid) { m.querySelector('#wae-c').focus(); B7.UI.toast('Escolha a conversa.'); return; }
      if (!texto && !arquivos.length && !artes.length) { B7.UI.toast('Escreva a mensagem.'); return; }
      ok.disabled = true; ok.textContent = 'Enviando…';
      const corpo = assinatura() + texto;
      const enviados = [];
      try {
        if (texto) { const r = await B7.DB.waEvolution('enviar_texto', { jid, texto: corpo, numero: numSel || undefined }); if (r.erro) throw new Error(r.erro); }
        const marcadas = artes.filter((a, i) => { const c = m.querySelector('[data-arte="' + i + '"]'); return !c || c.checked; });
        for (const a of marcadas) {
          ok.textContent = 'Enviando ' + (a.nome_original || 'arte') + '…';
          const tipo = /^image\//.test(a.mime) ? 'image' : /^video\//.test(a.mime) ? 'video' : 'document';
          const r = await B7.DB.waEvolution('enviar_midia', { jid, bucket: 'design-files', path: a.caminho, tipo, nome: a.nome_original, mime: a.mime, numero: numSel || undefined });
          if (r.erro) throw new Error(r.erro);
          enviados.push(a.nome_original);
        }
        const comoDoc = d.tipo === 'video' ? !!(m.querySelector('#wae-doc') && m.querySelector('#wae-doc').checked) : false;
        for (const f of arquivos) {
          ok.textContent = 'Subindo ' + f.name + '…';
          const limpo = f.name.normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80);
          const path = 'envio/' + eu().id + '/' + Date.now() + '_' + limpo;
          const up = await B7.sb.storage.from('wa-midia').upload(path, f, { contentType: f.type || 'application/octet-stream' });
          if (up.error) throw new Error('Não consegui subir ' + f.name + '.');
          ok.textContent = 'Enviando ' + f.name + '…';
          const tipo = comoDoc ? 'document' : /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : 'document';
          const r = await B7.DB.waEvolution('enviar_midia', { jid, path, tipo, nome: f.name, mime: f.type || undefined, numero: numSel || undefined });
          if (r.erro) throw new Error(r.erro);
          enviados.push(f.name);
        }
      } catch (e) {
        ok.disabled = false; ok.innerHTML = icone + ' Tentar de novo';
        B7.UI.toast((e && e.message) || 'Não enviou.', { tipo: 'erro' });
        return;
      }
      m.fechar();
      B7.UI.toast('Enviado no WhatsApp.', { acao: 'Ver conversa', aoClicar: () => { location.hash = '#/whatsapp?jid=' + encodeURIComponent(jid) + (numSel ? '&num=' + encodeURIComponent(numSel) : ''); } });
      const conv = conversas.find(c => c.jid === jid);
      /* (a conversa é do número escolhido) */
      if (d.clienteId && conv && !conv.cliente_id) { try { await B7.sb.rpc('wa_conversa_marcar', { p_jid: jid, p_campo: 'cliente', p_valor: d.clienteId, p_numero: numSel || null }); } catch (e) {} }
      try {
        await B7.sb.rpc('whatsapp_registrar_envio', {
          p_tipo: d.tipo, p_ref_id: d.refId || null, p_cliente_id: d.clienteId || null, p_grupo: (conv && conv.nome) || jid,
          p_arquivo: enviados.join(', '), p_texto: corpo, p_demanda_id: d.demandaId || null
        });
      } catch (e) { /* o registro é só histórico */ }
    };
  }

  function abrir() { if (B7.CentralWA) return B7.CentralWA.abrir(); }
  return { abrir, enviar, podeEnviar, icone, modelos: MODELOS, noPrograma: false };
})();
