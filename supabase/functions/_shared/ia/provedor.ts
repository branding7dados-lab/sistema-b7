// =====================================================================
// B7 IA — o contrato de um provedor de IA
//
// É a fronteira que separa o B7 de quem gera o texto. Tudo acima dela
// (tarefas, função b7-ia, telas) fala nestes termos e não conhece
// Google, OmniRoute nem o formato de resposta de ninguém.
//
//   serviço → gemini.ts    → API do Gemini
//   serviço → omniroute.ts → OmniRoute → vários modelos
//
// Qual dos dois atende é decidido pelos segredos, em servico.ts
// (provedorAtual). Um provedor novo é outro arquivo que devolva um
// `Provedor`. Telas, tarefas, permissões, registro e mensagens de erro
// não mudam.
// =====================================================================

export type Mensagem = { role: 'system' | 'user'; content: string };

export type PedidoDeGeracao = {
  mensagens: Mensagem[];
  maxTokens: number;
  temperatura: number;
  prazoMs: number;
  /** true = a resposta deve ser um JSON (quem valida o conteúdo é a tarefa) */
  json?: boolean;
  /** formato do JSON esperado (subconjunto do OpenAPI: type, properties,
      items, enum, required). O provedor que souber usa para prender a
      resposta ao formato; quem não souber ignora. A tarefa valida igual. */
  esquema?: Record<string, unknown>;
  /** zzz126: um áudio curto que acompanha o pedido (transcrição de voz).
      Só o provedor que aceita áudio usa; os outros recusam o pedido. */
  audio?: { mime: string; base64: string };
  /** zzz128: uma imagem que acompanha o pedido (anexo do assistente) */
  imagem?: { mime: string; base64: string };
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
  | { ok: true; texto: string; modelo: string; tokensEntrada: number | null; tokensSaida: number | null;
      /** só um roteador informa: quem atendeu por trás dele, quantas trocas fez e o custo (USD) */
      servidoPor?: string | null; trocas?: number | null; custo?: number | null }
  | { ok: false; erro: ErroDoProvedor; status: number | null };

export type Provedor = {
  /** nome curto para o registro de uso: 'gemini', 'omniroute' */
  nome: string;
  /** modelo configurado, também para o registro */
  modelo: string;
  gerar(pedido: PedidoDeGeracao): Promise<RespostaDoProvedor>;
  /** opcional (zzz123): a mesma geração, entregando o texto em pedaços
      conforme o modelo escreve. No fim devolve a resposta inteira, igual
      a gerar(). Provedor que não tiver isto responde tudo de uma vez. */
  gerarFluxo?(pedido: PedidoDeGeracao, aoTrecho: (texto: string) => void): Promise<RespostaDoProvedor>;
};
