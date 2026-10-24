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

export function emailCodigo(o: { codigo: string; motivo: 'login' | 'cadastro'; nome?: string | null; aparelho?: string | null; link?: string | null; acao?: string | null }) {
  const login = o.motivo === 'login';
  /* zzz225: confirmar uma ação sensível (ex.: passar o cargo de admin supremo) */
  const titulo = o.acao ? 'Confirme esta ação' : login ? 'Seu código de acesso' : 'Confirme seu e-mail';
  const sub = o.acao ? 'Ação do super admin' : login ? 'Verificação em 2 etapas' : 'Verificação em 2 etapas · cadastro do e-mail';
  const frase = o.acao ? 'Para confirmar: ' + o.acao + ', digite este código no B7. Se não foi você, troque a sua senha agora.' : o.link
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
  const assunto = (o.acao ? 'Confirme a ação no B7: ' : login ? 'Seu código para entrar no B7: ' : 'Confirme seu e-mail no B7: ') + o.codigo;
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

/* zzz268: resumo semanal do cliente (toda segunda de manhã) */
const PORTAL = 'https://branding7dados-lab.github.io/sistema/';
const dataCurta = (iso: string) => { const [, m, d] = String(iso).slice(0, 10).split('-'); return d + '/' + m; };
export type Resumo = { nome?: string | null; empresa: string; papel?: string | null; aprovados: string[]; pendentes: string[];
  proximas: { titulo: string; data: string }[]; gravacoes: { nome: string; data: string }[]; pedidos_prontos: string[] };
export function temAlgo(r: Resumo) {
  return r.aprovados.length + r.pendentes.length + r.proximas.length + r.gravacoes.length + r.pedidos_prontos.length > 0;
}
export function emailResumoSemanal(r: Resumo) {
  const primeiro = String(r.nome || '').trim().split(/\s+/)[0];
  const decide = r.papel === 'dono' || r.papel === 'gestor';
  const numero = (n: number, rot: string, cor: string) => `<td align="center" width="33%" style="padding:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="cod" style="background:#F7F5FD;border:1px solid #E2DBF7;border-radius:16px;"><tr><td align="center" style="padding:14px 6px;">
<div style="font:800 28px/1 Arial,Helvetica,sans-serif;color:${cor};">${n}</div>
<div class="tx2" style="font:600 11.5px/1.3 Arial,Helvetica,sans-serif;color:#7A7393;padding-top:6px;">${esc(rot)}</div></td></tr></table></td>`;
  const lista = (titulo: string, emoji: string, itens: string[]) => !itens.length ? '' : `<tr><td class="pad" style="padding:18px 36px 0;">
<div class="tx" style="font:800 15px/1.3 Arial,Helvetica,sans-serif;color:#1B1631;">${emoji} ${esc(titulo)}</div>
${itens.map(i => `<div class="tx2 linha" style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#5D5675;padding:8px 0;border-bottom:1px solid #EEEAF8;">${i}</div>`).join('')}
</td></tr>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Sua semana com a Branding7</title>
<style>
@media (max-width:600px){.card{width:100%!important;border-radius:0!important}.pad{padding-left:22px!important;padding-right:22px!important}}
@media (prefers-color-scheme:dark){.fundo{background:#0A0714!important}.card{background:#150F22!important}.tx{color:#EDEAF7!important}.tx2{color:#A9A2C4!important}
.cod{background:#1E1730!important;border-color:#3A2C66!important}.linha{border-color:#2A2140!important}}
</style></head>
<body style="margin:0;padding:0;background:#F3F1FA;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${r.pendentes.length && decide ? r.pendentes.length + ' material(is) esperando você · ' : ''}o resumo da semana da ${esc(r.empresa)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="fundo" style="background:#F3F1FA;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;">
<tr><td class="pad" style="background:#1A1240;background-image:linear-gradient(135deg,#0B0A1E 0%,#3A1E86 62%,#C21C83 130%);padding:30px 36px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><img src="${LOGO}" width="132" alt="Branding7" style="display:block;width:132px;height:auto;border:0;"></td>
<td align="right" style="font:600 11px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;color:#CFC8EA;text-transform:uppercase;">Resumo semanal</td>
</tr></table>
<div style="height:24px;line-height:24px;">&nbsp;</div>
<div style="font:800 26px/1.2 Arial,Helvetica,sans-serif;color:#FFFFFF;">Sua semana com a Branding7</div>
<div style="font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#D9D3F0;padding-top:6px;">${esc(r.empresa)}</div>
</td></tr>
<tr><td class="pad" style="padding:28px 36px 6px;">
<div class="tx" style="font:400 16px/1.55 Arial,Helvetica,sans-serif;color:#1B1631;">Olá${primeiro ? ', <b>' + esc(primeiro) + '</b>' : ''}! 👋</div>
<div class="tx2" style="font:400 15px/1.6 Arial,Helvetica,sans-serif;color:#5D5675;padding-top:6px;">Aqui está o que aconteceu e o que vem por aí.</div>
</td></tr>
<tr><td class="pad" style="padding:12px 30px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${numero(r.aprovados.length, 'aprovados na semana', '#12805A')}${numero(r.pendentes.length, decide ? 'esperando você' : 'esperando aprovação', '#C21C83')}${numero(r.proximas.length, 'publicações nos próximos 7 dias', '#3A1E86')}
</tr></table></td></tr>
${lista(decide ? 'Esperando a sua aprovação' : 'Esperando aprovação', '⏳', r.pendentes.map(t => esc(t)))}
${lista('Aprovado nesta semana', '✅', r.aprovados.map(t => esc(t)))}
${lista('Vai ao ar nos próximos dias', '📅', r.proximas.map(p => '<b style="color:#3A1E86;">' + dataCurta(p.data) + '</b> · ' + esc(p.titulo)))}
${lista('Gravações marcadas', '🎬', r.gravacoes.map(g => '<b style="color:#3A1E86;">' + dataCurta(g.data) + '</b> · ' + esc(g.nome)))}
${lista('Seus pedidos que ficaram prontos', '🎉', r.pedidos_prontos.map(t => esc(t)))}
<tr><td class="pad" align="center" style="padding:26px 36px 30px;">
<a href="${PORTAL}" style="display:inline-block;background:#3A1E86;background-image:linear-gradient(135deg,#3A1E86,#C21C83);color:#FFFFFF;font:800 15px/1 Arial,Helvetica,sans-serif;text-decoration:none;padding:16px 30px;border-radius:14px;">${r.pendentes.length && decide ? 'Revisar agora' : 'Abrir o portal'}</a>
</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card" style="width:560px;max-width:560px;"><tr><td align="center" class="pad" style="padding:20px 36px 0;">
<div class="tx2" style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#9A93B3;">Você recebe este resumo porque ativou no portal (Meu perfil → Resumo semanal).<br>Para parar, é só apagar o e-mail lá. · Branding7</div>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const sec = (t: string, l: string[]) => l.length ? '\n' + t + ':\n' + l.map(x => '- ' + x).join('\n') : '';
  const texto = 'Sua semana com a Branding7 — ' + r.empresa +
    sec(decide ? 'Esperando a sua aprovação' : 'Esperando aprovação', r.pendentes) + sec('Aprovado nesta semana', r.aprovados) +
    sec('Vai ao ar nos próximos dias', r.proximas.map(p => dataCurta(p.data) + ' · ' + p.titulo)) +
    sec('Gravações marcadas', r.gravacoes.map(g => dataCurta(g.data) + ' · ' + g.nome)) + sec('Pedidos prontos', r.pedidos_prontos) +
    '\n\nAbrir o portal: ' + PORTAL + '\nPara parar de receber: Meu perfil → Resumo semanal.';
  const assunto = r.pendentes.length && decide
    ? '⏳ ' + r.pendentes.length + (r.pendentes.length === 1 ? ' material esperando você' : ' materiais esperando você') + ' · semana da ' + r.empresa
    : '📬 Sua semana com a Branding7 · ' + r.empresa;
  return { assunto, html, texto };
}
