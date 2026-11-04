// =====================================================================
// B7 IA — Groq na frente, Gemini de reserva (zzz300)
//
// Com as duas chaves configuradas, cada pedido vai para:
//   Gemini  quando tem áudio ou imagem, ou quando a tarefa é "fina"
//           (legendas e revisão de marca: português palavra por palavra)
//   Groq    todo o resto (chat, WhatsApp, resumos, sugestões) — rápido
//
// Se o Groq não atender (limite da camada gratuita, fora do ar, modelo
// retirado, resposta vazia ou fora do formato que a tarefa aceita), o
// MESMO pedido vai para o Gemini, uma vez.
// No fluxo do chat isso só acontece se nada tiver sido escrito na tela.
//
// zzz301: pedido grande demais para a camada gratuita do Groq (o chat
// manda ~9 mil tokens de contexto; o limite grátis é ~8 mil por minuto e
// ele devolve 413 na hora) vai direto para o Gemini, sem a ida e volta
// perdida. Limite em GROQ_LIMITE_TOKENS (padrão 6000, estimado por
// caracteres).
//
// No registro de uso aparece "b7:groq" ou "b7:gemini" (quem atendeu) e
// houve_fallback quando o Groq falhou e o Gemini respondeu.
// =====================================================================

import type { PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

/* ~3,5 caracteres por token em português; conta também a resposta pedida */
export const tokensEstimados = (p: PedidoDeGeracao) =>
  Math.ceil(p.mensagens.reduce((n, m) => n + m.content.length, 0) / 3.5) + p.maxTokens;

/* v3.3.0 — PEDIDO GRANDE TAMBÉM NO GROQ. O chat manda de 6 a 11 mil tokens
   (os dados do sistema vão junto) e por isso ia sempre para o Gemini (1 a 6 s,
   às vezes travava). Na camada gratuita do Groq há modelos com limite por
   minuto bem maior que o do gpt-oss; o "grande" (GROQ_MODELO_GRANDE, padrão
   Llama 4 Scout) tenta primeiro esses pedidos até GROQ_LIMITE_GRANDE tokens.
   Se ele recusar (limite do minuto, modelo retirado, fora do ar, resposta
   fora do formato), o MESMO pedido vai ao Gemini, como antes. */
export type Grande = { provedor: Provedor; limite: number };

export function criarDuplo(rapido: Provedor, reserva: Provedor, limiteTokens = 6000, grande: Grande | null = null): Provedor {
  const soReserva = (p: PedidoDeGeracao) => !!(p.audio || p.imagem || p.fino);
  /* quem tenta primeiro (antes da reserva), pelo tamanho do pedido */
  const primeiro = (p: PedidoDeGeracao): Provedor | null => {
    if (soReserva(p)) return null;
    const n = tokensEstimados(p);
    if (n <= limiteTokens) return rapido;
    if (grande && n <= grande.limite) return grande.provedor;
    return null;
  };
  const marca = (r: RespostaDoProvedor, quem: string, trocou: boolean): RespostaDoProvedor =>
    r.ok ? { ...r, servidoPor: quem, trocas: trocou ? 1 : null } : r;

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    const q = primeiro(p);
    if (!q) return marca(await reserva.gerar(p), reserva.nome, false);
    const r = await q.gerar(p);
    if (r.ok && (!p.valida || p.valida(r.texto))) return marca(r, q.nome, false);
    console.error('[b7-ia] ' + q.nome + ' (' + q.modelo + ') falhou (' + (r.ok ? 'fora do formato' : r.erro + ', ' + r.status) + '); indo para ' + reserva.nome);
    return marca(await reserva.gerar(p), reserva.nome, true);
  }

  async function gerarFluxo(p: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor> {
    const fluxoDe = (x: Provedor) => x.gerarFluxo ? x.gerarFluxo(p, aoTrecho) : x.gerar(p);
    const q = primeiro(p);
    if (!q) return marca(await fluxoDe(reserva), reserva.nome, false);
    let emitiu = false;
    const r = q.gerarFluxo
      ? await q.gerarFluxo(p, t => { emitiu = true; aoTrecho(t); })
      : await q.gerar(p);
    if (r.ok) return marca(r, q.nome, false);
    /* já apareceu texto na tela: trocar de modelo no meio embaralharia a resposta */
    if (emitiu) return r;
    console.error('[b7-ia] ' + q.nome + ' (' + q.modelo + ') falhou no fluxo (' + r.erro + ', ' + r.status + '); indo para ' + reserva.nome);
    return marca(await fluxoDe(reserva), reserva.nome, true);
  }

  return { nome: 'b7', modelo: rapido.modelo, gerar, gerarFluxo };
}
