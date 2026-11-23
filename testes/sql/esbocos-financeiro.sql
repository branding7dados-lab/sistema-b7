-- Esboços (como no banco do B7) das funções de Pessoas e da política de wa_config, para testar a zzz387
create or replace function public.perfil_definir_cargos(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin if not public.sou_admin() then raise exception 'Só administrador.' using errcode = '42501'; end if; end $$;
create or replace function public.funcao_personalizada_salvar(p text) returns void language plpgsql security definer set search_path = public as $$
begin if not sou_admin() then raise exception 'Só administrador.' using errcode = '42501'; end if; end $$;
create or replace function public.acesso_pedir(p text) returns void language plpgsql security definer set search_path = public as $$
begin if public.sou_admin() and false then raise exception 'x'; end if; end $$;
create or replace function public.relatorio_admin() returns text language plpgsql security definer set search_path = public as $$
begin if not public.sou_admin() then raise exception 'Só administrador.'; end if; return 'ok'; end $$;
grant execute on all functions in schema public to authenticated;
create table if not exists public.wa_config (id int primary key default 1, respostas jsonb default '[]');
insert into public.wa_config (id) values (1) on conflict do nothing;
alter table public.wa_config enable row level security;
drop policy if exists wa_config_ler on public.wa_config;
create policy wa_config_ler on public.wa_config for select to authenticated using (public.sou_admin());
grant select on public.wa_config to authenticated;
-- perfis: cada um edita a própria linha, admin edita todas (como no B7)
alter table public.perfis enable row level security;
drop policy if exists perfis_ler on public.perfis; create policy perfis_ler on public.perfis for select to authenticated using (true);
drop policy if exists perfis_editar on public.perfis; create policy perfis_editar on public.perfis for update to authenticated using (id = auth.uid() or public.sou_admin()) with check (id = auth.uid() or public.sou_admin());
grant select, update on public.perfis to authenticated;
create or replace function public.wa_quem_ve_whatsapp() returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select p.id from public.perfis p where p.estado = 'ativa' and p.papel <> 'cliente' and (coalesce(p.eh_admin, false) or coalesce(public.eh_videomaker_elegivel(p.id), false)) $$;
