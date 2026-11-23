-- Asserções da zzz387 (usuário Financeiro = administrador sem WhatsApp e sem Pessoas e acessos)
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel, eh_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Yury', 'admin', true),
  ('00000000-0000-0000-0000-0000000000f1', 'Fin', 'admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'Vic', 'videomaker', false) on conflict (id) do nothing;
update perfis set financeiro = true where id = '00000000-0000-0000-0000-0000000000f1';
set role authenticated;
-- financeiro
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-0000000000f1', false); end $$;
do $$ begin
  assert sou_admin(), 'financeiro continua administrador';
  assert sou_financeiro() and not sou_admin_pleno(), 'financeiro não é admin pleno';
  begin perform perfil_definir_cargos('00000000-0000-0000-0000-0000000000b1'); assert false, 'financeiro não muda cargos';
  exception when insufficient_privilege then null; end;
  begin perform funcao_personalizada_salvar('x'); assert false, 'financeiro não cria função';
  exception when insufficient_privilege then null; end;
  perform acesso_pedir('qualquer');   -- pedido de acesso é de todo mundo
  assert relatorio_admin() = 'ok', 'o resto do admin continua valendo';
  assert not wa_pode_ver_numero(wa_numero_padrao()), 'financeiro não vê o WhatsApp';
  assert not pode_ver_wa(), 'financeiro fora da Central';
  assert (select count(*) from wa_numeros) = 0, 'financeiro não vê o cadastro de números';
  assert (select count(*) from wa_config) = 0, 'financeiro não lê as configurações do WhatsApp';
end $$;
do $$ begin
  begin update perfis set financeiro = false where id = '00000000-0000-0000-0000-0000000000f1'; exception when others then null; end;
end $$;
reset role;
do $$ begin assert (select financeiro from perfis where id = '00000000-0000-0000-0000-0000000000f1'), 'financeiro não tira a própria marca'; end $$;
set role authenticated;
-- admin pleno
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-0000000000a1', false); end $$;
do $$ begin
  assert sou_admin_pleno(), 'Yury é admin pleno';
  perform perfil_definir_cargos('00000000-0000-0000-0000-0000000000b1');
  assert wa_pode_ver_numero(wa_numero_padrao()), 'admin pleno vê o WhatsApp';
  assert (select count(*) from wa_config) = 1, 'admin pleno lê wa_config';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from wa_quem_ve_whatsapp() x where x = '00000000-0000-0000-0000-0000000000f1'), 'financeiro não recebe aviso de WhatsApp';
  assert position('sou_admin_pleno_pleno' in pg_get_functiondef('public.perfil_definir_cargos(uuid)'::regprocedure)) = 0, 'rodar 2× não estraga';
end $$;
\echo 'financeiro OK'
