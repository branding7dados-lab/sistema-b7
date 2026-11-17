/* =====================================================================
   ASSISTENTE B7 NOS GRUPOS — tela (4.55.0)   #/whatsapp/assistente
   O "Gabriel" do B7: configuração, atividade, dúvidas, conhecimento e um
   simulador para testar sem mandar nada. Só administrador.
   Servidor: supabase/functions/_shared/assistente.ts (wa-entrada / wa-evolution).
   ===================================================================== */
window.B7 = window.B7 || {};
B7.AssistenteWA = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const chamar = (acao, extra) => B7.DB.waEvolution(acao, extra);
  /* 4.62.0: as 30 vozes do Google (nome · jeito) */
  const VOZES = [['Orus', 'firme'], ['Puck', 'animada'], ['Charon', 'informativa'], ['Fenrir', 'empolgada'], ['Achird', 'amigável'], ['Zubenelgenubi', 'casual'], ['Sadachbia', 'viva'],
    ['Algenib', 'grave'], ['Iapetus', 'clara'], ['Umbriel', 'tranquila'], ['Algieba', 'suave'], ['Alnilam', 'firme'], ['Schedar', 'equilibrada'], ['Rasalgethi', 'informativa'],
    ['Sadaltager', 'conhecedora'], ['Enceladus', 'sussurrada'], ['Kore', 'firme · fem.'], ['Aoede', 'leve · fem.'], ['Leda', 'jovem · fem.'], ['Zephyr', 'clara · fem.'],
    ['Callirrhoe', 'tranquila · fem.'], ['Autonoe', 'clara · fem.'], ['Despina', 'suave · fem.'], ['Erinome', 'clara · fem.'], ['Laomedeia', 'animada · fem.'],
    ['Achernar', 'suave · fem.'], ['Gacrux', 'madura · fem.'], ['Pulcherrima', 'direta · fem.'], ['Vindemiatrix', 'gentil · fem.'], ['Sulafat', 'calorosa · fem.']];
  const DIAS = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']];
  const TONS = [
    ['😊 Simpático', 'Seja simpático e acolhedor, trate a pessoa pelo primeiro nome e use no máximo um emoji.'],
    ['🎯 Direto', 'Vá direto ao ponto, frases curtas, sem rodeios.'],
    ['👔 Formal', 'Use um tom profissional e educado, sem gírias e sem emojis.'],
    ['😄 Descontraído', 'Pode ser leve e bem-humorado, como alguém da agência que conhece o cliente.']
  ];
  const TIPOS_REGRA = [['NUNCA', 'Nunca'], ['SEMPRE', 'Sempre'], ['NÃO RESPONDA quando o assunto for', 'Não responder sobre'], ['CHAME', 'Chamar alguém quando']];
  const ROT_TIPO = { resposta: ['Respondeu', 'ok'], duvida: ['Perguntou à equipe', 'dv'], repasse: ['Repassou resposta', 'rp'], instrucao: ['Cumpriu ordem', 'or'], fora_horario: ['Fora do horário', 'fh'], teste: ['Teste', 'ts'], erro: ['Falhou', 'er'], resumo: ['Pendências à equipe', 'rp'], consulta: ['Respondeu a equipe', 'or'], documento: ['Mandou PDF', 'ok'], recado: ['Deu recado', 'rp'], imagem: ['Gerou imagem', 'ok'], demanda: ['Mexeu nas demandas', 'or'], reacao: ['Reagiu', 'ok'], figurinha: ['Mandou figurinha', 'ok'], bot: ['Falou com outra IA', 'rp'], print: ['Mandou print', 'ok'], privado: ['Chamou no privado', 'rp'], agente: ['Agiu (ferramentas)', 'or'], aviso: ['Avisou a equipe', 'rp'], aprendeu: ['Aprendeu com correção', 'ok'], transcricao: ['Transcreveu', 'ok'], zoeira: ['Zoou sem ser chamado', 'rp'], confirmar: ['Pediu confirmação', 'dv'] };
  let S = null, raiz = null;

  const ini = s => { const p = String(s || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };
  const quando = iso => { const d = new Date(iso), h = new Date(); const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === h.toDateString() ? hm : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hm; };
  const regrasDe = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const tp = TIPOS_REGRA.find(([k]) => l.toUpperCase().startsWith(k.toUpperCase()));
    return tp ? { tipo: tp[0], texto: l.slice(tp[0].length).replace(/^[:\s]+/, '') } : { tipo: '', texto: l };
  });
  const regrasTexto = l => l.map(r => (r.tipo ? r.tipo + ': ' : '') + r.texto).join('\n');

  async function abrir() {
    const painel = document.getElementById('painel-dashboard'); if (!painel) return;
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['WhatsApp', 'Assistente']);
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/whatsapp');
    const adm = !!(B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin()));
    painel.innerHTML = '<div class="asw" id="asw"><div class="asw-carrega"><i></i>Abrindo o assistente…</div></div>';
    raiz = painel.querySelector('#asw');
    if (!adm) { raiz.innerHTML = '<div class="asw-vazio"><b>Só o administrador configura o assistente.</b></div>'; return; }
    const desde7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const [c, ap, dv, rg, gr, tg, pf, mm, cl] = await Promise.all([
      sb().from('wa_assistente').select('*').eq('id', 1).maybeSingle(),
      sb().from('wa_assistente_aprendizados').select('*').order('criado_em', { ascending: false }).limit(200),
      sb().from('wa_assistente_duvidas').select('id,jid,grupo_nome,autor,pergunta,pergunta_equipe,criada_em').is('respondida_em', null).order('criada_em', { ascending: false }).limit(40),
      sb().from('wa_assistente_registro').select('*').gte('em', desde7).order('em', { ascending: false }).limit(300),
      sb().from('wa_conversas').select('jid,nome,cliente_id,foto_url').eq('tipo', 'grupo').not('cliente_id', 'is', null).order('nome'),
      sb().from('wa_conversas').select('jid,nome').eq('tipo', 'grupo').order('nome').limit(500),
      sb().from('perfis').select('id,nome').eq('estado', 'ativa').neq('papel', 'cliente').order('nome'),
      sb().from('wa_otto_memoria').select('id,texto,sobre,criado_por,criada_em,cliente_id,origem').eq('ativo', true).order('criada_em', { ascending: false }).limit(200),
      sb().from('clientes').select('id,nome').is('deleted_at', null).order('nome').limit(500)
    ]);
    if (!raiz.isConnected) return;
    if (c.error || !c.data) { raiz.innerHTML = '<div class="asw-vazio"><b>Não consegui abrir</b><p>' + esc((c.error && c.error.message) || 'Configuração não encontrada.') + '</p></div>'; return; }
    const cfg = c.data;
    S = { cfg: JSON.parse(JSON.stringify(cfg)), orig: JSON.stringify(cfg), aba: S && S.aba && S.aba !== 'grupos' ? S.aba : 'geral', ap: ap.data || [], dv: dv.data || [], reg: rg.data || [], grupos: gr.data || [],
      regras: regrasDe(cfg.regras), busca: '', todosGrupos: tg.data || [], perfis: (pf.data || []).filter(p => !/teste/i.test(p.nome || '')), mem: mm.data || [], clientes: cl.data || [], memFiltro: '', teste: [], testeJid: (gr.data || [])[0] ? gr.data[0].jid : '', testeEquipe: false };
    if (!S.cfg.horario) S.cfg.horario = { ativo: false, ini: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5], mensagem: '' };
    desenhar();
    raiz.addEventListener('click', clique);
    raiz.addEventListener('input', digitou);
    raiz.addEventListener('change', digitou);
  }

  const mudou = () => { S.cfg.regras = regrasTexto(S.regras); return JSON.stringify(S.cfg) !== S.orig; };
  function marcarSujo() {
    const sujo = mudou();
    const b = raiz.querySelector('#asw-salvar'); if (b) b.classList.toggle('on', sujo);
    const b2 = raiz.querySelector('#asw-salvar2'); if (b2) b2.hidden = !sujo;
    posicionarBarra();
  }
  /* 4.56.6: a barra de Salvar fica logo ACIMA do que estiver fixo embaixo (navegação do app,
     botão da IA) — medido no aparelho, não chutado */
  function posicionarBarra() {
    const barra = raiz && raiz.querySelector('.asw-barra'); if (!barra) return;
    let topo = innerHeight;
    document.querySelectorAll('#nav-inferior, .nav-inferior, #b7-chat-fab, .ia-fab').forEach(el => {
      const r = el.getBoundingClientRect(), st = getComputedStyle(el);
      if (r.height && st.display !== 'none' && st.visibility !== 'hidden' && r.top > innerHeight * 0.5 && (st.position === 'fixed' || st.position === 'sticky')) topo = Math.min(topo, r.top);
    });
    barra.style.bottom = Math.max(18, innerHeight - topo + 10) + 'px';
  }
  addEventListener('resize', () => posicionarBarra());

  /* 4.68.0: tela nova — navegação lateral por assunto, ajustes em linhas (o que faz ↔ controle),
     e a linha do tempo "assim o Otto responde" que muda com a velocidade */
  const IC = {
    geral: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    velocidade: '<path d="M12 13l4-4"/><path d="M3.5 18a9 9 0 1 1 17 0"/><circle cx="12" cy="13" r="1.2"/>',
    jeito: '<path d="M8 10h.01M16 10h.01"/><path d="M8.5 14.5c2 1.6 5 1.6 7 0"/><circle cx="12" cy="12" r="9"/>',
    equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M16 4.6a3.2 3.2 0 0 1 0 6.3M18 14.8c1.7.6 2.7 2.4 3 5.2"/>',
    clientes: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    saber: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V5.5"/><path d="M9 8h7"/>',
    controle: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    testar: '<path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M8.5 3h7M7 15h10"/>'
  };
  const icone = k => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[k] || '') + '</svg>';
  /* 4.73.0: o que ele pode fazer (grupos de ferramentas do servidor: otto-controle.ts → GRUPOS_FERRAMENTAS) */
  const FERRS = [['demandas', 'Mexer nas demandas', 'Criar, editar, mudar status e excluir demandas de vídeo. Desligado: nem consulta.'],
    ['mensagem_em_grupo', 'Mandar mensagem em outro grupo', 'Ex.: “manda no grupo da equipe”, “avisa o grupo do Mercato”.'],
    ['privado', 'Chamar no privado', 'Mandar recado no privado de alguém da equipe.'],
    ['audio', 'Mandar áudio em outro lugar', 'Áudio no grupo da equipe ou no privado. Responder em áudio ali mesmo fica em Velocidade e voz.'],
    ['print', 'Print de conversa', 'Também encaminhar a última coisa que ele mandou.'],
    ['imagem', 'Gerar e editar imagem', ''], ['pdf', 'PDF de roteiro e linha editorial', ''],
    ['figurinha', 'Figurinhas', 'Mandar figurinha quando pedem ou quando cai bem.'],
    ['editar_apagar', 'Editar e apagar mensagem dele', ''],
    ['lembrar', 'Guardar na memória', 'Lembrar e esquecer combinados quando pedem.'],
    ['resumos', 'Pendências, resumo e bom dia a pedido', 'Os automáticos têm a chave deles em Equipe e Clientes.']];
  const VELOCIDADES = [['rapido', 'Rápido', 'Responde assim que pensa'], ['natural', 'Natural', 'Digita no tamanho da resposta'], ['humano', 'Humano', 'Espera como uma pessoa']];
  /* mesmas contas do servidor (assistente.ts → tempoDigitando) */
  const digitaMs = (c, tam) => { const v = c.velocidade || 'natural'; if (v === 'rapido') return 500; if (v === 'humano') return ((Math.max(1, c.espera_min_s || 4) + Math.max(c.espera_min_s || 4, c.espera_max_s || 9)) / 2) * 1000; return Math.max(700, Math.min(2500, 400 + tam * 12)); };
  const seg = (k, val, ops) => '<div class="asw-seg" role="radiogroup">' + ops.map(([v, r, d]) => '<label class="' + (val === v ? 'on' : '') + '"' + (d ? ' title="' + esc(d) + '"' : '') + '><input type="radio" name="' + k + '" data-c="' + k + '" value="' + v + '"' + (val === v ? ' checked' : '') + '><span>' + r + '</span></label>').join('') + '</div>';
  const linha = (t, d, ctl, cls) => '<div class="asw-row ' + (cls || '') + '"><div class="asw-row-t"><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div><div class="asw-row-c">' + ctl + '</div></div>';
  const chave = (k, on, extra) => '<label class="asw-tg"><input type="checkbox" data-c="' + k + '"' + (on ? ' checked' : '') + (extra || '') + '><span></span></label>';
  const bloco = (t, d, html, cls) => '<section class="asw-bl ' + (cls || '') + '"><header><h3>' + t + '</h3>' + (d ? '<p>' + d + '</p>' : '') + '</header>' + html + '</section>';
  /* tempo de resposta real (últimos 7 dias): mediana, em segundos */
  function tempoReal() {
    const ms = S.reg.filter(r => ['agente', 'consulta', 'resposta', 'instrucao'].includes(r.tipo) && r.ms).map(r => r.ms).sort((a, b) => a - b);
    return ms.length ? ms[Math.floor(ms.length / 2)] / 1000 : null;
  }
  function linhaDoTempo() {
    const c = S.cfg, t = tempoReal(), pensa = t != null ? Math.min(12, Math.max(0.8, t * 0.6)) : 2.5, digita = digitaMs(c, 140) / 1000;
    const tot = pensa + digita, pct = x => Math.max(10, Math.round(x / tot * 100));
    return '<div class="asw-tl2" id="asw-tl2" style="--p:' + pct(pensa) + '%;--d:' + pct(digita) + '%">' +
      '<div class="asw-tl2-bolha eu">Otto, como tá a arte da Mercato?</div>' +
      '<div class="asw-tl2-barra"><i class="pensa"><span>pensando ~' + pensa.toFixed(1).replace('.', ',') + ' s</span></i><i class="digita"><span>digitando… ' + digita.toFixed(1).replace('.', ',') + ' s</span></i></div>' +
      '<div class="asw-tl2-bolha ele"><b>' + esc((c.nome || 'Otto').split(' ')[0]) + '</b>Tá em produção com o Pedro, sai amanhã 👍</div>' +
      '<p class="asw-tl2-pe">O "digitando…" aparece assim que a mensagem chega' + (t != null ? '. O tempo de pensar vem da média real dos últimos 7 dias.' : '.') + '</p></div>';
  }

  function desenhar() {
    const c = S.cfg, hoje = new Date().toDateString();
    const reais = S.reg.filter(r => r.tipo !== 'teste');
    const nHoje = reais.filter(r => new Date(r.em).toDateString() === hoje && r.tipo !== 'erro').length;
    const ativos = S.grupos.filter(g => !((c.grupos || {})[g.jid] || {}).desligado).length;
    const t = tempoReal();
    const ABAS = [['geral', 'Visão geral', S.dv.length || null], ['velocidade', 'Velocidade e voz'], ['jeito', 'Personalidade'], ['equipe', 'Equipe', (c.equipe || []).length],
      ['clientes', 'Clientes e grupos', ativos + '/' + S.grupos.length], ['saber', 'Conhecimento', (S.mem || []).length + S.ap.length || null], ['controle', 'Permissões', (c.ferramentas_off || []).length ? (FERRS.length - (c.ferramentas_off || []).length) + '/' + FERRS.length : null], ['testar', 'Testar']];
    const nome = esc((c.nome || 'Otto').split(' ')[0]);
    raiz.innerHTML =
      '<header class="asw-hero' + (c.ativo ? ' on' : '') + '">' +
        '<a class="asw-volta" href="#/whatsapp">‹ Conversas</a>' +
        '<div class="asw-id"><span class="asw-av">' + esc(ini(c.nome)) + '<i></i></span>' +
          '<div class="asw-id-t"><h1>' + esc(c.nome || 'Assistente') + '</h1><p>' + (c.ativo ? 'Ligado e de olho no WhatsApp da Branding7' : 'Desligado: não responde ninguém') + '</p></div>' +
          '<label class="asw-chave" title="' + (c.ativo ? 'Desligar' : 'Ligar') + ' o ' + nome + '"><input type="checkbox" data-c="ativo"' + (c.ativo ? ' checked' : '') + '><span></span></label></div>' +
        '<dl class="asw-stats">' +
          '<div><dt>respostas hoje</dt><dd>' + nHoje + '</dd></div>' +
          '<div><dt>tempo de resposta</dt><dd>' + (t != null ? t.toFixed(1).replace('.', ',') + '<small> s</small>' : '–') + '</dd></div>' +
          '<div class="' + (S.dv.length ? 'alerta' : '') + '"><dt>dúvidas esperando</dt><dd>' + S.dv.length + '</dd></div>' +
          '<div><dt>grupos ligados</dt><dd>' + ativos + '<small>/' + S.grupos.length + '</small></dd></div>' +
        '</dl></header>' +
      '<div class="asw-casca">' +
        '<nav class="asw-nav" aria-label="Seções">' + ABAS.map(([k, r, n]) => '<button class="' + (S.aba === k ? 'on' : '') + '" data-aba="' + k + '"' + (S.aba === k ? ' aria-current="page"' : '') + '>' + icone(k) + '<span>' + r + '</span>' + (n != null ? '<b>' + n + '</b>' : '') + '</button>').join('') + '</nav>' +
        '<section class="asw-corpo">' + corpo() + '</section>' +
      '</div>' +
      '<div class="asw-barra"><span>Alterações ainda não salvas</span><button class="b" data-desfazer>Desfazer</button><button class="b pri" id="asw-salvar" data-salvar>Salvar</button></div>';
    marcarSujo();
  }

  function corpo() {
    const c = S.cfg, nome = esc((c.nome || 'Otto').split(' ')[0]);
    if (S.aba === 'geral') {
      const reg = S.reg.slice(0, 40);
      return '<div class="asw-2">' +
        bloco('Dúvidas esperando a equipe', 'Quando ele não sabe algo de um cliente, a pergunta para aqui e no WhatsApp de quem recebe dúvidas.',
          S.dv.length ? S.dv.map(d =>
            '<div class="asw-dv" data-dv="' + esc(d.id) + '"><div class="asw-dv-top"><b>' + esc(d.grupo_nome || '') + '</b><time>' + quando(d.criada_em) + '</time></div>' +
            '<p class="asw-dv-q"><span>' + esc(d.autor || 'Cliente') + '</span>“' + esc(d.pergunta) + '”</p>' +
            (d.pergunta_equipe ? '<p class="asw-dv-p">' + esc(d.pergunta_equipe) + '</p>' : '') +
            '<div class="asw-dv-r"><input class="campo" placeholder="Sua resposta — ele reescreve e manda no grupo"><button class="b pri" data-resp>Responder</button></div></div>').join('')
            : '<div class="asw-nada">Nenhuma dúvida esperando.</div>') +
        bloco('O que ele fez', 'Últimos 7 dias, do mais novo para o mais antigo.', reg.length ? '<ol class="asw-tl">' + reg.map(r => {
          const tp = ROT_TIPO[r.tipo] || [r.tipo, ''];
          return '<li><span class="asw-tag ' + tp[1] + '">' + tp[0] + '</span><time>' + quando(r.em) + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1).replace('.', ',') + ' s' : '') + '</time><b>' + esc(r.grupo || '') + '</b>' +
            (r.pergunta ? '<p class="q">' + esc(r.autor ? r.autor + ': ' : '') + esc(r.pergunta) + '</p>' : '') + (r.resposta ? '<p class="r">' + esc(r.resposta) + '</p>' : '') + '</li>';
        }).join('') + '</ol>' : '<div class="asw-nada">Nada por aqui ainda.<small>' + (c.ativo ? 'Chame o ' + nome + ' no grupo da equipe para começar.' : 'Ligue o ' + nome + ' no topo da tela.') + '</small></div>') + '</div>';
    }
    if (S.aba === 'velocidade') {
      const v = c.velocidade || 'natural', mx = Number(c.audio_max_s) || 40;
      return bloco('Assim o ' + nome + ' responde', 'Mude a velocidade e veja quanto tempo cada parte leva.', linhaDoTempo() +
          linha('Velocidade', 'Quanto tempo o “digitando…” fica antes da resposta aparecer.', seg('velocidade', v, VELOCIDADES)) +
          '<div class="asw-row asw-humano' + (v === 'humano' ? '' : ' fora') + '"><div class="asw-row-t"><b>Espera do modo humano</b><small>Um tempo aleatório entre os dois valores.</small></div><div class="asw-row-c"><span class="asw-par"><input class="campo asw-mini" type="number" min="1" max="30" data-c="espera_min_s" value="' + (c.espera_min_s || 4) + '"> a <input class="campo asw-mini" type="number" min="1" max="40" data-c="espera_max_s" value="' + (c.espera_max_s || 9) + '"> s</span></div></div>', 'asw-destaque') +
        bloco('Áudio', 'Quando ele ouve e quando ele fala.',
          linha('Ouvir áudios', 'Transcreve todo áudio que chega (aparece escrito na Central).', chave('ouvir_audio', c.ouvir_audio !== false)) +
          linha('Responder em áudio', 'Com a equipe, quando mandam áudio para ele. Também fala quando pedem (“' + nome + ', me manda um áudio”).', chave('responder_audio', c.responder_audio !== false)) +
          linha('Alternar áudio e texto', 'De vez em quando responde a equipe em áudio, sem ninguém pedir. Só em conversa leve: pendências, listas, prazos, links e números sempre vão escritos, e nunca manda dois áudios seguidos. Cliente nunca.', seg('audio_variar', String(Number(c.audio_variar) || 0), [['0', 'Nunca'], ['15', 'Às vezes'], ['30', 'Bastante']])) +
          linha('Duração máxima', 'Áudio longo demais ninguém ouve até o fim.', '<span class="asw-faixa"><input type="range" min="15" max="120" step="5" data-c="audio_max_s" data-num value="' + mx + '"><output id="asw-maxs">' + mx + ' s</output></span>') +
          linha('Adaptar o texto para fala', 'Reescreve a resposta do jeito que se fala (datas e números por extenso). Leva alguns segundos a mais.', seg('audio_roteiro', c.audio_roteiro || 'auto', [['auto', 'Só quando precisa'], ['sempre', 'Sempre'], ['nunca', 'Nunca']])) +
          linha('Gravar como gente', 'Deixa o “gravando áudio…” no tempo do áudio antes de mandar. Mais natural, mais lento.', chave('audio_humano', !!c.audio_humano))) +
        bloco('Voz', 'Como ele soa nos áudios.',
          linha('Voz', 'Escolha e ouça antes de salvar.', '<div class="asw-voz-l"><select class="campo" data-c="voz">' + VOZES.map(([vz, d]) => '<option value="' + vz + '"' + ((c.voz || 'Orus') === vz ? ' selected' : '') + '>' + vz + ' · ' + d + '</option>').join('') + '</select><button class="b fina contorno" data-voz-ouvir>▶ Ouvir</button></div>') +
          linha('Jeito de falar', 'Em poucas palavras.', '<input class="campo" data-c="voz_estilo" maxlength="200" placeholder="Ex.: animado, jovem, sotaque baiano leve" value="' + esc(c.voz_estilo || '') + '">') +
          linha('De onde vem a voz', 'ElevenLabs aceita voz clonada. Precisa da chave ELEVENLABS_API_KEY no Supabase; sem ela, usa a do Google.', seg('voz_provedor', c.voz_provedor || 'gemini', [['gemini', 'Google'], ['elevenlabs', 'ElevenLabs']])) +
          '<div class="asw-row asw-eleven' + (c.voz_provedor === 'elevenlabs' ? '' : ' fora') + '"><div class="asw-row-t"><b>ID da voz na ElevenLabs</b><small>Fica em Voices → a voz → ID.</small></div><div class="asw-row-c"><input class="campo" data-c="voz_eleven_id" placeholder="Ex.: 21m00Tcm4TlvDq8ikWAM" value="' + esc(c.voz_eleven_id || '') + '"></div></div>');
    }
    if (S.aba === 'jeito') {
      const h = c.horario || {};
      return '<div class="asw-2">' +
        bloco('Identidade', 'Como ele se apresenta e fala com os clientes.',
          '<label class="asw-lb">Nome</label><input class="campo" data-c="nome" maxlength="40" value="' + esc(c.nome || '') + '" placeholder="Ex.: Otto">' +
          '<label class="asw-lb">Jeito de falar com cliente</label><div class="asw-chips">' + TONS.map(([r], i) => '<button class="asw-chip" data-tom="' + i + '">' + r + '</button>').join('') + '</div>' +
          '<textarea class="campo" data-c="jeito" rows="5" placeholder="Ex.: trate pelo primeiro nome; prazo padrão de arte é 2 dias úteis; vídeos saem em até 5 dias depois da gravação.">' + esc(c.jeito || '') + '</textarea>' +
          linha('Se apresentar como assistente virtual', 'Desligado: fala como uma pessoa da equipe, sem dizer que é IA. Ligado: assume que é o assistente virtual da Branding7 e pode se apresentar assim. Nos dois casos, se alguém perguntar a sério se é robô, ele não mente.', chave('se_apresenta_ia', !!c.se_apresenta_ia)) +
          linha('Ajudar sem ser chamado', 'No grupo do cliente, responde pedidos de ajuda mesmo sem ser marcado — e fica quieto se a equipe falou nos últimos <input class="campo asw-mini" type="number" min="5" max="600" data-c="pausa_min" value="' + (c.pausa_min || 30) + '"> min.', chave('sem_marcacao', !!c.sem_marcacao))) +
        bloco('Como ele escreve', 'Vale com a equipe e com os clientes.',
          linha('Tamanho das respostas', 'Automático: ele mede pelo pedido. Algo para produzir (legenda, roteiro) sai completo em qualquer opção.', seg('tamanho', c.tamanho || 'auto', [['auto', 'Automático'], ['curta', 'Curtas'], ['media', 'Médias'], ['detalhada', 'Detalhadas']]), 'asw-pilha') +
          linha('Emojis e figurinhas', 'Nada: sem emoji no texto e sem reagir ou mandar figurinha por conta própria (só se pedirem). Bastante: mais emoji, reage a toda risada e manda mais figurinha.', seg('emojis', c.emojis || 'pouco', [['nada', 'Nada'], ['pouco', 'Pouco'], ['bastante', 'Bastante']]), 'asw-pilha') +
          linha('Apelidos do ' + nome, 'Outros nomes que também chamam ele, separados por vírgula. Evite palavras comuns (“robô”, “bot”): ele vai achar que é com ele toda vez que alguém falar.', '<input class="campo" data-c="apelidos_otto" maxlength="120" placeholder="Ex.: Ottinho, Ottão" value="' + esc(c.apelidos_otto || '') + '">', 'asw-pilha')) +
        bloco('Regras fixas com clientes', 'Valem acima de tudo, em todos os grupos de cliente.',
          '<ul class="asw-regras">' + (S.regras.map((r, i) => '<li><span class="asw-rtipo t' + TIPOS_REGRA.findIndex(([k]) => k === r.tipo) + '">' + esc((TIPOS_REGRA.find(([k]) => k === r.tipo) || ['', 'Regra'])[1]) + '</span><span>' + esc(r.texto) + '</span><button class="asw-x" data-tira-regra="' + i + '" aria-label="Tirar regra">✕</button></li>').join('') || '<li class="asw-nada">Nenhuma regra ainda.</li>') + '</ul>' +
          '<div class="asw-nova-regra"><select class="campo" id="asw-rtipo">' + TIPOS_REGRA.map(([k, r]) => '<option value="' + esc(k) + '">' + r + '</option>').join('') + '</select>' +
          '<input class="campo" id="asw-rtexto" placeholder="Ex.: prometer data de postagem sem olhar a agenda"><button class="b" data-mais-regra>Adicionar</button></div>' +
          linha('Horário de atendimento', 'Fora dele, avisa que o time responde depois e leva a dúvida à equipe.', chave('horario.ativo', !!h.ativo)) +
          '<div class="asw-horario' + (h.ativo ? '' : ' off') + '"><div class="asw-chips">' + DIAS.map(([d, r]) => '<button class="asw-chip' + ((h.dias || []).map(String).includes(d) ? ' on' : '') + '" data-dia="' + d + '">' + r + '</button>').join('') + '</div>' +
          '<div class="asw-par">Das <input class="campo asw-hora" type="time" data-c="horario.ini" value="' + esc(h.ini || '08:00') + '"> às <input class="campo asw-hora" type="time" data-c="horario.fim" value="' + esc(h.fim || '18:00') + '"></div>' +
          '<textarea class="campo" rows="2" data-c="horario.mensagem" placeholder="Mensagem fora do horário">' + esc(h.mensagem || '') + '</textarea></div>') + '</div>';
    }
    if (S.aba === 'equipe') {
      const ge = c.grupo_equipe || '';
      return bloco('Grupo da equipe', 'Onde ele conversa com vocês, manda as pendências e avisa quem precisa responder. Lá, chame pelo nome: “' + nome + ', o que tem da Arena Deck?”.',
          linha('Grupo', '', '<select class="campo" data-c="grupo_equipe"><option value="">Escolha o grupo interno</option>' + S.todosGrupos.map(g => '<option value="' + esc(g.jid) + '"' + (g.jid === ge ? ' selected' : '') + '>' + esc(g.nome || g.jid) + '</option>').join('') + '</select>') +
          linha('Mandar as pendências', 'Quem está esperando resposta, no horário de atendimento.', '<select class="campo" data-c="resumo_horas" data-num>' + [[1, 'A cada 1 hora'], [2, 'A cada 2 horas'], [3, 'A cada 3 horas'], [4, 'A cada 4 horas'], [6, 'A cada 6 horas'], [12, '2 vezes por dia'], [24, '1 vez por dia'], [168, '1 vez por semana'], [720, '1 vez por mês']].map(([v, r]) => '<option value="' + v + '"' + (Number(c.resumo_horas || 3) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>') +
          linha('Conta como pendente depois de', '', '<select class="campo" data-c="resumo_espera_min" data-num>' + [[15, '15 min sem resposta'], [30, '30 min sem resposta'], [60, '1 hora sem resposta'], [120, '2 horas sem resposta']].map(([v, r]) => '<option value="' + v + '"' + (Number(c.resumo_espera_min || 30) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>') +
          linha('Bom dia da equipe', 'Em dia útil, a partir de <input class="campo asw-hora" type="time" data-c="bom_dia_hora" value="' + esc(c.bom_dia_hora || '08:00') + '">: um áudio dele dando bom dia e, logo depois, a mensagem com as gravações de hoje, o que vence hoje, atrasados e quem espera resposta — marcando quem tem tarefa.', chave('bom_dia_ligado', c.bom_dia_ligado !== false)) +
          '<div class="asw-acao"><button class="b pri" data-pendencias' + (ge ? '' : ' disabled') + '>Mandar pendências agora</button></div>') +
        bloco('Com a equipe', 'Valem no grupo interno e no privado de quem está na lista abaixo. Com cliente, valem as regras da Personalidade.',
          linha('Modo restrito', 'Ligado: nada de palavrão, nem de brincadeira. Desligado: zoação liberada com a equipe — nunca com cliente nem sobre cliente.', chave('modo_restrito', !!c.modo_restrito)) +
          '<div class="asw-row asw-vigia' + (c.modo_restrito ? ' off' : '') + '"><div class="asw-row-t"><b>Até onde a zoação pode ir</b><small>Ele mede pelo tom de quem pediu e não passa deste limite.</small></div><div class="asw-row-c">' + seg('zoacao_nivel', c.zoacao_nivel || 'medio', [['leve', 'Leve'], ['medio', 'Média'], ['pesado', 'Pesada']]) + '</div></div>' +
          '<div class="asw-row asw-vigia' + (c.modo_restrito ? ' off' : '') + '"><div class="asw-row-t"><b>Zoação espontânea</b><small>Solta uma zoeira sem ninguém chamar, no grupo da equipe. No máximo 1 a cada 2 horas, nunca em assunto sério (cliente, problema, cobrança), e só se tiver graça; senão, fica quieto.</small></div><div class="asw-row-c">' + seg('zoacao_espontanea', String(Number(c.zoacao_espontanea) || 0), [['0', 'Nunca'], ['10', 'Às vezes'], ['25', 'Bastante']]) + '</div></div>' +
          '<label class="asw-lb">Regras fixas da equipe</label><textarea class="campo" data-c="regras_equipe" rows="3" maxlength="2000" placeholder="Uma por linha. Ex.: não zoar a Talita; sempre chamar o Yury de chefe.">' + esc(c.regras_equipe || '') + '</textarea>', 'asw-regeq') +
        bloco('Pessoas', 'Quem é da equipe para o ' + nome + ' (pelo número). Elas podem dar ordens, recebem as dúvidas e são marcadas quando o assunto é delas.',
          '<div class="asw-equipe">' + (c.equipe || []).map((p, i) =>
            '<div class="asw-pes" data-i="' + i + '"><div class="asw-pes-top"><span class="asw-av p">' + esc(ini(p.nome)) + '</span>' +
              '<input class="campo asw-pes-nome" data-p="nome" placeholder="Nome" aria-label="Nome" value="' + esc(p.nome || '') + '">' +
              '<button class="asw-x" data-tira-pes="' + i + '" aria-label="Tirar ' + esc(p.nome || 'pessoa') + '">✕</button></div>' +
              '<div class="asw-pes-c">' +
              '<label><span>WhatsApp</span><input class="campo" data-p="numero" inputmode="tel" placeholder="55 77 9…" value="' + esc(p.numero || '') + '"></label>' +
              '<label><span>Apelidos</span><input class="campo" data-p="apelidos" maxlength="120" placeholder="Pedrão, PP" value="' + esc(p.apelidos || '') + '"></label>' +
              '<label class="larga"><span>Cuida de</span><input class="campo" data-p="assuntos" placeholder="Artes, gravações…" value="' + esc(p.assuntos || '') + '"></label>' +
              '<label class="larga"><span>Usuário no B7</span><select class="campo" data-p="perfil_id" title="Em nome de quem ele mexe nas demandas quando esta pessoa pede"><option value="">Pelo nome</option>' +
                (S.perfis || []).map(u => '<option value="' + esc(u.id) + '"' + (u.id === p.perfil_id ? ' selected' : '') + '>' + esc(u.nome) + '</option>').join('') + '</select></label></div>' +
              '<label class="asw-sw p"><input type="checkbox" data-p="duvidas"' + (p.duvidas !== false ? ' checked' : '') + '><span></span>Recebe as dúvidas dos clientes</label></div>').join('') +
          '<button class="asw-pes asw-pes-nova" data-mais-pes><span>＋</span>Adicionar pessoa</button></div>') +
        '<div class="asw-2">' +
        bloco('Quem é quem', 'Como ele apresenta cada pessoa. Em branco, usa a função no B7.',
          (S.perfis || []).map(u => '<label class="asw-qq-l"><b>' + esc(u.nome) + '</b><input class="campo" data-qq="' + esc(u.id) + '" maxlength="200" placeholder="pela função no sistema" value="' + esc(((c.quem_e_quem || {})[u.id]) || '') + '"></label>').join('')) +
        bloco('Celular do B7', 'Quando quem fala é o próprio número do B7, ele cria e mexe em demandas em nome de:',
          '<select class="campo" data-c="dono_perfil_id"><option value="">O administrador principal</option>' + (S.perfis || []).map(u => '<option value="' + esc(u.id) + '"' + (u.id === c.dono_perfil_id ? ' selected' : '') + '>' + esc(u.nome) + '</option>').join('') + '</select>') + '</div>';
    }
    if (S.aba === 'clientes') {
      const q = S.busca.toLowerCase(), gs = S.grupos.filter(g => !q || String(g.nome).toLowerCase().includes(q));
      const mc = (c.modo_clientes || 'vigia') === 'atende' ? 'atende' : 'vigia';
      return bloco('Nos grupos de cliente', 'O que ele faz quando um cliente escreve.',
          linha('Modo', mc === 'vigia' ? 'Só vigiar: não responde o cliente. Se ninguém da equipe responder, manda o print no grupo da equipe marcando quem precisa.' : 'Atender: responde o cliente quando chamado.', seg('modo_clientes', mc, [['vigia', 'Só vigiar'], ['atende', 'Atender']])) +
          linha('Avisar a equipe depois de', 'Sem resposta da equipe, no horário de atendimento.', '<select class="campo" data-c="vigia_min" data-num>' + [10, 15, 20, 30, 45, 60, 90, 120].map(v => '<option value="' + v + '"' + (Number(c.vigia_min || 20) === v ? ' selected' : '') + '>' + v + ' min</option>').join('') + '</select>') +
          linha('Avisos no grupo da equipe', 'Demanda atrasada ou que vence amanhã sem começar, cliente esperando há mais de 2 h, cliente que aprovou algo. No máximo a cada 30 min.', chave('alertas_ligados', c.alertas_ligados !== false)) +
          linha('Resumo do dia', 'Entregas, o que vence amanhã, atrasos e quem espera resposta, 1 vez por dia útil a partir de <input class="campo asw-hora" type="time" data-c="resumo_dia_hora" value="' + esc(c.resumo_dia_hora || '18:00') + '">.', chave('resumo_dia_ligado', c.resumo_dia_ligado !== false))) +
        /* 4.69.0: aviso no celular */
        bloco('Aviso no celular', 'Notificação do B7 no celular e no computador quando um cliente fica sem resposta. Um aviso por espera, só no horário de atendimento.',
          linha('Avisar depois de', 'Tempo sem resposta da equipe.', '<select class="campo" data-c="push_espera_min" data-num>' + [[0, 'Desligado'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hora']].map(([v, r]) => '<option value="' + v + '"' + (Number(c.push_espera_min ?? 15) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>') +
          '<div class="asw-row asw-push' + (Number(c.push_espera_min ?? 15) ? '' : ' off') + '"><div class="asw-row-t"><b>Quem recebe</b><small>Nenhum marcado: todos que veem o WhatsApp do B7.</small></div><div class="asw-row-c"><div class="asw-chips">' +
            (S.perfis || []).map(u => '<button class="asw-chip' + ((c.push_para || []).includes(u.id) ? ' on' : '') + '" data-push="' + esc(u.id) + '" aria-pressed="' + ((c.push_para || []).includes(u.id) ? 'true' : 'false') + '">' + esc(u.nome.split(' ')[0]) + '</button>').join('') + '</div></div></div>') +
        bloco('Grupos', 'Só grupos ligados a um cliente do B7. Desligado, ele não manda nada ali — nem a pedido.',
          '<div class="asw-gtopo"><input class="campo" id="asw-busca" placeholder="Buscar grupo…" value="' + esc(S.busca) + '"><button class="b fina contorno" data-todos="1">Ligar todos</button><button class="b fina contorno" data-todos="0">Desligar todos</button></div>' +
          (gs.length ? gs.map(g => { const gc = (c.grupos || {})[g.jid] || {};
            return '<div class="asw-g' + (gc.desligado ? ' off' : '') + '"><label class="asw-tg"><input type="checkbox" data-g="' + esc(g.jid) + '"' + (gc.desligado ? '' : ' checked') + ' aria-label="' + esc(g.nome || '') + '"><span></span></label>' +
              '<span class="asw-av g">' + (g.foto_url ? '<img src="' + esc(g.foto_url) + '" alt="" onerror="this.remove()">' : '') + esc(ini(g.nome)) + '</span>' +
              '<b>' + esc(g.nome || '') + '</b><input class="campo" data-gr="' + esc(g.jid) + '" placeholder="Regras só deste grupo (opcional)" value="' + esc(gc.regras || '') + '"></div>'; }).join('')
            : '<div class="asw-nada">Nenhum grupo encontrado.<small>Ligue os grupos aos clientes na Central (⋮ da conversa → Ligar a um cliente).</small></div>'));
    }
    if (S.aba === 'saber') {
      return '<div class="asw-2">' +
        bloco('Memória', 'Combinados e preferências que ele sempre segue. Presa a um cliente, só vale quando o assunto é aquele cliente. Ele guarda sozinho quando pedem (“' + nome + ', lembra que…”) e quando alguém corrige ele (✍️).',
          '<div class="asw-ensina asw-ensina3"><input class="campo" id="asw-mem-t" maxlength="500" placeholder="Ex.: a Luana do Mercato prefere áudio"><select class="campo" id="asw-mem-c"><option value="">Vale para tudo</option>' + (S.clientes || []).map(k => '<option value="' + esc(k.id) + '">' + esc(k.nome) + '</option>').join('') + '</select><button class="b pri" data-mem-add>Guardar</button></div>' +
          ((S.mem || []).some(m => m.cliente_id) ? '<select class="campo asw-mem-f" id="asw-mem-f"><option value="">Todas as lembranças</option><option value="geral"' + (S.memFiltro === 'geral' ? ' selected' : '') + '>Só as gerais</option>' + [...new Set((S.mem || []).map(m => m.cliente_id).filter(Boolean))].map(id => '<option value="' + esc(id) + '"' + (S.memFiltro === id ? ' selected' : '') + '>' + esc(nomeCliente(id)) + '</option>').join('') + '</select>' : '') +
          '<div class="asw-mem">' + ((S.mem || []).filter(m => !S.memFiltro || (S.memFiltro === 'geral' ? !m.cliente_id : m.cliente_id === S.memFiltro)).map(m => '<div class="asw-ap" data-mem="' + esc(m.id) + '"><p>' + (m.cliente_id ? '<span class="asw-mem-cli">' + esc(nomeCliente(m.cliente_id)) + '</span>' : '') + esc(m.texto) + '</p><small>' + (m.origem === 'correcao' ? '✍️ corrigido por ' : '') + esc([m.criado_por, quando(m.criada_em)].filter(Boolean).join(' · ')) + '</small><div class="asw-ap-ac"><button class="asw-x" data-mem-tira aria-label="Esquecer">✕</button></div></div>').join('') || '<div class="asw-nada">Nada guardado ainda.</div>') + '</div>') +
        bloco('Respostas ensinadas', 'Ele usa como verdade com os clientes. Também aprende quando a equipe responde uma dúvida.',
          '<div class="asw-ensina"><input class="campo" id="asw-ap-p" placeholder="Assunto (ex.: prazo padrão de arte)"><input class="campo" id="asw-ap-r" placeholder="Resposta (ex.: 2 dias úteis depois do briefing)"><button class="b pri" data-ensinar>Ensinar</button></div>' +
          '<div class="asw-saber">' + (S.ap.map(a => '<div class="asw-ap' + (a.ativo === false ? ' off' : '') + '" data-ap="' + esc(a.id) + '"><b>' + esc(a.pergunta) + '</b><p>' + esc(a.resposta) + '</p>' +
            '<small>' + esc([a.respondido_por, a.grupo, quando(a.criado_em)].filter(Boolean).join(' · ')) + '</small>' +
            '<div class="asw-ap-ac"><label class="asw-sw p"><input type="checkbox" data-ap-ativo' + (a.ativo !== false ? ' checked' : '') + '><span></span>Usar</label><button class="asw-x" data-esquece aria-label="Esquecer">✕</button></div></div>').join('')
            || '<div class="asw-nada">Ainda não aprendeu nada.</div>') + '</div>') + '</div>';
    }
    if (S.aba === 'controle') {
      const off = c.ferramentas_off || [], oq = c.ordens_quem || [], eq = (c.equipe || []).filter(p => p.nome && p.numero);
      const fim8 = n => String(n || '').replace(/\D/g, '').slice(-8);
      return '<div class="asw-2">' +
        bloco('O que ele pode fazer', 'Desligado, ele nem oferece: se alguém pedir, responde que a função está desligada aqui.',
          FERRS.map(([k, t, d]) => linha(t, d, '<label class="asw-tg"><input type="checkbox" data-ferr="' + k + '"' + (off.includes(k) ? '' : ' checked') + ' aria-label="' + esc(t) + '"><span></span></label>')).join('')) +
        '<div>' +
        bloco('Quem pode dar ordens', 'Quem pode pedir para ele MEXER no sistema: criar, editar, mudar status ou excluir demandas, apagar e editar mensagem, guardar na memória. Consultar, todo mundo da equipe pode. Nenhum marcado: todos. O celular do B7 sempre pode.',
          eq.length ? '<div class="asw-chips">' + eq.map(p => { const on = oq.some(n => fim8(n) === fim8(p.numero)); return '<button class="asw-chip' + (on ? ' on' : '') + '" data-ordem="' + esc(p.numero) + '" aria-pressed="' + on + '">' + esc(String(p.nome).split(' ')[0]) + '</button>'; }).join('') + '</div>'
            : '<div class="asw-nada">Cadastre as pessoas na aba Equipe primeiro.</div>') +
        bloco('Segurança', '',
          linha('Confirmar antes de agir', 'Em ação grande ele pergunta “confirma?” e só faz depois do “sim” (vale por 10 min): excluir demanda, mexer em várias demandas de uma vez, mandar algo em grupo de cliente, apagar mensagem.', chave('confirmar_acoes', !!c.confirmar_acoes)) +
          linha('Fim de semana em silêncio', 'Sábado e domingo ele não manda nada por conta própria: sem bom dia, resumo, pendências, avisos, aviso no celular, reação ou zoeira. Se chamarem, responde normal.', chave('fds_silencio', !!c.fds_silencio))) +
        '</div></div>';
    }
    if (S.aba === 'testar') {
      return bloco('Testar sem mandar nada', 'Escreva como se fosse o cliente no grupo escolhido. Ele usa a conversa real e o que está em produção, mas não envia nada no WhatsApp.',
        '<div class="asw-teste"><div class="asw-teste-top"><select class="campo" id="asw-tjid">' + S.grupos.map(g => '<option value="' + esc(g.jid) + '"' + (g.jid === S.testeJid ? ' selected' : '') + '>' + esc(g.nome) + '</option>').join('') + '</select>' +
        '<label class="asw-sw p"><input type="checkbox" id="asw-teq"' + (S.testeEquipe ? ' checked' : '') + '><span></span>Falar como equipe</label></div>' +
        '<div class="asw-chat" id="asw-chat">' + (S.teste.length ? S.teste.map(m => m.de === 'eu' ? '<div class="asw-bl2 eu">' + esc(m.t) + '</div>'
          : m.de === 'pensa' ? '<div class="asw-bl2 ele pensa"><i></i><i></i><i></i></div>'
          : '<div class="asw-bl2 ele"><b>' + esc(S.cfg.nome) + '</b>' + esc(m.t) + (m.pq ? '<span class="asw-pq">Perguntaria à equipe: ' + esc(m.pq) + '</span>' : '') + (m.meta ? '<small>' + esc(m.meta) + '</small>' : '') + '</div>').join('')
          : '<div class="asw-nada">Ex.: “Oi! Como está a arte da Black Friday?”</div>') + '</div>' +
        '<div class="asw-teste-in"><input class="campo" id="asw-tin" placeholder="Mensagem do cliente"><button class="b pri" data-testar>Enviar</button></div></div>');
    }
    return '';
  }
  const sw = (k, on, t, d) => linha(t, d, chave(k, on));
  const nomeCliente = id => ((S.clientes || []).find(k => k.id === id) || {}).nome || 'Cliente';

  function definir(k, v) { const p = k.split('.'); let o = S.cfg; while (p.length > 1) { const x = p.shift(); o[x] = o[x] || {}; o = o[x]; } o[p[0]] = v; }

  function digitou(e) {
    const t = e.target;
    if (t.dataset.ferr && e.type === 'change') { const k = t.dataset.ferr, l = (S.cfg.ferramentas_off || []).filter(x => x !== k); if (!t.checked) l.push(k); S.cfg.ferramentas_off = l; marcarSujo(); return; }
    if (t.dataset.c) {
      const v = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.hasAttribute('data-num')) ? Number(t.value) || 0 : t.value;
      if (t.dataset.c === 'grupo_equipe') { const bt = raiz.querySelector('[data-pendencias]'); if (bt) bt.disabled = !t.value; }
      definir(t.dataset.c, v);
      if (t.dataset.c === 'ativo') { desenhar(); return salvar(true); }
      if (t.type === 'radio') { t.closest('.asw-seg').querySelectorAll('label').forEach(l => l.classList.toggle('on', l.contains(t))); }
      if (t.dataset.c === 'velocidade') { const h = raiz.querySelector('.asw-humano'); if (h) h.classList.toggle('fora', t.value !== 'humano'); }
      if (['velocidade', 'espera_min_s', 'espera_max_s'].includes(t.dataset.c)) { const tl = raiz.querySelector('#asw-tl2'); if (tl) { tl.outerHTML = linhaDoTempo(); const n = raiz.querySelector('#asw-tl2'); n.classList.add('anima'); } }
      if (t.dataset.c === 'push_espera_min') { const r = raiz.querySelector('.asw-push'); if (r) r.classList.toggle('off', !Number(t.value)); }
      if (t.dataset.c === 'audio_max_s') { const o = raiz.querySelector('#asw-maxs'); if (o) o.textContent = t.value + ' s'; }
      if (t.dataset.c === 'voz_provedor') { const e = raiz.querySelector('.asw-eleven'); if (e) e.classList.toggle('fora', t.value !== 'elevenlabs'); }
      if (t.dataset.c === 'modo_clientes') { const d = t.closest('.asw-row').querySelector('.asw-row-t small'); if (d) d.textContent = t.value === 'vigia' ? 'Só vigiar: não responde o cliente. Se ninguém da equipe responder, manda o print no grupo da equipe marcando quem precisa.' : 'Atender: responde o cliente quando chamado.'; }
      if (t.dataset.c === 'modo_restrito') raiz.querySelectorAll('.asw-regeq .asw-vigia').forEach(z => z.classList.toggle('off', t.checked));
      if (t.dataset.c === 'horario.ativo') { const h = raiz.querySelector('.asw-horario'); if (h) h.classList.toggle('off', !t.checked); }
      if (t.dataset.c === 'nome') { const h = raiz.querySelector('.asw-hero h1'); if (h) h.textContent = t.value || 'Assistente'; }
    } else if (t.dataset.qq) {
      S.cfg.quem_e_quem = Object.assign({}, S.cfg.quem_e_quem || {});
      if (t.value.trim()) S.cfg.quem_e_quem[t.dataset.qq] = t.value; else delete S.cfg.quem_e_quem[t.dataset.qq];
    } else if (t.dataset.p) {
      const i = Number(t.closest('[data-i]').dataset.i), p = S.cfg.equipe[i];
      p[t.dataset.p] = t.type === 'checkbox' ? t.checked : t.dataset.p === 'numero' ? t.value.replace(/\D/g, '') : t.value;
      if (t.dataset.p === 'nome') { const a = t.closest('.asw-pes').querySelector('.asw-av'); if (a) a.textContent = ini(t.value); }
    } else if (t.dataset.g) {
      S.cfg.grupos = S.cfg.grupos || {}; S.cfg.grupos[t.dataset.g] = Object.assign({}, S.cfg.grupos[t.dataset.g], { desligado: !t.checked });
      t.closest('.asw-g').classList.toggle('off', !t.checked);
    } else if (t.dataset.gr) {
      S.cfg.grupos = S.cfg.grupos || {}; S.cfg.grupos[t.dataset.gr] = Object.assign({}, S.cfg.grupos[t.dataset.gr], { regras: t.value });
    } else if (t.id === 'asw-busca' && e.type === 'input') {
      S.busca = t.value; const pos = t.selectionStart; desenhar(); const b = raiz.querySelector('#asw-busca'); if (b) { b.focus(); b.setSelectionRange(pos, pos); } return;
    } else if (t.id === 'asw-tjid') { S.testeJid = t.value; S.teste = []; desenhar(); return; }
    else if (t.id === 'asw-teq') { S.testeEquipe = t.checked; return; }
    else if (t.id === 'asw-mem-f') { S.memFiltro = t.value; desenhar(); return; }
    else if (t.hasAttribute('data-ap-ativo')) {
      const id = t.closest('[data-ap]').dataset.ap; const a = S.ap.find(x => x.id === id); if (a) a.ativo = t.checked;
      t.closest('.asw-ap').classList.toggle('off', !t.checked);
      sb().from('wa_assistente_aprendizados').update({ ativo: t.checked }).eq('id', id).then(() => {});
      return;
    } else return;
    marcarSujo();
  }

  async function clique(e) {
    const t = e.target;
    if (t.closest('[data-voz-ouvir]')) {
      const bt = t.closest('[data-voz-ouvir]'); if (bt.disabled) return;
      bt.disabled = true; bt.textContent = 'Gerando…';
      const c = S.cfg;
      chamar('voz_amostra', { voz: c.voz || 'Orus', estilo: c.voz_estilo || '', provedor: c.voz_provedor || 'gemini', eleven_id: c.voz_eleven_id || '' }).then(r => {
        if (r.erro) throw new Error(r.erro);
        const au = new Audio(r.audio); au.play().catch(() => {});
      }).catch(e => B7.UI.toast(e.message || 'Não deu para gerar a voz.')).finally(() => { bt.disabled = false; bt.textContent = '▶ Ouvir'; });
      return;
    }
    if (t.closest('[data-mem-add]')) {
      const tx = (raiz.querySelector('#asw-mem-t') || {}).value || '', cid = (raiz.querySelector('#asw-mem-c') || {}).value || '';
      if (tx.trim().length < 3) return B7.UI.toast('Escreva o que ele deve lembrar.');
      const eu = (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) || {};
      sb().from('wa_otto_memoria').insert({ texto: tx.trim(), sobre: cid ? nomeCliente(cid) : null, cliente_id: cid || null, origem: 'tela', criado_por: eu.nome || 'tela' }).select('id,texto,sobre,criado_por,criada_em,cliente_id,origem').single().then(r => {
        if (r.error) return B7.UI.toast('Não salvou: ' + r.error.message);
        S.mem = [r.data, ...(S.mem || [])]; desenhar(); B7.UI.toast('Guardado na memória.');
      });
      return;
    }
    const mt = t.closest('[data-mem-tira]');
    if (mt) {
      const id = mt.closest('[data-mem]').dataset.mem;
      sb().from('wa_otto_memoria').update({ ativo: false }).eq('id', id).then(r => { if (r.error) return B7.UI.toast(r.error.message); S.mem = (S.mem || []).filter(m => m.id !== id); desenhar(); });
      return;
    }
    const ab = t.closest('[data-aba]'); if (ab) { S.aba = ab.dataset.aba; desenhar(); if (S.aba === 'testar') { const i = raiz.querySelector('#asw-tin'); if (i) i.focus(); } return; }
    if (t.closest('[data-salvar]')) return salvar();
    if (t.closest('[data-desfazer]')) { S.cfg = JSON.parse(S.orig); S.regras = regrasDe(S.cfg.regras); desenhar(); return; }
    const tom = t.closest('[data-tom]');
    if (tom) { const x = TONS[Number(tom.dataset.tom)][1]; const j = String(S.cfg.jeito || ''); if (!j.includes(x)) S.cfg.jeito = (j.trim() ? j.trim() + '\n' : '') + x; desenhar(); return; }
    const od = t.closest('[data-ordem]');
    if (od) { const n = od.dataset.ordem, f8 = x => String(x || '').replace(/\D/g, '').slice(-8), l = (S.cfg.ordens_quem || []).filter(x => f8(x) !== f8(n)); const liga = l.length === (S.cfg.ordens_quem || []).length; if (liga) l.push(n); S.cfg.ordens_quem = l; od.classList.toggle('on', liga); od.setAttribute('aria-pressed', liga ? 'true' : 'false'); marcarSujo(); return; }
    const pu = t.closest('[data-push]');
    if (pu) { const id = pu.dataset.push, l = Array.isArray(S.cfg.push_para) ? S.cfg.push_para.slice() : []; const i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); S.cfg.push_para = l; pu.classList.toggle('on', i < 0); pu.setAttribute('aria-pressed', i < 0 ? 'true' : 'false'); marcarSujo(); return; }
    const dia = t.closest('[data-dia]');
    if (dia) { const h = S.cfg.horario; const d = Number(dia.dataset.dia); h.dias = (h.dias || []).includes(d) ? h.dias.filter(x => x !== d) : [...(h.dias || []), d]; dia.classList.toggle('on'); marcarSujo(); return; }
    if (t.closest('[data-mais-regra]')) {
      const tx = raiz.querySelector('#asw-rtexto'); if (!tx.value.trim()) return tx.focus();
      S.regras.push({ tipo: raiz.querySelector('#asw-rtipo').value, texto: tx.value.trim() }); desenhar(); return;
    }
    const tr = t.closest('[data-tira-regra]'); if (tr) { S.regras.splice(Number(tr.dataset.tiraRegra), 1); desenhar(); return; }
    if (t.closest('[data-mais-pes]')) { S.cfg.equipe = [...(S.cfg.equipe || []), { nome: '', numero: '', assuntos: '', duvidas: true }]; desenhar(); const l = raiz.querySelectorAll('.asw-pes [data-p="nome"]'); if (l.length) l[l.length - 1].focus(); return; }
    const tp = t.closest('[data-tira-pes]'); if (tp) { S.cfg.equipe.splice(Number(tp.dataset.tiraPes), 1); desenhar(); return; }
    const td = t.closest('[data-todos]');
    if (td) { const on = td.dataset.todos === '1'; S.cfg.grupos = S.cfg.grupos || {}; S.grupos.forEach(g => { S.cfg.grupos[g.jid] = Object.assign({}, S.cfg.grupos[g.jid], { desligado: !on }); }); desenhar(); return; }
    const rp = t.closest('[data-resp]');
    if (rp) {
      const l = rp.closest('[data-dv]'), i = l.querySelector('input'); if (!i.value.trim()) return i.focus();
      rp.disabled = true; rp.textContent = 'Enviando…';
      try { const r = await chamar('responder_duvida', { id: l.dataset.dv, resposta: i.value.trim() });
        if (r.ok) { S.dv = S.dv.filter(x => x.id !== l.dataset.dv); B7.UI.toast('Respondido — ele mandou no grupo e aprendeu.'); await recarregarListas(); desenhar(); return; }
        B7.UI.toast(r.erro || 'Não deu para enviar.'); } catch (x) { B7.UI.toast(x.message); }
      rp.disabled = false; rp.textContent = 'Responder'; return;
    }
    if (t.closest('[data-ensinar]')) {
      const p = raiz.querySelector('#asw-ap-p'), r = raiz.querySelector('#asw-ap-r');
      if (!p.value.trim() || !r.value.trim()) return (p.value.trim() ? r : p).focus();
      const eu = B7.Auth.usuario() || {};
      const { data, error } = await sb().from('wa_assistente_aprendizados').insert({ pergunta: p.value.trim(), resposta: r.value.trim(), respondido_por: eu.nome || 'admin' }).select('*').single();
      if (error) return B7.UI.toast('Não salvou: ' + error.message);
      S.ap.unshift(data); desenhar(); B7.UI.toast('Aprendido.'); return;
    }
    const esq = t.closest('[data-esquece]');
    if (esq) { const id = esq.closest('[data-ap]').dataset.ap; const r = await sb().from('wa_assistente_aprendizados').delete().eq('id', id); if (!r.error) { S.ap = S.ap.filter(x => x.id !== id); desenhar(); } return; }
    if (t.closest('[data-testar]')) return testar();
    const pd = t.closest('[data-pendencias]');
    if (pd) {
      if (mudou()) await salvar(true);
      pd.disabled = true; pd.textContent = 'Lendo os grupos…';
      try { const r = await chamar('assistente_pendencias'); B7.UI.toast(r.erro ? r.erro : r.vazio ? 'Nenhum cliente esperando — avisei no grupo.' : 'Pendências enviadas no grupo da equipe.'); } catch (x) { B7.UI.toast(x.message); }
      pd.disabled = false; pd.textContent = 'Mandar pendências agora'; return;
    }
  }
  raizTecla();
  function raizTecla() {
    document.addEventListener('keydown', e => {
      if (!raiz || !raiz.isConnected) return;
      if (e.key === 'Enter' && e.target.id === 'asw-tin') { e.preventDefault(); testar(); }
      if (e.key === 'Enter' && e.target.id === 'asw-rtexto') { e.preventDefault(); raiz.querySelector('[data-mais-regra]').click(); }
    });
  }

  async function testar() {
    const i = raiz.querySelector('#asw-tin'); const tx = (i && i.value || '').trim(); if (!tx) return i && i.focus();
    if (!S.testeJid) return B7.UI.toast('Nenhum grupo ligado a cliente para testar.');
    if (mudou()) await salvar(true);
    S.teste.push({ de: 'eu', t: tx }, { de: 'pensa' }); desenhar();
    try {
      const r = await chamar('assistente_testar', { jid: S.testeJid, texto: tx, autor: 'Cliente (teste)', equipe: S.testeEquipe });
      S.teste.pop();
      if (r.erro) S.teste.push({ de: 'ele', t: '⚠️ ' + r.erro });
      else {
        /* 4.58.1: várias mensagens seguidas = vários balões */
        const partes = String(r.resposta || '').split(/\n?\s*\[\[\s*NOVA\s*\]\]\s*\n?/i).map(x => x.trim()).filter(Boolean);
        partes.slice(0, -1).forEach(t => S.teste.push({ de: 'ele', t }));
        S.teste.push({ de: 'ele', t: partes[partes.length - 1] || '(ficaria calado)', pq: r.perguntaEquipe, meta: [r.modo === 'fora_horario' ? 'fora do horário' : r.modo === 'ordem' ? 'ordem da equipe' : '', r.provedor, r.ms ? (r.ms / 1000).toFixed(1) + ' s' : ''].filter(Boolean).join(' · ') }); }
    } catch (x) { S.teste.pop(); S.teste.push({ de: 'ele', t: '⚠️ ' + x.message }); }
    desenhar();
    const ch = raiz.querySelector('#asw-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
    const n = raiz.querySelector('#asw-tin'); if (n) n.focus();
  }

  async function recarregarListas() {
    const [ap, rg] = await Promise.all([
      sb().from('wa_assistente_aprendizados').select('*').order('criado_em', { ascending: false }).limit(200),
      sb().from('wa_assistente_registro').select('*').gte('em', new Date(Date.now() - 7 * 864e5).toISOString()).order('em', { ascending: false }).limit(300)
    ]);
    S.ap = ap.data || S.ap; S.reg = rg.data || S.reg;
  }

  async function salvar(quieto) {
    S.cfg.regras = regrasTexto(S.regras);
    const c = S.cfg;
    const novo = { ativo: !!c.ativo, nome: String(c.nome || '').trim() || 'Otto', jeito: c.jeito || '', regras: c.regras || '',
      equipe: (c.equipe || []).filter(p => p.nome && p.numero).map(p => ({ nome: p.nome.trim(), numero: ((d) => d.length === 10 || d.length === 11 ? '55' + d : d)(String(p.numero).replace(/\D/g, '')), assuntos: (p.assuntos || '').trim(), ...((p.apelidos || '').trim() ? { apelidos: String(p.apelidos).split(',').map(x => x.trim()).filter(Boolean).slice(0, 6).join(', ') } : {}), duvidas: p.duvidas !== false, ...(p.perfil_id ? { perfil_id: p.perfil_id } : {}) })),
      dono_perfil_id: c.dono_perfil_id || null,
      bom_dia_ligado: c.bom_dia_ligado !== false, bom_dia_hora: /^\d{2}:\d{2}$/.test(c.bom_dia_hora || '') ? c.bom_dia_hora : '08:00',
      push_espera_min: Math.max(0, Math.min(240, Number(c.push_espera_min ?? 15) || 0)), push_para: (Array.isArray(c.push_para) ? c.push_para : []).filter(Boolean),
      velocidade: ['rapido', 'natural', 'humano'].includes(c.velocidade) ? c.velocidade : 'natural', audio_humano: !!c.audio_humano, audio_variar: [0, 15, 30].includes(Number(c.audio_variar)) ? Number(c.audio_variar) : 0,
      tamanho: ['auto', 'curta', 'media', 'detalhada'].includes(c.tamanho) ? c.tamanho : 'auto', emojis: ['nada', 'pouco', 'bastante'].includes(c.emojis) ? c.emojis : 'pouco',
      apelidos_otto: String(c.apelidos_otto || '').split(',').map(x => x.trim()).filter(x => x.length >= 3).slice(0, 6).join(', '), zoacao_espontanea: [0, 10, 25].includes(Number(c.zoacao_espontanea)) ? Number(c.zoacao_espontanea) : 0,
      ferramentas_off: (c.ferramentas_off || []).filter(k => FERRS.some(([f]) => f === k)), ordens_quem: (c.ordens_quem || []).map(n => String(n).replace(/\D/g, '')).filter(Boolean),
      confirmar_acoes: !!c.confirmar_acoes, fds_silencio: !!c.fds_silencio, se_apresenta_ia: !!c.se_apresenta_ia,
      audio_roteiro: ['auto', 'sempre', 'nunca'].includes(c.audio_roteiro) ? c.audio_roteiro : 'auto', audio_max_s: Math.max(15, Math.min(120, Number(c.audio_max_s) || 40)),
      regras_equipe: String(c.regras_equipe || '').slice(0, 2000), modo_restrito: !!c.modo_restrito, zoacao_nivel: ['leve', 'medio', 'pesado'].includes(c.zoacao_nivel) ? c.zoacao_nivel : 'medio',
      modo_clientes: c.modo_clientes === 'atende' ? 'atende' : 'vigia', vigia_min: Math.max(5, Number(c.vigia_min) || 20),
      alertas_ligados: c.alertas_ligados !== false, resumo_dia_ligado: c.resumo_dia_ligado !== false, resumo_dia_hora: /^\d{2}:\d{2}$/.test(c.resumo_dia_hora || '') ? c.resumo_dia_hora : '18:00',
      responder_audio: c.responder_audio !== false, voz: c.voz || 'Orus', voz_estilo: String(c.voz_estilo || '').slice(0, 200), voz_provedor: c.voz_provedor === 'elevenlabs' ? 'elevenlabs' : 'gemini', voz_eleven_id: String(c.voz_eleven_id || '').trim() || null,
      quem_e_quem: Object.fromEntries(Object.entries(c.quem_e_quem || {}).map(([k, v]) => [k, String(v || '').trim().slice(0, 200)]).filter(([, v]) => v)),
      sem_marcacao: !!c.sem_marcacao, pausa_min: Math.max(5, Number(c.pausa_min) || 30), ouvir_audio: c.ouvir_audio !== false,
      espera_min_s: Math.max(1, Number(c.espera_min_s) || 4), espera_max_s: Math.max(Number(c.espera_min_s) || 4, Number(c.espera_max_s) || 9),
      grupos: c.grupos || {}, horario: c.horario || {}, grupo_equipe: c.grupo_equipe || null,
      resumo_horas: Math.max(1, Number(c.resumo_horas) || 3), resumo_espera_min: Math.max(5, Number(c.resumo_espera_min) || 30), atualizado_em: new Date().toISOString() };
    const r = await sb().from('wa_assistente').update(novo).eq('id', 1);
    if (r.error) { B7.UI.toast('Não salvou: ' + r.error.message); return; }
    Object.assign(S.cfg, novo); S.orig = JSON.stringify(S.cfg);
    if (!quieto) B7.UI.toast('Salvo.');
    else if (novo.ativo !== JSON.parse(S.orig).ativo) {}
    if (quieto === true && raiz.querySelector('.asw-hero')) B7.UI.toast(novo.ativo ? 'Assistente ligado.' : 'Assistente desligado.');
    marcarSujo();
  }

  return { abrir };
})();
