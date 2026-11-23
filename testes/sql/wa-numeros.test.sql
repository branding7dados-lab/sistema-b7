-- Asserções da zzz383. Roda como superusuário e troca de papel/pessoa com set role + teste.uid.
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel, eh_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'Vic Vídeo', 'videomaker', false),
  ('00000000-0000-0000-0000-00000000000c', 'Dani Design', 'designer', false),
  ('00000000-0000-0000-0000-00000000000d', 'Coord com extra', 'coordenador', false);
update perfis set funcoes_adicionais = '{designer}' where id = '00000000-0000-0000-0000-00000000000d';
insert into wa_numeros (id, nome, instancia, equipes) values ('00000000-0000-0000-0000-0000000000d1', 'Designers', 'b7-designers', '{designer}');

do $$
declare pad uuid := wa_numero_padrao(); des uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  assert (select count(*) from wa_numeros where padrao) = 1, 'um padrão só';
  assert (select instancia from wa_numeros where padrao) = 'b7-piloto', 'padrão é b7-piloto';
  assert (select nome from wa_numeros where padrao) = 'Videomakers', 'padrão chama Videomakers';
  assert (select count(*) from wa_conversas where numero_id = pad) = 2, 'conversas antigas no padrão';
  assert (select numero_id from wa_mensagens where id = 'ANTIGA') = pad, 'mensagem antiga no padrão';
  -- o mesmo grupo e a mesma mensagem nos dois números
  insert into wa_conversas (numero_id, jid, tipo, nome, nao_lidas) values (des, '1@g.us', 'grupo', 'Grupo antigo', 5);
  insert into wa_mensagens (numero_id, id, jid, texto) values (des, 'ANTIGA', '1@g.us', 'oi');
  assert (select count(*) from wa_mensagens where id = 'ANTIGA') = 2, 'mesma mensagem nos dois números';
  -- sem numero_id explícito cai no padrão
  insert into wa_conversas (jid) values ('9@s.whatsapp.net');
  assert (select numero_id from wa_conversas where jid = '9@s.whatsapp.net') = pad, 'default = padrão';
end $$;

-- designer: vê só o número dos designers
set role authenticated;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$
declare des uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  assert (select count(*) from wa_conversas) = 1, 'designer vê 1 conversa (a do número dele)';
  assert (select count(distinct numero_id) from wa_mensagens) = 1, 'designer vê só mensagens do número dele';
  assert (select count(*) from wa_numeros) = 1, 'designer vê só o número dele no cadastro';
  assert not wa_pode_ver_numero(wa_numero_padrao()), 'designer não vê o número dos vídeos';
  assert pode_ver_wa(), 'designer tem algum número';
  perform wa_conversa_marcar('1@g.us', 'lida', null, des);
  begin
    perform wa_conversa_marcar('1@g.us', 'lida', null, wa_numero_padrao());
    assert false, 'designer não pode marcar no número dos vídeos';
  exception when insufficient_privilege then null; end;
  begin
    perform wa_conversa_marcar('1@g.us', 'lida');
    assert false, 'sem número = padrão: designer também não pode';
  exception when insufficient_privilege then null; end;
  perform wa_nota_interna('1@g.us', 'nota do design', des);
end $$;

-- coordenador com a função extra "designer" vê o número dos designers
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000d', false); end $$;
do $$ begin assert (select count(*) from wa_conversas) = 1, 'função extra conta'; end $$;

-- videomaker: vê o padrão
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000b', false); end $$;
do $$ begin
  assert (select count(*) from wa_conversas) = 3, 'videomaker vê as 3 do padrão';
  perform wa_conversa_marcar('1@g.us', 'lida');
end $$;

-- admin: vê tudo
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  assert (select count(*) from wa_conversas) = 4, 'admin vê todas';
  assert (select count(*) from wa_numeros) = 2, 'admin vê o cadastro todo';
end $$;
reset role;

do $$
declare pad uuid := wa_numero_padrao(); des uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  assert (select nao_lidas from wa_conversas where numero_id = des and jid = '1@g.us') = 0, 'lida zerou no Design';
  assert (select nao_lidas from wa_conversas where numero_id = pad and jid = '1@g.us') = 0, 'videomaker zerou no padrão';
  assert (select numero_id from wa_mensagens where nota and texto = 'nota do design') = des, 'nota no número certo';
  -- sem acesso nenhum: pessoa sem número
  -- número inativo some para quem não é admin
end $$;
update wa_numeros set ativo = false where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$ begin
  assert (select count(*) from wa_conversas) = 0, 'número desativado: designer não vê mais';
  assert not pode_ver_wa(), 'designer sem número ativo não entra na Central';
end $$;
reset role;
\echo 'asserções OK'

-- juntar @lid só dentro do mesmo número
update wa_numeros set ativo = true where id = '00000000-0000-0000-0000-0000000000d1';
insert into wa_contatos (jid, numero, nome) values ('777@lid', '551188887777', 'Bia');
insert into wa_conversas (numero_id, jid, tipo, nome, nao_lidas) values
  ('00000000-0000-0000-0000-0000000000d1', '777@lid', 'contato', 'Bia', 2),
  (wa_numero_padrao(), '551188887777@s.whatsapp.net', 'contato', 'Bia', 1);
insert into wa_mensagens (numero_id, id, jid, texto) values ('00000000-0000-0000-0000-0000000000d1', 'L1', '777@lid', 'oi do lid');
select wa_unir_lids() \g /dev/null
do $$
declare des uuid := '00000000-0000-0000-0000-0000000000d1';
begin
  assert (select count(*) from wa_conversas where jid = '777@lid') = 0, 'lid virou número';
  assert (select nao_lidas from wa_conversas where numero_id = des and jid = '551188887777@s.whatsapp.net') = 2, 'no Design, a conversa do lid foi renomeada (não juntou com a do padrão)';
  assert (select nao_lidas from wa_conversas where numero_id = wa_numero_padrao() and jid = '551188887777@s.whatsapp.net') = 1, 'a do padrão ficou como estava';
  assert (select jid from wa_mensagens where id = 'L1') = '551188887777@s.whatsapp.net', 'mensagem acompanhou (on update cascade)';
end $$;
\echo 'juntar @lid OK'

-- 4.85.0: membros guardados e grupos em comum (só dos números que quem chama vê)
insert into wa_conversas (numero_id, jid, tipo, nome) values ('00000000-0000-0000-0000-0000000000d1', '2@g.us', 'grupo', 'Grupo Design');
insert into wa_grupo_membros (numero_id, grupo_jid, membro_jid, telefone, admin) values
  (wa_numero_padrao(), '1@g.us', '556299990000@s.whatsapp.net', '556299990000', null),
  ('00000000-0000-0000-0000-0000000000d1', '2@g.us', '888@lid', '556299990000', 'admin');
insert into wa_contatos (jid, numero, nome) values ('888@lid', '556299990000', 'Carla') on conflict (jid) do update set numero = excluded.numero;
set role authenticated;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000c', false); end $$;
do $$ begin
  assert (select count(*) from wa_grupos_em_comum('556299990000@s.whatsapp.net')) = 1, 'designer: só o grupo do número dele';
  assert (select grupo_jid from wa_grupos_em_comum('556299990000@s.whatsapp.net')) = '2@g.us', 'designer: é o grupo do Design';
  assert (select count(*) from wa_grupo_membros) = 1, 'designer só lê membros do número dele';
end $$;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  assert (select count(*) from wa_grupos_em_comum('556299990000@s.whatsapp.net')) = 2, 'admin: os dois grupos';
  assert (select count(*) from wa_grupos_em_comum('888@lid')) = 2, '@lid casa pelo telefone guardado em wa_contatos';
  assert (select count(*) from wa_grupos_em_comum('x@lid', '556299990000')) = 2, 'telefone passado direto';
  assert (select count(*) from wa_grupos_em_comum('999@s.whatsapp.net')) = 0, 'quem não está em grupo nenhum';
end $$;
reset role;
do $$ begin assert (select count(*) from information_schema.columns where table_name = 'wa_conversas' and column_name in ('descricao','criado_wa','dono_jid','so_admins_enviam','so_admins_editam','membros_qtd','membros_em')) = 7, 'colunas do grupo'; end $$;
\echo 'membros e grupos em comum OK'

-- 4.85.3: o grupo é do cliente em qualquer número — ligar numa cópia liga todas
insert into clientes (id, nome) values ('00000000-0000-0000-0000-0000000000c1', 'Cliente Alfa');
set role authenticated;
do $$ begin perform set_config('teste.uid', '00000000-0000-0000-0000-00000000000a', false); end $$;
do $$ begin
  perform wa_conversa_marcar('1@g.us', 'cliente', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1');
  assert (select count(*) from wa_conversas where jid = '1@g.us' and cliente_id = '00000000-0000-0000-0000-0000000000c1') = 2, 'ligar no Design liga também no número dos vídeos';
  perform wa_conversa_marcar('1@g.us', 'cliente', '', wa_numero_padrao());
  assert (select count(*) from wa_conversas where jid = '1@g.us' and cliente_id is not null) = 0, 'desligar também vale para todas as cópias';
end $$;
reset role;
\echo 'cliente em todos os números OK'
