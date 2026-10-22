/* =====================================================================
   EQUIPE (zzz247) — agenda da equipe e recado fixo

   Kevin: "quero nas configurações tudo que eu posso setar, mudar,
   editar, excluir… tudo que envolva a equipe, quero novas opções para
   a equipe tb. me surpreenda!"

   • Ausências (equipe_ausencias): férias, folga, atestado, viagem. Quem
     está fora aparece nas Configurações, no cartão da pessoa em Pessoas e
     acessos e na sugestão de redistribuição (para não passar trabalho a
     quem está de férias). Tirar uma ausência não apaga: marca cancelado_em.
   • Aniversários (equipe_aniversarios): dia e mês. No dia, quem abre o B7
     vê um cartão de parabéns com "Mandar parabéns" (abre a conversa); o
     aniversariante vê um cartão só dele.
   • Recado fixo (sistema_config 'recado', via equipe_recado_definir): uma
     frase da administração no alto da tela de toda a equipe, até a data
     escolhida. Cada pessoa fecha o dela.

   Só o administrador muda (o banco confere); a equipe interna lê.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Equipe = (function () {
  const esc = s => B7.UI.esc(s);
  const sb = () => B7.sb;
  const SVG = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    bolo: SVG('<path d="M4 20h16M5 20v-6.5A2.5 2.5 0 0 1 7.5 11h9a2.5 2.5 0 0 1 2.5 2.5V20"/><path d="M5 15.5c1.2 0 1.8-1 3-1s1.8 1 3 1 1.8-1 3-1 1.8 1 3 1 1.4-.6 2-.8"/><path d="M12 11V8M12 5.2c.6-.6.9-1.2.9-1.7"/>'),
    recado: SVG('<path d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5H8l6 4V4L8 8H5.5A1.5 1.5 0 0 0 4 9.5z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>'),
    x: SVG('<path d="M6 6l12 12M18 6L6 18"/>')
  };
  const TIPOS = { ferias: 'Férias', folga: 'Folga', atestado: 'Atestado', viagem: 'Viagem', outro: 'Fora' };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  let cache = { aus: [], ani: [], pessoas: [], em: 0 };
  const hoje = () => B7.UI.hojeISO();
  const dm = iso => { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; };
  const ehAdm = () => !!(B7.Auth && B7.Auth.ehAdminReal && B7.Auth.ehAdminReal());
  const nomeDe = id => { const p = cache.pessoas.find(x => x.id === id); return p ? p.nome : 'Alguém'; };
  const pessoaDe = id => cache.pessoas.find(x => x.id === id) || { id, nome: 'Alguém' };
  const av = p => B7.UI.avatarPessoa ? B7.UI.avatarPessoa(p, 'eq-av') : '';

  async function carregar(forcar) {
    if (!forcar && Date.now() - cache.em < 60000) return cache;
    const [a, n, p] = await Promise.all([
      sb().from('equipe_ausencias').select('id, perfil_id, tipo, inicio, fim, nota').is('cancelado_em', null).gte('fim', hoje()).order('inicio'),
      sb().from('equipe_aniversarios').select('perfil_id, dia, mes').not('dia', 'is', null),
      sb().from('perfis').select('id, nome, username, avatar_url, papel, estado').neq('papel', 'cliente').eq('estado', 'ativa').order('nome')
    ]);
    if (a.error) throw a.error;
    cache = { aus: a.data || [], ani: (n.data || []), pessoas: p.data || [], em: Date.now() };
    return cache;
  }

  /* ausência valendo hoje para a pessoa (ou null) — síncrono, do cache */
  function ausenciaDe(id) {
    const h = hoje();
    return cache.aus.find(x => x.perfil_id === id && x.inicio <= h && x.fim >= h) || null;
  }
  const rotuloAusencia = x => (TIPOS[x.tipo] || 'Fora') + ' até ' + dm(x.fim);

  /* dias até o próximo aniversário (0 = hoje) */
  function diasAte(dia, mes) {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    let d = new Date(h.getFullYear(), mes - 1, dia);
    if (d < h) d = new Date(h.getFullYear() + 1, mes - 1, dia);
    return Math.round((d - h) / 864e5);
  }

  /* ================================================ CONFIGURAÇÕES */
  const linha = (dentro, acoes) => '<div class="cfg-l eq-l">' + dentro + (acoes || '') + '</div>';
  const botao = (rot, attrs, cls) => '<button type="button" class="b fina contorno eq-bt' + (cls ? ' ' + cls : '') + '"' + attrs + '>' + rot + '</button>';

  async function montar(alvo) {
    if (!alvo) return;
    alvo.innerHTML = B7.UI.skeleton('lista', { n: 4 });
    try { await carregar(true); }
    catch (e) { alvo.innerHTML = '<p class="cfg-g-nota">Não foi possível carregar a agenda da equipe. ' + esc((e && e.message) || '') + '</p>'; return; }
    if (!alvo.isConnected) return;
    const h = hoje();
    const agora = cache.aus.filter(x => x.inicio <= h), depois = cache.aus.filter(x => x.inicio > h);
    const linhaAus = x => linha(av(pessoaDe(x.perfil_id)) +
      '<span class="cfg-l-tx"><b>' + esc(nomeDe(x.perfil_id)) + ' <em class="eq-tipo eq-' + esc(x.tipo) + '">' + esc(TIPOS[x.tipo] || 'Fora') + '</em></b>' +
        '<small>' + (x.inicio === x.fim ? 'dia ' + dm(x.inicio) : dm(x.inicio) + ' a ' + dm(x.fim)) + (x.nota ? ' · ' + esc(x.nota) : '') + '</small></span>',
      ehAdm() ? botao('Tirar', ' data-eq-tirar="' + esc(x.id) + '"') : '');
    const aniv = cache.pessoas.map(p => {
      const a = cache.ani.find(x => x.perfil_id === p.id);
      return { p, a, dias: a ? diasAte(a.dia, a.mes) : null };
    }).sort((x, y) => (x.dias === null) - (y.dias === null) || (x.dias || 0) - (y.dias || 0) || String(x.p.nome).localeCompare(y.p.nome));
    const quando = d => d === 0 ? 'é hoje!' : d === 1 ? 'amanhã' : 'em ' + d + ' dias';

    alvo.innerHTML =
      '<section class="cfg-g"><h2 class="cfg-g-t">Quem está fora</h2>' +
        '<p class="cfg-g-nota">Férias, folgas e atestados. Aparece no cartão da pessoa e a redistribuição avisa antes de passar trabalho para ela.</p>' +
        '<div class="cfg-lista">' +
          (agora.length ? agora.map(linhaAus).join('') : linha('<span class="cfg-l-tx"><b>Todo mundo por aqui hoje</b><small>ninguém de férias, folga ou atestado</small></span>')) +
          (ehAdm() ? '<button type="button" class="cfg-l eq-novo" data-eq-nova><span class="cfg-l-tx"><b>Marcar uma ausência</b><small>férias, folga, atestado ou viagem</small></span><span class="cfg-acao" aria-hidden="true">Marcar</span></button>' : '') +
        '</div>' +
        (depois.length ? '<h3 class="eq-sub">Próximas</h3><div class="cfg-lista">' + depois.map(linhaAus).join('') + '</div>' : '') +
      '</section>' +
      '<section class="cfg-g"><h2 class="cfg-g-t">Aniversários</h2>' +
        '<p class="cfg-g-nota">No dia, quem abrir o B7 vê um cartão para mandar os parabéns, e o aniversariante ganha um cartão só dele. Só dia e mês: a idade não aparece.</p>' +
        '<div class="cfg-lista">' + aniv.map(({ p, a, dias }) => linha(av(p) +
          '<span class="cfg-l-tx"><b>' + esc(p.nome) + (dias === 0 ? ' <em class="eq-tipo eq-festa">hoje</em>' : '') + '</b>' +
            '<small>' + (a ? a.dia + ' de ' + MESES[a.mes - 1] + ' · ' + quando(dias) : 'sem data') + '</small></span>',
          ehAdm() ? botao(a ? 'Mudar' : 'Definir', ' data-eq-aniv="' + esc(p.id) + '"') : '')).join('') +
        '</div></section>';

    alvo.querySelectorAll('[data-eq-tirar]').forEach(b => b.onclick = () => tirarAusencia(b.dataset.eqTirar, () => montar(alvo)));
    const nova = alvo.querySelector('[data-eq-nova]'); if (nova) nova.onclick = () => modalAusencia(() => montar(alvo));
    alvo.querySelectorAll('[data-eq-aniv]').forEach(b => b.onclick = () => modalAniversario(b.dataset.eqAniv, () => montar(alvo)));
  }

  function modalAusencia(depois) {
    const h = hoje();
    const m = B7.UI.modal('<h3>Marcar uma ausência</h3>' +
      '<p class="sub">A pessoa continua com acesso normal. Serve para a equipe saber quem está fora e para não passar trabalho a ela.</p>' +
      '<div class="mb"><label class="rot" for="eq-pessoa">QUEM</label><select class="campo" id="eq-pessoa">' +
        cache.pessoas.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>').join('') + '</select></div>' +
      '<div class="mb"><label class="rot" for="eq-tipo">O QUE</label><select class="campo" id="eq-tipo">' +
        Object.keys(TIPOS).map(k => '<option value="' + k + '">' + TIPOS[k] + '</option>').join('') + '</select></div>' +
      '<div class="eq-datas"><div class="mb"><label class="rot" for="eq-ini">DE</label><input class="campo" type="date" id="eq-ini" value="' + h + '"></div>' +
        '<div class="mb"><label class="rot" for="eq-fim">ATÉ (INCLUSIVE)</label><input class="campo" type="date" id="eq-fim" value="' + h + '"></div></div>' +
      '<div class="mb"><label class="rot" for="eq-nota">OBSERVAÇÃO <span class="leve">— opcional, a equipe vê</span></label><input class="campo" id="eq-nota" maxlength="200" placeholder="ex.: volta na segunda; Fulano cobre os vídeos"></div>' +
      '<p class="perfil-msg" id="eq-msg" role="status"></p>' +
      '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="eq-salvar">Marcar</button></div>');
    const ini = m.querySelector('#eq-ini'), fim = m.querySelector('#eq-fim'), msg = m.querySelector('#eq-msg');
    ini.onchange = () => { if (fim.value < ini.value) fim.value = ini.value; };
    m.querySelector('#eq-salvar').onclick = async () => {
      const bt = m.querySelector('#eq-salvar');
      if (!ini.value || !fim.value || fim.value < ini.value) { msg.className = 'perfil-msg erro'; msg.textContent = 'Confira as datas.'; return; }
      bt.disabled = true;
      const { error } = await sb().from('equipe_ausencias').insert({
        perfil_id: m.querySelector('#eq-pessoa').value, tipo: m.querySelector('#eq-tipo').value,
        inicio: ini.value, fim: fim.value, nota: m.querySelector('#eq-nota').value.trim() || null });
      if (error) { bt.disabled = false; msg.className = 'perfil-msg erro'; msg.textContent = error.message || 'Não foi possível salvar.'; return; }
      m.fechar(); B7.UI.toast('Ausência marcada.'); cache.em = 0; if (depois) depois();
    };
  }

  async function tirarAusencia(id, depois) {
    const x = cache.aus.find(a => a.id === id);
    const ok = await B7.UI.confirmar({ titulo: 'Tirar esta ausência?', texto: x ? nomeDe(x.perfil_id) + ' volta a aparecer como disponível. O registro fica guardado.' : '', rotulo: 'Tirar' });
    if (!ok) return;
    const { error } = await sb().from('equipe_ausencias').update({ cancelado_em: new Date().toISOString() }).eq('id', id);
    if (error) return B7.UI.toast(error.message || 'Não foi possível.', { tipo: 'erro' });
    B7.UI.toast('Ausência tirada.'); cache.em = 0; if (depois) depois();
  }

  function modalAniversario(id, depois) {
    const a = cache.ani.find(x => x.perfil_id === id);
    const m = B7.UI.modal('<h3>Aniversário de ' + esc(nomeDe(id)) + '</h3>' +
      '<p class="sub">Só dia e mês. No dia, a equipe vê um cartão para mandar os parabéns.</p>' +
      '<div class="eq-datas"><div class="mb"><label class="rot" for="eq-dia">DIA</label><select class="campo" id="eq-dia">' +
        Array.from({ length: 31 }, (_, i) => '<option' + (a && a.dia === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>').join('') + '</select></div>' +
      '<div class="mb"><label class="rot" for="eq-mes">MÊS</label><select class="campo" id="eq-mes">' +
        MESES.map((n, i) => '<option value="' + (i + 1) + '"' + (a && a.mes === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div></div>' +
      '<p class="perfil-msg" id="eq-msg" role="status"></p>' +
      '<div class="acoes">' + (a ? '<button type="button" class="b contorno perigo" id="eq-tirar">Tirar a data</button>' : '') +
        '<div style="flex:1"></div><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="eq-salvar">Salvar</button></div>');
    const gravar = async (dia, mes) => {
      const { error } = await sb().from('equipe_aniversarios').upsert({ perfil_id: id, dia, mes, atualizado_em: new Date().toISOString() });
      if (error) { const msg = m.querySelector('#eq-msg'); msg.className = 'perfil-msg erro'; msg.textContent = error.message || 'Não foi possível salvar.'; return; }
      m.fechar(); B7.UI.toast(dia ? 'Aniversário salvo.' : 'Data tirada.'); cache.em = 0; if (depois) depois();
    };
    m.querySelector('#eq-salvar').onclick = () => {
      const dia = +m.querySelector('#eq-dia').value, mes = +m.querySelector('#eq-mes').value;
      if (dia > new Date(2024, mes, 0).getDate()) { const msg = m.querySelector('#eq-msg'); msg.className = 'perfil-msg erro'; msg.textContent = 'Esse dia não existe nesse mês.'; return; }
      gravar(dia, mes);
    };
    const t = m.querySelector('#eq-tirar'); if (t) t.onclick = () => gravar(null, null);
  }

  /* ---------------------------------------------- recado fixo (admin) */
  async function lerRecado() {
    const { data } = await sb().from('sistema_config').select('valor').eq('chave', 'recado').maybeSingle();
    const r = data && data.valor;
    return r && r.ativo && r.ate >= hoje() ? r : null;
  }
  async function modalRecado(depois) {
    let atual = null; try { atual = await lerRecado(); } catch (e) {}
    const ate = new Date(); ate.setDate(ate.getDate() + 7);
    const ateISO = atual ? atual.ate : ate.toISOString().slice(0, 10);
    const m = B7.UI.modal('<h3>Recado para a equipe</h3>' +
      '<p class="sub">Uma frase sua no alto da tela de todo mundo da equipe (clientes não veem), até a data que você escolher. Cada pessoa pode fechar o dela.</p>' +
      '<div class="mb"><label class="rot" for="eq-rec">RECADO</label><textarea class="campo" id="eq-rec" rows="3" maxlength="280" placeholder="ex.: Sexta tem gravação externa na Arena: todo mundo às 8h na agência.">' + esc(atual ? atual.texto : '') + '</textarea>' +
        '<small class="ajuda" id="eq-conta"></small></div>' +
      '<div class="eq-datas"><div class="mb"><label class="rot" for="eq-ate">FICA NO AR ATÉ</label><input class="campo" type="date" id="eq-ate" value="' + esc(ateISO) + '" min="' + hoje() + '"></div>' +
        '<div class="mb"><label class="rot" for="eq-tom">ESTILO</label><select class="campo" id="eq-tom">' +
          [['marca', 'Cores da B7'], ['aviso', 'Atenção (amarelo)'], ['festa', 'Comemoração']].map(([v, r]) => '<option value="' + v + '"' + (atual && atual.tom === v ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select></div></div>' +
      '<p class="perfil-msg" id="eq-msg" role="status"></p>' +
      '<div class="acoes">' + (atual ? '<button type="button" class="b contorno perigo" id="eq-tirar">Tirar do ar</button>' : '') +
        '<div style="flex:1"></div><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="eq-salvar">' + (atual ? 'Atualizar' : 'Publicar') + '</button></div>');
    const ta = m.querySelector('#eq-rec'), conta = m.querySelector('#eq-conta'), msg = m.querySelector('#eq-msg');
    const contar = () => { conta.textContent = ta.value.length + ' de 280'; }; contar(); ta.oninput = contar;
    const enviar = async (texto, ate2, tom) => {
      try { await B7.DB.rpc('equipe_recado_definir', { p_texto: texto, p_ate: ate2, p_tom: tom }); }
      catch (e) { msg.className = 'perfil-msg erro'; msg.textContent = (e && e.message) || 'Não foi possível.'; return; }
      m.fechar(); B7.UI.toast(texto ? 'Recado publicado para a equipe.' : 'Recado tirado do ar.');
      recadoMostrado = null; mostrarRecado(true); if (depois) depois();
    };
    m.querySelector('#eq-salvar').onclick = () => {
      if (!ta.value.trim()) { msg.className = 'perfil-msg erro'; msg.textContent = 'Escreva o recado.'; return; }
      enviar(ta.value.trim(), m.querySelector('#eq-ate').value, m.querySelector('#eq-tom').value);
    };
    const t = m.querySelector('#eq-tirar'); if (t) t.onclick = () => enviar(null, null, null);
  }
  async function resumoRecado() {
    try { const r = await lerRecado(); return r ? '“' + r.texto.slice(0, 60) + (r.texto.length > 60 ? '…' : '') + '” · até ' + dm(r.ate) : 'nenhum recado no ar'; }
    catch (e) { return 'nenhum recado no ar'; }
  }

  /* ---------------------------------------------- exportar a equipe */
  async function exportarCSV() {
    let d;
    try { d = await B7.DB.chamarAuth({ acao: 'listar_usuarios' }); }
    catch (e) { return B7.UI.toast((e && e.message) || 'Não foi possível ler a equipe.', { tipo: 'erro' }); }
    try { await carregar(); } catch (e) {}
    const us = (d.usuarios || []).filter(u => u.papel !== 'cliente');
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const linhas = [['Nome', 'Usuário', 'Papel', 'Função', 'Administrador', 'Situação', 'Último acesso', 'Aniversário', 'Ausência agora']].concat(us.map(u => {
      const a = cache.ani.find(x => x.perfil_id === u.id), f = ausenciaDe(u.id);
      return [u.nome, '@' + (u.username || ''), u.papel, u.funcao || '', u.eh_admin || u.papel === 'admin' ? 'sim' : 'não',
        u.estado === 'ativa' ? 'ativa' : 'desativada', u.ultimo_acesso ? String(u.ultimo_acesso).slice(0, 10) : '',
        a ? String(a.dia).padStart(2, '0') + '/' + String(a.mes).padStart(2, '0') : '', f ? rotuloAusencia(f) : ''];
    }));
    const csv = '﻿' + linhas.map(l => l.map(q).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'equipe-b7-' + hoje() + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    B7.UI.toast('Lista da equipe baixada (' + us.length + (us.length === 1 ? ' pessoa' : ' pessoas') + ').');
  }

  /* ================================================ PASSAR O TRABALHO
     zzz248: quando alguém sai (ou vai ficar fora muito tempo), o que está
     com a pessoa passa para outras: peças de design, demandas de vídeo,
     gravações marcadas e cards da Produção. Nada é apagado — só muda o
     responsável; cada item guarda no histórico que veio de um repasse, e
     quem recebe ganha UM aviso com o total (saida_transferir). */
  const AREAS = [
    ['design', 'Design', 'peça em aberto', 'peças em aberto', 'design'],
    ['video', 'Edição de vídeo', 'demanda em aberto', 'demandas em aberto', 'video'],
    ['gravacoes', 'Gravações marcadas', 'gravação', 'gravações', 'video'],
    ['kanban', 'Produção', 'card em aberto', 'cards em aberto', 'equipe']
  ];
  const ROT_STATUS = { aguardando_producao: 'aguardando', em_criacao: 'em criação', pendente: 'pendente', em_edicao: 'em edição', aguardando_aprovacao: 'com o cliente' };
  async function temTrabalho(id) {
    const r = await B7.DB.rpc('saida_resumo', { p_perfil: id });
    return AREAS.reduce((n, a) => n + (r[a[0]] || []).length, 0);
  }
  async function repasse(pessoa, op) {
    op = op || {};
    const m = B7.UI.modal('<h3>Passar o trabalho de ' + esc(String(pessoa.nome || '').split(' ')[0] || 'alguém') + '</h3>' +
      '<p class="sub">Tudo o que está em aberto com ' + esc(pessoa.nome || 'a pessoa') + ' passa para quem você escolher. Nada é apagado: só muda o responsável, ' +
        'o histórico de cada item registra o repasse e quem recebe ganha um aviso com o total.</p>' +
      '<div class="rp-corpo" id="rp-corpo">' + B7.UI.skeleton('lista', { n: 3 }) + '</div>' +
      '<p class="perfil-msg" id="rp-msg" role="status"></p>' +
      '<div class="acoes rp-acoes"><label class="rp-desativar"><input type="checkbox" id="rp-desat"' + (op.desativar ? ' checked' : '') + '> Desativar a conta no fim</label>' +
        '<div style="flex:1"></div><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="rp-ok" disabled>Passar</button></div>',
      { larga: true, extra: 'rp-modal' });
    const corpo = m.querySelector('#rp-corpo'), ok = m.querySelector('#rp-ok'), msg = m.querySelector('#rp-msg'), desat = m.querySelector('#rp-desat');
    let r;
    try { r = await B7.DB.rpc('saida_resumo', { p_perfil: pessoa.id }); }
    catch (e) { corpo.innerHTML = '<p class="cfg-g-nota">' + esc((e && e.message) || 'Não foi possível ler o trabalho da pessoa.') + '</p>'; return; }
    try { await carregar(); } catch (e) {}
    if (!corpo.isConnected) return;
    const cand = { design: r.candidatos.design || [], video: r.candidatos.video || [], equipe: r.candidatos.equipe || [] };
    const com = AREAS.filter(a => (r[a[0]] || []).length);
    const fora = id => ausenciaDe(id);
    const opcoes = (lista, area) => {
      /* sugere quem está com menos trabalho e não está de férias */
      const boa = lista.find(c => !fora(c.id)) || lista[0];
      return '<option value="">Não passar (fica com ' + esc(String(pessoa.nome || '').split(' ')[0]) + ')</option>' +
        lista.map(c => '<option value="' + esc(c.id) + '"' + (boa && c.id === boa.id ? ' selected' : '') + '>' + esc(c.nome) +
          (c.abertas != null ? ' · ' + c.abertas + ' em aberto' : '') + (fora(c.id) ? ' · fora' : '') + '</option>').join('');
    };
    corpo.innerHTML = com.length ? com.map(([k, rot, um, varios, tipoCand]) => {
      const itens = r[k], lista = tipoCand === 'equipe' ? cand.equipe : cand[tipoCand];
      return '<section class="rp-area" data-area="' + k + '">' +
        '<header><div><b>' + rot + '</b><small>' + itens.length + ' ' + (itens.length === 1 ? um : varios) + '</small></div>' +
          (lista.length ? '<select class="campo fina" data-para="' + k + '" aria-label="Passar ' + rot + ' para">' + opcoes(lista, k) + '</select>'
            : '<span class="rp-sem">ninguém da equipe pode receber</span>') + '</header>' +
        '<details><summary>Ver ' + (itens.length === 1 ? 'o item' : 'os ' + itens.length + ' itens') + ' e escolher</summary>' +
          '<label class="rp-todos"><input type="checkbox" data-todos checked> Todos</label>' +
          itens.map(x => '<label class="rp-item"><input type="checkbox" data-item="' + esc(x.id) + '" checked><span><b>' + esc(x.titulo || 'sem título') + '</b><small>' +
            esc([x.cliente, x.prazo ? (k === 'gravacoes' ? 'dia ' : 'prazo ') + dm(x.prazo) : '', ROT_STATUS[x.status] || x.status || ''].filter(Boolean).join(' · ')) + '</small></span></label>').join('') +
        '</details></section>';
    }).join('') : '<div class="rp-vazio"><b>' + esc(pessoa.nome || 'A pessoa') + ' não tem nada em aberto.</b><span>Nenhuma peça, demanda, gravação ou card da Produção para passar.</span></div>';

    const pintarBotao = () => {
      let n = 0;
      corpo.querySelectorAll('.rp-area').forEach(a => {
        const sel = a.querySelector('[data-para]');
        if (sel && sel.value) n += a.querySelectorAll('[data-item]:checked').length;
      });
      ok.disabled = !n && !desat.checked;
      ok.textContent = n ? 'Passar ' + n + (n === 1 ? ' item' : ' itens') + (desat.checked ? ' e desativar' : '') : desat.checked ? 'Só desativar' : 'Passar';
      ok.classList.toggle('perigo', !n && desat.checked);
    };
    corpo.querySelectorAll('.rp-area').forEach(a => {
      const todos = a.querySelector('[data-todos]'), itens = [...a.querySelectorAll('[data-item]')];
      todos.onchange = () => { itens.forEach(i => { i.checked = todos.checked; }); pintarBotao(); };
      itens.forEach(i => i.onchange = () => { todos.checked = itens.every(x => x.checked); pintarBotao(); });
      const sel = a.querySelector('[data-para]'); if (sel) sel.onchange = pintarBotao;
    });
    desat.onchange = pintarBotao;
    pintarBotao();

    ok.onclick = async () => {
      const destinos = {}, excluir = [];
      let n = 0;
      corpo.querySelectorAll('.rp-area').forEach(a => {
        const sel = a.querySelector('[data-para]');
        if (!sel || !sel.value) return;
        destinos[a.dataset.area] = sel.value;
        a.querySelectorAll('[data-item]').forEach(i => { if (i.checked) n++; else excluir.push(i.dataset.item); });
      });
      const desativar = desat.checked;
      const certo = await B7.UI.confirmar({
        titulo: n ? 'Passar ' + n + (n === 1 ? ' item' : ' itens') + (desativar ? ' e desativar a conta?' : '?') : 'Desativar a conta de ' + (pessoa.nome || '') + '?',
        texto: (n ? 'Os responsáveis mudam agora e cada pessoa que recebe é avisada. ' : '') +
          (desativar ? (pessoa.nome || 'A pessoa') + ' deixa de entrar e as sessões abertas são encerradas. O histórico continua.' : ''),
        confirmar: desativar && !n ? 'Desativar' : 'Passar', perigo: desativar });
      if (!certo) return;
      ok.disabled = true; ok.textContent = 'Passando…'; msg.className = 'perfil-msg'; msg.textContent = '';
      let res = {};
      try {
        if (n) res = await B7.DB.rpc('saida_transferir', { p_de: pessoa.id, p_destinos: destinos, p_excluir: excluir });
        if (desativar) await B7.DB.chamarAuth({ acao: 'alterar_conta', perfil_id: pessoa.id, estado: 'desativada' });
      } catch (e) {
        msg.className = 'perfil-msg erro'; msg.textContent = (e && e.message) || 'Não foi possível concluir.'; pintarBotao(); return;
      }
      const total = Object.values(res || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      m.fechar();
      B7.UI.toast((total ? total + (total === 1 ? ' item passado' : ' itens passados') : 'Nada passado') + (desativar ? ' e conta desativada.' : '.'));
      if (op.aoTerminar) op.aoTerminar();
    };
  }
  /* Configurações → Equipe: escolher de quem passar */
  function escolherRepasse() {
    carregar(true).then(() => {
      const m = B7.UI.modal('<h3>Passar o trabalho de alguém</h3>' +
        '<p class="sub">Para quando alguém sai da equipe ou vai ficar fora muito tempo. No próximo passo você vê tudo o que está com a pessoa e escolhe para quem vai.</p>' +
        '<div class="mb"><label class="rot" for="rp-quem">DE QUEM</label><select class="campo" id="rp-quem">' +
          cache.pessoas.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nome) + (ausenciaDe(p.id) ? ' · ' + esc(rotuloAusencia(ausenciaDe(p.id)).toLowerCase()) : '') + '</option>').join('') + '</select></div>' +
        '<div class="acoes"><button type="button" class="b contorno" data-fecha>Cancelar</button><button type="button" class="b pri" id="rp-seguir">Ver o trabalho</button></div>');
      m.querySelector('#rp-seguir').onclick = () => {
        const id = m.querySelector('#rp-quem').value; m.fechar();
        setTimeout(() => repasse(pessoaDe(id)), 180);
      };
    }).catch(e => B7.UI.toast((e && e.message) || 'Não foi possível ler a equipe.', { tipo: 'erro' }));
  }

  /* ================================================ NO DIA A DIA */
  let recadoMostrado = null;
  const FECHADOS = 'b7-recado-fechado';
  function cartaoTopo(id, cls, icone, html, acoes) {
    let pilha = document.getElementById('eq-avisos');
    if (!pilha) { pilha = document.createElement('div'); pilha.id = 'eq-avisos'; pilha.className = 'eq-avisos'; document.body.appendChild(pilha); }
    const velho = pilha.querySelector('[data-eq-aviso="' + id + '"]'); if (velho) velho.remove();
    const c = document.createElement('div');
    c.className = 'eq-aviso ' + cls; c.dataset.eqAviso = id; c.setAttribute('role', 'status');
    c.innerHTML = '<span class="eq-aviso-ic">' + icone + '</span><div class="eq-aviso-tx">' + html + '</div>' + (acoes || '') +
      '<button type="button" class="eq-aviso-x" aria-label="Fechar">' + IC.x + '</button>';
    pilha.appendChild(c);
    const fechar = () => { c.classList.add('saindo'); setTimeout(() => c.remove(), 220); };
    c.querySelector('.eq-aviso-x').onclick = () => { fechar(); if (c._aoFechar) c._aoFechar(); };
    return c;
  }
  async function mostrarRecado(forcar) {
    let r = null; try { r = await lerRecado(); } catch (e) { return; }
    const pilha = document.getElementById('eq-avisos');
    if (!r) { const v = pilha && pilha.querySelector('[data-eq-aviso="recado"]'); if (v) v.remove(); return; }
    let fechado = ''; try { fechado = localStorage.getItem(FECHADOS) || ''; } catch (e) {}
    if (!forcar && (fechado === r.id || recadoMostrado === r.id)) return;
    recadoMostrado = r.id;
    const c = cartaoTopo('recado', 'eq-tom-' + (r.tom || 'marca'), IC.recado,
      '<small>Recado da administração' + (r.autor ? ' · ' + esc(String(r.autor).split(' ')[0]) : '') + '</small><b>' + esc(r.texto) + '</b>');
    c._aoFechar = () => { try { localStorage.setItem(FECHADOS, r.id); } catch (e) {} };
  }
  async function aniversariosDeHoje() {
    const chave = 'b7-aniv-visto-' + hoje();
    try { if (localStorage.getItem(chave)) return; } catch (e) {}
    try { await carregar(); } catch (e) { return; }
    const d = new Date(), eu = B7.Auth.usuario() && B7.Auth.usuario().id;
    const hojeAniv = cache.ani.filter(a => a.dia === d.getDate() && a.mes === d.getMonth() + 1 && cache.pessoas.some(p => p.id === a.perfil_id));
    if (!hojeAniv.length) return;
    const meu = hojeAniv.find(a => a.perfil_id === eu), outros = hojeAniv.filter(a => a.perfil_id !== eu);
    const marcar = () => { try { localStorage.setItem(chave, '1'); } catch (e) {} };
    if (meu) {
      const c = cartaoTopo('aniv-eu', 'eq-tom-festa', IC.bolo, '<small>Hoje é o seu dia</small><b>Feliz aniversário, ' + esc(String(nomeDe(eu)).split(' ')[0]) + '! A equipe B7 deseja um ano incrível.</b>');
      c._aoFechar = marcar; confete(c);
    }
    if (outros.length) {
      const nomes = outros.map(a => String(nomeDe(a.perfil_id)).split(' ')[0]);
      const txt = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
      const um = outros.length === 1 && B7.Conversas && B7.Conversas.conversarCom;
      const c = cartaoTopo('aniv', 'eq-tom-festa', IC.bolo, '<small>Aniversário na equipe</small><b>Hoje é aniversário de ' + esc(txt) + '!</b>',
        um ? '<button type="button" class="eq-aviso-bt" data-eq-parabens>Mandar parabéns</button>' : '');
      c._aoFechar = marcar;
      const b = c.querySelector('[data-eq-parabens]');
      if (b) b.onclick = () => { marcar(); c.querySelector('.eq-aviso-x').click(); B7.Conversas.conversarCom(outros[0].perfil_id); };
      if (!meu) confete(c);
    }
  }
  /* uns papeizinhos nas cores da B7 saindo do cartão (só uma vez, curto) */
  function confete(c) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cores = ['#3A1E86', '#7C1E85', '#C21C83', '#E2409C', '#FFC857'];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('i');
      p.className = 'eq-confete';
      p.style.cssText = '--x:' + (Math.random() * 100) + '%;--dx:' + Math.round(Math.random() * 120 - 60) + 'px;--r:' + Math.round(Math.random() * 540 - 270) + 'deg;' +
        '--d:' + (Math.random() * .4).toFixed(2) + 's;background:' + cores[i % cores.length];
      c.appendChild(p);
    }
  }

  /* chamado ao entrar (app.js → pintarSessao): só equipe interna, uma vez */
  let iniciado = false;
  function aoEntrar() {
    const u = B7.Auth && B7.Auth.usuario();
    if (!u || iniciado || (B7.Auth.ehCliente && B7.Auth.ehCliente())) return;
    iniciado = true;
    setTimeout(() => { mostrarRecado(); aniversariosDeHoje(); }, 3500);
  }

  return { carregar, montar, ausenciaDe, rotuloAusencia, modalRecado, resumoRecado, exportarCSV, aoEntrar, repasse, temTrabalho, escolherRepasse };
})();
