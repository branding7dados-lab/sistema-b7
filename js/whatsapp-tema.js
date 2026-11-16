/* =====================================================================
   CORES DA B7 DENTRO DO WHATSAPP (4.49.2)

   O programa de Windows (4.48.70+) aceita um CSS mandado pelo sistema
   (B7Desktop.wa.tema) e o aplica por cima do WhatsApp Web. Aqui fica esse
   CSS — mudar cores do WhatsApp não precisa mais de instalador novo.

   O WhatsApp guarda as cores em variáveis CSS. As semânticas têm nome
   legível (--WDS-…, e as antigas --panel-background, --outgoing-background
   …); trocamos essas, no tema escuro (.dark → roxos do menu do B7) e no
   claro (lilases). As de nome embaralhado são trocadas pelo valor no
   próprio programa (app-desktop/preload-whatsapp.js, a partir da 4.49).
   Só cor: nada muda no funcionamento.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WhatsAppTema = (function () {
  const ESCURO = {
    /* sistema de cores novo (WDS) */
    '--WDS-background-wash-plain': '#120D27', '--WDS-background-elevated-wash-plain': '#1A1336',
    '--WDS-surface-default': '#140F2B', '--WDS-surface-emphasized': '#1E1640', '--WDS-surface-elevated-default': '#1C1540',
    '--WDS-surface-elevated-emphasized': '#251B4D',
    '--WDS-surface-highlight': 'rgba(167,139,250,.12)', '--WDS-components-active-list-row': 'rgba(226,64,156,.18)',
    '--WDS-components-surface-nav-bar': '#1A1335',
    '--WDS-systems-chat-background-wallpaper': '#17112F', '--WDS-systems-chat-foreground-wallpaper': '#241A48',
    '--WDS-systems-chat-surface-composer': '#221A45', '--WDS-systems-chat-surface-tray': '#1B143B',
    '--WDS-systems-bubble-surface-outgoing': '#5B2BC6', '--WDS-systems-bubble-surface-incoming': '#251C4E',
    '--WDS-accent': '#E2409C', '--WDS-accent-emphasized': '#F06BB3', '--WDS-accent-deemphasized': 'rgba(226,64,156,.22)',
    '--WDS-content-action-emphasized': '#F29BD0', '--WDS-content-external-link': '#C9A7FF',
    '--WDS-persistent-activity-indicator': '#E2409C', '--WDS-secondary-positive': '#E2409C', '--WDS-persistent-always-branded': '#C21C83',
    '--WDS-lines-divider': 'rgba(167,139,250,.14)',
    /* nomes antigos (tema escuro clássico, o azul-petróleo) */
    '--app-background': '#120D27', '--app-background-stripe': '#3A1E86',
    '--panel-background': '#140F2B', '--panel-background-deeper': '#120D27', '--panel-background-lighter': '#1E1640',
    '--panel-background-colored': '#1A1335', '--panel-background-colored-deeper': '#140F2B',
    '--panel-header-background': '#1A1335', '--panel-input-background': '#2B2155',
    '--conversation-panel-background': '#17112F', '--conversation-panel-border': 'rgba(167,139,250,.14)',
    '--search-container-background': '#140F2B', '--search-input-background': '#221A45', '--search-input-container-background': '#140F2B',
    '--background-default': '#140F2B', '--background-default-hover': '#1E1640', '--background-default-active': '#2B2155',
    '--compose-input-background': '#221A45', '--compose-input-border': '#221A45', '--rich-text-panel-background': '#1A1335',
    '--outgoing-background': '#5B2BC6', '--outgoing-background-deeper': '#4A22A6', '--outgoing-background-highlight': '#6E3BE0',
    '--incoming-background': '#251C4E', '--incoming-background-deeper': '#1E1640',
    '--unread-marker-background': '#E2409C', '--unread-background': '#E2409C',
    '--intro-background': '#17112F', '--intro-border': '#3A1E86',
    '--border-stronger': 'rgba(167,139,250,.22)', '--border-list': 'rgba(167,139,250,.12)', '--border-panel': 'rgba(167,139,250,.12)',
    '--teal': '#E2409C', '--teal-lighter': '#F06BB3', '--primary-strong': '#EDE6FF', '--checkbox-background': '#E2409C',
    '--button-primary-background': '#C21C83', '--button-primary-background-hover': '#E2409C', '--icon-ack': '#C9A7FF'
  };
  const CLARO = {
    '--WDS-background-wash-plain': '#FBF9FE', '--WDS-surface-default': '#FFFFFF', '--WDS-surface-emphasized': '#F5F1FB',
    '--WDS-surface-elevated-emphasized': '#F5F1FB', '--WDS-components-surface-nav-bar': '#F5F1FB',
    '--WDS-surface-highlight': 'rgba(124,58,237,.07)', '--WDS-components-active-list-row': 'rgba(124,58,237,.10)',
    '--WDS-systems-chat-background-wallpaper': '#F4EFFA', '--WDS-systems-chat-foreground-wallpaper': '#E8DFF6',
    '--WDS-systems-chat-surface-tray': '#F5F1FB',
    '--WDS-systems-bubble-surface-outgoing': '#EBDDFF',
    '--WDS-accent': '#9A2AA8', '--WDS-accent-emphasized': '#7C3AED', '--WDS-accent-deemphasized': '#EBDDFF',
    '--WDS-content-action-emphasized': '#7C3AED', '--WDS-content-external-link': '#7C3AED',
    '--WDS-persistent-activity-indicator': '#C21C83', '--WDS-secondary-positive': '#C21C83', '--WDS-persistent-always-branded': '#9A2AA8',
    '--app-background': '#EEE7F8', '--panel-background': '#F5F1FB', '--panel-header-background': '#F5F1FB',
    '--panel-background-deeper': '#EEE7F8', '--panel-input-background': '#EEE7F8',
    '--conversation-panel-background': '#F4EFFA', '--search-input-background': '#F5F1FB',
    '--outgoing-background': '#EBDDFF', '--unread-marker-background': '#C21C83', '--teal': '#9A2AA8', '--checkbox-background': '#9A2AA8',
    '--button-primary-background': '#9A2AA8'
  };
  const bloco = (sel, m) => sel + '{' + Object.keys(m).map(k => k + ':' + m[k] + ' !important').join(';') + '}';
  /* barra de ícones da esquerda (marcada pelo programa com data-b7-trilho) */
  const TRILHO = `
    [data-b7-trilho]{background:
      radial-gradient(140% 30% at 0% 0%, rgba(124,62,214,.38), transparent 70%),
      radial-gradient(140% 26% at 100% 100%, rgba(194,28,131,.30), transparent 72%),
      linear-gradient(180deg,#171338,#0B0A1E) !important;
      border-right:1px solid rgba(255,255,255,.08) !important;}
    [data-b7-limpo]:not([data-b7-trilho]){background-color:transparent !important;}
    [data-b7-trilho] [data-icon], [data-b7-trilho] svg{color:rgba(255,255,255,.78) !important;}
    [data-b7-trilho] button, [data-b7-trilho] [role="button"]{border-radius:12px !important;}
    [data-b7-trilho] button:hover, [data-b7-trilho] [role="button"]:hover{background-color:rgba(255,255,255,.08) !important;}
    [data-b7-trilho] [aria-pressed="true"], [data-b7-trilho] [aria-selected="true"], [data-b7-trilho] [data-navbar-item-selected="true"]{
      background:linear-gradient(120deg, rgba(58,30,134,.85), rgba(194,28,131,.7)) !important;}
  `;
  /* a barra de rolagem e a seleção de texto no roxo da marca */
  const EXTRA = `
    ::selection{background:rgba(194,28,131,.35);}
    ::-webkit-scrollbar{width:7px;height:7px;}
    ::-webkit-scrollbar-thumb{background:rgba(167,139,250,.35);border-radius:8px;}
  `;
  /* claro só onde não há tema escuro; escuro onde o WhatsApp põe .dark (na raiz ou no body) */
  const css = () => bloco(':root:not(.dark), :root:not(.dark) body:not(.dark)', CLARO) + '\n' +
    bloco('.dark, .dark body', ESCURO) + '\n' + TRILHO + EXTRA;
  /* manda para o programa (se ele souber receber) */
  function aplicar(D) {
    if (!D || !D.tema) return false;
    try { D.tema(css()); return true; } catch (e) { return false; }
  }
  return { aplicar, css };
})();
