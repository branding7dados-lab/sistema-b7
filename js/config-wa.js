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
  const corNome = n => { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return 'hsl(' + h + ' 62% 52%)'; };
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
    assuntos: '<path d="M4 6h10M4 12h7M4 18h10"/><circle cx="17.5" cy="11" r="2.6"/><path d="M13.5 19c.5-2.3 2-3.6 4-3.6s3.5 1.3 4 3.6"/>',
    otto: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 15.5h5"/>'
  };
  const icone = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>';
  const linha = (t, d, ctl, cls) => '<div class="asw-row ' + (cls || '') + '"><div class="asw-row-t"><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div><div class="asw-row-c">' + ctl + '</div></div>';
  const chave = (k, on) => '<label class="asw-tg"><input type="checkbox" data-c="' + k + '"' + (on ? ' checked' : '') + '><span></span></label>';
  const bloco = (t, d, html, cls) => '<section class="asw-bl ' + (cls || '') + '">' + (t || d ? '<header>' + (t ? '<h3>' + t + '</h3>' : '') + (d ? '<p>' + d + '</p>' : '') + '</header>' : '') + html + '</section>';
  const seg = (k, val, ops) => '<div class="asw-seg" role="radiogroup">' + ops.map(([v, r]) => '<label class="' + (String(val) === String(v) ? 'on' : '') + '"><input type="radio" name="' + k + '" data-c="' + k + '" value="' + esc(v) + '"' + (String(val) === String(v) ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>';
  const num = (k, v, min, max, suf) => '<label class="cwa-num"><input type="number" inputmode="numeric" data-c="' + k + '" value="' + esc(v) + '" min="' + min + '" max="' + max + '"><span>' + suf + '</span></label>';
  /* 4.81.0: número com − e + e sugestões (no lugar da caixinha de número) */
  const passo = (k, v, min, max, suf, sug) => '<div class="cwa-passo" data-passo-k="' + k + '" data-min="' + min + '" data-max="' + max + '">' +
    '<div class="cwa-passo-c"><button type="button" data-passo="-1" aria-label="Menos"' + (v <= min ? ' disabled' : '') + '>−</button>' +
    '<label><input type="number" inputmode="numeric" data-c="' + k + '" value="' + esc(v) + '" min="' + min + '" max="' + max + '"><span>' + (Number(v) === 0 ? 'desligado' : suf) + '</span></label>' +
    '<button type="button" data-passo="1" aria-label="Mais"' + (v >= max ? ' disabled' : '') + '>+</button></div>' +
    (sug ? '<div class="cwa-sug">' + sug.map(([x, r]) => '<button type="button" class="' + (Number(v) === x ? 'on' : '') + '" data-sug="' + x + '">' + r + '</button>').join('') + '</div>' : '') + '</div>';
  const tam = b => !b ? '0 MB' : b > 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB';
  const DIAS = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']];
  const NOME_MODELO = { video: ['Vídeo pronto', 'Edição de vídeo → Enviar no WhatsApp'], design: ['Arte pronta', 'Design → Enviar no WhatsApp'], gravacao: ['Confirmar gravação', 'Gravações → Enviar no WhatsApp'],
    aprovacao: ['Pedir aprovação', 'Aprovações → Enviar no WhatsApp'], roteiro: ['Mandar roteiro', 'Roteiros → Enviar no WhatsApp'], material: ['Pedir material gravado', 'Edição de vídeo → pedir material'] };

  const DESC = {
    geral: 'O que precisa de atenção aparece primeiro.',
    meu: 'Vale só para você: como suas mensagens saem e como você ouve os áudios.',
    modelos: 'Os textos que já vêm escritos no “Enviar no WhatsApp” das outras telas. Só seus.',
    respostas: 'Textos prontos da equipe: digite / na conversa para usar.',
    grupos: 'De qual cliente é cada grupo (é assim que o {otto}, os avisos e a Central sabem de quem é a conversa) e se o {otto} fala nele.',
    avisos: 'Quando e como a equipe fica sabendo que alguém espera resposta.',
    assuntos: 'O que é da Branding7, o que é de outra equipe e quem responde por cada coisa.',
    'otto-geral': 'O que o {otto} fez nos últimos dias e as dúvidas que ele passou para a equipe.',
    'otto-jeito': 'Quem ele é e como escreve.',
    'otto-velocidade': 'Quanto ele demora para responder, quando fala em áudio e com que voz.',
    'otto-equipe': 'As pessoas da equipe, o grupo interno, o bom dia e as pendências.',
    'otto-saber': 'O que ele lembra e as respostas que vocês ensinaram.',
    'otto-controle': 'O que ele pode fazer sozinho e quem pode dar ordens.',
    'otto-testar': 'Converse com ele aqui, sem mandar nada no WhatsApp.',
    conexao: 'Os números de WhatsApp da Branding7 ligados ao B7. Cada um tem a sua equipe; o administrador vê todos.',
    arquivos: 'Onde ficam fotos, vídeos e áudios, e o que fazer com conversas paradas.'
  };
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
      adm ? sb().from('wa_assistente').select('id,nome,ativo,push_espera_min,push_para,vigia_min,esperando_cliente_h,alertas_ligados,horario,avisos_regras,modo_clientes,resumo_dia_ligado,resumo_dia_hora,grupos').eq('id', 1).maybeSingle() : Promise.resolve({ data: null }),
      adm ? sb().from('perfis').select('id,nome,papel').eq('estado', 'ativa').neq('papel', 'cliente').order('nome') : Promise.resolve({ data: [] }),
      adm ? sb().from('wa_conversas').select('jid,nome,cliente_id,arquivada,ultima_em,foto_url').eq('tipo', 'grupo').order('ultima_em', { ascending: false, nullsFirst: false }).limit(500) : Promise.resolve({ data: [] }),
      adm ? sb().from('clientes_resumo').select('id,nome,logo_url').is('deleted_at', null).order('nome').limit(600) : Promise.resolve({ data: [] }),
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
        alertas_ligados: ass.alertas_ligados !== false,
        modo_clientes: ass.modo_clientes === 'atende' ? 'atende' : 'vigia', resumo_dia_ligado: !!ass.resumo_dia_ligado, resumo_dia_hora: ass.resumo_dia_hora || '18:00', grupos: ass.grupos || {},
        avisos_regras: Object.assign({ nossos: '', outros: [], responsaveis: [], instrucoes: '' }, ass.avisos_regras || {}), horario: ass.horario || { ativo: false, ini: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5], mensagem: '' } } : null,
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
    const [e, nl, d, a, b] = await Promise.all([
      B7.DB.waEvolution('estado').catch(x => ({ erro: x.message })),
      B7.DB.waEvolution('numeros').then(r => r.lista || null).catch(() => null),
      sb().rpc('wa_drive_status').then(r => r.data).catch(() => null),
      sb().from('wa_mensagens').select('id', { count: 'exact', head: true }).not('drive_id', 'is', null).then(r => r.count || 0).catch(() => null),
      sb().from('wa_mensagens').select('midia_tamanho').not('midia_path', 'is', null).is('drive_id', null).limit(2000).then(r => r.data || []).catch(() => null)
    ]);
    if (!S || !raiz || !raiz.isConnected) return;
    S.estado = e || {}; S.numeros = nl; S.drive = d || {}; S.uso = { drive: a, sistema: b ? b.length : null, bytes: b ? b.reduce((s, x) => s + (Number(x.midia_tamanho) || 0), 0) : null };
    if (String(S.aba).startsWith('otto-')) {   /* não redesenha por cima do Otto aberto: só as pílulas do topo */
      const pl = raiz.querySelector('.cwa-pils'); if (pl) pl.outerHTML = pilulas();
      return;
    }
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
          alertas_ligados: a.alertas_ligados, horario: a.horario,
          modo_clientes: a.modo_clientes === 'atende' ? 'atende' : 'vigia', resumo_dia_ligado: !!a.resumo_dia_ligado, resumo_dia_hora: /^\d{2}:\d{2}$/.test(a.resumo_dia_hora || '') ? a.resumo_dia_hora : '18:00', grupos: a.grupos || {},
          avisos_regras: { nossos: String(a.avisos_regras.nossos || '').trim(), instrucoes: String(a.avisos_regras.instrucoes || '').trim(),
            outros: (a.avisos_regras.outros || []).filter(o => String(o.equipe || '').trim() && String(o.assuntos || '').trim()).map(o => ({ equipe: o.equipe.trim(), assuntos: o.assuntos.trim() })),
            responsaveis: (a.avisos_regras.responsaveis || []).filter(r => r.pessoa_id).map(r => ({ cliente_id: r.cliente_id || null, assunto: r.assunto || 'qualquer', pessoa_id: r.pessoa_id })) } }).eq('id', 1);
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
    /* 4.83.0: organização nova — cada coisa num lugar só, em 5 grupos */
    const n = (v) => v ? v : null;
    const GRUPOS = [
      ['Início', [['geral', 'Visão geral', null, true]]],
      ['Para você', [['meu', 'Meu jeito de enviar'], ['modelos', 'Modelos de texto']]],
      ['Equipe e clientes', [['respostas', 'Respostas rápidas', n((S.w.respostas || []).length)], ['grupos', 'Grupos e clientes', n(S.grupos.filter(g => !g.cliente_id && !g.arquivada).length), true],
        ['avisos', 'Avisos e horários', null, true], ['assuntos', 'Assuntos e responsáveis', S.a && S.a.avisos_regras ? n((S.a.avisos_regras.responsaveis || []).length) : null, true]]],
      ['Otto', S.adm && B7.AssistenteWA && B7.AssistenteWA.ABAS_OTTO ? B7.AssistenteWA.ABAS_OTTO.map(([k, r]) => ['otto-' + k, r, null, true, true]) : []],
      ['Sistema', [['conexao', 'Números do WhatsApp', S.numeros ? n(S.numeros.length) : null, true], ['arquivos', 'Arquivos e conversas', null, true]]]
    ].map(([t, l]) => [t, l.filter(a => S.adm || !a[3])]).filter(([, l]) => l.length);
    const todos = GRUPOS.flatMap(([, l]) => l), atualA = todos.find(a => a[0] === S.aba) || todos[0];
    const e = S.estado, on = e && e.estado === 'open', d = S.drive || {}, dOk = d.conectado && d.status === 'ativa';

    const ic = a => a[4] ? B7.AssistenteWA.icone(a[0].slice(5)) : icone(a[0]);
    raiz.innerHTML =
      '<header class="cwa-topo">' +
        '<a class="cwa-volta" href="#/whatsapp" aria-label="Voltar para as conversas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>' +
        '<span class="cwa-topo-ic">' + icone('conexao') + '</span>' +
        '<div class="cwa-topo-t"><h1>Configurações do WhatsApp</h1><p>' + (S.adm ? 'Conversas, avisos, ' + esc(S.ottoNome) + ' e arquivos — tudo num lugar' : 'Seu jeito de mandar mensagem e as respostas da equipe') + '</p></div>' +
        (S.adm ? pilulas() : '') + '</header>' +
      '<div class="asw-casca">' +
        '<nav class="asw-nav cwa-nav" aria-label="Seções">' + GRUPOS.map(([t, l]) => '<div class="cwa-ng"><span class="cwa-ng-t">' + t + (t === 'Otto' ? '<i class="' + (S.ottoAtivo ? 'on' : '') + '"></i>' : '') + '</span>' +
          l.map(a => '<button class="' + (S.aba === a[0] ? 'on' : '') + '" data-aba="' + a[0] + '"' + (S.aba === a[0] ? ' aria-current="page"' : '') + '>' + ic(a) + '<span>' + a[1] + '</span>' + (a[2] != null ? '<b>' + a[2] + '</b>' : '') + '</button>').join('') + '</div>').join('') + '</nav>' +
        '<section class="asw-corpo">' +
          '<header class="cwa-cab"><span class="cwa-cab-ic">' + ic(atualA) + '</span><div><small>' + (GRUPOS.find(([, l]) => l.includes(atualA)) || [''])[0] + '</small><h2>' + atualA[1] + '</h2>' + (DESC[atualA[0]] ? '<p>' + DESC[atualA[0]].replace(/\{otto\}/g, esc(S.ottoNome)) + '</p>' : '') + '</div></header>' +
          corpo() + '</section>' +
      '</div>' +
      '<div class="asw-barra" aria-hidden="true"><span>Alterações ainda não salvas</span><button class="b" data-desfazer>Desfazer</button><button class="b pri" data-salvar>Salvar</button></div>';
    raiz.scrollTop = sc;
    const host = raiz.querySelector('#cwa-otto');
    if (host && B7.AssistenteWA) B7.AssistenteWA.abrir({ el: host, aba: S.aba.slice(5) });
    if (B7.Escolha) B7.Escolha.melhorar(raiz);
    marcarSujo();
  }

  const gcfg = jid => ((S.a && S.a.grupos) || {})[jid] || {};
  function pilulas() {
    const e = S.estado, on = e && e.estado === 'open', d = S.drive || {}, dOk = d.conectado && d.status === 'ativa';
    const pil = (est, t, aba) => '<button class="cwa-pil ' + est + '" data-aba="' + aba + '"><i></i>' + t + '</button>';
    return '<div class="cwa-pils">' +
      pil(e == null ? 'esp' : on ? 'ok' : 'ruim', e == null ? 'Número…' : on ? 'Número conectado' : 'Número desconectado', 'conexao') +
      pil(S.ottoAtivo ? 'ok' : 'off', esc(S.ottoNome) + (S.ottoAtivo ? ' ligado' : ' desligado'), 'otto-geral') +
      pil(S.drive == null ? 'esp' : dOk ? (S.uso && S.uso.sistema ? 'meio' : 'ok') : 'ruim', S.drive == null ? 'Drive…' : dOk ? 'Drive conectado' : 'Drive desconectado', 'arquivos') + '</div>';
  }
  function corpo() {
    const w = S.w, a = S.a, p = S.p;
    if (String(S.aba).startsWith('otto-')) return '<div id="cwa-otto" class="cwa-otto"><div class="asw-carrega"><i></i>Abrindo o ' + esc(S.ottoNome) + '…</div></div>';
    if (S.aba === 'geral') {
      const e = S.estado, on = e && e.estado === 'open', d = S.drive || {}, dOk = d.conectado && d.status === 'ativa';
      const semCli = S.grupos.filter(g => !g.cliente_id && !g.arquivada).length;
      const card = (k, t, st, txt, acao) => '<button class="cwa-card ' + st + '" data-aba="' + k + '"><span class="cwa-card-ic">' + icone(k) + '</span><span class="cwa-card-t"><b>' + t + '</b><small>' + txt + '</small></span><i class="cwa-pt"></i><em>' + acao + ' ›</em></button>';
      return bloco('', '',
        '<div class="cwa-cards">' +
          (S.numeros && S.numeros.length > 1
            ? (() => { const off = S.numeros.filter(x => x.estado !== 'open'); return card('conexao', 'Números do WhatsApp', off.length ? 'ruim' : 'ok',
                off.length ? off.map(x => esc(x.nome)).join(', ') + (off.length > 1 ? ' desconectados' : ' desconectado') : S.numeros.length + ' números conectados', off.length ? 'Conectar' : 'Ver'); })()
            : card('conexao', 'Número do WhatsApp', e == null ? 'esp' : on ? 'ok' : 'ruim', e == null ? 'Conferindo…' : on ? 'Conectado' + (e.numero ? ' · +' + esc(e.numero) : '') : 'Desconectado — leia o QR Code de novo', on ? 'Ver' : 'Conectar')) +
          card('arquivos', 'Arquivos no Google Drive', S.drive == null ? 'esp' : dOk ? (S.uso && S.uso.sistema ? 'meio' : 'ok') : 'ruim',
            S.drive == null ? 'Conferindo…' : dOk ? (S.uso && S.uso.sistema ? S.uso.sistema + ' arquivo(s) ainda indo para o Drive' : 'Tudo guardado no Drive') : 'Drive desconectado — os arquivos pesam no sistema', dOk ? 'Ver' : 'Conectar') +
          card('grupos', 'Grupos ligados a clientes', semCli ? 'meio' : 'ok', semCli ? semCli + ' grupo(s) sem cliente — o Otto e os avisos não sabem de quem são' : 'Todos os grupos ativos têm cliente', semCli ? 'Ligar' : 'Ver') +
          card('avisos', 'Aviso de cliente esperando', a && a.push_espera_min > 0 ? 'ok' : 'meio', a && a.push_espera_min > 0 ? 'No celular depois de ' + a.push_espera_min + ' min sem resposta' : 'Aviso no celular desligado', 'Ajustar') +
        '</div>') +
        bloco('Atalhos', '',
          '<div class="cwa-atalhos"><button class="b contorno" data-acao="importar">Puxar conversas recentes</button><button class="b contorno" data-aba="otto-geral">Abrir o ' + esc(S.ottoNome) + '</button><button class="b contorno" data-aba="respostas">Criar resposta rápida</button></div>');
    }
    if (S.aba === 'meu') {
      const nomeAss = esc(p.nome || primeiro(eu().nome) || 'Seu nome');
      const chat = '<div class="cwa-tel"><div class="cwa-tel-cab"><span class="esc-av" style="--c:#7C4DFF"><b>SF</b></span><span><b>Sabor da Feira</b><small>grupo · 6 pessoas</small></span></div>' +
        '<div class="cwa-tel-msgs"><div class="cwa-msg ele">Bom dia! A arte da Black Friday sai hoje? 🙏<i>09:12</i></div>' +
        '<div class="cwa-msg eu">' + (p.assinatura ? '<b>' + nomeAss + ':</b><br>' : '') + 'Bom dia! Sai sim, até as 15h te mando aqui 🎨<i>09:14 ✓✓</i></div></div></div>';
      return '<div class="cwa-duo">' +
        bloco('Assinatura', 'Vale só para você. O nome entra em negrito no começo das mensagens que você manda pelo B7, para o cliente saber quem falou.',
          linha('Assinar minhas mensagens', 'Desligado: a mensagem sai sem nome, como se fosse da Branding7.', chave('p.assinatura', p.assinatura)) +
          linha('Nome na assinatura', 'Em branco usa o seu primeiro nome.', '<input class="campo cwa-txt" data-c="p.nome" maxlength="40" placeholder="' + esc(primeiro(eu().nome) || 'Seu nome') + '" value="' + esc(p.nome) + '">', p.assinatura ? '' : 'off') +
          linha('Enter envia a mensagem', 'Desligado: Enter pula linha e você envia no botão. No celular, Enter sempre pula linha.', chave('p.enter', p.enter)) +
          linha('Velocidade dos áudios', 'Já começa marcada em todo áudio da Central. Dá para trocar no próprio áudio.', seg('p.vel', p.vel, [[1, '1×'], [1.5, '1,5×'], [2, '2×']]))) +
        '<aside class="cwa-lado"><small class="cwa-rot">Assim o cliente vê</small>' + chat + '</aside></div>';
    }
    if (S.aba === 'respostas') {
      const lista = w.respostas || [];
      if (S.rrSel == null || S.rrSel >= lista.length) S.rrSel = lista.length ? 0 : -1;
      const r = lista[S.rrSel];
      const cliEx = 'Sabor da Feira';
      const prev = r ? esc(String(r.texto || '').replace(/\{cliente\}/g, cliEx).replace(/\{eu\}/g, primeiro(eu().nome) || 'Você')).replace(/\n/g, '<br>') : '';
      const ro = S.adm ? '' : ' readonly';
      return bloco('', 'Na conversa, digite <b>/</b> e o atalho — a resposta entra pronta, é só revisar e enviar. <code>{cliente}</code> vira o nome do cliente e <code>{eu}</code> o seu.' + (S.adm ? '' : ' Só o administrador cria e muda.'),
        '<div class="cwa-rr2">' +
          '<div class="cwa-rr-lista">' + lista.map((x, i) => '<button type="button" class="cwa-rr-card' + (i === S.rrSel ? ' on' : '') + (!x.atalho || !String(x.texto || '').trim() ? ' inc' : '') + '" data-rr="' + i + '">' +
              '<span class="cwa-rr-at">/' + esc(x.atalho || '…') + '</span><b>' + esc(x.titulo || x.atalho || 'Nova resposta') + '</b><small>' + esc(String(x.texto || 'Sem texto ainda').replace(/\s+/g, ' ').slice(0, 64)) + '</small></button>').join('') +
            (S.adm ? '<button type="button" class="cwa-rr-nova" data-acao="nova-resposta"><span>+</span>Nova resposta</button>' : '') +
            (!lista.length && !S.adm ? '<div class="asw-nada">Nenhuma resposta rápida ainda.</div>' : '') + '</div>' +
          (r ? '<div class="cwa-rr-ed">' +
            '<div class="cwa-rr-campos"><label class="cwa-atalho"><span>/</span><input data-r="' + S.rrSel + '" data-k="atalho" value="' + esc(r.atalho) + '" maxlength="20" placeholder="atalho"' + ro + '></label>' +
              '<input class="campo" data-r="' + S.rrSel + '" data-k="titulo" value="' + esc(r.titulo || '') + '" maxlength="60" placeholder="Nome (opcional)"' + ro + '>' +
              (S.adm ? '<button type="button" class="wz-ic cwa-x" data-tira="' + S.rrSel + '" title="Apagar esta resposta" aria-label="Apagar esta resposta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>' : '') + '</div>' +
            '<textarea class="campo" data-r="' + S.rrSel + '" data-k="texto" rows="5" maxlength="2000" placeholder="Escreva a resposta… use {cliente} para o nome do cliente"' + ro + '>' + esc(r.texto) + '</textarea>' +
            (S.adm ? '<div class="cwa-vars"><span>Inserir:</span><button type="button" data-var="{cliente}">nome do cliente</button><button type="button" data-var="{eu}">meu nome</button></div>' : '') +
            '<div class="cwa-rr-prev"><small class="cwa-rot">Prévia — conversa com ' + cliEx + '</small><div class="cwa-msg eu">' + (prev || '<span class="leve">…</span>') + '</div></div>' +
          '</div>' : '<div class="cwa-rr-ed vazio"><b>Nenhuma resposta rápida</b><small>Crie a primeira: “/ok” para confirmar recebimento, “/aprova” para cobrar aprovação…</small></div>') +
        '</div>');
    }
    if (S.aba === 'modelos') {
      return bloco('', 'Em branco volta ao texto padrão.',
        '<div class="cwa-mod">' + Object.keys(NOME_MODELO).map(t => '<label class="cwa-mod-i"><span><b>' + NOME_MODELO[t][0] + '</b><small>' + NOME_MODELO[t][1] + '</small></span>' +
          '<textarea class="campo" data-m="' + t + '" rows="4">' + esc(p.modelos[t]) + '</textarea></label>').join('') + '</div>' +
        '<p class="cwa-dica">Pode usar: <code>{cliente}</code> <code>{titulo}</code> <code>{data}</code> <code>{hora}</code> <code>{local}</code> <code>{link}</code> <code>{texto}</code></p>');
    }
    if (S.aba === 'avisos' && a) {
      const h = a.horario || {};
      const passoTl = (on, ic, t, d) => '<div class="cwa-tl-p' + (on ? '' : ' off') + '"><span class="cwa-tl-ic">' + ic + '</span><b>' + t + '</b><small>' + d + '</small></div>';
      const tl = '<div class="cwa-tl">' +
        passoTl(true, '💬', 'Cliente escreve', 'e ninguém responde') +
        passoTl(a.push_espera_min > 0, '📱', a.push_espera_min > 0 ? a.push_espera_min + ' min depois' : 'Celular', a.push_espera_min > 0 ? 'aviso no celular' : 'desligado') +
        passoTl(true, '👥', a.vigia_min + ' min depois', esc(S.ottoNome) + ' avisa no grupo') +
      '</div>';
      const pessoas = S.pessoas.filter(x => S.quemVe.has(x.id) || (a.push_para || []).includes(x.id));
      return bloco('Cliente esperando a gente', 'Só conta depois que o ' + esc(S.ottoNome) + ' lê a conversa e confirma que o cliente espera resposta — “ok” e “obrigado” não disparam nada.',
          tl +
          linha('Aviso no celular', 'Notificação para quem cuida do WhatsApp.', passo('a.push_espera_min', a.push_espera_min, 0, 600, 'min', [[0, 'Desligado'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h']]), 'cwa-pilha2') +
          linha('Quem recebe', (a.push_para || []).length ? '' : 'Ninguém marcado: recebe todo mundo que tem acesso ao WhatsApp.',
            '<div class="cwa-pessoas">' + pessoas.map(x => '<button type="button" class="cwa-pes' + ((a.push_para || []).includes(x.id) ? ' on' : '') + '" data-push="' + x.id + '"><span class="esc-av" style="--c:' + corNome(x.nome) + '"><b>' + esc(ini(x.nome)) + '</b></span>' + esc(primeiro(x.nome)) + '<i>✓</i></button>').join('') + '</div>', 'cwa-pilha2') +
          linha('Aviso no grupo da equipe', 'Print da conversa e marcação da coordenação.', passo('a.vigia_min', a.vigia_min, 5, 600, 'min', [[10, '10 min'], [20, '20 min'], [30, '30 min'], [60, '1 h']]), 'cwa-pilha2')) +
        bloco('Nos grupos de cliente', 'O que o ' + esc(S.ottoNome) + ' faz quando um cliente escreve.',
          linha('Modo', a.modo_clientes === 'atende' ? 'Atender: responde o cliente quando chamado.' : 'Só vigiar: não responde o cliente; se ninguém da equipe responder, avisa no grupo da equipe.',
            seg('a.modo_clientes', a.modo_clientes, [['vigia', 'Só vigiar'], ['atende', 'Atender']]))) +
        bloco('A gente esperando o cliente', 'Mandamos algo que pede retorno (aprovação, material, confirmação) e o cliente sumiu.',
          linha('Lembrar a equipe', 'Uma mensagem no grupo da equipe com tudo o que está parado.', passo('a.esperando_cliente_h', a.esperando_cliente_h, 0, 240, 'h', [[0, 'Desligado'], [12, '12 h'], [24, '1 dia'], [48, '2 dias']]), 'cwa-pilha2') +
          linha('Avisos de prazo e aprovação', 'Demandas atrasadas, vencendo amanhã e aprovações paradas.', chave('a.alertas_ligados', a.alertas_ligados)) +
          linha('Resumo do dia', 'Entregas, o que vence amanhã, atrasos e quem espera resposta — 1 vez por dia útil, no grupo da equipe.',
            '<div class="cwa-par">' + (a.resumo_dia_ligado ? '<input class="campo cwa-hora" type="time" data-c="a.resumo_dia_hora" value="' + esc(a.resumo_dia_hora || '18:00') + '">' : '') + chave('a.resumo_dia_ligado', a.resumo_dia_ligado) + '</div>')) +
        bloco('Horário de atendimento', 'Fora dele os avisos esperam o próximo horário e o ' + esc(S.ottoNome) + ' avisa o cliente que o time responde depois.',
          linha('Usar horário de atendimento', '', chave('a.horario.ativo', !!h.ativo)) +
          '<div class="asw-horario cwa-hor' + (h.ativo ? '' : ' off') + '"><div class="cwa-dias">' + DIAS.map(([d, r]) => '<button type="button" class="' + ((h.dias || []).map(String).includes(d) ? 'on' : '') + '" data-dia="' + d + '">' + r + '</button>').join('') + '</div>' +
          '<div class="cwa-horas"><label><small>Começa</small><input class="campo" type="time" data-c="a.horario.ini" value="' + esc(h.ini || '08:00') + '"></label><i>→</i><label><small>Termina</small><input class="campo" type="time" data-c="a.horario.fim" value="' + esc(h.fim || '18:00') + '"></label></div>' +
          '<label class="cwa-lbl">Mensagem para o cliente fora do horário<textarea class="campo" data-c="a.horario.mensagem" rows="2" maxlength="400">' + esc(h.mensagem || '') + '</textarea></label></div>');
    }
    if (S.aba === 'assuntos' && a) {
      const r = a.avisos_regras, ASS = [['qualquer', 'Qualquer assunto'], ['artes', 'Artes / design'], ['video', 'Vídeos e edição'], ['gravacao', 'Gravações'], ['roteiro', 'Roteiros'], ['legenda', 'Legendas']];
      const optCli = '<option value="">Todos os clientes</option>' + S.clientes.map(c => '<option value="' + c.id + '"' + (c.logo_url ? ' data-img="' + esc(c.logo_url) + '"' : '') + '>' + esc(c.nome) + '</option>').join('');
      const optAss = ASS.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
      const optPes = '<option value="">Escolher pessoa</option>' + S.pessoas.map(x => '<option value="' + x.id + '" data-sub="' + esc(x.papel === 'admin' ? 'Administrador' : x.papel === 'coordenador' ? 'Coordenação' : x.papel === 'designer' ? 'Design' : x.papel === 'videomaker' ? 'Vídeo' : x.papel) + '">' + esc(x.nome) + '</option>').join('');
      const sel = (opts, v) => v ? opts.replace('value="' + v + '"', 'value="' + v + '" selected') : opts;
      return bloco('O que é da Branding7', 'É disso que o ' + esc(S.ottoNome) + ' cuida: avisa no grupo da equipe, cobra resposta e lembra do que está parado.',
          '<textarea class="campo" data-c="a.avisos_regras.nossos" rows="2" maxlength="600" placeholder="vídeos, artes, edição, gravação, roteiros…">' + esc(r.nossos) + '</textarea>' +
          '<div class="cwa-tags">' + String(r.nossos || '').split(',').map(x => x.trim()).filter(Boolean).map(x => '<span>' + esc(x) + '</span>').join('') + '</div>') +
        bloco('O que é de outra equipe', 'Quando o assunto é de outra equipe, o ' + esc(S.ottoNome) + ' não cobra a Branding7, não marca ninguém daqui e, se perguntarem, diz com quem é.',
          '<div class="cwa-outros">' + (r.outros || []).map((o, i) => '<div class="cwa-outro"><input class="campo cwa-outro-n" data-outro="' + i + '" data-k="equipe" value="' + esc(o.equipe) + '" maxlength="40" placeholder="Equipe (ex.: Núcleo7)">' +
            '<textarea class="campo" data-outro="' + i + '" data-k="assuntos" rows="2" maxlength="600" placeholder="comercial, tráfego pago, link de pagamento…">' + esc(o.assuntos) + '</textarea>' +
            '<button type="button" class="wz-ic cwa-x" data-tira-outro="' + i + '" title="Tirar esta equipe" aria-label="Tirar esta equipe">✕</button></div>').join('') + '</div>' +
          '<button type="button" class="b contorno cwa-mais" data-acao="novo-outro">+ Outra equipe</button>') +
        bloco('Quem responde por quê', 'Quando um cliente espera a gente num desses assuntos, o ' + esc(S.ottoNome) + ' marca a pessoa certa (no aviso e no lembrete). Sem regra, marca a coordenação. A regra de um cliente vale mais que a de “Todos os clientes”.',
          ((r.responsaveis || []).length ? '<div class="cwa-resp">' + r.responsaveis.map((x, i) =>
            '<div class="cwa-resp-i"><div class="cwa-resp-q"><small>Cliente</small><select class="campo" data-escolha data-busca="Buscar cliente" data-titulo="Cliente" data-resp="' + i + '" data-k="cliente_id" aria-label="Cliente">' + sel(optCli, x.cliente_id || '') + '</select></div>' +
            '<div class="cwa-resp-q"><small>Assunto</small><select class="campo" data-escolha data-sem-foto data-titulo="Assunto" data-resp="' + i + '" data-k="assunto" aria-label="Assunto">' + sel(optAss, x.assunto || 'qualquer') + '</select></div>' +
            '<i class="cwa-resp-seta" aria-hidden="true">→</i>' +
            '<div class="cwa-resp-q"><small>Marca</small><select class="campo" data-escolha data-titulo="Quem responde" data-vazio="Escolher pessoa" data-resp="' + i + '" data-k="pessoa_id" aria-label="Pessoa">' + sel(optPes, x.pessoa_id || '') + '</select></div>' +
            '<button type="button" class="wz-ic cwa-x" data-tira-resp="' + i + '" title="Tirar esta regra" aria-label="Tirar esta regra">✕</button></div>').join('') + '</div>'
            : '<div class="asw-nada">Nenhuma regra ainda: tudo vai para a coordenação.</div>') +
          '<button type="button" class="b contorno cwa-mais" data-acao="novo-resp">+ Responsável</button>') +
        bloco('Instruções', 'Regras livres que o ' + esc(S.ottoNome) + ' segue ao avisar e ao falar com a equipe. Escreva como falaria com ele.',
          '<textarea class="campo" data-c="a.avisos_regras.instrucoes" rows="5" maxlength="3000" placeholder="Ex.: Consulta do Dr. Fabrício quem marca é a Thalita, não é reunião. Aprovação de vídeo é com o Matheus.">' + esc(r.instrucoes) + '</textarea>');
    }
    if (S.aba === 'grupos') {
      const f = S.busca.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const cliDe = g => S.gMud[g.jid] !== undefined ? S.gMud[g.jid] : g.cliente_id;
      const ativos = S.grupos.filter(g => !g.arquivada), ligados = ativos.filter(g => cliDe(g)).length;
      let lista = S.grupos.filter(g => !f || String(g.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(f));
      if (S.filtroG === 'sem') lista = lista.filter(g => !cliDe(g) && !g.arquivada);
      if (S.filtroG === 'com') lista = lista.filter(g => cliDe(g));
      const opts = '<option value="">Nenhum cliente</option>' + S.clientes.map(c => '<option value="' + c.id + '"' + (c.logo_url ? ' data-img="' + esc(c.logo_url) + '"' : '') + '>' + esc(c.nome) + '</option>').join('');
      const pct = ativos.length ? Math.round(ligados / ativos.length * 100) : 100;
      return bloco('', '',
        '<div class="cwa-prog"><div><b>' + ligados + ' de ' + ativos.length + '</b> grupos ativos ligados a um cliente</div><i style="--p:' + pct + '%"></i></div>' +
        '<div class="cwa-gtopo"><label class="esc-busca cwa-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg><input data-busca placeholder="Buscar grupo" value="' + esc(S.busca) + '"></label>' +
          seg('filtroG', S.filtroG, [['todos', 'Todos'], ['sem', 'Sem cliente'], ['com', 'Ligados']]) + '</div>' +
        (lista.length ? '<div class="cwa-gl">' + lista.slice(0, 200).map(g => {
          const cid = cliDe(g) || '';
          return '<div class="cwa-g' + (cid ? '' : ' sem') + (S.gMud[g.jid] !== undefined ? ' mud' : '') + (g.arquivada ? ' arq' : '') + '">' +
            '<span class="esc-av g" style="--c:' + corNome(g.nome) + '">' + (g.foto_url ? '<img src="' + esc(g.foto_url) + '" alt="" onerror="this.remove()">' : '') + '<b>' + esc(ini(g.nome)) + '</b></span>' +
            '<span class="cwa-g-t"><b>' + esc(g.nome || 'Grupo') + '</b><small>' + (g.arquivada ? 'Arquivado · ' : '') + (g.ultima_em ? 'última mensagem ' + new Date(g.ultima_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'sem mensagens') + '</small></span>' +
            (cid ? '<span class="cwa-g-otto"><button type="button" class="cwa-g-reg' + (gcfg(g.jid).regras ? ' tem' : '') + '" data-g-reg="' + esc(g.jid) + '" title="Regras do ' + esc(S.ottoNome) + ' só neste grupo">' + (gcfg(g.jid).regras ? 'Regras ✓' : 'Regras') + '</button>' +
              '<label title="' + esc(S.ottoNome) + ' neste grupo"><span>' + esc(S.ottoNome) + '</span><span class="asw-tg"><input type="checkbox" data-otto-g="' + esc(g.jid) + '"' + (gcfg(g.jid).desligado ? '' : ' checked') + '><span></span></span></label></span>' : '<span></span>') +
            '<i class="cwa-g-seta" aria-hidden="true">→</i>' +
            '<select class="campo" data-escolha data-busca="Buscar cliente" data-vazio="Ligar a um cliente" data-titulo="Cliente do grupo" aria-label="Cliente do grupo ' + esc(g.nome || '') + '" data-g="' + esc(g.jid) + '">' + opts.replace('value="' + cid + '"', 'value="' + cid + '" selected') + '</select>' +
            (cid && S.gReg === g.jid ? '<input class="campo cwa-g-regras" data-gr-regra="' + esc(g.jid) + '" maxlength="500" placeholder="Regras do ' + esc(S.ottoNome) + ' só neste grupo (ex.: não mandar áudio aqui)" value="' + esc(gcfg(g.jid).regras || '') + '">' : '') + '</div>';
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
      /* 4.84.0: vários números — um por equipe (Videomakers, Designers, Coordenação…) */
      const ns = S.numeros;
      const ROT = { open: ['ok', 'Conectado'], connecting: ['esp', 'Esperando o QR Code'], close: ['ruim', 'Desconectado'], sem_conexao: ['ruim', 'Desconectado'] };
      const EQ = { videomaker: 'Vídeo', designer: 'Design', coordenador: 'Coordenação' };
      const linhaN = x => { const [cl, tx] = ROT[x.estado] || ['esp', 'Conferindo…'], on = x.estado === 'open';
        return '<div class="cwa-num-l ' + cl + '" data-num-l="' + esc(x.id) + '"><i class="cwa-num-cor" style="--c:' + esc(x.cor) + '"></i>' +
          '<div class="cwa-num-t"><b>' + esc(x.nome) + (x.padrao ? ' <em class="cwa-num-selo">Padrão · ' + esc(S.ottoNome) + '</em>' : '') + '</b>' +
            '<small><span class="cwa-num-est"><i></i>' + tx + '</span>' + (x.numero ? ' · +' + esc(x.numero) : '') + '</small>' +
            '<span class="cwa-num-eq">' + ((x.equipes || []).length ? x.equipes.map(q => '<span>' + esc(EQ[q] || q) + '</span>').join('') : '<span class="vazio">Só administrador</span>') + '</span></div>' +
          '<div class="cwa-num-ac"><button class="b ' + (on ? 'contorno' : 'pri') + '" data-acao="n-conectar" data-id="' + esc(x.id) + '">' + (on ? 'Detalhes' : 'Conectar') + '</button>' +
            '<button class="b contorno" data-acao="n-editar" data-id="' + esc(x.id) + '">Editar</button>' +
            '<button class="b contorno" data-acao="n-importar" data-id="' + esc(x.id) + '" title="Puxar conversas recentes deste número">Puxar conversas</button>' +
            (x.padrao ? '' : '<button class="b contorno perigo" data-acao="n-desativar" data-id="' + esc(x.id) + '">Desativar</button>') +
            '</div></div>'; };
      return bloco('', 'Cada equipe atende pelo seu número. Quem é da equipe vê só o número dela; o administrador vê todos e alterna na Central.',
          (ns == null ? '<div class="cwa-drive esp"><i></i><div><b>Conferindo os números…</b></div></div>' :
            '<div class="cwa-nums">' + ns.map(linhaN).join('') + '</div>') +
          '<div class="cwa-atalhos"><button class="b pri" data-acao="n-novo">+ Adicionar número</button></div>') +
        bloco('Quem acessa', '',
          linha('Equipes de cada número', 'Videomaker, designer ou coordenador (papel ou função extra) veem o número da sua equipe. Muda em Pessoas e acessos.', '<a class="b contorno" href="#/usuarios">Pessoas e acessos</a>'));
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
    if (t.closest && t.closest('#cwa-otto')) return;   /* a parte do Otto cuida dos próprios campos */
    if (t.dataset.busca != null) { S.busca = t.value; const pos = t.selectionStart; desenhar(); const i = raiz.querySelector('[data-busca]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } return; }
    if (t.dataset.ottoG) { S.a.grupos[t.dataset.ottoG] = Object.assign({}, gcfg(t.dataset.ottoG), { desligado: !t.checked }); return marcarSujo(); }
    if (t.dataset.grRegra) { S.a.grupos[t.dataset.grRegra] = Object.assign({}, gcfg(t.dataset.grRegra), { regras: t.value.slice(0, 500) }); return marcarSujo(); }
    if (t.dataset.g) { const g = S.grupos.find(x => x.jid === t.dataset.g); if (g && (g.cliente_id || '') === t.value) delete S.gMud[g.jid]; else S.gMud[t.dataset.g] = t.value; t.closest('.cwa-g').classList.toggle('mud', S.gMud[t.dataset.g] !== undefined); return marcarSujo(); }
    if (t.dataset.r != null) {
      const r = S.w.respostas[+t.dataset.r]; r[t.dataset.k] = t.dataset.k === 'atalho' ? t.value.toLowerCase().replace(/\s+/g, '') : t.value;
      const card = raiz.querySelector('[data-rr="' + t.dataset.r + '"]');
      if (card) { card.querySelector('.cwa-rr-at').textContent = '/' + (r.atalho || '…'); card.querySelector('b').textContent = r.titulo || r.atalho || 'Nova resposta'; card.querySelector('small').textContent = String(r.texto || 'Sem texto ainda').replace(/\s+/g, ' ').slice(0, 64); card.classList.toggle('inc', !r.atalho || !String(r.texto || '').trim()); }
      const pv = raiz.querySelector('.cwa-rr-prev .cwa-msg'); if (pv) pv.innerHTML = esc(String(r.texto || '').replace(/\{cliente\}/g, 'Sabor da Feira').replace(/\{eu\}/g, primeiro(eu().nome) || 'Você')).replace(/\n/g, '<br>') || '…';
      return marcarSujo();
    }
    if (t.dataset.m) { S.p.modelos[t.dataset.m] = t.value; return marcarSujo(); }
    if (t.dataset.outro != null) { S.a.avisos_regras.outros[+t.dataset.outro][t.dataset.k] = t.value; return marcarSujo(); }
    if (t.dataset.resp != null) { S.a.avisos_regras.responsaveis[+t.dataset.resp][t.dataset.k] = t.value || null; return marcarSujo(); }
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
    const b = raiz.querySelector('.cwa-msg.eu b'); if (b) b.textContent = (S.p.nome || primeiro(eu().nome) || 'Seu nome') + ':';
  }
  async function clique(e) {
    const t = e.target;
    if (t.closest('#cwa-otto')) return;   /* cliques dentro do Otto são dele */
    const ab = t.closest('[data-aba]');
    if (ab) {
      const nova = ab.dataset.aba, eraOtto = String(S.aba).startsWith('otto-'), vaiOtto = nova.startsWith('otto-');
      if (nova === S.aba) return;
      /* entre seções do Otto: troca só o miolo (não perde o que está sendo editado) */
      if (eraOtto && vaiOtto && B7.AssistenteWA && B7.AssistenteWA.irPara(nova.slice(5))) {
        S.aba = nova; raiz.querySelectorAll('.asw-nav [data-aba]').forEach(b => { const on = b.dataset.aba === nova; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
        try { history.replaceState(null, '', '#/whatsapp/config?aba=' + nova); } catch (x) { /* segue */ }
        return;
      }
      if (eraOtto && B7.AssistenteWA && B7.AssistenteWA.temMudanca() && !(await B7.UI.confirmar({ titulo: 'Sair sem salvar?', texto: 'Há mudanças no ' + S.ottoNome + ' que ainda não foram salvas.', confirmar: 'Sair sem salvar', perigo: true }))) return;
      if (!eraOtto && mudou() && vaiOtto) B7.UI.toast('Suas mudanças daqui continuam marcadas — salve antes de sair da tela.');
      S.aba = nova; try { history.replaceState(null, '', '#/whatsapp/config?aba=' + nova); } catch (x) { /* segue */ }
      desenhar(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    }
    if (t.closest('[data-salvar]')) return salvar();
    if (t.closest('[data-desfazer]')) { const o = JSON.parse(S.orig); S.w = o.w; S.a = o.a; S.p = o.p; S.gMud = {}; return desenhar(); }
    const di = t.closest('[data-dia]'); if (di && S.a) { const h = S.a.horario; const d = Number(di.dataset.dia); h.dias = (h.dias || []).map(Number); h.dias = h.dias.includes(d) ? h.dias.filter(x => x !== d) : h.dias.concat(d); return desenhar(); }
    const pu = t.closest('[data-push]'); if (pu && S.a) { const id = pu.dataset.push; S.a.push_para = (S.a.push_para || []).includes(id) ? S.a.push_para.filter(x => x !== id) : (S.a.push_para || []).concat(id); return desenhar(); }
    const tr = t.closest('[data-tira]'); if (tr) { S.w.respostas.splice(+tr.dataset.tira, 1); S.rrSel = Math.max(0, +tr.dataset.tira - 1); return desenhar(); }
    const gr = t.closest('[data-g-reg]'); if (gr) { S.gReg = S.gReg === gr.dataset.gReg ? null : gr.dataset.gReg; desenhar(); const i = raiz.querySelector('.cwa-g-regras'); if (i) i.focus(); return; }
    const to = t.closest('[data-tira-outro]'); if (to) { S.a.avisos_regras.outros.splice(+to.dataset.tiraOutro, 1); return desenhar(); }
    const tre = t.closest('[data-tira-resp]'); if (tre) { S.a.avisos_regras.responsaveis.splice(+tre.dataset.tiraResp, 1); return desenhar(); }
    const rc = t.closest('[data-rr]'); if (rc) { S.rrSel = +rc.dataset.rr; return desenhar(); }
    const pa = t.closest('[data-passo]'), sg = t.closest('[data-sug]');
    if (pa || sg) {
      const box = t.closest('[data-passo-k]'), k = box.dataset.passoK, min = +box.dataset.min, max = +box.dataset.max;
      const atual = Number(box.querySelector('input').value) || 0;
      const passoDe = v => v >= 120 ? 30 : v >= 60 ? 10 : v >= 20 ? 5 : 1;
      let v = sg ? +sg.dataset.sug : atual + (+pa.dataset.passo) * passoDe(+pa.dataset.passo > 0 ? atual : Math.max(0, atual - 1));
      v = Math.max(min, Math.min(max, v)); setar(k, v); return desenhar();
    }
    const va = t.closest('[data-var]'); if (va) {
      const ta = raiz.querySelector('.cwa-rr-ed textarea'); if (!ta) return;
      const i = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, i) + va.dataset.var + ta.value.slice(ta.selectionEnd ?? i);
      ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); ta.setSelectionRange(i + va.dataset.var.length, i + va.dataset.var.length); return;
    }
    const ac = t.closest('[data-acao]'); if (!ac) return;
    const a = ac.dataset.acao;
    if (a === 'nova-resposta') {
      S.w.respostas = (S.w.respostas || []).concat([{ atalho: '', titulo: '', texto: '' }]); S.rrSel = S.w.respostas.length - 1; desenhar();
      const at = raiz.querySelector('.cwa-rr-ed .cwa-atalho input'); if (at) at.focus();
      return;
    }
    if (a === 'novo-outro') { S.a.avisos_regras.outros.push({ equipe: '', assuntos: '' }); desenhar(); const l = raiz.querySelectorAll('.cwa-outro-n'); if (l.length) l[l.length - 1].focus(); return; }
    if (a === 'novo-resp') { S.a.avisos_regras.responsaveis.push({ cliente_id: null, assunto: 'qualquer', pessoa_id: '' }); return desenhar(); }
    if (a === 'conexao') { if (B7.WaCentral) B7.WaCentral.abrir(); return; }
    if (a === 'n-novo' || a === 'n-editar') return formNumero(a === 'n-editar' ? (S.numeros || []).find(x => x.id === ac.dataset.id) : null);
    if (a === 'n-conectar') { if (B7.WaNumeros) await B7.WaNumeros.carregar(true); if (B7.WaCentral) B7.WaCentral.abrir(ac.dataset.id, recarregarNumeros); return; }
    if (a === 'n-importar') { if (B7.CentralWA && B7.CentralWA.importar) B7.CentralWA.importar(ac.dataset.id); return; }
    if (a === 'n-desativar') {
      const x = (S.numeros || []).find(y => y.id === ac.dataset.id); if (!x) return;
      if (!(await B7.UI.confirmar({ titulo: 'Desativar ' + x.nome + '?', texto: 'As conversas ficam guardadas, mas o número sai da Central e é desconectado do WhatsApp.', confirmar: 'Desativar', perigo: true }))) return;
      try { const r = await B7.DB.waEvolution('numero_desativar', { id: x.id }); if (r.erro) throw new Error(r.erro); B7.UI.toast(x.nome + ' desativado.'); }
      catch (e2) { B7.UI.toast(e2.message, { tipo: 'erro' }); }
      return recarregarNumeros();
    }
    if (a === 'drive') { if (B7.CentralWA && B7.CentralWA.drive) await B7.CentralWA.drive(); carregarVivos(); return; }
    if (a === 'importar') { if (B7.CentralWA && B7.CentralWA.importar) B7.CentralWA.importar(); return; }
  }

  /* 4.84.0: números */
  async function recarregarNumeros() {
    if (!S || !raiz || !raiz.isConnected) return;
    try { const r = await B7.DB.waEvolution('numeros'); S.numeros = r.lista || S.numeros; } catch (e) { /* fica o que tinha */ }
    if (B7.WaNumeros) B7.WaNumeros.carregar(true);
    if (S.aba === 'conexao') desenhar();
  }
  const CORES = ['#E8452C', '#5E47DE', '#1B8F6A', '#2E8BFF', '#C21C83', '#F0A443'];
  function formNumero(x) {
    const eq = new Set((x && x.equipes) || []);
    const usadas = new Set((S.numeros || []).map(y => y.cor));
    let cor = (x && x.cor) || CORES.find(c => !usadas.has(c)) || CORES[0];
    const caixa = (k, r) => '<label class="cwa-nf-eq"><input type="checkbox" value="' + k + '"' + (eq.has(k) ? ' checked' : '') + '><span>' + r + '</span></label>';
    const m = B7.UI.modal('<h3>' + (x ? 'Editar ' + esc(x.nome) : 'Adicionar número') + '</h3>' +
      '<div class="sub">' + (x ? 'O telefone conectado não muda aqui.' : 'Depois de salvar, leia o QR Code com o celular desse número.') + '</div>' +
      '<div class="cwa-nf"><label class="cwa-nf-l"><span>Nome</span><input id="cwa-nf-nome" maxlength="40" placeholder="Ex.: Designers" value="' + esc((x && x.nome) || '') + '"></label>' +
      '<div class="cwa-nf-l"><span>Cor na Central</span><div class="cwa-nf-cores">' + CORES.map(c => '<button type="button" data-cor="' + c + '" style="--c:' + c + '"' + (c === cor ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + ' aria-label="Cor ' + c + '"></button>').join('') + '</div></div>' +
      '<div class="cwa-nf-l"><span>Quem vê este número</span><div class="cwa-nf-eqs">' + caixa('videomaker', 'Videomakers') + caixa('designer', 'Designers') + caixa('coordenador', 'Coordenação') + '</div><small>O administrador sempre vê.</small></div></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" id="cwa-nf-ok">' + (x ? 'Salvar' : 'Salvar e conectar') + '</button></div>', { extra: 'cwa-nf-modal' });
    m.addEventListener('click', e => { const b = e.target.closest('[data-cor]'); if (!b) return; cor = b.dataset.cor; m.querySelectorAll('[data-cor]').forEach(y => { y.classList.toggle('on', y === b); y.setAttribute('aria-pressed', String(y === b)); }); });
    const nome = m.querySelector('#cwa-nf-nome'); setTimeout(() => nome.focus(), 50);
    m.querySelector('#cwa-nf-ok').onclick = async ev => {
      const bt = ev.currentTarget; const v = nome.value.replace(/\s+/g, ' ').trim();
      if (v.length < 2) { B7.UI.toast('Dê um nome ao número (ex.: Designers).'); nome.focus(); return; }
      const equipes = [...m.querySelectorAll('.cwa-nf-eqs input:checked')].map(i => i.value);
      bt.disabled = true; bt.textContent = 'Salvando…';
      try {
        const r = await B7.DB.waEvolution('numero_salvar', { id: x ? x.id : undefined, nome: v, cor, equipes });
        if (r.erro) throw new Error(r.erro);
        m.fechar();
        await recarregarNumeros();
        if (!x && r.numero && B7.WaCentral) { if (B7.WaNumeros) await B7.WaNumeros.carregar(true); B7.WaCentral.abrir(r.numero.id, recarregarNumeros); }
        else B7.UI.toast('Número salvo.');
      } catch (e2) { bt.disabled = false; bt.textContent = x ? 'Salvar' : 'Salvar e conectar'; B7.UI.toast(e2.message, { tipo: 'erro' }); }
    };
  }

  return { abrir };
})();
