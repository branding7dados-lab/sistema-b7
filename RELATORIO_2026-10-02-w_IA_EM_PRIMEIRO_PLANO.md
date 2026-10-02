# Relatório 2026-10-02-w — IA em primeiro plano

Edge Function `b7-ia` (**publicada**) e front-end. **Nenhuma migration.** Mesmo provedor, mesma chave, mesma função.

## Por que este pacote

O retorno foi: a IA ficou boa, mas parecia incompleta e os botões estavam pequenos demais. A auditoria confirmou os dois pontos:

- as entradas da IA eram texto cinza de 12 px, sem borda (de propósito, "discretas") — fáceis de não ver;
- a revisão apontava o problema e parava ali: para corrigir, a pessoa tinha que achar a cena, abrir o assistente e redigitar o pedido;
- num roteiro em branco a IA não tinha nada a oferecer.

## O que mudou

### 1. Botões da IA maiores e visíveis (roteiro e linha editorial)

- Toda entrada de IA virou um botão de verdade: borda e fundo na cor da B7, 38 px de altura no computador e 46 px no celular (antes: texto de 12 px sem borda).
- No topo do roteiro há um bloco fixo **"IA do roteiro"** com as ações. A ação principal aparece preenchida.
- Em cada cena, o botão passou a se chamar **"Melhorar com IA"** (era "Assistente de IA").
- Na Linha Editorial, o ícone de 26 px ao lado de cada campo virou um botão **"IA"** com rótulo.

### 2. Da observação direto para o ajuste ("Ajustar com IA")

- Cada observação da revisão que tem sugestão e aponta uma cena ganhou o botão **"Ajustar com IA"**.
- Ele fecha a janela, leva até a cena e abre o assistente dela com a sugestão já escrita como instrução.
- Nada é gerado nem aplicado sozinho: a pessoa confere a instrução, clica em **Gerar** e depois em **Aplicar** (com Desfazer), como já era.

### 3. Criar rascunho (novo)

- Em roteiro ainda sem fala, o bloco da IA mostra **"Criar rascunho"**.
- A IA usa o título e o objetivo do roteiro, o conteúdo planejado na Linha Editorial (quando há vínculo real) e um direcionamento opcional de até 300 caracteres.
- Devolve de 3 a 6 cenas (Gancho, Narrativa, CTA), cada uma com orientação de gravação e fala.
- A pessoa marca as cenas que quer. Só essas entram no roteiro:
  - roteiro só com cenas em branco (o padrão de um roteiro novo): o rascunho ocupa essas cenas, na ordem, e o que sobrar entra no fim;
  - roteiro que já tem algo escrito: nada é tocado; as cenas novas entram no fim.
- O que a IA não sabe fica entre [colchetes] para a equipe preencher. Nas provas reais ela escreveu "[nome da clínica]" em vez de inventar.

## Regras mantidas

- Nenhuma chamada automática: tudo começa num clique.
- Nada entra no roteiro sem a pessoa marcar ou aplicar.
- Sem nota, percentual, tarefa criada ou status mudado.
- Designer não vê os botões e o servidor recusa.
- O nome do cliente não é enviado no rascunho.
- RLS: nenhuma policy criada ou alterada. O contexto é lido com a sessão da pessoa.

## Arquivos

- Servidor: `supabase/functions/_shared/ia/analise.ts` (operação `rascunho_roteiro`), `supabase/functions/b7-ia/index.ts`.
- Telas: `js/ia-analise.js`, `js/ia-roteiro.js` (`abrirCom`), `js/ia-linha.js`, `js/editor.js` (`cenasDoRascunho`), `styles/editor.css`, `styles/linha.css`.
- `IA.md`, `sw.js`, `js/auth.js` (versão `2026-10-02-w`).

## Testes executados

**Automatizados:** nenhum (o projeto não tem suíte de testes).

**Servidor publicado, IA de verdade, sessão real aberta no navegador daqui** (2 chamadas de IA no seu usuário, só leitura — nenhuma cena foi criada):

- Rascunho de um roteiro com planejamento ligado: 4 cenas em 8,1 s, na ordem Gancho → Narrativa → CTA, sem fato inventado.
- Rascunho com direcionamento ("bem curto, três cenas, tom descontraído"): 3 cenas em 6,3 s.
- Direcionamento acima de 300 caracteres: recusado sem chamar a IA.

**Página local com o editor de verdade e respostas simuladas:**

- Bloco "IA do roteiro": com roteiro em branco mostra "Criar rascunho"; com roteiro escrito, não mostra.
- Rascunho: clique duplo abre uma janela só; desmarcar uma cena muda a contagem; as 4 cenas marcadas entraram na ordem certa (3 nas cenas em branco, 1 criada no fim); tipo, orientação e fala corretos.
- "Ajustar com IA": levou à cena certa, abriu o assistente com a instrução preenchida e não gerou nada sozinho; depois de Gerar e Aplicar o texto mudou, e a revisão passou a avisar "O conteúdo mudou desde esta revisão".
- Altura dos botões: 38 px no computador, 46 px em tela estreita.

**Não testado:**

- Criar cenas a partir do rascunho em um roteiro real do site (evitei gravar dados de teste na produção).
- Botão "IA" da Linha Editorial: conferido só no código e no CSS, não na tela.
- Celular e aparelho físico.

## Limitações

- O rascunho é de um modelo pequeno e gratuito: serve como ponto de partida, não como texto final.
- "Criar rascunho" só aparece com o roteiro praticamente sem fala (menos de 60 caracteres). Para roteiro já escrito, o caminho é "Melhorar com IA" em cada cena.
- "Ajustar com IA" só existe em observações com sugestão e cena; na comparação com o planejamento não há.
- O rascunho não cria cenas de Narração (elas exigem a lista de imagens, que a IA não tem como saber).
