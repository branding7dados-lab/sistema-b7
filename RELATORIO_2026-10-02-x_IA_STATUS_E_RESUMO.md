# Relatório 2026-10-02-x — IA no Status Semanal e no Resumo do Mês

Edge Function `b7-ia` (**publicada**) e front-end. **Nenhuma migration.** Mesmo provedor, mesma chave, mesma função.

## Auditoria antes de construir

- **Status Semanal:** não tinha IA. O campo "Observação geral da semana" (o texto que resume a semana para o cliente) era escrito à mão, com as demandas logo abaixo já registradas no sistema.
- **Resumo do Mês:** não tinha IA nem texto: a folha era só números, barras e a lista de conteúdos.
- A camada de IA existente (sessão conferida no servidor, limite por pessoa, registro só de metadados) serviu sem mudança. Entrou uma tarefa nova, `resumo`, no mesmo formato das outras.

## O que entrou

### 1. Status Semanal — "Escrever com IA"

- Botão embaixo do campo **Observação geral da semana**.
- A IA lê as demandas daquele status (dia, tipo, título, situação e a observação de cada uma) e escreve 2 a 3 frases para o cliente: onde a semana está concentrada e o que depende dele.
- A sugestão aparece num painel com **Aplicar**, Copiar, Gerar novamente e Descartar, mais um campo para pedir um ajuste ("mais curto", "citar a gravação de quinta").
- Aplicar escreve no campo pelo mesmo caminho da digitação: salva sozinho, a prévia atualiza, e há **Desfazer**.
- Demandas canceladas não entram, como já não entram no relatório do cliente.

### 2. Resumo do Mês — "Leitura do mês"

- A janela do resumo ganhou o campo **Leitura do mês** (opcional, até 600 caracteres). O que estiver nele sai na folha, logo abaixo dos números.
- Dá para escrever à mão ou clicar em **Escrever com IA**.
- A IA recebe os números **já contados pelo servidor** (planejados, publicados, programados, artes, vídeos, gravações) e alguns títulos publicados, e escreve 3 a 4 frases.
- Com a leitura na folha, a lista de conteúdos mostra menos linhas para tudo caber em uma página (de 22 para 18 com um parágrafo médio; 14 no tamanho máximo).
- A leitura **não é gravada no banco**: fica guardada por cliente e mês enquanto o B7 está aberto. Recarregou a página, some.

## Proteções

- **Número inventado é barrado.** No resumo do mês, o servidor confere cada número do texto: se aparecer um que não está entre os contados pelo sistema (ou um percentual), a resposta é descartada e a pessoa vê o aviso para gerar de novo.
- **Sem base, sem chamada.** Semana sem demandas ou mês sem registros: a tela avisa e a IA não é chamada.
- **Só dados de produção.** A IA não tem alcance, engajamento nem vendas, e é instruída a não avaliar resultado.
- O nome do cliente não é enviado. Designer não vê o botão e o servidor recusa. Cliente do Portal também.
- O contexto é lido com a sessão da pessoa. Nenhuma policy de RLS criada ou alterada.
- Nada roda sozinho; nada entra no relatório sem **Aplicar**.

## Arquivos

- Criados: `supabase/functions/_shared/ia/resumo.ts`, `js/ia-texto.js`.
- Alterados: `supabase/functions/b7-ia/index.ts`, `js/semana.js`, `js/resumo-mes.js`, `styles/editor.css`, `styles/print.css`, `index.html`, `sw.js`, `IA.md`, `js/auth.js` (versão `2026-10-02-x`).

## Testes executados

**Automatizados:** nenhum (o projeto não tem suíte de testes).

**Servidor publicado, IA de verdade, dados reais, sessão aberta no navegador daqui** (só leitura: nenhum texto foi aplicado em status ou folha real):

- Status Semanal, 2 status reais (3 gerações, uma com pedido de ajuste): textos coerentes com as demandas, em 5 a 8 s.
- Resumo do Mês, setembro de 3 clientes, 8 gerações no total. Comparei os números de cada texto com os da folha:
  - primeira versão: 1 texto escreveu os números por extenso (corrigido na instrução) e 1 de 3 textos trocou um número por formato ("5 Reels de 5" quando eram 5 de 6). Tirei o detalhe por formato do que a IA recebe (ele continua na folha);
  - versão final: 4 de 4 textos com todos os números certos, em 4 a 16 s.
- Mês sem registros: aviso "pouco", sem chamar a IA.
- Cliente inexistente: "não encontrado".
- Total: cerca de 11 chamadas de IA registradas no seu usuário.

**Página local com as telas de verdade e respostas simuladas:**

- Status Semanal: gerar, pedir ajuste, aplicar (campo preenchido, salvamento disparado, prévia atualizada), desfazer.
- Resumo do Mês: gerar, aplicar, leitura aparece na folha, lista encolhe de 22 para 18 linhas, rodapé continua dentro da página; com 600 caracteres a folha ainda cabe; trocar de mês limpa o campo e voltar traz o texto de novo.

**Não testado:**

- Aplicar num Status Semanal real e baixar o PDF real com a leitura (evitei gravar em dados de produção).
- Sessão real de designer (a recusa está no código, igual às outras tarefas).
- Celular e aparelho físico.

## Limitações

- É um modelo pequeno e gratuito. O texto é ponto de partida: **confira antes de enviar ao cliente**, principalmente os números.
- A conferência de números só pega algarismos. O modelo é instruído a não escrever por extenso; se escrever, passa sem conferência.
- "Pedir um ajuste" gera um texto novo com o direcionamento; ele não edita a sugestão anterior. Pedidos como "uma frase só" nem sempre são seguidos à risca.
- A leitura do mês não fica salva. Se quiser guardar entre sessões, precisa de uma coluna nova (migration) — não fiz sem você pedir.
