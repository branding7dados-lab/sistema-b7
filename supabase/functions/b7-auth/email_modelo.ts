/* =====================================================================
   E-MAIL DO CÓDIGO (zzz220) — o visual do B7 no código da verificação
   em 2 etapas. Mesmo desenho de emails/codigo-acesso.html (a prévia):
   tabelas e estilo inline, porque Gmail e Outlook ignoram CSS moderno.
   Nada de segredo aqui: só monta o HTML e o texto.
   ===================================================================== */
const SITE = 'https://branding7dados-lab.github.io/sistema-b7/';
const LOGO = SITE + 'assets/brand/logo-white.png';

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

function quandoBrasilia(): string {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return p.day + '/' + p.month + ' às ' + p.hour + ':' + p.minute;
}

export function emailCodigo(o: { codigo: string; motivo: 'login' | 'cadastro'; nome?: string | null; aparelho?: string | null; link?: string | null }) {
  const login = o.motivo === 'login';
  const titulo = login ? 'Seu código de acesso' : 'Confirme seu e-mail';
  const sub = login ? 'Verificação em 2 etapas' : 'Verificação em 2 etapas · cadastro do e-mail';
  const frase = o.link
    ? (login ? 'Para terminar de entrar no B7, toque no botão abaixo — ou digite o código na tela de acesso.'
             : 'Para usar este e-mail na verificação em 2 etapas, toque no botão abaixo — ou digite o código no B7.')
    : (login ? 'Para terminar de entrar no B7, digite este código na tela de acesso:'
             : 'Para usar este e-mail na verificação em 2 etapas, digite este código no B7:');
  const botao = o.link ? `<tr><td class="pad" align="center" style="padding:20px 36px 4px;">
<a href="${esc(o.link)}" style="display:inline-block;background:#3A1E86;background-image:linear-gradient(135deg,#3A1E86,#C21C83);color:#FFFFFF;font:800 16px/1 Arial,Helvetica,sans-serif;text-decoration:none;padding:17px 34px;border-radius:14px;">${login ? 'Sou eu — confirmar entrada' : 'Confirmar meu e-mail'}</a>
<div class="tx2" style="font:400 12.5px/1.5 Arial,Helvetica,sans-serif;color:#9A93B3;padding-top:14px;">ou digite o código</div>
</td></tr>` : '';
  const cod = o.codigo.slice(0, 3) + ' ' + o.codigo.slice(3);
  const primeiro = String(o.nome || '').trim().split(/\s+/)[0];
  const quando = 'Hoje, ' + quandoBrasilia() + (o.aparelho ? ' · ' + esc(String(o.aparelho).slice(0, 80)) : '');
  const assunto = (login ? 'Seu código para entrar no B7: ' : 'Confirme seu e-mail no B7: ') + o.codigo;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(titulo)}</title>
<style>
@media (max-width:600px){.card{width:100%!important;border-radius:0!important}.pad{padding-left:24px!important;padding-right:24px!important}.dig{font-size:30px!important;letter-spacing:8px!important}}
@media (prefers-color-scheme:dark){.fundo{background:#0A0714!important}.card{background:#150F22!important}.tx{color:#EDEAF7!important}.tx2{color:#A9A2C4!important}
.cod{background:#1E1730!important;border-color:#3A2C66!important}.dig{color:#FFFFFF!important}.alerta{background:#231A10!important;border-color:#4A3615!important}.alerta-tx{color:#F0C98A!important}.linha{border-color:#2A2140!important}}
</style></head>
<body style="margin:0;padding:0;background:#F3F1FA;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Seu código é ${cod}. Ele vale por 10 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fundo" style="background:#F3F1FA;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;">
<tr><td class="pad" style="background:#1A1240;background-image:linear-gradient(135deg,#0B0A1E 0%,#3A1E86 62%,#C21C83 130%);padding:30px 36px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><img src="${LOGO}" width="132" alt="Branding7" style="display:block;width:132px;height:auto;border:0;"></td>
<td align="right" style="font:600 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;color:#CFC8EA;text-transform:uppercase;">Sistema B7</td>
</tr></table>
<div style="height:26px;line-height:26px;">&nbsp;</div>
<div style="font:800 26px/1.2 Arial,Helvetica,sans-serif;color:#FFFFFF;">${esc(titulo)}</div>
<div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#D9D3F0;padding-top:6px;">${esc(sub)}</div>
</td></tr>
<tr><td class="pad" style="padding:32px 36px 8px;">
<div class="tx" style="font:400 16px/1.55 Arial,Helvetica,sans-serif;color:#1B1631;">Olá${primeiro ? ', <b>' + esc(primeiro) + '</b>' : ''}!</div>
<div class="tx2" style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#5D5675;padding-top:8px;">${esc(frase)}</div>
</td></tr>
${botao}
<tr><td class="pad" align="center" style="padding:${o.link ? '8px' : '18px'} 36px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0" class="cod" style="background:#F7F5FD;border:1.5px solid #E2DBF7;border-radius:18px;"><tr><td align="center" style="padding:20px 30px;">
<div class="dig" style="font:800 38px/1 'Courier New',Courier,monospace;letter-spacing:12px;color:#3A1E86;padding-left:12px;">${cod}</div>
</td></tr></table>
<div class="tx2" style="font:600 13px/1.5 Arial,Helvetica,sans-serif;color:#7A7393;padding-top:12px;">Vale por <b style="color:#C21C83;">10 minutos</b> e só funciona uma vez.</div>
</td></tr>
<tr><td class="pad" style="padding:22px 36px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="linha" style="border-top:1px solid #EEEAF8;"><tr><td style="padding-top:16px;">
<div class="tx2" style="font:700 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.12em;color:#9A93B3;text-transform:uppercase;">Pedido feito</div>
<div class="tx" style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#1B1631;padding-top:6px;">${quando}</div>
</td></tr></table>
</td></tr>
<tr><td class="pad" style="padding:22px 36px 30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="alerta" style="background:#FFF7EA;border:1px solid #F6E0B6;border-radius:16px;"><tr><td style="padding:16px 18px;">
<div class="alerta-tx" style="font:700 14px/1.4 Arial,Helvetica,sans-serif;color:#8A5A0B;">Não foi você?</div>
<div class="alerta-tx" style="font:400 13.5px/1.55 Arial,Helvetica,sans-serif;color:#8A5A0B;padding-top:4px;">Não passe esse código para ninguém — a equipe da Branding7 nunca pede. ${login ? 'Alguém tem a sua senha: troque agora (menu da sua foto → Meu perfil → Segurança).' : 'Se não foi você que pediu, é só ignorar este e-mail.'}</div>
${login ? `<div style="padding-top:12px;"><a href="${SITE}" style="display:inline-block;background:#3A1E86;background-image:linear-gradient(135deg,#3A1E86,#C21C83);color:#FFFFFF;font:700 13.5px/1 Arial,Helvetica,sans-serif;text-decoration:none;padding:12px 18px;border-radius:12px;">Abrir o B7 e trocar a senha</a></div>` : ''}
</td></tr></table>
</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:560px;"><tr><td align="center" class="pad" style="padding:20px 36px 0;">
<div class="tx2" style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#9A93B3;">E-mail automático do Sistema B7 · não precisa responder.<br>Branding7 · comunicação e marketing</div>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const texto = frase + '\nCódigo: ' + cod + (o.link ? '\nOu abra: ' + o.link : '') + '\nVale por 10 minutos e só funciona uma vez.\n' +
    (login ? 'Não foi você? Alguém tem a sua senha: troque agora no B7 (menu da sua foto → Meu perfil → Segurança).' : 'Se não foi você que pediu, ignore este e-mail.') +
    '\n\nE-mail automático do Sistema B7.';
  return { assunto, html, texto };
}
