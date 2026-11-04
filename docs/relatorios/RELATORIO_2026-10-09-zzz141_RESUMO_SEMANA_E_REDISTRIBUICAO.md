# Relatório — Resumo da semana (IA) e sugestão de redistribuição

**Versão:** `2026-10-09-zzz141` · **Cache:** `roteiros-b7-v346`
**Pedido:** itens 99 (Resumo semanal da agência, escrito pela IA) e 102 (Sugestão de redistribuição).

Os dois ficam em **Configurações → Admin → Equipe e carga**, só para administrador.

## Resumo da semana (99)
Botão **Resumo da semana**: abre uma janela, você aperta **Gerar resumo** e lê um texto curto com quatro blocos: **o que andou**, **o que travou**, **carga** e **para olhar primeiro**. Há um campo opcional de direcionamento ("dê mais atenção ao vídeo") e o botão **Copiar**.
- **Os números são contados pelo banco**, dos últimos 7 dias: vídeos entregues, em aberto, com prazo vencido e parados há mais de 5 dias; o mesmo para o design; conteúdos publicados e programados; gravações realizadas e marcadas; carga em aberto por pessoa; e os 5 clientes com mais itens atrasados. A IA só escreve em cima deles.
- **Trava contra número inventado:** se o texto trouxer um número que não está entre os do sistema, ou um percentual, a resposta é recusada e a tela pede para gerar de novo.
- **Só roda quando você aperta o botão.** Sem chamada em segundo plano e sem aviso automático de segunda-feira: preferi assim por causa da regra de não chamar a IA sozinha.
- **Só administrador:** o servidor recusa outra função, e a função do banco confere de novo.
- Nada fica guardado além do registro de uso de sempre (quem, quando, quanto demorou: nunca o texto). Aparece em **Uso da IA** como "Resumo da semana (administrador)". Entra na mesma estrutura de IA que já existe (tela → b7-ia → provedor), sem chave nova nem segunda arquitetura.
- Os nomes de clientes e pessoas citados nos números seguem para o provedor de IA, como já acontece no Assistente.

## Sugestão de redistribuição (102)
Compara a carga de quem tem a mesma função (designers entre si, videomakers entre si) e, quando a diferença é grande, sugere passar **só o que ainda não começou** (vídeo "pendente", design "aguardando produção"), os de prazo mais distante primeiro, até metade da diferença e no máximo 10.
- Você marca os itens e aperta **Passar os marcados**; a janela pede confirmação. A troca usa as mesmas funções da tela de Vídeo e de Design (`video_atribuir` e `design_atribuir`), com o histórico delas e as permissões delas. **Nada muda sozinho.**
- Se não houver nada em condição de passar, a janela explica em vez de sugerir mexer no que está em andamento.
- Conta como carga: vídeo = pendente, em edição e aguardando aprovação; design = tudo que não está finalizado. A conta não inclui o Kanban.

**O que a sugestão achou hoje, com os dados reais (só leitura):**
- **Design:** Alissan tem 104 em aberto e Pedro Henrique, 0. Mas nenhum item da Alissan está esperando para começar (os 104 já estão em criação ou revisão), então **não há sugestão de passar**; a janela diz isso.
- **Vídeo:** Kaique tem 13 e Kevin, 2. Sugere passar 5 dos 7 itens pendentes dele (C6 Farma, "Meme 10" a "Meme 14") para o Kevin.

## Banco de dados
`migration_admin_ia_semana_redistribuicao.sql` (aplicada). Só **leitura**: `agencia_semana_dados`, `redistribuicao_sugestoes` e uma função interna de apoio (`_carga_funcao`), sem acesso para ninguém de fora. Só administrador executa as duas. Nenhuma tabela, regra de acesso ou dado existente foi alterado.

## Servidor
`b7-ia` foi publicada de novo com a tarefa `agencia` (arquivo novo `_shared/ia/agencia.ts`). Conferido depois: sem sessão, a função responde 401 `sessao`.

## Arquivos alterados
`supabase/functions/b7-ia/index.ts`, `supabase/functions/_shared/ia/agencia.ts` (novo), `js/admin-extra.js`, `js/dashboard.js`, `styles/sistema.css`, `sw.js`, `js/auth.js`.

## Novidades
Nenhuma entrada: são recursos só do administrador.

## Testes executados
**Banco, com a sua conta, em simulação desfeita:** `agencia_semana_dados` devolveu os números reais (vídeo: 18 entregues, 20 em aberto, 5 vencidos; design: 119 em aberto, 69 sem mudança há mais de 5 dias; 24 conteúdos publicados; 2 gravações realizadas; clientes com atraso: Mais Sorrisos e Águas Mucugê); `redistribuicao_sugestoes` devolveu o quadro acima; **uma conta que não é administradora foi barrada** na redistribuição.
**Servidor:** publicação e resposta 401 sem sessão.
**Lógica da trava de números:** copiei a regra para o navegador e testei com os números reais: texto correto passou; texto com um número trocado e texto com percentual foram recusados.
**Tela, na aba local sem login, com dados simulados:** Resumo (gerar, direcionamento enviado ao servidor, texto exibido, botão Copiar aparece, erro "recusado" mostra a explicação); Redistribuição (as duas áreas, desmarcar item, confirmação, troca chamou a função de vídeo só para os itens marcados, uma falha simulada foi contada e avisada: "1 item passado. 1 não foi possível passar.").

## Não testado
- **Um pedido real à IA.** O texto que a IA escreve de verdade ainda não foi visto: precisa da sua sessão no servidor, e eu não uso a sua sessão. A primeira vez que você apertar o botão é o teste. Se o texto vier recusado várias vezes, o ajuste é no prompt.
- **A troca de responsável de verdade** pelas funções reais (só foi simulada na tela).
- Celular.

## Rastros do teste
Nenhum registro criado ou alterado no banco (tudo desfeito). Nenhuma chamada à IA.
