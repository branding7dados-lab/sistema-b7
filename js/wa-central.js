/* =====================================================================
   WHATSAPP B7 (Evolution, piloto) — 4.50.0
   Janela de conexão do número: mostra se está conectado e, se não, o
   QR Code para ler com o celular (WhatsApp → Aparelhos conectados →
   Conectar um aparelho). Tudo passa pela Edge Function wa-evolution; a
   chave do Evolution nunca chega ao navegador. Só administrador.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.WaCentral = (function () {
  const esc = s => B7.UI.esc(s);
  const souAdmin = () => !!(B7.Auth && (B7.Auth.ehAdminReal ? B7.Auth.ehAdminReal() : B7.Auth.ehAdmin && B7.Auth.ehAdmin()));
  const IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.2 19.8l1.1-3.9A8.2 8.2 0 1 1 8.4 19z"/><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.5c.2-.1.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-.6.3-1.5.5-2.6.1a9 9 0 0 1-4.6-4.6c-.4-1.1-.2-2 .1-2.6z"/></svg>';

  function abrir() {
    if (!souAdmin()) { B7.UI.toast('Só administrador conecta o número do WhatsApp.'); return; }
    let vivo = true, relogio = 0, qrEm = 0;
    const m = B7.UI.modal(
      '<div class="wac"><div class="wac-cab"><span class="wac-selo">' + IC + '</span><div><small>PILOTO · EVOLUTION</small><h3>WhatsApp do B7</h3></div></div>' +
      '<div class="wac-corpo" id="wac-corpo"><div class="wac-carrega"><i></i><span>Conferindo a conexão…</span></div></div>' +
      '<div class="acoes"><button class="b" data-fecha>Fechar</button></div></div>', { extra: 'wac-modal' });
    const corpo = m.querySelector('#wac-corpo');
    const parar = () => { vivo = false; clearInterval(relogio); };
    const fechar0 = m.fechar; m.fechar = () => { parar(); fechar0(); };
    m.addEventListener('click', e => { if (e.target.closest('[data-fecha]')) parar(); });
    /* se a janela sumir de outro jeito (Esc, fundo), para de consultar */
    const vigia = setInterval(() => { if (!m.isConnected) { parar(); clearInterval(vigia); } }, 1000);

    const pinta = html => { if (vivo) corpo.innerHTML = html; };
    const erro = t => pinta('<div class="wac-msg erro"><b>Não deu certo</b><p>' + esc(t) + '</p></div>' +
      '<button class="b contorno" data-wac="tentar">Tentar de novo</button>');

    async function estado() {
      let r;
      try { r = await B7.DB.waEvolution('estado'); } catch (e) { return erro(e.message); }
      if (!vivo) return;
      if (r.configurado === false) return pinta('<div class="wac-msg"><b>Falta configurar</b><p>Os segredos <code>EVOLUTION_URL</code> e <code>EVOLUTION_API_KEY</code> ainda não estão no Supabase (Edge Functions → Secrets).</p></div>');
      if (r.erro) return erro(r.erro);
      if (r.estado === 'open') {
        clearInterval(relogio);
        return pinta('<div class="wac-ok"><span class="wac-ok-ic">✓</span><b>Conectado</b><p>' +
          (r.numero ? 'Número <strong>+' + esc(r.numero) + '</strong>' : 'O número está ligado ao B7') + ' · conexão <code>' + esc(r.instancia || '') + '</code></p></div>' +
          '<p class="wac-nota">As mensagens começam a chegar no B7 na próxima etapa (Central de Conversas).</p>' +
          '<button class="b contorno perigo" data-wac="desconectar">Desconectar este número</button>');
      }
      return pinta('<div class="wac-msg"><b>Nenhum número conectado</b><p>Use um <strong>número secundário</strong> no piloto: o Evolution não é oficial e há risco de bloqueio.</p></div>' +
        '<div class="wac-modos"><button class="b pri" data-wac="conectar">Mostrar QR Code</button>' +
        '<button class="b contorno" data-wac="pelo-numero">Conectar com o número</button></div>');
    }

    async function conectar() {
      pinta('<div class="wac-carrega"><i></i><span>Gerando o QR Code…</span></div>');
      let r;
      try { r = await B7.DB.waEvolution('conectar'); } catch (e) { return erro(e.message); }
      if (!vivo) return;
      if (r.conectado) return estado();
      if (r.erro) return erro(r.erro);
      if (!r.qr) return erro('O Evolution não mandou o QR Code. Tente de novo em alguns segundos.');
      qrEm = Date.now();
      pinta('<div class="wac-qr"><img src="' + esc(r.qr) + '" alt="QR Code para conectar o WhatsApp"></div>' +
        '<ol class="wac-passos"><li>No celular do número do piloto, abra o <b>WhatsApp</b>.</li>' +
        '<li>Toque em <b>⋮ → Aparelhos conectados → Conectar um aparelho</b>.</li>' +
        '<li>Aponte a câmera para este código.</li></ol>' +
        (r.codigo ? '<p class="wac-nota">Ou use o código <code>' + esc(r.codigo) + '</code> em “Conectar com número de telefone”.</p>' : '') +
        '<p class="wac-nota" id="wac-espera">Esperando a leitura… o código se renova sozinho.</p>');
      clearInterval(relogio);
      relogio = setInterval(async () => {
        if (!vivo) return;
        let s; try { s = await B7.DB.waEvolution('estado'); } catch (e) { return; }
        if (s && s.estado === 'open') { clearInterval(relogio); B7.UI.toast('WhatsApp conectado ao B7.'); return estado(); }
        if (Date.now() - qrEm > 45000) { clearInterval(relogio); conectar(); }   /* o QR do WhatsApp vence em ~1 min */
      }, 3000);
    }

    /* 4.50.1: conectar pelo NÚMERO — o WhatsApp mostra um código de 8 letras
       para digitar no celular (em vez de ler o QR Code) */
    function pedirNumero() {
      clearInterval(relogio);
      pinta('<label class="rot" for="wac-num">NÚMERO DO WHATSAPP (com DDD)</label>' +
        '<div class="wac-num"><span>+55</span><input class="campo" id="wac-num" inputmode="tel" autocomplete="tel" placeholder="62 99999-0000"></div>' +
        '<p class="wac-nota">O número precisa estar com o WhatsApp aberto no celular para receber o aviso.</p>' +
        '<div class="wac-modos"><button class="b pri" data-wac="gerar-codigo">Gerar código</button>' +
        '<button class="b contorno" data-wac="conectar">Prefiro o QR Code</button></div>');
      const i = corpo.querySelector('#wac-num');
      if (i) { i.focus(); i.onkeydown = ev => { if (ev.key === 'Enter') gerarCodigo(); }; }
    }
    async function gerarCodigo() {
      const i = corpo.querySelector('#wac-num');
      let dig = String((i && i.value) || '').replace(/\D/g, '');
      if (dig.startsWith('55') && dig.length >= 12) dig = dig.slice(2);
      if (dig.length < 10 || dig.length > 11) { B7.UI.toast('Digite o DDD + número (10 ou 11 dígitos).'); if (i) i.focus(); return; }
      const numero = '55' + dig;
      pinta('<div class="wac-carrega"><i></i><span>Pedindo o código ao WhatsApp…</span></div>');
      let r;
      try { r = await B7.DB.waEvolution('conectar', { numero }); } catch (e) { return erro(e.message); }
      if (!vivo) return;
      if (r.conectado) return estado();
      if (r.erro) return erro(r.erro);
      if (!r.codigo) return erro('O WhatsApp não mandou o código. Confira o número ou use o QR Code.');
      const cod = String(r.codigo).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      pinta('<div class="wac-codigo" aria-label="Código para digitar no celular">' + esc(cod.slice(0, 4)) + '<i>-</i>' + esc(cod.slice(4)) + '</div>' +
        '<ol class="wac-passos"><li>No celular do número <b>+55 ' + esc(dig) + '</b>, abra o <b>WhatsApp</b>.</li>' +
        '<li>Toque em <b>⋮ → Aparelhos conectados → Conectar um aparelho</b>.</li>' +
        '<li>Toque em <b>“Conectar com número de telefone”</b> e digite o código acima.</li></ol>' +
        '<p class="wac-nota">Esperando a confirmação… o código vale por pouco tempo.</p>' +
        '<div class="wac-modos"><button class="b contorno" data-wac="gerar-de-novo">Gerar outro código</button>' +
        '<button class="b contorno" data-wac="conectar">Usar o QR Code</button></div>');
      corpo.dataset.numero = dig;
      clearInterval(relogio);
      relogio = setInterval(async () => {
        if (!vivo) return;
        let s; try { s = await B7.DB.waEvolution('estado'); } catch (x) { return; }
        if (s && s.estado === 'open') { clearInterval(relogio); B7.UI.toast('WhatsApp conectado ao B7.'); estado(); }
      }, 3000);
    }

    corpo.addEventListener('click', async e => {
      const b = e.target.closest('[data-wac]'); if (!b) return;
      const a = b.dataset.wac;
      if (a === 'tentar') return estado();
      if (a === 'conectar') return conectar();
      if (a === 'pelo-numero') return pedirNumero();
      if (a === 'gerar-codigo') return gerarCodigo();
      if (a === 'gerar-de-novo') { pedirNumero(); const i = corpo.querySelector('#wac-num'); if (i) i.value = corpo.dataset.numero || ''; return; }
      if (a === 'desconectar') {
        const ok = await B7.UI.confirmar({ titulo: 'Desconectar o número?', texto: 'O B7 deixa de receber e enviar por este número até conectar de novo pelo QR Code.', confirmar: 'Desconectar', perigo: true });
        if (!ok) return;
        try { await B7.DB.waEvolution('desconectar'); B7.UI.toast('Número desconectado.'); } catch (x) { B7.UI.toast(x.message, { tipo: 'erro' }); }
        estado();
      }
    });
    estado();
  }

  /* botão para pôr nas telas (só aparece para administrador) */
  const botao = (classe) => souAdmin() ? '<button type="button" class="' + (classe || 'b contorno') + '" data-wa-central title="Conectar o número pelo Evolution (piloto)">' + IC + '<span>WhatsApp B7 (piloto)</span></button>' : '';
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-wa-central]')) abrir(); });

  return { abrir, botao };
})();
