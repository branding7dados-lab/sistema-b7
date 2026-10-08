# Relatório — IA: ideias nas Oportunidades, memória por cliente e resposta em fluxo

**Versão:** `2026-10-08-zzz123` · **Cache:** `roteiros-b7-v328`
**Pedido:** dos seis caminhos para melhorar a IA, "quero o 2, 4, 5".

**Situação:** o servidor (função `b7-ia`) e o banco **já estão no ar**. As telas estão neste pull request e só chegam à equipe quando ele for aceito. Até lá ninguém vê diferença: a função nova responde igual à antiga para as telas antigas.

## 2 · Ideias de conteúdo nas Oportunidades
Na folha de cada oportunidade apareceu a seção **Ideias de conteúdo**:
- escolhe-se o cliente (os relacionados à data vêm primeiro) e, se quiser, escreve-se um pedido ("foco em Reels, tom mais leve");
- **Sugerir ideias** devolve 3 ideias, cada uma com formato, título, gancho e legenda pronta;
- cada ideia tem **Copiar legenda** e **Copiar tudo**.

A IA usa a ficha de Inteligência do cliente, a linha editorial mais recente (objetivo, tom, canais, pilares) e a memória dele. **Nada é criado nem aplicado**: é para ler e copiar. Só roda quando alguém clica.

Se o cliente não tem estratégia preenchida, a IA não é chamada: aparece o aviso de que falta contexto.

Quem vê: quem abre a oportunidade, menos o designer (a mesma regra da IA da Linha Editorial). Segue o liga/desliga "Linhas" das Configurações.

## 4 · Memória da IA por cliente
Na ficha de Inteligência do cliente apareceu a seção **Memória da IA**, com um campo livre: "o que a IA deve saber sobre este cliente" (o que funcionou, o que evitar, combinados).

Esse texto passa a entrar em **todas** as tarefas de IA daquele cliente: roteiro, análise de roteiro, linha editorial, resumo para o cliente, assistente (com o cliente em foco) e as ideias novas.

**Achado da auditoria:** a ficha já tinha "Observações", "Palavras e expressões a usar", "Palavras proibidas" e "Estilo de CTA", mas nenhuma tarefa da IA lia esses quatro campos. Agora todas leem, junto com a memória.

## 5 · Resposta aparecendo enquanto é escrita
No assistente (chat), o texto passa a aparecer conforme a IA escreve, com um cursor no fim. O texto definitivo substitui o parcial quando termina. O cartão de "criar demanda" continua aparecendo só no fim, e o marcador interno dele nunca é mostrado.

Vale só para o chat. As outras tarefas devolvem listas ou trechos curtos e continuam como estavam.

**O ganho real é pequeno com o modelo atual.** A espera maior é antes de o modelo começar a escrever, não durante. Medido: numa resposta de 6,7 s, o primeiro trecho apareceu aos 5,0 s; noutra de 5,8 s, aos 4,8 s. Ajuda nas respostas longas; nas curtas quase não muda. Reduzir a espera inicial depende do modelo ou de enxugar o que o servidor lê antes de perguntar (hoje são cerca de 16 leituras do sistema por mensagem).

## Banco de dados
`migration_ia_memoria_cliente.sql` (aplicada): **uma coluna nova** (`ia_notas`) na tabela da ficha de Inteligência. Vale para ela a regra de acesso que já existia na tabela; nenhuma regra criada ou alterada.

## Servidor
Função `b7-ia` publicada com:
- tarefa nova `oportunidade` (`_shared/ia/oportunidade.ts`);
- memória do cliente em todas as tarefas (`_shared/ia/memoria.ts`), lida com a sessão de quem pede;
- chat em fluxo, só quando a tela pede.

Continua valendo: a chave fica só no servidor, camada gratuita, um pedido da pessoa = uma chamada, registro só de metadados (sem texto), nada roda sozinho, nada é aplicado sem a pessoa.

## Arquivos alterados
`js/oportunidades.js`, `styles/oportunidades.css`, `js/conteudo.js`, `js/ia.js`, `js/ia-chat.js`, `styles/ia-chat.css`, `supabase/functions/b7-ia/index.ts`, `supabase/functions/_shared/ia/` (`oportunidade.ts` e `memoria.ts` novos; `chat.ts`, `gemini.ts`, `servico.ts`, `provedor.ts`), `migration_ia_memoria_cliente.sql` (novo), `sw.js`, `js/auth.js` (versão).

## Testes executados
Tudo com a função publicada e os dados reais, no app local.

**Ideias:**
- pela função: 3 ideias para "Dia Mundial da Visão" × Óticas Almeida, em 7 a 11 s;
- pela tela: seção aparece, cliente relacionado já vem escolhido (3 relacionados, 20 outros), o botão mostra "Gerando…" com esqueleto, chegam 3 ideias com os dois botões de copiar e o aviso; conferido em captura.

**Memória:**
- gravei uma anotação temporária no cliente ("terminar toda legenda com 'Agende pelo WhatsApp da loja.' e nunca usar 'consulta'"): as 3 ideias e a resposta do chat obedeceram às duas regras. **A anotação foi apagada depois.**
- a seção aparece na ficha, entre Posicionamento e Produtos, com o campo vazio e limite de 1.500 caracteres.

**Fluxo:**
- pela função: 6 pedaços, e a soma deles igual ao texto final;
- pela tela: duas mensagens seguidas, as duas com os pontinhos primeiro, o texto crescendo e a lista formatada no fim; nenhuma sobra da bolha parcial.

**Função sem sessão:** recusa com "sessão", como antes.

## Uma falha no teste
A **primeira** chamada do chat em fluxo falhou ("indisponível", em 0,4 s). As três seguintes funcionaram. Foi a única falha do chat em 14 dias; não consegui reproduzir nem descobrir se foi instabilidade do provedor ou algo do caminho novo. Se voltar a acontecer, a pessoa vê o aviso de sempre e a pergunta volta para o campo.

## Não testado
- **Digitar na Memória da IA e ver salvar** (não gravei pela tela para não mexer no cadastro; o campo usa o salvamento automático dos outros campos da ficha).
- Os botões de copiar (a área de transferência não funciona no navegador de teste).
- O campo "Algum pedido?" das ideias; cliente sem estratégia (o aviso de contexto).
- A memória nas tarefas de roteiro, análise, linha e resumo (testada em ideias e chat; o caminho é o mesmo, mas não exercitei cada uma).
- Conta de coordenador e de designer; celular; tema escuro.
- O cartão de "criar demanda" com o chat em fluxo.

## Rastros do teste
- Duas conversas de teste no histórico do assistente do Kevin ("Teste do fluxo…"). Podem ser apagadas.
- Cerca de 8 chamadas de IA na cota gratuita.

## Correção feita por causa do teste automático do PR
O teste de "menos movimento" da abertura falhou numa das duas rodadas do PR (passou na outra, com o mesmo código). Não tem relação com a IA: com "reduzir movimento" ligado, o teste exige que nada na abertura esteja animando aos 0,9 s, e isso dependia da velocidade da máquina.
Duas causas possíveis, as duas corrigidas em `styles/abertura.css`:
- a regra que desliga as animações não alcançava os pseudo-elementos (o fio da espera, por exemplo), que seguiam animando;
- a saída da abertura usava um esmaecer de 0,2 s; agora, com "reduzir movimento", ela some na hora.
Não rodei o teste localmente (este computador não tem Node); a confirmação é a rodada do próprio PR.
