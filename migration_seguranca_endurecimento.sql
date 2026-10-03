-- =====================================================================
-- SEGURANÇA — endurecimento (pacote zzm, 03/10/2026)
--
-- Auditoria de segurança: o que esta migration fecha.
--
-- 1. FUNÇÕES SEM LOGIN. Toda função do schema public estava executável
--    pelo papel `anon` (padrão do Supabase). Várias são SECURITY DEFINER
--    sem conferir quem chama — com a chave pública do site, qualquer um
--    podia, por exemplo, ler o conteúdo de uma linha editorial
--    (linha_montar_snapshot), forjar eventos/notificações para a equipe
--    (aprov_emitir) ou ler relatórios de produção. Agora nenhuma função
--    do public é executável sem sessão; o padrão para funções novas
--    também deixa de conceder a `anon`.
-- 2. FUNÇÕES INTERNAS. As que só servem a outras funções, a gatilhos ou
--    ao agendador (cron) deixam de ser chamáveis por usuário logado.
--    Quem as usa por dentro roda como dono (SECURITY DEFINER) e continua
--    funcionando.
-- 3. RELATÓRIOS DE VÍDEO sem checagem de papel passam a exigir equipe
--    interna (admin, coordenador, designer, videomaker) — as mesmas
--    pessoas que já os usam. Cliente do Portal não lê produção de todos
--    os clientes. Implementado como "embrulho": a função original é
--    renomeada e a pública confere o papel antes de chamá-la; o cálculo
--    não muda uma linha.
-- 4. STORAGE client-logos: enviar, trocar e apagar logo exigia… nada
--    (anon podia). Agora só equipe interna. Leitura continua pública
--    (o push e os documentos usam a URL direta). SVG sai dos tipos
--    aceitos (pode carregar script; nenhuma logo atual é SVG).
-- 5. LINKS: esquemas que executam código (javascript:, data:, vbscript:,
--    file:) passam a ser recusados pelo banco nos campos de link. Nenhum
--    dado atual é afetado (conferido antes: todos vazios ou http/https).
--
-- Nada de dado apagado ou alterado. Nenhuma regra de quem vê o quê para
-- usuário interno mudou.
-- =====================================================================

-- ---------------------------------------------------------------- 1
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------- 2
revoke execute on function public.aprov_emitir(text, text, public.aprovacoes, public.perfis, jsonb) from authenticated;
revoke execute on function public.aprov_processar_evento(uuid) from authenticated;
revoke execute on function public.design_processar_evento(uuid) from authenticated;
revoke execute on function public.video_processar_evento(uuid) from authenticated;
revoke execute on function public.agenda_verificar_lembretes() from authenticated;
revoke execute on function public._video_proximo_codigo_gravacao(uuid) from authenticated;
revoke execute on function public._video_checar_roteiros_disponiveis(uuid[], uuid) from authenticated;
revoke execute on function public.linha_montar_snapshot(uuid) from authenticated;
revoke execute on function public.video_achar_videomaker_por_responsavel(text) from authenticated;

-- ---------------------------------------------------------------- 3
do $$
declare
  nomes text[] := array['video_gestao_resumo', 'video_producao_por_cliente', 'video_relatorio_por_videomaker', 'video_carga_equipe'];
  n text; f record; base text; chamada text; corpo text;
begin
  foreach n in array nomes loop
    select p.oid, pg_get_function_identity_arguments(p.oid) args, pg_get_function_arguments(p.oid) args_def,
           pg_get_function_result(p.oid) res, p.proretset retset
      into f
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = n;
    if not found then raise exception 'função % não encontrada', n; end if;
    base := '_' || n || '_base';
    execute format('alter function public.%I(%s) rename to %I', n, f.args, base);
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', base, f.args);
    chamada := format('public.%I(%s)', base,
      (select coalesce(string_agg(split_part(trim(a), ' ', 1), ', '), '')
         from unnest(string_to_array(nullif(f.args, ''), ',')) a));
    corpo := case when f.retset
      then 'return query select * from ' || chamada || ';'
      else 'return ' || chamada || ';' end;
    execute format($f$
      create function public.%I(%s) returns %s
      language plpgsql stable security definer set search_path = public as $b$
      begin
        if not public.sou_equipe_interna() then
          raise exception 'Sem permissão para este relatório.' using errcode = '42501';
        end if;
        %s
      end $b$;$f$, n, f.args_def, f.res, corpo);
    execute format('revoke execute on function public.%I(%s) from public, anon', n, f.args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', n, f.args);
  end loop;
end $$;

-- ---------------------------------------------------------------- 4
drop policy if exists logos_escrita on storage.objects;
drop policy if exists logos_troca on storage.objects;
drop policy if exists logos_remocao on storage.objects;
create policy logos_escrita on storage.objects for insert to authenticated
  with check (bucket_id = 'client-logos' and public.sou_equipe_interna());
create policy logos_troca on storage.objects for update to authenticated
  using (bucket_id = 'client-logos' and public.sou_equipe_interna())
  with check (bucket_id = 'client-logos' and public.sou_equipe_interna());
create policy logos_remocao on storage.objects for delete to authenticated
  using (bucket_id = 'client-logos' and public.sou_equipe_interna());
update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'client-logos';

-- ---------------------------------------------------------------- 5
alter table public.demandas_edicao add constraint demandas_edicao_link_material_seguro
  check (link_material is null or link_material !~* '^\s*(javascript|data|vbscript|file):');
alter table public.video_versoes add constraint video_versoes_arquivo_url_seguro
  check (arquivo_url is null or arquivo_url !~* '^\s*(javascript|data|vbscript|file):');
alter table public.gravacao_itens add constraint gravacao_itens_url_segura
  check (url is null or url !~* '^\s*(javascript|data|vbscript|file):');
alter table public.clientes add constraint clientes_logo_url_segura
  check (logo_url is null or logo_url !~* '^\s*(javascript|data|vbscript|file):');

-- =====================================================================
-- (2ª migration, mesmo pacote) search_path fixo em toda função do public
-- (aviso function_search_path_mutable). Sem mudança de lógica.
-- =====================================================================
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') loop
    execute format('alter function %s set search_path = public', f.assinatura);
  end loop;
end $$;