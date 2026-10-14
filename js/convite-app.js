/* =====================================================================
   CONVITE DO APP DE ANDROID (zzz158) E DO PROGRAMA DE WINDOWS (zzz164)

   Quem abre o B7 pelo navegador do celular Android não sabe que existe
   um aplicativo de verdade. Este convite aparece uma vez, embaixo, com o
   que o app tem a mais (abre na hora, avisos, atalhos no ícone, widget e
   teleprompter com câmera) e um botão que baixa o APK da última release.

   Onde NÃO aparece:
     • dentro do próprio app (B7.AppNativo) nem no B7 já instalado;
     • em iPhone (lá não há APK) nem em computador;
     • para cliente, e enquanto a pessoa não entrou na conta;
     • se já foi dispensado — volta a perguntar só depois de 30 dias;
     • se o aparelho já tem o app instalado (quem instalou e voltou a usar
       o navegador respondeu "já tenho").
   ===================================================================== */
window.B7 = window.B7 || {};

B7.ConviteApp = (function () {
  const APK = 'https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk';
  /* zzz164: também o programa de Windows, para quem usa o B7 no navegador do computador */
  const EXE = 'https://github.com/branding7dados-lab/sistema-b7/releases/download/app-desktop/sistema-b7-instalador.exe';
  const ehWindowsPc = () => /Windows NT/i.test(navigator.userAgent || '') && !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const CHAVE = 'b7_convite_app';          /* 'tem' = já tem o app | <data> = adiado */
  const DIAS = 30;

  const ler = () => { try { return localStorage.getItem(CHAVE) || ''; } catch (e) { return ''; } };
  const gravar = v => { try { localStorage.setItem(CHAVE, v); } catch (e) {} };

  function cabe() {
    if (B7.AppNativo && B7.AppNativo.ativo) return false;        /* já está no app */
    if (window.B7Desktop) return false;                          /* app de Windows */
    const ua = navigator.userAgent || '';
    if (!/Android/i.test(ua) && !ehWindowsPc()) return false;   /* iPhone, Mac e Linux fora */
    try { if (matchMedia('(display-mode: standalone)').matches) return false; } catch (e) {}
    const u = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    if (!u || u.papel === 'cliente') return false;
    const guardado = ler();
    if (guardado === 'tem') return false;
    if (guardado && Date.now() - (+guardado || 0) < DIAS * 864e5) return false;
    return true;
  }

  let caixa = null;
  function fechar(resposta) {
    if (!caixa) return;
    gravar(resposta === 'tem' ? 'tem' : String(Date.now()));
    const el = caixa; caixa = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 320);
  }

  function baixarWindows() {
    gravar('tem');
    location.href = EXE;   /* o navegador baixa direto, sem abrir página */
    B7.UI.toast('Baixando o instalador. Quando terminar, abra o arquivo: ele instala e abre o B7 sozinho.', { tempo: 8000 });
  }

  function mostrar() {
    if (caixa || !cabe()) return;
    const pc = ehWindowsPc();
    caixa = document.createElement('div');
    caixa.className = 'cva';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-label', pc ? 'Programa do B7 para Windows' : 'Aplicativo do B7 para Android');
    caixa.innerHTML =
      '<div class="cva-cx">' +
        '<button type="button" class="cva-x" data-nao aria-label="Agora não">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<div class="cva-cab"><img src="assets/icons/icon-192.png" alt="" width="52" height="52">' +
          '<div><b>' + (pc ? 'O B7 tem programa para Windows' : 'O B7 tem app para Android') + '</b><small>Você está usando pelo navegador</small></div></div>' +
        '<ul class="cva-lista">' + (pc
          ? '<li>Janela própria, sem abas e sem a barra do navegador</li>' +
            '<li>Ícone na área de trabalho e no menu Iniciar</li>' +
            '<li>Avisos do Windows e downloads direto na pasta</li>' +
            '<li>Atualiza sozinho: você não precisa baixar de novo</li>'
          : '<li>Abre na hora, sem a barra do navegador</li>' +
            '<li>Avisos no celular, mesmo com o app fechado</li>' +
            '<li>Atalhos no ícone e o widget do seu dia</li>' +
            '<li>Teleprompter com a câmera, gravando direto na galeria</li>') +
        '</ul>' +
        '<a class="b pri cva-bt" href="' + (pc ? EXE : APK) + '" data-baixar>' + (pc ? 'Baixar para Windows' : 'Baixar o app') + '</a>' +
        '<p class="cva-nota">' + (pc
          ? 'Se o Windows mostrar “O Windows protegeu o computador”, clique em “Mais informações” → “Executar assim mesmo”.'
          : 'O Android vai pedir para permitir a instalação deste arquivo — é só confirmar.') + '</p>' +
        '<div class="cva-acoes"><button type="button" class="cva-link" data-tem>Já tenho' + (pc ? '' : ' o app') + '</button>' +
        '<button type="button" class="cva-link" data-nao>Agora não</button></div>' +
      '</div>';
    document.body.appendChild(caixa);
    requestAnimationFrame(() => caixa.classList.add('on'));
    caixa.querySelectorAll('[data-nao]').forEach(b => b.onclick = () => fechar('nao'));
    caixa.querySelector('[data-tem]').onclick = () => fechar('tem');
    caixa.querySelector('[data-baixar]').onclick = ev => {
      /* quem baixou não precisa ser convidado de novo */
      if (pc) { ev.preventDefault(); baixarWindows(); setTimeout(() => fechar('tem'), 400); return; }
      gravar('tem');
      B7.UI.toast('Baixando o app. Abra o arquivo quando terminar.');
      setTimeout(() => fechar('tem'), 400);
    };
    caixa.addEventListener('click', e => { if (e.target === caixa) fechar('nao'); });
  }

  /* espera o sistema montar e a abertura sair; tenta de novo se a pessoa
     ainda estava entrando na conta */
  function ligar() {
    let tentativas = 0;
    const t = setInterval(() => {
      if (++tentativas > 40) return clearInterval(t);
      if (document.querySelector('.b7-abertura, .fundo-modal, .hj-tela')) return;
      if (document.body.classList.contains('tele-aberto')) return;
      if (!(B7.Auth && B7.Auth.usuario && B7.Auth.usuario())) return;
      if (!cabe()) return clearInterval(t);
      clearInterval(t);
      mostrar();
    }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();

  return { mostrar, cabe, baixarWindows, APK, EXE };
})();
