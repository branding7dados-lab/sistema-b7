-- =========================================================================
-- ÍNDICES DE APOIO ÀS CONTAGENS DA CENTRAL DE PRODUÇÃO E DO DASHBOARD
-- (Rodada z2 — investigação de lentidão)
--
-- Contexto: usando o navegador de verdade, encontrei que TODAS as
-- consultas de contagem (HEAD + count=exact) em gravacoes e roteiros —
-- as que alimentam os números da Central de Produção e do resumo do
-- Dashboard — estavam respondendo 503 (Serviço indisponível) de forma
-- 100% consistente, enquanto consultas normais (GET, com limite de
-- linhas) nas mesmas tabelas funcionavam normalmente. Isso não é
-- coincidência de rede: ou é o Supabase rejeitando essas consultas por
-- algum limite do projeto, ou elas estão custando caro demais pro banco
-- (contagem sem limite, varrendo a tabela inteira) e estourando tempo.
--
-- Não tenho como ver os logs/uso do projeto Supabase daqui (não é
-- código, é infraestrutura da conta) — isso o Yury precisa checar no
-- painel do Supabase. Mas esses índices compostos, batendo exatamente
-- com os filtros usados (deleted_at + archived_at + situacao/status),
-- ajudam de qualquer forma: sem eles, mesmo os índices simples que já
-- existiam obrigam o banco a cruzar índices separados em vez de ler um
-- só — e não custam nada ter.
-- =========================================================================

create index if not exists gravacoes_contagem_idx
  on public.gravacoes (situacao)
  where deleted_at is null and archived_at is null;

create index if not exists roteiros_contagem_idx
  on public.roteiros (status)
  where deleted_at is null and archived_at is null;

create index if not exists gravacoes_data_gravacao_pendente_idx
  on public.gravacoes (data_gravacao)
  where deleted_at is null and archived_at is null and situacao = 'Pendente';
