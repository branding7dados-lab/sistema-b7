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
  const DIAS = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']];
  const TONS = [
    ['😊 Simpático', 'Seja simpático e acolhedor, trate a pessoa pelo primeiro nome e use no máximo um emoji.'],
    ['🎯 Direto', 'Vá direto ao ponto, frases curtas, sem rodeios.'],
    ['👔 Formal', 'Use um tom profissional e educado, sem gírias e sem emojis.'],
    ['😄 Descontraído', 'Pode ser leve e bem-humorado, como alguém da agência que conhece o cliente.']
  ];
  const TIPOS_REGRA = [['NUNCA', 'Nunca'], ['SEMPRE', 'Sempre'], ['NÃO RESPONDA quando o assunto for', 'Não responder sobre'], ['CHAME', 'Chamar alguém quando']];
  const ROT_TIPO = { resposta: ['Respondeu', 'ok'], duvida: ['Perguntou à equipe', 'dv'], repasse: ['Repassou resposta', 'rp'], instrucao: ['Cumpriu ordem', 'or'], fora_horario: ['Fora do horário', 'fh'], teste: ['Teste', 'ts'], erro: ['Falhou', 'er'], resumo: ['Pendências à equipe', 'rp'], consulta: ['Respondeu a equipe', 'or'], documento: ['Mandou PDF', 'ok'] };
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
    const [c, ap, dv, rg, gr, tg] = await Promise.all([
      sb().from('wa_assistente').select('*').eq('id', 1).maybeSingle(),
      sb().from('wa_assistente_aprendizados').select('*').order('criado_em', { ascending: false }).limit(200),
      sb().from('wa_assistente_duvidas').select('id,jid,grupo_nome,autor,pergunta,pergunta_equipe,criada_em').is('respondida_em', null).order('criada_em', { ascending: false }).limit(40),
      sb().from('wa_assistente_registro').select('*').gte('em', desde7).order('em', { ascending: false }).limit(300),
      sb().from('wa_conversas').select('jid,nome,cliente_id,foto_url').eq('tipo', 'grupo').not('cliente_id', 'is', null).order('nome'),
      sb().from('wa_conversas').select('jid,nome').eq('tipo', 'grupo').order('nome').limit(500)
    ]);
    if (!raiz.isConnected) return;
    if (c.error || !c.data) { raiz.innerHTML = '<div class="asw-vazio"><b>Não consegui abrir</b><p>' + esc((c.error && c.error.message) || 'Configuração não encontrada.') + '</p></div>'; return; }
    const cfg = c.data;
    S = { cfg: JSON.parse(JSON.stringify(cfg)), orig: JSON.stringify(cfg), aba: S && S.aba || 'geral', ap: ap.data || [], dv: dv.data || [], reg: rg.data || [], grupos: gr.data || [],
      regras: regrasDe(cfg.regras), busca: '', todosGrupos: tg.data || [], teste: [], testeJid: (gr.data || [])[0] ? gr.data[0].jid : '', testeEquipe: false };
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

  function desenhar() {
    const c = S.cfg, hoje = new Date().toDateString();
    const reais = S.reg.filter(r => r.tipo !== 'teste');
    const nHoje = reais.filter(r => new Date(r.em).toDateString() === hoje && r.tipo !== 'erro').length;
    const ativos = S.grupos.filter(g => !((c.grupos || {})[g.jid] || {}).desligado).length;
    const ABAS = [['geral', 'Visão geral', S.dv.length], ['jeito', 'Personalidade'], ['equipe', 'Equipe', (c.equipe || []).length], ['grupos', 'Grupos', ativos + '/' + S.grupos.length], ['saber', 'Conhecimento', S.ap.length], ['testar', '✨ Testar']];
    raiz.innerHTML =
      '<header class="asw-hero' + (c.ativo ? ' on' : '') + '">' +
        '<a class="asw-volta" href="#/whatsapp" aria-label="Voltar para as conversas">‹ Conversas</a>' +
        '<div class="asw-id"><span class="asw-av">' + esc(ini(c.nome)) + '<i></i></span><div><h1>' + esc(c.nome || 'Assistente') + '</h1>' +
          '<p>' + (c.ativo ? '<b class="asw-ponto"></b>Atendendo nos grupos dos clientes' : 'Desligado — ninguém é respondido por ele') + '</p></div>' +
          '<label class="asw-chave" title="Ligar / desligar"><input type="checkbox" data-c="ativo"' + (c.ativo ? ' checked' : '') + '><span></span></label></div>' +
        '<div class="asw-kpis">' +
          kpi(nHoje, 'respostas hoje') + kpi(reais.filter(r => r.tipo !== 'erro').length, 'nos últimos 7 dias') + kpi(S.dv.length, 'dúvidas esperando', S.dv.length ? 'alerta' : '') + kpi(S.ap.length, 'coisas aprendidas') +
        '</div></header>' +
      '<nav class="asw-abas">' + ABAS.map(([k, r, n]) => '<button class="' + (S.aba === k ? 'on' : '') + '" data-aba="' + k + '">' + r + (n != null && n !== 0 ? ' <b>' + n + '</b>' : '') + '</button>').join('') +
        '<button class="asw-salvar2" id="asw-salvar2" data-salvar hidden>✓ Salvar</button></nav>' +
      '<section class="asw-corpo">' + corpo() + '</section>' +
      '<div class="asw-barra"><span>Alterações ainda não salvas</span><button class="b" data-desfazer>Desfazer</button><button class="b pri" id="asw-salvar" data-salvar>Salvar</button></div>';
    marcarSujo();
  }
  const kpi = (n, r, cls) => '<div class="asw-kpi ' + (cls || '') + '"><b>' + n + '</b><span>' + r + '</span></div>';

  function corpo() {
    const c = S.cfg;
    if (S.aba === 'geral') {
      const reg = S.reg.slice(0, 40);
      return '<div class="asw-2">' +
        '<div class="asw-card"><h3>Dúvidas esperando a equipe</h3>' + (S.dv.length ? S.dv.map(d =>
          '<div class="asw-dv" data-dv="' + esc(d.id) + '"><div class="asw-dv-top"><b>' + esc(d.grupo_nome || '') + '</b><time>' + quando(d.criada_em) + '</time></div>' +
          '<p class="asw-dv-q"><span>' + esc(d.autor || 'Cliente') + '</span>“' + esc(d.pergunta) + '”</p>' +
          (d.pergunta_equipe ? '<p class="asw-dv-p">🤔 ' + esc(d.pergunta_equipe) + '</p>' : '') +
          '<div class="asw-dv-r"><input class="campo" placeholder="Sua resposta — ele reescreve e manda no grupo"><button class="b pri" data-resp>Responder</button></div></div>').join('')
          : '<div class="asw-nada">🎉 Nenhuma dúvida esperando.<small>Quando ele não souber algo, a pergunta aparece aqui e no WhatsApp de quem recebe dúvidas.</small></div>') + '</div>' +
        '<div class="asw-card"><h3>Atividade recente</h3>' + (reg.length ? '<ol class="asw-tl">' + reg.map(r => {
          const t = ROT_TIPO[r.tipo] || [r.tipo, ''];
          return '<li><span class="asw-tag ' + t[1] + '">' + t[0] + '</span><time>' + quando(r.em) + '</time><b>' + esc(r.grupo || '') + '</b>' +
            (r.pergunta ? '<p class="q">' + esc(r.autor ? r.autor + ': ' : '') + esc(r.pergunta) + '</p>' : '') + (r.resposta ? '<p class="r">' + esc(r.resposta) + '</p>' : '') + '</li>';
        }).join('') + '</ol>' : '<div class="asw-nada">Nada por aqui ainda.<small>' + (c.ativo ? 'Peça para alguém marcar o número num grupo de cliente.' : 'Ligue o assistente e marque o número num grupo de cliente.') + '</small></div>') + '</div></div>';
    }
    if (S.aba === 'jeito') {
      const h = c.horario || {};
      return '<div class="asw-2">' +
        '<div class="asw-card"><h3>Identidade</h3>' +
          '<label class="rot">Nome no grupo</label><input class="campo" data-c="nome" maxlength="40" value="' + esc(c.nome || '') + '" placeholder="Ex.: Gabi, Assistente B7">' +
          '<label class="rot">Jeito de falar</label><div class="asw-chips">' + TONS.map(([r], i) => '<button class="asw-chip" data-tom="' + i + '">' + r + '</button>').join('') + '</div>' +
          '<textarea class="campo" data-c="jeito" rows="5" placeholder="Como ele deve se comportar. Ex.: trate pelo primeiro nome; prazo padrão de arte é 2 dias úteis; vídeos saem em até 5 dias depois da gravação.">' + esc(c.jeito || '') + '</textarea>' +
          '<h3 class="asw-h3b">Quando ele fala</h3>' +
          sw('sem_marcacao', c.sem_marcacao, 'Responder pedidos de ajuda sem ser marcado', 'Fica calado se a equipe falou no grupo nos últimos <input class="campo asw-mini" type="number" min="5" max="600" data-c="pausa_min" value="' + (c.pausa_min || 30) + '"> min') +
          sw('ouvir_audio', c.ouvir_audio !== false, 'Ouvir áudios', 'Quando respondem a ele com um áudio, ele transcreve e responde') +
          '<div class="asw-linha"><span>Espera antes de responder (digitando…)</span><span><input class="campo asw-mini" type="number" min="1" max="30" data-c="espera_min_s" value="' + (c.espera_min_s || 4) + '"> a <input class="campo asw-mini" type="number" min="1" max="40" data-c="espera_max_s" value="' + (c.espera_max_s || 9) + '"> s</span></div>' +
        '</div>' +
        '<div class="asw-card"><h3>Regras fixas</h3><p class="asw-sub">Valem acima de tudo, em todos os grupos.</p>' +
          '<ul class="asw-regras">' + (S.regras.map((r, i) => '<li><span class="asw-rtipo t' + TIPOS_REGRA.findIndex(([k]) => k === r.tipo) + '">' + esc((TIPOS_REGRA.find(([k]) => k === r.tipo) || ['', 'Regra'])[1]) + '</span><span>' + esc(r.texto) + '</span><button class="asw-x" data-tira-regra="' + i + '" aria-label="Tirar">✕</button></li>').join('') || '<li class="asw-nada">Nenhuma regra ainda.</li>') + '</ul>' +
          '<div class="asw-nova-regra"><select class="campo" id="asw-rtipo">' + TIPOS_REGRA.map(([k, r]) => '<option value="' + esc(k) + '">' + r + '</option>').join('') + '</select>' +
          '<input class="campo" id="asw-rtexto" placeholder="Ex.: prometer data de postagem sem olhar a agenda"><button class="b" data-mais-regra>Adicionar</button></div>' +
          '<h3 class="asw-h3b">Horário de atendimento</h3>' +
          sw('horario.ativo', h.ativo, 'Respeitar horário', 'Fora dele, avisa que o time responde depois e leva a dúvida à equipe') +
          '<div class="asw-horario' + (h.ativo ? '' : ' off') + '"><div class="asw-chips">' + DIAS.map(([d, r]) => '<button class="asw-chip' + ((h.dias || []).map(String).includes(d) ? ' on' : '') + '" data-dia="' + d + '">' + r + '</button>').join('') + '</div>' +
          '<div class="asw-linha"><span>Das</span><span><input class="campo asw-hora" type="time" data-c="horario.ini" value="' + esc(h.ini || '08:00') + '"> às <input class="campo asw-hora" type="time" data-c="horario.fim" value="' + esc(h.fim || '18:00') + '"></span></div>' +
          '<textarea class="campo" rows="2" data-c="horario.mensagem" placeholder="Mensagem fora do horário">' + esc(h.mensagem || '') + '</textarea></div>' +
        '</div></div>';
    }
    if (S.aba === 'equipe') {
      const ge = c.grupo_equipe || '';
      return '<div class="asw-card asw-ge"><div class="asw-ge-top"><span class="asw-ge-ic">🔔</span><div><h3>Grupo da equipe</h3>' +
          '<p class="asw-sub">Ele lê os grupos dos clientes e manda aqui <b>o que cada cliente pediu e ninguém respondeu</b>. Nesse grupo, chame pelo nome para perguntar de qualquer cliente: “' + esc((c.nome || 'B7').split(' ')[0]) + ' o que tem da Arena Deck?” ou “' + esc((c.nome || 'B7').split(' ')[0]) + ', pendências”.</p></div></div>' +
        '<div class="asw-ge-campos"><div><label class="rot">Grupo</label><select class="campo" data-c="grupo_equipe"><option value="">— escolha o grupo interno —</option>' +
          S.todosGrupos.map(g => '<option value="' + esc(g.jid) + '"' + (g.jid === ge ? ' selected' : '') + '>' + esc(g.nome || g.jid) + '</option>').join('') + '</select></div>' +
        '<div><label class="rot">Mandar as pendências</label><select class="campo" data-c="resumo_horas" data-num>' + [[1, 'a cada 1 hora'], [2, 'a cada 2 horas'], [3, 'a cada 3 horas'], [4, 'a cada 4 horas'], [6, 'a cada 6 horas'], [12, '2 vezes por dia'], [24, '1 vez por dia'], [168, '1 vez por semana'], [720, '1 vez por mês']].map(([v, r]) => '<option value="' + v + '"' + (Number(c.resumo_horas || 3) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
        '<div><label class="rot">Conta como pendente depois de</label><select class="campo" data-c="resumo_espera_min" data-num>' + [[15, '15 min sem resposta'], [30, '30 min sem resposta'], [60, '1 hora sem resposta'], [120, '2 horas sem resposta']].map(([v, r]) => '<option value="' + v + '"' + (Number(c.resumo_espera_min || 30) === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div></div>' +
        '<div class="asw-ge-pe"><span class="asw-sub">Só no horário de atendimento (seg a sex, 8h–18h se o horário não estiver ligado).</span><button class="b pri" data-pendencias' + (ge ? '' : ' disabled') + '>Mandar pendências agora</button></div></div>' +
        '<p class="asw-sub asw-topo">Quem aparece aqui pode ser <b>marcado</b> por ele quando o assunto for seu e <b>recebe as dúvidas</b> no WhatsApp (responda citando o aviso). Alguém da equipe que marcar o assistente num grupo dá uma <b>ordem</b> — ex.: “@' + esc((c.nome || 'B7').split(' ')[0]) + ' avisa que a arte sai amanhã”.</p>' +
        '<div class="asw-equipe">' + (c.equipe || []).map((p, i) =>
        '<div class="asw-pes" data-i="' + i + '"><span class="asw-av p">' + esc(ini(p.nome)) + '</span><div class="asw-pes-c">' +
          '<input class="campo" data-p="nome" placeholder="Nome" value="' + esc(p.nome || '') + '">' +
          '<input class="campo" data-p="numero" inputmode="tel" placeholder="WhatsApp com DDD (55 62 9…)" value="' + esc(p.numero || '') + '">' +
          '<input class="campo" data-p="assuntos" placeholder="Cuida de… (ex.: artes, gravações)" value="' + esc(p.assuntos || '') + '">' +
          '<label class="asw-sw p"><input type="checkbox" data-p="duvidas"' + (p.duvidas !== false ? ' checked' : '') + '><span></span>Recebe as dúvidas</label></div>' +
          '<button class="asw-x" data-tira-pes="' + i + '" aria-label="Tirar">✕</button></div>').join('') +
        '<button class="asw-pes asw-pes-nova" data-mais-pes><span>＋</span>Adicionar pessoa</button></div>';
    }
    if (S.aba === 'grupos') {
      const q = S.busca.toLowerCase(), gs = S.grupos.filter(g => !q || String(g.nome).toLowerCase().includes(q));
      return '<div class="asw-card"><div class="asw-gtopo"><input class="campo" id="asw-busca" placeholder="Buscar grupo…" value="' + esc(S.busca) + '"><button class="b fina contorno" data-todos="1">Ligar todos</button><button class="b fina contorno" data-todos="0">Desligar todos</button></div>' +
        '<p class="asw-sub">Só grupos ligados a um cliente do B7. Regras do grupo valem só ali (ex.: “cliente prefere ser chamado de Dr. Rafael”).</p>' +
        (gs.length ? gs.map(g => { const gc = (c.grupos || {})[g.jid] || {};
          return '<div class="asw-g' + (gc.desligado ? ' off' : '') + '"><label class="asw-sw"><input type="checkbox" data-g="' + esc(g.jid) + '"' + (gc.desligado ? '' : ' checked') + '><span></span></label>' +
            '<span class="asw-av g">' + (g.foto_url ? '<img src="' + esc(g.foto_url) + '" alt="" onerror="this.remove()">' : '') + esc(ini(g.nome)) + '</span>' +
            '<b>' + esc(g.nome || '') + '</b><input class="campo" data-gr="' + esc(g.jid) + '" placeholder="Regras só deste grupo (opcional)" value="' + esc(gc.regras || '') + '"></div>'; }).join('')
          : '<div class="asw-nada">Nenhum grupo encontrado.<small>Ligue os grupos aos clientes na Central (⋮ da conversa → Ligar a um cliente).</small></div>') + '</div>';
    }
    if (S.aba === 'saber') {
      return '<div class="asw-card"><h3>Ensinar algo</h3><p class="asw-sub">Ele usa isso como verdade em todos os grupos. Também aprende sozinho quando a equipe responde uma dúvida.</p>' +
        '<div class="asw-ensina"><input class="campo" id="asw-ap-p" placeholder="Pergunta / assunto (ex.: prazo padrão de arte)"><input class="campo" id="asw-ap-r" placeholder="Resposta (ex.: 2 dias úteis depois do briefing)"><button class="b pri" data-ensinar>Ensinar</button></div></div>' +
        '<div class="asw-saber">' + (S.ap.map(a => '<div class="asw-ap' + (a.ativo === false ? ' off' : '') + '" data-ap="' + esc(a.id) + '"><b>' + esc(a.pergunta) + '</b><p>' + esc(a.resposta) + '</p>' +
          '<small>' + esc([a.respondido_por, a.grupo, quando(a.criado_em)].filter(Boolean).join(' · ')) + '</small>' +
          '<div class="asw-ap-ac"><label class="asw-sw p"><input type="checkbox" data-ap-ativo' + (a.ativo !== false ? ' checked' : '') + '><span></span>Usar</label><button class="asw-x" data-esquece aria-label="Esquecer">✕</button></div></div>').join('')
          || '<div class="asw-nada">Ainda não aprendeu nada.<small>Ensine acima, ou responda as dúvidas que ele levar à equipe.</small></div>') + '</div>';
    }
    if (S.aba === 'testar') {
      return '<div class="asw-teste"><div class="asw-teste-top"><select class="campo" id="asw-tjid">' + S.grupos.map(g => '<option value="' + esc(g.jid) + '"' + (g.jid === S.testeJid ? ' selected' : '') + '>' + esc(g.nome) + '</option>').join('') + '</select>' +
        '<label class="asw-sw p"><input type="checkbox" id="asw-teq"' + (S.testeEquipe ? ' checked' : '') + '><span></span>Falar como equipe (dar uma ordem)</label></div>' +
        '<div class="asw-chat" id="asw-chat">' + (S.teste.length ? S.teste.map(m => m.de === 'eu' ? '<div class="asw-bl eu">' + esc(m.t) + '</div>'
          : m.de === 'pensa' ? '<div class="asw-bl ele pensa"><i></i><i></i><i></i></div>'
          : '<div class="asw-bl ele"><b>' + esc(S.cfg.nome) + '</b>' + esc(m.t) + (m.pq ? '<span class="asw-pq">🤔 Perguntaria à equipe: ' + esc(m.pq) + '</span>' : '') + (m.meta ? '<small>' + esc(m.meta) + '</small>' : '') + '</div>').join('')
          : '<div class="asw-nada">Escreva como se fosse o cliente no grupo escolhido.<small>Ele usa a conversa real do grupo e o que está em produção — e <b>não manda nada</b> no WhatsApp.</small></div>') + '</div>' +
        '<div class="asw-teste-in"><input class="campo" id="asw-tin" placeholder="Ex.: Oi! Como está a arte da Black Friday?"><button class="b pri" data-testar>Enviar</button></div></div>';
    }
    return '';
  }
  const sw = (k, on, t, d) => '<label class="asw-sw"><input type="checkbox" data-c="' + k + '"' + (on ? ' checked' : '') + '><span></span><div><b>' + t + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</div></label>';

  function definir(k, v) { const p = k.split('.'); let o = S.cfg; while (p.length > 1) { const x = p.shift(); o[x] = o[x] || {}; o = o[x]; } o[p[0]] = v; }

  function digitou(e) {
    const t = e.target;
    if (t.dataset.c) {
      const v = t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.hasAttribute('data-num')) ? Number(t.value) || 0 : t.value;
      if (t.dataset.c === 'grupo_equipe') { const bt = raiz.querySelector('[data-pendencias]'); if (bt) bt.disabled = !t.value; }
      definir(t.dataset.c, v);
      if (t.dataset.c === 'ativo') { desenhar(); return salvar(true); }
      if (t.dataset.c === 'horario.ativo') { const h = raiz.querySelector('.asw-horario'); if (h) h.classList.toggle('off', !t.checked); }
      if (t.dataset.c === 'nome') { const h = raiz.querySelector('.asw-hero h1'); if (h) h.textContent = t.value || 'Assistente'; }
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
    const ab = t.closest('[data-aba]'); if (ab) { S.aba = ab.dataset.aba; desenhar(); if (S.aba === 'testar') { const i = raiz.querySelector('#asw-tin'); if (i) i.focus(); } return; }
    if (t.closest('[data-salvar]')) return salvar();
    if (t.closest('[data-desfazer]')) { S.cfg = JSON.parse(S.orig); S.regras = regrasDe(S.cfg.regras); desenhar(); return; }
    const tom = t.closest('[data-tom]');
    if (tom) { const x = TONS[Number(tom.dataset.tom)][1]; const j = String(S.cfg.jeito || ''); if (!j.includes(x)) S.cfg.jeito = (j.trim() ? j.trim() + '\n' : '') + x; desenhar(); return; }
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
      equipe: (c.equipe || []).filter(p => p.nome && p.numero).map(p => ({ nome: p.nome.trim(), numero: String(p.numero).replace(/\D/g, ''), assuntos: (p.assuntos || '').trim(), duvidas: p.duvidas !== false })),
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
