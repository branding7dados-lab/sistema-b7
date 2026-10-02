# Relatório 2026-10-02-t — Teleprompter B7

Só front-end. **Nenhuma migration, nenhuma tabela nova, RLS intocado.** Publicado (versão `2026-10-02-t`, cache `v147`).

> **Não testado em celular de verdade nem em teleprompter físico.** Tudo abaixo foi testado em navegador, com emulação de tela de celular. Tela cheia, tela sempre ligada e a suavidade da rolagem não puderam ser verificadas neste ambiente (detalhes em "Testes" e "Limitações").

## Resumo

- Teleprompter nativo do B7, que lê o **roteiro canônico**: nada é copiado, colado ou duplicado.
- Dois modos: **Contínuo** (rolagem tradicional) e **Por cenas** (uma cena por vez, para gravar em takes).
- **Paisagem obrigatória no celular**: em pé, aparece "Gire o celular para continuar".
- **Espelhar** inverte só a área de leitura, para o vidro do teleprompter; os controles não invertem.
- Contagem regressiva, tamanho do texto, velocidade, espaçamento, largura, tela cheia, tela sempre ligada, atalhos de teclado.
- Aberto pelo **editor de roteiros** e pela **gravação**; na gravação, percorre os roteiros da lista em sequência.

## Auditoria inicial

- **Roteiros:** tabela `roteiros` (título, observação de gravação, nota interna, posição) e `cenas` (posição, tipo, `direcao`, `texto`, `sugestao_cenas`). Tipos de cena: Gancho, Narrativa, Narração, CTA. O campo `funcao` existe mas está vazio nas 450 cenas.
- **O que é fala e o que é orientação:** `texto` é a fala; `direcao` é a orientação ("DIRETO PRA CÂMERA", "VOZ EM OFF"…); `sugestao_cenas` são imagens sugeridas (26 cenas usam). Fala média de 115 caracteres, máxima de 370; média de 6 cenas por roteiro, máximo de 13.
- **Gravações:** a lista "O que vamos gravar" (`gravacao_itens`) já tem o check **gravado** por item, com função própria no banco (`gravacao_item_marcar`). Um item de roteiro pode apontar para roteiro escrito em outra gravação.
- **Permissões:** `roteiros` e `cenas` só são lidas pela equipe interna (RLS). Cliente não lê.
- **Já existia:** "Apresentar roteiros" (mostra a folha do roteiro para o cliente) e pedidos de tela cheia em outras telas. Não existia nada de tela sempre ligada nem de orientação.
- **Atualização automática:** o B7 recarrega sozinho quando sai versão nova, a menos que algo esteja "ocupando" a tela.

## Arquitetura

- Um módulo, `js/teleprompter.js`, em seis seções: conteúdo, preferências, aparelho, rolagem, sessão e telas, entradas. Estilos em `styles/teleprompter.css`.
- **Não é rota nem item de menu**: é uma camada por cima da tela atual, como a apresentação de roteiros. Não existe endereço público nem link com conteúdo do roteiro.
- **Conteúdo:** uma função converte roteiro + cenas no que o teleprompter mostra. Só `texto` vai para a área de leitura; `direcao`, imagens sugeridas e observação de gravação aparecem só na preparação.
- **Pelo editor:** usa o que está na tela do editor naquele momento, inclusive o que ainda está sendo salvo.
- **Pela gravação:** lê do banco, com a sessão da pessoa, os roteiros da lista e as cenas deles (uma consulta nova de leitura, `roteirosPorIds`).
- O conteúdo fica em memória durante a sessão. Depois de aberto, play, pausa, cenas, espelho e ajustes não fazem nenhuma chamada de rede.
- O teleprompter aberto conta como "tela ocupada": a atualização automática não recarrega o B7 no meio de uma gravação.

## Modo Contínuo

- Texto de todas as cenas com fala, na ordem do roteiro. Cena sem fala não entra.
- Controles: tocar/pausar, voltar ao início, cena anterior/próxima, velocidade, A−/A+.
- **Faixa de leitura:** o que já passou e o que ainda vem ficam mais apagados; duas marcas discretas nas laterais indicam a linha de leitura.
- **Rolagem:** posição em pixels movida por `transform`, no ritmo de `requestAnimationFrame`, sem reflow. A velocidade é em linhas por segundo, então mudar o tamanho da letra não muda o ritmo de leitura. Mudar a velocidade não reinicia; pausar para no ponto exato; mudar a letra mantém o ponto de leitura.
- No fim do roteiro, abre a tela "Fim do roteiro".

## Modo por Cenas

- **Preparar:** "CENA 3 DE 7", tipo da cena, orientação, imagens sugeridas, a fala em tamanho normal e, na primeira cena, a observação de gravação do roteiro. Botões: Anterior, **Apresentar cena**, Pular. Esta tela é para o videomaker e nunca espelha.
- **Apresentar:** só a fala, grande. Controles: Anterior, **Repetir**, Próxima cena (na última, "Finalizar roteiro").
- **Cena longa:** se não cabe na tela, rola com a mesma rolagem do contínuo; a letra não é reduzida. Se cabe, fica parada no centro.
- **Repetir** recomeça a cena atual (com a contagem, se estiver ligada) sem mudar de cena.
- **Cena sem fala:** aparece na preparação com a orientação e o aviso "Cena sem fala escrita"; o botão vira "Próxima cena".
- Ajuste "Preparar antes de cada cena" (ligado por padrão): desligado, "Próxima cena" já mostra a fala seguinte.

## Modo Paisagem

- No celular em pé, o teleprompter mostra o aviso de girar e não deixa usar. Ao deitar, a sessão aparece.
- Se o celular for colocado em pé no meio de uma cena, a leitura **pausa** e o aviso volta; ao deitar de novo, continua na mesma cena e no mesmo ponto, com o espelho como estava.
- "Celular" é detectado por toque como entrada principal e lado menor da tela abaixo de 600 px. Computador e tablet não recebem o aviso.
- **Limite do navegador, dito com clareza:** o B7 não consegue forçar a tela a girar em todo aparelho. Em tela cheia ele pede ao navegador para travar em paisagem; isso funciona em parte dos Android e não funciona no iPhone. Por isso a exigência é feita pelo aviso, que não depende dessa trava.

## Espelhamento

- Botão **Espelhar** no topo (e nos ajustes). Aplica inversão horizontal só na área de leitura: fala, faixa de leitura e contagem regressiva.
- Topo, controles, preparação e ajustes não invertem.
- Vale nos dois modos e fica salvo no aparelho.

## Tela Cheia

- "Iniciar" pede tela cheia; o botão do topo liga e desliga.
- Sem suporte ou sem permissão, o teleprompter já cobre a tela inteira do B7 (menu, barra lateral e navegação ficam por baixo e inalcançáveis), então funciona igual.

## Tela Sempre Ligada

- Usa a API de Wake Lock do navegador enquanto o teleprompter está aberto; pede de novo quando a aba volta a ficar visível; solta ao sair.
- Sem suporte, nada quebra: só não impede a tela de apagar.

## Integração com Gravações

- Botão **Teleprompter** no cabeçalho de "O que vamos gravar", só quando a lista tem roteiro.
- Carrega os roteiros da lista, na ordem dela, e começa no primeiro que ainda não foi gravado.
- A tela de início mostra "Roteiro 2 de 6" e a lista de roteiros (com os já gravados marcados); dá para escolher outro.
- **Fim do roteiro:** Repetir roteiro, Próximo roteiro, Ver roteiros, e **Marcar como gravado**.
- "Marcar como gravado" usa o **mesmo check da lista da gravação** (a mesma função do banco), só quando a pessoa clica e só para quem já podia marcar na lista. Nada é marcado sozinho, e nenhum outro status é tocado pelo teleprompter.
- Pelo editor de roteiros não há "Marcar como gravado": lá o teleprompter é só leitura.

## Preferências

Guardadas **neste aparelho** (armazenamento local do navegador, onde o B7 já guarda preferências de tela): modo, tamanho do texto, velocidade, espaçamento, largura, espelho, contagem e "preparar antes de cada cena". Nada vai para o banco.

## Segurança e Permissões

- Nenhuma rota, função ou endereço novo expõe roteiro. A leitura é feita com a sessão da pessoa e o RLS que já existia.
- Nenhuma policy foi criada ou alterada.
- A única escrita possível é o check "gravado", pelo caminho que já existia.

## Banco de Dados

**Nenhuma migration foi necessária.** Nenhuma tabela, coluna, função ou policy nova.

## Arquivos

- Criados: `js/teleprompter.js`, `styles/teleprompter.css`.
- Alterados: `js/editor.js` (item "Abrir Teleprompter" no menu ⋯ do roteiro), `js/gravacao.js` (botão e o repasse do check), `js/database.js` (`roteirosPorIds`), `js/app.js` (teleprompter aberto segura a atualização automática), `index.html`, `sw.js`, `styles/gravacao.css`, `js/auth.js` (versão).

## Testes Executados

**Automatizados:** nenhum (o projeto não tem suíte de testes).

**Navegador, página local com roteiros simulados** (emulação de 844×390, 740×360, 360×740 e 1400×800):

- Início: título, "Roteiro 1 de 3", lista de roteiros, modo, ajustes; "Iniciar" visível sem rolar em 844×390.
- Por cenas: preparação com tipo, observação de gravação, orientação e fala; apresentação com **só a fala** no palco; Próxima/Anterior; cena longa com rolagem; Repetir volta ao início da mesma cena; cena sem fala; "Finalizar roteiro" na última.
- Contínuo: cenas na ordem certa mesmo com os dados fora de ordem; orientação, imagens sugeridas e observação **ausentes** do texto; contagem de 3 s esconde o texto e depois inicia; velocidade muda sem reiniciar; pausa mantém a posição; retomar continua do ponto; saltos de cena; voltar ao início.
- Tamanho do texto: muda mantendo o ponto de leitura (mesma proporção antes e depois).
- Espelho: área de leitura invertida, topo e controles não; salvo no aparelho; conferido nos dois modos.
- Giro (emulação de celular): em pé → aviso; deitado → sessão; em pé no meio de uma cena → pausa e aviso; deitado de novo → mesma cena, mesmo ponto, espelho ligado.
- Gravação: começa no primeiro roteiro não gravado; fim do roteiro; "Marcar como gravado" chama o check uma vez, para o item certo; próximo roteiro; roteiro sem fala bloqueia "Iniciar" com explicação.
- Estados vazios: gravação sem roteiro, lista vazia e falha de rede mostram mensagem e "Voltar".
- Teclado: Espaço, setas, R, M, +, −, Esc.
- Sair: pelo botão e pelo "voltar" do navegador; a página de trás volta a responder.
- Botões cabem em uma linha em 740×360; menor alvo de toque com 44 px.

**Site publicado, sessão real, somente leitura:**

- Gravação "Gravações de Outubro" (Mais Sorrisos): o botão aparece, abre com os 6 roteiros reais; cena 1 mostra tipo e orientação; a fala no palco é idêntica à do roteiro e a orientação não aparece nela.
- Editor de roteiros: "Abrir Teleprompter" no menu abre com os 6 roteiros.
- Sem erro no console. Não cliquei em "Marcar como gravado".

**Aparelho físico:** nenhum. Não testei em celular Android, iPhone, PWA instalado nem em teleprompter com vidro.

## Regressões Verificadas

- Editor de roteiros e página da gravação abrem e funcionam com o item novo; sintaxe de todos os arquivos alterados conferida.
- IA de roteiros, autosave, checklist e demais telas não foram alterados. Não refiz testes completos dessas áreas.

## Limitações

- **Suavidade da rolagem não foi vista.** O navegador de teste roda em segundo plano e não desenha animações; conferi a matemática da rolagem passo a passo, não o movimento na tela.
- **Tela cheia e tela sempre ligada não foram verificadas**, pelo mesmo motivo. O código trata a falta delas, mas o comportamento real precisa de um aparelho.
- **iPhone:** o Safari não oferece tela cheia para páginas nem trava de orientação. Lá o teleprompter funciona sem essas duas coisas.
- **Roteiro editado durante a leitura:** o teleprompter usa o texto do momento em que foi aberto e não muda no meio. Para pegar uma edição feita depois, é fechar e abrir de novo. Não há aviso de "roteiro atualizado".
- **Sem internet:** depois de aberto, o teleprompter não precisa de rede. Abrir exige conexão; não há acesso offline ao conteúdo.
- O espelho inverte na horizontal. Não há inversão vertical.

## Próxima Fase

Possibilidade futura, **não implementada**: controle remoto por um segundo aparelho, pareado por QR code, para tocar, pausar, repetir e trocar de cena sem tocar no celular que está no teleprompter.
