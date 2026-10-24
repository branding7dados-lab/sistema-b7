/* =====================================================================
   SUPORTE E FEEDBACK (zzz208) — #/suporte

   A equipe relata um problema, manda uma sugestão, tira uma dúvida ou
   elogia, sem sair do sistema. O chamado leva, sozinho, o que ajuda a
   resolver: a tela em que a pessoa estava, a versão, o aparelho e os
   últimos erros (dá para desmarcar). Print: colar (Ctrl+V), arrastar ou
   escolher.

   Quem abre vê só os seus. Admin e coordenação veem todos, respondem
   (ou deixam nota interna) e mudam o andamento; quem abriu recebe aviso
   no sino a cada resposta e a cada mudança.

   Banco: migration_suporte.sql — suporte_chamados, suporte_mensagens e a
   pasta privada "suporte". Toda escrita passa pelas funções do banco.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Suporte = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const painel = () => document.getElementById('painel-dashboard');
  const BUCKET = 'suporte';
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const eu = () => { const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario(); return u ? u.id : null; };
  const equipe = () => !!(B7.Auth && B7.Auth.ehEquipe && B7.Auth.ehEquipe());
  /* zzz223: o cliente do Portal também tem Suporte (sem ideias da equipe, sem tutoriais internos) */
  const souCliente = () => !!(B7.Auth && B7.Auth.ehCliente && B7.Auth.ehCliente());
  const FECHADOS = ['resolvido', 'nao_vamos_fazer'];

  const TIPOS = {
    bug: { rot: 'Problema', plural: 'Problemas', dica: 'Algo não funciona ou apareceu errado',
      titulo: 'Ex.: o botão Salvar não responde na linha editorial', desc: 'O que você estava fazendo, o que esperava que acontecesse e o que aconteceu de verdade.' },
    sugestao: { rot: 'Sugestão', plural: 'Sugestões', dica: 'Uma ideia para melhorar',
      titulo: 'Ex.: avisar quando o cliente responder no WhatsApp', desc: 'Conte a ideia e em que situação ela ajudaria o seu dia.' },
    duvida: { rot: 'Dúvida', plural: 'Dúvidas', dica: 'Não sei como fazer algo',
      titulo: 'Ex.: como marco uma gravação como remarcada?', desc: 'Diga o que você quer fazer e onde travou.' },
    elogio: { rot: 'Elogio', plural: 'Elogios', dica: 'Algo que ficou bom',
      titulo: 'Ex.: a preparação da gravação ajudou muito', desc: 'Conte o que funcionou bem (ajuda a gente a saber o que manter).' }
  };
  const STATUS = {
    novo: 'Novo', em_analise: 'Em análise', em_andamento: 'Em andamento', resolvido: 'Resolvido', nao_vamos_fazer: 'Não será feito'
  };
  const ABERTOS = ['novo', 'em_analise', 'em_andamento'];
  const PRIO = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

  /* ---- últimos erros da tela (só texto, ficam na memória; vão no chamado se a pessoa deixar) ---- */
  const erros = [];
  const guardarErro = msg => { erros.push({ msg: String(msg || '').slice(0, 220), em: new Date().toISOString() }); if (erros.length > 8) erros.shift(); };
  window.addEventListener('error', e => guardarErro((e && e.message) || 'erro'));
  window.addEventListener('unhandledrejection', e => guardarErro('promessa: ' + ((e && e.reason && (e.reason.message || e.reason)) || 'rejeitada')));

  function plataforma() {
    const ua = navigator.userAgent || '';
    if (/Electron\//.test(ua)) return 'Programa de Windows';
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return 'App de celular';
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'App instalado pelo navegador';
    return 'Navegador';
  }
  function contexto() {
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    let rastro = [];
    try { rastro = (B7.Auth.rastro ? B7.Auth.rastro() : []).slice(-10); } catch (e) {}
    return {
      versao: (B7.Auth && B7.Auth.VERSAO) || '',
      tela: String(location.hash || '#/').split('?')[0],
      plataforma: plataforma(),
      navegador: (navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 160),
      janela: window.innerWidth + '×' + window.innerHeight,
      papel: (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || (u && u.papel) || '',
      online: navigator.onLine,
      erros: erros.slice(),
      rastro
    };
  }
  const contextoTexto = c => [
    'Tela: ' + c.tela, 'Versão: ' + c.versao, 'Onde: ' + c.plataforma + ' · janela ' + c.janela,
    c.erros && c.erros.length ? 'Erros recentes: ' + c.erros.length : 'Sem erros recentes na tela'
  ].join('\n');

  /* ---- imagem: reduz e vira JPEG (print de tela grande pesa) ---- */
  function reduzir(arquivo) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(arquivo), img = new Image();
      img.onload = () => {
        const max = 1600, f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res({ blob: b, url: '' }) : rej(new Error('imagem')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui ler essa imagem.')); };
      img.src = url;
    });
  }

  /* ======================================================== novo chamado */
  function novo(tipoInicial, pre) {
    pre = pre || {};
    let tipo = TIPOS[tipoInicial] ? tipoInicial : 'bug';
    const imagens = [];                         /* { blob, mini } */
    const ctx = contexto();
    const m = B7.UI.modal('<h3>Suporte e feedback</h3>' +
      '<p class="sub">Conte o que aconteceu ou o que você quer. Dúvidas e problemas são atendidos primeiro pelo assistente, na hora; se ele não resolver, chama alguém da equipe. Você recebe aviso no sino.</p>' +
      '<div class="sp-tipos" role="group" aria-label="Tipo">' +
        Object.keys(TIPOS).map(k => '<button type="button" class="sp-tipo" data-tipo="' + k + '"><b>' + TIPOS[k].rot + '</b><small>' + TIPOS[k].dica + '</small></button>').join('') + '</div>' +
      '<div class="mb"><label class="rot" for="sp-tit">RESUMO</label><input class="campo" id="sp-tit" maxlength="140" data-foco value="' + esc(pre.titulo || '') + '"></div>' +
      '<div class="sp-sug" id="sp-sug" hidden></div>' +
      '<div class="mb"><label class="rot" for="sp-desc">DETALHES <span class="leve">— quanto mais, mais rápido a gente resolve</span></label><textarea class="campo" id="sp-desc" rows="5" maxlength="4000">' + esc(pre.descricao || '') + '</textarea></div>' +
      '<label class="sp-urg" id="sp-urg"><input type="checkbox" id="sp-urg-c"> Está me impedindo de trabalhar</label>' +
      '<div class="mb"><label class="rot">PRINT <span class="leve">— opcional</span></label>' +
        '<div class="sp-solta" id="sp-solta" tabindex="0">' + (B7.UI.toque()
          ? '<span><button type="button" class="adm-link" id="sp-escolher">Toque para escolher um print ou foto</button></span>' +
            '<small>Tire o print no celular antes e escolha ele aqui, da galeria.'
          : '<span>Cole um print aqui (<kbd>Ctrl</kbd>+<kbd>V</kbd>), arraste ou <button type="button" class="adm-link" id="sp-escolher">escolha um arquivo</button></span>' +
            '<small>Dica: <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> tira print de uma parte da tela.') +
          (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder ? ' Ou <button type="button" class="adm-link" id="sp-gravar">grave a tela (até 15 s)</button>.' : '') + '</small></div>' +
        '<input type="file" id="sp-arq" accept="image/*" multiple hidden><div class="sp-minis" id="sp-minis"></div></div>' +
      '<label class="sp-info"><input type="checkbox" id="sp-info-c" checked> Enviar junto as informações da tela <button type="button" class="adm-link" id="sp-info-ver">ver o que vai</button></label>' +
      '<pre class="sp-info-tx" id="sp-info-tx" hidden>' + esc(contextoTexto(ctx)) + '</pre>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="sp-enviar">Enviar</button></div>', { larga: true });
    const q = s => m.querySelector(s);
    const pintarTipo = () => {
      m.querySelectorAll('[data-tipo]').forEach(b => b.classList.toggle('on', b.dataset.tipo === tipo));
      q('#sp-tit').placeholder = TIPOS[tipo].titulo; q('#sp-desc').placeholder = TIPOS[tipo].desc;
      q('#sp-urg').hidden = tipo !== 'bug';
    };
    /* zzz210: enquanto a pessoa escreve, mostra tutoriais que talvez resolvam (dúvida e problema) */
    let relSug = null;
    const sugerir = () => {
      const cx = q('#sp-sug'), t = q('#sp-tit').value.trim();
      if (pre.semSugestao) { cx.hidden = true; return; }
      const r = (tipo === 'duvida' || tipo === 'bug') && t.length >= 4 && B7.Ajuda && B7.Ajuda.procurar ? B7.Ajuda.procurar(t).slice(0, 3) : [];
      const ia = (tipo === 'duvida' || tipo === 'bug') && t.length >= 4 && B7.Chat && B7.Chat.abrir && B7.IA && B7.IA.ligada && B7.IA.ligada('chat');
      cx.hidden = !r.length && !ia;
      cx.innerHTML = (r.length ? '<b>Talvez um tutorial resolva:</b>' + r.map(x => '<a href="#/ajuda/' + esc(x.i.id) + '" data-tut><span>' + esc(x.i.titulo) + '</span><small>' + esc(x.i.grupo) + '</small></a>').join('') : '') +
        /* zzz214: o assistente responde pelos tutoriais; só pergunta quando a pessoa toca */
        (ia ? '<button type="button" class="sp-ia" data-ia><span>Perguntar ao assistente antes</span><small>ele responde na hora, com base nos tutoriais</small></button>' : '');
      cx.querySelectorAll('[data-tut]').forEach(a => a.onclick = () => m.fechar());
      const bia = cx.querySelector('[data-ia]');
      if (bia) bia.onclick = () => {
        const texto = q('#sp-tit').value.trim() + (q('#sp-desc').value.trim() ? '\n' + q('#sp-desc').value.trim() : '');
        m.fechar(); B7.Chat.abrir();
        setTimeout(() => { const ta = document.querySelector('#ch-texto'); if (ta) { ta.value = (tipo === 'bug' ? 'Estou com um problema: ' : 'Dúvida: ') + texto; ta.dispatchEvent(new Event('input')); ta.focus(); } }, 250);
      };
    };
    q('#sp-tit').addEventListener('input', () => { clearTimeout(relSug); relSug = setTimeout(sugerir, 250); });
    m.querySelectorAll('[data-tipo]').forEach(b => b.onclick = () => { tipo = b.dataset.tipo; pintarTipo(); sugerir(); });
    pintarTipo(); sugerir();
    q('#sp-info-ver').onclick = () => { const p = q('#sp-info-tx'); p.hidden = !p.hidden; };

    const pintarMinis = () => {
      q('#sp-minis').innerHTML = imagens.map((x, i) => '<span class="sp-mini"><img alt="Print ' + (i + 1) + '" src="' + esc(x.mini) + '"><button type="button" data-tirar="' + i + '" aria-label="Tirar este print">×</button></span>').join('');
      q('#sp-minis').querySelectorAll('[data-tirar]').forEach(b => b.onclick = () => { imagens.splice(+b.dataset.tirar, 1); pintarMinis(); });
    };
    const adicionar = async arquivos => {
      for (const a of arquivos) {
        if (!/^image\//.test(a.type)) continue;
        if (imagens.length >= 3) { B7.UI.toast('Até 3 prints por chamado.', { tipo: 'erro' }); break; }
        try { const r = await reduzir(a); imagens.push({ blob: r.blob, mini: r.url || URL.createObjectURL(r.blob) }); pintarMinis(); }
        catch (e) { B7.UI.toast((e && e.message) || 'Não consegui ler essa imagem.', { tipo: 'erro' }); }
      }
    };
    /* zzz214: gravação da tela (até 15 s), para mostrar o problema acontecendo */
    let video = null;
    const pintarVideo = () => {
      let v = q('#sp-vid'); if (v) v.remove();
      if (!video) return;
      v = document.createElement('span'); v.className = 'sp-mini sp-vid'; v.id = 'sp-vid';
      v.innerHTML = '<video src="' + video.url + '" muted playsinline></video><button type="button" aria-label="Tirar a gravação">×</button>';
      v.querySelector('button').onclick = () => { URL.revokeObjectURL(video.url); video = null; pintarVideo(); };
      q('#sp-minis').appendChild(v);
    };
    const bg = q('#sp-gravar');
    const gravar = async () => {
      let fluxo;
      try { fluxo = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false }); }
      catch (e) { return; }
      const tipoV = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(fluxo, { mimeType: tipoV, videoBitsPerSecond: 1200000 }), partes = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
      rec.onstop = () => {
        fluxo.getTracks().forEach(t => t.stop());
        const blob = new Blob(partes, { type: 'video/webm' });
        bg.textContent = 'grave de novo (até 15 s)'; bg.onclick = gravar;
        if (blob.size > 24 * 1048576) { B7.UI.toast('A gravação ficou grande demais. Grave menos tempo.', { tipo: 'erro' }); return; }
        if (video) URL.revokeObjectURL(video.url);
        video = { blob, url: URL.createObjectURL(blob) }; pintarVideo();
      };
      fluxo.getVideoTracks()[0].addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
      rec.start(1000); let s = 15;
      bg.textContent = 'gravando… parar (15 s)';
      const tic = setInterval(() => { s--; if (rec.state === 'inactive' || s <= 0) { clearInterval(tic); if (rec.state !== 'inactive') rec.stop(); } else bg.textContent = 'gravando… parar (' + s + ' s)'; }, 1000);
      bg.onclick = () => { clearInterval(tic); if (rec.state !== 'inactive') rec.stop(); };
    };
    if (bg) bg.onclick = gravar;
    const arq = q('#sp-arq');
    q('#sp-escolher').onclick = () => arq.click();
    arq.onchange = () => { adicionar([...arq.files]); arq.value = ''; };
    const solta = q('#sp-solta');
    solta.addEventListener('dragover', e => { e.preventDefault(); solta.classList.add('sobre'); });
    solta.addEventListener('dragleave', () => solta.classList.remove('sobre'));
    solta.addEventListener('drop', e => { e.preventDefault(); solta.classList.remove('sobre'); adicionar([...(e.dataTransfer.files || [])]); });
    m.addEventListener('paste', e => {
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type));
      if (fs.length) { e.preventDefault(); adicionar(fs); }
    });

    /* zzz234: o chamado criado fica guardado; se só o anexo falhar, tentar
       de novo anexa no MESMO chamado em vez de abrir outro */
    let criado = null;
    q('#sp-enviar').onclick = async () => {
      const titulo = q('#sp-tit').value.trim(), desc = q('#sp-desc').value.trim();
      if (titulo.length < 3) { q('#sp-tit').classList.add('erro'); q('#sp-tit').focus(); return B7.UI.toast('Escreva um resumo (pelo menos 3 letras).', { tipo: 'erro' }); }
      const bt = q('#sp-enviar'); bt.disabled = true; bt.textContent = 'Enviando…';
      try {
        const id = criado || (criado = await B7.DB.rpc('suporte_criar', { p_tipo: tipo, p_titulo: titulo, p_descricao: desc, p_urgente: tipo === 'bug' && q('#sp-urg-c').checked,
          p_contexto: q('#sp-info-c').checked ? ctx : { tela: ctx.tela, versao: ctx.versao } }));
        const paths = [];
        for (const im of imagens) {
          const caminho = id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString(16).slice(2)) + '.jpg';
          const r = await sb().storage.from(BUCKET).upload(caminho, im.blob, { contentType: 'image/jpeg', upsert: false });
          if (!r.error) paths.push(caminho);
        }
        if (video) {
          const cv = id + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) + '.webm';
          const rv = await sb().storage.from(BUCKET).upload(cv, video.blob, { contentType: 'video/webm', upsert: false });
          if (!rv.error) paths.push(cv);
        }
        if (paths.length) await B7.DB.rpc('suporte_anexar', { p_id: id, p_paths: paths });
        m.fechar();
        B7.UI.toast(imagens.length && paths.length < imagens.length ? 'Chamado enviado, mas algum print não subiu.' : 'Chamado aberto. O atendimento responde por aqui.');
        if (/^#\/suporte/.test(location.hash)) abrir(id); else location.hash = '#/suporte/' + id;
      } catch (e) {
        bt.disabled = false; bt.textContent = criado ? 'Tentar anexar de novo' : 'Enviar';
        B7.UI.toast((criado ? 'O chamado foi aberto, mas os anexos não subiram: ' : 'Não foi possível enviar: ') + ((e && e.message) || 'erro'), { tipo: 'erro' });
      }
    };
  }

  /* ============================================================== telas
     zzz215: DUAS telas no mesmo endereço (#/suporte):
       · EQUIPE — "Suporte": pedir ajuda em um toque (os quatro tipos), os
         seus chamados como conversas e as ideias da equipe para votar.
       · ADMINISTRAÇÃO (admin e coordenação) — "Central de atendimento":
         números da fila, filas à esquerda (caixa de entrada, urgentes,
         sem resposta há 24 h…), lista no meio e o chamado à direita, com
         andamento em um toque, respostas prontas, nota interna e as
         informações técnicas. Ideias em ranking.
     Mesmos dados e mesmas funções do banco de antes. */
  let lista = [], sel = null, fila = 'entrada', tipoF = '', pessoaF = '', vez = 0, q = '', relogio = null, aba = 'chamados';
  let qEq = '', semResReg = '';
  const ultimaResp = {};
  const tentou = { faq: [], ia: '' };
  const quando = iso => (B7.UI.quando ? B7.UI.quando(iso) : String(iso || '').slice(0, 10));
  const horas = iso => (Date.now() - new Date(iso).getTime()) / 36e5;
  const chipStatus = s => '<span class="sp-st sp-st-' + esc(s) + '">' + esc(STATUS[s] || s) + '</span>';
  const ini = n => (B7.UI.iniciais ? B7.UI.iniciais(n || '?') : String(n || '?').slice(0, 2).toUpperCase());
  const av = n => '<span class="sp-av tom-' + esc(B7.UI.tomDoNome ? B7.UI.tomDoNome(n || '') : '1') + '" aria-hidden="true">' + esc(ini(n)) + '</span>';
  const ICT = {
    bug: '<path d="M8 8.5V7a4 4 0 0 1 8 0v1.5"/><rect x="6.5" y="8.5" width="11" height="11" rx="5.5"/><path d="M12 11v8M3.5 13h3M17.5 13h3M4.5 8.5l2 1.5M19.5 8.5l-2 1.5M4.5 18.5l2.2-1.6M19.5 18.5l-2.2-1.6"/>',
    sugestao: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    duvida: '<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8"/><path d="M12 16.6h.01"/>',
    elogio: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
  };
  const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const icTipo = t => '<span class="sp-ict sp-tp-' + esc(t) + '">' + SVG(ICT[t] || ICT.duvida) + '</span>';
  const IC = {
    entrada: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5.5 5h13l1.5 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z"/>',
    urg: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17.3v.1"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.3 2"/>',
    and: '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.8 2.8L16.3 9.6"/>',
    nao: '<circle cx="12" cy="12" r="8.5"/><path d="M6.5 6.5l11 11"/>',
    todos: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    voltar: '<path d="M15 6l-6 6 6 6"/>',
    enviar: '<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    ideia: ICT.sugestao,
    ia: '<path d="M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z"/><path d="M18 3.5v3M16.5 5h3"/>',
    estrela: '<path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"/>',
    seta: '<path d="M6 14l6-6 6 6"/>'
  };
  /* "visto" por chamado, neste aparelho: mostra a bolinha de novidade */
  const chaveVisto = () => 'suporte_visto_' + (eu() || 'anon');
  const vistos = () => (B7.pref && B7.pref.ler(chaveVisto(), {})) || {};
  const marcarVisto = c => { const v = vistos(); v[c.id] = c.updated_at; if (B7.pref) B7.pref.gravar(chaveVisto(), v); };
  const temNovidade = c => { const v = vistos()[c.id]; return v ? new Date(c.updated_at) > new Date(v) : (c.criado_por !== eu() && ABERTOS.includes(c.status)); };
  const RESPOSTAS = [
    ['Recebido', 'Recebemos! Vamos olhar e te avisamos por aqui.'],
    ['Pedir print', 'Consegue mandar um print da tela quando acontecer? Ajuda muito a achar o problema.'],
    ['Corrigido', 'Corrigido na versão mais nova. Atualize o sistema (feche e abra de novo) e confira, por favor.'],
    ['Boa ideia', 'Boa ideia! Entrou na nossa lista. Te avisamos quando sair.'],
    ['Explicar', 'Para fazer isso: '],
  ];
  /* com o assistente atendendo não conta como "sem resposta"; chamado que ele passou adiante conta a partir daí */
  const semResposta = c => c.status === 'novo' && c.atendente !== 'ia' && horas(c.escalado_em || c.created_at) >= 24;

  /* ============================================ PERGUNTAS FREQUENTES (zzz217)
     Respostas curtas e prontas, cadastradas pela administração. A equipe
     escreve a dúvida e vê na hora a resposta; se não resolver, pergunta ao
     assistente ali mesmo; só então fala com a equipe (o chamado já vai com
     o que a pessoa tentou). Cada desfecho fica registrado
     (suporte_autoajuda) para a administração ver o que funciona e o que
     falta escrever. */
  let faqs = null, faqCarregando = null;
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const VAZIAS = new Set('a o as os um uma uns umas de da do das dos em no na nos nas para pra pro por com sem que qual quais como onde e ou eu meu minha me se ao aos ja nao sim mais esta este isso essa esse faco fazer quero consigo consegui fica tem ter vou vai posso pode botao tela sistema b7 aqui ai la algum alguma'.split(' '));
  const termosDe = q => norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1 && !VAZIAS.has(w)).map(w => w.length > 5 ? w.slice(0, -2) : w);
  function carregarFaq(forcar) {
    if (faqs && !forcar) return Promise.resolve(faqs);
    if (faqCarregando && !forcar) return faqCarregando;
    faqCarregando = (async () => {
      try { faqs = ok(await sb().from('suporte_faq').select('*').order('ordem').order('pergunta')) || []; }
      catch (e) { faqs = faqs || []; }
      faqCarregando = null; return faqs;
    })();
    return faqCarregando;
  }
  function acharFaq(q) {
    const termos = termosDe(q); if (!termos.length) return [];
    return (faqs || []).filter(f => f.ativo).map(f => {
      const p = norm(f.pergunta), t = norm(f.termos), r = norm(f.resposta);
      let pts = 0, n = 0;
      termos.forEach(w => { const a = p.includes(w), b = t.includes(w), c = r.includes(w); if (a || b || c) n++; pts += (a ? 5 : 0) + (b ? 4 : 0) + (c ? 1 : 0); });
      return n >= Math.max(1, Math.ceil(termos.length * 0.5)) ? { f, pts } : null;
    }).filter(Boolean).sort((a, b) => b.pts - a.pts);
  }
  const melhores = r => { const topo = r.length ? r[0].pts : 0; return r.filter(x => x.pts >= Math.max(4, topo * 0.5)); };
  /* usado também pelo chat do assistente */
  async function faqIds(texto) { await carregarFaq(); return melhores(acharFaq(texto)).slice(0, 3).map(x => x.f.id); }
  const registrar = (texto, desfecho, faq) => {
    try { Promise.resolve(B7.DB.rpc('suporte_autoajuda_registrar', { p_texto: String(texto || '').slice(0, 300), p_desfecho: desfecho, p_faq: faq || null })).catch(() => {}); } catch (e) {}
  };
  /* zzz264: resposta da IA com o visual rico (js/ia-rico.js) */
  const rico = (t, animar) => B7.IARico ? B7.IARico.html(t, { animar }) : '<p>' + formatarResp(t) + '</p>';
  const formatarResp = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(&quot;|")([^"<]{1,60}?)(&quot;|")/g, '<b>"$2"</b>').replace(/\n/g, '<br>');
  const tutPara = texto => {
    if (souCliente() || !B7.Ajuda || !B7.Ajuda.procurar) return [];
    let r = []; try { r = B7.Ajuda.procurar(texto, true); } catch (e) { return []; }
    const topo = r.length ? r[0].pts : 0;
    return r.filter(x => x.pts >= Math.max(3, topo * 0.5)).slice(0, 3);
  };
  const iaLigada = () => !souCliente() && !!(B7.IA && B7.IA.pedir && B7.IA.ligada && B7.IA.ligada('chat'));

  async function carregar() { lista = ok(await sb().from('suporte_chamados').select('*').order('updated_at', { ascending: false }).limit(300)) || []; }

  async function abrir(id) {
    const minha = ++vez;
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/suporte');
    const adm = equipe();
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo([adm ? 'Central de atendimento' : 'Suporte']);
    sel = id && typeof id === 'string' ? id : (/^#\/suporte$/.test(location.hash) ? null : sel);
    painel().innerHTML = '<div class="conteudo entra spx ' + (adm ? 'spx-adm' : 'spx-eq') + '" id="spx">' + B7.UI.skeleton('lista', { n: 4 }) + '</div>';
    try { await carregar(); }
    catch (e) {
      if (minha !== vez) return;
      const semTabela = e && (e.code === '42P01' || e.code === 'PGRST205');
      document.getElementById('spx').innerHTML = '<div class="cb-aviso erro">' + (semTabela ? 'O Suporte ainda está sendo ligado no banco. Volte daqui a pouco.' : 'Não foi possível carregar os chamados.') + '</div>';
      return;
    }
    if (minha !== vez) return;
    if (sel && !lista.some(c => c.id === sel)) sel = null;
    pintar();
    vigiar(minha);
  }

  /* atualiza sozinho a cada 40 s com a tela aberta e visível, sem perder o que está sendo escrito */
  function vigiar(minha) {
    clearInterval(relogio);
    relogio = setInterval(async () => {
      if (minha !== vez || !document.getElementById('spx')) { clearInterval(relogio); return; }
      if (document.hidden) return;
      const antes = JSON.stringify(lista.map(c => [c.id, c.updated_at, c.status]));
      try { await carregar(); } catch (e) { return; }
      if (JSON.stringify(lista.map(c => [c.id, c.updated_at, c.status])) === antes) return;
      const txt = document.getElementById('sp-resp-t'); const rascunho = txt ? txt.value : '';
      pintar();
      const t2 = document.getElementById('sp-resp-t'); if (t2 && rascunho) t2.value = rascunho;
    }, 40000);
  }
  const pintar = () => (equipe() ? pintarAdm() : pintarEquipe());

  /* ============================================================ EQUIPE */
  function pintarEquipe() {
    const raiz = document.getElementById('spx'); if (!raiz) return;
    if (sel) return conversa(raiz, lista.find(c => c.id === sel), false);
    const meus = lista.filter(c => c.criado_por === eu());
    const abertos = meus.filter(c => ABERTOS.includes(c.status)), fechados = meus.filter(c => !ABERTOS.includes(c.status));
    const card = (c, i) => '<button type="button" class="spx-th' + (temNovidade(c) ? ' nov' : '') + '" data-id="' + esc(c.id) + '" style="--i:' + i + '">' + icTipo(c.tipo) +
      '<span class="spx-th-tx"><b>' + esc(c.titulo) + '</b><small>#' + c.numero + ' · ' + esc(TIPOS[c.tipo].rot) + ' · ' + esc(quando(c.updated_at || c.created_at)) + '</small></span>' +
      (temNovidade(c) ? '<i class="sp-dot" title="Resposta nova"></i>' : '') + chipStatus(c.status) + '</button>';
    const ATALHOS = [['duvida', 'Abrir uma dúvida'], ['bug', 'Relatar um problema'], ['sugestao', 'Mandar uma ideia'], ['elogio', 'Elogiar']];
    const cli = souCliente();
    raiz.innerHTML =
      '<header class="spx-eq-cab spx-pergunta"><div><span class="spx-tag">Suporte</span><h1>Como podemos ajudar?</h1>' +
        '<p>Escreva a sua dúvida. Quase sempre a resposta já está aqui; se não estiver, abra um chamado: o assistente responde na hora e, se precisar, chama alguém da equipe.</p></div>' +
        '<label class="spx-q-grande">' + SVG('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>') +
          '<input id="spx-q" type="search" placeholder="Ex.: como troco minha senha?" autocomplete="off" aria-label="Escreva a sua dúvida" value="' + esc(qEq) + '"></label>' +
        '<div class="spx-atalhos"><span>Ou vá direto:</span>' + ATALHOS.map(([k, r]) => '<button type="button" data-novo="' + k + '">' + icTipo(k) + esc(r) + '</button>').join('') + '</div>' +
      '</header>' +
      '<div id="spx-res" class="spx-res"></div>' +
      '<div class="spx-eq-grade' + (cli ? ' so-um' : '') + '">' +
        '<section class="spx-bloco"><h2>Seus chamados' + (abertos.length ? ' <small>' + abertos.length + ' em aberto</small>' : '') + '</h2>' +
          (meus.length ? '<div class="spx-ths">' + abertos.concat(fechados).slice(0, 30).map(card).join('') + '</div>'
            : '<div class="spx-vazio">' + SVG(IC.ok) + '<b>Nenhum chamado ainda</b><p>Quando você abrir um, a conversa com a equipe fica aqui.</p></div>') + '</section>' +
        (cli ? '' : '<section class="spx-bloco"><h2>Ideias da equipe <small>vote nas que você também quer</small></h2><div id="spx-ideias">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>' +
          '<button type="button" class="spx-link" id="spx-ideia-nova">+ Mandar uma ideia</button></section>') +
      '</div>';
    raiz.querySelectorAll('[data-novo]').forEach(b => b.onclick = () => novo(b.dataset.novo));
    raiz.querySelectorAll('.spx-th').forEach(b => b.onclick = () => { sel = b.dataset.id; pintar(); });
    const bIdeia = raiz.querySelector('#spx-ideia-nova'); if (bIdeia) bIdeia.onclick = () => novo('sugestao');
    const qi = raiz.querySelector('#spx-q');
    let rel = null;
    qi.oninput = () => { clearTimeout(rel); rel = setTimeout(() => { qEq = qi.value; tentou.faq = []; tentou.ia = ''; pintarRes(); }, 220); };
    qi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(rel); qEq = qi.value; pintarRes(); } };
    carregarFaq().then(() => pintarRes());
    pintarRes();
    if (!cli) ideiasInline(raiz.querySelector('#spx-ideias'), 5);
  }

  /* respostas da dúvida: perguntas frequentes, tutoriais, assistente, equipe */
  const faqHTML = (f, aberta) => '<details class="spx-faq" data-faq="' + esc(f.id) + '"' + (aberta ? ' open' : '') + '><summary><span>' + esc(f.pergunta) + '</span>' + SVG('<path d="M6 9l6 6 6-6"/>') + '</summary>' +
    '<div class="spx-faq-r"><p>' + formatarResp(f.resposta) + '</p>' +
      (f.tutorial_id ? '<a class="spx-faq-tut" href="#/ajuda/' + esc(f.tutorial_id) + '">Ver o passo a passo completo →</a>' : '') +
      '<div class="spx-util"><span>Isso resolveu?</span><button type="button" data-fsim>Sim</button><button type="button" data-fnao>Não</button></div></div></details>';
  function pintarRes() {
    const cx = document.getElementById('spx-res'); if (!cx) return;
    const t = String(qEq || '').trim();
    if (t.length < 3) {
      const l = (faqs || []).filter(f => f.ativo);
      cx.innerHTML = l.length ? '<section class="spx-faqs"><h2>Perguntas frequentes</h2>' + l.slice(0, 8).map(f => faqHTML(f, false)).join('') +
          (l.length > 8 ? '<button type="button" class="spx-link" data-faq-todas>Ver todas as ' + l.length + ' perguntas</button>' : '') + '</section>'
        : (faqs ? '' : '<div class="spx-faqs">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>');
      const td = cx.querySelector('[data-faq-todas]');
      if (td) td.onclick = () => { td.insertAdjacentHTML('beforebegin', l.slice(8).map(f => faqHTML(f, false)).join('')); td.remove(); ligarFaq(cx, ''); };
      ligarFaq(cx, '');
      return;
    }
    const fr = melhores(acharFaq(t)).slice(0, 3), tr = tutPara(t);
    const nada = !fr.length && !tr.length;
    cx.innerHTML = '<section class="spx-faqs">' +
      (fr.length ? '<h2>Respostas prontas</h2>' + fr.map((x, i) => faqHTML(x.f, i === 0)).join('') : '') +
      (tr.length ? '<h3 class="spx-res-h">Tutoriais sobre isso</h3><div class="spx-tut">' + tr.map(x => '<a href="#/ajuda/' + esc(x.i.id) + '"><b>' + esc(x.i.titulo) + '</b><small>' + esc(x.i.grupo) + '</small></a>').join('') + '</div>' : '') +
      (nada ? '<p class="spx-res-nada">Não achei uma resposta pronta para isso.</p>' : '') +
      '<div class="spx-ainda" id="spx-ainda"><div><b>' + (nada ? 'Vamos resolver de outro jeito' : 'Ainda com dúvida?') + '</b><small>' +
        (iaLigada() ? 'O assistente responde na hora. Se não resolver, abra um chamado.' : 'Abra um chamado: o atendimento responde aqui e você recebe aviso no sino.') + '</small></div>' +
        '<div class="spx-ainda-bts">' + (iaLigada() ? '<button type="button" class="b contorno" id="spx-ia-b">' + SVG('<path d="M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z"/>') + 'Perguntar ao assistente</button>' : '') +
          '<button type="button" class="b pri" id="spx-equipe-b">Abrir um chamado</button></div></div>' +
      '<div id="spx-ia" class="spx-ia"></div></section>';
    ligarFaq(cx, t);
    const bia = cx.querySelector('#spx-ia-b'); if (bia) bia.onclick = () => perguntarIA(t);
    cx.querySelector('#spx-equipe-b').onclick = () => falarComEquipe(t);
    /* busca sem resposta pronta: anota uma vez (vira a lista "o que procuram e não acham") */
    if (nada && t.length >= 6 && norm(t) !== semResReg) {
      const agora = t;
      setTimeout(() => { if (String(qEq || '').trim() === agora && norm(agora) !== semResReg) { semResReg = norm(agora); registrar(agora, 'sem_resultado'); } }, 2500);
    }
  }
  function ligarFaq(cx, texto) {
    cx.querySelectorAll('.spx-faq').forEach(d => {
      const f = (faqs || []).find(x => x.id === d.dataset.faq); if (!f) return;
      d.addEventListener('toggle', () => { if (d.open && !tentou.faq.includes(f.pergunta)) tentou.faq.push(f.pergunta); });
      if (d.open && !tentou.faq.includes(f.pergunta)) tentou.faq.push(f.pergunta);
      const util = d.querySelector('.spx-util');
      d.querySelector('[data-fsim]').onclick = () => { registrar(texto || f.pergunta, 'faq_sim', f.id); util.innerHTML = '<span class="spx-util-ok">' + SVG(IC.ok) + 'Que bom! Obrigado por avisar.</span>'; };
      d.querySelector('[data-fnao]').onclick = () => {
        registrar(texto || f.pergunta, 'faq_nao', f.id);
        util.innerHTML = '<span class="spx-util-nao">Que pena. ' + (iaLigada() ? 'Pergunte ao assistente ou fale com a equipe.' : 'Fale com a equipe.') + '</span>';
        if (!texto) { qEq = f.pergunta; const qi = document.getElementById('spx-q'); if (qi) qi.value = f.pergunta; pintarRes(); }
        const a = document.getElementById('spx-ainda'); if (a) { a.classList.remove('pisca'); void a.offsetWidth; a.classList.add('pisca'); a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      };
    });
  }
  async function perguntarIA(texto) {
    const cx = document.getElementById('spx-ia'), bt = document.getElementById('spx-ia-b'); if (!cx) return;
    if (bt) bt.disabled = true;
    let parcial = '';
    const pinta = (html, fim) => { if (cx.isConnected) cx.innerHTML = '<div class="spx-ia-cx' + (fim ? '' : ' indo') + '"><span class="spx-ia-tag">' + SVG('<path d="M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z"/>') + 'Assistente</span>' + html + '</div>'; };
    pinta('<div class="spx-ia-pensa"><i></i><i></i><i></i></div>');
    const dados = { texto: texto.slice(0, 2000), origem: 'suporte' };
    const tuts = tutPara(texto).map(x => x.i.id); if (tuts.length) dados.ajuda_ids = tuts;
    try { const f = await faqIds(texto); if (f.length) dados.faq_ids = f; } catch (e) {}
    let r = null;
    try { r = await B7.IA.pedir('chat', dados, { aoTrecho: p => { parcial += p; pinta(rico(parcial)); } }); }
    catch (e) { r = null; }
    if (bt) bt.disabled = false;
    if (!cx.isConnected) return;
    if (!r || !r.ok) { pinta('<p class="spx-ia-erro">' + esc((r && r.mensagem) || 'O assistente não conseguiu responder agora.') + ' Fale com a equipe.</p>', true); return; }
    tentou.ia = String(r.texto || '');
    const links = (Array.isArray(r.tutoriais) ? r.tutoriais : []).filter(x => x && x.id);
    pinta(rico(r.texto, true) +
      (links.length ? '<div class="spx-ia-tuts">' + links.map(x => '<a href="#/ajuda/' + esc(x.id) + '">Tutorial: ' + esc(x.titulo) + ' →</a>').join('') + '</div>' : '') +
      '<div class="spx-util"><span>Isso resolveu?</span><button type="button" data-isim>Sim</button><button type="button" data-inao>Não</button></div>', true);
    const util = cx.querySelector('.spx-util');
    cx.querySelector('[data-isim]').onclick = () => { registrar(texto, 'ia_sim'); util.innerHTML = '<span class="spx-util-ok">' + SVG(IC.ok) + 'Que bom! Obrigado por avisar.</span>'; };
    cx.querySelector('[data-inao]').onclick = () => {
      registrar(texto, 'ia_nao');
      util.innerHTML = '<span class="spx-util-nao">Vamos chamar a equipe.</span><button type="button" class="b pri fina" data-equipe>Falar com a equipe</button>';
      util.querySelector('[data-equipe]').onclick = () => falarComEquipe(texto);
    };
  }
  function falarComEquipe(texto) {
    registrar(texto, 'chamado');
    const linhas = [];
    if (tentou.faq.length) linhas.push('- Perguntas frequentes: ' + tentou.faq.slice(0, 3).join('; '));
    if (tentou.ia) linhas.push('- Assistente respondeu: ' + tentou.ia.replace(/\s+/g, ' ').slice(0, 280) + (tentou.ia.length > 280 ? '…' : ''));
    novo('duvida', { titulo: texto.slice(0, 140), semSugestao: true,
      descricao: (linhas.length ? 'Já tentei:\n' + linhas.join('\n') + '\n\n' : '') + 'O que ainda preciso: ' });
  }

  /* ===================================================== ADMINISTRAÇÃO */
  const FILAS = [
    ['entrada', 'Caixa de entrada', IC.entrada, c => ABERTOS.includes(c.status) && c.atendente !== 'ia'],
    ['ia', 'Com o assistente', IC.ia, c => ABERTOS.includes(c.status) && c.atendente === 'ia'],
    ['urgentes', 'Urgentes', IC.urg, c => c.urgente && ABERTOS.includes(c.status)],
    ['semresp', 'Sem resposta há 24 h', IC.relogio, semResposta],
    ['andamento', 'Em andamento', IC.and, c => c.status === 'em_andamento' || c.status === 'em_analise'],
    ['resolvidos', 'Resolvidos', IC.ok, c => c.status === 'resolvido'],
    ['naofeito', 'Não será feito', IC.nao, c => c.status === 'nao_vamos_fazer'],
    ['todos', 'Todos', IC.todos, () => true]
  ];
  const daFila = () => {
    const f = (FILAS.find(x => x[0] === fila) || FILAS[0])[3];
    const t = String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return lista.filter(c => f(c) && (!tipoF || c.tipo === tipoF) && (!pessoaF || c.criado_por === pessoaF) &&
      (!t || (c.titulo + ' ' + (c.descricao || '') + ' ' + (c.criado_por_nome || '') + ' #' + c.numero).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)));
  };
  function pintarAdm() {
    const raiz = document.getElementById('spx'); if (!raiz) return;
    const abertos = lista.filter(c => ABERTOS.includes(c.status));
    const res7 = lista.filter(c => c.status === 'resolvido' && horas(c.resolvido_em || c.updated_at) <= 24 * 7).length;
    const res30 = lista.filter(c => c.status === 'resolvido' && c.resolvido_em && horas(c.resolvido_em) <= 24 * 30);
    const media = res30.length ? res30.reduce((s, c) => s + (new Date(c.resolvido_em) - new Date(c.created_at)) / 36e5, 0) / res30.length : null;
    const fmtH = h => h == null ? '—' : h < 1 ? '< 1 h' : h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' dias';
    const kpi = (v, r, cls, f) => '<button type="button" class="spx-kpi ' + (cls || '') + (f && fila === f ? ' on' : '') + '"' + (f ? ' data-fila="' + f + '"' : ' disabled') + '><b>' + v + '</b><span>' + r + '</span></button>';
    const pessoas = [...new Map(lista.map(c => [c.criado_por, c.criado_por_nome || 'Alguém'])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
    raiz.innerHTML =
      '<header class="spx-adm-cab"><div><span class="spx-tag">Administração</span><h1>Central de atendimento</h1>' +
        '<p>Os chamados da equipe e dos clientes: o assistente atende primeiro; aqui você responde o que ele passou adiante, muda o andamento e acompanha as avaliações.</p></div>' +
        '<div class="spx-adm-ac"><div class="spx-abas" role="tablist"><button role="tab" data-aba="chamados" class="' + (aba === 'chamados' ? 'on' : '') + '">Chamados</button>' +
          '<button role="tab" data-aba="faq" class="' + (aba === 'faq' ? 'on' : '') + '">Perguntas frequentes</button>' +
          '<button role="tab" data-aba="avaliacoes" class="' + (aba === 'avaliacoes' ? 'on' : '') + '">Avaliações</button>' +
          '<button role="tab" data-aba="ideias" class="' + (aba === 'ideias' ? 'on' : '') + '">Ideias</button></div>' +
          '<button type="button" class="b pri" id="spx-novo">+ Novo chamado</button></div></header>' +
      '<div class="spx-kpis">' +
        kpi(lista.filter(c => c.status === 'novo').length, 'novos', '', 'entrada') +
        kpi(abertos.filter(c => c.urgente).length, 'urgentes', abertos.some(c => c.urgente) ? 'alerta' : '', 'urgentes') +
        kpi(lista.filter(semResposta).length, 'sem resposta há 24 h', lista.some(semResposta) ? 'alerta' : '', 'semresp') +
        kpi(lista.filter(c => c.status === 'em_andamento' || c.status === 'em_analise').length, 'em análise ou andamento', '', 'andamento') +
        kpi(res7, 'resolvidos em 7 dias', 'ok', 'resolvidos') +
        kpi(fmtH(media), 'tempo médio para resolver (30 dias)', '', '') +
        '<div class="spx-kpi spx-kpi-nota" id="spx-kpi-nota"><b>—</b><span>nota do atendimento (30 dias)</span></div>' + '</div>' +
      (aba === 'faq' ? '<section class="spx-bloco spx-faq-adm" id="spx-faq-adm">' + B7.UI.skeleton('lista', { n: 4 }) + '</section>' :
      aba === 'avaliacoes' ? '<section class="spx-bloco spx-aval-adm" id="spx-aval">' + B7.UI.skeleton('lista', { n: 4 }) + '</section>' :
      aba === 'ideias' ? '<section class="spx-bloco spx-ideias-adm"><h2>Ideias da equipe <small>mais votadas primeiro</small></h2><div id="spx-ideias">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></section>' :
      '<div class="spx-caixa' + (sel ? ' com-sel' : '') + '">' +
        '<aside class="spx-filas"><nav>' + FILAS.map(f => {
          const n = lista.filter(f[3]).length;
          return '<button type="button" class="spx-fila' + (fila === f[0] ? ' on' : '') + (f[0] === 'urgentes' || f[0] === 'semresp' ? (n ? ' quente' : '') : '') + '" data-fila="' + f[0] + '">' + SVG(f[2]) + '<span>' + f[1] + '</span><i>' + n + '</i></button>';
        }).join('') + '</nav>' +
          '<h4>Tipo</h4><div class="spx-tipos-f">' + [['', 'Todos']].concat(Object.keys(TIPOS).map(k => [k, TIPOS[k].plural])).map(([k, r]) => '<button type="button" data-tipof="' + k + '"' + (tipoF === k ? ' class="on"' : '') + '>' + esc(r) + '</button>').join('') + '</div>' +
          '<h4>Pessoa</h4><select class="campo fina" id="spx-pessoa"><option value="">Todas</option>' + pessoas.map(([id, n]) => '<option value="' + esc(id) + '"' + (pessoaF === id ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
        '</aside>' +
        '<section class="spx-lista"><label class="spx-busca">' + SVG('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>') +
          '<input id="spx-q" type="search" placeholder="Buscar por título, pessoa ou número" value="' + esc(q) + '" autocomplete="off" aria-label="Buscar chamados"></label><div id="spx-itens"></div></section>' +
        '<section class="spx-ws" id="spx-ws"></section>' +
      '</div>');
    raiz.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; pintar(); });
    raiz.querySelector('#spx-novo').onclick = () => novo();
    raiz.querySelectorAll('[data-fila]').forEach(b => b.onclick = () => { fila = b.dataset.fila; aba = 'chamados'; sel = null; pintar(); });
    if (aba === 'ideias') return ideiasInline(raiz.querySelector('#spx-ideias'), 100, true);
    resumoAtendimento();
    if (aba === 'faq') return faqAdm(raiz.querySelector('#spx-faq-adm'));
    if (aba === 'avaliacoes') return avaliacoesAdm(raiz.querySelector('#spx-aval'));
    raiz.querySelectorAll('[data-tipof]').forEach(b => b.onclick = () => { tipoF = b.dataset.tipof; sel = null; pintar(); });
    raiz.querySelector('#spx-pessoa').onchange = e => { pessoaF = e.target.value; sel = null; pintar(); };
    const qi = raiz.querySelector('#spx-q'); qi.oninput = () => { q = qi.value; pintarItens(); };
    pintarItens();
    const ws = raiz.querySelector('#spx-ws');
    if (sel && lista.some(c => c.id === sel)) conversa(ws, lista.find(c => c.id === sel), true);
    else ws.innerHTML = '<div class="spx-ws-vazio">' + SVG(IC.entrada) + '<b>Escolha um chamado</b><p>A conversa, o andamento e as informações técnicas aparecem aqui.</p></div>';
  }
  /* zzz217: perguntas frequentes — o que funciona, o que falta escrever, e a lista para editar */
  async function faqAdm(cx) {
    if (!cx) return;
    let res = null;
    try { [, res] = await Promise.all([carregarFaq(true), B7.DB.rpc('suporte_autoajuda_resumo', { p_dias: 30 })]); } catch (e) { res = null; }
    if (!cx.isConnected) return;
    const d = (res && res.desfechos) || {}, pf = {}; ((res && res.por_faq) || []).forEach(x => { pf[x.faq_id] = x; });
    const n = k => Number(d[k] || 0);
    const kpi = (v, r, cls) => '<div class="spx-kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + r + '</span></div>';
    const lista = faqs || [];
    const falta = (res && res.sem_resultado) || [];
    cx.innerHTML = '<div class="spx-kpis spx-faq-kpis">' + kpi(n('faq_sim'), 'resolvidas pelas perguntas', 'ok') + kpi(n('ia_sim'), 'resolvidas pelo assistente', 'ok') +
        kpi(n('chamado'), 'viraram chamado') + kpi(n('sem_resultado') + n('faq_nao') + n('ia_nao'), 'sem resposta ou não resolveu', (n('sem_resultado') + n('faq_nao') + n('ia_nao')) ? 'alerta' : '') + '</div>' +
      '<p class="spx-faq-nota leve">Últimos 30 dias. Cada dúvida conta uma vez por desfecho.</p>' +
      '<div class="spx-faq-cols"><div><div class="spx-faq-cab"><h2>Perguntas frequentes <small>' + lista.filter(f => f.ativo).length + ' no ar</small></h2><button type="button" class="b pri fina" id="spx-faq-nova">+ Nova pergunta</button></div>' +
        (lista.length ? '<div class="spx-faq-lista">' + lista.map(f => {
          const x = pf[f.id] || { sim: 0, nao: 0 };
          return '<div class="spx-faq-it' + (f.ativo ? '' : ' fora') + '"><div><b>' + esc(f.pergunta) + '</b><small>' + ({ clientes: 'clientes · ', todos: 'equipe e clientes · ' }[f.publico] || '') + (f.tutorial_id ? 'tutorial ligado · ' : '') + '<span class="ok">' + x.sim + ' resolveu</span> · <span class="nao">' + x.nao + ' não resolveu</span>' + (f.ativo ? '' : ' · fora do ar') + '</small></div>' +
            '<button type="button" class="b fina contorno" data-faq-ed="' + esc(f.id) + '">Editar</button></div>';
        }).join('') + '</div>' : '<div class="spx-vazio"><b>Nenhuma pergunta ainda</b></div>') + '</div>' +
      '<div><h2>O que procuram e não acham <small>vire uma pergunta</small></h2>' +
        (falta.length ? '<div class="spx-faq-lista">' + falta.map((x, i) => '<div class="spx-faq-it"><div><b>' + esc(x.texto) + '</b><small>' + x.n + (x.n === 1 ? ' vez' : ' vezes') + '</small></div><button type="button" class="b fina contorno" data-faq-falta="' + i + '">Criar pergunta</button></div>').join('') + '</div>'
          : '<div class="spx-vazio">' + SVG(IC.ok) + '<b>Nada por enquanto</b><p>Quando alguém procurar algo sem resposta pronta, aparece aqui.</p></div>') + '</div></div>';
    cx.querySelector('#spx-faq-nova').onclick = () => editarFaq(null, {});
    cx.querySelectorAll('[data-faq-ed]').forEach(b => b.onclick = () => editarFaq(lista.find(f => f.id === b.dataset.faqEd), {}));
    cx.querySelectorAll('[data-faq-falta]').forEach(b => b.onclick = () => editarFaq(null, { pergunta: falta[+b.dataset.faqFalta].texto }));
  }
  function editarFaq(f, pre) {
    f = f || {}; pre = pre || {};
    const tuts = (B7.AJUDA_DADOS || []).flatMap(g => g.itens.map(i => [i.id, g.nome + ' · ' + i.titulo]));
    const m = B7.UI.modal('<h3>' + (f.id ? 'Editar pergunta frequente' : 'Nova pergunta frequente') + '</h3>' +
      '<p class="sub">Resposta curta, em passos, com os nomes dos botões como aparecem na tela. A equipe vê ao escrever a dúvida no Suporte, e o assistente usa nas respostas.</p>' +
      '<div class="mb"><label class="rot" for="fq-p">PERGUNTA</label><input class="campo" id="fq-p" maxlength="200" data-foco value="' + esc(f.pergunta || pre.pergunta || '') + '" placeholder="Ex.: Como troco minha senha?"></div>' +
      '<div class="mb"><label class="rot" for="fq-r">RESPOSTA</label><textarea class="campo" id="fq-r" rows="6" maxlength="2000" placeholder="Ex.: Clique na sua foto → Meu perfil → aba Segurança…">' + esc(f.resposta || pre.resposta || '') + '</textarea></div>' +
      '<div class="mb"><label class="rot" for="fq-t">PALAVRAS PARECIDAS <span class="leve">— ajudam a achar (ex.: mudar alterar esqueci)</span></label><input class="campo" id="fq-t" maxlength="400" value="' + esc(f.termos || '') + '"></div>' +
      '<div class="spx-fq-linha"><div class="mb"><label class="rot" for="fq-tut">TUTORIAL LIGADO <span class="leve">— opcional</span></label><select class="campo" id="fq-tut"><option value="">Nenhum</option>' +
        tuts.map(([id, r]) => '<option value="' + esc(id) + '"' + (f.tutorial_id === id ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></div>' +
        '<div class="mb"><label class="rot" for="fq-o">ORDEM</label><input class="campo" id="fq-o" type="number" min="0" max="9999" value="' + esc(f.ordem == null ? 100 : f.ordem) + '"></div></div>' +
      '<div class="mb"><label class="rot" for="fq-pub">QUEM VÊ</label><select class="campo" id="fq-pub">' +
        [['equipe', 'Só a equipe'], ['clientes', 'Só os clientes (Portal)'], ['todos', 'Equipe e clientes']].map(([v, r]) => '<option value="' + v + '"' + ((f.publico || 'equipe') === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
      '<label class="sp-info"><input type="checkbox" id="fq-a"' + (f.ativo === false ? '' : ' checked') + '> No ar</label>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="fq-salvar">Salvar</button></div>', { larga: true });
    const q = s => m.querySelector(s);
    q('#fq-salvar').onclick = async () => {
      const bt = q('#fq-salvar'); bt.disabled = true;
      try {
        const fid = await B7.DB.rpc('suporte_faq_salvar', { p_id: f.id || null, p_pergunta: q('#fq-p').value, p_resposta: q('#fq-r').value, p_termos: q('#fq-t').value,
          p_tutorial: q('#fq-tut').value, p_ordem: parseInt(q('#fq-o').value, 10) || 100, p_ativo: q('#fq-a').checked });
        const idF = f.id || fid;
        if (idF && q('#fq-pub').value !== (f.publico || 'equipe')) await B7.DB.rpc('suporte_faq_publico', { p_id: idF, p_publico: q('#fq-pub').value });
        m.fechar(); B7.UI.toast(f.id ? 'Pergunta salva.' : 'Pergunta criada. A equipe já vê no Suporte.');
        await carregarFaq(true);
        if (aba === 'faq') faqAdm(document.getElementById('spx-faq-adm'));
      } catch (e) { bt.disabled = false; B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
    };
  }

  function pintarItens() {
    const cx = document.getElementById('spx-itens'); if (!cx) return;
    const itens = daFila();
    cx.innerHTML = itens.length ? itens.map(c => {
      const nov = temNovidade(c) && sel !== c.id, h = horas(c.created_at);
      return '<button type="button" class="spx-it' + (sel === c.id ? ' on' : '') + (nov ? ' nov' : '') + '" data-id="' + esc(c.id) + '">' +
        av(c.criado_por_nome) +
        '<span class="spx-it-tx"><span class="spx-it-l1"><b>' + esc(c.titulo) + '</b>' + (nov ? '<i class="sp-dot"></i>' : '') + '</span>' +
        '<small>' + icTipo(c.tipo) + '#' + c.numero + ' · ' + esc((c.criado_por_nome || 'alguém').split(' ')[0]) + ' · ' + esc(quando(c.updated_at || c.created_at)) + '</small>' +
        '<span class="spx-it-tags">' + chipStatus(c.status) + (c.urgente && ABERTOS.includes(c.status) ? '<em class="spx-urg">urgente</em>' : '') +
          (c.do_cliente ? '<em class="spx-cli">cliente</em>' : '') + (c.atendente === 'ia' && ABERTOS.includes(c.status) ? '<em class="spx-iat">assistente</em>' : '') +
          (c.escalado_em && ABERTOS.includes(c.status) ? '<em class="spx-esc">chamou a equipe</em>' : '') + (c.avaliacao ? '<em class="spx-nota-it">' + estrelas(c.avaliacao) + '</em>' : '') +
          (c.prioridade === 'alta' ? '<em class="spx-prio">alta</em>' : '') + (semResposta(c) ? '<em class="spx-sla">há ' + Math.floor(h) + ' h sem resposta</em>' : '') + '</span></span></button>';
    }).join('') : '<div class="spx-vazio">' + SVG(IC.ok) + '<b>Fila vazia</b><p>Nada aqui com esses filtros.</p></div>';
    cx.querySelectorAll('.spx-it').forEach(b => b.onclick = () => { sel = b.dataset.id; pintar(); });
  }

  /* ============================================ ATENDIMENTO (zzz223)
     Dúvida e problema começam com o assistente: ele responde na hora, no
     próprio chamado. Quem pediu marca "Resolveu" ou "Falar com uma pessoa";
     o assistente também chama a equipe sozinho quando não resolve. Quem é
     da equipe e responde assume o atendimento. Encerrado não recebe mais
     mensagem de quem pediu: a pessoa avalia e, se precisar, abre outro. */
  const atendendo = {};
  const IC_IA = '<path d="M10 4.6l1.6 4.3a1.5 1.5 0 0 0 .9.9l4.3 1.6-4.3 1.6a1.5 1.5 0 0 0-.9.9L10 18.2l-1.6-4.3a1.5 1.5 0 0 0-.9-.9l-4.3-1.6 4.3-1.6a1.5 1.5 0 0 0 .9-.9z"/>';
  const bolhaIA = (html, qd, indo) => '<div class="sp-msg sp-msg-ia' + (indo ? ' indo' : '') + '"><span class="sp-av sp-av-ia" aria-hidden="true">' + SVG(IC_IA) + '</span>' +
    '<div class="sp-bolha"><div class="sp-msg-c"><b>Assistente B7</b><em class="sp-ia-tag">IA</em>' + (qd ? '<small>' + esc(qd) + '</small>' : '') + '</div>' + html + '</div></div>';
  const estrelas = n => '★★★★★'.slice(0, n) + '<span class="apagada">' + '★★★★★'.slice(n) + '</span>';

  function atendimentoHTML(c, adm, souAutor) {
    const fechado = !ABERTOS.includes(c.status);
    if (fechado) {
      if (!adm || !c.avaliacao) return adm ? '' : '';
      return '<div class="spx-aval-vista"><span class="spx-estrelas">' + estrelas(c.avaliacao) + '</span><div><b>Avaliação de ' + esc((c.criado_por_nome || 'quem pediu').split(' ')[0]) +
        ' · atendimento ' + (c.avaliacao_alvo === 'ia' ? 'do assistente' : 'da equipe') + '</b>' + (c.avaliacao_comentario ? '<p>"' + esc(c.avaliacao_comentario) + '"</p>' : '') + '</div></div>';
    }
    if (c.atendente === 'ia') {
      return '<div class="spx-atend ia"><span class="spx-atend-ic">' + SVG(IC_IA) + '</span><div><b>' + (adm ? 'O assistente está atendendo' : 'Atendimento do assistente') + '</b><small>' +
        (adm ? 'Se você responder, assume o atendimento no lugar dele.' : 'Ele responde na hora. Se não resolver, chame uma pessoa da equipe.') + '</small></div>' +
        (souAutor ? '<div class="spx-atend-bts"><button type="button" class="b fina contorno" data-humano>Falar com uma pessoa</button><button type="button" class="b fina pri" data-resolvi>' + SVG(IC.ok) + 'Resolveu</button></div>' : '') + '</div>';
    }
    return '<div class="spx-atend eq"><span class="spx-atend-ic">' + SVG('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.2a4.5 4.5 0 0 1 5 4.8"/>') + '</span><div><b>' +
      (c.escalado_em ? (adm ? 'Chamaram a equipe' : 'Alguém da equipe vai continuar o atendimento') : (adm ? 'Atendimento da equipe' : 'Atendimento da equipe')) + '</b><small>' +
      (adm ? (c.escalado_motivo ? 'Motivo: ' + esc(c.escalado_motivo) : 'A pessoa recebe aviso no sino a cada resposta.') : 'A resposta chega aqui e você recebe aviso no sino.') + '</small></div>' +
      (souAutor ? '<div class="spx-atend-bts"><button type="button" class="b fina contorno" data-resolvi>' + SVG(IC.ok) + 'Já resolveu</button></div>' : '') + '</div>';
  }

  function encerradoHTML(c, souAutor) {
    const avaliar = souAutor && !c.avaliacao;
    return '<div class="spx-fim">' +
      '<div class="spx-fim-cab">' + SVG(IC.ok) + '<div><b>Chamado ' + (c.status === 'resolvido' ? 'resolvido' : 'encerrado') + '</b><small>Este chamado não recebe mais mensagens. Precisa de mais alguma coisa? Abra um novo chamado.</small></div></div>' +
      (avaliar ? '<div class="spx-avaliar" id="sp-avaliar"><b>Como foi o atendimento' + (c.atendente === 'ia' ? ' do assistente' : ' da equipe') + '?</b>' +
          '<div class="spx-est-esc" role="radiogroup" aria-label="Nota">' + [1, 2, 3, 4, 5].map(n => '<button type="button" role="radio" data-nota="' + n + '" aria-label="' + n + ' de 5">' + SVG(IC.estrela) + '</button>').join('') + '</div>' +
          '<small class="spx-est-rot" id="sp-est-rot">Toque nas estrelas</small>' +
          '<textarea class="campo" id="sp-aval-t" rows="2" maxlength="600" placeholder="Quer contar algo? (opcional)" hidden></textarea>' +
          '<button type="button" class="b pri fina" id="sp-aval-ok" hidden>Enviar avaliação</button></div>'
        : c.avaliacao ? '<div class="spx-aval-feita"><span class="spx-estrelas">' + estrelas(c.avaliacao) + '</span><small>Obrigado pela avaliação!</small></div>' : '') +
      (souAutor ? '<button type="button" class="b contorno" id="sp-novo-sobre">Abrir um novo chamado</button>' : '') +
    '</div>';
  }

  function ligarAtendimento(cx, c) {
    const resolvi = cx.querySelector('[data-resolvi]');
    if (resolvi) resolvi.onclick = async () => {
      resolvi.disabled = true;
      try { await B7.DB.rpc('suporte_resolvi', { p_id: c.id }); await carregar(); B7.UI.toast('Que bom que resolveu! Conte como foi o atendimento.'); pintar(); }
      catch (e) { resolvi.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    const hum = cx.querySelector('[data-humano]');
    if (hum) hum.onclick = async () => {
      hum.disabled = true;
      try { await B7.DB.rpc('suporte_chamar_equipe', { p_id: c.id, p_motivo: 'a pessoa pediu para falar com alguém' }); await carregar(); B7.UI.toast('Chamamos alguém da equipe. A resposta chega aqui.'); pintar(); }
      catch (e) { hum.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    const nv = cx.querySelector('#sp-novo-sobre');
    if (nv) nv.onclick = () => novo(c.tipo === 'elogio' || c.tipo === 'sugestao' ? c.tipo : 'duvida', { titulo: '', descricao: 'Sobre o chamado #' + c.numero + ' (' + c.titulo + '): ' });
    const av = cx.querySelector('#sp-avaliar');
    if (av) {
      let nota = 0;
      const ROT = ['', 'Muito ruim', 'Ruim', 'Ok', 'Bom', 'Ótimo'];
      const pintaNota = n => av.querySelectorAll('[data-nota]').forEach(b => { b.classList.toggle('on', +b.dataset.nota <= n); b.setAttribute('aria-checked', String(+b.dataset.nota === n)); });
      av.querySelectorAll('[data-nota]').forEach(b => {
        b.onmouseenter = () => pintaNota(+b.dataset.nota);
        b.onmouseleave = () => pintaNota(nota);
        b.onclick = () => { nota = +b.dataset.nota; pintaNota(nota); av.querySelector('#sp-est-rot').textContent = ROT[nota];
          av.querySelector('#sp-aval-t').hidden = false; av.querySelector('#sp-aval-ok').hidden = false;
          av.querySelector('#sp-aval-t').placeholder = nota <= 3 ? 'O que podia ter sido melhor? (opcional)' : 'Quer contar algo? (opcional)'; };
      });
      av.querySelector('#sp-aval-ok').onclick = async () => {
        const bt = av.querySelector('#sp-aval-ok'); bt.disabled = true;
        try { await B7.DB.rpc('suporte_avaliar', { p_id: c.id, p_nota: nota, p_comentario: av.querySelector('#sp-aval-t').value.trim() || null });
          await carregar(); B7.UI.toast('Obrigado pela avaliação!'); pintar(); }
        catch (e) { bt.disabled = false; B7.UI.toast((e && e.message) || 'Não foi possível enviar.', { tipo: 'erro' }); }
      };
    }
  }

  /* o assistente responde no chamado (texto aparece enquanto é escrito) */
  async function atender(c) {
    if (atendendo[c.id] || !(B7.IA && B7.IA.pedir)) return;
    atendendo[c.id] = true;
    const box = document.getElementById('sp-msgs');
    const vazio = box && box.querySelector('.spx-msgs-vazio'); if (vazio) vazio.remove();
    let el = null;
    if (box) { box.insertAdjacentHTML('beforeend', bolhaIA('<div class="spx-ia-pensa"><i></i><i></i><i></i></div>', '', true)); el = box.lastElementChild; box.scrollTop = box.scrollHeight; }
    let parcial = '';
    let r = null;
    try {
      r = await B7.IA.pedir('suporte', { chamado_id: c.id }, { aoTrecho: p => {
        parcial += p;
        if (el && el.isConnected) { el.querySelector('.sp-bolha').innerHTML = '<div class="sp-msg-c"><b>Assistente B7</b><em class="sp-ia-tag">IA</em></div>' + rico(parcial); const b = document.getElementById('sp-msgs'); if (b) b.scrollTop = b.scrollHeight; }
      } });
    } catch (e) { r = null; }
    atendendo[c.id] = false;
    if (!r || !r.ok) {
      if (r && r.categoria === 'fora') { if (sel === c.id) mensagens(c); return; }
      if (el && el.isConnected) el.querySelector('.sp-bolha').innerHTML = '<div class="sp-msg-c"><b>Assistente B7</b><em class="sp-ia-tag">IA</em></div>' +
        '<p class="spx-ia-erro">' + esc((r && r.mensagem) || 'O assistente não conseguiu responder agora.') + '</p><button type="button" class="b fina pri" data-humano2>Falar com uma pessoa</button>';
      const h2 = el && el.querySelector('[data-humano2]');
      if (h2) h2.onclick = async () => { h2.disabled = true; try { await B7.DB.rpc('suporte_chamar_equipe', { p_id: c.id, p_motivo: 'o assistente não conseguiu responder' }); await carregar(); pintar(); } catch (e) { h2.disabled = false; } };
      return;
    }
    await carregar();
    if (r.escalou) B7.UI.toast('O assistente chamou alguém da equipe. A resposta chega aqui.');
    if (sel === c.id && document.getElementById('spx')) pintar();
  }

  /* números do atendimento na Central */
  async function resumoAtendimento() {
    let r = null;
    try { r = await B7.DB.rpc('suporte_atendimento_resumo', { p_dias: 30 }); } catch (e) { return; }
    const k = document.getElementById('spx-kpi-nota'); if (!k || !r) return;
    const partes = [];
    if (r.nota_ia != null) partes.push('assistente ' + String(r.nota_ia).replace('.', ','));
    if (r.nota_equipe != null) partes.push('equipe ' + String(r.nota_equipe).replace('.', ','));
    k.innerHTML = '<b>' + (partes.length ? partes.join(' · ') : '—') + '</b><span>nota do atendimento (30 dias)' +
      (r.com_ia ? ' · ' + r.resolvidos_ia + ' de ' + r.com_ia + ' resolvidos pelo assistente' : '') + '</span>';
    window.__suporteResumo = r;
  }
  async function avaliacoesAdm(cx) {
    if (!cx) return;
    let r = null;
    try { r = await B7.DB.rpc('suporte_atendimento_resumo', { p_dias: 90 }); } catch (e) { cx.innerHTML = '<div class="cb-aviso erro">Não foi possível carregar as avaliações.</div>'; return; }
    if (!cx.isConnected) return;
    const nota = (v, n) => v == null ? '—' : String(v).replace('.', ',') + ' <small>(' + n + ')</small>';
    const kpi = (v, rot, cls) => '<div class="spx-kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + rot + '</span></div>';
    const us = r.ultimas || [];
    cx.innerHTML = '<div class="spx-kpis">' + kpi(nota(r.nota_ia, r.n_ia), 'nota do assistente') + kpi(nota(r.nota_equipe, r.n_equipe), 'nota da equipe') +
        kpi(r.resolvidos_ia + ' de ' + r.com_ia, 'resolvidos pelo assistente', 'ok') + kpi(r.escalados, 'chamaram a equipe') + '</div>' +
      '<p class="spx-faq-nota leve">Últimos 90 dias. Nota de 1 a 5, dada por quem abriu o chamado depois de encerrado.</p>' +
      '<h2>Últimas avaliações</h2>' +
      (us.length ? '<div class="spx-aval-lista">' + us.map(a => '<button type="button" class="spx-aval-it" data-id="' + esc(a.id) + '"><span class="spx-estrelas">' + estrelas(a.avaliacao) + '</span>' +
          '<span class="spx-aval-tx"><b>#' + a.numero + ' · ' + esc(a.titulo) + '</b><small>' + esc((a.criado_por_nome || 'alguém').split(' ')[0]) + (a.do_cliente ? ' (cliente)' : '') + ' · ' +
          (a.avaliacao_alvo === 'ia' ? 'assistente' : 'equipe') + ' · ' + esc(quando(a.avaliado_em)) + '</small>' + (a.avaliacao_comentario ? '<q>' + esc(a.avaliacao_comentario) + '</q>' : '') + '</span></button>').join('') + '</div>'
        : '<div class="spx-vazio">' + SVG(IC.estrela) + '<b>Nenhuma avaliação ainda</b><p>Quando um chamado for encerrado, quem abriu pode dar a nota.</p></div>');
    cx.querySelectorAll('.spx-aval-it').forEach(b => b.onclick = () => { aba = 'chamados'; fila = 'todos'; sel = b.dataset.id; pintar(); });
  }

  /* ======================================== CONVERSA (as duas telas) */
  const ETAPAS = [['novo', 'Recebido'], ['em_analise', 'Em análise'], ['em_andamento', 'Em andamento'], ['resolvido', 'Resolvido']];
  function linhaTempo(c) {
    if (c.status === 'nao_vamos_fazer') return '<div class="sp-tempo fim-nao"><span class="sp-et feito"><i></i>Recebido</span><span class="sp-et atual"><i></i>Não será feito</span></div>';
    const at = ETAPAS.findIndex(e => e[0] === c.status);
    return '<div class="sp-tempo" style="--at:' + at + '">' + ETAPAS.map((e, k) => '<span class="sp-et' + (k < at ? ' feito' : k === at ? ' atual' : '') + '"><i></i>' + e[1] + '</span>').join('') + '</div>';
  }
  function conversa(cx, c, adm) {
    if (!cx || !c) return;
    marcarVisto(c);
    const t = TIPOS[c.tipo] || TIPOS.bug, souAutor = c.criado_por === eu(), fechado = !ABERTOS.includes(c.status);
    const comIA = c.atendente === 'ia' && !fechado;
    /* zzz223: encerrado = sem mais mensagens de quem pediu (para outro assunto, um chamado novo) */
    const travado = fechado && !adm;
    cx.innerHTML = '<div class="spx-conv' + (adm ? ' adm' : '') + '">' +
      '<button type="button" class="spx-voltar" id="sp-volta">' + SVG(IC.voltar) + (adm ? 'Fila' : 'Seus chamados') + '</button>' +
      '<header class="spx-conv-cab">' + icTipo(c.tipo) + '<div><div class="spx-conv-l1"><span class="sp-tp sp-tp-' + esc(c.tipo) + '">' + esc(t.rot) + '</span><span>#' + c.numero + '</span>' +
          (c.urgente && !fechado ? '<em class="spx-urg">urgente</em>' : '') + '</div>' +
        '<h2>' + esc(c.titulo) + '</h2><small>' + av(c.criado_por_nome) + esc(souAutor ? 'Você' : (c.criado_por_nome || 'alguém')) + ' · aberto ' + esc(quando(c.created_at)) + '</small></div>' +
        (adm ? '<button type="button" class="b fina contorno spx-virar" id="sp-virar-faq" title="Usa o título e a última resposta da equipe">Virar pergunta frequente</button>' : '') + '</header>' +
      atendimentoHTML(c, adm, souAutor) +
      (adm ? '<div class="spx-and"><div class="spx-st-pills" role="group" aria-label="Andamento">' + Object.keys(STATUS).map(k => '<button type="button" data-st="' + k + '" class="' + (c.status === k ? 'on' : '') + '">' + esc(STATUS[k]) + '</button>').join('') + '</div>' +
          '<label class="spx-prio-sel">Prioridade <select class="campo fina" id="sp-pr">' + Object.keys(PRIO).map(k => '<option value="' + k + '"' + (c.prioridade === k ? ' selected' : '') + '>' + PRIO[k] + '</option>').join('') + '</select></label></div>'
        : linhaTempo(c)) +

      '<div class="spx-pedido"><p>' + (c.descricao ? esc(c.descricao).replace(/\n/g, '<br>') : '<span class="leve">Sem detalhes.</span>') + '</p><div class="sp-anexos" id="sp-anexos"></div>' + (adm ? contextoHTML(c) : '') + '</div>' +
      '<div class="spx-msgs" id="sp-msgs">' + B7.UI.skeleton('lista', { n: 2 }) + '</div>' +
      (travado ? encerradoHTML(c, souAutor) :
      '<div class="spx-resp' + (adm && fechado ? ' nota' : '') + '">' +
        (adm && fechado ? '<p class="spx-fechado-adm">Chamado encerrado: a pessoa não escreve mais aqui. Você ainda pode deixar uma nota interna (ou mudar o andamento para reabrir).</p>' : '') +
        (adm && !fechado ? '<div class="spx-modo" role="tablist"><button role="tab" data-modo="resp" class="on">Responder para ' + esc((c.criado_por_nome || 'a pessoa').split(' ')[0]) + '</button><button role="tab" data-modo="nota">Nota interna</button></div>' +
          '<div class="sp-prontas">' + RESPOSTAS.map((r, k) => '<button type="button" data-pronta="' + k + '">' + esc(r[0]) + '</button>').join('') + '</div>' : '') +
        '<div class="spx-resp-cx"><textarea class="campo" id="sp-resp-t" rows="2" maxlength="4000" placeholder="' + (adm ? (fechado ? 'Nota só para a equipe…' : comIA ? 'Responder (você assume o atendimento no lugar do assistente)…' : 'Escreva a resposta…') : comIA ? 'Escreva para o assistente…' : 'Escreva para a equipe…') + '"></textarea>' +
          '<button type="button" class="spx-env" id="sp-resp-b" aria-label="Enviar">' + SVG(IC.enviar) + '</button></div>' +
        '<small class="leve">Ctrl+Enter envia' + (adm ? ' · a pessoa recebe aviso no sino (a nota interna, não)' : '') + '</small></div>') + '</div>';
    cx.querySelector('#sp-volta').onclick = () => { sel = null; pintar(); };
    anexos(c); mensagens(c);
    const vf = cx.querySelector('#sp-virar-faq');
    if (vf) vf.onclick = () => editarFaq(null, { pergunta: c.titulo, resposta: ultimaResp[c.id] || '' });
    ligarAtendimento(cx, c);
    if (travado) return;
    let interno = adm && fechado;
    const tx = cx.querySelector('#sp-resp-t');
    tx.addEventListener('input', () => { tx.style.height = 'auto'; tx.style.height = Math.min(200, tx.scrollHeight + 2) + 'px'; });
    cx.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
      interno = b.dataset.modo === 'nota';
      cx.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('on', x === b));
      cx.querySelector('.spx-resp').classList.toggle('nota', interno);
      tx.placeholder = interno ? 'Nota só para a equipe…' : 'Escreva a resposta…';
    });
    cx.querySelectorAll('[data-pronta]').forEach(b => b.onclick = () => { tx.value = RESPOSTAS[+b.dataset.pronta][1]; tx.focus(); tx.dispatchEvent(new Event('input')); });
    const enviar = async () => {
      const texto = tx.value.trim(); if (!texto) return;
      const bt = cx.querySelector('#sp-resp-b'); bt.disabled = true;
      try {
        await B7.DB.rpc('suporte_responder', { p_id: c.id, p_texto: texto, p_interno: adm && interno });
        tx.value = ''; tx.style.height = ''; c.updated_at = new Date().toISOString(); marcarVisto(c);
        /* quem da equipe responde assume o chamado: redesenha o cabeçalho */
        if (adm && !interno && c.atendente === 'ia' && c.criado_por !== eu()) { await carregar(); return pintar(); }
        await mensagens(c);
      } catch (e) { B7.UI.toast('Não foi possível enviar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
      bt.disabled = false;
    };
    cx.querySelector('#sp-resp-b').onclick = enviar;
    tx.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar(); } });
    /* andamento em um toque; prioridade ao trocar */
    const salvarAnd = async (st, pr) => {
      try {
        await B7.DB.rpc('suporte_status', { p_id: c.id, p_status: st, p_prioridade: pr });
        await carregar(); B7.UI.toast('Andamento: ' + STATUS[st] + (c.criado_por !== eu() ? '. A pessoa foi avisada.' : '.')); pintar();
      } catch (e) { B7.UI.toast('Não foi possível salvar: ' + ((e && e.message) || 'erro'), { tipo: 'erro' }); }
    };
    cx.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { if (b.dataset.st !== c.status) salvarAnd(b.dataset.st, cx.querySelector('#sp-pr').value); });
    const pr = cx.querySelector('#sp-pr'); if (pr) pr.onchange = () => salvarAnd(c.status, pr.value);
    if (!adm || window.matchMedia('(min-width: 1100px)').matches) setTimeout(() => { try { tx.focus({ preventScroll: true }); } catch (e) {} }, 80);
  }

  function contextoHTML(c) {
    const x = c.contexto || {}; if (!Object.keys(x).length) return '';
    const l = (r, v) => v ? '<div><span>' + r + '</span><b>' + esc(String(v)) + '</b></div>' : '';
    return '<details class="sp-ctx"><summary>Informações técnicas' + ((x.erros || []).length ? ' · <em>' + x.erros.length + ' erro' + (x.erros.length === 1 ? '' : 's') + '</em>' : '') + '</summary><div class="sp-ctx-g">' +
      l('Tela', x.tela) + l('Versão', x.versao) + l('Onde', x.plataforma) + l('Janela', x.janela) + l('Perfil', x.papel) + (x.online === false ? l('Conexão', 'sem internet') : '') +
      (x.navegador ? '<div class="sp-ctx-l"><span>Navegador</span><b>' + esc(x.navegador) + '</b></div>' : '') +
      ((x.erros || []).length ? '<div class="sp-ctx-l"><span>Erros recentes</span><pre>' + esc(x.erros.map(e => e.msg).join('\n')) + '</pre></div>' : '') +
      ((x.rastro || []).length ? '<div class="sp-ctx-l"><span>Rastro</span><pre>' + esc(JSON.stringify(x.rastro).slice(0, 900)) + '</pre></div>' : '') +
      '</div></details>';
  }

  async function anexos(c) {
    if (!(c.anexos || []).length) return;
    const urls = await Promise.all(c.anexos.map(async p => { try { const { data } = await sb().storage.from(BUCKET).createSignedUrl(p, 3600); return data && data.signedUrl; } catch (e) { return null; } }));
    const box = document.getElementById('sp-anexos'); if (!box) return;
    box.innerHTML = urls.map((u, i) => !u ? '' : /\.(webm|mp4)(\?|$)/i.test(c.anexos[i]) ? '<video class="sp-anexo-video" controls preload="metadata" src="' + esc(u) + '"></video>'
      : '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer"><img alt="Print ' + (i + 1) + '" src="' + esc(u) + '"></a>').join('');
  }

  async function mensagens(c) {
    const cx = document.getElementById('sp-msgs'); if (!cx) return;
    let ms = [];
    try { ms = ok(await sb().from('suporte_mensagens').select('*').eq('chamado_id', c.id).order('created_at')) || []; }
    catch (e) { cx.innerHTML = '<p class="leve">Não foi possível carregar a conversa.</p>'; return; }
    const box = document.getElementById('sp-msgs'); if (!box || sel !== c.id) return;
    const resp = ms.filter(m => !m.interno && !m.sistema && m.autor_id !== c.criado_por);
    if (resp.length) ultimaResp[c.id] = resp[resp.length - 1].texto;
    box.innerHTML = ms.length ? ms.map(m => m.sistema
      ? '<div class="sp-sis' + (m.ia ? ' ia' : '') + '"><span>' + esc(m.texto) + (m.ia ? '' : ' · ' + esc((m.autor_nome || '').split(' ')[0])) + ' · ' + esc(quando(m.created_at)) + '</span></div>'
      : m.ia ? bolhaIA(rico(m.texto), quando(m.created_at))
      : '<div class="sp-msg' + (m.autor_id === eu() ? ' minha' : '') + (m.interno ? ' interna' : '') + '">' + (m.autor_id === eu() ? '' : av(m.autor_nome)) +
        '<div class="sp-bolha"><div class="sp-msg-c"><b>' + esc(m.autor_id === eu() ? 'Você' : (m.autor_nome || 'Alguém')) + '</b>' + (m.interno ? '<em>nota interna</em>' : '') + '<small>' + esc(quando(m.created_at)) + '</small></div>' +
        '<p>' + esc(m.texto).replace(/\n/g, '<br>') + '</p></div></div>').join('')
      : '<p class="spx-msgs-vazio">' + (equipe() ? 'Ainda sem respostas. A primeira resposta tira o chamado da fila de "sem resposta".' : c.atendente === 'ia' ? 'O assistente está lendo o seu chamado…' : 'A equipe ainda não respondeu. Você recebe um aviso quando responder.') + '</p>';
    box.scrollTop = box.scrollHeight;
    /* zzz223: com o assistente atendendo, ele responde a quem pediu (no começo e a cada mensagem nova) */
    const falas = ms.filter(m => !m.sistema && !m.interno);
    if (c.atendente === 'ia' && ABERTOS.includes(c.status) && c.criado_por === eu() && (!falas.length || (!falas[falas.length - 1].ia && falas[falas.length - 1].autor_id === eu()))) atender(c);
  }

  /* ideias com votos, dentro da tela (equipe: as 5 primeiras; administração: todas, com o andamento) */
  async function ideiasInline(cx, max, adm) {
    if (!cx) return;
    let l = [];
    try { l = (await B7.DB.rpc('suporte_ideias', {})) || []; }
    catch (e) { cx.innerHTML = '<p class="leve">Não foi possível carregar as ideias.</p>'; return; }
    if (!cx.isConnected) return;
    const mostra = l.slice(0, max);
    cx.innerHTML = mostra.length ? '<div class="sp-ideias">' + mostra.map((x, i) => '<div class="sp-ideia" style="--i:' + i + '">' +
        '<button type="button" class="sp-voto' + (x.eu_votei ? ' on' : '') + '" data-voto="' + esc(x.id) + '" aria-pressed="' + x.eu_votei + '" aria-label="Votar">' + SVG(IC.seta) + '<b>' + x.votos + '</b></button>' +
        '<div class="sp-ideia-tx"><b>' + esc(x.titulo) + '</b><small>#' + x.numero + ' · ' + esc(x.autor || 'alguém') + ' · ' + esc(quando(x.created_at)) + '</small></div>' + chipStatus(x.status) +
        (adm ? '<button type="button" class="b fina contorno" data-abrir="' + esc(x.id) + '">Abrir</button>' : '') + '</div>').join('') + '</div>' +
        (l.length > max ? '<button type="button" class="spx-link" data-todas>Ver todas as ' + l.length + ' ideias</button>' : '')
      : '<div class="spx-vazio">' + SVG(IC.ideia) + '<b>Nenhuma ideia ainda</b><p>Mande a primeira!</p></div>';
    cx.querySelectorAll('[data-voto]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const n = await B7.DB.rpc('suporte_votar', { p_id: b.dataset.voto });
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('b').textContent = n;
        b.classList.remove('pulo'); void b.offsetWidth; b.classList.add('pulo');
      } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível votar.', { tipo: 'erro' }); }
      b.disabled = false;
    });
    cx.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => { aba = 'chamados'; fila = 'todos'; sel = b.dataset.abrir; pintar(); });
    const td = cx.querySelector('[data-todas]'); if (td) td.onclick = () => ideias();
  }

  /* zzz214: as sugestões da equipe, para todos votarem. Só o resumo (os
     detalhes do chamado continuam com quem abriu e com a equipe). */
  async function ideias() {
    const m = B7.UI.modal('<h3>Ideias da equipe</h3><p class="sub">As sugestões que a equipe mandou pelo Suporte. Vote nas que você também quer: as mais votadas sobem.</p>' +
      '<div class="sp-ideias" id="sp-ideias-l">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Fechar</button><button type="button" class="b pri" id="sp-ideia-nova">+ Mandar uma ideia</button></div>', { larga: true });
    m.querySelectorAll('[data-fecha]').forEach(x => x.onclick = m.fechar);
    m.querySelector('#sp-ideia-nova').onclick = () => { m.fechar(); novo('sugestao'); };
    const cx = m.querySelector('#sp-ideias-l');
    const pintarI = l => {
      cx.innerHTML = l.length ? l.map(x => '<div class="sp-ideia"><button type="button" class="sp-voto' + (x.eu_votei ? ' on' : '') + '" data-voto="' + esc(x.id) + '" aria-pressed="' + x.eu_votei + '" aria-label="Votar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg><b>' + x.votos + '</b></button>' +
          '<div class="sp-ideia-tx"><b>' + esc(x.titulo) + '</b><small>#' + x.numero + ' · ' + esc(x.autor || 'alguém') + ' · ' + esc(quando(x.created_at)) + '</small></div>' + chipStatus(x.status) + '</div>').join('')
        : '<div class="sp-vazio"><b>Nenhuma ideia ainda.</b><p>Seja a primeira pessoa a mandar uma.</p></div>';
      cx.querySelectorAll('[data-voto]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try {
          const n = await B7.DB.rpc('suporte_votar', { p_id: b.dataset.voto });
          const on = !b.classList.contains('on');
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('b').textContent = n;
          b.classList.remove('pulo'); void b.offsetWidth; b.classList.add('pulo');
        } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível votar.', { tipo: 'erro' }); }
        b.disabled = false;
      });
    };
    try { pintarI((await B7.DB.rpc('suporte_ideias', {})) || []); }
    catch (e) { cx.innerHTML = '<p class="sp-vazio">' + esc((e && e.message) || 'Não foi possível carregar as ideias.') + '</p>'; }
  }

  return { abrir, novo, ideias, faqIds };
})();
