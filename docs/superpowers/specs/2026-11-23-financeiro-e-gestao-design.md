# Usuário Financeiro e novas telas de Gestão: desenho (4.86 e 4.87)

## Por quê
A B7 vai ter uma pessoa do **financeiro** acompanhando a gestão da agência: o que está atrasado, como cada cliente
está, se a equipe cumpre prazo. O Yury definiu: "o financeiro é tipo um administrador, só não tem acesso a
WhatsApp". O financeiro *do cliente* (mensalidade, pagamento) **fica no sistema da N7** e não entra no B7.
Para a gestão, o Yury escolheu três telas novas: **Contratado × entregue**, **Clientes em risco** e
**Prazos e retrabalho da equipe**.

## Entrega 1: o usuário Financeiro (4.86.0)
**O que é:** um administrador com duas exceções.
- **Sem WhatsApp:** some a Central, as Configurações do WhatsApp, o Otto e os Números. O banco e o servidor
  também recusam: `wa_pode_ver_numero`, as políticas de `wa_assistente`, `wa_config`, `wa_otto_memoria` e
  `wa_assistente_aprendizados`, e o `ehAdmin` da Edge Function `wa-evolution`.
- **Sem Pessoas e acessos:** não cria nem remove usuários, não troca função, não libera telas, não encerra
  sessões. Isso fica só com o Yury (decisão dele). O banco recusa nas RPCs de pessoas (`perfil_*`,
  `funcao_*`, `acesso_*`, `sessoes_*`) e na política de escrita em `perfis`.
- Todo o resto é igual ao administrador: Gestão (tela inicial), Panorama, Operações, Clientes, Projetos,
  produção, relatórios, Configurações do sistema que não são de pessoas, e o modo entretenimento (Jogos).

**Como (desenho):**
- Coluna nova `perfis.financeiro boolean default false`. A pessoa continua com `papel = 'admin'`, e por isso
  tudo que já funciona para o administrador funciona para ela sem refazer permissão por permissão.
- Dois ajudantes no banco:
  - `sou_financeiro()`;
  - `sou_admin_pleno()` = `sou_admin() and not sou_financeiro()`.

  O WhatsApp e Pessoas e acessos passam a usar `sou_admin_pleno()`. A migração descobre e troca essas
  verificações nas funções e políticas certas, e um teste em Postgres local confere cada bloqueio.
- Tela:
  - `B7.Auth.ehFinanceiro()`;
  - o menu esconde WhatsApp e Pessoas e acessos, e as rotas `#/whatsapp*` e `#/usuarios` mostram "Sem acesso";
  - a tela inicial é a Gestão.
- Em Pessoas e acessos, o Yury escolhe o tipo **Financeiro** ao criar ou editar a pessoa.

## Entrega 2: três telas novas na Gestão (4.87.0)
Viram abas novas da Gestão, que o administrador e o financeiro veem.

### Contratado × entregue
- Para cada cliente com pacote (`clientes.pacote_id` → `pacotes_producao.itens`, ex.: 12 posts + 4 vídeos):
  o contratado no mês contra o **planejado**, o **entregue** e o **publicado**, por tipo de conteúdo.
  Os números vêm da Linha editorial, de Design e de Vídeo, com a mesma conta do `relatorio_mes`.
- **Durante o mês:** uma barra de progresso contra o ritmo esperado (dia 15 com 3 de 12 posts acende "atrás do ritmo").
- **Mês fechado:** o selo "abaixo do contratado" quando entregou menos, e quanto faltou.
- Filtros por mês e "só quem está abaixo". Cliente sem pacote aparece em "sem pacote definido", com o atalho
  para definir.

### Clientes em risco
- Lista de quem precisa de atenção, com o **motivo em português**:
  - saúde abaixo de 50 agora;
  - saúde que caiu 15 pontos ou mais em 4 semanas;
  - nota de satisfação de 6 ou menos no último mês;
  - atraso em 2 dos últimos 3 meses;
  - abaixo do contratado no mês passado.
- **A saúde de cada cliente mês a mês** (gráfico pequeno das últimas 12 semanas). Para isso, a saúde passa a
  ser **guardada todo dia**: tabela `cliente_saude_hist`, preenchida pelo relógio do banco (pg_cron) com a
  mesma conta da aba Saúde de hoje. O histórico começa no dia da publicação.
- Toque no cliente para abrir a página dele.

### Prazos e retrabalho da equipe
- Por pessoa e por cliente, mês a mês (últimos 6 meses):
  - entregas;
  - **% no prazo**;
  - **tempo médio para entregar** (pedido → entregue);
  - **retrabalho**: média de versões por arte e quantas aprovações voltaram com ajuste;
  - atrasados hoje.
- Indicador de **tendência** (melhorou ou piorou contra o mês anterior).
- Os números vêm de Design (versões), Vídeo (demandas) e Aprovações, como o Relatório do mês já faz,
  agora em série de 6 meses.

## Fora destas entregas
- Mensalidade, pagamento e contrato (ficam na N7).
- O cadastro novo de cliente (projeto à parte, depois destas entregas).

## Ordem e publicação
1. **Entrega 1 (Financeiro).** Merge, com o SQL aplicado sozinho. Depois o Yury cria o usuário do financeiro.
2. **Entrega 2 (três telas).** Merge, com o SQL e o relógio da saúde aplicados sozinhos.

Cada entrega tem testes antes de ir ao ar:
- regras de acesso testadas num Postgres local;
- telas testadas no Chromium com banco simulado;
- revisão independente.

O merge sai quando os testes do GitHub passam.
