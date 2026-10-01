// =====================================================================
// ARTE DA NOTIFICAÇÃO — o cartão que aparece no aviso expandido
//
// O Android desenha a moldura do aviso (título, texto, botões). A única
// área livre é a imagem grande. Esta função gera essa imagem na hora em
// que o aparelho pede: um cartão informativo, 2:1, com a logo do cliente,
// um selo do que aconteceu, o dado principal em destaque (data, item,
// dias de atraso) e uma linha de contexto. Não é anúncio: sem foto de
// banco, sem slogan — só o que a pessoa precisa saber.
//
// São três modelos, escolhidos pelo tipo do evento:
//   data    → gravação e lembretes       (data/hora em destaque)
//   item    → atribuição, correção, aprovação, revisão (item em destaque)
//   resumo  → resumo do dia e teste      (identidade B7, sem cliente)
// Quando a notificação aponta a prévia real de uma peça de Design
// (dados.imagem), ela entra no cartão. Nenhuma outra imagem é usada.
//
// Chamada:  GET /functions/v1/b7-arte?n=<id da notificação>&s=<assinatura>
//           GET /functions/v1/b7-arte?teste=1&s=<assinatura>
// A assinatura é um HMAC do id, feito pela b7-push ao montar o aviso:
// sem ela a função não responde, então ninguém enumera cartões. O
// endereço só vai dentro do push, para quem já é destinatário.
//
// Deploy:  supabase functions deploy b7-arte --no-verify-jwt
// (quem busca a imagem é o sistema de notificações do aparelho, sem JWT)
// =====================================================================

import React from 'https://esm.sh/react@18.2.0';
import { ImageResponse } from 'https://deno.land/x/og_edge@0.0.4/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const h = React.createElement;
const L = 1200, A = 600;
const SITE = Deno.env.get('B7_SITE_URL') || 'https://branding7dados-lab.github.io/sistema-b7';
/* símbolo da B7 com fundo transparente: assenta no quadro branco como as logos dos clientes */
const MARCA_B7 = SITE + '/assets/brand/symbol-color.png';

type Tom = 'violeta' | 'magenta' | 'vermelho' | 'ambar' | 'verde';
const TONS: Record<Tom, { selo: string; texto: string; brilho: string }> = {
  violeta:  { selo: '#7C3AED', texto: '#FFFFFF', brilho: 'rgba(124,58,237,.55)' },
  magenta:  { selo: '#C21C83', texto: '#FFFFFF', brilho: 'rgba(194,28,131,.55)' },
  vermelho: { selo: '#E5484D', texto: '#FFFFFF', brilho: 'rgba(229,72,77,.50)' },
  ambar:    { selo: '#F5A524', texto: '#1A1030', brilho: 'rgba(245,165,36,.40)' },
  verde:    { selo: '#2FB67A', texto: '#06281A', brilho: 'rgba(47,182,122,.42)' }
};

type Cartao = {
  selo: string; tom: Tom; destaque: string; linhas: string[];
  cliente: string | null; logo: string | null; previa: string | null;
};

/* ------------------------------------------------------------ assinatura */
async function assinar(texto: string): Promise<string> {
  const chave = Deno.env.get('B7_WEBHOOK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const m = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('b7-arte:' + texto));
  return Array.from(new Uint8Array(m)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------------------------------------------------------- fontes */
/* Inter e Archivo, as mesmas do sistema. Carregadas uma vez por instância;
   se a busca falhar, o cartão sai com a fonte padrão — nunca deixa de sair. */
type Fonte = { name: string; data: ArrayBuffer; weight: number; style: 'normal' };
let fontes: Promise<Fonte[]> | null = null;
function carregarFontes(): Promise<Fonte[]> {
  if (!fontes) {
    const lista: [string, number, string][] = [
      ['Inter', 500, 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.ttf'],
      ['Inter', 700, 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf'],
      ['Archivo', 800, 'https://cdn.jsdelivr.net/fontsource/fonts/archivo@latest/latin-800-normal.ttf']
    ];
    fontes = Promise.all(lista.map(async ([name, weight, url]) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return { name, data: await r.arrayBuffer(), weight, style: 'normal' as const };
      } catch (_e) { return null; }
    })).then(l => l.filter(Boolean) as Fonte[]);
  }
  return fontes;
}

/* imagem remota → data URL (png/jpg). Qualquer falha devolve null e o
   cartão usa o plano B (iniciais, ou sem prévia). */
async function comoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const tipo = (r.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(png|jpe?g)$/.test(tipo)) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    if (b.length > 1_500_000) return null;
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return 'data:' + tipo + ';base64,' + btoa(s);
  } catch (_e) { return null; }
}

/* ------------------------------------------------- do aviso para o cartão */
const SELOS: [RegExp, string, Tom][] = [
  [/^agenda\.gravacao_24h$/, 'GRAVAÇÃO AMANHÃ', 'violeta'],
  [/^agenda\.gravacao_1h$/, 'GRAVAÇÃO HOJE', 'violeta'],
  [/^agenda\./, 'AGENDA', 'violeta'],
  [/^gravacao\.atribuida$/, 'GRAVAÇÃO', 'violeta'],
  [/^gravacao\.remarcada$/, 'GRAVAÇÃO REMARCADA', 'ambar'],
  [/^gravacao\.cancelada$/, 'GRAVAÇÃO CANCELADA', 'vermelho'],
  [/atrasado_critico$/, 'ATRASO CRÍTICO', 'vermelho'],
  [/atrasado/, 'ATRASADA', 'vermelho'],
  [/prazo_amanha$/, 'PRAZO', 'ambar'],
  [/^video\.correcao/, 'CORREÇÃO SOLICITADA', 'magenta'],
  [/ajuste|ajustes$/, 'AJUSTE SOLICITADO', 'magenta'],
  [/recusad/, 'RECUSADO', 'vermelho'],
  [/anulada|cliente_pendente|cliente_parcial/, 'DECISÃO ANULADA', 'ambar'],
  [/^video\.entregue$/, 'ENTREGUE', 'verde'],
  [/^roteiro\.pronto$/, 'ROTEIRO PRONTO', 'verde'],
  [/aprovad|finalizado/, 'APROVADO', 'verde'],
  [/versao_enviada|aguardando_aprovacao|revisao$/, 'AGUARDANDO REVISÃO', 'violeta'],
  [/atribuida|criada|concluida|briefing/, 'ATRIBUÍDO', 'violeta'],
  [/^resumo\./, 'SEU RESUMO', 'violeta']
];
const DATA = /(\d{2} [A-ZÇ]{3})(?: · (\d{2}:\d{2}))?/;
const semAspas = (s: string) => s.replace(/^["“]|["”]$/g, '').trim();

function montar(tipo: string, titulo: string, mensagem: string, inicio: string | null): Omit<Cartao, 'cliente' | 'logo' | 'previa'> {
  const achado = SELOS.find(([re]) => re.test(tipo));
  const selo = achado ? achado[1] : 'SISTEMA B7';
  const tom: Tom = achado ? achado[2] : 'violeta';
  const partes = (mensagem || '').split(' · ').map(p => p.trim()).filter(Boolean);
  const eData = (p: string) => /^\d{2} [A-ZÇ]{3}$/.test(p) || /^\d{2}:\d{2}$/.test(p) || /^Nova data: /.test(p);

  /* modelo "data": gravações e lembretes */
  if (/^gravacao\.|^agenda\./.test(tipo)) {
    let destaque = '';
    if (inicio) {
      const d = new Date(inicio);
      const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
      const v = (t: string) => (f.find(x => x.type === t) || { value: '' }).value;
      destaque = v('day') + ' ' + v('month').replace('.', '').toUpperCase() + ' · ' + v('hour') + ':' + v('minute');
    } else {
      const m = (mensagem || '').match(DATA);
      if (m) destaque = m[1] + (m[2] ? ' · ' + m[2] : '');
    }
    const resto = partes.filter(p => !eData(p));
    if (!destaque) destaque = resto.shift() || titulo;
    return { selo, tom, destaque, linhas: resto.slice(0, 3) };
  }

  /* atraso: os dias em destaque */
  const dias = titulo.match(/há (\d+) dias?/);
  if (dias) {
    const n = Number(dias[1]);
    return { selo, tom, destaque: n + (n === 1 ? ' DIA' : ' DIAS'), linhas: [semAspas(partes[0] || ''), ...partes.slice(1)].filter(Boolean).slice(0, 3) };
  }
  if (/prazo_amanha$/.test(tipo)) {
    return { selo, tom, destaque: 'AMANHÃ', linhas: [semAspas(partes[0] || ''), ...partes.slice(1)].filter(Boolean).slice(0, 3) };
  }

  /* modelo "item": o que é, depois o contexto */
  return { selo, tom, destaque: semAspas(partes[0] || titulo), linhas: partes.slice(1, 4) };
}

/* ------------------------------------------------------------- o desenho */
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

function desenhar(c: Cartao, temFontes: boolean) {
  const tom = TONS[c.tom];
  const sans = temFontes ? 'Inter' : 'sans-serif';
  const titulo = temFontes ? 'Archivo' : 'sans-serif';
  const larguraTexto = c.previa ? 640 : 1040;
  /* o destaque usa o maior corpo que cabe: uma linha nos tamanhos
     grandes, duas nos menores; passou disso, corta com reticências —
     nunca uma terceira linha pela metade */
  const n = c.destaque.length;
  const cabe = (tam: number, linhas: number) => n <= Math.floor(larguraTexto / (tam * 0.5)) * linhas;
  const corpo = cabe(108, 1) ? 108 : cabe(84, 1) ? 84 : cabe(64, 2) ? 64 : 50;
  const limite = Math.floor(larguraTexto / (50 * 0.5)) * 2;
  const destaque = corpo === 50 && n > limite ? c.destaque.slice(0, limite - 1).trimEnd() + '…' : c.destaque;

  const marca = c.logo
    ? h('img', { src: c.logo, width: 76, height: 76, style: { objectFit: 'contain' } })
    : h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: 38, color: '#3A1E86' } }, c.cliente ? iniciais(c.cliente) : 'B7');

  return h('div', {
    style: {
      width: L, height: A, display: 'flex', position: 'relative', overflow: 'hidden',
      backgroundColor: '#0D0A22',
      backgroundImage: 'linear-gradient(120deg, #0D0A22 0%, #1A1040 52%, #2B1157 100%)',
      fontFamily: sans, color: '#FFFFFF'
    }
  },
    /* brilho discreto, na cor do tom — acento, não fundo */
    h('div', { style: { position: 'absolute', right: -180, top: -220, width: 620, height: 620, borderRadius: 310, backgroundImage: 'radial-gradient(circle, ' + tom.brilho + ' 0%, rgba(13,10,34,0) 68%)' } }),
    h('div', { style: { position: 'absolute', left: 0, top: 0, width: 10, height: A, backgroundColor: tom.selo } }),

    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px 56px 76px', width: c.previa ? L - 420 : L, height: A } },
      /* quem: a logo do cliente (ou B7) */
      h('div', { style: { display: 'flex', alignItems: 'center' } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 104, height: 104, borderRadius: 26, backgroundColor: '#FFFFFF', overflow: 'hidden' } }, marca),
        h('div', { style: { display: 'flex', marginLeft: 26, fontSize: 40, fontWeight: 700, maxWidth: larguraTexto - 130, color: '#FFFFFF' } }, c.cliente || 'Sistema B7')
      ),
      /* o quê */
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex' } },
          h('div', { style: { display: 'flex', backgroundColor: tom.selo, color: tom.texto, fontSize: 26, fontWeight: 700, letterSpacing: 2, padding: '8px 18px', borderRadius: 10 } }, c.selo)
        ),
        h('div', { style: { display: 'flex', marginTop: 18, fontFamily: titulo, fontWeight: 800, fontSize: corpo, lineHeight: 1.04, letterSpacing: -1.5, maxWidth: larguraTexto, maxHeight: Math.ceil(corpo * 1.04 * 2), overflow: 'hidden' } }, destaque)
      ),
      /* contexto */
      h('div', { style: { display: 'flex', flexDirection: 'column', maxWidth: larguraTexto } },
        ...c.linhas.slice(0, 2).map((l, i) =>
          h('div', { key: i, style: { display: 'flex', fontSize: i === 0 ? 34 : 28, fontWeight: 500, lineHeight: 1.25, color: i === 0 ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.62)', maxHeight: i === 0 ? 86 : 36, overflow: 'hidden' } }, l))
      )
    ),

    /* prévia real da peça, quando existe */
    c.previa
      ? h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 420, height: A, paddingRight: 56 } },
          h('img', { src: c.previa, width: 364, height: 364, style: { objectFit: 'cover', borderRadius: 28, border: '4px solid rgba(255,255,255,.14)' } }))
      : null
  );
}

async function responder(c: Cartao): Promise<Response> {
  const f = await carregarFontes();
  try {
    return new ImageResponse(desenhar(c, f.length === 3), {
      width: L, height: A, fonts: f.length === 3 ? f : undefined,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' }
    });
  } catch (_e) {
    /* imagem embutida que o desenhista não aceitou: tenta sem logo e sem prévia */
    return new ImageResponse(desenhar({ ...c, logo: null, previa: null }, f.length === 3), {
      width: L, height: A, fonts: f.length === 3 ? f : undefined,
      headers: { 'Cache-Control': 'public, max-age=3600' }
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Use GET.', { status: 405 });
  const q = new URL(req.url).searchParams;
  const s = q.get('s') || '';

  /* ---- cartão do teste de push: identidade B7, sem cliente ---- */
  if (q.get('teste')) {
    if (s !== await assinar('teste')) return new Response('Não encontrado.', { status: 404 });
    return responder({
      selo: 'TESTE DE NOTIFICAÇÃO', tom: 'violeta', destaque: 'Tudo certo!',
      linhas: ['Push funcionando neste dispositivo.'], cliente: null,
      logo: await comoDataUrl(MARCA_B7), previa: null
    });
  }

  const id = q.get('n') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || s !== await assinar(id)) return new Response('Não encontrado.', { status: 404 });

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: n } = await sb.from('notificacoes')
    .select('id, tipo, titulo, mensagem, client_id, evento_id, dados').eq('id', id).maybeSingle();
  if (!n) return new Response('Não encontrado.', { status: 404 });

  let cliente: string | null = null, logoUrl: string | null = null;
  if (n.client_id) {
    const { data: c } = await sb.from('clientes').select('nome, logo_url').eq('id', n.client_id).maybeSingle();
    if (c) { cliente = c.nome || null; logoUrl = c.logo_url || null; }
  }

  /* lembrete da agenda: a data vem do evento, não do texto */
  let inicio: string | null = null;
  if ((n.tipo || '').startsWith('agenda.') && n.evento_id) {
    const { data: ev } = await sb.from('eventos_dominio').select('payload').eq('id', n.evento_id).maybeSingle();
    const p = ev && ev.payload as { inicio?: string } | null;
    inicio = (p && typeof p.inicio === 'string') ? p.inicio : null;
  }

  /* prévia real da peça de Design (bucket privado: URL assinada só para esta leitura) */
  let previaUrl: string | null = null;
  const img = n.dados && (n.dados as { imagem?: { bucket?: string; caminho?: string } }).imagem;
  if (img && typeof img.bucket === 'string' && typeof img.caminho === 'string') {
    const { data: a } = await sb.storage.from(img.bucket).createSignedUrl(img.caminho, 120);
    previaUrl = (a && a.signedUrl) || null;
  }

  const [logo, previa] = await Promise.all([
    comoDataUrl(logoUrl || (cliente ? null : MARCA_B7)),
    comoDataUrl(previaUrl)
  ]);
  const base = montar(n.tipo || '', n.titulo || '', n.mensagem || '', inicio);
  /* o nome do cliente já está no topo do cartão: não repete embaixo */
  const igual = (a: string) => !!cliente && a.trim().toLowerCase() === cliente.trim().toLowerCase();
  return responder({ ...base, linhas: base.linhas.filter(l => !igual(l)), cliente, logo, previa });
});
