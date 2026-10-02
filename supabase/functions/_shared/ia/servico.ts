// =====================================================================
// B7 IA — serviço de geração
//
// Quem usa: as tarefas de IA (roteiros e linha editorial). Uma tarefa
// monta as mensagens e chama gerar(); não sabe quem responde.
//
//   tarefa → gerar() → provedorAtual() → provedor (contrato em provedor.ts)
//
// QUAL PROVEDOR. Decidido pelos segredos, uma vez por pedido:
//   OmniRoute (omniroute.ts)  se OMNIROUTE_URL, OMNIROUTE_API_KEY e
//                             OMNIROUTE_MODEL estiverem configurados
//   Gemini direto (gemini.ts) caso contrário
// Para voltar ao Gemini direto, basta apagar o segredo OMNIROUTE_URL.
//
// SEM RESERVA NO B7. Um pedido da pessoa = uma chamada ao provedor
// escolhido. Com o OmniRoute configurado, se ele estiver fora do ar o
// B7 NÃO cai para o Gemini direto: a pessoa recebe um aviso e decide se
// tenta de novo. (Trocar de modelo quando um provedor falha é trabalho
// do roteador, dentro do combo dele. Repetir sozinho depois de um
// "limite atingido" só gastaria mais cota.)
// =====================================================================

import { criarGemini } from './gemini.ts';
import { criarOmniRoute } from './omniroute.ts';
import type { ErroDoProvedor, Mensagem, Provedor } from './provedor.ts';

export type { Mensagem } from './provedor.ts';

/** O que a função b7-ia devolve para a tela quando não dá certo. */
export type Categoria = 'indisponivel' | 'limite' | 'cota' | 'tempo' | 'recusado';

export type Resultado =
  | { ok: true; texto: string; ms: number; provedor: string; modelo: string; tokensEntrada: number | null; tokensSaida: number | null;
      /** só com roteador: quem atendeu por trás dele, trocas internas e custo informado */
      servidoPor: string | null; trocas: number | null; custo: number | null }
  | { ok: false; categoria: Categoria; ms: number; provedor: string | null; modelo: string | null;
      /** o motivo técnico, só para o registro de uso */
      erro: ErroDoProvedor | 'nao_configurado' };

export type Opcoes = {
  maxTokens: number; temperatura: number;
  /** transforma a saída crua em texto utilizável; devolver '' = resposta inválida */
  limpar: (bruto: string) => string;
  prazoMs?: number;
  /** pede JSON ao provedor; `limpar` continua sendo quem valida */
  json?: boolean;
};

/** O provedor desta instalação. null = IA não configurada neste ambiente. */
export function provedorAtual(env: (nome: string) => string | undefined): Provedor | null {
  return criarOmniRoute(env) || criarGemini(env);
}

/* Do motivo técnico para o que a pessoa precisa saber. Chave errada,
   modelo inexistente e pedido recusado pelo provedor são problemas de
   configuração: para quem está escrevendo, o assistente está fora do ar. */
const PARA_A_TELA: Record<ErroDoProvedor | 'nao_configurado', Categoria> = {
  nao_configurado: 'indisponivel', credencial: 'indisponivel', modelo: 'indisponivel',
  pedido_invalido: 'indisponivel', resposta_invalida: 'indisponivel', indisponivel: 'indisponivel',
  limite: 'limite', cota: 'cota', tempo: 'tempo', recusado: 'recusado'
};

export async function gerar(provedor: Provedor | null, mensagens: Mensagem[], op: Opcoes): Promise<Resultado> {
  const inicio = Date.now();
  const falha = (erro: ErroDoProvedor | 'nao_configurado'): Resultado => ({
    ok: false, categoria: PARA_A_TELA[erro], erro, ms: Date.now() - inicio,
    provedor: provedor ? provedor.nome : null, modelo: provedor ? provedor.modelo : null
  });
  if (!provedor) return falha('nao_configurado');

  let r;
  try {
    r = await provedor.gerar({ mensagens, maxTokens: op.maxTokens, temperatura: op.temperatura, prazoMs: op.prazoMs ?? 30_000, json: op.json });
  } catch (_e) {
    return falha('indisponivel');
  }
  if (!r.ok) return falha(r.erro);

  const texto = op.limpar(r.texto);
  if (!texto) return falha('resposta_invalida');
  return {
    ok: true, texto, ms: Date.now() - inicio, provedor: provedor.nome, modelo: r.modelo,
    tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida,
    servidoPor: r.servidoPor ?? null, trocas: r.trocas ?? null, custo: r.custo ?? null
  };
}
