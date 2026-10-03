# Relatório — pacote zl/zm/zn · Abertura cinematográfica, motion e vidro no celular

Data: 03/10/2026 · Versões publicadas: `zl` (daebd18), `zm` (7609ec3) e `zn` (correção + este relatório)

## Conceito visual

**"A ideia acende."** O símbolo do B7 é uma lâmpada feita de ideias (os pontos), então a abertura conta exatamente isso. Ela usa a marca real, sem redesenhar nada:
- o "Branding7" é o próprio `logo-white.png`, recortado;
- o símbolo é o `symbol-color.png`, que tem a mesma proporção, encaixado no lugar dele;
- medi a geometria dos arquivos: logo de 900×354, símbolo de 0 a 297 px e palavra a partir de 337 px. Nada fica esticado nem distorcido.

Troquei a abertura anterior (zi), que juntava muitos efeitos ao mesmo tempo (faíscas, raios de 1500 px girando, anel girando, cometa, partículas, letra por letra), por **uma sequência com começo, meio e fim**. E ela continua dentro do app: o logo termina onde ele mora na interface.

## Abertura do B7

**Completa** (primeira vez na sessão do navegador):

| Tempo | O que acontece |
|---|---|
| 0–1,4 s | Céu escuro com profundidade. A luz de horizonte nasce embaixo e um feixe diagonal cruza a tela uma vez. Grão muito leve, parado. |
| 0,1–0,95 s | O símbolo sai do escuro e do desfoque, grande, no centro. |
| 0,45–1,15 s | A "carga": uma faixa de luz sobe por dentro da lâmpada, recortada no desenho dela. |
| 0,95–1,25 s | Pico: a lâmpada acende, com brilho, bloom atrás e uma onda de luz. |
| 1,25–1,9 s | O símbolo recua até o lugar dele no logo. |
| 1,56–2,12 s | "Branding7" se revela da esquerda para a direita. |
| a partir de 2,05 s | Sai assim que o sistema estiver pronto. |
| a partir de 2,5 s | Só se ainda estiver carregando: aparecem uma frase verdadeira ("Preparando o seu espaço…") e um fio de luz. |

**Saída (~0,65 s):** o logo **voa até o destino real**, com posição e tamanho medidos na hora:
- logo inteiro → caixa de login ou barra lateral aberta;
- só o símbolo → barra lateral recolhida ou topo do celular (aí a palavra recua e some no caminho);
- se o destino é branco, a lâmpada colorida vira a branca durante o voo.

Ao mesmo tempo o céu se dissolve e o sistema assenta por baixo, nesta ordem: barra lateral → topo → conteúdo → barra de baixo. O que segura o logo de destino entra só com opacidade, para o pouso cair no lugar exato.

**Curta** (recarregar ou atualização automática na mesma sessão, e o instante entre o login e o sistema): o logo já montado entra em 0,35 s e sai com o mesmo voo.

**Navegação interna:** a abertura nunca aparece.

## Integração com carregamento real

- A abertura **não atrasa nada**. O fechamento continua sendo chamado pelo arranque real:
  - fluxo de sessão: a sessão é conferida e o sistema é montado;
  - login: a tela de acesso fica pronta.
- O mínimo só vale na abertura completa: 2,05 s contados do início da página. Na curta, 0,35 s. Com "reduzir movimento", nenhum.
- Se o sistema demorar mais, a abertura espera, e a espera honesta aparece. Não há porcentagem nem frases revezando (a versão anterior revezava frases).
- A rede de segurança de 12 s continua.
- Novo: marcas de performance `b7:pronto` e `b7:abertura-sai`, para medir de verdade (DevTools → Performance).

**Medições reais em produção** (sessão do admin, aba no painel do app):

| Cenário | Pronto | Abertura começou a sair |
|---|---|---|
| Cache apagado | 8,86 s | 8,86 s |
| Cache quente, abertura completa | 2,91 s | 2,91 s |
| Recarregar, abertura curta | 2,76 s | 2,76 s |

Nos três casos o sistema ficou pronto depois do mínimo, então **a abertura acrescentou 0 ms de espera**. Observação: depois do DOMContentLoaded (~0,4–0,6 s), a conferência de sessão e a montagem levam ~2,3 s. Isso é do arranque, não da animação, e não mexi nessa parte.

## Motion system

- **Novos tokens:** `--m-pagina` 280 ms, `--m-grande` 380 ms e a curva `--m-volta`. Somam-se aos do pacote anterior: 110/170/240/300 ms com curvas de entrada e saída.
- **Troca de tela com direção:** o roteador marca `<html data-nav>`.
  - **frente:** entrar mais fundo no mesmo assunto, como Clientes → cliente → linha ou Vídeo → demanda. A tela chega um pouco "mais perto" e assenta.
  - **volta:** voltar ao endereço anterior ou subir de nível. A tela resolve de trás.
  - **lado:** trocar de módulo. Só um esmaecer curto.
  - Tudo em 280 ms, só com transform e opacidade.
- **Modal no desktop:** entra de mais perto (escala 0,965 → 1) e sai para longe. O sistema por trás recua levemente (0,992).
- **Menus e popovers:** nascem do gatilho (escala + origem). O menu da conta ganhou vidro.
- **Seções do cliente:** o sublinhado **desliza** da aba anterior para a nova.
- **Toast de sucesso:** sobe com um leve assentamento. O de erro continua seco.

## Mobile

- **Barra inferior:** virou uma **ilha de vidro flutuante**, com 10 px de margem e respeitando a área segura. Tem filete de luz, sombra em camadas e desfoque com saturação; o conteúdo rola por baixo dela até o fim.
- **Item ativo:** uma **pílula de luz desliza** entre os itens. O ícone fica um pouco maior e mais grosso, o rótulo mais forte, e o toque encolhe o ícone na hora. O fio antigo de cima saiu.
- **Topo:** vidro translúcido que **fica mais denso e ganha filete quando o conteúdo passa por baixo** (um ouvinte passivo + rAF).
- **Folhas:** cantos de 24 px, alça nova, véu um pouco mais fundo e rolagem contida. Com folha ou modal aberto, **o app recua para o fundo** (escala 0,965 com cantos arredondados).
- **Toque:** resposta em cards, listas do cliente e na grade do "Mais".
- **Toasts:** sobem acima da ilha.

## Glass / Blur

- **Usado em:** barra inferior, topo do celular, folhas, menus suspensos, menu da conta e toasts (esses três últimos já tinham vidro do pacote anterior).
- **Evitado de propósito:** cards, listas, tabelas e conteúdo. Continuam sólidos para leitura.
- **Sem suporte a `backdrop-filter`:** as superfícies ficam quase opacas e continuam legíveis.

## Performance

- **Removido da abertura:**
  - um disco de 1500 px com gradiente cônico girando sem parar;
  - seis partículas em laço infinito;
  - anel e cometa girando sem parar;
  - 12 faíscas;
  - 9 letras animadas com blur.
- **Na abertura nova:** filtro só em elementos pequenos (símbolo de ~130 px e palavra) e só durante a sequência. O único laço infinito é o fio da espera, que só aparece se o carregamento demorar.
- Desfoque de fundo **parado**: nada anima blur em tela cheia. A profundidade atrás do modal é só transform.
- Voo e reveal só com transform e opacidade, via Web Animations.
- **Não medi FPS** nem fiz teste em aparelho; o painel do app ficou oculto em parte dos testes.

## Acessibilidade

- **Com "reduzir movimento":**
  - abertura sem animação, logo parado e espera visível;
  - saída num esmaecer de 0,2 s, sem voo e sem mínimo;
  - trocas de tela, profundidade, pílula, indicador e menus sem movimento.
- A abertura continua com `role="status"`.
- Foco visível preservado na barra inferior.
- Contraste do vidro: fundo de 70–80% de opacidade atrás do texto.

## Arquivos alterados

- `index.html`: marcação da abertura e escolha da versão curta antes da pintura.
- `styles/global.css`: bloco ABERTURA reescrito e bloco "MOTION & VIDRO — camada 2".
- `js/app.js`: tempo mínimo, voo do logo, reveal, direção da navegação e marcas de performance.
- `js/nav.js`: pílula deslizante e topo sensível à rolagem.
- `js/dashboard.js`: indicador das seções e correção da rolagem.
- `sw.js` e `js/auth.js`: versão.

## Banco de dados

Nenhuma mudança.

## Testes executados

**Local (navegador do app, quadros congelados com dados de teste):**
- quadros da abertura em 0,3 / 0,72 / 1,12 / 1,56 / 2,05 s;
- voo até o login: no meio do voo e no pouso exato sobre o logo do login;
- voo até a barra lateral no desktop (meio e pouso);
- voo até o símbolo do topo no celular (390 px);
- ilha de vidro com o conteúdo rolando por baixo;
- pílula indo de "Central" para "Clientes" (posição conferida);
- folha aberta com o app recuando (escala 0,965 medida);
- direção da navegação (`data-nav`).

**Produção (sua sessão, só leitura):**
- deploy confirmado;
- abertura completa e curta com as medições acima (`ab-curta` e sessão conferidas);
- sistema abriu normalmente depois da abertura;
- hub do cliente no celular com ilha, pílula em "Mais", topo de vidro e indicador sob "Design";
- modal de teste sem dados abrindo e fechando.

**Não testado:**
- aparelho físico (Android ou iPhone) e PWA instalado;
- "reduzir movimento" de verdade (só revisão do código);
- Teleprompter em uso;
- tema claro em produção.

## Regressões verificadas

- Login aparece e o logo pousa nele.
- Shell da equipe, Painel e hub do cliente (Design de Sabor da Feira, Vídeos de AutoEscola) abrem normalmente.
- Atualização automática recarrega e mostra a versão curta.
- Teleprompter: ele é montado direto no `body`, fora do `#app`, e não usa `.conteudo.entra` nem modal; a profundidade não o atinge. Isso foi conferido no código, não em uso.

## Bugs corrigidos

- **Do pacote zj:** no celular, centralizar a aba ativa do cliente rolava a página e escondia o cabeçalho. Agora só a faixa de abas rola (zn).
- **Conflito de CSS:** o `nav.css` carrega depois e anulava a nova barra flutuante. Resolvido com especificidade, sem `!important`.

## Limitações

- Navegador sem `@supports(:has)`: não há recuo do app atrás do modal (o resto funciona).
- Navegador sem Web Animations: não há voo, e a abertura só esmaece.
- Aba aberta em segundo plano: o navegador pausa as animações e a abertura sai pelo cronômetro, sem voo visível.
- O tempo total percebido depende do arranque real (~2,3 s depois do HTML nesta máquina). A abertura cobre esse tempo, não o cria.
- iOS/Android podem mostrar a tela de início do PWA (fundo `#0B0A1E`, a mesma cor da abertura) antes do primeiro quadro. Não controlamos esse instante.

## Resultado final

Antes, a abertura era uma lâmpada com muitos efeitos girando em volta, e o sistema aparecia num corte. Agora a abertura é uma sequência só, com a marca real, que termina **dentro** da interface: o logo pousa onde ele mora e o app assenta por baixo. Ela aparece completa uma vez por sessão e curta depois. No dia a dia as telas têm direção, os modais dão profundidade, e o celular ganhou barra flutuante de vidro com luz deslizante e topo que reage à rolagem.

---

## Atualização zo — versão cinema (pedido do Kevin depois de ver no celular)

O vídeo da tela do celular (PWA) mostrou três coisas:
- a lâmpada estava pequena;
- na primeira abertura o sistema ficou pronto enquanto o "Branding7" ainda se escrevia, e a saída cortou a palavra;
- o voo e a íris passavam rápido demais para serem vistos.

A sequência completa ficou **mais longa (~4,3 s + 0,8 s de saída)** e mais dramática, mantendo o mesmo conceito:

| Tempo | O que acontece |
|---|---|
| 0–0,9 s | Escuro. Uma **centelha** nasce no centro e respira; **poeira de luz** sobe em volta. |
| 0,25–1,6 s | A lâmpada surge do desfoque, **bem maior**: ~2,15× o tamanho dela no logo, cerca de metade da largura do celular. |
| 0,9–1,9 s | A luz sobe por dentro da lâmpada; o **filamento pisca duas vezes**. |
| 1,9 s | **Ignição:** clarão na tela, **flare horizontal de lente de cinema**, bloom, duas ondas de luz, **raios girando devagar** e um "soco" de escala no palco. |
| 2,7–3,65 s | A lâmpada recua para o lugar dela no logo. |
| 3,28–3,9 s | "Branding7" se escreve, sem colidir com a lâmpada. |
| 3,7–4,3 s | Um **brilho rosa/violeta passa por cima do logo inteiro**. |

- **Saída:** uma **íris** se abre do centro e revela o sistema, enquanto o logo voa até o lugar dele (agora em 0,82 s).
- **Mínimo:** a versão completa segura **4,3 s**, de propósito, para dar tempo de ver. Ela continua aparecendo **só uma vez por sessão do navegador**. Recarregar mostra a curta (0,35 s), e a navegação interna nunca mostra.
- **Desempenho:** os efeitos novos são todos transform/opacidade. Os raios giram por transform e somem quando o logo assenta.
- **Testes:** quadros congelados no navegador do app em 390 px (0,5 / 1,4 / 2,02 / 3,25 / 3,5 / 3,96 s) e saída com íris conferida localmente. **Não testado em aparelho:** vale abrir no celular de novo.

---

## Atualização zp — trilha sonora e mais cinema

**Som (pedido explícito do Kevin; antes a abertura era muda de propósito):**
- Trilha de ~4,5 s **100% sintetizada no navegador (Web Audio)**: nenhum arquivo baixado e nenhuma música de terceiros.
- Sincronizada com o relógio da animação:

| Tempo | Som |
|---|---|
| 0,05 s | Zumbido grave de tensão |
| 0,9 s | Riser subindo junto com a luz |
| 1,62 / 1,76 s | Estalos elétricos do filamento |
| 1,9 s | Impacto da ignição: sub-grave, batida, estouro de ar e brilho harmônico em dó maior com reverberação longa |
| 3,28 s | Whoosh do "Branding7" |
| 3,7 s | Cintilar do brilho final |
| Saída | Whoosh + assentamento grave quando o logo voa |

- Compressor no mestre. **Ensaio offline medido:** pico de 0,86 (sem estourar); ignição ~0,52 contra o riser ~0,15–0,21. Baixei riser, zumbido e estalos para a ignição ter contraste.
- **Limitação honesta:** navegadores bloqueiam som sem um toque antes (política de autoplay). Na abertura de quando o app é aberto pode não haver som. Se bloquear:
  - a abertura segue muda e nada quebra;
  - o primeiro toque destrava o áudio (ex.: "Entrar" no login toca a saída).
- **Configurações → Aparência → Abertura:** "Com som / Sem som" e o botão **"Ver abertura"**, que repete a sequência completa com a trilha inteira (o toque no botão garante o som).
- Arquivo novo: `js/abertura-som.js` (com `B7.SomAbertura.ensaio()` para medir sem tocar).

**Mais cinema na imagem:**
- **tarjas de cinema** entram no começo e recolhem na saída;
- **travelling** lento de câmera (o logo se aproxima de 0,9× a 1× durante toda a sequência);
- **tremor de câmera** curto e **aberração cromática** (franjas vermelho/ciano) no instante da ignição;
- **bokeh**: luzes desfocadas ao fundo depois da ignição, feitas só com gradiente, sem filtro.

**Testes:** quadros congelados em 390 px (2,03 s com tarjas, cromática, raios e flare; 3,55 s com bokeh e logo montado); ensaio offline da trilha. Não testado em aparelho e não ouvido de verdade (não tenho alto-falante); a medição foi por picos de volume.

---

## Atualização zq

- **Tarjas de cinema removidas** (pedido do Kevin). Continuam: travelling, tremor, aberração cromática, bokeh e o som.
- **"Ver abertura"** agora também está no **menu da conta** (sua foto no topo), para todos os papéis, além de Configurações → Aparência. Repete a sequência completa com som.
