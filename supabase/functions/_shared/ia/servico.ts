// =====================================================================
// B7 IA — serviço de geração
//
// Quem usa: as tarefas de IA (hoje, só o assistente de roteiros). Uma
// tarefa monta as mensagens e chama gerar(); não sabe quem responde.
//
//   tarefa → gerar() → provedorAtual() → provedor (contrato em provedor.ts)
//
// PROVEDOR ATUAL: Gemini, direto (gemini.ts). É o provedor desta fase,
// não a arquitetura: para trocar por um roteador (OmniRoute) ou por
// outro provedor, escreva o adaptador e mude provedorAtual(). Nada acima
// daqui muda.
//
// SEM RESERVA. Há um provedor e um modelo. Não existe troca automática
// para outro modelo, outro provedor nem para nada pago, e não existe
// nova tentativa: um pedido da pessoa = uma chamada ao provedor. Se ele
// falhar, a pessoa recebe um aviso e decide se tenta de novo. (Repetir
// sozinho depois de um "limite atingido" só gastaria mais cota.)
// =====================================================================

import { criarGemini } from './gemini.ts';
import type { ErroDoProvedor, Mensagem, Provedor } from './provedor.ts';

export type { Mensagem } from './provedor.ts';

/** O que a função b7-ia devolve para a tela quando não dá certo. */
export type Categoria = 'indisponivel' | 'limite' | 'cota' | 'tempo' | 'recusado';

export type Resultado =
  | { ok: true; texto: string; ms: number; provedor: string; modelo: string; tokensEntrada: number | null; tokensSaida: number | null }
  | { ok: false; categoria: Categoria; ms: number; provedor: string | null; modelo: string | null;
      /** o motivo técnico, só para o registro de uso */
      erro: ErroDoProvedor | 'nao_configurado' };

export type Opcoes = {
  maxTokens: number; temperatura: number;
  /** transforma a saída crua em texto utilizável; devolver '' = resposta inválida */
  limpar: (bruto: string) => string;
  prazoMs?: number;
};

/** O provedor desta instalação. null = IA não configurada neste ambiente. */
export function provedorAtual(env: (nome: string) => string | undefined): Provedor | null {
  return criarGemini(env);
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
    r = await provedor.gerar({ mensagens, maxTokens: op.maxTokens, temperatura: op.temperatura, prazoMs: op.prazoMs ?? 30_000 });
  } catch (_e) {
    return falha('indisponivel');
  }
  if (!r.ok) return falha(r.erro);

  const texto = op.limpar(r.texto);
  if (!texto) return falha('resposta_invalida');
  return { ok: true, texto, ms: Date.now() - inicio, provedor: provedor.nome, modelo: r.modelo, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida };
}
