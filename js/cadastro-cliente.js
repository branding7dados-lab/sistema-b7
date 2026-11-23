/* =====================================================================
   CADASTRO DO CLIENTE (4.88.0)

   O mesmo cadastro em dois lugares:
     • "Novo cliente": uma janela em etapas (Cliente · Marca · Pacote ·
       Equipe · Observações). Só o nome é obrigatório; o cliente nasce
       na etapa 1 e as outras completam.
     • Página do cliente → aba "Cadastro": as mesmas partes em blocos,
       cada um com o seu "Editar".
   Contrato, valor e pagamento NÃO ficam aqui: são do Núcleo 7.
   Os dados internos (CNPJ, responsável, combinado, equipe, marca) saem
   por funções do banco que só a equipe chama (zzz389).
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Cadastro = (function () {
  const esc = s => B7.UI.esc(s == null ? '' : s);
  const D = () => (B7.Dashboard && B7.Dashboard.cad) || {};
  const soNum = s => String(s || '').replace(/\D/g, '');

  const validar = {
    cnpj: s => { const n = soNum(s); return !n || n.length === 14; },
    whatsapp: s => { const n = soNum(s); return !n || (n.length >= 10 && n.length <= 13); },
    email: s => { const v = String(s || '').trim(); return !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); },
    cor: s => /^#[0-9A-Fa-f]{6}$/.test(String(s || '').trim()),
    link: s => { const v = String(s || '').trim(); return !v || /^https:\/\/\S+$/i.test(v); }
  };
  const fmtCnpj = s => { const n = soNum(s); return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : (s || ''); };
  const fmtFone = s => { const n = soNum(s).replace(/^55(?=\d{10,11}$)/, ''); return n.length === 11 ? n.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3') : n.length === 10 ? n.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3') : (s || ''); };
  const fmtData = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  const hojeMes1 = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };

  const BLOCOS = [
    ['cliente', 'Cliente', 'quem é o cliente e com quem a gente fala'],
    ['marca', 'Marca', 'logo, cores e fontes — opcional'],
    ['pacote', 'Pacote', 'o que ele contratou por mês: é a entrega mínima'],
    ['equipe', 'Equipe', 'quem cuida da conta aqui na B7'],
    ['obs', 'Observações', 'o que foi combinado e o que é bom lembrar']
  ];
  const FUNCOES = [['coordenador', 'Coordenação'], ['designer', 'Design'], ['videomaker', 'Vídeo']];
  const VAZIO = () => ({
    cliente: { nome: '', contrato: 'mensal', modo: 'linha', logo_url: null, logo_path: null },
    interno: { cnpj: '', cidade: '', resp_nome: '', resp_cargo: '', resp_whatsapp: '', resp_email: '', combinado: '', inicio_servico: null, observacoes: '' },
    perfil: { nicho: '', site: '', instagram: '' },
    marca: { cores: [], fonte_titulo: '', fonte_texto: '', link: '', estilo: '' },
    pacote: { pacote_id: null, nome: null, arquivado: false, ajustado: false, desde: null, itens: [], padrao: [] },
    equipe: { coordenador: null, designer: null, videomaker: null }, pode_editar: true
  });

  const campo = (rot, id, valor, op) => { op = op || {};
    return '<div class="mb' + (op.meio ? ' cd-meio' : '') + '"><label class="rot" for="' + id + '">' + rot + (op.obr ? '' : ' <span class="leve">— opcional</span>') + '</label>' +
      (op.area ? '<textarea class="campo" id="' + id + '" rows="' + (op.linhas || 3) + '" maxlength="' + (op.max || 4000) + '" placeholder="' + esc(op.ph || '') + '">' + esc(valor) + '</textarea>'
        : '<input class="campo" id="' + id + '" type="' + (op.tipo || 'text') + '" maxlength="' + (op.max || 160) + '"' + (op.modo ? ' inputmode="' + op.modo + '"' : '') +
          (op.foco ? ' data-foco' : '') + ' placeholder="' + esc(op.ph || '') + '" value="' + esc(valor) + '">') + '</div>'; };

  /* ---------------------------------------------------------------- campos de cada bloco */
  function campos(bloco, d, cx) {
    cx = cx || {};
    if (bloco === 'cliente') {
      const i = d.interno, p = d.perfil, c = d.cliente, h = D();
      return campo('NOME DO CLIENTE', 'cd-nome', c.nome, { obr: true, foco: true, ph: 'Ex: Mercato Sadia', max: 120 }) +
        '<div class="cd-grade">' +
          campo('ÁREA DE ATUAÇÃO', 'cd-nicho', p.nicho, { meio: true, ph: 'Ex: Clínica odontológica' }) +
          campo('CNPJ', 'cd-cnpj', fmtCnpj(i.cnpj), { meio: true, ph: '00.000.000/0000-00', modo: 'numeric', max: 18 }) +
          campo('CIDADE / ESTADO', 'cd-cidade', i.cidade, { meio: true, ph: 'Ex: Vitória da Conquista - BA' }) +
          campo('INÍCIO DO SERVIÇO', 'cd-inicio', i.inicio_servico || '', { meio: true, tipo: 'date' }) +
          campo('INSTAGRAM', 'cd-insta', p.instagram ? '@' + p.instagram : '', { meio: true, ph: '@usuario', max: 60 }) +
          campo('SITE', 'cd-site', p.site, { meio: true, ph: 'https://…', max: 300 }) +
        '</div>' +
        '<div class="cd-sub">Responsável do cliente <small>quem fechou ou responde pela conta</small></div>' +
        '<div class="cd-grade">' +
          campo('NOME', 'cd-rnome', i.resp_nome, { meio: true, ph: 'Nome do responsável' }) +
          campo('CARGO', 'cd-rcargo', i.resp_cargo, { meio: true, ph: 'Ex: Dona, Gerente' }) +
          campo('WHATSAPP', 'cd-rwa', fmtFone(i.resp_whatsapp), { meio: true, ph: '(DDD) 90000-0000', modo: 'tel', max: 20 }) +
          campo('E-MAIL', 'cd-remail', i.resp_email, { meio: true, ph: 'email@empresa.com', tipo: 'email' }) +
        '</div>' +
        (h.campoContrato ? h.campoContrato(c.contrato) : '') + (h.campoModo ? h.campoModo(c.modo) : '');
    }
    if (bloco === 'marca') {
      const m = d.marca, h = D();
      return (h.campoLogo ? h.campoLogo(d.cliente.logo_url) : '') +
        '<div class="mb"><span class="rot">CORES DA MARCA <span class="leve">— até 8</span></span>' +
          '<div class="cd-cores" data-cd-cores></div>' +
          '<button type="button" class="b fina contorno" data-cd-cor-mais>+ Adicionar cor</button></div>' +
        '<div class="cd-grade">' +
          campo('FONTE DOS TÍTULOS', 'cd-ftit', m.fonte_titulo, { meio: true, ph: 'Ex: Montserrat', max: 80 }) +
          campo('FONTE DOS TEXTOS', 'cd-ftxt', m.fonte_texto, { meio: true, ph: 'Ex: Inter', max: 80 }) +
        '</div>' +
        campo('LINK DO MATERIAL DA MARCA', 'cd-mlink', m.link, { ph: 'https://… (manual da marca, pasta do Drive)', max: 500, tipo: 'url' }) +
        campo('ESTILO', 'cd-mestilo', m.estilo, { area: true, linhas: 2, max: 2000, ph: 'Ex: nunca usar preto puro; fotos claras' });
    }
    if (bloco === 'pacote') {
      const p = d.pacote, lista = (cx.pacotes || []).slice();
      if (p.pacote_id && !lista.some(x => x.id === p.pacote_id)) lista.unshift({ id: p.pacote_id, nome: (p.nome || 'Pacote') + (p.arquivado ? ' (arquivado)' : ''), itens: p.padrao || [] });
      return '<div class="mb"><label class="rot" for="cd-pacote">PACOTE <span class="leve">— opcional</span></label>' +
          '<select class="campo" id="cd-pacote"><option value="">Sem pacote por enquanto</option>' +
            lista.map(x => '<option value="' + esc(x.id) + '"' + (x.id === p.pacote_id ? ' selected' : '') + '>' + esc(x.nome) + ' — ' + B7.Pacotes.total(x) + ' no mês</option>').join('') + '</select>' +
          '<div class="gv-ajuda" data-cd-pc-resumo></div>' +
          (lista.length ? '' : '<div class="gv-ajuda">Ainda não há pacotes. Eles são criados em Gestão → Pacotes.</div>') + '</div>' +
        '<div data-cd-pc-resto hidden>' +
          '<label class="pc-edicao cd-ajustar"><input type="checkbox" id="cd-ajustar"' + (p.ajustado ? ' checked' : '') + '> Ajustar as quantidades só para este cliente</label>' +
          '<div class="mb cd-ajuste" data-cd-ajuste hidden><span class="rot">POR MÊS, PARA ESTE CLIENTE</span><div data-cd-qtds></div><p class="ajuda" data-cd-total></p></div>' +
          campo('VALE DESDE', 'cd-desde', p.desde || hojeMes1(), { tipo: 'date', obr: true }) +
          '<div class="gv-ajuda">Os meses antes dessa data não entram no Contratado × entregue.</div>' +
        '</div>';
    }
    if (bloco === 'equipe') {
      const pes = cx.pessoas || {};
      return '<p class="cd-nota">Quem cuida deste cliente na B7. É só informação: não distribui trabalho sozinho.</p>' +
        '<div class="cd-grade">' + FUNCOES.map(([f, r]) => { const at = d.equipe[f], l = (pes[f] || []).slice();
          if (at && !l.some(x => x.id === at.id)) l.unshift({ id: at.id, nome: at.nome });
          return '<div class="mb cd-meio"><label class="rot" for="cd-eq-' + f + '">' + r.toUpperCase() + '</label><select class="campo" id="cd-eq-' + f + '"><option value="">Ninguém definido</option>' +
            l.map(x => '<option value="' + esc(x.id) + '"' + (at && at.id === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></div>'; }).join('') + '</div>';
    }
    return campo('OBSERVAÇÕES', 'cd-obs', d.interno.observacoes, { area: true, linhas: 3, ph: 'Tom de voz, particularidades, o que é bom lembrar…' }) +
      campo('O QUE FOI COMBINADO COM O CLIENTE', 'cd-comb', d.interno.combinado, { area: true, linhas: 3, ph: 'Promessas, objetivos, o que ficou alinhado…' });
  }

  /* liga os campos e devolve ler(): { erro, foco } ou { cliente, dados, logo } */
  function ligar(bloco, raiz, d, cx) {
    cx = cx || {};
    const q = s => raiz.querySelector(s), v = id => (q('#' + id) ? q('#' + id).value : '').trim();
    const falha = (msg, id) => ({ erro: msg, foco: q('#' + id) });
    if (bloco === 'cliente') {
      const h = D(); if (h.ligarContrato) h.ligarContrato(raiz);
      return () => {
        if (!v('cd-nome')) return falha('Dê um nome ao cliente', 'cd-nome');
        if (!validar.cnpj(v('cd-cnpj'))) return falha('O CNPJ precisa ter 14 números', 'cd-cnpj');
        if (!validar.whatsapp(v('cd-rwa'))) return falha('O WhatsApp precisa ter de 10 a 13 números, com DDD', 'cd-rwa');
        if (!validar.email(v('cd-remail'))) return falha('O e-mail não parece certo', 'cd-remail');
        return { cliente: { nome: v('cd-nome'), contrato: h.lerContrato ? h.lerContrato(raiz) : d.cliente.contrato, modo: h.lerModo ? h.lerModo(raiz) : d.cliente.modo },
          dados: { interno: { cnpj: v('cd-cnpj'), cidade: v('cd-cidade'), inicio_servico: v('cd-inicio') || null, resp_nome: v('cd-rnome'), resp_cargo: v('cd-rcargo'),
                     resp_whatsapp: v('cd-rwa'), resp_email: v('cd-remail') },
                   perfil: { nicho: v('cd-nicho'), instagram: v('cd-insta'), site: v('cd-site') } } };
      };
    }
    if (bloco === 'marca') {
      const h = D(), logo = h.ligarCampoLogo ? h.ligarCampoLogo(raiz, d.cliente.logo_url) : null;
      const cx2 = q('[data-cd-cores]'), mais = q('[data-cd-cor-mais]');
      const linha = c => { const el = document.createElement('div'); el.className = 'cd-cor';
        el.innerHTML = '<input type="color" aria-label="Escolher a cor" value="' + esc(validar.cor(c.hex) ? c.hex : '#C2185B') + '">' +
          '<input class="campo fina cd-cor-hex" aria-label="Código da cor" maxlength="7" placeholder="#RRGGBB" value="' + esc(c.hex || '') + '">' +
          '<input class="campo fina cd-cor-nome" aria-label="Nome da cor" maxlength="40" placeholder="nome (ex.: principal)" value="' + esc(c.nome || '') + '">' +
          '<button type="button" class="b fina contorno cd-cor-x" aria-label="Remover esta cor">Remover</button>';
        const [pk, hx] = el.querySelectorAll('input');
        pk.oninput = () => { hx.value = pk.value.toUpperCase(); hx.classList.remove('erro'); };
        hx.oninput = () => { if (validar.cor(hx.value)) { pk.value = hx.value; hx.classList.remove('erro'); } };
        el.querySelector('.cd-cor-x').onclick = () => { el.remove(); conta(); };
        cx2.appendChild(el); };
      const conta = () => { mais.hidden = cx2.children.length >= 8; };
      (d.marca.cores || []).forEach(linha); conta();
      mais.onclick = () => { linha({ hex: '', nome: '' }); conta(); const u = cx2.lastElementChild.querySelector('.cd-cor-hex'); u.value = cx2.lastElementChild.querySelector('input[type=color]').value.toUpperCase(); u.focus(); u.select(); };
      return () => {
        const cores = [];
        for (const el of cx2.children) { const hx = el.querySelector('.cd-cor-hex'), hex = hx.value.trim();
          if (!validar.cor(hex)) { hx.classList.add('erro'); return { erro: 'Cor inválida: use o formato #RRGGBB', foco: hx }; }
          cores.push({ hex: hex.toUpperCase(), nome: el.querySelector('.cd-cor-nome').value.trim() }); }
        if (!validar.link(v('cd-mlink'))) return falha('O link precisa começar com https://', 'cd-mlink');
        return { dados: { marca: { cores, fonte_titulo: v('cd-ftit'), fonte_texto: v('cd-ftxt'), link: v('cd-mlink'), estilo: v('cd-mestilo') } }, logo };
      };
    }
    if (bloco === 'pacote') {
      const sel = q('#cd-pacote'), resto = q('[data-cd-pc-resto]'), aj = q('#cd-ajustar'), cxAj = q('[data-cd-ajuste]'), qtds = q('[data-cd-qtds]');
      const p0 = d.pacote, lista = cx.pacotes || [];
      const padrao = id => (lista.find(x => x.id === id) || (id === p0.pacote_id ? { itens: p0.padrao } : { itens: [] })).itens || [];
      const montarQtds = itens => { qtds.innerHTML = B7.Pacotes.qtdsHTML(itens); qtds.querySelectorAll('input').forEach(i => i.oninput = i.onchange = total); total(); };
      const total = () => { const it = B7.Pacotes.lerQtds(qtds); q('[data-cd-total]').textContent = B7.Pacotes.total({ itens: it }) + ' conteúdos por mês para este cliente.'; };
      const pintar = () => { const id = sel.value;
        resto.hidden = !id; cxAj.hidden = !id || !aj.checked;
        q('[data-cd-pc-resumo]').textContent = id ? 'No pacote: ' + B7.Pacotes.resumo({ itens: padrao(id) }) + '.' : 'Sem pacote, o cliente fica fora do Contratado × entregue.'; };
      sel.onchange = () => { aj.checked = false; montarQtds(padrao(sel.value)); pintar(); };   /* outro pacote: o ajuste antigo não vale */
      aj.onchange = () => { if (aj.checked) montarQtds(sel.value === p0.pacote_id && p0.ajustado ? p0.itens : padrao(sel.value)); pintar(); };
      montarQtds(p0.ajustado ? p0.itens : padrao(sel.value)); pintar();
      return () => {
        const id = sel.value || null;
        if (!id) return { dados: { pacote: { pacote_id: null, ajuste: null } }, trocou: !!p0.pacote_id, perdeAjuste: !!p0.ajustado };
        let ajuste = null;
        if (aj.checked) { ajuste = B7.Pacotes.lerQtds(qtds); if (!ajuste.length) return { erro: 'Coloque pelo menos um conteúdo no ajuste', foco: qtds.querySelector('input') }; }
        if (!v('cd-desde')) return falha('Escolha desde quando o pacote vale', 'cd-desde');
        return { dados: { pacote: { pacote_id: id, ajuste, desde: v('cd-desde') } }, trocou: id !== p0.pacote_id, perdeAjuste: !!p0.ajustado && id !== p0.pacote_id };
      };
    }
    if (bloco === 'equipe') {
      return () => { const e = {}; FUNCOES.forEach(([f]) => { e[f] = v('cd-eq-' + f) || null; }); return { dados: { equipe: e } }; };
    }
    return () => ({ dados: { interno: { observacoes: v('cd-obs'), combinado: v('cd-comb') } } });
  }

  /* trocar de pacote descarta o ajuste do cliente: pergunta antes */
  const confirmaTroca = lido => !lido.perdeAjuste ? Promise.resolve(true)
    : B7.UI.confirmar({ titulo: 'Trocar o pacote?', texto: 'O ajuste deste cliente vai ser descartado.', rotulo: 'Trocar' });
  /* grava o que um bloco leu e devolve o cadastro novo */
  async function gravar(id, lido, d) {
    const patch = {};
    if (lido.cliente) ['nome', 'contrato', 'modo'].forEach(k => { if (lido.cliente[k] !== undefined && lido.cliente[k] !== d.cliente[k]) patch[k] = lido.cliente[k]; });
    if (lido.logo) { const nova = await lido.logo.resolver(id, d.cliente.logo_path); if (nova) Object.assign(patch, nova); }
    if (Object.keys(patch).length) await B7.DB.atualizarCliente(id, patch);
    return B7.DB.salvarCadastro(id, lido.dados || {});
  }
  const avisoErro = e => { const t = String((e && e.message) || '');
    B7.UI.toast(/duplicate|23505/.test(t + (e && e.code)) ? 'Já existe um cliente com esse nome' : (t || 'Não foi possível salvar'), { tipo: 'erro' }); };
  async function apoio() {
    const [pacotes, pessoas] = await Promise.all([
      B7.Pacotes ? B7.Pacotes.listar().catch(() => []) : [],
      B7.DB.pessoasCadastro().catch(() => ({}))]);
    return { pacotes: pacotes || [], pessoas: pessoas || {} };
  }

  /* ================================================================ NOVO CLIENTE (etapas) */
  function novo(aoCriar) {
    let passo = 0, criado = null, d = VAZIO(), ler = null, cx = { pacotes: [], pessoas: {} }, ocupado = false;
    apoio().then(a => { cx = a; if (passo >= 2 && m.isConnected) pintar(); });
    const m = B7.UI.modal(
      '<h3>Novo cliente</h3><div class="sub">Só o nome é obrigatório. O resto você completa agora ou depois, na aba Cadastro do cliente.</div>' +
      '<ol class="cd-passos" data-cd-passos></ol><div class="cd-corpo" data-cd-corpo></div>' +
      '<div class="acoes cd-acoes"><button class="b" data-cd-voltar>Voltar</button><span class="cd-esp"></span>' +
        '<button class="b contorno" data-cd-pular>Pular</button><button class="b pri" data-cd-ok>Continuar</button></div>',
      { larga: true, extra: 'cd-janela', aoFechar: () => { if (criado) { if (aoCriar) aoCriar(criado); else B7.Rota.recarregar(); } } });
    const q = s => m.querySelector(s);
    function pintar() {
      const [k] = BLOCOS[passo];
      q('[data-cd-passos]').innerHTML = BLOCOS.map(([, r], i) => '<li class="' + (i === passo ? 'on' : i < passo ? 'feito' : '') + '"' + (i === passo ? ' aria-current="step"' : '') + '><i>' + (i + 1) + '</i>' + esc(r) + '</li>').join('');
      q('[data-cd-corpo]').innerHTML = '<p class="cd-nota cd-de">' + esc(BLOCOS[passo][2]) + '</p>' + campos(k, d, cx);
      ler = ligar(k, q('[data-cd-corpo]'), d, cx);
      q('[data-cd-voltar]').hidden = passo === 0;
      q('[data-cd-pular]').hidden = passo === 0;
      q('[data-cd-pular]').textContent = passo === BLOCOS.length - 1 ? 'Fechar sem preencher' : 'Pular';
      q('[data-cd-ok]').textContent = passo === 0 && !criado ? 'Criar e continuar' : passo === BLOCOS.length - 1 ? 'Concluir' : 'Salvar e continuar';
      const foco = q('[data-cd-corpo] [data-foco]') || q('[data-cd-corpo] input, [data-cd-corpo] select, [data-cd-corpo] textarea');
      if (foco && passo === 0) foco.focus();
      q('.cd-corpo').scrollTop = 0;
    }
    const anda = n => { passo = Math.max(0, Math.min(BLOCOS.length - 1, passo + n)); pintar(); };
    async function seguir() {
      if (ocupado) return;
      const lido = ler();
      if (lido.erro) { B7.UI.toast(lido.erro, { tipo: 'erro' }); if (lido.foco) { lido.foco.classList.add('erro'); lido.foco.focus(); } return; }
      ocupado = true; q('[data-cd-ok]').disabled = true;
      try {
        if (!criado) {
          /* o cliente nasce aqui; o que vier depois só completa */
          criado = await B7.Save.acao(() => B7.DB.criarCliente(lido.cliente.nome), 'Cliente criado');
          d.cliente.nome = criado.nome;
        }
        const r = await gravar(criado.id, lido, d);
        d = r; criado = Object.assign({}, criado, r.cliente);
        if (passo === BLOCOS.length - 1) return m.fechar();
        anda(1);
      } catch (e) { avisoErro(e); }
      finally { ocupado = false; const b = q('[data-cd-ok]'); if (b) b.disabled = false; }
    }
    q('[data-cd-ok]').onclick = seguir;
    q('[data-cd-voltar]').onclick = () => anda(-1);
    q('[data-cd-pular]').onclick = () => (passo === BLOCOS.length - 1 ? m.fechar() : anda(1));
    m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=color])')) { e.preventDefault(); seguir(); } });
    pintar();
    return m;
  }

  /* ================================================================ FICHA (aba Cadastro) */
  const linhaV = (rot, html) => '<div class="cd-v"><dt>' + rot + '</dt><dd>' + (html || '<span class="cd-vazio">—</span>') + '</dd></div>';
  const txt = s => (s ? esc(s) : '');
  const multi = s => (s ? esc(s).replace(/\n/g, '<br>') : '');
  const linkExt = (u, r) => (/^https?:\/\//i.test(u || '') ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(r || u) + '</a>' : txt(u));

  function ver(bloco, d) {
    const i = d.interno, p = d.perfil, c = d.cliente;
    if (bloco === 'cliente') {
      const h = D(), modos = h.rotulosModo ? h.rotulosModo(c.modo) : c.modo;
      return linhaV('Nome', txt(c.nome)) + linhaV('Área de atuação', txt(p.nicho)) + linhaV('CNPJ', txt(fmtCnpj(i.cnpj))) + linhaV('Cidade / estado', txt(i.cidade)) +
        linhaV('Início do serviço', txt(fmtData(i.inicio_servico))) +
        linhaV('Instagram', p.instagram ? linkExt('https://instagram.com/' + encodeURIComponent(p.instagram), '@' + p.instagram) : '') + linhaV('Site', linkExt(p.site)) +
        linhaV('Responsável', [i.resp_nome, i.resp_cargo].filter(Boolean).map(esc).join(' · ')) +
        linhaV('WhatsApp do responsável', txt(fmtFone(i.resp_whatsapp))) + linhaV('E-mail do responsável', txt(i.resp_email)) +
        linhaV('Contrato', c.contrato === 'avulso' ? 'Avulso' : 'Mensal') + linhaV('Como trabalhamos', txt(modos));
    }
    if (bloco === 'marca') {
      const m = d.marca;
      return linhaV('Logo', c.logo_url ? '<img class="cd-logo" src="' + esc(c.logo_url) + '" alt="Logo de ' + esc(c.nome) + '">' : '') +
        linhaV('Cores', (m.cores || []).length ? '<span class="cd-amostras">' + m.cores.map(x => validar.cor(x.hex)
          ? '<button type="button" class="cd-amostra" data-cd-copiar="' + esc(x.hex) + '" aria-label="Copiar ' + esc(x.hex) + (x.nome ? ' (' + esc(x.nome) + ')' : '') + '"><i style="background:' + esc(x.hex) + '"></i><b>' + esc(x.hex) + '</b>' + (x.nome ? '<small>' + esc(x.nome) + '</small>' : '') + '</button>' : '').join('') + '</span>' : '') +
        linhaV('Fonte dos títulos', txt(m.fonte_titulo)) + linhaV('Fonte dos textos', txt(m.fonte_texto)) +
        linhaV('Material da marca', m.link ? linkExt(m.link, 'Abrir o material') : '') + linhaV('Estilo', multi(m.estilo));
    }
    if (bloco === 'pacote') {
      const p2 = d.pacote;
      if (!p2.pacote_id) return '<p class="cd-nota">Sem pacote definido. Sem pacote, o cliente fica fora do Contratado × entregue.</p>';
      return linhaV('Pacote', esc(p2.nome || 'Pacote') + (p2.arquivado ? ' <span class="cd-tag">arquivado</span>' : '') + (p2.ajustado ? ' <span class="cd-tag on">ajustado para este cliente</span>' : '')) +
        linhaV('Entrega do mês', esc(B7.Pacotes ? B7.Pacotes.resumo({ itens: p2.itens }) : '')) +
        (p2.ajustado ? linhaV('No pacote padrão', esc(B7.Pacotes.resumo({ itens: p2.padrao })) + (d.pode_editar ? ' <button type="button" class="cb-link" data-cd-padrao>Voltar ao padrão</button>' : '')) : '') +
        linhaV('Vale desde', txt(fmtData(p2.desde)));
    }
    if (bloco === 'equipe') return FUNCOES.map(([f, r]) => linhaV(r, d.equipe[f] ? esc(d.equipe[f].nome) : '')).join('');
    return linhaV('Observações', multi(i.observacoes)) + linhaV('O que foi combinado', multi(i.combinado));
  }
  const temAlgo = (bloco, d) => bloco === 'cliente' ? true
    : bloco === 'marca' ? !!(d.cliente.logo_url || d.marca.cores.length || d.marca.fonte_titulo || d.marca.fonte_texto || d.marca.link || d.marca.estilo)
    : bloco === 'pacote' ? !!d.pacote.pacote_id : bloco === 'equipe' ? FUNCOES.some(([f]) => d.equipe[f]) : !!(d.interno.observacoes || d.interno.combinado);

  async function ficha(alvo, id, op) {
    op = op || {};
    alvo.innerHTML = B7.UI.skeleton('lista', { n: 4 });
    let d, cx;
    try { [d, cx] = await Promise.all([B7.DB.cadastroCliente(id), apoio()]); }
    catch (e) {
      if (!alvo.isConnected) return;
      alvo.innerHTML = '<div class="cb-aviso erro">' + esc((e && e.message) || 'Não foi possível carregar o cadastro.') + ' <button class="cb-link" data-de-novo>Tentar de novo</button></div>';
      alvo.querySelector('[data-de-novo]').onclick = () => ficha(alvo, id, op);
      return;
    }
    if (!alvo.isConnected) return;
    const pode = !!d.pode_editar && op.podeEditar !== false;
    let aberto = null;
    const cab = (k, r, sub, cheio) => '<header class="cd-b-cab"><div><h2>' + esc(r) + '</h2><small>' + esc(sub) + '</small></div>' +
      (pode && aberto !== k ? '<button type="button" class="b fina contorno" data-cd-editar="' + k + '">' + (cheio ? 'Editar' : 'Completar') + '</button>' : '') + '</header>';
    function pintar() {
      alvo.innerHTML = '<div class="cd-ficha">' + BLOCOS.map(([k, r, sub]) =>
        '<section class="cd-b' + (aberto === k ? ' editando' : '') + '" data-cd-bloco="' + k + '">' + cab(k, r, sub, temAlgo(k, d)) +
          (aberto === k ? '<div class="cd-b-ed" data-cd-ed>' + campos(k, d, cx) + '<div class="acoes"><button class="b" data-cd-cancelar>Cancelar</button><button class="b pri" data-cd-salvar>Salvar</button></div></div>'
            : '<dl class="cd-vs">' + ver(k, d) + '</dl>') + '</section>').join('') +
        (op.gravacaoFixa ? '<section class="cd-b" data-cd-bloco="fixa"><header class="cd-b-cab"><div><h2>Gravação fixa</h2><small>o sistema cria a gravação sozinho, alguns dias antes</small></div>' +
          (aberto !== 'fixa' ? '<button type="button" class="b fina contorno" data-cd-editar="fixa">' + (op.gravacaoFixa.atual && op.gravacaoFixa.atual.ativa ? 'Editar' : 'Completar') + '</button>' : '') + '</header>' +
          (aberto === 'fixa' ? '<div class="cd-b-ed" data-cd-ed>' + op.gravacaoFixa.html(op.gravacaoFixa.atual) + '<div class="acoes"><button class="b" data-cd-cancelar>Cancelar</button><button class="b pri" data-cd-salvar>Salvar</button></div></div>'
            : '<dl class="cd-vs">' + linhaV('Dia fixo de gravar', esc(op.gravacaoFixa.resumo(op.gravacaoFixa.atual))) + '</dl>') + '</section>' : '') + '</div>';
      alvo.querySelectorAll('[data-cd-editar]').forEach(b => b.onclick = () => { aberto = b.dataset.cdEditar; pintar(); const ed = alvo.querySelector('[data-cd-ed]'); const f = ed && ed.querySelector('input, select, textarea'); if (f) f.focus(); });
      alvo.querySelectorAll('[data-cd-copiar]').forEach(b => b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.cdCopiar); B7.UI.toast(b.dataset.cdCopiar + ' copiado'); } catch (e) { B7.UI.toast('Não deu para copiar', { tipo: 'erro' }); } });
      const pad = alvo.querySelector('[data-cd-padrao]');
      if (pad) pad.onclick = async () => {
        if (!(await B7.UI.confirmar({ titulo: 'Voltar ao pacote padrão?', texto: 'As quantidades ajustadas deste cliente serão descartadas.', rotulo: 'Voltar ao padrão' }))) return;
        try { d = await B7.Save.acao(() => B7.DB.salvarCadastro(id, { pacote: { ajuste: null } }), 'Pacote de volta ao padrão'); pintar(); } catch (e) { avisoErro(e); }
      };
      const ed = alvo.querySelector('[data-cd-ed]');
      if (!ed) return;
      const cancelar = ed.querySelector('[data-cd-cancelar]'), salvar = ed.querySelector('[data-cd-salvar]');
      cancelar.onclick = () => { aberto = null; pintar(); };
      if (aberto === 'fixa') {
        const lerFixa = op.gravacaoFixa.ligar(ed);
        salvar.onclick = async () => { salvar.disabled = true;
          try { const f = lerFixa(); if (f.mudou) op.gravacaoFixa.atual = await op.gravacaoFixa.salvar(f.valor); aberto = null; pintar(); }
          catch (e) { salvar.disabled = false; avisoErro(e); } };
        return;
      }
      const k = aberto, ler = ligar(k, ed, d, cx);
      salvar.onclick = async () => {
        const lido = ler();
        if (lido.erro) { B7.UI.toast(lido.erro, { tipo: 'erro' }); if (lido.foco) { lido.foco.classList.add('erro'); lido.foco.focus(); } return; }
        if (!(await confirmaTroca(lido))) return;
        salvar.disabled = true;
        try {
          const r = await B7.Save.acao(() => gravar(id, lido, d), 'Cadastro salvo');
          const mudouTopo = r.cliente.nome !== d.cliente.nome || r.cliente.logo_url !== d.cliente.logo_url || r.cliente.modo !== d.cliente.modo || r.cliente.contrato !== d.cliente.contrato;
          d = r; aberto = null;
          if (mudouTopo && op.aoMudarCliente) return op.aoMudarCliente();
          pintar();
        } catch (e) { salvar.disabled = false; avisoErro(e); }
      };
    }
    pintar();
    if (op.editar && pode) { aberto = op.editar; pintar(); }
  }

  return { novo, ficha, campos, ligar, validar, BLOCOS };
})();
