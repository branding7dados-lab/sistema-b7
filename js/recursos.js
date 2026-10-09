/* =====================================================================
   RECURSOS E TEXTOS PADRÃO (zzz129) — duas coisas que o administrador
   ajusta para a agência inteira, em Configurações → Admin. As duas moram
   em sistema_config e só o administrador grava (o banco confere).

   B7.Recursos — para quem um recurso aparece: todos, só uma pessoa,
     administradores + funções escolhidas, ou ninguém. É um controle de
     LANÇAMENTO, não de acesso: não dá a ninguém o que o módulo e o banco
     já não dão; só esconde a entrada de quem ainda não deve ver. Os
     recursos de IA são conferidos de novo no servidor (b7-ia).
       B7.Recursos.ligado('tv')

   B7.Textos — as mensagens prontas para o cliente e as frases do Portal.
     Cada texto tem um padrão aqui; o que o administrador reescreveu vem
     do banco e substitui o padrão. {palavras} entre chaves são trocadas
     pelo dado de verdade na hora de usar.
       B7.Textos.ler('semana_mensagem', { periodo: '06 a 10 de outubro' })
   ===================================================================== */
window.B7 = window.B7 || {};

B7.Recursos = (function () {
  const LISTA = [
    { id: 'conversas', nome: 'Conversas da equipe', d: 'o chat interno, no botão ao lado do sino' },
    { id: 'tv', nome: 'Painel de TV', d: 'a tela da agência para deixar aberta, em Configurações → Geral' },
    { id: 'hoje_dia', nome: '“Hoje é dia de…” no Painel', d: 'a data do dia no cabeçalho do Painel' },
    { id: 'ia_voz', nome: 'Falar com o assistente', d: 'o microfone no campo de mensagem', ia: true },
    { id: 'ia_imagem', nome: 'Imagem no assistente', d: 'anexar ou colar um print na conversa', ia: true },
    { id: 'ia_ouvir', nome: 'Ouvir a resposta do assistente', d: 'o botão Ouvir em cada resposta' },
    { id: 'ia_ideias', nome: 'Ideias de conteúdo nas Oportunidades', d: 'as três ideias da IA na folha da data', ia: true },
    { id: 'ia_roteiro_conteudo', nome: 'Criar roteiro com IA pelo conteúdo', d: 'o botão no conteúdo da linha editorial' }
  ];
  const FUNCOES = [['coordenador', 'Coordenação'], ['videomaker', 'Videomakers'], ['designer', 'Designers']];

  let mem = null;
  const valor = () => mem || (B7.pref ? B7.pref.ler('sis_recursos', null) : null) || {};
  function definirLocal(v) { mem = v || {}; if (B7.pref) B7.pref.gravar('sis_recursos', mem); }

  /* a mesma conta que o servidor faz (supabase/functions/b7-ia) */
  function ligado(id) {
    const r = valor()[id];
    if (!r || !r.modo || r.modo === 'todos') return true;
    if (r.modo === 'desligado') return false;
    const A = B7.Auth, u = A && A.usuario && A.usuario();
    if (!u) return false;
    if (r.modo === 'eu') return r.pessoa === u.id;
    const admin = !!(A.ehAdminReal ? A.ehAdminReal() : A.ehAdmin && A.ehAdmin());
    if (admin && !(A.emSimulacao && A.emSimulacao())) return true;
    const f = A.funcao ? A.funcao() : null;
    return !!f && (r.funcoes || []).includes(f);
  }

  function rotulo(id) {
    const r = valor()[id];
    if (!r || !r.modo || r.modo === 'todos') return 'Todos';
    if (r.modo === 'desligado') return 'Desligado';
    if (r.modo === 'eu') { const u = B7.Auth.usuario(); return u && r.pessoa === u.id ? 'Só você' : 'Só uma pessoa'; }
    const fs = (r.funcoes || []).map(f => (FUNCOES.find(x => x[0] === f) || [f, f])[1]);
    return fs.length ? 'Admin + ' + fs.join(', ') : 'Só administradores';
  }

  async function sincronizar() {
    if (!B7.sb) return;
    try {
      const { data } = await B7.sb.from('sistema_config').select('valor').eq('chave', 'recursos').maybeSingle();
      definirLocal((data && data.valor) || {});
    } catch (e) {}
  }

  /* grava UM recurso (o resto vai junto, como está) — só administrador passa no banco */
  async function definir(id, regra) {
    const novo = Object.assign({}, valor());
    if (!regra || regra.modo === 'todos') delete novo[id]; else novo[id] = regra;
    await B7.DB.rpc('sistema_config_definir', { p_chave: 'recursos', p_valor: novo });
    await sincronizar();
  }

  return { LISTA, FUNCOES, ligado, rotulo, regra: id => valor()[id] || { modo: 'todos' }, sincronizar, definir };
})();

B7.Textos = (function () {
  /* grupo, nome, para que serve, as {palavras} aceitas e o texto padrão
     (o mesmo que a tela usava antes de existir esta edição) */
  const LISTA = [
    { id: 'design_aprovacao_uma', grupo: 'Mensagens para o cliente', nome: 'Arte pronta para aprovação', onde: 'Design → “Copiar mensagem”, uma arte',
      vars: ['titulo', 'tipo'],
      padrao: 'Olá! A arte "{titulo}" ({tipo}) está pronta para a sua aprovação. Pode nos dizer se está aprovada ou se precisa de algum ajuste?' },
    { id: 'design_lembrete_uma', grupo: 'Mensagens para o cliente', nome: 'Lembrete de arte aguardando', onde: 'Design → “Copiar mensagem”, quando a arte já tinha sido enviada',
      vars: ['titulo', 'tipo'],
      padrao: 'Olá! Passando para lembrar da arte "{titulo}" ({tipo}), que está aguardando a sua aprovação. Pode nos dizer se está aprovada ou se precisa de algum ajuste?' },
    { id: 'design_aprovacao_varias', grupo: 'Mensagens para o cliente', nome: 'Várias artes prontas', onde: 'Design → “Copiar mensagem”, mais de uma arte',
      vars: ['quantidade', 'lista'],
      padrao: 'Olá! Temos {quantidade} artes prontas para a sua aprovação:\n{lista}\nPode nos dizer se estão aprovadas ou se alguma precisa de ajuste?' },
    { id: 'design_lembrete_varias', grupo: 'Mensagens para o cliente', nome: 'Lembrete de várias artes', onde: 'Design → “Copiar mensagem”, quando todas já tinham sido enviadas',
      vars: ['quantidade', 'lista'],
      padrao: 'Olá! Passando para lembrar das {quantidade} artes que estão aguardando a sua aprovação:\n{lista}\nPode nos dizer se estão aprovadas ou se alguma precisa de ajuste?' },
    { id: 'semana_mensagem', grupo: 'Mensagens para o cliente', nome: 'Status semanal', onde: 'Status semanal → Exportar → “Copiar mensagem”',
      vars: ['periodo'],
      padrao: 'Olá! Segue o acompanhamento das demandas desta semana, de {periodo}. Qualquer atualização, estamos à disposição.' },
    { id: 'acesso_entrega', grupo: 'Mensagens para o cliente', nome: 'Entrega de usuário e senha', onde: 'Usuários → conta criada ou senha redefinida → “Copiar usuário e senha”',
      vars: ['usuario', 'senha'],
      padrao: 'Usuário: {usuario}\nSenha: {senha}' },
    { id: 'portal_boas_vindas', grupo: 'Portal do cliente', nome: 'Frase de entrada', onde: 'Portal → início, abaixo do “Olá”',
      vars: ['empresa'],
      padrao: 'Acompanhe a produção da {empresa}.' },
    { id: 'portal_pausado', grupo: 'Portal do cliente', nome: 'Serviço pausado', onde: 'Portal → cliente pausado (se o cliente não tiver mensagem própria)',
      vars: [],
      padrao: 'O acompanhamento está suspenso no momento. Nada foi perdido: seus materiais continuam guardados.' },
    { id: 'portal_encerrado', grupo: 'Portal do cliente', nome: 'Serviço encerrado', onde: 'Portal → cliente cancelado (se o cliente não tiver mensagem própria)',
      vars: [],
      padrao: 'Seu serviço com a Branding7 foi encerrado. O histórico permanece guardado.' },
    { id: 'portal_contato', grupo: 'Portal do cliente', nome: 'Como falar com a agência', onde: 'Portal → abaixo do aviso de pausa ou encerramento',
      vars: [],
      padrao: 'Fale com a Branding7 para mais informações.' }
  ];
  const POR_ID = {}; LISTA.forEach(t => { POR_ID[t.id] = t; });
  const LIMITE = 800;

  let mem = null;
  const valor = () => mem || (B7.pref ? B7.pref.ler('sis_textos', null) : null) || {};
  function definirLocal(v) { mem = v || {}; if (B7.pref) B7.pref.gravar('sis_textos', mem); }

  const modelo = id => { const v = valor()[id]; return (typeof v === 'string' && v.trim()) ? v : (POR_ID[id] ? POR_ID[id].padrao : ''); };
  /* troca {palavra} pelo dado; palavra desconhecida fica como está (dá para ver o erro de digitação) */
  function montar(texto, dados) {
    return String(texto || '').replace(/\{([a-z_]+)\}/g, (tudo, k) => (dados && dados[k] !== undefined && dados[k] !== null) ? String(dados[k]) : tudo);
  }
  const ler = (id, dados) => montar(modelo(id), dados);

  async function sincronizar() {
    if (!B7.sb || !B7.DB || !B7.DB.rpc) return;
    try { definirLocal((await B7.DB.rpc('textos_padrao')) || {}); } catch (e) {}
  }

  /* grava o conjunto (só o que difere do padrão) — só administrador passa no banco */
  async function gravar(novos) {
    const limpo = {};
    Object.keys(novos || {}).forEach(id => {
      const t = POR_ID[id], v = String(novos[id] || '');
      if (t && v.trim() && v !== t.padrao) limpo[id] = v.slice(0, LIMITE);
    });
    await B7.DB.rpc('sistema_config_definir', { p_chave: 'textos', p_valor: limpo });
    await sincronizar();
  }

  return { LISTA, LIMITE, ler, modelo, montar, mudado: id => modelo(id) !== (POR_ID[id] || {}).padrao, sincronizar, gravar };
})();
