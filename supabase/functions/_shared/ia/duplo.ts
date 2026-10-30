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
// No registro de uso aparece "b7:groq" ou "b7:gemini" (quem atendeu) e
// houve_fallback quando o Groq falhou e o Gemini respondeu.
// =====================================================================

import type { PedidoDeGeracao, Provedor, RespostaDoProvedor } from './provedor.ts';

export function criarDuplo(rapido: Provedor, reserva: Provedor): Provedor {
  const vaiNaReserva = (p: PedidoDeGeracao) => !!(p.audio || p.imagem || p.fino);
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
