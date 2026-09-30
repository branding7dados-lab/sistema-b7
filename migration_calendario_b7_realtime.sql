-- Calendário B7 (fase 6): atualização ao vivo das fontes de eventos.
-- Aplicada como calendario_b7_realtime. O Realtime respeita o RLS de cada
-- tabela (quem não pode ler a linha não recebe a mudança).
do $$
declare t text;
begin
  foreach t in array array['gravacoes_ocorrencias','conteudos','demandas_edicao','design_deliverables'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
-- Reverter: alter publication supabase_realtime drop table public.gravacoes_ocorrencias, public.conteudos, public.demandas_edicao, public.design_deliverables;
