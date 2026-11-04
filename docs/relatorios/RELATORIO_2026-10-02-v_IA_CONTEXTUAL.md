# Relatório 2026-10-02-v — IA que revisa e compara

Edge Function `b7-ia` (**publicada**) e front-end. **Nenhuma migration.** Mesmo provedor, mesma chave, mesma função: nada de arquitetura nova.

## Resumo da atualização

- **Revisar roteiro** (novo): a IA lê o roteiro inteiro e devolve até 6 observações, cada uma ligada a uma cena.
- **Comparar com planejamento** (novo): em roteiro ligado a um conteúdo da Linha Editorial, compara o que foi planejado com o que o roteiro faz.
- **Revisar linha editorial** (evoluído): já existia, mas olhava só título, formato e pilar. Agora analisa o mês como conjunto, com ideia, objetivo e CTA de cada conteúdo.
- Nenhuma das três altera nada. Não há nota, percentual, tarefa criada nem status mudado.

## Auditoria da IA atual

- **Caminho que já existia e foi reaproveitado:** tela → `B7.IA.pedir` → Edge Function `b7-ia` → tarefa em `_shared/ia/` → `servico.ts` → `gemini.ts`. Sessão conferida no servidor, limite por pessoa (8 por minuto, 80 por hora), registro de uso só com metadados, erros traduzidos para frases em português.
- **Roteiros:** a IA só trabalhava uma cena por vez (melhorar, outra versão, gancho, CTA, encurtar, naturalizar, instrução).
- **Linha editorial:** campo a campo, sugerir pilares, sugerir conteúdos, revisar estratégia e **revisar linha editorial**. Essa última já existia; eu evoluí em vez de criar outra.
- **Vínculo roteiro ↔ planejamento:** existe e é confiável. `roteiros.content_id` aponta para o conteúdo e `conteudos.script_id` aponta de volta. No banco: 20 pares, nenhum quebrado e nenhum entre clientes diferentes. Os outros 50 roteiros não têm vínculo.

## Arquitetura de contexto

Cada operação declara o que precisa, e só isso é lido e enviado:

| Operação | O que vai para o modelo |
|---|---|
| Revisar roteiro | título, objetivo e cenas (tipo, orientação e fala); se houver vínculo, título, ideia e CTA do conteúdo planejado |
| Comparar com planejamento | conteúdo planejado (título, objetivo, ideia, headline, CTA, formato, pilar), tom de voz e objetivo do período da linha; o roteiro |
| Revisar linha editorial | estratégia, pilares, e os conteúdos **daquela linha** (título, formato, pilar, ideia, objetivo, CTA), mais as contagens por formato e pilar feitas pelo sistema |

Não vai: nota interna, outros roteiros, outros meses, outros clientes, aprovações, pessoas, ids. Nas duas análises de roteiro o nome do cliente não é enviado (só aparece se a equipe o escreveu dentro da fala). Na revisão da linha, nome e nicho do cliente continuam indo, como já iam antes.

O contexto é montado no servidor (`_shared/ia/analise.ts` e `linha.ts`), lendo com a sessão da própria pessoa.

## Revisar Roteiro

- **Onde:** botão "Revisar roteiro" no topo do roteiro, no editor.
- **O que avalia:** gancho, coerência, repetição, naturalidade da fala, clareza, ritmo, CTA, alinhamento (uma observação curta, só se houver planejamento ligado) e informação que vale conferir antes de gravar.
- **Resposta estruturada:** resumo de uma frase e observações com tipo, importância (observação, atenção, importante), cena, título, texto e sugestão.
- **Tela:** janela no mesmo padrão da IA da linha, com "Encontrei N observações", um cartão por observação e **"Ver cena"**, que fecha a janela, rola até a cena e a destaca.
- **Resultado velho:** a tela guarda o resultado com a "impressão" do roteiro no momento do pedido. Reabrir mostra o mesmo resultado sem nova chamada; se o roteiro mudou, aparece "O conteúdo mudou desde esta revisão" com "Revisar novamente". Resposta de um pedido cancelado ou substituído nunca é exibida.
- **Confirmação:** não existe "aplicar". Quem quiser mexer usa o roteiro ou a IA de cena que já existia.
- Cena sem fala é tratada como cena de imagem e não é apontada como erro.

## Revisar Linha Editorial

- **Período:** só os conteúdos da linha aberta (um mês de um cliente). Outro mês não entra.
- **Análise do conjunto:** uma chamada só, com todos os conteúdos numerados, para o modelo enxergar a relação entre eles.
- **O que procura:** conteúdos semelhantes mesmo com títulos diferentes, repetição de abordagem, CTAs repetidos, concentração em um formato, distribuição entre pilares, conteúdo pouco ligado à estratégia, falta de variação e oportunidades de diversificar.
- **Contagens:** quantos por formato e por pilar são calculados pelo sistema e entregues como fato; o modelo interpreta, não conta. Nenhum percentual "ideal" é sugerido.
- **Tela:** a mesma janela de antes, agora com cartões estruturados e os conteúdos citados em cada observação. "Não encontrei repetições nem desequilíbrios relevantes" é uma resposta possível.
- "Revisar estratégia" continua como era.

## Comparar Roteiro com Planejamento

- **Vínculo usado:** `roteiros.content_id`. Nada é adivinhado por título.
- **Validação no servidor:** o conteúdo precisa existir, ser do mesmo cliente da gravação do roteiro e não apontar para outro roteiro. A linha do conteúdo também precisa ser do mesmo cliente.
- **Sem vínculo:** o botão não aparece. Se alguém chamar direto, o servidor responde que não há planejamento para comparar e não chama o modelo.
- **Lógica:** para cada aspecto com informação no planejamento (ideia central, objetivo, ângulo, pontos-chave, formato, CTA, tom), diz se o roteiro está **alinhado**, pede **atenção** ou teve **mudança de abordagem**. Divergências aparecem primeiro; no máximo dois "alinhado".
- **Tela:** "N pontos comparados", cartões com a situação, o aspecto e a cena.

## Segurança

- **Execução no servidor.** O navegador manda só a operação e o id; nunca um prompt.
- **Permissão.** Sem sessão: 401. Cliente do Portal e designer: recusados. O contexto é lido com a sessão da pessoa, então o RLS decide o que entra.
- **RLS:** nenhuma policy foi criada ou alterada.
- **Isolamento entre clientes:** o vínculo roteiro → conteúdo → linha é conferido pelo cliente em cada passo; a revisão da linha só lê conteúdos daquela linha.
- **Texto como dado:** tudo que a equipe escreveu vai entre marcadores, com a regra de que não é instrução. A saída é validada campo a campo e exibida como texto, nunca como HTML.
- **Segredos:** a chave continua só no servidor. Nada dela está no front nem neste relatório.

## Gemini / Provider

- Mesmo provedor e mesmo modelo de antes, sem troca e sem seletor de modelo.
- Uma melhoria no provedor: as três análises passam a mandar o **formato da resposta** (`responseSchema`). Na primeira prova sem isso, uma chamada voltou inválida e outra estourou os 30 s; com o formato, todas responderam em 1 a 18 s. As operações antigas não mudaram.
- O adaptador do OmniRoute, que está desligado, ignora o formato e segue igual.

## Banco de Dados

**Nenhuma migration foi necessária.** As análises não são guardadas no banco. O registro de uso reaproveita a tabela `ia_uso` (`recurso = 'analise'`), só com metadados.

## Arquivos

- Criados: `supabase/functions/_shared/ia/analise.ts`, `js/ia-analise.js`.
- Alterados: `supabase/functions/b7-ia/index.ts`, `_shared/ia/linha.ts`, `_shared/ia/gemini.ts`, `_shared/ia/servico.ts`, `_shared/ia/provedor.ts`, `js/ia.js`, `js/ia-linha.js`, `js/editor.js`, `styles/editor.css`, `index.html`, `sw.js`, `IA.md`, `js/auth.js` (versão `2026-10-02-v`).

## Testes executados

**Automatizados:** nenhum (o projeto não tem suíte de testes).

**Servidor, com o provedor de verdade e dados reais** (função temporária, apagada depois):

- Revisar roteiro, em dois roteiros: observações ligadas à cena certa. Num deles apontou um erro de digitação real numa fala.
- Comparar com planejamento, em dois roteiros: divergências primeiro, alinhados depois.
- Revisar linha editorial, numa linha com 19 conteúdos: contagens por formato e pilar corretas; observações citando os conteúdos pelo título.
- Roteiro sem vínculo: resposta "sem vínculo", sem chamar o modelo.
- Pedido com operação desconhecida ou id inválido: recusado.
- Nas análises de roteiro, o contexto enviado não traz o nome do cliente (a não ser quando está escrito na fala).

**Site publicado, sessão real aberta no navegador daqui** (4 chamadas de IA, registradas no seu usuário):

- Revisar roteiro: 2 observações em 6,6 s; "Ver cena" fechou a janela e destacou a cena certa; o texto das cenas ficou idêntico.
- Comparar com planejamento: 3 pontos em 11,7 s.
- IA antiga da cena ("Encurtar"): sugestão gerada, descartada, texto intacto.
- Revisar linha editorial: 2 observações em 4 s; os 19 conteúdos ficaram sem nenhuma alteração.
- Sem sessão, a função responde 401.
- O registro de uso gravou as operações novas com duração e tokens; a tabela não é legível pelo navegador.

**Página local, respostas simuladas:** botão de comparar só com vínculo; clique duplo gera um pedido só; reabrir não gera novo pedido; aviso de conteúdo alterado; "Revisar novamente"; mensagens de pouco conteúdo e de limite; resposta sem observações; resposta de pedido cancelado não aparece; designer não vê os botões.

**Emulação de celular e aparelho físico:** nenhum teste. A janela é a mesma que a IA da linha já usava no celular.

## Regressões verificadas

- IA de cena do roteiro: funcionando (teste real acima).
- Revisar estratégia: o pedido continua válido; não refiz uma chamada real.
- Sugerir pilares, sugerir conteúdos e IA de campo da linha: código não alterado; não refiz chamadas.
- Roteiro e linha sem IA: os botões só aparecem com a IA ligada; nada mais mudou nas telas.

## Limitações

- **A qualidade é a de um modelo pequeno e gratuito.** As observações são úteis, mas nem sempre profundas, e ele pode errar um detalhe: numa das provas escreveu "dezessete conteúdos" para uma linha de 19, mesmo com a contagem certa no contexto.
- **Tempo variável:** de 1 a 18 s nas provas. Acima de 30 s o servidor desiste e a pessoa vê o aviso para tentar de novo.
- **Sem histórico:** a análise fica em memória e some ao recarregar a página.
- **Só 20 dos 70 roteiros têm vínculo** com a Linha Editorial; a comparação só existe para esses.
- **Roteiro de outra aba:** o aviso de conteúdo alterado compara com o que está na tela. Edição feita por outra pessoa só aparece depois de recarregar.
- Na camada gratuita do Google, o conteúdo enviado pode ser usado por ele para melhorar os produtos. Isso já valia para a IA existente.

## Próximos passos possíveis

- Revisar todos os roteiros de uma gravação de uma vez.
- Levar a comparação também para a peça de Design (arte × briefing).
