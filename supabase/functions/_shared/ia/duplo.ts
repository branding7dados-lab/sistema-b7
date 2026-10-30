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

export function criarDuplo(rapido: Provedor, reserva: Provedor, limiteTokens = 6000): Provedor {
  const vaiNaReserva = (p: PedidoDeGeracao) => !!(p.audio || p.imagem || p.fino) || tokensEstimados(p) > limiteTokens;
  const marca = (r: RespostaDoProvedor, quem: string, trocou: boolean): RespostaDoProvedor =>
    r.ok ? { ...r, servidoPor: quem, trocas: trocou ? 1 : null } : r;

  async function gerar(p: PedidoDeGeracao): Promise<RespostaDoProvedor> {
    if (vaiNaReserva(p)) return marca(await reserva.gerar(p), reserva.nome, false);
    const r = await rapido.gerar(p);
    if (r.ok && (!p.valida || p.valida(r.texto))) return marca(r, rapido.nome, false);
    console.error('[b7-ia] ' + rapido.nome + ' falhou (' + (r.ok ? 'fora do formato' : r.erro + ', ' + r.status) + '); indo para ' + reserva.nome);
    return marca(await reserva.gerar(p), reserva.nome, true);
  }

  async function gerarFluxo(p: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor> {
    const fluxoDe = (q: Provedor) => q.gerarFluxo ? q.gerarFluxo(p, aoTrecho) : q.gerar(p);
    if (vaiNaReserva(p)) return marca(await fluxoDe(reserva), reserva.nome, false);
    let emitiu = false;
    const r = rapido.gerarFluxo
      ? await rapido.gerarFluxo(p, t => { emitiu = true; aoTrecho(t); })
      : await rapido.gerar(p);
    if (r.ok) return marca(r, rapido.nome, false);
    /* já apareceu texto na tela: trocar de modelo no meio embaralharia a resposta */
    if (emitiu) return r;
    console.error('[b7-ia] ' + rapido.nome + ' falhou no fluxo (' + r.erro + ', ' + r.status + '); indo para ' + reserva.nome);
    return marca(await fluxoDe(reserva), reserva.nome, true);
  }

  return { nome: 'b7', modelo: rapido.modelo, gerar, gerarFluxo };
}
