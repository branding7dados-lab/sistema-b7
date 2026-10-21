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
    alerta: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17.3v.1"/>'
  };
  const nivel = () => (B7.Auth && B7.Auth.superadmin ? B7.Auth.superadmin() : null);
  const ehSuper = () => !!nivel();
  const quando = iso => iso ? (B7.UI.quando ? B7.UI.quando(iso) : String(iso).slice(0, 10)) : 'nunca';
  const primeiro = n => String(n || '').trim().split(/\s+/)[0];
  const bytes = n => { n = Number(n || 0); return n >= 1e9 ? (n / 1e9).toFixed(2).replace('.', ',') + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.round(n / 1e3) + ' KB'; };
  const auth = corpo => B7.DB.chamarAuth(corpo);
  let aba = 'painel', vez = 0;

  const ABAS = [['painel', 'Painel'], ['aprovacoes', 'Aprovações'], ['limites', 'Limites'], ['seguranca', 'Segurança'], ['uso', 'Uso e backup'], ['avaliacoes', 'Avaliações'], ['supremo', 'Supremo']];
  const ROT_ACAO = {
    alterar_conta: 'alterou o acesso de', criar_usuario: 'criou a conta de', excluir_conta: 'excluiu a conta de', redefinir_senha: 'redefiniu a senha de',
    entrar_como: 'entrou na conta de', salvar_preset: 'mudou o padrão da função', config_alterada: 'mudou a configuração', cliente_para_lixeira: 'mandou para a lixeira o cliente',
    cliente_apagado: 'apagou o cliente', politica_2fa: 'mudou a verificação em 2 etapas', resetar_2fa: 'resetou a verificação em 2 etapas de',
    acesso_pedido_aprovado: 'aprovou acesso de', acesso_pedido_recusado: 'recusou acesso de', funcao_personalizada_salvar: 'salvou a função', funcao_personalizada_excluir: 'excluiu a função',
    super_aprovou: 'aprovou o pedido sobre', super_recusou: 'recusou o pedido sobre', super_derrubar_todos: 'derrubou as sessões', super_derrubar: 'derrubou as sessões de',
    super_rebaixou: 'tirou o administrador de', supremo_transferido: 'passou o cargo de supremo', emergencia_ligada: 'ligou a emergência', emergencia_desligada: 'desligou a emergência',
    acesso_aparelho_novo: 'entrou de um aparelho novo', avatar_definido_por_admin: 'trocou a foto de', meu_perfil: 'editou o próprio perfil'
  };
  const ROT_LIM = {
    acessos: ['Criar contas e mudar acessos', 'função, módulos, administrador, desativar'],
    excluir_conta: ['Excluir contas', ''],
    excluir_cliente: ['Excluir clientes', ''],
    entrar_como: ['Entrar na conta de outra pessoa', 'só livre ou bloqueado'],
    seguranca: ['Mudar a verificação em 2 etapas', 'para quem ela é obrigatória'],
    config_critica: ['Configurações críticas', 'manutenção, IA, recursos e aparência do sistema']
  };

  async function abrir(sub) {
    const minha = ++vez;
    if (B7.Dashboard && B7.Dashboard.marcarNav) B7.Dashboard.marcarNav('#/super');
    if (B7.Rota && B7.Rota.titulo) B7.Rota.titulo(['Super admin']);
    if (!ehSuper()) return B7.Dashboard.semPermissao('super');
    if (sub && ABAS.some(a => a[0] === sub)) aba = sub;
    if (aba === 'supremo' && nivel() !== 'supremo') aba = 'painel';
    painel().innerHTML = '<div class="conteudo entra sa" id="sa">' +
      '<header class="sa-cab"><span class="sa-coroa' + (nivel() === 'supremo' ? ' supremo' : '') + '">' + SVG(IC.coroa) + '</span><div>' +
        '<span class="sa-tag">' + (nivel() === 'supremo' ? 'Admin supremo' : 'Super admin') + '</span><h1>Super admin</h1>' +
        '<p>Acima dos administradores: o que eles fazem, o que precisam pedir, a segurança e o sistema todo.</p></div></header>' +
      '<nav class="sa-abas" role="tablist">' + ABAS.filter(a => a[0] !== 'supremo' || nivel() === 'supremo').map(([k, r]) =>
        '<button role="tab" data-aba="' + k + '" class="' + (aba === k ? 'on' : '') + '">' + r + '<i id="sa-n-' + k + '"></i></button>').join('') + '</nav>' +
      '<div id="sa-corpo">' + B7.UI.skeleton('lista', { n: 4 }) + '</div></div>';
    painel().querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { aba = b.dataset.aba; history.replaceState(null, '', '#/super/' + aba); abrir(aba); });
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
      if (minha === vez) cx.innerHTML = '<div class="cb-aviso erro">' + esc((e && e.message) || 'Não foi possível carregar.') + '</div>';
    }
  }
  async function contarPendentes() {
    try {
      const { count } = await B7.sb.from('super_aprovacoes').select('id', { count: 'exact', head: true }).eq('estado', 'pendente');
      const i = document.getElementById('sa-n-aprovacoes'); if (i) i.textContent = count ? String(count) : '';
    } catch (e) { /* sem contagem */ }
  }
  const kpi = (v, r, cls) => '<div class="sa-kpi ' + (cls || '') + '"><b>' + v + '</b><span>' + r + '</span></div>';
  const av = p => B7.UI.avatarPessoa ? B7.UI.avatarPessoa({ nome: p.nome, avatar_url: p.avatar_url }, 'lu-avatar') : '';

  /* ------------------------------------------------------------ painel */
  async function abaPainel(cx, minha) {
    const d = await B7.DB.rpc('super_painel', {});
    if (minha !== vez) return;
    const semDois = d.admins.filter(a => !a.com_2fa);
    cx.innerHTML = '<div class="sa-kpis">' + kpi(d.admins.length, 'administradores') + kpi(d.aprovacoes_pendentes, 'aprovações esperando', d.aprovacoes_pendentes ? 'alerta' : '') +
        kpi(d.chamados_admin.length, 'chamados de administradores') + kpi(d.alertas.length, 'aparelhos novos (14 dias)', d.alertas.length ? 'alerta' : '') +
        kpi(semDois.length, 'administradores sem 2 etapas', semDois.length ? 'alerta' : 'ok') + kpi(d.paradas.length, 'contas paradas há 60+ dias') + '</div>' +
      '<div class="sa-grade"><section class="sa-bloco"><h2>Administradores</h2>' + d.admins.map(a =>
        '<div class="sa-pessoa">' + av(a) + '<div><b>' + esc(a.nome) + (a.superadmin ? ' <em class="sa-sel ' + a.superadmin + '">' + (a.superadmin === 'supremo' ? 'supremo' : 'super') + '</em>' : '') + '</b>' +
          '<small>último acesso ' + esc(quando(a.ultimo)) + ' · ' + (a.com_2fa ? '2 etapas ligada' : '<span class="sa-ruim">sem 2 etapas</span>') + '</small></div>' +
          ((a.superadmin === 'supremo' && nivel() !== 'supremo') || (B7.Auth.usuario() && a.id === B7.Auth.usuario().id) ? '' : '<button type="button" class="b fina contorno" data-derrubar="' + esc(a.id) + '" data-nome="' + esc(a.nome) + '">Derrubar sessões</button>') + '</div>').join('') + '</section>' +
        '<section class="sa-bloco"><h2>Chamados de administradores <small>só os super admins veem</small></h2>' + (d.chamados_admin.length ? d.chamados_admin.map(c =>
          '<a class="sa-linha" href="#/suporte/' + esc(c.id) + '"><b>#' + c.numero + ' · ' + esc(c.titulo) + '</b><small>' + esc(primeiro(c.nome)) + ' · ' + esc(quando(c.em)) + '</small></a>').join('')
          : '<p class="sa-vazio">Nenhum chamado aberto de administrador.</p>') +
        '<h2 class="sa-h2b">Aparelhos novos <small>administradores, 14 dias</small></h2>' + (d.alertas.length ? d.alertas.map(x =>
          '<div class="sa-linha alerta"><b>' + esc(primeiro(x.nome)) + ' · ' + esc(x.descricao || '') + '</b><small>' + esc(quando(x.em)) + '</small></div>').join('') : '<p class="sa-vazio">Nenhum acesso de aparelho novo.</p>') +
        '<h2 class="sa-h2b">Contas paradas</h2>' + (d.paradas.length ? d.paradas.map(x =>
          '<div class="sa-linha"><b>' + esc(x.nome) + (x.eh_admin ? ' · administrador' : '') + '</b><small>último acesso ' + esc(quando(x.ultimo)) + '</small></div>').join('') : '<p class="sa-vazio">Ninguém parado.</p>') + '</section></div>' +
      '<section class="sa-bloco"><h2>O que aconteceu <small>30 dias · o histórico não pode ser apagado por ninguém</small></h2><div class="sa-feed">' + (d.acoes.length ? d.acoes.map(a =>
        '<div class="sa-ev' + (a.autor_super ? ' de-super' : '') + '"><span class="sa-ev-dot"></span><p><b>' + esc(a.autor_nome || 'Sistema') + '</b> ' + esc(ROT_ACAO[a.acao] || a.acao) +
          (a.alvo_nome ? ' <b>' + esc(a.alvo_nome) + '</b>' : '') + '</p><time>' + esc(quando(a.created_at)) + '</time></div>').join('') : '<p class="sa-vazio">Nada registrado.</p>') + '</div></section>';
    cx.querySelectorAll('[data-derrubar]').forEach(b => b.onclick = () => derrubar(b.dataset.derrubar, b.dataset.nome));
  }
  async function derrubar(id, nome) {
    const ok = await B7.UI.confirmar({ titulo: 'Derrubar as sessões de ' + primeiro(nome) + '?', texto: 'Todos os aparelhos dessa conta saem do B7 e precisam entrar de novo com a senha.', rotulo: 'Derrubar sessões', perigo: true });
    if (!ok) return;
    try { await auth({ acao: 'super_derrubar', perfil_id: id }); B7.UI.toast('Sessões derrubadas.'); }
    catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
  }

  /* -------------------------------------------------------- aprovações */
  async function abaAprovacoes(cx, minha) {
    const { data, error } = await B7.sb.from('super_aprovacoes').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    if (minha !== vez) return;
    const ids = [...new Set((data || []).flatMap(a => [a.pedido_por, a.decidido_por]).filter(Boolean))];
    let nomes = {};
    if (ids.length) { const { data: ps } = await B7.sb.from('perfis').select('id, nome').in('id', ids); (ps || []).forEach(p => { nomes[p.id] = p.nome; }); }
    const pend = (data || []).filter(a => a.estado === 'pendente'), resto = (data || []).filter(a => a.estado !== 'pendente');
    const ROT_EST = { aprovado: 'aprovado', recusado: 'recusado', executado: 'feito', falhou: 'falhou' };
    cx.innerHTML = '<section class="sa-bloco"><h2>Esperando você <small>' + pend.length + '</small></h2>' + (pend.length ? pend.map(a =>
        '<div class="sa-pedido" data-id="' + esc(a.id) + '"><div><b>' + esc(a.resumo || a.acao) + '</b><small>pedido por ' + esc(nomes[a.pedido_por] || 'alguém') + ' · ' + esc(quando(a.created_at)) + '</small>' +
          (a.motivo ? '<q>' + esc(a.motivo) + '</q>' : '') + '</div><div class="sa-pedido-bts"><button type="button" class="b fina contorno" data-nao>Recusar</button><button type="button" class="b fina pri" data-sim>Aprovar</button></div></div>').join('')
        : '<p class="sa-vazio">' + SVG(IC.ok) + ' Nada esperando aprovação.</p>') + '</section>' +
      '<section class="sa-bloco"><h2>Decididos</h2>' + (resto.length ? resto.map(a =>
        '<div class="sa-linha"><b>' + esc(a.resumo || a.acao) + '</b><small>' + esc(ROT_EST[a.estado] || a.estado) + ' por ' + esc(nomes[a.decidido_por] || '—') + ' · ' + esc(quando(a.decidido_em)) +
          (a.resposta ? ' · "' + esc(a.resposta) + '"' : '') + '</small></div>').join('') : '<p class="sa-vazio">Nenhum ainda.</p>') + '</section>';
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
      cx.innerHTML = '<section class="sa-bloco"><h2>O que um administrador comum pode fazer <small>super admin é sempre livre</small></h2>' +
        Object.keys(ROT_LIM).map(k => '<div class="sa-lim"><div><b>' + ROT_LIM[k][0] + '</b><small>' + ROT_LIM[k][1] + '</small></div><div class="sa-seg">' +
          OPC.filter(o => !(k === 'entrar_como' && o[0] === 'aprovacao')).map(([v, r]) => '<button type="button" data-k="' + k + '" data-v="' + v + '" class="' + (rasc[k] === v ? 'on v-' + v : '') + '">' + r + '</button>').join('') + '</div></div>').join('') +
        '<p class="sa-nota">"Pede aprovação": a ação do administrador vira um pedido na aba Aprovações e só acontece quando um super admin aprova. Vale no servidor, não só na tela.</p>' +
        '<div class="sa-acoes"><button type="button" class="b pri" id="sa-lim-salvar"' + (JSON.stringify(rasc) === JSON.stringify(lim) ? ' disabled' : '') + '>Salvar limites</button></div></section>';
      cx.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { rasc[b.dataset.k] = b.dataset.v; pinta(); });
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
    cx.innerHTML = '<section class="sa-bloco"><h2>Verificação em 2 etapas dos administradores <small>obrigatória para todo administrador</small></h2>' +
        d.admins.map(a => '<div class="sa-pessoa">' + av(a) + '<div><b>' + esc(a.nome) + '</b><small>' + (a.com_2fa ? 'ligada' : 'ainda não ligou: o B7 pede para ligar no próximo acesso') + '</small></div>' +
          '<span class="sa-sinal ' + (a.com_2fa ? 'ok' : 'ruim') + '">' + SVG(a.com_2fa ? IC.ok : IC.alerta) + '</span></div>').join('') + '</section>' +
      '<section class="sa-bloco sa-perigo"><h2>Derrubar todas as sessões</h2><p>Todo mundo (menos você) sai do B7 na hora e precisa entrar de novo com a senha. Use se uma senha vazou ou se algo estranho aconteceu.</p>' +
        '<button type="button" class="b perigo" id="sa-derrubar-todos">Derrubar todas as sessões</button></section>' +
      '<section class="sa-bloco"><h2>Alertas de aparelho novo</h2><p class="sa-nota">Quando um administrador entra de um aparelho ou de uma rede que ainda não tinha usado, os super admins recebem aviso no sino.</p>' +
        (d.alertas.length ? d.alertas.map(x => '<div class="sa-linha alerta"><b>' + esc(primeiro(x.nome)) + ' · ' + esc(x.descricao || '') + '</b><small>' + esc(quando(x.em)) + '</small></div>').join('') : '<p class="sa-vazio">Nenhum nos últimos 14 dias.</p>') + '</section>';
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
    const barra = (v, max, rot) => { const p = Math.min(100, Math.round((v / max) * 100)); return '<div class="sa-uso"><div class="sa-uso-cab"><b>' + rot + '</b><span>' + bytes(v) + ' de ' + bytes(max) + ' · ' + p + '%</span></div><div class="sa-uso-barra"><i style="width:' + p + '%" class="' + (p > 80 ? 'alto' : p > 60 ? 'medio' : '') + '"></i></div></div>'; };
    const arq = (u.arquivos || []).reduce((s, x) => s + Number(x.bytes || 0), 0);
    const credito = br && br.plano ? br.plano.find(p => p.tipo === 'free' || p.creditos != null) : null;
    cx.innerHTML = '<section class="sa-bloco"><h2>Espaço <small>limites do plano gratuito do Supabase</small></h2>' +
        barra(u.banco_bytes, 500e6, 'Banco de dados') + barra(arq, 1e9, 'Arquivos') +
        '<div class="sa-arq">' + (u.arquivos || []).map(x => '<span>' + esc(x.pasta) + ' · ' + bytes(x.bytes) + ' · ' + x.n + ' arquivos</span>').join('') + '</div></section>' +
      '<div class="sa-kpis">' + kpi(u.ia_30d.pedidos, 'pedidos à IA (30 dias)') + kpi(u.ia_hoje, 'pedidos à IA hoje') + kpi(u.ia_30d.erros, 'pedidos com erro', u.ia_30d.erros ? 'alerta' : '') +
        kpi(Math.round(Number(u.ia_30d.tokens || 0) / 1000) + ' mil', 'tokens da IA (30 dias)') + kpi(u.avisos_30d, 'avisos enviados (30 dias)') + kpi(u.contas_ativas, 'contas ativas') + '</div>' +
      '<section class="sa-bloco"><h2>E-mails (Brevo)</h2>' + (!br ? '<p class="sa-vazio">Não deu para consultar a Brevo agora.</p>' : !br.configurado ? '<p class="sa-vazio">O envio de e-mail não está configurado.</p>' :
          '<p>' + (credito ? 'Plano <b>' + esc(credito.tipo) + '</b>: <b>' + esc(String(credito.creditos)) + '</b> e-mails restantes' + (credito.tipo === 'free' ? ' hoje (300 por dia no gratuito)' : '') : 'Conta conectada.') + '</p>') + '</section>' +
      '<section class="sa-bloco"><h2>IA por área <small>30 dias</small></h2><div class="sa-arq">' + Object.entries(u.ia_por_recurso || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => '<span>' + esc(k) + ' · ' + n + '</span>').join('') + '</div></section>' +
      '<section class="sa-bloco"><h2>Backup completo</h2><p>Um arquivo com clientes, gravações, roteiros e cenas. O banco continua sendo o Supabase: isto é segurança extra. Só super admin baixa.</p>' +
        '<button type="button" class="b pri" id="sa-backup">Baixar backup</button></section>';
    cx.querySelector('#sa-backup').onclick = () => { if (B7.Backup && B7.Backup.exportar) B7.Backup.exportar(); };
  }

  /* ---------------------------------------------------------- avaliações */
  async function abaAvaliacoes(cx, minha) {
    const [eq, ia] = await Promise.all([B7.DB.rpc('super_avaliacoes_equipe', { p_dias: 90 }), B7.DB.rpc('suporte_atendimento_resumo', { p_dias: 90 })]);
    if (minha !== vez) return;
    const est = n => '★★★★★'.slice(0, Math.round(n)) + '<span class="apagada">' + '★★★★★'.slice(Math.round(n)) + '</span>';
    cx.innerHTML = '<div class="sa-kpis">' + kpi(ia.nota_ia == null ? '—' : String(ia.nota_ia).replace('.', ','), 'nota do assistente (' + ia.n_ia + ')') +
        kpi(ia.nota_equipe == null ? '—' : String(ia.nota_equipe).replace('.', ','), 'nota da equipe (' + ia.n_equipe + ')') + kpi(ia.resolvidos_ia + ' de ' + ia.com_ia, 'resolvidos pelo assistente') + '</div>' +
      '<section class="sa-bloco"><h2>Quem atendeu <small>90 dias · a nota vai para quem deu a última resposta</small></h2>' + (eq.length ? eq.map(p =>
        '<details class="sa-aval"><summary><span class="sa-estrelas">' + est(p.media) + '</span><b>' + esc(p.nome) + '</b><small>' + String(p.media).replace('.', ',') + ' · ' + p.n + (p.n === 1 ? ' avaliação' : ' avaliações') + '</small></summary>' +
          (p.ultimas || []).slice(0, 8).map(x => '<div class="sa-linha"><b>#' + x.numero + ' · ' + esc(x.titulo) + ' · ' + x.nota + '/5</b>' + (x.comentario ? '<small>"' + esc(x.comentario) + '"</small>' : '') + '</div>').join('') + '</details>').join('')
        : '<p class="sa-vazio">Ainda não há avaliações de atendimentos da equipe.</p>') + '</section>';
  }

  /* ------------------------------------------------------------- supremo */
  async function abaSupremo(cx, minha) {
    const [d, man] = await Promise.all([B7.DB.rpc('super_painel', {}), B7.sb.from('sistema_config').select('valor').eq('chave', 'manutencao').maybeSingle()]);
    if (minha !== vez) return;
    const emerg = !!(man && man.data && man.data.valor && man.data.valor.ativo && man.data.valor.emergencia);
    const outros = d.admins.filter(a => a.superadmin !== 'supremo');
    const FUN = [['coordenador', 'Coordenador'], ['designer', 'Designer'], ['videomaker', 'Videomaker']];
    cx.innerHTML = '<section class="sa-bloco sa-perigo"><h2>Emergência</h2><p>' + (emerg ? '<b>Ligada:</b> o sistema está travado para todos, menos os super admins.' :
          'Trava o sistema na hora para todo mundo (equipe, administradores e clientes), menos os super admins. Use em caso de invasão, vazamento ou erro grave.') + '</p>' +
        (emerg ? '<button type="button" class="b pri" id="sa-emerg-off">Desligar a emergência</button>' :
          '<input class="campo" id="sa-emerg-msg" maxlength="300" placeholder="Mensagem que aparece para todos (opcional)"><button type="button" class="b perigo" id="sa-emerg-on">Ligar a emergência</button>') + '</section>' +
      '<section class="sa-bloco"><h2>Tirar o administrador de alguém</h2><p>A pessoa deixa de ser administrador (e super admin), sai do B7 e passa a ter só a função escolhida.</p>' +
        '<div class="sa-form"><select class="campo" id="sa-reb-quem"><option value="">Quem…</option>' + outros.map(a => '<option value="' + esc(a.id) + '">' + esc(a.nome) + '</option>').join('') + '</select>' +
        '<select class="campo" id="sa-reb-fn">' + FUN.map(([v, r]) => '<option value="' + v + '">passa a ser ' + r + '</option>').join('') + '</select>' +
        '<button type="button" class="b perigo" id="sa-reb">Tirar administrador</button></div></section>' +
      '<section class="sa-bloco"><h2>Passar o cargo de admin supremo</h2><p>Você vira super admin e a pessoa escolhida vira o admin supremo. Um código vai para o seu e-mail da verificação em 2 etapas para confirmar.</p>' +
        '<div class="sa-form"><select class="campo" id="sa-tr-para"><option value="">Para quem…</option>' + outros.map(a => '<option value="' + esc(a.id) + '">' + esc(a.nome) + '</option>').join('') + '</select>' +
        '<button type="button" class="b contorno" id="sa-tr-ir">Enviar código</button></div>' +
        '<div class="sa-form" id="sa-tr-cod" hidden><input class="campo" id="sa-tr-c" inputmode="numeric" maxlength="6" placeholder="Código de 6 números"><button type="button" class="b perigo" id="sa-tr-ok">Confirmar e passar o cargo</button></div></section>';
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
      try { const r = await auth({ acao: 'super_transferir_iniciar', para: id }); q('#sa-tr-cod').hidden = false; q('#sa-tr-c').focus(); B7.UI.toast('Código enviado para ' + (r.email || 'o seu e-mail') + '.'); }
      catch (e) { B7.UI.toast((e && e.message) || 'Não foi possível.', { tipo: 'erro' }); }
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
