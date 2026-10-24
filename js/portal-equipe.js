/* =====================================================================
   PORTAL — PAPÉIS E EQUIPE DA EMPRESA (zzz261)

   Cada pessoa do cliente tem, em cada empresa, um papel:
     • Dono   — vê tudo, aprova e cuida da equipe (convida, muda o
                papel, gera senha nova, tira do portal);
     • Gestor — vê tudo e aprova;
     • Equipe — vê e comenta; a aprovação fica com dono ou gestor.
   O papel vem da sessão (minhas_empresas → papel) e quem confere é o
   banco (aprov_pode_decidir, cliente_definir_papel) e a b7-auth
   (convite, senha nova, remover). Aqui é só a tela.

   Também aqui: o aviso "troque a senha que você recebeu", enquanto a
   conta estiver com a senha provisória.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.PortalEquipe = (function () {
  const esc = s => B7.UI.esc(s);
  const SITE = 'https://branding7dados-lab.github.io/sistema/';
  const PAPEIS = {
    dono:   { nome: 'Dono',   txt: 'Vê tudo, aprova e cuida da equipe da empresa.' },
    gestor: { nome: 'Gestor', txt: 'Vê tudo e aprova os materiais.' },
    equipe: { nome: 'Equipe', txt: 'Vê e comenta. A aprovação fica com o dono ou o gestor.' }
  };

  /* Papel da pessoa numa empresa. Sessão antiga (sem o campo) segue o
     "pode aprovar" da conta, como antes. Quem não é cliente aprova. */
  function papelEm(clientId) {
    const u = (B7.Auth && B7.Auth.usuario()) || {};
    if (u.papel !== 'cliente') return 'b7';
    const e = (u.empresas || []).find(x => x.id === clientId);
    if (!e) return null;
    return e.papel || (u.pode_aprovar ? 'gestor' : 'equipe');
  }
  const podeAprovarEm = id => { const p = papelEm(id); return p === 'b7' || p === 'dono' || p === 'gestor'; };
  const souDonoDe = id => papelEm(id) === 'dono';
  const nomePapel = p => (PAPEIS[p] || {}).nome || '';

  function quando(iso) {
    if (!iso) return 'ainda não entrou';
    return 'último acesso ' + B7.UI.quando(iso);
  }

  /* --------------------------------------------- senha provisória */
  function avisoSenha() {
    const antigo = document.getElementById('pt-aviso-senha');
    const u = B7.Auth && B7.Auth.usuario();
    const precisa = u && u.papel === 'cliente' && u.senha_provisoria && !(B7.Portal && B7.Portal.emPrevia());
    if (!precisa) { if (antigo) antigo.remove(); return; }
    if (antigo) return;
    const tela = document.getElementById('tela-dashboard');
    if (!tela) return;
    const b = document.createElement('div');
    b.id = 'pt-aviso-senha';
    b.className = 'pt-aviso-senha';
    b.setAttribute('role', 'status');
    b.innerHTML = '<div class="pt-banner-tx"><b>Crie a sua senha</b>' +
      '<span>Você entrou com a senha que recebeu. Troque por uma só sua: leva um minuto.</span></div>' +
      '<button type="button" class="b pri fina">Trocar senha</button>';
    b.querySelector('button').onclick = () => { if (B7.Perfil) B7.Perfil.abrir('seguranca'); else B7.Auth.abrirPerfil(); };
    tela.insertBefore(b, tela.firstChild);
  }
  /* a b7-auth já desmarcou no banco; aqui só a sessão em memória e o aviso */
  function senhaTrocada() {
    const u = B7.Auth && B7.Auth.usuario();
    if (u) u.senha_provisoria = false;
    avisoSenha();
  }

  /* zzz262: boas-vindas no primeiro acesso. Aparece uma vez por pessoa
     neste aparelho (e nunca na prévia): o que é o portal e onde ficam as
     coisas, no papel que a pessoa tem na empresa aberta. */
  function boasVindas() {
    const u = B7.Auth && B7.Auth.usuario();
    if (!u || u.papel !== 'cliente' || (B7.Portal && B7.Portal.emPrevia())) return;
    const chave = 'b7-portal-boasvindas-' + u.id;
    try { if (localStorage.getItem(chave)) return; } catch (e) { return; }
    if (document.querySelector('.fundo-modal')) return;
    const emp = B7.Portal && B7.Portal.empresa();
    const id = emp && emp.id;
    const aprova = podeAprovarEm(id), dono = souDonoDe(id);
    const itens = [
      ['Aprovações', aprova ? 'Tudo o que a B7 manda para você aprovar: aprove ou peça ajustes num clique.'
                            : 'Veja o que a B7 enviou e deixe seus comentários. Quem decide é o dono ou o gestor.'],
      ['Calendário', 'O mês inteiro num olhar: o que vai ao ar em cada dia e as gravações.'],
      ['Pedidos', 'Precisa de algo novo? Peça aqui e acompanhe até ficar pronto.'],
      ['Linha editorial e produção', 'Acompanhe o planejamento e cada conteúdo, do roteiro até a publicação.'],
      ['Gravações', 'Datas, local e o que vai ser gravado em cada dia.']
    ];
    if (dono) itens.push(['Equipe', 'Convide as pessoas da sua empresa e escolha o que cada uma pode fazer.']);
    itens.push(['Suporte', 'Dúvida ou pedido? Fale com a B7 por aqui.']);
    const nome = String(u.nome || '').split(' ')[0];
    const m = B7.UI.modal(
      '<h3>Boas-vindas' + (nome ? ', ' + esc(nome) : '') + '!</h3>' +
      '<p class="sub">Este é o portal ' + (emp ? 'da ' + esc(emp.nome) + ' ' : '') + 'na Branding7. Aqui você acompanha tudo o que estamos produzindo.' +
        '</p>' +
      '<ol class="pt-bv">' + itens.map(([t, d]) => '<li><b>' + esc(t) + '</b><span>' + esc(d) + '</span></li>').join('') + '</ol>' +
      '<div class="acoes">' + (u.senha_provisoria
        ? '<button class="b" data-fecha>Depois</button><button class="b pri" data-senha>Criar minha senha</button>'
        : '<button class="b pri" data-fecha>Começar</button>') + '</div>', { extra: 'pt-bv-modal' });
    try { localStorage.setItem(chave, '1'); } catch (e) {}
    const bt = m.querySelector('[data-senha]');
    if (bt) bt.onclick = () => { m.fechar(); if (B7.Perfil) B7.Perfil.abrir('seguranca'); else B7.Auth.abrirPerfil(); };
  }

  /* --------------------------------------------- tela Minha equipe */
  async function abrir() {
    const P = B7.Portal;
    P.marcarNav(P.rota('equipe'));
    const emp = P.empresa();
    const previa = P.emPrevia();
    if (!emp) return P.abrirHome();
    if (!previa && !souDonoDe(emp.id)) {
      B7.UI.toast('A equipe da empresa fica com o dono.', { tipo: 'erro' });
      location.replace(P.rota(''));
      return;
    }
    if (emp.servico && emp.servico !== 'ativo') return P.telaServico(emp);
    const painel = document.getElementById('painel-dashboard');
    painel.innerHTML = '<div class="conteudo portal-home"><span class="sr-only">Carregando a equipe…</span>' + B7.UI.skeleton('lista', { n: 3 }) + '</div>';
    const vale = B7.Rota.marca();
    let pessoas;
    try { pessoas = await B7.DB.rpc('cliente_pessoas', { p_client: emp.id }); }
    catch (e) {
      if (!vale()) return;
      painel.innerHTML = '<div class="conteudo entra portal-home"><div class="pt-vazio pt-erro" role="alert"><b>Não foi possível carregar a equipe</b>' +
        '<p>' + esc(e.message || 'Tente de novo em instantes.') + '</p><div class="acoes"><button type="button" class="b pri" data-tentar>Tentar de novo</button></div></div></div>';
      painel.querySelector('[data-tentar]').onclick = abrir;
      return;
    }
    if (!vale()) return;
    pessoas = pessoas || [];
    const acoes = !previa;
    const donos = pessoas.filter(p => p.papel === 'dono').length;

    const cartao = p => {
      const sozinhoDono = p.papel === 'dono' && donos < 2;
      return '<div class="pq-pessoa" data-id="' + esc(p.id) + '">' +
        B7.UI.avatarPessoa(p, 'pq-av') +
        '<div class="pq-id"><b>' + esc(p.nome || p.username) + (p.sou_eu ? ' <small class="pq-voce">você</small>' : '') + '</b>' +
          '<span>@' + esc(p.username) + ' · ' + esc(quando(p.ultimo_acesso)) +
            (p.senha_provisoria && !p.sou_eu ? ' · <em>senha provisória</em>' : '') +
            (p.estado !== 'ativa' ? ' · <em>desativada</em>' : '') + '</span></div>' +
        (acoes && !p.sou_eu
          ? '<select class="campo fina pq-papel" aria-label="Papel de ' + esc(p.nome) + '"' + (sozinhoDono ? ' disabled title="A empresa precisa de pelo menos um dono"' : '') + '>' +
              Object.keys(PAPEIS).map(k => '<option value="' + k + '"' + (k === p.papel ? ' selected' : '') + '>' + PAPEIS[k].nome + '</option>').join('') +
            '</select>' +
            '<div class="pq-bts"><button type="button" class="b fina contorno" data-senha>Senha nova</button>' +
            '<button type="button" class="b fina contorno perigo" data-tirar' + (sozinhoDono ? ' disabled' : '') + '>Tirar</button></div>'
          : '<span class="pq-tag pq-' + esc(p.papel) + '">' + esc(nomePapel(p.papel)) + '</span>') +
      '</div>';
    };

    painel.innerHTML = '<div class="conteudo entra portal-home">' +
      '<header class="ph-cab com-acao"><div><h1>Equipe da empresa</h1>' +
        '<p class="ph-emp">Quem da ' + esc(emp.nome) + ' acessa o portal, e o que cada um pode fazer.</p></div>' +
        (acoes ? '<button type="button" class="b pri" data-convidar>Convidar pessoa</button>' : '') + '</header>' +
      (previa ? '<p class="pt-nada">Prévia: o dono da empresa vê esta lista e pode convidar, mudar papéis e tirar pessoas.</p>' : '') +
      '<section class="pq-lista">' + (pessoas.length ? pessoas.map(cartao).join('')
        : '<p class="pt-nada">Ninguém da empresa tem acesso ainda.</p>') + '</section>' +
      '<section class="pq-legenda">' + Object.keys(PAPEIS).map(k =>
        '<div><span class="pq-tag pq-' + k + '">' + PAPEIS[k].nome + '</span><p>' + esc(PAPEIS[k].txt) + '</p></div>').join('') +
      '</section>' +
      '<p class="pt-nada">A Branding7 é avisada quando alguém entra ou sai da equipe.</p>' +
    '</div>';

    if (!acoes) return;
    painel.querySelector('[data-convidar]').onclick = () => convidar(emp);
    painel.querySelectorAll('.pq-pessoa').forEach(el => {
      const p = pessoas.find(x => x.id === el.dataset.id);
      const sel = el.querySelector('.pq-papel');
      if (sel) sel.onchange = async () => {
        const novo = sel.value;
        if (novo === 'dono' && !(await B7.UI.confirmar({ titulo: 'Tornar ' + p.nome + ' dono?',
            texto: 'Ele(a) também vai poder convidar, mudar papéis e tirar pessoas da equipe.', rotulo: 'Tornar dono' }))) { sel.value = p.papel; return; }
        try {
          await B7.DB.rpc('cliente_definir_papel', { p_client: emp.id, p_perfil: p.id, p_papel: novo });
          B7.UI.toast(p.nome + ' agora é ' + nomePapel(novo));
          abrir();
        } catch (e) { sel.value = p.papel; B7.UI.toast(e.message || 'Não foi possível mudar o papel.', { tipo: 'erro' }); }
      };
      const bs = el.querySelector('[data-senha]');
      if (bs) bs.onclick = async () => {
        if (!(await B7.UI.confirmar({ titulo: 'Gerar uma senha nova para ' + p.nome + '?',
            texto: 'A senha atual deixa de funcionar e a pessoa sai dos aparelhos onde estava. Você recebe a nova para mandar a ela.', rotulo: 'Gerar senha' }))) return;
        try {
          const r = await B7.DB.chamarAuth({ acao: 'cliente_nova_senha', client_id: emp.id, perfil_id: p.id });
          entregar(emp, r, 'Senha nova de ' + (r.nome || p.nome));
          abrir();
        } catch (e) { B7.UI.toast(e.message || 'Não foi possível gerar a senha.', { tipo: 'erro' }); }
      };
      const bt = el.querySelector('[data-tirar]');
      if (bt) bt.onclick = async () => {
        if (!(await B7.UI.confirmar({ titulo: 'Tirar ' + p.nome + ' do portal?',
            texto: 'Ele(a) deixa de acessar a ' + emp.nome + ' na hora. Os comentários que já fez continuam no histórico.', rotulo: 'Tirar do portal', perigo: true }))) return;
        try {
          await B7.DB.chamarAuth({ acao: 'cliente_remover', client_id: emp.id, perfil_id: p.id });
          B7.UI.toast(p.nome + ' não acessa mais o portal');
          abrir();
        } catch (e) { B7.UI.toast(e.message || 'Não foi possível tirar a pessoa.', { tipo: 'erro' }); }
      };
    });
  }

  function convidar(emp) {
    const m = B7.UI.modal(
      '<h3>Convidar pessoa</h3><p class="sub">Ela recebe um usuário e uma senha para entrar no portal da ' + esc(emp.nome) + '.</p>' +
      '<div class="mb"><label class="rot" for="pq-nome">NOME</label><input class="campo" id="pq-nome" maxlength="80" placeholder="Nome e sobrenome" autocomplete="off" data-foco></div>' +
      '<div class="mb"><span class="rot">PAPEL</span><div class="pq-opcoes">' + Object.keys(PAPEIS).map(k =>
        '<label class="pq-opcao"><input type="radio" name="pq-papel" value="' + k + '"' + (k === 'equipe' ? ' checked' : '') + '>' +
        '<span><b>' + PAPEIS[k].nome + '</b><small>' + esc(PAPEIS[k].txt) + '</small></span></label>').join('') + '</div></div>' +
      '<div class="acoes"><button class="b" data-fecha>Cancelar</button><button class="b pri" data-ok>Criar acesso</button></div>');
    const ok = m.querySelector('[data-ok]');
    const ir = async () => {
      const nome = m.querySelector('#pq-nome').value.trim();
      if (nome.length < 2) return B7.UI.toast('Escreva o nome da pessoa', { tipo: 'erro' });
      const papel = (m.querySelector('input[name="pq-papel"]:checked') || {}).value || 'equipe';
      ok.disabled = true; ok.textContent = 'Criando…';
      try {
        const r = await B7.DB.chamarAuth({ acao: 'cliente_convidar', client_id: emp.id, nome, papel });
        m.fechar();
        entregar(emp, r, 'Acesso de ' + r.nome + ' criado');
        if (B7.Portal.empresa() && B7.Portal.empresa().id === emp.id) abrir();
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Criar acesso';
        B7.UI.toast(e.message || 'Não foi possível criar o acesso.', { tipo: 'erro' });
      }
    };
    ok.onclick = ir;
    m.querySelector('#pq-nome').onkeydown = e => { if (e.key === 'Enter') ir(); };
  }

  /* Mostra usuário e senha UMA vez, com copiar e mandar no WhatsApp.
     A senha não fica guardada em lugar nenhum: fechou, só gerando outra. */
  function entregar(emp, r, titulo) {
    const texto = 'Olá, ' + String(r.nome || '').split(' ')[0] + '! Seu acesso ao portal da ' + emp.nome + ' na Branding7:\n\n' +
      'Endereço: ' + SITE + '\nUsuário: ' + r.username + '\nSenha: ' + r.senha + '\n\n' +
      'No primeiro acesso, o portal pede para você criar uma senha só sua.';
    const m = B7.UI.modal(
      '<h3>' + esc(titulo) + '</h3><p class="sub">Mande estes dados para a pessoa. Por segurança, a senha só aparece agora.</p>' +
      '<div class="pq-entrega"><div><small>ENDEREÇO</small><b>' + esc(SITE) + '</b></div>' +
        '<div><small>USUÁRIO</small><b>' + esc(r.username) + '</b></div>' +
        '<div><small>SENHA</small><b class="pq-senha">' + esc(r.senha) + '</b></div></div>' +
      '<div class="acoes"><button class="b contorno" data-copiar>Copiar mensagem</button>' +
        '<a class="b contorno" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(texto) + '">Mandar no WhatsApp</a>' +
        '<button class="b pri" data-fecha>Pronto</button></div>');
    m.querySelector('[data-copiar]').onclick = () => B7.UI.copiarTexto(texto, { msgSucesso: 'Mensagem copiada', msgErro: 'Não foi possível copiar' });
  }

  return { papelEm, podeAprovarEm, souDonoDe, nomePapel, abrir, avisoSenha, senhaTrocada, boasVindas, PAPEIS };
})();
