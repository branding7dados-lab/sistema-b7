# Relatório — Dia fixo de gravar e preparação da gravação

**Versão:** `2026-10-16-zzz206` · **Cache:** `roteiros-b7-v409`
**Pedido (Kevin):** quando o cliente tem dia fixo de gravar, a equipe já chegar com tudo pronto. Esta é a **etapa 1b** do plano (a 1a, referências da linha na gravação, saiu no zzz205).

## O que mudou
- **Gravação fixa (Editar cliente, só admin/coordenador):** "Este cliente tem dia fixo de gravar" → toda semana (dia da semana) ou todo mês (dia do mês, ajustado em meses curtos), horário opcional e antecedência (3, 5, 7, 10 ou 14 dias). Ao salvar, o sistema já cria as gravações que cabem na antecedência.
- **Criação automática:** uma rotina diária (06:05 de Brasília) cria a gravação "Gravação DD/MM" (mês de referência = mês da data, marcada com a data/horário e observação "Criada automaticamente…"), **uma por cliente e data** — se já existe gravação (não excluída) naquela data, nada é criado. Pode ser cancelada/excluída/remarcada como qualquer outra.
- **Preparação da gravação (card no topo da gravação):** barra e checklist — (1) data marcada, (2) linha do mês com conteúdos, (3) roteiros dos Reels que vamos gravar (Reels da linha que não são "só edição" e ainda não têm roteiro nem item na lista), (4) referências decididas (zzz205), (5) lista montada. Mostra o que falta, "faltam N dias" e fica rosa quando faltam ≤3 dias e há pendência. Botões de atalho: Marcar (data), Adicionar (lista), Decidir (rola até as referências). Atualiza sozinho ao mudar itens/referências. Some em gravação concluída ou cancelada.
- **Lista de Gravações:** cada gravação futura mostra "Preparação 3/5 · em 4 dias" (ou "Tudo pronto"), com o que falta no balãozinho.

## Banco de dados (aplicado no projeto; `migration_gravacao_fixa.sql`)
- Tabela `cliente_gravacao_fixa` (RLS leitura equipe/designer/videomaker; escrita só pela função).
- `cliente_gravacao_fixa_salvar`, `gravacoes_fixas_gerar_agora` (admin/coordenador), `_gravacoes_fixas_gerar` (interna, só a rotina), `_gravacao_fixa_proxima`, `gravacao_preparacao`, `gravacoes_preparacao_resumo`.
- Rotina `pg_cron` "gravacoes-fixas-gerar" (job 7), diária.
- Nada apagado ou alterado nos dados existentes; nenhum cliente tem gravação fixa até a equipe ligar.

## Arquivos
`js/dashboard.js`, `js/gravacao.js`, `js/database.js`, `js/novidades.js`, `styles/gravacao.css`, `js/auth.js`, `sw.js`, `migration_gravacao_fixa.sql`.

## Testes
Sintaxe (`node --check`). No banco: preparação das gravações reais (Infinite Fio: 3/5 e 4/5 — faltavam roteiros de 8 de 10 Reels e lista); geração em transação desfeita (mensal dia 22, 14h–16h, antecedência 10 → criou "Gravação 22/10", Agendada, 14:00–16:00; semanal terça com gravação já existente não duplicou; segunda execução não duplicou); conferido que nada ficou gravado. A parte visual não foi testada logada aqui.

## Observação
O Infinite Fio tem duas gravações "Semana 2" no mesmo dia (20/10) — provavelmente duplicada; não mexi.
