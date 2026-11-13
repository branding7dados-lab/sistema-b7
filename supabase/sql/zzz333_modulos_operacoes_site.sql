-- =====================================================================
-- zzz333 (4.44.0) — Operações e Site entram na matriz de permissões
-- (Usuários e acessos), para liberar a colaboradores.
--   Operações: padrão para coordenador, designer e videomaker (era aberto
--              a toda a equipe interna; continua igual até alguém mexer).
--   Site:      ninguém por padrão (era só administrador); quem receber
--              o módulo passa a ver (1), editar (2) ou tudo (3, inclui
--              chaves da API). Administrador continua com tudo.
-- Só acrescenta e ajusta políticas (alter policy); nada é apagado.
-- =====================================================================
insert into public.modulos (id, rotulo, ordem) values
  ('operacoes', 'Operações', 58),
  ('site', 'Site da agência', 95)
on conflict (id) do update set rotulo = excluded.rotulo;

insert into public.funcao_modulos (funcao, modulo, nivel) values
  ('coordenador', 'operacoes', 'total'), ('designer', 'operacoes', 'total'), ('videomaker', 'operacoes', 'total')
on conflict do nothing;

-- ---------------------------------------------------------------- site
alter policy site_itens_publico on public.site_itens using (publicado or public.pode_nivel('site', 1));
alter policy site_itens_admin_ins on public.site_itens with check (public.pode_nivel('site', 2));
alter policy site_itens_admin_upd on public.site_itens using (public.pode_nivel('site', 2)) with check (public.pode_nivel('site', 2));
alter policy site_itens_admin_del on public.site_itens using (public.pode_nivel('site', 2));
alter policy site_config_admin on public.site_config using (public.pode_nivel('site', 2)) with check (public.pode_nivel('site', 2));
alter policy site_leads_admin_le on public.site_leads using (public.pode_nivel('site', 1));
alter policy site_leads_admin_upd on public.site_leads using (public.pode_nivel('site', 2)) with check (public.pode_nivel('site', 2));
alter policy site_eventos_admin_le on public.site_eventos using (public.pode_nivel('site', 1));
alter policy site_api_chaves_admin_le on public.site_api_chaves using (public.pode_nivel('site', 3));
alter policy site_arquivos_admin_ins on storage.objects with check (bucket_id = 'site' and public.pode_nivel('site', 2));
alter policy site_arquivos_admin_upd on storage.objects using (bucket_id = 'site' and public.pode_nivel('site', 2));
alter policy site_arquivos_admin_del on storage.objects using (bucket_id = 'site' and public.pode_nivel('site', 2));

create or replace function public.site_metricas(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.pode_nivel('site', 1) then raise exception 'Sem acesso ao Site.'; end if;
  return public._site_metricas(p_dias);
end $$;

create or replace function public.site_api_chave_criar(p_nome text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_chave text;
begin
  if not public.pode_nivel('site', 3) then raise exception 'Sem acesso para criar chaves.'; end if;
  v_chave := 'b7site_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.site_api_chaves (nome, prefixo, resumo)
  values (left(trim(coalesce(p_nome, 'Integração')), 80), left(v_chave, 14), encode(extensions.digest(v_chave, 'sha256'), 'hex'));
  return v_chave;
end $$;

create or replace function public.site_api_chave_revogar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_nivel('site', 3) then raise exception 'Sem acesso para revogar chaves.'; end if;
  update public.site_api_chaves set revogada_em = now() where id = p_id and revogada_em is null;
end $$;

-- conferência (aparece no resultado da rotina)
select id, rotulo from public.modulos where id in ('operacoes', 'site') order by id;
