# Relatório — Saúde do sistema, Médico, Comunicado e sessão derrubada na hora

**Versão:** `2026-10-09-zzz139` · **Cache:** `roteiros-b7-v344`
**Pedido:** itens 77 (Saúde do sistema), 123 (Médico do sistema), 71 (Comunicado pelo chat) e 95 (derrubar sessão na hora), das listas de ideias para o administrador.

Tudo fica em **Configurações → Admin**, só para administrador (o banco também confere).

## Saúde do sistema (77)
Uma tela de **leitura**, com um resumo no alto ("Tudo certo" ou "N pontos de atenção") e a lista:
- **Rotinas agendadas:** lembretes da agenda, avisos agendados e atualização das Oportunidades — quando rodaram pela última vez e se deram certo. Marca como parada a rotina dos lembretes que não roda há mais de 15 minutos.
- **Avisos push:** quantos saíram nas últimas 24 h, quantos falharam e quantos aparelhos estão cadastrados.
- **Google Agenda:** conectado ou não, com a última sincronização.
- **IA:** chamadas e erros nas últimas 24 h (atenção se mais de 30% falharem).
- **Espaço:** arquivos usados de 1 GB (atenção acima de 80%) e tamanho do banco.
- **Equipe agora:** quantos estão online.

**O que ficou de fora:** "quem está em versão antiga". O sistema não guarda a versão de cada aparelho; a tela avisa isso, em vez de inventar o número.

## Médico do sistema (123)
Procura o que está incompleto: clientes sem logo, sem linha editorial do mês e sem Memória da IA; demandas de vídeo e do Kanban abertas sem responsável; gravações marcadas sem videomaker; pessoas da equipe sem função; Google Agenda com problema. Cada achado lista até 12 casos com o botão **Abrir**, que leva ao registro.

**Não corrige nada sozinho.** Escolhi assim porque corrigir é mexer em responsável, cadastro e histórico, e isso você decide caso a caso.

## Comunicado pelo chat (71)
Você escreve uma vez, escolhe "toda a equipe" ou algumas pessoas, e a mensagem chega **na conversa direta de cada uma com você**, com a etiqueta **Comunicado** e o aviso de sempre. A janela lista os enviados, com "lido por X de Y" e, ao clicar, quem leu, quem só recebeu e quem ainda não recebeu.
- Cada pessoa vê só a própria conversa com você: ninguém vê o comunicado dos outros.
- Você vê só a **situação** (leu/recebeu), nunca o conteúdo das conversas dos outros.
- Limites: 2000 caracteres e 30 pessoas por envio.

## Sessão derrubada na hora (95)
Antes, encerrar uma sessão só valia quando o acesso do aparelho vencia (até 1 hora). Agora a consulta que cada tela já faz a cada minuto também confere se a sessão ainda existe; se não existe, o aparelho avisa ("Sua sessão foi encerrada por um administrador") e sai da conta.
- **Na prática:** com o B7 aberto, até 1 minuto; com o B7 fechado ou a aba escondida, ao abrir de novo.
- **Limite honesto:** isso derruba o **B7**. Quem tivesse extraído o acesso e falasse direto com o banco continuaria valendo até o acesso vencer (até 1 hora). Para barrar de verdade uma pessoa que saiu da equipe, o caminho continua sendo redefinir a senha ou inativar a conta em Usuários.
- Os textos de Sessões ativas foram atualizados ("em até 1 minuto").

## Banco de dados
`migration_admin_saude_medico_comunicado.sql` (aplicada). **Só acrescenta:** funções `sessao_valida`, `saude_sistema`, `medico_achados`, `chat_comunicado`, `chat_comunicado_lidos`, `chat_comunicados_lista`; a tabela `chat_comunicados`; a coluna opcional `chat_mensagens.comunicado_id`; e `sistema_avisos()` ganhou o campo `sessao`. Nenhuma regra de acesso existente (RLS) foi alterada; a tabela nova só deixa o autor ler os próprios comunicados e ninguém escreve direto nela. Nada foi apagado.

## Arquivos alterados
`js/admin-extra.js` (Saúde, Médico, Comunicado, textos de Sessões), `js/sistema.js` (derrubar), `js/dashboard.js` (as linhas da aba Admin), `js/conversas.js` (etiqueta Comunicado), `styles/sistema.css`, `styles/conversas.css`, `sw.js`, `js/auth.js` (versão).

## Novidades
Nenhuma entrada em Novidades: tudo é do administrador, exceto a etiqueta "Comunicado" na conversa, que não precisa de explicação.

## Testes executados
**Banco, com a sua conta, em simulação desfeita:** a sessão atual conta como válida; `saude_sistema` devolveu rotinas (as duas recorrentes com "succeeded"; a semanal ainda sem execução), push (28 enviados, 0 falhas), Google ativo, IA (46 chamadas, 7 erros), tamanhos reais; `medico_achados` devolveu achados reais (2 clientes sem logo, 15 sem linha do mês…); comunicado para uma pessoa criou a mensagem, apareceu em "lidos" como não lido e na lista como 1/0; **uma conta não administradora foi barrada** em `saude_sistema`.
**Tela, na aba local sem login, com dados de mentira:** Saúde (com falha de push e 84% de espaço simulados, o resumo mostrou "2 pontos de atenção"); Médico (o botão Abrir levou a `#/cliente/1` e fechou a janela); Comunicado (botão desligado sem texto, contador "Enviar para 2 pessoas" → "1 pessoa" ao desmarcar, o envio mandou o texto e só o destinatário marcado, "ver quem leu" mostrou os dois estados); sessão derrubada (com `sessao: false` o aparelho chamou "sair" uma vez, sem repetir); as três linhas aparecem em Configurações → Admin.

## Não testado
- **Dois aparelhos de verdade:** derrubar uma sessão real e ver o outro aparelho sair. A parte do banco foi vista, a da tela com dados simulados.
- **Um comunicado real chegando** na conversa e no push de outra pessoa (o envio no banco foi testado e desfeito; a etiqueta na conversa só foi escrita, não vista).
- O médico e a saúde com a sua conta pela tela (testei o banco com a sua conta e a tela com dados de mentira).
- Celular.

## Rastros do teste
Nenhum registro criado ou alterado no banco (tudo desfeito). Nenhuma chamada de IA.
