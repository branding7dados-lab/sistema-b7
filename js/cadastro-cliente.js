/* =====================================================================
   CADASTRO DO CLIENTE (4.88.0)

   O mesmo cadastro em dois lugares:
     • "Novo cliente": uma janela em etapas (Cliente · Marca · Serviços contratados ·
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

  /* [chave, nome, o que é (trilho), frase da etapa] */
  const BLOCOS = [
    ['cliente', 'Cliente', 'quem é', 'Quem é o cliente e com quem a gente fala.'],
    ['marca', 'Marca', 'logo e cores', 'Logo, cores e fontes, para a equipe usar. Pode ficar para depois.'],
    ['pacote', 'Serviços contratados', 'entrega do mês', 'O que ele contratou por mês. É a entrega mínima.'],
    ['equipe', 'Equipe', 'quem cuida', 'Quem cuida da conta aqui na B7.'],
    ['obs', 'Observações', 'o combinado', 'O que foi combinado e o que é bom lembrar.']
  ];
  const FUNCOES = [['coordenador', 'Coordenação'], ['designer', 'Design'], ['videomaker', 'Vídeo']];
  const VAZIO = () => ({
    cliente: { nome: '', contrato: 'mensal', modo: 'linha', logo_url: null, logo_path: null },
    interno: { contrato_meses: null, cnpj: '', cidade: '', resp_nome: '', resp_cargo: '', resp_whatsapp: '', resp_email: '', combinado: '', inicio_servico: null, observacoes: '' },
    perfil: { nicho: '', site: '', instagram: '' },
    marca: { cores: [], fonte_titulo: '', fonte_texto: '', link: '', estilo: '' },
    pacote: { pacote_id: null, nome: null, arquivado: false, ajustado: false, desde: null, itens: [], padrao: [] },
    equipe: { coordenador: null, designer: null, videomaker: null }, pode_editar: true
  });

  const campo = (rot, id, valor, op) => { op = op || {};
    return '<div class="mb' + (op.meio ? ' cd-meio' : '') + '"><label class="rot" for="' + id + '">' + rot + '</label>' +
      (op.area ? '<textarea class="campo" id="' + id + '" rows="' + (op.linhas || 3) + '" maxlength="' + (op.max || 4000) + '" placeholder="' + esc(op.ph || '') + '">' + esc(valor) + '</textarea>'
        : '<input class="campo" id="' + id + '" type="' + (op.tipo || 'text') + '" maxlength="' + (op.max || 160) + '"' + (op.modo ? ' inputmode="' + op.modo + '"' : '') +
          (op.foco ? ' data-foco' : '') + ' placeholder="' + esc(op.ph || '') + '" value="' + esc(valor) + '">') + '</div>'; };

  /* 4.88.2: contrato = avulso ou a duração (1, 3, 6, 12 meses ou mais). Por dentro continua mensal/avulso
     (é o que o Panorama e a Gestão usam); a duração fica guardada à parte. */
  const DURACOES = [['avulso', 'Avulso', 'um projeto pontual'], ['1', '1 mês', ''], ['3', '3 meses', ''], ['6', '6 meses', ''], ['12', '12 meses ou mais', '']];
  const rotuloContrato = (contrato, meses) => contrato === 'avulso' ? 'Contrato avulso'
    : meses ? 'Contrato de ' + (DURACOES.find(x => x[0] === String(meses)) || [, meses + ' meses'])[1] : 'Contrato sem duração definida';
  function campoContrato(contrato, meses) {
    const atual = contrato === 'avulso' ? 'avulso' : String(meses || '');
    return '<div class="mb"><span class="rot">CONTRATO</span><div class="cd-opcoes" role="radiogroup" aria-label="Contrato">' + DURACOES.map(([v, r, sub]) =>
      '<label class="cd-opcao"><input type="radio" name="cd-contrato" value="' + v + '"' + (atual === v ? ' checked' : '') + '><span><b>' + r + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></label>').join('') + '</div></div>';
  }
  /* como a B7 trabalha com o cliente: linha editorial e roteiros/trends. "Pauta semanal" saiu das opções;
     só continua aparecendo para o cliente que já usa, para dar para desmarcar. */
  const MODOS = [['linha', 'Linha editorial', 'planejamento do mês, conteúdos e calendário'], ['roteiros', 'Roteiros e trends', 'a B7 faz roteiros, gravações e trends'],
    ['semana', 'Pauta semanal', 'conteúdo montado semana a semana']];
  function campoModo(modo) {
    const tem = String(modo || 'linha').split(',');
    return '<div class="mb" data-campo-modo><span class="rot">COMO TRABALHAMOS COM ESTE CLIENTE <span class="leve">marque tudo o que vale</span></span><div class="cli-modos">' +
      MODOS.filter(x => x[0] !== 'semana' || tem.includes('semana')).map(x => '<label class="cli-modo"><input type="checkbox" name="cli-modo" value="' + x[0] + '"' + (tem.includes(x[0]) ? ' checked' : '') + '>' +
        '<span><b>' + x[1] + '</b><small>' + x[2] + '</small></span></label>').join('') + '</div></div>';
  }

  /* ---------------------------------------------------------------- campos de cada bloco */
  function campos(bloco, d, cx) {
    cx = cx || {};
    if (bloco === 'cliente') {
      const i = d.interno, p = d.perfil, c = d.cliente, h = D();
      return '<div class="cd-nome">' + campo('NOME DO CLIENTE', 'cd-nome', c.nome, { obr: true, foco: true, ph: 'Ex: Mercato Sadia', max: 120 }) + '</div>' +
        '<fieldset class="cd-grupo"><legend>Empresa</legend><div class="cd-grade">' +
          campo('ÁREA DE ATUAÇÃO', 'cd-nicho', p.nicho, { meio: true, ph: 'Ex: Clínica odontológica' }) +
          campo('<span class="cd-sigla">CNPJ</span>', 'cd-cnpj', fmtCnpj(i.cnpj), { meio: true, ph: '00.000.000/0000-00', modo: 'numeric', max: 18 }) +
          campo('CIDADE / ESTADO', 'cd-cidade', i.cidade, { meio: true, ph: 'Ex: Vitória da Conquista - BA' }) +
          campo('INÍCIO DO SERVIÇO', 'cd-inicio', i.inicio_servico || '', { meio: true, tipo: 'date' }) +
          campo('INSTAGRAM', 'cd-insta', p.instagram ? '@' + p.instagram : '', { meio: true, ph: '@usuario', max: 60 }) +
          campo('SITE', 'cd-site', p.site, { meio: true, ph: 'https://…', max: 300 }) +
        '</div></fieldset>' +
        '<fieldset class="cd-grupo"><legend>Responsável do cliente <small>quem fechou ou responde pela conta</small></legend><div class="cd-grade">' +
          campo('NOME', 'cd-rnome', i.resp_nome, { meio: true, ph: 'Nome do responsável' }) +
          campo('CARGO', 'cd-rcargo', i.resp_cargo, { meio: true, ph: 'Ex: Dona, Gerente' }) +
          campo('WHATSAPP', 'cd-rwa', fmtFone(i.resp_whatsapp), { meio: true, ph: '(DDD) 90000-0000', modo: 'tel', max: 20 }) +
          campo('E-MAIL', 'cd-remail', i.resp_email, { meio: true, ph: 'email@empresa.com', tipo: 'email' }) +
        '</div></fieldset>' +
        '<fieldset class="cd-grupo"><legend>Como a B7 trabalha com ele</legend>' +
          campoContrato(c.contrato, i.contrato_meses) + campoModo(c.modo) + '</fieldset>';
    }
    if (bloco === 'marca') {
      const m = d.marca, h = D();
      return (h.campoLogo ? h.campoLogo(d.cliente.logo_url) : '') +
        '<div class="mb"><span class="rot">CORES DA MARCA <span class="leve">até 8</span></span>' +
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
      if (p.pacote_id && !lista.some(x => x.id === p.pacote_id)) lista.unshift({ id: p.pacote_id, nome: (p.nome || 'Serviços') + (p.arquivado ? ' (arquivado)' : ''), itens: p.padrao || [] });
      return '<div class="mb"><label class="rot" for="cd-pacote">SERVIÇOS CONTRATADOS</label>' +
          '<select class="campo" id="cd-pacote"><option value="">Nada definido por enquanto</option>' +
            lista.map(x => '<option value="' + esc(x.id) + '"' + (x.id === p.pacote_id ? ' selected' : '') + '>' + esc(x.nome) + ' — ' + B7.Pacotes.total(x) + ' no mês</option>').join('') + '</select>' +
          '<div class="gv-ajuda" data-cd-pc-resumo></div>' +
          (lista.length ? '' : '<div class="gv-ajuda">Ainda não há serviços cadastrados. Eles são criados em Gestão → Serviços contratados.</div>') + '</div>' +
        '<div data-cd-pc-resto hidden>' +
          '<label class="pc-edicao cd-ajustar"><input type="checkbox" id="cd-ajustar"' + (p.ajustado ? ' checked' : '') + '> Ajustar as quantidades só para este cliente</label>' +
          '<div class="mb cd-ajuste" data-cd-ajuste hidden><span class="rot">POR MÊS, PARA ESTE CLIENTE</span><div data-cd-qtds></div><p class="ajuda" data-cd-total></p></div>' +
          /* quem já tinha pacote sem data conta desde sempre: não inventar uma data ao abrir para editar */
          campo('VALE DESDE', 'cd-desde', p.desde || (p.pacote_id ? '' : hojeMes1()), { tipo: 'date' }) +
          '<div class="gv-ajuda">Os meses antes dessa data não entram no Contratado × entregue. Vazio: conta desde sempre.</div>' +
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
    return campo('OBSERVAÇÕES', 'cd-obs', d.interno.observacoes, { area: true, linhas: 3, ph: 'Particularidades do cliente, o que é bom lembrar…' }) +
      campo('O QUE FOI COMBINADO COM O CLIENTE', 'cd-comb', d.interno.combinado, { area: true, linhas: 3, ph: 'Promessas, objetivos, o que ficou alinhado…' });
  }

  /* liga os campos e devolve ler(): { erro, foco } ou { cliente, dados, logo } */
  function ligar(bloco, raiz, d, cx) {
    cx = cx || {};
    const q = s => raiz.querySelector(s), v = id => (q('#' + id) ? q('#' + id).value : '').trim();
    const falha = (msg, id) => ({ erro: msg, foco: q('#' + id) });
    if (bloco === 'cliente') {
      const h = D(), contrato = () => { const r = raiz.querySelector('input[name="cd-contrato"]:checked'); return r ? r.value : ''; };
      /* avulso não tem linha editorial do mês: os modos de trabalho somem */
      const pintaModo = () => { const m = q('[data-campo-modo]'); if (m) m.hidden = contrato() === 'avulso'; };
      raiz.querySelectorAll('input[name="cd-contrato"]').forEach(r => { r.onchange = pintaModo; }); pintaModo();
      return () => {
        if (!v('cd-nome')) return falha('Dê um nome ao cliente', 'cd-nome');
        if (!validar.cnpj(v('cd-cnpj'))) return falha('O CNPJ precisa ter 14 números', 'cd-cnpj');
        if (!validar.whatsapp(v('cd-rwa'))) return falha('O WhatsApp precisa ter de 10 a 13 números, com DDD', 'cd-rwa');
        if (!validar.email(v('cd-remail'))) return falha('O e-mail não parece certo', 'cd-remail');
        const ct = contrato();
        return { cliente: { nome: v('cd-nome'), contrato: ct === 'avulso' ? 'avulso' : 'mensal', modo: h.lerModo ? h.lerModo(raiz) : d.cliente.modo },
          dados: { interno: { contrato_meses: ct && ct !== 'avulso' ? +ct : null, cnpj: v('cd-cnpj'), cidade: v('cd-cidade'), inicio_servico: v('cd-inicio') || null, resp_nome: v('cd-rnome'), resp_cargo: v('cd-rcargo'),
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
        q('[data-cd-pc-resumo]').textContent = id ? 'Inclui: ' + B7.Pacotes.resumo({ itens: padrao(id) }) + '.' : 'Sem serviços contratados definidos, o cliente fica fora do Contratado × entregue.'; };
      sel.onchange = () => { aj.checked = false; montarQtds(padrao(sel.value)); pintar(); };   /* outro pacote: o ajuste antigo não vale */
      aj.onchange = () => { if (aj.checked) montarQtds(sel.value === p0.pacote_id && p0.ajustado ? p0.itens : padrao(sel.value)); pintar(); };
      montarQtds(p0.ajustado ? p0.itens : padrao(sel.value)); pintar();
      return () => {
        const id = sel.value || null;
        if (!id) return { dados: { pacote: { pacote_id: null, ajuste: null } }, trocou: !!p0.pacote_id, perdeAjuste: !!p0.ajustado };
        let ajuste = null;
        if (aj.checked) { ajuste = B7.Pacotes.lerQtds(qtds); if (!ajuste.length) return { erro: 'Coloque pelo menos um conteúdo no ajuste', foco: qtds.querySelector('input') }; }
        return { dados: { pacote: { pacote_id: id, ajuste, desde: v('cd-desde') || null } }, trocou: id !== p0.pacote_id, perdeAjuste: !!p0.ajustado && id !== p0.pacote_id };
      };
    }
    if (bloco === 'equipe') {
      return () => { const e = {}; FUNCOES.forEach(([f]) => { e[f] = v('cd-eq-' + f) || null; }); return { dados: { equipe: e } }; };
    }
    return () => ({ dados: { interno: { observacoes: v('cd-obs'), combinado: v('cd-comb') } } });
  }

  /* trocar de pacote descarta o ajuste do cliente: pergunta antes */
  const confirmaTroca = lido => !lido.perdeAjuste ? Promise.resolve(true)
    : B7.UI.confirmar({ titulo: 'Trocar os serviços contratados?', texto: 'O ajuste deste cliente vai ser descartado.', rotulo: 'Trocar' });
  /* grava o que um bloco leu e devolve o cadastro novo */
  async function gravar(id, lido, d) {
    const patch = {};
    if (lido.cliente) ['nome', 'contrato', 'modo'].forEach(k => { if (lido.cliente[k] !== undefined && lido.cliente[k] !== d.cliente[k]) patch[k] = lido.cliente[k]; });
    if (lido.logo) { const nova = await lido.logo.resolver(id, d.cliente.logo_path); if (nova) Object.assign(patch, nova); }
    if (Object.keys(patch).length) { await B7.DB.atualizarCliente(id, patch); Object.assign(d.cliente, patch); }   /* se o resto falhar, a logo nova já é a atual */
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
    let passo = 0, criado = null, d = VAZIO(), ler = null, cx = { pacotes: [], pessoas: {} }, ocupado = false, fechou = false;
    apoio().then(a => { cx = a; if (passo >= 2 && m.isConnected) pintar(); });
    const m = B7.UI.modal(
      '<div class="cd-w"><aside class="cd-trilho"><h3>Novo cliente</h3>' +
        '<p class="cd-trilho-sub">Só o nome é obrigatório. O resto você completa agora ou depois, na aba Cadastro.</p>' +
        '<ol class="cd-passos" data-cd-passos></ol></aside>' +
      '<section class="cd-palco"><header class="cd-palco-cab" data-cd-cab></header>' +
        '<div class="cd-corpo" data-cd-corpo></div>' +
        '<div class="acoes cd-acoes"><button class="b" data-cd-voltar>Voltar</button><span class="cd-esp"></span>' +
          '<button class="cb-link cd-pular" data-cd-pular>Pular esta etapa</button><button class="b pri" data-cd-ok>Continuar</button></div></section></div>',
      { larga: true, extra: 'cd-janela', aoFechar: () => { fechou = true; if (criado) { if (aoCriar) aoCriar(criado); else B7.Rota.recarregar(); } } });
    const q = s => m.querySelector(s);
    const CERTO = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    function pintar() {
      const [k, nome, , frase] = BLOCOS[passo];
      /* depois que o cliente existe, dá para ir direto a qualquer etapa (a atual é salva antes) */
      q('[data-cd-passos]').innerHTML = BLOCOS.map(([, r, curto], i) => '<li class="' + (i === passo ? 'on' : i < passo ? 'feito' : '') + '"' + (i === passo ? ' aria-current="step"' : '') + '>' +
        '<button type="button" data-cd-ir="' + i + '"' + (!criado && i !== 0 ? ' disabled' : '') + '><i>' + (i < passo ? CERTO : i + 1) + '</i><span><b>' + esc(r) + '</b><small>' + esc(curto) + '</small></span></button></li>').join('');
      q('[data-cd-passos]').querySelectorAll('[data-cd-ir]').forEach(b => b.onclick = () => { const i = +b.dataset.cdIr; if (i !== passo) seguir(i); });
      q('[data-cd-cab]').innerHTML = '<span class="cd-etapa">Etapa ' + (passo + 1) + ' de ' + BLOCOS.length + '</span><h4>' + esc(nome) + '</h4><p>' + esc(frase) + '</p>';
      q('[data-cd-corpo]').innerHTML = campos(k, d, cx);
      ler = ligar(k, q('[data-cd-corpo]'), d, cx);
      q('[data-cd-voltar]').hidden = passo === 0;
      q('[data-cd-pular]').hidden = passo === 0;
      q('[data-cd-pular]').textContent = passo === BLOCOS.length - 1 ? 'Fechar sem preencher' : 'Pular esta etapa';
      q('[data-cd-ok]').textContent = passo === 0 && !criado ? 'Criar cliente e continuar' : passo === BLOCOS.length - 1 ? 'Concluir' : 'Salvar e continuar';
      const foco = q('[data-cd-corpo] [data-foco]');
      if (foco && passo === 0) foco.focus();
      q('.cd-corpo').scrollTop = 0;
    }
    const anda = n => { passo = Math.max(0, Math.min(BLOCOS.length - 1, passo + n)); pintar(); };
    async function seguir(alvo) {
      if (ocupado) return;
      const lido = ler();
      if (lido.erro) { B7.UI.toast(lido.erro, { tipo: 'erro' }); if (lido.foco) { lido.foco.classList.add('erro'); lido.foco.focus(); } return; }
      ocupado = true; q('[data-cd-ok]').disabled = true;
      try {
        if (!criado) {
          /* o cliente nasce aqui; o que vier depois só completa */
          criado = await B7.Save.acao(() => B7.DB.criarCliente(lido.cliente.nome), 'Cliente criado');
          d.cliente.nome = criado.nome;
          /* a janela foi fechada enquanto criava: a tela ainda precisa saber do cliente novo */
          if (fechou) { if (aoCriar) aoCriar(criado); else B7.Rota.recarregar(); return; }
        }
        const r = await gravar(criado.id, lido, d);
        d = r; criado = Object.assign({}, criado, r.cliente);
        if (typeof alvo === 'number') { passo = alvo; return pintar(); }
        if (passo === BLOCOS.length - 1) return m.fechar();
        anda(1);
      } catch (e) { avisoErro(e); }
      finally { ocupado = false; const b = q('[data-cd-ok]'); if (b) b.disabled = false; }
    }
    q('[data-cd-ok]').onclick = () => seguir();
    q('[data-cd-voltar]').onclick = () => { if (!ocupado) anda(-1); };
    q('[data-cd-pular]').onclick = () => { if (!ocupado) (passo === BLOCOS.length - 1 ? m.fechar() : anda(1)); };
    m.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox]):not([type=color])')) { e.preventDefault(); seguir(); } });
    pintar();
    return m;
  }

  /* ================================================================ FICHA (aba Cadastro) */
  const linhaV = (rot, html) => (html ? '<div class="cd-v"><dt>' + rot + '</dt><dd>' + html + '</dd></div>' : '');
  const txt = s => (s ? esc(s) : '');
  const multi = s => (s ? esc(s).replace(/\n/g, '<br>') : '');
  const linkExt = (u, r) => (/^https?:\/\//i.test(u || '') ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(r || u) + '</a>' : txt(u));
  const lista = html => (html ? '<dl class="cd-vs">' + html + '</dl>' : '');
  const falta = nomes => (nomes.length ? '<p class="cd-falta">Falta: ' + nomes.map(esc).join(', ') + '</p>' : '');
  const convite = t => '<p class="cd-convite">' + t + '</p>';
  const iniciais = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const tiposPl = t => ((B7.Pacotes && B7.Pacotes.TIPOS.find(x => x[0] === t)) || [t, t])[1];

  /* o que ainda não foi preenchido em cada bloco (nomes para a linha "Falta: …") */
  function faltando(bloco, d) {
    const i = d.interno, p = d.perfil, m = d.marca, f = [];
    const se = (v, n) => { if (!v) f.push(n); };
    if (bloco === 'cliente') { se(d.cliente.contrato === 'avulso' || i.contrato_meses, 'duração do contrato'); se(p.nicho, 'área de atuação'); se(i.cnpj, 'CNPJ'); se(i.cidade, 'cidade'); se(i.inicio_servico, 'início do serviço'); se(p.instagram, 'Instagram'); se(p.site, 'site');
      se(i.resp_nome, 'responsável'); se(i.resp_whatsapp, 'WhatsApp do responsável'); se(i.resp_email, 'e-mail do responsável'); }
    if (bloco === 'marca') { se(d.cliente.logo_url, 'logo'); se((m.cores || []).length, 'cores'); se(m.fonte_titulo || m.fonte_texto, 'fontes'); se(m.link, 'material da marca'); }
    if (bloco === 'equipe') FUNCOES.forEach(([k, r]) => se(d.equipe[k], r.toLowerCase()));
    if (bloco === 'obs') { se(i.observacoes, 'observações'); se(i.combinado, 'o que foi combinado'); }
    return f;
  }

  function ver(bloco, d) {
    const i = d.interno, p = d.perfil, c = d.cliente;
    if (bloco === 'cliente') {
      const h = D(), modos = h.rotulosModo ? h.rotulosModo(c.modo) : c.modo, wa = soNum(i.resp_whatsapp);
      const resp = (i.resp_nome || wa || i.resp_email) ? '<div class="cd-contato"><span class="cd-av" aria-hidden="true">' + esc(iniciais(i.resp_nome) || '?') + '</span>' +
        '<span class="cd-contato-tx"><b>' + (txt(i.resp_nome) || 'Responsável sem nome') + '</b>' + (i.resp_cargo ? '<small>' + esc(i.resp_cargo) + '</small>' : '') + '</span>' +
        '<span class="cd-contato-bt">' +
          (wa ? '<a class="b fina contorno" href="https://wa.me/' + esc(wa.length <= 11 ? '55' + wa : wa) + '" target="_blank" rel="noopener noreferrer">' + esc(fmtFone(wa)) + '</a>' : '') +
          (i.resp_email ? '<a class="b fina contorno" href="mailto:' + esc(i.resp_email) + '">' + esc(i.resp_email) + '</a>' : '') + '</span></div>' : '';
      return '<p class="cd-chips"><span class="cd-chip">' + rotuloContrato(c.contrato, i.contrato_meses) + '</span>' +
          String(modos || '').split(' · ').filter(Boolean).map(x => '<span class="cd-chip">' + esc(x) + '</span>').join('') + '</p>' +
        lista(linhaV('Área de atuação', txt(p.nicho)) + linhaV('CNPJ', txt(fmtCnpj(i.cnpj))) + linhaV('Cidade / estado', txt(i.cidade)) +
          linhaV('Início do serviço', txt(fmtData(i.inicio_servico))) +
          linhaV('Instagram', p.instagram ? linkExt('https://instagram.com/' + encodeURIComponent(p.instagram), '@' + p.instagram) : '') + linhaV('Site', linkExt(p.site))) +
        resp + falta(faltando('cliente', d));
    }
    if (bloco === 'marca') {
      const m = d.marca;
      if (!temAlgo('marca', d)) return convite('Guarde aqui a logo, as cores e as fontes do cliente. Fica à mão para o design.');
      return (c.logo_url ? '<img class="cd-logo" src="' + esc(c.logo_url) + '" alt="Logo de ' + esc(c.nome) + '">' : '') +
        ((m.cores || []).length ? '<div class="cd-amostras">' + m.cores.map(x => validar.cor(x.hex)
          ? '<button type="button" class="cd-amostra" data-cd-copiar="' + esc(x.hex) + '" title="Copiar o código" aria-label="Copiar ' + esc(x.hex) + (x.nome ? ' (' + esc(x.nome) + ')' : '') + '"><i style="background:' + esc(x.hex) + '"></i><b>' + esc(x.hex) + '</b>' + (x.nome ? '<small>' + esc(x.nome) + '</small>' : '') + '</button>' : '').join('') + '</div>' : '') +
        lista(linhaV('Fonte dos títulos', txt(m.fonte_titulo)) + linhaV('Fonte dos textos', txt(m.fonte_texto)) +
          linhaV('Material da marca', m.link ? linkExt(m.link, 'Abrir o material') : '') + linhaV('Estilo', multi(m.estilo))) + falta(faltando('marca', d));
    }
    if (bloco === 'pacote') {
      const p2 = d.pacote;
      if (!p2.pacote_id) return convite('Sem serviços contratados definidos, o cliente fica fora do Contratado × entregue. Escolha o que ele contratou para a Gestão acompanhar a entrega.');
      const total = (p2.itens || []).reduce((n, x) => n + (Number(x.qtd) || 0), 0);
      return '<p class="cd-pc-nome"><b>' + esc(p2.nome || 'Serviços') + '</b>' + (p2.arquivado ? ' <span class="cd-tag">arquivado</span>' : '') + (p2.ajustado ? ' <span class="cd-tag on">ajustado para este cliente</span>' : '') + '</p>' +
        '<div class="cd-qtds" role="list" aria-label="Entrega do mês">' + (p2.itens || []).map(x => '<span class="cd-qt" role="listitem"><b>' + (Number(x.qtd) || 0) + '</b><small>' + esc(tiposPl(x.tipo)) + (x.tipo === 'Reel' && x.producao === 'edicao' ? ' · só edição' : '') + '</small></span>').join('') +
          '<span class="cd-qt total" role="listitem"><b>' + total + '</b><small>no mês</small></span></div>' +
        (p2.ajustado ? '<p class="cd-pc-padrao">No padrão: ' + esc(B7.Pacotes.resumo({ itens: p2.padrao })) + '.' + (d.pode_editar ? ' <button type="button" class="cb-link" data-cd-padrao>Voltar ao padrão</button>' : '') + '</p>' : '') +
        '<p class="cd-pc-desde">' + (p2.desde ? 'Vale desde ' + esc(fmtData(p2.desde)) + '.' : 'Conta desde sempre.') + '</p>';
    }
    if (bloco === 'equipe' && !temAlgo('equipe', d)) return convite('Diga quem cuida deste cliente na B7: coordenação, design e vídeo.');
    if (bloco === 'equipe') return '<ul class="cd-eq">' + FUNCOES.map(([f, r]) => { const e = d.equipe[f];
      return '<li' + (e ? '' : ' class="sem"') + '><span class="cd-av" aria-hidden="true">' + (e ? esc(iniciais(e.nome)) : '') + '</span><span><b>' + (e ? esc(e.nome) : 'Ninguém definido') + '</b><small>' + r + '</small></span></li>'; }).join('') + '</ul>';
    if (!temAlgo('obs', d)) return convite('Anote as particularidades e o que ficou combinado com o cliente. O tom de voz fica na linha editorial.');
    return lista(linhaV('Observações', multi(i.observacoes)) + linhaV('O que foi combinado', multi(i.combinado))) + falta(faltando('obs', d));
  }
  const temAlgo = (bloco, d) => bloco === 'cliente' ? faltando('cliente', d).filter(x => x !== 'duração do contrato').length < 9
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
    const SUB = { cliente: 'Empresa e responsável', marca: 'Logo, cores e fontes', pacote: 'A entrega mínima do mês', equipe: 'Quem cuida da conta na B7', obs: 'O combinado e o que é bom lembrar' };
    const cab = (k, r, cheio) => '<header class="cd-b-cab"><div><h2>' + esc(r) + '</h2><small>' + esc(SUB[k] || '') + '</small></div>' +
      (pode && aberto !== k ? '<button type="button" class="b fina contorno' + (cheio ? '' : ' cd-completar') + '" data-cd-editar="' + k + '">' + (cheio ? 'Editar' : 'Completar') + '</button>' : '') + '</header>';
    const BOTOES = '<div class="acoes"><button class="b" data-cd-cancelar>Cancelar</button><button class="b pri" data-cd-salvar>Salvar</button></div>';
    const bloco = k => { const [, r] = BLOCOS.find(b => b[0] === k), cheio = temAlgo(k, d);
      return '<section class="cd-b cd-b-' + k + (aberto === k ? ' editando' : '') + (cheio ? '' : ' cd-pend') + '" data-cd-bloco="' + k + '">' + cab(k, r, cheio) +
        (aberto === k ? '<div class="cd-b-ed" data-cd-ed>' + campos(k, d, cx) + BOTOES + '</div>' : '<div class="cd-b-ver">' + ver(k, d) + '</div>') + '</section>'; };
    const fixa = () => { const g = op.gravacaoFixa; if (!g) return '';
      const on = !!(g.atual && g.atual.ativa);
      return '<section class="cd-b cd-b-fixa' + (aberto === 'fixa' ? ' editando' : '') + (on ? '' : ' cd-pend') + '" data-cd-bloco="fixa"><header class="cd-b-cab"><div><h2>Gravação fixa</h2><small>O sistema cria a gravação sozinho</small></div>' +
        (aberto !== 'fixa' ? '<button type="button" class="b fina contorno' + (on ? '' : ' cd-completar') + '" data-cd-editar="fixa">' + (on ? 'Editar' : 'Completar') + '</button>' : '') + '</header>' +
        (aberto === 'fixa' ? '<div class="cd-b-ed" data-cd-ed>' + g.html(g.atual) + BOTOES + '</div>'
          : '<div class="cd-b-ver">' + (on ? '<p class="cd-pc-nome"><b>' + esc(g.resumo(g.atual)) + '</b></p>' : convite('Sem dia fixo. Se o cliente grava sempre no mesmo dia, o sistema pode criar a gravação sozinho.')) + '</div>') + '</section>'; };
    function resumo() {
      const feitos = BLOCOS.filter(([k]) => temAlgo(k, d)), pend = BLOCOS.filter(([k]) => !temAlgo(k, d));
      return '<header class="cd-resumo"><div class="cd-resumo-tx"><b>' + (pend.length ? 'Cadastro com ' + feitos.length + ' de ' + BLOCOS.length + ' partes preenchidas' : 'Cadastro completo') + '</b>' +
        '<small>' + (pend.length ? 'Falta ' + pend.map(b => b[1].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' e $1') + '.' : 'Tudo o que a equipe precisa está aqui.') + '</small></div>' +
        '<ol class="cd-prog" aria-label="Partes do cadastro">' + BLOCOS.map(([k, r]) => '<li class="' + (temAlgo(k, d) ? 'ok' : '') + '">' +
          (pode && !temAlgo(k, d) ? '<button type="button" data-cd-editar="' + k + '" title="Completar ' + esc(r) + '">' + esc(r) + '</button>' : '<span>' + esc(r) + '</span>') + '</li>').join('') + '</ol>' +
        /* 4.89.0: o que já está preenchido no Núcleo 7 vem para cá */
        (pode && B7.N7Puxar ? '<button type="button" class="b fina contorno cd-n7" data-cd-n7>Puxar do Núcleo 7</button>' : '') + '</header>';
    }
    function pintar() {
      /* editando: o bloco ocupa a largura toda, no topo; os outros continuam nas duas colunas */
      const emEdicao = aberto ? (aberto === 'fixa' ? fixa() : bloco(aberto)) : '';
      const col = ks => ks.filter(k => k !== aberto).map(k => (k === 'fixa' ? fixa() : bloco(k))).join('');
      alvo.innerHTML = '<div class="cd-ficha">' + resumo() + emEdicao +
        '<div class="cd-cols"><div class="cd-col">' + col(['cliente', 'obs']) + '</div><div class="cd-col">' + col(['pacote', 'equipe', 'marca', 'fixa']) + '</div></div></div>';
      alvo.querySelectorAll('[data-cd-editar]').forEach(b => b.onclick = () => { aberto = b.dataset.cdEditar; pintar(); const ed = alvo.querySelector('[data-cd-ed]'); const f = ed && ed.querySelector('input, select, textarea'); if (f) f.focus();
        const sec = alvo.querySelector('.cd-b.editando'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      alvo.querySelectorAll('[data-cd-copiar]').forEach(b => b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.cdCopiar); B7.UI.toast(b.dataset.cdCopiar + ' copiado'); } catch (e) { B7.UI.toast('Não deu para copiar', { tipo: 'erro' }); } });
      const n7 = alvo.querySelector('[data-cd-n7]');
      if (n7) n7.onclick = () => B7.N7Puxar.um(id, d.cliente.nome, novo => {
        const mudouTopo = novo && novo.cliente && novo.cliente.logo_url !== d.cliente.logo_url;
        if (novo) d = novo; aberto = null;
        if (mudouTopo && op.aoMudarCliente) return op.aoMudarCliente();
        pintar(); });
      const pad = alvo.querySelector('[data-cd-padrao]');
      if (pad) pad.onclick = async () => {
        if (!(await B7.UI.confirmar({ titulo: 'Voltar ao padrão?', texto: 'As quantidades ajustadas deste cliente serão descartadas.', rotulo: 'Voltar ao padrão' }))) return;
        try { d = await B7.Save.acao(() => B7.DB.salvarCadastro(id, { pacote: { ajuste: null } }), 'Serviços de volta ao padrão'); pintar(); } catch (e) { avisoErro(e); }
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
