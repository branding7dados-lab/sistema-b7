/* =====================================================================
   MENSAGENS RICAS DA IA (zzz264)

   Toda resposta de conversa da IA (Assistente, Suporte da equipe e do
   portal) passa por aqui. A IA escreve num "markdown da B7" pequeno e
   seguro, e esta função desenha blocos bonitos:

     ## Título                 → título de seção com barra de cor
     **negrito**  ==marca==  `código`  *itálico*
     - item / 1. item          → lista / passos numerados
     - [ ] / - [x]             → lista de checagem
     > 💡 texto                → destaque (💡 dica · ⚠️ atenção · ✅ certo ·
                                  🚨 urgente · 📌 nota · outros = citação)
     :::numeros                → números grandes ("12 | aprovações")
     :::cartao Título … :::    → cartão com título
     | a | b |                 → tabela
     ---                       → divisória
     [texto](#/rota)           → botão para uma tela do B7 (só #/… ou https)

   Tudo é escapado antes: a IA não consegue injetar HTML. Texto simples
   (sem marcação nenhuma) continua saindo como parágrafos, como antes.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.IARico = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DESTAQUES = [
    [/^(💡|✨|🧠)/u, 'dica'], [/^(⚠️|⚠|⏰|⏳)/u, 'atencao'], [/^(✅|🎉|👏|✔️)/u, 'ok'],
    [/^(🚨|❗|❌|🔴)/u, 'urgente'], [/^(📌|ℹ️|📝|👉)/u, 'nota']
  ];
  const ICONE_TOPO = /^(\p{Extended_Pictographic}️?)\s+/u;

  function inline(s) {
    let h = esc(s);
    // links: só telas do B7 (#/…) e https
    h = h.replace(/\[([^\]\n]{1,80})\]\((#\/[^\s)]{0,120}|https:\/\/[^\s)]{1,300})\)/g, (_, t, u) =>
      u.startsWith('#/') ? '<a class="ir-ir" href="' + u + '">' + t + '<i aria-hidden="true">→</i></a>'
                         : '<a class="ir-link" href="' + u + '" target="_blank" rel="noopener">' + t + '</a>');
    h = h.replace(/`([^`\n]{1,80})`/g, '<code class="ir-cod">$1</code>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/==([^=\n]{1,120})==/g, '<mark class="ir-marca">$1</mark>');
    h = h.replace(/(^|[\s(])\*([^*\n]{1,120})\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
    return h;
  }

  /* um parágrafo que começa com emoji ganha o emoji como ícone de abertura */
  function paragrafo(l) {
    const m = ICONE_TOPO.exec(l);
    if (m) return '<p class="ir-p ir-com-ic"><span class="ir-ic" aria-hidden="true">' + m[1] + '</span><span>' + inline(l.slice(m[0].length)) + '</span></p>';
    return '<p class="ir-p">' + inline(l) + '</p>';
  }

  function tabela(linhas) {
    const cel = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const corpo = linhas.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l));
    if (!corpo.length) return '';
    const [cab, ...resto] = corpo.map(cel);
    return '<div class="ir-tab-cx"><table class="ir-tab"><thead><tr>' + cab.map(c => '<th>' + inline(c) + '</th>').join('') +
      '</tr></thead><tbody>' + resto.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function numeros(linhas) {
    const itens = linhas.map(l => l.split('|').map(x => x.trim())).filter(x => x[0]);
    if (!itens.length) return '';
    return '<div class="ir-nums">' + itens.slice(0, 6).map(([v, r]) =>
      '<div class="ir-num"><b>' + inline(v) + '</b>' + (r ? '<span>' + inline(r) + '</span>' : '') + '</div>').join('') + '</div>';
  }

  /* blocos: devolve HTML de um trecho de linhas (cartões chamam de novo) */
  function blocos(linhas) {
    let h = '', i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      const t = l.trim();
      if (!t) { i++; continue; }

      // :::numeros / :::cartao Título … :::
      const bl = /^:::\s*(numeros|números|cartao|cartão)\b\s*(.*)$/i.exec(t);
      if (bl) {
        const dentro = []; i++;
        while (i < linhas.length && linhas[i].trim() !== ':::') dentro.push(linhas[i++]);
        i++;
        if (/^n/i.test(bl[1])) h += numeros(dentro);
        else h += '<section class="ir-cartao">' + (bl[2] ? '<h4>' + inline(bl[2]) + '</h4>' : '') + blocos(dentro) + '</section>';
        continue;
      }
      if (/^#{1,4}\s+/.test(t)) { h += '<h4 class="ir-tit">' + inline(t.replace(/^#+\s+/, '')) + '</h4>'; i++; continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { h += '<hr class="ir-div">'; i++; continue; }

      if (/^\|.*\|$/.test(t)) {
        const tb = [];
        while (i < linhas.length && /^\|.*\|$/.test(linhas[i].trim())) tb.push(linhas[i++]);
        h += tabela(tb); continue;
      }
      if (/^>/.test(t)) {
        const q = [];
        while (i < linhas.length && /^\s*>/.test(linhas[i])) q.push(linhas[i++].replace(/^\s*>\s?/, ''));
        const txt = q.join('\n').trim();
        const tipo = (DESTAQUES.find(([re]) => re.test(txt)) || [, 'citacao'])[1];
        const ic = ICONE_TOPO.exec(txt);
        const corpo = ic ? txt.slice(ic[0].length) : txt;
        h += '<div class="ir-dest ir-' + tipo + '">' + (ic ? '<span class="ir-dest-ic" aria-hidden="true">' + ic[1] + '</span>' : '') +
          '<div>' + corpo.split('\n').filter(Boolean).map(x => '<p>' + inline(x) + '</p>').join('') + '</div></div>';
        continue;
      }
      if (/^[-•*]\s+\[[ xX]\]\s+/.test(t)) {
        let li = '';
        while (i < linhas.length && /^\s*[-•*]\s+\[[ xX]\]\s+/.test(linhas[i])) {
          const m = /^\s*[-•*]\s+\[([ xX])\]\s+(.*)$/.exec(linhas[i++]);
          const feito = m[1] !== ' ';
          li += '<li class="' + (feito ? 'feito' : '') + '"><span class="ir-chk" aria-hidden="true">' + (feito ? '✓' : '') + '</span><span>' + inline(m[2]) + '</span></li>';
        }
        h += '<ul class="ir-check">' + li + '</ul>'; continue;
      }
      if (/^\d+[.)]\s+/.test(t)) {
        let li = '';
        while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) li += '<li><span>' + inline(linhas[i++].trim().replace(/^\d+[.)]\s+/, '')) + '</span></li>';
        h += '<ol class="ir-passos">' + li + '</ol>'; continue;
      }
      if (/^[-•*]\s+/.test(t)) {
        let li = '';
        while (i < linhas.length && /^\s*[-•*]\s+/.test(linhas[i]) && !/^\s*[-•*]\s+\[[ xX]\]/.test(linhas[i])) {
          const x = linhas[i++].trim().replace(/^[-•*]\s+/, '');
          const m = ICONE_TOPO.exec(x);
          li += m ? '<li class="com-ic"><span class="ir-li-ic" aria-hidden="true">' + m[1] + '</span><span>' + inline(x.slice(m[0].length)) + '</span></li>'
                  : '<li><span>' + inline(x) + '</span></li>';
        }
        h += '<ul class="ir-lista">' + li + '</ul>'; continue;
      }
      h += paragrafo(t); i++;
    }
    return h;
  }

  /** HTML da mensagem. opcoes.animar: os blocos entram um a um (resposta pronta). */
  function html(texto, opcoes = {}) {
    const corpo = blocos(String(texto || '').replace(/\r/g, '').split('\n'));
    return '<div class="ia-rico' + (opcoes.animar ? ' ir-anima' : '') + '">' + corpo + '</div>';
  }

  /** Texto puro (copiar, ler em voz alta, WhatsApp): sem a marcação. */
  function texto(t) {
    return String(t || '')
      .replace(/^:::\s*(numeros|números)\s*$/gim, '').replace(/^:::\s*(cartao|cartão)\s*(.*)$/gim, '$2').replace(/^:::\s*$/gm, '')
      .replace(/^\s*\|?\s*:?-{2,}.*$/gm, '').replace(/^\s*\|(.*)\|\s*$/gm, (_, x) => x.split('|').map(s => s.trim()).join(' · '))
      .replace(/^#+\s+/gm, '').replace(/^\s*>\s?/gm, '').replace(/^(-{3,}|\*{3,})$/gm, '')
      .replace(/^\s*[-•*]\s+\[[ xX]\]\s+/gm, '- ')
      .replace(/\[([^\]]+)\]\((#\/[^)]*|https:\/\/[^)]*)\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/==([^=]+)==/g, '$1').replace(/`([^`]+)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  /* links internos (#/…) dentro de uma mensagem: navegam e fecham painéis */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('.ia-rico a.ir-ir');
    if (!a) return;
    e.preventDefault();
    location.hash = a.getAttribute('href');
  });

  return { html, texto };
})();
