# Relatório 2026-10-01-ae — IA na Linha Editorial

> **Situação (01/10/2026).** Publicado e ligado: função `b7-ia` atualizada no Supabase e front no GitHub, versão `2026-10-01-ae`. O servidor foi testado com o Gemini real usando um cliente inventado; a tela foi testada com respostas simuladas. **O caminho completo com login real (clicar, gerar e gravar numa linha de verdade) não foi exercitado por mim** — é o primeiro teste que peço a você.

## Resumo

A Linha Editorial ganhou assistência de IA em cinco pontos, todos pedidos pela pessoa e nenhum gravando sozinho:

1. **Campos de texto** da estratégia, do pilar e do conteúdo: um ícone discreto no rótulo abre o mesmo painel dos roteiros (Aplicar / Copiar / Gerar novamente / Descartar).
2. **Sugerir pilares:** lista de tipos que a linha ainda não tem; você marca quais adicionar.
3. **Sugerir conteúdos:** 3, 5 ou 8 ideias; você marca quais viram conteúdo.
4. **Revisar estratégia** e **Revisar linha editorial:** observações, sem alterar nada.
5. **Sugerir ideias para este pilar:** o mesmo fluxo de ideias, focado em um pilar.

Não há módulo, página, chat, seletor de modelo nem item de menu novo.

## Auditoria

**Linha Editorial (o que existe de fato)**

- Uma tela (`js/linha.js`) com cinco abas: Visão geral, Estratégia, Criativos, Postagens e Produção.
- **Estratégia:** campos de texto `objetivo`, `objetivo_detalhe` (só aparece se já tinha texto), `posicionamento`, `tom_voz`, `puv`, `percepcao`; mais período, meta, canais e links de referência.
- **Pilares:** o nome é uma **lista fechada de tipos** (Entretenimento, Educativo, Informativo, Inspirador, Conversão, Institucional), com percentual, funil, objetivo e observações. Por isso "sugerir pilares" sugere tipos dessa lista, não nomes livres.
- **Conteúdos (criativos):** título, objetivo, ideia geral, pilar, canal, data, status; e por formato: headline, sub-headline, CTA, direção visual, legenda. Carrossel e Story têm slides e stories em tabelas próprias.
- **Autosave:** todo campo com `data-tab/data-campo` grava pelo evento de digitação (`C.ligarCampos` → `B7.Save.campo`) e é espelhado em memória.
- **Criação canônica:** `B7.DB.criarConteudo` e `B7.DB.criarPilar`, chamados pelo "+ Novo conteúdo" e pelo "+ Adicionar pilar".
- **Permissões:** equipe interna edita; designer só lê (a tela trava os campos); cliente vê pelo Portal o que foi marcado como visível.
- **Contexto do cliente:** existe a "Inteligência do cliente", mas está praticamente vazia hoje (2 registros, nenhum com nicho ou descrição). As 20 linhas ativas, por outro lado, têm objetivo e posicionamento preenchidos.
- **Roteiros:** um Reel pode ter um roteiro vinculado; o texto do vídeo vive no editor de roteiros.

**IA (o que já existia)**

- Função `b7-ia` com sessão, permissão, limite por pessoa, registro `ia_uso` e a tarefa `roteiro`; serviço e provedor Gemini; `js/ia.js` (cliente) e `js/ia-roteiro.js` (painel na cena).

## Reutilização da IA existente

- **Reaproveitado sem mudança:** sessão e permissão de equipe, limites (8/min, 80/h, 2 simultâneos), registro `ia_uso`, provedor Gemini e sua chave, tradução de erros, frases de erro, o cliente `B7.IA.pedir`, e todo o visual do painel (`.ia-painel`, ações, sugestão, botões, estado "gerando").
- **Mudanças pequenas em arquivos compartilhados**, e por quê:
  - `provedor.ts`, `gemini.ts`, `servico.ts`: um parâmetro opcional `json`, que pede ao Gemini uma resposta em JSON. Necessário para as listas (pilares, ideias, observações). Sem ele, nada muda — os roteiros não o usam.
  - `b7-ia/index.ts`: passou a aceitar duas tarefas. O caminho dos roteiros é o mesmo, só reorganizado.
  - `js/ia.js`: devolve `itens` quando a resposta é uma lista; ganhou a frase de "contexto insuficiente"; duas frases que falavam em "roteiro" e "cena" ficaram neutras ("Você não tem acesso ao assistente aqui." e "Este item não foi encontrado…").
- **Não reaproveitado:** `js/ia-roteiro.js` é preso à estrutura de cena (seleção de trecho, redesenho do editor). Para não arriscar o que já funciona, o painel de campo da linha é um arquivo próprio (`js/ia-linha.js`) que usa os mesmos estilos. Há alguma repetição de lógica entre os dois; unificar fica como possível melhoria.

## Estratégia

- Ícone de IA no rótulo de: Objetivo do período, Complemento do objetivo, Posicionamento, Tom de voz, Proposta única de valor e Percepção desejada.
- **Com texto:** Melhorar, Deixar mais claro, Desenvolver melhor, Resumir, Criar outra versão, Escrever instrução. (Tom de voz não tem Desenvolver nem Resumir.)
- **Vazio:** só "Sugerir um texto" e instrução. A sugestão usa os outros campos já preenchidos; se não houver nenhum, a função avisa e **não chama o modelo**.
- **Revisar estratégia:** botão no topo da aba. Devolve de 2 a 5 observações (tema + texto). Sem nota, pontuação ou percentual. Opções: Copiar, Gerar novamente, Fechar.
- Sem IA em: links de referência, datas, meta e canais.

## Pilares de Conteúdo

- **Objetivo do pilar:** Melhorar descrição, Deixar mais claro, Criar outra versão; vazio: Sugerir descrição.
- **Sugerir pilares:** abaixo de "+ Adicionar pilar". Sugere só tipos que a linha ainda não tem, cada um com funil, objetivo e motivo. Nada vem marcado. "Adicionar selecionados" cria os marcados pelo mesmo caminho do botão manual, **com 0%** — o peso continua com a equipe. Pilares existentes não são tocados. Se a linha já tem os seis tipos, a janela diz isso e nenhuma chamada é feita.
- **Sugerir ideias para este pilar:** em cada pilar com tipo definido.

## Criativos

- **Sugerir conteúdos:** no topo da aba Criativos. Primeiro você escolhe quantas (3, **5** ou 8) e, se quiser, um direcionamento. Só então há a chamada.
- Cada ideia mostra formato, pilar sugerido, título, ideia e direção de CTA. As parecidas com um conteúdo que já existe vêm com o aviso "Parecido com um conteúdo que já está na linha".
- Nada vem marcado. "Adicionar N selecionados" cria só os marcados, com `criarConteudo` (o mesmo do "+ Novo conteúdo"), status Ideia, título, ideia geral, pilar e CTA (Carrossel não tem campo de CTA, então não recebe). A atividade é registrada como em uma criação manual.
- Depois de criado, é um conteúdo comum: sem marca de IA, sem tabela à parte.
- **Falha parcial:** o que entrou sai da lista; o que falhou fica marcado para tentar de novo. Repetir o clique não cria duas vezes.
- **Linha sem conteúdo:** aparece "Sugerir primeiros conteúdos" só se houver estratégia ou pilares com objetivo. Sem isso, não aparece.

## Assistência por conteúdo

No editor de um conteúdo, ícone de IA em: Título, Objetivo, Ideia geral, Headline, Sub-headline, CTA e Legenda (os que existirem naquele formato).

- **Título:** Melhorar título, Criar outra versão, Encurtar.
- **Ideia geral:** Melhorar conceito, Desenvolver ideia, Encurtar, Criar outra versão.
- **CTA:** Melhorar CTA / Sugerir CTA.
- **Legenda:** Melhorar, Criar outra versão, Encurtar, Deixar mais natural; vazia: Criar legenda.
- Todos com "Escrever instrução…".

Sem IA em: direção visual, observação para o design, textos de slides e de stories, referências.

**Linha editorial x roteiros:** a IA da linha escreve conceito, ângulo e chamada. Ela é instruída a não escrever roteiro, cenas nem falas; o roteiro continua no editor de roteiros, com o assistente de lá. O vínculo Reel → roteiro não foi alterado.

## Contexto enviado para IA

Montado por operação, lido com a sessão da própria pessoa:

| Operação | Vai |
|---|---|
| campo da estratégia | cliente, mês, os **outros** campos da estratégia, descrição do cliente (se houver) |
| objetivo de um pilar | cliente, mês, objetivo e posicionamento da linha, tipo e funil do pilar, nomes dos outros pilares |
| campo de um conteúdo | cliente, mês, objetivo e tom de voz da linha, formato, pilar, e os outros textos **daquele** conteúdo |
| sugerir pilares | estratégia e pilares existentes |
| sugerir conteúdos | estratégia, pilares, canais e os títulos já planejados **nesta linha** |
| revisar estratégia | estratégia e pilares (com o peso) |
| revisar linha | estratégia, pilares, meta e a lista de conteúdos (formato, pilar, título) |

**Nunca vai:** outra linha, outro mês, outro cliente, roteiros, gravações, vídeo, design, aprovações, links de referência, observações internas, pessoas. Os textos são cortados em tamanhos fixos. Não há busca na internet nem uso de Oportunidades.

**Diferença em relação aos roteiros:** aqui o **nome do cliente vai** para o modelo (nos roteiros não vai), porque o planejamento depende dele.

## UI/UX

- **Fechado:** um ícone de 26 px no rótulo do campo e um botão de texto discreto por seção. Nada de painel fixo, faixa ou selo.
- **Campo:** o painel abre logo abaixo do campo, dentro da página ou do editor do conteúdo.
- **Listas e revisões:** janela própria; no celular ela vira folha inferior, com os botões empilhados (padrão de modal do B7).
- **Celular:** ícone e ações com 44 px de toque, campos em 16 px, caixas de seleção maiores.
- **Acessibilidade:** tudo é botão ou caixa de seleção de verdade, com nome; o estado "gerando" é anunciado; item selecionado muda a borda **e** a caixa marcada; Esc dentro do painel de um campo não fecha o editor do conteúdo.
- **Carregando:** local ("Gerando sugestão…", "Criando ideias…", "Analisando estratégia…"), com Cancelar. O resto da linha continua utilizável.

## Segurança e permissões

- Mesma função, mesma sessão conferida no servidor, mesma chave no segredo. Nada de IA no navegador além do liga/desliga.
- **RLS:** nenhuma policy criada ou alterada. O contexto é lido com a sessão da pessoa.
- **Designer:** não vê nenhuma entrada de IA na linha, e o servidor recusa (`403`) a tarefa `linha` para ele.
- **Cliente do Portal:** recusado, como antes.
- Pilar ou conteúdo de outra linha no pedido → "não encontrado".
- A IA não cria nem altera nada no banco: quem grava é a tela, com a sessão da pessoa, pelos caminhos de sempre.
- Instrução livre limitada a 300 caracteres; o material vai delimitado e o modelo é instruído a não obedecer ordens dentro dele.

## Banco de dados

**Nenhuma migration, nenhuma tabela, nenhuma coluna.** O registro usa a `ia_uso` que já existia, com `recurso = 'linha'`. Sugestões não aceitas não são guardadas em lugar nenhum.

## Arquivos

**Criados**

- `supabase/functions/_shared/ia/linha.ts`
- `js/ia-linha.js`

**Alterados**

- `supabase/functions/b7-ia/index.ts`, `_shared/ia/provedor.ts`, `_shared/ia/gemini.ts`, `_shared/ia/servico.ts`
- `js/ia.js`
- `js/linha.js`: pontos de entrada e as duas funções de criação usadas pelas sugestões
- `styles/linha.css`: estilos do ícone, das entradas e da janela
- `index.html`, `sw.js` (cache `v128`), `js/auth.js` (versão `2026-10-01-ae`), `js/config.js` (`IA: { roteiros: true, linhas: true }`)
- `IA.md`

## Testes executados

### Com o Gemini real (servidor, cliente inventado — uma clínica odontológica fictícia)

Dez chamadas, por uma função temporária já apagada, usando os módulos reais:

- melhorar objetivo, sugerir proposta de valor (campo vazio), outra versão de título, criar legenda, instrução livre em ideia geral: os cinco devolveram só o texto, em português, no tamanho pedido;
- sugerir pilares: 3 tipos que a linha não tinha, com objetivo e motivo;
- sugerir 5 conteúdos: 5 ideias distintas, com formato e pilar válidos, nenhuma repetindo os títulos existentes;
- ideias de um pilar: 3 ideias, todas daquele pilar;
- revisar estratégia e revisar linha: observações objetivas; a revisão da linha apontou dois conteúdos de mesmo assunto que eu tinha colocado de propósito.

Dois ajustes saíram disso: uma resposta veio sem acentos (instrução reforçada) e uma ideia citou "WhatsApp" e "café", que não estavam no contexto (instrução reforçada). **Não repeti as chamadas depois desses dois ajustes.**

### Sem modelo (servidor)

- validação do pedido: 19 casos (campo inexistente, campo de outra tabela, ação inválida, vazio, tamanho, quantidade 30 recusada, operação inventada…);
- contexto insuficiente: 12 casos;
- limpeza das listas com respostas imitadas: tipo de pilar fora da lista, tipo repetido, formato inexistente, ideia repetida, ideia parecida com conteúdo existente, pilar inexistente, excesso de itens, "92% otimizada" descartado, resposta que não é JSON, lista vazia;
- leitura do contexto no banco real, sem modelo: linha, pilar e conteúdo corretos carregam; pilar e conteúdo de **outra** linha, linha inexistente e acesso sem sessão devolvem nada;
- função publicada, sem sessão: `401`.

### Tela (página local com `linha.js`, `conteudo.js`, `ui.js`, `ia.js` e `ia-linha.js` reais; banco e respostas simulados)

- abrir a linha e trocar de aba: nenhum pedido de IA;
- campo: melhorar, copiar, gerar novamente, aplicar (uma gravação pelo autosave, valor mantido ao trocar de aba), desfazer, descartar, campo vazio, instrução livre, HTML na sugestão exibido como texto;
- 8 falhas (cota, limite, tempo, recusa, indisponível, sem permissão, não encontrado, contexto): frase certa, campo intacto, nenhuma gravação;
- texto alterado depois do pedido: pede segundo clique;
- clique duplo em gerar: um pedido só;
- resposta atrasada após trocar de aba: nada aplicado nem gravado; ao voltar, a sugestão espera a decisão;
- pilar: aplicar objetivo grava no pilar certo;
- sugerir pilares: nada criado antes de marcar; cria só o marcado, com 0%; descartar não cria; linha com todos os tipos;
- sugerir conteúdos: sem pedido ao abrir; quantidade e direcionamento enviados; aviso de parecido; cria só os marcados; falha parcial e nova tentativa sem duplicar; Carrossel sem CTA;
- revisões: observações, copiar, nenhuma escrita; fechar a janela no meio do pedido;
- editor do conteúdo: campos com IA, aplicar título (aparece no card), Esc não fecha o editor;
- designer: nenhuma entrada de IA; IA desligada: nenhum elemento de IA na tela;
- linha vazia: sem oferta de IA; só com estratégia: "Sugerir primeiros conteúdos";
- larguras de 375 px e 1366 px: nada estoura; no celular, alvos de 44 px.

### Não testado

- **o fluxo com login real**, numa linha de verdade, do clique ao registro gravado e relido;
- **os roteiros depois desta mudança, com login real:** a função foi reorganizada para aceitar duas tarefas. Conferi os módulos dos roteiros (validação, instruções, limpeza) e que a função sobe e recusa sem sessão, mas não uma geração de roteiro logado;
- recusa do designer no servidor (conferida no código, não com uma sessão de designer);
- apresentação e PDF com um conteúdo criado por sugestão (é um conteúdo comum, mas não abri a apresentação);
- aba Postagens e Produção; tema escuro; aparelho físico.

## Regressões verificadas

- **Linha editorial sem IA:** digitar grava como antes; "+ Adicionar pilar" cria como antes; com a IA desligada a tela não tem nenhum elemento novo.
- **Roteiros:** `js/ia-roteiro.js` e `js/editor.js` não foram alterados. Os módulos do servidor foram reexecutados. O registro mostra 2 usos de roteiro com sucesso, ambos **anteriores** a este pacote.

## Limitações

- **Cota:** linha e roteiros dividem a mesma cota gratuita e os mesmos limites por pessoa. Sugerir 8 ideias gasta mais que melhorar um campo.
- **"Parecido":** a comparação é por palavras em comum no título. Pega repetições óbvias, não sinônimos.
- **Fatos inventados:** o modelo é instruído a não inventar, mas pode errar. A revisão humana continua sendo a trava.
- **Contexto do cliente:** a Inteligência do cliente está quase vazia; hoje a IA trabalha basicamente com o que está na própria linha.
- **Privacidade:** na camada gratuita do Gemini, o conteúdo enviado pode ser usado pelo Google. Agora isso inclui o nome do cliente e a estratégia do mês.
- **Sugestões não ficam guardadas:** fechou a janela, perdeu.
- **Slides, stories e direção visual** não têm assistência.
- **Código repetido** entre o painel dos roteiros e o da linha.

## Próximos passos (não implementados)

- Você testar logado: um campo da estratégia, "Sugerir conteúdos" e um roteiro.
- Unificar o painel de campo dos roteiros e da linha num componente só.
- Assistência nos textos de slides e stories.
- Ideias a partir das Oportunidades do calendário, quando fizer sentido.
- Trocar a chave do Gemini que ficou no histórico do chat.
