-- Asserções da zzz392
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel, financeiro, superadmin) values
  ('00000000-0000-0000-0000-0000000000a2', 'Kevin', 'admin', false, 'supremo'), ('00000000-0000-0000-0000-0000000000a3', 'Sup', 'admin', false, 'super'),
  ('00000000-0000-0000-0000-0000000000a4', 'Mallory', 'admin', false, null);
insert into perfis (id, nome, papel, financeiro) values
  ('00000000-0000-0000-0000-0000000000a1', 'Yury', 'admin', false), ('00000000-0000-0000-0000-0000000000f1', 'Bruna', 'admin', true),
  ('00000000-0000-0000-0000-0000000000d1', 'Dani', 'designer', false), ('00000000-0000-0000-0000-0000000000cc', 'Dona Cliente', 'cliente', false);
create or replace function pg_temp.sou(p uuid) returns void language sql as $$ select set_config('teste.uid', p::text, false) $$;
create or replace function pg_temp.recusa(p_sql text, p_como text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if p_como = '42501' and sqlstate <> '42501' then raise exception 'esperava 42501 em: % (veio %: %)', p_sql, sqlstate, sqlerrm; end if;
    if p_como <> '42501' and position(p_como in sqlerrm) = 0 then raise exception 'esperava "%" em: % (veio: %)', p_como, p_sql, sqlerrm; end if;
    return;
  end;
  raise exception 'deveria ter recusado: %', p_sql;
end $$;
set role authenticated;
select pg_temp.sou('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  assert perfil_email_definir('00000000-0000-0000-0000-0000000000d1', '  Dani@Branding7.com.br ') = 'dani@branding7.com.br', 'grava minúsculo e sem espaço';
  assert perfil_email_definir('00000000-0000-0000-0000-0000000000a1', 'yury@branding7.com.br') = 'yury@branding7.com.br';
  assert (perfis_emails()->>'00000000-0000-0000-0000-0000000000d1') = 'dani@branding7.com.br', 'admin lê os e-mails';
end $$;
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000a1', 'DANI@branding7.com.br')$$, 'já é de Dani');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000a1', 'semarroba')$$, 'não parece certo');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000cc', 'dona@cliente.com')$$, 'cliente');
do $$ begin assert perfil_email_definir('00000000-0000-0000-0000-0000000000d1', '') is null; end $$;
do $$ begin assert (perfis_emails() ? '00000000-0000-0000-0000-0000000000d1') = false, 'vazio apaga'; end $$;
do $$ begin perform perfil_email_definir('00000000-0000-0000-0000-0000000000d1', 'dani@branding7.com.br'); end $$;
-- hierarquia: admin comum não muda o e-mail de super admin nem do supremo (isso abriria a conta pela Central)
select pg_temp.sou('00000000-0000-0000-0000-0000000000a4');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000a2', 'mallory@n7.com')$$, '42501');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000a3', 'mallory@n7.com')$$, '42501');
select pg_temp.sou('00000000-0000-0000-0000-0000000000a3');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000a2', 'sup@n7.com')$$, 'supremo');
do $$ begin assert perfil_email_definir('00000000-0000-0000-0000-0000000000a3', 'sup@n7.com') = 'sup@n7.com', 'o super admin muda o próprio'; end $$;
select pg_temp.sou('00000000-0000-0000-0000-0000000000a2');
do $$ begin assert perfil_email_definir('00000000-0000-0000-0000-0000000000a2', 'kevin@n7.com') = 'kevin@n7.com', 'o supremo muda o próprio'; end $$;
reset role;
do $$ begin assert (select count(*) from auditoria where acao = 'email_nucleo7') >= 4, 'cada mudança de e-mail fica na auditoria'; end $$;
set role authenticated;
select pg_temp.sou('00000000-0000-0000-0000-0000000000a1');

-- o Financeiro não mexe em e-mail (é de Pessoas e acessos)
select pg_temp.sou('00000000-0000-0000-0000-0000000000f1');
select pg_temp.recusa($$select perfil_email_definir('00000000-0000-0000-0000-0000000000d1', 'x@y.com')$$, '42501');
select pg_temp.recusa($$select perfis_emails()$$, '42501');
do $$ begin assert (select count(*) from perfis_email) = 0, 'Financeiro não lê os e-mails da equipe'; end $$;
-- cada um lê só o próprio; o cliente do portal não lê nenhum
select pg_temp.sou('00000000-0000-0000-0000-0000000000d1');
do $$ begin assert (select count(*) from perfis_email) = 1 and (select email from perfis_email) = 'dani@branding7.com.br', 'designer lê só o seu'; end $$;
select pg_temp.recusa($$insert into perfis_email values ('00000000-0000-0000-0000-0000000000d1', 'a@b.co')$$, '42501');
select pg_temp.sou('00000000-0000-0000-0000-0000000000cc');
do $$ begin assert (select count(*) from perfis_email) = 0, 'cliente não lê e-mail nenhum'; end $$;
-- o bilhete: só o servidor marca, e uma vez só
select pg_temp.recusa($$select ponte_usar('11111111-1111-4111-8111-111111111111', null)$$, '42501');
select pg_temp.recusa($$select * from ponte_usados$$, '42501');
reset role; set role service_role;
do $$ begin
  assert ponte_usar('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-0000000000d1') = true, 'primeira vez: vale';
  assert ponte_usar('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-0000000000d1') = false, 'segunda vez: já usado';
end $$;
reset role;
insert into ponte_usados (jti, usado_em) values ('22222222-2222-4222-8222-222222222222', now() - interval '2 days');
set role service_role;
do $$ begin perform ponte_usar('33333333-3333-4333-8333-333333333333', null); end $$;
reset role;
do $$ begin assert not exists (select 1 from ponte_usados where jti = '22222222-2222-4222-8222-222222222222'), 'usados com mais de 1 dia são apagados'; end $$;
select 'ponte OK';
