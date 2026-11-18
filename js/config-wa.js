/* =====================================================================
   CONFIGURAÇÕES DO WHATSAPP (4.81.0) — #/whatsapp/config
   Tudo o que era espalhado num lugar só, no mesmo desenho da tela do Otto
   (navegação por assunto à esquerda; cada ajuste numa linha: o que faz ↔
   controle). Duas camadas:
     · SÓ PARA VOCÊ (qualquer pessoa da Central): assinatura, Enter envia,
       velocidade do áudio, modelos de texto — ficam nas preferências da pessoa;
     · DA EQUIPE (administrador): número, respostas rápidas, avisos de espera,
       grupos e clientes, arquivos e conversas paradas — wa_config / wa_assistente.
   Nada é gravado até clicar em Salvar (a barra só aparece se algo mudou).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.ConfigWA = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const souAdmin = () => !!(B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin()));
  const eu = () => (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
  const primeiro = n => String(n || '').trim().split(/\s+/)[0] || '';
  const ini = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  let S = null, raiz = null;

  const IC = {
    geral: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    meu: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-4 3.8-6.2 7.5-6.2s6.7 2.2 7.5 6.2"/>',
    respostas: '<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>',
    modelos: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    avisos: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    grupos: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M16 4.6a3.2 3.2 0 0 1 0 6.3M18 14.8c1.7.6 2.7 2.4 3 5.2"/>',
    arquivos: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2.5h6a2.5 2.5 0 0 1 2.5 2.5v7.5A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z"/>',
    conexao: '<path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/>',
    otto: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5"/>'
  };
  const icone = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>';
  const linha = (t, d, ctl, cls) => '<div class="asw-row ' + (cls || '') + '"><div class="asw-row-t"><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div><div class="asw-row-c">' + ctl + '</div></div>';
  const chave = (k, on) => '<label class="asw-tg"><input type="checkbox" data-c="' + k + '"' + (on ? ' checked' : '') + '><span></span></label>';
  const bloco = (t, d, html, cls) => '<section class="asw-bl ' + (cls || '') + '"><header><h3>' + t + '</h3>' + (d ? '<p>' + d + '</p>' : '') + '</header>' + html + '</section>';
  const seg = (k, val, ops) => '<div class="asw-seg" role="radiogroup">' + ops.map(([v, r]) => '<label class="' + (String(val) === String(v) ? 'on' : '') + '"><input type="radio" name="' + k + '" data-c="' + k + '" value="' + esc(v) + '"' + (String(val) === String(v) ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>';
  const num = (k, v, min, max, suf) => '<label class="cwa-num"><input type="number" inputmode="numeric" data-c="' + k + '" value="' + esc(v) + '" min="' + min + '" max="' + max + '"><span>' + suf + '</span></label>';
  const tam = b => !b ? '0 MB' : b > 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB';
  const DIAS = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']];
  const NOME_MODELO = { video: ['Vídeo pronto', 'Edição de vídeo → Enviar no WhatsApp'], design: ['Arte pronta', 'Design → Enviar no WhatsApp'], gravacao: ['Confirmar gravação', 'Gravações → Enviar no WhatsApp'],
    aprovacao: ['Pedir aprovação', 'Aprovações → Enviar no WhatsApp'], roteiro: ['Mandar roteiro', 'Roteiros → Enviar no WhatsApp'], material: ['Pedir material gravado', 'Edição de vídeo → pedir material'] };

  /* ------------------------------------------------------------ abrir */
  async function abrir(params) {
    const painel = document.getElementById('painel-dashboard'); if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp', 'Configurações']);
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/whatsapp');
    painel.innerHTML = '<div class="asw cwa" id="cwa"><div class="asw-carrega"><i></i>Abrindo as configurações…</div></div>';
    raiz = painel.querySelector('#cwa');
    const adm = souAdmin();
    const q = [
      sb().from('wa_config').select('*').eq('id', 1).maybeSingle(),
      adm ? sb().from('wa_assistente').select('id,nome,ativo,push_espera_min,push_para,vigia_min,esperando_cliente_h,alertas_ligados,horario').eq('id', 1).maybeSingle() : Promise.resolve({ data: null }),
      adm ? sb().from('perfis').select('id,nome,papel').eq('estado', 'ativa').neq('papel', 'cliente').order('nome') : Promise.resolve({ data: [] }),
      adm ? sb().from('wa_conversas').select('jid,nome,cliente_id,arquivada,ultima_em,foto_url').eq('tipo', 'grupo').order('ultima_em', { ascending: false, nullsFirst: false }).limit(500) : Promise.resolve({ data: [] }),
      adm ? sb().from('clientes').select('id,nome').is('deleted_at', null).order('nome').limit(600) : Promise.resolve({ data: [] }),
      adm ? sb().rpc('wa_quem_ve_whatsapp') : Promise.resolve({ data: [] })
    ];
    const [cf, as, pf, gr, cl, qv] = await Promise.all(q.map(p => Promise.resolve(p).catch(e => ({ error: e }))));
    if (!raiz.isConnected) return;
    if (cf.error || !cf.data) { raiz.innerHTML = '<div class="asw-vazio"><b>Não consegui abrir as configurações</b><p>' + esc((cf.error && cf.error.message) || 'Sem acesso ao WhatsApp do B7.') + '</p></div>'; return; }
    let pref = {}; try { pref = B7.pref.ler('wa_cfg', {}) || {}; } catch (e) { /* sem preferências */ }
    let vel = 1; try { vel = Number(localStorage.getItem('b7.wz.vel')) || 1; } catch (e) { /* sem armazenamento */ }
    const modelos = {}; const M = (B7.WhatsApp && B7.WhatsApp.modelos) || {};
    Object.keys(NOME_MODELO).forEach(t => { modelos[t] = B7.pref ? B7.pref.ler('wa_modelo_' + t, M[t] || '') : (M[t] || ''); });
    const quemVe = new Set(((qv.data || []) || []).map(x => typeof x === 'string' ? x : (x && (x.wa_quem_ve_whatsapp || x.id))).filter(Boolean));
    const ass = as.data || {};
    const est = {
      w: { respostas: cf.data.respostas || [], auto_arquivar_dias: cf.data.auto_arquivar_dias || 0, fotos_auto: cf.data.fotos_auto !== false },
      a: adm ? { push_espera_min: ass.push_espera_min ?? 15, push_para: ass.push_para || [], vigia_min: ass.vigia_min ?? 20, esperando_cliente_h: ass.esperando_cliente_h ?? 24,
        alertas_ligados: ass.alertas_ligados !== false, horario: ass.horario || { ativo: false, ini: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5], mensagem: '' } } : null,
      p: { assinatura: pref.assinatura !== false, nome: pref.nome || '', enter: pref.enter !== false, vel, modelos }
    };
    S = { ...est, orig: JSON.stringify(est), adm, aba: (params && params.get && params.get('aba')) || (S && S.aba) || 'geral', pessoas: (pf.data || []).filter(p => !/teste/i.test(p.nome || '')),
      quemVe, grupos: gr.data || [], clientes: cl.data || [], busca: '', filtroG: 'todos', ottoNome: primeiro(ass.nome) || 'Otto', ottoAtivo: !!ass.ativo,
      estado: null, drive: null, uso: null, gMud: {} };
    if (!S.adm && !['meu', 'respostas', 'modelos'].includes(S.aba)) S.aba = 'meu';
    desenhar();
    raiz.addEventListener('click', clique);
    raiz.addEventListener('input', digitou);
    raiz.addEventListener('change', digitou);
    if (S.adm) carregarVivos();
  }

  /* o que demora (número, Drive, armazenamento) chega depois e repinta só o necessário */
  async function carregarVivos() {
    const [e, d, a, b] = await Promise.all([
      B7.DB.waEvolution('estado').catch(x => ({ erro: x.message })),
      sb().rpc('wa_drive_status').then(r => r.data).catch(() => null),
      sb().from('wa_mensagens').select('id', { count: 'exact', head: true }).not('drive_id', 'is', null).then(r => r.count || 0).catch(() => null),
      sb().from('wa_mensagens').select('midia_tamanho').not('midia_path', 'is', null).is('drive_id', null).limit(2000).then(r => r.data || []).catch(() => null)
    ]);
    if (!S || !raiz || !raiz.isConnected) return;
    S.estado = e || {}; S.drive = d || {}; S.uso = { drive: a, sistema: b ? b.length : null, bytes: b ? b.reduce((s, x) => s + (Number(x.midia_tamanho) || 0), 0) : null };
    desenhar();
  }

  /* ------------------------------------------------------------ estado sujo / salvar */
  const atual = () => JSON.stringify({ w: S.w, a: S.a, p: S.p });
  const mudou = () => atual() !== S.orig || Object.keys(S.gMud).length > 0;
  function marcarSujo() {
    const sujo = mudou();
    const br = raiz.querySelector('.asw-barra'); if (br) { br.classList.toggle('visivel', sujo); br.setAttribute('aria-hidden', sujo ? 'false' : 'true'); }
  }
  async function salvar() {
    const bt = raiz.querySelector('[data-salvar]'); if (bt) { bt.disabled = true; bt.textContent = 'Salvando…'; }
    const o = JSON.parse(S.orig);
    try {
      /* respostas sem atalho ou sem texto não valem */
      S.w.respostas = (S.w.respostas || []).map(r => ({ atalho: String(r.atalho || '').toLowerCase().replace(/[^a-z0-9à-ú_-]/gi, '').slice(0, 20), titulo: String(r.titulo || '').slice(0, 60), texto: String(r.texto || '').slice(0, 2000) })).filter(r => r.atalho && r.texto.trim());
      if (S.adm && JSON.stringify(S.w) !== JSON.stringify(o.w)) {
        const { error } = await sb().from('wa_config').update({ ...S.w, auto_arquivar_dias: Math.max(0, Math.min(365, Number(S.w.auto_arquivar_dias) || 0)), atualizado_em: new Date().toISOString(), atualizado_por: eu().id || null }).eq('id', 1);
        if (error) throw error;
      }
      if (S.adm && S.a && JSON.stringify(S.a) !== JSON.stringify(o.a)) {
        const a = S.a;
        const { error } = await sb().from('wa_assistente').update({ push_espera_min: Math.max(0, Math.min(600, Number(a.push_espera_min) || 0)), push_para: a.push_para,
          vigia_min: Math.max(5, Math.min(600, Number(a.vigia_min) || 20)), esperando_cliente_h: Math.max(0, Math.min(240, Number(a.esperando_cliente_h) || 0)),
          alertas_ligados: a.alertas_ligados, horario: a.horario }).eq('id', 1);
        if (error) throw error;
      }
      if (JSON.stringify(S.p) !== JSON.stringify(o.p)) {
        let pref = {}; try { pref = B7.pref.ler('wa_cfg', {}) || {}; } catch (e) { /* novo */ }
        B7.pref.gravar('wa_cfg', { ...pref, assinatura: S.p.assinatura, nome: String(S.p.nome || '').trim().slice(0, 40), enter: S.p.enter });
        try { localStorage.setItem('b7.wz.vel', String(S.p.vel)); } catch (e) { /* sem armazenamento */ }
        const M = (B7.WhatsApp && B7.WhatsApp.modelos) || {};
        Object.keys(S.p.modelos).forEach(t => { if (S.p.modelos[t] !== o.p.modelos[t]) B7.pref.gravar('wa_modelo_' + t, S.p.modelos[t].trim() ? S.p.modelos[t] : (M[t] || '')); });
      }
      for (const [jid, cid] of Object.entries(S.gMud)) {
        const { error } = await sb().rpc('wa_conversa_marcar', { p_jid: jid, p_campo: 'cliente', p_valor: cid || '' });
        if (error) throw error;
        const g = S.grupos.find(x => x.jid === jid); if (g) g.cliente_id = cid || null;
      }
      S.gMud = {};
      S.orig = atual();
      if (B7.CentralWA && B7.CentralWA.recarregarConfig) B7.CentralWA.recarregarConfig();
      B7.UI.toast('Configurações salvas.');
    } catch (e) { B7.UI.toast((e && e.message) || 'Não deu para salvar.', { tipo: 'erro' }); }
    desenhar();
  }

  /* ------------------------------------------------------------ desenho */
  function desenhar() {
    const sc = raiz.scrollTop;
    const ABAS = [
      ['geral', 'Visão geral', null, true], ['meu', 'Meu jeito de enviar'], ['respostas', 'Respostas rápidas', (S.w.respostas || []).length],
      ['modelos', 'Modelos de texto'], ['avisos', 'Avisos e espera', null, true], ['grupos', 'Grupos e clientes', S.grupos.filter(g => !g.cliente_id && !g.arquivada).length || null, true],
      ['arquivos', 'Arquivos e conversas', null, true], ['conexao', 'Número conectado', null, true]
    ].filter(a => S.adm || !a[3]);
    const e = S.estado, on = e && e.estado === 'open';
    raiz.innerHTML =
      '<header class="asw-hero cwa-hero on">' +
        '<a class="asw-volta" href="#/whatsapp">‹ Conversas</a>' +
        '<div class="asw-id"><span class="asw-av cwa-av">' + icone('conexao') + (S.adm ? '<i class="' + (e == null ? 'esp' : on ? '' : 'off') + '"></i>' : '') + '</span>' +
          '<div class="asw-id-t"><h1>Configurações do WhatsApp</h1><p>' +
            (!S.adm ? 'Do seu jeito de mandar mensagem às respostas rápidas da equipe' :
              e == null ? 'Conferindo o número…' : on ? 'Número ' + (e.numero ? '+' + esc(e.numero) : '') + ' conectado e recebendo mensagens' : 'Número desconectado — as mensagens não estão chegando') + '</p></div></div>' +
        (S.adm ? '<dl class="asw-stats">' +
          '<div><dt>grupos de clientes</dt><dd>' + S.grupos.filter(g => g.cliente_id).length + '<small>/' + S.grupos.length + '</small></dd></div>' +
          '<div><dt>respostas rápidas</dt><dd>' + (S.w.respostas || []).length + '</dd></div>' +
          '<div><dt>arquivos no Drive</dt><dd>' + (S.uso && S.uso.drive != null ? S.uso.drive : '–') + '</dd></div>' +
          '<div class="' + (S.uso && S.uso.bytes > 50e6 ? 'alerta' : '') + '"><dt>ainda no sistema</dt><dd>' + (S.uso && S.uso.bytes != null ? tam(S.uso.bytes) : '–') + '</dd></div>' +
        '</dl>' : '') + '</header>' +
      '<div class="asw-casca">' +
        '<nav class="asw-nav" aria-label="Seções">' + ABAS.map(([k, r, n]) => '<button class="' + (S.aba === k ? 'on' : '') + '" data-aba="' + k + '"' + (S.aba === k ? ' aria-current="page"' : '') + '>' + icone(k) + '<span>' + r + '</span>' + (n != null ? '<b>' + n + '</b>' : '') + '</button>').join('') +
          (S.adm ? '<a class="cwa-nav-otto" href="#/whatsapp/assistente">' + icone('otto') + '<span>' + esc(S.ottoNome) + ' · assistente</span><em>›</em></a>' : '') + '</nav>' +
        '<section class="asw-corpo">' + corpo() + '</section>' +
      '</div>' +
      '<div class="asw-barra" aria-hidden="true"><span>Alterações ainda não salvas</span><button class="b" data-desfazer>Desfazer</button><button class="b pri" data-salvar>Salvar</button></div>';
    raiz.scrollTop = sc;
    marcarSujo();
  }

  function corpo() {
    const w = S.w, a = S.a, p = S.p;
    if (S.aba === 'geral') {
      const e = S.estado, on = e && e.estado === 'open', d = S.drive || {}, dOk = d.conectado && d.status === 'ativa';
      const semCli = S.grupos.filter(g => !g.cliente_id && !g.arquivada).length;
      const card = (k, t, st, txt, acao) => '<button class="cwa-card ' + st + '" data-aba="' + k + '"><span class="cwa-card-ic">' + icone(k) + '</span><span class="cwa-card-t"><b>' + t + '</b><small>' + txt + '</small></span><i class="cwa-pt"></i><em>' + acao + ' ›</em></button>';
      return bloco('Tudo em ordem?', 'O que precisa de atenção aparece primeiro.',
        '<div class="cwa-cards">' +
          card('conexao', 'Número do WhatsApp', e == null ? 'esp' : on ? 'ok' : 'ruim', e == null ? 'Conferindo…' : on ? 'Conectado' + (e.numero ? ' · +' + esc(e.numero) : '') : 'Desconectado — leia o QR Code de novo', on ? 'Ver' : 'Conectar') +
          card('arquivos', 'Arquivos no Google Drive', S.drive == null ? 'esp' : dOk ? (S.uso && S.uso.sistema ? 'meio' : 'ok') : 'ruim',
            S.drive == null ? 'Conferindo…' : dOk ? (S.uso && S.uso.sistema ? S.uso.sistema + ' arquivo(s) ainda indo para o Drive' : 'Tudo guardado no Drive') : 'Drive desconectado — os arquivos pesam no sistema', dOk ? 'Ver' : 'Conectar') +
          card('grupos', 'Grupos ligados a clientes', semCli ? 'meio' : 'ok', semCli ? semCli + ' grupo(s) sem cliente — o Otto e os avisos não sabem de quem são' : 'Todos os grupos ativos têm cliente', semCli ? 'Ligar' : 'Ver') +
          card('avisos', 'Aviso de cliente esperando', a && a.push_espera_min > 0 ? 'ok' : 'meio', a && a.push_espera_min > 0 ? 'No celular depois de ' + a.push_espera_min + ' min sem resposta' : 'Aviso no celular desligado', 'Ajustar') +
        '</div>') +
        bloco('Atalhos', '',
          '<div class="cwa-atalhos"><button class="b contorno" data-acao="importar">Puxar conversas recentes</button><a class="b contorno" href="#/whatsapp/assistente">Abrir o ' + esc(S.ottoNome) + '</a><button class="b contorno" data-aba="respostas">Criar resposta rápida</button></div>');
    }
    if (S.aba === 'meu') {
      const nomeAss = esc(p.nome || primeiro(eu().nome) || 'Seu nome');
      return bloco('Assinatura', 'Vale só para você. Aparece em negrito no começo das mensagens que você manda pelo B7, para o cliente saber quem falou.',
          linha('Assinar minhas mensagens', 'Desligado: a mensagem vai sem nome, como se fosse da Branding7.', chave('p.assinatura', p.assinatura)) +
          linha('Nome na assinatura', 'Em branco usa o seu primeiro nome.', '<input class="campo cwa-txt" data-c="p.nome" maxlength="40" placeholder="' + esc(primeiro(eu().nome) || 'Seu nome') + '" value="' + esc(p.nome) + '">', p.assinatura ? '' : 'off') +
          '<div class="cwa-prev"><small>Assim o cliente vê</small><div class="cwa-bolha">' + (p.assinatura ? '<b>' + nomeAss + ':</b><br>' : '') + 'Oi! A arte da Black Friday já está pronta 🎨</div></div>') +
        bloco('Escrever e ouvir', '',
          linha('Enter envia a mensagem', 'Desligado: Enter pula linha e você envia no botão. No celular, Enter sempre pula linha.', chave('p.enter', p.enter)) +
          linha('Velocidade dos áudios', 'A que já começa marcada em todo áudio da Central. Dá para trocar no próprio áudio.', seg('p.vel', p.vel, [[1, '1×'], [1.5, '1,5×'], [2, '2×']])));
    }
    if (S.aba === 'respostas') {
      const lista = w.respostas || [];
      return bloco('Respostas rápidas', 'Na conversa, digite <b>/</b> e o atalho (ex.: <code>/ok</code>) para colar a resposta. <code>{cliente}</code> vira o nome do cliente da conversa e <code>{eu}</code> o seu nome.' + (S.adm ? '' : ' Só o administrador cria e muda.'),
        (lista.length ? '<div class="cwa-rr">' + lista.map((r, i) =>
          '<div class="cwa-rr-i">' +
            '<div class="cwa-rr-top"><label class="cwa-atalho"><span>/</span><input data-r="' + i + '" data-k="atalho" value="' + esc(r.atalho) + '" maxlength="20" placeholder="atalho"' + (S.adm ? '' : ' readonly') + '></label>' +
              '<input class="campo cwa-rr-tit" data-r="' + i + '" data-k="titulo" value="' + esc(r.titulo || '') + '" maxlength="60" placeholder="Nome (opcional)"' + (S.adm ? '' : ' readonly') + '>' +
              (S.adm ? '<button class="wz-ic cwa-x" data-tira="' + i + '" title="Apagar resposta" aria-label="Apagar resposta">✕</button>' : '') + '</div>' +
            '<textarea class="campo" data-r="' + i + '" data-k="texto" rows="2" maxlength="2000" placeholder="Texto da resposta"' + (S.adm ? '' : ' readonly') + '>' + esc(r.texto) + '</textarea>' +
          '</div>').join('') + '</div>' : '<div class="asw-nada">Nenhuma resposta rápida ainda.</div>') +
        (S.adm ? '<button class="b contorno cwa-mais" data-acao="nova-resposta">+ Nova resposta rápida</button>' : ''));
    }
    if (S.aba === 'modelos') {
      return bloco('Modelos de texto', 'O texto que já vem escrito quando você usa “Enviar no WhatsApp” nas outras telas. Vale só para você. Em branco volta ao padrão.',
        '<div class="cwa-mod">' + Object.keys(NOME_MODELO).map(t => '<label class="cwa-mod-i"><span><b>' + NOME_MODELO[t][0] + '</b><small>' + NOME_MODELO[t][1] + '</small></span>' +
          '<textarea class="campo" data-m="' + t + '" rows="4">' + esc(p.modelos[t]) + '</textarea></label>').join('') + '</div>' +
        '<p class="cwa-dica">Pode usar: <code>{cliente}</code> <code>{titulo}</code> <code>{data}</code> <code>{hora}</code> <code>{local}</code> <code>{link}</code> <code>{texto}</code></p>');
    }
    if (S.aba === 'avisos' && a) {
      const h = a.horario || {};
      return bloco('Cliente esperando a gente', 'Depois que o ' + esc(S.ottoNome) + ' lê a conversa e confirma que o cliente espera resposta.',
          linha('Aviso no celular', 'Notificação para quem cuida do WhatsApp. 0 desliga.', num('a.push_espera_min', a.push_espera_min, 0, 600, 'min sem resposta')) +
          linha('Quem recebe', 'Sem ninguém marcado, recebe quem tem acesso ao WhatsApp.', '<div class="asw-chips cwa-pessoas">' + S.pessoas.filter(x => S.quemVe.has(x.id) || (a.push_para || []).includes(x.id)).map(x => '<button class="asw-chip' + ((a.push_para || []).includes(x.id) ? ' on' : '') + '" data-push="' + x.id + '">' + esc(primeiro(x.nome)) + '</button>').join('') + '</div>') +
          linha('Aviso no grupo da equipe', 'O ' + esc(S.ottoNome) + ' manda o print da conversa e marca a coordenação.', num('a.vigia_min', a.vigia_min, 5, 600, 'min sem resposta'))) +
        bloco('A gente esperando o cliente', 'Mandamos algo que pede retorno (aprovação, material, confirmação) e o cliente sumiu.',
          linha('Lembrar a equipe', 'Uma mensagem no grupo da equipe com tudo parado. 0 desliga.', num('a.esperando_cliente_h', a.esperando_cliente_h, 0, 240, 'h sem resposta')) +
          linha('Avisos de prazo e aprovação', 'Demandas atrasadas, vencendo amanhã e aprovações paradas.', chave('a.alertas_ligados', a.alertas_ligados))) +
        bloco('Horário de atendimento', 'Fora dele, os avisos esperam o próximo horário e o ' + esc(S.ottoNome) + ' avisa o cliente que o time responde depois.',
          linha('Usar horário de atendimento', '', chave('a.horario.ativo', !!h.ativo)) +
          '<div class="asw-horario' + (h.ativo ? '' : ' off') + '"><div class="asw-chips">' + DIAS.map(([d, r]) => '<button class="asw-chip' + ((h.dias || []).map(String).includes(d) ? ' on' : '') + '" data-dia="' + d + '">' + r + '</button>').join('') + '</div>' +
          '<div class="cwa-horas"><input class="campo" type="time" data-c="a.horario.ini" value="' + esc(h.ini || '08:00') + '"><span>até</span><input class="campo" type="time" data-c="a.horario.fim" value="' + esc(h.fim || '18:00') + '"></div>' +
          '<label class="cwa-lbl">Mensagem para o cliente fora do horário<textarea class="campo" data-c="a.horario.mensagem" rows="2" maxlength="400">' + esc(h.mensagem || '') + '</textarea></label></div>');
    }
    if (S.aba === 'grupos') {
      const f = S.busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const cliDe = g => S.gMud[g.jid] !== undefined ? S.gMud[g.jid] : g.cliente_id;
      let lista = S.grupos.filter(g => !f || String(g.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(f));
      if (S.filtroG === 'sem') lista = lista.filter(g => !cliDe(g) && !g.arquivada);
      if (S.filtroG === 'com') lista = lista.filter(g => cliDe(g));
      const opts = '<option value="">— sem cliente —</option>' + S.clientes.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('');
      return bloco('Grupos e clientes', 'Cada grupo ligado ao cliente certo: é assim que o ' + esc(S.ottoNome) + ', os avisos e o painel da Central sabem de quem é a conversa.',
        '<div class="cwa-gtopo"><label class="wz-busca cwa-busca"><input data-busca placeholder="Buscar grupo" value="' + esc(S.busca) + '"></label>' +
          seg('filtroG', S.filtroG, [['todos', 'Todos'], ['sem', 'Sem cliente'], ['com', 'Com cliente']]) + '</div>' +
        (lista.length ? '<div class="cwa-gl">' + lista.slice(0, 200).map(g => {
          const cid = cliDe(g) || '';
          return '<div class="cwa-g' + (cid ? '' : ' sem') + (S.gMud[g.jid] !== undefined ? ' mud' : '') + '"><span class="asw-av g">' + (g.foto_url ? '<img src="' + esc(g.foto_url) + '" alt="" onerror="this.remove()">' : '') + esc(ini(g.nome)) + '</span>' +
            '<span class="cwa-g-t"><b>' + esc(g.nome || 'Grupo') + '</b><small>' + (g.arquivada ? 'Arquivado · ' : '') + (g.ultima_em ? 'última mensagem ' + new Date(g.ultima_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'sem mensagens') + '</small></span>' +
            '<select class="campo cwa-sel" data-g="' + esc(g.jid) + '">' + opts.replace('value="' + cid + '"', 'value="' + cid + '" selected') + '</select></div>';
        }).join('') + '</div>' : '<div class="asw-nada">Nenhum grupo com esse filtro.</div>'));
    }
    if (S.aba === 'arquivos') {
      const d = S.drive || {}, dOk = d.conectado && d.status === 'ativa';
      return bloco('Google Drive', 'Fotos, vídeos, áudios e documentos ficam na pasta <b>B7 · WhatsApp</b> do Drive, separados por conversa e mês — não pesam no sistema.',
          '<div class="cwa-drive ' + (S.drive == null ? 'esp' : dOk ? 'ok' : 'ruim') + '"><i></i><div><b>' + (S.drive == null ? 'Conferindo…' : dOk ? 'Conectado' + (d.conta ? ' · ' + esc(d.conta) : '') : d.conectado ? 'A conexão caiu' : 'Não conectado') + '</b>' +
            '<small>' + (S.uso ? (S.uso.drive != null ? S.uso.drive + ' arquivo(s) no Drive' : '') + (S.uso.sistema ? ' · ' + S.uso.sistema + ' ainda no sistema (' + tam(S.uso.bytes) + ')' + (dOk ? ', indo aos poucos' : '') : '') : '') + '</small></div>' +
            '<button class="b ' + (dOk ? 'contorno' : 'pri') + '" data-acao="drive">' + (dOk ? 'Gerenciar' : 'Conectar o Drive') + '</button></div>' +
          linha('Abrir fotos sozinhas', 'Ao entrar numa conversa, as fotos já carregam. Desligado: só ao tocar (economiza internet e espaço).', chave('w.fotos_auto', w.fotos_auto))) +
        bloco('Conversas paradas', 'Deixa a lista só com o que está vivo.',
          linha('Arquivar sozinho', 'Conversa sem mensagem há esse tempo vai para Arquivadas. Volta para a lista assim que chegar mensagem nova. Fixadas e quem espera resposta não saem.',
            seg('w.auto_arquivar_dias', w.auto_arquivar_dias, [[0, 'Nunca'], [15, '15 dias'], [30, '30 dias'], [60, '60 dias']])));
    }
    if (S.aba === 'conexao') {
      const e = S.estado, on = e && e.estado === 'open';
      return bloco('Número conectado', 'O WhatsApp da Branding7 ligado ao B7. Mensagens, Otto e avisos dependem dele.',
          '<div class="cwa-drive ' + (e == null ? 'esp' : on ? 'ok' : 'ruim') + '"><i></i><div><b>' + (e == null ? 'Conferindo…' : on ? 'Conectado' : e.erro ? 'Não consegui conferir' : 'Desconectado') + '</b>' +
            '<small>' + (e && e.numero ? '+' + esc(e.numero) : '') + (e && e.instancia ? ' · conexão ' + esc(e.instancia) : '') + (e && e.erro ? esc(e.erro) : '') + '</small></div>' +
            '<button class="b ' + (on ? 'contorno' : 'pri') + '" data-acao="conexao">' + (on ? 'Detalhes' : 'Conectar') + '</button></div>') +
        bloco('Histórico', '',
          linha('Puxar conversas recentes', 'Traz grupos, conversas e mensagens que ainda não estão no B7 (ex.: depois de reconectar o número).', '<button class="b contorno" data-acao="importar">Puxar agora</button>') +
          linha('Quem acessa o WhatsApp', 'Administrador e videomaker com acesso liberado. Muda em Pessoas e acessos.', '<a class="b contorno" href="#/usuarios">Pessoas e acessos</a>'));
    }
    return '';
  }

  /* ------------------------------------------------------------ eventos */
  function setar(caminho, v) {
    const [raizK, ...resto] = caminho.split('.');
    let o = S[raizK]; if (!o) return;
    for (let i = 0; i < resto.length - 1; i++) { o[resto[i]] = o[resto[i]] || {}; o = o[resto[i]]; }
    o[resto[resto.length - 1]] = v;
  }
  function digitou(e) {
    const t = e.target;
    if (t.dataset.busca != null) { S.busca = t.value; const pos = t.selectionStart; desenhar(); const i = raiz.querySelector('[data-busca]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (t.dataset.g) { const g = S.grupos.find(x => x.jid === t.dataset.g); if (g && (g.cliente_id || '') === t.value) delete S.gMud[g.jid]; else S.gMud[t.dataset.g] = t.value; t.closest('.cwa-g').classList.toggle('mud', S.gMud[t.dataset.g] !== undefined); return marcarSujo(); }
    if (t.dataset.r != null) { S.w.respostas[+t.dataset.r][t.dataset.k] = t.dataset.k === 'atalho' ? t.value.toLowerCase().replace(/\s+/g, '') : t.value; return marcarSujo(); }
    if (t.dataset.m) { S.p.modelos[t.dataset.m] = t.value; return marcarSujo(); }
    const c = t.dataset.c; if (!c) return;
    if (c === 'filtroG') { S.filtroG = t.value; return desenhar(); }
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (t.type === 'number') v = t.value === '' ? 0 : Number(t.value);
    if (c === 'p.vel' || c === 'w.auto_arquivar_dias') v = Number(v);
    setar(c, v);
    if (t.type === 'checkbox' || t.type === 'radio' || c === 'p.nome') { if (e.type === 'change' || c === 'p.nome') { if (c === 'p.nome') { atualizarPrevia(); return marcarSujo(); } return desenhar(); } }
    marcarSujo();
  }
  function atualizarPrevia() {
    const b = raiz.querySelector('.cwa-bolha b'); if (b) b.textContent = (S.p.nome || primeiro(eu().nome) || 'Seu nome') + ':';
  }
  async function clique(e) {
    const t = e.target;
    const ab = t.closest('[data-aba]'); if (ab) { S.aba = ab.dataset.aba; desenhar(); raiz.querySelector('.asw-corpo') && window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (t.closest('[data-salvar]')) return salvar();
    if (t.closest('[data-desfazer]')) { const o = JSON.parse(S.orig); S.w = o.w; S.a = o.a; S.p = o.p; S.gMud = {}; return desenhar(); }
    const di = t.closest('[data-dia]'); if (di && S.a) { const h = S.a.horario; const d = Number(di.dataset.dia); h.dias = (h.dias || []).map(Number); h.dias = h.dias.includes(d) ? h.dias.filter(x => x !== d) : h.dias.concat(d); return desenhar(); }
    const pu = t.closest('[data-push]'); if (pu && S.a) { const id = pu.dataset.push; S.a.push_para = (S.a.push_para || []).includes(id) ? S.a.push_para.filter(x => x !== id) : (S.a.push_para || []).concat(id); return desenhar(); }
    const tr = t.closest('[data-tira]'); if (tr) { S.w.respostas.splice(+tr.dataset.tira, 1); return desenhar(); }
    const ac = t.closest('[data-acao]'); if (!ac) return;
    const a = ac.dataset.acao;
    if (a === 'nova-resposta') {
      S.w.respostas = (S.w.respostas || []).concat([{ atalho: '', titulo: '', texto: '' }]); desenhar();
      const ult = raiz.querySelectorAll('.cwa-atalho input'); if (ult.length) ult[ult.length - 1].focus();
      return;
    }
    if (a === 'conexao') { if (B7.WaCentral) B7.WaCentral.abrir(); return; }
    if (a === 'drive') { if (B7.CentralWA && B7.CentralWA.drive) await B7.CentralWA.drive(); carregarVivos(); return; }
    if (a === 'importar') { if (B7.CentralWA && B7.CentralWA.importar) B7.CentralWA.importar(); return; }
  }

  return { abrir };
})();
