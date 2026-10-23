-- zzz261: papéis das pessoas do cliente, por empresa.
--   dono   — vê tudo, aprova e cuida da equipe da empresa (convida, muda papel, remove)
--   gestor — vê tudo e aprova
--   equipe — vê e comenta; não aprova
-- O papel fica no vínculo (perfil_clientes): a mesma pessoa pode ser dona de
-- uma empresa e só equipe de outra. Substitui o "pode aprovar" da conta.
alter table public.perfil_clientes add column if not exists papel text not null default 'gestor';
alter table public.perfil_clientes add column if not exists convidado_por uuid references public.perfis(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfil_clientes_papel_valido') then
    alter table public.perfil_clientes add constraint perfil_clientes_papel_valido check (papel in ('dono', 'gestor', 'equipe'));
  end if;
end $$;
-- quem já existia: quem aprovava vira gestor, quem não aprovava vira equipe
update public.perfil_clientes pc set papel = case when p.pode_aprovar then 'gestor' else 'equipe' end
  from public.perfis p where p.id = pc.perfil_id and p.papel = 'cliente' and pc.papel = 'gestor' and not p.pode_aprovar;

-- senha provisória: quem entra com a senha que recebeu é convidado a trocá-la
alter table public.perfis add column if not exists senha_provisoria boolean not null default false;

create or replace function public.meu_papel_cliente(p_client uuid) returns text
language sql stable security definer set search_path to 'public' as $$
  select pc.papel from public.perfil_clientes pc where pc.perfil_id = auth.uid() and pc.client_id = p_client
$$;
grant execute on function public.meu_papel_cliente(uuid) to authenticated;

-- aprovar: equipe da B7 ou dono/gestor da empresa (antes: perfis.pode_aprovar)
create or replace function public.aprov_pode_decidir(p_client_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when public.sou_equipe() then true
    else exists (
      select 1 from public.perfis p
        join public.perfil_clientes pc on pc.perfil_id = p.id
        join public.clientes c on c.id = pc.client_id
       where p.id = auth.uid() and p.estado = 'ativa' and p.papel = 'cliente'
         and pc.client_id = p_client_id and pc.papel in ('dono', 'gestor')
         and coalesce(c.servico, 'ativo') = 'ativo')
  end
$$;

-- empresas da sessão: agora com o papel da pessoa em cada uma
create or replace function public.minhas_empresas() returns json
language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(json_build_object(
           'id', c.id, 'nome', c.nome, 'logo_url', c.logo_url,
           'servico', coalesce(c.servico, 'ativo'),
           'mensagem', c.servico_mensagem,
           'papel', pc.papel)
         order by c.nome), '[]'::json)
    from public.perfil_clientes pc
    join public.clientes c on c.id = pc.client_id
   where pc.perfil_id = auth.uid()
$$;

create or replace function public._posso_gerir_cliente(p_client uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.sou_admin() or coalesce(public.meu_papel_cliente(p_client) = 'dono', false)
$$;

-- pessoas de uma empresa (para o dono, no portal; e para a administração)
create or replace function public.cliente_pessoas(p_client uuid)
returns table(id uuid, nome text, username text, avatar_url text, papel text, estado text, ultimo_acesso timestamptz, sou_eu boolean, senha_provisoria boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public._posso_gerir_cliente(p_client) or public.sou_equipe()) then
    raise exception 'Só o dono da empresa vê a equipe.' using errcode = '42501';
  end if;
  return query
    select p.id, p.nome, p.username, p.avatar_url, pc.papel, p.estado, coalesce(p.last_seen_at, p.last_login_at), p.id = auth.uid(), p.senha_provisoria
      from public.perfil_clientes pc join public.perfis p on p.id = pc.perfil_id
     where pc.client_id = p_client and p.papel = 'cliente' and p.estado <> 'removida'
     order by case pc.papel when 'dono' then 0 when 'gestor' then 1 else 2 end, p.nome;
end $$;
grant execute on function public.cliente_pessoas(uuid) to authenticated;

create or replace function public._cliente_avisar_b7(p_client uuid, p_titulo text, p_msg text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare a uuid;
begin
  for a in select id from public.perfis where eh_admin and estado = 'ativa' loop
    perform public._acesso_notificar(a, 'cliente.equipe', p_titulo, p_msg, '#/cliente/' || p_client, null, jsonb_build_object('client_id', p_client));
  end loop;
end $$;
revoke all on function public._cliente_avisar_b7(uuid, text, text) from public, anon, authenticated;

create or replace function public.cliente_definir_papel(p_client uuid, p_perfil uuid, p_papel text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare atual text; nome_p text; nome_c text;
begin
  if not public._posso_gerir_cliente(p_client) then raise exception 'Só o dono da empresa muda papéis.' using errcode = '42501'; end if;
  if p_papel not in ('dono', 'gestor', 'equipe') then raise exception 'Papel inválido.'; end if;
  select pc.papel into atual from public.perfil_clientes pc where pc.client_id = p_client and pc.perfil_id = p_perfil;
  if atual is null then raise exception 'Essa pessoa não é desta empresa.'; end if;
  if atual = 'dono' and p_papel <> 'dono'
     and not exists (select 1 from public.perfil_clientes where client_id = p_client and papel = 'dono' and perfil_id <> p_perfil) then
    raise exception 'A empresa precisa de pelo menos um dono.';
  end if;
  update public.perfil_clientes set papel = p_papel where client_id = p_client and perfil_id = p_perfil;
  select nome into nome_p from public.perfis where id = p_perfil;
  select nome into nome_c from public.clientes where id = p_client;
  insert into public.auditoria(autor_id, autor_username, acao, alvo_tipo, alvo_id, alvo_descricao, detalhe)
  values (auth.uid(), (select username from public.perfis where id = auth.uid()), 'cliente_papel', 'perfil', p_perfil, nome_p,
          jsonb_build_object('client_id', p_client, 'antes', atual, 'depois', p_papel));
  if not public.sou_admin() then
    perform public._cliente_avisar_b7(p_client, nome_c || ': papel alterado', coalesce(nome_p, 'Alguém') || ' agora é ' ||
      case p_papel when 'dono' then 'Dono' when 'gestor' then 'Gestor' else 'Equipe' end || '.');
  end if;
end $$;
grant execute on function public.cliente_definir_papel(uuid, uuid, text) to authenticated;

-- tirar alguém da empresa: fica na função b7-auth (acao cliente_remover), que já
-- cuida dos vínculos com a chave de serviço, avisa a B7 e desativa a conta sem empresa.

-- a sessão passa a dizer se a senha ainda é a provisória (o portal pede a troca)
create or replace view public.minha_sessao as
 SELECT id, username, nome, papel, estado, pode_aprovar, avatar_url,
    COALESCE(preferencias, '{}'::jsonb) AS preferencias, last_login_at, last_seen_at,
    minhas_empresas() AS empresas,
    COALESCE(( SELECT array_agg(DISTINCT x.f ORDER BY x.f) AS array_agg
           FROM ( SELECT fe.funcao AS f FROM perfis_funcoes_extra fe WHERE fe.perfil_id = p.id
                UNION SELECT unnest(p.funcoes_adicionais) AS unnest) x
          WHERE x.f IS DISTINCT FROM p.papel AND p.papel <> 'cliente'::text), '{}'::text[]) AS funcoes_extra,
    eh_admin, funcao, modulos_efetivos(id) AS modulos, modulos_niveis(id) AS niveis, superadmin,
    senha_provisoria
   FROM perfis p
  WHERE id = auth.uid();
