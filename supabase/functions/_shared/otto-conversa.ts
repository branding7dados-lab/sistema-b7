/* 4.76.0 — QUANDO o Otto fala (funções puras, testáveis):
   • hora de parar: conversa que já rendeu (ele falou muito nos últimos minutos e a mensagem não pede nada) → só reação;
   • com outra IA (Gabriel): no máximo 2 trocas seguidas, e nada de responder "obrigado" / resposta automática;
   • participar sem ser chamado: bom dia, gratidão, comemoração e pergunta ao grupo que ele sabe responder — com limite;
   • áudio por ritmo: "1 a cada N respostas", com uma variação para não ficar mecânico. */

const semAcento = (v: string) => String(v || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** a mensagem pede alguma coisa (pergunta ou pedido)? */
export function temPedido(texto: string): boolean {
  const t = semAcento(texto);
  return /\?/.test(t) || /\b(me (manda|envia|passa|fala|diz|explica|ajuda|lembra)|manda|envia|faz|faca|cria|gera|escreve|lista|quais|qual|como|quando|onde|quanto|por ?que|chama|marca|print|edita|corrige|apaga|exclui|avisa|cobra|resume|resumo|pendenc|transcrev|lembra|anota|ajuda|preciso|consegue|pode)\b/.test(t);
}
const SO_SOCIAL = /^[\s\p{P}\p{Extended_Pictographic}\u{FE0F}]*(k{2,}|ha(ha)+|rs+|ok+|blz|beleza|valeu+|vlw|obrigad[oa]s?|brigad[oa]|top+|show( de bola)?|massa|boa+|perfeito|fechou|tmj|demais|isso( ai)?|entendi|ta bom|certo|uhum|sim|nao|verdade|pois e|ne|aham|oxe|eita|vish|nossa|caramba|serio)[\s\p{P}\p{Extended_Pictographic}\u{FE0F}]*$/u;
export const ehSoSocial = (texto: string) => SO_SOCIAL.test(semAcento(texto).trim());

/* ------------------------------------------------------------ hora de parar */
/** chamaram o Otto: responde, ou já deu (só reação)? */
export function jaDeu(o: { texto: string; ottoRecentes: number }): boolean {
  if (temPedido(o.texto)) return false;                  // pergunta/pedido: sempre responde
  if (ehSoSocial(o.texto)) return true;                  // "kkk", "valeu", "show": reação basta
  return o.ottoRecentes >= 3 && semAcento(o.texto).replace(/\s+/g, ' ').trim().length < 80;   // já falou 3+ vezes em 10 min e é papo curto
}

/* ------------------------------------------------------------ outra IA (Gabriel) */
export function jeitoComBot(o: { texto: string; trocas15min: number; minDesdeUltima: number }): 'responder' | 'reagir' | 'nada' {
  const t = semAcento(o.texto);
  if (ehSoSocial(o.texto) || /^(obrigad|valeu|de nada|por nada|disponha|imagina|tamo junto|conte comigo|fico feliz)/.test(t.trim())) return o.minDesdeUltima < 15 ? 'nada' : 'reagir';
  if (o.trocas15min >= 2) return temPedido(o.texto) && o.trocas15min < 4 ? 'responder' : 'reagir';   // já trocaram 2: só segue se ela pediu algo de verdade
  return 'responder';
}

/* ------------------------------------------------------------ participar sem ser chamado */
export type Assunto = 'saudacao' | 'gratidao' | 'comemoracao' | 'pergunta' | 'nada';
export function assuntoDoGrupo(texto: string): Assunto {
  const t = semAcento(texto).trim();
  if (t.length < 4 || t.length > 600) return 'nada';
  if (/^(bom dia|boa tarde|boa noite|bom fim de semana|bom final de semana|boa semana|otima semana|bom descanso|feliz (segunda|terca|quarta|quinta|sexta|sabado|domingo))\b/.test(t)) return 'saudacao';
  if (/\b(gratidao|grat[ao] (a|por)|agradec\w*|obrigad[oa] (a todos|galera|pessoal|equipe|time))\b/.test(t)) return 'gratidao';
  if (/\b(parabens|aniversari\w*|fechamos|fechou (o|a|com)|bateu a meta|batemos|conseguimos|aprovad[oa] pelo cliente|cliente aprovou|novo cliente|contrato assinado|deu certo|arrasou|arrasamos|mandou bem|mandaram bem)\b/.test(t)) return 'comemoracao';
  if (/\?/.test(t) && /\b(alguem|quem|cade|onde|qual|quais|quando|que horas|sabe|sabem|tem como|ja (foi|saiu|entregou|gravou)|ta pronto|esta pronto|o video|a arte|a gravacao|o prazo|a demanda|o cliente)\b/.test(t)) return 'pergunta';
  return 'nada';
}
export type Nivel = 'nunca' | 'pouco' | 'normal';
/** pode entrar na conversa agora? (limites: por hora, não emendar, uma saudação por turno do dia) */
export function podeParticipar(o: { nivel: Nivel | string | undefined; assunto: Assunto; daEquipe: boolean; fds: boolean; minDesdeOtto: number; participacoesHora: number; jaSaudouNoTurno: boolean; sorteio: number }): boolean {
  const n = o.nivel === 'normal' ? 'normal' : o.nivel === 'pouco' ? 'pouco' : 'nunca';
  if (n === 'nunca' || o.assunto === 'nada' || !o.daEquipe || o.fds) return false;
  if (o.participacoesHora >= (n === 'normal' ? 3 : 1)) return false;
  if (o.minDesdeOtto < (n === 'normal' ? 5 : 15)) return false;   // não emenda: deixa o pessoal conversar
  if (o.assunto === 'saudacao') return !o.jaSaudouNoTurno;           // um "bom dia" por turno, não para cada pessoa
  if (o.assunto === 'pergunta') return true;                         // (só responde se souber; e se ninguém respondeu antes)
  return o.sorteio < (n === 'normal' ? 0.7 : 0.4);                   // gratidão / comemoração: nem sempre
}
export const turnoDoDia = (agora = new Date()) => { const h = new Date(agora.getTime() - 3 * 3600000).getUTCHours(); return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'; };

/* ------------------------------------------------------------ áudio por ritmo */
/** "1 a cada N respostas": depois de N-1 textos (±1, para não ficar mecânico), a próxima resposta que der vira áudio */
export function vezDoAudio(o: { cada: number; textosDesdeAudio: number; sorteio: number }): boolean {
  const n = Math.max(0, Math.round(Number(o.cada) || 0));
  if (n < 2) return false;
  const variacao = n >= 3 ? (o.sorteio < 0.25 ? -1 : o.sorteio > 0.75 ? 1 : 0) : 0;
  return o.textosDesdeAudio >= Math.max(1, n - 1 + variacao);
}
