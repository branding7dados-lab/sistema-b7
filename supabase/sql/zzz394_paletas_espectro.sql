-- 5.17.0 — PALETAS DO ESPECTRO NA APARÊNCIA DA EQUIPE
-- O quadro Config-aparencia do artefato troca as 11 paletas antigas por 3, todas dentro da nova marca:
-- 'b7' (Padrão B7), 'matriz' e 'laser'. aparencia_definir só aceitava as antigas; aqui ela passa a aceitar
-- também 'matriz' e 'laser'. Nada mais muda: a mesma checagem de administrador, os mesmos campos.
-- Reescreve a função NA DEFINIÇÃO QUE ESTÁ NO AR (pg_get_functiondef) e confere o resultado. Pode rodar mais de uma vez.
do $$
declare d text; n text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'aparencia_definir' and pg_get_function_identity_arguments(p.oid) = 'p_valor jsonb';
  if d is null then raise exception 'zzz394: aparencia_definir não existe.'; end if;
  if position('''matriz''' in d) = 0 then
    n := regexp_replace(d, '(c_paletas\s+constant\s+text\[\]\s*:=\s*array\[)', '\1''matriz'', ''laser'', ');
    if n = d then raise exception 'zzz394: não achei a lista de paletas em aparencia_definir.'; end if;
    execute n;
  end if;
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'aparencia_definir' and pg_get_function_identity_arguments(p.oid) = 'p_valor jsonb';
  if position('''matriz''' in d) = 0 or position('''laser''' in d) = 0 then raise exception 'zzz394: as paletas novas não entraram.'; end if;
end $$;
