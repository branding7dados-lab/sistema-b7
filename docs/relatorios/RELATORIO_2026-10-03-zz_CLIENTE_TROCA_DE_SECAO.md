# Relatório — área do cliente sem "recarregar a página toda" (pacote zz, 03/10)

Pedido (vídeo de tela, Chrome Android, 30 s): "Melhora essas ui/ux… essas animações de transição entre páginas. Quando eu mudo de um lugar pro outro dentro da área do cliente, ele fica carregando a página toda… fica feio e chato".

## O que o vídeo mostrou
A cada aba (Visão geral → Editorial → Gravações → Roteiros → Vídeos → Design → Ideias → Inteligência):
- o painel inteiro era apagado, inclusive o cabeçalho do cliente e a faixa de abas;
- aparecia um esqueleto de página inteira;
- tudo era redesenhado e reanimado.

Parecia que o app recarregava a cada toque.

## O que mudou
`js/dashboard.js` (novas `prepararSecaoCliente`, `pintarSecaoCliente`, `esquecerSecoes`, `secaoVigente`), `js/conteudo.js` (Editorial, Ideias e Inteligência passam a usar as mesmas funções) e `styles/dashboard.css`.

- **Cabeçalho e abas ficam na tela.**
  - No toque, a aba nova acende e o sublinhado desliza até ela, antes de a busca terminar.
  - A faixa de abas rola até a aba escolhida.
- **Só o corpo troca.**
  - O conteúdo velho sai para o lado contrário (150 ms).
  - O novo chega do lado da aba, à direita se a aba está depois e à esquerda se está antes, com os blocos em leve cascata.
  - A altura é segurada durante a troca, para a página não pular.
- **Esqueleto só no corpo e só se demorar.** Se a busca terminar em menos de ~160 ms, nem aparece.
- **Seção já visitada aparece na hora.** Mesmo cliente, últimos 5 min:
  - a seção volta exatamente como estava;
  - a versão fresca substitui sem piscar quando chega;
  - nesse instante a lembrança não aceita toque, porque os botões ainda não estão ligados.
  - Editar o cliente apaga essa memória.
- **Toques rápidos em várias abas:** só a última pinta. Uma resposta velha não sobrescreve a aba atual, nem mostra erro.
- **Abas grudam no topo** ao rolar, no celular (logo abaixo do topo de vidro) e no computador, com fundo de ponta a ponta. Trocar de aba lá embaixo sobe suave até as abas.
- Se o cliente mudou (nome, logo, "atualizado há…"), o cabeçalho é trocado no lugar, sem animar.
- "Reduzir movimento": troca direta, sem deslizar.

Mesmas buscas e mesmos dados de antes; nada de regra, permissão, RLS ou banco.

## Testes executados
Navegador do app, sessão e banco simulados no console (cliente "AutoEscola Modelo", 3 gravações, 14 roteiros), latência simulada de 300–600 ms.

| Teste | Resultado |
|---|---|
| Visão geral → Roteiros: cabeçalho é o mesmo elemento | sim (antes e depois da troca) |
| 60 ms após o toque | aba "Roteiros" já marcada; corpo saindo (`cli-sai`); `--cli-dir` = 1 |
| 260 ms | esqueleto só dentro do corpo |
| Resposta chegou | corpo novo com `cli-chega`; conteúdo dos roteiros |
| Gravações e Editorial tocados em 30 ms | só Editorial pintou; aba e endereço certos; 1 corpo na tela |
| Voltar a Roteiros (visitada) | 40 ms: conteúdo lembrado já na tela (`cli-previa`); depois, versão fresca sem animação dupla |
| Clientes → cliente/Ideias (entrada direta) | tela inteira com cabeçalho, abas e corpo; aba "Ideias" marcada |
| Ideias → Inteligência (`js/conteudo.js`) | mesmo cabeçalho; classe `int-tela` aplicada; conteúdo da Inteligência |
| Abas grudadas | celular 390px: 56px (logo abaixo do topo); computador 1280px: no topo do painel |
| Cálculo de "subir até as abas" | alvo 97px coloca as abas em 56px (posição natural) |
| Rolagem horizontal | 390 / 1280 (sem vazamento) |
| Erros no console | nenhum |

**Não testado:**
- a rolagem suave até as abas (o painel oculto do navegador não anima rolagem; só conferi o alvo);
- animações em movimento real (conferidas pelas classes);
- celular físico;
- dados reais;
- Vídeos, Design e Arquivados com conteúdo.
