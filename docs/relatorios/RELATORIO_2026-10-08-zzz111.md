# Relatório — "Testar abertura", "Testar tela de carregamento" e leveza das animações

**Versão:** `2026-10-08-zzz111` · **Cache:** `roteiros-b7-v316`
**Pedido:** (1) acrescentar em Aparência uma opção para ver a tela de carregamento; (2) trocar "Ver abertura" por "Testar"; (3) as animações têm que ser fluidas, sem pesar no computador nem no celular.

## 1 e 2. Configurações → Aparência → Abertura
- "Ver abertura" virou **"Testar abertura"** (a sequência completa, com som).
- Nova linha: **"Testar tela de carregamento"**. Mostra a versão curta — a que aparece ao recarregar a página e entre o login e o sistema — por 3,2 segundos: o logo acende, o brilho passa e a frase "Preparando o seu espaço…" entra. Nada é recarregado de verdade.

## 3. Leveza
**O que eu tinha feito de pesado na zzz110 e corrigi:**
- O cartão de título animava o **espaçamento das letras**. Isso obriga o navegador a refazer o texto a cada quadro. Troquei por uma escala horizontal, que dá o mesmo efeito de "letras se aproximando" sem refazer nada.

**Regras que a abertura longa passou a seguir:**
- só posição, escala e transparência se movem;
- as camadas grandes (estrelas, feixes, raios, clarão) viram uma imagem pronta na placa de vídeo, em vez de serem redesenhadas;
- as faíscas e a linha do prólogo perderam o brilho em volta (sombra), que é caro de desenhar em movimento;
- **no celular:** metade das faíscas e sem os reflexos de lente;
- **no modo leve:** o corte longo sai inteiro (estrelas, feixe, linha, faíscas, reflexos) e fica a sequência base.

**O que continua usando efeito mais caro, de propósito:**
Duas animações da versão que você pediu para restaurar lá atrás — a lâmpada acendendo (brilho e desfoque) e a palavra "Branding7" se escrevendo (recorte e desfoque). São peças pequenas e não mexi nelas.

**Sobre as outras animações desta semana** (barra inferior, folha "Mais", "Sua conta", confirmações, menu do botão direito): conferi no código que todas movem só posição, escala e transparência. O painel do assistente em vidro usa desfoque de fundo, que é o efeito mais caro do conjunto; no modo leve e no celular ele já fica opaco.

## Arquivos alterados
`js/dashboard.js`, `js/app.js`, `styles/abertura.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- as duas linhas aparecem em Aparência com os nomes novos;
- "Testar tela de carregamento" abre a versão curta (sem as peças do corte longo), com a frase de espera, e sai sozinha;
- li as propriedades que a abertura longa anima: transparência, posição/escala, e os dois efeitos antigos citados acima. Nenhuma das peças novas anima algo além de posição, escala e transparência.

## Não testado — o que realmente importa aqui
- **Fluidez de verdade.** Não medi quadros por segundo: o navegador de teste não roda animação. As mudanças seguem as regras conhecidas do que pesa e do que não pesa, mas se ficou fluido no seu computador e no seu celular só dá para saber vendo.
- Aparelho fraco, tema claro, e a tela de carregamento vista em captura.
