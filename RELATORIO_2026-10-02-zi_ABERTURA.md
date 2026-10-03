# Relatório 2026-10-02-zi — Abertura: a lâmpada do B7 acende

Versão `2026-10-02-zi` (commit `81c7bb7`). Só front-end (`index.html`, `js/app.js`, `styles/global.css`). **Nenhuma migration.**

## O que você pediu

"Melhorar 1000% a tela de carregamento… animações bombásticas… me surpreenda."

## Antes

- Símbolo pulsando no centro, um anel girando, luzes de fundo e uma barra.
- A marcação existia **duas vezes**: no `index.html` e numa cópia escrita à mão no `app.js`, usada entre o login e a montagem do sistema.
- A saída era um fade de 0,6 s.

## A sequência nova (≈1,1 s, depois um laço calmo)

1. **0–0,8 s:** doze faíscas magenta e violeta voam de longe e somem dentro da lâmpada, como os pontos do símbolo da marca se juntando.
2. **0,35–1,0 s:** "Branding7" se monta letra a letra (sobe, gira de leve e sai do desfoque), com as últimas letras puxando para o magenta.
3. **0,55–1,0 s:** a lâmpada "acende":
   - começa apagada e desfocada;
   - tremula duas vezes como filamento;
   - explode em brilho e assenta.
4. **0,85 s:** duas ondas de choque (magenta e violeta) saem do centro.
5. **Depois, em laço:**
   - raios de luz girando devagar atrás da lâmpada;
   - anel externo girando;
   - anel interno tracejado ao contrário;
   - um **cometa com rastro** em órbita;
   - halo respirando e partículas subindo.
6. **Frases que se revezam** enquanto carrega: "Preparando o seu espaço…", "Acendendo as ideias…", "Organizando a produção…", "Quase lá…". Só com o texto padrão; "Entrando…" e outros textos específicos ficam parados.

## Saída: "portal"

Quando o sistema fica pronto:

- a lâmpada estoura em luz;
- um círculo se abre a partir dela e revela o sistema por baixo, com a borda suave;
- duração: 0,12 s de flash + 0,72 s de portal.

Como funciona: máscara radial com raio animado (`@property`). Navegador sem esse suporte faz um fade no fim, e a tela nunca fica presa.

## Tempo de arranque

- A sequência leva cerca de 1,1 s.
- **Só no primeiro arranque**, se o sistema ficar pronto antes disso, a saída espera o restante até 1,1 s desde o início da página.
- Carga mais lenta que isso (o caso comum) não espera nada a mais.
- A cortina entre o login e a montagem não tem espera mínima.

## Organização

- A marcação existe **uma vez**, no `index.html`. O `app.js` guarda uma cópia dela para remontar a cortina, em vez de manter uma versão escrita à mão.
- Tudo anima em `transform` e `opacity`, exceto o brilho da lâmpada (`filter`, num elemento de 62×72 px) e o portal (máscara, por 0,7 s).

## Menos movimento

Com "reduzir movimento" no sistema operacional:

- não há faíscas, ondas, cometa nem raios;
- a tela fica parada;
- a saída é um fade de 0,2 s.

## Testes executados

**Página local com a marcação e o CSS reais (390×844):** quadros congelados em 0,45 s, 0,83 s e 1,08 s, e o portal na metade. Mostraram:

- faíscas convergindo;
- lâmpada acesa com raios;
- ondas e cometa;
- o portal revelando a página de baixo.

Defeito encontrado e corrigido nesse teste: a onda de choque aparecia parada no centro antes da hora.

**Site publicado (`zi`), com a sua sessão:**

- o `index.html` e o `app.js` servidos têm a marcação e o código novos;
- captura da abertura de verdade 0,6 s depois de recarregar;
- o Painel carregou em seguida;
- nenhum erro no console.

**Não testado:**

- aparelho físico (só emulação);
- iPhone/Safari antigo (o caminho sem `@property` só foi conferido no código);
- "reduzir movimento" ligado;
- a cortina entre login e montagem: a pessoa já estava logada.
