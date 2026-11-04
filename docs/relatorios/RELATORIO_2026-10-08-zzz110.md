# Relatório — Abertura em corte de cinema, trilha nova e som de notificação novo

**Versão:** `2026-10-08-zzz110` · **Cache:** `roteiros-b7-v315`
**Pedido:** abertura mais longa e muito mais cinematográfica, trilha sonora melhor, "algo premium"; e melhorar o som da notificação.

## Abertura — de 4,3 s para 6,4 s
O conceito continua o mesmo ("a ideia acende", a lâmpada da marca). A sequência ganhou começo e fim:

| Tempo | O que acontece |
|---|---|
| 0,0 – 1,5 s | **Prólogo (novo).** Escuro com um campo de estrelas que deriva devagar; um feixe largo cruza a tela; uma linha de luz se abre no horizonte e se recolhe no ponto onde nasce a centelha. |
| 1,5 – 3,4 s | Como antes: a centelha, a lâmpada saindo do escuro, a carga subindo, o filamento piscando. |
| 3,4 s | **Ignição, reforçada.** Além do clarão, do flare e das ondas: 16 faíscas voam para fora e aparecem reflexos de lente em diagonal. |
| 3,4 – 5,2 s | A lâmpada recua para o lugar no logo, "Branding7" se escreve, o brilho passa. |
| 5,4 – 6,4 s | **Cartão de título (novo).** Um fio de luz se desenha sob o logo e "SISTEMA B7" entra com as letras se aproximando. |

- **Sem tarjas de cinema**: foram retiradas a seu pedido lá atrás e não voltaram.
- A **versão curta** (recarregar a página, passar do login para o sistema) não mudou.
- Quem pede menos movimento no aparelho continua sem animação.
- A frase "Preparando o seu espaço…" agora só aparece aos 7 s, e mais abaixo, para não bater no cartão de título.

## Trilha sonora — refeita
Continua 100% gerada na hora, sem arquivo de áudio e sem música de terceiros. Deixou de ser uma fila de efeitos e virou uma peça curta, com começo, clímax e assinatura:
- **Prólogo:** um golpe grave e distante, uma nota grave contínua que cresce, e ar passando.
- **A pergunta:** duas notas de sino subindo.
- **Tensão:** zumbido que se abre, subida de ar e duas batidas de coração antes da ignição.
- **Ignição:** o impacto de antes, agora com um corpo de metais graves ("braam" de trailer) por baixo.
- **Depois:** o acorde que sustenta o logo e um arpejo de sinos subindo.
- **Assinatura:** as duas notas do prólogo respondidas uma oitava acima, fechando com uma nota grave — no instante do cartão de título.
- Reverberação mais longa, para dar tamanho de sala.

## Som de notificação — novo
O antigo eram dois bipes secos. Agora são duas notas de "vidro" subindo, com um brilho curto no ataque e um eco baixo e abafado — soa como chegada, não como alarme.

## Arquivos alterados
`index.html`, `styles/abertura.css`, `js/abertura-som.js`, `js/app.js`, `js/notificacoes.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- **Tempos:** li de cada peça o instante em que ela começa; todos batem com o roteiro acima (ignição em 3,4 s, palavra em 4,78 s, título em 5,4–5,5 s).
- **Quadros:** parei a sequência em três instantes e conferi as capturas — prólogo (1,0 s: estrelas e a linha de luz), ignição (3,56 s: lâmpada acesa, raios, flare, reflexos de lente) e final (6,3 s: logo completo com "SISTEMA B7" e o fio). A primeira versão das estrelas saiu em grade visível; refiz e conferi de novo.
- **Trilha:** renderizei a trilha inteira sem alto-falante e medi o volume a cada meio segundo. O pico é na ignição (0,82 de 1,0, sem estourar); o prólogo, as batidas e a assinatura ficam em torno de 0,45–0,5; termina em silêncio por volta de 8 s. A versão curta não mudou de volume.

## Não testado — e é o principal
- **Ninguém ouviu.** Medi volume e sincronia, mas não escutei a trilha nem o som de notificação. Se a música é bonita, só o seu ouvido diz.
- **A sequência rodando de verdade.** O navegador de teste não roda animação; vi três quadros parados, não o movimento.
- Celular (desempenho do campo de estrelas e das faíscas em aparelho fraco) e tema claro na saída.

**Para ver:** Configurações → Aparência → "Ver abertura". O toque no botão garante o som.
