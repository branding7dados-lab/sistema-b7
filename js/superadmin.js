/* =====================================================================
   SUPER ADMIN (zzz225) — #/super

   Só para quem é super admin (perfis.superadmin). O admin supremo tem
   ainda a aba "Supremo". Tudo o que muda alguma coisa passa pelo banco
   (super_*) ou pela b7-auth, que conferem de novo quem pediu.

   Abas:
     · Painel      — administradores, o que eles fizeram (cofre de
                     auditoria), chamados de administradores, contas
                     paradas e acessos de aparelhos novos;
     · Aprovações  — o que os administradores comuns pediram (aprovação dupla);
     · Limites     — o que um administrador comum pode fazer sozinho;
     · Segurança   — verificação em 2 etapas dos administradores e
                     "derrubar todas as sessões";
     · Uso         — banco, arquivos, IA, e-mails e o backup completo;
     · Avaliações  — notas do atendimento de cada pessoa da equipe e do assistente;
     · Supremo     — emergência, tirar um administrador e passar o cargo.

   zzz226: visual revisto (Kevin: "o UI e o UX ficaram feião"): blocos
   com espaço entre si e ícone no título, números com ícone e clicáveis,
   histórico agrupado por dia e com nomes legíveis, botões de perigo em
   vermelho, abas com ícone que rolam no celular.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.Super = (function () {
  const esc = s => B7.UI.esc(s);
  const painel = () => document.getElementById('painel-dashboard');
  const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    coroa: '<path d="M3.5 8l4.2 3.6L12 5l4.3 6.6L20.5 8l-1.6 10H5.1z"/><path d="M5.5 21h13"/>',
    escudo: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.8 2.8L16.3 9.6"/>',
    alerta: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17.3v.1"/>',
    painel: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    caixa: '<path d="M3.5 13.5l2.6-7.2A2 2 0 0 1 8 5h8a2 2 0 0 1 1.9 1.3l2.6 7.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5"/>',
    limites: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    grafico: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    estrela: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    pessoas: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16 4.9a3.4 3.4 0 0 1 0 6.2M18 13.8a6 6 0 0 1 3.4 5.5"/>',
    chamado: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/>',
    aparelho: '<rect x="3.5" y="5" width="17" height="11" rx="2.2"/><path d="M9 20h6M12 16v4"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    historico: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4.5V9H8"/><path d="M12 8v4.5l3 1.8"/>',
    banco: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    ia: '<path d="M12 3.5l1.7 4.6a2 2 0 0 0 1.2 1.2l4.6 1.7-4.6 1.7a2 2 0 0 0-1.2 1.2L12 18.5l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 11l4.6-1.7a2 2 0 0 0 1.2-1.2z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    baixar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    sair: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    trava: '<rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    sino: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    rebaixar: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16 11h6"/>',
    passar: '<path d="M4 12h14M13 6l6 6-6 6"/>',
    lixo: '<path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
    chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5"/>'
  };
  const ic = (k, cls) => '<span class="sa-ic' + (cls ? ' ' + cls : '') + '">' + SVG(IC[k]) + '</span>';
  const nivel = () => (B7.Auth && B7.Auth.superadmin ? B7.Auth.superadmin() : null);
  const ehSuper = () => !!nivel();
  const quando = iso => iso ? (B7.UI.quando ? B7.UI.quando(iso) : String(iso).slice(0, 10)) : 'nunca';
  const primeiro = n => String(n || '').trim().split(/\s+/)[0];
  const bytes = n => { n = Number(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.round(n / 1e3) + ' KB'; };
  const mil = n => Number(n || 0).toLocaleString('pt-BR');
  const auth = corpo => B7.DB.chamarAuth(corpo);
  let aba = 'painel', vez = 0;

  const ABAS = [['painel', 'Painel', 'painel'], ['aprovacoes', 'Aprovações', 'caixa'], ['limites', 'Limites', 'limites'], ['seguranca', 'Segurança', 'escudo'],
                ['uso', 'Uso e backup', 'grafico'], ['avaliacoes', 'Avaliações', 'estrela'], ['supremo', 'Supremo', 'coroa']];
  const ROT_ACAO = {
    alterar_conta: 'alterou o acesso de', criar_usuario: 'criou a conta de', excluir_conta: 'excluiu a conta de', redefinir_senha: 'redefiniu a senha de',
    entrar_como: 'entrou na conta de', salvar_preset: 'mudou o padrão da função', config_alterada: 'mudou a configuração', cliente_para_lixeira: 'mandou para a lixeira o cliente',
    cliente_apagado: 'apagou o cliente', politica_2fa: 'mudou a verificação em 2 etapas', resetar_2fa: 'desligou a verificação em 2 etapas de',
    acesso_pedido_aprovado: 'aprovou o acesso de', acesso_pedido_recusado: 'recusou o acesso de', funcao_personalizada_salvar: 'salvou a função', funcao_personalizada_excluir: 'excluiu a função',
    super_aprovou: 'aprovou o pedido sobre', super_recusou: 'recusou o pedido sobre', super_derrubar_todos: 'derrubou todas as sessões', super_derrubar: 'derrubou as sessões de',
    super_rebaixou: 'tirou o administrador de', supremo_transferido: 'passou o cargo de supremo para', emergencia_ligada: 'ligou a emergência', emergencia_desligada: 'desligou a emergência',
    acesso_aparelho_novo: 'entrou de um aparelho novo', avatar_definido_por_admin: 'trocou a foto de', avatar_removido_por_admin: 'tirou a foto de',
    meu_perfil: 'editou o próprio perfil', editar_proprio_perfil: 'editou o próprio perfil', avatar_definido: 'trocou a própria foto',
    ligar_2fa: 'ligou a verificação em 2 etapas', desligar_2fa: 'desligou a verificação em 2 etapas'
  };
  /* ações sobre a própria pessoa: o nome do alvo não se repete */
  const SOBRE_SI = ['meu_perfil', 'editar_proprio_perfil', 'avatar_definido', 'ligar_2fa', 'desligar_2fa', 'acesso_aparelho_novo', 'super_derrubar_todos', 'emergencia_ligada', 'emergencia_desligada'];
  const TOM_ACAO = { excluir_conta: 'ruim', cliente_apagado: 'ruim', cliente_para_lixeira: 'ruim', super_rebaixou: 'ruim', emergencia_ligada: 'ruim', super_derrubar_todos: 'ruim',
    desligar_2fa: 'atencao', resetar_2fa: 'atencao', entrar_como: 'atencao', redefinir_senha: 'atencao', acesso_aparelho_novo: 'atencao' };
  const ROT_LIM = {
    acessos: ['Criar contas e mudar acessos', 'função, módulos, administrador, desativar', 'pessoas'],
    excluir_conta: ['Excluir contas', 'a conta some do B7', 'lixo'],
    excluir_cliente: ['Excluir clientes', 'o cliente vai para a lixeira', 'lixo'],
    entrar_como: ['Entrar na conta de outra pessoa', 'aqui não existe "pede aprovação"', 'chave'],
    seguranca: ['Mudar a verificação em 2 etapas', 'para quem ela é obrigatória', 'escudo'],
    config_critica: ['Configurações críticas', 'manutenção, IA, recursos e aparência do sistema', 'trava']
  };
  const ROT_PASTA = { 'design-files': 'Artes de design', 'client-logos': 'Logos dos clientes', 'chat-arquivos': 'Arquivos das conversas', avatars: 'Fotos de perfil' };
  const ROT_IA = { chat: 'Chat com o assistente', linha: 'Linhas editoriais', resumo: 'Resumos', whatsapp: 'WhatsApp', voz: 'Voz', analise: 'Análises',
    roteiro: 'Roteiros', oportunidade: 'Oportunidades', agencia: 'Resumo da agência', suporte: 'Suporte' };

  async function abrir(sub) {
    const minha = ++vez;
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/super');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Super admin']);
    if (!ehSuper()) return B7.Dashboard.semPermissao('super');
    if (sub && ABAS.some(a => a[0] === sub)) aba = sub;
    if (aba === 'supremo' && nivel() !== 'supremo') aba = 'painel';
    const sup = nivel() === 'supremo';
    painel().innerHTML = '<div class="conteudo entra sa" id="sa">' +
      '<header class="sa-cab"><span class="sa-coroa' + (sup ? ' supremo' : '') + '">' + SVG(IC.coroa) + '</span>' +
        '<div class="sa-cab-tx"><span class="sa-tag">' + (sup ? 'Admin supremo' : 'Super admin') + '</span><h1>Super admin</h1>' +
        '<p>Acima dos administradores: o que eles fazem, o que precisam pedir, a segurança e o sistema todo.</p></div></header>' +
      '<nav class="sa-abas" role="tablist" aria-label="Seções do super admin">' + ABAS.filter(a => a[0] !== 'supremo' || sup).map(([k, r, i]) =>
        '<button type="button" role="tab" aria-selected="' + (aba === k) + '" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + (k === 'supremo' ? ' sa-aba-supremo' : '') + '">' +
          SVG(IC[i]) + '<span>' + r + '</span><i id="sa-n-' + k + '"></i></button>').join('') + '</nav>' +
      '<div id="sa-corpo" class="sa-corpo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => irAba(b.dataset.aba));
    const on = painel().querySelector('.sa-abas .on');
    if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* navegador antigo */ }
    contarPendentes();
    const cx = document.getElementById('sa-corpo');
    try {
      if (aba === 'painel') await abaPainel(cx, minha);
      else if (aba === 'aprovacoes') await abaAprovacoes(cx, minha);
      else if (aba === 'limites') await abaLimites(cx, minha);
      else if (aba === 'seguranca') await abaSeguranca(cx, minha);
      else if (aba === 'uso') await abaUso(cx, minha);
      else if (aba === 'avaliacoes') await abaAvaliacoes(cx, minha);
      else if (aba === 'supremo') await abaSupremo(cx, minha);
    } catch (e) {
      if (minha === vez) cx.innerHTML = '<div class="sa-bloco sa-erro">' + ic('alerta', 'ruim') + '<div><b>Não foi possível carregar esta aba.</b><p>' + esc((e && e.message) || 'Tente de novo em instantes.') + '</p>' +
        '<button type="button" class="b fina contorno" data-sa-tentar>Tentar de novo</button></div></div>';
      const t = cx.querySelector('[data-sa-tentar]'); if (t) t.onclick = () => abrir(aba);
    }
  }
  function irAba(k) { aba = k; history.replaceState(null, '', '#/super/' + aba); abrir(aba); }
  async function contarPendentes() {
    try {
      const { count } = await B7.sb.from('super_aprovacoes').select('id', { count: 'exact', head: true }).eq('estado', 'pendente');
      const i = document.getElementById('sa-n-aprovacoes'); if (i) i.textContent = count ? String(count) : '';
    } catch (e) { /* sem contagem */ }
  }

  /* --------------------------------------------------- peças comuns */
  /* número com ícone; com "ir", leva à aba que resolve */
  const kpi = (v, r, icone, tom, ir) => (ir ? '<button type="button" data-ir-aba="' + ir + '"' : '<div') + ' class="sa-kpi' + (tom ? ' ' + tom : '') + '">' +
    ic(icone) + '<span class="sa-kpi-tx"><b>' + v + '</b><span>' + r + '</span></span>' + (ir ? '</button>' : '</div>');
  const bloco = (icone, titulo, sub, corpo, cls) => '<section class="sa-bloco' + (cls ? ' ' + cls : '') + '"><header class="sa-bloco-cab">' + ic(icone) +
    '<div><h2>' + titulo + '</h2>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></header>' + corpo + '</section>';
  const vazio = (t, icone) => '<p class="sa-vazio">' + SVG(IC[icone || 'ok']) + '<span>' + t + '</span></p>';
  const av = p => B7.UI.avatarPessoa ? B7.UI.avatarPessoa({ nome: p.nome, avatar_url: p.avatar_url }, 'lu-avatar') : '';
  const selo = n => n ? '<em class="sa-sel ' + n + '">' + (n === 'supremo' ? 'supremo' : 'super') + '</em>' : '';
  const ligarIrAba = cx => cx.querySelectorAll('[data-ir-aba]').forEach(b => b.onclick = () => irAba(b.dataset.irAba));
  function rotuloDia(iso) {
    const d = new Date(iso), hoje = new Date(); const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  }
  const hora = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  /* ------------------------------------------------------------ painel */
  async function abaPainel(cx, minha) {
    const d = await B7.DB.rpc('super_painel', {});
    if (minha !== vez) return;
    const semDois = d.admins.filter(a => !a.com_2fa);
    const eu = B7.Auth.usuario() ? B7.Auth.usuario().id : null;
    const admins = d.admins.slice().sort((a, b) => (b.superadmin === 'supremo') - (a.superadmin === 'supremo') || (!!b.superadmin - !!a.superadmin) || String(a.nome).localeCompare(b.nome));
    cx.innerHTML = '<div class="sa-kpis">' +
        kpi(d.admins.length, 'administradores', 'pessoas') +
        kpi(d.aprovacoes_pendentes, d.aprovacoes_pendentes === 1 ? 'aprovação esperando' : 'aprovações esperando', 'caixa', d.aprovacoes_pendentes ? 'alerta' : '', 'aprovacoes') +
        kpi(semDois.length, 'sem 2 etapas', 'escudo', semDois.length ? 'alerta' : 'ok', 'seguranca') +
        kpi(d.alertas.length, 'aparelhos novos', 'aparelho', d.alertas.length ? 'alerta' : '', 'seguranca') +
        kpi(d.chamados_admin.length, 'chamados de admin', 'chamado') +
        kpi(d.paradas.length, 'contas paradas', 'relogio') + '</div>' +
      '<div class="sa-grade">' +
        bloco('pessoas', 'Administradores', 'quem manda no sistema', '<div class="sa-lista">' + admins.map(a => {
          const pode = !((a.superadmin === 'supremo' && nivel() !== 'supremo') || a.id === eu);
          return '<div class="sa-pessoa">' + av(a) + '<div class="sa-pessoa-tx"><b>' + esc(a.nome) + selo(a.superadmin) + (a.id === eu ? ' <span class="sa-voce">você</span>' : '') + '</b>' +
            '<small>' + esc(quando(a.ultimo)) + '</small></div>' +
            '<span class="sa-pilula ' + (a.com_2fa ? 'ok' : 'ruim') + '">' + (a.com_2fa ? '2 etapas' : 'sem 2 etapas') + '</span>' +
            (pode ? '<button type="button" class="sa-bt-ic" data-derrubar="' + esc(a.id) + '" data-nome="' + esc(a.nome) + '" title="Derrubar as sessões de ' + esc(primeiro(a.nome)) + '" aria-label="Derrubar as sessões de ' + esc(a.nome) + '">' + SVG(IC.sair) + '</button>'
              : '<span class="sa-bt-ic sa-bt-nada" aria-hidden="true"></span>') + '</div>';
        }).join('') + '</div>') +
        bloco('alerta', 'Precisa de atenção', 'chamados de administradores, aparelhos novos e contas paradas',
          (d.chamados_admin.length + d.alertas.length + d.paradas.length === 0 ? vazio('Nada fora do normal.') :
            '<div class="sa-lista">' +
            d.chamados_admin.map(c => '<a class="sa-item" href="#/suporte/' + esc(c.id) + '">' + ic('chamado', 'violeta') + '<span class="sa-item-tx"><b>#' + c.numero + ' · ' + esc(c.titulo) + '</b>' +
              '<small>chamado de ' + esc(primeiro(c.nome)) + ' · ' + esc(quando(c.em)) + ' · só os super admins veem</small></span><span class="sa-seta">' + SVG('<path d="M9 6l6 6-6 6"/>') + '</span></a>').join('') +
            d.alertas.map(x => '<div class="sa-item">' + ic('aparelho', 'atencao') + '<span class="sa-item-tx"><b>' + esc(primeiro(x.nome)) + ' entrou de um aparelho novo</b>' +
              '<small>' + esc(x.descricao || '') + ' · ' + esc(quando(x.em)) + '</small></span></div>').join('') +
            d.paradas.map(x => '<div class="sa-item">' + ic('relogio') + '<span class="sa-item-tx"><b>' + esc(x.nome) + (x.eh_admin ? ' · administrador' : '') + '</b>' +
              '<small>conta parada · último acesso ' + esc(quando(x.ultimo)) + '</small></span></div>').join('') + '</div>')) +
      '</div>' +
      bloco('historico', 'O que aconteceu', '30 dias · ninguém consegue apagar este histórico', feed(d.acoes || []));
    cx.querySelectorAll('[data-derrubar]').forEach(b => b.onclick = () => derrubar(b.dataset.derrubar, b.dataset.nome));
    const mais = cx.querySelector('[data-sa-mais]');
    if (mais) mais.onclick = () => { cx.querySelectorAll('.sa-dia[hidden]').forEach(x => { x.hidden = false; }); mais.remove(); };
    ligarIrAba(cx);
  }
  /* histórico agrupado por dia; os 4 dias mais recentes abertos, o resto em "Ver mais" */
  function feed(acoes) {
    if (!acoes.length) return vazio('Nada registrado nos últimos 30 dias.', 'historico');
    const dias = [];
    acoes.forEach(a => { const r = rotuloDia(a.created_at); let g = dias[dias.length - 1]; if (!g || g.r !== r) dias.push(g = { r, itens: [] }); g.itens.push(a); });
    const frase = a => {
      const v = ROT_ACAO[a.acao] || String(a.acao || '').replace(/_/g, ' ');
      const alvo = a.alvo_nome && !(SOBRE_SI.includes(a.acao) && a.alvo_nome === a.autor_nome) ? ' <b>' + esc(a.alvo_nome) + '</b>' : '';
      return '<b>' + esc(a.autor_nome || 'Sistema') + '</b>' + (a.autor_super ? '<span class="sa-ev-coroa" title="super admin">' + SVG(IC.coroa) + '</span>' : '') + ' ' + esc(v) + alvo;
    };
    return '<div class="sa-feed">' + dias.map((g, i) => '<div class="sa-dia"' + (i >= 4 ? ' hidden' : '') + '><h3>' + esc(g.r) + '</h3>' + g.itens.map(a =>
        '<div class="sa-ev ' + (TOM_ACAO[a.acao] || '') + '"><span class="sa-ev-dot"></span>' +
          '<p>' + frase(a) + '</p><time>' + hora(a.created_at) + '</time></div>').join('') + '</div>').join('') + '</div>' +
      (dias.length > 4 ? '<button type="button" class="b fina contorno sa-mais" data-sa-mais>Ver os outros ' + (dias.length - 4) + ' dias</button>' : '') +
      '<p class="sa-legenda"><span><span class="sa-ev-coroa">' + SVG(IC.coroa) + '</span>super admin</span><span><span class="sa-ev-dot ruim"></span>exclusões e travas</span><span><span class="sa-ev-dot atencao"></span>acessos sensíveis</span></p>';
  }
  async function derrubar(id, nome) {
    const ok = await B7.UI.confirmar({ titulo: 'Derrubar as sessões de ' + primeiro(nome) + '?', texto: 'Todos os aparelhos dessa conta saem do B7 e precisam entrar de novo com a senha.', rotulo: 'Derrubar sessões', perigo: true });
    if (!ok) return;
    try { await auth({ acao: 'super_derrubar', perfil_id: id }); B7.UI.toast('Sessões derrubadas.'); }
    catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
  }

  /* -------------------------------------------------------- aprovações */
  const IC_PEDIDO = { excluir_cliente: 'lixo', excluir_conta: 'lixo', acessos: 'pessoas', seguranca: 'escudo' };
  async function abaAprovacoes(cx, minha) {
    const { data, error } = await B7.sb.from('super_aprovacoes').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    if (minha !== vez) return;
    const ids = [...new Set((data || []).flatMap(a => [a.pedido_por, a.decidido_por]).filter(Boolean))];
    let nomes = {};
    if (ids.length) { const { data: ps } = await B7.sb.from('perfis').select('id, nome').in('id', ids); (ps || []).forEach(p => { nomes[p.id] = p.nome; }); }
    const pend = (data || []).filter(a => a.estado === 'pendente'), resto = (data || []).filter(a => a.estado !== 'pendente');
    const ROT_EST = { aprovado: ['aprovado', 'ok'], recusado: ['recusado', 'ruim'], executado: ['feito', 'ok'], falhou: ['aprovado, mas falhou', 'ruim'] };
    cx.innerHTML = bloco('caixa', 'Esperando você' + (pend.length ? ' <span class="sa-conta">' + pend.length + '</span>' : ''),
        'o pedido só acontece quando um super admin aprova', pend.length ? '<div class="sa-lista">' + pend.map(a =>
        '<div class="sa-pedido" data-id="' + esc(a.id) + '">' + ic(IC_PEDIDO[a.acao] || 'caixa', IC_PEDIDO[a.acao] === 'lixo' ? 'ruim' : 'violeta') +
          '<div class="sa-pedido-tx"><b>' + esc(a.resumo || a.acao) + '</b><small>pedido por ' + esc(nomes[a.pedido_por] || 'alguém') + ' · ' + esc(quando(a.created_at)) + '</small>' +
          (a.motivo ? '<q>' + esc(a.motivo) + '</q>' : '') + '</div><div class="sa-pedido-bts"><button type="button" class="b fina contorno" data-nao>Recusar</button><button type="button" class="b fina pri" data-sim>Aprovar</button></div></div>').join('') + '</div>'
        : vazio('Nada esperando aprovação.')) +
      bloco('historico', 'Decididos', 'os últimos 60 pedidos', resto.length ? '<div class="sa-lista">' + resto.map(a => {
        const e = ROT_EST[a.estado] || [a.estado, ''];
        return '<div class="sa-item">' + ic(IC_PEDIDO[a.acao] || 'caixa') + '<span class="sa-item-tx"><b>' + esc(a.resumo || a.acao) + '</b><small>' + esc(e[0]) + ' por ' + esc(nomes[a.decidido_por] || '—') + ' · ' + esc(quando(a.decidido_em)) +
          (a.resposta ? ' · "' + esc(a.resposta) + '"' : '') + '</small></span><span class="sa-pilula ' + e[1] + '">' + esc(e[0]) + '</span></div>';
      }).join('') + '</div>' : vazio('Nenhum pedido decidido ainda.', 'historico'));
    cx.querySelectorAll('.sa-pedido').forEach(el => {
      const decidir = async aprovar => {
        let resp = null;
        if (!aprovar) { resp = await B7.UI.perguntar({ titulo: 'Recusar o pedido?', rotulo: 'Diga o motivo (opcional): quem pediu recebe no aviso.', confirmar: 'Recusar' }); if (resp === null) return; }
        el.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
          const r = await B7.DB.rpc('super_decidir', { p_id: el.dataset.id, p_aprovar: aprovar, p_resposta: resp || null });
          /* ações de conta: quem executa é a b7-auth, com a sessão do super admin */
          if (aprovar && r && r.corpo && ['excluir_conta', 'acessos', 'seguranca'].includes(r.acao)) {
            try { await auth(Object.assign({}, r.corpo, { aprovacao_id: el.dataset.id })); await B7.DB.rpc('super_marcar_execucao', { p_id: el.dataset.id, p_ok: true }); B7.UI.toast('Aprovado e feito.'); }
            catch (e) { await B7.DB.rpc('super_marcar_execucao', { p_id: el.dataset.id, p_ok: false, p_erro: (e && e.message) || '' }).catch(() => {}); B7.UI.toast('Aprovado, mas não deu para fazer: ' + ((e && e.message) || ''), { tipo: 'erro' }); }
          } else B7.UI.toast(aprovar ? 'Aprovado.' : 'Recusado. Quem pediu foi avisado.');
          abrir('aprovacoes');
        } catch (e) { el.querySelectorAll('button').forEach(b => { b.disabled = false; }); B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
      };
      el.querySelector('[data-sim]').onclick = () => decidir(true);
      el.querySelector('[data-nao]').onclick = () => decidir(false);
    });
  }

  /* ----------------------------------------------------------- limites */
  async function abaLimites(cx, minha) {
    const lim = await B7.DB.rpc('super_limites', {});
    if (minha !== vez) return;
    const rasc = Object.assign({}, lim);
    const OPC = [['livre', 'Livre'], ['aprovacao', 'Pede aprovação'], ['bloqueado', 'Só super admin']];
    const pinta = () => {
      const mudou = JSON.stringify(rasc) !== JSON.stringify(lim);
      cx.innerHTML = bloco('limites', 'O que um administrador comum pode fazer', 'super admin é sempre livre · vale no servidor, não só na tela',
        '<div class="sa-lista">' + Object.keys(ROT_LIM).map(k => '<div class="sa-lim">' + ic(ROT_LIM[k][2]) + '<div class="sa-lim-tx"><b>' + ROT_LIM[k][0] + '</b><small>' + ROT_LIM[k][1] + '</small></div>' +
          '<div class="sa-seg" role="radiogroup" aria-label="' + esc(ROT_LIM[k][0]) + '">' + OPC.map(([v, r]) => (k === 'entrar_como' && v === 'aprovacao')
            ? '<button type="button" class="nao" disabled aria-hidden="true">—</button>'
            : '<button type="button" role="radio" aria-checked="' + (rasc[k] === v) + '" data-k="' + k + '" data-v="' + v + '" class="' + (rasc[k] === v ? 'on v-' + v : '') + '">' + r + '</button>').join('') + '</div></div>').join('') + '</div>' +
        '<div class="sa-explica"><span><i class="v-livre"></i><b>Livre</b> o administrador faz sozinho</span><span><i class="v-aprovacao"></i><b>Pede aprovação</b> vira um pedido na aba Aprovações</span><span><i class="v-bloqueado"></i><b>Só super admin</b> o administrador não consegue</span></div>') +
        '<div class="sa-barra-salvar' + (mudou ? ' mostra' : '') + '"><span>' + (mudou ? 'Você mudou os limites.' : 'Nenhuma mudança.') + '</span>' +
          '<button type="button" class="b fina contorno" id="sa-lim-desfazer"' + (mudou ? '' : ' disabled') + '>Desfazer</button>' +
          '<button type="button" class="b pri" id="sa-lim-salvar"' + (mudou ? '' : ' disabled') + '>Salvar limites</button></div>';
      cx.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { rasc[b.dataset.k] = b.dataset.v; pinta(); });
      cx.querySelector('#sa-lim-desfazer').onclick = () => { Object.keys(rasc).forEach(k => delete rasc[k]); Object.assign(rasc, lim); pinta(); };
      cx.querySelector('#sa-lim-salvar').onclick = async () => {
        try { await B7.DB.rpc('super_limites_definir', { p: rasc }); B7.UI.toast('Limites salvos. Valem na hora.'); abrir('limites'); }
        catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível salvar.', { tipo: 'erro' }); }
      };
    };
    pinta();
  }

  /* ---------------------------------------------------------- segurança */
  async function abaSeguranca(cx, minha) {
    const d = await B7.DB.rpc('super_painel', {});
    if (minha !== vez) return;
    const com = d.admins.filter(a => a.com_2fa).length;
    cx.innerHTML = '<div class="sa-grade">' +
      bloco('escudo', 'Verificação em 2 etapas', com + ' de ' + d.admins.length + ' administradores ligaram · obrigatória para todos',
        '<div class="sa-progresso"><i style="width:' + (d.admins.length ? Math.round(com / d.admins.length * 100) : 0) + '%"></i></div>' +
        '<div class="sa-lista">' + d.admins.map(a => '<div class="sa-pessoa">' + av(a) + '<div class="sa-pessoa-tx"><b>' + esc(a.nome) + selo(a.superadmin) + '</b>' +
          '<small>' + (a.com_2fa ? 'protegida com código' : 'o B7 pede para ligar no próximo acesso') + '</small></div>' +
          '<span class="sa-pilula ' + (a.com_2fa ? 'ok' : 'ruim') + '">' + (a.com_2fa ? 'Ligada' : 'Falta ligar') + '</span></div>').join('') + '</div>') +
      bloco('aparelho', 'Aparelhos novos', 'administradores · últimos 14 dias',
        '<p class="sa-nota">Quando um administrador entra de um aparelho ou de uma rede que ainda não tinha usado, os super admins recebem aviso no sino.</p>' +
        (d.alertas.length ? '<div class="sa-lista">' + d.alertas.map(x => '<div class="sa-item">' + ic('aparelho', 'atencao') + '<span class="sa-item-tx"><b>' + esc(primeiro(x.nome)) + ' · ' + esc(x.descricao || '') + '</b><small>' + esc(quando(x.em)) + '</small></span></div>').join('') + '</div>'
          : vazio('Nenhum aparelho novo nos últimos 14 dias.'))) + '</div>' +
      bloco('sair', 'Derrubar todas as sessões', 'para quando uma senha vazou ou algo estranho aconteceu',
        '<div class="sa-perigo-linha"><p>Todo mundo (menos você) sai do B7 na hora e precisa entrar de novo com a senha. Os aparelhos de confiança deixam de ser confiáveis.</p>' +
        '<button type="button" class="b pri perigo" id="sa-derrubar-todos">Derrubar todas as sessões</button></div>', 'sa-perigo');
    cx.querySelector('#sa-derrubar-todos').onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Derrubar TODAS as sessões?', texto: 'A equipe inteira e os clientes saem do B7 agora. Você continua dentro.', rotulo: 'Derrubar todas', perigo: true });
      if (!ok) return;
      try { const r = await auth({ acao: 'super_derrubar_todos' }); B7.UI.toast((r && r.contas) + ' contas desconectadas.'); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
  }

  /* --------------------------------------------------------- uso e custos */
  async function abaUso(cx, minha) {
    const [u, br] = await Promise.all([B7.DB.rpc('super_uso', {}), auth({ acao: 'super_brevo' }).catch(() => null)]);
    if (minha !== vez) return;
    const barra = (v, max, rot, icone) => { const p = Math.min(100, Math.round((v / max) * 100));
      return '<div class="sa-uso">' + ic(icone) + '<div class="sa-uso-tx"><div class="sa-uso-cab"><b>' + rot + '</b><span><b>' + bytes(v) + '</b> de ' + bytes(max) + '</span></div>' +
        '<div class="sa-uso-barra"><i style="width:' + Math.max(p, 1) + '%" class="' + (p > 80 ? 'alto' : p > 60 ? 'medio' : '') + '"></i></div><small>' + p + '% usado</small></div></div>'; };
    const arq = (u.arquivos || []).reduce((s, x) => s + Number(x.bytes || 0), 0);
    const credito = br && br.plano ? br.plano.find(p => p.tipo === 'free' || p.creditos != null) : null;
    const ia = Object.entries(u.ia_por_recurso || {}).sort((a, b) => b[1] - a[1]);
    const iaMax = ia.length ? ia[0][1] : 1;
    cx.innerHTML = '<div class="sa-kpis">' + kpi(mil(u.ia_30d.pedidos), 'pedidos à IA em 30 dias', 'ia') + kpi(mil(u.ia_hoje), 'pedidos à IA hoje', 'relogio') +
        kpi(mil(u.ia_30d.erros), 'pedidos com erro', 'alerta', u.ia_30d.erros ? 'alerta' : 'ok') + kpi(mil(Math.round(Number(u.ia_30d.tokens || 0) / 1000)) + ' mil', 'tokens da IA em 30 dias', 'grafico') +
        kpi(mil(u.avisos_30d), 'avisos enviados em 30 dias', 'sino') + kpi(mil(u.contas_ativas), 'contas ativas', 'pessoas') + '</div>' +
      '<div class="sa-grade">' +
        bloco('banco', 'Espaço', 'limites do plano gratuito do Supabase',
          barra(u.banco_bytes, 500e6, 'Banco de dados', 'banco') + barra(arq, 1e9, 'Arquivos', 'caixa') +
          '<div class="sa-pastas">' + (u.arquivos || []).map(x => '<div><span>' + esc(ROT_PASTA[x.pasta] || x.pasta) + '</span><small>' + mil(x.n) + ' arquivos</small><b>' + bytes(x.bytes) + '</b></div>').join('') + '</div>') +
        bloco('ia', 'IA por área', '30 dias', ia.length ? '<div class="sa-barras">' + ia.map(([k, n]) =>
          '<div><span>' + esc(ROT_IA[k] || k) + '</span><i><em style="width:' + Math.max(2, Math.round(n / iaMax * 100)) + '%"></em></i><b>' + mil(n) + '</b></div>').join('') + '</div>'
          : vazio('Nenhum pedido à IA em 30 dias.', 'ia')) +
      '</div><div class="sa-grade">' +
        bloco('email', 'E-mails (Brevo)', 'códigos da verificação em 2 etapas e avisos', !br ? vazio('Não deu para consultar a Brevo agora.', 'alerta') : !br.configurado ? vazio('O envio de e-mail não está configurado.', 'alerta') :
          (credito ? '<div class="sa-grande"><b>' + mil(credito.creditos) + '</b><span>e-mails restantes' + (credito.tipo === 'free' ? ' hoje' : '') + '</span></div><p class="sa-nota">Plano ' + esc(credito.tipo === 'free' ? 'gratuito (300 por dia)' : credito.tipo) + '.</p>' : '<p>Conta conectada.</p>')) +
        bloco('baixar', 'Backup completo', 'só super admin baixa',
          '<p class="sa-nota">Um arquivo com clientes, gravações, roteiros e cenas. O banco continua sendo o Supabase: isto é segurança extra.</p>' +
          '<button type="button" class="b pri" id="sa-backup">' + SVG(IC.baixar) + 'Baixar backup</button>') + '</div>';
    cx.querySelector('#sa-backup').onclick = () => { if (B7.Backup && B7.Backup.exportar) B7.Backup.exportar(); };
  }

  /* ---------------------------------------------------------- avaliações */
  async function abaAvaliacoes(cx, minha) {
    const [eq, ia] = await Promise.all([B7.DB.rpc('super_avaliacoes_equipe', { p_dias: 90 }), B7.DB.rpc('suporte_atendimento_resumo', { p_dias: 90 })]);
    if (minha !== vez) return;
    const est = n => '<span class="sa-estrelas" aria-label="' + String(n).replace('.', ',') + ' de 5">' + '★★★★★'.slice(0, Math.round(n)) + '<span class="apagada">' + '★★★★★'.slice(Math.round(n)) + '</span></span>';
    const nota = v => v == null ? '—' : String(v).replace('.', ',');
    cx.innerHTML = '<div class="sa-kpis">' + kpi(nota(ia.nota_ia), 'nota do assistente · ' + ia.n_ia + (ia.n_ia === 1 ? ' avaliação' : ' avaliações'), 'ia') +
        kpi(nota(ia.nota_equipe), 'nota da equipe · ' + ia.n_equipe + (ia.n_equipe === 1 ? ' avaliação' : ' avaliações'), 'estrela') +
        kpi(ia.resolvidos_ia + ' de ' + ia.com_ia, 'resolvidos pelo assistente', 'ok') + '</div>' +
      bloco('pessoas', 'Quem atendeu', '90 dias · a nota vai para quem deu a última resposta no chamado', eq.length ? '<div class="sa-lista">' + eq.map(p =>
        '<details class="sa-aval"><summary>' + av(p) + '<span class="sa-aval-tx"><b>' + esc(p.nome) + '</b><small>' + p.n + (p.n === 1 ? ' avaliação' : ' avaliações') + '</small></span>' +
          est(p.media) + '<b class="sa-aval-n">' + String(p.media).replace('.', ',') + '</b><span class="sa-seta">' + SVG('<path d="M9 6l6 6-6 6"/>') + '</span></summary>' +
          '<div class="sa-aval-lista">' + (p.ultimas || []).slice(0, 8).map(x => '<div class="sa-item"><span class="sa-nota-ch">' + x.nota + '/5</span><span class="sa-item-tx"><b>#' + x.numero + ' · ' + esc(x.titulo) + '</b>' +
            (x.comentario ? '<small>"' + esc(x.comentario) + '"</small>' : '<small>sem comentário</small>') + '</span></div>').join('') + '</div></details>').join('') + '</div>'
        : vazio('Ainda não há avaliações de atendimentos da equipe. Elas aparecem quando alguém dá nota a um chamado encerrado.', 'estrela'));
  }

  /* ------------------------------------------------------------- supremo */
  async function abaSupremo(cx, minha) {
    const [d, man] = await Promise.all([B7.DB.rpc('super_painel', {}), B7.sb.from('sistema_config').select('valor').eq('chave', 'manutencao').maybeSingle()]);
    if (minha !== vez) return;
    const emerg = !!(man && man.data && man.data.valor && man.data.valor.ativo && man.data.valor.emergencia);
    const outros = d.admins.filter(a => a.superadmin !== 'supremo');
    const FUN = [['coordenador', 'Coordenador'], ['designer', 'Designer'], ['videomaker', 'Videomaker']];
    const opcoes = vazioRot => '<option value="">' + vazioRot + '</option>' + outros.map(a => '<option value="' + esc(a.id) + '">' + esc(a.nome) + (a.superadmin ? ' (super admin)' : '') + '</option>').join('');
    cx.innerHTML = '<p class="sa-aviso-topo">' + SVG(IC.alerta) + '<span>Tudo aqui é sério e só o admin supremo vê. Cada ação pede confirmação e fica no histórico.</span></p>' +
      bloco('alerta', 'Emergência', emerg ? '<b class="sa-ruim">ligada agora</b>' : 'trava o sistema para todos, menos os super admins',
        emerg ? '<div class="sa-perigo-linha"><p><b>O sistema está travado</b> para a equipe, os administradores e os clientes. Só os super admins usam.</p>' +
            '<button type="button" class="b pri" id="sa-emerg-off">Desligar a emergência</button></div>'
          : '<p class="sa-nota">Use em caso de invasão, vazamento ou erro grave. Todo mundo (equipe, administradores e clientes) fica travado até você desligar.</p>' +
            '<label class="sa-rot" for="sa-emerg-msg">Mensagem que aparece para todos <small>(opcional)</small></label>' +
            '<div class="sa-form"><input class="campo" id="sa-emerg-msg" maxlength="300" placeholder="Ex.: Voltamos em 30 minutos.">' +
            '<button type="button" class="b pri perigo" id="sa-emerg-on">Ligar a emergência</button></div>', 'sa-perigo' + (emerg ? ' ativa' : '')) +
      '<div class="sa-grade">' +
      bloco('rebaixar', 'Tirar o administrador de alguém', 'a pessoa sai do B7 e volta só com a função escolhida',
        '<label class="sa-rot" for="sa-reb-quem">Quem</label><select class="campo" id="sa-reb-quem">' + opcoes('Escolha a pessoa…') + '</select>' +
        '<label class="sa-rot" for="sa-reb-fn">Passa a ser</label><select class="campo" id="sa-reb-fn">' + FUN.map(([v, r]) => '<option value="' + v + '">' + r + '</option>').join('') + '</select>' +
        '<div class="sa-acoes"><button type="button" class="b pri perigo" id="sa-reb" disabled>Tirar administrador</button></div>') +
      bloco('passar', 'Passar o cargo de admin supremo', 'você continua super admin',
        '<ol class="sa-passos"><li class="on" id="sa-tr-p1"><span>1</span>Escolha a pessoa e peça o código</li><li id="sa-tr-p2"><span>2</span>Digite o código que chegou no seu e-mail</li></ol>' +
        '<label class="sa-rot" for="sa-tr-para">Para quem</label><div class="sa-form"><select class="campo" id="sa-tr-para">' + opcoes('Escolha a pessoa…') + '</select>' +
        '<button type="button" class="b contorno" id="sa-tr-ir" disabled>Enviar código</button></div>' +
        '<div id="sa-tr-cod" hidden><label class="sa-rot" for="sa-tr-c">Código de 6 números</label><div class="sa-form"><input class="campo sa-codigo" id="sa-tr-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">' +
        '<button type="button" class="b pri perigo" id="sa-tr-ok" disabled>Passar o cargo</button></div></div>') + '</div>';
    const q = s => cx.querySelector(s);
    const on = q('#sa-emerg-on');
    if (on) on.onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Ligar a emergência?', texto: 'Todo mundo, menos os super admins, fica travado até você desligar.', rotulo: 'Ligar agora', perigo: true });
      if (!ok) return;
      try { await auth({ acao: 'super_emergencia', ativo: true, mensagem: q('#sa-emerg-msg').value.trim() }); B7.UI.toast('Emergência ligada.'); abrir('supremo'); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    const off = q('#sa-emerg-off');
    if (off) off.onclick = async () => {
      try { await auth({ acao: 'super_emergencia', ativo: false }); B7.UI.toast('Emergência desligada. O sistema volta para todos em até 1 minuto.'); abrir('supremo'); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    q('#sa-reb-quem').onchange = () => { q('#sa-reb').disabled = !q('#sa-reb-quem').value; };
    q('#sa-tr-para').onchange = () => { q('#sa-tr-ir').disabled = !q('#sa-tr-para').value; };
    q('#sa-tr-c').oninput = () => { q('#sa-tr-c').value = q('#sa-tr-c').value.replace(/\D/g, ''); q('#sa-tr-ok').disabled = q('#sa-tr-c').value.length !== 6; };
    q('#sa-reb').onclick = async () => {
      const id = q('#sa-reb-quem').value; if (!id) return B7.UI.toast('Escolha a pessoa.', { tipo: 'erro' });
      const nome = (outros.find(a => a.id === id) || {}).nome;
      const ok = await B7.UI.confirmar({ titulo: 'Tirar o administrador de ' + primeiro(nome) + '?', texto: 'A pessoa sai do B7 agora e, ao entrar de novo, só vê o que a função dela abre.', rotulo: 'Tirar administrador', perigo: true });
      if (!ok) return;
      try { await auth({ acao: 'super_rebaixar', perfil_id: id, funcao: q('#sa-reb-fn').value }); B7.UI.toast(primeiro(nome) + ' não é mais administrador.'); abrir('supremo'); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    q('#sa-tr-ir').onclick = async () => {
      const id = q('#sa-tr-para').value; if (!id) return B7.UI.toast('Escolha para quem.', { tipo: 'erro' });
      try {
        const r = await auth({ acao: 'super_transferir_iniciar', para: id });
        q('#sa-tr-cod').hidden = false; q('#sa-tr-p1').classList.remove('on'); q('#sa-tr-p1').classList.add('feito'); q('#sa-tr-p2').classList.add('on');
        q('#sa-tr-ir').textContent = 'Reenviar código'; q('#sa-tr-c').focus();
        B7.UI.toast('Código enviado para ' + (r.email || 'o seu e-mail') + '.');
      } catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
    q('#sa-tr-ok').onclick = async () => {
      const ok = await B7.UI.confirmar({ titulo: 'Passar o cargo de admin supremo?', texto: 'Você continua super admin, mas quem manda no cargo passa a ser a outra pessoa.', rotulo: 'Passar o cargo', perigo: true });
      if (!ok) return;
      try { await auth({ acao: 'super_transferir_confirmar', codigo: q('#sa-tr-c').value }); B7.UI.toast('Cargo passado. Recarregando…'); setTimeout(() => location.reload(), 1500); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
    };
  }

  return { abrir, ehSuper, nivel };
})();
