-- Asserções da zzz393 (desligar módulo para a agência inteira)
\set ON_ERROR_STOP 1
insert into perfis (id, nome, papel, financeiro) values
  ('00000000-0000-0000-0000-0000000000a1', 'Yury', 'admin', false), ('00000000-0000-0000-0000-0000000000f1', 'Bruna', 'admin', true),
  ('00000000-0000-0000-0000-0000000000d1', 'Dani', 'designer', false);
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
do $$ declare v jsonb; begin
  v := modulo_desligar('whatsapp', true, '  Pausado até dezembro  ');
  assert v ? 'whatsapp', 'desliga o WhatsApp';
  assert v -> 'whatsapp' ->> 'por_nome' = 'Yury', 'guarda quem desligou';
  assert v -> 'whatsapp' ->> 'motivo' = 'Pausado até dezembro', 'guarda o motivo sem espaço nas pontas';
  assert (v -> 'whatsapp' ->> 'em') is not null, 'guarda quando';
end $$;
do $$ declare v jsonb; begin
  v := modulo_desligar('site', true, '');
  assert v ? 'whatsapp' and v ? 'site', 'desligar outro não religa o primeiro';
  assert v -> 'site' -> 'motivo' = 'null'::jsonb, 'motivo vazio vira nulo';
  v := modulo_desligar('whatsapp', false);
  assert not (v ? 'whatsapp') and v ? 'site', 'religa só o pedido';
  assert (select valor from sistema_config where chave = 'modulos_desligados') = v, 'o que voltou é o que ficou gravado';
  v := modulo_desligar('whatsapp', false);
  assert not (v ? 'whatsapp'), 'religar o que já está ligado não quebra';
end $$;
select pg_temp.recusa($$select modulo_desligar('senhas', true)$$, 'Módulo desconhecido');
select pg_temp.recusa($$select modulo_desligar(null, true)$$, 'Módulo desconhecido');
select pg_temp.recusa($$select modulo_desligar('video', null)$$, 'ligar ou desligar');
select pg_temp.recusa($$select modulo_desligar('video', true, repeat('a', 141))$$, '140 letras');

select pg_temp.sou('00000000-0000-0000-0000-0000000000f1');
select pg_temp.recusa($$select modulo_desligar('video', true)$$, '42501');   -- Financeiro não
select pg_temp.sou('00000000-0000-0000-0000-0000000000d1');
select pg_temp.recusa($$select modulo_desligar('video', true)$$, '42501');   -- equipe não
select set_config('teste.uid', '', false);
select pg_temp.recusa($$select modulo_desligar('video', true)$$, '42501');   -- sem login não
