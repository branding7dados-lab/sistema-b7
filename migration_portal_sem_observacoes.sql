-- zzz250: o portal do cliente não enxerga mais observações internas.
-- conteudos.observacao_design nunca chega ao cliente; status_itens.observacao
-- só chega quando o status foi publicado com "mostrar observações".
-- O cliente lê pelas views (donas ignoram RLS, por isso o filtro é explícito)
-- e perde a leitura direta das tabelas.
create or replace view public.conteudos_portal with (security_barrier) as
  select id, client_id, linha_id, pilar_id, script_id, produto_id, tipo, "position", titulo, objetivo,
         ideia_geral, tema, canal, data_postagem, status, headline, sub_headline, cta, legenda, direcao,
         is_pinned, archived_at, deleted_at, created_at, updated_at, referencias, visivel_cliente,
         precisa_capa, oportunidade_id, producao_video, formato_video, referencia_link
    from public.conteudos c
   where deleted_at is null
     and (public.sou_equipe_interna() or (coalesce(visivel_cliente, false) and public.posso_ver_cliente(client_id)));

create or replace view public.status_itens_portal with (security_barrier) as
  select i.id, i.report_id, i.data, i."position", i.titulo, i.etapa, i.situacao,
         case when coalesce(s.mostrar_observacoes, false) then i.observacao end as observacao,
         i.canal, i.formato, i.content_id, i.script_id, i.recording_id, i.origem, i.source_snapshot,
         i.created_at, i.updated_at, i.deleted_at, i.data_postagem, i.situacao_cliente, i.situacao_auto
    from public.status_itens i
    join public.status_semanais s on s.id = i.report_id
   where i.deleted_at is null and s.deleted_at is null
     and (public.sou_equipe_interna() or (s.publicado_em is not null and public.posso_ver_cliente(s.client_id)));

revoke all on public.conteudos_portal, public.status_itens_portal from anon;
grant select on public.conteudos_portal, public.status_itens_portal to authenticated;

create or replace view public.portal_status as
  select id, client_id, linha_id, semana_inicio, semana_fim, titulo, publicado_em, updated_at,
         (select count(*) from public.status_itens_portal i where i.report_id = s.id) as total_itens
    from public.status_semanais s
   where deleted_at is null and publicado_em is not null;

create or replace function public.aprov_titulo(a public.aprovacoes)
returns text language sql stable set search_path to 'public' as $$
  select coalesce(nullif(a.snapshot->>'titulo', ''), nullif(a.snapshot->>'nome', ''),
    case a.tipo
      when 'roteiro'  then (select r.titulo from public.roteiros r where r.id = a.alvo_id)
      when 'linha'    then (select l.nome from public.linhas_editoriais l where l.id = a.alvo_id)
      when 'conteudo' then (select ct.titulo from public.conteudos_portal ct where ct.id = a.alvo_id)
    end, 'Sem título')
$$;

alter policy conteudos_cliente_leitura on public.conteudos using (false);
alter policy status_itens_cliente_leitura on public.status_itens using (false);
