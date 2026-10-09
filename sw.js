/* =====================================================================
   Service worker — só a "casca" do app (html, css, js, fontes, logo).
   Estratégia (zzz5): CACHE PRIMEIRO. A casca guardada abre na hora.
   Antes era rede primeiro: cada um dos ~60 arquivos ia perguntar ao
   servidor antes de a tela aparecer, e no 4G o app ficava 10 s ou mais
   no ícone (vídeo do Kevin, 03/10).
   Versão nova não fica presa: a página descobre sozinha que há versão
   nova (js/app.js lê o js/auth.js publicado, sem passar por cache) e
   pede aqui "b7-renovar" — a casca inteira é baixada de novo e a
   recarga já abre a nova. Cada publicação também troca o CACHE abaixo.
   config.js segue indo à rede (com reserva, se ela demorar ou cair).
   Dados de roteiro nunca passam por aqui: vêm sempre do Supabase.
   ===================================================================== */

const CACHE = 'roteiros-b7-v336';
const CASCA = [
  './', './index.html',
  './styles/global.css', './styles/abertura.css', './styles/dashboard.css', './styles/editor.css', './styles/print.css',
  './js/vendor-supabase.js', './js/supabase.js', './js/database.js', './js/memoria.js', './js/ui.js',
  './js/autosave.js', './js/print.js', './js/resumo-mes.js', './js/teleprompter.js', './js/ia-analise.js', './js/ia-texto.js','./styles/teleprompter.css', './js/dashboard.js', './js/editor.js', './js/gravacao.js',
  './js/backup.js', './js/app.js', './js/abertura-som.js', './js/movimento.js', './js/desempenho.js',
  './js/auth.js', './js/usuarios.js', './js/central.js', './js/panorama.js', './js/conteudo.js',
  './js/linha.js', './js/design.js', './js/video.js', './js/eventos.js', './js/calendario.js', './js/oportunidades.js', './js/semana.js', './js/doc-semana.js', './js/slides.js',
  './js/print-linha.js', './js/extras.js', './js/publicacoes.js', './js/painel.js', './js/painel-coord.js', './js/painel-design.js', './js/painel-multi.js', './js/tv.js', './js/recursos.js', './js/sistema.js', './js/novidades.js', './js/topo.js', './js/nav.js',
  './js/permissoes.js', './js/portal.js', './js/kanban.js', './js/perfil.js', './js/foto.js',
  /* zzz45: estava faltando. Sem rede, o "Visualizar como…" sumia em
     silêncio porque o arquivo nunca entrava no cache. */
  './js/previa-usuario.js', './js/menu-contexto.js',
  './js/aprovacoes.js', './js/notificacoes.js', './js/presenca.js', './js/push.js',
  './js/ia.js', './js/ia-roteiro.js', './js/ia-linha.js', './js/ia-chat.js',
  './js/vendor/html2canvas.min.js', './js/vendor/jspdf.umd.min.js', './js/vendor/xlsx.full.min.js',
  './styles/auth.css', './styles/central.css', './styles/panorama.css', './styles/conteudo.css', './styles/semana.css',
  './styles/kanban.css', './styles/portal.css', './styles/aprovacoes.css', './styles/linha.css', './styles/ia-chat.css', './styles/design.css',
  './styles/video.css', './styles/calendario.css', './styles/oportunidades.css', './styles/gravacao.css', './styles/publicacoes.css', './styles/painel.css', './styles/tv.css', './styles/sistema.css', './styles/topo.css', './styles/nav.css',
  './assets/brand/logo-color.png', './assets/brand/logo-white.png',
  './assets/brand/symbol-color.png', './assets/brand/symbol-white.png',
  './assets/fonts/inter-400.woff2', './assets/fonts/inter-500.woff2',
  './assets/fonts/inter-600.woff2', './assets/fonts/inter-700.woff2',
  './assets/fonts/archivo-700.woff2', './assets/fonts/archivo-800.woff2', './assets/fonts/archivo-900.woff2',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/badge-96.png', './assets/icons/favicon.png',
  './manifest.json'
];
/* config.js fica de fora de propósito: é o arquivo que você edita e não
   pode, em hipótese alguma, ficar preso numa versão antiga. */

/* zzz18: baixa um arquivo da casca com a versão no endereço (?b7=CACHE).
   Logo depois de publicar, o CDN do GitHub Pages ainda entrega parte dos
   arquivos antigos por alguns segundos; quem atualizava nesse intervalo
   ficava com uma mistura (CSS novo + JS velho) presa no cache até a
   próxima publicação. O endereço novo nunca está no CDN: vem da origem,
   sempre a versão publicada. Fica guardado sob o endereço normal. */
function baixar(u) {
  return fetch(new Request(u + (u.includes('?') ? '&' : '?') + 'b7=' + CACHE, { cache: 'reload' }))
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' em ' + u); return r; });
}

self.addEventListener('install', ev => {
  ev.waitUntil(
    /* 'reload': a casca nova é baixada do servidor, nunca do cache HTTP —
       senão a reserva offline nasceria com arquivos da versão anterior */
    caches.open(CACHE).then(c => Promise.allSettled(CASCA.map(u => baixar(u).then(r => c.put(u, r)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(ns => Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin) return;  // Supabase vai direto à rede
  /* quem pede "sem cache" quer o servidor (a conferência de versão nova) */
  if (ev.request.cache === 'no-store' || ev.request.cache === 'reload') return;

  /* config.js: sempre da rede, mas sem segurar a abertura — se a rede não
     responde em 2,5 s, vale a cópia guardada */
  if (url.pathname.endsWith('/js/config.js')) {
    const rede = fetch(ev.request, { cache: 'no-store' }).then(resp => {
      if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(k => k.put(ev.request, c)).catch(() => {}); }
      return resp;
    });
    ev.respondWith(Promise.race([rede, new Promise(r => setTimeout(r, 2500))])
      .then(r => r || caches.match(ev.request).then(c => c || rede))
      .catch(() => caches.match(ev.request)));
    return;
  }

  const navegacao = ev.request.mode === 'navigate';
  ev.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(navegacao ? './index.html' : ev.request, { ignoreSearch: navegacao }).then(guardada => {
        if (guardada) return guardada;
        /* fora da casca (ou casca ainda baixando): rede, e guarda */
        return fetch(ev.request, { cache: 'no-cache' }).then(resp => {
          if (resp.ok) { const c = resp.clone(); cache.put(ev.request, c).catch(() => {}); }
          return resp;
        }).catch(() =>
          /* Só navegação cai no index.html. Um .js ou .css ausente precisa
             falhar de verdade: devolver HTML no lugar de script derruba o
             app inteiro com SyntaxError. */
          navegacao ? cache.match('./index.html') : Response.error());
      }))
  );
});

/* "b7-renovar": a página viu que há versão nova publicada. Baixa a casca
   inteira de novo, direto do servidor, e avisa quando terminou — a
   recarga que vem depois já abre a versão nova. */
function renovarCasca() {
  return caches.open(CACHE).then(c => Promise.allSettled(CASCA.map(u => baixar(u).then(r => c.put(u, r)))));
}
self.addEventListener('message', ev => {
  const d = ev.data || {};
  if (d.tipo !== 'b7-renovar') return;
  const porta = ev.ports && ev.ports[0];
  ev.waitUntil(renovarCasca().then(() => porta && porta.postMessage({ ok: true }),
                                   () => porta && porta.postMessage({ ok: false })));
});

/* =====================================================================
   PUSH — o servidor (Edge Function b7-push) manda um JSON pequeno. No
   formato atual (v: 2) o aviso já vem pronto do banco:
     { v, id, tipo, titulo, corpo, logo, imagem, acoes: [{id, rotulo, link}], link }
   titulo = o que aconteceu; corpo = cliente · item · contexto.
   A tag repete o id da notificação, a mesma que o sino usa no aviso do
   navegador: o aparelho mostra um aviso só, nunca dois para o mesmo
   evento.

   Melhoria progressiva: ícone do cliente, imagem e botões entram quando
   existem e o aparelho suporta. Sem nada disso, sobram título, corpo e o
   clique que abre o registro certo — o aviso continua útil.
   ===================================================================== */
/* Formato antigo (sem v): título curto pelo tipo e a frase no corpo.
   Fica aqui para o intervalo em que a função de push ainda não foi
   publicada na versão nova. */
const TITULOS = {
  'video.atribuida': 'Nova demanda de vídeo',
  'video.aguardando_aprovacao': 'Vídeo enviado para aprovação',
  'video.entregue': 'Vídeo entregue',
  'video.correcao_solicitada': 'Correção solicitada',
  'video.atrasado': 'Demanda atrasada',
  'video.atrasado_escalado': 'Demanda atrasada',
  'video.prazo_amanha': 'Entrega é amanhã',
  'design.criada': 'Nova peça de design',
  'design.atribuida': 'Peça atribuída',
  'design.demanda_assumida': 'Peça assumida',
  'design.versao_enviada': 'Versão enviada para revisão',
  'design.aprovado_interno': 'Peça aprovada internamente',
  'design.ajuste_solicitado': 'Ajuste solicitado',
  'design.cliente_aprovado': 'Cliente aprovou a peça',
  'design.finalizado': 'Peça finalizada',
  'aprovacao.enviada': 'Material enviado para aprovação',
  'aprovacao.aprovada': 'Cliente aprovou',
  'aprovacao.ajustes': 'Cliente pediu ajustes',
  'aprovacao.recusada': 'Cliente recusou',
  'aprovacao.anulada': 'Aprovação anulada',
  'parte.aprovada': 'Parte aprovada pelo cliente',
  'linha.concluida': 'Linha editorial concluída',
  'agenda.gravacao_24h': 'Gravação amanhã',
  'agenda.gravacao_1h': 'Gravação em 1 hora',
  'agenda.apresentacao_24h': 'Apresentação amanhã',
  'agenda.apresentacao_1h': 'Apresentação em 1 hora',
  'agenda.reuniao_24h': 'Reunião amanhã',
  'agenda.reuniao_1h': 'Reunião em 1 hora',
  'agenda.outro_24h': 'Compromisso amanhã',
  'agenda.outro_1h': 'Compromisso em 1 hora',
  'teste.notificacao': 'Teste do Sistema B7'
};
function tituloDe(d) {
  if (d.tipo && TITULOS[d.tipo]) return TITULOS[d.tipo];
  if (d.tipo && d.tipo.startsWith('video.')) return 'Produção de vídeo';
  if (d.tipo && d.tipo.startsWith('design.')) return 'Design';
  if (d.tipo && d.tipo.startsWith('aprovacao.')) return 'Aprovações';
  if (d.tipo && d.tipo.startsWith('agenda.')) return 'Agenda';
  return 'Sistema B7';
}

/* Responde "que versão de mim está rodando aqui?" — o Meu perfil usa
   isto pra mostrar se o aparelho já pegou a atualização ou continua no
   service worker antigo (que é quem desenha a notificação). */
self.addEventListener('message', ev => {
  const d = ev.data || {};
  if (d.tipo === 'b7-versao' && ev.ports && ev.ports[0]) ev.ports[0].postMessage({ versao: CACHE });
});

self.addEventListener('push', ev => {
  let d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (e) { d = { titulo: ev.data ? ev.data.text() : '' }; }
  const v2 = Number(d.v) >= 2;
  /* A logo do cliente vira o ícone grande (bucket público) — bate o olho
     e já se sabe de quem é. Sem cliente ou sem logo, ícone do B7. O
     símbolo da B7 fica sempre no badge, que o Android pinta de uma cor
     só: logo de cliente ali viraria um quadrado branco. */
  const titulo = v2 ? (d.titulo || 'Sistema B7') : tituloDe(d) + (d.cliente ? ' · ' + d.cliente : '');
  const corpo = v2 ? (d.corpo || '') : [d.titulo, d.mensagem].filter(Boolean).join('\n');
  const base = {
    body: corpo || '',
    icon: d.logo || './assets/icons/icon-192.png',
    badge: './assets/icons/badge-96.png',
    tag: d.id ? 'b7-notif-' + d.id : undefined,
    renotify: !!d.id,
    timestamp: Date.now(),
    vibrate: [80, 40, 80],
    data: { link: d.link || '#/', id: d.teste ? null : (d.id || null), links: {} }
  };
  const rica = Object.assign({}, base, { data: Object.assign({}, base.data) });
  /* botões: só navegam, e só os que o aparelho comporta */
  const max = (self.Notification && Notification.maxActions) || 0;
  const acoes = (Array.isArray(d.acoes) ? d.acoes : [])
    .filter(a => a && a.id && a.rotulo && typeof a.link === 'string' && a.link.startsWith('#/')).slice(0, max);
  if (acoes.length) {
    rica.actions = acoes.map(a => ({ action: String(a.id), title: String(a.rotulo) }));
    rica.data.links = acoes.reduce((m, a) => { m[a.id] = a.link; return m; }, {});
  }
  if (d.imagem) rica.image = d.imagem;
  ev.waitUntil(
    self.registration.showNotification(titulo, rica)
      /* aparelho que recusa imagem ou botões: o aviso simples sai mesmo assim */
      .catch(() => self.registration.showNotification(titulo, base))
  );
});

/* Clique no aviso (no corpo ou num botão): foca uma aba já aberta do
   sistema e pede a ela que troque de rota (mensagem para js/push.js) —
   sem recarregar nada e sem abrir uma segunda aba. Sem aba aberta, abre
   uma nova já no destino. Todo botão só navega: nenhuma ação de negócio
   acontece a partir da tela de bloqueio. */
self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  const dados = ev.notification.data || {};
  let link = (ev.action && dados.links && dados.links[ev.action]) || dados.link || '#/';
  if (typeof link !== 'string' || !link.startsWith('#/')) link = '#/';
  const destino = new URL(link, self.registration.scope).href;
  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      const aba = lista.find(c => c.url.startsWith(self.registration.scope));
      if (!aba) return self.clients.openWindow(destino);
      return Promise.resolve(aba.focus && aba.focus()).catch(() => aba).then(c => {
        (c || aba).postMessage({ tipo: 'b7-abrir', link: link, id: dados.id || null });
      });
    })
  );
});
