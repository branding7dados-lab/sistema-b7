# Relatório 2026-10-01-z — Camada de IA do B7 e assistente de roteiros

> **Situação (01/10/2026).** A camada de IA e o assistente estão implementados, testados com um roteador simulado e publicados **desligados**. **Nenhum modelo real foi chamado**: não existe um OmniRouter configurado para o B7 (nem no repositório, nem nos segredos do Supabase, nem nesta máquina), e ele precisa ser hospedado por você. Enquanto isso não existir, o assistente não aparece para ninguém.

## Resumo da atualização

- **Camada de IA reutilizável:** uma função no servidor (`b7-ia`) que recebe tarefas conhecidas, confere sessão e permissão, limita o uso, fala com o roteador e registra o resultado. A tela nunca fala com provedor de IA.
- **Assistente nos roteiros:** em cada cena do editor, uma entrada "Assistente de IA" abre um painel dentro da própria cena. A sugestão aparece ali; o roteiro só muda quando a pessoa clica em Aplicar.
- **Sem módulo novo:** nada na barra lateral, nenhuma página de chat, nenhum painel de IA.

## Auditoria inicial

- **Aplicação:** HTML, CSS e JavaScript puro, sem framework nem build. Não há React, React Query nem TypeScript no front. O estado do editor é um objeto em memória (`B7.Editor`).
- **Servidor:** Supabase. As regras ficam em funções SQL e em Edge Functions (`b7-auth`, `b7-push`, `b7-arte`, `google-agenda`, `oportunidades-sync`). A camada de IA entrou como mais uma Edge Function, que é o padrão do projeto.
- **Editor de roteiros (`js/editor.js`):** cada cena é um campo de texto simples. Digitar chama `B7.Save.campo('cenas', id, { texto })`, que é o salvamento automático, e redesenha a prévia.
- **Seleção de texto:** por ser um campo de texto nativo, a seleção é confiável (`selectionStart` / `selectionEnd`). Por isso o assistente trabalha com trecho selecionado.
- **Aprovação:** o envio ao cliente congela uma cópia do roteiro. Editar o rascunho depois não altera a versão enviada, então a IA também não alcança versões já enviadas.
- **Permissões:** `cenas` e `roteiros` têm RLS; a equipe (admin, coordenador, designer, videomaker) acessa, cliente não.
- **IA anterior:** nenhuma. Não havia chamada a modelo, chave nem experimento no repositório.

## Integração OmniRouter

**O que foi verificado.** Existem dois produtos com esse nome:

- **OmniRoute** (código aberto, de `diegosouzapw`): gateway que você hospeda, com camada gratuita e troca automática entre provedores. É o que corresponde ao pedido.
- **omnirouter.li:** serviço hospedado, cobrado por requisição a partir de crédito pré-pago. Não tem modelos gratuitos anunciados, então não serve para esta fase.

Do OmniRoute, conferi na documentação oficial:

- API compatível com a da OpenAI: `POST /v1/chat/completions`, `Authorization: Bearer <chave do painel>`;
- `model` aceita o nome de um combo ou o id de um modelo;
- `401` para chave inválida e `502` quando todos os provedores falham;
- troca interna em falhas transitórias, em até três tentativas;
- cabeçalhos `X-OmniRoute-*` com modelo, provedor, trocas, tokens e custo;
- só existe na forma hospedada por conta própria: servidor com cerca de 2 GB de RAM, HTTPS e `REQUIRE_API_KEY` ligado antes de expor.

**O que foi feito.** O serviço do B7 (`_shared/ia/servico.ts`) fala esse protocolo e lê esses cabeçalhos. Endereço, chave e lista de modelos vêm de três segredos.

**O que não foi feito.** Não conectei o B7 a nenhum OmniRoute, porque não existe um. Subir um servidor e criar contas em provedores não é algo que eu possa fazer por você.

## Modelos gratuitos

**Nenhum modelo foi configurado nem testado.** Não listo modelo como ativo.

O que a documentação do OmniRoute diz, sem eu ter confirmado em uso:

- há provedores gratuitos sem cadastro (OpenCode Free, Pollinations) e outros com chave gratuita (Gemini, Groq, Cerebras, Cloudflare);
- a própria documentação avisa que as ofertas mudam, que não há garantia de custo zero e marca alguns provedores gratuitos como "evitar" pelos termos de uso;
- um dos provedores gratuitos declara que registra todas as requisições para pesquisa.

Esse último ponto importa: o texto do roteiro de um cliente vai para o provedor. A escolha de quais provedores gratuitos conectar é uma decisão sua.

## Estratégia de fallback

Na ordem da lista `B7_IA_MODELOS`, uma tentativa por item, 25 s por tentativa e 50 s no total:

- **tenta o próximo:** sem resposta, tempo esgotado, `408`, `425`, `429`, `5xx`, modelo desconhecido para o roteador (`400`, `404`, `422`), resposta vazia ou fora do formato;
- **para:** `401` / `403` do roteador, porque a chave está errada e nenhum outro modelo resolveria;
- **nem chega ao roteador:** sessão inválida, falta de permissão, pedido inválido, limite de uso.

Não há repetição do mesmo modelo nem laço. Quando a lista acaba, a pessoa vê "Assistente de IA temporariamente indisponível. Tente novamente em alguns minutos."

**Sem modelo pago:** o B7 só pede o que está na lista. Não existe reserva fora dela. Quem garante que a lista é gratuita é o roteador ter só provedores gratuitos conectados. Como segunda tranca, se o roteador informar custo maior que zero, o valor fica gravado no registro.

## Segurança

- **Segredos:** endereço, chave e modelos ficam nos segredos da função. Nada de IA vai para o navegador; em `js/config.js` existe só um liga/desliga da entrada na tela.
- **Sessão:** conferida no servidor (`auth.getUser`). Sem sessão válida, `401`.
- **Quem pode usar:** a equipe. Cliente do Portal recebe `403`.
- **Permissão sobre a cena:** o contexto é carregado com a sessão da própria pessoa, então quem decide é o RLS que já existe. Nenhuma policy foi criada ou afrouxada.
- **Dados mínimos:** vão ao modelo o título e o objetivo do roteiro, o tipo da cena, as outras cenas resumidas e o trecho. Não vão o nome do cliente, a nota interna, outros roteiros, gravações, aprovações nem dados de pessoas.
- **Instrução livre:** limitada a 300 caracteres, entra como pedido sobre aquele trecho. O texto do roteiro vai delimitado, e o modelo é instruído a não obedecer ordens escritas dentro dele.
- **Saída do modelo:** tratada como texto, nunca como HTML.
- **Limite por pessoa:** 8 pedidos por minuto, 80 por hora e 2 simultâneos, conferidos no servidor.

## B7 AI Layer

```
tela → B7.IA.pedir(tarefa, dados) → b7-ia → tarefa (_shared/ia/roteiro.ts) → serviço (_shared/ia/servico.ts) → roteador
```

- **`servico.ts`:** configuração, chamada ao roteador, troca de modelo, prazos e leitura dos metadados. Não sabe nada de roteiros.
- **`roteiro.ts`:** esquema do pedido, carregamento do contexto, instruções ao modelo e limpeza da saída.
- **`b7-ia/index.ts`:** sessão, permissão, limite, registro e a resposta que a tela entende.
- **`js/ia.js`:** cliente do navegador. Devolve o texto ou uma frase pronta em português.

Uma tarefa futura entra como mais um arquivo em `_shared/ia/` e mais um caso na função. O resto é reaproveitado. O passo a passo está em `IA.md`.

## Assistente de Roteiros

**Fluxo:**

1. Em uma cena, a pessoa clica em **Assistente de IA**. Se havia um trecho selecionado, o assistente trabalha só ele; senão, o texto inteiro da cena. O painel diz qual dos dois.
2. Escolhe uma ação ou escreve uma instrução.
3. Aparece "Gerando sugestão…", com Cancelar. O resto do editor continua livre.
4. A sugestão aparece no painel, com a nota "O roteiro ainda não foi alterado".
5. A pessoa decide: **Aplicar**, **Copiar**, **Gerar novamente** ou **Descartar sugestão**.

**Ações:**

- Melhorar este trecho, Criar outra versão, Encurtar, Deixar mais natural: em qualquer cena com texto;
- Melhorar o gancho: aparece nas cenas do tipo Gancho;
- Sugerir CTA: aparece nas cenas do tipo CTA, inclusive vazias;
- Escrever instrução: sempre.

**Aplicar** escreve no campo e dispara o mesmo evento da digitação. O estado do editor, o salvamento automático e a prévia reagem como em uma edição feita à mão. Não existe segundo caminho de gravação. Depois de aplicar, um aviso oferece **Desfazer**.

**Proteções ao aplicar:**

- com seleção, troca só o trecho; se o texto andou, procura o trecho original e aplica no lugar certo;
- se o trecho original não existe mais, não aplica e orienta a copiar;
- se o texto inteiro da cena mudou depois do pedido, avisa e pede um segundo clique ("Aplicar mesmo assim").

## UI/UX

- **Onde aparece:** um botão pequeno abaixo do texto de cada cena. Fechado, ocupa uma linha; aberto, o painel fica dentro da cena. Não há barra lateral, modal nem redução da área de escrita.
- **Visual:** mesmos botões, campos, bordas e cores do editor. O acento B7 aparece só no ícone, no botão Aplicar e na borda da sugestão.
- **Movimento:** entrada do painel em 180 ms, desligada com "movimento reduzido".
- **Celular:** o painel é o mesmo, com alvos de 44 px, botões empilhados com Aplicar em cima, campo de instrução em 16 px (o iPhone não dá zoom) e botão Gerar abaixo do campo. Por ser um painel dentro da página, não depende de área segura nem fica atrás do teclado.
- **Teclado e leitor de tela:** tudo é botão de verdade; o painel é uma região nomeada; o estado "gerando" é anunciado; o erro tem `role="alert"`; Esc fecha a escolha de ações, mas não descarta uma sugestão já gerada.
- **Sem seletor de modelo:** a pessoa não vê nem escolhe modelo ou provedor.

## Banco de dados

Uma tabela, `ia_uso` (`migration_ia_uso.sql`, aplicada):

- metadados de cada pedido: pessoa, recurso, ação, cena, situação, categoria do erro, modelo e provedor que atenderam, tentativas que falharam, se houve troca, duração, tokens, custo e tamanhos em caracteres;
- **não guarda** o texto do roteiro, a instrução nem a sugestão;
- dois índices (`perfil_id, created_at` e `created_at`);
- RLS ligado e nenhuma policy: só o servidor lê e escreve. Não há tela para isso.

## Edge Functions / APIs

- **Nova:** `b7-ia` (publicada). Recebe `{ tarefa: 'roteiro', acao, cena_id, texto, cena_inteira?, instrucao? }` e responde `{ ok, texto }` ou `{ ok: false, categoria }`.
- Durante os testes existiu uma função temporária, `b7-ia-prova`, que já foi apagada.

## Arquivos

**Criados**

- `supabase/functions/b7-ia/index.ts`
- `supabase/functions/_shared/ia/servico.ts`
- `supabase/functions/_shared/ia/roteiro.ts`
- `js/ia.js`
- `js/ia-roteiro.js`
- `migration_ia_uso.sql`
- `IA.md`

**Alterados**

- `js/editor.js`: três trechos (a entrada na cena, a ligação e a exceção do arrastar)
- `styles/editor.css`: estilos do assistente
- `index.html`, `sw.js` (cache `v123`), `js/auth.js` (versão 2026-10-01-z)
- `js/config.js`: `IA: { roteiros: false }`

## Variáveis de ambiente

Segredos da função `b7-ia` (só os nomes):

- `B7_IA_BASE_URL`: endereço público do roteador, terminando em `/v1`
- `B7_IA_API_KEY`: chave criada no painel do roteador
- `B7_IA_MODELOS`: lista ordenada, separada por vírgula, de combos ou modelos gratuitos

No front, `IA: { roteiros: true }` em `js/config.js` liga a entrada na tela. O passo a passo está em `IA.md`.

## Testes executados

**Implementado e testado**

- **Serviço e tarefa** (módulos reais, publicados numa função temporária, com roteador simulado e sem chamada externa): validação do pedido (12 casos), limpeza da saída (13 casos), leitura da configuração (5 casos), geração e troca de modelo (11 cenários: primário responde; limite no primário e o segundo atende; erro, vazia e malformada até o quarto atender; todos falham; chave inválida não troca; tempo esgotado; primário lento; modelos desconhecidos; custo informado; prazo total; sem configuração), contexto (cena inexistente, roteiro apagado, resumo das outras cenas) e instruções (nota interna não vaza).
- **Função publicada:** sem token, com token inventado e com a chave pública no lugar do token, `401`; método errado, `405`.
- **Permissões no banco** (transação desfeita): admin, coordenador e designer enxergam a cena; uma sessão sem perfil na equipe não enxerga; `ia_uso` não é legível nem gravável pelo app.
- **Tela** (página local com o `editor.js`, `ui.js`, `ia.js` e `ia-roteiro.js` reais; banco, salvamento e resposta do servidor simulados):
  - fluxo completo: abrir, melhorar, descartar, copiar, gerar novamente, aplicar e desfazer, conferindo que o texto só muda no Aplicar e que o salvamento é chamado uma vez com o texto novo;
  - seleção: aplica só o trecho; trecho deslocado; trecho que sumiu; cena alterada depois do pedido;
  - instrução livre; ações por tipo de cena; cena vazia; texto acima do limite;
  - 12 falhas (todos os modelos fora, limite, tempo, sessão, permissão, cena apagada, erro 500, resposta vazia, malformada, rede, categoria desconhecida, sem sessão local): mensagem certa, texto intacto, nenhum salvamento;
  - HTML na resposta aparece como texto e não executa;
  - cancelar, fechar durante a geração, clique duplo em gerar e em aplicar;
  - duas cenas gerando ao mesmo tempo com respostas fora de ordem; o editor redesenhando as cenas durante a geração;
  - Esc, rótulos de acessibilidade, digitação manual salvando como sempre;
  - recurso desligado: nenhuma entrada na tela e nenhum pedido;
  - nenhum pedido de IA ao abrir o editor.
- **Layout:** desktop 1280 px, tablet 820 px e celular 375 px no tema escuro, sem rolagem lateral e sem nada vazando. No celular, alvos de 44 px.
- **App real:** carrega com os módulos novos, sem erro no console, com o recurso desligado.

**Implementado, dependendo de verificação externa**

- chamada a um OmniRoute real e a qualquer modelo gratuito;
- qualidade do texto gerado em português;
- o fluxo com login real, do clique até o texto gravado e relido do banco;
- a função recebendo o token de uma sessão real (a conferência com token válido não pôde ser exercitada por mim);
- limite de uso com pedidos reais;
- Android e iPhone físicos: só simulei por largura de tela.

**Não concluído, por bloqueio verificado**

- conexão com o OmniRouter: não existe uma instância para o B7.

## Limitações atuais

- **O assistente está desligado** até existir um roteador configurado.
- **Modelos gratuitos:** cotas pequenas e instáveis, sem garantia de disponibilidade. É esperado ver "indisponível" de vez em quando.
- **Privacidade:** o texto do roteiro vai para o provedor que atender. Provedores gratuitos podem registrar o que recebem.
- **Custo zero** depende de o roteador ter só provedores gratuitos conectados. O B7 registra o custo informado, mas não consegue impedir uma cobrança já feita pelo roteador.
- **Tamanho:** trechos de até 4.000 caracteres e instruções de até 300.
- **Sem histórico de sugestões:** descartou, perdeu. A sugestão não é guardada em lugar nenhum.

## Próximos passos

- Você decidir onde hospedar o OmniRoute e quais provedores gratuitos conectar; com endereço e chave, eu configuro os segredos, ligo o recurso e testo com modelo real.
- Depois de alguns dias de uso, olhar o `ia_uso` para ver quais modelos respondem bem e ajustar a ordem da lista.
