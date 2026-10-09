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
//           GET /functions/v1/b7-arte?amostra=gravacao|semhora|atraso|item|longo|previa|resumo   (dados fictícios, sem assinatura)
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
/* o mesmo símbolo em branco, para o selo "Sistema B7" no canto do cartão */
const MARCA_B7_BRANCA = SITE + '/assets/brand/symbol-white.png';

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
  /** zzz144b: dia em folha de calendário, número grande (atraso) e a marca do B7 no canto */
  quando?: { dia: string; mes: string; semana: string; hora: string } | null;
  numero?: { valor: string; rotulo: string } | null;
  marcaB7?: string | null;
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

type Quando = { dia: string; mes: string; semana: string; hora: string };
type Base = { selo: string; tom: Tom; destaque: string; linhas: string[]; quando: Quando | null; numero: { valor: string; rotulo: string } | null };

function montar(tipo: string, titulo: string, mensagem: string, inicio: string | null): Base {
  const achado = SELOS.find(([re]) => re.test(tipo));
  const selo = achado ? achado[1] : 'SISTEMA B7';
  const tom: Tom = achado ? achado[2] : 'violeta';
  const partes = (mensagem || '').split(' · ').map(p => p.trim()).filter(Boolean);
  const eData = (p: string) => /^\d{2} [A-ZÇ]{3}$/.test(p) || /^\d{2}:\d{2}$/.test(p) || /^Nova data: /.test(p);

  /* modelo "data": gravações e lembretes — o dia vira uma folha de calendário */
  if (/^gravacao\.|^agenda\./.test(tipo)) {
    let destaque = '', quando: Quando | null = null;
    if (inicio) {
      const d = new Date(inicio);
      const f = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
      const v = (t: string) => (f.find(x => x.type === t) || { value: '' }).value;
      const mes = v('month').replace('.', '').toUpperCase(), hora = v('hour') + ':' + v('minute');
      quando = { dia: v('day'), mes, semana: v('weekday').replace('.', '').toUpperCase(), hora };
      destaque = v('day') + ' ' + mes + ' · ' + hora;
    } else {
      const m = (mensagem || '').match(DATA);
      if (m) {
        destaque = m[1] + (m[2] ? ' · ' + m[2] : '');
        quando = { dia: m[1].slice(0, 2), mes: m[1].slice(3), semana: '', hora: m[2] || '' };
      }
    }
    const resto = partes.filter(p => !eData(p));
    if (!destaque) destaque = resto.shift() || titulo;
    return { selo, tom, destaque, linhas: resto.slice(0, 3), quando, numero: null };
  }

  /* atraso: os dias viram o número grande; o item vem ao lado */
  const dias = titulo.match(/há (\d+) dias?/);
  if (dias) {
    const n = Number(dias[1]);
    return { selo, tom, destaque: semAspas(partes[0] || titulo), linhas: partes.slice(1, 4), quando: null,
      numero: { valor: String(n), rotulo: n === 1 ? 'DIA' : 'DIAS' } };
  }
  if (/prazo_amanha$/.test(tipo)) {
    return { selo, tom, destaque: 'AMANHÃ', linhas: [semAspas(partes[0] || ''), ...partes.slice(1)].filter(Boolean).slice(0, 3), quando: null, numero: null };
  }

  /* modelo "item": o que é, depois o contexto */
  return { selo, tom, destaque: semAspas(partes[0] || titulo), linhas: partes.slice(1, 4), quando: null, numero: null };
}

/* ------------------------------------------------------------- o desenho
   zzz144b — cartão redesenhado. Três composições:
     · folha de calendário + hora (gravações e lembretes);
     · número grande + item (atrasos);
     · selo + título (todo o resto), com a prévia da peça quando existe.
   Em todas: quem é (logo e nome do cliente) no alto à esquerda, a marca
   do B7 no alto à direita, luz na cor do assunto e um fio em degradê
   embaixo. O desenhista (satori) só entende flexbox: todo elemento com
   mais de um filho precisa de display:flex. */
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const encurta = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + '…' : s);

function desenhar(c: Cartao, temFontes: boolean) {
  const tom = TONS[c.tom];
  const sans = temFontes ? 'Inter' : 'sans-serif';
  const titulo = temFontes ? 'Archivo' : 'sans-serif';
  const PAD = 60, PREVIA = c.previa ? 400 : 0;
  const temFolha = !!c.quando || !!c.numero;
  const larguraTexto = L - PAD * 2 - PREVIA - (temFolha ? 220 + 44 : 0);
  const porLinha = (tam: number) => Math.max(8, Math.floor(larguraTexto / (tam * 0.52)));

  /* ---- fundo: degradê profundo, duas luzes, anéis e o fio da base ---- */
  const fundo = [
    h('div', { key: 'l1', style: { position: 'absolute', right: -200, top: -260, width: 720, height: 720, borderRadius: 360, backgroundImage: 'radial-gradient(circle, ' + tom.brilho + ' 0%, rgba(13,10,34,0) 66%)' } }),
    h('div', { key: 'l2', style: { position: 'absolute', left: -220, bottom: -320, width: 640, height: 640, borderRadius: 320, backgroundImage: 'radial-gradient(circle, rgba(91,68,192,.42) 0%, rgba(13,10,34,0) 66%)' } }),
    h('div', { key: 'a1', style: { position: 'absolute', right: -150, top: -150, width: 460, height: 460, borderRadius: 230, border: '2px solid rgba(255,255,255,.07)' } }),
    h('div', { key: 'a2', style: { position: 'absolute', right: -60, top: -60, width: 280, height: 280, borderRadius: 140, border: '2px solid rgba(255,255,255,.06)' } }),
    h('div', { key: 'fio', style: { position: 'absolute', left: 0, bottom: 0, width: L, height: 10, backgroundImage: 'linear-gradient(90deg, ' + tom.selo + ' 0%, #7C1E85 55%, #C21C83 100%)' } })
  ];

  /* ---- alto: quem é (esquerda) e a marca do B7 (direita) ---- */
  const marca = c.logo
    ? h('img', { src: c.logo, width: 64, height: 64, style: { objectFit: 'contain' } })
    : h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: 32, color: '#3A1E86' } }, c.cliente ? iniciais(c.cliente) : 'B7');
  const cab = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: L - PAD * 2 } },
    h('div', { style: { display: 'flex', alignItems: 'center' } },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 88, height: 88, borderRadius: 24, backgroundColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,.35)' } }, marca),
      h('div', { style: { display: 'flex', flexDirection: 'column', marginLeft: 22 } },
        h('div', { style: { display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 4, color: 'rgba(255,255,255,.5)' } }, c.cliente ? 'CLIENTE' : 'AGÊNCIA'),
        h('div', { style: { display: 'flex', fontSize: 36, fontWeight: 700, color: '#FFFFFF', marginTop: 2 } }, encurta(c.cliente || 'Branding7', c.cliente ? 30 : 30))
      )
    ),
    h('div', { style: { display: 'flex', alignItems: 'center', padding: '10px 20px 10px 14px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,.08)', border: '2px solid rgba(255,255,255,.13)' } },
      c.marcaB7 ? h('img', { src: c.marcaB7, width: 30, height: 30, style: { objectFit: 'contain' } }) : h('div', { style: { display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: '#C21C83' } }),
      h('div', { style: { display: 'flex', marginLeft: 10, fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.88)' } }, 'Sistema B7')
    )
  );

  /* ---- peças comuns ---- */
  const selo = h('div', { style: { display: 'flex' } },
    h('div', { style: { display: 'flex', alignItems: 'center', backgroundColor: tom.selo, color: tom.texto, fontSize: 23, fontWeight: 700, letterSpacing: 3, padding: '8px 20px 8px 14px', borderRadius: 999 } },
      h('div', { style: { display: 'flex', width: 10, height: 10, borderRadius: 5, backgroundColor: tom.texto, marginRight: 10 } }),
      h('div', { style: { display: 'flex' } }, c.selo)));
  const linhas = (lista: string[]) => lista.slice(0, 2).map((l, i) =>
    h('div', { key: 'ln' + i, style: { display: 'flex', fontSize: i === 0 ? 34 : 26, fontWeight: i === 0 ? 700 : 500, lineHeight: 1.25, marginTop: i === 0 ? 14 : 4,
      color: i === 0 ? 'rgba(255,255,255,.94)' : 'rgba(255,255,255,.6)' } }, encurta(l, porLinha(i === 0 ? 34 : 26))));
  const folha = (topo: string, grande: string, base: string) =>
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220, height: 252, borderRadius: 38, backgroundColor: 'rgba(255,255,255,.07)', border: '2px solid rgba(255,255,255,.15)', overflow: 'hidden', boxShadow: '0 24px 50px rgba(0,0,0,.35)' } },
      h('div', { style: { display: 'flex', justifyContent: 'center', width: 220, padding: '12px 0', backgroundColor: tom.selo, color: tom.texto, fontSize: 27, fontWeight: 700, letterSpacing: topo.length > 4 ? 4 : 7 } }, topo),
      h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: grande.length > 2 ? 100 : 136, lineHeight: 1, marginTop: grande.length > 2 ? 28 : 12, letterSpacing: -4, color: '#FFFFFF' } }, grande),
      h('div', { style: { display: 'flex', fontSize: 23, fontWeight: 700, letterSpacing: 6, color: 'rgba(255,255,255,.55)', marginTop: 4 } }, base || ' '));

  /* ---- miolo ---- */
  let miolo;
  if (c.quando) {
    const q = c.quando;
    /* sem hora, o nome da gravação ocupa o lugar dela */
    const principal = q.hora || c.linhas[0] || c.destaque;
    const resto = q.hora ? c.linhas : c.linhas.slice(1);
    const tam = q.hora ? 128 : (principal.length <= porLinha(72) ? 72 : 54);
    miolo = h('div', { style: { display: 'flex', alignItems: 'flex-end' } },
      folha(q.mes, q.dia, q.semana),
      h('div', { style: { display: 'flex', flexDirection: 'column', marginLeft: 44, width: larguraTexto } },
        selo,
        h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: tam, lineHeight: 1, letterSpacing: q.hora ? -4 : -1.5, marginTop: 16, color: '#FFFFFF' } }, q.hora ? principal : encurta(principal, porLinha(tam) * (tam === 54 ? 2 : 1))),
        ...linhas(resto)));
  } else if (c.numero) {
    const n = c.destaque.length;
    const tam = n <= porLinha(64) ? 64 : 50;
    miolo = h('div', { style: { display: 'flex', alignItems: 'flex-end' } },
      folha('ATRASO', c.numero.valor, c.numero.rotulo),
      h('div', { style: { display: 'flex', flexDirection: 'column', marginLeft: 44, width: larguraTexto } },
        selo,
        h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: tam, lineHeight: 1.06, letterSpacing: -1.5, marginTop: 16, color: '#FFFFFF', maxHeight: Math.ceil(tam * 1.06 * 2), overflow: 'hidden' } }, encurta(c.destaque, porLinha(tam) * 2)),
        ...linhas(c.linhas)));
  } else {
    /* o destaque usa o maior corpo que cabe: uma linha nos tamanhos grandes, duas nos menores */
    const n = c.destaque.length;
    const cabe = (tam: number, ls: number) => n <= porLinha(tam) * ls;
    const tam = cabe(108, 1) ? 108 : cabe(84, 1) ? 84 : cabe(66, 2) ? 66 : 52;
    miolo = h('div', { style: { display: 'flex', flexDirection: 'column', width: larguraTexto } },
      selo,
      h('div', { style: { display: 'flex', fontFamily: titulo, fontWeight: 800, fontSize: tam, lineHeight: 1.05, letterSpacing: -1.5, marginTop: 18, color: '#FFFFFF', maxHeight: Math.ceil(tam * 1.05 * 2), overflow: 'hidden' } }, encurta(c.destaque, porLinha(tam) * 2)),
      ...linhas(c.linhas));
  }

  return h('div', {
    style: {
      width: L, height: A, display: 'flex', position: 'relative', overflow: 'hidden',
      backgroundColor: '#0B0820',
      backgroundImage: 'linear-gradient(135deg, #0B0820 0%, #17103A 50%, #2A1152 100%)',
      fontFamily: sans, color: '#FFFFFF'
    }
  },
    ...fundo,
    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px ' + PAD + 'px 58px', width: L, height: A } },
      cab,
      h('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: L - PAD * 2 } },
        miolo,
        /* prévia real da peça, quando existe */
        c.previa
          ? h('div', { style: { display: 'flex', width: 348, height: 348, borderRadius: 30, overflow: 'hidden', border: '4px solid rgba(255,255,255,.18)', boxShadow: '0 30px 60px rgba(0,0,0,.45)' } },
              h('img', { src: c.previa, width: 340, height: 340, style: { objectFit: 'cover' } }))
          : null))
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
    return new ImageResponse(desenhar({ ...c, logo: null, previa: null, marcaB7: null }, f.length === 3), {
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
      logo: await comoDataUrl(MARCA_B7), previa: null, marcaB7: await comoDataUrl(MARCA_B7_BRANCA)
    });
  }

  /* ---- amostras do desenho (zzz144b): dados FICTÍCIOS, fixos aqui. Não lê
     o banco nem mostra aviso de ninguém; serve para conferir o visual. ---- */
  const amostra = q.get('amostra');
  if (amostra) {
    const [logoB7, branca] = await Promise.all([comoDataUrl(MARCA_B7), comoDataUrl(MARCA_B7_BRANCA)]);
    const comum = { cliente: 'Cliente Exemplo', logo: null, previa: null, marcaB7: branca };
    const modelos: Record<string, Cartao> = {
      gravacao: { ...comum, selo: 'GRAVAÇÃO HOJE', tom: 'violeta', destaque: '09 OUT · 15:30', linhas: ['Gravação de outubro', 'Estúdio B7'], quando: { dia: '09', mes: 'OUT', semana: 'SEX', hora: '15:30' } },
      semhora: { ...comum, selo: 'GRAVAÇÃO REMARCADA', tom: 'ambar', destaque: '14 OUT', linhas: ['Gravação de outubro', 'Estúdio B7'], quando: { dia: '14', mes: 'OUT', semana: '', hora: '' } },
      atraso: { ...comum, selo: 'ATRASO CRÍTICO', tom: 'vermelho', destaque: 'Reels de lançamento da campanha', linhas: ['Edição de vídeo', 'Prazo era 06 OUT'], numero: { valor: '3', rotulo: 'DIAS' } },
      item: { ...comum, selo: 'AGUARDANDO REVISÃO', tom: 'violeta', destaque: 'Carrossel de outubro', linhas: ['Versão 2 enviada', 'Design'] },
      longo: { ...comum, selo: 'CORREÇÃO SOLICITADA', tom: 'magenta', destaque: 'Vídeo institucional de fim de ano com depoimentos da equipe e dos clientes', linhas: ['Ajustar a trilha e o corte final', 'Edição de vídeo'] },
      previa: { ...comum, selo: 'APROVADO', tom: 'verde', destaque: 'Card do dia das crianças', linhas: ['Aprovado pelo cliente', 'Design'], previa: logoB7 },
      resumo: { selo: 'SEU RESUMO', tom: 'violeta', destaque: '4 itens para hoje', linhas: ['2 gravações · 2 entregas'], cliente: null, logo: logoB7, previa: null, marcaB7: branca }
    };
    return responder(modelos[amostra] || modelos.gravacao);
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
  const marcaB7 = await comoDataUrl(MARCA_B7_BRANCA);
  return responder({ ...base, linhas: base.linhas.filter(l => !igual(l)), cliente, logo, previa, marcaB7 });
});
