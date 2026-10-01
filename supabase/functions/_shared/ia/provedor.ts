// =====================================================================
// B7 IA — o contrato de um provedor de IA
//
// É a fronteira que separa o B7 de quem gera o texto. Tudo acima dela
// (tarefas, função b7-ia, telas) fala nestes termos e não conhece
// Google, OmniRoute nem o formato de resposta de ninguém.
//
//   hoje:    serviço → gemini.ts → API do Gemini
//   depois:  serviço → omniroute.ts → OmniRoute → vários modelos
//
// Trocar de provedor é escrever outro arquivo que devolva um `Provedor`
// e mudar uma linha em servico.ts (provedorAtual). Telas, tarefas,
// permissões, registro e mensagens de erro não mudam.
// =====================================================================

export type Mensagem = { role: 'system' | 'user'; content: string };

export type PedidoDeGeracao = {
  mensagens: Mensagem[];
  maxTokens: number;
  temperatura: number;
  prazoMs: number;
};

/** O que pode dar errado, em termos do B7 (não do provedor). */
export type ErroDoProvedor =
  | 'credencial'        // chave ausente no provedor, inválida ou sem permissão
  | 'modelo'            // o modelo configurado não existe para esta chave
  | 'limite'            // limite por minuto: passa sozinho em instantes
  | 'cota'              // cota do período esgotada: só volta mais tarde
  | 'tempo'             // não respondeu dentro do prazo
  | 'recusado'          // o provedor se recusou a gerar (filtro de conteúdo)
  | 'pedido_invalido'   // o provedor não aceitou o pedido
  | 'resposta_invalida' // respondeu, mas sem texto aproveitável
  | 'indisponivel';     // fora do ar, erro interno, rede

export type RespostaDoProvedor =
  | { ok: true; texto: string; modelo: string; tokensEntrada: number | null; tokensSaida: number | null }
  | { ok: false; erro: ErroDoProvedor; status: number | null };

export type Provedor = {
  /** nome curto para o registro de uso: 'gemini' */
  nome: string;
  /** modelo configurado, também para o registro */
  modelo: string;
  gerar(pedido: PedidoDeGeracao): Promise<RespostaDoProvedor>;
};
