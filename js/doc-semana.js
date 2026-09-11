/* =====================================================================
   B7 STATUS SEMANAL — documento 4:5, UMA PÁGINA SÓ

   Redesenho: o relatório cliente precisa caber inteiro numa página,
   sempre, mostrando o que vai acontecer na semana — não o que já
   aconteceu. Tipo de atividade e status da tarefa são dois sistemas de
   cor semânticos separados (tokens em TIPOS/SITUACOES abaixo). Cabeçalho
   e faixa do cliente são sempre compactos; o que varia por densidade é
   só o corpo (linhas de dia, espaçamento, tipografia), numa escada de
   níveis medida de verdade — nunca `transform:scale` na página inteira,
   que borra o texto.

   Duas regras que valem para o arquivo inteiro:
   • Campo vazio não aparece. Sem observação, sem linha de observação.
   • A peça é sempre clara na área de conteúdo, mesmo com o sistema em
     dark mode. Os tokens são redefinidos dentro de .pag45.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.DocSemana = (function () {
  const esc = B7.UI.esc;
  const MARCA = 'assets/brand/symbol-color.png';

  /* `document.fonts.ready` só espera as fontes que JÁ foram pedidas —
     se nada na página ainda usou, por exemplo, Archivo 800 (o peso do
     nome do cliente e da data do dia), essa promise resolve na hora,
     sem esperar nada, e só quando o HTML da peça é inserido é que o
     navegador pede o arquivo da fonte pela primeira vez (com
     font-display:swap, mostrando a fonte de fallback até lá). Isso é
     uma corrida de verdade: a medição de densidade pode rodar (e o
     screenshot/canvas pode capturar) ANTES da troca pra fonte real
     acontecer, com a fonte de fallback ocupando menos espaço — e o
     texto real, mais largo/alto, estoura silenciosamente uma página
     que "coube" na medição. Por isso força o carregamento de cada peso
     usado no documento explicitamente, em vez de só esperar o que já
     estava em andamento. */
  async function carregarFontes() {
    if (!(window.document && document.fonts && document.fonts.load)) return;
    const pesos = [
      '400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter',
      '700 16px Archivo', '800 16px Archivo', '900 16px Archivo'
    ];
    try {
      await Promise.all(pesos.map(p => document.fonts.load(p).catch(() => null)));
      await document.fonts.ready;
    } catch (e) { /* segue mesmo assim — melhor tentar montar do que travar */ }
  }
  const LOGO = 'assets/brand/logo-white.png';

  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const MESES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
                       'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const vazio = t => !String(t || '').trim();

  /* Datas puras: '2026-09-07' vira 7 de setembro em qualquer fuso. Passar
     por new Date('2026-09-07') daria 06/09 no horário de Brasília. */
  function partes(iso) {
    const [a, m, d] = String(iso).split('-').map(Number);
    return { ano: a, mes: m, dia: d };
  }
  function diaDaSemana(iso) {
    const p = partes(iso);
    return new Date(Date.UTC(p.ano, p.mes - 1, p.dia)).getUTCDay();
  }
  const curto = iso => {
    const p = partes(iso);
    return String(p.dia).padStart(2, '0') + '/' + String(p.mes).padStart(2, '0');
  };
  /* DD/MM/AAAA — usado na segunda data do Reel (data de postagem),
     onde o dia sozinho (que já aparece na faixa do dia) não basta pra
     deixar claro que é uma data diferente, possivelmente noutra semana. */
  const longa = iso => curto(iso) + '/' + partes(iso).ano;

  /* '07 a 13 de setembro · 2026' — e quando a semana cruza o mês,
     '31 de agosto a 06 de setembro · 2026' */
  function periodoTexto(inicio, fim) {
    const a = partes(inicio), b = partes(fim);
    const dia = n => String(n).padStart(2, '0');
    if (a.mes === b.mes && a.ano === b.ano) {
      return dia(a.dia) + ' a ' + dia(b.dia) + ' de ' + MESES[a.mes - 1] + ' · ' + a.ano;
    }
    if (a.ano === b.ano) {
      return dia(a.dia) + ' de ' + MESES[a.mes - 1] + ' a ' +
             dia(b.dia) + ' de ' + MESES[b.mes - 1] + ' · ' + a.ano;
    }
    return dia(a.dia) + ' ' + MESES_CURTO[a.mes - 1] + ' ' + a.ano + ' a ' +
           dia(b.dia) + ' ' + MESES_CURTO[b.mes - 1] + ' ' + b.ano;
  }

  /* os sete dias do período, em ordem */
  function diasDoPeriodo(inicio, fim) {
    const a = partes(inicio), b = partes(fim);
    const ini = Date.UTC(a.ano, a.mes - 1, a.dia);
    const f = Date.UTC(b.ano, b.mes - 1, b.dia);
    const saida = [];
    for (let t = ini; t <= f; t += 864e5) {
      const d = new Date(t);
      saida.push(d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(d.getUTCDate()).padStart(2, '0'));
    }
    return saida;
  }

  /* =================================================================
     DOIS SISTEMAS DE COR SEPARADOS
     TIPO responde "que tipo de atividade é essa" — aparece como rótulo
     de texto colorido, discreto, nunca em pílula. SITUAÇÃO responde "em
     que pé essa tarefa está" — aparece em pílula forte, com ponto e
     fundo, porque o dono do sistema pediu status extremamente visível.
     A cor nunca carrega a informação sozinha: o texto está sempre lá.
     ================================================================= */
  const TIPOS = {
    'Postagem':  { cor: '#C21C83' },
    'Gravação':  { cor: '#0E8074' },
    'Produção':  { cor: '#6D3FC4' },
    'Aprovação': { cor: '#A8790A' },
    'Ajustes':   { cor: '#D2572B' },
    'Entrega':   { cor: '#1E6FA8' },
    'Reunião':   { cor: '#4A4E8C' },
    'Outro':     { cor: '#6B6478' }
  };
  const corTipo = t => (TIPOS[t] || TIPOS.Outro).cor;

  /* FORMATO agora tem identidade de cor própria (antes era sempre cinza
     neutro) — é a informação que o cliente mais pergunta ("isso é reels
     ou card?"), então o selo de formato ganha o mesmo destaque visual
     que TIPO já tinha. Só se aplica aos formatos que são peça de
     verdade (Card/Carrossel/Reel/Story/Capa de Reel); demandas sem
     formato (Gravação, Reunião, Aprovação…) continuam usando a cor de
     TIPO no lugar — os dois sistemas nunca aparecem ao mesmo tempo na
     mesma linha (ver linhaItem). */
  const FORMATOS = {
    'Card':            { cor: '#C21C83' }, /* magenta — post estático */
    'Carrossel':       { cor: '#6D3FC4' }, /* violeta */
    'Reel':            { cor: '#0E8FA8' }, /* ciano/azul-esverdeado */
    'Story':           { cor: '#B9720A' }, /* âmbar */
    'Capa de Reel':    { cor: '#8A3FA8' }, /* roxo — mesma família de Design */
    'Gravação':        { cor: '#0E8074' }, /* turquesa — mesma cor já usada em TIPOS */
    /* tipos de demanda que antes só existiam como `etapa` (sem selo
       próprio) — agora que a etapa some do editor (ver CORRECOES), o
       próprio `formato` passa a carregar esses tipos, com a mesma cor
       que já usavam em TIPOS, pra não mudar nada visualmente. */
    'Reunião':         { cor: '#4A4E8C' },
    'Aprovação':       { cor: '#A8790A' },
    'Ajustes':         { cor: '#D2572B' },
    'Entrega':         { cor: '#1E6FA8' },
    'Outro':           { cor: '#6B6478' },
    /* espelha o status real da Linha Editorial do cliente (ver
       `itemLinhaEditorial()`) — cor própria, verde-petróleo, pra não se
       confundir com nenhum formato de peça. */
    'Linha editorial': { cor: '#2E7D5B' }
  };
  const corFormato = f => (FORMATOS[f] || {}).cor || null;

  /* =================================================================
     STATUS DE PRODUÇÃO POR FORMATO
     Um Card, um Carrossel, um Reel, uma Story, uma Capa de Reel e uma
     Gravação não passam pelas mesmas etapas — um Card nunca deveria
     mostrar "Gravando", um Carrossel nunca "Editando vídeo". Cada
     formato tem seu próprio vocabulário de status, na ordem real da
     produção. `situacao` continua sendo o campo único e livre de
     sempre (nunca teve constraint no banco) — só o vocabulário
     OFERECIDO no editor passa a depender do contexto (formato, ou a
     etapa quando não há formato, como Gravação/Reunião/Aprovação).

     Rótulos repetidos entre formatos (ex.: "Criando arte" em Card,
     Story e Capa de Reel) são intencionais: o mesmo texto, a mesma cor,
     o mesmo significado — dedup natural na legenda da semana.
     ================================================================= */
  /* Cada situação diz, sem ambiguidade, de quem depende agora: um
     rótulo "... do cliente"/"... pelo cliente" é sempre uma decisão do
     cliente (aprovar, confirmar, validar); todo o resto é trabalho da
     equipe B7. Isso substitui a etapa como forma de dizer "o que é"
     essa demanda — ETAPA saiu do editor (ver CORRECOES): os tipos que
     antes só existiam como etapa (Reunião, Aprovação, Ajustes, Entrega,
     Outro) agora são formato/contexto de pleno direito, com vocabulário
     próprio, igual Card/Reel/Carrossel sempre foram. */
  const ESTAGIOS = {
    'Card': ['A produzir', 'Criando arte', 'Corrigindo arte', 'Revisão interna',
             'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Programado para postagem', 'Postado'],
    'Story': ['A produzir', 'Criando arte', 'Corrigindo arte', 'Revisão interna',
              'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Programado para postagem', 'Postado'],
    'Carrossel': ['A estruturar', 'Criando arte', 'Corrigindo carrossel', 'Revisão interna',
                  'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Programado para postagem', 'Postado'],
    'Reel': ['Escrevendo roteiro', 'A gravar', 'Gravação marcada', 'Gravando', 'Editando vídeo', 'Corrigindo vídeo',
             'Revisão interna', 'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Programado para postagem', 'Postado'],
    'Capa de Reel': ['A produzir', 'Criando capa', 'Corrigindo capa', 'Revisão interna',
                     'Aguardando aprovação do cliente', 'Aprovada pelo cliente', 'Finalizada'],
    'Gravação': ['Escrevendo roteiro', 'A confirmar', 'Gravação marcada', 'Gravando', 'Material captado',
                 'Remarcada', 'Cancelada'],
    'Reunião': ['A agendar', 'Aguardando confirmação do cliente', 'Confirmada pelo cliente',
                'Realizada', 'Remarcada', 'Cancelada'],
    'Aprovação': ['Em preparação', 'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Reprovado pelo cliente'],
    'Ajustes': ['Em desenvolvimento', 'Aguardando validação do cliente', 'Validado pelo cliente', 'Concluído'],
    'Entrega': ['Em preparação', 'Aguardando confirmação do cliente', 'Entregue'],
    /* espelha 1:1 o status real da Linha Editorial do cliente
       (`linhas.status`, ver STATUS_LINHA em conteudo.js) — nunca é
       escolhido manualmente aqui, então nunca sai de sincronia: quando
       a equipe muda o estágio da linha (em criação/revisão) ou o
       cliente aprova, a demanda no Status Semanal muda sozinha (ver
       `itemLinhaEditorial`). */
    'Linha editorial': ['Em criação', 'Em revisão', 'Aprovada', 'Finalizada'],
    /* fallback pra "Outro" e pra qualquer demanda sem contexto reconhecido */
    'Genérico': ['A produzir', 'Em desenvolvimento', 'Revisão interna',
                 'Aguardando aprovação do cliente', 'Aprovado pelo cliente', 'Finalizado']
  };
  /* qual formato/contexto rege o vocabulário de status de uma demanda:
     o campo `formato` quando bate com um contexto conhecido; senão a
     `etapa` — só existe pra dado antigo (de antes da etapa sair do
     editor), quando bate com um contexto conhecido (Gravação, Reunião,
     Aprovação, Ajustes, Entrega); Genérico pra tudo mais (Outro, dado
     sem nenhum dos dois). */
  function contextoDe(it) {
    if (it.formato && ESTAGIOS[it.formato]) return it.formato;
    if (it.etapa && ESTAGIOS[it.etapa]) return it.etapa;
    return 'Genérico';
  }
  const estagiosDe = ctx => ESTAGIOS[ctx] || ESTAGIOS.Genérico;

  /* -----------------------------------------------------------------
     SITUAÇÃO DO STATUS SEMANAL A PARTIR DO STATUS DA LINHA EDITORIAL
     `conteudos.status` (Ideia/Em criação/Em revisão/Aprovado/Programado/
     Publicado — ver STATUS_CONTEUDO em conteudo.js) é um ciclo simples
     e único; cada formato tem um vocabulário de situação bem mais fino
     (ver ESTAGIOS acima). Os rótulos "Revisão interna", "Aprovado pelo
     cliente", "Programado para postagem" e "Postado" são idênticos nos
     quatro formatos de propósito — só o início do vocabulário (Ideia/Em
     criação) muda por formato. É essa função que faz a ponte: dado o
     status do conteúdo e o contexto (formato) da demanda, devolve a
     situação correspondente NESSE vocabulário — sempre uma opção
     válida de `estagiosDe(contexto)`, nunca um rótulo solto. */
  const MAPA_STATUS_CONTEUDO_SITUACAO = {
    'Em revisão': 'Revisão interna',
    'Aprovado': 'Aprovado pelo cliente',
    'Programado': 'Programado para postagem',
    'Publicado': 'Postado'
  };
  function situacaoDeConteudo(statusConteudo, contexto) {
    const estagios = estagiosDe(contexto);
    if (statusConteudo === 'Ideia') return estagios[0];
    if (statusConteudo === 'Em criação') return estagios[1] || estagios[0];
    const alvo = MAPA_STATUS_CONTEUDO_SITUACAO[statusConteudo];
    return (alvo && estagios.includes(alvo)) ? alvo : estagios[0];
  }

  /* Status considerado "trabalho já entregue" — depende do contexto.
     Cancelado/Cancelada é um estado diferente de concluído (não é
     "entregue", é "não vai acontecer") e some do relatório sempre,
     independente do controle de itens concluídos. */
  const TERMINAL_POR_CONTEXTO = {
    'Card': 'Postado', 'Story': 'Postado', 'Carrossel': 'Postado', 'Reel': 'Postado',
    'Capa de Reel': 'Finalizada', 'Gravação': 'Material captado',
    'Reunião': 'Realizada', 'Aprovação': 'Aprovado pelo cliente', 'Ajustes': 'Concluído',
    'Entrega': 'Entregue', 'Linha editorial': 'Finalizada', 'Genérico': 'Finalizado'
  };
  const CONCLUIDOS_LEGADO = ['Concluído', 'Publicado'];
  const CANCELADOS = ['Cancelado', 'Cancelada'];
  function ehConcluido(it) {
    if (CONCLUIDOS_LEGADO.includes(it.situacao)) return true;
    return TERMINAL_POR_CONTEXTO[contextoDe(it)] === it.situacao;
  }
  const ehCancelado = it => CANCELADOS.includes(it.situacao);

  /* Cor por família de significado, não por formato: toda situação que
     depende do CLIENTE (aguardando.../pelo cliente/do cliente) usa a
     mesma família de cor em qualquer contexto — âmbar enquanto espera,
     verde quando o cliente decide a favor, vermelho quando decide
     contra. O que depende só da EQUIPE varia por estágio (cinza = não
     começou, violeta = produzindo, laranja = corrigindo, azul =
     editando, roxo-claro = revisão interna), igual já era. Isso deixa
     visualmente óbvio, em qualquer relatório, o que trava com a B7 e o
     que trava com o cliente. */
  const SITUACOES = {
    'Escrevendo roteiro':       { cor: '#5B5FC7', bg: 'rgba(91,95,199,.12)' },
    'A produzir':               { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'A gravar':                 { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'A confirmar':              { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'A estruturar':             { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'A agendar':                { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'Em preparação':            { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Em criação':               { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Em desenvolvimento':       { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Criando arte':             { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Criando capa':             { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Corrigindo arte':          { cor: '#D2572B', bg: 'rgba(210,87,43,.13)' },
    'Corrigindo carrossel':     { cor: '#D2572B', bg: 'rgba(210,87,43,.13)' },
    'Corrigindo capa':          { cor: '#D2572B', bg: 'rgba(210,87,43,.13)' },
    'Corrigindo vídeo':         { cor: '#D2572B', bg: 'rgba(210,87,43,.13)' },
    'Gravação marcada':         { cor: '#0E8074', bg: 'rgba(14,128,116,.13)' },
    'Gravando':                 { cor: '#B98900', bg: 'rgba(185,137,0,.14)' },
    'Editando vídeo':           { cor: '#2464C7', bg: 'rgba(36,100,199,.12)' },
    'Revisão interna':          { cor: '#8B6FD9', bg: 'rgba(139,111,217,.14)' },
    'Em revisão':               { cor: '#8B6FD9', bg: 'rgba(139,111,217,.14)' },
    /* --- depende do cliente: aguardando (âmbar) --- */
    'Aguardando aprovação do cliente':   { cor: '#C2740A', bg: 'rgba(194,116,10,.14)' },
    'Aguardando confirmação do cliente': { cor: '#C2740A', bg: 'rgba(194,116,10,.14)' },
    'Aguardando validação do cliente':   { cor: '#C2740A', bg: 'rgba(194,116,10,.14)' },
    /* --- depende do cliente: decidiu a favor (verde) --- */
    'Aprovado pelo cliente':    { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    'Aprovada pelo cliente':    { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    'Validado pelo cliente':    { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    'Confirmada pelo cliente':  { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    'Aprovada':                 { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    /* --- depende do cliente: decidiu contra (vermelho) --- */
    'Reprovado pelo cliente':   { cor: '#C23B3B', bg: 'rgba(194,59,59,.14)' },
    /* --- equipe: agendado/entregue/concluído (teal) --- */
    'Programado para postagem': { cor: '#7A3FA0', bg: 'rgba(122,63,160,.14)' },
    'Postado':                  { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Realizada':                { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Entregue':                 { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Finalizada':               { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Finalizado':               { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Concluído':                { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Material captado':         { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Remarcada':                { cor: '#B98900', bg: 'rgba(185,137,0,.14)' },
    'Cancelada':                { cor: '#4A4458', bg: 'rgba(74,68,88,.15)' },
    /* --- legado (dados de antes desta rodada) --- */
    'Previsto':           { cor: '#6B6478', bg: 'rgba(107,100,120,.11)' },
    'Programado':         { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Confirmado':         { cor: '#5B47C4', bg: 'rgba(91,71,196,.12)' },
    'Em produção':        { cor: '#6D3FC4', bg: 'rgba(109,63,196,.12)' },
    'Em andamento':       { cor: '#2464C7', bg: 'rgba(36,100,199,.12)' },
    'Aguardando aprovação': { cor: '#C2740A', bg: 'rgba(194,116,10,.14)' },
    'Aprovado':           { cor: '#2E9E6D', bg: 'rgba(46,158,109,.14)' },
    'Aguardando cliente': { cor: '#C2740A', bg: 'rgba(194,116,10,.14)' },
    'Atenção':            { cor: '#C2185B', bg: 'rgba(194,24,91,.14)' },
    'Publicado':          { cor: '#158F7A', bg: 'rgba(21,143,122,.14)' },
    'Cancelado':          { cor: '#4A4458', bg: 'rgba(74,68,88,.15)' }
  };
  const sitInfo = s => SITUACOES[s] || SITUACOES['A produzir'];
  /* Cor de status pra quem só precisa do tom (ex.: o pontinho da lista
     de itens do editor, fora da peça pro cliente) — mesmo token da
     pílula, sem precisar montar a pílula inteira. */
  const corSituacao = s => sitInfo(s).cor;

  /* Descrição curta pra legenda (só entra quando o nível de densidade
     tem espaço — ver .ps-leg-detalhe/.ps-leg-compacta no CSS). Um
     rótulo compartilhado por formatos diferentes (ex. "Criando arte")
     tem uma descrição só — o significado é o mesmo. */
  const LEGENDA_TEXTO = {
    'Escrevendo roteiro': 'O roteiro do vídeo está sendo escrito.',
    'A produzir': 'A produção da peça ainda não começou.',
    'A gravar': 'O roteiro está pronto; a gravação ainda não foi realizada.',
    'A confirmar': 'A gravação ainda depende de confirmação de data.',
    'A estruturar': 'O conteúdo do carrossel ainda será organizado.',
    'A agendar': 'A reunião ainda não tem data marcada.',
    'Em preparação': 'A equipe B7 está preparando o material.',
    'Em criação': 'A equipe B7 está montando a linha editorial.',
    'Em desenvolvimento': 'A equipe B7 está trabalhando na demanda.',
    'Criando arte': 'A equipe de Design está desenvolvendo a peça.',
    'Criando capa': 'A equipe de Design está desenvolvendo a capa do Reel.',
    'Corrigindo arte': 'A peça está recebendo ajustes visuais.',
    'Corrigindo carrossel': 'O carrossel está recebendo alterações.',
    'Corrigindo capa': 'A capa do Reel está recebendo ajustes.',
    'Corrigindo vídeo': 'O vídeo está recebendo ajustes.',
    'Gravação marcada': 'A captação já está agendada.',
    'Gravando': 'O conteúdo está em processo de captação.',
    'Editando vídeo': 'O material gravado está em edição.',
    'Revisão interna': 'A equipe B7 está revisando o material antes de avançar.',
    'Em revisão': 'A equipe B7 está revisando a linha editorial.',
    'Aguardando aprovação do cliente': 'Depende da aprovação do cliente pra avançar.',
    'Aguardando confirmação do cliente': 'Depende de uma confirmação do cliente.',
    'Aguardando validação do cliente': 'Depende do cliente validar o ajuste feito.',
    'Aprovado pelo cliente': 'O cliente aprovou; segue para a próxima etapa.',
    'Aprovada pelo cliente': 'O cliente aprovou a capa; segue para finalização.',
    'Validado pelo cliente': 'O cliente validou o ajuste feito.',
    'Confirmada pelo cliente': 'O cliente confirmou a reunião.',
    'Aprovada': 'A linha editorial foi aprovada pelo cliente.',
    'Reprovado pelo cliente': 'O cliente pediu para não seguir com isso.',
    'Programado para postagem': 'A publicação já está agendada.',
    'Postado': 'O conteúdo já foi publicado.',
    'Realizada': 'A reunião já aconteceu.',
    'Entregue': 'O material já foi entregue ao cliente.',
    'Finalizada': 'Está pronta/concluída.',
    'Finalizado': 'A demanda foi concluída.',
    'Concluído': 'O ajuste foi concluído.',
    'Material captado': 'O conteúdo já foi gravado.',
    'Remarcada': 'Foi remarcada para uma nova data.',
    'Cancelada': 'Não será realizada.',
    /* legado */
    'Previsto': 'Planejado para a semana.',
    'Programado': 'Preparado para publicação.',
    'Confirmado': 'Data e horário confirmados.',
    'Em andamento': 'Em execução.',
    'Aguardando aprovação': 'O material depende da aprovação do cliente.',
    'Aprovado': 'O conteúdo foi aprovado e segue para programação/entrega.',
    'Aguardando cliente': 'Depende de retorno do cliente.',
    'Atenção': 'Precisa de ação.',
    'Publicado': 'Publicado no canal.',
    'Cancelado': 'Não será realizado.'
  };

  /* Trabalho já concluído (ou cancelado) não é "o que vai acontecer
     nesta semana" — o relatório cliente é sempre olhando pra frente,
     por padrão. Isso NUNCA apaga a demanda: só tira dela da
     apresentação desta peça. O editor (semana.js) continua mostrando
     tudo, sempre. A equipe pode escolher mostrar os concluídos mesmo
     assim (opção "Mostrar itens concluídos") — cancelado nunca aparece,
     é um estado diferente de concluído. */
  function deveExcluir(it, mostrarConcluidos) {
    if (ehCancelado(it)) return true;
    if (!mostrarConcluidos && ehConcluido(it)) return true;
    return false;
  }
  /* mantido por compatibilidade — nada mais no arquivo usa este nome,
     mas evita quebrar qualquer leitura externa que dependesse dele. */
  const EXCLUIR_DO_PLANEJAMENTO = ['Concluído', 'Publicado', 'Cancelado'];

  const ICONE = {
    Reel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg>',
    Card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 10h8M8 14h5"/></svg>',
    Carrossel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="5" width="10" height="14" rx="2.5"/><path d="M4 8v8M20 8v8"/></svg>',
    Story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6.5" y="3.5" width="11" height="17" rx="3"/><path d="M10 7.5h4"/></svg>',
    'Capa de Reel': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M9.5 9l5 3-5 3z" fill="currentColor" stroke="none"/><path d="M3 15.5h18"/></svg>',
    Gravação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="6.5" width="12" height="11" rx="2.5"/><path d="M14.5 10.5l7-3.5v10l-7-3.5z"/></svg>',
    Aprovação: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    Reunião: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="3"/><path d="M3 19v-.8A4.2 4.2 0 0 1 7.2 14h3.6A4.2 4.2 0 0 1 15 18.2V19M16 6.2a3 3 0 0 1 0 5.6M17 14.2a4.2 4.2 0 0 1 4 4.2V19"/></svg>',
    Ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a3 3 0 0 1-3.9 3.9l-6 6V19h2.8l6-6a3 3 0 0 1 3.9-3.9l-2.2 2.2 1.4 1.4z"/></svg>',
    Entrega: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l9-5 9 5-9 5-9-5z"/><path d="M3 8.5V16l9 5 9-5V8.5M12 13.5V21"/></svg>',
    Outro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16h.01"/></svg>',
    'Linha editorial': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 4.5v-1.5M16 4.5v-1.5M7.5 13.5h4M7.5 16.5h7"/></svg>'
  };
  const iconeDe = it => ICONE[it.formato] || ICONE[it.etapa] || ICONE.Outro;

  /* Demanda sintética que espelha o status real da Linha Editorial do
     cliente (`linhas.status`) direto na lista de demandas da semana —
     pedido do Yury: quando a equipe está montando/revisando a linha, ou
     quando o cliente já aprovou/a linha foi finalizada, isso aparece
     junto com as outras demandas, não só como selo no cabeçalho. Nunca
     é uma linha do banco (não tem id de `status_itens`, não pode ser
     editada, movida, duplicada nem excluída no editor) — é sempre
     derivada de `ctx.linha` no momento de montar o relatório, então
     nunca fica dessincronizada: muda sozinha quando a linha muda. Sem
     data própria (a linha editorial não é um evento de um dia só) —
     entra sempre no grupo "sem data". */
  function itemLinhaEditorial(ctx) {
    const l = ctx.linha;
    if (!l || !l.status) return null;
    return {
      id: 'linha-' + l.id, sintetico: true, data: null,
      titulo: l.nome || 'Linha editorial',
      formato: 'Linha editorial', etapa: null,
      situacao: l.status, canal: null, observacao: null
    };
  }

  /* ---------------------------------------------------------- CABEÇA
     Compacta sempre — o cabeçalho não precisa dominar a página pra a
     marca aparecer. Título, período e logo numa faixa só. */
  function cabecalho(ctx) {
    const r = ctx.relatorio;
    return '<div class="ps-cabeca">' +
      '<div class="ps-brilho"></div>' +
      '<div class="ps-cabeca-in">' +
        '<div class="ps-olho"><i></i>B7 / BRANDING7</div>' +
        '<div class="ps-cab-linha"><h1>Status da semana</h1>' +
          '<span class="ps-periodo">' + esc(periodoTexto(r.semana_inicio, r.semana_fim)) + '</span></div>' +
      '</div>' +
      '<img class="ps-logo" src="' + LOGO + '" alt="B7">' +
    '</div>';
  }

  /* ------------------------------------------------------- CLIENTE
     Compacta sempre — cliente, logo (nunca o avatar pessoal como
     substituto), e a linha editorial vinculada, quando existe. */
  function faixaCliente(ctx) {
    const r = ctx.relatorio;
    /* O estado da linha editorial só entra quando diz algo ao cliente.
       "Em criação" e "Em revisão" são etapas internas da B7: mostrar isso
       no card seria expor o nosso processo, não informar o cliente. */
    const PARA_CLIENTE = ['Aprovada', 'Finalizada'];
    const estado = ctx.linha && PARA_CLIENTE.includes(ctx.linha.status)
      ? '<span>' + esc(ctx.linha.status) + '</span>' : '';
    const selo = ctx.linha
      ? '<div class="ps-selo"><small>LINHA EDITORIAL</small><b>' + esc(ctx.linha.nome || 'Linha editorial') + '</b>' + estado + '</div>'
      : '';
    return '<div class="ps-cliente">' +
      (ctx.clienteLogo
        ? '<div class="ps-cli-logo"><img src="' + esc(ctx.clienteLogo) + '" alt=""></div>'
        : '<div class="ps-cli-logo ps-cli-logo-vazio">' + esc((r.cliente_nome || '?').trim().slice(0, 1).toUpperCase()) + '</div>') +
      '<div><small>CLIENTE</small><b>' + esc(r.cliente_nome || '') + '</b></div>' +
      selo + '</div>';
  }

  /* ----------------------------------------------------- FAIXA DE DIA */
  function faixaDia(iso, itens) {
    const dow = DIAS[diaDaSemana(iso)];
    if (!itens.length) {
      return '<div class="ps-dia ps-dia-vazio">' +
        '<div class="ps-data"><span class="dow">' + dow + '</span>' +
        '<span class="dt">' + curto(iso) + '</span></div>' +
        '<div class="ps-itens"><div class="ps-sem">Sem atividades programadas.</div></div></div>';
    }
    return '<div class="ps-dia">' +
      '<div class="ps-data"><span class="dow">' + dow + '</span>' +
      '<span class="dt">' + curto(iso) + '</span></div>' +
      '<div class="ps-itens">' + itens.map(linhaItem).join('') + '</div></div>';
  }

  /* Título + pílula de status: os dois elementos mais fortes da linha.
     Formato/canal/data extra ficam abaixo, discretos — nunca maiores
     que o título. O texto da pílula pode ser o rótulo interno de
     verdade ou, quando a equipe preencheu, um texto simplificado só
     pra apresentação (situacao_cliente) — a cor é sempre a do status
     real, nunca a de um texto arbitrário. */
  function linhaItem(it) {
    const s = sitInfo(it.situacao);
    const rotuloPill = !vazio(it.situacao_cliente) ? it.situacao_cliente : it.situacao;
    /* etapa e formato nunca aparecem juntos: quando há formato (peça de
       verdade — Card/Carrossel/Reel/Story/Capa de Reel), o formato já
       diz "o que é" com mais precisão; etapa só entra pra demandas sem
       formato (Gravação, Reunião, Aprovação, Entrega, Ajustes, Outro,
       Produção), onde ela É o "o que é". */
    const corFmt = corFormato(it.formato);
    /* segunda data: só o Reel pode ter data de gravação (o campo
       `data`, que também posiciona a demanda no dia) e data de
       postagem separada — e só quando as duas existem de verdade. */
    const dataExtra = (it.formato === 'Reel' && !vazio(it.data_postagem))
      ? '<span class="ps-data-extra">Postagem: ' + esc(longa(it.data_postagem)) + '</span>' : '';
    return '<div class="ps-item">' +
      '<div class="ps-item-topo">' +
        '<b class="ps-titulo">' + esc(it.titulo || 'Sem título') + '</b>' +
        (it.situacao ? '<span class="ps-pill" style="color:' + s.cor + ';background:' + s.bg + '">' +
          '<i style="background:' + s.cor + '"></i>' + esc(rotuloPill) + '</span>' : '') +
      '</div>' +
      '<div class="ps-meta">' +
        (it.formato ? '<span class="ps-formato"' + (corFmt ? ' style="color:' + corFmt + '"' : '') + '>' +
          '<span class="ps-formato-ic">' + (ICONE[it.formato] || iconeDe(it)) + '</span>' + esc(it.formato) + '</span>' :
          (it.etapa ? '<span class="ps-tipo" style="color:' + corTipo(it.etapa) + '">' +
            '<span class="ps-tipo-ic">' + iconeDe(it) + '</span>' + esc(it.etapa) + '</span>' : '')) +
        (it.canal ? '<span class="ps-canal">' + esc(it.canal) + '</span>' : '') +
        dataExtra +
      '</div>' +
      (!vazio(it.observacao) ? '<p class="ps-obs">' + esc(it.observacao) + '</p>' : '') +
    '</div>';
  }

  /* --------------------------------------------------------- LEGENDA
     Só o que realmente aparece na semana — uma legenda de oito estágios
     quando só dois foram usados é ruído. Duas seções: FORMATOS (só os
     que a semana tem: Card, Reel…) e ETAPAS DA PRODUÇÃO (só os status
     realmente usados, na cor real deles). Cada uma monta uma versão
     DETALHADA (rótulo + descrição curta, pros níveis de densidade que
     têm espaço) e uma COMPACTA (só rótulos, separados por ponto) — as
     duas ficam no HTML, o CSS decide qual mostrar por nível
     (.ps-leg-detalhe / .ps-leg-compacta), então a medição real por
     nível (ver montar()) já considera o tamanho certo de cada uma. */
  function legenda(itens) {
    const formatosUsados = [...new Set(itens.map(i => i.formato).filter(Boolean))]
      .filter(f => FORMATOS[f]);
    const statusUsados = [...new Set(itens.map(i => i.situacao).filter(Boolean))]
      .filter(s => SITUACOES[s]);
    if (!formatosUsados.length && !statusUsados.length) return '';

    const secao = (rot, itensLeg) => {
      if (!itensLeg.length) return '';
      const detalhada = itensLeg.map(x =>
        '<span class="ps-leg-item"><span class="ps-leg-chip" style="color:' + x.cor + '">' +
          (x.icone ? '<span class="ps-leg-ic">' + x.icone + '</span>' : '<i style="background:' + x.cor + '"></i>') +
          esc(x.rotulo) + '</span>' +
          (x.desc ? '<small>' + esc(x.desc) + '</small>' : '') + '</span>').join('');
      const compacta = itensLeg.map(x => esc(x.rotulo)).join(' · ');
      return '<div class="ps-leg-linha"><b>' + rot + '</b>' +
        '<span class="ps-leg-detalhe">' + detalhada + '</span>' +
        '<span class="ps-leg-compacta">' + compacta + '</span></div>';
    };

    return '<div class="ps-legendas">' +
      secao('FORMATOS', formatosUsados.map(f => ({
        rotulo: f, cor: corFormato(f) || 'var(--ink-2)', icone: ICONE[f] || iconeDe({ formato: f }) }))) +
      secao('ETAPAS DA PRODUÇÃO', statusUsados.map(s => ({
        rotulo: s, cor: sitInfo(s).cor, desc: LEGENDA_TEXTO[s] || '' }))) +
    '</div>';
  }

  /* Aviso curto de quantas demandas dependem do cliente. Só com dado
     real, e sem alarme vermelho gigante. Qualquer situação que comece
     com "Aguardando" já é, por definição, uma espera do cliente (é
     assim que o vocabulário desta rodada nomeia toda situação que
     depende dele) — cobre os rótulos novos (Aguardando aprovação do
     cliente, Aguardando confirmação do cliente, Aguardando validação
     do cliente) e os legados (Aguardando aprovação, Aguardando
     cliente), mais "Atenção" (legado). */
  function ehEsperaCliente(situacao) {
    return typeof situacao === 'string' &&
      (situacao.indexOf('Aguardando') === 0 || situacao === 'Atenção');
  }
  function atencao(itens) {
    const n = itens.filter(i => ehEsperaCliente(i.situacao)).length;
    if (!n) return '';
    return '<div class="ps-atencao"><span class="ps-ponto" style="background:' + SITUACOES['Aguardando aprovação do cliente'].cor + '"></span>' +
      '<span>Atenção nesta semana: <b>' + n + ' demanda' + (n === 1 ? '' : 's') +
      '</b> ' + (n === 1 ? 'precisa' : 'precisam') + ' de retorno do cliente.</span></div>';
  }

  function rodape(ctx) {
    return '<div class="ps-rodape">' +
      '<div class="esq"><img src="' + MARCA + '" alt="">' +
      '<span>B7 / BRANDING7 &nbsp;·&nbsp; STATUS SEMANAL</span></div>' +
    '</div>';
  }

  /* =================================================================
     UMA PÁGINA, SEMPRE
     Nunca gera página 2. Em vez de paginar, testa os níveis do MAIOR
     pro menor e usa o primeiro que couber de verdade — uma semana leve
     preenche a página com texto grande (nunca sobra espaço em branco
     com letra pequena só porque "coube"); só uma semana cheia desce a
     escada até um piso legível. Se mesmo o nível mais denso não couber,
     usa uma composição de duas colunas balanceadas — ainda uma página
     só, nunca um dia dividido ao meio. */
  const NIVEIS = ['nv-enorme', 'nv-grande', '', 'nv-compacta', 'nv-densa', 'nv-muito-densa'];

  const hojeISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  };

  function montar(ctx, area, opcoes) {
    opcoes = opcoes || {};
    const r = ctx.relatorio;
    const itemLinha = itemLinhaEditorial(ctx);
    const itensTodos = itemLinha ? [itemLinha].concat(ctx.itens || []) : (ctx.itens || []);
    const mostrarConcluidos = !!opcoes.mostrarConcluidos;
    /* "A partir de hoje": tira do relatório o que já passou dentro da
       própria semana (útil pra uma atualização no meio da semana, ex.
       quinta mostrando só quinta a domingo). Demanda sem data nunca é
       afetada — não há "antes de hoje" pra algo sem data. Se hoje cai
       fora do período do relatório (relatório de uma semana futura,
       por exemplo), o filtro não corta nada. */
    const soAPartirDeHoje = opcoes.somenteAPartirDeHoje === true;
    const hoje = hojeISO();
    let itens = itensTodos.filter(i => !deveExcluir(i, mostrarConcluidos));
    if (soAPartirDeHoje) itens = itens.filter(i => !i.data || i.data >= hoje);
    const mostrarVazios = opcoes.mostrarDiasVazios !== false;
    const mostrarObs = opcoes.mostrarObservacoes !== false;
    const querLegenda = opcoes.mostrarLegenda !== 'nao';

    const porDia = {};
    itens.forEach(i => { (porDia[i.data] = porDia[i.data] || []).push(i); });

    let diasCompletos = diasDoPeriodo(r.semana_inicio, r.semana_fim);
    if (soAPartirDeHoje) diasCompletos = diasCompletos.filter(d => d >= hoje);
    const diasVisiveis = diasCompletos.filter(d => mostrarVazios || (porDia[d] || []).length);
    const semData = itens.filter(i => !i.data);

    /* blocos na ordem do documento — cada um é atômico: nunca é
       dividido entre colunas nem entre densidades */
    const blocos = [];
    if (mostrarObs && !vazio(r.observacao_geral)) {
      blocos.push({ html: '<div class="ps-nota-geral">' + esc(r.observacao_geral) + '</div>', peso: 1.6 });
    }
    const av = atencao(itens);
    if (av) blocos.push({ html: av, peso: 1.3 });

    diasVisiveis.forEach(d => {
      const doDia = (porDia[d] || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
      blocos.push({ html: faixaDia(d, doDia), peso: doDia.length ? 1.1 + doDia.length * 1.35 : 0.55 });
    });

    if (semData.length) {
      blocos.push({ html: '<div class="ps-dia sem-data">' +
        '<div class="ps-data"><span class="dow">SEM</span><span class="dt">DATA</span></div>' +
        '<div class="ps-itens">' + semData.map(linhaItem).join('') + '</div></div>', peso: 1.1 + semData.length * 1.35 });
    }

    const leg = querLegenda ? legenda(itens) : '';
    if (leg) blocos.push({ html: leg, peso: 1.4 });

    if (!blocos.length) {
      blocos.push({ html: '<div class="ps-sem-nada">Nenhuma atividade prevista para esta semana.</div>', peso: 1 });
    }

    /* -------------------------------------------------- medição real
       Renderiza fora da tela e mede se o corpo estoura a caixa
       disponível — a mesma técnica de sempre, só que agora decidindo
       entre densidade/colunas em vez de decidir quando abrir página 2. */
    const medidor = document.createElement('div');
    medidor.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    (area || document.body).appendChild(medidor);

    const cabeca = cabecalho(ctx);
    const cliente = faixaCliente(ctx);
    const pe = rodape(ctx);

    const paginaHtml = (nivel, corpoHtml, duasColunas) =>
      '<div class="pag45' + (nivel ? ' ' + nivel : '') + '">' +
        cabeca + cliente + '<div class="ps-corpo' + (duasColunas ? ' duas-colunas' : '') + '">' + corpoHtml + '</div>' + pe +
      '</div>';

    const corpoUnaColuna = blocos.map(b => b.html).join('');

    /* Candidatos de corte pra duas colunas, do mais equilibrado (por peso
       estimado) pro menos — nunca só o "melhor" teórico. O peso é uma
       estimativa; a única forma de saber se um corte realmente cabe é
       medir de verdade, então testamos vários candidatos em ordem de
       preferência até achar um que meça certo. Um dia nunca é dividido
       entre as duas colunas. */
    function candidatosCorte() {
      const cortes = [];
      for (let c = 1; c < blocos.length; c++) {
        const esq = blocos.slice(0, c).reduce((s, b) => s + b.peso, 0);
        const dir = blocos.slice(c).reduce((s, b) => s + b.peso, 0);
        cortes.push({ c, diff: Math.abs(esq - dir) });
      }
      cortes.sort((a, b) => a.diff - b.diff);
      return cortes.map(x => x.c);
    }
    function htmlDuasColunas(corte) {
      const esquerda = blocos.slice(0, corte).map(b => b.html).join('');
      const direita = blocos.slice(corte).map(b => b.html).join('');
      return '<div class="ps-col">' + esquerda + '</div><div class="ps-col">' + direita + '</div>';
    }

    function cabeUnaColuna(nivel) {
      medidor.innerHTML = paginaHtml(nivel, corpoUnaColuna, false);
      const c = medidor.querySelector('.ps-corpo');
      return c.scrollHeight <= c.clientHeight + 2;
    }
    /* Mede as duas colunas de verdade e devolve o quanto estourou (0 se
       coube). Nunca confia só no peso estimado — o peso só ordena os
       candidatos, quem decide é a medição real no DOM. */
    function medirDuasColunas(nivel, corte) {
      medidor.innerHTML = paginaHtml(nivel, htmlDuasColunas(corte), true);
      const cols = medidor.querySelectorAll('.ps-col');
      let estouro = 0;
      cols.forEach(c => { estouro = Math.max(estouro, c.scrollHeight - c.clientHeight); });
      return estouro;
    }

    let escolhido = null;
    for (const nivel of NIVEIS) {
      if (cabeUnaColuna(nivel)) { escolhido = { nivel, corpo: corpoUnaColuna, duas: false }; break; }
    }
    if (!escolhido) {
      const cortes = candidatosCorte();
      let melhorFallback = null; /* pior caso: guarda o menor estouro visto, pra usar como último recurso */
      for (const nivel of NIVEIS) {
        for (const corte of cortes) {
          const estouro = medirDuasColunas(nivel, corte);
          if (estouro <= 2) { escolhido = { nivel, corpo: htmlDuasColunas(corte), duas: true }; break; }
          if (!melhorFallback || estouro < melhorFallback.estouro) {
            melhorFallback = { nivel, corte, estouro };
          }
        }
        if (escolhido) break;
      }
      /* semana excepcionalmente cheia: nada coube de verdade — usa a
         combinação (nível + corte) que menos estourou, nunca a primeira
         que apareceu. Ainda assim, nunca uma segunda página. */
      if (!escolhido) {
        escolhido = { nivel: melhorFallback.nivel, corpo: htmlDuasColunas(melhorFallback.corte), duas: true };
      }
    }

    medidor.remove();
    return paginaHtml(escolhido.nivel, escolhido.corpo, escolhido.duas);
  }

  return { montar, periodoTexto, diasDoPeriodo, diaDaSemana, curto, longa, partes, carregarFontes, hojeISO,
           situacaoDeConteudo,
           SITUACOES, TIPOS, FORMATOS, ESTAGIOS, corTipo, corFormato, corSituacao, contextoDe, estagiosDe,
           ehConcluido, ehCancelado, itemLinhaEditorial, EXCLUIR_DO_PLANEJAMENTO, ICONE, DIAS, MESES_CURTO };
})();


/* =====================================================================
   EXPORTAÇÃO DO STATUS SEMANAL
   Reutiliza a infraestrutura de render que o Download Center já usa
   (html2canvas + jsPDF, via B7.Export.paraCanvas/baixarBlob). Nada de
   window.print aqui: o pedido é arquivo, não impressão. Sempre uma
   página — B7.DocSemana.montar() nunca devolve mais de um .pag45.
   ===================================================================== */
B7.BaixarSemana = (function () {
  const LARGURA = 1080, ALTURA = 1350;          /* 4:5 exato */

  async function reunir(reportId) {
    const relatorio = await B7.DB.status(reportId);
    const itens = await B7.DB.listarItens(reportId);
    let linha = null;
    if (relatorio.linha_id) linha = await B7.DB.linha(relatorio.linha_id).catch(() => null);
    return {
      relatorio: relatorio, itens: itens, linha: linha,
      clienteLogo: relatorio.cliente_logo_url || ''
    };
  }

  function nomeBase(ctx) {
    const r = ctx.relatorio;
    const a = B7.DocSemana.partes(r.semana_inicio), b = B7.DocSemana.partes(r.semana_fim);
    const dia = n => String(n).padStart(2, '0');
    return [r.cliente_nome, 'STATUS',
            dia(a.dia) + '-' + dia(b.dia),
            B7.DocSemana.MESES_CURTO[b.mes - 1], String(b.ano)].join('_');
  }

  /* Monta a página fora da tela e devolve o elemento pronto.
     Espera as fontes carregarem ANTES de montar: a medição de altura
     que decide densidade/colunas roda no DOM real, e se a fonte ainda
     não trocou (font-display:swap usa uma fonte de fallback até lá) a
     medida fica errada — o texto pode crescer depois que a fonte certa
     chega, estourando uma página que "coube" na medição. Isso também
     evita que o html2canvas capture a página ainda com a fonte de
     fallback. */
  async function preparar(ctx, opcoes) {
    await B7.DocSemana.carregarFontes();
    const area = document.getElementById('area-impressao');
    area.style.display = 'block';
    area.classList.add('modo-45');
    area.innerHTML = B7.DocSemana.montar(ctx, area, opcoes);
    return { area: area, pagina: area.querySelector('.pag45') };
  }
  function limpar(area) {
    area.innerHTML = '';
    area.style.display = '';
    area.classList.remove('modo-45');
  }

  /* ---------------------------------------------------------- PNG */
  async function gerarPNG(ctx, opcoes, aoAndar) {
    const { area, pagina } = await preparar(ctx, opcoes);
    const escala = (opcoes && opcoes.alta) ? 4 : 2;   /* 2 → 1080×1350, 4 → 2160×2700 */
    try {
      aoAndar && aoAndar('render', 1, 1);
      const canvas = await html2canvas(pagina, {
        scale: escala, backgroundColor: '#ffffff', useCORS: true, logging: false,
        windowWidth: pagina.offsetWidth, windowHeight: pagina.offsetHeight
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      canvas.width = canvas.height = 0;             /* não segura canvas gigante na memória */

      aoAndar && aoAndar('arquivo', 1, 1);
      B7.Export.baixarBlob(blob, B7.Export.nomeArquivo([nomeBase(ctx)], 'png'));
      return 1;
    } finally { limpar(area); }
  }

  /* ---------------------------------------------------------- PDF
     Página com a mesma proporção 4:5 (216 × 270 mm), não A4 — e sempre
     uma única página no PDF, igual ao PNG. */
  async function gerarPDF(ctx, opcoes, aoAndar) {
    const { area, pagina } = await preparar(ctx, opcoes);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: [216, 270],
                              orientation: 'portrait', compress: true });
      aoAndar && aoAndar('render', 1, 1);
      const canvas = await html2canvas(pagina, {
        scale: (opcoes && opcoes.alta) ? 4 : 3, backgroundColor: '#ffffff',
        useCORS: true, logging: false,
        windowWidth: pagina.offsetWidth, windowHeight: pagina.offsetHeight
      });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(img, 'JPEG', 0, 0, 216, 270, undefined, 'FAST');
      canvas.width = canvas.height = 0;
      aoAndar && aoAndar('arquivo', 1, 1);
      /* mesmo caminho de download do resto do sistema, em vez de pdf.save():
         um só lugar cuidando de Blob, link temporário e limpeza */
      B7.Export.baixarBlob(pdf.output('blob'), B7.Export.nomeArquivo([nomeBase(ctx)], 'pdf'));
      return 1;
    } finally { limpar(area); }
  }

  return { reunir, gerarPNG, gerarPDF, preparar, limpar, nomeBase, LARGURA, ALTURA };
})();
