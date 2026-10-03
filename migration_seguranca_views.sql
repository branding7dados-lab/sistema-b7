-- =====================================================================
-- SEGURANÇA DAS VIEWS (pacote zzx, 03/10)
-- 1) portal_gravacoes era SECURITY DEFINER (roda como o dono, sem RLS)
--    E atualizável (uma tabela só no FROM): um usuário logado conseguia
--    UPDATE/DELETE em gravacoes através dela, passando por cima das
--    regras. A leitura vira uma função SECURITY DEFINER só de leitura,
--    com o mesmo filtro (visivel_cliente + posso_ver_cliente), e a view
--    passa a ser security_invoker por cima dela — o portal continua
--    lendo da mesma view, sem mudar o app.
-- 2) Nenhuma view do sistema é escrita pelo app: tira de anon e
--    authenticated todo privilégio que não seja SELECT.
-- Pode rodar de novo sem problema. APLICADA em 03/10 (equivalência
-- conferida: mesma saída para o mesmo usuário; UPDATE na view recusado).
-- =====================================================================

create or replace function public.portal_gravacoes_dados()
returns table (
  id uuid, client_id uuid, nome text, data_gravacao date, situacao text,
  status_cliente text, visivel_cliente_em timestamptz, updated_at timestamptz, roteiros jsonb
)
language sql stable security definer set search_path = public
as $$
  select g.id, g.client_id, g.nome, g.data_gravacao, g.situacao,
    case
      when g.situacao = 'Gravada' then 'gravada'
      when g.situacao = 'Cancelada' then 'cancelada'
      when g.data_gravacao is not null then 'programada'
      else 'em_preparacao'
    end as status_cliente,
    g.visivel_cliente_em, g.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'titulo', coalesce(nullif(r.titulo, ''), 'Sem título'),
        'aprovacao_id', ap.id, 'aprovacao_situacao', ap.situacao, 'aprovacao_versao', ap.versao)
        order by r."position")
      from roteiros r
      left join lateral (
        select a.id, a.situacao, a.versao from aprovacoes a
        where a.tipo = 'roteiro' and a.alvo_id = r.id and a.deleted_at is null
          and a.situacao <> all (array['substituido', 'cancelado'])
        order by a.versao desc limit 1
      ) ap on true
      where r.recording_session_id = g.id and r.deleted_at is null
    ), '[]'::jsonb) as roteiros
  from gravacoes g
  where g.deleted_at is null and coalesce(g.visivel_cliente, false) = true
    and posso_ver_cliente(g.client_id);
$$;
revoke all on function public.portal_gravacoes_dados() from public, anon;
grant execute on function public.portal_gravacoes_dados() to authenticated;

-- sem DROP: mesmas colunas, mesma ordem — troca a definição no lugar
create or replace view public.portal_gravacoes as
  select * from public.portal_gravacoes_dados();
alter view public.portal_gravacoes set (security_invoker = true);
alter view public.portal_gravacoes reset (security_barrier);
revoke all on public.portal_gravacoes from public, anon;
grant select on public.portal_gravacoes to authenticated;

do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', v.relname);
  end loop;
end $$;
